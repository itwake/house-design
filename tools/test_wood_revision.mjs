// Scheme-one V3.9.0 guard. This is a model-fit check, NOT an installation or
// structural certificate. --glb decodes actual vertices, never accessor bounds.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import * as THREE from '../vendor/three/three.module.js';

const root=new URL('../',import.meta.url),cwd=fileURLToPath(root);
export const woodBaseline='a2b4adfd4c92c9424b28df55c61609cb1049deec';
const json=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const before=p=>JSON.parse(execFileSync('git',['show',`${woodBaseline}:${p}`],{cwd,encoding:'utf8',maxBuffer:30*1024*1024}));
const near=(a,b,label,tol=1e-6)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=tol,`${label}: ${a} != ${b}`);
const rect=f=>[f.x,f.y,f.w,f.d];
const overlap=(a,b)=>Math.min(a.x+a.w,b.x+b.w)>Math.max(a.x,b.x)+1e-6&&Math.min(a.y+a.d,b.y+b.d)>Math.max(a.y,b.y)+1e-6;
const height=f=>f.heightCm??f.hCm;
const volume=f=>({...f,zCm:f.zCm??0,hCm:height(f)});
const overlap3=(a,b)=>overlap(a,b)&&Math.min(a.zCm+height(a),b.zCm+height(b))>Math.max(a.zCm,b.zCm)+1e-6;
const inside=(a,b)=>a.x>=b.x-1e-6&&a.y>=b.y-1e-6&&a.x+a.w<=b.x+b.w+1e-6&&a.y+a.d<=b.y+b.d+1e-6;
const omit=(o,keys)=>Object.fromEntries(Object.entries(o).filter(([k])=>!keys.includes(k)));
const identity=f=>f.id||f.name;
const changedOldNames=new Set(['主卧1500床','次卧1350床','次卧衣柜','主卧衣柜','书房日床','1100书桌','书房办公椅','书房客衣柜','洗烘塔','阳台家政柜','主卫750浴室柜','主卫壁挂马桶']);
const shiftedNames=new Map([['三人沙发',[-20,-45]],['茶几',[-20,-45]],['电视薄柜',[-20,0]]]);

async function unchangedOtherSchemes(){
  const paths=['models/schemes/family','models/schemes/laundry','assets/schemes/family','assets/schemes/laundry'];
  const lines=execFileSync('git',['ls-tree','-r',woodBaseline,...paths],{cwd,encoding:'utf8'}).trim().split('\n');
  const files=lines.map(l=>{const [meta,path]=l.split('\t');return {sha:meta.split(' ')[2],path};});
  assert.ok(files.length>=47,'Both other schemes have broad independent byte coverage');
  const hashes=execFileSync('git',['hash-object','--stdin-paths'],{cwd,encoding:'utf8',input:files.map(f=>f.path).join('\n')+'\n'}).trim().split('\n');
  files.forEach((f,i)=>assert.equal(hashes[i],f.sha,`Unrequested scheme remains byte-identical: ${f.path}`));
  return files.length;
}

function pointInside(x,y,points){
  // Inclusive edges: cabinets may touch an internal wall, but not cross it.
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const [ax,ay]=points[j],[bx,by]=points[i],cross=(x-ax)*(by-ay)-(y-ay)*(bx-ax);
    if(Math.abs(cross)<1e-6&&x>=Math.min(ax,bx)-1e-6&&x<=Math.max(ax,bx)+1e-6&&y>=Math.min(ay,by)-1e-6&&y<=Math.max(ay,by)+1e-6)return true;
  }
  let result=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const [ax,ay]=points[j],[bx,by]=points[i];
    if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)result=!result;
  }
  return result;
}

function inRoom(f,room){
  for(const x of [f.x,f.x+f.w/2,f.x+f.w])for(const y of [f.y,f.y+f.d/2,f.y+f.d])assert.ok(pointInside(x,y,room.points),`${f.name||f.id}: furniture remains in ${room.id}, at ${x}/${y}`);
}

