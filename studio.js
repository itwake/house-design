const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const ASSET_REVISION = '3.0.4';
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
  living:{name:'客厅',en:'LIVING ROOM',title:'窗边一起学习',icon:'sofa',render:'living',description:'西侧飘窗前布置双人长桌，办公与儿童学习共享自然光。电视仍落北侧实墙；桌椅、窗扇与通行空间待现场复核。',features:['双人长桌','窗侧学习','实墙电视']},
  dining:{name:'玄关 · 餐厅',en:'ENTRY & DINING',title:'围坐，才是家的中心',icon:'dining',render:'dining',description:'餐区就近厨房，玄关收纳沿墙展开。细腿家具与温暖吊灯，让进门、就餐和通行各得其所。',features:['连贯动线','沿墙收纳','暖光餐区']},
  room_a:{name:'主卧',en:'MASTER BEDROOM',title:'把喧嚣留在窗外',icon:'bed',render:'master',description:'柔和床头与浅木柜体营造安静背景，保留床侧通行。北窗的隔声与遮光，是舒适睡眠的重点。',features:['1500 mm 床','亚麻触感','北向采光']},
  room_b:{name:'次卧 B',en:'SECOND BEDROOM',title:'留有成长的余地',icon:'bed',render:'bedroom-b',description:'紧凑床、书桌与衣柜各有位置，避免满屋固定柜体。卧室入口保留开门空间，浅色材质减轻压迫感。',features:['1350 mm 床','独立书桌','门口留空']},
  room_c:{name:'书房 · 客卧',en:'STUDY & GUEST',title:'一个人的安静时刻',icon:'study',render:'study',description:'独立日床与书桌适应工作、阅读和偶尔留宿。紧凑尺度用轻巧家具表达，西窗为书房引入自然光。',features:['独立日床','灵活使用','西侧窗光']},
  kitchen:{name:'厨房',en:'KITCHEN',title:'让料理有条不紊',icon:'kitchen',render:'kitchen',description:'沿原厨房湿区组织操作台和电器，暖白柜门搭配浅木。以可闭合玻璃门兼顾光线与油烟控制。',features:['保留湿区','清晰操作台','可闭合厨房']},
  bath_1:{name:'主卫',en:'MAIN BATHROOM',title:'石色里的松弛',icon:'bath',render:'master-bath',description:'浅暖石材统一小空间，浴室柜、马桶和淋浴依阶梯边界布置，用镜面和均匀灯光增加清爽感。',features:['主卧套内','暖色石材','阶梯边界']},
  bath_2:{name:'客卫',en:'GUEST BATHROOM',title:'小空间，也要好用',icon:'bath',render:'guest-bath',description:'西北扩出的盆位安排浅盆柜，保留紧凑马桶与东侧淋浴。轻薄屏风和浅色砖让功能完整，卫浴选型需现场复核。',features:['凹位浅盆柜','阶梯边界','轻薄淋浴屏']},
  balcony:{name:'家政阳台',en:'UTILITY BALCONY',title:'把琐碎收得漂亮',icon:'leaf',render:'balcony',description:'洗烘与家政收纳集中在原阳台。浅木柜面呼应室内，预留维护、开门及日常操作空间。',features:['洗烘叠放','家政收纳','日常留白']}
};
const order = Object.keys(descriptions);
const state = {room:'overall',view:'model',cutWalls:true,labels:true,dimensions:false,interior:false,ready:false};
let data, manifest, rooms = [], three, scene, camera, renderer, controls, model, cameraTween, defaultDistance=20, resizeObserver, dimensionLines, activeHorizontalFov=null, pendingFrame=null;
const wallMaterials=[], roomLabelNodes=[], dimensionNodes=[];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const toast = (message) => { $('#toast').textContent=message; $('#toast').classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),2700); };
const areaOf = points => Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1]},0))/2;
const centroid = points => [points.reduce((s,p)=>s+p[0],0)/points.length,points.reduce((s,p)=>s+p[1],0)/points.length];
const roomById = id => rooms.find(r=>r.id===id);
const roomDescription = id => descriptions[id] || descriptions.overall;
const renderPath = id => revisedAsset(id==='overall' ? (manifest?.overallRender || 'assets/blender-renders/overall.jpg') : (roomById(id)?.render || `assets/blender-renders/${roomDescription(id).render}.jpg`));
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
async function getJSON(url){const response=await fetch(revisedAsset(url));if(!response.ok)throw new Error(`${url}: ${response.status}`);return response.json()}
async function getDesignData(){return getJSON('models/design-data.json')}

