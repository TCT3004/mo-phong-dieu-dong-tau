// Tàu đẹp, giống thật: nét cong / bo góc, chi tiết thư viện, hình chiếu tự sinh, hình mũi ∩ hình lái, khối sát boong, cửa kính, nóc màu boong, số hiệu mạn
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { calibrate } from '../src/shipdraw/calib.js';
import { buildModel, partShape } from '../src/shipdraw/model.js';
import { modelGroup } from '../src/shipdraw/mesh3.js';
import { shapePts, simplifyPts } from '../src/shipdraw/curve.js';
import { FIT_KINDS, buildFit, fitDefaults, mirrorFit } from '../src/shipdraw/fittings.js';
import { Acc, sArea } from '../src/shipdraw/prims.js';

const ship = { L: 60, B: 10, D: 5, T: 2.5, cb: 0.5 };
const PX = 20, M = 100;
function views() {
  const w = ship.L * PX + 2 * M, h = 300;
  return [
    { id: 'vs', kind: 'side', name: 'mạn', refs: { stern: [M, h - M], bow: [M + ship.L * PX, h - M], base: [w / 2, h - M] }, dims: [] },
    { id: 'vt', kind: 'top', name: 'boong', refs: { stern: [M, 200], bow: [M + ship.L * PX, 200] }, dims: [] },
    { id: 'vf', kind: 'front', name: 'mũi', refs: { left: [400 - ship.B / 2 * PX, 300], right: [400 + ship.B / 2 * PX, 300], base: [400, 300] }, dims: [] },
    { id: 'vb', kind: 'back', name: 'lái', refs: { left: [400 - ship.B / 2 * PX, 300], right: [400 + ship.B / 2 * PX, 300], base: [400, 300] }, dims: [] }
  ];
}
const px = (v, pts) => { const c = calibrate(v, ship); return pts.map((q) => c.toPx(q)); };
const verts = (g, its) => { const out = []; for (const it of its || g.items) for (let i = 0; i < it.pos.length; i += 3) out.push([it.pos[i], it.pos[i + 1], it.pos[i + 2]]); return out; };
const vol = (acc) => { let V = 0; const p = acc.pos, I = acc.idx; for (let t = 0; t < I.length; t += 3) { const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3; const A = [p[a + 1], p[a + 2] - 0, -p[a]], B = [p[b + 1], p[b + 2], -p[b]], C = [p[c + 1], p[c + 2], -p[c]]; V += (A[0] * (B[1] * C[2] - B[2] * C[1]) - A[1] * (B[0] * C[2] - B[2] * C[0]) + A[2] * (B[0] * C[1] - B[1] * C[0])) / 6; } return V; };
const opts = { rails: false };

test('nét cong mềm đi qua mọi điểm vẽ; góc sắc giữ nguyên; bo góc đúng bán kính', () => {
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const c = shapePts(sq, { curve: true });
  assert.ok(c.length > 20); for (const p of sq) assert.ok(c.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-9), 'qua điểm ' + p);
  const sharp = shapePts(sq, { curve: true, sharp: [0, 1] }); // đáy thẳng giữa hai góc sắc
  assert.ok(sharp.filter((q) => Math.abs(q[1]) < 1e-9 && q[0] > 0.1 && q[0] < 9.9).length === 0 || sharp.every((q) => q[1] >= -1e-9), 'đáy không phình xuống');
  const f = shapePts(sq, { fillet: 1 }); // diện tích hình vuông bo 4 góc bán kính 1 = 100 − (4 − π)
  assert.ok(Math.abs(Math.abs(sArea(f)) - (100 - (4 - Math.PI))) < 0.05, 'diện tích ' + sArea(f));
  for (const q of f) if (q[0] < 1 && q[1] < 1) assert.ok(Math.abs(Math.hypot(q[0] - 1, q[1] - 1) - 1) < 1e-6);
  const keep = shapePts(sq, { fillet: 1, sharp: [0] }); assert.ok(keep.some((q) => Math.hypot(q[0], q[1]) < 1e-9), 'góc sắc không bị bo');
  const line = []; for (let i = 0; i <= 10; i++) line.push([i, 0]); for (let i = 1; i <= 10; i++) line.push([10, i]); for (let i = 9; i >= 0; i--) line.push([i, 10]); for (let i = 9; i > 0; i--) line.push([0, i]);
  assert.equal(simplifyPts(line, 0.02, true).length, 4);
});

