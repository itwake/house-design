// Scheme 1 only. Dimensions are cm; this is a conditional design, not a survey.
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base='a2b4adfd4c92c9424b28df55c61609cb1049deec';
const old=p=>JSON.parse(execFileSync('git',['show',base+':'+p],{cwd:root,encoding:'utf8'}));
const out=(p,v)=>writeFile(path.join(root,p),JSON.stringify(v,null,2)+'\n');
const d=old('models/schemes/wood/design-data.json');
const ref=old('models/schemes/laundry/design-data.json');
const approved=process.argv.includes('--secondary-shallow-approved');
const rev={id:'wood-20261005',version:'3.9.0',baseCommit:base,scope:'scheme-1-only',secondaryWardrobeChoice:approved?'300mm-shallow-approved':'300mm-shallow-design-assumption',decisionBasis:'业主要求继续；在保证过道的约束下采用300mm浅柜，阳台参考方案三外移内隔断。均为可调整设计，不声称业主已逐项确认厂家安装方案。',
  floorFinish:{type:'matte-ceramic-tile',tileSizeCm:60,wetTileSizeCm:30,groutMm:2,color:'#E5E0D5',note:'全屋瓷砖；干区600×600、湿区300×300仅作设计排版。实际砖型、防滑、坡度及铺贴方案待选样。'},
  materialColors:{Wall:'#F1EEE6',Cream:'#ECE7DC',Oak:'#C5AF8B',OakLight:'#D2BE9F',Tile:'#E5E0D5',Grout:'#D1CBC0'},
  conditions:[
    '本轮只调整方案一；方案二、三源数据、原生模型和图片保持原样。墙线、门窗位置与复尺证据不因家具重排而变成完整实测。',
    '次卧东西向局部复尺链约3000mm，旧模型3010mm；2100mm床架加300mm浅柜，保守床尾约600mm（模型610mm）。浅柜以叠衣为主，不等同600mm深挂衣柜。',
    '两卧小桌椅为紧凑短时工作/梳妆位；使用时桌前空间被占用，不保证有人坐时椅后仍可通行。通行从床尾和另一侧组织。',
    '两卧衣柜止于入口保护区，沿现墙延至北墙；门套、踢脚线、实际柜门厚度、开门方向与安装收口需现场核验。',
    '洗衣机600×530×840mm、烘干机600×600×840mm按业主提供机身尺寸建模；门把、软管、开门及厂家散热净距未核定。',
    '洗烘上方浅盆由独立侧板/支架承重，后置排水，盆底880mm与840mm机顶暂留40mm；不能将普通深盆直接压在机器上。980mm台面偏高，实际人体工学与振动检修须确认。',
    '阳台复尺原净宽1240mm；内隔断暂向客厅西移287.5mm后，局部保守净宽1527.5mm，配置1420mm台面。旧模型仍多180mm，东侧空余不计可用机位。内隔断可改性、尺寸共同定位与防水须复核。',
    '只借鉴方案三阳台外移门，不增加客厅书架。两机并排仍需实际开门排演，一次操作一台；机门全开不能保证双人通行。沙发和茶几西移200mm、北移450mm，保持完整尺寸，给阳台入口让位。',
    '主卫马桶移向南墙仅为布局表达；原排污口、降板、排水坡度与检修条件须专业确认，不据模型直接移管或砸墙。盆柜与镜子同时转至南墙，面向北侧入口。淋浴区不缩小，西侧600mm固定屏移至南段，北侧留约790mm入口，避免新马桶与原屏端形成夹口。',
    '配色参考业主提供照片，采用奶白柜面与浅原木，不复制参考照片的尺寸；全屋地面改瓷砖。已购家具尺寸不变，沙发随阳台入口让位，餐桌椅保持原位置。'
  ]};
