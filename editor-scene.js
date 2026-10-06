// Three.js bridge for browser-local drafts. Published geometry is never edited.
// Annotate BEFORE static batching; construct the adapter AFTER viewer materials
// are prepared, then collect any clipping-material references from these clones.
import { furnitureKey, isMovableFurniture, COLOR_KEYS, MAX_OFFSET_CM } from './design-editor-core.js?v=3.13.3';

export const EDITOR_SEMANTIC_KEYS = Object.freeze([
  'editorFurnitureKey', 'editorMovable', 'editorColorCategory', 'editorColorCategories'
]);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const finite = n => typeof n === 'number' && Number.isFinite(n);
const materials = mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material];
const normalized = value => String(value || '').replace(/[\s_]+/g, ' ').trim();
const fixedKeys = ['storageFitoutId', 'kitchenFitoutId', 'laundryFitoutId', 'garageFitoutId', 'wallFitoutId', 'bayFitoutId', 'fitoutId'];

// This discriminator belongs in the static-batch signature alongside material,
// room, kind and geometry attributes. Unknown/protected parts remain separate
// from tintable ones even when they share the same original material.
export function editorBatchKey(semantic) {
  return JSON.stringify([semantic.editorFurnitureKey || '', !!semantic.editorMovable,
    semantic.editorColorCategory || '', semantic.editorColorCategories || null]);
}

function inherited(object) {
  const result = {};
  for (let p = object; p; p = p.parent) {
    for (const [key, value] of Object.entries(p.userData || {})) if (!own(result, key)) result[key] = value;
  }
  return result;
}

function registry(data) {
  const rows = (data?.furniture || []).map(f => ({ key: furnitureKey(f), name: f.name || '', furniture: f }));
  const tokens = new Map(), duplicateKeys = new Set();
  for (const row of rows) {
    if (rows.some(other => other !== row && other.key === row.key)) duplicateKeys.add(row.key);
    for (const token of new Set([row.key, row.furniture.id, row.name].filter(Boolean))) {
      if (!tokens.has(token)) tokens.set(token, []);
      tokens.get(token).push(row);
    }
  }
  return { rows, tokens, duplicateKeys };
}

