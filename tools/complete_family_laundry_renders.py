"""Record unchanged private-room images as references, never as fresh renders."""
import hashlib
import json
from pathlib import Path
import subprocess
BASE='9e9a10f8a6cca9a212b656e83940fd783094d6b9'
FRESH={'overall','living','dining','bay-living','entry-storage','sideboard','storage-library','kitchen','balcony','laundry-detail','living-wall'}
sha=lambda b:hashlib.sha256(b).hexdigest()
blob=lambda p:subprocess.check_output(['git','show',BASE+':'+p])
c=json.loads(Path('models/design-schemes.json').read_text(encoding='utf-8'))
s=next(s for s in c['schemes'] if s['id']=='family');path=Path(s['manifest'])
m=json.loads(path.read_text(encoding='utf-8'));old=json.loads(blob(s['manifest']))
assert m['baseBlendSha256']==sha(Path(s['blend']).read_bytes())
for view in s['renderViews']:
    image='assets/schemes/family/'+view+'.jpg'
    if view in FRESH:
        r=m['renderedViews'][view]
        assert r['imageSha256']==sha(Path(image).read_bytes()) and r['sourceSha256']==m['sourceSha256'] and r['baseBlendSha256']==m['baseBlendSha256']
        continue
    r=old['renderedViews'][view];assert sha(blob(image))==sha(Path(image).read_bytes())==r['imageSha256']
    m['renderedViews'][view]={**r,'retainedFrom':r.get('retainedFrom') or {'commit':BASE,'manifest':s['manifest'],'view':view,'reason':'本轮仅合并客厅与生活阳台；卧室、两卫及书房构件不变，沿用原房间参考图，未重算全屋间接照明。'}}
m['renderInheritance']={'reviewedAt':'3.5.0','baselineCommit':BASE,'currentViews':sorted(FRESH),'referenceViews':[v for v in s['renderViews'] if v not in FRESH],'note':'受影响公共区域、厨房与阳台真实重渲；未改私密房间保留原图来源。'}
path.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('PASS: 11 current family frames; '+str(len(s['renderViews'])-11)+' immutable room references.')
