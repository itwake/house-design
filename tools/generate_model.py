#!/usr/bin/env python3
"""Generate the calibrated Huiyayuan Sweet Home 3D model.

Sweet Home 3D / SweetHomeJS stores dimensions in centimetres.  The structural
anchors below come from the dimensioned target-unit plan supplied by the
owner.  Unknown wall build-ups and opening widths remain explicit assumptions
in MODEL_NOTES instead of being silently presented as surveyed facts.
"""

from __future__ import annotations

import json
import math
import struct
import zlib
from pathlib import Path
from xml.sax.saxutils import escape, quoteattr
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "models"
OUTPUT = MODEL_DIR / "huiyayuan-104-calibrated.sh3d"
HOME_XML_OUTPUT = MODEL_DIR / "Home.xml"
MODEL_DATA_OUTPUT = MODEL_DIR / "model-data.json"

WALL_HEIGHT = 270.0
WALL_THICKNESS = 12.0

MODEL_NOTES = {
    "model.status": "V2.0逐空间比例校核；九个空间按净框、门洞和通道重排，不是现场竣工测量图",
    "model.units": "Sweet Home 3D 内部单位为厘米；网页尺寸标注为毫米",
    "source.top_width": "6870mm，目标房源现状尺寸图",
    "source.bottom_width": "6410mm，目标房源现状尺寸图",
    "source.overall_height": "14010mm，目标房源现状尺寸图左侧总尺寸",
    "source.clear_spans_top": "3010+120墙体+3500，并用两侧各120墙体闭合到6870",
    "source.clear_spans_bottom": "3180+120墙体+2870，并用两侧各120墙体闭合到6410",
    "assumption.wall_thickness": "统一120mm；承重墙/剪力墙厚度须现场复尺并查原始结构图",
    "assumption.openings": "门窗宽度、窗台高和梁位按户型图示意，须现场复尺",
    "assumption.lower_offset": "下部体块相对上部向东偏移2000mm，按两张户型图比例校准",
    "design.layout": "现代自然：暖白+浅橡木+暖灰；恢复三房两卫与连续客餐厅",
    "design.lighting": "公共区3000K，厨卫任务光3500K，Ra≥90；灯位为概念布置",
    "design.scope": "已加入定制柜体、软装、厨卫设备、家政与照明；仍需复尺深化",
}

