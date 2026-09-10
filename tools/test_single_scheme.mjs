// Offline tests of the real routing / viewer initialization code. No browser,
// network or duplicate geometry renderer. WebGL and DOM layout are not tested.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const [entry,html,helpers,viewer]=await Promise.all(['index.html','studio.html','schemes.js','studio.js'].map(read));
const catalog=JSON.parse(await read('models/design-schemes.json'));
const geometry=JSON.parse(await read(catalog.geometrySource));
const manifest=JSON.parse(await read(catalog.schemes[0].manifest));
const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
const classes=new Set([...html.matchAll(/\bclass="([^"]+)"/g)].flatMap(m=>m[1].split(/\s+/)));
const roomIds=['overall','living','dining','room_a','room_b','room_c','kitchen','bath_1','bath_2','balcony'];
const retired=['terracotta','moss','cobalt'];
const preference='house-design:room-card-visible';
assert.deepEqual(catalog.schemes.map(s=>s.id),['wood']);
assert.deepEqual(catalog.archivedPalettes.map(s=>s.id),retired);
assert.equal(catalog.schemes[0].assetRevision,'3.1.4');
assert.ok(catalog.futureSchemePolicy.includes('布局')&&catalog.futureSchemePolicy.includes('不作为新方案'));
for(const text of [entry,html,viewer]){
  for(const marker of ['id="scheme-grid"','id="scheme-dialog"','id="change-scheme"','四套','设计选集','showSchemeSelector','schemeCards'])assert.ok(!text.includes(marker),marker+' removed from active UI');
}
assert.ok(!html.includes('href="schemes.css'));
assert.ok(entry.includes('data-single-scheme-entry'));
assert.ok(entry.includes('studio.html?scheme=wood&amp;v='+catalog.version));
for(const m of viewer.matchAll(/\$\(['"]#([\w-]+)[^'"\n]*['"]\)/g))assert.ok(ids.has(m[1]),'Static selector still exists: '+m[1]);
for(const id of ['toggle-room-card','room-card-toggle','open-bays','open-storage','open-plan','download-plan','download-blend','download-glb','active-render','future-scheme-policy'])assert.ok(ids.has(id),id);

function environment(href,{stored='false',entryPage=false,catalogResponse=catalog,status=200}={}){
  let url=new URL(href),redirect=null;
  const elements=new Map(),store=new Map([[preference,stored]]),requests=[],errors=[],built=[];
  const node=key=>{
    if(elements.has(key))return elements.get(key);
    const attrs={},listeners={},classSet=new Set();
    const result={dataset:{},style:{},hidden:false,attrs,listeners,
      classList:{add:c=>classSet.add(c),remove:c=>classSet.delete(c),toggle:(c,v)=>v?classSet.add(c):classSet.delete(c)},
      setAttribute:(k,v)=>attrs[k]=v,removeAttribute:k=>delete attrs[k],
      addEventListener:(k,fn)=>listeners[k]=fn,contains:()=>false,focus:()=>{},
      querySelector:s=>node(key+' '+s)};
    elements.set(key,result);return result;
  };
  const query=selector=>{
    if(selector==='[data-single-scheme-entry]')return entryPage?node('entry'):null;
    if(selector==='#enter-home')return node(selector);
    const id=selector.match(/^#([\w-]+)/)?.[1],cls=selector.match(/^\.([\w-]+)/)?.[1];
    assert.ok(id?ids.has(id):classes.has(cls),'Real initialization selector missing: '+selector);
    return node(selector);
  };
  const document={baseURI:href,documentElement:{dataset:{},style:{setProperty:()=>{}}},querySelector:query,querySelectorAll:()=>[],addEventListener:()=>{},activeElement:null};
  const location={get href(){return url.href},get search(){return url.search},get hash(){return url.hash},replace:v=>{redirect=v}};
  const context=vm.createContext({URL,URLSearchParams,document,location,
    history:{replaceState:(_,__,href)=>{url=new URL(href,url)}},
    matchMedia:()=>({matches:false}),window:{addEventListener:()=>{}},
    sessionStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},
    setTimeout:()=>0,clearTimeout:()=>{},console:{error:(...e)=>errors.push(e)},
    fetch:async href=>{
      const requestURL=new URL(href),path=requestURL.pathname.replace('/house-design/','');requests.push(path);
      assert.equal(requestURL.searchParams.get('v'),path==='models/design-schemes.json'?catalog.version:'3.1.4','Data/manifest asset revision stays separate from UI revision');
      const value=path==='models/design-schemes.json'?catalogResponse:path===catalog.geometrySource?geometry:path===catalog.schemes[0].manifest?manifest:undefined;
      assert.notEqual(value,undefined,'Unexpected/retired resource request: '+path);
      return {ok:path==='models/design-schemes.json'?status===200:true,status,json:async()=>structuredClone(value)};
    },built});
  vm.runInContext(helpers.replaceAll('export ',''),context);
  return {context,document,node,store,requests,errors,built,get url(){return url},get redirect(){return redirect}};
}
const base='https://itwake.github.io/house-design/';
const helperEnv=environment(base);
const api=vm.runInContext('({entryURL,resolveScheme,schemeRender,loadSchemeCatalog,SCHEME_REVISION})',helperEnv.context);
assert.equal(api.SCHEME_REVISION,catalog.version);
assert.ok(viewer.includes("const UI_REVISION = '"+catalog.version+"'"));
assert.equal(new URL(api.schemeRender(catalog.schemes[0],'living')).searchParams.get('v'),'3.1.4');
for(const name of ['', 'index.html'])for(const hash of ['',...roomIds.map(id=>'#'+id)])for(const style of ['', 'wood', ...retired, 'invalid']){
  const before=new URL(base+name+'?v=old&source=bookmark'+(style?'&scheme='+style:'')+hash);
  const env=environment(before.href,{entryPage:true}),after=new URL(env.redirect);
  assert.equal(after.pathname,'/house-design/studio.html');
  assert.equal(after.hash,hash);assert.equal(after.searchParams.get('source'),'bookmark');
  assert.equal(after.searchParams.get('scheme'),style||'wood');
  assert.equal(after.searchParams.get('v'),catalog.version);
  assert.equal(env.store.get(preference),'false');
  assert.equal(env.node('#enter-home').href,env.redirect);
}
let initialized=0;
for(const style of ['', 'wood',...retired])for(const room of roomIds){
  const env=environment(base+'studio.html?source=bookmark&v=old'+(style?'&scheme='+style:'')+'#'+room);
  vm.runInContext(viewer.replace(/^import .*\r?\n/gm,'').replace(/\binit\(\);\s*$/,''),env.context);
  // Geometry has a separate actual-SVG regression. Here only detach expensive
  // image/mesh rendering, leaving real bindControls/configureScheme/init intact.
  vm.runInContext(`makeNavigation=makePlan=renderDesignNotes=renderBayFitouts=renderStorageFitouts=paintSchemePlan=()=>{};
    selectRoom=id=>{state.room=id};switchView=()=>{};buildScene=()=>built.push({room:state.room,model:scheme.model});`,env.context);
  await vm.runInContext('init()',env.context);
  assert.equal(env.errors.length,0);
  assert.equal(env.document.documentElement.dataset.scheme,'wood');
  assert.equal(env.built[0]?.room,room);assert.equal(env.built[0]?.model,catalog.schemes[0].model);
  assert.equal(env.url.hash,'#'+room);assert.equal(env.url.searchParams.get('scheme'),'wood');
  assert.equal(env.url.searchParams.get('v'),catalog.version);assert.equal(env.url.searchParams.get('source'),'bookmark');
  assert.deepEqual(env.requests,['models/design-schemes.json',catalog.geometrySource,catalog.schemes[0].manifest]);
  assert.equal(env.node('#future-scheme-policy').textContent,catalog.futureSchemePolicy);
  assert.equal(env.node('#room-card').hidden,true);
  env.node('#toggle-room-card').listeners.click();
  assert.equal(env.node('#room-card').hidden,false);assert.equal(env.store.get(preference),'true');
  env.node('#room-card-toggle').listeners.click();
  assert.equal(env.node('#room-card').hidden,true);assert.equal(env.store.get(preference),'false');
  assert.equal(env.node('#toggle-room-card').attrs['aria-expanded'],'false');
  for(const [id,key]of [['download-glb','model'],['download-blend','blend']]){
    const download=new URL(env.node('#'+id).href);
    assert.equal(download.pathname,'/house-design/'+catalog.schemes[0][key]);assert.equal(download.searchParams.get('v'),'3.1.4');
  }
  initialized++;
}
for(const options of [{href:base+'studio.html?scheme=invalid#living'},{href:base+'studio.html',status:503},{href:base+'studio.html',catalogResponse:{...catalog,schemes:[...catalog.schemes,...catalog.archivedPalettes]}}]){
  const env=environment(options.href,options);
  vm.runInContext(viewer.replace(/^import .*\r?\n/gm,'').replace(/\binit\(\);\s*$/,''),env.context);
  await vm.runInContext('init()',env.context);
  assert.equal(env.document.documentElement.dataset.scheme,undefined);
  assert.equal(env.node('#scheme-load-error').hidden,false);assert.equal(env.node('#model-loading').hidden,true);
  assert.deepEqual(env.requests,['models/design-schemes.json']);
}

// This kitchen-door revision may update only the named source/assets.
// All other geometry remains byte-for-byte/structurally protected.
const baseline='248bb322d3feeb08a522a69c8cfe6612d4df532b';
const {fileURLToPath}=await import('node:url');
const cwd=fileURLToPath(root);
const updated=new Set(['models/design-data.json','models/blender-overrides.json','models/design-schemes.json','models/scene-manifest.json','models/huiyayuan-wood.blend','models/huiyayuan-wood.glb']);
const oldData=JSON.parse(execFileSync('git',['show',baseline+':models/design-data.json'],{cwd,encoding:'utf8',maxBuffer:1024*1024}));
function unaffected(d){
  d=structuredClone(d);d.doors=d.doors.filter(x=>x.id!=='door_kitchen');
  d.geometryNotes=d.geometryNotes.filter(n=>!n.startsWith('V3.1.4厨房门'));
  d.storageFitouts.forEach(f=>f.dimensions=f.dimensions.map(n=>n.startsWith('上柜外深280mm；')?'kitchen-door clearance separately verified':n));
  return d;
}
assert.deepEqual(unaffected(geometry),unaffected(oldData),'All unrelated furniture, bays, room outlines and wall centerlines stay unchanged');
const paths=execFileSync('git',['ls-tree','-r','--name-only',baseline,'models','assets'],{cwd,encoding:'utf8'}).trim().split('\n').filter(p=>!updated.has(p)&&!p.startsWith('assets/blender-renders/'));
const tree=execFileSync('git',['ls-tree','-r',baseline,'models','assets'],{cwd,encoding:'utf8'}).trim().split('\n');
const expectedByPath=new Map(tree.map(line=>{const [meta,path]=line.split('\t');return [path,meta.split(' ')[2]]}));
const actualHashes=execFileSync('git',['hash-object','--stdin-paths'],{cwd,encoding:'utf8',input:paths.join('\n')+'\n'}).trim().split('\n');
assert.equal(actualHashes.length,paths.length);
paths.forEach((path,i)=>assert.equal(actualHashes[i],expectedByPath.get(path),path+' must preserve existing asset/source bytes'));
console.log(`PASS: 132 entry routes, ${initialized} real viewer initializations, retired/unknown IDs, catalog failure, preserved room/hash/preferences/downloads, and ${paths.length} unchanged historical/texture assets and unchanged unrelated active source geometry. Offline tests do not test WebGL or browser layout.`);
