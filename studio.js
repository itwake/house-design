import {loadSchemeCatalog,resolveScheme,schemeRender} from './schemes.js?v=3.11.0';
import {buildWalkWorld,findWalkStart,WalkController,WALK_STARTS,isWalkDoorInfill} from './walkthrough.js?v=3.11.0';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const UI_REVISION = '3.11.0';
document.documentElement.dataset.uiRevision = UI_REVISION;
let ASSET_REVISION = '3.11.0';
const revisedAsset = path => {const url=new URL(path,document.baseURI);url.searchParams.set('v',ASSET_REVISION);return url.href};
const icons = {
  cube:'<path d="m8 2 6 3.5v5L8 14l-6-3.5v-5L8 2Z M2 5.5 8 9l6-3.5 M8 9v5 M5 3.8l6 3.5"/>',
  plan:'<path d="M2 2h12v12H2z M2 8h5V2 M7 11v3 M10 8h4"/>',
  image:'<rect x="2" y="2" width="12" height="12" rx="1"/><path d="m2 11 4-4 3 3 2-2 3 3"/><circle cx="10.5" cy="5.5" r="1"/>',
  info:'<circle cx="8" cy="8" r="6"/><path d="M8 7v4 M8 4.5v.3"/>',
  download:'<path d="M8 2v8 m-3-3 3 3 3-3 M2 10v4h12v-4"/>',
  expand:'<path d="M6 2H2v4 M10 2h4v4 M14 10v4h-4 M6 14H2v-4"/>',
  reset:'<path d="M3 5a5.5 5.5 0 1 1-1 5 M2 2v4h4"/>',
  minus:'<path d="M3 8h10"/>', plus:'<path d="M3 8h10 M8 3v10"/>',
  walls:'<path d="M2 14V5l6-3 6 3v9 M2 9l6 3 6-3 M8 2v10"/>',
  label:'<path d="M2 3h12v8H9l-3 3v-3H2z M5 6h6 M5 8h4"/>',
  ruler:'<path d="m2 11 9-9 3 3-9 9z M8 5l2 2 M5 8l2 2"/>',
  close:'<path d="m3 3 10 10 M3 13 13 3"/>',
  sofa:'<path d="M3 7V4h10v3 M2 7h2v4h8V7h2v6H2z M3 13v1 M13 13v1"/>',
  dining:'<path d="M3 6h10v2H3z M5 8v6 M11 8v6 M1 5v6h3 M15 5v6h-3"/>',
  bed:'<path d="M2 13V5h12v8 M2 9h12 M4 9V6h3v3 M9 9V6h3v3 M2 12h12"/>',
  study:'<path d="M2 8h12 M3 8v6 M13 8v6 M5 3h6v5H5z M10 11h2"/>',
  kitchen:'<path d="M2 3h12v11H2z M2 7h12 M7 7v7 M10 5h2 M4 9v2"/>',
  bath:'<path d="M2 8h12v2a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V8Z M3 8V4a2 2 0 0 1 4 0 M4 13v1 M12 13v1"/>',
  leaf:'<path d="M4 13C2 6 6 2 14 2c0 8-4 11-10 11Z M3 14l7-7"/>'
};
const icon = (name) => `<svg viewBox="0 0 16 16" aria-hidden="true">${icons[name] || icons.cube}</svg>`;
$$('[data-icon]').forEach(el => el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)));
const descriptions = {
  overall:{name:'全屋概览',en:'THE ENTIRE HOME',title:'木色里的日常',icon:'cube',render:'overall',description:'浅橡木、暖白与柔和织物串起三房两卫。恢复完整客餐厅，让自然光在家中连贯流动。',features:['现代原木','三房两卫','同源模型']},
  living:{name:'客厅',en:'LIVING ROOM',title:'低飘窗，铺上柔软',icon:'sofa',render:'living',description:'客厅暂估400mm低台＋50mm可拆软垫，坐面约450mm；不外扩、不加桌椅，尺寸待量房。',features:['暂估400＋50mm','分片软垫','不向客厅外扩']},
  dining:{name:'玄关 · 餐厅',en:'ENTRY & DINING',title:'把回家与围坐，收得妥帖',icon:'dining',render:'dining',description:'进门东侧右手鞋柜面向西；西墙餐柜向南墙转折成7字。鞋与杯盘分开收纳，开放台面连接日常饮品操作；分段尺寸、盲角与通行动线仍需现场复核。',features:['右手鞋柜','7字餐柜','转角盲区复核']},
  room_a:{name:'主卧',en:'MASTER BEDROOM',title:'把喧嚣留在窗外',icon:'bed',render:'master',description:'柔和床头与浅木柜体营造安静背景，保留床侧通行。北窗的隔声与遮光，是舒适睡眠的重点。',features:['1500 mm 床','亚麻触感','北向采光']},
  room_b:{name:'次卧 B',en:'SECOND BEDROOM',title:'让睡眠与茶歇更从容',icon:'bed',render:'bedroom-b',description:'保留紧凑床、衣柜与条件飘窗茶座，取消独立书桌和办公椅。卧室入口保持通行，浅色材质减轻压迫感。',features:['1350 mm 床','条件茶座','不设独立书桌']},
  room_c:{name:'书房 · 客卧',en:'STUDY & GUEST',title:'一个人的安静时刻',icon:'study',render:'study',description:'独立日床与书桌适应工作、阅读和偶尔留宿。紧凑尺度用轻巧家具表达，西窗为书房引入自然光。',features:['独立日床','灵活使用','西侧窗光']},
  kitchen:{name:'厨房',en:'KITCHEN',title:'让料理有条不紊',icon:'kitchen',render:'kitchen',description:'沿原厨房湿区组织操作台和电器，暖白柜门搭配浅木。门洞由900拓至1700mm，三扇三轨玻璃门向北叠停；模型净开约1033mm，五金深化后约1000mm为目标。扩洞与门套需现场核验。',features:['1700mm条件门洞','三扇三轨推拉','约1033mm模型净开']},
  bath_1:{name:'主卫',en:'MAIN BATHROOM',title:'石色里的松弛',icon:'bath',render:'master-bath',description:'浅暖石材统一小空间，浴室柜、马桶和淋浴依阶梯边界布置，用镜面和均匀灯光增加清爽感。',features:['主卧套内','暖色石材','阶梯边界']},
  bath_2:{name:'客卫',en:'GUEST BATHROOM',title:'小空间，也要好用',icon:'bath',render:'guest-bath',description:'西北扩出的盆位安排浅盆柜，保留紧凑马桶与东侧淋浴。轻薄屏风和浅色砖让功能完整，卫浴选型需现场复核。',features:['凹位浅盆柜','阶梯边界','轻薄淋浴屏']},
  balcony:{name:'家政阳台',en:'UTILITY BALCONY',title:'把琐碎收得漂亮',icon:'leaf',render:'balcony',description:'洗烘与家政收纳集中在原阳台。浅木柜面呼应室内，预留维护、开门及日常操作空间。',features:['洗烘叠放','家政收纳','日常留白']}
};
const order = Object.keys(descriptions);
const state = {room:'overall',view:'model',cutWalls:true,labels:true,dimensions:false,interior:false,walking:false,ready:false,roomCardVisible:true,diningClosed:false};
const ROOM_CARD_STORAGE_KEY = 'house-design:room-card-visible';
let data, manifest, scheme, schemeCatalog, rooms = [], three, scene, camera, renderer, controls, model, cameraTween, defaultDistance=20, resizeObserver, dimensionLines, activeHorizontalFov=null, pendingFrame=null;
let metadataOnlyRenderProof=null;
const wallMaterials=[], roomLabelNodes=[], dimensionNodes=[];
let walkthrough=null,walkWorld=null,walkRestore=null,walkThresholds=null;
const walkDoorParts=[],walkSlidingParts=[];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const toast = (message) => { $('#toast').textContent=message; $('#toast').classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),2700); };
const areaOf = points => Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1]},0))/2;
const centroid = points => [points.reduce((s,p)=>s+p[0],0)/points.length,points.reduce((s,p)=>s+p[1],0)/points.length];
const roomById = id => rooms.find(r=>r.id===id);
const roomDescription = id => descriptions[id] || descriptions.overall;
function purchasedRoomDescription(id){
  const note=data?.purchasedFurnitureRevision?.roomDescriptions?.[id];
  if(note)return typeof note==='string'?note:note.description||'';
  const items=(data?.furniture||[]).filter(f=>f.purchasedProductId&&(id==='living'?/沙发/.test(f.name):id==='dining'?/餐桌|餐椅/.test(f.name):false));
  const unique=[...new Set(items.map(f=>f.purchasedProductId))];
  const summary=unique.map(id=>{const product=purchasedProduct(id),f=items.find(item=>item.purchasedProductId===id),dim=product?.dimensionsMm;return `${product?.name||f.name}，${dim?[dim.width,dim.depth,dim.height].join('×'):[f.w*10,f.d*10,f.heightCm*10].join('×')}mm`}).join('；');
  return summary?[summary,measurementRoomDescription(id)].filter(Boolean).join('。'):'';
}
const schemeTextOverride=(overrides,id)=>Object.fromEntries(Object.entries(overrides?.[id]||{}).filter(([key])=>['title','description','summary','features'].includes(key)));
const renderPath = id => schemeRender(scheme,hasPulloutDining()&&state.diningClosed&&id==='dining'?'dining-closed':roomDescription(id).render);
const renderProvenance = view => {
  const record=manifest?.renderedViews?.[String(view).split('/').pop().split(/[?.]/)[0]],revision=data?.measurementRevision,purchased=data?.purchasedFurnitureRevision;
  const synchronized=!revision||(manifest?.measurementRevision?.date===revision.date&&manifest?.measurementRevision?.version===revision.version);
  const furnitureSynchronized=!purchased||manifest?.purchasedFurnitureRevision?.version===purchased.version;
  const textOnlyRefresh=metadataOnlyRenderProof&&!record?.retainedFrom&&record?.sourceSha256===metadataOnlyRenderProof.oldSourceSha256&&record?.baseBlendSha256===metadataOnlyRenderProof.nativeBlendSha256&&manifest?.baseBlendSha256===metadataOnlyRenderProof.nativeBlendSha256&&manifest?.sourceSha256===metadataOnlyRenderProof.currentSourceSha256;
  const inherited=record?.retainedFrom||(record?.sourceSha256&&manifest?.sourceSha256&&record.sourceSha256!==manifest.sourceSha256);
  const status=!synchronized?'复尺前参考图 · 本轮模型与渲染待同步':!furnitureSynchronized?'家具替换前参考图 · 已购家具模型与渲染待同步':textOnlyRefresh?'当前复尺模型渲染（仅文字随后修订）':inherited?'沿用历史模型图 · 本轮未重渲':revision&&!record?.sourceSha256?'效果图来源待核 · 不作为复尺结果':'当前模型重渲 · 条件设计，非施工图';
  return status+(revision?' · 仅局部复尺，非全屋实测':'');
};
// Accept old-source render records only when an explicit, reversible text-only
// change set proves the complete current source was otherwise unchanged.
// Actual native/image file hashes are additionally checked at publication.
async function validateMetadataOnlySourceRefresh(source,sourceManifest){
  try{
    const proof=sourceManifest?.metadataOnlySourceRefresh;
    if(!proof||!Array.isArray(source?.windows)||!Array.isArray(proof.changes)||!proof.changes.length||!globalThis.crypto?.subtle)return null;
    const sha=value=>typeof value==='string'&&/^[a-f\d]{64}$/.test(value);
    if(!['oldSourceSha256','currentSourceSha256','nativeBlendSha256','nativeGlbSha256'].every(key=>sha(proof[key])))return null;
    if(proof.oldSourceSha256===proof.currentSourceSha256||sourceManifest.sourceSha256!==proof.currentSourceSha256||sourceManifest.baseBlendSha256!==proof.nativeBlendSha256)return null;
    const mesh=proof.meshStateBeforeAndAfter;
    if(!mesh||!sha(mesh.sha256)||!Number.isInteger(mesh.meshObjects)||mesh.meshObjects<=0||!Number.isInteger(mesh.meshDatablocks)||mesh.meshDatablocks<=0)return null;
    const restored=JSON.parse(JSON.stringify(source)),windows=new Map(restored.windows.map(window=>[window.id,window]));
    if(windows.size!==restored.windows.length)return null;
    const allowedFields=new Set(['name','designScenario']),allowedKeys=new Set(['window','field','beforePresent','before','afterPresent','after']),seen=new Set(),owns=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
    for(const change of proof.changes){
      if(!change||Object.keys(change).some(key=>!allowedKeys.has(key))||typeof change.window!=='string'||!allowedFields.has(change.field)||typeof change.beforePresent!=='boolean'||typeof change.afterPresent!=='boolean')return null;
      if(change.beforePresent?typeof change.before!=='string':owns(change,'before'))return null;
      if(change.afterPresent?typeof change.after!=='string':owns(change,'after'))return null;
      const window=windows.get(change.window),key=change.window+'|'+change.field;
      if(!window||seen.has(key)||owns(window,change.field)!==change.afterPresent||(change.afterPresent&&window[change.field]!==change.after))return null;
      seen.add(key);
      if(change.beforePresent)window[change.field]=change.before;else delete window[change.field];
    }
    const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value,null,2)+'\n'))),byte=>byte.toString(16).padStart(2,'0')).join('');
    const [currentHash,oldHash]=await Promise.all([digest(source),digest(restored)]);
    if(currentHash!==proof.currentSourceSha256||oldHash!==proof.oldSourceSha256)return null;
    return Object.freeze({oldSourceSha256:oldHash,currentSourceSha256:currentHash,nativeBlendSha256:proof.nativeBlendSha256,nativeGlbSha256:proof.nativeGlbSha256});
  }catch{return null}
}
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
async function getJSON(url){const response=await fetch(revisedAsset(url));if(!response.ok)throw new Error(`${url}: ${response.status}`);return response.json()}
async function getDesignData(){return getJSON(scheme?.geometrySource||schemeCatalog?.geometrySource||'models/design-data.json')}

function measurementDisplayCopy(text){
  if(!data?.measurementRevision)return text;
  if(text==='客厅↔阳台开门为拟改造方案，现有模型西侧玻璃门不代表原结构。原门封墙改窗的具体边界待确认是否为厨房↔阳台；未确认前不新增该窗。')return '客厅↔阳台开门及厨房↔阳台大窗均为拟改造方案，模型开口不代表原结构。厨房大窗已纳入设计，原门封墙、墙体可拆性、洞口边界及防水收口仍须现场与专业结构核验，不能据模型施工。';
  if(text==='所有尺寸为现有模型中的条件推演，不是量房成果或施工图。')return '家政设备与柜体尺寸为现有模型中的条件推演，不是量房成果或施工图；已采用的局部窗尺寸与待核墙线另见复尺明细。';
  return text;
}
function sourceNotes(value,roomId=null){
  if(typeof value==='string')return value.trim()?[{text:measurementDisplayCopy(value.trim()),roomId}]:[];
  if(Array.isArray(value))return value.flatMap(note=>sourceNotes(note,roomId));
  if(value&&typeof value==='object'){
    const text=value.text||value.note||value.description||value.message||value.title;
    if(typeof text==='string')return [{text:(value.title&&value.title!==text?value.title+'：':'')+measurementDisplayCopy(text),roomId:value.roomId||roomId}];
    if('roomId' in value||'status' in value)return [];
    return Object.entries(value).flatMap(([key,note])=>sourceNotes(note,descriptions[key]?key:roomId));
  }
  return [];
}
function designNotes(){const seen=new Set();return [...sourceNotes(data?.renovationNotes),...sourceNotes(data?.geometryNotes),...sourceNotes(data?.woodRevision?[]:data?.purchasedFurnitureRevision?.layoutNotes)].filter(note=>{const key=note.roomId+'|'+note.text;if(seen.has(key))return false;seen.add(key);return true})}
function measurementRoomDescription(id){
  if(data?.familyPublicP2Revision?.roomDescriptions?.[id])return data.familyPublicP2Revision.roomDescriptions[id].description;
  if(data?.familyR3Revision?.roomDescriptions?.[id])return data.familyR3Revision.roomDescriptions[id].description;
  const revised=data?.measurementRevision?.roomDescriptions?.[id];if(!revised)return '';
  const layout=sourceNotes(data.renovationNotes).filter(note=>note.roomId===id).map(note=>note.text).join(' ');
  const measured=typeof revised==='string'?revised:revised.description||'';
  return layout&&measured&&!layout.includes(measured)?layout+' '+measured:layout||measured;
}
function measurementRoomNotice(id){
  const note=data?.measurementRevision?.roomDescriptions?.[id];
  return note&&typeof note==='object'&&typeof note.notice==='string'?note.notice:'';
}
function renderRoomMeasurementNotice(){
  const note=measurementRoomNotice(state.room);
  for(const id of ['card-measurement-warning','render-measurement-warning']){
    const node=document.getElementById(id);if(node){node.hidden=!note;node.textContent=note;}
  }
}
function ensureMeasurementElements(){
  for(const [id,anchor]of [['card-measurement-warning','#card-description'],['render-measurement-warning','#render-provenance'],['project-measurement-warning','#plan-scheme-note']]){
    if(document.getElementById(id))continue;
    const note=document.createElement('p');note.id=id;note.className='measurement-room-note';note.hidden=true;
    $(anchor).insertAdjacentElement('afterend',note);
  }
  if(!$('#measurement-existing-plans')){
    const section=document.createElement('section');section.id='measurement-existing-plans';section.hidden=true;
    section.innerHTML='<h3>现状局部核对 · 与改造方案分开</h3><p>以下图形仅表达可闭合的原状局部轮廓，不把它平移、拼接为未经确认的全屋墙线。</p><div id="measurement-existing-plan-content"></div>';
    $('#measurement-pending').insertAdjacentElement('afterend',section);
  }
}
// Surveyed existing-condition geometry is intentionally drawn outside the
// renovation floor plan. Its local origin is never a whole-home coordinate.
function localExistingPlanMarkup(plan){
  const points=plan?.pointsMm;
  if(plan?.id!=='suite-bath-existing'||!Array.isArray(points)||points.length!==6||points.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n))))return '';
  const [[x0,y0],[x1,y1],[x2,y2],[x3,y3],[x4,y4],[x5,y5]]=points;
  if(y0!==y1||x1!==x2||y2!==y3||x3!==x4||y4!==y5||x5!==x0||!(x0<x3&&x3<x1&&y0<y4&&y4<y2))return '';
  const width=x1-x0,deep=y2-y0,shallow=y4-y0,step=deep-shallow,left=x3-x0,right=x1-x3;
  const scale=248/width,x=n=>58+(n-x0)*scale,y=n=>88+(n-y0)*scale,bottom=y(y2),svgHeight=bottom+84;
  const text=(tx,ty,label,attrs='')=>`<text x="${tx}" y="${ty}" ${attrs}>${escapeHTML(label)}</text>`;
  const line=(ax,ay,bx,by)=>`<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/>`;
  const tick=(tx,ty)=>line(tx-3,ty-4,tx+3,ty+4);
  const horizontal=(a,b,atY,label)=>line(x(a),atY,x(b),atY)+tick(x(a),atY)+tick(x(b),atY)+text((x(a)+x(b))/2,atY-7,label,'text-anchor="middle"');
  const vertical=(a,b,atX,label)=>line(atX,y(a),atX,y(b))+tick(atX,y(a))+tick(atX,y(b))+text(atX,(y(a)+y(b))/2,label,`text-anchor="middle" transform="rotate(-90 ${atX} ${(y(a)+y(b))/2})" dy="-7"`);
  const summary=`总长 ${width}；西段 ${left}、东段 ${right}；西段净深 ${shallow}、东段净深 ${deep}；退台 ${step}（mm）`;
  const svg=`<svg viewBox="0 0 364 ${svgHeight}" role="img" aria-label="${escapeHTML(plan.title+'。'+summary+'。现状局部轮廓，非改造完成图；门窗未定位。')}" data-existing-plan-svg>
    <title>${escapeHTML(plan.title)}</title><desc>${escapeHTML(summary)}</desc>
    <g class="existing-plan-dimensions">${horizontal(x0,x1,30,width)}${horizontal(x0,x3,60,left)}${horizontal(x3,x1,60,right)}${vertical(y0,y5,35,shallow)}${vertical(y1,y2,332,deep)}</g>
    <polygon class="existing-plan-outline" points="${points.map(([px,py])=>x(px)+','+y(py)).join(' ')}"/>
    <g class="existing-plan-labels">${text(182,148,'主卫现状 · 局部','text-anchor="middle"')}${text(182,173,'非改造完成图','text-anchor="middle" class="existing-plan-secondary"')}${text(333,15,'N ↑','text-anchor="middle" class="existing-plan-secondary"')}</g>
    <g class="existing-plan-dimensions">${line(x(x3)+4,(y(y3)+y(y4))/2,x(x3)+34,bottom+29)}${line(x(x3)+34,bottom+29,x(x3)+98,bottom+29)}${text(x(x3)+39,bottom+22,'退台 '+step)}</g>
    <g class="existing-plan-labels">${text(58,bottom+64,'局部原点（西北角）≠ 全屋定位','class="existing-plan-secondary"')}</g>
  </svg>`;
  return `<article class="measurement-existing-plan" data-local-existing-plan="${escapeHTML(plan.id)}"><h4>${escapeHTML(plan.title||'现状局部轮廓')}</h4><p class="existing-plan-status">仅核对原状；不替换各方案的墙线及入口设计</p><div class="existing-plan-scroll" tabindex="0" aria-label="主卫现状局部轮廓，可横向滚动查看尺寸">${svg}</div><p class="existing-plan-summary">${escapeHTML(summary)}</p><p><b>依据：</b>${escapeHTML(plan.basis||'以复尺核对表为准。')}</p><ul>${(plan.notes||[]).filter(note=>typeof note==='string').map(note=>`<li>${escapeHTML(note)}</li>`).join('')}<li>网站北向上，横轴向东、纵轴向南。局部原点不是全屋定位；图中不绘制位置未确认的门窗。</li></ul></article>`;
}
function syncMeasurementNotice(){
  const revision=data?.measurementRevision,notice=$('#measurement-notice');
  if(!notice)return;
  notice.hidden=!revision;$('#workspace').classList.toggle('measurement-partial',Boolean(revision));
  const roomNotice=measurementRoomNotice(state.room);
  $('#workspace').classList.toggle('measurement-room-warning',Boolean(roomNotice));
  if(!revision)return;
  const view=state.view==='plan'?'平面':state.view==='renders'?'效果图':'空间模型';
  const modelPending=state.view==='model'&&(manifest?.measurementRevision?.date!==revision.date||manifest?.measurementRevision?.version!==revision.version);
  $('#measurement-notice-title').textContent=`${revision.date||''} · 部分复尺已应用`;
  $('#measurement-notice-copy').textContent=roomNotice||`${view}${modelPending?'待同步 · ':''}非全屋实测 · 外轮廓与面积仍为旧模型参考`;
}
function showMeasurement(){
  if(!data?.measurementRevision)return;
  if($('#project-dialog').open)$('#project-dialog').close();
  $('#measurement-dialog').showModal();
}
function renderMeasurementAudit(){
  const revision=data?.measurementRevision;
  ensureMeasurementElements();
  syncMeasurementNotice();
  if(!revision)return;
  const value=text=>Array.isArray(text)?text.map(detailText).join('；'):detailText(text);
  const paragraph=(label,text)=>text===undefined||text===null||text===''?'':`<p><b>${escapeHTML(label)}</b>${escapeHTML(value(text))}</p>`;
  $('#measurement-summary').textContent=[revision.date,revision.summary,data.familyR3Revision?'方案二现已采用R3确认设计墙线。以下复尺证据原样保留，其中旧模型墙宽、窗侧墙链与推拉门记录不代表当前R3；当前设计以本页平面和3D为准。':''].filter(Boolean).join(' · ');
  $('#measurement-orientation').textContent=revision.orientation||'方位依网站北向统一；分房图的纸面上下不等于现场正北。';
  $('#measurement-applied').innerHTML=(revision.applied||[]).map(item=>`<article data-measurement-applied><h4>${escapeHTML(item.label||'已确认项目')}</h4>${paragraph('采用值：',item.value)}${paragraph('范围：',item.scope)}${paragraph('说明：',item.note)}</article>`).join('')||'<p>本方案暂未登记可直接应用的数值。</p>';
  $('#measurement-pending').innerHTML=(revision.pending||[]).map(item=>`<article data-measurement-pending><h4>${escapeHTML([item.room,item.label].filter(Boolean).join(' · '))}</h4>${paragraph('复尺记录：',item.measured)}${paragraph(data.familyR3Revision?'复尺时旧模型记录（非当前R3）：':'模型暂保留：',item.model)}${paragraph('待核原因：',item.reason)}</article>`).join('')||'<p>未登记新的争议项目；全屋尺寸链仍须闭合核验。</p>';
  const localPlans=(revision.localExistingPlans||[]).map(localExistingPlanMarkup).filter(Boolean).join('');
  $('#measurement-existing-plans').hidden=!localPlans;
  $('#measurement-existing-plan-content').innerHTML=localPlans;
  const bathNotice=measurementRoomNotice('bath_1');
  $('#project-measurement-warning').hidden=!bathNotice;
  $('#project-measurement-warning').textContent=bathNotice;
  if(!$('#project-measurement-link')){
    const button=document.createElement('button');button.id='project-measurement-link';button.className='project-bay-link';button.type='button';
    button.innerHTML='<span><small>本轮复尺 · 已应用 / 待核对</small>查看实测修订与旧模型保留范围</span><b>↗</b>';
    button.addEventListener('click',showMeasurement);$('#project-scheme-intro').insertAdjacentElement('afterend',button);
  }
  const surveyArticle=$('#project-dialog .dialog-grid article:last-child');
  if(surveyArticle){surveyArticle.querySelector('b').textContent='部分复尺已应用，整屋尚未闭合';surveyArticle.querySelector('p').textContent='明确的局部数值按复尺修订；不确定墙位、外轮廓和面积保留旧模型并单列待核，不把旧假设当成实测。'}
  if(surveyArticle&&data.familyR3Revision)surveyArticle.querySelector('p').textContent='本版卧卫墙线按R3确认设计更新，并非新增实测。局部复尺证据保留；新墙线与既有窗位的相对尺寸、结构可改性及全屋定位仍须闭合。';
  const bayParagraph=$$('#project-dialog>p').find(node=>node.textContent.startsWith('次卧B北窗'));
  if(bayParagraph)bayParagraph.textContent=windowModelNotes(data).join(' ')+' 窗台投影不计房间面积；坐垫及窗边家具仍须核对防坠、窗扇开启与承载，不代表允许拆改结构。';
  const planNote=$('.plan-bay-note');if(planNote)planNote.textContent='部分复尺已应用；外轮廓、墙体定位与房间面积仍为旧模型参考。窗宽、窗高及台面采用值见「核对明细」，下载 SVG 含三处飘窗数值。非施工图。';
  if(planNote&&data.familyR3Revision)planNote.textContent='R3确认设计：三处900mm门洞，主卧门北移340mm错开书房；两门同开仅约550mm、主卧床尾555mm偏紧。设计墙线非新增实测，旧复尺窗侧尺寸链待重新闭合。非施工图。';
  if(planNote&&data.familyPublicP2Revision)planNote.textContent='P2公区确认：餐柜从800库连续向北4260mm；固定餐桌竖放贴柜，地毯居中，东墙书架改挂画。儿童车需移开南椅、斜转抬取，实车操作待核。卧卫保留R3；非施工图。';
}
function renderDesignNotes(){
  const notes=designNotes();$('#source-notes').hidden=!notes.length;$('#source-notes-list').innerHTML=notes.map(note=>`<li>${note.roomId?escapeHTML(roomDescription(note.roomId).name)+'：':''}${escapeHTML(note.text)}</li>`).join('');
  $('#source-notes').querySelector('[data-purchased-furniture]')?.remove();
  const products=data.purchasedFurnitureRevision?.products||[];
  if(products.length){
    $('#source-notes').hidden=false;
    const section=document.createElement('section');section.dataset.purchasedFurniture='';
    section.innerHTML=`<h3>已购家具 · 本轮采用</h3><p>按宜家公布尺寸及商品外观重建；软包细节、板厚与木腿曲线为模型近似，并非厂家 CAD。房间定位和使用净空仍需现场核对。</p><div class="bay-references">${products.map(product=>{const dimensions=product.dimensionsMm||{},url=referenceURL(product.url);return `<article>${url?`<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(product.name)} ↗</a>`:`<b>${escapeHTML(product.name)}</b>`}<small>${escapeHTML(product.articleNumber||'')}</small><p>产品外廓 ${[dimensions.width,dimensions.depth,dimensions.height].map(value=>escapeHTML(value)).join(' × ')} mm</p></article>`}).join('')}</div>`;
    $('#source-notes').append(section);
  }
  $('#source-notes').querySelector('[data-study-bookwall]')?.remove();
  const fit=data.wallFitouts?.find(f=>f.id==='study_bookwall');
  if(fit){
    const section=document.createElement('section');section.dataset.studyBookwall='';
    section.innerHTML=`<h3>书房桌墙 · 浅书架设计</h3><p>${escapeHTML(fit.description)}</p><h4>落地前核对</h4><ul>${fit.conditions.map(n=>`<li>${escapeHTML(n)}</li>`).join('')}</ul><h4>参考原文 · 借鉴思路，不照搬尺寸</h4><div class="bay-references">${fit.references.map(ref=>`<article><a href="${escapeHTML(referenceURL(ref.url))}" target="_blank" rel="noopener noreferrer">${escapeHTML(ref.title)} ↗</a><small>${escapeHTML(ref.platform)}</small><p>${escapeHTML(ref.borrow)}</p><p>${escapeHTML(ref.avoid)}</p></article>`).join('')}</div>`;
    $('#source-notes').append(section);
  }
}
function configureScheme(){
  document.documentElement.dataset.scheme=scheme.id;document.title=`${scheme.name} · 荟雅苑的家`;
  $('.brand strong').textContent=scheme.name;$('.brand small').textContent=scheme.en;$('.brand').setAttribute('aria-label',scheme.name+'，返回全屋');
  $('.project-crumb').textContent='荟雅苑 / '+(scheme.style||scheme.name);
  $('.sidebar-bottom>p').textContent=scheme.tagline||'把每一天，安放在光与木色之间。';
  $('.material-dots').innerHTML=(scheme.colors||[]).map(c=>`<i title="${escapeHTML(c.name)}" style="--swatch:${/^#[\da-f]{3,8}$/i.test(c.hex)?c.hex:'#ddd'}"></i>`).join('');
  $('.material-dots').setAttribute('aria-label',(scheme.colors||[]).map(c=>c.name).join('、'));
  if(scheme.planPalette){document.documentElement.style.setProperty('--plan-hover',scheme.planPalette?.floor||'#eee7d8');document.documentElement.style.setProperty('--plan-selected',scheme.planPalette?.cabinet||'#ddd6c9')}
  $('#download-blend').href=revisedAsset(scheme.blend);$('#download-glb').href=revisedAsset(scheme.model);
  $('#download-blend span').textContent=scheme.name+' · 材质、家具与渲染相机';$('#download-glb span').textContent=scheme.name+' · glTF 通用模型';
  $('#model-fallback img').src=renderPath('overall');$('#model-fallback img').alt=scheme.name+' · 全屋同源渲染';
  $('#project-scheme-intro').textContent=scheme.summary;
  $('#project-scheme-materials').textContent=scheme.style||scheme.name;
  $('#project-scheme-palette').textContent=(scheme.colors||[]).map(c=>c.name).join('、')+'。模型、平面和效果图相互对应，施工选材仍需现场看样。';
  $('#future-scheme-policy').textContent=schemeCatalog.futureSchemePolicy;
  $('#project-material-tradeoffs').innerHTML=(scheme.tradeoffs||[]).map(note=>`<li>${escapeHTML(note)}</li>`).join('');
  const refs=(scheme.references||[]).map(id=>schemeCatalog.references?.find(ref=>ref.id===id)).filter(ref=>ref&&referenceURL(ref.url));
  $('#project-material-references').innerHTML=refs.map(ref=>`<article><a href="${escapeHTML(referenceURL(ref.url))}" target="_blank" rel="noopener noreferrer">${escapeHTML(ref.title)} ↗</a><small>${escapeHTML([ref.author,ref.kind,ref.date].filter(Boolean).join(' / '))}</small><p>借鉴：${escapeHTML(ref.borrow)}</p><p>不照搬：${escapeHTML(ref.avoid)}</p></article>`).join('');
}

