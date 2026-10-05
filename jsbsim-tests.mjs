import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import factory from './dist/vendor/jsbsim/wasm/jsbsim_wasm.mjs';import {JSBSimFlight} from './dist/jsbsim-flight.mjs';import {rotate} from './dist/physics.mjs';import {localToGeo} from './dist/imagery.mjs';
import {F15Augmentation,pitchCasBounds} from './dist/f15-controls.mjs';
const wasm=await readFile(new URL('./dist/vendor/jsbsim/wasm/jsbsim_wasm.wasm',import.meta.url));
const engine=await JSBSimFlight.create({moduleFactory:options=>factory({...options,wasmBinary:wasm}),readData:path=>readFile(new URL('./dist/vendor/jsbsim/data/'+path,import.meta.url))});
const run=seconds=>{for(let i=0;i<240*seconds;i++)engine.step();return engine.snapshot();};
test('real JSBSim WASM trims all nine starting conditions and holds cruise for 60 seconds',async()=>{
  for(const altitude of [900,1219.2,2438.4])for(const speed of [45,52,60]){
    await engine.reset(speed,altitude);engine.setControls(engine.trim);const initial=engine.snapshot(),final=run(60);
    assert.equal(initial.engine,'JSBSim 1.2.4');assert.ok(Math.abs(initial.flight.weight/4.4482216152605-2550)<.01);
    assert.ok(Math.abs(final.state[2]+altitude)<1);assert.ok(Math.abs(final.flight.V-speed)<.1);assert.ok(Math.abs(final.attitude.roll)<.005);
    assert.ok(final.flight.weight<initial.flight.weight,'fuel consumption changes aircraft mass');
    assert.ok(Math.abs(final.elapsed-60)<1e-8);assert.ok(Math.abs(final.flight.drag-final.flight.profileDrag-final.flight.inducedDrag)<1e-9);
  }
});
test('cockpit quaternion, geographical position and units agree with engine output',async()=>{
  await engine.reset();engine.setControls(engine.trim);const s=run(10),q=s.state.slice(6,10),ned=rotate(q,s.state.slice(3,6)),geo=localToGeo(s.state[0],s.state[1]);
  assert.ok(Math.abs(Math.hypot(...q)-1)<1e-12);for(let i=0;i<3;i++)assert.ok(Math.abs(ned[i]-s.velocity[i])<.01);
  assert.ok(Math.abs(geo.latitude-s.geo.latitude)<1e-9);assert.ok(Math.abs(geo.longitude-s.geo.longitude)<1e-9);
  assert.ok(s.flight.rho>.9&&s.flight.rho<1.3);assert.ok(s.flight.dynamicPressure>1000&&s.flight.dynamicPressure<2000);assert.ok(s.flight.CAS<s.flight.V);
});
test('existing pitch, roll and rudder control directions stay correct',async()=>{
  for(const [axis,delta,rate,sign] of [['elevator',.12,11,-1],['aileron',.16,10,1],['rudder',.18,12,-1]]){
    await engine.reset();engine.setControls({...engine.trim,[axis]:engine.trim[axis]+delta});const s=run(.5);
    assert.ok(s.state[rate]*sign>.02,`${axis} response ${s.state[rate]}`);
  }
});
test('throttle changes actual engine thrust and east wind produces sideslip',async()=>{
  await engine.reset();engine.setControls({...engine.trim,throttle:1});const high=run(2);
  await engine.reset();engine.setControls({...engine.trim,throttle:.2});const low=run(2);assert.ok(high.flight.thrust>low.flight.thrust+300);assert.ok(high.flight.shaftPower>low.flight.shaftPower);
  await engine.reset();engine.setControls(engine.trim);engine.setWind(10);const cross=run(.5);assert.ok(Math.abs(cross.flight.beta)>.05);assert.equal(engine.get('atmosphere/wind-east-fps')*.3048,10);
  engine.setWind(0);
});
test('reset returns to initial time, location, fuel and trimmed controls',async()=>{
  await engine.reset();const first=engine.snapshot();engine.setControls({...engine.trim,elevator:-.15});run(5);await engine.reset();const reset=engine.snapshot();
  assert.equal(reset.elapsed,0);assert.ok(Math.abs(reset.state[0])<1e-6&&Math.abs(reset.state[1])<1e-6);assert.equal(reset.flight.weight,first.flight.weight);assert.deepEqual(reset.trim,first.trim);
});
test.after(()=>engine.destroy());
test('F-15 trims nine presets with two engines and returns to the C172',async()=>{
  for(const altitude of [1500,3000,6000])for(const speed of [150,180,220]){
    await engine.reset(speed,altitude,'f15');engine.setControls(engine.trim);const start=engine.snapshot(),s=run(60);
    assert.equal(s.aircraft.key,'f15');assert.ok(Math.abs(-s.state[2]-altitude)<25);assert.ok(Math.abs(s.flight.V-speed)<1);assert.ok(Math.abs(s.attitude.roll)<.01);
    assert.ok(start.flight.thrust>20000);assert.ok(engine.get('propulsion/engine[1]/thrust-lbs')>1000);assert.ok(s.flight.weight<start.flight.weight);
    assert.equal(s.flight.shaftPower,0);assert.ok(s.flight.enginePercent>40&&s.flight.enginePercent<=100);assert.ok(s.flight.area>56&&s.flight.area<57);
  }
  await engine.reset(52,900,'c172');assert.equal(engine.snapshot().aircraft.key,'c172');assert.ok(Math.abs(engine.snapshot().flight.weight/4.4482216152605-2550)<.01);
});
test('F-15 control surfaces respond and afterburner drives both engines',async()=>{
  for(const [axis,rate,sign] of [['elevator',11,-1],['aileron',10,1],['rudder',12,-1]]){await engine.reset(180,3000,'f15');engine.setControls({...engine.trim,[axis]:engine.trim[axis]+.12});const s=run(1);assert.ok(s.state[rate]*sign>.015,axis);}
  await engine.reset(180,3000,'f15');engine.setControls({...engine.trim,throttle:1});const military=run(10);
  await engine.reset(180,3000,'f15');engine.setControls({...engine.trim,throttle:2});const ab=run(10);
  assert.ok(ab.flight.thrust>military.flight.thrust+20000);assert.ok(ab.flight.V>military.flight.V);assert.equal(ab.flight.afterburner,true);
  assert.ok(Math.abs(ab.flight.thrust-(engine.get('propulsion/engine/thrust-lbs')+engine.get('propulsion/engine[1]/thrust-lbs'))*4.4482216152605)<1e-6);
});
test('generic 737 pairs with the cockpit and trims all nine cruise presets',async()=>{
  for(const altitude of [3000,6000,9000])for(const speed of [180,200,220]){
    await engine.reset(speed,altitude,'b737');engine.setControls(engine.trim);const first=engine.snapshot(),s=run(60);
    assert.equal(s.aircraft.key,'b737');assert.equal(s.flight.engines.length,2);for(const e of s.flight.engines){assert.ok(e.n1>0&&e.n2>0);assert.ok(e.fuelFlow>0);}assert.ok(s.flight.fuelKg>0&&s.flight.fuelKg<first.flight.fuelKg);assert.ok(s.aircraft.cockpitAsset.endsWith('.glb'));assert.ok(Math.abs(-s.state[2]-altitude)<25);assert.ok(Math.abs(s.flight.V-speed)<1);
    assert.ok(s.flight.weight<first.flight.weight);assert.ok(engine.get('propulsion/engine[1]/thrust-lbs')>1000);assert.equal(s.flight.afterburner,false);assert.ok(s.flight.area>108&&s.flight.area<110);
  }
  engine.setControls({...engine.trim,throttle:2});run(.1);assert.equal(engine.get('fcs/throttle-cmd-norm'),1);assert.equal(engine.get('fcs/throttle-cmd-norm[1]'),1);
  assert.equal(engine.snapshot().flight.afterburner,false);await engine.reset();assert.equal(engine.snapshot().aircraft.key,'c172');
});
test('native Dryden turbulence drives all aircraft and switches off without changing crosswind',async()=>{
 for(const [model,speed,altitude]of [['c172',52,900],['f15',180,3000],['b737',220,6000]]){
  engine.setTurbulence('off');await engine.reset(speed,altitude,model);engine.setControls(engine.trim);engine.setWind(3);engine.setTurbulence('moderate');engine.set('atmosphere/randomseed',1234);
  let gustEnergy=0,maxLoadChange=0;const initial=engine.snapshot().flight.load;
  for(let i=0;i<2400;i++){engine.step();if(i%24===0){const s=engine.snapshot();gustEnergy+=s.weather.gust.reduce((n,v)=>n+v*v,0);maxLoadChange=Math.max(maxLoadChange,Math.abs(s.flight.load-initial));}}
  assert.ok(gustEnergy>1,model);assert.ok(maxLoadChange>.001,model);assert.equal(engine.snapshot().weather.turbulence,'moderate');assert.ok(Math.abs(engine.get('atmosphere/wind-east-fps')*.3048-3)<1e-10);
  await engine.reset(speed,altitude,model);assert.equal(engine.snapshot().weather.turbulence,'moderate');assert.equal(engine.get('atmosphere/turbulence/milspec/severity'),4);
  engine.setTurbulence('off');run(.1);assert.deepEqual(engine.snapshot().weather.gust,[0,0,0]);assert.equal(engine.get('atmosphere/turbulence/milspec/severity'),0);
 }
 engine.setWind(0);await engine.reset();
});
test('severe Dryden preset produces more gust energy than light with the same random seed',async()=>{
 const energy=[];
 for(const level of ['light','severe']){engine.setTurbulence('off');await engine.reset();engine.setControls(engine.trim);engine.setTurbulence(level);engine.set('atmosphere/randomseed',321);let e=0;for(let i=0;i<4800;i++){engine.step();if(i%24===0)e+=engine.snapshot().weather.gust.reduce((n,v)=>n+v*v,0);}energy.push(e);}
 assert.ok(energy[1]>energy[0]*2);engine.setTurbulence('off');await engine.reset();
});
test('full-travel F-15 keyboard input increases physical roll and pitch response',async()=>{
 const {PilotControls}=await import('./dist/pilot-controls.mjs');
 for(const [key,axis,rate,sign,oldAmount]of [['ArrowRight','aileron',10,1,.16],['ArrowDown','elevator',11,1,-.12]]){
  const response=[];
  for(const improved of [false,true]){await engine.reset(180,3000,'f15');engine.setControls(engine.trim);const pilot=new PilotControls();
   for(let frame=0;frame<45;frame++){const d=engine.snapshot();d.paused=false;engine.setControls(improved?pilot.sample(d,new Set([key]),1/60,0,d.trim.throttle):{...d.trim,[axis]:d.trim[axis]+oldAmount});for(let i=0;i<4;i++)engine.step();}
   const s=engine.snapshot();response.push(s.state[rate]*sign);assert.ok(s.flight.V>100&&s.flight.V<300);assert.ok(s.state.every(Number.isFinite));
  }
  assert.ok(response[1]>response[0]*1.5,`${axis}: old ${response[0]}, new ${response[1]}`);
 }
 await engine.reset();
});
test('F-15 augmentation holds cruise, damps released roll and schedules surface travel across presets',async()=>{
 const rollCommands=[];
 for(const altitude of [1500,3000,6000])for(const speed of [150,180,220]){
  await engine.reset(speed,altitude,'f15');engine.setAugmentationEnabled(true);const neutral={elevator:0,aileron:0,rudder:0,trimOffset:0};engine.setControls({...engine.trim,pilot:neutral});let s=run(10);
  assert.ok(Math.abs(s.flight.load-1)<.1);assert.ok(Math.abs(s.attitude.roll)<.01);assert.ok(Math.abs(-s.state[2]-altitude)<20);
  engine.setControls({...engine.trim,pilot:{...neutral,aileron:.6}});s=run(2);const p=s.state[10];assert.ok(p>.25);assert.ok(s.augmentation.enabled);assert.ok(Math.abs(s.augmentation.aileron)<=1);
  if(altitude===3000)rollCommands.push(s.augmentation.aileron);
  engine.setControls({...engine.trim,pilot:neutral});s=run(2);assert.ok(Math.abs(s.state[10])<Math.abs(p)*.15);assert.ok(Math.abs(s.attitude.roll)>.3);
 }
 assert.ok(rollCommands[0]>rollCommands[2]);
 await engine.reset(180,3000,'f15');engine.setControls({...engine.trim,pilot:{elevator:-.3,aileron:0,rudder:0,trimOffset:0}});const pull=run(2);assert.ok(pull.flight.load>1.5&&pull.flight.load<8.5);assert.ok(pull.state[11]>0);
 engine.setControls({...engine.trim,pilot:{elevator:0,aileron:0,rudder:0,trimOffset:0}});const released=run(3);assert.ok(Math.abs(released.state[11])<Math.abs(pull.state[11]));
 engine.setAugmentationEnabled(false);assert.equal(run(.1).augmentation,null);engine.setAugmentationEnabled(true);await engine.reset();assert.equal(engine.snapshot().augmentation,null);
});