MODEL_DATA = {
    "name": "荟雅苑 104.83㎡ · 28F",
    "version": "V2.0 逐空间比例校核版",
    "unit": "cm",
    "north": "图上方（临道路侧）",
    "palette": [
        {"name": "暖白墙面", "value": "#F2EEE5"},
        {"name": "浅橡木", "value": "#C8A77E"},
        {"name": "暖灰织物", "value": "#A9A39A"},
        {"name": "鼠尾草绿", "value": "#7C9485"},
        {"name": "哑黑金属", "value": "#303533"},
    ],
    "envelope": [[0, 0], [687, 0], [687, 954], [841, 954], [841, 1401], [200, 1401], [200, 632], [0, 632]],
    "anchors": [
        {"id": "top", "label": "北侧总宽", "valueMm": 6870, "grade": "A", "source": "目标房源现状尺寸图"},
        {"id": "height", "label": "西侧总长", "valueMm": 14010, "grade": "A", "source": "目标房源现状尺寸图"},
        {"id": "bottom", "label": "南侧下部总宽", "valueMm": 6410, "grade": "A", "source": "目标房源现状尺寸图"},
        {"id": "topRooms", "label": "北侧卧室净跨", "valueMm": "3010 / 3500", "grade": "A", "source": "目标房源现状尺寸图"},
        {"id": "bottomRooms", "label": "下部两跨", "valueMm": "3180 / 2870", "grade": "A", "source": "目标房源现状尺寸图"},
        {"id": "wall", "label": "统一墙厚", "valueMm": 120, "grade": "C", "source": "为闭合尺寸链所作建模假设，必须现场核对"},
        {"id": "offset", "label": "下部向东偏移", "valueMm": 2000, "grade": "B", "source": "按两张户型图轮廓比例校准"},
    ],
    "rooms": [
        {"id": "room_b", "name": "次卧 B", "tone": "bedroom", "points": [[12, 12], [313, 12], [313, 322], [12, 322]]},
        {"id": "room_a", "name": "主卧 A", "tone": "bedroom", "points": [[325, 12], [675, 12], [675, 322], [325, 322]]},
        {"id": "room_c", "name": "小卧 C", "tone": "bedroom", "points": [[12, 334], [265, 334], [265, 620], [12, 620]]},
        {"id": "bath_1", "name": "主卫", "tone": "wet", "points": [[422, 334], [675, 334], [675, 487], [422, 487]]},
        {"id": "bath_2", "name": "客卫", "tone": "wet", "points": [[422, 499], [675, 499], [675, 620], [422, 620]]},
        {"id": "living", "name": "客餐厅 / 过道", "tone": "living", "points": [[277, 334], [410, 334], [410, 632], [675, 632], [675, 1115], [530, 1115], [530, 1389], [212, 1389], [212, 632], [277, 632]]},
        {"id": "balcony", "name": "阳台", "tone": "balcony", "points": [[687, 966], [829, 966], [829, 1115], [687, 1115]]},
        {"id": "kitchen", "name": "厨房", "tone": "kitchen", "points": [[542, 1127], [829, 1127], [829, 1389], [542, 1389]]},
    ],
    "walls": [
        [6, 6, 681, 6], [6, 6, 6, 626], [6, 626, 206, 626], [206, 626, 206, 1395],
        [206, 1395, 835, 1395], [835, 960, 835, 1395], [681, 960, 835, 960], [681, 6, 681, 960],
        [319, 6, 319, 328], [6, 328, 319, 328], [319, 328, 681, 328], [271, 328, 271, 626],
        [416, 328, 416, 626], [416, 493, 681, 493], [416, 626, 681, 626],
        [681, 960, 681, 1121], [681, 1121, 835, 1121], [536, 1121, 681, 1121], [536, 1121, 536, 1395],
    ],
    "doors": [
        {"name": "次卧门", "x1": 228, "y1": 328, "x2": 313, "y2": 328, "widthMm": 850, "grade": "C"},
        {"name": "主卧门", "x1": 326, "y1": 328, "x2": 416, "y2": 328, "widthMm": 900, "grade": "C"},
        {"name": "书房门", "x1": 271, "y1": 457.5, "x2": 271, "y2": 542.5, "widthMm": 850, "grade": "C"},
        {"name": "主卫门（外开/移门条件）", "x1": 416, "y1": 372.5, "x2": 416, "y2": 447.5, "widthMm": 750, "grade": "C"},
        {"name": "客卫门（外开/移门条件）", "x1": 416, "y1": 517.5, "x2": 416, "y2": 592.5, "widthMm": 750, "grade": "C"},
        {"name": "厨房移门", "x1": 536, "y1": 1175, "x2": 536, "y2": 1265, "widthMm": 900, "grade": "C"},
        {"name": "入户门", "x1": 390, "y1": 1395, "x2": 490, "y2": 1395, "widthMm": 1000, "grade": "C"},
    ],
    "furniture": [
        {"name": "次卧1350床", "x": 24, "y": 20, "w": 135, "d": 200, "a": 0, "tone": "fabric"},
        {"name": "次卧书桌", "x": 165, "y": 20, "w": 90, "d": 52, "a": 0, "tone": "wood"},
        {"name": "次卧书椅", "x": 188, "y": 82, "w": 44, "d": 46, "a": 0, "tone": "fabric"},
        {"name": "次卧衣柜", "x": 258, "y": 25, "w": 55, "d": 175, "a": 0, "tone": "wood"},
        {"name": "主卧1500床", "x": 365, "y": 20, "w": 150, "d": 200, "a": 0, "tone": "fabric"},
        {"name": "主卧衣柜", "x": 617.5, "y": 45, "w": 55, "d": 240, "a": 0, "tone": "wood"},
        {"name": "书房日床", "x": 20, "y": 350, "w": 100, "d": 200, "a": 0, "tone": "fabric"},
        {"name": "1100书桌", "x": 207.5, "y": 335, "w": 55, "d": 110, "a": 0, "tone": "wood"},
        {"name": "书房办公椅", "x": 136, "y": 391, "w": 58, "d": 58, "a": 0, "tone": "fabric"},
        {"name": "书房客衣柜", "x": 167.5, "y": 550, "w": 85, "d": 50, "a": 0, "tone": "wood"},
        {"name": "三人沙发", "x": 511, "y": 710, "w": 88, "d": 220, "a": 0, "tone": "fabric"},
        {"name": "电视薄柜", "x": 218, "y": 710, "w": 34, "d": 220, "a": 0, "tone": "wood"},
        {"name": "茶几", "x": 389, "y": 760, "w": 62, "d": 120, "a": 0, "tone": "wood"},
        {"name": "四人餐桌", "x": 290, "y": 1150, "w": 120, "d": 70, "a": 0, "tone": "wood"},
        {"name": "餐椅北1", "x": 298, "y": 1092.5, "w": 44, "d": 45, "a": 0, "tone": "fabric"},
        {"name": "餐椅北2", "x": 358, "y": 1092.5, "w": 44, "d": 45, "a": 0, "tone": "fabric"},
        {"name": "餐椅南1", "x": 298, "y": 1232.5, "w": 44, "d": 45, "a": 0, "tone": "fabric"},
        {"name": "餐椅南2", "x": 358, "y": 1232.5, "w": 44, "d": 45, "a": 0, "tone": "fabric"},
        {"name": "玄关柜", "x": 212.5, "y": 1130, "w": 35, "d": 180, "a": 0, "tone": "wood"},
        {"name": "餐边柜", "x": 212.5, "y": 960, "w": 35, "d": 140, "a": 0, "tone": "wood"},
        {"name": "厨房南侧地柜", "x": 542, "y": 1329, "w": 287, "d": 60, "a": 0, "tone": "cabinet"},
        {"name": "厨房北侧地柜", "x": 590, "y": 1127, "w": 239, "d": 60, "a": 0, "tone": "cabinet"},
        {"name": "冰箱高柜", "x": 765, "y": 1188, "w": 60, "d": 70, "a": 0, "tone": "metal"},
        {"name": "蒸烤高柜", "x": 765, "y": 1259, "w": 60, "d": 70, "a": 0, "tone": "cabinet"},
        {"name": "洗烘塔", "x": 764, "y": 966, "w": 65, "d": 70, "a": 0, "tone": "metal"},
        {"name": "阳台家政柜", "x": 687, "y": 1080, "w": 70, "d": 35, "a": 0, "tone": "cabinet"},
        {"name": "主卫800浴室柜", "x": 432, "y": 337, "w": 80, "d": 45, "a": 0, "tone": "sanitary"},
        {"name": "主卫壁挂马桶", "x": 525, "y": 337, "w": 38, "d": 62, "a": 0, "tone": "sanitary"},
        {"name": "主卫淋浴区", "x": 581, "y": 340, "w": 90, "d": 141, "a": 0, "tone": "wet"},
        {"name": "客卫角盆", "x": 422, "y": 590, "w": 40, "d": 30, "a": 0, "tone": "sanitary"},
        {"name": "客卫壁挂马桶", "x": 497, "y": 502, "w": 36, "d": 58, "a": 0, "tone": "sanitary"},
        {"name": "客卫淋浴区", "x": 582, "y": 504, "w": 88, "d": 111, "a": 0, "tone": "wet"},
    ],
}


