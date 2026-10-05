// Run only after models finish building and before fresh rendering. Geometry
// already built is unaltered: reversible exact string-only edits are recorded.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {updatePurchasedCopy} from './purchased_copy.mjs';
const root=new URL('../',import.meta.url),hash=s=>createHash('sha256').update(s.replaceAll('\r\n','\n')).digest('hex');
for(const id of ['wood','family','laundry']){
  const source=new URL(`models/schemes/${id}/design-data.json`,root),path=new URL(`models/schemes/${id}/scene-manifest.json`,root);
  const bytes=await readFile(source,'utf8'),old=JSON.parse(bytes),manifest=JSON.parse(await readFile(path,'utf8'));
  assert.equal(manifest.sourceSha256,hash(bytes),id+': source must match the successfully built native scene');
  const changes=[],next=updatePurchasedCopy(old,changes);
  if(!changes.length){console.log(id+': no copy changes');continue;}
  const inverse=structuredClone(next);
  for(const c of changes){let node=inverse;for(const key of c.path.slice(0,-1))node=node[key];node[c.path.at(-1)]=c.previous;}
  assert.deepEqual(inverse,old,'Only recorded exact text values changed');
  const after=JSON.stringify(next,null,2)+'\n',updated=updatePurchasedCopy(manifest);
  updated.sourceSha256=hash(after);
  updated.displayCopyUpdate={previousSourceSha256:hash(bytes),currentSourceSha256:hash(after),changes,geometryUnchanged:true,framesRegenerated:true};
  // Never relabel an already-rendered old source frame as a new source frame.
  updated.renderedViews={};
  await writeFile(source,after);await writeFile(path,JSON.stringify(updated,null,2)+'\n');
  console.log(id+': '+changes.length+' reversible text-only updates; prior frame records cleared');
}
