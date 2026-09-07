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
from mathutils import Vector

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
    The 900 mm sill remains a dimensional assumption, not a seating design.
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
    frame=.038
    def part(label,along,depth,z,width,depth_size,height,mat,role,bevel=.003):
        px,py=cx+tx*along+nx*depth,cy+ty*along+ny*depth
        ob=box(op["id"]+" / bay "+label,px,py,z,width if abs(tx)>.5 else depth_size,depth_size if abs(tx)>.5 else width,height,mat,bevel,"window")
        ob["openingId"]=op["id"]
        ob["windowType"]="bay"
        ob["bayRole"]=role
        ob["bayProjectionCm"]=float(b["projectionCm"])
        return ob
    # Jambs, head, and sill meet rather than overlapping coplanar surfaces.
    for sign in (-1,1):
        part("front jamb",sign*(length/2-frame/2),front,sill+frame,frame,.10,h-2*frame,"Oak","frontFrame")
    part("front head",0,front,sill+h-frame,length,.10,frame,"Oak","frontFrame")
    part("front sill frame",0,front,sill,length,.10,frame,"Oak","frontFrame")
    count=3 if length>1.7 else 2
    for i in range(1,count):
        part("front mullion",-length/2+i*length/count,front,sill+frame,.028,.080,h-2*frame,"Oak","frontFrame")
    part("front transom",0,front,sill+h*.78,length-2*frame,.070,.025,"Oak","frontFrame")
    part("front clear glazing",0,front,sill+frame,length-2*frame,.007,h-2*frame,"Glass","frontGlazing",.001)
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
    # Curtains remain at the room side of the original opening, not in the bay.
    for sign in (-1,1):
        for fold in range(5):
            along=sign*(length/2+.028+fold*.033)
            part("indoor linen curtain",along,-(THICK/2+.04),.12,.030,.070,2.35,"WhiteLinen","curtain",.003)


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


def opening_details(op, data):
    global CURRENT_ROOM
    x1,y1,x2,y2 = [op[k]/100 for k in ("x1","y1","x2","y2")]
    vertical = abs(x2-x1)<.001
    length = math.hypot(x2-x1,y2-y1)
    cx, cy = (x1+x2)/2, (y1+y2)/2
    sill, h = op["sill"], op["height"]
    roommap = {"window_b":"room_b","window_a":"room_a","window_c":"room_c","door_b":"room_b","door_a":"room_a","door_c":"room_c","door_bath_1":"bath_1","door_bath_2":"bath_2","door_kitchen":"kitchen","balcony_door":"balcony"}
    CURRENT_ROOM = op.get("roomId") or roommap.get(op["id"], room_at(cx-.1,cy+.1,data["rooms"]))
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
    x,y,w,d=[f[k]/100 for k in ("x","y","w","d")]
    prefix=f["name"]
    block(prefix+" solid oak plinth",x+.025,y+.025,.05,w-.05,d-.05,.18,mat="Oak",bevel=.035)
    head_height=.75 if CURRENT_ROOM in ("room_a","room_b") else .84
    block(prefix+" upholstered headboard",x,y,.13,w,.075,head_height,mat="Linen",bevel=.033)
    block(prefix+" mattress",x+.025,y+.065,.23,w-.05,d-.085,.20,mat="WhiteLinen",bevel=.075)
    block(prefix+" rounded duvet",x+.015,y+.52,.424,w-.03,d-.55,.095,mat="Cream",bevel=.06)
    block(prefix+" sage throw",x+.01,y+d-.47,.521,w-.02,.35,.026,mat="Sage",bevel=.012)
    count=1 if w<1.15 else 2
    for i in range(count):
        pw=(w-.15)/count
        ob=box("Soft sleeping pillow",x+.075+pw*(i+.5),y+.31,.444,pw-.04,.38,.12,"WhiteLinen",.085)
        ob.rotation_euler.x=.06
    if daybed:
        block("Daybed side upholstered rail",x,y+.05,.20,.07,d-.07,.43,mat="Linen",bevel=.03)
        for off in (.8,1.3):
            ob=box("Daybed sage cushion",x+.17,y+off,.44,.14,.40,.36,"Sage",.055)
            ob.rotation_euler.y=-.18
    else:
        # Tiny wall shelf only when it remains inside the room envelope.
        sx=x+w+.15
        if (CURRENT_ROOM=="room_a" and sx+.14<6.16):
            box("Oak bedside floating shelf",sx,y+.33,.43,.28,.33,.045,"Oak",.018)
            lamp(sx,y+.33,.475,True)


