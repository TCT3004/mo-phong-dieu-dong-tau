// Phép xử lý ảnh nền cho bộ đọc hải đồ: bảng màu → lớp, thành phần liên thông, giãn / co, khoảng cách Euclid, làm mảnh nét.
// Module thuần (không DOM): chạy trong worker và trong Node.

// ---------- bảng màu ----------
// lớp nền: 0 chưa rõ (chữ, nét, ký hiệu), 1 nước, 2 bãi / rừng ngập (xanh lá), 3 đất (vàng, kể cả đường bình độ cam)
export function paletteInfo(pal) {
  const n = 256, lum = new Float32Array(n), cls = new Uint8Array(n), core = new Uint8Array(n), soft = new Uint8Array(n),
    orange = new Uint8Array(n), white = new Uint8Array(n), dark = new Uint8Array(n), land = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = pal[i * 3], g = pal[i * 3 + 1], b = pal[i * 3 + 2], L = 0.299 * r + 0.587 * g + 0.114 * b, sat = Math.max(r, g, b) - Math.min(r, g, b);
    lum[i] = L; dark[i] = Math.max(0, Math.min(255, Math.round(255 - L)));
    core[i] = L < 80 && sat < 60 ? 1 : 0; soft[i] = L < 175 && sat < 70 ? 1 : 0;
    if (L > 185 && b >= 215) cls[i] = 1;
    else if (L > 185 && b < 215 && g > 235 && r < 225) cls[i] = 2;
    else if (L > 170 && b < 200 && r > 230) cls[i] = 3;
    land[i] = cls[i] === 3 ? 1 : 0;
    orange[i] = r > 230 && g < 246 && b < 160 && r - b > 80 ? 1 : 0;
    white[i] = r > 250 && g > 250 && b > 250 ? 1 : 0;
  }
  return { lum, cls, core, soft, orange, white, dark, land, pal };
}

// màu nước (tô theo dải độ sâu: thường xanh đậm 0–2 m, xanh nhạt 2–5 m, trắng > 5 m) → số hiệu 1…n theo độ sáng tăng dần
// (tối hơn = nông hơn); màu nước phụ (ít điểm ảnh) gộp vào màu chính gần nhất. Trả { TI: Uint8 (chỉ số màu → số hiệu, 0 = không phải nước), n }
export function waterTintIds(idx, P) {
  const cnt = new Float64Array(256); for (let i = 0; i < idx.length; i += 7) cnt[idx[i]]++;
  const rgb = (k) => [P.pal[k * 3], P.pal[k * 3 + 1], P.pal[k * 3 + 2]], dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  let tot = 0; for (let k = 0; k < 256; k++) if (P.cls[k] === 1) tot += cnt[k];
  const major = []; for (let k = 0; k < 256; k++) if (P.cls[k] === 1 && cnt[k] >= tot * 0.03) major.push(k);
  major.sort((a, b) => P.lum[a] - P.lum[b]);
  const groups = []; for (const k of major) { const g = groups.find((q) => dist(rgb(q[0]), rgb(k)) < 8); if (g) g.push(k); else if (groups.length < 7) groups.push([k]); }
  const TI = new Uint8Array(256);
  for (let k = 0; k < 256; k++) { if (P.cls[k] !== 1 || !groups.length) continue; let bi = 0, bd = Infinity; groups.forEach((g, i) => { const d = dist(rgb(g[0]), rgb(k)); if (d < bd) { bd = d; bi = i; } }); TI[k] = bi + 1; }
  return { TI, n: groups.length };
}

// ---------- thành phần liên thông (hai lượt, gộp bằng cây) ----------
// mask Uint8 (≠0 là nền trước) → { lab Int32 (0 nền), n (số nhãn + 1), st Int32 [x0, y0, x1, y1, diện tích] × n }
export function label(mask, W, H, conn8 = true) {
  const lab = new Int32Array(W * H); let par = new Int32Array(1024); let nl = 1;
  const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) { if (a < b) par[b] = a; else par[a] = b; } };
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) {
      if (!mask[o + x]) continue;
      let l = x ? lab[o + x - 1] : 0;
      const up = y ? lab[o - W + x] : 0; if (up) { if (!l) l = up; else if (up !== l) uni(l, up); }
      if (conn8 && y) {
        const ul = x ? lab[o - W + x - 1] : 0; if (ul) { if (!l) l = ul; else if (ul !== l) uni(l, ul); }
        const ur = x < W - 1 ? lab[o - W + x + 1] : 0; if (ur) { if (!l) l = ur; else if (ur !== l) uni(l, ur); }
      }
      if (!l) { if (nl >= par.length) { const p2 = new Int32Array(par.length * 2); p2.set(par); par = p2; } par[nl] = nl; l = nl++; }
      lab[o + x] = l;
    }
  }
  const map = new Int32Array(nl); let n = 1;
  for (let i = 1; i < nl; i++) { const r = find(i); if (r === i) map[i] = n++; }
  for (let i = 1; i < nl; i++) map[i] = map[find(i)];
  const st = new Int32Array(n * 5);
  for (let k = 1; k < n; k++) { st[k * 5] = W; st[k * 5 + 1] = H; st[k * 5 + 2] = -1; st[k * 5 + 3] = -1; }
  for (let y = 0; y < H; y++) for (let x = 0, o = y * W; x < W; x++) {
    const v = lab[o + x]; if (!v) continue; const k = map[v]; lab[o + x] = k; const s = k * 5;
    if (x < st[s]) st[s] = x; if (y < st[s + 1]) st[s + 1] = y; if (x > st[s + 2]) st[s + 2] = x; if (y > st[s + 3]) st[s + 3] = y; st[s + 4]++;
  }
  return { lab, n, st };
}

