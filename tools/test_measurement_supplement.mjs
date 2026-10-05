// V3.6.1 supplementary survey guard. Existing measured rooms and proposed
// renovation polygons remain separate: only the master bay opening changes.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as THREE from '../vendor/three/three.module.js';

const root = new URL('../', import.meta.url);
const cwd = fileURLToPath(root);
const baseline = '3cd0096513a5baaae15ba5db167d3dc3015f5f13';
const sourcePath = 'models/measurements-20261004-r2.json';
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const previous = path => JSON.parse(execFileSync('git', ['show', `${baseline}:${path}`], {cwd, encoding:'utf8', maxBuffer:30*1024*1024}));
let checks = 0;
const same = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const ok = (value, message) => { assert.ok(value, message); checks++; };
const near = (actual, expected, message) => { ok(Number.isFinite(actual) && Math.abs(actual-expected)<1e-7, `${message}: ${actual} != ${expected}`); };
const physical = value => Object.fromEntries(Object.entries(value).filter(([key]) => !['name','source','grade','notes','measurementStatus','designScenario','sourceNote','description','measuredDimensions','placeholderDecision'].includes(key)));
const roomGeometry = rooms => rooms.map(({id,points,heightCm,modelAreaM2}) => ({id,points,heightCm,modelAreaM2}));
const wallGeometry = walls => walls.map(({id,coords,thicknessCm,heightCm,heightSegments}) => ({id,coords,thicknessCm,heightCm,heightSegments}));
const purchasedNames=new Set(['三人沙发','四人餐桌','餐椅北1','餐椅北2','餐椅南1','餐椅南2','餐椅东1','餐椅东2']);
const legacyKitchenNames=new Set(['厨房南侧地柜','厨房北侧地柜','冰箱高柜','蒸烤高柜']);
const kitchenFurnitureIds=new Set(['kitchen_shaft_footprint','kitchen_north_footprint','kitchen_east_footprint','kitchen_south_footprint','kitchen_fridge_footprint']);
const kitchenRevision='kitchen-20261005';
const omit=(object,keys)=>Object.fromEntries(Object.entries(object).filter(([key])=>!keys.includes(key)));
// Exact display-only corrections authorised for the bought products. Transform
// the expected baseline strings, not arbitrary current strings; every other
// value (including all cabinet parts) remains in deep equality comparisons.
const purchasedCopy=new Map([
  ['餐桌及椅子不再移位；77.5/80cm为静态两侧边距。北段浅抽屉开启与取物时不可同时把柜前当通道，桌旁及南短臂下柜采用移门。','餐桌保留原中心，已购1400×780mm桌的西侧模型净距67.5cm、东侧70cm；餐椅按完整460×510mm占地重新摆放。北段浅抽屉开启与取物时不可同时把柜前当通道，桌旁及南短臂下柜采用移门。'],
  ['餐桌西侧775、东侧800mm；南椅退300mm后至短臂仍约815mm','固定餐桌西侧675、东侧700mm；南椅拉出300mm后至南短臂约715mm，仍须现场核对'],
  ['阳台操作过道约690mm；沙发西移800mm，书架前约700mm。','阳台操作过道约690mm；已购2410mm沙发东侧书架前模型净距600mm，取物与通行仍须现场核对。'],
  ['A洗衣机与烘干机在靠厨房共墙落地并排，980mm浅盆台面；B东侧300mm浅书架，C阳台推拉门外移约288mm拉齐门框与柜面。沙发和茶几西移800mm、电视柜西移400mm，餐桌及7字柜保留。 厨房大窗不变，前方690mm操作带仍紧凑。','A洗衣机与烘干机在靠厨房共墙落地并排，980mm浅盆台面；B东侧300mm浅书架，C阳台推拉门外移约288mm拉齐门框与柜面。客餐厅采用已购VIMLE沙发与LISABO固定桌椅，7字柜、茶几和电视柜按当前布局保留。 厨房大窗不变，前方690mm操作带仍紧凑。'],
  ['沿用1200×700mm四人桌和既有椅位；退椅300mm只是一种校核情景，进出时收椅，不能当作多人或无障碍通行认证。','采用已购1400×780mm固定四人桌及460×510mm餐椅，已重新核对椅位；退椅300mm只是一种校核情景，进出时收椅，不能当作多人或无障碍通行认证。']
]);
function expectedPurchasedCopy(value){
  if(typeof value==='string')return purchasedCopy.get(value)??value;
  if(Array.isArray(value))return value.map(expectedPurchasedCopy);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,expectedPurchasedCopy(v)]));
  return value;
}
const survey = await json(sourcePath);
same(survey.revision, 'r2', 'Supplement revision ID');
same(survey.sourceName, '实测尺寸核对表_补充复核.xlsx', 'New workbook remains identifiable');
same(survey.sourceSha256, 'd7b7941f868125b55842c2f29345c35f346ece5e844dea94a7eb7936e3f056b2', 'Supplement evidence hash');
same(survey.units, 'mm', 'Evidence uses millimetres');
same(survey.records.length, 158, 'All supplementary evidence rows retained');
same(survey.issues.length, 22, 'All source issues retained');
same(survey.summary.reportClassifications, {'已解决':12,'用户接受偏差':2,'未完成':8}, 'Resolved, accepted deviations and incomplete issues are not conflated');
ok(/H列/.test(survey.adoptionRule) && /G列/.test(survey.adoptionRule) && /I列/.test(survey.adoptionRule), 'New adoption, calculation and classification columns are distinct');
same(survey.roomMapping, {'卧室1':'room_c','卧室2':'room_b','卧室3':'room_a'}, 'Same rooms across the two surveys');
ok(/逆时针.*90/.test(survey.orientation), 'Quarter-turn coordinate mapping remains explicit');
const oldSourceBytes = await readFile(new URL('models/measurements-20261004.json',root));
same(createHash('sha256').update(oldSourceBytes).digest('hex'), survey.previousSource.sha256, 'Original survey is preserved unchanged');
const records = new Map(survey.records.map(record => [record.id,record]));
same(records.size, survey.records.length, 'Unique source IDs');
for (const record of survey.records) {
  ok(/^尺寸核对!H\d+$/.test(record.cell), `${record.id}: adopted value traced to H`);
  ok(/^尺寸核对!D\d+$/.test(record.rawCell), `${record.id}: original transcription traced to D`);
  same(record.adoptionType, record.status, `${record.id}: source classification retained`);
}
const record = id => { const r=records.get(id);ok(r, `Evidence ${id} exists`);return r; };
for (const [id,mm] of Object.entries({
  B3_DEPTH_INTERIOR_ARROW:3500, B3_WINDOW_LENGTH:1760,
  B3_WINDOW_UPPER_OFFSET:860, B3_WINDOW_LOWER_OFFSET:870,
  B3_WINDOW_HEIGHT:1660, B3_WINDOW_SILL_HEIGHT:410, B3_ROOM_HEIGHT:2790,
  S01:1010,S02:1390,S03:1320,S04:1530,S05:500,S06:1400,
  C02:820,C04:820,X_B1_DOOR:820,O_B2_DOOR:820,
  B1_LEFT_LOWER:990,B2_W_MAX:4300,
  K01:2610,K02:2420,L02:2120,L03:2210,L04:400,L05:600,L12:2700,
  B03:1490,B05:1240,U_B_OUT_W:50,U_B_OUT_D:150
})) near(record(id).adoptedMm,mm, `${id}: exact adopted evidence`);
near(record('B3_WINDOW_LENGTH').convertedOrCalculatedMm,2620,'Old raw window transcription remains historical, not adopted');
for (const [id,mm] of Object.entries({D_B3_WINDOW_CHAIN:3490,O_S_DEPTH:2400,D_SUITE_STEP:210,D_PUBLIC_DEPTH:2350,D_CORRIDOR_RIGHT_WALL:130,D_LIVING_SOUTH:7600,D_KITCHEN_ADJ_DIFF:150,B1_DEPTH_TOTAL:3030})) {
  const r=record(id);
  same(r.adoptedMm,null, `${id}: calculation or unresolved value does not become an independent measurement`);
  near(r.convertedOrCalculatedMm,mm, `${id}: supporting calculation is retained`);
}
for (const id of ['X_KITCHEN_DOOR','B04']) same(record(id).adoptedMm,null, `${id}: revoked 1000 mm opening not silently restored`);
const issues = new Map(survey.issues.map(issue => [issue.id,issue]));
for (const id of ['Q11','Q12']) same(issues.get(id).reportClassification,'用户接受偏差',`${id}: explicitly accepted 30/20 mm deviations`);
for (const id of ['Q01','Q04','Q05','Q07','Q14','Q15','Q20','Q21']) same(issues.get(id).reportClassification,'未完成',`${id}: remaining incomplete matter not marked solved`);
for (const id of ['Q02','Q03','Q16']) same(issues.get(id).reportClassification,'已解决',`${id}: bath shape/window meaning resolved`);
near(record('B3_DEPTH_INTERIOR_ARROW').adoptedMm-record('D_B3_WINDOW_CHAIN').convertedOrCalculatedMm,10,'Master window chain retains 10 mm residual');
same(survey.diff.adoptedValueChanges.length,17,'All seventeen changed adoptions retained');
same(survey.diff.addedRecordIds.sort(),['D_CORRIDOR_RIGHT_WALL','D_SUITE_STEP'],'Two new justified calculations, not invented dimensions');

