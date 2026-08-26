/* global viewHome, HomeRecorder, ModelLoader */

const state = {
  model: null,
  homeComponent: null,
};

const SVG_NS = "http://www.w3.org/2000/svg";

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
    furniture.append(svg("rect", { x: item.x, y: item.y, width: item.w, height: item.d, rx: 4, class: "furniture-shape" }));
    furniture.append(svg("text", { x: item.x + item.w / 2, y: item.y + item.d / 2 + 4, class: "furniture-label" }, item.name));
  });
  root.append(furniture);

  const walls = svg("g", { id: "walls" });
  model.walls.forEach(([x1, y1, x2, y2]) => walls.append(svg("line", { x1, y1, x2, y2, class: "wall-line" })));
  root.append(walls);

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
      "models/huiyayuan-104-calibrated.sh3d",
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
  document.getElementById("toggleFurniture").addEventListener("change", (event) => {
    document.getElementById("furnitureLayer").style.display = event.target.checked ? "" : "none";
  });
  document.getElementById("toggleGrid").addEventListener("change", (event) => {
    document.getElementById("planGrid").style.display = event.target.checked ? "" : "none";
  });
  document.getElementById("fullscreenButton").addEventListener("click", () => document.getElementById("viewerShell").requestFullscreen?.());
  window.addEventListener("resize", resizeViewer);

  const response = await fetch("models/model-data.json");
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
