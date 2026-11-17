// Khối hình cơ bản (thuần JS) theo tọa độ tàu: x về mũi, y sang mạn phải, z lên. Dùng chung cho thân / thượng tầng (model.js)
// và các chi tiết đặt sẵn (fittings.js). Tam giác dựng sao cho sau phép đổi trục của mesh3.js mặt hướng ra ngoài.
import earcut from 'earcut';

// bộ gom đỉnh / tam giác của một màu; win: dải cửa kính [z0, z1] gắn theo từng đỉnh (mesh3 vẽ kính bằng shader)
export class Acc {
  constructor(col, flat, tag) { this.pos = []; this.idx = []; this.col = col; this.flat = !!flat; this.cols = null; this.tag = tag || ''; this.wb = null; this.win = null; }
  v(x, y, z, c) {
    this.pos.push(x, y, z); if (c !== undefined) (this.cols || (this.cols = [])).push(c);
    if (this.wb || this.win) { if (!this.win) this.win = new Array((this.pos.length / 3 - 1) * 2).fill(0); this.win.push(this.wb ? this.wb[0] : 0, this.wb ? this.wb[1] : 0); }
    return this.pos.length / 3 - 1;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }
}
// bộ gom có phép biến đổi: đỉnh cho theo hệ riêng của chi tiết (u về trước, v sang phải, w lên) → tọa độ tàu.
// m: hàm (u, v, w) → [x, y, z] (phép quay đúng chiều nên không đổi hướng mặt); bb: hộp bao chung (cập nhật khi thêm đỉnh)
export class TAcc {
  constructor(inner, m, bb) { this.inner = inner; this.m = m; this.bb = bb || null; }
  v(u, v, w, c) { const p = this.m(u, v, w); const b = this.bb; if (b) { b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.min(b[2], p[2]); b[3] = Math.max(b[3], p[0]); b[4] = Math.max(b[4], p[1]); b[5] = Math.max(b[5], p[2]); } return this.inner.v(p[0], p[1], p[2], c); }
  tri(a, b, c) { this.inner.tri(a, b, c); }
  quad(a, b, c, d) { this.inner.quad(a, b, c, d); }
}
// phép biến đổi của chi tiết: đặt tại (x, y, z), quay rot độ (từ hướng mũi sang mạn phải);
// loc (tùy chọn): trong hệ riêng, ngóc lên el độ quanh trục v tại điểm (du, dv, dw)
export function xform(f, loc) {
  const r = (f.rot || 0) * Math.PI / 180, cr = Math.cos(r), sr = Math.sin(r);
  const e = loc && loc.el ? loc.el * Math.PI / 180 : 0, ce = Math.cos(e), se = Math.sin(e), du = loc ? loc.du || 0 : 0, dv = loc ? loc.dv || 0 : 0, dw = loc ? loc.dw || 0 : 0;
  return (u, v, w) => { if (e) { const u2 = u * ce - w * se, w2 = u * se + w * ce; u = u2; w = w2; } u += du; v += dv; w += dw; return [f.x + u * cr - v * sr, f.y + u * sr + v * cr, f.z + w]; };
}
export const newBB = () => [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];

