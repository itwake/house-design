#!/usr/bin/env python3
"""Generate the calibrated Huiyayuan Sweet Home 3D model.

Sweet Home 3D / SweetHomeJS stores dimensions in centimetres.  The structural
anchors below come from the dimensioned target-unit plan supplied by the
owner.  Unknown wall build-ups and opening widths remain explicit assumptions
in MODEL_NOTES instead of being silently presented as surveyed facts.
"""

from __future__ import annotations

import json
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
    "model.status": "图纸比例校准版；不是现场竣工测量图",
    "model.units": "Sweet Home 3D 内部单位为厘米；网页尺寸标注为毫米",
    "source.top_width": "6870mm，目标房源现状尺寸图",
    "source.bottom_width": "6410mm，目标房源现状尺寸图",
    "source.overall_height": "14010mm，目标房源现状尺寸图左侧总尺寸",
    "source.clear_spans_top": "3010+120墙体+3500，并用两侧各120墙体闭合到6870",
    "source.clear_spans_bottom": "3180+120墙体+2870，并用两侧各120墙体闭合到6410",
    "assumption.wall_thickness": "统一120mm；承重墙/剪力墙厚度须现场复尺并查原始结构图",
    "assumption.openings": "门窗宽度、窗台高和梁位按户型图示意，须现场复尺",
    "assumption.lower_offset": "下部体块相对上部向东偏移2000mm，按两张户型图比例校准",
    "design.layout": "恢复原始三房两卫；家具仅作尺度测试，不是施工深化图",
}