function paintSchemePlan(root){
  if(!scheme||!root)return;
  const palette=scheme.planPalette||{},groups={wood:['#d2b791','#c7a578','#d7c5a6','#9c7854','#d4c5ac','#d9c5a4','#e8dcc6','#ddc39c','#e6dcc8','#e6dac1'],cabinet:['#d4c9b4','#f8f4e9','#f9f6ed','#fcfaf3'],fabric:['#f8f3e8','#f4eee2','#fffdf7','#aab59c','#c5b89e','#b9bca7','#b6b498'],metal:['#babbb0','#96948d'],wall:['#8c887b'],wet:['#d5dedb','#e5e8e2','#e4e0d6','#e6e9df'],floor:['#eee5d5','#eee8da','#ece3d5']};
  const mapping={};for(const [key,values]of Object.entries(groups)){const color=palette[key];if(typeof color==='string'&&/^#[\da-f]{3,8}$/i.test(color))values.forEach(value=>mapping[value]=color)}
  root.querySelectorAll('[fill],[stroke]').forEach(node=>{for(const key of ['fill','stroke']){const replacement=mapping[node.getAttribute(key)?.toLowerCase()];if(replacement)node.setAttribute(key,replacement)}});
  root.querySelectorAll('svg').forEach(svg=>svg.dataset.scheme=scheme.id);
}
const bayFitoutFor = roomId => data?.bayFitouts?.find(fitout=>fitout.roomId===roomId);
const bayRenderPath = fitout => schemeRender(scheme,({room_a:'bay-master',room_b:'bay-tea',living:'bay-living'})[fitout.roomId]);
const referenceURL = value => {try{const url=new URL(value);return /^https?:$/.test(url.protocol)?url.href:null}catch{return null}};
function detailText(value){
  if(typeof value==='string'||typeof value==='number')return String(value);
  if(value&&typeof value==='object')return value.text||value.description||[value.label||value.name,value.value,value.unit].filter(item=>item!==undefined&&item!==null).join(' ');
  return '';
}
function showBayFitouts(roomId=state.room){
  if(!data){toast('空间数据正在载入，请稍后重试');return}
  const dialog=$('#bay-dialog');if(!dialog.open)dialog.showModal();
  const fitout=bayFitoutFor(roomId),card=fitout&&[...dialog.querySelectorAll('[data-fitout-card]')].find(card=>card.dataset.fitoutCard===fitout.id);
  dialog.querySelectorAll('[data-fitout-card]').forEach(item=>item.classList.toggle('is-current',item===card));
  if(card){card.querySelector('details').open=true;card.scrollIntoView({block:'start',behavior:'instant'})}else dialog.scrollTop=0;
}
function renderBayFitouts(){
  const fitouts=data?.bayFitouts||[],references=data?.designReferences||[];
  $('#bay-fitout-cards').innerHTML=fitouts.map((fitout,index)=>{
    const dims=(fitout.dimensions||[]).map(detailText).filter(Boolean),conditions=(fitout.conditions||[]).map(detailText).filter(Boolean);
    const refs=(fitout.references||[]).map(id=>references.find(ref=>ref.id===id)).filter(ref=>ref&&referenceURL(ref.url));
    return `<article class="bay-fitout-card" data-fitout-card="${escapeHTML(fitout.id)}"><button class="bay-fitout-image" data-fitout-render="${escapeHTML(fitout.id)}" aria-label="放大${escapeHTML(fitout.title)}同源渲染"><img src="${bayRenderPath(fitout)}" alt="${escapeHTML(fitout.title)} · Blender 条件方案渲染" loading="lazy"/><span class="bay-render-pending" hidden>同源细节渲染暂未载入</span><span class="bay-image-label">${escapeHTML(renderProvenance(bayRenderPath(fitout)))}${icon('expand')}</span></button><div class="bay-fitout-copy"><p class="bay-fitout-kicker">0${index+1} / ${escapeHTML(roomDescription(fitout.roomId).name)}</p><h3>${escapeHTML(fitout.title)}</h3>${data.familyR3Revision&&['room_a','room_b'].includes(fitout.roomId)?'<p data-r3-window-chain class="bay-conditional-badge">R3隔墙已调整，外窗原位保留。下方旧窗侧墙段仅为复尺时的定位记录，不代表本版窗边净宽；窗宽、窗高、台高仍沿用已确认值。</p>':''}<p class="bay-fitout-summary">${escapeHTML(fitout.summary||'')}</p><ul class="bay-fitout-dimensions" aria-label="方案尺寸">${dims.map(text=>`<li>${escapeHTML(text)}</li>`).join('')}</ul><details><summary>适用条件与参考案例 <span>＋</span></summary><div class="bay-fitout-details"><h4>先确认，再落地</h4><ul>${conditions.map(text=>`<li>${escapeHTML(text)}</li>`).join('')}</ul>${refs.length?`<h4>原文参考 · 仅借鉴设计思路</h4><div class="bay-references">${refs.map(ref=>`<article><a href="${escapeHTML(referenceURL(ref.url))}" target="_blank" rel="noopener noreferrer">${escapeHTML(ref.title)} <span>↗</span></a><small>${escapeHTML([ref.platform,ref.author].filter(Boolean).join(' / '))}</small><p><b>借鉴</b>${escapeHTML(detailText(ref.borrow))}</p>${ref.avoid?`<p><b>不照搬</b>${escapeHTML(detailText(ref.avoid))}</p>`:''}</article>`).join('')}</div>`:''}</div></details><button class="bay-room-button" data-fitout-room="${escapeHTML(fitout.roomId)}">在模型中查看${escapeHTML(roomDescription(fitout.roomId).name)} <span>↗</span></button></div></article>`;
  }).join('')||'<p class="bay-empty">飘窗功能数据暂未载入，请稍后刷新。</p>';
  const usedReferences=new Set(fitouts.flatMap(fitout=>fitout.references||[]));
  const storageReferences=new Set((data?.storageFitouts||[]).flatMap(fitout=>fitout.references||[]));
  $('#bay-safety-references').innerHTML=references.filter(ref=>!usedReferences.has(ref.id)&&!storageReferences.has(ref.id)&&/安全|人体工学/.test(ref.platform||'')&&referenceURL(ref.url)).map(ref=>`<article><a href="${escapeHTML(referenceURL(ref.url))}" target="_blank" rel="noopener noreferrer">${escapeHTML(ref.author)} · ${escapeHTML(ref.title)} ↗</a><p>${escapeHTML(detailText(ref.borrow))} ${escapeHTML(detailText(ref.avoid))}</p></article>`).join('');
  $$('#bay-fitout-cards [data-fitout-room]').forEach(button=>button.addEventListener('click',()=>{$('#bay-dialog').close();selectRoom(button.dataset.fitoutRoom);switchView('model')}));
  $$('#bay-fitout-cards [data-fitout-render]').forEach(button=>button.addEventListener('click',()=>{
    const fitout=fitouts.find(item=>item.id===button.dataset.fitoutRender);if(!fitout||button.classList.contains('unavailable'))return;
    $('#large-render').src=bayRenderPath(fitout);$('#large-render').alt=fitout.title+' · 条件方案渲染';$('#large-render-caption').textContent=fitout.title+' · '+renderProvenance(bayRenderPath(fitout));$('#image-dialog').showModal();
  }));
  $$('#bay-fitout-cards img').forEach(img=>{
    const button=img.parentElement,placeholder=img.nextElementSibling;
    button.disabled=true;button.setAttribute('aria-busy','true');img.style.opacity='0';placeholder.hidden=false;placeholder.textContent='正在载入同源细节渲染…';
    const loaded=()=>{img.hidden=false;img.style.opacity='1';button.disabled=false;button.removeAttribute('aria-busy');button.classList.remove('unavailable');placeholder.hidden=true};
    const failed=()=>{img.hidden=true;button.disabled=true;button.removeAttribute('aria-busy');button.classList.add('unavailable');placeholder.hidden=false;placeholder.textContent='同源细节渲染暂未载入'};
    img.addEventListener('error',failed);img.addEventListener('load',loaded);if(img.complete){if(img.naturalWidth)loaded();else failed()}
  });
}
const storageRenderPath=fitout=>schemeRender(scheme,fitout.id==='sofa_back_storage'?'living':fitout.type==='garage'?'storage-library':fitout.type==='entry'?'entry-storage':'sideboard');
const storageRoleName=role=>({shoe_lower:'闭门鞋柜',key_niche:'钥匙置物格',upper_cabinet:'浅上柜',entry_accessories:'随手置物占位',shoe_bench:'换鞋坐位',bench_back:'镜面 / 挂物背板',sideboard_base:'杯盘下柜',sideboard_niche:'干式饮品格',pullout_table_cabinet:'抽桌专用柜腔',dining_accessories:'杯具 / 茶罐示意',sideboard_blind_base:'转角盲区',sideboard_corner_niche:'转角开放衔接',upper_blind_corner:'上柜盲角'})[role]||role;
function storageElevation(fitout){
  const parts=fitout.parts||[];if(!parts.length)return '';
  const faces={east:{label:'柜面向东 · 从东侧正视',axis:'y',start:'south',end:'north',order:'左南右北',reverse:true},west:{label:'柜面向西 · 从西侧正视',axis:'y',start:'north',end:'south',order:'左北右南',reverse:false},north:{label:'柜面向北 · 从北侧正视',axis:'x',start:'east',end:'west',order:'左东右西',reverse:true},south:{label:'柜面向南 · 从南侧正视',axis:'x',start:'west',end:'east',order:'左西右东',reverse:false}};
  const groups=new Map();
  for(const part of parts){const face=faces[part.face]?part.face:(fitout.face||'east'),segment=part.segmentId||part.source?.segmentId||part.wallSide||face,key=segment+'|'+face;if(!groups.has(key))groups.set(key,{face,segment,parts:[]});groups.get(key).parts.push(part)}
  return [...groups.values()].map(group=>{
    const {face,segment,parts}=group,view=faces[face]||faces.east,axis=view.axis,lengthKey=axis==='y'?'d':'w',depthKey=axis==='y'?'w':'d';
    const min=Math.min(...parts.map(p=>p[axis])),max=Math.max(...parts.map(p=>p[axis]+p[lengthKey])),top=Math.max(...parts.map(p=>p.zCm+p.hCm)),width=max-min;
    const title=(fitout.segments||[]).find(item=>item.id===segment)?.title||view.label;
    const shapes=[...parts].sort((a,b)=>face==='east'?a.x-b.x:face==='west'?b.x-a.x:face==='north'?b.y-a.y:a.y-b.y).map(p=>{
      const length=p[lengthKey],depth=p[depthKey],x=view.reverse?max-p[axis]-length:p[axis]-min,y=top-p.zCm-p.hCm,open=p.role.includes('niche'),accessory=p.role.includes('accessories'),bench=p.role==='shoe_bench';
      const blind=p.role.includes('blind'),fill=accessory?'none':blind?'#e3ddd0':open?'#ddc39c':p.role==='bench_back'?'#e6dcc8':bench?'none':'#f9f6ed';
      const meta=`data-elevation-part-id="${escapeHTML(p.id)}" data-elevation-face="${face}" data-elevation-segment="${escapeHTML(segment)}" data-source-x="${p.x}" data-source-y="${p.y}" data-source-z-cm="${p.zCm}" data-depth-cm="${depth}"`;
      let detail='';
      if(open){
        const edge=(name,x1,y1,x2,y2)=>`<line data-elevation-niche-edge-for="${escapeHTML(p.id)}" data-niche-edge="${name}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#bda98a" stroke-width="1"/>`;
        detail+=edge('top',x,y,x+length,y)+edge('bottom',x,y+p.hCm,x+length,y+p.hCm);
        // The Blender module rotates as a complete canonical east-facing group:
        // its local start is always the right edge in a frontal elevation.
        if(p.role==='sideboard_corner_niche'){
          // This separately owned north-facing turn has a west back lining,
          // not an invented panel across the open east join.
          detail+=edge('west-back',x+length,y,x+length,y+p.hCm);
        }else{
          if(!p.omitStartPanel)detail+=edge('start',x+length,y,x+length,y+p.hCm);
          if(!p.omitEndPanel)detail+=edge('end',x,y,x,y+p.hCm);
        }
      }
      if(blind)detail+=`<path data-elevation-blind-area d="M${x+2} ${y+2}L${x+length-2} ${y+p.hCm-2}M${x+length-2} ${y+2}L${x+2} ${y+p.hCm-2}" fill="none" stroke="#c9bda6" stroke-width=".8"/>`;
      if(p.role==='shoe_lower'&&p.openBaseCm){const gap=Math.min(Number(p.openBaseCm),p.hCm);detail+=`<rect x="${x+1}" y="${top-p.zCm-gap}" width="${length-2}" height="${gap-1}" fill="#ded4c2" stroke="none"/><line x1="${x}" y1="${top-p.zCm-gap}" x2="${x+length}" y2="${top-p.zCm-gap}" stroke="#baa482" stroke-width="1"/><text x="${x+length/2}" y="${top-p.zCm-gap/2+3}" text-anchor="middle" font-size="7" fill="#7d6d54">常鞋区 ${gap*10}</text>`}
      const openEnd=p.role==='upper_cabinet'?Math.min(Number(p.openEndCm||0),length):0,openSide=p.openEndSide||'south',openLeft=openSide==='start'||openSide===view.start,closedStart=x+(openLeft?openEnd:0),closedLength=length-openEnd;
      if(openEnd){const openX=openLeft?x:x+length-openEnd;detail+=`<rect data-elevation-open-end data-open-side="${escapeHTML(openSide)}" x="${openX}" y="${y+1}" width="${openEnd}" height="${p.hCm-2}" fill="#ddc39c" stroke="#bda98a" stroke-width=".8"/>`;for(const level of p.openShelfHeightsCm||[34,67])if(level<p.hCm)detail+=`<line x1="${openX+1}" y1="${top-p.zCm-level}" x2="${openX+openEnd-1}" y2="${top-p.zCm-level}" stroke="#bda98a" stroke-width="1"/>`;detail+=`<text x="${openX+openEnd/2}" y="${y+p.hCm/2}" text-anchor="middle" font-size="6.5" fill="#89795f">杯格 ${openEnd*10}</text>`}
      if(p.doorPanels&&!open&&!blind&&p.role!=='pullout_table_cabinet'){for(let i=1;i<p.doorPanels;i++)detail+=`<line x1="${closedStart+closedLength*i/p.doorPanels}" y1="${y+1}" x2="${closedStart+closedLength*i/p.doorPanels}" y2="${top-p.zCm-(p.openBaseCm||0)}" stroke="#d7cbb7" stroke-width=".8"/>`}
      if(p.role==='pullout_table_cabinet'){
        const cavityBottom=p.tableTopHeightCm-8,cavityTop=cavityBottom+p.cavityHeightCm;
        detail+=`<rect data-elevation-table-pocket x="${x+2}" y="${top-p.zCm-cavityTop}" width="${length-4}" height="${p.cavityHeightCm}" fill="#e5e7de" stroke="#a5a38f" stroke-dasharray="2 2"/><text x="${x+length/2}" y="${top-p.zCm-cavityBottom-p.cavityHeightCm/2+2}" text-anchor="middle" font-size="6.5" fill="#726f5d">抽桌安装腔示意 · ${p.cavityHeightCm*10}mm</text>`;
      }
      // Drawer levels are design components shared with storage_part(), not measured wall dimensions.
      if(p.role==='sideboard_base'){const count=p.drawerPanels??p.drawerCount??2,bottom=p.drawerBottomCm??62,height=p.drawerHeightCm??p.hCm-65.5;if(count>0&&height>0){for(let i=0;i<count;i++)detail+=`<rect data-elevation-drawer data-elevation-drawer-for="${escapeHTML(p.id)}" x="${x+length*i/count+.7}" y="${top-p.zCm-bottom-height}" width="${length/count-1.4}" height="${height}" fill="#fcfaf3" stroke="#d1c3ac" stroke-width=".8"/>`;detail+=`<text x="${x+length/2}" y="${top-p.zCm-bottom-height/2+3}" text-anchor="middle" font-size="7" fill="#89795f">浅抽屉 · 闭合状态</text>`}}
      if(bench)detail+=`<line x1="${x+1}" y1="${top-Number(p.seatHeightCm||p.hCm)}" x2="${x+length-1}" y2="${top-Number(p.seatHeightCm||p.hCm)}" stroke="#b6b498" stroke-width="3"/><text x="${x+length/2}" y="${y+17}" text-anchor="middle" font-size="8" fill="#89795f">坐高 ${(p.seatHeightCm||p.hCm)*10}</text>`;
      const text=!accessory&&!bench?`<text x="${closedStart+closedLength/2}" y="${y+p.hCm/2+3}" text-anchor="middle" font-size="${length<90?7:9}" fill="#89795f">${blind?'盲角':p.role==='sideboard_corner_niche'?'转角衔接':storageRoleName(p.role)}</text>`:'';
      return `<g><title>${escapeHTML(storageRoleName(p.role))}：沿墙${length*10}mm / 标高${p.zCm*10}–${(p.zCm+p.hCm)*10}mm / 深${depth*10}mm</title><rect ${meta} x="${x}" y="${y}" width="${length}" height="${p.hCm}" fill="${fill}" stroke="${accessory||open?'none':'#bda98a'}" stroke-width="1"/>${detail}${text}</g>`;
    }).join('');
    return `<figure class="storage-elevation" data-elevation-face="${face}" data-elevation-segment="${escapeHTML(segment)}"><figcaption><b>${escapeHTML(title)}</b><span>同源 ${axis} / z 投影 · mm</span></figcaption><svg viewBox="-28 -15 ${width+58} ${top+48}" role="img" aria-label="${escapeHTML(fitout.title)} · ${view.label}，按实际构件投影，非施工图"><line x1="-6" y1="${top}" x2="${width+8}" y2="${top}" stroke="#b7aa94" stroke-width="1"/>${shapes}<line x1="0" y1="${top+14}" x2="${width}" y2="${top+14}" stroke="#ae9978" stroke-width=".7"/><text x="${width/2}" y="${top+27}" text-anchor="middle" font-size="9" fill="#8d7959">${width*10} mm · 本段投影长</text><text x="${width+14}" y="${top/2}" transform="rotate(90 ${width+14} ${top/2})" text-anchor="middle" font-size="8" fill="#8d7959">最高 ${top*10} mm</text></svg><p>${view.label}，${view.order}。分段接缝不代表中空隔板；仅画实际保留的端板。分段投影不重复展开转角，柜腔示意不替代板材、镜面开孔及五金加工图。</p></figure>`;
  }).join('');
}
function showStorageFitouts(){if(!data){toast('空间数据正在载入，请稍后重试');return}const dialog=$('#storage-dialog');if(!dialog.open)dialog.showModal();dialog.scrollTop=0}
function renderStorageFitouts(){
  const fitouts=[...(data?.storageFitouts||[])],references=[...(data?.designReferences||[])];
  if(data.garage){
    const entryIndex=fitouts.findIndex(f=>f.type==='entry');
    if(entryIndex>=0)fitouts[entryIndex]={...fitouts[entryIndex],title:'玄关 · 左侧取车，右侧存鞋',summary:'本图展示入户左侧新取车区。右手边浅鞋柜保持原位，鞋柜的分层尺寸见下方立面，完整位置可在平面与3D查看；鞋、车辆与餐具分区。'};
    const g=data.garage;references.push(...g.references.map((r,i)=>({...r,id:'garage-ref-'+i,platform:'已核实公开原文',avoid:'不照搬案例户型、车辆或柜体尺寸。'})));
    const east=g.face==='east',flow=east&&g.doorOperation?.type==='bifold'&&data.familyFlowRevision,metricMm=value=>Number.isFinite(value)?`${value*10}mm`:'待实测';
    const sofa=data.furniture.find(f=>f.name==='三人沙发'),bookcase=data.laundry?.bookcase;
    const table=data.furniture.find(f=>f.purchasedProductId==='ikea-lisabo-80365717');
    const garageCard=data.familyPublicP2Revision?{
      summary:'按确认P2：1500×1000mm分层800库北开四扇内折，西餐柜接至库门北缘；北面没有返柜。不是可步入储物间。',
      dimensions:[`外包 ${g.w*10}×${g.d*10}mm / ${g.metrics.footprintM2.toFixed(2)}㎡；尺寸暂定`,`四扇各${metricMm(g.doorOperation.panelWidthCm)}，向库内折，双侧叠停后名义净开${metricMm(g.opening.clearWidthCm)}`,'库前365mm折门区必须留空；架腿及五金尚未深化','餐柜与东侧叠门间约980mm，小于儿童车1100mm横向包络，不能直接横抽',...g.items.map(f=>`${f.label}示意包络 ${f.w*10}×${f.d*10}×${f.hCm*10}mm；底面离地${metricMm(f.zCm||0)}`),'LISABO固定桌竖放贴柜；北1、东2、南1四席，取车先移开南椅'],
      operation:'儿童车须斜转抬取；模型不证明实际能顺利取出。车把、踏板、手部空间、承重及折门运动必须实车排演，不能沿用上一版取车路线。'
    }:table?{
      summary:'入户分层车库、东向双折门和北面餐柜保留；餐厅采用已购 LISABO 固定餐桌与餐椅，取车前需整理餐椅并让出操作空间。',
      dimensions:[`外包 ${g.w*10}×${g.d*10}mm，约${g.metrics.footprintM2.toFixed(3)}㎡；两车仍分层收纳`,`东向名义开口${metricMm(g.opening.clearWidthCm)}；双折门向北叠停，完整开启过程待现场核对`,...g.items.map(f=>`${f.label}示意包络 ${f.w*10}×${f.d*10}×${f.hCm*10}mm；底面离地${metricMm(f.zCm||0)}（非实物测量）`),`LISABO 固定餐桌占地${metricMm(table.w)}×${metricMm(table.d)}；餐椅拉出与取车操作须实物试摆`,`VIMLE 沙发宽${metricMm(sofa?.w)}；书架前模型净距${metricMm(sofa&&bookcase?bookcase.x-sofa.x-sofa.w:undefined)}，不等于现场已核净空`],
      operation:'取车先关闭入户门、挪好餐椅，保留固定餐桌占位；车辆移出门扫范围后，关闭库门再开入户门。双折门全程、抬放、防坠和车型仍需现场排演。'
    }:hasPulloutDining()?{
      summary:'保留1500×650mm分层车库、东向双折门和北面餐柜；本轮只把餐桌调整为西柜抽桌，并增加沙发背柜，不改车库。',
      dimensions:[`外包1500×650mm；儿童车抬放1230mm，婴儿车落地`,`东向名义开口${metricMm(g.opening.clearWidthCm)}，架腿净约570mm；两车须逐辆取放`,`两扇各305mm双折门完全外翻后向北叠停；五金全程动态待深化`,'西柜抽桌展开1155×705mm；南椅拉出300mm后至返柜847.5mm'],
      operation:'取车先关闭入户门、收桌及挪开餐椅；车移至门扫范围外，关闭库门后再开入户门。库门全程、抬放、防坠和车型仍需现场排演。'
    }:flow?{
      summary:`${data.layout?.intent||'东面双折门完全外翻后向北叠停；西墙与库体北面餐柜组成L形，餐桌四椅向北调整。'} 入户库仍与右鞋柜前后齐平；折叠婴儿车落地，儿童车由成人抬放至1230mm（123cm）独立平台，非两车同层并排。盲角封闭不计容量；卧卫、书房及生活阳台实体不变。`,
      dimensions:[`外包 ${g.w*10}×${g.d*10}mm，约${g.metrics.footprintM2.toFixed(3)}㎡；两车仍分层收纳`,`东向名义开口${metricMm(g.opening.clearWidthCm)}，内部架腿间净约570mm；550mm推车每侧仅约10mm余量，须实车核验`,`两扇各${metricMm(g.doorOperation.panelWidthCm)}双折门，完全外翻180°后在北侧洞口外叠停；停车示意至右鞋柜${metricMm(g.metrics.entryAisleDoorOpenCm)}，不等于开启全程净宽`,`L形餐柜：西墙下柜4210mm＋北返柜名义1500×400mm；北面可用下柜1095mm、上柜1215mm，封闭盲角不计容量`,`餐桌四椅相对前版北移600mm；椅子拉出300mm后，南侧至返柜${metricMm(g.metrics.southChairPulledGapCm)}，北侧至沙发655mm，仅紧凑使用`,`沙发宽${metricMm(sofa?.w)}、家具组东移${metricMm(data.familyFlowRevision.sofaShiftCm)}；书架前约${metricMm(sofa&&bookcase?bookcase.x-sofa.x-sofa.w:undefined)}，落地灯移至低飘窗南端靠墙角落`,...g.items.map(f=>`${f.label}示意包络 ${f.w*10}×${f.d*10}×${f.hCm*10}mm；底面离地${metricMm(f.zCm||0)}（非实物测量）`)],
      operation:'取车先关闭入户门、收好餐椅；双折门完全外翻并在北侧停车后，再向东逐辆抽取。车辆移至门扫范围外后，先关闭储物柜门再开启入户门。180°偏置铰链、板厚与完整折叠过程须厂家深化；抬放、降车、人体握持及转向未认证，须实车排演，取车时不可同时穿行。'
    }:east?{
      summary:'入户左侧1500×650mm储物库与右侧鞋柜前后齐平，东侧开口朝玄关。折叠婴儿车落地，儿童车需由成人抬放至1230mm（123cm）独立平台；两车是分层收纳，不是同层并排。西墙恢复4610mm连续餐边柜，餐桌和四椅向南950mm、向东150mm移位。承重、防坠、实车取放及通行均须现场深化，不作为可步入储物间使用。',
      dimensions:[`外包 ${g.w*10}×${g.d*10}mm，约${g.metrics.footprintM2.toFixed(3)}㎡，较前版减约${g.metrics.reductionPercent}%`,`东向名义开口${metricMm(g.opening.clearWidthCm)}；柜门关闭时至右鞋柜${metricMm(g.metrics.entryAisleClosedCm)}，柜门90°打开后端部至鞋柜${metricMm(g.metrics.entryAisleDoorOpenCm)}（约72cm）`,...g.items.map(f=>`${f.label}示意包络 ${f.w*10}×${f.d*10}×${f.hCm*10}mm；底面离地${metricMm(f.zCm||0)}（非实物测量）`)],
      operation:'取车先关闭入户门、收好餐椅；向东逐辆抽取，车辆移至门扫范围外后，先关闭储物柜门再开启入户门。抬放、降车、人体握持和实际转向未认证，须用实车排演；取车时不可同时穿行。'
    }:{
      summary:'参考业主照片改成紧凑面厅储物库，北侧开口朝餐桌；四叶柜门向厅内外折、在西侧叠停，地面纵向并排放儿童车与折叠婴儿车。后部350mm浅层架放轻量低频物品，不设底台，满载时不按可步入储物间使用；900mm餐边柜向北移500mm，餐桌及四椅不变。',
      dimensions:[`外包 ${g.w*10}×${g.d*10}mm，约${g.metrics.footprintM2.toFixed(2)}㎡，较前版减约26%`,`北向模型净开${metricMm(g.opening.clearWidthCm)}；库体东侧至右鞋柜约${metricMm(g.metrics.entryAisleCm)}`,...g.items.map(f=>`${f.label}纵向停放包络 ${f.w*10}×${f.d*10}×${f.hCm*10}mm（非实物测量）`)],
      operation:'模拟取车时先保持入户门关闭，南餐椅收好；向北出库、向东转移至门扫范围之外，再开门。尚未计入人体操作余量、具体车型转向和门外走廊，须实车排演。'
    };
    fitouts.push({id:g.id,title:g.title,type:'garage',roomId:'living',parts:[],openingFace:g.face,summary:garageCard.summary,dimensions:garageCard.dimensions,conditions:[...g.conditions,garageCard.operation],references:g.references.map((r,i)=>'garage-ref-'+i)});
  }
  $('#storage-fitout-cards').innerHTML=fitouts.map((fitout,index)=>{
    const refs=(fitout.references||[]).map(id=>typeof id==='object'?id:references.find(ref=>ref.id===id)).filter(ref=>ref&&referenceURL(ref.url));
    return `<article class="bay-fitout-card storage-fitout-card" data-storage-card="${escapeHTML(fitout.id)}"${fitout.openingFace?` data-storage-opening-face="${escapeHTML(fitout.openingFace)}"`:''}><button class="bay-fitout-image" data-storage-render="${escapeHTML(fitout.id)}" aria-label="放大${escapeHTML(fitout.title)}同源渲染"><img src="${storageRenderPath(fitout)}" alt="${escapeHTML(fitout.title)} · Blender 条件收纳方案" loading="lazy"/><span class="bay-render-pending" hidden></span><span class="bay-image-label">${escapeHTML(renderProvenance(storageRenderPath(fitout)))}${icon('expand')}</span></button><div class="bay-fitout-copy"><p class="bay-fitout-kicker">0${index+1} / ${fitout.type==='entry'?'ARRIVE & UNWIND':'STORE & SERVE'}</p><h3>${escapeHTML(fitout.title)}</h3><p class="bay-fitout-summary">${escapeHTML(fitout.summary||'')}</p><ul class="bay-fitout-dimensions" aria-label="方案尺寸">${(fitout.dimensions||[]).map(text=>`<li>${escapeHTML(detailText(text))}</li>`).join('')}</ul>${storageElevation(fitout)}<details><summary>适用条件与参考原文 <span>＋</span></summary><div class="bay-fitout-details"><h4>现场复核后，再深化下单</h4><ul>${(fitout.conditions||[]).map(text=>`<li>${escapeHTML(detailText(text))}</li>`).join('')}</ul><h4>参考原文 · 借鉴，不照搬</h4><div class="bay-references">${refs.map(ref=>`<article><a href="${escapeHTML(referenceURL(ref.url))}" target="_blank" rel="noopener noreferrer">${escapeHTML(ref.title)} <span>↗</span></a><small>${escapeHTML([ref.platform,ref.author].filter(Boolean).join(' / '))}</small><p><b>借鉴</b>${escapeHTML(detailText(ref.borrow))}</p><p><b>不照搬</b>${escapeHTML(detailText(ref.avoid))}</p></article>`).join('')}</div></div></details><button class="bay-room-button" data-storage-room="${escapeHTML(fitout.id)}">回到玄关 · 餐厅模型 <span>↗</span></button></div></article>`;
  }).join('')||'<p class="bay-empty">收纳尺寸数据暂未载入，请稍后刷新。</p>';
  $('#storage-assumptions').innerHTML=(data?.storageDesign?.assumptions||[]).map(text=>`<li>${escapeHTML(detailText(text))}</li>`).join('');
  $('#storage-reference-note').textContent=data?.storageDesign?.referencesNote||'外部案例仅提供原文链接，不代表施工尺寸或品牌质量推荐。';
  $$('#storage-fitout-cards [data-storage-room]').forEach(button=>button.addEventListener('click',()=>{$('#storage-dialog').close();selectRoom('dining');switchView('model')}));
  $$('#storage-fitout-cards [data-storage-render]').forEach(button=>button.addEventListener('click',()=>{const fitout=fitouts.find(item=>item.id===button.dataset.storageRender);if(!fitout||button.disabled)return;$('#large-render').src=storageRenderPath(fitout);$('#large-render').alt=fitout.title+' · 条件收纳方案';$('#large-render-caption').textContent=fitout.title+' · '+renderProvenance(storageRenderPath(fitout));$('#image-dialog').showModal()}));
  $$('#storage-fitout-cards img').forEach(img=>{const button=img.parentElement,placeholder=img.nextElementSibling;button.disabled=true;button.setAttribute('aria-busy','true');img.style.opacity='0';placeholder.hidden=false;placeholder.textContent='正在载入同源收纳渲染…';const loaded=()=>{img.hidden=false;img.style.opacity='1';button.disabled=false;button.removeAttribute('aria-busy');placeholder.hidden=true},failed=()=>{img.hidden=true;button.disabled=true;button.removeAttribute('aria-busy');placeholder.hidden=false;placeholder.textContent='同源收纳渲染暂未载入'};img.addEventListener('load',loaded);img.addEventListener('error',failed);if(img.complete){if(img.naturalWidth)loaded();else failed()}});
}
function diningSpecification(){
  const fitouts=data?.storageFitouts||[];if(!fitouts.length)return '';
  const entry=fitouts.find(f=>f.type==='entry'),sideboard=fitouts.find(f=>f.type==='sideboard');
  return [entry?.summary,sideboard?.summary,...(entry?.dimensions||[]).slice(0,2),...(sideboard?.dimensions||[]).slice(0,2),'柜深、通行、转角和开启动态均为设计校核，非现场实测；完整分层尺寸见收纳专题。'].filter(Boolean).map(detailText).join(' ');
}
function bathroomDescription(id){
  if(!['bath_1','bath_2'].includes(id))return '';
  const vanity=data?.furniture?.find(item=>item.id===(id==='bath_1'?'vanity_main':'vanity_guest'));if(!vanity)return roomDescription(id).description;
  const horizontal=['east','west'].includes(vanity.face),width=(horizontal?vanity.d:vanity.w)*10,depth=(horizontal?vanity.w:vanity.d)*10;
  const back={east:'西',west:'东',south:'北',north:'南'}[vanity.face]||'墙';
  if(data.layout?.id==='suite')return `${width} mm宽、${depth} mm深盆柜靠${back}墙；${id==='bath_1'?'西门只通主卧套内小玄关':'西门从公共走廊进入'}。马桶、淋浴位置保留，湿区施工条件待复核。`;
  return id==='bath_1'?`${width} mm宽、${depth} mm深浴室柜依${back}墙布置，镜面靠${back}；马桶和淋浴按阶梯边界安排。`:`${width} mm宽、${depth} mm深浅盆柜设在西北扩出位置，镜面靠${back}，保留紧凑马桶与东侧淋浴；选型及安装余量待复尺。`;
}
function bedroomSpecification(id){
  const revised=data?.woodRevision?.roomDescriptions?.[id];
  if(revised)return {description:revised.description,features:revised.features};
  const bedId=id==='room_a'?'bed_a':id==='room_b'?'bed_b':null;
  const bed=bedId&&data?.furniture?.find(item=>item.id===bedId);if(!bed)return null;
  const head={east:'东',west:'西',north:'北',south:'南'}[bed.headDirection];if(!head)return null;
  const mattress=`${Number(bed.mattressWidthCm)*10}×${Number(bed.mattressLengthCm)*10}`,frame=`${Number(bed.frameWidthCm)*10}×${Number(bed.frameLengthCm)*10}`;
  const bay=data.windows?.find(window=>window.id===(id==='room_a'?'window_a':'window_b'))?.windowType==='bay';
  const fitout=bayFitoutFor(id),bayNote=fitout?`${detailText(fitout.summary)}${id==='room_b'?' 本轮取消独立书桌和办公椅；低台茶座仍为条件方案，非现场已确认。':' 具体尺寸与适用条件见飘窗方案。'}`:`浅木衣柜与柔和织物延续全屋配色${bay?'，北侧飘窗尺寸待复尺。':'。'}`;
  if(fitout?.type==='bare_ledge')return {description:`床头朝${head}；床垫${mattress} mm，床架外包${frame} mm。主卧不设桌台或配椅，保留原飘窗台；衣柜在床尾西墙。`,features:['床头朝东','床尾西墙衣柜','无桌台与配椅']};
  return {description:`床头朝${head}；床垫${mattress} mm，床架外包${frame} mm。${bayNote}`,features:[`床头朝${head}`,`${Number(bed.mattressWidthCm)*10} mm床垫`,fitout?(id==='room_a'?'飘窗一体工作台':'条件茶座'):bay?'北侧飘窗':'柔和织物']};
}

function makeNavigation(){
  $('#room-nav').innerHTML=order.map((id,index)=>{const item=roomDescription(id),r=roomById(id);return `${index===1?'<p class="nav-divider">生活空间 / SPACES</p>':''}<button data-room="${id}" class="${id==='overall'?'active':''}" aria-current="${id==='overall'?'true':'false'}">${icon(item.icon)}<span class="nav-title"><b>${item.name}</b><small>${item.en}</small></span><span class="nav-area">${id==='overall'?'9 个空间':id==='living'?'公共区':r?.area&&id!=='dining'?Number(r.area).toFixed(1)+' ㎡':''}</span></button>`}).join('');
  $$('#room-nav [data-room]').forEach(button=>button.addEventListener('click',()=>selectRoom(button.dataset.room)));
  $('#render-strip').innerHTML=order.map(id=>`<button data-render="${id}" class="${id==='overall'?'active':''}" aria-label="查看${roomDescription(id).name}渲染"><img src="${renderPath(id)}" loading="lazy" alt="${roomDescription(id).name}"/><span>${roomDescription(id).name}</span></button>`).join('');
  $$('#render-strip [data-render]').forEach(button=>button.addEventListener('click',()=>selectRoom(button.dataset.render)));
  $$('#render-strip img').forEach(img=>img.addEventListener('error',()=>{img.style.visibility='hidden'}));
}

function selectRoom(id,{updateHash=true,animate=true}={}){
  if(state.walking)stopWalk({refocus:false});
  if(!scheme||!data)return;
  if(!descriptions[id])id='overall';
  state.room=id;state.interior=false;
  if(updateHash)history.replaceState(null,'',`#${id}`);
  const content=roomDescription(id),r=roomById(id);
  $('#room-title').textContent=content.name;$('#room-kicker').textContent=content.en;
  const areaText=id==='dining'?'与客厅共享公共区 · ':r?.area?Number(r.area).toFixed(1)+(id==='living'?' ㎡（客餐厅及过道合计） · ':' ㎡ · '):'';
  $('#room-subtitle').textContent=id==='overall'?(scheme?.tagline||'把每一天，安放在光与木色之间。'):`${areaText}${scheme?.style||'现代原木'} / ${content.title}`;
  $('#card-kicker').textContent=content.en;$('#card-title').textContent=content.title;
  const accessNote=id==='bath_1'?(data.layout?.id==='suite'?'主卫西门通主卧小玄关，不直接向公共走廊开门。':'主卫北门通主卧，按套内卫生间使用；门宽与侧面构造待复尺。'):id==='bath_2'?'客卫从公共走廊进入；门宽与侧面构造待复尺。':'';
  const bedroom=bedroomSpecification(id),fitout=bayFitoutFor(id);
  const styleNote=scheme.id!=='wood'&&['room_a','room_b','bath_1','bath_2','dining'].includes(id)?scheme.roomOverrides?.[id]?.description:'';
  const measuredDescription=data.familyPublicP2Revision?.roomDescriptions?.[id]?.description||data.familyR3Revision?.roomDescriptions?.[id]?.description||data.woodRevision?.roomDescriptions?.[id]?.description||(id==='kitchen'?data.kitchenFitout?.summary:'')||purchasedRoomDescription(id)||measurementRoomDescription(id);
  $('#card-description').textContent=measuredDescription?measuredDescription+' 外轮廓、面积和未确认位置仍为旧模型参考。':[styleNote,(id==='dining'?diningSpecification():'') || bedroom?.description || bathroomDescription(id) || (fitout?content.description:'') || r?.description || content.description,accessNote,...designNotes().filter(note=>note.roomId===id).map(note=>note.text)].filter(Boolean).join(' ');
  $('#view-bay-fitout').hidden=!(fitout||id==='overall');
  $('#view-bay-fitout').innerHTML=`${id==='overall'?'三处飘窗功能设计':'飘窗方案 · 尺寸 / 参考'} <span>↗</span>`;
  $('#view-storage-fitout').hidden=!['overall','dining','living'].includes(id);
  if($('#view-kitchen-fitout'))$('#view-kitchen-fitout').hidden=!['overall','kitchen'].includes(id);
  $('#view-suite-entry').hidden=!(data.layout?.id==='suite'&&['overall','room_a','bath_1'].includes(id));
  $('#project-suite-entry').hidden=data.layout?.id!=='suite';
  $('#bath-access-note').textContent=data.layout?.id==='suite'?'新增布局：主卫西门通套内小玄关，北侧旧门封闭；客卫仍从公共走廊进入。两卫共墙拉直，具体墙位、门宽与防水排水需复核。':'主卫北门通主卧，客卫从公共走廊进入；两卫阶梯边界及门侧构造仍需现场复尺。';
  const features=data.familyPublicP2Revision?.roomDescriptions?.[id]?.features||data.familyR3Revision?.roomDescriptions?.[id]?.features||data.woodRevision?.roomDescriptions?.[id]?.features||(id==='kitchen'&&data.kitchenFitout?['独立柜下洗碗机','东墙双槽','窗边明装热水器']:null) || data.purchasedFurnitureRevision?.roomDescriptions?.[id]?.features || scheme.roomOverrides?.[id]?.features || bedroom?.features || ((scheme.id!=='wood'||fitout||id==='dining'||id==='bath_1'||id==='bath_2')?content.features:(r?.features || content.features));
  $('#room-tags').innerHTML=features.slice(0,3).map(t=>scheme.id==='wood'?t:({'现代原木':scheme.name,'暖色石材':'浅色卫浴','亚麻触感':'织物软包'})[t]||t).map(t=>`<span>${escapeHTML(t)}</span>`).join('');
  $('#room-preview').src=renderPath(id);$('#room-preview').alt=`${content.name} Blender 渲染预览`;
  $('#enter-room').innerHTML=`${id==='overall'?'探索客厅':'走进'+content.name} <span>↗</span>`;
  $$('#room-nav [data-room]').forEach(btn=>{btn.classList.toggle('active',btn.dataset.room===id);btn.setAttribute('aria-current',String(btn.dataset.room===id))});
  $$('#render-strip [data-render]').forEach(btn=>btn.classList.toggle('active',btn.dataset.render===id));
  $$('#floor-plan [data-plan-room]').forEach(p=>p.classList.toggle('selected',p.dataset.planRoom===id || (id==='dining'&&p.dataset.planRoom==='living')));
  roomLabelNodes.forEach(item=>item.element.classList.toggle('active',item.id===id));
  syncMeasurementNotice();renderRoomMeasurementNotice();
  syncDiningControl();
  updateRender();
  if(state.ready)focusRoom(id,false,animate);
}

function setRoomCardVisible(visible,{persist=true}={}){
  state.roomCardVisible=Boolean(visible);
  const card=$('#room-card'),toggle=$('#toggle-room-card');
  const moveFocus=!state.roomCardVisible&&card.contains(document.activeElement);
  card.hidden=!state.roomCardVisible;
  $('#workspace').classList.toggle('card-hidden',!state.roomCardVisible);
  const action=state.roomCardVisible?'隐藏说明':'显示说明';
  toggle.querySelector('span').textContent=action;
  toggle.setAttribute('aria-label',action);
  toggle.setAttribute('title',action);
  toggle.setAttribute('aria-expanded',String(state.roomCardVisible));
  $('#room-card-toggle').setAttribute('aria-expanded',String(state.roomCardVisible));
  if(persist){try{sessionStorage.setItem(ROOM_CARD_STORAGE_KEY,String(state.roomCardVisible))}catch{}}
  if(moveFocus)toggle.focus({preventScroll:true});
  // Keep the user's current orbit/zoom. A later overview reset fits the newly
  // available area; hiding the card itself must not move the camera.
  scheduleRender();
}

function switchView(view){
  if(state.walking&&view!=='model')stopWalk({restoreFocus:false});
  if(!scheme||!data)return;
  state.view=view;$('#workspace').dataset.view=view;
  syncMeasurementNotice();
  $$('.view-tabs [data-view]').forEach(btn=>{const active=btn.dataset.view===view;btn.setAttribute('aria-selected',String(active));btn.tabIndex=active?0:-1});
  $$('.view-panel').forEach(panel=>{const active=panel.id===`${view}-view`;panel.hidden=!active;panel.classList.toggle('active',active)});
  if(view==='renders')updateRender();
  if(view==='model'&&state.ready){resizeScene();if(!state.walking)controls.update()}
}

function updateRender(){
  if(!scheme)return;
  $('#render-unavailable').hidden=true;
  $('#active-render').src=renderPath(state.room);$('#active-render').alt=`${roomDescription(state.room).name} · Blender 模型图`;
  $('#render-name').textContent=roomDescription(state.room).name;
  $('#render-provenance').textContent=renderProvenance(renderPath(state.room))+(hasPulloutDining()&&state.diningClosed&&state.room!=='dining'?' · 此视角为餐桌展开状态，收起图见玄关·餐厅':'');
  renderRoomMeasurementNotice();
}

function planFurniture(f){
  if(f.garageFitoutId||f.laundryFitoutId||f.kitchenFitoutId)return '';
  if(f.purchasedProductId)return planPurchasedFurniture(f);
  const direction=f.headDirection,isBed=['east','west','north','south'].includes(direction);
  const frame=`<rect data-furniture-frame x="${f.x}" y="${f.y}" width="${f.w}" height="${f.d}" rx="${f.tone==='fabric'?6:2}" fill="${({wood:'#d2b791',cabinet:'#d4c9b4',fabric:'#f8f3e8',sanitary:'#faf9f3',wet:'#d5dedb',metal:'#babbb0'})[f.tone]||'#e3d9c5'}" stroke="#b4a68e" stroke-width="1.5"${!isBed&&f.a?` transform="rotate(${f.a} ${f.x+f.w/2} ${f.y+f.d/2})"`:''}/>`;
  if(!isBed){
    if(f.screenAnchor==='south'){
      const end=f.y+f.d-2,start=end-f.screenLengthCm,x=f.x+1.5;
      return `<g data-wood-shower-screen="south" pointer-events="none"><title>原淋浴区尺寸不变；600mm玻璃屏靠南，北侧790mm入口，防水构造待深化</title>${frame}<line x1="${x}" y1="${start}" x2="${x}" y2="${end}" stroke="#8aabad" stroke-width="3"/><circle cx="${x}" cy="${end}" r="1.2" fill="#8aabad"/><path d="M${x-13} ${f.y+36}h24m-6-4 6 4-6 4" fill="none" stroke="#6a867c" stroke-width="1.5"/></g>`;
    }
    if(data.woodRevision&&f.name.includes('马桶')){
      const north=f.face==='north',cy=f.y+f.d*(north?.45:.55);
      return `<g data-wood-wc="${escapeHTML(f.id||f.name)}" data-wc-face="${f.face}" pointer-events="none"><title>${escapeHTML(f.name)} · 面向${north?'北':'南'} · 排污安装待核</title><rect x="${f.x-5.5}" y="${north?f.y+f.d-11:f.y-.5}" width="${f.w+11}" height="11.5" fill="#dedbd1" stroke="#a9aca1"/><ellipse cx="${f.x+f.w/2}" cy="${cy}" rx="${f.w*.48}" ry="${f.d*.42}" fill="#fffdf7" stroke="#a6afa6"/><ellipse cx="${f.x+f.w/2}" cy="${cy}" rx="${f.w*.29}" ry="${f.d*.27}" fill="#dbe2dc"/></g>`;
    }
    if(data.woodRevision&&(f.woodRole||f.id==='master_full_wardrobe'||f.id==='secondary_east_wardrobe')&&f.id!=='study_north_sofa'){
      const side=f.face||'north',edge=f.woodRole==='chair'?({north:'south',south:'north',east:'west',west:'east'})[side]:side,a={north:[f.x,f.y,f.x+f.w,f.y],south:[f.x,f.y+f.d,f.x+f.w,f.y+f.d],east:[f.x+f.w,f.y,f.x+f.w,f.y+f.d],west:[f.x,f.y,f.x,f.y+f.d]}[edge];
      const caption=f.id==='secondary_east_wardrobe'?`<text x="${f.x+f.w/2}" y="${f.y+f.d/2}" transform="rotate(90 ${f.x+f.w/2} ${f.y+f.d/2})" text-anchor="middle" font-size="10" fill="#756c5e">300深浅衣柜 · 叠衣</text>`:'';
      return `<g data-wood-furniture="${escapeHTML(f.id||f.name)}" data-furniture-face="${side}" pointer-events="none"><title>${escapeHTML(f.name)} · ${f.w*10}×${f.d*10}mm · ${escapeHTML(f.notes||'条件家具占位')}</title>${frame}<line x1="${a[0]}" y1="${a[1]}" x2="${a[2]}" y2="${a[3]}" stroke="#a69577" stroke-width="${f.woodRole==='chair'?3:1.5}"/>${caption}</g>`;
    }
    if(f.diningFitoutId){
      const table=/餐桌/.test(f.name),back=f.face==='west'?`x1="${f.x+f.w-2}" y1="${f.y+3}" x2="${f.x+f.w-2}" y2="${f.y+f.d-3}"`:f.face==='east'?`x1="${f.x+2}" y1="${f.y+3}" x2="${f.x+2}" y2="${f.y+f.d-3}"`:f.face==='south'?`x1="${f.x+3}" y1="${f.y+2}" x2="${f.x+f.w-3}" y2="${f.y+2}"`:`x1="${f.x+3}" y1="${f.y+f.d-2}" x2="${f.x+f.w-3}" y2="${f.y+f.d-2}"`;
      return `<g data-dining-furniture="${escapeHTML(f.name)}" data-dining-face="${f.face}" pointer-events="none"><title>${escapeHTML(f.name)} · ${f.w*10}×${f.d*10}mm${table?' · 桌高750mm，折板抽轨为条件设计':' · 挪椅后收桌'}</title>${frame}${table?`<line data-dining-fold-seam x1="${f.x+f.w/2}" y1="${f.y}" x2="${f.x+f.w/2}" y2="${f.y+f.d}" stroke="#b4a68e" stroke-width="1"/><text x="${f.x+f.w/2}" y="${f.y+f.d/2}" transform="rotate(90 ${f.x+f.w/2} ${f.y+f.d/2})" text-anchor="middle" font-size="9" fill="#766a55">1155×705 抽桌</text>`:`<line data-dining-chair-back ${back} stroke="#9f947e" stroke-width="4"/>`}</g>`;
    }
    if(f.id==='study_north_sofa')return `<g data-furniture-id="${f.id}" data-sofa-face="south" pointer-events="none"><title>北墙沙发 · 朝南 · ${f.w*10}×${f.d*10}mm占位</title>${frame}<rect data-sofa-back x="${f.x+2}" y="${f.y+2}" width="${f.w-4}" height="17" rx="5" fill="#c5b89e"/>${[0,1].map(i=>`<rect x="${f.x+14+i*(f.w-28)/2}" y="${f.y+22}" width="${(f.w-28)/2-2}" height="${f.d-26}" rx="5" fill="#fffdf7" stroke="#b4a68e"/>`).join('')}</g>`;
    if(['bed_b_niche_console','study_full_desk'].includes(f.id))return `<g data-furniture-id="${f.id}" pointer-events="none"><title>${escapeHTML(f.name)} · ${f.w*10}×${f.d*10}mm · ${escapeHTML(f.notes)}</title>${frame}</g>`;
    if((/^vanity_/.test(f.id||'')||/浴室柜/.test(f.name||''))&&['east','west','north','south'].includes(f.face)){
      const horizontal=['east','west'].includes(f.face),cx=f.x+f.w/2,cy=f.y+f.d/2;
      const back={east:'west',west:'east',south:'north',north:'south'}[f.face];
      const mirror=back==='west'?`x1="${f.x+1.5}" y1="${f.y+5}" x2="${f.x+1.5}" y2="${f.y+f.d-5}"`:back==='east'?`x1="${f.x+f.w-1.5}" y1="${f.y+5}" x2="${f.x+f.w-1.5}" y2="${f.y+f.d-5}"`:back==='north'?`x1="${f.x+5}" y1="${f.y+1.5}" x2="${f.x+f.w-5}" y2="${f.y+1.5}"`:`x1="${f.x+5}" y1="${f.y+f.d-1.5}" x2="${f.x+f.w-5}" y2="${f.y+f.d-1.5}"`;
      const faucetX=back==='west'?f.x+f.w*.15:back==='east'?f.x+f.w*.85:cx,faucetY=back==='north'?f.y+f.d*.15:back==='south'?f.y+f.d*.85:cy;
      const towards={east:[1,0],west:[-1,0],north:[0,-1],south:[0,1]}[f.face];
      const handle=horizontal?`x1="${f.face==='east'?f.x+f.w-2:f.x+2}" y1="${cy-8}" x2="${f.face==='east'?f.x+f.w-2:f.x+2}" y2="${cy+8}"`:`x1="${cx-8}" y1="${f.face==='south'?f.y+f.d-2:f.y+2}" x2="${cx+8}" y2="${f.face==='south'?f.y+f.d-2:f.y+2}"`;
      const names={east:'东',west:'西',north:'北',south:'南'};
      return `<g data-vanity-id="${escapeHTML(f.id||f.name)}" data-vanity-face="${f.face}" data-vanity-back="${back}" pointer-events="none"><title>${escapeHTML(f.name)} · 柜面朝${names[f.face]} / 镜靠${names[back]} · 沿墙${(horizontal?f.d:f.w)*10}×进深${(horizontal?f.w:f.d)*10}mm</title>${frame}<ellipse data-vanity-bowl cx="${cx+towards[0]*2}" cy="${cy+towards[1]*2}" rx="${Math.min(f.w*(horizontal?.28:.3),horizontal?15:24)}" ry="${Math.min(f.d*(horizontal?.3:.28),horizontal?24:15)}" fill="#fffef9" stroke="#b7beb7" stroke-width="1.4"/><line data-vanity-mirror ${mirror} stroke="#8aabad" stroke-width="3.5"/><circle cx="${faucetX}" cy="${faucetY}" r="2.3" fill="#919a94"/><line data-vanity-faucet x1="${faucetX}" y1="${faucetY}" x2="${faucetX+towards[0]*7}" y2="${faucetY+towards[1]*7}" stroke="#919a94" stroke-width="2.3"/><line data-vanity-front ${handle} stroke="#b09774" stroke-width="2"/></g>`;
    }
    return `<g pointer-events="none">${frame}</g>`;
  }
  const horizontal=direction==='east'||direction==='west';
  const mattressWidth=Number(f.mattressWidthCm)||(horizontal?f.d-10:f.w-10),mattressLength=Number(f.mattressLengthCm)||200;
  const headboardDepth=Number(f.headboardDepthCm)||7.5;
  const mw=horizontal?mattressLength:mattressWidth,md=horizontal?mattressWidth:mattressLength;
  // Keep the final frame bbox fixed. The mattress starts immediately after
  // the headboard, matching the Blender bed component rather than centering it.
  const mx=direction==='east'?f.x+f.w-headboardDepth-mw:direction==='west'?f.x+headboardDepth:f.x+(f.w-mw)/2;
  const my=direction==='south'?f.y+f.d-headboardDepth-md:direction==='north'?f.y+headboardDepth:f.y+(f.d-md)/2;
  const rect=(x,y,w,d,attrs)=>`<rect x="${x}" y="${y}" width="${w}" height="${d}" rx="4" ${attrs}/>`;
  const mattress=rect(mx,my,mw,md,'data-bed-mattress fill="#f4eee2" stroke="#c7bca8" stroke-width="1"');
  const pillows=[0,1].map(i=>horizontal?rect(direction==='east'?mx+mw-53:mx+8,my+i*md/2+6,45,md/2-12,'data-bed-pillow fill="#fffdf7" stroke="#cfbfa8" stroke-width="1"'):rect(mx+i*mw/2+6,direction==='south'?my+md-53:my+8,mw/2-12,45,'data-bed-pillow fill="#fffdf7" stroke="#cfbfa8" stroke-width="1"')).join('');
  const hx=direction==='east'?f.x+f.w-headboardDepth/2:direction==='west'?f.x+headboardDepth/2:f.x+f.w/2,hy=direction==='south'?f.y+f.d-headboardDepth/2:direction==='north'?f.y+headboardDepth/2:f.y+f.d/2;
  const head=horizontal?`x1="${hx}" y1="${f.y+3}" x2="${hx}" y2="${f.y+f.d-3}"`:`x1="${f.x+3}" y1="${hy}" x2="${f.x+f.w-3}" y2="${hy}"`;
  const directionName={east:'东',west:'西',north:'北',south:'南'}[direction],arrow={east:'床头 →',west:'← 床头',north:'床头 ↑',south:'床头 ↓'}[direction];
  const labelX=horizontal?(direction==='east'?mx+mw-7:mx+7):mx+mw/2,labelY=horizontal?my+md/2:(direction==='north'?my+21:my+md-17);
  return `<g data-bed-direction="${direction}" data-bed-name="${escapeHTML(f.name)}" pointer-events="none"><title>${escapeHTML(f.name)} · 床头${directionName} · 床垫${mattressWidth*10}×${mattressLength*10}mm · 外包${(Number(f.frameWidthCm)||(horizontal?f.d:f.w))*10}×${(Number(f.frameLengthCm)||(horizontal?f.w:f.d))*10}mm</title>${frame}${mattress}${pillows}<line data-bed-headboard ${head} stroke="#af9776" stroke-width="${headboardDepth}"/><text data-bed-head-label x="${labelX}" y="${labelY}" text-anchor="${horizontal?(direction==='east'?'end':'start'):'middle'}" dominant-baseline="middle" font-size="10" fill="#978267">${arrow}</text></g>`;
}

function purchasedProduct(id){return data?.purchasedFurnitureRevision?.products?.find(product=>product.id===id)}
function hasPulloutDining(){return Boolean(data?.pulloutDining&&!data?.furniture?.some(f=>f.purchasedProductId==='ikea-lisabo-80365717'))}
function planPurchasedFurniture(f){
  const product=purchasedProduct(f.purchasedProductId),dims=product?.dimensionsMm||{},turned=['east','west'].includes(f.face),w=turned?f.d:f.w,d=turned?f.w:f.d;
  const transform=f.face==='east'?`translate(${f.x+f.w} ${f.y}) rotate(90)`:f.face==='west'?`translate(${f.x} ${f.y+f.d}) rotate(-90)`:f.face==='south'?`translate(${f.x+f.w} ${f.y+f.d}) rotate(180)`:`translate(${f.x} ${f.y})`;
  const title=`${product?.name||f.name} · 已购 · ${dims.width||w*10}×${dims.depth||d*10}×${dims.height||f.heightCm*10}mm；外观为参数化近似，非厂家 CAD`;
  let shapes='';
  if(f.purchasedProductId==='ikea-vimle-39635114'){
    const arm=15,seat=(w-2*arm)/3;
    shapes=`<rect width="${w}" height="${d}" rx="4" fill="#e8e0cd" stroke="#b4a68e" stroke-width="1.5"/><rect x="1" y="1" width="${arm-2}" height="${d-2}" rx="4" fill="#f2ead9"/><rect x="${w-arm+1}" y="1" width="${arm-2}" height="${d-2}" rx="4" fill="#f2ead9"/>${[0,1,2].map(i=>`<rect data-purchased-sofa-seat x="${arm+i*seat+1}" y="4" width="${seat-2}" height="55" rx="5" fill="#f5eddd" stroke="#bcb29e" stroke-width=".8"/><rect data-purchased-sofa-back x="${arm+i*seat+1}" y="61" width="${seat-2}" height="31" rx="4" fill="#e6ddca" stroke="#bcb29e" stroke-width=".8"/>`).join('')}`;
  }else if(f.purchasedProductId==='ikea-lisabo-80365717'){
    shapes=`<rect width="${w}" height="${d}" rx="4" fill="#e6d3ad" stroke="#b4a68e" stroke-width="1.5"/><rect x="2" y="2" width="${w-4}" height="${d-4}" rx="3" fill="none" stroke="#f4e6cc"/><text x="${w/2}" y="${d/2+3}" text-anchor="middle" font-size="9" fill="#766a55">LISABO ${w*10}×${d*10}</text>`;
  }else{
    shapes=`<rect width="${w}" height="${d}" rx="5" fill="none" stroke="#b4a68e" stroke-width="1"/><rect x="${(w-44)/2}" y="1" width="44" height="39" rx="5" fill="#e6d3ad" stroke="#b4a68e" stroke-width="1"/><line data-purchased-chair-back x1="3" y1="${d-3}" x2="${w-3}" y2="${d-3}" stroke="#bea783" stroke-width="5" stroke-linecap="round"/>`;
  }
  return `<g data-purchased-product-id="${escapeHTML(f.purchasedProductId)}" data-furniture-name="${escapeHTML(f.name)}" data-furniture-face="${f.face||'north'}" pointer-events="none"><title>${escapeHTML(title)}</title><g transform="${transform}">${shapes}</g></g>`;
}

function planFitoutPart(fitout,part){
  if(!['x','y','w','d'].every(key=>Number.isFinite(Number(part[key]))))return '';
  const {x,y,w,d}=Object.fromEntries(['x','y','w','d'].map(key=>[key,Number(part[key])])),sourceRole=part.role||'ledge';
  const role=({raised_ledge:'ledge',seat_cushion:'cushion',back_cushion:'cushion',tea_tray:'tray'})[sourceRole]||sourceRole;
  const subordinate=['desk_support','desk_accessories','ledge_objects'].includes(role);
  const fill=subordinate?'none':fitout.roomId==='living'&&role==='cushion'?'#c7c2b8':({desktop:'#c7a578',ledge:'#d7c5a6',cushion:'#aab59c',tray:'#9c7854',chair:'#c5b89e'}[role]||'#d4c5ac');
  const face=part.face||'north',back={east:'west',west:'east',south:'north',north:'south'}[face];
  const backLine=back==='west'?`x1="${x+3}" y1="${y+5}" x2="${x+3}" y2="${y+d-5}"`:back==='east'?`x1="${x+w-3}" y1="${y+5}" x2="${x+w-3}" y2="${y+d-5}"`:back==='south'?`x1="${x+5}" y1="${y+d-3}" x2="${x+w-5}" y2="${y+d-3}"`:`x1="${x+5}" y1="${y+3}" x2="${x+w-5}" y2="${y+3}"`;
  const detail=role==='chair'?`<line ${backLine} stroke="#8f7f65" stroke-width="5" stroke-linecap="round"/>`:role==='cushion'?`<rect x="${x+4}" y="${y+4}" width="${Math.max(0,w-8)}" height="${Math.max(0,d-8)}" rx="5" fill="none" stroke="#e9eddf" stroke-width="1.5" stroke-dasharray="3 3"/>`:role==='tray'?`<rect x="${x+3}" y="${y+3}" width="${Math.max(0,w-6)}" height="${Math.max(0,d-6)}" rx="2" fill="none" stroke="#d1b694" stroke-width="1.5"/>`:'';
  return `<g data-fitout-part="${escapeHTML(part.id)}" pointer-events="none"><title>${escapeHTML(fitout.title)} · ${escapeHTML(sourceRole)} · 占位${w*10}×${d*10}mm · 底标高${Number(part.zCm||0)*10}mm / 构件高${Number(part.hCm||0)*10}mm；条件设计，非施工图</title><rect data-fitout-id="${escapeHTML(fitout.id)}" data-part-id="${escapeHTML(part.id)}" data-fitout-role="${escapeHTML(sourceRole)}" data-z-cm="${Number(part.zCm||0)}" data-h-cm="${Number(part.hCm||0)}" x="${x}" y="${y}" width="${w}" height="${d}" rx="${['cushion','chair'].includes(role)?6:2}" fill="${fill}" stroke="${subordinate?'none':'#a38b67'}" stroke-width="1.5"/>${detail}</g>`;
}

function planStorageFront(part,inset=2){
  const {x,y,w,d}=part;
  return part.face==='west'?[x+inset,y+3,x+inset,y+d-3]:part.face==='north'?[x+3,y+inset,x+w-3,y+inset]:part.face==='south'?[x+3,y+d-inset,x+w-3,y+d-inset]:[x+w-inset,y+3,x+w-inset,y+d-3];
}
function planStoragePart(fitout,part){
  if(!['x','y','w','d'].every(key=>Number.isFinite(Number(part[key]))))return '';
  const {x,y,w,d}=part,role=part.role||'',accessory=role.includes('accessories'),back=role==='bench_back',niche=role.includes('niche'),upper=role==='upper_cabinet'||role==='upper_blind_corner',bench=role==='shoe_bench',blind=role.includes('blind'),face=part.face||fitout.face||'east';
  const fill=accessory||niche?'none':blind?'#e3ddd0':bench?'#b9bca7':back?'#d9c5a4':upper?'#f8f4e9':'#e8dcc6';
  let detail='';
  if(bench)detail=`<rect x="${x+3}" y="${y+4}" width="${w-6}" height="${d-8}" rx="4" fill="none" stroke="#f0f0e4" stroke-width="1.4" stroke-dasharray="4 3"/>`;
  if(blind)detail+=`<path data-storage-blind-for="${escapeHTML(part.id)}" d="M${x+2} ${y+2}L${x+w-2} ${y+d-2}M${x+w-2} ${y+2}L${x+2} ${y+d-2}" fill="none" stroke="#b7ac98" stroke-width="1"/>`;
  if(!blind&&!niche&&!accessory&&(part.doorStyle||part.doorPanels)){
    const [x1,y1,x2,y2]=planStorageFront({...part,face});
    detail+=`<line data-storage-front-for="${escapeHTML(part.id)}" data-face="${face}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#a99069" stroke-width="${part.doorStyle==='sliding'?2:1.3}"/>`;
    if(part.doorStyle==='sliding'){
      const dx=x2-x1,dy=y2-y1,length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length;
      for(const [at,sign]of [[.3,1],[.7,-1]]){const ax=x1+dx*at,ay=y1+dy*at,bx=ax+ux*length*.16*sign,by=ay+uy*length*.16*sign;detail+=`<path d="M${ax} ${ay}L${bx} ${by}m${-ux*3*sign-uy*2} ${-uy*3*sign+ux*2}L${bx} ${by}l${-ux*3*sign+uy*2} ${-uy*3*sign-ux*2}" fill="none" stroke="#a99069" stroke-width="1"/>`}
    }
  }
  return `<g pointer-events="none"><title>${escapeHTML(fitout.title)} · ${escapeHTML(storageRoleName(role))} · 占位${w*10}×${d*10}mm / 标高${part.zCm*10}–${(part.zCm+part.hCm)*10}mm${blind?'；盲角不是正面满柜容量':''}；设计示意，非施工图</title><rect data-storage-id="${escapeHTML(fitout.id)}" data-storage-part-id="${escapeHTML(part.id)}" data-storage-role="${escapeHTML(role)}" data-storage-face="${face}" data-storage-segment="${escapeHTML(part.segmentId||part.source?.segmentId||part.wallSide||face)}" data-z-cm="${part.zCm}" data-h-cm="${part.hCm}" x="${x}" y="${y}" width="${w}" height="${d}" rx="${bench?4:0}" fill="${fill}" fill-opacity="${upper?.3:1}" stroke="${accessory||niche?'none':upper?'#b0a38b':'#b5a181'}" stroke-width="${upper?1:1.4}"${upper?' stroke-dasharray="4 3"':''}/>${detail}</g>`;
}

function planSlidingDoor(door){
  const c=door.sliding,n=c.panelCount;
  const panel=(door.y2-door.y1-2*c.jambCm+(n-1)*c.overlapCm)/n;
  const leaves=Array.from({length:n},(_,i)=>{
    const x=door.x1+(i-(n-1)/2)*c.trackPitchCm-c.panelDepthCm/2,y=door.y1+c.jambCm+i*(panel-c.overlapCm);
    return `<rect data-sliding-panel="${i}" x="${x}" y="${y}" width="${c.panelDepthCm}" height="${panel}" fill="#ccd8d5" stroke="#8d9089" stroke-width="1"/>`;
  }).join('');
  const width=(door.y2-door.y1)*10,direction=c.stackTo==='south'?'南':'北';
  const frame=`<rect data-slider-frame="${escapeHTML(door.id)}" x="${door.x1-c.frameDepthCm/2}" y="${door.y1}" width="${c.frameDepthCm}" height="${door.y2-door.y1}" fill="none" stroke="#9ca09a" stroke-width=".8"/>`;
  return `<g data-sliding-door="${escapeHTML(door.id)}" data-stack-to="${c.stackTo}"><title>${width}mm条件门洞；三扇三轨向${direction}叠停；此平面显示合拢位置。${escapeHTML(c.condition||'')}</title>${frame}${leaves}<text x="${door.x1+24}" y="${door.y2-25}" transform="rotate(-90 ${door.x1+24} ${door.y2-25})" font-size="14" fill="#807056">${door.id==='balcony_door'?'':width+' 三轨推拉'}</text></g>`;
}

function renderLaundryFitout(){
  if(!data.laundry)return;
  const l={...data.laundry,conditions:(data.laundry.conditions||[]).map(measurementDisplayCopy)};
  if(l.mode==='parallel-only')return renderParallelLaundryFitout(l);
  const dialog=document.createElement('dialog');dialog.id='laundry-dialog';dialog.className='bay-dialog';dialog.setAttribute('aria-label','家政整墙设计');
  dialog.innerHTML=`<button class="dialog-close icon-button" aria-label="关闭家政设计">${icon('close')}</button><header class="bay-dialog-heading"><p class="eyebrow">LAUNDRY WALL / SHARED FITOUT</p><h2>${data.familyPublicP2Revision?'洗烘保留，东墙改挂画':'A洗烘 · B书架 · C推拉门'}</h2><p>${data.familyPublicP2Revision?escapeHTML(data.familyPublicP2Revision.roomDescriptions.balcony.description):'本方案机器靠厨房共墙落地并排；书架正面与外移门框拉齐。玻璃门扇因三轨而内退。'}</p><span class="bay-conditional-badge">专用浅盆条件方案 · 尚未选定设备</span></header><div class="bay-fitout-grid">${[['laundry-detail','A · 洗烘并排，浅盆在上'],['living-wall',data.familyPublicP2Revision?'薄框挂画墙 · 不设落地书架':'B + C · 书架与门框齐平']].map(([id,title])=>`<article class="bay-fitout-card"><button class="bay-fitout-image" data-laundry-render="${id}" aria-label="放大${title}"><img src="${schemeRender(scheme,id)}" alt="${title} · 同源3D渲染" loading="lazy"/><span class="bay-image-label">${escapeHTML(renderProvenance(id))} ${icon('expand')}</span></button><div class="bay-fitout-copy"><h3>${title}</h3><ul class="bay-fitout-dimensions">${l.dimensions.filter((_,i)=>id==='laundry-detail'?[0,1,3].includes(i):[2,3,4].includes(i)).map(t=>`<li>${escapeHTML(t)}</li>`).join('')}</ul></div></article>`).join('')}</div><footer class="bay-dialog-notes"><h3>先核对条件，再定制</h3><ul>${l.conditions.map(t=>`<li>${escapeHTML(t)}</li>`).join('')}</ul><h3>参考原文 · 不照搬适配结论</h3><div class="bay-references">${l.references.map(r=>`<article><a href="${escapeHTML(referenceURL(r.url))}" target="_blank" rel="noopener noreferrer">${escapeHTML(r.title)} ↗</a><p>${escapeHTML(r.borrow)}</p></article>`).join('')}</div></footer>`;
  document.body.append(dialog);dialog.querySelector('.dialog-close').onclick=()=>dialog.close();
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()});
  const show=()=>{if($('#project-dialog').open)$('#project-dialog').close();if(state.walking)stopWalk();dialog.showModal()};
  for(const [parent,id,cls]of [['.sidebar-bottom','open-laundry','quiet-link'],['#project-dialog','project-laundry','project-bay-link'],['.room-card-copy','view-laundry-fitout','secondary-link']]){const button=document.createElement('button');button.id=id;button.className=cls;button.textContent=data.familyPublicP2Revision?'洗烘浅盆 · 东墙挂画 ↗':'家政整墙 · A/B/C设计与参考 ↗';button.onclick=show;$(parent).append(button);}
  dialog.querySelectorAll('[data-laundry-render]').forEach(button=>button.onclick=()=>{$('#large-render').src=schemeRender(scheme,button.dataset.laundryRender);$('#large-render').alt=button.getAttribute('aria-label');$('#large-render-caption').textContent=scheme.name+' · '+renderProvenance(button.dataset.laundryRender);$('#image-dialog').showModal()});
}

