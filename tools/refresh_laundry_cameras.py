"""Reframe saved scene without rebuilding mesh; invalidate and rerender ALL views.

Run Blender opened on the laundry .blend with --python this file -- --render all.
The builder presets remain authoritative; no guessed camera/hash retrofit.
"""
import importlib.util
from pathlib import Path
import json
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('laundry_builder',ROOT/'tools/build_laundry_layout.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);b=module.b
for name,(pos,target,lens) in b.VIEWS.items():
    obj=bpy.data.objects[name]
    obj.location=(pos[0],-pos[1],pos[2])
    obj.rotation_euler=(Vector((target[0],-target[1],target[2]))-obj.location).to_track_quat('-Z','Y').to_euler()
    obj.data.lens=lens
bpy.context.view_layer.update()
src=b.MODEL_DIR/'design-data.json';data=json.loads(src.read_text(encoding='utf-8'))
b.manifest(data,b.load_openings(data),src)
bpy.ops.wm.save_as_mainfile(filepath=str(b.MODEL_DIR/'huiyayuan-wood.blend'),compress=True)
b.render(b.parse_args())
