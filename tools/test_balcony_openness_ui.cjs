// Narrow, read-only V3.12 UI smoke. Run after native rendering releases CPU.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createHash}=require('node:crypto'),sha=b=>createHash('sha256').update(b).digest('hex');
let chromium;try{({chromium}=require('playwright'))}catch{({chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')))}
const root=path.resolve(__dirname,'..'),base=process.argv.find(a=>a.startsWith('--base='))?.slice(7)||'http://127.0.0.1:4187/';
const source=fs.readFileSync(path.join(root,'studio.js'),'utf8'),out=path.join(root,'tmp','balcony-openness-ui');
const hooks='\nwindow.__balconyQA={ready:()=>state.ready,source:()=>data,walking:()=>state.walking,roomAt:()=>walkWorld.roomAt(camera.position.x,camera.position.z),canStand:()=>walkWorld.canStand(camera.position.x,camera.position.z)};';
const allJobs=[{id:'wood',width:1440},{id:'family',width:1440},{id:'laundry',width:1440},{id:'family',width:390}];
const jobs=process.argv.includes('--mobile-only')?allJobs.filter(job=>job.width===390):allJobs;
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 const context=await browser.newContext();
 try{for(const {id,width}of jobs){
  const page=await context.newPage(),errors=[];await page.setViewportSize({width,height:1000});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/studio.js*',r=>r.fulfill({contentType:'text/javascript; charset=utf-8',body:source+hooks}));
  let nativeHash;await page.route(`**/models/schemes/${id}/huiyayuan-wood.glb*`,async route=>{const response=await route.fetch({timeout:180000});nativeHash=sha(await response.body());await route.fulfill({response});});
  await page.goto(new URL(`studio.html?scheme=${id}&v=3.12.0#balcony`,base).href,{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForFunction(()=>window.__balconyQA?.ready(),{},{timeout:180000});
  assert.equal(await page.evaluate(()=>window.__balconyQA.source().version),'3.12.0');
  assert.equal(await page.evaluate(()=>window.__balconyQA.source().balconyOpennessRevision.dimensionsVerified),false);
  assert.equal(nativeHash,sha(fs.readFileSync(path.join(root,`models/schemes/${id}/huiyayuan-wood.glb`))),'Viewer loaded exact final native GLB');
  await page.locator('#tab-plan').click();
  assert.equal(await page.locator('[data-balcony-open-side]').count(),2);assert.equal(await page.locator('[data-low-parapet-projection]').count(),2);
  for(const side of ['north','east'])assert.equal(await page.locator(`[data-balcony-open-side="${side}"]`).getAttribute('data-glazing'),'false');
  assert.equal(await page.locator('[data-opening-id="window_kitchen_balcony"]').count(),1,'Kitchen internal window retained');
  await page.locator('#toggle-room-card').evaluate(b=>{if(b.getAttribute('aria-expanded')==='false')b.click()});
  const description=await page.locator('#card-description').textContent();assert.match(description,/北、东|北.*东/);assert.match(description,/暂估|待.*尺/);assert.match(description,/防护/);
  if(width<=860){
    // Mobile intentionally hides generic .secondary-link room-card actions.
    // Follow the visible "说明" header entry and the scrollable project
    // dialog's real laundry button; never force-click a display:none element.
    assert.equal(await page.locator('#view-laundry-fitout').isVisible(),false,'Mobile card secondary action is intentionally hidden');
    await page.locator('#open-project').click();
    assert.equal(await page.locator('#project-dialog').isVisible(),true,'Visible mobile project dialog');
    await page.locator('#project-laundry').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('#project-laundry').isVisible(),true,'Mobile laundry action is actually available');
    await page.locator('#project-laundry').click();
    assert.equal(await page.locator('#project-dialog').isVisible(),false,'Project dialog closes before laundry opens');
  }else await page.locator('#view-laundry-fitout').click();
  assert.equal(await page.locator('#laundry-dialog').isVisible(),true,'Laundry notes open through visible UI');
  const note=await page.locator('[data-balcony-openness-notes]').textContent();
  assert.match(note,/1100/);assert.match(note,/1350/);assert.match(note,/不是新拆墙|不是拆/);assert.match(note,/示意/);await page.locator('#laundry-dialog .dialog-close').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal page overflow');
  if(id==='family'&&width===1440)await page.locator('#floor-plan').screenshot({path:path.join(out,'family-1440-plan.png')});
  await page.locator('#tab-model').click();
  if(width===1440){await page.locator('#start-walk').click();await page.waitForFunction(()=>window.__balconyQA.walking());assert.equal(await page.evaluate(()=>window.__balconyQA.canStand()),true,'Safe single balcony entry');assert.equal(await page.evaluate(()=>window.__balconyQA.roomAt()),'balcony');}
  await page.locator('#toggle-room-card').evaluate(b=>{if(b.getAttribute('aria-expanded')==='true')b.click()});
  await page.screenshot({path:path.join(out,`${id}-${width}-balcony.png`)});
  assert.deepEqual(errors,[],'No uncaught browser errors');console.log(`PASS ${id} ${width}: exact native SHA, two open-air sides, retained kitchen window, honest estimate/safety notes, no overflow${width===1440?', safe balcony entry':''}`);
  await page.close();
 }}finally{await context.close();await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
