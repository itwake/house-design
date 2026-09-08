"""Entry/dining storage geometry regressions; all source dimensions are cm.

Door-swing scenarios are explicitly provisional, not surveyed handedness or an
accessibility certification. Mesh checks are independent of Blender execution.
"""
import copy
import itertools
import math

from geometry_paths import path_clearance, solid_footprints
from validate_bay_fitouts import part_bounds, point_in_mesh, rect_on_floor, support_triangles, triangle_hits_box


DINING_SPECS = {
    '四人餐桌': [330, 1110, 120, 70],
    '餐椅北1': [338, 1052.5, 44, 45],
    '餐椅北2': [398, 1052.5, 44, 45],
    '餐椅南1': [338, 1192.5, 44, 45],
    '餐椅南2': [398, 1192.5, 44, 45],
}
ENTRY_TO_KITCHEN_PATH = [(440, 1350), (455, 1310), (466, 1281.25),
                         (483, 1266), (495, 1250), (495, 1215), (570, 1215)]
STORAGE_LINKS = {'entry_shoe_station': ('entry', {'entry_storage', 'entry_bench'}),
                 'dining_sideboard_wall': ('sideboard', {'dining_sideboard'})}
PART_SPECS = {
    'e_shoe_lower': ('shoe_lower', [212.5, 1130, 40, 175, 0, 100]),
    'e_key_niche': ('key_niche', [212.5, 1130, 40, 175, 100, 50]),
    'e_shoe_upper': ('upper_cabinet', [212.5, 1130, 32, 175, 150, 100]),
    'e_key_accessories': ('entry_accessories', [218, 1150, 26, 135, 100, 30]),
    'e_bench': ('shoe_bench', [212.5, 1305, 40, 80, 0, 45]),
    'e_bench_back': ('bench_back', [212.5, 1305, 7, 80, 45, 190]),
    'd_base': ('sideboard_base', [212.5, 960, 40, 140, 0, 85]),
    'd_niche': ('sideboard_niche', [212.5, 960, 40, 140, 85, 65]),
    'd_upper': ('upper_cabinet', [212.5, 960, 28, 140, 150, 100]),
    'd_accessories': ('dining_accessories', [218, 967, 29, 124, 85, 40]),
}
CLEARANCE_SPECS = {'entry_door_sweep': [390, 1295, 100, 100],
                   'shoe_bench_use': [252.5, 1305, 60, 80],
                   'sideboard_drawer_open': [252.5, 960, 25, 140],
                   'sideboard_user': [277.5, 960, 50, 140]}
WRAPPERS = {'entry_storage': ('entry_shoe_station', [212.5, 1130, 40, 175], 250),
            'entry_bench': ('entry_shoe_station', [212.5, 1305, 40, 80], 235),
            'dining_sideboard': ('dining_sideboard_wall', [212.5, 960, 40, 140], 250)}


def check_dining_layout(data, errors, checks):
    furniture = {f['name']: f for f in data['furniture']}
    for name, footprint in DINING_SPECS.items():
        actual = furniture.get(name, {})
        if [actual.get(k) for k in ('x', 'y', 'w', 'd')] != footprint or actual.get('a', 0) != 0:
            errors.append(f'Dining table/chair must retain the approved east 40 / north 40 cm move: {name}')
        if '餐椅' in name and actual.get('face') != ('south' if '北' in name else 'north'):
            errors.append(f'Dining chair seating direction changed: {name}')
    entry = next((d for d in data['doors'] if d['id'] == 'entry_door'), {})
    if [entry.get(k) for k in ('x1', 'y1', 'x2', 'y2', 'grade')] != [390, 1395, 490, 1395, 'C']:
        errors.append('Entry opening must retain its unsurveyed 100 cm location; do not infer a confirmed hinge')
    checks.append('Dining group: table330,1110 / north chairs1052.5 / south chairs1192.5 cm; door location unchanged')
    return furniture


