// Đọc số độ sâu và độ cao trên ảnh chỉ số màu của tờ hải đồ (theo từng khối để tiết kiệm bộ nhớ).
// Số đo sâu: chữ nghiêng, phần thập phân là chữ số nhỏ thấp hơn (12₆ = 12,6 m), gạch chân = độ cao bãi cạn (âm).
// Độ cao: chữ đứng có chấm «•» bên trái hoặc phải (chấm = vị trí đỉnh), số trong ngoặc «(42)» cạnh / dưới tên hòn = độ cao cả hòn.
import { label, dilate } from './img.js';
import { INK, SLANT, deshear, classifyItalic, classifyUpright } from './digits.js';

// bit cờ của điểm đo sâu
export const F_DRY = 1, F_SUSPECT = 2, F_USER = 4, F_EDIT = 8;

// cắt một khối [X0, Y0, X0+w, Y0+h) của ảnh chỉ số → mảng độ đậm, mặt nạ mực
function blockArrays(idx, W, X0, Y0, w, h, P) {
  const dk = new Uint8Array(w * h), core = new Uint8Array(w * h), soft = new Uint8Array(w * h), cls = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) { const s = (Y0 + y) * W + X0, o = y * w; for (let x = 0; x < w; x++) { const c = idx[s + x]; dk[o + x] = P.dark[c]; core[o + x] = P.core[c]; soft[o + x] = P.soft[c]; cls[o + x] = P.cls[c]; } }
  const g = dilate(core, w, h, 3), ink = new Uint8Array(w * h); for (let i = 0; i < ink.length; i++) ink[i] = soft[i] & g[i];
  return { dk, ink, cls };
}

// gom nét thành chữ số (sau khi giãn 1 điểm ảnh), gom chữ số cạnh nhau cùng hàng thành cụm số
function tokens(ink, w, h, k) {
  const dil = dilate(ink, w, h, 3), { lab, n, st } = label(dil, w, h, true), G = [];
  for (let i = 1; i < n; i++) {
    const x0 = st[i * 5], y0 = st[i * 5 + 1], x1 = st[i * 5 + 2] + 1, y1 = st[i * 5 + 3] + 1, gw = x1 - x0, gh = y1 - y0;
    if (gh >= 11 * k && gh <= 30 * k && gw >= 3 * k && gw <= 40 * k) G.push({ id: i, x0, y0, x1, y1 });
  }
  G.sort((a, b) => a.x0 - b.x0);
  const par = G.map((_, i) => i), f = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  const cell = 64, grid = new Map();
  G.forEach((g, i) => { const key = ((g.x0 / cell) | 0) + ',' + ((g.y0 / cell) | 0); if (!grid.has(key)) grid.set(key, []); grid.get(key).push(i); });
  G.forEach((g, i) => {
    const cx = (g.x1 / cell) | 0, cy = (g.y0 / cell) | 0;
    for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) for (const j of grid.get(gx + ',' + gy) || []) {
      if (j === i) continue; const q = G[j], gap = q.x0 - g.x1;
      if (gap < -3 * k || gap > 5 * k || q.x0 <= g.x0) continue;
      const ov = Math.min(g.y1, q.y1) - Math.max(g.y0, q.y0), ha = g.y1 - g.y0, hb = q.y1 - q.y0;
      if (ov < 0.45 * Math.min(ha, hb) || Math.min(ha, hb) < 0.55 * Math.max(ha, hb)) continue;
      par[f(j)] = f(i);
    }
  });
  const T = new Map(); G.forEach((g, i) => { const r = f(i); if (!T.has(r)) T.set(r, []); T.get(r).push(g); });
  const out = [];
  for (const gs of T.values()) { gs.sort((a, b) => a.x0 - b.x0); out.push({ g: gs, x0: Math.min(...gs.map((q) => q.x0)), y0: Math.min(...gs.map((q) => q.y0)), x1: Math.max(...gs.map((q) => q.x1)), y1: Math.max(...gs.map((q) => q.y1)) }); }
  return { T: out, lab };
}
// ảnh độ đậm của cụm số (chỉ các nét thuộc cụm)
function tokImg(t, lab, dk, w, h, pad = 2) {
  const x0 = Math.max(0, t.x0 - pad), y0 = Math.max(0, t.y0 - pad), x1 = Math.min(w, t.x1 + pad), y1 = Math.min(h, t.y1 + pad), tw = x1 - x0, th = y1 - y0;
  const ids = new Set(t.g.map((g) => g.id)), im = new Float32Array(tw * th);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) { const o = (y + y0) * w + x + x0; if (ids.has(lab[o])) im[y * tw + x] = dk[o]; }
  return { im, tw, th, x0, y0 };
}
// nền quanh cụm: water | flat | land (theo lớp màu nền chiếm đa số, bỏ chữ / nét)
function bgOf(cls, w, h, x0, y0, x1, y1) {
  const c = [0, 0, 0, 0];
  for (let y = Math.max(0, y0 - 4); y < Math.min(h, y1 + 4); y++) for (let x = Math.max(0, x0 - 4); x < Math.min(w, x1 + 4); x++) c[cls[y * w + x]]++;
  if (c[3] >= c[1] && c[3] >= c[2] && c[3] > 0) return 'land';
  if (c[2] > 0.7 * (c[1] + c[2] + c[3])) return 'flat';
  return c[1] ? 'water' : 'land';
}

