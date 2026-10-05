"""Wood-only V3.9 fitout refresh from the saved, published V3.8 scene.

All geometry uses the shared centimetre source. Architecture, kitchen equipment
and purchased furniture are retained, not regenerated. Every wood render is new.
Usage: blender --background --threads 2 --python tools/refresh_wood_revision.py
       -- --only-build --resolution 960 --samples 8
Then render the saved scene with this same script and --reuse --render all.
"""
import ast
import importlib.util
import json
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('wood_builder', ROOT/'tools/build_wood_kitchen.py')
wrapper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wrapper)
b = wrapper.b
original_configure_render = b.configure_render


def configure_render(args):
    original_configure_render(args)
    bpy.context.scene.view_settings.exposure = -.25


b.configure_render = configure_render
SOURCE = b.MODEL_DIR/'design-data.json'
BASELINE = ROOT/'tmp/wood-revision-baseline/huiyayuan-wood.blend'
BASELINE_DATA = ROOT/'tmp/wood-revision-baseline/design-data.json'

# Import only the existing, audited appliance body and shallow-shell primitives.
# Loading the laundry wrapper itself would accidentally activate suite walls.
laundry_scope = {'b': b, 'bpy': bpy, 'math': math}
laundry_tree = ast.parse((ROOT/'tools/build_laundry_layout.py').read_text(encoding='utf-8'))
for helper in ('front_cylinder', 'appliance'):
    node = next(n for n in laundry_tree.body if isinstance(n, ast.FunctionDef) and n.name == helper)
    exec(compile(ast.Module(body=[node], type_ignores=[]), 'shared laundry primitive', 'exec'), laundry_scope)


def revision_id(data):
    return data['woodRevision'].get('id', 'wood-3.9.0')


def fixture_room(f, data):
    return f.get('roomId') or b.room_at((f['x']+f['w']/2)/100, (f['y']+f['d']/2)/100, data['rooms'])


def selected(f, data):
    rid = fixture_room(f, data)
    if rid in ('room_a', 'room_b', 'room_c', 'balcony'):
        return True
    return rid == 'bath_1' and ('浴室柜' in f['name'] or '马桶' in f['name'])


def remove_old_fitout(old):
    names = {f['name'] for f in old['furniture'] if selected(f, old)}
    ids = {str(f.get('id') or f['name']) for f in old['furniture'] if selected(f, old)}
    bays = {f['id'] for f in old.get('bayFitouts', []) if f['roomId'] == 'room_a'}
    removed = []
    for obj in list(bpy.context.scene.objects):
        changed_furniture = obj.get('furnitureName') in names or obj.get('furnitureId') in ids
        changed_bay = obj.get('fitoutId') in bays
        previous_revision = obj.get('woodRevisionId')
        if changed_furniture or changed_bay or previous_revision or obj.get('kind') == 'floor':
            removed.append(obj.name)
            bpy.data.objects.remove(obj, do_unlink=True)
    assert removed, 'No old fitout found; refuse to add overlapping objects'
    return removed


