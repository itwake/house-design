// Isolated headless Chrome test of localhost only. Never connects to user tabs.
// NODE_PATH must include the workspace's bundled playwright package.
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true,channel:'chrome'});
const base='http://127.0.0.1:4173/',results=[],errors=[];
const catalog=JSON.parse(await readFile('models/design-schemes.json','utf8'));
const targetSchemes=process.argv.includes('--family-only')?['family']:['wood','family','laundry'];
await mkdir('tmp',{recursive:true});
// Optional native-model smoke while Blender is rendering. This deliberately
// does not validate unfinished JPEG provenance and cannot substitute for the
// default final nine-session audit below.
if(process.argv.includes('--model-only')){
  const sessions=[];
  try{
    for(const [name,width,height]of [['desktop',1440,1000],['mobile',390,844],['narrow',320,640]]){
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
      for(const scheme of targetSchemes){
        const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(name+'/'+scheme+': '+e.message));
        await page.goto(base+`studio.html?scheme=${scheme}&v=model-only-3.5.3`);
        await page.waitForFunction(()=>document.querySelector('#start-walk')&&!document.querySelector('#start-walk').disabled);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Native viewer fits '+name+'/'+scheme);
        assert.ok(await page.locator('#model-view canvas').count(),'Real loaded WebGL canvas '+scheme);
        const design=JSON.parse(await readFile(`models/schemes/${scheme}/design-data.json`,'utf8'));
        if(design.familyDiningRevision){
          await page.locator('#toggle-room-card').click();
          const toggle=page.locator('#toggle-dining-state');assert.ok(await toggle.isVisible());assert.equal(await toggle.getAttribute('aria-pressed'),'false');
          await page.screenshot({path:`tmp/v353-${name}-family-expanded-model.png`});
          await toggle.click();assert.equal(await toggle.getAttribute('aria-pressed'),'true');
          await page.screenshot({path:`tmp/v353-${name}-family-closed-model.png`});
          await page.locator('#tab-plan').click();assert.equal(await page.locator('#floor-plan [data-dining-furniture]').count(),4);assert.equal(await page.locator('#floor-plan [data-dining-furniture="四人餐桌"]').count(),0);
          for(const f of design.pulloutDining.closedFurniture){const g=page.locator(`#floor-plan [data-dining-furniture="${f.name}"]`);assert.equal(await g.getAttribute('data-dining-face'),'east');const frame=g.locator('[data-furniture-frame]');for(const [key,value]of [['x',f.x],['y',f.y],['width',f.w],['height',f.d]])assert.equal(Number(await frame.getAttribute(key)),value);}
          await page.locator('#tab-model').click();await page.locator('#start-walk').click();assert.ok(await page.locator('#workspace').evaluate(e=>e.classList.contains('walking')));await page.keyboard.press('ArrowUp');await page.locator('#exit-walk').click();
          await toggle.click();assert.equal(await toggle.getAttribute('aria-pressed'),'false');await page.locator('#tab-plan').click();assert.equal(await page.locator('#floor-plan [data-dining-furniture]').count(),5);await page.locator('#tab-model').click();
        }
        await page.locator('#start-walk').click();assert.ok(await page.locator('#workspace').evaluate(e=>e.classList.contains('walking')));await page.keyboard.press('ArrowRight');await page.locator('#exit-walk').click();
        sessions.push(name+'/'+scheme);console.log('PASS native-model smoke '+sessions.at(-1));await page.close();
      }
      await context.close();
    }
    assert.deepEqual(errors,[]);await writeFile('tmp/v353-model-only-qa.json',JSON.stringify({modelOnly:true,finalRenderProvenanceChecked:false,sessions,errors},null,2));
  }finally{await browser.close()}
  console.log(`PASS ${sessions.length} current-model-only Chrome sessions; final 20-frame provenance remains a separate default audit.`);
  process.exit(0);
}
try{
  for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844],['narrow',320,640]]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
    const page=await context.newPage();
    page.setDefaultTimeout(60000);
    page.on('pageerror',e=>errors.push(name+': '+e.message));
    await page.goto(base);
    assert.equal(await page.locator('[data-scheme-card]').count(),3);
    assert.equal(new URL(page.url()).pathname,'/','Chooser must not auto-redirect');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Chooser overflow');
    if(name!=='narrow')await page.screenshot({path:'tmp/v343-'+name+'-chooser.png',fullPage:true});
    for(const scheme of targetSchemes){
      const expectedManifest=JSON.parse(await readFile(`models/schemes/${scheme}/scene-manifest.json`,'utf8'));
      const design=JSON.parse(await readFile(`models/schemes/${scheme}/design-data.json`,'utf8')),hasLaundry=Boolean(design.laundry);
      if(design.familyFlowRevision){
        assert.ok(expectedManifest.renderedViews,'Run final flow browser QA after render provenance has been assembled');
        for(const view of ['kitchen','balcony','study'])assert.ok(expectedManifest.renderedViews[view],'Explicit provenance for '+view);
      }
      if(design.familyDiningRevision){
        assert.ok(catalog.schemes.find(s=>s.id===scheme).renderViews.includes('dining-closed'),'Closed dining state is a public render choice');
        assert.equal(Object.keys(expectedManifest.renderedViews).length,20,'Every expanded/closed and retained render has explicit provenance');
        assert.equal(Object.values(expectedManifest.renderedViews).filter(v=>!v.retainedFrom).length,12,'Twelve current public-room renders');
        assert.equal(Object.values(expectedManifest.renderedViews).filter(v=>v.retainedFrom).length,8,'Eight retained unaffected private-room renders');
      }
      await page.goto(base+'studio.html?scheme='+scheme+'&v='+catalog.version);
      await page.waitForFunction(()=>document.querySelector('#model-loading')?.hidden&&document.querySelectorAll('#floor-plan [data-plan-room]').length===8);
      assert.equal(await page.locator('html').getAttribute('data-scheme'),scheme);
      assert.ok(await page.locator('#model-fallback').evaluate(e=>e.hidden),'3D loaded without fallback');
      for(const id of ['l_desktop','l_support','l_accessories','l_adult_chair','l_child_chair'])assert.equal(await page.locator(`#floor-plan [data-part-id="${id}"]`).count(),0,'No living-bay work furniture in actual plan');
      assert.ok((await page.locator('[data-fitout-card="bay_living_family"]').textContent()).includes('400mm'),'Living sill is explicitly estimated at 400 mm');
      assert.equal(await page.locator('[data-fitout-card="bay_living_family"] .bay-references a').count(),2,'New low-bay and safety references');
      for(const id of ['l_seat_pad_north','l_seat_pad_south']){const pad=page.locator(`#floor-plan [data-part-id="${id}"]`);assert.equal(await pad.count(),1);assert.equal(await pad.getAttribute('data-z-cm'),'40');assert.equal(await pad.getAttribute('data-h-cm'),'5');}
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Viewer overflow');
      for(const selector of ['.scheme-switch-button','.knowledge-entry','#open-project','#download-toggle']){
        const box=await page.locator(selector).boundingBox();
        assert.ok(box&&box.x>=0&&box.x+box.width<=width+1&&box.height<46,name+' header fits: '+selector);
      }
      const isSuite=scheme!=='wood',isFamily=scheme==='family';
      assert.equal(await page.locator('#floor-plan [data-opening-id="window_kitchen_balcony"]').count(),1,'Internal kitchen window in every active scheme');
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
      if(isFamily){
        const entryChanged=Boolean(design.familyEntryRevision),face=entryChanged?'east':'north';
        assert.equal(await page.locator('[data-family-garage]').getAttribute('data-opening-face'),face);
        assert.equal(await page.locator(`[data-garage-exit="${face}"]`).count(),1);
        assert.equal(await page.locator(`[data-garage-item][data-rotation="${entryChanged?0:90}"]`).count(),2);
        if(entryChanged){
          assert.equal(await page.locator('[data-garage-item="child_bike"]').getAttribute('data-z-cm'),'123');assert.equal(await page.locator('[data-garage-item="folded_stroller"]').getAttribute('data-z-cm'),'0');
          if(design.familyFlowRevision){
            const leaves=design.garage.parts.filter(p=>p.role==='folded-door');assert.equal(leaves.length,2);
            assert.equal(await page.locator('[data-garage-part="hinged-leaf"]').count(),0,'No obsolete single hinged leaf in plan');
            for(const leaf of leaves){
              const actual=page.locator(`[data-garage-part="${leaf.id}"]`);assert.equal(await actual.count(),1,'Actual folded leaf '+leaf.id);
              for(const [attribute,value]of [['x',leaf.x],['y',leaf.y],['width',leaf.w],['height',leaf.d]])assert.equal(Number(await actual.getAttribute(attribute)),value,'Folded leaf scale '+attribute);
            }
            assert.equal(design.garage.doorFoldDirection,'outward');assert.equal(design.garage.doorStackSide,'north');
            const eastPosts=design.garage.parts.filter(p=>p.role==='rack-post'&&p.x===Math.max(...design.garage.parts.filter(p=>p.role==='rack-post').map(p=>p.x))).sort((a,b)=>a.y-b.y);
            assert.equal(eastPosts.length,2);assert.equal(eastPosts[1].y-(eastPosts[0].y+eastPosts[0].d),57,'Real 55 cm stroller clears 57 cm rack-post gap');
          }else assert.equal(await page.locator('[data-garage-part="hinged-leaf"]').count(),1);
        }
      }
      if(await page.locator('#room-card').evaluate(e=>e.hidden))await page.locator('#toggle-room-card').click();
      assert.ok(await page.locator('#room-card').isVisible(),'Show card');
      await page.locator('#toggle-room-card').click();
      assert.ok(await page.locator('#room-card').evaluate(e=>e.hidden),'Hide card');
      await page.locator('#tab-plan').click();
      if(design.familyDiningRevision){
        const toggle=page.locator('#toggle-dining-state');assert.equal(await toggle.count(),1);assert.ok(await toggle.isVisible(),'Dining state switch is visible on all viewport sizes');
        const matches=async f=>page.locator('#floor-plan [data-furniture-frame]').evaluateAll((frames,expected)=>frames.filter(frame=>['x','y','width','height'].every((attribute,i)=>Math.abs(Number(frame.getAttribute(attribute))-expected[i])<1e-7)).length,[f.x,f.y,f.w,f.d]);
        for(const f of design.furniture.filter(f=>f.diningFitoutId===design.pulloutDining.id))assert.equal(await matches(f),1,'Expanded dining component really exists '+f.name);
        assert.equal(design.pulloutDining.closedFurniture.filter(f=>f.name.includes('餐椅')).length,4,'Closed layout retains four full chairs');
        await toggle.click();
        for(const f of design.pulloutDining.closedFurniture)assert.equal(await matches(f),1,'Closed chair remains full visible furniture '+f.name);
        assert.equal(await matches(design.pulloutDining.table),0,'Retracted table no longer occupies the hall');
        await page.screenshot({path:`tmp/v353-${name}-family-dining-closed-plan.png`});
        await page.locator('#tab-model').click();await page.locator('#start-walk').click();
        assert.ok(await page.locator('#workspace').evaluate(e=>e.classList.contains('walking')),'Closed-state walkthrough remains usable');
        await page.keyboard.press('ArrowUp');await page.locator('#exit-walk').click();
        await page.locator('#room-nav [data-room="dining"]').click();await page.locator('#tab-renders').click();
        await page.waitForFunction(()=>{const img=document.querySelector('#active-render');return img.complete&&img.naturalWidth>0&&new URL(img.src).pathname.endsWith('/dining-closed.jpg')});
        assert.ok((await page.locator('#render-provenance').textContent()).includes('当前模型重渲'),'Closed dining render is actual current model output');
        await page.screenshot({path:`tmp/v353-${name}-family-dining-closed-render.png`});await page.locator('#tab-plan').click();
        await toggle.click();
        for(const f of design.furniture.filter(f=>f.diningFitoutId===design.pulloutDining.id))assert.equal(await matches(f),1,'Restored expanded dining component '+f.name);
        const planText=await page.locator('#floor-plan').textContent();assert.ok(!/NaN|undefined/.test(planText),'Two-state plan has no missing coordinate labels');
      }
      if(isSuite)await page.screenshot({path:`tmp/v343-${name}-${scheme}-plan.png`});
      await page.locator('#tab-model').click();
      await page.locator('#start-walk').click();
      assert.ok(await page.locator('#workspace').evaluate(e=>e.classList.contains('walking')));
      await page.keyboard.press('ArrowUp');
      await page.locator('#exit-walk').click();
      assert.ok(await page.locator('#workspace').evaluate(e=>!e.classList.contains('walking')));
      if(isSuite&&name==='desktop')await page.screenshot({path:`tmp/v343-desktop-${scheme}-model.png`});
      await page.locator('#tab-renders').click();
      await page.waitForFunction(()=>document.querySelector('#active-render').complete&&document.querySelector('#active-render').naturalWidth>0);
      assert.ok((await page.locator('#render-provenance').textContent()).includes('当前模型重渲'),'Overview uses a current furniture-free scene render');
      if(isSuite){
        for(const room of ['kitchen','balcony','room_c']){
          const view=room==='room_c'?'study':room;
          await page.locator(`#room-nav [data-room="${room}"]`).click();
          await page.waitForFunction(expected=>{const img=document.querySelector('#active-render');return img.complete&&img.naturalWidth>0&&new URL(img.src).pathname.endsWith('/'+expected+'.jpg')},view);
          assert.ok((await page.locator('#card-description').textContent()).includes(room==='room_c'?'书架':hasLaundry&&room==='balcony'?'浅盆':'大窗'),'Revised room description');
          assert.equal((await page.locator('#render-provenance').textContent()).includes('沿用历史模型图'),!!expectedManifest.renderedViews?.[view]?.retainedFrom,'Correct current/reference caption for '+view);
          if(name==='desktop'||room==='room_c')await page.screenshot({path:`tmp/v343-${name}-${scheme}-${room}-render-ui.png`});
        }
      }
      await page.locator('#open-project').click();
      if(hasLaundry){
        assert.equal(await page.locator('#floor-plan [data-laundry-machine]').count(),2);
        assert.equal(await page.locator('#floor-plan [data-sliding-door="balcony_door"]').getAttribute('data-stack-to'),'south');
        await page.locator('#project-laundry').click();
        assert.equal(await page.locator('#laundry-dialog .bay-references a').count(),3);
        assert.ok((await page.locator('#laundry-dialog').textContent()).includes('690'));
        await page.locator('[data-laundry-render="laundry-detail"]').click();
        await page.waitForFunction(()=>document.querySelector('#large-render').complete&&document.querySelector('#large-render').naturalWidth>0);
        assert.ok((await page.locator('#large-render').getAttribute('src')).includes(renderPrefix+'laundry-detail.jpg'),'Current scheme owns its laundry render');
        await page.screenshot({path:`tmp/v343-${name}-${scheme}-laundry-detail.png`});
        await page.locator('#image-dialog .dialog-close').click();
        await page.locator('#laundry-dialog .dialog-close').click();
        await page.locator('#open-project').click();
      }
      if(isFamily){
        await page.locator('#project-storage-link').click();
        const garage=page.locator('#storage-fitout-cards [data-storage-card="family_garage"]');
        assert.equal(await garage.count(),1);
        assert.ok(/入户门关闭|关闭入户门/.test(await garage.textContent()));
        if(design.familyEntryRevision){
          const text=await garage.textContent();
          assert.equal(await garage.getAttribute('data-storage-opening-face'),'east');
          if(design.familyDiningRevision)assert.ok(text.includes('1500×650mm')&&text.includes('抬放')&&text.includes('东向'),'Current compact garage size and east-facing opening remain explicit');
          else assert.ok(/0\.(?:975|98)㎡/.test(text)&&text.includes('抬放')&&text.includes('东侧'));
          const currentDimensions=design.familyDiningRevision?['1230mm','610mm','570mm','305mm']:design.familyFlowRevision?['1230mm','610mm','4210mm','1275mm','180°']:['1230mm','610mm','720mm','4610mm','先关闭储物柜门'];
          for(const expected of currentDimensions)assert.ok(text.includes(expected),'Current garage card contains '+expected);
          if(design.familyFlowRevision){
            assert.ok(/双折|两叶|双叶/.test(text)&&/外翻|外折/.test(text),'Current garage card explains two physically folded leaves');
            assert.ok(/57cm|570mm/.test(text)&&/55cm|550mm/.test(text),'Card discloses the tight stroller/rack clearance');
            const sideboard=page.locator('#storage-fitout-cards [data-storage-card="dining_sideboard_wall"]'),cabinetText=await sideboard.textContent();
            assert.ok(cabinetText.includes('4210mm')&&cabinetText.includes('1095mm')&&cabinetText.includes('1215mm')&&cabinetText.includes('盲'),'North-facing usable cabinet and blind corner are stated separately');
            assert.ok(!/NaN|undefined/.test(cabinetText),'North/west corner card has real dimensions');
            for(const part of design.storageFitouts.find(f=>f.id==='dining_sideboard_wall').parts.filter(p=>p.face==='north')){
              const drawn=sideboard.locator(`[data-elevation-part-id="${part.id}"]`);assert.equal(await drawn.count(),1,'North-return source part is drawn '+part.id);
              assert.equal(await drawn.getAttribute('data-elevation-face'),'north');assert.equal(Number(await drawn.getAttribute('data-source-x')),part.x);assert.equal(Number(await drawn.getAttribute('data-source-y')),part.y);assert.equal(Number(await drawn.getAttribute('data-depth-cm')),part.d);
            }
            assert.ok(await sideboard.locator('[data-elevation-blind-area]').count()>0,'Blind corner is visibly marked, not fake usable storage');
            for(const obsolete of ['720mm','4610mm','90°打开后端部'])assert.ok(!text.includes(obsolete),'No superseded single-leaf dimensions '+obsolete);
          }
          if(design.familyDiningRevision){
            const allStorageText=await page.locator('#storage-fitout-cards').textContent();
            for(const expected of ['1155','705','250','650'])assert.ok(allStorageText.includes(expected),'Actual dining/back-cabinet dimensions '+expected);
            assert.ok(/抽拉|收桌|收起/.test(allStorageText)&&/四椅|四把|四席/.test(allStorageText),'Storage topic explains four actual chairs and dining retraction');
            assert.ok(/净|安装/.test(allStorageText)&&/440|44cm/.test(allStorageText),'Local deeper hardware pocket is disclosed');
            assert.ok(!/NaN|undefined/.test(allStorageText),'Every new dining/back cabinet card has real copy');
          }
          for(const obsolete of ['NaN','undefined','北侧开口','四叶','900mm短','900短柜','餐桌及四椅不变'])assert.ok(!text.includes(obsolete),'No stale garage copy '+obsolete);
        }
        else assert.ok((await garage.textContent()).includes('1.80㎡')&&(await garage.textContent()).includes('北侧开口朝餐桌'));
        assert.equal(await garage.locator('.bay-references a').count(),2);
        await garage.locator('[data-storage-render]').click();
        await page.waitForFunction(()=>document.querySelector('#large-render').complete&&document.querySelector('#large-render').naturalWidth>0);
        assert.ok((await page.locator('#large-render').getAttribute('src')).includes('/storage-library.jpg'));
        await page.screenshot({path:`tmp/v343-${name}-family-garage.png`});
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
      await page.locator('#project-bay-link').click();
      const lowBay=page.locator('[data-fitout-card="bay_living_family"]');
      await lowBay.scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>{const img=document.querySelector('[data-fitout-card="bay_living_family"] img');return img.complete&&img.naturalWidth>0});
      assert.ok((await lowBay.textContent()).includes('450mm'));
      assert.ok(await page.locator('#bay-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Bay dialog has no horizontal overflow');
      if(await lowBay.locator('details').evaluate(e=>e.open))await lowBay.locator('summary').click();
      await lowBay.scrollIntoViewIfNeeded();
      await page.screenshot({path:`tmp/v343-${name}-${scheme}-low-bay-card.png`});
      await page.locator('#bay-dialog .dialog-close').click();
      await page.locator('.scheme-switch-button').click();
      assert.equal(await page.locator('[data-scheme-card]').count(),3);
      results.push(name+'/'+scheme+': model/plan/render, header, card, walk, chooser'+(isSuite?', foyer detail':''));
      console.log('PASS '+results.at(-1));
    }
    await context.close();
  }
  assert.deepEqual(errors,[]);
  await writeFile('tmp/v343-browser-qa.json',JSON.stringify({results,errors},null,2));
  console.log(`PASS ${results.length} real Chrome viewer sessions, three viewport sizes; no page exceptions.`);
}finally{await browser.close()}
