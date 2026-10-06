// Narrow V3.13.2 banner visibility acceptance. Does not wait for GLB readiness,
// intercept the model, or invoke UI actions through injected business functions.
// Run centrally: node tools/test_measurement_notice_ui.cjs
// Optional: --desktop-only, --mobile-only, --base=http://127.0.0.1:4187/
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createHash}=require('node:crypto');
let chromium;try{({chromium}=require('playwright'))}catch{({chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')))}
const root=path.resolve(__dirname,'..'),out=path.join(root,'tmp','measurement-notice-ui');
const base=process.argv.find(a=>a.startsWith('--base='))?.slice(7)||'http://127.0.0.1:4187/';
const source=fs.readFileSync(path.join(root,'studio.js'),'utf8');
const hook='\nwindow.__noticeQA={source:()=>data};';
const mobileOnly=process.argv.includes('--mobile-only'),desktopOnly=process.argv.includes('--desktop-only');
const sha=b=>createHash('sha256').update(b).digest('hex');
let checks=0;const results=[];
function check(value,message){assert.ok(value,message);checks++}
function equal(actual,expected,message){assert.deepEqual(actual,expected,message);checks++}
function sourceHashes(){return Object.fromEntries(['wood','family','laundry'].map(id=>[id,sha(fs.readFileSync(path.join(root,`models/schemes/${id}/design-data.json`)))]))}
async function store(page){return page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])))}
async function sourceData(page){return page.evaluate(()=>window.__noticeQA.source())}
async function noticeState(page){return page.evaluate(()=>{
  const workspace=document.getElementById('workspace'),notice=document.getElementById('measurement-notice');
  return{hidden:notice.hidden,display:getComputedStyle(notice).display,partial:workspace.classList.contains('measurement-partial'),roomWarning:workspace.classList.contains('measurement-room-warning'),strip:getComputedStyle(workspace).getPropertyValue('--measurement-strip-height').trim(),viewTop:getComputedStyle(document.getElementById('plan-view')).top};
})}
async function assertHidden(page,label){const s=await noticeState(page);check(s.hidden&&s.display==='none',label+' banner fully hidden');check(!s.partial&&!s.roomWarning,label+' layout classes removed');equal(parseFloat(s.strip),0,label+' CSS strip height is zero');equal(parseFloat(s.viewTop),0,label+' plan panel reclaimed top space')}
async function assertVisible(page,label){const s=await noticeState(page);check(!s.hidden&&s.display!=='none',label+' banner visible');check(s.partial,label+' measurement layout restored');check(parseFloat(s.strip)>0,label+' visible strip has positive height')}
async function noOverflow(page,label){check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' no horizontal page overflow')}
async function readyAndPlan(page){
  // This is the data/UI boundary, intentionally not state.ready or GLB load.
  await page.waitForFunction(()=>window.__noticeQA?.source()?.measurementRevision&&document.querySelector('#project-measurement-toggle')&&document.querySelector('#project-measurement-link')&&document.querySelector('#floor-plan svg'),{},{timeout:60000});
  await page.locator('#tab-plan').click();await page.locator('#floor-plan svg').waitFor({state:'visible'});
}
async function goto(page,id){await page.goto(new URL(`studio.html?scheme=${id}&v=3.13.2#living`,base).href,{waitUntil:'domcontentloaded',timeout:60000});await readyAndPlan(page)}
async function openProject(page){await page.locator('#open-project').click();check(await page.locator('#project-dialog').isVisible(),'Visible design-notes dialog opened')}
async function toggleFromProject(page){await openProject(page);await page.locator('#project-measurement-toggle').scrollIntoViewIfNeeded();check(await page.locator('#project-measurement-toggle').isVisible(),'Visibility toggle is reachable without forced clicks');await page.locator('#project-measurement-toggle').click();if(await page.locator('#project-dialog').isVisible())await page.locator('#project-dialog > .dialog-close').click()}
async function run(browser,width){
  const context=await browser.newContext({viewport:{width,height:1000},isMobile:width===390,hasTouch:width===390}),page=await context.newPage(),errors=[];
  page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/studio.js*',route=>route.fulfill({contentType:'text/javascript; charset=utf-8',body:source+hook}));
  try{
    await goto(page,'family');const before=await sourceData(page),revision=before.measurementRevision,storageBefore=await store(page);
    await assertVisible(page,'Fresh local browser');await noOverflow(page,'Visible '+width);
    const originalAudit={applied:await page.locator('#measurement-applied').innerHTML(),pending:await page.locator('#measurement-pending').innerHTML(),summary:await page.locator('#measurement-summary').textContent()};
    await page.screenshot({path:path.join(out,`family-${width}-shown.png`)});
    await page.locator('#hide-measurement-notice').click();await assertHidden(page,'Close button');await noOverflow(page,'Hidden '+width);
    await page.screenshot({path:path.join(out,`family-${width}-hidden.png`)});
    const storageHidden=await store(page),changedKeys=Object.keys(storageHidden).filter(k=>storageHidden[k]!==storageBefore[k]);
    equal(changedKeys.length,1,'Only one local visibility preference saved');const storageKey=changedKeys[0];
    check(storageKey.includes(encodeURIComponent(String(revision.date)))||storageKey.includes(String(revision.date)),'Preference key includes survey date');
    check(storageKey.includes(encodeURIComponent(String(revision.version)))||storageKey.includes(String(revision.version)),'Preference key includes survey revision version');
    check(!storageKey.includes('family')&&!storageKey.includes('wood')&&!storageKey.includes('laundry'),'Preference is revision-scoped rather than scheme-scoped');
    // Switching a room with a substantive unresolved measurement must retain
    // its warning in the room card/render/project, only the top strip is hidden.
    const bathButton=page.locator('#room-nav [data-room=bath_1]');await bathButton.scrollIntoViewIfNeeded();await bathButton.click();await assertHidden(page,'Room switch');
    const bathNotice=revision.roomDescriptions?.bath_1?.notice;
    check(typeof bathNotice==='string'&&bathNotice.length>0,'Real survey has a bathroom warning to preserve');
    for(const id of ['card-measurement-warning','render-measurement-warning']){
      equal(await page.locator('#'+id).textContent(),bathNotice,id+' complete safety text retained');equal(await page.locator('#'+id).getAttribute('hidden'),null,id+' not suppressed by banner preference');
    }
    for(const view of ['renders','plan']){await page.locator('#tab-'+view).click();await assertHidden(page,'View '+view)}
    await page.reload({waitUntil:'domcontentloaded',timeout:60000});await readyAndPlan(page);await assertHidden(page,'Reload retains preference');
    equal((await store(page))[storageKey],storageHidden[storageKey],'Reload retains explicit local setting');
    equal(await sourceData(page),before,'Toggling/reload never modifies source data');
    await openProject(page);await page.locator('#project-measurement-link').scrollIntoViewIfNeeded();await page.locator('#project-measurement-link').click();
    check(await page.locator('#measurement-dialog').isVisible(),'Full survey audit still opens while banner hidden');check(!(await page.locator('#project-dialog').isVisible()),'Notes dialog closes before audit opens');
    equal({applied:await page.locator('#measurement-applied').innerHTML(),pending:await page.locator('#measurement-pending').innerHTML(),summary:await page.locator('#measurement-summary').textContent()},originalAudit,'Full confirmed/pending evidence remains unchanged');
    await page.locator('#measurement-dialog > .dialog-close').click();await assertHidden(page,'Closing full audit leaves banner preference untouched');
    await toggleFromProject(page);await assertVisible(page,'Show via design notes');await noOverflow(page,'Restored '+width);
    check((await noticeState(page)).roomWarning,'Bathroom warning layout restored when showing strip');
    await page.screenshot({path:path.join(out,`family-${width}-restored.png`)});
    await page.reload({waitUntil:'domcontentloaded',timeout:60000});await readyAndPlan(page);await assertVisible(page,'Reload restores explicit visible preference');
    await toggleFromProject(page);await assertHidden(page,'Hide via design notes');
    // Desktop also proves all three current schemes share the same date/version
    // preference. No additional GLB-ready waits or browser contexts are needed.
    if(width===1440){
      for(const id of ['wood','laundry']){
        await goto(page,id);const data=await sourceData(page);equal([data.measurementRevision.date,data.measurementRevision.version],[revision.date,revision.version],id+' shares tested revision');
        await assertHidden(page,id+' shares hidden state');equal((await store(page))[storageKey],storageHidden[storageKey],id+' uses same saved preference');await noOverflow(page,id);
      }
      await toggleFromProject(page);await assertVisible(page,'Other scheme restores shared revision');
      await goto(page,'family');await assertVisible(page,'Family sees shared restored preference');
    }
    equal(errors,[],'No uncaught browser errors');results.push({width,sharedSchemes:width===1440?['family','wood','laundry']:['family'],storageKey,noModelReadyWait:true});console.log('PASS measurement notice '+width);
  }catch(error){await page.screenshot({path:path.join(out,`family-${width}-failure.png`)}).catch(()=>{});throw error}finally{await context.close()}
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});const before=sourceHashes(),browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
  try{if(!mobileOnly)await run(browser,1440);if(!desktopOnly)await run(browser,390)}finally{await browser.close();equal(sourceHashes(),before,'All formal design data bytes remain unchanged')}
  const report={passed:true,checks,results};fs.writeFileSync(path.join(out,`report${mobileOnly?'-mobile':desktopOnly?'-desktop':''}.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
