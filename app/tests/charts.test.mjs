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

// ---------- bản ghi tờ: dời tay, đổi datum, khung PDF ----------
import { georefRecord } from '../src/charts/record.js';
import { classOfRgb, cellClass } from '../src/charts/bsb.js';

test('georefRecord: dời tay theo mét, datum người dùng chọn, khung PDF theo pixel', () => {
  const k = makeKap(SET.A), H = parseBsb(k.bytes);
  const base = () => ({ W: H.W, H: H.H, refs: H.refs, plyRaw: H.ply, datumSrc: H.datumSrc, dtm: H.dtm, offsetM: [0, 0] });
  const r = georefRecord(base()), c0 = r.xf.pxToLL(H.W / 2, H.H / 2), m = (a, b) => [(b[1] - a[1]) * 111320 * Math.cos(a[0] * Math.PI / 180), (b[0] - a[0]) * 110574];
  const r2 = georefRecord({ ...base(), offsetM: [120, -80] }), d = m(c0, r2.xf.pxToLL(H.W / 2, H.H / 2));
  assert.ok(Math.abs(d[0] - 120) < 1 && Math.abs(d[1] + 80) < 1, 'dời tay ' + d);
  assert.ok(r2.ver === 1 && r2.plyMerc.length >= 3 && r2.bboxMerc[2] > r2.bboxMerc[0]);
  // tờ ghi WGS-84 mà người dùng chọn VN-2000: dịch đúng như toWGS84
  const r3 = georefRecord({ ...base(), datumUser: 'VN2000' }), e = toWGS84(c0[0], c0[1], 'VN2000'), c3 = r3.xf.pxToLL(H.W / 2, H.H / 2);
  assert.ok(Math.abs(c3[0] - e[0]) < 2e-6 && Math.abs(c3[1] - e[1]) < 2e-6, 'datum VN-2000');
  assert.equal(r3.datumName, 'VN-2000');
  // khung theo pixel (hải đồ PDF): đa giác phủ là ảnh của khung qua georef
  const r4 = georefRecord({ ...base(), plyRaw: null, plyPx: [[100, 100], [H.W - 100, 100], [H.W - 100, H.H - 100], [100, H.H - 100]] });
  const q = r4.xf.pxToLL(100, 100); assert.ok(r4.plyLL.some((p) => Math.abs(p[0] - q[0]) < 1e-9 && Math.abs(p[1] - q[1]) < 1e-9));
  // không đủ REF
  assert.equal(georefRecord({ ...base(), refs: H.refs.slice(0, 1) }).coef, null);
});

test('phân lớp màu hải đồ PDF (màu lấy từ tờ 500-07)', () => {
  assert.equal(classOfRgb(255, 255, 255), 4);        // nền trắng: sâu
  assert.equal(classOfRgb(255, 255, 230), 0);        // đất vàng kem nhạt
  assert.equal(classOfRgb(248, 225, 176), 0);        // đất be
  assert.equal(classOfRgb(228, 255, 250), 3);        // nước nông xanh lơ nhạt
  assert.equal(classOfRgb(150, 200, 240), 2);        // nước nông xanh dương đậm
  assert.equal(classOfRgb(150, 220, 140), 1);        // bãi cạn xanh lá
  assert.equal(classOfRgb(30, 0, 0), 255);           // nét chữ
  assert.equal(classOfRgb(230, 20, 220), 255);       // tím (vùng hạn chế)
  assert.equal(classOfRgb(220, 40, 30), 255);        // đỏ (đường bộ)
  assert.equal(cellClass([6, 0, 0, 0, 10]), 0);      // đất ≥ 1/3 ô
  assert.equal(cellClass([0, 0, 3, 9, 4]), 3);
  assert.equal(cellClass([0, 0, 0, 0, 0]), 255);
});
