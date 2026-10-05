// Family R3 / V3.10.0: reviewed-layout regression, not a construction certificate.
// --glb decodes real world vertices and indices; accessor bounds are never trusted.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import * as THREE from '../vendor/three/three.module.js';
import {buildWalkWorld, advanceWalk, findWalkStart, WALK_STARTS} from '../walkthrough.js';

const root=new URL('../',import.meta.url),cwd=fileURLToPath(root);
export const familyR3Baseline='e210bd7';
const prefix='models/schemes/family/',modelPath=prefix+'huiyayuan-wood.glb';
const read=p=>readFile(new URL(p,root));
const oldBytes=p=>execFileSync('git',['show',`${familyR3Baseline}:${p}`],{cwd,maxBuffer:200*1024*1024});
const near=(a,b,label,tolerance=1e-6)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=tolerance,`${label}: ${a} != ${b}`);
const rect=f=>[f.x,f.y,f.w,f.d],omit=(o,keys)=>Object.fromEntries(Object.entries(o).filter(([k])=>!keys.includes(k)));
const key=f=>f.id||f.name;
const privateRooms=new Set(['room_a','room_b','room_c','bath_1','bath_2']);
const changedDoors=new Set(['door_a','door_b','door_c','door_bath_1','door_bath_2']);
const changedFurniture=new Map([
  ['主卧衣柜',{x:349.5}],['次卧补齐退台的连续浅台',{x:293.5}],
  ['书房通长桌',{w:222}],['书房办公椅',{x:99}],
  ['书房北墙沙发',{x:22,w:190}],['主卫600浴室柜',{x:453}]
]);
const reviewedWalls=[
  [343.5,6,343.5,493],[6,328,343.5,328],[240,328,240,626],
  [206,626,240,626],[445,328,445,493],[445,328,681,328],
  [343.5,493,681,493],[343.5,493,343.5,626],[343.5,626,681,626]
];
const reviewedRooms={
  room_b:[[12,12],[337.5,12],[337.5,322],[12,322]],
  room_a:[[349.5,12],[675,12],[675,322],[439,322],[439,487],[349.5,487]],
  room_c:[[12,334],[234,334],[234,620],[12,620]],
  bath_1:[[451,334],[675,334],[675,487],[451,487]],
  bath_2:[[349.5,499],[675,499],[675,620],[349.5,620]],
  living:[[246,334],[337.5,334],[337.5,632],[675,632],[675,954],[646.25,954],[646.25,1115],[530,1115],[530,1389],[212,1389],[212,632],[296,632],[246,632]]
};
const reviewedDoors={
  door_a:{coords:[343.5,355,343.5,445],hinge:[343.5,439],leaf:[343.5,437,78,4],swing:{dx:0,dy:-1,ox:1,oy:0,sweep:1}},
  door_b:{coords:[246.75,328,336.75,328],hinge:[330.75,328],leaf:[328.75,250,4,78],swing:{dx:-1,dy:0,ox:0,oy:-1,sweep:1}},
  door_c:{coords:[240,448,240,538],hinge:[240,454],leaf:[162,452,78,4],swing:{dx:0,dy:1,ox:-1,oy:0,sweep:1}},
  door_bath_1:{coords:[445,374,445,449],hinge:[445,380],leaf:[445,378,63,4],swing:{dx:0,dy:1,ox:1,oy:0,sweep:0}},
  door_bath_2:{coords:[343.5,501,343.5,576],hinge:[343.5,507],leaf:[343.5,505,63,4],swing:{dx:0,dy:1,ox:1,oy:0,sweep:0}}
};
const area=p=>Math.abs(p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-b[0]*a[1];},0))/20000;
const overlap=(a,b)=>Math.min(a.x+a.w,b.x+b.w)>Math.max(a.x,b.x)+1e-6&&Math.min(a.y+a.d,b.y+b.d)>Math.max(a.y,b.y)+1e-6;
function inside(x,y,p,tolerance=1e-5){
  for(let i=0,j=p.length-1;i<p.length;j=i++){
    const [ax,ay]=p[j],[bx,by]=p[i],len=Math.hypot(bx-ax,by-ay),cross=(x-ax)*(by-ay)-(y-ay)*(bx-ax);
    if(Math.abs(cross)<=tolerance*Math.max(1,len)&&x>=Math.min(ax,bx)-tolerance&&x<=Math.max(ax,bx)+tolerance&&y>=Math.min(ay,by)-tolerance&&y<=Math.max(ay,by)+tolerance)return true;
  }
  let yes=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const [ax,ay]=p[i],[bx,by]=p[j];if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)yes=!yes;}return yes;
}
async function unchangedSchemes(){
  const dirs=['models/schemes/wood','models/schemes/laundry','assets/schemes/wood','assets/schemes/laundry'];
  const files=execFileSync('git',['ls-tree','-r',familyR3Baseline,...dirs],{cwd,encoding:'utf8'}).trim().split('\n').map(s=>{const [meta,path]=s.split('\t');return {sha:meta.split(' ')[2],path};});
  assert.ok(files.length>=47,'Broad byte protection of both unrequested schemes');
  const hashes=execFileSync('git',['hash-object','--stdin-paths'],{cwd,encoding:'utf8',input:files.map(f=>f.path).join('\n')+'\n'}).trim().split('\n');
  files.forEach((f,i)=>assert.equal(hashes[i],f.sha,`Unrequested scheme unchanged: ${f.path}`));return files.length;
}

