// Dedicated localhost project tab only; does not follow references, download files, or touch other tabs.
// node tools/qa_design_schemes.mjs PORT TAB_ID [--images]
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const [port,tabId,...flags]=process.argv.slice(2),images=flags.includes('--images');
if(!/^\d+$/.test(port||'')||!tabId)throw Error('Pass dedicated CDP port and project tab');
const base='http://127.0.0.1:4173/',target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.id===tabId&&t.url.startsWith(base));
if(!target)throw Error('Refusing non-project tab');
const catalog=JSON.parse(await readFile('models/design-schemes.json','utf8')),version=catalog.version,key='house-design:room-card-visible';
const views=['overall','living','dining','master','bedroom-b','study','kitchen','master-bath','guest-bath','balcony','bay-master','bay-tea','bay-living','entry-storage','sideboard'];
const hashes=images?Object.fromEntries(await Promise.all(catalog.schemes.flatMap(s=>views.map(view=>({scheme:s.id,file:`${s.id==='wood'?'assets/blender-renders':`assets/schemes/${s.id}`}/${view}.jpg`}))).map(async({scheme,file})=>[file,{scheme,sha:createHash('sha256').update(await readFile(file)).digest('hex')}]))):{};
const checks=[],exceptions=[],screenshots=[],pending=new Map();let serial=0,baselinePlan=null;
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
ws.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails);const p=pending.get(message.id);if(p){pending.delete(message.id);clearTimeout(p.timer);message.error?p.reject(Error(JSON.stringify(message.error))):p.resolve(message.result)}});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timeout'))},45000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}))});
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(expression,ms=45000){const end=Date.now()+ms;while(Date.now()<end){try{if(await evaluate(expression))return true}catch(error){if(!/context|navigat/i.test(String(error)))throw error}await pause(200)}return false}
async function navigate(relative){const url=new URL(relative,base);if(url.origin!==new URL(base).origin)throw Error('Out-of-scope navigation');await call('Page.navigate',{url:url.href})}
async function click(selector){await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(typeof e.click==='function')e.click();else e.dispatchEvent(new MouseEvent('click',{bubbles:true}))})()`);await pause(120)}
async function pointerClick(selector,{scroll=false}={}){
  if(scroll)await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',inline:'nearest'})`);
  if(!await evaluate(inView(selector)))throw Error('Target is not center-hit accessible: '+selector);
  const p=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});await pause(160);
}
function check(name,pass,detail){checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});console.log(`${pass?'PASS':'FAIL'} ${name}${!pass&&detail?' '+JSON.stringify(detail):''}`)}
async function screenshot(name){
  // Gallery/picker heroes exist before all room renders; always await their real decode.
  const visible=`[...document.querySelectorAll('.scheme-card-image img')].filter(i=>{const r=i.getBoundingClientRect();return r.width>0&&r.bottom>0&&r.top<innerHeight})`;
  const ready=await waitFor(`(${visible}).every(i=>i.complete&&i.naturalWidth>0)`,15000);check(`${name}: visible hero images loaded`,ready);
  if(ready)await evaluate(`Promise.all((${visible}).map(i=>i.decode().catch(()=>{})))`);
  const r=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}),out=path.resolve(`tmp/v310-${name}.png`);await writeFile(out,Buffer.from(r.data,'base64'));screenshots.push(out);
}
const schemeReady=id=>`document.documentElement?.dataset.scheme===${JSON.stringify(id)}&&document.querySelector('#model-loading')?.hidden===true&&document.querySelectorAll('#floor-plan [data-plan-room]').length>0`;
const inView=selector=>`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return !!e.getClientRects().length&&r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&(hit===e||e.contains(hit))})()`;
const coordinateExpression=`JSON.stringify([...document.querySelectorAll('#floor-plan svg polygon,#floor-plan svg rect,#floor-plan svg line,#floor-plan svg path,#floor-plan svg ellipse,#floor-plan svg circle')].map(e=>[e.tagName,...['x','y','width','height','x1','y1','x2','y2','points','d','cx','cy','r','rx','ry','transform'].map(k=>e.getAttribute(k))]))`;
const modes=[['desktop',1440,1000],['mobile',390,844],['narrow',320,640],['landscape',844,390]];
await mkdir('tmp',{recursive:true});
let savedPreference;
try{
  await call('Runtime.enable');await call('Page.enable');await call('Network.enable');await call('Network.setCacheDisabled',{cacheDisabled:true});savedPreference=await evaluate(`sessionStorage.getItem(${JSON.stringify(key)})`);
  for(const [mode,width,height]of modes){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:mode!=='desktop'});
    await navigate('?v='+version);check(`${mode}: gallery four cards ready`,await waitFor(`document.querySelectorAll('#scheme-grid [data-scheme-card]').length===4`));
    check(`${mode}: gallery no horizontal overflow`,await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`));
    const cards=await evaluate(`([...document.querySelectorAll('#scheme-grid [data-scheme-card]')].map(c=>({id:c.dataset.schemeCard,href:c.querySelector('.scheme-enter').href,swatches:c.querySelectorAll('.scheme-swatch').length,src:c.querySelector('img').src})))`);
    check(`${mode}: gallery exact schemes and images`,cards.length===4&&catalog.schemes.every(s=>cards.some(c=>c.id===s.id&&new URL(c.href).searchParams.get('scheme')===s.id&&c.swatches===s.colors.length&&new URL(c.src).pathname==='/'+s.hero)),cards);
    for(const scheme of catalog.schemes){
      const refs=await evaluate(`[...document.querySelectorAll('#scheme-grid [data-scheme-card="${scheme.id}"] .scheme-references a')].map(a=>({id:a.dataset.schemeReferenceId,href:a.href,target:a.target,rel:a.rel,text:a.textContent}))`),expected=scheme.references.map(id=>catalog.references.find(r=>r.id===id));
      check(`${mode}/${scheme.id}: gallery reference links exact and safe`,refs.length===expected.length&&expected.every(r=>refs.some(a=>a.id===r.id&&a.href===r.url&&a.text.includes(r.title)&&a.target==='_blank'&&a.rel.includes('noopener')&&a.rel.includes('noreferrer'))),refs);
      if(images){const selector=`#scheme-grid [data-scheme-card="${scheme.id}"] .scheme-references summary`;await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);check(`${mode}/${scheme.id}: reference summary hit accessible`,await evaluate(inView(selector)));await pointerClick(selector);check(`${mode}/${scheme.id}: reference details opens`,await evaluate(`document.querySelector('#scheme-grid [data-scheme-card="${scheme.id}"] .scheme-references').open`));await pointerClick(selector,{scroll:true})}
    }
    await evaluate('scrollTo(0,0)');
    if(images){
      for(const scheme of catalog.schemes){await evaluate(`document.querySelector('#scheme-grid [data-scheme-card="${scheme.id}"]').scrollIntoView({block:'center'})`);check(`${mode}: ${scheme.id} gallery hero decodes`,await waitFor(`(()=>{const i=document.querySelector('#scheme-grid [data-scheme-card="${scheme.id}"] img');return i.complete&&i.naturalWidth>0})()`,15000))}
      await evaluate('scrollTo(0,0)');
    }
    await screenshot(`${mode}-gallery`);await evaluate(`document.querySelector('#scheme-grid>article:last-child').scrollIntoView({block:'start'})`);await pause(150);await screenshot(`${mode}-gallery-last`);
    for(const scheme of catalog.schemes){
      await evaluate(`sessionStorage.setItem(${JSON.stringify(key)},'true')`);await navigate(`studio.html?scheme=${scheme.id}&v=${version}`);
      check(`${mode}/${scheme.id}: model loaded`,await waitFor(schemeReady(scheme.id))&&await evaluate(`document.querySelector('#model-fallback').hidden`));
      check(`${mode}/${scheme.id}: viewer no horizontal overflow`,await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`));
      check(`${mode}/${scheme.id}: scheme switch visible`,await evaluate(inView('#change-scheme')));
      check(`${mode}/${scheme.id}: header actions stay single line`,await evaluate(`['#change-scheme','#open-project','#download-toggle'].every(s=>{const e=document.querySelector(s);return getComputedStyle(e).whiteSpace==='nowrap'&&e.getBoundingClientRect().height<=44})`));
      check(`${mode}/${scheme.id}: exact title and downloads`,await evaluate(`document.querySelector('.brand strong').textContent===${JSON.stringify(scheme.name)}&&new URL(document.querySelector('#download-glb').href).pathname===${JSON.stringify('/'+scheme.model)}&&new URL(document.querySelector('#download-blend').href).pathname===${JSON.stringify('/'+scheme.blend)}`));
      check(`${mode}/${scheme.id}: plan color simplification explained`,await evaluate(`document.querySelector('#plan-scheme-note').textContent.includes('不是逐块柜门材料表')&&document.querySelector('#plan-scheme-note').textContent.includes('同一坐标')`));
      const prefix=scheme.id==='wood'?'/assets/blender-renders/':`/assets/schemes/${scheme.id}/`;
      check(`${mode}/${scheme.id}: all selected scheme renders isolated`,await evaluate(`[...document.querySelectorAll('#room-preview,#active-render,#render-strip img,#bay-fitout-cards img,#storage-fitout-cards img,#model-fallback img')].every(i=>new URL(i.src).pathname.startsWith(${JSON.stringify(prefix)}))`));
      if(scheme.id!=='wood')check(`${mode}/${scheme.id}: no inherited wood overview tag`,await evaluate(`!document.querySelector('#room-tags').textContent.includes('现代原木')`));
      if(images&&mode==='desktop'){
        const expected=Object.fromEntries(Object.entries(hashes).filter(([,value])=>value.scheme===scheme.id));
        const actual=await evaluate(`(async()=>Object.fromEntries(await Promise.all(${JSON.stringify(Object.keys(expected))}.map(async file=>{const url=new URL(file,document.baseURI);url.searchParams.set('v',${JSON.stringify(scheme.assetRevision)});const r=await fetch(url,{cache:'no-store'});return[file,r.ok?[...new Uint8Array(await crypto.subtle.digest('SHA-256',await r.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join(''):'HTTP '+r.status]}))))()`);
        for(const [file,{sha}]of Object.entries(expected))check(`${scheme.id}: image SHA ${file}`,actual[file]===sha,{expected:sha,actual:actual[file]});
      }
      await pause(600);await screenshot(`${mode}-${scheme.id}-model`);
      if(mode==='narrow'){
        const compact=await evaluate(`(()=>{const c=document.querySelector('#room-card'),w=document.querySelector('#workspace'),b=c.querySelector('.room-card-body'),p=document.querySelector('#card-description');return{cardHeight:c.getBoundingClientRect().height,workspaceHeight:w.clientHeight,bodyHeight:b.clientHeight,bodyScrollHeight:b.scrollHeight,overflow:getComputedStyle(b).overflowY,descriptionHeight:p.clientHeight}})()`);
        check(`${mode}/${scheme.id}: compact card at most 30 percent with readable scrolling body`,compact.cardHeight<=compact.workspaceHeight*.30+1&&compact.bodyHeight>0&&compact.descriptionHeight>0&&compact.overflow==='auto',compact);
        await evaluate(`document.querySelector('#enter-room').scrollIntoView({block:'nearest'})`);check(`${mode}/${scheme.id}: compact card enter button reachable by scrolling`,await evaluate(inView('#enter-room')));
        await screenshot(`${mode}-${scheme.id}-card-scrolled`);await evaluate(`document.querySelector('.room-card-body').scrollTop=0`);
      }
      await click('[data-view="plan"]');
      const coordinate=await evaluate(coordinateExpression);if(baselinePlan===null)baselinePlan=coordinate;check(`${mode}/${scheme.id}: exact same plan coordinates`,coordinate===baselinePlan);
      if(scheme.id!=='wood')check(`${mode}/${scheme.id}: active palette applied`,await evaluate(`document.querySelector('#floor-plan [data-plan-room="living"]').getAttribute('fill').toLowerCase()===${JSON.stringify(scheme.planPalette.floor.toLowerCase())}`));
      await click('#floor-plan [data-plan-room="room_a"]');
      if(scheme.id!=='wood'){const color=scheme.planPalette.cabinet,expected=`rgb(${[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)).join(', ')})`;check(`${mode}/${scheme.id}: selected room uses current palette`,await waitFor(`getComputedStyle(document.querySelector('#floor-plan [data-plan-room="room_a"]')).fill===${JSON.stringify(expected)}`,2000),{expected,actual:await evaluate(`getComputedStyle(document.querySelector('#floor-plan [data-plan-room="room_a"]')).fill`)})}
      await screenshot(`${mode}-${scheme.id}-plan`);await click('[data-view="model"]');
      check(`${mode}/${scheme.id}: card toggle center hit accessible`,await evaluate(inView('#toggle-room-card')));await pointerClick('#toggle-room-card');check(`${mode}/${scheme.id}: hide card control persists`,await evaluate(`document.querySelector('#room-card').hidden&&sessionStorage.getItem(${JSON.stringify(key)})==='false'`));
      if(mode==='narrow')await screenshot(`${mode}-${scheme.id}-card-hidden`);
      await pointerClick('#change-scheme');check(`${mode}/${scheme.id}: picker visible and no overflow`,await evaluate(`document.querySelector('#scheme-dialog').open&&document.querySelector('#scheme-dialog').scrollWidth<=document.querySelector('#scheme-dialog').clientWidth+1`)&&await evaluate(inView('#scheme-dialog>.dialog-close')));
      check(`${mode}/${scheme.id}: picker links preserve current room`,await evaluate(`[...document.querySelectorAll('#viewer-scheme-grid .scheme-enter')].every(a=>new URL(a.href).hash==='#room_a')`));
      const refs=await evaluate(`[...document.querySelectorAll('#scheme-current-references a')].map(a=>({href:a.href,target:a.target,rel:a.rel}))`),expectedRefs=scheme.references.map(id=>catalog.references.find(r=>r.id===id));check(`${mode}/${scheme.id}: current reference links exact/safe`,refs.length===expectedRefs.length&&expectedRefs.every(r=>refs.some(a=>a.href===r.url&&a.target==='_blank'&&a.rel.includes('noopener'))),refs);
      await screenshot(`${mode}-${scheme.id}-picker`);await pointerClick('#scheme-dialog>.dialog-close');
    }
    // Actual link navigation, not just URL inspection: cobalt -> terracotta at master bedroom.
    await pointerClick('#change-scheme');await pointerClick('#viewer-scheme-grid [data-scheme-card="terracotta"] .scheme-enter',{scroll:true});check(`${mode}: switching scheme retains room and hidden card`,await waitFor(schemeReady('terracotta'))&&await evaluate(`location.hash==='#room_a'&&document.querySelector('#room-card').hidden&&sessionStorage.getItem(${JSON.stringify(key)})==='false'`));
    await pointerClick('#toggle-room-card');check(`${mode}: card can reopen after scheme change`,await evaluate(`!document.querySelector('#room-card').hidden`));
  }
  await navigate('studio.html?scheme=does-not-exist&v='+version);check('unknown viewer scheme explicitly fails',await waitFor(`document.querySelector('#scheme-load-error')?.hidden===false`,10000)&&await evaluate(`!document.documentElement.dataset.scheme&&!document.querySelector('#model-canvas canvas')`));
  const before=exceptions.length;await click('[data-view="renders"]');await click('.brand');await click('#enter-room');await click('#change-scheme');check('catalog error controls do not throw',exceptions.length===before);await screenshot('unknown-scheme');
  await navigate('?scheme=does-not-exist#living');check('unknown gallery scheme is not replaced with wood',await waitFor(`document.querySelectorAll('#scheme-grid [data-scheme-card]').length===4`,10000)&&await evaluate(`!location.pathname.endsWith('studio.html')&&!document.querySelector('#gallery-status').hidden`));
  await navigate('#room_b');check('old root room hash opens wood with room retained',await waitFor(schemeReady('wood'))&&await evaluate(`location.pathname.endsWith('studio.html')&&location.hash==='#room_b'`));
  check('no uncaught browser exceptions',exceptions.length===0,exceptions);
}catch(error){checks.push({name:'runner completed',pass:false,detail:error.stack});console.error(error.stack)}
finally{
  await evaluate(`document.querySelectorAll('dialog[open]').forEach(d=>d.close());${savedPreference===null?`sessionStorage.removeItem(${JSON.stringify(key)})`:`sessionStorage.setItem(${JSON.stringify(key)},${JSON.stringify(savedPreference)})`}`).catch(()=>{});await call('Emulation.clearDeviceMetricsOverride').catch(()=>{});await call('Network.setCacheDisabled',{cacheDisabled:false}).catch(()=>{});ws.close();
  const report={at:new Date().toISOString(),version,images,port,tabId,passed:checks.every(c=>c.pass),checks,exceptions,screenshots},out=path.resolve(`tmp/qa-design-schemes${images?'-images':''}.json`);await writeFile(out,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:checks.length,failures:checks.filter(c=>!c.pass),report:out,screenshots},null,2));if(!report.passed)process.exitCode=1;
}
