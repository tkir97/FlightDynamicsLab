import {ORIGIN} from './imagery.mjs';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const hash=(x,y)=>{let h=Math.imul(x,374761393)^Math.imul(y,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};
function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y);let u=x-ix,v=y-iy;u=u*u*(3-2*u);v=v*v*(3-2*v);return (hash(ix,iy)*(1-u)+hash(ix+1,iy)*u)*(1-v)+(hash(ix,iy+1)*(1-u)+hash(ix+1,iy+1)*u)*v;}
export function skyColor(ray,height=900,time=0){
 const length=Math.hypot(...ray),n=ray[0]/length,e=ray[1]/length,d=ray[2]/length,elevation=clamp(-d),horizon=Math.exp(-elevation*7),high=clamp(height/18000);
 const zenith=[45-15*high,109-25*high,177-20*high],mist=[184,205,217],out=zenith.map((c,i)=>c*(1-horizon)+mist[i]*horizon);
 // Fixed daytime sun in world coordinates; camera roll/look cannot move it.
 const sunDot=clamp(n*(-.45)+e*.682-d*.577),glow=Math.pow(sunDot,48)*.28+Math.pow(sunDot,700)*.45;
 for(let i=0;i<3;i++)out[i]+=(255-out[i])*glow;
 if(sunDot>.99996)return [255,252,234];
 // Directional high-cloud layer: continuous world-space noise, slow sim-time drift.
 if(d<-.025){const u=n/(-d+.18)*1.8+time*.0007,v=e/(-d+.18)*1.8;
  const broad=noise(u,v)*.58+noise(u*2.1+11,v*2.1)*.28+noise(u*4.3,v*4.3+17)*.14;
  const cloud=clamp((broad-.49)*5)*clamp(elevation*7)*.72;
  const shade=225+25*noise(u*.8+20,v*.8);for(let i=0;i<3;i++)out[i]=out[i]*(1-cloud)+(shade+(i===2?3:0))*cloud;
 }
 return out;
}
export class Sky{
 draw(g,W,H,camera,time){const width=Math.min(420,Math.ceil(W)),height=Math.max(1,Math.round(H*width/W));this.canvas??=new OffscreenCanvas(width,height);if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;this.frame=null;}const ctx=this.canvas.getContext('2d');this.frame??=ctx.createImageData(width,height);const out=this.frame.data,ratio=W/width,altitude=Math.max(0,-camera.eye[2]-ORIGIN.elevation);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const horizontal=((x+.5)*ratio-W/2)/camera.focal,vertical=(camera.centerY-(y+.5)*ratio)/camera.focal,ray=camera.forward.map((v,i)=>v+horizontal*camera.right[i]+vertical*camera.up[i]),color=skyColor(ray,altitude,time);const index=(y*width+x)*4;for(let i=0;i<3;i++)out[index+i]=color[i];out[index+3]=255;}
 ctx.putImageData(this.frame,0,0);g.drawImage(this.canvas,0,0,W,H);
 }
}