test('khối ở hình mạn: bo góc nhưng chân khối sát boong vẫn vuông', () => {
  const raw = [[-5, 5], [5, 5], [5, 8], [-5, 8]], p = { kind: 'poly', fillet: 0.8 }, s = partShape(raw, p, 'side', 'block');
  for (const q of [[-5, 5], [5, 5]]) assert.ok(s.some((z) => Math.hypot(z[0] - q[0], z[1] - q[1]) < 1e-9), 'chân ' + q);
  assert.ok(!s.some((z) => Math.hypot(z[0] - 5, z[1] - 8) < 1e-6), 'góc trên được bo');
});

test('chi tiết thư viện: mỗi loại dựng ra khối kín hướng ra ngoài, đúng cỡ; xoay / lấy đối xứng đúng', () => {
  for (const kind of Object.keys(FIT_KINDS)) {
    const accs = Object.fromEntries(['hull', 'super', 'dark', 'deck', 'metal', 'white', 'orange'].map((k) => [k, new Acc(0x888888, true)])), mv = [];
    const f = Object.assign(fitDefaults(kind, 60), { id: 'f1', x: 0, y: 0, z: 5 }), I = buildFit(f, accs, mv);
    const all = [...Object.values(accs), ...mv.map((m) => m.acc)].filter((a) => a.idx.length);
    assert.ok(all.length, kind + ' có hình'); for (const a of all) assert.ok(a.idx.every((k) => k < a.pos.length / 3), kind + ' chỉ số đỉnh');
    assert.ok(all.reduce((s, a) => s + vol(a), 0) > 0, kind + ' thể tích có dấu dương');
    const hb = I.bb[5] - I.bb[2]; assert.ok(isFinite(hb) && hb > f.h * 0.5 && hb < f.h * 1.7, kind + ' cao ' + hb.toFixed(2) + ' / ' + f.h);
    if (kind === 'radar') { assert.equal(mv.length, 1); assert.ok(Math.abs(mv[0].pivot[2] - (5 + f.h - 0.45)) < 1e-6, 'tâm quay ở đỉnh bệ'); }
  }
  const run = (rot) => { const accs = Object.fromEntries(['super', 'dark', 'white', 'metal'].map((k) => [k, new Acc(0, true)])); return buildFit({ id: 'r', kind: 'radar', x: 0, y: 0, z: 0, rot, l: 3.2, w: 0.5, h: 1.2 }, accs, []).bb; };
  const b0 = run(0), b90 = run(90); assert.ok(b0[4] - b0[1] > 3 && b0[3] - b0[0] < 1, 'anten dọc mạn khi rot 0'); assert.ok(b90[3] - b90[0] > 3 && b90[4] - b90[1] < 1, 'xoay 90° thì anten dọc tàu');
  const m = mirrorFit({ id: 'a', kind: 'searchlight', x: 3, y: 4, z: 10, rot: 30 }); assert.deepEqual([m.y, m.rot], [-4, -30]);
  const a = mirrorFit({ id: 'b', kind: 'anchor', x: 25, y: 3, z: 4, rot: 0 }); assert.deepEqual([a.y, a.rot], [-3, 180]);
});

test('mô hình có chi tiết thư viện: vùng tam giác để chọn, radar quay riêng, cột dàn cao nhất mang cờ và đèn cột', () => {
  const g = buildModel({ views: [], parts: [], opts, fits: [
    { id: 'fr', kind: 'radar', x: 0, y: 0, z: 12, rot: 0, l: 3, w: 0.5, h: 1.2 },
    { id: 'fm', kind: 'latmast', x: -2, y: 0, z: 12, rot: 0, l: 1.6, w: 1.6, h: 9 },
    { id: 'fb', kind: 'bollard', x: 20, y: 3, z: 6, rot: 0, l: 0.9, w: 0.4, h: 0.55 }] }, ship);
  for (const id of ['fr', 'fm', 'fb']) { assert.ok((g.ranges[id] || []).length, 'vùng ' + id); assert.ok(isFinite(g.fitBB[id][0])); }
  const sp = g.items.filter((it) => it.pivot); assert.equal(sp.length, 1); assert.equal(sp[0].spin, 24);
  assert.ok(g.ranges.fr.some((r) => g.items[r.it] === sp[0]), 'chọn được cả phần quay');
  assert.ok(Math.abs(g.flag.x + 2) < 1e-6 && g.flag.z > 12 + 9 * 0.8, 'cờ trên xà cột dàn ' + JSON.stringify(g.flag));
  const m1 = g.lights.find((l) => l.key === 'mast1'); assert.ok(m1.z > 12 + 9, 'đèn cột ở đỉnh cột dàn');
  const grp = modelGroup(THREE, g); assert.equal(grp.userData.spin.length, 1);
});

