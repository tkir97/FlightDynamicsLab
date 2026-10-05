import {F15Radar} from './f15-radar.mjs';
const radar=new F15Radar();
import {AircraftForces} from './ai-aircraft.mjs';
const forces=new AircraftForces();let lastPlayer;
import {MissileSystem} from './missiles.mjs';
const missiles=new MissileSystem();
import {ORIGIN} from './imagery.mjs';
import {JSBSimFlight} from './jsbsim-flight.mjs';
const DT=1/240;let engine,ready=false,resetting=false,paused=true,last=performance.now(),acc=0,crashed=false,rows=[],recording=false,wind=0,turbulence='off',augmentationEnabled=true;
function snapshot(){lastPlayer=engine.snapshot();const sensor=radar.snapshot(lastPlayer,forces.units,forces.selected),traffic=forces.snapshot(lastPlayer);if(sensor.enabled)traffic.lock=traffic.lock&&sensor.tracking;return {...lastPlayer,paused,crashed,recording,weapons:missiles.snapshot(),forces:traffic,radar:sensor};}
function publish(){if(ready)postMessage({type:'state',...snapshot()});}
function fail(error){ready=false;paused=true;recording=false;acc=0;postMessage({type:'error',message:error instanceof Error?error.message:'The flight engine stopped. Reset to try again.'});}
onmessage=async({data:d})=>{try{
  if(d.type==='reset'&&!resetting){resetting=true;ready=false;paused=true;acc=0;recording=false;rows=[];if(!engine)engine=await JSBSimFlight.create();await engine.reset(d.speed,d.altitude,d.aircraft??'c172',d.start??'cruise');engine.setWind(wind);engine.setTurbulence(turbulence);engine.setAugmentationEnabled(augmentationEnabled);missiles.reset(d.aircraft??'c172');forces.reset(engine.snapshot());radar.reset(engine.snapshot(),forces.units);crashed=false;last=performance.now();ready=true;resetting=false;publish();return;}
  if(d.type==='wind'){wind=Number(d.value)||0;if(ready)engine.setWind(wind);}
  if(d.type==='turbulence'){if(!['off','light','moderate','severe'].includes(d.value))return;turbulence=d.value;if(ready)engine.setTurbulence(turbulence);}
  if(!ready)return;
  if(d.type==='augmentation'){augmentationEnabled=Boolean(d.value);engine.setAugmentationEnabled(augmentationEnabled);}
  if(d.type==='controls')engine.setControls(d.controls);
  if(d.type==='systems')engine.setSystems(d.systems);
  if(d.type==='fire')missiles.fire(snapshot());
  if(d.type==='target')forces.cycle();
  if(d.type==='radar')radar.configure(d.settings??{});
  if(d.type==='radarTarget'){const sensor=radar.snapshot(engine.snapshot(),forces.units,forces.selected);if(sensor.contacts.some(t=>t.id===d.id&&t.team==='opposing'))forces.selected=d.id;}
  if(d.type==='spawnAircraft')forces.spawn(engine.snapshot(),d.team==='friendly'?'friendly':'opposing');
  if(d.type==='clearAircraft'){forces.clear();radar.tracks.clear();}
  if(d.type==='aiMode'&&['patrol','intercept'].includes(d.value))forces.mode=d.value;
  if(d.type==='pause'&&!crashed)paused=Boolean(d.value);
  if(d.type==='record'){recording=Boolean(d.value);if(recording)rows=[];}
  if(d.type==='export')postMessage({type:'csv',csv:'time_s,north_m,east_m,altitude_m,airspeed_mps,alpha_rad,roll_rad,pitch_rad,yaw_rad,lift_N,drag_N,thrust_N,weight_N,other_drag_N,alpha_dependent_drag_N,dynamic_pressure_Pa,CL,CD,calibrated_airspeed_mps,shaft_power_W,latitude_deg,longitude_deg\n'+rows.join('\n')});
  publish();
}catch(error){resetting=false;fail(error);}};
let tick=0;setInterval(()=>{const now=performance.now(),delta=(now-last)/1000;last=now;if(!ready||resetting)return;try{
  if(!paused&&!crashed){acc+=Math.min(delta,.1);while(acc>=DT){engine.step();forces.step(DT,lastPlayer,missiles.projectiles);radar.step(DT,lastPlayer,forces.units,forces.selected);missiles.step(DT,ORIGIN.elevation,forces.units,()=>forces.hits++);acc-=DT;if(engine.get('position/h-sl-ft')*.3048<=ORIGIN.elevation+.15){crashed=true;paused=true;break;}}}else acc=0;
  if(++tick%4===0){const snap=snapshot(),f=snap.flight,a=snap.attitude;if(recording&&!paused&&rows.length<18000)rows.push([snap.elapsed,snap.state[0],snap.state[1],-snap.state[2],f.V,f.alpha,a.roll,a.pitch,a.yaw,f.lift,f.drag,f.thrust,f.weight,f.profileDrag,f.inducedDrag,f.dynamicPressure,f.CL,f.CD,f.CAS,f.shaftPower,snap.geo.latitude,snap.geo.longitude].join(','));postMessage({type:'state',...snap});}
}catch(error){fail(error);}},4);
try{engine=await JSBSimFlight.create();engine.setWind(wind);engine.setTurbulence(turbulence);engine.setAugmentationEnabled(augmentationEnabled);ready=true;last=performance.now();publish();}catch(error){fail(error);}
