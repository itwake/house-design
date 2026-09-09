"""Entry/dining storage geometry regressions; all source dimensions are cm.

Door-swing scenarios are explicitly provisional, not surveyed handedness or an
accessibility certification. Mesh checks are independent of Blender execution.
"""
import copy
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
ENTRY_TO_KITCHEN_PATH = [(440, 1410), (440, 1350), (455, 1310), (466, 1281.25),
                         (483, 1266), (495, 1250), (495, 1215), (570, 1215)]
ENTRY_TO_LIVING_PATH = ENTRY_TO_KITCHEN_PATH[:-1] + [(490,1160),(490,1100),(490,1025.75),
    (371,1025.75),(371,900),(371,700),(367.5,610)]
STORAGE_LINKS = {'entry_shoe_station': ('entry', {'entry_storage'}),
    'dining_sideboard_wall': ('sideboard', {'dining_sideboard','dining_sideboard_return','dining_sideboard_corner'})}
SEGMENTS = {'entry_shoe_station': [('east-entry','west')],
    'dining_sideboard_wall': [('west-run','east'),('south-return','north'),('corner','north')]}
# Independent contract: role, segment, x/y/width/depth/base/height(cm), front.
PART_SPECS = {
    'e_shoe_lower': ('shoe_lower','east-entry',[495,1320,34,65,0,100],'west'),
    'e_key_niche': ('key_niche','east-entry',[495,1320,34,65,100,50],'west'),
    'e_shoe_upper': ('upper_cabinet','east-entry',[501,1320,28,65,150,100],'west'),
    'e_key_accessories': ('entry_accessories','east-entry',[500,1323,24,60,100,30],'west'),
    'd1_base': ('sideboard_base','west-run',[212.5,860,40,120,0,85],'east'),
    'd1_niche': ('sideboard_niche','west-run',[212.5,860,40,120,85,65],'east'),
    'd1_upper': ('upper_cabinet','west-run',[212.5,860,28,120,150,100],'east'),
    'd_base': ('sideboard_base','west-run',[212.5,980,40,120,0,85],'east'),
    'd_niche': ('sideboard_niche','west-run',[212.5,980,40,120,85,65],'east'),
    'd_upper': ('upper_cabinet','west-run',[212.5,980,28,120,150,100],'east'),
    'd3_base': ('sideboard_base','west-run',[212.5,1100,40,120,0,85],'east'),
    'd3_niche': ('sideboard_niche','west-run',[212.5,1100,40,120,85,65],'east'),
    'd3_upper': ('upper_cabinet','west-run',[212.5,1100,28,120,150,100],'east'),
    'd4_base': ('sideboard_base','west-run',[212.5,1220,40,129,0,85],'east'),
    'd4_niche': ('sideboard_niche','west-run',[212.5,1220,40,129,85,65],'east'),
    'd4_upper': ('upper_cabinet','west-run',[212.5,1220,28,141,150,100],'east'),
    'd_accessories': ('dining_accessories','west-run',[218,990,29,98,85,40],'east'),
    'd_return_base': ('sideboard_base','south-return',[252.5,1349,122.5,40,0,85],'north'),
    'd_return_niche': ('sideboard_niche','south-return',[252.5,1349,122.5,40,85,65],'north'),
    'd_return_upper': ('upper_cabinet','south-return',[240.5,1361,134.5,28,150,100],'north'),
    'd_return_accessories': ('dining_accessories','south-return',[270,1355,98,29,85,40],'north'),
    'd_corner_base': ('sideboard_blind_base','corner',[212.5,1349,40,40,0,85],'north'),
    'd_corner_niche': ('sideboard_corner_niche','corner',[212.5,1349,40,40,85,65],'north'),
    'd_corner_upper': ('upper_blind_corner','corner',[212.5,1361,28,28,150,100],'north'),
}
LOWERS = {'e_shoe_lower','d1_base','d_base','d3_base','d4_base','d_return_base'}
DRAWERS = {'d1_base','d_base'}
CORNERS = {'d_corner_base','d_corner_niche','d_corner_upper'}
CLEARANCE_SPECS = {'entry_door_sweep': [390, 1295, 100, 100],
    'shoe_user':[435,1320,60,65], 'entry_handle_reserve':[491,1295,12,25],
    'sideboard_drawer_open':[252.5,860,25,240], 'sideboard_user':[277.5,860,50,240],
    'return_user':[252.5,1299,122.5,50]}
