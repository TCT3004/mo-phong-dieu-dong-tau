// Dựng độ cao đất từ hải đồ raster (làm ở nửa độ phân giải): lớp đất / bãi / nước từng điểm ảnh, đường bình độ cam,
// đếm số đường bình độ từ bờ lên (bậc), khoảng cao đều suy từ điểm độ cao, nội suy giữa hai đường, đỉnh theo số độ cao.
// Đảo không có đường bình độ: dựng theo hình đảo (khoảng cách tới bờ) và số độ cao (chấm / ngoặc).
import { label, dilate, open, close, edt, thin, maskedBlur, waterTintIds, pureWater } from './img.js';

const S = 2; // hệ số thu nhỏ
// ---------- 1. mặt nạ nửa độ phân giải ----------
// cls2: 0 chưa rõ, 1 nước, 2 bãi, 3 đất (đa số trong 2×2); or2: có nét cam; thick2: chữ / ký hiệu gọn (vật chắn); thin2: nét mảnh / đường dài (cho đi qua); white2
export function halfMasks(idx, W, H, P, k) {
  const W2 = Math.ceil(W / S), H2 = Math.ceil(H / S), n2 = W2 * H2;
  const cls2 = new Uint8Array(n2), or2 = new Uint8Array(n2), thick2 = new Uint8Array(n2), thin2 = new Uint8Array(n2), white2 = new Uint8Array(n2), tint2 = new Uint8Array(n2);
  const { TI, n: nTint } = waterTintIds(idx, P);
  const BH = 1024, OV = 8, longPx = 60 * k;
  for (let by = 0; by < H; by += BH) {
    const y0 = Math.max(0, by - OV), y1 = Math.min(H, by + BH + OV), h = y1 - y0;
    const unk = new Uint8Array(W * h);
    for (let y = 0; y < h; y++) { const s = (y + y0) * W, o = y * W; for (let x = 0; x < W; x++) { const c = idx[s + x]; unk[o + x] = (P.cls[c] === 0 || P.white[c]) && !P.orange[c] ? 1 : 0; } }
    const op = open(unk, W, h, 3), dth = dilate(op, W, h, 3), thick = new Uint8Array(W * h);
    for (let i = 0; i < thick.length; i++) thick[i] = dth[i] & unk[i];
    const { lab, n, st } = label(thick, W, h, true), isLong = new Uint8Array(n);
    for (let c = 1; c < n; c++) if (Math.max(st[c * 5 + 2] - st[c * 5], st[c * 5 + 3] - st[c * 5 + 1]) > longPx) isLong[c] = 1;
    const cnt = new Uint8Array(W2 * 4), cntT = new Uint8Array(W2 * 8);
    for (let y = by; y < Math.min(H, by + BH); y++) {
      const yy = y - y0, s = y * W, o = yy * W, y2 = y >> 1;
      for (let x = 0; x < W; x++) {
        const c = idx[s + x], i2 = y2 * W2 + (x >> 1), cl = P.cls[c];
        if (P.orange[c]) or2[i2] = 1;
        if (P.white[c]) white2[i2] = 1;
        if (thick[o + x] && !isLong[lab[o + x]]) thick2[i2] = 1; else if (unk[o + x]) thin2[i2] = 1;
        if (cl) cnt[(x >> 1) * 4 + cl]++;
        if (TI[c] && pureWater(idx, W, H, s + x, P.cls)) cntT[(x >> 1) * 8 + TI[c]]++;
      }
      if ((y & 1) || y === H - 1) for (let x2 = 0; x2 < W2; x2++) {
        const a = cnt[x2 * 4 + 1], b = cnt[x2 * 4 + 2], c3 = cnt[x2 * 4 + 3];
        cls2[y2 * W2 + x2] = c3 >= a && c3 >= b && c3 ? 3 : b > a ? 2 : a ? 1 : 0;
        cnt[x2 * 4 + 1] = cnt[x2 * 4 + 2] = cnt[x2 * 4 + 3] = 0;
        let bt = 0, bn = 0; for (let t = 1; t <= nTint; t++) { const q = cntT[x2 * 8 + t]; if (q > bn) { bn = q; bt = t; } cntT[x2 * 8 + t] = 0; }
        tint2[y2 * W2 + x2] = bt;
      }
    }
  }
  for (let i = 0; i < n2; i++) if (thick2[i]) thin2[i] = 0;
  // điểm chưa rõ lấy lớp của điểm đã rõ gần nhất (nét bờ đen chia đôi cho hai bên)
  const known = new Uint8Array(n2); for (let i = 0; i < n2; i++) known[i] = cls2[i] ? 1 : 0;
  const { I } = edt(known, W2, H2, true); for (let i = 0; i < n2; i++) if (!cls2[i] && I[i] >= 0) cls2[i] = cls2[I[i]];
  return { W2, H2, cls2, or2, thick2, thin2, white2, tint2, nTint };
}

