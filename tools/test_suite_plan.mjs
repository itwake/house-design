// Test/render the real SVG code, not a second drawing of the intended plan.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8');
const variant=process.argv.includes('--laundry')?'laundry':process.argv.includes('--family')?'family':'suite';
const source=await read('studio.js'),data=JSON.parse(await read(`models/schemes/${variant}/design-data.json`));
const start=source.indexOf('function planFurniture('),end=source.indexOf('\nfunction exportPlan(',start);
assert.ok(start>=0&&end>start);
const helpers=['areaOf','centroid','escapeHTML','storageRoleName'].map(name=>source.split(/\r?\n/).find(l=>new RegExp(`^const ${name}\\s*=`).test(l))).join('\n');
const host={innerHTML:''},state={diningClosed:false};
const context=vm.createContext({data,state,$:s=>{assert.equal(s,'#floor-plan');return host;},$$:()=>[],roomDescription:id=>({name:data.rooms.find(r=>r.id===id)?.name||id})});
vm.runInContext(helpers+'\n'+source.slice(start,end)+'\nmakePlan();',context);
const svg=host.innerHTML;
let closedSvg='';
if(data.familyDiningRevision){
  state.diningClosed=true;vm.runInContext('makePlan();',context);closedSvg=host.innerHTML;
  state.diningClosed=false;vm.runInContext('makePlan();',context);assert.equal(host.innerHTML,svg,'Actual view returns to identical expanded drawing');
  const pose=(image,f)=>image.match(new RegExp(`<g data-dining-furniture="${f.name}"[^>]*>[\\s\\S]*?<\/g>`))?.[0];
  const check=(image,f)=>{const group=pose(image,f);assert.ok(group,'Full actual dining element '+f.name);assert.ok(group.includes(`data-dining-face="${f.face}"`),'Actual dining face '+f.name);const frame=group.match(/<rect data-furniture-frame[^>]+>/)?.[0];assert.ok(frame);for(const [key,value]of [['x',f.x],['y',f.y],['width',f.w],['height',f.d]])assert.ok(frame.includes(`${key}="${value}"`),'Exact state furniture '+f.name+'/'+key);if(/餐椅/.test(f.name)){const back=group.match(/<line data-dining-chair-back[^>]+>/)?.[0];assert.ok(back,'Physical chair-back line '+f.name);const expect=f.face==='west'?[f.x+f.w-2,f.y+3,f.x+f.w-2,f.y+f.d-3]:f.face==='east'?[f.x+2,f.y+3,f.x+2,f.y+f.d-3]:f.face==='south'?[f.x+3,f.y+2,f.x+f.w-3,f.y+2]:[f.x+3,f.y+f.d-2,f.x+f.w-3,f.y+f.d-2];for(const [i,key]of ['x1','y1','x2','y2'].entries())assert.ok(back.includes(`${key}="${expect[i]}"`),'Actual oriented back '+f.name+'/'+key);}};
  assert.ok(svg.includes('data-dining-state="expanded"')&&closedSvg.includes('data-dining-state="closed"'));
  assert.equal((svg.match(/data-dining-furniture=/g)||[]).length,5);assert.equal((closedSvg.match(/data-dining-furniture=/g)||[]).length,4,'No chairs disappear when table is retracted');
  for(const f of data.furniture.filter(f=>f.diningFitoutId===data.pulloutDining.id))check(svg,f);
  for(const f of data.pulloutDining.closedFurniture)check(closedSvg,f);
  assert.ok(!pose(closedSvg,data.pulloutDining.table)&&!closedSvg.includes('data-dining-fold-seam'),'Closed table genuinely inside cabinet, not still drawn in walk area');
  for(const image of [svg,closedSvg]){assert.ok(image.includes('data-storage-id="sofa_back_storage"'));const local=image.match(/<rect data-storage-id="dining_sideboard_wall" data-storage-part-id="family_sideboard_1_base"[^>]+>/)?.[0];assert.ok(local&&local.includes('width="44"')&&local.includes('height="120"'),'Actual local deep cabinet, not global 40 cm aggregate');}
}
for(const door of [...data.doors,...data.windows.filter(w=>w.windowType!=='bay')]){const tag=svg.match(new RegExp(`<line data-opening-id="${door.id}"[^>]+>`))?.[0];assert.ok(tag,door.id);for(const k of ['x1','y1','x2','y2'])assert.ok(tag.includes(`${k}="${door[k]}"`),'Exact opening plan '+door.id+'/'+k);}
assert.equal((svg.match(/data-opening-id="window_kitchen_balcony"/g)||[]).length,1,'One real kitchen–balcony window in plan');
assert.equal((svg.match(/data-wall-fitout="study_bookwall"/g)||[]).length,1,'One upper bookwall projection');
assert.ok(svg.includes('上方浅书架 · 虚线投影'),'Upper cabinet is not drawn as floor furniture');
assert.ok(svg.includes('data-suite-entry="private"')&&svg.includes('730 × 1530'),'Private foyer is labeled on actual plan');
assert.equal((svg.match(/data-hinged-door=/g)||[]).length,4,'Four real open hinged doors');
assert.ok(svg.includes('data-surface-slider="door_c"'),'Study wall-mounted sliding door');
for(const id of ['a_desktop','a_support','a_accessories','a_chair'])assert.ok(!svg.includes(`data-part-id="${id}"`),'Master item removed: '+id);
for(const id of ['l_desktop','l_support','l_accessories','l_adult_chair','l_child_chair'])assert.ok(!svg.includes(`data-part-id="${id}"`),'Living item removed: '+id);
assert.equal((svg.match(/data-bay-window=/g)||[]).length,3,'Keep three real bay windows');
assert.equal((svg.match(/data-sliding-panel=/g)||[]).length,data.laundry?6:3,'Keep kitchen and laundry sliders');
for(const room of data.rooms)assert.ok(svg.includes(`points="${room.points.map(p=>p.join(',')).join(' ')}"`),'Actual polygon '+room.id);
for(const [key,geometry]of [['主卧衣柜',[325,12,60,224]],['次卧衣柜',[12,262,180,60]]]){const f=data.furniture.find(f=>f.name===key);assert.deepEqual([f.x,f.y,f.w,f.d],geometry,'Latest owner wardrobe choice '+key);}
for(const id of ['study_north_sofa','study_full_desk','bed_b_niche_console'])assert.ok(svg.includes(`data-furniture-id="${id}"`),'Plan includes fitted furniture '+id);
assert.ok(svg.includes('data-sofa-face="south"'),'Study sofa faces south, with back against north wall');
if(variant==='family'){
  assert.equal((svg.match(/data-family-garage=/g)||[]).length,1);
  assert.equal((svg.match(/data-garage-item=/g)||[]).length,2);
  if(data.familyFlowRevision){
    const visible=data.garage.parts.filter(p=>p.role==='panel'||p.role==='folded-door');
    assert.equal((svg.match(/data-garage-part=/g)||[]).length,visible.length);
    assert.ok(svg.includes('1500×650')&&svg.includes('抬放'));
    assert.ok(svg.includes('data-opening-face="east"')&&svg.includes('data-garage-exit="east"'));
    assert.ok(!svg.includes('data-garage-part="hinged-leaf"'));
    for(const p of data.garage.parts.filter(p=>p.role==='folded-door'))assert.ok(svg.includes(`data-garage-part="${p.id}"`),'Real externally parked folded door '+p.id);
    for(const item of data.garage.items){const tag=svg.match(new RegExp(`<g data-garage-item="${item.id}"[^>]+>`))?.[0];assert.ok(tag?.includes(`data-z-cm="${item.zCm||0}"`),'Floor and raised vehicles '+item.id);}
    const fitout=data.storageFitouts.find(f=>f.id==='dining_sideboard_wall');
    for(const p of fitout.parts.filter(p=>['sideboard_base','pullout_table_cabinet'].includes(p.role)))assert.ok(svg.includes(`data-storage-part-id="${p.id}"`),'Both actual L-sideboard arms '+p.id);
    assert.ok(svg.includes('data-storage-part-id="family_return_base"'),'Actual north return is visible, not its aggregate bounding box');
    const rug=svg.match(/<rect data-living-rug[^>]+>/)?.[0],lamp=svg.match(/<circle data-living-lamp[^>]+>/)?.[0];
    assert.ok(rug&&lamp,'Actual cropped rug and relocated lamp projections');
    for(const [attribute,value]of [['x',data.modelAddons.livingRugCm.x],['y',638],['width',data.modelAddons.livingRugCm.w],['height',178]])assert.ok(rug.includes(`${attribute}="${value}"`),'Exact rug projection '+attribute);
    assert.ok(lamp.includes('cx="248"')&&lamp.includes('cy="825"')&&lamp.includes('r="22"'),'Actual 440 mm lamp shade envelope');
  }else if(data.familyEntryRevision){
    const visible=data.garage.parts.filter(p=>p.role==='panel'||p.id==='hinged-leaf');
    assert.equal((svg.match(/data-garage-part=/g)||[]).length,visible.length);
    assert.ok(svg.includes('1500×650')&&svg.includes('抬放'));
    assert.ok(svg.includes('data-opening-face="east"')&&svg.includes('data-garage-exit="east"'));
    assert.ok(svg.includes('data-garage-part="hinged-leaf"'));
    for(const item of data.garage.items){const tag=svg.match(new RegExp(`<g data-garage-item="${item.id}"[^>]+>`))?.[0];assert.ok(tag?.includes(`data-z-cm="${item.zCm||0}"`),'Plan distinguishes floor and upper vehicle '+item.id);}
    const bases=data.storageFitouts.find(f=>f.id==='dining_sideboard_wall').parts.filter(p=>p.role==='sideboard_base');
    for(const p of bases)assert.ok(svg.includes(`data-storage-part-id="${p.id}"`),'Plan contains actual full-length sideboard module '+p.id);
  }else{
    assert.equal((svg.match(/data-garage-part=/g)||[]).length,7);
    assert.ok(svg.includes('1500×1200')&&svg.includes('取车时暂占前场'));
    assert.ok(svg.includes('data-opening-face="north"')&&svg.includes('data-garage-exit="north"'));
  }
}
if(data.laundry){
  assert.equal((svg.match(/data-laundry-machine=/g)||[]).length,2);
  const frame=svg.match(/<rect data-slider-frame="balcony_door"[^>]+>/)?.[0];
  assert.ok(frame?.includes('x="645"')&&frame.includes('width="14.5"'),'Plan C frame matches actual B face');
  assert.ok(svg.includes('data-stack-to="south"')&&svg.includes('上方浅盆'));
}
if(process.argv.includes('--render')){
  const sharp=createRequire(import.meta.url)('sharp');
  const out=new URL('tmp/',root);await mkdir(out,{recursive:true});
  // Browser XMLSerializer expands HTML's valueless data attributes to "".
  for(const [name,drawing]of [[variant+'-plan',svg],...(closedSvg?[[variant+'-plan-closed',closedSvg]]:[])]){
    const image=drawing.replace(/\s(data-[\w-]+)(?=[\s/>])/g,' $1=""').replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="2000" style="font-family:Microsoft YaHei,SimSun,sans-serif" ');
    await writeFile(new URL(name+'.svg',out),image);
    await sharp(Buffer.from(image)).flatten({background:'#fcfaf5'}).png().toFile(fileURLToPath(new URL(name+'.png',out)));
  }
}
console.log('PASS actual suite SVG: own room polygons and relocated doors, labeled private foyer, master desk/chair absent, three bays/kitchen slider retained, west master wardrobe and south B wardrobe.');