d.version='3.9.0';d.woodRevision=rev;
d.palette=[{name:'奶白柜面',value:'#ECE7DC'},{name:'浅原木',value:'#C5AF8B'},{name:'暖白墙面',value:'#F1EEE6'},{name:'浅米灰瓷砖',value:'#E5E0D5'},{name:'米灰织物',value:'#C7BFB1'}];
const find=n=>d.furniture.find(f=>f.name===n);
const replace=(n,props)=>Object.assign(find(n),props);
replace('主卧1500床',{y:60,roomId:'room_a'});
replace('主卧衣柜',{id:'master_full_wardrobe',x:325,y:12,w:60,d:220,roomId:'room_a',notes:'西墙600mm深衣柜延至北墙，柜南端止于y232，入口内侧保留900mm；床尾模型800mm。奶白移门，门套和收口待核。'});
replace('次卧1350床',{x:12,y:120,roomId:'room_b'});
replace('次卧衣柜',{id:'secondary_east_wardrobe',x:283,y:12,w:30,d:310,face:'west',roomId:'room_b',notes:'东墙300mm浅柜沿墙到北端，以叠衣为主；旧模型床尾610mm、按3000mm局部净宽保守600mm。不是常规600mm挂衣柜。'});
const added=(id,name,roomId,role,x,y,w,depth,face,height)=>({id,name,roomId,woodRole:role,x,y,w,d:depth,face,heightCm:height,a:0,tone:role==='chair'?'fabric':'wood'});
d.furniture.push(
  added('master_nightstand','主卧北侧床头柜','room_a','nightstand',625,16,45,40,'south',48),
  added('master_small_desk','主卧南侧小书桌','room_a','compact-desk',595,272,80,50,'north',74),
  added('master_small_chair','主卧小桌配椅','room_a','chair',613,229,44,43,'south',78),
  added('secondary_nightstand','次卧南侧床头柜','room_b','nightstand',12,272,40,40,'north',48),
  added('secondary_small_desk','次卧北侧小书桌','room_b','compact-desk',12,12,80,50,'south',74),
  added('secondary_small_chair','次卧小桌配椅','room_b','chair',30,67,44,45,'north',78));
const aBay=d.bayFitouts.find(f=>f.roomId==='room_a');
aBay.parts=[];aBay.title='主卧低窗台 · 留白';aBay.summary='移除原飘窗高桌、支撑及高椅，保留410mm实测低窗台；小桌改放床南侧。主卧窗宽1760mm及10mm水平闭合差沿用复尺记录。';
aBay.type='bare_ledge';aBay.dimensions=['实测低窗台410mm，保留原台，不增加桌面或高椅。','窗宽1760mm；西段860mm，水平链10mm闭合差仍待核。','西墙衣柜2200×600mm，小书桌改放床南侧800×500mm。'];
aBay.conditions=['不拆改窗台或玻璃，窗框、外凸、窗扇开启与防坠条件仍需专业复核。','低窗台也有攀爬风险，不能把纱窗或效果图玻璃当作已验证防坠。'];aBay.references=[];
const bBay=d.bayFitouts.find(f=>f.roomId==='room_b');
bBay.summary='保留400mm低窗台与茶座；床头贴西，东墙为300mm浅衣柜；北侧小桌椅与南侧床头柜作为新增家具。窗宽1760mm、东侧10mm闭合差及防坠条件不变。';
d.furniture=d.furniture.filter(f=>!['书房日床','1100书桌','书房客衣柜','洗烘塔','阳台家政柜'].includes(f.name));
replace('书房办公椅',{x:155,y:510,w:48,d:50,roomId:'room_c',woodRole:'chair'});
d.furniture.push(
 {...ref.furniture.find(f=>f.id==='study_full_desk'),x:12,y:565,w:301,d:55,roomId:'room_c',woodRole:'full-desk',notes:'参考方案三通长桌形式，按方案一南墙净宽改3010×550mm，含支架和支脚。'},
 {...ref.furniture.find(f=>f.id==='study_north_sofa'),x:16.5,y:334,w:190,d:80,roomId:'room_c',woodRole:'study-sofa',notes:'1900×800mm小沙发背北朝南，放入1990×1000mm凹位，左右各45mm；须按含扶手软包的实际外包尺寸选购，不示意沙发床展开。'});