function renderParallelLaundryFitout(l){
  const dialog=document.createElement('dialog');dialog.id='laundry-dialog';dialog.className='bay-dialog';dialog.setAttribute('aria-label','方案一并排洗烘设计');
  dialog.innerHTML=`<button class="dialog-close icon-button" aria-label="关闭家政设计">${icon('close')}</button><header class="bay-dialog-heading"><p class="eyebrow">PARALLEL LAUNDRY / SCHEME 01</p><h2>洗烘并排，浅盆在上</h2><p>${escapeHTML(data.woodRevision.roomDescriptions.balcony.description)}</p><span class="bay-conditional-badge">业主提供机身尺寸 · 安装净空与排水待核</span></header><article class="bay-fitout-card"><button class="bay-fitout-image" data-laundry-render="laundry-detail" aria-label="放大并排洗烘浅盆设计"><img src="${schemeRender(scheme,'laundry-detail')}" alt="方案一并排洗烘与独立承重浅盆" loading="lazy"/><span class="bay-image-label">${escapeHTML(renderProvenance('laundry-detail'))} ${icon('expand')}</span></button><div class="bay-fitout-copy"><h3>按机身尺寸核对</h3><ul class="bay-fitout-dimensions">${l.dimensions.map(v=>`<li>${escapeHTML(v)}</li>`).join('')}</ul></div></article><footer class="bay-dialog-notes"><h3>安装前必须核实</h3><ul>${l.conditions.map(v=>`<li>${escapeHTML(v)}</li>`).join('')}</ul></footer>`;
  document.body.append(dialog);dialog.querySelector('.dialog-close').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()});
  const show=()=>{if($('#project-dialog').open)$('#project-dialog').close();if(state.walking)stopWalk();dialog.showModal()};
  for(const [parent,id,cls]of [['.sidebar-bottom','open-laundry','quiet-link'],['#project-dialog','project-laundry','project-bay-link'],['.room-card-copy','view-laundry-fitout','secondary-link']]){const button=document.createElement('button');button.id=id;button.className=cls;button.textContent='并排洗烘 · 尺寸与安装条件 ↗';button.onclick=show;$(parent).append(button)}
  dialog.querySelector('[data-laundry-render]').onclick=()=>{$('#large-render').src=schemeRender(scheme,'laundry-detail');$('#large-render').alt='方案一并排洗烘与上方浅盆';$('#large-render-caption').textContent=renderProvenance('laundry-detail');$('#image-dialog').showModal()};
}

