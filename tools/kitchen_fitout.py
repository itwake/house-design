"""Data-driven kitchen geometry shared by the wood, suite and family builders.

All input coordinates and dimensions are centimetres. Cabinet parts and worktop
rectangles use north-west-bottom corners; appliance footprints use the same
convention. Appliances are approximate envelopes, not manufacturer CAD. This
module adds no cabinets or service routes that are absent from the source data.
"""
from __future__ import annotations

import math

import bpy
import bmesh


def _number(record, key, default=None, positive=False):
    value = float(record[key] if key in record else default)
    if not math.isfinite(value) or (positive and value <= 0):
        raise ValueError(f"Invalid kitchen dimension {key}: {value}")
    return value


def _rect(record):
    return tuple(_number(record, k, positive=k in ("w", "d")) for k in ("x", "y", "w", "d"))


def _subtract(rect, hole):
    """Subtract a rectangle into nonoverlapping rectangles, without booleans."""
    x, y, w, d = rect
    hx, hy, hw, hd = hole
    ix0, iy0 = max(x, hx), max(y, hy)
    ix1, iy1 = min(x + w, hx + hw), min(y + d, hy + hd)
    if ix0 >= ix1 or iy0 >= iy1:
        return [rect]
    pieces = [(x, y, ix0-x, d), (ix1, y, x+w-ix1, d),
              (ix0, y, ix1-ix0, iy0-y), (ix0, iy1, ix1-ix0, y+d-iy1)]
    return [p for p in pieces if p[2] > 1e-7 and p[3] > 1e-7]


class KitchenBuilder:
    def __init__(self, fit, api):
        self.fit, self.api = fit, api
        self.room = fit.get("roomId", "kitchen")
        self.collection = "Kitchen fitout / " + fit["id"]

    def tag(self, obj, role, part=None, appliance=None):
        obj["kitchenFitoutId"] = self.fit["id"]
        obj["kitchenFitoutVersion"] = str(self.fit.get("version", ""))
        obj["kitchenRole"] = role
        obj["roomId"] = self.room
        obj["furnitureId"] = (appliance or part or {}).get("furnitureId", (appliance or part or self.fit)["id"])
        if part:
            obj["kitchenPartId"] = part["id"]
            if part.get("face"):
                obj["furnitureFace"] = part["face"]
        if appliance:
            obj["kitchenApplianceId"] = appliance["id"]
            obj["kitchenApplianceType"] = appliance["type"]
            obj["furnitureFace"] = appliance.get("face", "south")
            obj["geometryApproximation"] = "Concept envelope; details are not manufacturer CAD"
        return obj

    def block(self, name, x, y, z, w, d, h, mat="Cream", bevel=.12, kind="furniture"):
        if min(w, d, h) <= 0:
            raise ValueError(f"Nonpositive kitchen block: {name}")
        return self.api["block"](name, x/100, y/100, z/100, w/100, d/100, h/100,
                                 mat=mat, bevel=bevel/100, kind=kind,
                                 room=self.room, collection=self.collection)

    def mesh(self, name, vertices, faces, mat="Chrome", bevel=0):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata([(x/100, -y/100, z/100) for x, y, z in vertices], [], faces)
        mesh.update()
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(mesh)
        bm.free()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        return self.api["finish"](obj, name, mat, bevel/100, room=self.room, collection=self.collection)

    def rod(self, name, start, end, radius=.5, mat="Chrome"):
        obj = self.api["rod"](name, tuple(v/100 for v in start), tuple(v/100 for v in end), radius/100, mat)
        self.api["tag"](obj, name, room=self.room, collection=self.collection)
        return obj

    def cylinder(self, name, x, y, z, radius, height, mat="Chrome"):
        obj = self.api["cylinder"](name, x/100, y/100, z/100, radius/100, height/100, mat)
        self.api["tag"](obj, name, room=self.room, collection=self.collection)
        return obj

    def parts(self):
        for part in self.fit.get("parts", []):
            x, y, w, d = _rect(part)
            z, h = _number(part, "zCm", 0), _number(part, "hCm", positive=True)
            shaft = part.get("role") == "shaft"
            obj = self.block("Kitchen / " + part["id"], x, y, z, w, d, h,
                             "Wall" if shaft else part.get("material", "Cream"),
                             bevel=0 if shaft else .1, kind="wall" if shaft else "furniture")
            self.tag(obj, part.get("role", "cabinet-part"), part=part)
            if shaft and "wallIndex" in part:
                obj["wallIndex"] = int(part["wallIndex"])

    def countertops(self):
        for top in self.fit.get("countertops", []):
            pieces = [_rect(top)]
            for hole in top.get("cutouts", []):
                hole_rect = _rect(hole)
                pieces = [piece for rect in pieces for piece in _subtract(rect, hole_rect)]
            for index, (x, y, w, d) in enumerate(pieces):
                obj = self.block(f"Kitchen / {top['id']} / stone {index+1}", x, y,
                                 _number(top, "zCm"), w, d, _number(top, "hCm", positive=True),
                                 top.get("material", "Stone"), bevel=.06)
                self.tag(obj, "countertop", part=top)
                obj["countertopCutoutCount"] = len(top.get("cutouts", []))


