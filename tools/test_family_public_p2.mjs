// Independent P2 / V3.11.0 regression. This is model consistency QA, not
// construction, hardware, lifting or accessibility certification.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as THREE from '../vendor/three/three.module.js';
import {buildWalkWorld, advanceWalk, findWalkStart} from '../walkthrough.js';

const root=path.resolve(import.meta.dirname,'..'),prefix='models/schemes/family/';
export const publicP2Baseline='d81f065ef4287ee24592df6c372a8fe2d7a64c3b';
const read=p=>fs.readFileSync(path.join(root,p));
const oldBytes=p=>execFileSync('git',['show',`${publicP2Baseline}:${p}`],{cwd:root,maxBuffer:250*1024*1024});
const near=(a,b,label,tol=1e-6)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=tol,`${label}: ${a} != ${b}`);
const key=f=>f.id||f.name,rect=f=>[f.x,f.y,f.w,f.d];
const changedKeys=new Set(['三人沙发','茶几','四人餐桌','餐椅北1','餐椅北2','餐椅南1','餐椅南2','餐椅北','餐椅东1','餐椅东2','餐椅南','family_sofa_back_storage','family_sideboard','family_north_sideboard','family_garage','living_east_bookcase']);
const overlap=(a,b)=>Math.min(a.x+a.w,b.x+b.w)>Math.max(a.x,b.x)+1e-6&&Math.min(a.y+a.d,b.y+b.d)>Math.max(a.y,b.y)+1e-6;
const overlap3=(a,b)=>overlap(a,b)&&Math.min((a.zCm||0)+a.hCm,(b.zCm||0)+b.hCm)>Math.max(a.zCm||0,b.zCm||0)+1e-6;

