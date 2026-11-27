// Đường đẳng sâu trên hải đồ raster (nét xám mảnh nối các chỗ cùng độ sâu: 5, 10, 20 m…).
// 1. isoLines (cần ảnh): nét mảnh dài trong vùng nước — bỏ chữ / ký hiệu (thành phần gọn), bỏ nét bờ (sát đất / bãi),
//    bỏ đường thẳng dài (lưới kinh vĩ, đường dẫn tàu, cáp…), làm mảnh, bỏ gai, tách ở chỗ giao nhau → từng đường có thứ tự,
//    lưu theo ô lưới z kèm hướng tiếp tuyến (cùng chiều dọc một đường).
// 2. isoValues (lúc dựng mặt nước, không cần ảnh — số đo sửa được): giá trị mỗi đường = mức chuẩn tách số đo sâu hai bên
//    (một bên nông hơn, một bên sâu hơn), cần đúng ≥ 85 % và khớp dải màu nước chỗ đường đi qua; không chắc thì bỏ đường đó.
// Module thuần (không DOM): chạy trong worker và trong Node.
import { label, thin, edt } from './img.js';

// ---------- 1. dò đường ----------
// idx: ảnh chỉ số màu W×H; P: paletteInfo; k = dpi / 250; cl: lớp ô lưới z (1 nước, 2 bãi, 3 đất) gw×gh, ô cell điểm ảnh tờ.
// → { off: Int32Array (số đường + 1), c: Int32Array (ô lưới theo thứ tự dọc đường), a: Uint8Array (hướng tiếp tuyến 0–255 ↔ 0–2π) }
export function isoLines(idx, W, H, P, k, cl, gw, gh, cell, log = () => {}) {
  const W2 = Math.ceil(W / 2), H2 = Math.ceil(H / 2), n2 = W2 * H2, f = cell / 2;
  // nét mực dài (bỏ thành phần gọn: chữ số, chữ, ký hiệu, nét đứt, chấm), ở nửa độ phân giải
  let ink = new Uint8Array(n2);
  { const longPx = 60 * k, BH = 1024, OV = Math.ceil(longPx) + 4;
    for (let by = 0; by < H; by += BH) {
      const y0 = Math.max(0, by - OV), y1 = Math.min(H, by + BH + OV), h = y1 - y0, m = new Uint8Array(W * h);
      for (let y = 0; y < h; y++) { const s = (y + y0) * W, o = y * W; for (let x = 0; x < W; x++) { const c = idx[s + x]; m[o + x] = P.soft[c] && !P.orange[c] ? 1 : 0; } }
      const { lab, n, st } = label(m, W, h, true), isLong = new Uint8Array(n);
      for (let c = 1; c < n; c++) if (Math.max(st[c * 5 + 2] - st[c * 5], st[c * 5 + 3] - st[c * 5 + 1]) > longPx) isLong[c] = 1;
      for (let y = by; y < Math.min(H, by + BH); y++) { const o = (y - y0) * W, r2 = (y >> 1) * W2; for (let x = 0; x < W; x++) if (m[o + x] && isLong[lab[o + x]]) ink[r2 + (x >> 1)] = 1; }
    } }
  // chỉ giữ trong vùng nước, cách đất / bãi ≥ 1 ô (nét bờ, đường 0 m quanh bãi)
  { const cx = (x) => Math.min(gw - 1, Math.floor(x / f)), cy = (y) => Math.min(gh - 1, Math.floor(y / f)), dry = new Uint8Array(gw * gh);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { const c = cl[y * gw + x]; if (c !== 2 && c !== 3) continue; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < gw && yy < gh) dry[yy * gw + xx] = 1; } }
    for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) { const i = y * W2 + x; if (ink[i] && (dry[cy(y) * gw + cx(x)] || cl[cy(y) * gw + cx(x)] !== 1)) ink[i] = 0; } }
  let Sk = thin(ink, W2, H2); ink = null;
  const minRun = Math.round(150 * k);
  const nStraight = dropStraight(Sk, W2, H2, minRun);
  pruneSpurs(Sk, W2, H2, Math.round(5 * k));
  // tách ở chỗ giao nhau (số lần đổi 0 → 1 quanh điểm ≥ 3): mỗi mảnh còn lại là một đường đơn
  { const J = []; for (let y = 1; y < H2 - 1; y++) for (let x = 1; x < W2 - 1; x++) { const i = y * W2 + x; if (Sk[i] && crossings(Sk, i, W2) >= 3) J.push(i); } for (const i of J) Sk[i] = 0; }
  // đi dọc từng đường (bắt đầu ở đầu mút, đường khép kín thì chỗ nào cũng được) → dãy điểm có thứ tự
  const minLen = Math.round(30 * k), vis = new Uint8Array(n2), off = [0], C = [], A = [], seen = new Int32Array(gw * gh).fill(-1);
  const NB = [-W2, 1, W2, -1, -W2 + 1, W2 + 1, W2 - 1, -W2 - 1]; // 4 hướng trước, chéo sau (không nhảy cóc qua bậc thang)
  const walk = (s) => { const p = [s]; vis[s] = 1; let cur = s;
    for (;;) { let nx = -1; for (const d of NB) { const q = cur + d; if (q >= 0 && q < n2 && Sk[q] && !vis[q] && Math.abs((q % W2) - (cur % W2)) <= 1) { nx = q; break; } } if (nx < 0) break; vis[nx] = 1; p.push(nx); cur = nx; }
    return p; };
  const emit = (p) => {
    if (p.length < minLen) return; const id = off.length - 1, w = 3;
    for (let j = 0; j < p.length; j++) {
      const a = p[Math.max(0, j - w)], b = p[Math.min(p.length - 1, j + w)], tx = (b % W2) - (a % W2), ty = ((b / W2) | 0) - ((a / W2) | 0);
      const x = p[j] % W2, y = (p[j] / W2) | 0, o = Math.min(gh - 1, Math.floor(y / f)) * gw + Math.min(gw - 1, Math.floor(x / f));
      if (seen[o] === id || (!tx && !ty)) continue; seen[o] = id;
      C.push(o); A.push(Math.round(((Math.atan2(ty, tx) / (2 * Math.PI)) + 1) * 256) & 255);
    }
    off.push(C.length);
  };
  const ends = [], pieces = []; for (let y = 1; y < H2 - 1; y++) for (let x = 1; x < W2 - 1; x++) { const i = y * W2 + x; if (Sk[i] && nbCount(Sk, i, W2) === 1) ends.push(i); }
  for (const s of ends) if (!vis[s]) { const p = walk(s); if (p.length >= 6) pieces.push(p); }
  for (let i = 0; i < n2; i++) if (Sk[i] && !vis[i]) { const p = walk(i); if (p.length >= 6) pieces.push(p); } // đường khép kín, mảnh sót
  const lines = joinPieces(pieces, W2, Math.round(30 * k));
  for (const p of lines) emit(p);
  log('đường đẳng sâu: ' + (off.length - 1) + ' đường (' + pieces.length + ' mảnh), ' + C.length + ' ô, bỏ ' + nStraight + ' đoạn thẳng');
  return { off: Int32Array.from(off), c: Int32Array.from(C), a: Uint8Array.from(A) };
}

