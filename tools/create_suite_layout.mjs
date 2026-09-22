// Deterministic second layout; never overwrites the approved wood source.
// All new dimensions below are concept assumptions, not surveyed dimensions.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {applyR4B} from './suite_r4b.mjs';
import {applyFittedSuite,updateFittedCatalog} from './suite_fitted.mjs';
import {applyStudyBookwall,updateBookwallCatalog} from './suite_bookwall.mjs';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8');
const raw=await read('models/design-data.json'),base=JSON.parse(raw),d=structuredClone(base);
const room=id=>d.rooms.find(r=>r.id===id),fixture=id=>d.furniture.find(f=>(f.id||f.name)===id);
const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1]},0))/20000;
d.name='荟雅苑 · 主卧入口套间方案';d.version='3.2.0 · suite';d.geometryRevision='suite-2026-09-22';
d.layout={id:'suite',baseSource:'models/design-data.json',baseSourceSha256:createHash('sha256').update(raw.replace(/\r\n/g,'\n')).digest('hex'),measured:false,
  intent:'主卧—次卧B分隔墙原位不动；主卧入户先到私密小玄关，再分流到床区或主卫。',
  entryZone:{x:366,y:334,w:79,d:153,roomId:'room_a',name:'主卧入口（套内）'},
  mainSleepingAreaM2:area(base.rooms.find(r=>r.id==='room_a').points),
  circulationNote:'北端保留书房原凹口作为公共转身位，次卧原东南门厅转为公共区，次卧改为南门；不是将红线无条件画直。'};
// Keep the first eight exterior segments and their cutaway indices intact.
const changes={
  8:[319,6,319,328],9:[6,328,319,328],10:[319,328,360,328],
  11:[360,328,360,626],12:[360,493,681,493],13:[360,626,681,626],
  19:[217,428,270,428],20:[206,626,270,626],
  21:[451,328,451,493],22:[451,328,681,328],
};
for(const [i,coords]of Object.entries(changes)){d.walls[i]=coords;d.wallSpecs[i]={id:'suite_wall_'+i,coords,thicknessCm:12,heightCm:270,grade:'C',source:'2026-09-22红线意图的条件细化；未测量、未鉴定可拆性。'};}
d.walls.push([270,428,270,626]);d.wallSpecs.push({id:'suite_study_east',coords:d.walls.at(-1),thicknessCm:12,heightCm:270,grade:'C'});
room('room_a').points=[[325,12],[675,12],[675,322],[445,322],[445,487],[366,487],[366,322],[325,322]];
room('room_a').planLabel=[520,180];room('room_a').notes='睡眠区10.85㎡原边界不动，面积另计套内入口与连接段；无入口柜。';
room('room_b').points=[[12,12],[313,12],[313,322],[12,322]];
room('room_b').notes='两卧之间墙及床柜不动；原东南门厅转公共转身位，次卧南门进入，床区不缩窄。';
room('room_c').points=[[12,334],[211,334],[211,434],[264,434],[264,620],[12,620]];
room('room_c').notes='保留东北凹口，东墙下段西移490mm；日床与1100书桌保留，配椅改小并微调。';
room('bath_1').points=[[457,334],[675,334],[675,487],[457,487]];
room('bath_1').planLabel=[558,420];room('bath_1').notes='主卫西门通套内入口；盆柜移北墙620×360mm。共墙在本方案拉直，马桶和淋浴坐标保留。';
room('bath_2').points=[[366,499],[675,499],[675,620],[366,620]];
room('bath_2').planLabel=[500,580];room('bath_2').notes='西扩后为矩形，北墙700×380mm盆柜；西门仍通公共走廊。';
room('living').points=[[223,334],[354,334],[354,632],[675,632],[675,1115],[530,1115],[530,1389],[212,1389],[212,632],[276,632],[276,422],[223,422]];
room('living').notes='包含客餐厅、西移走廊和次卧南门外的公共转身位，不包含主卧入口。';
for(const r of d.rooms)r.modelAreaM2=Number(area(r.points).toFixed(4));
const doorChanges={
 door_a:{x1:360,y1:342,x2:360,y2:422,widthMm:800,name:'主卧入户门800 · 先入套内小玄关',connects:['living','room_a'],swing:'北端铰链，向套内东侧开启；五金与碰撞为条件校核'},
 door_b:{x1:229,y1:328,x2:309,y2:328,widthMm:800,name:'次卧B南门800 · 公共转身位进入',connects:['living','room_b'],swing:'东端铰链，向北进入次卧；不穿主卧'},
 door_c:{x1:270,y1:452,x2:270,y2:537,widthMm:850,name:'书房东门850 · 随东墙西移',connects:['living','room_c'],swing:'北端铰链，向书房西侧开启'},
 door_bath_1:{x1:451,y1:390,x2:451,y2:465,widthMm:750,name:'主卫西门750 · 只通套内小玄关',connects:['room_a','bath_1'],swing:'南端铰链，向主卫东侧开启'},
 door_bath_2:{x1:360,y1:542,x2:360,y2:617,widthMm:750,name:'客卫西门750 · 公共走廊进入',connects:['living','bath_2'],swing:'南端铰链，向客卫东侧开启'},
};
for(const door of d.doors)if(doorChanges[door.id])Object.assign(door,doorChanges[door.id],{grade:'C',notes:'本轮条件门位；图中关闭，漫游简化敞开。门套、铰链、实际门扇与开启冲突须现场深化。'});
Object.assign(fixture('vanity_main'),{name:'主卫620浴室柜',x:459,y:337,w:62,d:36,face:'south',notes:'腾出西侧门位后盆柜移北墙；620×360为条件选型，需复核排水、镜柜与盆体。'});
Object.assign(fixture('vanity_guest'),{name:'客卫700浴室柜',x:378,y:501,w:70,d:38,face:'south',notes:'客卫扩展后沿北墙布置；700×380为条件选型，重做防水及排水深化。'});
Object.assign(fixture('书房办公椅'),{x:155,y:510,w:48,d:50,notes:'东墙西移后的紧凑配椅；保留书桌，避免椅背占据门口。'});
// Latest owner choice: remove the master bay desktop, supports, accessories
// and its chair; keep the original stone/window assembly, not an empty desk.
const masterBay=d.bayFitouts.find(f=>f.roomId==='room_a');
Object.assign(masterBay,{type:'bare_ledge',title:'主卧 · 保留飘窗，不设桌椅',summary:'按业主最新要求取消飘窗桌台、支撑、桌面物件与配椅；保留原飘窗石台和窗体。主卧衣柜保留床尾西墙，次卧衣柜经确认仍保留南墙。',dimensions:['飘窗窗体与外凸包络沿用基准，未重新量房','不设桌台、独立书桌、梳妆桌或配椅','主卧西墙衣柜1600×600mm原位保留'],conditions:['原窗台高900mm仍是未实测建模值，不承诺可坐或可拆。','窗边仍须专业防坠、开窗限位和外立面改造核验。'],references:[],parts:[]});
// The west-shifted corridor meets the existing study desk at a diagonal.
// Keep the fixed desktop; move just its movable adult chair 150mm south.
const family=d.bayFitouts.find(f=>f.roomId==='living');
family.parts.find(p=>p.id==='l_adult_chair').y=692;
family.summary+=' 新走廊方案仅将成人活动椅向南150mm，固定桌面和儿童椅不动，给走廊入口转角让位。';
d.clearances=d.clearances.filter(c=>!['bed_b_entry','bed_c_entry','hall_north'].includes(c.id));
d.clearances.push({id:'suite_hall',name:'西移走廊780净宽（概念值）',x:276,y:434,w:78,d:186,grade:'C'},
 {id:'suite_entry',name:'套内入口790×1530（不加柜）',x:366,y:334,w:79,d:153,grade:'C'},
 {id:'suite_turn',name:'次卧南门公共转身位',x:223,y:334,w:131,d:88,grade:'C'});
