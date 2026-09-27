// V3.4.3: revise only the family garage, from the immutable published V3.4.2.
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),cwd=fileURLToPath(root);
const BASE='ac2b91d366b8aeb0f53744b03b1ca48f95e95fdc';
const d=JSON.parse(execFileSync('git',['show',BASE+':models/schemes/family/design-data.json'],{cwd,encoding:'utf8'}));
d.version='3.4.3 · family · 面厅紧凑800库';
d.geometryRevision='family-compact-north-facing-2026-09-27';
const summary='方案3储物库缩为1500×1200mm，约1.80㎡，北侧开口朝厅内与餐桌；儿童车和折叠婴儿车纵向并排停放。900mm短餐边柜向北移500mm，四人餐桌与其他布局不变。';
d.layout.intent=summary;
d.garageRevision={version:'3.4.3',baselineCommit:BASE,measured:false,scope:'仅方案3储物库、900mm短餐边柜及对应图文；不改其他方案、墙体、门窗、餐桌、卧卫和低飘窗。',reference:'业主提供的玄关800库照片：借鉴朝厅开口、上部浅架和无底台的大件停放，不照搬照片尺寸。'};
const conditions=[
 '1500×1200×2500mm为未实测外包设计值，约1.80㎡，比原2.445㎡减少约26%；不是照片中约1㎡的复刻。',
 '儿童车1100×500×750mm、折叠婴儿车750×550×1050mm沿用原示意包络，旋转90°纵向并排；必须复核自家实物，婴儿车需折叠。',
 '北侧开口朝餐桌，四叶柜门向厅内外折、叠停西侧，打开时前伸约365mm；名义净开1340mm，实际轨道、动态折叠、通风与防夹待厂家深化。',
 '取车前收好南侧餐椅，入户门关闭；一次取一辆，先向厅内拉出再向东转移，取车前场不能同时通行。',
 '模拟只验证车辆矩形包络，不含人体握持、实际转向约束和门外走廊；左侧婴儿车取出临近短柜，必须用实车排演。',
 '短餐边柜向北移500mm后，柜面至西侧餐椅局部约605mm，紧凑、不可同时开柜与穿行；餐桌和四椅位置不变。',
 '上方层架深350mm、首层下沿1300mm，重物低放，高处放轻量低频物品；锚固、防倾倒、载荷及儿童防攀爬须深化。',
 '落地无底台、不新增建筑隔墙；现有右鞋柜、厨房、阳台、卧卫、书架与客厅400＋50mm低飘窗均保留。'
];
const g=d.garage={...d.garage,title:'玄关 · 面厅紧凑800库',x:212,y:1269,w:150,d:120,heightCm:250,face:'north',
 opening:{x1:226,x2:360,y:1269,clearWidthCm:134,heightCm:242},
 inner:{x:214,y:1271,w:146,d:116},doorState:'folded-open',doorStackSide:'west',doorFoldDirection:'outward',
 items:[{id:'child_bike',label:'儿童车示意',kind:'child-bike',x:301,y:1274,w:50,d:110,hCm:75,rotationDeg:90,modelWidthCm:110,modelDepthCm:50},
 {id:'folded_stroller',label:'折叠婴儿车示意',kind:'folded-stroller',x:231.5,y:1305,w:55,d:75,hCm:105,rotationDeg:90,modelWidthCm:75,modelDepthCm:55}],
 shelves:[],parts:[],conditions,
 metrics:{footprintM2:1.8,previousFootprintM2:2.445,reductionPercent:26.38,tableShiftCm:{x:-25,y:-95},sideboardShiftFromV342Cm:{x:0,y:-50},entryAisleCm:133,southChairPulledGapCm:96.5,sideboardChairGapCm:60.5,doorClearCm:134,vehicleTakeout:'收好南餐椅、关闭入户门；车辆先向北出库，再向东移至玄关暂放，一次一辆。非人体/无障碍或实际车型转向认证。'}};
