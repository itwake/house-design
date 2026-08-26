#!/usr/bin/env python3
"""Generate dimension-driven SVG audit drawings from model-data.json.

These drawings intentionally replace photorealistic concept renders.  Every
fixture footprint comes from the same centimetre coordinates used by the 2D
web plan and Sweet Home 3D model.
"""

from __future__ import annotations

import json
from html import escape
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODEL_DATA = ROOT / "models" / "model-data.json"
OUTPUT_DIR = ROOT / "assets" / "verified"


SPACES = [
    {
        "file": "01-living-dining.svg",
        "title": "客厅 + 餐厅",
        "subtitle": "连续公共区 · 模型净面积约35.0㎡",
        "polygon": [(277,334),(410,334),(410,632),(675,632),(675,1115),(530,1115),(530,1389),(212,1389),(212,632),(277,632)],
        "items": ["三人沙发", "电视薄柜", "茶几", "四人餐桌", "餐椅北1", "餐椅北2", "餐椅南1", "餐椅南2", "玄关柜", "餐边柜"],
        "doors": [(390,1389,490,1389,"入户1000")],
        "clearZones": [(390,1289,490,1389,"入户门落脚区")],
        "status": "成立（餐桌已缩至1200×700）",
        "notes": ["沙发—电视净距约2590", "餐桌东侧保留约1200主通道", "入户门内侧不再放端头餐椅"],
    },
    {
        "file": "02-entry-dining.svg",
        "title": "玄关 + 餐厅局部",
        "subtitle": "3180宽下部公共区 · 局部进深4290",
        "polygon": [(212,960),(530,960),(530,1389),(212,1389)],
        "items": ["四人餐桌", "餐椅北1", "餐椅北2", "餐椅南1", "餐椅南2", "玄关柜", "餐边柜"],
        "doors": [(390,1389,490,1389,"入户1000")],
        "clearZones": [(390,1289,490,1389,"入户门落脚区")],
        "status": "条件成立（四椅放长边）",
        "notes": ["餐桌1200×700，四把椅子只放南北长边", "玄关柜深350，不占东侧主通道", "入户门位置与开启方向仍须复尺"],
    },
    {
        "file": "03-kitchen.svg",
        "title": "厨房",
        "subtitle": "净尺寸约2870×2620 · 7.5㎡模型值",
        "polygon": [(542,1127),(829,1127),(829,1389),(542,1389)],
        "items": ["厨房南侧地柜", "厨房北侧地柜", "冰箱高柜", "蒸烤高柜"],
        "doors": [(542,1175,542,1265,"移门900")],
        "clearZones": [(542,1188,632,1265,"厨房门内落脚区")],
        "status": "成立（双排柜净通道约1360）",
        "notes": ["两排台面均按600深校核", "冰箱与蒸烤高柜集中东墙", "烟道、燃气表和下水位置待复尺后再排序"],
    },
    {
        "file": "04-master-bedroom.svg",
        "title": "主卧 A",
        "subtitle": "净尺寸约3500×3100 · 10.9㎡模型值",
        "polygon": [(325,12),(675,12),(675,322),(325,322)],
        "items": ["主卧1500床", "主卧衣柜"],
        "doors": [(326,322,416,322,"门900")],
        "clearZones": [(326,232,416,322,"门后落脚区")],
        "status": "成立（门后留1020落脚区）",
        "notes": ["1500床，不采用1800床", "床—衣柜净距约1025", "床尾至南墙约1020，避开门洞落脚区"],
    },
    {
        "file": "05-second-bedroom.svg",
        "title": "次卧 B",
        "subtitle": "净尺寸约3010×3100 · 9.3㎡模型值",
        "polygon": [(12,12),(313,12),(313,322),(12,322)],
        "items": ["次卧1350床", "次卧书桌", "次卧书椅", "次卧衣柜"],
        "doors": [(228,322,313,322,"门850")],
        "clearZones": [(228,237,313,322,"门后落脚区")],
        "status": "成立（门洞已与分墙脱开）",
        "notes": ["1350床—衣柜主通道约990", "900书桌放北侧，避免占门后区", "门洞右边止于分墙内侧；门位仍为C级假设"],
    },
    {
        "file": "06-study-guest-room.svg",
        "title": "书房 / 客卧 C",
        "subtitle": "净尺寸约2530×2860 · 7.2㎡模型值",
        "polygon": [(12,334),(265,334),(265,620),(12,620)],
        "items": ["书房日床", "1100书桌", "书房办公椅", "书房客衣柜"],
        "doors": [(265,457.5,265,542.5,"门850")],
        "clearZones": [(180,457.5,265,542.5,"门后落脚区")],
        "status": "条件成立（书桌由1600改1100）",
        "notes": ["1000日床与书桌间净距约875", "书桌止于门洞上缘前，不再挡门", "客衣柜与门洞间仅约75，必须复尺"],
    },
    {
        "file": "07-master-bathroom.svg",
        "title": "主卫",
        "subtitle": "净尺寸约2530×1530 · 3.9㎡模型值",
        "polygon": [(422,334),(675,334),(675,487),(422,487)],
        "items": ["主卫800浴室柜", "主卫壁挂马桶", "主卫淋浴区"],
        "doors": [(422,372.5,422,447.5,"外开/移门750")],
        "clearZones": [(422,382,482,447.5,"入口净空")],
        "status": "条件成立（门必须外开或移门）",
        "notes": ["浴室柜由900缩至800，靠北墙", "壁挂马桶前方约880活动深度", "东端900×1410淋浴区，仅做600固定玻璃"],
    },
    {
        "file": "08-public-bathroom.svg",
        "title": "客卫",
        "subtitle": "净尺寸约2530×1210 · 3.1㎡模型值",
        "polygon": [(422,499),(675,499),(675,620),(422,620)],
        "items": ["客卫角盆", "客卫壁挂马桶", "客卫淋浴区"],
        "doors": [(422,517.5,422,592.5,"外开/移门750")],
        "clearZones": [(422,517.5,482,590,"入口净空")],
        "status": "勉强成立（取消650浴室柜）",
        "notes": ["只能用400×300角盆，不能放效果图中的650柜", "壁挂马桶靠北，东端880×1110淋浴", "玻璃必须可折叠并留约670入口；管位不符则方案作废"],
    },
    {
        "file": "09-utility-balcony.svg",
        "title": "家政阳台",
        "subtitle": "净尺寸约1420×1490 · 2.1㎡模型值",
        "polygon": [(687,966),(829,966),(829,1115),(687,1115)],
        "items": ["洗烘塔", "阳台家政柜"],
        "doors": [(687,966,687,1110,"推拉门约1500")],
        "clearZones": [(687,966,764,1080,"主通道")],
        "status": "成立（柜体已移出主通道）",
        "notes": ["洗烘塔650×700放东北角", "南墙仅放700×350浅柜", "西侧主通道最窄约775；窗扇和地漏待复尺"],
    },
]