function sourceNotes(value,roomId=null){
  if(typeof value==='string')return value.trim()?[{text:value.trim(),roomId}]:[];
  if(Array.isArray(value))return value.flatMap(note=>sourceNotes(note,roomId));
  if(value&&typeof value==='object'){
    const text=value.text||value.note||value.description||value.message||value.title;
    if(typeof text==='string')return [{text:(value.title&&value.title!==text?value.title+'：':'')+text,roomId:value.roomId||roomId}];
    if('roomId' in value||'status' in value)return [];
    return Object.entries(value).flatMap(([key,note])=>sourceNotes(note,descriptions[key]?key:roomId));
  }
  return [];
}
function designNotes(){const seen=new Set();return [...sourceNotes(data?.renovationNotes),...sourceNotes(data?.geometryNotes)].filter(note=>{const key=note.roomId+'|'+note.text;if(seen.has(key))return false;seen.add(key);return true})}
function renderDesignNotes(){const notes=designNotes();$('#source-notes').hidden=!notes.length;$('#source-notes-list').innerHTML=notes.map(note=>`<li>${note.roomId?escapeHTML(roomDescription(note.roomId).name)+'：':''}${escapeHTML(note.text)}</li>`).join('')}
const bayFitoutFor = roomId => data?.bayFitouts?.find(fitout=>fitout.roomId===roomId);
const bayRenderPath = fitout => revisedAsset(manifest?.bayDetails?.find(detail=>detail.fitoutId===fitout.id)?.render || fitout.render || `assets/blender-renders/${({room_a:'bay-master',room_b:'bay-tea',living:'bay-living'})[fitout.roomId]}.jpg`);
const referenceURL = value => {try{const url=new URL(value);return /^https?:$/.test(url.protocol)?url.href:null}catch{return null}};
function detailText(value){
  if(typeof value==='string'||typeof value==='number')return String(value);
  if(value&&typeof value==='object')return value.text||value.description||[value.label||value.name,value.value,value.unit].filter(item=>item!==undefined&&item!==null).join(' ');
  return '';
}
function showBayFitouts(roomId=state.room){
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
    return `<article class="bay-fitout-card" data-fitout-card="${escapeHTML(fitout.id)}"><button class="bay-fitout-image" data-fitout-render="${escapeHTML(fitout.id)}" aria-label="放大${escapeHTML(fitout.title)}同源渲染"><img src="${bayRenderPath(fitout)}" alt="${escapeHTML(fitout.title)} · Blender 条件方案渲染" loading="lazy"/><span class="bay-render-pending" hidden>同源细节渲染暂未载入</span><span class="bay-image-label">BLENDER / 同源设计${icon('expand')}</span></button><div class="bay-fitout-copy"><p class="bay-fitout-kicker">0${index+1} / ${escapeHTML(roomDescription(fitout.roomId).name)}</p><h3>${escapeHTML(fitout.title)}</h3><p class="bay-fitout-summary">${escapeHTML(fitout.summary||'')}</p><ul class="bay-fitout-dimensions" aria-label="方案尺寸">${dims.map(text=>`<li>${escapeHTML(text)}</li>`).join('')}</ul><details><summary>适用条件与参考案例 <span>＋</span></summary><div class="bay-fitout-details"><h4>先确认，再落地</h4><ul>${conditions.map(text=>`<li>${escapeHTML(text)}</li>`).join('')}</ul>${refs.length?`<h4>原文参考 · 仅借鉴设计思路</h4><div class="bay-references">${refs.map(ref=>`<article><a href="${escapeHTML(referenceURL(ref.url))}" target="_blank" rel="noopener noreferrer">${escapeHTML(ref.title)} <span>↗</span></a><small>${escapeHTML([ref.platform,ref.author].filter(Boolean).join(' / '))}</small><p><b>借鉴</b>${escapeHTML(detailText(ref.borrow))}</p>${ref.avoid?`<p><b>不照搬</b>${escapeHTML(detailText(ref.avoid))}</p>`:''}</article>`).join('')}</div>`:''}</div></details><button class="bay-room-button" data-fitout-room="${escapeHTML(fitout.roomId)}">在模型中查看${escapeHTML(roomDescription(fitout.roomId).name)} <span>↗</span></button></div></article>`;
  }).join('')||'<p class="bay-empty">飘窗功能数据暂未载入，请稍后刷新。</p>';
  const usedReferences=new Set(fitouts.flatMap(fitout=>fitout.references||[]));
  $('#bay-safety-references').innerHTML=references.filter(ref=>!usedReferences.has(ref.id)&&referenceURL(ref.url)).map(ref=>`<article><a href="${escapeHTML(referenceURL(ref.url))}" target="_blank" rel="noopener noreferrer">${escapeHTML(ref.author)} · ${escapeHTML(ref.title)} ↗</a><p>${escapeHTML(detailText(ref.borrow))} ${escapeHTML(detailText(ref.avoid))}</p></article>`).join('');
  $$('#bay-fitout-cards [data-fitout-room]').forEach(button=>button.addEventListener('click',()=>{$('#bay-dialog').close();selectRoom(button.dataset.fitoutRoom);switchView('model')}));
  $$('#bay-fitout-cards [data-fitout-render]').forEach(button=>button.addEventListener('click',()=>{
    const fitout=fitouts.find(item=>item.id===button.dataset.fitoutRender);if(!fitout||button.classList.contains('unavailable'))return;
    $('#large-render').src=bayRenderPath(fitout);$('#large-render').alt=fitout.title+' · 条件方案渲染';$('#large-render-caption').textContent=fitout.title+' · 同源模型 / 条件方案，非已核可施工';$('#image-dialog').showModal();
  }));
  $$('#bay-fitout-cards img').forEach(img=>{
    const button=img.parentElement,placeholder=img.nextElementSibling;
    button.disabled=true;button.setAttribute('aria-busy','true');img.style.opacity='0';placeholder.hidden=false;placeholder.textContent='正在载入同源细节渲染…';
    const loaded=()=>{img.hidden=false;img.style.opacity='1';button.disabled=false;button.removeAttribute('aria-busy');button.classList.remove('unavailable');placeholder.hidden=true};
    const failed=()=>{img.hidden=true;button.disabled=true;button.removeAttribute('aria-busy');button.classList.add('unavailable');placeholder.hidden=false;placeholder.textContent='同源细节渲染暂未载入'};
    img.addEventListener('error',failed);img.addEventListener('load',loaded);if(img.complete){if(img.naturalWidth)loaded();else failed()}
  });
}
function bathroomDescription(id){
  if(!['bath_1','bath_2'].includes(id))return '';
  const vanity=data?.furniture?.find(item=>item.id===(id==='bath_1'?'vanity_main':'vanity_guest'));if(!vanity)return roomDescription(id).description;
  const horizontal=['east','west'].includes(vanity.face),width=(horizontal?vanity.d:vanity.w)*10,depth=(horizontal?vanity.w:vanity.d)*10;
  const back={east:'西',west:'东',south:'北',north:'南'}[vanity.face]||'墙';
  return id==='bath_1'?`${width} mm宽、${depth} mm深浴室柜依${back}墙布置，镜面靠${back}；马桶和淋浴按阶梯边界安排。`:`${width} mm宽、${depth} mm深浅盆柜设在西北扩出位置，镜面靠${back}，保留紧凑马桶与东侧淋浴；选型及安装余量待复尺。`;
}
function bedroomSpecification(id){
  const bedId=id==='room_a'?'bed_a':id==='room_b'?'bed_b':null;
  const bed=bedId&&data?.furniture?.find(item=>item.id===bedId);if(!bed)return null;
  const head={east:'东',west:'西',north:'北',south:'南'}[bed.headDirection];if(!head)return null;
  const mattress=`${Number(bed.mattressWidthCm)*10}×${Number(bed.mattressLengthCm)*10}`,frame=`${Number(bed.frameWidthCm)*10}×${Number(bed.frameLengthCm)*10}`;
  const bay=data.windows?.find(window=>window.id===(id==='room_a'?'window_a':'window_b'))?.windowType==='bay';
  const fitout=bayFitoutFor(id),bayNote=fitout?(id==='room_a'?'北侧接办公梳妆桌，保留高台后层板；详见飘窗方案。':'北飘窗设单人茶座：低台为条件方案，非现场已确认；独立书桌保留。'):`浅木衣柜与柔和织物延续全屋配色${bay?'，北侧飘窗尺寸待复尺。':'。'}`;
  return {description:`床头朝${head}；床垫${mattress} mm，床架外包${frame} mm。${bayNote}`,features:[`床头朝${head}`,`${Number(bed.mattressWidthCm)*10} mm床垫`,fitout?(id==='room_a'?'办公 / 梳妆':'条件茶座'):bay?'北侧飘窗':'柔和织物']};
}