def attrs(**values: object) -> str:
    return " ".join(
        f"{key.rstrip('_')}={quoteattr(str(value))}"
        for key, value in values.items()
        if value is not None
    )


def wall(wall_id: str, x1: float, y1: float, x2: float, y2: float,
         thickness: float = WALL_THICKNESS, height: float = WALL_HEIGHT,
         color: str = "FFE7E1D7") -> str:
    return (
        f"  <wall {attrs(id=wall_id, level='level0', xStart=x1, yStart=y1, xEnd=x2, yEnd=y2, height=height, thickness=thickness, leftSideColor=color, rightSideColor=color, topColor='FFD6CEC2')}/>"
    )


def room(room_id: str, name: str, points: list[tuple[float, float]],
         floor_color: str) -> str:
    body = "".join(f"<point {attrs(x=x, y=y)}/>" for x, y in points)
    return (
        f"  <room {attrs(id=room_id, level='level0', name=name, areaVisible='true', floorColor=floor_color, floorShininess='0.08', ceilingVisible='true', ceilingColor='FFFFFFFF')}>"
        f"{body}</room>"
    )


def piece(piece_id: str, name: str, x: float, y: float, width: float,
          depth: float, height: float, color: str, *, angle: float = 0,
          elevation: float = 0, movable: bool = True,
          model: str = "models/box.obj") -> str:
    return (
        f"  <pieceOfFurniture {attrs(id=piece_id, level='level0', name=name, model=model, x=x, y=y, elevation=elevation, angle=angle, width=width, depth=depth, height=height, color=color, movable=str(movable).lower(), resizable='true', deformable='true', texturable='false')}/>"
    )


def local_piece(piece_id: str, name: str, x: float, y: float,
                dx: float, dy: float, width: float, depth: float,
                height: float, color: str, *, angle: float = 0,
                elevation: float = 0, model: str = "models/box.obj") -> str:
    """Place a component using offsets in the parent's rotated coordinate system."""
    px = x + dx * math.cos(angle) - dy * math.sin(angle)
    py = y + dx * math.sin(angle) + dy * math.cos(angle)
    return piece(piece_id, name, px, py, width, depth, height, color,
                 angle=angle, elevation=elevation, model=model)


def bed_components(prefix: str, name: str, x: float, y: float,
                   width: float, depth: float, *, head_side: int = 1,
                   angle: float = 0) -> list[str]:
    wood = "FFC39F75"
    linen = "FFE7E0D5"
    sage = "FF869889"
    return [
        local_piece(f"{prefix}_base", name, x, y, 0, 0, width, depth, 22, wood, angle=angle),
        local_piece(f"{prefix}_mattress", f"{name}床垫", x, y, 0, 0, width - 8, depth - 8, 23, linen, angle=angle, elevation=22),
        local_piece(f"{prefix}_head", f"{name}软包床头", x, y, 0, head_side * (depth / 2 - 5), width + 8, 10, 92, "FFC9B8A8", angle=angle, elevation=18),
        local_piece(f"{prefix}_pillow_l", f"{name}枕头", x, y, -width * .23, head_side * (depth / 2 - 32), width * .38, 32, 10, "FFF4F0E8", angle=angle, elevation=45),
        local_piece(f"{prefix}_pillow_r", f"{name}枕头", x, y, width * .23, head_side * (depth / 2 - 32), width * .38, 32, 10, "FFF4F0E8", angle=angle, elevation=45),
        local_piece(f"{prefix}_throw", f"{name}床尾毯", x, y, 0, -head_side * 45, width - 12, 55, 5, sage, angle=angle, elevation=45),
    ]


def wardrobe_components(prefix: str, name: str, x: float, y: float,
                        width: float, depth: float, *, angle: float = 0) -> list[str]:
    items = [piece(f"{prefix}_body", name, x, y, width, depth, 242, "FFC5A47E", angle=angle)]
    for index in range(4):
        dx = -width / 2 + width * (index + .5) / 4
        items.append(local_piece(f"{prefix}_door_{index}", f"{name}门板", x, y, dx, depth / 2 + .8, width / 4 - 1.2, 1.6, 225, "FFD1B491", angle=angle, elevation=8))
    return items


def sofa_components(prefix: str, x: float, y: float, *, angle: float = 0) -> list[str]:
    fabric = "FFA8A39A"
    sage = "FF788F82"
    return [
        piece(f"{prefix}_base", "客厅三人沙发", x, y, 220, 88, 28, fabric, angle=angle, elevation=12),
        local_piece(f"{prefix}_seat_l", "沙发坐垫", x, y, -52, 2, 100, 70, 18, "FFC2BDB4", angle=angle, elevation=38),
        local_piece(f"{prefix}_seat_r", "沙发坐垫", x, y, 52, 2, 100, 70, 18, "FFC2BDB4", angle=angle, elevation=38),
        local_piece(f"{prefix}_back_l", "沙发靠背", x, y, -52, 34, 100, 16, 58, fabric, angle=angle, elevation=48),
        local_piece(f"{prefix}_back_r", "沙发靠背", x, y, 52, 34, 100, 16, 58, fabric, angle=angle, elevation=48),
        local_piece(f"{prefix}_arm_l", "沙发扶手", x, y, -106, 0, 12, 86, 58, fabric, angle=angle, elevation=18),
        local_piece(f"{prefix}_arm_r", "沙发扶手", x, y, 106, 0, 12, 86, 58, fabric, angle=angle, elevation=18),
        local_piece(f"{prefix}_cushion", "鼠尾草绿抱枕", x, y, 70, -5, 42, 18, 42, sage, angle=angle, elevation=56),
    ]