function sourceProof(d,old){
  assert.equal(d.version,'3.11.0');assert.equal(d.familyPublicP2Revision?.version,'3.11.0');assert.equal(d.unit,'cm');
  assert.ok(!d.previewOnly,'Publication must not remain a review-only draft');
  for(const field of ['envelope','anchors','rooms','walls','wallSpecs','windows','doors','bayFitouts','wallFitouts','layout','kitchenFitout','appearance','palette','measurementRevision','familyR3Revision'])assert.deepEqual(d[field],old[field],`Protected architecture/private/kitchen/evidence: ${field}`);
  for(const f of old.furniture.filter(f=>!changedKeys.has(key(f))))assert.deepEqual(d.furniture.find(q=>key(q)===key(f)),f,'Unchanged furniture '+key(f));
  assert.deepEqual(d.furniture.filter(f=>!changedKeys.has(key(f))),old.furniture.filter(f=>!changedKeys.has(key(f))),'No extra unrelated furniture');
  const get=n=>d.furniture.find(f=>key(f)===n),byName=n=>d.furniture.find(f=>f.name===n);
  const expected={
    '三人沙发':[387,859,241,98], '茶几':[447.5,732,120,62],
    '四人餐桌':[256.5,1030,78,140], '餐椅北':[272.5,966.5,46,51],
    '餐椅东1':[347,1047,51,46], '餐椅东2':[347,1117,51,46], '餐椅南':[272.5,1182.5,46,51],
    family_sofa_back_storage:[407.5,959,200,25],family_sideboard:[212.5,859,44,426],family_garage:[212,1285,150,100]
  };
  for(const [id,b]of Object.entries(expected)){assert.ok(get(id),'Reviewed furniture '+id);assert.deepEqual(rect(get(id)),b,'Reviewed footprint '+id);}
  for(const id of ['family_north_sideboard','living_east_bookcase','餐椅北1','餐椅北2','餐椅南1','餐椅南2'])assert.ok(!get(id),'Old fixture removed '+id);
  assert.equal(byName('三人沙发').heightCm,83);assert.equal(byName('三人沙发').purchasedProductId,'ikea-vimle-39635114');
  assert.equal(byName('四人餐桌').heightCm,74);assert.equal(byName('四人餐桌').purchasedProductId,'ikea-lisabo-80365717');assert.equal(byName('四人餐桌').face,'east');
  const chairs=d.furniture.filter(f=>f.productKey==='chair');assert.equal(chairs.length,4);
  for(const c of chairs){assert.equal(c.purchasedProductId,'ikea-lisabo-80457236');assert.equal(c.heightCm,80);assert.deepEqual([c.w,c.d].sort((a,b)=>a-b),[46,51]);}
  assert.deepEqual(chairs.map(c=>c.face),['south','west','west','north']);
  const sofa=byName('三人沙发'),coffee=byName('茶几'),tv=byName('电视薄柜'),rug=d.modelAddons.livingRugCm;
  assert.deepEqual(rug,{x:395.5,y:674,w:224,d:178});assert.deepEqual(sofa.rugCm,rug);
  near(rug.x+rug.w/2,sofa.x+sofa.w/2,'Rug horizontally centered on sofa');
  near(rug.y+rug.d/2,(tv.y+tv.d+sofa.y)/2,'Rug centered between TV front and sofa front');
  near(rug.y-(tv.y+tv.d),7,'TV front gap');near(sofa.y-rug.y-rug.d,7,'Sofa front gap');
  near(coffee.x+coffee.w/2,rug.x+rug.w/2,'Coffee table centered X');near(coffee.y+coffee.d/2,rug.y+rug.d/2,'Coffee table centered Y');
  assert.deepEqual(d.modelAddons.livingFloorLampCm,old.modelAddons.livingFloorLampCm,'Lamp stays off circulation');
  const art=d.modelAddons.livingWallArt;assert.equal(art.wall,'east');assert.equal(art.frameDepthCm,3);assert.equal(art.items.length,2);
  assert.deepEqual(art.items.map(rect),[[672,725,3,60],[672,810,3,60]]);for(const a of art.items){assert.equal(a.zCm,110);assert.equal(a.hCm,80);}
  assert.ok(!d.laundry.bookcase,'No stale east bookcase aggregate');assert.ok(!d.laundry.parts.some(p=>p.roomId==='living'),'No physical east bookcase remnants');
  assert.deepEqual(d.laundry.parts,old.laundry.parts.filter(p=>p.roomId!=='living'),'Every balcony fitout solid unchanged');
  for(const field of ['machines','counter','basin'])assert.deepEqual(d.laundry[field],old.laundry[field],'Laundry physical source preserved '+field);
  assert.equal(d.laundry.alignment.alignmentCancelled,true);near(d.laundry.alignment.doorFrameFrontX,645,'Balcony frame remains at 645cm');
  near(675-(sofa.x+sofa.w),47,'East clearance is only 470mm, not a main aisle');
  near(sofa.x-256.5,130.5,'West main route between sofa and sideboard');
  const side=get('family_sideboard'),garage=d.garage,back=get('family_sofa_back_storage');
  near(side.y+side.d,garage.y,'Continuous sideboard meets store north face');near(byName('四人餐桌').x,side.x+side.w,'Table touches west sideboard');
  near(back.x+back.w/2,sofa.x+sofa.w/2,'Back storage centered on sofa');near(back.y-(sofa.y+sofa.d),2,'20mm sofa/back cabinet gap');
  const fit=d.storageFitouts.find(f=>f.id==='dining_sideboard_wall'),bases=fit.parts.filter(p=>p.role==='sideboard_base').sort((a,b)=>a.y-b.y);
  assert.deepEqual(fit.furnitureIds,['family_sideboard']);assert.deepEqual(bases.map(p=>p.d),[131,120,109,66]);
  let edge=859;for(const p of bases){near(p.y,edge,'No cabinet gap');near(p.x,212.5,'West cabinet x');near(p.w,44,'Lower cabinet depth');edge+=p.d;}near(edge,1285,'Cabinet ends at garage');
  assert.equal(fit.parts.length,12);for(const p of fit.parts){near(p.w,p.role==='upper_cabinet'?28:44,'Upper and lower depths');assert.equal(p.face,'east');}
  assert.deepEqual(d.storageFitouts.find(f=>f.id==='entry_shoe_station'),old.storageFitouts.find(f=>f.id==='entry_shoe_station'),'Shoe unit protected');
  const bp=d.storageFitouts.find(f=>f.id==='sofa_back_storage').parts;assert.equal(bp.length,1);assert.deepEqual(rect(bp[0]),rect(back));
  assert.deepEqual(rect(garage),[212,1285,150,100]);assert.equal(garage.face,'north');assert.equal(garage.doorFoldDirection,'inward');assert.equal(garage.doorOperation.panelCount,4);assert.equal(garage.doorOperation.panelWidthCm,36.5);
  assert.deepEqual(garage.inner,{x:214,y:1287,w:146,d:96});near(garage.opening.clearWidthCm,135,'Nominal four-leaf clear opening');
  const folds=garage.parts.filter(p=>p.role==='folded-door');assert.deepEqual(folds.map(rect),[[214,1287,2.5,36.5],[217,1287,2.5,36.5],[354.5,1287,2.5,36.5],[357.5,1287,2.5,36.5]]);
  for(const p of folds){near(p.zCm,.8,'Door ground gap');near(p.hCm,241.2,'Door height');}
  const reserve={x:214,y:1287,w:146,d:36.5};for(const p of garage.parts.filter(p=>!['panel','roof','folded-door'].includes(p.role)))assert.ok(!overlap(p,reserve),'Rack/shelf outside folding band '+p.id);
  for(const item of garage.items){assert.ok(!overlap(item,reserve),'Vehicle outside folding band');for(const p of garage.parts)assert.ok(!overlap3(item,p),'Vehicle/part separation '+item.id+'/'+p.id);}
  assert.deepEqual(garage.items.map(rect),[[250,1326,75,55],[232,1331,110,50]]);assert.deepEqual(garage.items.map(p=>p.zCm),[0,123]);
  const bike=garage.items.find(i=>i.kind==='child-bike');near(354.5-(side.x+side.w),98,'Actual parked east fold frontage');assert.ok(98<bike.w,'110cm bike cannot be pulled horizontally through 98cm gap');
  assert.equal(garage.movementValidation.status,'pending');assert.equal(garage.movementValidation.straightHorizontalPullOut,false);assert.equal(garage.movementValidation.southChairMustMove,true);assert.equal(garage.rackReserve.postsModeled,false);
  assert.match(garage.conditions.join(' '),/不证明取放可行|未验证|待.*验证/,'Practical extraction is not claimed proved');
  assert.match(garage.conditions.join(' '),/承重|防倾倒/,'Lifted bike structural and safety caveats');
  near(garage.y-(byName('餐椅南').y+byName('餐椅南').d),51.5,'South chair / garage frontal clearance');
  for(const a of d.furniture.filter(f=>changedKeys.has(key(f))))for(const b of d.furniture)if(a!==b)assert.ok(!overlap(a,b),`Public furniture overlap: ${a.name}/${b.name}`);
  return {reviewedFurniture:Object.keys(expected).length,sideboardLengthCm:426,mainWestRouteCm:130.5,eastSofaGapCm:47,garageFrontageCm:98,vehicleExtraction:'pending'};
}

