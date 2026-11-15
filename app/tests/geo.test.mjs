// Kiểm thử nền tọa độ: chạy `npm test` trong thư mục app
import test from 'node:test';
import assert from 'node:assert/strict';
import { llToMerc, mercToLL } from '../src/geo/proj.js';
import { WorldFrame } from '../src/geo/frame.js';
import { toWGS84, fromWGS84, normalizeDatum } from '../src/geo/datum.js';
import { inverse, rhumb, rhumbDest } from '../src/geo/geodesic.js';
import { area, inside, normalize, bbox, bboxIntersects } from '../src/geo/poly.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} (±${tol})`);
const M_PER_DEG = 111320;

test('Mercator: đi vòng lat/lon → X,Y → lat/lon', () => {
  for (const [la, lo] of [[0, 0], [21.2, 107.5], [-37.9, 144.4], [60, -20]]) {
    const [X, Y] = llToMerc(la, lo), [la2, lo2] = mercToLL(X, Y);
    near(la2, la, 1e-10, 'lat'); near(lo2, lo, 1e-10, 'lon');
  }
});

test('WorldFrame: đi vòng sai < 1 mm, gốc ở (0,0)', () => {
  const f = new WorldFrame(21.0, 107.3);
  assert.deepEqual(f.toWorld(21.0, 107.3).map((v) => Math.round(v * 1e6)), [0, 0]);
  for (const [la, lo] of [[21.2, 107.5], [20.6, 106.9], [21.8, 108.1]]) {
    const [x, y] = f.toWorld(la, lo), [la2, lo2] = f.toLL(x, y);
    near((la2 - la) * M_PER_DEG, 0, 1e-3, 'lat m'); near((lo2 - lo) * M_PER_DEG, 0, 1e-3, 'lon m');
  }
});

test('WorldFrame: khoảng cách gần gốc khớp geodesic trong 0,02%, xa 0,5° trong 0,5%', () => {
  const f = new WorldFrame(21.0, 107.3);
  for (const [la, lo, tol] of [[21.05, 107.35, 0.0002], [21.5, 107.8, 0.005], [21.0, 107.35, 0.0001], [21.05, 107.3, 0.0002]]) {
    const [x, y] = f.toWorld(la, lo), g = inverse(21.0, 107.3, la, lo).dist;
    near(Math.hypot(x, y) / g, 1, tol, 'tỷ lệ');
  }
});

test('WorldFrame: gốc trôi giữ nguyên vị trí thật', () => {
  const f = new WorldFrame(21.0, 107.3), p = f.toWorld(21.3, 107.6), [la, lo] = f.toLL(...p);
  const { map } = f.recenter(21.25, 107.55), q = map(...p), [la2, lo2] = f.toLL(...q);
  near((la2 - la) * M_PER_DEG, 0, 1e-3, 'lat'); near((lo2 - lo) * M_PER_DEG, 0, 1e-3, 'lon');
});

test('Datum: nhận tên datum trong hải đồ', () => {
  assert.equal(normalizeDatum('WGS_84'), 'WGS84'); assert.equal(normalizeDatum('WGE'), 'WGS84');
  assert.equal(normalizeDatum('VN-2000'), 'VN2000'); assert.equal(normalizeDatum('vn2000'), 'VN2000');
  assert.equal(normalizeDatum('Indian 1960'), null);
});

// giá trị tham chiếu tính bằng PROJ 9 (pipeline helmert coordinate_frame, tham số EPSG:6960)
const REF = [
  [21.2, 107.5, 21.198996242, 107.501880013],
  [21.03, 105.85, 21.029014035, 105.851882673],
  [12.2, 109.2, 12.198966236, 109.201786636],
  [10.8, 106.7, 10.798981510, 106.701786366]
];
test('Datum: VN-2000 → WGS-84 khớp PROJ trong 5 cm', () => {
  for (const [la, lo, eLa, eLo] of REF) {
    const [a, b] = toWGS84(la, lo, 'VN2000');
    near((a - eLa) * M_PER_DEG, 0, 0.05, 'lat'); near((b - eLo) * M_PER_DEG * Math.cos(la * Math.PI / 180), 0, 0.05, 'lon');
  }
});
test('Datum: WGS-84 → VN-2000 → WGS-84 sai < 1 mm; WGS84 giữ nguyên', () => {
  const [a, b] = fromWGS84(21.198996242, 107.501880013, 'VN2000');
  near((a - 21.2) * M_PER_DEG, 0, 0.05, 'ngược lat'); near((b - 107.5) * M_PER_DEG, 0, 0.05, 'ngược lon');
  const [c, d] = toWGS84(a, b, 'VN2000');
  near((c - 21.198996242) * M_PER_DEG, 0, 1e-3, 'vòng lat'); near((d - 107.501880013) * M_PER_DEG, 0, 1e-3, 'vòng lon');
  assert.deepEqual(toWGS84(21, 107, 'WGS84').slice(0, 2), [21, 107]);
});

test('Geodesic Vincenty: mẫu Flinders Peak → Buninyong', () => {
  const dms = (d, m, s) => d + m / 60 + s / 3600;
  const r = inverse(-dms(37, 57, 3.7203), dms(144, 25, 29.5244), -dms(37, 39, 10.1561), dms(143, 55, 35.3839));
  near(r.dist, 54972.271, 0.002, 'quãng đường'); near(r.az1, dms(306, 52, 5.37), 1 / 3600, 'phương vị đầu'); near(r.az2, dms(307, 10, 25.07), 1 / 3600, 'phương vị cuối');
});

test('Loxodrom: dọc xích đạo, dọc kinh tuyến, đi rồi về', () => {
  near(rhumb(0, 100, 0, 101).dist, 6371008.8 * Math.PI / 180, 1e-6, 'xích đạo'); near(rhumb(0, 100, 0, 101).brg, 90, 1e-9, 'hướng Đông');
  near(rhumb(10, 107, 11, 107).brg, 0, 1e-9, 'hướng Bắc');
  const r = rhumb(21.0, 107.3, 20.4, 108.0), [la, lo] = rhumbDest(21.0, 107.3, r.brg, r.dist);
  near(la, 20.4, 1e-9, 'lat'); near(lo, 108.0, 1e-9, 'lon');
});

test('Đa giác: diện tích, điểm trong, chuẩn hóa, hộp bao', () => {
  const sq = [[0, 0], [1, 0], [1, 1], [0, 1]];
  assert.equal(area(sq), 1); assert.ok(inside(0.5, 0.5, sq)); assert.ok(!inside(1.5, 0.5, sq));
  const cw = normalize([[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]); assert.equal(cw.length, 4); assert.ok(area(cw) > 0);
  const L = [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]]; assert.ok(inside(0.5, 1.5, L)); assert.ok(!inside(1.5, 1.5, L));
  assert.deepEqual(bbox(L), [0, 0, 2, 2]); assert.ok(bboxIntersects([0, 0, 1, 1], [1, 1, 2, 2])); assert.ok(!bboxIntersects([0, 0, 1, 1], [1.1, 0, 2, 1]));
});
