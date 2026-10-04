// Regression guard for the 2026-10-04 partial measurement adoption.
// Surveyed existing geometry is not the same thing as the proposed renovations.
// This intentionally does NOT force contradictory room chains into a closed plan.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = new URL('../', import.meta.url);
const cwd = fileURLToPath(root);
const baseline = 'a29486a';
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const fromBaseline = path => JSON.parse(execFileSync('git', ['show', `${baseline}:${path}`], {cwd, encoding: 'utf8'}));
let checks = 0;
const same = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const ok = (condition, message) => { assert.ok(condition, message); checks++; };
const near = (actual, expected, message) => { assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-7, message || `${actual} != ${expected}`); checks++; };
const physicalOpening = opening => Object.fromEntries(
  ['kind', 'windowType', 'x1', 'y1', 'x2', 'y2', 'widthMm', 'sillCm', 'heightCm', 'operation', 'sliding', 'windowSystem']
    .filter(key => key in opening).map(key => [key, opening[key]])
);
const horizontalOpening = opening => [opening.x1, opening.y1, opening.x2, opening.y2, opening.widthMm];
const spanCm = opening => Math.hypot(opening.x2 - opening.x1, opening.y2 - opening.y1);
const center = opening => [(opening.x1 + opening.x2) / 2, (opening.y1 + opening.y2) / 2];
const roomGeometry = rooms => rooms.map(room => ({id: room.id, points: room.points}));
const wallPlan = walls => walls.map(wall => ({id: wall.id, coords: wall.coords, thicknessCm: wall.thicknessCm}));
const furnitureGeometry = furniture => furniture.map(item => Object.fromEntries(
  Object.entries(item).filter(([key]) => !['notes', 'name', 'source', 'grade', 'measurementStatus'].includes(key))
));
const openingIds = ['window_living_west', 'window_b', 'window_a', 'window_bath_1_east'];
const sourcePath = 'models/measurements-20261004.json';
const survey = await json(sourcePath);
const catalog = await json('models/design-schemes.json');
const active = catalog.schemes.filter(scheme => scheme.active !== false && scheme.status !== 'archived');
for (const id of ['wood', 'family', 'laundry']) ok(active.some(scheme => scheme.id === id), `${id} remains available`);

