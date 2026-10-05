"""Surgical P2 public-room update from published family V3.10 (d81f065).

Keeps native purchased meshes and R3/private/kitchen/laundry architecture.
Eight affected views are re-rendered; twelve unchanged views remain explicit
historical references with their original bytes and provenance.

blender --background --threads 2 --python tools/refresh_family_public_p2.py -- --only-build
blender --background models/schemes/family/huiyayuan-wood.blend --threads 2
 --python tools/refresh_family_public_p2.py -- --reuse --render all --resolution 960 --samples 8
"""
import hashlib
import importlib.util
import json
import math
import subprocess
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('family_r3',ROOT/'tools/refresh_family_r3.py')
r3=importlib.util.module_from_spec(spec)
spec.loader.exec_module(r3)
family,b=r3.family,r3.b
SOURCE=b.MODEL_DIR/'design-data.json'
BASELINE=ROOT/'tmp/family-public-p2-baseline'
BASELINE_COMMIT='d81f065ef4287ee24592df6c372a8fe2d7a64c3b'
FRESH=('overall','living','dining','bay-living','entry-storage','sideboard','storage-library','living-wall')
CHAIR_MAP={'餐椅北1':'餐椅北','餐椅北2':'餐椅东1','餐椅南1':'餐椅东2','餐椅南2':'餐椅南'}
# Explicit presentation-only override: the north-opening garage's blank east
# cheek obscures the shoe station from the saved V3.11 camera.  Do not resave the
# native scene for a camera-only repair or pretend the other seven frames were
# made from a different blend.  The original and applied states are recorded.
RENDER_CAMERA_OVERRIDES={
    'entry-storage':((4.00,12.80,1.62),(5.08,13.54,1.23),19),
}


def ensure_baseline():
    """Restore immutable published inputs on a fresh checkout, if needed."""
    BASELINE.mkdir(parents=True,exist_ok=True)
    for name in ('huiyayuan-wood.blend','design-data.json','scene-manifest.json'):
        target=BASELINE/name
        if not target.exists():
            revision=BASELINE_COMMIT+':models/schemes/family/'+name
            blob=subprocess.run(['git','show',revision],cwd=ROOT,check=True,capture_output=True).stdout
            target.write_bytes(blob)


def mark(objects,data,**props):
    for obj in objects:
        obj['familyPublicP2RevisionId']=data['familyPublicP2Revision'].get('id','family-public-p2-3.11.0')
        for key,value in props.items():
            obj[key]=value


def item(data,name):
    return next(f for f in data['furniture'] if f['name']==name)


def native_item(f):
    key=str(f.get('id') or f['name'])
    return [o for o in bpy.context.scene.objects if o.get('furnitureId')==key or o.get('furnitureName')==f['name']]


def pose(f):
    face=f.get('face','north')
    if f.get('productKey')=='table':
        face='north' if f['w']>f['d'] else 'east'
    angle={'north':0,'east':-math.pi/2,'south':-math.pi,'west':-3*math.pi/2}[face]
    center=Vector(((f['x']+f['w']/2)/100,-(f['y']+f['d']/2)/100,0))
    return Matrix.Translation(center) @ Matrix.Rotation(angle,4,'Z')


def transform(objects,matrix,data,**props):
    assert objects,'Missing expected native object group'
    for obj in objects:
        obj.matrix_world=matrix @ obj.matrix_world
    mark(objects,data,publicP2PoseOnly=True,publicP2PoseMatrix=[list(row) for row in matrix],**props)


