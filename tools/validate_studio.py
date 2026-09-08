"""Check the shared V3 geometry and deliverable files, without third-party dependencies."""
import argparse
import hashlib
import itertools
import json
import math
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from geometry_paths import GUEST_PATH, MASTER_PATH, path_clearance, solid_footprints
from validate_bay_fitouts import check_fitout_assets, check_fitout_plan

BAY_DIRECTIONS = {'window_b': [0, -1], 'window_a': [0, -1], 'window_living_west': [-1, 0]}
EXPECTED_ROOM_AREAS = {'room_b': 10.231, 'room_a': 10.850, 'room_c': 7.5886,
                       'bath_1': 3.6309, 'bath_2': 3.2725, 'living': 33.6091,
                       'balcony': 2.1158, 'kitchen': 7.5194}
BATH_WALLS = {'w_bath_middle': (12, [416, 469, 516, 469]),
              'w_bath_middle_step': (21, [516, 469, 516, 493]),
              'w_bath_middle_east': (22, [516, 493, 681, 493])}
BED_SPECS = {'bed_a': {'bbox': [465, 82, 210, 160], 'headDirection': 'east',
                       'frameWidthCm': 160, 'frameLengthCm': 210, 'mattressWidthCm': 150, 'mattressLengthCm': 200},
             'bed_b': {'bbox': [20, 55, 210, 145], 'headDirection': 'west',
                       'frameWidthCm': 145, 'frameLengthCm': 210, 'mattressWidthCm': 135, 'mattressLengthCm': 200}}


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
    if wall_index != 20 or specs[wall_index].get('coords') != expected:
        errors.append('Study south infill must retain wallSpec id w_bed_c_south, index 20, and [206,626,319,626] cm')
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


def check_bay_plan(data, errors, checks):
    """The three confirmed bays project out of the facade, not into floor area."""
    bays = [o for o in data['windows'] if o.get('windowType') == 'bay']
    if len(bays) != 3 or {o['id'] for o in bays} != set(BAY_DIRECTIONS):
        errors.append('Exactly the two north bedroom windows and west living window must be bays')
    thickness = data.get('wallThicknessCm', 12)
    geometry = {}
    for opening in bays:
        bay, identity = opening.get('bay', {}), opening['id']
        direction = bay.get('outward')
        if identity not in BAY_DIRECTIONS or direction != BAY_DIRECTIONS[identity]:
            errors.append(f'Bay points in the wrong direction: {identity}')
            continue
        projection = bay.get('projectionCm', 0)
        if not isinstance(projection, (int, float)) or projection <= 0:
            errors.append(f'Bay has no positive outward projection: {identity}')
            continue
        if bay.get('grade') != 'C':
            errors.append(f'Unmeasured bay projection must remain C-grade: {identity}')
        if bay.get('sideStyle') != 'solid' or any(bay.get(k, 0) <= 0 for k in ('returnThicknessCm', 'slabThicknessCm')):
            errors.append(f'Bay lacks the specified solid returns and slabs: {identity}')
        north = direction == [0, -1]
        axis, original = (2, opening['y1'] / 100) if north else (0, opening['x1'] / 100)
        other = opening['y2'] / 100 if north else opening['x2'] / 100
        if abs(original - other) > 1e-6:
            errors.append(f'Bay opening is not on an axis-aligned facade: {identity}')
        if abs(original - (.06 if north else 2.06)) > 1e-6:
            errors.append(f'Bay work moved the original wall opening plane: {identity}')
        front = original - (thickness / 2 + projection) / 100
        # Projection is measured from the outer wall face: north y=0, west x=2m.
        expected_front = -.60 if north else 1.40
        if abs(front - expected_front) > 1e-6:
            errors.append(f'Bay front is not at the agreed exterior plane: {identity}: {front} m')
        geometry[identity] = {'axis': axis, 'front': front, 'original': original}
    for room in data['rooms']:
        before = EXPECTED_ROOM_AREAS.get(room['id'])
        if before is None or abs(polygon_area(room['points']) / 10000 - before) > .0006:
            errors.append(f"Indoor room floor area differs from the approved topology: {room['id']}")
    if len(geometry) == 3:
        checks.append('Bays: 3 outward projections; north front=-0.60 m, west front=1.40 m; indoor areas unchanged')
    return geometry


