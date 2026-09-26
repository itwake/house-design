// Isolated headless Chrome test of localhost only. Never connects to user tabs.
// NODE_PATH must include the workspace's bundled playwright package.
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
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
    assert.equal(await page.locator('[data-scheme-card]').count(),4);
    assert.equal(new URL(page.url()).pathname,'/','Chooser must not auto-redirect');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Chooser overflow');
    if(name!=='narrow')await page.screenshot({path:'tmp/v341-'+name+'-chooser.png',fullPage:true});
    for(const scheme of ['wood','suite','family','laundry']){
      const expectedManifest=JSON.parse(await readFile(`models/schemes/${scheme}/scene-manifest.json`,'utf8'));
      await page.goto(base+'studio.html?scheme='+scheme+'&v=3.4.1');
      await page.waitForFunction(()=>document.querySelector('#model-loading')?.hidden&&document.querySelectorAll('#floor-plan [data-plan-room]').length===8);
      assert.equal(await page.locator('html').getAttribute('data-scheme'),scheme);
      assert.ok(await page.locator('#model-fallback').evaluate(e=>e.hidden),'3D loaded without fallback');
      for(const id of ['l_desktop','l_support','l_accessories','l_adult_chair','l_child_chair'])assert.equal(await page.locator(`#floor-plan [data-part-id="${id}"]`).count(),0,'No living-bay work furniture in actual plan');
      assert.ok((await page.locator('[data-fitout-card="bay_living_family"]').textContent()).includes('旧占位'),'Living sill remains explicitly unmeasured');
      assert.equal(await page.locator('[data-fitout-card="bay_living_family"] .bay-references a').count(),2,'New low-bay and safety references');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Viewer overflow');
      for(const selector of ['.scheme-switch-button','.knowledge-entry','#open-project','#download-toggle']){
        const box=await page.locator(selector).boundingBox();
        assert.ok(box&&box.x>=0&&box.x+box.width<=width+1&&box.height<46,name+' header fits: '+selector);
      }
      const isSuite=scheme!=='wood',isFamily=scheme==='family';
      assert.equal(await page.locator('#floor-plan [data-opening-id="window_kitchen_balcony"]').count(),1,'Internal kitchen window in all four schemes');
      assert.equal(await page.locator('#floor-plan [data-wall-fitout="study_bookwall"]').count(),isSuite?1:0,'Study upper bookwall only in revised suite');
      assert.equal(await page.locator('[data-study-bookwall] .bay-references a').count(),isSuite?3:0,'Live source reference links');
      assert.equal(await page.locator('[data-suite-entry="private"]').count(),isSuite?1:0);
      const geometry=(await page.locator('#floor-plan').innerHTML());
      if(isSuite){assert.ok(geometry.includes('（含入口）'));assert.equal(await page.locator('[data-hinged-door]').count(),4);assert.equal(await page.locator('[data-surface-slider="door_c"]').count(),1);assert.ok(geometry.includes('730 × 1530'));}
      if(isSuite){
        for(const id of ['study_north_sofa','study_full_desk','bed_b_niche_console'])assert.equal(await page.locator(`#floor-plan [data-furniture-id="${id}"]`).count(),1,'Approved fitted component '+id);
        assert.equal(await page.locator('#floor-plan [data-sofa-face]').getAttribute('data-sofa-face'),'south');
        assert.equal(await page.locator('.brand strong').textContent(),scheme==='laundry'?'木光 · 家政整墙':isFamily?'木光 · 亲子储物':'木光 · 暖白套间');
      }
      const renderPrefix='/assets/schemes/'+scheme+'/';
      assert.ok((await page.locator('#room-preview').getAttribute('src')).includes(renderPrefix));
      assert.ok((await page.locator('#download-glb').getAttribute('href')).includes('models/schemes/'+scheme+'/'));
      assert.equal(await page.locator('#floor-plan [data-garage-item]').count(),isFamily?2:0);
      if(await page.locator('#room-card').evaluate(e=>e.hidden))await page.locator('#toggle-room-card').click();
      assert.ok(await page.locator('#room-card').isVisible(),'Show card');
      await page.locator('#toggle-room-card').click();
      assert.ok(await page.locator('#room-card').evaluate(e=>e.hidden),'Hide card');
      await page.locator('#tab-plan').click();
      if(isSuite)await page.screenshot({path:`tmp/v341-${name}-${scheme}-plan.png`});
      await page.locator('#tab-model').click();
      await page.locator('#start-walk').click();
      assert.ok(await page.locator('#workspace').evaluate(e=>e.classList.contains('walking')));
      await page.keyboard.press('ArrowUp');
      await page.locator('#exit-walk').click();
      assert.ok(await page.locator('#workspace').evaluate(e=>!e.classList.contains('walking')));
      if(isSuite&&name==='desktop')await page.screenshot({path:`tmp/v341-desktop-${scheme}-model.png`});
      await page.locator('#tab-renders').click();
      await page.waitForFunction(()=>document.querySelector('#active-render').complete&&document.querySelector('#active-render').naturalWidth>0);
      assert.ok((await page.locator('#render-provenance').textContent()).includes('当前模型重渲'),'Overview uses a current furniture-free scene render');
      if(isSuite){
        for(const room of ['kitchen','balcony','room_c']){
          const view=room==='room_c'?'study':room;
          await page.locator(`#room-nav [data-room="${room}"]`).click();
          await page.waitForFunction(expected=>{const img=document.querySelector('#active-render');return img.complete&&img.naturalWidth>0&&new URL(img.src).pathname.endsWith('/'+expected+'.jpg')},view);
          assert.ok((await page.locator('#card-description').textContent()).includes(room==='room_c'?'书架':scheme==='laundry'&&room==='balcony'?'浅盆':'大窗'),'Revised room description');
          assert.equal((await page.locator('#render-provenance').textContent()).includes('沿用上版模型图'),!!expectedManifest.renderedViews[view]?.retainedFrom,'Correct current/reference caption for '+view);
          if(name==='desktop'||room==='room_c')await page.screenshot({path:`tmp/v341-${name}-${scheme}-${room}-render-ui.png`});
        }
      }
      await page.locator('#open-project').click();
      if(scheme==='laundry'){
        assert.equal(await page.locator('#floor-plan [data-laundry-machine]').count(),2);
        assert.equal(await page.locator('#floor-plan [data-sliding-door="balcony_door"]').getAttribute('data-stack-to'),'south');
        await page.locator('#project-laundry').click();
        assert.equal(await page.locator('#laundry-dialog .bay-references a').count(),3);
        assert.ok((await page.locator('#laundry-dialog').textContent()).includes('690'));
        await page.locator('[data-laundry-render="laundry-detail"]').click();
        await page.waitForFunction(()=>document.querySelector('#large-render').complete&&document.querySelector('#large-render').naturalWidth>0);
        await page.screenshot({path:`tmp/v341-${name}-laundry-detail.png`});
        await page.locator('#image-dialog .dialog-close').click();
        await page.locator('#laundry-dialog .dialog-close').click();
        await page.locator('#open-project').click();
      }
      if(isFamily){
        await page.locator('#project-storage-link').click();
        const garage=page.locator('#storage-fitout-cards [data-storage-card="family_garage"]');
        assert.equal(await garage.count(),1);
        assert.ok((await garage.textContent()).includes('入户门关闭'));
        assert.equal(await garage.locator('.bay-references a').count(),2);
        await garage.locator('[data-storage-render]').click();
        await page.waitForFunction(()=>document.querySelector('#large-render').complete&&document.querySelector('#large-render').naturalWidth>0);
        assert.ok((await page.locator('#large-render').getAttribute('src')).includes('/storage-library.jpg'));
        await page.screenshot({path:`tmp/v341-${name}-family-garage.png`});
        await page.locator('#image-dialog .dialog-close').click();
        await page.locator('#storage-dialog .dialog-close').click();
        await page.locator('#open-project').click();
      }
      if(isSuite){
        await page.locator('#project-suite-entry').click();
        await page.waitForFunction(()=>document.querySelector('#large-render').complete&&document.querySelector('#large-render').naturalWidth>0);
        assert.ok((await page.locator('#large-render').getAttribute('src')).includes('/suite-entry.jpg'));
        await page.locator('#image-dialog .dialog-close').click();
      }
      await page.locator('#project-dialog .dialog-close').click();
      await page.locator('.scheme-switch-button').click();
      assert.equal(await page.locator('[data-scheme-card]').count(),4);
      results.push(name+'/'+scheme+': model/plan/render, header, card, walk, chooser'+(isSuite?', foyer detail':''));
      console.log('PASS '+results.at(-1));
    }
    await context.close();
  }
  assert.deepEqual(errors,[]);
  await writeFile('tmp/v341-browser-qa.json',JSON.stringify({results,errors},null,2));
  console.log('PASS twelve real Chrome viewer sessions, three viewport sizes; no page exceptions.');
}finally{await browser.close()}