function makeNavigation(){
  $('#room-nav').innerHTML=order.map((id,index)=>{const item=roomDescription(id),r=roomById(id);return `${index===1?'<p class="nav-divider">生活空间 / SPACES</p>':''}<button data-room="${id}" class="${id==='overall'?'active':''}" aria-current="${id==='overall'?'true':'false'}">${icon(item.icon)}<span class="nav-title"><b>${item.name}</b><small>${item.en}</small></span><span class="nav-area">${id==='overall'?'9 个空间':id==='living'?'公共区':r?.area&&id!=='dining'?Number(r.area).toFixed(1)+' ㎡':''}</span></button>`}).join('');
  $$('#room-nav [data-room]').forEach(button=>button.addEventListener('click',()=>selectRoom(button.dataset.room)));
  $('#render-strip').innerHTML=order.map(id=>`<button data-render="${id}" class="${id==='overall'?'active':''}" aria-label="查看${roomDescription(id).name}渲染"><img src="${renderPath(id)}" loading="lazy" alt="${roomDescription(id).name}"/><span>${roomDescription(id).name}</span></button>`).join('');
  $$('#render-strip [data-render]').forEach(button=>button.addEventListener('click',()=>selectRoom(button.dataset.render)));
  $$('#render-strip img').forEach(img=>img.addEventListener('error',()=>{img.style.visibility='hidden'}));
}