def check_bath_revision(data, errors, checks):
    specs = data.get('wallSpecs', [])
    for identity, (index, coordinates) in BATH_WALLS.items():
        if index >= len(specs) or specs[index].get('id') != identity or specs[index].get('coords') != coordinates:
            errors.append(f'Bathroom stepped wall differs at stable index {index}: {identity}')
    polygons = {'bath_1': [[422, 334], [675, 334], [675, 487], [522, 487], [522, 463], [422, 463]],
                'bath_2': [[422, 475], [510, 475], [510, 499], [675, 499], [675, 620], [422, 620]]}
    for identity, points in polygons.items():
        room = next((r for r in data['rooms'] if r['id'] == identity), {})
        if room.get('points') != points:
            errors.append(f'Bathroom floor must follow its stepped shared wall: {identity}')
    door = next((d for d in data['doors'] if d['id'] == 'door_bath_1'), {})
    if [door.get(k) for k in ('x1', 'y1', 'x2', 'y2')] != [432, 328, 507, 328]:
        errors.append('Master bathroom entrance must stay on its north wall into room A')
    for opening in data['doors'] + data['windows']:
        if opening['x1'] == opening['x2'] == 416 and min(opening['y1'], opening['y2']) < 487 and max(opening['y1'], opening['y2']) > 334:
            errors.append(f"Old corridor opening remains in master bathroom west wall: {opening['id']}")
    total = sum(polygon_area(r['points']) / 10000 for r in data['rooms'])
    if abs(total - 78.8173) > .0001:
        errors.append(f'Indoor total must be 78.8173 m2 after adding the 0.0288 m2 step-wall footprint: {total}')
    checks.append(f'Bathroom step: master 3.6309 m2, guest 3.2725 m2; indoor total {total:.4f} m2 (not 104.83 m2 gross area)')


def check_bed_plan(data, errors, checks):
    beds = {}
    for identity, expected in BED_SPECS.items():
        matches = [f for f in data['furniture'] if f.get('id') == identity]
        if len(matches) != 1:
            errors.append(f'Expected one bed with stable furniture id: {identity}')
            continue
        bed = beds[identity] = matches[0]
        if [bed.get(k) for k in ('x', 'y', 'w', 'd')] != expected['bbox'] or bed.get('a') != 0:
            errors.append(f'Bed global footprint or extra 2D rotation differs: {identity}')
        for key, value in expected.items():
            if key != 'bbox' and bed.get(key) != value:
                errors.append(f'Bed physical dimension/orientation differs: {identity}.{key}')
        for other in data['furniture']:
            if other is bed:
                continue
            overlap_x = min(bed['x'] + bed['w'], other['x'] + other['w']) - max(bed['x'], other['x'])
            overlap_y = min(bed['y'] + bed['d'], other['y'] + other['d']) - max(bed['y'], other['y'])
            if overlap_x > .01 and overlap_y > .01:
                errors.append(f"Bed overlaps furniture after rotation: {identity} / {other['name']}")
        checks.append(f"{identity}: head={bed.get('headDirection')}; global bbox={expected['bbox']}; mattress remains {expected['mattressWidthCm']}x200 cm")
    return beds


def check_bath_paths(data, errors, checks):
    try:
        obstacles = solid_footprints(data, door_trim_cm=6)
        for name, path, radius in (('master', MASTER_PATH, 30), ('guest', GUEST_PATH, 25)):
            distance, obstacle, a, b = path_clearance(path, obstacles)
            if distance < radius - 1e-6:
                errors.append(f'{name} bathroom continuous {radius * 2} cm body path is blocked: {obstacle}, radius clearance {distance:.3f} at {a}..{b}')
            else:
                checks.append(f'{name} bathroom: continuous {radius * 2} cm body path; minimum radius {distance:.3f} cm, actual 6 cm door jambs each side')
        checks.append('Guest bathroom is compact: WC front-to-south-wall is only 60 cm; a 60 cm body would have zero tolerance, so only the 50 cm route is accepted.')
    except (KeyError, ValueError) as error:
        errors.append(f'Cannot verify bathroom circulation: {error}')


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
            material_names = set()
            for primitive in glb['meshes'][node['mesh']]['primitives']:
                if 'material' in primitive:
                    material_names.add(glb['materials'][primitive['material']].get('name', ''))
                accessor = glb['accessors'][primitive['attributes']['POSITION']]
                if 'min' not in accessor or 'max' not in accessor:
                    raise ValueError(f"POSITION bounds missing for {node.get('name', index)}")
                for corner in itertools.product(*zip(accessor['min'], accessor['max'])):
                    points.append([sum(matrix[r][c] * corner[c] for c in range(3)) + matrix[r][3] for r in range(3)])
            if points:
                yield node.get('name', str(index)), {**metadata, '_materialNames': sorted(material_names)}, [min(p[i] for p in points) for i in range(3)], [max(p[i] for p in points) for i in range(3)]
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