function checkSource(d,old){
  assert.equal(d.version,'3.10.0');assert.equal(d.familyR3Revision?.version,'3.10.0');assert.equal(d.unit,'cm');
  assert.ok(!d.previewOnly,'Published data is not still labelled unconfirmed/offline preview');
  for(const field of ['envelope','windows','kitchenFitout','laundry','garage','storageFitouts','appearance','modelAddons','purchasedFurnitureRevision','familyEntryRevision','familyFlowRevision','familyLaundryRevision','livingBayRevision'])assert.deepEqual(d[field],old[field],`Protected source ${field}`);
  assert.deepEqual(d.walls,[...old.walls.slice(0,12),...reviewedWalls,...old.walls.slice(24)],'Exact user-confirmed R3 wall topology');
  assert.equal(d.wallSpecs.length,d.walls.length,'No stale wall specifications');
  assert.equal(new Set(d.wallSpecs.map(w=>w.id)).size,d.wallSpecs.length,'Unique wall identities');
  d.walls.forEach((w,i)=>{const s=d.wallSpecs[i];assert.deepEqual(s.coords,w,`Wall specification ${i} follows new coordinates`);assert.equal(s.thicknessCm,12);});
  for(let i=0;i<12;i++){
    const current=omit(d.wallSpecs[i],['id','grade','source']);const expected=omit(old.wallSpecs[i],['id','grade','source']);
    if(i===0)expected.heightSegments=[{fromCm:343.5,toCm:681,heightCm:279}];
    assert.deepEqual(current,expected,`Exterior/public wall ${i}: only exact north height transition changes`);
  }
  for(const room of d.rooms){
    assert.deepEqual(room.points,reviewedRooms[room.id]||old.rooms.find(r=>r.id===room.id).points,`Reviewed polygon ${room.id}`);
    near(room.modelAreaM2,area(room.points),`Recomputed model area ${room.id}`,.00006);
    assert.equal(room.heightCm,old.rooms.find(r=>r.id===room.id).heightCm,`Room height evidence retained ${room.id}`);
  }
  assert.equal(d.rooms.length,8);
  for(const previous of old.doors){
    const door=d.doors.find(v=>v.id===previous.id),r=reviewedDoors[previous.id];assert.ok(door);
    if(!r){assert.deepEqual(door,previous);continue;}
    assert.deepEqual([door.x1,door.y1,door.x2,door.y2],r.coords,`Exact R3 door aperture ${door.id}`);
    assert.equal(door.widthMm,door.id.startsWith('door_bath')?750:900);
    assert.equal(door.operation.type,'hinged');assert.deepEqual(door.operation.hingeCm,r.hinge);
    assert.deepEqual(rect(door.operation.openLeafCm),r.leaf,`Physical 90-degree leaf ${door.id}`);
    assert.deepEqual(door.operation.swing,r.swing,`Correct hinge/opening direction ${door.id}`);
    assert.equal(door.operation.panelCm,undefined);assert.equal(door.operation.parkedCm,undefined);
    assert.deepEqual(door.connects,previous.connects);assert.equal(door.heightCm,previous.heightCm);
  }
  assert.equal(d.doors.length,old.doors.length);
  assert.deepEqual(omit(d.layout.entryZone,['name']),{x:349.5,y:322,w:89.5,d:165,roomId:'room_a'});
  assert.equal(d.layout.measured,false,'Reconfigured geometry is not a new survey');
  assert.equal(d.measurementRevision.version,old.measurementRevision.version);assert.equal(d.measurementRevision.stage,'partial-confirmed');assert.equal(d.measurementRevision.oldEnvelope,true);
  for(const field of ['source','applied','pending'])assert.deepEqual(d.measurementRevision[field],old.measurementRevision[field],`R2 evidence immutable: ${field}`);
  assert.deepEqual(d.anchors,old.anchors,'Old dimension-chain anchors remain historical, not converted into new survey facts');
  assert.equal(d.furniture.length,old.furniture.length,'No accidental duplicate/removed furniture');
  for(const previous of old.furniture){
    const current=d.furniture.find(v=>key(v)===key(previous));assert.ok(current,`Retained furniture identity ${key(previous)}`);
    const expected={...previous,...changedFurniture.get(previous.name)};
    assert.deepEqual(omit(current,['notes','grade','source']),omit(expected,['notes','grade','source']),`Exact permitted furniture adaptation ${previous.name}`);
  }
  const get=name=>d.furniture.find(f=>f.name===name);
  near(get('主卧1500床').x-(get('主卧衣柜').x+get('主卧衣柜').w),55.5,'Honest tight master foot passage');
  near(get('次卧补齐退台的连续浅台').x-(get('次卧1350床').x+get('次卧1350床').w),71.5,'Secondary bed-foot passage');
  near(337.5-246,91.5,'Corridor clear width');near(437-(378+4),55,'Both main-suite leaves opened: tight 550mm band');
  near(d.doors.find(f=>f.id==='door_c').y1-d.doors.find(f=>f.id==='door_a').y2,3,'Only 30mm longitudinal aperture separation');
  near(250-(12+224),14,'Secondary console stops before opened door leaf');
  const roomFurniture={room_a:['主卧1500床','主卧衣柜'],room_b:['次卧1350床','次卧衣柜','次卧补齐退台的连续浅台'],room_c:['书房通长桌','书房办公椅','书房北墙沙发'],bath_1:['主卫600浴室柜','主卫壁挂马桶','主卫淋浴区'],bath_2:['客卫600浴室柜','客卫壁挂马桶','客卫淋浴区']};
  for(const[id,names]of Object.entries(roomFurniture)){
    const room=d.rooms.find(r=>r.id===id),items=names.map(get);
    for(const f of items)for(const x of [f.x,f.x+f.w/2,f.x+f.w])for(const y of [f.y,f.y+f.d/2,f.y+f.d])assert.ok(inside(x,y,room.points),`${f.name} fits ${id}`);
    for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++)assert.ok(!overlap(items[i],items[j]),`${items[i].name}/${items[j].name}: no footprint overlap`);
    for(const door of d.doors.filter(v=>v.connects?.includes(id)))for(const f of items)assert.ok(!overlap(f,door.operation.openLeafCm),`${door.id}/${f.name}: no full-open leaf intersection`);
  }
  // Study chair was moved to avoid the entire opening sweep, not only final leaf.
  const chair=get('书房办公椅');assert.ok(chair.x+chair.w<162,'Chair remains west of the 780mm north-hinge swing envelope');
  const book=d.wallFitouts.find(f=>f.id==='study_bookwall');assert.ok(book);assert.deepEqual(rect(book),[12,591.75,222,28.25]);
  assert.ok(book.parts.length>20,'Shelf is rebuilt as real parts, not only a resized aggregate');
  assert.equal(new Set(book.parts.map(p=>p.id)).size,book.parts.length);
  for(const p of book.parts){assert.ok(p.x>=12-1e-5&&p.x+p.w<=234+1e-5,`Book part ${p.id} stays inside 222cm wall`);assert.ok(p.y>=591.75-1e-5&&p.y+p.d<=620+1e-5);}
  const uprights=book.parts.filter(p=>p.role==='upright');assert.equal(uprights.length,7,'Six book bays retained');uprights.forEach(p=>near(p.w,2.2,'22mm shelf panels'));
  for(let i=0;i<6;i++)near(uprights[i+1].x-(uprights[i].x+2.2),(222-7*2.2)/6,'Actual shelf net bay width');
  for(const fitout of d.bayFitouts){const prior=old.bayFitouts.find(f=>f.id===fitout.id);assert.deepEqual(omit(fitout,['title','summary','dimensions','conditions']),omit(prior,['title','summary','dimensions','conditions']),'Bay physical geometry unchanged');}
  const copy=JSON.stringify(d.familyR3Revision)+JSON.stringify(d.layout)+JSON.stringify(d.doors);
  for(const [pattern,label]of [[/550|55厘米|55cm/,'550mm tight simultaneous-door strip'],[/915|91\.5/,'915mm corridor'],[/900/,'900mm rough opening'],[/555|55\.5/,'555mm master aisle'],[/净开|门套|成品净/,'Rough opening versus finished clear width'],[/未闭合|旧模型|非实测/,'Unclosed whole-house survey']])assert.match(copy,pattern,label+' is disclosed');
  assert.doesNotMatch(d.layout.circulationNote||'',/次卧.*左转|书房.*推拉/,'Obsolete circulation prose removed');
  assert.doesNotMatch(get('次卧1350床').notes||'',/床尾.{0,8}47cm|床尾.{0,8}470/);
  assert.doesNotMatch(get('主卧衣柜').notes||'',/床尾80cm|床尾800/);
  return {book,roomFurniture};
}

