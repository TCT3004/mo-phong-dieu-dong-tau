// Neo: tốc độ tời theo cấp của từng neo (cấp 1 = 1 m/s, cấp 2 = 2 m/s) cho thả và kéo; thả tự do 3 m/s, chạm đáy thì chậm lại (không tự dừng);
// quả neo trong mô hình là khối riêng (rơi được), miệng lỗ neo nằm yên trên vỏ
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeAnchors, externalForces, ANCHOR_SPD, FREE_SPD, FREE_BOTTOM_SPD } from '../src/world.js';
import { buildModel } from '../src/shipdraw/model.js';

const M = { loa: 60, L: 56, B: 9, p: { bowAnchors: 2, chainLen: 275, anchorW: 2, chainW: 40 } };
const W = { segs: [], bollards: [] }, H = 10, DT = 0.1; // độ sâu 10 m → neo chạm đáy khi xích ≈ 13 m
const S0 = () => ({ x: 0, y: 0, psi: 0, u: 0, v: 0, r: 0, cE: 0, cN: 0 });
const run = (anchors, sec, S = S0()) => { for (let i = 0; i < Math.round(sec / DT); i++) externalForces(W, S, M, anchors, [], H, DT, {}); };

test('thả / kéo neo theo cấp của từng neo', () => {
  assert.deepEqual([ANCHOR_SPD[1], ANCHOR_SPD[2], FREE_SPD], [1, 2, 3]);
  const an = makeAnchors(M), [p, s] = an; assert.equal(p.lv, 1); assert.equal(s.lv, 1);
  s.lv = 2; p.st = 'drop'; s.st = 'drop'; run(an, 5);
  assert.ok(Math.abs(p.chain - 5) < 0.15, 'cấp 1: ' + p.chain); assert.ok(Math.abs(s.chain - 10) < 0.25, 'cấp 2 (neo kia): ' + s.chain);
  run(an, 15); p.st = 'heave'; s.st = 'heave'; const c0 = p.chain, c1 = s.chain; run(an, 4);
  assert.ok(Math.abs(c0 - p.chain - 4) < 0.2, 'kéo cấp 1: ' + (c0 - p.chain)); assert.ok(Math.abs(c1 - s.chain - 8) < 0.3, 'kéo cấp 2: ' + (c1 - s.chain));
  run(an, 40); assert.equal(s.st, 'stow'); assert.equal(s.chain, 0); assert.equal(s.ax, null);
});

test('thả tự do 3 m/s; chạm đáy thì chậm dần còn 1 m/s và không tự dừng', () => {
  const an = makeAnchors(M), a = an[0]; a.st = 'drop'; a.free = true; a.vf = FREE_SPD;
  run(an, 3); assert.ok(Math.abs(a.chain - 9) < 0.2, 'đang rơi: ' + a.chain); assert.equal(a.ax, null);
  run(an, 2); assert.notEqual(a.ax, null, 'đã chạm đáy');
  run(an, 8); const c = a.chain; run(an, 2); const v = (a.chain - c) / 2;
  assert.ok(Math.abs(v - FREE_BOTTOM_SPD) < 0.1, 'tốc độ sau khi chạm đáy ' + v); assert.equal(a.st, 'drop', 'vẫn chạy cho đến khi hãm');
  a.st = 'hold'; a.free = false; const c2 = a.chain; run(an, 3); assert.ok(Math.abs(a.chain - c2) < 1e-9, 'hãm thì xích đứng');
});

test('quả neo của mô hình là khối riêng có gốc ở chỗ nối xích; miệng lỗ neo ở lại trên vỏ', () => {
  const ship = { L: 60, B: 10, D: 5, T: 2.5, cb: 0.5 };
  const g = buildModel({ views: [], parts: [], opts: { rails: false }, fits: [
    { id: 'aS', kind: 'anchor', x: 24, y: 3.2, z: 4, rot: 0, l: 1.2, w: 0.5, h: 1.4 },
    { id: 'aP', kind: 'anchor', x: 24, y: -3.2, z: 4, rot: 180, l: 1.2, w: 0.5, h: 1.4 }] }, ship);
  const an = g.items.filter((it) => it.anchor); assert.equal(an.length, 2);
  assert.deepEqual(an.map((it) => it.anchor.side).sort(), [-1, 1]); assert.ok(an.every((it) => it.anchor.bow && it.pivot));
  for (const it of an) { assert.ok(Math.abs(it.pivot[2] - (4 + 1.4 * 0.45)) < 1e-6, 'gốc ở đầu thân neo'); let zt = -Infinity; for (let i = 2; i < it.pos.length; i += 3) zt = Math.max(zt, it.pos[i]); assert.ok(zt < it.pivot[2] + 0.2, 'quả neo nằm dưới chỗ nối xích'); }
  const metal = g.items.find((it) => !it.anchor && it.col === 0x3a3f44); assert.ok(metal && metal.idx.length, 'miệng lỗ neo trong khối tĩnh');
  assert.ok(g.ranges.aS.some((r) => g.items[r.it].anchor), 'chọn được quả neo trên 3D');
});
