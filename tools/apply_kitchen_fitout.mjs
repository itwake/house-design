// Kitchen fitout V3.8.0. Centimetres. No surveyed/global wall is moved.
// The conservative 242 x 261 local check is separate from the unclosed old envelope.
import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const save=(p,v)=>writeFile(new URL(p,root),JSON.stringify(v,null,2)+'\n');
const id='kitchen-20261005',version='3.8.0';
const parts=[];
const part=(id,role,x,y,zCm,w,d,hCm,material,face)=>parts.push({id,role,x,y,zCm,w,d,hCm,material,...(face?{face}:{})});
// Actual boards, not filled volumes: the dishwasher bay has no floor/backboard.
function cabinet(id,x,y,w,d,face,{upper=false,adjustable=false}={}){
  const z=upper?150:10,h=upper?85:76,t=1.8,role=upper?'upper':'base';
  const tag=adjustable?'adjustment':role;
  part(id+'_floor',tag+'-panel',x,y,z,w,d,t,'Cream',face);
  if(upper)part(id+'_top',tag+'-panel',x,y,z+h-t,w,d,t,'Cream',face);
  if(face==='west'){
    part(id+'_back',tag+'-panel',x+w-t,y,z,t,d,h,'Cream',face);
    for(const [k,py]of [['n',y],['s',y+d-t]])part(id+'_'+k,tag+'-panel',x,py,z,w,t,h,'Cream',face);
    const n=Math.max(1,Math.ceil(d/48)),span=d/n;
    for(let i=0;i<n;i++)part(id+'_door_'+i,tag+'-front',x,y+i*span+.2,z+1,t,span-.4,h-1.4,upper?'Cream':'OakLight',face);
    if(!upper)part(id+'_plinth','plinth',x+7,y,0,w-7,d,10,'Charcoal',face);
  }else{
    const front=face==='south'?y+d-t:y,back=face==='south'?y:y+d-t;
    part(id+'_back',tag+'-panel',x,back,z,w,t,h,'Cream',face);
    for(const [k,px]of [['w',x],['e',x+w-t]])part(id+'_'+k,tag+'-panel',px,y,z,t,d,h,'Cream',face);
    const n=Math.max(1,Math.ceil(w/48)),span=w/n;
    for(let i=0;i<n;i++)part(id+'_door_'+i,tag+'-front',x+i*span+.2,front,z+1,span-.4,t,h-1.4,upper?'Cream':'OakLight',face);
    if(!upper)part(id+'_plinth','plinth',x,face==='south'?y:y+7,0,w,d-7,10,'Charcoal',face);
  }
}
part('shaft','shaft',542,1329,0,60,60,270,'Wall');
// Under the north top: 62cm clear appliance niche, supported by separate gables.
part('dw_west_gable','base-panel',624.2,1127,0,1.8,65,86,'Cream','south');
part('dw_east_gable','base-panel',688,1127,0,1.8,65,86,'Cream','south');
part('north_west_filler','base-front',622,1190.2,10,2.2,1.8,76,'OakLight','south');
part('north_fixed_filler','base-front',689.8,1190.2,10,4.2,1.8,76,'OakLight','south');
cabinet('north_adjustment',694,1127,45,65,'south',{adjustable:true});
cabinet('north_prep',739,1127,25,65,'south');
cabinet('north_corner',764,1127,65,65,'south');
cabinet('east_sink',764,1192,65,132,'west');
cabinet('south_hob',602,1324,92,65,'north');
cabinet('south_adjustment',694,1324,45,65,'north',{adjustable:true});
cabinet('south_prep',739,1324,58,65,'north');
cabinet('south_corner',797,1324,32,65,'north');
// Keep the north internal window and NE heater completely free of cabinetry.
cabinet('east_upper',797,1207,32,150,'west',{upper:true});
cabinet('south_upper',739,1357,58,32,'north',{upper:true});
part('east_splash','backsplash',827.8,1174,89,1.2,183,61,'Tile');
part('south_splash','backsplash',602,1387.8,89,227,1.2,61,'Tile');
const appliance=(id,type,x,y,w,d,heightCm,zCm,face,local,extra={})=>({id,type,x,y,w,d,heightCm,zCm,face,local,...extra});
const appliances=[
  appliance('kitchen_fridge','fridge',550,1132,65,60,190,0,'south',{x:8,y:5,w:65,d:60},{dimensionStatus:'user-confirmed-body',hinge:'east-provisional'}),
  appliance('kitchen_dishwasher','dishwasher',627,1132,60,60,80.5,0,'south',{x:85,y:5,w:60,d:60},{dimensionStatus:'user-confirmed-body'}),
  appliance('kitchen_double_sink','doubleSink',774,1216,45,78,20,69,'west',{x:187,y:89,w:45,d:78},{dimensionStatus:'reference-only',referenceId:'franke-bxx220-74'}),
  appliance('kitchen_hob','gasHob',612,1335,75,45,5,89,'north',{x:70,y:207,w:75,d:45},{dimensionStatus:'provisional'}),
  appliance('kitchen_hood','hood',609.5,1349,80,40,45,155,'north',{x:67.5,y:221,w:80,d:40},{dimensionStatus:'provisional'}),
  appliance('kitchen_heater','waterHeater',808.5,1137,20.5,33,53,132,'west',{x:221.5,y:10,w:20.5,d:33},{dimensionStatus:'reference-only',referenceId:'noritz-13ex31fex'}),
  appliance('kitchen_tap','faucet',812,1252,15,6,32,89,'west',{x:225,y:125,w:15,d:6},{dimensionStatus:'provisional'})
];
const countertops=[
  {id:'north_top',x:622,y:1127,w:207,d:65,zCm:86,hCm:3,material:'Stone',cutouts:[]},
  {id:'east_top',x:764,y:1192,w:65,d:132,zCm:86,hCm:3,material:'Stone',cutouts:[{x:775,y:1217,w:43,d:76}]},
  {id:'south_top',x:602,y:1324,w:227,d:65,zCm:86,hCm:3,material:'Stone',cutouts:[{x:615,y:1338,w:69,d:39}]}
];
const summary='厨房按标注图重排：西北650×600×1900mm冰箱，北侧独立600×600×805mm洗碗机；东侧双槽，南侧燃气灶及上方油烟机，西南烟道封实不可用。东、南吊柜在窗边热水器前止步。2420×2610mm局部复尺排布与旧2870×2620mm全屋示意分开核对，450mm差额仅作待闭合调整段。';
const conditions=[
  '本轮只改厨房家具与设备；全屋墙线未闭合，旧模型厨房2870×2620mm不代表实测。局部复尺净宽2420、净深2610mm用于保守占地核对；两者不得混作一张施工图。',
  '全屋示意在中段保留450mm调整柜段；收窄至2420mm时须删减该段，不能把它算作已经确认的备餐宽度。完成墙厚、共墙、门窗基准闭合后再统一定位。',
  '西南烟道暂估600×600mm、按墙体不可占用。烟道实际外包、检修口、排烟接口与止回阀未测；若更大，炉灶及柜宽必须重排。',
  '冰箱650×600×1900mm、洗碗机600×600×805mm是用户提供的机器外廓，不是橱柜开孔尺寸。散热、管线、柜门厚度、踢脚及完整开门尺寸按最终型号说明书深化。',
  '洗碗机独立在北侧台下，模型空腔620×650mm、净高860mm，无遮挡底板或背板；台面完成面890mm。以上安装余量待厂家确认，排水和电源不设在无法检修的机器正后方。',
  '保守尺寸下南北台面间1310mm；若洗碗机门向前投影600mm，余710mm；若投影805mm，余505mm。均为敏感性示例而非实机开门保证，一次一人操作。',
  '冰箱门暂按向东侧铰接、朝南开启；90°开门会侵入厨房入口投影，余约542mm，不宜同时进出。需确认实际铰链、开门角度、抽屉拉出和搬入路线。',
  '双槽780×450×200mm借鉴弗兰卡BXX220-74，沿东墙纵向摆放；只是尺寸及外形参考，非已购物品。水槽下留排水空间，东侧柜不再放洗碗机。',
  '燃气灶暂估750×450mm，南墙近烟道；油烟机暂估800mm宽，下沿1550mm。灶面、油烟机安装高度、两侧防火距离和燃气阀位置须按选定型号复核，未把烟道接口画成已确认。',
  '灶右至东侧台面转角在保守布局里仅320mm直线台面，属于紧凑备餐；可用北侧及转角备餐，但不把旧模型多出的450mm当实际余量。',
  '热水器按参考照片暂作壁挂燃气式，机身参考530×330×205mm；型号/能源未定。独立外露，不封进吊柜；检修和燃烧安全净距须厂家确认。',
  '厨房与家政阳台之间为内窗，不是室外排气出口。燃气热水器必须有经专业确认的独立排烟通向室外，不能与油烟机/公共烟道混接，也不能排在封闭阳台内。',
  '北侧窗洞1200×1300mm、窗台1000mm仍为原条件占位；吊柜不跨窗，东柜起点距北墙800mm、止于热水器之外。热水器与窗扇、阳台龙头/机器及全部柜门开启须现场核验。',
  '效果图、局部占地校核和网页漫游均非施工或燃气安装图；湿区防水、电路、接地、燃气、排烟必须由有资质人员复核。'
];
const fit={id,version,date:'2026-10-05',roomId:'kitchen',summary,
  orientation:'north-up; reference photograph compared horizontally mirrored',
  modelEnvelope:{x:542,y:1127,w:287,d:262,status:'old-unclosed'},
  localEnvelope:{w:242,d:261,status:'r2-confirmed-room-net-only'},
  adjustmentBand:{x:694,w:45,status:'unclosed-filler-not-confirmed-usable-space'},
  localShaft:{x:0,y:201,w:60,d:60,status:'provisional'},
  localCountertops:[{x:80,y:0,w:162,d:65},{x:177,y:65,w:65,d:131},{x:60,y:196,w:182,d:65}],
  dishwasherCavity:{x:626,y:1127,w:62,d:65,clearHeightCm:86},
  parts,appliances,countertops,conditions,
  dimensions:['冰箱：650W × 600D × 1900H mm（用户提供）','洗碗机：600W × 600D × 805H mm（用户提供）','台面暂定高890mm；洗碗机上方净高860mm','双槽参考780 × 450 × 200mm，尚未选定','烟道暂估600 × 600mm，不可利用','局部复尺2420 × 2610mm；全屋图旧边界待闭合'],
  references:[
    {id:'franke-bxx220-74',title:'弗兰卡 BXX220-74 双槽 · 官方尺寸',url:'https://hschinaproduct.franke.com/list/post/86/',borrow:'780×450×200mm双槽，内盆420与298mm；仅作为可视尺寸参考，不等于选定型号。'},
    {id:'noritz-13ex31fex',title:'能率 13EX31FEX · 壁挂热水器尺寸参考',url:'https://www.noritz.com.cn/product/detail/?id=802',borrow:'530×330×205mm机身作为占位。能源、检修距离、独立排烟路线均待选型，不构成购买建议。'},
    {id:'rinnai-safety',title:'林内官方安装常见问题',url:'https://www.rinnai.com.cn/mobile/commonProblem3-baseKnowledge-page-2.html',borrow:'燃气热水器独立排烟至室外，不与厨房公共烟道混用；油烟机高度等按具体产品确认。'}
  ]
};
const floors=[
  ['shaft','西南烟道不可用',542,1329,60,60,270,'wall'],
  ['north','厨房北侧台面占地',622,1127,207,65,89,'cabinet'],
  ['east','厨房东侧双槽柜',764,1192,65,132,89,'cabinet'],
  ['south','厨房南侧炉灶柜',602,1324,227,65,89,'cabinet'],
  ['fridge','厨房冰箱',550,1132,65,60,190,'metal']
].map(([suffix,name,x,y,w,d,heightCm,tone])=>({id:'kitchen_'+suffix+'_footprint',name,x,y,w,d,heightCm,tone,roomId:'kitchen',a:0,kitchenFitoutId:id}));
for(const sid of ['wood','family','laundry']){
  const path=`models/schemes/${sid}/design-data.json`,data=await read(path);
  data.version=version;data.kitchenFitout={...structuredClone(fit),render:`assets/schemes/${sid}/kitchen-north.jpg`};
  data.furniture=data.furniture.filter(f=>!f.kitchenFitoutId&&!['厨房南侧地柜','厨房北侧地柜','冰箱高柜','蒸烤高柜'].includes(f.name)).concat(floors);
  data.renovationNotes=data.renovationNotes.filter(n=>n.roomId!=='kitchen').concat({roomId:'kitchen',text:summary});
  await save(path,data);
}
const catalog=await read('models/design-schemes.json');catalog.version=version;catalog.updatedAt='2026-10-05';
for(const scheme of catalog.schemes.filter(s=>['wood','family','laundry'].includes(s.id))){
  scheme.version=version;scheme.assetRevision=version;
  scheme.renderSpec.note='本轮全屋总览与厨房双向为当前模型新渲染；其他视图保留V3.7.0原图及原始来源，网页明确标注历史参考。每帧实际质量与来源见renderedViews。';
  scheme.differences=(scheme.differences||[]).filter(s=>!s.startsWith('厨房重排：')).concat('厨房重排：北侧冰箱与独立洗碗机、东侧双槽、南灶近烟道，吊柜在窗边热水器前留空。');
  scheme.tradeoffs=(scheme.tradeoffs||[]).map(s=>s.replace('卧卫/书房/飘窗/厨房/家政阳台实体全部保留','卧卫/书房/飘窗/家政阳台实体保留；厨房按本轮七项要求重新排布'));
  scheme.renderViews??=['overall','living','dining','master','bedroom-b','study','kitchen','master-bath','guest-bath','balcony','bay-master','bay-tea','bay-living','entry-storage','sideboard'];
  if(!scheme.renderViews.includes('kitchen-north'))scheme.renderViews.push('kitchen-north');
  scheme.roomOverrides??={};scheme.roomOverrides.kitchen={title:'洗切烹，各就其位',description:summary,features:['北侧独立洗碗机','东双槽 · 南灶台','窗边热水器留空']};
}
await save('models/design-schemes.json',catalog);
console.log('Updated all 3 active kitchen sources; architecture and purchased furniture untouched.');
