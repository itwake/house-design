"""Historical palette-experiment generator, NOT a generator of layout alternatives.

  blender --background --python tools/build_design_schemes.py -- --archived --only-build
  blender --background --python tools/build_design_schemes.py -- --archived --render-only

Every build reopens the unchanged baseline. Only two existing pendant shades
may change geometry, strictly inside their original evaluated bounds. All
other evaluated mesh vertices, topology and world transforms are hashed before
and after; cameras/lights are independently protected. No base asset is saved.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
import struct
import sys
import time
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector


ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools"))
from scheme_manifest_copy import apply_scheme_copy

MODELS=ROOT/"models"
BASE_BLEND=MODELS/"huiyayuan-wood.blend"
BASE_MANIFEST=MODELS/"scene-manifest.json"
SCHEMES_FILE=MODELS/"design-schemes.json"
ALGORITHM_VERSION="scheme-pbr-4"
STONE_UV_NAME="SchemeStoneUV_1m"
VIEWS=("overall","living","dining","master","bedroom-b","study","kitchen","master-bath","guest-bath","balcony","bay-master","bay-tea","bay-living","entry-storage","sideboard")
ALLOWED_SHADES={"Organic linen pendant","Organic linen pendant.001"}

PRESETS={
    "terracotta":{
        "palette":{"wood":"#704730","floorWood":"#9B7150","wall":"#E8DACC","cabinet":"#B65F43","cabinetAccent":"#727950","sofa":"#B5744E","headboard":"#72734A","bedding":"#E5D5BA","textileAccent":"#955139","stone":"#D0B29A","metal":"#9B7951","artAccent":"#A4482F"},
        "pendantForm":"stacked_discs","textureModes":{"wood":"walnut","fabric":"tweed","stone":"clay_terrazzo"},"seed":117},
    "moss":{
        "palette":{"wood":"#736A58","floorWood":"#A99F87","wall":"#E1DFD1","cabinet":"#5A6954","cabinetAccent":"#9C9A7B","sofa":"#727C60","headboard":"#8B9475","bedding":"#E4E1CF","textileAccent":"#555F49","stone":"#B3B0A2","metal":"#797B70","artAccent":"#737D57"},
        "pendantForm":"soft_dome","textureModes":{"wood":"smoked_oak","fabric":"boucle","stone":"limestone"},"seed":223},
    "cobalt":{
        "palette":{"wood":"#A47243","floorWood":"#BF9569","wall":"#F0EADC","cabinet":"#245AB8","cabinetAccent":"#BD4537","sofa":"#D1C6AB","headboard":"#315D9B","bedding":"#EEE8D6","textileAccent":"#C33E32","stone":"#D6D3C8","metal":"#B7BEC1","artAccent":"#1E50B3"},
        "pendantForm":"disc_cone","textureModes":{"wood":"warm_oak","fabric":"woven","stone":"graphic_terrazzo"},"seed":337},
}


def parse_args():
    cli=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    parser=argparse.ArgumentParser()
    parser.add_argument("--schemes",default="terracotta,moss,cobalt")
    parser.add_argument("--archived",action="store_true",help="Explicitly rebuild retired palette experiments, never active layout schemes")
    parser.add_argument("--only-build","--build-only",dest="only_build",action="store_true")
    parser.add_argument("--render-only",action="store_true")
    parser.add_argument("--render","--views",dest="render",default="all")
    parser.add_argument("--resume",action="store_true",help="Skip completed views with matching appearance, geometry and render settings")
    parser.add_argument("--resolution",type=int,default=960)
    parser.add_argument("--samples",type=int,default=8)
    parser.add_argument("--threads",type=int,default=2)
    args=parser.parse_args(cli)
    if args.only_build and args.render_only:parser.error("Choose build-only OR render-only")
    if not args.archived:parser.error("Palette experiments are archived. This tool cannot create new layouts; use --archived only for historical reproduction.")
    return args


def sha_file(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def json_hash(value):return hashlib.sha256(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(",",":")).encode()).hexdigest()
def render_camera_state(cam):
    return {"matrix":[list(row) for row in cam.matrix_world],"lens":cam.data.lens,"sensorWidth":cam.data.sensor_width,"type":cam.data.type,"orthoScale":cam.data.ortho_scale}
def color(hex_value):
    value=hex_value.lstrip("#")
    if len(value)!=6:raise ValueError(f"Expected #RRGGBB, got {hex_value}")
    return np.array([int(value[i:i+2],16)/255 for i in (0,2,4)],dtype=np.float32)


def linear_color(srgb):
    """UI hex is sRGB; untextured Principled inputs are scene-linear."""
    return np.where(srgb<=.04045,srgb/12.92,((srgb+.055)/1.055)**2.4)


def resolved_appearance(scheme):
    raw=scheme.get("appearance",{})
    preset=raw.get("preset",scheme["id"])
    if preset not in PRESETS:raise ValueError(f"Unknown appearance preset {preset}")
    value=copy.deepcopy(PRESETS[preset])
    for key,item in raw.items():
        if key in ("palette","textureModes"):value[key].update(item)
        else:value[key]=item
    value["preset"]=preset
    value["algorithmVersion"]=ALGORITHM_VERSION
    for item in value["palette"].values():color(item)
    return value


def evaluated_coords(obj,depsgraph):
    evaluated=obj.evaluated_get(depsgraph)
    mesh=evaluated.to_mesh()
    try:
        coords=np.empty(len(mesh.vertices)*3,dtype=np.float32)
        mesh.vertices.foreach_get("co",coords)
        loops=np.empty(len(mesh.loops),dtype=np.int32)
        mesh.loops.foreach_get("vertex_index",loops)
        counts=np.empty(len(mesh.polygons),dtype=np.int32)
        mesh.polygons.foreach_get("loop_total",counts)
        return coords.reshape((-1,3)),loops,counts
    finally:evaluated.to_mesh_clear()


def protected_geometry_hash():
    """Hash actual evaluated geometry, including modifiers, not proxy boxes."""
    bpy.context.view_layer.update()
    depsgraph=bpy.context.evaluated_depsgraph_get()
    digest=hashlib.sha256()
    count=0
    for obj in sorted(bpy.context.scene.objects,key=lambda item:item.name):
        if obj.type!="MESH" or obj.name in ALLOWED_SHADES:continue
        coords,loops,counts=evaluated_coords(obj,depsgraph)
        digest.update(obj.name.encode("utf-8")+b"\0")
        digest.update(struct.pack("<III",len(coords),len(loops),len(counts)))
        digest.update(coords.astype("<f4").tobytes())
        digest.update(loops.astype("<i4").tobytes())
        digest.update(counts.astype("<i4").tobytes())
        digest.update(np.array(obj.matrix_world,dtype="<f8").tobytes())
        count+=1
    return digest.hexdigest(),count


def camera_light_hash():
    items=[]
    for obj in sorted(bpy.context.scene.objects,key=lambda item:item.name):
        if obj.type not in ("CAMERA","LIGHT"):continue
        value={"name":obj.name,"type":obj.type,"matrix":[list(row) for row in obj.matrix_world]}
        if obj.type=="CAMERA":value.update(lens=obj.data.lens,sensor=obj.data.sensor_width,ortho=obj.data.ortho_scale)
        else:value.update(energy=obj.data.energy,color=list(obj.data.color),size=getattr(obj.data,"size",0))
        items.append(value)
    return json_hash(items)


class SchemeMaterials:
    def __init__(self,appearance,outdir):
        self.appearance=appearance
        self.palette=appearance["palette"]
        self.outdir=outdir/"textures"
        self.outdir.mkdir(parents=True,exist_ok=True)
        self.cache={}
        self.maps={}
        self.assignments={}
        self.rng=np.random.default_rng(int(appearance["seed"]))

    @staticmethod
    def stone_uv(obj):
        """Variant-only planar UVs: one repeat is one world metre on every face.

        Existing primitive UVs span a whole box face, so using them gives a
        small tile and a long splashback different chip sizes. This layer only
        changes texture coordinates, never vertices, topology or transforms.
        """
        mesh=obj.data
        uv=mesh.uv_layers.get(STONE_UV_NAME) or mesh.uv_layers.new(name=STONE_UV_NAME)
        matrix=obj.matrix_world
        normal_matrix=matrix.to_3x3().inverted().transposed()
        for polygon in mesh.polygons:
            normal=(normal_matrix @ polygon.normal).normalized()
            axis=max(range(3),key=lambda index:abs(normal[index]))
            axes=((1,2),(0,2),(0,1))[axis]
            for loop_index in polygon.loop_indices:
                point=matrix @ mesh.vertices[mesh.loops[loop_index].vertex_index].co
                uv.data[loop_index].uv=(point[axes[0]],point[axes[1]])
        obj["schemeStoneTextureRepeatMeters"]=1.0

    def texture(self,key,base,kind):
        token=(key,kind)
        if token in self.maps:return self.maps[token]
        size=512
        yy,xx=np.mgrid[0:size,0:size].astype(np.float32)/size
        rng=np.random.default_rng(int(self.appearance["seed"])+sum(ord(c) for c in key+kind))
        noise=rng.normal(0,1,(size,size)).astype(np.float32)
        rgb=np.broadcast_to(base,(size,size,3)).copy()
        mode=self.appearance["textureModes"]
        if kind=="wood":
            frequency=34 if mode["wood"]=="walnut" else 55
            phase=xx*frequency+.28*np.sin(yy*9)+.12*np.sin(yy*28+xx*8)
            grain=np.sin(phase*math.tau)*.043+np.sin(phase*math.tau*3.3)*.016+noise*.008
            height=grain*.7
            rgb+=grain[:,:,None]*np.array([.9,.72,.48])
        elif kind=="fabric":
            weave=(np.sin(xx*math.tau*100)*np.sin(yy*math.tau*92))
            if mode["fabric"]=="boucle":
                weave=np.sin(xx*math.tau*42+np.sin(yy*51))*np.cos(yy*math.tau*37)
                detail=.052*weave+noise*.015
            elif mode["fabric"]=="tweed":detail=.036*weave+.026*np.sin((xx+yy)*math.tau*23)+noise*.018
            else:detail=.030*weave+noise*.009
            rgb+=detail[:,:,None]
            height=detail
        elif kind=="stone":
            grain=.006*np.sin(xx*16+np.sin(yy*23))+.004*np.sin(yy*43+xx*11)+noise*.005
            rgb+=grain[:,:,None]
            height=grain*.16
            if mode["stone"]!="limestone":
                # 3–8 mm chips at the explicit 1 m UV repeat. Keep colour
                # contrast subdued so stone cannot resemble flaking paint.
                for _ in range(1000):
                    cx,cy=rng.random(2);rx,ry=rng.uniform(.0015,.004,2)
                    mask=((xx-cx)/rx)**2+((yy-cy)/ry)**2<1
                    pigment=color(self.palette["artAccent"] if mode["stone"]=="graphic_terrazzo" and rng.random()<.2 else self.palette["wood"])
                    chip=base*.76+pigment*.24
                    rgb[mask]=chip*rng.uniform(.98,1.02)
        elif kind=="art":
            rgb[:]=color(self.palette["bedding"])
            accent=color(self.palette["artAccent"])
            dark=color(self.palette["wood"])
            other=color(self.palette["cabinetAccent"])
            if self.appearance["preset"]=="cobalt":
                rgb[(xx>.12)&(xx<.48)&(yy>.12)&(yy<.78)]=accent
                rgb[(xx>.53)&(xx<.89)&(yy>.55)&(yy<.89)]=other
                rgb[(xx-.70)**2+(yy-.30)**2<.026]=dark
            elif self.appearance["preset"]=="moss":
                rgb[((xx-.38)/.28)**2+((yy-.54)/.34)**2<1]=accent
                rgb[((xx-.65)/.19)**2+((yy-.33)/.26)**2<1]=other
                rgb[(yy>.79)&(yy<.815)]=dark
            else:
                rgb[((xx-.45)/.31)**2+((yy-.42)/.29)**2<1]=accent
                rgb[(xx>.52)&(xx<.74)&(yy>.25)&(yy<.83)]=other
                rgb[(yy>.73)&(yy<.78)&(xx>.13)&(xx<.88)]=dark
            rgb+=noise[:,:,None]*.008
            height=noise*.006
        else:raise ValueError(kind)
        rgb=np.clip(rgb,0.015,.98)
        def image(name,channels,noncolor=False):
            img=bpy.data.images.new(name,width=size,height=size,alpha=True)
            img.colorspace_settings.name="Non-Color" if noncolor else "sRGB"
            rgba=np.ones((size,size,4),dtype=np.float32);rgba[:,:,:3]=channels
            img.pixels.foreach_set(rgba.ravel())
            img.filepath_raw=str(self.outdir/(name+".png"));img.file_format="PNG"
            img.save();img.pack()
            return img
        diffuse=image(key+"-"+kind,rgb)
        gy,gx=np.gradient(height)
        normal=np.dstack((-gx*4,-gy*4,np.ones_like(height)))
        normal/=np.linalg.norm(normal,axis=2)[:,:,None]
        normal=image(key+"-"+kind+"-normal",normal*.5+.5,True)
        self.maps[token]=(diffuse,normal)
        return diffuse,normal

    def get(self,role,kind=None,rough=.6,metal=0):
        key=(role,kind,rough,metal)
        if key in self.cache:return self.cache[key]
        neutrals={"neutralStone":"#E8E6DF","neutralCeramic":"#E3E2DC"}
        base=color(self.palette[role] if role in self.palette else neutrals[role])
        mat=bpy.data.materials.new(self.appearance["preset"]+" / "+role+(" / "+kind if kind else ""))
        linear=linear_color(base)
        mat.use_nodes=True;mat.diffuse_color=(*linear,1)
        bs=mat.node_tree.nodes.get("Principled BSDF")
        bs.inputs["Base Color"].default_value=(*linear,1)
        bs.inputs["Roughness"].default_value=rough
        bs.inputs["Metallic"].default_value=metal
        if kind:
            diffuse,normal=self.texture(role,base,kind)
            diffuse_node=mat.node_tree.nodes.new("ShaderNodeTexImage");diffuse_node.image=diffuse
            mat.node_tree.links.new(diffuse_node.outputs["Color"],bs.inputs["Base Color"])
            node=mat.node_tree.nodes.new("ShaderNodeTexImage");node.image=normal
            if kind=="stone":
                uv=mat.node_tree.nodes.new("ShaderNodeUVMap");uv.uv_map=STONE_UV_NAME
                mat.node_tree.links.new(uv.outputs["UV"],diffuse_node.inputs["Vector"])
                mat.node_tree.links.new(uv.outputs["UV"],node.inputs["Vector"])
                mat["schemeStoneTextureRepeatMeters"]=1.0
            convert=mat.node_tree.nodes.new("ShaderNodeNormalMap");convert.inputs["Strength"].default_value=.45 if kind=="fabric" else .25
            if kind=="stone":convert.uv_map=STONE_UV_NAME
            mat.node_tree.links.new(node.outputs["Color"],convert.inputs["Color"])
            mat.node_tree.links.new(convert.outputs["Normal"],bs.inputs["Normal"])
        self.cache[key]=mat
        return mat

    def choose(self,obj,original):
        name=obj.name.lower();kind=obj.get("kind");room=obj.get("roomId")
        original=original.split(".")[0]
        # These baseline components used Stone as a plain pale modelling
        # material. They are sanitary surfaces, not terrazzo accents.
        if name.startswith("concealed cistern service box"):return self.get("neutralStone",None,.58)
        if name.startswith("basin hollow"):return self.get("neutralCeramic",None,.23)
        if original in ("Glass","GlassDark","Mirror","Lamp","Leaf","LeafLight","Ceramic"):return None
        if kind=="floor":
            if original in ("Oak","OakLight","Walnut"):return self.get("floorWood","wood",.58)
            if original in ("Tile","Stone"):return self.get("stone","stone",.68)
        if kind in ("wall","ceiling","backdrop"):
            return self.get("wall",None,.9) if original=="Wall" or kind!="wall" else self.get("bedding",None,.65)
        if "textured artwork paper" in name or "small art book" in name or "linen notebook" in name:
            if "page edges" not in name:return self.get("bedding","art",.78)
        if "upholstered headboard" in name:return self.get("headboard","fabric",.92)
        if "sofa" in name:
            role="textileAccent" if "scatter cushion" in name else "sofa"
            return self.get(role,"fabric",.90)
        if "duvet" in name or "sleeping pillow" in name or "mattress" in name:return self.get("bedding","fabric",.91)
        if "sage throw" in name or "daybed sage cushion" in name:return self.get("textileAccent","fabric",.91)
        if obj.get("fitoutPartId") in ("b_cushion","b_back_cushion") or "removable soft seat" in name:return self.get("headboard","fabric",.93)
        if "rug" in name:return self.get("bedding","fabric",.96)
        if "padded seat" in name or "rounded linen chair seat" in name:return self.get("textileAccent","fabric",.9)
        # The selective door/facade overrides distinguish each scheme from a
        # global colour filter, while leaving worktops and cabinets separate.
        facade=("door" in name or "drawer front" in name or "cabinet front" in name or "cupboard" in name)
        if kind=="furniture" and facade and original in ("Oak","OakLight","Cream"):
            role="cabinetAccent" if obj.get("storagePartId") in ("d_upper",) or room=="bath_2" else "cabinet"
            explicit_role=obj.get("storageFrontPaletteRole")
            if explicit_role:
                if explicit_role not in ("cabinet","cabinetAccent"):
                    raise ValueError(f"{obj.name}: unsupported front palette role {explicit_role!r}")
                role=explicit_role
            # Root palettes reserve cabinet for the neutral background. Make
            # one actual lower kitchen run thematic, leaving the opposite run,
            # tall appliances and the rest of the storage wall restrained.
            if room=="kitchen" and "kitchen oak cabinet front" in name and "南" in obj.get("furnitureId",""):
                role="cabinetAccent"
            return self.get(role,None,.43)
        if "rounded backrest" in name or "curved oak chair back" in name:
            if self.appearance["preset"]=="cobalt":return self.get("cabinetAccent",None,.35)
        if original in ("Chrome","Brass","WarmGrayMetal"):
            return self.get("metal",None,.22 if self.appearance["preset"]=="cobalt" else .36,.94)
        if original in ("Oak","OakLight","Walnut"):return self.get("wood","wood",.5)
        if original in ("Stone","Tile"):return self.get("stone","stone",.60)
        if original in ("Linen","WhiteLinen","RollerFabric"):
            return self.get("bedding" if original!="Linen" else "headboard","fabric",.91)
        if original=="Sage":return self.get("cabinetAccent",None,.72)
        if original=="Terracotta":return self.get("artAccent",None,.65)
        if original=="Cream":return self.get("bedding",None,.63)
        return None

    def apply(self):
        for obj in bpy.context.scene.objects:
            if obj.type!="MESH" or obj.name in ALLOWED_SHADES:continue
            # Copy slots at object-data level only when a mesh happens to be
            # shared, avoiding an object's room rule leaking onto another.
            if obj.data.users>1:obj.data=obj.data.copy()
            for index,original in enumerate(list(obj.data.materials)):
                if original is None:continue
                replacement=self.choose(obj,original.name)
                if replacement:
                    if replacement.get("schemeStoneTextureRepeatMeters"):
                        self.stone_uv(obj)
                    self.assignments[obj.name+"/"+str(index)]={"from":original.name,"to":replacement.name}
                    obj.data.materials[index]=replacement


def shade_bounds(obj):
    coords,_,_=evaluated_coords(obj,bpy.context.evaluated_depsgraph_get())
    matrix=np.array(obj.matrix_world,dtype=float)
    world=(np.c_[coords,np.ones(len(coords))]@matrix.T)[:,:3]
    return coords.min(axis=0),coords.max(axis=0),world.min(axis=0),world.max(axis=0)


def replace_pendants(appearance,materials):
    changes=[]
    actual={obj.name for obj in bpy.context.scene.objects if obj.name in ALLOWED_SHADES}
    if actual!=ALLOWED_SHADES:raise ValueError("The baseline must contain exactly the two approved pendant shades")
    profiles={
        "stacked_discs":[(0,1),(.065,1),(.16,.96),(.20,.38),(.40,.52),(.47,.79),(.56,.79),(.60,.27),(.82,.40),(.91,.58),(1,.28)],
        "soft_dome":[(0,1),(.09,1),(.24,.98),(.43,.91),(.62,.78),(.78,.60),(.90,.40),(1,.17)],
        "disc_cone":[(0,1),(.08,1),(.15,.99),(.19,.61),(.35,.59),(.58,.42),(.83,.22),(1,.13)],
    }
    form=appearance["pendantForm"]
    if form not in profiles:raise ValueError(form)
    for name in sorted(ALLOWED_SHADES):
        obj=bpy.data.objects[name]
        lo,hi,world_lo,world_hi=shade_bounds(obj)
        centre=(lo+hi)/2
        radius=min((hi-lo)[:2])/2-.001
        bottom,top=float(lo[2]+.001),float(hi[2]-.001)
        profile=profiles[form];segments=48;rings=len(profile)
        verts=[]
        for inner in (False,True):
            for height,r in profile:
                rad=max(radius*r-(.004 if inner else 0),.008)
                for seg in range(segments):
                    angle=seg*math.tau/segments
                    verts.append((centre[0]+rad*math.cos(angle),centre[1]+rad*math.sin(angle),bottom+(top-bottom)*height))
        faces=[];band_ids=[]
        for inner in (0,1):
            offset=inner*rings*segments
            for ring in range(rings-1):
                for seg in range(segments):
                    nxt=(seg+1)%segments
                    indices=(offset+ring*segments+seg,offset+ring*segments+nxt,offset+(ring+1)*segments+nxt,offset+(ring+1)*segments+seg)
                    faces.append(tuple(reversed(indices)) if inner else indices);band_ids.append(ring)
        for ring in (0,rings-1):
            for seg in range(segments):
                nxt=(seg+1)%segments;a=ring*segments+seg;b=ring*segments+nxt;c=rings*segments+b;d=rings*segments+a
                faces.append((a,d,c,b) if ring==0 else (a,b,c,d));band_ids.append(ring)
        mesh=bpy.data.meshes.new(name+" / "+form)
        mesh.from_pydata(verts,[],faces);mesh.update()
        mesh.materials.append(materials.get("cabinet" if form!="soft_dome" else "stone",None,.36))
        mesh.materials.append(materials.get("cabinetAccent",None,.34))
        for index,poly in enumerate(mesh.polygons):
            poly.use_smooth=form=="soft_dome"
            poly.material_index=1 if form!="soft_dome" and band_ids[index] in (1,5) else 0
        obj.data=mesh
        for modifier in list(obj.modifiers):obj.modifiers.remove(modifier)
        obj["schemeShadeForm"]=form
        bpy.context.view_layer.update()
        _,_,new_lo,new_hi=shade_bounds(obj)
        if np.any(new_lo<world_lo-.0001) or np.any(new_hi>world_hi+.0001):raise ValueError(name+" escapes its original world bounds")
        changes.append({"name":name,"form":form,"originalBounds":[world_lo.tolist(),world_hi.tolist()],"newBounds":[new_lo.tolist(),new_hi.tolist()]})
    return changes


def render_spec(args):
    return {"engine":"CYCLES","device":"CPU","width":args.resolution,"height":round(args.resolution*2/3),"samples":args.samples,"denoise":True,"threads":args.threads,"views":list(VIEWS)}


def configure_render(args):
    scene=bpy.context.scene
    scene.render.engine="CYCLES";scene.cycles.device="CPU"
    scene.render.resolution_x=args.resolution;scene.render.resolution_y=round(args.resolution*2/3)
    scene.render.resolution_percentage=100
    scene.render.threads_mode="FIXED";scene.render.threads=args.threads
    scene.render.use_persistent_data=True
    scene.render.image_settings.file_format="JPEG";scene.render.image_settings.quality=94
    scene.cycles.samples=args.samples;scene.cycles.use_denoising=True
    scene.cycles.adaptive_threshold=.06
    scene.cycles.max_bounces=6;scene.cycles.diffuse_bounces=3;scene.cycles.glossy_bounces=3
    scene.cycles.transmission_bounces=4;scene.cycles.transparent_max_bounces=8
    # Preserve the baseline colour-management transform/exposure and lights.


def variant_manifest(scheme,appearance,geometry_hash,count,changes,args):
    result=json.loads(BASE_MANIFEST.read_text(encoding="utf-8"))
    # The baseline now has its own per-frame provenance. Those records are
    # never variant renders; only a compatible prior variant may be resumed.
    result.pop("renderedViews",None)
    sid=scheme["id"]
    model_prefix=f"models/schemes/{sid}"
    render_prefix=f"assets/schemes/{sid}"
    result["model"]=model_prefix+"/house.glb";result["blend"]=model_prefix+"/house.blend"
    result["overallRender"]=render_prefix+"/overall.jpg"
    for collection in ("rooms","bayDetails","storageDetails"):
        for item in result.get(collection,[]):
            if item.get("render"):item["render"]=render_prefix+"/"+Path(item["render"]).name
    result.update(schemeId=sid,schemeTitle=scheme.get("title",scheme.get("name",sid)),schemeSummary=scheme.get("summary",scheme.get("description","")),appearance=appearance,appearanceHash=json_hash(appearance),baseGeometryHash=geometry_hash,protectedObjectCount=count,allowedGeometryOverrides=changes,renderSpec=render_spec(args),baseBlendSha256=sha_file(BASE_BLEND))
    result.setdefault("design",{}).update(style=scheme.get("title",scheme.get("name",sid)),palette=list(appearance["palette"].values()))
    result.setdefault("notes",[]).append("本方案仅更换表面材质、织物、柜门配色及原灯罩包络内的形态；墙体、门窗、床位、全部家具占地和条件说明继承基准模型。")
    return apply_scheme_copy(result,scheme)


def export_glb(path):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type=="MESH" and obj.get("kind") not in ("ceiling","backdrop"):
            obj.hide_set(False);obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format="GLB",use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True,export_texcoords=True,export_normals=True,export_materials="EXPORT",export_image_format="AUTO")
    bpy.ops.object.select_all(action="DESELECT")


def build_scheme(scheme,args):
    sid=scheme["id"];out=MODELS/"schemes"/sid;out.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(BASE_BLEND))
    before,count=protected_geometry_hash();camera_before=camera_light_hash()
    appearance=resolved_appearance(scheme)
    materials=SchemeMaterials(appearance,out);materials.apply()
    changes=replace_pendants(appearance,materials)
    after,_=protected_geometry_hash()
    if before!=after:raise RuntimeError("Protected geometry changed while applying "+sid)
    if camera_before!=camera_light_hash():raise RuntimeError("A source camera or light changed")
    configure_render(args)
    manifest=variant_manifest(scheme,appearance,before,count,changes,args)
    prior_path=out/"scene-manifest.json"
    if prior_path.exists():
        prior=json.loads(prior_path.read_text(encoding="utf-8"))
        if prior.get("appearanceHash")==manifest["appearanceHash"] and prior.get("baseGeometryHash")==before:
            manifest["renderedViews"]=prior.get("renderedViews",{})
    manifest["materialAssignmentCount"]=len(materials.assignments)
    manifest["materialAudit"]=materials.assignments
    bpy.context.scene["schemeId"]=sid;bpy.context.scene["baseGeometryHash"]=before
    bpy.context.scene["appearanceHash"]=manifest["appearanceHash"]
    bpy.ops.wm.save_as_mainfile(filepath=str(out/"house.blend"),compress=True)
    manifest["schemeBlendSha256"]=sha_file(out/"house.blend")
    export_glb(out/"house.glb")
    (out/"scene-manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
    print("SCHEME_BUILD_COMPLETE",json.dumps({"id":sid,"appearanceHash":manifest["appearanceHash"],"baseGeometryHash":before,"protectedObjects":count,"glbMB":round((out/"house.glb").stat().st_size/1e6,2)},ensure_ascii=False),flush=True)


def render_scheme(scheme,args):
    sid=scheme["id"];out=ROOT/"assets"/"schemes"/sid;out.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(MODELS/"schemes"/sid/"house.blend"))
    manifest_path=MODELS/"schemes"/sid/"scene-manifest.json"
    manifest=json.loads(manifest_path.read_text(encoding="utf-8"))
    scheme_blend_sha=sha_file(MODELS/"schemes"/sid/"house.blend")
    if manifest.get("schemeBlendSha256")!=scheme_blend_sha:raise RuntimeError(sid+": saved scheme blend changed; rebuild before rendering")
    if manifest["appearanceHash"]!=json_hash(resolved_appearance(scheme)):raise RuntimeError(sid+": appearance changed; rebuild before rendering")
    apply_scheme_copy(manifest,scheme)
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
    configure_render(args)
    names=VIEWS if args.render=="all" else tuple(args.render.split(","))
    for name in names:
        if name not in VIEWS:raise ValueError("Unknown view "+name)
        frame_spec={"width":args.resolution,"height":round(args.resolution*2/3),"samples":args.samples}
        prior=manifest.get("renderedViews",{}).get(name,{})
        image_path=out/(name+".jpg")
        scene=bpy.context.scene;scene.camera=bpy.data.objects[name]
        camera_state=render_camera_state(scene.camera);camera_hash=json_hash(camera_state)
        if args.resume and image_path.exists() and image_path.stat().st_size>1000 and prior.get("imageSha256")==sha_file(image_path) and prior.get("cameraHash")==camera_hash and prior.get("sourceSha256")==manifest["sourceSha256"] and prior.get("baseBlendSha256")==manifest["baseBlendSha256"] and prior.get("schemeBlendSha256")==scheme_blend_sha and prior.get("appearanceHash")==manifest["appearanceHash"] and prior.get("baseGeometryHash")==manifest["baseGeometryHash"] and prior.get("renderSpec")==frame_spec:
            print("SCHEME_RENDER_SKIP",sid,name,flush=True);continue
        for obj in scene.objects:
            if obj.get("kind")=="ceiling":obj.hide_render=name=="overall"
            elif obj.get("kind")=="wall":obj.hide_render=name=="overall" and obj.get("wallIndex") in (4,5,6)
            elif obj.get("kind") in ("window","door"):obj.hide_render=False
        scene.render.filepath=str(out/(name+".jpg"))
        started=time.perf_counter();print("SCHEME_RENDER_START",sid,name,flush=True)
        bpy.ops.render.render(write_still=True)
        elapsed=round(time.perf_counter()-started,2)
        manifest.setdefault("renderedViews",{})[name]={"appearanceHash":manifest["appearanceHash"],"baseGeometryHash":manifest["baseGeometryHash"],"sourceSha256":manifest["sourceSha256"],"baseBlendSha256":manifest["baseBlendSha256"],"schemeBlendSha256":scheme_blend_sha,"cameraState":camera_state,"cameraHash":camera_hash,"imageSha256":sha_file(image_path),"renderSpec":frame_spec,"seconds":elapsed}
        manifest["renderSpec"]=render_spec(args)
        manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
        print("SCHEME_RENDER_COMPLETE",sid,name,elapsed,flush=True)


def main():
    args=parse_args()
    source=json.loads(SCHEMES_FILE.read_text(encoding="utf-8"))
    schemes={item["id"]:item for item in source.get("archivedPalettes", [])}
    targets=args.schemes.split(",")
    for sid in targets:
        if sid not in PRESETS or sid not in schemes:raise ValueError("Only configured non-baseline schemes are build targets: "+sid)
    original_files=[BASE_BLEND,BASE_MANIFEST,MODELS/"huiyayuan-wood.glb",MODELS/"design-data.json"]
    originals={path:sha_file(path) for path in original_files}
    for sid in targets:
        if not args.render_only:build_scheme(schemes[sid],args)
        if not args.only_build:render_scheme(schemes[sid],args)
        if any(sha_file(path)!=digest for path,digest in originals.items()):raise RuntimeError("A protected baseline file changed during scheme generation")
    print("DESIGN_SCHEMES_COMPLETE",json.dumps({"schemes":targets,"baseFilesUnchanged":True}),flush=True)


if __name__=="__main__":main()
