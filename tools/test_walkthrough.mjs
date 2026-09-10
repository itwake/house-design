// Offline, real navigation + real viewer lifecycle + Three.js mesh tests.
// No WebGL renderer, browser layout, screenshots or external services.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../vendor/three/three.module.js';
import * as walk from '../walkthrough.js';
const {buildWalkWorld,findWalkStart,advanceWalk,movementVector,WalkController,WALK_STARTS,WALK_RADIUS,WALK_EYE_HEIGHT,isWalkDoorInfill}=walk;
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8');
const data=JSON.parse(await read('models/design-data.json'));
const manifest=JSON.parse(await read('models/scene-manifest.json'));
const catalog=JSON.parse(await read('models/design-schemes.json'));
const source=await read('studio.js'),html=await read('studio.html');
const world=buildWalkWorld(data),near=(a,b,message)=>assert.ok(Math.abs(a-b)<1e-7,message||`${a} != ${b}`);
assert.equal(WALK_EYE_HEIGHT,1.6);assert.equal(WALK_RADIUS,.25);
assert.equal(world.doors.length,7);
assert.equal(world.rooms.length,8);
for(const [id,[x,z]]of Object.entries(WALK_STARTS)){
  assert.ok(world.canStand(x,z),'Safe entry '+id);
  assert.deepEqual(findWalkStart(world,id,{x,z}),{x,z});
  const fallback=findWalkStart(world,id,{x:-100,z:-100});
  assert.ok(fallback&&world.canStand(fallback.x,fallback.z),'Safe fallback '+id);
}
assert.equal(findWalkStart(world,'unknown'),null);
for(const [x,z,r]of [[NaN,2,.25],[2,Infinity,.25],[2,2,-1],[-1,2,.25],[10,5,.25]])assert.equal(world.canStand(x,z,r),false);
for(const opening of [...data.windows,data.doors.find(d=>d.id==='entry_door')]){
  assert.equal(world.canStand((opening.x1+opening.x2)/200,(opening.y1+opening.y2)/200,0),false,'No passage '+opening.id);
}
assert.equal(world.canStand(2.7,6.26,0),false,'Continuous study south wall');
assert.equal(world.canStand(7.4,11.21,0),false,'No invented kitchen-balcony connection');
for(const obstacle of world.obstacles)assert.equal(world.canStand(obstacle.x+obstacle.w/2,obstacle.z+obstacle.d/2,0),false,'Solid '+obstacle.id);
for(const f of data.bayFitouts)for(const p of f.parts)if(['desktop','chair'].includes(p.role))assert.ok(world.obstacles.some(o=>o.id===p.id),'Bay collision '+p.id);

// Four-neighbour grid links are checked with the actual swept movement too.
const step=.05,grid=new Map(),key=(i,j)=>i+','+j;
for(let i=0;i<=169;i++)for(let j=0;j<=281;j++){const x=i*step,z=j*step;if(world.canStand(x,z))grid.set(key(i,j),{i,j,x,z})}
const entry=grid.get(key(86,260));assert.ok(entry);
const queue=[entry],seen=new Set([key(entry.i,entry.j)]),reached=new Set();
for(let head=0;head<queue.length;head++){
  const p=queue[head];reached.add(world.roomAt(p.x,p.z));
  for(const [di,dj]of [[1,0],[-1,0],[0,1],[0,-1]]){
    const k=key(p.i+di,p.j+dj),q=grid.get(k);if(!q||seen.has(k))continue;
    const moved=advanceWalk(world,p,q.x-p.x,q.z-p.z);
    if(Math.hypot(moved.x-q.x,moved.z-q.z)>1e-7)continue;
    seen.add(k);queue.push(q);
  }
}
assert.deepEqual([...reached].filter(Boolean).sort(),world.rooms.map(r=>r.id).sort(),'All 8 rooms reachable from entrance');
for(const [id,[x,z]]of Object.entries(WALK_STARTS))assert.ok(seen.has(key(Math.round(x/step),Math.round(z/step))),'Reach seed '+id);
const noSuiteDoor=buildWalkWorld({...data,doors:data.doors.filter(d=>d.id!=='door_bath_1')});
assert.equal(noSuiteDoor.canStand(4.695,3.28),false,'Suite door must be explicitly present');
assert.ok(world.canStand(4.695,3.28),'Suite passage is through master bedroom');
for(const [yaw,f,s]of [[0,1,0],[0,1,1],[Math.PI/2,1,0],[Math.PI,1,-1]]){const d=movementVector(yaw,f,s,1);near(Math.hypot(d.x,d.z),1,'Normalized movement')}
near(movementVector(0,1,0,1).z,-1);near(movementVector(Math.PI/2,1,0,1).x,1);
const thinWorld={canStand:(x,z,r=.25)=>x>=r&&x<=10-r&&z>=r&&z<=10-r&&Math.abs(x-5)>=r+.004,roomAt:()=>null};
const blocked=advanceWalk(thinWorld,{x:2,z:2},7,0);assert.ok(blocked.x<=4.746,'8mm glass cannot be tunnelled');
const slide=advanceWalk(thinWorld,{x:4.7,z:2},1,1);assert.ok(slide.x<4.75&&slide.z>2.99,'Slide along obstruction');
assert.deepEqual(advanceWalk(world,{x:4.3,z:13},NaN,0),{x:4.3,z:13});

