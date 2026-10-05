import {ORIGIN} from './imagery.mjs';
const DEG=180/Math.PI,KT=1.943844,FT=3.28084;
export const SCREEN_LAYOUT=[{kind:'pfd',x:.3235,y:1.8786,z:1.4555,w:.098,h:.098},{kind:'nd',x:.1983,y:1.8782,z:1.4555,w:.098,h:.098},{kind:'engine',x:.0063,y:1.8782,z:1.4555,w:.099,h:.099},{kind:'nd',x:-.155,y:1.8782,z:1.4555,w:.099,h:.099},{kind:'pfd',x:-.28,y:1.8782,z:1.4555,w:.099,h:.099}];
export function displayValues(data){return {roll:data.attitude.roll*DEG,pitch:data.attitude.pitch*DEG,heading:((data.attitude.yaw*DEG)%360+360)%360,speed:data.flight.CAS*KT,altitude:-data.state[2]*FT,vsi:-(data.velocity?.[2]??0)*FT*60,mach:data.flight.mach};}
function text(g,t,x,y,size=20,color='#fff',align='center'){g.fillStyle=color;g.font=`${size}px monospace`;g.textAlign=align;g.fillText(t,x,y);}
function line(g,points,color='#fff',width=2){g.strokeStyle=color;g.lineWidth=width;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();}
export function paintDisplay(g,kind,data){const v=displayValues(data);g.fillStyle='#030608';g.fillRect(0,0,512,512);
if(kind==='pfd'){
 g.save();g.beginPath();g.rect(95,70,322,330);g.clip();g.translate(256,235);g.rotate(-data.attitude.roll);g.translate(0,v.pitch*5);g.fillStyle='#247bc2';g.fillRect(-800,-1600,1600,1600);g.fillStyle='#8e572f';g.fillRect(-800,0,1600,1600);line(g,[[-800,0],[800,0]]);
 for(let p=-90;p<=90;p+=5){if(!p)continue;const y=-p*5,w=p%10?28:55;line(g,[[-w,y],[w,y]]);if(p%10===0){text(g,Math.abs(p),-w-20,y+6,17);text(g,Math.abs(p),w+20,y+6,17);}}g.restore();
 line(g,[[165,235],[225,235],[225,245]],'#ffe84a',4);line(g,[[287,245],[287,235],[347,235]],'#ffe84a',4);line(g,[[246,235],[266,235]],'#ffe84a',4);
 for(const [x,value,step,label] of [[48,v.speed,20,'IAS KT'],[464,v.altitude,200,'ALT FT']]){g.fillStyle='#202b35';g.fillRect(x-42,75,84,320);g.save();g.beginPath();g.rect(x-42,75,84,320);g.clip();const base=Math.floor(value/step)*step;for(let n=base-4*step;n<=base+4*step;n+=step){const y=235-(n-value)/step*52;text(g,Math.round(n),x,y+6,18);}g.restore();g.fillStyle='#000';g.fillRect(x-42,215,84,40);g.strokeStyle='#fff';g.strokeRect(x-42,215,84,40);text(g,Math.round(value),x,243,23);text(g,label,x,55,15,'#9de2ff');}
 text(g,'HDG '+String(Math.round(v.heading)%360).padStart(3,'0')+'°',256,440,26);text(g,'M '+v.mach.toFixed(2),60,475,17);text(g,'V/S '+(Math.round(v.vsi/10)*10),350,475,18);text(g,'LIVE',256,28,17,'#71efa1');
}else if(kind==='nd'){
 text(g,'HDG '+String(Math.round(v.heading)%360).padStart(3,'0')+'°',256,35,26);text(g,'MAP · 20 NM',256,490,19,'#9de2ff');
 g.save();g.translate(256,250);for(const radius of [100,200]){g.strokeStyle='#536270';g.beginPath();g.arc(0,0,radius,0,Math.PI*2);g.stroke();}g.rotate(-data.attitude.yaw);
 for(let h=0;h<360;h+=10){const a=h/DEG;line(g,[[Math.sin(a)*190,-Math.cos(a)*190],[Math.sin(a)*200,-Math.cos(a)*200]]);if(h%30===0)text(g,h===0?'N':h/10,Math.sin(a)*210,-Math.cos(a)*210+6,20);}
 const factor=200/(20*1852),east=-data.state[1]*factor,north=data.state[0]*factor;if(Math.hypot(east,north)<195){line(g,[[east-7,north],[east,north-7],[east+7,north],[east,north+7],[east-7,north]],'#68e8fa');g.save();g.translate(east,north);g.rotate(data.attitude.yaw);text(g,ORIGIN.icao,0,-14,17,'#68e8fa');g.restore();}g.restore();line(g,[[256,250],[245,285],[256,277],[267,285],[256,250]],'#fff',3);text(g,'GS '+Math.round(Math.hypot(...(data.velocity??[0,0]).slice(0,2))*KT),80,65,20);text(g,'TRUE',440,65,16,'#9de2ff');
}else{
 text(g,'ENGINE',256,38,26);text(g,'1',170,75,24);text(g,'2',350,75,24);const engines=data.flight.engines??[];
 for(let i=0;i<2;i++){const x=i?350:170,n1=engines[i]?.n1??data.flight.enginePercent;g.strokeStyle='#fff';g.lineWidth=3;g.beginPath();g.arc(x,162,62,Math.PI*.75,Math.PI*2.25);g.stroke();const a=Math.PI*.75+Math.max(0,Math.min(1.1,n1/100))*Math.PI*1.5;line(g,[[x,162],[x+Math.cos(a)*54,162+Math.sin(a)*54]],'#fff',3);text(g,n1.toFixed(1),x,225,24);text(g,(engines[i]?.n2??0).toFixed(1),x,283,24);text(g,((engines[i]?.fuelFlow??0)*3600).toFixed(0),x,360,22);}
 text(g,'N1 %',256,245,18,'#9de2ff');text(g,'N2 %',256,315,18,'#9de2ff');text(g,'FF KG/H',256,395,18,'#9de2ff');text(g,'FUEL '+Math.round(data.flight.fuelKg??0)+' KG',256,440,22);text(g,'LIVE SIM DATA',256,483,17,'#71efa1');
}}
export class FlightDisplays{
 constructor(T,scene){this.screens=SCREEN_LAYOUT.map(spec=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.minFilter=T.LinearFilter;texture.generateMipmaps=false;const mesh=new T.Mesh(new T.PlaneGeometry(spec.w,spec.h),new T.MeshBasicMaterial({map:texture,toneMapped:false}));mesh.position.set(spec.x,spec.y,spec.z);mesh.rotation.y=Math.PI;scene.add(mesh);return {...spec,canvas,texture};});}
 update(data,now=performance.now()){if(!data?.ready||now-(this.last??-Infinity)<50)return;this.last=now;for(const s of this.screens){paintDisplay(s.canvas.getContext('2d'),s.kind,data);s.texture.needsUpdate=true;}}
}
