// Exact scope test against the last published revision, not a hand-drawn plan.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const ids=['wood','suite','family','laundry'],baseline='c2e5a5f399709185b2e843c64e622a0373927602';
const removed=['l_desktop','l_support','l_accessories','l_adult_chair','l_child_chair'];
const catalog=JSON.parse(await readFile('models/design-schemes.json','utf8'));
assert.equal(catalog.version,'3.4.1');
for(const id of ids){
 const path=`models/schemes/${id}/design-data.json`,now=JSON.parse(await readFile(path,'utf8'));
 const old=JSON.parse(execFileSync('git',['show',baseline+':'+path],{encoding:'utf8'}));
 for(const key of ['rooms','walls','doors','windows','furniture','wallFitouts','storageFitouts','laundry','garage','modelAddons','appearance'])assert.deepEqual(now[key],old[key],id+': no unrelated change '+key);
 for(const b of now.bayFitouts){const before=old.bayFitouts.find(f=>f.id===b.id);if(b.roomId!=='living')assert.deepEqual(b,before,id+': other bay unchanged');else{
  assert.deepEqual(b.parts,before.parts.filter(p=>!removed.includes(p.id)),id+': exactly five parts removed');
  assert.equal(b.type,'clear_ledge');assert.ok(b.summary.includes('900mm')&&b.summary.includes('旧占位'));
  assert.ok(b.references.includes('living-window-child-safety'));
 }}
 assert.equal(now.livingBayRevision.measured,false);assert.equal(catalog.schemes.find(s=>s.id===id).assetRevision,'3.4.1');
 console.log('PASS '+id+': only requested living-bay furniture removed; all room/window/wardrobe/kitchen/laundry geometry unchanged.');
}
for(const path of ['index.html','studio.html','studio.js']){const text=await readFile(path,'utf8');assert.ok(!text.includes('客厅保留双人长桌')&&!text.includes('窗边一起学习'),path+': no stale desk promise');}
