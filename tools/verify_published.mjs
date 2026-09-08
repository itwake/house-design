// Read-only check of every deployed scheme asset against local SHA-256.
// node tools/verify_published.mjs LOCAL_CDP_PORT PROJECT_TAB_ID
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const [port,tabId]=process.argv.slice(2);
if(!/^\d+$/.test(port||'')||!tabId)throw new Error('Pass local CDP port and published project tab ID');
const base='https://itwake.github.io/house-design/';
const local=path=>new URL('../'+path,import.meta.url);
const catalog=JSON.parse(await readFile(local('models/design-schemes.json'),'utf8'));
const views=['overall','living','dining','master','bedroom-b','study','kitchen','master-bath','guest-bath','balcony','bay-master','bay-tea','bay-living','entry-storage','sideboard'];
const files=new Set(['index.html','studio.html','schemes.js','schemes.css','studio.js','studio.css','models/design-schemes.json','models/design-data.json']);
for(const scheme of catalog.schemes){
 [scheme.model,scheme.blend,scheme.manifest].forEach(path=>files.add(path));
 const dir=scheme.id==='wood'?'assets/blender-renders':'assets/schemes/'+scheme.id;
 views.forEach(view=>files.add(dir+'/'+view+'.jpg'));
}
const expected=Object.fromEntries(await Promise.all([...files].map(async path=>{const bytes=await readFile(local(path)),content=/\.(html|css|js|json)$/i.test(path)?bytes.toString('utf8').replace(/\r\n/g,'\n'):bytes;return[path,createHash('sha256').update(content).digest('hex')]})));
const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
const target=targets.find(t=>t.id===tabId&&t.url.startsWith(base));
if(!target)throw new Error('Refusing to inspect a non-project or unpublished tab');
const expression=`(async()=>{
 const base=${JSON.stringify(base)},expected=${JSON.stringify(expected)},version=${JSON.stringify(catalog.version)};
 const checks=[],queue=Object.entries(expected);
 const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
 async function worker(){while(queue.length){const[path,hash]=queue.shift();try{const url=new URL(path,base);url.searchParams.set('verify',version);const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(120000)});const bytes=await r.arrayBuffer(),content=/\\.(html|css|js|json)$/i.test(path)?new TextEncoder().encode(new TextDecoder().decode(bytes).replace(/\\r\\n/g,'\\n')):bytes;const actual=await sha(content);checks.push([path+' content SHA matches local',r.ok&&actual===hash,{status:r.status,actual}]);}catch(error){checks.push([path,false,{error:String(error)}]);}}}
 await Promise.all(Array.from({length:3},worker));
 checks.sort((a,b)=>a[0].localeCompare(b[0]));
 checks.push(['published UI revision',document.documentElement.dataset.uiRevision===version]);
 if(location.pathname.endsWith('/studio.html')){checks.push(['card visibility control',!!document.querySelector('#toggle-room-card[aria-controls="room-card"]')],['scheme selector available',!!document.querySelector('#change-scheme')],['valid rendered scheme',${JSON.stringify(catalog.schemes.map(s=>s.id))}.includes(document.documentElement.dataset.scheme)]);}
 else{checks.push(['four gallery cards',document.querySelectorAll('#scheme-grid [data-scheme-card]').length===4],['gallery covers decoded',[...document.querySelectorAll('#scheme-grid img')].every(img=>img.complete&&img.naturalWidth>0)]);}
 return{version,verifiedFiles:Object.keys(expected).length,page:location.href,checks};
})()`;
const ws=new WebSocket(target.webSocketDebuggerUrl);
const timer=setTimeout(()=>{console.error('Published verification timed out');ws.close();process.exitCode=1},600000);
ws.onopen=()=>ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));
ws.onmessage=event=>{
 const message=JSON.parse(event.data);if(message.id!==1)return;
 clearTimeout(timer);const result=message.result?.result?.value;
 console.log(JSON.stringify(result||message,null,2));
 if(!result?.checks?.every(c=>c[1]))process.exitCode=1;
 ws.close();
};
