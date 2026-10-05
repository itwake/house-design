// Exact purchased-SKU envelopes and conditional layout checks. Virtual body
// connectivity and rigid vehicle poses do not certify human handling/access.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.js';
import {buildWalkWorld,advanceWalk} from '../walkthrough.js';

const root=new URL('../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const ids={sofa:'ikea-vimle-39635114',table:'ikea-lisabo-80365717',chair:'ikea-lisabo-80457236'};
const layouts={family:{sx:344,sy:809,ty:1040},wood:{sx:414,sy:901,ty:1106},laundry:{sx:344,sy:901,ty:1106}};
const names=['三人沙发','四人餐桌','餐椅北1','餐椅北2','餐椅南1','餐椅南2'];
const rect=f=>[f.x,f.y,f.w,f.d],near=(a,b,label,tol=1e-7)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<tol,`${label}: ${a} != ${b}`);
const overlap=(a,b)=>Math.min(a.x+a.w,b.x+b.w)>Math.max(a.x,b.x)+1e-6&&Math.min(a.y+a.d,b.y+b.d)>Math.max(a.y,b.y)+1e-6;
const overlap3=(a,b)=>overlap(a,b)&&Math.min((a.zCm||0)+a.hCm,(b.zCm||0)+b.hCm)>Math.max(a.zCm||0,b.zCm||0)+1e-6;
const movedChairs=(data,amount)=>({...data,furniture:data.furniture.map(f=>f.name.startsWith('餐椅')?{...f,y:f.y+(f.face==='north'?amount:-amount)}:f)});

function connected(data,id,amount,diameterCm){
  const world=buildWalkWorld(data),radius=diameterCm/200,step=.025,nx=273,nz=327,seen=new Uint8Array(nx*nz);
  const index=(x,z)=>Math.round((z-5.5)/step)*nx+Math.round((x-2)/step);
  const start={x:4.3,z:13.45};assert.ok(world.canStand(start.x,start.z,radius),`${id}/${amount}: valid entry seed`);
  const queue=[index(start.x,start.z)];seen[queue[0]]=1;
  for(let k=0;k<queue.length;k++){
    const n=queue[k],i=n%nx,j=Math.floor(n/nx),at={x:2+i*step,z:5.5+j*step};
    for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const ii=i+di,jj=j+dj,m=jj*nx+ii;if(ii<0||ii>=nx||jj<0||jj>=nz||seen[m])continue;
      const x=2+ii*step,z=5.5+jj*step;if(!world.canStand(x,z,radius))continue;
      const moved=advanceWalk(world,at,x-at.x,z-at.z,radius);if(Math.hypot(moved.x-x,moved.z-z)>1e-7)continue;
      seen[m]=1;queue.push(m);
    }
  }
  for(const [label,x,z] of [['north-corridor',id==='wood'?3.65:3.35,6.4],['kitchen',6.8,12.6],['east-living',6.1,10.4]])
    assert.ok(seen[index(x,z)],`${id}/${amount}/${diameterCm} cm body: swept route to ${label}`);
  if(id==='family')assert.ok(world.obstacles.some(o=>o.id==='family_sideboard_1_base'&&Math.abs(o.w-.44)<1e-8),'Actual 44 cm ordinary cabinet remains in collision world');
  return queue.length;
}

