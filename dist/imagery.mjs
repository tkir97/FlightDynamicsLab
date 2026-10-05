import {GroundRaster,horizonDistance} from './terrain.mjs';
const R=6378137,HALF=Math.PI*R,SIZE=HALF*2;
export const ORIGIN={latitude:26.246748500933275,longitude:50.15228660429263,elevation:25.6032,heading:0,icao:'OEDR',name:'Dhahran · OEDR'};
export const SERVICE='https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer';
export const FALLBACK_CREDIT='Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community';
export function geoToMercator(latitude,longitude){const phi=Math.max(-85.05112878,Math.min(85.05112878,latitude))*Math.PI/180;return [R*longitude*Math.PI/180,R*Math.log(Math.tan(Math.PI/4+phi/2))];}
export function mercatorToGeo(x,y){return {latitude:(2*Math.atan(Math.exp(y/R))-Math.PI/2)*180/Math.PI,longitude:x/R*180/Math.PI};}
const reference=geoToMercator(ORIGIN.latitude,ORIGIN.longitude),scale=Math.cos(ORIGIN.latitude*Math.PI/180);
export const localToMercator=(north,east)=>[reference[0]+east/scale,reference[1]+north/scale];
export const mercatorToLocal=(x,y)=>[(y-reference[1])*scale,(x-reference[0])*scale,-ORIGIN.elevation];
export const localToGeo=(north,east)=>mercatorToGeo(...localToMercator(north,east));
export function tileXY(x,y,zoom){const span=SIZE/2**zoom;return [Math.floor((x+HALF)/span),Math.floor((HALF-y)/span)];}
export function tileBounds(x,y,zoom){const span=SIZE/2**zoom;return {left:x*span-HALF,right:(x+1)*span-HALF,top:HALF-y*span,bottom:HALF-(y+1)*span};}
export function tileURL(z,x,y){const n=2**z;if(y<0||y>=n)return null;return `${SERVICE}/tile/${z}/${y}/${((x%n)+n)%n}`;}
export class Satellite{constructor({imageFactory=()=>new Image(),onCredit=()=>{}}={}){this.cache=new Map();this.queue=[];this.active=0;this.clock=0;this.imageFactory=imageFactory;this.onCredit=onCredit;this.terrainZoom=14;this.wanted=[];this.centerKey='';this.limit=512;}async attribution(){try{const response=await fetch(SERVICE+'?f=json',{signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('Metadata request failed');const metadata=await response.json();if(metadata.copyrightText)this.onCredit(metadata.copyrightText);}catch{this.onCredit(FALLBACK_CREDIT);}}get(z,x,y,priority=0){const url=tileURL(z,x,y);if(!url)return null;const key=`${z}/${x}/${y}`;let tile=this.cache.get(key);if(tile){tile.used=++this.clock;return tile;}if(this.cache.size>=this.limit){const removable=[...this.cache.values()].filter(t=>t.state!=='loading'&&!this.wanted.includes(t)).sort((a,b)=>a.used-b.used)[0];if(removable){this.cache.delete(removable.key);this.queue=this.queue.filter(t=>t!==removable);}else return null;}tile={key,z,x,y,url,state:'queued',image:null,used:++this.clock,priority};this.cache.set(key,tile);this.queue.push(tile);this.queue.sort((a,b)=>a.priority-b.priority);this.pump();return tile;}pump(){while(this.active<8&&this.queue.length){const tile=this.queue.shift();if(!this.cache.has(tile.key))continue;tile.state='loading';this.active++;const image=this.imageFactory();tile.image=image;image.crossOrigin='anonymous';let ended=false;const finish=ok=>{if(ended)return;ended=true;clearTimeout(timer);tile.state=ok?'ready':'error';this.active--;image.onload=image.onerror=null;this.pump();};const timer=setTimeout(()=>finish(false),15000);image.onload=()=>finish(true);image.onerror=()=>finish(false);image.src=tile.url;}}prepare(north,east,velocity=[0,0],height=900){
const [x,y]=localToMercator(north,east),[tx,ty]=tileXY(x,y,this.terrainZoom);
// Thirty seconds of travel, with a useful forward margin even at low speed.
const speed=Math.hypot(velocity[0],velocity[1]),lead=Math.min(12000,Math.max(4000,speed*30));
const dn=speed>1?velocity[0]/speed*lead:0,de=speed>1?velocity[1]/speed*lead:0;
const [ax,ay]=tileXY(...localToMercator(north+dn,east+de),this.terrainZoom),bucket=Math.ceil(Math.max(0,height)/1000),key=`${tx}/${ty}/${ax}/${ay}/${bucket}`;
if(key===this.centerKey)return;this.centerKey=key;
const cells=new Map(),add=(z,cx,cy,radius,priority)=>{for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){const k=`${z}/${cx+dx}/${cy+dy}`,d=priority+Math.hypot(dx,dy);if(!cells.has(k)||cells.get(k).d>d)cells.set(k,{z,x:cx+dx,y:cy+dy,d});}};
// A coarse backdrop covers the altitude-dependent geometric horizon.
const range=horizonDistance(bucket*1000),coarseSpan=SIZE/2**7*scale;
const [hx,hy]=tileXY(x,y,7);add(7,hx,hy,Math.ceil(range/coarseSpan)+1,-40);
const [mx,my]=tileXY(x,y,9);add(9,mx,my,3,-30);
// Intermediate resolution covers the transition to nearby detailed scenery.
const [cx,cy]=tileXY(x,y,11);add(11,cx,cy,4,-20);
add(this.terrainZoom,tx,ty,3,-10);
const steps=Math.max(1,Math.ceil(Math.hypot(ax-tx,ay-ty)));
for(let i=1;i<=steps;i++)add(this.terrainZoom,Math.round(tx+(ax-tx)*i/steps),Math.round(ty+(ay-ty)*i/steps),3,i/steps*4);
// Drop obsolete queued requests after turns; retain cached imagery for reuse.
for(const t of this.queue)if(!cells.has(t.key))this.cache.delete(t.key);
this.queue=this.queue.filter(t=>cells.has(t.key));
this.wanted=[...this.cache.values()].filter(t=>cells.has(t.key));
for(const c of [...cells.values()].sort((a,b)=>a.d-b.d)){const t=this.get(c.z,c.x,c.y,c.d);if(t){t.priority=c.d;if(!this.wanted.includes(t))this.wanted.push(t);}}
this.queue.sort((a,b)=>a.priority-b.priority);
}status(){const ready=this.wanted.filter(t=>t.state==='ready').length,failed=this.wanted.filter(t=>t.state==='error').length;return {ready,total:this.wanted.length,failed,loading:this.active+this.queue.length};}retry(){for(const t of [...this.cache.values()])if(t.state==='error'){this.cache.delete(t.key);}this.centerKey='';}
renderTerrain(g,north,east,toCamera,screen,W,H,camera,velocity){this.prepare(north,east,velocity,-camera.eye[2]-ORIGIN.elevation);this.raster??=new GroundRaster();this.raster.draw(g,this.wanted,W,H,camera,tileBounds,mercatorToLocal);}
renderMap(canvas,data,zoom=14){const rect=canvas.getBoundingClientRect(),dpr=Math.min(globalThis.devicePixelRatio||1,2),W=rect.width,H=rect.height;if(W<1||H<1)return;if(canvas.width!==Math.round(W*dpr)||canvas.height!==Math.round(H*dpr)){canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);}const g=canvas.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.fillStyle='#25333a';g.fillRect(0,0,W,H);const [mx,my]=localToMercator(data.state[0],data.state[1]),[tx,ty]=tileXY(mx,my,zoom),pixelsPerMeter=256/(SIZE/2**zoom),sx=x=>W/2+(x-mx)*pixelsPerMeter,sy=y=>H/2-(y-my)*pixelsPerMeter;const rx=Math.ceil(W/512)+1,ry=Math.ceil(H/512)+1;for(let dy=-ry;dy<=ry;dy++)for(let dx=-rx;dx<=rx;dx++){const x=tx+dx,y=ty+dy,t=this.get(zoom,x,y,-10+Math.hypot(dx,dy)),b=tileBounds(x,y,zoom);if(t?.state==='ready')g.drawImage(t.image,sx(b.left),sy(b.top),256.6,256.6);}g.strokeStyle='#b6ee96';g.lineWidth=1.5;g.beginPath();g.moveTo(W/2-18,H/2);g.lineTo(W/2+18,H/2);g.moveTo(W/2,H/2-18);g.lineTo(W/2,H/2+18);g.stroke();g.save();g.translate(W/2,H/2);g.rotate(data.attitude.yaw);g.fillStyle='#b6ee96';g.strokeStyle='#112d20';g.lineWidth=2;g.beginPath();g.moveTo(0,-12);g.lineTo(9,10);g.lineTo(0,5);g.lineTo(-9,10);g.closePath();g.fill();g.stroke();g.restore();for(const u of data.forces?.units??[]){const [ux,uy]=localToMercator(u.position[0],u.position[1]),px=sx(ux),py=sy(uy);if(px<8||py<8||px>W-8||py>H-8)continue;g.fillStyle=u.team==='friendly'?'#87d5ff':'#ffae8e';g.beginPath();g.arc(px,py,4,0,Math.PI*2);g.fill();if(u.id===data.forces.selected){g.strokeStyle='#b0ed8c';g.strokeRect(px-8,py-8,16,16);}g.font='12px monospace';g.fillText(u.name,px+7,py-7);}g.fillStyle='#fff';g.font='12px sans-serif';g.fillText('N',12,21);const meters=scale/pixelsPerMeter*100;g.strokeStyle='#fff';g.lineWidth=2;g.beginPath();g.moveTo(W-120,H-16);g.lineTo(W-20,H-16);g.stroke();g.fillText(meters>=1000?(meters/1000).toFixed(1)+' km':Math.round(meters)+' m',W-112,H-23);}}
