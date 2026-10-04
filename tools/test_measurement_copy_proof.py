"""Read-only tamper tests for the narrowly scoped render-source alias."""
import copy
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('scheme_validator', ROOT / 'tools/validate_design_schemes.py')
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)
checks = 0


def accepted(data, manifest, source_hash, blend_hash, glb_hash):
    global checks
    result = validator.metadata_only_source_alias(data, manifest, source_hash, blend_hash, glb_hash)
    checks += 1
    return result


def rejected(data, manifest, source_hash, blend_hash, glb_hash):
    global checks
    try:
        validator.metadata_only_source_alias(data, manifest, source_hash, blend_hash, glb_hash)
    except ValueError:
        checks += 1
        return
    raise AssertionError('Invalid metadata-only source proof was accepted')


for sid in ('wood', 'family', 'laundry'):
    folder = ROOT / 'models/schemes' / sid
    raw = (folder / 'design-data.json').read_bytes().replace(b'\r\n', b'\n')
    source_hash = validator.sha(raw)
    data = validator.load_json(folder / 'design-data.json')
    manifest = validator.load_json(folder / 'scene-manifest.json')
    blend_hash = validator.sha((folder / 'huiyayuan-wood.blend').read_bytes())
    glb_hash = validator.sha((folder / 'huiyayuan-wood.glb').read_bytes())
    expected = manifest['metadataOnlySourceRefresh']['oldSourceSha256']
    assert accepted(data, manifest, source_hash, blend_hash, glb_hash) == expected
    if sid != 'wood':
        continue
    for field, value in [('oldSourceSha256', '0' * 64), ('currentSourceSha256', '0' * 64),
                         ('nativeBlendSha256', '0' * 64), ('nativeGlbSha256', '0' * 64),
                         ('previousRenderRecordsPreserved', 15),
                         ('meshStateBeforeAndAfter', {'sha256': 'bad', 'meshObjects': 3, 'meshDatablocks': 3})]:
        wrong = copy.deepcopy(manifest)
        wrong['metadataOnlySourceRefresh'][field] = value
        rejected(data, wrong, source_hash, blend_hash, glb_hash)
    for field, value in [('field', 'sillCm'), ('window', 'window_a'),
                         ('afterPresent', False), ('beforePresent', 'true'),
                         ('before', 'forged old text'), ('after', 'not the actual current text')]:
        wrong = copy.deepcopy(manifest)
        wrong['metadataOnlySourceRefresh']['changes'][0][field] = value
        rejected(data, wrong, source_hash, blend_hash, glb_hash)
    wrong = copy.deepcopy(manifest)
    wrong['metadataOnlySourceRefresh']['changes'][1] = copy.deepcopy(wrong['metadataOnlySourceRefresh']['changes'][0])
    rejected(data, wrong, source_hash, blend_hash, glb_hash)
    changed_geometry = copy.deepcopy(data)
    changed_geometry['windows'][0]['sillCm'] += 1
    rejected(changed_geometry, manifest, source_hash, blend_hash, glb_hash)
    record = {'sourceSha256': expected, 'baseBlendSha256': blend_hash}
    frame_manifest = {**manifest, 'baseBlendSha256': blend_hash}
    assert validator.frame_source_matches(record, frame_manifest, source_hash, blend_hash, expected)
    assert not validator.frame_source_matches(record, frame_manifest, source_hash, blend_hash, None)
    assert not validator.frame_source_matches({**record, 'sourceSha256': '0' * 64}, frame_manifest, source_hash, blend_hash, expected)
    assert not validator.frame_source_matches({**record, 'baseBlendSha256': '0' * 64}, frame_manifest, source_hash, blend_hash, expected)
    assert not validator.frame_source_matches(record, {**frame_manifest, 'sourceSha256': '0' * 64}, source_hash, blend_hash, expected)
    assert validator.WINDOW_COPY_OLD_FRAME_VIEWS == set(validator.VIEWS) - {'sideboard'}
    checks += 6

print(f'PASS: {checks} read-only metadata proof and frame-source tamper checks')
