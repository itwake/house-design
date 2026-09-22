// Approved furniture review, built on R4B circulation. Units: cm, not a survey.
export function applyFittedSuite(d){
  const room=id=>d.rooms.find(r=>r.id===id),f=id=>d.furniture.find(v=>(v.id||v.name)===id);
  const index=d.walls.findIndex(w=>w.join()==='275,6,275,242');
  if(index<0)throw new Error('Expected R4B upper bedroom partition');
  d.walls[index]=[319,6,319,242];d.wallSpecs[index].coords=d.walls[index];
  room('room_b').points=[[12,12],[313,12],[313,236],[269,236],[269,322],[12,322]];
  room('room_a').points=[[325,12],[675,12],[675,322],[459,322],[459,487],[386,487],[386,236],[325,236]];
  for(const r of d.rooms)r.modelAreaM2=+(Math.abs(r.points.reduce((s,a,i)=>{const b=r.points[(i+1)%r.points.length];return s+a[0]*b[1]-b[0]*a[1]},0))/20000).toFixed(4);
  Object.assign(f('bed_b'),{x:12,notes:'床头贴西墙完成面示意；床架长210cm，床尾至浅台47cm，仍偏窄。踢脚线与软包收口待复尺。'});
  Object.assign(f('次卧衣柜'),{x:12,notes:'南墙180×60cm移门柜，西端贴西墙；床侧至柜前62cm。'});
  Object.assign(f('主卧衣柜'),{x:325,y:12,w:60,d:224,notes:'西侧凹位从北墙至南端返墙做满224cm，深60cm；两端收口包含在总长内，柜前至床尾80cm。'});
  Object.assign(f('1100书桌'),{id:'study_full_desk',name:'书房通长桌',x:12,w:272,notes:'南墙272×55cm通长桌面；模型含端板、钢架及中间支脚，非无支撑悬空台面。承载和收口待深化。'});
  d.furniture=d.furniture.filter(v=>!['书房日床','书房客衣柜'].includes(v.name));
  d.furniture.push({id:'bed_b_niche_console',name:'次卧补齐退台的连续浅台',x:269,y:12,w:44,d:224,tone:'wood',face:'west',notes:'44×224cm连续浅台，台前沿齐保留门口内墙x269。仅置物/偶尔使用，不配椅、不视为舒适办公位；床尾47cm。'},
    {id:'study_north_sofa',name:'书房北墙沙发',x:48,y:334,w:200,d:85,a:0,tone:'fabric',face:'south',notes:'200×85cm沙发占位，背靠北墙，左右各36cm；不是选定产品或沙发床展开状态。原北墙小衣柜取消。'});
  d.windows.push({id:'window_kitchen_balcony',name:'厨房与阳台共墙大窗（尺寸及窗型待复尺）',kind:'window',roomId:'kitchen',connects:['kitchen','balcony'],x1:698,y1:1121,x2:818,y2:1121,widthMm:1200,sillCm:100,heightCm:130,grade:'C',windowSystem:{type:'two-track-horizontal-slider',panelCount:2,frameCm:3.5,panelFrameCm:2.8,overlapCm:3,trackPitchCm:3.6,panelDepthCm:2.4},source:'业主确认厨房与阳台之间应有大窗；共墙位置沿用模型，洞宽1200/高1300/台高1000及双扇推拉窗型均为暂定，不是实测。',notes:'厨房与家政阳台之间的内窗，不是通往客厅的窗或阳台外窗。保留窗下墙、两边台下柜和现有门；阳台外侧采光通风条件另核。'});
  d.version='3.2.3 · suite kitchen window';d.geometryRevision='suite-kitchen-balcony-window-2026-09-22';
  d.layout={...d.layout,revision:'Fitted',reviewOnly:false,intent:'保留R4B门位与套内玄关，仅两卧北段隔墙东移回原位；以浅台补齐次卧退台，主卧满凹位衣柜，书房北沙发南通长桌。',circulationNote:'次卧仍在公共走廊尽头左转；主卧经平开门先入套内玄关；书房保留墙外挂推拉门。'};
  d.appearance={preset:'soft-warm',description:'暖白、浅米灰、低饱和浅木与少量鼠尾草绿；材质贴图、柜门、灯光和网页同步减黄。'};
  const notes={room_a:'主卧先经平开门入730×1530mm套内玄关，再到床区或主卫。两卧北段隔墙恢复原x319；衣柜沿西侧凹位做满2240×600mm，柜前至床尾约800mm。不设桌椅，模型约11.53㎡含入口。',room_b:'走廊尽头左转入次卧。床头和南墙1800×600mm衣柜西端贴西墙；床尾新增2240×440mm浅台，前沿齐门口内墙。模型约8.95㎡；床尾470mm仍窄，不配办公椅。',room_c:'保留约7.78㎡书房及1000mm墙外挂推拉门。北墙2000×850mm沙发替换日床，原北墙小柜取消；南墙2720×550mm通长桌，含支承示意。沙发至桌前约1460mm，至图示椅背约910mm。'};
  for(const n of d.renovationNotes)if(notes[n.roomId])n.text=notes[n.roomId];
  d.renovationNotes.push({roomId:'kitchen',text:'补回厨房北侧与家政阳台共墙大窗，暂定1200×1300mm、窗台高1000mm，双扇推拉窗型仅为示意。台下柜、洗菜盆和1700mm厨房推拉门不动；北墙层板缩回窗左侧实墙，不横挡玻璃。窗洞、墙体、五金与防水收口须复尺。'},
    {roomId:'balcony',text:'南侧与厨房共墙补大窗；阳台家政矮柜仍在窗下、洗烘塔及西侧客厅入口保留。这是厨房借光内窗，不是阳台外窗；外侧采光、通风及封窗情况仍待核实。'});
  const bay=d.bayFitouts.find(x=>x.roomId==='room_a');bay.summary='不设桌台、梳妆桌和配椅，只保留飘窗石台及窗体。主卧西侧衣柜沿凹位做满2240×600mm。';bay.dimensions[2]='主卧凹位衣柜2240×600mm，收口计入总长，柜前约800mm';
  d.geometryNotes=['V3.2.2按确认的家具平面更新suite；原wood方案及其模型、效果图不变。','只将两卧北段隔墙东移440mm回原x319，保留门口段和横向返墙；所有门位、公共走廊、套内玄关、两卫及书房边界不变。','次卧床尾470mm、床侧柜前620mm，主卧柜前800mm；均为模型外轮廓净距，不等于舒适度或合规认证。','书房桌面2720mm含端板钢架及支脚示意；北墙沙发2000×850mm为占位，非沙发床展开状态。柜体两端施工收口须复尺。','730mm小玄关、780mm公共走廊仍紧凑；主卫开门板在盆前，洗手须先关门。','厘米坐标并非实测；改墙、门框五金、承重梁柱、排水防水和窗台防坠须专业核验。'];
  d.geometryNotes.unshift('V3.2.3补回厨房—阳台共墙内窗，暂定1200×1300mm、台高1000mm；仅窗洞、窗体、窗左厨房层板及相关镜头变化，已确认房间/家具布局与暖白配色不变。');
  return d;
}