d.renovationNotes=[
 {roomId:'room_a',text:'新增方案：主卧与次卧之间墙原位保留，床区10.85㎡不变。公共走廊先经主卧入户门进入790×1530mm套内小玄关，再向北到床区、向东到主卫；入口无新增柜体。主卧飘窗桌台及配椅取消，衣柜保留床尾西墙。'},
 {roomId:'room_b',text:'为保留两卧分隔墙并保证入口独立，原东南门厅改作公共转身位，门移南侧。模型次卧净面积由10.23减至9.33㎡，减少的是原门厅，不是床区。'},
 {roomId:'room_c',text:'东墙下段向西490mm，模型净面积由7.59减至6.68㎡；保留原北侧凹口和日床书桌，椅子改为480×500mm。'},
 {roomId:'bath_1',text:'主卫西门通私密入口；主盆柜移北墙620×360mm。主卫、客卫共墙本方案拉直，马桶和淋浴位置保持；排水、防水、通风及墙体可改性未核实。'},
 {roomId:'bath_2',text:'西侧扩展，模型净面积约3.74㎡。仅公共走廊可进入，北墙盆柜700×380mm；不借主卧玄关通行。'}
];
d.renovationNotes.push({roomId:'living',text:'走廊西移后，客厅学习桌成人活动椅向南150mm；桌面、儿童椅和全部玄关餐边柜不动。转角须实地试走，拉椅状态另行复核。'});
d.geometryNotes=[
 'V3.2.0新增套内入口布局，保留原木风格和两卧之间直墙；本文件仅属suite，不改写wood基准。',
 '红线仅表达墙体意图，不能量出准确定位。本轮墙中线x270/360/451与统一120mm厚、门宽、盆柜均为条件设计值，不能当施工定位。',
 '图示入口790×1530、走廊局部780为净墙面间概念值，门框会进一步扣减；不是舒适度、无障碍或消防合规认证。',
 '书房与客厅之间仍为连续实墙；门仍从公共走廊进入。旧方案的北主卫门封闭，改从套内玄关东侧进入。',
 '扩大湿区、改墙及移盆位须先核查结构、管井、排水坡度、防水与通风。马桶/淋浴未移不等于排水一定无需施工。',
 ...base.geometryNotes.filter(n=>!(/B\/C拓扑|东北凹口|净走廊|两卫阶梯|客卫西北盆位|主卫入口改|主卫西墙|主卫套内门|V3.0.4|V3.0.5|主卧以|高椅|一体连续高台/.test(n)))
];
applyR4B(d,base);
applyFittedSuite(d);
applyStudyBookwall(d);
const dir=new URL('models/schemes/suite/',root);await mkdir(dir,{recursive:true});
await writeFile(new URL('design-data.json',dir),JSON.stringify(d,null,2)+'\n');
const catalog=JSON.parse(await read('models/design-schemes.json'));
updateFittedCatalog(catalog,d);
updateBookwallCatalog(catalog,d);
await writeFile(new URL('models/design-schemes.json',root),JSON.stringify(catalog,null,2)+'\n');
console.log(JSON.stringify({layout:d.layout,areas:d.rooms.map(r=>({id:r.id,m2:r.modelAreaM2})),unchangedBase:true},null,2));
