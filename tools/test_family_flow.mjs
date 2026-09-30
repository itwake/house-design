// Source and actual world-vertex QA for the 3.5.2 circulation update.
// A parked fold is a concept envelope, not a certification of moving hardware.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as THREE from '../vendor/three/three.module.js';
import {buildWalkWorld,findWalkStart,advanceWalk} from '../walkthrough.js';
const root=new URL('../',import.meta.url),cwd=fileURLToPath(root);
const read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const d=await read('models/schemes/family/design-data.json'),g=d.garage,revision=d.familyFlowRevision;
if(d.familyDiningRevision){
  // Current dining revision owns its explicit two furniture states. Do not
  // exit: callers importing this file still have inherited asset tests to run.
  await import('./test_family_dining.mjs');
}else{
const baseline='ab45810',base=JSON.parse(execFileSync('git',['show',baseline+':models/schemes/family/design-data.json'],{cwd,encoding:'utf8'}));
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-7,label||`${a} != ${b}`);
const rect=f=>[f.x,f.y,f.w,f.d],fixture=name=>d.furniture.find(f=>f.name===name);
const overlap=(a,b)=>Math.min(a.x+a.w,b.x+b.w)>Math.max(a.x,b.x)+1e-6&&Math.min(a.y+a.d,b.y+b.d)>Math.max(a.y,b.y)+1e-6;
const overlap3=(a,b)=>overlap(a,b)&&Math.min((a.zCm||0)+a.hCm,(b.zCm||0)+b.hCm)>Math.max(a.zCm||0,b.zCm||0)+1e-6;
assert.equal(revision.version,'3.5.2');assert.equal(revision.baselineCommit,baseline);
assert.equal(d.familyEntryRevision.version,'3.5.2');assert.equal(d.garageRevision.version,'3.5.2');
const shift=revision.sofaShiftCm,width=revision.sofaWidthCm;
assert.ok((width===220&&shift===10)||(width===200&&shift===30),'Only reviewed sofa width / shift pairs');
for(const key of ['envelope','rooms','walls','wallSpecs','doors','windows','bayFitouts','wallFitouts','appearance'])assert.deepEqual(d[key],base[key],'Architecture/private designs preserved '+key);
const addons=a=>Object.fromEntries(Object.entries(a).filter(([k])=>!['livingFloorLampCm','livingRugCm'].includes(k)));
assert.deepEqual(addons(d.modelAddons),addons(base.modelAddons),'Other model additions preserved');
assert.deepEqual(d.modelAddons.livingFloorLampCm,{x:248,y:825});
assert.deepEqual(d.modelAddons.livingRugCm,{x:355+shift-12,y:638,w:width+24,d:178});
const laundryPhysical=l=>Object.fromEntries(Object.entries(l).filter(([key])=>!['conditions','dimensions','metrics'].includes(key)));
assert.deepEqual(laundryPhysical(d.laundry),laundryPhysical(base.laundry),'Complete physical laundry design preserved');
const metrics=l=>Object.fromEntries(Object.entries(l.metrics).filter(([key])=>!['sofaDiningChairGapCm','sofaBookcaseGapCm'].includes(key)));
assert.deepEqual(metrics(d.laundry),metrics(base.laundry),'Unaffected laundry clearances preserved');
near(d.laundry.metrics.sofaDiningChairGapCm,95.5);
near(d.laundry.metrics.sofaBookcaseGapCm,60);
assert.deepEqual(d.storageFitouts.filter(f=>f.id!=='dining_sideboard_wall'),base.storageFitouts.filter(f=>f.id!=='dining_sideboard_wall'),'Shoe station and every other fitout preserved');
const changed=f=>['family_garage','family_sideboard','family_north_sideboard'].includes(f.id)||['三人沙发','茶几'].includes(f.name)||/餐桌|餐椅/.test(f.name||'');
for(const f of base.furniture.filter(f=>!changed(f)))assert.deepEqual(d.furniture.find(v=>(v.id||v.name)===(f.id||f.name)),f,'Preserve furniture '+f.name);
assert.equal(d.furniture.length,base.furniture.length+1,'Only the north return aggregate is added');
assert.deepEqual(rect(g),[212,1320,150,65]);assert.deepEqual(g.inner,base.garage.inner);assert.deepEqual(g.opening,base.garage.opening);assert.deepEqual(g.items,base.garage.items);assert.deepEqual(g.shelves,base.garage.shelves);
assert.equal(g.face,'east');assert.equal(g.doorState,'folded-open');assert.equal(g.doorFoldDirection,'outward');assert.equal(g.doorStackSide,'north');
near(g.metrics.footprintM2,.975);near(g.opening.clearWidthCm,61);near(g.y,fixture('玄关柜').y);near(g.y+g.d,fixture('玄关柜').y+fixture('玄关柜').d);
const folds=g.parts.filter(p=>p.role==='folded-door');assert.equal(folds.length,2);assert.ok(!g.parts.some(p=>p.id==='hinged-leaf'));
for(const [i,p]of folds.entries()){assert.deepEqual(rect(p),[362+i*3,1291.5,2.5,30.5]);near(p.zCm,.8);near(p.hCm,241.2);near(p.y+p.d,g.opening.y1,'Fold parking stops before the vehicle aperture');}
assert.deepEqual(g.parts.filter(p=>p.role!=='folded-door'),base.garage.parts.filter(p=>p.id!=='hinged-leaf'),'Only storage door leaves change');
near(fixture('玄关柜').x-(folds[1].x+folds[1].w),127.5,'Parked fold to shoe station');
assert.equal(g.doorOperation.panelCount,2);near(g.doorOperation.parkAngleDeg,180);near(g.doorOperation.panelWidthCm,30.5);
assert.ok(g.conditions.some(t=>/五金|铰链|厂家/.test(t)&&/过程|全程|确认|深化/.test(t)),'No unsupported full-sweep guarantee');
assert.ok(g.conditions.some(t=>/入户门/.test(t)&&/关闭|关好|关/.test(t)),'Entry operation sequencing remains explicit');
const stroller=g.items.find(f=>f.kind==='folded-stroller'),bike=g.items.find(f=>f.kind==='child-bike');
assert.deepEqual(rect(stroller),[238,1325,75,55]);assert.deepEqual(rect(bike),[220,1326,110,50]);near(stroller.zCm,0);near(bike.zCm,123);
assert.ok(overlap(stroller,bike)&&!overlap3(stroller,bike),'Two vehicles overlap only in floor projection');
assert.ok(stroller.w*stroller.d+bike.w*bike.d>g.inner.w*g.inner.d,'Both cannot be claimed to fit at floor level');
const platform=g.parts.find(p=>p.role==='shelf'&&p.zCm===120);near(platform.hCm,3);near(platform.zCm+platform.hCm,bike.zCm);
const posts=g.parts.filter(p=>p.role==='rack-post'&&p.x===356).sort((a,b)=>a.y-b.y);near(posts[1].y-posts[0].y-posts[0].d,57,'Real rack-leg aperture differs from the nominal door width');
for(const item of g.items)for(const p of g.parts)assert.ok(!overlap3(item,p),'Vehicle/physical part '+item.id+'/'+p.id);
const west=d.furniture.find(f=>f.id==='family_sideboard'),north=d.furniture.find(f=>f.id==='family_north_sideboard');
assert.deepEqual(rect(west),[212.5,859,40,421]);assert.deepEqual(rect(north),[212.5,1280,149.5,40]);assert.equal(north.face,'north');near(west.y+west.d,north.y);near(north.y+north.d,g.y);near(north.x+north.w,g.opening.x);
const fitout=d.storageFitouts.find(f=>f.id==='dining_sideboard_wall');assert.deepEqual(fitout.furnitureIds,['family_sideboard','family_north_sideboard']);
const westBases=fitout.parts.filter(p=>p.role==='sideboard_base'&&p.segmentId==='west-continuous').sort((a,b)=>a.y-b.y);
assert.deepEqual(westBases.map(p=>p.d),[120,120,120,61]);let edge=859;
for(const p of westBases){near(p.x,212.5);near(p.y,edge);near(p.w,40);near(p.hCm,85);edge+=p.d;}near(edge,1280);
const northBase=fitout.parts.find(p=>p.id==='family_return_base'),northUpper=fitout.parts.find(p=>p.id==='family_return_upper');
assert.deepEqual(rect(northBase),[252.5,1280,109.5,40]);assert.deepEqual(rect(northUpper),[240.5,1292,121.5,28]);
const blindBase=fitout.parts.find(p=>p.id==='family_return_corner_base'),blindUpper=fitout.parts.find(p=>p.id==='family_return_corner_upper');
assert.deepEqual(rect(blindBase),[212.5,1280,40,40]);assert.deepEqual(rect(blindUpper),[212.5,1292,28,28]);assert.equal(blindBase.usableStorage,false);assert.equal(blindUpper.usableStorage,false);
const westUpper=fitout.parts.find(p=>p.id==='family_sideboard_3_upper');assert.deepEqual(rect(westUpper),[212.5,1219,28,73]);near(westUpper.y+westUpper.d,northUpper.y);
for(const p of fitout.parts.filter(p=>p.role==='sideboard_base')){assert.equal(p.doorStyle,'sliding');assert.equal(p.drawerPanels??0,0);near(p.hCm,85);}
for(const role of [['sideboard_base','sideboard_blind_base'],['upper_cabinet','upper_blind_corner']]){const parts=fitout.parts.filter(p=>role.includes(p.role));for(const a of parts)for(const b of parts)if(a!==b)assert.ok(!overlap3(a,b),'L-corner cannot double count overlapping volumes '+a.id+'/'+b.id);}
assert.ok(fitout.conditions.some(t=>/盲角|盲区/.test(t)&&/不计/.test(t)),'Blind corner capacity is explicitly excluded');
for(const old of base.furniture.filter(f=>/餐桌|餐椅/.test(f.name))){assert.deepEqual(fixture(old.name),{...old,y:old.y-60},'Dining group rigid move north '+old.name);}
assert.deepEqual(rect(fixture('四人餐桌')),[320,1050,120,70]);
const sofa=fixture('三人沙发'),coffee=fixture('茶几'),oldSofa=base.furniture.find(f=>f.name==='三人沙发');
assert.deepEqual(rect(sofa),[oldSofa.x+shift,809,width,88]);assert.deepEqual(sofa.rugCm,d.modelAddons.livingRugCm);
assert.deepEqual(coffee,{...base.furniture.find(f=>f.name==='茶几'),x:405+shift});
near(645-(sofa.x+sofa.w),60,'Bookcase front remains a narrow 60 cm single-person aisle');
near(fixture('餐椅北1').y-(sofa.y+sofa.d),95.5);near(fixture('餐椅北1').y-30-(sofa.y+sofa.d),65.5);
near(north.y-(fixture('餐椅南1').y+fixture('餐椅南1').d+30),72.5);near(fixture('四人餐桌').x-(west.x+west.w),67.5);near(530-(fixture('四人餐桌').x+120),90);
const lamp={x:248-22,y:825-22,w:44,d:44};near(west.y-(lamp.y+lamp.d),12);near(sofa.x-(lamp.x+lamp.w),sofa.x-270);
for(const f of d.furniture.filter(f=>!f.garageFitoutId))assert.ok(!overlap(lamp,f),'Relocated lamp shade clears furniture '+f.name);
for(const a of d.furniture.filter(changed))for(const b of d.furniture)if(a!==b)assert.ok(!overlap(a,b),'Furniture footprints cannot overlap '+a.name+'/'+b.name);
let takeoutPoses=0;
for(const item of g.items)for(let x=item.x;x<=g.x+g.w;x++){const moved={...item,x};for(const p of g.parts)assert.ok(!overlap3(moved,p),'East extraction intersects '+item.id+'/'+p.id);for(const f of d.furniture.filter(f=>!f.garageFitoutId))assert.ok(!overlap(moved,f),'East extraction intersects '+item.id+'/'+f.name);takeoutPoses++;}
const world=buildWalkWorld(d);for(const p of folds){const o=world.obstacles.find(o=>o.id==='garage-'+p.id);assert.ok(o,'Physical fold collision '+p.id);assert.deepEqual([o.x,o.z,o.w,o.d],rect(p).map(v=>v/100));}
assert.ok(!world.obstacles.some(o=>o.id==='garage-hinged-leaf'));
for(const room of d.rooms){const p=findWalkStart(world,room.id);assert.ok(p&&world.canStand(p.x,p.z),'Safe start '+room.id);}
const step=.05,grid=new Map(),key=(i,j)=>i+','+j;
for(let i=0;i<=169;i++)for(let j=0;j<=281;j++){const x=i*step,z=j*step;if(world.canStand(x,z))grid.set(key(i,j),{i,j,x,z});}
const start=grid.get(key(92,260));assert.ok(start,'Entry seed remains on actual reachable floor');const queue=[start],seen=new Set([key(start.i,start.j)]),reached=new Set();
for(let head=0;head<queue.length;head++){const p=queue[head];reached.add(world.roomAt(p.x,p.z));for(const [di,dj]of [[1,0],[-1,0],[0,1],[0,-1]]){const k=key(p.i+di,p.j+dj),q=grid.get(k);if(!q||seen.has(k))continue;const moved=advanceWalk(world,p,q.x-p.x,q.z-p.z);if(Math.hypot(moved.x-q.x,moved.z-q.z)>1e-7)continue;seen.add(k);queue.push(q);}}
assert.deepEqual([...reached].filter(Boolean).sort(),world.rooms.map(r=>r.id).sort(),'All eight rooms reachable through swept collision, not only spawnable');
const catalog=await read('models/design-schemes.json'),scheme=catalog.schemes.find(s=>s.id==='family');assert.equal(scheme.assetRevision,'3.5.2');
if(process.argv.includes('--glb')){
  const diningLight=name=>/^(Dining pendant ceiling rose|Pendant thin suspension|Organic linen pendant|Pendant opal diffuser)(?:[ ._]|$)/.test(name);
  const floorLight=name=>/^(Lamp base|Lamp upright|Pleated linen lampshade|Warm lamp bulb)(?:[ ._]|$)/.test(name);
  function decode(bytes){
    const length=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+length)),bin=bytes.subarray(28+length),parents=new Map(),matrices=new Map();
    g.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parents.set(c,i)));
    const matrix=i=>{if(matrices.has(i))return matrices.get(i);const n=g.nodes[i],m=new THREE.Matrix4();if(n.matrix)m.fromArray(n.matrix);else m.compose(new THREE.Vector3(...(n.translation||[0,0,0])),new THREE.Quaternion(...(n.rotation||[0,0,0,1])),new THREE.Vector3(...(n.scale||[1,1,1])));if(parents.has(i))m.premultiply(matrix(parents.get(i)));matrices.set(i,m);return m;};
    return g.nodes.flatMap((n,i)=>{if(n.mesh===undefined)return [];const meta={};for(let p=i;p!==undefined;p=parents.get(p))for(const [k,v]of Object.entries(g.nodes[p].extras||{}))if(meta[k]===undefined)meta[k]=v;
      const bounds=new THREE.Box3(),triangles=[],vertices=[],topology=[];
      for(const primitive of g.meshes[n.mesh].primitives){assert.equal(primitive.mode??4,4);const a=g.accessors[primitive.attributes.POSITION],v=g.bufferViews[a.bufferView],offset=(a.byteOffset||0)+(v.byteOffset||0),stride=v.byteStride||12,points=[];assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');
        for(let k=0;k<a.count;k++){const p=offset+k*stride,point=new THREE.Vector3(bin.readFloatLE(p),bin.readFloatLE(p+4),bin.readFloatLE(p+8)).applyMatrix4(matrix(i));bounds.expandByPoint(point);vertices.push(point.toArray());points.push(point.toArray().map(value=>Math.round(value/.00001)).join(','));}
        let indices;if(primitive.indices===undefined)indices=Array.from({length:a.count},(_,k)=>k);else{const index=g.accessors[primitive.indices],view=g.bufferViews[index.bufferView],start=(index.byteOffset||0)+(view.byteOffset||0),size={5121:1,5123:2,5125:4}[index.componentType],reader={5121:'readUInt8',5123:'readUInt16LE',5125:'readUInt32LE'}[index.componentType];assert.ok(size);indices=Array.from({length:index.count},(_,k)=>bin[reader](start+k*(view.byteStride||size)));}topology.push(indices);for(let k=0;k<indices.length;k+=3)triangles.push(indices.slice(k,k+3).map(index=>points[index]).sort().join(';'));
      }return [{name:n.name,meta,bounds,vertices,topology,geometry:createHash('sha256').update(triangles.sort().join('\n')).digest('hex')}];
    });
  }
  const model=decode(await readFile(new URL(scheme.model,root))),previous=decode(execFileSync('git',['show',baseline+':'+scheme.model],{cwd,maxBuffer:200*1024*1024}));
  const bounds=items=>items.reduce((b,item)=>b.union(item.bounds),new THREE.Box3());
  const exact=(actual,expected,label,tolerance=.00004)=>assert.ok(actual.every((v,i)=>Math.abs(v-expected[i])<tolerance),label+' '+JSON.stringify({actual,expected}));
  for(const p of g.parts){const parts=model.filter(m=>m.meta.garagePartId===p.id);assert.equal(parts.length,1,'Actual garage part '+p.id);const box=bounds(parts);exact(box.min.toArray(),[p.x/100,p.zCm/100,p.y/100],p.id+' lower');exact(box.max.toArray(),[(p.x+p.w)/100,(p.zCm+p.hCm)/100,(p.y+p.d)/100],p.id+' upper');}
  for(const f of g.items){const parts=model.filter(m=>m.meta.garageItemId===f.id);assert.ok(parts.length>10,'Real vehicle geometry '+f.id);const box=bounds(parts),z=f.zCm||0;assert.ok(box.min.x>=f.x/100-.00004&&box.max.x<=(f.x+f.w)/100+.00004&&box.min.z>=f.y/100-.00004&&box.max.z<=(f.y+f.d)/100+.00004&&box.min.y>=z/100-.00004&&box.max.y<=(z+f.hCm)/100+.00004,'Actual vehicle lies inside source volume '+f.id);assert.ok(box.min.y<z/100+.02,'Actual vehicle base '+f.id);}
  for(const p of fitout.parts.filter(p=>p.role!=='dining_accessories')){const parts=model.filter(m=>m.meta.storagePartId===p.id);assert.ok(parts.length,'Actual L-sideboard part '+p.id);const b=bounds(parts);assert.ok(b.min.x>=p.x/100-.025&&b.max.x<=(p.x+p.w)/100+.025&&b.min.z>=p.y/100-.025&&b.max.z<=(p.y+p.d)/100+.025,'Actual cabinet parts remain in their separate source envelope '+p.id);}
  const sofaMeshes=model.filter(m=>m.meta.furnitureName==='三人沙发'),rug=sofaMeshes.filter(m=>/Subtle flatwoven living rug/.test(m.name));assert.equal(rug.length,1);const rb=bounds(rug),r=sofa.rugCm;exact([rb.min.x,rb.min.z,rb.max.x,rb.max.z],[r.x/100,r.y/100,(r.x+r.w)/100,(r.y+r.d)/100],'Actual rug is cropped inside living wall');
  const sb=bounds(sofaMeshes.filter(m=>!rug.includes(m)));exact([sb.min.x,sb.min.z,sb.max.x,sb.max.z],[sofa.x/100,sofa.y/100,(sofa.x+sofa.w)/100,(sofa.y+sofa.d)/100],'Actual sofa footprint');
  const lamps=previous.filter(m=>floorLight(m.name)&&Math.abs(m.bounds.getCenter(new THREE.Vector3()).x-3.35)<.015&&Math.abs(m.bounds.getCenter(new THREE.Vector3()).z-7.35)<.015);assert.equal(lamps.length,4,'Four identifiable floor-lamp components');const lampNames=new Set(lamps.map(m=>m.name));
  const moved=m=>diningLight(m.name)?[0,0,-.60]:lampNames.has(m.name)?[-.87,0,.90]:/餐桌|餐椅/.test(m.meta.furnitureName||'')?[0,0,-.60]:m.meta.furnitureName==='茶几'?[shift/100,0,0]:m.meta.furnitureName==='三人沙发'&&!/Subtle flatwoven living rug/.test(m.name)&&width===220?[shift/100,0,0]:null;
  const garageLeaf=m=>m.meta.garagePartId==='hinged-leaf'||folds.some(p=>p.id===m.meta.garagePartId);
  const excluded=m=>garageLeaf(m)||m.meta.storageFitoutId==='dining_sideboard_wall'||m.meta.furnitureName==='三人沙发'||moved(m);
  const oldProtected=new Map(previous.filter(m=>!excluded(m)).map(m=>[m.name,m.geometry])),newProtected=new Map(model.filter(m=>!excluded(m)).map(m=>[m.name,m.geometry]));
  assert.ok(oldProtected.size>1000,'Substantial actual unrelated triangle protection');assert.deepEqual([...newProtected.keys()].sort(),[...oldProtected.keys()].sort(),'Only authorized groups can change');for(const [name,hash]of oldProtected)assert.equal(newProtected.get(name),hash,'Unchanged actual world triangles '+name);
  let rigidCount=0;for(const old of previous){const translation=moved(old);if(!translation)continue;const current=model.find(m=>m.name===old.name);assert.ok(current,'Preserved moving component '+old.name);assert.deepEqual(current.topology,old.topology,'Rigid topology '+old.name);assert.equal(current.vertices.length,old.vertices.length,'Rigid vertex count '+old.name);const delta=new THREE.Vector3(...translation),expected=old.bounds.clone().translate(delta);exact(current.bounds.min.toArray(),expected.min.toArray(),'Rigid lower '+old.name);exact(current.bounds.max.toArray(),expected.max.toArray(),'Rigid upper '+old.name);old.vertices.forEach((p,i)=>exact(current.vertices[i],p.map((v,j)=>v+translation[j]),'Every rigid vertex '+old.name+'/'+i));rigidCount++;}
  assert.equal(previous.filter(m=>diningLight(m.name)).length,8,'Both complete pendants preserved');
  console.log(`PASS family flow GLB: ${g.parts.length} exact garage solids, two actual raised/lower vehicles, exact sofa/rug bounds, ${rigidCount} fully checked rigid components, ${oldProtected.size} protected world-triangle meshes.`);
}
console.log(`PASS family flow 3.5.2: external two-leaf parking, non-overlapping L-corner, ${width} cm sofa +${shift} cm east, lamp off hall, ${takeoutPoses} extraction poses and ${seen.size} swept-connected walk points / 8 rooms. Hardware sweep/lifting still require actual-site checks.`);
}
