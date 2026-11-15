// Kiểm thử hải đồ: đọc BSB đầy đủ, georef đa thức, chọn tờ (quilting) — dùng hải đồ tổng hợp
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBsb, decodeBsb, buildGrid } from '../src/charts/bsb.js';
import { fitGeoref, makeXf } from '../src/charts/georef.js';
import { selectCharts } from '../src/render/quilt.js';
import { llToMerc, mercScale } from '../src/geo/proj.js';
import { toWGS84 } from '../src/geo/datum.js';
import { makeKap, SET } from './fixtures/makeKap.mjs';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} (±${tol})`);
const small = (s) => ({ ...s, W: Math.round(s.W / 3), H: Math.round(s.H / 3) });

test('BSB: đọc header đầy đủ và giải mã ảnh tổng hợp', () => {
  const k = makeKap(small(SET.D)), H = parseBsb(k.bytes);
  assert.equal(H.name, 'MAU-12K-LOM'); assert.equal(H.scale, 12500); assert.equal(H.datumSrc, 'WGS84'); assert.equal(H.proj, 'MERCATOR');
  assert.equal(H.refs.length, 9); assert.equal(H.ply.length, 6); assert.ok(H.pal.day[3] === 255 && H.pal.night[3] === 63, 'bảng màu ngày / đêm');
  const idx = decodeBsb(k.bytes, H);
  assert.equal(idx.length, H.W * H.H); assert.deepEqual(Array.from(idx), Array.from(k.idx));
  const g = buildGrid(idx, H.W, H.H, H.pal.day); assert.equal(g.gw, Math.ceil(H.W / 4)); assert.ok(g.grid.every((v) => v === 4 || v === 255 || v < 4));
});

test('Georef: affine khớp tờ thẳng và tờ xoay 6° trong 1 pixel', () => {
  for (const s of [SET.A, SET.F]) {
    const k = makeKap(small(s)), H = parseBsb(k.bytes), c = fitGeoref(H.refs, H.W, H.H), xf = makeXf(c);
    assert.equal(c.order, 1); const pxm = c.mpp / mercScale(21.1);
    assert.ok(c.max < pxm, `sai số ${c.max.toFixed(2)} m < 1 pixel (${pxm.toFixed(1)} m)`);
    for (const [px, py] of [[10, 10], [H.W - 5, H.H / 2], [H.W / 3, H.H - 3]]) {
      const [la, lo] = k.ll(px, py), [la2, lo2] = xf.pxToLL(px, py); near((la2 - la) * 111320, 0, pxm, 'lat'); near((lo2 - lo) * 104000, 0, pxm, 'lon');
      const [qx, qy] = xf.mercToPx(...llToMerc(la, lo)); near(qx, px, 0.5, 'px ngược'); near(qy, py, 0.5, 'py ngược');
    }
  }
});

test('Georef: chọn bậc 2 khi điểm chuẩn có méo bậc 2', () => {
  const W = 2000, H = 1500, refs = [];
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 3; j++) { const px = i * W / 4, py = j * H / 3, u = px / W, v = py / H; refs.push({ x: px, y: py, lat: 21.2 - 0.15 * v + 0.004 * u * u, lon: 107.3 + 0.2 * u + 0.003 * v * v }); }
  const c = fitGeoref(refs, W, H); assert.equal(c.order, 2); assert.ok(c.rms < 0.5, 'rms ' + c.rms);
});

test('Georef: tờ VN-2000 sau khi quy về WGS-84 ghép đúng với tờ WGS-84', () => {
  const kE = makeKap(small(SET.E)), H = parseBsb(kE.bytes);
  const refs = H.refs.map((r) => { const [lat, lon] = toWGS84(r.lat, r.lon, 'VN2000'); return { ...r, lat, lon }; });
  const xf = makeXf(fitGeoref(refs, H.W, H.H)), [la, lo] = [21.08, 107.47];   // tâm đảo theo WGS-84
  const [px, py] = xf.mercToPx(...llToMerc(la, lo)), c = kE.idx[Math.round(py) * H.W + Math.round(px)];
  assert.equal(c, 3, 'tâm đảo WGS-84 phải rơi vào màu đất trên tờ VN-2000');
});

const rec = (id, s) => {
  const [X0, Y0] = llToMerc(s.lat0, s.lon0), [X1, Y1] = llToMerc(s.lat1, s.lon1), ply = (s.ply || [[s.lat1, s.lon0], [s.lat1, s.lon1], [s.lat0, s.lon1], [s.lat0, s.lon0]]).map(([a, b]) => llToMerc(a, b));
  return { id, ready: true, mppMerc: (X1 - X0) / s.W, bboxMerc: [X0, Y0, X1, Y1], plyMerc: ply };
};
const vpAt = (lat, lon, mpp, w = 800, h = 600) => { const [X, Y] = llToMerc(lat, lon), dx = w / 2 * mpp, dy = h / 2 * mpp, poly = [[X - dx, Y - dy], [X + dx, Y - dy], [X + dx, Y + dy], [X - dx, Y + dy]]; return { center: [X, Y], mpp, bbox: [X - dx, Y - dy, X + dx, Y + dy], poly }; };

test('Quilt: chọn tờ theo mức zoom, bỏ tờ bị che kín, giữ cả 2 tờ liền kề', () => {
  const R = Object.fromEntries(Object.entries(SET).map(([k, s]) => [k, rec(k, s)]));
  const all = Object.values(R);
  let q = selectCharts(all, vpAt(21.08, 107.38, R.D.mppMerc));          // zoom sát trong tờ 12,5k
  assert.equal(q.ref.id, 'D'); assert.equal(q.draw[q.draw.length - 1].id, 'D');
  q = selectCharts(all, vpAt(21.06, 107.37, R.D.mppMerc * 1.5));       // phần khuyết của PLY lõm: phải có tờ A lấp vào
  assert.ok(q.draw.some((r) => r.id === 'A'), 'tờ A lấp chỗ khuyết');
  q = selectCharts(all, vpAt(21.08, 107.38, R.D.mppMerc * 40));        // thu nhỏ nhiều: bỏ tờ 12,5k
  assert.ok(!q.draw.some((r) => r.id === 'D'));
  q = selectCharts(all, vpAt(21.075, 107.5, R.A.mppMerc));             // khung nhìn vắt qua ranh A | B
  const ids = q.draw.map((r) => r.id); assert.ok(ids.includes('A') && ids.includes('B'), ids.join(','));
  q = selectCharts([R.A, R.C], vpAt(21.075, 107.4, R.A.mppMerc * 0.5)); // nằm gọn trong A: tờ 200k bị che kín
  assert.deepEqual(q.draw.map((r) => r.id), ['A']);
  q = selectCharts(all, vpAt(25, 110, 50));                              // ngoài vùng có hải đồ
  assert.equal(q.draw.length, 0); assert.equal(q.ref, null);
});
