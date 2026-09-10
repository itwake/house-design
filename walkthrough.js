// First-person navigation in the existing model. Plan X/Y centimetres become
// Three.js X/Z metres. This is a virtual camera collision aid, not a clearance
// or accessibility certification. No furniture or architectural data is edited.
export const WALK_EYE_HEIGHT=1.6;
export const WALK_RADIUS=.25;
// Navigation starting points, not new furniture/architectural coordinates.
// Every point is revalidated against the current source before it is used.
export const WALK_STARTS={overall:[4.3,13],living:[3.9,8.8],dining:[4.55,12.8],room_a:[4.3,2.75],room_b:[2.55,2.5],room_c:[2.65,4.85],bath_1:[6.25,4.35],bath_2:[4.7,5.7],kitchen:[6.95,12.55],balcony:[7.25,10.4]};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(...v)=>v.every(Number.isFinite);
export function insidePolygon(x,z,points){
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[i],b=points[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
function segmentDistanceSq(x,z,a,b){
  const dx=b[0]-a[0],dz=b[1]-a[1],length=dx*dx+dz*dz;
  const t=length?clamp(((x-a[0])*dx+(z-a[1])*dz)/length,0,1):0;
  return (x-a[0]-t*dx)**2+(z-a[1]-t*dz)**2;
}
export function buildWalkWorld(data){
  if(data.unit!=='cm'||!data.envelope?.length||!data.walls?.length)throw Error('Missing calibrated walk geometry');
  const boundary=data.envelope.map(p=>p.map(v=>v/100));
  const rooms=data.rooms.map(r=>({id:r.id,points:r.points.map(p=>p.map(v=>v/100))}));
  const doors=(data.doors||[]).filter(d=>d.kind!=='entry-door'&&d.id!=='entry_door'&&(d.sillCm??0)<10&&(d.heightCm??210)>=180);
  const obstacles=[];
  const rect=(id,x,z,w,d,kind)=>{if(w>0&&d>0)obstacles.push({id,x,z,w,d,kind})};
  for(const [index,raw]of data.walls.entries()){
    const coords=raw.coords||raw,[ax,az,bx,bz]=coords.map(v=>v/100),horizontal=Math.abs(az-bz)<.001;
    if(!horizontal&&Math.abs(ax-bx)>.001)throw Error('Walk walls must match the axis-aligned model');
    const spec=data.wallSpecs?.find(s=>s.coords.every((v,i)=>v===coords[i])),thickness=(spec?.thicknessCm??12)/100;
    const start=Math.min(horizontal?ax:az,horizontal?bx:bz),end=Math.max(horizontal?ax:az,horizontal?bx:bz),fixed=horizontal?az:ax;
    const cuts=doors.map(d=>({...d,lo:Math.min(horizontal?d.x1:d.y1,horizontal?d.x2:d.y2)/100,hi:Math.max(horizontal?d.x1:d.y1,horizontal?d.x2:d.y2)/100})).filter(d=>Math.abs((horizontal?d.y1:d.x1)/100-fixed)<.005&&Math.abs((horizontal?d.y2:d.x2)/100-fixed)<.005&&d.lo>=start-.001&&d.hi<=end+.001).sort((a,b)=>a.lo-b.lo);
    const solid=(lo,hi,depth=thickness,id='wall-'+index,kind='wall')=>rect(id,horizontal?lo:fixed-depth/2,horizontal?fixed-depth/2:lo,horizontal?hi-lo:depth,horizontal?depth:hi-lo,kind);
    let cursor=start;
    for(const door of cuts){
      solid(cursor,door.lo);
      const frame=door.kind.includes('glass')?.038:.06;
      solid(door.lo,door.lo+frame,.145,door.id+'-jamb-a','jamb');
      solid(door.hi-frame,door.hi,.145,door.id+'-jamb-b','jamb');
      cursor=door.hi;
    }
    solid(cursor,end);
  }
  for(const [index,f]of (data.furniture||[]).entries()){
    const [x,z,w,d]=[f.x,f.y,f.w,f.d].map(v=>v/100);
    if(f.tone==='wet'&&f.name.includes('淋浴')){
      // Same fixed west screen and upright as build_blender.py: the shower
      // tray is floor, not a solid 90 x 141 cm obstacle.
      rect('shower-screen-'+index,x+.011,z+.02,.008,Math.min(.60,d-.67),'glass');
      rect('shower-upright-'+index,x+.006,z+.011,.018,.018,'glass');
    }else if(f.name.includes('马桶'))rect(f.id||f.name,x-.055,z-.005,w+.11,d+.005,'furniture');
    else rect(f.id||f.name,x,z,w,d,'furniture');
  }
  for(const fitout of data.bayFitouts||[])for(const p of fitout.parts||[]){
    // Standing cannot go through a tabletop or a chair. Aggregate accessory
    // and support boxes are not solid geometry and must not fill empty space.
    if(['desktop','chair'].includes(p.role))rect(p.id,p.x/100,p.y/100,p.w/100,p.d/100,'bay-furniture');
  }
  // This floor lamp is authored directly in build_blender.py, not in the
  // plan furniture list. Its 440 mm shade is the widest standing obstruction.
  // Keep the source coordinate/GLB bound regression in test_walkthrough.mjs.
  rect('living-floor-lamp',6.26,8.76,.44,.44,'model-addon');
  const canStand=(x,z,radius=WALK_RADIUS)=>{
    if(!finite(x,z,radius)||radius<0||!insidePolygon(x,z,boundary))return false;
    const r2=radius*radius-1e-10;
    for(let i=0;i<boundary.length;i++)if(segmentDistanceSq(x,z,boundary[i],boundary[(i+1)%boundary.length])<r2)return false;
    return !obstacles.some(o=>{const dx=x-clamp(x,o.x,o.x+o.w),dz=z-clamp(z,o.z,o.z+o.d);return dx*dx+dz*dz<r2||(radius===0&&x>o.x&&x<o.x+o.w&&z>o.z&&z<o.z+o.d)});
  };
  const roomAt=(x,z)=>rooms.find(r=>insidePolygon(x,z,r.points))?.id||null;
  return {boundary,rooms,doors,obstacles,canStand,roomAt};
}
export function advanceWalk(world,position,dx,dz,radius=WALK_RADIUS){
  let {x,z}=position;
  if(!finite(x,z,dx,dz)||!world.canStand(x,z,radius))return {x,z};
  // Continuous small substeps prevent tunnelling through 8 mm glass, thin
  // partitions and door jambs, even if a caller supplies a large movement.
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.02)),sx=dx/steps,sz=dz/steps;
  for(let i=0;i<steps;i++){
    if(world.canStand(x+sx,z+sz,radius)){x+=sx;z+=sz}
    else{
      if(world.canStand(x+sx,z,radius))x+=sx;
      if(world.canStand(x,z+sz,radius))z+=sz;
    }
  }
  return {x,z};
}
export function findWalkStart(world,roomId,preferred){
  const id=roomId==='overall'?'living':roomId==='dining'?'living':roomId;
  const room=world.rooms.find(r=>r.id===id);if(!room)return null;
  const desired=preferred&&finite(preferred.x,preferred.z)?preferred:{x:room.points.reduce((n,p)=>n+p[0],0)/room.points.length,z:room.points.reduce((n,p)=>n+p[1],0)/room.points.length};
  if(world.roomAt(desired.x,desired.z)===id&&world.canStand(desired.x,desired.z))return {...desired};
  const minX=Math.min(...room.points.map(p=>p[0])),maxX=Math.max(...room.points.map(p=>p[0])),minZ=Math.min(...room.points.map(p=>p[1])),maxZ=Math.max(...room.points.map(p=>p[1]));
  let best=null,score=Infinity;
  for(let x=minX+.025;x<maxX;x+=.05)for(let z=minZ+.025;z<maxZ;z+=.05){
    if(!insidePolygon(x,z,room.points)||!world.canStand(x,z))continue;
    const distance=(x-desired.x)**2+(z-desired.z)**2;
    if(distance<score){score=distance;best={x,z}}
  }
  return best;
}
export function isWalkDoorInfill(name,metadata){
  return metadata.kind==='door'&&metadata.openingId&&metadata.openingId!=='entry_door'&&/oak door leaf|handle escutcheon|lever handle|clear glazing|mullion/.test(String(name).replace(/[_/]+/g,' ').replace(/\s+/g,' '));
}
export function movementVector(yaw,forward,strafe,distance){
  const length=Math.max(1,Math.hypot(forward,strafe));
  return {x:(Math.sin(yaw)*forward+Math.cos(yaw)*strafe)*distance/length,z:(-Math.cos(yaw)*forward+Math.sin(yaw)*strafe)*distance/length};
}

