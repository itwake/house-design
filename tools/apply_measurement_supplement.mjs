// R2 is a scoped supplement, not permission to replace renovation walls with existing walls.
import {readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const baseline='3cd0096513a5baaae15ba5db167d3dc3015f5f13';
const sourcePath='models/measurements-20261004-r2.json';
const survey=JSON.parse(readFileSync(root+sourcePath,'utf8'));
const old=path=>JSON.parse(execFileSync('git',['show',`${baseline}:${path}`],{cwd:root,encoding:'utf8'}));
const save=(path,data)=>writeFileSync(root+path,JSON.stringify(data,null,2)+'\n');
const adopted=id=>{
  const record=survey.records.find(r=>r.id===id);
  if(!record || typeof record.adoptedMm!=='number') throw Error('Missing adopted value: '+id);
  return record.adoptedMm;
};
const summary='补充复尺已录入：主卧窗宽1760mm并按西墙段860mm条件定位；主卫实测局部轮廓独立展示。主卫窗高1400mm已确认，但模型保留旧窗占位等待定位；全屋墙线、面积及家具通道仍为旧设计参考。';
const bathNotice='主卫实测窗宽500、窗高1400mm；模型保留台1500／高800mm旧示意，窗台、定位及测量参考面待核。';
const bathDescription=bathNotice+' 主卫现状为西段1010×1320、东段1390×1530mm，总宽2400与南侧退台210mm由分段推算。局部现状图仅供复核，不直接替换套内玄关和拟建卫生间墙线；需取得共同基准、墙厚和窗台实测后再调整整体模型，不能据旧窗示意下单。';
const masterSource='R2 B3_WINDOW_LENGTH/UPPER_OFFSET/LOWER_OFFSET：窗宽1760mm，按西墙段860mm条件定位；860＋1760＋870＝3490比净跨3500少10mm，模型东段暂880mm。台410／高1660，外凸600仍旧占位。';
const bathSource='R2 S05/S06：实测记录窗宽500、窗高1400mm；经用户确认保留旧位置及台1500／高800mm示意，不将1400叠加旧窗台；窗台、窗中心、净高及框内/框外参考面待核。';
for(const sid of ['wood','family','laundry']){
  const path=`models/schemes/${sid}/design-data.json`,d=old(path);
  d.version=`3.6.1 · ${sid} · 补充复尺更新`;
  d.geometryRevision='2026-10-04 R2 · 主卧窗宽及条件定位；主卫窗保持旧示意';
  const master=d.windows.find(w=>w.id==='window_a');
  // Site EW master room starts at x=325 cm. Anchor only the explicit west segment.
  const west=325;
  master.x1=west+adopted('B3_WINDOW_UPPER_OFFSET')/10;
  master.x2=master.x1+adopted('B3_WINDOW_LENGTH')/10;
  master.widthMm=adopted('B3_WINDOW_LENGTH');
  master.source=masterSource;
  master.designScenario='窗宽1760mm已修正；西段860mm定位仍受全屋共同基准限制，东段暂880mm而实测870mm，保留10mm差值待核。窗台410、高1660、房高2790mm；外凸与框内净深未测。';
  const bath=d.windows.find(w=>w.id==='window_bath_1_east');
  bath.source=bathSource;
  bath.designScenario=bathNotice;
  bath.measuredDimensions={widthMm:adopted('S05'),heightMm:adopted('S06'),sillMm:null,fullyLocated:false};
  bath.placeholderDecision={geometry:'保留旧窗示意',sillMm:1500,heightMm:800,userConfirmed:true,reason:'新窗高1400不能与未测的旧窗台1500组合；不自行降低窗台。'};
  for(const w of d.windows){
    if(w.measurementStatus){
      w.measurementStatus.reference=sourcePath;
      if(w.id===master.id) w.measurementStatus.scope=masterSource;
      if(w.id===bath.id) w.measurementStatus.scope=bathSource;
    }
  }
  const anchor=d.anchors.find(a=>a.id==='bathWindows');if(anchor) anchor.source=bathSource;
  const afit=d.bayFitouts.find(f=>f.roomId==='room_a');
  if(sid==='wood'){
    afit.summary+=' R2窗宽已改1760mm，西墙段按860mm条件定位，东侧留10mm闭合差；未改原高桌家具。';
    afit.dimensions.push('窗宽1760mm；西段860，模型东段880对实测870，差10mm待核');
  }else{
    afit.summary='主卧取消桌椅，仅保留飘窗。窗宽1760mm，按西墙段860mm条件定位，模型东段880比实测870多10mm待核；台面410mm、窗高1660mm、净高2790mm。外凸600mm仍是旧占位。';
    afit.dimensions=['已录入：窗宽1760、台410、窗高1660、房高2790mm','西段860条件定位；东段880对实测870，差10mm待核','外凸600与框内净深仍待核；无飘窗桌椅'];
    afit.conditions=['窗侧链860＋1760＋870＝3490，较净跨3500差10mm；不平均分摊误差，不视为订窗定位图。','窗边防坠、框内净空、结构承载及外立面要求仍须专业核验。'];
  }
  d.bayDesign.assumptions[1]='主卧窗宽1760已改，按西段860条件定位且保留东段10mm差；台410／高1660／房高2790已录入，两卧外凸600仍旧占位。';
  d.bayDesign.measurementSource=sourcePath;
  const mr=d.measurementRevision;
  Object.assign(mr,{version:'3.6.1',source:sourcePath,baseline,summary,revision:'r2',previousVersion:'3.6.0',sourceSummary:survey.summary.reportClassifications});
  mr.applied=mr.applied.filter(a=>a.label!=='主卫窗水平记录');
  mr.applied.push(
    {label:'主卧窗宽与条件定位',value:'1760mm；西段860mm',scope:'三套方案2D/3D及同源效果图',note:'R2确认窗宽1760；三段合计3490对净跨3500差10mm，不取平均。东段模型暂880对记录870。'},
    {label:'主卫现状局部轮廓',value:'1010×1320＋1390×1530mm；总宽2400、退台210为推算',scope:'复尺核对明细独立局部图；不替换改造墙线',note:'S01–S04与O_S_DEPTH／D_SUITE_STEP。全屋共同基准未闭合，不取消已设计的套内玄关。'},
    {label:'主卫窗明确尺寸',value:'实测记录500×1400mm；定位待核',scope:'核对数据与醒目占位提醒；不修改本轮3D窗高',note:bathNotice+' 用户已选择保留旧示意，未授权猜测新窗台。'},
    {label:'其他补充复核',value:'书房左下990、两卧现门820mm；客餐厅30／次卧20mm偏差已接受',scope:'现状数据记录；不覆盖拟建门及扩大书房',note:'现门量取面仍需分清；厨房↔阳台1000原记录已撤销采用，不能当已确认尺寸。'}
  );
  const p=room=>mr.pending.find(p=>p.room===room);
  p('客餐厅').reason='两条南北链差30mm已由用户接受，原读数分别保留，不将3300改写为3270。全屋共同定位、墙厚及入户开口仍不足，窗中心仍沿用旧模型。';
  p('次卧B').reason='4300对3080＋1200＝4280的20mm偏差已接受；不等于所有墙线已闭合。当前主体3010对实测3000仍差10mm，窗东段380对370多10mm；现状入口不能覆盖拟建入口。';
  Object.assign(p('主卧'),{label:'净跨与窗位闭合差',measured:'东西3500、南北3090；西860＋窗1760＋东870＝3490mm',model:'东西3500、南北3100仍为原主体；窗宽1760、西段860，模型东段880mm',reason:'旧2620窗宽已更正，不再保留850mm冲突。新水平链剩10mm待核，主体南北仍差10mm；不平均分摊、不擅自移动卧室隔墙。'});
  Object.assign(p('书房'),{measured:'南北2730；左下990；东西2000＋990＝2990，与旧3030差40mm',reason:'左下990已确认，底段2730＋130－1200＝1660为推算；3030/2990的40mm仍未结案。扩大书房和推拉门属拟改造，不用现状一个矩形覆盖。'});
  Object.assign(p('主卫'),{label:'现状轮廓已明确；窗台与改造定位待核',measured:'西段1010×1320、东段1390×1530；窗记录500×1400mm',model:'现状局部图独立展示；全屋两卫及套内玄关墙线暂留，主卫窗台1500／高800mm为旧示意',reason:'总宽2400与退台210为推算，不能直接覆盖缩入套内玄关后的改造卫生间。窗高1400已确认；窗台、绝对定位、净高及框内/框外基准仍待核。经用户选择，不按猜测窗台900建模。'});
  Object.assign(p('客卫'),{measured:'深段净宽980；两段720＋1630＝2350为推算；门右短墙510mm',reason:'980仅为深段，不代表入口段总宽；左侧短墙未测，门600/520量取面未统一，完整退台轮廓仍不能确定。不得用510直接替代总宽。'});
  p('门与走廊').measured='原走廊940；书房、次卧现门820；主卫洞750/内650/高1950；主卧门830与走廊侧820/920mm';
  p('门与走廊').reason='须分清门扇、框内与结构洞口；末端130与门区950为条件推算，不是新实测。厨房↔阳台1000原记录本轮撤销采用，性质待核；不等同拟建1200大窗，设计1700推拉门保持。';
  mr.localExistingPlans=[{id:'suite-bath-existing',title:'主卫现状局部轮廓',pointsMm:[[0,0],[2400,0],[2400,1530],[1010,1530],[1010,1320],[0,1320]],basis:'分段实测S01/S02/S03/S04；总宽2400＝1010＋1390、退台210＝1530－1320为推算。分房图逆时针90°转为网站北向。',notes:['此图仅定位在局部坐标，不代表已与全屋墙线闭合；不覆盖套内玄关及拟建主卫墙线。','窗记录宽500、高1400mm，窗台与定位待核；本局部图不猜测门窗位置。','模型仍保留主卫窗台1500／窗高800mm旧示意。尺寸需按完成面及门窗参考面复核后才能施工。']}];
  mr.roomDescriptions.room_a=afit.summary;
  mr.roomDescriptions.bath_1={title:'主卫 · 实测尺寸与旧窗占位',description:bathDescription,notice:bathNotice,features:['实测窗高1400mm','旧窗示意未改','窗台及定位待核']};
  for(const note of d.renovationNotes||[]){
    if(note.roomId==='room_a') note.text=note.text.replace(old(path).measurementRevision.roomDescriptions.room_a,afit.summary);
    if(note.roomId==='bath_1'){note.text+=' '+bathDescription;note.status='补充复尺已记录 · 窗定位待核';}
  }
  if(!(d.renovationNotes||[]).some(n=>n.roomId==='bath_1')) d.renovationNotes.push({roomId:'bath_1',text:bathDescription,status:'补充复尺已记录 · 窗定位待核'});
  d.geometryNotes=[summary,...d.geometryNotes.filter(n=>!n.includes('局部复尺已应用：'))];
  save(path,d);
}
const catalog=old('models/design-schemes.json');
catalog.version='3.6.1';catalog.measurementSource=sourcePath;catalog.measurementNote=summary;
catalog.invariants=catalog.invariants.filter(t=>!t.includes('局部复尺已应用：')).map(t=>t.startsWith('飘窗已局部复尺：')?'飘窗已局部复尺：客厅2120/2210/400mm、次卧1760/1670/400mm、主卧1760/1660/410mm；主卧水平链仍差10mm，两卧外凸及全屋共同定位待核。':t);
catalog.invariants.push(summary);
for(const scheme of catalog.schemes){
  if(!['wood','family','laundry'].includes(scheme.id))continue;
  scheme.assetRevision='3.6.1';
  scheme.renderSpec.note='全部视图由R2补充复尺同一原生场景生成，主卧窗宽1760mm已更新；主卫台1500／窗高800mm仍为待定位旧示意，实际窗高记录1400mm。墙线/面积仍是旧设计参考。逐帧记录实际采样与哈希。';
  const d=JSON.parse(readFileSync(root+scheme.geometrySource,'utf8'));
  if(scheme.roomOverrides?.room_a)scheme.roomOverrides.room_a.description=d.measurementRevision.roomDescriptions.room_a;
  if(scheme.roomOverrides?.bath_1)scheme.roomOverrides.bath_1.description=bathDescription;
}
save('models/design-schemes.json',catalog);
console.log('Applied R2: master window 1760 mm, west anchor 860 mm; bath 1400 mm recorded, old 800/1500 geometry deliberately preserved.');