same(survey.date, '2026-10-04', 'Measurement source date');
same(survey.units, 'mm', 'Survey records use millimetres, not model centimetres');
same(survey.sourceName, '实测尺寸核对表.xlsx', 'The adoption column is traceable to the user workbook');
same(survey.sourceSha256, 'b7fc1dbf9f80ad81f17f111da7f741e36cc42ef6a9e0f35e6d97981ca74c4fb7', 'Workbook evidence fingerprint is retained');
same(survey.roomMapping, {'卧室1': 'room_c', '卧室2': 'room_b', '卧室3': 'room_a'}, 'Survey room IDs are mapped by adjacency, not mistaken for the model labels');
ok(/逆时针.*90/.test(survey.orientation), 'Survey quarter-turn orientation is explicit');
ok(/I列/.test(survey.adoptionRule) && /H列/.test(survey.adoptionRule), 'Adopted values are distinguished from raw conversion/calculation');
ok(/现状/.test(survey.sourceRole) && /不是改造/.test(survey.sourceRole), 'Existing measurements do not authorize a different renovation');
same(survey.records.length, 156, 'All workbook dimension rows are retained');
same(new Set(survey.records.map(record => record.id)).size, survey.records.length, 'Measurement IDs are unique');
const records = new Map(survey.records.map(record => [record.id, record]));
const measured = key => {
  const record = records.get(key);
  ok(record, `Evidence record ${key} exists`);
  ok(/^尺寸核对!I\d+$/.test(record.cell), `${key}: source points to the adoption column`);
  ok(/^尺寸核对!E\d+$/.test(record.rawCell), `${key}: original transcription remains separately traceable`);
  return record.adoptedMm;
};
for (const [key, value] of Object.entries({
  K01: 2610, K02: 2420, X_KITCHEN_DOOR: 1000,
  L02: 2120, L03: 2210, L04: 400, L05: 600, L09: 2310, L11: 4660, L12: 2700,
  B03: 1490, B05: 1240, U_B_OUT_W: 50, U_B_OUT_D: 150,
  B2_W_MAIN: 3080, B2_DEPTH_TOTAL: 3000, B2_ALCOVE_W: 1200, B2_ALCOVE_D: 860,
  B2_WINDOW_UPPER_OFFSET: 870, B2_WINDOW_LENGTH: 1760, B2_WINDOW_LOWER_OFFSET: 370,
  B2_WINDOW_HEIGHT: 1670, B2_WINDOW_SILL_HEIGHT: 400,
  B3_W_WALL_TO_WALL: 3090, B3_WINDOW_HEIGHT: 1660, B3_WINDOW_SILL_HEIGHT: 410,
  B3_WINDOW_CEILING_GAP: 720, B3_ROOM_HEIGHT: 2790,
  B3_BATH_INNER_WIDTH: 650, B3_BATH_HEIGHT: 1950, B3_BATH_OPENING_UNCLEAR: 750,
  S05: 500, C05: 940
})) near(measured(key), value, `${key}: adopted workbook value`);
// These deliberate disagreements are the regression cases: never fall back to H.
for (const [key, historical] of [['L03', 2270], ['L05', 690], ['L09', 2370], ['B2_WINDOW_SILL_HEIGHT', 800]]) {
  near(records.get(key).convertedOrCalculatedMm, historical, `${key}: historical conversion retained without overriding the adopted column`);
  ok(records.get(key).adoptedMm !== historical, `${key}: corrected adopted value remains distinct`);
}
for (const [key, unresolved] of [
  ['B1_DEPTH_TOTAL', 3030], ['B1_NOTCH_DEPTH', 980], ['B2_W_MAX', 4300],
  ['B3_DEPTH_INTERIOR_ARROW', 3500], ['B3_WINDOW_LENGTH', 2620], ['D_B3_WINDOW_CHAIN', 4350],
  ['S03', 1320], ['S04', 1530], ['S06', 1400], ['D_PUBLIC_DEPTH', 2350],
  ['D_CORRIDOR_LENGTH', 2980], ['D_LIVING_SOUTH', 7600], ['D_KITCHEN_ADJ_DIFF', 150]
]) {
  same(measured(key), null, `${key}: contradictory/conditional value has not become adopted measurement`);
  near(records.get(key).convertedOrCalculatedMm, unresolved, `${key}: unresolved evidence is not erased`);
}
for (const key of ['Q01', 'Q02', 'Q03', 'Q04', 'Q05', 'Q11', 'Q12', 'Q16', 'Q19', 'Q20', 'Q21']) {
  const issue = survey.issues.find(item => item.id === key);
  ok(issue && issue.status !== '已解决', `${key}: unresolved issue remains open`);
}

