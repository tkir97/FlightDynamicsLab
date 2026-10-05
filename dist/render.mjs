import {drawAircraftForces} from './ai-aircraft.mjs';
import {drawMissiles} from './missiles.mjs';
import {Sky} from './sky.mjs';
import {ModelCockpit} from './model-cockpit.mjs';
import {rotate,cross} from './physics.mjs';
import {Cockpit,cameraBasis} from './cockpit.mjs';
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),norm=a=>{let n=Math.hypot(...a);return a.map(v=>v/n);};
export class View{constructor(canvas,satellite=null){this.satellite=satellite;this.canvas=canvas;this.ctx=canvas.getContext('2d');this.mode='cockpit';this.lookYaw=0;this.lookPitch=0;this.zoom=1;this.cockpit=new Cockpit();this.sky=new Sky();}recenter(){this.lookYaw=0;this.lookPitch=0;this.zoom=1;}draw(data){const c=this.canvas,g=this.ctx,rect=c.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,2);if(c.width!==Math.round(rect.width*dpr)||c.height!==Math.round(rect.height*dpr)){c.width=Math.round(rect.width*dpr);c.height=Math.round(rect.height*dpr);}g.setTransform(dpr,0,0,dpr,0,0);const W=rect.width,H=rect.height,s=data.state,pos=s.slice(0,3),q=s.slice(6,10),heading=[Math.cos(data.attitude.yaw),Math.sin(data.attitude.yaw),0];let eye,f,r,up;if(this.mode==='chase'){eye=pos.map((v,i)=>v-heading[i]*(data.aircraft?.key==='b737'?120:data.aircraft?.kind==='jet'?65:38)+(i===2?(data.aircraft?.key==='b737'?-40:data.aircraft?.kind==='jet'?-22:-11):0));const target=pos.map((v,i)=>v+heading[i]*90+(i===2?-3:0));f=norm(sub(target,eye));r=norm(cross(f,[0,0,-1]));up=cross(r,f);}else{const offset=rotate(q,[-.35,-.27,-.25]);eye=pos.map((v,i)=>v+offset[i]);const basis=cameraBasis(q,rotate,this.lookYaw,this.lookPitch+(data.aircraft?.cockpitPitch??0));f=basis.forward;r=basis.right;up=basis.up;}const focal=W*(this.mode==='chase'?.82:.52*this.zoom),centerY=H*(this.mode==='chase'?(data.aircraft?.kind==='jet'?.39:.49):.32),near=this.mode==='chase'?.5:.04;const toCamera=p=>{const v=sub(p,eye);return [dot(v,r),dot(v,up),dot(v,f)];},screen=v=>[W/2+v[0]*focal/v[2],centerY-v[1]*focal/v[2],v[2]],project=p=>{const v=toCamera(p);return v[2]<near?null:screen(v);},bodyToCamera=p=>{const world=rotate(q,p).map((v,i)=>v+pos[i]);return toCamera(world);};
this.sky.draw(g,W,H,{eye,right:r,up,forward:f,focal,centerY},data.elapsed);
if(this.satellite){this.satellite.renderTerrain(g,pos[0],pos[1],toCamera,screen,W,H,{eye,right:r,up,forward:f,focal,centerY},data.velocity);}else{
// Deterministic ground tiles. Floating camera projection keeps large coordinates local.
const polys=[],tile=500,centerN=Math.floor(pos[0]/tile),centerE=Math.floor(pos[1]/tile),palette=['#7e9477','#879a7b','#93a380','#8ea079','#9cab89','#7b967d'];function add(points,color){const projected=points.map(project);if(projected.some(p=>!p))return;const depth=projected.reduce((a,p)=>a+p[2],0)/projected.length;polys.push({points:projected,color,depth});}
for(let i=centerN-18;i<centerN+19;i++)for(let j=centerE-18;j<centerE+19;j++){let n=i*tile,e=j*tile;const hash=Math.abs(((i*73856093)^(j*19349663))%palette.length);add([[n,e,0],[n+tile,e,0],[n+tile,e+tile,0],[n,e+tile,0]],palette[hash]);if(hash===2)add([[n+20,e+10,-.15],[n+tile-20,e+10,-.15],[n+tile-20,e+20,-.15],[n+20,e+20,-.15]],'#b5b699');}
// Runway and centerline: a navigation reference, not a contact model.
for(let n=-500;n<2500;n+=100){add([[n,275,-.3],[n+100,275,-.3],[n+100,325,-.3],[n,325,-.3]],'#465158');add([[n+20,298,-.5],[n+70,298,-.5],[n+70,302,-.5],[n+20,302,-.5]],'#e7e6d5');}
for(let n=centerN*tile-8000;n<centerN*tile+8000;n+=400){const bend=1300+500*Math.sin(n/2500);add([[n,bend,-.2],[n+400,1300+500*Math.sin((n+400)/2500),-.2],[n+400,1450+500*Math.sin((n+400)/2500),-.2],[n,bend+150,-.2]],'#658fa0');}
polys.sort((a,b)=>b.depth-a.depth);for(const p of polys){g.beginPath();p.points.forEach((v,i)=>i?g.lineTo(v[0],v[1]):g.moveTo(v[0],v[1]));g.closePath();g.fillStyle=p.color;g.fill();}
}

drawAircraftForces(g,data.forces,project,pos);
drawMissiles(g,data.weapons,project);
if(this.mode==='chase'){const aircraft=[],body=p=>{const v=rotate(q,p);return v.map((x,i)=>x+pos[i]);};const face=(pts,color)=>{const pp=pts.map(p=>project(body(p)));if(pp.some(p=>!p))return;aircraft.push({pp,color,z:pp.reduce((a,p)=>a+p[2],0)/pp.length});};
if(data.aircraft?.key==='b737'){
// Exterior is a simple reference mesh; the supplied GLB contains only the interior.
face([[19,0,0],[13,-1.8,-.9],[-17,-1.7,-.8],[-20,0,0],[-17,1.7,-.8],[13,1.8,-.9]],'#dce3e7');
face([[19,0,0],[13,1.8,-.9],[10,0,-1.9],[13,-1.8,-.9]],'#b7c8d0');
for(const side of [-1,1]){face([[5,side*1,0],[-5,side*17,.8],[-9,side*17,.8],[-3,side*1,0]],'#bccbd3');face([[-12,side*1,0],[-16,side*7,.5],[-19,side*7,.5],[-17,side*1,0]],'#b8c9d2');face([[2,side*4,1],[2,side*6,1],[-4,side*6,2.5],[-4,side*4,2.5]],'#788e9a');}
face([[-10,0,-.8],[-16,0,-7],[-18,0,-7],[-20,0,-.5]],'#3c6d91');
}else if(data.aircraft?.key==='f15'){
// Simplified Eagle silhouette: pointed nose, swept wings, twin engines/fins.
face([[8.5,0,0],[3.5,-.85,-.3],[-8.5,-1.2,-.2],[-10,0,.25],[-8.5,1.2,-.2],[3.5,.85,-.3]],'#89999f');
face([[8.5,0,0],[3.5,.85,-.3],[2,0,-1.1],[3.5,-.85,-.3]],'#c5d0d1');
face([[3.5,-.4,-.4],[3.5,.4,-.4],[1.1,.55,-1],[1.1,-.55,-1]],'#294854');
for(const sign of [-1,1]){
face([[2,sign*.7,0],[-3.2,sign*6.5,.25],[-6.8,sign*6.5,.25],[-5.6,sign*1,0]],'#b6c3c6');
face([[-5.9,sign*1.1,0],[-8.2,sign*3.6,.1],[-10,sign*3.6,.1],[-9.7,sign*.9,0]],'#a5b6bc');
face([[-5.5,sign*1.25,-.15],[-7.8,sign*1.55,-3],[-9.3,sign*1.55,-3],[-9.8,sign*1.25,-.15]],'#b0c1c7');
face([[.8,sign*.7,.1],[.8,sign*1.8,.2],[-9.8,sign*1.5,.65],[-9.8,sign*.5,.65]],'#657983');
face([[-9.8,sign*.5,.05],[-9.8,sign*1.5,.05],[-9.8,sign*1.5,.7],[-9.8,sign*.5,.7]],data.flight.afterburner?'#ffb565':'#273843');
}
}else{
face([[2.8,-.45,0],[2.8,.45,0],[-5.2,.15,0],[-5.2,-.15,0]],'#e9eef0');face([[2.8,-.45,0],[-5.2,-.15,0],[-5.2,0,.15],[2.5,0,.5]],'#a7bbc6');face([[2.8,.45,0],[-5.2,.15,0],[-5.2,0,.15],[2.5,0,.5]],'#9cabb2');face([[.7,-.45,-.35],[.7,.45,-.35],[-.7,.4,-.4],[-.7,-.4,-.4]],'#34596d');face([[.7,-.45,-.35],[-.7,-.4,-.4],[-.7,-.45,0],[1.1,-.45,0]],'#41647a');face([[.7,.45,-.35],[-.7,.4,-.4],[-.7,.45,0],[1.1,.45,0]],'#41647a');face([[.6,-5.5,-1.04],[.6,5.5,-1.04],[-.8,5.5,-1.04],[-.8,-5.5,-1.04]],'#f0f3e8');face([[.6,-5.5,-1.04],[.6,-4.8,-1.04],[-.8,-4.8,-1.04],[-.8,-5.5,-1.04]],'#b0ed8c');face([[.6,5.5,-1.04],[.6,4.8,-1.04],[-.8,4.8,-1.04],[-.8,5.5,-1.04]],'#b0ed8c');face([[-4.3,-1.675,0],[-4.3,1.675,0],[-5.4,1.675,0],[-5.4,-1.675,0]],'#d5e0dd');face([[-4,0,0],[-5.48,0,0],[-5.2,0,-1.7]],'#dce7dd');}
const gear=data.systems?.gearPosition??0;if(gear>.02){const jet=data.aircraft?.kind==='jet',airliner=data.aircraft?.key==='b737',height=(airliner?1.1:jet?2.15:1.34)*gear,radius=airliner?.28:jet?.22:.14,points=airliner?[[12.2,0],[-.23,-2.54],[-.23,2.54]]:jet?[[3.98,0],[-1.25,-1.37],[-1.25,1.37]]:[[1.16,0],[-.49,-1.09],[-.49,1.09]];for(const [x,y]of points){face([[x-.04,y,0],[x+.04,y,0],[x+.04,y,height-radius],[x-.04,y,height-radius]],'#b5c3ca');const tire=Array.from({length:12},(_,i)=>[x+radius*Math.cos(i*Math.PI/6),y,height-radius+radius*Math.sin(i*Math.PI/6)]);face(tire,'#17232b');}}
aircraft.sort((a,b)=>b.z-a.z);for(const p of aircraft){g.beginPath();p.pp.forEach((v,i)=>i?g.lineTo(v[0],v[1]):g.moveTo(v[0],v[1]));g.closePath();g.fillStyle=p.color;g.fill();g.strokeStyle='#28485980';g.lineWidth=.7;g.stroke();}const hub=data.aircraft?.kind==='jet'?null:project(body([2.9,0,0]));if(hub){g.save();g.translate(hub[0],hub[1]);g.rotate(performance.now()*.025);g.strokeStyle='#dbe8eaa0';g.lineWidth=2;g.beginPath();g.moveTo(-8,0);g.lineTo(8,0);g.stroke();g.restore();}}else{if(data.aircraft?.cockpitAsset){this.modelCockpits??=new Map();if(!this.modelCockpits.has(data.aircraft.key))this.modelCockpits.set(data.aircraft.key,new ModelCockpit(data.aircraft.key));this.modelCockpit=this.modelCockpits.get(data.aircraft.key);if(!this.modelCockpit.draw(g,W,H,this.lookYaw,this.lookPitch+(data.aircraft.cockpitPitch??0),this.zoom,data))this.cockpit.render(g,data,bodyToCamera,screen,performance.now());}else this.cockpit.render(g,data,bodyToCamera,screen,performance.now());}
}}
export function drawAttitude(canvas,attitude){const g=canvas.getContext('2d'),W=canvas.width,H=canvas.height;g.clearRect(0,0,W,H);g.save();g.beginPath();g.roundRect(0,0,W,H,8);g.clip();g.translate(W/2,H/2);g.rotate(-attitude.roll);const p=attitude.pitch*180/Math.PI*2;g.translate(0,p);g.fillStyle='#365f7d';g.fillRect(-400,-500,800,500);g.fillStyle='#665541';g.fillRect(-400,0,800,500);g.strokeStyle='#d3e4df';g.lineWidth=2;g.beginPath();g.moveTo(-400,0);g.lineTo(400,0);g.stroke();g.font='14px monospace';g.textAlign='center';for(let a=-30;a<=30;a+=10)if(a){let y=-a*2;g.beginPath();g.moveTo(-25,y);g.lineTo(25,y);g.stroke();g.fillStyle='#d3e4df';g.fillText(Math.abs(a),-43,y+4);}g.restore();g.strokeStyle='#b0ed8c';g.lineWidth=3;g.beginPath();g.moveTo(W/2-50,H/2);g.lineTo(W/2-15,H/2);g.lineTo(W/2,H/2+7);g.lineTo(W/2+15,H/2);g.lineTo(W/2+50,H/2);g.stroke();}