def purchased(old,data):
    pairs=[('三人沙发','三人沙发'),('四人餐桌','四人餐桌'),*CHAIR_MAP.items()]
    table_matrix=None
    for oldname,newname in pairs:
        before,after=item(old,oldname),item(data,newname)
        assert before['purchasedProductId']==after['purchasedProductId']
        assert sorted((before['w'],before['d']))==sorted((after['w'],after['d']))
        matrix=pose(after) @ pose(before).inverted()
        objects=native_item(before)
        transform(objects,matrix,data,publicP2PreviousFurnitureId=str(before.get('id') or oldname),
                  furnitureId=str(after.get('id') or newname),furnitureName=newname,furnitureFace=after.get('face','north'))
        for obj in objects:
            obj['purchasedValidatedEnvelopeCm']=json.dumps({'x':after['x'],'y':after['y'],'w':after['w'],'d':after['d'],'h':after['heightCm']})
        if after['productKey']=='table':
            table_matrix=matrix
    oldrug=old['modelAddons']['livingRugCm']
    newrug=data['modelAddons']['livingRugCm']
    assert [oldrug[k] for k in ('w','d')]==[newrug[k] for k in ('w','d')]
    rugs=[o for o in bpy.context.scene.objects if o.get('purchasedFurnitureRug')]
    assert len(rugs)==1
    transform(rugs,Matrix.Translation(((newrug['x']-oldrug['x'])/100,-(newrug['y']-oldrug['y'])/100,0)),data)
    # Keep lamp meshes, their height and their material; turn the two pendants
    # together with the actual fixed table, not above the former corridor.
    prefixes=('Dining pendant ceiling rose','Pendant thin suspension','Organic linen pendant','Pendant opal diffuser')
    lights=[o for o in bpy.context.scene.objects if o.name.startswith(prefixes) or o.name=='Dining ambient']
    assert len(lights)>=9
    transform(lights,table_matrix,data,publicP2Lighting='follows-purchased-table')


def unchanged_scope(old,data):
    for key in ('envelope','rooms','walls','wallSpecs','windows','doors','bayFitouts','wallFitouts','kitchenFitout'):
        assert old[key]==data[key], 'P2 must not change '+key
    for f in old['furniture']:
        if f['y']<632:
            assert f==item(data,f['name']), 'R3 furniture must remain exact'
    assert old['modelAddons']['livingFloorLampCm']==data['modelAddons']['livingFloorLampCm']
    oldparts={p['id']:p for p in old['laundry']['parts'] if p.get('roomId')!='living'}
    newparts={p['id']:p for p in data['laundry']['parts']}
    assert oldparts==newparts, 'Only living bookwall may be removed from laundry parts'
    for key in ('machines','counter','basin'):
        if key in old['laundry']:
            assert old['laundry'][key]==data['laundry'][key]


def public_fitout(old,data):
    before,after=item(old,'茶几'),item(data,'茶几')
    transform(native_item(before),pose(after) @ pose(before).inverted(),data)
    oldback=next(f for f in old['furniture'] if f.get('id')=='family_sofa_back_storage')
    newback=next(f for f in data['furniture'] if f.get('id')=='family_sofa_back_storage')
    assert all(oldback[k]==newback[k] for k in ('w','d','face','heightCm'))
    transform([o for o in bpy.context.scene.objects if o.get('storageFitoutId')=='sofa_back_storage'],
              pose(newback) @ pose(oldback).inverted(),data)
    living_ids={p['id'] for p in old['laundry']['parts'] if p.get('roomId')=='living'}
    removed=[]
    for obj in list(bpy.context.scene.objects):
        if obj.get('storageFitoutId')=='dining_sideboard_wall' or obj.get('laundryPartId') in living_ids or obj.get('furnitureId')=='living_east_bookcase':
            removed.append(obj.name)
            bpy.data.objects.remove(obj,do_unlink=True)
    fit=next(f for f in data['storageFitouts'] if f['id']=='dining_sideboard_wall')
    before=set(bpy.context.scene.objects)
    b.storage_fitouts({**data,'storageFitouts':[fit]})
    mark(set(bpy.context.scene.objects)-before,data)
    return removed


def garage(old,data):
    for obj in list(bpy.context.scene.objects):
        if obj.get('garageId')==old['garage']['id'] and not obj.get('garageItemId'):
            bpy.data.objects.remove(obj,do_unlink=True)
    for p in data['garage']['parts']:
        obj=b.block('P2 north-entry garage / '+p['id'],p['x']/100,p['y']/100,p['zCm']/100,
                    p['w']/100,p['d']/100,p['hCm']/100,mat=p['material'],bevel=.001,room='living')
        mark([obj],data,garagePartId=p['id'],garageRole=p['role'],garageId=data['garage']['id'])
    olditems={f['id']:f for f in old['garage']['items']}
    for f in data['garage']['items']:
        previous=olditems[f['id']]
        assert all(previous[k]==f[k] for k in ('w','d','rotationDeg','modelWidthCm','modelDepthCm'))
        objects=[o for o in bpy.context.scene.objects if o.get('garageItemId')==f['id']]
        matrix=Matrix.Translation(((f['x']-previous['x'])/100,-(f['y']-previous['y'])/100,(f['zCm']-previous['zCm'])/100))
        transform(objects,matrix,data,garageBaseCm=f['zCm'])
    # These are presentation fill lights, not proposed physical fixtures or
    # electrical design. Their revised direction reveals the north opening.
    for name,z,targetz in [('Family garage lower-level fill',1.10,.55),('Family garage upper-level fill',2.04,1.60)]:
        lamp=bpy.data.objects.get(name)
        if lamp:
            lamp.location=(2.87,-13.27,z)
            target=Vector((2.87,-13.72,targetz))
            lamp.rotation_euler=(target-lamp.location).to_track_quat('-Z','Y').to_euler()
            mark([lamp],data,publicP2Lighting='north-entry-garage-presentation')


