"""Keep unchanged private photos honest while 12 public endpoint frames change."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[1]
BASE='a2b623c9813c0d2a664abf31ab575fc6c0fd2b0d'
FRESH={'overall','living','dining','dining-closed','bay-living','entry-storage','sideboard','storage-library','kitchen','balcony','laundry-detail','living-wall'}
sha=lambda value:hashlib.sha256(value).hexdigest()
blob=lambda path:subprocess.check_output(['git','show',BASE+':'+path],cwd=ROOT)
catalog=json.loads((ROOT/'models/design-schemes.json').read_text(encoding='utf-8'))
scheme=next(item for item in catalog['schemes'] if item['id']=='family');path=ROOT/scheme['manifest']
current=json.loads(path.read_text(encoding='utf-8'));old=json.loads(blob(scheme['manifest']))
assert current['baseBlendSha256']==sha((ROOT/scheme['blend']).read_bytes())
assert current['familyDiningRevision']['version']=='3.5.3'
assert FRESH.issubset(set(scheme['renderViews']))
assert len(scheme['renderViews'])==20
for view in scheme['renderViews']:
    image='assets/schemes/family/'+view+'.jpg'
    if view in FRESH:
        record=current['renderedViews'][view]
        assert record['imageSha256']==sha((ROOT/image).read_bytes())
        assert record['sourceSha256']==current['sourceSha256'] and record['baseBlendSha256']==current['baseBlendSha256']
        assert record['diningState']==('closed' if view=='dining-closed' else 'expanded')
        assert record['cameraState'] and record['cameraHash']
    else:
        record=old['renderedViews'][view]
        assert sha(blob(image))==sha((ROOT/image).read_bytes())==record['imageSha256']
        current['renderedViews'][view]={**record,'retainedFrom':record.get('retainedFrom') or {'commit':BASE,'manifest':scheme['manifest'],'view':view,'reason':'仅客餐厅家具与餐柜改动；未改私密房间保留来源明确的参考帧，不冒充新全屋照明计算。'}}
current['renderInheritance']={'reviewedAt':'3.5.3','baselineCommit':BASE,'currentViews':sorted(FRESH),'referenceViews':[view for view in scheme['renderViews'] if view not in FRESH],'note':'12张公共区域及展开/收起端状态同源新渲染；8张未改私密房间保留原图及来源。'}
path.write_text(json.dumps(current,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('PASS: 12 current dining/living endpoint frames and 8 private references.')