test('F-15 roll tuning gives fast response and controlled release at all nine cruise presets',async()=>{
 for(const altitude of [1500,3000,6000])for(const speed of [150,180,220]){
  await engine.reset(speed,altitude,'f15');engine.setAugmentationEnabled(true);const pilot={elevator:0,aileron:1,rudder:0,trimOffset:0};engine.setControls({...engine.trim,pilot});const roll=run(1);assert.ok(roll.state[10]>Math.PI/2&&roll.state[10]<4,`${speed}/${altitude}: ${roll.state[10]}`);
  engine.setControls({...engine.trim,pilot:{...pilot,aileron:0}});const released=run(1);assert.ok(Math.abs(released.state[10])<.09);assert.ok(released.state.every(Number.isFinite));
 }
 await engine.reset();
});

test('F-15 separates limited CAS authority from pilot input and washes out sustained pitch rate',()=>{
 const trim={elevator:0,aileron:0,rudder:0},pilot={elevator:0,aileron:0,rudder:0},state={qbar:14000,speed:180,alpha:.05,beta:0,load:1,p:0,q:0,r:0};
 assert.deepEqual(pitchCasBounds(0),[-10,10]);
 assert.ok(pitchCasBounds(10)[1]<pitchCasBounds(5)[1]);assert.ok(Math.abs(pitchCasBounds(-23)[0])<Math.abs(pitchCasBounds(-19)[0]));
 for(const elevator of [-1,0,1])for(const load of [-4,1,12])for(const rate of [-2,2]){
  const controller=new F15Augmentation();let c;
  for(let i=0;i<240;i++)c=controller.update({...state,load,q:rate,r:rate,beta:rate},{...pilot,elevator,rudder:1},trim,1/240);
  assert.ok(Math.abs(c.yawCasDeg)<=5);assert.ok(Math.abs(c.pitchCasDeg)<=10);assert.ok(c.pitchCasDeg>=c.pitchCasMinDeg&&c.pitchCasDeg<=c.pitchCasMaxDeg);
  assert.ok(c.mechanicalPitchDeg+c.pitchCasDeg>=-26-1e-9&&c.mechanicalPitchDeg+c.pitchCasDeg<=15+1e-9);
 }
 const controller=new F15Augmentation(),initial=controller.update({...state,q:.1},pilot,trim,1/240);
 let settled;for(let i=0;i<4800;i++)settled=controller.update({...state,q:.1},pilot,trim,1/240);
 assert.ok(Math.abs(settled.pitchCasDeg)<Math.abs(initial.pitchCasDeg)*.01);
 const rudderA=new F15Augmentation().update(state,{...pilot,rudder:1},trim,1/240).rudder;
 const rudderB=new F15Augmentation().update({...state,qbar:6000},{...pilot,rudder:1},trim,1/240).rudder;
 assert.equal(rudderA,rudderB,'pilot rudder is independent of CAS pressure gain');
});

