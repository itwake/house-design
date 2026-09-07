"""Move only bedroom B's complete table lamp clear of the north wall.

  blender --background models/huiyayuan-wood.blend --python tools/fix_blender_desk_lamp.py

The target comes from the desk footprint and the lamp shade radius. No
other furnishings, architecture, material, camera or light object changes.
"""
import importlib.util
import json
from pathlib import Path

import bpy
from mathutils import Vector


ROOT=Path(__file__).resolve().parents[1]
MODELS=ROOT/"models"
PARTS=("Lamp base","Lamp upright","Pleated linen lampshade","Warm lamp bulb")


def main():
    if not bpy.data.filepath:raise RuntimeError("Open the latest .blend before this patch")
    data=json.loads((MODELS/"design-data.json").read_text(encoding="utf-8"))
    desk=next(f for f in data["furniture"] if f["name"]=="次卧书桌")
    fid=str(desk.get("id") or desk.get("furnitureId") or desk["name"])
    spec=importlib.util.spec_from_file_location("house_blender_builder",ROOT/"tools"/"build_blender.py")
    builder=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    target=builder.desk_lamp_position(desk)
    parts=[o for o in bpy.context.scene.objects if o.get("furnitureId")==fid and o.name.startswith(PARTS)]
    if len(parts)!=4:raise RuntimeError(f"Expected four existing bedroom B lamp components, found {len(parts)}")
    base=next(o for o in parts if o.name.startswith("Lamp base"))
    delta=Vector((target[0]-base.location.x,-target[1]-base.location.y,0))
    if abs(delta.x)>.00001 or abs(delta.z)>.00001 or delta.y>.00001 or delta.length>.0251:
        raise RuntimeError(f"Unexpected lamp movement: {tuple(delta)}")
    for obj in parts:obj.location+=delta
    bpy.context.view_layer.update()
    for obj in parts:
        pts=[obj.matrix_world @ Vector(c) for c in obj.bound_box]
        if min(p.x for p in pts)<desk["x"]/100-.00001 or max(p.x for p in pts)>(desk["x"]+desk["w"])/100+.00001:
            raise RuntimeError(f"Lamp part exceeds desk width: {obj.name}")
        if min(-p.y for p in pts)<desk["y"]/100-.00001 or max(-p.y for p in pts)>(desk["y"]+desk["d"])/100+.00001:
            raise RuntimeError(f"Lamp part exceeds desk depth: {obj.name}")
    bpy.context.scene["bedroomBDeskLampPatchVersion"]=1
    bpy.ops.wm.save_as_mainfile(filepath=str(MODELS/"huiyayuan-wood.blend"),compress=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type=="MESH" and obj.get("kind") not in ("ceiling","backdrop"):
            obj.hide_set(False)
            obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(MODELS/"huiyayuan-wood.glb"),export_format="GLB",use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True,export_texcoords=True,export_normals=True,export_materials="EXPORT",export_image_format="AUTO")
    bpy.ops.object.select_all(action="DESELECT")
    print("DESK_LAMP_PATCH_COMPLETE",json.dumps({"furnitureId":fid,"movedParts":[o.name for o in parts],"deltaBlenderM":list(delta),"targetPlanM":target},ensure_ascii=False),flush=True)


if __name__=="__main__":main()