def check_storage_clearances(data, boxes, errors, checks):
    """boxes maps shoe/sideboard/bench to their actual closed plan bounds.

    AABB here is the intentionally conservative cabinet envelope, not a claim
    that open shelves or the bench knee space contain a solid block.
    """
    shoe, sideboard, bench = (boxes[k] for k in ('shoe', 'sideboard', 'bench'))
    furniture = {f['name']: f for f in data['furniture']}
    table, north = furniture['四人餐桌'], furniture['餐椅北1']
    cabinet_to_table = table['x']-shoe[2]
    kitchen_aisle = 530-table['x']-table['w']
    drawer_and_person = sideboard[2]+25+50
    if abs(cabinet_to_table-77.5) > .01 or abs(kitchen_aisle-80) > .01:
        errors.append('Storage/table clearances must remain 77.5 cm west and 80 cm east')
    if north['x']-drawer_and_person < 10.5-.01:
        errors.append('Sideboard 25 cm drawer plus 50 cm standing zone conflicts with the north dining chair')
    knee_box = (bench[2], bench[1], bench[2]+60, bench[3])
    if knee_box[2] > 390 or knee_box[1] < 1305 or knee_box[3] > 1389:
        errors.append('Shoe-bench knee/foot zone leaves its safe west-side strip or enters the provisional door sweep')
    # Test the deliberately conservative worst provisional handedness. This
    # does not turn the unmeasured hinge and leaf width into established facts.
    scenario = copy.deepcopy(data)
    for f in scenario['furniture']:
        if f['name'].startswith('餐椅南'):
            f['y'] += 30
    obstacles = solid_footprints(scenario)
    obstacles += [(f'{name} storage envelope', box) for name, box in boxes.items()]
    for hinge, leaf in (('right', (489, 1295, 491, 1395)), ('left', (389, 1295, 391, 1395))):
        distance, obstacle, a, b = path_clearance(ENTRY_TO_KITCHEN_PATH, obstacles+[(f'provisional {hinge}-hinge open leaf', leaf)])
        if distance < 25:
            errors.append(f'Conditional 50 cm entrance/kitchen route blocked with {hinge} leaf + 30 cm chair rollback: {obstacle}, radius {distance:.3f} cm at {a}..{b}')
        checks.append(f'Provisional {hinge} inward leaf / south chairs back30: 50 cm route minimum radius {distance:.3f} cm, not an accessibility claim')
    corner_gap = math.hypot(490-442, 1295-(1192.5+45+30))
    checks.append(f'Storage clearances: west77.5/east80 cm; drawer+standing ends x{drawer_and_person:g}; door/chair diagonal {corner_gap:.3f} cm under stated assumptions')