function checkSource(d,old){
  assert.equal(d.version,'3.9.0');
  assert.equal(d.woodRevision?.version,'3.9.0','Explicit scheme-one revision');
  assert.equal(d.unit,'cm');
  for(const key of ['unit','envelope','windows','kitchenFitout','purchasedFurnitureRevision','livingBayRevision','kitchenReference'])assert.deepEqual(d[key],old[key],`No unrequested architectural/product/kitchen change: ${key}`);
  const expectedWalls=structuredClone(old.walls);assert.deepEqual(expectedWalls[14],[681,960,681,1121]);
  expectedWalls[14]=[652.25,960,652.25,1121];expectedWalls.push([652.25,960,681,960]);
  assert.deepEqual(d.walls,expectedWalls,'Only inner balcony partition and north return change');
  for(const s of old.wallSpecs){const current=d.wallSpecs.find(v=>v.id===s.id);assert.deepEqual(omit(current,['source','grade','coords']),omit(s,['source','grade','coords']));assert.deepEqual(current.coords,JSON.stringify(s.coords)==='[681,960,681,1121]'?expectedWalls[14]:s.coords);}
  assert.equal(d.wallSpecs.length,old.wallSpecs.length+1);assert.deepEqual(d.wallSpecs.at(-1).coords,expectedWalls.at(-1));
  for(const door of old.doors){const current=d.doors.find(v=>v.id===door.id);if(door.id!=='balcony_door')assert.deepEqual(current,door);else assert.deepEqual([current.x1,current.x2,current.y1,current.y2],[652.25,652.25,960,1110]);}
  for(const room of old.rooms){const current=d.rooms.find(v=>v.id===room.id);if(!['living','balcony'].includes(room.id))assert.deepEqual(current,room);else {const points=room.id==='balcony'?[[658.25,966],[829,966],[829,1115],[658.25,1115]]:room.points.flatMap(p=>p[0]===675&&p[1]===1115?[[675,954],[646.25,954],[646.25,1115]]:[p]);assert.deepEqual(current.points,points);}}
  assert.equal(d.measurementRevision.version,'3.6.1');
  assert.equal(d.measurementRevision.stage,'partial-confirmed');
  assert.equal(d.measurementRevision.oldEnvelope,true);
  assert.equal(d.layout.measured,false);
  for(const key of ['source','applied'])assert.deepEqual(d.measurementRevision[key],old.measurementRevision[key],`Survey evidence ${key} is not rewritten by furniture design`);
  const purchased=d.furniture.filter(f=>f.purchasedProductId);
  assert.equal(purchased.length,6);
  for(const f of purchased){const prior=old.furniture.find(v=>v.purchasedProductId===f.purchasedProductId&&v.name===f.name&&v.id===f.id);const expected=structuredClone(prior);if(f.name==='三人沙发'){expected.x-=20;expected.y-=45;expected.rugCm.x-=20;expected.rugCm.y-=45;}assert.deepEqual(f,expected,'Purchased sizes exact, only sofa translates');}
  const oldProtected=old.furniture.filter(f=>!changedOldNames.has(f.name));
  for(const item of oldProtected){const expected=structuredClone(item),shift=shiftedNames.get(item.name);if(shift){expected.x+=shift[0];expected.y+=shift[1];if(expected.rugCm){expected.rugCm.x+=shift[0];expected.rugCm.y+=shift[1];}}const current=d.furniture.find(f=>identity(f)===identity(item));if(item.name==='主卫淋浴区'){assert.equal(current.screenAnchor,'south');assert.equal(current.screenLengthCm,60);assert.deepEqual(omit(current,['screenAnchor','screenLengthCm','notes']),expected);}else assert.deepEqual(current,expected,`Protected furniture size/pose ${identity(item)}`);}
  const exactNew=[
    ['主卧1500床',[465,60,210,160]],['次卧1350床',[12,120,210,145]],
    ['主卧衣柜',[325,12,60,220]],['次卧衣柜',[283,12,30,310]],
    ['主卧北侧床头柜',[625,16,45,40]],['主卧南侧小书桌',[595,272,80,50]],['主卧小桌配椅',[613,229,44,43]],
    ['次卧南侧床头柜',[12,272,40,40]],['次卧北侧小书桌',[12,12,80,50]],['次卧小桌配椅',[30,67,44,45]],
    ['书房通长桌',[12,565,301,55]],['书房北墙沙发',[16.5,334,190,80]],['书房办公椅',[155,510,48,50]],
    ['主卫750浴室柜',[424,423,75,40]],['主卫壁挂马桶',[533,428,36,58]],['阳台并排洗烘浅盆台',[661,1040,142,75]]
  ];
  assert.equal(d.furniture.length,oldProtected.length+exactNew.length,'Only the sixteen specified replacements/additions are present');
  for(const[name,bounds]of exactNew){const f=d.furniture.find(f=>f.name===name);assert.ok(f,`Requested fixture ${name}`);assert.deepEqual(rect(f),bounds,`Reviewed exact footprint ${name}`);}
  const bayPhysical=fit=>omit(fit,fit.openingId==='window_b'?['summary']:[]);
  assert.deepEqual(d.bayFitouts.filter(f=>f.openingId!=='window_a').map(bayPhysical),old.bayFitouts.filter(f=>f.openingId!=='window_a').map(bayPhysical),'Other bay cushions and tea corner unchanged apart from the secondary-room explanation');
  const bay=d.bayFitouts.find(f=>f.openingId==='window_a');
  assert.ok(!bay||bay.parts.length===0,'Master bay desktop, supports, accessories and high chair removed together');
  assert.ok(!d.furniture.some(f=>/飘窗/.test(f.name)&&/桌|椅/.test(f.name)),'No duplicate bay desk represented as loose furniture');
  const get=name=>{const items=d.furniture.filter(f=>f.name===name);assert.equal(items.length,1,`Exactly one ${name}`);return items[0];};
  const masterBed=get('主卧1500床'),bed=get('次卧1350床'),masterWardrobe=get('主卧衣柜'),wardrobe=get('次卧衣柜');
  const roomA=d.rooms.find(r=>r.id==='room_a'),roomB=d.rooms.find(r=>r.id==='room_b'),roomC=d.rooms.find(r=>r.id==='room_c');
  assert.deepEqual(omit(masterBed,['y','roomId']),omit(old.furniture.find(f=>f.name===masterBed.name),['y','roomId']),'Master bed only shifts 22 cm north; bed is not shrunk to fake a fit');
  assert.deepEqual([bed.w,bed.d,bed.mattressWidthCm,bed.mattressLengthCm],[210,145,135,200],'Existing secondary bed dimensions retained');
  near(bed.x,12,'Secondary headboard flush to west inner wall');
  assert.equal(bed.headDirection,'west');
  near(masterWardrobe.x,325,'Master wardrobe remains west-wall bed-foot cabinet');
  near(masterWardrobe.y,12,'Master wardrobe extends to north inner wall');
  near(masterWardrobe.w,60,'Master wardrobe full cabinet depth');
  assert.equal(masterWardrobe.face,'east');
  assert.ok(masterWardrobe.y+masterWardrobe.d<=242,'Master cabinet preserves full 80 cm entrance strip north of the door');
  near(wardrobe.x+wardrobe.w,313,'Secondary wardrobe flush to east inner wall');
  near(wardrobe.y,12,'Secondary wardrobe extends to north wall');
  assert.equal(wardrobe.face,'west');
  assert.ok(wardrobe.y+wardrobe.d<=322,'Secondary wardrobe does not occupy recessed entry vestibule');
  const secondaryAisle=wardrobe.x-(bed.x+bed.w);
  assert.ok(secondaryAisle>=55,'Secondary wardrobe must not silently leave a 31 cm passage');
  if(wardrobe.w<50)assert.match(JSON.stringify(wardrobe)+JSON.stringify(d.woodRevision),/浅|非标准|侧挂|折叠|300|30|待确认/,'Shallow secondary cabinet must be disclosed, not called a normal hanging wardrobe');
  for(const f of [masterBed,masterWardrobe])inRoom(f,roomA);
  for(const f of [bed,wardrobe])inRoom(f,roomB);
  const bedrooms=[];
  for(const [prefix,room,bedItem] of [['主卧',roomA,masterBed],['次卧',roomB,bed]]){
    const one=re=>{const list=d.furniture.filter(f=>f.name.startsWith(prefix)&&re.test(f.name));assert.equal(list.length,1,`${prefix}: one ${re}`);return list[0];};
    const nightstand=one(/床头柜/),desk=one(/小书桌|小写字台/),chair=one(/椅/);
    for(const f of [nightstand,desk,chair]){inRoom(f,room);assert.ok(!overlap(f,bedItem),`${f.name}: no bed collision`);}
    assert.ok((nightstand.y+nightstand.d<=bedItem.y&&desk.y>=bedItem.y+bedItem.d)||(desk.y+desk.d<=bedItem.y&&nightstand.y>=bedItem.y+bedItem.d),`${prefix}: nightstand and desk on opposite long bed sides`);
    const bedroomFurniture=d.furniture.filter(f=>[bedItem,nightstand,desk,chair,prefix==='主卧'?masterWardrobe:wardrobe].includes(f));
    for(let i=0;i<bedroomFurniture.length;i++)for(let j=i+1;j<bedroomFurniture.length;j++)assert.ok(!overlap(bedroomFurniture[i],bedroomFurniture[j]),`${prefix}: clear closed-state ${bedroomFurniture[i].name}/${bedroomFurniture[j].name}`);
    // A tall cabinet must not consume any actual window opening width.
    const window=d.windows.find(w=>w.id===(prefix==='主卧'?'window_a':'window_b')),cab=prefix==='主卧'?masterWardrobe:wardrobe;
    assert.ok(cab.x+cab.w<=window.x1||cab.x>=window.x2,`${prefix}: north-reaching cabinet stops beside, not across, the bay opening`);
    bedrooms.push({roomId:room.id,items:bedroomFurniture});
  }
  assert.ok(!d.furniture.some(f=>['书房日床','书房客衣柜','1100书桌','洗烘塔','阳台家政柜'].includes(f.name)),'Old study bed/cabinet/short desk and stacked laundry removed');
  const sofa=d.furniture.find(f=>f.roomId==='room_c'&&/沙发/.test(f.name))||d.furniture.find(f=>/书房.*沙发/.test(f.name));
  const desk=d.furniture.find(f=>/书房/.test(f.name)&&/书桌|长桌/.test(f.name));
  assert.ok(sofa&&desk,'Small niche sofa and full study desk exist');
  inRoom(sofa,roomC);inRoom(desk,roomC);
  assert.ok(inside(sofa,{x:12,y:334,w:199,d:100}),'Small study sofa actually fits the north recess, not the adjacent door notch');
  near(desk.x,12,'Study desk starts at west wall');near(desk.x+desk.w,313,'Study desk reaches east wall');near(desk.y+desk.d,620,'Study desk uses south wall');
  const wc=get('主卫壁挂马桶'),vanity=get('主卫750浴室柜');
  assert.equal(wc.face,'north','WC looks toward north entrance');assert.equal(vanity.face,'north','Vanity mirror/back now on south side');
  assert.ok(wc.y>400,'WC moved to south side, not only relabelled');
  near(vanity.y+vanity.d,463,'Vanity back aligns with southern stepped wall');
  near(wc.y+wc.d,486,'WC body leaves 1 cm at southern wall');
  for(const f of [wc,vanity])inRoom(f,d.rooms.find(r=>r.id==='bath_1'));
  assert.ok(!overlap(wc,vanity),'Main vanity and WC footprints separate');
  const l=d.laundry;assert.ok(l&&l.machines?.length===2,'Two independent parallel appliances');
  const machines=l.machines,washer=machines.find(f=>/washer|洗衣/.test(f.id+f.name)),dryer=machines.find(f=>/dryer|烘干/.test(f.id+f.name));
  assert.ok(washer&&dryer,'Identifiable washer and dryer');
  assert.deepEqual([washer.w,washer.d,washer.heightCm],[60,53,84],'User supplied washer body, in cm');
  assert.deepEqual([dryer.w,dryer.d,dryer.heightCm],[60,60,84],'User supplied dryer body, in cm');
  for(const machine of machines){near(machine.zCm??0,0,'Appliance stands on floor');assert.equal(machine.face,'north');inRoom(machine,d.rooms.find(r=>r.id==='balcony'));assert.ok(inside(machine,l.counter),'Appliance under separate counter');}
  assert.ok(!overlap(washer,dryer),'Parallel bodies not stacked/overlapping');
  assert.ok(Math.abs(washer.x-dryer.x)>=60,'Parallel across east-west line');
  assert.ok(l.basin.bottomCm>84,'Shallow basin bottom above actual 84 cm machine tops');
  assert.ok(l.counter.zCm>84,'Countertop supported separately above machines');
  assert.ok(l.parts.filter(p=>p.role==='support'&&p.zCm===0).length>=2,'At least two floor-bearing independent supports');
  for(const machine of machines)for(const part of l.parts)assert.ok(!overlap3(volume(machine),volume(part)),`${machine.id}: no solid support/counter through body ${part.id}`);
  assert.match(JSON.stringify(l.conditions)+JSON.stringify(d.woodRevision),/安装|净空|预留|型号|待核/,'Body dimensions distinguished from installation allowance');
  assert.ok(!l.bookcase,'Scheme-three balcony reference does not import unrequested living bookwall');
  assert.deepEqual(l.localEnvelope,{x:658.25,y:966,w:152.75,d:149});
  near(l.partition.conservativeWidthCm,124+28.75,'Measured width plus inner partition borrowing');
  near(l.partition.modelWidthCm-l.partition.conservativeWidthCm,18,'Old envelope discrepancy remains excluded');
  for(const f of [l.counter,...l.machines])assert.ok(inside(f,l.localEnvelope),'No furniture uses unresolved east 18 cm band');
  near(l.counter.y-966,74,'Front operation aisle');
  assert.ok(get('三人沙发').y+get('三人沙发').d<=960,'Sofa does not close north balcony access');
  if(!process.argv.includes('--draft'))assert.match(JSON.stringify(l.conditions)+JSON.stringify(d.woodRevision),/1240|124厘米|124cm/,'Confirmed 1240 mm balcony width cannot be silently replaced by the 1420 mm old model');
  assert.match(JSON.stringify(d.appearance)+JSON.stringify(d.woodRevision),/瓷砖|porcelain|tile/,'All-room tile design explicit');
  return {bedrooms,masterWardrobe,wardrobe,secondaryAisle,sofa,desk,wc,vanity,l,oldProtected};
}

