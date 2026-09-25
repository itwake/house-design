import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),cwd=fileURLToPath(root),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const d=await read('models/schemes/family/design-data.json'),base=await read('models/schemes/suite/design-data.json'),g=d.garage;
for(const key of ['rooms','walls','wallSpecs','doors','windows','bayFitouts','wallFitouts','appearance'])assert.deepEqual(d[key],base[key],'Inherited '+key);
const changed=new Set(['dining_sideboard','dining_sideboard_corner','dining_sideboard_return']);
for(const f of base.furniture){
 if(changed.has(f.id))continue;
 const now=d.furniture.find(p=>(p.id||p.name)===(f.id||f.name));
 if(/餐桌|餐椅/.test(f.name)){assert.deepEqual(now,{...f,x:f.x-25,y:f.y-95});}
 else assert.deepEqual(now,f,'Unchanged furniture '+f.name);
}
assert.equal(d.furniture.filter(f=>f.name.includes('餐椅')).length,4);
const overlaps=(a,b)=>Math.min(a.x+a.w,b.x+b.w)>Math.max(a.x,b.x)+.001&&Math.min(a.y+a.d,b.y+b.d)>Math.max(a.y,b.y)+.001;
const room=d.rooms.find(r=>r.id==='living'),changedObjects=d.furniture.filter(f=>/餐桌|餐椅/.test(f.name)||['family_sideboard','family_garage'].includes(f.id));
for(const a of changedObjects)for(const b of d.furniture)if(a!==b)assert.ok(!overlaps(a,b),a.name+' overlaps '+b.name);
assert.equal(g.w*g.d/10000,g.metrics.footprintM2);
assert.equal(g.opening.y2-g.opening.y1,g.opening.clearWidthCm);
assert.equal(495-(g.x+g.w),g.metrics.entryAisleCm);
const southChair=d.furniture.find(f=>f.name==='餐椅南1');
assert.equal(g.y-(southChair.y+southChair.d+30),g.metrics.southChairPulledGapCm);
for(const item of g.items){
 assert.ok(item.x>=g.inner.x&&item.x+item.w<=g.inner.x+g.inner.w&&item.y>=g.inner.y&&item.y+item.d<=g.inner.y+g.inner.d,'Stored envelope fits '+item.id);
 assert.ok(item.y>=g.opening.y1&&item.y+item.d<=g.opening.y2,'Door opening clears '+item.id);
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
let poses=0;
function pose(item,cx,cy,angle=0,extra=[]){const shape=poly(cx,cy,item.w,item.d,angle);for(const p of [...fixed,...extra])assert.ok(!hit(shape,p.shape),`Vehicle collision ${item.id}: ${p.id} at ${cx},${cy},${angle}`);poses++;}
const bike=g.items[0],stroller=g.items[1];
for(const item of g.items){
 const other=g.items.find(o=>o!==item),block={id:'other parked vehicle',shape:poly(other.x+other.w/2,other.y+other.d/2,other.w,other.d)};
 const cy=item.y+item.d/2,targetX=item.id==='child_bike'?445:435;
 for(let cx=item.x+item.w/2;cx<=targetX;cx+=1)pose(item,cx,cy,0,[block]);
 for(let deg=0;deg<=90;deg+=1)pose(item,targetX,cy,deg*Math.PI/180);
 // Keep the entry door closed while turning, then move north out of its sweep.
 for(let yy=cy;yy>=1225;yy-=1)pose(item,targetX,yy,Math.PI/2);
 const parked=poly(targetX,1225,item.w,item.d,Math.PI/2);
 for(let deg=0;deg<=90;deg++){
  const a=deg*Math.PI/180,door=poly(490-50*Math.cos(a),1395-50*Math.sin(a),100,4,a);
  assert.ok(!hit(parked,door),'Park vehicle north before opening entry door');
 }
}
// Explicitly retain all prior source/model/render bytes from the published version.
const baseline='5a13e8b',tree=execFileSync('git',['ls-tree','-r',baseline,'models','assets'],{cwd,encoding:'utf8'}).trim().split('\n').map(line=>{const [meta,path]=line.split('\t');return {path,sha:meta.split(' ')[2]}}).filter(p=>p.path!=='models/design-schemes.json');
const hashes=execFileSync('git',['hash-object','--stdin-paths'],{cwd,encoding:'utf8',input:tree.map(p=>p.path).join('\n')+'\n'}).trim().split('\n');
tree.forEach((p,i)=>assert.equal(hashes[i],p.sha,'Preserve existing asset '+p.path));
console.log(`PASS family storage: inherited shell/rooms/furniture protected, four dining chairs, two vehicle envelopes, ${poses} sampled extraction/rotation poses, ${tree.length} old assets byte-identical. Vehicle test excludes user body and unspecified real hardware.`);
