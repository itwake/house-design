// Independent third layout, derived from the published suite without changing it.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8');
const raw=await read('models/schemes/suite/design-data.json'),base=JSON.parse(raw),d=structuredClone(base);
const sha=s=>createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
d.version='3.3.0 · family storage';d.name='荟雅苑 · 亲子储物库';d.geometryRevision='family-storage-2026-09-25';
// Keep layout.id=suite: the private foyer/bedroom topology is inherited.
d.layout={...d.layout,variant:'family-storage',parentSource:'models/schemes/suite/design-data.json',parentSourceSha256:sha(raw),
  intent:'保留暖白套间全部墙体与门窗；入户左侧新增儿童车/折叠婴儿车储物库，餐桌向北950、西250mm，7字餐柜改为900mm短餐边柜。'};
const removed=new Set(['dining_sideboard','dining_sideboard_return','dining_sideboard_corner']);
d.furniture=d.furniture.filter(f=>!removed.has(f.id));
for(const f of d.furniture.filter(f=>/餐桌|餐椅/.test(f.name))){f.x-=25;f.y-=95;}
d.furniture.push({id:'family_sideboard',name:'900餐边柜',x:212.5,y:1149,w:40,d:90,heightCm:250,face:'east',tone:'cabinet',a:0,storageFitoutId:'dining_sideboard_wall',notes:'原7字餐柜改为900mm独立短柜；上柜280mm深，杯盘与车辆分柜腔。'},
 {id:'family_garage',name:'亲子大件储物库',x:212,y:1239,w:163,d:150,heightCm:250,face:'east',tone:'cabinet',a:0,garageFitoutId:'family_garage',notes:'整库外包1630×1500mm；东侧开口，模型展示折叠柜门内折收起。仅取物，不作为可步入通道。'});
const old=d.storageFitouts.find(f=>f.type==='sideboard');
const segment={id:'short-west',title:'独立短餐边柜 · 与车辆分腔',face:'east'};
old.segments=[segment];old.furnitureIds=['family_sideboard'];old.title='餐边 · 留下刚好的备饮台';
old.summary='原7字整墙餐柜取消，改为900×400mm短餐边柜，保留850mm高干式备饮台、650mm中空和暖白上柜；四人餐桌北移950mm、西移250mm。';
old.dimensions=['沿墙900mm，下柜深400mm、上柜深280mm','台面850mm，中空650mm，上柜至2500mm','餐桌仍1200×700mm，四椅不减；桌西侧至墙930mm、东侧至厨房墙1050mm（沿各自对应断面）','南椅后退300mm后至储物库北侧约665mm，不能同时当作舒适穿行通道'];
old.conditions=['柜门与电器尺寸、插座、吊柜固定须复尺；车辆与餐具分隔。','南椅拉出时从东侧主通路通行；不从椅背与储物库之间挤过。','北排东侧椅与沙发侧面局部仅约180mm，非通道；北行需经餐桌西侧。'];
old.references=[];
const template=base.storageFitouts.find(f=>f.type==='sideboard').parts;
old.parts=['sideboard_base','sideboard_niche','upper_cabinet','dining_accessories'].map((role,i)=>{
 const p=structuredClone(template.find(p=>p.role===role));
 Object.assign(p,{id:'family_sideboard_'+role,segmentId:'short-west',x:role==='upper_cabinet'?212.5:role==='dining_accessories'?217.5:212.5,y:role==='dining_accessories'?1164:1149,w:role==='upper_cabinet'?28:role==='dining_accessories'?28:40,d:role==='dining_accessories'?60:90,face:'east'});
 delete p.source;delete p.openEndCm;delete p.flushJoints;delete p.flushStart;delete p.flushEnd;
 if(role==='sideboard_base')Object.assign(p,{drawerPanels:0,doorPanels:2,doorStyle:'sliding'});
 if(role==='upper_cabinet')p.doorPanels=2;
 return p;
});
d.storageDesign={...d.storageDesign,title:'亲子大件库＋短餐边柜',referencesNote:'依据业主确认：儿童自行车，四人餐桌可挪位。小红书搜索遇登录门槛，未引用未读笔记；以下公开案例仅借鉴收纳方法，不套用照片尺寸。',
 assumptions:['新方案所有改动均为家具/柜体，不新增拆墙；保持套间、书房书架和厨房阳台大窗。','儿童自行车1100×500×750mm、折叠婴儿车750×550×1050mm仅为选定示意包络，必须以自家实物含把手/脚踏/车轮复核。','约2.45㎡为储物库外包占地，不是净储物容量；不宣称800mm进深一定够。','柜门按四叶内折打开状态建模，净开约1340mm；承重五金、折叠过程与防夹须专业深化。','同一时刻取一辆车；库外转向需临时占用玄关主路，取车时不可同时通行。'],useZones:[]};
