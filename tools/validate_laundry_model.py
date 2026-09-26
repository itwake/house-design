"""Decode actual GLB meshes: new laundry solids and protected inherited geometry."""
import json
from collections import defaultdict
from pathlib import Path
from validate_design_schemes import GLB
ROOT=Path(__file__).resolve().parents[1]
read=lambda p:json.loads((ROOT/p).read_text(encoding='utf-8'))
d=read('models/schemes/laundry/design-data.json');l=d['laundry']
base=GLB(ROOT/'models/schemes/suite/huiyayuan-wood.glb').world_meshes()
model=GLB(ROOT/'models/schemes/laundry/huiyayuan-wood.glb').world_meshes()
manifest=read('models/schemes/laundry/scene-manifest.json')
def groups(meshes,key):
    out=defaultdict(list)
    for m in meshes.values():
        value=m['extras'].get(key)
        if value is not None:out[value].append(m['geometry'])
    return {k:sorted(v) for k,v in out.items()}
def bounds(items):return [[min(p['bounds'][0][i] for p in items) for i in range(3)],[max(p['bounds'][1][i] for p in items) for i in range(3)]]
def near(a,b):return max(abs(x-y) for x,y in zip(a,b))<.00004
def selected(key,value):return [m for m in model.values() if m['extras'].get(key)==value]
for key in ('wallPartId','fitoutPartId','storagePartId'):
    assert groups(base,key)==groups(model,key),'Inherited fitouts '+key
for key,skip in [('wallIndex',{8}),('openingId',{'balcony_door'})]:
    before,after=groups(base,key),groups(model,key)
    for k,geom in before.items():
        if k not in skip:assert after.get(k)==geom,'Inherited geometry changed '+str(k)
before,after=groups(base,'furnitureId'),groups(model,'furnitureId')
allowed=('洗烘塔','阳台家政柜','三人沙发','茶几','电视薄柜')
for k,v in before.items():
    if not any(name in str(k) for name in allowed):assert after.get(k)==v,'Unrelated furniture '+str(k)
for p in l['parts']:
    actual=selected('laundryPartId',p['id']);assert len(actual)==1,p['id']
    lo,hi=bounds(actual)
    expected=[[p['x']/100,p['zCm']/100,p['y']/100],[(p['x']+p['w'])/100,(p['zCm']+p['hCm'])/100,(p['y']+p['d'])/100]]
    assert near(lo,expected[0]) and near(hi,expected[1]),('Part dimensions',p['id'],lo,hi)
for f in l['machines']:
    actual=selected('laundryMachineId',f['id']);assert len(actual)>=13
    lo,hi=bounds(actual);expected=[[f['x']/100,0,f['y']/100],[(f['x']+f['w'])/100,f['heightCm']/100,(f['y']+f['d'])/100]]
    assert all(lo[i]>=expected[0][i]-.00004 and hi[i]<=expected[1][i]+.00004 for i in range(3)),('Machine escapes envelope',f['id'],lo,hi)
    assert abs(lo[1])<.00004 and abs(hi[1]-.85)<.00004,'Both appliances floor mounted and 850mm high'
    for p in model.values():
        if not p['extras'].get('laundryPartId') and not p['extras'].get('laundryBasin'):continue
        a,b=p['bounds'];intersects=all(min(hi[i],b[i])-max(lo[i],a[i])>.00004 for i in range(3))
        assert not intersects,('New support/basin intersects machine envelope',f['id'],p)
basin=[m for name,m in model.items() if name.startswith('Shallow basin')]
assert len(basin)==5 and near(bounds(basin)[0],[6.73,.88,10.38]) and near(bounds(basin)[1],[7.25,.98,11.12]),'Actual shallow hollow bowl dimensions'
door=selected('openingId','balcony_door');assert door
assert abs(bounds(door)[0][0]-6.45)<.001,'C frame front aligns with B front at x6.45m'
assert set(m['extras'].get('slidingPanelIndex') for m in door if 'slidingPanelIndex' in m['extras'])=={0,1,2}
source_door=next(v for v in d['doors'] if v['id']=='balcony_door');c=source_door['sliding']
inner=source_door['y2']-source_door['y1']-2*c['jambCm'];panel=(inner+2*c['overlapCm'])/3
parked=[]
for m in door:
    if 'slidingPanelIndex' not in m['extras']:continue
    i=m['extras']['slidingPanelIndex'];shift=(2-i)*(panel-c['overlapCm']-c['stackStaggerCm'])/100
    assert near(m['extras']['slideOpenOffsetM'],[0,0,shift]),'Actual GLB leaf must park south'
    parked.append([m['bounds'][0][2]+shift,m['bounds'][1][2]+shift])
assert abs(max(v[1] for v in parked)-(source_door['y2']-c['jambCm'])/100)<.00004
assert abs(min(v[0] for v in parked)-(source_door['y2']-c['jambCm']-panel-2*c['stackStaggerCm'])/100)<.00004
assert manifest['laundry']==l and manifest['layout']==d['layout']
assert len(groups(model,'laundryPartId'))==len(l['parts'])
print(f'PASS laundry actual GLB: {len(model)} meshes, {len(l["parts"])} exact parts; two ground appliances, no support/basin volume conflicts, C frame/B face alignment; inherited geometry protected.')

# Scheme1 really receives the same kitchen aperture and window, not only text.
wood=GLB(ROOT/'models/schemes/wood/huiyayuan-wood.glb').world_meshes()
assert groups(wood,'openingId')['window_kitchen_balcony']==groups(base,'openingId')['window_kitchen_balcony'],'Scheme1 actual kitchen window matches scheme2/3'
original=GLB(ROOT/'models/huiyayuan-wood.glb').world_meshes()
for key in ('fitoutPartId','storagePartId'):
    assert groups(wood,key)==groups(original,key),'Wood non-kitchen fitout changed '+key
for k,v in groups(original,'openingId').items():assert groups(wood,'openingId').get(k)==v,'Original opening retained '+str(k)
for k,v in groups(original,'furnitureId').items():
    if '厨房北侧地柜' not in str(k):assert groups(wood,'furnitureId').get(k)==v,'Original scheme furniture remains in place '+str(k)
print('PASS isolated wood kitchen refresh: original bays/storage/furniture/openings remain, shared kitchen window is real exported geometry.')
