// V3.13.1 measurement editing acceptance. Run centrally after rendering stops.
// Actual UI/touch/pointer interaction only; source hook exposes read-only state.
// Usage: node tools/test_measure_editor_ui.cjs [--desktop-only|--mobile-only]
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createHash}=require('node:crypto');
let chromium;try{({chromium}=require('playwright'))}catch{({chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')))}
const root=path.resolve(__dirname,'..'),out=path.join(root,'tmp','measure-editor-ui');
const base=process.argv.find(a=>a.startsWith('--base='))?.slice(7)||'http://127.0.0.1:4187/';
const mobileOnly=process.argv.includes('--mobile-only'),desktopOnly=process.argv.includes('--desktop-only');
const sha=b=>createHash('sha256').update(b).digest('hex'),source=fs.readFileSync(path.join(root,'studio.js'),'utf8');
const hook='\nwindow.__measureQA={ready:()=>state.ready&&!!editorScene,source:()=>data,draft:()=>editorDraft,baseline:()=>editorBaseline,scene:()=>editorScene.getFurnitureStates()};';
let checks=0;const reports=[];
function check(value,message){assert.ok(value,message);checks++}
function equal(a,b,message){assert.deepEqual(a,b,message);checks++}
function near(a,b,message,tolerance=.02){check(Number.isFinite(a)&&Math.abs(a-b)<=tolerance,`${message}: ${a} vs ${b}`)}
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)])}
function officialHashes(){return Object.fromEntries(['wood','family','laundry'].flatMap(id=>[
  ...['design-data.json','scene-manifest.json','huiyayuan-wood.glb'].map(n=>path.join(root,'models','schemes',id,n)),
  ...files(path.join(root,'assets','schemes',id)).filter(n=>/\.(jpe?g|png|webp)$/i.test(n))
]).map(p=>[path.relative(root,p),sha(fs.readFileSync(p))]))}
async function protectedState(page){return page.evaluate(()=>({source:window.__measureQA.source(),baseline:window.__measureQA.baseline(),draft:window.__measureQA.draft(),scene:window.__measureQA.scene()}))}
async function lines(page){return page.locator('line[data-measure-line]').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.measureLine,a:{x:Number(n.getAttribute('x1')),y:Number(n.getAttribute('y1'))},b:{x:Number(n.getAttribute('x2')),y:Number(n.getAttribute('y2'))}})))}
async function line(page,id){const result=(await lines(page)).find(l=>l.id===String(id));check(result,`SVG measurement ${id} exists`);return result}
const distance=l=>Math.hypot(l.b.x-l.a.x,l.b.y-l.a.y)*10;
function closePoint(a,b,label,tolerance=.02){near(a.x,b.x,label+' x',tolerance);near(a.y,b.y,label+' y',tolerance)}
async function count(page,n){await page.waitForFunction(n=>document.querySelectorAll('line[data-measure-line]').length===n,n);equal(await page.locator('.de-measures [data-measure-select]').count(),n,'List and visible line count agree')}
async function screen(page,p){const result=await page.locator('#floor-plan svg').evaluate((svg,p)=>{const point=new DOMPoint(p.x,p.y).matrixTransform(svg.getScreenCTM()),hit=document.elementFromPoint(point.x,point.y);return{x:point.x,y:point.y,exposed:!!hit&&(hit===svg||svg.contains(hit)),inViewport:point.x>=0&&point.y>=0&&point.x<innerWidth&&point.y<innerHeight}},p);check(result.exposed&&result.inViewport,`Model point ${p.x},${p.y} exposed on screen at ${result.x},${result.y}`);return result}
async function tap(page,p,mobile){const q=await screen(page,p);if(mobile)await page.touchscreen.tap(q.x,q.y);else await page.mouse.click(q.x,q.y)}
async function drag(page,a,b,{mobile=false,cancel=false,cdp}={}){
  const from=await screen(page,a),to=await screen(page,b);
  if(mobile){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x,y:from.y,id:1}]});
    for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/6,y:from.y+(to.y-from.y)*i/6,id:1}]});
    if(cancel)await page.keyboard.press('Escape');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{
    await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:6});
    if(cancel)await page.keyboard.press('Escape');await page.mouse.up();
  }
}
async function addLine(page,a,b,mobile){const before=new Set((await lines(page)).map(l=>l.id));await page.locator('.de-panel [data-action=measure-new]').click();await tap(page,a,mobile);await tap(page,b,mobile);const added=(await lines(page)).find(l=>!before.has(l.id));check(added,'Two actual plan taps create a new measurement');return added}
async function selectLine(page,id){await page.locator(`.de-measures [data-measure-select="${id}"]`).click();check(await page.locator('.de-measure-form').isVisible(),'Selected measurement exposes edit form');equal(await page.locator(`[data-measure-id="${id}"][data-measure-handle]`).count(),2,'Both selected endpoints are available')}
async function undoMeasurement(page){await page.locator('.de-panel [data-action=measure-undo]').click()}
async function editCoordinates(page,id,a,b){
  await selectLine(page,id);const details=page.locator('details.de-measure-coordinates');
  if(await details.getAttribute('open')===null)await details.locator('summary').click();
  for(const [name,value]of Object.entries({ax:a.x*10,ay:a.y*10,bx:b.x*10,by:b.y*10}))await page.locator(`.de-measure-form [name=${name}]`).fill(String(value));
  await page.locator('.de-measure-form [name=by]').press('Enter');
  const entered=await line(page,id);closePoint(entered.a,a,'Coordinate Enter applies start');closePoint(entered.b,b,'Coordinate Enter applies end rather than stale length');
  await page.locator('.de-measure-form [data-action=measure-coordinates-apply]').click();
  const actual=await line(page,id);closePoint(actual.a,a,'Coordinate edit start');closePoint(actual.b,b,'Coordinate edit end');
  // Collapse by visible control so the tools remain compact on a phone.
  if(await details.getAttribute('open')!==null)await details.locator('summary').click();return actual;
}
async function run(browser,width){
  const mobile=width===390,context=await browser.newContext({viewport:{width,height:1000},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage(),errors=[],cdp=mobile?await context.newCDPSession(page):null;
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(60000);
  await page.route('**/studio.js*',route=>route.fulfill({contentType:'text/javascript; charset=utf-8',body:source+hook}));
  let nativeHash;await page.route('**/models/schemes/family/huiyayuan-wood.glb*',async route=>{const response=await route.fetch({timeout:180000});nativeHash=sha(await response.body());await route.fulfill({response})});
  try{
    await page.goto(new URL('studio.html?scheme=family&v=3.13.1#living',base).href,{waitUntil:'domcontentloaded',timeout:180000});
    await page.waitForFunction(()=>window.__measureQA?.ready(),{},{timeout:180000});
    equal(nativeHash,sha(fs.readFileSync(path.join(root,'models/schemes/family/huiyayuan-wood.glb'))),'Actual unchanged native model loaded');
    await page.locator('#tab-plan').click();await page.locator('.de-toggle').click();await page.locator('.de-modes [data-mode=select]').click();
    // One real furniture move creates an independent draft/undo entry. Every
    // subsequent measurement action must preserve it and all 3D part positions.
    await page.locator('.de-object-select').selectOption('furniture|name:三人沙发');
    await page.locator('.de-move-form [name=dx]').fill('10');await page.locator('.de-move-form [name=dy]').fill('0');await page.locator('.de-move-form button').click();
    await page.waitForFunction(()=>window.__measureQA.draft().offsets['name:三人沙发']?.dx===1);
    const protectedBefore=await protectedState(page);
    await page.locator('.de-modes [data-mode=measure]').click();
    // Native touch has integer screen coordinates. Magnify via the real control
    // so endpoints are reachable and 20mm projection accuracy can be observed.
    for(let i=0;i<(mobile?3:1);i++)await page.locator('.de-panel [data-action=zoom-in]').click();
    const first=await addLine(page,{x:430,y:650},{x:490,y:730},mobile);await count(page,1);
    near(distance(first),1000,'Initial screen-to-model measured distance',20);
    const second=await addLine(page,{x:440,y:810},{x:500,y:810},mobile);await count(page,2);
    await selectLine(page,first.id);const beforeLength=await line(page,first.id);
    await page.locator('.de-measure-form [name=length]').fill('1500');await page.locator('.de-measure-form button[type=submit]').click();
    const lengthEdited=await line(page,first.id);closePoint(lengthEdited.a,beforeLength.a,'Length edit fixes start');near(distance(lengthEdited),1500,'Length edit millimetres',.1);
    const scale=1500/distance(beforeLength);closePoint(lengthEdited.b,{x:beforeLength.a.x+(beforeLength.b.x-beforeLength.a.x)*scale,y:beforeLength.a.y+(beforeLength.b.y-beforeLength.a.y)*scale},'Length edit retains direction',.02);
    equal(await line(page,second.id),second,'Editing first line preserves other measurement');
    // Zero/negative/empty total cannot create a zero-length or invalid line.
    for(const invalid of ['0','-5','']){
      await page.locator('.de-measure-form [name=length]').fill(invalid);await page.locator('.de-measure-form button[type=submit]').click();equal(await line(page,first.id),lengthEdited,'Invalid length rejected: '+JSON.stringify(invalid));
    }
    await page.locator('.de-measure-form [name=length]').fill('1500');
    await page.locator('.de-measure-form [name=length]').focus();await page.keyboard.press('Delete');await count(page,2);
    equal(await line(page,first.id),lengthEdited,'Delete in a form field never deletes a measurement');
    await page.locator('.de-measure-form [name=length]').fill('1500');
    const exact=await editCoordinates(page,first.id,{x:430,y:650},{x:520,y:770});
    // Endpoint B is dragged with real mouse/touch input, independently of A.
    await drag(page,exact.b,{x:exact.b.x+12,y:exact.b.y+8},{mobile,cdp});
    const endpointMoved=await line(page,first.id);closePoint(endpointMoved.a,exact.a,'Endpoint drag keeps other endpoint');
    closePoint(endpointMoved.b,{x:exact.b.x+12,y:exact.b.y+8},'Endpoint drag updates destination',2);
    check(distance(endpointMoved)!==distance(exact),'Endpoint drag changes length');
    await undoMeasurement(page);const endpointRestored=await line(page,first.id);closePoint(endpointRestored.a,exact.a,'Endpoint undo restores start');closePoint(endpointRestored.b,exact.b,'Endpoint undo restores end');
    // The visible line midpoint is an independent whole-line drag target.
    const midpoint={x:(exact.a.x+exact.b.x)/2,y:(exact.a.y+exact.b.y)/2};
    await drag(page,midpoint,{x:midpoint.x+8,y:midpoint.y-8},{mobile,cdp});
    const translated=await line(page,first.id);closePoint(translated.a,{x:exact.a.x+8,y:exact.a.y-8},'Whole-line translation start',2);closePoint(translated.b,{x:exact.b.x+8,y:exact.b.y-8},'Whole-line translation end',2);near(distance(translated),distance(exact),'Whole-line drag preserves distance',.1);
    await undoMeasurement(page);const moveRestored=await line(page,first.id);closePoint(moveRestored.a,exact.a,'Whole-line undo start');closePoint(moveRestored.b,exact.b,'Whole-line undo end');
    await drag(page,moveRestored.b,{x:moveRestored.b.x+15,y:moveRestored.b.y-12},{mobile,cdp,cancel:true});
    const canceled=await line(page,first.id);closePoint(canceled.a,moveRestored.a,'Escape drag cancellation start');closePoint(canceled.b,moveRestored.b,'Escape drag cancellation end');
    // A zoom does not alter the actual coordinates of existing measurement lines.
    const beforeZoom=await lines(page);await page.locator('.de-panel [data-action=zoom-out]').click();equal(await lines(page),beforeZoom,'Zoom leaves every model coordinate unchanged');await page.locator('.de-panel [data-action=zoom-in]').click();
    await selectLine(page,first.id);await page.screenshot({path:path.join(out,`family-${width}-measure-edit.png`)});
    await page.locator('.de-measures').screenshot({path:path.join(out,`family-${width}-measure-list.png`)});
    // Scoped list delete, selected toolbar delete, keyboard Delete, and clear all
    // each have an independent measurement-undo route and never touch furniture.
    await page.locator(`.de-measures [data-measure-delete="${second.id}"]`).click();await count(page,1);check((await lines(page))[0].id===first.id,'List delete affects only chosen measurement');
    await undoMeasurement(page);await count(page,2);
    await selectLine(page,first.id);await page.locator('.de-panel [data-action=measure-delete]').click();await count(page,1);check((await lines(page))[0].id===second.id,'Selected toolbar delete affects selected line');
    await undoMeasurement(page);await count(page,2);
    await tap(page,midpoint,mobile);await page.keyboard.press('Delete');await count(page,1);check((await lines(page))[0].id===second.id,'Keyboard delete acts on clicked line');
    await undoMeasurement(page);await count(page,2);
    await page.locator('.de-panel [data-action=measure-clear]').click();await count(page,0);await undoMeasurement(page);await count(page,2);
    equal(await protectedState(page),protectedBefore,'Measurements never mutate draft furniture/colors, source, baseline or actual scene');
    check(await page.locator('.de-panel [data-action=undo]').isEnabled(),'Independent furniture undo entry retained');
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+' no horizontal overflow');
    equal(errors,[],'No uncaught page errors');await page.screenshot({path:path.join(out,`family-${width}-measure-restored.png`)});
    const report={width,input:mobile?'real-touch-and-keyboard':'real-mouse-and-keyboard',features:['create','select-list-and-line','length-edit','coordinates-edit','invalid-rejection','endpoint-drag','line-drag','escape-cancel','zoom-invariance','delete-input-guard','list-toolbar-keyboard-delete','clear','independent-undo','formal-data-protection']};reports.push(report);console.log('PASS measurement editor '+width);
  }catch(error){await page.screenshot({path:path.join(out,`family-${width}-failure.png`)}).catch(()=>{});throw error}finally{await context.close()}
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});const before=officialHashes(),browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
  try{if(!mobileOnly)await run(browser,1440);if(!desktopOnly)await run(browser,390)}finally{await browser.close();equal(officialHashes(),before,'All official source, GLB, provenance and image bytes unchanged')}
  const report={passed:true,checks,officialAssetFiles:Object.keys(before).length,reports};fs.writeFileSync(path.join(out,`report${mobileOnly?'-mobile':desktopOnly?'-desktop':''}.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
