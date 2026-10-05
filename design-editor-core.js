// Browser-local, centimetre-based design drafts. These checks are schematic
// collision screening, never construction, structural or accessibility approval.
export const DRAFT_SCHEMA=1;
export const COLOR_KEYS=Object.freeze(['wall','floor','cabinet','wood','fabric','accent']);
export const MAX_OFFSET_CM=2000;
export const MAX_DRAFT_BYTES=131072;
const EPS=1e-7,UNSAFE=new Set(['__proto__','prototype','constructor']);
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const positive=value=>finite(value)&&value>0;
const safeKey=value=>typeof value==='string'&&value.length>0&&value.length<=240&&!UNSAFE.has(value)&&!/[\u0000-\u001f\u007f]/.test(value);
const copy=value=>JSON.parse(JSON.stringify(value));
const error=(code,message,key)=>({code,message,...(key?{key}:{})});
const rectOK=f=>f&&finite(f.x)&&finite(f.y)&&positive(f.w)&&positive(f.d);
const entries=value=>Object.entries(value||{});
const ownKeysOnly=(value,keys)=>Object.keys(value).every(key=>keys.includes(key)&&!UNSAFE.has(key));
const contextError=context=>!context||!safeKey(context.schemeId)||!safeKey(context.sourceFingerprint)||!Array.isArray(context.data?.furniture);

export function furnitureKey(f){return f?.id||`name:${f?.name}`;}

export function isMovableFurniture(f){
  if(!rectOK(f)||!safeKey(furnitureKey(f))||!finite(f.a??0)||Math.abs(f.a??0)>EPS)return false;
  if(['storageFitoutId','kitchenFitoutId','laundryFitoutId','garageFitoutId','wallFitoutId','bayFitoutId'].some(key=>f[key]))return false;
  if(['sanitary','wet','wall','cabinet','metal'].includes(f.tone))return false;
  const name=String(f.name||''),id=String(f.id||'');
  if(id==='study_full_desk'||/衣柜|餐边柜|书架|书柜|浴室柜|电视.*柜|玄关柜|储物|收纳|浅台|台面|通长|连续|烟道|冰箱|洗衣|烘干|洗碗|马桶|淋浴|热水|炉灶|水槽|洗手|飘窗/.test(name))return false;
  if(/床头柜/.test(name)||f.woodRole==='nightstand')return true;
  if(/柜|定制|固定/.test(name)&&!f.purchasedProductId)return false;
  return ['sofa','table','chair'].includes(f.productKey)||['compact-desk','chair','study-sofa'].includes(f.woodRole)||/床|沙发|餐桌|茶几|椅|小书桌|小桌/.test(name);
}

function point(value){
  const result=Array.isArray(value)?{x:value[0],y:value[1]}:{x:value?.x,y:value?.y};
  if(!finite(result.x)||!finite(result.y))throw new TypeError('点坐标须为有限的厘米数值');
  return result;
}
export function measurePoints(a,b){a=point(a);b=point(b);const dx=b.x-a.x,dy=b.y-a.y;return{distanceMm:Math.hypot(dx,dy)*10,horizontalMm:Math.abs(dx)*10,verticalMm:Math.abs(dy)*10};}
export function polygonAreaM2(points){
  if(!Array.isArray(points)||points.length<3)return 0;const p=points.map(point);
  return Math.abs(p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a.x*b.y-b.x*a.y;},0))/20000;
}
function pointOnSegment(p,a,b){const dx=b.x-a.x,dy=b.y-a.y;return Math.abs((p.x-a.x)*dy-(p.y-a.y)*dx)<=EPS*Math.max(1,Math.hypot(dx,dy))&&p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;}
function inside(p,polygon){
  let result=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[j],b=polygon[i];if(pointOnSegment(p,a,b))return true;
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)result=!result;
  }return result;
}
function cross(a,b){return a.x*b.y-a.y*b.x;}
function cutParameter(a,b,c,d){
  const r={x:b.x-a.x,y:b.y-a.y},s={x:d.x-c.x,y:d.y-c.y},q={x:c.x-a.x,y:c.y-a.y},den=cross(r,s);
  if(Math.abs(den)<EPS)return[];const t=cross(q,s)/den,u=cross(q,r)/den;
  return t>-EPS&&t<1+EPS&&u>-EPS&&u<1+EPS?[Math.max(0,Math.min(1,t))]:[];
}
export function footprintInsideEnvelope(f,envelope){
  if(!rectOK(f)||!Array.isArray(envelope)||envelope.length<3)return false;
  let polygon;try{polygon=envelope.map(point);}catch{return false;}
  const corners=[{x:f.x,y:f.y},{x:f.x+f.w,y:f.y},{x:f.x+f.w,y:f.y+f.d},{x:f.x,y:f.y+f.d}];
  if(corners.some(p=>!inside(p,polygon)))return false;
  // Split every rectangle edge at polygon crossings. Corners alone would
  // incorrectly accept a rectangle bridging an L-shaped exterior notch.
  for(let i=0;i<4;i++){
    const a=corners[i],b=corners[(i+1)%4],ts=[0,1];
    for(let j=0;j<polygon.length;j++)ts.push(...cutParameter(a,b,polygon[j],polygon[(j+1)%polygon.length]));
    ts.sort((x,y)=>x-y);for(let j=1;j<ts.length;j++){const t=(ts[j-1]+ts[j])/2;if(!inside({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},polygon))return false;}
  }
  return true;
}

