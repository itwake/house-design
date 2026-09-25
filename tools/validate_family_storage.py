"""Inspect exported triangles for the independent family-storage layout."""
import json
from collections import defaultdict
from pathlib import Path
from validate_design_schemes import GLB

ROOT = Path(__file__).resolve().parents[1]
read = lambda p: json.loads((ROOT / p).read_text(encoding='utf-8'))
data = read('models/schemes/family/design-data.json')
manifest = read('models/schemes/family/scene-manifest.json')
base = GLB(ROOT / 'models/schemes/suite/huiyayuan-wood.glb').world_meshes()
model = GLB(ROOT / 'models/schemes/family/huiyayuan-wood.glb').world_meshes()

def groups(meshes, key):
    result = defaultdict(list)
    for mesh in meshes.values():
        value = mesh['extras'].get(key)
        if value is not None:
            result[value].append(mesh['geometry'])
    return {k: sorted(v) for k, v in result.items()}

def bounds(parts):
    return [[min(p['bounds'][0][i] for p in parts) for i in range(3)],
            [max(p['bounds'][1][i] for p in parts) for i in range(3)]]

def near(a, b):
    return max(abs(x-y) for x, y in zip(a, b)) < .00003

for key in ['wallIndex', 'openingId', 'wallPartId', 'fitoutPartId']:
    assert groups(model, key) == groups(base, key), 'Inherited real geometry changed: ' + key
old_storage = read('models/schemes/suite/design-data.json')['storageFitouts']
old_parts = {p['id'] for f in old_storage if f['type'] == 'sideboard' for p in f['parts']}
before, after = groups(base, 'furnitureId'), groups(model, 'furnitureId')
for key, geometry in before.items():
    if '餐桌' not in key and '餐椅' not in key and not key.startswith('dining_sideboard') and key not in old_parts:
        assert after.get(key) == geometry, 'Unrelated real furniture changed: ' + key
shifted = 0
for name, mesh in base.items():
    key = mesh['extras'].get('furnitureId', '')
    if '餐桌' in key or '餐椅' in key or name in ('Organic linen pendant', 'Organic linen pendant.001'):
        assert name in model, 'Moved dining mesh missing: ' + name
        for end in (0, 1):
            expected = [mesh['bounds'][end][0]-.25, mesh['bounds'][end][1], mesh['bounds'][end][2]-.95]
            assert near(model[name]['bounds'][end], expected), 'Dining item did not follow table shift: ' + name
        shifted += 1
assert shifted > 30, 'Must check detailed dining furniture and both pendant shades'
assert not old_parts.intersection(groups(model, 'storagePartId')), 'Old 7-shaped cabinet still exported'
assert manifest['garage'] == data['garage']
assert manifest['layout'] == data['layout'], 'Parent provenance must not be rewritten as an asset URL'
g = data['garage']
for p in g['parts']:
    actual = [m for m in model.values() if m['extras'].get('garagePartId') == p['id']]
    assert len(actual) == 1, ('Expected one real garage part', p['id'], len(actual))
    lo, hi = bounds(actual)
    expected_lo = [p['x']/100, p['zCm']/100, p['y']/100]
    expected_hi = [(p['x']+p['w'])/100, (p['zCm']+p['hCm'])/100, (p['y']+p['d'])/100]
    assert near(lo, expected_lo) and near(hi, expected_hi), ('Wrong part dimensions', p['id'], lo, hi)
for item in g['items']:
    actual = [m for m in model.values() if m['extras'].get('garageItemId') == item['id']]
    assert len(actual) > 10, 'Vehicle must contain real detail meshes'
    lo, hi = bounds(actual)
    expected_lo = [item['x']/100, 0, item['y']/100]
    expected_hi = [(item['x']+item['w'])/100, item['hCm']/100, (item['y']+item['d'])/100]
    assert all(lo[i] >= expected_lo[i]-.00003 and hi[i] <= expected_hi[i]+.00003 for i in range(3)), ('Vehicle escapes stated envelope', item['id'], lo, hi)
assert len(groups(model, 'garageItemId')) == 2
assert len(groups(model, 'garagePartId')) == len(g['parts'])
print(f'PASS family actual GLB: {len(model)} meshes; {len(g["parts"])} exact cabinet parts, two dimension-bounded detailed vehicles, {shifted} shifted dining meshes; inherited walls/openings/bays/bookwall and unrelated furniture preserved.')
