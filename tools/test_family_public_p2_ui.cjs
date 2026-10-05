// Read-only P2 desktop/mobile UI regression against actual native assets.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createHash}=require('node:crypto'),sha=b=>createHash('sha256').update(b).digest('hex');
let chromium;try{({chromium}=require('playwright'))}catch{({chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')))}
const root=path.resolve(__dirname,'..'),base=process.argv.find(a=>a.startsWith('--base='))?.slice(7)||'http://127.0.0.1:4187/';
const source=fs.readFileSync(path.join(root,'studio.js'),'utf8'),out=path.join(root,'tmp','family-public-p2-ui');fs.mkdirSync(out,{recursive:true});
const requestedWidth=Number(process.argv.find(a=>a.startsWith('--width='))?.slice(8)),widths=requestedWidth?[requestedWidth]:[1440,390];
const hooks='\nwindow.__p2QA={ready:()=>state.ready,source:()=>data,walking:()=>state.walking,roomAt:()=>walkWorld.roomAt(camera.position.x,camera.position.z),canStand:()=>walkWorld.canStand(camera.position.x,camera.position.z),meshes:()=>{const a=[];model?.traverse(o=>{if(o.isMesh)a.push({name:o.name,meta:o.userData,vertices:o.geometry.attributes.position.count})});return a}};';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 try{for(const width of widths){
  const page=await browser.newPage({viewport:{width,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/studio.js*',r=>r.fulfill({contentType:'text/javascript; charset=utf-8',body:source+hooks}));
  let nativeHash;
  await page.route('**/models/schemes/family/huiyayuan-wood.glb*',async route=>{const response=await route.fetch({timeout:180000});nativeHash=sha(await response.body());await route.fulfill({response});});
  await page.goto(new URL('studio.html?scheme=family&v=3.11.0#living',base).href,{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForFunction(()=>window.__p2QA?.ready(),{},{timeout:180000});
  assert.equal(await page.evaluate(()=>window.__p2QA.source().familyPublicP2Revision.version),'3.11.0');
  const meshes=await page.evaluate(()=>window.__p2QA.meshes());assert.ok(meshes.reduce((s,m)=>s+m.vertices,0)>100000,'Real native GLB loaded');
  // Static batching intentionally discards per-object metadata. Verify the
  // actual fetched GLB bytes, whose individual world meshes are audited by
  // test_family_public_p2 --glb, rather than inspect post-batch identifiers.
  assert.equal(nativeHash,sha(fs.readFileSync(path.join(root,'models/schemes/family/huiyayuan-wood.glb'))),'Viewer fetched current exact native GLB');
  await page.locator('#tab-plan').click();
  const box=async selector=>page.locator(selector).evaluate(n=>['x','y','width','height'].map(k=>Number(n.getAttribute(k))));
  assert.deepEqual(await box('[data-living-rug]'),[395.5,674,224,178]);
  assert.equal(await page.locator('[data-family-garage]').getAttribute('data-opening-face'),'north');
  assert.equal(await page.locator('[data-garage-part^="fold-"]').count(),4);
  assert.deepEqual(await box('[data-garage-fold-zone]'),[214,1287,146,36.5]);
  assert.equal(await page.locator('[data-wall-art]').count(),2);
  assert.equal(await page.locator('[data-laundry-bookcase]').count(),0);
  assert.equal(await page.locator('[data-public-p2-laundry]').count(),1);
  assert.match(await page.locator('[data-garage-movement-warning]').textContent(),/待核/);
  assert.deepEqual(await box('[data-storage-part-id="family_sideboard_3_base"]'),[212.5,1219,44,66]);
  for(const id of ['door_a','door_b','door_c'])assert.equal(await page.locator(`[data-hinged-door="${id}"]`).getAttribute('data-door-width-mm'),'900');
  await page.locator('#floor-plan').screenshot({path:path.join(out,`p2-${width}-plan.png`)});
  console.log(`PASS P2 ${width} source, native SHA and detailed plan`);
  for(const [room,pattern]of [['living',/挂画/],['dining',/4260|北1/],['balcony',/不再|挂画|取消/],['room_a',/550mm/]]){
    await page.locator(`#room-nav [data-room="${room}"]`).click();assert.match(await page.locator('#card-description').textContent(),pattern,room+' latest description');
    await page.locator('#tab-model').click();
    await page.locator('#start-walk').click();await page.waitForFunction(()=>window.__p2QA.walking());
    assert.equal(await page.evaluate(()=>window.__p2QA.canStand()),true,room+' safe start');assert.equal(await page.evaluate(()=>window.__p2QA.roomAt()),room==='dining'?'living':room);
    await page.locator('#exit-walk').click();
  }
  for(const room of ['living','dining']){await page.locator(`#room-nav [data-room="${room}"]`).click();await page.locator('#tab-model').click();await page.locator('#toggle-room-card').evaluate(b=>{if(b.getAttribute('aria-expanded')==='true')b.click()});await page.screenshot({path:path.join(out,`p2-${width}-${room}-3d.png`)});}
  console.log(`PASS P2 ${width} safe walking and living/dining screenshots`);
  await page.locator('#toggle-room-card').evaluate(b=>{if(b.getAttribute('aria-expanded')==='false')b.click()});
  await page.locator('#view-storage-fitout').click();
  const card=page.locator('[data-storage-card="family_garage"]'),copy=await card.textContent();
  assert.equal(await card.getAttribute('data-storage-opening-face'),'north');assert.match(copy,/1500×1000/);assert.match(copy,/980/);assert.match(copy,/待.*核|待.*验证|不证明/);assert.doesNotMatch(copy,/东向开口|650mm深|650mm外深/);
  const side=await page.locator('[data-storage-card="dining_sideboard_wall"]').textContent();assert.match(side,/4260/);
  await page.locator('#storage-dialog .dialog-close').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow');
  assert.deepEqual(errors,[],'No uncaught browser errors');console.log(`PASS family P2 ${width}: ${meshes.length} meshes, four north folded leaves, centered rug, two wall artworks, current cards and safe walking`);
  await page.close();
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
