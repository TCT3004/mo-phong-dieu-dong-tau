// Dựng mô hình 3D tàu từ các chi tiết đã vẽ trên 1–3 hình chiếu (thuần JS: ra mảng đỉnh / tam giác theo tọa độ tàu).
// Tọa độ tàu: x về mũi (gốc giữa chiều dài), y sang mạn phải, z lên từ đáy ky; đường nước ở z = T.
// Thiếu hình chiếu thì tự suy: chỉ có hình mạn → bề rộng theo B và hệ số béo; chỉ có mặt boong → chiều cao theo mạn khô / số tầng;
// không có mặt cắt → dáng sườn theo hệ số béo, mũi thon dần thành chữ V. Trái phải đối xứng.
import { resolve, SHADES, ANTIFOUL, BOOT } from './parts.js';
import { calibrate } from './calib.js';

class Acc {
  constructor(col, flat) { this.pos = []; this.idx = []; this.col = col; this.flat = !!flat; this.cols = null; }
  v(x, y, z, c) { this.pos.push(x, y, z); if (c !== undefined) (this.cols || (this.cols = [])).push(c); return this.pos.length / 3 - 1; }
  tri(a, b, c) { this.idx.push(a, b, c); }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }
}
// cắt đa giác bằng đường thẳng đứng h = x → [v nhỏ nhất, v lớn nhất] (null nếu không cắt)
export function atH(poly, x, closed = true) {
  let lo = Infinity, hi = -Infinity; const n = poly.length, m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) { const a = poly[i], b = poly[(i + 1) % n]; if ((a[0] <= x && b[0] >= x) || (b[0] <= x && a[0] >= x)) { const t = b[0] === a[0] ? 0.5 : (x - a[0]) / (b[0] - a[0]), v = a[1] + (b[1] - a[1]) * t; lo = Math.min(lo, v); hi = Math.max(hi, v); } }
  return lo <= hi ? [lo, hi] : null;
}
// cắt bằng đường nằm ngang v = z → [h nhỏ nhất, h lớn nhất]
export function atV(poly, z, closed = true) { return atH(poly.map((p) => [p[1], p[0]]), z, closed); }
const bbox = (p) => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const q of p) { a = Math.min(a, q[0]); b = Math.min(b, q[1]); c = Math.max(c, q[0]); d = Math.max(d, q[1]); } return [a, b, c, d]; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function polyArea(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; }

