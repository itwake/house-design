/* Second-survey UI regression. No server is started by this test.
 * node tools/test_measurement_r2_ui.cjs                  # pure production helpers
 * node tools/test_measurement_r2_ui.cjs --browser --base=http://127.0.0.1:4186/
 * node tools/test_measurement_r2_ui.cjs --native --base=http://127.0.0.1:4186/
 * node tools/test_measurement_r2_ui.cjs --sources-only  # all 3 final assets, no browser
 * --browser alone blocks GLBs (UI-only); --native loads final GLBs and requires
 * all 3 schemes' final sources/native models and audited fresh or historical views.
 * Native browser defaults to family at 390/1440 to reduce CPU; --schemes/--widths override.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'studio.js'),'utf8');
const native=process.argv.includes('--native');
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const revision=source.match(/const UI_REVISION = '([^']+)'/)[1];
// The UI/product release advances independently of the unchanged R2 survey.
const surveyRevision='3.6.1';
const catalog=JSON.parse(fs.readFileSync(path.join(root,'models/design-schemes.json'),'utf8'));
const purchasedSource=JSON.parse(fs.readFileSync(path.join(root,catalog.purchasedFurnitureSource),'utf8'));
const expectedViewCounts={wood:16,family:20,laundry:19};
const kitchenRetainedCommit='92162a8cbc713f5ce72fa6632f37364328778253';
const kitchenFreshViews=new Set(['overall','kitchen','kitchen-north']);
const kitchenRetainedReason='kitchen-only-refresh; historical reference, not a current kitchen render';
const gitBytes=asset=>execFileSync('git',['show',`${kitchenRetainedCommit}:${asset}`],{cwd:root,maxBuffer:30*1024*1024});
const defaultRenderViews=['overall','living','dining','master','bedroom-b','study','kitchen','master-bath','guest-bath','balcony','bay-master','bay-tea','bay-living','entry-storage','sideboard'];
// Added only to the routed test response; production bundle remains untouched.
const hooks=`\nwindow.__measurementR2QA={
  get modelReady(){return state.ready},get manifest(){return manifest},get source(){return data},
  modelStats:()=>{let meshes=0,vertices=0;model?.traverse(object=>{if(object.isMesh){meshes++;vertices+=object.geometry?.attributes?.position?.count||0}});return {meshes,vertices}},
  provenance:view=>renderProvenance(view),
  provenanceWithRecord:(view,record)=>{const saved=manifest;try{manifest={...manifest,renderedViews:{...manifest.renderedViews,[view]:record}};return renderProvenance(view)}finally{manifest=saved}},
  provenanceWithRevision:(view,revision)=>{const saved=manifest;try{manifest={...manifest,measurementRevision:revision};return renderProvenance(view)}finally{manifest=saved}},
  provenanceWithPurchasedRevision:(view,revision)=>{const saved=manifest;try{manifest={...manifest,purchasedFurnitureRevision:revision};return renderProvenance(view)}finally{manifest=saved}}
};`;
function extract(name){
  const found=source.match(new RegExp(`function ${name}\\([\\s\\S]*?\\r?\\n}`));
  assert(found,`${name} found in production source`);return found[0];
}
const escape=source.match(/const escapeHTML = .*?;\r?\n/)[0];
const sandbox={data:{measurementRevision:{roomDescriptions:{bath_1:{notice:'实测窗高 1400 mm；模型旧占位高 800 mm、台高 1500 mm，定位待核。'}}}},sourceNotes:()=>[{roomId:'bath_1',text:'西门通套内玄关。'}]};
const helpers=vm.runInNewContext(escape+extract('localExistingPlanMarkup')+extract('measurementRoomNotice')+extract('measurementRoomDescription')+extract('windowEvidenceExportNotes')+extract('wrapPlanFootnotes')+';({localExistingPlanMarkup,measurementRoomNotice,measurementRoomDescription,windowEvidenceExportNotes,wrapPlanFootnotes})',sandbox);
const plan={id:'suite-bath-existing',title:'主卫现状局部轮廓',pointsMm:[[0,0],[2400,0],[2400,1530],[1010,1530],[1010,1320],[0,1320]],basis:'S01–S04；2400 / 210为推算',notes:['不确定门窗位置不画入。']};
const svg=helpers.localExistingPlanMarkup(plan);
for(const label of ['总长 2400','西段 1010','东段 1390','西段净深 1320','东段净深 1530','退台 210','非改造完成图','局部原点','全屋定位','不绘制位置未确认的门窗'])assert(svg.includes(label),label);
assert(svg.includes('polygon class="existing-plan-outline"'),'exact polygon, not a guessed rectangle');
assert(!/data-plan-room|data-bay|door|window/.test(svg),'no renovation or door/window geometry inserted');
const moved=JSON.parse(JSON.stringify(plan));moved.pointsMm=moved.pointsMm.map(([x,y])=>[x+77,y+83]);
assert.equal(helpers.localExistingPlanMarkup(moved),svg,'local origin normalizes without implying global placement');
for(const invalid of [null,{}, {...plan,pointsMm:[[0,0]]}, {...plan,pointsMm:plan.pointsMm.map((p,i)=>i===1?[NaN,0]:p)}, {...plan,pointsMm:plan.pointsMm.map((p,i)=>i===3?[1010,1510]:p)}])assert.equal(helpers.localExistingPlanMarkup(invalid),'','invalid outline omitted');
const unsafe=helpers.localExistingPlanMarkup({...plan,title:'<script>bad()</script>',notes:['<img src=x onerror=bad()>']});
assert(!unsafe.includes('<script>')&&!unsafe.includes('<img src='),'source strings escaped');
assert(unsafe.includes('&lt;script&gt;'),'escaped source remains legible');
assert.equal(helpers.measurementRoomNotice('bath_1'),sandbox.data.measurementRevision.roomDescriptions.bath_1.notice,'notice is source-driven');
assert.equal(helpers.measurementRoomNotice('room_a'),'','no invented warnings for other rooms');
sandbox.data.measurementRevision.roomDescriptions.bath_1.description='窗高确认，定位未核。';
assert.equal(helpers.measurementRoomDescription('bath_1'),'西门通套内玄关。 窗高确认，定位未核。','layout and new survey facts both retained');
assert.equal(revision,catalog.version,'viewer cache follows the current product/catalog release');
assert.equal(fs.readFileSync(path.join(root,'schemes.js'),'utf8').match(/SCHEME_REVISION='([^']+)'/)[1],revision,'catalog cache follows UI release');
assert.equal(purchasedSource.version,'3.7.0','purchased evidence keeps its own verified release when the kitchen changes');
const provenanceSource=source.match(/const renderProvenance = view => \{[\s\S]*?\r?\n};/)[0];
const provenanceSandbox={data:{measurementRevision:{version:surveyRevision,date:'2026-10-04'},purchasedFurnitureRevision:{version:purchasedSource.version}},manifest:{measurementRevision:{version:surveyRevision,date:'2026-10-04'},purchasedFurnitureRevision:{version:purchasedSource.version},sourceSha256:'fresh-source',renderedViews:{living:{sourceSha256:'fresh-source'}}},metadataOnlyRenderProof:null};
const provenance=vm.runInNewContext(provenanceSource+';renderProvenance',provenanceSandbox);
assert.match(provenance('living'),/^当前模型重渲/,'separate current survey/product revisions produce a current caption');
for(const invalid of [undefined,{version:'previous-purchased-model'}]){
  provenanceSandbox.manifest.purchasedFurnitureRevision=invalid;
  assert.match(provenance('living'),/^家具替换前参考图/,'missing/old product revision cannot claim a current furniture render');
  assert.match(provenance('living'),/仅局部复尺，非全屋实测/,'product synchronization preserves survey limitation');
}
provenanceSandbox.manifest.purchasedFurnitureRevision={version:purchasedSource.version};
provenanceSandbox.manifest.measurementRevision={version:'old-survey',date:'2026-10-04'};
assert.match(provenance('living'),/^复尺前参考图/,'survey synchronization remains independently required');
provenanceSandbox.manifest.measurementRevision={version:surveyRevision,date:'2026-10-04'};
provenanceSandbox.manifest.renderedViews.living={sourceSha256:'original-source',retainedFrom:{commit:kitchenRetainedCommit,manifest:'models/schemes/wood/scene-manifest.json',view:'living',reason:kitchenRetainedReason}};
assert.match(provenance('living'),/^沿用历史模型图/,'explicit kitchen-scoped retained frame remains visibly historical');
assert.match(provenance('living'),/仅局部复尺，非全屋实测/,'retained frame keeps partial-survey limitation');
const exportFixture={measurementRevision:{},windows:[{id:'window_bath_1_east',measuredDimensions:{widthMm:501,heightMm:1401,sillMm:null,fullyLocated:false},placeholderDecision:{geometry:'保留旧窗示意',sillMm:1501,heightMm:801}},{id:'window_a',measurementStatus:{fullyLocated:false},designScenario:'西段861mm条件定位，东段881mm而实测871mm，保留10mm差值待核。台高另列。'}]};
const exportNotes=helpers.windowEvidenceExportNotes(exportFixture);
assert.equal(exportNotes.length,3,'two separate bath reminders and one master location note');
assert(exportNotes[0].includes('实测宽501mm、高1401mm')&&exportNotes[0].includes('窗台未测，定位待核'),'measured reminder reads actual data, not hardcoded numbers');
assert(exportNotes[1].includes('台高1501mm／窗高801mm'),'placeholder dimensions read separate source decision');
assert(exportNotes[2].includes('861mm')&&exportNotes[2].includes('871mm'),'master residual note comes from designScenario');
const wrapped=helpers.wrapPlanFootnotes(exportNotes,33,text=>text.length);
assert.equal(wrapped.join(''),exportNotes.join(''),'wrapping never truncates or drops disclaimer text');
assert(wrapped.every(line=>line.length<=33),'wrapped notes fit supplied width');
console.log('PASS second-survey/product pure UI: local outline, 6 dimensions, source-driven warning, escaping, old layout retention, independent cache/survey/product revisions');

function jpegDimensions(raw){
  assert.equal(raw.readUInt16BE(0),0xffd8,'complete JPEG header');
  assert.equal(raw.readUInt16BE(raw.length-2),0xffd9,'complete JPEG trailer');
  for(let offset=2;offset<raw.length;){
    assert.equal(raw[offset++],0xff,'valid JPEG marker');
    while(raw[offset]===0xff)offset++;
    const marker=raw[offset++];
    if(marker===1||marker===0xd8||marker>=0xd0&&marker<=0xd7)continue;
    if(marker===0xda||marker===0xd9)break;
    const length=raw.readUInt16BE(offset);
    assert(length>=2&&offset+length<=raw.length,'complete JPEG segment');
    if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return {width:raw.readUInt16BE(offset+5),height:raw.readUInt16BE(offset+3)};
    offset+=length;
  }
  assert.fail('JPEG has no frame dimensions');
}

function auditFinalSources(){
  const audited=new Map();
  let kitchenGuardPassed=false;
  assert.deepEqual(catalog.schemes.map(s=>s.id),['wood','family','laundry'],'all active sources audited, regardless of browser filters');
  for(const scheme of catalog.schemes){
    const sourceBytes=fs.readFileSync(path.join(root,scheme.geometrySource)),data=JSON.parse(sourceBytes),manifest=JSON.parse(fs.readFileSync(path.join(root,scheme.manifest),'utf8'));
    const sourceHash=sha256(sourceBytes),modelBytes=fs.readFileSync(path.join(root,scheme.model)),modelHash=sha256(modelBytes);
    const kitchenRefresh=data.kitchenFitout?.version==='3.8.0';
    let previousManifest;
    if(kitchenRefresh){
      assert.equal(data.version,'3.8.0',`${scheme.id}: kitchen reuse is limited to this release`);
      assert.equal(data.kitchenFitout.id,'kitchen-20261005',`${scheme.id}: exact reviewed kitchen fitout`);
      assert.deepEqual(manifest.kitchenFitout,data.kitchenFitout,`${scheme.id}: model and source share the exact reviewed kitchen fitout`);
      if(!kitchenGuardPassed){
        const guard=JSON.parse(execFileSync(process.execPath,[path.join(root,'tools/test_kitchen_fitout.mjs')],{cwd:root,encoding:'utf8',timeout:60000,maxBuffer:20*1024*1024}));
        assert.equal(guard.passed,true,'historical image reuse requires independent kitchen/source/unchanged-architecture guard');
        kitchenGuardPassed=true;
      }
      previousManifest=JSON.parse(gitBytes(scheme.manifest));
    }
    assert.equal(data.measurementRevision.version,surveyRevision,`${scheme.id}: unchanged R2 survey source revision`);
    assert.equal(manifest.sourceSha256,sourceHash,`${scheme.id}: manifest matches exact source bytes`);
    assert.equal(manifest.measurementRevision.version,surveyRevision,`${scheme.id}: model survey revision`);
    assert.equal(manifest.measurementRevision.date,data.measurementRevision.date,`${scheme.id}: survey date`);
    assert.deepEqual(manifest.measurementRevision,data.measurementRevision,`${scheme.id}: complete survey evidence remains synchronized`);
    assert.equal(data.purchasedFurnitureRevision.version,purchasedSource.version,`${scheme.id}: current purchased source revision`);
    assert.equal(scheme.purchasedFurnitureRevision,purchasedSource.version,`${scheme.id}: catalog purchased revision`);
    assert.deepEqual(data.purchasedFurnitureRevision.products,purchasedSource.products,`${scheme.id}: exact purchased product catalog`);
    assert.deepEqual(manifest.purchasedFurnitureRevision,data.purchasedFurnitureRevision,`${scheme.id}: model purchased revision and product facts`);
    assert.equal(manifest.baseBlendSha256,sha256(fs.readFileSync(path.join(root,scheme.blend))),`${scheme.id}: exact native Blend hash`);
    assert.equal(modelBytes.toString('ascii',0,4),'glTF',`${scheme.id}: GLB header`);
    assert.equal(modelBytes.readUInt32LE(4),2,`${scheme.id}: GLB version`);
    assert.equal(modelBytes.readUInt32LE(8),modelBytes.length,`${scheme.id}: complete GLB file`);
    const expected=scheme.renderViews||defaultRenderViews;
    assert.equal(expected.length,expectedViewCounts[scheme.id],`${scheme.id}: final purchased furniture view inventory`);
    assert(!expected.includes('dining-closed'),`${scheme.id}: fixed table has no closed-state render`);
    if(scheme.id==='family')for(const key of ['pulloutDining','familyDiningRevision']){
      assert.equal(data[key],undefined,`family: obsolete ${key} absent in source`);
      assert.equal(manifest[key],undefined,`family: obsolete ${key} absent in manifest`);
    }
    assert.deepEqual(Object.keys(manifest.renderedViews||{}).sort(),[...expected].sort(),`${scheme.id}: all final renders required`);
    assert(!manifest.metadataOnlySourceRefresh,`${scheme.id}: R2 is rebuilt, not prior text-only proof`);
    if(kitchenRefresh){
      assert.deepEqual([...expected].sort(),[...Object.keys(previousManifest.renderedViews),'kitchen-north'].sort(),`${scheme.id}: only one new view added to reviewed 3.7.0 inventory`);
      assert.deepEqual(expected.filter(view=>!Object.hasOwn(manifest.renderedViews[view],'retainedFrom')).sort(),[...kitchenFreshViews].sort(),`${scheme.id}: exactly three required fresh kitchen/overview views`);
      assert.deepEqual(expected.filter(view=>Object.hasOwn(manifest.renderedViews[view],'retainedFrom')).sort(),expected.filter(view=>!kitchenFreshViews.has(view)).sort(),`${scheme.id}: every other view explicitly marked historical`);
    }
    for(const view of expected){
      const record=manifest.renderedViews[view];
      const imagePath=path.posix.join(scheme.renderDirectory||`assets/schemes/${scheme.id}`,view+'.jpg');
      const image=fs.readFileSync(path.join(root,imagePath));
      if(kitchenRefresh&&!kitchenFreshViews.has(view)){
        assert.deepEqual(record.retainedFrom,{commit:kitchenRetainedCommit,manifest:scheme.manifest,view,reason:kitchenRetainedReason},`${scheme.id}/${view}: exact kitchen-scoped historical-reference marker`);
        const original=previousManifest.renderedViews[view];
        assert(original&&!Object.hasOwn(original,'retainedFrom'),`${scheme.id}/${view}: original 3.7.0 record was fresh`);
        const {retainedFrom,...unchangedRecord}=record;
        assert.deepEqual(unchangedRecord,original,`${scheme.id}/${view}: preserve original source, Blend, camera, render settings and image hash without retrofitting`);
        const originalImage=gitBytes(imagePath);
        assert(image.equals(originalImage),`${scheme.id}/${view}: retained JPEG bytes exactly equal original Git image`);
        assert.equal(sha256(image),sha256(originalImage),`${scheme.id}/${view}: retained JPEG SHA matches original Git bytes`);
      }else{
        assert.equal(record.sourceSha256,sourceHash,`${scheme.id}/${view}: fresh source SHA`);
        assert.equal(record.baseBlendSha256,manifest.baseBlendSha256,`${scheme.id}/${view}: fresh native Blend SHA`);
        assert(!Object.hasOwn(record,'retainedFrom'),`${scheme.id}/${view}: required fresh view cannot carry a historical marker`);
      }
      assert.equal(record.imageSha256,sha256(image),`${scheme.id}/${view}: exact audited image hash`);
      assert.deepEqual(jpegDimensions(image),{width:scheme.renderSpec.width,height:scheme.renderSpec.height},`${scheme.id}/${view}: actual JPEG dimensions match declared resolution`);
      assert.equal(record.renderSpec.engine,'CYCLES',`${scheme.id}/${view}: Cycles render`);
      assert.equal(record.renderSpec.denoise,true,`${scheme.id}/${view}: denoised render`);
      assert.equal(record.renderSpec.width,scheme.renderSpec.width,`${scheme.id}/${view}: recorded render width`);
      assert.equal(record.renderSpec.height,scheme.renderSpec.height,`${scheme.id}/${view}: recorded render height`);
      assert(record.renderSpec.samples>=scheme.renderSpec.samples&&scheme.renderSpec.samples>=8,`${scheme.id}/${view}: actual sample count meets declared minimum`);
    }
    audited.set(scheme.id,{scheme,data,manifest,sourceHash,modelHash,views:expected});
    console.log(`PASS ${scheme.id}: final source/manifest/Blend/GLB + ${kitchenRefresh?`3 exact current-source images and ${expected.length-3} unchanged historical references`:`${expected.length} exact current-source images`} (all-scheme disk audit)`);
  }
  assert.equal([...audited.values()].reduce((total,item)=>total+item.views.length,0),55,'all 55 declared frames audited, including 9 fresh kitchen/overview views for the kitchen release');
  return audited;
}

async function checkNativePage(page,audit,responses){
  const {scheme,data,manifest,sourceHash,modelHash,views}=audit;
  await page.waitForFunction(()=>window.__measurementR2QA?.modelReady,null,{timeout:180000});
  const [glbResponse,dataResponse]=await Promise.all(responses);
  assert(glbResponse.ok&&dataResponse.ok,`${scheme.id}: successful native/source responses`);
  assert.equal(sha256(glbResponse.body),modelHash,`${scheme.id}: served GLB matches final disk asset`);
  assert.equal(sha256(dataResponse.body),sourceHash,`${scheme.id}: served data matches final source`);
  const actual=await page.evaluate(()=>({ready:window.__measurementR2QA.modelReady,manifest:window.__measurementR2QA.manifest,stats:window.__measurementR2QA.modelStats()}));
  assert(actual.ready&&actual.stats.meshes>0&&actual.stats.vertices>0,`${scheme.id}: actual GLB meshes loaded, not fallback`);
  assert.equal(actual.manifest.sourceSha256,sourceHash,`${scheme.id}: browser manifest/source SHA`);
  assert.equal(actual.manifest.measurementRevision.version,data.measurementRevision.version,`${scheme.id}: browser measurement revision`);
  assert.equal(actual.manifest.measurementRevision.date,data.measurementRevision.date,`${scheme.id}: browser measurement date`);
  assert.deepEqual(actual.manifest.purchasedFurnitureRevision,data.purchasedFurnitureRevision,`${scheme.id}: browser purchased product revision`);
  assert.equal(actual.manifest.baseBlendSha256,manifest.baseBlendSha256,`${scheme.id}: browser native provenance`);
  assert.equal(await page.locator('#model-fallback').isVisible(),false,`${scheme.id}: no fallback presentation`);
  const captions=await page.evaluate(views=>Object.fromEntries(views.map(view=>[view,window.__measurementR2QA.provenance(view)])),views);
  for(const [view,caption]of Object.entries(captions)){
    const retained=Boolean(manifest.renderedViews[view].retainedFrom);
    assert.match(caption,retained?/^沿用历史模型图/:/^当前模型重渲/,`${scheme.id}/${view}: visible caption agrees with audited fresh/historical provenance`);
    assert.match(caption,/仅局部复尺，非全屋实测/,`${scheme.id}/${view}: partial-survey limitation preserved`);
  }
  const probeView=manifest.kitchenFitout?.version==='3.8.0'?'kitchen':'master-bath',record=manifest.renderedViews[probeView];
  const badCaptions=await page.evaluate(({view,record,measurementRevision,purchasedFurnitureRevision})=>({
    oldSource:window.__measurementR2QA.provenanceWithRecord(view,{...record,sourceSha256:'0'.repeat(64)}),
    retained:window.__measurementR2QA.provenanceWithRecord(view,{...record,retainedFrom:'prior-native-model'}),
    unknown:window.__measurementR2QA.provenanceWithRecord(view,{...record,sourceSha256:undefined}),
    oldRevision:window.__measurementR2QA.provenanceWithRevision(view,{...measurementRevision,version:'historical-test-revision'}),
    oldPurchasedRevision:window.__measurementR2QA.provenanceWithPurchasedRevision(view,{...purchasedFurnitureRevision,version:'historical-purchased-revision'}),
    missingPurchasedRevision:window.__measurementR2QA.provenanceWithPurchasedRevision(view,undefined)
  }),{view:probeView,record,measurementRevision:manifest.measurementRevision,purchasedFurnitureRevision:manifest.purchasedFurnitureRevision});
  assert.match(badCaptions.oldSource,/^沿用历史模型图/,'old-source image never presented as current');
  assert.match(badCaptions.retained,/^沿用历史模型图/,'retained image never presented as current');
  assert.match(badCaptions.unknown,/^效果图来源待核/,'unknown source not promoted');
  assert.match(badCaptions.oldRevision,/^复尺前参考图/,'old measurement revision not promoted');
  assert.match(badCaptions.oldPurchasedRevision,/^家具替换前参考图/,'old purchased model revision not promoted');
  assert.match(badCaptions.missingPurchasedRevision,/^家具替换前参考图/,'missing purchased model revision not promoted');
}

async function checkDownloadedPlan(page,data,label,screenshotDir){
  await page.locator('.view-tabs [data-view="plan"]').click();
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#download-plan').click()]);
  const stream=await download.createReadStream();assert(stream,`${label}: actual SVG download stream`);
  const chunks=[];for await(const chunk of stream)chunks.push(chunk);
  const xml=Buffer.concat(chunks).toString('utf8');
  const parsed=await page.evaluate(xml=>{
    const doc=new DOMParser().parseFromString(xml,'image/svg+xml');
    if(doc.querySelector('parsererror'))return {parseError:doc.documentElement.textContent};
    const svg=document.importNode(doc.documentElement,true),holder=document.createElement('div');
    holder.style.cssText='position:fixed;left:-20000px;top:0;opacity:0;pointer-events:none';holder.appendChild(svg);document.body.appendChild(holder);
    const box=svg.viewBox.baseVal,texts=[...svg.querySelectorAll('text[data-export-footnote]')];
    const overflowing=texts.flatMap(text=>{const bounds=text.getBBox();return bounds.x<box.x-.1||bounds.x+bounds.width>box.x+box.width+.1||bounds.y<box.y-.1||bounds.y+bounds.height>box.y+box.height+.1?[{text:text.textContent,x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height}]:[]});
    const result={footnotes:texts.map(text=>text.textContent),overflowing};holder.remove();return result;
  },xml);
  assert(!parsed.parseError,`${label}: downloaded XML is a valid SVG`);
  assert(parsed.footnotes.length>0,`${label}: exported footnotes are real SVG text nodes`);
  const actual=parsed.footnotes.join('');
  for(const expected of helpers.windowEvidenceExportNotes(data))assert(actual.includes(expected),`${label}: downloaded SVG contains complete evidence note: ${expected}`);
  assert(actual.includes('主卫现状窗')&&actual.includes('主卫模型窗')&&actual.includes('定位待核'),`${label}: download distinguishes measured window from old model placeholder`);
  assert.deepEqual(parsed.overflowing,[],`${label}: measured and placeholder reminders stay inside SVG viewBox`);
  if(screenshotDir){fs.mkdirSync(screenshotDir,{recursive:true});await download.saveAs(path.join(screenshotDir,`${label.replace('/','-')}-export.svg`));}
}

async function browserTest(audited){
  let chromium;try{({chromium}=require('playwright'))}catch{({chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')))}
  const base=process.argv.find(a=>a.startsWith('--base='))?.slice(7)||'http://127.0.0.1:4186/';
  const screenshotDir=process.argv.find(a=>a.startsWith('--screenshots-dir='))?.slice(18);
  const selectedSchemes=process.argv.find(a=>a.startsWith('--schemes='))?.slice(10).split(',')||(native?['family']:['wood','family','laundry']);
  const selectedWidths=(process.argv.find(a=>a.startsWith('--widths='))?.slice(9)||(native?'390,1440':'1440,390,320')).split(',').map(Number);
  assert(selectedSchemes.every(id=>catalog.schemes.some(s=>s.id===id)),'valid browser scheme filters');
  assert(selectedWidths.every(width=>Number.isFinite(width)&&width>=300),'valid viewport widths');
  const browser=await chromium.launch({channel:'chrome',headless:true,args:native?['--enable-unsafe-swiftshader']:[]});
  try{
    for(const scheme of selectedSchemes)for(const width of selectedWidths){
      const entry=catalog.schemes.find(s=>s.id===scheme),data=JSON.parse(fs.readFileSync(path.join(root,entry.geometrySource),'utf8'));
      assert.equal(data.measurementRevision.version,surveyRevision,'real second-survey source required independently of UI cache release');
      const note=data.measurementRevision.roomDescriptions.bath_1.notice;
      assert(note,'bath warning registered in source');
      const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/studio.js*',route=>route.fulfill({contentType:'text/javascript; charset=utf-8',body:source+hooks}));
      if(!native)await page.route('**/*.glb*',r=>r.abort());
      const responses=[];
      if(native)for(const asset of [entry.model,entry.geometrySource]){
        let resolveBody,rejectBody;
        responses.push(new Promise((resolve,reject)=>{resolveBody=resolve;rejectBody=reject;}));
        // Fetch the real server asset and deliver the identical bytes to the viewer.
        // Retain those bytes outside Chrome's bounded inspector response cache:
        // the 21 MB GLB can otherwise be evicted before modelReady is reported.
        await page.route(url=>url.pathname===new URL(asset,base).pathname,async route=>{
          try{
            const response=await route.fetch({timeout:180000}),body=await response.body();
            await route.fulfill({response,body});
            resolveBody({ok:response.ok(),body});
          }catch(error){rejectBody(error);await route.abort().catch(()=>{});}
        });
      }
      await page.goto(new URL(`studio.html?scheme=${scheme}&v=${revision}#bath_1`,base).href,{waitUntil:'domcontentloaded'});
      await page.waitForSelector('#floor-plan svg',{state:'attached'});
      if(native)await checkNativePage(page,audited.get(scheme),responses);
      assert.equal(await page.evaluate(()=>document.documentElement.dataset.uiRevision),revision);
      assert.equal(await page.locator('#measurement-notice-copy').textContent(),note);
      assert.equal(await page.locator('#card-measurement-warning').textContent(),note);
      await page.locator('#toggle-room-card').click();
      assert(await page.locator('#measurement-notice').isVisible(),'critical warning persists with card hidden');
      for(const view of ['model','plan','renders']){
        await page.locator(`.view-tabs [data-view="${view}"]`).click();
        const fits=await page.locator('#measurement-notice-copy').evaluate(el=>el.scrollHeight<=el.clientHeight&&el.getBoundingClientRect().bottom<=el.closest('aside').getBoundingClientRect().bottom);
        assert(fits,`${scheme}/${width}/${view}: full warning fits its reserved strip`);
        const top=await page.locator('#measurement-notice').boundingBox(),tabs=await page.locator('.view-tabs').boundingBox();
        assert(tabs.y>=top.y+top.height-1,`${scheme}/${width}: controls below warning`);
      }
      assert.equal(await page.locator('#render-measurement-warning').textContent(),note);
      if(native){
        const bathRecord=audited.get(scheme).manifest.renderedViews['master-bath'];
        assert.match(await page.locator('#render-provenance').textContent(),bathRecord.retainedFrom?/^沿用历史模型图/:/^当前模型重渲/,'visible master-bath caption matches audited historical/current provenance');
        await page.waitForFunction(()=>{const image=document.getElementById('active-render');return image.complete&&image.naturalWidth>0});
        const imageURL=await page.locator('#active-render').getAttribute('src');
        const response=await page.request.get(imageURL),record=audited.get(scheme).manifest.renderedViews['master-bath'];
        assert(response.ok(),'master-bath image served successfully');
        assert.equal(sha256(await response.body()),record.imageSha256,'displayed effect image matches audited fresh or historical bytes');
        if(screenshotDir){fs.mkdirSync(screenshotDir,{recursive:true});await page.screenshot({path:path.join(screenshotDir,`${scheme}-${width}-bath-warning.png`)});}
      }
      await page.locator('#enlarge-render').click();
      assert((await page.locator('#large-render-caption').textContent()).includes(note),'enlarged view carries warning');
      await page.locator('#image-dialog .dialog-close').click();
      await page.locator('#open-project').click();
      assert.equal(await page.locator('#project-measurement-warning').textContent(),note);
      await page.locator('#project-measurement-link').click();
      assert.equal(await page.locator('#measurement-dialog').evaluate(el=>el.open),true);
      assert.equal(await page.locator('[data-local-existing-plan]').count(),data.measurementRevision.localExistingPlans.length);
      const figure=page.locator('[data-local-existing-plan="suite-bath-existing"]');
      await figure.scrollIntoViewIfNeeded();
      const text=await figure.textContent();for(const number of ['2400','1010','1390','1320','1530','210'])assert(text.includes(number));
      assert(await figure.locator('.existing-plan-scroll').evaluate(el=>el.scrollWidth<=el.clientWidth),'entire local outline fits mobile without hiding its east edge');
      assert.equal(await page.locator('#floor-plan [data-local-existing-plan]').count(),0,'existing survey does not replace renovation plan');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no page overflow');
      if(screenshotDir){fs.mkdirSync(screenshotDir,{recursive:true});await page.screenshot({path:path.join(screenshotDir,`${scheme}-${width}-existing.png`)});}
      await page.locator('#measurement-dialog .dialog-close').click();
      await page.locator('#room-nav [data-room="room_a"]').click();
      assert.equal(await page.locator('#workspace').evaluate(el=>el.classList.contains('measurement-room-warning')),Boolean(data.measurementRevision.roomDescriptions.room_a.notice));
      const actualWidth=await page.locator('[data-bay-frame-layer="window_a"] [data-bay-glass]').evaluate(w=>Math.round(Math.hypot(w.x2.baseVal.value-w.x1.baseVal.value,w.y2.baseVal.value-w.y1.baseVal.value)*10));
      const masterWindow=data.windows.find(window=>window.id==='window_a'),expectedWidth=Math.round(Math.hypot(masterWindow.x2-masterWindow.x1,masterWindow.y2-masterWindow.y1)*10);
      assert.equal(actualWidth,expectedWidth,'plan matches current master window source, no obsolete width constant');
      await checkDownloadedPlan(page,data,`${scheme}/${width}`,screenshotDir);
      if(native){
        await page.locator('.view-tabs [data-view="model"]').click();
        assert(await page.evaluate(()=>window.__measurementR2QA.modelReady),'native viewer remains ready after all UI interactions');
        if(screenshotDir)await page.screenshot({path:path.join(screenshotDir,`${scheme}-${width}-native-master.png`)});
      }
      assert.deepEqual(errors,[],`${scheme}/${width}: no runtime errors`);
      console.log(`PASS ${scheme}/${width}: bath warning in 3 views, hidden card, enlarged render, project; separate actual-source local plan; downloaded SVG includes measured/placeholder/location notes without overflow; master width${expectedWidth}${native?'; actual final GLB loaded, served asset hashes + current/old render provenance checked':' (UI-only, GLB blocked)'}`);
      await page.close();
    }
  }finally{await browser.close()}
}
async function main(){
  const audited=native||process.argv.includes('--sources-only')?auditFinalSources():null;
  if(native||process.argv.includes('--browser'))await browserTest(audited);
}
main().catch(error=>{console.error(error);process.exitCode=1});