def changed_partition(old, data):
    """Rebuild only the explicitly changed inner balcony partition/opening."""
    changed = [i for i, wall in enumerate(old['walls']) if wall != data['walls'][i]]
    added = list(range(len(old['walls']), len(data['walls'])))
    if not changed and not added:
        return
    old_ops = {op['id']: op for op in old['windows']+old['doors']}
    new_ops = {op['id']: op for op in data['windows']+data['doors']}
    old_door = old_ops['balcony_door']
    partition_indices = [i for i, coords in enumerate(old['walls'])
                         if coords[0] == coords[2] == old_door['x1'] == old_door['x2']
                         and min(coords[1], coords[3]) <= min(old_door['y1'], old_door['y2'])
                         and max(coords[1], coords[3]) >= max(old_door['y1'], old_door['y2'])]
    if len(partition_indices) != 1 or changed != partition_indices or len(added) != 1:
        raise ValueError('Wood revision only permits the balcony-door-matched partition and one north return')
    if set(old_ops) != set(new_ops):
        raise ValueError('Do not add/remove unrelated openings in the wood fitout refresh')
    changed_ops = {key for key in old_ops if old_ops[key] != new_ops[key]}
    if changed_ops != {'balcony_door'}:
        raise ValueError('Only the balcony sliding door may change with this partition')
    for obj in list(bpy.context.scene.objects):
        own_wall = obj.get('wallIndex') in changed
        own_skirting = any(obj.name.startswith(f'Skirting {i:02}') for i in changed)
        if own_wall or own_skirting or obj.get('openingId') == 'balcony_door':
            bpy.data.objects.remove(obj, do_unlink=True)
    indices = changed+added
    subset = {**data, 'walls': [data['walls'][index] for index in indices]}
    openings = [op for op in b.load_openings(data) if op['id'] == 'balcony_door']
    before = set(bpy.context.scene.objects)
    b.wall_and_openings(subset, openings)
    for obj in set(bpy.context.scene.objects)-before:
        if obj.get('kind') == 'wall':
            if 'wallIndex' in obj:
                local = obj['wallIndex']
            else:
                local = int(obj.name.split()[1].split('.')[0])
            index = indices[local]
            obj['wallIndex'] = index
            obj['external'] = False
            obj.name = obj.name.replace(f'Wall {local:02}', f'Wall {index:02}', 1).replace(f'Skirting {local:02}', f'Skirting {index:02}', 1)
        obj['woodPartitionRevisionId'] = revision_id(data)
    old_rooms = {room['id']: room for room in old['rooms']}
    for room in data['rooms']:
        if room['points'] == old_rooms[room['id']]['points']:
            continue
        if room['id'] not in ('living', 'balcony'):
            raise ValueError('Only living/balcony ceiling boundaries may move')
        for obj in list(bpy.context.scene.objects):
            if obj.get('kind') == 'ceiling' and obj.get('roomId') == room['id']:
                bpy.data.objects.remove(obj, do_unlink=True)
        ceiling = b.polygon_mesh('Ceiling / '+room['id'], room['points'], b.room_height(data, room), 'Wall', 'ceiling', room['id'])
        ceiling.data.flip_normals()
        ceiling.hide_set(True)
        ceiling.hide_render = True
        ceiling['woodPartitionRevisionId'] = revision_id(data)


def translate_purchased(old, data):
    """Preserve manufacturer-envelope meshes; only change approved placement."""
    def key(f):
        return str(f.get('id') or f.get('furnitureId') or f['name'])
    previous = {key(f): f for f in old['furniture'] if f.get('purchasedProductId')}
    for f in data['furniture']:
        if not f.get('purchasedProductId'):
            continue
        old_f = previous[key(f)]
        for field in ('w', 'd', 'heightCm', 'face', 'purchasedProductId'):
            if f.get(field) != old_f.get(field):
                raise ValueError('Cannot resize/rotate purchased furniture in pose-only refresh: '+key(f))
        dx, dy = f['x']-old_f['x'], f['y']-old_f['y']
        if dx or dy:
            if f['purchasedProductId'] != 'ikea-vimle-39635114':
                raise ValueError('Only purchased sofa placement is scoped in this revision')
            matches = [obj for obj in bpy.context.scene.objects if obj.get('purchasedProductId') == f['purchasedProductId'] and obj.get('furnitureId') == key(f)]
            assert matches, 'Purchased sofa meshes not found'
            for obj in matches:
                obj.location += Vector((dx/100, -dy/100, 0))
                obj['woodRevisionPoseOnly'] = True
                obj['poseTranslationCm'] = [dx, dy, 0]
        if 'rugCm' in f:
            rug, old_rug = f['rugCm'], old_f['rugCm']
            if any(rug[k] != old_rug[k] for k in ('w', 'd')):
                raise ValueError('Living rug is pose-only, not resized')
            rx, ry = rug['x']-old_rug['x'], rug['y']-old_rug['y']
            if rx or ry:
                rugs = [obj for obj in bpy.context.scene.objects if obj.get('purchasedFurnitureRug')]
                assert len(rugs) == 1, 'Expected one purchased-sofa rug'
                rugs[0].location += Vector((rx/100, -ry/100, 0))
                rugs[0]['woodRevisionPoseOnly'] = True
                rugs[0]['poseTranslationCm'] = [rx, ry, 0]