function planPublicP2Laundry(){
  const l=data.laundry,c=l.counter,s=l.basin;
  const rect=(p,a)=>`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.d}" ${a}/>`;
  return `<g data-laundry-plan="${l.id}" data-public-p2-laundry pointer-events="none">${rect(c,'data-laundry-counter fill="#ded9cd" stroke="#a79b87" stroke-width="1.3"')}${l.machines.map(m=>rect(m,`data-laundry-machine="${m.id}" fill="none" stroke="#928876" stroke-dasharray="4 3"`)+`<text x="${m.x+m.w/2}" y="${m.y+28}" text-anchor="middle" font-size="11" fill="#726c61">${m.id.includes('washer')?'洗衣机':'烘干机'}</text>`).join('')}${rect(s,'data-laundry-basin fill="#fcfaf6" fill-opacity=".8" stroke="#a3aca6" stroke-width="1.2"')}<text x="${s.x+s.w/2}" y="${s.y+s.d/2}" text-anchor="middle" font-size="10" fill="#777569">上方浅盆</text><text x="${c.x+c.w/2}" y="${c.y+c.d-6}" text-anchor="middle" font-size="10" fill="#746b5b">台高980 / 独立承重</text><text x="636" y="1017" text-anchor="end" font-size="10" fill="#698575">阳台门原位保留</text><text x="${c.x+c.w/2}" y="1030" text-anchor="middle" font-size="9" fill="#9b6855">前方操作带690</text></g>`;
}
function planPublicP2Garage(){
  const g=data.garage,rect=(p,a)=>`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.d}" ${a}/>`;
  const parts=g.parts.filter(p=>['panel','folded-door'].includes(p.role)).map(p=>rect(p,`data-garage-part="${escapeHTML(p.id)}" fill="${p.role==='panel'?'#908d87':'#c5b9a7'}"`)).join('');
  const items=g.items.map(p=>`<g data-garage-item="${escapeHTML(p.id)}" data-z-cm="${p.zCm||0}">${rect(p,`rx="3" fill="${p.zCm?'none':'#d5ddcf'}" stroke="#82957d" ${p.zCm?'stroke-dasharray="4 3"':''}`)}</g>`).join('');
  return `<g data-family-garage="${g.id}" data-opening-face="north" pointer-events="none"><title>北向四扇内折，双侧叠停；儿童车斜转抬取待实车验证，不视为取放通过。</title>${rect(g,'fill="#eeece4"')}${parts}${rect({x:214,y:1287,w:146,d:36.5},'data-garage-fold-zone fill="#d1a377" fill-opacity=".15" stroke="#b78555" stroke-dasharray="3 3"')}${items}<text x="287" y="1307" text-anchor="middle" font-size="8" fill="#99714c">北面四扇内折 · 前365禁放物</text><text x="287" y="1342" text-anchor="middle" font-size="8" fill="#68785f">儿童车上层 / 婴儿车落地</text><text x="287" y="1372" text-anchor="middle" font-size="8" fill="#68785f">平台1230 · 抬放待核</text><text x="287" y="1410" text-anchor="middle" font-size="11" fill="#6e8069">800库 · 1500×1000暂定</text><text data-garage-movement-warning x="400" y="1264" font-size="10" fill="#9b6855">取车先移南椅 · 斜转抬取待核</text><text x="307" y="1277" text-anchor="middle" font-size="8" fill="#9b6855">叠门后旁侧约980</text></g>`;
}
function planPublicP2Art(){
  const art=data.modelAddons?.livingWallArt;if(!art)return '';
  return `<g data-public-p2-wall-art pointer-events="none"><title>两幅600×800薄框挂画，中心高1500mm，不增落地柜。仅设计示意。</title>${art.items.map((p,i)=>`<rect data-wall-art="${i}" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.d}" fill="#b59472" stroke="#977456" stroke-width=".8"/>`).join('')}<text x="645" y="792" text-anchor="end" font-size="10" fill="#8c755c">东墙薄框挂画</text></g>`;
}
function planLaundry(){
  if(data.familyPublicP2Revision)return planPublicP2Laundry();
  const l=data.laundry;if(!l)return '';
  const c=l.counter,b=l.bookcase,s=l.basin;
  const rect=(p,attrs)=>`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.d}" ${attrs}/>`;
  if(l.mode==='parallel-only')return `<g data-laundry-plan="${l.id}" pointer-events="none"><title>并排洗烘及独立承重浅盆，机器虚线为下方投影；台面和安装条件待核。</title>${rect(l.partition.adjustmentBand,'data-wood-width-pending fill="#e8c9ba" fill-opacity=".5" stroke="#b28470" stroke-dasharray="3 3"')}<text x="820" y="982" transform="rotate(90 820 982)" font-size="8" fill="#9b6855">180闭合差 · 不计可用</text>${rect(c,'data-laundry-counter fill="#ded9cd" stroke="#a79b87" stroke-width="1.3"')}${l.machines.map(m=>rect(m,`data-laundry-machine="${m.id}" fill="none" stroke="#928876" stroke-dasharray="4 3" stroke-width="1"`)+`<text x="${m.x+m.w/2}" y="${m.y+30}" text-anchor="middle" font-size="10" fill="#726c61">${m.id.includes('washer')?'洗衣机':'烘干机'}</text>`).join('')}${rect(s,'data-laundry-basin fill="#fcfaf6" fill-opacity=".8" stroke="#a3aca6" stroke-width="1.2"')}<text x="${s.x+s.w/2}" y="${s.y+s.d/2}" text-anchor="middle" font-size="10" fill="#777569">上方浅盆</text><text x="${c.x+c.w/2}" y="${c.y+c.d-6}" text-anchor="middle" font-size="9" fill="#746b5b">台高${c.topCm*10} · 独立承重</text><text x="${c.x+c.w/2}" y="${c.y-7}" text-anchor="middle" font-size="9" fill="#9b6855">模型操作带${l.metrics.operationAisleCm*10}</text></g>`;
  const parts=l.parts.filter(p=>p.roomId==='living'&&p.role==='book-panel').map(p=>rect(p,`data-laundry-part="${p.id}" fill="#ddd8cc" stroke="#aa9c85" stroke-width=".5"`)).join('');
  return `<g data-laundry-plan="${l.id}" pointer-events="none"><title>A两台机器靠厨房共墙；台面与浅盆在上，机器虚线为台面下投影。B柜正面与C门框齐平。</title>${rect(b,'fill="#eee9df" stroke="#aa9c85" stroke-width="1"')}${parts}<text x="${b.x+20}" y="${b.y+85}" transform="rotate(90 ${b.x+20} ${b.y+85})" font-size="12" fill="#766952">B · 300深书架</text>${rect(c,'data-laundry-counter fill="#ded9cd" stroke="#a79b87" stroke-width="1.3"')}${l.machines.map(m=>`${rect(m,`data-laundry-machine="${m.id}" fill="none" stroke="#928876" stroke-dasharray="4 3" stroke-width="1"`)}<text x="${m.x+m.w/2}" y="${m.y+28}" text-anchor="middle" font-size="11" fill="#726c61">${m.id.includes('washer')?'洗衣机':'烘干机'}</text>`).join('')}${rect(s,'data-laundry-basin fill="#fcfaf6" fill-opacity=".8" stroke="#a3aca6" stroke-width="1.2"')}<text x="${s.x+s.w/2}" y="${s.y+s.d/2}" text-anchor="middle" font-size="10" fill="#777569">上方浅盆</text><text x="${c.x+c.w/2}" y="${c.y+c.d-6}" text-anchor="middle" font-size="11" fill="#746b5b">A · 台高980 / 独立承重</text><path data-laundry-alignment d="M645 630V1115" fill="none" stroke="#698575" stroke-width="1" stroke-dasharray="5 4"/><text x="636" y="1017" text-anchor="end" font-size="11" fill="#698575">C · 门框齐柜面</text><text x="${c.x+c.w/2}" y="1030" text-anchor="middle" font-size="9" fill="#9b6855">前方操作带690</text><text x="610" y="934" text-anchor="middle" font-size="10" fill="#9b6855">净距${Math.round(l.metrics.sofaBookcaseGapCm*10)}</text></g>`;
}

