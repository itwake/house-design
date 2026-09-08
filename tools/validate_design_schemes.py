"""Independently verify the four design schemes, without Blender or packages.

The GLB check decodes actual POSITION/index bytes and node transforms. It
compares canonical world-space triangles, not accessor min/max or generator
audit claims, so material-driven vertex splitting/reordering is harmless.
Only the two named pendant shades may change, inside their original bounds.

  python -B -X utf8 tools/validate_design_schemes.py --pending
  python -B -X utf8 tools/validate_design_schemes.py

--pending permits missing NEW render files/records only. Models, geometry,
metadata and any already-present render must still pass every check.
"""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import math
import struct
import sys
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
VIEWS = ("overall", "living", "dining", "master", "bedroom-b", "study",
         "kitchen", "master-bath", "guest-bath", "balcony", "bay-master",
         "bay-tea", "bay-living", "entry-storage", "sideboard")
SCHEME_IDS = ("wood", "terracotta", "moss", "cobalt")
ALLOWED_SHADES = {"Organic linen pendant", "Organic linen pendant.001"}
# Ten micrometres is far below both survey precision and furniture tolerance.
GEOMETRY_GRID_M = 0.00001
BOUNDS_TOLERANCE_M = 0.0001
COMPONENTS = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2),
              5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
WIDTHS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
IDENTITY = [[int(r == c) for c in range(4)] for r in range(4)]


def sha(value):
    return hashlib.sha256(value).hexdigest()


def json_hash(value):
    return sha(json.dumps(value, ensure_ascii=False, sort_keys=True,
                          separators=(",", ":")).encode("utf-8"))


def relative_file(value):
    if not isinstance(value, str) or not value or "\\" in value:
        raise ValueError(f"Expected a nonempty web-relative path: {value!r}")
    if urlparse(value).scheme or value.startswith("/") or ".." in Path(value).parts:
        raise ValueError(f"Asset path must stay inside the repository: {value!r}")
    path = (ROOT / value).resolve()
    path.relative_to(ROOT)
    return path


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def multiply(a, b):
    return [[sum(a[r][k] * b[k][c] for k in range(4))
             for c in range(4)] for r in range(4)]


def node_matrix(node):
    if "matrix" in node:
        return [[node["matrix"][c * 4 + r] for c in range(4)] for r in range(4)]
    x, y, z, w = node.get("rotation", [0, 0, 0, 1])
    scale = node.get("scale", [1, 1, 1])
    translation = node.get("translation", [0, 0, 0])
    rotation = [
        [1 - 2 * (y*y + z*z), 2 * (x*y - z*w), 2 * (x*z + y*w)],
        [2 * (x*y + z*w), 1 - 2 * (x*x + z*z), 2 * (y*z - x*w)],
        [2 * (x*z - y*w), 2 * (y*z + x*w), 1 - 2 * (x*x + y*y)],
    ]
    return [[rotation[r][c] * scale[c] for c in range(3)] + [translation[r]]
            for r in range(3)] + [[0, 0, 0, 1]]