const results = [];
for (const id of ['wood', 'family', 'laundry']) {
  const path = `models/schemes/${id}/design-data.json`;
  const data = await json(path);
  const old = fromBaseline(path);
  const revision = data.measurementRevision;
  ok(revision && typeof revision === 'object', `${id}: partial measurement revision is recorded`);
  same(revision.date, '2026-10-04', `${id}: correct survey adoption date`);
  same(revision.stage, 'partial-confirmed', `${id}: not described as a completely measured model`);
  same(revision.source, sourcePath, `${id}: traceable common measurement record`);
  same(revision.oldEnvelope, true, `${id}: old outer envelope is explicitly retained`);
  ok(typeof revision.summary === 'string' && revision.summary.length > 10, `${id}: user-facing scope summary`);
  ok(Array.isArray(revision.applied) && revision.applied.length > 0, `${id}: applied changes are listed`);
  ok(Array.isArray(revision.pending) && revision.pending.length > 0, `${id}: unresolved dimensions are listed`);
  ok(revision.orientation, `${id}: rotated survey orientation is documented`);
  same(revision.orientation, survey.orientation, `${id}: shared coordinate interpretation`);
  same(revision.baseline, 'a29486aeb2085565c7269ad0888a818ac332d2dd', `${id}: exact immutable pre-measurement baseline`);
  same(data.layout.measured, false, `${id}: inherited redesign does not become fully surveyed`);
  const pending = JSON.stringify(revision.pending);
  for (const [pattern, reason] of [
    [/150mm/, 'cross-room closure discrepancy'], [/850mm/, 'master horizontal chain conflict'],
    [/40mm/, 'study room chain conflict'], [/30mm/, 'living room chain conflict'],
    [/10mm/, 'secondary window east return discrepancy'], [/1400/, 'ambiguous bathroom vertical notation'],
    [/50×150mm/, 'unlocated balcony projection'], [/940/, 'surveyed existing corridor distinct from redesign'],
    [/1700/, 'proposed kitchen opening remains a design'], [/750.*650.*1950/, 'door opening, leaf and ambiguous height are kept separate'],
    [/1240×1490/, 'balcony dimensions are rotated into the model correctly'], [/2420×2610/, 'kitchen dimensions are rotated into the model correctly']
  ]) ok(pattern.test(pending), `${id}: pending list preserves ${reason}`);
  for (const key of ['top', 'height', 'bottom', 'wall', 'offset', 'hallWidth']) {
    const anchor = data.anchors.find(item => item.id === key);
    ok(anchor && /旧/.test(anchor.grade), `${id}: unsurveyed global anchor ${key} is not labeled measured`);
  }

  // No arbitrary room scaling, kitchen narrowing, or silent wall-thickness repair.
  same(data.envelope, old.envelope, `${id}: unresolved global outer envelope preserved`);
  same(data.walls, old.walls, `${id}: wall centerlines preserved`);
  same(wallPlan(data.wallSpecs), wallPlan(old.wallSpecs), `${id}: wall centerlines and assumed thicknesses preserved`);
  same(roomGeometry(data.rooms), roomGeometry(old.rooms), `${id}: room floor polygons preserved pending chain closure`);
  same(furnitureGeometry(data.furniture), furnitureGeometry(old.furniture), `${id}: all designed furniture footprints and operation semantics preserved`);
  same(data.rooms.find(room => room.id === 'kitchen').points, old.rooms.find(room => room.id === 'kitchen').points, `${id}: kitchen is not falsely reconstructed from independently rotated dimensions`);
  same(data.rooms.find(room => room.id === 'balcony').points, old.rooms.find(room => room.id === 'balcony').points, `${id}: borrowed-floor proposal is not mislabeled as the measured 1490 by 1240 balcony`);
  near(data.rooms.find(room => room.id === 'room_a').heightCm, 279, `${id}: master room height reflects 410 + 1660 + 720 mm`);
  near(data.rooms.find(room => room.id === 'living').heightCm, 270, `${id}: living height is explicitly confirmed at 2700 mm`);
  for (const room of data.rooms.filter(room => !['room_a', 'living'].includes(room.id))) same(room.heightCm, old.rooms.find(previous => previous.id === room.id).heightCm, `${id}: unmeasured ${room.id} room height is not raised`);
  const commonRaised = [
    [[6, 6, 681, 6], [{fromCm: 319, toCm: 681, heightCm: 279}]],
    [[681, 6, 681, 960], [{fromCm: 6, toCm: 328, heightCm: 279}]]
  ];
  const expectedRaised = commonRaised.concat(id === 'wood' ? [
    [[319, 6, 319, 626], [{fromCm: 6, toCm: 328, heightCm: 279}]],
    [[319, 328, 681, 328], [{fromCm: 319, toCm: 681, heightCm: 279}]]
  ] : [
    [[319, 6, 319, 242], [{fromCm: 6, toCm: 242, heightCm: 279}]],
    [[275, 242, 380, 242], [{fromCm: 319, toCm: 380, heightCm: 279}]],
    [[380, 242, 380, 493], [{fromCm: 242, toCm: 493, heightCm: 279}]],
    [[465, 328, 465, 493], [{fromCm: 328, toCm: 493, heightCm: 279}]],
    [[465, 328, 681, 328], [{fromCm: 465, toCm: 681, heightCm: 279}]],
    [[380, 493, 681, 493], [{fromCm: 380, toCm: 465, heightCm: 279}]]
  ]);
  same(data.wallSpecs.filter(wall => wall.heightSegments).map(wall => [wall.coords, wall.heightSegments]), expectedRaised, `${id}: only walls bounding the master bedroom are raised, with shared-wall segments split`);
  for (const wall of data.wallSpecs) {
    near(wall.heightCm, old.wallSpecs.find(previous => previous.id === wall.id).heightCm, `${id}: ${wall.id} keeps its normal base height`);
    const axis = wall.coords[0] === wall.coords[2] ? 1 : 0;
    const lower = Math.min(wall.coords[axis], wall.coords[axis + 2]);
    const upper = Math.max(wall.coords[axis], wall.coords[axis + 2]);
    for (const segment of wall.heightSegments || []) ok(segment.fromCm >= lower && segment.toCm <= upper && segment.fromCm < segment.toCm, `${id}: raised segment remains inside ${wall.id}`);
  }

  const byId = key => data.windows.find(window => window.id === key);
  const oldById = key => old.windows.find(window => window.id === key);
  same(data.windows.map(window => window.id), old.windows.map(window => window.id), `${id}: no invented/removed windows`);
  for (const window of data.windows) {
    if (!openingIds.includes(window.id)) same(physicalOpening(window), physicalOpening(oldById(window.id)), `${id}: unmeasured opening ${window.id} retained`);
    near(spanCm(window) * 10, window.widthMm, `${id}: ${window.id} geometric span agrees with numeric width`);
  }

  const living = byId('window_living_west');
  near(living.widthMm, 2120, `${id}: living window measured width`);
  near(living.sillCm, 40, `${id}: living sill confirmed at 400 mm`);
  near(living.heightCm, 221, `${id}: living window height 2210 mm`);
  near(living.heightCm * 10, measured('L03'), `${id}: living geometry uses adopted I-column height, not historical H-column conversion`);
  near(living.bay.projectionCm, 60, `${id}: living bay confirmed projection 600 mm`);
  near(living.sillCm + living.heightCm, 261, `${id}: living window top 2610 mm`);
  near(living.x1, oldById(living.id).x1, `${id}: west window remains on its existing wall plane`);
  near(living.x2, oldById(living.id).x2, `${id}: west window remains on its existing wall plane`);

  const secondary = byId('window_b');
  near(secondary.widthMm, 1760, `${id}: secondary bedroom window width`);
  near(secondary.sillCm, 40, `${id}: secondary sill updated from provisional 430 mm`);
  near(secondary.sillCm * 10, measured('B2_WINDOW_SILL_HEIGHT'), `${id}: secondary sill uses adopted I-column value, not historical 800 mm`);
  near(secondary.heightCm, 167, `${id}: secondary window height`);
  near(secondary.x1, 99, `${id}: west inner face 12 cm plus measured 87 cm wall return`);
  near(secondary.x2, 275, `${id}: 176 cm opening from tentative retained west datum`);
  near(secondary.y1, oldById(secondary.id).y1, `${id}: secondary window north wall plane retained`);
  near(secondary.y2, oldById(secondary.id).y2, `${id}: secondary window north wall plane retained`);
  near(secondary.bay.projectionCm, oldById(secondary.id).bay.projectionCm, `${id}: secondary bay projection is not newly measured`);
  const secondaryFitout = data.bayFitouts.find(item => item.openingId === 'window_b');
  const oldSecondaryFitout = old.bayFitouts.find(item => item.openingId === 'window_b');
  same(secondaryFitout.parts.map(part => part.id), oldSecondaryFitout.parts.map(part => part.id), `${id}: secondary bay retains its original fitted items`);
  for (const part of secondaryFitout.parts) {
    const before = oldSecondaryFitout.parts.find(candidate => candidate.id === part.id);
    near(part.x, before.x + 9, `${id}: ${part.id} follows revised west window jamb by 90 mm`);
    near(part.zCm, before.zCm - 3, `${id}: ${part.id} follows 30 mm lower surveyed sill`);
    same([part.y, part.w, part.d, part.hCm], [before.y, before.w, before.d, before.hCm], `${id}: ${part.id} is not arbitrarily rescaled`);
    ok(part.x >= secondary.x1 && part.x + part.w <= secondary.x2, `${id}: ${part.id} lies within the revised bay width`);
  }
  const secondarySeat = secondaryFitout.parts.find(part => part.role === 'seat_cushion');
  near(secondarySeat.zCm + secondarySeat.hCm, 45, `${id}: secondary finished cushion surface is 450 mm`);

  const master = byId('window_a');
  same(horizontalOpening(master), horizontalOpening(oldById(master.id)), `${id}: conflicting 4350/3500 mm master window chain not forced into plan`);
  near(master.widthMm, 1500, `${id}: master window retains explicit provisional width`);
  near(master.sillCm, 41, `${id}: master sill measured 410 mm`);
  near(master.heightCm, 166, `${id}: master window measured height 1660 mm`);
  near(279 - master.sillCm - master.heightCm, 72, `${id}: measured master window-to-ceiling gap`);
  near(master.bay.projectionCm, oldById(master.id).bay.projectionCm, `${id}: master bay projection is not newly measured`);

  const bath = byId('window_bath_1_east');
  near(bath.widthMm, 500, `${id}: suite bathroom window width`);
  same(center(bath), center(oldById(bath.id)), `${id}: bathroom window position stays explicitly provisional`);
  near(bath.sillCm, oldById(bath.id).sillCm, `${id}: ambiguous height 1400 is not assigned to bathroom sill`);
  near(bath.heightCm, oldById(bath.id).heightCm, `${id}: ambiguous height 1400 is not assigned to bathroom window height`);

  same(data.doors.map(door => door.id), old.doors.map(door => door.id), `${id}: original design door count retained`);
  for (const door of data.doors) {
    const before = old.doors.find(candidate => candidate.id === door.id);
    same(horizontalOpening(door), horizontalOpening(before), `${id}: ${door.id} designed opening and plan position unchanged`);
    same(physicalOpening(door), physicalOpening(before), `${id}: ${door.id} is not silently overwritten by existing-door survey or ambiguous height reference`);
  }

  if (id !== 'wood') {
    same(data.laundry, old.laundry, `${id}: pending survey does not silently alter working laundry fitout`);
    const fit = data.bayFitouts.find(item => item.openingId === 'window_a');
    same(fit.type, 'bare_ledge', `${id}: no master office is reintroduced`);
    same(fit.parts, [], `${id}: no master office table/chair meshes are reintroduced`);
  } else {
    const fit = data.bayFitouts.find(item => item.openingId === 'window_a');
    same(fit.parts, old.bayFitouts.find(item => item.openingId === 'window_a').parts, 'wood: high desk remains an unchanged historical design, not silently lowered or adapted');
    ok(revision.pending.some(item => /高桌/.test(item.room) && /独立支撑/.test(item.reason)), 'wood: desk support incompatibility with the low surveyed sill is explicit');
  }
  results.push({scheme: id, stage: revision.stage, oldEnvelopeRetained: true, roomCount: data.rooms.length});
}

ok(survey && typeof survey === 'object', 'Machine-readable survey source is present');
console.log(JSON.stringify({passed: true, baseline, measurementSource: sourcePath, checks, schemes: results}, null, 2));
