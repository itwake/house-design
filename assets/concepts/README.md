# 同布局材质概念图

这九张图使用内置 ImageGen，以 `assets/renders/` 中对应的 Sweet Home 3D JS 模型截图为编辑底图生成。用途是比较现代自然风的材质、色温、灯光和空间气质；尺寸判断仍以 `.sh3d`、`assets/verified/` 平面校核图和现场复尺为准。

## 共用提示词

> 将给定 SweetHomeJS 截图转换为写实的广州高层住宅室内效果图。严格保留原相机、透视、裁切、墙体、门窗、湿区、主要家具/柜体/设备占位和紧凑尺度；只替换材质、灯光与软装细节。风格为克制的现代自然：暖白矿物墙、浅橡木、暖灰织物、少量鼠尾草绿、暖石材和少量哑黑金属；自然日光配合 3000K/3500K 分层照明，真实木纹、织物、石材和接触阴影。不得增删或移动墙、门窗、隔断、设备和大型家具，不得扩大空间，不得镜像户型，不得新增窗户、人物、文字、标志或水印。

## 每张图的附加约束

| 文件 | 对应模型底图 | 房间级约束 |
| --- | --- | --- |
| `living-dining-photoreal.png` | `living-tv.png` | 电视固定在双卫南侧实墙；不增加可见窗；走廊和沙发/茶几占位不变。 |
| `entry-dining-photoreal.png` | `dining.png` | 西窗、1200×700 餐桌、350 深柜体与连续通道不变。 |
| `master-bedroom-photoreal.png` | `master.png` | 1500 床、单床头柜和东侧 2400 衣柜不变，不增加第二床头柜。 |
| `bedroom-b-photoreal.png` | `bedroom-b.png` | 左侧到顶衣柜、独立书桌与右侧 1350 床保持独立且不改变占位。 |
| `study-guest-photoreal.png` | `study.png` | 左侧独立日床、右侧 1100 书桌、近镜头客衣柜，不做榻榻米或连体平台。 |
| `kitchen-photoreal.png` | `kitchen.png` | 双排柜、东侧电器高柜、水槽、洗碗机、灶具和原窗洞不变，不加岛台。 |
| `master-bath-photoreal.png` | `master-bath.png` | 保持高位广角和极紧凑尺度；中央马桶、右侧 800 柜、东端淋浴与门位不变。 |
| `guest-bath-photoreal.png` | `guest-bath.png` | 保持 1210 mm 进深的拥挤感；400 角盆、中央马桶、东侧淋浴/折叠屏不变。 |
| `utility-balcony-photoreal.png` | `balcony.png` | 东侧洗烘塔、南墙浅柜、晾衣架、黑框玻璃和狭长通道不变。 |

生成图可能在五金、柜缝、窗外景观和软装轮廓上出现小偏差。网页为每张概念图提供可展开的模型底图，应成对阅读。
