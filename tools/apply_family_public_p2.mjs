// Replay the owner-approved public P2 without modifying R3 private geometry.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),baselineCommit='d81f065';
const baselineBytes=execFileSync('git',['show',baselineCommit+':models/schemes/family/design-data.json'],{cwd:root,maxBuffer:16e6});
const base=JSON.parse(baselineBytes),hash=b=>createHash('sha256').update(b).digest('hex');
const write=(p,d)=>fs.writeFileSync(path.join(root,p),JSON.stringify(d,null,2)+'\n');
const fixturePath='tools/fixtures/family-public-p2-confirmed.json';
const draftPath=process.argv.find(v=>v.startsWith('--draft='))?.slice(8);
const fields=['furniture','storageFitouts','garage','laundry','modelAddons'];
if(draftPath){
 const draft=JSON.parse(fs.readFileSync(draftPath));assert.equal(draft.previewOnly.revision,'P2');assert.equal(draft.previewOnly.sourceSha256,hash(baselineBytes));
 for(const k of ['walls','wallSpecs','doors','windows','layout','measurementRevision','kitchenFitout','bayFitouts','wallFitouts'])assert.deepEqual(draft[k],base[k]);
 write(fixturePath,{baselineCommit,sourceSha256:hash(baselineBytes),...Object.fromEntries(fields.map(k=>[k,draft[k]])),confirmation:draft.previewOnly});
}
const fixture=JSON.parse(fs.readFileSync(path.join(root,fixturePath))),d=structuredClone(base);
assert.equal(fixture.sourceSha256,hash(baselineBytes));for(const k of fields)d[k]=structuredClone(fixture[k]);
for(const p of d.garage.parts)p.material=p.role==='shelf'?'OakLight':'Cream';
d.version='3.11.0';d.geometryRevision='2026-10-05 · family public P2 confirmed / R3 private retained';
const conditions=[
 '按确认P2：VIMLE沙发2410×980mm向东430、向南500mm；2000×250×650mm背柜随移，距沙发20mm，朝南取物。',
 '地毯2240×1780mm位于电视柜前沿与沙发前沿之间，两端各70mm，横向与沙发居中；1200×620mm茶几同步居中。',
 'LISABO固定餐桌1400×780×740mm竖放贴西柜；四把椅子北1、东2、南1，不可折叠或收入柜内。贴靠餐柜段取物受限；餐柜850mm与桌740mm相差110mm。',
 '餐边柜从800库北缘沿西墙连续布置4260mm，下柜深440mm、上柜深280mm；800库北面不做返柜。',
 '800库暂按1500×1000mm外包，北开四扇内折、双侧叠停；前365mm必须留空，支架及五金未深化。',
 '餐柜接长后，柜面与东侧叠门之间约980mm，小于儿童车1100mm横向包络，不能直接横抽。取车须移开南椅、斜转抬取，是否实际可用必须用实车排演；本版不视为取放已通过。',
 '两车上下分层：折叠婴儿车750×550mm落地，儿童车1100×500mm抬放至1230mm平台。台架、承重、防倾倒、防坠及人体握持未认证，不能让孩子自行攀爬取车。',
 '客厅东侧3180×300mm书架取消，改两幅600×800mm薄框挂画示意，不加落地柜；沙发至实墙470mm仅为侧缝，主要通行走西侧约1305mm。',
 '阳台并排洗烘、上方浅盆、三轨门及厨房保留原位；取消书架后不再以门框与柜面齐平描述。690mm阳台操作带、980mm浅盆台高及设备安装条件仍待核。',
 '新柜体、折门及挂画尺寸是确认设计假设，不是新增复尺或施工图。R3卧卫墙门及原测量待核记录不变。'
];
const roomDescriptions={
 overall:{title:'连续餐柜，北开储物，动线留在西侧',description:'方案二保留R3卧卫墙门，公共区应用确认P2：沙发和背柜向东南调整；餐桌竖放贴西柜，北1东2南1四席。餐边柜从北开800库连续向北；地毯及茶几居中，东墙书架改挂画。800库取车空间偏紧，儿童车斜转抬取必须实车验证。',features:['P2公区已确认','R3卧卫保留','北开四扇折门']},
 living:{title:'地毯居中，沙发侧墙留给画',description:[conditions[0],conditions[1],conditions[7],'低飘窗软垫、电视柜和落地灯原位保留；地面不新增桌椅或落地装饰。'].join(' '),features:['VIMLE 2410×980mm','居中地毯与茶几','东墙薄框挂画']},
 dining:{title:'从800库起，连成一面餐柜',description:[conditions[2],conditions[3],conditions[4],conditions[5],conditions[6]].join(' '),features:['固定餐桌竖放贴柜','4260mm连续餐柜','取车动作待实核']},
 balcony:{title:'洗烘浅盆保留，门位不变',description:conditions[8]+' 取消的是客厅书架，不扩大阳台、不移动外墙。',features:['并排洗烘＋浅盆','三轨门位置保留','东墙改挂画']}
};
d.familyPublicP2Revision={id:'family-public-p2',version:d.version,date:'2026-10-05',baselineCommit,confirmedPlan:fixturePath,conditions,roomDescriptions,clearancesMm:fixture.confirmation.clearancesMm,movementValidation:d.garage.movementValidation,designConfirmed:true,constructionApproved:false};
// Superseded revisions are provenance, not current UI instructions.
d.familyPublicP2Revision.previousCopy={geometryNotes:base.geometryNotes,purchasedLayoutNotes:base.purchasedFurnitureRevision.layoutNotes,purchasedClearances:base.purchasedFurnitureRevision.clearancesCm,laundryDimensions:base.laundry.dimensions};
d.geometryNotes=[...base.familyR3Revision.conditions,...conditions];
d.storageDesign.title='北开四扇内折800库 × 连续餐柜 × 竖放LISABO';
d.storageDesign.assumptions=[...conditions,d.purchasedFurnitureRevision.modelNotice];
d.storageDesign.useZones=[{id:'garage_north_takeout_pending',x:256.5,y:1233.5,w:98,d:51.5,label:'取车动作待实车排演；先移南椅，儿童车斜转抬取。此框不是已验证操作区。',validated:false}];
for(const note of d.renovationNotes)if(roomDescriptions[note.roomId]){note.text=roomDescriptions[note.roomId].description;note.status='P2确认设计 · 操作与安装待核';}
d.purchasedFurnitureRevision.layoutNotes=conditions.slice(0,8);
d.purchasedFurnitureRevision.clearancesCm={westSideboardToSofa:130.5,sofaToEastWall:47,coffeeToSofa:65,sofaToBackStorage:2,westSideboardToTable:0,tableEastChairToKitchenFrame:130.75,garageToSouthChair:51.5};
for(const id of ['living','dining'])d.purchasedFurnitureRevision.roomDescriptions[id]=roomDescriptions[id].description;
d.laundry.title='家政阳台 · 并排洗烘与浅盆 / 客厅改挂画';
d.laundry.dimensions=[base.laundry.dimensions[0],base.laundry.dimensions[1],'原B书架取消，东墙改两幅600×800mm薄框挂画示意；阳台三轨门原位保留，不再与书架齐平。','阳台操作带690mm；沙发至实墙470mm不是主通道，西侧主路约1305mm。',base.laundry.dimensions[4]];
d.laundry.conditions=base.laundry.conditions.filter(v=>!v.includes('已购LISABO'));d.laundry.conditions.push(conditions[7],conditions[8]);
for(const k of ['familyFlowRevision','familyEntryRevision','familyLaundryRevision','garageRevision'])if(d[k])d[k]={...d[k],supersededForPublicLayoutBy:'family-public-p2'};
for(const k of ['walls','wallSpecs','doors','windows','layout','measurementRevision','kitchenFitout','bayFitouts','wallFitouts','familyR3Revision'])assert.deepEqual(d[k],base[k],k+' protected');
for(const f of base.furniture.filter(f=>f.y<625))assert.deepEqual(d.furniture.find(x=>(x.id||x.name)===(f.id||f.name)),f);
write('models/schemes/family/design-data.json',d);
const cat=JSON.parse(execFileSync('git',['show',baselineCommit+':models/design-schemes.json'],{cwd:root})),s=cat.schemes.find(s=>s.id==='family');
cat.version=d.version;cat.updatedAt='2026-10-05';
Object.assign(s,{version:d.version,assetRevision:d.version,tagline:roomDescriptions.overall.title,summary:roomDescriptions.overall.description,layoutChanges:conditions,differences:conditions.slice(0,5),tradeoffs:[...conditions.slice(5),...base.familyR3Revision.conditions.slice(3)]});
Object.assign(s.roomOverrides,roomDescriptions);
s.renderSpec.note='P2受影响公共区视角由当前Blender场景重渲；未变空间保留既有渲染及原始来源链，逐帧注明来源。';
write('models/design-schemes.json',cat);
console.log('family P2 source ready: 3.11.0, R3 geometry retained, no other scheme changed');
