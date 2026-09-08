// Exercise only a dedicated local project tab; never navigates reference links or downloads files.
// node tools/qa_bay_ui.mjs PORT TAB_ID [--images]
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const [port,tabId,...flags]=process.argv.slice(2),requireImages=flags.includes('--images');
if(!/^\d+$/.test(port||'')||!tabId)throw new Error('Pass a dedicated local debugging port and project tab ID');
const target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.id===tabId);
if(!target||!/^http:\/\/127\.0\.0\.1:4173\//.test(target.url))throw new Error('Refusing to operate a non-project tab');
const source=JSON.parse(await readFile('models/design-data.json','utf8'));
const appSource=await readFile('studio.js','utf8'),assetRevision=appSource.match(/ASSET_REVISION = '([^']+)'/)[1],screenshotPrefix='v'+assetRevision.replaceAll('.','');
const imageHashes=requireImages?Object.fromEntries(await Promise.all(['overall','master','bedroom-b','bay-master','bay-tea','bay-living'].map(async name=>{const file=`assets/blender-renders/${name}.jpg`;return[file,createHash('sha256').update(await readFile(file)).digest('hex')]}))):{};
const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
let nextId=0;const pending=new Map(),exceptions=[],checks=[],screenshots=[];
ws.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails);if(pending.has(message.id)){const{resolve,reject,timer}=pending.get(message.id);pending.delete(message.id);clearTimeout(timer);message.error?reject(new Error(JSON.stringify(message.error))):resolve(message.result)}});
function call(method,params={}){return new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`${method} timed out`))},30000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}))})}
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function check(name,pass,detail){checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});console.log(`${pass?'PASS':'FAIL'} ${name}${!pass&&detail?' '+JSON.stringify(detail):''}`)}
async function click(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await pause(100)}
async function shot(name){const r=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const out=path.resolve(`tmp/${screenshotPrefix}-${name}.png`);await writeFile(out,Buffer.from(r.data,'base64'));screenshots.push(out)}
async function waitFor(expression,timeout=45000){const until=Date.now()+timeout;while(Date.now()<until){if(await evaluate(expression))return true;await pause(300)}return false}
async function layout(selector){return evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,overflow:e.scrollWidth>e.clientWidth+2,visible:!!e.getClientRects().length,inside:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1}})()`)}
async function closeDialogs(){await evaluate(`document.querySelectorAll('dialog[open]').forEach(d=>d.close())`)}
async function validateSVG(text,label){
  const actual=await evaluate(`(()=>{const d=new DOMParser().parseFromString(${JSON.stringify(text)},'image/svg+xml');return{parts:[...d.querySelectorAll('[data-part-id]')].map(p=>({id:p.getAttribute('data-part-id'),fitout:p.getAttribute('data-fitout-id'),bbox:['x','y','width','height'].map(k=>+p.getAttribute(k))})),bays:d.querySelectorAll('[data-bay-window]').length,frames:[...d.querySelectorAll('[data-bay-front-frame]')].map(p=>p.getAttribute('fill')),suiteDoor:d.querySelector('[data-opening-id="door_bath_1"]')?.outerHTML,bedHeads:[...d.querySelectorAll('[data-head-direction]')].map(e=>e.getAttribute('data-head-direction')),text:d.documentElement.textContent}})()`);
  const expected=source.bayFitouts.flatMap(f=>f.parts.map(p=>({id:p.id,fitout:f.id,bbox:[p.x,p.y,p.w,p.d]})));
  check(`${label}: all ${expected.length} part bounding boxes`,actual.parts.length===expected.length&&expected.every(p=>actual.parts.some(a=>JSON.stringify(p)===JSON.stringify(a))),actual.parts);
  check(`${label}: three warm-gray bay frames`,actual.bays===3&&actual.frames.every(fill=>fill==='#96948d'),actual.frames);
  check(`${label}: suite north opening retained`,/x1="432"/.test(actual.suiteDoor)&&/y1="328"/.test(actual.suiteDoor),actual.suiteDoor);
  return actual;
}

await mkdir('tmp',{recursive:true});
try{
  await call('Runtime.enable');await call('Page.enable');await call('Performance.enable');await call('Network.enable');await call('Network.setCacheDisabled',{cacheDisabled:true});
  for(const mode of ['desktop','mobile']){
    await closeDialogs();
    await call('Emulation.setDeviceMetricsOverride',{width:mode==='mobile'?390:1440,height:mode==='mobile'?844:1000,deviceScaleFactor:1,mobile:mode==='mobile'});
    await evaluate(`history.replaceState(null,'',location.pathname+'?v=${assetRevision}')`);
    await call('Page.reload',{ignoreCache:true});
    const ready=await waitFor(`document.querySelector('#model-loading')?.hidden===true&&document.querySelectorAll('[data-fitout-card]').length===3`);
    check(`${mode}: 3D loaded without fallback`,ready&&await evaluate(`document.querySelector('#model-fallback').hidden`));
    if(requireImages){
      const actualHashes=await evaluate(`(async()=>Object.fromEntries(await Promise.all(${JSON.stringify(Object.keys(imageHashes))}.map(async path=>{const u=new URL(path,document.baseURI);u.searchParams.set('v',${JSON.stringify(assetRevision)});const response=await fetch(u,{cache:'no-store'});const bytes=await response.arrayBuffer();return[path,[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('')]}))))()`);
      for(const [file,hash]of Object.entries(imageHashes))check(`${mode}: browser/disk SHA ${file}`,actualHashes[file]===hash,{expected:hash,actual:actualHashes[file]});
    }
    await pause(1000);
    check(`${mode}: no document overflow`,await evaluate(`document.documentElement.scrollWidth<=innerWidth+2`));
    check(`${mode}: bay room-card entry in viewport`,(await layout('#view-bay-fitout')).inside,await layout('#view-bay-fitout'));
    await shot(`${mode}-model`);
    const before=Object.fromEntries((await call('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));await pause(1500);
    const after=Object.fromEntries((await call('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
    check(`${mode}: idle layout stable`,after.LayoutCount-before.LayoutCount<=1,{layouts:after.LayoutCount-before.LayoutCount,recalc:after.RecalcStyleCount-before.RecalcStyleCount,taskSeconds:after.TaskDuration-before.TaskDuration});
    await click('[data-view="plan"]');
    await validateSVG(await evaluate(`document.querySelector('#floor-plan svg').outerHTML`),`${mode} live SVG`);
    await shot(`${mode}-plan`);
    const exported=await evaluate(`(async()=>{const original={create:URL.createObjectURL,open:window.open,click:HTMLAnchorElement.prototype.click};let blob,opened=0,downloaded=0;try{URL.createObjectURL=b=>{blob=b;return 'blob:qa-no-navigation'};window.open=()=>{opened++;return{}};HTMLAnchorElement.prototype.click=function(){downloaded++};document.querySelector('#open-plan').click();const openText=await blob.text();document.querySelector('#download-plan').click();const downloadText=await blob.text();return{openText,downloadText,opened,downloaded,view:document.querySelector('#workspace').dataset.view}}finally{URL.createObjectURL=original.create;window.open=original.open;HTMLAnchorElement.prototype.click=original.click}})()`);
    check(`${mode}: open/download SVG preserve page`,exported.opened===1&&exported.downloaded===1&&exported.openText===exported.downloadText&&exported.view==='plan');
    const exportResult=await validateSVG(exported.openText,`${mode} exported SVG`);
    check(`${mode}: exported conditional heights`,/430mm/.test(exportResult.text)&&/900mm/.test(exportResult.text)&&/非施工图/.test(exportResult.text));
    await click('[data-view="model"]');await click('#view-bay-fitout');
    const initial=await layout('#bay-dialog');check(`${mode}: dialog fits viewport`,initial.inside&&!initial.overflow,initial);
    const refs=await evaluate(`([...document.querySelectorAll('#bay-dialog a[href]')].map(a=>({href:a.href,target:a.target,rel:a.rel})))`);
    check(`${mode}: all ten original links safe/exact`,refs.length===source.designReferences.length&&source.designReferences.every(r=>refs.some(a=>a.href===r.url&&a.target==='_blank'&&a.rel.includes('noopener')&&a.rel.includes('noreferrer'))),refs);
    const masterFitout=source.bayFitouts.find(f=>f.roomId==='room_a');
    check(`${mode}: current master summary and conditions shown`,await evaluate(`(()=>{const t=document.querySelector('[data-fitout-card="${masterFitout.id}"]').textContent;return ${JSON.stringify([masterFitout.summary,...masterFitout.dimensions,...masterFitout.conditions])}.every(text=>t.includes(text))})()`));
    check(`${mode}: master has one desktop and chair`,await evaluate(`(()=>{const p=[...document.querySelectorAll('#floor-plan [data-fitout-id="${masterFitout.id}"]')];return p.filter(e=>e.dataset.fitoutRole==='desktop').length===1&&p.filter(e=>e.dataset.fitoutRole==='chair').length===1})()`));
    check(`${mode}: low tea seat clearly conditional`,await evaluate(`(()=>{const t=document.querySelector('[data-fitout-card="bay_b_tea"]').textContent;return t.includes('430')&&t.includes('900')&&t.includes('取消坐人')&&t.includes('条件')})()`));
    if(requireImages){
      const visibleImages=`[...document.querySelectorAll('#bay-fitout-cards img')].filter(i=>{const r=i.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight})`;
      check(`${mode}: visible overview renders ready`,await waitFor(`(${visibleImages}).every(i=>i.complete&&i.naturalWidth>0&&!i.parentElement.disabled)`,15000));
      await evaluate(`Promise.all((${visibleImages}).map(i=>i.decode().catch(()=>{})))`);
    }
    await shot(`${mode}-bay-overview`);
    for(const fitout of source.bayFitouts){
      await evaluate(`(()=>{const card=document.querySelector('[data-fitout-card="${fitout.id}"]');card.querySelector('details').open=true;card.scrollIntoView({block:'start'})})()`);
      await pause(250);
      check(`${mode}: ${fitout.id} has no horizontal overflow`,!(await layout(`[data-fitout-card="${fitout.id}"]`)).overflow);
      const close=await layout('#bay-dialog>.dialog-close');check(`${mode}: ${fitout.id} close reachable`,close.inside,close);
      if(requireImages){
        const loaded=await waitFor(`(()=>{const i=document.querySelector('[data-fitout-card="${fitout.id}"] img');return i.complete&&i.naturalWidth>0})()`,10000);
        check(`${mode}: ${fitout.id} Blender image loaded`,loaded);
        if(loaded){await click(`[data-fitout-render="${fitout.id}"]`);await waitFor(`document.querySelector('#large-render').complete&&document.querySelector('#large-render').naturalWidth>0`,10000);await evaluate(`document.querySelector('#large-render').decode().catch(()=>{})`);check(`${mode}: ${fitout.id} image modal`,await evaluate(`document.querySelector('#image-dialog').open&&document.querySelector('#bay-dialog').open&&document.querySelector('#large-render-caption').textContent.includes('条件方案')`));check(`${mode}: ${fitout.id} image close reachable`,(await layout('#image-dialog>.dialog-close')).inside);await shot(`${mode}-${fitout.id}-image`);await click('#image-dialog>.dialog-close');check(`${mode}: image closes back to bay panel`,await evaluate(`document.querySelector('#bay-dialog').open&&!document.querySelector('#image-dialog').open`))}
      }
      await shot(`${mode}-${fitout.id}-conditions`);
      await click(`[data-fitout-room="${fitout.roomId}"]`);await pause(1000);
      check(`${mode}: ${fitout.id} returns to matching model`,await evaluate(`!document.querySelector('#bay-dialog').open&&location.hash==='#${fitout.roomId}'&&document.querySelector('#workspace').dataset.view==='model'`));
      if(fitout.roomId==='room_a')check(`${mode}: master room card follows source summary`,await evaluate(`document.querySelector('#card-description').textContent.includes(${JSON.stringify(fitout.summary)})`));
      if(fitout.roomId==='room_b')check(`${mode}: B room card confirms ordinary desk removal`,await evaluate(`document.querySelector('#card-description').textContent.includes('取消独立书桌和办公椅')&&!document.querySelector('#card-description').textContent.includes('独立书桌保留')`));
      check(`${mode}: ${fitout.id} room card action visible`,(await layout('#view-bay-fitout')).inside,await layout('#view-bay-fitout'));
      await click('#view-bay-fitout');
      check(`${mode}: matching card expanded`,await evaluate(`document.querySelector('[data-fitout-card="${fitout.id}"]').classList.contains('is-current')&&document.querySelector('[data-fitout-card="${fitout.id}"] details').open`));
    }
    await evaluate(`document.querySelector('#bay-dialog').scrollTop=document.querySelector('#bay-dialog').scrollHeight`);await pause(100);
    check(`${mode}: footer close still visible`,(await layout('#bay-dialog>.dialog-close')).inside,await layout('#bay-dialog>.dialog-close'));
    await shot(`${mode}-bay-safety`);await click('#bay-dialog>.dialog-close');
    await click('#open-project');await click('#project-bay-link');
    check(`${mode}: design-notes link transitions to bay`,await evaluate(`document.querySelector('#bay-dialog').open&&!document.querySelector('#project-dialog').open`));
    await closeDialogs();
  }
  check('no uncaught browser exceptions',exceptions.length===0,exceptions);
}catch(error){checks.push({name:'test runner completed',pass:false,detail:error.stack});console.error(error.stack)}
finally{
  await closeDialogs().catch(()=>{});await call('Emulation.clearDeviceMetricsOverride').catch(()=>{});await call('Network.setCacheDisabled',{cacheDisabled:false}).catch(()=>{});ws.close();
  const report={at:new Date().toISOString(),version:assetRevision,port,tabId,requireImages,passed:checks.every(c=>c.pass),checks,exceptions,screenshots};
  const reportPath=path.resolve(`tmp/qa-bay-ui${requireImages?'-images':''}.json`);await writeFile(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:checks.length,failures:checks.filter(c=>!c.pass),report:reportPath,screenshots},null,2));if(!report.passed)process.exitCode=1;
}
