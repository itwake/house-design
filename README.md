# 荟雅苑 104.83㎡ · 在线户型比例模型

基于 Sweet Home 3D JS Viewer 的静态网页，包含：

- 可旋转、缩放和漫游的 `.sh3d` 三维模型；
- 与三维模型共用坐标的 2D 比例核对图；
- 图纸尺寸、比例校准值和待复尺假设的分级清单；
- 原始三房两卫图与目标房源自如改造现状图对照。

## 尺寸口径

Sweet Home 3D 内部使用厘米，本项目网页展示毫米。以下图纸锚点按 1:1 录入：

- 北侧总宽：6870 mm
- 西侧总长：14010 mm
- 南侧下部总宽：6410 mm
- 北侧两跨：3010 / 3500 mm
- 南侧两跨：3180 / 2870 mm

当前墙厚统一按 120 mm 闭合尺寸链，下部体块偏移按两张图比例校准。它们不是现场实测值。模型可用于空间与家具尺度验证，不能直接作为拆改、水电或施工放线图。

## 本地运行

静态资源需要通过 HTTP 访问（不能直接双击 `index.html`）：

```powershell
python -m http.server 8080
```

然后访问 `http://localhost:8080/`。

重新生成 `.sh3d` 和网页坐标数据：

```powershell
python tools/generate_model.py
```

生成文件：

- `models/huiyayuan-104-calibrated.sh3d`
- `models/Home.xml`（便于审计）
- `models/model-data.json`

## 第三方组件

网页查看器来自 Sweet Home 3D JS 7.5.2。详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
