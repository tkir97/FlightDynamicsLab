import {test} from 'node:test';import assert from 'node:assert/strict';import {ORIGIN,geoToMercator,mercatorToGeo,localToGeo,localToMercator,mercatorToLocal,tileXY,tileBounds,tileURL,Satellite} from './dist/imagery.mjs';
test('local origin is the requested Dhahran start',()=>{assert.equal(ORIGIN.latitude,26.246748500933275);assert.equal(ORIGIN.longitude,50.15228660429263);assert.equal(ORIGIN.heading,0);const p=localToGeo(0,0);assert.ok(Math.abs(p.latitude-ORIGIN.latitude)<1e-10);assert.ok(Math.abs(p.longitude-ORIGIN.longitude)<1e-10);});
test('Mercator geographic round trip',()=>{for(const [lat,lon]of [[52.205,.175],[0,0],[-35,151],[70,-100]]){const p=mercatorToGeo(...geoToMercator(lat,lon));assert.ok(Math.abs(p.latitude-lat)<1e-10);assert.ok(Math.abs(p.longitude-lon)<1e-10);}});
test('north/east geographic directions and local round trip',()=>{assert.ok(localToGeo(1000,0).latitude>ORIGIN.latitude);assert.ok(localToGeo(0,1000).longitude>ORIGIN.longitude);const local=mercatorToLocal(...localToMercator(3210,-4500));assert.ok(Math.abs(local[0]-3210)<1e-8);assert.ok(Math.abs(local[1]+4500)<1e-8);assert.equal(local[2],-ORIGIN.elevation);});
test('tile coordinate lies within tile bounds and adjacent edges meet',()=>{const [x,y]=geoToMercator(ORIGIN.latitude,ORIGIN.longitude);for(const z of [12,14,16]){const [tx,ty]=tileXY(x,y,z),b=tileBounds(tx,ty,z),right=tileBounds(tx+1,ty,z);assert.ok(x>=b.left&&x<=b.right&&y>=b.bottom&&y<=b.top);assert.equal(b.right,right.left);}});
test('tile URLs wrap x and reject outside latitude',()=>{assert.equal(tileURL(2,-1,2),tileURL(2,3,2));assert.equal(tileURL(2,2,4),null);assert.ok(tileURL(14,8200,5398).endsWith('/14/5398/8200'));});
test('tile queue has bounded concurrency and can recover errors',()=>{const images=[],layer=new Satellite({imageFactory:()=>{const image={width:256,height:256};images.push(image);return image;}});layer.prepare(0,0);assert.equal(layer.active,8);assert.ok(layer.wanted.length>130);assert.ok(layer.wanted.some(t=>t.z===7));const first=images[0];first.onload();assert.equal(layer.active,8);assert.equal(layer.status().ready,1);images[1].onerror();assert.equal(layer.status().failed,1);layer.retry();assert.equal(layer.centerKey,'');for(const image of images)image.onerror?.();while(layer.active)for(const image of images)image.onerror?.();assert.ok(layer.cache.size<=layer.limit);});

test('terrain preloads along fast flight and retains distant coarse coverage after turns',()=>{
 const images=[],layer=new Satellite({imageFactory:()=>{const image={};images.push(image);return image;}});
 layer.prepare(0,0,[300,0]);
 const ahead=tileXY(...localToMercator(9000,0),14),far=tileXY(...localToMercator(30000,0),11);
 assert.ok(layer.wanted.some(t=>t.z===14&&t.x===ahead[0]&&t.y===ahead[1]));
 assert.ok(layer.wanted.some(t=>t.z===11&&t.x===far[0]&&t.y===far[1]));
 layer.prepare(0,0,[0,-300]);
 const turn=tileXY(...localToMercator(0,-9000),14);
 assert.ok(layer.wanted.some(t=>t.z===14&&t.x===turn[0]&&t.y===turn[1]));
 assert.ok(layer.queue.every(t=>layer.wanted.includes(t)));
 assert.ok(layer.cache.size<=layer.limit);
 while(layer.active)for(const image of images)image.onerror?.();
});

test('coarse tiles cover the high-altitude horizon in every direction',()=>{
 const layer=new Satellite();layer.pump=()=>{};layer.prepare(0,0,[220,0],12000);
 for(const [north,east] of [[390000,0],[-390000,0],[0,390000],[0,-390000]]){const [x,y]=tileXY(...localToMercator(north,east),7);assert.ok(layer.wanted.some(t=>t.z===7&&t.x===x&&t.y===y));}
 assert.ok(layer.wanted.length<layer.limit);
});
