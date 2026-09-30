// Folding entry + dining return + clear living route, from immutable 3.5.1.
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),cwd=fileURLToPath(root),BASE='ab45810';
const original=path=>JSON.parse(execFileSync('git',['show',BASE+':'+path],{cwd,encoding:'utf8',maxBuffer:8e6}));
const d=original('models/schemes/family/design-data.json'),compact=process.argv.includes('--compact-sofa'),dx=compact?30:10,sofaWidth=compact?200:220;
const summary=`入户库东侧改双折门，完全外翻后向北叠停；靠餐桌的北面增加1500×400mm餐柜，与4210mm西墙餐柜组成L形。餐桌椅北移600mm；沙发${sofaWidth*10}mm宽、客厅家具组东移${dx*10}mm，地毯收回客厅墙线内，落地灯移到低飘窗南端靠墙角落。`;
const conditions=[
 '1500×650mm入户库、两车分层及1230mm抬放平台保留；55cm宽推车穿57cm架腿净距仍很紧，需实车核验，承重/防坠须专业深化。',
 '东面双折门各305mm宽，完全外翻180°后在北侧门洞外叠停；叠门约55mm厚、向北投影305mm，不占名义610mm洞口。180°偏置铰链、板厚、轨道与完整折叠过程必须由厂家确认。',
 '完全停车示意至右鞋柜约1275mm，不代表开启全程已通过。取车先关闭入户门，收好餐椅；车移出门扫范围、关好储物门后再开入户门，一次一辆，人体抬放和转向需实物排演。',
 '储物库靠餐桌的北面新增1500×400mm餐柜，850mm台面、650mm中空，上柜280mm深；西墙下柜长4210mm。L形下柜西端400×400mm是封闭盲角，不计可用容量，北向可用下柜宽约1095mm。',
 '280mm深上柜转角比下柜衔接延长120mm，北向上柜有效宽约1215mm；转角单独围合，杯盘与车辆分腔，不能把两柜重叠画成双倍储物。下柜移门、无外伸抽屉。',
 '餐桌与四椅相对V3.5.1整体北移600mm；南椅拉出300mm后至返柜约725mm，北椅拉出后至沙发约655mm，不能承诺多人并行或无障碍。',
 `沙发和茶几东移${dx*10}mm；沙发宽${sofaWidth*10}mm，书架前约600mm，仅紧凑单人取物。西侧主路柜面至沙发约${(355+dx-252.5)*10}mm；灯罩至沙发约${(355+dx-270)*10}mm，不再把灯放在原走廊轴线上。`,
 '地毯为可跨越软装，不是围合墙；北缘收在y638cm，避开客卫底墙。落地灯置低飘窗南端内侧，440mm灯罩包络距西餐柜北端120mm；电线贴墙固定，不跨走道。',
 '保留卧卫、书房、三处飘窗和生活阳台实体几何；阳台操作690mm与浅盆间隙30mm仍须选型、复尺及防水深化。全部尺寸为模型推演，非施工图。'
];
d.version='3.5.2 · folding entrance and living flow';d.geometryRevision='family-flow-2026-09-30';d.layout.intent=summary;
d.familyFlowRevision={version:'3.5.2',baselineCommit:BASE,measured:false,sofaShiftCm:dx,sofaWidthCm:sofaWidth,sofaChoice:compact?'200cm沙发，东移30cm':'保留220cm沙发，东移10cm',scope:'仅折叠库门、L形餐柜、餐区平移、沙发/茶几/地毯与落地灯；建筑和家政实体不变。'};
d.familyEntryRevision={...d.familyEntryRevision,version:'3.5.2',previousVersion:'3.5.1',baselineCommit:BASE,scope:d.familyFlowRevision.scope};d.garageRevision={...d.garageRevision,version:'3.5.2',baselineCommit:BASE,scope:d.familyFlowRevision.scope};
const g=d.garage;g.parts=g.parts.filter(p=>p.role!=='hinged-door');
for(let i=0;i<2;i++)g.parts.push({id:`folded-leaf-${i}`,role:'folded-door',x:362+i*3,y:1291.5,w:2.5,d:30.5,zCm:.8,hCm:241.2,material:'Cream'});
Object.assign(g,{doorState:'folded-open',doorStackSide:'north',doorFoldDirection:'outward',doorOperation:{type:'bifold',panelCount:2,panelWidthCm:30.5,hingeCm:[362,1322],parkAngleDeg:180,condition:'先折合、再完全外翻向北贴靠返柜侧边；偏置铰链及全程五金动态待厂家深化。'},conditions:[...conditions.slice(0,3),...g.conditions.filter(t=>/两车不再|儿童车1200/.test(t))]});
g.metrics.entryAisleDoorOpenCm=127.5;g.metrics.southChairPulledGapCm=72.5;g.metrics.vehicleTakeout='向东逐辆抽取；门完全外翻后北侧停车，不占洞口。先关入户门；实际抬放/折门过程需排演。';
const fit=d.storageFitouts.find(f=>f.id==='dining_sideboard_wall');
for(const p of fit.parts.filter(p=>p.id.startsWith('family_sideboard_3_'))){p.d=p.role==='upper_cabinet'?73:61;p.omitEndPanel=true;p.flushJoints=true;}
const add=(id,role,x,y,w,depth,z,h,extras={})=>fit.parts.push({id,role,segmentId:role.includes('blind')||role.includes('corner')?'corner':'north-return',x,y,w,d:depth,zCm:z,hCm:h,face:'north',flushJoints:true,...extras});
add('family_return_base','sideboard_base',252.5,1280,109.5,40,0,85,{doorStyle:'sliding',doorPanels:2,drawerPanels:0,omitStartPanel:true});
add('family_return_niche','sideboard_niche',252.5,1280,109.5,40,85,65,{omitStartPanel:true});
add('family_return_upper','upper_cabinet',240.5,1292,121.5,28,150,100,{doorPanels:2,omitStartPanel:true});
add('family_return_corner_base','sideboard_blind_base',212.5,1280,40,40,0,85,{usableStorage:false});
add('family_return_corner_niche','sideboard_corner_niche',212.5,1280,40,40,85,65,{usableStorage:false});
add('family_return_corner_upper','upper_blind_corner',212.5,1292,28,28,150,100,{usableStorage:false});
Object.assign(fit,{title:'餐边 · 西墙与入户库北面L形收纳',summary:'西墙4210mm连续餐柜转向储物库北面，新增1500×400mm返柜朝向餐桌；车辆仍从东面取放，杯盘分腔。转角封闭盲区不计容量。',furnitureIds:['family_sideboard','family_north_sideboard'],segments:[{id:'west-continuous',title:'西墙4210mm长柜',face:'east'},{id:'north-return',title:'储物库北面 · 朝餐桌返柜',face:'north'},{id:'corner',title:'L角围合 · 不重复计容量',face:'north'}],dimensions:['西墙下柜4210×400mm；北返柜外包1500×400mm','北面可用下柜1095mm、上柜1215mm，西端盲角封闭','台面850mm＋中空650mm＋1000mm高顶柜，上柜深280mm','餐桌四椅北移600mm；南椅拉出后至返柜725mm'],conditions:conditions.slice(3)});
for(const f of d.furniture){
 if(/餐桌|餐椅/.test(f.name))f.y-=60;
 if(f.id==='family_sideboard')Object.assign(f,{name:'4210西墙餐边柜',d:421,notes:fit.summary});
 if(f.name==='三人沙发')Object.assign(f,{x:f.x+dx,w:sofaWidth,rugCm:{x:f.x+dx-12,y:638,w:sofaWidth+24,d:178}});
 if(f.name==='茶几')f.x+=dx;
 if(f.garageFitoutId)f.notes=summary;
}
d.furniture.push({id:'family_north_sideboard',name:'储物库北面餐边柜',x:212.5,y:1280,w:149.5,d:40,heightCm:250,face:'north',tone:'cabinet',a:0,storageFitoutId:fit.id,notes:fit.summary});
d.modelAddons.livingFloorLampCm={x:248,y:825};d.modelAddons.livingRugCm=d.furniture.find(f=>f.name==='三人沙发').rugCm;
Object.assign(d.storageDesign,{title:'双折分层库＋L形餐边柜',assumptions:conditions});
d.laundry.metrics.sofaBookcaseGapCm=60;d.laundry.metrics.sofaDiningChairGapCm=95.5;
d.laundry.conditions=d.laundry.conditions.filter(t=>!(/客厅家具几何|1555|沙发|亲子/.test(t))).concat(`本轮保留全部家政实体，客厅家具组东移${dx*10}mm；沙发与书架间600mm，灯移低飘窗角落，电线不跨走道。`);
d.laundry.dimensions=d.laundry.dimensions.map(t=>t.includes('书架前')?'阳台操作690mm；书架前600mm，沙发后至北餐椅955mm（未拉出）。':t);
d.geometryNotes=[summary,...conditions,...d.geometryNotes.filter(t=>!(/单扇门|720mm|4610|南移950|北餐椅约1555|主路900/.test(t)))];
for(const n of d.renovationNotes)if(n.roomId==='living')n.text=summary;else if(n.roomId==='balcony')n.text='生活阳台并排洗烘、浅盆、外移三轨门及整墙书架实体保留；书架前暂600mm取物带，阳台690mm操作带与机器型号/散热检修仍待深化。';
await writeFile(new URL('models/schemes/family/design-data.json',root),JSON.stringify(d,null,2)+'\n');
const c=original('models/design-schemes.json');c.version='3.5.2';c.updatedAt='2026-09-30';
const s=c.schemes.find(s=>s.id==='family');s.assetRevision='3.5.2';s.summary=summary;s.tagline='折门让路，餐柜转角';
s.differences=['东面双折库门向北完全外翻叠停，不压缩车出口。','西墙4210mm餐柜＋入户库北面1500mm返柜，盲角不计容量。','餐桌四椅北移600mm，南椅拉出后至返柜725mm。',`沙发/茶几东移${dx*10}mm，灯退到低飘窗角落，书架前保留600mm。`,'双车分层1230mm平台与全部家政/卧卫实体保留。'];
s.tradeoffs=[...conditions,...d.laundry.conditions];
for(const id of ['overall','living','dining'])s.roomOverrides[id]={title:id==='dining'?'餐柜转角，折门让路':id==='living'?'把走廊还给行走':'双折入户库 × 顺畅客厅',description:summary,features:['北面餐边返柜','双折门外叠停','走廊撤灯']};
s.roomOverrides.balcony.description=d.renovationNotes.find(n=>n.roomId==='balcony').text;
await writeFile(new URL('models/design-schemes.json',root),JSON.stringify(c,null,2)+'\n');
console.log('3.5.2 source: '+d.familyFlowRevision.sofaChoice+'; folding entry/L-sideboard preserved architecture.');