def translate_living(old, data):
    """Move the unchanged coffee/TV ensembles and floor lamp with circulation."""
    for name in ('茶几', '电视薄柜'):
        prior = next(f for f in old['furniture'] if f['name'] == name)
        current = next(f for f in data['furniture'] if f['name'] == name)
        if any(prior.get(key) != current.get(key) for key in ('w', 'd', 'face')):
            raise ValueError('Living fitout translation cannot resize furniture: '+name)
        dx, dy = current['x']-prior['x'], current['y']-prior['y']
        for obj in bpy.context.scene.objects:
            if obj.get('furnitureName') == name:
                obj.location += Vector((dx/100, -dy/100, 0))
                obj['woodRevisionPoseOnly'] = True
                obj['poseTranslationCm'] = [dx, dy, 0]
    target = data.get('modelAddons', {}).get('livingFloorLampCm')
    if target:
        prior = old.get('modelAddons', {}).get('livingFloorLampCm', {'x': 648, 'y': 898})
        dx, dy = target['x']-prior['x'], target['y']-prior['y']
        names = ('Lamp base', 'Lamp upright', 'Pleated linen lampshade', 'Warm lamp bulb')
        lamps = [obj for obj in bpy.context.scene.objects
                 if obj.type == 'MESH' and obj.get('roomId') == 'living'
                 and not obj.get('furnitureId') and any(obj.name.startswith(name) for name in names)
                 and abs(obj.location.x-prior['x']/100) < .001
                 and abs(obj.location.y+prior['y']/100) < .001]
        assert len(lamps) == 4, 'Expected the four original living floor-lamp parts'
        for obj in lamps:
            obj.location += Vector((dx/100, -dy/100, 0))
            obj['woodRevisionPoseOnly'] = True
            obj['poseTranslationCm'] = [dx, dy, 0]


def shift_main_shower_screen(old, data):
    """Keep the tray/plumbing intact; open the north approach to the shower."""
    current = next(f for f in data['furniture'] if f['name'] == '主卫淋浴区')
    if current.get('screenAnchor') != 'south':
        return
    previous = next(f for f in old['furniture'] if f['name'] == '主卫淋浴区')
    if any(current[k] != previous[k] for k in ('x', 'y', 'w', 'd')):
        raise ValueError('Shower screen-only refresh must keep tray footprint unchanged')
    length = min(60, previous['d']-67)
    if current.get('screenLengthCm') != length:
        raise ValueError('Shower screen-only refresh cannot resize the old screen')
    north_start = previous['y']+2
    south_end = current['y']+current['d']-2
    names = ('Clear shower folding screen', 'Shower glass upright')
    matches = [obj for obj in bpy.context.scene.objects
               if obj.get('furnitureName') == '主卫淋浴区' and any(obj.name.startswith(name) for name in names)]
    assert len(matches) == 2, 'Expected precisely the main-shower screen and upright'
    for obj in matches:
        delta = (south_end if obj.name.startswith('Shower glass upright') else south_end-length)-north_start
        obj.location.y -= delta/100
        obj['woodRevisionPoseOnly'] = True
        obj['poseTranslationCm'] = [0, delta, 0]
        obj['showerScreenAnchor'] = 'south'
        obj['showerScreenLengthCm'] = length


