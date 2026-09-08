// Dedicated local project tab only. Exercises the room-card visibility preference.
// node tools/qa_card_visibility.mjs PORT TAB_ID
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';

const [port, tabId] = process.argv.slice(2);
if (!/^\d+$/.test(port || '') || !tabId) throw new Error('Pass a dedicated debugging port and local project tab ID');
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find(t => t.id === tabId);
if (!target || !/^http:\/\/127\.0\.0\.1:4173\//.test(target.url)) throw new Error('Refusing to operate a non-local-project tab');
const appSource = await readFile('studio.js', 'utf8');
const version = appSource.match(/UI_REVISION = '([^']+)'/)?.[1] || appSource.match(/ASSET_REVISION = '([^']+)'/)?.[1] || 'unknown';
const prefix = `v${version.replaceAll('.', '')}-card`;
const key = 'house-design:room-card-visible';
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, {once: true});
  ws.addEventListener('error', reject, {once: true});
});
let nextId = 0;
const pending = new Map(), checks = [], screenshots = [], exceptions = [];
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id); clearTimeout(request.timer);
  message.error ? request.reject(new Error(JSON.stringify(message.error))) : request.resolve(message.result);
});
function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId, timer = setTimeout(() => {pending.delete(id); reject(new Error(`${method} timed out`));}, 30000);
    pending.set(id, {resolve, reject, timer}); ws.send(JSON.stringify({id, method, params}));
  });
}
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function check(name, pass, detail) {
  checks.push({name, pass: !!pass, ...(detail === undefined ? {} : {detail})});
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${!pass && detail ? ' ' + JSON.stringify(detail) : ''}`);
}
async function waitFor(expression, timeout = 60000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {if (await evaluate(expression)) return true; await pause(250);}
  return false;
}
async function ready() {
  if (!await waitFor(`document.querySelector('#toggle-room-card') && document.querySelector('#floor-plan svg') && document.querySelector('#model-loading')?.hidden`)) throw new Error('Application did not finish loading');
  await pause(250);
}
async function bounds(selector) {
  return evaluate(`(() => {const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; const r = e.getBoundingClientRect(), c = getComputedStyle(e), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,visible:!!e.getClientRects().length&&c.display!=='none'&&c.visibility!=='hidden',inside:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,clickable:!!hit&&(hit===e||e.contains(hit))};})()`);
}
async function click(selector) {
  const r = await bounds(selector);
  if (!r?.visible || !r.inside || !r.clickable) throw new Error(`Not an accessible click target: ${selector}: ${JSON.stringify(r)}`);
  const coords = {x: r.x + r.width / 2, y: r.y + r.height / 2};
  await call('Input.dispatchMouseEvent', {type: 'mousePressed', button: 'left', clickCount: 1, ...coords});
  await call('Input.dispatchMouseEvent', {type: 'mouseReleased', button: 'left', clickCount: 1, ...coords});
  await pause(180);
}
async function selectRoom(id) {
  const selector = `#room-nav [data-room="${id}"]`;
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest',inline:'nearest'})`);
  await click(selector);
}
async function snapshot(name) {
  const image = await call('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
  const file = path.resolve(`tmp/${prefix}-${name}.png`);
  await writeFile(file, Buffer.from(image.data, 'base64')); screenshots.push(file);
}
async function assertVisibility(label, visible, {stored = true} = {}) {
  const actual = await evaluate(`(() => {const card=document.querySelector('#room-card'), outer=document.querySelector('#toggle-room-card'), inline=document.querySelector('#room-card-toggle'); return {hidden:card.hidden,display:getComputedStyle(card).display,rects:card.getClientRects().length,collapsed:card.classList.contains('collapsed'),workspaceHidden:document.querySelector('#workspace').classList.contains('card-hidden'),outerExpanded:outer.getAttribute('aria-expanded'),inlineExpanded:inline.getAttribute('aria-expanded'),outerControls:outer.getAttribute('aria-controls'),inlineControls:inline.getAttribute('aria-controls'),outerText:outer.textContent.trim(),inlineText:inline.textContent.trim(),stored:sessionStorage.getItem(${JSON.stringify(key)})};})()`);
  check(`${label}: real card visibility and workspace state`, actual.hidden === !visible && actual.workspaceHidden === !visible && (visible ? actual.rects > 0 && actual.display !== 'none' : actual.rects === 0 && actual.display === 'none'), actual);
  check(`${label}: synchronized accessible controls`, actual.outerExpanded === String(visible) && actual.inlineExpanded === String(visible) && actual.outerControls === 'room-card' && actual.inlineControls === 'room-card' && actual.outerText.includes(visible ? '隐藏说明' : '显示说明') && actual.inlineText.includes('隐藏说明'), actual);
  check(`${label}: old partial collapse removed`, !actual.collapsed);
  if (stored) check(`${label}: session preference`, actual.stored === String(visible), actual.stored);
  const control = await bounds('#toggle-room-card');
  check(`${label}: persistent control remains reachable`, control?.visible && control.inside && control.clickable, control);
}
async function assertNoCardObstruction(label, oldRect) {
  const probes = await evaluate(`(() => {const card=document.querySelector('#room-card'); return ${JSON.stringify([.2, .5, .8].flatMap(a => [.25, .55, .8].map(b => ({x: oldRect.x + oldRect.width * a, y: oldRect.y + oldRect.height * b})) ))}.map(p=>{const hit=document.elementFromPoint(p.x,p.y);return {...p,hit:hit?.tagName,id:hit?.id,blocked:!!hit&&(hit===card||card.contains(hit)),canvas:!!hit?.closest('#model-canvas')};});})()`);
  check(`${label}: former card area no longer captures hits`, probes.every(p => !p.blocked) && probes.some(p => p.canvas), probes);
  const canvasPoint = probes.find(p => p.canvas);
  if (!canvasPoint) return;
  await evaluate(`window.__qaCardCanvasPointer=false;document.querySelector('#model-canvas').addEventListener('pointerdown',()=>{window.__qaCardCanvasPointer=true},{once:true,capture:true})`);
  await call('Input.dispatchMouseEvent', {type: 'mousePressed', button: 'left', clickCount: 1, x: canvasPoint.x, y: canvasPoint.y});
  await call('Input.dispatchMouseEvent', {type: 'mouseReleased', button: 'left', clickCount: 1, x: canvasPoint.x, y: canvasPoint.y});
  check(`${label}: pointer input reaches model in freed area`, await evaluate(`window.__qaCardCanvasPointer === true`));
  await evaluate(`delete window.__qaCardCanvasPointer`);
}

await mkdir('tmp', {recursive: true});
try {
  await call('Runtime.enable'); await call('Page.enable'); await call('Network.enable');
  await call('Network.setCacheDisabled', {cacheDisabled: true});
  for (const viewport of [
    {name:'desktop',width:1440,height:1000,mobile:false},
    {name:'mobile',width:390,height:844,mobile:true},
    {name:'narrow',width:320,height:640,mobile:true},
    {name:'landscape',width:844,height:390,mobile:true},
  ]) {
    const label = viewport.name;
    try {
    await evaluate(`document.querySelectorAll('dialog[open]').forEach(d=>d.close());sessionStorage.removeItem(${JSON.stringify(key)});history.replaceState(null,'',location.pathname+'?v=${version}#room_a')`);
    await call('Emulation.setDeviceMetricsOverride', {width:viewport.width,height:viewport.height,mobile:viewport.mobile,deviceScaleFactor:1});
    await call('Page.reload', {ignoreCache: true}); await ready();
    await assertVisibility(`${label} initial`, true, {stored:false});
    check(`${label}: no document horizontal overflow`, await evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`));
    const visibleRect = await bounds('#room-card');
    check(`${label}: visible card fits workspace`, visibleRect?.visible && visibleRect.inside, visibleRect);
    await snapshot(`${label}-visible`);
    await click('#room-card-toggle');
    await assertVisibility(`${label} inline hide`, false);
    await assertNoCardObstruction(`${label} hidden model`, visibleRect);
    await snapshot(`${label}-hidden`);
    await selectRoom('room_b');
    await assertVisibility(`${label} room navigation retains hidden`, false);
    check(`${label}: room selection worked while card hidden`, await evaluate(`location.hash === '#room_b'`));
    await click('#toggle-room-card');
    await assertVisibility(`${label} external restore`, true);
    await click('[data-view="plan"]');
    const smallPlan = await bounds('.plan-paper');
    await click('#toggle-room-card');
    await assertVisibility(`${label} plan hide`, false);
    const largePlan = await bounds('.plan-paper');
    check(`${label}: hiding card enlarges usable plan`, largePlan.width * largePlan.height > smallPlan.width * smallPlan.height + 20 && largePlan.inside, {before:smallPlan,after:largePlan});
    await snapshot(`${label}-plan-hidden`);
    await click('[data-view="renders"]');
    const renderButton = await bounds('#toggle-room-card'), renderCard = await bounds('#room-card');
    check(`${label}: render view hides both card and toggle`, !renderButton.visible && !renderCard.visible, {renderButton,renderCard});
    await click('[data-view="model"]');
    await assertVisibility(`${label} render roundtrip retains hidden`, false);
    await call('Page.reload', {ignoreCache:true}); await ready();
    await assertVisibility(`${label} reload retains hidden`, false);
    await click('#toggle-room-card');
    await assertVisibility(`${label} final restore`, true);
    await call('Page.reload', {ignoreCache:true}); await ready();
    await assertVisibility(`${label} reload retains visible`, true);
    await snapshot(`${label}-restored`);
    } catch (error) {
      checks.push({name:`${label}: scenario completed`,pass:false,detail:error.stack});
      console.error(`${label}: ${error.stack}`);
      await snapshot(`${label}-failure`).catch(()=>{});
    }
  }
  check('No uncaught browser exceptions', exceptions.length === 0, exceptions);
} catch (error) {
  checks.push({name:'Test runner completed',pass:false,detail:error.stack});
  console.error(error.stack);
} finally {
  await evaluate(`document.querySelectorAll('dialog[open]').forEach(d=>d.close());sessionStorage.removeItem(${JSON.stringify(key)});delete window.__qaCardCanvasPointer;history.replaceState(null,'',location.pathname+'?v=${version}')`).catch(()=>{});
  await call('Emulation.clearDeviceMetricsOverride').catch(()=>{});
  await call('Network.setCacheDisabled', {cacheDisabled:false}).catch(()=>{});
  await call('Page.reload').catch(()=>{});
  ws.close();
  const report = {at:new Date().toISOString(),version,port,tabId,passed:checks.every(c=>c.pass),checks,exceptions,screenshots};
  const file = path.resolve('tmp/qa-card-visibility.json');
  await writeFile(file, JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:report.passed,checks:checks.length,failures:checks.filter(c=>!c.pass),report:file,screenshots},null,2));
  if (!report.passed) process.exitCode = 1;
}
