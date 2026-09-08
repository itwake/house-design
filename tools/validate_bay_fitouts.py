"""Conditional bay furniture regression, without Blender or third-party packages.

Plan units are cm. glTF world axes are (plan x, height, plan y), in metres.
Declared support envelopes are NOT solid obstacles: knee-space checks use the
actual mesh triangles, including a closed-solid containment check.
"""
import itertools
import math
import struct


FITOUT_LINKS = {
    'bay_a_office_vanity': ('window_a', 'room_a', 'bay-master'),
    'bay_b_tea': ('window_b', 'room_b', 'bay-tea'),
    'bay_living_family': ('window_living_west', 'living', 'bay-living'),
}
PART_SPECS = {
    'a_desktop': ('desktop', [383, 12, 80, 60, 72, 3], 'south'),
    'a_support': ('desk_support', [383, 12, 80, 60, 0, 72], 'south'),
    'a_accessories': ('desk_accessories', [386, 17, 74, 48, 75, 43], 'south'),
    'a_chair': ('chair', [395, 77, 50, 48, 0, 80], 'north'),
    'a_ledge': ('raised_ledge', [432, -53, 146, 62, 90.1, 1.8], None),
    'a_ledge_objects': ('ledge_objects', [440, -43, 125, 42, 91.9, 20], None),
    'b_cushion': ('seat_cushion', [95, -50, 85, 55, 43.2, 4.8], None),
    'b_tea_tray': ('tea_tray', [185, -45, 28, 32, 43.2, 16.3], None),
    'b_back_cushion': ('back_cushion', [97, -49, 43, 12, 48, 26], None),
    'l_desktop': ('desktop', [214, 647, 65, 200, 72, 3], 'east'),
    'l_support': ('desk_support', [214, 647, 65, 200, 0, 72], 'east'),
    'l_accessories': ('desk_accessories', [217, 653, 56, 187, 75, 45], 'east'),
    'l_adult_chair': ('chair', [285, 677, 52, 52, 0, 80], 'west'),
    'l_child_chair': ('chair', [285, 775, 52, 52, 0, 80], 'west'),
    'l_ledge': ('raised_ledge', [147, 649, 62, 196, 90.1, 1.8], None),
}
# Each working position has 60 cm foot depth; support members may occur above
# 69 cm, beside the clear central width, but never inside these open volumes.
KNEE_VOLUMES_CM = {
    'a_support': [([393, 0, 12], [453, 69, 72])],
    'l_support': [([219, 0, 657], [279, 69, 737]),
                  ([219, 0, 757], [279, 69, 837])],
}


def part_bounds(part):
    return ([part['x'] / 100, part['zCm'] / 100, part['y'] / 100],
            [(part['x'] + part['w']) / 100, (part['zCm'] + part['hCm']) / 100,
             (part['y'] + part['d']) / 100])


def inside(point, polygon):
    x, y = point
    result = False
    for a, b in zip(polygon, polygon[1:] + polygon[:1]):
        cross = (x - a[0]) * (b[1] - a[1]) - (y - a[1]) * (b[0] - a[0])
        if abs(cross) < 1e-7 and min(a[0], b[0]) - 1e-7 <= x <= max(a[0], b[0]) + 1e-7 and min(a[1], b[1]) - 1e-7 <= y <= max(a[1], b[1]) + 1e-7:
            return True
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]:
            result = not result
    return result


def rect_on_floor(part, polygon):
    # Partition at polygon vertices so a concave notch cannot hide between
    # the rectangle's four corners or a coarse nine-point sample.
    low, high = [part['x'], part['y']], [part['x'] + part['w'], part['y'] + part['d']]
    axes = [sorted({low[i], high[i], *(p[i] for p in polygon if low[i] < p[i] < high[i])}) for i in range(2)]
    samples = [[*axis, *((a + b) / 2 for a, b in zip(axis, axis[1:]))] for axis in axes]
    return all(inside(p, polygon) for p in itertools.product(*samples))


