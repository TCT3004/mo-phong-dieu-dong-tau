// Vẽ tàu từ sơ đồ: dò viền, tỷ lệ theo mốc + số đo, dựng mô hình 3D (mẫu tàu pháo chung chung)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { traceWand, traceBox, simplify } from '../src/shipdraw/trace.js';
import { calibrate, measure } from '../src/shipdraw/calib.js';
import { buildModel, polyArea, _prim } from '../src/shipdraw/model.js';
import { makeTemplate, TEMPLATE_SHIP } from '../src/shipdraw/template.js';
import { modelGroup } from '../src/shipdraw/mesh3.js';
import { resolve, PART_TREE } from '../src/shipdraw/parts.js';

// ảnh trắng có khung chữ nhật nét đen dày 2 (x 40..160, y 30..90) và một chữ L tô đen
function drawing(gap = false) {
  const w = 220, h = 140, d = new Uint8ClampedArray(w * h * 4).fill(255);
  const ink = (x, y) => { const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = 20; };
  for (let x = 40; x <= 160; x++) for (const y of [30, 31, 89, 90]) if (!(gap && y < 40 && x > 90 && x < 96)) ink(x, y);
  for (let y = 30; y <= 90; y++) for (const x of [40, 41, 159, 160]) ink(x, y);
  for (let y = 100; y < 130; y++) for (let x = 180; x < 190; x++) ink(x, y);
  for (let y = 120; y < 130; y++) for (let x = 190; x < 210; x++) ink(x, y);
  return { d, w, h };
}

test('đũa thần: bấm trong khung → đường bao sát mép nét vẽ; khung hở → báo tràn', () => {
  const { d, w, h } = drawing(), r = traceWand(d, w, h, 100, 60);
  assert.ok(!r.leak && r.pts.length >= 4 && r.pts.length <= 12, 'số điểm ' + r.pts.length);
  const A = polyArea(r.pts); assert.ok(Math.abs(A - 118 * 58) / (118 * 58) < 0.06, 'diện tích ' + A);
  const g = drawing(true), r2 = traceWand(g.d, g.w, g.h, 100, 60);
  assert.ok(r2.leak && !r2.pts.length);
  // đường nước xanh cắt ngang khung: mặc định vượt qua, tắt tùy chọn thì bị chặn
  for (let x = 20; x < 200; x++) { const i = (60 * w + x) * 4; d[i] = 0; d[i + 1] = 90; d[i + 2] = 200; } // vẽ đè cả lên viền đen hai bên
  assert.ok(Math.abs(polyArea(traceWand(d, w, h, 100, 45).pts) - 118 * 58) / (118 * 58) < 0.06);
  assert.ok(polyArea(traceWand(d, w, h, 100, 45, { skipColor: false }).pts) < 118 * 58 * 0.6);
});