test('hình chiếu tự sinh: khối có mạn + boong thì hình mũi / lái hiện đúng đường bao; thiếu boong thì có mặt boong tự sinh', () => {
  const [side, top] = views();
  const g = buildModel({ views: [side, top], opts, parts: [
    { id: 's1', view: 'vs', type: ['tang', 't1', 'khoi'], kind: 'poly', pts: px(side, [[-5, 6], [5, 6], [5, 9], [-5, 9]]) },
    { id: 't1', view: 'vt', type: ['tang', 't1', 'khoi'], kind: 'poly', pts: px(top, [[-5, -3], [5, -3], [5, 3], [-5, 3]]) },
    { id: 's2', view: 'vs', type: ['khoi', 'giua'], kind: 'poly', pts: px(side, [[10, 5.5], [12, 5.5], [12, 9], [10, 9]]) }] }, ship);
  const fb = g.auto.find((a) => a.gid === 's1' && a.view === 'fb'); assert.ok(fb && fb.need.front && fb.need.back);
  const ys = fb.poly.map((q) => q[0]), zs = fb.poly.map((q) => q[1]);
  assert.ok(fb.poly.length === 4 && Math.abs(Math.min(...ys) + 3) < 0.02 && Math.abs(Math.max(...ys) - 3) < 0.02 && Math.abs(Math.min(...zs) - 6) < 0.02 && Math.abs(Math.max(...zs) - 9) < 0.02, JSON.stringify(fb.poly));
  assert.ok(!g.auto.some((a) => a.gid === 's1' && a.view === 'top'), 'đã có mặt boong thì không tự sinh');
  assert.ok(g.auto.some((a) => a.gid === 's2' && a.view === 'top'), 'ống khói chỉ có hình mạn → mặt boong tự sinh');
  assert.ok(g.solids.find((s) => s.gid === 's1').slices.length > 5);
});

test('hình mũi ∩ hình lái; nét tạo từ hình tự sinh (grp) chỉ ghép vào đúng khối của nó', () => {
  const [side, top, front, back] = views();
  const g = buildModel({ views: [side, top, front, back], opts, parts: [
    { id: 's1', view: 'vs', type: ['tang', 't1', 'khoi'], kind: 'poly', pts: px(side, [[-5, 6], [5, 6], [5, 9], [-5, 9]]) },
    { id: 'f1', view: 'vf', type: ['tang', 't1', 'khoi'], kind: 'poly', pts: px(front, [[-3, 6], [3, 6], [1.5, 9], [-1.5, 9]]) },
    { id: 'b1', view: 'vb', type: ['tang', 't1', 'khoi'], kind: 'poly', pts: px(back, [[-1.5, 6], [1.5, 6], [3, 9], [-3, 9]]) }] }, ship);
  const blk = verts(g).filter((p) => Math.abs(p[0]) < 5.1 && p[2] > 5.9), w = (z0, z1) => Math.max(...blk.filter((p) => p[2] >= z0 && p[2] <= z1).map((p) => Math.abs(p[1])));
  assert.ok(Math.abs(w(8.95, 9.1) - 1.5) < 0.05 && Math.abs(w(5.9, 6.05) - 1.5) < 0.05, `đỉnh ${w(8.95, 9.1)}, đáy ${w(5.9, 6.05)}`);
  assert.match(g.src.s1, /mũi \+ lái/);
  // hai khối cùng độ cao; nét hình mũi mang grp của khối A thì khối B không dùng
  const g2 = buildModel({ views: [side, top, front], opts, parts: [
    { id: 'A', view: 'vs', type: ['tang', 't1', 'khoi'], kind: 'poly', pts: px(side, [[-12, 6], [-6, 6], [-6, 9], [-12, 9]]) },
    { id: 'B', view: 'vs', type: ['tang', 't1', 'khoi'], kind: 'poly', pts: px(side, [[6, 6], [12, 6], [12, 9], [6, 9]]) },
    { id: 'F', view: 'vf', type: ['tang', 't1', 'khoi'], kind: 'poly', grp: 'A', pts: px(front, [[-3, 6], [3, 6], [1.5, 9], [-1.5, 9]]) }] }, ship);
  const topW = (x0, x1) => Math.max(...verts(g2).filter((p) => p[0] > x0 && p[0] < x1 && p[2] > 8.95 && p[2] < 9.05).map((p) => Math.abs(p[1])));
  assert.ok(Math.abs(topW(-12.1, -5.9) - 1.5) < 0.05, 'khối A theo hình mũi'); assert.ok(topW(5.9, 12.1) > 2.5, 'khối B giữ bề rộng mặc định');
  assert.deepEqual([...g2.links.A].sort(), ['A', 'F']); assert.ok(!(g2.links.B || []).includes('F'));
});

