// Tỷ lệ và hệ tọa độ của từng hình chiếu: mốc (mũi, lái, đáy ky, mép trái / phải) + các số đo người dùng ghi → đổi điểm ảnh ↔ mét.
// Tọa độ tàu: x về mũi (gốc ở giữa chiều dài), y sang mạn phải, z lên (gốc ở đáy ky).
// side: (x, z) · top: (x, y) · front / back: (y, z). Thuần JS.

export const VIEW_KINDS = { side: 'Nhìn ngang mạn', top: 'Nhìn từ trên (mặt boong)', front: 'Nhìn từ mũi', back: 'Nhìn từ lái' };
export const REF_NAMES = { bow: 'Mũi', stern: 'Lái', base: 'Đáy ky', left: 'Mép trái hình', right: 'Mép phải hình' };
export const REFS = { side: ['bow', 'stern', 'base'], top: ['bow', 'stern'], front: ['left', 'right', 'base'], back: ['left', 'right', 'base'] };

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], dot = (a, b) => a[0] * b[0] + a[1] * b[1];

// view: { kind, refs: { bow, stern, base, left, right }, dims: [{ a, b, m }] }; ship: { L (LOA), B }
// → { ok, msg, su, sv, toShip([px,py]) → [h, v], toPx([h, v]), res: [sai số % từng số đo], noBase }
export function calibrate(view, ship) {
  const r = view.refs || {}, lon = view.kind === 'side' || view.kind === 'top';
  const A = lon ? r.stern : r.left, Bp = lon ? r.bow : r.right;
  if (!A || !Bp) return { ok: false, msg: lon ? 'Chưa đặt mốc mũi và lái' : 'Chưa đặt mốc mép trái và mép phải' };
  const len = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]); if (len < 5) return { ok: false, msg: 'Hai mốc quá gần nhau' };
  const d = [(Bp[0] - A[0]) / len, (Bp[1] - A[1]) / len];
  // pháp tuyến: hình mạn / mũi / lái: hướng lên trên màn hình; mặt boong: hướng sang mạn phải (mũi quay phải thì mạn phải ở dưới)
  let n = [-d[1], d[0]]; if (view.kind !== 'top' && n[1] > 0) n = [-n[0], -n[1]];
  const refLen = lon ? +ship.L : +ship.B;
  // bình phương tối thiểu cho (su², sv²): (du·su)² + (dv·sv)² = m²; mốc tính như một số đo (trọng số nhỏ hơn khi đã có số đo)
  const dims = (view.dims || []).filter((q) => q.a && q.b && q.m > 0), rows = dims.map((q) => { const v = sub(q.b, q.a); return [dot(v, d) ** 2, dot(v, n) ** 2, q.m * q.m, 1]; });
  if (refLen > 0) rows.push([len * len, 0, refLen * refLen, dims.length ? 0.3 : 1]);
  if (!rows.length) return { ok: false, msg: 'Chưa có kích thước để lấy tỷ lệ' };
  let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0, hasV = false;
  for (const [p, q, m2, w] of rows) { const s = 1 / Math.max(1, m2); a11 += w * p * p * s; a12 += w * p * q * s; a22 += w * q * q * s; b1 += w * p * m2 * s; b2 += w * q * m2 * s; if (q > p * 0.25) hasV = true; }
  let su2, sv2;
  const det = a11 * a22 - a12 * a12;
  if (hasV && det > 1e-12 * a11 * a22) { su2 = (b1 * a22 - b2 * a12) / det; sv2 = (a11 * b2 - a12 * b1) / det; }
  if (!(su2 > 0 && sv2 > 0) || !hasV) { let num = 0, den = 0; for (const [p, q, m2, w] of rows) { num += w * (p + q) * m2 / Math.max(1, m2); den += w * (p + q) ** 2 / Math.max(1, m2); } su2 = sv2 = num / den; }
  let su = Math.sqrt(su2), sv = Math.sqrt(sv2); sv = Math.max(su * 0.5, Math.min(su * 2, sv));
  const res = dims.map((q) => { const v = sub(q.b, q.a), L = Math.hypot(dot(v, d) * su, dot(v, n) * sv); return (L - q.m) / q.m * 100; });
  // gốc: giữa hai mốc; độ cao tính từ đường đáy ky (đường song song trục, qua mốc đáy ky)
  const mid = [(A[0] + Bp[0]) / 2, (A[1] + Bp[1]) / 2], noBase = view.kind !== 'top' && !r.base;
  const O = view.kind === 'top' || !r.base ? mid : [mid[0] + n[0] * dot(sub(r.base, mid), n), mid[1] + n[1] * dot(sub(r.base, mid), n)];
  const hs = view.kind === 'front' ? -1 : 1; // nhìn từ mũi: bên trái hình là mạn phải
  return {
    ok: true, su, sv, res, noBase, d, n, refLen, lenPx: len,
    toShip: (p) => { const v = sub(p, O); return [hs * dot(v, d) * su, dot(v, n) * sv]; },
    toPx: (q) => { const u = hs * q[0] / su, w = q[1] / sv; return [O[0] + d[0] * u + n[0] * w, O[1] + d[1] * u + n[1] * w]; }
  };
}
// độ dài số đo theo tỷ lệ hiện có (để điền sẵn ô kích thước)
export function measure(cal, a, b) { if (!cal || !cal.ok) return 0; const p = cal.toShip(a), q = cal.toShip(b); return Math.hypot(q[0] - p[0], q[1] - p[1]); }