def table_components(prefix: str, name: str, x: float, y: float,
                     width: float, depth: float, height: float,
                     *, angle: float = 0, color: str = "FFC29B70") -> list[str]:
    items = [piece(f"{prefix}_top", name, x, y, width, depth, 5, color, angle=angle, elevation=height - 5)]
    for index, (dx, dy) in enumerate(((-width / 2 + 8, -depth / 2 + 8), (width / 2 - 8, -depth / 2 + 8), (-width / 2 + 8, depth / 2 - 8), (width / 2 - 8, depth / 2 - 8))):
        items.append(local_piece(f"{prefix}_leg_{index}", f"{name}桌腿", x, y, dx, dy, 5, 5, height - 5, "FF95704F", angle=angle))
    return items


def chair_components(prefix: str, x: float, y: float, *, angle: float = 0) -> list[str]:
    return [
        piece(f"{prefix}_seat", "餐椅", x, y, 44, 45, 6, "FFD5CCC0", angle=angle, elevation=44),
        local_piece(f"{prefix}_back", "餐椅靠背", x, y, 0, 19, 44, 7, 43, "FFD5CCC0", angle=angle, elevation=47),
        *[local_piece(f"{prefix}_leg_{i}", "餐椅腿", x, y, dx, dy, 4, 4, 44, "FF80664D", angle=angle)
          for i, (dx, dy) in enumerate(((-16, -15), (16, -15), (-16, 15), (16, 15)))],
    ]


def light(light_id: str, name: str, x: float, y: float, power: float = .35,
          color: str = "FFFFE6C2", width: float = 16, depth: float = 16) -> str:
    return (
        f"  <light {attrs(id=light_id, level='level0', name=name, model='models/cylinder.obj', x=x, y=y, elevation=252, width=width, depth=depth, height=4, color='FFFFF3DC', movable='true', power=power)}>"
        f"<lightSource x='0.5' y='0.5' z='0.5' color='{color[2:]}' diameter='5'/></light>"
    )


def opening(opening_id: str, name: str, x: float, y: float, width: float,
            depth: float, height: float, color: str | None, *, angle: float = 0,
            elevation: float = 0, model: str = "models/box.obj") -> str:
    return (
        f"  <doorOrWindow {attrs(id=opening_id, level='level0', name=name, model=model, x=x, y=y, elevation=elevation, angle=angle, width=width, depth=depth, height=height, color=color, movable='false', wallThickness='1', wallDistance='0', wallWidth='1', wallLeft='0', wallHeight='1', wallTop='0', boundToWall='true')}/>"
    )


def interior_door(opening_id: str, name: str, x: float, y: float,
                  width: float, *, angle: float = 0, height: float = 215) -> str:
    """A closed, framed door with a wood-grain leaf and metal handle."""
    return opening(
        opening_id, name, x, y, width, 12, height, None,
        angle=angle, model="models/door.obj",
    )


def dimension(dim_id: str, x1: float, y1: float, x2: float, y2: float,
              offset: float, color: str = "FF136F63") -> str:
    return f"  <dimensionLine {attrs(id=dim_id, level='level0', xStart=x1, yStart=y1, xEnd=x2, yEnd=y2, offset=offset, endMarkSize=9, color=color)}/>"


def label(label_id: str, text: str, x: float, y: float,
          color: str = "FF1D2B27") -> str:
    return f"  <label {attrs(id=label_id, level='level0', x=x, y=y, color=color)}><text>{escape(text)}</text></label>"


