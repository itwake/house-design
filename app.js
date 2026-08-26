/* global viewHome, HomeRecorder, ModelLoader */

const state = {
  model: null,
  homeComponent: null,
};

const SVG_NS = "http://www.w3.org/2000/svg";

const DESIGN_ROOMS = [
  {
    index: "01", title: "客厅 + 餐厅", eyebrow: "模型净面积约35.0㎡ · 已做投影碰撞检查",
    image: "assets/verified/01-living-dining.svg",
    summary: "保留连续公共区，但把餐桌缩至1200×700，取消端头餐椅，避免侵进入户门落脚区；客厅家具按同一厘米坐标核对。",
    specs: ["2200沙发", "1200×700餐桌", "东侧主通道≈1200", "平面校核：成立"],
    details: [
      ["校核结论", "沙发—电视净距约2590mm；餐桌东侧保留约1200mm主通道。四把餐椅只能布置在长边。"],
      ["照明与电气", "基础、电视/阅读、餐桌吊灯和柜下灯至少4组回路；窗帘电机双侧预留。"],
      ["临路策略", "北向外窗先做夜间噪声实测，再决定夹胶中空窗、密封和新风；不要只靠厚窗帘。"],
    ],
  },
  {
    index: "02", title: "玄关 + 餐厅", eyebrow: "3180mm宽局部 · 已检查入户门落脚区",
    image: "assets/verified/02-entry-dining.svg",
    summary: "350mm深玄关柜和餐边柜保留；餐桌改为1200×700，四椅只放南北长边，东侧作为去厨房和卧室的主要通道。",
    specs: ["玄关柜深350", "餐桌1200×700", "餐边柜深350", "平面校核：条件成立"],
    details: [
      ["校核结论", "1400×800餐桌加端头椅会挤进入户区，已经删除；新桌型的东侧无端头椅，保持连续通行。"],
      ["餐边水吧", "台上五孔×4，净饮、咖啡机按设备分路；高温蒸汽与吊柜保持安全距离。"],
      ["待复尺", "入户门确切中心、门扇开启方向和墙垛宽度决定南侧餐椅能否长期摆放。"],
    ],
  },
  {
    index: "03", title: "厨房", eyebrow: "模型净尺寸约2870×2620 · 7.5㎡",
    image: "assets/verified/03-kitchen.svg",
    summary: "黑框玻璃门打开时连接餐厅、关闭时控制油烟；两侧连续台面整合冰箱、蒸烤、洗碗机、水槽和灶具。",
    specs: ["双排柜净通道≈1360", "地柜深600", "门洞约900待复尺", "平面校核：成立"],
    details: [
      ["校核结论", "两排600mm地柜后净通道约1360mm；冰箱和蒸烤高柜集中东墙，不占900mm移门。"],
      ["柜体", "吊柜做到顶并留烟机检修口；先锁冰箱、洗碗机、蒸烤箱和烟机型号再下单。"],
      ["燃气与安全", "玻璃门、燃气表、报警器、通风和烟道必须经物业及燃气专业确认。"],
    ],
  },
  {
    index: "04", title: "主卧 A", eyebrow: "模型净尺寸约3500×3100 · 10.9㎡",
    image: "assets/verified/04-master-bedroom.svg",
    summary: "采用1500床而非强塞1800床，把空间优先给2400到顶衣柜、可用过道和临路侧隔声睡眠。",
    specs: ["床1500×2000", "衣柜2400×550", "床柜净距≈1025", "平面校核：成立"],
    details: [
      ["校核结论", "床已移到北侧，床尾至南墙约1020mm，门后落脚区不再与床角重叠。"],
      ["床侧", "单侧通道不低于550mm；床头照明与双控、USB/Type-C插座一次定位。"],
      ["安静", "空调、新风口避开床头直吹；窗密封、玻璃组合与新风噪声作为采购指标。"],
    ],
  },
  {
    index: "05", title: "次卧 B", eyebrow: "模型净尺寸约3010×3100 · 9.3㎡",
    image: "assets/verified/05-second-bedroom.svg",
    summary: "中性硬装、1350独立床、标准衣柜和独立书桌。未来在儿童房、长辈房或客房之间转换时无需拆固定柜。",
    specs: ["床1350×2000", "衣柜1750×550", "床柜通道≈990", "平面校核：成立"],
    details: [
      ["校核结论", "床、书桌和衣柜均在3010×3100净框内；850门洞止于分墙内侧，门后区域无固定家具。"],
      ["学习", "书桌侧面自然光，桌面照度目标500lx，插座与网口不被柜体遮挡。"],
      ["安全", "柜体防倾倒、家具圆角；儿童使用时补充窗锁和防坠措施。"],
    ],
  },
  {
    index: "06", title: "书房 / 客卧 C", eyebrow: "模型净尺寸约2530×2860 · 7.2㎡",
    image: "assets/verified/06-study-guest-room.svg",
    summary: "原1600书桌会覆盖东墙门洞，现改为1100书桌；保留1000日床和850客衣柜，门洞区不再有固定家具。",
    specs: ["日床1000×2000", "书桌1100×550", "客衣柜850×500", "平面校核：条件成立"],
    details: [
      ["校核结论", "日床—书桌净距约875mm；书桌在门洞上缘前结束。衣柜与门洞仅约75mm，必须现场复尺。"],
      ["办公", "视频会议补充正面柔光；有线网口、显示器和桌下理线槽同步定位。"],
      ["柜体", "上柜只放在1100书桌上方，深300–350mm；不在床上方设置重型吊柜。"],
    ],
  },
  {
    index: "07", title: "主卫", eyebrow: "模型净尺寸约2530×1530 · 3.9㎡",
    image: "assets/verified/07-master-bathroom.svg",
    summary: "原900浴室柜和完整封闭玻璃房会压缩入口，现改800悬空柜、壁挂坐便和东端900×1410淋浴区，只设600固定玻璃。",
    specs: ["浴室柜800×450", "淋浴900×1410", "门须外开/移门", "平面校核：条件成立"],
    details: [
      ["校核结论", "三件设备能沿2530宽度排开，但成立前提是卫生间门外开或采用合规移门。"],
      ["排水", "排污、地漏和沉箱尽量原位；若现有坑距不支持壁挂坐便，必须按原排污点重排。"],
      ["电气", "镜柜内吹风机/牙刷插座，智能坐便专用防溅插座，保留等电位连接。"],
      ["通风", "暖风、排风和照明分控；排风止逆、窗扇开启和检修口互不冲突。"],
    ],
  },
  {
    index: "08", title: "客卫", eyebrow: "模型净尺寸约2530×1210 · 3.1㎡",
    image: "assets/verified/08-public-bathroom.svg",
    summary: "原效果图不成立。1210mm进深放不下650浴室柜、常规坐便和完整淋浴房，现改400×300角盆、壁挂坐便及880×1110淋浴区。",
    specs: ["角盆400×300", "淋浴880×1110", "可折叠玻璃", "平面校核：勉强成立"],
    details: [
      ["校核结论", "这里只能做紧凑三件式湿卫，不能复制原深进深效果图；门须外开/移门，玻璃只做可折叠屏。"],
      ["一票否决", "若现场坑距、立管或地漏不在本方案允许区域，客卫应优先保留原排水布局，不能强行追求图示。"],
      ["使用取舍", "400角盆只满足洗手，不适合大量洗漱收纳；主要洗漱功能应由主卫承担。"],
    ],
  },
  {
    index: "09", title: "家政阳台", eyebrow: "模型净尺寸约1420×1490 · 2.1㎡",
    image: "assets/verified/09-utility-balcony.svg",
    summary: "原单侧高柜会把洗烘塔前通道压到约350mm，现把700×350家政柜移到南墙，洗烘塔留在东北角。",
    specs: ["洗烘塔650×700", "南墙浅柜700×350", "主通道≈775", "平面校核：成立"],
    details: [
      ["给排水", "若原阳台无合法给排水，不新增排水穿越客厅或外墙；水槽仅作为条件允许时的备选。"],
      ["防潮", "柜体底部离地或设防水台，插座避开溅水区，并保留设备散热与检修距离。"],
      ["校核结论", "柜体调整后西侧主通道最窄约775mm；原效果图中的宽阔地面和整排高柜不再作为依据。"],
    ],
  },
];

