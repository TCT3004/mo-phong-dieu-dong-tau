// Georef hải đồ raster: đa thức pixel ↔ Mercator elipxoit (WGS-84), bậc 1 (affine, xoay/nghiêng được) hoặc bậc 2.
// Hệ số lưu được vào IndexedDB; makeXf dựng lại hàm chuyển đổi. Sai số báo bằng mét thật.
import { llToMerc, mercScale, mercToLL } from '../geo/proj.js';

const terms = (o, u, v) => o === 2 ? [1, u, v, u * u, u * v, v * v] : o === 1 ? [1, u, v] : [1, u];
function solve(A, b) { // khử Gauss có chọn trụ
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-14) return null; [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}
function lsq(rows, vals) {
  const n = rows[0].length, A = Array.from({ length: n }, () => new Array(n).fill(0)), b = new Array(n).fill(0);
  rows.forEach((t, k) => { for (let i = 0; i < n; i++) { b[i] += t[i] * vals[k]; for (let j = 0; j < n; j++) A[i][j] += t[i] * t[j]; } });
  return solve(A, b);
}
const ev = (c, t) => { let s = 0; for (let i = 0; i < c.length; i++) s += c[i] * t[i]; return s; };

function fitOrder(pts, W, H, o) {
  const S = Math.max(W, H), cx = W / 2, cy = H / 2;
  const M = pts.map((p) => p.m), Xc = M.reduce((s, q) => s + q[0], 0) / M.length, Yc = M.reduce((s, q) => s + q[1], 0) / M.length;
  let SM = 1; for (const q of M) SM = Math.max(SM, Math.abs(q[0] - Xc), Math.abs(q[1] - Yc));
  const fr = pts.map((p) => terms(o, (p.x - cx) / S, (p.y - cy) / S)), ir = M.map((q) => terms(o, (q[0] - Xc) / SM, (q[1] - Yc) / SM));
  const ax = lsq(fr, M.map((q) => q[0])), ay = lsq(fr, M.map((q) => q[1])), bx = lsq(ir, pts.map((p) => p.x)), by = lsq(ir, pts.map((p) => p.y));
  if (!ax || !ay || !bx || !by) return null;
  const coef = { order: o, W, H, S, cx, cy, Xc, Yc, SM, ax, ay, bx, by };
  const xf = makeXf(coef); let ss = 0, mx = 0;
  for (const p of pts) { const [X, Y] = xf.pxToMerc(p.x, p.y), e = Math.hypot(X - p.m[0], Y - p.m[1]) / mercScale(p.lat); ss += e * e; mx = Math.max(mx, e); }
  coef.rms = Math.sqrt(ss / pts.length); coef.max = mx;
  return coef;
}
// refs: [{x, y, lat, lon}] theo WGS-84
export function fitGeoref(refs, W, H) {
  const pts = refs.filter((r) => isFinite(r.x) && isFinite(r.y) && isFinite(r.lat) && isFinite(r.lon)).map((r) => ({ ...r, m: llToMerc(r.lat, r.lon) }));
  if (pts.length < 2) return null;
  let best = null;
  if (pts.length === 2) {
    // 2 điểm: tỉ lệ riêng theo 2 trục, không xoay (như georef cũ)
    const [a, b] = pts, sx = (b.m[0] - a.m[0]) / ((b.x - a.x) || 1), sy = (b.m[1] - a.m[1]) / ((b.y - a.y) || 1), S = Math.max(W, H), cx = W / 2, cy = H / 2;
    const X0 = a.m[0] + (cx - a.x) * sx, Y0 = a.m[1] + (cy - a.y) * sy;
    best = { order: 1, W, H, S, cx, cy, Xc: X0, Yc: Y0, SM: S * Math.max(Math.abs(sx), Math.abs(sy)), ax: [X0, sx * S, 0], ay: [Y0, 0, sy * S], rms: 0, max: 0 };
    best.bx = [cx, best.SM / sx, 0]; best.by = [cy, 0, best.SM / sy];
  } else {
    best = fitOrder(pts, W, H, 1);
    // bậc 2 chỉ dùng khi bậc 1 sai quá nửa pixel, bậc 2 tốt hơn rõ rệt và đi-về ổn định trên cả tờ (tránh hệ suy biến khi điểm chuẩn xếp thẳng hàng)
    if (pts.length >= 8 && best) {
      const pxm = pxMeters(best), q = fitOrder(pts, W, H, 2);
      if (q && best.rms > 0.5 * pxm && q.rms < best.rms * 0.7 && stable(q)) best = q;
    }
  }
  if (!best) return null;
  const det = Math.abs(best.ax[1] * best.ay[2] - best.ax[2] * best.ay[1]) / (best.S * best.S);
  best.mpp = Math.sqrt(det);           // m Mercator / pixel ở tâm tờ
  best.n = pts.length;
  return best;
}
function pxMeters(c) { const det = Math.abs(c.ax[1] * c.ay[2] - c.ax[2] * c.ay[1]) / (c.S * c.S), lat = mercToLL(c.ax[0], c.ay[0])[0]; return Math.sqrt(det) / mercScale(lat); }
function stable(c) {
  const xf = makeXf(c);
  for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) { const px = c.W * i / 6, py = c.H * j / 6, [qx, qy] = xf.mercToPx(...xf.pxToMerc(px, py)); if (!(Math.abs(qx - px) < 1 && Math.abs(qy - py) < 1)) return false; }
  return true;
}
// off: dời tay [dx, dy] theo m Mercator
export function makeXf(c, off = [0, 0]) {
  const o = c.order;
  return {
    pxToMerc(px, py) { const t = terms(o, (px - c.cx) / c.S, (py - c.cy) / c.S); return [ev(c.ax, t) + off[0], ev(c.ay, t) + off[1]]; },
    mercToPx(X, Y) { const t = terms(o, (X - off[0] - c.Xc) / c.SM, (Y - off[1] - c.Yc) / c.SM); return [ev(c.bx, t), ev(c.by, t)]; },
    pxToLL(px, py) { const m = this.pxToMerc(px, py); return mercToLL(m[0], m[1]); }
  };
}
