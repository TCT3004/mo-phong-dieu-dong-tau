// Nét vẽ mượt (thuần JS, theo mét): đường cong mềm đi qua các điểm vẽ (Catmull–Rom hướng tâm), giữ góc sắc ở điểm được đánh dấu,
// bo tròn góc theo bán kính. Dùng khi dựng 3D và khi vẽ nét lên bàn vẽ để hai bên khớp nhau.

const d2 = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

// một đoạn Catmull–Rom hướng tâm (alpha 0,5) giữa p1 và p2, n điểm (không gồm p1, gồm p2)
function crSpan(p0, p1, p2, p3, n, out) {
  const kn = (a, b) => Math.max(1e-6, Math.sqrt(d2(a, b)));
  const t0 = 0, t1 = t0 + kn(p0, p1), t2 = t1 + kn(p1, p2), t3 = t2 + kn(p2, p3);
  const L = (a, b, ta, tb, t) => { const k = (t - ta) / (tb - ta); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; };
  for (let i = 1; i <= n; i++) {
    const t = t1 + (t2 - t1) * i / n;
    const A1 = L(p0, p1, t0, t1, t), A2 = L(p1, p2, t1, t2, t), A3 = L(p2, p3, t2, t3, t);
    const B1 = L(A1, A2, t0, t2, t), B2 = L(A2, A3, t1, t3, t);
    out.push(L(B1, B2, t1, t2, t));
  }
}
// chuỗi hở đi qua P (hai đầu là góc): đầu mút lấy điểm phản xạ
function crChain(P, step, out, skipFirst) {
  const n = P.length; if (!skipFirst) out.push(P[0].slice());
  if (n === 2) { out.push(P[1].slice()); return; }
  const refl = (a, b) => [2 * a[0] - b[0], 2 * a[1] - b[1]];
  for (let i = 0; i + 1 < n; i++) {
    const p0 = i ? P[i - 1] : refl(P[0], P[1]), p3 = i + 2 < n ? P[i + 2] : refl(P[n - 1], P[n - 2]);
    crSpan(p0, P[i], P[i + 1], p3, Math.max(3, Math.min(16, Math.ceil(d2(P[i], P[i + 1]) / step))), out);
  }
}
// bo góc tại các điểm `at` (Set chỉ số) bán kính r; trả về danh sách { p, keep } (keep = giữ nguyên khi làm cong)
function filletPts(P, r, closed, at) {
  const n = P.length, out = [];
  for (let i = 0; i < n; i++) {
    const B = P[i], end = !closed && (i === 0 || i === n - 1);
    if (end || !at.has(i) || !(r > 0)) { out.push({ p: B.slice(), keep: at.has(i) || end }); continue; }
    const A = P[(i + n - 1) % n], C = P[(i + 1) % n], la = d2(B, A), lc = d2(B, C);
    if (la < 1e-6 || lc < 1e-6) { out.push({ p: B.slice(), keep: true }); continue; }
    const ua = [(A[0] - B[0]) / la, (A[1] - B[1]) / la], uc = [(C[0] - B[0]) / lc, (C[1] - B[1]) / lc];
    const phi = Math.acos(Math.max(-1, Math.min(1, ua[0] * uc[0] + ua[1] * uc[1])));
    if (phi > Math.PI * 0.985 || phi < 1e-3) { out.push({ p: B.slice(), keep: true }); continue; }
    let d = r / Math.tan(phi / 2); d = Math.min(d, 0.48 * la, 0.48 * lc); const rr = d * Math.tan(phi / 2);
    const bis = [ua[0] + uc[0], ua[1] + uc[1]], bl = Math.hypot(bis[0], bis[1]) || 1, oc = rr / Math.sin(phi / 2);
    const O = [B[0] + bis[0] / bl * oc, B[1] + bis[1] / bl * oc], T1 = [B[0] + ua[0] * d, B[1] + ua[1] * d], T2 = [B[0] + uc[0] * d, B[1] + uc[1] * d];
    let a1 = Math.atan2(T1[1] - O[1], T1[0] - O[0]), a2 = Math.atan2(T2[1] - O[1], T2[0] - O[0]), da = a2 - a1;
    while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    const k = Math.max(2, Math.min(12, Math.ceil(Math.abs(da) / (Math.PI / 18))));
    for (let j = 0; j <= k; j++) { const a = a1 + da * j / k; out.push({ p: [O[0] + rr * Math.cos(a), O[1] + rr * Math.sin(a)], keep: true }); }
  }
  return out;
}
// pts: [[h, v]…] (mét); o: { curve, sharp: [chỉ số điểm giữ góc sắc], fillet: bán kính bo góc (m, nét thẳng), closed, step }
export function shapePts(pts, o = {}) {
  const closed = o.closed !== false, n = pts.length;
  if (!pts || n < 2 || (closed && n < 3) || (!o.curve && !(o.fillet > 0))) return pts;
  const step = o.step || 0.25, sharp = new Set((o.sharp || []).filter((i) => i >= 0 && i < n));
  // «góc sắc»: không làm cong, không bo. Nét thẳng có bo góc → bo mọi góc trừ góc sắc; nét cong → đường cong qua các điểm, góc sắc giữ nguyên
  const at = o.curve ? sharp : new Set(pts.map((_, i) => i).filter((i) => !sharp.has(i)));
  const F = filletPts(pts, !o.curve && o.fillet > 0 ? o.fillet : 0, closed, at);
  if (!o.curve) return F.map((q) => q.p);
  const P = F.map((q) => q.p), K = F.map((q) => q.keep), m = P.length, out = [];
  const ks = []; for (let i = 0; i < m; i++) if (K[i]) ks.push(i);
  if (closed && !ks.length) { // vòng kín toàn cong
    for (let i = 0; i < m; i++) crSpan(P[(i + m - 1) % m], P[i], P[(i + 1) % m], P[(i + 2) % m], Math.max(3, Math.min(16, Math.ceil(d2(P[i], P[(i + 1) % m]) / step))), out);
    return out;
  }
  if (!closed) { // nét hở: chia chuỗi tại các điểm giữ góc
    const br = [...new Set([0, ...ks, m - 1])].sort((a, b) => a - b);
    for (let j = 0; j + 1 < br.length; j++) crChain(P.slice(br[j], br[j + 1] + 1), step, out, j > 0);
    return out;
  }
  // vòng kín có góc sắc: bắt đầu từ một góc, mỗi chuỗi giữa hai góc liên tiếp làm cong riêng
  const s0 = ks[0], R = P.slice(s0).concat(P.slice(0, s0)), RK = K.slice(s0).concat(K.slice(0, s0)), br = [];
  for (let i = 0; i < m; i++) if (RK[i]) br.push(i); br.push(m);
  const RR = R.concat([R[0]]);
  for (let j = 0; j + 1 < br.length; j++) crChain(RR.slice(br[j], br[j + 1] + 1), step, out, j > 0);
  out.pop(); // điểm cuối trùng điểm đầu
  return out;
}
// rút gọn đường gấp khúc (Douglas–Peucker), bỏ điểm thẳng hàng; closed: vòng kín
export function simplifyPts(pts, tol = 0.02, closed = true) {
  if (pts.length < 4) return pts.slice();
  const dl = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy; if (L2 < 1e-12) return d2(p, a); const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)); return Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1]); };
  const dp = (P, i0, i1, keep) => { let mi = -1, md = tol; for (let i = i0 + 1; i < i1; i++) { const d = dl(P[i], P[i0], P[i1]); if (d > md) { md = d; mi = i; } } if (mi >= 0) { keep[mi] = true; dp(P, i0, mi, keep); dp(P, mi, i1, keep); } };
  if (!closed) { const keep = pts.map(() => false); keep[0] = keep[pts.length - 1] = true; dp(pts, 0, pts.length - 1, keep); return pts.filter((_, i) => keep[i]); }
  // vòng kín: tách ở điểm xa điểm đầu nhất thành hai chuỗi hở
  let b = 0, bd = -1; for (let i = 0; i < pts.length; i++) { const d = d2(pts[0], pts[i]); if (d > bd) { bd = d; b = i; } }
  const R = pts.concat([pts[0]]), keep = R.map(() => false); keep[0] = keep[b] = true;
  dp(R, 0, b, keep); dp(R, b, R.length - 1, keep);
  return pts.filter((_, i) => keep[i]);
}
