"""Compare every actual mesh against the published V3.4.1 Git blob."""
from pathlib import Path
import subprocess
import sys
from validate_design_schemes import GLB
ROOT=Path(__file__).resolve().parents[1]
BASE='647d219fdc52e0bc71810f6a8e2daa97135be0cc'
OPENING='window_living_west'
REMOVED={'l_desktop','l_support','l_accessories','l_adult_chair','l_child_chair'}
class GitVersion:
 def __init__(self,path):self.path=path
 def read_bytes(self):return subprocess.check_output(['git','show',BASE+':'+self.path],cwd=ROOT)
 def __str__(self):return BASE+':'+self.path
def targeted(name,obj):
 return name=='Wall 03 / sill' or obj['extras'].get('openingId')==OPENING
def near(a,b):
 assert abs(a-b)<.0001,(a,b)
for sid in (sys.argv[1:] or ('wood','suite','family','laundry')):
 assert sid in ('wood','suite','family','laundry')
 relative=f'models/schemes/{sid}/huiyayuan-wood.glb'
 old=GLB(GitVersion(relative)).world_meshes();new=GLB(ROOT/relative).world_meshes()
 before={k:v for k,v in old.items() if not targeted(k,v)}
 after={k:v for k,v in new.items() if not targeted(k,v)}
 assert set(before)==set(after),(sid,'Unrelated objects added or removed')
 for name,obj in after.items():
  for key in ('geometry','bounds','materials','extras'):assert obj[key]==before[name][key],(sid,name,key)
 low,high=new['Wall 03 / sill']['bounds'];near(low[1],0);near(high[1],.4)
 for pid,y in [('l_seat_pad_north',6.50),('l_seat_pad_south',7.48)]:
  parts=[o for o in new.values() if o['extras'].get('fitoutPartId')==pid]
  assert len(parts)==2,(sid,pid,'padded mesh plus piping')
  lo=[min(p['bounds'][0][i] for p in parts) for i in range(3)]
  hi=[max(p['bounds'][1][i] for p in parts) for i in range(3)]
  for a,b in zip(lo,[1.48,.4,y]):near(a,b)
  for a,b in zip(hi,[2.03,.45,y+.96]):near(a,b)
 assert not any(o['extras'].get('fitoutPartId') in REMOVED|{'l_ledge'} for o in new.values())
 panes=[o for o in new.values() if o['extras'].get('openingId')==OPENING and o['extras'].get('bayRole')=='frontGlazing']
 assert len(panes)==2
 for p in panes:near(p['bounds'][0][1],.43);near(p['bounds'][1][1],2.27)
 print(f'PASS {sid}: actual 400 mm sill and 450 mm pad top; {len(after)} unrelated meshes identical.',flush=True)
 del old,new