function decode(bytes,normalizePose=false){
  assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  let g,bin;for(let p=12;p<bytes.length;){const n=bytes.readUInt32LE(p),type=bytes.readUInt32LE(p+4),data=bytes.subarray(p+8,p+8+n);if(type===0x4e4f534a)g=JSON.parse(data.toString());if(type===0x004e4942)bin=data;p+=8+n;}assert.ok(g&&bin);
  const parents=new Map(),matrices=new Map();g.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>parents.set(c,i)));
  const matrix=i=>{if(matrices.has(i))return matrices.get(i);const n=g.nodes[i],m=new THREE.Matrix4();if(n.matrix)m.fromArray(n.matrix);else m.compose(new THREE.Vector3(...(n.translation??[0,0,0])),new THREE.Quaternion(...(n.rotation??[0,0,0,1])),new THREE.Vector3(...(n.scale??[1,1,1])));if(parents.has(i))m.premultiply(matrix(parents.get(i)));matrices.set(i,m);return m;};
  return g.nodes.flatMap((n,i)=>{
    if(n.mesh===undefined)return[];const meta={};for(let p=i;p!==undefined;p=parents.get(p))for(const[k,v]of Object.entries(g.nodes[p].extras??{}))if(meta[k]===undefined)meta[k]=v;
    const bounds=new THREE.Box3(),triangles=[],coordinates=[],topology=[];let vertexCount=0;
    for(const primitive of g.meshes[n.mesh].primitives){
      assert.equal(primitive.mode??4,4,'Mesh triangles');const a=g.accessors[primitive.attributes.POSITION],v=g.bufferViews[a.bufferView];assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');assert.ok(!a.sparse);
      const points=[],at=(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??12;
      let shift=normalizePose?shiftedNames.get(meta.furnitureName):null;
      if(normalizePose&&meta.purchasedFurnitureRug)shift=[-20,-45];
      if(normalizePose&&meta.woodRevisionPoseOnly&&meta.roomId==='living'&&!meta.furnitureId&&/^(Lamp base|Lamp upright|Pleated linen lampshade|Warm lamp bulb)/.test(n.name))shift=[0,-88];
      if(normalizePose&&meta.furnitureName==='主卫淋浴区'&&n.name.startsWith('Clear shower folding screen'))shift=[0,77];
      if(normalizePose&&meta.furnitureName==='主卫淋浴区'&&n.name.startsWith('Shower glass upright'))shift=[0,137];
      if(meta.woodRevisionPoseOnly){assert.ok(shift,'Pose-only mesh must match an exact allowed ensemble');assert.deepEqual(meta.poseTranslationCm,[...shift,0]);}
      for(let j=0;j<a.count;j++){const p=at+j*stride,point=new THREE.Vector3(bin.readFloatLE(p),bin.readFloatLE(p+4),bin.readFloatLE(p+8)).applyMatrix4(matrix(i));bounds.expandByPoint(point);if(shift){point.x-=shift[0]/100;point.z-=shift[1]/100;}coordinates.push(...point.toArray());points.push(point.toArray().map(q=>Math.round(q/1e-4)).join(','));}vertexCount+=a.count;
      let indices;if(primitive.indices===undefined)indices=Array.from({length:a.count},(_,k)=>k);else{const ia=g.accessors[primitive.indices],iv=g.bufferViews[ia.bufferView],start=(ia.byteOffset??0)+(iv.byteOffset??0),size={5121:1,5123:2,5125:4}[ia.componentType],read={5121:'readUInt8',5123:'readUInt16LE',5125:'readUInt32LE'}[ia.componentType];assert.ok(size);indices=Array.from({length:ia.count},(_,k)=>bin[read](start+k*(iv.byteStride??size)));}
      for(let j=0;j<indices.length;j+=3)triangles.push(indices.slice(j,j+3).map(index=>points[index]).sort().join(';'));
      topology.push(indices);
    }
    return[{name:n.name,meta,bounds,vertexCount,coordinates,topology,geometry:createHash('sha256').update(triangles.sort().join('\n')).digest('hex')}];
  });
}
const union=meshes=>meshes.reduce((b,m)=>b.union(m.bounds),new THREE.Box3());
function exactBounds(meshes,source,label,{vertical=true,tol=.001}={}){
  assert.ok(meshes.length,`${label}: actual tagged geometry exists`);const b=union(meshes),z=source.zCm??0;
  const actual=[b.min.x,b.min.z,b.max.x,b.max.z],expected=[source.x,source.y,source.x+source.w,source.y+source.d].map(v=>v/100);
  actual.forEach((v,i)=>near(v,expected[i],`${label}: plan bound ${i}`,tol));
  if(vertical&&height(source)!==undefined){near(b.min.y,z/100,`${label}: actual minimum elevation`,tol);near(b.max.y,(z+height(source))/100,`${label}: actual maximum elevation`,tol);}
  return b;
}

