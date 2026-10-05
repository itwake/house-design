"""Purchased IKEA furniture: published envelopes and image-based detail models.

This is not manufacturer CAD. Dimensions explicitly listed in PRODUCT_SPECS
come from the linked product pages; construction thicknesses, curves, seams,
leg sections and inclinations are visual approximations. All coordinates are
metres. Each instance validates its evaluated mesh envelope before export.
"""
from __future__ import annotations

import json
import math

import bpy
import numpy as np
from mathutils import Vector


PRODUCT_SPECS = {
    "ikea-vimle-39635114": {
        "label": "IKEA VIMLE / 克奈贝克浅米色三人沙发",
        "article": "396.351.14", "width": 2.41, "depth": .98, "height": .83,
        "publishedDimensionsCm": {"width": 241, "depth": 98, "height": 83,
            "seatWidth": 211, "seatDepth": 55, "seatHeight": 48,
            "armWidth": 15, "armHeight": 68, "backFrameHeight": 68,
            "floorClearance": 6},
        "sourceUrl": "https://www.ikea.cn/cn/zh/p/vimle-wei-mu-le-san-ren-sha-fa-ke-nai-bei-ke-qian-mi-se-s39635114/",
        "approximation": "Non-official parameter model: published overall and seating dimensions; three seat cushions, three back cushions, straight narrow arms and short black feet follow SKU imagery. Cushion rounding, upholstery weave, seams, rear cushion inclination, frame thickness and foot placement are approximate. No added scatter cushions.",
    },
    "ikea-lisabo-80365717": {
        "label": "IKEA LISABO / 白蜡木贴面餐桌",
        "article": "803.657.17", "width": 1.40, "depth": .78, "height": .74,
        "publishedDimensionsCm": {"length": 140, "width": 78, "height": 74},
        "sourceUrl": "https://www.ikea.cn/cn/zh/p/lisabo-li-sa-bo-zhuo-zi-bai-zha-mu-tie-mian-80365717/",
        "approximation": "Non-official parameter model: published 140 x 78 x 74 cm envelope. Light ash appearance, gently rounded rectangular top with bevelled underside and four splayed tapered wooden legs follow product imagery. Top thickness, corner radius, leg sections, mounting locations and splay angles are approximate; no transverse stretchers.",
    },
    "ikea-lisabo-80457236": {
        "label": "IKEA LISABO / 白蜡木餐椅",
        "article": "804.572.36", "width": .46, "depth": .51, "height": .80,
        "publishedDimensionsCm": {"width": 46, "depth": 51, "height": 80,
            "seatWidth": 44, "seatDepth": 39, "seatHeight": 45},
        "sourceUrl": "https://www.ikea.cn/cn/zh/p/lisabo-li-sa-bo-yi-zi-bai-zha-mu-80457236/",
        "approximation": "Non-official parameter model: published overall and seating dimensions. Unupholstered rounded wooden seat, broad gently curved separate back panel with open space below, rear legs extending to back posts, four tapered slightly splayed legs and no arms follow product imagery. Seat/back thicknesses, curvatures, leg sections, positions and angles are approximate.",
    },
}


def _textured_material(api, name, rgb, texture_kind, roughness):
    """Separate packed texture/material: never mutate baseline Oak or Linen."""
    if name in api["MATS"]:
        return name
    size = 256
    yy, xx = np.mgrid[0:size, 0:size].astype(float) / size
    rng = np.random.default_rng(39635114 if texture_kind == "linen" else 80365717)
    noise = rng.normal(0, 1, (size, size))
    if texture_kind == "wood":
        wave = xx * 55 + .20 * np.sin(yy * 16) + .10 * np.sin(yy * 48 + xx * 3)
        grain = .019 * np.sin(wave * math.tau) + .007 * np.sin(wave * 7 * math.pi) + noise * .004
    else:
        grain = .009 * np.sin(xx * math.pi * 200) + .008 * np.sin(yy * math.pi * 210) + noise * .005
    pixels = np.ones((size, size, 4), dtype=np.float32)
    pixels[:, :, :3] = np.clip(np.array(rgb)[None, None, :] + grain[:, :, None], 0, 1)
    img = bpy.data.images.new(name + " texture", width=size, height=size)
    img.pixels.foreach_set(pixels.ravel())
    img.pack()
    api["material"](name, rgb, roughness, texture=img)
    return name


