"""Update only the reviewed sideboard camera in an already-built scene.

Run after the full build has finished:
  blender --background models/huiyayuan-wood.blend --python tools/fix_blender_storage_cameras.py

The GLB deliberately exports no cameras, so it requires no regeneration.
No transforms, geometry, lighting, or other camera settings are modified.
"""
import importlib.util
import json
import math
from pathlib import Path

import bpy


ROOT=Path(__file__).resolve().parents[1]
MODELS=ROOT/"models"


def main():
    if not bpy.data.filepath:
        raise RuntimeError("Open the newly built apartment .blend first")
    path=MODELS/"scene-manifest.json"
    manifest=json.loads(path.read_text(encoding="utf-8"))
    matches=[item for item in manifest.get("storageDetails",[]) if item.get("id")=="sideboard"]
    if len(matches)!=1:
        raise RuntimeError("Expected one sideboard storage-detail camera in the new manifest")
    obj=bpy.data.objects.get("sideboard")
    if not obj or obj.type!="CAMERA":
        raise RuntimeError("The newly built sideboard camera was not found")
    spec=importlib.util.spec_from_file_location("house_builder",ROOT/"tools"/"build_blender.py")
    builder=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    _position,_target,lens=builder.VIEWS["sideboard"]
    previous=float(obj.data.lens)
    obj.data.lens=lens
    detail_camera=matches[0]["interiorCamera"]
    detail_camera["horizontalFov"]=round(math.degrees(2*math.atan(36/(2*lens))),2)
    detail_camera["fov"]=round(math.degrees(2*math.atan(24/(2*lens))),2)
    bpy.ops.wm.save_as_mainfile(filepath=str(MODELS/"huiyayuan-wood.blend"),compress=True)
    path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
    print("STORAGE_CAMERA_PATCH_COMPLETE",json.dumps({"camera":"sideboard","previousLens":previous,"lens":lens,"horizontalFov":detail_camera["horizontalFov"],"verticalFov":detail_camera["fov"],"glbChanged":False}),flush=True)


if __name__=="__main__":main()