def check_storage_plan(data, errors, checks):
    check_dining_layout(data, errors, checks)
    design = data.get('storageDesign', {})
    if design.get('units') != 'cm' or design.get('measured') is not False or not design.get('assumptions') or not design.get('referencesNote'):
        errors.append('Storage design must retain cm units and its unmeasured/conditional assumptions')
    clearances = {c['id']: c for c in design.get('clearances', [])}
    if set(clearances) != set(CLEARANCE_SPECS):
        errors.append('Storage plan must preserve all four distinct motion/use overlays')
    for identity, expected in CLEARANCE_SPECS.items():
        item = clearances.get(identity, {})
        if [item.get(k) for k in ('x', 'y', 'w', 'd')] != expected or not item.get('label'):
            errors.append(f'Storage clearance differs from the stated use scenario: {identity}')
    fitouts = data.get('storageFitouts', [])
    if len(fitouts) != 2 or {f['id'] for f in fitouts} != set(STORAGE_LINKS):
        errors.append('Exactly two storage groups are required: entry shoe station and separate dining sideboard')
    rooms = {r['id']: r['points'] for r in data['rooms']}
    parts = {}
    for fitout in fitouts:
        expected = STORAGE_LINKS.get(fitout['id'])
        if not expected or (fitout.get('type'), set(fitout.get('furnitureIds', []))) != expected or fitout.get('roomId') != 'living':
            errors.append(f'Storage group has wrong wrapper/type/room linkage: {fitout["id"]}')
        if fitout.get('openingId') or any(not fitout.get(k) for k in ('summary', 'dimensions', 'conditions', 'references')):
            errors.append(f'Storage must retain conditions/references and must not become an architectural window: {fitout["id"]}')
        for part in fitout.get('parts', []):
            identity = part['id']
            if identity in parts:
                errors.append(f'Duplicate storage part id: {identity}')
            parts[identity] = part
            values = [part.get(k) for k in ('x', 'y', 'w', 'd', 'zCm', 'hCm')]
            if any(not isinstance(v, (int, float)) or not math.isfinite(v) for v in values) or min(part.get(k, 0) for k in ('w', 'd', 'hCm')) <= 0:
                errors.append(f'Storage part has invalid dimensions: {identity}')
                continue
            if (part.get('role'), values) != PART_SPECS.get(identity) or part.get('face') != 'east':
                errors.append(f'Storage part moved, resized, changed elevation/role or faces the wrong wall: {identity}')
            if not rect_on_floor(part, rooms['living']) or not 0 <= part['zCm'] < part['zCm']+part['hCm'] <= 250:
                errors.append(f'Storage part crosses the actual room or ceiling envelope: {identity}')
            if part['x']+part['w'] > 390 and part['y']+part['d'] > 1295:
                errors.append(f'Storage part enters the provisional entry sweep: {identity}')
            for other in data['furniture']:
                if other.get('storageFitoutId'):
                    continue
                if min(part['x']+part['w'], other['x']+other['w']) > max(part['x'], other['x'])+.01 and min(part['y']+part['d'], other['y']+other['d']) > max(part['y'], other['y'])+.01:
                    errors.append(f'Storage part overlaps other furniture: {identity} / {other["name"]}')
    if set(parts) != set(PART_SPECS):
        errors.append('Storage plan must have exactly ten explicitly bounded physical parts')
    for identity, count in (('e_shoe_lower', 3), ('d_base', 2)):
        p = parts.get(identity, {})
        if p.get('doorStyle') != 'sliding' or p.get('doorPanels') != count:
            errors.append(f'Lower cabinet must use the specified sliding panels, not swinging doors: {identity}')
    if parts.get('d_base', {}).get('drawerExtensionCm') != 25 or parts.get('e_shoe_lower', {}).get('openBaseCm') != 20 or parts.get('e_bench', {}).get('seatHeightCm') != 45:
        errors.append('Storage must retain 25 cm drawer limit, 20 cm shoe opening and 45 cm finished bench seat')
    wrappers = [f for f in data['furniture'] if f.get('storageFitoutId')]
    if len(wrappers) != 3 or {f.get('id') for f in wrappers} != set(WRAPPERS):
        errors.append('Storage furniture wrappers must identify exactly shoe cabinet, sideboard and bench')
    for wrapper in wrappers:
        expected = WRAPPERS.get(wrapper.get('id'))
        if not expected:
            continue
        if (wrapper.get('storageFitoutId'), [wrapper.get(k) for k in ('x', 'y', 'w', 'd')], wrapper.get('heightCm')) != expected:
            errors.append(f'Storage wrapper footprint differs from its physical parts: {wrapper.get("id")}')
    if {'e_shoe_lower', 'd_base', 'e_bench'} <= set(parts):
        boxes = {name: (parts[p]['x'], parts[p]['y'], parts[p]['x']+parts[p]['w'], parts[p]['y']+parts[p]['d'])
                 for name, p in (('shoe', 'e_shoe_lower'), ('sideboard', 'd_base'), ('bench', 'e_bench'))}
        check_storage_clearances(data, boxes, errors, checks)
    checks.append('Storage source: two separate hygienic functions, ten bounded parts, shallow upper cabinets and a supported 45 cm bench')
    return parts


def storage_triangles(glb, raw, node_matrix, multiply_matrices, part_ids):
    # Reuse the tested BIN/world-transform decoder through an in-memory tag
    # selector adapter. No vertices, transforms, or on-disk metadata are changed.
    adapted = {**glb, 'nodes': [{**n, 'extras': {**n.get('extras', {}),
                **({'fitoutPartId': n['extras']['storagePartId']} if n.get('extras', {}).get('storagePartId') else {})}}
               for n in glb['nodes']]}
    return list(support_triangles(adapted, raw, node_matrix, multiply_matrices, part_ids))


def empty_volume(triangles, low_cm, high_cm):
    low, high = [v/100+.001 for v in low_cm], [v/100-.001 for v in high_cm]
    center = [(a+b)/2 for a, b in zip(low, high)]
    return not any(triangle_hits_box(t, low, high) for t in triangles) and not point_in_mesh(center, triangles)


