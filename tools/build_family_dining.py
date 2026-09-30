"""Native endpoint models for the shallow-cabinet family dining proposal.

This is a spatial prototype, not a reconstruction/certification of Lunch +39
hardware. Both complete furniture states are exported; only one is rendered.
"""
import json
import math
from types import SimpleNamespace

import bpy
from mathutils import Matrix, Vector

PENDANT_NAMES=('Dining pendant ceiling rose','Pendant thin suspension',
               'Organic linen pendant','Pendant opal diffuser')
SHELF_PART_IDS=set()


def tag_group(objects, data, state, element, furniture=None):
    config=data['pulloutDining']
    for obj in objects:
        obj['diningFitoutId']=config['id']
        obj['diningElement']=element
        obj['diningGeometryStatus']='conditional endpoint prototype; hardware motion not certified'
        if state:
            obj['diningVisibility']=state
            obj.hide_render=state=='closed'
        if furniture:
            obj['furnitureId']=str(furniture.get('id') or furniture['name'])
            obj['furnitureName']=furniture['name']
            obj['furnitureFace']=furniture.get('face','east')
        else:
            obj['furnitureId']=config['id']
            obj['furnitureName']='抽拉餐桌五金端状态示意'


def table_cabinet(b,p):
    """44 cm exterior, 40 cm clear-depth placeholder with a true empty pocket."""
    if p.get('face','east')!='east':raise ValueError('The family table cabinet must face east')
    x,y,w,d=[float(p[k])/100 for k in ('x','y','w','d')]
    z,h=float(p.get('zCm',0))/100,float(p['hCm'])/100
    before=set(bpy.context.scene.objects);name=p['id'];t=.020
    def panel(label,px,py,pz,pw,pd,ph,mat='OakLight'):
        return b.block(name+' / '+label,px,py,pz,pw,pd,ph,mat=mat,bevel=0)
    # Full height side gables, a 20 mm back, and separate stone top.
    for py in (y,y+d-t):panel('full-height side gable',x,py,z+.075,w,t,h-.095)
    panel('20mm cabinet back',x,y+t,z+.075,t,d-2*t,h-.095)
    panel('recessed plinth',x+.03,y+.02,z,w-.06,d-.04,.075,'WarmGrayMetal')
    panel('lower compartment floor',x+t,y+t,z+.075,w-2*t,d-2*t,t)
    # The lower sliding leaves use staggered front tracks. Pull this internal
    # shelf 30 mm back from the nominal clear-depth limit to keep both moving
    # door planes physically clear (the back leaf begins 27 mm inside it).
    shelf=panel('lower compartment shelf',x+t,y+t,z+.33,w-2*t-.03,d-2*t,.018)
    shelf['lowerSlidingDoorTrackClearanceCm']=.3
    panel('table-pocket floor',x+t,y+t,z+.65,w-2*t,d-2*t,t)
    panel('table-pocket ceiling',x+t,y+t,z+.79,w-2*t,d-2*t,t)
    panel('front header above pocket',x+w-t,y+t,z+.80,t,d-2*t,.03,'Cream')
    panel('850mm stone counter',x,y,z+h-t,w,d,t,'Stone')
    # Fixed guides lie below both stored leaves. The 120 mm empty pocket is
    # z67..79cm; no solid "drawer" box may fill this usable installation zone.
    for py in (y+.0425,y+d-.0575):
        panel('fixed nested guide channel',x+t,py,z+.672,w-2*t,.015,.015,'WarmGrayMetal')
    clear=d-.04;overlap=.026;span=(clear+overlap)/2
    for idx in range(2):
        py=y+.02+idx*(span-overlap)
        inset=.014+idx*.024
        panel('lower sliding front',x+w-inset-.009,py,z+.105,.018,span,.525,'Cream')
        panel('recessed lower finger pull',x+w-inset+.002,py+span*.70,z+.39,.002,.014,.10,'WarmGrayMetal')
    for obj in set(bpy.context.scene.objects)-before:
        obj['diningFitoutId']='family_pullout_dining'
        obj['diningElement']='table-cabinet'
        obj['tablePocketMinCm']=67.0;obj['tablePocketMaxCm']=79.0
        obj['tablePocketClearHeightCm']=12.0
        obj['installationFitConfirmed']=False