if(process.argv.includes('--evidence-only')) {
  console.log(JSON.stringify({passed:true,mode:'evidence-only',checks,measurementSource:sourcePath},null,2));
  process.exit(0);
}

const catalog = await json('models/design-schemes.json');
const reports=[];
let purchasedActive=false,kitchenActive=false;
for (const id of ['wood','family','laundry']) {
  const path=`models/schemes/${id}/design-data.json`, data=await json(path), old=previous(path), rev=data.measurementRevision;
  const purchased=data.purchasedFurnitureRevision?.version==='3.7.0';purchasedActive ||= purchased;
  const kitchen=Boolean(data.kitchenFitout);kitchenActive ||= kitchen;
  const kitchenFurniture=f=>kitchen&&(legacyKitchenNames.has(f.name)||(kitchenFurnitureIds.has(f.id)&&f.kitchenFitoutId===kitchenRevision));
  if(kitchen){
    same(data.kitchenFitout.id,kitchenRevision,`${id}: only the reviewed kitchen replacement is allowed`);
    same(data.kitchenFitout.version,'3.8.0',`${id}: explicit kitchen revision`);
    same(old.furniture.filter(f=>legacyKitchenNames.has(f.name)).map(f=>f.name).sort(),[...legacyKitchenNames].sort(),`${id}: exactly four old kitchen aggregates are replaced`);
    const fit=data.kitchenFitout;
    const sourceParts=new Map(fit.parts.concat(fit.countertops,fit.appliances).map(p=>[p.id,p]));
    const expected=[['shaft','shaft','wall'],['north','north_top','cabinet'],['east','east_top','cabinet'],['south','south_top','cabinet'],['fridge','kitchen_fridge','metal']].map(([suffix,sourceId,tone])=>{
      const p=sourceParts.get(sourceId);ok(p,`${id}: kitchen footprint has explicit source ${sourceId}`);
      return {id:`kitchen_${suffix}_footprint`,x:p.x,y:p.y,w:p.w,d:p.d,heightCm:p.zCm+(p.hCm??p.heightCm),tone,roomId:'kitchen',a:0,kitchenFitoutId:kitchenRevision};
    });
    same(data.furniture.filter(f=>kitchenFurnitureIds.has(f.id)).map(physical),expected,`${id}: five exact kitchen collision/plan aggregates derive from fitout parts`);
    ok(!data.furniture.some(f=>legacyKitchenNames.has(f.name)),`${id}: no duplicate legacy kitchen aggregates`);
  }
  same(rev.version,'3.6.1',`${id}: supplement release version`);
  same(rev.source,sourcePath,`${id}: current evidence source`);
  same(rev.stage,'partial-confirmed',`${id}: no false complete-survey claim`);
  same(rev.oldEnvelope,true,`${id}: unresolved global datum remains explicit`);
  for(const sourceId of ['O_S_DEPTH','D_SUITE_STEP']) {
    ok(record(sourceId),`${id}: cited bath-outline source ID exists`);
    ok(rev.applied.some(item=>item.note.includes(sourceId)),`${id}: bath-outline derivation cites the real source ID ${sourceId}`);
  }
  same(data.layout.measured,false,`${id}: renovation stays a conditional design`);
  same(data.envelope,old.envelope,`${id}: no global envelope scaling`);
  same(data.walls,old.walls,`${id}: every wall XY unchanged`);
  same(wallGeometry(data.wallSpecs),wallGeometry(old.wallSpecs),`${id}: wall thicknesses and segment heights unchanged`);
  same(roomGeometry(data.rooms),roomGeometry(old.rooms),`${id}: all renovation floor polygons, areas and heights unchanged`);
  if(!purchased)same(data.furniture.filter(f=>!kitchenFurniture(f)).map(physical),old.furniture.filter(f=>!kitchenFurniture(f)).map(physical),`${id}: furniture and its operational fields unchanged outside the exact kitchen replacement`);
  else {
    // Six explicitly selected products are checked independently below, not
    // granted a generic furniture exemption. No unrelated furniture may move.
    const protectedFurniture=items=>items.filter(f=>!purchasedNames.has(f.name)&&!kitchenFurniture(f)).map(f=>physical(id==='family'&&f.id==='family_sofa_back_storage'?{...f,y:899}:f));
    same(protectedFurniture(data.furniture),protectedFurniture(old.furniture),`${id}: every non-purchased furniture field preserved; only family back cabinet moves 10 cm`);
    same(data.furniture.length,old.furniture.length+(kitchen?1:0),`${id}: only four old kitchen aggregates replaced by five exact new footprints; no unrelated furniture added/removed`);
    if(id==='family')near(data.furniture.find(f=>f.id==='family_sofa_back_storage').y,909,'Family back cabinet exact authorised new y');
    const currentSofa=data.furniture.find(f=>f.name==='三人沙发'),oldSofa=old.furniture.find(f=>f.name==='三人沙发');
    same(currentSofa.rugCm,oldSofa.rugCm??{x:oldSofa.x-12,y:oldSofa.y-185,w:oldSofa.w+24,d:192},`${id}: existing rug exactly preserved`);
  }
  same(data.doors.map(physical),old.doors.map(physical),`${id}: proposed doors not replaced by existing-door measurements`);
  for(const key of ['palette','appearance','wallFitouts','modelAddons','clearances']) same(data[key],old[key],`${id}: ${key} preserved`);
  if(!purchased)for(const key of ['storageFitouts','garage','laundry','pulloutDining'])same(data[key],old[key],`${id}: ${key} preserved`);
  else {
    same(data.pulloutDining,undefined,`${id}: fixed purchased table has no pullout state`);
    same(data.storageFitouts.map(f=>f.id),old.storageFitouts.map(f=>f.id),`${id}: no cabinet fitouts added/removed`);
    for(const fit of data.storageFitouts){
      const before=old.storageFitouts.find(f=>f.id===fit.id);
      if(id!=='family'||!['dining_sideboard_wall','sofa_back_storage'].includes(fit.id))same(fit,expectedPurchasedCopy(before),`${id}/${fit.id}: untouched cabinetry except exact purchased-product copy corrections`);
      else {
        const expected=structuredClone(before.parts);
        for(const part of expected){
          if(part.id==='family_sideboard_1_base'){
            same(part.role,'pullout_table_cabinet','Whitelist matches one actual old module');part.role='sideboard_base';
            for(const key of ['diningFitoutId','tableTopHeightCm','cavityHeightCm'])delete part[key];
          }
          if(part.id==='family_sofa_back_base')part.y=909;
        }
        same(fit.parts,expected,`${id}/${fit.id}: all individual cabinet parts exact, except the named mechanism removal/back-cabinet translation`);
        same(omit(fit,['title','summary','dimensions','conditions','references','parts']),omit(before,['title','summary','dimensions','conditions','references','parts']),`${id}/${fit.id}: same fitout identity and segments`);
      }
    }
    if(data.garage){
      same(omit(data.garage,['metrics','conditions']),omit(old.garage,['metrics','conditions']),`${id}: entire physical garage, items, supports and door operation preserved`);
      const allowedMetrics=['southChairPulledGapCm','tableSideboardGapCm','sideboardChairGapCm','local44cmCabinetToTableMinimum'];
      same(omit(data.garage.metrics,allowedMetrics),omit(old.garage.metrics,allowedMetrics),`${id}: unrelated garage metrics unchanged`);
      // Metric text may be updated separately, but any changed number must be
      // the new measured-from-source value rather than an arbitrary exemption.
      for(const [key,value] of Object.entries({southChairPulledGapCm:68.5,tableSideboardGapCm:67.5,sideboardChairGapCm:79.5,local44cmCabinetToTableMinimum:63.5}))if(data.garage.metrics[key]!==old.garage.metrics[key])near(data.garage.metrics[key],value,`${id}: updated ${key}`);
    }else same(data.garage,old.garage,`${id}: no garage introduced`);
    if(data.laundry){
      same(omit(data.laundry,['conditions','dimensions','metrics']),expectedPurchasedCopy(omit(old.laundry,['conditions','dimensions','metrics'])),`${id}: all physical laundry components preserved; only exact purchased-product copy corrections permitted`);
      same(omit(data.laundry.metrics,['sofaBookcaseGapCm']),omit(old.laundry.metrics,['sofaBookcaseGapCm']),`${id}: other laundry metrics unchanged`);
      if(data.laundry.metrics.sofaBookcaseGapCm!==old.laundry.metrics.sofaBookcaseGapCm)near(data.laundry.metrics.sofaBookcaseGapCm,60,`${id}: new sofa/bookcase separation`);
    }else same(data.laundry,old.laundry,`${id}: no laundry introduced`);
  }
  same(data.bayFitouts.map(f=>({id:f.id,openingId:f.openingId,type:f.type,parts:f.parts})),old.bayFitouts.map(f=>({id:f.id,openingId:f.openingId,type:f.type,parts:f.parts})),`${id}: bay furniture and cushions not moved/rescaled`);
  same(data.windows.map(w=>w.id),old.windows.map(w=>w.id),`${id}: no windows added or removed`);
  for(const w of data.windows) {
    const before=old.windows.find(item=>item.id===w.id);
    const expected=physical(before);
    if(w.id==='window_a') Object.assign(expected,{x1:411,x2:587,widthMm:1760});
    same(physical(w),expected,`${id}: exact allowed geometry for ${w.id}`);
    near(Math.hypot(w.x2-w.x1,w.y2-w.y1)*10,w.widthMm,`${id}/${w.id}: real span and displayed width agree`);
  }
  const master=data.windows.find(w=>w.id==='window_a');
  near(master.x1*10-3250,860,`${id}: master left offset is sourced 860 from retained inner wall`);
  near(6750-master.x2*10,880,`${id}: retained right wall is 880, not silently relabeled as measured 870`);
  near(master.sillCm,41,`${id}: master sill 410`);
  near(master.heightCm,166,`${id}: master height 1660`);
  const bath=data.windows.find(w=>w.id==='window_bath_1_east');
  near(bath.sillCm,150,`${id}: user-selected bathroom sill placeholder retained`);
  near(bath.heightCm,80,`${id}: user-selected bathroom window-height placeholder retained`);
  same(bath.measuredDimensions,{widthMm:500,heightMm:1400,sillMm:null,fullyLocated:false},`${id}: confirmed window size and unknown sill stored separately from visual placeholder`);
  same(bath.placeholderDecision.userConfirmed,true,`${id}: retaining the bathroom placeholder records the user choice`);
  same([bath.placeholderDecision.sillMm,bath.placeholderDecision.heightMm],[1500,800],`${id}: explicit placeholder description matches actual geometry`);
  const pending=JSON.stringify(rev.pending);
  for(const value of ['150mm','40mm','10mm','1400','1500','800','1700','940']) ok(pending.includes(value),`${id}: unresolved/design caveat ${value} is visible`);
  const liveCopy=JSON.stringify({revision:rev,windows:data.windows,bayFitouts:data.bayFitouts,geometryNotes:data.geometryNotes,renovationNotes:data.renovationNotes});
  const currentCopy=liveCopy.replaceAll('不再保留850mm冲突','已撤销的历史冲突');
  ok(!/相差850|差850|链差850|850mm冲突/.test(currentCopy),`${id}: superseded master 850 mm discrepancy is not current advice`);
  ok(!/1400可能是窗高或窗台高|“高1400”含义待核/.test(liveCopy),`${id}: window height meaning is no longer called unknown`);
  for(const [mm,room] of [[20,'次卧'],[30,'客餐厅']]) {
    const text=JSON.stringify(rev);
    ok(new RegExp(`${mm}\\s*(?:mm|毫米)?`).test(text)&&/接受/.test(text),`${id}: accepted ${room} ${mm} mm deviation recorded`);
  }
  const local=rev.localExistingPlans?.find(plan=>plan.id==='suite-bath-existing');
  ok(local,`${id}: independently rendered existing bathroom survey plan exists`);
  same(local.pointsMm,[[0,0],[2400,0],[2400,1530],[1010,1530],[1010,1320],[0,1320]],`${id}: existing bathroom step is in the right direction and exact scale`);
  const localText=JSON.stringify(local);
  ok(/现状/.test(localText)&&/推算/.test(localText),`${id}: local plan distinguishes measured existing segments from calculated overall dimensions`);
  ok(!data.rooms.some(room=>room.id===local.id),`${id}: reference polygon is not added to the proposed 3D floorplan`);
  same(data.rooms.find(room=>room.id==='bath_1').points,old.rooms.find(room=>room.id==='bath_1').points,`${id}: existing survey does not consume the proposed suite foyer`);
  if(id!=='wood') same(data.bayFitouts.find(f=>f.openingId==='window_a').parts,[],`${id}: no master desk reintroduced`);
  else ok(/高桌|桌面/.test(JSON.stringify(rev.pending)), 'wood: retained desk still requires support/ergonomic redesign');
  const scheme=catalog.schemes.find(s=>s.id===id);
  ok(scheme&&scheme.active!==false,`${id}: active scheme still available`);
  reports.push({scheme:id,masterWindowMm:1760,existingBathroomReferenceOnly:true});
}

