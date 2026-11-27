// Thế giới mô phỏng: độ sâu (ghép nhiều tờ hải đồ), cầu bến, neo, dây buộc, môi trường.
// Tọa độ: "mét thế giới" của CS.frame (x Đông, y Bắc); lưu trữ lat/lon WGS-84 nằm ở places.js.
import { D2R, G } from './physics.js';
import { CS, sampleWorld, DEF_CLASS_DEPTH } from './chartsys.js';
import { relayout, shipSegs, shipBollards } from './moored.js';

const num = (v, d) => { const n = parseFloat(v); return isFinite(n) ? n : d; };
export const wrap180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;

export function defaultEnv() {
  const tide = []; for (let h = 0; h < 24; h++) tide.push(+(1.95 + 1.45 * Math.cos(2 * Math.PI * (h - 15.5) / 24.8)).toFixed(1));
  return {
    name: 'Bài tập 1', startX: 0, startY: 0, startHdg: 0, startKn: 6, startStep: 'f2', startTime: '06:30',
    tide, windDir: 45, windKn: 12, gustKn: 18, windVary: true,
    floodDir: 60, floodKn: 0.8, ebbDir: 240, ebbKn: 0.7,
    waveH: 0.5, waveL: 225, waveDir: 90, visNm: 6, wxMode: 'manual', wxStart: '', light: 'auto', fogOn: false
  };
}

