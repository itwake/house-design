"""Uncover the white west-facing washer/dryer and step back through its door.

  blender --background models/huiyayuan-wood.blend --python tools/fix_blender_balcony.py

Moves the existing oak cheek to the north side of the same appliance volume;
changes only the balcony camera; preserves architecture and appliance fronts.
"""
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT=Path(__file__).resolve().parents[1]
MODELS=ROOT/"models"
POS=(5.60,10.70,1.45)
TARGET=(7.72,10.35,1.18)
LENS=20


def main():
    if not bpy.data.filepath:
        raise RuntimeError("Open the existing .blend before applying this patch")
    data=json.loads((MODELS/"design-data.json").read_text(encoding="utf-8"))
    f=next(f for f in data["furniture"] if f["name"]=="洗烘塔")
    x,y,w,d=[f[k]/100 for k in ("x","y","w","d")]
    side=bpy.data.objects.get("Laundry oak side panel")
    if side is None:raise RuntimeError("Expected the existing laundry oak cheek")
    if not side.get("northSidePatchV1"):
        # Rotate the actual thin panel, avoiding a 43x bevel stretch.
        if side.dimensions.x<side.dimensions.y:
            side.rotation_euler.z+=math.pi/2
        bpy.context.view_layer.update()
        side.dimensions=(w,.015,2.30)
        side.location=(x+w/2,-(y+.0075),1.15)
        side["northSidePatchV1"]=True
    cam=bpy.data.objects.get("balcony")
    if cam is None or cam.type!="CAMERA":raise RuntimeError("Expected the balcony camera")
    cam.location=(POS[0],-POS[1],POS[2])
    aim=Vector((TARGET[0],-TARGET[1],TARGET[2]))
    cam.rotation_euler=(aim-cam.location).to_track_quat("-Z","Y").to_euler()
    cam.data.lens=LENS
    cam.data.sensor_width=36
    # The central sightline must traverse the existing 1500 mm balcony door.
    op=next(o for o in data["doors"] if o["id"]=="balcony_door")
    doorx=op["x1"]/100
    t=(doorx-POS[0])/(TARGET[0]-POS[0])
    crossy=POS[1]+t*(TARGET[1]-POS[1])
    crossz=POS[2]+t*(TARGET[2]-POS[2])
    lo,hi=sorted((op["y1"]/100,op["y2"]/100))
    if not (0<t<1 and lo<crossy<hi and 0<crossz<op["heightCm"]/100):
        raise RuntimeError("Balcony camera ray failed the actual door-opening check")
    manifest_path=MODELS/"scene-manifest.json"
    manifest=json.loads(manifest_path.read_text(encoding="utf-8"))
    room=next(r for r in manifest["rooms"] if r["id"]=="balcony")
    room["interiorCamera"]={"position":[POS[0],POS[2],POS[1]],"target":[TARGET[0],TARGET[2],TARGET[1]],"horizontalFov":round(math.degrees(2*math.atan(36/(2*LENS))),2),"fov":round(math.degrees(2*math.atan(24/(2*LENS))),2)}
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
    bpy.context.view_layer.update()
    bpy.context.scene["balconyPatchVersion"]=1
    bpy.ops.wm.save_as_mainfile(filepath=str(MODELS/"huiyayuan-wood.blend"),compress=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type=="MESH" and obj.get("kind") not in ("ceiling","backdrop"):
            obj.hide_set(False)
            obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(MODELS/"huiyayuan-wood.glb"),export_format="GLB",use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True,export_texcoords=True,export_normals=True,export_materials="EXPORT",export_image_format="AUTO")
    bpy.ops.object.select_all(action="DESELECT")
    print("BALCONY_PATCH_COMPLETE",json.dumps({"cameraPlanPosition":POS,"cameraPlanTarget":TARGET,"doorCrossing":[doorx,crossy,crossz],"lens":LENS,"sidePanel":"north edge; appliance front uncovered"}),flush=True)


if __name__=="__main__":main()