// ---------- nối các mặt cắt (y, z) dọc theo x ----------
export const sArea = (r) => { let s = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
// bỏ điểm trùng / thẳng hàng, xoay ngược chiều kim đồng hồ (trong mặt y–z)
export function cleanRing(r) {
  let q = r.slice(); if (q.length > 1 && Math.hypot(q[0][0] - q[q.length - 1][0], q[0][1] - q[q.length - 1][1]) < 1e-6) q.pop();
  for (let pass = 0; pass < 2; pass++) { const o = []; for (let i = 0; i < q.length; i++) { const a = q[(i + q.length - 1) % q.length], b = q[i], c = q[(i + 1) % q.length]; const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-5 || Math.abs(cr) < 1e-7) continue; o.push(b); } q = o; }
  if (q.length >= 3 && sArea(q) < 0) q.reverse();
  return q.length >= 3 ? q : null;
}
// lấy mẫu lại vòng theo độ dài cung tại các tham số t ∈ [0, 1)
function resample(r, ts) {
  const n = r.length, cum = [0]; for (let i = 0; i < n; i++) { const a = r[i], b = r[(i + 1) % n]; cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const P = cum[n] || 1; let j = 0;
  return ts.map((t) => { const s = t * P; while (j < n - 1 && cum[j + 1] < s) j++; const a = r[j], b = r[(j + 1) % n], f = (s - cum[j]) / ((cum[j + 1] - cum[j]) || 1); return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; });
}
const params = (r) => { const n = r.length, cum = [0]; for (let i = 0; i < n; i++) { const a = r[i], b = r[(i + 1) % n]; cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1])); } return cum.slice(0, n).map((c) => c / (cum[n] || 1)); };
// nối hai mặt cắt kề nhau: cùng số đỉnh thì nối đỉnh–đỉnh (giữ góc sắc), khác thì lấy mẫu theo cả hai bộ tham số
function pairRings(A, B) {
  let k0 = 0, bd = Infinity; for (let k = 0; k < B.length; k++) { const d = Math.hypot(B[k][0] - A[0][0], B[k][1] - A[0][1]); if (d < bd) { bd = d; k0 = k; } }
  const Bs = B.slice(k0).concat(B.slice(0, k0));
  if (A.length === Bs.length) return [A, Bs];
  const ts = [...new Set([...params(A), ...params(Bs)].map((t) => Math.round(t * 1e6) / 1e6))].sort((a, b) => a - b);
  return [resample(A, ts), resample(Bs, ts)];
}
// mặt đầu / cuối: tam giác hóa (earcut), hướng ra ngoài theo phía (−x ở đầu, +x ở cuối)
function cap(acc, x, ring, end) {
  const flat = ring.flat(), tri = earcut(flat), I = ring.map((p) => acc.v(x, p[0], p[1]));
  for (let t = 0; t < tri.length; t += 3) { let a = tri[t], b = tri[t + 1], c = tri[t + 2]; const cr = (ring[b][0] - ring[a][0]) * (ring[c][1] - ring[a][1]) - (ring[b][1] - ring[a][1]) * (ring[c][0] - ring[a][0]); if ((cr > 0) === end) [b, c] = [c, b]; acc.tri(I[a], I[b], I[c]); }
}
// nối các mặt cắt (mỗi mặt cắt có thể gồm nhiều mảnh) dọc theo x: slices [{ x, rings: [[[y, z]…]…] }]
export function loftRings(acc, slices) {
  const cen = (r) => { let y = 0, z = 0; for (const p of r) { y += p[0]; z += p[1]; } return [y / r.length, z / r.length]; };
  const norm = (s) => ({ x: s.x, rings: s.rings.map(cleanRing).filter(Boolean).sort((a, b) => { const p = cen(a), q = cen(b); return p[0] - q[0] || p[1] - q[1]; }) });
  const S = slices.map(norm).filter((s) => s.rings.length);
  for (let i = 0; i < S.length; i++) {
    const a = S[i], b = S[i + 1], prev = S[i - 1];
    const joinPrev = prev && prev.rings.length === a.rings.length, joinNext = b && b.rings.length === a.rings.length;
    if (!joinPrev) for (const r of a.rings) cap(acc, a.x, r, false);
    if (!joinNext) { for (const r of a.rings) cap(acc, a.x, r, true); continue; }
    for (let k = 0; k < a.rings.length; k++) {
      const [A, B] = pairRings(a.rings[k], b.rings[k]), IA = A.map((p) => acc.v(a.x, p[0], p[1])), IB = B.map((p) => acc.v(b.x, p[0], p[1])), n = A.length;
      for (let j = 0; j < n; j++) { const j2 = (j + 1) % n; acc.quad(IA[j], IB[j], IB[j2], IA[j2]); }
    }
  }
}