// ---------- giãn / co nhị phân theo hộp vuông cạnh k (k lẻ) ----------
function boxMax(src, W, H, r, horiz) {
  const out = new Uint8Array(W * H);
  if (horiz) for (let y = 0; y < H; y++) { const o = y * W; let cnt = 0; for (let x = -r; x < W; x++) { const a = x + r, b = x - r - 1; if (a < W && src[o + a]) cnt++; if (b >= 0 && src[o + b]) cnt--; if (x >= 0 && cnt > 0) out[o + x] = 1; } }
  else for (let x = 0; x < W; x++) { let cnt = 0; for (let y = -r; y < H; y++) { const a = y + r, b = y - r - 1; if (a < H && src[a * W + x]) cnt++; if (b >= 0 && src[b * W + x]) cnt--; if (y >= 0 && cnt > 0) out[y * W + x] = 1; } }
  return out;
}
export function dilate(m, W, H, k) { if (k <= 1) return m.slice(); const r = k >> 1; return boxMax(boxMax(m, W, H, r, true), W, H, r, false); }
export function erode(m, W, H, k) { const inv = new Uint8Array(W * H); for (let i = 0; i < inv.length; i++) inv[i] = m[i] ? 0 : 1; const d = dilate(inv, W, H, k); for (let i = 0; i < d.length; i++) d[i] = d[i] ? 0 : 1; return d; }
export const open = (m, W, H, k) => dilate(erode(m, W, H, k), W, H, k);
export const close = (m, W, H, k) => erode(dilate(m, W, H, k), W, H, k);

// ---------- khoảng cách Euclid (Felzenszwalb) ----------
// src: điểm nguồn (≠0). Trả về khoảng cách (điểm ảnh) tới nguồn gần nhất; withIdx thì kèm chỉ số điểm nguồn gần nhất.
// Có thể giới hạn trong khung [x0, y0, x1, y1) để tiết kiệm (nguồn ngoài khung bị bỏ qua).
const INF = 1e20;
function edt1(f, n, d, v, z, idxIn, idxOut) {
  let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    if (f[q] >= INF) continue;
    if (f[v[k]] >= INF) { v[k] = q; z[k] = -INF; z[k + 1] = INF; continue; }
    let s;
    for (;;) { const p = v[k]; s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p); if (s <= z[k] && k > 0) k--; else break; }
    if (s <= z[k]) { v[k] = q; z[k] = -INF; z[k + 1] = INF; continue; }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  if (f[v[0]] >= INF) { for (let q = 0; q < n; q++) { d[q] = INF; if (idxOut) idxOut[q] = -1; } return; }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const p = v[k]; d[q] = (q - p) * (q - p) + f[p]; if (idxOut) idxOut[q] = idxIn ? idxIn[p] : p; }
}
export function edt(src, W, H, withIdx = false, box = null) {
  const [x0, y0, x1, y1] = box || [0, 0, W, H], w = x1 - x0, h = y1 - y0, N = Math.max(w, h);
  const D = new Float32Array(w * h), I = withIdx ? new Int32Array(w * h) : null;
  const f = new Float64Array(N), d = new Float64Array(N), v = new Int32Array(N), z = new Float64Array(N + 1);
  const ii = withIdx ? new Int32Array(N) : null, io = withIdx ? new Int32Array(N) : null;
  // theo cột
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) { const s = src[(y + y0) * W + x + x0]; f[y] = s ? 0 : INF; if (ii) ii[y] = (y + y0) * W + x + x0; }
    edt1(f, h, d, v, z, ii, io);
    for (let y = 0; y < h; y++) { D[y * w + x] = d[y]; if (I) I[y * w + x] = io[y]; }
  }
  // theo hàng
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) { f[x] = D[y * w + x]; if (ii) ii[x] = I[y * w + x]; }
    edt1(f, w, d, v, z, ii, io);
    for (let x = 0; x < w; x++) { D[y * w + x] = d[x] >= INF ? 1e9 : Math.sqrt(d[x]); if (I) I[y * w + x] = io[x]; }
  }
  return { D, I, w, h, x0, y0 };
}