function svg(tag, attributes = {}, text = "") {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  if (text) node.textContent = text;
  return node;
}

function polygonArea(points) {
  let sum = 0;
  points.forEach(([x1, y1], index) => {
    const [x2, y2] = points[(index + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  });
  return Math.abs(sum) / 2 / 10000;
}

function polygonCentroid(points) {
  const area = polygonArea(points) * 10000;
  let cx = 0;
  let cy = 0;
  let crossSum = 0;
  points.forEach(([x1, y1], index) => {
    const [x2, y2] = points[(index + 1) % points.length];
    const cross = x1 * y2 - x2 * y1;
    crossSum += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  });
  const divisor = 3 * crossSum;
  if (!area || !divisor) return points[0];
  return [cx / divisor, cy / divisor];
}

function selectRoom(room, shape) {
  document.querySelectorAll(".room-shape").forEach((item) => item.classList.remove("is-selected"));
  shape?.classList.add("is-selected");
  document.getElementById("selectedRoomName").textContent = room.name;
  document.getElementById("selectedRoomArea").textContent =
    `模型几何面积约 ${polygonArea(room.points).toFixed(1)}㎡。该值由本版坐标计算，不替代产权或现场实测面积。`;
}

function openDesignDialog(item) {
  const dialog = document.getElementById("designDialog");
  const image = document.getElementById("dialogImage");
  image.src = item.image;
  image.alt = `${item.title}按比例空间校核图`;
  document.getElementById("dialogEyebrow").textContent = `${item.index} / ${item.eyebrow}`;
  document.getElementById("dialogTitle").textContent = item.title;
  document.getElementById("dialogSummary").textContent = item.summary;
  document.getElementById("dialogSpecs").innerHTML = item.specs.map((spec) => `<span>${spec}</span>`).join("");
  document.getElementById("dialogDetail").innerHTML = item.details.map(([title, text]) => `<article><strong>${title}</strong><p>${text}</p></article>`).join("");
  dialog.showModal();
}

function renderDesign() {
  const grid = document.getElementById("designGrid");
  DESIGN_ROOMS.forEach((item) => {
    const card = document.createElement("article");
    card.className = "design-card";
    card.innerHTML = `
      <button class="design-card-media" type="button" aria-label="查看${item.title}平面校核详情">
        <img src="${item.image}" alt="${item.title}按比例空间校核图" loading="lazy" />
        <span class="design-card-index">${item.index}</span>
      </button>
      <div class="design-card-body">
        <h3>${item.title}</h3>
        <p>${item.summary}</p>
        <div class="spec-chips">${item.specs.map((spec) => `<span>${spec}</span>`).join("")}</div>
        <button class="design-card-link" type="button">查看平面校核、成立条件与风险 →</button>
      </div>`;
    card.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => openDesignDialog(item)));
    grid.append(card);
  });
}