// mặt cắt chữ nhật nối dọc theo x: secs [{ x, y0, y1, z0, z1 }]
export function loft(acc, secs) {
  if (secs.length < 2) return;
  const ring = (s) => [acc.v(s.x, s.y1, s.z0), acc.v(s.x, s.y1, s.z1), acc.v(s.x, s.y0, s.z1), acc.v(s.x, s.y0, s.z0)];
  const R = secs.map(ring);
  for (let i = 0; i + 1 < R.length; i++) { const a = R[i], b = R[i + 1]; for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; acc.quad(a[k], b[k], b[k2], a[k2]); } }
  const f = R[0], l = R[R.length - 1]; acc.quad(f[0], f[1], f[2], f[3]); acc.quad(l[3], l[2], l[1], l[0]);
}
// ống đứng: các vòng nằm ngang (tròn r hoặc bầu dục rx × ry) nối từ dưới lên: rings [{ x, y, z, r | rx, ry }]
export function tubeV(acc, rings, seg = 10) {
  const R = rings.map((q) => { const rx = q.rx || q.r, ry = q.ry || q.r, out = []; for (let k = 0; k < seg; k++) { const a = k / seg * 2 * Math.PI; out.push(acc.v(q.x + rx * Math.cos(a), q.y + ry * Math.sin(a), q.z)); } return out; });
  for (let i = 0; i + 1 < R.length; i++) for (let k = 0; k < seg; k++) { const k2 = (k + 1) % seg; acc.quad(R[i][k], R[i + 1][k], R[i + 1][k2], R[i][k2]); }
  const top = rings[rings.length - 1], bot = rings[0], c = acc.v(top.x, top.y, top.z), c0 = acc.v(bot.x, bot.y, bot.z);
  for (let k = 0; k < seg; k++) { acc.tri(R[R.length - 1][(k + 1) % seg], R[R.length - 1][k], c); acc.tri(R[0][k], R[0][(k + 1) % seg], c0); }
}
// trụ (côn) giữa hai điểm bất kỳ
export function cyl(acc, p0, p1, r0, r1 = r0, seg = 10) {
  const ax = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], L = Math.hypot(...ax) || 1, a = ax.map((v) => v / L);
  const t = Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], u = [a[1] * t[2] - a[2] * t[1], a[2] * t[0] - a[0] * t[2], a[0] * t[1] - a[1] * t[0]], ul = Math.hypot(...u); for (let i = 0; i < 3; i++) u[i] /= ul;
  const w = [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]];
  const ring = (p, r) => { const o = []; for (let k = 0; k < seg; k++) { const an = k / seg * 2 * Math.PI, c = Math.cos(an) * r, s = Math.sin(an) * r; o.push(acc.v(p[0] + u[0] * c + w[0] * s, p[1] + u[1] * c + w[1] * s, p[2] + u[2] * c + w[2] * s)); } return o; };
  const A = ring(p0, r0), B = ring(p1, r1);
  for (let k = 0; k < seg; k++) { const k2 = (k + 1) % seg; acc.quad(A[k], B[k], B[k2], A[k2]); }
  const ca = acc.v(...p0), cb = acc.v(...p1); for (let k = 0; k < seg; k++) { acc.tri(A[k], A[(k + 1) % seg], ca); acc.tri(B[(k + 1) % seg], B[k], cb); }
}
export function box(acc, cx, cy, cz, lx, ly, lz) { loft(acc, [{ x: cx - lx / 2, y0: cy - ly / 2, y1: cy + ly / 2, z0: cz - lz / 2, z1: cz + lz / 2 }, { x: cx + lx / 2, y0: cy - ly / 2, y1: cy + ly / 2, z0: cz - lz / 2, z1: cz + lz / 2 }]); }
export function ellipsoid(acc, c, rx, ry, rz, nu = 14, nv = 8) {
  const I = []; for (let j = 0; j <= nv; j++) { const t = j / nv * Math.PI, row = []; for (let i = 0; i < nu; i++) { const p = i / nu * 2 * Math.PI; row.push(acc.v(c[0] + rx * Math.cos(t), c[1] + ry * Math.sin(t) * Math.cos(p), c[2] + rz * Math.sin(t) * Math.sin(p))); } I.push(row); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const i2 = (i + 1) % nu; acc.quad(I[j][i], I[j][i2], I[j + 1][i2], I[j + 1][i]); }
}
