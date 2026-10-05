import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {GLTFLoader,MeshoptDecoder} from './dist/vendor/three/cockpit-runtime.mjs';
import {CockpitYokes} from './dist/cockpit-yokes.mjs';import {PilotControls} from './dist/pilot-controls.mjs';
test('shipped loader decodes the optimized uploaded cockpit with geometry and attribution intact',async()=>{
  const bytes=await readFile(new URL('./dist/assets/737-cockpit.glb',import.meta.url));assert.ok(bytes.byteLength<10_000_000);
  const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  let triangles=0,meshes=0;gltf.scene.traverse(o=>{if(o.isMesh){meshes++;triangles+=o.geometry.index.count/3;}});
  assert.equal(triangles,1746324);assert.ok(meshes<150);assert.match(gltf.asset.extras.author,/hakai315/);assert.match(gltf.asset.extras.license,/CC-BY-4.0/);assert.equal(gltf.animations.length,0);
});
test('737 pilot input moves both original yokes together, leaves trim neutral and resets',async()=>{
 const bytes=await readFile(new URL('./dist/assets/737-cockpit.glb',import.meta.url));const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const rig=new CockpitYokes(gltf.scene),pilot=new PilotControls(),data={aircraft:{key:'b737'},trim:{elevator:.05,aileron:.01,rudder:0},elapsed:1};
 data.controls=pilot.sample(data,new Set(['ArrowDown','ArrowRight']),.016,0,.7);
 let now=rig.lastTime;for(let i=0;i<10;i++)rig.update(data,now+=100);
 for(const pair of rig.pairs){assert.ok(pair.column.rotation.x<-.17);assert.ok(pair.wheel.rotation.z>1.2);assert.ok(pair.column.children.includes(pair.wheel));}
 assert.equal(rig.pairs[0].wheel.rotation.z,rig.pairs[1].wheel.rotation.z);
 data.controls=pilot.sample(data,new Set(),.016,.1,.7);for(let i=0;i<10;i++)rig.update(data,now+=100);
 assert.ok(Math.abs(rig.pairs[0].wheel.rotation.z)<1e-5);assert.ok(Math.abs(rig.pairs[0].column.rotation.x)<1e-5,'trim offset does not move the yoke');
 data.controls=pilot.sample(data,new Set(['ArrowUp','ArrowLeft']),.016,0,.7);for(let i=0;i<10;i++)rig.update(data,now+=100);
 assert.ok(rig.pairs[0].column.rotation.x>.17&&rig.pairs[0].wheel.rotation.z< -1.2);
 data.elapsed=0;data.controls={};rig.update(data,now+=100);assert.equal(rig.pairs[0].column.rotation.x,0);assert.equal(rig.pairs[0].wheel.rotation.z,0);
});
test('uploaded F-15 decodes embedded textures, places live screens and moves the supplied stick',async()=>{
 const {THREE:T}=await import('./dist/vendor/three/cockpit-runtime.mjs'),{prepareF15,F15CockpitDisplays,F15CockpitStick}=await import('./dist/f15-cockpit.mjs');
 const oldSelf=globalThis.self,oldBitmap=globalThis.createImageBitmap,oldDocument=globalThis.document;let textures=0;
 globalThis.self=globalThis;globalThis.createImageBitmap=async blob=>{const bytes=Buffer.from(await blob.arrayBuffer());assert.equal(bytes.subarray(1,4).toString(),'PNG');textures++;return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};};
 globalThis.document={createElement:()=>({width:512,height:512,getContext:()=>new Proxy({},{get:()=>()=>{},set:()=>true})})};
 try{const bytes=await readFile(new URL('./dist/assets/f15-cockpit.glb',import.meta.url));const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');assert.ok(textures>=14);let triangles=0;gltf.scene.traverse(o=>{if(o.isMesh)triangles+=o.geometry.index.count/3;});assert.equal(triangles,53524);prepareF15(gltf.scene,T);assert.equal(gltf.scene.getObjectByName('GlareShield002').visible,false);assert.ok(gltf.scene.getObjectByName('GlassHud').material.transparent);
 const screens=new F15CockpitDisplays(T,gltf.scene);assert.equal(screens.screens.length,3);const data={ready:true,state:[0,0,-3000],attitude:{roll:0,pitch:0,yaw:0},velocity:[180,0,0],controls:{pilot:{elevator:0,aileron:0}},flight:{CAS:170,V:180,mach:.55,enginePercent:90,fuelKg:2000,engines:[{n1:90,n2:98,fuelFlow:.5},{n1:90,n2:98,fuelFlow:.5}]}};screens.update(data,100);for(const screen of screens.screens){assert.ok(screen.texture.version>0);assert.ok(screen.mesh.position.x> -5.683);assert.ok(screen.mesh.position.y>1);}
 const rig=new F15CockpitStick(T,gltf.scene),handle=gltf.scene.getObjectByName('stick-handle');const center=()=>{gltf.scene.updateMatrixWorld(true);return new T.Box3().setFromObject(handle).getCenter(new T.Vector3());};const neutral=center();data.controls.pilot={elevator:1,aileron:1};rig.update(data);const pushed=center();assert.ok(pushed.x<neutral.x,'push moves grip forward');assert.ok(pushed.z<neutral.z,'right roll moves grip right');data.controls.pilot={elevator:0,aileron:0};rig.update(data);assert.ok(center().distanceTo(neutral)<1e-8);
 }finally{globalThis.self=oldSelf;globalThis.createImageBitmap=oldBitmap;globalThis.document=oldDocument;}
});
