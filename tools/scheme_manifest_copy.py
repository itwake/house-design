"""Refresh appearance copy without touching render hashes or calibrated data.

Run only after the target scheme's renderer has finished writing its manifest:
    python tools/scheme_manifest_copy.py --schemes terracotta,moss,cobalt
"""
from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BASELINE_STYLE = "原木 · 奶油白 · 亚麻"


def apply_scheme_copy(manifest, scheme):
    """Only change prose fields; dimensions, conditions and provenance stay exact."""
    overrides = scheme.get("roomOverrides", {})
    style = scheme.get("style", scheme.get("name", scheme.get("title", scheme["id"])))
    manifest["schemeTitle"] = scheme.get("name", scheme.get("title", scheme["id"]))
    manifest["schemeSummary"] = scheme.get("summary", scheme.get("description", ""))
    manifest.setdefault("design", {})["style"] = style
    overall = overrides.get("overall", {})
    if overall.get("title"):
        manifest["overallTitle"] = overall["title"]
    if overall.get("description"):
        manifest["overallDescription"] = overall["description"]
    for room in manifest.get("rooms", []):
        override = overrides.get(room["id"], {})
        for field in ("title", "description"):
            if field in override:
                room[field] = override[field]
        # The existing room name is its stable functional label, not a style title.
        # Do not delete dimensional/provenance features when replacing the palette.
        features = room.get("features", [])
        room["features"] = [style if value == BASELINE_STYLE else value for value in features]
        if style not in room["features"]:
            room["features"].insert(min(1, len(room["features"])), style)
    for collection, override_name, id_name in (
        ("bayDetails", "bayOverrides", "fitoutId"),
        ("storageDetails", "storageOverrides", "storageFitoutId"),
    ):
        details = scheme.get(override_name, {})
        for item in manifest.get(collection, []):
            override = details.get(item.get(id_name, item.get("fitoutId")), {})
            if "summary" in override:
                item["summary"] = override["summary"]
    return manifest


def protected_projection(manifest):
    """Remove the allowlisted copy fields and compare everything else exactly."""
    result = copy.deepcopy(manifest)
    for field in ("schemeTitle", "schemeSummary", "overallTitle", "overallDescription"):
        result.pop(field, None)
    result.get("design", {}).pop("style", None)
    for room in result.get("rooms", []):
        for field in ("title", "description", "features"):
            room.pop(field, None)
    for collection in ("bayDetails", "storageDetails"):
        for item in result.get(collection, []):
            item.pop("summary", None)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--schemes", default="terracotta,moss,cobalt")
    args = parser.parse_args()
    schemes = {item["id"]: item for item in json.loads((ROOT / "models/design-schemes.json").read_text(encoding="utf-8"))["schemes"]}
    for sid in args.schemes.split(","):
        if sid == "wood":
            raise ValueError("The baseline manifest must not be changed")
        path = ROOT / "models/schemes" / sid / "scene-manifest.json"
        manifest = json.loads(path.read_text(encoding="utf-8"))
        protected = protected_projection(manifest)
        old_features = {room["id"]: [f for f in room.get("features", []) if f != BASELINE_STYLE] for room in manifest.get("rooms", [])}
        apply_scheme_copy(manifest, schemes[sid])
        assert protected_projection(manifest) == protected, "A non-prose field changed"
        for room in manifest.get("rooms", []):
            assert all(f in room["features"] for f in old_features[room["id"]]), "A dimensional or provenance feature was lost"
        path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        print("SCHEME_COPY_REFRESHED", sid, manifest.get("appearanceHash"), len(manifest.get("renderedViews", {})))


if __name__ == "__main__":
    main()
