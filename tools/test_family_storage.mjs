import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),cwd=fileURLToPath(root),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const d=await read('models/schemes/family/design-data.json'),base=await read('models/schemes/suite/design-data.json'),g=d.garage;
const entryChanged=Boolean(d.familyEntryRevision);
const mergedLaundry=Boolean(d.familyLaundryRevision);
if(mergedLaundry){
 assert.equal(d.familyLaundryRevision.version,'3.5.0');
 assert.equal(d.familyLaundryRevision.baselineCommit,'9e9a10f');
 await import('./test_family_laundry.mjs'); // Exact allowed changes and merged clearance are checked, not silently skipped.
}
for(const key of ['rooms','walls','wallSpecs','doors','windows','bayFitouts','wallFitouts','appearance']){
 if(mergedLaundry&&['rooms','walls','wallSpecs','doors'].includes(key))continue;
 assert.deepEqual(d[key],base[key],'Inherited '+key);
}
const changed=new Set(['dining_sideboard','dining_sideboard_corner','dining_sideboard_return']);
if(mergedLaundry)for(const name of ['洗烘塔','阳台家政柜','三人沙发','茶几','电视薄柜'])changed.add(name);
for(const f of base.furniture){
 if(changed.has(f.id)||changed.has(f.name))continue;
 const now=d.furniture.find(p=>(p.id||p.name)===(f.id||f.name));
 if(/餐桌|餐椅/.test(f.name)){assert.deepEqual(now,{...f,x:f.x+(entryChanged?-10:-25),y:f.y+(entryChanged?0:-95)});}
 else assert.deepEqual(now,f,'Unchanged furniture '+f.name);
}
assert.equal(d.furniture.filter(f=>f.name.includes('餐椅')).length,4);
let poses=0;
if(entryChanged){
 await import('./test_family_entry.mjs');
}else{
const overlaps=(a,b)=>Math.min(a.x+a.w,b.x+b.w)>Math.max(a.x,b.x)+.001&&Math.min(a.y+a.d,b.y+b.d)>Math.max(a.y,b.y)+.001;
const room=d.rooms.find(r=>r.id==='living'),changedObjects=d.furniture.filter(f=>/餐桌|餐椅/.test(f.name)||['family_sideboard','family_garage'].includes(f.id));
for(const a of changedObjects)for(const b of d.furniture)if(a!==b)assert.ok(!overlaps(a,b),a.name+' overlaps '+b.name);
// Conservative front folding zone. This is not a real hinge/track simulation.
const foldSweep={x:g.inner.x,y:g.y-g.inner.w/4,w:g.inner.w,d:g.inner.w/4};
for(const f of [...d.furniture.filter(f=>!f.garageFitoutId),...g.items])assert.ok(!overlaps(foldSweep,f),'Outward folded-door zone intersects '+(f.name||f.id));
assert.equal(g.w*g.d/10000,g.metrics.footprintM2);
assert.equal(g.face,'north');
assert.equal(g.doorFoldDirection,'outward');
assert.equal(g.parts.filter(p=>p.role==='folded-door').length,4);
for(const p of g.parts.filter(p=>p.role==='folded-door'))assert.ok(p.y+p.d<=g.y,'Folded leaves stay outside parked-vehicle volume');
assert.deepEqual([g.w,g.d],[150,120]);
assert.equal(g.opening.x2-g.opening.x1,g.opening.clearWidthCm);
assert.ok(g.metrics.footprintM2<2.445*.75,'Reduce old footprint by at least one quarter');
assert.equal(d.furniture.find(f=>f.id==='family_sideboard').y,1099);
assert.equal(495-(g.x+g.w),g.metrics.entryAisleCm);
const southChair=d.furniture.find(f=>f.name==='餐椅南1');
assert.equal(g.y-(southChair.y+southChair.d+30),g.metrics.southChairPulledGapCm);
for(const item of g.items){
 assert.ok(item.x>=g.inner.x&&item.x+item.w<=g.inner.x+g.inner.w&&item.y>=g.inner.y&&item.y+item.d<=g.inner.y+g.inner.d,'Stored envelope fits '+item.id);
 assert.ok(item.x>=g.opening.x1&&item.x+item.w<=g.opening.x2,'North door opening clears '+item.id);
 assert.equal(item.rotationDeg,90);
 assert.equal(item.w,item.modelDepthCm);assert.equal(item.d,item.modelWidthCm);
 assert.ok(item.hCm<g.shelves[0].zCm,'Upper shelf clears '+item.id);
 for(const other of g.items)if(other!==item)assert.ok(!overlaps(item,other));
 for(const p of g.parts)if(p.zCm<item.hCm&&p.role!=='roof')assert.ok(!overlaps(item,p),'Vehicle intersects part '+p.id);
}
// 2D swept vehicle-envelope check, not a body/handle manoeuvring certificate.
function poly(x,y,w,h,angle=0){const c=Math.cos(angle),s=Math.sin(angle);return [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([a,b])=>[x+a*c-b*s,y+a*s+b*c]);}
function hit(a,b){
 for(const points of [a,b])for(let i=0;i<4;i++){
  const p=points[i],q=points[(i+1)%4],axis=[q[1]-p[1],p[0]-q[0]];
  const aa=a.map(p=>p[0]*axis[0]+p[1]*axis[1]),bb=b.map(p=>p[0]*axis[0]+p[1]*axis[1]);
  if(Math.min(...aa)>=Math.max(...bb)-1e-6||Math.min(...bb)>=Math.max(...aa)-1e-6)return false;
 }return true;
}
const fixed=d.furniture.filter(f=>!f.garageFitoutId).map(f=>({id:f.name,shape:poly(f.x+f.w/2,f.y+f.d/2,f.w,f.d)}));
for(const p of g.parts.filter(p=>p.zCm<105))fixed.push({id:p.id,shape:poly(p.x+p.w/2,p.y+p.d/2,p.w,p.d)});
// Relevant complete room boundary; kitchen has a real door but we don't use it.
fixed.push({id:'west wall',shape:poly(206,1200,12,450)},{id:'kitchen wall envelope',shape:poly(536,1260,12,290)},{id:'south wall left',shape:poly(296,1395,188,12)},{id:'south wall right',shape:poly(663,1395,346,12)});
function pose(item,cx,cy,angle=0,extra=[]){const shape=poly(cx,cy,item.w,item.d,angle);for(const p of [...fixed,...extra])assert.ok(!hit(shape,p.shape),`Vehicle collision ${item.id}: ${p.id} at ${cx},${cy},${angle}`);poses++;}
const bike=g.items[0],stroller=g.items[1];
for(const item of g.items){
 const other=g.items.find(o=>o!==item),block={id:'other parked vehicle',shape:poly(other.x+other.w/2,other.y+other.d/2,other.w,other.d)};
 const cx=item.x+item.w/2,cy=item.y+item.d/2,targetY=g.y-2-item.d/2,targetX=435;
 // Each north-facing lane can extract with the other vehicle still parked.
 // South dining chairs must be tucked (their model pose), not pulled 300 mm.
 for(let yy=cy;yy>=targetY;yy-=1)pose(item,cx,yy,0,[block]);
 pose(item,cx,targetY,0,[block]);
 for(let xx=cx;xx<=targetX;xx+=1)pose(item,xx,targetY,0,[block]);
 pose(item,targetX,targetY,0,[block]);
 for(let deg=0;deg<=90;deg+=1)pose(item,targetX,targetY,deg*Math.PI/180,[block]);
 const parked=poly(targetX,targetY,item.w,item.d,Math.PI/2);
 for(let deg=0;deg<=90;deg++){
  const a=deg*Math.PI/180,door=poly(490-50*Math.cos(a),1395-50*Math.sin(a),100,4,a);
  assert.ok(!hit(parked,door),'Park vehicle north before opening entry door');
 }
}
}
// Every other scheme, historical asset and family texture remains byte-identical.
const activeRefresh=/^(?:models\/schemes\/family\/(?:design-data\.json|scene-manifest\.json|huiyayuan-wood\.(?:blend|glb))|assets\/schemes\/family\/[^/]+\.jpg)$/;
const baseline=entryChanged?'0466fda':'ac2b91d366b8aeb0f53744b03b1ca48f95e95fdc',tree=execFileSync('git',['ls-tree','-r',baseline,'models','assets'],{cwd,encoding:'utf8'}).trim().split('\n').map(line=>{const [meta,path]=line.split('\t');return {path,sha:meta.split(' ')[2]}}).filter(p=>p.path!=='models/design-schemes.json'&&!activeRefresh.test(p.path));
const hashes=execFileSync('git',['hash-object','--stdin-paths'],{cwd,encoding:'utf8',input:tree.map(p=>p.path).join('\n')+'\n'}).trim().split('\n');
tree.forEach((p,i)=>assert.equal(hashes[i],p.sha,'Preserve existing asset '+p.path));
console.log(`PASS family storage: inherited shell/rooms/furniture protected, four dining chairs, two vehicle envelopes, ${entryChanged?'current two-level entrance regression':poses+' sampled extraction/rotation poses'}, ${tree.length} old assets byte-identical. Vehicle test excludes user body and unspecified real hardware.`);