function resolveFurniture(object, meta, reg) {
  if (meta.kind && meta.kind !== 'furniture') return { row: null, reason: '建筑或非家具构件' };
  const explicit = [meta.furnitureId, meta.furnitureName].filter(Boolean);
  if (explicit.length) {
    const matches = [...new Set(explicit.flatMap(token => reg.tokens.get(token) || []))];
    if (matches.length === 1 && !reg.duplicateKeys.has(matches[0].key)) return { row: matches[0] };
    return { row: null, candidates: matches.map(r => r.key), reason: matches.length ? '家具归属有歧义' : '模型标识未对应到源家具' };
  }
  // A fixed fitout's part name must never masquerade as a nearby loose item.
  if (fixedKeys.some(key => meta[key]) || meta.garagePartId || meta.laundryPartId || meta.kitchenPartId) {
    return { row: null, reason: '固定分件无独立可移动归属' };
  }
  const names = [];
  for (let p = object; p; p = p.parent) if (p.name) names.push(normalized(p.name));
  const matches = reg.rows.filter(row => {
    const prefix = normalized(row.name);
    return prefix && names.some(name => name === prefix || name.startsWith(prefix + ' ') || name.startsWith(prefix + ' /') ||
      new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.[0-9]+(?:$| )').test(name));
  });
  if (matches.length === 1 && !reg.duplicateKeys.has(matches[0].key)) return { row: matches[0] };
  return { row: null, candidates: matches.map(r => r.key), reason: matches.length ? '家具名称前缀有歧义' : '未找到可靠的家具归属' };
}

function colorCategory(object, material, meta, row) {
  if (!material?.color) return null;
  const mat = String(material.name || ''), name = normalized(object.name), label = `${name} ${meta.furnitureName || ''}`;
  // Never recolor functional hardware, glass, white ceramics or appliances,
  // including those sharing Cream/WhiteLinen with cabinet doors or upholstery.
  if (material.transparent || (material.transmission || 0) > 0 || (material.opacity ?? 1) < 1 || (material.metalness || 0) > .4 ||
      /glass|metal|chrome|brass|mirror|ceramic|charcoal|^lamp$/i.test(mat) ||
      meta.kitchenApplianceId || meta.kitchenRole === 'appliance' || meta.laundryMachineId ||
      /^(?:laundry_washer|laundry_dryer)$/.test(meta.furnitureId || '') ||
      /tap |faucet|drain|basin|toilet|sink|shower tray|ceiling light|ceiling diffuser|lamp bulb|opal diffuser|pendant ceiling|suspension/i.test(label)) return null;
  if (meta.kind === 'floor') return /grout/i.test(mat) ? null : 'floor';
  if (meta.kind === 'wall') return 'wall';
  if (/^Wall$/i.test(mat)) return 'wall';
  if (/sage|terracotta/i.test(mat)) return 'accent';
  if (/linen|fabric|VIMLE|knäbäck/i.test(mat)) return 'fabric';
  const cabinet = fixedKeys.some(key => meta[key]) || /柜|书架|书柜/.test(row?.name || meta.furnitureName || '') ||
    /cabinet|wardrobe|drawer|sideboard/i.test(name);
  if (cabinet && /door|drawer front|cabinet front|sliding front|门板|抽屉面/i.test(name)) return 'cabinet';
  if (/oak|walnut|LISABO|light ash/i.test(mat)) return 'wood';
  if (cabinet && /^Cream$/i.test(mat)) return 'cabinet';
  if (/^Cream$/i.test(mat) && ['wall', 'door', 'window'].includes(meta.kind)) return 'wall';
  return null;
}

/** Annotate raw GLTF mesh semantics; does not mutate geometry or materials. */
export function annotateEditorScene(source, data) {
  const reg = registry(data), counts = new Map(), invalid = new Set(reg.duplicateKeys), unresolvedMeshes = [];
  let meshCount = 0;
  const candidates = [];
  source.traverse(object => {
    if (!object.isMesh) return;
    meshCount++;
    const meta = inherited(object), resolved = resolveFurniture(object, meta, reg), row = resolved.row;
    if (!row && meta.kind === 'furniture') {
      unresolvedMeshes.push({ name: object.name, furnitureId: meta.furnitureId || null, reason: resolved.reason });
      for (const key of resolved.candidates || []) invalid.add(key);
    }
    const categories = materials(object).map(material => colorCategory(object, material, meta, row));
    object.userData.editorFurnitureKey = row?.key || null;
    object.userData.editorMovable = !!row && isMovableFurniture(row.furniture);
    object.userData.editorColorCategory = Array.isArray(object.material) ? null : categories[0];
    object.userData.editorColorCategories = Array.isArray(object.material) ? categories : null;
    if (row) counts.set(row.key, (counts.get(row.key) || 0) + 1);
    candidates.push(object);
  });
  for (const mesh of candidates) if (invalid.has(mesh.userData.editorFurnitureKey)) mesh.userData.editorMovable = false;
  const furnitureStates = reg.rows.map(row => {
    const meshCount = counts.get(row.key) || 0, allowed = isMovableFurniture(row.furniture);
    return { key: row.key, name: row.name, mapped: meshCount > 0, meshCount,
      movable: allowed && meshCount > 0 && !invalid.has(row.key),
      reason: invalid.has(row.key) ? '模型家具归属有歧义，禁止移动' : !allowed ? '固定、定制或不支持的家具' : !meshCount ? '3D 无可靠映射，禁止仅移动平面图' : '' };
  });
  return { movableKeys: furnitureStates.filter(f => f.movable).map(f => f.key), furnitureStates, unresolvedMeshes, meshCount };
}

/**
 * Use on the annotated, batch-isolated scene. Offsets are absolute from this
 * baseline, in plan centimetres; plan y maps to Three.js z. Texture references,
 * roughness and all non-color properties are retained by Material.clone().
 */
export function createEditorSceneAdapter({ model, data, THREE }) {
  if (!model?.traverse || !THREE?.Vector3 || !THREE?.Box3) throw new TypeError('缺少 Three.js 场景或数学 API');
  const reg = registry(data), rows = new Map(reg.rows.map(row => [row.key, row]));
  const grouped = new Map(), meshRecords = [], paletteRecords = [], materialRecords = [], cache = new Map();
  const offsets = new Map();
  let disposed = false;
  model.updateMatrixWorld(true);
  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    const meta = inherited(mesh), key = meta.editorFurnitureKey;
    const record = { mesh, index: meshRecords.length, base: mesh.position.clone(), key, movable: meta.editorMovable === true };
    meshRecords.push(record);
    if (key && rows.has(key)) {
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(record);
    }
    const original = mesh.material;
    const clones = materials(mesh).map((material, index) => {
      const category = Array.isArray(original) ? meta.editorColorCategories?.[index] : meta.editorColorCategory;
      if (!COLOR_KEYS.includes(category) || !material?.color || !material.clone) return material;
      let categories = cache.get(material);
      if (!categories) cache.set(material, categories = new Map());
      if (!categories.has(category)) {
        const clone = material.clone();
        categories.set(category, clone);
        paletteRecords.push({ material: clone, category, color: material.color.clone() });
      }
      return categories.get(category);
    });
    materialRecords.push({ mesh, original });
    mesh.material = Array.isArray(original) ? clones : clones[0];
  });
  const eligible = new Set(reg.rows.filter(row => isMovableFurniture(row.furniture) && !reg.duplicateKeys.has(row.key) &&
    grouped.get(row.key)?.length && grouped.get(row.key).every(r => r.movable)).map(row => row.key));
  // Moving a mesh-parent can drag unowned or separately owned mesh-children.
  // Static batching produces a flat scene; fail closed for unexpected nesting.
  for (const [key, records] of grouped) for (const { mesh } of records) {
    mesh.traverse(child => { if (child !== mesh && child.isMesh) eligible.delete(key); });
    for (let p = mesh.parent; p && p !== model; p = p.parent) if (p.isMesh) eligible.delete(key);
  }
  const live = () => { if (disposed) throw new Error('此场景编辑适配器已销毁'); };
  const vector = new THREE.Vector3(), baseWorld = new THREE.Vector3();
  function applyPositions(value = {}) {
    live();
    const appliedKeys = [], rejected = [];
    const requested = value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value) : [];
    const valid = new Map();
    for (const [key, offset] of requested) {
      if (!eligible.has(key)) { rejected.push({ key, reason: '3D 家具未可靠映射或不可移动' }); continue; }
      if (!finite(offset?.dx) || !finite(offset?.dy) || Math.abs(offset.dx) > MAX_OFFSET_CM || Math.abs(offset.dy) > MAX_OFFSET_CM) {
        rejected.push({ key, reason: '偏移必须是范围内的有限厘米数值' }); continue;
      }
      valid.set(key, offset); appliedKeys.push(key);
    }
    // Reset all owned positions first, including keys removed from a sparse draft.
    for (const { mesh, base, key } of meshRecords) if (key && eligible.has(key)) mesh.position.copy(base);
    model.updateMatrixWorld(true);
    offsets.clear();
    for (const [key, offset] of valid) {
      for (const { mesh, base } of grouped.get(key)) {
        // Convert a world-space plan offset into local coordinates, including
        // non-uniformly scaled or rotated parent groups (no accumulation).
        baseWorld.copy(base);
        if (mesh.parent) mesh.parent.localToWorld(baseWorld);
        vector.copy(baseWorld); vector.x += offset.dx / 100; vector.z += offset.dy / 100;
        if (mesh.parent) mesh.parent.worldToLocal(vector);
        mesh.position.copy(vector);
      }
      offsets.set(key, { dx: offset.dx, dy: offset.dy });
    }
    model.updateMatrixWorld(true);
    return { appliedKeys, rejected };
  }
  function applyPalette(value = {}) {
    live();
    const accepted = {}, rejected = [];
    for (const [category, color] of Object.entries(value || {})) {
      if (COLOR_KEYS.includes(category) && typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) accepted[category] = color;
      else rejected.push({ category, reason: '不支持的材质类别或颜色' });
    }
    for (const record of paletteRecords) {
      record.material.color.copy(record.color);
      if (own(accepted, record.category)) record.material.color.set(accepted[record.category]);
    }
    return { appliedCategories: [...new Set(paletteRecords.filter(r => own(accepted, r.category)).map(r => r.category))], rejected };
  }
  function getFurnitureStates() {
    live();
    model.updateMatrixWorld(true);
    return reg.rows.map(row => {
      const records = grouped.get(row.key) || [], mapped = records.length > 0, movable = eligible.has(row.key);
      const box = new THREE.Box3();
      for (const { mesh } of records) box.expandByObject(mesh);
      return { key: row.key, name: row.name, mapped, movable, meshCount: records.length,
        reason: movable ? '' : !isMovableFurniture(row.furniture) ? '固定、定制或不支持的家具' : !mapped ? '3D 无可靠映射，禁止仅移动平面图' : '模型家具归属有歧义，禁止移动',
        offset: { ...(offsets.get(row.key) || { dx: 0, dy: 0 }) },
        parts: records.map(({ mesh, index }) => ({ index, name: mesh.name, positionCm: mesh.getWorldPosition(new THREE.Vector3()).toArray().map(n => n * 100) })),
        boundsCm: box.isEmpty() ? null : { min: box.min.toArray().map(n => n * 100), max: box.max.toArray().map(n => n * 100) } };
    });
  }
  function keyForObject(object) {
    for (let p = object; p; p = p.parent) if (rows.has(p.userData?.editorFurnitureKey)) return p.userData.editorFurnitureKey;
    return null;
  }
  function getMaterialStates() {
    live();
    const seen = new Set(), result = [];
    for (const { mesh, original } of materialRecords) {
      const current = materials(mesh), originals = Array.isArray(original) ? original : [original];
      const meta = inherited(mesh);
      current.forEach((material, index) => {
        if (seen.has(material)) return;
        seen.add(material);
        const category = Array.isArray(original) ? meta.editorColorCategories?.[index] : meta.editorColorCategory;
        result.push({ name: material.name, category: category || null, protected: !category,
          color: material.color?.toArray() || null, baselineColor: originals[index]?.color?.toArray() || null,
          textureUuid: material.map?.uuid || null, baselineTextureUuid: originals[index]?.map?.uuid || null });
      });
    }
    return result;
  }
  function reset() { applyPositions({}); applyPalette({}); }
  function dispose() {
    if (disposed) return;
    reset();
    for (const { mesh, original } of materialRecords) mesh.material = original;
    for (const { material } of paletteRecords) material.dispose();
    disposed = true;
  }
  return { applyPositions, applyPalette, resetPositions: () => applyPositions({}), resetPalette: () => applyPalette({}),
    reset, dispose, getFurnitureStates, getMaterialStates, keyForObject, movableKeys: [...eligible] };
}
