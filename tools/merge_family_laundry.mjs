// Merge the two approved fitouts without importing the laundry dining layout.
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),cwd=fileURLToPath(root),BASE='9e9a10f';
const fromGit=p=>execFileSync('git',['show',BASE+':'+p],{cwd,encoding:'utf8',maxBuffer:8e6});
const parse=p=>JSON.parse(fromGit(p)),clone=structuredClone;
const d=parse('models/schemes/family/design-data.json'),l=parse('models/schemes/laundry/design-data.json');
const summary='保留1500×1200mm面厅800库、短餐柜和四人餐桌；合并生活阳台并排洗烘与上方浅盆、外移三轨门，以及电视旁3180mm整墙浅书架。沙发和茶几向西、向北调整，避开餐椅。';
d.version='3.5.0 · family storage + laundry wall';d.geometryRevision='family-laundry-2026-09-30';d.layout.intent=summary;
d.familyLaundryRevision={version:'3.5.0',baselineCommit:BASE,source:'models/schemes/laundry/design-data.json',sourceSha256:createHash('sha256').update(fromGit('models/schemes/laundry/design-data.json').replaceAll('\r\n','\n')).digest('hex'),measured:false,scope:'仅合并生活阳台、B书架、C推拉门与必要的客厅家具移位；亲子库、餐区、卧卫和低飘窗保留。'};
d.walls[8]=clone(l.walls[8]);d.wallSpecs[8]=clone(l.wallSpecs[8]);d.walls.push(clone(l.walls.at(-1)));d.wallSpecs.push(clone(l.wallSpecs.at(-1)));
for(const id of ['living','balcony'])Object.assign(d.rooms.find(r=>r.id===id),clone(l.rooms.find(r=>r.id===id)));
d.doors=d.doors.map(o=>o.id==='balcony_door'?clone(l.doors.find(v=>v.id===o.id)):o);
d.laundry=clone(l.laundry);d.laundry.conditions=d.laundry.conditions.filter(n=>!n.includes('不加入方案3大件库')).concat('本合并方案保留亲子储物库、短餐柜与四人餐桌；不恢复原7字餐柜。','为避开餐椅，沙发向北移1020mm、向西移800mm，茶几向北移820mm、向西移800mm；沙发后到北餐椅约605mm，拉椅时不能同时通行。');
d.laundry.metrics.sofaDiningChairGapCm=60.5;
d.laundry.dimensions=d.laundry.dimensions.map(n=>n.includes('沙发西移')?'阳台操作带约690mm；书架前约700mm，沙发后到北餐椅约605mm。':n);
d.furniture=d.furniture.filter(f=>!['洗烘塔','阳台家政柜'].includes(f.name));
for(const f of d.furniture){if(f.name==='三人沙发')Object.assign(f,{x:355,y:809});if(f.name==='茶几')Object.assign(f,{x:405,y:707});if(f.name==='电视薄柜')f.x=395;}
d.furniture.push(...clone(l.furniture.filter(f=>f.laundryFitoutId)));
d.modelAddons={...d.modelAddons,livingFloorLampCm:{x:335,y:735}};
for(const n of d.renovationNotes)if(['living','balcony'].includes(n.roomId))n.text=summary+' 阳台操作690mm、机顶至浅盆底30mm均待选型和现场深化。';
d.geometryNotes=[summary,...d.laundry.conditions,...d.geometryNotes];
// Remove old claims that the original balcony is unchanged, not its evidence.
d.garage.conditions=d.garage.conditions.map(n=>n.replace('厨房、阳台、卧卫','厨房、卧卫'));
for(const f of d.storageFitouts)if(f.garage)f.garage=clone(d.garage);
await writeFile(new URL('models/schemes/family/design-data.json',root),JSON.stringify(d,null,2)+'\n');
const c=JSON.parse(await readFile(new URL('models/design-schemes.json',root),'utf8'));c.version='3.5.0';c.updatedAt='2026-09-30';c.scope='三套布局：原方案、亲子储物＋家政整墙、独立家政整墙。';
const s=c.schemes.find(s=>s.id==='family');s.assetRevision='3.5.0';s.summary=summary;s.tagline='大件收得下，家务也藏好';
s.differences=['保留1.80㎡面厅紧凑800库、900mm短餐边柜和四人餐桌。',...d.laundry.dimensions];s.tradeoffs=[...s.tradeoffs,...d.laundry.conditions];
for(const v of ['laundry-detail','living-wall'])if(!s.renderViews.includes(v))s.renderViews.push(v);
for(const id of ['overall','living','balcony'])s.roomOverrides[id]={title:id==='balcony'?'洗烘落地，台盆在上':id==='living'?'书架、整墙与亲子收纳':'亲子储物 × 家政整墙',description:summary,features:['800库与家政合并','并排洗烘＋浅盆','整墙书架与三轨门']};
await writeFile(new URL('models/design-schemes.json',root),JSON.stringify(c,null,2)+'\n');
console.log('Merged family fitout source and catalog; wood/laundry/suite assets untouched.');
