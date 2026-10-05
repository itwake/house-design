"""Apply the approved family R3 private-room plan without rebuilding public fitout.

The immutable baseline is the published family V3.8 blend and centimetre source,
saved in tmp/family-r3-baseline. Materials, external openings, kitchen, laundry,
storage and purchased furniture remain native objects from that baseline.
The nine affected private/overall views are rendered; eleven unchanged public
views retain their original images and explicit historical provenance.

Build: blender --background --threads 2 --python tools/refresh_family_r3.py -- --only-build
Render saved file: blender --background models/schemes/family/huiyayuan-wood.blend
  --threads 2 --python tools/refresh_family_r3.py -- --reuse --render all --resolution 960 --samples 8
"""
import importlib.util
import hashlib
import json
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('family_builder', ROOT/'tools/build_family_storage.py')
family = importlib.util.module_from_spec(spec)
spec.loader.exec_module(family)
b = family.b
SOURCE = b.MODEL_DIR/'design-data.json'
BASELINE = ROOT/'tmp/family-r3-baseline/huiyayuan-wood.blend'
BASELINE_DATA = ROOT/'tmp/family-r3-baseline/design-data.json'
PRIVATE = {'room_a', 'room_b', 'room_c', 'bath_1', 'bath_2'}
DOOR_IDS = {'door_a', 'door_b', 'door_c', 'door_bath_1', 'door_bath_2'}
BASELINE_COMMIT = 'e210bd72e3feb11bafd02f3e8619399bdc7a99f8'
FRESH_VIEWS = {'overall','master','bedroom-b','study','master-bath','guest-bath','bay-master','bay-tea','suite-entry'}


def rid(data):
    return data['familyR3Revision'].get('id', 'family-private-r3-3.10.0')


def furniture_key(f):
    return str(f.get('id') or f['name'])


def room_of(f, data):
    return f.get('roomId') or b.room_at((f['x']+f['w']/2)/100, (f['y']+f['d']/2)/100, data['rooms'])


def native_furniture(f):
    key = furniture_key(f)
    return [o for o in bpy.context.scene.objects if o.get('furnitureId') == key or o.get('furnitureName') == f['name']]


def mark(objects, data, **properties):
    for obj in objects:
        obj['familyR3RevisionId'] = rid(data)
        for key, value in properties.items():
            obj[key] = value


def axis_key(coords):
    forward = tuple(float(x) for x in coords)
    backward = (forward[2], forward[3], forward[0], forward[1])
    return min(forward, backward)


def wall_openings(coords, ops):
    horizontal = abs(coords[1]-coords[3]) < 1e-6
    axis, fixed = (0, coords[1]) if horizontal else (1, coords[0])
    lo, hi = sorted((coords[axis], coords[axis+2]))
    result = []
    for op in ops:
        values = [op[k] for k in ('x1', 'y1', 'x2', 'y2')]
        cross = 1-axis
        if abs(values[cross]-fixed) < 1e-6 and abs(values[cross+2]-fixed) < 1e-6:
            a, z = sorted((values[axis], values[axis+2]))
            if lo-1e-6 <= a < z <= hi+1e-6:
                result.append(op)
    return result


def wall_signature(data, coords):
    return (b.wall_height_profile(data, coords), wall_openings(coords, b.load_openings(data)))


