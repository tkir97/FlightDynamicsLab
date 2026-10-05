const clamp=v=>Math.max(-1,Math.min(1,Number.isFinite(v)?v:0));
// Visual travel is approximate. Inputs exclude trim and aerodynamic surface feedback.
export function yokeDemand(data){
 const input=data?.controls?.cockpitInput;
 return input?{pitch:clamp(input.pitch),roll:clamp(input.roll)}:{pitch:0,roll:0};
}
export class CockpitYokes{
 constructor(scene){
  this.pairs=['captain','first-officer'].map(role=>({column:scene.getObjectByName('yoke-column-'+role),wheel:scene.getObjectByName('yoke-wheel-'+role)}));
  if(this.pairs.some(p=>!p.column||!p.wheel))throw Error('Cockpit yoke rig is missing');
  this.pitch=0;this.roll=0;this.lastTime=performance.now();this.elapsed=0;
 }
 update(data,now=performance.now()){
  const dt=Math.max(0,Math.min(.1,(now-this.lastTime)/1000));this.lastTime=now;
  if((data?.elapsed??0)<this.elapsed){this.pitch=0;this.roll=0;}
  this.elapsed=data?.elapsed??0;const demand=yokeDemand(data),blend=1-Math.exp(-dt/.07);
  this.pitch+=(demand.pitch-this.pitch)*blend;this.roll+=(demand.roll-this.roll)*blend;
  // GLB forward is +Z. Positive X rotation pushes the column away;
  // positive Z wheel rotation is clockwise from the pilot's seat (right roll).
  for(const pair of this.pairs){pair.column.rotation.x=this.pitch*Math.PI/18;pair.wheel.rotation.z=this.roll*70*Math.PI/180;}
 }
}