class GLB:
    def __init__(self, path):
        raw = path.read_bytes()
        if len(raw) < 28 or struct.unpack_from("<III", raw) != (0x46546C67, 2, len(raw)):
            raise ValueError(f"Invalid GLB header: {path}")
        self.binary = b""
        self.data = None
        offset = 12
        while offset < len(raw):
            length, kind = struct.unpack_from("<II", raw, offset)
            offset += 8
            payload = raw[offset:offset + length]
            if len(payload) != length:
                raise ValueError("Truncated GLB chunk")
            if kind == 0x4E4F534A:
                if self.data is not None:
                    raise ValueError("Multiple GLB JSON chunks")
                self.data = json.loads(payload)
            elif kind == 0x004E4942:
                if self.binary:
                    raise ValueError("Multiple GLB BIN chunks")
                self.binary = payload
            offset += length
        if offset != len(raw) or self.data is None or not self.binary:
            raise ValueError("Incomplete GLB")
        buffers = self.data.get("buffers", [])
        if len(buffers) != 1 or buffers[0].get("uri") or buffers[0]["byteLength"] > len(self.binary):
            raise ValueError("GLB must contain its own complete binary buffer")
        self.file_hash = sha(raw)
        self.accessor_cache = {}
        self.image_hashes = []
        for image in self.data.get("images", []):
            if "bufferView" not in image or "uri" in image:
                raise ValueError("Every model texture image must be embedded")
            blob = self.buffer_view(image["bufferView"])
            if len(blob) < 128 or image.get("mimeType") not in ("image/png", "image/jpeg", "image/webp"):
                raise ValueError("Invalid or empty embedded texture image")
            self.image_hashes.append(sha(blob))
        self.materials = [self.material_signature(item)
                          for item in self.data.get("materials", [])]

    def buffer_view(self, index):
        view = self.data["bufferViews"][index]
        if view.get("buffer", 0) != 0:
            raise ValueError("External GLB buffer referenced")
        start = view.get("byteOffset", 0)
        data = self.binary[start:start + view["byteLength"]]
        if len(data) != view["byteLength"]:
            raise ValueError("Buffer view exceeds the actual BIN chunk")
        return data

    def material_signature(self, material):
        def normalize(value, key=""):
            if isinstance(value, dict):
                result = {k: normalize(v, k) for k, v in value.items()
                          if k not in ("name", "extras")}
                if key.endswith("Texture") and "index" in result:
                    texture = self.data["textures"][result.pop("index")]
                    source = texture.get("source")
                    if source is None:
                        raise ValueError("Unsupported texture source extension")
                    result["embeddedImageSha256"] = self.image_hashes[source]
                    if "sampler" in texture:
                        result["sampler"] = self.data["samplers"][texture["sampler"]]
                return result
            if isinstance(value, list):
                return [normalize(item) for item in value]
            return value
        return json_hash(normalize(material))

    def accessor(self, index):
        if index in self.accessor_cache:
            return self.accessor_cache[index]
        accessor = self.data["accessors"][index]
        width = WIDTHS[accessor["type"]]
        code, size = COMPONENTS[accessor["componentType"]]
        count = accessor["count"]
        if accessor.get("normalized"):
            raise ValueError("Normalized geometry accessors are not expected in these assets")
        if "bufferView" in accessor:
            view = self.data["bufferViews"][accessor["bufferView"]]
            binary = self.buffer_view(accessor["bufferView"])
            stride = view.get("byteStride", width * size)
            start = accessor.get("byteOffset", 0)
            if stride < width * size or start + max(0, count - 1) * stride + width * size > len(binary):
                raise ValueError("Accessor escapes its buffer view")
            values = [struct.unpack_from("<" + code * width, binary, start + i * stride)
                      for i in range(count)]
        else:
            values = [(0,) * width for _ in range(count)]
        if "sparse" in accessor:
            sparse = accessor["sparse"]
            indices, sparse_values = sparse["indices"], sparse["values"]
            index_code, index_size = COMPONENTS[indices["componentType"]]
            index_buffer = self.buffer_view(indices["bufferView"])
            value_buffer = self.buffer_view(sparse_values["bufferView"])
            for i in range(sparse["count"]):
                target = struct.unpack_from("<" + index_code, index_buffer,
                                            indices.get("byteOffset", 0) + i * index_size)[0]
                values[target] = struct.unpack_from("<" + code * width, value_buffer,
                                                   sparse_values.get("byteOffset", 0) + i * width * size)
        self.accessor_cache[index] = values
        return values

    def world_meshes(self):
        result = {}
        visited = set()

        def walk(index, parent, inherited):
            if index in visited:
                raise ValueError("A node is multiply parented or cyclic")
            visited.add(index)
            node = self.data["nodes"][index]
            matrix = multiply(parent, node_matrix(node))
            metadata = {**inherited, **node.get("extras", {})}
            if "mesh" in node:
                name = node.get("name", str(index))
                if name in result:
                    raise ValueError(f"Duplicate mesh object name: {name}")
                triangles, material_ids = [], set()
                low, high = [math.inf] * 3, [-math.inf] * 3
                for primitive in self.data["meshes"][node["mesh"]]["primitives"]:
                    if primitive.get("targets") or "skin" in node:
                        raise ValueError("Unexpected animated/skinned geometry")
                    local = self.accessor(primitive["attributes"]["POSITION"])
                    points = [tuple(sum(matrix[r][c] * point[c] for c in range(3)) + matrix[r][3]
                                    for r in range(3)) for point in local]
                    for point in points:
                        if not all(math.isfinite(v) for v in point):
                            raise ValueError(f"Non-finite vertex: {name}")
                        for axis in range(3):
                            low[axis] = min(low[axis], point[axis])
                            high[axis] = max(high[axis], point[axis])
                    quantized = [tuple(round(v / GEOMETRY_GRID_M) for v in point) for point in points]
                    indices = [item[0] for item in self.accessor(primitive["indices"])] if "indices" in primitive else list(range(len(points)))
                    mode = primitive.get("mode", 4)
                    if mode == 4:
                        if len(indices) % 3:
                            raise ValueError("TRIANGLES index count is not divisible by three")
                        triplets = (indices[i:i+3] for i in range(0, len(indices), 3))
                    elif mode == 5:
                        triplets = (indices[i:i+3] for i in range(len(indices) - 2))
                    elif mode == 6:
                        triplets = ((indices[0], indices[i], indices[i+1]) for i in range(1, len(indices) - 1))
                    else:
                        raise ValueError(f"Unexpected non-triangle primitive mode: {mode}")
                    for triplet in triplets:
                        canonical = sorted(quantized[i] for i in triplet)
                        triangles.append(struct.pack("<9q", *(v for vertex in canonical for v in vertex)))
                    if "material" in primitive:
                        material_ids.add(self.materials[primitive["material"]])
                result[name] = {
                    "triangles": len(triangles),
                    "geometry": sha(b"".join(sorted(triangles))),
                    "bounds": [low, high],
                    "extras": metadata,
                    "materials": sorted(material_ids),
                }
            for child in node.get("children", []):
                walk(child, matrix, metadata)

        for index in self.data["scenes"][self.data.get("scene", 0)]["nodes"]:
            walk(index, IDENTITY, {})
        self.accessor_cache.clear()
        return result