class PurchasedBuilder:
    def __init__(self, f, api):
        self.f, self.api = f, api
        self.product_id = f["purchasedProductId"]
        self.spec = PRODUCT_SPECS[self.product_id]
        self.x, self.y, self.w, self.d = (float(f[k]) / 100 for k in ("x", "y", "w", "d"))
        self.face = f.get("face", "north")
        # A table's long axis is explicit in its rectangular footprint; it does
        # not have a seating-facing direction like a sofa or chair.
        if self.product_id == "ikea-lisabo-80365717":
            self.face = "north" if self.w > self.d else "east"
        if self.face not in ("north", "east", "south", "west"):
            raise ValueError(f"Unknown purchased furniture facing: {self.face}")
        expected = (self.spec["width"], self.spec["depth"])
        if self.face in ("east", "west"):
            expected = tuple(reversed(expected))
        if not all(math.isclose(a, b, abs_tol=1e-6) for a, b in zip((self.w, self.d), expected)):
            raise ValueError(f"{self.product_id}: footprint {self.w, self.d} does not match {self.face} product envelope {expected}")
        if "heightCm" in f and not math.isclose(float(f["heightCm"])/100, self.spec["height"], abs_tol=1e-6):
            raise ValueError(f"{self.product_id}: heightCm conflicts with the published product height")
        self.objects = []
        self.wood = _textured_material(api, "Purchased LISABO light ash", (.82, .73, .56), "wood", .55)
        self.fabric = _textured_material(api, "Purchased VIMLE Knäbäck light beige", (.85, .81, .73), "linen", .88)

    def point(self, u, v, z):
        if self.face == "north":
            x, y = self.x + u, self.y + v
        elif self.face == "south":
            x, y = self.x + self.w - u, self.y + self.d - v
        elif self.face == "east":
            x, y = self.x + self.w - v, self.y + u
        else:
            x, y = self.x + v, self.y + self.d - u
        return (x, -y, z)

    def mesh(self, label, vertices, faces, material, bevel=0):
        mesh = bpy.data.meshes.new(label)
        mesh.from_pydata([self.point(*p) for p in vertices], [], faces)
        mesh.update()
        obj = bpy.data.objects.new(label, mesh)
        bpy.context.collection.objects.link(obj)
        self.api["finish"](obj, self.spec["label"] + " / " + label, material, bevel)
        obj["purchasedProductId"] = self.product_id
        obj["purchasedArticleNumber"] = self.spec["article"]
        obj["furnitureId"] = str(self.f.get("id") or self.f.get("furnitureId") or self.f["name"])
        obj["furnitureName"] = self.f["name"]
        obj["furnitureFace"] = self.f.get("face", self.face)
        obj["purchasedPart"] = label
        obj["purchasedSourceUrl"] = self.spec["sourceUrl"]
        obj["purchasedGeometryStatus"] = "published-envelope-image-based-approximation-not-official-CAD"
        obj["purchasedGeometryApproximation"] = self.spec["approximation"]
        obj["publishedDimensionsCm"] = json.dumps(self.spec["publishedDimensionsCm"], sort_keys=True)
        uv = mesh.uv_layers.new(name="Purchased local surface UV")
        for poly in mesh.polygons:
            a, b, c = [Vector(vertices[i]) for i in poly.vertices[:3]]
            normal = (b-a).cross(c-a)
            major_axis = max(range(3), key=lambda axis: abs(normal[axis]))
            for li in poly.loop_indices:
                u, v, z = vertices[mesh.loops[li].vertex_index]
                # Local mapping follows furniture rotation, including wood on
                # seat/back/legs; mapping does not depend on room position.
                uv.data[li].uv = (u, v) if major_axis == 2 else ((u, z) if major_axis == 1 else (v, z))
        self.objects.append(obj)
        return obj

    def block(self, label, u, v, z, w, d, h, material, bevel=.008, top_shift=0):
        verts = [(u + du, v + dv + (top_shift if dz else 0), z + dz)
                 for dz in (0, h) for dv in (0, d) for du in (0, w)]
        faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1),
                 (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
        return self.mesh(label, verts, faces, material, bevel)

    @staticmethod
    def rounded_ring(u, v, width, depth, radius, z):
        points = []
        for cx, cy, start in ((u + width - radius, v + radius, -90),
                              (u + width - radius, v + depth - radius, 0),
                              (u + radius, v + depth - radius, 90),
                              (u + radius, v + radius, 180)):
            for step in range(9):
                angle = math.radians(start + step * 90 / 8)
                points.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle), z))
        return points

    def slab(self, label, u, v, w, d, levels, radius, material):
        rings = [self.rounded_ring(u + inset, v + inset, w - 2*inset, d - 2*inset,
                                   max(.002, radius - inset), z) for z, inset in levels]
        n = len(rings[0])
        verts = [p for ring in rings for p in ring]
        # The y flip in point() makes the clockwise bottom face point down.
        faces = [tuple(range(n)), tuple(reversed(range((len(rings)-1)*n, len(rings)*n)))]
        for row in range(len(rings)-1):
            faces.extend((row*n+i, (row+1)*n+i, (row+1)*n+(i+1)%n, row*n+(i+1)%n) for i in range(n))
        return self.mesh(label, verts, faces, material)

    def leg(self, label, centres, radii, material):
        count = 16
        verts = [(u + radius*math.cos(i*math.tau/count), v + radius*math.sin(i*math.tau/count), z)
                 for (u, v, z), radius in zip(centres, radii) for i in range(count)]
        faces = [tuple(range(count)), tuple(reversed(range((len(centres)-1)*count, len(centres)*count)))]
        for row in range(len(centres)-1):
            faces.extend((row*count+i, (row+1)*count+i, (row+1)*count+(i+1)%count, row*count+(i+1)%count) for i in range(count))
        obj = self.mesh(label, verts, faces, material)
        for poly in obj.data.polygons:
            poly.use_smooth = len(poly.vertices) == 4
        return obj

    def sofa(self):
        fabric = self.fabric
        self.block("upholstered base", .15, .025, .06, 2.11, .88, .29, fabric, .026)
        self.block("back frame", .15, .77, .30, 2.11, .21, .38, fabric, .025)
        for side, u in (("left", 0), ("right", 2.26)):
            self.block(side + " straight 15 cm arm", u, 0, .06, .15, .98, .62, fabric, .023)
        gap = .008
        cushion_width = (2.11 - 2*gap) / 3
        for index in range(3):
            u = .15 + index * (cushion_width + gap)
            self.block(f"seat cushion {index+1}", u, .04, .345,
                       cushion_width, .55, .135, fabric, .044)
            self.block(f"back cushion {index+1}", u, .60, .47,
                       cushion_width, .265, .36, fabric, .045, top_shift=.065)
        for side, u in (("left", .10), ("middle", 1.205), ("right", 2.31)):
            for end, v in (("front", .10), ("back", .88)):
                self.leg(side + " " + end + " short black foot", [(u, v, 0), (u, v, .06)], [.025, .025], "Charcoal")

    def table(self):
        self.slab("140 x 78 cm thin bevelled tabletop", 0, 0, 1.4, .78,
                  [(.714, .020), (.733, 0), (.740, 0)], .034, self.wood)
        for side, sx in (("left", -1), ("right", 1)):
            for end, sy in (("front", -1), ("back", 1)):
                self.leg(side + " " + end + " splayed tapered leg",
                         [(.70 + sx*.619, .39 + sy*.305, 0),
                          (.70 + sx*.564, .39 + sy*.255, .720)], [.023, .038], self.wood)

    def chair_back(self):
        # A horizontally bowed wooden panel, rounded in front elevation. The
        # centre sample is intentional: its outer face sets the full 51 cm depth.
        radius, lower, upper, width = .024, .636, .80, .46
        xs = sorted(set([0, width, width/2, .07, .13, .19, .27, .33, .39] +
                        [radius*(1-math.cos(i*math.pi/16)) for i in range(9)] +
                        [width-radius*(1-math.cos(i*math.pi/16)) for i in range(9)]))
        verts = []
        for u in xs:
            edge_distance = min(u, width-u)
            round_offset = radius-math.sqrt(max(0, radius*radius-(radius-edge_distance)**2)) if edge_distance < radius else 0
            centre_v = .498 - .038*(2*u/width-1)**2
            verts.extend([(u, centre_v + thickness, z) for z in (lower+round_offset, upper-round_offset)
                          for thickness in (-.012, .012)])
        end = len(verts)-4
        faces = [(0, 1, 3, 2), (end, end+2, end+3, end+1)]
        for i in range(len(xs)-1):
            a, b = 4*i, 4*(i+1)
            faces.extend([(a, a+2, b+2, b), (a+1, b+1, b+3, a+3),
                          (a, b, b+1, a+1), (a+2, a+3, b+3, b+2)])
        self.mesh("broad curved separate wooden back panel", verts, faces, self.wood)

    def chair(self):
        self.slab("44 x 39 cm unupholstered rounded seat", .01, .025, .44, .39,
                  [(.425, .008), (.445, 0), (.45, 0)], .036, self.wood)
        for side, u, top_u in (("left", .035, .061), ("right", .425, .399)):
            self.leg(side + " front tapered leg", [(u, .02, 0), (top_u, .095, .435)], [.020, .026], self.wood)
        for side, u, top_u in (("left", .047, .063), ("right", .413, .397)):
            self.leg(side + " rear leg and back post",
                     [(u, .491, 0), (top_u, .398, .435), (top_u, .469, .751)],
                     [.019, .024, .016], self.wood)
        self.chair_back()

    def validate(self):
        bpy.context.view_layer.update()
        depsgraph = bpy.context.evaluated_depsgraph_get()
        corners = [obj.matrix_world @ Vector(corner) for raw in self.objects
                   for obj in [raw.evaluated_get(depsgraph)] for corner in obj.bound_box]
        actual_min = [min(c[i] for c in corners) for i in range(3)]
        actual_max = [max(c[i] for c in corners) for i in range(3)]
        expected_min = [self.x, -self.y-self.d, 0]
        expected_max = [self.x+self.w, -self.y, self.spec["height"]]
        if any(abs(a-b) > .00002 for a, b in zip(actual_min+actual_max, expected_min+expected_max)):
            raise ValueError(f"{self.product_id} evaluated envelope mismatch: {actual_min, actual_max}; expected {expected_min, expected_max}")
        for obj in self.objects:
            obj["purchasedValidatedEnvelopeCm"] = json.dumps({"x": self.f["x"], "y": self.f["y"],
                "w": self.f["w"], "d": self.f["d"], "h": round(self.spec["height"]*100, 6)})
        return self.objects


def build(f, api):
    """Called only for explicitly purchasedProductId-tagged furniture."""
    if f["purchasedProductId"] not in PRODUCT_SPECS:
        raise ValueError(f"Unknown purchased product ID: {f['purchasedProductId']}")
    builder = PurchasedBuilder(f, api)
    {"ikea-vimle-39635114": builder.sofa, "ikea-lisabo-80365717": builder.table,
     "ikea-lisabo-80457236": builder.chair}[f["purchasedProductId"]]()
    objects = builder.validate()
    if f["purchasedProductId"] == "ikea-vimle-39635114":
        # Preserve the source living rug independently of the sofa's exact
        # published envelope. It must not inherit purchased/furniture tags.
        rug = f.get("rugCm")
        if rug:
            x, y, w, d = (rug[k]/100 for k in ("x", "y", "w", "d"))
        else:
            x, y, w, d = builder.x-.12, builder.y-1.85, builder.w+.24, 1.92
        obj = api["block"]("Subtle flatwoven living rug", x, y, .007, w, d, .013,
                           mat="WhiteLinen", bevel=.018, kind="rug")
        obj["purchasedFurnitureRug"] = True
        obj["relatedFurnitureId"] = str(f.get("id") or f.get("furnitureId") or f["name"])
    return objects
