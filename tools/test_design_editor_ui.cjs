// Real-browser V3.13 editor acceptance. The only injected code reads diagnostics;
// every edit/measurement/save uses visible controls and actual pointer events.
// Run on the root agent only, after other rendering has released the two CPUs.
// --family-only: full desktop family, no other schemes/mobile.
// --mobile-only: independent 390px family selection/measurement smoke.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createHash}=require('node:crypto');
let chromium;try{({chromium}=require('playwright'))}catch{({chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')))}
const root=path.resolve(__dirname,'..'),out=path.join(root,'tmp','design-editor-ui');
const base=process.argv.find(a=>a.startsWith('--base='))?.slice(7)||'http://127.0.0.1:4187/';
const mobileOnly=process.argv.includes('--mobile-only'),familyOnly=process.argv.includes('--family-only');
const sha=b=>createHash('sha256').update(b).digest('hex');
const source=fs.readFileSync(path.join(root,'studio.js'),'utf8');
const hooks=`\nwindow.__editorQA={ready:()=>state.ready&&!!editorScene,source:()=>data,baseline:()=>editorBaseline,draft:()=>editorDraft,scene:()=>editorScene?.getFurnitureStates(),materials:()=>editorScene?.getMaterialStates(),view:()=>state.view};`;
const key='name:三人沙发',results=[];
let checks=0;
function check(value,message){assert.ok(value,message);checks++}
function equal(a,b,message){assert.deepEqual(a,b,message);checks++}
function near(a,b,message,tolerance=.002){check(Number.isFinite(a)&&Math.abs(a-b)<=tolerance,`${message}: ${a} vs ${b}`)}
function collect(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(e=>e.isDirectory()?collect(path.join(directory,e.name)):[path.join(directory,e.name)])}
function assetSnapshot(){
  const files=['wood','family','laundry'].flatMap(id=>[
    ...['design-data.json','scene-manifest.json','huiyayuan-wood.glb'].map(file=>path.join(root,'models','schemes',id,file)),
    ...collect(path.join(root,'assets','schemes',id)).filter(file=>/\.(jpg|jpeg|png|webp)$/i.test(file))]);
  return Object.fromEntries(files.sort().map(file=>[path.relative(root,file),sha(fs.readFileSync(file))]));
}
async function snapshot(page){return page.evaluate(()=>({data:window.__editorQA.source(),baseline:window.__editorQA.baseline(),draft:window.__editorQA.draft(),scene:window.__editorQA.scene()}))}
async function materialSnapshot(page){return page.evaluate(()=>window.__editorQA.materials())}
function item(data){return data.furniture.find(f=>(f.id||`name:${f.name}`)===key)}
async function waitOffset(page,dx,dy){await page.waitForFunction(({key,dx,dy})=>{const p=window.__editorQA.draft().offsets[key]||{dx:0,dy:0};const s=window.__editorQA.scene().find(s=>s.key===key);return Math.abs(p.dx-dx)<.01&&Math.abs(p.dy-dy)<.01&&Math.abs(s.offset.dx-dx)<.01&&Math.abs(s.offset.dy-dy)<.01},{key,dx,dy},{timeout:15000})}
function verifyMovement(before,after,dx,dy,label){
  equal(after.baseline,before.baseline,label+' baseline is immutable');
  const old=item(before.baseline),now=item(after.data);
  near(now.x,old.x+dx,label+' source x');near(now.y,old.y+dy,label+' source y');
  equal([now.w,now.d,now.heightCm],[old.w,old.d,old.heightCm],label+' purchased size retained');
  equal(now.rugCm,old.rugCm,label+' rug does not silently follow sofa');
  const otherAfter=after.data.furniture.filter(f=>(f.id||`name:${f.name}`)!==key);
  equal(otherAfter,before.baseline.furniture.filter(f=>(f.id||`name:${f.name}`)!==key),label+' other source furniture unchanged');
  const baseRows=new Map(before.scene.map(s=>[s.key,s]));let movedParts=0;
  for(const state of after.scene){
    const prior=baseRows.get(state.key);check(prior,label+' no new scene furniture');
    const changed=state.key===key,expectedX=changed?dx:0,expectedY=changed?dy:0;
    equal(state.parts?.length,prior.parts?.length,label+' mesh count retained');
    for(let i=0;i<(state.parts||[]).length;i++){
      const part=state.parts[i],oldPart=prior.parts[i];equal([part.index,part.name],[oldPart.index,oldPart.name],label+' actual part identity');
      near(part.positionCm[0],oldPart.positionCm[0]+expectedX,label+' actual part X');
      near(part.positionCm[1],oldPart.positionCm[1],label+' actual part height');
      near(part.positionCm[2],oldPart.positionCm[2]+expectedY,label+' actual part plan Y');
      if(changed)movedParts++;
    }
    if(state.boundsCm&&prior.boundsCm)for(const edge of ['min','max'])for(let axis=0;axis<3;axis++)near(state.boundsCm[edge][axis],prior.boundsCm[edge][axis]+(axis===0?expectedX:axis===2?expectedY:0),label+' actual mesh bounds');
  }
  check(movedParts>0,label+' actual multi-part sofa verified');return movedParts;
}
async function planBounds(page){return page.locator(`[data-editor-furniture="${key}"]`).evaluate(n=>{const b=n.getBBox();return{x:b.x,y:b.y,w:b.width,d:b.height}})}
async function pointOnScreen(page,p){
  const position=await page.locator('#floor-plan svg').evaluate((svg,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform(svg.getScreenCTM());const hit=document.elementFromPoint(q.x,q.y);return{x:q.x,y:q.y,exposed:!!hit&&(hit===svg||svg.contains(hit)),viewport:q.x>=0&&q.y>=0&&q.x<innerWidth&&q.y<innerHeight}},p);
  check(position.viewport&&position.exposed,`Actual plan point ${p.x},${p.y} is visible/unobscured at ${position.x},${position.y}`);return position;
}
async function clickPoint(page,p){const at=await pointOnScreen(page,p);await page.mouse.click(at.x,at.y)}
async function openEditor(page){if(await page.locator('.de-toggle').getAttribute('aria-expanded')!=='true')await page.locator('.de-toggle').click();await page.locator('.de-modes [data-mode=select]').click();await page.locator('#floor-plan svg').waitFor({state:'visible'});check(await page.locator('.de-panel').isVisible(),'Visible editor opened')}
async function confirmAction(page,name){await page.locator(`.de-panel [data-action=${name}]`).click();check(await page.locator('.de-confirm').isVisible(),name+' requires explicit confirmation');await page.locator('.de-confirm [data-confirm=yes]').click()}
async function numericMove(page,dxMm,dyMm){await page.locator('.de-object-select').selectOption(`furniture|${key}`);await page.locator('.de-move-form [name=dx]').fill(String(dxMm));await page.locator('.de-move-form [name=dy]').fill(String(dyMm));await page.locator('.de-move-form button').click();await waitOffset(page,dxMm/10,dyMm/10)}
async function checkDimensions(page){const text=(await page.locator('.de-selection-info').textContent()).replaceAll(',','');for(const value of ['2410','980','830'])check(text.includes(value),`Purchased sofa dimension ${value}mm`)}
async function measure(page){
  const a={x:430,y:650},b={x:520,y:770};
  await page.locator('.de-modes [data-mode=measure]').click();
  await clickPoint(page,a);await clickPoint(page,b);
  const record=await page.locator('.de-measures li').last().textContent();
  const clean=record.replaceAll(',',''),total=Number(clean.match(/总长\s*([\d.]+)/)?.[1]),horizontal=Number(clean.match(/水平\s*([\d.]+)/)?.[1]),vertical=Number(clean.match(/垂直\s*([\d.]+)/)?.[1]);
  near(total,1500,'UI diagonal measurement mm',20);near(horizontal,900,'UI horizontal measurement mm',20);near(vertical,1200,'UI vertical measurement mm',20);
  return{total,horizontal,vertical};
}
async function loadPage(context,id,width){
  const page=await context.newPage(),errors=[];await page.setViewportSize({width,height:1000});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/studio.js*',r=>r.fulfill({contentType:'text/javascript; charset=utf-8',body:source+hooks}));
  let nativeHash;await page.route(`**/models/schemes/${id}/huiyayuan-wood.glb*`,async route=>{const response=await route.fetch({timeout:180000});nativeHash=sha(await response.body());await route.fulfill({response})});
  await page.goto(new URL(`studio.html?scheme=${id}&v=3.13.0#living`,base).href,{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForFunction(()=>window.__editorQA?.ready(),{},{timeout:180000});
  equal(nativeHash,sha(fs.readFileSync(path.join(root,`models/schemes/${id}/huiyayuan-wood.glb`))),id+' exact real GLB response SHA');
  equal(await page.evaluate(()=>window.__editorQA.source().version),'3.12.0',id+' formal source stays 3.12.0');
  check(await page.evaluate(key=>window.__editorQA.scene().find(s=>s.key===key)?.movable,key),id+' sofa has real mapped meshes');
  return{page,errors};
}
async function finishPage(page,errors,id,width){
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${id} ${width} no horizontal document overflow`);
  equal(errors,[],id+' no uncaught JS errors');await page.screenshot({path:path.join(out,`${id}-${width}-editor.png`)});await page.close();
}
async function fullFamily(context){
  const {page,errors}=await loadPage(context,'family',1440);
  try{
    await openEditor(page);const before=await snapshot(page),originalPlan=await planBounds(page);equal(before.draft.offsets,{},'Fresh context starts with formal locations');
    const sofa=item(before.data);await clickPoint(page,{x:sofa.x+sofa.w/2,y:sofa.y+sofa.d/2});
    equal(await page.locator('.de-object-select').inputValue(),`furniture|${key}`,'Real point click selects sofa rather than room');await checkDimensions(page);
    const first=await measure(page);await page.locator('.de-panel [data-action=zoom-in]').click();const second=await measure(page);
    for(const axis of ['total','horizontal','vertical'])near(second[axis],first[axis],'Zoom does not change model '+axis,20);
    await page.locator('.de-panel [data-action=zoom-reset]').click();
    await numericMove(page,100,50);verifyMovement(before,await snapshot(page),10,5,'Numeric move');
    const shiftedPlan=await planBounds(page);near(shiftedPlan.x,originalPlan.x+10,'Actual SVG X follows draft');near(shiftedPlan.y,originalPlan.y+5,'Actual SVG Y follows draft');
    await confirmAction(page,'undo');await waitOffset(page,0,0);verifyMovement(before,await snapshot(page),0,0,'Undo');
    await page.locator('.de-modes [data-mode=move]').click();
    const start={x:sofa.x+sofa.w/2,y:sofa.y+sofa.d/2},end={x:start.x+20,y:start.y+10};
    const from=await pointOnScreen(page,start),to=await pointOnScreen(page,end);
    await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:6});await page.mouse.up();
    await page.waitForFunction(key=>!!window.__editorQA.draft().offsets[key],key);
    const dragged=await snapshot(page),offset=dragged.draft.offsets[key];near(offset.dx,20,'Pointer drag cm X',2);near(offset.dy,10,'Pointer drag cm Y',2);
    verifyMovement(before,dragged,offset.dx,offset.dy,'Real drag');
    await confirmAction(page,'reset');await waitOffset(page,0,0);verifyMovement(before,await snapshot(page),0,0,'Reset');
    await page.locator('.de-object-select').selectOption('furniture|family_sideboard');
    check(await page.locator('.de-move-form [name=dx]').isDisabled(),'Fixed cabinet offset disabled');check(await page.locator('.de-move-form button').isDisabled(),'Fixed cabinet submission locked');
    const dishwasher=await page.locator('.de-object-select option').evaluateAll(options=>options.find(o=>o.value.startsWith('furniture|equipment:')&&o.textContent.includes('洗碗'))?.value);
    check(dishwasher,'Read-only dishwasher selectable');await page.locator('.de-object-select').selectOption(dishwasher);
    check((await page.locator('.de-selection-info').textContent()).includes('805'),'Read-only dishwasher correct height');check(await page.locator('.de-move-form button').isDisabled(),'Equipment cannot be moved');
    const baseMaterials=await materialSnapshot(page);check(baseMaterials.some(m=>m.category==='floor'),'Actual floor materials identified');
    await page.locator('.de-colors input[data-color=floor]').fill('#86aab3');
    // A native color-input fill emits input/change; no business methods invoked.
    await page.waitForFunction(()=>window.__editorQA.draft().colors.floor==='#86aab3');
    const painted=await materialSnapshot(page);const linear=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4,expected=[134,170,179].map(n=>linear(n/255));
    check(painted.some(m=>m.category==='floor'&&m.color?.some((c,i)=>Math.abs(c-m.baselineColor[i])>.01)),'Actual 3D floor changed');
    for(const m of painted){if(m.category==='floor')m.color.forEach((c,i)=>near(c,expected[i],'3D floor linear color',.003));else if(m.protected){equal(m.color,m.baselineColor,'Protected glass/appliance color unchanged');equal(m.textureUuid,m.baselineTextureUuid,'Protected texture unchanged')}}
    equal(await page.locator('[data-plan-room]').first().getAttribute('fill'),'#86aab3','Actual 2D floor recolored');
    await page.locator('.de-panel [data-action=palette-reset]').click();equal((await snapshot(page)).draft.colors,{},'Palette reset clears only personal colors');
    const restoredMaterials=await materialSnapshot(page);equal(restoredMaterials.map(m=>[m.name,m.color,m.textureUuid]),baseMaterials.map(m=>[m.name,m.color,m.textureUuid]),'All actual 3D baseline colors and textures restored');
    await numericMove(page,100,50);await page.locator('.de-panel [data-action=save]').click();
    check((await page.locator('.de-status').textContent()).includes('当前浏览器'),'Explicit browser-local save acknowledged');
    const saved=await page.evaluate(()=>localStorage.getItem('house-design:editor-draft:v1:family'));equal(JSON.parse(saved).offsets[key],{dx:10,dy:5},'Explicit saved offset and scheme key');
    await page.reload({waitUntil:'domcontentloaded',timeout:180000});await page.waitForFunction(()=>window.__editorQA?.ready(),{},{timeout:180000});await waitOffset(page,10,5);
    await openEditor(page);await page.locator('.de-object-select').selectOption(`furniture|${key}`);verifyMovement(before,await snapshot(page),10,5,'Reload restores formal-source-relative local draft');
    check((await page.locator('.de-status').textContent()).includes('恢复'),'Reload reports saved draft restoration');
    await page.screenshot({path:path.join(out,'family-1440-restored-plan.png')});
    // Keep this family draft during other-scheme smoke to prove isolation.
    results.push({scheme:'family',width:1440,features:['point-selection','model-mm-measurement','zoom','numeric-move','real-drag','per-part-3D-sync','undo','reset','fixed-lock','readonly-equipment','palette-and-reset','explicit-save','reload']});
    await finishPage(page,errors,'family',1440);
  }catch(error){await page.screenshot({path:path.join(out,'family-1440-failure.png')}).catch(()=>{});await page.close();throw error}
}
async function schemeSmoke(context,id){
  const {page,errors}=await loadPage(context,id,1440);
  try{
    await openEditor(page);const before=await snapshot(page);equal(before.draft.offsets,{},id+' does not inherit saved family moves');equal(before.draft.colors,{},id+' independent palette');
    const familySaved=await page.evaluate(()=>localStorage.getItem('house-design:editor-draft:v1:family'));check(familySaved,id+' isolation checked with real saved family draft still present');
    await numericMove(page,10,10);verifyMovement(before,await snapshot(page),1,1,id+' lightweight movement');
    await confirmAction(page,'reset');await waitOffset(page,0,0);verifyMovement(before,await snapshot(page),0,0,id+' lightweight reset');
    equal(await page.evaluate(()=>localStorage.getItem('house-design:editor-draft:v1:family')),familySaved,id+' reset preserves other scheme saved draft');
    results.push({scheme:id,width:1440,features:['real-GLB','scheme-isolation','move','reset']});await finishPage(page,errors,id,1440);
  }catch(error){await page.screenshot({path:path.join(out,`${id}-1440-failure.png`)}).catch(()=>{});await page.close();throw error}
}
async function mobile(browser){
  // Separate local store, matching a fresh mobile browser, not an account sync.
  const context=await browser.newContext({viewport:{width:390,height:1000},hasTouch:true,isMobile:true});
  const {page,errors}=await loadPage(context,'family',390);
  try{
    await openEditor(page);await page.locator('.de-object-select').selectOption(`furniture|${key}`);await checkDimensions(page);
    // Zoom into central plan with visible toolbar, improving touch target and
    // pointer sub-pixel precision while retaining the same centimetre system.
    for(let i=0;i<3;i++)await page.locator('.de-panel [data-action=zoom-in]').click();
    await measure(page);check(await page.locator('[data-editor-overlay]').count()===1,'Mobile measurement overlay visible');
    await page.locator('.de-measures li').last().scrollIntoViewIfNeeded();
    equal((await snapshot(page)).draft.offsets,{},'Mobile measurements never move furniture');
    results.push({scheme:'family',width:390,features:['visible-tools','selection','dimensions','measure','no-overflow']});await finishPage(page,errors,'family',390);
  }catch(error){await page.screenshot({path:path.join(out,'family-390-failure.png')}).catch(()=>{});await page.close();throw error}finally{await context.close()}
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});const assetsBefore=assetSnapshot();
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
  try{
    if(!mobileOnly){const context=await browser.newContext();try{await fullFamily(context);if(!familyOnly){await schemeSmoke(context,'wood');await schemeSmoke(context,'laundry')}}finally{await context.close()}}
    if(mobileOnly||!familyOnly)await mobile(browser);
  }finally{await browser.close();equal(assetSnapshot(),assetsBefore,'Published source, GLBs, manifests and render-image bytes unchanged')}
  const report={passed:true,checks,results,officialAssetFiles:Object.keys(assetsBefore).length,actions:'visible UI; diagnostics read-only; actual native GLB',sourceVersion:'3.12.0',uiVersion:'3.13.0'};
  fs.writeFileSync(path.join(out,`report${mobileOnly?'-mobile':familyOnly?'-family':''}.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