function planGarage(){
  if(data.familyPublicP2Revision)return planPublicP2Garage();
  const g=data.garage;if(!g)return '';
  const east=g.face==='east';
  const sides=g.parts.filter(p=>['panel','folded-door','hinged-door'].includes(p.role)).map(p=>`<rect data-garage-part="${escapeHTML(p.id)}" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.d}" fill="${p.role==='panel'?'#908d87':'#c5b9a7'}"/>`).join('');
  const vehicles=g.items.map(p=>`<g data-garage-item="${escapeHTML(p.id)}" data-rotation="${p.rotationDeg||0}" data-z-cm="${p.zCm||0}"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.d}" rx="5" fill="${p.zCm?'none':p.kind==='child-bike'?'#c8d3c5':'#e0d8cc'}" stroke="#8a9a88" stroke-width="1.3" ${p.zCm?'stroke-dasharray="4 3"':''}/><text x="${p.x+p.w/2}" y="${p.y+(p.zCm?11:p.d-14)}" text-anchor="middle" font-size="8" fill="#66745f">${p.zCm?'上层儿童车 · 抬放':p.kind==='child-bike'?'儿童车':'落地折叠婴儿车'}</text><text x="${p.x+p.w/2}" y="${p.y+(p.zCm?23:p.d-3)}" text-anchor="middle" font-size="7" fill="#66745f">${p.w*10}×${p.d*10}${p.zCm?' / 台高'+p.zCm*10:''}</text></g>`).join('');
  const shelf=g.shelves[0],arrows=east?`M${g.x+g.w+2} ${g.y+g.d/2}h45m-8-5 8 5-8 5`:g.items.map(p=>`M${p.x+p.w/2} ${g.y-2}v-50m-5 8 5-8 5 8`).join(' ');
  return `<g data-family-garage="${escapeHTML(g.id)}" data-opening-face="${g.face}" pointer-events="none"><title>外包${g.w*10}×${g.d*10}；${east?'东向开口朝入户玄关，儿童车抬放1230mm、婴儿车落地；重叠为分层投影，非两车同层。':'北向开口朝厅内与餐桌。'}尺寸与承重待深化。</title><rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.d}" fill="#efeee6"/>${sides}${vehicles}<rect data-garage-upper-rack x="${shelf.x}" y="${shelf.y}" width="${shelf.w}" height="${shelf.d}" fill="none" stroke="#9d8e73" stroke-dasharray="4 4"/><path data-garage-exit="${g.face}" d="${arrows}" fill="none" stroke="#829781" stroke-width="2"/><text x="${g.x+g.w/2}" y="${g.y+g.d+(east?35:19)}" text-anchor="middle" font-size="13" fill="#6e8069">800库 · ${g.w*10}×${g.d*10}</text><text x="${g.x+g.w+64}" y="${g.y-17}" text-anchor="middle" font-size="10" fill="#829781">${east?'开口朝入户玄关':'开口朝厅 / 餐桌'}</text><text x="423" y="${g.y+(east?61:14)}" text-anchor="middle" font-size="8" fill="#829781">${east?'取车先关入户门':'取车时暂占前场'}</text></g>`;
}

