"""Correct only the two guarded, open-air balcony boundaries in three schemes.

Published f9f4cb9 native scenes are immutable inputs.  Furniture, kitchen inner
window, every other wall and all existing skirting remain native originals.
Example: blender --background --threads 2 --python tools/refresh_balcony_openness.py
 -- --scheme family --only-build --resolution 960 --samples 8
Then open the saved blend and run this script with --scheme family --reuse.
"""
import argparse
import copy
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import subprocess
import sys

import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('balcony_base',ROOT/'tools/build_blender.py')
b=importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)
BASELINE_COMMIT='f9f4cb94ecf2bbdc39ab6e6ba086956081457c27'
NEW_BALCONY=((6.82,10.08,1.62),(8.12,10.18,1.48),16)
ORIGINAL_CONFIGURE=b.configure_render
SAVED_COLOR=None


def parse_args():
    cli=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    p=argparse.ArgumentParser()
    p.add_argument('--scheme',choices=['wood','family','laundry'],required=True)
    p.add_argument('--only-build',action='store_true')
    p.add_argument('--reuse',action='store_true')
    p.add_argument('--render',default='all')
    p.add_argument('--resolution',type=int,default=960)
    p.add_argument('--samples',type=int,default=8)
    p.add_argument('--engine',choices=['CYCLES','BLENDER_EEVEE_NEXT'],default='CYCLES')
    return p.parse_args(cli)


def write_json(path,data):
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def setup(args):
    b.MODEL_DIR=ROOT/'models/schemes'/args.scheme
    b.RENDER_DIR=ROOT/'assets/schemes'/args.scheme
    b.TEX_DIR=b.MODEL_DIR/'textures'
    baseline=ROOT/'tmp/balcony-openness-baseline'/args.scheme
    baseline.mkdir(parents=True,exist_ok=True)
    for name in ('huiyayuan-wood.blend','design-data.json','scene-manifest.json'):
        target=baseline/name
        if not target.exists():
            blob=subprocess.run(['git','show',BASELINE_COMMIT+':models/schemes/'+args.scheme+'/'+name],cwd=ROOT,check=True,capture_output=True).stdout
            target.write_bytes(blob)
    base_manifest=json.loads((baseline/'scene-manifest.json').read_text(encoding='utf-8'))
    b.VIEWS={name:None for name in base_manifest['renderedViews']}
    fresh=['overall','balcony','laundry-detail','kitchen-north']
    if args.scheme!='wood':fresh.append('living-wall')
    return baseline,base_manifest,fresh


def configure_render(args):
    ORIGINAL_CONFIGURE(args)
    # Keep the released scheme's color management. Opening the balcony must not
    # silently change wood exposure from -0.25 to the generic +0.25 default.
    if SAVED_COLOR:
        scene=bpy.context.scene
        scene.view_settings.view_transform=SAVED_COLOR[0]
        scene.view_settings.look=SAVED_COLOR[1]
        scene.view_settings.exposure=SAVED_COLOR[2]


b.configure_render=configure_render


def mark(obj,data,op,role,index,coords):
    obj['balconyOpennessRevisionId']=data['balconyOpennessRevision']['id']
    obj['balconyOpeningId']=op['id']
    obj['openingId']=op['id']
    obj['balconyOpeningRole']=role
    obj['parentWallIndex']=index
    obj['sourceWallCoords']=coords
    obj['windowType']='guarded-open-air'
    obj['glazing']=False


def guards(data,op,index,coords):
    horizontal=op['y1']==op['y2']
    start=min(op['x1'],op['x2'])/100 if horizontal else min(op['y1'],op['y2'])/100
    fixed=op['y1']/100 if horizontal else op['x1']/100
    length=(abs(op['x2']-op['x1']) if horizontal else abs(op['y2']-op['y1']))/100
    z,h=op['sillCm']/100,op['heightCm']/100
    g=op['guard'];frame=g['frameCm']/100;bar=g['barWidthCm']/100;spacing=g['nominalSpacingCm']/100
    def part(label,along,bottom,width,height):
        x,y,w,d=(along,fixed-frame/2,width,frame) if horizontal else (fixed-frame/2,along,frame,width)
        obj=b.block(op['id']+' / '+label,x,y,bottom,w,d,height,mat='WindowMetal',bevel=.0007,kind='window',room='balcony')
        mark(obj,data,op,label,index,coords)
    part('frame-start',start,z,frame,h)
    part('frame-end',start+length-frame,z,frame,h)
    part('frame-bottom',start+frame,z,length-2*frame,frame)
    part('frame-top',start+frame,z+h-frame,length-2*frame,frame)
    bays=max(1,math.ceil((length-2*frame)/spacing))
    for i in range(1,bays):
        center=start+frame+(length-2*frame)*i/bays
        part('vertical-bar-'+str(i),center-bar/2,z+frame,bar,h-2*frame)


