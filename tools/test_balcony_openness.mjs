// V3.12 scoped regression: actual outdoor opening geometry, not construction certification.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as THREE from '../vendor/three/three.module.js';
import {buildWalkWorld,advanceWalk} from '../walkthrough.js';

export const balconyBaseline='f9f4cb94ecf2bbdc39ab6e6ba086956081457c27';
const root=path.resolve(import.meta.dirname,'..');
const ids=['wood','family','laundry'];
const read=p=>fs.readFileSync(path.join(root,p));
const old=p=>execFileSync('git',['show',`${balconyBaseline}:${p}`],{cwd:root,maxBuffer:250*1024*1024});
const json=p=>JSON.parse(read(p));
const hash=b=>createHash('sha256').update(b).digest('hex');
const near=(a,b,label,tol=1e-4)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=tol,`${label}: ${a} != ${b}`);
const OPENINGS={balcony_north_opening:[687,960,829,960],balcony_east_opening:[835,966,835,1115]};
const WALLS={5:[835,960,835,1395],6:[681,960,835,960]};
const RETAINED_REASON='本轮仅重渲指定阳台相关视角；此图完整保留发布旧来源，未更新阳台边界和采光，只作历史参考，不代表3.12.0阳台。';

function sourceProof(d,b,id){
  assert.equal(d.version,'3.12.0');assert.equal(d.balconyOpennessRevision?.version,'3.12.0');
  const allowed=new Set(['version','balconyOpennessRevision','windows','geometryNotes']);
  for(const key of new Set([...Object.keys(d),...Object.keys(b)]))if(!allowed.has(key))assert.deepEqual(d[key],b[key],`${id}: protected source ${key}`);
  for(const key of ['geometryNotes']){
    assert.ok(Array.isArray(d[key])&&Array.isArray(b[key]),key+' notes remain arrays');
    assert.deepEqual(d[key].slice(0,b[key].length),b[key],id+' preserved historical '+key);
    assert.ok(d[key].length>b[key].length,id+' appended explanation '+key);
  }
  assert.deepEqual(d.windows.filter(w=>!Object.hasOwn(OPENINGS,w.id)),b.windows,id+' every pre-existing window unchanged');
  assert.equal(d.windows.length,b.windows.length+2);
  for(const[key,coords]of Object.entries(OPENINGS)){
    const w=d.windows.find(w=>w.id===key);assert.ok(w,id+' opening '+key);
    assert.deepEqual([w.x1,w.y1,w.x2,w.y2],coords);assert.equal(w.kind,'window');assert.equal(w.windowType,'guarded-open-air');
    assert.equal(w.glazing,false);assert.equal(w.sillCm,110);assert.equal(w.heightCm,135);assert.equal(w.grade,'C');
    assert.equal(w.widthMm,Math.hypot(coords[2]-coords[0],coords[3]-coords[1])*10);assert.equal(w.dimensionsVerified,false);
    assert.deepEqual(w.guard,{frameCm:2,barWidthCm:1.2,nominalSpacingCm:10,status:'schematic-not-engineered'});
  }
  for(const[index,coords]of Object.entries(WALLS))assert.deepEqual(d.walls[Number(index)],coords,id+' preserved host axis '+index);
  const copy=JSON.stringify(d.balconyOpennessRevision);assert.match(copy,/估|暂定|待核|未实测/,'Do not label picture estimates as measured');
  assert.match(copy,/防护|防坠|安全/,'Guard detail remains explicit');
  assert.equal(d.balconyOpennessRevision.baselineCommit,balconyBaseline);assert.equal(d.balconyOpennessRevision.dimensionsVerified,false);assert.equal(d.balconyOpennessRevision.constructionApproved,false);
  assert.deepEqual(d.windows.find(w=>w.id==='window_kitchen_balcony'),b.windows.find(w=>w.id==='window_kitchen_balcony'));
  const world=buildWalkWorld(d),start={x:7.5,z:10.05};assert.ok(world.canStand(start.x,start.z),'Balcony test starts safely inside');
  assert.ok(!world.doors.some(door=>Object.hasOwn(OPENINGS,door.id)),'High-level outdoor openings are not floor-level doors');
  const north=advanceWalk(world,start,0,-3),east=advanceWalk(world,start,3,0);
  assert.ok(north.z>=9.91-1e-6&&north.z<start.z,'North parapet stops movement at safe radius');
  assert.ok(east.x<=8.04+1e-6&&east.x>start.x,'East parapet stops movement at safe radius');
  assert.equal(world.canStand(7.5,9.5),false);assert.equal(world.canStand(8.5,10.05),false);
  return {protectedSourceKeys:Object.keys(b).filter(k=>!allowed.has(k)).length,addedOutdoorOpenings:2,measuredEvidenceUnchanged:true,outdoorWalkBarriers:2};
}