// đọc một cụm số đo sâu → { v, dry, txt, x, y, h, conf } hoặc lý do bỏ
function readSounding(t, lab, dk, w, h, k) {
  const H0 = t.y1 - t.y0 + 4, wt = t.x1 - t.x0;
  if (t.y1 - t.y0 < 13 * k || wt > 110 * k) return null;
  const { im, tw, th, x0, y0 } = tokImg(t, lab, dk, w, h);
  let dry = false;
  // gạch chân rời (vệt đen đậm, ngang, không kéo dài quá cụm số — đường đẳng sâu xám thì kéo dài)
  { const bx0 = t.x0 - 12, bx1 = t.x1 + 12, by0 = t.y1 - 2, by1 = t.y1 + 6; let best = -1, bestRow = -1;
    for (let y = by0; y < by1; y++) { if (y < 0 || y >= h) continue; let c = 0; for (let x = bx0 + 8; x < bx1 - 8; x++) if (x >= 0 && x < w && dk[y * w + x] > 175) c++; if (c > best) { best = c; bestRow = y; } }
    if (bestRow >= 0 && wt > 8 * k) { let outer = 0; for (const x of [...Array(5).keys()].map((i) => bx0 + i).concat([...Array(5).keys()].map((i) => bx1 - 1 - i))) if (x >= 0 && x < w && dk[bestRow * w + x] > 175) outer++;
      if (best > 0.75 * wt && outer <= 2) dry = true; } }
  // gạch chân dính vào chữ: xóa các hàng dưới cùng có vệt ngang dài
  // (vệt mảnh: hàng gạch dài gần hết bề rộng, hàng cách 2 điểm ảnh phía trên ít mực hơn hẳn — đáy số 8, số 0 thì không như vậy)
  { const rc = new Int32Array(th); for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) if (im[y * tw + x] > INK) rc[y]++;
    for (let y = th - 1; y > Math.max(2, th - 8); y--) if (rc[y] > 0.85 * wt && wt > 10 * k && rc[y - 2] < 0.5 * rc[y]) { dry = true; for (let yy = Math.max(0, y - 1); yy < Math.min(th, y + 2); yy++) for (let x = 0; x < tw; x++) im[yy * tw + x] = 0; break; } }
  const ds = deshear(im, tw, th, SLANT), DW = ds.w, D = ds.d;
  const col = new Int32Array(DW); for (let y = 0; y < th; y++) for (let x = 0; x < DW; x++) if (D[y * DW + x] > INK) col[x]++;
  const vext = (a, b) => { let r0 = -1, r1 = -1; for (let y = 0; y < th; y++) { let any = false; for (let x = a; x < b; x++) if (D[y * DW + x] > INK) { any = true; break; } if (any) { if (r0 < 0) r0 = y; r1 = y + 1; } } return r0 < 0 ? [0, 0] : [r0, r1]; };
  const sub = (a, b, r0, r1) => { const ww = b - a, hh = r1 - r0, o = new Float32Array(ww * hh); for (let y = 0; y < hh; y++) for (let x = 0; x < ww; x++) o[y * ww + x] = D[(y + r0) * DW + x + a]; return [o, ww, hh]; };
  const runs = []; let s0 = -1; for (let x = 0; x <= DW; x++) { const on = x < DW && col[x] > 0; if (on && s0 < 0) s0 = x; if (!on && s0 >= 0) { runs.push([s0, x]); s0 = -1; } }
  const pieces = [];
  for (const [a, b] of runs) {
    const st = [[a, b]];
    while (st.length) {
      const [a2, b2] = st.pop(), [r0, r1] = vext(a2, b2), hh = r1 - r0; if (hh < 5 * k) continue;
      if (hh >= 10 * k && b2 - a2 > 0.78 * hh + 2 * k) {
        const wc = classifyItalic(...sub(a2, b2, r0, r1));
        if (!(wc.c === 'x' && wc.conf >= 0.7)) {
          const lo = a2 + Math.floor(0.3 * hh), hi = b2 - Math.floor(0.3 * hh);
          if (hi > lo) { let cut = lo; for (let x = lo; x < hi; x++) if (col[x] < col[cut]) cut = x; st.push([a2, cut], [cut, b2]); continue; }
        }
      }
      pieces.push([a2, b2, r0, r1]);
    }
  }
  pieces.sort((p, q) => p[0] - q[0]);
  if (!pieces.length) return null;
  let res = pieces.map(([a, b, r0, r1]) => { const c = classifyItalic(...sub(a, b, r0, r1)); return { c: c.c, conf: c.conf, sim: c.sim, a, b, r0, r1 }; });
  const hm0 = Math.max(...res.map((r) => r.r1 - r.r0));
  while (res.length && res[0].c === 'x' && res[0].r1 - res[0].r0 < 0.75 * hm0) res.shift();
  while (res.length && res[res.length - 1].c === 'x' && res[res.length - 1].r1 - res[res.length - 1].r0 < 0.6 * hm0) res.pop();
  if (!res.length || res.some((r) => r.c === 'x')) return null;
  const hm = Math.max(...res.map((r) => r.r1 - r.r0)), bm = Math.min(...res.filter((r) => r.r1 - r.r0 >= 0.85 * hm).map((r) => r.r1));
  const main = res.filter((r) => r.r1 <= bm + 0.12 * hm), subs = res.filter((r) => r.r1 > bm + 0.12 * hm);
  if (hm < 13 * k || !main.length || main.length > 3 || subs.length > 1 || (subs.length && subs[0] !== res[res.length - 1])) return null;
  if (Math.min(...res.map((r) => r.conf)) < 0.6 || Math.min(...res.map((r) => r.sim)) < 0.72) return null;
  // nét gạch của đường đứt dính nhau: mọi điểm mực nằm sát một đường thẳng (trừ số 1)
  if (!res.every((r) => r.c === '1')) {
    let n = 0, mx = 0, my = 0; for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) if (im[y * tw + x] > INK) { n++; mx += x; my += y; }
    if (n > 12) { mx /= n; my /= n; let sxx = 0, syy = 0, sxy = 0; for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) if (im[y * tw + x] > INK) { const dx = x - mx, dy = y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
      const tr = sxx + syy, det = sxx * syy - sxy * sxy, l2 = tr / 2 - Math.sqrt(Math.max(0, tr * tr / 4 - det)); // trị riêng nhỏ
      let ex = sxy, ey = l2 - sxx, nn = Math.hypot(ex, ey); if (nn < 1e-9) { ex = sxx < syy ? 1 : 0; ey = 1 - ex; nn = 1; } let close = 0;
      for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) if (im[y * tw + x] > INK) { if (Math.abs(((x - mx) * ex + (y - my) * ey) / nn) < 2.2 * k) close++; }
      if (close / n > 0.93) return null; }
  }
  const txt = main.map((r) => r.c).join(''), v = parseInt(txt, 10) + (subs.length ? +subs[0].c / 10 : 0);
  if (v > 150 || (dry && v > 9)) return null; // ngoài khoảng hợp lý của hải đồ ven bờ
  const a0 = main[0].a, a1 = main[main.length - 1].b, ym = (main[0].r0 + bm) / 2;
  // vị trí số đo sâu = giữa phần nguyên (quy ước INT1), đổi ngược phép nắn về ảnh gốc
  const cx = x0 + (a0 + a1) / 2 - ds.off + SLANT * (th - 1 - ym), cy = y0 + ym;
  return { v, dry, txt: txt + (subs.length ? '_' + subs[0].c : ''), x: cx, y: cy, h: hm, conf: Math.min(...res.map((r) => r.conf)) };
}