def design_pieces() -> list[str]:
    """Return the V2 dimension-audited modern-natural design."""
    items: list[str] = []

    # Bedroom B: a neutral, future-proof room for child, elder or guests.
    items += bed_components("bed_b", "次卧1350床", 91.5, 120, 135, 200, head_side=-1)
    items += wardrobe_components("wardrobe_b", "次卧到顶衣柜", 285.5, 112.5, 175, 55, angle=math.pi / 2)
    items += table_components("desk_b", "次卧书桌", 210, 46, 90, 52, 75)
    items.append(piece("desk_b_upper", "次卧书桌上柜", 210, 23, 90, 28, 65, "FFC8AB86", elevation=145))
    items.append(piece("chair_b", "次卧书椅", 210, 105, 44, 46, 82, "FF8B9B8F"))

    # Master bedroom: 1500 bed keeps a usable aisle beside the 2400 wardrobe.
    items += bed_components("bed_a", "主卧1500床", 440, 120, 150, 200, head_side=-1)
    items += wardrobe_components("wardrobe_a", "主卧2400到顶衣柜", 645, 165, 240, 55, angle=math.pi / 2)
    items += table_components("bedside_a", "主卧床头柜", 540, 182, 38, 36, 48)
    items.append(piece("master_curtain", "主卧隔声窗帘示意", 505, 16, 160, 5, 245, "FFD8D0C3", elevation=8))

    # Bedroom C: office first, occasional guest room second.
    items += bed_components("daybed_c", "书房抽屉日床", 70, 450, 100, 200, head_side=-1)
    items += table_components("desk_c", "书房1100书桌", 235, 390, 110, 55, 75, angle=math.pi / 2)
    items.append(piece("desk_c_upper", "书房封闭上柜", 252, 390, 30, 100, 65, "FFC7AA85", angle=math.pi / 2, elevation=145))
    items += wardrobe_components("wardrobe_c", "书房客衣柜", 210, 575, 85, 50)
    items.append(piece("chair_c", "人体工学椅尺度", 165, 420, 58, 58, 105, "FF55655F"))

    # Living room: thin TV storage, low sofa and clear daylight axis.
    items += sofa_components("sofa", 555, 820, angle=math.pi / 2)
    items += table_components("coffee", "客厅茶几", 420, 820, 120, 62, 42, angle=math.pi / 2, color="FFC9A77C")
    items.append(piece("living_rug", "客厅暖灰地毯", 435, 820, 185, 270, 1.5, "FFBBB5AA", angle=math.pi / 2, elevation=.2))
    items.append(piece("tv_low", "电视悬浮薄柜", 235, 820, 220, 34, 42, "FFBF9A70", angle=math.pi / 2, elevation=18))
    items.append(piece("tv_panel", "浅橡木电视背板", 218, 820, 220, 4, 205, "FFC8A57C", angle=math.pi / 2, elevation=20))
    items.append(piece("tv_screen", "65英寸电视尺度", 224, 820, 145, 5, 83, "FF252A29", angle=math.pi / 2, elevation=85))
    items.append(piece("living_side", "客厅矮边柜", 630, 700, 80, 35, 62, "FFC4A078", angle=math.pi / 2))

    # Entry, dining and water bar storage stay on solid walls.
    items += wardrobe_components("entry", "350深玄关柜", 230, 1220, 180, 35, angle=math.pi / 2)
    items.append(piece("entry_open", "玄关开放台", 248, 1220, 72, 3, 45, "FFEEE7DB", angle=math.pi / 2, elevation=90))
    items.append(piece("sideboard", "餐边柜/水吧", 230, 1030, 140, 35, 92, "FFC5A37C", angle=math.pi / 2))
    items.append(piece("sideboard_top", "餐边柜石英石台面", 230, 1030, 140, 38, 4, "FFE7E1D8", angle=math.pi / 2, elevation=92))
    items += table_components("dining", "四人餐桌", 350, 1185, 120, 70, 75)
    for index, (x, y, angle) in enumerate(((320, 1115, 0), (380, 1115, 0), (320, 1255, math.pi), (380, 1255, math.pi))):
        items += chair_components(f"dining_chair_{index}", x, y, angle=angle)

    # Kitchen: two working runs, appliance tower and full-height storage.
    items.append(piece("kitchen_base_s", "厨房南侧地柜", 685.5, 1359, 287, 60, 86, "FFC5A57F"))
    items.append(piece("kitchen_top_s", "厨房南侧台面", 685.5, 1359, 287, 63, 4, "FFE8E3DA", elevation=86))
    items.append(piece("kitchen_base_n", "厨房北侧地柜", 709.5, 1157, 239, 60, 86, "FFC5A57F"))
    items.append(piece("kitchen_top_n", "厨房北侧台面", 709.5, 1157, 239, 63, 4, "FFE8E3DA", elevation=86))
    items.append(piece("kitchen_wall_s", "厨房到顶吊柜", 685.5, 1380, 210, 34, 82, "FFD6C2A6", elevation=158))
    items.append(piece("fridge", "冰箱预留 600×700", 795, 1223, 60, 70, 190, "FF434746"))
    items.append(piece("oven_tower", "蒸烤高柜", 795, 1294, 60, 70, 230, "FFBFA17E"))
    items.append(piece("oven", "蒸烤箱", 764, 1294, 3, 50, 55, "FF252928", elevation=92))
    items.append(piece("dishwasher", "洗碗机600", 640, 1162, 60, 58, 82, "FF555B59"))
    items.append(piece("sink", "水槽", 720, 1168, 66, 42, 8, "FF777D7B", elevation=90))
    items.append(piece("hob", "双眼灶", 670, 1335, 74, 42, 5, "FF242827", elevation=90))
    items.append(piece("hood", "侧吸烟机", 670, 1380, 78, 30, 48, "FF303432", elevation=145))

    # Utility balcony: stacked laundry, slim cleaning cabinet and drying rail.
    items.append(piece("utility_cabinet", "南墙700宽耐潮家政柜", 722, 1097.5, 70, 35, 230, "FFC3AE92"))
    items.append(piece("washer", "洗衣机", 796.5, 1001, 65, 70, 88, "FFE6E7E4"))
    items.append(piece("washer_face", "洗衣机门", 764, 1001, 3, 38, 38, "FF4C5655", elevation=24, model="models/cylinder.obj"))
    items.append(piece("dryer", "烘干机", 796.5, 1001, 65, 70, 88, "FFE6E7E4", elevation=91))
    items.append(piece("dryer_face", "烘干机门", 764, 1001, 3, 38, 38, "FF4C5655", elevation=115, model="models/cylinder.obj"))
    items.append(piece("drying_rail", "电动晾衣架尺度", 758, 1050, 105, 5, 5, "FFB6B9B5", elevation=230))

    # Bathrooms: drawers, mirrored cabinets, WC and full shower zones.
    items.append(piece("bath1_vanity", "主卫800悬空浴室柜", 472, 359.5, 80, 45, 52, "FFC1A17D", elevation=28))
    items.append(piece("bath1_basin", "主卫台盆", 472, 359.5, 68, 39, 12, "FFF0EEE8", elevation=80))
    items.append(piece("bath1_mirror", "主卫镜柜", 472, 338, 80, 4, 75, "FFAAB3B0", elevation=105))
    items.append(piece("bath1_wc", "主卫壁挂坐便", 544, 368, 38, 62, 42, "FFECEBE6"))
    items.append(piece("bath1_wc_bowl", "主卫坐便上部", 544, 374, 40, 48, 20, "FFF4F3EF", elevation=42, model="models/cylinder.obj"))
    items.append(piece("bath1_shower", "主卫900×1410淋浴区", 626, 410.5, 90, 141, 4, "FFBFCAC7"))
    items.append(piece("bath1_glass", "主卫600固定玻璃", 581, 370, 2, 60, 195, "FF8DBDCA", elevation=4))

    items.append(piece("bath2_vanity", "客卫400角盆", 442, 605, 40, 30, 38, "FFC1A17D", elevation=42))
    items.append(piece("bath2_basin", "客卫小台盆", 442, 605, 34, 26, 10, "FFF0EEE8", elevation=80))
    items.append(piece("bath2_mirror", "客卫窄镜柜", 424, 580, 4, 38, 58, "FFAAB3B0", elevation=103))
    items.append(piece("bath2_wc", "客卫壁挂坐便", 515, 531, 36, 58, 40, "FFECEBE6"))
    items.append(piece("bath2_wc_bowl", "客卫坐便上部", 515, 537, 38, 46, 18, "FFF4F3EF", elevation=40, model="models/cylinder.obj"))
    items.append(piece("bath2_shower", "客卫880×1110淋浴区", 626, 559.5, 88, 111, 4, "FFBFCAC7"))
    items.append(piece("bath2_glass", "客卫可折叠玻璃屏", 582, 526, 2, 54, 195, "FF8DBDCA", elevation=4))

    return items


