// Tàu khác chạy trên luồng (giai đoạn 5): xà lan tự hành, tàu cá, tàu hàng nhỏ — và tránh va theo COLREG.
// Thuần JS (không DOM, không three.js): cảnh 3D ở traffic3d.js, hải đồ nhỏ / radar / âm thanh ở ui_run.js.
// - Sinh tàu quanh tàu mình (lúc đầu 0,8–4 Hl; về sau 2,5–4 Hl cho khỏi hiện ra trước mắt), đích ở phía bên kia để đi ngang vùng tàu mình
// - Đường đi: A* trên lưới 30 m, chỉ đi chỗ đủ sâu cho mớn + dự phòng, ưu tiên nước sâu (luồng) và xa mép cạn, tránh tàu đậu / cầu bến;
//   rút gọn theo tầm nhìn thẳng, dịch sang mạn phải luồng (COLREG điều 9)
// - Chuyển động: tốc độ / hướng đổi dần theo quán tính từng loại, trôi theo dòng chảy
// - Tránh va: mỗi 1,5 s xét CPA / TCPA với mọi tàu trong 3 km (cả tàu mình). Vai trò: đối hướng → cả hai sang phải; cắt hướng → tàu
//   thấy tàu kia bên phải nhường; tàu vượt nhường; tàu đang đánh cá được nhường; tàu nhỏ không cản tàu lớn trong luồng (điều 9).
//   Tàu nhường đường chọn hành động tốt nhất trong các nấc đổi hướng / giảm tốc (ưu tiên sang phải rõ ràng, phạt sang trái, không mắc cạn);
//   tàu được nhường giữ hướng, chỉ hành động khi đã quá gần (điều 17). Hết nguy cơ thì trở lại đường đi.
// - Tín hiệu còi khi đổi hướng (1 tiếng ngắn sang phải, 2 sang trái, 3 lùi máy) và còi sương mù mỗi 2 phút khi tầm nhìn kém.
const D2R = Math.PI / 180, NM = 1852, KN = NM / 3600;
const wrap = (a) => { a = (a + Math.PI) % (2 * Math.PI); return a < 0 ? a + Math.PI : a - Math.PI; };

