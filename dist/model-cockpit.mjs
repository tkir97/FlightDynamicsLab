import {MODELS} from './models.mjs';
import {prepareF15,F15CockpitDisplays,F15CockpitStick} from './f15-cockpit.mjs';
import {FlightDisplays} from './flight-displays.mjs';
import {CockpitYokes} from './cockpit-yokes.mjs';
// Camera basis: GLB forward +Z, right -X and up +Y.
export function cockpitPose(yaw,pitch,key='b737'){const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);if(key==='f15')return {eye:[-5.07,1.48,0],forward:[-cy*cp,-sp,-sy*cp],up:[-cy*sp,cp,-sy*sp]};return {eye:[.35,2.12,1],forward:[-sy*cp,-sp,cy*cp],up:[-sy*sp,cp,cy*sp]};}
export class ModelCockpit{
  constructor(key='b737'){this.key=key;this.model=MODELS[key];this.status='loading';this.load();}
  async load(){try{
    const {THREE:T,GLTFLoader,MeshoptDecoder}=await import('./vendor/three/cockpit-runtime.mjs');this.T=T;
    const canvas=document.createElement('canvas');this.renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.status='error';this.message='3D cockpit interrupted. Reload to restore it.';});
    this.renderer.setPixelRatio(1);this.renderer.setClearColor(0x000000,0);this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;
    this.scene=new T.Scene();this.camera=new T.PerspectiveCamera(60,1,.02,100);
    this.scene.add(new T.HemisphereLight(0xcce9ff,0xb8b5aa,3));const light=new T.DirectionalLight(0xffffff,2.5);light.position.set(0,4,3);this.scene.add(light);const fill=new T.DirectionalLight(0xd7e6ff,1);fill.position.set(-2,2,-2);this.scene.add(fill);
    const response=await fetch(new URL('./'+this.model.cockpitAsset,import.meta.url),{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error('Cockpit model download failed');
    const model=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(await response.arrayBuffer(),'');this.scene.add(model.scene);if(this.key==='f15'){prepareF15(model.scene,T);this.yokes=new F15CockpitStick(T,model.scene);this.displays=new F15CockpitDisplays(T,this.scene);}else{this.yokes=new CockpitYokes(model.scene);this.displays=new FlightDisplays(T,this.scene);}this.status='ready';
  }catch(error){this.status='error';this.message='3D cockpit could not load. The simplified cockpit is available; reload to retry.';this.renderer?.dispose();}}
  draw(g,W,H,yaw,pitch,zoom=1,data){if(this.status!=='ready')return false;try{
    this.displays.update(data);this.yokes.update(data);const T=this.T,pose=cockpitPose(yaw,pitch,this.key),camera=this.camera;
    camera.position.fromArray(pose.eye);camera.up.fromArray(pose.up);camera.lookAt(new T.Vector3(...pose.eye).add(new T.Vector3(...pose.forward)));
    const focal=W*.52*zoom;camera.fov=2*Math.atan(H/(2*focal))*180/Math.PI;camera.aspect=W/H;camera.updateProjectionMatrix();camera.projectionMatrix.elements[9]=2*.32-1;camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    // Bound GLB raster resolution while the physics worker remains independent.
    const scale=Math.min(1,1200/W);const width=Math.max(1,Math.round(W*scale)),height=Math.max(1,Math.round(H*scale));if(this.width!==width||this.height!==height){this.renderer.setSize(width,height,false);this.width=width;this.height=height;}this.renderer.render(this.scene,camera);g.drawImage(this.renderer.domElement,0,0,W,H);return true;
  }catch{this.status='error';this.message='3D cockpit rendering is unavailable on this device.';return false;}}
}