function chairBounds(meshes,source){
  // The declared chair rectangle is a conservative occupancy envelope, not
  // purchased manufacturer geometry. Seat and back have 10–15 mm edge insets.
  assert.ok(meshes.length);const b=union(meshes);
  const actual=[b.min.x,b.min.z,b.max.x,b.max.z],expected=[source.x,source.y,source.x+source.w,source.y+source.d].map(v=>v/100);
  actual.forEach((v,i)=>{assert.ok(i<2?v>=expected[i]-.001:v<=expected[i]+.001,'Chair stays inside declared occupancy');near(v,expected[i],source.name+' chair inset',.02)});
  near(b.min.y,0,source.name+' feet touch floor',.001);
  assert.ok(b.max.y<=source.heightCm/100+.001);near(b.max.y,source.heightCm/100,source.name+' back in allocated height',.02);
}

async function checkGlb(d,source){
  const path='models/schemes/wood/huiyayuan-wood.glb',now=decode(await readFile(new URL(path,root)),true),old=decode(execFileSync('git',['show',`${woodBaseline}:${path}`],{cwd,maxBuffer:200*1024*1024}));
  // A rigid translation can move float32 vertices across hash-rounding bins.
  // Prove every actual vertex and index against the named old mesh instead of
  // treating either the metadata flag or rounded hash as sufficient evidence.
  for(const mesh of now.filter(m=>m.meta.woodRevisionPoseOnly)){
    const prior=old.find(m=>m.name===mesh.name&&m.meta.furnitureName===mesh.meta.furnitureName);
    assert.ok(prior,'Translated original mesh exists: '+mesh.name);
    assert.deepEqual(mesh.topology,prior.topology,'Rigid translation preserves topology');
    assert.equal(mesh.coordinates.length,prior.coordinates.length);
    mesh.coordinates.forEach((v,i)=>near(v,prior.coordinates[i],mesh.name+' normalized vertex '+i,.00001));
    mesh.geometry=prior.geometry;
  }
  const furniture=f=>now.filter(m=>m.meta.furnitureName===f.name&&!/rug/i.test(m.name));
  for(const room of source.bedrooms)for(const f of room.items){if(f.woodRole==='chair')chairBounds(furniture(f),f);else exactBounds(furniture(f),f,f.name,{vertical:f.heightCm!==undefined});}
  for(const f of [source.sofa,source.desk])exactBounds(furniture(f),f,f.name,{vertical:f.heightCm!==undefined});
  const floors=now.filter(m=>m.meta.kind==='floor');assert.ok(floors.length>=8,'Every room has actual floor geometry');
  floors.forEach(m=>assert.equal(m.meta.floorFinish,'porcelain-tile',`${m.name}: no timber floor remains`));
  assert.ok(!now.some(m=>['a_desktop','a_support','a_accessories','a_chair'].includes(m.meta.fitoutPartId)||m.meta.fitoutId==='bay_a_office_vanity'&&m.meta.kind==='furniture'),'Old master bay furniture meshes absent');
  const l=source.l,machineBounds=[];
  for(const machine of l.machines){const parts=now.filter(m=>m.meta.laundryMachineId===machine.id);assert.ok(parts.length>=10,`${machine.id}: distinct controls, body and door geometry`);machineBounds.push(exactBounds(parts,machine,machine.id));}
  for(const part of l.parts)exactBounds(now.filter(m=>m.meta.laundryPartId===part.id),part,part.id);
  const basin=now.filter(m=>m.meta.laundryBasin);assert.ok(basin.length>=5,'True shallow basin and rear service components');
  for(const b of machineBounds)for(const part of now.filter(m=>m.meta.laundryPartId||m.meta.laundryBasin)){const size=b.clone().intersect(part.bounds).getSize(new THREE.Vector3());assert.ok(size.x<=.0001||size.y<=.0001||size.z<=.0001,`Real body does not intersect basin/support/pipe ${part.name}`);}
  const wc=furniture(source.wc),vanity=furniture(source.vanity);assert.ok(wc.some(m=>m.meta.toiletFace==='north'),'WC exported geometry carries explicit actual north orientation');
  assert.ok(vanity.every(m=>m.meta.vanityFace==='north'||m.meta.furnitureFace==='north'),'Vanity exported north orientation');
  const mirrors=vanity.filter(m=>/mirror/i.test(m.name));assert.ok(mirrors.length>=1,'Actual vanity mirror');
  mirrors.forEach(m=>assert.ok(m.bounds.min.z>=(source.vanity.y+source.vanity.d-5)/100,'Mirror physically located at southern cabinet back, not merely renamed'));
  const showerScreen=now.filter(m=>m.meta.furnitureName==='主卫淋浴区'&&m.name.startsWith('Clear shower folding screen'));
  assert.equal(showerScreen.length,1);near(showerScreen[0].bounds.min.z,4.19,'Actual south screen start',.001);near(showerScreen[0].bounds.max.z,4.79,'Actual south screen end',.001);
  const showerUpright=now.filter(m=>m.meta.furnitureName==='主卫淋浴区'&&m.name.startsWith('Shower glass upright'));
  assert.equal(showerUpright.length,1);near((showerUpright[0].bounds.min.z+showerUpright[0].bounds.max.z)/2,4.79,'Actual south upright center',.001);
  // All source architecture is frozen. The revision may replace floor finish,
  // selected furniture and their decorations; whole-house meshes are not exempt.
  const protectedMesh=m=>m.meta.kind==='wall'||m.meta.kind==='window'||m.meta.kind==='door'||m.meta.wallIndex!==undefined||m.meta.openingId&&!m.meta.fitoutId&&m.meta.kind!=='furniture'||m.meta.purchasedProductId;
  const balconyArchitecture=m=>m.meta.openingId==='balcony_door'||m.meta.wallIndex===14||m.meta.woodPartitionRevisionId===d.woodRevision.id||/^Skirting 14/.test(m.name);
  const oldProtected=old.filter(m=>protectedMesh(m)&&!balconyArchitecture(m)),newProtected=now.filter(m=>protectedMesh(m)&&!balconyArchitecture(m));
  assert.ok(oldProtected.length>300,'Broad actual architectural/product mesh coverage');
  assert.deepEqual(newProtected.map(m=>m.geometry).sort(),oldProtected.map(m=>m.geometry).sort(),'Every existing wall, door, window and purchased product world triangle remains unchanged');
  const knownReplacementNames=new Set(d.furniture.filter(f=>!source.oldProtected.some(p=>identity(p)===identity(f))).map(f=>f.name));
  const allowed=m=>balconyArchitecture(m)||m.meta.kind==='floor'||changedOldNames.has(m.meta.furnitureName)||m.meta.fitoutId==='bay_a_office_vanity'||m.meta.woodRevisionId===d.woodRevision.id&&(knownReplacementNames.has(m.meta.furnitureName)||m.meta.laundryPartId||m.meta.laundryMachineId||m.meta.laundryBasin||m.meta.wallFitoutId==='study_bookwall'||m.meta.furnitureId==='study_bookwall');
  const originalProtected=old.filter(m=>!allowed(m)),currentProtected=now.filter(m=>!allowed(m));
  assert.ok(originalProtected.length>700,'Whole-model protection beyond architecture and selected product meshes');
  const missing=originalProtected.filter(m=>!currentProtected.some(n=>n.geometry===m.geometry)),extra=currentProtected.filter(m=>!originalProtected.some(n=>n.geometry===m.geometry));
  if(missing.length||extra.length)throw new Error('Protected geometry mismatch: '+JSON.stringify({missing:missing.map(m=>({name:m.name,furniture:m.meta.furnitureName,part:m.meta.fitoutPartId,bounds:[...m.bounds.min.toArray(),...m.bounds.max.toArray()]})),extra:extra.map(m=>({name:m.name,furniture:m.meta.furnitureName,part:m.meta.fitoutPartId,bounds:[...m.bounds.min.toArray(),...m.bounds.max.toArray()]}))}));
  assert.deepEqual(currentProtected.map(m=>m.geometry).sort(),originalProtected.map(m=>m.geometry).sort(),'All world triangles outside exact named furniture, master bay parts, study bookwall, laundry and floor finish remain unchanged');
  for(const f of source.oldProtected.filter(f=>!f.kitchenFitoutId)){
    const a=old.filter(m=>m.meta.furnitureName===f.name),b=now.filter(m=>m.meta.furnitureName===f.name);if(!a.length)continue;
    assert.deepEqual(b.map(m=>m.geometry).sort(),a.map(m=>m.geometry).sort(),`Unchanged actual furniture triangles: ${f.name}`);
  }
  return {meshCount:now.length,protectedArchitectureAndProductMeshes:oldProtected.length,allProtectedMeshes:originalProtected.length,floorMeshes:floors.length,exactLaundryBodies:2};
}

const data=await json('models/schemes/wood/design-data.json'),old=before('models/schemes/wood/design-data.json');
const report={version:'3.9.0',baseline:woodBaseline,unconfirmedDraft:process.argv.includes('--draft'),unchangedOtherSchemeFiles:await unchangedOtherSchemes()};
const source=checkSource(data,old);report.secondaryBedFootAisleCm=source.secondaryAisle;
if(process.argv.includes('--glb'))report.glb=await checkGlb(data,source);
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))console.log(JSON.stringify({passed:true,scope:'Scheme-one source and real geometry; provisional survey and installation limitations remain',...report},null,2));
