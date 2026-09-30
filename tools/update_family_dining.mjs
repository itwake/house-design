// Cabinet-integrated dining and an east-shifted living zone, from published 3.5.2.
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),cwd=fileURLToPath(root),BASE='a2b623c9813c0d2a664abf31ab575fc6c0fd2b0d';
const original=p=>JSON.parse(execFileSync('git',['show',BASE+':'+p],{cwd,encoding:'utf8',maxBuffer:8e6}));
const d=original('models/schemes/family/design-data.json');
const summary='沙发暂改2000mm宽并继续东移200mm，背后新增2000×250mm低储物柜；餐桌贴西餐柜，改为1155×705mm抽拉桌，四席分布在东侧及两端。收起时四椅沿西柜单排停放，展开与收起分别核对动线。';
const conditions=[
 '本轮暂按2000mm沙发推演，较V3.5.2再东移200mm；书架前约600mm，仅紧凑单人取物，西侧主通道柜面至沙发1325mm。若保留2200mm沙发，不能直接继续东移。',
 '沙发背柜2000×250×650mm，距沙发20mm，朝餐区用移门取物；内部进深约210mm，只放小件，不代替儿童车库。防倾倒固定、通风和儿童防夹须厂家深化。',
 '参考原厂Lunch +39：柜模块1200mm，桌沿墙1155mm、向厅展开705mm，官方P至少390mm、安装高至少120mm。P并未明确净/外深；本方案局部柜外深440mm，另留约400mm净安装包络，不能当成厂家适配认证。',
 '桌面暂高750mm，与850mm餐柜台面分开；两块折板和伸缩轨只是端状态示意，开合过程、锁止、轨道、板厚及柜体锚固须按原厂图深化。模型不承诺承载能力。',
 '四席为东侧两席＋南北各一席，没有靠柜侧座位；东侧每席约578mm，属于紧凑四席，需实人试坐，不能承诺四成人宽松围坐。',
 '展开餐椅各拉出300mm后，北椅与背柜横向绕行带约712.5mm；东椅至厨房墙1155mm，南椅至返柜847.5mm。50cm虚拟行走体校核不等同无障碍或舒适度认证。',
 '收桌先移开四椅；示意收起状态将四把完整椅子沿西餐柜单排停放，仍占450mm深，不假设椅子折叠或全部藏入柜内。取用此段柜门前还需挪椅。吊灯为固定装饰，收桌后不会自动消失。',
 '入户双折门停车、两车分层、卧卫/书房/飘窗/厨房/家政阳台实体全部保留；库门完整运动、抬车、防水和设备复尺仍沿用前版待核条件。'
];
const refs=[
 {id:'salice-lunch39',title:'Lunch +39 · 小深柜抽拉桌',url:'https://www.salice.com/ww/en/products/trasformabili/living/lunch-39',platform:'Salice / Atim · 原厂产品及尺寸',author:'Salice / Atim',kind:'原厂机制参考',borrow:'1200mm柜模块、1155×705mm展开桌、P≥390mm、H≥120mm；木件另配。',avoid:'不据原厂额定承载推断本定制柜承重；安装、锚固和板件必须按厂家深化。'},
 {id:'salice-lunch39-drawing',title:'Lunch +39 · 原厂技术图',url:'https://www.salice.com/downloads/4982/7909/Salice-Lunch-39-trasformabili-technical-information-ENG.pdf',platform:'Salice · 技术PDF',author:'Salice',kind:'原厂尺寸图',borrow:'M为柜模块外宽，Z为桌宽；两段桌面折叠收起的组织。',avoid:'P标签没有明确净/外深；44cm外柜仅为本项目预留概念，不是已确认安装图。'},
 {id:'ikea-besta-shallow',title:'BESTÅ · 20cm浅储物框架',url:'https://www.ikea.cn/cn/zh/p/besta-bei-da-kuang-jia-fang-bai-se-xiang-mu-wen-00247412/',platform:'IKEA · 成品尺寸与安全说明',author:'IKEA',kind:'浅柜功能参考',borrow:'借鉴浅储物、轻体量，本案定制背柜外深250mm。',avoid:'不把成品直接当独立沙发背靠或攀爬家具；防倾倒固定须单独设计。'}
];
d.version='3.5.3 · retractable dining and sofa-back storage';d.geometryRevision='family-dining-2026-09-30';d.layout.intent=summary;
d.familyDiningRevision={version:'3.5.3',baselineCommit:BASE,measured:false,sofaAssumption:'暂采用2000mm沙发；用户可另选保留2200mm并调整书架',scope:summary};
const chairs=[
 {name:'餐椅北1',x:269.75,y:934.75,w:44,d:45,face:'south'},
 {name:'餐椅南1',x:269.75,y:1120.25,w:44,d:45,face:'north'},
 {name:'餐椅东1',x:339.5,y:1000,w:45,d:44,face:'west'},
 {name:'餐椅东2',x:339.5,y:1060,w:45,d:44,face:'west'}
].map(f=>({...f,tone:'fabric',a:0,diningFitoutId:'family_pullout_dining'}));
const table={name:'四人餐桌',x:256.5,y:992.25,w:70.5,d:115.5,heightCm:75,face:'east',tone:'wood',a:0,diningFitoutId:'family_pullout_dining'};
d.furniture=d.furniture.filter(f=>!(/餐桌|餐椅/.test(f.name))).concat(table,chairs);
const sofa=d.furniture.find(f=>f.name==='三人沙发');Object.assign(sofa,{x:385,w:200,rugCm:{x:373,y:638,w:224,d:178}});
d.furniture.find(f=>f.name==='茶几').x=435;d.modelAddons.livingRugCm=sofa.rugCm;
d.pulloutDining={id:'family_pullout_dining',version:'3.5.3',initialState:'expanded',table,tableHeightCm:75,tabletopThicknessCm:2,boardCount:2,module:{x:212.5,y:990,w:44,d:120,heightCm:85,netInstallationDepthCm:40,minimumReferenceHeightCm:12},closedFurniture:chairs.map((f,i)=>({...f,x:260.5,y:960+i*50,w:45,d:44,face:'east'})),closedTable:{x:214.5,y:992.25,w:35.25,d:115.5,zCm:72,secondBoardZCm:69,storedInsideCabinet:true},conditions,references:refs.slice(0,2)};
const fit=d.storageFitouts.find(f=>f.id==='dining_sideboard_wall');
const oldparts=fit.parts.filter(p=>/^family_sideboard_[0-3]_/.test(p.id));
const layers=['sideboard_base','sideboard_niche','upper_cabinet'];
fit.parts=fit.parts.filter(p=>!oldparts.includes(p));
const modules=[[859,131],[990,120],[1110,109],[1219,61]];
modules.forEach(([y,len],i)=>layers.forEach(role=>{
 const template=oldparts.find(p=>p.role===role&&p.id.startsWith('family_sideboard_'+i+'_'));
 if(!template)throw new Error('Missing original layer '+i+' '+role);
 const p={...template,y,d:role==='upper_cabinet'&&i===3?len+12:len,w:role==='upper_cabinet'?28:i===1?44:40};
 if(i===1&&role==='sideboard_base')Object.assign(p,{role:'pullout_table_cabinet',diningFitoutId:'family_pullout_dining',tableTopHeightCm:75,cavityHeightCm:12});
 fit.parts.push(p);
}));
Object.assign(fit,{title:'餐边 · L形长柜与抽拉四席桌',summary:'西墙4210mm餐柜中段预留1200mm抽桌模块，局部外深440mm；餐桌沿墙1155mm、向厅705mm，收起后四椅靠柜停放。北面返柜和盲角不变。',dimensions:['西墙4210mm；普通下柜400mm深，抽桌模块局部440mm深','抽桌1155×705mm，高750mm；柜台面850mm，上柜深280mm','东侧两席＋两端各一席；收起时四椅单排靠柜停放','北面返柜外包1500×400mm；下柜可用1095mm，上柜1215mm，盲角不计容量'],conditions,references:[...(fit.references||[]),...refs.slice(0,2)]});
const back={id:'sofa_back_storage',type:'sideboard',roomId:'living',title:'沙发背后 · 浅储物低柜',summary:'2000×250×650mm浅柜，朝餐厅移门，距沙发20mm；不增加外伸抽屉，留出西侧绕行带。',dimensions:['外包2000×250×650mm','内部进深约210mm；移门朝南，柜体固定待深化'],conditions:[conditions[1],conditions[5]],references:[refs[2]],parts:[{id:'family_sofa_back_base',role:'sideboard_base',x:385,y:899,w:200,d:25,zCm:0,hCm:65,face:'south',doorStyle:'sliding',doorPanels:3,drawerPanels:0}]};
d.storageFitouts.push(back);d.furniture.push({id:'family_sofa_back_storage',name:'沙发背后浅储物柜',x:385,y:899,w:200,d:25,heightCm:65,face:'south',tone:'cabinet',a:0,storageFitoutId:back.id});
Object.assign(d.storageDesign,{title:'折叠分层库 × 抽拉四席桌 × 沙发背柜',assumptions:[...conditions,...d.storageDesign.assumptions.filter(t=>!(/餐桌|餐椅|北椅|南椅|沙发/.test(t)))]});
d.garage.metrics.southChairPulledGapCm=84.75;
d.laundry.metrics.sofaBookcaseGapCm=60;delete d.laundry.metrics.sofaDiningChairGapCm;
d.laundry.conditions=d.laundry.conditions.filter(t=>!(/沙发|餐椅/.test(t))).concat(conditions[0]);
d.laundry.dimensions=d.laundry.dimensions.map(t=>t.includes('书架前')?'阳台操作690mm；书架前600mm；餐桌侧靠西柜，不以沙发后直线间距代表通行。':t);
d.geometryNotes=[summary,...conditions,...d.geometryNotes.filter(t=>!(/餐桌|餐椅|沙发|北椅|南椅|家具组/.test(t)))];
for(const n of d.renovationNotes)if(n.roomId==='living')n.text=summary;
await writeFile(new URL('models/schemes/family/design-data.json',root),JSON.stringify(d,null,2)+'\n');
const c=original('models/design-schemes.json');c.version='3.5.3';const s=c.schemes.find(s=>s.id==='family');s.assetRevision='3.5.3';s.summary=summary;s.tagline='靠墙围坐，把通道留出来';
s.differences=['2000mm沙发继续东移200mm，右书架前保留600mm。','沙发背后2000×250×650mm浅柜，朝南移门，不设外伸抽屉。','西墙餐柜内嵌1155×705mm抽桌，东侧两席、两端各一席。','可切换展开/收起状态，四椅单排停靠均可见。','库门、两车分层、家政阳台与卧卫建筑全部保留。'];
s.tradeoffs=conditions.concat(d.garage.conditions,d.laundry.conditions);
for(const id of ['overall','living','dining'])s.roomOverrides[id]={title:id==='dining'?'餐桌收回柜里':id==='living'?'沙发背后的轻收纳':'靠墙围坐，留出动线',description:summary,features:['抽桌两种状态','浅背柜','2000mm沙发暂定']};
for(const r of refs){if(!c.references.some(old=>old.id===r.id))c.references.push({...r,date:'访问核对：2026-09-30（原页未标注发布日期）'});if(!s.references.includes(r.id))s.references.push(r.id)}
if(!s.renderViews.includes('dining-closed'))s.renderViews.push('dining-closed');
await writeFile(new URL('models/design-schemes.json',root),JSON.stringify(c,null,2)+'\n');
console.log('3.5.3 source ready: expanded and parked-chair dining states, 200cm sofa, 25cm rear cabinet.');
