// Dò đường viền trên ảnh sơ đồ tàu (thuần JS, chạy được trong Node để kiểm thử):
// - đũa thần: bấm vào bên trong một vùng (cùng màu) → lấy vùng đó → đường bao
// - khung: kéo khung quanh một chi tiết → lấy bóng nét vẽ trong khung (đã lấp kín phần bên trong) → đường bao ngoài
// Ảnh vào là RGBA (Uint8ClampedArray / Uint8Array) cỡ w × h; kết quả là đa giác theo điểm ảnh.

const lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
const sat = (d, i) => Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);

// tô loang 4 hướng trên mặt nạ "được đi" (pass[i] = 1); trả về mặt nạ vùng đã tô
function flood(pass, w, h, sx, sy) {
  const out = new Uint8Array(w * h); if (sx < 0 || sy < 0 || sx >= w || sy >= h || !pass[sy * w + sx]) return { out, n: 0, edge: false };
  const st = new Int32Array(Math.min(w * h, 1 << 22)); let sp = 0, n = 0, edge = false; st[sp++] = sy * w + sx; out[sy * w + sx] = 1;
  const push = (j) => { if (pass[j] && !out[j]) { out[j] = 1; if (sp < st.length) st[sp++] = j; } };
  while (sp) {
    const i = st[--sp], x = i % w, y = (i - x) / w; n++;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
    if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w);
  }
  return { out, n, edge };
}
// nở mặt nạ r điểm ảnh (vuông)
export function dilate(m, w, h, r = 1) {
  let a = m;
  for (let k = 0; k < r; k++) {
    const b = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (a[i] || (x > 0 && a[i - 1]) || (x < w - 1 && a[i + 1]) || (y > 0 && a[i - w]) || (y < h - 1 && a[i + w])) b[i] = 1; }
    a = b;
  }
  return a;
}
// co mặt nạ r điểm ảnh (ngược của nở)
export function erode(m, w, h, r = 1) { const inv = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) inv[i] = m[i] ? 0 : 1; const d = dilate(inv, w, h, r); for (let i = 0; i < w * h; i++) inv[i] = d[i] ? 0 : 1; return inv; }
// giữ thành phần liên thông lớn nhất (4 hướng)
export function largest(m, w, h) {
  const lab = new Int32Array(w * h), st = new Int32Array(w * h); let best = 0, bestN = 0, id = 0;
  for (let s = 0; s < w * h; s++) {
    if (!m[s] || lab[s]) continue; id++; let sp = 0, n = 0; st[sp++] = s; lab[s] = id;
    while (sp) { const i = st[--sp], x = i % w; n++; for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) if (j >= 0 && j < w * h && m[j] && !lab[j]) { lab[j] = id; st[sp++] = j; } }
    if (n > bestN) { bestN = n; best = id; }
  }
  const out = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) if (lab[i] === best && best) out[i] = 1;
  return { mask: out, n: bestN };
}
// đường bao ngoài của vùng (dò biên Moore 8 hướng) → các tâm điểm ảnh trên biên, theo chiều kim đồng hồ trên ảnh
export function outline(m, w, h) {
  let s = -1; for (let i = 0; i < w * h; i++) if (m[i]) { s = i; break; } if (s < 0) return [];
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x];
  const D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const sx = s % w, sy = (s - sx) / w, pts = [[sx, sy]]; let x = sx, y = sy, dir = 7, guard = 0;
  for (;;) {
    let k = 0, found = false;
    for (; k < 8; k++) { const d = (dir + 6 + k) % 8, nx = x + D[d][0], ny = y + D[d][1]; if (at(nx, ny)) { x = nx; y = ny; dir = d; found = true; break; } }
    if (!found) break; // một điểm ảnh lẻ
    if (x === sx && y === sy) break;
    pts.push([x, y]); if (++guard > 4 * w * h) break;
  }
  return pts;
}
// rút gọn đường gấp khúc hở (Douglas–Peucker, không đệ quy); giữ điểm đầu, bỏ điểm cuối
function dpOpen(arr, eps) {
  const n = arr.length, keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1; const st = [[0, n - 1]];
  while (st.length) {
    const [lo, hi] = st.pop(), p = arr[lo], q = arr[hi], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1; let im = -1, dm = eps;
    for (let i = lo + 1; i < hi; i++) { const d = Math.abs((arr[i][0] - p[0]) * dy - (arr[i][1] - p[1]) * dx) / L; if (d > dm) { dm = d; im = i; } }
    if (im >= 0) { keep[im] = 1; st.push([lo, im], [im, hi]); }
  }
  const out = []; for (let i = 0; i < n - 1; i++) if (keep[i]) out.push(arr[i]); return out;
}
// rút gọn đa giác kín: cắt vòng tại điểm đầu và điểm xa nhất rồi rút gọn từng nửa
export function simplify(pts, eps) {
  const n = pts.length; if (n < 4) return pts.slice();
  let b = 1, bd = -1; for (let i = 1; i < n; i++) { const d = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2; if (d > bd) { bd = d; b = i; } }
  return [...dpOpen(pts.slice(0, b + 1), eps), ...dpOpen(pts.slice(b).concat([pts[0]]), eps)];
}
// tô kín đa giác thành mặt nạ (quét từng hàng, luật chẵn lẻ)
export function fillPoly(pts, w, h) {
  const m = new Uint8Array(w * h); if (!pts || pts.length < 3) return m;
  let y0 = h, y1 = 0; for (const p of pts) { y0 = Math.min(y0, Math.floor(p[1])); y1 = Math.max(y1, Math.ceil(p[1])); }
  for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) {
    const xs = [], yc = y + 0.5; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > yc) !== (b[1] > yc)) xs.push(a[0] + (yc - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
    xs.sort((a, b) => a - b); for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(w - 1, Math.floor(xs[k + 1] - 0.5)); x++) m[y * w + x] = 1;
  }
  return m;
}
// mặt nạ nét vẽ: điểm tối hoặc có màu đậm
export function inkAt(d, i, thr) { return lum(d, i) < thr || (sat(d, i) > 60 && lum(d, i) < 245); }

