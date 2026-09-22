// Test/render the real SVG code, not a second drawing of the intended plan.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8');
const source=await read('studio.js'),data=JSON.parse(await read('models/schemes/suite/design-data.json'));
const start=source.indexOf('function planFurniture('),end=source.indexOf('\nfunction exportPlan(',start);
assert.ok(start>=0&&end>start);
const helpers=['areaOf','centroid','escapeHTML','storageRoleName'].map(name=>source.split(/\r?\n/).find(l=>new RegExp(`^const ${name}\\s*=`).test(l))).join('\n');
const host={innerHTML:''};
vm.runInNewContext(helpers+'\n'+source.slice(start,end)+'\nmakePlan();',{data,$:s=>{assert.equal(s,'#floor-plan');return host;},$$:()=>[],roomDescription:id=>({name:data.rooms.find(r=>r.id===id)?.name||id})});
const svg=host.innerHTML;
for(const door of [...data.doors,...data.windows.filter(w=>w.windowType!=='bay')]){const tag=svg.match(new RegExp(`<line data-opening-id="${door.id}"[^>]+>`))?.[0];assert.ok(tag,door.id);for(const k of ['x1','y1','x2','y2'])assert.ok(tag.includes(`${k}="${door[k]}"`),'Exact opening plan '+door.id+'/'+k);}
assert.equal((svg.match(/data-opening-id="window_kitchen_balcony"/g)||[]).length,1,'One real kitchen–balcony window in plan');
assert.ok(svg.includes('data-suite-entry="private"')&&svg.includes('730 × 1530'),'Private foyer is labeled on actual plan');
assert.equal((svg.match(/data-hinged-door=/g)||[]).length,4,'Four real open hinged doors');
assert.ok(svg.includes('data-surface-slider="door_c"'),'Study wall-mounted sliding door');
for(const id of ['a_desktop','a_support','a_accessories','a_chair'])assert.ok(!svg.includes(`data-part-id="${id}"`),'Master item removed: '+id);
assert.equal((svg.match(/data-bay-window=/g)||[]).length,3,'Keep three real bay windows');
assert.equal((svg.match(/data-sliding-panel=/g)||[]).length,3,'Keep kitchen slider');
for(const room of data.rooms)assert.ok(svg.includes(`points="${room.points.map(p=>p.join(',')).join(' ')}"`),'Actual polygon '+room.id);
for(const [key,geometry]of [['主卧衣柜',[325,12,60,224]],['次卧衣柜',[12,262,180,60]]]){const f=data.furniture.find(f=>f.name===key);assert.deepEqual([f.x,f.y,f.w,f.d],geometry,'Latest owner wardrobe choice '+key);}
for(const id of ['study_north_sofa','study_full_desk','bed_b_niche_console'])assert.ok(svg.includes(`data-furniture-id="${id}"`),'Plan includes fitted furniture '+id);
assert.ok(svg.includes('data-sofa-face="south"'),'Study sofa faces south, with back against north wall');
if(process.argv.includes('--render')){
  const sharp=createRequire(import.meta.url)('sharp');
  const out=new URL('tmp/',root);await mkdir(out,{recursive:true});
  // Browser XMLSerializer expands HTML's valueless data attributes to "".
  const image=svg.replace(/\s(data-[\w-]+)(?=[\s/>])/g,' $1=""').replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="2000" style="font-family:Microsoft YaHei,SimSun,sans-serif" ');
  await writeFile(new URL('suite-plan.svg',out),image);
  await sharp(Buffer.from(image)).flatten({background:'#fcfaf5'}).png().toFile(fileURLToPath(new URL('suite-plan.png',out)));
}
console.log('PASS actual suite SVG: own room polygons and relocated doors, labeled private foyer, master desk/chair absent, three bays/kitchen slider retained, west master wardrobe and south B wardrobe.');
