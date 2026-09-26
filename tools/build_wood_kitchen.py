"""Original palette with the family/suite kitchen, in a separate wood directory."""
import importlib.util
import json
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('base_builder',ROOT/'tools/build_blender.py')
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
# Extract the exact common-window and shelf functions without activating suite
# palette, bedroom furniture, or suite doors on the original layout.
import ast
tree=ast.parse((ROOT/'tools/build_suite_layout.py').read_text(encoding='utf-8'))
scope={'b':b,'bpy':bpy,'original_kitchen_run':b.kitchen_run}
for name in ['shared_kitchen_window','kitchen_run','load_openings']:
    node=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name==name)
    exec(compile(ast.Module(body=[node],type_ignores=[]),'shared kitchen geometry','exec'),scope)
b.kitchen_run=scope['kitchen_run'];b.load_openings=scope['load_openings']
original_opening=b.opening_details
def opening(op,data):
    return scope['shared_kitchen_window'](op) if op['id']=='window_kitchen_balcony' else original_opening(op,data)
b.opening_details=opening
b.MODEL_DIR=ROOT/'models/schemes/wood';b.RENDER_DIR=ROOT/'assets/schemes/wood';b.TEX_DIR=b.MODEL_DIR/'textures'
b.VIEWS['kitchen']=((6.00,12.70,1.60),(7.55,11.21,1.52),20)
b.VIEWS['balcony']=((7.18,10.31,1.60),(7.58,11.21,1.53),18)
original_manifest=b.manifest
def manifest(data,openings,src):
    original_manifest(data,openings,src)
    path=b.MODEL_DIR/'scene-manifest.json';m=json.loads(path.read_text(encoding='utf-8'))
    def paths(v):
        if isinstance(v,str):return v.replace('models/huiyayuan-wood','models/schemes/wood/huiyayuan-wood').replace('assets/blender-renders/','assets/schemes/wood/')
        if isinstance(v,list):return [paths(i) for i in v]
        if isinstance(v,dict):return {k:paths(i) for k,i in v.items()}
        return v
    m=paths(m);m.update(version=data['version'],schemeId='wood',layout=data['layout'],kitchenReference=data['kitchenReference'])
    for r in m['rooms']:
        if r['id'] in ('kitchen','balcony'):r['description']+=' 厨房与阳台之间新增方案3同尺寸大窗，1200×1300mm、窗台1000mm均待实测；厨房柜体位置和摆设同步方案3。'
    path.write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8')
b.manifest=manifest
if __name__=='__main__':b.main()