def register(b):
    original=b.storage_part
    def storage_part(p):
        if p['role']=='pullout_table_cabinet':return table_cabinet(b,p)
        result=original(p)
        if p['id'] in SHELF_PART_IDS:retreat_sideboard_shelf(p)
        return result
    b.storage_part=storage_part


def retreat_sideboard_shelf(part):
    """Trim the actual canonical front vertex plane, preserving room transform.

    Generic shelf's old front is depth-22.5mm; back-track door's inner face
    is depth-47mm. A 30mm retreat therefore leaves 5.5mm real separation.
    Only this current-family revision's explicit part IDs opt in.
    """
    name=part['id']+' / full-height cupboard interior shelf'
    obj=bpy.data.objects.get(name)
    if not obj or obj.type!='MESH':raise ValueError('Missing detailed sliding-cabinet shelf '+name)
    if obj.get('familyShelfFrontRetreatCm')==3.0:return 0
    if obj.data.users!=1:raise ValueError('Cannot independently trim a shared shelf mesh '+name)
    for vertex in obj.data.vertices:
        if vertex.co.x>0:vertex.co.x-=.030
    obj.data.update();obj['familyShelfFrontRetreatCm']=3.0
    obj['lowerSlidingDoorTrackClearanceCm']=.55
    return 1


def repair_lower_shelf(b,data):
    """Precision repair of the same part in an already-built 3.5.3 scene."""
    part=next(p for fitout in data['storageFitouts'] for p in fitout['parts']
              if p['role']=='pullout_table_cabinet')
    name=part['id']+' / lower compartment shelf'
    old=bpy.data.objects.get(name)
    if not old:raise ValueError('Missing current table-cabinet shelf '+name)
    if old.get('storagePartId')!=part['id']:raise ValueError('Shelf metadata does not match source')
    metadata={key:old[key] for key in old.keys()}
    x,y,w,d=[part[k]/100 for k in ('x','y','w','d')];z=part.get('zCm',0)/100
    bpy.data.objects.remove(old,do_unlink=True);b.CURRENT_ROOM='living'
    obj=b.block(name,x+.02,y+.02,z+.33,w-.07,d-.04,.018,mat='OakLight',bevel=0)
    for key,value in metadata.items():obj[key]=value
    obj['lowerSlidingDoorTrackClearanceCm']=.3
    return 1


def repair_current_shelves(b,data):
    changed=repair_lower_shelf(b,data)
    for fitout in data['storageFitouts']:
        for part in fitout['parts']:
            if part['id'] in SHELF_PART_IDS:changed+=retreat_sideboard_shelf(part)
    return changed


def configure_views(b,data):
    global SHELF_PART_IDS
    SHELF_PART_IDS={p['id'] for f in data.get('storageFitouts',[])
                    if f['id'] in ('dining_sideboard_wall','sofa_back_storage')
                    for p in f['parts'] if p['role']=='sideboard_base'} if data.get('familyDiningRevision') else set()
    if not data.get('familyDiningRevision'):return
    # A common real camera makes the two endpoint photos directly comparable.
    table=data['pulloutDining']['table']
    center=((table['x']+table['w']/2)/100,(table['y']+table['d']/2)/100)
    old=b.VIEWS['dining']
    b.VIEWS['dining']=(old[0],(center[0],center[1],1.02),old[2])
    b.VIEWS['dining-closed']=b.VIEWS['dining']


