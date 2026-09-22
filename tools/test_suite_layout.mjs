// New-layout topology and actual shared navigation. No duplicate walk engine.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildWalkWorld,findWalkStart,WALK_STARTS,insidePolygon} from '../walkthrough.js';
const root=new URL('../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const base=await read('models/design-data.json'),d=await read('models/schemes/suite/design-data.json');
const equal=(a,b,label)=>assert.deepEqual(a,b,label);
for(const w of [[319,6,319,242],[275,242,380,242],[380,242,380,493]])assert.ok(d.walls.some(v=>v.join()===w.join()),'Approved upper wall and retained return '+w);
for(const key of ['envelope','storageFitouts'])equal(d[key],base[key],key+' preserved');
equal(d.windows.filter(w=>w.id!=='window_kitchen_balcony'),base.windows,'All existing windows preserved');
assert.equal(d.windows.filter(w=>w.id==='window_kitchen_balcony').length,1,'Exactly one kitchen–balcony window added');
for(const fitout of d.bayFitouts)for(const part of fitout.parts){const old=base.bayFitouts.find(f=>f.id===fitout.id).parts.find(p=>p.id===part.id);equal(part,part.id==='l_adult_chair'?{...old,y:old.y+15}:old,'Bay part '+part.id);}
equal(d.bayFitouts.find(f=>f.roomId==='room_a').parts,[],'Master desk AND chair removed only in new layout');
assert.equal(d.bayFitouts.find(f=>f.roomId==='room_a').type,'bare_ledge');
for(const f of base.furniture)if(!['vanity_main','vanity_guest','书房办公椅','主卧衣柜','主卫壁挂马桶','1100书桌','bed_b','次卧衣柜','书房日床','书房客衣柜'].includes(f.id||f.name))equal(d.furniture.find(x=>(x.id||x.name)===(f.id||f.name)),f,'No unrelated furniture move: '+f.name);
assert.equal(d.layout.revision,'Fitted');assert.equal(d.rooms.find(r=>r.id==='room_c').modelAreaM2,7.7792);
assert.equal(d.doors.find(o=>o.id==='door_a').operation.type,'hinged');
assert.equal(d.doors.find(o=>o.id==='door_c').operation.type,'surface-sliding');
equal(d.doors.find(o=>o.id==='door_b').connects,['living','room_b']);
assert.equal(d.doors.find(o=>o.id==='door_b').x1,275);
equal(d.doors.find(x=>x.id==='door_kitchen'),base.doors.find(x=>x.id==='door_kitchen'));
for(const door of d.doors){
  const segments=d.walls.filter(([a,b,c,e])=>door.x1===door.x2?a===c&&a===door.x1&&door.y1>=b&&door.y2<=e:b===e&&b===door.y1&&door.x1>=a&&door.x2<=c);
  assert.equal(segments.length,1,door.id+' must cut exactly one wall');
}
for(const door of d.doors.filter(d=>d.connects)){
  const vertical=door.x1===door.x2,cx=(door.x1+door.x2)/2,cy=(door.y1+door.y2)/2;
  const side=[-1,1].map(sign=>d.rooms.find(r=>insidePolygon(cx+(vertical?sign*9:0),cy+(vertical?0:sign*9),r.points))?.id).sort();
  equal(side,[...door.connects].sort(),'Actual room polygons on door sides '+door.id);
}
const world=buildWalkWorld(d);
const start=findWalkStart(world,'living',{x:4.3,z:13});assert.ok(start);
const key=(x,z)=>`${x},${z}`;
function flood(blocked=[],radius=.25,step=.05){
  const copy=structuredClone(d);copy.doors=copy.doors.filter(o=>!blocked.includes(o.id));const w=buildWalkWorld(copy);
  const sx=Math.round(start.x/step),sz=Math.round(start.z/step),seen=new Set([key(sx,sz)]),queue=[[sx,sz]],reached=new Set();
  for(let i=0;i<queue.length;i++){
    const [x,z]=queue[i];reached.add(w.roomAt(x*step,z*step));
    for(const [nx,nz]of [[x+1,z],[x-1,z],[x,z+1],[x,z-1]])if(!seen.has(key(nx,nz))&&w.canStand(nx*step,nz*step,radius)){seen.add(key(nx,nz));queue.push([nx,nz]);}
  }
  return {seen,reached};
}
const all=flood();for(const room of d.rooms)assert.ok(all.reached.has(room.id),'Room reachable from entry: '+room.id);
const larger=flood([],.30,.025);for(const room of d.rooms)assert.ok(larger.reached.has(room.id),'600mm envelope reaches room with hinged leaves treated open: '+room.id);
const closedSuite=flood(['door_a']);assert.ok(!closedSuite.reached.has('room_a')&&!closedSuite.reached.has('bath_1'),'One main entrance secures BOTH sleeping space and main bath');
for(const id of ['room_b','room_c','bath_2','living','kitchen','balcony'])assert.ok(closedSuite.reached.has(id),'Independent access remains: '+id);
const closedBath=flood(['door_bath_1']);assert.ok(closedBath.reached.has('room_a')&&!closedBath.reached.has('bath_1'),'Sleeping area never requires crossing bath');
for(const [id,point]of Object.entries(WALK_STARTS)){const p=findWalkStart(world,id,{x:point[0],z:point[1]});assert.ok(p&&world.canStand(p.x,p.z),'Safe scheme-specific revalidated walk start '+id);}
// No floor is shared between rooms. Door thresholds / wall footprints are not
// included in this small-grid floor area test.
for(let x=2;x<841;x+=3)for(let y=2;y<1401;y+=3){const owners=d.rooms.filter(r=>insidePolygon(x,y,r.points));assert.ok(owners.length<=1,`Floor overlap ${x},${y}: ${owners.map(r=>r.id)}`);}
for(const o of d.doors.filter(o=>o.operation))assert.ok(world.obstacles.some(x=>x.id===o.id+'-open-leaf'),'Physical open leaf in walk collision '+o.id);
console.log(`PASS fitted suite: restored upper partition, retained entry return and study, physical open door leaves, ${all.seen.size} connected 50mm navigation samples and ${larger.seen.size} connected 25mm samples with 600mm envelope, 8 accessible rooms, private suite isolation and independent B/C/guest-bath access. Not a construction compliance assessment.`);
