"""Add only the omitted solid wall between study C and the living room.

Run after the calibrated source has appended w_bed_c_south:
  blender --background models/huiyayuan-wood.blend --python tools/fix_blender_study_wall.py

Existing furnishings, lighting, cameras, openings, room floors and material
definitions are preserved. New wall and skirting use the build script's
existing box construction and the .blend's existing Wall / Cream materials.
"""
import hashlib
import importlib.util
import json
from pathlib import Path

import bpy


ROOT=Path(__file__).resolve().parents[1]
MODELS=ROOT/"models"
WALL_ID="w_bed_c_south"
EXPECTED=[206,626,319,626]


def wall_coords(value):
    return value.get("coords",value) if isinstance(value,dict) else value


def main():
    if not bpy.data.filepath:
        raise RuntimeError("Open the existing .blend before applying this patch")
    source=MODELS/"design-data.json"
    data=json.loads(source.read_text(encoding="utf-8"))
    wall_spec=next((w for w in data.get("wallSpecs",[]) if w.get("id")==WALL_ID),None)
    if wall_spec is None:
        raise RuntimeError("Append w_bed_c_south to the shared design data first")
    if wall_coords(wall_spec)!=EXPECTED:
        raise RuntimeError("Unexpected study south-wall coordinates; review the patch")
    matches=[i for i,w in enumerate(data["walls"]) if wall_coords(w)==EXPECTED]
    if len(matches)!=1:
        raise RuntimeError("Expected exactly one shared-data study south wall")
    idx=matches[0]
    if idx!=len(data["walls"])-1:
        raise RuntimeError("The correction must be appended to preserve existing wallIndex values")
    height=float(wall_spec.get("heightCm",data.get("wallHeightCm",270)))/100
    thick=float(wall_spec.get("thicknessCm",data.get("wallThicknessCm",12)))/100
    if abs(height-2.70)>.0001 or abs(thick-.12)>.0001:
        raise RuntimeError("This correction was checked for a 120 mm thick, 2700 mm high wall")
    spec=importlib.util.spec_from_file_location("house_blender_builder",ROOT/"tools"/"build_blender.py")
    builder=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    for name in ("Wall","Cream"):
        mat=bpy.data.materials.get(name)
        if mat is None:raise RuntimeError(f"Existing material {name} is missing")
        builder.MATS[name]=mat
    ax,ay,bx,by=[v/100 for v in EXPECTED]
    cx,cy=(ax+bx)/2,(ay+by)/2
    width=bx-ax
    # This matches wall_and_openings(): the south/positive-plan-y room owns
    # the wall tag; the physical wall also borders room_c to its north.
    room=builder.room_at(cx,cy+.08,data["rooms"])
    candidates=[o for o in bpy.context.scene.objects if o.type=="MESH" and o.get("wallIndex")==idx and o.name.startswith("Wall ")]
    added=[]
    if len(candidates)>1:
        raise RuntimeError("Multiple existing objects claim the new wall index")
    if candidates:
        wall=candidates[0]
        expected=(width,thick,height)
        if any(abs(wall.dimensions[i]-expected[i])>.001 for i in range(3)):
            raise RuntimeError("Existing indexed wall has different dimensions; refusing to overwrite it")
    else:
        wall=builder.box(f"Wall {idx:02} / pier",cx,cy,0,width,thick,height,"Wall",.001,"wall",room)
        added.append(wall.name)
    wall["kind"]="wall"
    wall["wallId"]=WALL_ID
    wall["wallIndex"]=idx
    wall["roomId"]=room
    wall["otherRoomId"]="room_c"
    wall["external"]=False
    wall.hide_render=False
    wall.hide_set(False)
    skirting=bpy.data.objects.get(f"Skirting {idx:02}")
    if skirting is None:
        skirting=builder.box(f"Skirting {idx:02}",cx,cy,.005,width,thick+.018,.07,"Cream",.002,"wall",room)
        added.append(skirting.name)
    skirting["kind"]="wall"
    skirting["wallId"]=WALL_ID
    skirting["wallIndex"]=idx
    skirting["roomId"]=room
    skirting["otherRoomId"]="room_c"
    skirting["external"]=False
    skirting.hide_render=False
    skirting.hide_set(False)
    bpy.context.view_layer.update()
    manifest_path=MODELS/"scene-manifest.json"
    manifest=json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["source"]="models/design-data.json"
    manifest["sourceSha256"]=hashlib.sha256(source.read_bytes().replace(b"\r\n",b"\n")).hexdigest()
    manifest["openings"]=builder.load_openings(data)
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
    bpy.context.scene["studySouthWallPatchVersion"]=1
    bpy.context.scene["geometrySourceSha256"]=manifest["sourceSha256"]
    bpy.ops.wm.save_as_mainfile(filepath=str(MODELS/"huiyayuan-wood.blend"),compress=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type=="MESH" and obj.get("kind") not in ("ceiling","backdrop"):
            obj.hide_set(False)
            obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(MODELS/"huiyayuan-wood.glb"),export_format="GLB",use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True,export_texcoords=True,export_normals=True,export_materials="EXPORT",export_image_format="AUTO")
    bpy.ops.object.select_all(action="DESELECT")
    print("STUDY_SOUTH_WALL_PATCH_COMPLETE",json.dumps({"wallId":WALL_ID,"wallIndex":idx,"sourceCm":EXPECTED,"wallDimensionsM":[width,thick,height],"roomId":room,"added":added,"sourceSha256":manifest["sourceSha256"]},ensure_ascii=False),flush=True)


if __name__=="__main__":main()