function kitchenApplianceMarkup(appliance,local=false){
  const p=local?{...appliance,...appliance.local}:appliance;
  if(!p||![p.x,p.y,p.w,p.d].every(Number.isFinite)||p.w<=0||p.d<=0)return '';
  const {x,y,w,d,type}=p,cx=x+w/2,cy=y+d/2;
  const label=({fridge:'冰箱',dishwasher:'洗碗机',doubleSink:'双槽水槽',gasHob:'燃气灶',hood:'油烟机',waterHeater:'明装热水器',faucet:'龙头'})[type]||type;
  const box=(a,b,c,e,attrs)=>`<rect x="${a}" y="${b}" width="${c}" height="${e}" ${attrs}/>`;
  const text=(tx,ty,value,size=8)=>`<text x="${tx}" y="${ty}" text-anchor="middle" font-size="${size}" fill="#5b625c">${escapeHTML(value)}</text>`;
  let shape='';
  if(type==='doubleSink'){
    const vertical=d>w,gap=2,inset=2.5,innerW=w-inset*2,innerD=d-inset*2;
    const bowls=vertical?[[x+inset,y+inset,innerW,(innerD-gap)*.57],[x+inset,y+inset+(innerD-gap)*.57+gap,innerW,(innerD-gap)*.43]]:[[x+inset,y+inset,(innerW-gap)*.57,innerD],[x+inset+(innerW-gap)*.57+gap,y+inset,(innerW-gap)*.43,innerD]];
    shape=box(x,y,w,d,'rx="1.2" fill="#cbd2d1" stroke="#788b8b" stroke-width="1"')+bowls.map(([bx,by,bw,bd])=>box(bx,by,bw,bd,'rx="1.2" fill="#eaf0ee" stroke="#91a3a2" stroke-width=".8"')+`<circle cx="${bx+bw/2}" cy="${by+bd*.62}" r="2.7" fill="#a5b3b1" stroke="#839895" stroke-width=".7"/>`).join('');
  }else if(type==='gasHob'){
    const horizontal=w>=d,burners=horizontal?[[x+w*.27,cy],[x+w*.73,cy]]:[[cx,y+d*.27],[cx,y+d*.73]],radius=Math.min(w,d)*.26;
    shape=box(x,y,w,d,'rx="2" fill="#555c58" stroke="#424a45" stroke-width="1"')+burners.map(([bx,by])=>`<circle cx="${bx}" cy="${by}" r="${radius}" fill="none" stroke="#c4c5b8" stroke-width="1.3"/><circle cx="${bx}" cy="${by}" r="${radius*.48}" fill="#7d8680"/><path d="M${bx-radius-1} ${by}h${radius*2+2} M${bx} ${by-radius-1}v${radius*2+2}" stroke="#303c35" stroke-width="1.4"/>`).join('');
  }else if(type==='hood'){
    shape=box(x,y,w,d,'rx="1" fill="none" stroke="#70877b" stroke-width="1.1" stroke-dasharray="3 2"');
  }else if(type==='faucet'){
    shape=`<circle cx="${cx}" cy="${cy}" r="${Math.max(1.5,Math.min(w,d)/3)}" fill="#879d9a"/><path d="M${cx} ${cy}v-6q0-4 4-4h4" fill="none" stroke="#6e8783" stroke-width="1.6"/>`;
  }else{
    const isHeater=type==='waterHeater',fill=type==='fridge'?'#e6e7e0':type==='dishwasher'?'#d8dfdc':'#f7f5e9';
    shape=box(x,y,w,d,`rx="1.4" fill="${fill}" stroke="#82938a" stroke-width="1.2"${isHeater?' stroke-dasharray="3 2"':''}`)+text(cx,cy-1,isHeater?'热水器':label,isHeater?6.3:8.5);
    if(isHeater)shape+=text(cx,cy+7,'明装',5.5);
    if(!isHeater)shape+=text(cx,cy+11,`${Math.round(w*10)}×${Math.round(d*10)}`,7);
    if(type==='dishwasher')shape+=`<path d="M${x+5} ${y+7}h${w-10}" stroke="#83938b" stroke-width="1.3"/>`;
    if(type==='fridge')shape+=`<path d="M${x+3} ${y+d-7}h${w-6}" stroke="#9ca79a" stroke-width="1.1"/>`;
  }
  return `<g ${local?'data-kitchen-local-appliance':'data-kitchen-appliance-id'}="${escapeHTML(p.id)}" data-kitchen-type="${escapeHTML(type)}" data-kitchen-face="${escapeHTML(p.face||'')}" data-z-cm="${p.zCm??0}" data-height-cm="${p.heightCm??0}"><title>${escapeHTML(label)} · 机身占位 ${Math.round(w*10)}×${Math.round(d*10)}${Number.isFinite(p.heightCm)?'×'+Math.round(p.heightCm*10):''}mm；安装条件待复核</title>${shape}</g>`;
}

function planKitchen(){
  const k=data.kitchenFitout;if(!k)return '';
  const rect=(p,attrs)=>`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.d}" ${attrs}/>`;
  const appliances=[...(k.appliances||[])].sort((a,b)=>Number(b.type==='hood')-Number(a.type==='hood'));
  const counters=(k.countertops||[]).map(p=>rect(p,`data-kitchen-counter="${escapeHTML(p.id)}" fill="#f2eee3" stroke="#a9a390" stroke-width="1.1"`)+(p.cutouts||[]).filter(c=>[c.x,c.y,c.w,c.d].every(Number.isFinite)).map(c=>rect(c,'fill="#e4e0d6" stroke="#b2b1a4" stroke-width=".6"')).join('')).join('');
  const fronts=(k.parts||[]).filter(p=>p.role==='base-front').map(p=>rect(p,`data-kitchen-part="${escapeHTML(p.id)}" data-kitchen-role="base-front" fill="#d3c4a5" stroke="#a4977a" stroke-width=".7"`)).join('');
  const uppers=(k.parts||[]).filter(p=>p.role==='upper-front'||p.role==='upper-cabinet'||(p.role==='upper-panel'&&p.id.endsWith('_floor'))).map(p=>rect(p,`data-kitchen-part="${escapeHTML(p.id)}" data-kitchen-role="${p.role}" fill="none" stroke="#7c9183" stroke-width="1.3" stroke-dasharray="4 3"`)).join('');
  const shafts=(k.parts||[]).filter(p=>p.role==='shaft').map(p=>rect(p,`data-kitchen-part="${escapeHTML(p.id)}" data-kitchen-role="shaft" fill="#8c887b" stroke="#716e63" stroke-width="1"`)+`<text x="${p.x+p.w/2}" y="${p.y+p.d/2+3}" text-anchor="middle" font-size="8" fill="#fffaf0">烟道</text>`).join('');
  const e=k.modelEnvelope,a=k.adjustmentBand;
  const adjustmentTops=a?(k.countertops||[]).map(p=>({x:Math.max(p.x,a.x),y:p.y,w:Math.min(p.x+p.w,a.x+a.w)-Math.max(p.x,a.x),d:p.d})).filter(p=>p.w>0):[];
  const band=a?`<g data-kitchen-adjustment-band="${a.w}" aria-label="南北柜体${a.w*10}mm待核调整段，不计入可用机位">${adjustmentTops.map(p=>rect(p,'fill="#c49365" fill-opacity=".18" stroke="#b48660" stroke-width=".9" stroke-dasharray="4 4"')+`<text x="${p.x+p.w/2}" y="${p.y+p.d/2-2}" text-anchor="middle" font-size="7" fill="#966a46">${a.w*10} 待核</text><text x="${p.x+p.w/2}" y="${p.y+p.d/2+8}" text-anchor="middle" font-size="6.5" fill="#966a46">不计机位</text>`).join('')}</g>`:'';
  const note=e?`<text x="${e.x+e.w/2}" y="${e.y+e.d-4}" text-anchor="middle" font-size="8" fill="#8a7356">厨房设备占位 · 虚线为上方 · 净距待核</text>`:'';
  return `<g data-kitchen-plan="${escapeHTML(k.id)}" pointer-events="none"><title>${escapeHTML(k.summary||'厨房条件方案')} 全屋仍沿旧模型墙线；调整段不计可用机位。</title>${counters}${fronts}${appliances.map(p=>kitchenApplianceMarkup(p)).join('')}${uppers}${shafts}${band}${note}</g>`;
}

function localKitchenPlanMarkup(k){
  const e=k?.localEnvelope;if(!e||![e.w,e.d].every(Number.isFinite))return '';
  const localParts=k.localShaft?[k.localShaft]:(k.parts||[]).filter(p=>p.role==='shaft'&&p.local).map(p=>({...p,...p.local}));
  const shafts=localParts.filter(p=>p.x>=0&&p.y>=0&&p.x+p.w<=e.w&&p.y+p.d<=e.d).map(p=>`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.d}" fill="#8c887b"/><text x="${p.x+p.w/2}" y="${p.y+p.d/2+3}" text-anchor="middle" font-size="8" fill="#fffaf0">烟道占位</text>`).join('');
  const counters=(k.localCountertops||[]).map(p=>`<rect data-kitchen-local-counter x="${p.x}" y="${p.y}" width="${p.w}" height="${p.d}" fill="#f2eee3" stroke="#b1a691" stroke-width="1"/>`).join('');
  const devices=(k.appliances||[]).filter(p=>p.local).sort((a,b)=>Number(b.type==='hood')-Number(a.type==='hood')).map(p=>kitchenApplianceMarkup(p,true)).join('');
  return `<svg data-kitchen-local-plan="${escapeHTML(k.id)}" viewBox="-35 -42 ${e.w+70} ${e.d+92}" role="img" aria-label="厨房${e.w*10}乘${e.d*10}毫米局部保守设备排布，独立局部坐标，非全屋定位或施工图"><title>厨房局部保守排布</title><rect x="0" y="0" width="${e.w}" height="${e.d}" fill="#eae8dd" stroke="#8c887b" stroke-width="3"/>${counters}${shafts}${devices}<g stroke="#b2a084" stroke-width=".8" fill="none"><path d="M0 -21H${e.w} M0 -26v10 M${e.w} -26v10 M-19 0V${e.d} M-24 0h10 M-24 ${e.d}h10"/></g><g font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="10" fill="#74674f" text-anchor="middle"><text x="${e.w/2}" y="-27">${e.w*10} mm · 局部尺寸</text><text x="-26" y="${e.d/2}" transform="rotate(-90 -26 ${e.d/2})">${e.d*10} mm</text><text x="${e.w-6}" y="-7">N ↑</text><text x="${e.w/2}" y="${e.d+20}">设备机身示意 · 未作为柜洞及安全净距</text><text x="${e.w/2}" y="${e.d+36}">窗、门与管线最终定位待现场闭合</text></g></svg>`;
}

function renderKitchenFitout(){
  const k=data.kitchenFitout;if(!k||$('#kitchen-dialog'))return;
  const dialog=document.createElement('dialog');dialog.id='kitchen-dialog';dialog.className='bay-dialog';dialog.setAttribute('aria-labelledby','kitchen-dialog-title');
  const list=values=>(values||[]).map(value=>`<li>${escapeHTML(detailText(value))}</li>`).join('');
  const refs=(k.references||[]).filter(r=>referenceURL(r.url));
  const views=[['kitchen','南墙烹饪 · 东墙双槽'],['kitchen-north','北侧冰箱 · 洗碗机 · 明装热水器']];
  const renders=`<div class="bay-fitout-grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))">${views.map(([view,title])=>`<article class="bay-fitout-card"><button class="bay-fitout-image" data-kitchen-render="${view}" aria-label="放大${title}"><img src="${schemeRender(scheme,view)}" alt="${title} · 同源参数示意，安装待核" loading="lazy"/><span class="bay-render-pending" hidden>同源视角暂未载入</span><span class="bay-image-label">同源参数示意 · 安装待核 ${icon('expand')}</span></button><div class="bay-fitout-copy"><h3>${title}</h3><p class="bay-fitout-summary">${escapeHTML(renderProvenance(view))}</p></div></article>`).join('')}</div>`;
  dialog.innerHTML=`<button class="dialog-close icon-button" aria-label="关闭厨房设计">${icon('close')}</button><header class="bay-dialog-heading"><p class="eyebrow">KITCHEN / CONDITIONAL LAYOUT</p><h2 id="kitchen-dialog-title">厨房 · 设备与柜体排布</h2><p>${escapeHTML(k.summary||'')}</p><span class="bay-conditional-badge">设备外形占位 · 型号与安装条件待核</span></header>${renders}<article class="measurement-existing-plan"><h4>${k.localEnvelope.w*10}×${k.localEnvelope.d*10} mm 局部保守排布</h4><p class="existing-plan-status">此图使用独立局部坐标。全屋模型暂保留${k.modelEnvelope.w*10}×${k.modelEnvelope.d*10} mm旧墙线，待尺寸链闭合；${k.adjustmentBand.w*10} mm调整段不计入可用机位。</p><div class="existing-plan-scroll">${localKitchenPlanMarkup(k)}</div><p>洗碗机单独设于台面下；双槽和燃气灶不置于洗碗机上方。热水器明装，吊柜在窗边前停止，独立排烟与检修条件待核。</p><ul class="bay-fitout-dimensions">${list(k.dimensions)}</ul></article><footer class="bay-dialog-notes"><h3>施工前需要核实的条件</h3><ul>${list(k.conditions)}</ul><h3>原厂参考 · 尺寸与造型的依据</h3><div class="bay-references">${refs.map(r=>`<article><a href="${escapeHTML(referenceURL(r.url))}" target="_blank" rel="noopener noreferrer">${escapeHTML(r.title)} ↗</a><p>${escapeHTML(detailText(r.borrow))}</p></article>`).join('')}</div></footer>`;
  document.body.append(dialog);
  dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()});
  dialog.querySelectorAll('[data-kitchen-render]').forEach(button=>{
    const img=button.querySelector('img'),pending=button.querySelector('.bay-render-pending');
    const loaded=()=>{button.disabled=false;img.hidden=false;pending.hidden=true};
    const failed=()=>{button.disabled=true;img.hidden=true;pending.hidden=false};
    img.addEventListener('load',loaded);img.addEventListener('error',failed);if(img.complete){if(img.naturalWidth)loaded();else failed()}
    button.addEventListener('click',()=>{if(button.disabled)return;const view=button.dataset.kitchenRender;$('#large-render').src=schemeRender(scheme,view);$('#large-render').alt=img.alt;$('#large-render-caption').textContent=img.alt+' · '+renderProvenance(view);$('#image-dialog').showModal()});
  });
  const show=()=>{if($('#project-dialog').open)$('#project-dialog').close();if(state.walking)stopWalk();if(!dialog.open)dialog.showModal();dialog.scrollTop=0};
  for(const [parent,id,cls]of [['.sidebar-bottom','open-kitchen','quiet-link'],['#project-dialog','project-kitchen','project-bay-link'],['.room-card-copy','view-kitchen-fitout','secondary-link bay-card-link']]){const button=document.createElement('button');button.id=id;button.className=cls;button.textContent='厨房排布 · 尺寸与安装条件 ↗';button.addEventListener('click',show);$(parent).append(button)}
}

function kitchenExportNotes(source){
  const k=source.kitchenFitout;if(!k)return [];
  return [`厨房局部保守排布${k.localEnvelope.w*10}×${k.localEnvelope.d*10}mm；全屋仍沿${k.modelEnvelope.w*10}×${k.modelEnvelope.d*10}mm旧模型墙线。${k.adjustmentBand.w*10}mm调整段待核，不计入可用机位。`,'厨房符号为设备外形占位，非柜洞尺寸；吊柜虚线表示上方投影。洗碗机独立柜下，不在灶或水槽下方。',...(k.conditions||[]).map(note=>'厨房待核：'+(typeof note==='string'?note:note.text||note.description||''))];
}

