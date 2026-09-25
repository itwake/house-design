"""Independent full apartment + children's vehicle library. Never writes suite assets."""
import importlib.util
import json
import math
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('suite_builder',ROOT/'tools/build_suite_layout.py')
s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
b=s.b
b.MODEL_DIR=ROOT/'models/schemes/family'
b.RENDER_DIR=ROOT/'assets/schemes/family'
b.TEX_DIR=b.MODEL_DIR/'textures'
b.VIEWS['dining']=((5.00,11.92,1.68),(3.10,10.65,1.05),19)
b.VIEWS['entry-storage']=((4.66,12.04,1.60),(3.17,13.18,1.22),17)
b.VIEWS['sideboard']=((4.56,11.90,1.60),(2.37,11.94,1.30),22)
b.VIEWS['storage-library']=((4.87,13.12,1.40),(2.78,13.11,1.20),17)

def wheel(name,x,y,z,r,width):
    bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=8,location=(x,-y,z),
        rotation=(math.pi/2,0,0),major_radius=r-.018,minor_radius=.018)
    b.finish(bpy.context.object,name+' tire','Charcoal')
    b.rod(name+' axle',(x,y-width/2,z),(x,y+width/2,z),.014,'WarmGrayMetal')
    for a in range(0,360,45):
        q=math.radians(a);b.rod(name+' spoke',(x,y,z),(x+(r-.025)*math.cos(q),y,z+(r-.025)*math.sin(q)),.0025,'WarmGrayMetal')

def child_bike(f):
    x,y,w,d=[f[k]/100 for k in ('x','y','w','d')];cy=y+d/2
    rear=(x+.20,cy,.20);front=(x+w-.20,cy,.20);crank=(x+.52,cy,.25);seat=(x+.43,cy,.53);head=(x+w-.26,cy,.52)
    for label,p in [('rear',rear),('front',front)]:wheel('Child bicycle '+label,*p,.20,.08)
    for p,q in [(rear,crank),(rear,seat),(crank,seat),(seat,head),(head,crank),(head,front)]:b.rod('Child bicycle sage frame',p,q,.016,'Sage')
    b.rod('Child bicycle seat post',seat,(seat[0]-.025,cy,.62),.012,'WarmGrayMetal')
    b.box('Child bicycle saddle',seat[0]-.025,cy,.605,.22,.145,.04,'Charcoal',.022)
    b.rod('Child bicycle steering',head,(head[0]+.01,cy,.715),.012,'WarmGrayMetal')
    b.rod('Child bicycle handlebar',(head[0]+.01,y+.025,.715),(head[0]+.01,y+d-.025,.715),.016,'WarmGrayMetal')
    for yy in [y+.025,y+d-.115]:b.rod('Child bicycle grip',(head[0]+.01,yy,.715),(head[0]+.01,yy+.09,.715),.022,'Charcoal')
    b.rod('Child bicycle pedal crank',(crank[0],cy-.09,.25),(crank[0],cy+.09,.25),.012,'WarmGrayMetal')
    for yy in [cy-.13,cy+.13]:b.box('Child bicycle pedal',crank[0],yy,.24,.085,.075,.022,'Charcoal',.004)

def stroller(f):
    x,y,w,d=[f[k]/100 for k in ('x','y','w','d')]
    for xx in [x+.11,x+w-.11]:
        for yy in [y+.06,y+d-.06]:wheel('Folded stroller wheel',xx,yy,.085,.08,.06)
    for yy in [y+.09,y+d-.09]:
        for start,end in [((x+.13,yy,.10),(x+w-.12,yy,.72)),((x+w-.12,yy,.12),(x+.21,yy,.79)),((x+.21,yy,.79),(x+.22,yy,1.015))]:
            b.rod('Folded stroller frame',start,end,.014,'WarmGrayMetal')
    b.rod('Folded stroller push handle',(x+.22,y+.09,1.015),(x+.22,y+d-.09,1.015),.025,'Charcoal')
    b.block('Folded stroller packed fabric',x+.20,y+.12,.25,w-.34,d-.24,.50,mat='Linen',bevel=.04)
    b.box('Folded stroller folded canopy',x+.28,y+d/2,.70,.20,d-.21,.10,'Sage',.035)
    b.box('Folded stroller securing strap',x+.19,y+d/2,.46,.035,d-.23,.07,'Charcoal',.006)

original_furnish=b.furnish
def furnish(data):
    original_furnish({**data,'furniture':[f for f in data['furniture'] if not f.get('garageFitoutId')]})
    g=data['garage'];b.CURRENT_ROOM='living'
    for p in g['parts']:
        obj=b.block('Family garage / '+p['id'],p['x']/100,p['y']/100,p['zCm']/100,p['w']/100,p['d']/100,p['hCm']/100,mat=p['material'],bevel=.001,room='living')
        obj['garagePartId']=p['id'];obj['garageRole']=p['role'];obj['garageId']=g['id']
    for f in g['items']:
        before=set(bpy.context.scene.objects)
        (child_bike if f['kind']=='child-bike' else stroller)(f)
        for obj in set(bpy.context.scene.objects)-before:obj['garageItemId']=f['id'];obj['garageId']=g['id']
b.furnish=furnish
original_manifest=b.manifest
def manifest(data,openings,src):
    original_manifest(data,openings,src)
    path=b.MODEL_DIR/'scene-manifest.json'
    result=json.loads(path.read_text(encoding='utf-8'))
    def paths(v):
        if isinstance(v,str):return v.replace('/suite/','/family/')
        if isinstance(v,list):return [paths(a) for a in v]
        if isinstance(v,dict):return {k:paths(a) for k,a in v.items()}
        return v
    result=paths(result);result['schemeId']='family';result['garage']=data['garage']
    # Asset URLs use the new directory; provenance must still point at suite.
    result['layout']=data['layout']
    result['notes']=[n for n in result['notes'] if '7字' not in n and '仅餐柜北两模块' not in n]+data['storageDesign']['assumptions']
    path.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
b.manifest=manifest
original_render=b.render
def render(args):
    path=b.MODEL_DIR/'scene-manifest.json';result=json.loads(path.read_text(encoding='utf-8'))
    pos,target,lens=b.VIEWS['storage-library']
    result['layoutDetails']=[v for v in result.get('layoutDetails',[]) if v['id']!='storage-library']+[{
        'id':'storage-library','title':'亲子大件库 · 折叠门打开示意','roomId':'living',
        'render':'assets/schemes/family/storage-library.jpg',
        'interiorCamera':{'position':b.three(pos),'target':b.three(target),'horizontalFov':round(math.degrees(2*math.atan(36/(2*lens))),2)}}]
    path.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    original_render(args)
b.render=render
original_lighting=b.lighting
def lighting(data):
    original_lighting(data)
    b.area('Family garage soft fill',(3.65,13.12,2.30),(2.45,13.12,.60),20,.65,(1,.96,.90))
b.lighting=lighting

if __name__=='__main__':b.main()
