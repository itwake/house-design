"""Scoped kitchen refresh from a saved V3.7.0 scene; preserve all other meshes.

blender --background --threads 2 --python tools/refresh_kitchen_native.py -- family
The reproducible full builders also support the same kitchenFitout data.
"""
import importlib.util
import json
import sys
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parents[1]
sid=sys.argv[sys.argv.index('--')+1]
assert sid in ('wood','family','laundry')
source=ROOT/'models/schemes'/sid/'design-data.json'
data=json.loads(source.read_text(encoding='utf-8'))
spec=importlib.util.spec_from_file_location('scheme_builder',ROOT/'tools'/dict(wood='build_wood_kitchen.py',family='build_family_storage.py',laundry='build_laundry_layout.py')[sid])
wrapper=importlib.util.module_from_spec(spec);spec.loader.exec_module(wrapper)
b=wrapper.b
baseline=ROOT/'tmp/kitchen-baseline'/f'{sid}.blend'
assert baseline.is_file(),'Copy the prior published scene to tmp/kitchen-baseline first'
bpy.ops.wm.open_mainfile(filepath=str(baseline))
print('KITCHEN_BASELINE_LOADED',sid,flush=True)
b.MATS.update({m.name:m for m in bpy.data.materials})
legacy={'厨房南侧地柜','厨房北侧地柜','冰箱高柜','蒸烤高柜'}
removed=[]
for obj in list(bpy.context.scene.objects):
    if obj.get('furnitureName') in legacy or obj.get('kitchenFitoutId'):
        removed.append(obj.name);bpy.data.objects.remove(obj,do_unlink=True)
assert removed,'No old kitchen found; refuse to add overlapping geometry'
kspec=importlib.util.spec_from_file_location('kitchen_fitout',ROOT/'tools/kitchen_fitout.py')
kitchen=importlib.util.module_from_spec(kspec);kspec.loader.exec_module(kitchen)
kitchen.build(data,b.__dict__)
print('KITCHEN_REPLACED',sid,len(removed),flush=True)
if sid=='family':wrapper.configure_flow_views(data)
for name in ('kitchen','kitchen-north'):
    if bpy.data.objects.get(name):bpy.data.objects.remove(bpy.data.objects[name],do_unlink=True)
    b.camera(name,*b.VIEWS[name])
args=type('Args',(),dict(engine='CYCLES',resolution=960,samples=12 if sid=='laundry' else 8))()
b.configure_render(args)
# Reset temporary render visibility before exporting the saved scene.
for obj in bpy.context.scene.objects:
    if obj.type=='MESH':obj.hide_set(False);obj.hide_render=False
bpy.context.scene.camera=bpy.data.objects['overall']
b.manifest(data,b.load_openings(data),source)
b.kitchen_manifest_detail(data)
bpy.ops.wm.save_as_mainfile(filepath=str(b.MODEL_DIR/'huiyayuan-wood.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.context.scene.objects:
    if obj.type=='MESH' and obj.get('kind') not in ('ceiling','backdrop'):obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(b.MODEL_DIR/'huiyayuan-wood.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_image_format='AUTO')
print('KITCHEN_NATIVE_COMPLETE',sid,flush=True)