// cắt chữ số đứng theo thành phần liên thông (chữ đậm, rời nhau), mảnh vụn chồng cột thì gộp
function uprightPieces(im, tw, th) {
  const b = new Uint8Array(tw * th); for (let i = 0; i < b.length; i++) b[i] = im[i] > INK ? 1 : 0;
  const { lab, n, st } = label(b, tw, th, true), C = [];
  for (let k = 1; k < n; k++) if (st[k * 5 + 4] >= 4) C.push({ a: st[k * 5], b: st[k * 5 + 2] + 1, y0: st[k * 5 + 1], y1: st[k * 5 + 3] + 1, n: st[k * 5 + 4], ks: [k] });
  C.sort((p, q) => p.a - q.a); const M = [];
  for (const q of C) {
    const m = M[M.length - 1];
    if (m) { const ov = Math.min(m.b, q.b) - Math.max(m.a, q.a);
      if (ov > 0.6 * Math.min(m.b - m.a, q.b - q.a) && (q.n < 0.3 * m.n || m.n < 0.3 * q.n)) { m.a = Math.min(m.a, q.a); m.b = Math.max(m.b, q.b); m.y0 = Math.min(m.y0, q.y0); m.y1 = Math.max(m.y1, q.y1); m.ks.push(...q.ks); m.n += q.n; continue; } }
    M.push(q);
  }
  for (const q of M) { const ww = q.b - q.a, hh = q.y1 - q.y0, o = new Float32Array(ww * hh), ks = new Set(q.ks);
    for (let y = 0; y < hh; y++) for (let x = 0; x < ww; x++) { const i = (y + q.y0) * tw + x + q.a; if (ks.has(lab[i])) o[y * ww + x] = im[i]; }
    q.img = o; q.w = ww; q.h = hh; }
  return M;
}
function readUpright(t, lab, dk, w, h, paren) {
  const { im, tw, th } = tokImg(t, lab, dk, w, h, 1); let P = uprightPieces(im, tw, th);
  if (paren) {
    if (P.length < 3) return null;
    const hin = P.slice(1, -1).map((p) => p.h).sort((a, b) => a - b)[(P.length - 2) >> 1];
    for (const q of [P[0], P[P.length - 1]]) if (q.w > 0.45 * hin || q.h < 1.08 * hin) return null;
    P = P.slice(1, -1);
  }
  if (!P.length) return null;
  const hm = Math.max(...P.map((p) => p.h)); let txt = '', sims = [];
  for (const p of P) {
    if (p.h < 0.35 * hm && p.w < 0.4 * hm && txt && txt.indexOf('.') < 0) { txt += '.'; continue; }
    const r = classifyUpright(p.img, p.w, p.h); if (!r) return null; txt += r.c; sims.push(r.sim);
  }
  if (!sims.length || Math.min(...sims) < 0.7 || txt.replace('.', '').length > 4 || txt.endsWith('.')) return null;
  return { v: parseFloat(txt), sim: Math.min(...sims) };
}

