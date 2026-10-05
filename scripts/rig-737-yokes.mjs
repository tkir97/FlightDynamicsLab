import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {flatten,getBounds,dedup,join,weld,prune,meshopt} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
await MeshoptEncoder.ready;await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
if(!process.argv[2]||!process.argv[3])throw Error('Usage: node rig-737-yokes.mjs original.glb output.glb');
const d=await io.read(process.argv[2]);await d.transform(flatten());const scene=d.getRoot().listScenes()[0],nodes=[...d.getRoot().listNodes()];
for(const [role,x,columnName]of [['captain',.301,'Cylinder.126_Material.136_0'],['first-officer',-.255,'Cylinder.129_Material.136_0']]){
 const base=[x,1.557,1.31],hub=[x,1.965,1.266];
 const pitch=d.createNode('yoke-column-'+role).setTranslation(base);scene.addChild(pitch);
 const roll=d.createNode('yoke-wheel-'+role).setTranslation(hub.map((v,i)=>v-base[i]));pitch.addChild(roll);
 let wheelCount=0,columnCount=0;
 for(const node of nodes){if(!node.getMesh())continue;const {min,max}=getBounds(node);
  const wheel=min[0]>x-.145&&max[0]<x+.145&&min[1]>1.913&&max[1]<2.045&&min[2]>1.232&&max[2]<1.285;
  const column=node.getName()===columnName;
  if(!wheel&&!column)continue;
  const pivot=column?base:hub,parent=column?pitch:roll;
  const translation=node.getTranslation();parent.addChild(node);node.setTranslation(translation.map((v,i)=>v-pivot[i]));
  if(column)columnCount++;else wheelCount++;
 }
 if(columnCount!==1||wheelCount<30)throw Error('Missing yoke parts: '+role);
 console.log(role,{wheelCount,columnCount});
}
// Join within each rig group, preserving its pivots. Do not flatten again.
await d.transform(dedup(),join(),weld(),prune({keepAttributes:false,keepIndices:false,keepLeaves:false}),meshopt({encoder:MeshoptEncoder,level:'high'}));
await io.write(process.argv[3],d);