def wall_update(old,data):
    rev=data['balconyOpennessRevision']
    ids=set(rev['openingIds'])
    assert data['walls']==old['walls'] and data['wallSpecs']==old['wallSpecs']
    assert [w for w in data['windows'] if w['id'] not in ids]==old['windows']
    for key in ('envelope','rooms','doors','furniture','storageFitouts','wallFitouts','kitchenFitout','laundry','modelAddons'):
        assert data.get(key)==old.get(key),'Unrelated data changed: '+key
    ops=[w for w in data['windows'] if w['id'] in ids]
    assert len(ops)==2 and all(o['windowType']=='guarded-open-air' and o['glazing'] is False for o in ops)
    coordinates=[rev['northWall'],rev['eastWall']]
    indices=[data['walls'].index(c) for c in coordinates]
    removed=[]
    for obj in list(bpy.context.scene.objects):
        # Continuous lower parapets mean all original skirting is still valid.
        if obj.get('wallIndex') in indices and not obj.name.startswith('Skirting '):
            removed.append(obj.name)
            bpy.data.objects.remove(obj,do_unlink=True)
    for coords,index in zip(coordinates,indices):
        op=next(o for o in ops if (o['y1']==o['y2'])==(coords[1]==coords[3]))
        local=copy.deepcopy(data)
        local['walls']=[coords]
        if coords==rev['eastWall']:
            # Same height, an explicit cut at the balcony/kitchen limit. This
            # separates the unchanged kitchen cuboid from the south jamb.
            wall_spec=next(s for s in local['wallSpecs'] if s['coords']==coords)
            h=b.wall_height(data,coords)*100
            wall_spec['heightSegments']=[{'fromCm':960,'toCm':1121,'heightCm':h},{'fromCm':1121,'toCm':1395,'heightCm':h}]
        normalized={**op,'sill':op['sillCm']/100,'height':op['heightCm']/100}
        before=set(bpy.context.scene.objects)
        original_opening=b.opening_details
        b.opening_details=lambda *_:None
        try:b.wall_and_openings(local,[normalized])
        finally:b.opening_details=original_opening
        for obj in set(bpy.context.scene.objects)-before:
            if obj.name.startswith('Skirting '):
                bpy.data.objects.remove(obj,do_unlink=True)
                continue
            role=obj.name.split(' / ')[-1].split('.')[0]
            obj.name='Balcony boundary '+str(index)+' / '+role
            obj['wallIndex']=index
            obj['external']=True
            mark(obj,data,op,role,index,coords)
            # Blender y is opposite plan y.
            corners=[obj.matrix_world @ Vector(c) for c in obj.bound_box]
            obj['roomId']='balcony'
            if coords==rev['eastWall'] and min(-v.y for v in corners)>=11.21-1e-5:
                obj['balconyOpeningUnchangedKitchenSegment']=True
                obj['roomId']='kitchen'
        guards(data,op,index,coords)
    return removed


def camera_copy():
    pos,target,lens=NEW_BALCONY
    return {'position':b.three(pos),'target':b.three(target),'horizontalFov':round(math.degrees(2*math.atan(36/(2*lens))),2)}