MODEL_DATA = {
    "name": "荟雅苑 104.83㎡ · 28F",
    "version": "V0.2 图纸比例校准版",
    "unit": "cm",
    "north": "图上方（临道路侧）",
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
    "furniture": [
        {"name": "1500×2000床", "x": 75, "y": 60, "w": 150, "d": 200, "a": 0},
        {"name": "1600×2000床", "x": 440, "y": 60, "w": 160, "d": 200, "a": 0},
        {"name": "1200×1900床", "x": 45, "y": 380, "w": 120, "d": 190, "a": 0},
        {"name": "2200×900沙发", "x": 490, "y": 705, "w": 90, "d": 220, "a": 0},
        {"name": "1400×800餐桌", "x": 325, "y": 1175, "w": 80, "d": 140, "a": 0},
        {"name": "厨房地柜", "x": 542, "y": 1329, "w": 287, "d": 60, "a": 0},
        {"name": "洗烘塔", "x": 757.5, "y": 1020, "w": 65, "d": 70, "a": 0},
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
          elevation: float = 0, movable: bool = True) -> str:
    return (
        f"  <pieceOfFurniture {attrs(id=piece_id, level='level0', name=name, model='models/box.obj', x=x, y=y, elevation=elevation, angle=angle, width=width, depth=depth, height=height, color=color, movable=str(movable).lower(), resizable='true', deformable='true', texturable='false')}/>"
    )


def opening(opening_id: str, name: str, x: float, y: float, width: float,
            depth: float, height: float, color: str, *, angle: float = 0,
            elevation: float = 0) -> str:
    return (
        f"  <doorOrWindow {attrs(id=opening_id, level='level0', name=name, model='models/box.obj', x=x, y=y, elevation=elevation, angle=angle, width=width, depth=depth, height=height, color=color, movable='false', wallThickness='1', wallDistance='0', wallWidth='1', wallLeft='0', wallHeight='1', wallTop='0', boundToWall='true')}/>"
    )


def dimension(dim_id: str, x1: float, y1: float, x2: float, y2: float,
              offset: float, color: str = "FF136F63") -> str:
    return f"  <dimensionLine {attrs(id=dim_id, level='level0', xStart=x1, yStart=y1, xEnd=x2, yEnd=y2, offset=offset, endMarkSize=9, color=color)}/>"


def label(label_id: str, text: str, x: float, y: float,
          color: str = "FF1D2B27") -> str:
    return f"  <label {attrs(id=label_id, level='level0', x=x, y=y, color=color)}><text>{escape(text)}</text></label>"


def build_home_xml() -> str:
    lines: list[str] = [
        "<?xml version='1.0' encoding='UTF-8'?>",
        f"<home {attrs(version='7500', name='荟雅苑104.83㎡_三房两卫_图纸比例校准版.sh3d', camera='topCamera', wallHeight=WALL_HEIGHT, basePlanLocked='true')}>",
    ]
    for key, value in MODEL_NOTES.items():
        lines.append(f"  <property {attrs(name=key, value=value)}/>")

    lines.extend([
        "  <environment groundColor='FFB6B2A8' skyColor='FFBDD7EA' lightColor='FFD8D2C7' wallsAlpha='0.0' observerCameraElevationAdjusted='false'/>",
        "  <backgroundImage image='plan-original.webp' scaleDistance='687' scaleDistanceXStart='386' scaleDistanceYStart='39' scaleDistanceXEnd='768' scaleDistanceYEnd='39' xOrigin='694.1859' yOrigin='70.1390' visible='true'/>",
        "  <compass x='760' y='70' diameter='70' northDirection='0' longitude='1.9775' latitude='0.4037' timeZone='Asia/Shanghai' visible='true'/>",
        "  <camera attribute='topCamera' lens='PINHOLE' x='420' y='720' z='2200' yaw='0' pitch='1.24' fieldOfView='1.0471976' time='1787731200000'/>",
        "  <observerCamera attribute='observerCamera' lens='PINHOLE' x='365' y='1280' z='160' yaw='3.1415927' pitch='0.08' fieldOfView='1.0471976' time='1787731200000'/>",
        "  <observerCamera attribute='storedCamera' name='客餐厅视角' lens='PINHOLE' x='365' y='1250' z='155' yaw='3.1415927' pitch='0.05' fieldOfView='1.0471976' time='1787731200000'/>",
        "  <observerCamera attribute='storedCamera' name='主卧视角' lens='PINHOLE' x='500' y='265' z='150' yaw='3.45' pitch='0.03' fieldOfView='1.0471976' time='1787731200000'/>",
        f"  <level {attrs(id='level0', name='28F 三房两卫', elevation=0, floorThickness=12, height=WALL_HEIGHT, elevationIndex=0, visible='true', viewable='true')}/>",
    ])

    # Scale-test furniture. Every piece is a resizable box with real dimensions.
    pieces = [
        piece("bed_a", "主卧床 1600×2000", 520, 160, 160, 200, 45, "FFCFB7A2"),
        piece("wardrobe_a", "主卧衣柜 2400×600", 445, 42, 240, 60, 240, "FFB99A7A"),
        piece("bed_b", "次卧床 1500×2000", 150, 160, 150, 200, 45, "FFD8C3AD"),
        piece("wardrobe_b", "次卧衣柜 1800×600", 160, 292, 180, 55, 240, "FFB99A7A"),
        piece("bed_c", "小卧床 1200×1900", 105, 475, 120, 190, 42, "FFE2CAB6"),
        piece("desk_c", "书桌 1200×600", 215, 410, 120, 60, 75, "FFB28B67", angle=1.5707963),
        piece("sofa", "三人沙发 2200×900", 535, 815, 220, 90, 82, "FF7A9A8C", angle=1.5707963),
        piece("tv", "电视柜 2000×400", 260, 780, 200, 40, 48, "FF8A735E", angle=1.5707963),
        piece("coffee", "茶几 1200×600", 430, 800, 120, 60, 42, "FFD4B78E", angle=1.5707963),
        piece("dining", "餐桌 1400×800", 365, 1245, 140, 80, 75, "FFB68E64", angle=1.5707963),
        piece("cabinet_s", "厨房地柜 2870×600", 685.5, 1359, 287, 60, 86, "FFC9C2B8"),
        piece("cabinet_e", "厨房高柜/操作台", 799, 1220, 60, 170, 210, "FFB7B0A6"),
        piece("balcony_unit", "阳台洗烘塔预留 650×700", 790, 1055, 65, 70, 190, "FFB9C6CE"),
        piece("bath_vanity_1", "主卫浴室柜", 625, 365, 90, 50, 85, "FFB8C9C5"),
        piece("bath_wc_1", "主卫马桶尺度块", 455, 425, 40, 70, 78, "FFE9E7DF"),
        piece("bath_vanity_2", "客卫浴室柜", 625, 525, 90, 50, 85, "FFB8C9C5"),
        piece("bath_wc_2", "客卫马桶尺度块", 455, 570, 40, 70, 78, "FFE9E7DF"),
    ]

    openings = [
        opening("window_b", "次卧北窗（待复尺）", 155, 6, 130, 12, 140, "FF8EC7D8", elevation=90),
        opening("window_a", "主卧北窗（待复尺）", 505, 6, 150, 12, 140, "FF8EC7D8", elevation=90),
        opening("window_c", "小卧西窗（待复尺）", 6, 470, 110, 12, 140, "FF8EC7D8", angle=1.5707963, elevation=90),
        opening("balcony_door", "客厅阳台门（待复尺）", 681, 1035, 150, 12, 220, "FF7FB5C5", angle=1.5707963),
        opening("entry_door", "入户门（待复尺）", 440, 1395, 100, 12, 220, "FF805F49"),
        opening("door_a", "主卧门（待复尺）", 360, 328, 90, 12, 215, "FFD1C6B7"),
        opening("door_b", "次卧门（待复尺）", 280, 328, 85, 12, 215, "FFD1C6B7"),
        opening("door_c", "小卧门（待复尺）", 271, 500, 85, 12, 215, "FFD1C6B7", angle=1.5707963),
        opening("door_bath_1", "主卫门（待复尺）", 416, 410, 75, 12, 210, "FFD1C6B7", angle=1.5707963),
        opening("door_bath_2", "客卫门（待复尺）", 416, 555, 75, 12, 210, "FFD1C6B7", angle=1.5707963),
        opening("door_kitchen", "厨房门（待复尺）", 536, 1220, 90, 12, 215, "FFD1C6B7", angle=1.5707963),
    ]
    lines.extend(pieces)
    lines.extend(openings)

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
        wall("w_bath_west", 416, 328, 416, 626),
        wall("w_bath_middle", 416, 493, 681, 493),
        wall("w_bath_south", 416, 626, 681, 626),
        # Balcony and kitchen.
        wall("w_balcony_west", 681, 960, 681, 1121),
        wall("w_balcony_south", 681, 1121, 835, 1121),
        wall("w_kitchen_north", 536, 1121, 681, 1121),
        wall("w_kitchen_west", 536, 1121, 536, 1395),
    ]
    lines.extend(walls)

    rooms = [
        room("room_a", "主卧 A · 北向", [(325, 12), (675, 12), (675, 322), (325, 322)], "FFE8D7C2"),
        room("room_b", "次卧 B · 北向", [(12, 12), (313, 12), (313, 322), (12, 322)], "FFEBDDCB"),
        room("room_c", "小卧 C", [(12, 334), (265, 334), (265, 620), (12, 620)], "FFE4D5C3"),
        room("bath_1", "主卫", [(422, 334), (675, 334), (675, 487), (422, 487)], "FFD6E2DF"),
        room("bath_2", "客卫", [(422, 499), (675, 499), (675, 620), (422, 620)], "FFD4E0DD"),
        room("living", "客餐厅 / 过道", [(277, 334), (410, 334), (410, 632), (675, 632), (675, 1115), (530, 1115), (530, 1389), (212, 1389), (212, 632), (277, 632)], "FFF1E4CE"),
        room("balcony", "阳台", [(687, 966), (829, 966), (829, 1115), (687, 1115)], "FFDCE4DF"),
        room("kitchen", "厨房", [(542, 1127), (829, 1127), (829, 1389), (542, 1389)], "FFE1E3DE"),
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
        label("note_accuracy", "绿色尺寸=图纸锚点；门窗/墙厚待现场复尺", 315, 1460, "FFB45D2A"),
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
        archive.write(plan, "plan-original.webp")

    print(f"Generated {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