def wall_art(data):
    b.CURRENT_ROOM='living'
    for i,p in enumerate(data['modelAddons']['livingWallArt']['items']):
        x,y,z,w,d,h=[p[k]/100 for k in ('x','y','zCm','w','d','hCm')]
        art_id='living-wall-art-'+str(i)
        def block(label,px,py,pz,pw,pd,ph,material):
            obj=b.block(art_id+' / '+label,px,py,pz,pw,pd,ph,mat=material,bevel=.001,kind='wall-art',room='living')
            mark([obj],data,livingWallArtId=art_id,wallArtPartRole=label)
            return obj
        border=.018
        block('canvas',x+.008,y+border,z+border,w-.008,d-2*border,h-2*border,'Cream')
        for yy in (y,y+d-border):
            block('frame stile',x,yy,z,w,border,h,'OakLight')
        for zz in (z,z+h-border):
            block('frame rail',x,y+border,zz,w,d-2*border,border,'OakLight')
        # Flat geometric art in the YZ plane, fully contained in the 30mm frame.
        def polygon(label,points,material,front=.006):
            mesh=bpy.data.meshes.new(art_id+' '+label)
            mesh.from_pydata([(x+front,-(y+u),z+v) for u,v in points],[],[tuple(range(len(points)))])
            mesh.update()
            obj=bpy.data.objects.new(art_id+' / '+label,mesh)
            bpy.context.collection.objects.link(obj)
            b.finish(obj,obj.name,material,kind='wall-art',room='living')
            mark([obj],data,livingWallArtId=art_id,wallArtPartRole=label)
        if i==0:
            polygon('sage horizon',[(.065,.095),(.535,.095),(.535,.265),(.065,.345)],'Sage')
            circle=[(.22+.12*math.cos(a*math.tau/48),.52+.12*math.sin(a*math.tau/48)) for a in range(48)]
            polygon('ochre sun',circle,'OakLight',.005)
            polygon('warm ground',[(.065,.095),(.535,.095),(.535,.16),(.065,.215)],'Terracotta',.004)
        else:
            polygon('pale field',[(.07,.085),(.53,.085),(.53,.715),(.07,.715)],'Stone')
            arch=[(.16,.16),(.44,.16),(.44,.47)]+[(.30+.14*math.cos(a*math.pi/24),.47+.14*math.sin(a*math.pi/24)) for a in range(25)]+[(.16,.16)]
            polygon('terracotta arch',arch,'Terracotta',.005)
            polygon('sage stripe',[(.095,.12),(.145,.12),(.145,.66),(.095,.66)],'Sage',.004)


def configure_views(data):
    r3.configure_views(data)
    b.VIEWS.update({
        'living':((4.55,10.37,1.62),(5.05,7.50,1.17),20),
        'dining':((4.70,12.68,1.62),(2.98,10.89,1.09),20),
        'entry-storage':((4.74,12.69,1.59),(3.60,13.55,1.25),17),
        'sideboard':((4.53,12.09,1.62),(2.37,10.80,1.31),19),
        'storage-library':((3.07,12.13,1.61),(2.93,13.64,1.35),17),
        'living-wall':((3.44,10.00,1.62),(6.51,8.14,1.34),19),
    })
    for name,settings in data['familyPublicP2Revision'].get('views',{}).items():
        b.VIEWS[name]=tuple(settings)


def interior_camera(name):
    pos,target,lens=RENDER_CAMERA_OVERRIDES.get(name,b.VIEWS[name])
    return {'position':b.three(pos),'target':b.three(target),'horizontalFov':round(math.degrees(2*math.atan(36/(2*lens))),2)}