function decode(bytes){
  assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  let g,bin;for(let p=12;p<bytes.length;){const n=bytes.readUInt32LE(p),t=bytes.readUInt32LE(p+4),b=bytes.subarray(p+8,p+8+n);if(t===0x4e4f534a)g=JSON.parse(b.toString());if(t===0x004e4942)bin=b;p+=n+8;}assert.ok(g&&bin);
  const parents=new Map(),matrices=new Map();g.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>parents.set(c,i)));
  const matrix=i=>{if(matrices.has(i))return matrices.get(i);const n=g.nodes[i],m=new THREE.Matrix4();if(n.matrix)m.fromArray(n.matrix);else m.compose(new THREE.Vector3(...(n.translation??[0,0,0])),new THREE.Quaternion(...(n.rotation??[0,0,0,1])),new THREE.Vector3(...(n.scale??[1,1,1])));if(parents.has(i))m.premultiply(matrix(parents.get(i)));matrices.set(i,m);return m;};
  return g.nodes.flatMap((n,i)=>{
    if(n.mesh===undefined)return[];const meta={};for(let p=i;p!==undefined;p=parents.get(p))for(const[k,v]of Object.entries(g.nodes[p].extras??{}))if(meta[k]===undefined)meta[k]=v;
    const bounds=new THREE.Box3(),coordinates=[],triangles=[],topology=[];
    for(const primitive of g.meshes[n.mesh].primitives){
      assert.equal(primitive.mode??4,4);const a=g.accessors[primitive.attributes.POSITION],v=g.bufferViews[a.bufferView];assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');assert.ok(!a.sparse);
      const points=[],at=(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??12;
      for(let j=0;j<a.count;j++){const p=at+j*stride,point=new THREE.Vector3(bin.readFloatLE(p),bin.readFloatLE(p+4),bin.readFloatLE(p+8)).applyMatrix4(matrix(i));bounds.expandByPoint(point);coordinates.push(...point.toArray());points.push(point.toArray().map(q=>Math.round(q/1e-4)).join(','));}
      let indices;if(primitive.indices===undefined)indices=Array.from({length:a.count},(_,k)=>k);else{const ia=g.accessors[primitive.indices],iv=g.bufferViews[ia.bufferView],start=(ia.byteOffset??0)+(iv.byteOffset??0),size={5121:1,5123:2,5125:4}[ia.componentType],reader={5121:'readUInt8',5123:'readUInt16LE',5125:'readUInt32LE'}[ia.componentType];assert.ok(size);indices=Array.from({length:ia.count},(_,k)=>bin[reader](start+k*(iv.byteStride??size)));}
      topology.push(indices);for(let j=0;j<indices.length;j+=3)triangles.push(indices.slice(j,j+3).map(k=>points[k]).sort().join(';'));
    }
    return [{name:n.name,meta,bounds,coordinates,topology,geometry:createHash('sha256').update(triangles.sort().join('\n')).digest('hex')}];
  });
}
const union=meshes=>meshes.reduce((b,m)=>b.union(m.bounds),new THREE.Box3());
const boxValues=b=>[b.min.x,b.min.z,b.min.y,b.max.x,b.max.z,b.max.y];
function bounds(meshes,source,label,{vertical=false,tolerance=.001}={}){
  assert.ok(meshes.length,`${label}: actual geometry exists`);const b=union(meshes),expected=[source.x,source.y,source.x+source.w,source.y+source.d].map(v=>v/100);
  [b.min.x,b.min.z,b.max.x,b.max.z].forEach((v,i)=>near(v,expected[i],label+' bound '+i,tolerance));
  if(vertical){near(b.min.y,(source.zCm??0)/100,label+' bottom',tolerance);near(b.max.y,((source.zCm??0)+(source.hCm??source.heightCm))/100,label+' top',tolerance);}return b;
}
function expectedWallBoxes(d,index){
  const w=d.walls[index],s=d.wallSpecs[index],horizontal=w[1]===w[3],axis=horizontal?0:1,fixed=w[1-axis]/100,start=Math.min(w[axis],w[axis+2])/100,end=Math.max(w[axis],w[axis+2])/100,t=s.thicknessCm/100;
  const cuts=new Set([start,end]),apertures=[];
  for(const op of [...d.windows,...d.doors,...(d.openings??[])]){const v=[op.x1,op.y1,op.x2,op.y2].map(n=>n/100);if(Math.abs(v[1-axis]-fixed)>.005||Math.abs(v[3-axis]-fixed)>.005)continue;const lo=Math.min(v[axis],v[axis+2]),hi=Math.max(v[axis],v[axis+2]);if(lo<start-.01||hi>end+.01)continue;cuts.add(lo);cuts.add(hi);apertures.push({lo,hi,op});}
  for(const seg of s.heightSegments??[]){cuts.add(seg.fromCm/100);cuts.add(seg.toCm/100);}
  const sorted=[...cuts].sort((a,b)=>a-b),wall=[],skirting=[];
  for(let j=0;j<sorted.length-1;j++){
    const lo=sorted[j],hi=sorted[j+1],mid=(lo+hi)/2,seg=s.heightSegments?.find(h=>h.fromCm/100<=mid&&mid<=h.toCm/100),h=(seg?.heightCm??s.heightCm??270)/100,op=apertures.find(a=>a.lo<=mid&&mid<=a.hi)?.op;
    const spans=op?[[0,(op.sillCm??0)/100],[((op.sillCm??0)+op.heightCm)/100,h]]:[[0,h]];
    for(const [bottom,top]of spans){if(hi-lo<.003||top-bottom<.003)continue;wall.push(horizontal?[lo,fixed-t/2,bottom,hi,fixed+t/2,top]:[fixed-t/2,lo,bottom,fixed+t/2,hi,top]);if(bottom<=.005){const st=(t+.018)/2;skirting.push(horizontal?[lo,fixed-st,.005,hi,fixed+st,.075]:[fixed-st,lo,.005,fixed+st,hi,.075]);}}
  }
  return {wall,skirting};
}
function matchBoxes(meshes,expected,label){
  assert.equal(meshes.length,expected.length,`${label}: actual solid count`);const remaining=meshes.map(m=>({name:m.name,b:boxValues(m.bounds)}));
  for(const box of expected){const i=remaining.findIndex(m=>m.b.every((v,j)=>Math.abs(v-box[j])<.001));assert.ok(i>=0,`${label}: missing exact solid ${JSON.stringify(box)}; remaining ${JSON.stringify(remaining)}`);remaining.splice(i,1);}
}
function translatedExact(now,old,furnitureName,dx,dz){
  const a=old.filter(m=>m.meta.furnitureName===furnitureName),b=now.filter(m=>m.meta.furnitureName===furnitureName);assert.ok(a.length);assert.equal(b.length,a.length);
  for(const n of b){const p=a.find(m=>m.name===n.name);assert.ok(p,`Original translated mesh ${n.name}`);assert.deepEqual(n.topology,p.topology);assert.equal(n.coordinates.length,p.coordinates.length);n.coordinates.forEach((v,i)=>near(v-(i%3===0?dx/100:i%3===2?dz/100:0),p.coordinates[i],`Rigid vertex ${n.name}/${i}`,1e-5));}
}
function checkGlb(d,now,old){
  let solidCount=0;for(let i=0;i<d.walls.length;i++){
    const e=expectedWallBoxes(d,i),name=`Skirting ${String(i).padStart(2,'0')}`;
    const wall=now.filter(m=>m.meta.kind==='wall'&&m.meta.wallIndex===i&&!m.name.startsWith(name));
    const skirting=now.filter(m=>m.name.split('.')[0]===name);
    matchBoxes(wall,e.wall,`Wall ${i} including door/window cuts`);matchBoxes(skirting,e.skirting,`Skirting ${i} does not bridge door cuts`);solidCount+=wall.length;
  }
  for(const[id,r]of Object.entries(reviewedDoors)){
    const meshes=now.filter(m=>m.meta.openingId===id),leaf=meshes.filter(m=>/door leaf/i.test(m.name)&&m.meta.doorRole==='hinged-open-panel');
    assert.equal(leaf.length,1,`${id}: one actual 90-degree leaf`);bounds(leaf,{x:r.leaf[0],y:r.leaf[1],w:r.leaf[2],d:r.leaf[3]},id+' 90-degree physical leaf');
    const door=d.doors.find(v=>v.id===id);near(leaf[0].bounds.min.y,.02,id+' leaf floor gap',.001);near(leaf[0].bounds.max.y,door.heightCm/100-.055,id+' door leaf head',.001);
    assert.equal(meshes.filter(m=>/jamb/.test(m.name)).length,2,`${id}: both physical jambs`);assert.equal(meshes.filter(m=>/\/ (?:R3 )?head(?:\.|$)/.test(m.name)).length,1,`${id}: head frame`);
    const horizontal=door.y1===door.y2,frame=meshes.filter(m=>/jamb|\/ (?:R3 )?head(?:\.|$)/.test(m.name)),b=union(frame);
    near(horizontal?b.min.x:b.min.z,(horizontal?door.x1:door.y1)/100,id+' frame aperture start',.001);near(horizontal?b.max.x:b.max.z,(horizontal?door.x2:door.y2)/100,id+' frame aperture end',.001);
    assert.ok(!meshes.some(m=>m.meta.doorRole==='sliding-panel'||/study sliding|concealed top track|anti-sway guide/.test(m.name)),`${id}: no stale study slider geometry`);
  }
  for(const f of d.furniture.filter(f=>changedFurniture.has(f.name))){
    const meshes=now.filter(m=>m.meta.furnitureName===f.name);
    if(f.name==='书房办公椅')translatedExact(now,old,f.name,-56,0);
    else bounds(meshes,f,f.name);
  }
  for(const [name,dx]of [['主卧衣柜',24.5],['次卧补齐退台的连续浅台',24.5],['主卫600浴室柜',-20]])translatedExact(now,old,name,dx,0);
  const book=d.wallFitouts.find(f=>f.id==='study_bookwall'),bookMeshes=now.filter(m=>m.meta.wallFitoutId===book.id);
  bounds(bookMeshes,book,'222cm actual study bookwall');
  for(const p of book.parts)bounds(bookMeshes.filter(m=>m.meta.wallPartId===p.id),p,'Bookwall part '+p.id,{vertical:true});
  assert.equal(new Set(bookMeshes.map(m=>m.meta.wallPartId)).size,book.parts.length,'No stale old-width bookwall part');
  for(const room of d.rooms.filter(r=>privateRooms.has(r.id)||r.id==='living')){
    const meshes=now.filter(m=>m.meta.kind==='floor'&&m.meta.roomId===room.id);assert.ok(meshes.length,`Actual floor ${room.id}`);
    for(const m of meshes)for(let j=0;j<m.coordinates.length;j+=3)assert.ok(inside(m.coordinates[j]*100,m.coordinates[j+2]*100,room.points,.2),`Floor vertex stays within new ${room.id}: ${m.name}`);
  }
  // Surgical replacement whitelist: every other world-space triangle stays fixed.
  const allowed=(m,before)=>{
    const idx=m.meta.wallIndex,sk=/^Skirting (\d+)/.exec(m.name),index=idx??(sk?+sk[1]:null);
    if(index!==null&&(index===0||(before?index>=12&&index<=23:index>=12&&index<=20)))return true;
    if(changedDoors.has(m.meta.openingId)||changedFurniture.has(m.meta.furnitureName)||m.meta.wallFitoutId==='study_bookwall')return true;
    if(m.meta.kind==='floor'&&(privateRooms.has(m.meta.roomId)||m.meta.roomId==='living'))return true;
    return false;
  };
  const a=old.filter(m=>!allowed(m,true)),b=now.filter(m=>!allowed(m,false));assert.ok(a.length>900,'Broad untouched physical geometry coverage');
  const ah=a.map(m=>m.geometry).sort(),bh=b.map(m=>m.geometry).sort();
  if(JSON.stringify(ah)!==JSON.stringify(bh)){const missing=a.filter(m=>!b.some(n=>n.geometry===m.geometry)),extra=b.filter(m=>!a.some(n=>n.geometry===m.geometry));throw new Error('Protected native geometry changed: '+JSON.stringify({missing:missing.map(m=>({name:m.name,meta:m.meta,bounds:boxValues(m.bounds)})),extra:extra.map(m=>({name:m.name,meta:m.meta,bounds:boxValues(m.bounds)}))}));}
  return {meshes:now.length,wallSolids:solidCount,protectedMeshes:a.length,reviewedDoors:5,bookwallParts:book.parts.length};
}