def design_lights() -> list[str]:
    lights = [
        light("light_b", "次卧吸顶灯 3000K", 155, 165, .28),
        light("light_a", "主卧吸顶灯 3000K", 500, 165, .28),
        light("light_c", "书房吸顶灯 3500K", 135, 475, .3, color="FFFFEED5"),
        light("light_bath1", "主卫防潮灯 3500K", 550, 410, .32, color="FFFFF0DC"),
        light("light_bath2", "客卫防潮灯 3500K", 550, 555, .32, color="FFFFF0DC"),
        light("light_living_1", "客厅基础光", 365, 740, .3),
        light("light_living_2", "客厅基础光", 565, 740, .3),
        light("light_living_3", "客厅基础光", 365, 930, .3),
        light("light_living_4", "客厅基础光", 565, 930, .3),
        light("light_dining", "餐桌吊灯 3000K", 375, 1240, .42, width=32, depth=32),
        light("light_entry", "玄关灯", 300, 1340, .28),
        light("light_kitchen_1", "厨房任务光 3500K", 650, 1210, .36, color="FFFFF0DC"),
        light("light_kitchen_2", "厨房任务光 3500K", 720, 1320, .36, color="FFFFF0DC"),
        light("light_balcony", "阳台灯", 760, 1040, .25),
    ]
    return lights


