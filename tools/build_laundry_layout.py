"""Fourth layout: real parallel appliances, shallow sink and aligned bookwall."""
import importlib.util
import json
import math
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('suite_builder',ROOT/'tools/build_suite_layout.py')
s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s);b=s.b
b.MODEL_DIR=ROOT/'models/schemes/laundry';b.RENDER_DIR=ROOT/'assets/schemes/laundry';b.TEX_DIR=b.MODEL_DIR/'textures'
b.VIEWS['living']=((3.25,10.68,1.60),(6.50,8.20,1.25),20)
b.VIEWS['balcony']=((7.44,9.86,1.28),(7.44,10.78,.68),16)
b.VIEWS['laundry-detail']=((8.03,9.90,1.45),(7.28,10.70,.90),17)
b.VIEWS['living-wall']=((3.23,10.95,1.62),(6.57,8.85,1.28),18)
original_lamp=b.lamp
def lamp(x,y,*args,**kwargs):
    if abs(x-6.48)<.0001 and abs(y-8.98)<.0001:x,y=3.35,8.75
    return original_lamp(x,y,*args,**kwargs)
b.lamp=lamp

def front_cylinder(name,x,y,z,radius,depth,mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=radius,depth=depth,location=(x,-y,z),rotation=(math.pi/2,0,0))
    return b.finish(bpy.context.object,name,mat,.002)

def appliance(f):
    x,y,w,d,h=[f[k]/100 for k in ('x','y','w','d','heightCm')]
    # Closed-door envelope includes real feet, controls and projecting port.
    for xx in (x+.07,x+w-.07):
        for yy in (y+.12,y+d-.07):b.box('Laundry adjustable foot',xx,yy,0,.05,.05,.03,'Charcoal',.006)
    b.block('Laundry appliance body',x,y+.055,.025,w,d-.055,h-.025,mat='Cream',bevel=.009)
    b.block('Laundry control fascia',x+.02,y+.048,h-.16,w-.04,.010,.12,mat='WhiteLinen',bevel=.004)
    b.box('Laundry display',x+w-.14,y+.040,h-.128,.17,.010,.045,'Charcoal',.004)
    front_cylinder('Laundry dial',x+.18,y+.035,h-.08,.032,.015,'WarmGrayMetal')
    for radius,depth,mat,front in [(.228,.045,'WarmGrayMetal',y+.0225),(.202,.012,'Charcoal',y+.010),(.172,.009,'GlassDark',y+.0045)]:
        front_cylinder('Laundry circular front '+mat,x+w/2,front,.44,radius,depth,mat)
    b.box('Laundry door handle',x+w*.80,y+.02,.42,.027,.033,.12,'Cream',.009)
    if f['id']=='laundry_dryer':
        b.block('Dryer lower service cover',x+.08,y+.046,.08,w-.16,.011,.09,mat='Linen',bevel=.005)
    else:
        b.block('Washer detergent drawer',x+.03,y+.034,h-.13,.11,.01,.07,mat='Cream',bevel=.004)

def sink(l):
    p=l['basin'];x,y,w,d=[p[k]/100 for k in ('x','y','w','d')];z=p['bottomCm']/100;top=p['rimCm']/100
    # Shallow shell with a real empty bowl, NOT a solid intersecting machine.
    b.block('Shallow basin floor',x+.025,y+.025,z,w-.05,d-.05,.016,mat='Ceramic',bevel=.009)
    for xx in (x,x+w-.025):b.block('Shallow basin side',xx,y,z,.025,d,top-z,mat='Ceramic',bevel=.008)
    for yy in (y,y+d-.055):b.block('Shallow basin rim',x+.025,yy,z,w-.05,.055,top-z,mat='Ceramic',bevel=.008)
    dx,dy=[p['drain'][k]/100 for k in ('x','y')]
    b.cylinder('Rear offset drain cover',dx,dy,z+.017,.022,.005,'WarmGrayMetal')
    tx,ty=[p['tap'][k]/100 for k in ('x','y')]
    # Tap is west of the kitchen-window aperture, not through its glazing.
    b.rod('Laundry tap riser',(tx,ty,top),(tx,ty,top+.20),.013,'WarmGrayMetal')
    b.rod('Laundry tap spout',(tx,ty,top+.20),(tx,ty-.13,top+.20),.013,'WarmGrayMetal')
    b.rod('Laundry tap outlet',(tx,ty-.13,top+.20),(tx,ty-.13,top+.15),.013,'WarmGrayMetal')
    # Schematic rear service route; no pipe occupies either appliance envelope.
    for a,c in [((dx,dy,z),(dx,dy,.76)),((dx,dy,.76),(8.12,dy,.76)),((8.12,dy,.76),(8.12,dy,.15))]:
        b.rod('Schematic accessible rear drain',a,c,.021,'Cream')

original_furnish=b.furnish
def furnish(data):
    original_furnish({**data,'furniture':[f for f in data['furniture'] if not f.get('laundryFitoutId')]})
    l=data['laundry']
    for p in l['parts']:
        obj=b.block('Laundry scheme / '+p['id'],p['x']/100,p['y']/100,p['zCm']/100,p['w']/100,p['d']/100,p['hCm']/100,mat=p['material'],bevel=.001,room=p['roomId'])
        obj['laundryPartId']=p['id'];obj['laundryRole']=p['role'];obj['laundryId']=l['id']
    b.CURRENT_ROOM='balcony'
    for f in l['machines']:
        before=set(bpy.context.scene.objects);appliance(f)
        for obj in set(bpy.context.scene.objects)-before:obj['laundryMachineId']=f['id'];obj['furnitureId']=f['id']
    before=set(bpy.context.scene.objects);sink(l)
    for obj in set(bpy.context.scene.objects)-before:obj['laundryBasin']=True
b.furnish=furnish
original_manifest=b.manifest
def manifest(data,openings,src):
    original_manifest(data,openings,src);path=b.MODEL_DIR/'scene-manifest.json';m=json.loads(path.read_text(encoding='utf-8'))
    def paths(v):
        if isinstance(v,str):return v.replace('/suite/','/laundry/')
        if isinstance(v,list):return [paths(i) for i in v]
        if isinstance(v,dict):return {k:paths(i) for k,i in v.items()}
        return v
    m=paths(m);m.update(schemeId='laundry',layout=data['layout'],laundry=data['laundry'],kitchenReference=data['kitchenReference'])
    for name,title in [('laundry-detail','A · 并排洗烘与上方浅盆'),('living-wall','B书架与C推拉门的齐平关系')]:
        pos,target,lens=b.VIEWS[name];m['layoutDetails'].append({'id':name,'title':title,'roomId':'balcony' if name=='laundry-detail' else 'living','render':f'assets/schemes/laundry/{name}.jpg','interiorCamera':{'position':b.three(pos),'target':b.three(target),'horizontalFov':round(math.degrees(2*math.atan(36/(2*lens))),2)}})
    m['notes']+=data['laundry']['conditions'];path.write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8')
b.manifest=manifest
if __name__=='__main__':b.main()
