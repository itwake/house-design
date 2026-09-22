"""Build the approved fitted suite with independent warm-white finishes.

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
# Frame the revised sofa/desk and bedroom console from inside the real rooms.
# Unaffected living, cabinet and bay cameras remain fixed for comparison.
b.VIEWS['study']=((2.55,4.34,1.62),(1.38,6.12,1.50),18)
b.VIEWS['bedroom-b']=((1.99,2.46,1.65),(2.11,.94,.97),18)
b.VIEWS['bay-tea']=((2.48,1.47,1.52),(1.53,-.11,1.03),18)
b.VIEWS['master-bath']=((6.57,4.65,1.60),(4.95,3.72,1.12),18)
b.VIEWS['guest-bath']=((6.54,6.03,1.60),(4.32,5.33,1.06),17)
b.VIEWS['suite-entry']=((4.20,4.56,1.60),(4.19,2.55,1.24),17)
b.VIEWS['kitchen']=((6.00,12.70,1.60),(7.55,11.21,1.52),20)
b.VIEWS['balcony']=((7.18,10.31,1.60),(7.58,11.21,1.53),18)

# Suite-only finishes: embedded textures are really changed, not a browser tint.
original_materials=b.setup_materials
def setup_materials():
    original_materials()
    colors={'Oak':(.68,.64,.58),'OakLight':(.76,.72,.65),'Wall':(.89,.88,.85),
      'Cream':(.87,.85,.81),'Linen':(.79,.77,.73),'WhiteLinen':(.91,.90,.87),
      'Sage':(.40,.49,.44),'Terracotta':(.55,.38,.33),'Stone':(.76,.75,.72),
      'Tile':(.77,.77,.74),'Grout':(.64,.64,.61),'Brass':(.49,.44,.34),
      'WarmGrayMetal':(.51,.51,.48),'RollerFabric':(.88,.87,.83),'Lamp':(1,.93,.83)}
    textures={name:b.texture_image('suite-'+name.lower(),colors[name],kind) for name,kind in
      [('Oak','wood'),('OakLight','wood'),('Linen','linen'),('Stone','stone')]}
    for name,color in colors.items():
        mat=b.MATS[name];mat.diffuse_color=(*color,1)
        bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1)
        if name=='Lamp':bs.inputs['Emission Color'].default_value=(*color,1)
        if name in textures:
            for node in mat.node_tree.nodes:
                if node.type=='TEX_IMAGE':node.image=textures[name]
b.setup_materials=setup_materials

original_cabinet=b.cabinet
def cabinet(f,h=2.35,style='wardrobe'):
    before=set(bpy.context.scene.objects);original_cabinet(f,h,style)
    # Large closet fronts become warm white; timber remains in the carcass.
    for obj in set(bpy.context.scene.objects)-before:
        if 'sliding door' in obj.name and 'track' not in obj.name:
            obj.data.materials.clear();obj.data.materials.append(b.MATS['Cream'])
b.cabinet=cabinet

original_sofa=b.sofa
def sofa(f):
    if f.get('id')!='study_north_sofa':return original_sofa(f)
    x,y,w,d=[f[k]/100 for k in ('x','y','w','d')]
    b.block('Study sofa upholstered base',x,y,.11,w,d,.25,mat='Linen',bevel=.08)
    b.block('Study sofa NORTH back',x,y,.26,w,.17,.51,mat='Linen',bevel=.065)
    for px in (x+.065,x+w-.065):b.box('Study sofa arm',px,y+d/2,.30,.13,d-.03,.30,'Linen',.06)
    for i in range(2):b.block('Study sofa SOUTH seat',x+.14+i*(w-.28)/2,y+.18,.36,(w-.28)/2-.01,d-.21,.12,mat='Cream',bevel=.04)
    for px,mat in [(x+.4,'Sage'),(x+w-.4,'WhiteLinen')]:b.box('Study sofa cushion',px,y+.27,.48,.34,.16,.29,mat,.05)
b.sofa=sofa

original_furnish=b.furnish
def furnish(data):
    special={'study_full_desk','bed_b_niche_console'}
    original_furnish({**data,'furniture':[f for f in data['furniture'] if f.get('id') not in special]})
    for f in data['furniture']:
        if f.get('id') not in special:continue
        x,y,w,d=[f[k]/100 for k in ('x','y','w','d')]
        b.CURRENT_ROOM='room_c' if f['id']=='study_full_desk' else 'room_b'
        before=set(bpy.context.scene.objects)
        b.block(f['id']+' / continuous tabletop',x,y,.73,w,d,.03,mat='OakLight',bevel=.008)
        if f['id']=='study_full_desk':
            for px in (x,x+w-.025):b.block('Study desk end gable',px,y,0,.025,d,.73,mat='Cream',bevel=.003)
            # Recessed steel under-frame and extra support west of the chair.
            for py in (y+.045,y+d-.045):b.box('Study desk steel underframe',x+w/2,py,.69,w-.05,.025,.04,'WarmGrayMetal',.002)
            b.box('Study desk intermediate support',1.10,y+.045,0,.03,.03,.73,'WarmGrayMetal',.002)
            b.lamp(2.30,5.99,.76,True)
            b.block('Study desk notebook',.30,5.80,.762,.26,.18,.018,mat='Sage',bevel=.004)
        else:
            for py in (y,y+d-.025):b.block('B niche console end gable',x,py,0,w,.025,.73,mat='Cream',bevel=.003)
            b.block('B niche console rear rail',x+w-.04,y,.67,.04,d,.06,mat='OakLight',bevel=.002)
            b.block('B niche console intermediate support',x+.04,y+d/2,0,w-.04,.025,.73,mat='Cream',bevel=.003)
            b.book_stack(x+w*.58,y+.38,.762,.18)
        for obj in set(bpy.context.scene.objects)-before:
            obj['furnitureId']=f['id'];obj['furnitureName']=f['name'];obj['furnitureFace']=f['face']
    for fit in data.get('wallFitouts',[]):
        for p in fit['parts']:
            obj=b.block(fit['id']+' / '+p['id'],p['x']/100,p['y']/100,p['zCm']/100,p['w']/100,p['d']/100,p['hCm']/100,
                mat=p['material'],bevel=.001,kind='furniture',room=fit['roomId'])
            obj['wallFitoutId']=fit['id'];obj['wallPartId']=p['id'];obj['wallPartRole']=p['role']
            obj['furnitureId']=fit['id'];obj['furnitureFace']=fit['face']
b.furnish=furnish

original_kitchen_run=b.kitchen_run
def kitchen_run(f,north):
    before=set(bpy.context.scene.objects);original_kitchen_run(f,north)
    if not north:return
    # Keep the existing sink/cabinet/vase. Only the shelf that crossed the
    # new aperture is shortened, ending 60mm before the window's west edge.
    for obj in set(bpy.context.scene.objects)-before:
        if obj.name.startswith('Kitchen open oak shelf'):
            west=(f['x']+10)/100;length=6.98-.06-west
            obj.dimensions.x=length;obj.location.x=west+length/2
            bpy.context.view_layer.objects.active=obj
            obj.select_set(True);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);obj.select_set(False)
b.kitchen_run=kitchen_run

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
    if op['id']=='window_kitchen_balcony':
        shared_kitchen_window(op);return
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

def shared_kitchen_window(op):
    # Two real overlapping sash assemblies in separate tracks, shown closed.
    # This is a provisional window selection, not a measured existing product.
    x1,x2,y=[op[k]/100 for k in ('x1','x2','y1')]
    sill,h=op['sill'],op['height'];length=x2-x1;cx=(x1+x2)/2
    c=op['windowSystem'];frame=c['frameCm']/100;pf=c['panelFrameCm']/100
    def part(label,px,py,z,w,d,height,mat='WarmGrayMetal',role='frame'):
        obj=b.box(op['id']+' / '+label,px,py,z,w,d,height,mat,.0015,'window','kitchen')
        obj['openingId']=op['id'];obj['windowRole']=role;obj['connects']='kitchen,balcony'
        return obj
    for x in (x1+frame/2,x2-frame/2):part('outer jamb',x,y,sill+frame,frame,.12,h-2*frame)
    part('outer head',cx,y,sill+h-frame,length,.12,frame)
    part('outer sill',cx,y,sill,length,.12,frame)
    inner=length-2*frame;overlap=c['overlapCm']/100;pw=(inner+overlap)/2;ph=h-2*frame
    for i in range(2):
        left=x1+frame+i*(pw-overlap);py=y+(i-.5)*c['trackPitchCm']/100;z=sill+frame
        for x in (left+pf/2,left+pw-pf/2):part('sash vertical '+str(i),x,py,z+pf,pf,c['panelDepthCm']/100,ph-2*pf,role='sash')
        for zz in (z,z+ph-pf):part('sash horizontal '+str(i),left+pw/2,py,zz,pw,c['panelDepthCm']/100,pf,role='sash')
        part('clear glass '+str(i),left+pw/2,py,z+pf,pw-2*pf,.006,ph-2*pf,'Glass','glazing')
        part('flush pull '+str(i),left+(pw-.07 if i==0 else .07),py+.013,sill+h/2-.06,.016,.004,.12,'WarmGrayMetal','handle')
    part('stone sill',cx,y,sill-.025,length,.16,.025,'Stone','ledge')

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
    result=paths(result);result.update(version=data['version'],schemeId='suite',layout=data['layout'],appearance=data['appearance'])
    result['design']={'style':'暖白浅木','palette':['#F5F2ED','#C5B9A7','#D5CFC6','#8D9B8F']}
    result['wallFitouts']=data.get('wallFitouts',[])
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
    for obj in bpy.context.scene.objects:
        if obj.type=='LIGHT' and obj.data.type=='AREA':
            obj.data.color=(.95,.97,1) if 'daylight' in obj.name.lower() else (1,.96,.90)
    b.area('Suite entrance gentle fill',(4.22,4.1,2.5),(4.22,4.1,.1),35,.60,(1,.96,.90))
b.lighting=lighting

original_configure=b.configure_render
def configure_render(args):
    original_configure(args)
    # Pale finishes need less exposure than the original yellow-oak palette.
    bpy.context.scene.view_settings.exposure=-.55
b.configure_render=configure_render

if __name__=='__main__':b.main()
