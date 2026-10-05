// Current family entrance: verify the source, shared navigation, and optionally
// actual GLB vertices. Storage is deliberately two levels, not two floor bays.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as THREE from '../vendor/three/three.module.js';
import {buildWalkWorld,findWalkStart,advanceWalk} from '../walkthrough.js';
const root=new URL('../',import.meta.url),cwd=fileURLToPath(root);
const read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const d=await read('models/schemes/family/design-data.json'),g=d.garage;
if(d.familyPublicP2Revision?.version==='3.11.0'){
  await (await import('./test_family_public_p2.mjs')).ensureFamilyPublicP2({glb:process.argv.includes('--glb')});
  await import('./test_purchased_furniture.mjs');
}else if(d.familyR3Revision?.version==='3.10.0'){
  await (await import('./test_family_r3.mjs')).ensureFamilyR3({glb:process.argv.includes('--glb')});
  await import('./test_purchased_furniture.mjs');
}else if(d.familyFlowRevision){
  // Keep importers alive: test_family_storage continues its inherited asset QA.
  await import('./test_family_flow.mjs');
}else{
const baseline='0466fda',base=JSON.parse(execFileSync('git',['show',baseline+':models/schemes/family/design-data.json'],{cwd,encoding:'utf8'}));
const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-7,message||`${actual} != ${expected}`);
const geometry=f=>[f.x,f.y,f.w,f.d],fixture=name=>d.furniture.find(f=>f.name===name);
const overlap=(a,b)=>Math.min(a.x+a.w,b.x+b.w)>Math.max(a.x,b.x)+1e-6&&Math.min(a.y+a.d,b.y+b.d)>Math.max(a.y,b.y)+1e-6;
const overlap3=(a,b)=>overlap(a,b)&&Math.min((a.zCm||0)+a.hCm,(b.zCm||0)+b.hCm)>Math.max(a.zCm||0,b.zCm||0)+1e-6;
assert.equal(d.familyEntryRevision.version,'3.5.1');
assert.equal(d.familyEntryRevision.baselineCommit,baseline);
for(const key of ['envelope','rooms','walls','wallSpecs','doors','windows','bayFitouts','wallFitouts','appearance','modelAddons'])assert.deepEqual(d[key],base[key],'Preserve '+key);
const laundryPhysical=l=>Object.fromEntries(Object.entries(l).filter(([key])=>!['conditions','dimensions','metrics'].includes(key)));
assert.deepEqual(laundryPhysical(d.laundry),laundryPhysical(base.laundry),'Preserve complete physical laundry design');
const laundryMetrics=l=>Object.fromEntries(Object.entries(l.metrics).filter(([key])=>key!=='sofaDiningChairGapCm'));
assert.deepEqual(laundryMetrics(d.laundry),laundryMetrics(base.laundry),'Preserve all unaffected laundry clearances');
near(d.laundry.metrics.sofaDiningChairGapCm,155.5,'Dining move updates the related gap, not unrelated balcony metrics');
assert.deepEqual(d.storageFitouts.find(f=>f.id==='entry_shoe_station'),base.storageFitouts.find(f=>f.id==='entry_shoe_station'),'Existing right shoe station unchanged');
const changed=f=>['family_garage','family_sideboard'].includes(f.id)||/餐桌|餐椅/.test(f.name||'');
for(const f of base.furniture.filter(f=>!changed(f)))assert.deepEqual(d.furniture.find(v=>(v.id||v.name)===(f.id||f.name)),f,'Preserve furniture '+f.name);
assert.deepEqual(geometry(g),[212,1320,150,65]);
assert.deepEqual([g.inner.x,g.inner.y,g.inner.w,g.inner.d],[214,1322,146,61]);
assert.equal(g.face,'east');
near(g.metrics.footprintM2,.975,'Exact compact footprint, not old 1.80 m2 claim');
near(g.y,fixture('玄关柜').y,'Garage and right shoe station north ends align');
near(g.y+g.d,fixture('玄关柜').y+fixture('玄关柜').d,'Garage and right shoe station south ends align');
near(g.opening.clearWidthCm,61);
for(const key of ['x','x1','x2'])if(g.opening[key]!==undefined)near(g.opening[key],362,'Opening is on east face');
near(g.opening.y1??g.opening.y,1322);
near(g.opening.y2??((g.opening.y1??g.opening.y)+g.opening.clearWidthCm),1383);
const leaf=g.parts.find(p=>p.role==='hinged-door'||p.role==='hinged-leaf'||p.id==='hinged-leaf');
assert.ok(leaf,'Real east-opening storage door');
assert.deepEqual(geometry(leaf),[362,1322,61,2.5]);
near(leaf.zCm,.8);near(leaf.hCm,241.2,'Storage open leaf matches its physical head clearance');
assert.equal(g.parts.filter(p=>p.role==='folded-door').length,0,'Old four-leaf north folding arrangement removed');
near(fixture('玄关柜').x-(leaf.x+leaf.w),72,'Open storage leaf leaves a tight 720 mm lateral path');
for(const f of d.furniture.filter(f=>!f.garageFitoutId))assert.ok(!overlap(leaf,f),'Storage leaf intersects '+f.name);
assert.equal(g.items.length,2);
const stroller=g.items.find(f=>f.kind==='folded-stroller'),bike=g.items.find(f=>f.kind==='child-bike');
assert.deepEqual(geometry(stroller),[238,1325,75,55]);
assert.deepEqual(geometry(bike),[220,1326,110,50]);
near(stroller.zCm||0,0);near(stroller.hCm,105);
near(bike.zCm,123);near(bike.hCm,75);
assert.ok(overlap(stroller,bike),'Vehicles intentionally share floor projection');
assert.ok(!overlap3(stroller,bike),'Vehicles must not share actual storage volume');
assert.ok(bike.w*bike.d+stroller.w*stroller.d>g.inner.w*g.inner.d,'Do not claim both original vehicle envelopes fit at floor level');
const support=g.parts.find(p=>p.role==='shelf'&&p.zCm===120);
assert.ok(support&&support.hCm===3,'Upper bicycle has a real independent 30 mm support at 1200 mm');
near(bike.zCm,support.zCm+support.hCm,'Bicycle rests on support, not floating');
for(const item of g.items){
  assert.equal(item.rotationDeg||0,0);
  assert.ok(item.x>=g.inner.x&&item.x+item.w<=g.inner.x+g.inner.w&&item.y>=g.inner.y&&item.y+item.d<=g.inner.y+g.inner.d,'Vehicle footprint fits '+item.id);
  assert.ok((item.zCm||0)+item.hCm<=242,'Vehicle fits vertically '+item.id);
  for(const part of g.parts)assert.ok(!overlap3(item,part),'Vehicle intersects physical garage part '+item.id+'/'+part.id);
}
assert.ok(g.conditions.some(t=>/抬|提|挂/.test(t)),'Explicit lifting/raised-storage limitation');
assert.ok(g.conditions.some(t=>/承重|载荷/.test(t)),'Support load is conditional, not structurally certified');
assert.ok(g.conditions.some(t=>t.includes('入户门')&&/关闭|收/.test(t)),'Storage operations require entry door to be collected/closed');
const cabinet=d.furniture.find(f=>f.id==='family_sideboard');
assert.deepEqual(geometry(cabinet),[212.5,859,40,461]);
near(cabinet.y+cabinet.d,g.y,'Sideboard fills wall up to garage north back');
const fitout=d.storageFitouts.find(f=>f.id==='dining_sideboard_wall');
assert.ok(fitout);
const lower=fitout.parts.filter(p=>p.role==='sideboard_base').sort((a,b)=>a.y-b.y);
assert.equal(lower.length,4,'Four practical cabinet modules, not one 4.61 m door');
assert.deepEqual(lower.map(p=>p.d),[120,120,120,101]);
let edge=859;
for(const p of lower){near(p.x,212.5);near(p.y,edge);near(p.w,40);near(p.hCm,85);assert.equal(p.doorStyle,'sliding');assert.equal(p.drawerPanels??p.drawerCount??0,0);edge+=p.d;}
near(edge,1320,'No gaps in full west sideboard');
for(const p of fitout.parts.filter(p=>p.role==='upper_cabinet'))near(p.w,28,'Upper cabinets remain shallower than lower cabinets');
assert.deepEqual(geometry(fixture('四人餐桌')),[320,1110,120,70]);
assert.equal(d.furniture.filter(f=>f.name.includes('餐椅')).length,4);
for(const old of base.furniture.filter(f=>/餐桌|餐椅/.test(f.name))){const now=fixture(old.name);assert.deepEqual(now,{...old,x:old.x+15,y:old.y+95},'Translate entire dining group '+old.name);}
const changedFurniture=d.furniture.filter(changed);
for(const a of changedFurniture)for(const b of d.furniture)if(a!==b)assert.ok(!overlap(a,b),'Changed furniture collision '+a.name+'/'+b.name);
near(fixture('四人餐桌').x-(cabinet.x+cabinet.w),67.5,'Table / west cabinet gap');
near(530-(fixture('四人餐桌').x+fixture('四人餐桌').w),90,'East dining route to kitchen');
near(g.y-(fixture('餐椅南1').y+fixture('餐椅南1').d+30),52.5,'Pulled south chair clearance is tight and explicit');
const world=buildWalkWorld(d),doorCollision=world.obstacles.find(p=>p.id==='garage-hinged-leaf');
assert.ok(doorCollision,'Walk collision reflects opened east storage leaf');
assert.deepEqual([doorCollision.x,doorCollision.z,doorCollision.w,doorCollision.d],[3.62,13.22,.61,.025]);
assert.equal(world.obstacles.filter(o=>o.id.startsWith('garage-folded-leaf-')).length,0);
for(const room of d.rooms){const p=findWalkStart(world,room.id);assert.ok(p&&world.canStand(p.x,p.z),'Safe room entry '+room.id);}
const step=.05,grid=new Map(),key=(i,j)=>i+','+j;
for(let i=0;i<=169;i++)for(let j=0;j<=281;j++){const x=i*step,z=j*step;if(world.canStand(x,z))grid.set(key(i,j),{i,j,x,z});}
const revalidated=findWalkStart(world,'overall',{x:4.3,z:13});assert.ok(revalidated&&world.canStand(revalidated.x,revalidated.z),'Old overall seed is safely relocated away from the new storage hinge');
const start=grid.get(key(92,260));assert.ok(start,'Entrance corridor seed remains usable to the east of the opened storage door');
const queue=[start],seen=new Set([key(start.i,start.j)]),reached=new Set();
for(let head=0;head<queue.length;head++){
  const p=queue[head];reached.add(world.roomAt(p.x,p.z));
  for(const [di,dj]of [[1,0],[-1,0],[0,1],[0,-1]]){const k=key(p.i+di,p.j+dj),q=grid.get(k);if(!q||seen.has(k))continue;const moved=advanceWalk(world,p,q.x-p.x,q.z-p.z);if(Math.hypot(moved.x-q.x,moved.z-q.z)>1e-7)continue;seen.add(k);queue.push(q);}
}
assert.deepEqual([...reached].filter(Boolean).sort(),world.rooms.map(r=>r.id).sort(),'All eight rooms remain reachable, not merely individually spawnable');
// The thin northern door parks above the vehicle extraction band. This checks
// rigid source envelopes only; lifted handling/entry-door swing is not certified.
let takeoutPoses=0;
for(const item of g.items){
  for(let x=item.x;x<=g.x+g.w+1;x+=1){
    const moved={...item,x};
    for(const p of g.parts)assert.ok(!overlap3(moved,p),'East extraction intersects '+item.id+'/'+p.id);
    for(const f of d.furniture.filter(f=>!f.garageFitoutId))assert.ok(!overlap(moved,f),'East extraction intersects furniture '+item.id+'/'+f.name);
    takeoutPoses++;
  }
}
const catalog=await read('models/design-schemes.json'),scheme=catalog.schemes.find(s=>s.id==='family');
assert.equal(scheme.assetRevision,'3.5.1');
if(process.argv.includes('--glb')){
  const diningLight=name=>/^(Dining pendant ceiling rose|Pendant thin suspension|Organic linen pendant|Pendant opal diffuser)(?:[ ._]|$)/.test(name);
  function decode(bytes,normalizeDining=false){
    const length=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+length)),bin=bytes.subarray(28+length),parents=new Map(),matrices=new Map();
    g.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parents.set(c,i)));
    const matrix=i=>{if(matrices.has(i))return matrices.get(i);const n=g.nodes[i],m=new THREE.Matrix4();if(n.matrix)m.fromArray(n.matrix);else m.compose(new THREE.Vector3(...(n.translation||[0,0,0])),new THREE.Quaternion(...(n.rotation||[0,0,0,1])),new THREE.Vector3(...(n.scale||[1,1,1])));if(parents.has(i))m.premultiply(matrix(parents.get(i)));matrices.set(i,m);return m;};
    return g.nodes.flatMap((n,i)=>{
      if(n.mesh===undefined)return [];
      const meta={};for(let p=i;p!==undefined;p=parents.get(p))for(const [k,v]of Object.entries(g.nodes[p].extras||{}))if(meta[k]===undefined)meta[k]=v;
      const bounds=new THREE.Box3(),triangles=[],lightVertices=[],lightIndices=[];
      for(const primitive of g.meshes[n.mesh].primitives){
        assert.equal(primitive.mode??4,4);const a=g.accessors[primitive.attributes.POSITION],v=g.bufferViews[a.bufferView],offset=(a.byteOffset||0)+(v.byteOffset||0),stride=v.byteStride||12,points=[];
        assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');
        for(let k=0;k<a.count;k++){const p=offset+k*stride,point=new THREE.Vector3(bin.readFloatLE(p),bin.readFloatLE(p+4),bin.readFloatLE(p+8)).applyMatrix4(matrix(i));bounds.expandByPoint(point);if(normalizeDining&&diningLight(n.name))point.add(new THREE.Vector3(-.15,0,-.95));if(diningLight(n.name))lightVertices.push(point.toArray());points.push(point.toArray().map(value=>Math.round(value/.00001)).join(','));}
        let indices;
        if(primitive.indices===undefined)indices=Array.from({length:a.count},(_,k)=>k);
        else{const index=g.accessors[primitive.indices],view=g.bufferViews[index.bufferView],start=(index.byteOffset||0)+(view.byteOffset||0),size={5121:1,5123:2,5125:4}[index.componentType],reader={5121:'readUInt8',5123:'readUInt16LE',5125:'readUInt32LE'}[index.componentType];assert.ok(size);indices=Array.from({length:index.count},(_,k)=>bin[reader](start+k*(view.byteStride||size)));}
        if(diningLight(n.name))lightIndices.push(indices);
        for(let k=0;k<indices.length;k+=3)triangles.push(indices.slice(k,k+3).map(index=>points[index]).sort().join(';'));
      }
      return [{name:n.name,meta,bounds,lightVertices,lightIndices,geometry:createHash('sha256').update(triangles.sort().join('\n')).digest('hex')}];
    });
  }
  const raw=await readFile(new URL(scheme.model,root)),model=decode(raw,true),previous=decode(execFileSync('git',['show',baseline+':'+scheme.model],{cwd,maxBuffer:200*1024*1024}));
  const bounds=items=>items.reduce((b,item)=>b.union(item.bounds),new THREE.Box3());
  const exact=(actual,expected,label)=>assert.ok(actual.every((v,i)=>Math.abs(v-expected[i])<.00004),label+' '+JSON.stringify({actual,expected}));
  for(const p of g.parts){const parts=model.filter(m=>m.meta.garagePartId===p.id);assert.equal(parts.length,1,'Actual garage part '+p.id);const box=bounds(parts);exact(box.min.toArray(),[p.x/100,p.zCm/100,p.y/100],p.id+' lower');exact(box.max.toArray(),[(p.x+p.w)/100,(p.zCm+p.hCm)/100,(p.y+p.d)/100],p.id+' upper');}
  for(const f of g.items){const parts=model.filter(m=>m.meta.garageItemId===f.id);assert.ok(parts.length>10,'Actual vehicle geometry '+f.id);const box=bounds(parts),z=f.zCm||0;assert.ok(box.min.x>=f.x/100-.00004&&box.max.x<=(f.x+f.w)/100+.00004&&box.min.z>=f.y/100-.00004&&box.max.z<=(f.y+f.d)/100+.00004&&box.min.y>=z/100-.00004&&box.max.y<=(z+f.hCm)/100+.00004,'Actual vehicle fits raised/lower envelope '+f.id);assert.ok(box.min.y<z/100+.02,'Actual vehicle is at specified base height '+f.id);}
  const excluded=m=>m.meta.garageId||m.meta.storageFitoutId==='dining_sideboard_wall'||/餐桌|餐椅/.test(m.meta.furnitureName||'')||diningLight(m.name);
  const protectedMap=items=>new Map(items.filter(m=>!excluded(m)).map(m=>[m.name,m.geometry]));
  const oldProtected=protectedMap(previous),nowProtected=protectedMap(model);
  assert.ok(oldProtected.size>300,'Substantial actual unrelated mesh protection');
  assert.deepEqual([...nowProtected.keys()].sort(),[...oldProtected.keys()].sort(),'Only entry storage/sideboard/dining meshes may change');
  for(const [name,geometry]of oldProtected)assert.equal(nowProtected.get(name),geometry,'Unchanged world triangles '+name);
  const lights=previous.filter(m=>diningLight(m.name));assert.equal(lights.length,8,'Two complete dining pendants');
  for(const old of lights){
    const current=model.find(m=>m.name===old.name),expected=old.bounds.clone().translate(new THREE.Vector3(.15,0,.95));
    exact(current.bounds.min.toArray(),expected.min.toArray(),'Dining pendant moved with table '+old.name);exact(current.bounds.max.toArray(),expected.max.toArray(),'Dining pendant moved with table '+old.name);
    // Translating float32 vertices can cross a quantization half-grid without
    // changing geometry. Require exact topology and compare every normalized
    // world vertex directly within 40 micrometres instead of hash equality.
    assert.deepEqual(current.lightIndices,old.lightIndices,'Pendant topology unchanged '+old.name);
    assert.equal(current.lightVertices.length,old.lightVertices.length,'Pendant vertex count unchanged '+old.name);
    old.lightVertices.forEach((p,i)=>exact(current.lightVertices[i],p,'Pendant rigid translation '+old.name+'/'+i));
  }
  console.log(`PASS family entry GLB: ${g.parts.length} exact garage solids, raised bicycle/lower stroller and ${oldProtected.size} unchanged world-space meshes.`);
}
console.log(`PASS family entry 3.5.1: aligned 1500×650 storage, east hinged opening, two-level vehicles, 4610 sideboard, relocated dining, ${seen.size} connected walk points / 8 rooms, ${takeoutPoses} rigid extraction poses. Human lifting/hardware/entry-door swing require real-site checks.`);
}