// Decode actual POSITION bytes, transforms and triangle topology; accessor bounds are not evidence.
function decode(bytes){
  assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  let g,bin;for(let p=12;p<bytes.length;){const len=bytes.readUInt32LE(p),type=bytes.readUInt32LE(p+4),data=bytes.subarray(p+8,p+8+len);if(type===0x4e4f534a)g=JSON.parse(data.toString());if(type===0x004e4942)bin=data;p+=len+8;}assert.ok(g&&bin);
  const parents=new Map(),matrices=new Map();g.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>parents.set(c,i)));
  const matrix=i=>{if(matrices.has(i))return matrices.get(i);const n=g.nodes[i],m=new THREE.Matrix4();if(n.matrix)m.fromArray(n.matrix);else m.compose(new THREE.Vector3(...(n.translation??[0,0,0])),new THREE.Quaternion(...(n.rotation??[0,0,0,1])),new THREE.Vector3(...(n.scale??[1,1,1])));if(parents.has(i))m.premultiply(matrix(parents.get(i)));matrices.set(i,m);return m;};
  const textures=(g.images??[]).map(image=>{const v=g.bufferViews[image.bufferView];return hash(bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength));});
  const materials=(g.materials??[]).map(m=>{const n=structuredClone(m);const fix=v=>{if(!v||typeof v!=='object')return;if(Object.hasOwn(v,'index')&&g.textures?.[v.index]){const t=g.textures[v.index];v.index=textures[t.source];}for(const child of Object.values(v))fix(child);};fix(n);return hash(JSON.stringify(n));});
  return g.nodes.flatMap((n,i)=>{
    if(n.mesh===undefined)return[];const meta={};for(let p=i;p!==undefined;p=parents.get(p))for(const[k,v]of Object.entries(g.nodes[p].extras??{}))if(meta[k]===undefined)meta[k]=v;
    const bounds=new THREE.Box3(),triangles=[],keys=[],mats=[],materialNames=[];
    for(const primitive of g.meshes[n.mesh].primitives){
      assert.ok(primitive.mode===undefined||primitive.mode===4);mats.push(materials[primitive.material]);materialNames.push(g.materials?.[primitive.material]?.name??'');
      const a=g.accessors[primitive.attributes.POSITION],v=g.bufferViews[a.bufferView];assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');assert.ok(!a.sparse);
      const points=[],start=(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??12;
      for(let j=0;j<a.count;j++){const at=start+j*stride,p=new THREE.Vector3(bin.readFloatLE(at),bin.readFloatLE(at+4),bin.readFloatLE(at+8)).applyMatrix4(matrix(i));bounds.expandByPoint(p);points.push(p);}
      let indices;if(primitive.indices===undefined)indices=Array.from({length:a.count},(_,k)=>k);else{const ia=g.accessors[primitive.indices],iv=g.bufferViews[ia.bufferView],at=(ia.byteOffset??0)+(iv.byteOffset??0),size={5121:1,5123:2,5125:4}[ia.componentType],reader={5121:'readUInt8',5123:'readUInt16LE',5125:'readUInt32LE'}[ia.componentType];assert.ok(size);indices=Array.from({length:ia.count},(_,k)=>bin[reader](at+k*(iv.byteStride??size)));}
      for(let j=0;j<indices.length;j+=3){const t=indices.slice(j,j+3).map(k=>points[k]);triangles.push(t);keys.push(t.map(p=>p.toArray().map(v=>Math.round(v/1e-5)).join(',')).sort().join(';'));}
    }
    return[{name:n.name,meta,bounds,triangles,materialNames,geometry:hash(keys.sort().join('\n')),materialSignature:mats.sort().join('|')}];
  });
}

