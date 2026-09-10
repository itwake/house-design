# 木光之间 · 荟雅苑的家

104.83㎡ / 28F / 三房两卫。当前仅保留现代原木方案「木光原境」，网站打开即进入全屋查看。Blender 源模型、真实模型渲染和 Three.js 交互网站共用同一套几何数据。

**在线查看：[itwake.github.io/house-design](https://itwake.github.io/house-design/)**

![全屋Blender模型实际渲染](assets/blender-renders/overall.jpg)

## 这一版有什么

- V3.1.2 收起四套饰面选择入口及“换方案”弹窗，仅保留原木方案。最近确认的进门右鞋柜、左7字整墙餐边柜、三处功能飘窗及家具布局完整保留；模型、几何数据和15张效果图继续使用V3.1.1资产，没有回退或重渲。
- 根入口直接进入查看器；三个旧配色链接回到原木，保留当前房间与说明卡隐藏偏好。未知方案链接明确报错，不默默当作有效设计。
- 新方案必须有家具布局、动线或空间功能上的实质差异，不能只是换色。将来需要各自的几何数据、平面、3D及同源渲染，并逐一核对尺度与净空；本轮不新增布局。
- 温暖的浅橡木、暖白、亚麻与石材配色，细化家具、灯具、柜体和生活用品。
- 全屋立体浏览、逐房镜头、平面核对、墙体剖切、尺寸与房间标签。
- 说明卡可一键完全隐藏／恢复；本标签页记住选择，手机查看模型与平面时不再被卡片挡住。
- 全屋、客厅、餐厅、主卧、次卧B、书房兼客卧C、厨房、主卫、客卫、生活阳台共10个 Blender 渲染视角。
- 三处功能飘窗：主卧一体办公梳妆台及单椅、次卧无独立桌椅的单人茶座、客厅双人学习桌，另有3张细节渲染；网页可展开尺寸、代价、使用条件与原始案例链接。
- 玄关收纳专项：进门右侧650×340mm浅鞋柜，左侧西5290mm/南1625mm的7字餐柜；奶白门板、浅木连续中空、移门和干式备饮台。取消原固定换鞋凳；分方向立面和两张收纳近景同步更新。
- 可下载 `.blend` 源文件及带贴图的 `.glb` 模型。
- 低负载按需绘制；不支持 WebGL 时仍可看平面与效果图。

效果图由实际模型直接渲染，不使用生成式图片重新解释空间。模型适用于方案讨论，**不是施工图，也不是现场实测成果**。

平面与3D共用同一坐标，色块是简化的示意配色，不是逐块柜门的材料编号图；具体材质分配看对应3D与同源渲染。施工选材仍需厂家样板和深化材料表。

## 设计与几何修正

V3.1.1 的左右方向以业主图1红线为准，图2/3只借柜门、中空与连续转角做法，不照抄镜像朝向或照片尺度。右鞋柜改为650×340mm，左整墙替代旧西鞋柜、固定凳、独立窗边矮柜和落地绿植；餐桌及四椅不再移动。下转角400×400mm封闭不用，上柜按280mm深独立退进；仅北两模块有浅抽屉。门片可能遮挡鞋柜正面，需先收门取鞋，柜深/门把手/限位/窗套净距必须现场核验。详情见[右鞋柜与7字餐边整墙](docs/entry-storage-design-v311.md)。

历史V3.0.6曾采用西侧1750mm鞋柜、800mm换鞋凳与1400mm餐柜，并将餐桌和四椅东移400、北移400mm。该旧柜体布置已被V3.1.1替代，餐桌位置保留；旧说明仅用于追溯，见[历史玄关餐边方案](docs/entry-storage-design-v306.md)。

拆除出租隔出的第四间房，恢复客餐厅。客厅电视在双卫南侧实墙，保留西侧窗；主卧与次卧采用真实家具占地，书房兼第三卧室。两个小卫生间按紧凑洁具与固定淋浴玻璃组织，不虚构宽敞空间。

V3.0.3恢复两卫阶梯共墙与客卫西北盆位，主卫改为从主卧进入。主卧床头朝东、次卧B朝西，并同步移动衣柜及洁具；此前恢复的三处飘窗和书房南墙继续保留。阳台新门标为拟改造；原门改窗的具体边界待确认，不作为已核实原结构。

V3.0.5按用户反馈取消主卧独立桌，只保留**一体飘窗办公梳妆台和一把配椅**；次卧删除独立书桌、书椅，保留茶座。主卧台面跨飘窗及室内，腿位不借实台；为侧向入座，床向南移220mm、衣柜南移250mm，床头仍朝东。保留旧900mm未实测台高时，示意为931mm高台配640mm座高和足踏，并非普通750mm桌或已验证的全天办公位。详见[本次调整说明](docs/bay-window-design-v305.md)。

三处延续V3.0.4网络案例启发的暖灰细框、无绳卷帘与浅木功能件。客厅2000×650mm桌不变；次卧仍是**430mm实台＋50mm垫的条件茶座**：旧900mm从未实测，不能据此降台、拆台或认为可坐。所有窗台高度、结构、入座与防坠须现场核验。

28楼窗边桌椅/坐垫会增加攀爬风险。窗防护、限位、玻璃、可开启扇、结构承载及儿童身高适配必须先深化；渲染里的普通玻璃不代表防坠已通过。设计依据与落地条件见 [三飘窗设计说明](docs/bay-window-design-v304.md)。

详细证据、尺寸等级及尚未确定的事项见 [几何校核记录](docs/geometry-v3.md)。

本轮入口收敛与验证范围见 [V3.1.2说明](docs/single-layout-v312.md)。保留的几何、逐图复核和网页回归见 [V3.1.1检查记录](docs/qa-storage-v311.md)。之前记录保留于 [V3检查记录](docs/qa-v3.md) 与 [V3.1.0检查记录](docs/qa-design-schemes-v310.md)，其中“原案不变”等描述仅针对当时版本。

## 尺寸边界

已知图纸锚点：北侧总宽6870mm、全长14010mm、南侧下部总宽6410mm。数据内部单位为厘米；Blender使用米，坐标映射为 `(x/100, -y/100, z)`，glTF导出后为Y轴向上。

墙厚120mm、层高2700mm，以及部分门窗尺寸、窗台高度与凹口位置是待复尺的建模假设。模型室内区域合计约78.82㎡，不能作为产权套内面积或得房率结论。阳台外侧开口和厨房外窗证据不足，不作已核实结构展示；梁、柱、烟道、立管和承重属性仍需现场调查。

## 文件

| 文件 | 用途 |
|---|---|
| `models/design-data.json` | 新版墙线、房间、家具的共用坐标 |
| `models/blender-overrides.json` | 修正后的门窗开口定义 |
| `tools/build_blender.py` | 参数化建模、贴图、导出及渲染 |
| `models/huiyayuan-wood.blend` | Blender源模型，内嵌贴图与相机 |
| `models/huiyayuan-wood.glb` | 网页使用的3D模型 |
| `models/scene-manifest.json` | 房间、相机与效果图索引 |
| `models/design-schemes.json` | 唯一有效方案、未来布局准则；`archivedPalettes`保留已下线配色实验 |
| `models/schemes/{id}/` | 已下线三套配色的历史资产，不是可选布局 |
| `assets/blender-renders/` | 原木风格新版15张渲染：10个空间、3个飘窗及2个收纳近景 |
| `assets/schemes/{id}/` | 已下线配色的历史渲染，不在当前网页加载 |
| `tools/build_design_schemes.py` | 历史饰面实验生成器，必须显式`--archived`，不能生成新布局 |
| `models/design-data.json` 内 `bayFitouts` | 每件桌面、支架、椅、坐垫与茶托的共享三维包围盒 |
| `index.html` / `schemes.js` | 单方案入口、旧链接迁移与原木资源加载 |
| `studio.html` / `studio.js` / `studio.css` | 保留完整功能的原木 Three.js 查看器 |
| `legacy.html` | 已标记局限的旧版归档，不作新版几何依据 |

## 本地运行

```powershell
python -m http.server 8080
```

访问 `http://localhost:8080/`。不能直接双击HTML使用模型加载器。

## 重建与验证

使用 Blender 4.5 LTS（构建环境为4.5.9），将 `blender` 替换为实际程序路径：

```powershell
blender --background --threads 2 --python tools/build_blender.py -- --only-build
blender --background models/huiyayuan-wood.blend --threads 2 --python tools/build_blender.py -- --reuse --render all --samples 32 --resolution 1600
python tools/validate_studio.py --assets
node tools/test_plan_geometry.mjs
node --check studio.js
```

渲染默认使用 Cycles CPU 与去噪。可用 `--render overall,living` 仅渲染选定镜头。修改几何或相机后必须重新构建，不能仅 `--reuse`。

V3.1.1 四套图统一为960×640像素、Cycles 8采样加去噪，全部由新的收纳模型重渲，不能将旧版1200×800原木图混充本轮新图。四套同机位，入户/餐柜近景按新的柜体位置重新取景；照明仅供设计展示，不是实测采光模拟。上面的32采样/1600像素命令可用于更高质量导出。

当前方案验证：

```powershell
node tools/test_single_scheme.mjs
node tools/test_plan_geometry.mjs
python tools/validate_studio.py --assets
python tools/validate_design_schemes.py
```

`test_single_scheme.mjs`离线执行实际路由与查看器初始化代码，核对旧链接、错误状态、房间定位、下载路径和说明卡状态，并对比V3.1.1几何及资产。它不测试WebGL或浏览器视觉。发布后运行 `node tools/verify_published.mjs`，通过HTTP逐一对比25个有效Pages资源的SHA；不读取用户浏览器或其他标签页。

`test_plan_geometry.mjs`直接运行网页平面与立面绘制函数，核对床、阶梯双卫、门窗、飘窗、24个收纳部件和开放中空端板方向。说明卡的浏览器专项 `qa_card_visibility.mjs` 仍可在明确要求浏览器测试时使用；旧的 `qa_design_schemes.mjs` 已标为四配色历史测试，不适用于当前入口。

三套饰面实验及研究记录仅作为历史材料保留，见[历史风格研究](docs/style-research-v310.md)。如确需复现历史，可在 `build_design_schemes.py` 或 `scheme_manifest_copy.py` 显式传入 `--archived`；`validate_design_schemes.py --archived` 会连同历史模型、60张图及受保护几何一起核验。不得通过此饰面工具“生成”新布局。

`validate_bay_fitouts.py`由主校验器调用，检查15个飘窗部件的实际GLB包围盒、支架三角网格的膝脚净空与条件元数据。`node tools/qa_bay_ui.mjs 本机CDP端口 本地项目标签页ID --images`可重复运行三方案的桌面/手机专题、图片、参考链接及SVG导出检查（不实际访问参考链接或下载文件）。

## 历史版本与许可

旧版 Sweet Home 3D 文件和概念图保留供追溯；其中部分AI概念图曾误读空间与窗口，不能用于施工或新版几何核对。新版改为实际 Blender 渲染。

Three.js采用MIT许可；Blender用于离线制作，不打包进网站。更多信息见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