def build_home_xml() -> str:
    lines: list[str] = [
        "<?xml version='1.0' encoding='UTF-8'?>",
        f"<home {attrs(version='7500', name='荟雅苑104.83㎡_三房两卫_逐空间比例校核V2.sh3d', camera='topCamera', wallHeight=WALL_HEIGHT, basePlanLocked='true')}>",
    ]
    for key, value in MODEL_NOTES.items():
        lines.append(f"  <property {attrs(name=key, value=value)}/>")

    lines.extend([
        "  <environment groundColor='FFB6B2A8' skyColor='FFBDD7EA' lightColor='FFD8D2C7' ceillingLightColor='FFD8D0C5' wallsAlpha='0.0' observerCameraElevationAdjusted='false'/>",
        "  <backgroundImage image='plan-original.webp' scaleDistance='687' scaleDistanceXStart='386' scaleDistanceYStart='39' scaleDistanceXEnd='768' scaleDistanceYEnd='39' xOrigin='694.1859' yOrigin='70.1390' visible='true'/>",
        "  <compass x='760' y='70' diameter='70' northDirection='0' longitude='1.9775' latitude='0.4037' timeZone='Asia/Shanghai' visible='true'/>",
        "  <camera attribute='topCamera' lens='PINHOLE' x='420' y='720' z='2200' yaw='0' pitch='1.24' fieldOfView='1.0471976' time='1787731200000'/>",
        "  <observerCamera attribute='observerCamera' lens='PINHOLE' x='365' y='1280' z='160' yaw='3.1415927' pitch='0.08' fieldOfView='1.0471976' time='1787731200000'/>",
        "  <observerCamera attribute='storedCamera' name='客餐厅视角' lens='PINHOLE' x='365' y='1250' z='155' yaw='3.1415927' pitch='0.05' fieldOfView='1.0471976' time='1787731200000'/>",
        "  <observerCamera attribute='storedCamera' name='主卧视角' lens='PINHOLE' x='500' y='265' z='150' yaw='3.45' pitch='0.03' fieldOfView='1.0471976' time='1787731200000'/>",
        "  <observerCamera attribute='storedCamera' name='次卧视角' lens='PINHOLE' x='220' y='280' z='150' yaw='3.85' pitch='0.04' fieldOfView='1.0471976' time='1787731200000'/>",
        "  <observerCamera attribute='storedCamera' name='书房客卧视角' lens='PINHOLE' x='220' y='580' z='150' yaw='3.85' pitch='0.04' fieldOfView='1.0471976' time='1787731200000'/>",
        "  <observerCamera attribute='storedCamera' name='厨房视角' lens='PINHOLE' x='600' y='1250' z='155' yaw='1.5707963' pitch='0.04' fieldOfView='1.0471976' time='1787731200000'/>",
        "  <observerCamera attribute='storedCamera' name='双卫视角' lens='PINHOLE' x='520' y='610' z='150' yaw='3.1415927' pitch='0.05' fieldOfView='1.0471976' time='1787731200000'/>",
        "  <observerCamera attribute='storedCamera' name='家政阳台视角' lens='PINHOLE' x='720' y='1090' z='150' yaw='4.712389' pitch='0.04' fieldOfView='1.0471976' time='1787731200000'/>",
        f"  <level {attrs(id='level0', name='28F 三房两卫', elevation=0, floorThickness=12, height=WALL_HEIGHT, elevationIndex=0, visible='true', viewable='true')}/>",
    ])

    pieces = design_pieces()
    lights = design_lights()

    openings = [
        opening("window_b", "次卧北窗（待复尺）", 155, 6, 130, 12, 140, "FF8EC7D8", elevation=90),
        opening("window_a", "主卧北窗（待复尺）", 505, 6, 150, 12, 140, "FF8EC7D8", elevation=90),
        opening("window_c", "小卧西窗（待复尺）", 6, 470, 110, 12, 140, "FF8EC7D8", angle=1.5707963, elevation=90),
        opening("balcony_door", "客厅阳台门（待复尺）", 681, 1035, 150, 12, 220, "FF7FB5C5", angle=1.5707963),
        opening("entry_door", "入户门（待复尺）", 440, 1395, 100, 12, 220, "FF805F49"),
        interior_door("door_a", "主卧门（待复尺）", 371, 328, 90),
        interior_door("door_b", "次卧门（待复尺）", 270.5, 328, 85),
        interior_door("door_c", "小卧门（待复尺）", 271, 500, 85, angle=1.5707963),
        interior_door("door_bath_1", "主卫门（待复尺）", 416, 410, 75, angle=1.5707963, height=210),
        interior_door("door_bath_2", "客卫门（待复尺）", 416, 555, 75, angle=1.5707963, height=210),
        interior_door("door_kitchen", "厨房门（待复尺）", 536, 1220, 90, angle=1.5707963),
    ]
    lines.extend(pieces)
    lines.extend(openings)
    lines.extend(lights)

    walls = [
        # External envelope. Outer dimensions close exactly to 6870 × 14010 mm,
        # with the lower block 6410 mm wide and shifted east by 2000 mm.
        wall("w_north", 6, 6, 681, 6),
        wall("w_west_upper", 6, 6, 6, 626),
        wall("w_upper_step", 6, 626, 206, 626),
        wall("w_west_lower", 206, 626, 206, 1395),
        wall("w_south", 206, 1395, 835, 1395),
        wall("w_east_lower", 835, 960, 835, 1395),
        wall("w_east_step", 681, 960, 835, 960),
        wall("w_east_upper", 681, 6, 681, 960),
        # Bedrooms and wet core.
        wall("w_bed_partition", 319, 6, 319, 328),
        wall("w_bed_b_south", 6, 328, 319, 328),
        wall("w_bed_a_south", 319, 328, 681, 328),
        wall("w_bed_c_east", 271, 328, 271, 626),
        wall("w_bath_west", 416, 328, 416, 626, color="FFE1DED7"),
        wall("w_bath_middle", 416, 493, 681, 493, color="FFE1DED7"),
        wall("w_bath_south", 416, 626, 681, 626, color="FFE1DED7"),
        # Balcony and kitchen.
        wall("w_balcony_west", 681, 960, 681, 1121, color="FFE3E1DA"),
        wall("w_balcony_south", 681, 1121, 835, 1121, color="FFE3E1DA"),
        wall("w_kitchen_north", 536, 1121, 681, 1121, color="FFE3DFD7"),
        wall("w_kitchen_west", 536, 1121, 536, 1395, color="FFE3DFD7"),
    ]
    lines.extend(walls)

    rooms = [
        room("room_a", "主卧 A · 1500床", [(325, 12), (675, 12), (675, 322), (325, 322)], "FFD7BB95"),
        room("room_b", "次卧 B · 可成长", [(12, 12), (313, 12), (313, 322), (12, 322)], "FFD9BD98"),
        room("room_c", "书房 / 偶住客卧", [(12, 334), (265, 334), (265, 620), (12, 620)], "FFD6B990"),
        room("bath_1", "主卫 · 完整淋浴", [(422, 334), (675, 334), (675, 487), (422, 487)], "FFC9CDC8"),
        room("bath_2", "客卫 · 紧凑好用", [(422, 499), (675, 499), (675, 620), (422, 620)], "FFC8CCC7"),
        room("living", "连续客餐厅 / 玄关", [(277, 334), (410, 334), (410, 632), (675, 632), (675, 1115), (530, 1115), (530, 1389), (212, 1389), (212, 632), (277, 632)], "FFD8BC93"),
        room("balcony", "洗烘家政阳台", [(687, 966), (829, 966), (829, 1115), (687, 1115)], "FFC5CCC6"),
        room("kitchen", "可闭合玻璃厨房", [(542, 1127), (829, 1127), (829, 1389), (542, 1389)], "FFC8C6BF"),
    ]
    lines.extend(rooms)

    dims = [
        dimension("dim_top_total", 0, 0, 687, 0, -58),
        dimension("dim_top_left", 12, 12, 313, 12, -28),
        dimension("dim_top_right", 325, 12, 675, 12, -28),
        dimension("dim_height", 0, 0, 0, 1401, 78),
        dimension("dim_bottom_total", 200, 1401, 841, 1401, 58),
        dimension("dim_bottom_left", 212, 1389, 530, 1389, 28),
        dimension("dim_bottom_right", 542, 1389, 829, 1389, 28),
        dimension("dim_bed_depth", 12, 12, 12, 322, -28),
        dimension("dim_balcony_depth", 829, 954, 829, 1115, 26),
        dimension("dim_kitchen_depth", 829, 1127, 829, 1389, 26),
    ]
    lines.extend(dims)
    lines.extend([
        label("note_north", "北 / 临道路侧", 345, -82, "FF0B6A5D"),
        label("note_accuracy", "V2逐空间校核：家具/洁具/门洞已复核；绿色尺寸=图纸锚点", 315, 1460, "FFB45D2A"),
    ])
    lines.append("</home>")
    return "\n".join(lines) + "\n"