def check_fitout_plan(data, errors, checks):
    fitouts = data.get('bayFitouts', [])
    by_id = {f['id']: f for f in fitouts}
    if len(fitouts) != 3 or set(by_id) != set(FITOUT_LINKS):
        errors.append('Bay fitouts must contain exactly the three approved linked functions')
    design = data.get('bayDesign', {})
    if design.get('measured') is not False or design.get('units') != 'cm' or not design.get('safety') or not design.get('assumptions'):
        errors.append('Bay design must preserve cm units, unmeasured status, safety and assumptions')
    style = design.get('windowStyle', {})
    if any(style.get(k) != v for k, v in {'frameWidthCm': 3, 'mullionCount': 1, 'decorativeTransom': False, 'blind': 'cordless roller'}.items()):
        errors.append('Bay window style must retain 30 mm frame, single mullion, no transom and cordless roller')
    windows = {w['id']: w for w in data['windows']}
    b_window = windows.get('window_b', {})
    if [b_window.get(k) for k in ('sillCm', 'heightCm', 'baselineSillCm', 'baselineHeightCm')] != [43, 187, 90, 140] or not b_window.get('designScenario'):
        errors.append('B tea seat must be explicitly conditional: sill 43/top 230 cm; original unmeasured 90/140 cm retained')
    for identity in ('window_a', 'window_living_west'):
        if [windows.get(identity, {}).get(k) for k in ('sillCm', 'heightCm')] != [90, 140]:
            errors.append(f'High-low desk must not silently lower the 90 cm solid ledge: {identity}')
    rooms = {r['id']: r['points'] for r in data['rooms']}
    parts = {}
    for fitout in fitouts:
        expected = FITOUT_LINKS.get(fitout['id'])
        if not expected or (fitout.get('openingId'), fitout.get('roomId')) != expected[:2]:
            errors.append(f'Bay fitout opening / room linkage differs: {fitout["id"]}')
            continue
        if any(not fitout.get(k) for k in ('conditions', 'dimensions', 'references', 'summary')):
            errors.append(f'Bay fitout lost conditions, dimensions or references: {fitout["id"]}')
        window = windows[fitout['openingId']]
        for part in fitout.get('parts', []):
            identity = part['id']
            if identity in parts:
                errors.append(f'Duplicate bay part id: {identity}')
            parts[identity] = part
            values = [part.get(k) for k in ('x', 'y', 'w', 'd', 'zCm', 'hCm')]
            if any(not isinstance(v, (int, float)) or not math.isfinite(v) for v in values) or any(part.get(k, 0) <= 0 for k in ('w', 'd', 'hCm')):
                errors.append(f'Bay part has invalid physical dimensions: {identity}')
                continue
            expected_part = PART_SPECS.get(identity)
            if expected_part is None or (part.get('role'), values, part.get('face')) != expected_part:
                errors.append(f'Bay part differs from approved position, height, role or orientation: {identity}')
            indoor = rect_on_floor(part, rooms[fitout['roomId']])
            if window['bay']['outward'] == [0, -1]:
                bay_rect = (window['x1'], -55, window['x2'], 12)
            else:
                bay_rect = (145, window['y1'], 212, window['y2'])
            in_bay = (part['x'] >= bay_rect[0] and part['y'] >= bay_rect[1] and
                      part['x'] + part['w'] <= bay_rect[2] and part['y'] + part['d'] <= bay_rect[3] and
                      part['zCm'] >= window['sillCm'] and part['zCm'] + part['hCm'] <= window['sillCm'] + window['heightCm'])
            if not (indoor or in_bay) or not (0 <= part['zCm'] < part['zCm'] + part['hCm'] <= 270):
                errors.append(f'Bay part leaves its legal floor / high ledge opening volume: {identity}')
    if set(parts) != set(PART_SPECS):
        errors.append('Bay fitout parts differ from the approved 15 explicitly bounded components')
    wardrobe = next((f for f in data['furniture'] if f['name'] == '主卧衣柜'), {})
    if [wardrobe.get(k) for k in ('x', 'y', 'w', 'd', 'face', 'doorStyle')] != [325, 80, 60, 160, 'east', 'sliding']:
        errors.append('Master wardrobe must give up its north 60 cm and remain a 160 cm sliding-front unit')
    aisle = next((c for c in data.get('clearances', []) if c['id'] == 'living_desk_aisle'), {})
    if [aisle.get(k) for k in ('x', 'y', 'w', 'd', 'grade')] != [344, 647, 80, 200, 'C'] or any(c['id'] == 'living_window_clear' for c in data.get('clearances', [])):
        errors.append('Living desk must replace the old window clearance with the conditional 80 cm chair-back aisle')
    # New floor furniture cannot overlap a bed / cabinet footprint. Components
    # supported above a sill are deliberately excluded: the sill is not floor.
    for identity, part in parts.items():
        if part['role'] not in ('desktop', 'desk_support', 'chair'):
            continue
        for f in data['furniture']:
            if min(part['x'] + part['w'], f['x'] + f['w']) > max(part['x'], f['x']) + .01 and min(part['y'] + part['d'], f['y'] + f['d']) > max(part['y'], f['y']) + .01:
                errors.append(f'New floor fitout collides with existing furniture: {identity} / {f["name"]}')
    checks.append('Bay source: 15 legal 3D part envelopes; A 80x60 desk / 2 cm bed gap, B conditional 48 cm cushion, living 200x65 desk / 80 cm conditional aisle')
    return parts