// nối các mảnh của cùng một đường bị đứt (chỗ in số «10», ký hiệu đèn, chỗ giao đã tách): hai đầu mút cách ≤ G điểm ảnh,
// khoảng hở thẳng theo hướng ra của cả hai đầu. Ghép tham lam từ cặp gần nhất; đầu mút của chính mảnh đó → đường khép kín.
// Trả các đường (dãy điểm có thứ tự, mảnh nối sau đảo chiều nếu cần)
function joinPieces(pieces, W, G) {
  const n = pieces.length, E = [], xy = (i) => [i % W, (i / W) | 0];
  for (let p = 0; p < n; p++) { const q = pieces[p], L = q.length, m = Math.min(L - 1, 6);
    for (const [e, a, b] of [[0, q[0], q[m]], [1, q[L - 1], q[L - 1 - m]]]) { const A = xy(a), B = xy(b), dx = A[0] - B[0], dy = A[1] - B[1], d = Math.hypot(dx, dy) || 1; E.push({ p, e, x: A[0], y: A[1], ux: dx / d, uy: dy / d }); } }
  const cand = [];
  for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) {
    const a = E[i], b = E[j], gx = b.x - a.x, gy = b.y - a.y, g = Math.hypot(gx, gy); if (g > G) continue;
    if (a.p === b.p && pieces[a.p].length < 3 * g) continue; // tự khép: mảnh phải dài hơn hẳn khoảng hở
    const ok = g < 3 ? a.ux * -b.ux + a.uy * -b.uy > 0.3 : (gx * a.ux + gy * a.uy) / g > 0.8 && (-gx * b.ux - gy * b.uy) / g > 0.8;
    if (ok) cand.push([g, i, j]);
  }
  cand.sort((a, b) => a[0] - b[0]);
  const part = new Int32Array(E.length).fill(-1);
  for (const [, i, j] of cand) if (part[i] < 0 && part[j] < 0) { part[i] = j; part[j] = i; }
  const used = new Uint8Array(n), out = [];
  const chain = (p0, fwd0) => { let res = [], p = p0, fwd = fwd0;
    for (;;) { used[p] = 1; const q = pieces[p]; res = res.concat(fwd ? q : q.slice().reverse());
      const eo = p * 2 + (fwd ? 1 : 0), nx = part[eo]; if (nx < 0) break; const np = E[nx].p; if (used[np]) break; p = np; fwd = E[nx].e === 0; }
    return res; };
  for (let p = 0; p < n; p++) { if (used[p]) continue; if (part[p * 2] < 0) out.push(chain(p, true)); else if (part[p * 2 + 1] < 0) out.push(chain(p, false)); }
  for (let p = 0; p < n; p++) if (!used[p]) out.push(chain(p, true)); // vòng khép kín
  return out;
}
const nbCount = (m, i, W) => m[i - W - 1] + m[i - W] + m[i - W + 1] + m[i - 1] + m[i + 1] + m[i + W - 1] + m[i + W] + m[i + W + 1];
// số lần đổi 0 → 1 đi vòng 8 điểm quanh i (1 = đầu mút, 2 = giữa đường, ≥ 3 = chỗ rẽ nhánh / giao nhau)
function crossings(m, i, W) {
  const r = [m[i - W], m[i - W + 1], m[i + 1], m[i + W + 1], m[i + W], m[i + W - 1], m[i - 1], m[i - W - 1]]; let c = 0;
  for (let j = 0; j < 8; j++) if (!r[j] && r[(j + 1) & 7]) c++; return c;
}
// cắt gai ngắn (nét chữ số dính vào đường): bỏ đầu mút n lần (đường thật chỉ ngắn đi n điểm mỗi đầu)
function pruneSpurs(Sk, W, H, n) {
  for (let it = 0; it < n; it++) { const del = []; for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (Sk[i] && nbCount(Sk, i, W) <= 1) del.push(i); } if (!del.length) break; for (const i of del) Sk[i] = 0; }
}
// bỏ đoạn thẳng dài ≥ minRun (biến đổi Hough trên điểm đã làm mảnh): lưới kinh vĩ, đường dẫn tàu, cáp ngầm, khung hải đồ.
// Đường đẳng sâu cong nên không có đoạn thẳng dài như thế. Trả số đoạn đã bỏ
function dropStraight(Sk, W, H, minRun) {
  const NT = 360, cs = new Float32Array(NT), sn = new Float32Array(NT), R = Math.ceil(Math.hypot(W, H)), NR = 2 * R + 1;
  for (let t = 0; t < NT; t++) { cs[t] = Math.cos(t * Math.PI / NT); sn[t] = Math.sin(t * Math.PI / NT); }
  const acc = new Int32Array(NT * NR), vote = (i, d) => { const x = i % W, y = (i / W) | 0; for (let t = 0; t < NT; t++) acc[t * NR + Math.round(x * cs[t] + y * sn[t]) + R] += d; };
  for (let i = 0; i < Sk.length; i++) if (Sk[i]) vote(i, 1);
  // ứng viên: ô ≥ minVotes và lớn nhất trong lân cận 3×3 (θ, ρ) — các ô sát bên của cùng một đường không phải đi lại
  const minVotes = Math.round(minRun * 0.5), cand = [];
  for (let t = 0; t < NT; t++) for (let r = 1; r < NR - 1; r++) { const j = t * NR + r, v = acc[j]; if (v < minVotes) continue; let mx = true;
    for (let dt = -1; dt <= 1 && mx; dt++) { const tt = (t + dt + NT) % NT, rr = dt && (t + dt < 0 || t + dt >= NT) ? NR - 1 - r : r; for (let dr = -1; dr <= 1; dr++) { if (!dt && !dr) continue; const q = tt * NR + rr + dr; if (q >= 0 && q < acc.length && acc[q] > v) { mx = false; break; } } }
    if (mx) cand.push(j); }
  cand.sort((a, b) => acc[b] - acc[a]);
  const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? y * W + x : -1); let nDrop = 0;
  for (const j of cand) {
    if (acc[j] < minVotes) continue;
    const t = (j / NR) | 0, rho = (j % NR) - R, c = cs[t], s = sn[t];
    // đi dọc đường x·c + y·s = rho; dải ±1 điểm ảnh, hở ≤ 12 (chữ số in đè lên đường làm nét lệch). Có đoạn liền dài ≥ minRun
    // (phủ ≥ 60 %) hoặc tổng các đoạn ≥ 2 minRun (lưới kinh vĩ bị đảo / chữ cắt khúc) → bỏ mọi đoạn ≥ 20 điểm ảnh trên đường đó (dải ±2)
    let u0 = null, last = null, hits = 0, tot = 0, big = false; const runs = [];
    const close = () => { if (u0 !== null && last - u0 >= 20 && hits >= 0.6 * (last - u0)) { runs.push([u0, last]); tot += hits; if (last - u0 >= minRun) big = true; } u0 = null; hits = 0; };
    // khoảng u để điểm trên đường nằm trong ảnh
    let ua = -R, ub = R; { const px = rho * c, py = rho * s;
      if (Math.abs(s) > 1e-6) { const u1 = (px + 2) / s, u2 = (px - W - 1) / s; ua = Math.max(ua, Math.min(u1, u2)); ub = Math.min(ub, Math.max(u1, u2)); }
      if (Math.abs(c) > 1e-6) { const u1 = (-2 - py) / c, u2 = (H + 1 - py) / c; ua = Math.max(ua, Math.min(u1, u2)); ub = Math.min(ub, Math.max(u1, u2)); } }
    for (let u = Math.floor(ua); u <= Math.ceil(ub); u++) {
      const bx = rho * c - u * s, by = rho * s + u * c; if (bx < -2 || by < -2 || bx > W + 1 || by > H + 1) continue;
      let hit = false; for (let o = -1; o <= 1 && !hit; o++) { const q = at(Math.round(bx + o * c), Math.round(by + o * s)); if (q >= 0 && Sk[q]) hit = true; }
      if (hit) { if (u0 !== null && u - last > 12) close(); if (u0 === null) u0 = u; last = u; hits++; }
    }
    close();
    if (!big && tot < 2 * minRun) { acc[j] = -1; continue; }
    for (const [a, b] of runs) { nDrop++;
      for (let u = a; u <= b; u++) { const bx = rho * c - u * s, by = rho * s + u * c;
        for (let o = -2; o <= 2; o++) { const q = at(Math.round(bx + o * c), Math.round(by + o * s)); if (q >= 0 && Sk[q]) { Sk[q] = 0; vote(q, -1); } } } }
  }
  return nDrop;
}