BOX_OBJ = """# Unit cube centered on X/Z, standing on Y=0
o UnitBox
v -0.5 0 -0.5
v 0.5 0 -0.5
v 0.5 1 -0.5
v -0.5 1 -0.5
v -0.5 0 0.5
v 0.5 0 0.5
v 0.5 1 0.5
v -0.5 1 0.5
f 1 2 3 4
f 5 8 7 6
f 1 5 6 2
f 2 6 7 3
f 3 7 8 4
f 5 1 4 8
"""


DOOR_MTL = """# Materials for the framed interior door
newmtl oak_leaf
Ka 0.45 0.36 0.27
Kd 0.95 0.91 0.84
Ks 0.08 0.08 0.07
Ns 18
map_Kd wood-door.png

newmtl warm_white_frame
Ka 0.72 0.70 0.65
Kd 0.92 0.90 0.85
Ks 0.05 0.05 0.05
Ns 10

newmtl graphite_handle
Ka 0.08 0.09 0.09
Kd 0.17 0.18 0.17
Ks 0.45 0.45 0.42
Ns 80
"""


def build_door_obj() -> str:
    """Build a unit framed door; X=width, Y=height and Z=depth."""
    lines = [
        "# Textured framed interior door",
        "mtllib door.mtl",
        "o InteriorDoor",
        "vt 0 0", "vt 1 0", "vt 1 1", "vt 0 1",
    ]
    vertex_count = 0

    def add_box(name: str, bounds: tuple[float, float, float, float, float, float],
                material: str) -> None:
        nonlocal vertex_count
        x1, y1, z1, x2, y2, z2 = bounds
        vertices = [
            (x1, y1, z1), (x2, y1, z1), (x2, y2, z1), (x1, y2, z1),
            (x1, y1, z2), (x2, y1, z2), (x2, y2, z2), (x1, y2, z2),
        ]
        lines.extend([f"g {name}", f"usemtl {material}"])
        lines.extend(f"v {x} {y} {z}" for x, y, z in vertices)
        base = vertex_count + 1
        for a, b, c, d in ((0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1),
                           (1, 5, 6, 2), (2, 6, 7, 3), (4, 0, 3, 7)):
            lines.append(f"f {base+a}/1 {base+b}/2 {base+c}/3 {base+d}/4")
        vertex_count += 8

    add_box("oak_door_leaf", (-.44, .035, -.12, .44, .94, .12), "oak_leaf")
    add_box("left_frame", (-.50, 0, -.18, -.44, 1, .18), "warm_white_frame")
    add_box("right_frame", (.44, 0, -.18, .50, 1, .18), "warm_white_frame")
    add_box("top_frame", (-.44, .94, -.18, .44, 1, .18), "warm_white_frame")
    add_box("lever_handle", (.25, .44, -.50, .39, .49, -.18), "graphite_handle")
    add_box("handle_plate", (.29, .39, -.22, .35, .54, -.12), "graphite_handle")
    return "\n".join(lines) + "\n"


def build_wood_texture_png(width: int = 96, height: int = 96) -> bytes:
    """Return a small deterministic oak-grain PNG for the interior door leaf."""
    rows = bytearray()
    for y in range(height):
        rows.append(0)
        for x in range(width):
            broad = ((x // 7) % 4) * 3
            fine = ((x * 17 + y * 3 + (y // 11) * 5) % 13) - 6
            knot = -14 if (x - 58) ** 2 + ((y - 35) * 2) ** 2 < 95 else 0
            rows.extend((
                max(0, min(255, 201 + broad + fine + knot)),
                max(0, min(255, 169 + broad + fine // 2 + knot)),
                max(0, min(255, 127 + broad + fine // 3 + knot)),
                255,
            ))

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    signature = b"\x89PNG\r\n\x1a\n"
    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return signature + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(bytes(rows), 9)) + chunk(b"IEND", b"")


def build_cylinder_obj(segments: int = 24) -> str:
    lines = ["# Unit cylinder centered on X/Z, standing on Y=0", "o UnitCylinder"]
    for y in (0, 1):
        for index in range(segments):
            angle = 2 * math.pi * index / segments
            lines.append(f"v {0.5 * math.cos(angle):.6f} {y} {0.5 * math.sin(angle):.6f}")
    lines.extend(["v 0 0 0", "v 0 1 0"])
    bottom_center = segments * 2 + 1
    top_center = segments * 2 + 2
    for index in range(segments):
        nxt = (index + 1) % segments
        b1, b2 = index + 1, nxt + 1
        t1, t2 = index + segments + 1, nxt + segments + 1
        lines.append(f"f {b1} {b2} {t2} {t1}")
        lines.append(f"f {bottom_center} {b2} {b1}")
        lines.append(f"f {top_center} {t1} {t2}")
    return "\n".join(lines) + "\n"


def main() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    xml = build_home_xml()
    HOME_XML_OUTPUT.write_text(xml, encoding="utf-8")
    MODEL_DATA_OUTPUT.write_text(
        json.dumps(MODEL_DATA, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    plan = ROOT / "assets" / "original-plan.webp"
    if not plan.exists():
        raise FileNotFoundError(plan)

    with ZipFile(OUTPUT, "w", ZIP_DEFLATED) as archive:
        archive.writestr("Home.xml", xml)
        archive.writestr("models/box.obj", BOX_OBJ)
        archive.writestr("models/cylinder.obj", build_cylinder_obj())
        archive.writestr("models/door.obj", build_door_obj())
        archive.writestr("models/door.mtl", DOOR_MTL)
        archive.writestr("models/wood-door.png", build_wood_texture_png())
        archive.write(plan, "plan-original.webp")

    print(f"Generated {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size:,} bytes)")
    from generate_verified_plans import main as generate_verified_plans
    generate_verified_plans()


if __name__ == "__main__":
    main()
