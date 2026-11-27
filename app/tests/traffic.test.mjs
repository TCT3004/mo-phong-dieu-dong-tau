// Tàu khác chạy trên luồng và tránh va (traffic.js) trên vùng nước tổng hợp
import test from 'node:test';
import assert from 'node:assert/strict';
import { Traffic, TR_KINDS } from '../src/traffic.js';

const KN = 1852 / 3600, D2R = Math.PI / 180;
const SPECS = { xalan45: { name: 'Xà lan 45', L: 45, B: 9, T: 2.3 }, xalan60: { name: 'Xà lan 60', L: 60, B: 11.5, T: 2.9 }, ca18: { name: 'Tàu cá 18', L: 18, B: 5.4, T: 1.7 }, ca26: { name: 'Tàu cá 26', L: 26, B: 7, T: 2.4 }, hang50: { name: 'Tàu hàng 50', L: 50, B: 9.2, T: 3.3 } };
const open = { depth: () => 30, blocked: () => false, ready: () => true };
// luồng hẹp chạy Bắc – Nam: rộng 240 m (giữa sâu 8 m, mép 3 m), ngoài là bãi cạn 0,5 m
const chan = { depth: (x) => (Math.abs(x) < 120 ? 8 - 5 * (Math.abs(x) / 120) ** 2 : 0.5), blocked: () => false, ready: () => true };
const FAR = { x: 1e6, y: 1e6, psi: 0, gE: 0, gN: 0, L: 60, B: 9, still: true };
const ENV = { cE: 0, cN: 0, vis: 1e5 };

function add(T, kind, tpl, x, y, deg, to, kn) {
  const sp = SPECS[tpl], K = TR_KINDS[kind], v = { id: T.nextId++, kind, tpl, name: sp.name, L: sp.L, B: sp.B, T: sp.T, need: sp.T + K.ukc, pref: sp.T * K.pref, path: [[x, y], to], wi: 0,
    x, y, psi: deg * D2R, u: kn * KN, r: 0, kn, fishing: false, fishUntil: 0, av: null, think: 0, hornT: -999, fogT: 0, aground: false, hit: 0 };
  T.list.push(v); return v;
}
function run(T, sec, own = FAR, dt = 0.5, each) { for (let t = 0; t < sec; t += dt) { if (own.step) own.step(dt); T.step(dt, own, ENV); if (each) each(t); } }

test('đường đi trong luồng hẹp: không ra khỏi chỗ đủ sâu, đi lệch về mạn phải luồng', () => {
  const T = new Traffic(chan, SPECS, { seed: 3, density: 0 }), need = 2.3 + 1.2;
  const p = T.plan([0, -5000], [0, 5000], need, 2.3 * 2.2);
  assert.ok(p && p.length >= 2, 'tìm được đường');
  for (let k = 0; k + 1 < p.length; k++) for (let s = 0; s <= 20; s++) { const x = p[k][0] + (p[k + 1][0] - p[k][0]) * s / 20, y = p[k][1] + (p[k + 1][1] - p[k][1]) * s / 20; assert.ok(chan.depth(x, y) >= need, 'đủ sâu tại ' + x.toFixed(0)); }
  const mid = p.slice(1, -1); if (mid.length) assert.ok(mid.every((q) => q[0] > 0), 'đi về phía Bắc thì lệch sang phải (phía Đông)');
  assert.equal(T.plan([0, -5000], [600, 5000], need, 5), null, 'đích trên bãi cạn → không có đường');
});

test('đối hướng nơi nước rộng: cả hai sang phải, không va', () => {
  const T = new Traffic(open, SPECS, { seed: 1, density: 0 });
  const a = add(T, 'xalan', 'xalan45', 0, -2500, 0, [0, 6000], 7), b = add(T, 'hang', 'hang50', 0, 2500, 180, [0, -6000], 9);
  let dmin = 1e9, axMax = -1e9, bxMin = 1e9;
  run(T, 600, FAR, 0.5, () => { dmin = Math.min(dmin, Math.hypot(a.x - b.x, a.y - b.y)); axMax = Math.max(axMax, a.x); bxMin = Math.min(bxMin, b.x); });
  assert.ok(dmin > 0.35 * (45 + 50) + 10, 'không va (gần nhất ' + dmin.toFixed(0) + ' m)');
  assert.ok(axMax > 30, 'tàu đi lên Bắc né sang phải (Đông) ' + axMax.toFixed(0));
  assert.ok(bxMin < -30, 'tàu đi xuống Nam né sang phải (Tây) ' + bxMin.toFixed(0));
});

