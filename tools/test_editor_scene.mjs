import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from '../vendor/three/three.module.js';
import { furnitureKey, isMovableFurniture, COLOR_KEYS } from '../design-editor-core.js';
import { annotateEditorScene, createEditorSceneAdapter, editorBatchKey, EDITOR_SEMANTIC_KEYS } from '../editor-scene.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let checks = 0;
const eq = (a, b, message) => { assert.deepEqual(a, b, message); checks++; };
const ok = (condition, message) => { assert.ok(condition, message); checks++; };
const near = (a, b, message) => ok(Math.abs(a - b) < 1e-7, `${message}: ${a} / ${b}`);
const f = (id, name = id) => ({ id, name, x: 100, y: 100, w: 40, d: 40, a: 0, tone: 'fabric', woodRole: 'chair' });
function mesh(name, userData = {}, material = new THREE.MeshStandardMaterial({ color: '#cabbaa' })) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(.4, .8, .4), material); m.name = name; m.userData = userData; return m;
}
function rawSnapshot(model) {
  const result = new Map(); model.traverse(m => { if (m.isMesh) result.set(m, { position: m.position.toArray(), matrix: m.matrixWorld.toArray(), material: m.material }); }); return result;
}

// Load the real GLB JSON, POSITION accessors, transforms, hierarchy and material
// definitions without a DOM or image decoder. Real textures get unique Texture
// sentinels: tests verify clone tinting retains their exact identity.
function loadGlb(file) {
  const bytes = fs.readFileSync(file), jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength));
  const binStart = 20 + jsonLength + 8;
  const textures = (gltf.textures || []).map(() => new THREE.Texture());
  const mats = (gltf.materials || []).map(m => {
    const p = m.pbrMetallicRoughness || {}, rgba = p.baseColorFactor || [1, 1, 1, 1];
    const material = new THREE.MeshStandardMaterial({ name: m.name || '', metalness: p.metallicFactor ?? 1, roughness: p.roughnessFactor ?? 1, transparent: m.alphaMode === 'BLEND', opacity: rgba[3] });
    material.color.setRGB(...rgba.slice(0, 3));
    if (p.baseColorTexture) material.map = textures[p.baseColorTexture.index];
    return material;
  });
  const geometries = new Map();
  function geometry(index) {
    if (geometries.has(index)) return geometries.get(index);
    const a = gltf.accessors[index], view = gltf.bufferViews[a.bufferView];
    assert.equal(a.componentType, 5126); assert.equal(a.type, 'VEC3');
    const offset = binStart + (view.byteOffset || 0) + (a.byteOffset || 0), stride = view.byteStride || 12;
    const positions = new Float32Array(a.count * 3);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < 3; c++) positions[i * 3 + c] = bytes.readFloatLE(offset + i * stride + c * 4);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometries.set(index, g); return g;
  }
  const nodes = gltf.nodes.map(n => {
    let object = new THREE.Group();
    if (n.mesh !== undefined) {
      const primitives = gltf.meshes[n.mesh].primitives;
      const make = p => new THREE.Mesh(geometry(p.attributes.POSITION), mats[p.material]);
      if (primitives.length === 1) object = make(primitives[0]);
      else for (const p of primitives) object.add(make(p));
    }
    object.name = n.name || ''; object.userData = { ...(n.extras || {}) };
    if (n.matrix) { object.matrix.fromArray(n.matrix); object.matrix.decompose(object.position, object.quaternion, object.scale); }
    else { if (n.translation) object.position.fromArray(n.translation); if (n.rotation) object.quaternion.fromArray(n.rotation); if (n.scale) object.scale.fromArray(n.scale); }
    return object;
  });
  for (let i = 0; i < gltf.nodes.length; i++) for (const child of gltf.nodes[i].children || []) nodes[i].add(nodes[child]);
  const model = new THREE.Group();
  for (const i of gltf.scenes[gltf.scene || 0].nodes) model.add(nodes[i]);
  model.updateMatrixWorld(true);
  return { model, gltf, dispose() { model.traverse(m => { if (m.isMesh) m.geometry.dispose(); }); for (const mat of mats) mat.dispose(); } };
}

