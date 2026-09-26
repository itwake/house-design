// Fast preflight: decode actual POSITION bytes for new fitouts and both sliders.
// Full inherited-triangle preservation is audited separately in Python.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.js';
import {buildWalkWorld} from '../walkthrough.js';
const root=new URL('../',import.meta.url);
const d=JSON.parse(await readFile(new URL('models/schemes/laundry/design-data.json',root),'utf8')),l=d.laundry;
async function load(path){
 const raw=await readFile(new URL(path,root)),len=raw.readUInt32LE(12),g=JSON.parse(raw.subarray(20,20+len).toString()),bin=raw.subarray(28+len),parents=new Map(),matrices=new Map();
 g.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parents.set(c,i)));
 const matrix=i=>{if(matrices.has(i))return matrices.get(i);const n=g.nodes[i],m=new THREE.Matrix4();if(n.matrix)m.fromArray(n.matrix);else m.compose(new THREE.Vector3(...(n.translation||[0,0,0])),new THREE.Quaternion(...(n.rotation||[0,0,0,1])),new THREE.Vector3(...(n.scale||[1,1,1])));if(parents.has(i))m.premultiply(matrix(parents.get(i)));matrices.set(i,m);return m;};
 return g.nodes.flatMap((n,i)=>{
  if(n.mesh===undefined)return [];
  const meta={};for(let p=i;p!==undefined;p=parents.get(p))for(const [k,v]of Object.entries(g.nodes[p].extras||{}))if(meta[k]===undefined)meta[k]=v;
  if(!meta.laundryPartId&&!meta.laundryMachineId&&!meta.laundryBasin&&!['balcony_door','window_kitchen_balcony'].includes(meta.openingId))return [];
  const bounds=new THREE.Box3();
  for(const primitive of g.meshes[n.mesh].primitives){const a=g.accessors[primitive.attributes.POSITION],v=g.bufferViews[a.bufferView];assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');const offset=(a.byteOffset||0)+(v.byteOffset||0),stride=v.byteStride||12;for(let k=0;k<a.count;k++){const p=offset+k*stride;bounds.expandByPoint(new THREE.Vector3(bin.readFloatLE(p),bin.readFloatLE(p+4),bin.readFloatLE(p+8)).applyMatrix4(matrix(i)));}}
  return [{name:n.name,meta,bounds}];
 });
}
const model=await load('models/schemes/laundry/huiyayuan-wood.glb'),bound=items=>items.reduce((b,p)=>b.union(p.bounds),new THREE.Box3()),near=(a,b)=>assert.ok(a.every((v,i)=>Math.abs(v-b[i])<.00004),JSON.stringify({a,b}));
for(const p of l.parts){const actual=model.filter(m=>m.meta.laundryPartId===p.id);assert.equal(actual.length,1,p.id);const b=bound(actual);near(b.min.toArray(),[p.x/100,p.zCm/100,p.y/100]);near(b.max.toArray(),[(p.x+p.w)/100,(p.zCm+p.hCm)/100,(p.y+p.d)/100]);}
for(const f of l.machines){const m=model.filter(v=>v.meta.laundryMachineId===f.id);assert.ok(m.length>=13);const b=bound(m);near(b.min.toArray(),[f.x/100,0,f.y/100]);near(b.max.toArray(),[(f.x+f.w)/100,.85,(f.y+f.d)/100]);for(const part of model.filter(v=>v.meta.laundryPartId||v.meta.laundryBasin)){const intersection=b.clone().intersect(part.bounds),size=intersection.getSize(new THREE.Vector3());assert.ok(size.x<.00004||size.y<.00004||size.z<.00004,'Intersects machine '+part.name);}}
const bowl=model.filter(m=>m.name.startsWith('Shallow basin'));assert.equal(bowl.length,5);near(bound(bowl).min.toArray(),[6.73,.88,10.38]);near(bound(bowl).max.toArray(),[7.25,.98,11.12]);
const door=model.filter(m=>m.meta.openingId==='balcony_door');assert.ok(Math.abs(bound(door).min.x-6.45)<.00004);
const panels=door.filter(m=>m.meta.doorRole==='sliding-panel');assert.equal(panels.length,18);
const open=panels.map(m=>({...m,bounds:m.bounds.clone().translate(new THREE.Vector3(...m.meta.slideOpenOffsetM))})),stack=bound(open),collider=buildWalkWorld(d).obstacles.find(v=>v.id==='balcony_door-parked-leaves');
assert.ok(stack.min.z>10.4);assert.ok(stack.min.z>=collider.z-.00004&&stack.max.z<=collider.z+collider.d+.00004,'Real parked leaves inside collision box');
for(const p of panels)assert.ok(p.meta.slideOpenOffsetM[2]>=0,'All leaves move south or stay parked');
const wood=await load('models/schemes/wood/huiyayuan-wood.glb'),window=m=>m.filter(v=>v.meta.openingId==='window_kitchen_balcony');assert.equal(window(wood).length,17);assert.equal(window(model).length,17);near(bound(window(wood)).min.toArray(),bound(window(model)).min.toArray());near(bound(window(wood)).max.toArray(),bound(window(model)).max.toArray());
console.log(`PASS actual GLB preflight: ${l.parts.length} exact fitout solids, two ground machines, hollow basin with no appliance intersections, aligned frame, real south parking, scheme1/4 shared window geometry.`);
