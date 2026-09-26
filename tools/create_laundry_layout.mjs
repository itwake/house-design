// Fourth layout, derived from suite, plus an isolated kitchen refresh for wood.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8');
const hash=s=>createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
const baseRaw=await read('models/design-data.json'),suiteRaw=await read('models/schemes/suite/design-data.json');
const base=JSON.parse(baseRaw),suite=JSON.parse(suiteRaw),family=JSON.parse(await read('models/schemes/family/design-data.json'));
const kitchenIds=new Set(['厨房北侧地柜','厨房南侧地柜','冰箱高柜','蒸烤高柜']);
const kitchenWindow=family.windows.find(w=>w.id==='window_kitchen_balcony');
const kitchenSource={source:'models/schemes/family/design-data.json',sourceSha256:hash(await read('models/schemes/family/design-data.json')),scope:'只同步厨房开窗、地柜和高柜布局，不继承方案3的餐桌和大件库。'};
const synchronize=d=>{
  d.windows=d.windows.filter(w=>w.id!==kitchenWindow.id).concat(structuredClone(kitchenWindow));
  d.furniture=d.furniture.map(f=>kitchenIds.has(f.name)?structuredClone(family.furniture.find(v=>v.name===f.name)):f);
  d.kitchenReference=kitchenSource;
};
const wood=structuredClone(base);synchronize(wood);
wood.version='3.4.0 · wood kitchen refresh';wood.geometryRevision='wood-kitchen-2026-09-26';
wood.layout={id:'wood-kitchen',baseSource:'models/design-data.json',baseSourceSha256:hash(baseRaw),measured:false,intent:'保留原木方案，只将厨房大窗、摆设同步方案3。原始资产留档。'};
wood.geometryNotes=['V3.4.0厨房按方案3同步，其他家具、墙线与门位不变。',...wood.geometryNotes];

const d=structuredClone(suite);synchronize(d);
d.version='3.4.0 · laundry wall';d.name='荟雅苑 · 家政整墙方案';d.geometryRevision='laundry-wall-2026-09-26';
d.layout={...d.layout,variant:'laundry-wall',parentSource:'models/schemes/suite/design-data.json',parentSourceSha256:hash(suiteRaw),intent:'以方案2为基础；A洗烘落地并排靠厨房共墙，上方浅盆；B客厅书架与C外移阳台门框拉齐。不继承大件库。'};
// All exterior boundaries stay put. Only the internal balcony partition moves.
d.walls[8]=[652.25,960,652.25,1121];
d.walls.push([652.25,960,681,960]);
d.wallSpecs[8]={...d.wallSpecs[8],coords:d.walls[8],grade:'C',source:'阳台内侧隔断西移287.5mm；非外扩外墙。原门垛与外墙结构待鉴定。'};
d.wallSpecs.push({id:'laundry_north_return',coords:d.walls.at(-1),thicknessCm:12,heightCm:270,grade:'C'});
const room=id=>d.rooms.find(r=>r.id===id);
room('balcony').points=[[658.25,966],[829,966],[829,1115],[658.25,1115]];
room('balcony').planLabel=[745,998];room('balcony').notes='向客厅借用约0.43㎡，不增加产权面积；两机器落地并排，南墙厨房窗保留。';
room('living').points=room('living').points.flatMap(p=>p[0]===675&&p[1]===1115?[[675,954],[646.25,954],[646.25,1115]]:[p]);
const area=pts=>Math.abs(pts.reduce((s,p,i)=>{const q=pts[(i+1)%pts.length];return s+p[0]*q[1]-q[0]*p[1]},0))/20000;
for(const r of d.rooms)r.modelAreaM2=Number(area(r.points).toFixed(4));
const door=d.doors.find(v=>v.id==='balcony_door');
Object.assign(door,{name:'C · 外移阳台三轨推拉门',roomId:'balcony',x1:652.25,x2:652.25,heightCm:240,
  sliding:{...structuredClone(d.doors.find(v=>v.id==='door_kitchen').sliding),stackTo:'south',frameFinish:'warm-white',condition:'1500mm洞口，三扇向南叠停。门框西侧外沿x=645cm与B书架正面齐平；名义净开约900mm，台面前可用入口仅约690mm。'},
  notes:'门框外沿齐书架；玻璃门扇因三轨内退，不声称门扇与柜门完全共面。非既有结构事实，拆改、防水高差和通风须复核。'});