class Appliance:
    """Local u runs across the front; local v=depth is the facing plane."""
    def __init__(self, builder, data):
        self.b, self.data = builder, data
        self.x, self.y, self.w, self.d = _rect(data)
        self.face = data.get("face", "south")
        if self.face not in ("north", "south", "east", "west"):
            raise ValueError("Unsupported kitchen appliance face: " + self.face)
        self.width, self.depth = (self.d, self.w) if self.face in ("east", "west") else (self.w, self.d)
        self.z = _number(data, "zCm", 0)
        self.h = _number(data, "heightCm", data.get("hCm"), positive=True)

    def point(self, u, v, z):
        if self.face == "south":
            return self.x+u, self.y+v, self.z+z
        if self.face == "north":
            return self.x+self.w-u, self.y+self.d-v, self.z+z
        if self.face == "east":
            return self.x+v, self.y+self.d-u, self.z+z
        return self.x+self.w-v, self.y+u, self.z+z

    def block(self, label, u, v, z, w, d, h, mat="Cream", bevel=.15):
        a, c = self.point(u, v, z), self.point(u+w, v+d, z)
        return self.b.block(self.data["id"]+" / "+label, min(a[0], c[0]), min(a[1], c[1]),
                            a[2], abs(a[0]-c[0]), abs(a[1]-c[1]), h, mat, bevel)

    def rod(self, label, start, end, radius=.5, mat="Chrome"):
        return self.b.rod(self.data["id"]+" / "+label, self.point(*start), self.point(*end), radius, mat)

    def cylinder(self, label, u, v, z, radius, height, mat="Chrome"):
        return self.b.cylinder(self.data["id"]+" / "+label, *self.point(u, v, z), radius, height, mat)

    def mesh(self, label, vertices, faces, mat="Chrome", bevel=0):
        return self.b.mesh(self.data["id"]+" / "+label, [self.point(*p) for p in vertices], faces, mat, bevel)

    def prism(self, label, u0, u1, section, mat="Chrome"):
        count = len(section)
        verts = [(u, v, z) for u in (u0, u1) for v, z in section]
        faces = [list(range(count-1, -1, -1)), list(range(count, count*2))]
        faces += [(i, (i+1) % count, (i+1) % count+count, i+count) for i in range(count)]
        return self.mesh(label, verts, faces, mat)