const wallIndex=m=>Number(m.meta.wallIndex??m.meta.parentWallIndex);
const targetWall=m=>m.meta.kind==='wall'&&[5,6].includes(wallIndex(m))&&!m.name.startsWith('Skirting ');
const openingPart=m=>m.meta.kind==='window'&&Object.hasOwn(OPENINGS,m.meta.balconyOpeningId);
function intersects(meshes,origin,direction){
  const ray=new THREE.Ray(origin,direction),point=new THREE.Vector3();
  return meshes.some(m=>ray.intersectsBox(m.bounds)&&m.triangles.some(t=>ray.intersectTriangle(t[0],t[1],t[2],false,point)&&point.distanceTo(origin)<.7));
}
function nativeProof(now,before,id){
  const original=before.filter(m=>!targetWall(m)),protectedNow=now.filter(m=>!targetWall(m)&&!openingPart(m));
  assert.ok(original.length>1000,'Broad protection coverage');assert.equal(protectedNow.length,original.length,id+' protected mesh inventory');
  const signature=m=>m.geometry+'|'+m.materialSignature;
  assert.deepEqual(protectedNow.map(signature).sort(),original.map(signature).sort(),id+' all non-target world triangles and materials exactly preserved');
  const walls=now.filter(targetWall);assert.ok(walls.length>=6,id+' actual walls split around openings');
  const union=list=>list.reduce((box,m)=>box.union(m.bounds),new THREE.Box3());
  for(const index of [5,6]){
    const previous=union(before.filter(m=>targetWall(m)&&wallIndex(m)===index)),current=walls.filter(m=>wallIndex(m)===index);assert.ok(current.length);
    const b=union(current);for(const axis of ['x','y','z']){near(b.min[axis],previous.min[axis],id+' unchanged wall min '+index+'/'+axis);near(b.max[axis],previous.max[axis],id+' unchanged wall max '+index+'/'+axis);}
  }
  let samples=0;
  // Test all heights at each critical sill/lintel edge, across the complete east wall,
  // including the kitchen segment which shared one long triangle before the cut.
  const heights=[.05,.55,1.099,1.101,1.45,1.9,2.449,2.451,2.69];
  for(let cm=961.13;cm<1395;cm+=2)for(const z of heights){
    const actual=intersects(walls,new THREE.Vector3(8.10,z,cm/100),new THREE.Vector3(1,0,0));
    const expected=!(cm>966&&cm<1115&&z>1.1&&z<2.45);assert.equal(actual,expected,`${id} east wall y=${cm}, z=${z}`);samples++;
  }
  for(let cm=682;cm<835;cm+=2)for(const z of heights){
    const actual=intersects(walls,new THREE.Vector3(cm/100,z,9.40),new THREE.Vector3(0,0,1));
    const expected=!(cm>687&&cm<829&&z>1.1&&z<2.45);assert.equal(actual,expected,`${id} north wall x=${cm}, z=${z}`);samples++;
  }
  for(const [key,coords]of Object.entries(OPENINGS)){
    const parts=now.filter(m=>openingPart(m)&&m.meta.balconyOpeningId===key);assert.ok(parts.length>=3,id+' physical guard/frame '+key);
    const b=union(parts),horizontal=coords[1]===coords[3];
    for(const m of parts){assert.ok(m.bounds.min.y>=1.1-.03&&m.bounds.max.y<=2.45+.03,id+' opening part remains above low wall and below lintel');
      if(horizontal)assert.ok(m.bounds.min.x>=6.87-.03&&m.bounds.max.x<=8.29+.03&&m.bounds.min.z>=9.54-.04&&m.bounds.max.z<=9.66+.04,'North guard within opening');
      else assert.ok(m.bounds.min.z>=9.66-.03&&m.bounds.max.z<=11.15+.03&&m.bounds.min.x>=8.29-.04&&m.bounds.max.x<=8.41+.04,'East guard within opening');
      assert.doesNotMatch(m.name,/glass|glazing|玻璃/i,'No invented glazing in open-air balcony');
      assert.ok(m.materialNames.every(name=>!/glass|glazing|玻璃/i.test(name)),'Actual guard materials do not contain glass');
    }
    assert.ok((horizontal?b.max.x-b.min.x:b.max.z-b.min.z)>1.3,id+' guard spans opening');
    let blocked=0,tested=0;
    for(let cm=(horizontal?687:966)+3.17;cm<(horizontal?829:1115)-3;cm+=2)for(let z=1.15;z<2.40;z+=.10){
      const origin=horizontal?new THREE.Vector3(cm/100,z,9.40):new THREE.Vector3(8.10,z,cm/100),direction=horizontal?new THREE.Vector3(0,0,1):new THREE.Vector3(1,0,0);
      blocked+=Number(intersects(parts,origin,direction));tested++;
    }
    assert.ok(blocked/tested<.30,id+' actual guard aperture stays substantially open, not a mislabeled solid pane');
  }
  return{protectedMeshes:original.length,changedWallMeshes:walls.length,wallVoidAndKitchenSamples:samples,openingComponents:now.filter(openingPart).length};
}