const g=d.garage={id:'family_garage',title:'玄关 · 亲子大件库',x:212,y:1239,w:163,d:150,heightCm:250,face:'east',
  opening:{x:375,y1:1247,y2:1381,clearWidthCm:134,heightCm:242},
  inner:{x:214,y:1241,w:159,d:146},doorState:'folded-open',
  items:[{id:'child_bike',label:'儿童车示意',kind:'child-bike',x:221,y:1250,w:110,d:50,hCm:75},
   {id:'folded_stroller',label:'折叠婴儿车示意',kind:'folded-stroller',x:235,y:1315,w:75,d:55,hCm:105}],
  shelves:[],parts:[],
  conditions:d.storageDesign.assumptions,
  references:[{title:'宜家 · 回乡疗愈记：入户800库',url:'https://www.ikea.cn/cn/zh/ideas/ikea-plus-you/hui-xiang-liao-yu-ji-fan-xiang-qing-nian-zhe-ci-hui-jia-jue-ding-bu-zou-le-pub24117e59',borrow:'独立围合、柜门遮蔽与灵活杂物收纳，不照搬尺寸。'},
   {title:'整好空间 · 婴儿车也能收纳的玄关',url:'https://www.homeorganizer.com.tw/the-gateway-to-parenting-families',borrow:'按具体推车尺寸与取放动作规划，不把示例尺寸当通用保证。'}]};
const part=(id,role,x,y,zCm,w,dep,hCm,material='Cream')=>g.parts.push({id,role,x,y,zCm,w,d:dep,hCm,material});
part('back','panel',212,1241,0,2,146,248);
part('north','panel',212,1239,0,163,2,248);
part('south','panel',212,1387,0,163,2,248);
part('roof','roof',212,1239,248,163,150,2);
part('header','header',373,1241,242,2,146,6);
for(const [i,y] of [1241,1244,1381,1384].entries())part('folded-leaf-'+i,'folded-door',337,y,0.8,36,2.5,241.2);
// A west-side shallow rack: shelves are above vehicle height; no bottom plinth.
for(const x of [216,260])for(const y of [1244,1382])part('post-'+x+'-'+y,'rack-post',x,y,125,2,2,119,'WarmGrayMetal');
for(const [i,z]of [130,171,212].entries()){
 const shelf={x:215,y:1243,w:49,d:142,zCm:z,hCm:2};g.shelves.push(shelf);part('shelf-'+i,'shelf',shelf.x,shelf.y,z,shelf.w,shelf.d,2,'OakLight');
 for(let j=0;j<3;j++)part('toy-bin-'+i+'-'+j,'toy-bin',218,1248+j*44,z+2,41,36,27,j%2?'Linen':'Sage');
}
g.metrics={footprintM2:2.445,tableShiftCm:{x:-25,y:-95},entryAisleCm:120,southChairPulledGapCm:66.5,doorClearCm:134,vehicleTakeout:'沿东侧开口单车取出；库外转弯占用玄关通路。不是通行/无障碍认证。'};
d.renovationNotes=d.renovationNotes.map(n=>n.roomId==='living'?{...n,text:'入户左侧新增1630×1500mm亲子大件库；1200×700mm四人餐桌北移950、西移250mm，7字餐柜改900mm短柜。储物库朝东取车，右鞋柜、厨房推拉门、客厅沙发和书房不动。儿童车、折叠婴儿车为待核型号的示意包络；出库转向时临时占用玄关。'}:n);
d.geometryNotes=['V3.3.0第三个独立布局，直接派生V3.2.4暖白套间；原wood、suite数据和模型不改写。',...d.storageDesign.assumptions,...base.geometryNotes];
await mkdir(new URL('models/schemes/family/',root),{recursive:true});
await writeFile(new URL('models/schemes/family/design-data.json',root),JSON.stringify(d,null,2)+'\n');
const catalog=JSON.parse(await read('models/design-schemes.json')),suite=catalog.schemes.find(s=>s.id==='suite');
const s=structuredClone(suite);Object.assign(s,{id:'family',name:'木光 · 亲子储物',en:'WOOD / FAMILY STORAGE',tagline:'车有归处，餐桌仍在',style:'暖白浅木 · 亲子储物库',assetRevision:'3.3.0',
 summary:d.renovationNotes.find(n=>n.roomId==='living').text,
 differences:['保持暖白套间全部墙体、门窗、卧卫、书房及书架。','入户左侧1630×1500mm大件储物库：地面停车，上方可调层架。','四人餐桌北移950、西移250mm；整墙7字餐柜改900mm短餐边柜。'],
 tradeoffs:['牺牲原整墙餐边柜的容量与连续台面，换取完整大件收纳空间。','车按示意包络建模，必须复核实物与柜门五金；不能保证所有童车/推车适配。','取车占用玄关，南餐椅拉出后不可从椅背后同时穿行。','保留暖白套间原有卧室及卫生间净空限制。']});
for(const key of ['geometrySource','hero','model','blend','manifest'])s[key]=s[key].replace('/suite/','/family/');
s.renderViews=[...suite.renderViews,'storage-library'];
s.roomOverrides.overall={title:'给大件留一间小库',description:s.summary,features:['独立亲子储物方案','四人餐桌保留','不改现有墙体']};
s.roomOverrides.living={title:'餐桌往前，大件靠近门',description:s.summary,features:['入户大件库','900mm短餐边柜','同源尺寸核对']};
s.roomOverrides.dining={title:'进门先收车，再回到餐桌',description:s.summary,features:['约2.45㎡外包储物库','四椅完整保留','车辆尺寸待复核']};
catalog.schemes=catalog.schemes.filter(s=>s.id!=='family');catalog.schemes.push(s);catalog.version='3.3.0';catalog.updatedAt='2026-09-25';
catalog.scope='三个独立布局：原木基准、暖白套间、基于暖白套间的亲子储物库与餐区重排。';
catalog.invariants=catalog.invariants.map(t=>t.replaceAll('两套均','各方案均'));
await writeFile(new URL('models/design-schemes.json',root),JSON.stringify(catalog,null,2)+'\n');
console.log('Created independent family layout; suite source and catalog entry preserved.');
