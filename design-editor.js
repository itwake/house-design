import {createDraft,deriveData,listSelections,selectionInfo,measurePoints,validateMove,validateDraft,loadDraft,saveDraft,clearDraft} from './design-editor-core.js?v=3.13.2';

const NS='http://www.w3.org/2000/svg';
const COLOR_FIELDS=[['wall','墙面'],['floor','地面'],['cabinet','柜面'],['wood','木材'],['fabric','织物'],['accent','点缀']];
const PRESETS=[
  {name:'奶白原木',colors:{wall:'#F1EEE6',floor:'#E5E0D5',cabinet:'#ECE7DC',wood:'#C5AF8B',fabric:'#D8D1C5',accent:'#83917E'}},
  {name:'清浅自然',colors:{wall:'#F4F3EE',floor:'#E3E1D9',cabinet:'#F5F2E9',wood:'#C7B59A',fabric:'#D3D6CD',accent:'#6F887D'}},
  {name:'温柔暖灰',colors:{wall:'#EBE8E2',floor:'#D5D1C9',cabinet:'#E9E4DB',wood:'#B09B7E',fabric:'#C8BBB0',accent:'#9B7664'}}
];
const clone=v=>structuredClone(v);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const el=(tag,attrs={},text)=>{const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs)){if(k==='class')n.className=v;else n.setAttribute(k,v);}if(text!==undefined)n.textContent=text;return n;};
const svgEl=(tag,attrs={},text)=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=text;return n;};
const mm=v=>Math.round(v).toLocaleString('zh-CN');
const errorsText=items=>(items||[]).map(v=>v.message||String(v)).join('；');
const recordKey=s=>`${s.type}|${s.key}`;

/** Personal, browser-local exploration; never mutates source or public models.
 * onDraftChange(draft,{preview,reason}) may synchronously rebuild the plan.
 * Call afterPlanRender(svg) after every makePlan; call destroy before switching
 * schemes. setAvailableMovableKeys([]) keeps all moves disabled until GLB maps.
 */
