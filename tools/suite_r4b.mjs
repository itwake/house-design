// Approved R4B review geometry, in centimetres. No surveyed/structural claims.
export function applyR4B(d,base){
  const room=id=>d.rooms.find(r=>r.id===id),f=id=>d.furniture.find(x=>(x.id||x.name)===id);
  const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1]},0))/20000;
  d.version='3.2.1 · suite R4B';d.geometryRevision='suite-r4b-2026-09-22';
  d.layout={...d.layout,reviewOnly:false,revision:'R4B',mainSleepingAreaM2:undefined,
    intent:'红线折墙、次卧尽头左转；主卧平开门先入套内玄关；书房扩大并采用推拉门。',
    entryZone:{x:386,y:334,w:73,d:153,roomId:'room_a',name:'主卧入口（套内）'},
    circulationNote:'相对R4A书房东扩200mm，公共走廊及两卫西墙同步东移；走廊约780mm，不以压窄通道换书房。'};
  const walls=[[275,6,275,242],[275,242,380,242],[380,242,380,493],[6,328,290,328],[290,328,290,626],[206,626,290,626],[275,242,275,328],[465,328,465,493],[465,328,681,328],[380,493,681,493],[380,493,380,626],[380,626,681,626]];
  d.walls=[...base.walls.slice(0,8),...base.walls.slice(14,18),...walls];
  d.wallSpecs=d.walls.map((coords,i)=>({id:'suite_r4b_wall_'+i,coords,thicknessCm:12,heightCm:270,grade:i<12?'baseline':'C'}));
  const polygons={
    room_b:[[12,12],[269,12],[269,322],[12,322]],
    room_a:[[281,12],[675,12],[675,322],[459,322],[459,487],[386,487],[386,236],[281,236]],
    room_c:[[12,334],[284,334],[284,620],[12,620]],
    bath_1:[[471,334],[675,334],[675,487],[471,487]],
    bath_2:[[386,499],[675,499],[675,620],[386,620]],
    living:[[281,248],[374,248],[374,632],[675,632],[675,1115],[530,1115],[530,1389],[212,1389],[212,632],[296,632],[296,334],[281,334]]
  };
  const labels={room_b:[147,226],room_a:[525,273],room_c:[179,449],bath_1:[557,434],bath_2:[474,573],living:[466,733]};
  for(const r of d.rooms){if(polygons[r.id])r.points=polygons[r.id];if(labels[r.id])r.planLabel=labels[r.id];r.modelAreaM2=+area(r.points).toFixed(4);delete r.notes;}
  const doors={
    door_a:{x1:380,y1:393,x2:380,y2:478,widthMm:850,name:'主卧850平开门 · 南铰向套内开',operation:{type:'hinged',hingeCm:[380,472],openLeafCm:{x:380,y:470,w:73,d:4},openingMm:850,swing:{dx:0,dy:-1,ox:1,oy:0,sweep:1}}},
    door_b:{x1:275,y1:249,x2:275,y2:324,widthMm:750,name:'次卧B · 走廊尽头左转',operation:{type:'hinged',hingeCm:[275,318],openLeafCm:{x:212,y:316,w:63,d:4},swing:{dx:0,dy:-1,ox:-1,oy:0,sweep:0}}},
    door_c:{x1:290,y1:448,x2:290,y2:548,widthMm:1000,name:'书房1000墙外挂推拉门',operation:{type:'surface-sliding',stackTo:'north',panelCm:{x:277,y:444,w:4,d:108},parkedCm:{x:277,y:334,w:4,d:108}}},
    door_bath_1:{x1:465,y1:374,x2:465,y2:449,widthMm:750,name:'主卫 · 北铰向卫内开',operation:{type:'hinged',hingeCm:[465,380],openLeafCm:{x:465,y:378,w:63,d:4},swing:{dx:0,dy:1,ox:1,oy:0,sweep:0}}},
    door_bath_2:{x1:380,y1:501,x2:380,y2:576,widthMm:750,name:'客卫 · 北铰向卫内开',operation:{type:'hinged',hingeCm:[380,507],openLeafCm:{x:380,y:505,w:63,d:4},swing:{dx:0,dy:1,ox:1,oy:0,sweep:0}}}
  };
  for(const o of d.doors)if(doors[o.id]){delete o.swing;Object.assign(o,doors[o.id],{notes:'R4B条件门位。平开门模型按90度开启展示，门板保持碰撞；书房推拉门沿室内侧向北停靠。门框、门吸、隔声与实际净开待深化。'});}
  Object.assign(f('主卧衣柜'),{x:281,y:65,w:60,d:160,notes:'随折墙靠西侧上段，床尾侧1600×600mm。'});
  Object.assign(f('vanity_main'),{x:473,y:337,w:60,d:36,face:'south',name:'主卫600浴室柜',notes:'随西墙东移200mm，620宽改600；主卫门开着时在盆前，洗手须先关门。'});
  Object.assign(f('主卫壁挂马桶'),{x:539,notes:'R4B占位东移60mm，排水立管及是否能移待核验。'});
  Object.assign(f('vanity_guest'),{x:450,y:501,w:60,d:38,face:'south',name:'客卫600浴室柜',notes:'北墙600×380mm占位，避免与入口门板相碰。'});
  f('1100书桌').notes='R4B沿书房南墙保留；推拉门向北停靠，不占书桌。';
  const bay=d.bayFitouts.find(x=>x.roomId==='room_a');
  bay.summary='主卧不设桌台、梳妆桌和配椅，只保留原飘窗石台及窗体；衣柜随折墙靠床尾西侧，次卧衣柜仍在南墙。';
  bay.dimensions[2]='主卧西侧折墙衣柜1600×600mm，随R4B上段墙定位';
  d.clearances=[{id:'public_corridor',name:'公共走廊约780mm',x:296,y:334,w:78,d:292},{id:'corridor_end',name:'次卧尽头转身位约930×860mm',x:281,y:248,w:93,d:86},{id:'private_entry',name:'套内玄关约730×1530mm',x:386,y:334,w:73,d:153}];
  d.renovationNotes=[
    {roomId:'room_a',text:'R4B：主卧入口平开门向套内开，先入730×1530mm小玄关，再往北到床区、向东到主卫；不设桌椅。衣柜靠折墙上段西侧，模型面积12.52㎡含入口。'},
    {roomId:'room_b',text:'沿走廊走到尽头左转，经东侧门进入次卧；南墙衣柜和床保留。折墙使模型净面积约7.97㎡，床尾局部仅约390mm，须实地试用。'},
    {roomId:'room_c',text:'相对R4A向东扩大200mm，净宽约2720mm、面积约7.78㎡；1000mm洞口采用墙外挂推拉门，沿室内东墙向北停靠，书桌和日床保留。'},
    {roomId:'bath_1',text:'相对R4A西墙东移200mm，面积约3.12㎡；盆柜600×360mm，马桶占位东移60mm。北铰内开门在盆柜前，使用洗手盆须先关门；排水与操作空间待深化。'},
    {roomId:'bath_2',text:'西门通公共走廊、北铰向卫内开，北墙600×380mm盆柜。相对R4A缩小至约3.50㎡；淋浴及外窗保留。'},
    {roomId:'living',text:'公共走廊仍约780mm；次卧入口在尽头左侧，主卧小玄关不计入公共区。客厅学习桌与玄关7字柜保留；成人椅沿用向南150mm的位置。'}
  ];
  d.geometryNotes=['V3.2.1按业主选用的R4B平面更新，仅suite模型变化，wood原案不变。','书房相对R4A增加约0.57㎡，代价是主卫减少约0.31㎡、客卫减少约0.24㎡及主卧少量面积；不是凭空扩容。','主卧门850mm、次卧/两卫750mm、书房1000mm为暂定洞口，并非保证净开宽度。平开门在3D中按90度开启展示，推拉门在漫游时打开。','730mm小玄关、780mm走廊、次卧床尾390mm仍偏紧。门框/门吸/携物通行及主卫关门使用盆柜须现场复核。','厘米坐标并非实测成果。改墙、湿区防水、立管、排水、承重/梁柱/窗台防坠都须专业核验。'];
  return d;
}
