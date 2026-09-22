"""Decode actual suite GLB triangles, not merely source/accessor claims."""
import json
from collections import defaultdict
from pathlib import Path
from validate_design_schemes import GLB

ROOT=Path(__file__).resolve().parents[1]
read=lambda p:json.loads((ROOT/p).read_text(encoding='utf-8'))
data=read('models/schemes/suite/design-data.json')
base_data=read('models/design-data.json')
manifest=read('models/schemes/suite/scene-manifest.json')
base=GLB(ROOT/'models/huiyayuan-wood.glb').world_meshes()
model=GLB(ROOT/'models/schemes/suite/huiyayuan-wood.glb').world_meshes()
def near(a,b):return max(abs(x-y) for x,y in zip(a,b))<.00003
def geometry_groups(meshes,key):
    groups=defaultdict(list)
    for item in meshes.values():
        if key=='openingId' and item['extras'].get('kind') not in ('window','door'):continue
        value=item['extras'].get(key)
        if value:groups[value].append(item['geometry'])
    return {k:sorted(v) for k,v in groups.items()}
before=geometry_groups(base,'furnitureId');after=geometry_groups(model,'furnitureId')
excluded={'vanity_main','vanity_guest','书房办公椅','a_desktop','a_support','a_accessories','a_chair','l_adult_chair'}
preserved=0
for key,hashes in before.items():
    if key not in excluded:
        assert after.get(key)==hashes,'Unrelated furniture actual triangles changed: '+key
        preserved+=len(hashes)
for field,excluded in [('openingId',{'door_a','door_b','door_c','door_bath_1','door_bath_2'}),('storagePartId',set()),('fitoutPartId',{'a_desktop','a_support','a_accessories','a_chair','l_adult_chair'})]:
    original=geometry_groups(base,field);current=geometry_groups(model,field)
    for key,hashes in original.items():
        if key not in excluded:assert current.get(key)==hashes,field+' moved: '+key
assert not any(m['extras'].get('fitoutPartId','').startswith('a_') for m in model.values()),'Master desk/chair geometry still exported'
assert not any(m['extras'].get('fitoutId')=='bay_a_office_vanity' for m in model.values()),'Old master desk components still exported'
for room in data['rooms']:
    actual=next(r for r in manifest['rooms'] if r['id']==room['id'])
    assert actual['points']==[[x/100,y/100] for x,y in room['points']]
    assert abs(actual['area']-room['modelAreaM2'])<=.0051
for op in data['windows']+data['doors']:
    actual=next(o for o in manifest['openings'] if o['id']==op['id'])
    assert all(actual[k]==v for k,v in op.items()),'Manifest opening differs: '+op['id']

# Reconstruct every wall solid interval with the declared openings and compare
# each world-space bounding box decoded from actual mesh POSITION triangles.
checked=0
for index,(ax,ay,bx,by) in enumerate(data['walls']):
    horizontal=ay==by;lo,hi=sorted((ax,bx) if horizontal else (ay,by));fixed=ay if horizontal else ax
    cuts=[]
    for op in manifest['openings']:
        aligned=op['y1']==op['y2']==fixed if horizontal else op['x1']==op['x2']==fixed
        start,end=sorted((op['x1'],op['x2']) if horizontal else (op['y1'],op['y2']))
        if aligned and start>=lo and end<=hi:cuts.append((start,end,op))
    expected=[]
    def solid(a,b,z,h):
        if b-a<.3 or h<.003:return
        if horizontal:expected.append([[a/100,z,(fixed-6)/100],[b/100,z+h,(fixed+6)/100]])
        else:expected.append([[(fixed-6)/100,z,a/100],[(fixed+6)/100,z+h,b/100]])
    cursor=lo
    for start,end,op in sorted(cuts,key=lambda x:x[0]):
        solid(cursor,start,0,2.7);solid(start,end,0,op['sill'])
        top=op['sill']+op['height'];solid(start,end,top,2.7-top);cursor=end
    solid(cursor,hi,0,2.7)
    actual=[m['bounds'] for m in model.values() if m['extras'].get('wallIndex')==index]
    assert len(actual)==len(expected),(index,len(actual),len(expected))
    for box in expected:
        assert sum(near(box[0],m[0]) and near(box[1],m[1]) for m in actual)==1,('Wall geometry mismatch',index,box)
        checked+=1

for door in data['doors']:
    if door['kind']!='interior-door':continue
    parts=[m for name,m in model.items() if m['extras'].get('openingId')==door['id'] and 'oak door leaf' in name.replace('_',' ')]
    assert len(parts)==1,(door['id'],len(parts))
    lo,hi=parts[0]['bounds'];vertical=door['x1']==door['x2']
    if vertical:
        expected_lo=[door['x1']/100-.019,.02,door['y1']/100+.055]
        expected_hi=[door['x1']/100+.019,door['heightCm']/100-.055,door['y2']/100-.055]
    else:
        expected_lo=[door['x1']/100+.055,.02,door['y1']/100-.019]
        expected_hi=[door['x2']/100-.055,door['heightCm']/100-.055,door['y1']/100+.019]
    assert near(lo,expected_lo) and near(hi,expected_hi),'Actual door leaf has wrong pose '+door['id']

print(f'PASS suite actual GLB: {len(model)} decoded meshes, {checked} exact wall solids, 5 relocated door leaves, independent room/opening manifest, {preserved} preserved furniture meshes; unchanged bays/storage/kitchen slider, master desk+chair absent.')