test('native ground suspension supports parked aircraft, taxi power and wheel braking',async()=>{
 for(const key of ['c172','f15','b737']){
  await engine.reset(0,0,key,'ground');engine.setControls({...engine.trim,throttle:0});let s=run(10);
  assert.ok(s.systems.onGround);assert.ok(s.systems.groundSpeed<.01);assert.ok(s.systems.agl>.5&&s.systems.agl<3);
  engine.setSystems({gear:0});assert.equal(engine.systems.gear,1,'gear retraction is inhibited on wheels');
  engine.setSystems({parking:false});engine.setControls({...engine.trim,throttle:key==='f15'?.13:.4});s=run(15);const taxiSpeed=s.systems.groundSpeed;assert.ok(taxiSpeed>1&&taxiSpeed<15);
  engine.setControls({...engine.trim,throttle:0});engine.setSystems({brake:1});s=run(10);assert.ok(s.systems.onGround);assert.ok(s.systems.groundSpeed<taxiSpeed*.05);assert.ok(s.state.every(Number.isFinite));
 }
});
test('gear-down low approaches contact the ground and continue rolling without freezing',async()=>{
 for(const key of ['c172','f15','b737']){
  await engine.reset(0,0,key,'approach');assert.ok(!engine.snapshot().systems.onGround);engine.setControls({...engine.trim,throttle:0});let touched=false;
  for(let i=0;i<240*60;i++){engine.step();touched||=Boolean(engine.get('gear/wow'));assert.ok(engine.get('position/h-agl-ft')*.3048>.15);}
  const s=engine.snapshot();assert.ok(touched,key);assert.ok(s.systems.onGround,key);assert.ok(s.elapsed>59);assert.ok(s.systems.groundSpeed>1);assert.ok(s.state.every(Number.isFinite));
 }
});
test('flap deployment changes lift/drag and retractable gear takes time to extend',async()=>{
 for(const key of ['c172','b737']){
  await engine.reset(undefined,undefined,key);const before=engine.snapshot();engine.setSystems({flap:key==='c172'?3:8,gear:1});const after=run(.5);
  assert.ok(after.systems.flapPosition>0&&after.systems.flapPosition<1);assert.ok(after.flight.CL>before.flight.CL);assert.ok(after.flight.CD>before.flight.CD);
  if(key==='b737')assert.ok(after.systems.gearPosition>0&&after.systems.gearPosition<1);
 }
 await engine.reset(0,0,'f15','ground');engine.setSystems({flap:8});assert.equal(run(1).systems.flapPosition,0);
 await engine.reset();
});
