// Read-only local/deployed browser QA: actual GLB, plan, copy and walking.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let chromium;try{({chromium}=require('playwright'))}catch{({chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')))}
const root=path.resolve(__dirname,'..'),base=process.argv.find(a=>a.startsWith('--base='))?.slice(7)||'http://127.0.0.1:4187/';
const source=fs.readFileSync(path.join(root,'studio.js'),'utf8');
const out=path.join(root,'tmp','family-r3-ui');fs.mkdirSync(out,{recursive:true});
const hooks='\nwindow.__familyQA={ready:()=>state.ready,source:()=>data,walking:()=>state.walking,walkPosition:()=>({x:camera.position.x,z:camera.position.z}),roomAt:()=>walkWorld.roomAt(camera.position.x,camera.position.z),canStand:()=>walkWorld.canStand(camera.position.x,camera.position.z),meshCount:()=>{let meshes=0,vertices=0;model?.traverse(o=>{if(o.isMesh){meshes++;vertices+=o.geometry.attributes.position.count}});return {meshes,vertices}}};';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 try{for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1050}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/studio.js*',r=>r.fulfill({contentType:'text/javascript; charset=utf-8',body:source+hooks}));
  await page.goto(new URL('studio.html?scheme=family&v=3.10.0#overall',base).href,{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForFunction(()=>window.__familyQA?.ready(),{},{timeout:180000});
  const stats=await page.evaluate(()=>window.__familyQA.meshCount());
  assert(stats.meshes>0&&stats.vertices>100000,'Actual native GLB loaded');
  assert.equal(await page.evaluate(()=>window.__familyQA.source().familyR3Revision.version),'3.10.0');
  await page.locator('#toggle-room-card').click();
  await page.locator('#tab-plan').click();
  for(const id of ['door_a','door_b','door_c'])assert.equal(await page.locator(`[data-hinged-door="${id}"]`).getAttribute('data-door-width-mm'),'900');
  assert.equal(await page.locator('[data-surface-slider="door_c"]').count(),0);
  assert.equal(await page.locator('[data-opening-id="door_a"]').getAttribute('y1'),'355');
  assert.equal(await page.locator('[data-opening-id="door_a"]').getAttribute('y2'),'445');
  assert.equal(await page.locator('[data-wall-fitout="study_bookwall"] rect').getAttribute('width'),'222');
  assert.match(await page.locator('#measurement-pending').textContent(),/复尺时旧模型记录（非当前R3）/);
  assert.match(await page.locator('#measurement-summary').textContent(),/R3确认设计墙线/);
  assert.equal(await page.locator('[data-r3-window-chain]').count(),2);
  await page.locator('#floor-plan').screenshot({path:path.join(out,`family-r3-${width}-plan.png`)});
  for(const [room,pattern] of [['room_a',/550mm/],['room_b',/715mm/],['room_c',/900mm普通平开门/],['bath_1',/1530mm/]]){
   await page.locator(`#room-nav [data-room="${room}"]`).click();
   assert.match(await page.locator('#card-description').textContent(),pattern,room+' current layout copy');
   await page.locator('#tab-model').click();
   await page.locator('#start-walk').click();
   await page.waitForFunction(()=>window.__familyQA.walking());
   assert.equal(await page.evaluate(()=>window.__familyQA.canStand()),true,room+' safe spawn');
   assert.equal(await page.evaluate(()=>window.__familyQA.roomAt()),room,room+' spawn belongs to room');
   await page.locator('#exit-walk').click();
  }
  await page.locator('#room-nav [data-room="overall"]').click();
  await page.screenshot({path:path.join(out,`family-r3-${width}-3d.png`)});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow');
  assert.deepEqual(errors,[],'No uncaught errors');
  console.log(`PASS family R3 ${width}: ${stats.vertices} vertices, 900 doors, study ordinary door, correct copy, private walking, no overflow`);
  await page.close();
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
