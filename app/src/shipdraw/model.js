// Dựng mô hình 3D tàu từ các chi tiết đã vẽ trên 1–3 hình chiếu (thuần JS: ra mảng đỉnh / tam giác theo tọa độ tàu).
// Tọa độ tàu: x về mũi (gốc giữa chiều dài), y sang mạn phải, z lên từ đáy ky; đường nước ở z = T.
// Thiếu hình chiếu thì tự suy: chỉ có hình mạn → bề rộng theo B và hệ số béo; chỉ có mặt boong → chiều cao theo mạn khô / số tầng;
// không có mặt cắt → dáng sườn theo hệ số béo, mũi thon dần thành chữ V. Trái phải đối xứng.
import pc from 'polygon-clipping';
import { resolve, shipColors } from './parts.js';
import { calibrate } from './calib.js';
import { Acc, loft, tubeV, cyl, box, ellipsoid, loftRings, sArea } from './prims.js';
import { shapePts, simplifyPts } from './curve.js';
import { buildFit, FIT_KINDS } from './fittings.js';

export { loftRings };
// cắt đa giác bằng đường thẳng đứng h = x → [v nhỏ nhất, v lớn nhất] (null nếu không cắt)
export function atH(poly, x, closed = true) {
  let lo = Infinity, hi = -Infinity; const n = poly.length, m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) { const a = poly[i], b = poly[(i + 1) % n]; if ((a[0] <= x && b[0] >= x) || (b[0] <= x && a[0] >= x)) { const t = b[0] === a[0] ? 0.5 : (x - a[0]) / (b[0] - a[0]), v = a[1] + (b[1] - a[1]) * t; lo = Math.min(lo, v); hi = Math.max(hi, v); } }
  return lo <= hi ? [lo, hi] : null;
}
// cắt bằng đường nằm ngang v = z → [h nhỏ nhất, h lớn nhất]
export function atV(poly, z, closed = true) { return atH(poly.map((p) => [p[1], p[0]]), z, closed); }
// cắt đa giác kín bằng đường đứng h = x → mọi khoảng [v0, v1] nằm trong (chỗ lõm, chỗ khuyết ra nhiều khoảng)
export function spans(poly, x) {
  const c = [], n = poly.length;
  for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; if ((a[0] <= x) !== (b[0] <= x)) c.push(a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])); }
  c.sort((a, b) => a - b); const out = []; for (let i = 0; i + 1 < c.length; i += 2) if (c[i + 1] - c[i] > 1e-4) out.push([c[i], c[i + 1]]);
  return out;
}
// nét vẽ một nửa (không vượt hẳn qua đường tâm) thì lấy đối xứng; vẽ đủ hai mạn thì dựng đúng như vẽ
export const halfDrawn = (y0, y1) => { const m = Math.max(Math.abs(y0), Math.abs(y1), 1e-6); return !(y0 < -0.2 * m && y1 > 0.2 * m); };
const merge = (iv) => { const s = iv.slice().sort((a, b) => a[0] - b[0]), o = []; for (const q of s) { const l = o[o.length - 1]; if (l && q[0] <= l[1] + 1e-6) l[1] = Math.max(l[1], q[1]); else o.push(q.slice()); } return o; };
const bbox = (p) => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const q of p) { a = Math.min(a, q[0]); b = Math.min(b, q[1]); c = Math.max(c, q[0]); d = Math.max(d, q[1]); } return [a, b, c, d]; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function polyArea(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; }
const inPoly = (P, x, y) => { let ins = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins; } return ins; };

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
  let hbS = plan0, hbP = plan0;
  if (htA.length) { // mặt boong: vẽ một nửa → lấy |y| lớn nhất (đối xứng); vẽ đủ hai mạn → mỗi mạn theo nét của mạn đó (giữ chỗ lõm một bên). Ngoài vùng có mặt boong thì theo dáng mặc định nối tiếp
    const tb = bbox(htA.flat()), e2 = (tb[2] - tb[0]) * 1e-4, full = !halfDrawn(tb[1], tb[3]);
    const mk = (pick) => { const raw = table(xa, xf, NT, (x) => { if (x < tb[0] - 1e-9 || x > tb[2] + 1e-9) return null; const r = atHs(htA, clamp(x, tb[0] + e2, tb[2] - e2)); return r ? Math.max(0, pick(r)) : null; }); if (!raw) return plan0; const k0 = raw(tb[0]) / Math.max(1e-6, plan0(tb[0])), k1 = raw(tb[2]) / Math.max(1e-6, plan0(tb[2])); return (x) => (x < tb[0] ? plan0(x) * k0 : x > tb[2] ? (tb[2] >= xf - 0.02 * Ls ? 0 : plan0(x) * k1) : raw(x)); };
    if (full) { hbS = mk((r) => r[1]); hbP = mk((r) => -r[0]); } else hbS = hbP = mk((r) => Math.max(Math.abs(r[0]), Math.abs(r[1])));
  }
  const hb = (x) => Math.max(hbS(x), hbP(x)), hbs = (x, s) => (s > 0 ? hbS(x) : hbP(x));
  let Smid;
  if (sec) { const bb = bbox(sec), tab = []; let mx = 1e-6; for (let k = 0; k <= 24; k++) { const r = atV(sec, bb[1] + (bb[3] - bb[1]) * clamp(k / 24, 0.002, 0.998)); const w = r ? Math.max(Math.abs(r[0]), Math.abs(r[1])) : 0; tab.push(w); mx = Math.max(mx, w); } const t2 = tab.map((w) => w / mx); Smid = (z) => { const f = clamp(z, 0, 1) * 24, i = Math.min(23, Math.floor(f)); return t2[i] + (t2[i + 1] - t2[i]) * (f - i); }; }
  else { const p = Math.max(1.3, 1.5 + 6 * (cb - 0.4)); Smid = (z) => 1 - (1 - clamp(z, 0, 1)) ** p; }
  const S = (x, z) => { const vb = clamp((xi(x) - 0.72) / 0.28, 0, 1) ** 1.3; return (1 - vb) * Smid(z) + vb * clamp(z, 0, 1) ** 0.85; };
  // nửa bề rộng mặt vỏ tại (x, z) của mạn s
  const yAt = (x, z, s) => { const zb = zBot(x), zt = zTop(x); return hbs(x, s) * S(x, clamp((z - zb) / Math.max(0.01, zt - zb), 0, 1)); };
  return { xa, xf, L: Ls, zBot, zTop, hb, hbs, S, T, yAt };
}
function buildHull(H, sh) {
  const acc = new Acc(sh.hull, false, 'hullside'), dk = new Acc(sh.deck, false, 'deck'), T = H.T, NS = 72;
  let zMax = 0; const xs = []; for (let i = 0; i < NS; i++) { const x = H.xa + H.L * (1 - Math.cos(Math.PI * i / (NS - 1))) / 2; xs.push(x); zMax = Math.max(zMax, H.zTop(x)); }
  // mức độ cao cố định để đường nước và dải sơn mớn nước sắc nét (mức trùng nhau chia hai màu)
  const lv = [], add = (z, c, brk) => lv.push({ z, c, brk });
  for (let k = 0; k <= 5; k++) add((T - 0.25) * k / 5, sh.anti); add(T - 0.25, sh.boot, true); add(T + 0.35, sh.boot); add(T + 0.35, sh.hull, true);
  for (let k = 1; k <= 10; k++) add(T + 0.35 + (zMax - T - 0.35) * k / 10, sh.hull);
  const R = xs.map((x) => { const zb = H.zBot(x), zt = Math.max(zb + 0.01, H.zTop(x)), wS = H.hbs(x, 1), wP = H.hbs(x, -1); return lv.map((l) => { const z = clamp(l.z, zb, zt), f = H.S(x, (z - zb) / (zt - zb)); return { s: acc.v(x, wS * f, z, l.c), p: acc.v(x, -wP * f, z, l.c) }; }); });
  for (let i = 0; i + 1 < NS; i++) for (let k = 0; k + 1 < lv.length; k++) { if (lv[k + 1].brk) continue; const a = R[i][k], b = R[i + 1][k], c = R[i + 1][k + 1], d = R[i][k + 1]; acc.quad(a.s, b.s, c.s, d.s); acc.quad(a.p, d.p, c.p, b.p); }
  // boong
  for (let i = 0; i + 1 < NS; i++) { const x0 = xs[i], x1 = xs[i + 1], z0 = H.zTop(x0), z1 = H.zTop(x1), s0 = H.S(x0, 1), s1 = H.S(x1, 1); dk.quad(dk.v(x0, -H.hbs(x0, -1) * s0, z0), dk.v(x0, H.hbs(x0, 1) * s0, z0), dk.v(x1, H.hbs(x1, 1) * s1, z1), dk.v(x1, -H.hbs(x1, -1) * s1, z1)); }
  // vách lái (và mũi nếu mũi cụt): đỉnh riêng (không chung với mạn) để cạnh vách sắc nét
  for (const [i, sgn] of [[0, 1], [NS - 1, -1]]) {
    const x = xs[i]; if (H.hb(x) < 0.15) continue; const zb = H.zBot(x), zt = Math.max(zb + 0.01, H.zTop(x)), wS = H.hbs(x, 1), wP = H.hbs(x, -1);
    const ring = lv.map((l) => { const z = clamp(l.z, zb, zt), f = H.S(x, (z - zb) / (zt - zb)); return { s: acc.v(x, wS * f, z, l.c), p: acc.v(x, -wP * f, z, l.c) }; });
    const c = acc.v(x, 0, (zb + zt) / 2, sh.hull), pts = [...ring.map((q) => q.s), ...ring.slice().reverse().map((q) => q.p)];
    for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length]; if (sgn > 0) acc.tri(a, b, c); else acc.tri(b, a, c); }
  }
  return [acc, dk];
}
// số hiệu mạn: mảnh mặt vỏ (bám đúng mặt cong) ở hai mạn phía mũi, có tọa độ ảnh để dán chữ
function hullDecals(H, text) {
  const t = String(text || '').trim().slice(0, 8); if (!t) return [];
  const T = H.T, xs = H.xf - 0.17 * H.L, fb0 = H.zTop(xs) - T, hgt = clamp(fb0 * 0.5, 0.35, 3), w = hgt * (0.6 * t.length + 0.35);
  const x1 = xs, x0 = xs - w, xc = (x0 + x1) / 2, ztop = H.zTop(xc) - 0.18, z1 = Math.min(ztop, T + 0.35 + (ztop - T - 0.35) * 0.5 + hgt / 2), z0 = z1 - hgt;
  const out = []; // tọa độ ảnh: nhìn từ ngoài vào, mạn phải mũi ở bên phải, mạn trái mũi ở bên trái
  for (const s of [1, -1]) {
    const pos = [], uv = [], idx = [], NX = 24, NZ = 6;
    for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const x = x0 + (x1 - x0) * i / NX, z = z0 + (z1 - z0) * j / NZ; pos.push(x, s * (H.yAt(x, z, s) + 0.03), z); uv.push(s > 0 ? i / NX : 1 - i / NX, j / NZ); }
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 2, d = a + NX + 1; idx.push(a, b, c, a, c, d); }
    out.push({ s, text: t, pos, uv, idx, w, h: hgt });
  }
  return out;
}