// ---------- làm mảnh nét (Zhang–Suen), chỉ duyệt điểm nền trước ----------
export function thin(mask, W, H) {
  const m = mask.slice(); let pts = []; for (let i = 0; i < m.length; i++) if (m[i]) { const x = i % W, y = (i / W) | 0; if (x > 0 && y > 0 && x < W - 1 && y < H - 1) pts.push(i); else m[i] = 0; }
  const del = [];
  for (let iter = 0; iter < 60; iter++) {
    let changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (const i of pts) {
        if (!m[i]) continue;
        const p2 = m[i - W], p3 = m[i - W + 1], p4 = m[i + 1], p5 = m[i + W + 1], p6 = m[i + W], p7 = m[i + W - 1], p8 = m[i - 1], p9 = m[i - W - 1];
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9; if (B < 2 || B > 6) continue;
        const A = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2); if (A !== 1) continue;
        if (pass === 0 ? (p2 * p4 * p6 || p4 * p6 * p8) : (p2 * p4 * p8 || p2 * p6 * p8)) continue;
        del.push(i);
      }
      if (del.length) { changed = true; for (const i of del) m[i] = 0; }
    }
    if (!changed) break;
    pts = pts.filter((i) => m[i]);
  }
  return m;
}

// ---------- thu nhỏ ½ ----------
// mặt nạ: điểm thu nhỏ = 1 nếu bất kỳ điểm nào trong 2×2 = 1
export function halfOr(m, W, H) {
  const W2 = Math.ceil(W / 2), H2 = Math.ceil(H / 2), o = new Uint8Array(W2 * H2);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y * W + x]) o[(y >> 1) * W2 + (x >> 1)] = 1;
  return o;
}

// lấp điểm chưa rõ (giá trị 0) bằng giá trị của điểm đã rõ gần nhất
export function fillNearest(a, W, H) {
  const known = new Uint8Array(W * H); let any = false; for (let i = 0; i < a.length; i++) if (a[i]) { known[i] = 1; any = true; }
  if (!any) return a;
  const { I } = edt(known, W, H, true);
  for (let i = 0; i < a.length; i++) if (!a[i]) a[i] = a[I[i]];
  return a;
}

// làm mờ gần Gauss (3 lượt trung bình hộp) có trọng số theo mặt nạ: giá trị ngoài mặt nạ không lan vào
function boxPass(a, W, H, r, horiz) {
  const o = new Float32Array(W * H), n = 2 * r + 1;
  if (horiz) for (let y = 0; y < H; y++) { const b = y * W; let s = 0; for (let x = -r; x < W + r; x++) { const ai = x + r; if (ai < W) s += a[b + ai]; if (x - r - 1 >= 0) s -= a[b + x - r - 1]; if (x >= 0 && x < W) o[b + x] = s / n; } }
  else for (let x = 0; x < W; x++) { let s = 0; for (let y = -r; y < H + r; y++) { const ai = y + r; if (ai < H) s += a[ai * W + x]; if (y - r - 1 >= 0) s -= a[(y - r - 1) * W + x]; if (y >= 0 && y < H) o[y * W + x] = s / n; } }
  return o;
}
export function maskedBlur(v, mask, W, H, sigma) {
  const r = Math.max(1, Math.round(Math.sqrt(4 * sigma * sigma / 3 + 1) / 2 - 0.5 + 0.5));
  let num = new Float32Array(W * H), den = new Float32Array(W * H);
  for (let i = 0; i < num.length; i++) if (mask[i]) { num[i] = v[i]; den[i] = 1; }
  for (let p = 0; p < 3; p++) { num = boxPass(boxPass(num, W, H, r, true), W, H, r, false); den = boxPass(boxPass(den, W, H, r, true), W, H, r, false); }
  const out = new Float32Array(W * H);
  for (let i = 0; i < out.length; i++) out[i] = mask[i] ? num[i] / Math.max(den[i], 1e-4) : v[i];
  return out;
}

// điểm ảnh màu nước «sạch» để lấy màu vùng: chính nó và các điểm cách 1–2 điểm ảnh theo 4 hướng đều là màu nước
// (bỏ viền răng cưa quanh chữ số / nét vẽ — màu lượng tử của viền có thể trùng màu tô một dải độ sâu khác)
export function pureWater(idx, W, H, i, cls) {
  const x = i % W, y = (i - x) / W; if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) return false;
  return cls[idx[i - 1]] === 1 && cls[idx[i + 1]] === 1 && cls[idx[i - W]] === 1 && cls[idx[i + W]] === 1 &&
    cls[idx[i - 2]] === 1 && cls[idx[i + 2]] === 1 && cls[idx[i - 2 * W]] === 1 && cls[idx[i + 2 * W]] === 1;
}
