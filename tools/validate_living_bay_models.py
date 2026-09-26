"""Compare every real exported mesh to the published V3.4.0 Git blob."""
from pathlib import Path
import subprocess
import sys
from validate_design_schemes import GLB
ROOT=Path(__file__).resolve().parents[1]
BASE='c2e5a5f399709185b2e843c64e622a0373927602'
REMOVED={'l_desktop','l_support','l_accessories','l_adult_chair','l_child_chair'}
class GitVersion:
 def __init__(self,path):self.path=path
 def read_bytes(self):return subprocess.check_output(['git','show',BASE+':'+self.path],cwd=ROOT)
 def __str__(self):return BASE+':'+self.path
for sid in (sys.argv[1:] or ('wood','suite','family','laundry')):
 assert sid in ('wood','suite','family','laundry')
 relative=f'models/schemes/{sid}/huiyayuan-wood.glb'
 old=GLB(GitVersion(relative)).world_meshes();new=GLB(ROOT/relative).world_meshes()
 victims={name for name,obj in old.items() if obj['extras'].get('fitoutId')=='bay_living_family' and obj['extras'].get('fitoutPartId') in REMOVED}
 assert victims and {old[n]['extras']['fitoutPartId'] for n in victims}==REMOVED
 assert set(new)==set(old)-victims,(sid,'Unexpected added/removed objects',set(new)-set(old),set(old)-set(new)-victims)
 for name,obj in new.items():
  for key in ('geometry','bounds','materials','extras'):assert obj[key]==old[name][key],(sid,name,key)
 assert not any(obj['extras'].get('fitoutId')=='bay_living_family' and obj['extras'].get('fitoutPartId') in REMOVED for obj in new.values())
 print(f'PASS {sid}: removed {len(victims)} desk/chair/accessory meshes; {len(new)} other meshes exactly preserved.',flush=True)
 del old,new
