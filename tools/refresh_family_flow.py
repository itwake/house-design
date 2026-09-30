"""Only revised public furniture, from the immutable published 3.5.1 scene."""
import importlib.util
import json
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('family_builder',ROOT/'tools/build_family_storage.py')
family=importlib.util.module_from_spec(spec);spec.loader.exec_module(family);b=family.b
args=b.parse_args();src=b.MODEL_DIR/'design-data.json';data=json.loads(src.read_text(encoding='utf-8'))
assert bpy.context.scene.get('familyEntryVersion')=='3.5.1' and not bpy.context.scene.get('familyFlowVersion')
assert data['familyFlowRevision']['version']=='3.5.2'
for mat in bpy.data.materials:b.MATS[mat.name]=mat
b.THICK=data.get('wallThicknessCm',12)/100;b.HEIGHT=data.get('wallHeightCm',270)/100
removed=[o for o in bpy.context.scene.objects if o.get('garageId')=='family_garage' or o.get('storageFitoutId')=='dining_sideboard_wall' or o.get('furnitureId')=='三人沙发']
for obj in removed:bpy.data.objects.remove(obj,do_unlink=True)
fitout=next(f for f in data['storageFitouts'] if f['id']=='dining_sideboard_wall')
b.storage_fitouts({**data,'storageFitouts':[fitout]});family.garage(data)
f=next(f for f in data['furniture'] if f['name']=='三人沙发');b.CURRENT_ROOM='living';before=set(bpy.context.scene.objects);b.sofa(f)
for obj in set(bpy.context.scene.objects)-before:
    obj['furnitureId']='三人沙发';obj['furnitureName']='三人沙发';obj['furnitureFace']=f['face']
dx=data['familyFlowRevision']['sofaShiftCm']/100
pendants=('Dining pendant ceiling rose','Pendant thin suspension','Organic linen pendant','Pendant opal diffuser')
lamp_names=('Lamp base','Lamp upright','Pleated linen lampshade','Warm lamp bulb')
for obj in bpy.context.scene.objects:
    if obj.get('furnitureId')=='茶几':obj.location.x+=dx
    if obj.get('furnitureId') in ('四人餐桌','餐椅北1','餐椅北2','餐椅南1','餐椅南2') or obj.name.startswith(pendants):obj.location.y+=.60
    if obj.get('roomId')=='living' and obj.name in lamp_names:
        obj.location.x+=(data['modelAddons']['livingFloorLampCm']['x']-335)/100
        obj.location.y-=(data['modelAddons']['livingFloorLampCm']['y']-735)/100
family.configure_flow_views(data)
for name in ('living','living-wall','dining','sideboard'):
    old=bpy.data.objects.get(name)
    if old:bpy.data.objects.remove(old,do_unlink=True)
    b.camera(name,*b.VIEWS[name])
bpy.context.view_layer.update();b.manifest(data,b.load_openings(data),src)
bpy.context.scene['familyEntryVersion']='3.5.2';bpy.context.scene['familyFlowVersion']='3.5.2'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(b.MODEL_DIR/'huiyayuan-wood.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.context.scene.objects:
    if obj.type=='MESH' and obj.get('kind') not in ('ceiling','backdrop'):
        obj.hide_set(False);obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(b.MODEL_DIR/'huiyayuan-wood.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_image_format='AUTO')
bpy.ops.object.select_all(action='DESELECT')
print('FAMILY_FLOW_COMPLETE',len(removed),flush=True)
if not args.only_build:b.render(args)