replace('主卫750浴室柜',{x:424,y:423,w:75,d:40,face:'north',roomId:'bath_1',notes:'750×400mm盆柜靠西段南墙，盆柜与镜面均朝北门；盆柜前至北内墙890mm为旧模型参考。'});
replace('主卫壁挂马桶',{id:'main_wc_south',x:533,y:428,w:36,d:58,face:'north',roomId:'bath_1',notes:'壁挂马桶及隐藏水箱移向东段南墙、朝北；真实水箱外廓约470×585mm，排污口和支架安装未核实。'});
replace('主卫淋浴区',{screenAnchor:'south',screenLengthCm:60,notes:'淋浴区尺寸不变；西固定屏由北段移至南段y419–479，北留790mm入口，配合南墙马桶。玻璃固定、防水及挡水须深化。'});
// 301cm six-bay study shelving, preserving shelf/book thickness instead of stretching it.
const bookwall=structuredClone(ref.wallFitouts.find(f=>f.id==='study_bookwall'));
bookwall.parts=[];bookwall.title='通长桌与奶白浅书架';bookwall.face='north';
bookwall.bounds={x:12,y:592,w:301,d:28,zCm:146,hCm:104};
bookwall.description='方案一南墙3010mm通长书桌，上方280mm深浅书架，六分格、上层奶白柜门。';
bookwall.conditions=['书架总宽3010、深280、底高1460、顶高2500mm为条件家具尺寸；安装收口和墙体锚固待核。','六分格、板厚22mm；书籍荷载及层板抗挠必须由定制方核算，模型不构成承重认证。','顶部为低频收纳，不站上桌面取物；柜门开启、空调管线和照明需现场深化。'];
const bp=(id,role,x,y,zCm,w,depth,hCm,material)=>bookwall.parts.push({id,role,x,y,zCm,w,d:depth,hCm,material});
bp('back','back',12,618.8,146,301,1.2,104,'Cream');
const pitch=(301-2.2)/6,span=pitch-2.2;
for(let i=0;i<=6;i++)bp('upright_'+i,'upright',12+i*pitch,592,146,2.2,26.8,104,'Cream');
for(let i=0;i<6;i++){
 const x=14.2+i*pitch;
 for(const z of [146,180,214,247.8])bp(`shelf_${i}_${z}`,'shelf',x,594.2,z,span,24.6,2.2,'OakLight');
 bp('door_'+i,'door',x+.15,592,216.35,span-.3,1.8,31.3,'Cream');
 bp('pull_'+i,'pull',x+span/2-3,591.75,217,6,.25,.7,'WarmGrayMetal');
 for(let row=0;row<2;row++)for(let j=0;j<5;j++)bp(`book_${i}_${row}_${j}`,'book',x+3+j*3.9,595,148.2+row*34,3.1,21,21+j%3*2,['WhiteLinen','Cream','OakLight'][j%3]);
}
d.wallFitouts=[bookwall];
const l={id:'wood_parallel_laundry',title:'方案一 · 原阳台内并排洗烘',mode:'parallel-only',
 counter:{id:'laundry_counter',x:687,y:1040,w:142,d:75,zCm:95,hCm:3,topCm:98},
 basin:{id:'laundry_basin',x:695,y:1043,w:52,d:69,bottomCm:88,rimCm:98,drain:{x:739,y:1110},tap:{x:700,y:1104},concept:true},
 machines:[{id:'laundry_washer',name:'洗衣机',x:692,y:1045,w:60,d:53,heightCm:84,face:'north'},{id:'laundry_dryer',name:'烘干机',x:760,y:1045,w:60,d:60,heightCm:84,face:'north'}],
 parts:[],metrics:{operationAisleCm:74,rearServiceWasherCm:15,rearServiceDryerCm:8,basinMachineVerticalGapCm:4},
 dimensions:['两机按业主提供机身：洗衣机600×530×840mm，烘干机600×600×840mm，落地并排、正面朝北。','台面1420×750mm，完成面980mm；浅盆底880mm，机顶至盆底40mm，独立支架承重。','保留方案一阳台隔断及门位；不加入方案三客厅书架或外移门。','柜前旧模型操作带约740mm；后侧预留洗衣机150mm、烘干机80mm至支架，实际水电、门把与软管仍待核。'],
 conditions:rev.conditions.filter(t=>/洗衣机|洗烘|阳台复尺|只借鉴/.test(t)).concat(['浅盆后排水与存水弯空间须定制核验，台面下不能用立板或抽屉封死机器检修路径。','厨房内窗模型窗台1000mm、台面980mm仅差20mm；窗框、龙头及窗扇开启必须核对，龙头不能伸入玻璃面。']),
 references:structuredClone(ref.laundry.references)};