function envelopeDimensions(source){
  const points=source.envelope||[[0,0],[841,0],[841,1401],[0,1401]],xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const north=points.filter(p=>Math.abs(p[1]-minY)<.001).map(p=>p[0]),south=points.filter(p=>Math.abs(p[1]-maxY)<.001).map(p=>p[0]);
  return {minX,maxX,minY,maxY,northLeft:Math.min(...north),northRight:Math.max(...north),southLeft:Math.min(...south),southRight:Math.max(...south)};
}
function windowModelNotes(source){
  return [['window_b','room_b','次卧北飘窗'],['window_a','room_a','主卧北飘窗'],['window_living_west','living','客厅西飘窗']].flatMap(([id,roomId,label])=>{
    const window=source.windows?.find(w=>w.id===id);if(!window)return [];
    const mm=cm=>Math.round(Number(cm)*10),width=mm(Math.hypot(window.x2-window.x1,window.y2-window.y1));
    const values=[`模型窗宽${width}mm`];
    if(Number.isFinite(window.heightCm))values.push(`窗高${mm(window.heightCm)}mm`);
    if(Number.isFinite(window.sillCm))values.push(`台高${mm(window.sillCm)}mm`);
    if(Number.isFinite(window.bay?.projectionCm))values.push(`外凸${mm(window.bay.projectionCm)}mm`);
    const pad=source.bayFitouts?.find(f=>f.roomId===roomId)?.parts?.find(p=>p.role==='seat_cushion');
    return [`${label}：${values.join('，')}${pad?`；软垫完成面${mm(pad.zCm+pad.hCm)}mm`:''}。`];
  });
}
function windowEvidenceExportNotes(source){
  if(!source?.measurementRevision)return [];
  const notes=[],bath=source.windows?.find(window=>window.id==='window_bath_1_east'),measured=bath?.measuredDimensions,placeholder=bath?.placeholderDecision;
  const mm=value=>Number.isFinite(value)?`${value}mm`:'待核';
  if(measured){
    notes.push(`主卫现状窗：实测宽${mm(measured.widthMm)}、高${mm(measured.heightMm)}；窗台${Number.isFinite(measured.sillMm)?mm(measured.sillMm):'未测'}，${measured.fullyLocated?'位置已登记，施工前复核':'定位待核'}。`);
    if(placeholder)notes.push(`主卫模型窗：${placeholder.geometry||'位置示意'}，台高${mm(placeholder.sillMm)}／窗高${mm(placeholder.heightMm)}；不作为现状与下单尺寸。`);
  }
  const master=source.windows?.find(window=>window.id==='window_a');
  if(master?.measurementStatus?.fullyLocated===false&&typeof master.designScenario==='string'){
    const locationNote=master.designScenario.split('。').find(note=>note.includes('定位')||note.includes('差值'));
    if(locationNote)notes.push('主卧定位说明：'+locationNote+'。');
  }
  return notes;
}
function wrapPlanFootnotes(notes,maxWidth,measure){
  return notes.flatMap(note=>{
    const lines=[];let line='';
    for(const character of String(note)){
      if(line&&measure(line+character)>maxWidth){lines.push(line);line=character}else line+=character;
    }
    if(line)lines.push(line);
    return lines;
  });
}
function makePlan(){
  const e=data.envelope||[[0,0],[841,0],[841,1401],[0,1401]],xs=e.map(p=>p[0]),ys=e.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const wallThickness=Number(data.wallThicknessCm)||12;
  const bayFrameFinish=data.bayDesign?.windowStyle?.frameFinish||'oak',bayFrameColor=bayFrameFinish==='warm-gray metal'?'#96948d':'#c9b28c';
  const bays=(data.windows||[]).filter(w=>w.windowType==='bay'&&w.bay).map(w=>{
    const length=Math.hypot(w.x2-w.x1,w.y2-w.y1),t=[(w.x2-w.x1)/length,(w.y2-w.y1)/length];
    const raw=w.bay.outward||[0,-1],normalLength=Math.hypot(...raw),n=raw.map(value=>value/normalLength);
    const projection=Number(w.bay.projectionCm)||60,side=Number(w.bay.returnThicknessCm)||10,half=wallThickness/2,frontHalf=(Number(w.bay.frontFrameDepthCm)||10)/2;
    const shift=(p,along,out)=>[p[0]+t[0]*along+n[0]*out,p[1]+t[1]*along+n[1]*out];
    const a=[w.x1,w.y1],b=[w.x2,w.y2],frontA=shift(a,0,half+projection),frontB=shift(b,0,half+projection);
    const outerA=shift(a,-side,-half),outerB=shift(b,side,-half),farA=shift(a,-side,half+projection+frontHalf),farB=shift(b,side,half+projection+frontHalf);
    const endA=shift(a,0,half+projection+frontHalf),endB=shift(b,0,half+projection+frontHalf);
    return {window:w,frontA,frontB,sill:[outerA,outerB,farB,farA],returns:[[outerA,shift(a,0,-half),endA,farA],[shift(b,0,-half),outerB,farB,endB]],frame:[shift(a,0,half+projection-frontHalf),shift(b,0,half+projection-frontHalf),endB,endA],label:shift([(a[0]+b[0])/2,(a[1]+b[1])/2],0,projection/2),vertical:Math.abs(t[1])>.5};
  });
  const planMinX=Math.min(minX,...bays.flatMap(b=>b.sill.map(p=>p[0]))),planMinY=Math.min(minY,...bays.flatMap(b=>b.sill.map(p=>p[1])));
  const fills={bedroom:'#eee5d5',living:'#eee8da',wet:'#e5e8e2',kitchen:'#e4e0d6',balcony:'#e6e9df'};
  const labels=[];
  const polygons=(data.rooms||[]).filter(r=>r.id!=='dining').map(r=>{
    const [cx,cy]=(data.laundry&&r.id==='balcony'?[745,981]:r.planLabel)||(r.id==='living'?[410,925]:r.id==='bath_1'?[535,419]:r.id==='bath_2'?[488,578]:centroid(r.points));if(data.familyPublicP2Revision&&r.id==='living')labels.push('<text x="507.5" y="701" text-anchor="middle" font-size="14" fill="#776d5b">客餐厅 · 过道</text><text x="507.5" y="718" text-anchor="middle" font-size="9" fill="#a2937b">33.3㎡（公共区合计）</text>');else labels.push(`<text x="${cx}" y="${cy}" text-anchor="middle" font-size="23" fill="#776d5b">${r.id==='living'?'客餐厅 · 过道':roomDescription(r.id).name}</text><text x="${cx}" y="${cy+30}" text-anchor="middle" font-size="16" fill="#a2937b">${(areaOf(r.points)/10000).toFixed(1)} ㎡${r.id==='living'?'（公共区合计）':r.id==='room_a'&&data.layout?.id==='suite'?'（含入口）':''}</text>`);
    return `<polygon class="plan-room" data-plan-room="${r.id}" tabindex="0" role="button" aria-label="查看${roomDescription(r.id).name}" points="${r.points.map(p=>p.join(',')).join(' ')}" fill="${fills[r.tone]||'#ece3d5'}"/>`;
  }).join('');
  if(data.layout?.entryZone){const z=data.layout.entryZone;labels.push(`<g data-suite-entry="private"><rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.d}" fill="none" stroke="#a98c63" stroke-dasharray="4 5" stroke-width="1.5"/><text x="${z.x+z.w/2}" y="${z.y+30}" text-anchor="middle" font-size="13" fill="#806b50">套内玄关</text><text x="${z.x+z.w/2}" y="${z.y+49}" text-anchor="middle" font-size="10" fill="#806b50">${z.w*10} × ${z.d*10}</text></g>`)}
  const storageIds=new Set((data.storageFitouts||[]).map(f=>f.id));
  const furniture=(activeDiningData().furniture||[]).filter(f=>!storageIds.has(f.storageFitoutId)).map(planFurniture).join('');
  const rug=data.modelAddons?.livingRugCm,lamp=data.modelAddons?.livingFloorLampCm;
  const livingSoft=data.familyFlowRevision&&rug&&lamp?`<g data-living-flow pointer-events="none"><rect data-living-rug x="${rug.x}" y="${rug.y}" width="${rug.w}" height="${rug.d}" rx="4" fill="#f5f1ea" stroke="#cdc6b9" stroke-dasharray="4 3" stroke-width="1"/><circle data-living-lamp cx="${lamp.x}" cy="${lamp.y}" r="22" fill="#e7e0d1" stroke="#a99b84" stroke-width="1.2"/><title>${data.familyPublicP2Revision?'地毯按电视柜前沿与沙发前沿居中，两端各70mm；茶几同轴。圆形为原位落地灯440mm灯罩投影。':'地毯随沙发东移并收回墙线内；圆形为落地灯440mm灯罩投影，电线贴墙固定。尺寸为暂估。'}</title></g>`:'';
  const wallFitouts=(data.wallFitouts||[]).map(f=>`<g data-wall-fitout="${escapeHTML(f.id)}" pointer-events="none"><title>${escapeHTML(f.description)} 上方投影，非落地柜。</title><rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.d}" fill="#f5f2ed" fill-opacity=".4" stroke="#8b928b" stroke-width="1.4" stroke-dasharray="5 4"/><text x="${f.x+f.w/2}" y="${f.y+f.d/2+4}" text-anchor="middle" font-size="11" fill="#747970">上方浅书架 · 虚线投影</text></g>`).join('');
  const fitouts=(data.bayFitouts||[]).flatMap(fitout=>[...(fitout.parts||[])].sort((a,b)=>(a.zCm||0)-(b.zCm||0)).map(part=>planFitoutPart(fitout,part))).join('');
  const storage=(data.storageFitouts||[]).flatMap(fitout=>[...(fitout.parts||[])].sort((a,b)=>(a.zCm||0)-(b.zCm||0)).map(part=>planStoragePart(fitout,part))).join('');
  const walls=(data.walls||[]).map(w=>`<line x1="${w[0]}" y1="${w[1]}" x2="${w[2]}" y2="${w[3]}" stroke="#8c887b" stroke-width="${wallThickness}" stroke-linecap="square"/>`).join('');
  const operation=w=>{
    const o=w.operation;if(!o)return '';
    if(o.type==='hinged'){
      const [x,y]=o.hingeCm,s=o.swing,r=w.widthMm/10-12;
      return `<g data-hinged-door="${escapeHTML(w.id)}" data-door-width-mm="${w.widthMm}" fill="none" stroke="#997750" stroke-width="1.8"><title>${escapeHTML(w.name)} · ${w.widthMm}mm门洞，非成品净开</title><path d="M${x+s.dx*r} ${y+s.dy*r} A${r} ${r} 0 0 ${s.sweep} ${x+s.ox*r} ${y+s.oy*r}" stroke-dasharray="3 3"/><path d="M${x} ${y} L${x+s.ox*r} ${y+s.oy*r}"/></g>`;
    }
    const p=o.panelCm,q=o.parkedCm;
    return `<g data-surface-slider="${escapeHTML(w.id)}" stroke="#a77c40"><title>书房推拉门：实线关闭，虚线为向北打开的停靠位</title><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.d}" fill="#c7b294"/><rect x="${q.x}" y="${q.y}" width="${q.w}" height="${q.d}" fill="none" stroke-dasharray="3 3"/><path d="M${p.x-8} ${q.y+89}V${q.y+26}m-4 6 4-6 4 6" fill="none"/></g>`;
  };
  const opening=(items,color)=>(items||[]).map(w=>`<line x1="${w.x1}" y1="${w.y1}" x2="${w.x2}" y2="${w.y2}" stroke="#fcf8ee" stroke-width="15"/><line data-opening-id="${escapeHTML(w.id)}" x1="${w.x1}" y1="${w.y1}" x2="${w.x2}" y2="${w.y2}" stroke="${w.sliding?'#fcf8ee':color}" stroke-width="4"/>${w.sliding?planSlidingDoor(w):operation(w)}`).join('');
  const bayWindows=bays.map(b=>`<g data-bay-window="${b.window.id}" aria-label="${escapeHTML(b.window.measurementStatus?b.window.name.replace(/（.*?）/g,''):b.window.name)}：${b.window.measurementStatus?'局部复尺已录入，定位及净空详见核对明细':'外凸窗台投影，尺寸待复尺'}"><line x1="${b.window.x1}" y1="${b.window.y1}" x2="${b.window.x2}" y2="${b.window.y2}" stroke="#fcf8ee" stroke-width="${wallThickness+3}"/><polygon data-bay-sill points="${b.sill.map(p=>p.join(',')).join(' ')}" fill="#e6dac1" stroke="#c5b497" stroke-width="1.5"/>${b.returns.map(points=>`<polygon data-bay-return points="${points.map(p=>p.join(',')).join(' ')}" fill="#8c887b"/>`).join('')}<text x="${b.label[0]}" y="${b.label[1]}" text-anchor="middle" dominant-baseline="middle" font-size="16" fill="#958165"${b.vertical?` transform="rotate(-90 ${b.label[0]} ${b.label[1]})"`:''}>飘窗台</text></g>`).join('');
  // The integrated worktop spans the sill; retain the true outer frame/glass above its plan fill.
  const bayFrames=bays.map(b=>`<g data-bay-frame-layer="${escapeHTML(b.window.id)}"><polygon data-bay-front-frame data-frame-finish="${escapeHTML(bayFrameFinish)}" points="${b.frame.map(p=>p.join(',')).join(' ')}" fill="${bayFrameColor}"/><line data-bay-glass x1="${b.frontA[0]}" y1="${b.frontA[1]}" x2="${b.frontB[0]}" y2="${b.frontB[1]}" stroke="#8fa6a8" stroke-width="4"/></g>`).join('');
  const topDimensionY=planMinY-52,leftDimensionX=planMinX-55,bottomDimensionY=maxY+54,dim=envelopeDimensions(data);
  const dimensionLabel=cm=>`${Math.round(cm*10).toLocaleString('en-US')}${data.measurementRevision?' · 旧模型参考':''}`;
  const dimensions=`<g data-envelope-dimensions="${data.measurementRevision?'old-reference':'model'}" stroke="#b4a58e" stroke-width="1.5" fill="none"><path d="M${dim.northLeft} ${topDimensionY}H${dim.northRight} M${dim.northLeft} ${topDimensionY-14}v28 M${dim.northRight} ${topDimensionY-14}v28 M${leftDimensionX} ${minY}V${maxY} M${leftDimensionX-14} ${minY}h28 M${leftDimensionX-14} ${maxY}h28 M${dim.southLeft} ${bottomDimensionY}H${dim.southRight} M${dim.southLeft} ${bottomDimensionY-14}v28 M${dim.southRight} ${bottomDimensionY-14}v28"/></g><g fill="#9c8d73" font-size="${data.measurementRevision?16:19}" text-anchor="middle"><text x="${(dim.northLeft+dim.northRight)/2}" y="${topDimensionY-17}">${dimensionLabel(dim.northRight-dim.northLeft)}</text><text x="${(dim.southLeft+dim.southRight)/2}" y="${bottomDimensionY+29}">${dimensionLabel(dim.southRight-dim.southLeft)}</text><text x="${leftDimensionX-20}" y="${(minY+maxY)/2}" transform="rotate(-90 ${leftDimensionX-20} ${(minY+maxY)/2})">${dimensionLabel(maxY-minY)}</text><text x="${maxX-48}" y="${topDimensionY-2}" font-size="23">N ↑</text></g>`;
  const diningState=hasPulloutDining()?`<g data-dining-state="${state.diningClosed?'closed':'expanded'}" pointer-events="none"><text x="410" y="1198" text-anchor="middle" font-size="11" fill="#829781">${state.diningClosed?'桌已收起 · 四椅靠柜停放':'三侧四席 · 先挪椅再收桌'}</text></g>`:'';
  $('#floor-plan').innerHTML=`<svg viewBox="${planMinX-115} ${planMinY-110} ${maxX-planMinX+160} ${maxY-planMinY+215}" role="img" aria-label="由同源尺寸数据绘制的三房两卫平面图，含厨房设备、飘窗与玄关餐边收纳条件方案；窗台投影不计入房间面积">${polygons}${livingSoft}${furniture}${storage}${diningState}${planGarage()}${planLaundry()}${planKitchen()}${walls}${opening((data.windows||[]).filter(w=>w.windowType!=='bay'),'#8fa6a8')}${bayWindows}${opening(data.doors,'#c2a071')}${fitouts}${bayFrames}${wallFitouts}${planPublicP2Art()}${labels.join('')}${dimensions}</svg>`;
  $$('#floor-plan [data-plan-room]').forEach(p=>{p.addEventListener('click',()=>selectRoom(p.dataset.planRoom));p.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectRoom(p.dataset.planRoom)}})});
}

// The authored closed pose keeps every full-size chair visible; nothing is
// assumed to fold or vanish. Both drawing and walking read this same variant.
function activeDiningData(){
  if(!hasPulloutDining()||!state.diningClosed)return data;
  return {...data,furniture:data.furniture.filter(f=>f.diningFitoutId!==data.pulloutDining.id).concat(data.pulloutDining.closedFurniture)};
}
function syncDiningControl(){
  const pullout=hasPulloutDining(),visible=Boolean(pullout&&['overall','dining','living'].includes(state.room));
  if(!pullout)state.diningClosed=false;
  $('#dining-state-controls').hidden=!visible;
  $('#workspace').classList.toggle('dining-controls-visible',visible);
  $('#toggle-dining-state').textContent=pullout?(state.diningClosed?'展开餐桌':'收起餐桌'):'固定餐桌';
  $('#toggle-dining-state').disabled=!pullout;
  $('#toggle-dining-state').setAttribute('aria-pressed',String(state.diningClosed));
  $('#toggle-dining-state').title=pullout?'先移椅再收桌；仅展示两端状态，不模拟完整五金过程':'';
  $('#dining-state-controls small').textContent=pullout?'先移椅再收桌 · 端状态示意':'';
}
function applyDiningVisibility(){
  model?.traverse(object=>{const pose=object.userData.diningVisibility;if(pose)object.visible=pose===(state.diningClosed?'closed':'expanded')});
}
function toggleDiningState(){
  if(!hasPulloutDining())return;
  if(state.walking)stopWalk({refocus:false});
  state.diningClosed=!state.diningClosed;
  applyDiningVisibility();makePlan();paintSchemePlan($('#floor-plan'));selectRoom(state.room,{updateHash:false,animate:false});
  if(walkthrough){walkWorld=buildWalkWorld(activeDiningData());walkthrough.world=walkWorld}
  toast(state.diningClosed?'收起示意：先挪椅，再折板推回；四椅靠西柜停放':'展开示意：三侧四席；五金过程仍须厂家深化');
  scheduleRender();
}

function exportPlan(openInTab=false){
  const source=$('#floor-plan svg');if(!source){toast('平面数据尚未载入');return}
  const svg=source.cloneNode(true),namespace='http://www.w3.org/2000/svg';
  const [x,y,width,height]=svg.getAttribute('viewBox').split(/\s+/).map(Number);
  const context=document.createElement('canvas').getContext('2d');
  if(context)context.font='15px "Microsoft YaHei", "PingFang SC", sans-serif';
  const measure=text=>context?context.measureText(text).width:Array.from(text).length*15;
  const footnotes=wrapPlanFootnotes([data.measurementRevision?'部分复尺应用；外轮廓、尺寸链及房间面积仍为旧模型参考，未完成全屋实测闭合。':'模型示意，未经完整实测；公共区面积含客厅、餐厅及过道。',...windowModelNotes(data),...windowEvidenceExportNotes(data),...kitchenExportNotes(data),...(data.woodRevision?.conditions||[]),...(data.familyR3Revision?.conditions||[]),...(data.familyPublicP2Revision?.conditions||[]),'飘窗投影不计房间面积；窗台高度不代表允许拆改。施工与防坠须专业复核。'],width-56,measure),extraHeight=180+footnotes.length*30;
  svg.setAttribute('xmlns',namespace);svg.setAttribute('viewBox',`${x} ${y-110} ${width} ${height+extraHeight}`);svg.setAttribute('width','1200');svg.setAttribute('height',String(Math.ceil(1200*(height+extraHeight)/width)));
  svg.removeAttribute('role');svg.removeAttribute('aria-label');
  svg.querySelectorAll('[tabindex],[role]').forEach(node=>{node.removeAttribute('tabindex');node.removeAttribute('role')});
  const title=document.createElementNS(namespace,'title');title.textContent='荟雅苑 · 同源模型平面示意（非施工图）';svg.prepend(title);
  const background=document.createElementNS(namespace,'rect');Object.entries({x,y:y-110,width,height:height+extraHeight,fill:'#fffcf6'}).forEach(([key,value])=>background.setAttribute(key,String(value)));svg.insertBefore(background,title.nextSibling);
  const addText=(text,atY,size,color,footnote=false)=>{const node=document.createElementNS(namespace,'text');Object.entries({x:x+24,y:atY,'font-size':size,fill:color,'font-family':'Microsoft YaHei, PingFang SC, sans-serif'}).forEach(([key,value])=>node.setAttribute(key,String(value)));if(footnote)node.dataset.exportFootnote='';node.textContent=text;svg.appendChild(node)};
  addText(`荟雅苑 · ${scheme?.name||'三房两卫'} / 同源模型平面`,y-57,26,'#615943');
  addText(`模型示意，非施工图 · 单位：mm${data.measurementRevision?' · '+data.measurementRevision.date+' 部分复尺修订':' · 墙体、门窗与管井需现场复尺'}`,y-20,16,'#96856a');
  footnotes.forEach((note,i)=>addText(note,y+height+30+i*30,15,'#96856a',true));
  svg.querySelectorAll('text').forEach(node=>node.setAttribute('font-family','Microsoft YaHei, PingFang SC, sans-serif'));
  const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml;charset=utf-8'}));
  if(openInTab){const tab=window.open(url,'_blank');if(tab){tab.opener=null;toast('已打开高清平面，可滚动查看或用浏览器缩放')}else toast('新标签未能打开，请允许弹窗或点击 SVG 下载')}
  else{const link=document.createElement('a');link.href=url;link.download='荟雅苑-同源模型平面示意-非施工图.svg';link.click()}
  if(!openInTab)setTimeout(()=>URL.revokeObjectURL(url),60000);
}

async function buildScene(){
  try{
    const [{default:unused,...THREE},{OrbitControls},{GLTFLoader},{mergeGeometries}]=await Promise.all([import('three'),import('three/addons/controls/OrbitControls.js'),import('three/addons/loaders/GLTFLoader.js'),import('three/addons/utils/BufferGeometryUtils.js')]);
    three=THREE;
    const container=$('#model-canvas');
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1));renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
    renderer.shadowMap.enabled=false;renderer.shadowMap.autoUpdate=false;renderer.localClippingEnabled=true;
    container.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','荟雅苑交互式三维模型');renderer.domElement.tabIndex=0;
    scene=new THREE.Scene();
    camera=new THREE.PerspectiveCamera(37,1,.35,80);
    controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=.25;controls.maxDistance=45;controls.maxPolarAngle=Math.PI*.49;controls.target.set(4.2,.6,7);
    controls.addEventListener('start',()=>{cameraTween=null});controls.addEventListener('change',scheduleRender);
    const softWarm=scheme.appearance?.preset==='soft-warm';
    scene.add(new THREE.HemisphereLight(softWarm?0xfffdf8:0xfff9ed,softWarm?0xc3c1bb:0xc2b69f,2.15));
    const sun=new THREE.DirectionalLight(softWarm?0xfffcf7:0xfff6e7,2.4);sun.position.set(-5,14,-4);sun.castShadow=false;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
    const fill=new THREE.DirectionalLight(softWarm?0xf7f9ff:0xfffbf2,1.0);fill.position.set(12,8,18);scene.add(fill);
    const loader=new GLTFLoader();
    const gltf=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Model load timeout')),45000);loader.load(revisedAsset(scheme.model),result=>{clearTimeout(timer);resolve(result)},event=>{
      const p=event.total?Math.min(98,Math.round(event.loaded/event.total*100)):Math.min(93,10+Math.round(event.loaded/1024/100));$('#loading-progress').style.width=p+'%';$('#loading-status').textContent=event.total?`正在载入模型 · ${p}%`:`正在载入模型 · ${(event.loaded/1024/1024).toFixed(1)} MB`;
    },error=>{clearTimeout(timer);reject(error)})});
    model=optimizeStaticModel(gltf.scene,THREE,mergeGeometries);
    model.traverse(object=>{
      if(!object.isMesh)return;object.castShadow=false;object.receiveShadow=false;
      // The low-power viewer does not compute planar reflections. Keep mirrors
      // readable here; the downloaded scene and Cycles images retain reflection.
      (Array.isArray(object.material)?object.material:[object.material]).forEach(material=>{
        if(material.name==='Mirror'){material.color.set(0xb9c4be);material.metalness=.12;material.roughness=.28;}
      });
      let owner=object,kind=object.userData.kind;
      while(!kind&&owner.parent){owner=owner.parent;kind=owner.userData.kind}
      if(kind==='floor'){
        const materials=(Array.isArray(object.material)?object.material:[object.material]).map(material=>{const clone=material.clone();if(clone.name!=='Grout'){clone.polygonOffset=true;clone.polygonOffsetFactor=-1;clone.polygonOffsetUnits=-1}if(clone.map)clone.map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return clone});object.material=Array.isArray(object.material)?materials:materials[0];
      }
      if(['wall','window','door'].includes(kind)){
        const materials=(Array.isArray(object.material)?object.material:[object.material]).map(m=>{const clone=m.clone();wallMaterials.push(clone);return clone});object.material=Array.isArray(object.material)?materials:materials[0];
      }
    });applyDiningVisibility();scene.add(model);state.ready=true;
    buildLabels();setWalls(true);focusRoom(state.room,false,false);resizeScene();
    try{setupWalk()}catch(error){console.error('Walk setup failed',error);walkthrough?.dispose();walkthrough=null;$('#start-walk').disabled=true;$('#start-walk').textContent='漫游暂不可用'}
    resizeObserver=new ResizeObserver(resizeScene);resizeObserver.observe(container);
    $('#model-loading').hidden=true;
    renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();showFallback('浏览器的三维显示连接已中断。刷新页面可重新载入。')});
    const pointerStart={x:0,y:0};renderer.domElement.addEventListener('pointerdown',e=>{pointerStart.x=e.clientX;pointerStart.y=e.clientY});
    renderer.domElement.addEventListener('pointerup',event=>{
      if(state.interior||Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>5)return;
      const rect=renderer.domElement.getBoundingClientRect(),pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);const ray=new THREE.Raycaster();ray.setFromCamera(pointer,camera);
      for(const hit of ray.intersectObject(model,true)){
        if(!hit.object.visible)continue;
        if(state.cutWalls&&hit.point.y>1.25)continue;
        let object=hit.object;while(object&&!object.userData.roomId)object=object.parent;
        if(object?.userData.roomId&&descriptions[object.userData.roomId]){selectRoom(object.userData.roomId);break}
      }
    });
    scheduleRender();
  }catch(error){console.error('3D load failed',error);showFallback('当前设备或网络未能载入 3D 模型，平面与 Blender 渲染仍可查看。')}
}

function showFallback(message){stopWalk({refocus:false});$('#start-walk').disabled=true;state.ready=false;if(pendingFrame!==null){cancelAnimationFrame(pendingFrame);pendingFrame=null}$('#model-loading').hidden=true;$('#model-fallback').hidden=false;$('#fallback-message').textContent=message;$('#room-labels').hidden=true;$$('.viewer-controls button').forEach(button=>button.disabled=true);$('#model-hint').hidden=true}
function resizeScene(){if(!renderer||!camera)return;const {width,height}=$('#model-canvas').getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;if(activeHorizontalFov)camera.fov=2*Math.atan(Math.tan(activeHorizontalFov*Math.PI/360)/camera.aspect)*180/Math.PI;camera.updateProjectionMatrix();if(state.ready&&state.room==='overall'&&!state.interior&&(matchMedia('(max-width: 860px)').matches||camera.view?.enabled))focusRoom('overall',false,false);scheduleRender()}


function setupWalk(){
  walkWorld=buildWalkWorld(activeDiningData());
  const ids=new Set(walkWorld.doors.map(door=>door.id));
  // Original floors end at the room's inner wall face. Bridge only existing
  // door-thickness gaps while their leaves are open for walking.
  walkThresholds=new three.Group();walkThresholds.name='Walk-only doorway floor infills';walkThresholds.visible=false;
  for(const door of walkWorld.doors){
    if(door.sliding||door.operation)continue; // Authored doors already have a persistent flush floor.
    const horizontal=Math.abs(door.y1-door.y2)<.01;
    const width=Math.hypot(door.x2-door.x1,door.y2-door.y1)/100;
    const wet=door.id.includes('bath')||door.id==='balcony_door';
    const floor=new three.Mesh(new three.BoxGeometry(horizontal?width:.122,.012,horizontal?.122:width),new three.MeshStandardMaterial({color:wet?0xcac3b3:0xc9ac7a,roughness:.85}));
    floor.name='Walk threshold '+door.id;floor.position.set((door.x1+door.x2)/200,-.006,(door.y1+door.y2)/200);floor.userData={kind:'walk-threshold',openingId:door.id};walkThresholds.add(floor);
  }
  scene.add(walkThresholds);
  model.traverse(object=>{if(!ids.has(object.userData.openingId))return;if(object.userData.doorRole==='sliding-panel'&&object.userData.slideOpenOffsetM?.length===3)walkSlidingParts.push(object);else if(object.userData.walkDoorInfill)walkDoorParts.push(object)});
  walkthrough=new WalkController({
    canvas:renderer.domElement,world:walkWorld,onWake:scheduleRender,onExit:()=>stopWalk(),
    canInteract:()=>state.walking&&state.view==='model'&&!document.querySelector('dialog[open]')&&$('#download-popover').hidden,
    onPose:pose=>{
      camera.position.set(pose.x,pose.eyeHeight,pose.z);
      const level=Math.cos(pose.pitch);
      camera.lookAt(pose.x+Math.sin(pose.yaw)*level,pose.eyeHeight+Math.sin(pose.pitch),pose.z-Math.cos(pose.yaw)*level);
      camera.updateMatrixWorld();
      $('#walk-room-name').textContent=pose.roomId?roomDescription(pose.roomId).name:'门口 · 通道';
    }
  });
  $$('#walk-pad [data-walk-direction]').forEach(button=>walkthrough.bindPad(button,button.dataset.walkDirection));
  $('#start-walk').disabled=false;
}
function startWalk(){
  if(state.walking)return;
  if(!state.ready||!walkthrough){toast('三维模型正在载入，请稍后再进入漫游');return}
  if(document.querySelector('dialog[open]'))return;
  switchView('model');
  const fittedKitchen=state.room==='kitchen'&&Boolean(data?.kitchenFitout);
  const narrowKitchen=fittedKitchen&&matchMedia('(max-width: 860px)').matches;
  const seed=fittedKitchen?[6.55,12.25]:data?.woodRevision?.version==='3.9.0'&&state.room==='bath_1'?[5.2,3.7]:WALK_STARTS[state.room]||WALK_STARTS.overall;
  const start=findWalkStart(walkWorld,state.room,{x:seed[0],z:seed[1]});
  if(!start){toast('这个空间暂时没有合适的站立位置，请从全屋入口进入');return}
  walkRestore={cutWalls:state.cutWalls,doors:walkDoorParts.map(part=>[part,part.visible]),sliding:walkSlidingParts.map(part=>[part,part.position.clone()])};
  walkDoorParts.forEach(part=>part.visible=false);walkThresholds.visible=true;
  walkSlidingParts.forEach(part=>part.position.add(new three.Vector3(...part.userData.slideOpenOffsetM)));
  cameraTween=null;controls.enabled=false;state.walking=true;state.interior=true;
  activeHorizontalFov=null;camera.clearViewOffset();camera.near=.045;camera.fov=64;camera.updateProjectionMatrix();
  setWalls(false);$('#workspace').classList.add('walking');$('#walk-hud').hidden=false;$('#walk-pad').hidden=false;$('#walk-look-hint').hidden=false;
  $('#download-popover').hidden=true;$('#download-toggle').setAttribute('aria-expanded','false');
  const target=fittedKitchen?(narrowKitchen?[6.495,1.05,13.575]:[7.35,1.15,13.4]):roomById(state.room)?.interiorCamera?.target;
  const yaw=target?Math.atan2(target[0]-start.x,start.z-target[2]):0;
  walkthrough.start(start,yaw);
  if(fittedKitchen){walkthrough.pitch=narrowKitchen?-.38:-.25;walkthrough.publish();scheduleRender()}
  toast('已进入第一人称漫游 · 拖动转头，按键移动');
}
function stopWalk({refocus=true,restoreFocus=true}={}){
  if(!state.walking)return;
  walkthrough?.stop();cameraTween=null;state.walking=false;state.interior=false;
  for(const [part,visible]of walkRestore?.doors||[])part.visible=visible;
  for(const [part,position]of walkRestore?.sliding||[])part.position.copy(position);
  if(walkThresholds)walkThresholds.visible=false;
  controls.enabled=true;$('#workspace').classList.remove('walking');
  $('#walk-hud').hidden=true;$('#walk-pad').hidden=true;$('#walk-look-hint').hidden=true;
  if(refocus&&state.ready)focusRoom(state.room,false,false);
  setWalls(walkRestore?.cutWalls??true);walkRestore=null;
  if(refocus&&restoreFocus)$('#start-walk').focus({preventScroll:true});
  scheduleRender();
}

