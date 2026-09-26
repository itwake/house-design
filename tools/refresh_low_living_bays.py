"""Lower only the provisional living bay and add the user-requested pads."""
import importlib.util
import json
import sys
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parents[1]
argv=sys.argv[sys.argv.index('--')+1:]
i=argv.index('--scheme');sid=argv[i+1];del argv[i:i+2]
builders={'wood':'build_wood_kitchen','suite':'build_suite_layout','family':'build_family_storage','laundry':'build_laundry_layout'}
spec=importlib.util.spec_from_file_location('active_builder',ROOT/'tools'/f'{builders[sid]}.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);b=module.b
sys.argv=sys.argv[:sys.argv.index('--')+1]+argv
args=b.parse_args();src=b.MODEL_DIR/'design-data.json';data=json.loads(src.read_text(encoding='utf-8'))
catalog=json.loads((ROOT/'models/design-schemes.json').read_text(encoding='utf-8'))
quality=next(s for s in catalog['schemes'] if s['id']==sid)['renderSpec']
args.samples=max(args.samples,quality['samples'])
assert data['livingBayRevision']['version']=='3.4.2' and data['livingBayRevision']['estimateAuthorized']
for mat in bpy.data.materials:b.MATS[mat.name]=mat
b.THICK=data.get('wallThicknessCm',12)/100;b.HEIGHT=data.get('wallHeightCm',270)/100
b.CURRENT_ROOM='living'
openings=b.load_openings(data);op=next(o for o in openings if o['id']=='window_living_west')
assert op['sill']==.4 and op['height']==1.9
wall=bpy.data.objects.get('Wall 03 / sill')
assert wall and wall.get('wallIndex')==3 and abs(wall.dimensions.x-.12)<.001 and abs(wall.dimensions.y-2)<.001
assert abs(wall.dimensions.z-.9)<.001, 'Expected the untouched V3.4.1 input scene, not a repeat patch'
metadata=dict(wall.items());wall_name=wall.name
victims=[o for o in bpy.context.scene.objects if o.get('openingId')==op['id'] or o==wall]
assert any(o.get('fitoutPartId')=='l_ledge' for o in victims)
kept={o.name for o in bpy.context.scene.objects if o not in victims}
for obj in victims:bpy.data.objects.remove(obj,do_unlink=True)
new_wall=b.box(wall_name,2.06,7.47,0,.12,2,.4,'Wall',.001,'wall',metadata.get('roomId'))
for k,v in metadata.items():new_wall[k]=v
b.opening_details(op,data)
fitout=next(f for f in data['bayFitouts'] if f['roomId']=='living')
b.bay_fitouts({**data,'bayFitouts':[fitout]})
assert kept.issubset({o.name for o in bpy.context.scene.objects})
bpy.context.view_layer.update()
b.manifest(data,openings,src)
bpy.context.scene['livingLowBayEstimateVersion']='3.4.2'
bpy.ops.wm.save_as_mainfile(filepath=str(b.MODEL_DIR/'huiyayuan-wood.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.context.scene.objects:
 if obj.type=='MESH' and obj.get('kind') not in ('ceiling','backdrop'):
  obj.hide_set(False);obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(b.MODEL_DIR/'huiyayuan-wood.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_image_format='AUTO')
bpy.ops.object.select_all(action='DESELECT')
print('LOW_LIVING_BAY_COMPLETE',sid,'400+50 mm estimate; other objects retained:',len(kept),flush=True)
if not args.only_build:b.render(args)
