"""Patch the published V3.4.2 family scene without rebuilding unrelated meshes."""
import importlib.util
import json
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('family_builder',ROOT/'tools/build_family_storage.py')
family=importlib.util.module_from_spec(spec);spec.loader.exec_module(family);b=family.b
args=b.parse_args();src=b.MODEL_DIR/'design-data.json';data=json.loads(src.read_text(encoding='utf-8'))
assert data['garageRevision']['version']=='3.4.3'
already_compact=bpy.context.scene.get('compactFamilyGarageVersion')=='3.4.3'
assert bpy.context.scene.get('livingLowBayEstimateVersion')=='3.4.2'
for mat in bpy.data.materials:b.MATS[mat.name]=mat
b.THICK=data.get('wallThicknessCm',12)/100;b.HEIGHT=data.get('wallHeightCm',270)/100
victims=[obj for obj in bpy.context.scene.objects if obj.get('garageId')=='family_garage']
assert len(victims)>40
for obj in victims:bpy.data.objects.remove(obj,do_unlink=True)
moved=0
for obj in bpy.context.scene.objects:
    if str(obj.get('storagePartId','')).startswith('family_sideboard_'):
        if not already_compact:obj.location.y+=.50
        moved+=1
assert moved>20, 'Expected detailed existing sideboard, not a placeholder'
family.garage(data)
old_light=bpy.data.objects.get('Family garage soft fill')
assert old_light and old_light.type=='LIGHT'
bpy.data.objects.remove(old_light,do_unlink=True)
b.area('Family garage soft fill',(2.87,13.26,2.30),(2.87,13.65,.60),20,.65,(1,.96,.90))
for name in ('sideboard','storage-library'):
    old=bpy.data.objects[name];bpy.data.objects.remove(old,do_unlink=True)
    b.camera(name,*b.VIEWS[name])
bpy.context.view_layer.update()
b.manifest(data,b.load_openings(data),src)
bpy.context.scene['compactFamilyGarageVersion']='3.4.3'
bpy.ops.wm.save_as_mainfile(filepath=str(b.MODEL_DIR/'huiyayuan-wood.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.context.scene.objects:
    if obj.type=='MESH' and obj.get('kind') not in ('ceiling','backdrop'):
        obj.hide_set(False);obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(b.MODEL_DIR/'huiyayuan-wood.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_image_format='AUTO')
bpy.ops.object.select_all(action='DESELECT')
print('COMPACT_FAMILY_COMPLETE; moved sideboard meshes:',moved,flush=True)
quality=next(s for s in json.loads((ROOT/'models/design-schemes.json').read_text(encoding='utf-8'))['schemes'] if s['id']=='family')['renderSpec']
args.samples=max(args.samples,quality['samples'])
if not args.only_build:b.render(args)