WRAPPERS = {'entry_storage': ('entry_shoe_station',[495,1320,34,65],250,'west'),
    'dining_sideboard': ('dining_sideboard_wall',[212.5,860,40,489],250,'east'),
    'dining_sideboard_return': ('dining_sideboard_wall',[252.5,1349,122.5,40],250,'north'),
    'dining_sideboard_corner': ('dining_sideboard_wall',[212.5,1349,40,40],250,'north')}


def plan_bounds(p):
    return (p['x'],p['y'],p['x']+p['w'],p['y']+p['d'])


def intersects(a,b,tolerance=.01):
    return min(a[2],b[2])-max(a[0],b[0])>tolerance and min(a[3],b[3])-max(a[1],b[1])>tolerance


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
    """Conservative cabinet envelopes; explicit provisional90-degree leaves."""
    shoe, west, south = (boxes[k] for k in ('shoe','west','south'))
    furniture = {f['name']: f for f in data['furniture']}
    table,north,chair = (furniture[k] for k in ('四人餐桌','餐椅北1','餐椅南1'))
    metrics = {'west/table':table['x']-west[2], 'east/table':530-table['x']-table['w'],
        'south/chair':south[1]-chair['y']-chair['d'], 'south/rollback30':south[1]-chair['y']-chair['d']-30,
        'shoe/right90leaf':shoe[0]-491, 'south/left90leaf':389-south[2], 'shoe/kitchenopening':shoe[1]-1265}
    for key,value in {'west/table':77.5,'east/table':80,'south/chair':111.5,'south/rollback30':81.5,
                      'shoe/right90leaf':4,'south/left90leaf':14,'shoe/kitchenopening':55}.items():
        if abs(metrics[key]-value)>.01: errors.append(f'Physical clearance changed: {key}={metrics[key]:.3f}, expected{value} cm')
    if north['x']-(west[2]+25+50)<10.5-.01:
        errors.append('North-only25 cm drawer +50 cm user zone conflicts with north dining chair')
    scenario = copy.deepcopy(data)
    for f in scenario['furniture']:
        if f['name'].startswith('餐椅南'): f['y']+=30
    obstacles = solid_footprints(scenario)+[(name+' storage envelope',box) for name,box in boxes.items()]
    for hinge, leaf in (('right', (489, 1295, 491, 1395)), ('left', (389, 1295, 391, 1395))):
        if any(intersects(box,leaf) for box in boxes.values()): errors.append(f'Storage intersects provisional{hinge}90 leaf')
        for route,path in (('kitchen',ENTRY_TO_KITCHEN_PATH),('living-east',ENTRY_TO_LIVING_PATH)):
            distance,obstacle,a,b = path_clearance(path,obstacles+[(hinge+'90 leaf',leaf)])
            if distance<25: errors.append(f'Conditional50 cm {route} route blocked({hinge},chair rollback30): {obstacle}, radius{distance:.3f} at{a}..{b}')
            checks.append(f'Conditional{hinge}90 leaf / chairs back30 / {route}: radius{distance:.3f} cm (not accessibility certification)')
    # Negative witness: direct west access must NOT be advertised for both hinges.
    if path_clearance([(440,1308.25),(291.25,1308.25)],[('left90 leaf',(389,1295,391,1395))])[0]!=0:
        errors.append('Door negative witness broken: direct west access must cross provisional left leaf')
    from geometry_paths import point_rectangle_distance
    def handle_gap(box):
        # Discrete example only: hinge490/1395,radius85,projection8,knob radius3.
        return min(point_rectangle_distance((490-85*math.cos(math.radians(a/10))+8*math.sin(math.radians(a/10)),
            1395-85*math.sin(math.radians(a/10))-8*math.cos(math.radians(a/10))),box)-3 for a in range(901))
    gap,rejected=handle_gap(shoe),handle_gap((495,1300,529,1385))
    if gap<6.99 or rejected>=0: errors.append('Sample handle diagnostic changed:65 cm cabinet7 cm gap;85 cm candidate must collide')
    checks.append(f'Storage clearances(cm):{metrics}; sampled0..90/0.1deg handle gap65 cm={gap:.2f}; rejected85 cm={rejected:.2f}')
    checks.append('Critical limitation:right90 leaf leaves only4 cm at shoe front; CLOSE DOOR before use; beyond~93 degrees can collide; hinge/handle/full sweep unmeasured')