// ---------- khối hình cơ bản ----------
// mặt cắt chữ nhật nối dọc theo x: secs [{ x, y0, y1, z0, z1 }]
function loft(acc, secs) {
  if (secs.length < 2) return;
  const ring = (s) => [acc.v(s.x, s.y1, s.z0), acc.v(s.x, s.y1, s.z1), acc.v(s.x, s.y0, s.z1), acc.v(s.x, s.y0, s.z0)];
  const R = secs.map(ring);
  for (let i = 0; i + 1 < R.length; i++) { const a = R[i], b = R[i + 1]; for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; acc.quad(a[k], b[k], b[k2], a[k2]); } }
  const f = R[0], l = R[R.length - 1]; acc.quad(f[0], f[1], f[2], f[3]); acc.quad(l[3], l[2], l[1], l[0]);
}
// ống theo đường tâm (vòng tròn nằm ngang quanh trục đứng): rings [{ x, y, z, r }]
function tubeV(acc, rings, seg = 10) {
  const R = rings.map((q) => { const out = []; for (let k = 0; k < seg; k++) { const a = k / seg * 2 * Math.PI; out.push(acc.v(q.x + q.r * Math.cos(a), q.y + q.r * Math.sin(a), q.z)); } return out; });
  for (let i = 0; i + 1 < R.length; i++) for (let k = 0; k < seg; k++) { const k2 = (k + 1) % seg; acc.quad(R[i][k], R[i + 1][k], R[i + 1][k2], R[i][k2]); }
  const top = rings[rings.length - 1], bot = rings[0], c = acc.v(top.x, top.y, top.z), c0 = acc.v(bot.x, bot.y, bot.z);
  for (let k = 0; k < seg; k++) { acc.tri(R[R.length - 1][(k + 1) % seg], R[R.length - 1][k], c); acc.tri(R[0][k], R[0][(k + 1) % seg], c0); }
}
// trụ giữa hai điểm bất kỳ
function cyl(acc, p0, p1, r0, r1 = r0, seg = 10) {
  const ax = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], L = Math.hypot(...ax) || 1, a = ax.map((v) => v / L);
  const t = Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], u = [a[1] * t[2] - a[2] * t[1], a[2] * t[0] - a[0] * t[2], a[0] * t[1] - a[1] * t[0]], ul = Math.hypot(...u); for (let i = 0; i < 3; i++) u[i] /= ul;
  const w = [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]];
  const ring = (p, r) => { const o = []; for (let k = 0; k < seg; k++) { const an = k / seg * 2 * Math.PI, c = Math.cos(an) * r, s = Math.sin(an) * r; o.push(acc.v(p[0] + u[0] * c + w[0] * s, p[1] + u[1] * c + w[1] * s, p[2] + u[2] * c + w[2] * s)); } return o; };
  const A = ring(p0, r0), B = ring(p1, r1);
  for (let k = 0; k < seg; k++) { const k2 = (k + 1) % seg; acc.quad(A[k], B[k], B[k2], A[k2]); }
  const ca = acc.v(...p0), cb = acc.v(...p1); for (let k = 0; k < seg; k++) { acc.tri(A[k], A[(k + 1) % seg], ca); acc.tri(B[(k + 1) % seg], B[k], cb); }
}
function box(acc, cx, cy, cz, lx, ly, lz) { loft(acc, [{ x: cx - lx / 2, y0: cy - ly / 2, y1: cy + ly / 2, z0: cz - lz / 2, z1: cz + lz / 2 }, { x: cx + lx / 2, y0: cy - ly / 2, y1: cy + ly / 2, z0: cz - lz / 2, z1: cz + lz / 2 }]); }
function ellipsoid(acc, c, rx, ry, rz, nu = 14, nv = 8) {
  const I = []; for (let j = 0; j <= nv; j++) { const t = j / nv * Math.PI, row = []; for (let i = 0; i < nu; i++) { const p = i / nu * 2 * Math.PI; row.push(acc.v(c[0] + rx * Math.cos(t), c[1] + ry * Math.sin(t) * Math.cos(p), c[2] + rz * Math.sin(t) * Math.sin(p))); } I.push(row); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const i2 = (i + 1) % nu; acc.quad(I[j][i], I[j][i2], I[j + 1][i2], I[j + 1][i]); }
}