def oriented_chair(b,data,f,state):
    """Rotate every native chair component, not merely its face metadata."""
    face=f.get('face','south');x,y,w,d=[f[k]/100 for k in ('x','y','w','d')]
    span,depth=(d,w) if face in ('east','west') else (w,d)
    canonical={**f,'x':0,'y':0,'w':span*100,'d':depth*100,'face':'south'}
    before=set(bpy.context.scene.objects);b.chair(canonical)
    bpy.context.view_layer.update()
    angle={'south':0,'north':math.pi,'east':math.pi/2,'west':-math.pi/2}[face]
    transform=(Matrix.Translation(Vector((x+w/2,-(y+d/2),0)))
               @ Matrix.Rotation(angle,4,'Z')
               @ Matrix.Translation(Vector((-span/2,depth/2,0))))
    objects=set(bpy.context.scene.objects)-before
    for obj in objects:
        obj.matrix_world=transform @ obj.matrix_world
        obj.name=f['name']+' / '+state+' / '+obj.name
    tag_group(objects,data,state,'chair',f)


def table_endpoints(b,data):
    cfg=data['pulloutDining'];table=cfg['table'];closed=cfg['closedTable']
    x,y,w,d=[table[k]/100 for k in ('x','y','w','d')]
    thickness=cfg.get('tabletopThicknessCm',2)/100
    top=cfg.get('tableHeightCm',table.get('heightCm',75))/100
    for state in ('expanded','closed'):
        for index in range(2):
            before=set(bpy.context.scene.objects)
            if state=='expanded':
                px,py,pw,pd,pz=x+index*w/2,y,w/2,d,top-thickness
            else:
                px,py,pw,pd=[closed[k]/100 for k in ('x','y','w','d')]
                pz=(closed['zCm'] if index==0 else closed['secondBoardZCm'])/100
            obj=b.block('Pullout table / '+state+' / folding leaf '+str(index),px,py,pz,pw,pd,thickness,mat='OakLight',bevel=.004)
            obj['tableLeafId']='leaf-'+str(index);obj['tableLeafIndex']=index
            tag_group(set(bpy.context.scene.objects)-before,data,state,'table-top',table)
        before=set(bpy.context.scene.objects)
        module=cfg['module'];mx,my,mw,md=[module[k]/100 for k in ('x','y','w','d')]
        if state=='closed':
            b.block('Pullout table / closed / flush drawer front',mx+mw-.02,my,.65,.02,md,.15,mat='Cream',bevel=.002)
            b.block('Pullout table / closed / flush finger recess',mx+mw-.003,my+md/2-.045,.708,.002,.09,.025,mat='WarmGrayMetal',bevel=.001)
        else:
            # An open front flap and under-top telescoping segments describe
            # the end pose only. No invisible/full-solid box or four fixed legs.
            b.block('Pullout table / expanded / lowered front flap',mx+mw,my,.65,.15,md,.02,mat='Cream',bevel=.003)
            for py in (y+.02,y+d-.035):
                for idx,(px,pw,pz,ph) in enumerate(((x-.02,.32,.706,.016),(x+.30,.29,.710,.012),(x+.59,w-.59,.714,.012))):
                    b.block('Pullout table / expanded / telescoping guide '+str(idx),px,py,pz,pw,.015,ph,mat='WarmGrayMetal',bevel=.001)
                b.block('Pullout table / expanded / guide mounting riser',x-.02,py,.687,.018,.015,.039,mat='WarmGrayMetal',bevel=.001)
            for py in (y+.055,y+d-.095):
                b.block('Pullout table / expanded / folding hinge',x+w/2-.006,py,.723,.012,.04,.005,mat='WarmGrayMetal',bevel=.001)
        tag_group(set(bpy.context.scene.objects)-before,data,state,'mechanism')
    for f in data['furniture']:
        if f.get('diningFitoutId')==cfg['id'] and '椅' in f['name']:oriented_chair(b,data,f,'expanded')
    for f in cfg['closedFurniture']:oriented_chair(b,data,f,'closed')


