// Inverse perspective mapping: each screen sample intersects the actual ground
// plane. UVs never interpolate affinely across projected triangles.
export const EARTH_RADIUS=6371000;
export const horizonDistance=height=>Math.sqrt(Math.max(0,height)*(2*EARTH_RADIUS+Math.max(0,height)));
export function groundPoint(x,y,c,down){
  const horizontal=(x-c.width/2)/c.focal,vertical=(c.centerY-y)/c.focal;
  const dx=c.forward[0]+horizontal*c.right[0]+vertical*c.up[0],dy=c.forward[1]+horizontal*c.right[1]+vertical*c.up[1],dz=c.forward[2]+horizontal*c.right[2]+vertical*c.up[2];
  const h=Math.max(0,down-c.eye[2]),a=dx*dx+dy*dy+dz*dz,b=(EARTH_RADIUS+h)*dz,cc=h*(2*EARTH_RADIUS+h),disc=b*b-a*cc;
  if(dz<=0||disc<0)return null;
  // Stable near root of the spherical-ground intersection; no distance cutoff.
  const t=cc/(b+Math.sqrt(disc));if(!Number.isFinite(t)||t<2)return null;
  return [c.eye[0]+t*dx,c.eye[1]+t*dy];
}
export class GroundRaster{
  constructor(){this.pixels=new WeakMap();}
  draw(g,tiles,W,H,camera,bounds,local){
    // A bounded raster keeps flight controls responsive on large/retina displays.
    const width=Math.min(900,Math.ceil(W)),height=Math.max(1,Math.round(H*width/W));
    this.canvas??=new OffscreenCanvas(width,height);
    if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;this.frame=null;}
    const context=this.canvas.getContext('2d');this.frame??=context.createImageData(width,height);
    const out=this.frame.data;out.fill(0);
    const ready=tiles.filter(t=>t.state==='ready');
    const levels=[];
    for(const z of [...new Set(ready.map(t=>t.z))].sort((a,b)=>b-a)){
      const group=ready.filter(t=>t.z===z),first=bounds(group[0].x,group[0].y,z),nw=local(first.left,first.top),se=local(first.right,first.bottom),span=se[1]-nw[1],lookup=new Map();
      for(const tile of group){let pixels=this.pixels.get(tile.image);if(!pixels){const c=new OffscreenCanvas(tile.image.width,tile.image.height),ctx=c.getContext('2d');ctx.drawImage(tile.image,0,0);pixels={data:ctx.getImageData(0,0,c.width,c.height).data,width:c.width,height:c.height};this.pixels.set(tile.image,pixels);}lookup.set(tile.y*2**z+tile.x,pixels);}
      levels.push({count:2**z,span,northZero:nw[0]+group[0].y*span,eastZero:nw[1]-group[0].x*span,lookup});
    }
    const c={...camera,width:W},down=local(0,0)[2],ratio=W/width;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const point=groundPoint((x+.5)*ratio,(y+.5)*ratio,c,down);if(!point)continue;
      let tile,u,v,tx,ty;
      for(const level of levels){u=(point[1]-level.eastZero)/level.span;v=(level.northZero-point[0])/level.span;tx=Math.floor(u);ty=Math.floor(v);tile=level.lookup.get(ty*level.count+tx);if(tile)break;}
      const distance=Math.hypot(point[0]-c.eye[0],point[1]-c.eye[1]),haze=1-Math.exp(-distance/85000),hazeColor=[184,205,217];
      if(!tile){const dst=(y*width+x)*4;for(let channel=0;channel<3;channel++)out[dst+channel]=[110,131,108][channel]*(1-haze)+hazeColor[channel]*haze;out[dst+3]=255;continue;}
      const fx=Math.max(0,(u-tx)*tile.width-.5),fy=Math.max(0,(v-ty)*tile.height-.5),px=Math.min(tile.width-1,Math.floor(fx)),py=Math.min(tile.height-1,Math.floor(fy)),px1=Math.min(tile.width-1,px+1),py1=Math.min(tile.height-1,py+1),ax=fx-px,ay=fy-py,dst=(y*width+x)*4;
      const a=(py*tile.width+px)*4,b=(py*tile.width+px1)*4,d=(py1*tile.width+px)*4,e=(py1*tile.width+px1)*4;
      for(let channel=0;channel<3;channel++)out[dst+channel]=hazeColor[channel]*haze+(1-haze)*((tile.data[a+channel]*(1-ax)+tile.data[b+channel]*ax)*(1-ay)+(tile.data[d+channel]*(1-ax)+tile.data[e+channel]*ax)*ay);
      out[dst+3]=255;
    }
    context.putImageData(this.frame,0,0);g.drawImage(this.canvas,0,0,W,H);
  }
}