def make_manifest(data,base_manifest,fresh,preserve=False):
    path=b.MODEL_DIR/'scene-manifest.json'
    current=json.loads(path.read_text(encoding='utf-8')) if preserve and path.exists() else {}
    m=copy.deepcopy(base_manifest)
    for key in ('renderedViews','baseBlendSha256','renderSpec','renderInheritance'):m.pop(key,None)
    m['version']=data['version']
    m['sourceSha256']=hashlib.sha256((b.MODEL_DIR/'design-data.json').read_bytes().replace(b'\r\n',b'\n')).hexdigest()
    m['balconyOpennessRevision']=data['balconyOpennessRevision']
    ids=set(data['balconyOpennessRevision']['openingIds'])
    m['openings']=[o for o in m['openings'] if o['id'] not in ids]+[{**o,'sill':o['sillCm']/100,'height':o['heightCm']/100} for o in data['windows'] if o['id'] in ids]
    rcopy=data['balconyOpennessRevision']['roomDescriptions']['balcony']
    for room in m['rooms']:
        if room['id']=='balcony':
            room['description']=rcopy['description']
            room['features']=rcopy['features']
            room['conditions']=data['balconyOpennessRevision']['conditions']
            room['interiorCamera']=camera_copy()
    m['notes']=[n for n in m.get('notes',[]) if not any(term in n for term in ('张','全部渲染同源','全部渲染来自同一'))]
    m['notes']+=data['balconyOpennessRevision']['conditions']
    m['notes'].append(str(len(fresh))+'张本轮阳台相关新帧；其余图保留完整旧来源，只是历史参考，不代表本轮阳台边界或重算采光。')
    if preserve and current.get('sourceSha256')==m['sourceSha256']:
        for key in ('renderedViews','baseBlendSha256','renderSpec','renderInheritance'):
            if key in current:m[key]=current[key]
    write_json(path,m)


def build(args,data,baseline,base_manifest,fresh):
    global SAVED_COLOR
    bpy.ops.wm.open_mainfile(filepath=str(baseline/'huiyayuan-wood.blend'))
    settings=bpy.context.scene.view_settings
    SAVED_COLOR=(settings.view_transform,settings.look,settings.exposure)
    b.COLS.clear();b.MATS.clear()
    for material in bpy.data.materials:b.MATS[material.name]=material
    b.THICK=data.get('wallThicknessCm',12)/100
    b.HEIGHT=data.get('wallHeightCm',270)/100
    old=json.loads((baseline/'design-data.json').read_text(encoding='utf-8'))
    removed=wall_update(old,data)
    if bpy.data.objects.get('balcony'):bpy.data.objects.remove(bpy.data.objects['balcony'],do_unlink=True)
    b.camera('balcony',*NEW_BALCONY)
    b.configure_render(args)
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH':
            obj.hide_set(False)
            obj.hide_render=obj.get('kind')=='ceiling'
    bpy.context.scene.camera=bpy.data.objects['overall']
    bpy.context.scene['balconyOpennessVersion']='3.12.0'
    make_manifest(data,base_manifest,fresh)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(b.MODEL_DIR/'huiyayuan-wood.blend'),compress=True)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH' and obj.get('kind') not in ('ceiling','backdrop'):obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(b.MODEL_DIR/'huiyayuan-wood.glb'),export_format='GLB',use_selection=True,
        export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True,
        export_texcoords=True,export_normals=True,export_materials='EXPORT',export_image_format='AUTO')
    print('BALCONY_NATIVE_COMPLETE',args.scheme,json.dumps({'removed':removed,'newOpeningIds':data['balconyOpennessRevision']['openingIds']}),flush=True)