// Mapping: explicit id, legacy name-as-id, inherited group, safe name prefix;
// ambiguous identifiers fail closed instead of moving only some parts.
{
  const a = f('chair-a', '独立椅'), b = { ...f(undefined, '餐椅北'), id: undefined }, data = { furniture: [a, b, { ...f('locked', '书房通长桌'), tone: 'wood' }] };
  const model = new THREE.Group(), group = new THREE.Group(); group.userData = { kind: 'furniture', furnitureId: 'chair-a' };
  group.add(mesh('seat')); group.add(mesh('leg')); model.add(group);
  model.add(mesh('legacy', { kind: 'furniture', furnitureId: '餐椅北', furnitureName: '餐椅北' }));
  const prefixed = mesh('独立椅 / back', { kind: 'furniture' }); model.add(prefixed);
  model.add(mesh('unknown', { kind: 'furniture', furnitureId: 'unknown-id' }));
  model.add(mesh('独立椅2', { kind: 'furniture' }));
  model.add(mesh('书房通长桌 / top', { kind: 'furniture' }));
  let report = annotateEditorScene(model, data);
  eq(report.movableKeys.sort(), ['chair-a', 'name:餐椅北']);
  eq(report.furnitureStates.find(r => r.key === 'chair-a').meshCount, 3);
  eq(prefixed.userData.editorFurnitureKey, 'chair-a');
  eq(report.unresolvedMeshes.length, 2);
  const conflict = mesh('bad ownership', { kind: 'furniture', furnitureId: 'chair-a', furnitureName: '餐椅北' }); model.add(conflict);
  report = annotateEditorScene(model, data); eq(report.movableKeys, [], 'conflicting ownership locks both complete items');
  const adapter = createEditorSceneAdapter({ model, data, THREE });
  eq(adapter.applyPositions({ 'chair-a': { dx: 20, dy: 0 } }).rejected.length, 1); adapter.dispose();
}

// Absolute reversible movement including rotated/scaled parents. Fixed geometry
// never moves; dropping a sparse key resets exactly rather than adding deltas.
{
  const data = { furniture: [f('a', '椅A'), f('b', '椅B')] }, model = new THREE.Group(), parent = new THREE.Group();
  parent.rotation.y = .4; parent.scale.set(2, 1, .7); parent.position.set(1, 0, 2); model.add(parent);
  const a = mesh('a', { kind: 'furniture', furnitureId: 'a' }), b = mesh('b', { kind: 'furniture', furnitureId: 'b' }), wall = mesh('wall', { kind: 'wall' });
  parent.add(a); model.add(b, wall); a.position.set(3, 1, 2); b.position.set(6, 0, 4);
  annotateEditorScene(model, data); const adapter = createEditorSceneAdapter({ model, data, THREE });
  const baseline = adapter.getFurnitureStates(), original = rawSnapshot(model), base = new THREE.Vector3(); a.getWorldPosition(base);
  adapter.applyPositions({ a: { dx: 25, dy: -43 } });
  const p = new THREE.Vector3(); a.getWorldPosition(p); near(p.x, base.x + .25, 'world x'); near(p.z, base.z - .43, 'world plan y');
  adapter.applyPositions({ a: { dx: 25, dy: -43 } }); a.getWorldPosition(p); near(p.x, base.x + .25, 'no accumulation');
  eq(wall.position.toArray(), original.get(wall).position);
  adapter.applyPositions({ b: { dx: -10, dy: 12 } }); eq(a.position.toArray(), original.get(a).position, 'sparse reset exact');
  eq(adapter.applyPositions({ a: { dx: Infinity, dy: 0 }, unknown: { dx: 1, dy: 1 } }).rejected.length, 2);
  adapter.applyPositions({}); eq(adapter.getFurnitureStates(), baseline);
  adapter.dispose(); eq(a.position.toArray(), original.get(a).position); assert.throws(() => adapter.applyPositions({})); checks++;
}