function selectRoom(id,{updateHash=true,animate=true}={}){
  if(!descriptions[id])id='overall';
  state.room=id;state.interior=false;
  if(updateHash)history.replaceState(null,'',`#${id}`);
  const content=roomDescription(id),r=roomById(id);
  $('#room-title').textContent=content.name;$('#room-kicker').textContent=content.en;
  const areaText=id==='dining'?'与客厅共享公共区 · ':r?.area?Number(r.area).toFixed(1)+(id==='living'?' ㎡（客餐厅及过道合计） · ':' ㎡ · '):'';
  $('#room-subtitle').textContent=id==='overall'?'把每一天，安放在光与木色之间。':`${areaText}现代原木 / ${content.title}`;
  $('#card-kicker').textContent=content.en;$('#card-title').textContent=content.title;
  const accessNote=id==='bath_1'?'主卫北门通主卧，按套内卫生间使用；门宽与侧面构造待复尺。':id==='bath_2'?'客卫从公共走廊进入；门宽与侧面构造待复尺。':'';
  const bedroom=bedroomSpecification(id),fitout=bayFitoutFor(id);
  $('#card-description').textContent=[bedroom?.description || bathroomDescription(id) || (fitout?content.description:'') || r?.description || content.description,accessNote,...designNotes().filter(note=>note.roomId===id).map(note=>note.text)].filter(Boolean).join(' ');
  $('#view-bay-fitout').hidden=!(fitout||id==='overall');
  $('#view-bay-fitout').innerHTML=`${id==='overall'?'三处飘窗功能设计':'飘窗方案 · 尺寸 / 参考'} <span>↗</span>`;
  $('#room-tags').innerHTML=(bedroom?.features || ((fitout||id==='bath_1'||id==='bath_2')?content.features:(r?.features || content.features))).slice(0,3).map(t=>`<span>${escapeHTML(t)}</span>`).join('');
  $('#room-preview').src=renderPath(id);$('#room-preview').alt=`${content.name} Blender 渲染预览`;
  $('#enter-room').innerHTML=`${id==='overall'?'探索客厅':'走进'+content.name} <span>↗</span>`;
  $$('#room-nav [data-room]').forEach(btn=>{btn.classList.toggle('active',btn.dataset.room===id);btn.setAttribute('aria-current',String(btn.dataset.room===id))});
  $$('#render-strip [data-render]').forEach(btn=>btn.classList.toggle('active',btn.dataset.render===id));
  $$('#floor-plan [data-plan-room]').forEach(p=>p.classList.toggle('selected',p.dataset.planRoom===id || (id==='dining'&&p.dataset.planRoom==='living')));
  roomLabelNodes.forEach(item=>item.element.classList.toggle('active',item.id===id));
  updateRender();
  if(state.ready)focusRoom(id,false,animate);
}

function switchView(view){
  state.view=view;$('#workspace').dataset.view=view;
  $$('.view-tabs [data-view]').forEach(btn=>{const active=btn.dataset.view===view;btn.setAttribute('aria-selected',String(active));btn.tabIndex=active?0:-1});
  $$('.view-panel').forEach(panel=>{const active=panel.id===`${view}-view`;panel.hidden=!active;panel.classList.toggle('active',active)});
  if(view==='renders')updateRender();
  if(view==='model'&&state.ready){resizeScene();controls.update()}
}

function updateRender(){
  $('#render-unavailable').hidden=true;
  $('#active-render').src=renderPath(state.room);$('#active-render').alt=`${roomDescription(state.room).name} · 同一模型 Blender 渲染`;
  $('#render-name').textContent=roomDescription(state.room).name;
}