def apply_render_overrides():
    records={}
    for name,(pos,target,lens) in RENDER_CAMERA_OVERRIDES.items():
        cam=bpy.data.objects[name]
        saved_state=b.render_camera_state(cam)
        cam.location=(pos[0],-pos[1],pos[2])
        cam.rotation_euler=(Vector((target[0],-target[1],target[2]))-cam.location).to_track_quat('-Z','Y').to_euler()
        cam.data.lens=lens
        bpy.context.view_layer.update()
        records[name]={
            'scope':'camera-only','script':'tools/refresh_family_public_p2.py',
            'reason':'北开储物库东侧白板遮挡原镜头；仅将玄关细节相机移向鞋柜与入户门，不改实体或照明。',
            'savedCameraState':saved_state,'savedCameraHash':b.render_camera_hash(saved_state),
            'positionMetersPlan':list(pos),'targetMetersPlan':list(target),'lensMm':lens,
        }
    return records


def record_render_overrides(records,rendered_names):
    path=b.MODEL_DIR/'scene-manifest.json'
    m=json.loads(path.read_text(encoding='utf-8'))
    for name,override in records.items():
        if name in rendered_names:
            m['renderedViews'][name]['cameraOverride']=override
    path.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')


def make_manifest(data,preserve=False):
    path=b.MODEL_DIR/'scene-manifest.json'
    current=json.loads(path.read_text(encoding='utf-8')) if preserve and path.exists() else {}
    m=json.loads((BASELINE/'scene-manifest.json').read_text(encoding='utf-8'))
    for key in ('renderedViews','baseBlendSha256','renderSpec','renderInheritance'):
        m.pop(key,None)
    m.update(version=data['version'],layout=data['layout'],familyPublicP2Revision=data['familyPublicP2Revision'],
             sourceSha256=hashlib.sha256(SOURCE.read_bytes().replace(b'\r\n',b'\n')).hexdigest())
    for key in ('garage','garageRevision','familyEntryRevision','familyFlowRevision','familyLaundryRevision','laundry','purchasedFurnitureRevision'):
        if key in data:m[key]=data[key]
    descriptions=data['familyPublicP2Revision'].get('roomDescriptions',{})
    for room in m['rooms']:
        if room['id'] in descriptions:
            copy=descriptions[room['id']]
            room['description']=copy.get('description','') if isinstance(copy,dict) else copy
            if isinstance(copy,dict):room['features']=copy.get('features',room.get('features',[]))
        if room['id'] in ('living','dining'):
            room['interiorCamera']=interior_camera(room['id'])
    fitby={fit['id']:fit for fit in data['storageFitouts']}
    for detail in m.get('storageDetails',[]):
        fit=fitby[detail['storageFitoutId']]
        for key in ('title','summary','dimensions','conditions','references'):
            detail[key]=fit.get(key,[] if key in ('dimensions','conditions','references') else '')
        detail['interiorCamera']=interior_camera(detail['id'])
    for detail in m.get('bayDetails',[]):
        if detail['id']=='bay-living':detail['interiorCamera']=interior_camera('bay-living')
    for detail in m.get('layoutDetails',[]):
        if detail['id']=='living-wall':
            detail.update(title='客厅东墙 · 双幅薄框挂画',summary='移除落地书架；保留阳台门、洗烘台及厨房大窗。',interiorCamera=interior_camera('living-wall'))
        if detail['id']=='storage-library':
            detail.update(title=data['garage']['title'],summary='北向四扇内折 · 双车分层；儿童车斜转抬取可行性待实车排演。',conditions=data['garage']['conditions'],interiorCamera=interior_camera('storage-library'))
    m['notes']=list(dict.fromkeys([
        '厘米设计数据转换为米；P2仅变更公共区家具与收纳，R3私密区、墙门窗、厨房及阳台实体保持不变。',
        '8张受影响公共区视角来自同一P2模型新渲染；12张未改空间保留明确历史来源，非新全屋光照计算。',
        *data['familyPublicP2Revision'].get('conditions',[]),*data.get('geometryNotes',[]),
        *data['garage'].get('conditions',[]),
    ]))
    if preserve and current.get('sourceSha256')==m['sourceSha256']:
        for key in ('renderedViews','baseBlendSha256','renderSpec','renderInheritance'):
            if key in current:m[key]=current[key]
    path.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')