function checkOtherSchemes(){
  const lines=execFileSync('git',['ls-tree','-r',publicP2Baseline,'models/schemes/wood','models/schemes/laundry','assets/schemes/wood','assets/schemes/laundry'],{cwd:root,encoding:'utf8'}).trim().split('\n');
  const files=lines.map(s=>{const[meta,p]=s.split('\t');return{sha:meta.split(' ')[2],p};});assert.ok(files.length>=47);
  const hashes=execFileSync('git',['hash-object','--stdin-paths'],{cwd:root,encoding:'utf8',input:files.map(f=>f.p).join('\n')+'\n'}).trim().split('\n');
  files.forEach((f,i)=>assert.equal(hashes[i],f.sha,'Unrequested scheme byte protection '+f.p));return files.length;
}

function walkProof(d){
  const world=buildWalkWorld(d),step=.05,grid=new Map(),id=(x,y)=>x+','+y;
  assert.ok(!world.obstacles.some(o=>o.id==='living_east_bookcase'),'Removed bookshelf not an invisible walking obstacle');
  for(const f of d.furniture.filter(f=>changedKeys.has(key(f)))){const o=world.obstacles.find(o=>o.id===key(f));assert.ok(o,'Actual collision obstacle '+key(f));assert.deepEqual([o.x,o.z,o.w,o.d],rect(f).map(v=>v/100));}
  for(let i=0;i<=169;i++)for(let j=0;j<=281;j++){const x=i*step,z=j*step;if(world.canStand(x,z,.25))grid.set(id(i,j),{i,j,x,z});}
  const start=grid.get(id(92,260));assert.ok(start,'Entry seed clear');const queue=[start],seen=new Set([id(start.i,start.j)]),reached=new Set();
  for(let h=0;h<queue.length;h++){const p=queue[h];reached.add(world.roomAt(p.x,p.z));for(const[di,dj]of [[1,0],[-1,0],[0,1],[0,-1]]){const k=id(p.i+di,p.j+dj),q=grid.get(k);if(!q||seen.has(k))continue;const r=advanceWalk(world,p,q.x-p.x,q.z-p.z);if(Math.hypot(r.x-q.x,r.z-q.z)>1e-7)continue;seen.add(k);queue.push(q);}}
  assert.deepEqual([...reached].filter(Boolean).sort(),world.rooms.map(r=>r.id).sort(),'All eight rooms reached from entry with 500mm body-diameter model');
  for(const room of d.rooms){const p=findWalkStart(world,room.id);assert.ok(p&&world.canStand(p.x,p.z),'Safe room start '+room.id);}
  return{reachableRooms:[...reached].filter(Boolean).length,connectedGridPoints:seen.size};
}