test('cắt hướng: tàu thấy tàu kia bên phải nhường (vòng ra sau lái), tàu được nhường giữ hướng', () => {
  const T = new Traffic(open, SPECS, { seed: 2, density: 0 });
  const a = add(T, 'hang', 'hang50', 0, -2200, 0, [0, 6000], 9), b = add(T, 'xalan', 'xalan45', 2200 * 7 / 9, 0, 270, [-6000, 0], 7);
  let dmin = 1e9, bDev = 0, aMaxRight = 0;
  run(T, 600, FAR, 0.5, () => { const d = Math.hypot(a.x - b.x, a.y - b.y); dmin = Math.min(dmin, d); if (b.x > 200) bDev = Math.max(bDev, Math.abs(b.y)); aMaxRight = Math.max(aMaxRight, a.x); });
  assert.ok(dmin > 0.35 * (50 + 45) + 10, 'không va (' + dmin.toFixed(0) + ' m)');
  assert.ok(aMaxRight > 40, 'tàu nhường đổi hướng sang phải ' + aMaxRight.toFixed(0));
  assert.ok(bDev < 40, 'tàu được nhường giữ hướng (lệch ' + bDev.toFixed(0) + ' m)');
});

test('gặp tàu mình đối hướng: tàu kia sang phải, giữ khoảng cách', () => {
  const T = new Traffic(open, SPECS, { seed: 4, density: 0 }), own = { x: 0, y: -1800, psi: 0, gE: 0, gN: 8 * KN, L: 60, B: 9, still: false, step(dt) { this.y += this.gN * dt; } };
  const v = add(T, 'xalan', 'xalan60', 0, 1800, 180, [0, -8000], 7); let dmin = 1e9, xMin = 1e9;
  run(T, 400, own, 0.5, () => { dmin = Math.min(dmin, Math.hypot(v.x - own.x, v.y - own.y)); xMin = Math.min(xMin, v.x); });
  assert.ok(xMin < -40, 'xà lan né sang phải (Tây) ' + xMin.toFixed(0)); assert.ok(dmin > 60, 'cách tàu mình ≥ 60 m (' + dmin.toFixed(0) + ')');
});

test('gặp nhau trong luồng hẹp: giữ bên phải luồng, giảm tốc nếu cần, không mắc cạn, không va', () => {
  const T = new Traffic(chan, SPECS, { seed: 5, density: 0 });
  const a = add(T, 'xalan', 'xalan45', 40, -2500, 0, [40, 6000], 6.5), b = add(T, 'xalan', 'xalan60', -40, 2500, 180, [-40, -6000], 7);
  let dmin = 1e9, ground = false;
  run(T, 1200, FAR, 0.5, () => { dmin = Math.min(dmin, Math.hypot(a.x - b.x, a.y - b.y)); for (const v of [a, b]) if (chan.depth(v.x, v.y) < v.T) ground = true; });
  assert.ok(!ground, 'không mắc cạn'); assert.ok(dmin > (9 + 11.5) / 2 + 15, 'không va (' + dmin.toFixed(0) + ' m)');
  assert.ok(a.y > 1000 && b.y < -1000, 'cả hai đi qua được nhau (' + a.y.toFixed(0) + ', ' + b.y.toFixed(0) + ')');
});

test('sinh tàu quanh tàu mình: đủ số tàu, không sát tàu mình, đi theo đường đã tìm', () => {
  const T = new Traffic(open, SPECS, { seed: 9, density: 2 }), own = { x: 0, y: 0, psi: 0, gE: 0, gN: 0, L: 60, B: 9, still: true };
  run(T, 30, own, 0.5);
  assert.equal(T.list.length, 6, 'giữ 6 tàu (mức Vừa)');
  for (const v of T.list) { assert.ok(Math.hypot(v.x, v.y) > 800, 'không sinh sát tàu mình'); assert.ok(v.path.length >= 2); assert.ok(TR_KINDS[v.kind]); }
  const snap = T.snapshot(); assert.equal(snap.length, 6); assert.equal(snap[0].length, 5);
  const T2 = new Traffic(open, SPECS, { seed: 9, density: 2, kinds: { xalan: true, ca: false, hang: false } }); run(T2, 30, own, 0.5);
  assert.ok(T2.list.every((v) => v.kind === 'xalan'), 'chỉ loại được chọn');
});