def _cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def _dot(a, b):
    return sum(x*y for x, y in zip(a, b))


def triangle_hits_box(triangle, low, high):
    """Separating-axis test: a hollow U-frame's AABB is not a solid block."""
    center = [(a+b)/2 for a, b in zip(low, high)]
    half = [(b-a)/2 for a, b in zip(low, high)]
    v = [[p[i]-center[i] for i in range(3)] for p in triangle]
    edges = [[b[i]-a[i] for i in range(3)] for a, b in zip(v, v[1:]+v[:1])]
    basis = [(1, 0, 0), (0, 1, 0), (0, 0, 1)]
    axes = basis + [_cross(edges[0], edges[1])] + [_cross(e, a) for e in edges for a in basis]
    for axis in axes:
        if _dot(axis, axis) < 1e-20:
            continue
        values = [_dot(p, axis) for p in v]
        radius = sum(half[i]*abs(axis[i]) for i in range(3))
        if min(values) > radius + 1e-10 or max(values) < -radius - 1e-10:
            return False
    return True


def point_in_mesh(point, triangles):
    """Ray parity detects a solid enclosing a knee volume without crossing it."""
    direction, distances = (1, .3713907, .5294113), []
    for a, b, c in triangles:
        e1, e2 = [b[i]-a[i] for i in range(3)], [c[i]-a[i] for i in range(3)]
        h = _cross(direction, e2)
        determinant = _dot(e1, h)
        if abs(determinant) < 1e-10:
            continue
        delta = [point[i]-a[i] for i in range(3)]
        u = _dot(delta, h)/determinant
        q = _cross(delta, e1)
        v = _dot(direction, q)/determinant
        distance = _dot(e2, q)/determinant
        if u >= -1e-9 and v >= -1e-9 and u+v <= 1+1e-9 and distance > 1e-8:
            if not any(abs(distance-other) < 1e-7 for other in distances):
                distances.append(distance)
    return len(distances) % 2 == 1