export function releaseProof(){
  const catalog=json('models/design-schemes.json'),previous=JSON.parse(old('models/design-schemes.json'));
  assert.equal(catalog.version,'3.12.0');assert.deepEqual(catalog.schemes.map(s=>s.id),ids);
  let fresh=0,retained=0;const cameraRecords=[],files=['studio.html','studio.js','schemes.js','index.html','models/design-schemes.json'];
  for(const id of ids){
    const scheme=catalog.schemes.find(s=>s.id===id),prior=previous.schemes.find(s=>s.id===id),pref=`models/schemes/${id}/`,d=json(pref+'design-data.json'),m=json(pref+'scene-manifest.json'),b=JSON.parse(old(pref+'scene-manifest.json'));
    assert.equal(scheme.assetRevision,'3.12.0');assert.equal(scheme.balconyOpennessRevision,'3.12.0');
    for(const key of Object.keys(prior))if(!['assetRevision','balconyOpennessRevision','roomOverrides'].includes(key))assert.deepEqual(scheme[key],prior[key],id+' unchanged catalog '+key);
    assert.deepEqual(Object.fromEntries(Object.entries(scheme.roomOverrides??{}).filter(([k])=>k!=='balcony')),Object.fromEntries(Object.entries(prior.roomOverrides??{}).filter(([k])=>k!=='balcony')),id+' no unrelated room override');
    assert.deepEqual(scheme.roomOverrides.balcony,d.balconyOpennessRevision.roomDescriptions.balcony);
    assert.equal(m.version,'3.12.0');assert.deepEqual(m.balconyOpennessRevision,d.balconyOpennessRevision);
    assert.equal(m.sourceSha256,hash(read(pref+'design-data.json')),id+' final source SHA');assert.equal(m.baseBlendSha256,hash(read(pref+'huiyayuan-wood.blend')),id+' final native SHA');
    for(const key of ['measurementRevision','purchasedFurnitureRevision','kitchenFitout','laundry','garage','familyPublicP2Revision','woodRevision'])assert.deepEqual(m[key],b[key],id+' protected manifest evidence '+key);
    assert.deepEqual(m.openings.filter(w=>!Object.hasOwn(OPENINGS,w.id)),b.openings,id+' old manifest openings unchanged');
    assert.equal(m.openings.length,b.openings.length+2,id+' two new manifest openings');
    const balcony=m.rooms.find(r=>r.id==='balcony');assert.match(balcony.description,/通透/);assert.match(balcony.description,/暂估|待.*尺|估/);
    const changed=new Set(['overall','balcony','laundry-detail','kitchen-north',...(id==='wood'?[]:['living-wall'])]);
    assert.deepEqual(Object.keys(m.renderedViews).sort(),Object.keys(b.renderedViews).sort(),id+' exact existing view inventory');
    for(const [name,record]of Object.entries(m.renderedViews)){
      const p=`assets/schemes/${id}/${name}.jpg`;assert.equal(record.imageSha256,hash(read(p)),id+'/'+name+' image SHA');
      const before=b.renderedViews[name];
      if(changed.has(name)){
        cameraRecords.push({scheme:id,view:name,manifest:pref+'scene-manifest.json'});
        assert.ok(!record.retainedFrom,id+'/'+name+' actually rerendered');assert.equal(record.sourceSha256,m.sourceSha256);assert.equal(record.baseBlendSha256,m.baseBlendSha256);
        if(name==='balcony'){
          const state=record.cameraState,matrix=state.matrix,camera=balcony.interiorCamera;
          assert.equal(state.type,'PERSP');assert.equal(state.lens,16);assert.equal(state.sensorWidth,36);assert.ok(!record.cameraOverride,'Balcony view must be saved in final native, not a temporary render override');
          const position=[6.82,1.62,10.08],target=[8.12,1.48,10.18],actual=[matrix[0][3],matrix[2][3],-matrix[1][3]];
          actual.forEach((v,i)=>near(v,position[i],id+' balcony actual camera position',1e-5));assert.deepEqual(camera.position,position);assert.deepEqual(camera.target,target);
          const direction=target.map((v,i)=>v-position[i]),length=Math.hypot(...direction),forward=[-matrix[0][2],-matrix[2][2],matrix[1][2]];
          forward.forEach((v,i)=>near(v,direction[i]/length,id+' balcony actual camera direction',1e-5));near(camera.horizontalFov,2*Math.atan(36/32)*180/Math.PI,id+' balcony actual FOV',.006);
          assert.notEqual(record.cameraHash,before.cameraHash);
        }else{assert.deepEqual(record.cameraState,before.cameraState,id+'/'+name+' preserved exact camera state');assert.equal(record.cameraHash,before.cameraHash);}
        assert.notEqual(record.imageSha256,before.imageSha256,id+'/'+name+' fresh image changes');
        assert.equal(record.renderSpec.engine,'CYCLES');assert.equal(record.renderSpec.width,960);assert.equal(record.renderSpec.height,640);assert.ok(record.renderSpec.samples>=8);assert.equal(record.renderSpec.denoise,true);fresh++;files.push(p);
      }else{
        const origin=record.retainedFrom;assert.ok(origin);assert.equal(origin.commit,balconyBaseline);assert.equal(origin.manifest,pref+'scene-manifest.json');assert.equal(origin.view,name);assert.equal(origin.reason,RETAINED_REASON);
        assert.deepEqual(origin.previous,before.retainedFrom,id+'/'+name+' nested reference history');
        assert.deepEqual(Object.fromEntries(Object.entries(record).filter(([k])=>k!=='retainedFrom')),Object.fromEntries(Object.entries(before).filter(([k])=>k!=='retainedFrom')),id+'/'+name+' historical record not relabeled');
        assert.equal(hash(read(p)),hash(old(p)),id+'/'+name+' historical JPEG bytes');retained++;
      }
    }
    files.push(pref+'design-data.json',pref+'scene-manifest.json',pref+'huiyayuan-wood.glb');
  }
  assert.equal(fresh,14);assert.equal(retained,42);
  // Match the renderer's Python canonical-JSON float serialization exactly,
  // without loading legacy geometry/provenance tests or invoking Blender.
  const cameraCheck="import sys,json,hashlib; rows=json.load(sys.stdin); manifests={r['manifest']:json.load(open(r['manifest'],encoding='utf-8')) for r in rows}; bad=[r['scheme']+'/'+r['view'] for r in rows for rec in [manifests[r['manifest']]['renderedViews'][r['view']]] if hashlib.sha256(json.dumps(rec['cameraState'],ensure_ascii=False,sort_keys=True,separators=(',',':')).encode('utf-8')).hexdigest()!=rec['cameraHash']]; assert not bad, bad; print(len(rows))";
  assert.equal(Number(execFileSync('python',['-B','-c',cameraCheck],{cwd:root,input:JSON.stringify(cameraRecords),encoding:'utf8'}).trim()),14,'All fresh camera hashes recomputed');
  return{freshRenders:fresh,retainedHistoricalRenders:retained,verifiedFreshCameraHashes:14,files};
}