// Decode world-space vertices and triangle identity; never trust GLB accessor bounds.
function decode(bytes){
  assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  let g,bin;for(let p=12;p<bytes.length;){const n=bytes.readUInt32LE(p),t=bytes.readUInt32LE(p+4),b=bytes.subarray(p+8,p+8+n);if(t===0x4e4f534a)g=JSON.parse(b.toString());if(t===0x004e4942)bin=b;p+=n+8;}assert.ok(g&&bin);
  const parents=new Map(),matrices=new Map();g.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>parents.set(c,i)));
  const matrix=i=>{if(matrices.has(i))return matrices.get(i);const n=g.nodes[i],m=new THREE.Matrix4();if(n.matrix)m.fromArray(n.matrix);else m.compose(new THREE.Vector3(...(n.translation??[0,0,0])),new THREE.Quaternion(...(n.rotation??[0,0,0,1])),new THREE.Vector3(...(n.scale??[1,1,1])));if(parents.has(i))m.premultiply(matrix(parents.get(i)));matrices.set(i,m);return m;};
  return g.nodes.flatMap((n,i)=>{
    if(n.mesh===undefined)return[];const meta={};for(let p=i;p!==undefined;p=parents.get(p))for(const[k,v]of Object.entries(g.nodes[p].extras??{}))if(meta[k]===undefined)meta[k]=v;
    const bounds=new THREE.Box3(),coordinates=[],triangles=[],topology=[];
    for(const primitive of g.meshes[n.mesh].primitives){const a=g.accessors[primitive.attributes.POSITION],v=g.bufferViews[a.bufferView];assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');assert.ok(!a.sparse);
      const points=[],at=(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??12;
      for(let j=0;j<a.count;j++){const p=at+j*stride,point=new THREE.Vector3(bin.readFloatLE(p),bin.readFloatLE(p+4),bin.readFloatLE(p+8)).applyMatrix4(matrix(i));bounds.expandByPoint(point);coordinates.push(...point.toArray());points.push(point.toArray().map(q=>Math.round(q/1e-4)).join(','));}
      let indices;if(primitive.indices===undefined)indices=Array.from({length:a.count},(_,k)=>k);else{const ia=g.accessors[primitive.indices],iv=g.bufferViews[ia.bufferView],start=(ia.byteOffset??0)+(iv.byteOffset??0),size={5121:1,5123:2,5125:4}[ia.componentType],reader={5121:'readUInt8',5123:'readUInt16LE',5125:'readUInt32LE'}[ia.componentType];assert.ok(size);indices=Array.from({length:ia.count},(_,k)=>bin[reader](start+k*(iv.byteStride??size)));}
      topology.push(indices);for(let j=0;j<indices.length;j+=3)triangles.push(indices.slice(j,j+3).map(k=>points[k]).sort().join(';'));
    }
    return[{name:n.name,meta,bounds,coordinates,topology,geometry:createHash('sha256').update(triangles.sort().join('\n')).digest('hex')}];
  });
}
const union=meshes=>meshes.reduce((b,m)=>b.union(m.bounds),new THREE.Box3());
function bounds(meshes,source,label,{vertical=false,tolerance=.002}={}){
  assert.ok(meshes.length,label+' actual mesh exists');const b=union(meshes),expected=[source.x,source.y,source.x+source.w,source.y+source.d].map(v=>v/100);
  [b.min.x,b.min.z,b.max.x,b.max.z].forEach((v,i)=>near(v,expected[i],label+' footprint '+i,tolerance));
  if(vertical){near(b.min.y,(source.zCm??0)/100,label+' bottom',tolerance);near(b.max.y,((source.zCm??0)+(source.hCm??source.heightCm))/100,label+' top',tolerance);}return b;
}
function glbProof(d,now,old){
  const sofa=d.furniture.find(f=>f.name==='三人沙发'),sofaMeshes=now.filter(m=>m.meta.furnitureName===sofa.name),rug=now.filter(m=>/Subtle flatwoven living rug/.test(m.name));
  assert.equal(rug.length,1);bounds(rug,sofa.rugCm,'Centered rug');bounds(sofaMeshes.filter(m=>!rug.includes(m)),sofa,'Real purchased VIMLE');
  for(const f of d.furniture.filter(f=>f.name==='四人餐桌'||f.productKey==='chair'))bounds(now.filter(m=>m.meta.furnitureName===f.name),f,'Real public furniture '+f.name);
  const tea=d.furniture.find(f=>f.name==='茶几'),teaNow=now.filter(m=>m.meta.furnitureName==='茶几'),teaOld=old.filter(m=>m.meta.furnitureName==='茶几');
  // The retained nested-table assembly is asymmetric inside its rectangular
  // design envelope. Check the rigid offset of its actual bounds/vertices;
  // do not force a new shape merely to match the plan's bounding rectangle.
  const teaBounds=union(teaNow),teaBefore=union(teaOld);near(teaBounds.getCenter(new THREE.Vector3()).x-teaBefore.getCenter(new THREE.Vector3()).x,.125,'Actual coffee center X offset',.001);near(teaBounds.getCenter(new THREE.Vector3()).z-teaBefore.getCenter(new THREE.Vector3()).z,.25,'Actual coffee center Z offset',.001);
  assert.equal(teaNow.length,teaOld.length);for(const n of teaNow){const p=teaOld.find(m=>m.name===n.name);assert.ok(p);assert.deepEqual(n.topology,p.topology);assert.equal(n.coordinates.length,p.coordinates.length);n.coordinates.forEach((v,i)=>near(v-(i%3===0?.125:i%3===2?.25:0),p.coordinates[i],'Rigid coffee vertex '+n.name,.00002));}
  for(const p of d.garage.parts)bounds(now.filter(m=>m.meta.garagePartId===p.id),p,'Garage part '+p.id,{vertical:true});
  for(const item of d.garage.items){const meshes=now.filter(m=>m.meta.garageItemId===item.id),b=union(meshes);assert.ok(meshes.length>10,'Detailed vehicle mesh '+item.id);assert.ok(b.min.x>=item.x/100-.001&&b.max.x<=(item.x+item.w)/100+.001&&b.min.z>=item.y/100-.001&&b.max.z<=(item.y+item.d)/100+.001&&b.min.y>=item.zCm/100-.001&&b.max.y<=(item.zCm+item.hCm)/100+.001,'Actual vehicle stays inside approved envelope '+item.id);}
  for(const fit of d.storageFitouts.filter(f=>['dining_sideboard_wall','sofa_back_storage'].includes(f.id)))for(const p of fit.parts){const meshes=now.filter(m=>m.meta.storagePartId===p.id);assert.ok(meshes.length,'Updated cabinet native part '+p.id);const b=union(meshes);assert.ok(b.min.x>=p.x/100-.025&&b.max.x<=(p.x+p.w)/100+.025&&b.min.z>=p.y/100-.025&&b.max.z<=(p.y+p.d)/100+.025,'Native cabinet within source envelope '+p.id);}
  assert.ok(!now.some(m=>m.meta.furnitureId==='living_east_bookcase'||m.meta.laundryRole?.startsWith('book')||m.meta.laundryPartId?.startsWith('bookwall')),'No old east bookshelf meshes');
  const art=now.filter(m=>m.meta.livingWallArtId);assert.ok(art.length>=2,'Both east hanging artworks have semantic metadata');
  for(let i=0;i<2;i++)bounds(art.filter(m=>m.meta.livingWallArtId===`living-wall-art-${i}`),d.modelAddons.livingWallArt.items[i],'East hanging artwork '+i,{vertical:true});
  const diningLight=name=>/^(Dining pendant ceiling rose|Pendant thin suspension|Organic linen pendant|Pendant opal diffuser)(?:[ ._]|$)/.test(name);
  const allowed=m=>changedKeys.has(m.meta.furnitureId)||changedKeys.has(m.meta.furnitureName)||m.meta.purchasedFurnitureRug||['dining_sideboard_wall','sofa_back_storage'].includes(m.meta.storageFitoutId)||m.meta.garagePartId||m.meta.garageItemId||m.meta.livingWallArtId||m.meta.laundryRole?.startsWith('book')||m.meta.laundryPartId?.startsWith('bookwall')||diningLight(m.name);
  const before=old.filter(m=>!allowed(m)),after=now.filter(m=>!allowed(m));assert.ok(before.length>900,'Broad protected actual geometry coverage');
  const a=before.map(m=>m.geometry).sort(),b=after.map(m=>m.geometry).sort();
  if(JSON.stringify(a)!==JSON.stringify(b)){const lost=before.filter(m=>!after.some(n=>n.geometry===m.geometry)),added=after.filter(m=>!before.some(n=>n.geometry===m.geometry));throw new Error('Unexpected protected native change '+JSON.stringify({lost:lost.map(m=>({name:m.name,meta:m.meta})),added:added.map(m=>({name:m.name,meta:m.meta}))}));}
  // The purchased models may move and rotate, but not shrink or change their
  // detailed geometry, face, product identity or topology to disguise a clash.
  const previousData=JSON.parse(oldBytes(prefix+'design-data.json'));
  const previousNames={'餐椅北':'餐椅北1','餐椅东1':'餐椅北2','餐椅东2':'餐椅南1','餐椅南':'餐椅南2'};
  const angle={north:0,east:Math.PI/2,south:Math.PI,west:Math.PI*1.5};let rigidPurchasedParts=0;
  for(const f of d.furniture.filter(f=>f.purchasedProductId)){
    const previousName=previousNames[f.name]||f.name,p=previousData.furniture.find(v=>v.name===previousName);assert.ok(p);
    const a=old.filter(m=>m.meta.furnitureName===previousName),b=now.filter(m=>m.meta.furnitureName===f.name);assert.equal(b.length,a.length,f.name+' purchased component count');
    const da=(angle[f.face]??0)-(angle[p.face]??0),c=Math.cos(da),s=Math.sin(da),cx=(f.x+f.w/2)/100,cz=(f.y+f.d/2)/100,px=(p.x+p.w/2)/100,pz=(p.y+p.d/2)/100;
    for(const n of b){const prior=a.find(m=>m.meta.purchasedPart===n.meta.purchasedPart);assert.ok(prior,f.name+' original part '+n.meta.purchasedPart);assert.deepEqual(n.topology,prior.topology,'Rigid topology '+n.name);assert.equal(n.coordinates.length,prior.coordinates.length);
      for(const field of ['purchasedProductId','purchasedArticleNumber','purchasedPart','purchasedSourceUrl','purchasedGeometryStatus','publishedDimensionsCm'])assert.equal(n.meta[field],prior.meta[field],'Purchased metadata '+field);
      assert.equal(n.meta.furnitureFace,f.face,'Native purchased face');
      for(let j=0;j<n.coordinates.length;j+=3){const x=prior.coordinates[j]-px,z=prior.coordinates[j+2]-pz;near(n.coordinates[j],cx+c*x-s*z,n.name+' rigid x',.00002);near(n.coordinates[j+1],prior.coordinates[j+1],n.name+' rigid elevation',.00002);near(n.coordinates[j+2],cz+s*x+c*z,n.name+' rigid z',.00002);}rigidPurchasedParts++;
    }
  }
  return{actualMeshes:now.length,protectedMeshes:before.length,rigidPurchasedParts,garageSolids:d.garage.parts.length,artworkMeshes:art.length};
}

export async function validateFamilyPublicP2({glb=false}={}){
  const d=JSON.parse(read(prefix+'design-data.json')),old=JSON.parse(oldBytes(prefix+'design-data.json'));
  const result={passed:true,revision:'3.11.0',baseline:publicP2Baseline,source:sourceProof(d,old),unchangedOtherSchemeFiles:checkOtherSchemes(),walk:walkProof(d)};
  const chairsPulled={...d,furniture:d.furniture.map(f=>f.productKey!=='chair'?f:{...f,x:f.x+(f.face==='west'?30:0),y:f.y+(f.face==='north'?30:f.face==='south'?-30:0)})};
  result.chairsPulled30cm=walkProof(chairsPulled);
  if(glb)result.glb=glbProof(d,decode(read(prefix+'huiyayuan-wood.glb')),decode(oldBytes(prefix+'huiyayuan-wood.glb')));
  return result;
}
const proofs=new Map();export function ensureFamilyPublicP2({glb=false}={}){if(!proofs.has(glb))proofs.set(glb,validateFamilyPublicP2({glb}));return proofs.get(glb);}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1]))console.log(JSON.stringify(await validateFamilyPublicP2({glb:process.argv.includes('--glb')}),null,2));
