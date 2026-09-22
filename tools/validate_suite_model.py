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
    for name,item in meshes.items():
        if key=='openingId' and item['extras'].get('kind') not in ('window','door'):continue
        value=item['extras'].get(key)
        # The only existing kitchen part changed is the shelf shortened to
        # clear the new window; validate its decoded footprint separately.
        if key=='furnitureId' and value=='厨房北侧地柜' and 'Kitchen open oak shelf' in name.replace('_',' '):continue
        if value:groups[value].append(item['geometry'])
    return {k:sorted(v) for k,v in groups.items()}
before=geometry_groups(base,'furnitureId');after=geometry_groups(model,'furnitureId')
excluded={'vanity_main','vanity_guest','书房办公椅','主卧衣柜','主卫壁挂马桶','a_desktop','a_support','a_accessories','a_chair','l_adult_chair','bed_b','次卧衣柜','书房日床','书房客衣柜','1100书桌'}
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
assert not any(m['extras'].get('furnitureId') in {'书房日床','书房客衣柜','1100书桌'} for m in model.values()),'Removed study furniture exported'
# Decode real meshes for every newly fitted footprint, including its details.
for fid in ['bed_b','次卧衣柜','主卧衣柜','study_full_desk','bed_b_niche_console','study_north_sofa']:
    f=next(f for f in data['furniture'] if (f.get('id') or f['name'])==fid)
    parts=[m for m in model.values() if m['extras'].get('furnitureId')==fid]
    assert parts,('Missing furniture',fid)
    lo=[min(m['bounds'][0][i] for m in parts) for i in range(3)]
    hi=[max(m['bounds'][1][i] for m in parts) for i in range(3)]
    assert near([lo[0],lo[2]],[f['x']/100,f['y']/100]),('Fitted minimum bounds',fid,lo)
    assert near([hi[0],hi[2]],[(f['x']+f['w'])/100,(f['y']+f['d'])/100]),('Fitted maximum bounds',fid,hi)
back=next(m for n,m in model.items() if 'Study sofa NORTH back' in n.replace('_',' '))
assert near([back['bounds'][0][2],back['bounds'][1][2]],[3.34,3.51]),'Sofa back must be north'
for fid in ['study_full_desk','bed_b_niche_console']:
    top=next(m for n,m in model.items() if m['extras'].get('furnitureId')==fid and 'continuous tabletop' in n.replace('_',' '))
    assert near([top['bounds'][0][1],top['bounds'][1][1]],[.73,.76]),'Actual tabletop, not a solid generic block'
assert manifest['appearance']['preset']=='soft-warm'
assert manifest['wallFitouts']==data['wallFitouts'],'Manifest bookwall must match source'
for fit in data.get('wallFitouts',[]):
    parts=[m for m in model.values() if m['extras'].get('wallFitoutId')==fit['id']]
    assert len(parts)==len(fit['parts']),'Every declared bookcase component is a real mesh'
    for p in fit['parts']:
        mesh=next(m for m in parts if m['extras'].get('wallPartId')==p['id'])
        assert mesh['extras']['wallPartRole']==p['role']
        expected_lo=[p['x']/100,p['zCm']/100,p['y']/100]
        expected_hi=[(p['x']+p['w'])/100,(p['zCm']+p['hCm'])/100,(p['y']+p['d'])/100]
        assert near(mesh['bounds'][0],expected_lo) and near(mesh['bounds'][1],expected_hi),'Actual bookwall bounds differ: '+p['id']
window_parts=[m for m in model.values() if m['extras'].get('openingId')=='window_kitchen_balcony']
assert len(window_parts)==17,('Kitchen internal window real parts',len(window_parts))
glass=[m for m in window_parts if m['extras'].get('windowRole')=='glazing']
assert len(glass)==2,'Two real glass sashes'
assert all(m['extras'].get('connects')=='kitchen,balcony' for m in window_parts)
frame=[m for m in window_parts if m['extras'].get('windowRole')=='frame']
lo=[min(m['bounds'][0][i] for m in frame) for i in range(3)]
hi=[max(m['bounds'][1][i] for m in frame) for i in range(3)]
assert near(lo,[6.98,1.0,11.15]) and near(hi,[8.18,2.3,11.27]),('Window actual frame envelope',lo,hi)
for i,m in enumerate(sorted(glass,key=lambda m:m['bounds'][0][0])):
    assert near([m['bounds'][0][1],m['bounds'][1][1]],[1.063,2.237]),'Window glass height'
    assert abs(sum(m['bounds'][j][2] for j in range(2))/2-(11.21+(i-.5)*.036))<.00003,'Separate sash tracks'
shelves=[m for n,m in model.items() if m['extras'].get('furnitureId')=='厨房北侧地柜' and 'Kitchen open oak shelf' in n.replace('_',' ')]
assert len(shelves)==1
assert near([shelves[0]['bounds'][0][0],shelves[0]['bounds'][1][0]],[6.0,6.92]),'Shelf stops before window instead of crossing it'
assert manifest['design']=={'style':'暖白浅木','palette':['#F5F2ED','#C5B9A7','#D5CFC6','#8D9B8F']},'Manifest finish summary must match revised palette'
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
    operation=door.get('operation',{})
    if operation.get('type')=='hinged':
        p=operation['openLeafCm']
        expected_lo=[p['x']/100,.02,p['y']/100]
        expected_hi=[(p['x']+p['w'])/100,door['heightCm']/100-.055,(p['y']+p['d'])/100]
        assert parts[0]['extras']['doorRole']=='hinged-open-panel'
    elif operation.get('type')=='surface-sliding':
        p=operation['panelCm'];q=operation['parkedCm']
        expected_lo=[p['x']/100,.012,p['y']/100]
        expected_hi=[(p['x']+p['w'])/100,door['heightCm']/100-.013,(p['y']+p['d'])/100]
        shift=parts[0]['extras']['slideOpenOffsetM']
        assert near(shift,[(q['x']-p['x'])/100,0,(q['y']-p['y'])/100])
    elif vertical:
        expected_lo=[door['x1']/100-.019,.02,door['y1']/100+.055]
        expected_hi=[door['x1']/100+.019,door['heightCm']/100-.055,door['y2']/100-.055]
    else:
        expected_lo=[door['x1']/100+.055,.02,door['y1']/100-.019]
        expected_hi=[door['x2']/100-.055,door['heightCm']/100-.055,door['y1']/100+.019]
    assert near(lo,expected_lo) and near(hi,expected_hi),'Actual door leaf has wrong pose '+door['id']

print(f'PASS suite actual GLB: {len(model)} decoded meshes, {checked} exact wall solids, 5 relocated door leaves, independent room/opening manifest, {preserved} preserved furniture meshes; unchanged bays/storage/kitchen slider, master desk+chair absent.')