function addHorizontalDimension(group, x1, x2, y, offset, label, assumption = false) {
  const dimY = y + offset;
  const className = assumption ? "dim-line assumption-line" : "dim-line";
  group.append(svg("line", { x1, y1: y, x2: x1, y2: dimY, class: "dim-ext" }));
  group.append(svg("line", { x1: x2, y1: y, x2, y2: dimY, class: "dim-ext" }));
  group.append(svg("line", { x1, y1: dimY, x2, y2: dimY, class: className, "marker-start": "url(#tick)", "marker-end": "url(#tick)" }));
  group.append(svg("text", { x: (x1 + x2) / 2, y: dimY - 10, class: "dim-text" }, label));
}

function addVerticalDimension(group, x, y1, y2, offset, label) {
  const dimX = x + offset;
  group.append(svg("line", { x1: x, y1, x2: dimX, y2: y1, class: "dim-ext" }));
  group.append(svg("line", { x1: x, y1: y2, x2: dimX, y2, class: "dim-ext" }));
  group.append(svg("line", { x1: dimX, y1, x2: dimX, y2, class: "dim-line", "marker-start": "url(#tick)", "marker-end": "url(#tick)" }));
  group.append(svg("text", { x: dimX + 19, y: (y1 + y2) / 2, class: "dim-text", transform: `rotate(90 ${dimX + 19} ${(y1 + y2) / 2})` }, label));
}

