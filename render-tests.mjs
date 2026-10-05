import {test} from 'node:test';import assert from 'node:assert/strict';import {cameraBasis,clipNear} from './dist/cockpit.mjs';import {rotate} from './dist/physics.mjs';
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
test('cockpit camera follows aircraft roll',()=>{const q=[Math.cos(Math.PI/8),Math.sin(Math.PI/8),0,0],b=cameraBasis(q,rotate);assert.ok(Math.abs(b.up[1]-Math.SQRT1_2)<1e-12);assert.ok(Math.abs(b.up[2]+Math.SQRT1_2)<1e-12);});
test('head look camera stays orthonormal over allowed angles',()=>{for(const yaw of [-1.15,0,1.15])for(const pitch of [-.55,0,.55]){const b=cameraBasis([1,0,0,0],rotate,yaw,pitch),axes=[b.forward,b.right,b.up];for(const axis of axes)assert.ok(Math.abs(dot(axis,axis)-1)<1e-12);for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)assert.ok(Math.abs(dot(axes[i],axes[j]))<1e-12);}});
test('near-plane clipping preserves partially visible cockpit surfaces',()=>{const p=clipNear([[-1,0,-1],[1,0,1],[1,1,1],[-1,1,-1]],.04);assert.equal(p.length,4);assert.ok(p.every(v=>v[2]>=.04-1e-12));assert.equal(clipNear([[0,0,-1],[1,0,-1],[1,1,-1]]).length,0);});
import {groundPoint,EARTH_RADIUS,horizonDistance} from './dist/terrain.mjs';
test('satellite ground mapping recovers straight runway points across cockpit views',()=>{
  for(const yaw of [-1.15,0,1.15])for(const pitch of [-.3,0,.3]){
    const basis=cameraBasis([1,0,0,0],rotate,yaw,pitch),c={...basis,eye:[0,0,-900],width:1200,focal:624,centerY:224};
    for(const north of [500,1000,2500,5000])for(const east of [-1500,0,1500]){
      const distance2=north*north+east*east,p=[north,east,-14.3+distance2/(EARTH_RADIUS+Math.sqrt(EARTH_RADIUS*EARTH_RADIUS-distance2))],v=p.map((n,i)=>n-c.eye[i]),z=dot(v,c.forward);if(z<2)continue;
      const x=c.width/2+c.focal*dot(v,c.right)/z,y=c.centerY-c.focal*dot(v,c.up)/z,result=groundPoint(x,y,c,-14.3);
      assert.ok(result);assert.ok(Math.abs(result[0]-north)<1e-7);assert.ok(Math.abs(result[1]-east)<1e-7);
    }
  }
});
test('satellite rays toward sky and beyond range stay transparent',()=>{const c={eye:[0,0,-900],width:1200,focal:624,centerY:224,forward:[1,0,0],right:[0,1,0],up:[0,0,-1]};assert.equal(groundPoint(600,100,c,-14.3),null);assert.equal(groundPoint(600,224,c,-14.3),null);});
import {cockpitPose} from './dist/model-cockpit.mjs';
test('uploaded cockpit view remains orthonormal and follows right/down head look',()=>{
  for(const yaw of [-1.15,0,1.15])for(const pitch of [-.39,.16,.71]){const p=cockpitPose(yaw,pitch);assert.ok(Math.abs(dot(p.forward,p.up))<1e-12);assert.ok(Math.abs(Math.hypot(...p.forward)-1)<1e-12);assert.ok(Math.abs(Math.hypot(...p.up)-1)<1e-12);}
  assert.ok(cockpitPose(.5,0).forward[0]<0);assert.ok(cockpitPose(0,.5).forward[1]<0);assert.deepEqual(cockpitPose(0,0).forward,[0,0,1].map((v,i)=>i<2?-v:v));
});

import {displayValues} from './dist/flight-displays.mjs';
test('cockpit displays convert live telemetry to knots, feet, heading and vertical speed',()=>{
 const d={attitude:{roll:Math.PI/6,pitch:-Math.PI/18,yaw:-Math.PI/2},flight:{CAS:100,mach:.5},state:[0,0,-1000],velocity:[100,0,-5]},v=displayValues(d);
 assert.ok(Math.abs(v.roll-30)<1e-10);assert.ok(Math.abs(v.pitch+10)<1e-10);assert.equal(v.heading,270);assert.ok(Math.abs(v.speed-194.3844)<1e-6);assert.ok(Math.abs(v.altitude-3280.84)<1e-6);assert.ok(Math.abs(v.vsi-984.252)<1e-6);
});

import {paintDisplay} from './dist/flight-displays.mjs';
test('all five cockpit screens paint live data without invalid labels',()=>{
 const labels=[],g=new Proxy({}, {get:(_,key)=>key==='fillText'?(t)=>labels.push(String(t)):()=>{},set:()=>true}),data={attitude:{roll:.3,pitch:.1,yaw:.7},flight:{CAS:140,mach:.6,engines:[{n1:85,n2:92,fuelFlow:.4},{n1:84,n2:91,fuelFlow:.41}],fuelKg:13000},state:[5000,6000,-6000],velocity:[100,50,-5]};
 for(const kind of ['pfd','nd','engine'])paintDisplay(g,kind,data);
 assert.ok(labels.includes('V/S 980'));assert.ok(labels.includes('FUEL 13000 KG'));assert.ok(labels.includes('OEDR'));assert.ok(!labels.some(t=>/NaN|undefined|Infinity/.test(t)));
});

