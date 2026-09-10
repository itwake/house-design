// Read-only HTTP verification of every active design asset on GitHub Pages.
// Run: node tools/verify_published.mjs
// Verifies deployed bytes; does not claim browser rendering/visual QA.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base='https://itwake.github.io/house-design/';
const local=path=>new URL('../'+path,import.meta.url);
const catalog=JSON.parse(await readFile(local('models/design-schemes.json'),'utf8'));
const views=['overall','living','dining','master','bedroom-b','study','kitchen','master-bath','guest-bath','balcony','bay-master','bay-tea','bay-living','entry-storage','sideboard'];
const files=new Set(['index.html','studio.html','schemes.js','studio.js','studio.css','walkthrough.js','walkthrough.css','models/design-schemes.json','models/design-data.json']);
for(const scheme of catalog.schemes){
  [scheme.model,scheme.blend,scheme.manifest].forEach(path=>files.add(path));
  const dir=scheme.id==='wood'?'assets/blender-renders':'assets/schemes/'+scheme.id;
  views.forEach(view=>files.add(dir+'/'+view+'.jpg'));
}
const hash=(path,bytes)=>createHash('sha256').update(/\.(html|css|js|json)$/i.test(path)?bytes.toString('utf8').replace(/\r\n/g,'\n'):bytes).digest('hex');
const checks=[],queue=[...files];
async function worker(){
  while(queue.length){
    const path=queue.shift();
    try{
      const expected=hash(path,await readFile(local(path))),url=new URL(path,base);
      url.searchParams.set('verify',catalog.version+'-'+Date.now());
      const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(60000)});
      const actual=hash(path,Buffer.from(await response.arrayBuffer()));
      checks.push({path,pass:response.ok&&actual===expected,status:response.status,expected,actual});
    }catch(error){checks.push({path,pass:false,error:String(error)})}
  }
}
await Promise.all(Array.from({length:3},worker));
checks.sort((a,b)=>a.path.localeCompare(b.path));
const result={version:catalog.version,base,verifiedFiles:checks.length,passed:checks.every(c=>c.pass),checks};
console.log(JSON.stringify(result,null,2));
if(!result.passed)process.exitCode=1;