function planFurniture(f){
  const direction=f.headDirection,isBed=['east','west','north','south'].includes(direction);
  const frame=`<rect data-furniture-frame x="${f.x}" y="${f.y}" width="${f.w}" height="${f.d}" rx="${f.tone==='fabric'?6:2}" fill="${({wood:'#d2b791',cabinet:'#d4c9b4',fabric:'#f8f3e8',sanitary:'#faf9f3',wet:'#d5dedb',metal:'#babbb0'})[f.tone]||'#e3d9c5'}" stroke="#b4a68e" stroke-width="1.5"${!isBed&&f.a?` transform="rotate(${f.a} ${f.x+f.w/2} ${f.y+f.d/2})"`:''}/>`;
  if(!isBed){
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

function planFitoutPart(fitout,part){
  if(!['x','y','w','d'].every(key=>Number.isFinite(Number(part[key]))))return '';
  const {x,y,w,d}=Object.fromEntries(['x','y','w','d'].map(key=>[key,Number(part[key])])),sourceRole=part.role||'ledge';
  const role=({raised_ledge:'ledge',seat_cushion:'cushion',back_cushion:'cushion',tea_tray:'tray'})[sourceRole]||sourceRole;
  const subordinate=['desk_support','desk_accessories','ledge_objects'].includes(role);
  const fill=subordinate?'none':({desktop:'#c7a578',ledge:'#d7c5a6',cushion:'#aab59c',tray:'#9c7854',chair:'#c5b89e'}[role]||'#d4c5ac');
  const face=part.face||'north',back={east:'west',west:'east',south:'north',north:'south'}[face];
  const backLine=back==='west'?`x1="${x+3}" y1="${y+5}" x2="${x+3}" y2="${y+d-5}"`:back==='east'?`x1="${x+w-3}" y1="${y+5}" x2="${x+w-3}" y2="${y+d-5}"`:back==='south'?`x1="${x+5}" y1="${y+d-3}" x2="${x+w-5}" y2="${y+d-3}"`:`x1="${x+5}" y1="${y+3}" x2="${x+w-5}" y2="${y+3}"`;
  const detail=role==='chair'?`<line ${backLine} stroke="#8f7f65" stroke-width="5" stroke-linecap="round"/>`:role==='cushion'?`<rect x="${x+4}" y="${y+4}" width="${Math.max(0,w-8)}" height="${Math.max(0,d-8)}" rx="5" fill="none" stroke="#e9eddf" stroke-width="1.5" stroke-dasharray="3 3"/>`:role==='tray'?`<rect x="${x+3}" y="${y+3}" width="${Math.max(0,w-6)}" height="${Math.max(0,d-6)}" rx="2" fill="none" stroke="#d1b694" stroke-width="1.5"/>`:'';
  return `<g data-fitout-part="${escapeHTML(part.id)}" pointer-events="none"><title>${escapeHTML(fitout.title)} · ${escapeHTML(sourceRole)} · 占位${w*10}×${d*10}mm · 底标高${Number(part.zCm||0)*10}mm / 构件高${Number(part.hCm||0)*10}mm；条件设计，非施工图</title><rect data-fitout-id="${escapeHTML(fitout.id)}" data-part-id="${escapeHTML(part.id)}" data-fitout-role="${escapeHTML(sourceRole)}" data-z-cm="${Number(part.zCm||0)}" data-h-cm="${Number(part.hCm||0)}" x="${x}" y="${y}" width="${w}" height="${d}" rx="${['cushion','chair'].includes(role)?6:2}" fill="${fill}" stroke="${subordinate?'none':'#a38b67'}" stroke-width="1.5"/>${detail}</g>`;
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
    const [cx,cy]=r.id==='living'?[410,925]:r.id==='bath_1'?[535,419]:r.id==='bath_2'?[488,578]:centroid(r.points);labels.push(`<text x="${cx}" y="${cy}" text-anchor="middle" font-size="23" fill="#776d5b">${r.id==='living'?'客餐厅 · 过道':roomDescription(r.id).name}</text><text x="${cx}" y="${cy+30}" text-anchor="middle" font-size="16" fill="#a2937b">${(areaOf(r.points)/10000).toFixed(1)} ㎡${r.id==='living'?'（公共区合计）':''}</text>`);
    return `<polygon class="plan-room" data-plan-room="${r.id}" tabindex="0" role="button" aria-label="查看${roomDescription(r.id).name}" points="${r.points.map(p=>p.join(',')).join(' ')}" fill="${fills[r.tone]||'#ece3d5'}"/>`;
  }).join('');
  const furniture=(data.furniture||[]).map(planFurniture).join('');
  const fitouts=(data.bayFitouts||[]).flatMap(fitout=>[...(fitout.parts||[])].sort((a,b)=>(a.zCm||0)-(b.zCm||0)).map(part=>planFitoutPart(fitout,part))).join('');
  const walls=(data.walls||[]).map(w=>`<line x1="${w[0]}" y1="${w[1]}" x2="${w[2]}" y2="${w[3]}" stroke="#8c887b" stroke-width="${wallThickness}" stroke-linecap="square"/>`).join('');
  const opening=(items,color)=>(items||[]).map(w=>`<line x1="${w.x1}" y1="${w.y1}" x2="${w.x2}" y2="${w.y2}" stroke="#fcf8ee" stroke-width="15"/><line data-opening-id="${escapeHTML(w.id)}" x1="${w.x1}" y1="${w.y1}" x2="${w.x2}" y2="${w.y2}" stroke="${color}" stroke-width="4"/>`).join('');
  const bayWindows=bays.map(b=>`<g data-bay-window="${b.window.id}" aria-label="${escapeHTML(b.window.name)}：外凸窗台投影，尺寸待复尺"><line x1="${b.window.x1}" y1="${b.window.y1}" x2="${b.window.x2}" y2="${b.window.y2}" stroke="#fcf8ee" stroke-width="${wallThickness+3}"/><polygon data-bay-sill points="${b.sill.map(p=>p.join(',')).join(' ')}" fill="#e6dac1" stroke="#c5b497" stroke-width="1.5"/>${b.returns.map(points=>`<polygon data-bay-return points="${points.map(p=>p.join(',')).join(' ')}" fill="#8c887b"/>`).join('')}<polygon data-bay-front-frame data-frame-finish="${escapeHTML(bayFrameFinish)}" points="${b.frame.map(p=>p.join(',')).join(' ')}" fill="${bayFrameColor}"/><line data-bay-glass x1="${b.frontA[0]}" y1="${b.frontA[1]}" x2="${b.frontB[0]}" y2="${b.frontB[1]}" stroke="#8fa6a8" stroke-width="4"/><text x="${b.label[0]}" y="${b.label[1]}" text-anchor="middle" dominant-baseline="middle" font-size="16" fill="#958165"${b.vertical?` transform="rotate(-90 ${b.label[0]} ${b.label[1]})"`:''}>飘窗台</text></g>`).join('');
  const topDimensionY=planMinY-52,leftDimensionX=planMinX-55;
  const dimensions=`<g stroke="#b4a58e" stroke-width="1.5" fill="none"><path d="M0 ${topDimensionY}H687 M0 ${topDimensionY-14}v28 M687 ${topDimensionY-14}v28 M${leftDimensionX} 0v1401 M${leftDimensionX-14} 0h28 M${leftDimensionX-14} 1401h28 M200 1455h641 M200 1441v28 M841 1441v28"/></g><g fill="#9c8d73" font-size="19" text-anchor="middle"><text x="343" y="${topDimensionY-17}">6,870</text><text x="520" y="1484">6,410</text><text x="${leftDimensionX-20}" y="700" transform="rotate(-90 ${leftDimensionX-20} 700)">14,010</text><text x="793" y="${topDimensionY-2}" font-size="23">N ↑</text></g>`;
  $('#floor-plan').innerHTML=`<svg viewBox="${planMinX-115} ${planMinY-110} ${maxX-planMinX+160} ${maxY-planMinY+215}" role="img" aria-label="由同源尺寸数据绘制的三房两卫平面图，含三处飘窗条件功能方案；窗台投影不计入房间面积">${polygons}${furniture}${walls}${opening((data.windows||[]).filter(w=>w.windowType!=='bay'),'#8fa6a8')}${bayWindows}${opening(data.doors,'#c2a071')}${fitouts}${labels.join('')}${dimensions}</svg>`;
  $$('#floor-plan [data-plan-room]').forEach(p=>{p.addEventListener('click',()=>selectRoom(p.dataset.planRoom));p.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectRoom(p.dataset.planRoom)}})});
}

