"""Read-only audit of loaded Blender meshes against the partial survey revision.

Run: blender --background <scheme>.blend --python tools/audit_measurement_native.py -- wood
No geometry, visibility, file, or scene property is changed or saved by this audit.
"""
import json
import math
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[1]
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
scheme = args[0] if args else "wood"
assert scheme in ("wood", "family", "laundry"), scheme
source = json.loads((ROOT / "models" / "schemes" / scheme / "design-data.json").read_text(encoding="utf-8"))
assert source["measurementRevision"]["stage"] == "partial-confirmed"
checks = 0
TOL = 0.00004
depsgraph = bpy.context.evaluated_depsgraph_get()
cached_bounds = {}


def ensure(condition, message):
    global checks
    assert condition, message
    checks += 1


def close(actual, expected, message):
    ensure(abs(actual - expected) <= TOL, f"{message}: {actual} != {expected}")


def bounds(obj):
    """Evaluated world-space vertices, converted to model (east, south, up)."""
    if obj.name in cached_bounds:
        return cached_bounds[obj.name]
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    points = []
    try:
        for vertex in mesh.vertices:
            world = evaluated.matrix_world @ vertex.co
            points.append((world.x, -world.y, world.z))
    finally:
        evaluated.to_mesh_clear()
    ensure(bool(points), f"{obj.name}: actual evaluated mesh is nonempty")
    value = tuple(min(p[i] for p in points) for i in range(3)) + tuple(max(p[i] for p in points) for i in range(3))
    cached_bounds[obj.name] = value
    return value


def union(objects):
    ensure(bool(objects), "Expected physical meshes exist")
    boxes = [bounds(obj) for obj in objects]
    return tuple(min(box[i] for box in boxes) for i in range(3)) + tuple(max(box[i + 3] for box in boxes) for i in range(3))


meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
windows = {opening["id"]: opening for opening in source["windows"]}
if source["measurementRevision"].get("version") == "3.6.1":
    # The R2 source adds a confirmed master width but no new absolute room
    # datum. Keep the 10 mm residual visible, rather than spreading it into
    # the measured opening. The main bath's 1400 mm measured height cannot
    # be combined with its retained 1500 mm provisional sill under 2700 mm.
    revision = source["measurementRevision"]
    ensure(revision["source"] == "models/measurements-20261004-r2.json", "R2 native audit uses the supplementary source")
    master = windows["window_a"]
    for field, expected in (("x1", 411), ("x2", 587), ("widthMm", 1760), ("sillCm", 41), ("heightCm", 166)):
        close(master[field], expected, f"R2 master opening {field}")
    bath = windows["window_bath_1_east"]
    close(bath["sillCm"], 150, "R2 bathroom sill remains a labeled 1500 mm placeholder")
    close(bath["heightCm"], 80, "R2 bathroom 800 mm visual placeholder is not misrepresented as 1400 mm measured height")
    local = next((plan for plan in revision.get("localExistingPlans", []) if plan.get("id") == "suite-bath-existing"), None)
    ensure(local is not None, "R2 existing-bath reference is present separately from proposed room geometry")
    ensure(local["pointsMm"] == [[0, 0], [2400, 0], [2400, 1530], [1010, 1530], [1010, 1320], [0, 1320]], "R2 reference retains exact stepped survey geometry")
    ensure(not any(room["id"] == local["id"] for room in source["rooms"]), "R2 existing reference does not overwrite or add a renovation room")
    ensure(not any(obj.get("roomId") == local["id"] for obj in meshes), "R2 existing reference is not injected into the native model")