COLORS = {
    "fabric": "#a8a39a",
    "wood": "#c8a77e",
    "cabinet": "#b9aa95",
    "metal": "#59615e",
    "sanitary": "#e7e5df",
    "wet": "#a9cbc8",
}


def polygon_area(points: list[tuple[float, float]]) -> float:
    return abs(sum(x1*y2 - x2*y1 for (x1,y1),(x2,y2) in zip(points, points[1:]+points[:1]))) / 2 / 10_000


def point_in_polygon(x: float, y: float, points: list[tuple[float, float]]) -> bool:
    inside = False
    for (x1,y1),(x2,y2) in zip(points, points[1:]+points[:1]):
        cross = (x-x1)*(y2-y1) - (y-y1)*(x2-x1)
        if abs(cross) < 1e-7 and min(x1,x2)-1e-7 <= x <= max(x1,x2)+1e-7 and min(y1,y2)-1e-7 <= y <= max(y1,y2)+1e-7:
            return True
        if (y1 > y) != (y2 > y):
            crossing_x = (x2-x1)*(y-y1)/(y2-y1) + x1
            if x < crossing_x:
                inside = not inside
    return inside


def audit_space(space: dict, furniture: dict[str, dict]) -> None:
    rects = []
    for name in space["items"]:
        item = furniture[name]
        x1, y1 = item["x"], item["y"]
        x2, y2 = x1 + item["w"], y1 + item["d"]
        corners = ((x1,y1),(x2,y1),(x2,y2),(x1,y2))
        if not all(point_in_polygon(x,y,space["polygon"]) for x,y in corners):
            raise ValueError(f"{space['title']}: {name} footprint is outside the audited polygon")
        rects.append((name,x1,y1,x2,y2))
    for index, (name_a,ax1,ay1,ax2,ay2) in enumerate(rects):
        for name_b,bx1,by1,bx2,by2 in rects[index+1:]:
            overlap_x = min(ax2,bx2)-max(ax1,bx1)
            overlap_y = min(ay2,by2)-max(ay1,by1)
            if overlap_x > 0.01 and overlap_y > 0.01:
                raise ValueError(f"{space['title']}: {name_a} overlaps {name_b} by {overlap_x:.1f}×{overlap_y:.1f} cm")
    for zone_x1,zone_y1,zone_x2,zone_y2,zone_name in space.get("clearZones", []):
        for name,x1,y1,x2,y2 in rects:
            overlap_x = min(x2,zone_x2)-max(x1,zone_x1)
            overlap_y = min(y2,zone_y2)-max(y1,zone_y1)
            if overlap_x > 0.01 and overlap_y > 0.01:
                raise ValueError(f"{space['title']}: {name} blocks {zone_name} by {overlap_x:.1f}×{overlap_y:.1f} cm")


