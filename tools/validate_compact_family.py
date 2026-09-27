"""Decode actual GLB triangles and protect all unrelated V3.4.2 family meshes."""
import json
from pathlib import Path
import subprocess
from validate_design_schemes import GLB
ROOT=Path(__file__).resolve().parents[1]
BASE='ac2b91d366b8aeb0f53744b03b1ca48f95e95fdc'
relative='models/schemes/family/huiyayuan-wood.glb'
class GitVersion:
    def read_bytes(self):return subprocess.check_output(['git','show',BASE+':'+relative],cwd=ROOT)
    def __str__(self):return BASE+':'+relative
old=GLB(GitVersion()).world_meshes();new=GLB(ROOT/relative).world_meshes()
def changed(mesh):
    e=mesh['extras']
    return e.get('garageId')=='family_garage' or str(e.get('storagePartId','')).startswith('family_sideboard_')
protected={n:m for n,m in old.items() if not changed(m)}
actual={n:m for n,m in new.items() if not changed(m)}
assert set(actual)==set(protected),'Unexpected mesh added/removed outside garage and short sideboard'
for name,m in actual.items():
    for key in ('geometry','bounds','materials','extras'):
        assert m[key]==protected[name][key],(name,key)
moved=0
for name,m in old.items():
    if not str(m['extras'].get('storagePartId','')).startswith('family_sideboard_'):continue
    q=new[name]
    assert q['materials']==m['materials'] and q['extras']==m['extras']
    assert q['triangles']==m['triangles']
    for before,after in zip(m['bounds'],q['bounds']):
        expected=[before[0],before[1],before[2]-.5]
        assert max(abs(a-b) for a,b in zip(after,expected))<.00003,(name,after,expected)
    moved+=1
assert moved>20
data=json.loads((ROOT/'models/schemes/family/design-data.json').read_text(encoding='utf-8'))
assert data['garageRevision']['baselineCommit']==BASE
assert data['garage']['face']=='north' and data['garage']['metrics']['footprintM2']==1.8
assert abs(new['Wall 03 / sill']['bounds'][1][1]-.4)<.0001
print(f'PASS compact family: {len(protected)} unrelated actual meshes unchanged, {moved} short-cabinet meshes translated exactly 500 mm north; 400 mm low bay retained.')
