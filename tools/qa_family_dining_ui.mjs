// Isolated localhost-only browser, with diagnostic hooks injected in this test
// response rather than exposed to the published website or any user browser.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true,channel:'chrome'}),results=[],errors=[];
await mkdir('tmp',{recursive:true});
const source=await readFile('studio.js','utf8');
const hooks=`\nglobalThis.__diningTest={get state(){return state},get model(){return model},get world(){return walkWorld},activeDiningData};`;
try{
 for(const [name,width,height]of [['desktop',1440,1000],['mobile',390,844],['narrow',320,640]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
  const page=await context.newPage();page.setDefaultTimeout(60000);
  page.on('pageerror',error=>errors.push(name+': '+error.message));
  await page.route('**/studio.js?*',route=>route.fulfill({status:200,contentType:'text/javascript',body:source+hooks}));
  await page.goto('http://127.0.0.1:4173/studio.html?scheme=family&v=3.5.3#dining');
  await page.waitForFunction(()=>globalThis.__diningTest?.state.ready);
  const inspect=()=>page.evaluate(()=>{
   const q=globalThis.__diningTest,states={expanded:{visible:0,total:0},closed:{visible:0,total:0}},names=new Set();
   q.model.traverse(o=>{if(!o.isMesh)return;const p=o.userData.diningVisibility;if(p){states[p].total++;if(o.visible){states[p].visible++;if(o.userData.diningElement==='chair')names.add(o.userData.furnitureName)}}});
   return {states,chairs:[...names].sort(),closed:q.state.diningClosed,obstacles:q.world.obstacles.filter(o=>/餐桌|餐椅/.test(o.id)),furniture:q.activeDiningData().furniture.filter(f=>f.diningFitoutId).map(f=>({name:f.name,x:f.x,y:f.y,w:f.w,d:f.d}))};
  });
  const button=page.locator('#toggle-dining-state');await button.click({trial:true});
  const overlapping=await page.evaluate(()=>{
   const a=document.querySelector('#toggle-dining-state').getBoundingClientRect(),b=document.querySelector('#toggle-room-card').getBoundingClientRect();
   return Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top);
  });assert.equal(overlapping,false,'State toggle remains separate from card control '+name);
  const opened=await inspect();assert.ok(opened.states.expanded.total>20&&opened.states.closed.total>20,'Both actual GLB states survive batching');assert.equal(opened.states.expanded.visible,opened.states.expanded.total);assert.equal(opened.states.closed.visible,0);assert.equal(opened.chairs.length,4);assert.equal(opened.obstacles.length,5);
  await button.click();const closed=await inspect();assert.equal(closed.closed,true);assert.equal(closed.states.expanded.visible,0);assert.equal(closed.states.closed.visible,closed.states.closed.total);assert.equal(closed.chairs.length,4);assert.equal(closed.obstacles.length,4);assert.equal(closed.furniture.length,4);
  await page.locator('[data-view="plan"]').click();assert.equal(await page.locator('[data-dining-state="closed"]').count(),1);assert.equal(await page.locator('[data-dining-furniture]').count(),4);assert.equal(await page.locator('[data-dining-fold-seam]').count(),0);
  await page.screenshot({path:`tmp/v353-${name}-dining-closed-plan.png`,fullPage:true});
  await page.locator('[data-view="renders"]').click();await page.waitForFunction(()=>{const i=document.querySelector('#active-render');return i.complete&&i.naturalWidth>0});assert.ok((await page.locator('#active-render').getAttribute('src')).includes('/dining-closed.jpg'));
  await page.locator('[data-view="model"]').click();await page.locator('#start-walk').click();await page.waitForFunction(()=>globalThis.__diningTest.state.walking);assert.equal((await inspect()).states.expanded.visible,0,'Walking does not revive hidden expanded state');await page.locator('#exit-walk').click();
  await button.click();const reopened=await inspect();assert.equal(reopened.closed,false);assert.equal(reopened.obstacles.length,5);assert.equal(reopened.states.closed.visible,0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No narrow overflow');
  results.push({name,width,expandedMeshes:opened.states.expanded.total,closedMeshes:closed.states.closed.total,visibleChairs:closed.chairs,states:'Both plan/model/walk/collisions/closed render verified'});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile('tmp/v353-dining-ui-qa.json',JSON.stringify({results,errors},null,2)+'\n');console.log(JSON.stringify({results,errors},null,2));
}finally{await browser.close()}
