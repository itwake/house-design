// Reproduce the approved entrance revision from the published, immutable scene.
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),cwd=fileURLToPath(root),BASE='0466fda';
const original=path=>JSON.parse(execFileSync('git',['show',BASE+':'+path],{cwd,encoding:'utf8',maxBuffer:8e6}));
const d=original('models/schemes/family/design-data.json');
const summary='入户储物缩为1500×650mm，与右鞋柜前后齐平；东侧开口朝入户玄关，婴儿车落地、儿童车抬放。恢复4610mm连续餐边柜，四人餐桌及四椅向门口移950mm、向东移150mm。保留并排洗烘、浅盆、整墙书架、低飘窗与卧卫布局。';
const conditions=[
 '1500×650×2500mm是暂估外包值，占地0.975㎡；内部1460×610mm，前后与右鞋柜对齐，不是量房或施工图。',
 '两车不再同时落地：折叠婴儿车750×550×1050mm落地，儿童车1100×500×750mm抬放至1230mm平台完成面。必须复核实车含把手、脚踏与折叠状态。',
 '儿童车1200mm高独立支架、30mm平台仅为构造占位；载荷、锚固、防倾倒、防坠与托轮定位须厂家验算，不让孩子自行攀爬取车。成人需抬放约1.23m，不等于方便推入或自动升降。',
 '东面名义净开610mm，单扇门北铰向玄关外开90°；打开后端部至右鞋柜约720mm。五金、门厚、实际净开与全程扫门包络待深化。',
 '取车必须先关闭入户门、收好餐椅，一次一辆；车移至入户门扫范围外后，先关闭储物柜门，再开启入户门。两门不能同时操作，柜门打开时会与入户门中途扫动相交。模型仅验证矩形包络，人体握持、抬放、降车转向及门外走廊须实物排演。',
 '整墙餐边柜沿西墙4610mm，下柜400mm、上柜280mm深；850mm台面和650mm中空。分为1200/1200/1200/1010mm四模块，下柜用移门、不做外伸抽屉。',
 '餐桌及四椅整体南移950mm、东移150mm；桌沿至柜面675mm、东侧至厨房墙900mm。南椅拉出300mm后至储物柜约525mm，仅紧凑使用，不应同时穿行。',
 '保留右鞋柜、现有卧卫/书房、厨房大窗、生活阳台并排洗烘及整墙书架；客厅低飘窗400mm加50mm软垫，不恢复桌椅。柜体、插座、通风、防火及安装收口待复尺。'
];
d.version='3.5.1 · aligned entrance storage';d.geometryRevision='family-entry-2026-09-30';d.layout.intent=summary;
d.familyEntryRevision={version:'3.5.1',baselineCommit:BASE,measured:false,scope:'仅入户库、连续餐边柜、餐桌椅与依附灯具；保留3.5.0家政与所有房间几何。',ownerChoice:'仍收两辆车，可接受一辆抬放；本模型儿童车抬放，婴儿车落地。'};
d.garageRevision={version:'3.5.1',baselineCommit:BASE,measured:false,scope:d.familyEntryRevision.scope};
const g=d.garage;
Object.assign(g,{title:'入户 · 齐鞋柜分层800库',x:212,y:1320,w:150,d:65,heightCm:250,face:'east',inner:{x:214,y:1322,w:146,d:61},opening:{x:362,x1:362,x2:362,y1:1322,y2:1383,clearWidthCm:61,heightCm:242},doorState:'hinged-open',doorOperation:{type:'hinged',hingeCm:[362,1322],angleDeg:90,condition:'关闭入户门后使用；全程扫动及实物抬放需现场复核。'},conditions});
delete g.doorStackSide;delete g.doorFoldDirection;
g.items=[{id:'folded_stroller',label:'落地折叠婴儿车',kind:'folded-stroller',x:238,y:1325,w:75,d:55,zCm:0,hCm:105,rotationDeg:0,modelWidthCm:75,modelDepthCm:55},{id:'child_bike',label:'上层儿童车 · 抬放',kind:'child-bike',x:220,y:1326,w:110,d:50,zCm:123,hCm:75,rotationDeg:0,modelWidthCm:110,modelDepthCm:50}];
const part=(id,role,x,y,w,depth,z,h,material='Cream')=>({id,role,x,y,w,d:depth,zCm:z,hCm:h,material});
g.shelves=[{x:216,y:1324,w:142,d:57,zCm:120,hCm:3},{x:216,y:1324,w:142,d:57,zCm:210,hCm:2},{x:216,y:1324,w:142,d:57,zCm:242,hCm:2}];
g.parts=[part('west','panel',212,1320,2,65,0,248),part('north','panel',214,1320,146,2,0,248),part('south','panel',214,1383,146,2,0,248),part('roof','roof',212,1320,150,65,248,2),part('header','header',360,1322,2,61,242,6),part('hinged-leaf','hinged-door',362,1322,61,2.5,.8,241.2)];
for(const x of [216,356])for(const y of [1322,1381])g.parts.push(part(`post-${x}-${y}`,'rack-post',x,y,2,2,0,244,'WarmGrayMetal'));
for(const y of [1322,1379])g.parts.push(part(`support-rail-${y}`,'support-rail',216,y,142,4,118,2,'WarmGrayMetal'));
g.shelves.forEach((p,i)=>g.parts.push({...p,id:`shelf-${i}`,role:'shelf',material:'OakLight'}));
for(let i=0;i<3;i++)g.parts.push(part(`light-bin-${i}`,'toy-bin',222+i*43,1329,37,42,212,25,i===1?'Linen':'Sage'));
g.metrics={footprintM2:.975,previousFootprintM2:1.8,reductionPercent:45.83,tableShiftFromV350Cm:{x:15,y:95},entryAisleClosedCm:133,entryAisleDoorOpenCm:72,southChairPulledGapCm:52.5,tableSideboardGapCm:67.5,sideboardChairGapCm:75.5,doorClearCm:61,vehicleTakeout:'关闭入户门后向东逐辆抽取；儿童车在1230mm高处抬放，人体与实际转向未认证。'};
Object.assign(d.storageDesign,{title:'齐鞋柜分层800库＋连续餐边柜',assumptions:conditions,useZones:[{id:'garage_east_takeout',x:362,y:1325,w:110,d:55,label:'东向取车前场；关闭入户门，一次一辆，不同时通行。'}]});
const fit=d.storageFitouts.find(f=>f.id==='dining_sideboard_wall');
Object.assign(fit,{title:'餐边 · 连续4610mm备饮收纳墙',summary:'西墙从低飘窗下方延续至入户库北面；四模块连续柜，餐桌移向门口。车辆与杯盘保持分腔。',segments:[{id:'west-continuous',title:'整墙连续餐边柜 · 至入户库北面',face:'east'}],dimensions:['沿墙4610mm；下柜400mm、上柜280mm深，柜高2500mm','台面850mm，中空650mm；四模块1200/1200/1200/1010mm','1200×700mm餐桌及四椅南移950mm、东移150mm','桌沿至西柜675mm、东侧主路900mm；南椅拉出后约525mm'],conditions:conditions.slice(5),parts:[]});
let y=859;
for(const [i,length]of [120,120,120,101].entries()){
 const common={segmentId:'west-continuous',x:212.5,y,d:length,face:'east'};
 fit.parts.push({...common,id:`family_sideboard_${i}_base`,role:'sideboard_base',w:40,zCm:0,hCm:85,doorStyle:'sliding',doorPanels:2,drawerPanels:0},
 {...common,id:`family_sideboard_${i}_niche`,role:'sideboard_niche',w:40,zCm:85,hCm:65,omitEndPanel:true},
 {...common,id:`family_sideboard_${i}_upper`,role:'upper_cabinet',w:28,zCm:150,hCm:100,doorPanels:2});
 y+=length;
}
fit.parts.push({id:'family_sideboard_dining_accessories',role:'dining_accessories',segmentId:'west-continuous',x:217.5,y:1080,w:28,d:60,zCm:85,hCm:40,face:'east'});
for(const f of d.furniture){
 if(/餐桌|餐椅/.test(f.name)){f.x+=15;f.y+=95;}
 if(f.id==='family_sideboard')Object.assign(f,{name:'4610整墙餐边柜',x:212.5,y:859,w:40,d:461,notes:fit.summary});
 if(f.garageFitoutId)Object.assign(f,{name:g.title,x:g.x,y:g.y,w:g.w,d:g.d,face:g.face,notes:summary});
}
d.laundry.conditions=d.laundry.conditions.filter(t=>!t.includes('短餐柜')&&!t.includes('沙发向北移')).concat('保持V3.5.0洗烘、台盆、书架、阳台门和客厅家具几何；本轮餐桌南移950mm后，沙发后至北餐椅约1555mm。');
d.laundry.metrics.sofaDiningChairGapCm=155.5;
d.laundry.dimensions=d.laundry.dimensions.map(t=>t.includes('沙发后到北餐椅')?'阳台操作带约690mm；书架前约700mm，沙发后至北餐椅约1555mm。':t);
d.geometryNotes=[summary,...conditions,...d.geometryNotes.filter(t=>!(/短餐柜|短餐边|1500×1200|纵向并排|北侧开口朝|先向厅内|365mm|1340mm|首层下沿1300|沙发后到北餐椅约605/.test(t)))];
for(const n of d.renovationNotes)if(n.roomId==='living')n.text=summary;else if(n.roomId==='balcony')n.text='生活阳台并排洗烘、上方浅盆、外移三轨门与电视旁整墙书架保留V3.5.0几何；台盆承重、机器散热检修和690mm操作带需深化。入户库及餐区改为齐鞋柜650mm进深分层库和连续4610mm餐柜。';
await writeFile(new URL('models/schemes/family/design-data.json',root),JSON.stringify(d,null,2)+'\n');
const c=original('models/design-schemes.json');c.version='3.5.1';c.updatedAt='2026-09-30';
const s=c.schemes.find(s=>s.id==='family');s.assetRevision='3.5.1';s.summary=summary;s.tagline='库体变浅，餐柜归位';
s.renderSpec.samples=8;
s.renderSpec.note='最低8采样；本轮11张公共区域为12采样，新渲染与8张未改私密房间参考帧的实际规格逐张记录于manifest。';
s.differences=['1500×650mm入户库与右鞋柜前后齐平，东面开口朝入户玄关。','婴儿车落地、儿童车抬放至1230mm平台；两辆车分层，不是假装同层可放。','恢复4610mm连续餐边柜，四人餐桌/四椅整体移向入口。',...d.laundry.dimensions];
s.tradeoffs=[...conditions,...d.laundry.conditions];
for(const id of ['overall','living','dining'])s.roomOverrides[id]={title:id==='dining'?'餐柜归位，车辆分层':id==='living'?'保留整墙家政与低窗坐榻':'齐鞋柜储物 × 连续餐边柜',description:summary,features:['650mm进深入户库','4610mm餐边柜','双车分层抬放']};
s.roomOverrides.balcony.description='并排洗烘、上方独立承重浅盆、外移三轨门与电视旁整墙书架均保留V3.5.0几何；所有机器型号、盆体、散热、防水及门窗收口需现场深化。';
await writeFile(new URL('models/design-schemes.json',root),JSON.stringify(c,null,2)+'\n');
console.log('Updated only family source/catalog to 3.5.1; baseline '+BASE+' and approved vehicle lifting choice recorded.');
