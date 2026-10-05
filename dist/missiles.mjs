import {rotate} from './physics.mjs';
// Fictional game projectiles: no real weapon performance or guidance model. Homing is a game approximation.
export class MissileSystem {
 constructor(){this.reset('c172');}
 reset(aircraft){this.enabled=aircraft==='f15';this.remaining=this.enabled?8:0;this.cooldown=0;this.projectiles=[];this.effects=[];this.serial=0;}
 fire(data){if(!this.enabled||!this.remaining||this.cooldown>0||data.paused||data.crashed||data.systems?.onGround)return false;
  const q=data.state.slice(6,10),side=this.remaining%2===0?-1:1,offset=rotate(q,[1,side*2.8,1]),direction=rotate(q,[1,0,0]);
  const position=data.state.slice(0,3).map((v,i)=>v+offset[i]),velocity=(data.velocity??rotate(q,data.state.slice(3,6))).map((v,i)=>v+direction[i]*35);
  this.projectiles.push({id:++this.serial,position,velocity,direction,targetId:data.forces?.lock?data.forces.selected:null,age:0,trail:[position.slice()],trailClock:0});this.remaining--;this.cooldown=.6;return true;
 }
 step(dt,groundElevation,targets=[],onHit=()=>{}){this.cooldown=Math.max(0,this.cooldown-dt);this.effects=this.effects.filter(e=>(e.age+=dt)<.8);
  this.projectiles=this.projectiles.filter(m=>{m.age+=dt;const powered=m.age<2;const before=m.position.slice(),target=targets.find(t=>t.alive&&t.id===m.targetId);if(target){const delta=target.position.map((v,i)=>v-m.position[i]),length=Math.hypot(...delta);if(length>0){const speed=Math.hypot(...m.velocity),blend=1-Math.exp(-dt*2);m.direction=m.direction.map((v,i)=>v*(1-blend)+delta[i]/length*blend);const n=Math.hypot(...m.direction);m.direction=m.direction.map(v=>v/n);m.velocity=m.direction.map(v=>v*speed);}} 
   for(let i=0;i<3;i++){m.velocity[i]+=(powered?m.direction[i]*110:0)*dt;m.velocity[i]*=Math.exp(-.025*dt);m.position[i]+=m.velocity[i]*dt;}m.velocity[2]+=9.81*dt;
   m.trailClock+=dt;if(m.trailClock>=.05){m.trailClock=0;m.trail.push(m.position.slice());if(m.trail.length>45)m.trail.shift();}
   for(const t of targets){if(!t.alive||t.team!=='opposing')continue;const segment=m.position.map((v,i)=>v-before[i]),den=segment.reduce((s,v)=>s+v*v,0),fraction=den?Math.max(0,Math.min(1,t.position.reduce((s,v,i)=>s+(v-before[i])*segment[i],0)/den)):0;const distance=Math.hypot(...t.position.map((v,i)=>v-before[i]-segment[i]*fraction));if(distance<35){t.alive=false;this.effects.push({position:t.position.slice(),age:0});onHit(t);return false;}}
   if(m.position[2]>=-groundElevation){this.effects.push({position:[m.position[0],m.position[1],-groundElevation],age:0});return false;}return m.age<12;
  });
 }
 snapshot(){return {enabled:this.enabled,remaining:this.remaining,cooldown:this.cooldown,projectiles:this.projectiles.map(m=>({id:m.id,position:m.position.slice(),direction:m.direction.slice(),powered:m.age<2,trail:m.trail.map(p=>p.slice())})),effects:this.effects.map(e=>({position:e.position.slice(),age:e.age}))};}
}
export function drawMissiles(g,weapons,project){if(!weapons?.enabled)return;g.save();g.lineCap='round';
 for(const m of weapons.projectiles){g.strokeStyle='rgba(225,234,239,.55)';g.lineWidth=2;g.beginPath();let connected=false;for(const p of m.trail){const v=project(p);if(!v){connected=false;continue;}if(connected)g.lineTo(v[0],v[1]);else g.moveTo(v[0],v[1]);connected=true;}g.stroke();
  const tip=project(m.position),tail=project(m.position.map((v,i)=>v-m.direction[i]*3));if(tip&&tail){g.strokeStyle='#f2f5f6';g.lineWidth=3;g.beginPath();g.moveTo(tail[0],tail[1]);g.lineTo(tip[0],tip[1]);g.stroke();if(m.powered){g.fillStyle='#ffba64';g.beginPath();g.arc(tail[0],tail[1],Math.max(1.5,Math.min(5,300/tail[2])),0,Math.PI*2);g.fill();}}
 }
 for(const e of weapons.effects){const p=project(e.position);if(!p)continue;g.globalAlpha=1-e.age/.8;g.fillStyle='#ffba64';g.beginPath();g.arc(p[0],p[1],Math.max(2,Math.min(35,(5+e.age*25)*450/p[2])),0,Math.PI*2);g.fill();}g.restore();}