function knownHeight(f){return positive(f.heightCm)?f.heightCm:positive(f.hCm)?f.hCm:null;}
const modelNote='模型示意尺寸，非现场复尺或施工依据；尺寸与活动净空仍须核验。';
function info(type,item,index){
  const key=type==='furniture'?furnitureKey(item):item.id||`${type}:${index}`;
  const result={type,key,label:item.displayName||item.name||item.id||`${type} ${index+1}`,name:item.name||item.id||'',movable:type==='furniture'&&isMovableFurniture(item),locked:type!=='furniture'||!isMovableFurniture(item),lockedReason:type==='furniture'?(isMovableFurniture(item)?'':'定制、固定设施或未确认的家具仅供查看，不支持移动。'):'房间、墙体、门窗仅可量测；本编辑器不修改建筑结构。',dimensionsMm:{},note:modelNote,notes:item.notes||''};
  if(type==='furniture'){
    Object.assign(result,{x:item.x,y:item.y,w:item.w,d:item.d});
    if(positive(item.w))result.dimensionsMm.width=item.w*10;if(positive(item.d))result.dimensionsMm.depth=item.d*10;
    const h=knownHeight(item);if(h!==null)result.dimensionsMm.height=h*10;
    else result.heightUnknown=true;
  }else if(type==='room'){
    const p=item.points.map(point),xs=p.map(q=>q.x),ys=p.map(q=>q.y),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,d=Math.max(...ys)-y;
    Object.assign(result,{points:item.points.map(q=>Array.isArray(q)?[...q]:{...q}),x,y,w,d,areaM2:polygonAreaM2(item.points),edgeLengthsMm:p.map((q,i)=>measurePoints(q,p[(i+1)%p.length]).distanceMm)});
    result.dimensionsMm={width:w*10,depth:d*10};result.note='宽、深为多边形包围框，不是房间净宽；面积按模型多边形计算，不是产权或实测面积。';
  }else{
    const {x1,y1,x2,y2}=item;Object.assign(result,{x1,y1,x2,y2});result.dimensionsMm.length=measurePoints([x1,y1],[x2,y2]).distanceMm;
    if(positive(item.heightCm))result.dimensionsMm.height=item.heightCm*10;if(finite(item.sillCm)&&item.sillCm>=0)result.dimensionsMm.sill=item.sillCm*10;
    result.grade=item.grade;result.note=modelNote+' 洞口长度不等于安装后净通行宽度。';
  }return result;
}
function equipmentSelections(data){
  const names={fridge:'厨房冰箱',dishwasher:'嵌入式洗碗机',doubleSink:'厨房双槽水槽',gasHob:'煤气灶',hood:'抽油烟机',waterHeater:'热水器',faucet:'厨房龙头'};
  const appliance=(data.kitchenFitout?.appliances||[]).map((item,index)=>({...item,id:'equipment:'+(item.id||'kitchen:'+index),name:item.name||names[item.type]||'厨房设备',kitchenFitoutId:data.kitchenFitout.id||'kitchen'}));
  // Scheme one uses one aggregate laundry footprint; expose its two real
  // machines separately without adding duplicates to the other schemes.
  const existing=new Set((data.furniture||[]).map(f=>f.id));
  const machines=(data.laundry?.machines||[]).filter(item=>!existing.has(item.id)).map((item,index)=>({...item,id:'equipment:'+(item.id||'laundry:'+index),name:item.name||'洗烘设备',laundryFitoutId:data.laundry.id||'laundry'}));
  return[...appliance,...machines].filter(rectOK).map((item,index)=>{
    const result=info('furniture',item,index);result.equipment=true;result.movable=false;result.locked=true;result.lockedReason='设备位置锁定；只查看设备外包尺寸，不代表安装及散热净空。';
    result.note=item.dimensionStatus==='user-confirmed-body'?'用户提供的机身尺寸；设备安装、开门、散热与管线余量另核。':item.dimensionStatus==='reference-only'?'参考型号占位，最终选型和安装净空待核。':modelNote;
    return result;
  });
}
export function listSelections(data){return[...['furniture','room','door','window'].flatMap(type=>((data[{furniture:'furniture',room:'rooms',door:'doors',window:'windows'}[type]]||[]).map((item,index)=>info(type,item,index)))),...equipmentSelections(data)];}
export function selectionInfo(data,selection){return listSelections(data).find(item=>item.type===selection?.type&&item.key===selection?.key)||null;}

