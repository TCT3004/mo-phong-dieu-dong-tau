// Mô hình chuyển động: hiệu chỉnh tốc độ / quay trở, bước thời gian khi số liệu lạ, tỷ số hộp số, câu nhắc số liệu
import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultShip, buildModel, turningDiameter, sanity, KN } from '../src/physics.js';

// tàu nhỏ 3 máy 2 bánh lái, số liệu tự đặt (không phải tàu thật)
function small(o) {
  const p = Object.assign(defaultShip(), { loa: 50, lpp: 49, B: 9, D: 4.6, tf: 2.1, ta: 2.25, disp: 375, cb: 0.4, engines: 3, props: 3, propD: 1.4, rudMax: 25, rudTime: 13, rudders: 2, respTime: 3, AR: 1.8, hR: 2, turnDia: 250, gear: 2.8, rot: ['left', 'right', 'right'] }, o);
  p.steps = [{ id: 'f4', rpm: 1700, kn: 18, knB: 16 }, { id: 'f3', rpm: 1400, kn: 16, knB: 15 }, { id: 'f2', rpm: 1000, kn: 14, knB: 13 }, { id: 'f1', rpm: 800, kn: 12, knB: 10 }, { id: 'a1', rpm: -400 }, { id: 'a2', rpm: -600 }];
  return p;
}

test('tàu mẫu: quay trở khớp số nhập, không đổi so với trước', () => {
  const M = buildModel(defaultShip());
  assert.ok(Math.abs(turningDiameter(M) - 390) < 2);
  assert.ok(Math.abs(M.rCal - 0.3436) < 0.002, String(M.rCal));
  assert.equal(sanity(M).length, 0);
});

test('tàu nhỏ có hộp số: sức cản hợp lý, khớp đường kính quay trở', () => {
  const M = buildModel(small());
  const R = M.kR * (18 * KN) ** 2;
  assert.ok(R > 80e3 && R < 400e3, 'sức cản ' + R);
  assert.ok(Math.abs(turningDiameter(M) - 250) < 5);
  assert.equal(sanity(M).length, 0);
});

test('số liệu lạ (chân vịt 4,2 m, 1700 v/ph không hộp số, bánh lái 18 m²): không ra NaN, có câu nhắc', () => {
  const M = buildModel(small({ propD: 4.2, gear: 1, AR: 18 }));
  assert.ok(isFinite(turningDiameter(M)));
  const w = sanity(M).join(' ');
  assert.match(w, /Đường kính chân vịt/); assert.match(w, /Đầu cánh/); assert.match(w, /diện tích bánh lái/);
});

test('chiều quay từng chân vịt: 2 chân vịt quay ngược chiều cùng nấc thì lực ngang triệt tiêu, cùng chiều thì cộng', async () => {
  const { propRot, newState, stepShip } = await import('../src/physics.js');
  const run = (rot) => { const p = small({ engines: 2, props: 2, rudders: 2, rot }), M = buildModel(p, { noCal: true }), S = newState(M); S.n.fill(M.steps.a1.n); for (let i = 0; i < 300; i++) stepShip(S, M, { nT: [M.steps.a1.n, M.steps.a1.n], dT: 0 }, { h: 1e3 }, null, 0.1); return S.r; };
  assert.ok(Math.abs(run(['left', 'right'])) < 1e-6, 'quay ra ngoài, cùng lùi: không quay');
  assert.ok(Math.abs(run(['right', 'right'])) > 1e-4, 'cùng chiều: có quay');
  assert.deepEqual(propRot({ engines: 3, rotDir: 'left' }), ['', 'left', '']);
  assert.deepEqual(propRot({ engines: 2, rot: ['left'] }), ['left', '']);
  const w = sanity(buildModel(small({ engines: 2, props: 2, rot: ['left'] }))).join(' ');
  assert.match(w, /Chưa chọn chiều quay: Chân vịt phải/);
});
