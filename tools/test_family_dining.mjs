// Current 3.5.3 source + actual native GLB geometry. A 50 cm camera body is a
// collision check, not an accessibility or custom-hardware certification.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as THREE from '../vendor/three/three.module.js';
import {buildWalkWorld,findWalkStart,advanceWalk,WALK_RADIUS} from '../walkthrough.js';
const root=new URL('../',import.meta.url),cwd=fileURLToPath(root);
const read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const d=await read('models/schemes/family/design-data.json'),rev=d.familyDiningRevision,p=d.pulloutDining;
const baseline='a2b623c9813c0d2a664abf31ab575fc6c0fd2b0d';
const base=JSON.parse(execFileSync('git',['show',baseline+':models/schemes/family/design-data.json'],{cwd,encoding:'utf8'}));
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-7,label||`${a} != ${b}`);
const rect=f=>[f.x,f.y,f.w,f.d],fixture=name=>d.furniture.find(f=>f.name===name);
const overlap=(a,b)=>Math.min(a.x+a.w,b.x+b.w)>Math.max(a.x,b.x)+1e-6&&Math.min(a.y+a.d,b.y+b.d)>Math.max(a.y,b.y)+1e-6;
const overlap3=(a,b)=>overlap(a,b)&&Math.min((a.zCm||0)+a.hCm,(b.zCm||0)+b.hCm)>Math.max(a.zCm||0,b.zCm||0)+1e-6;
assert.equal(rev.version,'3.5.3');assert.equal(rev.baselineCommit,baseline);assert.equal(rev.measured,false);
assert.equal(p.version,'3.5.3');assert.equal(p.id,'family_pullout_dining');assert.equal(p.initialState,'expanded');near(WALK_RADIUS,.25);
for(const key of ['unit','envelope','rooms','walls','wallSpecs','doors','windows','bayFitouts','wallFitouts','appearance','garageRevision','familyEntryRevision','familyFlowRevision'])assert.deepEqual(d[key],base[key],'Preserved calibrated geometry '+key);
const garagePhysical=g=>Object.fromEntries(Object.entries(g).filter(([k])=>k!=='metrics'));
assert.deepEqual(garagePhysical(d.garage),garagePhysical(base.garage),'Every physical garage component/item/operation is unchanged');
assert.deepEqual(Object.fromEntries(Object.entries(d.garage.metrics).filter(([k])=>k!=='southChairPulledGapCm')),Object.fromEntries(Object.entries(base.garage.metrics).filter(([k])=>k!=='southChairPulledGapCm')),'Other garage metrics unchanged');near(d.garage.metrics.southChairPulledGapCm,84.75);
assert.deepEqual(Object.fromEntries(Object.entries(d.modelAddons).filter(([k])=>k!=='livingRugCm')),Object.fromEntries(Object.entries(base.modelAddons).filter(([k])=>k!=='livingRugCm')),'Lamp and other fixed model additions preserved');
const laundryPhysical=l=>Object.fromEntries(Object.entries(l).filter(([k])=>!['conditions','dimensions','metrics'].includes(k)));
assert.deepEqual(laundryPhysical(d.laundry),laundryPhysical(base.laundry),'Physical laundry geometry is unchanged');
const metrics=l=>Object.fromEntries(Object.entries(l.metrics).filter(([k])=>k!=='sofaDiningChairGapCm'));
assert.deepEqual(metrics(d.laundry),metrics(base.laundry),'Other laundry metrics unchanged');
assert.deepEqual(d.storageFitouts.filter(f=>!['dining_sideboard_wall','sofa_back_storage'].includes(f.id)),base.storageFitouts.filter(f=>f.id!=='dining_sideboard_wall'),'Every other storage fitout unchanged');
const affected=f=>['family_sideboard','family_sofa_back_storage'].includes(f.id)||['三人沙发','茶几'].includes(f.name)||/餐桌|餐椅/.test(f.name||'');
for(const f of base.furniture.filter(f=>!affected(f)))assert.deepEqual(d.furniture.find(v=>(v.id||v.name)===(f.id||f.name)),f,'Unchanged furniture '+f.name);
assert.equal(d.furniture.length,base.furniture.length+1,'Only sofa-back aggregate added; no hidden/discarded chairs');
assert.deepEqual(rect(fixture('三人沙发')),[385,809,200,88]);assert.deepEqual(rect(fixture('茶几')),[435,707,120,62]);
assert.deepEqual(d.modelAddons.livingRugCm,{x:373,y:638,w:224,d:178});assert.deepEqual(fixture('三人沙发').rugCm,d.modelAddons.livingRugCm);
const back=d.furniture.find(f=>f.id==='family_sofa_back_storage'),backFit=d.storageFitouts.find(f=>f.id==='sofa_back_storage');
assert.deepEqual(rect(back),[385,899,200,25]);near(back.heightCm,65);assert.equal(back.face,'south');assert.equal(backFit.parts.length,1);
const backPart=backFit.parts[0];assert.deepEqual(rect(backPart),rect(back));near(backPart.hCm,65);assert.equal(backPart.face,'south');assert.equal(backPart.doorStyle,'sliding');assert.equal(backPart.drawerPanels,0);
near(back.y-(fixture('三人沙发').y+fixture('三人沙发').d),2);near(645-(back.x+back.w),60);
const side=d.storageFitouts.find(f=>f.id==='dining_sideboard_wall'),bases=side.parts.filter(q=>q.segmentId==='west-continuous'&&['sideboard_base','pullout_table_cabinet'].includes(q.role)).sort((a,b)=>a.y-b.y);
assert.deepEqual(bases.map(q=>q.d),[131,120,109,61]);assert.deepEqual(bases.map(q=>q.w),[40,44,40,40]);
let edge=859;for(const q of bases){near(q.x,212.5);near(q.y,edge);near(q.hCm,85);assert.equal(q.drawerPanels,0);edge+=q.d;}near(edge,1280);
const module=bases[1];assert.equal(module.role,'pullout_table_cabinet');assert.deepEqual(rect(module),[212.5,990,44,120]);near(module.cavityHeightCm,12);near(module.tableTopHeightCm,75);
assert.deepEqual(rect(p.module),rect(module));near(p.module.netInstallationDepthCm,40);assert.ok(p.module.netInstallationDepthCm>=39);near(p.module.minimumReferenceHeightCm,12);
for(const q of side.parts.filter(q=>q.role==='upper_cabinet'&&q.segmentId==='west-continuous'))near(q.w,28);
for(const q of base.storageFitouts.find(f=>f.id==='dining_sideboard_wall').parts.filter(q=>q.segmentId!=='west-continuous'))assert.deepEqual(side.parts.find(v=>v.id===q.id),q,'Unchanged north return / blind corner '+q.id);
for(const group of [['sideboard_base','pullout_table_cabinet','sideboard_blind_base'],['upper_cabinet','upper_blind_corner']]){const parts=side.parts.filter(q=>group.includes(q.role));for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++)assert.ok(!overlap3(parts[i],parts[j]),'No double counted cabinet corner '+parts[i].id+'/'+parts[j].id);}
assert.deepEqual(rect(p.table),[256.5,992.25,70.5,115.5]);assert.deepEqual(fixture('四人餐桌'),p.table);near(p.tableHeightCm,75);near(p.tabletopThicknessCm,2);assert.equal(p.boardCount,2);near(module.x+module.w,p.table.x,'Table starts at the local 44 cm cabinet face');
const expected=[['餐椅北1',269.75,934.75,44,45,'south'],['餐椅南1',269.75,1120.25,44,45,'north'],['餐椅东1',339.5,1000,45,44,'west'],['餐椅东2',339.5,1060,45,44,'west']];
for(const [name,x,y,w,h,face]of expected){const f=fixture(name);assert.deepEqual(rect(f),[x,y,w,h]);assert.equal(f.face,face);assert.equal(f.diningFitoutId,p.id);}
assert.equal(d.furniture.filter(f=>f.diningFitoutId===p.id).length,5);assert.equal(p.closedFurniture.length,4);
for(const [i,f]of p.closedFurniture.entries()){assert.deepEqual(rect(f),[260.5,960+i*50,45,44]);assert.equal(f.face,'east');assert.equal(f.diningFitoutId,p.id);assert.ok(/餐椅/.test(f.name));}
assert.deepEqual(p.closedFurniture.map(f=>f.name).sort(),expected.map(e=>e[0]).sort(),'All four actual full-size chairs remain visible in closed state');
assert.equal(p.closedTable.storedInsideCabinet,true);near(p.closedTable.w*2,p.table.w);near(p.closedTable.d,p.table.d);
assert.ok(p.closedTable.x>=p.module.x+2&&p.closedTable.x+p.closedTable.w<=p.module.x+p.module.w-2,'Folded boards fit nominal clear depth, not 120 cm pushed into 40 cm');
assert.ok(p.conditions.some(t=>/净|外深/.test(t)&&/认证|确认/.test(t)),'Cabinet-depth assumption has manufacturer caveat');
assert.ok(p.conditions.some(t=>/四椅|四把/.test(t)&&/停放/.test(t)),'Closed chairs remain occupying actual floor');
const active=state=>({...d,furniture:state==='closed'?d.furniture.filter(f=>f.diningFitoutId!==p.id).concat(p.closedFurniture):d.furniture});
const pulled=active('expanded');pulled.furniture=pulled.furniture.map(f=>{if(!/餐椅/.test(f.name))return f;return {...f,...(f.face==='south'?{y:f.y-30}:f.face==='north'?{y:f.y+30}:{x:f.x+30})};});
const datasets=[['expanded',active('expanded')],['expanded-pulled',pulled],['closed',active('closed')]],counts={};
near(back.x-(fixture('餐椅北1').x+fixture('餐椅北1').w),71.25);near(530-(fixture('餐椅东1').x+fixture('餐椅东1').w+30),115.5);near(1280-(fixture('餐椅南1').y+fixture('餐椅南1').d+30),84.75);near(back.x-(p.closedFurniture[0].x+p.closedFurniture[0].w),79.5);
function connected(world,label){
  for(const room of world.rooms){const at=findWalkStart(world,room.id);assert.ok(at&&world.canStand(at.x,at.z),'Safe start '+label+'/'+room.id);}
  const step=.05,key=(i,j)=>i+','+j,grid=new Map();for(let i=0;i<=169;i++)for(let j=0;j<=281;j++){const x=i*step,z=j*step;if(world.canStand(x,z))grid.set(key(i,j),{i,j,x,z});}
  const start=grid.get(key(92,260));assert.ok(start,'Entrance seed '+label);const queue=[start],seen=new Set([key(start.i,start.j)]),rooms=new Set();
  for(let head=0;head<queue.length;head++){const at=queue[head];rooms.add(world.roomAt(at.x,at.z));for(const [di,dj]of [[1,0],[-1,0],[0,1],[0,-1]]){const k=key(at.i+di,at.j+dj),to=grid.get(k);if(!to||seen.has(k))continue;const moved=advanceWalk(world,at,to.x-at.x,to.z-at.z);if(Math.hypot(moved.x-to.x,moved.z-to.z)>1e-7)continue;seen.add(k);queue.push(to);}}
  assert.deepEqual([...rooms].filter(Boolean).sort(),world.rooms.map(r=>r.id).sort(),'All eight rooms physically swept-connected '+label);return seen.size;
}
for(const [label,source]of datasets){
  const all=source.furniture.filter(f=>!f.garageFitoutId);for(const f of all.filter(f=>affected(f)))for(const q of all)if(f!==q)assert.ok(!overlap(f,q),'Non-overlapping state '+label+'/'+f.name+'/'+q.name);
  for(const f of source.furniture.filter(f=>f.diningFitoutId===p.id))for(const q of bases.concat(backPart))assert.ok(!overlap(f,q),'Real source module collision '+label+'/'+f.name+'/'+q.id);
  const world=buildWalkWorld(source);assert.ok(world.obstacles.some(o=>o.id===back.id),'Sofa back is a real obstacle '+label);
  const local=world.obstacles.filter(o=>o.id===module.id||o.id==='storage-'+module.id);assert.ok(local.some(o=>Math.abs(o.x-2.125)<1e-8&&Math.abs(o.z-9.9)<1e-8&&Math.abs(o.w-.44)<1e-8&&Math.abs(o.d-1.2)<1e-8),'Local 44 cm cabinet projection collides, not just 40 cm aggregate '+label);
  counts[label]=connected(world,label);
}
let extraction=0;for(const item of d.garage.items)for(let x=item.x;x<=362;x++){const moved={...item,x};for(const q of d.garage.parts)assert.ok(!overlap3(moved,q),'Unchanged vehicle exit '+item.id+'/'+q.id);for(const f of d.furniture.filter(f=>!f.garageFitoutId))assert.ok(!overlap(moved,f),'Vehicle exit vs '+f.name);extraction++;}
const catalog=await read('models/design-schemes.json'),scheme=catalog.schemes.find(s=>s.id==='family');assert.equal(scheme.assetRevision,'3.5.3');assert.ok(scheme.renderViews.includes('dining-closed'));assert.equal(scheme.renderViews.length,20);
if(process.argv.includes('--glb')){
  function decode(bytes){
    const length=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+length)),bin=bytes.subarray(28+length),parents=new Map(),matrices=new Map();g.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parents.set(c,i)));
    const matrix=i=>{if(matrices.has(i))return matrices.get(i);const n=g.nodes[i],m=new THREE.Matrix4();if(n.matrix)m.fromArray(n.matrix);else m.compose(new THREE.Vector3(...(n.translation||[0,0,0])),new THREE.Quaternion(...(n.rotation||[0,0,0,1])),new THREE.Vector3(...(n.scale||[1,1,1])));if(parents.has(i))m.premultiply(matrix(parents.get(i)));matrices.set(i,m);return m;};
    return g.nodes.flatMap((n,i)=>{if(n.mesh===undefined)return [];const meta={};for(let ancestor=i;ancestor!==undefined;ancestor=parents.get(ancestor))for(const [k,v]of Object.entries(g.nodes[ancestor].extras||{}))if(meta[k]===undefined)meta[k]=v;const bounds=new THREE.Box3(),triangles=[],vertices=[],topology=[];
      for(const primitive of g.meshes[n.mesh].primitives){assert.equal(primitive.mode??4,4);const a=g.accessors[primitive.attributes.POSITION],v=g.bufferViews[a.bufferView],offset=(a.byteOffset||0)+(v.byteOffset||0),stride=v.byteStride||12,points=[];assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');for(let k=0;k<a.count;k++){const at=offset+k*stride,point=new THREE.Vector3(bin.readFloatLE(at),bin.readFloatLE(at+4),bin.readFloatLE(at+8)).applyMatrix4(matrix(i));bounds.expandByPoint(point);vertices.push(point.toArray());points.push(point.toArray().map(value=>Math.round(value/.00001)).join(','));}let indices;if(primitive.indices===undefined)indices=Array.from({length:a.count},(_,k)=>k);else{const index=g.accessors[primitive.indices],view=g.bufferViews[index.bufferView],start=(index.byteOffset||0)+(view.byteOffset||0),size={5121:1,5123:2,5125:4}[index.componentType],reader={5121:'readUInt8',5123:'readUInt16LE',5125:'readUInt32LE'}[index.componentType];assert.ok(size);indices=Array.from({length:index.count},(_,k)=>bin[reader](start+k*(view.byteStride||size)));}topology.push(indices);for(let k=0;k<indices.length;k+=3)triangles.push(indices.slice(k,k+3).map(index=>points[index]).sort().join(';'));}
      return [{name:n.name,meta,bounds,vertices,topology,geometry:createHash('sha256').update(triangles.sort().join('\n')).digest('hex')}];});
  }
  const model=decode(await readFile(new URL(scheme.model,root))),previous=decode(execFileSync('git',['show',baseline+':'+scheme.model],{cwd,maxBuffer:200*1024*1024}));
  const bounds=items=>items.reduce((b,item)=>b.union(item.bounds),new THREE.Box3()),exact=(a,b,label,tol=.00004)=>assert.ok(a.every((v,i)=>Math.abs(v-b[i])<tol),label+' '+JSON.stringify({actual:a,expected:b}));
  const diningLight=name=>/^(Dining pendant ceiling rose|Pendant thin suspension|Organic linen pendant|Pendant opal diffuser)(?:[ ._]|$)/.test(name);
  const allowed=m=>['dining_sideboard_wall','sofa_back_storage'].includes(m.meta.storageFitoutId)||m.meta.diningFitoutId===p.id||/餐桌|餐椅/.test(m.meta.furnitureName||'')||['三人沙发','茶几'].includes(m.meta.furnitureName)||diningLight(m.name);
  const protectedOld=new Map(previous.filter(m=>!allowed(m)).map(m=>[m.name,m.geometry])),protectedNew=new Map(model.filter(m=>!allowed(m)).map(m=>[m.name,m.geometry]));
  assert.ok(protectedOld.size>1400,'Actual unrelated geometry coverage, including all garage doors/vehicles/lamp');assert.deepEqual([...protectedNew.keys()].sort(),[...protectedOld.keys()].sort(),'Only explicit dining/living groups can change');for(const [name,hash]of protectedOld)assert.equal(protectedNew.get(name),hash,'Unchanged actual world triangles '+name);
  const coffeeOld=previous.filter(m=>m.meta.furnitureName==='茶几');let rigid=0;for(const old of coffeeOld){const current=model.find(m=>m.name===old.name);assert.ok(current);assert.deepEqual(current.topology,old.topology);assert.equal(current.vertices.length,old.vertices.length);old.vertices.forEach((v,i)=>exact(current.vertices[i],[v[0]+.20,v[1],v[2]],'Every coffee vertex '+old.name+'/'+i));rigid++;}
  const sofaMeshes=model.filter(m=>m.meta.furnitureName==='三人沙发'),rug=sofaMeshes.filter(m=>/Subtle flatwoven living rug/.test(m.name));assert.equal(rug.length,1);const rbox=bounds(rug),sbox=bounds(sofaMeshes.filter(m=>!rug.includes(m)));exact([rbox.min.x,rbox.min.z,rbox.max.x,rbox.max.z],[3.73,6.38,5.97,8.16],'Actual exact cropped rug');exact([sbox.min.x,sbox.min.z,sbox.max.x,sbox.max.z],[3.85,8.09,5.85,8.97],'Actual 200 cm sofa footprint');
  for(const f of [side,backFit])for(const q of f.parts.filter(q=>q.role!=='dining_accessories')){const meshes=model.filter(m=>m.meta.storageFitoutId===f.id&&m.meta.storagePartId===q.id);assert.ok(meshes.length,'Actual detailed cabinet '+q.id);const box=bounds(meshes);assert.ok(box.min.x>=q.x/100-.025&&box.max.x<=(q.x+q.w)/100+.025&&box.min.z>=q.y/100-.025&&box.max.z<=(q.y+q.d)/100+.025&&box.min.y>=q.zCm/100-.025&&box.max.y<=(q.zCm+q.hCm)/100+.025,'Cabinet inside exact source xyz envelope '+q.id);}
  const expanded=model.filter(m=>m.meta.diningFitoutId===p.id&&m.meta.diningVisibility==='expanded'),closed=model.filter(m=>m.meta.diningFitoutId===p.id&&m.meta.diningVisibility==='closed');assert.ok(expanded.length>20&&closed.length>20,'Two real separately tagged furniture states, not CSS-hidden missing chairs');
  for(const [state,furn]of [['expanded',d.furniture.filter(f=>f.diningFitoutId===p.id)],['closed',p.closedFurniture]])for(const f of furn.filter(f=>/餐椅/.test(f.name))){const meshes=model.filter(m=>m.meta.diningFitoutId===p.id&&m.meta.diningVisibility===state&&m.meta.furnitureName===f.name);assert.ok(meshes.length>=6,'Full chair geometry '+state+'/'+f.name);const box=bounds(meshes);assert.ok(box.min.x>=f.x/100-.015&&box.max.x<=(f.x+f.w)/100+.015&&box.min.z>=f.y/100-.015&&box.max.z<=(f.y+f.d)/100+.015,'Chair within real state footprint '+state+'/'+f.name);assert.ok(box.max.y>=.7,'Full-height chair remains '+state+'/'+f.name);const backs=meshes.filter(m=>/chair back/i.test(m.name));assert.equal(backs.length,1,'One physical oriented chair back '+state+'/'+f.name);const cb=backs[0].bounds,center=cb.getCenter(new THREE.Vector3()),size=cb.getSize(new THREE.Vector3());if(['east','west'].includes(f.face)){assert.ok(size.x<size.z/3,'East-west back runs north-south '+f.name);assert.ok(Math.abs(center.x-(f.face==='west'?(f.x+f.w-2.5)/100:(f.x+2.5)/100))<.012,'Actual E/W chair faces requested side '+state+'/'+f.name);}else{assert.ok(size.z<size.x/3);assert.ok(Math.abs(center.z-(f.face==='south'?(f.y+2.5)/100:(f.y+f.d-2.5)/100))<.012,'Actual N/S chair faces requested side '+f.name);}}
  const tables=expanded.filter(m=>m.meta.furnitureName==='四人餐桌'&&m.meta.diningElement==='table-top');assert.equal(tables.length,2,'Exactly two real folding tabletop leaves');assert.ok(expanded.filter(m=>m.meta.diningElement==='mechanism').length>=4,'Real cantilever guides, not fabricated fixed table legs');assert.ok(!expanded.some(m=>/table.*leg|dining.*leg|tapered.*leg/i.test(m.name)&&m.meta.diningElement!=='chair'),'Pullout table is not ordinary four fixed legs');
  const tb=bounds(tables);exact([tb.min.x,tb.min.z,tb.max.x,tb.max.z],[2.565,9.9225,3.27,11.0775],'Actual 1155 by 705 mm two-leaf expanded table');exact([tb.min.y,tb.max.y],[.73,.75],'Actual 750 mm table worktop, not 850 mm counter');
  const stored=closed.filter(m=>m.meta.furnitureName==='四人餐桌'&&m.meta.diningElement==='table-top');assert.equal(stored.length,2,'Two real stored boards, not vanished table');const storedBox=bounds(stored);assert.ok(storedBox.min.x>=p.module.x/100-.00004&&storedBox.max.x<=(p.module.x+p.module.w)/100+.00004&&storedBox.min.z>=p.module.y/100-.00004&&storedBox.max.z<=(p.module.y+p.module.d)/100+.00004,'Closed table really lies inside cabinet');exact([storedBox.min.x,storedBox.min.z,storedBox.max.x,storedBox.max.z],[2.145,9.9225,2.4975,11.0775],'Stored leaf actual footprint');exact([storedBox.min.y,storedBox.max.y],[.69,.74],'Both stored boards physically occupy separate 690/720 mm levels');
  const solidOverlap=(a,b)=>['x','y','z'].every(axis=>Math.min(a.max[axis],b.max[axis])>Math.max(a.min[axis],b.min[axis])+.00001);
  const moduleMeshes=model.filter(m=>m.meta.storagePartId===module.id);
  for(const leaf of stored)for(const m of moduleMeshes)assert.ok(!solidOverlap(leaf.bounds,m.bounds),'Stored board does not intersect real cabinet solid '+leaf.name+'/'+m.name);
  const lowerShelves=moduleMeshes.filter(m=>/lower compartment shelf/.test(m.name)),fronts=moduleMeshes.filter(m=>/lower sliding front/.test(m.name));assert.equal(lowerShelves.length,1);assert.equal(fronts.length,2);
  exact([lowerShelves[0].bounds.max.x-lowerShelves[0].bounds.min.x],[.37],'Actual shortened 370 mm inner shelf leaves door-track clearance');
  for(const front of fronts){assert.ok(!solidOverlap(lowerShelves[0].bounds,front.bounds),'Shelf cannot fill the actual sliding-door track');assert.ok(front.bounds.min.x-lowerShelves[0].bounds.max.x>=.003-.00004,'At least 3 mm model clearance before moving sliding fronts');}
  let cupboardClearances=0;
  for(const fit of [side,backFit])for(const part of fit.parts.filter(q=>q.role==='sideboard_base'&&q.doorStyle==='sliding')){
    const meshes=model.filter(m=>m.meta.storageFitoutId===fit.id&&m.meta.storagePartId===part.id),shelves=meshes.filter(m=>/full-height cupboard interior shelf/.test(m.name)),doors=meshes.filter(m=>/cream sliding door/.test(m.name)),tracks=meshes.filter(m=>/sliding track/.test(m.name));
    assert.equal(shelves.length,1,'Real interior shelf of each rebuilt no-drawer lower cupboard '+part.id);assert.equal(doors.length,part.doorPanels,'Every real sliding front '+part.id);assert.equal(tracks.length,4,'Two top/bottom real tracks '+part.id);
    for(const shelf of shelves){assert.equal(shelf.meta.familyShelfFrontRetreatCm,3,'Full regeneration retains the reviewed 30 mm shelf-front retreat '+part.id);assert.equal(shelf.meta.lowerSlidingDoorTrackClearanceCm,.55,'Shelf-door clearance metadata is explicit '+part.id);for(const other of doors.concat(tracks))assert.ok(!solidOverlap(shelf.bounds,other.bounds),'Interior shelf stays out of moving door/track solids '+part.id+'/'+other.name);for(const door of doors){const gap=part.face==='west'?shelf.bounds.min.x-door.bounds.max.x:part.face==='north'?shelf.bounds.min.z-door.bounds.max.z:part.face==='south'?door.bounds.min.z-shelf.bounds.max.z:door.bounds.min.x-shelf.bounds.max.x;assert.ok(gap>=.003-.00004,'Every lower shelf leaves at least 3 mm real door clearance '+part.id+'/'+door.name+' '+gap);cupboardClearances++;}}
  }
  assert.equal(cupboardClearances,11,'Five rebuilt generic lower cupboards: four 2-leaf bases and one 3-leaf sofa-back cabinet');
  assert.equal(previous.filter(m=>diningLight(m.name)).length,8);assert.equal(model.filter(m=>diningLight(m.name)).length,8,'Both fixed decorative pendants remain in closed mode');
  console.log(`PASS family dining native GLB: ${protectedOld.size} unchanged world-triangle meshes, ${rigid} vertex-exact translated coffee components, real oriented 4+4 chairs, folded/expanded tables and ${cupboardClearances+2} actual shelf/front clearances.`);
}
console.log(`PASS family dining 3.5.3: exact 200 cm sofa/back storage/local 44 cm cabinet, no vanishing chairs, ${extraction} vehicle exit poses, 50 cm body swept-connected 8-room counts ${JSON.stringify(counts)}.`);