function canonical(value){if(Array.isArray(value))return'['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}
// Fallback identity only. Prefer the published manifest.sourceSha256 supplied
// by the caller; neither fingerprint provides authentication for a local draft.
export function sourceFingerprint(data){let h=0xcbf29ce484222325n;for(const c of canonical(data)){h^=BigInt(c.codePointAt(0));h=BigInt.asUintN(64,h*0x100000001b3n);}return'source-v1:'+h.toString(16).padStart(16,'0');}
export function createDraft(schemeId,fingerprint){if(!safeKey(schemeId)||!safeKey(fingerprint))throw new TypeError('方案及来源指纹不能为空');return{schema:DRAFT_SCHEMA,schemeId,sourceFingerprint:fingerprint,offsets:{},colors:{}};}
export function draftStorageKey(schemeId){if(!safeKey(schemeId))throw new TypeError('无效方案标识');return'house-design:editor-draft:v1:'+encodeURIComponent(schemeId);}

export function validateDraft(value,context){
  const errors=[];
  if(contextError(context))return{ok:false,draft:null,errors:[error('context','缺少方案、来源指纹或基线家具数据。')]};
  if(!plain(value)||!ownKeysOnly(value,['schema','schemeId','sourceFingerprint','offsets','colors']))return{ok:false,draft:null,errors:[error('shape','草稿结构无效或含未知字段。')]};
  if(value.schema!==DRAFT_SCHEMA)errors.push(error('schema','草稿版本不兼容，未恢复。'));
  if(value.schemeId!==context.schemeId)errors.push(error('scheme','草稿属于其他方案，未恢复。'));
  if(value.sourceFingerprint!==context.sourceFingerprint)errors.push(error('fingerprint','正式模型已更新，旧草稿不自动套用；请清除后重新编辑。'));
  if(!plain(value.offsets)||!plain(value.colors))errors.push(error('shape','草稿偏移或配色格式无效。'));
  if(errors.length)return{ok:false,draft:null,errors};
  const registry=new Map();for(const f of context.data.furniture){const key=furnitureKey(f);if(registry.has(key))errors.push(error('duplicate','基线家具标识重复，不能安全恢复。',key));registry.set(key,f);}
  const draft=createDraft(context.schemeId,context.sourceFingerprint);
  for(const [key,offset]of entries(value.offsets)){
    const f=registry.get(key);
    if(!safeKey(key)||!f){errors.push(error('unknown-furniture','草稿含未知或无效家具标识。',key));continue;}
    if(!isMovableFurniture(f)){errors.push(error('locked','固定设施或定制家具不能移动。',key));continue;}
    if(!plain(offset)||!ownKeysOnly(offset,['dx','dy'])||!finite(offset.dx)||!finite(offset.dy)){errors.push(error('offset','家具偏移必须是有限的厘米数值。',key));continue;}
    if(Math.abs(offset.dx)>MAX_OFFSET_CM||Math.abs(offset.dy)>MAX_OFFSET_CM){errors.push(error('offset-range','家具偏移超出编辑范围。',key));continue;}
    if(!footprintInsideEnvelope({...f,x:f.x+offset.dx,y:f.y+offset.dy},context.data.envelope)){errors.push(error('outside','家具完整占地超出户型外轮廓，不能应用。',key));continue;}
    if(offset.dx!==0||offset.dy!==0)draft.offsets[key]={dx:offset.dx,dy:offset.dy};
  }
  for(const [key,color]of entries(value.colors)){
    if(!COLOR_KEYS.includes(key)||typeof color!=='string'||!/^#[0-9a-f]{6}$/i.test(color)){errors.push(error('color','仅支持六个材质类别的六位十六进制颜色。',key));continue;}
    draft.colors[key]=color.toLowerCase();
  }
  return{ok:errors.length===0,draft:errors.length?null:draft,errors};
}
function validationContext(baseline,draft,context){return{schemeId:context?.schemeId??draft?.schemeId,sourceFingerprint:context?.sourceFingerprint??draft?.sourceFingerprint,data:baseline};}
export function deriveData(baseline,draft,context){
  const valid=validateDraft(draft,validationContext(baseline,draft,context));
  if(!valid.ok){const e=new Error(valid.errors.map(e=>e.message).join(' '));e.code='INVALID_DESIGN_DRAFT';e.details=valid.errors;throw e;}
  const result=copy(baseline);for(const f of result.furniture){const p=valid.draft.offsets[furnitureKey(f)];if(p){f.x+=p.dx;f.y+=p.dy;}}
  return result;
}
function storageError(){return{ok:false,status:'unavailable',draft:null,errors:[error('storage','当前浏览器无法访问本机存储；草稿未保存或恢复，请勿依赖刷新后保留。')]};}
export function loadDraft(storage,context){
  if(contextError(context))return{ok:false,status:'invalid',draft:null,errors:[error('context','缺少方案或来源指纹。')]};
  let raw;try{raw=storage.getItem(draftStorageKey(context.schemeId));}catch{return storageError();}
  if(raw===null)return{ok:true,status:'empty',draft:null,errors:[]};
  if(typeof raw!=='string'||raw.length>MAX_DRAFT_BYTES)return{ok:false,status:'invalid',draft:null,errors:[error('payload','本机草稿过大或不是文本，未恢复。')]};
  let parsed;try{parsed=JSON.parse(raw);}catch{return{ok:false,status:'invalid',draft:null,errors:[error('json','本机草稿损坏，未恢复。')]};}
  const result=validateDraft(parsed,context);return{...result,status:result.ok?'loaded':result.errors.some(e=>e.code==='fingerprint')?'fingerprint-mismatch':'invalid'};
}
export function saveDraft(storage,draft,context){
  const result=validateDraft(draft,context);if(!result.ok)return{...result,status:'invalid'};
  const text=JSON.stringify(result.draft);if(text.length>MAX_DRAFT_BYTES)return{ok:false,status:'invalid',draft:null,errors:[error('payload','本机草稿超出保存大小限制。')]};
  try{storage.setItem(draftStorageKey(context.schemeId),text);return{...result,status:'saved'};}catch{return storageError();}
}
export function clearDraft(storage,schemeId){try{storage.removeItem(draftStorageKey(schemeId));return{ok:true,status:'cleared',draft:null,errors:[]};}catch{return storageError();}}

const overlaps=(a,b)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>EPS&&Math.min(a.y+a.d,b.y+b.d)-Math.max(a.y,b.y)>EPS;
function wallSolids(data){
  const result=[];for(const [index,raw]of (data.walls||[]).entries()){
    const c=raw.coords||raw,[x1,y1,x2,y2]=c,horizontal=Math.abs(y1-y2)<EPS;
    if(!horizontal&&Math.abs(x1-x2)>=EPS)continue;
    const spec=data.wallSpecs?.find(s=>s.coords?.every((v,i)=>v===c[i])),thick=spec?.thicknessCm??12,start=Math.min(horizontal?x1:y1,horizontal?x2:y2),end=Math.max(horizontal?x1:y1,horizontal?x2:y2),fixed=horizontal?y1:x1;
    const openings=(data.doors||[]).filter(d=>(d.sillCm??0)<10&&Math.abs((horizontal?d.y1:d.x1)-fixed)<EPS&&Math.abs((horizontal?d.y2:d.x2)-fixed)<EPS).map(d=>[Math.min(horizontal?d.x1:d.y1,horizontal?d.x2:d.y2),Math.max(horizontal?d.x1:d.y1,horizontal?d.x2:d.y2)]).filter(([a,b])=>a>=start-EPS&&b<=end+EPS).sort((a,b)=>a[0]-b[0]);
    const add=(a,b)=>{if(b>a+EPS)result.push({key:'wall:'+index,x:horizontal?a:fixed-thick/2,y:horizontal?fixed-thick/2:a,w:horizontal?b-a:thick,d:horizontal?thick:b-a});};let edge=start;
    for(const [a,b]of openings){add(edge,a);edge=Math.max(edge,b);}add(edge,end);
  }return result;
}
function warningsFor(data,f){
  const warnings=[],key=furnitureKey(f),seen=new Set(),add=(code,message,targetKey,details={})=>{const id=code+':'+targetKey;if(!seen.has(id)){seen.add(id);warnings.push({code,message,targetKey,...details});}};
  for(const wall of wallSolids(data))if(overlaps(f,wall))add('wall-overlap','与墙体投影重叠；请调整，不能视作可施工布置。',wall.key);
  for(const other of data.furniture){if(furnitureKey(other)===key||!rectOK(other))continue;const target=furnitureKey(other);
    if(overlaps(f,other)){add('furniture-overlap','与“'+other.name+'”占地投影重叠，需检查真实外包和使用空间。',target);continue;}
    const ox=Math.min(f.x+f.w,other.x+other.w)-Math.max(f.x,other.x),oy=Math.min(f.y+f.d,other.y+other.d)-Math.max(f.y,other.y);
    const gap=ox>EPS?Math.max(other.y-(f.y+f.d),f.y-(other.y+other.d)):oy>EPS?Math.max(other.x-(f.x+f.w),f.x-(other.x+other.w)):null;
    if(gap!==null&&gap>=0&&gap<60)add('clearance','与“'+other.name+'”示意间距低于600mm；不是通行规范判定，请核对动线。',target,{gapMm:Math.max(0,gap)*10});
  }
  for(const door of data.doors||[]){
    const horizontal=Math.abs(door.y1-door.y2)<EPS,zone={x:Math.min(door.x1,door.x2)-(horizontal?0:40),y:Math.min(door.y1,door.y2)-(horizontal?40:0),w:Math.abs(door.x2-door.x1)+(horizontal?0:80),d:Math.abs(door.y2-door.y1)+(horizontal?80:0)};
    if(overlaps(f,zone)||door.operation?.openLeafCm&&overlaps(f,door.operation.openLeafCm))add('door-zone','靠近门口或门板投影；需复核开启和前后通行空间。',door.id);
  }
  return warnings;
}
export function validateMove(baseline,draft,key,offset,context){
  const ctx=validationContext(baseline,draft,context),initial=validateDraft(draft,ctx);
  if(!initial.ok)return{ok:false,errors:initial.errors,warnings:[],draft:null,data:null};
  const f=baseline.furniture.find(f=>furnitureKey(f)===key);
  if(!safeKey(key)||!f)return{ok:false,errors:[error('unknown-furniture','未找到此家具。',key)],warnings:[],draft:null,data:null};
  if(!isMovableFurniture(f))return{ok:false,errors:[error('locked','固定或定制家具不能移动。',key)],warnings:[],draft:null,data:null};
  const proposed=copy(initial.draft);proposed.offsets[key]=offset;
  const valid=validateDraft(proposed,ctx);if(!valid.ok)return{ok:false,errors:valid.errors,warnings:[],draft:null,data:null};
  const data=deriveData(baseline,valid.draft,ctx),moved=data.furniture.find(f=>furnitureKey(f)===key);
  return{ok:true,errors:[],warnings:warningsFor(data,moved),draft:valid.draft,data};
}
