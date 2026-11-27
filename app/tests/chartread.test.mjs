// Bộ đọc hải đồ raster (chartread/): dựng hải đồ tổng hợp (chữ số dựng lại từ mẫu, đảo có đường bình độ) rồi đọc lại
import test from 'node:test';
import assert from 'node:assert/strict';
import { label, edt, thin, maskedBlur, paletteInfo } from '../src/chartread/img.js';
import { loadTemplates, templateImage, SLANT } from '../src/chartread/digits.js';
import { readBlock, postFilter } from '../src/chartread/read.js';
import { halfMasks, landElevation } from '../src/chartread/terrain.js';
import { rasterTin, composeGrid, tintBands, cellClasses, cellTints } from '../src/chartread/surface.js';
import { buildDepthModel } from '../src/chartread/model.js';
import { isoLines, isoValues } from '../src/chartread/isobath.js';

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

test('mặt nước giữa hai hòn gần nhau: theo số đo sâu + độ dốc bờ, không nông giả do tam giác nối hai mép bờ', () => {
  // hai hòn (ô 5–20 và 30–45, hàng 10–30), luồng 9 ô ở giữa; số đo 4 m ở hai đầu luồng, 5 m ngoài khơi
  const gw = 60, gh = 40, cell = 4, cl = new Uint8Array(gw * gh).fill(1);
  for (let y = 10; y <= 30; y++) for (let x = 5; x <= 45; x++) if (x <= 20 || x >= 30) cl[y * gw + x] = 3;
  const e = []; for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) { const o = y * gw + x; if (cl[o] === 1 && [o - 1, o + 1, o - gw, o + gw].some((q) => cl[q] === 3)) e.push((x + 0.5) * cell, (y + 0.5) * cell, 0); }
  const snd = [[25, 3, 4], [25, 37, 4], [2, 2, 5], [57, 2, 5], [2, 37, 5], [57, 37, 5], [52, 20, 5], [2, 20, 5]].map(([x, y, v]) => ({ x: (x + 0.5) * cell, y: (y + 0.5) * cell, v, dry: false }));
  const z = composeGrid({ cl, gw, gh, cell, W2: 0, H2: 0, Eland: null, edges: Float32Array.from(e), snd }), d = (x, y) => -z[y * gw + x] / 10;
  // số đo 4 m cách bờ ≈ 8 ô → độ dốc bờ ≈ 4/8; giữa luồng cách bờ 4,5 ô → ≈ 2,2 m (tam giác mép–mép cũ cho ≈ 0,1 m)
  assert.ok(d(25, 20) > 2, 'giữa luồng ' + d(25, 20));
  assert.ok(d(21, 20) < 1.5 && d(21, 20) > 0, 'sát bờ ' + d(21, 20));     // sát bờ về gần 0
  for (const s of snd) assert.ok(Math.abs(d(Math.floor(s.x / cell), Math.floor(s.y / cell)) - s.v) < 0.15, 'đúng số đo ' + s.v);
  for (let o = 0; o < gw * gh; o++) if (cl[o] === 1) assert.ok(z[o] <= -1, 'nước dưới 0');
  assert.ok(d(25, 20) <= 4.05, 'không sâu quá số đo hai đầu ' + d(25, 20));
});