def check_storage_assets(data, glb, raw, manifest, root, world_mesh_bounds, node_matrix, multiply_matrices, errors, checks):
    fitouts = {f['id']: f for f in data.get('storageFitouts', [])}
    parts = {p['id']: (f, p) for f in fitouts.values() for p in f['parts']}
    meshes, linked = list(world_mesh_bounds(glb)), {}
    for name, meta, low, high in meshes:
        if meta.get('furnitureId') in WRAPPERS:
            errors.append(f'GLB renders a duplicate solid storage wrapper: {name}')
        if not (meta.get('storageFitoutId') or meta.get('storagePartId')):
            continue
        identity = meta.get('storagePartId')
        if identity not in parts or meta.get('storageFitoutId') != parts[identity][0]['id']:
            errors.append(f'GLB storage part has mismatched or unknown source linkage: {name}')
            continue
        _, part = parts[identity]
        linked.setdefault(identity, []).append((name, meta, low, high))
        if meta.get('storageRole') != part['role'] or meta.get('furnitureFace') != 'east':
            errors.append(f'GLB storage role/orientation metadata differs from the source: {name}')
        if meta.get('openingId') or meta.get('kind') == 'window' or meta.get('fitoutId'):
            errors.append(f'GLB storage is wrongly tagged as an architectural opening or bay fitout: {name}')
        lo, hi = part_bounds(part)
        if any(not math.isfinite(v) for v in low+high) or any(low[i] < lo[i]-.002 or high[i] > hi[i]+.002 for i in range(3)):
            errors.append(f'GLB actual storage mesh escapes its declared 3D envelope: {name}: {low}..{high}')
    for identity in parts:
        if not linked.get(identity):
            errors.append(f'GLB missing actual source-linked storage part (stale model is not accepted): {identity}')
    for identity in ('e_shoe_lower', 'd_base', 'e_shoe_upper', 'd_upper'):
        if identity not in parts or not linked.get(identity):
            continue
        _, part = parts[identity]
        front = (part['x']+part['w'])/100
        # Real east-side thin tall faces, not just a word saying "east".
        panels = [m for m in linked[identity] if m[3][1]-m[2][1] > .35 and m[3][2]-m[2][2] > .20 and
                  m[3][0]-m[2][0] <= .035 and m[2][0] >= front-.065]
        if len(panels) < part['doorPanels']:
            errors.append(f'GLB cabinet lacks actual east-facing front panels: {identity}')
        if part.get('doorStyle') == 'sliding':
            depths = sorted({round((m[2][0]+m[3][0])/2, 3) for m in panels})
            if len(depths) < 2 or max(depths)-min(depths) < .006:
                errors.append(f'GLB lower cabinet does not show real staggered sliding panel lanes: {identity}')
            tracks = [m for m in linked[identity] if 'sliding track' in m[0].lower() and
                      m[3][2]-m[2][2] >= part['d']/100-.05 and m[3][1]-m[2][1] <= .015 and m[2][0] >= front-.06]
            if len(tracks) != 4 or any(m[1].get('doorStyle') != 'sliding' for m in linked[identity]):
                errors.append(f'GLB sliding cabinet lacks two real upper/lower track lanes or source style tags: {identity}')
        if identity == 'd_base':
            drawers = [m for m in linked[identity] if 'closed shallow drawer front' in m[0].lower() and
                       m[3][0]-m[2][0] < .025 and m[2][0] >= front-.035 and m[3][1]-m[2][1] > .15]
            if len(drawers) != 2 or any(m[1].get('drawerExtensionCm') != 25 or m[1].get('drawerState') != 'closed' for m in linked[identity]):
                errors.append('GLB sideboard must have two real closed shallow east-facing drawer fronts and the 25 cm extension limit')
    try:
        triangle_parts = storage_triangles(glb, raw, node_matrix, multiply_matrices, set(parts))
        decorative = {name for name, meta, _, _ in meshes if meta.get('storageElement') == 'decor'}
        by_part = {identity: [t for name, p, ts in triangle_parts if p == identity and name not in decorative for t in ts] for identity in parts}
        # Allow a legitimate thin divider, but require two of three useful
        # through-depth openings; neither a solid box nor a closed front passes.
        for identity, z_low, z_high in (('e_key_niche', 110, 140), ('d_niche', 95, 140), ('e_shoe_lower', 3, 17)):
            if identity not in parts or not linked.get(identity):
                continue
            p = parts[identity][1]
            empty = sum(empty_volume(by_part[identity], [p['x']+5, z_low, p['y']+p['d']*fraction-10],
                                     [p['x']+p['w']-.3, z_high, p['y']+p['d']*fraction+10]) for fraction in (.17, .5, .83))
            if empty < 2:
                errors.append(f'GLB storage open niche/common-shoe void is filled by structural geometry: {identity}: {empty}/3 clear corridors')
        # Derive bench support bounds again from decoded BIN vertices. A stale
        # accessor min/max cannot hide a shortened or floating support panel.
        actual_triangles = {name: ts for name, _, ts in triangle_parts}
        bench = []
        for name, meta, low, high in linked.get('e_bench', []):
            vertices = [p for triangle in actual_triangles.get(name, []) for p in triangle]
            if vertices:
                low = [min(p[i] for p in vertices) for i in range(3)]
                high = [max(p[i] for p in vertices) for i in range(3)]
                bench.append((name, meta, low, high))
        seats = [m for m in bench if 'soft seat' in m[0].lower() and abs(m[3][1]-.45) < .002 and m[3][0]-m[2][0] > .30 and m[3][2]-m[2][2] > .60]
        boards = [m for m in bench if abs(m[2][1]-.40) < .002 and abs(m[3][1]-.425) < .002 and m[3][0]-m[2][0] > .30 and m[3][2]-m[2][2] > .60]
        legs = [m for m in bench if m[2][1] <= .002 and m[3][1] >= .40-.002 and m[3][0]-m[2][0] > .30 and m[3][2]-m[2][2] <= .04]
        if len(seats) != 1 or len(boards) != 1 or len(legs) != 2:
            errors.append('GLB shoe bench must have one real 45 cm finished cushion, 40..42.5 cm seat board, and two full-height end supports')
        elif not (legs[0][2][2] < 13.10 and legs[1][3][2] > 13.80 or legs[1][2][2] < 13.10 and legs[0][3][2] > 13.80):
            errors.append('GLB shoe-bench two grounded supports are not at opposite ends')
        else:
            for leg in legs:
                if abs(leg[3][1]-boards[0][2][1]) > .002 or any(min(leg[3][i], boards[0][3][i])-max(leg[2][i], boards[0][2][i]) < .01 for i in (0, 2)):
                    errors.append(f'GLB shoe bench has a floating or disconnected seat support: {leg[0]}')
    except (KeyError, ValueError) as error:
        errors.append(f'Cannot verify actual storage voids/supports: {error}')
    existing = [m for m in meshes if m[1].get('kind') == 'furniture' and not m[1].get('storageFitoutId')]
    for actual in linked.values():
        for name, _, low, high in actual:
            for other_name, _, lo, hi in existing:
                if all(min(high[i], hi[i])-max(low[i], lo[i]) > .003 for i in range(3)):
                    errors.append(f'GLB storage physically intersects other furniture: {name} / {other_name}')
                    break
    details = manifest.get('storageDetails', [])
    if len(details) != 2 or {d.get('storageFitoutId') for d in details} != set(STORAGE_LINKS):
        errors.append('Manifest must contain two separate source-linked storage detail views')
    for detail in details:
        identity = detail.get('storageFitoutId')
        if identity not in fitouts:
            continue
        fitout = fitouts[identity]
        view = 'entry-storage' if fitout['type'] == 'entry' else 'sideboard'
        render = f'assets/blender-renders/{view}.jpg'
        if (detail.get('id'), detail.get('fitoutId'), detail.get('roomId'), detail.get('render')) != (view, identity, 'living', render):
            errors.append(f'Storage detail manifest has wrong source/render linkage: {identity}')
        if any(detail.get(key) != fitout.get(key) for key in ('summary', 'conditions', 'dimensions', 'references')) or not detail.get('interiorCamera'):
            errors.append(f'Storage detail manifest dropped source limits/references or the true camera: {identity}')
        path = root / render
        if not path.exists() or path.stat().st_size < 10000:
            errors.append(f'Missing / empty source-model storage detail render: {view}')
    checks.append(f'Storage GLB: {len(linked)}/10 actual tagged parts; east faces, sliding lanes, open niches and grounded 45 cm bench checked')