def finish_palette(data):
    """Change actual materials/textures, while preserving product-specific mats."""
    b.MATS.clear()
    b.MATS.update({m.name: m for m in bpy.data.materials})
    colors = {
        'Oak': (.76, .66, .52), 'OakLight': (.82, .73, .60),
        'Wall': (.91, .90, .86), 'Cream': (.91, .89, .84),
        'Linen': (.82, .80, .75), 'WhiteLinen': (.93, .92, .88),
        'Stone': (.84, .83, .78), 'Tile': (.84, .83, .79),
        'Grout': (.75, .74, .70), 'Sage': (.47, .53, .46),
        'RollerFabric': (.90, .89, .85), 'Lamp': (1., .93, .82),
    }
    colors.update(data['woodRevision'].get('materialColors', {}))
    b.TEX_DIR.mkdir(parents=True, exist_ok=True)
    for name, rgb in colors.items():
        if isinstance(rgb, str):
            value = rgb.removeprefix('#')
            if len(value) != 6:
                raise ValueError('Material colour must be #RRGGBB: '+str(rgb))
            srgb = tuple(int(value[index:index+2], 16)/255 for index in (0, 2, 4))
            rgb = tuple(c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in srgb)
        if name not in b.MATS:
            continue
        mat = b.MATS[name]
        mat.diffuse_color = (*rgb, 1)
        bs = mat.node_tree.nodes.get('Principled BSDF')
        bs.inputs['Base Color'].default_value = (*rgb, 1)
        if name == 'Lamp':
            bs.inputs['Emission Color'].default_value = (*rgb, 1)
        if name in ('Oak', 'OakLight', 'Linen', 'Stone'):
            kind = 'wood' if name.startswith('Oak') else 'linen' if name == 'Linen' else 'stone'
            image = b.texture_image('wood39-'+name.lower(), rgb, kind)
            nodes = [n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE']
            if nodes:
                for node in nodes:
                    node.image = image
            else:
                node = mat.node_tree.nodes.new('ShaderNodeTexImage')
                node.image = image
                mat.node_tree.links.new(node.outputs['Color'], bs.inputs['Base Color'])
        if name == 'Tile':
            bs.inputs['Roughness'].default_value = .72
            # Tiles are matte porcelain, never recoloured timber boards.
            for link in list(mat.node_tree.links):
                if link.to_socket == bs.inputs['Base Color']:
                    mat.node_tree.links.remove(link)
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH' or obj.get('purchasedProductId'):
            continue
        if obj.get('kind') == 'door' and obj.get('doorRole') == 'door-floor':
            obj.data.materials.clear()
            obj.data.materials.append(b.MATS['Tile'])


def tile_floors(data):
    spec = data['woodRevision'].get('floorFinish', {})
    for room in data['rooms']:
        rid, pts = room['id'], room['points']
        wet = room.get('tone') in ('wet', 'kitchen', 'balcony')
        size = float(spec.get('wetTileSizeCm', 30) if wet else spec.get('tileSizeCm', 60))
        if size <= 0:
            raise ValueError('Invalid tile size')
        ground = b.polygon_mesh('Porcelain grout / '+rid, pts, -.006, 'Grout', 'floor', rid)
        ground['floorFinish'] = 'porcelain-tile'
        ground['tileSizeCm'] = size
        ground['woodRevisionId'] = revision_id(data)
        minx, miny = min(p[0] for p in pts), min(p[1] for p in pts)
        maxx, maxy = max(p[0] for p in pts), max(p[1] for p in pts)
        x = minx
        while x < maxx:
            y = miny
            while y < maxy:
                pp = pts
                for axis, edge, greater in ((0, x+.1, True), (0, x+size-.1, False),
                                            (1, y+.1, True), (1, y+size-.1, False)):
                    pp = b.clip_polygon(pp, axis, edge, greater)
                if len(pp) >= 3:
                    obj = b.polygon_mesh('Matte porcelain tile / '+rid, pp, 0, 'Tile', 'floor', rid)
                    obj['floorFinish'] = 'porcelain-tile'
                    obj['tileSizeCm'] = size
                    obj['woodRevisionId'] = revision_id(data)
                y += size
            x += size


def nightstand(f):
    x, y, w, d = [f[k]/100 for k in ('x', 'y', 'w', 'd')]
    h = float(f.get('heightCm', 48))/100
    b.block('Bedside cabinet recessed base', x+.025, y+.025, 0, w-.05, d-.05, .09, mat='Oak', bevel=.004)
    b.block('Bedside cabinet wood carcass', x, y, .09, w, d, h-.09, mat='OakLight', bevel=.01)
    face = f.get('face', 'south')
    for level in (0, 1):
        z = .105+level*(h-.13)/2
        hh = (h-.15)/2
        if face in ('east', 'west'):
            xx = x+w-.009 if face == 'east' else x+.009
            b.box('Bedside cream drawer', xx, y+d/2, z, .016, d-.022, hh, 'Cream', .003)
        else:
            yy = y+d-.009 if face == 'south' else y+.009
            b.box('Bedside cream drawer', x+w/2, yy, z, w-.022, .016, hh, 'Cream', .003)


def compact_desk(f):
    x, y, w, d = [f[k]/100 for k in ('x', 'y', 'w', 'd')]
    h = float(f.get('heightCm', 75))/100
    b.block('Compact pale-wood desktop', x, y, h-.028, w, d, .028, mat='OakLight', bevel=.007)
    for px in (x+.025, x+w-.025):
        for py in (y+.025, y+d-.025):
            b.box('Compact desk leg', px, py, 0, .032, .032, h-.028, 'Oak', .003)
    # No implicit desktop monitor, lamp or extra chair outside the stated box.


def supported_chair(f):
    b.chair(f)
    x, y, w, d = [f[k]/100 for k in ('x', 'y', 'w', 'd')]
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.cylinder('Chair protective floor foot', x+w/2+sx*w*.39,
                       y+d/2+sy*d*.34, 0, .018, .025, 'WarmGrayMetal', vertices=16)


def full_study_desk(f):
    x, y, w, d = [f[k]/100 for k in ('x', 'y', 'w', 'd')]
    h = float(f.get('heightCm', 76))/100
    b.block('Study wall-to-wall desktop', x, y, h-.03, w, d, .03, mat='OakLight', bevel=.007)
    for px in (x, x+w-.025):
        b.block('Study cream end gable', px, y, 0, .025, d, h-.03, mat='Cream', bevel=.003)
    for py in (y+.045, y+d-.045):
        b.box('Study recessed desk underframe', x+w/2, py, h-.07, w-.05, .025, .04, 'WarmGrayMetal', .002)
    b.box('Study intermediate desk support', x+w*.37, y+d-.06, 0, .03, .03, h-.03, 'WarmGrayMetal', .002)


def study_sofa(f):
    x, y, w, d = [f[k]/100 for k in ('x', 'y', 'w', 'd')]
    h = float(f.get('heightCm', 78))/100
    for px in (x+.08, x+w-.08):
        for py in (y+.08, y+d-.08):
            b.box('Compact study sofa recessed foot', px, py, 0, .06, .06, .11, 'Oak', .004)
    b.block('Compact study sofa base', x, y, .10, w, d, .25, mat='Linen', bevel=.06)
    b.block('Compact study sofa NORTH back', x, y, .24, w, .16, h-.24, mat='Linen', bevel=.04)
    for px in (x+.06, x+w-.06):
        b.box('Compact study sofa arm', px, y+d/2, .29, .12, d-.025, .29, 'Linen', .045)
    for i in range(2):
        b.block('Compact study sofa cushion', x+.13+i*(w-.26)/2, y+.17, .36,
                (w-.26)/2-.01, d-.19, .13, mat='Cream', bevel=.035)


def cream_cabinet(f):
    before = set(bpy.context.scene.objects)
    b.cabinet(f, float(f.get('heightCm', 235))/100)
    x, y, w, d = [f[k]/100 for k in ('x', 'y', 'w', 'd')]
    for xx in (x+.05, x+w-.05):
        for yy in (y+.05, y+d-.05):
            b.box('Recessed wardrobe levelling foot', xx, yy, 0, .04, .04, .018, 'WarmGrayMetal', .002)
    for obj in set(bpy.context.scene.objects)-before:
        if ' door' in obj.name and 'track' not in obj.name:
            obj.data.materials.clear()
            obj.data.materials.append(b.MATS['Cream'])


def north_toilet(f):
    before = set(bpy.context.scene.objects)
    b.toilet(f)
    face = f.get('face', 'south')
    if face not in ('north', 'south'):
        raise ValueError('Only north/south toilets supported by this fitout')
    x, y, w, d = [f[k]/100 for k in ('x', 'y', 'w', 'd')]
    bpy.context.view_layer.update()
    if face == 'north':
        center = Vector((x+w/2, -(y+d/2), 0))
        transform = Matrix.Translation(center) @ Matrix.Rotation(math.pi, 4, 'Z') @ Matrix.Translation(-center)
        for obj in set(bpy.context.scene.objects)-before:
            obj.matrix_world = transform @ obj.matrix_world
    for obj in set(bpy.context.scene.objects)-before:
        obj['toiletFace'] = face
        obj['ceramicFootprintCm'] = [f[k] for k in ('x', 'y', 'w', 'd')]
        obj['cisternEnvelopeCm'] = [f['x']-5.5, f['y']+f['d']-11 if face == 'north' else f['y']-.5, f['w']+11, 11.5]


def selected_furniture(data):
    for f in data['furniture']:
        if not selected(f, data) or f.get('laundryFitoutId'):
            continue
        rid = fixture_room(f, data)
        b.CURRENT_ROOM = rid
        before = set(bpy.context.scene.objects)
        role = f.get('woodRole', '')
        n = f['name']
        if role == 'nightstand' or '床头柜' in n:
            nightstand(f)
        elif role in ('compact-desk', 'compact_desk'):
            compact_desk(f)
        elif role in ('study-desk', 'study_desk', 'wall-desk') or f.get('id') == 'study_full_desk':
            full_study_desk(f)
        elif role in ('study-sofa', 'study_sofa') or '沙发' in n:
            study_sofa(f)
        elif '床' in n and '柜' not in n:
            b.bed(f, '日床' in n)
        elif '衣柜' in n:
            cream_cabinet(f)
        elif role == 'chair' or '椅' in n:
            supported_chair(f)
        elif '桌' in n:
            compact_desk(f)
        elif '浴室柜' in n:
            b.basin(*[f[k]/100 for k in ('x', 'y', 'w', 'd')], face=f.get('face', 'south'))
        elif '马桶' in n:
            north_toilet(f)
        else:
            raise ValueError('Unsupported changed furniture: '+str(f))
        for obj in set(bpy.context.scene.objects)-before:
            obj['furnitureId'] = str(f.get('id') or n)
            obj['furnitureName'] = n
            obj['furnitureFace'] = f.get('face', '')
            obj['woodRole'] = role
            obj['woodRevisionId'] = revision_id(data)
            obj['roomId'] = rid
    b.bay_fitouts({**data, 'bayFitouts': [f for f in data.get('bayFitouts', []) if f['roomId'] == 'room_a']})
    for fit in data.get('wallFitouts', []):
        if fit['roomId'] != 'room_c':
            continue
        for p in fit['parts']:
            obj = b.block(fit['id']+' / '+p['id'], p['x']/100, p['y']/100, p['zCm']/100,
                          p['w']/100, p['d']/100, p['hCm']/100, mat=p['material'], bevel=.001,
                          kind='furniture', room=fit['roomId'])
            obj['wallFitoutId'] = fit['id']
            obj['wallPartId'] = p['id']
            obj['wallPartRole'] = p['role']
            obj['furnitureId'] = fit['id']
            obj['furnitureFace'] = fit.get('face', 'north')
            obj['woodRevisionId'] = revision_id(data)


def shallow_basin(l):
    p = l['basin']
    x, y, w, d = [p[k]/100 for k in ('x', 'y', 'w', 'd')]
    z, top = p['bottomCm']/100, p['rimCm']/100
    b.block('Shallow basin bottom', x+.025, y+.025, z, w-.05, d-.05, .016, mat='Ceramic', bevel=.008)
    for xx in (x, x+w-.025):
        b.block('Shallow basin side', xx, y, z, .025, d, top-z, mat='Ceramic', bevel=.005)
    for yy in (y, y+d-.055):
        b.block('Shallow basin front/rear rim', x+.025, yy, z, w-.05, .055, top-z, mat='Ceramic', bevel=.005)
    dx, dy = [p['drain'][k]/100 for k in ('x', 'y')]
    b.cylinder('Rear-offset basin drain cover', dx, dy, z+.017, .022, .005, 'WarmGrayMetal')
    tx, ty = [p['tap'][k]/100 for k in ('x', 'y')]
    b.rod('Laundry faucet riser', (tx, ty, top), (tx, ty, top+.20), .013, 'WarmGrayMetal')
    b.rod('Laundry faucet spout', (tx, ty, top+.20), (tx, ty-.13, top+.20), .013, 'WarmGrayMetal')
    b.rod('Laundry faucet outlet', (tx, ty-.13, top+.20), (tx, ty-.13, top+.15), .013, 'WarmGrayMetal')
    # Root data must explicitly place all accessible service pipe segments;
    # unlike the old helper there is no hard-coded route through a machine.
    for index, segment in enumerate(l.get('drainRouteCm', [])):
        b.rod('Provisional accessible drain '+str(index), tuple(c/100 for c in segment['from']),
              tuple(c/100 for c in segment['to']), float(segment.get('radiusCm', 2.1))/100, 'Cream')


def parallel_laundry(data):
    l = data['laundry']
    b.CURRENT_ROOM = 'balcony'
    for p in l['parts']:
        obj = b.block('Wood laundry / '+p['id'], p['x']/100, p['y']/100, p['zCm']/100,
                      p['w']/100, p['d']/100, p['hCm']/100, mat=p['material'], bevel=.001, room='balcony')
        obj['laundryPartId'] = p['id']
        obj['laundryRole'] = p['role']
        obj['laundryId'] = l['id']
        obj['woodRevisionId'] = revision_id(data)
    for f in l['machines']:
        before = set(bpy.context.scene.objects)
        laundry_scope['appliance'](f)
        for obj in set(bpy.context.scene.objects)-before:
            obj['laundryMachineId'] = f['id']
            obj['furnitureId'] = f['id']
            obj['furnitureName'] = f.get('name', f['id'])
            obj['woodRole'] = 'laundry-machine'
            obj['woodRevisionId'] = revision_id(data)
            obj['machineEnvelopeCm'] = [f[k] for k in ('x', 'y', 'w', 'd', 'heightCm')]
    before = set(bpy.context.scene.objects)
    shallow_basin(l)
    for obj in set(bpy.context.scene.objects)-before:
        obj['laundryBasin'] = True
        obj['laundryId'] = l['id']
        obj['woodRevisionId'] = revision_id(data)


def configure_views(data):
    # Camera positions are inside rooms, not behind their newly longer closets.
    b.VIEWS['study'] = ((2.65, 4.48, 1.64), (1.30, 5.76, 1.15), 17)
    b.VIEWS['bedroom-b'] = ((.85, 3.09, 1.64), (2.12, 1.15, 1.08), 17)
    b.VIEWS['master'] = ((4.42, 3.05, 1.65), (5.36, 1.34, 1.04), 18)
    b.VIEWS['master-bath'] = ((5.19, 3.52, 1.60), (5.10, 4.43, 1.15), 17)
    b.VIEWS['bay-master'] = ((4.45, 2.92, 1.58), (5.15, .20, 1.05), 18)
    b.VIEWS['balcony'] = ((7.52, 9.81, 1.48), (7.55, 10.65, .97), 17)
    b.VIEWS['laundry-detail'] = ((7.08, 9.81, 1.47), (7.48, 10.70, .95), 17)
    for name, settings in data['woodRevision'].get('views', {}).items():
        b.VIEWS[name] = tuple(settings)


def make_manifest(data):
    b.manifest(data, b.load_openings(data), SOURCE)
    b.kitchen_manifest_detail(data)
    path = b.MODEL_DIR/'scene-manifest.json'
    m = json.loads(path.read_text(encoding='utf-8'))
    m['woodRevision'] = data['woodRevision']
    m['laundry'] = data['laundry']
    m['wallFitouts'] = data.get('wallFitouts', [])
    m['design'].update(style='奶白与浅原木 · 全屋哑光瓷砖', palette=['#eeeae0', '#c2aa86', '#d8d4c8', '#a3a28f'])
    for room in m['rooms']:
        if room['id'] in data['woodRevision'].get('roomDescriptions', {}):
            text = data['woodRevision']['roomDescriptions'][room['id']]
            room['description'] = text.get('description', '') if isinstance(text, dict) else text
        room['features'] = ['同一 Blender 模型生成交互与新渲染', '奶白柜门与浅原木', '全屋哑光瓷砖']
    name = 'laundry-detail'
    pos, target, lens = b.VIEWS[name]
    m.setdefault('layoutDetails', []).append({
        'id': name, 'title': '原阳台内并排洗烘 · 独立支撑浅盆', 'roomId': 'balcony',
        'render': 'assets/schemes/wood/laundry-detail.jpg',
        'interiorCamera': {'position': b.three(pos), 'target': b.three(target),
                           'horizontalFov': round(math.degrees(2*math.atan(36/(2*lens))), 2)},
        'summary': data['laundry'].get('summary', ''), 'conditions': data['laundry'].get('conditions', [])})
    m['notes'] += data['woodRevision'].get('conditions', []) + data['laundry'].get('conditions', [])
    path.write_text(json.dumps(m, ensure_ascii=False, indent=2), encoding='utf-8')


def build(args, data):
    assert BASELINE.is_file() and BASELINE_DATA.is_file(), 'Snapshot the published V3.8 scene/source in tmp/wood-revision-baseline first'
    bpy.ops.wm.open_mainfile(filepath=str(BASELINE))
    b.COLS.clear()
    old = json.loads(BASELINE_DATA.read_text(encoding='utf-8'))
    removed = remove_old_fitout(old)
    finish_palette(data)
    changed_partition(old, data)
    translate_purchased(old, data)
    translate_living(old, data)
    shift_main_shower_screen(old, data)
    tile_floors(data)
    selected_furniture(data)
    parallel_laundry(data)
    for name, settings in b.VIEWS.items():
        if bpy.data.objects.get(name):
            bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)
        b.camera(name, *settings)
    b.configure_render(args)
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            obj.hide_set(False)
            obj.hide_render = obj.get('kind') == 'ceiling'
    bpy.context.scene.camera = bpy.data.objects['overall']
    make_manifest(data)
    bpy.ops.wm.save_as_mainfile(filepath=str(b.MODEL_DIR/'huiyayuan-wood.blend'), compress=True)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH' and obj.get('kind') not in ('ceiling', 'backdrop'):
            obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(b.MODEL_DIR/'huiyayuan-wood.glb'), export_format='GLB', use_selection=True,
        export_apply=True, export_extras=True, export_cameras=False, export_lights=False, export_yup=True,
        export_texcoords=True, export_normals=True, export_materials='EXPORT', export_image_format='AUTO')
    print('WOOD_REVISION_NATIVE_COMPLETE', json.dumps({'removed': len(removed), 'views': list(b.VIEWS)}), flush=True)


def main():
    args = b.parse_args()
    data = json.loads(SOURCE.read_text(encoding='utf-8'))
    assert data.get('woodRevision', {}).get('version') == '3.9.0', 'This builder requires explicit woodRevision 3.9.0'
    configure_views(data)
    if not args.reuse:
        build(args, data)
    if not args.only_build:
        b.render(args)


if __name__ == '__main__':
    main()