class Node{
  constructor(name,doc){this.name=name;this.ownerDocument=doc;this.handlers=new Map();this.dataset={};this.style={};this.attrs={};this.captured=new Set();this.hidden=false;this.disabled=false;this.clientWidth=1000;this.clientHeight=700;const values=new Set();this.classList={add:c=>values.add(c),remove:c=>values.delete(c),contains:c=>values.has(c),toggle:(c,v)=>v?values.add(c):values.delete(c)}}
  addEventListener(type,fn){if(!this.handlers.has(type))this.handlers.set(type,new Set());this.handlers.get(type).add(fn)}
  removeEventListener(type,fn){this.handlers.get(type)?.delete(fn)}
  emit(type,props={}){const e={type,target:this,button:0,preventDefault(){this.defaultPrevented=true},...props};for(const fn of [...(this.handlers.get(type)||[])])fn(e);return e}
  setAttribute(k,v){this.attrs[k]=v} removeAttribute(k){delete this.attrs[k]}
  setPointerCapture(id){this.captured.add(id)} releasePointerCapture(id){this.captured.delete(id)}
  focus(){const doc=this.ownerDocument;if(doc?.activeElement!==this){doc?.activeElement?.emit('blur');if(doc)doc.activeElement=this}}
  getBoundingClientRect(){return {width:1000,height:700,top:0,left:0}}
  closest(selector){if(selector.includes('input')&&this.editable)return this;if(selector==='#walk-pad'&&this.dataset.walkDirection)return this;if(selector==='button,a,dialog'&&this.name.includes('button'))return this;return null}
}
function environment(){
  const doc=new Node('document');doc.hidden=false;doc.activeElement=null;doc.defaultView=new Node('window');doc.documentElement={dataset:{}};doc.baseURI='http://localhost/studio.html';
  const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,new Node(id,doc));return nodes.get(id)};
  const pads=['forward','left','back','right'].map(d=>{const n=node('button-'+d);n.dataset.walkDirection=d;return n});
  doc.querySelector=s=>s==='dialog[open]'?(doc.modal||null):node(s);
  doc.querySelectorAll=s=>s==='#walk-pad [data-walk-direction]'?pads:[];
  doc.createElement=s=>new Node(s,doc);
  node('#download-popover').hidden=true;
  return {doc,win:doc.defaultView,node,nodes,pads,canvas:node('canvas')};
}
const e=environment(),poses=[];let wakes=0,exits=0,allowed=true;
const emptyWorld={canStand:()=>true,roomAt:()=> 'living'};
const c=new WalkController({canvas:e.canvas,world:emptyWorld,onPose:p=>poses.push(p),onWake:()=>wakes++,onExit:()=>exits++,canInteract:()=>allowed});
e.pads.forEach(p=>c.bindPad(p,p.dataset.walkDirection));
const keyDown=code=>e.win.emit('keydown',{code,target:e.canvas}),keyUp=code=>e.win.emit('keyup',{code,target:e.canvas});
c.start({x:0,z:0});keyDown('KeyW');c.update(0);c.update(50);near(c.position.z,-.055);
c.update(10000);near(c.position.z,-.11,'Long frame capped to 50ms');
keyDown('ShiftLeft');c.update(10050);near(c.position.z,-.1325,'Precision speed');
keyUp('KeyW');keyUp('ShiftLeft');assert.equal(c.update(10100),false,'Idle frame ends');
keyDown('KeyE');c.update(11000);c.update(11050);near(c.yaw,.065);keyUp('KeyE');
e.canvas.emit('pointerdown',{pointerId:2,clientX:10,clientY:10});
e.canvas.emit('pointermove',{pointerId:2,clientX:110,clientY:10000});near(c.yaw,.465);near(c.pitch,-1.15);
e.canvas.emit('pointerup',{pointerId:2});assert.equal(c.look,null);assert.equal(e.canvas.captured.size,0);
c.start({x:0,z:0});
const pad=e.pads[0];pad.focus();pad.emit('pointerdown',{pointerId:10});
e.canvas.emit('pointerdown',{pointerId:11,clientX:0,clientY:0});assert.ok(c.pad.has(10),'Canvas focus does not release movement finger');
e.canvas.emit('pointermove',{pointerId:11,clientX:40,clientY:0});c.update(0);c.update(50);
assert.ok(c.position.x>0&&c.position.z<0,'Simultaneous touch look and walk');
e.canvas.emit('pointerup',{pointerId:11});assert.ok(c.pad.has(10));pad.emit('pointerup',{pointerId:10});assert.equal(c.pad.size,0);
pad.emit('keydown',{code:'Space'});assert.ok(c.pad.has('key-forward'));pad.emit('blur');assert.equal(c.pad.size,0);
for(const stop of [()=>e.win.emit('blur'),()=>{e.doc.hidden=true;e.doc.emit('visibilitychange');e.doc.hidden=false},()=>e.canvas.emit('pointercancel',{pointerId:12}),()=>{allowed=false;c.update(100);allowed=true}]){
  keyDown('KeyW');pad.emit('pointerdown',{pointerId:12});e.canvas.emit('pointerdown',{pointerId:13,clientX:0,clientY:0});stop();
  assert.equal(c.keys.size,0);assert.equal(c.pad.size,0);assert.equal(c.look,null);assert.equal(c.lastTime,null);assert.equal(pad.attrs['aria-pressed'],'false');assert.equal(pad.captured.size+e.canvas.captured.size,0);
}
// Releasing an opposing control must wake an otherwise idle renderer.
c.start({x:0,z:0});pad.emit('pointerdown',{pointerId:21});e.pads[2].emit('pointerdown',{pointerId:22});
assert.equal(c.update(0),false);const beforeRelease=wakes;e.pads[2].emit('pointerup',{pointerId:22});
assert.ok(wakes>beforeRelease);assert.equal(c.update(50),true);c.update(100);assert.ok(c.position.z<0);c.pause();
keyDown('KeyW');keyDown('KeyS');assert.equal(c.update(0),false);const beforeKeyRelease=wakes;keyUp('KeyS');assert.ok(wakes>beforeKeyRelease);assert.equal(c.update(50),true);c.pause();
e.win.emit('keydown',{code:'KeyW',target:e.canvas,repeat:true});assert.equal(c.keys.size,0,'Held repeat must not restart a paused walk');
pad.emit('keydown',{code:'Space',repeat:true});assert.equal(c.pad.size,0,'Held pad key must not restart');
for(const modifier of ['ctrlKey','metaKey','altKey']){
  const event=e.win.emit('keydown',{code:'KeyA',target:e.canvas,[modifier]:true});assert.ok(!event.defaultPrevented);assert.equal(c.keys.size,0);
  pad.emit('keydown',{code:'Space',[modifier]:true});assert.equal(c.pad.size,0);
}
const editable=new Node('input');editable.editable=true;e.win.emit('keydown',{code:'KeyW',target:editable});assert.equal(c.keys.size,0);
allowed=false;keyDown('Escape');assert.equal(exits,0,'Dialog Escape does not exit');allowed=true;keyDown('Escape');assert.equal(exits,1);
assert.ok(poses.every(p=>p.eyeHeight===1.6));assert.ok(wakes>0);
c.dispose();for(const n of [e.win,e.doc,e.canvas,...e.pads])for(const handlers of n.handlers.values())assert.equal(handlers.size,0,'Dispose listener');