def check_storage_plan(data, errors, checks):
    check_dining_layout(data, errors, checks)
    design = data.get('storageDesign', {})
    if design.get('units') != 'cm' or design.get('measured') is not False or not design.get('assumptions') or not design.get('referencesNote'):
        errors.append('Storage design must retain cm units and its unmeasured/conditional assumptions')
    clearances = {c['id']: c for c in design.get('clearances', [])}
    if set(clearances) != set(CLEARANCE_SPECS):
        errors.append('Storage plan must preserve all six distinct motion/use overlays')
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
        if [(s.get('id'),s.get('face')) for s in fitout.get('segments',[])]!=SEGMENTS.get(fitout['id']):
            errors.append(f'Storage directions must follow actual apartment, not mirrored reference images: {fitout["id"]}')
        for part in fitout.get('parts', []):
            identity = part['id']
            if identity in parts:
                errors.append(f'Duplicate storage part id: {identity}')
            parts[identity] = part
            values = [part.get(k) for k in ('x', 'y', 'w', 'd', 'zCm', 'hCm')]
            if any(not isinstance(v, (int, float)) or not math.isfinite(v) for v in values) or min(part.get(k, 0) for k in ('w', 'd', 'hCm')) <= 0:
                errors.append(f'Storage part has invalid dimensions: {identity}')
                continue
            if (part.get('role'),part.get('segmentId'),values,part.get('face')) != PART_SPECS.get(identity):
                errors.append(f'Storage part moved, resized, changed elevation/role or faces the wrong wall: {identity}')
            if part.get('role')=='upper_cabinet' and part.get('doorPanels')!=2:
                errors.append(f'Upper cabinet must retain exactly2 front doors:{identity}')
            if not identity.startswith('e_') and part.get('role')!='dining_accessories' and part.get('flushJoints') is not True:
                errors.append(f'7-shaped structural parts must retain flush joints:{identity}')
            if not rect_on_floor(part, rooms['living']) or not 0 <= part['zCm'] < part['zCm']+part['hCm'] <= 250:
                errors.append(f'Storage part crosses the actual room or ceiling envelope: {identity}')
            if intersects(plan_bounds(part),(390,1295,490,1395)):
                errors.append(f'Storage part enters the provisional entry sweep: {identity}')
            for other in data['furniture']:
                if other.get('storageFitoutId'):
                    continue
                if min(part['x']+part['w'], other['x']+other['w']) > max(part['x'], other['x'])+.01 and min(part['y']+part['d'], other['y']+other['d']) > max(part['y'], other['y'])+.01:
                    errors.append(f'Storage part overlaps other furniture: {identity} / {other["name"]}')
    if set(parts) != set(PART_SPECS):
        errors.append('Storage plan must have exactly24 explicitly bounded physical parts')
    for identity in LOWERS:
        p = parts.get(identity, {})
        if p.get('doorStyle') != 'sliding' or p.get('doorPanels') != 2:
            errors.append(f'Lower cabinet must use the specified sliding panels, not swinging doors: {identity}')
        if identity!='e_shoe_lower' and (p.get('drawerPanels'),p.get('drawerExtensionCm'))!=((2,25) if identity in DRAWERS else (0,0)):
            errors.append(f'Drawers allowed only northern2 modules,25 cm max: {identity}')
    if parts.get('e_shoe_lower',{}).get('openBaseCm')!=20 or (parts.get('d1_upper',{}).get('openEndCm'),parts.get('d1_upper',{}).get('openEndSide'))!=(30,'south'):
        errors.append('Shoe20 cm openbase/first upper southern30 cm cup bay changed')
    for identity in CORNERS:
        if parts.get(identity,{}).get('usableStorage') is not False: errors.append(f'Corner cannot count as accessible storage: {identity}')
    for identity in ('d4_base','d4_niche','d4_upper'):
        if parts.get(identity,{}).get('omitEndPanel') is not True: errors.append(f'West join must omit end panel:{identity}')
    for identity in ('d_return_base','d_return_niche','d_return_upper'):
        if parts.get(identity,{}).get('omitStartPanel') is not True: errors.append(f'South join must omit start panel:{identity}')
    for identity in ('d1_niche','d_niche','d3_niche','d4_niche'):
        p=parts.get(identity,{})
        if p.get('omitEndPanel') is not True or (identity!='d1_niche' and p.get('omitStartPanel') is not True):
            errors.append(f'Continuous west middle niche must omit internal vertical dividers:{identity}')
    wrappers = [f for f in data['furniture'] if f.get('storageFitoutId')]
    if len(wrappers) != 4 or {f.get('id') for f in wrappers} != set(WRAPPERS):
        errors.append('Storage wrappers must identify exactly4 footprints, not a fixed bench')
    for wrapper in wrappers:
        expected = WRAPPERS.get(wrapper.get('id'))
        if not expected:
            continue
        if (wrapper.get('storageFitoutId'), [wrapper.get(k) for k in ('x', 'y', 'w', 'd')], wrapper.get('heightCm'),wrapper.get('face')) != expected:
            errors.append(f'Storage wrapper footprint differs from its physical parts: {wrapper.get("id")}')
    if set(PART_SPECS)<=set(parts):
        boxes={'shoe':plan_bounds(parts['e_shoe_lower']),'west':(212.5,860,252.5,1389),'south':(252.5,1349,375,1389)}
        check_storage_clearances(data, boxes, errors, checks)
    if any(f.get('id')=='entry_bench' or f['name'] in ('窗边矮柜','窗边绿植') for f in data['furniture']):
        errors.append('Old bench/window cabinet/plant must be removed for full west run')
    checks.append('Storage source:24 parts/4 wrappers; right west-facing65x34 shoe; west529/south162.5 full7 including lower40/upper28 blind corners')
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