def opening_details(op, data):
    """Axis-independent jambs and an explicit source-defined 90-degree leaf.

    openLeafCm is also the website collision envelope. Pulls remain recessed
    inside it, so the native geometry does not silently reduce that clearance.
    """
    assert op['id'] in DOOR_IDS
    operation = op['operation']
    assert operation['type'] == 'hinged', 'R3 private rooms use ordinary hinged doors'
    room = {'door_a':'room_a', 'door_b':'room_b', 'door_c':'room_c',
            'door_bath_1':'bath_1', 'door_bath_2':'bath_2'}[op['id']]
    x1, y1, x2, y2 = [op[k]/100 for k in ('x1', 'y1', 'x2', 'y2')]
    horizontal = abs(y1-y2) < 1e-7
    start, end = sorted((x1, x2) if horizontal else (y1, y2))
    length = end-start
    h = op['height']

    def part(label, cx, cy, z, w, d, height, material='Oak', role='r3-door-frame'):
        obj = b.box(op['id']+' / R3 '+label, cx, cy, z, w, d, height,
                    material, .0015, 'door', room)
        mark([obj], data, openingId=op['id'], doorRole=role,
             apertureAxis='horizontal' if horizontal else 'vertical')
        return obj

    for at in (start+.03, end-.03):
        part('jamb', at if horizontal else x1, y1 if horizontal else at, 0,
             .06 if horizontal else .145, .145 if horizontal else .06, h-.06)
    part('head', (x1+x2)/2, (y1+y2)/2, h-.06,
         length if horizontal else .145, .145 if horizontal else length, .06)
    part('flush floor', (x1+x2)/2, (y1+y2)/2, -.012,
         length if horizontal else .12, .12 if horizontal else length, .012,
         'Tile' if 'bath' in op['id'] else 'Oak', 'door-floor')
    p = operation['openLeafCm']
    x, y, w, d = [p[k]/100 for k in ('x', 'y', 'w', 'd')]
    leaf = part('open 90 door leaf', x+w/2, y+d/2, .02, w, d, h-.075,
                role='hinged-open-panel')
    leaf['openLeafCm'] = [p[k] for k in ('x', 'y', 'w', 'd')]
    leaf['hingeCm'] = operation['hingeCm']
    leaf['pose'] = 'open90'
    hx, hy = [v/100 for v in operation['hingeCm']]
    if w > d:
        tip = x+.10 if abs(hx-(x+w)) < abs(hx-x) else x+w-.10
        part('recessed pull', tip, y+.002, .96, .07, .003, .13, 'Brass', 'hinged-open-panel')
    else:
        tip = y+.10 if abs(hy-(y+d)) < abs(hy-y) else y+d-.10
        part('recessed pull', x+.002, tip, .96, .003, .07, .13, 'Brass', 'hinged-open-panel')


def update_architecture(old, data):
    assert old['windows'] == data['windows'], 'R3 must retain all external/shared window geometry'
    oldmap = {axis_key(w): (index, w) for index, w in enumerate(old['walls'])}
    newmap = {axis_key(w): (index, w) for index, w in enumerate(data['walls'])}
    remove_indices = set()
    rebuild_indices = set()
    retained_indices = {}
    for key, (index, coords) in oldmap.items():
        if key not in newmap:
            remove_indices.add(index)
        else:
            new_index, new_coords = newmap[key]
            if wall_signature(old, coords) != wall_signature(data, new_coords):
                remove_indices.add(index)
                rebuild_indices.add(new_index)
            else:
                retained_indices[index] = new_index
    for key, (index, _) in newmap.items():
        if key not in oldmap:
            rebuild_indices.add(index)
    for obj in list(bpy.context.scene.objects):
        index = obj.get('wallIndex')
        if index is None and obj.name.startswith('Skirting '):
            index = int(obj.name.split()[1].split('.')[0])
        if index in remove_indices or obj.get('openingId') in DOOR_IDS:
            bpy.data.objects.remove(obj, do_unlink=True)
        elif index in retained_indices:
            new_index = retained_indices[index]
            obj['wallIndex'] = new_index
            obj['external'] = new_index < 8
            obj.name = obj.name.replace(f'Wall {index:02}', f'Wall {new_index:02}', 1).replace(f'Skirting {index:02}', f'Skirting {new_index:02}', 1)

    indices = sorted(rebuild_indices)
    original_opening = b.opening_details
    b.opening_details = lambda *_: None  # Cut apertures, but preserve existing windows.
    try:
        before = set(bpy.context.scene.objects)
        b.wall_and_openings({**data, 'walls':[data['walls'][i] for i in indices]}, b.load_openings(data))
        for obj in set(bpy.context.scene.objects)-before:
            local = obj.get('wallIndex')
            if local is None:
                local = int(obj.name.split()[1].split('.')[0])
            index = indices[local]
            obj['wallIndex'] = index
            obj['external'] = index < 8
            obj.name = obj.name.replace(f'Wall {local:02}', f'Wall {index:02}', 1).replace(f'Skirting {local:02}', f'Skirting {index:02}', 1)
            mark([obj], data)
    finally:
        b.opening_details = original_opening
    for op in b.load_openings(data):
        if op['id'] in DOOR_IDS:
            opening_details(op, data)

    oldrooms = {r['id']:r for r in old['rooms']}
    changed_rooms = [r for r in data['rooms'] if r['points'] != oldrooms[r['id']]['points'] or b.room_height(data, r) != b.room_height(old, oldrooms[r['id']])]
    changed_ids = {r['id'] for r in changed_rooms}
    for obj in list(bpy.context.scene.objects):
        if obj.get('roomId') in changed_ids and obj.get('kind') in ('floor', 'ceiling'):
            bpy.data.objects.remove(obj, do_unlink=True)
    before = set(bpy.context.scene.objects)
    b.floors({**data, 'rooms':changed_rooms})
    mark(set(bpy.context.scene.objects)-before, data)
    return {'rebuildWallIndices':indices, 'removedOldWallIndices':sorted(remove_indices), 'changedFloorRooms':sorted(changed_ids)}