def _fridge(a):
    w, d, h = a.width, a.depth, a.h
    a.block("freestanding refrigerator body", 0, 0, 3, w, d-3, h-3, "Cream", .8)
    split = h*.29
    for label, z, height in (("freezer door", 3, split-3.35), ("refrigerator door", split+.2, h-split-.5)):
        a.block(label, .25, d-3, z, w-.5, 2.5, height, "Cream", .55)
        a.block(label+" recessed grip", w*.1, d-.5, z+height-2.2, w*.72, .5, .65, "Charcoal", .12)
    for u in (3, w-5):
        for v in (3, d-6):
            a.block("levelling foot", u, v, 0, 2, 2, 3, "Charcoal", .1)
    a.block("upper door seal", .5, d-3.05, split-.15, w-1, .8, .35, "Charcoal", .03)


def _dishwasher(a):
    w, d, h = a.width, a.depth, a.h
    # Only the actual appliance is modelled here. The cabinet recess receives
    # no wooden bottom, rear wall, worktop support, or filler from this method.
    a.block("dishwasher metal chassis", 0, 0, 2, w, d-2.5, h-2, "WarmGrayMetal", .3)
    a.block("dishwasher door", .3, d-2.5, 4, w-.6, 2.3, h-4.4, "Cream", .45)
    a.block("control band", .7, d-.8, h-8, w-1.4, .72, 6.8, "WarmGrayMetal", .15)
    a.block("recessed handle", w*.2, d-.65, h-10, w*.6, .65, 1.1, "Charcoal", .2)
    a.block("status screen", w*.69, d-.18, h-5.6, w*.19, .18, 2.2, "GlassDark", .08)
    for i in range(3):
        a.block("programme key", w*.17+i*3.3, d-.18, h-5, 1.4, .18, .8, "Charcoal", .08)
    for u in (3, w-5):
        for v in (3, d-6):
            a.block("appliance levelling foot", u, v, 0, 2, 2, 2, "Charcoal", .1)


def _rounded_loop(x, y, w, d, radius, z, steps=8):
    result = []
    for cx, cy, start in ((x+w-radius, y+radius, -90), (x+w-radius, y+d-radius, 0),
                          (x+radius, y+d-radius, 90), (x+radius, y+radius, 180)):
        for i in range(steps):
            angle = math.radians(start+i*90/(steps-1))
            result.append((cx+math.cos(angle)*radius, cy+math.sin(angle)*radius, z))
    return result


def _sink_bowl(b, name, x, y, w, d, bottom, top):
    """A closed thin steel shell with a genuinely open top and inset bottom."""
    thickness = .12
    loops = [_rounded_loop(x-thickness, y-thickness, w+thickness*2, d+thickness*2, 3.12, top),
             _rounded_loop(x+1.3, y+1.3, w-2.6, d-2.6, 4, bottom),
             _rounded_loop(x+1.42, y+1.42, w-2.84, d-2.84, 3.88, bottom+thickness),
             _rounded_loop(x, y, w, d, 3, top)]
    count = len(loops[0])
    vertices = [point for loop in loops for point in loop]
    faces = []
    for first, second in ((0, 1), (2, 3), (3, 0)):
        faces += [(first*count+i, first*count+(i+1) % count,
                   second*count+(i+1) % count, second*count+i) for i in range(count)]
    faces += [list(range(count, count*2)), list(range(count*2, count*3))]
    obj = b.mesh(name+" / open steel bowl", vertices, faces, "Chrome")
    for poly in obj.data.polygons:
        if len(poly.vertices) == 4:
            poly.use_smooth = True
    b.cylinder(name+" / recessed drain", x+w/2, y+d/2, bottom+.13, 3.8, .14, "Charcoal")
    b.cylinder(name+" / steel drain strainer", x+w/2, y+d/2, bottom+.27, 3.05, .08, "Chrome")
    for angle in range(0, 360, 45):
        theta = math.radians(angle)
        b.cylinder(name+" / drain slot", x+w/2+math.cos(theta)*2.0,
                   y+d/2+math.sin(theta)*2.0, bottom+.35, .22, .025, "Charcoal")


