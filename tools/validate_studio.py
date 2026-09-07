"""Check the shared V3 geometry and deliverable files, without third-party dependencies."""
import argparse
import hashlib
import itertools
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


def intervals_cover(intervals, start, end, tolerance=1e-6):
    """Check continuous coverage, not just the union's bounding box."""
    cursor = start
    for low, high in sorted((min(a, b), max(a, b)) for a, b in intervals):
        if high < cursor:
            continue
        if low > cursor + tolerance:
            return False
        cursor = max(cursor, high)
        if cursor >= end - tolerance:
            return True
    return cursor >= end - tolerance


def check_study_south_wall(data, errors, checks):
    """C's south boundary must be solid; its entrance stays in the east wall."""
    walls, specs = data['walls'], data.get('wallSpecs', [])
    if len(walls) != len(specs) or any(w != s.get('coords') for w, s in zip(walls, specs)):
        errors.append('wallSpecs and walls differ in length or indexed coordinates')
    ids = [s.get('id') for s in specs]
    if len(set(ids)) != len(ids):
        errors.append('wallSpecs has duplicate wall ids')
    expected = [206, 626, 319, 626]
    wall_index = next((i for i, s in enumerate(specs) if s.get('id') == 'w_bed_c_south'), None)
    if wall_index is None or wall_index != len(specs) - 1 or specs[wall_index].get('coords') != expected:
        errors.append('Study south infill must be the last wallSpec at [206,626,319,626] cm')
    spans = [(w[0], w[2]) for w in walls if abs(w[1] - 626) < 1e-6 and abs(w[3] - 626) < 1e-6]
    if not intervals_cover(spans, 6, 319):
        errors.append('Study south boundary is not continuously walled at y=626, x=6..319 cm')
    else:
        checks.append('Study south boundary: continuous solid wall over x=6..319, y=626 cm')
    for opening in data.get('doors', []) + data.get('windows', []):
        x1, y1, x2, y2 = (opening[k] for k in ('x1', 'y1', 'x2', 'y2'))
        if abs(y2 - y1) < 1e-6:
            crosses = abs(y1 - 626) < 1e-6 and min(max(x1, x2), 319) > max(min(x1, x2), 6) + 1e-6
        else:
            t = (626 - y1) / (y2 - y1)
            crosses = 0 <= t <= 1 and 6 < x1 + t * (x2 - x1) < 319
        if crosses:
            errors.append(f"Opening crosses the required solid study south wall: {opening['id']}")
    east_door = next((d for d in data['doors'] if d['id'] == 'door_c'), {})
    if [east_door.get(k) for k in ('x1', 'y1', 'x2', 'y2')] != [319, 457.5, 319, 542.5]:
        errors.append('Study entrance moved from the east wall or changed its 850 mm opening')
    return wall_index


def multiply_matrices(a, b):
    return [[sum(a[r][k] * b[k][c] for k in range(4)) for c in range(4)] for r in range(4)]


def node_matrix(node):
    """Convert glTF's column-major matrix or local TRS into a row-major matrix."""
    if 'matrix' in node:
        return [[node['matrix'][c * 4 + r] for c in range(4)] for r in range(4)]
    x, y, z, w = node.get('rotation', [0, 0, 0, 1])
    scale, translation = node.get('scale', [1, 1, 1]), node.get('translation', [0, 0, 0])
    rotation = [
        [1 - 2 * (y*y + z*z), 2 * (x*y - z*w), 2 * (x*z + y*w)],
        [2 * (x*y + z*w), 1 - 2 * (x*x + z*z), 2 * (y*z - x*w)],
        [2 * (x*z - y*w), 2 * (y*z + x*w), 1 - 2 * (x*x + y*y)],
    ]
    return [[rotation[r][c] * scale[c] for c in range(3)] + [translation[r]] for r in range(3)] + [[0, 0, 0, 1]]


def world_mesh_bounds(glb):
    """Yield actual POSITION-accessor bounds transformed through the node tree."""
    identity = [[int(r == c) for c in range(4)] for r in range(4)]

    def walk(index, parent, inherited):
        node = glb['nodes'][index]
        matrix = multiply_matrices(parent, node_matrix(node))
        metadata = {**inherited, **node.get('extras', {})}
        if 'mesh' in node:
            points = []
            for primitive in glb['meshes'][node['mesh']]['primitives']:
                accessor = glb['accessors'][primitive['attributes']['POSITION']]
                if 'min' not in accessor or 'max' not in accessor:
                    raise ValueError(f"POSITION bounds missing for {node.get('name', index)}")
                for corner in itertools.product(*zip(accessor['min'], accessor['max'])):
                    points.append([sum(matrix[r][c] * corner[c] for c in range(3)) + matrix[r][3] for r in range(3)])
            if points:
                yield node.get('name', str(index)), metadata, [min(p[i] for p in points) for i in range(3)], [max(p[i] for p in points) for i in range(3)]
        for child in node.get('children', []):
            yield from walk(child, matrix, metadata)

    for root in glb['scenes'][glb.get('scene', 0)]['nodes']:
        yield from walk(root, identity, {})


def check_study_wall_asset(glb, wall_index, errors, checks):
    # Three/glTF coordinates are (plan x, height, plan y), in metres.
    expected_min, expected_max = [2.06, 0, 6.20], [3.19, 2.70, 6.32]
    matches = []
    for name, metadata, low, high in world_mesh_bounds(glb):
        if metadata.get('kind') != 'wall' or metadata.get('wallIndex') != wall_index:
            continue
        if high[1] - low[1] < 1:
            continue  # Do not mistake the matching skirting for a full wall.
        valid = all(math.isfinite(v) and abs(v - expected) <= .002
                    for v, expected in zip(low + high, expected_min + expected_max))
        if not valid:
            errors.append(f'GLB study wall has incorrect world bounds: {name}: {low}..{high}')
        else:
            matches.append(name)
    if not matches:
        errors.append(f'GLB lacks the actual 1.13 x 0.12 x 2.70 m study south infill wall at wallIndex {wall_index}')
    else:
        checks.append('GLB study wall: POSITION bounds + world transform verify [2.06,0,6.20]..[3.19,2.70,6.32] m')


def run(require_assets=False):
    data = json.loads((ROOT / 'models/design-data.json').read_text(encoding='utf-8'))
    rooms = data['rooms']
    errors, checks = [], []
    study_wall_index = check_study_south_wall(data, errors, checks)
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
        if length <= 0:
            errors.append(f"Door has zero-length opening: {door['id']}")
            continue
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
        if door['id'] == 'door_c' and (valid != 5 or pairs != {('living', 'room_c')}):
            errors.append('Study east door must connect C and the public corridor over all five samples')
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
        check_study_wall_asset(glb, study_wall_index, errors, checks)
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
