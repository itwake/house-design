"""Repair only coplanar render-surface intersections in the existing scene.

Run after loading models/huiyayuan-wood.blend. No room, wall, furniture
footprint, camera, light, texture or material is rebuilt. The three repairs
are a blanket layer 2 mm above its duvet; disjoint curtain folds; and door /
window frame jambs meeting their head and sill without overlapping faces.

  blender --background models/huiyayuan-wood.blend --python tools/fix_blender_surfaces.py
"""
from pathlib import Path
import json

import bpy
from mathutils import Vector


ROOT=Path(__file__).resolve().parents[1]
MODELS=ROOT/"models"


def z_bounds(obj):
    vals=[(obj.matrix_world @ Vector(p)).z for p in obj.bound_box]
    return min(vals),max(vals)


def main():
    if not bpy.data.filepath:
        raise RuntimeError("Open the existing .blend before applying this patch")
    source=MODELS/"design-data.json"
    data=json.loads(source.read_text(encoding="utf-8"))
    openings={op["id"]:op for op in data.get("windows",[])+data.get("doors",[])}
    fixes=[]
    bpy.context.view_layer.update()
    for obj in bpy.context.scene.objects:
        if obj.type!="MESH":continue
        if " sage throw" in obj.name:
            prefix=obj.name.split(" sage throw")[0]
            duvet=next((o for o in bpy.context.scene.objects if o.name.startswith(prefix+" rounded duvet")),None)
            if duvet:
                low,_=z_bounds(obj)
                _,top=z_bounds(duvet)
                delta=top+.002-low
                if abs(delta)>.00001:
                    obj.location.z+=delta
                    fixes.append({"object":obj.name,"fix":"raise nonintersecting blanket layer","deltaZ":round(delta,6)})
        elif "linen curtain fold" in obj.name:
            # Each fold's center pitch is 33 mm; 30 mm leaves a 3 mm gap.
            axis=0 if obj.dimensions.x<obj.dimensions.y else 1
            if abs(obj.dimensions[axis]-.030)>.00001:
                obj.dimensions[axis]=.030
                fixes.append({"object":obj.name,"fix":"curtain width 30 mm / pitch 33 mm"})
        elif " / jamb" in obj.name and obj.get("openingId") in openings:
            op=openings[obj["openingId"]]
            glass=op["kind"]=="window" or "glass" in op["kind"]
            frame=.038 if glass else .06
            sill=float(op.get("sillCm",90 if op["kind"]=="window" else 0))/100
            height=float(op.get("heightCm",140 if op["kind"]=="window" else 215))/100
            bottom=sill+(frame if glass else 0)
            adjusted=height-frame*(2 if glass else 1)
            if abs(obj.dimensions.z-adjusted)>.00001 or abs(obj.location.z-(bottom+adjusted/2))>.00001:
                obj.dimensions.z=adjusted
                obj.location.z=bottom+adjusted/2
                fixes.append({"object":obj.name,"fix":"jamb joined edge-to-edge with frame"})
    bpy.context.view_layer.update()
    bpy.context.scene["surfacePatchVersion"]=1
    bpy.ops.wm.save_as_mainfile(filepath=str(MODELS/"huiyayuan-wood.blend"),compress=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type=="MESH" and obj.get("kind") not in ("ceiling","backdrop"):
            obj.hide_set(False)
            obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(MODELS/"huiyayuan-wood.glb"),export_format="GLB",use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True,export_texcoords=True,export_normals=True,export_materials="EXPORT",export_image_format="AUTO")
    bpy.ops.object.select_all(action="DESELECT")
    print("SURFACE_PATCH_COMPLETE",json.dumps({"count":len(fixes),"fixes":fixes},ensure_ascii=False),flush=True)


if __name__=="__main__":main()
