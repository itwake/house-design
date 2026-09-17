// Read-only deployed-byte verification, not an external-source uptime monitor.
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),base=process.argv[2]||'https://itwake.github.io/house-design/';
const files=['knowledge.html','studio.html','index.html','knowledge/knowledge.js','knowledge/knowledge.css','knowledge/lib.mjs','knowledge/field.mjs','knowledge/project.mjs','knowledge/guide.html',...(await readdir(new URL('knowledge/data/',root))).map(f=>'knowledge/data/'+f),...(await readdir(new URL('knowledge/templates/',root))).map(f=>'knowledge/templates/'+f)];
const hash=buffer=>createHash('sha256').update(buffer.toString('utf8').replace(/\r\n/g,'\n')).digest('hex'),checks=[],queue=[...files];
async function worker(){while(queue.length){const path=queue.shift();try{const local=await readFile(new URL(path,root)),response=await fetch(new URL(path+'?kbverify='+Date.now(),base),{signal:AbortSignal.timeout(45000),cache:'no-store'}),actual=Buffer.from(await response.arrayBuffer());checks.push({path,status:response.status,pass:response.ok&&hash(local)===hash(actual)});}catch(err){checks.push({path,pass:false,error:err.message});}}}
await Promise.all(Array.from({length:4},worker));console.log(JSON.stringify({passed:checks.every(c=>c.pass),files:checks.length,checks},null,2));if(checks.some(c=>!c.pass))process.exitCode=1;
