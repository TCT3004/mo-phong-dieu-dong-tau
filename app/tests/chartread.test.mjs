// Bộ đọc hải đồ raster (chartread/): dựng hải đồ tổng hợp (chữ số dựng lại từ mẫu, đảo có đường bình độ) rồi đọc lại
import test from 'node:test';
import assert from 'node:assert/strict';
import { label, edt, thin, maskedBlur, paletteInfo } from '../src/chartread/img.js';
import { loadTemplates, templateImage, SLANT } from '../src/chartread/digits.js';
import { readBlock, postFilter } from '../src/chartread/read.js';
import { halfMasks, landElevation } from '../src/chartread/terrain.js';
import { rasterTin, composeGrid } from '../src/chartread/surface.js';
import { buildDepthModel } from '../src/chartread/model.js';

// bảng màu: 0 trắng (nước sâu), 1 đen (chữ), 2 vàng (đất), 3 cam (đường bình độ), 4 xanh lơ (nước nông), 5 xanh lá (bãi)
const PAL = new Uint8Array(768); [[255, 255, 255], [0, 0, 0], [255, 255, 168], [250, 176, 46], [200, 255, 255], [200, 255, 184]].forEach((c, i) => PAL.set(c, i * 3));
function glyph(c, h, set = 'it') { // chữ số h điểm ảnh, dựng lại từ mẫu (ngưỡng ảnh mờ), nghiêng như chữ đo sâu
  const v = templateImage(c, set); let mx = 0; for (const a of v) mx = Math.max(mx, a);
  let x0 = 24, x1 = -1, y0 = 24, y1 = -1; for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) if (v[y * 24 + x] > 0.4 * mx) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const sh = set === 'it' ? SLANT : 0, k = h / (y1 - y0 + 1), w = Math.round((x1 - x0 + 1) * k), W2 = w + Math.ceil(sh * h) + 1, out = new Uint8Array(W2 * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const sx = x0 + Math.floor(x / k), sy = y0 + Math.floor(y / k); if (v[sy * 24 + sx] > 0.4 * mx) out[y * W2 + x + Math.round(sh * (h - 1 - y))] = 1; }
  return { out, w: W2, h };
}
function paint(img, W, g, x, y) { for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) if (g.out[j * g.w + i]) img[(y + j) * W + x + i] = 1; return g.w; }
// số đo sâu kiểu hải đồ: phần nguyên cao 20, chữ số lẻ cao 16 thấp hơn 6 điểm ảnh; dry = gạch chân
function sounding(img, W, x, y, txt, dry) {
  const [a, b] = txt.split(','); let cx = x;
  for (const c of a) cx += paint(img, W, glyph(c, 20), cx, y) - 2;
  if (b) cx += paint(img, W, glyph(b, 16), cx + 1, y + 10) - 3;
  if (dry) for (let i = x; i < cx + 4; i++) { img[(y + 29) * W + i] = 1; img[(y + 30) * W + i] = 1; }
}

test('nền xử lý ảnh: thành phần liên thông, khoảng cách Euclid, làm mảnh, làm mờ có mặt nạ', () => {
  const W = 40, H = 30, m = new Uint8Array(W * H);
  for (let y = 5; y < 10; y++) for (let x = 5; x < 10; x++) m[y * W + x] = 1;
  for (let y = 15; y < 25; y++) for (let x = 20; x < 35; x++) m[y * W + x] = 1;
  const L = label(m, W, H); assert.equal(L.n - 1, 2); assert.equal(L.st[1 * 5 + 4], 25);
  const src = new Uint8Array(W * H); src[0] = 1; const D = edt(src, W, H).D; assert.ok(Math.abs(D[3 * W + 4] - 5) < 1e-6);
  const bar = new Uint8Array(W * H); for (let y = 10; y < 15; y++) for (let x = 3; x < 37; x++) bar[y * W + x] = 1;
  const t = thin(bar, W, H); for (let x = 8; x < 32; x++) { let c = 0; for (let y = 0; y < H; y++) c += t[y * W + x]; assert.equal(c, 1); }
  const v = new Float32Array(W * H).fill(7), mk = new Uint8Array(W * H).fill(1); const b = maskedBlur(v, mk, W, H, 3); assert.ok(Math.abs(b[15 * W + 20] - 7) < 1e-4);
});

