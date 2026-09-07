"""Translate shower fittings onto the verified north solid wall remnants.

  blender --background models/huiyayuan-wood.blend --python tools/fix_blender_shower_windows.py

Changes only riser / head arm / head / mixer placement in the two bathrooms.
Windows, shower footprints, fixed screens, wall geometry and materials stay
as loaded. The current scene is saved and exported to the production GLB.
"""
import json
from pathlib import Path

import bpy


ROOT=Path(__file__).resolve().parents[1]
MODELS=ROOT/"models"
PARTS=("Shower riser","Shower head arm","Rain shower head","Shower mixer")


def main():
    if not bpy.data.filepath:
        raise RuntimeError("Open the existing .blend before running this patch")
    data=json.loads((MODELS/"design-data.json").read_text(encoding="utf-8"))
    placements={}
    for room,prefix,windowid in (("bath_1","主卫","window_bath_1_east"),("bath_2","客卫","window_bath_2_east")):
        footprint=next(f for f in data["furniture"] if f["name"]==prefix+"淋浴区")
        window=next(w for w in data["windows"] if w["id"]==windowid)
        y=footprint["y"]/100+.12
        wmin,wmax=sorted((window["y1"]/100,window["y2"]/100))
        headmin,headmax=y-.095,y+.095
        if not (headmax<wmin or headmin>wmax):
            raise RuntimeError(f"{room}: revised shower head still intersects window")
        if headmin<footprint["y"]/100 or headmax>(footprint["y"]+footprint["d"])/100:
            raise RuntimeError(f"{room}: revised head exceeds shower footprint")
        placements[room]={"y":y,"headY":[headmin,headmax],"windowY":[wmin,wmax],"windowGapM":round(wmin-headmax,4)}
    patched=[]
    for obj in bpy.context.scene.objects:
        room=obj.get("roomId")
        if room in placements and obj.name.startswith(PARTS):
            old=-obj.location.y
            new=placements[room]["y"]
            obj.location.y=-new
            patched.append({"room":room,"object":obj.name,"oldPlanY":round(old,5),"newPlanY":round(new,5)})
    if len(patched)!=8:
        raise RuntimeError(f"Expected eight existing shower fitting objects; found {len(patched)}")
    bpy.context.view_layer.update()
    bpy.context.scene["showerWindowPatchVersion"]=1
    bpy.ops.wm.save_as_mainfile(filepath=str(MODELS/"huiyayuan-wood.blend"),compress=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type=="MESH" and obj.get("kind") not in ("ceiling","backdrop"):
            obj.hide_set(False)
            obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(MODELS/"huiyayuan-wood.glb"),export_format="GLB",use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True,export_texcoords=True,export_normals=True,export_materials="EXPORT",export_image_format="AUTO")
    bpy.ops.object.select_all(action="DESELECT")
    print("SHOWER_WINDOW_PATCH_COMPLETE",json.dumps({"placements":placements,"patched":patched},ensure_ascii=False),flush=True)


if __name__=="__main__":main()