def check_revision_assets(glb, beds, errors, checks):
    meshes = list(world_mesh_bounds(glb))
    for identity, (index, coordinates) in BATH_WALLS.items():
        x1, y1, x2, y2 = [value / 100 for value in coordinates]
        horizontal = y1 == y2
        low = [min(x1, x2) - (0 if horizontal else .06), 0, min(y1, y2) - (.06 if horizontal else 0)]
        high = [max(x1, x2) + (0 if horizontal else .06), 2.7, max(y1, y2) + (.06 if horizontal else 0)]
        walls = [m for m in meshes if m[1].get('kind') == 'wall' and m[1].get('wallIndex') == index and m[3][1] - m[2][1] > 1]
        if not any(all(abs(actual - expected) < .002 for actual, expected in zip(m[2] + m[3], low + high)) for m in walls):
            errors.append(f'GLB stepped bathroom wall has no matching actual world geometry: {identity}, {low}..{high}')
    closed_west = any(metadata.get('kind') == 'wall' and metadata.get('wallIndex') == 11 and
                      low[0] <= 4.10 + .002 and high[0] >= 4.22 - .002 and
                      low[1] <= .002 and high[1] >= 2.1 and low[2] <= 3.725 and high[2] >= 4.475
                      for _, metadata, low, high in meshes)
    if not closed_west:
        errors.append('GLB still lacks solid wall across the former west master-bath doorway')
    jambs = [m for m in meshes if m[1].get('openingId') == 'door_bath_1' and 'jamb' in m[0].lower()]
    for center_x in (4.35, 5.04):
        if not any(abs((m[2][0] + m[3][0]) / 2 - center_x) < .003 and
                   abs((m[2][2] + m[3][2]) / 2 - 3.28) < .003 and m[3][1] - m[2][1] > 1.9 for m in jambs):
            errors.append(f'GLB north master-bath door jamb missing or misplaced at x={center_x}, plan-y=3.28 m')
    for x in (4.42, 4.52, 4.695, 4.88, 4.97):
        for height in (.15, 1, 2):
            if any(metadata.get('kind') == 'wall' and
                   low[0] < x < high[0] and low[1] < height < high[1] and low[2] < 3.28 < high[2]
                   for _, metadata, low, high in meshes):
                errors.append(f'GLB wall still seals the new master-bath door at x={x}, height={height} m')
    for identity, bed in beds.items():
        parts = [m for m in meshes if m[1].get('furnitureId') == identity]
        if not parts:
            errors.append(f'GLB bed has no furnitureId-linked geometry: {identity}')
            continue
        for name, metadata, low, high in parts:
            if metadata.get('bedHeadDirection') != bed['headDirection']:
                errors.append(f'GLB bed orientation metadata differs: {name}')
            if any(metadata.get(key) != bed[key] for key in ('frameWidthCm', 'frameLengthCm', 'mattressWidthCm', 'mattressLengthCm')):
                errors.append(f'GLB physical bed dimensions differ: {name}')
            if low[0] < bed['x'] / 100 - .003 or high[0] > (bed['x'] + bed['w']) / 100 + .003 or low[2] < bed['y'] / 100 - .003 or high[2] > (bed['y'] + bed['d']) / 100 + .003:
                errors.append(f'GLB bed rig escapes its shared footprint: {name}')
        plinths = [m for m in parts if 'solid oak plinth' in m[0].lower()]
        expected = [bed['x'] / 100, bed['y'] / 100, (bed['x'] + bed['w']) / 100, (bed['y'] + bed['d']) / 100]
        if not any(all(abs(a - b) < .002 for a, b in zip([m[2][0], m[2][2], m[3][0], m[3][2]], expected)) for m in plinths):
            errors.append(f'GLB bed base does not occupy its exact shared global bbox: {identity}')
        east = bed['headDirection'] == 'east'
        head_min = (bed['x'] + bed['w'] - 7.5) / 100 if east else bed['x'] / 100
        head_max = (bed['x'] + bed['w']) / 100 if east else (bed['x'] + 7.5) / 100
        heads = [m for m in parts if 'headboard' in m[0].lower()]
        if not any(abs(m[2][0] - head_min) < .002 and abs(m[3][0] - head_max) < .002 and
                   abs(m[3][2] - m[2][2] - bed['frameWidthCm'] / 100) < .002 for m in heads):
            errors.append(f'GLB actual headboard is not on the {bed["headDirection"]} side: {identity}')
        mattresses = [m for m in parts if m[0].lower().endswith('mattress')]
        if not any(abs(m[3][0] - m[2][0] - bed['mattressLengthCm'] / 100) < .002 and
                   abs(m[3][2] - m[2][2] - bed['mattressWidthCm'] / 100) < .002 for m in mattresses):
            errors.append(f'GLB mattress was stretched/swapped instead of rotating rigidly: {identity}')
    checks.append('GLB revision: actual stepped walls, sealed old bath doorway, north doorway and rigid east/west beds checked')