export class World {
  constructor() {
    this.objs = { lights: [], berths: [], routes: [], routeSel: -1, ships: [] };
    this.start = null; // { x, y, hdg } mét thế giới
    this.noChartDepth = 30;
    this.segs = []; this.bollards = [];
  }
  // có hải đồ nào trong kho chưa
  hasCharts() { return CS.catalog.records.some((r) => r.ready); }
  // tờ hải đồ chi tiết nhất phủ điểm (x, y), null nếu ngoài mọi tờ
  chartAt(x, y) { return sampleWorld(x, y).rec; }
  chartName(x, y) { const r = this.chartAt(x, y); return r ? r.name : this.hasCharts() ? 'Ngoài vùng hải đồ' : 'Biển trống'; }
  // lớp đáy: 0 đất, 1 bãi cạn hở, 2 nông, 3 nông vừa, 4 sâu
  classAt(x, y) { return sampleWorld(x, y).cls; }
  // độ sâu hải đồ (m, dương là dưới số 0 hải đồ; âm là đất/bãi cạn)
  depthAt(x, y) {
    for (const s of this.segs) {
      if (s.ship) continue;
      const t = (x - s.ax) * s.tx + (y - s.ay) * s.ty, sd = (x - s.ax) * s.nx + (y - s.ay) * s.ny;
      if (t > -15 && t < s.len + 15 && sd > -6 && sd < 60) return s.depth;
    }
    const q = sampleWorld(x, y); if (!q.rec) return this.noChartDepth;
    if (q.z !== null) return -q.z; // tờ đã đọc số độ sâu / độ cao: lưới z
    return (q.rec.classDepth || DEF_CLASS_DEPTH)[q.cls];
  }
  // đổi mọi tọa độ trong bộ nhớ khi gốc tọa độ dời (gốc trôi)
  mapCoords(map) {
    const o = this.objs, mp = (q) => map(q[0], q[1]);
    for (const l of o.lights) [l.x, l.y] = map(l.x, l.y);
    for (const b of o.berths) b.pts = b.pts.map(mp);
    for (const r of o.routes || []) r.pts = r.pts.map(mp);
    for (const q of o.starts || []) [q.x, q.y] = map(q.x, q.y);
    for (const sh of o.ships || []) { [sh.x, sh.y] = map(sh.x, sh.y); for (const a of sh.anchors || []) if (a.x !== null && a.x !== undefined) [a.x, a.y] = map(a.x, a.y); }
    if (this.start) [this.start.x, this.start.y] = map(this.start.x, this.start.y);
    this.rebuild();
  }
  rebuild() {
    this.segs = []; this.bollards = [];
    this.objs.berths.forEach((b, bi) => {
      const sp = Math.max(8, num(b.spacing, 25)), bs = [];
      let cum = 0;
      for (let i = 0; i + 1 < b.pts.length; i++) {
        const [ax, ay] = b.pts[i], [bx, by] = b.pts[i + 1], len = Math.hypot(bx - ax, by - ay);
        if (len < 2) { cum += len; continue; }
        const tx = (bx - ax) / len, ty = (by - ay) / len; let nx = -ty, ny = tx;
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        let wa = 0, wb = 0;
        for (const o of [20, 40, 70]) { if (this.classAt(mx + nx * o, my + ny * o) >= 2) wa++; if (this.classAt(mx - nx * o, my - ny * o) >= 2) wb++; }
        if (wb > wa) { nx = -nx; ny = -ny; }
        const sg = { ax, ay, bx, by, tx, ty, nx, ny, len, depth: num(b.depth, 8), top: num(b.top, 4.5), bi, s0: cum };
        this.segs.push(sg); bs.push(sg); cum += len;
      }
      b._len = cum;
      const list = Array.isArray(b.bols) ? b.bols.slice().sort((p, q) => p - q) : autoBollards(bs, sp);
      for (const sAl of list) {
        let g = bs[bs.length - 1]; for (const q of bs) if (sAl <= q.s0 + q.len) { g = q; break; } if (!g) continue;
        const t = Math.max(0, Math.min(g.len, sAl - g.s0));
        this.bollards.push({ x: g.ax + g.tx * t - g.nx * 1.5, y: g.ay + g.ty * t - g.ny * 1.5, top: num(b.top, 4.5), n: this.bollards.length + 1, bi, s: sAl });
      }
    });
    // tàu đậu: đặt lại theo bến / tàu kia, rồi thêm khối va chạm và cọc bích trên boong
    if (!this.objs.ships) this.objs.ships = [];
    relayout(this);
    for (const sh of this.objs.ships) { this.segs.push(...shipSegs(sh)); this.bollards.push(...shipBollards(sh, this.bollards.length + 1)); }
  }
  // vị trí dọc theo mép cầu (m tính từ đầu bến) gần điểm (x, y) nhất
  alongBerth(bi, x, y) {
    let best = null, bd = 1e12;
    for (const g of this.segs) { if (g.bi !== bi) continue; const t = Math.max(0, Math.min(g.len, (x - g.ax) * g.tx + (y - g.ay) * g.ty)), px = g.ax + g.tx * t, py = g.ay + g.ty * t, d = Math.hypot(x - px, y - py); if (d < bd) { bd = d; best = g.s0 + t; } }
    return best === null ? null : { s: best, d: bd };
  }
  autoBols(bi) { const b = this.objs.berths[bi]; return autoBollards(this.segs.filter((g) => g.bi === bi), Math.max(8, num(b.spacing, 25))); }
  bankDist(S, side, draft, tide) {
    const ex = Math.cos(S.psi) * side, ey = -Math.sin(S.psi) * side;
    for (let d = 8; d <= 248; d += 8) if (this.depthAt(S.x + ex * d, S.y + ey * d) + tide < draft * 0.8) return d;
    return 1e4;
  }
}

