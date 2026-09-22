// QA-only index of existing model renders. Never alters delivered JPEG files.
import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const sharp=createRequire(import.meta.url)('sharp');
const catalog=JSON.parse(await readFile('models/design-schemes.json','utf8'));
const scheme=catalog.schemes.find(s=>s.id==='suite');
const manifest=JSON.parse(await readFile(scheme.manifest,'utf8'));
const composites=[],width=400,height=292;
for(const [i,name]of scheme.renderViews.entries()){
  const raw=await readFile(`assets/schemes/suite/${name}.jpg`);
  assert.equal(createHash('sha256').update(raw).digest('hex'),manifest.renderedViews[name]?.imageSha256,'Only verified current frame: '+name);
  const left=(i%4)*width,top=Math.floor(i/4)*height;
  composites.push({input:await sharp(raw).resize(width,267).toBuffer(),left,top:top+25});
  const label=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="25"><rect width="400" height="25" fill="#f4f1ec"/><text x="12" y="18" font-family="Arial" font-size="14" fill="#444">${i+1}. ${name} / V${catalog.version}</text></svg>`);
  composites.push({input:label,left,top});
}
await mkdir('tmp',{recursive:true});
const output=`tmp/suite-v${catalog.version.replaceAll('.','')}-contact.png`;
await sharp({create:{width:width*4,height:height*Math.ceil(scheme.renderViews.length/4),channels:3,background:'#f4f1ec'}}).composite(composites).png().toFile(output);
console.log('Verified contact sheet: '+output);
