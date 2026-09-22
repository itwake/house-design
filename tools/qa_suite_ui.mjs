// Isolated headless Chrome test of localhost only. Never connects to user tabs.
// NODE_PATH must include the workspace's bundled playwright package.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true,channel:'chrome'});
const base='http://127.0.0.1:4173/',results=[],errors=[];
await mkdir('tmp',{recursive:true});
try{
  for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844],['narrow',320,640]]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
    const page=await context.newPage();
    page.setDefaultTimeout(60000);
    page.on('pageerror',e=>errors.push(name+': '+e.message));
    await page.goto(base);
    assert.equal(await page.locator('[data-scheme-card]').count(),2);
    assert.equal(new URL(page.url()).pathname,'/','Chooser must not auto-redirect');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Chooser overflow');
    if(name!=='narrow')await page.screenshot({path:'tmp/v320-'+name+'-chooser.png',fullPage:true});
    for(const scheme of ['wood','suite']){
      await page.goto(base+'studio.html?scheme='+scheme+'&v=3.2.4');
      await page.waitForFunction(()=>document.querySelector('#model-loading')?.hidden&&document.querySelectorAll('#floor-plan [data-plan-room]').length===8);
      assert.equal(await page.locator('html').getAttribute('data-scheme'),scheme);
      assert.ok(await page.locator('#model-fallback').evaluate(e=>e.hidden),'3D loaded without fallback');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Viewer overflow');
      for(const selector of ['.scheme-switch-button','.knowledge-entry','#open-project','#download-toggle']){
        const box=await page.locator(selector).boundingBox();
        assert.ok(box&&box.x>=0&&box.x+box.width<=width+1&&box.height<46,name+' header fits: '+selector);
      }
      const isSuite=scheme==='suite';
      assert.equal(await page.locator('#floor-plan [data-opening-id="window_kitchen_balcony"]').count(),isSuite?1:0,'Internal kitchen window only in revised suite');
      assert.equal(await page.locator('#floor-plan [data-wall-fitout="study_bookwall"]').count(),isSuite?1:0,'Study upper bookwall only in revised suite');
      assert.equal(await page.locator('[data-study-bookwall] .bay-references a').count(),isSuite?3:0,'Live source reference links');
      assert.equal(await page.locator('[data-suite-entry="private"]').count(),isSuite?1:0);
      const geometry=(await page.locator('#floor-plan').innerHTML());
      if(isSuite){assert.ok(geometry.includes('（含入口）'));assert.equal(await page.locator('[data-hinged-door]').count(),4);assert.equal(await page.locator('[data-surface-slider="door_c"]').count(),1);assert.ok(geometry.includes('730 × 1530'));}
      if(isSuite){
        for(const id of ['study_north_sofa','study_full_desk','bed_b_niche_console'])assert.equal(await page.locator(`#floor-plan [data-furniture-id="${id}"]`).count(),1,'Approved fitted component '+id);
        assert.equal(await page.locator('#floor-plan [data-sofa-face]').getAttribute('data-sofa-face'),'south');
        assert.equal(await page.locator('.brand strong').textContent(),'木光 · 暖白套间');
      }
      const renderPrefix=isSuite?'/assets/schemes/suite/':'/assets/blender-renders/';
      assert.ok((await page.locator('#room-preview').getAttribute('src')).includes(renderPrefix));
      assert.ok((await page.locator('#download-glb').getAttribute('href')).includes(isSuite?'models/schemes/suite/':'models/huiyayuan'));
      if(await page.locator('#room-card').evaluate(e=>e.hidden))await page.locator('#toggle-room-card').click();
      assert.ok(await page.locator('#room-card').isVisible(),'Show card');
      await page.locator('#toggle-room-card').click();
      assert.ok(await page.locator('#room-card').evaluate(e=>e.hidden),'Hide card');
      await page.locator('#tab-plan').click();
      if(isSuite)await page.screenshot({path:'tmp/v320-'+name+'-suite-plan.png'});
      await page.locator('#tab-model').click();
      await page.locator('#start-walk').click();
      assert.ok(await page.locator('#workspace').evaluate(e=>e.classList.contains('walking')));
      await page.keyboard.press('ArrowUp');
      await page.locator('#exit-walk').click();
      assert.ok(await page.locator('#workspace').evaluate(e=>!e.classList.contains('walking')));
      if(isSuite&&name==='desktop')await page.screenshot({path:'tmp/v320-desktop-suite-model.png'});
      await page.locator('#tab-renders').click();
      await page.waitForFunction(()=>document.querySelector('#active-render').complete&&document.querySelector('#active-render').naturalWidth>0);
      if(isSuite){
        for(const room of ['kitchen','balcony','room_c']){
          const view=room==='room_c'?'study':room;
          await page.locator(`#room-nav [data-room="${room}"]`).click();
          await page.waitForFunction(expected=>{const img=document.querySelector('#active-render');return img.complete&&img.naturalWidth>0&&new URL(img.src).pathname.endsWith('/'+expected+'.jpg')},view);
          assert.ok((await page.locator('#card-description').textContent()).includes(room==='room_c'?'书架':'大窗'),'Revised room description');
          if(name==='desktop'||room==='room_c')await page.screenshot({path:`tmp/v324-${name}-${room}-render-ui.png`});
        }
      }
      await page.locator('#open-project').click();
      if(isSuite){
        await page.locator('#project-suite-entry').click();
        await page.waitForFunction(()=>document.querySelector('#large-render').complete&&document.querySelector('#large-render').naturalWidth>0);
        assert.ok((await page.locator('#large-render').getAttribute('src')).includes('/suite-entry.jpg'));
        await page.locator('#image-dialog .dialog-close').click();
      }
      await page.locator('#project-dialog .dialog-close').click();
      await page.locator('.scheme-switch-button').click();
      assert.equal(await page.locator('[data-scheme-card]').count(),2);
      results.push(name+'/'+scheme+': model/plan/render, header, card, walk, chooser'+(isSuite?', foyer detail':''));
      console.log('PASS '+results.at(-1));
    }
    await context.close();
  }
  assert.deepEqual(errors,[]);
  await writeFile('tmp/v320-browser-qa.json',JSON.stringify({results,errors},null,2));
  console.log('PASS six real Chrome viewer sessions, three viewport sizes; no page exceptions.');
}finally{await browser.close()}
