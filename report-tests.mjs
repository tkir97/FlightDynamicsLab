import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const report=JSON.parse(await readFile(new URL('./dist/validation/f15-report.json',import.meta.url)));
test('F-15 report records reproducible scenarios without inventing flight validation',async()=>{
 assert.equal(report.cases.length,81);assert.equal(report.status,'NOT VALIDATED AGAINST FLIGHT DATA');assert.equal(report.sources.referenceValidation,'blocked');assert.ok(report.sources.sources.every(s=>s.eligibility!=='accepted'));
 assert.equal(report.documentedChecks.length,7);assert.ok(report.documentedChecks.every(c=>Number.isFinite(c.model)&&Number.isFinite(c.difference)&&c.scope.includes('not a flight-performance')));
 assert.equal(report.sources.sources.find(s=>s.id==='19790015808').eligibility,'design-reference');
 for(const [p,hash]of Object.entries(report.hashes))assert.equal(createHash('sha256').update(await readFile(new URL(p,import.meta.url))).digest('hex'),hash,p);
 const ids=new Set();for(const c of report.cases){const id=[c.mode,c.altitude,c.speed,c.maneuver].join('/');assert.ok(!ids.has(id));ids.add(id);assert.equal(c.samples.length,161);for(const [i,s]of c.samples.entries()){assert.equal(s.length,report.columns.length);assert.ok(Math.abs(s[0]-i*.05)<1e-8);assert.ok(s.every(Number.isFinite));}assert.ok(c.initial.mach<.8);assert.ok(c.initial.fuelKg>2200&&c.initial.fuelKg<2300);}
 const csv=(await readFile(new URL('./dist/validation/f15-traces.csv',import.meta.url),'utf8')).trim().split('\n');assert.equal(csv.length,13042);assert.equal(csv[0].split(',').length,17);assert.ok(csv.slice(1).every(line=>line.split(',').length===17));
});
