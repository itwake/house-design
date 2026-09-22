import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {insidePolygon} from '../walkthrough.js';
const d=JSON.parse(await readFile(new URL('../models/schemes/suite/design-data.json',import.meta.url),'utf8'));
const get=id=>d.furniture.find(f=>(f.id||f.name)===id);
const cases=[['bed_b','room_b',[12,55,210,145]],['次卧衣柜','room_b',[12,262,180,60]],['主卧衣柜','room_a',[325,12,60,224]],['bed_b_niche_console','room_b',[269,12,44,224]],['study_full_desk','room_c',[12,565,272,55]],['study_north_sofa','room_c',[48,334,200,85]]];
const affected=cases.map(([id,roomId,bounds])=>{
  const f=get(id);assert.ok(f,id);assert.deepEqual([f.x,f.y,f.w,f.d],bounds,id);
  const polygon=d.rooms.find(r=>r.id===roomId).points;
  for(const x of [f.x+.1,f.x+f.w-.1])for(const y of [f.y+.1,f.y+f.d-.1])assert.ok(insidePolygon(x,y,polygon),id+' outside its room');return f;
});
const overlaps=(a,b)=>a.x<b.x+b.w-1e-6&&a.x+a.w>b.x+1e-6&&a.y<b.y+b.d-1e-6&&a.y+a.d>b.y+1e-6;
for(const a of affected)for(const f of d.furniture)if(f!==a)assert.ok(!overlaps(a,f),a.name+' overlaps '+f.name);
for(const id of ['书房日床','书房客衣柜','1100书桌'])assert.ok(!get(id),'Removed '+id);
assert.equal(get('study_north_sofa').face,'south');
assert.equal(get('bed_b').headDirection,'west');assert.equal(get('bed_a').headDirection,'east');
assert.equal(get('bed_b_niche_console').x-get('bed_b').x-get('bed_b').w,47);
assert.equal(get('bed_a').x-get('主卧衣柜').x-get('主卧衣柜').w,80);
assert.equal(get('study_full_desk').y-get('study_north_sofa').y-get('study_north_sofa').d,146);
for(const o of d.doors.filter(o=>o.operation?.type==='hinged')){
  const h=o.operation,s=h.swing,L=o.widthMm/10-12;
  for(let deg=0;deg<=90;deg++)for(let r=0;r<=L;r++){
    const a=deg*Math.PI/180,x=h.hingeCm[0]+r*(s.dx*Math.cos(a)+s.ox*Math.sin(a)),y=h.hingeCm[1]+r*(s.dy*Math.cos(a)+s.oy*Math.sin(a));
    for(const f of affected)assert.ok(!(x>f.x-2&&x<f.x+f.w+2&&y>f.y-2&&y<f.y+f.d+2),o.id+' sweep touches '+f.name);
  }
}
const slide=d.doors.find(o=>o.id==='door_c').operation;
for(let t=0;t<=1;t+=.01){const p={...slide.panelCm,y:slide.panelCm.y+t*(slide.parkedCm.y-slide.panelCm.y)};for(const f of affected)assert.ok(!overlaps(p,f),'Study sliding path touches '+f.name);}
const catalog=JSON.parse(await readFile(new URL('../models/design-schemes.json',import.meta.url),'utf8'));
assert.deepEqual(d.appearance,catalog.schemes.find(s=>s.id==='suite').appearance);
assert.equal(d.appearance.preset,'soft-warm');
console.log('PASS fitted suite: 6 exact footprints inside rooms, flush cabinet ends, 470/800/1460mm gaps, no furniture overlap, sampled hinged and sliding paths clear; warm-white appearance synchronized. Not a construction clearance certification.');
