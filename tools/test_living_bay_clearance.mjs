// Exact scope of the user-authorized low-bay estimate against V3.4.1.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const ids=['wood','suite','family','laundry'],baseline='647d219fdc52e0bc71810f6a8e2daa97135be0cc';
const removed=['l_desktop','l_support','l_accessories','l_adult_chair','l_child_chair'];
const catalog=JSON.parse(await readFile('models/design-schemes.json','utf8'));
assert.equal(catalog.version,'3.4.2');
for(const id of ids){
 const path=`models/schemes/${id}/design-data.json`,now=JSON.parse(await readFile(path,'utf8'));
 const old=JSON.parse(execFileSync('git',['show',baseline+':'+path],{encoding:'utf8'}));
 for(const key of ['envelope','rooms','walls','wallSpecs','doors','furniture','wallFitouts','storageFitouts','laundry','garage','modelAddons','appearance'])assert.deepEqual(now[key],old[key],id+': no unrelated change '+key);
 for(const w of now.windows){const before=old.windows.find(x=>x.id===w.id);if(w.id!=='window_living_west')assert.deepEqual(w,before);else{
  for(const k of ['x1','y1','x2','y2','bay','widthMm','grade','windowType'])assert.deepEqual(w[k],before[k]);
  assert.equal(w.sillCm,40);assert.equal(w.heightCm,190);assert.equal(w.sillCm+w.heightCm,before.sillCm+before.heightCm);
  assert.ok(w.designScenario.includes('暂估')&&w.designScenario.includes('不是'));
 }}
 for(const f of now.bayFitouts){const before=old.bayFitouts.find(x=>x.id===f.id);if(f.roomId!=='living')assert.deepEqual(f,before);else{
  assert.equal(f.type,'low_lounge');assert.equal(f.parts.length,2);
  assert.deepEqual(f.parts.map(p=>p.id),['l_seat_pad_north','l_seat_pad_south']);
  for(const p of f.parts){assert.equal(p.role,'seat_cushion');assert.equal(p.zCm,40);assert.equal(p.hCm,5);assert.equal(p.w,55);assert.equal(p.d,96);assert.equal(p.x,148);assert.ok(p.x+p.w<=206);assert.ok(p.y>=647&&p.y+p.d<=847);assert.ok(!removed.includes(p.id));}
  assert.equal(f.parts[1].y-f.parts[0].y-f.parts[0].d,2);assert.ok(f.summary.includes('非')||f.summary.includes('不是'));
 }}
 assert.equal(now.livingBayRevision.measured,false);assert.equal(now.livingBayRevision.estimateAuthorized,true);
 assert.equal(catalog.schemes.find(s=>s.id===id).assetRevision,'3.4.2');
 console.log('PASS '+id+': 400 mm living sill + two 50 mm pads; only targeted bay changes; unrelated geometry and wardrobes preserved.');
}
for(const path of ['index.html','studio.html','studio.js']){const text=await readFile(path,'utf8');assert.ok(!text.includes('窗边一起学习')&&!text.includes('客厅窗台900mm为旧占位'),path+': no stale high-sill promise');}
