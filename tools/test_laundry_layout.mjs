// Source-level dimensions and scope; the separate GLB audit decodes real meshes.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildWalkWorld,findWalkStart,advanceWalk} from '../walkthrough.js';
const root=new URL('../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const catalog=await read('models/design-schemes.json'),d=await read('models/schemes/laundry/design-data.json'),s=await read('models/schemes/suite/design-data.json'),family=await read('models/schemes/family/design-data.json');
assert.deepEqual(catalog.schemes.map(s=>s.id),['wood','suite','family','laundry']);
for(const key of ['envelope','bayFitouts','wallFitouts','storageFitouts','appearance'])assert.deepEqual(d[key],s[key],key+' must stay scheme2');
for(const r of d.rooms.filter(r=>!['living','balcony'].includes(r.id)))assert.deepEqual(r.points,s.rooms.find(v=>v.id===r.id).points,'Bedroom/bath/kitchen polygon preserved '+r.id);
for(const [i,w]of s.walls.entries())if(i!==8)assert.deepEqual(d.walls[i],w,'Only balcony internal partition moves');
assert.deepEqual(d.walls[8],[652.25,960,652.25,1121]);assert.deepEqual(d.walls.at(-1),[652.25,960,681,960]);
for(const door of s.doors.filter(v=>v.id!=='balcony_door'))assert.deepEqual(d.doors.find(v=>v.id===door.id),door);
for(const sc of catalog.schemes){const source=await read(sc.geometrySource);assert.deepEqual(source.windows.find(w=>w.id==='window_kitchen_balcony'),family.windows.find(w=>w.id==='window_kitchen_balcony'),'All active kitchens share window');for(const name of ['厨房北侧地柜','厨房南侧地柜','冰箱高柜','蒸烤高柜'])assert.deepEqual(source.furniture.find(f=>f.name===name),family.furniture.find(f=>f.name===name),'Kitchen fixture '+name);}
for(const f of s.furniture.filter(f=>!['洗烘塔','阳台家政柜','三人沙发','茶几','电视薄柜'].includes(f.name)))assert.deepEqual(d.furniture.find(v=>(v.id||v.name)===(f.id||f.name)),f,'Unrelated furniture preserved '+f.name);
assert.ok(!d.garage);assert.ok(!d.furniture.some(f=>f.name==='洗烘塔'));
const l=d.laundry,near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7),overlap=(a,b)=>Math.min(a.x+a.w,b.x+b.w)>Math.max(a.x,b.x)+.001&&Math.min(a.y+a.d,b.y+b.d)>Math.max(a.y,b.y)+.001;
const door=d.doors.find(v=>v.id==='balcony_door');near(door.x1-door.sliding.frameDepthCm/2,l.bookcase.x);near(l.bookcase.x,645);assert.equal(door.sliding.stackTo,'south');
near(l.counter.y-966,l.metrics.operationAisleCm);near(l.bookcase.x-(d.furniture.find(f=>f.name==='三人沙发').x+220),70);
for(const m of l.machines){assert.equal(m.face,'north');assert.equal(m.heightCm,85);near(1115-m.y-m.d,10);near(l.basin.bottomCm-m.heightCm,3);assert.ok(m.x>=l.counter.x&&m.x+m.w<=l.counter.x+l.counter.w);for(const p of l.parts.filter(p=>p.zCm<m.heightCm&&p.zCm+p.hCm>0))assert.ok(!overlap(m,p),'Machine intersects support '+p.id);}
assert.ok(!overlap(...l.machines));
assert.ok(l.basin.drain.y-2.1>=1105,'Rear pipe outside appliance back');assert.ok(l.basin.tap.x+1.3<698,'Tap avoids actual kitchen window');
const world=buildWalkWorld(d);const start=findWalkStart(world,'balcony');assert.ok(start&&world.canStand(start.x,start.z));
const walked=advanceWalk(world,{x:6.1,z:10.0},1.25,0);near(walked.x,7.35);assert.equal(world.roomAt(walked.x,walked.z),'balcony','North entry band actually walkable');
const obstacles=world.obstacles;assert.ok(obstacles.find(o=>o.id==='balcony_door-parked-leaves').z>10.4,'Door parks south, not across entry band');
const lamp=obstacles.find(o=>o.id==='living-floor-lamp');near(lamp.x,3.13);near(lamp.z,8.53);
const lampPlan={x:313,y:853,w:44,d:44};
for(const f of [...d.furniture,...d.bayFitouts.flatMap(b=>b.parts.filter(p=>['chair','desktop'].includes(p.role)))])assert.ok(!overlap(lampPlan,f),'Moved lamp intersects furniture '+(f.name||f.id));
for(const name of ['三人沙发','茶几','电视薄柜']){
 const f=d.furniture.find(v=>v.name===name);
 for(const other of d.furniture.filter(v=>v!==f))assert.ok(!overlap(f,other),'Moved furniture overlap '+name+' / '+other.name);
}
// Every pre-existing source, model, texture and render stays byte-identical.
const baseline='60bfd694e9231216dc49de2c38cfaf91a02773bf',cwd=fileURLToPath(root);
const tree=execFileSync('git',['ls-tree','-r',baseline,'models','assets'],{cwd,encoding:'utf8'}).trim().split('\n').map(line=>{const [meta,path]=line.split('\t');return {path,sha:meta.split(' ')[2]}}).filter(v=>v.path!=='models/design-schemes.json');
const hashes=execFileSync('git',['hash-object','--stdin-paths'],{cwd,encoding:'utf8',input:tree.map(v=>v.path).join('\n')+'\n'}).trim().split('\n');
tree.forEach((v,i)=>assert.equal(hashes[i],v.sha,'Existing asset preserved '+v.path));
console.log(`PASS laundry source: A ground appliances, true shallow basin clearance/rear service, B/C alignment, walkable north entrance, kitchen shared across four schemes; ${tree.length} old assets untouched.`);