// Drag-to-look works without Pointer Lock, including mobile Safari. Keep one
// captured look pointer separate from any number of movement-pad pointers.
export class WalkController{
  constructor({canvas,world,onPose,onWake,onExit,canInteract=()=>true}){
    Object.assign(this,{canvas,world,onPose,onWake,onExit,canInteract});
    this.active=false;this.keys=new Set();this.pad=new Map();this.look=null;this.lastTime=null;
    this.doc=canvas.ownerDocument;this.win=this.doc.defaultView;
    this.listeners=[];
    this.listen=(target,type,fn,options)=>{target.addEventListener(type,fn,options);this.listeners.push(()=>target.removeEventListener(type,fn,options))};
    this.listen(this.win,'keydown',e=>this.key(e,true));this.listen(this.win,'keyup',e=>this.key(e,false));
    this.listen(this.win,'blur',()=>this.pause());
    this.listen(this.doc,'visibilitychange',()=>{if(this.doc.hidden)this.pause()});
    this.listen(canvas,'pointerdown',e=>{
      if(!this.allowed()||this.look||(e.button!==undefined&&e.button!==0))return;
      e.preventDefault();this.look={id:e.pointerId,x:e.clientX,y:e.clientY};
      canvas.setPointerCapture?.(e.pointerId);canvas.focus({preventScroll:true});
    });
    this.listen(canvas,'pointermove',e=>{
      if(!this.allowed()||this.look?.id!==e.pointerId)return;
      this.yaw+=(e.clientX-this.look.x)*.004;this.pitch=clamp(this.pitch-(e.clientY-this.look.y)*.004,-1.15,1.15);
      this.look.x=e.clientX;this.look.y=e.clientY;this.publish();this.onWake();
    });
    const release=e=>{if(this.look?.id===e.pointerId){this.look=null;try{canvas.releasePointerCapture?.(e.pointerId)}catch{}}};
    this.listen(canvas,'pointerup',release);this.listen(canvas,'pointercancel',()=>this.pause());this.listen(canvas,'lostpointercapture',release);
  }
  allowed(){return this.active&&!this.doc.hidden&&this.canInteract()}
  start(position,yaw=0){
    this.pause();this.active=true;this.position={...position};this.yaw=yaw;this.pitch=0;this.publish();this.onWake();
    this.canvas.focus({preventScroll:true});
  }
  stop(){this.pause();this.active=false}
  pause(){
    this.keys.clear();this.lastTime=null;
    for(const [id,{button}]of this.pad){button.classList.remove('is-pressed');button.setAttribute('aria-pressed','false');this.pad.delete(id);try{button.releasePointerCapture?.(id)}catch{}}
    if(this.look){const id=this.look.id;this.look=null;try{this.canvas.releasePointerCapture?.(id)}catch{}}
  }
  key(e,down){
    const code=e.code;
    if(!down){if(this.keys.delete(code)&&this.active)this.onWake();return}
    if(!this.allowed()||e.ctrlKey||e.metaKey||e.altKey||e.target?.closest?.('input,textarea,select,[contenteditable="true"]')||(e.repeat&&!this.keys.has(code)))return;
    if(code==='Escape'){e.preventDefault();this.onExit();return}
    if(!['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyQ','KeyE','ShiftLeft','ShiftRight'].includes(code))return;
    e.preventDefault();this.keys.add(code);this.onWake();
  }
  bindPad(button,direction){
    const press=(id,e)=>{if(!this.allowed())return;e.preventDefault();this.pad.set(id,{button,direction});button.classList.add('is-pressed');button.setAttribute('aria-pressed','true');this.onWake()};
    const release=id=>{if(!this.pad.has(id))return;this.pad.delete(id);if(![...this.pad.values()].some(p=>p.button===button)){button.classList.remove('is-pressed');button.setAttribute('aria-pressed','false')}if(this.active)this.onWake()};
    this.listen(button,'pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;press(e.pointerId,e);if(this.pad.has(e.pointerId))button.setPointerCapture?.(e.pointerId)});
    this.listen(button,'pointerup',e=>{release(e.pointerId);try{button.releasePointerCapture?.(e.pointerId)}catch{}});
    this.listen(button,'pointercancel',()=>this.pause());this.listen(button,'lostpointercapture',e=>release(e.pointerId));
    this.listen(button,'keydown',e=>{if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&['Space','Enter'].includes(e.code)&&(!e.repeat||this.pad.has('key-'+direction)))press('key-'+direction,e)});
    this.listen(button,'keyup',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();release('key-'+direction)}});
    // Focusing the canvas with a second touch must not release the first
    // finger's movement pad. Only keyboard-held buttons end on element blur.
    this.listen(button,'blur',()=>{for(const [id,p]of this.pad)if(p.button===button&&typeof id==='string')release(id)});
  }
  publish(){this.onPose({...this.position,yaw:this.yaw,pitch:this.pitch,eyeHeight:WALK_EYE_HEIGHT,roomId:this.world.roomAt(this.position.x,this.position.z)})}
  update(time){
    if(!this.allowed()){this.pause();return false}
    const dt=this.lastTime===null?0:clamp((time-this.lastTime)/1000,0,.05);this.lastTime=time;
    const directions=new Set([...this.pad.values()].map(p=>p.direction)),has=(...codes)=>codes.some(c=>this.keys.has(c));
    const forward=Number(has('KeyW','ArrowUp')||directions.has('forward'))-Number(has('KeyS','ArrowDown')||directions.has('back'));
    const strafe=Number(has('KeyD','ArrowRight')||directions.has('right'))-Number(has('KeyA','ArrowLeft')||directions.has('left'));
    const turn=Number(has('KeyE'))-Number(has('KeyQ'));
    if(!forward&&!strafe&&!turn){this.lastTime=null;return false}
    this.yaw+=turn*dt*1.3;
    const delta=movementVector(this.yaw,forward,strafe,dt*(has('ShiftLeft','ShiftRight')?.45:1.1));
    this.position=advanceWalk(this.world,this.position,delta.x,delta.z);this.publish();return true;
  }
  dispose(){this.stop();this.listeners.forEach(remove=>remove());this.listeners=[]}
}