// đũa thần: vùng cùng màu với điểm bấm (sai khác màu < tol) → đa giác; leak: vùng tràn ra mép ảnh (viền chưa kín)
// skipColor: nét có màu (đường nước xanh, đường kích thước đỏ…) không chặn vùng — chỉ nét đen / xám là viền
export function traceWand(img, w, h, sx, sy, opt = {}) {
  const tol = opt.tol || 48, i0 = (sy * w + sx) * 4, r0 = img[i0], g0 = img[i0 + 1], b0 = img[i0 + 2], t2 = tol * tol, pass = new Uint8Array(w * h);
  const skip = opt.skipColor !== false && sat(img, i0) < 60;
  for (let i = 0, j = 0; i < w * h; i++, j += 4) { const dr = img[j] - r0, dg = img[j + 1] - g0, db = img[j + 2] - b0; if (dr * dr + dg * dg + db * db < t2 || (skip && sat(img, j) > 70)) pass[i] = 1; }
  let grow0 = 0;
  if (skip) { // nét màu cắt qua nét đen để lại lỗ trên viền → làm dày nét đen 1 điểm ảnh cho kín, sau đó nở vùng bù lại
    const wall = new Uint8Array(w * h); for (let i = 0, j = 0; i < w * h; i++, j += 4) if (!pass[i] && sat(img, j) < 70) wall[i] = 1;
    const w2 = dilate(wall, w, h, 1); for (let i = 0; i < w * h; i++) if (w2[i]) pass[i] = 0; grow0 = 1;
  }
  const f = flood(pass, w, h, Math.round(sx), Math.round(sy));
  if (!f.n) return { pts: [], leak: false, n: 0 };
  if (f.edge || f.n > w * h * (opt.maxFrac || 0.6)) return { pts: [], leak: true, n: f.n };
  let m = dilate(f.out, w, h, (opt.grow === undefined ? 1 : opt.grow) + grow0); // bù nửa bề dày nét viền
  // gộp với chi tiết đã có (giữ Shift): nở thêm để lấp khe nét đường tâm giữa hai vùng rồi lấy thành phần lớn nhất
  const eps = opt.eps || Math.max(1, Math.hypot(w, h) / 2500);
  if (opt.base && opt.base.length >= 3) {
    const b = fillPoly(opt.base, w, h), u = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) u[i] = m[i] || b[i] ? 1 : 0;
    const big = largest(erode(dilate(u, w, h, 2), w, h, 2), w, h).mask; let hasB = false, hasN = false;
    for (let i = 0; i < w * h && !(hasB && hasN); i++) if (big[i]) { if (b[i]) hasB = true; if (m[i]) hasN = true; }
    // không liền được với chi tiết cũ (vd: bị cánh gà chắn) → trả vùng mới riêng để làm thêm một chi tiết cùng loại
    if (!(hasB && hasN)) return { pts: simplify(outline(m, w, h), eps), leak: false, n: f.n, separate: true };
    m = big;
  }
  return { pts: simplify(outline(m, w, h), eps), leak: false, n: f.n };
}
// khung: rect [x0,y0,x1,y1] → bóng ngoài của nét vẽ lớn nhất trong khung
export function traceBox(img, w, h, rect, opt = {}) {
  const x0 = Math.max(0, Math.floor(Math.min(rect[0], rect[2]))), y0 = Math.max(0, Math.floor(Math.min(rect[1], rect[3]))), x1 = Math.min(w, Math.ceil(Math.max(rect[0], rect[2]))), y1 = Math.min(h, Math.ceil(Math.max(rect[1], rect[3])));
  const rw = x1 - x0, rh = y1 - y0; if (rw < 4 || rh < 4) return { pts: [] };
  // làm việc trên lưới có viền trống 1 điểm quanh khung để tô nền từ ngoài vào
  const W = rw + 2, H = rh + 2, ink = new Uint8Array(W * H), thr = opt.thr || 150;
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) if (inkAt(img, ((y0 + y) * w + x0 + x) * 4, thr)) ink[(y + 1) * W + x + 1] = 1;
  const ink2 = dilate(ink, W, H, opt.close === undefined ? 1 : opt.close), free = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) free[i] = ink2[i] ? 0 : 1;
  const bg = flood(free, W, H, 0, 0).out, shape = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) shape[i] = bg[i] ? 0 : 1;
  const big = largest(shape, W, H); if (big.n < 6) return { pts: [] };
  const pts = simplify(outline(big.mask, W, H), opt.eps || Math.max(1, Math.hypot(w, h) / 2500)).map(([x, y]) => [x - 1 + x0, y - 1 + y0]);
  return { pts, n: big.n };
}
