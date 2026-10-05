const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Flight Lab approximation. Authority limits/architecture follow NASA TM-72861,
// appendix pp. 12–13; gains, washout time constants and keyboard gearing are estimates.
// Runs at the physics timestep, upstream of JSBSim's native actuators.
const elevatorDegrees=n=>n*(n<0?26:15),elevatorNormalized=d=>d/(d<0?26:15);
export function pitchCasBounds(mechanicalDeg){
 const reduction=mechanicalDeg>5?clamp((15-mechanicalDeg)/10,0,1):mechanicalDeg< -19?clamp((mechanicalDeg+26)/7,0,1):1;
 // The report specifies limiter breakpoints, not the ramp shape. Linear taper is estimated.
 return [Math.max(-10*reduction,-26-mechanicalDeg),Math.min(10*reduction,15-mechanicalDeg)];
}
export class F15Augmentation{
 constructor(){this.pitchIntegral=0;this.lastPull=0;this.rollIntegral=0;this.yawMean=0;this.pitchMean=0;}
 update(s,pilot,trim,dt){
  const gain=clamp(14000/Math.max(1500,s.qbar),.35,2.5),authority=clamp((.44-s.alpha)/.14,.2,1),rollTarget=clamp(pilot.aileron,-1,1)*3.0*authority;
  const rollError=rollTarget-s.p,rollBase=.34*pilot.aileron+.38*rollError;
  if(Math.abs((rollBase+this.rollIntegral)*gain)<.95)this.rollIntegral=clamp(this.rollIntegral+rollError*.45*dt,-.3,.3);
  if(Math.abs(pilot.aileron)<.01)this.rollIntegral*=Math.exp(-dt*4);
  const aileron=clamp(trim.aileron+(rollBase+this.rollIntegral)*gain,-1,1);
  const pull=-clamp(pilot.elevator,-1,1),gTarget=1+(pull>=0?7*pull*authority:3*pull),pitchTarget=clamp((gTarget-1)*9.80665/Math.max(60,s.speed),-.35,.5);
  if(Math.abs(pull-this.lastPull)>.1)this.pitchIntegral*=.25;this.lastPull=pull;
  this.pitchMean+=(s.q-this.pitchMean)*(1-Math.exp(-dt/2));
  const pitchError=gTarget-s.load;
  // Pilot feedforward and CAS correction are independent paths. This is an
  // estimated virtual-stick mapping, not a reconstruction of mechanical PRAD gearing.
  const mechanicalNorm=clamp(trim.elevator+gain*(-.075*(gTarget-1)-.55*pitchTarget),-1,1),mechanicalDeg=elevatorDegrees(mechanicalNorm);
  const [casMin,casMax]=pitchCasBounds(mechanicalDeg);
  const pitchBase=.075*(s.load-1)+.55*(s.q-this.pitchMean);
  const softProtection=Math.max(0,s.load-8.5)*.18-Math.max(0,-2-s.load)*.18+Math.max(0,s.alpha-.40)*2;
  const requestedCas=()=>elevatorDegrees(gain*(pitchBase+this.pitchIntegral+softProtection));
  const integralDirection=-pitchError;
  if((requestedCas()>casMin&&requestedCas()<casMax)||(requestedCas()>=casMax&&integralDirection<0)||(requestedCas()<=casMin&&integralDirection>0))this.pitchIntegral=clamp(this.pitchIntegral-pitchError*.055*dt,-.45,.45);
  if(Math.abs(pull)<.01)this.pitchIntegral*=Math.exp(-dt*4);
  // Soft protection also shares limited CAS authority; it cannot guarantee G/AoA limits.
  const pitchCasDeg=clamp(requestedCas(),casMin,casMax),elevator=elevatorNormalized(mechanicalDeg+pitchCasDeg);
  this.yawMean+=(s.r-this.yawMean)*(1-Math.exp(-dt/2));
  // NASA yaw CAS authority is ±5°; pilot rudder is not constrained by that limit.
  const yawCasDeg=clamp(30*gain*(.65*(s.r-this.yawMean)-1.2*s.beta),-5,5);
  const rudder=clamp(trim.rudder+clamp(pilot.rudder,-1,1)*.45+yawCasDeg/30,-1,1);
  return {elevator:clamp(elevator,-1,1),aileron,rudder,rollTarget,gTarget,gain,mechanicalPitchDeg:mechanicalDeg,pitchCasDeg,pitchCasMinDeg:casMin,pitchCasMaxDeg:casMax,yawCasDeg};
 }
}