def make_svg(space: dict, furniture: dict[str, dict]) -> str:
    points = space["polygon"]
    min_x, max_x = min(p[0] for p in points), max(p[0] for p in points)
    min_y, max_y = min(p[1] for p in points), max(p[1] for p in points)
    span_x, span_y = max_x-min_x, max_y-min_y
    scale = min(540/span_x, 430/span_y)
    ox = 55 + (540-span_x*scale)/2
    oy = 145 + (430-span_y*scale)/2

    def px(x: float) -> float: return ox + (x-min_x)*scale
    def py(y: float) -> float: return oy + (y-min_y)*scale

    plan_points = " ".join(f"{px(x):.1f},{py(y):.1f}" for x,y in points)
    item_svg = []
    for name in space["items"]:
        item = furniture[name]
        x, y, w, d = item["x"], item["y"], item["w"], item["d"]
        item_svg.append(
            f'<rect x="{px(x):.1f}" y="{py(y):.1f}" width="{w*scale:.1f}" height="{d*scale:.1f}" rx="6" '
            f'fill="{COLORS.get(item.get("tone"), "#c8a77e")}" stroke="#183b34" stroke-width="2"/>'
        )
        label = escape(name.replace("厨房", "").replace("主卫", "").replace("客卫", ""))
        item_svg.append(
            f'<text x="{px(x+w/2):.1f}" y="{py(y+d/2):.1f}" text-anchor="middle" dominant-baseline="middle" '
            f'class="fixture">{label}</text>'
        )

    door_svg = []
    for x1,y1,x2,y2,label in space["doors"]:
        door_svg.append(f'<line x1="{px(x1):.1f}" y1="{py(y1):.1f}" x2="{px(x2):.1f}" y2="{py(y2):.1f}" stroke="#f7f4ed" stroke-width="12"/>')
        door_svg.append(f'<line x1="{px(x1):.1f}" y1="{py(y1):.1f}" x2="{px(x2):.1f}" y2="{py(y2):.1f}" stroke="#c25d31" stroke-width="4" stroke-dasharray="10 6"/>')
        door_svg.append(f'<text x="{(px(x1)+px(x2))/2:.1f}" y="{(py(y1)+py(y2))/2-9:.1f}" text-anchor="middle" class="door-label">{escape(label)}</text>')

    clear_zone_svg = []
    for x1,y1,x2,y2,label in space.get("clearZones", []):
        clear_zone_svg.append(
            f'<rect x="{px(x1):.1f}" y="{py(y1):.1f}" width="{(x2-x1)*scale:.1f}" height="{(y2-y1)*scale:.1f}" '
            f'fill="#e5a46a" fill-opacity=".12" stroke="#c25d31" stroke-width="2" stroke-dasharray="8 6"/>'
        )
        clear_zone_svg.append(
            f'<text x="{px((x1+x2)/2):.1f}" y="{py((y1+y2)/2):.1f}" text-anchor="middle" dominant-baseline="middle" class="door-label">{escape(label)}</text>'
        )

    notes = "".join(
        f'<g transform="translate(665 {330+i*74})"><circle cx="10" cy="-5" r="5" fill="#087567"/><text x="28" y="0" class="note">{escape(note)}</text></g>'
        for i,note in enumerate(space["notes"])
    )
    area = polygon_area(points)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 650" role="img" aria-label="{escape(space['title'])}按比例空间校核图">
