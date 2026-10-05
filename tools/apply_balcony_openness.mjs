// Correct the observed enclosure, not a proposal to demolish structural walls.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..');
const baseline='f9f4cb94ecf2bbdc39ab6e6ba086956081457c27';
const version='3.12.0';
const old=p=>JSON.parse(execFileSync('git',['show',`${baseline}:${p}`],{cwd:root,maxBuffer:32e6}));
const write=(p,d)=>fs.writeFileSync(path.join(root,p),JSON.stringify(d,null,2)+'\n');
const catalog=old('models/design-schemes.json');
const conditions=[
  '本次纠正阳台北、东两面被画成整面实墙的错误：按业主照片表达下部矮墙、上部通透防护开口，保留边柱及顶梁；不是新拆墙或拆护栏方案。',
  '矮墙高1100mm、开口高1350mm、上口2450mm均暂按照片估算；总高2700mm沿用旧模型。开口水平范围沿旧模型端点，不是实测净宽。',
  '防护框、竖杆和间距仅为存在性示意，不作为防坠、承重、安装或规范验收依据；梁柱、矮墙、防护及排水管不得据模型擅改。',
  '北侧借厅短墙仍保留；东面仅阳台段通透，厨房东墙、厨房与阳台内窗、生活阳台门及洗烘设备位置均不变。',
  '未增加封窗玻璃、柜体或背景景观。窗外楼栋、管线及实际遮挡以现场为准，不承诺无遮拦远景。'
];
const opening=(id,name,coords)=>({
  id,name,kind:'window',roomId:'balcony',connects:['balcony','outside'],
  windowType:'guarded-open-air',glazing:false,
  x1:coords[0],y1:coords[1],x2:coords[2],y2:coords[3],
  widthMm:Math.hypot(coords[2]-coords[0],coords[3]-coords[1])*10,
  sillCm:110,heightCm:135,grade:'C',dimensionsVerified:false,
  guard:{frameCm:2,barWidthCm:1.2,nominalSpacingCm:10,status:'schematic-not-engineered'},
  source:'2026-10-05业主标注图与阳台实景确认北、东两面上部通透；开口尺寸和标高暂估，不是实测。',
  notes:'保留下方矮墙、边柱、顶梁及防护示意；无玻璃、无新增遮挡柜。不是拆改施工图。'
});
for(const scheme of catalog.schemes){
  if(!['wood','family','laundry'].includes(scheme.id))continue;
  const file=`models/schemes/${scheme.id}/design-data.json`,d=old(file);
  const previous=d.woodRevision?.roomDescriptions?.balcony||d.familyPublicP2Revision?.roomDescriptions?.balcony||scheme.roomOverrides?.balcony||{};
  const baseDescription=typeof previous==='string'?previous:previous.description||'洗烘落地并排，上方独立承重浅盆；南侧厨房内窗和西侧通往客厅的门保留。';
  d.version=version;
  d.windows.push(opening('balcony_north_opening','生活阳台北向通透开口（矮墙及防护保留；尺寸暂估）',[687,960,829,960]),opening('balcony_east_opening','生活阳台东向通透开口（矮墙及防护保留；尺寸暂估）',[835,966,835,1115]));
  d.balconyOpennessRevision={
    id:'balcony-two-sided-open-20261005',version,baselineCommit:baseline,
    topologyConfirmedByOwner:true,dimensionsVerified:false,constructionApproved:false,
    evidenceFiles:['188e6af399cb806e2e2453d96a983d86.png','33082a0817245f15ae9db5cb51f6cde4.jpg'],
    openingIds:['balcony_north_opening','balcony_east_opening'],
    northWall:[681,960,835,960],eastWall:[835,960,835,1395],
    estimatedSillCm:110,estimatedOpeningHeightCm:135,estimatedOpeningTopCm:245,
    originalWallHeightCm:270,conditions,
    roomDescriptions:{balcony:{title:'北东通透，洗烘如旧',description:baseDescription+' 北、东两面改正为矮墙上通透开口，保留防护、边柱和顶梁，不增封窗玻璃；标高及宽度暂估待复尺。',features:['北、东双面通透','保留矮墙与防护','开口标高暂估']}}
  };
  d.geometryNotes=[...(d.geometryNotes||[]),conditions[0],conditions[1]];
  write(file,d);
  scheme.assetRevision=version;
  scheme.balconyOpennessRevision=version;
  scheme.roomOverrides={...scheme.roomOverrides,balcony:d.balconyOpennessRevision.roomDescriptions.balcony};
}
catalog.version=version;
catalog.updatedAt='2026-10-05';
catalog.balconyOpennessNote=conditions[0]+' '+conditions[1];
write('models/design-schemes.json',catalog);
console.log('Applied balcony openness V3.12.0 to wood/family/laundry; all prior walls, windows, furniture and equipment preserved.');
