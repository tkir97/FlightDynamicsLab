import {paintRadar} from './f15-radar.mjs';
import {paintDisplay} from './flight-displays.mjs';
export const F15_SCREEN_LAYOUT=[{kind:'radar',x:-5.675,y:1.132,z:.19,w:.145,h:.125},{kind:'pfd',x:-5.675,y:1.132,z:.004,w:.195,h:.125},{kind:'engine',x:-5.675,y:1.132,z:-.215,w:.125,h:.125}];
export function prepareF15(scene,T){
 // The export contains repeat assemblies and an unpositioned rear canopy.
 for(const name of ['CanopyBackCover','CanopyGlassInside','CanopyGlass','Canopy','InsideFrontFuselage','InteriorBucket005','GlareShield002']){const node=scene.getObjectByName(name);if(node)node.visible=false;}
 const glass=scene.getObjectByName('GlassHud');if(glass){glass.material=glass.material.clone();glass.material.transparent=true;glass.material.opacity=.12;glass.material.depthWrite=false;glass.material.side=T.DoubleSide;}
}
export class F15CockpitDisplays{
 constructor(T,scene){this.screens=F15_SCREEN_LAYOUT.map(spec=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.minFilter=T.LinearFilter;texture.generateMipmaps=false;const mesh=new T.Mesh(new T.PlaneGeometry(spec.w,spec.h),new T.MeshBasicMaterial({map:texture,toneMapped:false}));mesh.name='live-f15-'+spec.kind;mesh.position.set(spec.x,spec.y,spec.z);mesh.rotation.y=Math.PI/2;scene.add(mesh);return {...spec,canvas,texture,mesh};});}
 update(data,now=performance.now()){if(!data?.ready||now-(this.last??-Infinity)<50)return;this.last=now;for(const s of this.screens){const g=s.canvas.getContext('2d');if(s.kind==='radar')paintRadar(g,data.radar);else paintDisplay(g,s.kind,data);s.texture.needsUpdate=true;}}
}
export class F15CockpitStick{
 constructor(T,scene){this.group=new T.Group();this.group.name='live-f15-stick';this.group.position.set(-5.52,.415,0);scene.add(this.group);scene.updateMatrixWorld(true);for(const name of ['stick-handle','msip-stick']){const o=scene.getObjectByName(name);if(o)this.group.attach(o);} }
 update(data){const input=data.controls?.pilot;this.group.rotation.set(-(input?.aileron??0)*.17,0,(input?.elevator??0)*.17);}
}
