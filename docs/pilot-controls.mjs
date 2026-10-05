import {clamp} from './physics.mjs';
// Keyboard buttons act as a virtual stick. F-15 gets its full modeled travel;
// native JSBSim actuators still rate-limit the actual control surfaces.
export class PilotControls{
 constructor(){this.reset();}
 reset(){this.axes={elevator:0,aileron:0,rudder:0};}
 sample(data,keys,dt,trimOffset,throttle){
  const input={elevator:Number(keys.has('ArrowUp'))-Number(keys.has('ArrowDown')),aileron:Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft')),rudder:Number(keys.has('a'))-Number(keys.has('d'))};
  if(data.aircraft?.key!=='f15'){this.reset();return {elevator:clamp(data.trim.elevator+trimOffset+input.elevator*.12,-.4,.35),aileron:data.trim.aileron+input.aileron*.16,rudder:data.trim.rudder+input.rudder*.18,throttle,...(data.aircraft?.key==='b737'?{cockpitInput:{pitch:input.elevator,roll:input.aileron}}:{})};}
  const controls={throttle,pilot:{}};
  for(const axis of ['elevator','aileron','rudder']){
   const target=data.paused?0:input[axis];const travel=clamp(dt,0,.05)/(target===0?.12:.18);
   this.axes[axis]+=clamp(target-this.axes[axis],-travel,travel);
   controls.pilot[axis]=this.axes[axis];
   const [negative,positive]=data.aircraft.limits[axis],value=this.axes[axis];
   controls[axis]=clamp(data.trim[axis]+(axis==='elevator'?trimOffset:0)+value*(value<0?negative:positive),-negative,positive);
  }
  controls.pilot.trimOffset=trimOffset;return controls;
 }
}