// đọc một khối; trả về điểm có tâm nằm trong lõi khối [cx0, cy0, cx1, cy1) (tọa độ ảnh tờ)
export function readBlock(idx, W, H, P, k, X0, Y0, w, h, core) {
  const { dk, ink, cls } = blockArrays(idx, W, X0, Y0, w, h, P), { T, lab } = tokens(ink, w, h, k);
  const snd = [], hts = [];
  const inCore = (x, y) => x + X0 >= core[0] && x + X0 < core[2] && y + Y0 >= core[1] && y + Y0 < core[3];
  const accepted = new Set();
  for (let i = 0; i < T.length; i++) {
    const t = T[i], r = readSounding(t, lab, dk, w, h, k); if (!r) continue;
    r.bg = bgOf(cls, w, h, t.x0, t.y0, t.x1, t.y1); r.ti = i; r.box = [t.x0, t.y0, t.x1, t.y1]; accepted.add(i); snd.push(r);
  }
  // chữ trong địa danh / ghi chú: cụm số có cụm khác (không phải số) sát cạnh cùng hàng thì bỏ
  for (const o of snd) {
    const [x0, y0, x1, y1] = o.box, hh = y1 - y0;
    for (let j = 0; j < T.length; j++) {
      if (j === o.ti || accepted.has(j)) continue; const q = T[j];
      if (q.y1 - q.y0 < 0.6 * hh) continue;
      const ov = Math.min(q.y1, y1) - Math.max(q.y0, y0); if (ov <= 0.5 * hh) continue;
      const gR = q.x0 - x1, gL = x0 - q.x1;
      if ((gR >= -1 && gR < 0.7 * hh) || (gL >= -1 && gL < 0.7 * hh)) { o.bg = 'text'; break; }
    }
  }
  const out = [];
  for (const o of snd) { if (!inCore(o.x, o.y)) continue; out.push({ x: o.x + X0, y: o.y + Y0, v: o.v, dry: o.dry, txt: o.txt, h: o.h, conf: o.conf, bg: o.bg }); }
  // ---- độ cao: chấm tròn nhỏ + số đứng cạnh bên
  const { st, n } = label(ink, w, h, true), tb = T;
  const used = new Set();
  for (let i = 1; i < n; i++) {
    const dx0 = st[i * 5], dy0 = st[i * 5 + 1], dw = st[i * 5 + 2] - dx0 + 1, dh = st[i * 5 + 3] - dy0 + 1, ar = st[i * 5 + 4];
    if (dw < 3 * k || dw > 9 * k || dh < 3 * k || dh > 9 * k || ar <= 0.6 * dw * dh || Math.abs(dw - dh) > 2 * k) continue;
    const cy = dy0 + dh / 2, cx = dx0 + dw / 2; if (!inCore(cx, cy)) continue;
    let got = null;
    for (let j = 0; j < tb.length && !got; j++) {
      const t = tb[j]; if (used.has(j) || !(t.y0 < cy && t.y1 > cy && t.y1 - t.y0 >= 13 * k)) continue;
      const right = t.x0 > dx0 + dw && t.x0 < dx0 + dw + 14 * k, left = t.x1 < dx0 && t.x1 > dx0 - 12 * k; if (!right && !left) continue;
      const r = readUpright(t, lab, dk, w, h, false); if (!r || (r.v < 2 && Number.isInteger(r.v))) continue;
      if (bgOf(cls, w, h, Math.min(dx0, t.x0) - 6, t.y0 - 6, Math.max(dx0 + dw, t.x1) + 6, t.y1 + 6) !== 'land') continue;
      used.add(j); got = r;
    }
    if (got) hts.push({ x: cx + X0, y: cy + Y0, v: got.v, kind: 0 });
  }
  // số trong ngoặc: độ cao cả hòn (đặt sau vào chỗ cao nhất của hòn gần nhất)
  for (let j = 0; j < tb.length; j++) {
    const t = tb[j]; if (used.has(j) || accepted.has(j) || t.g.length < 2 || t.y1 - t.y0 < 14 * k) continue;
    const cx = (t.x0 + t.x1) / 2, cy = (t.y0 + t.y1) / 2; if (!inCore(cx, cy)) continue;
    const r = readUpright(t, lab, dk, w, h, true); if (r) hts.push({ x: cx + X0, y: cy + Y0, v: r.v, kind: 1 });
  }
  return { snd: out, hts };
}

