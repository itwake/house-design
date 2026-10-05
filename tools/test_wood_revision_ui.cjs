// Real Chrome + final GLB smoke test for scheme-one's V3.9 additions.
// Uses an already running local HTTP server; never changes source or site state.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let chromium;try{({chromium}=require('playwright'))}catch{({chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')))}
const root=path.resolve(__dirname,'..'),base=process.argv.find(a=>a.startsWith('--base='))?.slice(7)||'http://127.0.0.1:4187/';
const source=fs.readFileSync(path.join(root,'studio.js'),'utf8');
const out=path.join(root,'tmp','wood39-ui');fs.mkdirSync(out,{recursive:true});
const hooks='\nwindow.__woodQA={ready:()=>state.ready,walking:()=>state.walking,source:()=>data,meshCount:()=>{let meshes=0,vertices=0;model?.traverse(o=>{if(o.isMesh){meshes++;vertices+=o.geometry.attributes.position.count}});return {meshes,vertices}}};';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 try{for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1050}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/studio.js*',r=>r.fulfill({contentType:'text/javascript; charset=utf-8',body:source+hooks}));
  await page.goto(new URL('studio.html?scheme=wood&v=3.9.0#overall',base).href,{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForFunction(()=>window.__woodQA?.ready(),{},{timeout:180000});
  const modelStats=await page.evaluate(()=>window.__woodQA.meshCount());
  assert(modelStats.meshes>0&&modelStats.vertices>100000,'Actual optimized GLB loaded, not an image fallback: '+JSON.stringify(modelStats));
  assert.equal(await page.evaluate(()=>window.__woodQA.source().woodRevision.version),'3.9.0');
  await page.locator('#tab-plan').click();
  for(const selector of ['[data-wood-furniture="secondary_east_wardrobe"]','[data-wood-furniture="master_full_wardrobe"]','[data-wood-shower-screen="south"]','[data-wood-width-pending]'])assert.equal(await page.locator('#floor-plan '+selector).count(),1,selector);
  assert.equal(await page.locator('#floor-plan [data-laundry-machine]').count(),2);
  assert.equal(await page.locator('#floor-plan [data-vanity-id="vanity_main"]').getAttribute('data-vanity-back'),'south');
  await page.locator('#toggle-room-card').click();
  await page.locator('#floor-plan').screenshot({path:path.join(out,`wood-${width}-plan.png`)});
  await page.locator('#room-nav [data-room="room_b"]').click();
  assert.match(await page.locator('#card-description').textContent(),/300mm浅衣柜/);
  await page.locator('#room-nav [data-room="balcony"]').click();
  await page.locator('#open-project').click();
  await page.locator('#project-laundry').click();
  assert.match(await page.locator('#laundry-dialog').textContent(),/600×530×840mm/);
  assert.match(await page.locator('#laundry-dialog').textContent(),/1527.5mm/);
  await page.locator('#laundry-dialog .dialog-close').click();
  await page.locator('#room-nav [data-room="bath_1"]').click();
  await page.locator('#tab-model').click();
  await page.locator('#start-walk').click();
  await page.waitForFunction(()=>window.__woodQA.walking());
  assert.equal(await page.locator('#walk-hud').isVisible(),true);
  await page.locator('#exit-walk').click();
  assert.equal(await page.evaluate(()=>window.__woodQA.walking()),false);
  await page.locator('#room-nav [data-room="overall"]').click();
  await page.screenshot({path:path.join(out,`wood-${width}-native.png`)});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal page overflow');
  assert.deepEqual(errors,[],'No runtime errors');
  console.log(`PASS wood ${width}: actual GLB, wardrobes, south mirror/screen, laundry dimensions and excluded width, 3D walking, no overflow`);
  await page.close();
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