// loại tàu: mẫu trong kho tàu (fleet_tpl.js), tốc độ đi (hl/h), quán tính tốc độ tv (s), thời gian ăn lái tr (s), đường kính quay trở / L,
// tỷ lệ trong đám tàu, dự phòng dưới ky (m), đường đi ưu tiên nước sâu (pref: độ sâu mong muốn / mớn)
export const TR_KINDS = {
  xalan: { name: 'Xà lan', tpl: ['xalan45', 'xalan60'], kn: [5, 7.5], tv: 55, tr: 9, dia: 3.5, share: 0.45, ukc: 1.2, pref: 2.2 },
  ca: { name: 'Tàu cá', tpl: ['ca18', 'ca26'], kn: [6, 9], tv: 16, tr: 3.5, dia: 2.5, share: 0.4, ukc: 0.8, pref: 1.5 },
  hang: { name: 'Tàu hàng', tpl: ['hang50'], kn: [8, 10.5], tv: 70, tr: 10, dia: 3.2, share: 0.15, ukc: 1.5, pref: 2.4 }
};
export const DENSITY = [0, 3, 6, 10];             // tắt, ít, vừa, nhiều — số tàu giữ quanh tàu mình
export const DENSITY_NAMES = ['Tắt', 'Ít', 'Vừa', 'Nhiều'];

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// nav: { depth(x, y) → độ sâu (m, đã cộng triều; NaN = chưa biết), blocked(x, y) → true nếu là tàu đậu / cầu bến, ready() → lưới độ sâu đã nạp }
// specs: { tplId: { name, L, B, T } }; opts: { seed, density (0–3), kinds: { xalan, ca, hang } }
export class Traffic {
  constructor(nav, specs, opts = {}) {
    this.nav = nav; this.specs = specs; this.rand = rng(opts.seed || 1); this.n = DENSITY[opts.density | 0] || 0;
    const k = opts.kinds || { xalan: true, ca: true, hang: true }; this.kinds = Object.keys(TR_KINDS).filter((q) => k[q] !== false && specs[TR_KINDS[q].tpl[0]]);
    this.list = []; this.t = 0; this.nextId = 1; this.spawnT = 0; this.filled = false; this.events = []; this.cache = new Map(); this.G = 30;
    this.info = {}; // id → { kind, tpl, name, L, B } (cho bản ghi / xem lại)
  }
  // ---------- độ sâu theo lưới 30 m (nhớ lại, đỡ tra nhiều lần) ----------
  cellDepth(i, j) {
    const key = i * 100003 + j; let d = this.cache.get(key);
    if (d === undefined) { const x = (i + 0.5) * this.G, y = (j + 0.5) * this.G; d = this.nav.blocked(x, y) ? -9 : this.nav.depth(x, y); if (!Number.isFinite(d)) d = -9; this.cache.set(key, d); if (this.cache.size > 400000) this.cache.clear(); }
    return d;
  }
  okAt(x, y, need) { if (this.nav.blocked(x, y)) return false; const d = this.nav.depth(x, y); return Number.isFinite(d) && d >= need; }
  // ---------- đường đi A* (nước đủ sâu, ưu tiên sâu và xa mép cạn) ----------
  plan(P, Q, need, pref, maxExp = 90000) {
    const G = this.G, i0 = Math.floor(P[0] / G), j0 = Math.floor(P[1] / G), i1 = Math.floor(Q[0] / G), j1 = Math.floor(Q[1] / G);
    const pad = 40, ia = Math.min(i0, i1) - pad, ja = Math.min(j0, j1) - pad, w = Math.abs(i1 - i0) + 2 * pad + 1, h = Math.abs(j1 - j0) + 2 * pad + 1, N = w * h;
    if (N > 2.5e6) return null;
    const ok = (i, j) => this.cellDepth(i, j) >= need;
    if (!ok(i0, j0) || !ok(i1, j1)) return null;
    const cost = (i, j) => { const d = this.cellDepth(i, j); let c = 1 + 2.5 * Math.max(0, (pref - d) / pref);
      for (const [a, b] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) if (!ok(i + a, j + b)) { c += 2.5; break; } return c; };
    const g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap = [], push = (f, o) => { heap.push([f, o]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const hx = (i, j) => { const dx = Math.abs(i - i1), dy = Math.abs(j - j1); return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy); };
    const s = (j0 - ja) * w + (i0 - ia), e = (j1 - ja) * w + (i1 - ia); g[s] = 0; push(hx(i0, j0), s); let exp = 0;
    while (heap.length) {
      const [, o] = pop(); if (closed[o]) continue; closed[o] = 1; if (o === e) break; if (++exp > maxExp) return null;
      const ci = o % w, cj = (o / w) | 0, I = ci + ia, J = cj + ja;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue; const q = nj * w + ni; if (closed[q] || !ok(I + di, J + dj)) continue;
        if (di && dj && (!ok(I + di, J) || !ok(I, J + dj))) continue;
        const ng = g[o] + (di && dj ? Math.SQRT2 : 1) * cost(I + di, J + dj); if (ng < g[q]) { g[q] = ng; from[q] = o; push(ng + hx(I + di, J + dj), q); }
      }
    }
    if (from[e] < 0 && e !== s) return null;
    const cells = []; for (let o = e; o >= 0; o = from[o]) { cells.push([((o % w) + ia + 0.5) * G, (((o / w) | 0) + ja + 0.5) * G]); if (o === s) break; }
    cells.reverse(); cells[0] = [P[0], P[1]]; cells[cells.length - 1] = [Q[0], Q[1]];
    return this.smooth(cells, need);
  }
  // đoạn thẳng a → b đi được (nước đủ sâu, cách mép cạn ≥ 1 ô theo hai bên)
  clear(a, b, need) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / (this.G * 0.5)), ux = (b[0] - a[0]) / (L || 1), uy = (b[1] - a[1]) / (L || 1);
    for (let k = 0; k <= n; k++) { const x = a[0] + (b[0] - a[0]) * k / n, y = a[1] + (b[1] - a[1]) * k / n;
      for (const o of [0, this.G, -this.G]) { const i = Math.floor((x + uy * o) / this.G), j = Math.floor((y - ux * o) / this.G); if (this.cellDepth(i, j) < need) return false; } }
    return true;
  }
  smooth(pts, need) {
    const out = [pts[0]]; let i = 0;
    while (i < pts.length - 1) { let j = Math.min(pts.length - 1, i + 60); while (j > i + 1 && !this.clear(pts[i], pts[j], need)) j--; out.push(pts[j]); i = j; }
    // dịch sang mạn phải luồng (đi bên phải luồng hẹp): mỗi điểm giữa dời sang phải hướng đi tối đa off m nếu chỗ đó còn sâu
    for (let k = 1; k < out.length - 1; k++) {
      const a = out[k - 1], b = out[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, rx = dy / l, ry = -dx / l;
      for (const off of [45, 30, 15]) { const x = out[k][0] + rx * off, y = out[k][1] + ry * off; if (this.okAt(x, y, need) && this.okAt(x + rx * 25, y + ry * 25, need)) { out[k] = [x, y]; break; } }
    }
    return out;
  }
  // ---------- sinh tàu ----------
  pickKind() { const ks = this.kinds; let tot = 0; for (const k of ks) tot += TR_KINDS[k].share; let r = this.rand() * tot; for (const k of ks) { r -= TR_KINDS[k].share; if (r <= 0) return k; } return ks[ks.length - 1]; }
  near(P, need, R = 600) { if (this.okAt(P[0], P[1], need + 0.5)) return P; for (let r = 60; r <= R; r += 60) for (let a = 0; a < 12; a++) { const q = [P[0] + r * Math.sin(a * Math.PI / 6), P[1] + r * Math.cos(a * Math.PI / 6)]; if (this.okAt(q[0], q[1], need + 0.5)) return q; } return null; }
  spawn(own, first) {
    const kind = this.pickKind(), K = TR_KINDS[kind], tpl = K.tpl[Math.floor(this.rand() * K.tpl.length)], sp = this.specs[tpl]; if (!sp) return false;
    const need = sp.T + K.ukc, pref = sp.T * K.pref, R1 = first ? 1500 : 4600, R2 = 7400;
    for (let tr = 0; tr < 6; tr++) {
      const a = this.rand() * 2 * Math.PI, d = R1 + this.rand() * (R2 - R1), P0 = [own.x + d * Math.sin(a), own.y + d * Math.cos(a)], P = this.near(P0, need); if (!P) continue;
      if (this.list.some((v) => Math.hypot(v.x - P[0], v.y - P[1]) < 400)) continue;
      let Q;
      if (kind === 'ca' && this.rand() < 0.5) { const b = this.rand() * 2 * Math.PI, e = 1500 + this.rand() * 2500; Q = this.near([P[0] + e * Math.sin(b), P[1] + e * Math.cos(b)], need); } // tàu cá đi tới ngư trường gần
      else { const b = a + Math.PI + (this.rand() - 0.5) * 1.2, e = d * (0.8 + this.rand() * 0.5); Q = this.near([own.x + e * Math.sin(b), own.y + e * Math.cos(b)], need); }
      if (!Q || Math.hypot(Q[0] - P[0], Q[1] - P[1]) < 800) continue;
      const path = this.plan(P, Q, need, pref); if (!path || path.length < 2) continue;
      const v = { id: this.nextId++, kind, tpl, name: sp.name, L: sp.L, B: sp.B, T: sp.T, need, pref, path, wi: 0, x: P[0], y: P[1], psi: 0, u: 0, r: 0,
        kn: K.kn[0] + this.rand() * (K.kn[1] - K.kn[0]), fishing: false, fishUntil: 0, av: null, think: this.rand() * 1.5, hornT: -999, fogT: this.rand() * 120, aground: false, hit: 0 };
      // lúc đầu: đặt tàu ở giữa đường (đang đi), về sau: ở đầu đường
      if (first) { const f = 0.15 + this.rand() * 0.45; let tot = 0; const seg = []; for (let k = 0; k + 1 < path.length; k++) { const l = Math.hypot(path[k + 1][0] - path[k][0], path[k + 1][1] - path[k][1]); seg.push(l); tot += l; }
        let s = f * tot; for (let k = 0; k < seg.length; k++) { if (s <= seg[k]) { v.wi = k; v.x = path[k][0] + (path[k + 1][0] - path[k][0]) * s / seg[k]; v.y = path[k][1] + (path[k + 1][1] - path[k][1]) * s / seg[k]; break; } s -= seg[k]; } }
      if (Math.hypot(v.x - own.x, v.y - own.y) < (first ? 900 : 4000)) continue;
      const b = path[Math.min(path.length - 1, v.wi + 1)]; v.psi = Math.atan2(b[0] - v.x, b[1] - v.y); v.u = v.kn * KN;
      if (kind === 'ca' && this.rand() < 0.35) { v.fishing = true; v.fishUntil = this.t + 600 + this.rand() * 1800; v.u = 2.5 * KN; } // đang đánh cá: chạy chậm
      this.list.push(v); this.info[v.id] = { kind, tpl, name: sp.name, L: sp.L, B: sp.B };
      return true;
    }
    return false;
  }
  // ---------- mỗi bước mô phỏng ----------
  // own: { x, y, psi, gE, gN (m/s), L, B, still (đang neo / buộc) }; env: { cE, cN, vis (m) }
  step(dt, own, env) {
    this.t += dt; if (!this.list.length && (!this.n || !this.kinds.length)) return;
    // giữ đủ số tàu (chỉ khi lưới độ sâu quanh tàu đã nạp)
    if (this.n && this.kinds.length && this.t >= this.spawnT && this.nav.ready()) {
      this.list = this.list.filter((v) => !v.done && Math.hypot(v.x - own.x, v.y - own.y) < 11000);
      if (this.list.length < this.n) { const first = !this.filled; this.spawn(own, first); if (first && this.list.length >= this.n) this.filled = true; if (first && this.t > 60) this.filled = true; }
      this.spawnT = this.t + (this.filled ? 6 + this.rand() * 10 : 0.3);
    }
    const cE = env.cE || 0, cN = env.cN || 0;
    for (const v of this.list) {
      v.think -= dt; if (v.think <= 0) { v.think = 1.5; this.decide(v, own, env); }
      // hướng muốn đi: tránh va (nếu có) hoặc bám đường
      const tg = this.pursuit(v); let psiD = v.av ? v.av.psi : tg ? tg.psi : v.psi, uc = v.av ? v.kn * KN * v.av.sf : v.kn * KN;
      if (v.fishing && !v.av) { uc = 2.5 * KN; if (this.t > v.fishUntil) v.fishing = false; }
      if (tg && tg.end < 3 * v.L && !v.av) uc = Math.min(uc, Math.max(0.5, tg.end / (3 * v.L)) * v.kn * KN);
      if (tg && tg.done) v.done = true;
      if (v.hit > 0) { v.hit -= dt; uc = 0; }
      if (v.aground) uc = 0;
      // quay trở: tốc độ quay tối đa theo tốc độ và đường kính quay trở, ăn lái có trễ
      const K = TR_KINDS[v.kind], rmax = Math.max(0.25, Math.abs(v.u)) / (K.dia * v.L / 2), rt = Math.max(-rmax, Math.min(rmax, wrap(psiD - v.psi) / 6));
      v.r += (rt - v.r) * Math.min(1, dt / K.tr); v.psi = wrap(v.psi + v.r * dt);
      v.u += (uc - v.u) * Math.min(1, dt / (uc < v.u ? K.tv * 0.7 : K.tv));
      v.x += (v.u * Math.sin(v.psi) + cE) * dt; v.y += (v.u * Math.cos(v.psi) + cN) * dt;
      // chạm cạn (dòng đẩy dạt): dừng, dựng lại đường từ chỗ đang đứng
      if (!this.okAt(v.x + Math.sin(v.psi) * v.L * 0.45, v.y + Math.cos(v.psi) * v.L * 0.45, v.T + 0.2)) { if (!v.aground) { v.aground = true; v.replanT = this.t + 20; } }
      else v.aground = false;
      if (v.aground && this.t > (v.replanT || 0)) { v.replanT = this.t + 30; this.replan(v); }
    }
  }
  replan(v) {
    const end = v.path[v.path.length - 1]; let P = [v.x, v.y];
    if (!this.okAt(P[0], P[1], v.need)) { const q = this.near(P, v.T, 300); if (!q) return; P = q; }
    const p = this.plan(P, end, Math.min(v.need, v.T + 0.5), v.pref); if (p) { v.path = p; v.wi = 0; v.psi = Math.atan2(p[1][0] - v.x, p[1][1] - v.y); v.aground = false; }
  }
  // bám đường: điểm nhìn trước Ld trên đường (cách 2,5 L, ≥ 120 m) → hướng; end: quãng còn lại
  pursuit(v) {
    const p = v.path, Ld = Math.max(120, 2.5 * v.L); if (!p || p.length < 2) return null;
    // tiến đoạn đang bám khi đã qua điểm cuối đoạn
    for (;;) { if (v.wi >= p.length - 2) break; const a = p[v.wi], b = p[v.wi + 1], ex = b[0] - a[0], ey = b[1] - a[1], l2 = ex * ex + ey * ey || 1, t = ((v.x - a[0]) * ex + (v.y - a[1]) * ey) / l2; if (t < 1 && Math.hypot(b[0] - v.x, b[1] - v.y) > Ld * 0.6) break; v.wi++; }
    const a = p[v.wi], b = p[v.wi + 1], ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey) || 1, t = Math.max(0, Math.min(1, ((v.x - a[0]) * ex + (v.y - a[1]) * ey) / (l * l)));
    let rem = Ld, k = v.wi, px = a[0] + ex * t, py = a[1] + ey * t, tx = px, ty = py, sl = l * (1 - t);
    for (;;) { const q = p[k + 1]; if (rem <= sl) { tx = px + (q[0] - px) * rem / (sl || 1); ty = py + (q[1] - py) * rem / (sl || 1); break; } rem -= sl; px = q[0]; py = q[1]; k++; if (k >= p.length - 1) { tx = q[0]; ty = q[1]; break; } sl = Math.hypot(p[k + 1][0] - px, p[k + 1][1] - py); }
    let end = Math.hypot(b[0] - v.x, b[1] - v.y); for (let j = v.wi + 1; j < p.length - 1; j++) end += Math.hypot(p[j + 1][0] - p[j][0], p[j + 1][1] - p[j][1]);
    return { psi: Math.atan2(tx - v.x, ty - v.y), end, done: end < 1.5 * v.L };
  }
  // ---------- tránh va ----------
  vel(v, cE, cN) { return [v.u * Math.sin(v.psi) + cE, v.u * Math.cos(v.psi) + cN]; }
  targets(v, own, env) {
    const out = [], cE = env.cE || 0, cN = env.cN || 0;
    const d0 = Math.hypot(own.x - v.x, own.y - v.y); if (d0 < 3000) out.push({ own: true, x: own.x, y: own.y, vx: own.gE, vy: own.gN, psi: own.psi, L: own.L, B: own.B, fishing: false, still: own.still });
    for (const o of this.list) { if (o === v || o.done) continue; if (Math.hypot(o.x - v.x, o.y - v.y) > 3000) continue; const [vx, vy] = this.vel(o, cE, cN); out.push({ v: o, x: o.x, y: o.y, vx, vy, psi: o.psi, L: o.L, B: o.B, fishing: o.fishing, still: Math.abs(o.u) < 0.3 }); }
    return out;
  }
  static cpa(x, y, vx, vy, t) { // tàu tại (0,0) vận tốc (vx, vy); mục tiêu tại (t.x, t.y) vận tốc (t.vx, t.vy) — tọa độ tương đối đã trừ
    const dx = t.x - x, dy = t.y - y, wx = t.vx - vx, wy = t.vy - vy, w2 = wx * wx + wy * wy, tc = w2 < 1e-6 ? 0 : -(dx * wx + dy * wy) / w2;
    if (tc <= 0) return { d: Math.hypot(dx, dy), t: tc };
    return { d: Math.hypot(dx + wx * tc, dy + wy * tc), t: tc };
  }
  decide(v, own, env) {
    const cE = env.cE || 0, cN = env.cN || 0, [vx, vy] = this.vel(v, cE, cN), T = this.targets(v, own, env), risks = [];
    // còi sương mù (điều 35): tầm nhìn kém, gần tàu mình, mỗi ~2 phút
    if ((env.vis || 1e5) < 2000 && Math.hypot(own.x - v.x, own.y - v.y) < 3700 && this.t - v.fogT > 120) { v.fogT = this.t + this.rand() * 10; this.events.push({ x: v.x, y: v.y, pat: v.fishing ? 'LSS' : Math.abs(v.u) < 0.3 ? 'LL' : 'L' }); }
    // bề rộng nước đi được ngang qua tàu (luồng hẹp thì khoảng cách qua nhau an toàn nhỏ lại, không thì hai tàu cùng dừng chờ nhau)
    let room = 0; for (const sd of [1, -1]) { let d = 15; for (; d <= 400; d += 15) if (!this.okAt(v.x + Math.cos(v.psi) * d * sd, v.y - Math.sin(v.psi) * d * sd, v.T + 0.3)) break; room += d; }
    for (const t of T) {
      const c = Traffic.cpa(v.x, v.y, vx, vy, t), dsafe = Math.min(60 + 1.2 * (v.L + t.L), Math.max((v.B + t.B) / 2 + 15, 0.3 * room)), Th = 540;
      t.c = c; t.dsafe = dsafe; t.dcol = Math.min(0.35 * (v.L + t.L) + 10, 0.8 * dsafe);
      if (!(c.t > 0 && c.t < Th && c.d < dsafe)) continue;
      const brg = Math.atan2(t.x - v.x, t.y - v.y), beta = wrap(brg - v.psi) / D2R, alpha = wrap(brg + Math.PI - t.psi) / D2R, sp = Math.hypot(t.vx, t.vy);
      let role;
      if (t.still || sp < 0.3) role = 'give';
      else if (v.fishing && !t.fishing) role = 'stand';
      else if (t.fishing && !v.fishing) role = 'give';
      else if (Math.abs(beta) < 12 && Math.abs(alpha) < 12) role = 'head';
      else if (Math.abs(alpha) > 112.5 && Math.hypot(vx, vy) > sp) role = 'give'; // mình vượt tàu kia
      else if (Math.abs(beta) > 112.5) role = 'stand';                             // tàu kia vượt mình
      else role = beta > 0 ? 'give' : 'stand';
      if (role === 'stand' && v.L < 30 && t.L > 2 * v.L && !v.fishing) role = 'give'; // tàu nhỏ không cản tàu lớn (điều 9)
      t.role = role; t.beta = beta; risks.push(t);
    }
    const give = risks.filter((t) => t.role !== 'stand'), extremis = risks.some((t) => t.role === 'stand' && (t.c.d < 0.5 * t.dsafe && t.c.t < 120));
    if (!give.length && !extremis) {
      // hết nguy cơ (mọi mục tiêu đã qua CPA hoặc cách xa) và giữ hành động ≥ 20 s → trở lại đường đi
      if (v.av && this.t - v.av.t0 > 20 && T.every((t) => t.c.t <= 0 || t.c.d > 1.2 * t.dsafe)) v.av = null;
      return;
    }
    const best = this.search(v, T, cE, cN, risks);
    const prev = v.av; v.av = { psi: best.psi, sf: best.sf, t0: prev ? prev.t0 : this.t, dps: best.dps };
    // tín hiệu còi khi bắt đầu đổi hướng rõ / lùi máy (gần tàu mình mới nghe)
    const ch = !prev || Math.abs(best.dps - prev.dps) >= 15 || (best.sf === 0 && prev.sf > 0);
    if (ch && this.t - v.hornT > 25 && Math.hypot(own.x - v.x, own.y - v.y) < 3700) {
      const pat = best.sf === 0 ? 'SSS' : best.dps >= 15 ? 'S' : best.dps <= -15 ? 'SS' : ''; if (pat) { v.hornT = this.t; this.events.push({ x: v.x, y: v.y, pat }); }
    }
  }
  // chọn hành động: đổi hướng (độ, + sang phải) × hệ số tốc độ; chi phí = nguy cơ va + mắc cạn + lệch đường + trái COLREG
  search(v, T, cE, cN, risks) {
    const DPS = [0, 10, 20, 35, 50, 70, 90, -10, -20, -35], SF = [1, 0.6, 0.3, 0], base = v.av ? v.av.psi - v.av.dps * D2R : v.psi;
    const head = risks.some((t) => t.role === 'head'), giveX = risks.some((t) => t.role === 'give' && !t.still), portStand = risks.some((t) => t.role === 'stand' && t.beta < 0);
    let best = null;
    for (const dps of DPS) for (const sf of SF) {
      const h = base + dps * D2R, s = v.kn * KN * sf, vx = s * Math.sin(h) + cE, vy = s * Math.cos(h) + cN; let c = 0;
      for (const t of T) { const q = Traffic.cpa(v.x, v.y, vx, vy, t); if (q.t < -30) continue; const w = 1 + 120 / Math.max(30, q.t);
        if (q.d < t.dcol) c += 1000 * w; else if (q.d < t.dsafe) c += 80 * (1 - q.d / t.dsafe) * w; }
      // mắc cạn theo hướng mới (đi tới 4 phút hoặc ≥ 3 L)
      if (s > 0.05) { const far = Math.max(3 * v.L, s * 240), st = Math.max(20, v.L / 2); for (let d = v.L * 0.6; d <= far; d += st) { if (!this.okAt(v.x + Math.sin(h) * d, v.y + Math.cos(h) * d, v.T + 0.3)) { c += 300 + 1500 * (1 - d / far); break; } } }
      c += 0.15 * Math.abs(dps) + 25 * (1 - sf);
      if (dps < 0 && (head || giveX || portStand)) c += 60;
      if (head && dps <= 0 && sf > 0.3) c += 30;
      if (giveX && dps > 0 && dps < 20) c += 10; // đổi hướng phải rõ ràng
      if (v.av && Math.abs(v.av.dps - dps) < 1 && Math.abs(v.av.sf - sf) < 0.01) c -= 8; // giữ hành động đang làm, khỏi chập chờn
      if (!best || c < best.c) best = { c, dps, sf, psi: wrap(h) };
    }
    return best;
  }
  // ---------- tiện ích ----------
  // va chạm với tàu mình: tàu kia dừng một lúc
  bump(id) { const v = this.list.find((q) => q.id === id); if (v) { v.hit = 60; v.u *= 0.3; } }
  // đường bao thân tàu (tọa độ thế giới) cho khối va chạm
  outline(v) {
    const L = v.L, B = v.B, sn = Math.sin(v.psi), cs = Math.cos(v.psi), P = [[L / 2, 0], [L * 0.36, B / 2], [-L / 2, B / 2], [-L / 2, -B / 2], [L * 0.36, -B / 2]];
    return P.map(([bx, by]) => [v.x + bx * sn + by * cs, v.y + bx * cs - by * sn]);
  }
  // ảnh chụp cho bản ghi (1 lần / giây): [id, x, y, hướng (độ), đang đánh cá]
  snapshot() { return this.list.map((v) => [v.id, Math.round(v.x * 10) / 10, Math.round(v.y * 10) / 10, Math.round(v.psi / D2R * 10) / 10, v.fishing ? 1 : 0]); }
  // gốc tọa độ dời
  mapCoords(map) { for (const v of this.list) { [v.x, v.y] = map(v.x, v.y); v.path = v.path.map((p) => map(p[0], p[1])); } this.cache.clear(); }
  takeEvents() { const e = this.events; this.events = []; return e; }
}