// ---------- 2. độ cao đất ----------
// hts: [{ x, y (điểm ảnh tờ), v, kind 0 chấm / 1 ngoặc }]; mpp: m / điểm ảnh tờ; hc: độ cao mép bờ (m trên số 0 hải đồ)
// → { E (Float32, nửa độ phân giải, chỉ có nghĩa trên đất), land (Uint8), interval, levels, spots }
export function landElevation(M, hts, mpp, hc, k, log0 = () => {}) {
  const t0 = Date.now(), log = (s) => log0(s + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
  const { W2, H2, cls2, or2, thick2, thin2, white2 } = M, n2 = W2 * H2, m2 = mpp * S;
  // đường bộ (lòng trắng hẹp sát đất) và suối nhỏ (dải nước / bãi hẹp) tính là đất khi dựng núi
  const land = new Uint8Array(n2); for (let i = 0; i < n2; i++) land[i] = cls2[i] === 3 ? 1 : 0;
  { const wt = new Uint8Array(n2); for (let i = 0; i < n2; i++) wt[i] = white2[i] && cls2[i] === 1 ? 1 : 0;
    const wo = open(wt, W2, H2, 5), nl = dilate(land, W2, H2, 7);
    const wat = new Uint8Array(n2); for (let i = 0; i < n2; i++) wat[i] = land[i] ? 0 : 1;
    const wop = open(wat, W2, H2, 5);
    // dải hẹp chỉ thành đất khi hai bên đều là đất (suối, đường trong đảo) — không nối đảo qua bãi / luồng hẹp
    const between = (i) => { const x = i % W2, y = (i / W2) | 0; let l = 0, r = 0, u = 0, d = 0;
      for (let s = 1; s <= 4; s++) { if (x - s >= 0 && cls2[i - s] === 3) l = 1; if (x + s < W2 && cls2[i + s] === 3) r = 1; if (y - s >= 0 && cls2[i - s * W2] === 3) u = 1; if (y + s < H2 && cls2[i + s * W2] === 3) d = 1; }
      return (l && r) || (u && d); };
    const add = []; for (let i = 0; i < n2; i++) if (((wt[i] && !wo[i] && nl[i]) || (wat[i] && !wop[i])) && between(i)) add.push(i);
    for (const i of add) land[i] = 1; }
  // đường bình độ: nét cam, nối qua nét mảnh (lưới kinh vĩ, đường bộ), làm mảnh còn 1 điểm ảnh
  let O = new Uint8Array(n2);
  { const c = close(or2, W2, H2, 7); for (let i = 0; i < n2; i++) O[i] = ((c[i] && (or2[i] || thin2[i])) || or2[i]) && land[i] ? 1 : 0; }
  let Sk = thin(dilate(O, W2, H2, 3).map((v, i) => v & land[i]), W2, H2);
  { const { lab, n, st } = label(Sk, W2, H2, true); for (let i = 0; i < n2; i++) if (Sk[i] && st[lab[i] * 5 + 4] < 8) Sk[i] = 0; }
  // nối chỗ đứt: đầu mút giữa đất → đầu mút gần nhất / mép đất / chữ to (bán kính theo nửa độ phân giải)
  { const nb = (i) => Sk[i - 1] + Sk[i + 1] + Sk[i - W2] + Sk[i + W2] + Sk[i - W2 - 1] + Sk[i - W2 + 1] + Sk[i + W2 - 1] + Sk[i + W2 + 1];
    const junc = new Uint8Array(n2), ends = [];
    for (let y = 1; y < H2 - 1; y++) for (let x = 1; x < W2 - 1; x++) { const i = y * W2 + x; if (Sk[i] && nb(i) >= 3) junc[i] = 1; }
    const jz = dilate(junc, W2, H2, 5);
    for (let y = 3; y < H2 - 3; y++) for (let x = 3; x < W2 - 3; x++) { const i = y * W2 + x; if (Sk[i] && nb(i) === 1 && !jz[i]) ends.push(i); }
    const { lab: skl, st: sks } = label(Sk, W2, H2, true);
    const stop = new Uint8Array(n2); for (let i = 0; i < n2; i++) stop[i] = !land[i] || thick2[i] ? 1 : 0;
    const ES = edt(stop, W2, H2, true);
    const line = (a, b) => { let x0 = a % W2, y0 = (a / W2) | 0; const x1 = b % W2, y1 = (b / W2) | 0, dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
      for (;;) { Sk[y0 * W2 + x0] = 1; if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } };
    const cell = 32, g = new Map(); ends.forEach((i, j) => { const key = (((i % W2) / cell) | 0) + ',' + ((((i / W2) | 0) / cell) | 0); if (!g.has(key)) g.set(key, []); g.get(key).push(j); });
    const done = new Set(); let nbr = 0, nst = 0;
    ends.forEach((i, j) => {
      const x = i % W2, y = (i / W2) | 0, cx = (x / cell) | 0, cy = (y / cell) | 0; let best = -1, bd = 18;
      for (let a = cx - 1; a <= cx + 1; a++) for (let b = cy - 1; b <= cy + 1; b++) for (const q of g.get(a + ',' + b) || []) {
        if (q === j || done.has(Math.min(j, q) + ',' + Math.max(j, q))) continue; const e = ends[q], d = Math.hypot(e % W2 - x, ((e / W2) | 0) - y);
        if (d >= bd) continue; if (skl[e] === skl[i] && sks[skl[i] * 5 + 4] < 6 * d) continue; best = q; bd = d; }
      const ds = ES.D[i];
      if (ds < 10 && (best < 0 || ds < bd)) { line(i, ES.I[i]); nst++; }
      else if (best >= 0) { done.add(Math.min(j, best) + ',' + Math.max(j, best)); line(i, ends[best]); nbr++; }
    });
    log('đầu mút đường bình độ ' + ends.length + ', nối ' + nbr + ', nối tới bờ / chữ ' + nst); }
  O = new Uint8Array(n2); for (let i = 0; i < n2; i++) O[i] = Sk[i] && land[i] && !thick2[i] ? 1 : 0; Sk = null;
  // vùng giữa các đường bình độ (bỏ dải sát bờ và mép khung: đường chạm bờ / chạm mép hay hở vài điểm ảnh)
  const dco = edt(land.map((v) => (v ? 0 : 1)), W2, H2).D;
  const R = new Uint8Array(n2);
  for (let y = 2; y < H2 - 2; y++) for (let x = 2; x < W2 - 2; x++) { const i = y * W2 + x; R[i] = land[i] && !O[i] && !thick2[i] && dco[i] > 3.5 ? 1 : 0; }
  const { lab: L, n: nR, st: Rst } = label(R, W2, H2, false);
  log('vùng giữa đường bình độ ' + (nR - 1));
  // kề nhau qua nét cam (cửa sổ 3×3 trên nét 1 điểm ảnh — không nhảy cóc qua hai đường ở sườn dốc)
  const adj = new Map(), pairs = new Map();
  for (let y = 1; y < H2 - 1; y++) for (let x = 1; x < W2 - 1; x++) {
    const i = y * W2 + x; if (!O[i]) continue; let mn = 0, mx = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const l = L[i + dy * W2 + dx]; if (!l) continue; if (!mn || l < mn) mn = l; if (l > mx) mx = l; }
    if (mn && mx !== mn) { const key = mn * 1048576 + mx; pairs.set(key, (pairs.get(key) || 0) + 1); }
  }
  for (const [key, c] of pairs) { if (c < 3) continue; const a = Math.floor(key / 1048576), b = key % 1048576; if (!adj.has(a)) adj.set(a, []); if (!adj.has(b)) adj.set(b, []); adj.get(a).push(b); adj.get(b).push(a); }
  // bậc 0 = dải thấp nhất ven bờ (chạm bờ dài); vùng chạm bờ dài nhưng giữa nó và mép bờ đã có đường bình độ → bậc 1
  const cnt = new Int32Array(nR), cntO = new Int32Array(nR);
  { const Oc = new Uint8Array(n2); for (let i = 0; i < n2; i++) Oc[i] = O[i] && dco[i] <= 3.5 ? 1 : 0;
    const Onear = dilate(Oc, W2, H2, 9);
    for (let i = 0; i < n2; i++) if (L[i] && dco[i] > 3.5 && dco[i] < 5) { cnt[L[i]]++; if (Onear[i]) cntO[L[i]]++; } }
  const lev = new Int32Array(nR).fill(1 << 30), dq = [];
  for (let r = 1; r < nR; r++) if (cnt[r] >= 60 && cntO[r] < 0.3 * cnt[r]) { lev[r] = 0; dq.push(r); }
  for (let r = 1; r < nR; r++) if (cnt[r] >= 60 && cntO[r] >= 0.3 * cnt[r]) { lev[r] = 1; dq.push(r); }
  for (let h = 0; h < dq.length; h++) { const a = dq[h]; for (const b of adj.get(a) || []) if (lev[a] + 1 < lev[b]) { lev[b] = lev[a] + 1; dq.push(b); } }
  let maxk = 0; for (let r = 1; r < nR; r++) if (lev[r] < 1 << 29 && lev[r] > maxk) maxk = lev[r];
  // điểm độ cao: vị trí trên lưới nửa độ phân giải, vùng chứa nó
  const nearLand = (() => { let tree = null; return (x, y, maxD) => {
    const xi = Math.round(x), yi = Math.round(y);
    if (xi >= 0 && yi >= 0 && xi < W2 && yi < H2 && land[yi * W2 + xi]) return yi * W2 + xi;
    if (!tree) tree = edt(land, W2, H2, true);
    if (xi < 0 || yi < 0 || xi >= W2 || yi >= H2) return -1;
    const i = yi * W2 + xi; return tree.D[i] <= maxD ? tree.I[i] : -1; }; })();
  const spots = [];
  for (const h of hts) {
    const i = nearLand(h.x / S, h.y / S, (h.kind ? 400 : 60) / m2); if (i < 0) continue;
    spots.push({ i, v: h.v, kind: h.kind });
  }
  // khoảng cao đều: k·I ≤ v < (k+1)·I (cho lệch ½ khoảng), chọn khoảng khớp nhiều điểm nhất
  let I = 0, fit = 0, cons = [];
  for (const s of spots) { if (s.kind) continue; const x = s.i % W2, y = (s.i / W2) | 0; let kk = -1;
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W2 || yy >= H2) continue; const l = L[yy * W2 + xx]; if (l && lev[l] < 1 << 29 && lev[l] > kk) kk = lev[l]; }
    if (kk >= 0) cons.push([s.v, kk]); }
  if (maxk > 0 && cons.length) for (const c of [5, 10, 20, 25, 40, 50, 100]) {
    const ok = cons.filter(([v, kk]) => kk * c - c * 0.5 <= v - hc && v - hc < (kk + 1) * c + c * 0.5).length;
    if (ok > fit || (ok === fit && c > I)) { fit = ok; I = c; }
  }
  if (cons.length && fit < Math.max(2, cons.length * 0.4)) I = 0; // đếm bậc không tin được → bỏ đường bình độ
  log('khoảng cao đều ' + (I || '—') + ' m, khớp ' + fit + '/' + cons.length + ' điểm độ cao, bậc cao nhất ' + maxk);
  const E = new Float32Array(n2).fill(NaN);
  const spotIn = new Map();
  for (const s of spots) { const x = s.i % W2, y = (s.i / W2) | 0, cnts = new Map();
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W2 || yy >= H2) continue; const l = L[yy * W2 + xx]; if (l) cnts.set(l, (cnts.get(l) || 0) + 1); }
    let best = 0, bc = 0; for (const [l, c] of cnts) if (c > bc) { bc = c; best = l; } if (best && !s.kind) { if (!spotIn.has(best)) spotIn.set(best, []); spotIn.get(best).push(s.v); } }
  if (I) {
    const Oval = new Int32Array(n2).fill(-1);
    for (let y = 1; y < H2 - 1; y++) for (let x = 1; x < W2 - 1; x++) { const i = y * W2 + x; if (!O[i]) continue; let mx = -1;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const l = L[i + dy * W2 + dx]; if (l && lev[l] < 1 << 29 && lev[l] > mx) mx = lev[l]; } Oval[i] = mx; }
    for (let kk = 0; kk <= maxk; kk++) {
      // khung bao các vùng bậc kk (+ lề)
      let bx0 = W2, by0 = H2, bx1 = -1, by1 = -1;
      for (let r = 1; r < nR; r++) if (lev[r] === kk) { bx0 = Math.min(bx0, Rst[r * 5]); by0 = Math.min(by0, Rst[r * 5 + 1]); bx1 = Math.max(bx1, Rst[r * 5 + 2]); by1 = Math.max(by1, Rst[r * 5 + 3]); }
      if (bx1 < 0) continue;
      const mg = 80, box = [Math.max(0, bx0 - mg), Math.max(0, by0 - mg), Math.min(W2, bx1 + mg + 1), Math.min(H2, by1 + mg + 1)], bw = box[2] - box[0], bh = box[3] - box[1];
      const lo = new Uint8Array(bw * bh), up = new Uint8Array(bw * bh); let anyUp = false;
      for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) { const i = y * W2 + x, j = (y - box[1]) * bw + x - box[0]; if (kk > 0 ? Oval[i] === kk : (land[i] && dco[i] <= 1)) lo[j] = 1; if (Oval[i] === kk + 1) { up[j] = 1; anyUp = true; } }
      const DL = edt(lo, bw, bh).D, DU = anyUp ? edt(up, bw, bh).D : null;
      const base = kk > 0 ? kk * I : hc, top = (kk + 1) * I;
      // vùng có giáp đường cao hơn
      const touch = new Set();
      if (anyUp) { const ud = dilate(up, bw, bh, 3); for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) { const i = y * W2 + x; if (ud[(y - box[1]) * bw + x - box[0]] && L[i] && lev[L[i]] === kk) touch.add(L[i]); } }
      const peakDL = new Map();
      for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) {
        const i = y * W2 + x, l = L[i]; if (!l || lev[l] !== kk) continue; const j = (y - box[1]) * bw + (x - box[0]);
        if (touch.has(l)) E[i] = base + (top - base) * DL[j] / Math.max(DL[j] + DU[j], 1e-3);
        else peakDL.set(l, Math.max(peakDL.get(l) || 0, DL[j]));
      }
      // vùng đỉnh: vòm theo điểm độ cao (mảnh vụn không điểm độ cao để lấp theo lân cận)
      for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) {
        const i = y * W2 + x, l = L[i]; if (!l || lev[l] !== kk || touch.has(l)) continue;
        if (Rst[l * 5 + 4] < 200 && !spotIn.has(l)) continue;
        const j = (y - box[1]) * bw + (x - box[0]), pk = base + 0.5 * I; // độ cao thật của đỉnh do bước hiệu chỉnh theo điểm độ cao lo
        E[i] = base + (pk - base) * Math.pow(Math.min(1, DL[j] / Math.max(peakDL.get(l), 1)), 0.7);
      }
    }
  }
  // các đảo: có đường bình độ dùng được hay không
  const { lab: comp, n: nc } = label(land, W2, H2, true), hasC = new Uint8Array(nc);
  if (I) for (let i = 0; i < n2; i++) if (O[i] && comp[i]) hasC[comp[i]] = 1;
  // lấp điểm chưa có (nét cam, chữ, dải sát bờ) theo điểm có giá trị gần nhất; mép bờ = hc
  for (let i = 0; i < n2; i++) if (land[i] && dco[i] <= 1 && hasC[comp[i]]) E[i] = hc;
  { const src = new Uint8Array(n2); for (let i = 0; i < n2; i++) src[i] = isNaN(E[i]) ? 0 : 1;
    const NI = edt(src, W2, H2, true).I; for (let i = 0; i < n2; i++) if (land[i] && hasC[comp[i]] && isNaN(E[i]) && NI[i] >= 0) E[i] = E[NI[i]]; }
  // hiệu chỉnh theo điểm độ cao: tỷ lệ s = (v − hc) / (E − hc) tại từng chấm độ cao, nội suy nghịch đảo khoảng cách trong cùng đảo
  // (xa mọi điểm thì về 1), nhân vào (E − hc) → giữ dáng sườn theo đường bình độ, độ cao khớp số trên hải đồ, mép bờ giữ nguyên
  if (I) {
    const byC = new Map(), R0 = 1500 / m2;
    for (const s of spots) { if (s.kind) continue; const c = comp[s.i]; if (!c || !hasC[c] || isNaN(E[s.i]) || E[s.i] < hc + 1) continue;
      const f = Math.max(0.5, Math.min(3, (s.v - hc) / (E[s.i] - hc))); if (!byC.has(c)) byC.set(c, []); byC.get(c).push([s.i % W2, (s.i / W2) | 0, f]); }
    // tính trên lưới thưa (bước 4) rồi nội suy song tuyến — trường tỷ lệ rất mượt
    const G = 4, gw = Math.ceil(W2 / G) + 1, gh = Math.ceil(H2 / G) + 1, F = new Float32Array(gw * gh).fill(1), arrs = new Map();
    for (const [c, a] of byC) arrs.set(c, Float64Array.from(a.flat()));
    const nearC = new Int32Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) { const x = Math.min(W2 - 1, gx * G), y = Math.min(H2 - 1, gy * G); nearC[gy * gw + gx] = comp[y * W2 + x]; }
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      let c = nearC[gy * gw + gx]; if (!arrs.has(c)) { for (const q of [gy * gw + gx - 1, gy * gw + gx + 1, (gy - 1) * gw + gx, (gy + 1) * gw + gx]) if (q >= 0 && q < nearC.length && arrs.has(nearC[q])) { c = nearC[q]; break; } }
      const a = arrs.get(c); if (!a) continue; const x = gx * G, y = gy * G; let num = 1 / (R0 * R0), den = num;
      for (let s = 0; s < a.length; s += 3) { const dx = a[s] - x, dy = a[s + 1] - y, w = 1 / (dx * dx + dy * dy + 100); num += w * a[s + 2]; den += w; }
      F[gy * gw + gx] = num / den;
    }
    for (let i = 0; i < n2; i++) { if (!land[i] || !byC.has(comp[i]) || isNaN(E[i])) continue;
      const x = i % W2, y = (i / W2) | 0, fx = x / G, fy = y / G, x0 = fx | 0, y0 = fy | 0, ax = fx - x0, ay = fy - y0, o = y0 * gw + x0;
      const f = (F[o] * (1 - ax) + F[o + 1] * ax) * (1 - ay) + (F[o + gw] * (1 - ax) + F[o + gw + 1] * ax) * ay;
      E[i] = hc + (E[i] - hc) * f; }
    log('hiệu chỉnh theo ' + [...byC.values()].reduce((a, b) => a + b.length, 0) + ' điểm độ cao');
  }
  // đảo không có đường bình độ: vòm theo hình đảo (khoảng cách tới bờ, làm tròn sống) + số độ cao (chấm / ngoặc)
  { const D = new Float32Array(n2); for (let i = 0; i < n2; i++) D[i] = land[i] ? dco[i] * m2 : 0;
    const Db = maskedBlur(D, land, W2, H2, 6); const u = new Float32Array(n2); for (let i = 0; i < n2; i++) u[i] = land[i] ? Math.min(D[i], Db[i]) : 0;
    const umax = new Float32Array(nc), hmax = new Float32Array(nc).fill(NaN);
    for (let i = 0; i < n2; i++) if (land[i] && u[i] > umax[comp[i]]) umax[comp[i]] = u[i];
    for (const s of spots) { const c = comp[s.i]; if (!c) continue; hmax[c] = isNaN(hmax[c]) ? s.v : Math.max(hmax[c], s.v); }
    for (let i = 0; i < n2; i++) {
      if (!land[i] || hasC[comp[i]]) continue; const c = comp[i];
      const H = isNaN(hmax[c]) ? hc + Math.min(80, 0.6 * umax[c]) : Math.max(hc + 1, hmax[c]);
      E[i] = hc + (H - hc) * Math.pow(u[i] / Math.max(umax[c], 1e-3), 0.85);
    } }
  // làm mượt sườn (bỏ bậc thang ở đường bình độ) nhưng giữ mép bờ; dải sát bờ dốc đều từ hc
  for (let i = 0; i < n2; i++) if (!land[i]) E[i] = 0;
  const Es = maskedBlur(E, land, W2, H2, 3);
  for (let i = 0; i < n2; i++) { if (!land[i]) { Es[i] = NaN; continue; } if (dco[i] < 4) Es[i] = hc + (Es[i] - hc) * Math.max(0, dco[i] - 0.5) / 3.5; if (Es[i] < hc) Es[i] = hc; }
  return { E: Es, land, interval: I, levels: maxk, fit, nSpots: cons.length };
}