<style>
  .title{{font:800 31px system-ui,'Microsoft YaHei';fill:#16342e}} .sub{{font:500 16px system-ui,'Microsoft YaHei';fill:#65706b}}
  .dim{{font:700 15px system-ui,'Microsoft YaHei';fill:#087567}} .fixture{{font:700 11px system-ui,'Microsoft YaHei';fill:#183b34}}
  .door-label{{font:700 12px system-ui,'Microsoft YaHei';fill:#a44925}} .note{{font:600 15px system-ui,'Microsoft YaHei';fill:#31423d}}
  .status{{font:800 18px system-ui,'Microsoft YaHei';fill:#fff}} .meta{{font:600 14px system-ui,'Microsoft YaHei';fill:#6a746f}}
</style>
<rect width="1100" height="650" fill="#f5f1e8"/><text x="55" y="57" class="title">{escape(space['title'])}</text>
<text x="55" y="87" class="sub">{escape(space['subtitle'])}</text>
<rect x="35" y="108" width="580" height="500" rx="24" fill="#fffdfa" stroke="#ddd6c9"/>
<polygon points="{plan_points}" fill="#eee1cd" stroke="#193a33" stroke-width="9" stroke-linejoin="round"/>
{''.join(clear_zone_svg)}{''.join(item_svg)}{''.join(door_svg)}
<line x1="{px(min_x):.1f}" y1="{oy-24:.1f}" x2="{px(max_x):.1f}" y2="{oy-24:.1f}" stroke="#087567" stroke-width="2"/>
<text x="{(px(min_x)+px(max_x))/2:.1f}" y="{oy-34:.1f}" text-anchor="middle" class="dim">{span_x*10:.0f} mm</text>
<line x1="{ox-24:.1f}" y1="{py(min_y):.1f}" x2="{ox-24:.1f}" y2="{py(max_y):.1f}" stroke="#087567" stroke-width="2"/>
<text x="{ox-37:.1f}" y="{(py(min_y)+py(max_y))/2:.1f}" transform="rotate(-90 {ox-37:.1f} {(py(min_y)+py(max_y))/2:.1f})" text-anchor="middle" class="dim">{span_y*10:.0f} mm</text>
<text x="55" y="633" class="meta">模型净面积 {area:.1f}㎡ · 家具投影与Sweet Home 3D使用同一厘米坐标</text>
<rect x="650" y="115" width="410" height="94" rx="18" fill="#123c35"/><text x="675" y="151" class="status">平面校核结论</text>
<text x="675" y="184" class="status">{escape(space['status'])}</text>
<text x="665" y="258" class="title" style="font-size:23px">成立条件 / 风险</text>{notes}
<text x="665" y="585" class="meta">绿色家具＝按比例固定投影</text><text x="665" y="611" class="meta">橙色虚线＝门洞 / 必须保持的通行净空</text>
</svg>'''


def main() -> None:
    data = json.loads(MODEL_DATA.read_text(encoding="utf-8"))
    furniture = {item["name"]: item for item in data["furniture"]}
    missing = sorted({name for space in SPACES for name in space["items"] if name not in furniture})
    if missing:
        raise ValueError(f"Missing furniture in model-data.json: {missing}")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for space in SPACES:
        audit_space(space, furniture)
        (OUTPUT_DIR / space["file"]).write_text(make_svg(space, furniture), encoding="utf-8")
    print(f"Generated and audited {len(SPACES)} verified SVG plans in {OUTPUT_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