test('đọc số đo sâu: phần nguyên + chữ số lẻ thấp hơn, gạch chân = độ cao bãi cạn, vị trí giữa phần nguyên', async () => {
  await loadTemplates();
  const W = 900, H = 260, img = new Uint8Array(W * H), cases = [['12,6', false], ['7', false], ['23,5', false], ['0,4', true], ['16', false], ['9,8', false], ['3,2', false], ['18,4', false]];
  cases.forEach(([t, d], i) => sounding(img, W, 40 + (i % 4) * 210, 40 + Math.floor(i / 4) * 110, t, d));
  const P = paletteInfo(PAL), r = readBlock(img, W, H, P, 1, 0, 0, W, H, [0, 0, W, H]);
  const got = r.snd.map((o) => (o.dry ? '-' : '') + String(o.v)).sort(), want = cases.map(([t, d]) => (d ? '-' : '') + String(parseFloat(t.replace(',', '.')))).sort();
  assert.deepEqual(got, want);
  const s = r.snd.find((o) => o.v === 7); assert.ok(Math.abs(s.x - (40 + 210 + 8)) < 6 && Math.abs(s.y - 50) < 6, 'vị trí số 7 ' + s.x + ',' + s.y);
});

test('lọc: số lệch hẳn các số xung quanh bị đánh dấu nghi, số trong vùng bãi là độ cao bãi cạn', () => {
  const snd = []; for (let i = 0; i < 9; i++) snd.push({ x: (i % 3) * 120, y: Math.floor(i / 3) * 120, v: i === 4 ? 92 : 10 + (i % 2), txt: '10', h: 20, bg: 'water' });
  snd.push({ x: 600, y: 0, v: 0.8, txt: '0_8', h: 20, bg: 'flat' });
  const k = postFilter(snd, 1); assert.ok(k.find((o) => o.v === 92).suspect); assert.ok(!k.find((o) => o.v === 10).suspect); assert.ok(k.find((o) => o.v === 0.8).dry);
});

// đảo tròn: vàng, mép xanh lá, đường bình độ cam mỗi 60 điểm ảnh (bước 50 m), đỉnh 180 m
function islandChart() {
  const W = 1000, H = 1000, img = new Uint8Array(W * H), cx = 500, cy = 500;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = Math.hypot(x - cx, y - cy), o = y * W + x;
    if (r < 300) img[o] = Math.abs(r - 240) < 1.2 || Math.abs(r - 180) < 1.2 || Math.abs(r - 120) < 1.2 ? 3 : 2;
    else if (r < 318) img[o] = 5; else if (r < 400) img[o] = 4; else img[o] = 0;
  }
  for (let y = 495; y < 505; y++) for (let x = 0; x < W; x++) if (Math.abs(x - cx) > 30 && img[y * W + x] === 1) img[y * W + x] = 2;
  return { W, H, img };
}
test('núi theo đường bình độ: khoảng cao đều suy từ điểm độ cao, đỉnh đúng số, mép bờ đúng nét bờ', async () => {
  const { W, H, img } = islandChart(), P = paletteInfo(PAL), M = halfMasks(img, W, H, P, 1);
  const hts = [{ x: 500, y: 500, v: 180, kind: 0 }, { x: 500, y: 290, v: 70, kind: 0 }, { x: 290, y: 500, v: 120, kind: 0 }];
  const T = landElevation(M, hts, 2, 3, 1);
  assert.equal(T.interval, 50); assert.equal(T.levels, 3);
  const at = (x, y) => T.E[(y >> 1) * M.W2 + (x >> 1)];
  assert.ok(Math.abs(at(500, 500) - 180) < 12, 'đỉnh ' + at(500, 500));
  assert.ok(at(500, 205) < at(500, 260) && at(500, 260) < at(500, 330) + 200 && at(500, 205) > 3, 'sườn tăng dần vào trong');
  for (const r of [60, 120, 180, 240]) assert.ok(at(500 + r, 500) < at(500 + r - 50, 500) + 1, 'thấp dần ra bờ ở r=' + r);
  assert.ok(at(500, 206) < 15, 'sát bờ thấp: ' + at(500, 206));
  assert.ok(!T.land[(500 >> 1) * M.W2 + (812 >> 1)] && T.land[(500 >> 1) * M.W2 + (796 >> 1)], 'mép đất đúng bán kính 300');
});

