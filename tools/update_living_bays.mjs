// Common, explicit furniture removal applied after the historical layout recipes.
// The photo is qualitative evidence, never a measuring scale.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const save=(p,d)=>writeFile(new URL(p,root),JSON.stringify(d,null,2)+'\n');
const ids=['wood','suite','family','laundry'],removed=['l_desktop','l_support','l_accessories','l_adult_chair','l_child_chair'];
const summary='客厅飘窗前的长桌、支架、桌面用品及两把椅子全部移除，窗前留空。保留窗体、原台体和已有薄饰面，不凭照片拆改或猜高度。现模型900mm台高是旧占位，并非照片实测；低台软垫休憩只作后续建议，尚未加建。';
const refs=[
 {id:'living-low-bay-ideas',title:'窗边卧榻：尺寸与软垫做法',platform:'100室内设计 · 案例汇编',url:'https://www.100.com.tw/article/1414',borrow:'参考可拆软垫、简洁窗边休憩位；常用坐面高度只作为试坐起点。',avoid:'网文不是本户量房或结构证明，不照搬台下柜和改台高度。'},
 {id:'living-window-child-safety',title:'让孩子尽情玩乐的空间 · 窗边安全',platform:'IKEA 官方安全指引',url:'https://www.ikea.com.tw/zh/safety-at-home/child/play',borrow:'避免窗边可攀爬家具，防坠与安全锁优先，窗帘避免可接触拉绳。',avoid:'不代替本户高层窗体、防护及限位的专业复核；不把纱窗当防坠。'}
];
for(const id of ids){
 const path=`models/schemes/${id}/design-data.json`,d=await read(path),f=d.bayFitouts.find(f=>f.roomId==='living');
 f.type='clear_ledge';f.title='客厅 · 窗前留白，低台待复尺';f.summary=summary;
 f.parts=f.parts.filter(p=>!removed.includes(p.id));
 f.dimensions=['原长桌2000×650mm及两把520×520mm椅已移除','客厅窗台模型暂仍为900mm旧占位，照片显示更低，实高待量','原窗体、台体和薄饰面保留；不增加地台或窗前柜'];
 f.conditions=['先量完成地面至台面高度、台面净深、有效长度及窗扇扫掠范围，再决定软垫厚度。','优先考虑原台加可拆洗薄垫及少量靠垫，不抬高、不外挑。仅为成人短时休憩建议，未在本次模型中实施。','家有幼童：专业核对防坠、护栏、开窗限位及无绳窗帘后再决定是否设坐席；纱窗不能替代防坠。','不能从白色立面判断台下是否空心；不预设可挖空做抽屉或可拆原台。','先排查窗框渗水、返潮与石材边缘，再选透气、可拆洗材料；靠垫不得依靠玻璃受力。'];
 f.references=refs.map(r=>r.id);
 d.designReferences=[...d.designReferences.filter(r=>!refs.some(n=>n.id===r.id)),...refs];
 d.livingBayRevision={version:'3.4.1',removedPartIds:removed,measured:false,photoObservation:'用户2026-09-26照片显示客厅飘窗较低；照片无可靠尺寸标定。',sillHeightStatus:'unmeasured-legacy-placeholder',scope:'只移除窗前工作家具；不改变原窗和台体。'};
 d.version=`3.4.1 · ${id} · 客厅窗前留白`;
 if(d.renovationNotes)for(const n of d.renovationNotes)if(n.roomId==='living'&&!n.text.includes(summary)){
  n.text=n.text.replace('客厅学习桌与玄关7字柜保留；成人椅沿用向南150mm的位置。','玄关7字柜保留。')+' '+summary;
 }
 d.geometryNotes=[...(d.geometryNotes||[]).filter(n=>!n.startsWith('V3.4.1')),'V3.4.1：'+summary];
 await save(path,d);
}
// Parent hashes describe current, identically cleared source layouts.
const hash=async p=>createHash('sha256').update((await readFile(new URL(p,root),'utf8')).replaceAll('\r\n','\n')).digest('hex');
for(const id of ['family','laundry']){const p=`models/schemes/${id}/design-data.json`,d=await read(p);d.layout.parentSourceSha256=await hash(d.layout.parentSource);await save(p,d);}
for(const id of ['wood','laundry']){const p=`models/schemes/${id}/design-data.json`,d=await read(p);if(d.kitchenReference?.source)d.kitchenReference.sourceSha256=await hash(d.kitchenReference.source);await save(p,d);}
const c=await read('models/design-schemes.json');c.version='3.4.1';c.updatedAt='2026-09-26';
for(const s of c.schemes){
 s.assetRevision='3.4.1';if(!s.summary.includes('客厅窗前桌椅已全部移除'))s.summary=s.summary.replace(/V3\.4\.0仅将/,'厨房更新已将')+' 客厅窗前桌椅已全部移除；台高待复尺。';
 s.roomOverrides??={};const r=s.roomOverrides.living||{};
 r.title=s.id==='laundry'?'整墙收纳，窗前留白':'客厅窗前留白';
 if(!r.description?.includes(summary))r.description=(r.description||'电视保留北侧实墙，客厅与餐区布局保留。').replace('客厅成人活动椅沿用南移150mm的位置。','')+' '+summary;
 r.features=['飘窗前不设桌椅','原台高待实测',...(s.id==='laundry'?['B书架与C门框齐平']:['原窗体保留'])];s.roomOverrides.living=r;
}
await save('models/design-schemes.json',c);
console.log('V3.4.1: cleared five living-bay work-furniture parts in four layouts; no window/sill dimensions changed.');