function polygon(cx,cy,w,d,angle=0){const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([x,y])=>[cx+x*c-y*s,cy+x*s+y*c]);}
function hit(a,b){for(const p of [a,b])for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length],axis=[-(q[1]-p[i][1]),q[0]-p[i][0]],aa=a.map(v=>v[0]*axis[0]+v[1]*axis[1]),bb=b.map(v=>v[0]*axis[0]+v[1]*axis[1]);if(Math.max(...aa)<=Math.min(...bb)+1e-6||Math.max(...bb)<=Math.min(...aa)+1e-6)return false;}return true;}
function vehicleCheck(data){
  const g=data.garage,ordinary=data.furniture.filter(f=>!f.garageFitoutId),fixed=ordinary.map(f=>({id:f.name,p:polygon(f.x+f.w/2,f.y+f.d/2,f.w,f.d)}));
  for(const p of g.parts)fixed.push({id:p.id,p:polygon(p.x+p.w/2,p.y+p.d/2,p.w,p.d)});
  let poses=0;
  for(const item of g.items){
    for(let x=item.x;x<=362;x++){
      const f={...item,x};for(const p of g.parts)assert.ok(!overlap3(f,p),`Extraction: ${item.id}/${p.id}`);
      for(const p of ordinary)assert.ok(!overlap(f,p),`Extraction: ${item.id}/${p.name}`);poses++;
    }
    const pose=(cx,cy,angle)=>{const p=polygon(cx,cy,item.w,item.d,angle);for(const f of fixed)assert.ok(!hit(p,f.p),`Vehicle staging: ${item.id}/${f.id} at ${cx},${cy},${angle}`);assert.ok(p.every(([x,y])=>x>=212&&x<=530&&y<=1389),'Vehicle stays within entry interior');poses++;};
    const cy=item.y+item.d/2,cx=431.25;
    for(let x=362+item.w/2;x<cx;x+=1)pose(x,cy,0);
    for(let y=cy;y>=1270;y-=1)pose(cx,y,0);
    for(let a=0;a<=90;a++)pose(cx,1270,a);
    for(let y=1270;y>=1240;y--)pose(cx,y,90);
    const staged=polygon(cx,1240,item.w,item.d,90);
    assert.ok(staged.every(([,y])=>y<=1295+1e-6),'Stage north of the nominal 100 cm entry-door sweep before opening');
  }
  return poses;
}

function decode(bytes){
  assert.equal(bytes.readUInt32LE(0),0x46546c67);const length=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+length)),bin=bytes.subarray(28+length),parents=new Map(),matrices=new Map();
  g.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parents.set(c,i)));
  const matrix=i=>{if(matrices.has(i))return matrices.get(i);const n=g.nodes[i],m=new THREE.Matrix4();if(n.matrix)m.fromArray(n.matrix);else m.compose(new THREE.Vector3(...(n.translation||[0,0,0])),new THREE.Quaternion(...(n.rotation||[0,0,0,1])),new THREE.Vector3(...(n.scale||[1,1,1])));if(parents.has(i))m.premultiply(matrix(parents.get(i)));matrices.set(i,m);return m;};
  return g.nodes.flatMap((n,i)=>{if(n.mesh===undefined)return [];const meta={},bounds=new THREE.Box3();for(let p=i;p!==undefined;p=parents.get(p))for(const [k,v] of Object.entries(g.nodes[p].extras||{}))if(meta[k]===undefined)meta[k]=v;
    for(const primitive of g.meshes[n.mesh].primitives){const a=g.accessors[primitive.attributes.POSITION],v=g.bufferViews[a.bufferView],offset=(a.byteOffset||0)+(v.byteOffset||0),stride=v.byteStride||12;assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');for(let k=0;k<a.count;k++){const p=offset+k*stride;bounds.expandByPoint(new THREE.Vector3(bin.readFloatLE(p),bin.readFloatLE(p+4),bin.readFloatLE(p+8)).applyMatrix4(matrix(i)));}}
    return [{name:n.name,meta,bounds}];});
}