for key, opening in windows.items():
    physical = [obj for obj in meshes if obj.get("openingId") == key]
    ensure(bool(physical), f"{key}: mesh group exists")
    axis = 1 if opening["x1"] == opening["x2"] else 0
    lower = min(opening["y1"], opening["y2"]) / 100 if axis else min(opening["x1"], opening["x2"]) / 100
    upper = max(opening["y1"], opening["y2"]) / 100 if axis else max(opening["x1"], opening["x2"]) / 100
    is_bay = opening.get("windowType") == "bay"
    frames = [obj for obj in physical if obj.get("bayRole") == "frontFrame"] if is_bay else [
        obj for obj in physical if obj.name.split(" / ")[-1].split(".")[0] in ("jamb", "head", "sill frame", "mullion", "transom")]
    # The kitchen's custom sliding window has a distinct frame-tag vocabulary.
    if not frames and opening.get("windowSystem"):
        frames = [obj for obj in physical if obj.get("windowRole") in ("frame", "static-frame")]
    box = union(frames)
    close(box[axis], lower, f"{key}: actual frame opening start")
    close(box[axis + 3], upper, f"{key}: actual frame opening end")
    close(box[2], opening["sillCm"] / 100, f"{key}: actual frame sill elevation")
    close(box[5], (opening["sillCm"] + opening["heightCm"]) / 100, f"{key}: actual frame head elevation")
    if is_bay:
        stone = [obj for obj in physical if obj.get("bayRole") == "stoneSill" and "deep exterior" in obj.name]
        stone_box = union(stone)
        close(stone_box[axis], lower, f"{key}: real stone sill width start")
        close(stone_box[axis + 3], upper, f"{key}: real stone sill width end")
        close(stone_box[5], opening["sillCm"] / 100, f"{key}: real stone top, not just property metadata")
        outward = opening["bay"]["outward"]
        perpendicular = 1 - axis
        wall_plane = (opening["x1"] if perpendicular == 0 else opening["y1"]) / 100
        front_center = (box[perpendicular] + box[perpendicular + 3]) / 2
        close(abs(front_center - wall_plane), .06 + opening["bay"]["projectionCm"] / 100, f"{key}: actual outward projection from the retained wall plane")
        ensure((front_center - wall_plane) * outward[perpendicular] > 0, f"{key}: projects outward, not inside room")

for room in source["rooms"]:
    ceilings = [obj for obj in meshes if obj.get("kind") == "ceiling" and obj.get("roomId") == room["id"]]
    box = union(ceilings)
    expected = room.get("heightCm", 270) / 100
    close(box[2], expected, f"{room['id']}: actual ceiling minimum")
    close(box[5], expected, f"{room['id']}: actual ceiling maximum")

balcony = next(room for room in source["rooms"] if room["id"] == "balcony")
balcony_center = [(min(p[axis] for p in balcony["points"]) + max(p[axis] for p in balcony["points"])) / 200 for axis in (0, 1)]
balcony_lights = [obj for obj in meshes if obj.get("roomId") == "balcony" and obj.name.split(".")[0] in ("Flush ceiling light", "Opal ceiling diffuser")]
ensure(len(balcony_lights) == 2, "Both real balcony ceiling light solids exist")
for obj in balcony_lights:
    box = bounds(obj)
    for axis in (0, 1):
        close((box[axis] + box[axis + 3]) / 2, balcony_center[axis], f"{obj.name}: centered on the actually modeled balcony rather than the old pre-extension polygon")