function exportPlan(openInTab=false){
  const source=$('#floor-plan svg');if(!source){toast('平面数据尚未载入');return}
  const svg=source.cloneNode(true),namespace='http://www.w3.org/2000/svg';
  const [x,y,width,height]=svg.getAttribute('viewBox').split(/\s+/).map(Number);
  svg.setAttribute('xmlns',namespace);svg.setAttribute('viewBox',`${x} ${y-110} ${width} ${height+250}`);svg.setAttribute('width','1200');svg.setAttribute('height',String(Math.ceil(1200*(height+250)/width)));
  svg.removeAttribute('role');svg.removeAttribute('aria-label');
  svg.querySelectorAll('[tabindex],[role]').forEach(node=>{node.removeAttribute('tabindex');node.removeAttribute('role')});
  const title=document.createElementNS(namespace,'title');title.textContent='荟雅苑 · 同源模型平面示意（非施工图）';svg.prepend(title);
  const background=document.createElementNS(namespace,'rect');Object.entries({x,y:y-110,width,height:height+250,fill:'#fffcf6'}).forEach(([key,value])=>background.setAttribute(key,String(value)));svg.insertBefore(background,title.nextSibling);
  const addText=(text,atY,size,color)=>{const node=document.createElementNS(namespace,'text');Object.entries({x:x+24,y:atY,'font-size':size,fill:color,'font-family':'Microsoft YaHei, PingFang SC, sans-serif'}).forEach(([key,value])=>node.setAttribute(key,String(value)));node.textContent=text;svg.appendChild(node)};
  addText('荟雅苑 · 三房两卫 / 同源模型平面',y-57,26,'#615943');
  addText('模型示意，非施工图 · 单位：mm · 墙体、门窗与管井需现场复尺',y-20,16,'#96856a');
  addText('公共区面积含客厅、餐厅及过道；飘窗仅为窗台投影，不计入房间面积。',y+height+30,15,'#96856a');
  addText('3处飘窗存在已确认；外凸600mm仍待复尺。次卧430mm低台＋50mm垫仅为条件方案。',y+height+62,15,'#96856a');
  addText('原900mm窗台为未实测基线，不代表现场；尺寸链仅计主体墙身，均非施工尺寸。',y+height+94,15,'#96856a');
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
    scene.add(new THREE.HemisphereLight(0xfff9ed,0xc2b69f,2.15));
    const sun=new THREE.DirectionalLight(0xfff6e7,2.4);sun.position.set(-5,14,-4);sun.castShadow=false;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
    const fill=new THREE.DirectionalLight(0xfffbf2,1.0);fill.position.set(12,8,18);scene.add(fill);
    const loader=new GLTFLoader();
    const gltf=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Model load timeout')),45000);loader.load(revisedAsset(manifest?.model || 'models/huiyayuan-wood.glb'),result=>{clearTimeout(timer);resolve(result)},event=>{
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
    });scene.add(model);state.ready=true;
    buildLabels();setWalls(true);focusRoom(state.room,false,false);resizeScene();
    resizeObserver=new ResizeObserver(resizeScene);resizeObserver.observe(container);
    $('#model-loading').hidden=true;
    renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();showFallback('浏览器的三维显示连接已中断。刷新页面可重新载入。')});
    const pointerStart={x:0,y:0};renderer.domElement.addEventListener('pointerdown',e=>{pointerStart.x=e.clientX;pointerStart.y=e.clientY});
    renderer.domElement.addEventListener('pointerup',event=>{
      if(state.interior||Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>5)return;
      const rect=renderer.domElement.getBoundingClientRect(),pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);const ray=new THREE.Raycaster();ray.setFromCamera(pointer,camera);
      for(const hit of ray.intersectObject(model,true)){
        if(state.cutWalls&&hit.point.y>1.25)continue;
        let object=hit.object;while(object&&!object.userData.roomId)object=object.parent;
        if(object?.userData.roomId&&descriptions[object.userData.roomId]){selectRoom(object.userData.roomId);break}
      }
    });
    scheduleRender();
  }catch(error){console.error('3D load failed',error);showFallback('当前设备或网络未能载入 3D 模型，平面与 Blender 渲染仍可查看。')}
}