def cabinet(f, h=2.35, style="wardrobe"):
    x,y,w,d=[f[k]/100 for k in ("x","y","w","d")]
    name=f["name"]
    block(name+" recessed plinth",x+.025,y+.025,.015,w-.05,d-.05,.065,mat="Walnut",bevel=.005)
    block(name+" carcass",x,y,.08,w,d,h-.08,mat="Oak",bevel=.006)
    # Deep thin cupboards running north/south face east or west; wardrobes at
    # the east wall face west. Normal horizontal units face south.
    if d>w*1.4:
        facewest=f.get("face", "west" if x>5 else "east")=="west"
        fx=x-.009 if facewest else x+w+.009
        n=max(2,round(d/.48))
        for i in range(n):
            box(name+" door",fx,y+(i+.5)*d/n,.085,.019,d/n-.006,h-.095,"Cream" if style=="entry" else "Oak",.004)
            box(name+" brass pull",fx+(-.016 if facewest else .016),y+(i+.83)*d/n,.94,.017,.012,.18,"Brass",.004)
    else:
        n=max(2,round(w/.48))
        for i in range(n):
            box(name+" door",x+(i+.5)*w/n,y+d+.009,.085,w/n-.006,.019,h-.095,"Oak",.004)
            box(name+" brass pull",x+(i+.82)*w/n,y+d+.025,.94,.012,.017,.18,"Brass",.004)


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


def desk(f):
    x,y,w,d=[f[k]/100 for k in ("x","y","w","d")]
    block("Oak desk desktop",x,y,.73,w,d,.035,mat="Oak",bevel=.012)
    for px,py in ((x+.04,y+.04),(x+w-.04,y+.04),(x+.04,y+d-.04),(x+w-.04,y+d-.04)):
        cylinder("Desk turned leg",px,py,.02,.023,.71,"Oak",vertices=16)
    lamp(x+w*.75,y+d*(.75 if f.get("face")=="north" else .25),.765,True)
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


def basin(x,y,w,d,corner=False):
    z=.81
    if not corner:
        block("Floating oak vanity",x,y,.34,w,d,.43,mat="Oak",bevel=.018)
        for i in range(2):
            box("Vanity drawer front",x+w/2,y+d+.004,.35+i*.20,w-.01,.018,.19,"Oak",.006)
        block("Vanity pale stone top",x-.005,y-.005,.77,w+.01,d+.01,.035,mat="Stone",bevel=.01)
    box("Ceramic basin",x+w/2,y+d/2,z,w*.82,d*.85,.08,"Ceramic",.04)
    box("Basin hollow",x+w/2,y+d/2+.012,z+.071,w*.63,d*.54,.014,"Stone",.025)
    tapy=y+.045 if not corner else y+d-.04
    rod("Basin tap stem",(x+w*.70,tapy,z+.03),(x+w*.70,tapy,z+.21),.012,"Chrome")
    rod("Basin tap spout",(x+w*.70,tapy,z+.21),(x+w*.70,tapy+(.08 if not corner else -.07),z+.21),.010,"Chrome")
    if not corner:
        box("Oak mirror frame",x+w/2,y-.012,1.03,w-.06,.04,.77,"Oak",.05)
        box("Vanity mirror",x+w/2,y+.011,1.055,w-.10,.005,.72,"Mirror",.04)
    else:
        box("Compact mirror",x+w/2,y+d-.012,1.06,w-.035,.012,.65,"Mirror",.025)


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
        x,y,w,d=[f[k]/100 for k in ("x","y","w","d")]
        CURRENT_ROOM=f.get("roomId") or room_at(x+w/2,y+d/2,data["rooms"])
        n=f["name"]
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
            basin(x,y,w,d)
        elif "角盆" in n:
            basin(x,y,w,d,True)
        elif "马桶" in n:
            toilet(f)
        elif "淋浴" in n:
            shower(f)
        elif "绿植" in n:
            plant(x+w/2,y+d/2)
        else:
            block(n,x,y,0,w,d,.70,mat="Oak")
    CURRENT_ROOM="living"
    lamp(6.48,8.98)
    # Pendant group over dining table, compact and true to the 1.20 m table.
    for x,z,r in ((3.25,2.05,.18),(3.72,2.17,.13)):
        cylinder("Dining pendant ceiling rose",x,11.84,2.67,.055,.025,"Cream")
        rod("Pendant thin suspension",(x,11.84,2.67),(x,11.84,z+.12),.003,"Charcoal")
        cylinder("Organic linen pendant",x,11.84,z-.06,r,.18,"Linen",r2=r*.64)
        cylinder("Pendant opal diffuser",x,11.84,z-.065,r*.90,.01,"Lamp")
    framed_art(2.135,10.30,1.17,.6,.75,"west")