function checkWalk(d){
  const world=buildWalkWorld(d),step=.05,grid=new Map(),k=(i,j)=>i+','+j;
  for(let i=0;i<=169;i++)for(let j=0;j<=281;j++){const x=i*step,z=j*step;if(world.canStand(x,z,.25))grid.set(k(i,j),{i,j,x,z});}
  const entry=grid.get(k(92,260));assert.ok(entry,'Existing entry seed remains clear');const queue=[entry],seen=new Set([k(entry.i,entry.j)]),reached=new Set();
  for(let n=0;n<queue.length;n++){const p=queue[n];reached.add(world.roomAt(p.x,p.z));for(const[di,dj]of [[1,0],[-1,0],[0,1],[0,-1]]){const id=k(p.i+di,p.j+dj),q=grid.get(id);if(!q||seen.has(id))continue;const m=advanceWalk(world,p,q.x-p.x,q.z-p.z);if(Math.hypot(m.x-q.x,m.z-q.z)>1e-7)continue;seen.add(id);queue.push(q);}}
  assert.deepEqual([...reached].filter(Boolean).sort(),world.rooms.map(r=>r.id).sort(),'All eight rooms actually reachable from entrance with 50cm body and all model leaves');
  const joined=p=>{const i=Math.round(p.x/step),j=Math.round(p.z/step);for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){const q=grid.get(k(i+di,j+dj));if(!q||!seen.has(k(q.i,q.j)))continue;const m=advanceWalk(world,p,q.x-p.x,q.z-p.z);if(Math.hypot(m.x-q.x,m.z-q.z)<1e-7)return true;}return false;};
  const privateStarts={};for(const id of privateRooms){const seed=WALK_STARTS[id],p=findWalkStart(world,id,{x:seed[0],z:seed[1]});assert.ok(p&&world.canStand(p.x,p.z));assert.ok(joined(p),`Actual preferred private-room spawn connected ${id}`);privateStarts[id]=p;}
  // Explicitly cross the tight strip between D2 and D4. A safe spawn in an
  // isolated bathroom is not evidence that the door sequence is usable.
  const crossing=[{x:4.1,z:4.09},{x:4.45,z:4.09},{x:5.1,z:4.09}];
  for(const p of crossing)assert.ok(world.canStand(p.x,p.z,.25)&&joined(p),'Real 50cm body reaches simultaneous-door band '+JSON.stringify(p));
  for(let i=1;i<crossing.length;i++){const p=crossing[i-1],q=crossing[i],m=advanceWalk(world,p,q.x-p.x,q.z-p.z);near(m.x,q.x,'Swept D2/D4 crossing x');near(m.z,q.z,'Swept D2/D4 crossing z');}
  return {reachableRooms:[...reached].filter(Boolean).length,connectedGridPoints:seen.size,privateStarts,doorBandCm:55};
}

export async function validateFamilyR3({glb=false}={}){
  const d=JSON.parse((await read(prefix+'design-data.json')).toString()),old=JSON.parse(oldBytes(prefix+'design-data.json').toString());
  const unchangedOtherSchemeFiles=await unchangedSchemes();checkSource(d,old);
  const report={passed:true,revision:'3.10.0',baseline:familyR3Baseline,unchangedOtherSchemeFiles,walk:checkWalk(d)};
  if(glb)report.glb=checkGlb(d,decode(await read(modelPath)),decode(oldBytes(modelPath)));
  return report;
}
// Several historical entry points compose the same independent proof. Cache
// only within this immutable validation process; a new CLI run rechecks bytes.
const familyR3Proofs=new Map();
export function ensureFamilyR3({glb=false}={}){
  if(!familyR3Proofs.has(glb))familyR3Proofs.set(glb,validateFamilyR3({glb}));
  return familyR3Proofs.get(glb);
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))console.log(JSON.stringify(await validateFamilyR3({glb:process.argv.includes('--glb')}),null,2));