test('đũa thần gộp vùng: hai nửa bị đường tâm chia đôi → một chi tiết', () => {
  const { d, w, h } = drawing(); for (let x = 42; x < 159; x++) { const i = (60 * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = 20; } // đường tâm đen
  const a = traceWand(d, w, h, 100, 45); assert.ok(polyArea(a.pts) < 118 * 58 * 0.6);
  const b = traceWand(d, w, h, 100, 75, { base: a.pts }); assert.ok(Math.abs(polyArea(b.pts) - 118 * 58) / (118 * 58) < 0.08, 'gộp ' + polyArea(b.pts));
});

test('dò trong khung: lấy bóng ngoài của nét vẽ, bỏ chi tiết nhỏ', () => {
  const { d, w, h } = drawing(), r = traceBox(d, w, h, [30, 20, 175, 100]);
  const A = polyArea(r.pts); assert.ok(Math.abs(A - 120 * 60) / (120 * 60) < 0.06, 'diện tích ' + A);
  const r2 = traceBox(d, w, h, [175, 95, 215, 135]); // chữ L
  assert.ok(Math.abs(polyArea(r2.pts) - (10 * 30 + 20 * 10)) < 90, 'chữ L ' + polyArea(r2.pts));
  assert.equal(simplify([[0, 0], [5, 0.2], [10, 0], [10, 10], [0, 10]], 1).length, 4);
});

test('tỷ lệ: theo LOA, số đo ngang + đứng sửa ảnh bị co méo, báo số đo vênh', () => {
  // hình mạn: mũi bên phải, 10 px/m ngang, 8 px/m đứng (ảnh bị bẹp)
  const v = { kind: 'side', refs: { stern: [100, 300], bow: [700, 300], base: [400, 300] }, dims: [] };
  let c = calibrate(v, { L: 60, B: 9 });
  assert.ok(c.ok && Math.abs(c.su - 0.1) < 1e-9 && Math.abs(c.toShip([700, 300])[0] - 30) < 1e-9);
  assert.ok(Math.abs(c.toShip([400, 220])[1] - 8) < 1e-9, 'chưa có số đo đứng: coi như cùng tỷ lệ');
  v.dims = [{ a: [400, 300], b: [400, 220], m: 10 }, { a: [200, 300], b: [500, 300], m: 30 }];
  c = calibrate(v, { L: 60, B: 9 });
  assert.ok(Math.abs(c.sv - 0.125) < 1e-6 && Math.abs(c.su - 0.1) < 1e-6, c.su + ' ' + c.sv);
  assert.ok(c.res.every((e) => Math.abs(e) < 0.01));
  v.dims.push({ a: [100, 300], b: [200, 300], m: 14 }); c = calibrate(v, { L: 60, B: 9 });
  assert.ok(Math.abs(c.res[2]) > 20, 'số đo vênh phải lộ ra: ' + c.res);
  // mũi bên trái → x vẫn dương về mũi, z vẫn dương lên trên
  const w2 = { kind: 'side', refs: { stern: [700, 300], bow: [100, 300], base: [400, 300] } }, c2 = calibrate(w2, { L: 60 });
  assert.ok(c2.toShip([100, 250])[0] > 29 && c2.toShip([100, 250])[1] > 4);
  // mặt boong, mũi bên phải: mạn phải ở dưới hình
  const t = calibrate({ kind: 'top', refs: { stern: [100, 200], bow: [700, 200] } }, { L: 60 });
  assert.ok(t.toShip([400, 240])[1] > 0);
  // nhìn từ mũi: bên trái hình là mạn phải
  const f = calibrate({ kind: 'front', refs: { left: [100, 300], right: [190, 300], base: [145, 300] } }, { B: 9 });
  assert.ok(f.toShip([110, 280])[0] > 0 && Math.abs(measure(f, [100, 300], [190, 300]) - 9) < 1e-9);
  const pp = c.toPx(c.toShip([321, 123])); assert.ok(Math.hypot(pp[0] - 321, pp[1] - 123) < 1e-6);
});

test('cây chi tiết: đường dẫn, nấc cuối có cách dựng', () => {
  const r = resolve(['den', 'man', 'T']); assert.ok(r.leaf && r.node.key === 'sideP' && r.names.join('/') === 'Đèn/Đèn mạn/Trái');
  assert.ok(!resolve(['den']).leaf);
  const leaves = []; const walk = (l) => { for (const n of l) n.kids ? walk(n.kids) : leaves.push(n); }; walk(PART_TREE);
  assert.ok(leaves.every((n) => n.role), 'nấc cuối nào cũng phải có role');
});

const ship = { L: TEMPLATE_SHIP.loa, B: TEMPLATE_SHIP.B, D: TEMPLATE_SHIP.D, T: (TEMPLATE_SHIP.tf + TEMPLATE_SHIP.ta) / 2, cb: TEMPLATE_SHIP.cb };
test('mẫu tàu pháo: dựng đủ thân, thượng tầng, đèn, mắt người điều động, diện tích hứng gió hợp lý', () => {
  const g = buildModel(makeTemplate(), ship);
  assert.equal(g.warn.length, 0, g.warn.join('; '));
  assert.ok(Math.abs(g.dims.L - 62) < 0.5 && Math.abs(g.dims.B - 9.5) < 0.3, JSON.stringify(g.dims));
  assert.ok(Math.abs(g.eye.x - 2.6) < 0.2 && Math.abs(g.eye.z - 11.7) < 0.2 && !g.eye.auto);
  const keys = new Set(g.lights.map((l) => l.key)); for (const k of ['sideP', 'sideS', 'mast1', 'stern', 'anchF', 'anchA', 'nuc']) assert.ok(keys.has(k), k);
  const sp = g.lights.find((l) => l.key === 'sideP'), ss = g.lights.find((l) => l.key === 'sideS'); assert.ok(sp.y < -3 && ss.y > 3);
  assert.equal(g.lights.filter((l) => l.key === 'nuc').length, 2);
  // diện tích mạn trên nước: thân ~ 62 m × mạn khô ~2,5 m + thượng tầng & cột → 230..420 m²
  assert.ok(g.areas.AL > 230 && g.areas.AL < 420, 'AL ' + g.areas.AL);
  assert.ok(g.areas.AF > 40 && g.areas.AF < 110, 'AF ' + g.areas.AF);
  assert.ok(g.areas.air > 17 && g.areas.air < 21, 'chiều cao tĩnh không ' + g.areas.air);
  assert.ok(g.items.length >= 5 && g.items.every((it) => it.idx.length % 3 === 0 && it.idx.every((k) => k < it.pos.length / 3)));
});

test('chi tiết giữa tàu chỉ vẽ nửa mạn trên mặt boong vẫn ra đủ bề rộng', () => {
  const m = makeTemplate(), top = m.views[1], c = calibrate(top, { L: 62 }), t1 = m.parts.find((p) => p.view === top.id && p.type.join('/') === 'tang/t1/khoi');
  t1.pts = [[-14, 0], [8.6, 0], [8.6, 3.6], [-14, 3.6]].map((q) => c.toPx(q)); // chỉ nửa mạn phải
  const g = buildModel(m, ship), full = buildModel(makeTemplate(), ship); assert.ok(Math.abs(g.areas.AF - full.areas.AF) < 2, g.areas.AF + ' / ' + full.areas.AF);
});

test('mặt boong nhiều mảnh, có chỗ hở: thân tàu vẫn đủ rộng và liền', () => {
  const m = makeTemplate(), top = m.views[1], c = calibrate(top, { L: 62 }), deck = m.parts.find((p) => p.view === top.id && p.type[1] === 'matboong');
  const half = [[-31, 3.9], [-24, 4.4], [-12, 4.75], [6, 4.75], [14, 4.3], [21, 3.4], [26, 2.2], [29.5, 0.9], [31, 0]];
  const piece = (x0, x1) => { const h = half.filter(([x]) => x >= x0 && x <= x1); return [...h, [h[h.length - 1][0], 0], [h[0][0], 0]]; };
  deck.pts = piece(-31, -12).map((q) => c.toPx(q)); m.parts.push({ ...deck, id: 'p2', pts: piece(6, 31).map((q) => c.toPx(q)) }); // hở từ -12 đến 6, chỉ nửa mạn phải
  const g = buildModel(m, ship); assert.ok(Math.abs(g.dims.B - 9.5) < 0.2, 'B ' + g.dims.B); assert.ok(Math.abs(g.hull.hb(-3) - 4.75) < 0.05, 'giữa chỗ hở ' + g.hull.hb(-3));
});

test('thiếu hình chiếu: chỉ có hình mạn vẫn dựng được (bề rộng theo B)', () => {
  const m = makeTemplate(), side = m.views[0]; m.views = [side]; m.parts = m.parts.filter((p) => p.view === side.id);
  const g = buildModel(m, ship); assert.ok(Math.abs(g.dims.B - 9.5) < 0.2, 'B ' + g.dims.B);
  assert.ok(g.areas.AL > 230 && g.areas.AF > 30);
  const empty = buildModel({ views: [], parts: [] }, ship); assert.ok(empty.items.length >= 2 && empty.eye.auto);
});

test('đổi sang three.js: mặt tam giác hướng ra ngoài, mũi về −Z, đường nước ở Y = 0', () => {
  const g = buildModel(makeTemplate(), ship), grp = modelGroup(THREE, g);
  const box = new THREE.Box3().setFromObject(grp); assert.ok(box.min.z < -30 && box.max.z > 30 && Math.abs(box.min.y + ship.T) < 0.05);
  // thân tàu: pháp tuyến các tam giác ở nửa mạn phải phải hướng sang +X
  const hull = grp.children[0].geometry, P = hull.attributes.position, I = hull.index ? hull.index.array : Array.from({ length: P.count }, (_, i) => i); let out = 0, tot = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < I.length; t += 3) { a.fromBufferAttribute(P, I[t]); b.fromBufferAttribute(P, I[t + 1]); c.fromBufferAttribute(P, I[t + 2]); const n = b.clone().sub(a).cross(c.clone().sub(a)); if (n.length() < 1e-6) continue; const cx = (a.x + b.x + c.x) / 3; if (cx > 1) { tot++; if (n.x > 0) out++; } }
  assert.ok(out / tot > 0.95, 'mạn phải hướng ra ngoài: ' + out + '/' + tot);
});

