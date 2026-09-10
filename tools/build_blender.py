#!/usr/bin/env python3
"""Build the calibrated apartment as actual Blender / glTF geometry.

Run with Blender 4.2+ (tested workflow targets Blender 4.5 LTS):
  blender --background --python tools/build_blender.py -- --only-build
  blender --background models/huiyayuan-wood.blend --python tools/build_blender.py -- --render living --reuse

All source dimensions are centimetres. Blender positions are (x/100,-y/100,z),
and glTF's built-in Y-up conversion produces Three positions (x,z,plan-y).
The same saved scene is the source of both web geometry and rendered images.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "models"
RENDER_DIR = ROOT / "assets" / "blender-renders"
TEX_DIR = MODEL_DIR / "blender-textures"
HEIGHT, THICK = 2.7, .12
MATS = {}
COLS = {}
CURRENT_ROOM = "living"
RNG = random.Random(42)


def parse_args():
    cli = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--only-build", action="store_true")
    p.add_argument("--render", default="all")
    p.add_argument("--samples", type=int, default=32)
    p.add_argument("--resolution", type=int, default=1600)
    p.add_argument("--engine", choices=["CYCLES", "BLENDER_EEVEE_NEXT"], default="CYCLES")
    p.add_argument("--reuse", action="store_true", help="Render the currently opened .blend without rebuilding")
    return p.parse_args(cli)


def col(name):
    if name not in COLS:
        c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
        if c.name not in bpy.context.scene.collection.children:
            bpy.context.scene.collection.children.link(c)
        COLS[name] = c
    return COLS[name]


def tag(obj, name, kind="furniture", room=None, collection=None):
    obj.name = name
    obj["kind"] = kind
    obj["roomId"] = room or CURRENT_ROOM
    if collection:
        for c in list(obj.users_collection):
            c.objects.unlink(obj)
        col(collection).objects.link(obj)
    return obj


def material(name, color, rough=.6, metal=0, texture=None, emission=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color, 1)
    bs = mat.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = (*color, 1)
    bs.inputs["Roughness"].default_value = rough
    bs.inputs["Metallic"].default_value = metal
    if texture:
        t = mat.node_tree.nodes.new("ShaderNodeTexImage")
        t.image = texture
        mat.node_tree.links.new(t.outputs["Color"], bs.inputs["Base Color"])
    if emission:
        bs.inputs["Emission Color"].default_value = (*color, 1)
        bs.inputs["Emission Strength"].default_value = emission
    MATS[name] = mat
    return mat


def texture_image(name, rgb, kind):
    size = 512
    yy, xx = np.mgrid[0:size, 0:size].astype(float) / size
    rng = np.random.default_rng(18)
    noise = rng.normal(0, 1, (size, size))
    if kind == "wood":
        wave = xx * 70 + .25 * np.sin(yy * 18) + .13 * np.sin(yy * 54 + xx * 3)
        grain = .026 * np.sin(wave * math.pi * 2) + .012 * np.sin(wave * math.pi * 7) + noise * .009
    elif kind == "linen":
        grain = .018 * np.sin(xx * math.pi * 260) + .016 * np.sin(yy * math.pi * 290) + noise * .009
    else:
        grain = .009 * np.sin(xx * 34 + np.sin(yy * 17)) + noise * .009
    pix = np.ones((size, size, 4), dtype=np.float32)
    pix[:, :, :3] = np.clip(np.array(rgb)[None, None, :] + grain[:, :, None], 0, 1)
    img = bpy.data.images.new(name, width=size, height=size)
    img.pixels.foreach_set(pix.ravel())
    img.filepath_raw = str(TEX_DIR / (name + ".png"))
    img.file_format = "PNG"
    img.save()
    img.pack()
    return img


def setup_materials():
    TEX_DIR.mkdir(parents=True, exist_ok=True)
    oak = texture_image("pale-oak", (.69, .53, .35), "wood")
    linen = texture_image("warm-linen", (.80, .76, .67), "linen")
    stone = texture_image("warm-limestone", (.73, .70, .64), "stone")
    material("Oak", (.69, .53, .35), texture=oak)
    material("OakLight", (.77, .63, .45), texture=oak)
    material("Walnut", (.25, .16, .09))
    material("Wall", (.83, .81, .76), .85)
    material("Cream", (.85, .82, .75), .7)
    material("Linen", (.80, .76, .67), .86, texture=linen)
    material("WhiteLinen", (.88, .86, .80), .9)
    material("Sage", (.43, .51, .40), .86)
    material("Terracotta", (.63, .35, .23), .8)
    material("Stone", (.73, .70, .64), .65, texture=stone)
    material("Tile", (.73, .73, .68), .56)
    material("Grout", (.60, .59, .55), .9)
    material("Ceramic", (.89, .90, .88), .23)
    material("Chrome", (.45, .47, .46), .23, .92)
    material("Brass", (.49, .33, .14), .3, .8)
    material("Charcoal", (.035, .04, .036), .5)
    material("WindowMetal", (.38, .37, .33), .34, .66)
    material("WarmGrayMetal", (.49, .48, .43), .43, .50)
    material("RollerFabric", (.85, .83, .77), .9)
    material("GlassDark", (.032, .045, .05), .17, .28)
    material("Leaf", (.18, .30, .12), .64)
    material("LeafLight", (.30, .43, .17), .7)
    material("Lamp", (1.0, .78, .49), .35, emission=3)
    glass = material("Glass", (.83, .91, .93), .12)
    bs = glass.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Transmission Weight"].default_value = 1
    bs.inputs["IOR"].default_value = 1.45
    bs.inputs["Alpha"].default_value = .22
    if hasattr(glass, "surface_render_method"):
        glass.surface_render_method = "DITHERED"
    mirror = material("Mirror", (.83, .87, .87), .045, 1)
    return mirror


def finish(obj, name, mat, bevel=0, kind="furniture", room=None, collection=None):
    tag(obj, name, kind, room, collection)
    obj.data.materials.append(MATS[mat] if isinstance(mat, str) else mat)
    if bevel:
        mod = obj.modifiers.new("Soft manufactured edges", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        mod.limit_method = "ANGLE"
        mod = obj.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
        mod.keep_sharp = True
    return obj


def box(name, cx, cy, z, w, d, h, mat="Oak", bevel=.008, kind="furniture", room=None, collection=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, -cy, z + h / 2))
    obj = bpy.context.object
    obj.dimensions = (w, d, h)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, bevel, kind, room, collection)


def block(name, x, y, z, w, d, h, **kwargs):
    return box(name, x + w/2, y + d/2, z, w, d, h, **kwargs)


def sphere(name, x, y, z, sx, sy, sz, mat="Linen", kind="furniture"):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, location=(x, -y, z))
    obj = bpy.context.object
    obj.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for p in obj.data.polygons:
        p.use_smooth = True
    return finish(obj, name, mat, kind=kind)


def cylinder(name, x, y, z, radius, h, mat="Oak", r2=None, vertices=32):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=radius if r2 is None else r2, depth=h, location=(x, -y, z+h/2))
    obj = bpy.context.object
    for p in obj.data.polygons:
        p.use_smooth = len(p.vertices) == 4
    return finish(obj, name, mat, .005)


def rod(name, start, end, radius=.008, mat="Chrome"):
    a = Vector((start[0], -start[1], start[2]))
    b = Vector((end[0], -end[1], end[2]))
    delta = b-a
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=radius, depth=delta.length, location=(a+b)/2)
    obj = bpy.context.object
    obj.rotation_euler = delta.to_track_quat("Z", "Y").to_euler()
    return finish(obj, name, mat, .002)


def point_in_poly(x, y, points):
    inside = False
    j = len(points) - 1
    for i, (xi, yi) in enumerate(points):
        xj, yj = points[j]
        if (yi > y) != (yj > y) and x < (xj-xi)*(y-yi)/(yj-yi) + xi:
            inside = not inside
        j = i
    return inside


def room_at(x, y, rooms):
    for room in rooms:
        if point_in_poly(x*100, y*100, room["points"]):
            return room["id"]
    return "living"


def polygon_mesh(name, points, z, mat, kind, room):
    verts = [(x/100, -y/100, z) for x, y in points]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], [list(reversed(range(len(verts))))])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    finish(obj, name, mat, kind=kind, room=room)
    uv = mesh.uv_layers.new(name="UVMap")
    for p in mesh.polygons:
        for li in p.loop_indices:
            co = mesh.vertices[mesh.loops[li].vertex_index].co
            uv.data[li].uv = (co.x*.8, co.y*.8)
    return obj


def clip_polygon(poly, axis, edge, greater):
    result = []
    if not poly:
        return result
    prev = poly[-1]
    pin = prev[axis] >= edge if greater else prev[axis] <= edge
    for curr in poly:
        cin = curr[axis] >= edge if greater else curr[axis] <= edge
        if cin != pin:
            t = (edge-prev[axis])/(curr[axis]-prev[axis])
            result.append((prev[0]+t*(curr[0]-prev[0]), prev[1]+t*(curr[1]-prev[1])))
        if cin:
            result.append(curr)
        prev, pin = curr, cin
    return result


def floors(data):
    for room in data["rooms"]:
        rid, pts = room["id"], room["points"]
        polygon_mesh("Floor / " + rid, pts, -.006, "Grout", "floor", rid)
        wet = room["tone"] in ("wet", "kitchen", "balcony")
        dx, dy = (60, 60) if wet else (18, 140)
        minx, miny = min(p[0] for p in pts), min(p[1] for p in pts)
        maxx, maxy = max(p[0] for p in pts), max(p[1] for p in pts)
        row = 0
        x = minx
        while x < maxx:
            y = miny - (0 if wet else (row%3)*46)
            while y < maxy:
                pp = pts
                for ax, edge, gr in ((0,x+.10,True),(0,x+dx-.10,False),(1,y+.10,True),(1,y+dy-.10,False)):
                    pp = clip_polygon(pp, ax, edge, gr)
                if len(pp) >= 3:
                    polygon_mesh("Tile" if wet else "Oak floorboard", pp, 0, "Tile" if wet else "Oak", "floor", rid)
                y += dy
            row += 1
            x += dx
        ceiling = polygon_mesh("Ceiling / " + rid, pts, HEIGHT, "Wall", "ceiling", rid)
        ceiling.hide_render = True
        ceiling.hide_set(True)
        # Ceiling faces must point down for interiors.
        ceiling.data.flip_normals()


def load_openings(data):
    xml = ET.parse(MODEL_DIR / "Home.xml").getroot()
    heights = {e.get("id"): (float(e.get("elevation", 0))/100, float(e.get("height", 215))/100) for e in xml.findall("doorOrWindow")}
    shared = {}
    for src in data.get("windows", []) + data.get("doors", []) + data.get("openings", []):
        shared.setdefault(src["id"], {}).update(src)
    overrides = {}
    override_file = MODEL_DIR / "blender-overrides.json"
    if override_file.exists():
        overrides = {op["id"]: op for op in json.loads(override_file.read_text(encoding="utf-8")).get("openings", [])}
    openings = []
    for oid in list(shared) + [key for key in overrides if key not in shared]:
        # Explicit shared geometry wins over legacy overrides. Merge bay
        # metadata as well, so its type/projection cannot silently disappear.
        op = dict(overrides.get(oid, {}))
        op.update(shared.get(oid, {}))
        if "bay" in op:
            op["bay"] = {**overrides.get(oid, {}).get("bay", {}), **shared.get(oid, {}).get("bay", {})}
        for nested in ("windowDesign", "rollerBlind"):
            if nested in op:
                op[nested] = {**overrides.get(oid, {}).get(nested, {}), **shared.get(oid, {}).get(nested, {})}
        default = (.9, 1.4) if op["kind"] == "window" else (0, 2.15)
        op["sill"], op["height"] = heights.get(op["id"], default)
        op["sill"] = float(op.get("sillCm", op["sill"]*100))/100
        op["height"] = float(op.get("heightCm", op["height"]*100))/100
        openings.append(op)
    return openings


def geometry_bounds(data, openings):
    """Three-space bounds include projecting bay shells, not room floor area."""
    plan_points = [[x/100,y/100] for x,y in data["envelope"]]
    highest = float(data.get("wallHeightCm",270))/100
    thickness = float(data.get("wallThicknessCm",12))/100
    for op in openings:
        if op.get("windowType")!="bay":continue
        b=op["bay"]
        x1,y1,x2,y2=[op[k]/100 for k in ("x1","y1","x2","y2")]
        length=math.hypot(x2-x1,y2-y1)
        tangent=((x2-x1)/length,(y2-y1)/length)
        outward=b["outward"]
        halfwidth=length/2+float(b.get("returnThicknessCm",10))/100
        front=thickness/2+float(b["projectionCm"])/100+.05
        for along in (-halfwidth,halfwidth):
            for depth in (thickness/2,front):
                plan_points.append([(x1+x2)/2+tangent[0]*along+outward[0]*depth,(y1+y2)/2+tangent[1]*along+outward[1]*depth])
        highest=max(highest,op["sill"]+op["height"]+float(b.get("slabThicknessCm",10))/100)
    return {"min":[round(min(p[0] for p in plan_points),5),-.012,round(min(p[1] for p in plan_points),5)],"max":[round(max(p[0] for p in plan_points),5),round(highest,5),round(max(p[1] for p in plan_points),5)]}


def bay_opening_details(op):
    """Build a true hollow outward bay, retaining the original wall opening.

    White side returns are an explicitly unverified solid-side assumption.
    They sit outside the aperture ends, so the original clear width survives.
    The sill height is read verbatim: a proposed low sill must carry its
    explicit condition metadata in the shared source, never an inferred cut.
    """
    x1,y1,x2,y2=[op[k]/100 for k in ("x1","y1","x2","y2")]
    length=math.hypot(x2-x1,y2-y1)
    cx,cy=(x1+x2)/2,(y1+y2)/2
    tx,ty=(x2-x1)/length,(y2-y1)/length
    b=op["bay"]
    nx,ny=b["outward"]
    if abs(nx*tx+ny*ty)>.0001 or abs(nx*nx+ny*ny-1)>.0001:
        raise ValueError(f"Invalid perpendicular unit bay direction for {op['id']}")
    if b.get("sideStyle","solid")!="solid":
        raise ValueError("Only explicitly provisional solid return walls are modeled")
    projection=float(b["projectionCm"])/100
    returns=float(b.get("returnThicknessCm",10))/100
    slab=float(b.get("slabThicknessCm",10))/100
    sill,h=op["sill"],op["height"]
    outer=THICK/2
    front=outer+projection
    edge=front+.05
    frame=.030
    def part(label,along,depth,z,width,depth_size,height,mat,role,bevel=.003):
        px,py=cx+tx*along+nx*depth,cy+ty*along+ny*depth
        ob=box(op["id"]+" / bay "+label,px,py,z,width if abs(tx)>.5 else depth_size,depth_size if abs(tx)>.5 else width,height,mat,bevel,"window")
        ob["openingId"]=op["id"]
        ob["windowType"]="bay"
        ob["bayRole"]=role
        ob["bayProjectionCm"]=float(b["projectionCm"])
        ob["windowSystemStatus"]="proposal / external alteration approval unverified"
        if "baselineSillCm" in op:ob["baselineSillCm"]=float(op["baselineSillCm"])
        if "baselineSillCm" in b:ob["baselineSillCm"]=float(b["baselineSillCm"])
        return ob
    # Jambs, head, and sill meet rather than overlapping coplanar surfaces.
    for sign in (-1,1):
        part("slim metal front jamb",sign*(length/2-frame/2),front,sill+frame,frame,.10,h-2*frame,"WindowMetal","frontFrame")
    part("slim metal front head",0,front,sill+h-frame,length,.10,frame,"WindowMetal","frontFrame")
    part("slim metal front sill",0,front,sill,length,.10,frame,"WindowMetal","frontFrame")
    # Two large panes with one necessary centre member, not a decorative grid.
    part("single centre mullion",0,front,sill+frame,.030,.10,h-2*frame,"WindowMetal","frontFrame")
    pane_w=(length-3*frame)/2
    for sign in (-1,1):
        part("clear glazing panel",sign*(frame/2+pane_w/2),front,sill+frame,pane_w,.007,h-2*frame,"Glass","frontGlazing",.001)
    for sign in (-1,1):
        ob=part("solid return",sign*(length/2+returns/2),(outer+edge)/2,sill-.02,returns,edge-outer,h+.02,"Wall","return",.001)
        ob["baySide"]="left" if sign<0 else "right"
        ob["assumptionGrade"]=b.get("grade","C")
    part("cantilever bottom slab",0,(outer+edge)/2,sill-.02-slab,length+2*returns,edge-outer,slab,"Wall","bottomSlab",.001)
    part("top slab",0,(outer+edge)/2,sill+h,length+2*returns,edge-outer,slab,"Wall","topSlab",.001)
    # Outside stone rests between side returns; the thin indoor finish sits
    # 0.5 mm above the existing structural sill to avoid a coplanar black face.
    part("deep exterior stone sill",0,(outer+edge)/2,sill-.02,length,edge-outer,.02,"Stone","stoneSill",.001)
    inner=-THICK/2-.025
    part("connected indoor stone finish",0,(inner+outer)/2,sill+.0005,length,outer-inner,.0005,"Stone","stoneSill",0)
    # A shallow cordless roller sits within the reveal, without cutting the
    # lintel/top slab. Its opening-sash clearance remains a product check.
    blind=op.get("rollerBlind",{})
    blind_depth=outer+.065
    cassette_h=.065
    blind_top=sill+h-.012
    drop=min(max(float(blind.get("dropCm",28))/100,.08),h-cassette_h-.08)
    part("cordless roller cassette",0,blind_depth,blind_top-cassette_h,length-.045,.085,cassette_h,"Cream","rollerCassette",.007)
    part("inset roller fabric",0,blind_depth-.034,blind_top-cassette_h-drop,length-.065,.004,drop,"RollerFabric","rollerFabric",.001)
    part("roller bottom hem",0,blind_depth-.034,blind_top-cassette_h-drop-.012,length-.065,.014,.012,"WindowMetal","rollerHem",.003)


def wall_and_openings(data, openings):
    global CURRENT_ROOM
    for idx, raw in enumerate(data["walls"]):
        coords = raw.get("coords", raw) if isinstance(raw, dict) else raw
        ax, ay, bx, by = [v/100 for v in coords]
        horizontal = abs(by-ay) < .001
        start, end = sorted((ax, bx) if horizontal else (ay, by))
        fixed = ay if horizontal else ax
        midx, midy = (ax+bx)/2, (ay+by)/2
        rid = room_at(midx+.08 if not horizontal else midx, midy+.08 if horizontal else midy, data["rooms"])
        CURRENT_ROOM = rid
        ops = []
        for op in openings:
            ox1, oy1, ox2, oy2 = [op[k]/100 for k in ("x1","y1","x2","y2")]
            same = abs(oy1-fixed)<.005 and abs(oy2-fixed)<.005 if horizontal else abs(ox1-fixed)<.005 and abs(ox2-fixed)<.005
            lo, hi = sorted((ox1, ox2) if horizontal else (oy1, oy2))
            if same and lo >= start-.01 and hi <= end+.01:
                ops.append((lo, hi, op))
        def seg(lo, hi, z, height, name):
            if hi-lo < .003 or height < .003:
                return
            cx, cy = ((lo+hi)/2, fixed) if horizontal else (fixed, (lo+hi)/2)
            w, d = (hi-lo, THICK) if horizontal else (THICK, hi-lo)
            ob = box(f"Wall {idx:02} / {name}", cx, cy, z, w, d, height, "Wall", .001, "wall", rid)
            ob["wallIndex"] = idx
            ob["external"] = idx < 8
            if z <= .005:
                # Skirting runs only on actual solid wall portions.
                box(f"Skirting {idx:02}", cx, cy, .005, w + (.018 if not horizontal else 0), d + (.018 if horizontal else 0), .07, "Cream", .002, "wall", rid)
        cursor = start
        for lo, hi, op in sorted(ops, key=lambda p:p[0]):
            seg(cursor, lo, 0, HEIGHT, "pier")
            seg(lo, hi, 0, op["sill"], "sill")
            top = op["sill"]+op["height"]
            seg(lo, hi, top, HEIGHT-top, "lintel")
            cursor = hi
        seg(cursor, end, 0, HEIGHT, "pier")
    for op in openings:
        opening_details(op, data)


def sliding_opening_details(op):
    """Three tracked leaves; model real parking, not one pane with mullions."""
    config=op["sliding"]
    x1,y1,x2,y2=[op[k]/100 for k in ("x1","y1","x2","y2")]
    if abs(x1-x2)>.0001 or config["stackTo"]!="north":
        raise ValueError("This calibrated kitchen slider is vertical and parks north")
    n=int(config["panelCount"])
    frame=config["jambCm"]/100
    length=y2-y1
    clear=length-2*frame
    overlap=config["overlapCm"]/100
    panel=(clear+(n-1)*overlap)/n
    pitch=config["trackPitchCm"]/100
    depth=config["panelDepthCm"]/100
    stagger=config["stackStaggerCm"]/100
    frame_depth=config["frameDepthCm"]/100
    h=op["height"]
    def part(label,x,y,z,w,d,height,role="sliding-static",mat="WarmGrayMetal"):
        obj=box(op["id"]+" / "+label,x,y,z,w,d,height,mat,.0015,"door","kitchen")
        obj["openingId"]=op["id"]
        obj["doorRole"]=role
        return obj
    for y in (y1+frame/2,y2-frame/2):
        part("sliding outer jamb",x1,y,0,frame_depth,frame,h-.065)
    part("three-track top housing",x1,(y1+y2)/2,h-.065,frame_depth,length,.065)
    for i in range(n):
        lane=(i-(n-1)/2)*pitch
        part("recessed guide track "+str(i+1),x1+lane,(y1+y2)/2,0,.010,length,.006)
        start=y1+frame+i*(panel-overlap)
        shift=-i*(panel-overlap-stagger)
        def leaf(label,along,z,span,height,mat="WarmGrayMetal",thickness=depth):
            obj=part("sliding leaf "+str(i+1)+" "+label,x1+lane,start+along,z,thickness,span,height,"sliding-panel",mat)
            obj["slidingPanelIndex"]=i
            obj["slideOpenOffsetM"]=[0.,0.,shift]
            return obj
        stile=.022
        for along in (stile/2,panel-stile/2):leaf("edge stile",along,.012,stile,h-.082)
        leaf("bottom rail",panel/2,.012,panel-2*stile,.034)
        leaf("top rail",panel/2,h-.104,panel-2*stile,.034)
        leaf("clear glazing",panel/2,.046,panel-2*stile,h-.150,"Glass",.008)
        # A shallow flush pull stays within the selected frame thickness.
        leaf("flush pull",panel-.012,1.0,.014,.16,"Brass",.025)
    # A small threshold bridges the 120 mm wall-depth strip, flush with floors.
    part("flush doorway floor",x1,(y1+y2)/2,-.012,.12,length,.012,"door-floor","Tile")


def opening_details(op, data):
    global CURRENT_ROOM
    x1,y1,x2,y2 = [op[k]/100 for k in ("x1","y1","x2","y2")]
    vertical = abs(x2-x1)<.001
    length = math.hypot(x2-x1,y2-y1)
    cx, cy = (x1+x2)/2, (y1+y2)/2
    sill, h = op["sill"], op["height"]
    roommap = {"window_b":"room_b","window_a":"room_a","window_c":"room_c","door_b":"room_b","door_a":"room_a","door_c":"room_c","door_bath_1":"bath_1","door_bath_2":"bath_2","door_kitchen":"kitchen","balcony_door":"balcony"}
    CURRENT_ROOM = op.get("roomId") or roommap.get(op["id"], room_at(cx-.1,cy+.1,data["rooms"]))
    if op.get("sliding"):
        sliding_opening_details(op)
        return
    if op.get("windowType")=="bay":
        bay_opening_details(op)
        return
    kind = "window" if op["kind"]=="window" else "door"
    glass = kind=="window" or "glass" in op["kind"]
    def part(label, u, z, w, d, height, mat="Oak"):
        ob = box(op["id"] + " / " + label, cx if vertical else cx+u, cy+u if vertical else cy, z, d if vertical else w, w if vertical else d, height, mat, .003, kind)
        ob["openingId"] = op["id"]
        return ob
    frame=.038 if glass else .06
    for u in (-length/2+frame/2,length/2-frame/2):
        # Frames meet edge to edge: overlapping coplanar jamb/head surfaces
        # otherwise produce black ray-tracing artifacts at the corners.
        part("jamb",u,sill+(frame if glass else 0),frame,.145,h-frame*(2 if glass else 1))
    part("head",0,sill+h-frame,length,.145,frame)
    if glass:
        part("sill frame",0,sill,length,.14,frame)
        count=3 if length>1.7 else 2
        for i in range(1,count):
            part("mullion",-length/2+i*length/count,sill,.028,.09,h)
        part("clear glazing",0,sill+.04,length-.08,.007,h-.08,"Glass")
        if kind=="window":
            part("transom",0,sill+h*.78,length,.08,.025)
            part("stone ledge",0,sill-.025,length+.07,.21,.025,"Stone")
            # Gathered, narrow side curtains, retaining the opening and daylight.
            if CURRENT_ROOM in ("living","room_a","room_b","room_c"):
                for sign in (-1,1):
                    for f in range(5):
                        u=sign*(length/2+.028+f*.033)
                        ob=part("linen curtain fold",u,.12,.030,.07,2.35,"WhiteLinen")
                        if vertical:
                            ob.location.x += THICK/2 + .04
                        else:
                            ob.location.y -= THICK/2 + .04
                        ob["kind"]="window"
    else:
        # Frame and leaf are modeled separately. Internal leaves sit inside the
        # real opening, so no invented swing eats adjacent bedrooms' floor area.
        part("oak door leaf",0,.02,length-.11,.038,h-.075)
        handle_u=length/2-.14
        part("handle escutcheon",handle_u,.94,.03,.061,.10,"Brass")
        part("lever handle",handle_u-.035,1.01,.105,.074,.014,"Brass")


def book_stack(x,y,z,width=.22):
    for i,mat in enumerate(("Sage","Cream","Terracotta")):
        ob=box("Small art book",x+(.01 if i==1 else 0),y,z+i*.024,width,.16,.022,mat,.002)
        ob.rotation_euler.z=.05*(i-1)


def vase(x,y,z,scale=1):
    cylinder("Ceramic bud vase",x,y,z,.065*scale,.14*scale,"Cream",r2=.047*scale)
    cylinder("Vase neck",x,y,z+.13*scale,.031*scale,.065*scale,"Cream")
    for i in range(3):
        rod("Dried branch",(x,y,z+.17*scale),(x+(i-1)*.055*scale,y+.015*i,z+.38*scale),.002,"Walnut")


def plant(x,y,z=0,height=1.05):
    cylinder("Clay planter",x,y,z,.15,.28,"Terracotta",r2=.18)
    cylinder("Soil",x,y,z+.27,.166,.012,"Walnut")
    for i in range(5):
        angle=i*2.4
        top=(x+math.cos(angle)*.12,y+math.sin(angle)*.12,z+height*(.65+.075*i))
        rod("Plant stem",(x,y,z+.25),top,.005,"Walnut")
        for j in range(3):
            t=.5+j*.17
            lx=x+(top[0]-x)*t+math.cos(angle+j)*.09
            ly=y+(top[1]-y)*t+math.sin(angle+j)*.09
            leaf=sphere("Ficus leaf",lx,ly,z+.25+(top[2]-z-.25)*t,.12,.05,.018,"LeafLight" if i%2 else "Leaf")
            leaf.rotation_euler=(.3*j,.25*i,angle+j)


def lamp(x,y,z=0,desk=False):
    h=.40 if desk else 1.55
    cylinder("Lamp base",x,y,z,.11 if desk else .18,.027,"Brass")
    cylinder("Lamp upright",x,y,z+.027,.009,h-.2,"Brass",vertices=16)
    cylinder("Pleated linen lampshade",x,y,z+h-.24,.14 if desk else .22,.22,"Linen",r2=.08 if desk else .13)
    sphere("Warm lamp bulb",x,y,z+h-.18,.04,.04,.055,"Lamp")


def framed_art(x,y,z,w=.5,h=.66,orient="north"):
    if orient=="north":
        box("Oak artwork frame",x,y,z,w,.022,h,"Oak",.006)
        box("Textured artwork paper",x,y+.014,z+.018,w-.036,.006,h-.036,"Cream",.001)
        sphere("Abstract clay artwork",x-.07,y+.020,z+h*.56,w*.23,.005,h*.25,"Terracotta")
        sphere("Abstract sage artwork",x+.07,y+.021,z+h*.36,w*.20,.005,h*.18,"Sage")
    else:
        box("Oak artwork frame",x,y,z,.022,w,h,"Oak",.006)
        box("Textured artwork paper",x+.014,y,z+.018,.006,w-.036,h-.036,"Cream",.001)


def bed(f,daybed=False):
    # The plan bbox and the physical bed sizes are different concepts: an
    # east/west 160x210 cm frame occupies 210x160 cm in the shared 2D plan.
    # Build the entire rig north-facing in local coordinates, then rotate all
    # its meshes as one rigid assembly; mattress/pillows never swap sizes.
    x,y,bbox_w,bbox_d=[f[k]/100 for k in ("x","y","w","d")]
    head=f.get("headDirection","north")
    angles={"north":0,"east":-math.pi/2,"south":math.pi,"west":math.pi/2}
    if head not in angles:raise ValueError(f"Unsupported bed head direction: {head}")
    w=float(f.get("frameWidthCm",f["d"] if head in ("east","west") else f["w"]))/100
    d=float(f.get("frameLengthCm",f["w"] if head in ("east","west") else f["d"]))/100
    mw=float(f.get("mattressWidthCm",w*100-5))/100
    md=float(f.get("mattressLengthCm",d*100-8.5))/100
    expected=(d,w) if head in ("east","west") else (w,d)
    if abs(bbox_w-expected[0])>.0001 or abs(bbox_d-expected[1])>.0001:
        raise ValueError(f"{f['name']}: plan bbox does not match the rotated physical frame")
    head_depth=.075
    if mw>w or md+head_depth>d+.0001:
        raise ValueError(f"{f['name']}: mattress does not fit behind the headboard")
    before=set(bpy.context.scene.objects)
    prefix=f["name"]
    block(prefix+" recessed supporting base",.08,.12,0,w-.16,d-.24,.10,mat="Walnut",bevel=.015)
    block(prefix+" solid oak plinth",0,0,.05,w,d,.18,mat="Oak",bevel=.035)
    head_height=.75 if CURRENT_ROOM in ("room_a","room_b") else .84
    block(prefix+" upholstered headboard",0,0,.13,w,head_depth,head_height,mat="Linen",bevel=.033)
    mx,my=(w-mw)/2,head_depth
    block(prefix+" mattress",mx,my,.23,mw,md,.20,mat="WhiteLinen",bevel=.075)
    block(prefix+" rounded duvet",mx-.008,my+.43,.424,mw+.016,md-.43,.095,mat="Cream",bevel=.06)
    throw_width=min(w-.02,mw+.02)
    block(prefix+" sage throw",(w-throw_width)/2,my+md-.42,.521,throw_width,.35,.026,mat="Sage",bevel=.012)
    count=1 if mw<1.15 else 2
    for i in range(count):
        pw=(mw-.10)/count
        ob=box("Soft sleeping pillow",mx+.05+pw*(i+.5),my+.25,.431,pw-.025,.38,.12,"WhiteLinen",.065)
        ob.rotation_euler.x=.06
    if daybed:
        block("Daybed side upholstered rail",0,.05,.20,.07,d-.07,.43,mat="Linen",bevel=.03)
        for off in (.8,1.3):
            ob=box("Daybed sage cushion",.17,off,.44,.14,.40,.36,"Sage",.055)
            ob.rotation_euler.y=-.18
    # Bedside shelves/lamps require their own verified placement records;
    # there is deliberately no room-coordinate threshold or implicit fixture.
    transform=(Matrix.Translation(Vector((x+bbox_w/2,-(y+bbox_d/2),0)))
               @ Matrix.Rotation(angles[head],4,"Z")
               @ Matrix.Translation(Vector((-w/2,d/2,0))))
    bpy.context.view_layer.update()
    for obj in set(bpy.context.scene.objects)-before:
        obj.matrix_world=transform @ obj.matrix_world
        obj["bedHeadDirection"]=head
        obj["frameWidthCm"]=round(w*100,4)
        obj["frameLengthCm"]=round(d*100,4)
        obj["mattressWidthCm"]=round(mw*100,4)
        obj["mattressLengthCm"]=round(md*100,4)


def cabinet(f, h=2.35, style="wardrobe"):
    x,y,w,d=[f[k]/100 for k in ("x","y","w","d")]
    name=f["name"]
    face=f.get("face","west" if d>w*1.4 and x>5 else "east" if d>w*1.4 else "south")
    if face not in ("north","south","east","west"):
        raise ValueError(f"Unsupported cabinet face: {face}")
    vertical=face in ("east","west")
    span=d if vertical else w
    depth=w if vertical else d
    def frontal(label,along,inset,z,width,thickness,height,mat="Oak",bevel=.004):
        # inset measures inward from the declared footprint's front edge.
        if face=="west":px,py=x+inset,y+along
        elif face=="east":px,py=x+w-inset,y+along
        elif face=="north":px,py=x+along,y+inset
        else:px,py=x+along,y+d-inset
        return box(name+" "+label,px,py,z,thickness if vertical else width,width if vertical else thickness,height,mat,bevel)
    block(name+" recessed plinth",x+.025,y+.025,.015,w-.05,d-.05,.065,mat="Walnut",bevel=.005)
    block(name+" carcass bottom",x,y,.08,w,d,.025,mat="Oak",bevel=.004)
    block(name+" carcass top",x,y,h-.025,w,d,.025,mat="Oak",bevel=.004)
    for along in (.01,span-.01):
        frontal("carcass side",along,depth/2,.105,.02,depth,h-.13)
    frontal("carcass back",span/2,depth-.009,.105,span-.04,.018,h-.13)
    frontal("upper shelf",span/2,(depth+.035)/2,1.73,span-.04,depth-.095,.022)
    sliding=f.get("doorStyle")=="sliding"
    if sliding:
        n=max(2,int(f.get("doorPanels",2)))
        overlap=.035
        panel=(span-.012+overlap*(n-1))/n
        step=panel-overlap
        for z in (.106,h-.043):
            for lane in (0,1):
                frontal("sliding door track",span/2,.014+lane*.024,z,span-.02,.014,.008,"Brass",.002)
        for i in range(n):
            along=.006+panel/2+i*step
            inset=.014+(i%2)*.024
            frontal("sliding door",along,inset,.116,panel,.018,h-.168,"Oak",.004)
            frontal("recessed sliding pull",along+(panel*.38 if i==0 else -panel*.38),inset-.010,.94,.016,.002,.20,"Walnut",.002)
    else:
        n=max(2,round(span/.48))
        for i in range(n):
            frontal("door",(i+.5)*span/n,.035,.108,span/n-.006,.018,h-.148,"Cream" if style=="entry" else "Oak",.004)
            frontal("brass pull",(i+.82)*span/n,.014,.94,.012,.017,.18,"Brass",.004)


def low_cabinet(f,height=.65):
    x,y,w,d=[f[k]/100 for k in ("x","y","w","d")]
    block(f["name"]+" oak case",x,y,.10,w,d,height-.10,mat="Oak",bevel=.018)
    n=max(2,round(max(w,d)/.42))
    vertical=d>w
    for i in range(n):
        if vertical:
            box("Reeded cabinet door",x+w+.004,y+(i+.5)*d/n,.13,.018,d/n-.009,height-.17,"Oak",.004)
        else:
            facey=y-.004 if f.get("face")=="north" else y+d+.004
            box("Reeded cabinet door",x+(i+.5)*w/n,facey,.13,w/n-.009,.018,height-.17,"Oak",.004)
    for px,py in ((x+.07,y+.06),(x+w-.07,y+.06),(x+.07,y+d-.06),(x+w-.07,y+d-.06)):
        cylinder("Cabinet foot",px,py,0,.018,.11,"Oak",vertices=12)
    return x,y,w,d,height


def desk_lamp_position(f):
    x,y,w,d=[f[k]/100 for k in ("x","y","w","d")]
    px,py=x+w*.75,y+d*(.75 if f.get("face")=="north" else .25)
    if f.get("face","south")=="south":
        # A south-facing desk backs onto the north wall. Keep its 140 mm
        # lampshade radius plus 5 mm clear within the desktop. Other desk
        # orientations retain their established placement in this correction.
        margin=.14+.005
        if min(w,d)<2*margin:
            raise ValueError(f"{f['name']}: desktop is too small for this table lamp")
        px=min(max(px,x+margin),x+w-margin)
        py=min(max(py,y+margin),y+d-margin)
    return px,py


def desk(f):
    x,y,w,d=[f[k]/100 for k in ("x","y","w","d")]
    block("Oak desk desktop",x,y,.73,w,d,.035,mat="Oak",bevel=.012)
    for px,py in ((x+.04,y+.04),(x+w-.04,y+.04),(x+.04,y+d-.04),(x+w-.04,y+d-.04)):
        cylinder("Desk turned leg",px,py,.02,.023,.71,"Oak",vertices=16)
    lamp(*desk_lamp_position(f),.765,True)
    if w>d:
        block("Desk linen notebook",x+.08,y+.13,.767,.24,.17,.016,mat="Sage")
    else:
        box("Slim desktop monitor",x+.38,y+d*.57,.82,.035,.42,.27,"Charcoal",.008)
        block("Keyboard",x+.10,y+.40,.77,.18,.34,.016,mat="Cream")


def chair(f):
    x,y,w,d=[f[k]/100 for k in ("x","y","w","d")]
    px,py=x+w/2,y+d/2
    box("Rounded linen chair seat",px,py,.43,w-.02,d-.025,.07,"Linen",.06)
    face=f.get("face", "south" if "北" in f["name"] else "north")
    backy=y+.025 if face=="south" else y+d-.025
    box("Curved oak chair back",px,backy,.50,w-.025,.042,.27,"Oak",.045)
    for sx in (-1,1):
        for sy in (-1,1):
            rod("Tapered chair leg",(px+sx*w*.39,py+sy*d*.34,.02),(px+sx*w*.31,py+sy*d*.29,.46),.018,"Oak")


def rounded_fitout_slab(name,x,y,z,w,d,h,radius=.03,mat="OakLight"):
    """A true plan-radius slab: a 30 mm corner need not round its 30 mm
    thickness into a pillow, as a single all-edge bevel would do."""
    r=min(radius,w/4,d/4)
    xy=[]
    for cx,cy,start in ((x+w-r,y+r,-90),(x+w-r,y+d-r,0),(x+r,y+d-r,90),(x+r,y+r,180)):
        for step in range(7):
            a=math.radians(start+step*15)
            xy.append((cx+r*math.cos(a),cy+r*math.sin(a)))
    n=len(xy)
    verts=[(px,-py,z+height) for height in (0,h) for px,py in xy]
    faces=[tuple(range(n)),tuple(reversed(range(n,2*n)))]
    faces.extend((i,n+i,n+(i+1)%n,(i+1)%n) for i in range(n))
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    finish(obj,name,mat,.0015)
    uv=mesh.uv_layers.new(name="UVMap")
    for polygon in mesh.polygons:
        for li in polygon.loop_indices:
            co=mesh.vertices[mesh.loops[li].vertex_index].co
            uv.data[li].uv=(co.x*.8,-co.y*.8+co.z*.2)
    return obj


def bay_fitout_part(p):
    """Make one explicitly bounded fitout part; never borrow another part's
    footprint or invent hidden under-sill storage. All dimensions are cm.
    """
    x,y,w,d=[float(p[k])/100 for k in ("x","y","w","d")]
    z,h=float(p.get("zCm",0))/100,float(p["hCm"])/100
    role=p["role"]
    face=p.get("face","south")
    name=p.get("title",p["id"])
    if min(w,d,h)<=0:raise ValueError(f"{name}: nonpositive fitout bounds")
    if role in ("desktop","desk","raised_ledge","ledge"):
        rounded_fitout_slab(name,x,y,z,w,d,h,.03 if role in ("desktop","desk") else .012)
    elif role in ("desk_support","desk_frame","support"):
        vertical=face in ("east","west")
        span,depth=(d,w) if vertical else (w,d)
        count=int(p.get("supportCount",3 if span>1.5 else 2))
        tube=.020
        for idx in range(count):
            # Slight inset keeps every U frame beneath the rounded tabletop,
            # not projecting through its curved outer corners.
            along=.030+(span-.060)*idx/(count-1)
            def pt(cross,height):
                return (x+cross,y+along,height) if vertical else (x+along,y+cross,height)
            # Uprights stay at the back/front desk edges; the only connecting
            # member is at desk underside, never a low knee-height stretcher.
            for cross in (.030,depth-.030):
                px,py,_=pt(cross,z)
                box(name+" square metal upright",px,py,z,tube,tube,h-tube,"WarmGrayMetal",.002)
            px,py,_=pt(depth/2,z+h-tube)
            box(name+" upper U-frame member",px,py,z+h-tube,depth-.040 if vertical else tube,tube if vertical else depth-.040,tube,"WarmGrayMetal",.002)
    elif role in ("chair","child_chair"):
        # Build all chair parts facing north, then rotate the whole assembly.
        vertical=face in ("east","west")
        cw,cd=(d,w) if vertical else (w,d)
        seat_thickness=.06
        # seatHeightCm denotes the FINISHED cushion top, not its bottom.
        # Existing unconfigured chairs keep their previously audited height.
        seat_top=float(p["seatHeightCm"])/100 if "seatHeightCm" in p else min(.445,h*.56)+seat_thickness
        seat_z=seat_top-seat_thickness
        if seat_z<=.10 or h-seat_z-.10<=.10:
            raise ValueError(f"{name}: seat height leaves no credible legs/backrest inside its envelope")
        before=set(bpy.context.scene.objects)
        box(name+" padded seat",cw/2,cd/2,z+seat_z,cw-.045,cd-.045,seat_thickness,"Linen",.025)
        box(name+" rounded backrest",cw/2,cd-.033,z+seat_z+.10,cw-.035,.044,h-seat_z-.10,"OakLight",.021)
        for sx in (.035,cw-.035):
            for sy in (.045,cd-.045):
                box(name+" slim metal leg",sx,sy,z,.020,.020,seat_z,"WarmGrayMetal",.002)
        if "seatHeightCm" in p:
            # This explicitly configured counter chair needs a real back-to-
            # seat connection. Overlap its rear legs by 10 mm and its back
            # panel by 20 mm; ordinary previously rendered chairs are kept.
            for sx in (.035,cw-.035):
                box(name+" rear backrest connecting post",sx,cd-.045,z+seat_z-.010,.020,.020,.130,"WarmGrayMetal",.002)
        if role=="child_chair" or p.get("footrest"):
            # The configurable dimension is also a finished TOP elevation.
            foot_top=float(p.get("footrestHeightCm",19.5))/100
            if not .05<foot_top<seat_z-.08:
                raise ValueError(f"{name}: footrest height is incompatible with the finished seat height")
            block(name+" illustrative foot support",.045,.035,z+foot_top-.025,cw-.09,.15,.025,mat="OakLight",bevel=.008)
        angle={"north":0,"south":math.pi,"east":-math.pi/2,"west":math.pi/2}[face]
        transform=(Matrix.Translation(Vector((x+w/2,-(y+d/2),0)))
                   @ Matrix.Rotation(angle,4,"Z")
                   @ Matrix.Translation(Vector((-cw/2,cd/2,0))))
        bpy.context.view_layer.update()
        for obj in set(bpy.context.scene.objects)-before:obj.matrix_world=transform @ obj.matrix_world
    elif role in ("seat_cushion","cushion","back_cushion"):
        block(name,x,y,z,w,d,h,mat="Linen",bevel=min(.035,h*.45))
        # Fine piping stays inset rather than expanding the nominal cushion.
        block(name+" inset textile piping",x+.005,y+.005,z+h*.24,w-.010,d-.010,.005,mat="WhiteLinen",bevel=.002)
    elif role=="ledge_objects":
        book_stack(x+w*.23,y+d*.52,z,.24)
        vr=min(.06,d*.17)
        cylinder(name+" quiet ceramic vase",x+w*.76,y+d*.50,z,vr,min(.15,h-.005),"Cream",r2=vr*.70)
    elif role in ("tea_tray","tea"):
        # Overall part height includes tray and removable low cup(s).
        tray_h=min(.025,h*.3)
        block(name+" oak tray",x,y,z,w,d,tray_h,mat="OakLight",bevel=.011)
        for sx in (x+.005,x+w-.005):
            box(name+" tray raised edge",sx,y+d/2,z+tray_h,.01,d,.008,"Oak",.003)
        cup_r=min(.032,w*.14,d*.14)
        cup_h=min(.047,h-tray_h-.010)
        if cup_h>.012:
            cylinder(name+" ceramic tea cup",x+w*.36,y+d*.48,z+tray_h+.001,cup_r,cup_h,"Ceramic",r2=cup_r*1.08)
            cylinder(name+" visible tea",x+w*.36,y+d*.48,z+tray_h+cup_h-.003,cup_r*.78,.003,"Walnut")
    elif role in ("desk_accessories","office_accessories","family_accessories"):
        # Separate bounded accessory zones allow clear knee space and keep
        # lamps, mirrors and screens off the glass/opening hardware.
        bay_desk_accessories(p)
    elif role in ("laptop","notebook","task_lamp","mirror","footrest"):
        bay_small_object(p)
    else:
        raise ValueError(f"Unknown bay fitout role {role!r} in {name}")


def bay_small_object(p):
    x,y,w,d=[float(p[k])/100 for k in ("x","y","w","d")]
    z,h=float(p.get("zCm",0))/100,float(p["hCm"])/100
    role,face=p["role"],p.get("face","south")
    name=p.get("title",p["id"])
    if role in ("notebook","footrest"):
        block(name,x,y,z,w,d,min(h,.025),mat="Sage" if role=="notebook" else "OakLight",bevel=.005)
        if role=="notebook" and h>.009:
            block(name+" pale page edges",x+.007,y+.007,z+.004,w-.014,d-.014,min(.006,h-.005),mat="WhiteLinen",bevel=.001)
        return
    if role=="task_lamp":
        radius=min(w,d)*.45
        cylinder(name+" flat base",x+w/2,y+d/2,z,radius,.012,"WarmGrayMetal")
        cylinder(name+" slender upright",x+w/2,y+d/2,z+.012,.006,max(.01,h-.067),"WarmGrayMetal",vertices=12)
        cylinder(name+" opal task shade",x+w/2,y+d/2,z+h-.055,radius,.045,"Cream",r2=radius*.80)
        cylinder(name+" warm diffuser",x+w/2,y+d/2,z+h-.058,radius*.75,.003,"Lamp")
        return
    vertical=face in ("east","west")
    cw,cd=(d,w) if vertical else (w,d)
    before=set(bpy.context.scene.objects)
    if role=="laptop":
        block(name+" laptop base",.002,.003,z,cw-.004,cd-.006,.010,mat="WarmGrayMetal",bevel=.003)
        screen_y=.010
        box(name+" laptop lid",cw/2,screen_y,z+.010,cw-.012,.014,h-.012,"Charcoal",.004)
        box(name+" quiet laptop screen",cw/2,screen_y+.0076,z+.020,cw-.030,.001,h-.036,"GlassDark",.001)
        for row in range(3):
            for key in range(8):
                box(name+" keyboard key",cw*(.14+.10*key),cd*(.34+.10*row),z+.010,(cw*.078),cd*.066,.002,"Charcoal",.001)
        block(name+" trackpad",cw*.34,cd*.71,z+.010,cw*.32,cd*.19,.001,mat="Cream",bevel=.001)
    elif role=="mirror":
        # Portable freestanding mirror, not a fixture mounted through glass.
        cylinder(name+" mirror stand base",cw/2,cd/2,z,min(cw,cd)*.43,.012,"WarmGrayMetal")
        cylinder(name+" mirror stand",cw/2,cd/2,z+.012,.005,h*.34,"WarmGrayMetal",vertices=12)
        mw=min(cw-.012,h*.66)
        box(name+" rounded mirror frame",cw/2,cd/2,z+h-mw,mw,min(cd*.50,.026),mw,"WindowMetal",min(.035,mw*.15))
        box(name+" portable mirror face",cw/2,cd/2+min(cd*.25,.013)+.001,z+h-mw+.007,mw-.014,.002,mw-.014,"Mirror",min(.030,mw*.14))
    angle={"south":0,"north":math.pi,"east":math.pi/2,"west":-math.pi/2}[face]
    transform=(Matrix.Translation(Vector((x+w/2,-(y+d/2),0)))
               @ Matrix.Rotation(angle,4,"Z")
               @ Matrix.Translation(Vector((-cw/2,cd/2,0))))
    bpy.context.view_layer.update()
    for obj in set(bpy.context.scene.objects)-before:obj.matrix_world=transform @ obj.matrix_world


def bay_desk_accessories(p):
    """Compose only inside an explicitly supplied accessory envelope."""
    x,y,w,d=[float(p[k]) for k in ("x","y","w","d")]
    z,h=float(p["zCm"]),float(p["hCm"])
    face=p.get("face","south")
    vertical=face in ("east","west")
    span,depth=(d,w) if vertical else (w,d)
    def small(suffix,role,along,cross,sw,sd,sh):
        child={"id":p["id"]+" / "+suffix,"role":role,"x":x+cross if vertical else x+along,"y":y+along if vertical else y+cross,"w":sd if vertical else sw,"d":sw if vertical else sd,"zCm":z,"hCm":min(h,sh),"face":face}
        bay_small_object(child)
    preset=p.get("preset")
    if preset=="office_vanity":
        # One side-facing workstation on a deep continuous bay counter.
        # Do not infer two users merely because its cross-depth is 1.22 m.
        if span<50 or depth<95:
            raise ValueError(f"{p['id']}: single-user side-facing accessory envelope is too small")
        small("single user laptop","laptop",8,3,34,25,24)
        small("single task light","task_lamp",2,36,13,13,29)
        small("movable vanity mirror","mirror",span-22,30,20,13,28)
        small("linen notebook","notebook",8,70,24,18,1.6)
    elif preset=="family_desk" or span>140:
        # Two stations, one notebook-based: this is not a claimed ergonomic
        # prescription for any child's age/size or prolonged screen use.
        small("adult laptop","laptop",18,13,34,25,24)
        small("adult task light","task_lamp",65,5,15,15,29)
        small("family notebook","notebook",121,21,28,22,1.8)
        small("family task light","task_lamp",172,6,15,15,29)
    else:
        small("compact laptop","laptop",18,20,32,24,22)
        small("compact task light","task_lamp",2,3,13,13,29)
        small("movable vanity mirror","mirror",span-22,2,20,13,28)
        small("linen notebook","notebook",span-21,depth-18,18,15,1.6)


def bay_fitouts(data):
    global CURRENT_ROOM
    for fitout in data.get("bayFitouts",[]):
        CURRENT_ROOM=fitout["roomId"]
        for p in fitout.get("parts",[]):
            before=set(bpy.context.scene.objects)
            bay_fitout_part(p)
            objects=set(bpy.context.scene.objects)-before
            bpy.context.view_layer.update()
            lo=(float(p["x"])/100,float(p["y"])/100,float(p.get("zCm",0))/100)
            hi=(lo[0]+float(p["w"])/100,lo[1]+float(p["d"])/100,lo[2]+float(p["hCm"])/100)
            for obj in objects:
                obj["fitoutId"]=fitout["id"]
                obj["fitoutPartId"]=p["id"]
                obj["bayRole"]=p["role"]
                obj["openingId"]=fitout["openingId"]
                obj["roomId"]=CURRENT_ROOM
                obj["furnitureId"]=p["id"]
                obj["fitoutType"]=fitout["type"]
                obj["designStatus"]=str(fitout.get("status","conditional design proposal"))
                if "face" in p:obj["furnitureFace"]=p["face"]
                for dimension in ("seatHeightCm","footrestHeightCm"):
                    if dimension in p:obj[dimension]=float(p[dimension])
                if "preset" in p:obj["fitoutPreset"]=p["preset"]
                if obj.type=="MESH":
                    for point in obj.bound_box:
                        q=obj.matrix_world @ Vector(point)
                        values=(q.x,-q.y,q.z)
                        if any(values[i]<lo[i]-.00015 or values[i]>hi[i]+.00015 for i in range(3)):
                            raise ValueError(f"{fitout['id']}/{p['id']}: {obj.name} escapes declared part bounds: {values} versus {lo}..{hi}")


def storage_part(p):
    """Build complete modules in a canonical east-facing local frame.

    Rotating the complete group also rotates sockets, recessed pulls, cups,
    bags and handles; a face label alone is not an orientation transform.
    Corner parts use explicit global west/south exterior boundaries.
    """
    if p["role"] in ("sideboard_blind_base","sideboard_corner_niche","upper_blind_corner"):
        storage_corner_part(p)
        return
    face=p.get("face","east")
    if face not in ("east","west","north","south"):
        raise ValueError(f"{p['id']}: unsupported storage face {face!r}")
    x,y,w,d=[float(p[k])/100 for k in ("x","y","w","d")]
    depth,span=(w,d) if face in ("east","west") else (d,w)
    local={**p,"x":0,"y":0,"w":depth*100,"d":span*100,"face":"east"}
    before=set(bpy.context.scene.objects)
    storage_part_east(local)
    angle={"east":0,"west":math.pi,"north":math.pi/2,"south":-math.pi/2}[face]
    transform=(Matrix.Translation(Vector((x+w/2,-(y+d/2),0)))
               @ Matrix.Rotation(angle,4,"Z")
               @ Matrix.Translation(Vector((-depth/2,span/2,0))))
    bpy.context.view_layer.update()
    for obj in set(bpy.context.scene.objects)-before:
        obj.matrix_world=transform @ obj.matrix_world


def storage_corner_part(p):
    """An explicitly owned corner, not two interpenetrating normal cabinets.

    The lower/upper blind units are closed construction voids: no invented
    corner door, drawer or accessible storage. Their adjacent run end panels
    can be omitted so this unit alone owns the joining partitions.
    The niche has only west/south back linings; north/east remain open.
    """
    x,y,w,d=[float(p[k])/100 for k in ("x","y","w","d")]
    z,h=float(p.get("zCm",0))/100,float(p["hCm"])/100
    role,name=p["role"],p["id"]
    t=.018
    def panel(label,px,py,pz,pw,pd,ph,mat="OakLight"):
        return block(name+" / "+label,px,py,pz,pw,pd,ph,mat=mat,bevel=0)
    if role=="sideboard_corner_niche":
        panel("corner west back lining",x,y,z,t,d,h-t)
        panel("corner south back lining",x+t,y+d-t,z,w-t,t,h-t)
        panel("corner niche top lining",x,y,z+h-t,w,d,t)
        # Short light channels bridge the inside turn without spanning the
        # open work surface or introducing a vertical corner divider.
        for label,px,py,pw,pd in (
            ("north-south",x+w-.079,y,.014,.065),
            ("west-east",x+w-.079,y+.065,.079,.014),
        ):
            panel("corner LED channel "+label,px,py,z+h-t-.005,pw,pd,.003,"WarmGrayMetal")
            panel("corner LED diffuser "+label,px+.001,py+.001,z+h-t-.007,pw-.002,pd-.002,.002,"Lamp")
        return
    base=.075 if role=="sideboard_blind_base" else 0
    if base:
        panel("blind corner recessed plinth",x+.03,y+.03,z,w-.06,d-.06,base,"WarmGrayMetal")
    # The long x-side panels own the four 18 mm corner squares; the north /
    # south panels stop between them, avoiding coplanar overlapping boxes.
    for label,px in (("west",x),("east",x+w-t)):
        panel("blind corner "+label+" partition",px,y,z+base,t,d,h-base-t)
    for label,py in (("north",y),("south",y+d-t)):
        panel("blind corner "+label+" partition",x+t,py,z+base,w-2*t,t,h-base-t)
    panel("blind corner bottom",x+t,y+t,z+base,w-2*t,d-2*t,t)
    panel("blind corner finished top",x,y,z+h-t,w,d,t,"Stone" if base else "OakLight")


def storage_part_east(p):
    """Panel-built storage, never a solid placeholder filling the niches.

    Parts include their complete fronts/hardware/props inside declared bounds;
    an extension allowance is metadata, not an already-open drawer.
    """
    x,y,w,d=[float(p[k])/100 for k in ("x","y","w","d")]
    z,h=float(p.get("zCm",0))/100,float(p["hCm"])/100
    face=p.get("face","east")
    role,name=p["role"],p["id"]
    vertical=face in ("east","west")
    span,depth=(d,w) if vertical else (w,d)
    def front(label,along,inset,bottom,width,thickness,height,mat="OakLight",bevel=.003):
        if face=="east":px,py=x+w-inset,y+along
        elif face=="west":px,py=x+inset,y+along
        elif face=="north":px,py=x+along,y+inset
        else:px,py=x+along,y+d-inset
        return box(name+" / "+label,px,py,bottom,thickness if vertical else width,width if vertical else thickness,height,mat,bevel)
    def slab(label,bottom,thickness,mat="OakLight"):
        if p.get("flushJoints"):
            return block(name+" / "+label,x,y,bottom,w,d,thickness,mat=mat,bevel=0)
        return rounded_fitout_slab(name+" / "+label,x,y,bottom,w,d,thickness,.008,mat)
    def sides(bottom,height):
        if not p.get("omitStartPanel"):
            front("start support panel",.010,depth/2,bottom,.020,depth,height)
        if not p.get("omitEndPanel"):
            front("end support panel",span-.010,depth/2,bottom,.020,depth,height)
    def back(bottom,height):
        start=0 if p.get("omitStartPanel") else .020
        end=span if p.get("omitEndPanel") else span-.020
        front("thin back panel",(start+end)/2,depth-.009,bottom,end-start,.018,height)
    def shoes(along,bottom=.006):
        # Footwear is only an indicative pair, not a cabinet capacity claim.
        for offset in (-.056,.056):
            px,py=(x+w*.52,y+along+offset) if vertical else (x+along+offset,y+d*.52)
            box(name+" / visible shoe sole",px,py,z+bottom,.27 if vertical else .095,.095 if vertical else .27,.014,"Cream",.006)
            sphere(name+" / soft shoe upper",px,py,z+bottom+.048,.128 if vertical else .042,.042 if vertical else .128,.035,"Linen")
    def sliding(bottom,top,count):
        clear=span-.040
        overlap=.026
        panel=(clear+overlap*(count-1))/count
        step=panel-overlap
        for level in (bottom,bottom+top-bottom-.012):
            for lane in (0,1):front("sliding track",span/2,.014+lane*.024,level,clear,.011,.008,"WarmGrayMetal",.001)
        for idx in range(count):
            along=.020+panel/2+idx*step
            inset=.014+(idx%2)*.024
            front("cream sliding door",along,inset,bottom+.009,panel,.018,top-bottom-.022,"Cream",.003)
            front("inset finger pull",along+panel*.31,inset-.010,bottom+(top-bottom)*.57,.014,.002,.12,"WarmGrayMetal",.001)
    if role=="shoe_lower":
        open_base=float(p.get("openBaseCm",20))/100
        sides(z,h-.020)
        back(z+open_base,h-open_base-.020)
        divisions=3 if span>=1.10 else 2
        for index in range(1,divisions):front("floor-standing base divider",span*index/divisions,depth/2,z,.020,depth-.025,open_base)
        slab("shoe compartment base",z+open_base,.020)
        slab("finished key counter",z+h-.020,.020)
        for level in (.45,.70):front("shoe shelf",span/2,(depth+.070)/2,z+level,span-.045,depth-.115,.018)
        sliding(z+open_base+.020,z+h-.020,int(p.get("doorPanels",3)))
        shoes(span*(.18 if divisions==3 else .25))
    elif role in ("key_niche","sideboard_niche"):
        # The lower cabinet supplies the finished floor at exactly z: no
        # extra slab here may bury the accessories which start at that level.
        sides(z,h-.018)
        back(z,h-.018)
        slab("niche top lining",z+h-.018,.018)
        # An omitted joining end panel also means a continuous light run.
        # Retained closed ends keep a 35 mm margin; adjacent module runs
        # terminate exactly at the shared plane without overlaps or gaps.
        led_start=0 if p.get("omitStartPanel") else .035
        led_end=span if p.get("omitEndPanel") else span-.035
        glow_start=led_start if p.get("omitStartPanel") else led_start+.0025
        glow_end=led_end if p.get("omitEndPanel") else led_end-.0025
        front("warm recessed LED channel",(led_start+led_end)/2,.072,z+h-.023,led_end-led_start,.015,.003,"WarmGrayMetal",.001)
        front("warm LED diffuser",(glow_start+glow_end)/2,.072,z+h-.025,glow_end-glow_start,.012,.002,"Lamp",.001)
        front("reserved socket plate",span*.22,depth-.022,z+h*.43,.075,.007,.075,"Cream",.004)
        for off in (-.016,.016):front("socket indication",span*.22+off,depth-.026,z+h*.43+.029,.007,.002,.018,"WarmGrayMetal",.001)
    elif role=="upper_cabinet":
        sides(z,h)
        back(z+.020,h-.040)
        slab("upper cabinet bottom",z,.020)
        slab("upper cabinet top",z+h-.020,.020)
        open_end=float(p.get("openEndCm",0))/100
        closed=span-open_end
        if open_end:
            front("open cup bay partition",closed,depth/2,z+.020,.020,depth-.025,h-.040)
        for level in (.34,.67):front("upper interior shelf",span/2,(depth+.035)/2,z+level,span-.045,depth-.085,.018)
        count=int(p.get("doorPanels",3))
        for idx in range(count):
            door_w=(closed-.040)/count
            along=.020+(idx+.5)*door_w
            front("cream upper door",along,.016,z+.024,door_w-.005,.018,h-.048,"Cream",.003)
            front("subtle upper finger edge",along,.005,z+.033,door_w-.035,.003,.012,"WarmGrayMetal",.001)
        if open_end:
            for level in (.36,.69):
                along=closed+open_end*.52
                px,py=(x+w*.57,y+along) if vertical else (x+along,y+d*.57)
                cylinder(name+" / open-shelf cup",px,py,z+level,.038,.080,"Ceramic")
    elif role=="shoe_bench":
        sides(z,.40)
        back(z+.08,.30)
        slab("bench oak seat substrate",z+.40,.025)
        rounded_fitout_slab(name+" / removable soft seat",x+.003,y+.003,z+.425,w-.006,d-.006,.025,.024,"Linen")
        shoes(span*.51)
    elif role=="bench_back":
        # Seven centimetres is the hardware envelope, NOT a thick solid back.
        front("slim timber back",span/2,depth-.009,z,span,.018,h,"OakLight",.007)
        front("rounded vertical mirror frame",span*.30,depth-.022,z+.25,span*.42,.020,1.28,"OakLight",.009)
        front("front-facing mirror",span*.30,depth-.033,z+.26,span*.42-.020,.002,1.26,"Mirror",.006)
        for along,bottom in ((span*.69,z+1.20),(span*.85,z+1.45)):
            front("coat hook backplate",along,depth-.023,bottom,.035,.008,.055,"WarmGrayMetal",.004)
            front("short projecting coat hook",along,depth-.043,bottom+.012,.014,.042,.013,"WarmGrayMetal",.003)
    elif role=="sideboard_base":
        front("recessed toe kick",span/2,depth/2,z,span if p.get("flushJoints") else span-.050,depth-.060,.075,"WarmGrayMetal",.003)
        sides(z+.075,h-.095)
        back(z+.075,h-.095)
        slab("base compartment floor",z+.075,.020)
        slab("warm stone worktop",z+h-.020,.020,"Stone")
        drawers=int(p.get("drawerPanels",2))
        if drawers<0:raise ValueError(f"{name}: negative drawer count")
        if drawers:
            front("drawer compartment shelf",span/2,(depth+.065)/2,z+.595,span-.045,depth-.110,.018)
            sliding(z+.095,z+.59,int(p.get("doorPanels",2)))
            for idx in range(drawers):
                along=(idx+.5)*span/drawers
                front("closed shallow drawer front",along,.015,z+.620,span/drawers-.014,.020,h-.655,"Cream",.003)
                front("closed drawer floor",along,(depth+.065)/2,z+.622,span/drawers-.034,depth-.105,.016)
                front("recessed drawer pull",along,.003,z+.790,span/drawers-.080,.002,.012,"WarmGrayMetal",.001)
        else:
            front("full-height cupboard interior shelf",span/2,(depth+.065)/2,z+h*.48,span-.045,depth-.110,.018)
            sliding(z+.095,z+h-.020,int(p.get("doorPanels",2)))
    elif role=="entry_accessories":
        # A low key tray plus small bag; no objects protrude into the aisle.
        px,py=x+w*.50,y+d*.22
        box(name+" / oak key tray",px,py,z,.18,.25,.017,"OakLight",.007)
        for idx in range(2):
            rod(name+" / key",(px-.025,py-.045+idx*.045,z+.020),(px+.035,py-.045+idx*.045,z+.020),.004,"Brass")
        bx,by=x+w*.53,y+d*.75
        box(name+" / small everyday bag",bx,by,z,.15,.27,.19,"Terracotta",.025)
        for sign in (-1,1):
            rod(name+" / bag handle",(bx,by+sign*.072,z+.18),(bx,by+sign*.045,z+.26),.005,"Walnut")
        rod(name+" / bag handle top",(bx,by-.045,z+.26),(bx,by+.045,z+.26),.005,"Walnut")
    elif role=="dining_accessories":
        px,py=x+w*.48,y+d*.22
        cylinder(name+" / insulated drinks flask",px,py,z,.066,.235,"Cream",r2=.056)
        cylinder(name+" / flask lid",px,py,z+.235,.057,.018,"OakLight")
        rod(name+" / flask handle",(px,py+.101,z+.060),(px,py+.101,z+.185),.006,"WarmGrayMetal")
        rod(name+" / flask handle upper",(px,py+.050,z+.185),(px,py+.101,z+.185),.006,"WarmGrayMetal")
        rod(name+" / flask handle lower",(px,py+.050,z+.060),(px,py+.101,z+.060),.006,"WarmGrayMetal")
        px,py=x+w*.51,y+d*.57
        cylinder(name+" / saucer",px,py,z,.085,.012,"Ceramic")
        cylinder(name+" / teacup",px,py,z+.012,.037,.065,"Ceramic")
        px,py=x+w*.50,y+d*.85
        cylinder(name+" / tea storage tin",px,py,z,.060,.145,"Sage")
        cylinder(name+" / tea tin lid",px,py,z+.145,.062,.016,"OakLight")
    else:raise ValueError(f"Unknown storage role {role!r}")


def storage_fitouts(data):
    global CURRENT_ROOM
    for fitout in data.get("storageFitouts",[]):
        CURRENT_ROOM=fitout["roomId"]
        for p in fitout["parts"]:
            before=set(bpy.context.scene.objects)
            storage_part(p)
            bpy.context.view_layer.update()
            lo=(p["x"]/100,p["y"]/100,p.get("zCm",0)/100)
            hi=(lo[0]+p["w"]/100,lo[1]+p["d"]/100,lo[2]+p["hCm"]/100)
            for obj in set(bpy.context.scene.objects)-before:
                obj["storageFitoutId"]=fitout["id"]
                obj["storagePartId"]=p["id"]
                obj["storageRole"]=p["role"]
                obj["roomId"]=CURRENT_ROOM
                obj["furnitureId"]=p["id"]
                obj["furnitureFace"]=p.get("face","east")
                segment=p.get("segmentId",p.get("source",{}).get("segmentId"))
                if segment:obj["storageSegmentId"]=segment
                if "frontPaletteRole" in p:
                    obj["storageFrontPaletteRole"]=p["frontPaletteRole"]
                if "drawerPanels" in p:obj["drawerPanels"]=int(p["drawerPanels"])
                if p["role"] in ("sideboard_blind_base","upper_blind_corner"):
                    obj["storageAccess"]="blind construction void; not accessible storage"
                if p["role"] in ("entry_accessories","dining_accessories") or "shoe sole" in obj.name or "shoe upper" in obj.name or "open-shelf cup" in obj.name:
                    obj["storageElement"]="decor"
                if "doorStyle" in p:obj["doorStyle"]=p["doorStyle"]
                if "seatHeightCm" in p:obj["seatHeightCm"]=p["seatHeightCm"]
                if "drawerExtensionCm" in p:
                    obj["drawerExtensionCm"]=p["drawerExtensionCm"]
                    obj["drawerState"]="closed"
                if obj.type=="MESH":
                    for corner in obj.bound_box:
                        q=obj.matrix_world @ Vector(corner)
                        val=(q.x,-q.y,q.z)
                        if any(val[i]<lo[i]-.00015 or val[i]>hi[i]+.00015 for i in range(3)):
                            raise ValueError(f"{fitout['id']}/{p['id']}: {obj.name} escapes storage bounds: {val} vs {lo}..{hi}")


def dining_anchor(data):
    tables=[f for f in data["furniture"] if "餐桌" in f["name"]]
    if len(tables)!=1:raise ValueError("Exactly one dining table is required for its dependent lighting")
    table=tables[0]
    x,y,w,d=[table[key]/100 for key in ("x","y","w","d")]
    return x+w/2,y+d/2,w,d


def sofa(f):
    x,y,w,d=[f[k]/100 for k in ("x","y","w","d")]
    block("Curved sofa upholstered base",x,y,.10,w,d,.27,mat="Linen",bevel=.12)
    block("Curved sofa full back",x+.035,y+d-.19,.26,w-.07,.19,.53,mat="Linen",bevel=.09)
    for sx in (x+.08,x+w-.08):
        box("Rounded sofa arm",sx,y+d*.48,.28,.16,d*.85,.32,"Linen",.075)
    for i in range(3):
        box("Separate sofa seat cushion",x+.19+(w-.38)*(i+.5)/3,y+d*.39,.365,(w-.38)/3-.012,d*.64,.12,"Cream",.062)
    for px,mat in ((x+.40,"Terracotta"),(x+w-.4,"Sage")):
        ob=box("Textile sofa scatter cushion",px,y+d-.32,.47,.35,.16,.34,mat,.065)
        ob.rotation_euler.x=-.16
    block("Subtle flatwoven living rug",x-.12,y-1.85,.007,w+.24,1.92,.013,mat="WhiteLinen",bevel=.018)


def coffee(f):
    x,y,w,d=[f[k]/100 for k in ("x","y","w","d")]
    # Two round tables remain strictly inside the old 1200x620 mm footprint.
    for px,py,r,h in ((x+.32,y+.31,.30,.38),(x+.88,y+.36,.255,.31)):
        cylinder("Round fluted oak tea-table pedestal",px,py,.015,r*.63,h-.045,"Oak")
        for i in range(24):
            a=i*math.tau/24
            cylinder("Table pedestal flute",px+math.cos(a)*r*.61,py+math.sin(a)*r*.61,.02,.012,h-.05,"Oak",vertices=8)
        cylinder("Rounded warm-stone tea-table top",px,py,h-.035,r,.035,"Stone")
    book_stack(x+.30,y+.26,.383,.20)
    cylinder("Tea cup",x+.88,y+.36,.312,.037,.039,"Ceramic")


def dining_table(f):
    x,y,w,d=[f[k]/100 for k in ("x","y","w","d")]
    block("Soft corner solid-oak dining top",x,y,.735,w,d,.04,mat="Oak",bevel=.035)
    for px in (x+.11,x+w-.11):
        for py in (y+.09,y+d-.09):
            rod("Dining table tapered leg",(px,py,.025),(px,py,.735),.028,"Oak")
    vase(x+w*.52,y+d*.50,.775,.8)
    for px in (x+.29,x+.88):
        cylinder("Stoneware dining plate",px,y+d*.73,.777,.095,.012,"Ceramic")


def kitchen_run(f,north):
    x,y,w,d=[f[k]/100 for k in ("x","y","w","d")]
    block("Kitchen recessed oak toe-kick",x+.025,y+.025,.02,w-.05,d-.05,.08,mat="Walnut",bevel=.003)
    block("Kitchen cabinet carcass",x,y,.1,w,d,.73,mat="Cream",bevel=.008)
    n=round(w/.6)
    front=y+d+.007 if north else y-.007
    for i in range(n):
        px=x+(i+.5)*w/n
        box("Kitchen oak cabinet front",px,front,.11,w/n-.006,.018,.71,"Oak",.004)
        box("Kitchen integrated pull",px,front+(.012 if north else -.012),.775,w/n-.09,.018,.012,"Walnut",.002)
    block("Quartz worktop",x-.006,y-.005,.83,w+.012,d+.01,.028,mat="Stone",bevel=.006)
    if north:
        # Wet preparation zone; sink sits within the real 600 mm counter depth.
        sx,sy=x+.72,y+.31
        box("Sink steel rim",sx,sy,.859,.60,.41,.012,"Chrome",.025)
        box("Inset sink dark bowl",sx,sy,.867,.52,.335,.018,"GlassDark",.045)
        rod("Kitchen tap upright",(sx+.20,sy-.22,.86),(sx+.20,sy-.22,1.17),.017,"Chrome")
        rod("Kitchen tap spout",(sx+.20,sy-.22,1.17),(sx+.20,sy-.03,1.17),.016,"Chrome")
        block("Oak chopping board",x+.10,y+.12,.86,.26,.35,.018,mat="Oak")
        # Short shelf above preparation, not over any added window.
        block("Kitchen open oak shelf",x+.1,y+.015,1.54,min(1.3,w-.2),.23,.025,mat="Oak")
        vase(x+.33,y+.14,1.565,.65)
    else:
        cx,cy=x+1.15,y+.30
        box("Induction glass hob",cx,cy,.861,.65,.50,.018,"GlassDark",.018)
        for dx,dy in ((-.16,-.12),(.16,-.12),(-.16,.12),(.16,.12)):
            cylinder("Induction ring",cx+dx,cy+dy,.881,.085,.001,"Charcoal")
        # South-wall range hood and chimney.
        box("Concealed cooker hood",cx,y+d-.18,1.52,.72,.36,.14,"Cream",.01)
        box("Hood flue",cx,y+d-.13,1.66,.30,.22,.74,"Cream",.01)
        box("Warm backsplash panel",cx,y+d-.006,.86,1.22,.008,.65,"Stone",.001)


def tall_appliance(f, oven=False):
    x,y,w,d=[f[k]/100 for k in ("x","y","w","d")]
    block("Appliance oak surround",x,y,.02,w,d,2.25,mat="Oak",bevel=.01)
    fx=x-.006
    if oven:
        for z in (.63,1.16):
            box("Built-in oven front",fx,y+d/2,z,.02,d-.10,.47,"GlassDark",.014)
            box("Oven bar handle",fx-.035,y+d/2,z+.38,.025,d-.20,.018,"Chrome",.008)
            box("Oven display",fx-.02,y+d/2,z+.44,.008,.18,.012,"Charcoal",.001)
        box("Oven tower upper cupboard",fx,y+d/2,1.69,.02,d-.03,.55,"Cream",.004)
    else:
        box("Integrated refrigerator door",fx,y+d/2,.50,.021,d-.03,1.65,"Cream",.01)
        box("Integrated freezer door",fx,y+d/2,.035,.022,d-.03,.45,"Cream",.01)
        box("Fridge recessed pull",fx-.013,y+.08,.88,.022,.018,.60,"Walnut",.005)


def basin(x,y,w,d,corner=False,face="south"):
    angles={"south":0,"east":math.pi/2,"north":math.pi,"west":-math.pi/2}
    if face not in angles:raise ValueError(f"Unsupported vanity face: {face}")
    bw,bd=(d,w) if face in ("east","west") else (w,d)
    before=set(bpy.context.scene.objects)
    # All countertop, drawer, mirror and tap geometry stays within the
    # recorded footprint; the compact east-facing vanity has no hidden
    # counter overhang or handle consuming its carefully checked passage.
    z=.81
    if not corner:
        block("Floating oak vanity",.005,.005,.34,bw-.01,bd-.045,.43,mat="Oak",bevel=.018)
        for i in range(2):
            box("Vanity drawer front",bw/2,bd-.014,.35+i*.20,bw-.01,.018,.19,"Oak",.006)
        block("Vanity pale stone top",0,0,.77,bw,bd,.035,mat="Stone",bevel=.01)
    box("Ceramic basin",bw/2,bd/2,z,bw*.82,bd*.85,.08,"Ceramic",.04)
    box("Basin hollow",bw/2,bd/2+.012,z+.071,bw*.63,bd*.54,.014,"Stone",.025)
    tapy=.045 if not corner else bd-.04
    rod("Basin tap stem",(bw*.70,tapy,z+.03),(bw*.70,tapy,z+.21),.012,"Chrome")
    rod("Basin tap spout",(bw*.70,tapy,z+.21),(bw*.70,tapy+(.08 if not corner else -.07),z+.21),.010,"Chrome")
    if not corner:
        box("Oak mirror frame",bw/2,.020,1.03,bw-.06,.032,.77,"Oak",.015)
        box("Vanity mirror",bw/2,.038,1.055,bw-.10,.004,.72,"Mirror",.015)
    else:
        box("Compact mirror",bw/2,bd-.012,1.06,bw-.035,.012,.65,"Mirror",.006)
    transform=(Matrix.Translation(Vector((x+w/2,-(y+d/2),0)))
               @ Matrix.Rotation(angles[face],4,"Z")
               @ Matrix.Translation(Vector((-bw/2,bd/2,0))))
    bpy.context.view_layer.update()
    for obj in set(bpy.context.scene.objects)-before:
        obj.matrix_world=transform @ obj.matrix_world
        obj["vanityFace"]=face
        obj["vanityWidthCm"]=round(bw*100,4)
        obj["vanityDepthCm"]=round(bd*100,4)


def toilet(f):
    x,y,w,d=[f[k]/100 for k in ("x","y","w","d")]
    block("Concealed cistern service box",x-.055,y-.005,.02,w+.11,.115,1.08,mat="Stone",bevel=.008)
    box("Flush plate",x+w/2,y+.12,.91,.17,.006,.095,"Chrome",.008)
    # Ellipsoid shell accurately bounded by the fixture footprint; the ceramic
    # rim is an actual torus, not a block labelled 'toilet'.
    sphere("Wall-hung ceramic WC bowl",x+w/2,y+d*.55,.30,w*.48,d*.44,.16,"Ceramic")
    bpy.ops.mesh.primitive_torus_add(major_radius=.13,minor_radius=.024,major_segments=36,minor_segments=10,location=(x+w/2,-(y+d*.55),.443))
    rim=bpy.context.object
    rim.scale=(w/.36,(d*.72)/.31,.42)
    finish(rim,"Soft-close WC seat ring","Ceramic")
    sphere("WC bowl interior",x+w/2,y+d*.55,.423,w*.32,d*.29,.006,"GlassDark")
    box("WC soft-close seat hinge",x+w/2,y+.16,.434,w*.76,.095,.024,"Ceramic",.022)


def shower(f):
    x,y,w,d=[f[k]/100 for k in ("x","y","w","d")]
    block("Shower sloping stone tray",x,y,.009,w,d,.018,mat="Stone",bevel=.006)
    # West shower boundary only; opening runs within the actual compact width.
    panel_length=min(.60,d-.67)
    panel=box("Clear shower folding screen",x+.015,y+.02+panel_length/2,.05,.008,panel_length,1.95,"Glass",.002)
    rod("Shower glass upright",(x+.015,y+.02,.05),(x+.015,y+.02,2),.009,"Chrome")
    # Use the east wall's north solid segment. The V3 window intervals are
    # master y3.65..4.35 and guest y5.30..5.90; 190 mm heads centered at
    # y3.52 / 5.16 end 35 / 45 mm before the respective window openings.
    mount_y=y+.12
    rod("Shower riser",(x+w-.055,mount_y,1.0),(x+w-.055,mount_y,2.13),.011,"Chrome")
    rod("Shower head arm",(x+w-.055,mount_y,2.13),(x+w-.25,mount_y,2.13),.009,"Chrome")
    box("Rain shower head",x+w-.25,mount_y,2.115,.19,.19,.012,"Chrome",.02)
    box("Shower mixer",x+w-.06,mount_y,1.02,.04,.18,.04,"Chrome",.012)
    box("Shower linear drain",x+w-.065,y+d*.50,.03,.035,d*.57,.002,"Chrome",.003)
    box("Shower floating soap shelf",x+w-.055,y+d*.25,1.24,.075,.23,.025,"Stone",.007)


def washer(f):
    x,y,w,d=[f[k]/100 for k in ("x","y","w","d")]
    for i in range(2):
        base=.03+i*.88
        block("Dryer" if i else "Washing machine",x,y,base,w,d,.84,mat="Ceramic",bevel=.032)
        # West-facing appliances open into the clear balcony access strip.
        px=x-.004
        sphere("Round washer black door",px,y+d/2,base+.39,.022,.215,.215,"Charcoal")
        sphere("Washer door glazing",px-.024,y+d/2,base+.39,.012,.166,.166,"GlassDark")
        box("Appliance controls",px-.01,y+d/2,base+.72,.013,d-.09,.075,"Cream",.007)
        sphere("Appliance dial",px-.024,y+d*.75,base+.757,.013,.024,.024,"Chrome")
        box("Appliance display",px-.023,y+d*.34,base+.738,.006,.12,.04,"GlassDark",.003)
    # West is the appliance front. The oak side cheek belongs at the north
    # edge, not on the west face where it would cover both white machines.
    block("Laundry oak side panel",x,y,0,w,.015,2.30,mat="Oak")
    block("Laundry top shelf",x-.015,y,1.81,w+.015,d,.026,mat="Oak")
    for i in range(2):
        box("Linen storage basket",x+.17+i*.28,y+.31,1.85,.23,.38,.27,"Linen",.022)


def furnish(data):
    global CURRENT_ROOM
    for f in data["furniture"]:
        if f.get("storageFitoutId"):
            if not any(item["id"]==f["storageFitoutId"] for item in data.get("storageFitouts",[])):
                raise ValueError(f"Storage wrapper {f['name']} has no matching detailed fitout")
            continue
        x,y,w,d=[f[k]/100 for k in ("x","y","w","d")]
        CURRENT_ROOM=f.get("roomId") or room_at(x+w/2,y+d/2,data["rooms"])
        n=f["name"]
        before=set(bpy.context.scene.objects)
        if "床" in n and "柜" not in n:
            bed(f,"日床" in n)
        elif "沙发" in n:
            sofa(f)
        elif "茶几" in n:
            coffee(f)
        elif "餐桌" in n:
            dining_table(f)
        elif "书桌" in n:
            desk(f)
        elif "椅" in n:
            chair(f)
        elif "电视" in n:
            low_cabinet(f,.40)
            box("Slim television display",x+w/2,y+.08,.75,1.37,.036,.79,"Charcoal",.012)
            box("TV softly reflective screen",x+w/2,y+.100,.768,1.33,.004,.75,"GlassDark",.008)
            vase(x+.19,y+.19,.40,.75)
            book_stack(x+w-.25,y+.18,.40)
        elif "衣柜" in n:
            cabinet(f,2.35)
        elif "玄关柜" in n:
            cabinet(f,2.35,"entry")
        elif "餐边柜" in n or "矮柜" in n:
            low_cabinet(f,.84 if "餐边" in n else .62)
            vase(x+w*.55,y+d*.70,.84 if "餐边" in n else .62)
        elif "厨房" in n and "地柜" in n:
            kitchen_run(f,"北" in n)
        elif "冰箱" in n:
            tall_appliance(f)
        elif "蒸烤" in n:
            tall_appliance(f,True)
        elif "洗烘" in n:
            washer(f)
        elif "家政柜" in n:
            low_cabinet(f,.86)
        elif "浴室柜" in n:
            basin(x,y,w,d,face=f.get("face","south"))
        elif "角盆" in n:
            basin(x,y,w,d,True,face=f.get("face","south"))
        elif "马桶" in n:
            toilet(f)
        elif "淋浴" in n:
            shower(f)
        elif "绿植" in n:
            plant(x+w/2,y+d/2)
        else:
            block(n,x,y,0,w,d,.70,mat="Oak")
        for obj in set(bpy.context.scene.objects)-before:
            obj["furnitureId"]=str(f.get("id") or f.get("furnitureId") or n)
            obj["furnitureName"]=n
            if "face" in f:obj["furnitureFace"]=f["face"]
            if "doorStyle" in f:obj["doorStyle"]=f["doorStyle"]
    bay_fitouts(data)
    storage_fitouts(data)
    CURRENT_ROOM="living"
    lamp(6.48,8.98)
    # Keep the same composition relative to the source dining table, so its
    # 400 mm east/north move does not leave lamps above the former position.
    dcx,dcy,dw,dd=dining_anchor(data)
    py=dcy-dd/70
    for fraction,z,r in ((-5/24,2.05,.18),(11/60,2.17,.13)):
        x=dcx+dw*fraction
        cylinder("Dining pendant ceiling rose",x,py,2.67,.055,.025,"Cream")
        rod("Pendant thin suspension",(x,py,2.67),(x,py,z+.12),.003,"Charcoal")
        cylinder("Organic linen pendant",x,py,z-.06,r,.18,"Linen",r2=r*.64)
        cylinder("Pendant opal diffuser",x,py,z-.065,r*.90,.01,"Lamp")
    if not data.get("storageFitouts"):
        framed_art(2.135,10.30,1.17,.6,.75,"west")


VIEWS = {
    "overall": ((15.5,21.5,16.5),(4.2,7.0,.3),48),
    "living": ((6.32,10.81,1.60),(4.38,7.60,1.05),23),
    "dining": ((4.87,13.62,1.62),(3.03,11.50,1.05),23),
    "master": ((5.50,3.02,1.58),(5.33,1.27,1.00),18),
    "bedroom-b": ((2.96,2.58,1.60),(1.55,1.20,.97),20),
    "study": ((3.00,4.50,1.62),(1.30,5.15,1.02),20),
    "kitchen": ((5.73,12.45,1.58),(7.67,12.82,1.10),20),
    "master-bath": ((6.57,4.65,1.60),(4.85,3.95,1.12),18),
    "guest-bath": ((6.54,6.03,1.60),(4.95,5.36,1.06),17),
    "balcony": ((5.60,10.70,1.45),(7.72,10.35,1.18),20),
    "bay-master": ((4.30,2.98,1.60),(4.72,.24,1.04),18),
    "bay-tea": ((2.82,1.50,1.52),(1.53,-.11,1.03),18),
    "bay-living": ((4.13,9.08,1.65),(2.30,7.47,1.15),22),
    "entry-storage": ((3.20,12.75,1.45),(5.11,13.475,1.32),18),
    "sideboard": ((4.88,12.08,1.60),(2.68,12.99,1.28),20),
}


def camera(name, pos, target, lens):
    data=bpy.data.cameras.new(name)
    obj=bpy.data.objects.new(name,data)
    col("Cameras").objects.link(obj)
    obj.location=(pos[0],-pos[1],pos[2])
    direction=Vector((target[0],-target[1],target[2]))-obj.location
    obj.rotation_euler=direction.to_track_quat("-Z","Y").to_euler()
    data.lens=lens
    data.clip_start=.025
    data.clip_end=150
    data.sensor_width=36
    data.dof.use_dof=False
    obj["kind"]="camera"
    if name=="overall":
        data.type="ORTHO"
        data.ortho_scale=22.0
    return obj


def area(name, pos, target, energy, size, color=(1,.90,.76)):
    data=bpy.data.lights.new(name,"AREA")
    data.energy=energy
    data.shape="DISK"
    data.size=size
    data.color=color
    obj=bpy.data.objects.new(name,data)
    col("Lighting").objects.link(obj)
    obj.location=(pos[0],-pos[1],pos[2])
    obj.rotation_euler=(Vector((target[0],-target[1],target[2]))-obj.location).to_track_quat("-Z","Y").to_euler()
    obj["kind"]="light"
    return obj


def lighting(data):
    world=bpy.data.worlds.new("Soft Guangzhou daylight")
    world.use_nodes=True
    world.node_tree.nodes.get("Background").inputs["Color"].default_value=(.80,.87,1.0,1)
    world.node_tree.nodes.get("Background").inputs["Strength"].default_value=.30
    bpy.context.scene.world=world
    area("Large daylight softbox",(0,-3,8),(4,6,0),2000,8,(.87,.92,1))
    area("West window daylight",(-2,7.3,4),(4.7,8,1),650,4,(1,.94,.85))
    area("East gentle fill",(10,9,6),(4,7,0),1000,7,(1,.91,.78))
    for room in data["rooms"]:
        pts=room["points"]
        xs,ys=[p[0]/100 for p in pts],[p[1]/100 for p in pts]
        x,y=(min(xs)+max(xs))/2,(min(ys)+max(ys))/2
        if room["id"]=="living":
            x,y=4.4,8.8
        energy=70 if room["tone"]=="wet" else 125
        area("Interior ceiling bounce / "+room["id"],(x,y,2.59),(x,y,.1),energy,1.4,(1,.86,.68))
        global CURRENT_ROOM
        CURRENT_ROOM=room["id"]
        cylinder("Flush ceiling light",x,y,2.63,.15,.033,"Cream")
        cylinder("Opal ceiling diffuser",x,y,2.625,.13,.008,"Lamp")
    dcx,dcy,dw,dd=dining_anchor(data)
    area("Dining ambient",(dcx,dcy-dd/14,2.60),(dcx,dcy-dd/14,0),100,1.5,(1,.87,.70))


def three(p):
    return [round(p[0],4),round(p[2],4),round(p[1],4)]


def polygon_area(pts):
    return abs(sum(pts[i][0]*pts[(i+1)%len(pts)][1]-pts[(i+1)%len(pts)][0]*pts[i][1] for i in range(len(pts))))/20000


BAY_DESCRIPTIONS = {
    "living":"奶油布艺、浅橡木与圆形双茶几；电视仍在北侧实墙，西侧为外凸飘窗及并肩学习办公条件方案。",
    "master":"1500×2000 mm 床垫配 1600×2100 mm 床架，床头向东、脚向西；北飘窗仅设一张连续高台和一把匹配椅，取消独立书桌，不挖原台借腿位。南侧套内门进入主卫。",
    "bedroom-b":"1350×2000 mm 床垫配 1450×2100 mm 床架，床头向西、脚向东；南墙北向移门衣柜保留，普通书桌与书椅已取消。北飘窗低台茶座仍为附条件展示，非实测现状。",
}
BAY_NOTE="三处飘窗的 600 mm 外挑和实心侧返边均为待复尺暂定表达，不增加房间净面积。主卧以未实测的 900 mm 原台为条件，做约 930 mm 完成面（模型 931 mm）的一体连续高台，仅配一把完成座高 640 mm、脚踏高 250 mm 的椅；不是 750 mm 普通书桌，原台不挖腿洞。室内内挑及支撑承载需厂家和结构核验。客厅原台仍暂按 900 mm；次卧茶座的 430 mm 低台仅在结构、承载与防坠条件通过时成立，不表示可以降低原结构。细金属框和无绳卷帘为拟更换设计，外立面许可与窗扇活动范围未核验。"


def manifest(data, openings, src):
    rooms=[]
    mapping=[("living","living","客厅"),("dining","living","餐厅与玄关"),("master","room_a","主卧"),("bedroom-b","room_b","次卧 B"),("study","room_c","书房 · 客卧"),("kitchen","kitchen","厨房"),("master-bath","bath_1","主卫"),("guest-bath","bath_2","客卫"),("balcony","balcony","家政阳台")]
    desc={
        "living":"奶油布艺与浅橡木，圆形双茶几保留宽松动线；电视位于北侧实墙，西窗完整保留。",
        "dining":"1.20 米实木餐桌与轻盈餐椅，浅木玄关储物及暖色吊灯。",
        "master":"1500×2000 mm 床垫配 1600×2100 mm 床架，床头向东；西墙衣柜朝东，南侧套内门进入主卫。",
        "bedroom-b":"1350×2000 mm 床垫配 1450×2100 mm 床架，床头向西；南墙设北向移门衣柜，东北保留书桌。",
        "study":"1.00 米日床、独立书桌和客用衣柜，在实有空间里兼顾办公与偶住。",
        "kitchen":"双排地柜位置不变；厨房西门暂拓至1700mm，三扇三轨玻璃门向北洞内叠停，模型净开约1033mm。门套距鞋柜仅50mm，扩洞和轨道固定待结构及管线核验。",
        "master-bath":"750 mm 宽、400 mm 深盆柜靠西墙朝东；北侧套内门通主卧，阶梯共墙保留东侧淋浴。通路紧凑，非无障碍方案。",
        "guest-bath":"600 mm 宽、350 mm 深浅盆柜置于西北凹位，保留公共过道入口、壁挂马桶及 440 mm 局部固定淋浴玻璃。",
        "balcony":"洗烘叠放与家政收纳为拟改造方案；保留西侧门，南侧窗位及外侧封窗尚未核实，边界为建模占位。",
    }
    if any(op.get("windowType")=="bay" for op in openings):
        desc.update(BAY_DESCRIPTIONS)
    fitouts_by_room={item["roomId"]:item for item in data.get("bayFitouts",[])}
    for view,rid,_name in mapping:
        if rid in fitouts_by_room and view!="dining":
            desc[view]+=" "+fitouts_by_room[rid].get("summary","")
    storage=data.get("storageFitouts",[])
    if storage:
        desc["dining"]="1.20 米四人餐桌与四椅沿用共享数据位置，双吊灯与餐桌对应。"+" ".join(item.get("summary","") for item in storage)
        desc["living"]+=" 入户右侧沿厨房墙布置面西浅鞋柜；左侧西墙长餐柜沿南墙转为7字，鞋与杯盘独立分腔，不设固定换鞋凳。"
    for view,rid,name in mapping:
        room=next(r for r in data["rooms"] if r["id"]==rid)
        pos,target,lens=VIEWS[view]
        pts=room["points"]
        cx=sum(p[0] for p in pts)/len(pts)/100
        cy=sum(p[1] for p in pts)/len(pts)/100
        if view=="dining":cx,cy=3.7,12.2
        if view=="living":cx,cy=4.5,8.8
        rooms.append({"id":"dining" if view=="dining" else rid,"name":name,"area":round(polygon_area(pts),2),"points":[[x/100,y/100] for x,y in pts],"camera":{"position":[cx+3.0,5.2,cy+4],"target":[cx,.65,cy]},"interiorCamera":{"position":three(pos),"target":three(target),"horizontalFov":round(math.degrees(2*math.atan(36/(2*lens))),2),"fov":round(math.degrees(2*math.atan(24/(2*lens))),2)},"render":f"assets/blender-renders/{view}.jpg","description":desc[view],"features":["同一 Blender 场景生成模型和渲染","原木 · 奶油白 · 亚麻","门窗尺寸现场复尺"]})
        if rid in fitouts_by_room and view!="dining":
            fitout=fitouts_by_room[rid]
            rooms[-1]["fitoutId"]=fitout["id"]
            rooms[-1]["features"].extend(fitout.get("dimensions",[]))
            rooms[-1]["conditions"]=fitout.get("conditions",[])
        if view=="dining" and storage:
            rooms[-1]["storageFitoutIds"]=[item["id"] for item in storage]
            rooms[-1]["features"].extend(dimension for item in storage for dimension in item.get("dimensions",[]))
            rooms[-1]["conditions"]=[condition for item in storage for condition in item.get("conditions",[])]
    result={"version":"3.0 Blender 原木实景模型","model":"models/huiyayuan-wood.glb","blend":"models/huiyayuan-wood.blend","units":"m","source":str(src.relative_to(ROOT)).replace("\\","/"),"sourceSha256":hashlib.sha256(src.read_bytes().replace(b"\r\n", b"\n")).hexdigest(),"bounds":{"min":[0,-.012,0],"max":[8.41,2.7,14.01]},"overviewCamera":{"position":three(VIEWS["overall"][0]),"target":three(VIEWS["overall"][1])},"overallRender":"assets/blender-renders/overall.jpg","rooms":rooms,"openings":openings,"design":{"style":"现代原木","palette":["#eee9df","#bb956b","#d4c9b5","#758364","#b98165"]},"notes":["真实网格由厘米平面数据转换为米；渲染与交互使用同一 Blender 场景。","整体与房间鸟瞰采用可拆墙展示；室内机位使用完整墙体与实际开口。","C 级门窗、层高与统一墙厚仍为待现场复尺的建模假设。"]}
    result["bounds"]=geometry_bounds(data,openings)
    detail_views={"office_vanity":"bay-master","tea_seat":"bay-tea","family_desk":"bay-living"}
    result["bayDetails"]=[]
    for fitout in data.get("bayFitouts",[]):
        view=detail_views[fitout["type"]]
        pos,target,lens=VIEWS[view]
        result["bayDetails"].append({"id":view,"fitoutId":fitout["id"],"openingId":fitout["openingId"],"roomId":fitout["roomId"],"title":fitout["title"],"render":f"assets/blender-renders/{view}.jpg","interiorCamera":{"position":three(pos),"target":three(target),"horizontalFov":round(math.degrees(2*math.atan(36/(2*lens))),2),"fov":round(math.degrees(2*math.atan(24/(2*lens))),2)},"summary":fitout.get("summary",""),"dimensions":fitout.get("dimensions",[]),"conditions":fitout.get("conditions",[])})
    result["storageDetails"]=[]
    for fitout in storage:
        view={"entry":"entry-storage","sideboard":"sideboard"}[fitout["type"]]
        pos,target,lens=VIEWS[view]
        result["storageDetails"].append({"id":view,"storageFitoutId":fitout["id"],"fitoutId":fitout["id"],"roomId":fitout["roomId"],"title":fitout["title"],"render":f"assets/blender-renders/{view}.jpg","interiorCamera":{"position":three(pos),"target":three(target),"horizontalFov":round(math.degrees(2*math.atan(36/(2*lens))),2),"fov":round(math.degrees(2*math.atan(24/(2*lens))),2)},"summary":fitout.get("summary",""),"dimensions":fitout.get("dimensions",[]),"conditions":fitout.get("conditions",[]),"references":fitout.get("references",[])})
    if storage:
        result["notes"].append("入户右侧浅鞋柜与左侧7字杯盘柜独立分腔；仅餐柜北两模块设闭合浅抽屉，250 mm 伸出限位、进出通道及桌椅退让均属条件校核，其余下柜为满高移门。封闭转角不计可用容量。柜体锚固、灯带/插座、门套把手限位、电箱与实际净深必须现场深化。")
    if any(op.get("windowType")=="bay" for op in openings):
        result["notes"].append(BAY_NOTE)
    (MODEL_DIR/"scene-manifest.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")


def build(args):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)
    scene=bpy.context.scene
    scene.unit_settings.system="METRIC"
    scene.unit_settings.scale_length=1
    src=MODEL_DIR/"design-data.json"
    if not src.exists():src=MODEL_DIR/"model-data.json"
    data=json.loads(src.read_text(encoding="utf-8"))
    global HEIGHT,THICK
    HEIGHT=float(data.get("wallHeightCm",270))/100
    THICK=float(data.get("wallThicknessCm",12))/100
    setup_materials()
    floors(data)
    openings=load_openings(data)
    wall_and_openings(data,openings)
    furnish(data)
    lighting(data)
    for name,(pos,target,lens) in VIEWS.items():camera(name,pos,target,lens)
    # A quiet studio ground is render-only, never part of the apartment GLB.
    box("Presentation ground",4.2,7,-.20,200,200,.15,"Cream",0,"backdrop",collection="Presentation")
    scene.camera=bpy.data.objects["overall"]
    configure_render(args)
    manifest(data,openings,src)
    bpy.ops.wm.save_as_mainfile(filepath=str(MODEL_DIR/"huiyayuan-wood.blend"),compress=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in scene.objects:
        if obj.type=="MESH" and obj.get("kind") not in ("ceiling","backdrop"):
            obj.hide_set(False)
            obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(MODEL_DIR/"huiyayuan-wood.glb"),export_format="GLB",use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True,export_texcoords=True,export_normals=True,export_materials="EXPORT",export_image_format="AUTO")
    bpy.ops.object.select_all(action="DESELECT")
    print("BUILD_COMPLETE",json.dumps({"objects":len(scene.objects),"glbMB":round((MODEL_DIR/"huiyayuan-wood.glb").stat().st_size/1e6,2)}),flush=True)


def configure_render(args):
    scene=bpy.context.scene
    scene.render.engine=args.engine
    scene.render.resolution_x=args.resolution
    scene.render.resolution_y=round(args.resolution*2/3)
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="JPEG"
    scene.render.image_settings.quality=94
    scene.render.film_transparent=False
    scene.render.use_file_extension=True
    scene.view_settings.view_transform="AgX"
    try:scene.view_settings.look="AgX - Medium High Contrast"
    except TypeError:pass
    scene.view_settings.exposure=.25
    if args.engine=="CYCLES":
        scene.cycles.samples=args.samples
        scene.cycles.use_denoising=True
        scene.cycles.max_bounces=7
        scene.cycles.diffuse_bounces=4
        scene.cycles.glossy_bounces=4
        scene.cycles.transmission_bounces=6
        scene.cycles.transparent_max_bounces=8
        scene.cycles.adaptive_threshold=.04
        try:
            prefs=bpy.context.preferences.addons["cycles"].preferences
            for backend in ("OPTIX","CUDA","HIP","ONEAPI","METAL"):
                try:
                    prefs.compute_device_type=backend
                    prefs.get_devices()
                    gpu=[d for d in prefs.devices if d.type!="CPU"]
                    if gpu:
                        for dev in prefs.devices:dev.use=dev.type!="CPU"
                        scene.cycles.device="GPU"
                        print("CYCLES_GPU",backend,flush=True)
                        break
                except (TypeError,RuntimeError):continue
        except (KeyError,AttributeError):pass


def render_camera_state(cam):
    return {"matrix":[list(row) for row in cam.matrix_world],"lens":cam.data.lens,"sensorWidth":cam.data.sensor_width,"type":cam.data.type,"orthoScale":cam.data.ortho_scale}


def render_camera_hash(state):
    return hashlib.sha256(json.dumps(state,sort_keys=True,separators=(",",":")).encode()).hexdigest()


def render(args):
    RENDER_DIR.mkdir(parents=True,exist_ok=True)
    configure_render(args)
    names=list(VIEWS) if args.render=="all" else args.render.split(",")
    scene=bpy.context.scene
    manifest_path=MODEL_DIR/"scene-manifest.json"
    current_manifest=json.loads(manifest_path.read_text(encoding="utf-8"))
    blend_sha=hashlib.sha256((MODEL_DIR/"huiyayuan-wood.blend").read_bytes()).hexdigest()
    if current_manifest.get("baseBlendSha256")!=blend_sha:
        current_manifest["renderedViews"]={}
    current_manifest["baseBlendSha256"]=blend_sha
    # Earlier preview frames already have camera/image/model hashes. Add the
    # inspectable state only by reading this same saved scene and matching
    # their exact recorded hash; never retrofit a guessed camera to an image.
    for previous_name,record in current_manifest.get("renderedViews",{}).items():
        cam=bpy.data.objects.get(previous_name)
        if not cam or cam.type!="CAMERA":raise ValueError("Recorded camera is missing: "+previous_name)
        state=render_camera_state(cam)
        if record.get("baseBlendSha256")==blend_sha and record.get("cameraHash")==render_camera_hash(state):
            record["cameraState"]=state
        elif previous_name not in names:
            raise ValueError("Camera provenance mismatch; re-render "+previous_name)
    frame_spec={"engine":args.engine,"width":args.resolution,"height":round(args.resolution*2/3),"samples":args.samples,"denoise":args.engine=="CYCLES"}
    current_manifest["renderSpec"]=frame_spec
    for name in names:
        if name not in VIEWS:raise ValueError(f"Unknown view {name}: {list(VIEWS)}")
        scene.camera=bpy.data.objects[name]
        overall=name=="overall"
        # Overall keeps the geometry but temporarily hides the two closest
        # exterior faces for the familiar open dollhouse presentation.
        for obj in scene.objects:
            if obj.get("kind")=="ceiling":obj.hide_render=overall
            elif obj.get("kind")=="wall":
                obj.hide_render=overall and obj.get("wallIndex") in (4,5,6)
            elif obj.get("kind") in ("window","door"):
                obj.hide_render=False
        scene.render.filepath=str(RENDER_DIR/(name+".jpg"))
        print("RENDER_START",name,flush=True)
        bpy.ops.render.render(write_still=True)
        cam=scene.camera
        camera_state=render_camera_state(cam)
        current_manifest.setdefault("renderedViews",{})[name]={
            "sourceSha256":current_manifest["sourceSha256"],
            "baseBlendSha256":blend_sha,
            "cameraState":camera_state,
            "cameraHash":render_camera_hash(camera_state),
            "renderSpec":frame_spec,
            "imageSha256":hashlib.sha256((RENDER_DIR/(name+".jpg")).read_bytes()).hexdigest(),
        }
        manifest_path.write_text(json.dumps(current_manifest,ensure_ascii=False,indent=2),encoding="utf-8")
        print("RENDER_COMPLETE",name,flush=True)


def main():
    args=parse_args()
    MODEL_DIR.mkdir(parents=True,exist_ok=True)
    if not args.reuse:build(args)
    if not args.only_build:render(args)


if __name__=="__main__":main()