// ---------- thân tàu ----------
// cắt nhiều đa giác cùng lúc: hợp các khoảng
const atHs = (polys, x) => { let r = null; for (const p of polys) { const q = atH(p, x); if (q) r = r ? [Math.min(r[0], q[0]), Math.max(r[1], q[1])] : q; } return r; };
// bảng giá trị theo x, chỗ không có dữ liệu thì nội suy tuyến tính giữa hai bên (mặt boong bị cánh gà, chi tiết chia thành nhiều mảnh)
function table(xa, xf, n, f) {
  const xs = [], v = []; for (let i = 0; i <= n; i++) { const x = xa + (xf - xa) * i / n; xs.push(x); v.push(f(x)); }
  const ok = v.map((q) => q !== null && isFinite(q)); if (!ok.some(Boolean)) return null;
  for (let i = 0; i <= n; i++) if (!ok[i]) { let a = i - 1, b = i + 1; while (a >= 0 && !ok[a]) a--; while (b <= n && !ok[b]) b++; v[i] = a < 0 ? v[b] : b > n ? v[a] : v[a] + (v[b] - v[a]) * (i - a) / (b - a); }
  return (x) => { const t = clamp((x - xa) / (xf - xa), 0, 1) * n, i = Math.min(n - 1, Math.floor(t)); return v[i] + (v[i + 1] - v[i]) * (t - i); };
}
function hullModel(ship, hsA, htA, sec) {
  const L = ship.L, B = ship.B, D = ship.D, T = ship.T, cb = clamp(ship.cb || 0.55, 0.35, 0.85);
  const sideBB = hsA.length ? bbox(hsA.flat()) : null, xa = sideBB ? sideBB[0] : -L / 2, xf = sideBB ? sideBB[2] : L / 2, Ls = xf - xa;
  const xi = (x) => (x - xa) / Ls;
  const zBot0 = (x) => { const q = xi(x); return q > 0.85 ? T * 0.95 * ((q - 0.85) / 0.15) ** 1.6 : q < 0.06 ? T * 0.55 * ((0.06 - q) / 0.06) ** 1.2 : 0; };
  const zTop0 = (x) => { const u = (xi(x) - 0.5) * 2; return D + 0.02 * L * Math.max(0, u) ** 2 + 0.008 * L * Math.max(0, -u) ** 2; };
  const NT = 240, eps = Ls / NT * 0.01;
  const zbT = hsA.length ? table(xa, xf, NT, (x) => { const r = atHs(hsA, clamp(x, xa + eps, xf - eps)); return r ? r[0] : null; }) : null;
  const ztT = hsA.length ? table(xa, xf, NT, (x) => { const r = atHs(hsA, clamp(x, xa + eps, xf - eps)); return r ? r[1] : null; }) : null;
  const zBot = zbT || zBot0, zTop = ztT || zTop0;
  const plan0 = (x) => { const q = xi(x), m2 = 0.5 + 0.15 * (cb - 0.5), m1 = 0.22; let f = 1; if (q > m2) f = Math.max(0, 1 - ((q - m2) / (1 - m2)) ** 1.8) ** 0.75; else if (q < m1) f = 0.78 + 0.22 * Math.max(0, q / m1) ** 0.8; return B / 2 * f; };
  let hb = plan0;
  if (htA.length) { // mặt boong: lấy |y| lớn nhất (vẽ một nửa cũng được); ngoài vùng có mặt boong thì theo dáng mặc định nối tiếp
    const tb = bbox(htA.flat()), e2 = (tb[2] - tb[0]) * 1e-4, raw = table(xa, xf, NT, (x) => { if (x < tb[0] - 1e-9 || x > tb[2] + 1e-9) return null; const r = atHs(htA, clamp(x, tb[0] + e2, tb[2] - e2)); return r ? Math.max(Math.abs(r[0]), Math.abs(r[1])) : null; });
    const k0 = raw ? raw(tb[0]) / Math.max(1e-6, plan0(tb[0])) : 1, k1 = raw ? raw(tb[2]) / Math.max(1e-6, plan0(tb[2])) : 1;
    if (raw) hb = (x) => (x < tb[0] ? plan0(x) * k0 : x > tb[2] ? (tb[2] >= xf - 0.02 * Ls ? 0 : plan0(x) * k1) : raw(x));
  }
  let Smid;
  if (sec) { const bb = bbox(sec), tab = []; let mx = 1e-6; for (let k = 0; k <= 24; k++) { const r = atV(sec, bb[1] + (bb[3] - bb[1]) * clamp(k / 24, 0.002, 0.998)); const w = r ? Math.max(Math.abs(r[0]), Math.abs(r[1])) : 0; tab.push(w); mx = Math.max(mx, w); } const t2 = tab.map((w) => w / mx); Smid = (z) => { const f = clamp(z, 0, 1) * 24, i = Math.min(23, Math.floor(f)); return t2[i] + (t2[i + 1] - t2[i]) * (f - i); }; }
  else { const p = Math.max(1.3, 1.5 + 6 * (cb - 0.4)); Smid = (z) => 1 - (1 - clamp(z, 0, 1)) ** p; }
  const S = (x, z) => { const vb = clamp((xi(x) - 0.72) / 0.28, 0, 1) ** 1.3; return (1 - vb) * Smid(z) + vb * clamp(z, 0, 1) ** 0.85; };
  return { xa, xf, L: Ls, zBot, zTop, hb, S, T };
}
function buildHull(H, sh) {
  const acc = new Acc(sh.hull, false), dk = new Acc(sh.deck, false), T = H.T, NS = 72;
  let zMax = 0; const xs = []; for (let i = 0; i < NS; i++) { const x = H.xa + H.L * (1 - Math.cos(Math.PI * i / (NS - 1))) / 2; xs.push(x); zMax = Math.max(zMax, H.zTop(x)); }
  // mức độ cao cố định để đường nước và dải sơn mớn nước sắc nét (mức trùng nhau chia hai màu)
  const lv = [], add = (z, c, brk) => lv.push({ z, c, brk });
  for (let k = 0; k <= 5; k++) add((T - 0.25) * k / 5, ANTIFOUL); add(T - 0.25, BOOT, true); add(T + 0.35, BOOT); add(T + 0.35, sh.hull, true);
  for (let k = 1; k <= 8; k++) add(T + 0.35 + (zMax - T - 0.35) * k / 8, sh.hull);
  const R = xs.map((x) => { const zb = H.zBot(x), zt = Math.max(zb + 0.01, H.zTop(x)), w = H.hb(x); return lv.map((l) => { const z = clamp(l.z, zb, zt), y = w * H.S(x, (z - zb) / (zt - zb)); return { s: acc.v(x, y, z, l.c), p: acc.v(x, -y, z, l.c) }; }); });
  for (let i = 0; i + 1 < NS; i++) for (let k = 0; k + 1 < lv.length; k++) { if (lv[k + 1].brk) continue; const a = R[i][k], b = R[i + 1][k], c = R[i + 1][k + 1], d = R[i][k + 1]; acc.quad(a.s, b.s, c.s, d.s); acc.quad(a.p, d.p, c.p, b.p); }
  // boong
  for (let i = 0; i + 1 < NS; i++) { const x0 = xs[i], x1 = xs[i + 1], z0 = H.zTop(x0), z1 = H.zTop(x1), w0 = H.hb(x0) * H.S(x0, 1), w1 = H.hb(x1) * H.S(x1, 1); dk.quad(dk.v(x0, -w0, z0), dk.v(x0, w0, z0), dk.v(x1, w1, z1), dk.v(x1, -w1, z1)); }
  // vách lái (và mũi nếu mũi cụt)
  for (const [i, sgn] of [[0, 1], [NS - 1, -1]]) {
    const x = xs[i]; if (H.hb(x) < 0.15) continue; const ring = R[i], c = acc.v(x, 0, (H.zBot(x) + H.zTop(x)) / 2, sh.hull), pts = [...ring.map((q) => q.s), ...ring.slice().reverse().map((q) => q.p)];
    for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length]; if (sgn > 0) acc.tri(a, b, c); else acc.tri(b, a, c); }
  }
  return [acc, dk];
}