def finish_inheritance():
    path=b.MODEL_DIR/'scene-manifest.json'
    m=json.loads(path.read_text(encoding='utf-8'))
    records=m.get('renderedViews',{})
    blend=hashlib.sha256((b.MODEL_DIR/'huiyayuan-wood.blend').read_bytes()).hexdigest()
    if not set(FRESH).issubset(records):return
    for name in FRESH:
        r=records[name]
        assert r['baseBlendSha256']==blend and r['sourceSha256']==m['sourceSha256'] and not r.get('retainedFrom')
        assert r['imageSha256']==hashlib.sha256((b.RENDER_DIR/(name+'.jpg')).read_bytes()).hexdigest()
    baseline=json.loads((BASELINE/'scene-manifest.json').read_text(encoding='utf-8'))
    references=sorted(set(b.VIEWS)-set(FRESH))
    assert len(references)==12 and len(b.VIEWS)==20
    for name in references:
        record=baseline['renderedViews'][name]
        assert record['imageSha256']==hashlib.sha256((b.RENDER_DIR/(name+'.jpg')).read_bytes()).hexdigest()
        chain={'commit':BASELINE_COMMIT,'manifest':'models/schemes/family/scene-manifest.json','view':name,
               'reason':'P2仅改变公区家具与收纳；此为未改私密区、厨房或阳台的已发布历史参考，非新帧，不代表重算全屋光照。'}
        if record.get('retainedFrom'):chain['previous']=record['retainedFrom']
        records[name]={**record,'retainedFrom':chain}
    m['renderInheritance']={'reviewedAt':'3.11.0','baselineCommit':BASELINE_COMMIT,'currentViews':list(FRESH),'referenceViews':references,
                            'note':'8张P2公区新渲染＋12张未改空间历史参考；原图与历史来源hash保持。'}
    path.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print('FAMILY_PUBLIC_P2_PROVENANCE_COMPLETE 8 fresh / 12 historical',flush=True)


def build(args,data):
    old=json.loads((BASELINE/'design-data.json').read_text(encoding='utf-8'))
    unchanged_scope(old,data)
    bpy.ops.wm.open_mainfile(filepath=str(BASELINE/'huiyayuan-wood.blend'))
    b.COLS.clear()
    for material in bpy.data.materials:b.MATS[material.name]=material
    b.THICK=data.get('wallThicknessCm',12)/100
    b.HEIGHT=data.get('wallHeightCm',270)/100
    purchased(old,data)
    removed=public_fitout(old,data)
    garage(old,data)
    wall_art(data)
    for name in FRESH:
        if bpy.data.objects.get(name):bpy.data.objects.remove(bpy.data.objects[name],do_unlink=True)
        b.camera(name,*b.VIEWS[name])
    b.configure_render(args)
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH':
            obj.hide_set(False)
            obj.hide_render=obj.get('kind')=='ceiling'
    bpy.context.scene.camera=bpy.data.objects['overall']
    bpy.context.scene['familyPublicP2Version']='3.11.0'
    make_manifest(data)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(b.MODEL_DIR/'huiyayuan-wood.blend'),compress=True)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH' and obj.get('kind') not in ('ceiling','backdrop'):obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(b.MODEL_DIR/'huiyayuan-wood.glb'),export_format='GLB',use_selection=True,
        export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True,
        export_texcoords=True,export_normals=True,export_materials='EXPORT',export_image_format='AUTO')
    print('FAMILY_PUBLIC_P2_NATIVE_COMPLETE',json.dumps({'removed':len(removed),'views':FRESH}),flush=True)


def main():
    args=b.parse_args()
    ensure_baseline()
    data=json.loads(SOURCE.read_text(encoding='utf-8'))
    assert data.get('familyPublicP2Revision',{}).get('version')=='3.11.0'
    configure_views(data)
    if not args.reuse:build(args,data)
    else:make_manifest(data,preserve=True)
    if not args.only_build:
        if args.render=='all':args.render=','.join(FRESH)
        assert set(args.render.split(',')).issubset(FRESH)
        # The old family wrapper rewrites the garage detail as an outward-fold
        # V3.5 doorway. P2 has its own manifest and fixed purchased furniture,
        # so render with the shared native camera/provenance routine directly.
        overrides=apply_render_overrides()
        family.original_render(args)
        record_render_overrides(overrides,args.render.split(','))
        finish_inheritance()


if __name__=='__main__':main()