test('luồng nạo vét tô màu sâu hơn hai bên: giữa luồng theo số đo trong luồng, không kéo theo số đo sát mép ngoài luồng', () => {
  // nước xanh đậm (màu 1, 0–2 m) có luồng xanh nhạt (màu 2) cột 26–33; đất từ cột 52; tàu ở giữa luồng hàng 30,
  // hai bên sát mép luồng có số 1,9 và 1,3 (như hải đồ thật), trong luồng 4,1 ở hàng 24 và 4,5 ở hàng 36
  const gw = 60, gh = 60, cell = 4, N = gw * gh, cl = new Uint8Array(N).fill(1), tn = new Uint8Array(N).fill(1);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { const o = y * gw + x; if (x >= 52) { cl[o] = 3; tn[o] = 0; } else if (x >= 26 && x <= 33) tn[o] = 2; }
  const P = (x, y, v) => ({ x: (x + 0.5) * cell, y: (y + 0.5) * cell, v, dry: false });
  const chan = [[30, 3, 4.6], [29, 9, 4.4], [30, 15, 4.8], [30, 24, 4.1], [30, 36, 4.5], [29, 42, 4.2], [30, 48, 4.7], [30, 54, 4.3], [31, 6, 4.5], [28, 50, 4.0]].map((q) => P(...q));
  const bank = [[24, 30, 1.9], [35, 30, 1.3], [15, 5, 1.0], [8, 40, 0.8], [18, 50, 1.5], [40, 10, 1.1], [45, 25, 1.4], [42, 45, 1.6], [48, 55, 0.7], [5, 55, 1.2], [12, 30, 1.0], [38, 38, 1.7], [20, 10, 1.2], [10, 20, 0.9]].map((q) => P(...q));
  const snd = [...chan, ...bank], edges = new Float32Array(0);
  const z = composeGrid({ cl, tn, gw, gh, cell, W2: 0, H2: 0, Eland: null, edges, snd, mpp: 2 }), d = (x, y) => -z[y * gw + x] / 10;
  assert.ok(d(30, 30) > 3.8, 'giữa luồng chỗ tàu ' + d(30, 30));            // cách cũ nội suy ngang qua 1,9 – 1,3 → ≈ 1,7 m
  assert.ok(d(26, 30) >= 2 && d(26, 30) < 3, 'mép luồng ' + d(26, 30));     // sát mép luồng về khoảng 2 m (ranh màu)
  for (let o = 0; o < N; o++) if (cl[o] === 1 && tn[o] === 1) assert.ok(-z[o] / 10 <= 2.01, 'ngoài luồng không sâu quá 2 m');
  for (const s of snd) assert.ok(Math.abs(d(Math.floor(s.x / cell), Math.floor(s.y / cell)) - s.v) < 0.15, 'đúng số đo ' + s.v + ' → ' + d(Math.floor(s.x / cell), Math.floor(s.y / cell)));
  // số đo nông hẳn hơn dải màu chỉ làm hố nông cục bộ
  const z2 = composeGrid({ cl, tn, gw, gh, cell, W2: 0, H2: 0, Eland: null, edges, snd: [...snd, P(30, 18, 0.5)], mpp: 2 }), d2 = (x, y) => -z2[y * gw + x] / 10;
  assert.ok(d2(30, 18) < 1, 'bãi ngầm lẻ ' + d2(30, 18)); assert.ok(Math.abs(d2(30, 30) - d(30, 30)) < 0.05, 'xa bãi ngầm không đổi');
});

test('màu nước từng ô: xếp nông → sâu theo độ sáng, viền răng cưa quanh chữ không tính là màu khác', () => {
  // bảng màu: 1 đen, 2 trắng (> 5 m), 3 xanh nhạt (2–5 m), 4 xanh đậm (0–2 m); chữ đen giữa vùng trắng có viền 1 điểm ảnh màu xanh nhạt
  const pal = new Uint8Array(768); [[1, 0, 0, 0], [2, 255, 255, 255], [3, 232, 255, 255], [4, 200, 255, 255]].forEach(([i, r, g, b]) => pal.set([r, g, b], i * 3));
  const W = 80, H = 80, idx = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) idx[y * W + x] = y >= 40 ? 3 : x < 40 ? 4 : 2;
  for (let y = 9; y <= 21; y++) for (let x = 54; x <= 63; x++) idx[y * W + x] = (y === 9 || y === 21 || x === 54 || x === 63) ? 3 : 1;
  const P = paletteInfo(pal), M = halfMasks(idx, W, H, P, 1), gw = 20, gh = 20, cl = cellClasses(M.cls2, M.W2, M.H2, gw, gh, 4), tn = cellTints(M.tint2, cl, M.W2, M.H2, gw, gh, 4);
  const t = (x, y) => tn[Math.floor(y / 4) * gw + Math.floor(x / 4)];
  assert.ok(t(10, 10) < t(10, 60) && t(10, 60) < t(70, 30), 'thứ tự màu ' + [t(10, 10), t(10, 60), t(70, 30)]);
  for (const [x, y] of [[54, 9], [58, 15], [63, 21], [56, 20]]) assert.equal(t(x, y), t(70, 30), 'quanh chữ ' + x + ',' + y);
});

