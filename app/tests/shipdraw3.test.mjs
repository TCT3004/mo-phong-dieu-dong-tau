// Dựng 3D giao 3 hình chiếu: hình nhìn từ mũi cắt theo hình mạn + mặt boong; ghép hình chiếu theo vị trí
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { calibrate } from '../src/shipdraw/calib.js';
import { buildModel, loftRings, _prim } from '../src/shipdraw/model.js';
import { modelGroup } from '../src/shipdraw/mesh3.js';

const ship = { L: 60, B: 10, D: 5, T: 2.5, cb: 0.5 };
const PX = 20, M = 100;
function views() {
  const w = ship.L * PX + 2 * M, h = 300;
  const side = { id: 'vs', kind: 'side', name: 'mạn', refs: { stern: [M, h - M], bow: [M + ship.L * PX, h - M], base: [w / 2, h - M] }, dims: [] };
  const top = { id: 'vt', kind: 'top', name: 'boong', refs: { stern: [M, 200], bow: [M + ship.L * PX, 200] }, dims: [] };
  const fw = ship.B * 2 * PX, front = { id: 'vf', kind: 'front', name: 'mũi', refs: { left: [400 - ship.B / 2 * PX, 300], right: [400 + ship.B / 2 * PX, 300], base: [400, 300] }, dims: [] };
  return [side, top, front];
}
const px = (v, pts) => { const c = calibrate(v, ship); return pts.map((q) => c.toPx(q)); };
const verts = (g) => { const out = []; for (const it of g.items) for (let i = 0; i < it.pos.length; i += 3) out.push([it.pos[i], it.pos[i + 1], it.pos[i + 2]]); return out; };
function signedVol(acc) {
  const grp = modelGroup(THREE, { items: [acc], dims: { T: 0 } }), p = grp.children[0].geometry.attributes.position; let V = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) { a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2); V += a.dot(b.clone().cross(c)) / 6; }
  return V;
}

test('nối mặt cắt nhiều cạnh: thể tích có dấu dương, đúng thể tích lăng trụ thang / chữ L', () => {
  const { Acc } = _prim;
  const trap = [[-3, 0], [3, 0], [1.5, 3], [-1.5, 3]], L = [[0, 0], [4, 0], [4, 1], [1, 1], [1, 3], [0, 3]];
  for (const [ring, area] of [[trap, 13.5], [L, 6]]) {
    const acc = new Acc(0xffffff, true); loftRings(acc, [0, 1, 2, 4].map((x) => ({ x, rings: [ring] })));
    const V = signedVol(acc); assert.ok(Math.abs(V - area * 4) < 1e-6, 'thể tích ' + V);
  }
  // mặt cắt đổi số đỉnh giữa chừng (chữ nhật → thang) vẫn kín
  const acc = new Acc(0xffffff, true); loftRings(acc, [{ x: 0, rings: [[[-3, 0], [3, 0], [3, 3], [-3, 3]]] }, { x: 2, rings: [trap] }]);
  assert.ok(signedVol(acc) > 0);
});

test('khối có hình nhìn từ mũi hình thang: 3D ra hình thang, không còn hình hộp', () => {
  const [side, top, front] = views();
  const parts = [
    { id: 's1', view: 'vs', type: ['tang', 't1', 'khoi'], kind: 'poly', pts: px(side, [[-5, 6], [5, 6], [5, 9], [-5, 9]]) },
    { id: 't1', view: 'vt', type: ['tang', 't1', 'khoi'], kind: 'poly', pts: px(top, [[-5, -3], [5, -3], [5, 3], [-5, 3]]) },
    { id: 'f1', view: 'vf', type: ['tang', 't1', 'khoi'], kind: 'poly', pts: px(front, [[-3, 6], [3, 6], [1.5, 9], [-1.5, 9]]) }
  ];
  const g = buildModel({ views: [side, top, front], parts, opts: { rails: false } }, ship);
  const blk = verts(g).filter((p) => p[0] > -5.1 && p[0] < 5.1 && p[2] > 5.9);
  const wTop = Math.max(...blk.filter((p) => p[2] > 8.95).map((p) => Math.abs(p[1]))), wBot = Math.max(...blk.filter((p) => p[2] < 6.05).map((p) => Math.abs(p[1])));
  assert.ok(Math.abs(wTop - 1.5) < 0.05 && Math.abs(wBot - 3) < 0.05, `rộng đỉnh ${wTop}, đáy ${wBot}`);
  assert.deepEqual([...g.links.s1].sort(), ['f1', 's1', 't1']); assert.match(g.src.s1, /mạn \+ boong \+ mũi/);
});