d.furniture=d.furniture.filter(f=>!['洗烘塔','阳台家政柜'].includes(f.name));
for(const f of d.furniture){if(f.name==='三人沙发'||f.name==='茶几')f.x-=80;if(f.name==='电视薄柜')f.x-=40;}
d.modelAddons={livingFloorLampCm:{x:335,y:875}};
const l=d.laundry={id:'laundry_wall',title:'家政阳台 · 洗烘并排与客厅整墙',
  alignment:{bookcaseFrontX:645,doorFrameFrontX:645,oldDoorCenterX:681,newDoorCenterX:652.25,outsetCm:28.75},
  counter:{id:'laundry_counter',x:661,y:1035,w:168,d:80,zCm:95,hCm:3,topCm:98},
  basin:{id:'laundry_basin',x:673,y:1038,w:52,d:74,bottomCm:88,rimCm:98,drain:{x:717,y:1110},tap:{x:681,y:1104},concept:true},
  machines:[{id:'laundry_washer',name:'A · 洗衣机',x:668,y:1040,w:60,d:65,heightCm:85,face:'north'},
    {id:'laundry_dryer',name:'A · 烘干机',x:735,y:1040,w:60,d:65,heightCm:85,face:'north'}],
  bookcase:{id:'living_east_bookcase',name:'B · 客厅整墙书架',x:645,y:636,w:30,d:318,heightCm:240,face:'west'},
  parts:[],metrics:{operationAisleCm:69,sofaBookcaseGapCm:70,rearServiceCm:10,basinMachineVerticalGapCm:3},
  dimensions:['两机各按600×650×850mm外包占位，含前门；型号及安装间隙待选型。','A台面1680×800mm，完成面980mm；专用浅盆外深100mm，盆底880mm。','B书架3180mm长、300mm深、2400mm高；C门框外沿向客厅移287.5mm，与书架正面齐平。','阳台操作过道约690mm；沙发西移800mm，书架前约700mm。','C洞口1500mm、向南三轨叠停，名义净开约900mm；台面限制使实际北侧入内段约690mm。'],
  conditions:['所有尺寸为现有模型中的条件推演，不是量房成果或施工图。','上方是真台盆，但必须是专用浅盆/后置排水定制，不能直接用普通深台下盆；980mm盆沿偏高，不是儿童独立洗手位。','机器顶面与盆底仅30mm，需厂家确认震动、检修和散热；台盆与台面由独立支架承重，不能压在机器上。','厨房内窗保持1200×1300mm、台高1000mm；980mm台面仅低20mm，收口、窗框和龙头必须复尺。龙头偏左布置，避开窗洞。','阳台前后仅1490mm，两机开门时过道紧张，一次操作一台，从侧面取衣；未选定机门铰链和实际开门包络。','外移的是室内隔断，不是外立面扩建；原窗下墙、梁柱、门垛可拆性和湿区防水须专业核查。','原有主卧套内玄关、书房书架、7字餐边柜及四人餐桌保留；不加入方案3大件库。'],
  references:[
    {title:'PAA · Claro Grande 洗衣机上方专用台盆',url:'https://paabaths.com/catalog/washbasins/claro-grande/',borrow:'借鉴浅盆与后置排水；官网600×750×100mm、机深上限600mm仅对应该产品。本案800mm深定制台面不是照搬其适配认证。'},
    {title:'Bosch · WGB24600HK 官方规格',url:'https://www.bosch-home.com.hk/zh/product/washers-and-dryers/washing-machines/front-loader/WGB24600HK',borrow:'官方标注845×598×590mm，用于认识设备量级；本案以更大的含门650mm占位，不作为已选机型。'},
    {title:'100室内设计 · 阳台洗衣间改造',url:'https://www.100.com.tw/article/2536',borrow:'参考集中洗烘、台面和家政收纳的组织方式，不照搬案例尺度。'}]};
