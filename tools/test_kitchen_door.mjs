// Actual GLB geometry, source invariants and parked-slider collision checks.
// No browser, no rendering, no file mutations.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three/three.module.js';
import {buildWalkWorld,advanceWalk} from '../walkthrough.js';
const root=new URL('../',import.meta.url),cwd=fileURLToPath(root);
const read=p=>readFile(new URL(p,root));
const data=JSON.parse(await read('models/design-data.json'));
const overrides=JSON.parse(await read('models/blender-overrides.json'));
const manifest=JSON.parse(await read('models/scene-manifest.json'));
const door=data.doors.find(d=>d.id==='door_kitchen'),s=door.sliding;
const close=(a,b,label)=>assert.ok(Math.abs(a-b)<.00002,`${label||''}: ${a} != ${b}`);
assert.deepEqual([door.x1,door.y1,door.x2,door.y2,door.widthMm,door.heightCm],[536,1145,536,1315,1700,220]);
assert.equal(s.panelCount,3);assert.equal(s.trackCount,3);assert.equal(s.stackTo,'north');
for(const d of [overrides.openings.find(o=>o.id===door.id),manifest.openings.find(o=>o.id===door.id)]){
  for(const key of ['x1','y1','x2','y2','heightCm','sliding'])assert.deepEqual(d[key],door[key],'Opening source agreement '+key);
}
assert.equal(door.y1-1121,24);assert.equal(1395-door.y2,80);
const shoe=data.furniture.find(f=>f.id==='entry_storage'),south=data.furniture.find(f=>f.name==='厨房南侧地柜');
assert.equal(shoe.y-door.y2,5);assert.equal(south.y-door.y2,14);
const inner=170-2*s.jambCm,panel=(inner+2*s.overlapCm)/3,parked=panel+2*s.stackStaggerCm;
close(panel,56.1333333333333);close(inner-parked,103.266666666667);

