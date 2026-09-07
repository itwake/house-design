// Visual smoke test for this project's own tab via its local Chrome DevTools endpoint.
// node tools/qa_studio.mjs PORT TAB_ID [desktop|mobile] [model|plan|renders]
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const [port, tabId, mode = 'desktop', view = 'model'] = process.argv.slice(2);
if (!/^\d+$/.test(port || '') || !tabId) throw new Error('Pass a local debugging port and this project tab ID');
if (!['desktop','mobile'].includes(mode) || !['model','plan','renders'].includes(view)) throw new Error('Use desktop/mobile and model/plan/renders');
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find(t => t.id === tabId);
if (!target || !/^(http:\/\/127\.0\.0\.1:4173\/|https:\/\/itwake\.github\.io\/house-design\/)/.test(target.url)) throw new Error('Refusing to test a non-project tab');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, {once:true}); ws.addEventListener('error', reject, {once:true}); });
let nextId = 0;
const pending = new Map(), exceptions = [];
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject, timer } = pending.get(message.id); pending.delete(message.id); clearTimeout(timer);
    if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
  }
});
function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 30000);
    pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({id, method, params}));
  });
}
async function evaluate(expression) {
  const r = await call('Runtime.evaluate', {expression, returnByValue:true});
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  await call('Runtime.enable'); await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', {width:mode === 'mobile' ? 390 : 1440, height:mode === 'mobile' ? 844 : 1000, deviceScaleFactor:1, mobile:mode === 'mobile'});
  await call('Page.reload', {ignoreCache:true});
  const until = Date.now() + 45000;
  while (Date.now() < until) {
    if (await evaluate('document.querySelector("#model-loading")?.hidden === true')) break;
    await pause(400);
  }
  if (view !== 'model') await evaluate(`document.querySelector('[data-view="${view}"]').click()`);
  await pause(800);
  const result = await evaluate(`({title:document.title,view:document.querySelector('#workspace').dataset.view,modelLoaded:document.querySelector('#model-loading').hidden,fallback:!document.querySelector('#model-fallback').hidden,roomButtons:document.querySelectorAll('#room-nav [data-room]').length,overflow:document.documentElement.scrollWidth>innerWidth+2,canvas:[document.querySelector('canvas')?.width,document.querySelector('canvas')?.height],brokenVisibleImages:[...document.images].filter(i=>i.getClientRects().length&&i.complete&&!i.naturalWidth).map(i=>i.getAttribute('src'))})`);
  const shot = await call('Page.captureScreenshot', {format:'png', captureBeyondViewport:false});
  await mkdir('tmp', {recursive:true});
  const out = path.resolve(`tmp/qa-${mode}-${view}.png`);
  await writeFile(out, Buffer.from(shot.data, 'base64'));
  console.log(JSON.stringify({...result, exceptions, screenshot:out}, null, 2));
  if (!result.modelLoaded || result.fallback || result.overflow || result.brokenVisibleImages.length || exceptions.length) process.exitCode = 1;
} finally {
  await call('Emulation.clearDeviceMetricsOverride').catch(() => {});
  ws.close();
}