// ---------- dựng toàn bộ ----------
// model: { views:[{ id, kind, refs, dims }], parts:[{ id, view, type, pts, kind, num:{h,w,l}, note }], opts:{ shade, rails } }
// ship: { L, B, D, T, cb }
export function buildModel(model, ship) {
  const warn = [], cals = {}, sh = SHADES[(model.opts || {}).shade] || SHADES.haze;
  for (const v of model.views || []) { const c = calibrate(v, ship); cals[v.id] = c; if (!c.ok) warn.push(v.name + ': ' + c.msg); }
  const P = [];
  for (const p of model.parts || []) {
    const v = (model.views || []).find((q) => q.id === p.view), c = v && cals[v.id]; if (!c || !c.ok || !p.pts || !p.pts.length) continue;
    const r = resolve(p.type); if (!r.leaf) continue;
    const pts = p.pts.map((q) => c.toShip(q)); P.push({ p, vk: v.kind, node: r.node, role: r.node.role, key: p.type.join('/'), pts, bb: bbox(pts), closed: p.kind !== 'line' && p.kind !== 'point' });
  }
  const all = (role, kinds) => P.filter((q) => q.role === role && kinds.includes(q.vk) && q.closed && q.pts.length >= 3);
  const hs = all('hullSide', ['side']), ht = all('hullTop', ['top']), sec = all('hullSection', ['front', 'back'])[0];
  const H = hullModel(ship, hs.map((q) => q.pts), ht.map((q) => q.pts), sec && sec.pts), items = [];
  items.push(...buildHull(H, sh));
  const deckZ = (x) => H.zTop(clamp(x, H.xa, H.xf)), hbAt = (x) => Math.max(0.3, H.hb(clamp(x, H.xa, H.xf)));
  const accs = { hull: new Acc(sh.hull, true), super: new Acc(sh.super, true), dark: new Acc(sh.dark, true), deck: new Acc(sh.deck, true), metal: new Acc(0x3a3f44, true), white: new Acc(0xd8dcdf, true), orange: new Acc(0xd9762b, true) };
  const accFor = (node) => accs[node.color] || accs.super;
  const match = (q, kind) => { let best = null, bo = 0; for (const o of P) { if (o === q || o.key !== q.key || o.vk !== kind || !o.closed) continue; const ov = Math.min(q.bb[2], o.bb[2]) - Math.max(q.bb[0], o.bb[0]); if (kind !== 'side' && kind !== 'top') return o; if (ov > bo) { bo = ov; best = o; } } return best; };
  const used = new Set(); const lights = [], blocks = []; let eye = null;
  // bề rộng mặc định khi không có mặt boong / mặt cắt
  const defY = (q, x, zr) => {
    const n = q.node, w = q.p.num && q.p.num.w > 0 ? q.p.num.w : null, hb = hbAt(x), len = q.bb[2] - q.bb[0];
    if (q.role === 'wing') { const s = n.side || 1, inner = Math.max(0.5, hb - 1.4), outer = hb + 0.6; return s < 0 ? [-outer, -inner] : [inner, outer]; }
    if (n.side && q.key.startsWith('khoi')) { const ww = w || clamp(len * 0.45, 0.6, hb * 0.6), c = n.side * hb * 0.4; return [c - ww / 2, c + ww / 2]; }
    let ww = w; if (!ww) { if (q.key.startsWith('khoi')) ww = clamp(len * 0.55, 1, hb); else if (q.key.startsWith('than/')) ww = 2 * hb; else if (q.key.startsWith('khac')) ww = 1.2 * hb; else ww = Math.max(1.5, 2 * hb - 1.8); }
    return [-ww / 2, ww / 2];
  };
  const solid = (q) => {
    used.add(q); const top = q.vk === 'side' ? match(q, 'top') : q.vk === 'top' ? q : null, side = q.vk === 'side' ? q : q.vk === 'top' ? match(q, 'side') : null, front = match(q, 'front') || match(q, 'back');
    if (top) used.add(top); if (side) used.add(side); if (front) used.add(front);
    const ref = side || top; if (!ref) return; const bb = ref.bb, xs = new Set(), st = Math.max(0.25, (bb[2] - bb[0]) / 40);
    for (let x = bb[0] + 0.005; x < bb[2]; x += st) xs.add(+x.toFixed(4));
    for (const p of ref.pts) for (const e of [-0.006, 0.006]) if (p[0] + e > bb[0] && p[0] + e < bb[2]) xs.add(+(p[0] + e).toFixed(4));
    xs.add(+(bb[2] - 0.005).toFixed(4));
    const lev = q.node.level ? (q.node.level - 1) * 2.6 : 0, hgt = (q.p.num && q.p.num.h > 0 && q.p.num.h) || q.node.defH || 2.6;
    const secs = [];
    for (const x of [...xs].sort((a, b) => a - b)) {
      let zr = side ? atH(side.pts, x) : [deckZ(x) + lev, deckZ(x) + lev + hgt]; if (!zr || zr[1] - zr[0] < 0.02) continue;
      let yr = top ? atH(top.pts, x) : null; if (top && !yr) continue;
      if (!yr && front) yr = atV(front.pts, (zr[0] + zr[1]) / 2);
      // chi tiết nằm giữa tàu: lấy đối xứng trái phải (vẽ / dò được một nửa vẫn đủ bề rộng)
      if (yr && !q.node.side && q.role !== 'wing') { const m = Math.max(Math.abs(yr[0]), Math.abs(yr[1])); yr = [-m, m]; }
      if (!yr) yr = defY(q, x, zr);
      if (q.role === 'bulwark') { const hb = hbAt(x); secs.push({ x, y0: hb - 0.08, y1: hb, z0: zr[0], z1: zr[1], m: true }); continue; }
      secs.push({ x, y0: yr[0], y1: yr[1], z0: zr[0], z1: zr[1] });
    }
    if (q.role === 'bulwark') { loft(accs.hull, secs); loft(accs.hull, secs.map((s) => ({ x: s.x, y0: -s.y1, y1: -s.y0, z0: s.z0, z1: s.z1 }))); return; }
    loft(accFor(q.node), secs);
    if (secs.length) { let x0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const s of secs) { x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); z1 = Math.max(z1, s.z1); } blocks.push({ q, x0, x1, z1, bridge: !!q.node.bridge }); }
  };
  for (const q of P) {
    if (used.has(q)) continue; const n = q.node, num = q.p.num || {};
    switch (q.role) {
      case 'block': case 'wing': case 'bulwark': if (q.vk === 'side' || q.vk === 'top') solid(q); break;
      case 'mast': {
        if (q.vk !== 'side') break; const thin = !!n.thin;
        if (!q.closed || q.pts.length < 3) { const pts = q.pts.slice().sort((a, b) => a[1] - b[1]), r0 = num.w > 0 ? num.w / 2 : thin ? 0.08 : 0.22; tubeV(accs.white, pts.map((p, i) => ({ x: p[0], y: 0, z: p[1], r: r0 * (1 - 0.45 * i / Math.max(1, pts.length - 1)) }))); break; }
        const rings = []; for (let k = 0; k <= 10; k++) { const z = q.bb[1] + (q.bb[3] - q.bb[1]) * clamp(k / 10, 0.01, 0.99), r = atV(q.pts, z); if (r) rings.push({ x: (r[0] + r[1]) / 2, y: 0, z, r: Math.max(0.05, Math.min(thin ? 0.1 : 2, (r[1] - r[0]) / 2)) }); }
        if (rings.length >= 2) { rings[0].z = q.bb[1]; rings[rings.length - 1].z = q.bb[3]; tubeV(accs.white, rings); } break;
      }
      case 'yard': { if (q.vk !== 'side') break; const x = (q.bb[0] + q.bb[2]) / 2, z = (q.bb[1] + q.bb[3]) / 2, top = match(q, 'top'), w = num.w > 0 ? num.w : top ? top.bb[3] - top.bb[1] : 0.45 * 2 * hbAt(x); cyl(accs.white, [x, -w / 2, z], [x, w / 2, z], 0.06); break; }
      case 'radar': { if (q.vk !== 'side') break; const x = (q.bb[0] + q.bb[2]) / 2, z = q.bb[3], w = num.w > 0 ? num.w : clamp(q.bb[2] - q.bb[0], 1.2, 4.5); cyl(accs.dark, [x, 0, q.bb[1]], [x, 0, z - 0.3], 0.12); box(accs.dark, x, 0, z - 0.15, 0.3, w, 0.3); break; }
      case 'gun': {
        if (q.vk !== 'side') break; const x = (q.bb[0] + q.bb[2]) / 2, r = Math.max(0.4, (q.bb[2] - q.bb[0]) / 2 * 0.95), h = Math.max(0.5, (q.bb[3] - q.bb[1]) * 0.7), z0 = q.bb[1];
        const s = n.face === 'T' ? -1 : n.face === 'P' ? 1 : 0, y = s * hbAt(x) * 0.55, rings = [{ x, y, z: z0, r }, { x, y, z: z0 + h * 0.8, r }, { x, y, z: z0 + h, r: r * 0.8 }]; tubeV(accs.super, rings, 16);
        const dir = n.face === 'mui' ? [1, 0] : n.face === 'lai' ? [-1, 0] : [0, s], bl = num.l > 0 ? num.l : n.barrel, bz = z0 + h * 0.55, e = Math.tan(5 * Math.PI / 180);
        cyl(accs.metal, [x + dir[0] * r * 0.8, y + dir[1] * r * 0.8, bz], [x + dir[0] * (r * 0.8 + bl), y + dir[1] * (r * 0.8 + bl), bz + bl * e], Math.max(0.06, r * 0.09), Math.max(0.05, r * 0.07)); break;
      }
      case 'boat': { if (q.vk !== 'side') break; const x = (q.bb[0] + q.bb[2]) / 2, lx = (q.bb[2] - q.bb[0]) / 2, rz = (q.bb[3] - q.bb[1]) / 2, w = num.w > 0 ? num.w / 2 : lx * 0.36; ellipsoid(accs.orange, [x, (n.side || 1) * Math.max(w, hbAt(x) - w - 0.25), q.bb[1] + rz], lx, w, rz); break; }
      case 'raft': { if (q.vk !== 'side') break; const r = (q.bb[3] - q.bb[1]) / 2, x = (q.bb[0] + q.bb[2]) / 2, y = (n.side || 1) * Math.max(r, hbAt(x) - r - 0.2); cyl(accs.white, [q.bb[0], y, q.bb[1] + r], [q.bb[2], y, q.bb[1] + r], r, r, 12); break; }
      case 'anchor': { if (q.vk !== 'side') break; const x = (q.bb[0] + q.bb[2]) / 2, z = (q.bb[1] + q.bb[3]) / 2; box(accs.metal, x, (n.side || 1) * (hbAt(x) + 0.12), z, Math.max(0.5, q.bb[2] - q.bb[0]), 0.25, Math.max(0.6, q.bb[3] - q.bb[1])); break; }
      case 'winch': { if (q.vk !== 'side') break; const x = (q.bb[0] + q.bb[2]) / 2; box(accs.dark, x, 0, (q.bb[1] + q.bb[3]) / 2, q.bb[2] - q.bb[0], num.w > 0 ? num.w : 1.4, q.bb[3] - q.bb[1]); break; }
      case 'cyl': { if (q.vk !== 'side') break; const x = (q.bb[0] + q.bb[2]) / 2; tubeV(accs.super, [{ x, y: 0, z: q.bb[1], r: (q.bb[2] - q.bb[0]) / 2 }, { x, y: 0, z: q.bb[3], r: (q.bb[2] - q.bb[0]) / 2 }], 14); break; }
      case 'tube': { if (q.vk !== 'side') break; const r = (q.bb[3] - q.bb[1]) / 2; cyl(accs.super, [q.bb[0], 0, q.bb[1] + r], [q.bb[2], 0, q.bb[1] + r], r, r, 12); break; }
      case 'light': {
        const c = q.pts[0]; if (q.vk === 'side') { const s = n.side || 0; lights.push({ key: n.key, x: c[0], y: s ? s * (hbAt(c[0]) + 0.1) : 0, z: c[1] }); }
        else if (q.vk === 'top') { const l = lights.find((o) => o.key === n.key && !o.yTop); if (l) { l.y = c[1]; l.yTop = true; } }
        break;
      }
      case 'eye': { const c = q.pts[0]; if (q.vk === 'side') eye = Object.assign(eye || { y: 0 }, { x: c[0], z: c[1] }); else if (q.vk === 'top') eye = Object.assign(eye || { x: c[0], z: deckZ(c[0]) + 6 }, { y: c[1] }); break; }
      default: break;
    }
  }
  // lan can mép boong
  if ((model.opts || {}).rails !== false) {
    const st = Math.max(1.5, H.L / 40); for (let x = H.xa + 1; x < H.xf - 1; x += st) { const w = H.hb(x) * H.S(x, 1) - 0.06, z = deckZ(x); if (w < 0.3) continue; for (const s of [-1, 1]) cyl(accs.white, [x, s * w, z], [x, s * w, z + 1], 0.025, 0.025, 4); }
    for (const s of [-1, 1]) { let prev = null; for (let x = H.xa + 1; x < H.xf - 1; x += st / 2) { const w = H.hb(x) * H.S(x, 1) - 0.06, p = [x, s * w, deckZ(x) + 1]; if (prev && w > 0.3) cyl(accs.white, prev, p, 0.025, 0.025, 4); prev = w > 0.3 ? p : null; } }
  }
  // tự đặt những gì chưa có: mắt người điều động, đèn hàng hải tối thiểu
  const br = blocks.filter((b) => b.bridge)[0] || blocks.filter((b) => b.q.node.color === 'super').sort((a, b) => b.z1 - a.z1)[0];
  if (!eye) { eye = br ? { x: br.x1 - 1.2, y: 0, z: br.z1 - 1.0, auto: true } : { x: H.xa + H.L * 0.3, y: 0, z: deckZ(0) + 5, auto: true }; warn.push('Chưa đặt «Vị trí người điều động» — app tự đặt ở buồng lái'); }
  const has = (k) => lights.some((l) => l.key === k), mid = br ? (br.x0 + br.x1) / 2 : 0;
  if (!has('sideP')) lights.push({ key: 'sideP', x: br ? br.x1 - 1 : mid, y: -(hbAt(mid) + 0.1), z: br ? br.z1 - 1.2 : deckZ(mid) + 3, auto: true });
  if (!has('sideS')) lights.push({ key: 'sideS', x: br ? br.x1 - 1 : mid, y: hbAt(mid) + 0.1, z: br ? br.z1 - 1.2 : deckZ(mid) + 3, auto: true });
  if (!has('stern')) lights.push({ key: 'stern', x: H.xa + 0.3, y: 0, z: deckZ(H.xa) + 1.5, auto: true });
  if (!has('mast1')) { const m = P.filter((q) => q.role === 'mast' && q.vk === 'side').sort((a, b) => b.bb[3] - a.bb[3])[0]; lights.push({ key: 'mast1', x: m ? (m.bb[0] + m.bb[2]) / 2 : mid, y: 0, z: m ? m.bb[3] + 0.3 : (br ? br.z1 : deckZ(mid)) + 6, auto: true }); }
  if (!has('anchF')) lights.push({ key: 'anchF', x: H.xf - 1.5, y: 0, z: deckZ(H.xf - 1.5) + 4, auto: true });
  if (!has('anchA')) lights.push({ key: 'anchA', x: H.xa + 1, y: 0, z: deckZ(H.xa) + 3, auto: true });
  const nuc = lights.filter((l) => l.key === 'nuc'); if (nuc.length === 1) lights.push({ key: 'nuc', x: nuc[0].x, y: nuc[0].y, z: nuc[0].z - 2 });
  for (const a of Object.values(accs)) if (a.idx.length) items.push(a);
  return { items, lights, eye, hull: H, areas: areas(items, ship.T), warn, dims: { L: H.L, B: 2 * Math.max(...Array.from({ length: 41 }, (_, i) => H.hb(H.xa + H.L * i / 40))), xa: H.xa, xf: H.xf, fb: deckZ(0) - ship.T, T: ship.T } };
}

