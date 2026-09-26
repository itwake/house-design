"""Merge current frames and immutable reference frames without relabeling them.

Blender camera data use floats, including 0.0 and 1.0. Python must serialize
these records because JavaScript JSON.stringify changes those values to ints
and invalidates the camera hash recorded at render time.
"""
import hashlib
import json
from pathlib import Path
import subprocess

BASE = '647d219fdc52e0bc71810f6a8e2daa97135be0cc'
MUST_RENDER = {'overall', 'living', 'dining', 'bay-living'}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def git_blob(path):
    return subprocess.check_output(['git', 'show', BASE + ':' + path])


def restore_camera_float_types(record):
    """Recover only the encoding; never replace the original recorded hash."""
    state = record['cameraState']
    state['matrix'] = [[float(v) for v in row] for row in state['matrix']]
    for key in ('lens', 'sensorWidth', 'orthoScale'):
        state[key] = float(state[key])
    actual = sha(json.dumps(state, sort_keys=True, separators=(',', ':')).encode())
    assert actual == record['cameraHash'], 'Camera data no longer match the original render-time hash'


def main():
    catalog = json.loads(Path('models/design-schemes.json').read_text(encoding='utf-8'))
    for scheme in catalog['schemes']:
        path = Path(scheme['manifest'])
        manifest = json.loads(path.read_text(encoding='utf-8'))
        old = json.loads(git_blob(scheme['manifest']))
        assert manifest['baseBlendSha256'] == sha(Path(scheme['blend']).read_bytes()), scheme['id']
        views = scheme.get('renderViews', list(old['renderedViews']))
        retained, fresh = [], []
        for view in views:
            image_path = scheme.get('renderDirectory', 'assets/schemes/' + scheme['id']) + '/' + view + '.jpg'
            image_sha = sha(Path(image_path).read_bytes())
            record = manifest.get('renderedViews', {}).get(view)
            if (record and record['sourceSha256'] == manifest['sourceSha256']
                    and record['baseBlendSha256'] == manifest['baseBlendSha256']
                    and record['imageSha256'] == image_sha):
                assert not record.get('retainedFrom'), 'A current render cannot also be a reference frame'
                restore_camera_float_types(record)
                fresh.append(view)
                continue
            assert view not in MUST_RENDER, 'Affected view requires a current render: ' + scheme['id'] + '/' + view
            before = old['renderedViews'][view]
            assert image_sha == before['imageSha256'], 'Changed frame must be rerendered: ' + image_path
            assert sha(git_blob(image_path)) == image_sha, 'Reference JPEG must literally match the published prior scene'
            # Copy the original record, including its actual source, camera and scene hashes.
            origin = before.get('retainedFrom') or {
                    'commit': BASE, 'manifest': scheme['manifest'], 'view': view,
                    'reason': '本轮仅客厅西飘窗暂估低台及坐垫；此未改空间或不含该窗的视角沿用原图，未重新计算间接照明。'
                }
            # A prior reference keeps its real older origin; do not pretend
            # it was rerendered for the immediately preceding release.
            manifest.setdefault('renderedViews', {})[view] = {
                **before, 'retainedFrom': origin
            }
            retained.append(view)
        manifest['renderInheritance'] = {
            'reviewedAt': '3.4.2', 'baselineCommit': BASE,
            'currentViews': fresh, 'referenceViews': retained,
            'note': '客厅相关四视角已重渲；保留图有原图哈希、相机及旧模型来源，不伪造为当前模型新帧。'
        }
        path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f"PASS {scheme['id']}: {len(fresh)} current low-bay frames, {len(retained)} explicitly versioned reference frames.")


if __name__ == '__main__':
    main()
