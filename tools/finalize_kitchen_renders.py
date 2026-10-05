"""Retain old frames with their original provenance, never relabel as current."""
import hashlib
import json
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE='92162a8cbc713f5ce72fa6632f37364328778253'
FRESH={'overall','kitchen','kitchen-north'}
catalog=json.loads((ROOT/'models/design-schemes.json').read_text(encoding='utf-8'))
for scheme in catalog['schemes']:
    if scheme['id'] not in ('wood','family','laundry'):continue
    path=scheme['manifest']; manifest=json.loads((ROOT/path).read_text(encoding='utf-8'))
    render_directory=scheme.get('renderDirectory','assets/schemes/'+scheme['id'])
    previous=json.loads(subprocess.check_output(['git','show',BASE+':'+path],cwd=ROOT))
    assert manifest['kitchenFitout']['version']=='3.8.0'
    assert {name for name,record in manifest['renderedViews'].items() if 'retainedFrom' not in record}==FRESH, 'Run after exactly three current kitchen/overall views'
    for name in scheme['renderViews']:
        if name in FRESH:continue
        record=previous['renderedViews'][name]
        image=(ROOT/render_directory/(name+'.jpg')).read_bytes()
        original=subprocess.check_output(['git','show',BASE+':'+render_directory+'/'+name+'.jpg'],cwd=ROOT)
        assert image==original and hashlib.sha256(image).hexdigest()==record['imageSha256']
        manifest['renderedViews'][name]={**record,'retainedFrom':{'commit':BASE,'manifest':path,'view':name,'reason':'kitchen-only-refresh; historical reference, not a current kitchen render'}}
    note='V3.8.0厨房与全屋总览为当前模型新渲染；其他房间图片沿用V3.7.0原图及原始来源，并明确标注历史参考，不作为新厨房效果图。'
    if note not in manifest['notes']:manifest['notes'].append(note)
    manifest['layoutDetails']=[v for v in manifest.get('layoutDetails',[]) if v['id']!='kitchen-north']+[{
        'id':'kitchen-north','roomId':'kitchen','title':'北侧冰箱与洗碗机 · 窗边热水器',
        'render':render_directory+'/kitchen-north.jpg',
        'interiorCamera':{'position':[6.25,1.64,12.90],'target':[7.03,1.30,11.38],'horizontalFov':90.0}}]
    (ROOT/path).write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(scheme['id'],len(FRESH),'fresh;',len(manifest['renderedViews'])-len(FRESH),'historical reference frames')