const part=(id,role,x,y,zCm,w,dep,hCm,material='Cream')=>g.parts.push({id,role,x,y,zCm,w,d:dep,hCm,material});
part('west','panel',212,1269,0,2,120,248);
part('east','panel',360,1269,0,2,120,248);
part('back','panel',214,1387,0,146,2,248);
part('roof','roof',212,1269,248,150,120,2);
part('header','header',214,1269,242,146,2,6);
for(let i=0;i<4;i++)part('folded-leaf-'+i,'folded-door',214+i*3,1232.5,.8,2.5,36.5,241.2);
for(const x of [216,356])for(const y of [1350,1383])part('post-'+x+'-'+y,'rack-post',x,y,125,2,2,119,'WarmGrayMetal');
for(const [i,z]of [130,171,212].entries()){
 const shelf={x:216,y:1350,w:142,d:35,zCm:z,hCm:2};g.shelves.push(shelf);
 part('shelf-'+i,'shelf',shelf.x,shelf.y,z,shelf.w,shelf.d,2,'OakLight');
 for(let j=0;j<3;j++)part('toy-bin-'+i+'-'+j,'toy-bin',220+j*45,1354,z+2,40,28,27,j%2?'Linen':'Sage');
}
const garageFurniture=d.furniture.find(f=>f.id==='family_garage');
Object.assign(garageFurniture,{x:g.x,y:g.y,w:g.w,d:g.d,face:g.face,name:'面厅紧凑800库',notes:summary});
const sideboard=d.furniture.find(f=>f.id==='family_sideboard');sideboard.y-=50;
sideboard.notes='900mm短餐边柜沿西墙向北移500mm，为储物库北向取车腾出转移带；与车辆分腔，餐椅侧通行紧凑。';
const fitout=d.storageFitouts.find(f=>f.type==='sideboard');
for(const p of fitout.parts)p.y-=50;
fitout.summary='900×400mm短餐边柜沿西墙向北移500mm；850mm备饮台、650mm中空、280mm深上柜保留。四人餐桌及四椅不再移动。';
fitout.dimensions=['沿墙900mm，下柜400mm、上柜280mm深，位置较V3.4.2北移500mm','台面850mm，中空650mm，上柜至2500mm','餐桌1200×700mm及四把椅子不变','短柜面至西侧餐椅局部约605mm；南椅拉出300mm后至库体约965mm'];
fitout.conditions=[conditions[3],conditions[4],conditions[5],'杯盘与车辆分柜腔；五金、插座、柜体固定须复尺。'];
d.storageDesign={...d.storageDesign,title:'面厅紧凑800库＋短餐边柜',referencesNote:'本轮以业主提供的800库照片为构造参考，不上传原照片，也不把照片文案当尺寸依据；原有公开参考保留。',assumptions:conditions,
 clearances:d.storageDesign.clearances.filter(c=>['entry_door_sweep','shoe_user','entry_handle_reserve'].includes(c.id)),
 useZones:[{id:'garage_north_takeout',x:226,y:1155,w:224,d:114,label:'取车前场：南餐椅收好，一次一辆，不同时通行'}]};
d.renovationNotes=d.renovationNotes.map(n=>n.roomId==='living'?{...n,text:summary+' 取车须收好南侧餐椅，尺寸均为待实车核实的示意。'}:n);
d.geometryNotes=[summary,...conditions,...d.geometryNotes.filter(n=>!/(2\.45|1630|1340|东侧取|朝东取|东向取|665mm|1500mm亲子)/.test(n))];
await writeFile(new URL('models/schemes/family/design-data.json',root),JSON.stringify(d,null,2)+'\n');
const catalog=JSON.parse(await readFile(new URL('models/design-schemes.json',root),'utf8'));
const scheme=catalog.schemes.find(s=>s.id==='family');
Object.assign(scheme,{assetRevision:'3.4.3',tagline:'库更小，朝着厅内打开',summary,
 differences:['储物库1500×1200mm，约1.80㎡，较前版减少约26%。','北侧开口朝厅内和餐桌；地面纵向并排停放儿童车与折叠婴儿车。','900mm短餐边柜向北移500mm；四人餐桌与其他布局不变。'],
 tradeoffs:conditions.slice(0,7)});
scheme.roomOverrides.overall={title:'把大件收进更紧凑的小库',description:summary,features:['面厅开口','约1.80㎡外包','其他布局不变']};
scheme.roomOverrides.dining={title:'朝餐桌打开的800库',description:summary,features:['约1.80㎡外包','北向1340mm开口','取车先收餐椅']};
catalog.version='3.4.3';catalog.updatedAt='2026-09-27';
await writeFile(new URL('models/design-schemes.json',root),JSON.stringify(catalog,null,2)+'\n');
console.log('Updated family only: 1500 x 1200 mm, north-facing, two longitudinal vehicle envelopes; short sideboard north 500 mm.');
