"""Synchronize current explanatory copy, never manufacture render provenance."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def measurement_note_copy(note):
    """Narrow a legacy laundry disclaimer without changing source or provenance."""
    if note == '所有尺寸为现有模型中的条件推演，不是量房成果或施工图。':
        return '家政设备与柜体尺寸为现有模型中的条件推演，不是量房成果或施工图；已采用的局部窗尺寸与待核墙线另见复尺明细。'
    return note


for sid in ('wood', 'family', 'laundry'):
    directory = ROOT / 'models/schemes' / sid
    data_path = directory / 'design-data.json'
    data = json.loads(data_path.read_text(encoding='utf-8'))
    path = directory / 'scene-manifest.json'
    manifest = json.loads(path.read_text(encoding='utf-8'))
    actual_source_hash = hashlib.sha256(data_path.read_bytes().replace(b'\r\n', b'\n')).hexdigest()
    assert manifest['sourceSha256'] == actual_source_hash, f'{sid}: rebuild before updating explanatory copy'
    assert manifest['measurementRevision'] == data['measurementRevision'], f'{sid}: not a measurement scene'
    before_records = json.dumps(manifest.get('renderedViews', {}), sort_keys=True)
    descriptions = {n['roomId']: n['text'] for n in data['renovationNotes'] if 'roomId' in n}
    for room in manifest['rooms']:
        if room['id'] in data['measurementRevision']['roomDescriptions']:
            room['description'] = descriptions[room['id']]
        purchased_copy = data.get('purchasedFurnitureRevision', {}).get('roomDescriptions', {})
        if room['id'] in purchased_copy:
            room['description'] = purchased_copy[room['id']]
    manifest['notes'] = [measurement_note_copy(n) for n in manifest['notes'] if not ('430 mm' in n and '900 mm' in n)]
    summary = data['measurementRevision']['summary']
    if summary not in manifest['notes']:
        manifest['notes'].append(summary)
    assert json.dumps(manifest.get('renderedViews', {}), sort_keys=True) == before_records
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{sid}: explanatory copy synchronized; render records unaltered')