def full_study_desk(f):
    x,y,w,d = [f[k]/100 for k in ('x','y','w','d')]
    b.CURRENT_ROOM = 'room_c'
    b.block('R3 study continuous tabletop', x,y,.73,w,d,.03,mat='OakLight',bevel=.008)
    for px in (x, x+w-.025):
        b.block('R3 study desk end gable',px,y,0,.025,d,.73,mat='Cream',bevel=.003)
    for py in (y+.045,y+d-.045):
        b.box('R3 study desk underframe',x+w/2,py,.69,w-.05,.025,.04,'WarmGrayMetal',.002)
    b.box('R3 study desk intermediate support',x+w*.38,y+d-.055,0,.03,.03,.73,'WarmGrayMetal',.002)
    b.lamp(x+w-.30,y+d-.20,.76,True)
    b.block('R3 study notebook',x+.18,y+.15,.762,.26,.18,.018,mat='Sage',bevel=.004)


def rebuild_fitout(old, data):
    oldby = {furniture_key(f):f for f in old['furniture']}
    newby = {furniture_key(f):f for f in data['furniture']}
    assert set(oldby) == set(newby), 'Unexpected furniture addition/removal in R3'
    refreshed = []
    for key, f in newby.items():
        previous = oldby[key]
        dims = ('x','y','w','d','face','headDirection')
        if all(previous.get(k) == f.get(k) for k in dims):
            continue
        assert room_of(f, data) in PRIVATE, 'Do not alter public furniture'
        objects = native_furniture(previous)
        assert objects, 'Missing native furniture: '+key
        if all(previous.get(k) == f.get(k) for k in ('w','d','face','headDirection')):
            dx,dy = (f['x']-previous['x'])/100, (f['y']-previous['y'])/100
            for obj in objects:
                obj.matrix_world = Matrix.Translation((dx,-dy,0)) @ obj.matrix_world
            mark(objects, data, poseTranslationCm=[dx*100,dy*100], familyR3PoseOnly=True)
        else:
            for obj in objects:
                bpy.data.objects.remove(obj, do_unlink=True)
            before = set(bpy.context.scene.objects)
            if key == 'study_full_desk':
                full_study_desk(f)
            elif key == 'study_north_sofa':
                b.CURRENT_ROOM = 'room_c'
                b.sofa(f)
                for px in (f['x']/100+.09,(f['x']+f['w'])/100-.09):
                    for py in (f['y']/100+.08,(f['y']+f['d'])/100-.08):
                        b.box('R3 study sofa floor foot',px,py,0,.04,.04,.11,'Oak',.003)
            else:
                raise ValueError('Unhandled changed furniture footprint '+key)
            objects = set(bpy.context.scene.objects)-before
            mark(objects, data, furnitureId=key, furnitureName=f['name'], furnitureFace=f.get('face',''), roomId=room_of(f,data))
        refreshed.append(key)

    oldfits = {f['id']:f for f in old.get('wallFitouts',[])}
    for fit in data.get('wallFitouts',[]):
        if oldfits.get(fit['id']) == fit:
            continue
        assert fit['roomId'] == 'room_c', 'Only study bookwall may be rebuilt'
        for obj in list(bpy.context.scene.objects):
            if obj.get('wallFitoutId') == fit['id'] or obj.get('furnitureId') == fit['id']:
                bpy.data.objects.remove(obj, do_unlink=True)
        for p in fit['parts']:
            obj=b.block(fit['id']+' / R3 '+p['id'],p['x']/100,p['y']/100,p['zCm']/100,p['w']/100,p['d']/100,p['hCm']/100,
                        mat=p['material'],bevel=.001,kind='furniture',room=fit['roomId'])
            mark([obj], data, wallFitoutId=fit['id'], wallPartId=p['id'], wallPartRole=p['role'], furnitureId=fit['id'], furnitureFace=fit['face'])
    return refreshed