// nét đã làm mượt của một chi tiết (mét): khối (thượng tầng…) ở hình mạn / mũi / lái thì các điểm sát chân khối tự giữ góc sắc
export function partShape(raw, p, vk, role) {
  if (p.kind === 'point' || !(p.curve || p.fillet > 0)) return raw;
  let sharp = p.sharp || [];
  if (['block', 'wing', 'bulwark'].includes(role) && vk !== 'top') { const zm = Math.min(...raw.map((q) => q[1])); sharp = [...new Set([...sharp, ...raw.map((q, i) => (q[1] <= zm + 0.05 ? i : -1)).filter((i) => i >= 0)])]; }
  return shapePts(raw, { curve: p.curve, sharp, fillet: p.fillet, closed: p.kind !== 'line' });
}
// ---------- dựng toàn bộ ----------
// model: { views:[{ id, kind, refs, dims }], parts:[{ id, view, type, pts, kind, num:{h,w,l}, note, curve, sharp, fillet, win, grp }], fits:[…], opts:{ shade, colors, roofDeck, rails, roofRails, hullNo } }
// ship: { L, B, D, T, cb }
export function buildModel(model, ship) {
  const warn = [], cals = {}, opts = model.opts || {}, sh = shipColors(opts);
  for (const v of model.views || []) { const c = calibrate(v, ship); cals[v.id] = c; if (!c.ok) warn.push(v.name + ': ' + c.msg); }
  const P = [];
  for (const p of model.parts || []) {
    const v = (model.views || []).find((q) => q.id === p.view), c = v && cals[v.id]; if (!c || !c.ok || !p.pts || !p.pts.length) continue;
    const r = resolve(p.type); if (!r.leaf) continue;
    const raw = p.pts.map((q) => c.toShip(q)), pts = partShape(raw, p, v.kind, r.node.role);
    P.push({ p, vk: v.kind, node: r.node, role: r.node.role, key: p.type.join('/'), pts, raw, bb: bbox(pts), closed: p.kind !== 'line' && p.kind !== 'point' });
  }
  const all = (role, kinds) => P.filter((q) => q.role === role && kinds.includes(q.vk) && q.closed && q.pts.length >= 3);
  const hs = all('hullSide', ['side']), ht = all('hullTop', ['top']), sec = all('hullSection', ['front', 'back'])[0];
  const H = hullModel(ship, hs.map((q) => q.pts), ht.map((q) => q.pts), sec && sec.pts), items = [];
  items.push(...buildHull(H, sh));
  const deckZ = (x) => H.zTop(clamp(x, H.xa, H.xf)), hbAt = (x) => Math.max(0.3, H.hb(clamp(x, H.xa, H.xf)));
  // super / hull: khối (nóc khối tô màu boong nếu chọn); fsuper: chi tiết cùng màu thượng tầng nhưng không tô nóc
  const accs = { hull: new Acc(sh.hull, true, 'roof'), super: new Acc(sh.super, true, 'roof'), fsuper: new Acc(sh.super, true), dark: new Acc(sh.dark, true), deck: new Acc(sh.deck, true), metal: new Acc(0x3a3f44, true), white: new Acc(0xd8dcdf, true), orange: new Acc(0xd9762b, true), yellow: new Acc(0xd9a62a, true), red: new Acc(0x9c3428, true), blue: new Acc(0x2c5684, true), green: new Acc(0x3c7350, true), cgrey: new Acc(0x8b9196, true), black: new Acc(0x1d1f21, true) };
  const faccs = { ...accs, super: accs.fsuper };
  const accFor = (node) => accs[node.color] || accs.super;
  const match = (q, kind) => { let best = null, bo = 0; for (const o of P) { if (o === q || o.key !== q.key || o.vk !== kind || !o.closed) continue; const ov = Math.min(q.bb[2], o.bb[2]) - Math.max(q.bb[0], o.bb[0]); if (kind !== 'side' && kind !== 'top') return o; if (ov > bo) { bo = ov; best = o; } } return best; };
  const used = new Set(); const lights = [], blocks = [], solids = [], movers = [], anchs = [], fitInfo = {}; let eye = null; const links = {}, src = {}, rng = [];
  // ghi vùng tam giác mỗi chi tiết sinh ra (để sáng khối 3D khi chọn, bấm khối trên 3D để chọn chi tiết)
  const mark = (ids, fn) => { const s0 = Object.values(accs).map((a) => a.idx.length); fn(); Object.values(accs).forEach((a, i) => { if (a.idx.length > s0[i]) rng.push({ ids, acc: a, t0: s0[i] / 3, t1: a.idx.length / 3 }); }); };
  // bề rộng mặc định khi không có mặt boong / hình nhìn từ mũi
  const defY = (q, x) => {
    const n = q.node, w = q.p.num && q.p.num.w > 0 ? q.p.num.w : null, hb = hbAt(x), len = q.bb[2] - q.bb[0];
    if (q.role === 'wing') { const s = n.side || 1, inner = Math.max(0.5, hb - 1.4), outer = hb + 0.6; return s < 0 ? [-outer, -inner] : [inner, outer]; }
    if (n.side && q.key.startsWith('khoi')) { const ww = w || clamp(len * 0.45, 0.6, hb * 0.6), c = n.side * hb * 0.4; return [c - ww / 2, c + ww / 2]; }
    let ww = w; if (!ww) { if (q.key.startsWith('khoi')) ww = clamp(len * 0.55, 1, hb); else if (q.key.startsWith('than/')) ww = 2 * hb; else if (q.key.startsWith('khac')) ww = 1.2 * hb; else ww = Math.max(1.5, 2 * hb - 1.8); }
    return [-ww / 2, ww / 2];
  };
  // ghép các hình chiếu của cùng một khối theo VỊ TRÍ (chồng lên nhau theo chiều dài / chiều cao) và nhóm loại; cùng loại đầy đủ thì ưu tiên.
  // Nét tạo từ hình tự sinh mang `grp` = chi tiết chính của khối: chỉ ghép vào đúng khối đó
  const SOLID = new Set(['block', 'wing', 'bulwark']), STRUCT = new Set(['tang', 'buong', 'khac']);
  const cat = (q) => q.p.type[0], compat = (a, b) => cat(a) === cat(b) || (STRUCT.has(cat(a)) && STRUCT.has(cat(b)));
  const ovl = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)) / Math.max(1e-6, Math.min(a1 - a0, b1 - b0));
  const pick = (q, kinds, score, gids) => {
    let best = null, bs = 0.3;
    for (const o of P) {
      if (o === q || !kinds.includes(o.vk) || !o.closed || !SOLID.has(o.role) || !compat(q, o) || o.pts.length < 3) continue;
      if (o.p.grp && gids && !gids.has(o.p.grp)) continue;
      const sc = o.p.grp && gids && gids.has(o.p.grp) ? 99 : score(o) * (o.key === q.key ? 1.6 : cat(o) === cat(q) ? 1.2 : 1);
      if (sc > bs) { bs = sc; best = o; }
    }
    return best;
  };
  const solid = (q) => {
    used.add(q);
    const side = q.vk === 'side' ? q : pick(q, ['side'], (o) => ovl(q.bb[0], q.bb[2], o.bb[0], o.bb[2]));
    if (side) used.add(side);
    const top = q.vk === 'top' ? q : side ? pick(side, ['top'], (o) => ovl(side.bb[0], side.bb[2], o.bb[0], o.bb[2]), new Set([side.p.id])) : null;
    if (top) used.add(top);
    const gids = new Set([side, top].filter(Boolean).map((o) => o.p.id));
    const fsc = (o) => { const zs = side ? ovl(side.bb[1], side.bb[3], o.bb[1], o.bb[3]) : 1, yo = top ? ovl(top.bb[1], top.bb[3], o.bb[0], o.bb[2]) : 1; if (top && !yo && q.node.side) return 0; const ys = top ? yo || (q.node.side ? 0 : 0.5) : 1; return zs * Math.max(0.35, ys); };
    const fp = pick(side || top, ['front'], fsc, gids); if (fp) used.add(fp);
    const bp = pick(side || top, ['back'], fsc, gids); if (bp) used.add(bp);
    const grp = [side, top, fp, bp].filter(Boolean), ids = grp.map((o) => o.p.id); for (const id of ids) links[id] = ids;
    const info = (side ? 'mạn' : '') + (top ? (side ? ' + ' : '') + 'boong' : '') + (fp ? ' + mũi' : '') + (bp ? ' + lái' : ''); for (const id of ids) src[id] = info + (!top && !fp && !bp ? ' — bề rộng mặc định' : '');
    const ref = side || top; if (!ref) return;
    const centered = !q.node.side && q.role !== 'wing';
    // hình nhìn từ mũi / lái (y, z): chi tiết giữa tàu vẽ một nửa vẫn đủ (lấy đối xứng); có cả hai thì lấy phần giao
    const Fof = (o) => { const r = o.pts.map((p) => [p[0], p[1]]); let F = [[[...r, r[0]]]]; if (centered && halfDrawn(o.bb[0], o.bb[2])) { const m = r.map((p) => [-p[0], p[1]]); try { F = pc.union(F, [[[...m, m[0]]]]); } catch (e) { /* đa giác lỗi: dùng nguyên bản */ } } return F; };
    let F = fp ? Fof(fp) : null; if (bp) { const Fb = Fof(bp); try { F = F ? pc.intersection(F, Fb) : Fb; } catch (e) { F = F || Fb; } }
    let fz = null; if (F) { let a = Infinity, b = -Infinity; for (const poly of F) for (const p of poly[0]) { a = Math.min(a, p[1]); b = Math.max(b, p[1]); } fz = a < b ? [a, b] : null; if (!fz) F = null; }
    const mirY = centered && top && halfDrawn(top.bb[1], top.bb[3]);
    const curvy = [side, top].some((o) => o && (o.p.curve || o.p.fillet > 0));
    const bb = ref.bb, xs = new Set(), stp = Math.max(curvy ? 0.18 : 0.25, (bb[2] - bb[0]) / (curvy ? 64 : 40));
    for (let x = bb[0] + 0.005; x < bb[2]; x += stp) xs.add(+x.toFixed(4));
    for (const o of [side, top]) if (o) for (const p of o.raw.length < o.pts.length ? o.raw : o.pts) for (const e of [-0.006, 0.006]) if (p[0] + e > bb[0] && p[0] + e < bb[2]) xs.add(+(p[0] + e).toFixed(4));
    xs.add(+(bb[2] - 0.005).toFixed(4));
    const lev = q.node.level ? (q.node.level - 1) * 2.6 : 0, hgt = (q.p.num && q.p.num.h > 0 && q.p.num.h) || q.node.defH || 2.6;
    const slices = []; let x0 = Infinity, x1 = -Infinity, z1 = -Infinity, zlo = Infinity, ym = 0;
    for (const x of [...xs].sort((a, b) => a - b)) {
      let Z = side ? spans(side.pts, x) : F ? [fz.slice()] : [[deckZ(x) + lev, deckZ(x) + lev + hgt]];
      Z = Z.filter((z) => z[1] - z[0] > 0.02); if (!Z.length) continue;
      let Y = top ? spans(top.pts, x) : null; if (top && !Y.length) continue;
      if (Y && mirY) Y = merge([...Y, ...Y.map((y) => [-y[1], -y[0]])]);
      if (q.role === 'bulwark') { const hb = hbAt(x); for (const z of Z) for (const sg of [-1, 1]) slices.push({ x, rings: [[[sg > 0 ? hb - 0.08 : -hb, z[0]], [sg > 0 ? hb : -hb + 0.08, z[0]], [sg > 0 ? hb : -hb + 0.08, z[1]], [sg > 0 ? hb - 0.08 : -hb, z[1]]]] }); continue; }
      if (!Y) Y = F ? [[-1e3, 1e3]] : [defY(q, x)];
      let rings = [];
      for (const y of Y) for (const z of Z) rings.push([[y[0], z[0]], [y[1], z[0]], [y[1], z[1]], [y[0], z[1]]]);
      if (F) { try { const R = rings.map((r) => [[...r, r[0]]]), I = pc.intersection(F, ...R.map((r) => [r])); rings = I.map((poly) => poly[0].slice(0, -1)); } catch (e) { /* giữ hình chữ nhật */ } }
      rings = rings.filter((r) => r.length >= 3 && Math.abs(sArea(r)) > 1e-4); if (!rings.length) continue;
      // đáy khối sát boong (vẽ hơi cao hơn boong) thì hạ xuống ngập vào thân để không hở khe
      if (q.role === 'block') { const dz = deckZ(x); let zm = Infinity; for (const r of rings) for (const p of r) zm = Math.min(zm, p[1]); if (zm > dz - 0.05 && zm < dz + 0.45) for (const r of rings) for (const p of r) if (p[1] <= zm + 1e-6) p[1] = dz - 0.15; }
      slices.push({ x, rings });
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); for (const r of rings) for (const p of r) { z1 = Math.max(z1, p[1]); zlo = Math.min(zlo, p[1]); ym = Math.max(ym, Math.abs(p[0])); }
    }
    if (q.role === 'bulwark') { const sl = (sg) => slices.filter((s) => (s.rings[0][0][0] > 0) === (sg > 0)); mark(ids, () => { loftRings(accs.hull, sl(1)); loftRings(accs.hull, sl(-1)); }); return; }
    // cửa kính: buồng lái chính mặc định có; chi tiết nào cũng bật / tắt được
    const wv = grp.map((o) => o.p.win).find((v) => v !== undefined), winOn = wv !== undefined ? !!wv : !!q.node.bridge, acc = accFor(q.node), bh = z1 - zlo;
    if (winOn && bh >= 1.4) acc.wb = [z1 - Math.min(1.55, 0.62 * bh), z1 - Math.min(0.45, 0.18 * bh)];
    mark(ids, () => loftRings(acc, slices)); acc.wb = null;
    if (slices.length) { blocks.push({ q, x0, x1, z1, ym, bridge: !!q.node.bridge }); solids.push({ ids, gid: ref.p.id, type: ref.p.type.slice(), cat: cat(ref), role: q.role, slices, has: { side: !!side, top: !!top, front: !!fp, back: !!bp }, x0, x1, z0: zlo, z1 }); }
  };
  for (const q of P) {
    if (used.has(q)) continue; const n = q.node;
    switch (q.role) {
      case 'block': case 'wing': case 'bulwark': if (q.vk === 'side') solid(q); break;
      case 'light': {
        const c = q.pts[0]; if (q.vk === 'side') { const s = n.side || 0; lights.push({ key: n.key, x: c[0], y: s ? s * (hbAt(c[0]) + 0.1) : 0, z: c[1] }); }
        else if (q.vk === 'top') { const l = lights.find((o) => o.key === n.key && !o.yTop); if (l) { l.y = c[1]; l.yTop = true; } }
        break;
      }
      case 'eye': { const c = q.pts[0]; if (q.vk === 'side') eye = Object.assign(eye || { y: 0 }, { x: c[0], z: c[1] }); else if (q.vk === 'top') eye = Object.assign(eye || { x: c[0], z: deckZ(c[0]) + 6 }, { y: c[1] }); break; }
      default: if (!q.role.startsWith('hull')) mark([q.p.id], () => prim(q)); break;
    }
  }
  // quả neo: khối riêng có gốc ở chỗ nối xích (cảnh 3D cho rơi theo xích, thu về đúng chỗ cũ); miệng lỗ neo ở lại trên vỏ
  function anchorFit(f) {
    const acc = new Acc(0x3a3f44, true, 'anchor'), aa = { metal: acc, super: acc, dark: acc, white: acc, orange: acc, hull: acc, deck: acc, hawse: accs.metal };
    const I = buildFit(f, aa, movers); if (!I) return null;
    anchs.push({ id: f.id, acc, pivot: I.attach, side: Math.abs(I.attach[1]) < 0.3 ? 0 : Math.sign(I.attach[1]), bow: I.attach[0] >= 0 });
    return I;
  }
  // chi tiết vẽ theo hình mạn dạng cũ (radar, pháo, bè, neo, tời, xuồng): dựng bằng hình của thư viện chi tiết
  function prim(q) {
    const n = q.node, num = q.p.num || {}, id = q.p.id, cx = (q.bb[0] + q.bb[2]) / 2, len = q.bb[2] - q.bb[0], ht = q.bb[3] - q.bb[1];
    const F = (o) => buildFit(Object.assign({ id, rot: 0 }, o), faccs, movers);
    switch (q.role) {
      case 'mast': {
        if (q.vk !== 'side') break; const thin = !!n.thin;
        if (!q.closed || q.pts.length < 3) { const pts = q.pts.slice().sort((a, b) => a[1] - b[1]), r0 = num.w > 0 ? num.w / 2 : thin ? 0.08 : 0.22; tubeV(accs.white, pts.map((p, i) => ({ x: p[0], y: 0, z: p[1], r: r0 * (1 - 0.45 * i / Math.max(1, pts.length - 1)) })), 12); break; }
        const rings = []; for (let k = 0; k <= 10; k++) { const z = q.bb[1] + (q.bb[3] - q.bb[1]) * clamp(k / 10, 0.01, 0.99), r = atV(q.pts, z); if (r) rings.push({ x: (r[0] + r[1]) / 2, y: 0, z, r: Math.max(0.05, Math.min(thin ? 0.1 : 2, (r[1] - r[0]) / 2)) }); }
        if (rings.length >= 2) { rings[0].z = q.bb[1]; rings[rings.length - 1].z = q.bb[3]; tubeV(accs.white, rings, 12); } break;
      }
      case 'yard': { if (q.vk !== 'side') break; const z = (q.bb[1] + q.bb[3]) / 2, top = match(q, 'top'), w = num.w > 0 ? num.w : top ? top.bb[3] - top.bb[1] : 0.45 * 2 * hbAt(cx); cyl(accs.white, [cx, -w / 2, z], [cx, w / 2, z], 0.06, 0.06, 8); break; }
      case 'radar': { if (q.vk !== 'side') break; const w = num.w > 0 ? num.w : clamp(len, 1.2, 4.5); F({ kind: 'radar', x: cx, y: 0, z: q.bb[1], l: w, w: 0.5, h: Math.max(0.6, ht - 0.15) }); break; }
      case 'gun': {
        if (q.vk !== 'side') break; const s = n.face === 'T' ? -1 : n.face === 'P' ? 1 : 0, rot = { mui: 0, lai: 180, T: -90, P: 90 }[n.face] || 0, l = Math.max(0.8, len);
        F({ kind: 'turret', x: cx, y: s * hbAt(cx) * 0.55, z: q.bb[1], rot, l, w: Math.min(l * 0.9, Math.max(0.8, 2 * hbAt(cx) * 0.7)), h: Math.max(0.6, ht * 0.9), n: 1, bl: num.l > 0 ? num.l : n.barrel }); break;
      }
      case 'boat': { if (q.vk !== 'side') break; const w = num.w > 0 ? num.w : len * 0.36; F({ kind: 'boat', x: cx, y: (n.side || 1) * Math.max(w / 2, hbAt(cx) - w / 2 - 0.25), z: q.bb[1], l: len, w, h: Math.max(0.5, ht) }); break; }
      case 'raft': { if (q.vk !== 'side') break; const r = ht / 2; F({ kind: 'raft', x: cx, y: (n.side || 1) * Math.max(r, hbAt(cx) - r - 0.2), z: q.bb[1], l: Math.max(0.6, len), w: ht, h: ht }); break; }
      case 'anchor': { if (q.vk !== 'side') break; const z = (q.bb[1] + q.bb[3]) / 2, s = n.side || 1; anchorFit({ id, kind: 'anchor', x: cx, y: s * H.yAt(clamp(cx, H.xa, H.xf), z, s), z, rot: s > 0 ? 0 : 180, l: Math.max(0.5, len), w: 0.5, h: Math.max(0.6, ht) }); break; }
      case 'winch': { if (q.vk !== 'side') break; F({ kind: 'windlass', x: cx, y: 0, z: q.bb[1], l: Math.max(0.5, len), w: num.w > 0 ? num.w : 1.4, h: Math.max(0.4, ht) }); break; }
      case 'cyl': { if (q.vk !== 'side') break; tubeV(accs.fsuper, [{ x: cx, y: 0, z: q.bb[1], r: len / 2 }, { x: cx, y: 0, z: q.bb[3], r: len / 2 }], 20); break; }
      case 'tube': { if (q.vk !== 'side') break; const r = ht / 2; cyl(accs.fsuper, [q.bb[0], 0, q.bb[1] + r], [q.bb[2], 0, q.bb[1] + r], r, r, 16); break; }
      default: break;
    }
  }

  // chi tiết chỉ vẽ ở mặt boong (không có hình mạn): dựng sau cùng; chỉ có ở hình mũi / lái thì báo
  for (const q of P) { if (used.has(q) || !SOLID.has(q.role) || !q.closed) continue; if (q.vk === 'top') solid(q); else if (q.vk === 'front' || q.vk === 'back') { used.add(q); src[q.p.id] = 'chưa dựng — cần thêm hình mạn hoặc mặt boong'; warn.push('Có chi tiết chỉ vẽ ở hình nhìn từ ' + (q.vk === 'back' ? 'lái' : 'mũi') + ' — vẽ thêm ở hình mạn hoặc mặt boong để app biết nằm ở đâu dọc tàu'); } }
  // chi tiết đặt sẵn từ thư viện
  for (const f of model.fits || []) { if (!FIT_KINDS[f.kind]) continue; mark([f.id], () => { const I = f.kind === 'anchor' ? anchorFit(f) : buildFit(f, faccs, movers); if (I) fitInfo[f.id] = I; }); }
  // lan can mép boong
  if (opts.rails !== false) {
    // một vòng lan can khép kín: mạn phải từ lái tới mũi, hai bên gặp nhau ở sống mũi, mạn trái về lái, ngang qua lái; 2 thanh (cao 1 m và 0,5 m)
    const st = Math.max(1.5, H.L / 40), wAt = (x, s) => H.hbs(x, s) * H.S(x, 1) - 0.06, x0 = H.xa + 0.5;
    let xb = H.xf - 0.15; while (xb > x0 + 2 && Math.min(wAt(xb, 1), wAt(xb, -1)) < 0.12) xb -= 0.05;
    const tipX = Math.min(H.xf - 0.12, xb + Math.min(0.6, 0.3 + Math.max(wAt(xb, 1), wAt(xb, -1)))), xsR = [];
    for (let x = x0; x < xb - 0.01;) { xsR.push(x); x += x > xb - H.L * 0.12 ? Math.min(st / 2, 0.5) : st / 2; } xsR.push(xb);
    const side = (s) => xsR.map((x) => [x, s * Math.max(0.05, wAt(x, s))]), path = [...side(1), [tipX, 0], ...side(-1).reverse()];
    if (wAt(x0, 1) + wAt(x0, -1) > 1) path.push(path[0]); // khép ngang qua lái
    const zA = (q, k) => [q[0], q[1], deckZ(Math.min(H.xf - 0.05, q[0])) + k];
    for (let i = 0; i + 1 < path.length; i++) for (const k of [1, 0.5]) cyl(accs.white, zA(path[i], k), zA(path[i + 1], k), k === 1 ? 0.028 : 0.02, k === 1 ? 0.028 : 0.02, 4);
    let acc = 0; for (let i = 0; i < path.length; i++) { if (i) acc += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); if (i === 0 || acc >= st * 0.98 || i === path.length - 1 || (path[i][1] === 0)) { const q = zA(path[i], 0), t = zA(path[i], 1); cyl(accs.white, q, t, 0.025, 0.025, 4); acc = 0; } }
    if (opts.roofRails !== false) roofRails(solids, accs.white);
  }
  // tự đặt những gì chưa có: mắt người điều động, đèn hàng hải tối thiểu
  const br = blocks.filter((b) => b.bridge)[0] || blocks.filter((b) => b.q.node.color === 'super').sort((a, b) => b.z1 - a.z1)[0];
  if (!eye) { eye = br ? { x: br.x1 - 1.2, y: 0, z: br.z1 - 1.0, auto: true } : { x: H.xa + H.L * 0.3, y: 0, z: deckZ(0) + 5, auto: true }; warn.push('Chưa đặt «Vị trí người điều động» — app tự đặt ở buồng lái'); }
  const has = (k) => lights.some((l) => l.key === k), mid = br ? (br.x0 + br.x1) / 2 : 0;
  const mast = P.filter((q) => q.role === 'mast' && q.vk === 'side').sort((a, b) => b.bb[3] - a.bb[3])[0];
  // cột dàn lưới cao hơn cột vẽ thì đèn cột / cờ theo cột dàn
  const lm = (model.fits || []).filter((f) => (f.kind === 'latmast' || f.kind === 'mast') && fitInfo[f.id]).map((f) => ({ f, I: fitInfo[f.id] })).sort((a, b) => b.I.top - a.I.top)[0];
  const lmTop = lm && (!mast || lm.I.top > mast.bb[3]) ? lm : null;
  if (!has('sideP')) lights.push({ key: 'sideP', x: br ? br.x1 - 1 : mid, y: -(hbAt(mid) + 0.1), z: br ? br.z1 - 1.2 : deckZ(mid) + 3, auto: true });
  if (!has('sideS')) lights.push({ key: 'sideS', x: br ? br.x1 - 1 : mid, y: hbAt(mid) + 0.1, z: br ? br.z1 - 1.2 : deckZ(mid) + 3, auto: true });
  if (!has('stern')) lights.push({ key: 'stern', x: H.xa + 0.3, y: 0, z: deckZ(H.xa) + 1.5, auto: true });
  if (!has('mast1')) { if (lmTop) lights.push({ key: 'mast1', x: lmTop.f.x, y: lmTop.f.y, z: lmTop.I.top + 0.3, auto: true }); else lights.push({ key: 'mast1', x: mast ? (mast.bb[0] + mast.bb[2]) / 2 : mid, y: 0, z: mast ? mast.bb[3] + 0.3 : (br ? br.z1 : deckZ(mid)) + 6, auto: true }); }
  if (!has('anchF')) lights.push({ key: 'anchF', x: H.xf - 1.5, y: 0, z: deckZ(H.xf - 1.5) + 4, auto: true });
  if (!has('anchA')) lights.push({ key: 'anchA', x: H.xa + 1, y: 0, z: deckZ(H.xa) + 3, auto: true });
  const nuc = lights.filter((l) => l.key === 'nuc'); if (nuc.length === 1) lights.push({ key: 'nuc', x: nuc[0].x, y: nuc[0].y, z: nuc[0].z - 2 });
  // chỗ treo cờ: xà cao nhất trên cột cao nhất; cột không có xà thì treo sát đỉnh cột
  let flag;
  if (lmTop) flag = { x: lmTop.f.x, z: lmTop.I.yard.z - 0.05, span: Math.max(0.4, lmTop.I.yard.span * 0.85) };
  else if (mast) {
    const zt = mast.bb[3]; let xt = (mast.bb[0] + mast.bb[2]) / 2;
    if (!mast.closed || mast.pts.length < 3) xt = mast.pts.reduce((a, p) => (p[1] > a[1] ? p : a))[0];
    else { const r = atV(mast.pts, zt - Math.min(0.3, (zt - mast.bb[1]) * 0.05)); if (r) xt = (r[0] + r[1]) / 2; }
    const yd = P.filter((q) => q.role === 'yard' && q.vk === 'side' && q.bb[2] >= mast.bb[0] - 1.5 && q.bb[0] <= mast.bb[2] + 1.5 && (q.bb[1] + q.bb[3]) / 2 > mast.bb[1]).sort((a, b) => b.bb[3] - a.bb[3])[0];
    if (yd) { const nm = yd.p.num || {}, top = match(yd, 'top'), w = nm.w > 0 ? nm.w : top ? top.bb[3] - top.bb[1] : 0.45 * 2 * hbAt(xt); flag = { x: xt, z: (yd.bb[1] + yd.bb[3]) / 2 - 0.05, span: Math.max(0.4, w / 2 * 0.85) }; }
    else flag = { x: xt, z: zt - 0.5, span: 0.45 };
  } else { const m1 = lights.find((l) => l.key === 'mast1'); flag = { x: m1.x, z: m1.z - 1, span: 0.45, auto: true }; }
  for (const a of Object.values(accs)) if (a.idx.length) items.push(a);
  const ranges = {}; for (const r of rng) { const it = items.indexOf(r.acc); for (const id of r.ids) (ranges[id] || (ranges[id] = [])).push({ it, t0: r.t0, t1: r.t1 }); }
  // phần quay (radar): mỗi cái một khối riêng có tâm quay
  for (const m of movers) { if (!m.acc.idx.length) continue; m.acc.pivot = m.pivot; m.acc.spin = m.rpm; items.push(m.acc); (ranges[m.id] || (ranges[m.id] = [])).push({ it: items.length - 1, t0: 0, t1: m.acc.idx.length / 3 }); }
  for (const a of anchs) { if (!a.acc.idx.length) continue; a.acc.pivot = a.pivot; a.acc.anchor = { side: a.side, bow: a.bow }; items.push(a.acc); (ranges[a.id] || (ranges[a.id] = [])).push({ it: items.length - 1, t0: 0, t1: a.acc.idx.length / 3 }); }
  for (const q of P) if (q.role.startsWith('hull')) ranges[q.p.id] = [0, 1].map((it) => ({ it, t0: 0, t1: items[it].idx.length / 3 }));
  const fitBB = {}; for (const [id, I] of Object.entries(fitInfo)) fitBB[id] = I.bb;
  return { items, lights, eye, flag, links, src, ranges, solids, auto: autoViews(solids), fitBB, colors: sh, roofDeck: opts.roofDeck !== false, decals: hullDecals(H, opts.hullNo), hullNoCol: opts.hullNoCol || (((sh.hull >> 16 & 255) * 0.3 + (sh.hull >> 8 & 255) * 0.59 + (sh.hull & 255) * 0.11) > 150 ? 'k' : 'w'), bridge: br ? { xf: br.x1, hb: br.ym, z1: br.z1 } : null, hull: H, areas: areas(items, ship.T), warn: [...new Set(warn)], dims: { L: H.L, B: 2 * Math.max(...Array.from({ length: 41 }, (_, i) => H.hb(H.xa + H.L * i / 40))), xa: H.xa, xf: H.xf, fb: deckZ(0) - ship.T, T: ship.T } };
}

