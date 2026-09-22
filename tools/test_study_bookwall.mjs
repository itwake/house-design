import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {insidePolygon,buildWalkWorld} from '../walkthrough.js';
const path='models/schemes/suite/design-data.json';
const d=JSON.parse(await readFile(path,'utf8'));
const old=JSON.parse(execFileSync('git',['show',`e82b36022e24d1b3eff27d0326b9f5adc376faa3:${path}`],{encoding:'utf8'}));
for(const key of ['walls','wallSpecs','windows','doors','furniture','bayFitouts','storageFitouts','layout','appearance','envelope'])assert.deepEqual(d[key],old[key],'Preserve approved '+key);
for(const r of d.rooms)assert.deepEqual(r,old.rooms.find(v=>v.id===r.id),'Unchanged room '+r.id);
const fit=d.wallFitouts[0],desk=d.furniture.find(f=>f.id==='study_full_desk');
assert.equal(d.wallFitouts.length,1);assert.equal(fit.id,'study_bookwall');
const room=d.rooms.find(r=>r.id==='room_c');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
for(const p of fit.parts){
  for(const [k,size]of [['x','w'],['y','d'],['zCm','hCm']])assert.ok(p[k]>=fit[k]-1e-7&&p[k]+p[size]<=fit[k]+fit[size]+1e-7,`${p.id} outside ${k} envelope`);
  for(const x of [p.x+.0001,p.x+p.w-.0001])for(const y of [p.y+.0001,p.y+p.d-.0001])assert.ok(insidePolygon(x,y,room.points),'Part outside room '+p.id);
  assert.ok(p.x>=desk.x-1e-7&&p.x+p.w<=desk.x+desk.w+1e-7&&p.y>=desk.y&&p.y+p.d<=desk.y+desk.d+1e-7,'Only above existing desk '+p.id);
}
assert.equal(fit.parts.filter(p=>p.role==='door').length,6);
assert.equal(fit.parts.filter(p=>p.role==='upright').length,7);
assert.equal(fit.parts.filter(p=>p.role==='shelf').length,24);
const shelf=fit.parts.find(p=>p.role==='shelf');near(shelf.w,(272-7*2.2)/6);near(shelf.zCm-76,70);
assert.ok(fit.zCm-76>=69,'Underside diffuser clears desktop');
for(const p of fit.parts.filter(p=>p.role==='book')){
  const support=fit.parts.find(s=>s.role==='shelf'&&Math.abs(s.zCm+s.hCm-p.zCm)<1e-6&&p.x>=s.x&&p.x+p.w<=s.x+s.w&&p.y>=s.y&&p.y+p.d<=s.y+s.d);
  assert.ok(support,'Book must rest on actual shelf '+p.id);
}
// Cabinet pieces must touch, never overlap (book labels / pulls intentionally
// meet their backing surfaces). This catches face panels crossing uprights.
const boards=fit.parts.filter(p=>['upright','shelf','back','door'].includes(p.role));
const overlap=(a,b)=>['x','y','zCm'].every((k,i)=>Math.min(a[k]+a[['w','d','hCm'][i]],b[k]+b[['w','d','hCm'][i]])-Math.max(a[k],b[k])>1e-6);
for(let i=0;i<boards.length;i++)for(const p of boards.slice(i+1))assert.ok(!overlap(boards[i],p),'Cabinet intersection: '+boards[i].id+'/'+p.id);
assert.deepEqual(buildWalkWorld(d).obstacles,buildWalkWorld(old).obstacles,'No new floor obstacle or door obstruction');
assert.equal(fit.references.length,3);assert.ok(fit.references.every(r=>r.url.startsWith('https://')));
console.log(`PASS bookwall: ${fit.parts.length} actual parts inside room/above desk, 6 supported modules, books on shelves, no panel intersections, 700mm desk gap; all old walls/windows/furniture/walk obstacles preserved. Structural loads unverified.`);