def jpeg_dimensions(raw):
    if not raw.startswith(b"\xff\xd8") or not raw.endswith(b"\xff\xd9"):
        raise ValueError("Invalid or incomplete JPEG")
    offset = 2
    while offset < len(raw):
        if raw[offset] != 0xFF:
            raise ValueError("Invalid JPEG marker")
        while raw[offset] == 0xFF:
            offset += 1
        marker = raw[offset]
        offset += 1
        if marker in (0x01, 0xD8) or 0xD0 <= marker <= 0xD7:
            continue
        if marker in (0xDA, 0xD9):
            break
        length = struct.unpack_from(">H", raw, offset)[0]
        if length < 2 or offset + length > len(raw):
            raise ValueError("Invalid JPEG segment")
        if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            height, width = struct.unpack_from(">HH", raw, offset + 3)
            return width, height
        offset += length
    raise ValueError("JPEG has no frame size")


def protected_manifest(manifest):
    # Conditions, dimensions, precision grades and source statements are never
    # stripped. Only explicitly aesthetic labels and resource paths are ignored.
    cosmetic = {"render", "description", "summary", "features", "title", "name"}
    def clean(value):
        if isinstance(value, dict):
            return {k: clean(v) for k, v in value.items() if k not in cosmetic}
        if isinstance(value, list):
            return [clean(item) for item in value]
        return value
    return {key: clean(manifest.get(key)) for key in
            ("version", "units", "source", "sourceSha256", "bounds", "overviewCamera",
             "rooms", "openings", "bayDetails", "storageDetails")}


def manifest_render_paths(manifest):
    paths = [manifest["overallRender"]]
    for collection in ("rooms", "bayDetails", "storageDetails"):
        paths.extend(item["render"] for item in manifest.get(collection, []) if item.get("render"))
    return set(paths)


