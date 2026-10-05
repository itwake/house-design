// Merged scheme: protect the compact family garage/dining layout while
// validating the imported laundry wall and its actual walking clearance.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as THREE from '../vendor/three/three.module.js';
import {buildWalkWorld,findWalkStart,advanceWalk} from '../walkthrough.js';
const root=new URL('../',import.meta.url),cwd=fileURLToPath(root);
const read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const d=await read('models/schemes/family/design-data.json'),reference=await read('models/schemes/laundry/design-data.json');
if(d.familyPublicP2Revision?.version==='3.11.0'){
  await (await import('./test_family_public_p2.mjs')).ensureFamilyPublicP2({glb:process.argv.includes('--glb')});
  await import('./test_purchased_furniture.mjs');
}else if(d.familyR3Revision?.version==='3.10.0'){
  // R3 independently proves the complete public/laundry source and world
  // triangles unchanged from the published baseline, plus every changed wall.
  await (await import('./test_family_r3.mjs')).ensureFamilyR3({glb:process.argv.includes('--glb')});
  await import('./test_purchased_furniture.mjs');
}else{
const entryChanged=Boolean(d.familyEntryRevision),flowChanged=Boolean(d.familyFlowRevision),diningChanged=Boolean(d.familyDiningRevision),baseline=diningChanged?'a2b623c':flowChanged?'ab45810':entryChanged?'0466fda':'9e9a10f';
const shift=d.familyFlowRevision?.sofaShiftCm,sofaShiftX=flowChanged?Number(typeof shift==='object'?shift.x:shift):0,sofaWidth=flowChanged?d.familyFlowRevision.sofaWidthCm:220;
if(diningChanged){assert.equal(d.familyDiningRevision.version,'3.5.3');assert.ok(d.familyDiningRevision.baselineCommit.startsWith(baseline));}
else if(flowChanged){assert.equal(d.familyFlowRevision.baselineCommit,baseline);assert.ok(Number.isFinite(sofaShiftX)&&Number.isFinite(sofaWidth),'Current sofa width and horizontal move are explicit source fields');}
const base=JSON.parse(execFileSync('git',['show',baseline+':models/schemes/family/design-data.json'],{cwd,encoding:'utf8'}));
const l=d.laundry,near=(a,b,message)=>assert.ok(Math.abs(a-b)<1e-7,message||`${a} != ${b}`);
assert.ok(l,'Family scheme includes the laundry fitout, not just its text');
const garageGeometry=garage=>Object.fromEntries(Object.entries(garage).filter(([key])=>key!=='conditions'));
if(!entryChanged){
  assert.deepEqual(garageGeometry(d.garage),garageGeometry(base.garage),'Compact garage geometry, vehicles, doors and metrics remain unchanged');
  assert.deepEqual(d.garage.conditions,base.garage.conditions.map(t=>t.replace('厨房、阳台、卧卫','厨房、卧卫')),'Only remove the obsolete balcony-preservation claim');
  assert.deepEqual(d.storageFitouts,base.storageFitouts,'Preserved family storage');
}
for(const key of ['envelope','windows','bayFitouts','wallFitouts','appearance'])assert.deepEqual(d[key],base[key],'Preserved family '+key);
for(const room of d.rooms)assert.deepEqual(room,(['living','balcony'].includes(room.id)?reference:base).rooms.find(r=>r.id===room.id),'Room polygon '+room.id);
assert.deepEqual(d.walls,reference.walls,'Only the reference balcony partition and short return move');
assert.deepEqual(d.wallSpecs,reference.wallSpecs,'Moved partition retains its conditional structural status');
for(const door of d.doors)assert.deepEqual(door,(door.id==='balcony_door'?reference:base).doors.find(r=>r.id===door.id),'Door geometry '+door.id);
for(const key of ['alignment','counter','basin','machines','bookcase','parts'])assert.deepEqual(l[key],reference.laundry[key],'Imported exact laundry '+key);
const removed=new Set(['洗烘塔','阳台家政柜']),moved=new Set(['三人沙发','茶几','电视薄柜']);
for(const f of base.furniture){
  if(removed.has(f.name)||moved.has(f.name))continue;
  if(entryChanged&&(['family_garage','family_sideboard'].includes(f.id)||/餐桌|餐椅/.test(f.name)))continue;
  assert.deepEqual(d.furniture.find(v=>(v.id||v.name)===(f.id||f.name)),f,'Preserved furniture '+f.name);
}
assert.ok(!d.furniture.some(f=>removed.has(f.name)),'No duplicated old stacked laundry fixtures');
assert.equal(d.furniture.filter(f=>f.laundryFitoutId===l.id).length,4,'Two machines, counter and bookcase');
assert.equal(d.furniture.filter(f=>f.name.includes('餐椅')).length,4,'Four dining chairs remain');
const fixture=name=>d.furniture.find(f=>f.name===name),geometry=f=>[f.x,f.y,f.w,f.d];
assert.deepEqual(geometry(fixture('三人沙发')),diningChanged?[385,809,200,88]:[355+sofaShiftX,809,sofaWidth,88]);
assert.deepEqual(geometry(fixture('茶几')),diningChanged?[435,707,120,62]:[405+sofaShiftX,707,120,62]);
assert.deepEqual(geometry(fixture('电视薄柜')),[395,633,220,34]);
assert.deepEqual(d.modelAddons.livingFloorLampCm,flowChanged?{x:248,y:825}:{x:335,y:735});
const overlap=(a,b)=>Math.min(a.x+a.w,b.x+b.w)>Math.max(a.x,b.x)+.001&&Math.min(a.y+a.d,b.y+b.d)>Math.max(a.y,b.y)+.001;
for(const name of moved){
  const f=fixture(name);
  for(const other of d.furniture.filter(v=>v!==f))assert.ok(!overlap(f,other),name+' overlaps '+other.name);
}
const lamp={x:d.modelAddons.livingFloorLampCm.x-22,y:d.modelAddons.livingFloorLampCm.y-22,w:44,d:44};
for(const f of d.furniture)assert.ok(!overlap(lamp,f),'Lamp intersects '+f.name);
near(l.bookcase.x-(fixture('三人沙发').x+fixture('三人沙发').w),diningChanged?60:70-sofaShiftX-(sofaWidth-220),'Sofa/bookcase aisle follows actual sofa size and move');
near(fixture('三人沙发').y-(fixture('茶几').y+fixture('茶几').d),40,'Sofa/coffee-table aisle');
near(fixture('茶几').y-(fixture('电视薄柜').y+fixture('电视薄柜').d),40,'TV/coffee-table aisle');
if(diningChanged){
  const northChair=d.furniture.find(f=>f.name.includes('餐椅')&&f.face==='south');assert.ok(northChair,'Dining layout keeps the north-facing seating envelope');
  const rearCabinet=d.furniture.find(f=>f.x===385&&f.y===899&&f.w===200&&f.d===25);assert.ok(rearCabinet,'Real 25 cm sofa-back cabinet');
  near(rearCabinet.y-(fixture('三人沙发').y+fixture('三人沙发').d),2,'Cabinet clears the sofa back');
  near(rearCabinet.x-(northChair.x+northChair.w),71.25,'Offset north chair keeps a real lateral path around sofa-back storage');
  assert.ok(!overlap(rearCabinet,northChair),'North chair and back cabinet do not overlap');
}else near(fixture('餐椅北1').y-(fixture('三人沙发').y+fixture('三人沙发').d),flowChanged?95.5:entryChanged?155.5:60.5,'Sofa back / dining chair gap');
near(l.counter.y-966,69,'Laundry operation band');
const balconyDoor=d.doors.find(v=>v.id==='balcony_door');
near(balconyDoor.x1-balconyDoor.sliding.frameDepthCm/2,l.bookcase.x,'Aligned door-frame and bookcase fronts');
assert.equal(balconyDoor.sliding.stackTo,'south');
const world=buildWalkWorld(d);
for(const room of d.rooms){const start=findWalkStart(world,room.id);assert.ok(start&&world.canStand(start.x,start.z),'Safe start '+room.id);}
const walked=advanceWalk(world,{x:6.1,z:10.0},1.25,0);
near(walked.x,7.35,'Actual movement crosses the north balcony entrance');
assert.equal(world.roomAt(walked.x,walked.z),'balcony');
assert.ok(world.obstacles.find(o=>o.id==='balcony_door-parked-leaves').z>10.4,'Slider stack stays south of the entry band');
const floorLamp=world.obstacles.find(o=>o.id==='living-floor-lamp');
near(floorLamp.x,lamp.x/100);near(floorLamp.z,lamp.y/100);
if(flowChanged){
  const leaves=d.garage.parts.filter(p=>p.role==='folded-door');assert.equal(leaves.length,2,'Current east opening has two physical folded leaves');
  for(const leaf of leaves){const collision=world.obstacles.find(o=>o.id==='garage-'+leaf.id);assert.ok(collision,'Physical folded-leaf collider '+leaf.id);assert.deepEqual([collision.x,collision.z,collision.w,collision.d],[leaf.x/100,leaf.y/100,leaf.w/100,leaf.d/100]);}
  assert.ok(!world.obstacles.find(o=>o.id==='garage-hinged-leaf'),'Superseded single hinged leaf is absent');
}else{
  assert.equal(world.obstacles.filter(o=>o.id.startsWith('garage-folded-leaf-')).length,entryChanged?0:4,'Garage door collision leaves reflect current source');
  if(entryChanged)assert.ok(world.obstacles.find(o=>o.id==='garage-hinged-leaf'),'New storage hinge has an actual walk collider');
}
// Preserve the real compact-garage take-out check against the merged living
// furniture, rather than assuming the previous successful route still fits.
const polygon=(x,y,w,h,angle=0)=>{
  const c=Math.cos(angle),s=Math.sin(angle);
  return [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([a,b])=>[x+a*c-b*s,y+a*s+b*c]);
};
const intersects=(a,b)=>{
  for(const points of [a,b])for(let i=0;i<4;i++){
    const p=points[i],q=points[(i+1)%4],axis=[q[1]-p[1],p[0]-q[0]],aa=a.map(p=>p[0]*axis[0]+p[1]*axis[1]),bb=b.map(p=>p[0]*axis[0]+p[1]*axis[1]);
    if(Math.min(...aa)>=Math.max(...bb)-1e-6||Math.min(...bb)>=Math.max(...aa)-1e-6)return false;
  }
  return true;
};
const fixed=d.furniture.filter(f=>!f.garageFitoutId).map(f=>({id:f.name,shape:polygon(f.x+f.w/2,f.y+f.d/2,f.w,f.d)}));
for(const p of d.garage.parts.filter(p=>p.zCm<105))fixed.push({id:p.id,shape:polygon(p.x+p.w/2,p.y+p.d/2,p.w,p.d)});
fixed.push({id:'west wall',shape:polygon(206,1200,12,450)},{id:'kitchen wall',shape:polygon(536,1260,12,290)},{id:'south wall left',shape:polygon(296,1395,188,12)},{id:'south wall right',shape:polygon(663,1395,346,12)});
let vehiclePoses=0;
for(const item of entryChanged?[]:d.garage.items){
  const other=d.garage.items.find(o=>o!==item),parkedOther={id:'other parked vehicle',shape:polygon(other.x+other.w/2,other.y+other.d/2,other.w,other.d)};
  const check=(x,y,angle=0)=>{
    const shape=polygon(x,y,item.w,item.d,angle);
    for(const obstacle of [...fixed,parkedOther])assert.ok(!intersects(shape,obstacle.shape),`Merged take-out path ${item.id} hits ${obstacle.id} at ${x},${y}`);
    vehiclePoses++;
  };
  const cx=item.x+item.w/2,cy=item.y+item.d/2,targetY=d.garage.y-2-item.d/2,targetX=435;
  for(let y=cy;y>=targetY;y-=1)check(cx,y);check(cx,targetY);
  for(let x=cx;x<=targetX;x+=1)check(x,targetY);check(targetX,targetY);
  for(let degrees=0;degrees<=90;degrees++)check(targetX,targetY,degrees*Math.PI/180);
  const parked=polygon(targetX,targetY,item.w,item.d,Math.PI/2);
  for(let degrees=0;degrees<=90;degrees++){
    const angle=degrees*Math.PI/180,entryDoor=polygon(490-50*Math.cos(angle),1395-50*Math.sin(angle),100,4,angle);
    assert.ok(!intersects(parked,entryDoor),'Keep the extracted vehicle north before opening the entry door');
  }
}
const catalog=await read('models/design-schemes.json'),scheme=catalog.schemes.find(s=>s.id==='family');
for(const view of ['laundry-detail','living-wall','storage-library'])assert.ok(scheme.renderViews.includes(view),'Merged scheme exposes '+view);

if(process.argv.includes('--glb')){
  // Decode POSITION bytes, not only declared accessor extrema.
  const raw=await readFile(new URL(scheme.model,root)),length=raw.readUInt32LE(12),g=JSON.parse(raw.subarray(20,20+length)),bin=raw.subarray(28+length),parents=new Map(),matrices=new Map();
  g.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parents.set(c,i)));
  const matrix=i=>{
    if(matrices.has(i))return matrices.get(i);
    const n=g.nodes[i],m=new THREE.Matrix4();
    if(n.matrix)m.fromArray(n.matrix);else m.compose(new THREE.Vector3(...(n.translation||[0,0,0])),new THREE.Quaternion(...(n.rotation||[0,0,0,1])),new THREE.Vector3(...(n.scale||[1,1,1])));
    if(parents.has(i))m.premultiply(matrix(parents.get(i)));matrices.set(i,m);return m;
  };
  const model=g.nodes.flatMap((n,i)=>{
    if(n.mesh===undefined)return [];
    const meta={};for(let p=i;p!==undefined;p=parents.get(p))for(const [k,v]of Object.entries(g.nodes[p].extras||{}))if(meta[k]===undefined)meta[k]=v;
    if(!meta.laundryPartId&&!meta.laundryMachineId&&!meta.laundryBasin&&!meta.garageId&&meta.openingId!=='balcony_door')return [];
    const bounds=new THREE.Box3();
    for(const primitive of g.meshes[n.mesh].primitives){
      const a=g.accessors[primitive.attributes.POSITION],v=g.bufferViews[a.bufferView];assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');
      const offset=(a.byteOffset||0)+(v.byteOffset||0),stride=v.byteStride||12;
      for(let k=0;k<a.count;k++){const p=offset+k*stride;bounds.expandByPoint(new THREE.Vector3(bin.readFloatLE(p),bin.readFloatLE(p+4),bin.readFloatLE(p+8)).applyMatrix4(matrix(i)));}
    }
    return [{name:n.name,meta,bounds}];
  });
  const bound=items=>items.reduce((b,p)=>b.union(p.bounds),new THREE.Box3()),exact=(a,b)=>assert.ok(a.every((v,i)=>Math.abs(v-b[i])<.00004),JSON.stringify({a,b}));
  for(const p of l.parts){
    const actual=model.filter(m=>m.meta.laundryPartId===p.id);assert.equal(actual.length,1,p.id);
    const b=bound(actual);exact(b.min.toArray(),[p.x/100,p.zCm/100,p.y/100]);exact(b.max.toArray(),[(p.x+p.w)/100,(p.zCm+p.hCm)/100,(p.y+p.d)/100]);
  }
  for(const f of l.machines){
    const m=model.filter(v=>v.meta.laundryMachineId===f.id);assert.ok(m.length>=13,'Real appliance '+f.id);
    const b=bound(m);exact(b.min.toArray(),[f.x/100,0,f.y/100]);exact(b.max.toArray(),[(f.x+f.w)/100,.85,(f.y+f.d)/100]);
    for(const part of model.filter(v=>v.meta.laundryPartId||v.meta.laundryBasin)){const size=b.clone().intersect(part.bounds).getSize(new THREE.Vector3());assert.ok(size.x<.00004||size.y<.00004||size.z<.00004,'Machine intersects '+part.name);}
  }
  assert.equal(new Set(model.filter(v=>v.meta.garagePartId).map(v=>v.meta.garagePartId)).size,d.garage.parts.length,'Complete compact garage remains in actual model');
  assert.equal(new Set(model.filter(v=>v.meta.garageItemId).map(v=>v.meta.garageItemId)).size,2,'Both stored vehicle meshes remain');
  const door=model.filter(m=>m.meta.openingId==='balcony_door');assert.ok(Math.abs(bound(door).min.x-6.45)<.00004,'Actual balcony frame aligned at x6.45m');
  const panels=door.filter(m=>m.meta.doorRole==='sliding-panel');assert.equal(panels.length,18);
  const stack=bound(panels.map(m=>({...m,bounds:m.bounds.clone().translate(new THREE.Vector3(...m.meta.slideOpenOffsetM))}))),collider=world.obstacles.find(v=>v.id==='balcony_door-parked-leaves');
  assert.ok(stack.min.z>=collider.z-.00004&&stack.max.z<=collider.z+collider.d+.00004,'Actual open door stack inside walking collider');
  // Canonical world-space triangles protect every bedroom/study mesh, both
  // baths, kitchen, compact garage, dining furniture and existing storage.
  // Vertex/material-driven splitting and primitive order do not affect this
  // comparison; the 10 micrometre grid is far below survey precision.
  function protectedGeometry(bytes){
    const length=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+length)),bin=bytes.subarray(28+length),parents=new Map(),matrices=new Map(),result=new Map();
    g.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parents.set(c,i)));
    const matrix=i=>{
      if(matrices.has(i))return matrices.get(i);const n=g.nodes[i],m=new THREE.Matrix4();
      if(n.matrix)m.fromArray(n.matrix);else m.compose(new THREE.Vector3(...(n.translation||[0,0,0])),new THREE.Quaternion(...(n.rotation||[0,0,0,1])),new THREE.Vector3(...(n.scale||[1,1,1])));
      if(parents.has(i))m.premultiply(matrix(parents.get(i)));matrices.set(i,m);return m;
    };
    for(const [i,n]of g.nodes.entries()){
      if(n.mesh===undefined)continue;
      const meta={};for(let p=i;p!==undefined;p=parents.get(p))for(const [k,v]of Object.entries(g.nodes[p].extras||{}))if(meta[k]===undefined)meta[k]=v;
      const preservedRoom=['room_a','room_b','room_c','bath_1','bath_2','kitchen'].includes(meta.roomId);
      const unchangedStorage=meta.storageFitoutId&&(!entryChanged||meta.storageFitoutId!=='dining_sideboard_wall')&&(!diningChanged||meta.storageFitoutId!=='sofa_back_storage');
      const unchangedGarage=!entryChanged&&meta.garageId,unchangedDining=!entryChanged&&/餐桌|餐椅/.test(meta.furnitureName||'');
      if(!preservedRoom&&!unchangedGarage&&!unchangedStorage&&!unchangedDining&&meta.fitoutId!=='bay_living_family')continue;
      const triangles=[];
      for(const primitive of g.meshes[n.mesh].primitives){
        assert.equal(primitive.mode??4,4,'Protected mesh uses triangles');
        const a=g.accessors[primitive.attributes.POSITION],v=g.bufferViews[a.bufferView],offset=(a.byteOffset||0)+(v.byteOffset||0),stride=v.byteStride||12,points=[];
        assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');
        for(let k=0;k<a.count;k++){
          const p=offset+k*stride,point=new THREE.Vector3(bin.readFloatLE(p),bin.readFloatLE(p+4),bin.readFloatLE(p+8)).applyMatrix4(matrix(i));
          points.push(point.toArray().map(value=>Math.round(value/.00001)).join(','));
        }
        let indices;
        if(primitive.indices===undefined)indices=Array.from({length:a.count},(_,k)=>k);
        else{
          const index=g.accessors[primitive.indices],view=g.bufferViews[index.bufferView],start=(index.byteOffset||0)+(view.byteOffset||0),size={5121:1,5123:2,5125:4}[index.componentType];
          assert.ok(size,'Unsigned triangle index component');
          const reader={5121:'readUInt8',5123:'readUInt16LE',5125:'readUInt32LE'}[index.componentType];
          indices=Array.from({length:index.count},(_,k)=>bin[reader](start+k*(view.byteStride||size)));
        }
        assert.equal(indices.length%3,0);
        for(let k=0;k<indices.length;k+=3)triangles.push(indices.slice(k,k+3).map(index=>points[index]).sort().join(';'));
      }
      assert.ok(!result.has(n.name),'Unique protected mesh name '+n.name);
      result.set(n.name,{triangles:triangles.length,geometry:createHash('sha256').update(triangles.sort().join('\n')).digest('hex')});
    }
    return result;
  }
  const originalBytes=execFileSync('git',['show',baseline+':'+scheme.model],{cwd,maxBuffer:200*1024*1024}),original=protectedGeometry(originalBytes),current=protectedGeometry(raw);
  assert.ok(original.size>300,'A substantial actual protected mesh set, not just source assertions');
  assert.deepEqual([...current.keys()].sort(),[...original.keys()].sort(),'Protected mesh set is unchanged');
  for(const [name,mesh]of original)assert.deepEqual(current.get(name),mesh,'Protected world-space triangles '+name);
  console.log(`PASS merged family GLB: ${l.parts.length} exact laundry/bookwall solids, two floor machines, aligned south-parking slider and ${original.size} protected baseline meshes with identical world-space triangles.`);
}
console.log(`PASS family merge: private rooms and imported laundry/wall preserved, collision-free living furniture/lamp, walkable balcony entrance; ${entryChanged?'current entrance is independently checked by test_family_entry.mjs':vehiclePoses+' sampled north take-out poses'}. Human handling and real hardware require on-site checks.`);
}
