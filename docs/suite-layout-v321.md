# V3.2.1 / R4B：扩大书房、主卧平开门、书房推拉门

业主选择将2026-09-22交付的R4B平面制作成3D并上线。替换第二个suite方案；原wood方案的源数据、模型、图片保持不变。R4A仅作本地面积对照，不新增第三个网站方案。

## 同源几何

- 恢复两卧折线隔墙；次卧门退到走廊尽头左转进入。主卧衣柜随西侧折墙定位，次卧衣柜留南墙，主卧没有桌椅。
- 主卧门为850mm暂定洞口，南铰向套内开，先进入730×1530mm小玄关，再进床区或主卫。
- 书房相对R4A向东扩大200mm，净宽2720mm，模型净面积7.7792㎡；采用1000mm洞口、1080mm单扇墙外挂推拉门，沿书房室内东墙向北停靠。
- 走廊及两卫西墙同步东移，公共走廊仍约780mm；主卫3.1212㎡、客卫3.4969㎡。主卧含入口12.5155㎡，次卧7.9670㎡。全部是模型值，不是产权/实测面积。
- 主卫盆柜由620改600mm并向东移200mm，马桶占位向东移60mm；此处排水、实际洁具与检修条件未核实。

## 门与漫游

四扇平开门在3D及渲染中采用90°开启展示，门扇不会进入漫游就消失；开启的门扇实体同样纳入碰撞。书房推拉门俯瞰状态关闭，进入漫游沿北侧滑开1100mm，门板及嵌入拉手保持显示；退出后恢复。厨房仍为原1700mm三扇三轨门。

2D显示平开门开启弧、书房推拉门关闭位及虚线停靠位，与GLB和碰撞系统使用同一数据。暂定门框每端60mm：洞口宽不等于净开；门套、止摆、轨道、门吸及隔声需厂家深化。

主卫门全开时位于洗手盆前，洗手须先关主卫门。网页漫游用固定敞开状态展示通行，不模拟实际开关铰链门、洗漱操作或证明舒适性。主卧玄关730mm、走廊780mm、次卧床尾局部390mm仍偏紧。

## 构建和校核

`tools/create_suite_layout.mjs`先从未改动的wood基准生成基础设计，再调用`tools/suite_r4b.mjs`应用本次确认的墙线、家具、门型和说明；`tools/build_suite_layout.py`生成独立Blender/GLB及16张同源效果图。

运行：

```text
node tools/create_suite_layout.mjs
blender --background --threads 4 --python tools/build_suite_layout.py -- --render all --engine CYCLES --resolution 960 --samples 8
node tools/test_suite_layout.mjs
node tools/test_suite_plan.mjs --render
node tools/test_walkthrough.mjs --suite
python tools/validate_suite_model.py
python tools/validate_design_schemes.py
```

模型几何逐项对照本地R4B交付平面；实际GLB网格校核墙体、门板开合位、保留的外窗/飘窗/柜体及门洞来源。直径500/600mm静态圆包络可进入八个房间，关闭主卧入口则隔离主卧与主卫。该结果不代替动态开门、双人错身、搬家具或施工/消防/无障碍核验。

拆改、湿区、防坠及结构可行性仍须现场量房并由专业人员确认，不能按本模型直接施工。
