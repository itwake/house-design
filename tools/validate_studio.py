"""Check the shared V3 geometry and deliverable files, without third-party dependencies."""
import argparse
import hashlib
import json
import math
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def contains(point, polygon):
    x, y = point
    inside = False
    for a, b in zip(polygon, polygon[1:] + polygon[:1]):
        if (a[1] > y) != (b[1] > y):
            cross_x = (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]
            if x < cross_x:
                inside = not inside
    return inside


def polygon_area(points):
    return abs(sum(a[0] * b[1] - b[0] * a[1]
                   for a, b in zip(points, points[1:] + points[:1]))) / 2


def run(require_assets=False):
    data = json.loads((ROOT / 'models/design-data.json').read_text(encoding='utf-8'))
    rooms = data['rooms']
    errors, checks = [], []
    room_ids = {r['id'] for r in rooms}
    assert {'room_a', 'room_b', 'room_c', 'bath_1', 'bath_2', 'living', 'kitchen', 'balcony'} <= room_ids
    for r in rooms:
        points = r['points']
        area = polygon_area(points) / 10000
        if area <= 0:
            errors.append(f"Invalid area: {r['id']}")
        checks.append(f"{r['id']}: {area:.3f} m2")
    # Grid sampling catches accidental overlaps in the concave B/C vestibule.
    for x in range(15, 841, 10):
        for y in range(15, 1401, 10):
            hits = [r['id'] for r in rooms if contains((x, y), r['points'])]
            if len(hits) > 1:
                errors.append(f'Room overlap at {x},{y}: {hits}')
                break
    # Sample each door on both sides of the wall: a passable interior door must
    # join two room floor polygons over essentially all its clear width.
    for door in data['doors']:
        if door['kind'] == 'entry-door':
            continue
        dx, dy = door['x2'] - door['x1'], door['y2'] - door['y1']
        length = math.hypot(dx, dy)
        normal = (-dy / length * 7, dx / length * 7)
        valid = 0
        pairs = set()
        for t in (0.10, 0.25, 0.5, 0.75, 0.90):
            p = (door['x1'] + t * dx, door['y1'] + t * dy)
            sides = []
            for sign in (-1, 1):
                q = (p[0] + normal[0] * sign, p[1] + normal[1] * sign)
                sides.append(tuple(r['id'] for r in rooms if contains(q, r['points'])))
            if all(len(s) == 1 for s in sides) and sides[0] != sides[1]:
                valid += 1
                pairs.add(tuple(sorted((sides[0][0], sides[1][0]))))
        checks.append(f"{door['id']}: {valid}/5 connected samples {sorted(pairs)}")
        if valid < 4:
            errors.append(f"Door {door['id']} does not connect two rooms across its width ({valid}/5)")
    # All furniture footprints must lie on room floors, including concave corners.
    for f in data['furniture']:
        found = []
        for r in rooms:
            points = [(f['x'] + f['w'] * u, f['y'] + f['d'] * v)
                      for u in (0.02, 0.5, 0.98) for v in (0.02, 0.5, 0.98)]
            if all(contains(p, r['points']) for p in points):
                found.append(r['id'])
        if not found:
            errors.append(f"Furniture crosses a room boundary: {f['name']}")
    if require_assets:
        glb_path = ROOT / 'models/huiyayuan-wood.glb'
        raw = glb_path.read_bytes()
        magic, version, total = struct.unpack_from('<III', raw)
        assert magic == 0x46546C67 and version == 2 and total == len(raw), 'Invalid GLB header'
        size, kind = struct.unpack_from('<II', raw, 12)
        assert kind == 0x4E4F534A
        glb = json.loads(raw[20:20 + size])
        mesh_count = len(glb.get('meshes', []))
        textures = len(glb.get('textures', []))
        checks.append(f'GLB: {len(raw) / 1e6:.2f} MB, {mesh_count} meshes, {textures} textures')
        if textures < 2 or mesh_count < 50:
            errors.append('GLB lacks expected modeled furniture or surface textures')
        extras = [n.get('extras', {}) for n in glb.get('nodes', [])]
        for expected_kind in ('wall', 'door', 'window'):
            if not any(e.get('kind') == expected_kind for e in extras):
                errors.append(f'GLB misses tagged {expected_kind} objects')
        assert (ROOT / 'models/huiyayuan-wood.blend').stat().st_size > 100000
        manifest = json.loads((ROOT / 'models/scene-manifest.json').read_text(encoding='utf-8'))
        assert len(manifest['rooms']) >= 8
        source_hash = hashlib.sha256((ROOT / 'models/design-data.json').read_bytes().replace(b'\r\n', b'\n')).hexdigest()
        if manifest.get('sourceSha256') != source_hash:
            errors.append('Manifest does not match the current shared geometry source')
        manifest_rooms = {r['id']: r for r in manifest['rooms']}
        for r in rooms:
            m = manifest_rooms.get(r['id'])
            if not m or abs(m['area'] - polygon_area(r['points']) / 10000) > .015:
                errors.append(f"Manifest area differs from the plan: {r['id']}")
        overrides = json.loads((ROOT / 'models/blender-overrides.json').read_text(encoding='utf-8'))
        common_openings = {o['id']: o for o in data['doors'] + data['windows']}
        for o in overrides['openings']:
            same = common_openings.get(o['id'], {})
            if any(same.get(k) != o.get(k) for k in ('x1', 'y1', 'x2', 'y2')):
                errors.append(f"Blender opening differs from the plan: {o['id']}")
        for view in ('overall', 'living', 'dining', 'master', 'bedroom-b', 'study', 'kitchen', 'master-bath', 'guest-bath', 'balcony'):
            p = ROOT / 'assets/blender-renders' / f'{view}.jpg'
            if not p.exists() or p.stat().st_size < 10000:
                errors.append(f'Missing/empty scene render: {view}')
    print('\n'.join(checks))
    if errors:
        print('\nFAILURES:\n' + '\n'.join(errors))
        raise SystemExit(1)
    print('PASS: V3 geometry' + (' and Blender deliverables' if require_assets else ''))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--assets', action='store_true')
    run(parser.parse_args().assets)
