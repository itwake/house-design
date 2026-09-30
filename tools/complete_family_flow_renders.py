"""Retain unchanged private frames with original provenance after public changes."""
import hashlib
import json
from pathlib import Path
import subprocess
BASE='ab458106ae34b5985ef208d6c485c48862f18bfe'
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
    m['renderedViews'][view]={**r,'retainedFrom':r.get('retainedFrom') or {'commit':BASE,'manifest':s['manifest'],'view':view,'reason':'本轮仅公共家具与储物变化；私密房间未改，沿用参考帧，不冒充新的全屋照明计算。'}}
m['renderInheritance']={'reviewedAt':'3.5.2','baselineCommit':BASE,'currentViews':sorted(FRESH),'referenceViews':[v for v in s['renderViews'] if v not in FRESH],'note':'11张公共区域同源新渲染；8张未改私密房间保留原图及来源。'}
path.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('PASS: 11 current folding/L-counter/living frames and 8 private references.')