def _rim_corner(b, name, cx, cy, radius, start, z, thickness):
    """Fill a rectangular opening corner outside its rounded internal arc."""
    angle_mid = math.radians(start+45)
    corner = (cx+math.copysign(radius, math.cos(angle_mid)), cy+math.copysign(radius, math.sin(angle_mid)))
    path = [corner] + [(cx+radius*math.cos(math.radians(start+i*90/12)),
                       cy+radius*math.sin(math.radians(start+i*90/12))) for i in range(13)]
    count = len(path)
    verts = [(x, y, level) for level in (z, z+thickness) for x, y in path]
    faces = [list(range(count-1, -1, -1)), list(range(count, count*2))]
    faces += [(i, (i+1) % count, (i+1) % count+count, i+count) for i in range(count)]
    b.mesh(name, verts, faces, "Chrome")


def _double_sink(a):
    # This explicit world-axis orientation puts the 42/29.8 cm bowls north/
    # south along the east wall, irrespective of the west-facing service edge.
    b, x, y, w, d = a.b, a.x, a.y, a.w, a.d
    scale_x, scale_y = w/45, d/78
    rim = .25
    top = a.z+a.h
    open_w, border = 40*scale_x, 2.5*scale_x
    north_y, north_d = y+1.8*scale_y, 42*scale_y
    south_y, south_d = y+46.4*scale_y, 29.8*scale_y
    strips = [(x, y, border, d), (x+w-border, y, border, d),
              (x+border, y, open_w, 1.8*scale_y),
              (x+border, north_y+north_d, open_w, 2.6*scale_y),
              (x+border, south_y+south_d, open_w, 1.8*scale_y)]
    for index, (px, py, pw, pd) in enumerate(strips):
        b.block(a.data["id"]+f" / steel mounting rim {index+1}", px, py, top-rim, pw, pd, rim, "Chrome", .025)
    for label, by, bd in (("north 420 mm basin", north_y, north_d), ("south 298 mm basin", south_y, south_d)):
        bx, radius = x+border, 3
        _sink_bowl(b, a.data["id"]+" / "+label, bx, by, open_w, bd, a.z, top-rim)
        corners = [(bx+open_w-radius, by+radius, -90), (bx+open_w-radius, by+bd-radius, 0),
                   (bx+radius, by+bd-radius, 90), (bx+radius, by+radius, 180)]
        for index, (cx, cy, angle) in enumerate(corners):
            _rim_corner(b, a.data["id"]+f" / {label} rim corner {index+1}", cx, cy, radius, angle, top-rim, rim)


def _gas_hob(a):
    w, d, h = a.width, a.depth, a.h
    unit = h/5
    a.block("two burner black glass hob", 0, 0, 0, w, d, .85*unit, "GlassDark", .7)
    for index, u in enumerate((w*.25, w*.75), 1):
        v = d*.48
        a.cylinder(f"burner {index} steel collar", u, v, .85*unit, 6.2, .55*unit, "Chrome")
        a.cylinder(f"burner {index} gas crown", u, v, 1.4*unit, 5.2, 1.2*unit, "Charcoal")
        a.cylinder(f"burner {index} cap", u, v, 2.6*unit, 4.7, .35*unit, "Charcoal")
        for dx in (-9.5, 9.5):
            a.block(f"burner {index} grate rail", u+dx-.5, v-10.5, 3.6*unit, 1, 21, 1.0*unit, "Charcoal", .2)
        for dy in (-10.5, 9.5):
            a.block(f"burner {index} grate bridge", u-9.5, v+dy, 3.6*unit, 19, 1, 1.0*unit, "Charcoal", .2)
        for dx in (-1, 1):
            a.block(f"burner {index} pan support", u+(2.3 if dx > 0 else -9.5), v-.55,
                    4.1*unit, 7.2, 1.1, .9*unit, "Charcoal", .15)
        a.cylinder(f"burner {index} control knob", w*(.43 if index == 1 else .57), d*.88,
                   .85*unit, 1.8, 1.2*unit, "WarmGrayMetal")


