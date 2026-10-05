// P2 release gate: byte identity, current/retained render provenance, no
// unrelated scheme changes; optional deployed-file verification.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),baseline='d81f065ef4287ee24592df6c372a8fe2d7a64c3b';
const read=p=>fs.readFileSync(path.join(root,p)),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const old=p=>JSON.parse(execFileSync('git',['show',`${baseline}:${p}`],{cwd:root,maxBuffer:32e6}));
const pref='models/schemes/family/',img='assets/schemes/family/',d=json(pref+'design-data.json'),m=json(pref+'scene-manifest.json'),oldManifest=old(pref+'scene-manifest.json');
const updated=new Set(['overall','living','dining','bay-living','entry-storage','sideboard','storage-library','living-wall']);
assert.equal(d.familyPublicP2Revision.version,'3.11.0');assert.equal(m.version,'3.11.0');
assert.equal(m.sourceSha256,sha(read(pref+'design-data.json')),'Manifest source bytes');assert.equal(m.baseBlendSha256,sha(read(pref+'huiyayuan-wood.blend')),'Manifest scene bytes');
assert.equal(Object.keys(m.renderedViews).length,20);
for(const[view,record]of Object.entries(m.renderedViews)){
  assert.equal(record.imageSha256,sha(read(img+view+'.jpg')),view+' image identity');
  if(updated.has(view)){assert.equal(record.sourceSha256,m.sourceSha256,view+' current source');assert.equal(record.baseBlendSha256,m.baseBlendSha256,view+' current native');assert.ok(!record.retainedFrom,view+' newly rendered');}
  else{assert.ok(record.retainedFrom,view+' provenance retained');for(const field of ['sourceSha256','baseBlendSha256','cameraHash','cameraState','imageSha256','renderSpec'])assert.deepEqual(record[field],oldManifest.renderedViews[view][field],view+' original '+field);}
  if(record.cameraOverride){
    const o=record.cameraOverride;assert.equal(view,'entry-storage','Only entry-storage has a camera override');assert.equal(o.scope,'camera-only');assert.equal(o.script,'tools/refresh_family_public_p2.py');
    assert.deepEqual(o.positionMetersPlan,[4,12.8,1.62]);assert.deepEqual(o.targetMetersPlan,[5.08,13.54,1.23]);assert.equal(o.lensMm,19);assert.equal(record.cameraState.lens,19);
    assert.ok(o.reason&&o.savedCameraHash&&o.savedCameraState?.matrix,'Original saved native camera remains explicitly recorded');assert.ok(fs.existsSync(path.join(root,o.script)),'Reproducible script exists');
    // validate_design_schemes.py additionally verifies both camera hashes,
    // both world matrices, view direction/FOV and the script's literal preset.
  }
}
const cat=json('models/design-schemes.json'),oldCat=old('models/design-schemes.json');assert.equal(cat.version,'3.11.0');assert.equal(cat.schemes.find(s=>s.id==='family').assetRevision,'3.11.0');
for(const id of ['wood','laundry'])assert.deepEqual(cat.schemes.find(s=>s.id===id),oldCat.schemes.find(s=>s.id===id),id+' catalog protected');
const base=process.argv.find(a=>a.startsWith('--live='))?.slice(7);
if(base){for(const file of ['studio.html','studio.js','schemes.js','index.html','models/design-schemes.json',pref+'design-data.json',pref+'scene-manifest.json',pref+'huiyayuan-wood.glb',...Array.from(updated,x=>img+x+'.jpg')]){
  const response=await fetch(new URL(file+'?v=3.11.0',base));assert.equal(response.status,200,file+' HTTP');assert.equal(sha(Buffer.from(await response.arrayBuffer())),sha(read(file)),file+' live bytes');
}}
console.log(JSON.stringify({passed:true,revision:'3.11.0',newRenders:updated.size,retainedHistorical:20-updated.size,otherSchemeEntriesUnchanged:true,live:base||false},null,2));