function showFallback(message){state.ready=false;if(pendingFrame!==null){cancelAnimationFrame(pendingFrame);pendingFrame=null}$('#model-loading').hidden=true;$('#model-fallback').hidden=false;$('#fallback-message').textContent=message;$('#room-labels').hidden=true;$$('.viewer-controls button').forEach(button=>button.disabled=true);$('#model-hint').hidden=true}
function resizeScene(){if(!renderer||!camera)return;const {width,height}=$('#model-canvas').getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;if(activeHorizontalFov)camera.fov=2*Math.atan(Math.tan(activeHorizontalFov*Math.PI/360)/camera.aspect)*180/Math.PI;camera.updateProjectionMatrix();if(state.ready&&state.room==='overall'&&!state.interior&&(matchMedia('(max-width: 860px)').matches||camera.view?.enabled))focusRoom('overall',false,false);scheduleRender()}

function optimizeStaticModel(source,THREE,mergeGeometries){
  source.updateMatrixWorld(true);
  const groups=new Map(),optimized=new THREE.Group();optimized.name='Static room batches';
  source.traverse(object=>{
    if(!object.isMesh)return;
    let owner=object,semantic={};
    while(owner){for(const key of ['kind','roomId','external','wallIndex'])if(semantic[key]===undefined&&owner.userData[key]!==undefined)semantic[key]=owner.userData[key];owner=owner.parent}
    const originalMaterial=object.material;
    if(Array.isArray(originalMaterial)||object.isSkinnedMesh||originalMaterial.transparent||originalMaterial.transmission>0){
      const clone=object.clone(false);clone.geometry=object.geometry.clone().applyMatrix4(object.matrixWorld);clone.position.set(0,0,0);clone.quaternion.identity();clone.scale.set(1,1,1);clone.userData={...object.userData,...semantic};optimized.add(clone);return;
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
  const safe={left:20,right:width-20,top:112,bottom:card.height>0?card.top-viewport.top-18:height-250};
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
  if(!state.ready)return;
  let preset;
  if(id==='overall')preset=manifest?.overviewCamera||{position:[15,15,21],target:[4.2,.6,7]};
  else{
    const room=roomById(id);preset=interior?room?.interiorCamera:room?.camera;
    if(!preset){const center=room?.points?.length?centroid(room.points):[4.2,7];preset=interior?{position:[center[0]-.6,1.55,center[1]+1.5],target:[center[0],1.2,center[1]-.6]}:{position:[center[0]+5,7,center[1]+6],target:[center[0],.4,center[1]]}}
  }
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
  $('#enter-room').innerHTML=`${interior?'返回俯瞰视角':id==='overall'?'探索客厅':'走进'+roomDescription(id).name} <span>↗</span>`;
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
  [{label:'6,870 mm',point:[3.43,.05,-.6]},{label:'14,010 mm',point:[-.7,.05,7]},{label:'6,410 mm',point:[5.2,.05,14.55]}].forEach(item=>{const element=document.createElement('span');element.className='dimension-label';element.textContent=item.label;layer.appendChild(element);dimensionNodes.push({element,point:new three.Vector3(...item.point)})});
  const lines=[[[0,-.45],[6.87,-.45]],[[0,-.62],[0,-.28]],[[6.87,-.62],[6.87,-.28]],[[-.45,0],[-.45,14.01]],[[-.62,0],[-.28,0]],[[-.62,14.01],[-.28,14.01]],[[2,14.45],[8.41,14.45]],[[2,14.28],[2,14.62]],[[8.41,14.28],[8.41,14.62]]];
  const geometry=new three.BufferGeometry().setFromPoints(lines.flatMap(line=>line.map(([x,z])=>new three.Vector3(x,.01,z))));
  dimensionLines=new three.LineSegments(geometry,new three.LineBasicMaterial({color:0xa29072,transparent:true,opacity:.7}));dimensionLines.visible=false;scene.add(dimensionLines);
}

const projected = {value:null};
function tick(time){
  pendingFrame=null;
  if(!state.ready||document.hidden||state.view!=='model')return;
  if(cameraTween){const progress=Math.min(1,(performance.now()-cameraTween.start)/850),ease=1-Math.pow(1-progress,3);camera.position.lerpVectors(cameraTween.fromPosition,cameraTween.toPosition,ease);controls.target.lerpVectors(cameraTween.fromTarget,cameraTween.toTarget,ease);if(progress===1)cameraTween=null}
  controls.update();
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
  if(cameraTween)scheduleRender();
}

function bindControls(){
  $('#open-plan').addEventListener('click',()=>exportPlan(true));$('#download-plan').addEventListener('click',()=>exportPlan(false));
  $$('.view-tabs [data-view]').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.view)));
  $('.view-tabs').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;const views=['model','plan','renders'],next=(views.indexOf(state.view)+(event.key==='ArrowRight'?1:2))%3;switchView(views[next]);$(`[data-view="${views[next]}"]`).focus()});
  $('#reset-camera').addEventListener('click',()=>focusRoom(state.room));
  [['#zoom-in',.82],['#zoom-out',1.22]].forEach(([id,factor])=>$(id).addEventListener('click',()=>{if(!state.ready)return;cameraTween=null;const direction=camera.position.clone().sub(controls.target);direction.setLength(Math.max(controls.minDistance,Math.min(controls.maxDistance,direction.length()*factor)));camera.position.copy(controls.target).add(direction);controls.update()}));
  $('#cut-walls').addEventListener('click',()=>{setWalls(!state.cutWalls);toast(state.cutWalls?'已切为低墙视图':'已恢复完整墙体')});
  $('#toggle-labels').addEventListener('click',()=>{state.labels=!state.labels;$('#toggle-labels').classList.toggle('selected',state.labels);$('#toggle-labels').setAttribute('aria-pressed',String(state.labels));scheduleRender()});
  $('#toggle-dimensions').addEventListener('click',()=>{state.dimensions=!state.dimensions;$('#toggle-dimensions').classList.toggle('selected',state.dimensions);$('#toggle-dimensions').setAttribute('aria-pressed',String(state.dimensions));if(state.dimensions)toast('标注为图纸轮廓尺寸，完整尺寸请查看平面');scheduleRender()});
  $('#enter-room').addEventListener('click',()=>{if(state.room==='overall'){selectRoom('living');switchView('model');return}if(!state.ready){switchView('renders');return}switchView('model');focusRoom(state.room,!state.interior)});
  $('#view-room-render').addEventListener('click',()=>switchView('renders'));$('#fallback-renders').addEventListener('click',()=>switchView('renders'));
  $('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('#workspace').requestFullscreen()}catch{toast('当前浏览器不支持全屏，可使用横屏查看')}});
  ['#open-project','#open-dimensions'].forEach(id=>$(id).addEventListener('click',()=>$('#project-dialog').showModal()));
  ['#open-bays','#view-bay-fitout','#project-bay-link'].forEach(id=>$(id).addEventListener('click',()=>{if($('#project-dialog').open)$('#project-dialog').close();showBayFitouts()}));
  $$('.dialog-close').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
  $$('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close()}}));
  $('#enlarge-render').addEventListener('click',()=>{$('#large-render').src=renderPath(state.room);$('#large-render').alt=$('#active-render').alt;$('#large-render-caption').textContent=roomDescription(state.room).name+' · Blender 同源模型渲染';$('#image-dialog').showModal()});
  $('#active-render').addEventListener('error',()=>{$('#render-unavailable').hidden=false});$('#active-render').addEventListener('load',()=>{$('#render-unavailable').hidden=true});
  $('#room-preview').addEventListener('error',()=>{$('#room-preview').style.display='none'});$('#room-preview').addEventListener('load',()=>{$('#room-preview').style.display=''});
  $('#download-toggle').addEventListener('click',()=>{const open=$('#download-popover').hidden;$('#download-popover').hidden=!open;$('#download-toggle').setAttribute('aria-expanded',String(open))});
  document.addEventListener('click',event=>{if(!event.target.closest('.download-menu')){$('#download-popover').hidden=true;$('#download-toggle').setAttribute('aria-expanded','false')}});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){$('#download-popover').hidden=true;$('#download-toggle').setAttribute('aria-expanded','false')}});
  $('#room-card-toggle').addEventListener('click',()=>{const collapsed=$('#room-card').classList.toggle('collapsed');$('#room-card-toggle').setAttribute('aria-expanded',String(!collapsed))});
  $('.brand').addEventListener('click',event=>{event.preventDefault();selectRoom('overall');switchView('model')});
  window.addEventListener('hashchange',()=>selectRoom(location.hash.slice(1),{updateHash:false}));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&controls){controls.update();scheduleRender()}});
}

async function init(){
  bindControls();
  const results=await Promise.allSettled([getDesignData(),getJSON('models/scene-manifest.json')]);
  data=results[0].status==='fulfilled'?results[0].value:null;manifest=results[1].status==='fulfilled'?results[1].value:{};
  if(!data){$('#loading-status').textContent='尺寸数据暂未载入';makeNavigation();showFallback('页面的尺寸数据暂未能载入，请稍后刷新。');return}
  const rawRooms=data.rooms.map(room=>({...room,points:room.points.map(p=>p.map(n=>n/100)),area:areaOf(room.points)/10000}));
  rooms=order.filter(id=>id!=='overall').map(id=>{
    const base=rawRooms.find(r=>r.id===(id==='dining'?'living':id))||{},extra=manifest.rooms?.find(r=>r.id===id)||{};
    return {...base,...extra,id,name:roomDescription(id).name};
  });
  makeNavigation();makePlan();renderDesignNotes();renderBayFitouts();selectRoom(descriptions[location.hash.slice(1)]?location.hash.slice(1):'overall',{updateHash:false,animate:false});switchView('model');
  buildScene();
}
init();
