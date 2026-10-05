import {ORIGIN} from '../dist/imagery.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {MODELS} from '../dist/models.mjs';
import factory from '../dist/vendor/jsbsim/wasm/jsbsim_wasm.mjs';import {JSBSimFlight} from '../dist/jsbsim-flight.mjs';
const root=new URL('../',import.meta.url),file=p=>new URL(p,root),wasm=await readFile(file('dist/vendor/jsbsim/wasm/jsbsim_wasm.wasm')),sources=JSON.parse(await readFile(file('validation/sources.json')));
const xml=await readFile(file('dist/vendor/jsbsim/data/aircraft/f15/f15.xml'),'utf8'),rows=[],cases=[],hashes={};
for(const p of ['dist/vendor/jsbsim/data/aircraft/f15/f15.xml','dist/vendor/jsbsim/data/engine/F100-PW-229.xml','dist/f15-controls.mjs','dist/models.mjs','dist/imagery.mjs','validation/sources.json','dist/jsbsim-flight.mjs','dist/vendor/jsbsim/wasm/jsbsim_wasm.wasm','scripts/f15-validation.mjs'])hashes[p]=createHash('sha256').update(await readFile(file(p))).digest('hex');
const modes=['augmented','direct-tuned','earlier-aero-direct'];const columns=['time_s','roll_rate_deg_s','pitch_rate_deg_s','yaw_rate_deg_s','bank_deg','pitch_deg','load_g','aoa_deg','beta_deg','ias_kt','elevator_deg','aileron_deg','rudder_deg'];
const DEG=180/Math.PI,round=v=>Number(v.toFixed(5));
const metric=tag=>Number(xml.match(new RegExp(`<${tag} unit="[^"]+">\\s*([\\d.]+)`))[1]);
const documentedChecks=[
 ['Wing reference area','m²',56.61,metric('wingarea')*.3048**2],
 ['Wing span','m',13.05,metric('wingspan')*.3048],
 ['Mean aerodynamic chord','m',4.86,metric('chord')*.3048],
 ['Aileron maximum magnitude','°',20,MODELS.f15.limits.aileron[1]*DEG],
 ['Stabilator negative limit','°',-26,-MODELS.f15.limits.elevator[0]*DEG],
 ['Stabilator positive limit','°',15,MODELS.f15.limits.elevator[1]*DEG],
 ['Rudder maximum magnitude','°',30,MODELS.f15.limits.rudder[1]*DEG]
].map(([name,unit,reference,model])=>({name,unit,reference,model:round(model),difference:round(model-reference),source:'NASA TM-72861 Table 1, printed pp. 15–16',scope:'Nominal dimensions/control travel only; not a flight-performance comparison.'}));
for(const mode of modes){
 const engine=await JSBSimFlight.create({moduleFactory:o=>factory({...o,wasmBinary:wasm}),readData:async p=>p==='aircraft/f15/f15.xml'&&mode==='earlier-aero-direct'?xml.replace('<value>3.2</value>','<value>1.0</value>'):readFile(file('dist/vendor/jsbsim/data/'+p))});
 for(const altitude of [1500,3000,6000])for(const speed of [150,180,220])for(const maneuver of ['roll-step','roll-doublet','pitch-doublet']){
  await engine.reset(speed,altitude,'f15');engine.setWind(0);engine.setTurbulence('off');engine.setAugmentationEnabled(mode==='augmented');const initial=engine.snapshot(),samples=[];
  for(let i=0;i<=1920;i++){
   const t=i/240,axis=maneuver==='pitch-doublet'?'elevator':'aileron',amplitude=maneuver==='roll-step'?1:.3;let input=t>=2&&t<3?amplitude:t>=3&&t<4&&maneuver!=='roll-step'?-amplitude:0;if(axis==='elevator')input=-input;
   const controls={...engine.trim},pilot={elevator:0,aileron:0,rudder:0,trimOffset:0};pilot[axis]=input;const limit=engine.model.limits[axis][input<0?0:1];controls[axis]+=input*limit;if(mode==='augmented')controls.pilot=pilot;engine.setControls(controls);
   if(i%12===0){const d=engine.snapshot();const sample=[t,d.state[10]*DEG,d.state[11]*DEG,d.state[12]*DEG,d.attitude.roll*DEG,d.attitude.pitch*DEG,d.flight.load,d.flight.alpha*DEG,d.flight.beta*DEG,d.flight.CAS*1.943844,d.state[13]*DEG,d.state[14]*DEG,d.state[15]*DEG].map(round);samples.push(sample);rows.push([mode,altitude,speed,maneuver,...sample].join(','));}
   if(i<1920)engine.step();
  }
  const rateColumn=maneuver==='pitch-doublet'?2:1,at=t=>samples.find(s=>Math.abs(s[0]-t)<.001),summary={peakRate:round(Math.max(...samples.map(s=>Math.abs(s[rateColumn])))),rateAt3s:at(3)[rateColumn],rateAt4s:at(4)[rateColumn],maxG:round(Math.max(...samples.map(s=>s[6]))),minG:round(Math.min(...samples.map(s=>s[6])))};
  cases.push({mode,altitude,speed,maneuver,initial:{massKg:initial.flight.weight/9.80665,fuelKg:initial.flight.fuelKg,mach:initial.flight.mach,trim:initial.trim},summary,samples});
 }
 engine.destroy();
}
const report={generated:new Date().toISOString(),status:'NOT VALIDATED AGAINST FLIGHT DATA',documentedChecks,configuration:{origin:ORIGIN,model:'Generic JSBSim f15, revision 1.31; no operational variant established',engines:'2 × F100-PW-229',emptyWeightLb:28000,pilotLb:230,initialFuelLb:5000,initialGrossWeightLb:33230,emptyCgIn:[-236.39,0,4.5],inertiaSlugFt2:{ixx:28700,iyy:165100,izz:187900,ixz:520},gear:'up',speedbrake:0,wind:'zero',turbulence:'off',dt:1/240,input:'Deterministic virtual-stick step/doublet; same fractional surface travel in Direct mode. Not a measured real-aircraft pilot force/displacement.'},hashes,sources,columns,cases};
await mkdir(file('dist/validation'),{recursive:true});await writeFile(file('dist/validation/f15-report.json'),JSON.stringify(report));await writeFile(file('dist/validation/f15-traces.csv'),'mode,altitude_m,tas_m_s,maneuver,'+columns.join(',')+'\n'+rows.join('\n')+'\n');await writeFile(file('dist/validation/source-audit.json'),JSON.stringify(sources,null,2));console.log(JSON.stringify({cases:cases.length,samples:rows.length,status:report.status}));