// diện tích hứng gió (phần trên đường nước): chiếu các tam giác lên mặt mạn (x, z) và mặt trước (y, z), đếm ô lưới
export function areas(items, T) {
  const cell = 0.2, side = new Map(), front = new Map(); let zTop = T;
  const ras = (map, a, b, c) => {
    const x0 = Math.floor(Math.min(a[0], b[0], c[0]) / cell), x1 = Math.ceil(Math.max(a[0], b[0], c[0]) / cell), z0 = Math.floor(Math.max(T, Math.min(a[1], b[1], c[1])) / cell), z1 = Math.ceil(Math.max(a[1], b[1], c[1]) / cell);
    const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]); if (Math.abs(den) < 1e-12) return;
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      const px = (i + 0.5) * cell, pz = (j + 0.5) * cell; if (pz < T) continue;
      const l1 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (pz - c[1])) / den, l2 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (pz - c[1])) / den;
      if (l1 >= -1e-9 && l2 >= -1e-9 && l1 + l2 <= 1 + 1e-9) map.set(i * 100003 + j, i);
    }
  };
  for (const it of items) { const p = it.pos, I = it.idx; for (let t = 0; t < I.length; t += 3) { const v = [I[t], I[t + 1], I[t + 2]].map((k) => [p[k * 3], p[k * 3 + 1], p[k * 3 + 2]]); zTop = Math.max(zTop, v[0][2], v[1][2], v[2][2]); ras(side, [v[0][0], v[0][2]], [v[1][0], v[1][2]], [v[2][0], v[2][2]]); ras(front, [v[0][1], v[0][2]], [v[1][1], v[1][2]], [v[2][1], v[2][2]]); } }
  let sx = 0; for (const i of side.values()) sx += (i + 0.5) * cell;
  return { AL: side.size * cell * cell, AF: front.size * cell * cell, xc: side.size ? sx / side.size : 0, air: zTop - T };
}
// cho kiểm thử: các khối cơ bản
export const _prim = { Acc, loft, tubeV, cyl, box, ellipsoid };
