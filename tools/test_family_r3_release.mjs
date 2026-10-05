// Final publication gate: current native/source/render identity and retained provenance.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),read=p=>fs.readFileSync(path.join(root,p));
const json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const pref='models/schemes/family/',img='assets/schemes/family/',d=json(pref+'design-data.json'),m=json(pref+'scene-manifest.json');
const old=JSON.parse(execFileSync('git',['show','e210bd7:'+pref+'scene-manifest.json'],{cwd:root,maxBuffer:16e6}));
const updated=new Set(['overall','master','bedroom-b','study','master-bath','guest-bath','bay-master','bay-tea','suite-entry']);
assert.equal(d.familyR3Revision.version,'3.10.0');assert.equal(m.version,'3.10.0');
assert.equal(m.sourceSha256,sha(read(pref+'design-data.json')));
assert.equal(m.baseBlendSha256,sha(read(pref+'huiyayuan-wood.blend')));
assert.equal(Object.keys(m.renderedViews).length,20);
for(const [view,record]of Object.entries(m.renderedViews)){
 assert.equal(record.imageSha256,sha(read(img+view+'.jpg')),view+' image identity');
 if(updated.has(view)){
  assert.equal(record.sourceSha256,m.sourceSha256,view+' current source');
  assert.equal(record.baseBlendSha256,m.baseBlendSha256,view+' current native scene');
  assert(!record.retainedFrom,view+' must be a newly rendered frame');
 }else{
  assert(record.retainedFrom,view+' historical source disclosed');
  for(const key of ['sourceSha256','baseBlendSha256','cameraHash','cameraState','imageSha256','renderSpec'])assert.deepEqual(record[key],old.renderedViews[view][key],view+' retains original '+key);
 }
}
const cat=json('models/design-schemes.json');assert.equal(cat.version,'3.10.0');
assert.equal(cat.schemes.find(s=>s.id==='family').assetRevision,'3.10.0');
for(const id of ['wood','laundry'])assert.deepEqual(cat.schemes.find(s=>s.id===id),JSON.parse(execFileSync('git',['show','e210bd7:models/design-schemes.json'],{cwd:root})).schemes.find(s=>s.id===id),id+' catalogue entry unchanged');
const base=process.argv.find(a=>a.startsWith('--live='))?.slice(7);
if(base){
 for(const file of ['studio.html','studio.js','schemes.js','index.html','models/design-schemes.json',pref+'design-data.json',pref+'scene-manifest.json',pref+'huiyayuan-wood.glb',...Array.from(updated,x=>img+x+'.jpg')]){
  const response=await fetch(new URL(file+'?v=3.10.0',base));assert.equal(response.status,200,file+' HTTP');
  assert.equal(sha(Buffer.from(await response.arrayBuffer())),sha(read(file)),file+' deployed bytes match');
 }
}
console.log(JSON.stringify({passed:true,revision:'3.10.0',newRenders:9,retainedHistorical:11,otherSchemeEntriesUnchanged:true,live:base||false},null,2));