// ---------- hình chiếu tự sinh từ khối đã dựng ----------
// nhìn từ mũi / lái (y, z): hợp các mặt cắt; mặt boong (x, y) / hình mạn (x, z): biên theo từng lát
export function silYZ(slices) {
  const seen = new Set(), polys = [];
  for (const s of slices) for (const r of s.rings) { const k = r.map((p) => Math.round(p[0] * 50) + ',' + Math.round(p[1] * 50)).join(';'); if (seen.has(k)) continue; seen.add(k); polys.push([[...r.map((p) => [p[0], p[1]]), [r[0][0], r[0][1]]]]); }
  if (!polys.length) return [];
  let U; try { U = pc.union(...polys); } catch (e) { return []; }
  return U.map((poly) => simplifyPts(poly[0].slice(0, -1), 0.02, true)).filter((r) => r.length >= 3);
}
function silAlong(slices, ax) {
  const lo = [], hi = [];
  for (const s of slices) { let a = Infinity, b = -Infinity; for (const r of s.rings) for (const p of r) { a = Math.min(a, p[ax]); b = Math.max(b, p[ax]); } if (a < b) { lo.push([s.x, a]); hi.push([s.x, b]); } }
  if (lo.length < 2) return null;
  return simplifyPts([...hi, ...lo.reverse()], 0.02, true);
}
export function autoViews(solids) {
  const out = [];
  for (const s of solids) {
    if (s.role === 'bulwark') continue; const base = { gid: s.gid, ids: s.ids, type: s.type };
    if (!s.has.front || !s.has.back) for (const poly of silYZ(s.slices)) out.push({ ...base, view: 'fb', need: { front: !s.has.front, back: !s.has.back }, poly });
    if (!s.has.top) { const p = silAlong(s.slices, 0); if (p) out.push({ ...base, view: 'top', poly: p }); }
    if (!s.has.side) { const p = silAlong(s.slices, 1); if (p) out.push({ ...base, view: 'side', poly: p }); }
  }
  return out;
}
// lan can quanh nóc các tầng (thượng tầng, buồng lái): bỏ đoạn nằm dưới tầng trên đặt lên nóc đó
function roofRails(solids, acc) {
  const roofs = solids.filter((s) => (s.cat === 'tang' || s.cat === 'buong') && (s.role === 'block' || s.role === 'wing') && s.x1 - s.x0 >= 1.5);
  const ext = (s, x) => { let best = null, bd = Infinity; for (const sl of s.slices) { const d = Math.abs(sl.x - x); if (d < bd) { bd = d; best = sl; } } if (!best || x < s.x0 - 0.05 || x > s.x1 + 0.05) return null; let a = Infinity, b = -Infinity, zt = -Infinity; for (const r of best.rings) for (const p of r) zt = Math.max(zt, p[1]); for (const r of best.rings) { const q = atV(r, zt - 0.03); if (q) { a = Math.min(a, q[0]); b = Math.max(b, q[1]); } } return a < b ? { a, b, zt } : null; };
  const covered = (s, x, y, z) => roofs.some((t) => t !== s && t.z0 > z - 0.4 && t.z0 < z + 0.6 && t.z1 > z + 0.1 && (() => { const e = ext(t, x); if (!e) return false; let a = Infinity, b = -Infinity; const sl = t.slices.reduce((m, q) => (Math.abs(q.x - x) < Math.abs(m.x - x) ? q : m)); for (const r of sl.rings) for (const p of r) { a = Math.min(a, p[0]); b = Math.max(b, p[0]); } return y > a - 0.1 && y < b + 0.1; })());
  for (const s of roofs) {
    const up = [], dn = [];
    for (const sl of s.slices) { const e = ext(s, sl.x); if (!e || e.b - e.a < 1.2) continue; up.push([sl.x, e.b - 0.08, e.zt]); dn.push([sl.x, e.a + 0.08, e.zt]); }
    if (up.length < 2) continue;
    up[0][0] += 0.08; dn[0][0] += 0.08; up[up.length - 1][0] -= 0.08; dn[dn.length - 1][0] -= 0.08;
    const ring = [...up, ...dn.reverse()], per = []; let L = 0; for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; per.push(L); L += Math.hypot(b[0] - a[0], b[1] - a[1]); }
    const n = Math.max(4, Math.round(L / 1.4)), posts = [];
    for (let k = 0; k < n; k++) { const t = L * k / n; let i = 0; while (i + 1 < ring.length && per[i + 1] <= t) i++; const a = ring[i], b = ring[(i + 1) % ring.length], sl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, f = (t - per[i]) / sl; const p = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; posts.push({ p, ok: !covered(s, p[0], p[1], p[2]) }); }
    for (let k = 0; k < posts.length; k++) { const A = posts[k], Bq = posts[(k + 1) % posts.length]; if (A.ok) cyl(acc, A.p, [A.p[0], A.p[1], A.p[2] + 1], 0.025, 0.025, 4); if (A.ok && Bq.ok) cyl(acc, [A.p[0], A.p[1], A.p[2] + 1], [Bq.p[0], Bq.p[1], Bq.p[2] + 1], 0.025, 0.025, 4); }
  }
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
export { inPoly };