function renderPlan(model) {
  const root = document.getElementById("planSvg");
  root.replaceChildren();

  const defs = svg("defs");
  const pattern = svg("pattern", { id: "grid100", width: 100, height: 100, patternUnits: "userSpaceOnUse" });
  pattern.append(svg("path", { d: "M 100 0 L 0 0 0 100", fill: "none", stroke: "#cfd7d2", "stroke-width": 1 }));
  defs.append(pattern);
  const marker = svg("marker", { id: "tick", markerWidth: 10, markerHeight: 10, refX: 5, refY: 5, orient: "auto", markerUnits: "userSpaceOnUse" });
  marker.append(svg("path", { d: "M2,9 L8,1", stroke: "#0e6c5d", "stroke-width": 2 }));
  defs.append(marker);
  root.append(defs);

  const grid = svg("rect", { x: -100, y: -100, width: 1040, height: 1610, fill: "url(#grid100)", class: "plan-grid" });
  grid.id = "planGrid";
  root.append(grid);

  const roomColors = {
    bedroom: "#ead9c6",
    wet: "#d9e4e1",
    living: "#f1e5d1",
    balcony: "#dce7e2",
    kitchen: "#e2e5df",
  };
  const roomsGroup = svg("g", { id: "rooms" });
  model.rooms.forEach((room) => {
    const shape = svg("polygon", {
      points: room.points.map((point) => point.join(",")).join(" "),
      fill: roomColors[room.tone] || "#eee",
      class: `room-shape room-${room.id}`,
      tabindex: 0,
      role: "button",
      "aria-label": room.name,
    });
    shape.addEventListener("click", () => selectRoom(room, shape));
    shape.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") selectRoom(room, shape);
    });
    roomsGroup.append(shape);
    const [cx, cy] = polygonCentroid(room.points);
    roomsGroup.append(svg("text", { x: cx, y: cy - 4, class: "room-label" }, room.name));
    roomsGroup.append(svg("text", { x: cx, y: cy + 18, class: "room-area" }, `${polygonArea(room.points).toFixed(1)}㎡ · 模型值`));
  });
  root.append(roomsGroup);

  const furniture = svg("g", { id: "furnitureLayer" });
  model.furniture.forEach((item) => {
    furniture.append(svg("rect", { x: item.x, y: item.y, width: item.w, height: item.d, rx: 4, class: `furniture-shape furniture-${item.tone || "wood"}` }));
    furniture.append(svg("text", { x: item.x + item.w / 2, y: item.y + item.d / 2 + 4, class: "furniture-label" }, item.name));
  });
  root.append(furniture);

  const walls = svg("g", { id: "walls" });
  model.walls.forEach(([x1, y1, x2, y2]) => walls.append(svg("line", { x1, y1, x2, y2, class: "wall-line" })));
  root.append(walls);

  const windows = svg("g", { id: "windowOpenings" });
  model.windows.forEach((window) => {
    const group = svg("g", { role: "img", "aria-label": `${window.name}，${window.widthMm}毫米，${window.grade}级` });
    group.append(svg("title", {}, `${window.name} · ${window.widthMm} mm · ${window.grade}级`));
    group.append(svg("line", { x1: window.x1, y1: window.y1, x2: window.x2, y2: window.y2, class: "window-opening-cut" }));
    group.append(svg("line", { x1: window.x1, y1: window.y1, x2: window.x2, y2: window.y2, class: "window-opening-line" }));
    windows.append(group);
  });
  root.append(windows);

  const doors = svg("g", { id: "doorOpenings" });
  model.doors.forEach((door) => {
    const glass = door.kind === "glass-door";
    const group = svg("g", { role: "img", "aria-label": `${door.name}，${door.widthMm}毫米，${door.grade}级` });
    group.append(svg("title", {}, `${door.name} · ${door.widthMm} mm · ${door.grade}级`));
    group.append(svg("line", { x1: door.x1, y1: door.y1, x2: door.x2, y2: door.y2, class: "door-opening-cut" }));
    group.append(svg("line", { x1: door.x1, y1: door.y1, x2: door.x2, y2: door.y2, class: glass ? "glass-door-opening-line" : "door-opening-line" }));
    doors.append(group);
  });
  root.append(doors);

  const dims = svg("g", { id: "dimensions" });
  addHorizontalDimension(dims, 0, 687, 0, -62, "6,870 mm · A");
  addHorizontalDimension(dims, 12, 313, 12, -30, "3,010");
  addHorizontalDimension(dims, 325, 675, 12, -30, "3,500");
  addVerticalDimension(dims, 0, 0, 1401, -78, "14,010 mm · A");
  addVerticalDimension(dims, 687, 12, 322, 67, "3,100");
  addVerticalDimension(dims, 687, 334, 487, 67, "1,530");
  addVerticalDimension(dims, 687, 499, 620, 67, "1,210");
  addVerticalDimension(dims, 687, 632, 942, 67, "3,100");
  addVerticalDimension(dims, 841, 954, 1115, 66, "1,610");
  addVerticalDimension(dims, 841, 1127, 1389, 66, "2,620");
  addHorizontalDimension(dims, 200, 841, 1401, 62, "6,410 mm · A");
  addHorizontalDimension(dims, 212, 530, 1389, 32, "3,180");
  addHorizontalDimension(dims, 542, 829, 1389, 32, "2,870");
  addHorizontalDimension(dims, 0, 200, 632, 47, "2,000 mm · B", true);
  root.append(dims);

  const north = svg("g", { transform: "translate(790 70)" });
  north.append(svg("path", { d: "M0 50 L20 0 L40 50 L20 40 Z", class: "north-arrow" }));
  north.append(svg("text", { x: 20, y: -13, "text-anchor": "middle", fill: "#123c35", "font-size": 21, "font-weight": 900 }, "北"));
  north.append(svg("text", { x: 20, y: 72, "text-anchor": "middle", fill: "#b75c2d", "font-size": 12, "font-weight": 800 }, "临道路侧"));
  root.append(north);

  const living = model.rooms.find((room) => room.id === "living");
  selectRoom(living, root.querySelector(".room-living"));
}