# Independently reconstruct expected wall solids from source intervals. This
# checks every jamb/under-window/lintel volume, including newly split heights.
all_openings = source["windows"] + source["doors"] + source.get("openings", [])
wall_count = 0
for index, raw in enumerate(source["walls"]):
    coords = raw.get("coords", raw) if isinstance(raw, dict) else raw
    specification = next(item for item in source["wallSpecs"] if item["coords"] == coords)
    horizontal = coords[1] == coords[3]
    axis = 0 if horizontal else 1
    start, end = sorted((coords[axis] / 100, coords[axis + 2] / 100))
    fixed = coords[1 - axis] / 100
    thickness = specification.get("thicknessCm", 12) / 100
    apertures = []
    cuts = {start, end}
    for opening in all_openings:
        v = [opening[k] / 100 for k in ("x1", "y1", "x2", "y2")]
        if abs(v[1 - axis] - fixed) > .005 or abs(v[3 - axis] - fixed) > .005:
            continue
        low, high = sorted((v[axis], v[axis + 2]))
        if low < start - .01 or high > end + .01:
            continue
        cuts.update((low, high))
        apertures.append((low, high, opening))
    segments = specification.get("heightSegments", [])
    for segment in segments:
        cuts.update((segment["fromCm"] / 100, segment["toCm"] / 100))
    expected_boxes = []
    expected_skirtings = []
    cuts = sorted(cuts)
    for low, high in zip(cuts, cuts[1:]):
        midpoint = (low + high) / 2
        height = next((segment["heightCm"] / 100 for segment in segments if segment["fromCm"] / 100 <= midpoint <= segment["toCm"] / 100), specification.get("heightCm", 270) / 100)
        opening = next((op for a, b, op in apertures if a <= midpoint <= b), None)
        z_intervals = [(0, height)] if opening is None else [(0, opening.get("sillCm", 0) / 100), ((opening.get("sillCm", 0) + opening["heightCm"]) / 100, height)]
        for bottom, top in z_intervals:
            if high - low < .003 or top - bottom < .003:
                continue
            expected_boxes.append((low, fixed - thickness / 2, bottom, high, fixed + thickness / 2, top) if horizontal else (fixed - thickness / 2, low, bottom, fixed + thickness / 2, high, top))
            if bottom <= .005:
                skirting_half = (thickness + .018) / 2
                expected_skirtings.append((low, fixed - skirting_half, .005, high, fixed + skirting_half, .075) if horizontal else (fixed - skirting_half, low, .005, fixed + skirting_half, high, .075))
    objects = [obj for obj in meshes if obj.get("wallIndex") == index and obj.get("kind") == "wall"]
    actual_boxes = [bounds(obj) for obj in objects]
    ensure(len(actual_boxes) == len(expected_boxes), f"Wall {index}: real solid count matches surveyed height and retained opening intervals ({len(actual_boxes)} vs {len(expected_boxes)})")
    remaining = list(actual_boxes)
    for expected in expected_boxes:
        matching = next((box for box in remaining if all(abs(a - b) <= TOL for a, b in zip(box, expected))), None)
        ensure(matching is not None, f"Wall {index}: real vertex bounds for {expected}; remaining={remaining}")
        remaining.remove(matching)
    wall_count += len(objects)
    skirtings = [obj for obj in meshes if obj.name.split(".")[0] == f"Skirting {index:02}"]
    ensure(len(skirtings) == len(expected_skirtings), f"Wall {index}: real skirtings only below solid wall portions")
    remaining = [bounds(obj) for obj in skirtings]
    for expected in expected_skirtings:
        matching = next((box for box in remaining if all(abs(a - b) <= TOL for a, b in zip(box, expected))), None)
        ensure(matching is not None, f"Wall {index}: skirting stays outside opening and follows split-wall bounds {expected}")
        remaining.remove(matching)

# Tea-seat physical parts must actually move down with the measured low sill.
fitout = next(item for item in source["bayFitouts"] if item["openingId"] == "window_b")
for part in fitout["parts"]:
    objects = [obj for obj in meshes if obj.get("fitoutPartId") == part["id"] or obj.get("bayPartId") == part["id"]]
    if not objects:
        objects = [obj for obj in meshes if obj.get("bayFitoutId") == fitout["id"] and obj.get("partId") == part["id"]]
    ensure(bool(objects), f"{part['id']}: actual accessory meshes are present")
    box = union(objects)
    # The accessories may deliberately use curved detailed geometry; their
    # base still must follow the new ledge and their width stay in the bay.
    ensure(box[0] >= windows["window_b"]["x1"] / 100 - .03 and box[3] <= windows["window_b"]["x2"] / 100 + .03, f"{part['id']}: actual accessory meshes fit revised bay width")
    if part["role"] == "seat_cushion":
        close(box[2], part["zCm"] / 100, "Secondary real cushion base follows the 400 mm ledge")
        close(box[5], (part["zCm"] + part["hCm"]) / 100, "Secondary real cushion top is 450 mm")

print(json.dumps({"passed": True, "scheme": scheme, "checks": checks, "evaluatedMeshes": len(cached_bounds), "wallSolids": wall_count, "windows": len(windows), "ceilingRooms": len(source["rooms"]), "geometryBasis": "evaluated world-space mesh vertices; no mutation/save"}, ensure_ascii=False))
