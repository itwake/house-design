"""Replace only approved entry objects in the published 3.5.0 family scene."""
import importlib.util
import json
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('family_builder',ROOT/'tools/build_family_storage.py')
family=importlib.util.module_from_spec(spec);spec.loader.exec_module(family);b=family.b
args=b.parse_args();src=b.MODEL_DIR/'design-data.json';data=json.loads(src.read_text(encoding='utf-8'))
assert bpy.context.scene.get('familyLaundryVersion')=='3.5.0'
assert not bpy.context.scene.get('familyEntryVersion'), 'Use the published 3.5.0 baseline scene'
assert data['familyEntryRevision']['version']=='3.5.1'
for mat in bpy.data.materials:b.MATS[mat.name]=mat
b.THICK=data.get('wallThicknessCm',12)/100;b.HEIGHT=data.get('wallHeightCm',270)/100
removed=[o for o in bpy.context.scene.objects if o.get('garageId')=='family_garage' or o.get('storageFitoutId')=='dining_sideboard_wall']
for obj in removed:bpy.data.objects.remove(obj,do_unlink=True)
fitout=next(f for f in data['storageFitouts'] if f['id']=='dining_sideboard_wall')
b.storage_fitouts({**data,'storageFitouts':[fitout]});family.garage(data)
pendants=('Dining pendant ceiling rose','Pendant thin suspension','Organic linen pendant','Pendant opal diffuser')
for obj in bpy.context.scene.objects:
    if obj.get('furnitureId') in ('四人餐桌','餐椅北1','餐椅北2','餐椅南1','餐椅南2') or obj.name.startswith(pendants):
        obj.location.x+=.15;obj.location.y-=.95
old=bpy.data.objects.get('Family garage soft fill')
if old:bpy.data.objects.remove(old,do_unlink=True)
family.entry_lighting()
for name in ('dining','entry-storage','sideboard','storage-library'):
    old=bpy.data.objects.get(name)
    if old:bpy.data.objects.remove(old,do_unlink=True)
    b.camera(name,*b.VIEWS[name])
bpy.context.view_layer.update();b.manifest(data,b.load_openings(data),src)
bpy.context.scene['familyEntryVersion']='3.5.1'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(b.MODEL_DIR/'huiyayuan-wood.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.context.scene.objects:
    if obj.type=='MESH' and obj.get('kind') not in ('ceiling','backdrop'):
        obj.hide_set(False);obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(b.MODEL_DIR/'huiyayuan-wood.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_image_format='AUTO')
bpy.ops.object.select_all(action='DESELECT')
print('FAMILY_ENTRY_COMPLETE',len(removed),flush=True)
if not args.only_build:b.render(args)