test('khối cơ bản: thể tích có dấu dương (mặt hướng ra ngoài) sau khi đổi sang three.js', () => {
  const { Acc, loft, tubeV, cyl, box, ellipsoid } = _prim, vol = (acc) => {
    const grp = modelGroup(THREE, { items: [acc], dims: { T: 0 } }), p = grp.children[0].geometry.attributes.position; let V = 0;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < p.count; i += 3) { a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2); V += a.dot(b.clone().cross(c)) / 6; }
    return V;
  };
  const mk = (f) => { const acc = new Acc(0xffffff, true); f(acc); return vol(acc); };
  const cases = {
    box: [mk((a) => box(a, 5, 2, 3, 2, 3, 4)), 24],
    loft: [mk((a) => loft(a, [{ x: 0, y0: -1, y1: 1, z0: 0, z1: 2 }, { x: 3, y0: -1, y1: 1, z0: 0, z1: 2 }])), 12],
    tubeV: [mk((a) => tubeV(a, [{ x: 1, y: 2, z: 0, r: 1 }, { x: 1, y: 2, z: 3, r: 1 }], 32)), 3 * Math.PI],
    cylX: [mk((a) => cyl(a, [0, 0, 1], [4, 0, 1], 0.5, 0.5, 32)), 4 * Math.PI * 0.25],
    cylY: [mk((a) => cyl(a, [3, -2, 1], [3, 2, 1], 0.5, 0.5, 32)), 4 * Math.PI * 0.25],
    cylZ: [mk((a) => cyl(a, [3, 1, 0], [3, 1, 2], 0.5, 0.5, 32)), 2 * Math.PI * 0.25],
    ell: [mk((a) => ellipsoid(a, [2, 1, 3], 2, 1, 1, 32, 16)), 4 / 3 * Math.PI * 2]
  };
  for (const [k, [v, want]] of Object.entries(cases)) assert.ok(v > 0 && Math.abs(v - want) / want < 0.08, k + ': ' + v.toFixed(3) + ' / ' + want.toFixed(3));
});