const catalog=await read('models/design-schemes.json'),reports=[];
let kitchenActive=false;
for(const [id,p] of Object.entries(layouts)){
  const d=await read(`models/schemes/${id}/design-data.json`),f=name=>{const a=d.furniture.filter(f=>f.name===name);assert.equal(a.length,1,`${id}: one ${name}`);return a[0];};
  kitchenActive ||= Boolean(d.kitchenFitout);
  assert.equal(d.purchasedFurnitureRevision.version,'3.7.0');assert.equal(d.measurementRevision.version,'3.6.1');
  assert.equal(d.furniture.filter(f=>f.purchasedProductId).length,6,'Exactly one sofa, one table and four chairs replaced');
  assert.equal(d.furniture.filter(f=>f.name.startsWith('餐椅')).length,4,'No extra/hidden east chairs');
  for(const [name,expected,product,height,face] of [
    ['三人沙发',[p.sx,p.sy,241,98],ids.sofa,83,'north'],['四人餐桌',[320,p.ty,140,78],ids.table,74,'north'],
    ['餐椅北1',[332,p.ty-63.5,46,51],ids.chair,80,'south'],['餐椅北2',[402,p.ty-63.5,46,51],ids.chair,80,'south'],
    ['餐椅南1',[332,p.ty+90.5,46,51],ids.chair,80,'north'],['餐椅南2',[402,p.ty+90.5,46,51],ids.chair,80,'north']
  ]){assert.deepEqual(rect(f(name)),expected,`${id}/${name} exact footprint`);near(f(name).heightCm,height,`${id}/${name} height`);assert.equal(f(name).purchasedProductId,product);assert.equal(f(name).face,face);}
  assert.ok(!d.pulloutDining,'Fixed purchased table has no retracting/closed state');
  if(id==='family'){
    const back=d.furniture.find(f=>f.id==='family_sofa_back_storage');assert.deepEqual(rect(back),[385,909,200,25]);
    const module=d.storageFitouts.flatMap(f=>f.parts).find(p=>p.id==='family_sideboard_1_base');assert.deepEqual(rect(module),[212.5,990,44,120]);assert.equal(module.role,'sideboard_base');
    for(const k of ['diningFitoutId','tableTopHeightCm','cavityHeightCm'])assert.ok(!(k in module),`Old ${k} mechanism removed`);
    near(f('四人餐桌').x-(module.x+module.w),63.5,'True local west table gap');
    near(1280-(f('餐椅南1').y+f('餐椅南1').d+30),68.5,'South pulled-chair clearance to return');
  }
  if(id!=='wood')near(645-(f('三人沙发').x+f('三人沙发').w),60,'Bookcase compact access strip remains 60 cm');
  // Every translation sample must be collision-free, including real cabinet
  // parts rather than only their shallower aggregate furniture rectangles.
  for(let amount=0;amount<=30;amount++){
    const source=movedChairs(d,amount),all=source.furniture.filter(f=>!f.garageFitoutId),parts=source.storageFitouts.flatMap(f=>f.parts).filter(p=>(p.zCm??0)<80&&p.hCm>5);
    for(const a of all.filter(f=>names.includes(f.name))){for(const b of all)if(a!==b)assert.ok(!overlap(a,b),`${id}/${amount} ${a.name} versus ${b.name}`);for(const b of parts)assert.ok(!overlap(a,b),`${id}/${amount} ${a.name} versus cabinet ${b.id}`);}
  }
  const paths={};for(const amount of [0,30])for(const diameter of [50,60])paths[`${amount}-${diameter}`]=connected(movedChairs(d,amount),id,amount,diameter);
  const result={scheme:id,chairTranslationSamples:31,paths};if(id==='family')result.vehiclePoses=vehicleCheck(d);
  if(process.argv.includes('--glb')){
    const scheme=catalog.schemes.find(s=>s.id===id),model=decode(await readFile(new URL(scheme.model,root)));
    for(const name of names){
      const source=f(name),meshes=model.filter(m=>m.meta.furnitureName===name&&m.meta.purchasedProductId===source.purchasedProductId&&!/rug/i.test(m.name));
      assert.ok(meshes.length>=5,`${id}/${name}: real tagged product meshes exist`);
      const b=meshes.reduce((b,m)=>b.union(m.bounds),new THREE.Box3()),expected=[source.x/100,0,source.y/100,(source.x+source.w)/100,source.heightCm/100,(source.y+source.d)/100],actual=[...b.min.toArray(),...b.max.toArray()];
      actual.forEach((v,i)=>near(v,expected[i],`${id}/${name}: world envelope axis ${i}`,.001));
    }
    assert.ok(!model.some(m=>m.meta.diningFitoutId==='family_pullout_dining'),'Old pullout mechanism/closed-state meshes absent');
    // Two original base pendants follow the exact new table anchor.
    const roses=model.filter(m=>/^Dining[ _]pendant[ _]ceiling[ _]rose(?:[ ._]|$)/.test(m.name));assert.equal(roses.length,2,'Two source-anchored pendants');
    const expectedX=[3.9+1.4*(-5/24),3.9+1.4*(11/60)].sort((a,b)=>a-b),centers=roses.map(m=>m.bounds.getCenter(new THREE.Vector3())).sort((a,b)=>a.x-b.x);
    centers.forEach((c,i)=>{near(c.x,expectedX[i],'Pendant x anchor',.001);near(c.z,(p.ty+39)/100-.78/70,'Pendant plan-y anchor',.001);});
    result.exportedProducts=6;
  }
  reports.push(result);
}
// Keep bought-product dimensions, collision sweeps and pendant checks intact.
// A later kitchen revision must pass its independent exact source guard; with
// --glb that guard also checks actual kitchen parts and product envelopes.
if(kitchenActive)await import('./test_kitchen_fitout.mjs');
console.log(JSON.stringify({passed:true,scope:'purchased furniture and explicit kitchen guard; R2 architectural guard runs separately',reports},null,2));