function autoBollards(bs, sp) {
  const out = [];
  for (const g of bs) { const n = Math.max(2, Math.round(g.len / sp) + 1); for (let k = 0; k < n; k++) out.push(g.s0 + g.len * (0.04 + 0.92 * k / (n - 1))); }
  return out;
}
export function tideAt(env, daySec) {
  const h = ((daySec / 3600) % 24 + 24) % 24, i = Math.floor(h), f = h - i, a = num(env.tide[i], 0), b = num(env.tide[(i + 1) % 24], 0);
  const s = (1 - Math.cos(f * Math.PI)) / 2; return a + (b - a) * s;
}
// bước sóng tự chỉnh (m); bài tập cũ chỉ có chu kỳ sóng thì đổi ra như dáng sóng cũ (×4)
export const envWaveL = (env) => (num(env.waveL, 0) > 0 ? num(env.waveL, 0) : 4 * 9.81 * num(env.waveT, 6) ** 2 / (2 * Math.PI));
// wx: thời tiết ngẫu nhiên (weather.js) — khi có thì gió, sóng, tầm nhìn, mưa lấy từ đó
export function envAt(env, daySec, t, wx) {
  const tide = tideAt(env, daySec);
  let mr = 1e-6; for (let i = 0; i < 24; i++) mr = Math.max(mr, Math.abs(num(env.tide[(i + 1) % 24], 0) - num(env.tide[i], 0)));
  const rate = (tideAt(env, daySec + 600) - tideAt(env, daySec - 600)) * 3 / mr; // -1..1
  const s = Math.max(-1, Math.min(1, rate));
  const cs = (s >= 0 ? num(env.floodKn, 0) * s : num(env.ebbKn, 0) * -s) * 0.5144, cd = (s >= 0 ? num(env.floodDir, 0) : num(env.ebbDir, 0)) * D2R;
  let wk = num(env.windKn, 0), wd = num(env.windDir, 0);
  if (env.windVary) {
    const g = Math.max(0, num(env.gustKn, wk) - wk);
    wk += g * Math.max(0, 0.5 * Math.sin(t / 23) + 0.5 * Math.sin(t / 7.3 + 1));
    wd += 8 * Math.sin(t / 61) + 4 * Math.sin(t / 17);
  }
  const lam = envWaveL(env), out = { tide, rising: s >= 0, cE: cs * Math.sin(cd), cN: cs * Math.cos(cd), cKn: cs / 0.5144, cDir: cd / D2R,
    waveH: num(env.waveH, 0), waveD: num(env.waveDir, 0) * D2R, waveL: lam, waveT: Math.sqrt(2 * Math.PI * lam / G), vis: num(env.visNm, 6) * 1852, rain: 0, cloud: 0.2, flash: 0, storm: 0, wx: null };
  if (wx && wx.now) { const w = wx.now; wk = w.wKn; wd = w.wDir; Object.assign(out, { waveH: w.waveH, waveD: w.waveDir * D2R, waveL: w.waveL, waveT: w.waveT, vis: w.vis, rain: w.rain, cloud: w.cloud, flash: w.flash, storm: w.storm, wx: w }); }
  return Object.assign(out, { wS: wk * 0.5144, wKn: wk, wD: wd * D2R, wDir: (wd % 360 + 360) % 360 });
}

// ---------- neo ----------
// tốc độ xích (m/s): tời theo cấp của từng neo (cấp 1, cấp 2) cho thả, thả kéo lê và kéo; thả tự do 3 m/s, neo chạm đáy thì chậm dần còn 1 m/s (không tự dừng)
export const ANCHOR_SPD = { 1: 1, 2: 2 }, FREE_SPD = 3, FREE_BOTTOM_SPD = 1;
export function makeAnchors(M) {
  const p = M.p, a = [], L = M.loa, B = M.B;
  const nb = Math.round(num(p.bowAnchors, 2)), ns = Math.round(num(p.sternAnchors, 0));
  if (nb >= 2) { a.push({ id: 'BP', name: 'Neo mũi trái', bx: L * 0.46, by: -B * 0.3 }); a.push({ id: 'BS', name: 'Neo mũi phải', bx: L * 0.46, by: B * 0.3 }); }
  else a.push({ id: 'BC', name: 'Neo mũi', bx: L * 0.49, by: 0 });
  if (ns === 1) a.push({ id: 'SC', name: 'Neo lái', bx: -L * 0.49, by: 0 });
  if (ns >= 2) { a.push({ id: 'SP', name: 'Neo lái trái', bx: -L * 0.47, by: -B * 0.3 }); a.push({ id: 'SS', name: 'Neo lái phải', bx: -L * 0.47, by: B * 0.3 }); }
  for (const q of a) Object.assign(q, { st: 'stow', chain: 0, target: 0, ax: null, ay: null, drag: false, ten: 0, lv: 1, free: false, vf: FREE_SPD });
  return a;
}
export function makeLines(M) {
  const L = M.loa, Lp = M.L;
  const d = [['hl', 'Dây dọc mũi', 'b', L / 2 - 2, 0.2, 0.4], ['fb', 'Dây ngang mũi', 'b', Lp * 0.42, 0.85, 0], ['fs', 'Dây chéo mũi', 'b', Lp * 0.36, 1, -0.3],
    ['as', 'Dây chéo lái', 's', -Lp * 0.36, 1, 0.3], ['ab', 'Dây ngang lái', 's', -Lp * 0.42, 0.85, 0], ['sl', 'Dây dọc lái', 's', -L / 2 + 2, 0.2, -0.4]];
  return d.map((q) => ({ id: q[0], name: q[1], end: q[2], fx: q[3], fyk: q[4], want: q[5] * Lp, st: 'chua', len: 0, bx: 0, by: 0, ten: 0, side: 1 }));
}
const body2w = (S, bx, by) => [S.x + bx * Math.sin(S.psi) + by * Math.cos(S.psi), S.y + bx * Math.cos(S.psi) - by * Math.sin(S.psi)];
export { body2w };