test('dải độ sâu của màu nước suy từ số đo: tách 0–2 / 2–5 / > 5, không tách được thì thôi', () => {
  const vals = new Map([[1, [0.2, 0.5, 0.8, 1, 1.1, 1.3, 1.5, 1.7, 1.9, 1.8, 1.2]], [2, [2.1, 2.5, 3, 3.4, 3.8, 4, 4.4, 4.8, 4.9, 2.2, 3.1]], [3, [5.2, 6, 7.5, 8, 9, 12, 15, 18, 5.5, 6.6, 7, 1]]]);
  const B = tintBands([1, 2, 3], vals);
  assert.deepEqual([...B].map(([t, b]) => [t, b.L, b.U]), [[1, 0, 2], [2, 2, 5], [3, 5, Infinity]]);
  assert.equal(tintBands([1, 2], new Map([[1, [1, 4, 8, 2, 6, 3, 9, 1, 5, 7]], [2, [2, 7, 1, 9, 3, 8, 4, 6, 5, 2]]])), null);
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

test('đường đẳng sâu: dò nét xám cong trong nước, bỏ đường thẳng dài (lưới kinh vĩ), giá trị theo số đo hai bên, mặt nước đi qua đúng mức', () => {
  const W = 800, H = 800, cell = 4, gw = W / cell, gh = H / cell, pal = PAL.slice(); pal.set([110, 110, 110], 6 * 3);
  const P = paletteInfo(pal), idx = new Uint8Array(W * H), curve = (x) => 400 + 80 * Math.sin(2 * Math.PI * x / 800);
  for (let x = 0; x < W; x++) { const y = Math.round(curve(x)); for (let t = 0; t < 2; t++) idx[(y + t) * W + x] = 6; idx[150 * W + x] = 6; idx[151 * W + x] = 6; }
  const cl = new Uint8Array(gw * gh).fill(1), iso = isoLines(idx, W, H, P, 1, cl, gw, gh, cell);
  assert.ok(iso.off.length >= 2, 'có đường');
  for (const o of iso.c) assert.ok(Math.abs(Math.floor(o / gw) * cell - 150) > 12, 'đường thẳng (lưới kinh vĩ) đã bỏ');
  // số đo: trên đường cong 6–9 m, dưới 12–16 m; quanh đường thẳng cũng 6–9 (đường thẳng không có giá trị)
  const snd = []; for (let y = 30; y < H; y += 72) for (let x = 30; x < W; x += 72) { const dc = y - curve(x); if (Math.abs(dc) < 15) continue; snd.push({ x, y, v: dc < 0 ? 6 + ((x + y) % 4) : 12 + ((x * 3 + y) % 5), dry: false }); }
  const r = isoValues(iso, snd, gw, gh, cell, null, 1), ok = r.lines.filter((l) => l.ok);
  assert.ok(ok.length >= 1 && ok.every((l) => l.v === 10), 'giá trị 10 m: ' + JSON.stringify(r.lines));
  const info = {}, z = composeGrid({ cl, tn: null, gw, gh, cell, W2: 0, H2: 0, Eland: null, edges: new Float32Array(0), snd, mpp: 2, iso, k: 1, info });
  assert.ok(info.isoOk >= 1, 'đếm đường có giá trị');
  let n = 0, bad = 0; for (let x = 20; x < W - 20; x += 8) { const o = Math.floor(curve(x) / cell) * gw + Math.floor(x / cell); n++; if (Math.abs(-z[o] / 10 - 10) > 0.6) bad++; }
  assert.ok(bad <= n * 0.1, 'dọc đường ≈ 10 m (' + bad + '/' + n + ' lệch)');
  for (const s of snd) { const d = -z[Math.floor(s.y / cell) * gw + Math.floor(s.x / cell)] / 10; assert.ok(Math.abs(d - s.v) < 0.15, 'đúng số đo ' + s.v + ' → ' + d); }
  // số đo hai bên không tách được (mọi số 6–9) → đường không có giá trị, không góp điểm
  const r2 = isoValues(iso, snd.map((s) => ({ ...s, v: 6 + (s.x % 3) })), gw, gh, cell, null, 1);
  assert.equal(r2.pts.length, 0, 'không tách được thì bỏ');
});