// Run actual setup/start/stop/focus/switch/resize/tick against real Three.js
// camera/meshes and narrowly mocked DOM + renderer, without loading a browser.
const ui=environment(),camera=new THREE.PerspectiveCamera(37,1000/700,.35,80),calls={orbit:0,renders:0,frames:0,storage:0};
const controls={enabled:true,target:new THREE.Vector3(4.2,.6,7),maxDistance:45,update:()=>calls.orbit++};
const scene=new THREE.Scene(),model=new THREE.Group();
const glb=await readFile(new URL(catalog.schemes[0].model,root));
const gltf=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
const parents=new Map();gltf.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parents.set(c,i)));
const semantics=i=>{const out={};for(let p=i;p!==undefined;p=parents.get(p))for(const [k,v]of Object.entries(gltf.nodes[p].extras||{}))if(out[k]===undefined)out[k]=v;return out};
const doorNodes=gltf.nodes.map((n,i)=>({n,meta:semantics(i)})).filter(({n,meta})=>n.mesh!==undefined&&meta.kind==='door');
// Protect the one model-authored obstacle not represented by plan furniture.
assert.ok((await read('tools/build_blender.py')).includes('lamp(6.48,8.98)'),'Source-only lamp location must stay in sync');
assert.equal(world.canStand(6.48,8.80),false,'Floor lampshade blocks the virtual body');
const matrices=new Map(),matrix=i=>{
  if(matrices.has(i))return matrices.get(i);const n=gltf.nodes[i],m=new THREE.Matrix4();
  if(n.matrix)m.fromArray(n.matrix);else m.compose(new THREE.Vector3(...(n.translation||[0,0,0])),new THREE.Quaternion(...(n.rotation||[0,0,0,1])),new THREE.Vector3(...(n.scale||[1,1,1])));
  if(parents.has(i))m.premultiply(matrix(parents.get(i)));matrices.set(i,m);return m;
};
const shades=gltf.nodes.flatMap((n,i)=>{
  if(n.mesh===undefined||!n.name.includes('Pleated linen lampshade'))return [];
  const bounds=new THREE.Box3();
  for(const p of gltf.meshes[n.mesh].primitives){const a=gltf.accessors[p.attributes.POSITION];for(const x of [a.min[0],a.max[0]])for(const y of [a.min[1],a.max[1]])for(const z of [a.min[2],a.max[2]])bounds.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(matrix(i)))}
  return [bounds];
});
const shade=shades.find(b=>Math.abs(b.getCenter(new THREE.Vector3()).x-6.48)<.01&&Math.abs(b.getCenter(new THREE.Vector3()).z-8.98)<.01);
assert.ok(shade,'Actual GLB floor lampshade found');assert.ok(shade.min.x>=6.26-1e-5&&shade.max.x<=6.70+1e-5&&shade.min.z>=8.76-1e-5&&shade.max.z<=9.20+1e-5,'Supplementary collider encloses actual lampshade');
assert.equal(new Set(doorNodes.map(d=>d.meta.openingId)).size,8,'Actual GLB has eight door assemblies');
for(const {n,meta}of doorNodes){const m=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1),new THREE.MeshStandardMaterial());m.name=n.name;m.userData=meta;model.add(m)}
const context=vm.createContext({...walk,THREE,URL,URLSearchParams,console,document:ui.doc,window:ui.win,matchMedia:()=>({matches:false}),setTimeout:()=>0,clearTimeout:()=>{},requestAnimationFrame:()=>++calls.frames,cancelAnimationFrame:()=>{},performance:{now:()=>0},sessionStorage:{setItem:()=>calls.storage++},test:{data,manifest,catalog,camera,controls,scene,model,canvas:ui.canvas,calls}});
vm.runInContext(source.replace(/^import .*\r?\n/gm,'').replace(/\binit\(\);\s*$/,''),context);
vm.runInContext(`data=test.data;manifest=test.manifest;scheme=test.catalog.schemes[0];rooms=manifest.rooms;three=THREE;camera=test.camera;controls=test.controls;scene=test.scene;model=optimizeStaticModel(test.model,THREE,()=>{throw Error('Door should not be merged')});renderer={domElement:test.canvas,setSize:()=>{},render:()=>test.calls.renders++};state.ready=true;setupWalk();`,context);
const api=vm.runInContext('({startWalk,stopWalk,focusRoom,switchView,resizeScene,tick,state,walkthrough,walkWorld,walkDoorParts,walkSlidingParts,walkThresholds,setWalls,bindControls})',context);
assert.equal(ui.node('#start-walk').disabled,false);assert.equal(api.walkthrough.listeners.length,37,'Four direction pads and canvas input wired');
assert.ok(!api.walkDoorParts.some(p=>p.userData.openingId==='door_kitchen'),'Kitchen leaves must never disappear');
assert.equal(api.walkSlidingParts.length,18,'Three actual six-part sliding leaves');
assert.deepEqual([...new Set(api.walkSlidingParts.map(p=>p.userData.slidingPanelIndex))].sort(),[0,1,2]);
const closedPositions=api.walkSlidingParts.map(p=>p.position.clone());
assert.equal(world.canStand(5.36,11.90),false,'North parked stack blocks walking');
assert.ok(world.canStand(5.36,12.55),'Only the remaining south gap is passable');
assert.equal(api.walkThresholds.children.length,6,'The six other gaps need temporary floors; kitchen now has a persistent floor');
for(const floor of api.walkThresholds.children){
  const door=data.doors.find(d=>d.id===floor.userData.openingId),bounds=new THREE.Box3().setFromObject(floor);
  assert.ok(door&&door.id!=='entry_door');near(floor.position.x,(door.x1+door.x2)/200);near(floor.position.z,(door.y1+door.y2)/200);near(bounds.max.y,0);
}
const doorSnapshot=api.walkDoorParts.map(p=>p.visible);api.walkDoorParts[0].visible=false;doorSnapshot[0]=false;
for(const room of Object.keys(WALK_STARTS))for(const cut of [true,false])for(const card of [true,false]){
  api.state.room=room;api.state.roomCardVisible=card;ui.node('#room-card').hidden=!card;api.setWalls(cut);api.startWalk();
  assert.equal(api.state.walking,true);assert.equal(api.state.interior,true);assert.equal(controls.enabled,false);near(camera.position.y,1.6);near(camera.near,.045);
  assert.ok(api.walkDoorParts.every(p=>!p.visible));api.walkSlidingParts.forEach((p,i)=>{assert.ok(p.visible);assert.ok(p.position.equals(closedPositions[i].clone().add(new THREE.Vector3(...p.userData.slideOpenOffsetM))))});assert.equal(api.walkThresholds.visible,true);assert.equal(api.state.cutWalls,false);assert.equal(ui.node('#walk-hud').hidden,false);
  assert.equal(api.state.roomCardVisible,card);assert.equal(ui.node('#room-card').hidden,!card);
  const before=calls.orbit;api.tick(0);assert.equal(calls.orbit,before,'No Orbit update while walking');
  const position=camera.position.clone();api.resizeScene();assert.ok(position.equals(camera.position),'Resize does not refit walker');
  ui.doc.modal={};ui.win.emit('keydown',{code:'KeyW',target:ui.canvas});assert.equal(api.walkthrough.keys.size,0);ui.doc.modal=null;
  api.stopWalk();assert.equal(api.state.walking,false);assert.equal(controls.enabled,true);assert.equal(api.state.cutWalls,cut);near(camera.near,.35);
  assert.deepEqual(api.walkDoorParts.map(p=>p.visible),doorSnapshot);api.walkSlidingParts.forEach((p,i)=>assert.ok(p.position.equals(closedPositions[i])));assert.equal(api.walkThresholds.visible,false);assert.equal(ui.node('#walk-hud').hidden,true);assert.equal(api.state.roomCardVisible,card);
}
api.startWalk();api.switchView('plan');assert.equal(api.state.walking,false);assert.equal(api.state.view,'plan');
api.switchView('model');api.startWalk();api.focusRoom('room_b',false,false);assert.equal(api.state.walking,false);assert.equal(controls.enabled,true);
assert.equal(calls.storage,0,'Walking never overwrites saved card preference');
ui.node('#toggle-room-card').querySelector=()=>new Node('span');ui.node('#room-card').contains=()=>false;context.sessionStorage.getItem=()=> 'false';api.bindControls();
api.state.room='living';api.startWalk();ui.win.emit('pagehide');assert.equal(api.state.walking,false);near(camera.near,.35);assert.notEqual(camera.fov,64);
api.walkthrough.dispose();
for(const {n,meta}of doorNodes){const hidden=Boolean(isWalkDoorInfill(n.name,meta));assert.equal(Boolean(isWalkDoorInfill(n.name.replace(/[ /]/g,'_'),meta)),hidden,'GLTF sanitized mesh name');if(meta.openingId==='entry_door'||/jamb|head frame/.test(n.name))assert.equal(hidden,false)}
for(const id of ['start-walk','exit-walk','walk-help','walk-hud','walk-pad','walk-help-dialog'])assert.ok(html.includes(`id="${id}"`));
console.log(`PASS: 10 safe entries, ${seen.size} connected grid points / 8 rooms, wall/window/furniture barriers, swept movement, keyboard + two-pointer controls, 40 real viewer enter/exit cycles, preserved door/frame visibility and camera/card state. Offline only: no WebGL or browser visual QA.`);