const lp=(id,role,x,y,zCm,w,depth,hCm,material='Cream')=>l.parts.push({id,role,x,y,zCm,w,d:depth,hCm,material,roomId:'balcony'});
for(const [id,x]of [['left',687],['middle',755],['right',827]])lp(`laundry_${id}_gable`,'support',x,1040,0,2,75,95);
lp('laundry_rear_rail','support',689,1113,85,138,2,10);
lp('counter_left','counter',687,1040,95,8,75,3,'Stone');lp('counter_right','counter',747,1040,95,82,75,3,'Stone');
lp('counter_front','counter',695,1040,95,52,3,3,'Stone');lp('counter_back','counter',695,1112,95,52,3,3,'Stone');
d.laundry=l;
d.furniture.push({id:'wood_laundry_footprint',name:'阳台并排洗烘浅盆台',x:687,y:1040,w:142,d:75,heightCm:98,roomId:'balcony',tone:'cabinet',a:0,laundryFitoutId:l.id});
// Apply the requested scheme-three internal partition idea, not its bookwall.
// Two appliances are packed into the conservative measured width, never into
// the old 180mm discrepancy at the east side of the global model.
const partitionCoords=[681,960,681,1121];
const partitionIndex=d.walls.findIndex(w=>JSON.stringify(w)===JSON.stringify(partitionCoords));
const partitionSpec=d.wallSpecs.find(s=>JSON.stringify(s.coords)===JSON.stringify(partitionCoords));
if(partitionIndex<0||!partitionSpec)throw new Error('Published balcony partition not found');
d.walls[partitionIndex]=[652.25,960,652.25,1121];
d.walls.push([652.25,960,681,960]);
Object.assign(partitionSpec,{coords:d.walls[partitionIndex],grade:'C',source:'方案一条件改造：阳台内隔断西移287.5mm，原净宽1240mm；非外扩外墙，结构与共同定位待复核。'});
d.wallSpecs.push({id:'wood_laundry_north_return',coords:d.walls.at(-1),thicknessCm:12,heightCm:270,grade:'C'});
const balcony=d.rooms.find(r=>r.id==='balcony'),living=d.rooms.find(r=>r.id==='living');
balcony.points=[[658.25,966],[829,966],[829,1115],[658.25,1115]];balcony.planLabel=[742,988];
balcony.notes='原复尺1240mm＋借厅287.5mm＝局部保守1527.5mm；旧全屋轮廓多180mm不可用作安装余量。借用面积不新增产权面积。';
living.points=living.points.flatMap(p=>p[0]===675&&p[1]===1115?[[675,954],[646.25,954],[646.25,1115]]:[p]);
for(const room of [living,balcony])room.modelAreaM2=Number((Math.abs(room.points.reduce((sum,p,i)=>{const q=room.points[(i+1)%room.points.length];return sum+p[0]*q[1]-q[0]*p[1]},0))/20000).toFixed(4));
Object.assign(d.doors.find(v=>v.id==='balcony_door'),structuredClone(ref.doors.find(v=>v.id==='balcony_door')));
const balconyDoor=d.doors.find(v=>v.id==='balcony_door');balconyDoor.name='方案一 · 条件外移阳台推拉门';
balconyDoor.sliding.condition='1500mm洞口，三扇向南叠停；向客厅外移287.5mm，台面前操作带约740mm；本方案不设客厅整墙书架。';
balconyDoor.notes='内隔断移位不是外墙扩建；结构、门垛、防水、窗框与现场尺寸待确认。';
for(const item of [l.counter,l.basin,...l.machines,...l.parts,d.furniture.find(f=>f.id==='wood_laundry_footprint')])item.x-=26;
l.basin.drain.x-=26;l.basin.tap.x-=26;
l.partition={oldCenterX:681,newCenterX:652.25,outsetCm:28.75,originalMeasuredWidthCm:124,conservativeWidthCm:152.75,modelWidthCm:170.75,unclosedDifferenceCm:18,adjustmentBand:{x:811,y:966,w:18,d:149}};
l.localEnvelope={x:658.25,y:966,w:152.75,d:149};
l.dimensions[2]='参照方案三内隔断向客厅外移287.5mm，复尺1240mm＋借厅287.5mm＝局部保守1527.5mm；不加客厅书架。';
l.dimensions.push('全屋旧阳台东侧180mm闭合差单独标注，不计入台面、机器或检修净空。');
for(const name of ['三人沙发','茶几']){const f=find(name);f.x-=20;f.y-=45;if(f.rugCm){f.rugCm.x-=20;f.rugCm.y-=45;}}
find('电视薄柜').x-=20;
d.modelAddons={livingFloorLampCm:{x:648,y:810}};
rev.livingShifts={sofa:{dx:-20,dy:-45},rug:{dx:-20,dy:-45},coffee:{dx:-20,dy:-45},tv:{dx:-20,dy:0},lamp:{x:648,y:810}};
rev.metrics={masterFootAisleCm:80,masterDoorBufferCm:90,secondaryFootAisleModelCm:61,secondaryFootAisleConservativeCm:60,studySofaSideGapCm:4.5,studyDeskWidthCm:301,balconyOperationAisleCm:74};
rev.roomDescriptions={
 overall:{title:'奶白与木色，让日常更轻盈',description:'方案一保留三房两卫，升级两卧收纳与小桌、书房凹位沙发及通长桌；阳台内隔断条件外移容纳并排洗烘浅盆台。奶白柜面配浅原木，全屋瓷砖。',features:['奶白＋浅原木','全屋瓷砖','并排洗烘']},
 living:{title:'沙发让位，阳台好进出',description:'保留2410×980mm已购VIMLE沙发外廓，随阳台改造西移200mm、北移450mm，茶几与地毯同步；电视柜西移200mm，落地灯避开沙发和阳台入口。餐桌椅原位不动。',features:['已购家具不缩小','阳台入口让位','奶白原木瓷砖']},
 dining:{title:'奶白餐柜，白蜡木桌边',description:'沿用已购LISABO 1400×780×740mm餐桌及四把460×510×800mm餐椅，桌椅位置不变。7字餐边柜与鞋柜改奶白柜面配浅原木；客厅沙发另行北移、西移为阳台入口让位，家具外廓不缩小。',features:['已购桌椅原尺寸','7字餐边收纳','奶白浅木']},
 room_a:{title:'窗前留白，衣柜延伸',description:'主卧飘窗高桌与高椅移除，保留410mm低窗台。西墙600mm深衣柜延至北墙，南端留900mm入口区；床头仍朝东，北侧床头柜、南侧800×500mm小桌及配椅。床尾模型800mm，桌前为紧凑使用位。',features:['北延衣柜','南侧小桌','窗台留白']},
 room_b:{title:'床头贴墙，床尾轻收纳',description:'1350mm床垫、2100mm长床架贴西墙；东墙300mm浅衣柜到北墙，以叠衣为主。床尾旧模型610mm、按局部净宽保守600mm；北侧800×500mm小桌与配椅，南侧床头柜。',features:['300mm浅柜','约600mm通道','北桌南床头柜']},
 room_c:{title:'凹位小沙发，一整面工作台',description:'1900×800mm沙发放入北侧1990mm凹位，左右各45mm，背北朝南；南墙3010×550mm通长桌与280mm深浅书架，东侧门内落脚区保持空置。',features:['1900mm小沙发','3010mm通长桌','浅书架']},
 bath_1:{title:'朝向入口的洗漱区',description:'主卫750×400mm盆柜与镜子移至南侧西段，面向北侧主卧门；马桶移到南墙、朝北。保留阶梯边界及原淋浴区，西侧固定玻璃移至南段、北留790mm入口；排污口、水箱和窗定位待核。',features:['南墙镜面','淋浴北侧进入','管线待核']},
 balcony:{title:'洗烘并排，上方洗手台',description:'洗衣机600×530×840mm和烘干机600×600×840mm靠厨房墙落地并排，上方1420×750mm独立承重浅盆台，完成面980mm。原净宽1240mm，隔断条件外移287.5mm后按1527.5mm保守宽度排布；操作带约740mm，旧图多180mm不计可用。',features:['按业主机身尺寸','独立承重浅盆','条件外移隔断']}
};
d.renovationNotes=d.renovationNotes.filter(n=>!['room_a','room_b','room_c','balcony'].includes(n.roomId));
for(const [roomId,v]of Object.entries(rev.roomDescriptions))if(roomId!=='overall')d.renovationNotes.push({roomId,status:'V3.9.0条件方案',text:v.description});
d.renovationNotes.push(...rev.conditions.map(text=>({status:'方案一深化待核',text})));
d.clearances=d.clearances.filter(c=>c.id!=='living_desk_aisle');
d.clearances.push({id:'wood_master_entry',name:'主卧柜南端900mm入口保护带',x:325,y:232,w:90,d:90,grade:'C'},{id:'wood_secondary_foot',name:'次卧床尾610mm模型净距（局部实测保守600）',x:222,y:120,w:61,d:145,grade:'C'});
await out('models/schemes/wood/design-data.json',d);
const catalog=old('models/design-schemes.json');catalog.version='3.9.0';
catalog.invariants[2]='各方案主卧床头朝东、次卧床头朝西。方案一去主卧飘窗桌，新增床侧小桌；次卧改东墙浅柜。方案二、三保留原家具布局。';
const s=catalog.schemes.find(s=>s.id==='wood');s.assetRevision='3.9.0';s.tagline='奶白原木，日常细节升级';s.summary=rev.roomDescriptions.overall.description;
s.colors=d.palette.map(c=>({name:c.name,hex:c.value}));s.style='奶白原木 · 全屋瓷砖';
s.planPalette={floor:'#E5E0D5',bedroom:'#ECE9E1',living:'#EFEBE3',wet:'#E4E8E5',kitchen:'#E7E6DF',balcony:'#E4E8E5',wood:'#C5AF8B',cabinet:'#E6E0D3',fabric:'#F1ECE4'};
s.roomOverrides={...s.roomOverrides,...rev.roomDescriptions};s.bayOverrides={};
s.differences=['仅方案一升级：两卧衣柜、小桌与床头柜；主卧飘窗留白。','次卧东墙300mm浅柜，约600mm床尾通道，非600mm标准挂衣柜。','书房北凹位1900mm小沙发、南墙3010mm通长桌及浅书架。','阳台按业主给定尺寸并排洗烘，上方独立承重浅盆；隔断参照方案三外移，不新增客厅书架。','主卫盆镜与马桶靠南朝北；柜面奶白＋浅原木，全屋瓷砖。','保留已购宜家家具尺寸，沙发适度让位；餐桌椅位置及V3.8厨房设备排布不动。'];
s.tradeoffs=['卧室小桌为紧凑短时使用位，不是椅后可通行的大书桌。','次卧浅柜储物深度有限；卫生间移位与阳台浅盆须专业深化。'];
s.renderViews=[...s.renderViews,'laundry-detail'];s.renderSpec={...s.renderSpec,notes:'方案一17张全部由V3.9.0当前模型新渲染；方案二、三保持V3.8.0资产及原始历史参考来源。'};
await out('models/design-schemes.json',catalog);
console.log(JSON.stringify({version:d.version,approvedSecondary:approved,changedScheme:'wood',furniture:d.furniture.length,bookwallParts:bookwall.parts.length,laundryParts:l.parts.length,views:s.renderViews.length}));