// Actual exported geometry regression, including inherited object transforms.
// The kitchen exception below names individual parts/devices and four legacy
// furniture IDs. It never exempts a room, kitchen window, or existing wall.
// The Blender audit separately verifies every real north-wall solid/cut/trim.
if(process.argv.includes('--glb')) {
  function decode(bytes) {
    same(bytes.readUInt32LE(0),0x46546c67,'Valid GLB magic');
    const length=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+length)),bin=bytes.subarray(28+length),parents=new Map(),matrices=new Map();
    g.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parents.set(c,i)));
    const matrix=i=>{if(matrices.has(i))return matrices.get(i);const n=g.nodes[i],m=new THREE.Matrix4();if(n.matrix)m.fromArray(n.matrix);else m.compose(new THREE.Vector3(...(n.translation||[0,0,0])),new THREE.Quaternion(...(n.rotation||[0,0,0,1])),new THREE.Vector3(...(n.scale||[1,1,1])));if(parents.has(i))m.premultiply(matrix(parents.get(i)));matrices.set(i,m);return m;};
    return g.nodes.flatMap((n,i)=>{
      if(n.mesh===undefined)return [];
      const meta={};for(let a=i;a!==undefined;a=parents.get(a))for(const[k,v]of Object.entries(g.nodes[a].extras||{}))if(meta[k]===undefined)meta[k]=v;
      const triangles=[];
      for(const p of g.meshes[n.mesh].primitives){
        same(p.mode??4,4,'Triangle primitive');
        const a=g.accessors[p.attributes.POSITION],v=g.bufferViews[a.bufferView],offset=(a.byteOffset||0)+(v.byteOffset||0),stride=v.byteStride||12,points=[];
        same(a.componentType,5126,'Float position accessor');same(a.type,'VEC3','3D position accessor');
        for(let k=0;k<a.count;k++){const at=offset+k*stride,point=new THREE.Vector3(bin.readFloatLE(at),bin.readFloatLE(at+4),bin.readFloatLE(at+8)).applyMatrix4(matrix(i));points.push(point.toArray().map(value=>Math.round(value/.00001)).join(','));}
        let indices;
        if(p.indices===undefined)indices=Array.from({length:a.count},(_,k)=>k);
        else{const a=g.accessors[p.indices],v=g.bufferViews[a.bufferView],start=(a.byteOffset||0)+(v.byteOffset||0),size={5121:1,5123:2,5125:4}[a.componentType],read={5121:'readUInt8',5123:'readUInt16LE',5125:'readUInt32LE'}[a.componentType];ok(size,'Supported triangle index type');indices=Array.from({length:a.count},(_,k)=>bin[read](start+k*(v.byteStride||size)));}
        for(let k=0;k<indices.length;k+=3)triangles.push(indices.slice(k,k+3).map(index=>points[index]).sort().join(';'));
      }
      return [{name:n.name,meta,geometry:createHash('sha256').update(triangles.sort().join('\n')).digest('hex')}];
    });
  }
  for(const id of ['wood','family','laundry']) {
    const scheme=catalog.schemes.find(s=>s.id===id),path=scheme.model;
    const now=decode(await readFile(new URL(path,root))),before=decode(execFileSync('git',['show',`${baseline}:${path}`],{cwd,maxBuffer:200*1024*1024}));
    // Office-fitout meshes inherit openingId as well: they are furniture, not
    // window-frame exceptions, and must remain in the protected comparison.
    const data=await json(`models/schemes/${id}/design-data.json`),purchased=data.purchasedFurnitureRevision?.version==='3.7.0';
    const fit=data.kitchenFitout,parts=new Map((fit?.parts??[]).concat((fit?.countertops??[]).map(p=>({...p,role:'countertop'}))).map(p=>[p.id,p]));
    const applianceIds=new Set((fit?.appliances??[]).map(a=>a.id));
    const diningLight=m=>/^(Dining[ _]pendant[ _]ceiling[ _]rose|Pendant[ _]thin[ _]suspension|Organic[ _]linen[ _]pendant|Pendant[ _]opal[ _]diffuser)(?:[ ._]|$)/.test(m.name);
    // Product meshes are envelope-audited by test_purchased_furniture. Rugs
    // share sofa metadata but stay protected. Cabinet exceptions are individual
    // part IDs, never the whole wall or whole storage fitout.
    const purchaseAllowed=m=>purchased&&(
      (purchasedNames.has(m.meta.furnitureName)&&!/rug/i.test(m.name))||
      (id==='family'&&m.meta.diningFitoutId==='family_pullout_dining')||
      (id==='family'&&['family_sideboard_1_base','family_sofa_back_base'].includes(m.meta.storagePartId))||diningLight(m));
    const surveyOrPurchaseAllowed=m=>(m.meta.openingId==='window_a'&&m.meta.kind==='window')||(m.meta.wallIndex===0&&m.meta.kind==='wall')||/^Skirting 00(?:\.|$)/.test(m.name)||purchaseAllowed(m);
    const kitchenAllowed=m=>{
      if(!fit||fit.id!==kitchenRevision||m.meta.openingId||m.meta.wallIndex!==undefined)return false;
      if(m.meta.kind==='furniture'&&legacyKitchenNames.has(m.meta.furnitureName)&&m.meta.furnitureId===m.meta.furnitureName)return true;
      if(m.meta.kitchenFitoutId!==fit.id)return false;
      const part=parts.get(m.meta.kitchenPartId);
      if(part)return m.meta.kitchenRole===part.role&&m.meta.kind===(part.role==='shaft'?'wall':'furniture');
      return m.meta.kind==='furniture'&&m.meta.kitchenRole==='appliance'&&applianceIds.has(m.meta.kitchenApplianceId);
    };
    const allowed=m=>surveyOrPurchaseAllowed(m)||kitchenAllowed(m);
    const oldProtected=before.filter(m=>!allowed(m)),newProtected=now.filter(m=>!allowed(m));
    ok(before.filter(m=>!surveyOrPurchaseAllowed(m)).length>1250,`${id}: original broad actual-mesh coverage before subtracting the four exact kitchen furniture IDs`);
    same(newProtected.map(m=>m.geometry).sort(),oldProtected.map(m=>m.geometry).sort(),`${id}: every world triangle outside the exact master-opening/product/individual-cabinet/pendant/kitchen-part scope is unchanged; kitchen walls and windows stay protected`);
    const blender=process.env.BLENDER_PATH||fileURLToPath(new URL('../.house-design-tools/blender-4.5.9-windows-x64/blender.exe',root));
    const audit=execFileSync(blender,['--background',fileURLToPath(new URL(path.replace(/\.glb$/,'.blend'),root)),'--python-exit-code','1','--python',fileURLToPath(new URL('tools/audit_measurement_native.py',root)),'--',id],{cwd,encoding:'utf8',maxBuffer:30*1024*1024});
    ok(audit.includes('"passed": true')&&audit.includes('"scheme": "'+id+'"'),`${id}: independent native mesh audit checks allowed wall/opening changes`);
    reports.find(r=>r.scheme===id).unchangedPhysicalMeshes=oldProtected.length;
  }
}
// Run the independent numeric/physical guard whenever the narrow purchased
// exception is active; --glb also verifies six real product envelopes/pendants.
if(kitchenActive)await import('./test_kitchen_fitout.mjs');
if(purchasedActive)await import('./test_purchased_furniture.mjs');
console.log(JSON.stringify({passed:true,baseline,measurementSource:sourcePath,checks,schemes:reports},null,2));
