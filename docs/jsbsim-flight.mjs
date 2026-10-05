import {F15Augmentation} from './f15-controls.mjs';
import {JSBSimSdk,TrimMode} from './vendor/jsbsim/sdk.mjs';
import {MODELS} from './models.mjs';
import wasmFactory from './vendor/jsbsim/wasm/jsbsim_wasm.mjs';
import {ORIGIN,geoToMercator,mercatorToLocal} from './imagery.mjs';
const FT=.3048,LBF=4.4482216152605,PSF=47.88025898,RHO=515.3788184,HP=745.699872;
const files=['aircraft/c172s-lab/c172s-lab.xml','engine/engIO360C.xml','engine/prop_Clark_Y7570.xml','aircraft/f15/f15.xml','engine/F100-PW-229.xml','engine/direct.xml','aircraft/737/737.xml','engine/CFM56.xml'];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const normalized=(angle,negative,positive)=>clamp(angle/(angle<0?negative:positive),-1,1);
export function attitudeQuaternion(roll,pitch,yaw){const cr=Math.cos(roll/2),sr=Math.sin(roll/2),cp=Math.cos(pitch/2),sp=Math.sin(pitch/2),cy=Math.cos(yaw/2),sy=Math.sin(yaw/2);return [cr*cp*cy+sr*sp*sy,sr*cp*cy-cr*sp*sy,cr*sp*cy+sr*cp*sy,cr*cp*sy-sr*sp*cy];}
export class JSBSimFlight{
  static async create({readData, moduleFactory}={}){
    const engine=new JSBSimFlight();
    if(!moduleFactory){
      const response=await fetch(new URL('./vendor/jsbsim/wasm/jsbsim_wasm.wasm',import.meta.url),{signal:AbortSignal.timeout(30000)});
      if(!response.ok)throw Error('Flight engine download failed. Reset to retry.');
      const wasmBinary=new Uint8Array(await response.arrayBuffer());
      moduleFactory=options=>wasmFactory({...options,wasmBinary});
    }
    engine.sdk=await JSBSimSdk.create({moduleFactory,moduleUrl:new URL('./vendor/jsbsim/wasm/jsbsim_wasm.mjs',import.meta.url),wasmUrl:new URL('./vendor/jsbsim/wasm/jsbsim_wasm.wasm',import.meta.url),log:{console:false}});
    engine.module=engine.sdk.module;
    await Promise.all(files.map(async path=>{const content=readData?await readData(path):await (async()=>{const response=await fetch(new URL('./vendor/jsbsim/data/'+path,import.meta.url),{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Aircraft data failed to load');return response.text();})();engine.sdk.writeDataFile(path,content);}));
    await engine.reset();return engine;
  }
  get(p){return this.sdk.getPropertyValue(p);}
  set(p,v){this.sdk.setPropertyValue(p,v);}
  async reset(speed,altitude,modelKey='c172',start='cruise'){
    const onGround=start==='ground',approach=start==='approach';
    const model=MODELS[modelKey];if(!model)throw Error('Unknown aircraft model.');this.model=model;speed??=model.speed;altitude??=model.altitude;
    if(approach){speed={c172:35,f15:100,b737:110}[modelKey];altitude=ORIGIN.elevation+50;}
    if(!onGround&&!approach&&(!Number.isFinite(speed)||!Number.isFinite(altitude)||speed<30||speed>(model.kind==='jet'?350:70)||altitude<100||altitude>(model.kind==='jet'?12000:4000)))throw Error('Initial flight conditions are out of range.');
    if(onGround){speed=0;altitude=ORIGIN.elevation+model.groundHeight;}
    if(this.loaded){this.sdk.exec.delete();this.sdk=await JSBSimSdk.create({moduleFactory:async()=>this.module,log:{console:false}});}
    this.sdk.setDebugLevel(0);this.loaded=true;
    if(!this.sdk.loadModel(model.model))throw Error('The aircraft model failed to load.');
    this.sdk.setDt(1/240);this.set('atmosphere/turb-type',3);this.set('atmosphere/turbulence/milspec/severity',0);this.set('gear/gear-cmd-norm',onGround||approach||model.fixedGear?1:0);this.set('fcs/flap-cmd-norm',0);this.set('fcs/left-brake-cmd-norm',onGround?1:0);this.set('fcs/right-brake-cmd-norm',onGround?1:0);this.set('fcs/speedbrake-cmd-norm',0);
    for(const [p,v] of Object.entries({'ic/lat-geod-deg':ORIGIN.latitude,'ic/long-gc-deg':ORIGIN.longitude,'ic/h-sl-ft':altitude/FT,'ic/terrain-elevation-ft':ORIGIN.elevation/FT,'ic/vt-fps':speed/FT,'ic/psi-true-deg':ORIGIN.heading,'ic/gamma-deg':0,'fcs/mixture-cmd-norm':1,'fcs/throttle-cmd-norm':onGround?0:.7,'propulsion/magneto_cmd':3}))this.set(p,v);
    if(!this.sdk.runIc())throw Error('Initial flight conditions failed.');
    this.set('propulsion/set-running',-1);
    if(model.kind==='piston')this.set('fcs/mixture-cmd-norm',clamp(this.get('atmosphere/P-psf')/2116.22,0,1));
    try{this.sdk.doTrim(onGround?TrimMode.tGround:TrimMode.tFull);}catch{throw Error('Cannot trim level flight at this speed and altitude. Choose a lower speed and reset.');}
    // JSBSim can substitute flight-path angle when available power is insufficient.
    if(!onGround&&Math.abs(this.get('velocities/v-down-fps'))>.5)throw Error('Not enough power for level flight here. Choose a lower speed and reset.');
    this.trimNorm=this.get('fcs/pitch-trim-cmd-norm');
    this.trim={elevator:this.get('fcs/elevator-pos-rad'),aileron:this.get('fcs/left-aileron-pos-rad'),rudder:this.get('fcs/rudder-pos-rad'),throttle:this.get('fcs/throttle-cmd-norm')};
    this.augmentation=new F15Augmentation();this.augmentationState=null;this.controls={...this.trim};this.systems={gear:onGround||approach||model.fixedGear?1:0,flap:0,brake:0,parking:onGround,steering:0};this.setSystems(this.systems);this.setWind(this.wind??0);this.setTurbulence(this.turbulence??'off');return this.snapshot();
  }
  setControls(input){this.controls={...this.controls,...input};const c=this.controls,l=this.model.limits;
    this.set('fcs/pitch-trim-cmd-norm',this.trimNorm);
    this.set('fcs/elevator-cmd-norm',normalized(c.elevator,...l.elevator)-this.trimNorm);
    this.set('fcs/aileron-cmd-norm',normalized(c.aileron,...l.aileron));
    this.set('fcs/rudder-cmd-norm',normalized(c.rudder,...l.rudder));
    for(let i=0;i<this.model.engines;i++)this.set(`fcs/throttle-cmd-norm[${i}]`,clamp(c.throttle,0,this.model.afterburner?2:1));
  }
  setSystems(input){
    const previousGear=this.systems?.gear;this.systems={...this.systems,...input};const s=this.systems;
    if(this.model.fixedGear||(this.get('gear/wow')&&previousGear))s.gear=1;
    this.set('gear/gear-cmd-norm',s.gear?1:0);
    const index=Math.max(0,Math.min(this.model.flaps.length-1,Math.round(Number(s.flap)||0)));
    this.set('fcs/flap-cmd-norm',this.model.key==='c172'?this.model.flaps[index]:this.model.key==='b737'?index/8:0);
    const brake=s.parking?1:clamp(Number(s.brake)||0,0,1);
    this.set('fcs/left-brake-cmd-norm',brake);this.set('fcs/right-brake-cmd-norm',brake);
    const speed=Math.hypot(this.get('velocities/v-north-fps'),this.get('velocities/v-east-fps'))*FT;
    this.set('fcs/steer-pos-deg[0]',clamp(Number(s.steering)||0,-1,1)*this.model.steerMax*clamp(12/Math.max(12,speed),.15,1));
  }
  setWind(east){this.wind=east;this.set('atmosphere/wind-east-fps',east/FT);}
  setTurbulence(level){
    const presets={off:[0,0],light:[3,25],moderate:[4,50],severe:[6,75]};if(!Object.hasOwn(presets,level))throw Error('Unknown turbulence level.');
    this.turbulence=level;const [severity,wind20]=presets[level];this.set('atmosphere/turb-type',3);this.set('atmosphere/turbulence/milspec/severity',severity);this.set('atmosphere/turbulence/milspec/windspeed_at_20ft_AGL-fps',wind20);
    if(level==='off')for(const axis of ['north','east','down'])this.set(`atmosphere/turb-${axis}-fps`,0);
  }
  setAugmentationEnabled(value){this.augmentationEnabled=Boolean(value);this.augmentation=new F15Augmentation();this.augmentationState=null;this.setControls(this.controls);}
  applyAugmentation(){
    const get=p=>this.get(p),pilot=this.controls.pilot,l=this.model.limits;
    const trim={elevator:normalized(this.trim.elevator+(pilot.trimOffset??0),...l.elevator),aileron:normalized(this.trim.aileron,...l.aileron),rudder:normalized(this.trim.rudder,...l.rudder)};
    const s={qbar:get('aero/qbar-psf')*PSF,speed:get('velocities/vt-fps')*FT,alpha:get('aero/alpha-rad'),beta:get('aero/beta-rad'),load:get('accelerations/Nz'),p:get('velocities/p-rad_sec'),q:get('velocities/q-rad_sec'),r:get('velocities/r-rad_sec')};
    const command=this.augmentation.update(s,pilot,trim,1/240);this.augmentationState=command;
    this.set('fcs/elevator-cmd-norm',command.elevator-this.trimNorm);this.set('fcs/aileron-cmd-norm',command.aileron);this.set('fcs/rudder-cmd-norm',command.rudder);
  }
  step(){if(this.systems)this.setSystems(this.systems);if(this.model.key==='f15'&&this.augmentationEnabled!==false&&this.controls.pilot&&!this.get('gear/wow'))this.applyAugmentation();if(this.model.kind==='piston')this.set('fcs/mixture-cmd-norm',clamp(this.get('atmosphere/P-psf')/2116.22,0,1));if(!this.sdk.run())throw Error('JSBSim stopped advancing the flight.');}
  snapshot(){
    const get=p=>this.get(p),attitude={roll:get('attitude/phi-rad'),pitch:get('attitude/theta-rad'),yaw:get('attitude/psi-rad')},geo={latitude:get('position/lat-geod-deg'),longitude:get('position/long-gc-deg')},position=mercatorToLocal(...geoToMercator(geo.latitude,geo.longitude));position[2]=-get('position/h-sl-ft')*FT;
    const state=[...position,...['u','v','w'].map(axis=>get(`velocities/${axis}-fps`)*FT),...attitudeQuaternion(attitude.roll,attitude.pitch,attitude.yaw),...['p','q','r'].map(axis=>get(`velocities/${axis}-rad_sec`)),get('fcs/elevator-pos-rad'),get('fcs/left-aileron-pos-rad'),get('fcs/rudder-pos-rad'),get('fcs/throttle-pos-norm')];
    const lift=get('forces/fwz-aero-lbs')*LBF,drag=get('forces/fwx-aero-lbs')*LBF,dynamicPressure=get('aero/qbar-psf')*PSF,area=get('metrics/Sw-sqft')*FT*FT,alpha=get('aero/alpha-rad');
    const jet=this.model.kind==='jet',alphaDrag=(jet?(this.model.key==='f15'?get('aero/coefficient/CDalpha'):0)+get('aero/coefficient/CDi'):get('aero/coefficient/CDwbh'))*LBF;
    const thrust=Array.from({length:this.model.engines},(_,i)=>get(`propulsion/engine${i?'['+i+']':''}/thrust-lbs`)*LBF).reduce((a,b)=>a+b,0);
    const n1=jet?(get('propulsion/engine/n1')+get('propulsion/engine[1]/n1'))/2:0;
    const flight={V:get('velocities/vt-fps')*FT,CAS:get('velocities/vc-fps')*FT,alpha,beta:get('aero/beta-rad'),rho:get('atmosphere/rho-slugs_ft3')*RHO,dynamicPressure,lift,drag,thrust,weight:get('inertia/weight-lbs')*LBF,load:get('accelerations/Nz'),CL:dynamicPressure>0?lift/(dynamicPressure*area):0,CD:dynamicPressure>0?drag/(dynamicPressure*area):0,shaftPower:jet?0:get('propulsion/engine/power-hp')*HP,enginePercent:jet?n1:get('propulsion/engine/power-hp')/180*100,mach:get('velocities/mach'),afterburner:Boolean(this.model.afterburner)&&this.controls.throttle>1,area,profileDrag:drag-alphaDrag,inducedDrag:alphaDrag,stall:get('systems/stall-warn-norm')>=1,surfaces:[{name:'wing',alpha}],rpm:jet?0:get('propulsion/engine/engine-rpm')};
    if(jet){flight.engines=Array.from({length:this.model.engines},(_,i)=>{const prefix=`propulsion/engine${i?'['+i+']':''}/`;return {n1:get(prefix+'n1'),n2:get(prefix+'n2'),fuelFlow:get(prefix+'fuel-flow-rate-pps')*.45359237};});flight.fuelKg=get('propulsion/total-fuel-lbs')*.45359237;}
    if(state.some(x=>!Number.isFinite(x))||Object.values(flight).some(x=>typeof x==='number'&&!Number.isFinite(x)))throw Error('Flight state became invalid. Reset to try again.');
    return {state,attitude,flight,geo,systems:{...this.systems,gearPosition:this.model.fixedGear?1:get('gear/gear-pos-norm'),flapPosition:get('fcs/flap-pos-norm'),onGround:Boolean(get('gear/wow')),groundSpeed:Math.hypot(get('velocities/v-north-fps'),get('velocities/v-east-fps'))*FT,agl:get('position/h-agl-ft')*FT},augmentation:this.model.key==='f15'&&this.augmentationEnabled!==false&&Boolean(this.controls.pilot)?{enabled:true,...this.augmentationState}:null,weather:{turbulence:this.turbulence??'off',gust:['north','east','down'].map(axis=>get(`atmosphere/turb-${axis}-fps`)*FT)},controls:{...this.controls},trim:{...this.trim},velocity:['north','east','down'].map(axis=>get(`velocities/v-${axis}-fps`)*FT),elapsed:get('simulation/sim-time-sec'),engine:'JSBSim 1.2.4',aircraft:this.model,ready:true};
  }
  destroy(){this.sdk.exec.delete();}
}
