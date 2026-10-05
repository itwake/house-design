// Apply the owner-confirmed R3 coordinates. No new survey values are invented.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,d)=>fs.writeFileSync(path.join(root,p),JSON.stringify(d,null,2)+'\n');
const base=JSON.parse(execFileSync('git',['show','e210bd7:models/schemes/family/design-data.json'],{cwd:root,encoding:'utf8',maxBuffer:16e6}));
const d=structuredClone(base),r=read('tools/fixtures/family-r3-confirmed.json');
d.walls=r.walls;
for(const v of r.rooms)Object.assign(d.rooms.find(x=>x.id===v.id),v);
for(const v of r.doors)Object.assign(d.doors.find(x=>x.id===v.id),v,{notes:v.notes.replace('确认图暂定门洞及开启方向，待业主确认和门套净空深化。','按R3确认的门洞及开启方向；门套、五金与净空仍待现场深化。')});
for(const v of r.furniture)Object.assign(d.furniture.find(x=>v.id?x.id===v.id:x.name===v.name),v);
d.version='3.10.0';d.geometryRevision='2026-10-05 · family R3 confirmed private-layout';
const conditions=[
 '两卧按旧模型北侧6870mm总宽等分；隔墙轴线3435mm，两卧北部净宽各3255mm。这是确认的设计墙线，不是新实测；原外墙与窗洞坐标保留。',
 '次卧、主卧、书房均为900mm门洞，非成品净通行宽。次卧东铰内开靠东墙，书房北铰向室内开，主卧南铰向套内开。',
 '主卧门较R2北移340mm，门洞范围y3550–4450mm；书房门y4480–5380mm，纵向错开30mm。',
 '主卧、主卫门同时90°全开时，门板间仅约550mm通行带，仍偏紧；主卧床尾至600mm深衣柜约555mm，须现场试用，不是舒适度或无障碍认证。',
 '公共走廊约915mm净宽，次卧900mm洞口两侧余量很少，门套、合页、把手、墙端收口须专业深化，不能将洞口当成品净开。',
 '主卫北墙保持方案一原轴线y3280mm；不套用方案一其他洁具位置、门型或阶梯墙形。改墙可行性、梁柱及防水排污仍须专业核验。',
 '3.6.1复尺原始记录原样保留。新隔墙改变两卧相对窗边墙段，旧860mm/870mm等尺寸链不代表新设计闭合结果；外窗不随隔墙移动，定位及全屋共同基准仍待核。'
];
const roomDescriptions={
 overall:{title:'门位错开，卧卫关系更清楚',description:'方案二应用已确认R3墙线：两卧等分北侧模型宽度，书房改900mm平开门，主卧900mm门北移错开书房；先进入套内玄关，再到床区或主卫。亲子储物、已购家具、厨房和家政整墙保留。门板间550mm与主卧床尾555mm仍偏紧。',features:['R3确认墙线','三处900mm门洞','原亲子储物保留']},
 room_a:{title:'错开书房门，先入套内玄关',description:'主卧900mm平开门较R2北移340mm，南侧合页向套内开，与书房门洞纵向错开30mm。先入895×1650mm套内玄关，再到床区或主卫；西侧2240×600mm衣柜随等分隔墙东移，床头朝东、飘窗留白。模型面积约11.57㎡含入口，床尾净距约555mm；主卧与主卫门同时全开约550mm偏紧。窗尺寸沿用复尺记录，外窗坐标保留，改墙后的窗边尺寸链待核。',features:['900mm南铰平开','门位北移340mm','床尾555mm待核']},
 room_b:{title:'东铰靠墙开，床尾留浅台',description:'北侧两卧按模型总宽6870mm等分，次卧北部净宽3255mm，模型面积约10.09㎡。900mm门设走廊尽头，东铰向房内开，门板靠东墙；门套收口须核验。床头与南墙1800×600mm衣柜贴西墙；东侧2240×440mm浅台前留约715mm，浅台末端距全开门扇约140mm。不加独立桌椅；保留原飘窗茶座与外窗位置。',features:['900mm东铰内开','床尾约715mm','南墙衣柜保留']},
 room_c:{title:'平开门内，通长书桌与浅书架',description:'书房按R3墙线缩至模型约6.35㎡，2220mm净宽。900mm普通平开门，合页在北端，向书房内开；移除旧推拉门及轨道。北墙1900×850mm沙发，南墙2220×550mm通长桌及2220mm浅书架；椅子西移避让门扇。板材承重、吊挂及实际操作空间待深化。',features:['900mm北铰平开','2220mm通长桌架','1900mm小沙发']},
 bath_1:{title:'北墙原位，从套内玄关进入',description:'主卫北墙轴线恢复并保持方案一原y3280mm，模型净深1530mm、面积约3.43㎡。西门750mm通套内玄关；600×360mm盆柜、马桶及900×1410mm淋浴占位按R3。盆前关门使用；两扇门同时全开约550mm通行带偏紧。实测窗高1400mm已记录，但窗台与定位未定，模型仍保留台1500/高800mm旧示意，不能据此下单。',features:['北墙原位','约3.43㎡模型面积','窗定位待核']},
 bath_2:{title:'沿公共走廊独立进入',description:'西墙随R3走廊拉齐至x3435mm，客卫模型约3.94㎡，750mm西门北铰向卫内开。原盆柜、马桶、淋浴及外窗位置不变；旧实测与新设计墙位须共同基准复核，门套与洁具净空另深化。',features:['约3.94㎡模型面积','独立西门','原洁具保留']}
};
d.familyR3Revision={id:'family-r3-confirmed',version:'3.10.0',date:'2026-10-05',basis:'业主确认R3；不是新增实测',confirmedPlan:'tools/fixtures/family-r3-confirmed.json',conditions,roomDescriptions,clearancesMm:{publicCorridor:915,masterFoot:555,secondaryFoot:715,openDoorBand:550,doorwayOffset:30},previousRevision:'3.8.0'};
d.layout={...d.layout,entryZone:r.entryZone,reviewOnly:false,revision:'R3 confirmed',intent:roomDescriptions.overall.description,circulationNote:'次卧走廊尽头900门东铰内开；主卧900门南铰内开，北移错开书房，先入套内玄关再进主卫；书房900普通门北铰内开。'};
d.clearances=[{id:'public_corridor',name:'公共走廊约915mm',x:246,y:334,w:91.5,d:286},{id:'private_entry',name:'套内玄关约895×1650mm',...r.entryZone},{id:'master_open_door_band',name:'两门同时全开仅550mm · 偏紧',x:349.5,y:382,w:89.5,d:55}];
d.wallSpecs=d.walls.map((coords,i)=>{
 const existing=base.wallSpecs.find(s=>JSON.stringify(s.coords)===JSON.stringify(coords));
 const spec=existing?structuredClone(existing):{id:'family_r3_wall_'+i,coords,thicknessCm:12,heightCm:270,grade:'C',source:'R3确认设计墙线，非实测或可拆性结论'};
 if(i===0)spec.heightSegments=[{fromCm:343.5,toCm:681,heightCm:279}];
 if(i>=12&&i<=20){delete spec.heightSegments;
  if(i===12)spec.heightSegments=[{fromCm:6,toCm:493,heightCm:279}];
  if(i===16)spec.heightSegments=[{fromCm:328,toCm:493,heightCm:279}];
  if(i===17)spec.heightSegments=[{fromCm:445,toCm:681,heightCm:279}];
  if(i===18)spec.heightSegments=[{fromCm:343.5,toCm:445,heightCm:279}];
 }
 return spec;
});
const byId=id=>d.furniture.find(f=>f.id===id),byName=name=>d.furniture.find(f=>f.name===name);
byId('bed_b').notes='床头贴西墙，床架长2100mm；R3床尾至浅台715mm。踢脚线、软包及把手收口待复尺。';
byName('主卧衣柜').notes='西侧2240×600mm衣柜随R3等分隔墙东移，北端贴墙；床尾至柜面555mm，仍偏紧。';
byId('study_full_desk').notes='R3南墙2220×550mm通长桌，保持端板、钢架和中间支承；承载和收口待深化。';
byId('study_north_sofa').notes='1900×850mm沙发占位，背靠北墙；不是选定产品或展开沙发床，门扇扫掠已避让。';
byId('bed_b_niche_console').notes='R3东墙2240×440mm连续浅台，床尾715mm，不配椅；南端距全开门叶140mm，不是舒适办公位。';
byId('vanity_main').notes='R3随主卫西墙西移200mm，盆柜600×360mm；门开着时在盆前，洗手须先关门。';
byName('主卫淋浴区').notes='R3北墙保留原位，900×1410mm淋浴占位；管线、屏风和出入口另深化。';
// Rebuild all bookcase pieces to the new width; do not scale board thickness.
const fit=d.wallFitouts.find(f=>f.id==='study_bookwall'),t=2.2,n=6,pitch=(222-t)/n,clear=pitch-t;
fit.w=222;fit.parts=[];fit.description='R3南墙2220mm通长浅书架，保留两排开放格与顶部暖白柜门；配下方通长桌和北墙沙发，书房已改900mm普通平开门。';
fit.conditions[0]='总宽2220mm含收口、主体深280mm、书格底1460mm、顶2500mm为设计值，待复尺。';
fit.conditions[1]='六格，每格净跨约344mm，两排净高318mm、板厚22mm；承载、支撑及锚固须定制方核验。';
const add=(id,role,x,y,z,w,depth,h,material)=>fit.parts.push({id,role,x,y,zCm:z,w,d:depth,hCm:h,material});
add('back','back',12,618.8,146,222,1.2,104,'Cream');
for(let i=0;i<=n;i++)add('upright_'+i,'upright',12+i*pitch,592,146,t,26.8,104,'Cream');
for(let i=0;i<n;i++){
 const x=12+t+i*pitch;
 for(const z of [146,180,214,247.8])add(`shelf_${i}_${z}`,'shelf',x,594.2,z,clear,24.6,t,'OakLight');
 add('door_'+i,'door',x+.15,592,216.35,clear-.3,1.8,31.3,'Cream');add('pull_'+i,'pull',x+clear/2-3,591.75,217,6,.25,.7,'WarmGrayMetal');
 for(const row of [0,1])for(let j=0;j<3+(i+row)%3;j++){
  const px=x+3+(i%2?clear*.25:0)+j*3.9,height=21+((i+j+row)%4)*2,baseZ=148.2+34*row;
  add(`book_${i}_${row}_${j}`,'book',px,595,baseZ,3.1,21,height,['WhiteLinen','Sage','OakLight','Cream'][(i+j+row)%4]);
  add(`book_label_${i}_${row}_${j}`,'book-label',px+.45,594.9,baseZ+height-5.5,2.2,.1,.5,'Cream');
 }
}
add('under_light','light-diffuser',18,594,145.2,210,1.6,.8,'Lamp');
assert(fit.parts.every(p=>p.x>=12&&p.x+p.w<=234.00001));
for(const note of d.renovationNotes)if(roomDescriptions[note.roomId]){note.text=roomDescriptions[note.roomId].description;note.status='R3设计已确认 · 非新增实测';}
// Keep old narrative for provenance, not as contradictory current instructions.
d.familyR3Revision.historicalGeometryNotes=d.geometryNotes;
d.geometryNotes=[...conditions,...new Set(base.geometryNotes.filter(s=>!/(卧卫|书房|两卧|次卧|主卧|730mm|780mm|不新增拆墙|V3\.2\.)/.test(s)))];
for(const key of ['windows','measurementRevision','kitchenFitout','laundry','garage','storageFitouts','bayFitouts','purchasedFurnitureRevision'])assert.deepEqual(d[key],base[key],key+' preserved');
write('models/schemes/family/design-data.json',d);
const cat=JSON.parse(execFileSync('git',['show','e210bd7:models/design-schemes.json'],{cwd:root,encoding:'utf8'})),s=cat.schemes.find(s=>s.id==='family');
cat.version='3.10.0';cat.updatedAt='2026-10-05';
cat.invariants=cat.invariants.map(x=>x.includes('方案二、三保留原家具布局')?x.replace('方案二、三保留原家具布局','方案二按已确认R3改墙门及家具避让，方案三保留原布局'):x);
Object.assign(s,{assetRevision:'3.10.0',version:'3.10.0',tagline:'门位错开，卧卫关系更清楚',summary:roomDescriptions.overall.description});
Object.assign(s.roomOverrides,roomDescriptions);
s.differences=[...conditions.slice(0,3),'书房2220mm通长桌架、1900mm沙发，取消旧推拉门。','已购宜家家具、入户亲子储物、家政整墙与V3.8厨房保持不变。'];
s.tradeoffs=[...conditions.slice(3),...s.tradeoffs.filter(x=>!/(卧卫|书房)/.test(x))];
s.renderSpec={...s.renderSpec,note:'方案二R3的9个受影响视角由当前Blender场景重渲；其余11个未改空间沿用历史参考图，保留原图、相机与源哈希。'};
write('models/design-schemes.json',cat);
console.log('Applied confirmed family R3 geometry, current descriptions and 2220mm bookcase; other schemes untouched.');