import {PilotControls} from './dist/pilot-controls.mjs';import {MODELS} from './dist/models.mjs';
test('F-15 virtual stick reaches modeled full travel, reverses and centers smoothly',()=>{
 const pilot=new PilotControls(),data={aircraft:MODELS.f15,trim:{elevator:0,aileron:0,rudder:0},paused:false},keys=new Set(['ArrowDown','ArrowRight','a']);let c=pilot.sample(data,keys,.02,0,.8);
 assert.ok(c.aileron>0&&c.aileron<MODELS.f15.limits.aileron[1]);
 for(let i=0;i<10;i++)c=pilot.sample(data,keys,.02,0,.8);
 assert.equal(c.aileron,MODELS.f15.limits.aileron[1]);assert.equal(c.elevator,-MODELS.f15.limits.elevator[0]);assert.equal(c.rudder,MODELS.f15.limits.rudder[1]);
 c=pilot.sample(data,new Set(['ArrowLeft']),.02,0,.8);assert.ok(c.aileron>0);
 for(let i=0;i<20;i++)c=pilot.sample(data,new Set(['ArrowLeft']),.02,0,.8);assert.equal(c.aileron,-MODELS.f15.limits.aileron[0]);
 for(let i=0;i<8;i++)c=pilot.sample(data,new Set(),.02,0,.8);assert.equal(c.aileron,0);assert.equal(c.elevator,0);assert.equal(c.throttle,.8);
 data.aircraft=MODELS.c172;c=pilot.sample(data,keys,.02,0,.8);assert.equal(c.elevator,-.12);assert.equal(c.aileron,.16);assert.equal(c.rudder,.18);
});

import {skyColor} from './dist/sky.mjs';
test('terrain reaches beyond 30 km and stops at the curved Earth horizon',()=>{
 const c={eye:[0,0,-9014.3],width:1200,focal:624,centerY:224,forward:[1,0,0],right:[0,1,0],up:[0,0,-1]},north=200000,drop=north*north/(EARTH_RADIUS+Math.sqrt(EARTH_RADIUS*EARTH_RADIUS-north*north)),y=c.centerY+c.focal*(9000+drop)/north,p=groundPoint(600,y,c,-14.3);
 assert.ok(Math.abs(p[0]-north)<.01);assert.equal(groundPoint(600,c.centerY+1,c,-14.3),null);assert.ok(horizonDistance(9000)>330000);
});
test('sky has brighter horizon haze and stable finite world-direction colors',()=>{
 const horizon=skyColor([1,0,0]),zenith=skyColor([0,0,-1]);assert.ok(horizon[0]>zenith[0]);assert.deepEqual(skyColor([1,0,-.5],900,10),skyColor([2,0,-1],900,10));for(const ray of [[1,0,0],[0,0,-1],[-1,.5,.2]])assert.ok(skyColor(ray,12000,100).every(v=>Number.isFinite(v)&&v>=0&&v<=255));
});
import {F15Augmentation} from './dist/f15-controls.mjs';
test('augmentation reduces high-pressure travel, unloads excessive G/AoA and damps transient yaw',()=>{
 const base={qbar:14000,speed:180,alpha:.1,beta:0,load:1,p:0,q:0,r:0},trim={elevator:0,aileron:0,rudder:0},pilot={elevator:-.5,aileron:.3,rudder:0};
 const normal=new F15Augmentation().update(base,pilot,trim,1/240),fast=new F15Augmentation().update({...base,qbar:28000},pilot,trim,1/240);
 assert.ok(Math.abs(fast.aileron)<Math.abs(normal.aileron));assert.ok(Math.abs(fast.elevator)<Math.abs(normal.elevator));
 const limit=new F15Augmentation().update({...base,alpha:.5,load:10},pilot,trim,1/240);assert.ok(limit.elevator>normal.elevator);assert.ok(limit.gTarget<normal.gTarget);
 const yaw=new F15Augmentation().update({...base,r:.3},{...pilot,elevator:0,aileron:0},trim,1/240);assert.ok(yaw.rudder>0);
 const c=new F15Augmentation();let steady;for(let i=0;i<4800;i++)steady=c.update({...base,r:.1},{elevator:0,aileron:0,rudder:0},trim,1/240);assert.ok(Math.abs(steady.rudder)<.001);
});
test('F-15 uploaded cockpit viewpoint looks forward and stays orthonormal with head movement',async()=>{const {cockpitPose}=await import('./dist/model-cockpit.mjs');for(const yaw of [-.8,0,.8])for(const pitch of [-.3,0,.3]){const pose=cockpitPose(yaw,pitch,'f15');assert.ok(Math.abs(Math.hypot(...pose.forward)-1)<1e-10);assert.ok(Math.abs(Math.hypot(...pose.up)-1)<1e-10);assert.ok(Math.abs(pose.forward.reduce((s,v,i)=>s+v*pose.up[i],0))<1e-10);assert.ok(pose.forward[0]<0);assert.ok(pose.eye[0]> -5.4&&pose.eye[0]< -4.9);}});
