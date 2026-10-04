// Idempotent scoped revision from the reviewed V3.5.3 baseline. Never globally scale a plan.
import {readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const baseline = 'a29486aeb2085565c7269ad0888a818ac332d2dd';
const sourcePath = 'models/measurements-20261004.json';
const source = JSON.parse(readFileSync(root + sourcePath, 'utf8'));
const old = path => JSON.parse(execFileSync('git', ['show', `${baseline}:${path}`], {cwd:root, encoding:'utf8'}));
const save = (path, data) => writeFileSync(root + path, JSON.stringify(data, null, 2) + '\n');
const confirmed = id => {
  const r = source.records.find(r => r.id === id);
  if (!r || typeof r.adoptedMm !== 'number' || ['待核','旧估未测','条件计算'].includes(r.status)) throw Error('Not independent adopted measurement: '+id);
  return r.adoptedMm;
};
const summary = '局部复尺已应用：客厅、次卧飘窗尺寸与主卧窗立面/净高；全屋墙线尚未闭合，外轮廓、房间面积和柜体通道仍为旧设计参考。';
const pending = [
  {room:'全屋',label:'墙厚与总轮廓闭合',measured:'厨房净2420×2610；原阳台净1240×1490；餐区宽条件值3330mm',model:'统一墙厚120mm、旧总轮廓暂留',reason:'图纸旋转到网站坐标后，假定厨房/阳台东墙共线，会相差150mm。尚无法区分墙厚、墙面错位或量尺基准；不擅自加厚墙或移动外墙。'},
  {room:'客餐厅',label:'整体净尺寸与窗定位',measured:'东西4660；南北7570（5450＋2120条件合成），另一侧合计7600mm',model:'原房间多边形/面积保留，客厅高度2700mm已确认',reason:'两条南北链差30mm；入户开口、墙厚及跨区定位不足。窗宽2120已改，绝对位置仍沿用旧中心线，不代表已完成全屋定位。'},
  {room:'次卧B',label:'主体及入口凹位',measured:'东西3000×南北3080；原入口860×1200mm',model:'主体东西3010mm，入口为当前改造布局',reason:'确认值已录入但不能把现状凹口覆盖新方案；窗西段870已定位，旧墙下东段380比实测370多10mm，随墙体闭合统一修正。'},
  {room:'主卧',label:'东西净跨与窗宽',measured:'3500与860＋2620＋870＝4350相差850mm；南北3090mm',model:'东西3500、南北3100；窗宽1500mm均为旧占位',reason:'窗侧水平链与总跨矛盾，不选取任一候选强行闭合。只采用410＋1660＋720＝2790的独立垂直链。'},
  {room:'书房',label:'现状净尺寸与改造扩大区分',measured:'南北2730mm；东西3030与2010＋980＝2990相差40mm',model:'各方案原书房墙线/推拉门、家具暂留',reason:'现状凹口未闭合，扩大的书房是改造方案，不能用现状一个矩形直接替换。'},
  {room:'主卫',label:'净宽/净深与窗高度',measured:'1320与1530差210；原窗水平记录500mm；“高1400”含义待核',model:'两卫原改造墙线；主卫窗暂定位旧中心，窗台1500/高800mm仍旧占位',reason:'总净深缺测，1400可能是窗高或窗台高；500尚缺洞口/框外/框内基准，只按记录宽做条件替换，不视为订窗尺寸。'},
  {room:'客卫',label:'局部宽不能代替总净宽',measured:'局部980；720＋1630＝2350条件合成mm',model:'原两卫边界/台盆和洁具位置暂留',reason:'980仅量至内线，不是完整净宽；总宽、右下退位和新画横线性质需核实。'},
  {room:'家政阳台',label:'现状与借厅扩展方案',measured:'原净1240×1490mm，局部凸出50×150mm位置待补',model:'原版现状占位；亲子/整墙保留借厅扩展设计与并排洗烘',reason:'已记录原净尺寸，但借厅后尺寸不可直接回退到原阳台；设备净空、窗框及与厨房的共同基准须随全屋闭合复核。水龙头迁移与换表未办结。'},
  {room:'门与走廊',label:'保留拟建门，不混同现状门',measured:'原走廊940；主卫洞750/内门650/门高1950；主卧门830与走廊侧820/920mm',model:'主卧平开门、书房推拉门、厨房1700推拉门等设计参数未改',reason:'需分清门扇、框内及结构洞口。主卫门1950未明确高度基准；现状厨房↔阳台1000开口也不等于拟建1200大窗。'},
  {room:'窗边安全',label:'净深、承载和防坠',measured:'仅客厅外凸600确认；两卧外凸仍未测',model:'两卧外凸600mm旧占位；软垫和防护均是设计意图',reason:'宽高数据不等于窗框系统净空或结构承载认证；28楼防坠、开启限位、台面承载、排水及墙体可拆性需专业核验。'},
];
const livingSummary = '复尺记录客厅窗宽2120mm、窗高2210mm、台面离地400mm、外凸600mm，窗顶2610mm。两片960×550mm可拆洗软垫各厚50mm，完成坐面约450mm；不加桌椅，不向厅内外扩。窗在整墙上的定位暂留旧中心，框内净深、排水和高层防坠仍须核验。';
const secondarySummary = '次卧无独立桌椅。复尺窗宽1760mm、窗高1670mm、台面400mm；茶座坐垫完成面450mm。窗位按西内墙留870mm定位，东侧旧墙仍多10mm，待全屋墙线闭合。';
for (const id of ['wood','family','laundry']) {
  const path = `models/schemes/${id}/design-data.json`;
  const d = old(path);
  d.version = `3.6.0 · ${id} · 局部复尺更新`;
  d.layout.measured = false;
  d.geometryRevision = '2026-10-04 · 已确认局部立面；全屋墙线暂保留';
  const w = key => d.windows.find(w => w.id === key);
  const living = w('window_living_west'), secondary = w('window_b'), master = w('window_a'), bath = w('window_bath_1_east');
  const livingCenter = (living.y1 + living.y2)/2;
  Object.assign(living,{y1:livingCenter-confirmed('L02')/20,y2:livingCenter+confirmed('L02')/20,widthMm:confirmed('L02'),sillCm:confirmed('L04')/10,heightCm:confirmed('L03')/10});
  living.bay.projectionCm=confirmed('L05')/10;
  Object.assign(secondary,{x1:12+confirmed('B2_WINDOW_UPPER_OFFSET')/10,x2:12+(confirmed('B2_WINDOW_UPPER_OFFSET')+confirmed('B2_WINDOW_LENGTH'))/10,widthMm:confirmed('B2_WINDOW_LENGTH'),sillCm:confirmed('B2_WINDOW_SILL_HEIGHT')/10,heightCm:confirmed('B2_WINDOW_HEIGHT')/10});
  Object.assign(master,{sillCm:confirmed('B3_WINDOW_SILL_HEIGHT')/10,heightCm:confirmed('B3_WINDOW_HEIGHT')/10});
  secondary.name='次卧北飘窗（复尺400mm台面，软垫为条件设计）';
  secondary.designScenario='复尺台面400mm、窗高1670mm；设计软垫完成面450mm。窗侧定位和框内净深、结构承载、防坠仍须核验；不代表允许拆改窗台。';
  living.designScenario='复尺台面400mm、窗高2210mm，窗顶2610mm；设计可拆软垫50mm，完成坐面约450mm。窗中心仍沿旧模型，框内净空、承载和防坠需现场核验，不是拆改结构许可。';
  const bathCenter = (bath.y1+bath.y2)/2;
  Object.assign(bath,{y1:bathCenter-confirmed('S05')/20,y2:bathCenter+confirmed('S05')/20,widthMm:confirmed('S05')});
  const descriptions = {
    window_living_west:'L02/L03/L04/L05：宽2120、高2210、台400、外凸600mm；中心位置暂留旧模型，净框基准待核。',
    window_b:'B2_WINDOW_*：宽1760、高1670、台400mm；西墙段870定位，东墙段待全屋闭合；外凸600仍旧占位。',
    window_a:'B3_WINDOW_*：高1660、台410mm；宽1500及位置仍旧占位（实测水平链差850mm），外凸未测。',
    window_bath_1_east:'S05：水平记录500mm条件替换；框内/框外基准未明，中心、窗高800、台1500仍旧占位。',
  };
  for (const item of [living,secondary,master,bath]) {
    item.grade='局部复尺'; item.source=descriptions[item.id];
    item.measurementStatus={date:'2026-10-04',reference:sourcePath,scope:descriptions[item.id],fullyLocated:false};
  }
  d.rooms.find(r=>r.id==='room_a').heightCm=confirmed('B3_ROOM_HEIGHT')/10;
  d.rooms.find(r=>r.id==='living').heightCm=confirmed('L12')/10;
  // Master room edges use measured vertical height without moving any plan edge.
  // Keep all other parts of shared continuous walls at their original height.
  const polygon=d.rooms.find(r=>r.id==='room_a').points;
  for (const wall of d.wallSpecs) {
    const [x1,y1,x2,y2]=wall.coords, horizontal=Math.abs(y2-y1)<1e-7;
    const fixed=horizontal?y1:x1, start=Math.min(horizontal?x1:y1,horizontal?x2:y2), end=Math.max(horizontal?x1:y1,horizontal?x2:y2);
    const segments=[];
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i],b=polygon[(i+1)%polygon.length];
      if(horizontal ? Math.abs(a[1]-b[1])>1e-7 : Math.abs(a[0]-b[0])>1e-7) continue;
      if(Math.abs((horizontal?a[1]:a[0])-fixed)>wall.thicknessCm/2+.01) continue;
      const lo=Math.max(start,Math.min(horizontal?a[0]:a[1],horizontal?b[0]:b[1])-wall.thicknessCm/2);
      const hi=Math.min(end,Math.max(horizontal?a[0]:a[1],horizontal?b[0]:b[1])+wall.thicknessCm/2);
      if(hi>lo) segments.push({fromCm:lo,toCm:hi,heightCm:279});
    }
    if(segments.length) wall.heightSegments=segments;
  }
  for(const anchor of d.anchors) {
    anchor.grade='旧设计参考'; anchor.source='旧模型尺寸；本次复尺未完成全屋闭合，不是已确认现状总尺。';
    if(anchor.id==='livingWindow'){anchor.valueMm=2120;anchor.grade='局部复尺';anchor.source=descriptions.window_living_west;anchor.label='客厅窗水平记录宽';}
    if(anchor.id==='wallHeight'){anchor.valueMm='客厅2700 / 主卧2790';anchor.grade='局部复尺';anchor.label='已录入房间高度';anchor.source='L12、B3_ROOM_HEIGHT；其他房间2700仍暂定。';}
    if(anchor.id==='bathWindows'){anchor.valueMm='主卫500 / 客卫600旧占位';anchor.source=descriptions.window_bath_1_east;}
  }
  const bfit=d.bayFitouts.find(f=>f.roomId==='room_b');
  for(const part of bfit.parts){part.x+=9;part.zCm=Number((part.zCm-3).toFixed(4));}
  bfit.summary=secondarySummary;
  bfit.dimensions=['台面400＋薄垫50＝完成坐面450mm','单人坐垫850×550、茶托280×320mm','窗宽1760、窗高1670mm；外凸600仍待核','现墙下东侧段380mm，较实测370mm多10mm待闭合'];
  bfit.conditions=['台高已按复尺更新，不表示窗框净深、结构承载和防护已核准。','保留软垫可拆洗和茶盘可移；不虚构台下抽屉；不放电热壶。','28楼防坠和开启限位须先专业核验，纱窗不代替防坠；不设计为儿童攀爬区。'];
  const lfit=d.bayFitouts.find(f=>f.roomId==='living');
  lfit.summary=livingSummary;
  lfit.dimensions=['复尺台400＋设计软垫50＝坐面约450mm','两片960×550mm软垫，中缝20mm','记录窗宽2120、窗高2210、外凸600mm','窗中心与框内净空仍待全屋定位核验'];
  lfit.conditions=['台面400mm、窗高2210mm来自本次核对表，不是允许降低或拆改结构的施工指令。',...lfit.conditions.slice(2)];
  const afit=d.bayFitouts.find(f=>f.roomId==='room_a');
  if(id==='wood') {
    afit.title='主卧 · 原高桌方案待重新适配';
    afit.summary='主卧实台现按410mm建模，原931mm高桌与高椅暂保留作为历史设计比较；窗前台板不能再视为落在900mm实台上。需重新确认独立支撑、普通桌高度、玻璃前净空与防坠后才可深化。';
    afit.dimensions[1]='实测台410mm；原设计高桌931mm、座高640mm尚未重设计';
    afit.conditions[0]='已证实旧900mm实台占位不成立。此版保留高桌家具，不将其作为已适配低窗台的可施工方案。';
    afit.conditions.push('窗侧悬跨和玻璃前台板独立承重体系尚未设计，严禁据图下单或现场仅靠旧飘台承重。');
  } else {
    afit.summary='主卧取消桌椅，仅保留飘窗；实测台面410mm、窗高1660mm，净高2790mm。窗宽1500mm及外凸600mm仍是旧占位，待水平尺寸链核清。';
    afit.dimensions=['已录入：台410、窗高1660、房间高2790mm','未确认：窗宽1500、外凸600及其定位','无飘窗桌椅，不新增台下储物'];
    afit.conditions=['窗侧水平链3500/4350有冲突，窗宽与定位暂留旧值。','窗边防坠、框内净空、结构承载及外立面要求仍须专业核验。'];
  }
  d.bayDesign.assumptions=['客厅宽2120/高2210/台400/外凸600mm已录入；次卧宽1760/高1670/台400mm已录入。','主卧只采用台410/高1660/房高2790mm；水平链待核，两卧外凸600mm仍旧占位。','测量数字不等于框内净空、承载或防坠合格；全部窗系统、家具支撑与电气须专业深化。'];
  d.bayDesign.measurementSource=sourcePath;
  // Preserve historical revisions as history, but current notes must not restate obsolete window heights.
  d.geometryNotes=['2026-10-04 '+summary,...d.geometryNotes.filter(n=>!/(1300\/1500\/2000|次卧430|主卧900|窗顶2300)/.test(n))];
  const roomDescriptions={living:livingSummary,room_b:secondarySummary,room_a:afit.summary};
  if(Array.isArray(d.renovationNotes)) {
    for(const note of d.renovationNotes) {
      if(!roomDescriptions[note.roomId]) continue;
      if(id==='wood') note.text=roomDescriptions[note.roomId];
      else note.text=note.text.split(' 按业主授权暂估：')[0]+' '+roomDescriptions[note.roomId];
      note.status='保留改造意图 · 局部复尺更新';
    }
  }
  for(const [rid,desc] of Object.entries(roomDescriptions)) {
    if(typeof d.renovationNotes?.[rid]==='string') d.renovationNotes[rid]=desc;
    else if(d.renovationNotes?.[rid]?.description) d.renovationNotes[rid].description=desc;
  }
  d.measurementRevision={date:'2026-10-04',version:'3.6.0',stage:'partial-confirmed',source:sourcePath,summary,orientation:source.orientation,oldEnvelope:true,baseline,
    applied:[
      {label:'客厅飘窗',value:'宽2120 × 高2210；台400；外凸600mm',scope:'三套方案2D/3D',note:'L02/L03/L04/L05；绝对位置沿旧中心，坐垫50mm为设计值。'},
      {label:'次卧飘窗',value:'宽1760 × 高1670；台400；西墙段870mm',scope:'三套方案2D/3D及茶座',note:'B2_WINDOW_*；坐垫与茶托随窗平移90mm、降低30mm，完成坐面450mm。东墙段仍差10mm。'},
      {label:'主卧窗立面与净高',value:'台410＋窗1660＋距顶720＝房高2790mm',scope:'三套方案3D分区立面',note:'B3_WINDOW_* / B3_ROOM_HEIGHT；只升主卧边界对应墙段及顶面，不把次卧、卫生间一并升高。'},
      {label:'主卫窗水平记录',value:'500mm（条件替换）',scope:'三套方案2D/3D',note:'S05；测量框内/框外基准未明，窗中心、高度和台高仍待核，不能直接订窗。'},
      {label:'客厅净高',value:'2700mm',scope:'维持当前客厅顶面',note:'L12已确认；不推广为其他未测房间的净高。'},
    ],pending:structuredClone(pending),roomDescriptions};
  if(id==='wood') d.measurementRevision.pending.push({room:'原版主卧高桌',label:'高桌与低飘台的适配',measured:'飘台410mm，旧900mm占位不成立',model:'原设计台高931/座高640mm保留比较',reason:'桌椅设计未擅自改动，窗侧台板需独立支撑与重新校核，不能按现图下单。亲子/家政方案无该桌椅。'});
  save(path,d);
}
const catalog=old('models/design-schemes.json');
catalog.version='3.6.0';catalog.updatedAt='2026-10-04';
catalog.measurementSource=sourcePath;catalog.measurementNote=summary;
catalog.invariants=catalog.invariants.map(t=>t.includes('三个飘窗的外包络')?'飘窗已局部复尺：客厅2120/2210/400mm，次卧1760/1670/400mm；主卧窗水平宽与两卧外凸仍待核。功能和防护条件保留。':t);
catalog.invariants.push(summary);
for(const scheme of catalog.schemes){
  if(!['wood','family','laundry'].includes(scheme.id)) continue;
  scheme.assetRevision='3.6.0';scheme.summary=scheme.summary.replace('暂估400mm低台＋50mm软垫，待复尺','复尺400mm低台＋设计50mm软垫，框内净空及防护待核');
  scheme.renderSpec.note='本次全部视图由局部复尺后的同一原生场景重新渲染；墙线/面积仍为旧设计参考。实际采样与哈希逐帧记录。';
  const d=JSON.parse(readFileSync(root+scheme.geometrySource,'utf8'));
  for(const [rid,key] of [['living','living'],['room_a','room_a'],['room_b','room_b']]){
    if(scheme.roomOverrides?.[key]) {scheme.roomOverrides[key].description=d.measurementRevision.roomDescriptions[rid];scheme.roomOverrides[key].features=['局部复尺已录入','全屋墙线待闭合','防护与净空待核'];}
  }
}
save('models/design-schemes.json',catalog);
console.log('Applied V3.6.0 partial measurement adoption to wood/family/laundry; wall XY and all designed furniture footprints preserved.');