def configure_views(data):
    family.configure_flow_views(data)
    b.VIEWS.update({
        'master':((4.45,3.06,1.62),(5.32,1.33,1.13),18),
        'bedroom-b':((2.62,2.87,1.62),(1.49,1.20,1.08),18),
        'study':((.80,4.40,1.62),(1.10,5.89,1.24),17),
        'suite-entry':((2.925,4.08,1.60),(4.50,4.08,1.20),17),
        'master-bath':((6.57,4.65,1.60),(4.97,3.73,1.12),18),
    })
    for name, settings in data['familyR3Revision'].get('views',{}).items():
        b.VIEWS[name] = tuple(settings)


def make_manifest(data):
    b.manifest(data,b.load_openings(data),SOURCE)
    b.kitchen_manifest_detail(data)
    path=b.MODEL_DIR/'scene-manifest.json'
    m=json.loads(path.read_text(encoding='utf-8'))
    m.update(version=data['version'],schemeId='family',layout=data['layout'],
             familyR3Revision=data['familyR3Revision'],wallFitouts=data.get('wallFitouts',[]))
    descriptions = data['familyR3Revision'].get('roomDescriptions',{})
    room_to_view={'room_a':'master','room_b':'bedroom-b','room_c':'study','bath_1':'master-bath','bath_2':'guest-bath'}
    for room in m['rooms']:
        copy=descriptions.get(room['id']) or descriptions.get(room_to_view.get(room['id'],''))
        if copy:
            room['description']=copy.get('description','') if isinstance(copy,dict) else copy
        if room['id'] in PRIVATE:
            room['features']=copy.get('features',[]) if isinstance(copy,dict) else ['已确认 R3 墙门布局','同一 Blender 模型与真实比例','家具及成品门净空待现场深化']
    # Historical suite/family notes include obsolete wall positions and sliding
    # study-door assumptions. They remain in source historicalGeometryNotes,
    # not as current instructions in the regenerated public scene manifest.
    m['notes']=list(dict.fromkeys([
        '厘米平面数据转换为米；9张受影响视角与R3模型同源新渲染，11张未改公共空间保留明确历史来源。',
        '已确认设计墙线不等于结构可拆许可或完整实测闭合；本模型不是施工图。',
        *data.get('geometryNotes',[]),
        *data['familyR3Revision'].get('conditions',[]),
        *data.get('storageDesign',{}).get('assumptions',[]),
        *data.get('laundry',{}).get('conditions',[]),
        *data.get('kitchenFitout',{}).get('conditions',[]),
    ]))
    for detail in m.get('layoutDetails',[]):
        if detail['id'] == 'suite-entry':
            pos,target,lens=b.VIEWS['suite-entry']
            detail.update(title='主卧门北移 · 套内入口与主卫',
                interiorCamera={'position':b.three(pos),'target':b.three(target),
                                'horizontalFov':round(math.degrees(2*math.atan(36/(2*lens))),2)})
    path.write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8',newline='\n')


