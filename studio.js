import {loadSchemeCatalog,resolveScheme,schemeRender} from './schemes.js?v=3.1.3';
import {buildWalkWorld,findWalkStart,WalkController,WALK_STARTS,isWalkDoorInfill} from './walkthrough.js?v=3.1.3';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const UI_REVISION = '3.1.3';
document.documentElement.dataset.uiRevision = UI_REVISION;
let ASSET_REVISION = '3.1.1';
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
  dining:{name:'玄关 · 餐厅',en:'ENTRY & DINING',title:'把回家与围坐，收得妥帖',icon:'dining',render:'dining',description:'进门东侧右手鞋柜面向西；西墙餐柜向南墙转折成7字。鞋与杯盘分开收纳，开放台面连接日常饮品操作；分段尺寸、盲角与通行动线仍需现场复核。',features:['右手鞋柜','7字餐柜','转角盲区复核']},
  room_a:{name:'主卧',en:'MASTER BEDROOM',title:'把喧嚣留在窗外',icon:'bed',render:'master',description:'柔和床头与浅木柜体营造安静背景，保留床侧通行。北窗的隔声与遮光，是舒适睡眠的重点。',features:['1500 mm 床','亚麻触感','北向采光']},
  room_b:{name:'次卧 B',en:'SECOND BEDROOM',title:'让睡眠与茶歇更从容',icon:'bed',render:'bedroom-b',description:'保留紧凑床、衣柜与条件飘窗茶座，取消独立书桌和办公椅。卧室入口保持通行，浅色材质减轻压迫感。',features:['1350 mm 床','条件茶座','不设独立书桌']},
  room_c:{name:'书房 · 客卧',en:'STUDY & GUEST',title:'一个人的安静时刻',icon:'study',render:'study',description:'独立日床与书桌适应工作、阅读和偶尔留宿。紧凑尺度用轻巧家具表达，西窗为书房引入自然光。',features:['独立日床','灵活使用','西侧窗光']},
  kitchen:{name:'厨房',en:'KITCHEN',title:'让料理有条不紊',icon:'kitchen',render:'kitchen',description:'沿原厨房湿区组织操作台和电器，暖白柜门搭配浅木。以可闭合玻璃门兼顾光线与油烟控制。',features:['保留湿区','清晰操作台','可闭合厨房']},
  bath_1:{name:'主卫',en:'MAIN BATHROOM',title:'石色里的松弛',icon:'bath',render:'master-bath',description:'浅暖石材统一小空间，浴室柜、马桶和淋浴依阶梯边界布置，用镜面和均匀灯光增加清爽感。',features:['主卧套内','暖色石材','阶梯边界']},
  bath_2:{name:'客卫',en:'GUEST BATHROOM',title:'小空间，也要好用',icon:'bath',render:'guest-bath',description:'西北扩出的盆位安排浅盆柜，保留紧凑马桶与东侧淋浴。轻薄屏风和浅色砖让功能完整，卫浴选型需现场复核。',features:['凹位浅盆柜','阶梯边界','轻薄淋浴屏']},
  balcony:{name:'家政阳台',en:'UTILITY BALCONY',title:'把琐碎收得漂亮',icon:'leaf',render:'balcony',description:'洗烘与家政收纳集中在原阳台。浅木柜面呼应室内，预留维护、开门及日常操作空间。',features:['洗烘叠放','家政收纳','日常留白']}
};
const order = Object.keys(descriptions);
const state = {room:'overall',view:'model',cutWalls:true,labels:true,dimensions:false,interior:false,walking:false,ready:false,roomCardVisible:true};
const ROOM_CARD_STORAGE_KEY = 'house-design:room-card-visible';
let data, manifest, scheme, schemeCatalog, rooms = [], three, scene, camera, renderer, controls, model, cameraTween, defaultDistance=20, resizeObserver, dimensionLines, activeHorizontalFov=null, pendingFrame=null;
const wallMaterials=[], roomLabelNodes=[], dimensionNodes=[];
let walkthrough=null,walkWorld=null,walkRestore=null,walkThresholds=null;
const walkDoorParts=[];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const toast = (message) => { $('#toast').textContent=message; $('#toast').classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),2700); };
const areaOf = points => Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1]},0))/2;
const centroid = points => [points.reduce((s,p)=>s+p[0],0)/points.length,points.reduce((s,p)=>s+p[1],0)/points.length];
const roomById = id => rooms.find(r=>r.id===id);
const roomDescription = id => descriptions[id] || descriptions.overall;
const schemeTextOverride=(overrides,id)=>Object.fromEntries(Object.entries(overrides?.[id]||{}).filter(([key])=>['title','description','summary','features'].includes(key)));
const renderPath = id => schemeRender(scheme,roomDescription(id).render);
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
async function getJSON(url){const response=await fetch(revisedAsset(url));if(!response.ok)throw new Error(`${url}: ${response.status}`);return response.json()}
async function getDesignData(){return getJSON(schemeCatalog?.geometrySource||'models/design-data.json')}

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
function configureScheme(){
  document.documentElement.dataset.scheme=scheme.id;document.title=`${scheme.name} · 荟雅苑的家`;
  $('.brand strong').textContent=scheme.name;$('.brand small').textContent=scheme.en;$('.brand').setAttribute('aria-label',scheme.name+'，返回全屋');
  $('.project-crumb').textContent='荟雅苑 / '+(scheme.style||scheme.name);
  $('.sidebar-bottom>p').textContent=scheme.tagline||'把每一天，安放在光与木色之间。';
  $('.material-dots').innerHTML=(scheme.colors||[]).map(c=>`<i title="${escapeHTML(c.name)}" style="--swatch:${/^#[\da-f]{3,8}$/i.test(c.hex)?c.hex:'#ddd'}"></i>`).join('');
  $('.material-dots').setAttribute('aria-label',(scheme.colors||[]).map(c=>c.name).join('、'));
  if(scheme.id!=='wood'){document.documentElement.style.setProperty('--plan-hover',scheme.planPalette?.floor||'#eee7d8');document.documentElement.style.setProperty('--plan-selected',scheme.planPalette?.cabinet||'#ddd6c9')}
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
  if(!scheme||scheme.id==='wood'||!root)return;
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
    return `<article class="bay-fitout-card" data-fitout-card="${escapeHTML(fitout.id)}"><button class="bay-fitout-image" data-fitout-render="${escapeHTML(fitout.id)}" aria-label="放大${escapeHTML(fitout.title)}同源渲染"><img src="${bayRenderPath(fitout)}" alt="${escapeHTML(fitout.title)} · Blender 条件方案渲染" loading="lazy"/><span class="bay-render-pending" hidden>同源细节渲染暂未载入</span><span class="bay-image-label">BLENDER / 同源设计${icon('expand')}</span></button><div class="bay-fitout-copy"><p class="bay-fitout-kicker">0${index+1} / ${escapeHTML(roomDescription(fitout.roomId).name)}</p><h3>${escapeHTML(fitout.title)}</h3><p class="bay-fitout-summary">${escapeHTML(fitout.summary||'')}</p><ul class="bay-fitout-dimensions" aria-label="方案尺寸">${dims.map(text=>`<li>${escapeHTML(text)}</li>`).join('')}</ul><details><summary>适用条件与参考案例 <span>＋</span></summary><div class="bay-fitout-details"><h4>先确认，再落地</h4><ul>${conditions.map(text=>`<li>${escapeHTML(text)}</li>`).join('')}</ul>${refs.length?`<h4>原文参考 · 仅借鉴设计思路</h4><div class="bay-references">${refs.map(ref=>`<article><a href="${escapeHTML(referenceURL(ref.url))}" target="_blank" rel="noopener noreferrer">${escapeHTML(ref.title)} <span>↗</span></a><small>${escapeHTML([ref.platform,ref.author].filter(Boolean).join(' / '))}</small><p><b>借鉴</b>${escapeHTML(detailText(ref.borrow))}</p>${ref.avoid?`<p><b>不照搬</b>${escapeHTML(detailText(ref.avoid))}</p>`:''}</article>`).join('')}</div>`:''}</div></details><button class="bay-room-button" data-fitout-room="${escapeHTML(fitout.roomId)}">在模型中查看${escapeHTML(roomDescription(fitout.roomId).name)} <span>↗</span></button></div></article>`;
  }).join('')||'<p class="bay-empty">飘窗功能数据暂未载入，请稍后刷新。</p>';
  const usedReferences=new Set(fitouts.flatMap(fitout=>fitout.references||[]));
  const storageReferences=new Set((data?.storageFitouts||[]).flatMap(fitout=>fitout.references||[]));
  $('#bay-safety-references').innerHTML=references.filter(ref=>!usedReferences.has(ref.id)&&!storageReferences.has(ref.id)&&referenceURL(ref.url)).map(ref=>`<article><a href="${escapeHTML(referenceURL(ref.url))}" target="_blank" rel="noopener noreferrer">${escapeHTML(ref.author)} · ${escapeHTML(ref.title)} ↗</a><p>${escapeHTML(detailText(ref.borrow))} ${escapeHTML(detailText(ref.avoid))}</p></article>`).join('');
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
const storageRenderPath=fitout=>schemeRender(scheme,fitout.type==='entry'?'entry-storage':'sideboard');
const storageRoleName=role=>({shoe_lower:'闭门鞋柜',key_niche:'钥匙置物格',upper_cabinet:'浅上柜',entry_accessories:'随手置物占位',shoe_bench:'换鞋坐位',bench_back:'镜面 / 挂物背板',sideboard_base:'杯盘下柜',sideboard_niche:'干式饮品格',dining_accessories:'杯具 / 茶罐示意',sideboard_blind_base:'转角盲区',sideboard_corner_niche:'转角开放衔接',upper_blind_corner:'上柜盲角'})[role]||role;
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
      if(p.doorPanels&&!open&&!blind){for(let i=1;i<p.doorPanels;i++)detail+=`<line x1="${closedStart+closedLength*i/p.doorPanels}" y1="${y+1}" x2="${closedStart+closedLength*i/p.doorPanels}" y2="${top-p.zCm-(p.openBaseCm||0)}" stroke="#d7cbb7" stroke-width=".8"/>`}
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
  const fitouts=data?.storageFitouts||[],references=data?.designReferences||[];
  $('#storage-fitout-cards').innerHTML=fitouts.map((fitout,index)=>{
    const refs=(fitout.references||[]).map(id=>references.find(ref=>ref.id===id)).filter(ref=>ref&&referenceURL(ref.url));
    return `<article class="bay-fitout-card storage-fitout-card" data-storage-card="${escapeHTML(fitout.id)}"><button class="bay-fitout-image" data-storage-render="${escapeHTML(fitout.id)}" aria-label="放大${escapeHTML(fitout.title)}同源渲染"><img src="${storageRenderPath(fitout)}" alt="${escapeHTML(fitout.title)} · Blender 条件收纳方案" loading="lazy"/><span class="bay-render-pending" hidden></span><span class="bay-image-label">BLENDER / 同源收纳设计${icon('expand')}</span></button><div class="bay-fitout-copy"><p class="bay-fitout-kicker">0${index+1} / ${fitout.type==='entry'?'ARRIVE & UNWIND':'STORE & SERVE'}</p><h3>${escapeHTML(fitout.title)}</h3><p class="bay-fitout-summary">${escapeHTML(fitout.summary||'')}</p><ul class="bay-fitout-dimensions" aria-label="方案尺寸">${(fitout.dimensions||[]).map(text=>`<li>${escapeHTML(detailText(text))}</li>`).join('')}</ul>${storageElevation(fitout)}<details><summary>适用条件与参考原文 <span>＋</span></summary><div class="bay-fitout-details"><h4>现场复核后，再深化下单</h4><ul>${(fitout.conditions||[]).map(text=>`<li>${escapeHTML(detailText(text))}</li>`).join('')}</ul><h4>参考原文 · 借鉴，不照搬</h4><div class="bay-references">${refs.map(ref=>`<article><a href="${escapeHTML(referenceURL(ref.url))}" target="_blank" rel="noopener noreferrer">${escapeHTML(ref.title)} <span>↗</span></a><small>${escapeHTML([ref.platform,ref.author].filter(Boolean).join(' / '))}</small><p><b>借鉴</b>${escapeHTML(detailText(ref.borrow))}</p><p><b>不照搬</b>${escapeHTML(detailText(ref.avoid))}</p></article>`).join('')}</div></div></details><button class="bay-room-button" data-storage-room="${escapeHTML(fitout.id)}">回到玄关 · 餐厅模型 <span>↗</span></button></div></article>`;
  }).join('')||'<p class="bay-empty">收纳尺寸数据暂未载入，请稍后刷新。</p>';
  $('#storage-assumptions').innerHTML=(data?.storageDesign?.assumptions||[]).map(text=>`<li>${escapeHTML(detailText(text))}</li>`).join('');
  $('#storage-reference-note').textContent=data?.storageDesign?.referencesNote||'外部案例仅提供原文链接，不代表施工尺寸或品牌质量推荐。';
  $$('#storage-fitout-cards [data-storage-room]').forEach(button=>button.addEventListener('click',()=>{$('#storage-dialog').close();selectRoom('dining');switchView('model')}));
  $$('#storage-fitout-cards [data-storage-render]').forEach(button=>button.addEventListener('click',()=>{const fitout=fitouts.find(item=>item.id===button.dataset.storageRender);if(!fitout||button.disabled)return;$('#large-render').src=storageRenderPath(fitout);$('#large-render').alt=fitout.title+' · 条件收纳方案';$('#large-render-caption').textContent=fitout.title+' · Blender 同源模型 / 条件方案，非施工图';$('#image-dialog').showModal()}));
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
  return id==='bath_1'?`${width} mm宽、${depth} mm深浴室柜依${back}墙布置，镜面靠${back}；马桶和淋浴按阶梯边界安排。`:`${width} mm宽、${depth} mm深浅盆柜设在西北扩出位置，镜面靠${back}，保留紧凑马桶与东侧淋浴；选型及安装余量待复尺。`;
}
function bedroomSpecification(id){
  const bedId=id==='room_a'?'bed_a':id==='room_b'?'bed_b':null;
  const bed=bedId&&data?.furniture?.find(item=>item.id===bedId);if(!bed)return null;
  const head={east:'东',west:'西',north:'北',south:'南'}[bed.headDirection];if(!head)return null;
  const mattress=`${Number(bed.mattressWidthCm)*10}×${Number(bed.mattressLengthCm)*10}`,frame=`${Number(bed.frameWidthCm)*10}×${Number(bed.frameLengthCm)*10}`;
  const bay=data.windows?.find(window=>window.id===(id==='room_a'?'window_a':'window_b'))?.windowType==='bay';
  const fitout=bayFitoutFor(id),bayNote=fitout?`${detailText(fitout.summary)}${id==='room_b'?' 本轮取消独立书桌和办公椅；低台茶座仍为条件方案，非现场已确认。':' 具体尺寸与适用条件见飘窗方案。'}`:`浅木衣柜与柔和织物延续全屋配色${bay?'，北侧飘窗尺寸待复尺。':'。'}`;
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
  const accessNote=id==='bath_1'?'主卫北门通主卧，按套内卫生间使用；门宽与侧面构造待复尺。':id==='bath_2'?'客卫从公共走廊进入；门宽与侧面构造待复尺。':'';
  const bedroom=bedroomSpecification(id),fitout=bayFitoutFor(id);
  const styleNote=scheme.id!=='wood'&&['room_a','room_b','bath_1','bath_2','dining'].includes(id)?scheme.roomOverrides?.[id]?.description:'';
  $('#card-description').textContent=[styleNote,(id==='dining'?diningSpecification():'') || bedroom?.description || bathroomDescription(id) || (fitout?content.description:'') || r?.description || content.description,accessNote,...designNotes().filter(note=>note.roomId===id).map(note=>note.text)].filter(Boolean).join(' ');
  $('#view-bay-fitout').hidden=!(fitout||id==='overall');
  $('#view-bay-fitout').innerHTML=`${id==='overall'?'三处飘窗功能设计':'飘窗方案 · 尺寸 / 参考'} <span>↗</span>`;
  $('#view-storage-fitout').hidden=!['overall','dining','living'].includes(id);
  const features=bedroom?.features || ((scheme.id!=='wood'||fitout||id==='dining'||id==='bath_1'||id==='bath_2')?content.features:(r?.features || content.features));
  $('#room-tags').innerHTML=features.slice(0,3).map(t=>scheme.id==='wood'?t:({'现代原木':scheme.name,'暖色石材':'浅色卫浴','亚麻触感':'织物软包'})[t]||t).map(t=>`<span>${escapeHTML(t)}</span>`).join('');
  $('#room-preview').src=renderPath(id);$('#room-preview').alt=`${content.name} Blender 渲染预览`;
  $('#enter-room').innerHTML=`${id==='overall'?'探索客厅':'走进'+content.name} <span>↗</span>`;
  $$('#room-nav [data-room]').forEach(btn=>{btn.classList.toggle('active',btn.dataset.room===id);btn.setAttribute('aria-current',String(btn.dataset.room===id))});
  $$('#render-strip [data-render]').forEach(btn=>btn.classList.toggle('active',btn.dataset.render===id));
  $$('#floor-plan [data-plan-room]').forEach(p=>p.classList.toggle('selected',p.dataset.planRoom===id || (id==='dining'&&p.dataset.planRoom==='living')));
  roomLabelNodes.forEach(item=>item.element.classList.toggle('active',item.id===id));
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
  $$('.view-tabs [data-view]').forEach(btn=>{const active=btn.dataset.view===view;btn.setAttribute('aria-selected',String(active));btn.tabIndex=active?0:-1});
  $$('.view-panel').forEach(panel=>{const active=panel.id===`${view}-view`;panel.hidden=!active;panel.classList.toggle('active',active)});
  if(view==='renders')updateRender();
  if(view==='model'&&state.ready){resizeScene();if(!state.walking)controls.update()}
}