test('khối vẽ hơi cao hơn boong được hạ chân xuống ngập vào thân (không hở khe)', () => {
  const [side] = views(), g = buildModel({ views: [side], opts, parts: [{ id: 's', view: 'vs', type: ['tang', 't1', 'khoi'], kind: 'poly', pts: px(side, [[-4, 5.3], [4, 5.3], [4, 7.5], [-4, 7.5]]) }] }, ship);
  const s = g.solids[0], zmin = Math.min(...s.slices.flatMap((sl) => sl.rings.flat().map((p) => p[1]))), deck = g.hull.zTop(0);
  assert.ok(zmin < deck && zmin > deck - 0.3, `chân ${zmin.toFixed(2)}, boong ${deck.toFixed(2)}`);
});

test('cửa kính buồng lái, nóc tầng màu boong, số hiệu mạn hai bên', () => {
  const [side, top] = views();
  const parts = [{ id: 'b', view: 'vs', type: ['buong', 'chinh'], kind: 'poly', pts: px(side, [[-2, 9], [3, 9], [3, 11.6], [-2, 11.6]]) }, { id: 'bt', view: 'vt', type: ['buong', 'chinh'], kind: 'poly', pts: px(top, [[-2, -3], [3, -3], [3, 3], [-2, 3]]) }];
  const g = buildModel({ views: [side, top], parts, opts: { rails: false, colors: { hull: '#d3d7da', super: '#e1e4e6', deck: '#3f7a4c', boot: '#23282b' }, hullNo: '123' } }, ship);
  const sup = g.items.find((it) => it.tag === 'roof' && it.win && it.win.some((v) => v)); assert.ok(sup, 'có dải kính');
  const band = sup.win.filter((_, i) => i % 2 === 0).find((v) => v); assert.ok(band > 9.5 && band < 11, 'kính sát nóc ' + band);
  const grp = modelGroup(THREE, g), mesh = grp.children[g.items.indexOf(sup)], geo = mesh.geometry;
  assert.ok(geo.attributes.aWin && geo.attributes.color, 'có thuộc tính kính và màu');
  const N = geo.attributes.normal, C3 = geo.attributes.color; let roof = 0;
  for (let i = 0; i < N.count; i++) if (N.getY(i) > 0.95) { roof++; assert.ok(Math.abs(C3.getY(i) - ((0x7a / 255 + 0.055) / 1.055) ** 2.4) < 0.01, 'nóc màu boong'); }
  assert.ok(roof > 0);
  assert.equal(g.decals.length, 2); assert.equal(g.hullNoCol, 'k', 'vỏ sáng → chữ đen');
  for (const d of g.decals) { let iMax = 0; for (let i = 0; i < d.pos.length / 3; i++) if (d.pos[i * 3] > d.pos[iMax * 3]) iMax = i; const u = d.uv[iMax * 2]; assert.ok(d.s > 0 ? u > 0.99 : u < 0.01, 'chiều chữ mạn ' + d.s); assert.ok(d.pos.every((v, i) => i % 3 !== 1 || Math.sign(v) === d.s)); }
});