function decode(raw){
  assert.equal(raw.toString('ascii',0,4),'glTF');
  const jsonSize=raw.readUInt32LE(12),j=JSON.parse(raw.subarray(20,20+jsonSize).toString());
  const binary=raw.subarray(28+jsonSize),parents=new Map(),matrices=new Map();
  j.nodes.forEach((n,i)=>(n.children||[]).forEach(child=>parents.set(child,i)));
  const matrix=i=>{
    if(matrices.has(i))return matrices.get(i);const n=j.nodes[i],m=new THREE.Matrix4();
    if(n.matrix)m.fromArray(n.matrix);else m.compose(new THREE.Vector3(...(n.translation||[0,0,0])),new THREE.Quaternion(...(n.rotation||[0,0,0,1])),new THREE.Vector3(...(n.scale||[1,1,1])));
    if(parents.has(i))m.premultiply(matrix(parents.get(i)));matrices.set(i,m);return m;
  };
  const records=[];
  j.nodes.forEach((n,i)=>{
    if(n.mesh===undefined)return;const metadata={};
    for(let p=i;p!==undefined;p=parents.get(p))for(const [k,v]of Object.entries(j.nodes[p].extras||{}))if(metadata[k]===undefined)metadata[k]=v;
    const bounds=new THREE.Box3(),vertices=[];
    for(const p of j.meshes[n.mesh].primitives){
      const a=j.accessors[p.attributes.POSITION],b=j.bufferViews[a.bufferView];assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');
      const offset=(a.byteOffset||0)+(b.byteOffset||0),stride=b.byteStride||12;
      for(let k=0;k<a.count;k++){
        const start=offset+k*stride,v=new THREE.Vector3(binary.readFloatLE(start),binary.readFloatLE(start+4),binary.readFloatLE(start+8)).applyMatrix4(matrix(i));
        bounds.expandByPoint(v);vertices.push(v.toArray().map(x=>Math.round(x*100000)).join(','));
      }
    }
    const geometryHash=createHash('sha256').update(vertices.sort().join(';')).digest('hex');
    records.push({name:n.name,metadata,bounds,geometryHash});
  });
  return records;
}
const current=decode(await read('models/huiyayuan-wood.glb'));
const leaves=current.filter(r=>r.metadata.openingId===door.id&&r.metadata.doorRole==='sliding-panel');
assert.equal(leaves.length,18,'Three leaves: two stiles, two rails, glazing and flush pull each');
const boundsFor=parts=>parts.reduce((b,p)=>b.union(p.bounds),new THREE.Box3());
for(let i=0;i<3;i++){
  const parts=leaves.filter(r=>r.metadata.slidingPanelIndex===i);assert.equal(parts.length,6);
  const b=boundsFor(parts),start=(1145+s.jambCm+i*(panel-s.overlapCm))/100;
  close(b.min.z,start,'Closed north edge');close(b.max.z,start+panel/100,'Closed south edge');
  close(b.getCenter(new THREE.Vector3()).x,5.36+(i-1)*.04,'Track center');
  for(const p of parts){
    assert.equal(p.metadata.slideOpenOffsetM.length,3);close(p.metadata.slideOpenOffsetM[0],0);close(p.metadata.slideOpenOffsetM[1],0);
    close(p.metadata.slideOpenOffsetM[2],-i*(panel-s.overlapCm-s.stackStaggerCm)/100);
  }
}
const opened=leaves.map(p=>({...p,bounds:p.bounds.clone().translate(new THREE.Vector3(...p.metadata.slideOpenOffsetM))}));
const stack=boundsFor(opened);
close(stack.min.z,(1145+s.jambCm)/100);close(stack.max.z,(1145+s.jambCm+parked)/100);
close((1315-s.jambCm)/100-stack.max.z,(inner-parked)/100,'Actual open width');
assert.ok(stack.min.x>=5.2875&&stack.max.x<=5.4325,'Stack stays inside reserved track thickness');
const floor=current.find(r=>r.metadata.openingId===door.id&&r.metadata.doorRole==='door-floor');assert.ok(floor);close(floor.bounds.max.y,0);
const world=buildWalkWorld(data),obstacle=world.obstacles.find(o=>o.id==='door_kitchen-parked-leaves');assert.ok(obstacle);
assert.ok(obstacle.x<=stack.min.x&&obstacle.x+obstacle.w>=stack.max.x&&obstacle.z<=stack.min.z+.00001&&obstacle.z+obstacle.d>=stack.max.z-.00001,'Collision contains actual parked geometry');
let position={x:4.4,z:13};
for(const [x,z]of [[4.95,12.5],[5.7,12.5],[6.95,12.55]]){position=advanceWalk(world,position,x-position.x,z-position.z);close(position.x,x);close(position.z,z)}
assert.equal(world.canStand(5.36,11.9),false);assert.ok(world.canStand(5.36,12.55));

// Compare real world-space mesh vertices to the last published model. Only
// the specified wall, its skirting and the kitchen-door assembly may change.
const baseline='fe18564d74ad8d55a789084f46e1ee67fe80b5a6';
const old=decode(execFileSync('git',['show',baseline+':models/huiyayuan-wood.glb'],{cwd,maxBuffer:40*1024*1024}));
const wallIndex=data.walls.findIndex(w=>JSON.stringify(w)===JSON.stringify([536,1121,536,1395]));assert.ok(wallIndex>=0);
const approved=r=>r.metadata.openingId===door.id||r.metadata.wallIndex===wallIndex||r.name.startsWith('Skirting '+String(wallIndex).padStart(2,'0'));
const preserved=records=>Object.fromEntries(records.filter(r=>!approved(r)).map(r=>[r.name,r.geometryHash]));
assert.deepEqual(preserved(current),preserved(old),'Unrelated actual GLB geometry must not move, disappear or be reshaped');
console.log(`PASS: 1700mm source/override/manifest, 18 actual leaf meshes / 3 tracks, 1033mm model clear opening, parked collision + route, and ${Object.keys(preserved(current)).length} unchanged unrelated world-space meshes.`);