def pendants(b,data):
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith(PENDANT_NAMES):bpy.data.objects.remove(obj,do_unlink=True)
    b.CURRENT_ROOM='living';cx,cy,w,d=b.dining_anchor(data)
    before=set(bpy.context.scene.objects)
    for fraction,z,r in ((-5/24,2.05,.18),(11/60,2.17,.13)):
        py=cy+d*fraction
        b.cylinder('Dining pendant ceiling rose',cx,py,2.67,.055,.025,'Cream')
        b.rod('Pendant thin suspension',(cx,py,2.67),(cx,py,z+.12),.003,'Charcoal')
        b.cylinder('Organic linen pendant',cx,py,z-.06,r,.18,'Linen',r2=r*.64)
        b.cylinder('Pendant opal diffuser',cx,py,z-.065,r*.90,.01,'Lamp')
    for obj in set(bpy.context.scene.objects)-before:
        obj['diningFitoutId']=data['pulloutDining']['id'];obj['diningElement']='fixed-pendant'
        obj['furnitureId']='family_dining_pendants'


def furnish(b,data):
    if not data.get('familyDiningRevision'):return
    b.CURRENT_ROOM='living';table_endpoints(b,data);pendants(b,data)
    set_state('expanded')


def relocate_ambient(b,data):
    obj=bpy.data.objects.get('Dining ambient')
    if obj:
        x,y,_,_=b.dining_anchor(data);obj.location=(x,-y,2.60)
        obj.rotation_euler=(Vector((x,-y,0))-obj.location).to_track_quat('-Z','Y').to_euler()
        obj['diningFitoutId']=data['pulloutDining']['id']
        obj['diningElement']='fixed-light'


def set_state(state):
    if state not in ('expanded','closed'):raise ValueError('Invalid dining state '+state)
    for obj in bpy.context.scene.objects:
        tagged=obj.get('diningVisibility')
        if tagged:obj.hide_render=tagged!=state


def manifest(b,data,result):
    if not data.get('familyDiningRevision'):return result
    result['familyDiningRevision']=data['familyDiningRevision'];result['pulloutDining']=data['pulloutDining']
    result['notes']+=data['pulloutDining']['conditions']
    for room in result['rooms']:
        if room['id']=='dining':
            room['description']='西餐柜局部外深暂按440mm，1155×705mm抽拉桌展开为四席；收起时两块桌板位于柜内，四把完整餐椅沿西柜停放。桌面750mm与餐柜850mm分别表达，五金兼容性、运动和承载待厂家深化。'
            room['features'].append('两种真实端状态：展开用餐 / 收起并保留四椅占地')
        elif room['id']=='living':
            room['description']='暂按2000mm宽沙发继续东移，背后增加2000×250×650mm浅低储物柜，向餐区开移门；茶几同向平移，西侧低飘窗保留。东侧书架前暂留600mm通路，尺寸与防倾倒固定均待复尺深化。'
    for item in result.get('storageDetails',[]):
        if item.get('storageFitoutId')=='sofa_back_storage':
            pos,target,lens=b.VIEWS['dining'];item.update(id='sofa-back-storage',render='assets/schemes/family/dining.jpg',interiorCamera={'position':b.three(pos),'target':b.three(target),'horizontalFov':round(math.degrees(2*math.atan(36/(2*lens))),2)})
    pos,target,lens=b.VIEWS['dining-closed']
    result.setdefault('layoutDetails',[]).append({'id':'dining-closed','title':'抽桌收起 · 四把完整餐椅沿柜停放','roomId':'living','render':'assets/schemes/family/dining-closed.jpg','diningState':'closed','interiorCamera':{'position':b.three(pos),'target':b.three(target),'horizontalFov':round(math.degrees(2*math.atan(36/(2*lens))),2)}})
    return result


def render(b,args,original_render):
    names=list(b.VIEWS) if args.render=='all' else args.render.split(',')
    try:
        for name in names:
            state='closed' if name=='dining-closed' else 'expanded';set_state(state)
            native=SimpleNamespace(**vars(args));native.render=name
            original_render(native)
            path=b.MODEL_DIR/'scene-manifest.json';result=json.loads(path.read_text(encoding='utf-8'))
            result['renderedViews'][name]['diningState']=state
            path.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    finally:set_state('expanded')