function optimizeStaticModel(source,THREE,mergeGeometries){
  source.updateMatrixWorld(true);
  const groups=new Map(),optimized=new THREE.Group();optimized.name='Static room batches';
  source.traverse(object=>{
    if(!object.isMesh)return;
    let owner=object,semantic={};
    while(owner){for(const key of ['kind','roomId','external','wallIndex','openingId','doorRole','diningVisibility','diningFitoutId'])if(semantic[key]===undefined&&owner.userData[key]!==undefined)semantic[key]=owner.userData[key];owner=owner.parent}
    const originalMaterial=object.material;
    if(semantic.diningVisibility||semantic.kind==='door'||Array.isArray(originalMaterial)||object.isSkinnedMesh||originalMaterial.transparent||originalMaterial.transmission>0){
      const clone=object.clone(false);clone.geometry=object.geometry.clone().applyMatrix4(object.matrixWorld);clone.position.set(0,0,0);clone.quaternion.identity();clone.scale.set(1,1,1);clone.userData={...object.userData,...semantic,walkDoorInfill:Boolean(isWalkDoorInfill(object.name,semantic))};optimized.add(clone);return;
    }
    const signature=Object.keys(object.geometry.attributes).sort().map(key=>`${key}:${object.geometry.attributes[key].itemSize}`).join(',');
    const key=[originalMaterial.uuid,semantic.kind||'',semantic.roomId||'',semantic.external||false,signature].join('|');
    if(!groups.has(key))groups.set(key,{material:originalMaterial,semantic,geometries:[]});
    let geometry=object.geometry.clone().applyMatrix4(object.matrixWorld);
    if(geometry.index){const unindexed=geometry.toNonIndexed();geometry.dispose();geometry=unindexed}
    groups.get(key).geometries.push(geometry);
  });
  for(const group of groups.values()){
    const merged=group.geometries.length>1?mergeGeometries(group.geometries,false):group.geometries[0];
    if(merged){const mesh=new THREE.Mesh(merged,group.material);mesh.userData={...group.semantic};mesh.name=`${group.semantic.roomId||'home'} ${group.semantic.kind||'furniture'}`;optimized.add(mesh);if(group.geometries.length>1)group.geometries.forEach(g=>g.dispose())}
    else for(const geometry of group.geometries){const mesh=new THREE.Mesh(geometry,group.material);mesh.userData={...group.semantic};optimized.add(mesh)}
  }
  let before=0;source.traverse(object=>{if(object.isMesh)before++});console.info(`Static model: ${before} meshes → ${optimized.children.length} batches`);
  return optimized;
}

function scheduleRender(){if(state.ready&&state.view==='model'&&!document.hidden&&pendingFrame===null)pendingFrame=requestAnimationFrame(tick)}

function fitMobileOverview(position,target){
  const viewport=$('#model-canvas').getBoundingClientRect(),card=$('#room-card').getBoundingClientRect();
  const width=viewport.width,height=viewport.height;if(!width||!height)return {position,target};
  const safe={left:20,right:width-20,top:120,bottom:state.roomCardVisible&&card.height>0?card.top-viewport.top-18:height-82};
  safe.bottom=Math.max(safe.top+150,safe.bottom);
  const bounds=manifest?.bounds||{min:[0,-.012,0],max:[8.41,2.7,14.01]};
  const center=new three.Vector3(...bounds.min).add(new three.Vector3(...bounds.max)).multiplyScalar(.5);
  const direction=position.clone().sub(target).normalize(),corners=[];
  for(const x of [bounds.min[0],bounds.max[0]])for(const y of [bounds.min[1],bounds.max[1]])for(const z of [bounds.min[2],bounds.max[2]])corners.push(new three.Vector3(x,y,z));
  const probe=camera.clone();probe.clearViewOffset();probe.aspect=width/height;probe.updateProjectionMatrix();
  const project=distance=>{probe.position.copy(center).addScaledVector(direction,distance);probe.lookAt(center);probe.updateMatrixWorld(true);const points=corners.map(point=>point.clone().project(probe));return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.max(...points.map(p=>p.y)),bottom:Math.min(...points.map(p=>p.y))}};
  let low=5,high=65;
  for(let i=0;i<24;i++){const distance=(low+high)/2,b=project(distance);if((b.right-b.left)*width/2>safe.right-safe.left||(b.top-b.bottom)*height/2>safe.bottom-safe.top)low=distance;else high=distance}
  const distance=high*1.025,b=project(distance);
  const currentX=((b.left+b.right)/2*.5+.5)*width,currentY=(-((b.top+b.bottom)/2)*.5+.5)*height;
  camera.aspect=width/height;camera.setViewOffset(width,height,currentX-(safe.left+safe.right)/2,currentY-(safe.top+safe.bottom)/2,width,height);
  controls.maxDistance=Math.max(45,distance*1.5);
  return {position:center.clone().addScaledVector(direction,distance),target:center};
}

function focusRoom(id,interior=false,animate=true){
  if(state.walking)stopWalk({refocus:false});
  if(!state.ready)return;
  let preset;
  if(id==='overall')preset=manifest?.overviewCamera||{position:[15,15,21],target:[4.2,.6,7]};
  else{
    const room=roomById(id);preset=interior?room?.interiorCamera:room?.camera;
    if(!preset){const center=room?.points?.length?centroid(room.points):[4.2,7];preset=interior?{position:[center[0]-.6,1.55,center[1]+1.5],target:[center[0],1.2,center[1]-.6]}:{position:[center[0]+5,7,center[1]+6],target:[center[0],.4,center[1]]}}
  }
  if(id==='kitchen'&&data?.kitchenFitout&&!interior)preset={position:[4.8,4.5,12.6],target:[7.05,.75,12.65],fov:46};
  state.interior=interior;
  if(interior){setWalls(false);controls.maxPolarAngle=Math.PI*.97;toast('已进入房间 · 拖动环视，滚轮前后移动')}
  else{controls.maxPolarAngle=Math.PI*.49;if(!state.cutWalls)setWalls(true)}
  activeHorizontalFov=preset.horizontalFov || null;
  camera.near=interior ? 0.05 : 0.35;
  camera.clearViewOffset();controls.maxDistance=45;
  camera.fov=activeHorizontalFov?2*Math.atan(Math.tan(activeHorizontalFov*Math.PI/360)/camera.aspect)*180/Math.PI:(preset.fov || (interior?62:37));camera.updateProjectionMatrix();
  let position=new three.Vector3(...preset.position),target=new three.Vector3(...preset.target);
  if(!interior&&matchMedia('(max-width: 860px)').matches){if(id==='overall')({position,target}=fitMobileOverview(position,target));else position.sub(target).multiplyScalar(1.16).add(target)}
  defaultDistance=position.distanceTo(target);$('#zoom-level').textContent='100%';
  if(animate&&!reducedMotion)cameraTween={start:performance.now(),fromPosition:camera.position.clone(),fromTarget:controls.target.clone(),toPosition:position,toTarget:target};
  else{camera.position.copy(position);controls.target.copy(target);controls.update()}
  $('#enter-room').innerHTML=`${id==='overall'?'步行看全屋':'步行进入'+roomDescription(id).name} <span>↗</span>`;
  scheduleRender();
}

function setWalls(cut){
  state.cutWalls=cut;$('#cut-walls').classList.toggle('selected',cut);$('#cut-walls').setAttribute('aria-pressed',String(cut));
  if(!three)return;const clipPlane=new three.Plane(new three.Vector3(0,-1,0),1.22);
  wallMaterials.forEach(material=>{material.clippingPlanes=cut?[clipPlane]:[];material.clipShadows=true;material.needsUpdate=true});
  scheduleRender();
}

function buildLabels(){
  const layer=$('#room-labels');layer.innerHTML='';
  rooms.forEach(room=>{
    let center=room.labelPosition?null:centroid(room.points||[[4.2,7]]);
    let position=room.labelPosition||[center[0],.52,center[1]];
    if(room.id==='living')position=[4.4,.6,8.7];if(room.id==='dining')position=[3.7,.6,12.6];
    const element=document.createElement('button');element.className='space-label';element.textContent=roomDescription(room.id).name;element.setAttribute('aria-label',`聚焦${element.textContent}`);element.addEventListener('click',()=>selectRoom(room.id));layer.appendChild(element);roomLabelNodes.push({id:room.id,element,point:new three.Vector3(...position)});
  });
  const dim=envelopeDimensions(data),{minX,minY,maxY,northLeft,northRight,southLeft,southRight}=dim;
  const label=cm=>`${Math.round(cm*10).toLocaleString('en-US')} mm${data.measurementRevision?' · 旧模型参考':''}`;
  [{label:label(northRight-northLeft),point:[(northLeft+northRight)/200,.05,(minY-60)/100]},{label:label(maxY-minY),point:[(minX-70)/100,.05,(minY+maxY)/200]},{label:label(southRight-southLeft),point:[(southLeft+southRight)/200,.05,(maxY+54)/100]}].forEach(item=>{const element=document.createElement('span');element.className='dimension-label';element.textContent=item.label;layer.appendChild(element);dimensionNodes.push({element,point:new three.Vector3(...item.point)})});
  const lines=[[[northLeft,minY-45],[northRight,minY-45]],[[northLeft,minY-62],[northLeft,minY-28]],[[northRight,minY-62],[northRight,minY-28]],[[minX-45,minY],[minX-45,maxY]],[[minX-62,minY],[minX-28,minY]],[[minX-62,maxY],[minX-28,maxY]],[[southLeft,maxY+44],[southRight,maxY+44]],[[southLeft,maxY+27],[southLeft,maxY+61]],[[southRight,maxY+27],[southRight,maxY+61]]].map(line=>line.map(point=>point.map(n=>n/100)));
  const geometry=new three.BufferGeometry().setFromPoints(lines.flatMap(line=>line.map(([x,z])=>new three.Vector3(x,.01,z))));
  dimensionLines=new three.LineSegments(geometry,new three.LineBasicMaterial({color:0xa29072,transparent:true,opacity:.7}));dimensionLines.visible=false;scene.add(dimensionLines);
}

const projected = {value:null};
function tick(time){
  pendingFrame=null;
  if(!state.ready||document.hidden||state.view!=='model')return;
  const walkingFrame=state.walking;
  const walkMoving=walkingFrame?walkthrough?.update(time):false;
  if(!walkingFrame&&cameraTween){const progress=Math.min(1,(performance.now()-cameraTween.start)/850),ease=1-Math.pow(1-progress,3);camera.position.lerpVectors(cameraTween.fromPosition,cameraTween.toPosition,ease);controls.target.lerpVectors(cameraTween.fromTarget,cameraTween.toTarget,ease);if(progress===1)cameraTween=null}
  if(!walkingFrame)controls.update();
  if(dimensionLines)dimensionLines.visible=state.dimensions&&!state.interior;
  $('#zoom-level').textContent=Math.round(defaultDistance/camera.position.distanceTo(controls.target)*100)+'%';
  const width=renderer.domElement.clientWidth,height=renderer.domElement.clientHeight;
  if(!projected.value)projected.value=new three.Vector3();
  [...roomLabelNodes,...dimensionNodes].forEach(item=>{
    const isDimension=item.element.classList.contains('dimension-label'),enabled=isDimension?state.dimensions:state.labels;
    const point=projected.value.copy(item.point).project(camera);const x=(point.x*.5+.5)*width,y=(-point.y*.5+.5)*height;
    const isSmall=width<700;
    const inBounds=point.z<1&&point.z>-1&&x>30&&x<width-30&&y>108&&y<height-(isSmall?170:65);
    item.element.hidden=!enabled||state.interior||!inBounds;
    if(!item.element.hidden){item.element.style.left=x+'px';item.element.style.top=y+'px'}
  });
  try{renderer.render(scene,camera)}catch(error){console.error('Model render failed',error);showFallback('当前设备未能完成三维绘制，可以继续查看同源平面与 Blender 效果图。');return}
  if(cameraTween||walkMoving)scheduleRender();
}

function bindControls(){
  let visible=true;try{visible=sessionStorage.getItem(ROOM_CARD_STORAGE_KEY)!=='false'}catch{}
  setRoomCardVisible(visible,{persist:false});
  $('#toggle-room-card').addEventListener('click',()=>setRoomCardVisible(!state.roomCardVisible));
  $('#toggle-dining-state').addEventListener('click',toggleDiningState);
  $('#room-card-toggle').addEventListener('click',()=>setRoomCardVisible(false));
  $('#open-plan').addEventListener('click',()=>exportPlan(true));$('#download-plan').addEventListener('click',()=>exportPlan(false));
  $$('.view-tabs [data-view]').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.view)));
  $('.view-tabs').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;const views=['model','plan','renders'],next=(views.indexOf(state.view)+(event.key==='ArrowRight'?1:2))%3;switchView(views[next]);$(`[data-view="${views[next]}"]`).focus()});
  $('#reset-camera').addEventListener('click',()=>focusRoom(state.room));
  [['#zoom-in',.82],['#zoom-out',1.22]].forEach(([id,factor])=>$(id).addEventListener('click',()=>{if(!state.ready||state.walking)return;cameraTween=null;const direction=camera.position.clone().sub(controls.target);direction.setLength(Math.max(controls.minDistance,Math.min(controls.maxDistance,direction.length()*factor)));camera.position.copy(controls.target).add(direction);controls.update()}));
  $('#cut-walls').addEventListener('click',()=>{setWalls(!state.cutWalls);toast(state.cutWalls?'已切为低墙视图':'已恢复完整墙体')});
  $('#toggle-labels').addEventListener('click',()=>{state.labels=!state.labels;$('#toggle-labels').classList.toggle('selected',state.labels);$('#toggle-labels').setAttribute('aria-pressed',String(state.labels));scheduleRender()});
  $('#toggle-dimensions').addEventListener('click',()=>{state.dimensions=!state.dimensions;$('#toggle-dimensions').classList.toggle('selected',state.dimensions);$('#toggle-dimensions').setAttribute('aria-pressed',String(state.dimensions));if(state.dimensions)toast('标注为图纸轮廓尺寸，完整尺寸请查看平面');scheduleRender()});
  $('#enter-room').addEventListener('click',()=>{if(!state.ready){switchView('renders');return}startWalk()});
  $('#start-walk').addEventListener('click',startWalk);$('#exit-walk').addEventListener('click',()=>stopWalk());
  $('#walk-help').addEventListener('click',()=>{walkthrough?.pause();$('#walk-help-dialog').showModal()});
  // Opening any UI surface clears held input, including keyboard-activated
  // buttons. Movement-pad presses are the deliberate exception.
  document.addEventListener('click',event=>{if(state.walking&&event.target.closest('button,a,dialog')&&!event.target.closest('#walk-pad'))walkthrough?.pause()},true);
  window.addEventListener('pagehide',()=>stopWalk({restoreFocus:false}));
  $('#view-room-render').addEventListener('click',()=>switchView('renders'));$('#fallback-renders').addEventListener('click',()=>switchView('renders'));
  $('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('#workspace').requestFullscreen()}catch{toast('当前浏览器不支持全屏，可使用横屏查看')}});
  ['#open-project','#open-dimensions'].forEach(id=>$(id).addEventListener('click',()=>$('#project-dialog').showModal()));
  $('#open-measurement').addEventListener('click',showMeasurement);
  ['#open-bays','#view-bay-fitout','#project-bay-link'].forEach(id=>$(id).addEventListener('click',()=>{if($('#project-dialog').open)$('#project-dialog').close();showBayFitouts()}));
  ['#open-storage','#view-storage-fitout','#project-storage-link'].forEach(id=>$(id).addEventListener('click',()=>{if($('#project-dialog').open)$('#project-dialog').close();showStorageFitouts()}));
  $$('.dialog-close').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
  $$('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close()}}));
  ['#view-suite-entry','#project-suite-entry'].forEach(id=>$(id).addEventListener('click',()=>{if(data?.layout?.id!=='suite')return;$('#large-render').src=schemeRender(scheme,'suite-entry');$('#large-render').alt='主卧套内小玄关：向北到床区、向东进主卫';$('#large-render-caption').textContent='主卧入口 · '+renderProvenance('suite-entry');$('#image-dialog').showModal()}));
  $('#enlarge-render').addEventListener('click',()=>{if(!scheme||!data)return;$('#large-render').src=renderPath(state.room);$('#large-render').alt=$('#active-render').alt;$('#large-render-caption').textContent=[scheme.name,roomDescription(state.room).name,renderProvenance(renderPath(state.room)),measurementRoomNotice(state.room)].filter(Boolean).join(' · ');$('#image-dialog').showModal()});
  $('#active-render').addEventListener('error',()=>{$('#render-unavailable').hidden=false});$('#active-render').addEventListener('load',()=>{$('#render-unavailable').hidden=true});
  $('#room-preview').addEventListener('error',()=>{$('#room-preview').style.display='none'});$('#room-preview').addEventListener('load',()=>{$('#room-preview').style.display=''});
  $('#download-toggle').addEventListener('click',()=>{const open=$('#download-popover').hidden;$('#download-popover').hidden=!open;$('#download-toggle').setAttribute('aria-expanded',String(open))});
  document.addEventListener('click',event=>{if(!event.target.closest('.download-menu')){$('#download-popover').hidden=true;$('#download-toggle').setAttribute('aria-expanded','false')}});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){$('#download-popover').hidden=true;$('#download-toggle').setAttribute('aria-expanded','false')}});
  $('.brand').addEventListener('click',event=>{event.preventDefault();selectRoom('overall');switchView('model')});
  window.addEventListener('hashchange',()=>selectRoom(location.hash.slice(1),{updateHash:false}));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&controls){if(!state.walking)controls.update();scheduleRender()}});
}

async function init(){
  bindControls();
  try{
    schemeCatalog=await loadSchemeCatalog();
    const requested=new URLSearchParams(location.search).get('scheme')||schemeCatalog.defaultScheme||'wood';
    const resolved=resolveScheme(schemeCatalog,requested);scheme=resolved.scheme;
    if(resolved.retired)toast('已收起配色版本，现保留原木方案；房间位置不变。');
    if(!scheme)throw new Error('未找到请求的设计方案：'+requested);
    ASSET_REVISION=scheme.assetRevision||UI_REVISION;
    const url=new URL(location.href);url.searchParams.set('scheme',scheme.id);url.searchParams.set('v',UI_REVISION);history.replaceState(null,'',url);
    Object.keys(scheme.roomOverrides||{}).forEach(id=>{if(descriptions[id])descriptions[id]={...descriptions[id],...schemeTextOverride(scheme.roomOverrides,id)}});
    configureScheme();
  }catch(error){console.error('Scheme catalogue load failed',error);$('#loading-status').textContent='方案目录暂未载入';$('#model-loading').hidden=true;$('#scheme-load-error strong').textContent=schemeCatalog?(new URLSearchParams(location.search).get('scheme')==='suite'?'暖白套间已移除，请返回方案选择':'未找到这个设计方案'):'设计资料暂未载入';$('#scheme-load-error').hidden=false;return}
  const results=await Promise.allSettled([getDesignData(),getJSON(scheme.manifest)]);
  data=results[0].status==='fulfilled'?results[0].value:null;manifest=results[1].status==='fulfilled'?results[1].value:{};
  if(!data){$('#loading-status').textContent='尺寸数据暂未载入';makeNavigation();showFallback('页面的尺寸数据暂未能载入，请稍后刷新。');return}
  metadataOnlyRenderProof=await validateMetadataOnlySourceRefresh(data,manifest);
  data={...data,bayFitouts:(data.bayFitouts||[]).map(f=>({...f,...schemeTextOverride(scheme.bayOverrides,f.id)})),storageFitouts:(data.storageFitouts||[]).map(f=>({...f,...schemeTextOverride(scheme.storageOverrides,f.id)}))};
  const revisedRoomIds=new Set([...Object.keys(data.measurementRevision?.roomDescriptions||{}),...Object.keys(data.purchasedFurnitureRevision?.roomDescriptions||{})]);
  const measuredDescriptions=Object.fromEntries([...revisedRoomIds].map(id=>{const measured=data.measurementRevision?.roomDescriptions?.[id],purchased=data.purchasedFurnitureRevision?.roomDescriptions?.[id],title=purchased?({living:'浅米色沙发，日常围坐',dining:'白蜡木桌边，一日三餐'})[id]:null;return [id,{...(typeof measured==='object'?schemeTextOverride({[id]:measured},id):{}),...(title?{title}:{}),...(typeof purchased==='object'?schemeTextOverride({[id]:purchased},id):{}),description:purchasedRoomDescription(id)||measurementRoomDescription(id)}]}));
  Object.assign(measuredDescriptions,data.woodRevision?.roomDescriptions||{},data.familyR3Revision?.roomDescriptions||{});
  for(const [id,override]of Object.entries(measuredDescriptions))if(descriptions[id])descriptions[id]={...descriptions[id],...override};
  const rawRooms=data.rooms.map(room=>({...room,points:room.points.map(p=>p.map(n=>n/100)),area:areaOf(room.points)/10000}));
  rooms=order.filter(id=>id!=='overall').map(id=>{
    const base=rawRooms.find(r=>r.id===(id==='dining'?'living':id))||{},extra=manifest.rooms?.find(r=>r.id===id)||{};
    return {...base,...extra,...schemeTextOverride(scheme.roomOverrides,id),...measuredDescriptions[id],id,name:roomDescription(id).name};
  });
  makeNavigation();makePlan();renderDesignNotes();renderMeasurementAudit();renderBayFitouts();renderStorageFitouts();renderLaundryFitout();renderKitchenFitout();paintSchemePlan($('#floor-plan'));paintSchemePlan($('#storage-fitout-cards'));selectRoom(descriptions[location.hash.slice(1)]?location.hash.slice(1):'overall',{updateHash:false,animate:false});switchView('model');
  buildScene();
}
init();