class Audit:
    def __init__(self, pending=False):
        self.pending = pending
        self.checks = []
        self.errors = []
        self.waiting = []
        self.details = {}

    def check(self, condition, success, failure=None):
        if condition:
            self.checks.append(success)
        else:
            self.errors.append(failure or success)
        return bool(condition)

    def geometry(self, sid, base, variant):
        names_equal = self.check(set(base) == set(variant), f"{sid}: mesh object inventory preserved ({len(base)})",
                                 f"{sid}: added/missing mesh objects; missing={sorted(set(base)-set(variant))[:8]}, added={sorted(set(variant)-set(base))[:8]}")
        if not names_equal:
            return
        changed, wrong = [], []
        for name, original in base.items():
            item = variant[name]
            if name in ALLOWED_SHADES:
                low, high = item["bounds"]
                base_low, base_high = original["bounds"]
                self.check(all(low[a] >= base_low[a] - BOUNDS_TOLERANCE_M and high[a] <= base_high[a] + BOUNDS_TOLERANCE_M for a in range(3)),
                           f"{sid}: {name} remains within its original world-space bounds")
                self.check(item["geometry"] != original["geometry"], f"{sid}: {name} has a real new shade shape")
                continue
            if item["geometry"] != original["geometry"] or item["triangles"] != original["triangles"]:
                wrong.append(name)
            if item["materials"] != original["materials"]:
                changed.append(name)
            self.check(all(item["extras"].get(key) == value for key, value in original["extras"].items()),
                       f"{sid}: mesh metadata preserved: {name}", f"{sid}: room/geometry metadata changed: {name}")
        self.check(not wrong, f"{sid}: all {len(base)-len(ALLOWED_SHADES)} protected world-triangle geometries identical",
                   f"{sid}: protected geometry changed: {wrong[:12]}")
        self.check(len(changed) >= 50, f"{sid}: actual material/texture changes on {len(changed)} protected objects",
                   f"{sid}: only {len(changed)} objects have a real material change")
        self.details[sid]["protectedMeshObjects"] = len(base) - len(ALLOWED_SHADES)
        self.details[sid]["materialChangedObjects"] = len(changed)
        self.details[sid]["worldTriangleGeometryHash"] = json_hash({name: item["geometry"] for name, item in variant.items() if name not in ALLOWED_SHADES})

    def self_test(self):
        """Exercise real geometry decoding with tiny, in-memory GLB fixtures."""
        def fixture(points, indices, translation=(0, 0, 0)):
            model = GLB.__new__(GLB)
            vertices = b"".join(struct.pack("<3f", *point) for point in points)
            index_bytes = struct.pack("<" + "H" * len(indices), *indices)
            model.binary = vertices + index_bytes
            model.data = {
                "bufferViews": [{"byteOffset": 0, "byteLength": len(vertices)},
                                {"byteOffset": len(vertices), "byteLength": len(index_bytes)}],
                "accessors": [{"bufferView": 0, "componentType": 5126, "type": "VEC3", "count": len(points)},
                              {"bufferView": 1, "componentType": 5123, "type": "SCALAR", "count": len(indices)}],
                "meshes": [{"primitives": [{"attributes": {"POSITION": 0}, "indices": 1}]}],
                "nodes": [{"name": "fixture", "mesh": 0, "translation": list(translation)}],
                "scenes": [{"nodes": [0]}],
            }
            model.accessor_cache = {}
            model.materials = []
            return model.world_meshes()["fixture"]
        a = (0, 0, 0)
        b = (1, 0, 0)
        c = (1, 1, 0)
        d = (0, 1, 0)
        base = fixture([a, b, c, d], [0, 1, 2, 0, 2, 3])
        reordered = fixture([d, a, c, b, a, c], [4, 5, 0, 1, 3, 2])
        self.check(base["geometry"] == reordered["geometry"], "Self-test: vertex splitting, vertex order and triangle order do not affect geometry comparison")
        missing_surface = fixture([a, b, c, d], [0, 1, 2])
        self.check(base["bounds"] == missing_surface["bounds"] and base["geometry"] != missing_surface["geometry"],
                   "Self-test: a missing surface with identical accessor/world bounds is detected")
        moved = fixture([a, b, c, d], [0, 1, 2, 0, 2, 3], (0.001, 0, 0))
        self.check(base["geometry"] != moved["geometry"], "Self-test: a 1 mm node translation is detected")

    def renders(self, scheme, manifest):
        sid = scheme["id"]
        prefix = "assets/blender-renders" if sid == "wood" else f"assets/schemes/{sid}"
        expected = {f"{prefix}/{name}.jpg" for name in VIEWS}
        self.check(manifest_render_paths(manifest) == expected, f"{sid}: manifest references all 15 own-scheme views, without fallback")
        self.check(scheme["hero"] in expected, f"{sid}: gallery hero belongs to this scheme")
        self.details[sid]["renderHashes"] = {}
        for name in VIEWS:
            relative = f"{prefix}/{name}.jpg"
            path = relative_file(relative)
            if not path.is_file():
                message = f"{sid}/{name}: render missing"
                (self.waiting if self.pending and sid != "wood" else self.errors).append(message)
                continue
            raw = path.read_bytes()
            dimensions = jpeg_dimensions(raw)
            self.details[sid]["renderHashes"][name] = sha(raw)
            if sid == "wood":
                self.check(min(dimensions) >= 640, f"{sid}/{name}: complete JPEG {dimensions[0]}x{dimensions[1]}")
                continue
            spec = scheme["renderSpec"]
            record = manifest.get("renderedViews", {}).get(name)
            self.check(dimensions == (spec["width"], spec["height"]), f"{sid}/{name}: actual JPEG dimensions match render spec")
            if not record:
                self.errors.append(f"{sid}/{name}: existing image has no render provenance record")
                continue
            self.check(record.get("appearanceHash") == manifest["appearanceHash"] and record.get("baseGeometryHash") == manifest["baseGeometryHash"],
                       f"{sid}/{name}: render provenance matches appearance and geometry")
            self.check(record.get("renderSpec") == {key: spec[key] for key in ("width", "height", "samples")},
                       f"{sid}/{name}: recorded render quality matches scheme")

    def run(self):
        self.self_test()
        data = load_json(ROOT / "models/design-schemes.json")
        schemes = data.get("schemes", [])
        self.check(tuple(item.get("id") for item in schemes) == SCHEME_IDS, "Exactly four named schemes with original wood first")
        self.check(data.get("defaultScheme") == "wood", "Original scheme remains the default")
        source_path = relative_file(data["geometrySource"])
        # Match the baseline builder's UTF-8 text / universal-newline hash so
        # a normal Windows CRLF checkout does not invalidate unchanged data.
        source_hash = sha(source_path.read_text(encoding="utf-8").encode("utf-8"))
        refs = data.get("references", [])
        ref_ids = [item.get("id") for item in refs]
        self.check(len(set(ref_ids)) == len(ref_ids), "Research reference IDs are unique")
        for item in refs:
            self.check(all(item.get(key) for key in ("id", "title", "url", "author", "date", "kind", "borrow", "avoid")) and urlparse(item["url"]).scheme == "https",
                       f"Reference {item.get('id')}: attributed HTTPS source and bounded borrowing notes")
        baseline = load_json(ROOT / "models/scene-manifest.json")
        base_glb = GLB(ROOT / "models/huiyayuan-wood.glb")
        base_meshes = base_glb.world_meshes()
        self.check(ALLOWED_SHADES <= set(base_meshes), "Both approved pendant objects exist in baseline")
        self.check(len(base_meshes) >= 1200, f"Decoded {len(base_meshes)} baseline world-space mesh objects")
        base_blend_hash = sha((ROOT / "models/huiyayuan-wood.blend").read_bytes())
        ceramic_signatures = {signature for material, signature in zip(base_glb.data.get("materials", []), base_glb.materials)
                              if material.get("name") == "Ceramic"}
        builder_ast = ast.parse((ROOT / "tools/build_design_schemes.py").read_text(encoding="utf-8"))
        algorithm = next(ast.literal_eval(item.value) for item in builder_ast.body
                         if isinstance(item, ast.Assign) and any(isinstance(target, ast.Name) and target.id == "ALGORITHM_VERSION" for target in item.targets))
        meshes = {"wood": base_meshes}
        glbs = {"wood": base_glb}
        appearance_hashes, declared_geometry_hashes = [], []
        for scheme in schemes:
            sid = scheme["id"]
            self.details[sid] = {}
            self.check(set(scheme.get("references", [])) <= set(ref_ids), f"{sid}: every case reference resolves")
            for key in ("model", "blend", "manifest"):
                self.check(relative_file(scheme[key]).is_file(), f"{sid}: {key} file exists")
            manifest = load_json(relative_file(scheme["manifest"]))
            self.check(manifest.get("model") == scheme["model"] and manifest.get("blend") == scheme["blend"], f"{sid}: resource paths agree across catalog and manifest")
            self.check(manifest.get("sourceSha256") == source_hash, f"{sid}: source geometry SHA matches actual source file")
            if sid == "wood":
                self.check(scheme["model"] == "models/huiyayuan-wood.glb" and scheme["manifest"] == "models/scene-manifest.json" and scheme["blend"] == "models/huiyayuan-wood.blend",
                           "wood: original model, Blender source and manifest remain the referenced baseline")
            else:
                self.check(protected_manifest(manifest) == protected_manifest(baseline), f"{sid}: rooms, openings, cameras, dimensions and conditions exactly match baseline")
                self.check(all(note in manifest.get("notes", []) for note in baseline.get("notes", [])), f"{sid}: all baseline safety/measurement notes retained")
                self.check(manifest.get("schemeId") == sid, f"{sid}: manifest identifies correct scheme")
                self.check(manifest.get("baseBlendSha256") == base_blend_hash, f"{sid}: base Blender provenance matches preserved file")
                appearance = manifest.get("appearance", {})
                self.check(appearance.get("algorithmVersion") == algorithm, f"{sid}: appearance uses the current generator algorithm ({algorithm})")
                self.check(manifest.get("appearanceHash") == json_hash(appearance), f"{sid}: resolved appearance hash is valid")
                self.check(all(appearance.get(key) == value for key, value in scheme["appearance"].items()), f"{sid}: manifest appearance matches current design catalog")
                appearance_hashes.append(manifest.get("appearanceHash"))
                declared_geometry_hashes.append(manifest.get("baseGeometryHash"))
                self.check({item.get("name") for item in manifest.get("allowedGeometryOverrides", [])} == ALLOWED_SHADES,
                           f"{sid}: declared geometry override list is limited to the two shades")
                glbs[sid] = GLB(relative_file(scheme["model"]))
                meshes[sid] = glbs[sid].world_meshes()
                self.geometry(sid, base_meshes, meshes[sid])
                ceramic_objects = [name for name, item in base_meshes.items() if ceramic_signatures.intersection(item["materials"])]
                self.check(all(ceramic_signatures.intersection(base_meshes[name]["materials"]) <= set(meshes[sid].get(name, {}).get("materials", [])) for name in ceramic_objects),
                           f"{sid}: original white ceramic material preserved on {len(ceramic_objects)} objects")
                texture_changes = set(glbs[sid].image_hashes) - set(base_glb.image_hashes)
                self.check(len(texture_changes) >= 4, f"{sid}: {len(texture_changes)} genuinely new embedded image textures")
            self.details[sid]["modelSha256"] = glbs[sid].file_hash
            self.details[sid]["embeddedTextureCount"] = len(glbs[sid].image_hashes)
            self.details[sid]["textureSetHash"] = json_hash(sorted(set(glbs[sid].image_hashes)))
            self.renders(scheme, manifest)
        self.check(len(appearance_hashes) == 3 and len(set(appearance_hashes)) == 3, "Three new appearance definitions have distinct hashes")
        self.check(len(set(declared_geometry_hashes)) == 1 and bool(declared_geometry_hashes[0]), "All new schemes declare one shared protected base geometry")
        self.check(len({item["modelSha256"] for item in self.details.values()}) == 4, "All four GLB assets are distinct files")
        self.check(len({item["textureSetHash"] for item in self.details.values()}) == 4, "All four embedded texture sets have distinct contents")
        for name in VIEWS:
            hashes = [item["renderHashes"][name] for item in self.details.values() if name in item["renderHashes"]]
            self.check(len(hashes) == len(set(hashes)), f"{name}: every available scheme render has distinct image bytes")
        return self


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pending", action="store_true", help="Allow only missing new render files while generation is underway")
    parser.add_argument("--json", action="store_true", help="Print machine-readable summary, rather than concise progress")
    args = parser.parse_args()
    audit = Audit(args.pending)
    try:
        audit.run()
    except (OSError, ValueError, KeyError, IndexError, struct.error) as exc:
        audit.errors.append(f"Validation stopped: {type(exc).__name__}: {exc}")
    result = {"ok": not audit.errors, "mode": "pending-renders" if args.pending else "strict",
              "checksPassed": len(audit.checks), "errors": audit.errors,
              "pendingRenders": audit.waiting, "schemes": audit.details}
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"Design schemes: {len(audit.checks)} checks passed, {len(audit.errors)} errors, {len(audit.waiting)} pending renders")
        for sid, item in audit.details.items():
            print(f"  {sid}: {item.get('protectedMeshObjects', 'baseline')} protected meshes; "
                  f"{item.get('embeddedTextureCount', '?')} embedded textures; "
                  f"{len(item.get('renderHashes', {}))}/15 complete views")
        for error in audit.errors:
            print("ERROR:", error)
        if audit.waiting:
            print("Pending:", ", ".join(item.split(":")[0] for item in audit.waiting))
        print("PASS" if not audit.errors else "FAIL")
    return 1 if audit.errors else 0


if __name__ == "__main__":
    sys.exit(main())