def check_bay_assets(glb, geometry, manifest, errors, checks):
    """Check displaced geometry and reject leftover glazing in the old wall plane."""
    bounds = manifest.get('bounds', {})
    bound_min, bound_max = bounds.get('min', []), bounds.get('max', [])
    if len(bound_min) != 3 or len(bound_max) != 3:
        errors.append('Manifest is missing 3D bounds for the projected bays')
        return
    meshes = list(world_mesh_bounds(glb))
    for identity, expectation in geometry.items():
        axis, front, original = (expectation[k] for k in ('axis', 'front', 'original'))
        parts = [m for m in meshes if m[1].get('openingId') == identity]
        role_counts = {}
        for name, metadata, low, high in parts:
            role = metadata.get('bayRole')
            if metadata.get('windowType') == 'bay':
                role_counts[role] = role_counts.get(role, 0) + 1
                if any(low[i] < bound_min[i] - .003 or high[i] > bound_max[i] + .003 for i in range(3)):
                    errors.append(f'Manifest bounds crop projected bay geometry: {name}: {low}..{high}')
            center = (low[axis] + high[axis]) / 2
            if role in ('frontFrame', 'frontGlazing'):
                if abs(center - front) > .002:
                    errors.append(f'Bay front geometry is in the wrong world plane: {name}: {center} instead of {front} m')
            if role == 'return' and (low[axis] > front + .01 or high[axis] < original - .07):
                errors.append(f'Bay side return does not connect facade to projected front: {name}')
            glass = role == 'frontGlazing' or 'glaz' in name.lower() or any('glass' in m.lower() for m in metadata.get('_materialNames', []))
            if glass and high[1] - low[1] > .20 and high[axis] - low[axis] < .04 and abs(center - original) < .015:
                errors.append(f'Old flat glazing still closes the bay opening in the original wall plane: {name}')
        for role, minimum in (('frontFrame', 2), ('frontGlazing', 1), ('return', 2), ('bottomSlab', 1), ('topSlab', 1),
                              ('rollerCassette', 1), ('rollerFabric', 1), ('rollerHem', 1)):
            if role_counts.get(role, 0) < minimum:
                errors.append(f'GLB bay is missing actual tagged {role} mesh geometry: {identity}')
        if role_counts.get('curtain'):
            errors.append(f'GLB bay retains superseded bulky curtains instead of the cordless roller: {identity}')
        checks.append(f'{identity}: projected front={front:.2f} m; roles={role_counts}')


def run(require_assets=False):
    data = json.loads((ROOT / 'models/design-data.json').read_text(encoding='utf-8'))
    rooms = data['rooms']
    errors, checks = [], []
    study_wall_index = check_study_south_wall(data, errors, checks)
    bay_geometry = check_bay_plan(data, errors, checks)
    check_bath_revision(data, errors, checks)
    beds = check_bed_plan(data, errors, checks)
    check_bath_paths(data, errors, checks)
    check_fitout_plan(data, errors, checks)
    room_ids = {r['id'] for r in rooms}
    assert {'room_a', 'room_b', 'room_c', 'bath_1', 'bath_2', 'living', 'kitchen', 'balcony'} <= room_ids
    for r in rooms:
        points = r['points']
        area = polygon_area(points) / 10000
        if area <= 0:
            errors.append(f"Invalid area: {r['id']}")
        if r.get('modelAreaM2') is not None and abs(r['modelAreaM2'] - area) > .0006:
            errors.append(f"Shared room area label differs from its actual polygon: {r['id']}")
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
        if door['id'] == 'door_bath_1' and (valid != 5 or pairs != {('bath_1', 'room_a')}):
            errors.append('Master bathroom north door must connect only bath_1 and room_a over all five samples, not living')
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
        check_revision_assets(glb, beds, errors, checks)
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
        check_bay_assets(glb, bay_geometry, manifest, errors, checks)
        check_fitout_assets(data, glb, raw, manifest, ROOT, world_mesh_bounds, node_matrix, multiply_matrices, errors, checks)
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
            if any(same.get(k) != o.get(k) for k in ('x1', 'y1', 'x2', 'y2', 'windowType', 'bay')):
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