const part=(id,role,x,y,z,w,dep,h,mat='Cream',roomId='balcony')=>l.parts.push({id,role,x,y,zCm:z,w,d:dep,hCm:h,material:mat,roomId});
// Independently supported top. The basin cut-out never occupies machine volume.
part('laundry_left_gable','support',661,1035,0,2,80,95);
part('laundry_middle_gable','support',731,1035,0,2,80,95);
part('laundry_right_gable','support',827,1035,0,2,80,95);
part('laundry_rear_rail','support',663,1113,85,164,2,10);
part('counter_left','counter',661,1035,95,12,80,3,'Stone');
part('counter_right','counter',725,1035,95,104,80,3,'Stone');
part('counter_front','counter',673,1035,95,52,3,3,'Stone');
part('counter_back','counter',673,1112,95,52,3,3,'Stone');
// Separate service compartment to the right of the two machines.
part('service_side','service',800,1035,0,2,80,95);
part('service_door','service',802,1035,8,25,2,86);
// B: six shallow modules, lower closed storage and upper books, all in-source.
part('bookwall_back','book-panel',673,636,0,2,318,240,'Cream','living');
for(let i=0;i<=6;i++)part('bookwall_side_'+i,'book-panel',645,636+i*53-(i===6?2:0),0,28,2,240,'Cream','living');
for(let i=0;i<6;i++){
 const y=638+i*53;
 for(const z of [7,72,112,152,192,238])part(`bookwall_shelf_${i}_${z}`,'book-shelf',645,y,z,28,49,2,'OakLight','living');
 part('bookwall_door_'+i,'book-panel',645,y,9,2,49,61,'Cream','living');
 for(let row=0;row<4;row++)for(let j=0;j<5;j++)part(`living_book_${i}_${row}_${j}`,'book',648,y+3+j*4.8,74+40*row,20,3.6,22+(j%3)*2.5,['Linen','Sage','Cream'][j%3],'living');
}
for(const f of [...l.machines,{...l.counter,name:'A · 洗烘上方浅盆台面',heightCm:98,face:'north'},l.bookcase])d.furniture.push({...f,tone:f.id.includes('washer')||f.id.includes('dryer')?'metal':'cabinet',a:0,laundryFitoutId:l.id});
const summary='A洗衣机与烘干机在靠厨房共墙落地并排，980mm浅盆台面；B东侧300mm浅书架，C阳台推拉门外移约288mm拉齐门框与柜面。沙发和茶几西移800mm、电视柜西移400mm，餐桌及7字柜保留。';
d.renovationNotes=d.renovationNotes.map(n=>n.roomId==='balcony'?{...n,text:summary+' 厨房大窗不变，前方690mm操作带仍紧凑。'}:n.roomId==='living'?{...n,text:summary}:n);
d.geometryNotes=['V3.4.0方案4基于方案2；外墙、卧卫与餐区保留，只重排阳台和客厅东侧。',...l.conditions,...suite.geometryNotes];
for(const [id,source]of [['wood',wood],['laundry',d]]){await mkdir(new URL(`models/schemes/${id}/`,root),{recursive:true});await writeFile(new URL(`models/schemes/${id}/design-data.json`,root),JSON.stringify(source,null,2)+'\n');}
const catalog=JSON.parse(await read('models/design-schemes.json'));
const original=catalog.schemes.find(s=>s.id==='wood');
Object.assign(original,{assetRevision:'3.4.0',geometrySource:'models/schemes/wood/design-data.json',model:'models/schemes/wood/huiyayuan-wood.glb',blend:'models/schemes/wood/huiyayuan-wood.blend',manifest:'models/schemes/wood/scene-manifest.json',hero:'assets/schemes/wood/overall.jpg',renderDirectory:'assets/schemes/wood'});
original.roomOverrides={...original.roomOverrides,kitchen:structuredClone(catalog.schemes.find(s=>s.id==='family').roomOverrides.kitchen),balcony:structuredClone(catalog.schemes.find(s=>s.id==='family').roomOverrides.balcony)};
original.summary='保留浅橡木、奶白与柔和织物、原三房两卫与飘窗功能，以及右手鞋柜和左手7字餐柜。V3.4.0仅将厨房大窗及柜体摆设同步方案3，原版资产留档。';
original.differences[2]='原版模型与15张效果图留档；厨房同步更新另存独立模型与新效果图。';
const s=structuredClone(catalog.schemes.find(s=>s.id==='suite'));
Object.assign(s,{id:'laundry',name:'木光 · 家政整墙',en:'WOOD / LAUNDRY WALL',tagline:'把家务藏在一面整墙之后',style:'暖白浅木 · 洗烘并排',assetRevision:'3.4.0',summary,renderDirectory:'assets/schemes/laundry',differences:l.dimensions,tradeoffs:l.conditions});
for(const key of ['geometrySource','hero','model','blend','manifest'])s[key]=s[key].replace('/suite/','/laundry/');
s.renderViews=[...s.renderViews,'laundry-detail','living-wall'];
s.renderSpec.samples=12;
for(const id of ['overall','living','balcony'])s.roomOverrides[id]={title:id==='balcony'?'洗烘落地，台盆在上':id==='living'?'书架与门面，连成一面墙':'A洗烘 · B书架 · C推拉门',description:summary,features:['独立第4布局','专用浅盆条件方案','厨房参照方案3']};
catalog.schemes=catalog.schemes.filter(s=>s.id!=='laundry');catalog.schemes.push(s);catalog.version='3.4.0';catalog.updatedAt='2026-09-26';catalog.scope='四套实质布局；方案4基于方案2，方案1/2/4厨房对齐方案3。';
await writeFile(new URL('models/design-schemes.json',root),JSON.stringify(catalog,null,2)+'\n');
console.log('Created laundry layout and isolated wood kitchen refresh; suite/family assets untouched.');