test('mặt đáy: tam giác qua điểm đo tái tạo đúng mặt phẳng; nước luôn dưới 0, bãi từ 0 tới mép bờ', () => {
  const gw = 50, gh = 40, cell = 4, pts = [], z = new Int16Array(gw * gh), wet = new Uint8Array(gw * gh).fill(1);
  for (const [x, y] of [[0, 0], [200, 0], [0, 160], [200, 160], [100, 80]]) pts.push(x, y, -(5 + x * 0.02 + y * 0.05));
  rasterTin(Float32Array.from(pts), gw, gh, cell, wet, z);
  const o = 20 * gw + 25, x = (25 + 0.5) * cell, y = (20 + 0.5) * cell; assert.ok(Math.abs(z[o] / 10 + (5 + x * 0.02 + y * 0.05)) < 0.11);
  const cl = new Uint8Array(gw * gh).fill(1); for (let i = 0; i < gw; i++) cl[i] = 2; for (let i = gw * (gh - 1); i < gw * gh; i++) cl[i] = 3;
  const edges = Float32Array.from([0, 0, 0, 200, 0, 0, 0, 158, 3, 200, 158, 3]);
  const zz = composeGrid({ cl, gw, gh, cell, W2: 0, H2: 0, Eland: null, edges, snd: [{ x: 100, y: 80, v: -2, dry: false }] });
  for (let i = 0; i < gw * gh; i++) { if (cl[i] === 1) assert.ok(zz[i] <= -1, 'nước ' + zz[i]); if (cl[i] === 2) assert.ok(zz[i] >= 0 && zz[i] <= 30); }
});

test('dựng cả tờ: số đo sâu + đảo → lưới z (nước âm theo số, đất cao, viền đúng)', async () => {
  const { W, H, img } = islandChart();
  for (const [x, y, t] of [[60, 60, '12'], [880, 80, '14'], [60, 880, '11'], [870, 900, '13'], [430, 900, '9,8'], [900, 480, '10,6'], [40, 470, '12,4'], [450, 30, '15']]) sounding(img, W, x, y, t, false);
  const m = await buildDepthModel(img, W, H, PAL, { du: 250, mpp: 2, hts: [{ x: 500, y: 500, v: 180, kind: 0 }, { x: 500, y: 290, v: 70, kind: 0 }, { x: 290, y: 500, v: 120, kind: 0 }] });
  assert.equal(m.snd.length, 8, JSON.stringify(m.snd.map((s) => [s.x | 0, s.y | 0, s.v])));
  const zAt = (x, y) => m.z[Math.floor(y / m.cell) * m.gw + Math.floor(x / m.cell)] / 10;
  assert.ok(zAt(500, 500) > 150, 'đỉnh ' + zAt(500, 500));
  assert.ok(zAt(70, 70) < -10 && zAt(70, 70) > -14, 'nước gần số 12: ' + zAt(70, 70));
  assert.ok(zAt(500, 830) < 0 && zAt(500, 812) >= 0 && zAt(500, 812) <= m.hc && zAt(500, 790) > m.hc - 0.2, 'viền: ' + zAt(500, 830) + ' / ' + zAt(500, 812) + ' / ' + zAt(500, 790));
});
