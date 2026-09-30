"""Graft approved laundry geometry into the preserved compact family scene."""
import importlib.util
import json
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('family_builder',ROOT/'tools/build_family_storage.py')
family=importlib.util.module_from_spec(spec);spec.loader.exec_module(family);b=family.b
args=b.parse_args();src=b.MODEL_DIR/'design-data.json';data=json.loads(src.read_text(encoding='utf-8'))
assert bpy.context.scene.get('compactFamilyGarageVersion')=='3.4.3'
assert not bpy.context.scene.get('familyLaundryVersion'), 'Open the published baseline, not a previously merged scene'
for mat in bpy.data.materials:b.MATS[mat.name]=mat
b.THICK=data.get('wallThicknessCm',12)/100;b.HEIGHT=data.get('wallHeightCm',270)/100
def floor_or_wall(obj):
    return (obj.get('kind') in ('floor','ceiling') and obj.get('roomId') in ('living','balcony')) or obj.get('wallIndex') in (8,24) or obj.get('openingId')=='balcony_door'
def obsolete(obj):
    return floor_or_wall(obj) or obj.get('furnitureId') in ('洗烘塔','阳台家政柜')
removed=[obj for obj in bpy.context.scene.objects if obsolete(obj)]
for obj in removed:bpy.data.objects.remove(obj,do_unlink=True)
added=[]
with bpy.data.libraries.load(str(ROOT/'models/schemes/laundry/huiyayuan-wood.blend'),link=False) as (available,loaded):loaded.objects=available.objects
for obj in loaded.objects:
    if floor_or_wall(obj) or obj.get('laundryPartId') or obj.get('laundryMachineId') or obj.get('laundryBasin'):
        bpy.context.scene.collection.objects.link(obj);added.append(obj)
        for slot in obj.material_slots:
            name=slot.material.name.split('.')[0] if slot.material else ''
            if name in b.MATS:slot.material=b.MATS[name]
    else:bpy.data.objects.remove(obj,do_unlink=True)
assert len([o for o in added if o.get('laundryPartId')])==len(data['laundry']['parts'])
shifts={'三人沙发':(-.8,1.02),'茶几':(-.8,.82),'电视薄柜':(-.4,0)}
for obj in bpy.context.scene.objects:
    if obj.get('furnitureId') in shifts:
        dx,dy=shifts[obj['furnitureId']];obj.location.x+=dx;obj.location.y+=dy
    elif obj.get('roomId')=='living' and obj.name in ('Lamp base','Lamp upright','Pleated linen lampshade','Warm lamp bulb'):
        obj.location.x-=3.13;obj.location.y+=1.63
# Replace only changed room cameras; all others retain their actual positions.
for name in ('living','balcony','laundry-detail','living-wall'):
    old=bpy.data.objects.get(name)
    if old:bpy.data.objects.remove(old,do_unlink=True)
    b.camera(name,*b.VIEWS[name])
bpy.context.view_layer.update();b.manifest(data,b.load_openings(data),src)
bpy.context.scene['familyLaundryVersion']='3.5.0'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(b.MODEL_DIR/'huiyayuan-wood.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.context.scene.objects:
    if obj.type=='MESH' and obj.get('kind') not in ('ceiling','backdrop'):
        obj.hide_set(False);obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(b.MODEL_DIR/'huiyayuan-wood.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_image_format='AUTO')
bpy.ops.object.select_all(action='DESELECT')
print('FAMILY_LAUNDRY_COMPLETE',len(removed),len(added),flush=True)
if not args.only_build:b.render(args)
