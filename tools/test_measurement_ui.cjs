/* Real-data browser regression: run against your own local static server.
 * node tools/test_measurement_ui.cjs --base=http://127.0.0.1:4186/
 * --native additionally requires rebuilt GLBs/manifests and loads those meshes.
 * --proof-only validates text-only source provenance without a browser/server.
 * Default UI-only mode intentionally aborts GLBs: no mesh-validation claim.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
let chromium;
try { ({chromium} = require('playwright')); }
catch { ({chromium} = require(path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
const root = path.resolve(__dirname, '..');
const base = process.argv.find(v => v.startsWith('--base='))?.slice(7) || 'http://127.0.0.1:4186/';
const native = process.argv.includes('--native');
const screenshotDir = process.argv.find(v => v.startsWith('--screenshots-dir='))?.slice(18);
const selectedWidths=process.argv.find(v=>v.startsWith('--widths='))?.slice(9).split(',').map(Number);
const selectedSchemes=process.argv.find(v=>v.startsWith('--schemes='))?.slice(10).split(',');
const viewports=[{width:1440,height:1000},{width:390,height:844},{width:320,height:800}].filter(v=>!selectedWidths||selectedWidths.includes(v.width));
assert(viewports.length,'--widths must select at least one of 1440,390,320');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'models/design-schemes.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'studio.js'), 'utf8');
// Test hooks are added only to the intercepted response, never production JS.
const hooks = `\nwindow.__measurementQA={
  get source(){return data},get modelReady(){return state.ready},get manifest(){return manifest},
  notes:()=>windowModelNotes(data),
  dimensions:()=>{if(!dimensionNodes.length&&three&&scene)buildLabels();return dimensionNodes.map(item=>item.element.textContent)},
  provenance:view=>renderProvenance(view),get textOnlyProof(){return metadataOnlyRenderProof},
  provenanceWithRecord:(view,record)=>{const saved=manifest;try{manifest={...manifest,renderedViews:{...manifest.renderedViews,[view]:record}};return renderProvenance(view)}finally{manifest=saved}}
};`;
async function checkMetadataOnlyProofs(){
  const functionSource=source.match(/async function validateMetadataOnlySourceRefresh\([\s\S]*?\r?\n}\r?\n/)?.[0];
  assert(functionSource,'production metadata proof validator found');
  const validate=vm.runInNewContext(functionSource+';validateMetadataOnlySourceRefresh',{crypto:crypto.webcrypto,TextEncoder,Uint8Array});
  const captionSource=source.match(/const renderProvenance = view => \{[\s\S]*?\r?\n};/)?.[0];
  assert(captionSource,'production render provenance function found');
  const clone=value=>JSON.parse(JSON.stringify(value));
  for(const scheme of catalog.schemes){
    const current=JSON.parse(fs.readFileSync(path.join(root,scheme.geometrySource),'utf8'));
    const manifest=JSON.parse(fs.readFileSync(path.join(root,scheme.manifest),'utf8'));
    const proof=manifest.metadataOnlySourceRefresh;
    if(!proof||!Object.values(manifest.renderedViews||{}).some(record=>record.sourceSha256===proof.oldSourceSha256))continue;
    const accepted=await validate(current,manifest);
    assert(accepted,`${scheme.id}: authentic text-only source proof accepted`);
    const captionContext={data:current,manifest:clone(manifest),metadataOnlyRenderProof:accepted};
    const caption=vm.runInNewContext(captionSource+';renderProvenance',captionContext);
    const frames=Object.entries(manifest.renderedViews||{}).filter(([,record])=>record.sourceSha256===proof.oldSourceSha256&&!record.retainedFrom);
    for(const [view]of frames)assert.match(caption(view),/当前复尺模型渲染（仅文字随后修订）/,`${scheme.id}: ${view} caption preserves true source record`);
    if(frames.length){
      const [view,record]=frames[0];
      captionContext.manifest.renderedViews[view]={...record,baseBlendSha256:'0'.repeat(64)};
      assert.doesNotMatch(caption(view),/当前复尺模型渲染（仅文字随后修订）/,'mismatched frame Blend remains historical');
      captionContext.manifest.renderedViews[view]={...record,retainedFrom:'older-source'};
      assert.doesNotMatch(caption(view),/当前复尺模型渲染（仅文字随后修订）/,'historical retained frame not promoted');
      captionContext.metadataOnlyRenderProof=null;
      captionContext.manifest.renderedViews[view]=record;
      assert.doesNotMatch(caption(view),/当前复尺模型渲染（仅文字随后修订）/,'unverified proof not promoted');
    }
    const reject=async(name,edit)=>{const data=clone(current),m=clone(manifest);edit(data,m);assert.equal(await validate(data,m),null,`${scheme.id}: ${name} rejected`)};
    await reject('unlisted geometry change',data=>{data.windows[0].x1+=.1});
    await reject('non-text field',(_data,m)=>{m.metadataOnlySourceRefresh.changes[0].field='sillCm'});
    await reject('wrong after text',(_data,m)=>{m.metadataOnlySourceRefresh.changes[0].after+='changed'});
    await reject('wrong previous text',(_data,m)=>{m.metadataOnlySourceRefresh.changes[0].before+='changed'});
    await reject('unmatched current hash',(_data,m)=>{m.metadataOnlySourceRefresh.currentSourceSha256='0'.repeat(64)});
    await reject('unmatched old hash',(_data,m)=>{m.metadataOnlySourceRefresh.oldSourceSha256='0'.repeat(64)});
    await reject('different native blend',(_data,m)=>{m.baseBlendSha256='0'.repeat(64)});
    await reject('duplicate field',(_data,m)=>{m.metadataOnlySourceRefresh.changes.push(clone(m.metadataOnlySourceRefresh.changes[0]))});
    await reject('missing mesh-state proof',(_data,m)=>{delete m.metadataOnlySourceRefresh.meshStateBeforeAndAfter});
    await reject('invalid property-presence claim',(_data,m)=>{m.metadataOnlySourceRefresh.changes[0].afterPresent=false});
    console.log(`PASS ${scheme.id}: text-only provenance proof, ${frames.length} original-SHA frame captions, 10 proof tamper and 3 caption rejection regressions`);
  }
}
function oldDimensions(data) {
  const e=data.envelope,ys=e.map(p=>p[1]),minY=Math.min(...ys),maxY=Math.max(...ys);
  const span=y=>{const xs=e.filter(p=>Math.abs(p[1]-y)<.001).map(p=>p[0]);return Math.max(...xs)-Math.min(...xs)};
  return [span(minY),maxY-minY,span(maxY)].map(cm=>Math.round(cm*10));
}
async function checkNotice(page, view, label) {
  await page.locator(`.view-tabs [data-view="${view}"]`).click();
  const notice=page.locator('#measurement-notice');
  assert(await notice.isVisible(), `${label}: notice visible in ${view}`);
  assert.match(await notice.textContent(), /部分复尺已应用[\s\S]*非全屋实测[\s\S]*旧模型参考/);
  const box=await notice.boundingBox(),tabs=await page.locator('.view-tabs').boundingBox();
  assert(box.y+box.height<=tabs.y+1, `${label}: notice does not cover view tabs`);
  for(const selector of ['#open-measurement']){
    assert(await page.locator(selector).isVisible(), `${label}: ${selector} visible`);
  }
}
async function run() {
  await checkMetadataOnlyProofs();
  if(process.argv.includes('--proof-only'))return;
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
  const results=[];
  try {
    const homepage=await browser.newPage({viewport:{width:390,height:844}});
    await homepage.goto(new URL('index.html',base).href,{waitUntil:'domcontentloaded'});
    assert.match(await homepage.locator('#gallery-measurement-notice').textContent(), /局部复尺已应用[\s\S]*旧模型参考/);
    assert.equal(await homepage.locator('[data-scheme-card]').count(),3);
    assert.equal(await homepage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'homepage fits mobile width');
    await homepage.close();
    for(const scheme of catalog.schemes.filter(scheme=>!selectedSchemes||selectedSchemes.includes(scheme.id))) {
      const dataBytes=fs.readFileSync(path.join(root,scheme.geometrySource));
      const data=JSON.parse(dataBytes),revision=data.measurementRevision;
      assert(revision&&revision.oldEnvelope,`${scheme.id}: real revision required`);
      const diskManifest=JSON.parse(fs.readFileSync(path.join(root,scheme.manifest),'utf8'));
      const currentNative=diskManifest.sourceSha256===crypto.createHash('sha256').update(dataBytes).digest('hex')&&diskManifest.measurementRevision?.version===revision.version;
      if(native)assert(currentNative,`${scheme.id}: rebuilt manifest must match exact source bytes`);
      for(const viewport of viewports) {
        const label=`${scheme.id}/${viewport.width}`,page=await browser.newPage({viewport,acceptDownloads:true});
        const errors=[];page.on('pageerror',error=>errors.push(error.message));
        await page.route('**/studio.js*',route=>route.fulfill({contentType:'text/javascript; charset=utf-8',body:source+hooks}));
        if(!native)await page.route('**/*.glb*',route=>route.abort());
        await page.goto(new URL(`studio.html?scheme=${scheme.id}&v=3.6.0#dining`,base).href,{waitUntil:'domcontentloaded'});
        await page.waitForSelector('#floor-plan svg',{state:'attached'});
        assert.equal(await page.evaluate(()=>document.documentElement.dataset.uiRevision),'3.6.0');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${label}: fits viewport`);
        for(const [view,text] of [['model','空间模型'],['plan','平面'],['renders','效果图']]){
          await checkNotice(page,view,label);assert.match(await page.locator('#measurement-notice-copy').textContent(),new RegExp(text));
        }
        await page.locator('.view-tabs [data-view="plan"]').click();
        const widths=await page.locator('[data-bay-frame-layer]').evaluateAll(groups=>Object.fromEntries(groups.map(g=>{const w=g.querySelector('[data-bay-glass]');return [g.dataset.bayFrameLayer,Math.round(Math.hypot(w.x2.baseVal.value-w.x1.baseVal.value,w.y2.baseVal.value-w.y1.baseVal.value)*10)]})));
        assert.equal(widths.window_b,1760,`${label}: B measured width`);
        assert.equal(widths.window_living_west,2120,`${label}: living measured width, not 2210 height`);
        assert.equal(widths.window_a,1500,`${label}: master unconfirmed width retained`);
        assert.equal(await page.locator('[data-envelope-dimensions="old-reference"]').count(),1);
        const labels=await page.locator('#floor-plan svg text').allTextContents();
        for(const mm of oldDimensions(data))assert(labels.includes(`${mm.toLocaleString('en-US')} · 旧模型参考`),`${label}: plan ${mm} labeled provisional`);
        const notes=await page.evaluate(()=>window.__measurementQA.notes());
        assert.match(notes.find(x=>x.startsWith('客厅')),/窗宽2120mm，窗高2210mm，台高400mm，外凸600mm[\s\S]*450mm/);
        assert.match(notes.find(x=>x.startsWith('次卧')),/窗宽1760mm，窗高1670mm，台高400mm[\s\S]*450mm/);
        assert.match(notes.find(x=>x.startsWith('主卧')),/窗宽1500mm，窗高1660mm，台高410mm/);
        await page.locator('#open-measurement').click();
        assert.equal(await page.locator('#measurement-dialog').evaluate(el=>el.open),true);
        assert.equal(await page.locator('[data-measurement-applied]').count(),revision.applied.length);
        assert.equal(await page.locator('[data-measurement-pending]').count(),revision.pending.length);
        assert.match(await page.locator('#measurement-orientation').textContent(),/逆时针旋转90/);
        assert.match(await page.locator('.measurement-boundary').textContent(),/不是完整实测/);
        await page.locator('#measurement-dialog .dialog-close').click();
        await page.locator('#open-project').click();
        await page.locator('#project-measurement-link').click();
        assert.equal(await page.locator('#project-dialog').evaluate(el=>el.open),false);
        assert.equal(await page.locator('#measurement-dialog').evaluate(el=>el.open),true);
        await page.locator('#measurement-dialog .dialog-close').click();
        for(const id of ['living','room_a','room_b']){
          await page.locator(`#room-nav [data-room="${id}"]`).click();
          const card=await page.locator('#card-description').textContent();
          const fullNote=data.renovationNotes.find(note=>note.roomId===id)?.text;
          if(fullNote)assert(card.includes(fullNote),`${label}: ${id} keeps measured note and layout intent`);
          assert.match(card,/旧模型参考/);
        }
        await page.locator('#room-nav [data-room="dining"]').click();
        if(data.pulloutDining){
          await page.locator('#toggle-dining-state').click();
          assert.equal(await page.locator('[data-dining-state="closed"]').count(),1);
          await page.locator('#toggle-dining-state').click();
          assert.equal(await page.locator('[data-dining-state="expanded"]').count(),1);
          assert.equal(await page.locator('[data-envelope-dimensions="old-reference"]').count(),1);
        }
        const downloadPromise=page.waitForEvent('download');await page.locator('#download-plan').click();
        const downloaded=await downloadPromise,svg=fs.readFileSync(await downloaded.path(),'utf8');
        assert.match(svg,/窗宽2120mm，窗高2210mm，台高400mm/);
        assert.match(svg,/窗宽1760mm，窗高1670mm，台高400mm/);
        assert.match(svg,/未完成全屋实测闭合/);
        const overflow=await page.evaluate(xml=>{
          const svg=new DOMParser().parseFromString(xml,'image/svg+xml').documentElement;
          document.body.append(svg);const v=svg.viewBox.baseVal;
          const bad=[...svg.querySelectorAll(':scope > text')].filter(t=>{const b=t.getBBox();return b.x<v.x-1||b.x+b.width>v.x+v.width+1||b.y<v.y-1||b.y+b.height>v.y+v.height+1}).map(t=>t.textContent);
          svg.remove();return bad;
        },svg);
        assert.deepEqual(overflow,[],`${label}: exported SVG text stays inside bounds`);
        // Actual production buildLabels runs against the loaded source. In
        // UI-only mode this checks labels/lines, not the mesh or native geometry.
        if(native)await page.waitForFunction(()=>window.__measurementQA.modelReady,null,{timeout:120000});
        await page.waitForFunction(()=>window.__measurementQA.dimensions().length===3);
        const modelLabels=await page.evaluate(()=>window.__measurementQA.dimensions());
        for(const mm of oldDimensions(data))assert(modelLabels.includes(`${mm.toLocaleString('en-US')} mm · 旧模型参考`),`${label}: 3D label equals plan`);
        assert.match(await page.evaluate(()=>window.__measurementQA.provenance('living')),/仅局部复尺，非全屋实测/);
        const textProof=diskManifest.metadataOnlySourceRefresh;
        if(textProof){
          const provenFrames=Object.entries(diskManifest.renderedViews||{}).filter(([,record])=>record.sourceSha256===textProof.oldSourceSha256&&!record.retainedFrom);
          if(provenFrames.length){
            assert(await page.evaluate(()=>Boolean(window.__measurementQA.textOnlyProof)),`${label}: browser source proof validated`);
            for(const [view]of provenFrames)assert.match(await page.evaluate(view=>window.__measurementQA.provenance(view),view),/当前复尺模型渲染（仅文字随后修订）/,`${label}: ${view} authentic metadata-only frame`);
            const [view,record]=provenFrames[0];
            assert.doesNotMatch(await page.evaluate(({view,record})=>window.__measurementQA.provenanceWithRecord(view,record),{view,record:{...record,baseBlendSha256:'0'.repeat(64)}}),/当前复尺模型渲染（仅文字随后修订）/);
            assert.doesNotMatch(await page.evaluate(({view,record})=>window.__measurementQA.provenanceWithRecord(view,record),{view,record:{...record,retainedFrom:'older-source'}}),/当前复尺模型渲染（仅文字随后修订）/);
          }
        }
        assert.deepEqual(errors,[],`${label}: uncaught browser errors`);
        if(screenshotDir&&viewport.width!==320){await page.locator('#toast.show').waitFor({state:'hidden'});fs.mkdirSync(screenshotDir,{recursive:true});await page.screenshot({path:path.join(screenshotDir,`${scheme.id}-${viewport.width}-plan.png`),fullPage:true});}
        results.push({scheme:scheme.id,width:viewport.width,applied:revision.applied.length,pending:revision.pending.length,windowWidthsMm:widths,nativeManifestCurrent:currentNative,nativeModelLoaded:native});
        console.log(`PASS ${label}: true-source SVG, measurement notice/dialog, export, dining state, 2D/3D labels${native?', native GLB loaded':''}`);
        await page.close();
      }
    }
    console.log(JSON.stringify({mode:native?'native-load-and-ui':'ui-only (meshes intentionally not validated)',results},null,2));
  } finally {await browser.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1});