def front_frame(p):
    """World GLB thin axis, along axis, front coordinate(m), inward sign."""
    if p['face']=='east': return 0,2,(p['x']+p['w'])/100,-1
    if p['face']=='west': return 0,2,p['x']/100,1
    if p['face']=='north': return 2,0,p['y']/100,1
    raise ValueError('Unsupported contracted storage front')


def near_front(m,axis,front,inward,allowance):
    return min(inward*(m[2][axis]-front),inward*(m[3][axis]-front))>=-.003 and max(inward*(m[2][axis]-front),inward*(m[3][axis]-front))<=allowance


def niche_corridor(p,fraction,low_z,high_z):
    axis,along,front,inward=front_frame(p)
    lo,hi=part_bounds(p)
    lo,hi=[v*100 for v in lo],[v*100 for v in hi]
    center=lo[along]+(hi[along]-lo[along])*fraction
    half=min(10,(hi[along]-lo[along])*.12)
    lo[along],hi[along]=center-half,center+half
    lo[1],hi[1]=low_z,high_z
    if inward==-1: lo[axis]+=5; hi[axis]-=.3
    else: lo[axis]+=.3; hi[axis]-=5
    return lo,hi


def check_storage_assets(data,glb,raw,manifest,root,world_mesh_bounds,node_matrix,multiply_matrices,errors,checks):
    fitouts={f['id']:f for f in data.get('storageFitouts',[])}
    parts={p['id']:(f,p) for f in fitouts.values() for p in f['parts']}
    meshes,linked=list(world_mesh_bounds(glb)),{}
    try:
        decoded=storage_triangles(glb,raw,node_matrix,multiply_matrices,set(parts))
    except (KeyError,ValueError) as exc:
        errors.append(f'Cannot decode actual storage BIN triangles:{exc}')
        return
    triangles_by_name={name:ts for name,_,ts in decoded}
    # Bounds MUST come from all actual BIN vertices, not accessor min/max or tags.
    actual_meshes=[]
    for name,meta,low,high in meshes:
        if meta.get('furnitureId') in WRAPPERS:
            errors.append(f'Duplicate solid storage wrapper rendered:{name}')
        if not(meta.get('storageFitoutId') or meta.get('storagePartId')):
            actual_meshes.append((name,meta,low,high))
            continue
        key=meta.get('storagePartId')
        if key not in parts or meta.get('storageFitoutId')!=parts[key][0]['id']:
            errors.append(f'Unknown/mismatched storage source linkage:{name}')
            continue
        vertices=[v for t in triangles_by_name.get(name,[]) for v in t]
        if not vertices:
            errors.append(f'Storage has no decoded vertices:{name}')
            continue
        low,high=[min(v[i] for v in vertices) for i in range(3)],[max(v[i] for v in vertices) for i in range(3)]
        m=(name,meta,low,high)
        actual_meshes.append(m)
        linked.setdefault(key,[]).append(m)
        p=parts[key][1]
        if (meta.get('storageRole'),meta.get('storageSegmentId'),meta.get('furnitureFace'))!=(p['role'],p['segmentId'],p['face']):
            errors.append(f'Storage source tags/face disagree:{name}')
        if meta.get('openingId') or meta.get('kind')=='window' or meta.get('fitoutId'):
            errors.append(f'Storage incorrectly tagged as architectural window/bay:{name}')
        lo,hi=part_bounds(p)
        if any(not math.isfinite(v) for v in low+high) or any(low[i]<lo[i]-.002 or high[i]>hi[i]+.002 for i in range(3)):
            errors.append(f'Actual BIN storage escapes declared envelope:{name}:{low}..{high}')
    for key in parts:
        if not linked.get(key): errors.append(f'Missing actual source-linked storage part (stale model rejected):{key}')
    for key,(_,p) in parts.items():
        if p['role'] not in ('shoe_lower','sideboard_base','upper_cabinet') or not linked.get(key): continue
        axis,along,front,inward=front_frame(p)
        panels=[m for m in linked[key] if m[3][1]-m[2][1]>.35 and m[3][along]-m[2][along]>.20
                and m[3][axis]-m[2][axis]<=.035 and near_front(m,axis,front,inward,.065)]
        if len(panels)!=2: errors.append(f'Cabinet lacks exactly2 actual {p["face"]}-facing thin tall doors:{key} ({len(panels)})')
        if key in LOWERS:
            lanes={round((m[2][axis]+m[3][axis])/2,3) for m in panels}
            if len(lanes)!=2 or max(lanes)-min(lanes)<.006: errors.append(f'No real staggered sliding lanes:{key}')
            span=p['d'] if axis==0 else p['w']
            tracks=[m for m in linked[key] if 'sliding track' in m[0].lower() and m[3][along]-m[2][along]>=span/100-.05
                    and m[3][1]-m[2][1]<=.015 and near_front(m,axis,front,inward,.065)]
            if len(tracks)!=4 or any(m[1].get('doorStyle')!='sliding' for m in linked[key]):
                errors.append(f'No actual2 upper/lower track lanes or sliding style:{key}')
        drawers=[m for m in linked[key] if 'closed shallow drawer front' in m[0].lower() and
                 m[3][axis]-m[2][axis]<.025 and near_front(m,axis,front,inward,.035) and m[3][1]-m[2][1]>.15]
        if len(drawers)!=(2 if key in DRAWERS else 0): errors.append(f'Actual drawer count violates north-only2 modules:{key}')
        if key in DRAWERS and any(m[1].get('drawerExtensionCm')!=25 or m[1].get('drawerState')!='closed' for m in linked[key]):
            errors.append(f'Drawer extension/state tags changed:{key}')
    decor={name for name,meta,_,_ in actual_meshes if meta.get('storageElement')=='decor'}
    by_part={key:[t for name,p,ts in decoded if p==key and name not in decor for t in ts] for key in parts}
    for key,(_,p) in parts.items():
        if p['role'] not in ('key_niche','sideboard_niche','shoe_lower') or not linked.get(key): continue
        zlo,zhi=(3,17) if p['role']=='shoe_lower' else (p['zCm']+10,p['zCm']+p['hCm']-10)
        clear=sum(empty_volume(by_part[key],*niche_corridor(p,f,zlo,zhi)) for f in (.17,.5,.83))
        if clear<2: errors.append(f'Actual {p["face"]} niche/open shoe base filled:{key} ({clear}/3 clear pockets)')
    # Blind construction corners have actual four-sided partitions, not fake
    # usable fronts. The middle has real unobstructed joins and continuous tops.
    for key in ('d_corner_base','d_corner_upper'):
        items=linked.get(key,[])
        p=parts.get(key,({},{}))[1]
        if not p: continue
        lo,hi=part_bounds(p)
        for label,axis,edge in (('west',0,lo[0]),('east',0,hi[0]),('north',2,lo[2]),('south',2,hi[2])):
            found=[m for m in items if f'blind corner {label} partition' in m[0].lower()
                   and m[3][axis]-m[2][axis]<.022 and min(abs(m[2][axis]-edge),abs(m[3][axis]-edge))<.002
                   and m[3][1]-m[2][1]>.7]
            if len(found)!=1: errors.append(f'Blind corner missing real {label} partition:{key}')
        if any('door' in m[0].lower() or 'drawer' in m[0].lower() for m in items):
            errors.append(f'Blind corner invents accessible front:{key}')
        if any(m[1].get('storageAccess')!='blind construction void; not accessible storage' for m in items):
            errors.append(f'Blind corner loses non-storage access warning:{key}')
    middle=[t for key in ('d4_niche','d_corner_niche','d_return_niche') for t in by_part.get(key,[])]
    for label,lo,hi in [('center',[220,105,1355],[244,135,1381]),
                      ('west-to-corner',[220,105,1347],[239,135,1353]),
                      ('corner-to-south',[250.5,105,1359],[254.5,135,1378])]:
        if not empty_volume(middle,lo,hi): errors.append(f'7-shaped middle niche obstructed at actual {label} join')
    west_middle=[t for key in ('d1_niche','d_niche','d3_niche','d4_niche') for t in by_part.get(key,[])]
    for join in (980,1100,1220):
        if not empty_volume(west_middle,[220,105,join-2],[250,135,join+2]):
            errors.append(f'Continuous west middle niche has real vertical divider at y={join} cm')
    for key in ('d1_base','d_base','d3_base','d4_base','d_corner_base','d_return_base','d4_upper','d_corner_upper','d_return_upper'):
        p=parts.get(key,({},{}))[1]
        if not p: continue
        lo,hi=part_bounds(p)
        tops=[m for m in linked.get(key,[]) if ('worktop' in m[0].lower() or 'finished top' in m[0].lower() or 'cabinet top' in m[0].lower())
              and all(abs(m[2][i]-lo[i])<.002 and abs(m[3][i]-hi[i])<.002 for i in (0,2)) and abs(m[3][1]-hi[1])<.002]
        if len(tops)!=1: errors.append(f'Actual continuous7-shaped finished top missing/fullspan mismatch:{key}')
    structural=[(key,m) for key,ms in linked.items() for m in ms if m[0] not in decor]
    for index,(key,m) in enumerate(structural):
        for other_key,n in structural[index+1:]:
            if key!=other_key and all(min(m[3][i],n[3][i])-max(m[2][i],n[2][i])>.003 for i in range(3)):
                errors.append(f'Actual different storage parts interpenetrate:{m[0]} / {n[0]}')
    existing=[m for m in actual_meshes if m[1].get('kind')=='furniture' and not m[1].get('storageFitoutId')]
    for items in linked.values():
        for name,_,lo,hi in items:
            for other,_,low,high in existing:
                if all(min(hi[i],high[i])-max(lo[i],low[i])>.003 for i in range(3)):
                    errors.append(f'Actual storage intersects retained furniture:{name}/{other}')
                    break
    details=manifest.get('storageDetails',[])
    if len(details)!=2 or {d.get('storageFitoutId') for d in details}!=set(STORAGE_LINKS):
        errors.append('Manifest needs2 distinct source-linked storage views')
    for detail in details:
        identity=detail.get('storageFitoutId')
        if identity not in fitouts: continue
        f=fitouts[identity]
        view='entry-storage' if f['type']=='entry' else 'sideboard'
        render=f'assets/blender-renders/{view}.jpg'
        if (detail.get('id'),detail.get('fitoutId'),detail.get('roomId'),detail.get('render'))!=(view,identity,'living',render):
            errors.append(f'Storage view source/render linkage wrong:{identity}')
        if any(detail.get(k)!=f.get(k) for k in ('summary','conditions','dimensions','references')) or not detail.get('interiorCamera'):
            errors.append(f'Storage manifest lost actual camera/source limits:{identity}')
        path=root/render
        if not path.exists() or path.stat().st_size<10000: errors.append(f'Missing/empty storage source-model render:{view}')
    checks.append(f'Storage GLB:{len(linked)}/24 BIN-verified parts; west/east/north fronts,6 sliders/24 tracks,north-only drawers,open voids,blind corners and continuous7 joins')
