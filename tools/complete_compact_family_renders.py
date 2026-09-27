"""Preserve untouched family images with their real history; never relabel old frames."""
import hashlib
import json
from pathlib import Path
import subprocess
BASE='ac2b91d366b8aeb0f53744b03b1ca48f95e95fdc'
MUST_RENDER={'overall','living','dining','bay-living','entry-storage','sideboard','storage-library'}
sha=lambda b:hashlib.sha256(b).hexdigest()
blob=lambda p:subprocess.check_output(['git','show',BASE+':'+p])
catalog=json.loads(Path('models/design-schemes.json').read_text(encoding='utf-8'))
s=next(s for s in catalog['schemes'] if s['id']=='family')
path=Path(s['manifest']);m=json.loads(path.read_text(encoding='utf-8'));old=json.loads(blob(s['manifest']))
assert m['baseBlendSha256']==sha(Path(s['blend']).read_bytes())
fresh=[];retained=[]
for view in s['renderViews']:
    image=s.get('renderDirectory','assets/schemes/'+s['id'])+'/'+view+'.jpg';image_sha=sha(Path(image).read_bytes())
    if view in MUST_RENDER:
        rec=m['renderedViews'][view]
        assert not rec.get('retainedFrom')
        assert rec['imageSha256']==image_sha and rec['sourceSha256']==m['sourceSha256'] and rec['baseBlendSha256']==m['baseBlendSha256']
        fresh.append(view);continue
    rec=old['renderedViews'][view]
    assert sha(blob(image))==image_sha==rec['imageSha256']
    m.setdefault('renderedViews',{})[view]={**rec,'retainedFrom':rec.get('retainedFrom') or {'commit':BASE,'manifest':s['manifest'],'view':view,'reason':'本轮仅调整方案3南侧储物库及短餐柜；未改房间视角沿用原图，未重算间接照明。'}}
    retained.append(view)
m['renderInheritance']={'reviewedAt':'3.4.3','baselineCommit':BASE,'currentViews':fresh,'referenceViews':retained,'note':'餐区、储物库及受影响客厅七视角真实重渲；其余保留原始图像与来源，不冒充当前新图。'}
path.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('PASS family: '+str(len(fresh))+' current frames; '+str(len(retained))+' immutable historical references.')
