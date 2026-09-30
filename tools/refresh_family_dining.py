"""Only approved dining/living objects, from immutable a2b623c 3.5.2 scene."""
import importlib.util
import json
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('family_builder',ROOT/'tools/build_family_storage.py')
family=importlib.util.module_from_spec(spec);spec.loader.exec_module(family);b=family.b
dining=family.dining
args=b.parse_args();src=b.MODEL_DIR/'design-data.json';data=json.loads(src.read_text(encoding='utf-8'))
assert bpy.context.scene.get('familyFlowVersion')=='3.5.2'
repair=bpy.context.scene.get('familyDiningVersion')=='3.5.3'
assert repair or not bpy.context.scene.get('familyDiningVersion'),'Use the published 3.5.2 baseline or current 3.5.3 scene'
assert data['familyDiningRevision']['version']=='3.5.3'
for mat in bpy.data.materials:b.MATS[mat.name]=mat
b.THICK=data.get('wallThicknessCm',12)/100;b.HEIGHT=data.get('wallHeightCm',270)/100
family.configure_flow_views(data)
if repair:
    removed_count=dining.repair_current_shelves(b,data)
else:
    old_dining={'四人餐桌','餐椅北1','餐椅北2','餐椅南1','餐椅南2'}
    removed=[o for o in bpy.context.scene.objects if o.get('storageFitoutId') in ('dining_sideboard_wall','sofa_back_storage') or o.get('furnitureId') in old_dining|{'三人沙发','茶几'} or o.get('diningFitoutId') or o.name.startswith(dining.PENDANT_NAMES)]
    removed_count=len(removed)
    for obj in removed:bpy.data.objects.remove(obj,do_unlink=True)
    fitouts=[f for f in data['storageFitouts'] if f['id'] in ('dining_sideboard_wall','sofa_back_storage')]
    b.storage_fitouts({**data,'storageFitouts':fitouts})
    for name,builder in (('三人沙发',b.sofa),('茶几',b.coffee)):
        f=next(f for f in data['furniture'] if f['name']==name);b.CURRENT_ROOM='living';before=set(bpy.context.scene.objects);builder(f)
        for obj in set(bpy.context.scene.objects)-before:
            obj['furnitureId']=str(f.get('id') or name);obj['furnitureName']=name
            if 'face' in f:obj['furnitureFace']=f['face']
    dining.furnish(b,data);dining.relocate_ambient(b,data)
    for name in ('dining','dining-closed'):
        old=bpy.data.objects.get(name)
        if old:bpy.data.objects.remove(old,do_unlink=True)
        b.camera(name,*b.VIEWS[name])
bpy.context.view_layer.update();b.manifest(data,b.load_openings(data),src)
bpy.context.scene['familyDiningVersion']='3.5.3'
bpy.context.preferences.filepaths.save_version=0
dining.set_state('expanded')
bpy.ops.wm.save_as_mainfile(filepath=str(b.MODEL_DIR/'huiyayuan-wood.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.context.scene.objects:
    if obj.type=='MESH' and obj.get('kind') not in ('ceiling','backdrop'):
        obj.hide_set(False);obj.hide_viewport=False;obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(b.MODEL_DIR/'huiyayuan-wood.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_image_format='AUTO')
bpy.ops.object.select_all(action='DESELECT')
print('FAMILY_DINING_REPAIR_COMPLETE' if repair else 'FAMILY_DINING_COMPLETE',removed_count,flush=True)
if not args.only_build:b.render(args)