function updateRender(){
  if(!scheme)return;
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
  const storageIds=new Set((data.storageFitouts||[]).map(f=>f.id));
  const furniture=(data.furniture||[]).filter(f=>!storageIds.has(f.storageFitoutId)).map(planFurniture).join('');
  const fitouts=(data.bayFitouts||[]).flatMap(fitout=>[...(fitout.parts||[])].sort((a,b)=>(a.zCm||0)-(b.zCm||0)).map(part=>planFitoutPart(fitout,part))).join('');
  const storage=(data.storageFitouts||[]).flatMap(fitout=>[...(fitout.parts||[])].sort((a,b)=>(a.zCm||0)-(b.zCm||0)).map(part=>planStoragePart(fitout,part))).join('');
  const walls=(data.walls||[]).map(w=>`<line x1="${w[0]}" y1="${w[1]}" x2="${w[2]}" y2="${w[3]}" stroke="#8c887b" stroke-width="${wallThickness}" stroke-linecap="square"/>`).join('');
  const opening=(items,color)=>(items||[]).map(w=>`<line x1="${w.x1}" y1="${w.y1}" x2="${w.x2}" y2="${w.y2}" stroke="#fcf8ee" stroke-width="15"/><line data-opening-id="${escapeHTML(w.id)}" x1="${w.x1}" y1="${w.y1}" x2="${w.x2}" y2="${w.y2}" stroke="${color}" stroke-width="4"/>`).join('');
  const bayWindows=bays.map(b=>`<g data-bay-window="${b.window.id}" aria-label="${escapeHTML(b.window.name)}：外凸窗台投影，尺寸待复尺"><line x1="${b.window.x1}" y1="${b.window.y1}" x2="${b.window.x2}" y2="${b.window.y2}" stroke="#fcf8ee" stroke-width="${wallThickness+3}"/><polygon data-bay-sill points="${b.sill.map(p=>p.join(',')).join(' ')}" fill="#e6dac1" stroke="#c5b497" stroke-width="1.5"/>${b.returns.map(points=>`<polygon data-bay-return points="${points.map(p=>p.join(',')).join(' ')}" fill="#8c887b"/>`).join('')}<text x="${b.label[0]}" y="${b.label[1]}" text-anchor="middle" dominant-baseline="middle" font-size="16" fill="#958165"${b.vertical?` transform="rotate(-90 ${b.label[0]} ${b.label[1]})"`:''}>飘窗台</text></g>`).join('');
  // The integrated worktop spans the sill; retain the true outer frame/glass above its plan fill.
  const bayFrames=bays.map(b=>`<g data-bay-frame-layer="${escapeHTML(b.window.id)}"><polygon data-bay-front-frame data-frame-finish="${escapeHTML(bayFrameFinish)}" points="${b.frame.map(p=>p.join(',')).join(' ')}" fill="${bayFrameColor}"/><line data-bay-glass x1="${b.frontA[0]}" y1="${b.frontA[1]}" x2="${b.frontB[0]}" y2="${b.frontB[1]}" stroke="#8fa6a8" stroke-width="4"/></g>`).join('');
  const topDimensionY=planMinY-52,leftDimensionX=planMinX-55;
  const dimensions=`<g stroke="#b4a58e" stroke-width="1.5" fill="none"><path d="M0 ${topDimensionY}H687 M0 ${topDimensionY-14}v28 M687 ${topDimensionY-14}v28 M${leftDimensionX} 0v1401 M${leftDimensionX-14} 0h28 M${leftDimensionX-14} 1401h28 M200 1455h641 M200 1441v28 M841 1441v28"/></g><g fill="#9c8d73" font-size="19" text-anchor="middle"><text x="343" y="${topDimensionY-17}">6,870</text><text x="520" y="1484">6,410</text><text x="${leftDimensionX-20}" y="700" transform="rotate(-90 ${leftDimensionX-20} 700)">14,010</text><text x="793" y="${topDimensionY-2}" font-size="23">N ↑</text></g>`;
  $('#floor-plan').innerHTML=`<svg viewBox="${planMinX-115} ${planMinY-110} ${maxX-planMinX+160} ${maxY-planMinY+215}" role="img" aria-label="由同源尺寸数据绘制的三房两卫平面图，含飘窗与玄关餐边收纳条件方案；窗台投影不计入房间面积">${polygons}${furniture}${storage}${walls}${opening((data.windows||[]).filter(w=>w.windowType!=='bay'),'#8fa6a8')}${bayWindows}${opening(data.doors,'#c2a071')}${fitouts}${bayFrames}${labels.join('')}${dimensions}</svg>`;
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
  addText(`荟雅苑 · ${scheme?.name||'三房两卫'} / 同源模型平面`,y-57,26,'#615943');
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
    });scene.add(model);state.ready=true;
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
  walkWorld=buildWalkWorld(data);
  const ids=new Set(walkWorld.doors.map(door=>door.id));
  // Original floors end at the room's inner wall face. Bridge only existing
  // door-thickness gaps while their leaves are open for walking.
  walkThresholds=new three.Group();walkThresholds.name='Walk-only doorway floor infills';walkThresholds.visible=false;
  for(const door of walkWorld.doors){
    const horizontal=Math.abs(door.y1-door.y2)<.01;
    const width=Math.hypot(door.x2-door.x1,door.y2-door.y1)/100;
    const wet=door.id.includes('bath')||door.id==='balcony_door';
    const floor=new three.Mesh(new three.BoxGeometry(horizontal?width:.122,.012,horizontal?.122:width),new three.MeshStandardMaterial({color:wet?0xcac3b3:0xc9ac7a,roughness:.85}));
    floor.name='Walk threshold '+door.id;floor.position.set((door.x1+door.x2)/200,-.006,(door.y1+door.y2)/200);floor.userData={kind:'walk-threshold',openingId:door.id};walkThresholds.add(floor);
  }
  scene.add(walkThresholds);
  model.traverse(object=>{if(object.userData.walkDoorInfill&&ids.has(object.userData.openingId))walkDoorParts.push(object)});
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
  const seed=WALK_STARTS[state.room]||WALK_STARTS.overall;
  const start=findWalkStart(walkWorld,state.room,{x:seed[0],z:seed[1]});
  if(!start){toast('这个空间暂时没有合适的站立位置，请从全屋入口进入');return}
  walkRestore={cutWalls:state.cutWalls,doors:walkDoorParts.map(part=>[part,part.visible])};
  walkDoorParts.forEach(part=>part.visible=false);walkThresholds.visible=true;
  cameraTween=null;controls.enabled=false;state.walking=true;state.interior=true;
  activeHorizontalFov=null;camera.clearViewOffset();camera.near=.045;camera.fov=64;camera.updateProjectionMatrix();
  setWalls(false);$('#workspace').classList.add('walking');$('#walk-hud').hidden=false;$('#walk-pad').hidden=false;$('#walk-look-hint').hidden=false;
  $('#download-popover').hidden=true;$('#download-toggle').setAttribute('aria-expanded','false');
  const target=roomById(state.room)?.interiorCamera?.target;
  const yaw=target?Math.atan2(target[0]-start.x,start.z-target[2]):0;
  walkthrough.start(start,yaw);
  toast('已进入第一人称漫游 · 拖动转头，按键移动');
}
function stopWalk({refocus=true,restoreFocus=true}={}){
  if(!state.walking)return;
  walkthrough?.stop();cameraTween=null;state.walking=false;state.interior=false;
  for(const [part,visible]of walkRestore?.doors||[])part.visible=visible;
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
    while(owner){for(const key of ['kind','roomId','external','wallIndex','openingId'])if(semantic[key]===undefined&&owner.userData[key]!==undefined)semantic[key]=owner.userData[key];owner=owner.parent}
    const originalMaterial=object.material;
    if(semantic.kind==='door'||Array.isArray(originalMaterial)||object.isSkinnedMesh||originalMaterial.transparent||originalMaterial.transmission>0){
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
  [{label:'6,870 mm',point:[3.43,.05,-.6]},{label:'14,010 mm',point:[-.7,.05,7]},{label:'6,410 mm',point:[5.2,.05,14.55]}].forEach(item=>{const element=document.createElement('span');element.className='dimension-label';element.textContent=item.label;layer.appendChild(element);dimensionNodes.push({element,point:new three.Vector3(...item.point)})});
  const lines=[[[0,-.45],[6.87,-.45]],[[0,-.62],[0,-.28]],[[6.87,-.62],[6.87,-.28]],[[-.45,0],[-.45,14.01]],[[-.62,0],[-.28,0]],[[-.62,14.01],[-.28,14.01]],[[2,14.45],[8.41,14.45]],[[2,14.28],[2,14.62]],[[8.41,14.28],[8.41,14.62]]];
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
  ['#open-bays','#view-bay-fitout','#project-bay-link'].forEach(id=>$(id).addEventListener('click',()=>{if($('#project-dialog').open)$('#project-dialog').close();showBayFitouts()}));
  ['#open-storage','#view-storage-fitout','#project-storage-link'].forEach(id=>$(id).addEventListener('click',()=>{if($('#project-dialog').open)$('#project-dialog').close();showStorageFitouts()}));
  $$('.dialog-close').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
  $$('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close()}}));
  $('#enlarge-render').addEventListener('click',()=>{if(!scheme||!data)return;$('#large-render').src=renderPath(state.room);$('#large-render').alt=$('#active-render').alt;$('#large-render-caption').textContent=scheme.name+' · '+roomDescription(state.room).name+' · Blender 同源模型渲染';$('#image-dialog').showModal()});
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
  }catch(error){console.error('Scheme catalogue load failed',error);$('#loading-status').textContent='方案目录暂未载入';$('#model-loading').hidden=true;$('#scheme-load-error strong').textContent=schemeCatalog?'未找到这个设计方案':'设计资料暂未载入';$('#scheme-load-error').hidden=false;return}
  const results=await Promise.allSettled([getDesignData(),getJSON(scheme.manifest)]);
  data=results[0].status==='fulfilled'?results[0].value:null;manifest=results[1].status==='fulfilled'?results[1].value:{};
  if(!data){$('#loading-status').textContent='尺寸数据暂未载入';makeNavigation();showFallback('页面的尺寸数据暂未能载入，请稍后刷新。');return}
  data={...data,bayFitouts:(data.bayFitouts||[]).map(f=>({...f,...schemeTextOverride(scheme.bayOverrides,f.id)})),storageFitouts:(data.storageFitouts||[]).map(f=>({...f,...schemeTextOverride(scheme.storageOverrides,f.id)}))};
  const rawRooms=data.rooms.map(room=>({...room,points:room.points.map(p=>p.map(n=>n/100)),area:areaOf(room.points)/10000}));
  rooms=order.filter(id=>id!=='overall').map(id=>{
    const base=rawRooms.find(r=>r.id===(id==='dining'?'living':id))||{},extra=manifest.rooms?.find(r=>r.id===id)||{};
    return {...base,...extra,...schemeTextOverride(scheme.roomOverrides,id),id,name:roomDescription(id).name};
  });
  makeNavigation();makePlan();renderDesignNotes();renderBayFitouts();renderStorageFitouts();paintSchemePlan($('#floor-plan'));paintSchemePlan($('#storage-fitout-cards'));selectRoom(descriptions[location.hash.slice(1)]?location.hash.slice(1):'overall',{updateHash:false,animate:false});switchView('model');
  buildScene();
}
init();