def finish_render_inheritance():
    """Only changed spaces are fresh. Public images retain their actual lineage."""
    path=b.MODEL_DIR/'scene-manifest.json'
    current=json.loads(path.read_text(encoding='utf-8'))
    records=current.get('renderedViews',{})
    blend_hash=hashlib.sha256((b.MODEL_DIR/'huiyayuan-wood.blend').read_bytes()).hexdigest()
    # A pilot batch may end before every affected view is rendered.
    if not FRESH_VIEWS.issubset(records):
        return
    for name in FRESH_VIEWS:
        record=records[name]
        assert record['baseBlendSha256']==blend_hash and record['sourceSha256']==current['sourceSha256']
        assert not record.get('retainedFrom')
        assert record['imageSha256']==hashlib.sha256((b.RENDER_DIR/(name+'.jpg')).read_bytes()).hexdigest()
    previous=json.loads((BASELINE.parent/'scene-manifest.json').read_text(encoding='utf-8'))
    references=sorted(set(b.VIEWS)-FRESH_VIEWS)
    assert len(references)==11 and len(b.VIEWS)==20
    for name in references:
        record=previous['renderedViews'][name]
        assert record['imageSha256']==hashlib.sha256((b.RENDER_DIR/(name+'.jpg')).read_bytes()).hexdigest(), 'Do not overwrite unchanged historical reference '+name
        lineage={'commit':BASELINE_COMMIT,'manifest':'models/schemes/family/scene-manifest.json','view':name,
                 'reason':'R3仅调整私密区墙门家具；此为未改公共空间的已发布历史参考，非新帧，不代表重算全屋光照或新墙后的远景。'}
        if record.get('retainedFrom'):
            lineage['previous']=record['retainedFrom']
        records[name]={**record,'retainedFrom':lineage}
    current['renderInheritance']={'reviewedAt':'3.10.0','baselineCommit':BASELINE_COMMIT,
        'currentViews':sorted(FRESH_VIEWS),'referenceViews':references,
        'note':'9张受影响全屋/私密区视角来自同一R3原生模型新渲染；11张未改公共空间原图保留完整历史来源，不冒充新帧。'}
    current['notes']=[note.replace('厘米平面数据转换为米；本次R3模型与全部渲染同源。',
        '厘米平面数据转换为米；9张受影响视角与R3模型同源新渲染，11张未改公共空间保留明确历史来源。') for note in current['notes']]
    path.write_text(json.dumps(current,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print('FAMILY_R3_RENDER_PROVENANCE_COMPLETE 9 fresh / 11 historical',flush=True)


def build(args,data):
    assert BASELINE.is_file() and BASELINE_DATA.is_file(), 'Snapshot published family scene and source before building'
    old=json.loads(BASELINE_DATA.read_text(encoding='utf-8'))
    bpy.ops.wm.open_mainfile(filepath=str(BASELINE))
    b.COLS.clear()
    for material in bpy.data.materials:
        b.MATS[material.name]=material
    b.THICK=data.get('wallThicknessCm',12)/100
    b.HEIGHT=data.get('wallHeightCm',270)/100
    architecture=update_architecture(old,data)
    furniture=rebuild_fitout(old,data)
    for name, settings in b.VIEWS.items():
        if bpy.data.objects.get(name):
            bpy.data.objects.remove(bpy.data.objects[name],do_unlink=True)
        b.camera(name,*settings)
    b.configure_render(args)
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH':
            obj.hide_set(False)
            obj.hide_render=obj.get('kind')=='ceiling'
    bpy.context.scene.camera=bpy.data.objects['overall']
    bpy.context.scene['familyR3RevisionId']=rid(data)
    make_manifest(data)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(b.MODEL_DIR/'huiyayuan-wood.blend'),compress=True)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH' and obj.get('kind') not in ('ceiling','backdrop'):
            obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(b.MODEL_DIR/'huiyayuan-wood.glb'),export_format='GLB',use_selection=True,
        export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True,
        export_texcoords=True,export_normals=True,export_materials='EXPORT',export_image_format='AUTO')
    print('FAMILY_R3_NATIVE_COMPLETE',json.dumps({'architecture':architecture,'refreshedFurniture':furniture,'views':list(b.VIEWS)}),flush=True)


def main():
    args=b.parse_args()
    data=json.loads(SOURCE.read_text(encoding='utf-8'))
    assert data.get('familyR3Revision',{}).get('version')=='3.10.0', 'Explicit approved familyR3Revision 3.10.0 required'
    configure_views(data)
    if not args.reuse:
        build(args,data)
    else:
        # Source is locked before rendering. Refresh current prose/camera maps
        # while retaining already completed frames and their actual hashes.
        path=b.MODEL_DIR/'scene-manifest.json'
        previous=json.loads(path.read_text(encoding='utf-8'))
        make_manifest(data)
        current=json.loads(path.read_text(encoding='utf-8'))
        if previous.get('sourceSha256')==current.get('sourceSha256'):
            for key in ('renderedViews','baseBlendSha256','renderSpec'):
                if key in previous:
                    current[key]=previous[key]
        path.write_text(json.dumps(current,ensure_ascii=False,indent=2),encoding='utf-8',newline='\n')
    if not args.only_build:
        if args.render=='all':
            args.render=','.join(name for name in b.VIEWS if name in FRESH_VIEWS)
        assert set(args.render.split(',')).issubset(FRESH_VIEWS), 'R3 only refreshes affected private/overall views; public photos remain historical'
        b.render(args)
        finish_render_inheritance()


if __name__=='__main__':
    main()