export function updateFittedCatalog(catalog,d){
  catalog.version='3.2.3';const s=catalog.schemes.find(v=>v.id==='suite');
  Object.assign(s,{name:'木光 · 暖白套间',tagline:'凹位做满，光线更柔和',summary:d.layout.intent+' 厨房与阳台之间补回大窗。',style:'暖白浅木 · 套间入口',assetRevision:'3.2.3',appearance:d.appearance,
    colors:[{name:'低饱和浅木',hex:'#C5B9A7'},{name:'暖白',hex:'#F5F2ED'},{name:'浅米灰织物',hex:'#D5CFC6'},{name:'鼠尾草绿',hex:'#8D9B8F'}],
    planPalette:{wood:'#C5B9A7',cabinet:'#EAE6E0',fabric:'#F3F0EA',metal:'#AEAFAC',wall:'#908D87',wet:'#E1E7E5',floor:'#F0ECE5'},
    differences:['主卧平开门先入约730×1530mm套内玄关；次卧仍在走廊尽头左转，书房保留推拉门。','两卧北段隔墙东移回原位；次卧床头和南墙衣柜贴西墙，床尾浅台补齐门口退台。','主卧2240×600mm衣柜沿凹位做满；取消主卧桌椅。','书房北墙沙发、南墙2720×550mm通长桌；整套采用暖白浅木、米灰织物与中性偏暖照明。'],
    tradeoffs:['次卧床尾约470mm仍偏窄，浅台不配椅、不作为舒适办公位。','主卧柜前约800mm；730mm套内玄关、780mm公共走廊仍紧凑。','主卫开门板在盆前，洗手须先关门；湿区和排水待深化。','非实测施工图；改墙、收口、长桌承载、门窗和防坠须专业核验。']});
  s.roomOverrides.overall={title:'暖白浅木，收纳沿墙归位',description:s.summary,features:['确认家具平面','暖白浅木','套间入口']};
  for(const [id,title,features]of [['room_a','衣柜铺满凹位，保留床尾通路',['2240mm满凹位柜','约800mm柜前','无桌椅']],['room_b','贴西归位，浅台补齐门口',['2240×440mm浅台','南墙衣柜','床尾约470mm']],['room_c','北墙沙发，南墙通长桌',['2720mm通长桌','北墙沙发','保留推拉门']]])s.roomOverrides[id]={title,description:d.renovationNotes.find(n=>n.roomId===id).text,features};
  for(const [id,title,features]of [['kitchen','让厨房与阳台之间通透起来',['共墙大窗','窗下台面保留','尺寸待复尺']],['balcony','窗与门各归其位',['南侧厨房内窗','西侧客厅入口','洗烘及矮柜保留']]])s.roomOverrides[id]={title,description:d.renovationNotes.find(n=>n.roomId===id).text,features};
}
