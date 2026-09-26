"""Render the already-built low-bay scene after synchronizing source notes.

Does not save, export or alter scene geometry. Render-time source/scene hashes
are recorded by the normal renderer, never rewritten on existing frames.
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
args=b.parse_args();src=b.MODEL_DIR/'design-data.json';data=json.loads(src.read_text(encoding='utf-8'))
catalog=json.loads((ROOT/'models/design-schemes.json').read_text(encoding='utf-8'))
quality=next(s for s in catalog['schemes'] if s['id']==sid)['renderSpec']
args.samples=max(args.samples,quality['samples'])
assert data['livingBayRevision']['version']=='3.4.2'
assert bpy.context.scene.get('livingLowBayEstimateVersion')=='3.4.2'
assert abs(bpy.data.objects['Wall 03 / sill'].dimensions.z-.4)<.001
assert {o.get('fitoutPartId') for o in bpy.context.scene.objects if o.get('fitoutId')=='bay_living_family'}=={'l_seat_pad_north','l_seat_pad_south'}
b.manifest(data,b.load_openings(data),src)
b.render(args)