export function ensureBalconyOpenness({glb=false,release=false,scheme}={}){
  if(scheme)assert.ok(ids.includes(scheme));
  const results={};for(const id of scheme?[scheme]:ids){const pref=`models/schemes/${id}/`,d=json(pref+'design-data.json'),b=JSON.parse(old(pref+'design-data.json'));
    results[id]={source:sourceProof(d,b,id)};if(glb)results[id].native=nativeProof(decode(read(pref+'huiyayuan-wood.glb')),decode(old(pref+'huiyayuan-wood.glb')),id);
  }return{passed:true,revision:'3.12.0',baseline:balconyBaseline,schemes:results,...(release?{release:releaseProof()}:{} )};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const live=process.argv.find(a=>a.startsWith('--live='))?.slice(7),scheme=process.argv.find(a=>a.startsWith('--scheme='))?.slice(9),result=ensureBalconyOpenness({glb:process.argv.includes('--glb'),release:process.argv.includes('--release')||!!live,scheme});
  if(live)for(const file of result.release.files){const response=await fetch(new URL(file+'?v=3.12.0',live));assert.equal(response.status,200);assert.equal(hash(Buffer.from(await response.arrayBuffer())),hash(read(file)),file+' deployed bytes');}
  if(result.release)delete result.release.files;console.log(JSON.stringify({...result,live:live||false},null,2));
}
