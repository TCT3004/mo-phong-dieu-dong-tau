// Kho tàu: mỗi tàu mẫu dựng được mô hình 3D (khối kín, đủ đèn / buồng lái / cờ, các tầng chồng khít, chi tiết không lơ lửng),
// thông số tab 1 chạy được (quay trở khớp, không NaN)
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, templateShip, fleetTypes, SHIP_TYPES } from '../src/fleet.js';
import { buildModel as buildShipGeom } from '../src/shipdraw/model.js';
import { buildModel, turningDiameter, sanity, newState, stepShip } from '../src/physics.js';

test('13 tàu mẫu, đủ loại', () => {
  assert.equal(TEMPLATES.length, 13);
  for (const t of TEMPLATES) assert.ok(SHIP_TYPES.includes(t.type), t.name);
  assert.deepEqual(fleetTypes([{ type: 'Tàu cứu hộ' }]).slice(-2), ['Tàu cứu hộ', 'Khác']);
});

for (const t of TEMPLATES) test('mẫu ' + t.name, () => {
  const p = templateShip(t.id.slice(4));
  assert.ok(p.model && p.model.parts.length > 5, 'có mô hình');
  const T = (p.tf + p.ta) / 2; assert.ok(Math.abs(T - t.T) < 0.11, 'mớn nước ' + T + ' / ' + t.T); assert.ok(p.D > T, 'mạn khô dương');
  const g = buildShipGeom(p.model, { L: p.loa, B: p.B, D: p.D, T, cb: p.cb });
  let nTri = 0; for (const it of g.items) { assert.ok(it.pos.every(Number.isFinite), 'đỉnh hữu hạn'); nTri += it.idx.length / 3; }
  assert.ok(nTri > 500, 'tam giác ' + nTri);
  assert.ok(g.eye && g.bridge, 'buồng lái + mắt người điều động');
  assert.ok(g.lights && Object.keys(g.lights).length >= 3, 'đèn');
  assert.ok(g.flag, 'chỗ treo cờ');
  const bb = [Infinity, -Infinity]; for (const it of g.items) for (let i = 0; i < it.pos.length; i += 3) { bb[0] = Math.min(bb[0], it.pos[i]); bb[1] = Math.max(bb[1], it.pos[i]); }
  assert.ok(bb[1] - bb[0] < p.loa * 1.08 && bb[1] - bb[0] > p.loa * 0.9, 'dài ' + (bb[1] - bb[0]).toFixed(1));
  assert.ok(p.rot.every((r) => r === ''), 'chiều quay chân vịt để người dùng chọn');
  // tầng thượng tầng: chân mỗi khối nằm trên boong hoặc trên nóc một khối khác (không lơ lửng, không chìm)
  const H = g.hull, top = (x, y) => { const c = [H.zTop(Math.max(H.xa, Math.min(H.xf, x)))]; for (const s of g.solids) { if (x < s.x0 - 0.05 || x > s.x1 + 0.05) continue; const sl = s.slices.reduce((m, q) => (Math.abs(q.x - x) < Math.abs(m.x - x) ? q : m)); for (const r of sl.rings) { let a = Infinity, b = -Infinity, z = -Infinity; for (const q of r) { a = Math.min(a, q[0]); b = Math.max(b, q[0]); z = Math.max(z, q[1]); } if (y > a - 0.35 && y < b + 0.35) c.push(z); } } return c; };
  for (const s of g.solids) { if (s.role !== 'block' || !['tang', 'buong'].includes(s.cat)) continue; const xm = (s.x0 + s.x1) / 2, sup = top(xm, 0).filter((z) => z < s.z0 + 0.5); assert.ok(sup.some((z) => Math.abs(z - s.z0) < 0.5) || H.zTop(xm) > s.z0, `khối ${s.type.join('/')} ở x ${xm.toFixed(1)} chân ${s.z0.toFixed(2)} không nằm trên gì (${sup.map((z) => z.toFixed(2))})`); }
  const CHECK = new Set(['mast', 'latmast', 'dome', 'funnel', 'davit', 'crane', 'launcher', 'turret', 'chaff', 'raft', 'locker', 'vent', 'whip', 'searchlight', 'horn', 'windlass', 'bollard', 'hatch', 'staff', 'pipes', 'torpedo', 'ramp', 'breakwater', 'lashing']);
  for (const f of p.model.fits) { if (!CHECK.has(f.kind)) continue; const c = top(f.x, f.y); assert.ok(c.some((z) => Math.abs(z - f.z) < 0.45), `${f.kind} ở (${f.x.toFixed(1)}, ${f.y.toFixed(1)}) chân ${f.z.toFixed(2)} lơ lửng (mặt đỡ ${c.map((z) => z.toFixed(2))})`); }
  const M = buildModel(p), td = turningDiameter(M);
  assert.ok(isFinite(td) && Math.abs(td - p.turnDia) / p.turnDia < 0.08, 'quay trở ' + td + ' / ' + p.turnDia);
  assert.deepEqual(sanity(M).filter((s) => !/chiều quay/i.test(s)), [], 'không có câu nhắc số liệu lạ');
  const S = newState(M); for (let i = 0; i < 1200; i++) stepShip(S, M, { nT: S.n.map(() => M.steps.f4.n), dT: M.rudMax }, { h: 1e3 }, null, 0.1);
  assert.ok([S.x, S.y, S.u, S.v, S.r].every(Number.isFinite), 'không NaN khi quay trở');
});
