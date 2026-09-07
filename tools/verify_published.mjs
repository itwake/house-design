// Verify this repository's deployed Pages assets through its own browser tab.
// node tools/verify_published.mjs LOCAL_CDP_PORT PROJECT_TAB_ID
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const [port, tabId] = process.argv.slice(2);
if (!/^\d+$/.test(port || '') || !tabId) throw new Error('Pass local CDP port and the published project tab ID');
const base = 'https://itwake.github.io/house-design/';
const localData = await readFile(new URL('../models/design-data.json', import.meta.url), 'utf8');
const sourceSha = createHash('sha256').update(localData.replace(/\r\n/g, '\n')).digest('hex');
const modelSha = createHash('sha256').update(await readFile(new URL('../models/huiyayuan-wood.glb', import.meta.url))).digest('hex');
const source = await readFile(new URL('../studio.js', import.meta.url), 'utf8');
const version = source.match(/ASSET_REVISION = '([^']+)'/)[1];
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find(t => t.id === tabId && t.url.startsWith(base));
if (!target) throw new Error('Refusing to inspect a non-project or unpublished tab');
const paths = ['', 'studio.js', 'studio.css', 'models/huiyayuan-wood.glb', 'models/huiyayuan-wood.blend', 'models/design-data.json', 'models/scene-manifest.json',
  ...['overall', 'living', 'dining', 'master', 'bedroom-b', 'study', 'kitchen', 'master-bath', 'guest-bath', 'balcony'].map(name => `assets/blender-renders/${name}.jpg`)];
const expression = `(async () => {
  const url = path => { const u = new URL(path, ${JSON.stringify(base)}); u.searchParams.set('v', ${JSON.stringify(version)}); return u; };
  const checks = await Promise.all(${JSON.stringify(paths)}.map(async path => { try { const r = await fetch(url(path), {method:'HEAD', signal:AbortSignal.timeout(15000)}); return [path, r.status === 200]; } catch { return [path, false]; } }));
  const [d, m, bytes] = await Promise.all([fetch(url('models/design-data.json')).then(r => r.json()), fetch(url('models/scene-manifest.json')).then(r => r.json()), fetch(url('models/huiyayuan-wood.glb')).then(r => r.arrayBuffer())]);
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
  checks.push(['source SHA matches local', m.sourceSha256 === ${JSON.stringify(sourceSha)}], ['GLB SHA matches local', digest === ${JSON.stringify(modelSha)}]);
  checks.push(['three bay windows', d.windows.filter(w=>w.windowType==='bay').length === 3], ['study south wall retained', JSON.stringify(d.walls[20]) === '[206,626,319,626]']);
  checks.push(['stepped bath wall', JSON.stringify(d.walls[21]) === '[516,469,516,493]'], ['main bath north door', d.doors.find(o=>o.id==='door_bath_1').y1 === 328]);
  checks.push(['master east head', d.furniture.find(f=>f.id==='bed_a').headDirection === 'east'], ['bed B west head', d.furniture.find(f=>f.id==='bed_b').headDirection === 'west']);
  return {version:${JSON.stringify(version)}, checks};
})()`;
const ws = new WebSocket(target.webSocketDebuggerUrl);
const timer = setTimeout(() => { console.error('Published verification timed out'); ws.close(); process.exitCode = 1; }, 60000);
ws.onopen = () => ws.send(JSON.stringify({id:1, method:'Runtime.evaluate', params:{expression, awaitPromise:true, returnByValue:true}}));
ws.onmessage = event => {
  const message = JSON.parse(event.data); if (message.id !== 1) return;
  clearTimeout(timer);
  const result = message.result?.result?.value;
  console.log(JSON.stringify(result || message, null, 2));
  if (!result?.checks?.every(check => check[1])) process.exitCode = 1;
  ws.close();
};