// Fail closed if someone skips static flattening and nests unrelated geometry
// under a movable mesh; otherwise translating it would silently drag the child.
{
  const data = { furniture: [f('a', '椅A'), f('b', '椅B')] }, model = new THREE.Group();
  const a = mesh('a', { kind: 'furniture', furnitureId: 'a' }), b = mesh('b', { kind: 'furniture', furnitureId: 'b' });
  a.add(b); model.add(a); annotateEditorScene(model, data);
  const adapter = createEditorSceneAdapter({ model, data, THREE }); eq(adapter.movableKeys, []);
  eq(adapter.applyPositions({ a: { dx: 10, dy: 0 }, b: { dx: 0, dy: 10 } }).rejected.length, 2); adapter.dispose();
}

// Palette: identical material reused by cabinet, appliance and wall remains
// independently tintable. Texture, roughness and protected materials untouched.
{
  const model = new THREE.Group(), cream = new THREE.MeshStandardMaterial({ name: 'Cream', color: '#dbcaa0', roughness: .82 }), oak = new THREE.MeshStandardMaterial({ name: 'Oak', color: '#bc9972' });
  oak.map = new THREE.Texture(); cream.normalMap = new THREE.Texture();
  const cabinet = mesh('Kitchen cabinet front', { kind: 'furniture', kitchenFitoutId: 'k', kitchenRole: 'base-cabinet' }, cream);
  const fridge = mesh('Fridge', { kind: 'furniture', kitchenApplianceId: 'fridge', kitchenRole: 'appliance' }, cream);
  const wall = mesh('Wall', { kind: 'wall' }, cream), wood = mesh('Table top', { kind: 'furniture' }, oak), floor = mesh('floor', { kind: 'floor' }, oak);
  const metal = mesh('metal', {}, new THREE.MeshStandardMaterial({ name: 'Chrome' }));
  const ceramic = mesh('basin', {}, new THREE.MeshStandardMaterial({ name: 'Ceramic' }));
  model.add(cabinet, fridge, wall, wood, floor, metal, ceramic); annotateEditorScene(model, { furniture: [] });
  ok(editorBatchKey(cabinet.userData) !== editorBatchKey(fridge.userData), 'protected/context batches stay apart');
  ok(editorBatchKey(wood.userData) !== editorBatchKey(floor.userData), 'wood floor and wood furniture stay apart');
  const adapter = createEditorSceneAdapter({ model, data: { furniture: [] }, THREE });
  const originalCream = cream.color.toArray(), originalOak = oak.color.toArray();
  ok(cabinet.material !== cream && wall.material !== cream && cabinet.material !== wall.material);
  eq(fridge.material, cream); eq(wood.material.map, oak.map); eq(cabinet.material.normalMap, cream.normalMap);
  eq(adapter.applyPalette({ wall: '#112233', cabinet: '#998877', floor: '#778899', wood: '#eeddaa' }).appliedCategories.sort(), ['cabinet', 'floor', 'wall', 'wood']);
  eq(wall.material.color.getHexString(), '112233'); eq(cabinet.material.color.getHexString(), '998877'); eq(floor.material.color.getHexString(), '778899'); eq(wood.material.color.getHexString(), 'eeddaa');
  eq(cream.color.toArray(), originalCream); eq(oak.color.toArray(), originalOak); eq(cabinet.material.roughness, .82);
  eq(adapter.applyPalette({ walls: '#ffffff', wall: 'red' }).rejected.length, 2);
  adapter.applyPalette({}); eq(cabinet.material.color.toArray(), originalCream); eq(wall.material.color.toArray(), originalCream); eq(wood.material.color.toArray(), originalOak);
  adapter.dispose(); eq(cabinet.material, cream); eq(wall.material, cream); eq(wood.material, oak);
}

