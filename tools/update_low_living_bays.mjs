// User-approved estimation: a 400 mm sill with 50 mm removable pads.
// This is not a measured survey or permission to cut the existing structure.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const save=(p,v)=>writeFile(new URL(p,root),JSON.stringify(v,null,2)+'\n');
const hash=async p=>createHash('sha256').update((await readFile(new URL(p,root),'utf8')).replaceAll('\r\n','\n')).digest('hex');
const summary='按业主授权暂估：客厅飘窗台面离地400mm，铺50mm可拆洗软垫，坐面约450mm。两片暖灰米色软垫各960×550mm，不向客厅外扩，不加书桌、椅子或台下柜。窗顶沿用2300mm占位，台高、净深、窗框及防护均待量房；这不是把实墙从900mm切低的施工指令。';
for(const id of ['wood','suite','family','laundry']){
 const path=`models/schemes/${id}/design-data.json`,d=await read(path),f=d.bayFitouts.find(f=>f.roomId==='living'),w=d.windows.find(w=>w.id==='window_living_west');
 const prior=f.summary;
 w.sillCm=40;w.heightCm=190;w.baselineSillCm=90;w.baselineHeightCm=140;
 w.name='客厅西低飘窗（400台高暂估，非实测）';
 w.designScenario='业主允许先暂估：完成台面400mm＋可拆软垫50mm，完成坐面约450mm；窗顶2300mm沿用占位。不是拆改结构或降低现状窗台的施工许可，窗体和防坠需实测核查。';
 f.type='low_lounge';f.title='客厅 · 低飘窗软垫休憩';f.summary=summary;
 f.parts=[
  {id:'l_seat_pad_north',title:'客厅北片可拆洗坐垫',role:'seat_cushion',x:148,y:650,w:55,d:96,zCm:40,hCm:5},
  {id:'l_seat_pad_south',title:'客厅南片可拆洗坐垫',role:'seat_cushion',x:148,y:748,w:55,d:96,zCm:40,hCm:5}
 ];
 f.dimensions=['暂估完成台面400mm＋软垫50mm＝坐面约450mm（非实测）','两片坐垫各960×550mm，中间留20mm拆洗缝','沿用2000mm窗宽、600mm外凸包络；净深与窗框均待量尺','软垫留在飘窗内，不占客厅通道，不加桌椅或台下柜'];
 f.conditions=[
  '本轮按业主同意做估算方案，不是现状测绘。量房后按完成地面、原台面和窗框实际尺寸修订。',
  '原900mm只是旧模型占位；当前400mm不表示允许把现状结构降低500mm。禁止依据本图拆改原台。',
  '软垫分两片可取下、可拆洗；先查渗水、返潮及排水口，不封死窗框排水与检修。',
  '28楼且家有幼童：先由专业人员核验防坠、开窗限位和无绳窗帘；软垫不等于安全措施，纱窗不能替代防坠。',
  '按成人短时休憩展示，不布置儿童攀玩设施；不加靠玻璃受力的靠背，不默认台下可挖空收纳。'
 ];
 d.livingBayRevision={...d.livingBayRevision,version:'3.4.2',measured:false,sillHeightStatus:'user-authorized-estimate',estimatedSillCm:40,cushionThicknessCm:5,finishedSeatCm:45,estimateAuthorized:true,scope:'仅客厅西飘窗降低建模占位并铺两片软垫；其他墙体、家具及门窗不变。'};
 d.version=`3.4.2 · ${id} · 客厅低飘窗软垫`;
 for(const n of d.renovationNotes||[])if(n.roomId==='living')n.text=n.text.replace(prior,summary);
 d.geometryNotes=[...(d.geometryNotes||[]).filter(n=>!/^V3\.4\.[12]/.test(n)),'V3.4.2：'+summary];
 if(d.bayDesign?.assumptions)d.bayDesign.assumptions=d.bayDesign.assumptions.map(n=>n==='A与厅900mm保留旧占位；B低台是独立条件展示，不是实测或拆改许可。'?'主卧900mm仍是旧占位；次卧430mm是条件低台；客厅按业主授权暂估400mm＋50mm软垫。均非实测或拆改许可。':n);
 await save(path,d);
}
for(const id of ['family','laundry']){const p=`models/schemes/${id}/design-data.json`,d=await read(p);d.layout.parentSourceSha256=await hash(d.layout.parentSource);await save(p,d);}
for(const id of ['wood','laundry']){const p=`models/schemes/${id}/design-data.json`,d=await read(p);if(d.kitchenReference?.source)d.kitchenReference.sourceSha256=await hash(d.kitchenReference.source);await save(p,d);}
const catalog=await read('models/design-schemes.json');catalog.version='3.4.2';
catalog.renderQualityPolicy='renderSpec.samples为各方案最低采样要求；每张图的实际采样、尺寸、引擎及来源以scene-manifest.json的renderedViews为准。更高采样可用，不降低最低质量。';
for(const s of catalog.schemes){
 s.assetRevision='3.4.2';s.summary=s.summary.replace('客厅窗前桌椅已全部移除；台高待复尺。','客厅窗前无桌椅；暂估400mm低台＋50mm软垫，待复尺。');
 const r=s.roomOverrides.living;r.title=s.id==='laundry'?'整墙收纳，低窗软垫':'低飘窗，铺上柔软';
 r.description=(s.id==='laundry'?'东侧B书架与C门框齐平，原A洗烘方案保留。':'电视仍在北侧实墙，原客餐厅布局保留。')+summary;
 r.features=['暂估400＋50mm','可拆洗分片坐垫','不向客厅外扩'];
}
await save('models/design-schemes.json',catalog);
console.log('V3.4.2: four low living bays; 400 + 50 mm explicitly estimated, all unrelated geometry preserved.');