function renderAudit(model) {
  const tbody = document.getElementById("auditRows");
  const formatValue = (value) => typeof value === "number" ? `${value.toLocaleString("zh-CN")} mm` : `${value} mm`;
  model.anchors.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.label}</td>
      <td>${formatValue(item.valueMm)}</td>
      <td><em class="grade grade-${item.grade.toLowerCase()}">${item.grade}</em></td>
      <td>${item.source}</td>`;
    tbody.append(row);
  });
}

function activateTab(name) {
  document.querySelectorAll(".tab").forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    const active = panel.id === `panel-${name}`;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });
  if (name === "viewer") resizeViewer();
  document.getElementById("model").scrollIntoView({ behavior: "smooth", block: "start" });
}

function setupTabs() {
  document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => activateTab(button.dataset.tab)));
  document.querySelectorAll("[data-open-tab]").forEach((button) => button.addEventListener("click", () => activateTab(button.dataset.openTab)));
}

function resizeViewer() {
  const canvas = document.getElementById("viewerCanvas");
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(rect.width * ratio));
  const height = Math.max(1, Math.floor(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function initViewer() {
  resizeViewer();
  const progressBox = document.getElementById("viewerProgressBox");
  const progress = document.getElementById("viewerProgress");
  const progressLabel = document.getElementById("viewerProgressLabel");
  const errorBox = document.getElementById("viewerError");
  const errorText = document.getElementById("viewerErrorText");

  const onerror = (error) => {
    progressBox.hidden = true;
    errorBox.hidden = false;
    const message = error?.message || String(error);
    errorText.textContent = message === "No WebGL" ? "当前浏览器不支持 WebGL；请使用桌面版 Chrome / Edge，或查看 2D 比例图。" : `错误：${message}`;
    console.error(error);
  };

  const onprogression = (part, info, percentage) => {
    if (part === HomeRecorder.READING_HOME) {
      progress.value = percentage * 100;
      progressLabel.textContent = `${Math.floor(percentage * 100)}% · 正在读取户型`;
    } else if (part === ModelLoader.READING_MODEL) {
      progress.value = 100 + percentage * 100;
      progressLabel.textContent = `${Math.floor(percentage * 100)}% · 正在生成 3D 场景`;
      if (percentage >= 0.999) progressBox.hidden = true;
    }
  };

  try {
    state.homeComponent = viewHome(
      "viewerCanvas",
      "models/huiyayuan-104-calibrated.sh3d?v=2.1.0",
      onerror,
      onprogression,
      {
        roundsPerMinute: 0,
        navigationPanel: "none",
        aerialViewButtonId: "aerialView",
        virtualVisitButtonId: "virtualVisit",
        levelsAndCamerasListId: "levelsAndCameras",
        activateCameraSwitchKey: true,
      },
    );
  } catch (error) {
    onerror(error);
  }
}

async function start() {
  setupTabs();
  renderDesign();
  const designDialog = document.getElementById("designDialog");
  document.getElementById("dialogClose").addEventListener("click", () => designDialog.close());
  designDialog.addEventListener("click", (event) => {
    if (event.target === designDialog) designDialog.close();
  });
  document.getElementById("toggleFurniture").addEventListener("change", (event) => {
    document.getElementById("furnitureLayer").style.display = event.target.checked ? "" : "none";
  });
  document.getElementById("toggleGrid").addEventListener("change", (event) => {
    document.getElementById("planGrid").style.display = event.target.checked ? "" : "none";
  });
  document.getElementById("fullscreenButton").addEventListener("click", () => document.getElementById("viewerShell").requestFullscreen?.());
  window.addEventListener("resize", resizeViewer);

  const response = await fetch("models/model-data.json?v=2.1.0");
  if (!response.ok) throw new Error(`模型坐标读取失败：HTTP ${response.status}`);
  state.model = await response.json();
  renderPlan(state.model);
  renderAudit(state.model);
  initViewer();
}

window.addEventListener("load", () => start().catch((error) => {
  console.error(error);
  const viewerError = document.getElementById("viewerError");
  viewerError.hidden = false;
  document.getElementById("viewerErrorText").textContent = error.message;
}));
