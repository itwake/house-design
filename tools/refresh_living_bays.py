"""Remove only five tagged furniture groups from each saved, approved scene.

Open one active .blend, then pass --scheme wood|suite|family|laundry. Re-export
actual meshes and rerender all views, retaining materials/cameras/other geometry.
"""
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
args=b.parse_args();data=json.loads((b.MODEL_DIR/'design-data.json').read_text(encoding='utf-8'))
assert data['livingBayRevision']['version']=='3.4.1'
removed=set(data['livingBayRevision']['removedPartIds']);victims=[o for o in bpy.context.scene.objects if o.get('fitoutId')=='bay_living_family' and o.get('fitoutPartId') in removed]
assert victims,'Expected the existing desk and chairs in the input scene'
found={o.get('fitoutPartId') for o in victims};assert found==removed,(found,removed)
kept_names={o.name for o in bpy.context.scene.objects if o not in victims}
for obj in victims:bpy.data.objects.remove(obj,do_unlink=True)
assert {o.name for o in bpy.context.scene.objects}==kept_names
b.manifest(data,b.load_openings(data),b.MODEL_DIR/'design-data.json')
p=b.MODEL_DIR/'scene-manifest.json';m=json.loads(p.read_text(encoding='utf-8'))
m['livingBayRevision']=data['livingBayRevision']
summary=next(f for f in data['bayFitouts'] if f['roomId']=='living')['summary']
if summary not in m['notes']:m['notes'].append(summary)
m['notes']=[n.replace('客厅双人桌保留。','客厅桌椅已移除；原台高待复尺。') for n in m['notes']]
p.write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(b.MODEL_DIR/'huiyayuan-wood.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.context.scene.objects:
 if obj.type=='MESH' and obj.get('kind') not in ('ceiling','backdrop'):
  obj.hide_set(False);obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(b.MODEL_DIR/'huiyayuan-wood.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_image_format='AUTO')
bpy.ops.object.select_all(action='DESELECT')
print('REMOVAL_COMPLETE',sid,len(victims),sorted(found),flush=True)
if not args.only_build:b.render(args)
