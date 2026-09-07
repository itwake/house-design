"""Replace only three flat opening details with hollow projecting bay windows.

  blender --background models/huiyayuan-wood.blend --python tools/fix_blender_bay_windows.py

The existing wall openings, room floors, study south wall, furnishings,
lighting and camera data are retained. Bay depth and solid side returns are
explicit C-grade assumptions read from the shared design data.
"""
import hashlib
import importlib.util
import json
from pathlib import Path

import bpy


ROOT=Path(__file__).resolve().parents[1]
MODELS=ROOT/"models"
TARGETS=("window_a","window_b","window_living_west")


def main():
    if not bpy.data.filepath:
        raise RuntimeError("Open the latest corrected .blend before applying this patch")
    source=MODELS/"design-data.json"
    data=json.loads(source.read_text(encoding="utf-8"))
    spec=importlib.util.spec_from_file_location("house_blender_builder",ROOT/"tools"/"build_blender.py")
    builder=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    builder.THICK=float(data.get("wallThicknessCm",12))/100
    builder.HEIGHT=float(data.get("wallHeightCm",270))/100
    for mat in bpy.data.materials:builder.MATS[mat.name]=mat
    for name in ("Wall","Oak","Stone","Glass","WhiteLinen"):
        if name not in builder.MATS:raise RuntimeError(f"Existing material missing: {name}")
    openings=builder.load_openings(data)
    wanted={op["id"]:op for op in openings if op["id"] in TARGETS}
    if set(wanted)!=set(TARGETS):raise RuntimeError("The shared data must define all three bay openings")
    for oid,op in wanted.items():
        b=op.get("bay",{})
        if op.get("windowType")!="bay" or b.get("sideStyle")!="solid":
            raise RuntimeError(f"{oid}: expected explicit bay / provisional solid-return metadata")
        if abs(float(b.get("projectionCm",0))-60)>.001:
            raise RuntimeError(f"{oid}: reviewed projection is 600 mm, measured from the outer wall surface")
    # Resolve exact targets first; do not delete walls, furnishings, or any
    # opening outside the user's three marked windows.
    removals=[obj for obj in bpy.context.scene.objects if obj.get("openingId") in TARGETS]
    for oid in TARGETS:
        if not any(obj.get("openingId")==oid for obj in removals):
            raise RuntimeError(f"No existing details found for {oid}")
    if any(obj.get("kind")!="window" for obj in removals):
        raise RuntimeError("An unexpected non-window object shares a target openingId")
    removed=[obj.name for obj in removals]
    for obj in removals:bpy.data.objects.remove(obj,do_unlink=True)
    for oid in TARGETS:builder.opening_details(wanted[oid],data)
    bpy.context.view_layer.update()
    created=[obj for obj in bpy.context.scene.objects if obj.get("openingId") in TARGETS]
    for oid in TARGETS:
        details=[obj for obj in created if obj.get("openingId")==oid]
        roles={obj.get("bayRole") for obj in details}
        if not {"frontFrame","frontGlazing","return","bottomSlab","topSlab","stoneSill","curtain"}.issubset(roles):
            raise RuntimeError(f"Incomplete bay components for {oid}")
        if any(obj.get("windowType")!="bay" for obj in details):
            raise RuntimeError(f"Unexpected flat detail left in bay opening {oid}")
    manifest_path=MODELS/"scene-manifest.json"
    manifest=json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["source"]="models/design-data.json"
    manifest["sourceSha256"]=hashlib.sha256(source.read_bytes().replace(b"\r\n",b"\n")).hexdigest()
    manifest["openings"]=openings
    manifest["bounds"]=builder.geometry_bounds(data,openings)
    descriptions={"living":builder.BAY_DESCRIPTIONS["living"],"room_a":builder.BAY_DESCRIPTIONS["master"],"room_b":builder.BAY_DESCRIPTIONS["bedroom-b"]}
    for room in manifest["rooms"]:
        if room["id"] in descriptions:room["description"]=descriptions[room["id"]]
    if builder.BAY_NOTE not in manifest.get("notes",[]):manifest.setdefault("notes",[]).append(builder.BAY_NOTE)
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
    bpy.context.scene["bayWindowPatchVersion"]=1
    bpy.context.scene["geometrySourceSha256"]=manifest["sourceSha256"]
    bpy.ops.wm.save_as_mainfile(filepath=str(MODELS/"huiyayuan-wood.blend"),compress=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type=="MESH" and obj.get("kind") not in ("ceiling","backdrop"):
            obj.hide_set(False)
            obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(MODELS/"huiyayuan-wood.glb"),export_format="GLB",use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True,export_texcoords=True,export_normals=True,export_materials="EXPORT",export_image_format="AUTO")
    bpy.ops.object.select_all(action="DESELECT")
    print("BAY_WINDOWS_PATCH_COMPLETE",json.dumps({"targets":TARGETS,"removedDetails":len(removed),"createdDetails":len(created),"bounds":manifest["bounds"],"sourceSha256":manifest["sourceSha256"]},ensure_ascii=False),flush=True)


if __name__=="__main__":main()