VIEWS = {
    "overall": ((15.5,21.5,16.5),(4.2,7.0,.3),48),
    "living": ((6.32,10.81,1.60),(4.38,7.60,1.05),23),
    "dining": ((4.87,13.62,1.62),(3.03,11.50,1.05),23),
    "master": ((5.80,2.88,1.60),(4.36,1.28,.92),22),
    "bedroom-b": ((2.93,2.98,1.59),(1.10,1.18,.91),21),
    "study": ((3.00,4.50,1.62),(1.30,5.15,1.02),20),
    "kitchen": ((5.73,12.45,1.58),(7.67,12.82,1.10),20),
    "master-bath": ((4.34,4.64,1.58),(6.02,3.99,1.10),18),
    "guest-bath": ((4.35,6.035,1.58),(6.02,5.49,1.10),17),
    "balcony": ((5.60,10.70,1.45),(7.72,10.35,1.18),20),
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
    area("Dining ambient",(3.5,11.8,2.60),(3.5,11.8,0),100,1.5,(1,.87,.70))


def three(p):
    return [round(p[0],4),round(p[2],4),round(p[1],4)]


def polygon_area(pts):
    return abs(sum(pts[i][0]*pts[(i+1)%len(pts)][1]-pts[(i+1)%len(pts)][0]*pts[i][1] for i in range(len(pts))))/20000


BAY_DESCRIPTIONS = {
    "living":"奶油布艺、浅橡木与圆形双茶几；电视位于北侧实墙，西侧恢复向外凸出的飘窗。外挑 600 mm、窗台 900 mm 暂定待复尺，不预设为坐榻。",
    "master":"1.50 米床、轻薄床头和浅橡木衣柜；北侧恢复向外凸出的飘窗。外挑 600 mm、窗台 900 mm 与窗高均待复尺，不预设为坐榻。",
    "bedroom-b":"1.35 米床与书桌保留紧凑布局；北侧恢复向外凸出的飘窗，门厅按修订平面保留。外挑深度与窗台高度待复尺。",
}
BAY_NOTE="主卧、次卧与客厅三处为外凸飘窗；600 mm 外挑、900 mm 窗台及实心侧返边均是待复尺的 C 级暂定表达，不增加房间净面积。"


def manifest(data, openings, src):
    rooms=[]
    mapping=[("living","living","客厅"),("dining","living","餐厅与玄关"),("master","room_a","主卧"),("bedroom-b","room_b","次卧 B"),("study","room_c","书房 · 客卧"),("kitchen","kitchen","厨房"),("master-bath","bath_1","主卫"),("guest-bath","bath_2","客卫"),("balcony","balcony","家政阳台")]
    desc={"living":"奶油布艺与浅橡木，圆形双茶几保留宽松动线；电视位于北侧实墙，西窗完整保留。","dining":"1.20 米实木餐桌与轻盈餐椅，浅木玄关储物及暖色吊灯。","master":"1.50 米床、轻薄床头和浅橡木整墙衣柜；保留图示北窗位置，窗高待现场复尺。","bedroom-b":"1.35 米床与书桌组成紧凑而完整的卧室，门口与走廊按修订平面核对。","study":"1.00 米日床、独立书桌和客用衣柜，在实有空间里兼顾办公与偶住。","kitchen":"双排地柜、集成冰箱及蒸烤高柜，暖白石材台面与浅橡木门板。","master-bath":"800 mm 浴室柜、壁挂马桶和东侧淋浴屏，石材与木色呼应。","guest-bath":"400 mm 角盆、紧凑壁挂马桶和 440 mm 局部固定淋浴玻璃，维持狭小湿区边界。","balcony":"洗烘叠放与家政收纳；阳台外侧封窗或开口尚未核实，外侧边界为建模占位。"}
    if any(op.get("windowType")=="bay" for op in openings):
        desc.update(BAY_DESCRIPTIONS)
    for view,rid,name in mapping:
        room=next(r for r in data["rooms"] if r["id"]==rid)
        pos,target,lens=VIEWS[view]
        pts=room["points"]
        cx=sum(p[0] for p in pts)/len(pts)/100
        cy=sum(p[1] for p in pts)/len(pts)/100
        if view=="dining":cx,cy=3.7,12.2
        if view=="living":cx,cy=4.5,8.8
        rooms.append({"id":"dining" if view=="dining" else rid,"name":name,"area":round(polygon_area(pts),2),"points":[[x/100,y/100] for x,y in pts],"camera":{"position":[cx+3.0,5.2,cy+4],"target":[cx,.65,cy]},"interiorCamera":{"position":three(pos),"target":three(target),"horizontalFov":round(math.degrees(2*math.atan(36/(2*lens))),2),"fov":round(math.degrees(2*math.atan(24/(2*lens))),2)},"render":f"assets/blender-renders/{view}.jpg","description":desc[view],"features":["同一 Blender 场景生成模型和渲染","原木 · 奶油白 · 亚麻","门窗尺寸现场复尺"]})
    result={"version":"3.0 Blender 原木实景模型","model":"models/huiyayuan-wood.glb","blend":"models/huiyayuan-wood.blend","units":"m","source":str(src.relative_to(ROOT)).replace("\\","/"),"sourceSha256":hashlib.sha256(src.read_bytes().replace(b"\r\n", b"\n")).hexdigest(),"bounds":{"min":[0,-.012,0],"max":[8.41,2.7,14.01]},"overviewCamera":{"position":three(VIEWS["overall"][0]),"target":three(VIEWS["overall"][1])},"overallRender":"assets/blender-renders/overall.jpg","rooms":rooms,"openings":openings,"design":{"style":"现代原木","palette":["#eee9df","#bb956b","#d4c9b5","#758364","#b98165"]},"notes":["真实网格由厘米平面数据转换为米；渲染与交互使用同一 Blender 场景。","整体与房间鸟瞰采用可拆墙展示；室内机位使用完整墙体与实际开口。","C 级门窗、层高与统一墙厚仍为待现场复尺的建模假设。"]}
    result["bounds"]=geometry_bounds(data,openings)
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


def render(args):
    RENDER_DIR.mkdir(parents=True,exist_ok=True)
    configure_render(args)
    names=list(VIEWS) if args.render=="all" else args.render.split(",")
    scene=bpy.context.scene
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
        print("RENDER_COMPLETE",name,flush=True)


def main():
    args=parse_args()
    MODEL_DIR.mkdir(parents=True,exist_ok=True)
    if not args.reuse:build(args)
    if not args.only_build:render(args)


if __name__=="__main__":main()