// Ngoại lực từ neo, dây buộc, đệm va cầu. Cập nhật trạng thái neo/dây. Trả về {X,Y,N} hệ thân tàu.
export function externalForces(W, S, M, anchors, lines, h, dt, info) {
  let X = 0, Y = 0, N = 0;
  const sn = Math.sin(S.psi), cs = Math.cos(S.psi);
  const gE = S.u * sn + S.v * cs + S.cE, gN = S.u * cs - S.v * sn + S.cN;
  const add = (bx, by, fE, fN) => { const fx = fE * sn + fN * cs, fy = fE * cs - fN * sn; X += fx; Y += fy; N += bx * fy - by * fx; };
  // neo
  const p = M.p, clen = num(p.chainLen, 275), Wa = num(p.anchorW, 3) * 1000 * G, wc = num(p.chainW, 50) * G, hv = h + 3;
  for (const a of anchors) {
    a.ten = 0; if (a.st === 'stow') continue;
    const [hx, hy] = body2w(S, a.bx, a.by);
    const v = ANCHOR_SPD[a.lv] || 1;
    if (a.st === 'drop') {
      if (a.free) { const tg = a.ax === null ? FREE_SPD : FREE_BOTTOM_SPD; a.vf += (tg - a.vf) * Math.min(1, dt / 1.2); }
      a.chain = Math.min(clen, a.chain + (a.free ? a.vf : v) * dt);
      if (a.target && a.chain >= a.target) { a.chain = a.target; a.st = 'hold'; a.target = 0; }
      if (a.chain >= clen) a.st = 'hold';
    } else if (a.st === 'heave') {
      if (a.ten < 3 * Wa) a.chain = Math.max(0, a.chain - v * dt);
      if (a.chain <= hv - 1) { a.ax = null; }
      if (a.chain <= 0) { a.st = 'stow'; a.drag = false; a.free = false; continue; }
    }
    if (a.ax === null) { if (a.chain >= hv && a.st !== 'heave') { a.ax = hx; a.ay = hy; } else continue; }
    const dx = a.ax - hx, dy = a.ay - hy, dh = Math.hypot(dx, dy) || 1e-6;
    if (a.st === 'drop') { const need = Math.hypot(dh, hv); if (need > a.chain) a.chain = Math.min(clen, need); continue; }
    const reach = 0.92 * Math.sqrt(Math.max(0, a.chain * a.chain - hv * hv)), st = dh - reach;
    a.drag = false;
    if (st > 0) {
      const sc = a.chain / hv;
      const hmax = Wa * (sc < 2 ? 1.2 : sc < 3 ? 2.5 : sc < 5 ? 4.5 : 6) + 0.75 * wc * Math.max(0, a.chain - 1.3 * hv);
      let T = 2e5 * st;
      if (T > hmax) { const mv = (T - hmax) / 2e5; a.ax -= dx / dh * mv; a.ay -= dy / dh * mv; T = hmax; a.drag = true; }
      a.ten = T; add(a.bx, a.by, T * dx / dh, T * dy / dh);
    }
  }
  // dây buộc
  const mbl = 180 * (2 * num(p.lineR, 24)) ** 2, lmax = num(p.lineLen, 200);
  for (const l of lines) {
    l.ten = 0; if (l.st === 'chua') continue;
    const fy = l.side * M.B / 2 * l.fyk, [fxw, fyw] = body2w(S, l.fx, fy);
    const dx = l.bx - fxw, dy = l.by - fyw, dist = Math.hypot(dx, dy) || 1e-6;
    const k = mbl / (0.12 * Math.max(l.len, 10));
    let T = dist > l.len ? k * (dist - l.len) : 0;
    if (l.st === 'thu') { if (T < 0.2 * mbl) l.len = Math.max(2, l.len - 0.15 * dt); }
    else if (l.st === 'noi') { l.len = Math.min(lmax, l.len + 0.3 * dt); }
    if (T > 0) {
      const vE = gE + S.r * (l.fx * cs - fy * sn), vN = gN - S.r * (l.fx * sn + fy * cs);
      const vr = -(vE * dx + vN * dy) / dist; // >0: đang căng thêm
      T = Math.max(0, T + 3e5 * vr);
      l.ten = T; add(l.fx, fy, T * dx / dist, T * dy / dist);
    }
    l.pct = l.ten / mbl * 100;
  }
  // đệm va / cầu bến
  const SEGS = W.dyn && W.dyn.length ? W.segs.concat(W.dyn) : W.segs; // cầu bến, tàu đậu + tàu khác đang ở gần
  if (SEGS.length) {
    const L = M.loa, B = M.B;
    const pts = [[L / 2, 0], [L * 0.36, B / 2], [L * 0.36, -B / 2], [0, B / 2], [0, -B / 2], [-L * 0.4, B / 2], [-L * 0.4, -B / 2], [-L / 2, B * 0.3], [-L / 2, -B * 0.3]];
    let dBow = 1e9, dStern = 1e9, vBow = 0, vStern = 0, hit = 0, hitShip = false;
    for (const s of SEGS) {
      for (let i = 0; i < pts.length; i++) {
        const [bx, by] = pts[i], [wx, wy] = body2w(S, bx, by);
        const t = (wx - s.ax) * s.tx + (wy - s.ay) * s.ty; if (t < -3 || t > s.len + 3) continue;
        const sd = (wx - s.ax) * s.nx + (wy - s.ay) * s.ny; if (sd < -(s.pen || 30) || sd > 400) continue;
        const vE = gE + S.r * (bx * cs - by * sn), vN = gN - S.r * (bx * sn + by * cs);
        const vn = vE * s.nx + vN * s.ny, vt = vE * s.tx + vN * s.ty;
        if (bx > 0 && sd < dBow) { dBow = sd; vBow = -vn; }
        if (bx < 0 && sd < dStern) { dStern = sd; vStern = -vn; }
        if (sd < 0) {
          let F = 3e6 * -sd + (vn < 0 ? 4e6 * -vn : 0); if (F > 6e7) F = 6e7;
          const fr = -Math.sign(vt) * Math.min(0.25 * F, 5e5 * Math.abs(vt));
          add(bx, by, F * s.nx + fr * s.tx, F * s.ny + fr * s.ty);
          if (-vn > hit) { hit = -vn; hitShip = s.ship || false; }
        }
      }
    }
    if (info) { info.dBow = dBow; info.dStern = dStern; info.vBow = vBow; info.vStern = vStern; info.hit = hit; info.hitShip = hitShip; }
  } else if (info) { info.dBow = 1e9; info.dStern = 1e9; info.vBow = 0; info.vStern = 0; info.hit = 0; }
  return { X, Y, N };
}