def support_triangles(glb, raw, node_matrix, multiply_matrices):
    binary = None
    offset = 12
    while offset + 8 <= len(raw):
        size, kind = struct.unpack_from('<II', raw, offset)
        if kind == 0x004e4942:
            binary = raw[offset+8:offset+8+size]
        offset += 8+size
    if binary is None:
        raise ValueError('GLB has no BIN chunk for actual support geometry')

    def accessor(index):
        spec = glb['accessors'][index]
        view = glb['bufferViews'][spec['bufferView']]
        component = {5121: 'B', 5123: 'H', 5125: 'I', 5126: 'f'}[spec['componentType']]
        count = {'SCALAR': 1, 'VEC3': 3}[spec['type']]
        fmt = '<' + component*count
        stride = view.get('byteStride', struct.calcsize(fmt))
        start = view.get('byteOffset', 0) + spec.get('byteOffset', 0)
        return [struct.unpack_from(fmt, binary, start+i*stride) for i in range(spec['count'])]

    def walk(index, parent, inherited):
        node = glb['nodes'][index]
        matrix = multiply_matrices(parent, node_matrix(node))
        metadata = {**inherited, **node.get('extras', {})}
        if metadata.get('fitoutPartId') in KNEE_VOLUMES_CM and 'mesh' in node:
            triangles = []
            for primitive in glb['meshes'][node['mesh']]['primitives']:
                if primitive.get('mode', 4) != 4:
                    raise ValueError('Support geometry must be triangles')
                vertices = [[sum(matrix[r][c]*p[c] for c in range(3))+matrix[r][3] for r in range(3)]
                            for p in accessor(primitive['attributes']['POSITION'])]
                indices = [p[0] for p in accessor(primitive['indices'])] if 'indices' in primitive else list(range(len(vertices)))
                triangles.extend([[vertices[j] for j in indices[i:i+3]] for i in range(0, len(indices), 3)])
            yield node.get('name', str(index)), metadata['fitoutPartId'], triangles
        for child in node.get('children', []):
            yield from walk(child, matrix, metadata)

    identity = [[int(r == c) for c in range(4)] for r in range(4)]
    for root in glb['scenes'][glb.get('scene', 0)]['nodes']:
        yield from walk(root, identity, {})


