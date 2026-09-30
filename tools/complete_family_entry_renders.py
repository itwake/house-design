"""Keep private reference frames honest while entry/public views are rerendered."""
import hashlib
import json
from pathlib import Path
import subprocess
BASE='0466fda43a8ccbd60a7b47354869977819096fd4'
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
    m['renderedViews'][view]={**r,'retainedFrom':r.get('retainedFrom') or {'commit':BASE,'manifest':s['manifest'],'view':view,'reason':'本轮仅入户库、餐柜和餐桌椅变化；未改私密房间沿用来源明确的参考帧，不冒充新全屋照明渲染。'}}
m['renderInheritance']={'reviewedAt':'3.5.1','baselineCommit':BASE,'currentViews':sorted(FRESH),'referenceViews':[v for v in s['renderViews'] if v not in FRESH],'note':'11张公共区域同源新渲染；8张未改私密房间保留原帧及来源。'}
path.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('PASS: 11 current entry/public renders and 8 immutable private references.')