export function sendLine(W, S, M, l) {
  if (!W.bollards.length) return 'Chưa có cầu bến trên hải đồ (vẽ ở tab 2)';
  // chọn mạn gần cầu hơn
  let best = null, bd = 1e9, bside = 1;
  for (const side of [1, -1]) {
    const fy = side * M.B / 2 * l.fyk, [fx, fyw] = body2w(S, l.fx, fy), [tx, ty] = body2w(S, l.fx + l.want, fy);
    for (const b of W.bollards) {
      const d = Math.hypot(b.x - fx, b.y - fyw); if (d > Math.min(num(M.p.lineLen, 200), 80)) continue;
      const sc = Math.hypot(b.x - tx, b.y - ty) + (W.bollards.used && W.bollards.used[b.n] ? 5 : 0);
      if (sc < bd) { bd = sc; best = b; bside = side; }
    }
  }
  if (!best) return 'Cầu còn xa quá, chưa đưa dây được (cần trong vòng 80 m)';
  l.side = bside; l.bx = best.x; l.by = best.y; l.bn = best.n;
  const [fx, fyw] = body2w(S, l.fx, bside * M.B / 2 * l.fyk);
  l.len = Math.hypot(best.x - fx, best.y - fyw) + 1.5; l.st = 'dua';
  return null;
}