// ---------- 2. giá trị từng đường ----------
const CAND = [2, 5, 10, 15, 20, 25, 30, 40, 50, 100, 200], ODD = new Set([15, 25, 40]); // mức ít dùng: chỉ chọn khi khớp hẳn hơn
// iso: kết quả isoLines; S: số đo sâu dùng được [{ x, y, v }] (điểm ảnh tờ); bandOf(o): dải { L, U } của màu nước ô o hoặc null;
// k = dpi / 250. → { pts: [{ x, y, v }] điểm dọc các đường đã có giá trị, lines: [{ v, n, err, ok }] }
export function isoValues(iso, S, gw, gh, cell, bandOf = null, k = 1) {
  const out = { pts: [], lines: [] }; if (!iso || !iso.off || iso.off.length < 2) return out;
  const N = gw * gh, nL = iso.off.length - 1, mask = new Uint8Array(N), pid = new Int32Array(N).fill(-1), ang = new Uint8Array(N);
  for (let l = 0; l < nL; l++) for (let j = iso.off[l]; j < iso.off[l + 1]; j++) { const o = iso.c[j]; mask[o] = 1; pid[o] = l; ang[o] = iso.a[j]; }
  const { D, I } = edt(mask, gw, gh, true), R = 25 * k, side = Array.from({ length: nL }, () => []);
  // mỗi số đo thuộc đường gần nó nhất (≤ R ô ≈ 1 cm trên giấy); bên trái / phải theo hướng tiếp tuyến chỗ gần nhất
  for (const s of S) {
    const sx = s.x / cell, sy = s.y / cell, o = Math.min(gh - 1, Math.max(0, Math.floor(sy))) * gw + Math.min(gw - 1, Math.max(0, Math.floor(sx)));
    if (D[o] > R) continue; const p = I[o], l = pid[p]; if (l < 0) continue;
    const dx = sx - ((p % gw) + 0.5), dy = sy - (((p / gw) | 0) + 0.5), dd = Math.hypot(dx, dy); if (dd < 0.6) continue;
    const a = ang[p] / 256 * 2 * Math.PI, cr = Math.cos(a) * dy - Math.sin(a) * dx;
    if (Math.abs(cr) < 0.5 * dd) continue; // gần đầu mút, không rõ bên nào
    side[l].push(cr > 0 ? s.v : -s.v);
  }
  for (let l = 0; l < nL; l++) {
    const q = side[l], a = q.filter((v) => v > 0), b = q.filter((v) => v < 0).map((v) => -v), n = q.length;
    const info = { v: 0, n, err: 0, ok: false }; out.lines.push(info);
    if (n < 4 || !a.length || !b.length) continue;
    const sc = [];
    for (const c of CAND) {
      // bên a nông (≤ c) bên b sâu (≥ c), hoặc ngược lại; cho lệch 0,3 m; mỗi bên phải có số đúng
      const eAB = a.filter((v) => v > c + 0.3).length + b.filter((v) => v < c - 0.3).length, eBA = b.filter((v) => v > c + 0.3).length + a.filter((v) => v < c - 0.3).length;
      const sh = eAB <= eBA ? a : b, dp = eAB <= eBA ? b : a, e = Math.min(eAB, eBA);
      if (!sh.some((v) => v <= c + 0.3) || !dp.some((v) => v >= c - 0.3)) continue;
      sc.push({ c, e, s: e + (ODD.has(c) ? 0.5 : 0) });
    }
    if (!sc.length) continue; sc.sort((p, q) => p.s - q.s);
    const best = sc[0].c, be = sc[0].e;
    if (be > 0.15 * n || (sc.length > 1 && sc[1].s === sc[0].s)) continue; // nhiều mức khớp như nhau (số đo hai bên cách xa) → không chắc
    // khớp dải màu nước chỗ đường đi qua (đường 10 m không thể nằm trong vùng tô màu 0–2 m)
    if (bandOf) { let tot = 0, good = 0; for (let j = iso.off[l]; j < iso.off[l + 1]; j++) { const B = bandOf(iso.c[j]); if (!B) continue; tot++; if (best >= B.L - 0.5 && best <= B.U + 0.5) good++; } if (tot && good < 0.7 * tot) continue; }
    info.v = best; info.err = be; info.ok = true;
    for (let j = iso.off[l]; j < iso.off[l + 1]; j++) { const o = iso.c[j]; out.pts.push({ x: ((o % gw) + 0.5) * cell, y: (((o / gw) | 0) + 0.5) * cell, v: best, iso: true }); }
  }
  return out;
}