def finish_inheritance(args,base_manifest,fresh):
    path=b.MODEL_DIR/'scene-manifest.json'
    m=json.loads(path.read_text(encoding='utf-8'))
    records=m.get('renderedViews',{})
    if not set(fresh).issubset(records):return
    blend=sha(b.MODEL_DIR/'huiyayuan-wood.blend')
    for name in fresh:
        record=records[name]
        assert record['sourceSha256']==m['sourceSha256'] and record['baseBlendSha256']==blend
        assert record['imageSha256']==sha(b.RENDER_DIR/(name+'.jpg')) and not record.get('retainedFrom')
        assert record['renderSpec']['width']==960 and record['renderSpec']['samples']==8,'Pilot frame must be replaced'
    references=sorted(set(base_manifest['renderedViews'])-set(fresh))
    for name in references:
        record=copy.deepcopy(base_manifest['renderedViews'][name])
        assert record['imageSha256']==sha(b.RENDER_DIR/(name+'.jpg'))
        chain={'commit':BASELINE_COMMIT,'manifest':'models/schemes/'+args.scheme+'/scene-manifest.json','view':name,
               'reason':'本轮仅重渲指定阳台相关视角；此图完整保留发布旧来源，未更新阳台边界和采光，只作历史参考，不代表3.12.0阳台。'}
        if record.get('retainedFrom'):chain['previous']=record['retainedFrom']
        record['retainedFrom']=chain
        records[name]=record
    m['renderInheritance']={'reviewedAt':'3.12.0','baselineCommit':BASELINE_COMMIT,'currentViews':fresh,'referenceViews':references,
                            'note':str(len(fresh))+'张本轮同源阳台相关新图；其余历史图字节和原始来源链保留。'}
    write_json(path,m)
    print('BALCONY_PROVENANCE_COMPLETE',args.scheme,len(fresh),'fresh /',len(references),'historical',flush=True)


def render(args):
    """Shared renderer conventions, with balcony parapets kept in dollhouse."""
    b.configure_render(args)
    path=b.MODEL_DIR/'scene-manifest.json'
    m=json.loads(path.read_text(encoding='utf-8'))
    blend=sha(b.MODEL_DIR/'huiyayuan-wood.blend')
    if m.get('baseBlendSha256')!=blend:m['renderedViews']={}
    m['baseBlendSha256']=blend
    frame_spec={'engine':args.engine,'width':args.resolution,'height':round(args.resolution*2/3),
                'samples':args.samples,'denoise':args.engine=='CYCLES'}
    m['renderSpec']=frame_spec
    scene=bpy.context.scene
    for name in args.render.split(','):
        scene.camera=bpy.data.objects[name]
        overall=name=='overall'
        for obj in scene.objects:
            kind=obj.get('kind')
            if kind=='ceiling':obj.hide_render=overall
            elif kind=='wall':
                keep_boundary=obj.get('balconyOpennessRevisionId') and not obj.get('balconyOpeningUnchangedKitchenSegment')
                obj.hide_render=bool(overall and obj.get('wallIndex') in (4,5,6) and not keep_boundary)
            elif kind in ('window','door'):obj.hide_render=False
        scene.render.filepath=str(b.RENDER_DIR/(name+'.jpg'))
        print('RENDER_START',args.scheme,name,flush=True)
        bpy.ops.render.render(write_still=True)
        state=b.render_camera_state(scene.camera)
        record={'sourceSha256':m['sourceSha256'],'baseBlendSha256':blend,'cameraState':state,
                'cameraHash':b.render_camera_hash(state),'renderSpec':frame_spec,'imageSha256':sha(b.RENDER_DIR/(name+'.jpg'))}
        if overall:record['visibilityRules']={'dollhouseExteriorWallIndices':[4,5,6],'keepBalconyBoundary':True,
                                             'reason':'保留阳台矮墙、顶梁与防护，避免剖顶视角只剩悬空格栅；厨房外墙仍沿用原剖墙规则。'}
        m.setdefault('renderedViews',{})[name]=record
        write_json(path,m)
        print('RENDER_COMPLETE',args.scheme,name,flush=True)


def main():
    global SAVED_COLOR
    args=parse_args()
    baseline,base_manifest,fresh=setup(args)
    data=json.loads((b.MODEL_DIR/'design-data.json').read_text(encoding='utf-8'))
    assert data.get('balconyOpennessRevision',{}).get('version')=='3.12.0'
    if not args.reuse:build(args,data,baseline,base_manifest,fresh)
    else:
        settings=bpy.context.scene.view_settings
        SAVED_COLOR=(settings.view_transform,settings.look,settings.exposure)
        make_manifest(data,base_manifest,fresh,preserve=True)
    if not args.only_build:
        if args.render=='all':args.render=','.join(fresh)
        assert set(args.render.split(',')).issubset(fresh)
        render(args)
        if args.resolution==960 and args.samples==8:finish_inheritance(args,base_manifest,fresh)


if __name__=='__main__':main()