export function createDesignEditor(options){
  const {schemeId,sourceFingerprint,getSvg,onDraftChange=()=>{},onRoomSelect=()=>{},onRequestPlan=()=>{},onPanelChange=()=>{}}=options;
  const source=clone(options.source),context={schemeId,sourceFingerprint,data:source};
  const host=options.host||document.getElementById('workspace');
  if(!host)throw new Error('设计工具缺少 workspace 容器');
  let storage=options.storage;
  if(storage===undefined){try{storage=window.localStorage;}catch{storage=null;}}
  let draft=createDraft(schemeId,sourceFingerprint),preview=null,selected=null,mode='select',view='model';
  let opened=false,collapsed=false,destroyed=false,available=new Map(),mappingReady=false;
  let svg=null,homeViewBox=null,viewBox=null,drag=null,pendingPoint=null,measurements=[],sequence=0;
  let selectedMeasure=null,measureHistory=[],measureArmed=false;
  let history=[],savedSnapshot=null,raf=0,lastMove=null,colorPreviewKey=null;
  let cleanupPlan=()=>{};
  const cleanups=[];
  const listen=(node,type,callback,config)=>{node.addEventListener(type,callback,config);cleanups.push(()=>node.removeEventListener(type,callback,config));};
  const effective=()=>deriveData(source,preview||draft,{schemeId,sourceFingerprint});
  const emit=(value,reason,temporary=false)=>onDraftChange(clone(value),{preview:temporary,reason});
  const selectedInfo=()=>selected?selectionInfo(effective(),selected):null;
  const movePermission=info=>{
    if(!info||info.type!=='furniture')return {ok:false,reason:'请选择一件松散家具'};
    if(!info.movable||info.locked)return {ok:false,reason:info.lockedReason||'固定构造、定制柜或设备不可移动'};
    if(!mappingReady)return {ok:false,reason:'正在核对 3D 家具映射，暂不可移动'};
    const mapped=available.get(info.key);
    return mapped?.movable?{ok:true}:{ok:false,reason:mapped?.reason||'这件家具尚未完成 3D 对应，暂锁定'};
  };

  const shell=el('div',{class:'design-editor','data-design-editor':'','data-mode':mode});
  const toggle=el('button',{type:'button',class:'de-toggle','aria-expanded':'false','aria-controls':'design-editor-panel'},'设计工具');
  const panel=el('aside',{id:'design-editor-panel',class:'de-panel','aria-label':'个人设计工具',hidden:''});
  panel.innerHTML=`<header class="de-header"><div><strong>个人设计工具</strong><small>试摆 · 量尺 · 配色</small></div><button type="button" data-action="collapse" class="de-icon" aria-expanded="true" aria-label="折叠工具面板">−</button><button type="button" data-action="close" class="de-icon" aria-label="关闭设计工具">×</button></header>
    <div class="de-body"><p class="de-boundary">仅修改本机预览，不更改正式方案。效果图、模型下载仍是正式版本。</p>
    <div class="de-modes" role="group" aria-label="平面操作"><button type="button" data-mode="select" aria-pressed="true">选择尺寸</button><button type="button" data-mode="measure" aria-pressed="false">两点量尺</button><button type="button" data-mode="move" aria-pressed="false">移动家具</button><button type="button" data-mode="pan" aria-pressed="false">平移平面</button></div>
    <p class="de-mode-hint"></p><button type="button" data-action="plan" class="de-plan-request">切至平面操作</button>
    <div class="de-zoom" role="group" aria-label="平面缩放"><button type="button" data-action="zoom-out" aria-label="缩小平面">−</button><span class="de-zoom-level">100%</span><button type="button" data-action="zoom-in" aria-label="放大平面">＋</button><button type="button" data-action="zoom-reset">全图</button></div>
    <section class="de-selection"><label class="de-label">选择物件或空间<select class="de-object-select" aria-label="选择物件或空间"><option value="">点击平面，或从这里选择</option></select></label><div class="de-selection-info"></div>
    <form class="de-move-form"><div class="de-number-grid"><label>向东偏移 · mm<input name="dx" type="number" step="10" min="-30000" max="30000" value="0" inputmode="decimal"></label><label>向南偏移 · mm<input name="dy" type="number" step="10" min="-30000" max="30000" value="0" inputmode="decimal"></label></div><small>相对正式位置；负值为向西 / 向北。不改变尺寸或旋转。</small><button type="submit">应用偏移</button></form></section>
    <section class="de-measure-section"><div class="de-section-title"><h3>量尺 · 选择与编辑</h3><button type="button" data-action="measure-clear">清除全部</button></div><div class="de-measure-actions"><button type="button" data-action="measure-new">＋ 新增量尺</button><button type="button" data-action="measure-undo" disabled>撤销量尺</button><button type="button" data-action="measure-delete" disabled>删除选中</button></div><p class="de-measure-hint">点尺寸线选中；拖动 A / B 调整端点，拖动线段整体平移。</p><ol class="de-measures"></ol>
    <form class="de-measure-form" hidden><strong class="de-measure-name"></strong><label class="de-label">总长 · mm<input name="length" type="number" min="1" max="100000" step="any" inputmode="decimal" required></label><small>固定起点 A，保持方向，调整终点 B；仅修改量尺，不改家具或墙体。</small><button type="submit">应用长度</button><details class="de-measure-coordinates"><summary>精调 A / B 坐标</summary><p>相对模型原点，单位 mm；X 向东、Y 向南，不是房间净距。</p><div class="de-number-grid"><label>A · X<input name="ax" type="number" step="any" inputmode="decimal"></label><label>A · Y<input name="ay" type="number" step="any" inputmode="decimal"></label><label>B · X<input name="bx" type="number" step="any" inputmode="decimal"></label><label>B · Y<input name="by" type="number" step="any" inputmode="decimal"></label></div><button type="button" data-action="measure-coordinates-apply">应用端点坐标</button></details></form>
    <small>量尺独立撤销；测的是模型投影，非实测净距。量尺线仅本次会话保留，不随家具草稿保存。</small></section>
    <section><div class="de-section-title"><h3>个人配色</h3><button type="button" data-action="palette-reset">正式配色</button></div><div class="de-presets"></div><div class="de-colors"></div></section>
    <p class="de-status" role="status" aria-live="polite"></p>
    <footer class="de-footer"><button type="button" data-action="undo" disabled>撤销一步</button><button type="button" data-action="reset">恢复正式</button><button type="button" data-action="save" class="de-primary">保存到本机</button><small class="de-save-note">按方案独立保存于当前浏览器；不是账号或云同步。</small></footer></div>`;
  shell.append(toggle,panel);host.append(shell);
  const q=selector=>panel.querySelector(selector);
  const status=q('.de-status'),selectionBox=q('.de-selection-info'),objectSelect=q('.de-object-select');
  const confirmation=el('dialog',{class:'de-confirm','aria-labelledby':'de-confirm-title'});
  confirmation.innerHTML='<h2 id="de-confirm-title"></h2><p></p><div><button type="button" data-confirm="cancel">取消</button><button type="button" data-confirm="yes">确认</button></div>';
  shell.append(confirmation);let confirmAction=null;
  const setStatus=(message,tone='')=>{status.textContent=message;status.dataset.tone=tone;};
  const confirm=(title,message,action)=>{q('[data-action=reset]').blur();confirmation.querySelector('h2').textContent=title;confirmation.querySelector('p').textContent=message;confirmAction=action;confirmation.showModal();confirmation.querySelector('[data-confirm=cancel]').focus();};
  listen(confirmation,'click',event=>{const action=event.target.closest('[data-confirm]')?.dataset.confirm;if(!action)return;confirmation.close();const fn=confirmAction;confirmAction=null;if(action==='yes')fn?.();});
  listen(confirmation,'cancel',()=>{confirmAction=null;});

  function refreshList(){
    const wanted=selected?recordKey(selected):'';
    objectSelect.replaceChildren(el('option',{value:''},'点击平面，或从这里选择'));
    const all=listSelections(effective());
    for(const[type,label]of [['furniture','家具与设备'],['room','房间'],['door','门'],['window','窗']]){
      const group=el('optgroup',{label});
      all.filter(item=>item.type===type).forEach(info=>group.append(el('option',{value:recordKey(info)},`${info.label||info.name}${info.type==='furniture'&&!movePermission(info).ok?' · 锁定':''}`)));
      if(group.children.length)objectSelect.append(group);
    }
    objectSelect.value=wanted;
  }

  function renderSelection(){
    const info=selectedInfo();selectionBox.replaceChildren();
    q('.de-move-form').hidden=!info||info.type!=='furniture';
    if(!info){selectionBox.append(el('p',{},'点击家具、门窗或房间查看尺寸。'));return;}
    selectionBox.append(el('strong',{},info.label||info.name||info.key));
    const dims=info.dimensionsMm||{},labels={width:'宽',depth:'深',height:'高',length:'长',sill:'窗台高'};
    const row=el('div',{class:'de-dimensions'});
    for(const[key,label]of Object.entries(labels))if(Number.isFinite(dims[key]))row.append(el('span',{},`${label} ${mm(dims[key])} mm`));
    if(info.areaM2!==undefined)row.append(el('span',{},`模型面积 ${Number(info.areaM2).toFixed(2)} m²`));
    selectionBox.append(row);
    if(info.type==='room'&&info.edgeLengthsMm?.length){
      const details=el('details',{class:'de-room-edges'});details.append(el('summary',{},`查看 ${info.edgeLengthsMm.length} 条模型边长`));
      const list=el('ol');info.edgeLengthsMm.forEach((length,index)=>list.append(el('li',{},`边 ${index+1} · ${mm(length)} mm`)));details.append(list,el('small',{},'按模型轮廓顺序；不是现场净尺寸。'));selectionBox.append(details);
    }
    if(info.note)selectionBox.append(el('p',{},info.note));
    if(info.type==='furniture'){
      const permission=movePermission(info),offset=(preview||draft).offsets?.[info.key]||{dx:0,dy:0};
      q('[name=dx]').value=Math.round(offset.dx*10);q('[name=dy]').value=Math.round(offset.dy*10);
      q('.de-move-form button').disabled=!permission.ok;
      for(const input of q('.de-move-form').querySelectorAll('input'))input.disabled=!permission.ok;
      selectionBox.append(el('p',{class:permission.ok?'de-unlocked':'de-locked'},permission.ok?'可试摆：拖动或输入偏移。碰撞提示不等于施工可行。':`锁定：${permission.reason}`));
    }
  }

  function updateControls(){
    q('[data-action=undo]').disabled=!history.length;
    q('.de-plan-request').hidden=view==='plan';
    q('.de-zoom').hidden=view!=='plan';
    q('.de-mode-hint').textContent=({select:'点选后显示模型尺寸；家具优先于所在房间。',measure:pendingPoint?'已选 A，请点 B。Escape 可取消。':measureArmed?'新增量尺：依次点选 A、B 两点。':'点线选中；拖动端点调整，拖线平移。也可输入长度或删除。',move:'拖动已映射的松散家具。越界不能提交，碰撞会提示。',pan:'拖动平面查看；使用 ＋ / − 放大缩小。'})[mode];
    q('.de-zoom-level').textContent=homeViewBox&&viewBox?`${Math.round(homeViewBox[2]/viewBox[2]*100)}%`:'100%';
    q('.de-save-note').textContent=savedSnapshot&&same(draft,savedSnapshot)?'已保存到当前浏览器 · 按方案隔离 · 非云同步':savedSnapshot||history.length||Object.keys(draft.offsets||{}).length||Object.keys(draft.colors||{}).length?'存在未保存的个人预览 · 仅当前浏览器，非云同步':'按方案独立保存于当前浏览器；不是账号或云同步。';
    for(const input of q('.de-colors').querySelectorAll('input'))input.value=(preview||draft).colors?.[input.dataset.color]||PRESETS[0].colors[input.dataset.color];
  }

  function commit(value,reason,message){
    const checked=validateDraft(value,context);if(!checked.ok){setStatus(errorsText(checked.errors),'error');return false;}
    const next=checked.draft;if(same(next,draft)){preview=null;emit(draft,reason);return false;}
    history.push(clone(draft));if(history.length>30)history.shift();draft=clone(next);preview=null;
    emit(draft,reason);refreshList();renderSelection();drawOverlay();updateControls();
    if(message)setStatus(message);return true;
  }
  function select(info){selected=info?{type:info.type,key:info.key}:null;refreshList();renderSelection();drawOverlay();}
  function finishColorPreview(cancel=false){
    if(!colorPreviewKey)return;const value=preview;colorPreviewKey=null;preview=null;
    if(cancel){emit(draft,'palette-cancel');updateControls();}
    else if(value)commit(value,'palette-color','已应用个人配色，尚未保存。');
  }
  function setMode(next){cancelDrag();pendingPoint=null;measureArmed=false;mode=next;shell.dataset.mode=mode;panel.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));if(next==='measure')q('.de-selection').before(q('.de-measure-section'));else q('.de-selection').after(q('.de-measure-section'));updateControls();drawOverlay();if(view!=='plan')onRequestPlan();}
  function open(){opened=true;panel.hidden=false;toggle.setAttribute('aria-expanded','true');host.classList.add('design-editor-open');onPanelChange(true);refreshList();renderSelection();updateControls();drawOverlay();}
  function close(){finishColorPreview();cancelDrag();pendingPoint=null;opened=false;panel.hidden=true;toggle.setAttribute('aria-expanded','false');host.classList.remove('design-editor-open');onPanelChange(false);drawOverlay();toggle.focus();}

  function pointFromEvent(event){
    const active=getSvg?.()||svg,matrix=active?.getScreenCTM();if(!matrix)return null;
    try{const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());return {x:p.x,y:p.y};}catch{return null;}
  }
  function nearSegment(p,item,tol){const ax=item.x1,ay=item.y1,bx=item.x2,by=item.y2,dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((p.x-ax)*dx+(p.y-ay)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-ax-t*dx,p.y-ay-t*dy)<=tol;}
  function insidePolygon(p,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const[a,b]=points[i],[c,d]=points[j];if((b>p.y)!==(d>p.y)&&p.x<(c-a)*(p.y-b)/(d-b)+a)inside=!inside;}return inside;}
  function hit(p){
    const selections=listSelections(effective()),scale=svg?.getScreenCTM()?.a||1,tol=8/Math.max(Math.abs(scale),.02);
    const furniture=selections.filter(s=>s.type==='furniture'&&p.x>=s.x&&p.x<=s.x+s.w&&p.y>=s.y&&p.y<=s.y+s.d).sort((a,b)=>a.w*a.d-b.w*b.d);
    if(furniture.length)return furniture[0];
    const opening=selections.find(s=>['door','window'].includes(s.type)&&nearSegment(p,s,tol));if(opening)return opening;
    return selections.find(s=>s.type==='room'&&insidePolygon(p,s.points))||null;
  }
  function applyViewBox(){if(svg&&viewBox)svg.setAttribute('viewBox',viewBox.join(' '));updateControls();drawOverlay();}
  function zoom(factor,anchor){if(drag||!viewBox||!homeViewBox)return;const scale=Math.max(.8,Math.min(8,homeViewBox[2]/viewBox[2]*factor)),ratio=viewBox[2]/(homeViewBox[2]/scale),p=anchor||{x:viewBox[0]+viewBox[2]/2,y:viewBox[1]+viewBox[3]/2};viewBox=[p.x-(p.x-viewBox[0])/ratio,p.y-(p.y-viewBox[1])/ratio,viewBox[2]/ratio,viewBox[3]/ratio];applyViewBox();}

  function drawOverlay(){
    if(!svg)return;svg.querySelector('[data-editor-overlay]')?.remove();if(!opened)return;
    const group=svgEl('g',{'data-editor-overlay':'','pointer-events':'none','aria-hidden':'true'});svg.append(group);
    const matrix=svg.getScreenCTM(),scale=Math.hypot(matrix?.a||1,matrix?.b||0)||1,font=12/scale,sw=1.5/scale;
    const label=(x,y,text,color='#345b58')=>{const g=svgEl('g');g.append(svgEl('rect',{x:x-4/scale,y:y-font,width:(text.length*7+8)/scale,height:17/scale,rx:3/scale,fill:'#fffdf8','fill-opacity':'.95'}));g.append(svgEl('text',{x,y,'font-size':font,fill:color,'font-family':'system-ui, Microsoft YaHei, sans-serif'},text));group.append(g);};
    const info=selectedInfo();
    if(info){
      if(info.type==='room')group.append(svgEl('polygon',{points:info.points.map(p=>p.join(',')).join(' '),fill:'#54776b','fill-opacity':'.07',stroke:'#54776b','stroke-width':sw,'stroke-dasharray':`${5/scale} ${3/scale}`}));
      else if(['door','window'].includes(info.type))group.append(svgEl('line',{x1:info.x1,y1:info.y1,x2:info.x2,y2:info.y2,stroke:'#357970','stroke-width':4/scale}));
      else group.append(svgEl('rect',{x:info.x,y:info.y,width:info.w,height:info.d,fill:'none',stroke:'#357970','stroke-width':sw,'stroke-dasharray':`${5/scale} ${3/scale}`}));
      if(Number.isFinite(info.w)&&Number.isFinite(info.d))label(info.x,info.y-8/scale,`${mm(info.w*10)} × ${mm(info.d*10)} mm`);
    }
    for(const line of measurements){
      const{a,b}=line,m=measurePoints(a,b),active=line.id===selectedMeasure,color=active?'#176f75':'#ad704e';
      group.append(svgEl('path',{d:`M${a.x} ${a.y}H${b.x}V${b.y}`,fill:'none',stroke:'#7c9688','stroke-width':sw,'stroke-dasharray':`${4/scale} ${4/scale}`}));
      group.append(svgEl('line',{'data-measure-line':line.id,x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:color,'stroke-width':(active?2.5:1.5)/scale}));
      label((a.x+b.x)/2,(a.y+b.y)/2-8/scale,`${line.id}. ${mm(m.distanceMm)} mm`,color);
      for(const [end,p]of [['a',a],['b',b]]){group.append(svgEl('circle',{'data-measure-handle':end,'data-measure-id':line.id,cx:p.x,cy:p.y,r:(active?7:4)/scale,fill:active?'#fffdf7':color,stroke:color,'stroke-width':2/scale}));if(active&&mode==='measure')label(p.x+10/scale,p.y+4/scale,end.toUpperCase(),color);}
    }
    if(pendingPoint)group.append(svgEl('circle',{cx:pendingPoint.x,cy:pendingPoint.y,r:5/scale,fill:'#ad704e',stroke:'white','stroke-width':sw}));
    if(drag?.invalidRect)group.append(svgEl('rect',{...{x:drag.invalidRect.x,y:drag.invalidRect.y,width:drag.invalidRect.w,height:drag.invalidRect.d},fill:'#a53e2d','fill-opacity':'.12',stroke:'#b74435','stroke-width':sw}));
  }
  const measureSnapshot=()=>({lines:clone(measurements),selected:selectedMeasure});
  function rememberMeasures(before){if(same(before.lines,measurements))return;measureHistory.push(before);if(measureHistory.length>40)measureHistory.shift();}
  function restoreMeasures(before){measurements=clone(before.lines);selectedMeasure=before.selected;pendingPoint=null;measureArmed=false;renderMeasures();drawOverlay();}
  function validMeasure(line){return [line.a.x,line.a.y,line.b.x,line.b.y].every(n=>Number.isFinite(n)&&Math.abs(n)<=10000)&&Math.hypot(line.a.x-line.b.x,line.a.y-line.b.y)>=.1;}
  function editMeasure(next){if(!validMeasure(next)){setStatus('端点须为有效坐标（±100000 mm 内），且 A / B 至少相距 1 mm。','error');return;}const before=measureSnapshot();measurements=measurements.map(line=>line.id===next.id?next:line);rememberMeasures(before);renderMeasures();drawOverlay();setStatus('量尺已修改；仅改变标注，不改变户型或家具。');}
  function deleteMeasure(id){cancelDrag();const before=measureSnapshot();measurements=measurements.filter(line=>line.id!==id);if(selectedMeasure===id)selectedMeasure=null;pendingPoint=null;rememberMeasures(before);renderMeasures();drawOverlay();setStatus('已删除量尺，可用“撤销量尺”恢复。');}
  function renderMeasures(){
    const list=q('.de-measures');list.replaceChildren();for(const line of measurements){const item=el('li',{'data-selected':String(line.id===selectedMeasure)}),m=measurePoints(line.a,line.b),choose=el('button',{type:'button','data-measure-select':line.id,'aria-pressed':String(line.id===selectedMeasure)},`${line.id}. 总长 ${mm(m.distanceMm)} mm · 编辑`),remove=el('button',{type:'button','data-measure-delete':line.id,'aria-label':`删除量尺 ${line.id}`},'删除');item.append(choose,el('span',{},`水平 ${mm(m.horizontalMm)} · 垂直 ${mm(m.verticalMm)} mm`),remove);list.append(item);}
    const line=measurements.find(line=>line.id===selectedMeasure),form=q('.de-measure-form');form.hidden=!line;
    if(line){q('.de-measure-name').textContent=`编辑量尺 ${line.id} · A → B`;for(const[name,value]of Object.entries({length:measurePoints(line.a,line.b).distanceMm,ax:line.a.x*10,ay:line.a.y*10,bx:line.b.x*10,by:line.b.y*10}))form.elements.namedItem(name).value=Math.round(value*10)/10;}
    q('[data-action=measure-delete]').disabled=!line;q('[data-action=measure-undo]').disabled=!measureHistory.length;q('[data-action=measure-clear]').disabled=!measurements.length&&!pendingPoint;updateControls();
  }
  function measureHit(p,pointerType){
    const matrix=svg.getScreenCTM(),scale=Math.hypot(matrix.a,matrix.b),radius=(pointerType==='touch'?22:11)/scale;
    const ordered=[...measurements].sort((a,b)=>(b.id===selectedMeasure)-(a.id===selectedMeasure));
    for(const line of ordered){const ends=['a','b'].map(end=>({line,end,d:Math.hypot(p.x-line[end].x,p.y-line[end].y)})).sort((a,b)=>a.d-b.d);if(ends[0].d<=radius)return ends[0];}
    for(const line of ordered){if(nearSegment(p,{x1:line.a.x,y1:line.a.y,x2:line.b.x,y2:line.b.y},radius))return{line,end:'line'};const x=(line.a.x+line.b.x)/2,y=(line.a.y+line.b.y)/2-8/scale,text=`${line.id}. ${mm(measurePoints(line.a,line.b).distanceMm)} mm`;if(p.x>=x-4/scale&&p.x<=x+(text.length*7+4)/scale&&p.y>=y-12/scale&&p.y<=y+5/scale)return{line,end:'line'};}return null;
  }

  function pointerDown(event){
    if(destroyed||!opened||view!=='plan'||event.button!==0||drag)return;
    finishColorPreview();const p=pointFromEvent(event);if(!p)return;event.preventDefault();event.stopImmediatePropagation();
    if(mode==='measure'){
      svg.setAttribute('tabindex','-1');svg.focus({preventScroll:true});
      const found=!pendingPoint&&!measureArmed?measureHit(p,event.pointerType):null;
      if(found){selectedMeasure=found.line.id;drag={type:'measure',pointerId:event.pointerId,start:p,before:measureSnapshot(),line:clone(found.line),end:found.end};host.setPointerCapture?.(event.pointerId);renderMeasures();drawOverlay();setStatus(found.end==='line'?'已选量尺：拖线整体平移，或在面板修改 / 删除。':'拖动端点调整；Escape 取消这次修改。');return;}
      if(!pendingPoint){pendingPoint=p;selectedMeasure=null;setStatus('起点 A 已选，请点击终点 B。');}
      else{const next={id:sequence+1,a:pendingPoint,b:p};if(validMeasure(next)){const before=measureSnapshot();measurements.push(next);sequence++;selectedMeasure=next.id;pendingPoint=null;measureArmed=false;rememberMeasures(before);setStatus('已添加量尺；拖动 A / B 调整，或点“删除选中”。');}else setStatus('两端至少相距 1 mm，请重新选择终点。','warning');}renderMeasures();drawOverlay();return;
    }
    if(mode==='pan'){drag={type:'pan',pointerId:event.pointerId,start:p,startClient:{x:event.clientX,y:event.clientY},matrix:svg.getScreenCTM().inverse(),viewBox:[...viewBox]};host.setPointerCapture?.(event.pointerId);return;}
    const info=hit(p);select(info);if(mode!=='move')return;
    const permission=movePermission(info);if(!permission.ok){setStatus(permission.reason,'warning');return;}
    const offset=draft.offsets?.[info.key]||{dx:0,dy:0};
    drag={type:'move',pointerId:event.pointerId,start:p,key:info.key,startDraft:clone(draft),offset,info,valid:true,result:null,changed:false};host.setPointerCapture?.(event.pointerId);setStatus('拖动试摆中；松手提交，Escape 取消。');
  }
  function processMove(event){
    if(!drag||event.pointerId!==drag.pointerId)return;
    if(drag.type==='pan'){const v=new DOMPoint(event.clientX-drag.startClient.x,event.clientY-drag.startClient.y).matrixTransform(new DOMMatrix([drag.matrix.a,drag.matrix.b,drag.matrix.c,drag.matrix.d,0,0]));viewBox=[drag.viewBox[0]-v.x,drag.viewBox[1]-v.y,drag.viewBox[2],drag.viewBox[3]];applyViewBox();return;}
    const p=pointFromEvent(event);if(!p)return;
    if(drag.type==='measure'){
      const dx=p.x-drag.start.x,dy=p.y-drag.start.y,next=clone(drag.line);
      for(const end of ['a','b'])if(drag.end==='line'||drag.end===end){next[end].x+=dx;next[end].y+=dy;}
      drag.valid=validMeasure(next);if(drag.valid)measurements=measurements.map(line=>line.id===next.id?next:line);
      renderMeasures();drawOverlay();return;
    }
    const offset={dx:Math.round((drag.offset.dx+p.x-drag.start.x)*10)/10,dy:Math.round((drag.offset.dy+p.y-drag.start.y)*10)/10};
    const result=validateMove(source,drag.startDraft,drag.key,offset,{schemeId,sourceFingerprint});drag.result=result;drag.changed=!same(offset,drag.offset);drag.valid=result.ok;
    if(result.ok){drag.invalidRect=null;preview=result.draft;emit(preview,'drag-preview',true);}
    else{drag.invalidRect={...drag.info,x:drag.info.x+offset.dx-drag.offset.dx,y:drag.info.y+offset.dy-drag.offset.dy};preview=null;emit(drag.startDraft,'drag-invalid',true);}
    drawOverlay();
  }
  function cancelDrag(){if(!drag)return;const d=drag;drag=null;lastMove=null;if(raf){cancelAnimationFrame(raf);raf=0;}if(d.type==='move'){preview=null;emit(d.startDraft,'drag-cancel');setStatus('已取消移动，恢复拖动前位置。');}else if(d.type==='measure'){restoreMeasures(d.before);setStatus('已取消量尺拖动，恢复原位置。');}try{host.releasePointerCapture?.(d.pointerId);}catch{}renderSelection();drawOverlay();}
  function pointerEnd(event){
    if(!drag||event.pointerId!==drag.pointerId)return;if(raf){cancelAnimationFrame(raf);raf=0;}processMove(event);
    const d=drag;drag=null;lastMove=null;try{host.releasePointerCapture?.(d.pointerId);}catch{}
    if(d.type==='move'){
      if(d.valid&&d.result?.ok&&d.changed){commit(d.result.draft,'move','已应用个人试摆，尚未保存。');if(d.result.warnings?.length)setStatus(`已试摆；注意：${errorsText(d.result.warnings)}`,'warning');}
      else{preview=null;emit(d.startDraft,'drag-revert');if(!d.valid)setStatus(`没有应用：${errorsText(d.result?.errors)}`,'error');}
    }
    else if(d.type==='measure'){if(d.valid!==false){rememberMeasures(d.before);renderMeasures();setStatus('量尺已选中，可拖动调整、输入长度或删除。');}else{restoreMeasures(d.before);setStatus('量尺端点无效，已恢复拖动前位置。','warning');}}
    renderSelection();drawOverlay();
  }

  function afterPlanRender(nextSvg){
    if(destroyed||!nextSvg)return;cleanupPlan();svg=nextSvg;
    const original=svg.dataset.editorOriginalViewBox||svg.getAttribute('viewBox');svg.dataset.editorOriginalViewBox=original;
    if(!homeViewBox){homeViewBox=original.split(/[ ,]+/).map(Number);viewBox=[...homeViewBox];}
    svg.setAttribute('viewBox',viewBox.join(' '));svg.dataset.editorBound='true';
    const active=svg,listeners=[];
    const bind=(type,fn,opts)=>{active.addEventListener(type,fn,opts);listeners.push(()=>active.removeEventListener(type,fn,opts));};
    bind('pointerdown',pointerDown,{capture:true});
    bind('click',event=>{if(!destroyed&&opened&&view==='plan'){event.preventDefault();event.stopImmediatePropagation();}},{capture:true});
    bind('keydown',event=>{if(destroyed||!opened)return;if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopImmediatePropagation();const room=event.target.closest('[data-plan-room]')?.dataset.planRoom;if(room){select(selectionInfo(effective(),{type:'room',key:room}));}}},{capture:true});
    bind('wheel',event=>{if(destroyed||!opened||view!=='plan'||(!event.ctrlKey&&mode!=='pan'))return;event.preventDefault();zoom(event.deltaY<0?1.12:1/1.12,pointFromEvent(event));},{passive:false});
    cleanupPlan=()=>{listeners.forEach(fn=>fn());active.querySelector('[data-editor-overlay]')?.remove();};
    drawOverlay();updateControls();
  }

  listen(toggle,'click',()=>opened?close():open());
  listen(panel,'click',event=>{
    const button=event.target.closest('button');if(!button)return;
    finishColorPreview();
    if(button.dataset.mode){setMode(button.dataset.mode);return;}
    if(button.dataset.measureSelect){cancelDrag();setMode('measure');selectedMeasure=Number(button.dataset.measureSelect);renderMeasures();drawOverlay();return;}
    if(button.dataset.measureDelete){deleteMeasure(Number(button.dataset.measureDelete));return;}
    const action=button.dataset.action;
    if(action==='close')close();
    else if(action==='collapse'){collapsed=!collapsed;shell.classList.toggle('de-collapsed',collapsed);button.textContent=collapsed?'＋':'−';button.setAttribute('aria-expanded',String(!collapsed));button.setAttribute('aria-label',collapsed?'展开工具面板':'折叠工具面板');}
    else if(action==='plan')onRequestPlan();
    else if(action==='zoom-in')zoom(1.3);else if(action==='zoom-out')zoom(1/1.3);else if(action==='zoom-reset'){viewBox=homeViewBox&&[...homeViewBox];applyViewBox();}
    else if(action==='measure-new'){cancelDrag();setMode('measure');measureArmed=true;selectedMeasure=null;pendingPoint=null;renderMeasures();drawOverlay();setStatus('新增量尺：依次点击 A、B；可与已有量尺重叠。');}
    else if(action==='measure-delete')deleteMeasure(selectedMeasure);
    else if(action==='measure-undo'){cancelDrag();if(measureHistory.length){restoreMeasures(measureHistory.pop());setStatus('已撤销量尺操作；家具和配色不变。');}}
    else if(action==='measure-clear'){cancelDrag();const before=measureSnapshot();measurements=[];selectedMeasure=null;pendingPoint=null;measureArmed=false;rememberMeasures(before);renderMeasures();drawOverlay();setStatus('量尺已清空，可用“撤销量尺”恢复。');}
    else if(action==='measure-coordinates-apply'){
      cancelDrag();const line=measurements.find(line=>line.id===selectedMeasure),form=q('.de-measure-form');if(!line)return;
      const names=['ax','ay','bx','by'];if(names.some(name=>!form.elements.namedItem(name).value.trim())){setStatus('请完整填写 A、B 的四个坐标。','error');return;}
      const values=names.map(name=>Number(form.elements.namedItem(name).value)/10);editMeasure({...line,a:{x:values[0],y:values[1]},b:{x:values[2],y:values[3]}});
    }
    else if(action==='palette-reset')commit({...draft,colors:{}},'palette-reset','已恢复正式配色。');
    else if(action==='save'){cancelDrag();const result=saveDraft(storage,draft,context);if(result.ok){savedSnapshot=clone(draft);setStatus('已保存到当前浏览器，其他设备和账号不会同步。');}else setStatus(`保存失败：${errorsText(result.errors)||'当前浏览器不可使用本地存储。'}`,'error');updateControls();}
    else if(action==='undo'&&history.length)confirm('撤销上一步？','仅撤销本次会话上一项个人修改，不影响正式方案。',()=>{cancelDrag();draft=history.pop();preview=null;emit(draft,'undo');refreshList();renderSelection();updateControls();setStatus('已撤销；如需保留请重新保存到本机。');});
    else if(action==='reset')confirm('恢复正式方案？','清除此方案在当前浏览器保存的个人草稿，并恢复正式位置和配色。其他方案不受影响。',()=>{cancelDrag();history.push(clone(draft));draft=createDraft(schemeId,sourceFingerprint);preview=null;savedSnapshot=null;const result=clearDraft(storage,schemeId);emit(draft,'reset');refreshList();renderSelection();drawOverlay();updateControls();setStatus(result?.ok===false?'预览已恢复，但本机旧草稿清除失败，请检查浏览器存储权限。':'已恢复正式方案；未修改公开网站模型。',result?.ok===false?'warning':'');});
  });
  listen(objectSelect,'change',()=>{finishColorPreview();const entry=listSelections(effective()).find(v=>recordKey(v)===objectSelect.value);select(entry);if(view!=='plan')onRequestPlan();});
  listen(q('.de-measure-form'),'submit',event=>{
    event.preventDefault();cancelDrag();const line=measurements.find(line=>line.id===selectedMeasure),input=q('.de-measure-form [name=length]');if(!line)return;
    const length=Number(input.value),old=measurePoints(line.a,line.b).distanceMm;if(!input.value.trim()||!Number.isFinite(length)||length<1||length>100000||old<1){setStatus('请输入 1～100000 mm 的有效长度。','error');return;}
    editMeasure({...line,b:{x:line.a.x+(line.b.x-line.a.x)*length/old,y:line.a.y+(line.b.y-line.a.y)*length/old}});
  });
  listen(q('.de-measure-form'),'keydown',event=>{if(event.key==='Enter'&&['ax','ay','bx','by'].includes(event.target.name)){event.preventDefault();q('[data-action=measure-coordinates-apply]').click();}});
  listen(q('.de-move-form'),'submit',event=>{
    event.preventDefault();cancelDrag();const info=selectedInfo(),permission=movePermission(info);if(!permission.ok){setStatus(permission.reason,'warning');return;}
    const dx=Number(q('[name=dx]').value),dy=Number(q('[name=dy]').value);if(!q('[name=dx]').value.trim()||!q('[name=dy]').value.trim()||!Number.isFinite(dx)||!Number.isFinite(dy)){setStatus('请输入有效的毫米数值。','error');return;}
    const result=validateMove(source,draft,info.key,{dx:dx/10,dy:dy/10},{schemeId,sourceFingerprint});
    if(!result.ok){setStatus(`没有应用：${errorsText(result.errors)}`,'error');return;}
    commit(result.draft,'numeric-move','已应用个人偏移，尚未保存。');if(result.warnings?.length)setStatus(`已试摆；注意：${errorsText(result.warnings)}`,'warning');
  });
  for(const preset of PRESETS){const button=el('button',{type:'button'},preset.name);button.addEventListener('click',()=>commit({...draft,colors:{...preset.colors}},'palette-preset',`已预览「${preset.name}」，尚未保存。`));q('.de-presets').append(button);}
  for(const[key,label]of COLOR_FIELDS){
    const wrapper=el('label',{class:'de-color'}),input=el('input',{type:'color','data-color':key,'aria-label':`${label}颜色`,value:PRESETS[0].colors[key]});wrapper.append(input,el('span',{},label));
    listen(input,'input',()=>{if(colorPreviewKey&&colorPreviewKey!==key)finishColorPreview();const next={...draft,colors:{...draft.colors,[key]:input.value}},result=validateDraft(next,context);if(!result.ok)return;colorPreviewKey=key;preview=result.draft;emit(preview,'palette-preview',true);});
    listen(input,'change',()=>{if(colorPreviewKey===key)finishColorPreview();else commit({...draft,colors:{...draft.colors,[key]:input.value}},'palette-color','已应用个人配色，尚未保存。');});
    listen(input,'blur',()=>{if(colorPreviewKey===key)finishColorPreview();});q('.de-colors').append(wrapper);
  }
  listen(window,'pointermove',event=>{if(!drag||drag.pointerId!==event.pointerId)return;event.preventDefault();lastMove=event;if(!raf)raf=requestAnimationFrame(()=>{raf=0;if(lastMove)processMove(lastMove);});},{passive:false});
  listen(window,'pointerup',pointerEnd);
  listen(window,'pointercancel',event=>{if(drag?.pointerId===event.pointerId)cancelDrag();});
  listen(host,'lostpointercapture',event=>{if(drag?.pointerId===event.pointerId)cancelDrag();});
  listen(window,'blur',()=>cancelDrag());
  listen(window,'keydown',event=>{
    if(!opened||confirmation.open||document.querySelector('dialog[open]'))return;
    if(event.key==='Escape'){if(drag){event.preventDefault();cancelDrag();}else if(colorPreviewKey){event.preventDefault();finishColorPreview(true);setStatus('已取消这次配色预览。');}else if(pendingPoint||measureArmed){pendingPoint=null;measureArmed=false;renderMeasures();drawOverlay();setStatus('已取消未完成的量尺。');}}
    else if((event.key==='Delete'||event.key==='Backspace')&&mode==='measure'&&view==='plan'&&selectedMeasure!==null&&!event.target.closest('input,textarea,select,[contenteditable]')){event.preventDefault();deleteMeasure(selectedMeasure);}
  });
  listen(window,'resize',()=>{cancelDrag();drawOverlay();});
  const loaded=loadDraft(storage,context);
  if(loaded.status==='loaded'){draft=clone(loaded.draft);savedSnapshot=clone(draft);setStatus('已恢复此方案在当前浏览器保存的个人草稿。');queueMicrotask(()=>{if(!destroyed)emit(draft,'load');});}
  else if(loaded.status==='fingerprint-mismatch')setStatus('正式方案已更新，旧草稿未自动应用。可点击“恢复正式”清除本机旧草稿。','warning');
  else if(loaded.status==='invalid')setStatus('本机草稿格式不受支持，未应用；可恢复正式后重新保存。','warning');
  else if(loaded.status==='unavailable')setStatus('当前浏览器无法使用本地存储；仍可临时试摆。','warning');
  refreshList();renderSelection();renderMeasures();updateControls();afterPlanRender(getSvg?.());

  return {
    afterPlanRender,
    setAvailableMovableKeys(values){
      cancelDrag();finishColorPreview();
      available=new Map();for(const item of values||[]){const value=typeof item==='string'?{key:item,movable:true}:item;if(value?.key)available.set(value.key,{movable:value.movable!==false&&value.mapped!==false,reason:value.reason});}mappingReady=true;
      // A valid source fingerprint does not guarantee every GLB furniture key
      // maps. Keep unsupported saved placements out of both 2D and 3D, while
      // leaving the original storage and savedSnapshot intact until Save.
      const known=new Map(listSelections(source).filter(item=>item.type==='furniture').map(item=>[item.key,item]));
      const unavailable=key=>!movePermission(known.get(key)).ok;
      const removed=Object.keys(draft.offsets||{}).filter(unavailable);
      const sanitize=value=>{const next=clone(value);for(const key of Object.keys(next.offsets||{}))if(unavailable(key))delete next.offsets[key];return next;};
      if(removed.length){
        draft=sanitize(draft);preview=null;history=history.map(sanitize);
        emit(draft,'mapping-reconciled');
        setStatus(`已跳过 ${removed.length} 件无法对应可移动 3D 家具的位移，2D / 3D 已恢复其正式位置；个人配色保留。本机旧存档未覆盖，当前预览尚未保存。`,'warning');
      }
      refreshList();renderSelection();drawOverlay();updateControls();
    },
    setView(next){view=next==='space'?'model':next;if(view!=='plan')cancelDrag();shell.dataset.view=view;updateControls();},
    getDraft:()=>clone(draft),isOpen:()=>opened,open,close,
    destroy(){if(destroyed)return;cancelDrag();finishColorPreview(true);destroyed=true;if(raf)cancelAnimationFrame(raf);cleanupPlan();cleanups.forEach(fn=>fn());confirmation.close();shell.remove();host.classList.remove('design-editor-open');if(opened)onPanelChange(false);}
  };
}