// A multi-material mesh retains per-slot classification through the no-batch
// branch; a glass/metal slot never becomes fabric just because another slot is.
{
  const data = { furniture: [f('a', '椅A')] }, model = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ name: 'Chrome' }), fabric = new THREE.MeshStandardMaterial({ name: 'Linen', color: '#eeeeee' });
  const m = mesh('椅A', { kind: 'furniture', furnitureId: 'a' }, [metal, fabric]); model.add(m);
  annotateEditorScene(model, data); eq(m.userData.editorColorCategories, [null, 'fabric']);
  const adapter = createEditorSceneAdapter({ model, data, THREE }); adapter.applyPalette({ fabric: '#ffccaa' });
  eq(m.material[0], metal); eq(m.material[1].color.getHexString(), 'ffccaa'); adapter.dispose(); eq(m.material[1], fabric);
}

// Actual published models: every core-approved item has native parts and moves
// as a complete item. All protected scene nodes remain in their exact positions.
const summaries = [];
for (const scheme of ['wood', 'family', 'laundry']) {
  const dir = path.join(root, 'models/schemes', scheme), data = JSON.parse(fs.readFileSync(path.join(dir, 'design-data.json')));
  const { model, dispose } = loadGlb(path.join(dir, 'huiyayuan-wood.glb'));
  const report = annotateEditorScene(model, data), expected = data.furniture.filter(isMovableFurniture).map(furnitureKey).sort();
  eq([...report.movableKeys].sort(), expected, `${scheme}: all approved furniture maps to actual GLB parts`);
  const adapter = createEditorSceneAdapter({ model, data, THREE }); eq([...adapter.movableKeys].sort(), expected);
  const states = adapter.getFurnitureStates(), snapshot = rawSnapshot(model);
  for (const key of expected) {
    const result = adapter.applyPositions({ [key]: { dx: 21.5, dy: -14.25 } }); eq(result.rejected, []);
    const moved = adapter.getFurnitureStates().find(r => r.key === key), base = states.find(r => r.key === key);
    for (const bound of ['min', 'max']) { near(moved.boundsCm[bound][0], base.boundsCm[bound][0] + 21.5, scheme + ' full body x'); near(moved.boundsCm[bound][2], base.boundsCm[bound][2] - 14.25, scheme + ' full body y'); }
    model.traverse(m => { if (m.isMesh && m.userData.editorFurnitureKey !== key) eq(m.position.toArray(), snapshot.get(m).position, `${scheme}: unrelated ${m.name} unchanged`); });
    adapter.applyPositions({});
  }
  eq(adapter.getFurnitureStates(), states, `${scheme}: exact reset`);
  const colors = new Map(), maps = new Map();
  model.traverse(m => { if (!m.isMesh) return; for (const mat of (Array.isArray(m.material) ? m.material : [m.material])) { colors.set(mat, mat.color?.toArray()); maps.set(mat, mat.map); } });
  const result = adapter.applyPalette(Object.fromEntries(COLOR_KEYS.map(k => [k, '#789abc'])));
  eq(result.appliedCategories.sort(), [...COLOR_KEYS].sort(), `${scheme}: all six palette categories present`);
  model.traverse(m => { if (!m.isMesh) return; const cats = Array.isArray(m.material) ? m.userData.editorColorCategories : [m.userData.editorColorCategory];
    (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat, i) => { eq(mat.map, maps.get(mat)); if (!cats?.[i]) eq(mat.color?.toArray(), colors.get(mat), `${scheme}: protected ${mat.name}`); });
  });
  adapter.resetPalette(); for (const [mat, color] of colors) eq(mat.color?.toArray(), color);
  // Same original material + room is insufficient for batching: all distinct
  // movable keys must yield different editor discriminators.
  const signatures = new Set(expected.map(key => editorBatchKey({ editorFurnitureKey: key, editorMovable: true })));
  eq(signatures.size, expected.length); ok(EDITOR_SEMANTIC_KEYS.includes('editorColorCategory'));
  summaries.push({ scheme, movable: expected.length, meshes: report.meshCount, unmappedFixedOrDecor: report.unresolvedMeshes.length });
  adapter.dispose(); dispose();
}
console.log(JSON.stringify({ ok: true, checks, models: summaries }, null, 2));