test('ghép theo vị trí: mặt boong chọn loại khác nấc vẫn lấy được bề rộng; chỗ khuyết ở hình mạn giữ nguyên', () => {
  const [side, top] = views();
  const parts = [
    // hình mạn chữ U ngược: khuyết ở giữa từ z 6 đến 7,5
    { id: 's1', view: 'vs', type: ['tang', 't1', 'khoi'], kind: 'poly', pts: px(side, [[-6, 6], [-2, 6], [-2, 7.5], [2, 7.5], [2, 6], [6, 6], [6, 9], [-6, 9]]) },
    { id: 't1', view: 'vt', type: ['buong', 'chinh'], kind: 'poly', pts: px(top, [[-6, 0], [6, 0], [6, 2], [-6, 2]]) } // chỉ nửa mạn phải
  ];
  const g = buildModel({ views: [side, top], parts, opts: { rails: false } }, ship);
  const blk = verts(g).filter((p) => p[2] > 5.9 && Math.abs(p[0]) < 6.1);
  assert.ok(Math.abs(Math.max(...blk.map((p) => Math.abs(p[1]))) - 2) < 0.05, 'bề rộng theo mặt boong, đối xứng');
  assert.ok(!blk.some((p) => Math.abs(p[0]) < 1.9 && p[2] < 7.4), 'chỗ khuyết không bị lấp');
  assert.deepEqual([...g.links.s1].sort(), ['s1', 't1']);
});

test('chi tiết chỉ vẽ ở hình nhìn từ mũi: báo cần thêm hình mạn / mặt boong', () => {
  const [side, top, front] = views();
  const g = buildModel({ views: [side, top, front], parts: [{ id: 'f9', view: 'vf', type: ['khac', 'hop'], kind: 'poly', pts: px(front, [[-1, 6], [1, 6], [1, 8], [-1, 8]]) }], opts: { rails: false } }, ship);
  assert.ok(g.warn.some((w) => /chỉ vẽ ở hình nhìn từ mũi/.test(w))); assert.match(g.src.f9, /chưa dựng/);
});

test('đối xứng thông minh: vẽ đủ hai mạn thì giữ chỗ lõm một bên; vẽ một nửa thì lấy đối xứng', () => {
  const [side, top] = views(), sp = px(side, [[-10, 5], [10, 5], [10, 7.5], [-10, 7.5]]);
  const run = (topPts) => { const g = buildModel({ views: [side, top], parts: [{ id: 's', view: 'vs', type: ['tang', 't1', 'khoi'], kind: 'poly', pts: sp }, { id: 't', view: 'vt', type: ['tang', 't1', 'khoi'], kind: 'poly', pts: px(top, topPts) }], opts: { rails: false } }, ship); const v = verts(g).filter((p) => p[0] > -5 && p[0] < 1 && p[2] > 5.1); return [Math.max(...v.map((p) => p[1])), Math.min(...v.map((p) => p[1]))]; };
  // đủ hai mạn ±4, mạn phải lõm vào tới 1,5 từ x −6 đến 2 (chỗ để xuồng)
  const [yS, yP] = run([[-10, -4], [10, -4], [10, 4], [2, 4], [2, 1.5], [-6, 1.5], [-6, 4], [-10, 4]]);
  assert.ok(Math.abs(yS - 1.5) < 0.05 && Math.abs(yP + 4) < 0.05, `mạn phải ${yS}, mạn trái ${yP}`);
  // chỉ vẽ nửa mạn phải có chỗ lõm → hai mạn cùng lõm
  const [hS, hP] = run([[-10, 0], [10, 0], [10, 4], [2, 4], [2, 1.5], [-6, 1.5], [-6, 4], [-10, 4]]);
  assert.ok(Math.abs(hS - 1.5) < 0.05 && Math.abs(hP + 1.5) < 0.05, `nửa: ${hS} / ${hP}`);
});

test('mặt boong thân tàu vẽ đủ hai mạn: mỗi mạn theo nét của mạn đó', () => {
  const [side, top] = views();
  const deck = [[-30, -5], [20, -5], [30, 0], [20, 5], [6, 5], [6, 3.5], [-6, 3.5], [-6, 5], [-30, 5]];
  const g = buildModel({ views: [side, top], parts: [{ id: 'h', view: 'vt', type: ['than', 'matboong'], kind: 'poly', pts: px(top, deck) }], opts: { rails: false } }, ship);
  assert.ok(Math.abs(g.hull.hbs(0, 1) - 3.5) < 0.05 && Math.abs(g.hull.hbs(0, -1) - 5) < 0.05, `phải ${g.hull.hbs(0, 1)}, trái ${g.hull.hbs(0, -1)}`);
  assert.ok(g.ranges.h && g.ranges.h.length === 2, 'thân tàu có vùng tam giác để chọn trên 3D');
});

test('vùng tam giác: mỗi chi tiết dựng được đều chỉ ra khối 3D của nó (để chọn / sáng trên 3D)', async () => {
  const { makeTemplate } = await import('../src/shipdraw/template.js');
  const m = makeTemplate(), g = buildModel(m, { L: 62, B: 9.5, D: 5, T: 2.8, cb: 0.48 });
  const solid = m.parts.filter((p) => p.kind !== 'point' && ['tang', 'buong', 'khoi', 'cot', 'radar', 'vukhi', 'xuong'].includes(p.type[0]));
  const miss = solid.filter((p) => !(g.ranges[p.id] || []).length); assert.equal(miss.length, 0, 'thiếu: ' + miss.map((p) => p.type.join('/')).join(', '));
  for (const [id, rs] of Object.entries(g.ranges)) for (const r of rs) assert.ok(r.it >= 0 && r.t1 > r.t0 && r.t1 * 3 <= g.items[r.it].idx.length, id);
});