// lọc sau: số lẻ mồ côi (chữ số chính dính nét kẻ nên mất), số lệch hẳn các số lân cận → nghi
export function postFilter(snd, k) {
  const multi = snd.filter((o) => o.txt.split('_')[0].length >= 2).map((o) => o.h).sort((a, b) => a - b);
  const hmain = multi.length ? multi[multi.length >> 1] : 20 * k;
  const keep = [];
  // số nằm trong vùng bãi (xanh lá, khô khi nước ròng) là độ cao bãi cạn dù gạch chân bị mất
  for (const o of snd) { if (o.bg === 'text' || o.bg === 'land') continue; if (o.h < 0.88 * hmain) continue; if (o.bg === 'flat' && o.v < 4.5) o.dry = true; keep.push(o); }
  // lưới tra lân cận
  const cell = 200 * k, g = new Map(), key = (x, y) => ((x / cell) | 0) + ',' + ((y / cell) | 0);
  keep.forEach((o, i) => { const kk = key(o.x, o.y); if (!g.has(kk)) g.set(kk, []); g.get(kk).push(i); });
  const val = (o) => (o.dry ? -o.v : o.v);
  for (const o of keep) {
    const cx = (o.x / cell) | 0, cy = (o.y / cell) | 0, near = [];
    for (let a = cx - 2; a <= cx + 2; a++) for (let b = cy - 2; b <= cy + 2; b++) for (const j of g.get(a + ',' + b) || []) { const q = keep[j]; if (q === o) continue; const d = Math.hypot(q.x - o.x, q.y - o.y); if (d < 400 * k) near.push([d, val(q)]); }
    near.sort((p, q) => p[0] - q[0]); const nb = near.slice(0, 8).map((p) => p[1]);
    if (nb.length < 4) continue;
    const s = nb.slice().sort((p, q) => p - q), med = s[s.length >> 1], q10 = s[Math.floor(s.length * 0.1)], q90 = s[Math.min(s.length - 1, Math.floor(s.length * 0.9))];
    if (Math.abs(val(o) - med) > Math.max(4, 0.5 * Math.abs(med), 1.5 * (q90 - q10))) o.suspect = true;
  }
  return keep;
}
// gộp độ cao trùng (một điểm bị đọc hai lần)
export function dedupeHeights(hts, k) {
  const out = [];
  for (const h of hts) if (!out.some((q) => Math.abs(q.x - h.x) < 60 * k && Math.abs(q.y - h.y) < 60 * k && q.v === h.v)) out.push(h);
  return out;
}