def _hood(a):
    w, d, h = a.width, a.depth, a.h
    a.block("warm white upper housing", 0, 0, h*.48, w, d*.31, h*.52, "Cream", .5)
    a.prism("sloped metal hood housing", .5, w-.5,
            [(0, h*.17), (0, h*.8), (d*.3, h*.94), (d-.2, h*.2), (d-.2, 0), (d*.64, 0)], "WarmGrayMetal")
    a.prism("black inclined glass canopy", 1.5, w-1.5,
            [(d*.32, h*.95), (d*.998, h*.205), (d*.998, h*.165), (d*.32, h*.91)], "GlassDark")
    a.block("lower intake shadow", w*.1, d-.3, .5, w*.8, .3, 2.5, "Charcoal", .05)
    a.block("hood task light", w*.16, d-.3, 4.1, w*.68, .3, .4, "Lamp", .05)
    # No flue connection is inferred. A separate reviewed service route must
    # supply geometry before anything can be joined to the public shaft.


def _heater(a):
    w, d, h = a.width, a.depth, a.h
    a.block("wall hung gas water heater body", 0, 0, 0, w, d-1.2, h, "Cream", 1.0)
    a.block("west facing front cover", .35, d-1.3, 5.2, w-.7, 1.18, h-5.7, "Cream", .65)
    a.block("heater control panel", w*.25, d-.32, h*.21, w*.50, .26, h*.19, "GlassDark", .1)
    a.block("heater temperature display", w*.38, d-.12, h*.285, w*.24, .12, h*.055, "WarmGrayMetal", .05)
    for u in (w*.33, w*.66):
        a.block("heater control key", u-1, d-.12, h*.24, 2, .12, .8, "Chrome", .12)
    # Small visible service interfaces occupy the lower face of the envelope.
    # They do not claim a pipe route, wall penetration, or a shared flue link.
    for index, u in enumerate((w*.26, w*.5, w*.74)):
        mat = "Brass" if index == 1 else "Chrome"
        a.rod("short water gas service interface", (u, d-.65, .65), (u, d-.65, 4.2), .42, mat)
        a.block("service interface collar", u-.8, d-1.45, 3.8, 1.6, 1.4, .65, mat, .1)


def _faucet(a):
    w, d, h = a.width, a.depth, a.h
    radius = min(1.35, w/3, d/5, h/12)
    a.cylinder("tap mounting foot", w/2, radius*1.6, 0, radius*1.5, radius, "Chrome")
    a.rod("tap upright", (w/2, radius*1.6, radius), (w/2, radius*1.6, h-radius), radius, "Chrome")
    a.rod("tap over sink spout", (w/2, radius*1.6, h-radius), (w/2, d-radius, h-radius), radius, "Chrome")
    a.rod("tap short downturned outlet", (w/2, d-radius, h-radius), (w/2, d-radius, h-radius*3), radius*.85, "Chrome")


APPLIANCES = {"fridge": _fridge, "dishwasher": _dishwasher, "doubleSink": _double_sink,
              "gasHob": _gas_hob, "hood": _hood, "waterHeater": _heater,
              "heater": _heater, "faucet": _faucet}


def build(data, api):
    """Create one detailed kitchen; repeated inherited calls are harmless."""
    fit = data.get("kitchenFitout")
    if not fit:
        return
    if not isinstance(fit, dict) or not fit.get("id"):
        raise ValueError("kitchenFitout must be one identified object")
    if any(obj.get("kitchenFitoutId") == fit["id"] for obj in bpy.context.scene.objects):
        return
    builder = KitchenBuilder(fit, api)
    builder.parts()
    builder.countertops()
    for item in fit.get("appliances", []):
        generator = APPLIANCES.get(item["type"])
        if generator is None:
            raise ValueError("Unknown kitchen appliance type: " + item["type"])
        before = set(bpy.context.scene.objects)
        generator(Appliance(builder, item))
        for obj in set(bpy.context.scene.objects)-before:
            builder.tag(obj, "appliance", appliance=item)
