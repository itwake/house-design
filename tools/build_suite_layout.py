"""Build a real alternative geometry with the existing wood materials.

Blender: --background --threads 4 --python tools/build_suite_layout.py --
         --render all --engine CYCLES --resolution 960 --samples 8
No base .blend, model, source, texture or JPEG is overwritten.
"""
import importlib.util
import json
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('wood_builder',ROOT/'tools/build_blender.py')
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
b.MODEL_DIR=ROOT/'models/schemes/suite'
b.RENDER_DIR=ROOT/'assets/schemes/suite'
b.TEX_DIR=b.MODEL_DIR/'textures'
b.BAY_NOTE='三处飘窗外凸与原窗台高度均待复尺。新增方案取消主卧桌台与配椅，保留原台；次卧低台茶座仍是附条件方案，客厅双人桌保留。防坠、窗扇、外立面与结构条件须专业复核。'
# The old study camera is outside the smaller room. Other sleeping-space,
# living, cabinet and bay cameras remain fixed for a meaningful comparison.
b.VIEWS['study']=((2.41,4.50,1.62),(1.27,5.18,1.02),18)
b.VIEWS['bedroom-b']=((2.48,2.47,1.60),(1.40,1.25,.97),18)
b.VIEWS['bay-tea']=((2.48,1.47,1.52),(1.53,-.11,1.03),18)
b.VIEWS['master-bath']=((6.57,4.65,1.60),(4.95,3.72,1.12),18)
b.VIEWS['guest-bath']=((6.54,6.03,1.60),(4.32,5.33,1.06),17)
b.VIEWS['suite-entry']=((4.20,4.56,1.60),(4.19,2.55,1.24),17)

def load_openings(data):
    result=[]
    for item in data['windows']+data['doors']:
        op=dict(item);op['sill']=op.get('sillCm',90 if op['kind']=='window' else 0)/100
        op['height']=op.get('heightCm',140 if op['kind']=='window' else 215)/100
        result.append(op)
    return result
b.load_openings=load_openings

original_opening=b.opening_details
def opening_details(op,data):
    operation=op.get('operation')
    if not operation:
        return original_opening(op,data)
    rid={'door_a':'room_a','door_b':'room_b','door_c':'room_c','door_bath_1':'bath_1','door_bath_2':'bath_2'}[op['id']]
    x,y1,y2=op['x1']/100,op['y1']/100,op['y2']/100
    h=op['height']
    def part(label,cx,cy,z,w,d,height,mat='Oak',role='r4-door-frame'):
        ob=b.box(op['id']+' / '+label,cx,cy,z,w,d,height,mat,.002,'door',rid)
        ob['openingId']=op['id'];ob['doorRole']=role
        return ob
    for y in (y1+.03,y2-.03):part('jamb',x,y,0,.145,.06,h-.06)
    part('head',x,(y1+y2)/2,h-.06,.145,y2-y1,.06)
    part('flush doorway floor',x,(y1+y2)/2,-.012,.12,y2-y1,.012,'Tile' if 'bath' in op['id'] else 'Oak','door-floor')
    if operation['type']=='hinged':
        p=operation['openLeafCm'];px,py,w,d=[p[k]/100 for k in ('x','y','w','d')]
        leaf=part('oak door leaf open 90',px+w/2,py+d/2,.02,w,d,h-.075,role='hinged-open-panel')
        leaf['openLeafCm']=[p[k] for k in ('x','y','w','d')]
        leaf['pose']='open90'
        # Flush hardware stays inside the plan/collision leaf envelope.
        tip=px+.11 if op['id']=='door_b' else px+w-.11
        part('flush pull',tip,py+.002,.96,.08,.003,.13,'Brass','hinged-open-panel')
    elif operation['type']=='surface-sliding':
        p=operation['panelCm'];q=operation['parkedCm'];px,py,w,d=[p[k]/100 for k in ('x','y','w','d')]
        shift=[(q['x']-p['x'])/100,0.,(q['y']-p['y'])/100]
        def leaf(label,cx,cy,z,pw,pd,ph,mat='Oak'):
            ob=part(label,cx,cy,z,pw,pd,ph,mat,'sliding-panel');ob['slideOpenOffsetM']=shift;return ob
        leaf('study sliding oak door leaf',px+w/2,py+d/2,.012,w,d,h-.025)
        leaf('recessed pull',px+.002,py+d-.13,.96,.003,.04,.18,'Brass')
        part('concealed top track',px+w/2,(q['y']+p['y']+p['d'])/200,h,.065,(p['y']+p['d']-q['y'])/100+.08,.06,'Cream')
        part('floor anti-sway guide',px+w/2,y1-.03,0,.045,.055,.013,'Brass')
    else:raise ValueError('Unsupported R4 operation '+str(operation))
b.opening_details=opening_details

original_manifest=b.manifest
def manifest(data,openings,src):
    original_manifest(data,openings,src)
    path=b.MODEL_DIR/'scene-manifest.json'
    result=json.loads(path.read_text(encoding='utf-8'))
    def paths(value):
        if isinstance(value,str):return value.replace('models/huiyayuan-wood','models/schemes/suite/huiyayuan-wood').replace('assets/blender-renders/','assets/schemes/suite/')
        if isinstance(value,list):return [paths(v) for v in value]
        if isinstance(value,dict):return {k:paths(v) for k,v in value.items()}
        return value
    result=paths(result);result.update(version='3.2.1 · suite R4B',schemeId='suite',layout=data['layout'])
    descriptions={n['roomId']:n['text'] for n in data['renovationNotes']}
    for room in result['rooms']:
        if room['id'] in descriptions:room['description']=descriptions[room['id']]
    result['notes']+=data['geometryNotes'][:5]
    pos,target,lens=b.VIEWS['suite-entry']
    result['layoutDetails']=[{'id':'suite-entry','title':'先入玄关，再到床区或主卫','render':'assets/schemes/suite/suite-entry.jpg','roomId':'room_a','position':b.three(pos),'target':b.three(target)}]
    path.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
b.manifest=manifest

original_lighting=b.lighting
def lighting(data):
    original_lighting(data)
    b.area('Suite entrance gentle fill',(4.22,4.1,2.5),(4.22,4.1,.1),35,.60,(1,.86,.68))
b.lighting=lighting

if __name__=='__main__':b.main()