def check_fitout_assets(data, glb, raw, manifest, root, world_mesh_bounds, node_matrix, multiply_matrices, errors, checks):
    fitouts = {f['id']: f for f in data.get('bayFitouts', [])}
    parts = {p['id']: (f, p) for f in fitouts.values() for p in f['parts']}
    meshes, linked = list(world_mesh_bounds(glb)), {}
    # A conditional low seat is only visually truthful when its physical
    # window sill changes with the scenario; a source-only height label is
    # insufficient. A/living must still model their retained high sill.
    for window in data['windows']:
        if window.get('windowType') != 'bay':
            continue
        frames = [m for m in meshes if m[1].get('openingId') == window['id'] and m[1].get('bayRole') == 'frontFrame']
        if len(frames) != 5:
            errors.append(f'GLB bay must have four slim perimeter members and one mullion: {window["id"]}')
            continue
        span_axis = 0 if window['bay']['outward'] == [0, -1] else 2
        sill, top = window['sillCm']/100, (window['sillCm']+window['heightCm'])/100
        if abs(min(m[2][1] for m in frames)-sill) > .002 or abs(max(m[3][1] for m in frames)-top) > .002:
            errors.append(f'GLB physical bay sill/top does not match the high/low conditional scenario: {window["id"]}')
        for name, _, low, high in frames:
            vertical = high[1]-low[1] > 1
            width = high[span_axis]-low[span_axis] if vertical else high[1]-low[1]
            if abs(width-.03) > .002:
                errors.append(f'GLB bay member is not the specified actual 30 mm slim frame: {name}')
    for name, meta, low, high in meshes:
        if not (meta.get('fitoutId') or meta.get('fitoutPartId')):
            continue
        identity = meta.get('fitoutPartId')
        if identity not in parts or meta.get('fitoutId') != parts[identity][0]['id']:
            errors.append(f'GLB has unknown / mismatched fitoutId + fitoutPartId: {name}')
            continue
        fitout, part = parts[identity]
        linked.setdefault(identity, []).append((name, meta, low, high))
        if meta.get('openingId') != fitout['openingId']:
            errors.append(f'GLB fitout lost source window linkage: {name}')
        lo, hi = part_bounds(part)
        if any(not math.isfinite(v) for v in low+high) or any(low[i] < lo[i]-.002 or high[i] > hi[i]+.002 for i in range(3)):
            errors.append(f'GLB fitout mesh exceeds declared 3D part bounds: {name}: {low}..{high}, expected {lo}..{hi}')
    for identity, (_, part) in parts.items():
        actual = linked.get(identity, [])
        if not actual:
            errors.append(f'GLB missing actual tagged fitout part (stale model is not accepted): {identity}')
            continue
        if part['role'] in ('desktop', 'raised_ledge', 'seat_cushion'):
            lo, hi = part_bounds(part)
            union_lo = [min(m[2][i] for m in actual) for i in range(3)]
            union_hi = [max(m[3][i] for m in actual) for i in range(3)]
            if any(abs(a-b) > .002 for a, b in zip(union_lo+union_hi, lo+hi)):
                errors.append(f'GLB tabletop / ledge / cushion fails exact real dimensions: {identity}')
        if part['role'] == 'chair':
            backs = [m for m in actual if 'backrest' in m[0].lower()]
            axis = 2 if part['face'] == 'north' else 0
            edge = ((part['y']+part['d']) if axis == 2 else (part['x']+part['w']))/100
            if len(backs) != 1 or not (edge-.07 <= backs[0][2][axis] <= backs[0][3][axis] <= edge+.002) or backs[0][3][axis]-backs[0][2][axis] > .07:
                errors.append(f'GLB actual chair back faces away from specified {part["face"]}: {identity}')
    try:
        supports = list(support_triangles(glb, raw, node_matrix, multiply_matrices))
        for name, identity, triangles in supports:
            for low_cm, high_cm in KNEE_VOLUMES_CM[identity]:
                low = [v/100+.001 for v in low_cm]
                high = [v/100-.001 for v in high_cm]
                center = [(a+b)/2 for a, b in zip(low, high)]
                if any(triangle_hits_box(t, low, high) for t in triangles) or point_in_mesh(center, triangles):
                    errors.append(f'GLB actual support enters required knee / foot space: {name}, {low_cm}..{high_cm} cm')
        if any(not any(identity == expected for _, identity, _ in supports) for expected in KNEE_VOLUMES_CM):
            errors.append('GLB lacks actual support triangles for one of the two desks')
    except (KeyError, ValueError, struct.error) as error:
        errors.append(f'Cannot verify real desk knee space: {error}')
    # Compare real component mesh boxes in all THREE axes, never aggregate a
    # support assembly into a solid or confuse objects at different elevations.
    existing = [m for m in meshes if m[1].get('kind') == 'furniture' and not m[1].get('fitoutId')]
    for actual in linked.values():
        for name, _, low, high in actual:
            for other_name, _, other_low, other_high in existing:
                if all(min(high[i], other_high[i])-max(low[i], other_low[i]) > .003 for i in range(3)):
                    errors.append(f'GLB fitout component intersects existing furniture: {name} / {other_name}')
                    break
    details = manifest.get('bayDetails', [])
    if len(details) != 3 or {d.get('fitoutId') for d in details} != set(FITOUT_LINKS):
        errors.append('Manifest must contain three source-linked bay detail views')
    for detail in details:
        identity = detail.get('fitoutId')
        if identity not in FITOUT_LINKS:
            continue
        opening, room, view = FITOUT_LINKS[identity]
        expected_render = f'assets/blender-renders/{view}.jpg'
        if (detail.get('id'), detail.get('openingId'), detail.get('roomId'), detail.get('render')) != (view, opening, room, expected_render):
            errors.append(f'Bay detail manifest coordinates / file linkage differs: {identity}')
        if detail.get('conditions') != fitouts[identity]['conditions'] or detail.get('dimensions') != fitouts[identity]['dimensions'] or not detail.get('interiorCamera'):
            errors.append(f'Bay detail view dropped source conditions / dimensions / camera: {identity}')
        path = root / expected_render
        if not path.exists() or path.stat().st_size < 10000:
            errors.append(f'Missing / empty source-model bay detail render: {view}')
    checks.append(f'Bay GLB: {len(linked)}/15 tagged parts; exact table / cushion sizes, real triangle knee voids and north/west chair backs checked')
