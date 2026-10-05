// Shared kitchen regression: source geometry by default; add --glb to inspect
// exported world-space vertices. Read-only, no browser or Blender invocation.
// Clearances are conditional model geometry, not an installation certificate.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as THREE from '../vendor/three/three.module.js';

const root = new URL('../', import.meta.url), cwd = fileURLToPath(root);
const baseline = '92162a8', schemes = ['wood', 'family', 'laundry'];
const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const old = path => JSON.parse(execFileSync('git', ['show', `${baseline}:${path}`], {cwd, encoding:'utf8', maxBuffer:20 * 1024 * 1024}));
const near = (actual, expected, label, tolerance = 1e-6) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected}`);
const rect = value => ['x', 'y', 'w', 'd'].map(key => value[key]);
const height = value => value.heightCm ?? value.hCm;
const overlap = (a, b) => Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) + 1e-6 && Math.min(a.y + a.d, b.y + b.d) > Math.max(a.y, b.y) + 1e-6;
const overlap3 = (a, b) => overlap(a, b) && Math.min((a.zCm ?? 0) + height(a), (b.zCm ?? 0) + height(b)) > Math.max(a.zCm ?? 0, b.zCm ?? 0) + 1e-6;
const inside = (inner, outer, tolerance = 1e-6) => inner.x >= outer.x - tolerance && inner.y >= outer.y - tolerance && inner.x + inner.w <= outer.x + outer.w + tolerance && inner.y + inner.d <= outer.y + outer.d + tolerance;
const adjoining = (a, b) => ((Math.abs(a.x + a.w - b.x) < 1e-6 || Math.abs(b.x + b.w - a.x) < 1e-6) && Math.min(a.y + a.d, b.y + b.d) > Math.max(a.y, b.y) + 1e-6) || ((Math.abs(a.y + a.d - b.y) < 1e-6 || Math.abs(b.y + b.d - a.y) < 1e-6) && Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) + 1e-6);
const validRect = (value, label) => {
  for (const key of ['x', 'y', 'w', 'd']) assert.ok(Number.isFinite(value[key]), `${label}: finite ${key}`);
  assert.ok(value.w > 0 && value.d > 0, `${label}: positive footprint`);
};
const oldKitchenNames = new Set(['厨房南侧地柜', '厨房北侧地柜', '冰箱高柜', '蒸烤高柜']);
const outsideKitchen = furniture => furniture.filter(f => !oldKitchenNames.has(f.name) && !f.kitchenFitoutId && !f.id?.startsWith('kitchen_'));

function checkPreserved(data, previous, scheme) {
  const woodRevision=scheme==='wood'&&data.woodRevision?.version==='3.9.0';
  // V3.9 replaces specific scheme-one furnishing/floor groups. Their complete
  // independent source/native guard runs below; kitchen and architecture stay
  // under this original guard, rather than exempting the whole scheme.
  const laterWoodGroups=new Set(['rooms','walls','wallSpecs','doors','bayFitouts','wallFitouts','laundry','appearance','measurementRevision']);
  for (const key of ['unit', 'envelope', 'rooms', 'walls', 'wallSpecs', 'doors', 'windows', 'bayFitouts', 'wallFitouts', 'storageFitouts', 'laundry', 'garage', 'modelAddons', 'appearance', 'purchasedFurnitureRevision', 'measurementRevision']) {
    if(woodRevision&&laterWoodGroups.has(key))continue;
    if(woodRevision&&key==='modelAddons'){
      assert.deepEqual(data.modelAddons,{...(previous.modelAddons??{}),livingFloorLampCm:{x:648,y:810}},'wood: only exact reviewed floor-lamp translation');continue;
    }
    assert.deepEqual(data[key], previous[key], `${scheme}: ${key} unchanged from ${baseline}`);
  }
  if(!woodRevision)assert.deepEqual(outsideKitchen(data.furniture), outsideKitchen(previous.furniture), `${scheme}: every non-kitchen furniture record unchanged`);
  const purchased = source => source.furniture.filter(f => f.purchasedProductId);
  assert.equal(purchased(data).length, 6, `${scheme}: purchased sofa, table and all four chairs remain`);
  const expectedPurchased=structuredClone(purchased(previous));
  if(woodRevision){
    const sofa=expectedPurchased.find(f=>f.name==='三人沙发');
    sofa.x-=20;sofa.y-=45;sofa.rugCm.x-=20;sofa.rugCm.y-=45;
  }
  assert.deepEqual(purchased(data), expectedPurchased, `${scheme}: exact purchased products; only reviewed wood sofa/rug translation allowed`);
  for (const item of data.furniture.filter(f => f.id?.startsWith('kitchen_') || f.kitchenFitoutId)) {
    assert.equal(item.kitchenFitoutId, data.kitchenFitout.id, `${scheme}/${item.id}: kitchen aggregate refers to the shared fitout`);
  }
  assert.ok(!data.furniture.some(f => oldKitchenNames.has(f.name) && !f.kitchenFitoutId), `${scheme}: legacy kitchen generators are not retained alongside the new fitout`);
}

function checkLayout(data, scheme) {
  const fit = data.kitchenFitout, label = `${scheme}/kitchen`;
  assert.ok(fit, `${label}: explicit shared kitchen fitout exists`);
  assert.equal(fit.id, 'kitchen-20261005');
  assert.equal(fit.version, '3.8.0');
  assert.equal(fit.roomId, 'kitchen');
  assert.deepEqual([fit.localEnvelope.w, fit.localEnvelope.d], [242, 261], `${label}: conservative surveyed local envelope`);
  assert.deepEqual(rect(fit.modelEnvelope), [542, 1127, 287, 262], `${label}: old whole-house envelope explicitly retained`);
  assert.deepEqual([fit.adjustmentBand.x, fit.adjustmentBand.w], [694, 45], `${label}: extra old-model width is an adjustment band`);
  const model = fit.modelEnvelope, localFrame = {x:0, y:0, ...fit.localEnvelope};
  const band = {...fit.adjustmentBand, y:model.y, d:model.d};
  assert.ok(Array.isArray(fit.parts) && fit.parts.length, `${label}: physical cabinet/structural parts exist`);
  assert.ok(Array.isArray(fit.appliances), `${label}: explicit appliances exist`);
  assert.ok(Array.isArray(fit.countertops) && fit.countertops.length, `${label}: explicit countertops exist`);
  assert.ok(Array.isArray(fit.conditions) && fit.conditions.length, `${label}: unresolved installation conditions retained`);
  const ids = fit.parts.concat(fit.appliances, fit.countertops).map(p => p.id);
  assert.ok(ids.every(id => typeof id === 'string' && id.length > 0), `${label}: every element has an ID`);
  assert.equal(new Set(ids).size, ids.length, `${label}: element IDs are unique`);
  for (const element of fit.parts.concat(fit.appliances, fit.countertops)) {
    validRect(element, `${label}/${element.id}`);
    assert.ok(inside(element, model), `${label}/${element.id}: footprint within retained kitchen walls`);
    assert.ok(Number.isFinite(element.zCm) && element.zCm >= 0, `${label}/${element.id}: explicit nonnegative elevation`);
    assert.ok(Number.isFinite(height(element)) && height(element) > 0, `${label}/${element.id}: positive explicit height`);
  }
  const one = type => {
    const found = fit.appliances.filter(a => a.type === type);
    assert.equal(found.length, 1, `${label}: exactly one ${type}`);
    return found[0];
  };
  const fridge = one('fridge'), dishwasher = one('dishwasher'), sink = one('doubleSink'), hob = one('gasHob'), heater = one('waterHeater');
  const hood = one('hood');
  for (const [appliance, width, depth, high, face] of [
    [fridge, 65, 60, 190, 'south'], [dishwasher, 60, 60, 80.5, 'south'],
    [heater, 20.5, 33, 53, 'west']
  ]) {
    near(appliance.w, width, `${label}/${appliance.id}: actual oriented width`);
    near(appliance.d, depth, `${label}/${appliance.id}: actual oriented depth`);
    near(appliance.heightCm, high, `${label}/${appliance.id}: actual body height`);
    assert.equal(appliance.face, face, `${label}/${appliance.id}: working face`);
  }
  assert.deepEqual([sink.w, sink.d], [45, 78], `${label}: double sink 78 cm along east wall, 45 cm deep`);
  for (const appliance of fit.appliances) {
    validRect(appliance.local, `${label}/${appliance.id}/local`);
    assert.ok(inside(appliance.local, localFrame), `${label}/${appliance.id}: fits 242 x 261 local envelope`);
    near(appliance.local.w, appliance.w, `${label}/${appliance.id}: appliance width is not compressed into the local frame`);
    near(appliance.local.d, appliance.d, `${label}/${appliance.id}: appliance depth is not compressed into the local frame`);
    assert.ok(!overlap(appliance, band), `${label}/${appliance.id}: fixed appliance does not consume the 45 cm adjustment band`);
    const shift = appliance.x >= band.x + band.w - 1e-6 ? band.w : 0;
    near(appliance.x, model.x + appliance.local.x + shift, `${label}/${appliance.id}: local/model east-west mapping`);
    const deltaY = appliance.y - model.y - appliance.local.y;
    assert.ok(Math.abs(deltaY) <= 1e-6 || Math.abs(deltaY - 1) <= 1e-6, `${label}/${appliance.id}: only 1 cm old-model south closure permitted`);
  }
  const shaftParts = fit.parts.filter(p => p.role === 'shaft');
  assert.equal(shaftParts.length, 1, `${label}: one explicit solid chimney shaft`);
  const shaft = shaftParts[0];
  assert.deepEqual(rect(shaft), [542, 1329, 60, 60], `${label}: southwest shaft reserved, not converted into cabinetry`);
  assert.ok(height(shaft) >= 240 && shaft.zCm === 0, `${label}: shaft is full-height architecture`);
  const localShaft = {x:0, y:201, w:60, d:60};
  assert.deepEqual(rect(fit.localShaft), rect(localShaft), `${label}: same provisional shaft in the smaller local frame`);
  assert.ok(Array.isArray(fit.localCountertops) && fit.localCountertops.length === 3, `${label}: three measured-frame countertop runs`);
  for (const [i, top] of fit.localCountertops.entries()) {
    validRect(top, `${label}/local countertop ${i}`);
    assert.ok(inside(top, localFrame), `${label}: local countertop ${i} fits measured frame`);
    assert.ok(!overlap(top, localShaft), `${label}: local countertop ${i} leaves shaft unavailable`);
    for (const other of fit.localCountertops.slice(i + 1)) assert.ok(!overlap(top, other), `${label}: no double-counted local countertop corners`);
  }
  const northTop = fit.localCountertops.find(top => top.y === 0);
  const southTop = fit.localCountertops.find(top => Math.abs(top.y + top.d - localFrame.d) < 1e-6);
  assert.ok(northTop && southTop, `${label}: north and south local runs exist`);
  near(southTop.y - northTop.y - northTop.d, 131, `${label}: closed-door north-south aisle in the measured frame`);
  assert.ok(!fit.localCountertops.some(top => overlap(top, fridge.local)), `${label}: local countertop does not occupy refrigerator footprint`);
  for (const appliance of [dishwasher, sink, hob]) {
    assert.equal(fit.localCountertops.filter(top => inside(appliance.local, top)).length, 1, `${label}/${appliance.id}: supported by exactly one local counter run`);
  }
  for (const appliance of fit.appliances) {
    assert.ok(!overlap(appliance, shaft), `${label}/${appliance.id}: no equipment footprint enters the shaft`);
    assert.ok(!overlap(appliance.local, localShaft), `${label}/${appliance.id}: no shaft conflict in the smaller measured frame`);
  }
  // A hood belongs above its hob; a faucet belongs at its sink. These pairs
  // may share a plan footprint, but solid 3D appliance envelopes may not clash.
  for (let i = 0; i < fit.appliances.length; i++) for (let j = i + 1; j < fit.appliances.length; j++) {
    const a = fit.appliances[i], b = fit.appliances[j];
    assert.ok(!overlap3(a, b), `${label}: non-overlapping appliance bodies ${a.id}/${b.id}`);
    assert.ok(!overlap3({...a, ...a.local}, {...b, ...b.local}), `${label}: non-overlapping local bodies ${a.id}/${b.id}`);
  }
  assert.ok(fridge.local.x <= 10 && fridge.local.y <= 5 && fridge.local.x + fridge.local.w <= 80, `${label}: refrigerator in northwest corner`);
  assert.ok(dishwasher.local.y <= 5 && dishwasher.local.x > fridge.local.x + fridge.local.w, `${label}: independent dishwasher bay on north run`);
  assert.ok(sink.local.x >= localFrame.w - 65 && sink.face === 'west', `${label}: east-wall double sink faces the room`);
  assert.ok(hob.local.y >= localFrame.d - 65 && hob.local.x >= 60 && hob.face === 'north', `${label}: south-wall hob beside shaft`);
  assert.ok(heater.local.x + heater.local.w >= localFrame.w - 1e-6 && heater.local.y + heater.local.d <= 78, `${label}: heater occupies north end of east wall`);
  assert.ok(overlap(hob, hood) && hood.zCm > hob.zCm + hob.heightCm, `${label}: hood aligned above hob`);
  for (const target of [sink, hob]) {
    assert.ok(!overlap(dishwasher, target), `${label}: dishwasher is not under ${target.type}`);
    assert.ok(!overlap(dishwasher.local, target.local), `${label}: smaller frame retains independent dishwasher position`);
  }
  const cavity = fit.dishwasherCavity;
  assert.ok(cavity, `${label}: installation cavity separate from appliance dimensions`);
  assert.deepEqual(rect(cavity), [626, 1127, 62, 65], `${label}: 62 x 65 cm installation cavity`);
  near(cavity.clearHeightCm, 86, `${label}: cavity clear height`);
  assert.ok(inside(dishwasher, cavity), `${label}: machine fits cavity including rear service allowance`);
  near(cavity.w - dishwasher.w, 2, `${label}: total lateral cavity allowance`);
  near(cavity.d - dishwasher.d, 5, `${label}: total depth allowance`);
  near(cavity.clearHeightCm - dishwasher.heightCm, 5.5, `${label}: head allowance distinct from machine height`);
  near(dishwasher.zCm, 0, `${label}: dishwasher stands on finished floor`);
  const cavityVolume = {...cavity, zCm:0, hCm:cavity.clearHeightCm};
  for (const part of fit.parts) {
    assert.ok(!overlap3(part, cavityVolume), `${label}/${part.id}: no solid cabinet, plinth or backboard fills dishwasher cavity`);
    if (part !== shaft) assert.ok(!overlap3(part, shaft), `${label}/${part.id}: cabinetry does not occupy chimney shaft`);
    if (/upper|wall.?cabinet|吊柜/i.test(part.role)) assert.ok(!overlap3(part, heater), `${label}/${part.id}: no cupboard encloses visible heater`);
  }
  for (const [i, top] of fit.countertops.entries()) {
    assert.ok(!overlap(top, shaft), `${label}/${top.id}: no worktop covers the reserved chimney`);
    for (const other of fit.countertops.slice(i + 1)) assert.ok(!overlap(top, other), `${label}: no overlapping countertop solids ${top.id}/${other.id}`);
  }
  const connectedTops = new Set([fit.countertops[0]]);
  for (let pass = 0; pass < fit.countertops.length; pass++) for (const top of fit.countertops) {
    if ([...connectedTops].some(other => adjoining(top, other) && Math.abs(top.zCm + height(top) - other.zCm - height(other)) < 1e-6)) connectedTops.add(top);
  }
  assert.equal(connectedTops.size, fit.countertops.length, `${label}: continuous level U-shaped countertop, with no gaps between runs`);
  const dishwasherTop = fit.countertops.filter(top => inside(dishwasher, top));
  assert.equal(dishwasherTop.length, 1, `${label}: one independently supported countertop above dishwasher`);
  near(dishwasherTop[0].zCm, cavity.clearHeightCm, `${label}: countertop underside matches clear cavity height`);
  assert.ok(dishwasherTop[0].zCm + height(dishwasherTop[0]) > dishwasher.heightCm, `${label}: countertop height is not confused with machine height`);
  const allCutouts = fit.countertops.flatMap(top => (top.cutouts ?? []).map(cut => ({top, cut})));
  for (const appliance of [sink, hob]) {
    const center = {x:appliance.x + appliance.w / 2, y:appliance.y + appliance.d / 2, w:0, d:0};
    const matches = allCutouts.filter(({cut}) => inside(center, cut));
    assert.equal(matches.length, 1, `${label}/${appliance.id}: one real countertop cutout under appliance`);
    validRect(matches[0].cut, `${label}/${appliance.id}: cutout`);
    assert.ok(inside(matches[0].cut, matches[0].top), `${label}/${appliance.id}: hole remains inside its countertop`);
    assert.ok(inside(matches[0].cut, appliance), `${label}/${appliance.id}: cutout does not exceed appliance rim`);
  }
  const conditions = JSON.stringify(fit.conditions);
  assert.match(conditions, /烟道/, `${label}: unknown shaft size disclosed`);
  assert.match(conditions, /待|暂|复尺|未测/, `${label}: conditional dimensions not promoted to surveyed values`);
  assert.match(conditions, /45|450/, `${label}: model-width surplus disclosed`);
  assert.match(conditions, /冰箱/, `${label}: refrigerator-door condition disclosed`);
  assert.match(conditions, /热水器/, `${label}: independent heater condition disclosed`);
  return {fit, shaft, fridge, dishwasher, sink, hob, heater};
}

function decodeGlb(bytes) {
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF', 'Valid GLB header');
  assert.equal(bytes.readUInt32LE(4), 2, 'GLB version 2');
  assert.equal(bytes.readUInt32LE(8), bytes.length, 'Complete GLB file');
  let g, bin;
  for (let at = 12; at < bytes.length;) {
    const length = bytes.readUInt32LE(at), type = bytes.readUInt32LE(at + 4), chunk = bytes.subarray(at + 8, at + 8 + length);
    if (type === 0x4e4f534a) g = JSON.parse(chunk.toString('utf8'));
    if (type === 0x004e4942) bin = chunk;
    at += 8 + length;
  }
  assert.ok(g && bin, 'JSON and binary GLB chunks');
  const parents = new Map(), matrices = new Map();
  g.nodes.forEach((node, i) => (node.children ?? []).forEach(child => parents.set(child, i)));
  const matrix = i => {
    if (matrices.has(i)) return matrices.get(i);
    const node = g.nodes[i], result = new THREE.Matrix4();
    if (node.matrix) result.fromArray(node.matrix);
    else result.compose(new THREE.Vector3(...(node.translation ?? [0,0,0])), new THREE.Quaternion(...(node.rotation ?? [0,0,0,1])), new THREE.Vector3(...(node.scale ?? [1,1,1])));
    if (parents.has(i)) result.premultiply(matrix(parents.get(i)));
    matrices.set(i, result);
    return result;
  };
  return g.nodes.flatMap((node, index) => {
    if (node.mesh === undefined) return [];
    const meta = {}, bounds = new THREE.Box3();
    for (let i = index; i !== undefined; i = parents.get(i)) for (const [key, value] of Object.entries(g.nodes[i].extras ?? {})) if (meta[key] === undefined) meta[key] = value;
    let vertexCount = 0;
    for (const primitive of g.meshes[node.mesh].primitives) {
      const accessor = g.accessors[primitive.attributes.POSITION], view = g.bufferViews[accessor.bufferView];
      assert.equal(accessor.componentType, 5126, `${node.name}: float positions`);
      assert.equal(accessor.type, 'VEC3', `${node.name}: three-dimensional positions`);
      assert.ok(!accessor.sparse, `${node.name}: sparse positions not silently ignored`);
      const offset = (accessor.byteOffset ?? 0) + (view.byteOffset ?? 0), stride = view.byteStride ?? 12;
      for (let k = 0; k < accessor.count; k++) {
        const at = offset + k * stride;
        bounds.expandByPoint(new THREE.Vector3(bin.readFloatLE(at), bin.readFloatLE(at + 4), bin.readFloatLE(at + 8)).applyMatrix4(matrix(index)));
      }
      vertexCount += accessor.count;
    }
    assert.ok(vertexCount > 0, `${node.name}: actual vertices present`);
    return [{name:node.name, meta, bounds, vertexCount}];
  });
}

const union = meshes => meshes.reduce((bounds, mesh) => bounds.union(mesh.bounds), new THREE.Box3());
function exactBounds(meshes, source, label, tolerance = .001) {
  assert.ok(meshes.length, `${label}: tagged actual meshes exist`);
  const bounds = union(meshes), z = source.zCm ?? 0;
  const expected = [source.x / 100, z / 100, source.y / 100, (source.x + source.w) / 100, (z + height(source)) / 100, (source.y + source.d) / 100];
  [...bounds.min.toArray(), ...bounds.max.toArray()].forEach((value, axis) => near(value, expected[axis], `${label}: world-space bound ${axis}`, tolerance));
}

async function checkGlb(data, checked, scheme, catalog) {
  const entry = catalog.schemes.find(s => s.id === scheme);
  assert.ok(entry?.model, `${scheme}: catalog exposes actual GLB path`);
  const meshes = decodeGlb(await readFile(new URL(entry.model, root))), fit = checked.fit;
  const kitchen = meshes.filter(m => m.meta.kitchenFitoutId === fit.id);
  assert.ok(kitchen.length >= fit.appliances.length + fit.parts.length, `${scheme}: detailed shared kitchen mesh collection exists`);
  for (const appliance of [checked.fridge, checked.dishwasher, checked.sink, checked.hob, checked.heater]) {
    exactBounds(kitchen.filter(m => m.meta.kitchenApplianceId === appliance.id), appliance, `${scheme}/${appliance.id}`);
  }
  exactBounds(kitchen.filter(m => m.meta.kitchenPartId === checked.shaft.id), checked.shaft, `${scheme}: full-height shaft`);
  for (const part of fit.parts) exactBounds(kitchen.filter(m => m.meta.kitchenPartId === part.id), part, `${scheme}/${part.id}: actual cabinet/structural board`);
  for (const top of fit.countertops) exactBounds(kitchen.filter(m => m.meta.kitchenPartId === top.id), top, `${scheme}/${top.id}: actual countertop extent`);
  for (const item of data.furniture.filter(f => f.purchasedProductId)) {
    exactBounds(meshes.filter(m => m.meta.purchasedProductId === item.purchasedProductId && m.meta.furnitureName === item.name && !/rug/i.test(m.name)), item, `${scheme}: unchanged purchased ${item.name}`);
  }
  assert.ok(!meshes.some(m => oldKitchenNames.has(m.meta.furnitureName) && m.meta.kitchenFitoutId !== fit.id), `${scheme}: no legacy kitchen appliance/counter duplicates in GLB`);
  return {meshes:kitchen.length, actualVertexCount:kitchen.reduce((sum, m) => sum + m.vertexCount, 0)};
}

const catalog = process.argv.includes('--glb') ? await read('models/design-schemes.json') : null;
const reports = [];
let commonFitout;
for (const scheme of schemes) {
  const path = `models/schemes/${scheme}/design-data.json`, data = await read(path), previous = old(path);
  const checked = checkLayout(data, scheme);
  checkPreserved(data, previous, scheme);
  assert.equal(checked.fit.render, `assets/schemes/${scheme}/kitchen-north.jpg`, `${scheme}: own-layout reverse kitchen view`);
  const {render:ownRender,...sharedFit}=checked.fit;
  if (commonFitout) assert.deepEqual(sharedFit, commonFitout, `${scheme}: exactly the same shared kitchen geometry across all three layouts`);
  else commonFitout = sharedFit;
  const result = {scheme, appliances:checked.fit.appliances.length, fixedParts:checked.fit.parts.length, localEnvelopeCm:[242,261], preservedBaseline:baseline};
  if (catalog) result.glb = await checkGlb(data, checked, scheme, catalog);
  reports.push(result);
}
if((await read('models/schemes/wood/design-data.json')).woodRevision?.version==='3.9.0')await import('./test_wood_revision.mjs');
console.log(JSON.stringify({passed:true, scope:'conditional kitchen geometry; product installation and door operation remain subject to real models and survey', reports}, null, 2));
