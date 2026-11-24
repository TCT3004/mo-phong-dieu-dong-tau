// Tàu đậu ở cảng (thuần JS, không DOM): vị trí theo kiểu cập, dây buộc, neo, khối va chạm, cọc bích trên boong.
// Trong bộ nhớ dùng mét thế giới (W.objs.ships), lưu theo lat/lon ở places.js.
//
// Tàu đậu sh = { id, ref (id tàu trong kho), type, name, L, B, T, D, mode, x, y, hdg (độ),
//   berth (tên bến) + bs (m dọc bến, từ đầu bến) — kiểu cập bến; host (id tàu được cập mạn) + hside (±1) + ha (m dọc tàu kia) — cập mạn tàu khác;
//   lines: [{ k (chỗ ra dây trên tàu, 0–7), to: { t: 'bol', berth, s } | { t: 'sb', id, k } }], anchors: [{ side, x, y, chain }] }
export const MOOR_MODES = [['port', 'Cập mạn trái vào cầu'], ['stbd', 'Cập mạn phải vào cầu'], ['stern', 'Cập lái (thả 2 neo mũi)'], ['along', 'Cập mạn tàu khác'], ['anchor', 'Đậu neo']];
// chỗ ra dây / cọc bích trên boong (thứ tự: mũi T/P, vai mũi T/P, vai lái T/P, lái T/P)
export const PTS = ['Mũi trái', 'Mũi phải', 'Vai mũi trái', 'Vai mũi phải', 'Vai lái trái', 'Vai lái phải', 'Lái trái', 'Lái phải'];
export const PTS_S = ['Mũi T', 'Mũi P', 'Vai mũi T', 'Vai mũi P', 'Vai lái T', 'Vai lái P', 'Lái T', 'Lái P'];
export const LINE_NAMES = ['Dây mũi', 'Dây mũi', 'Dây chéo mũi', 'Dây chéo mũi', 'Dây chéo lái', 'Dây chéo lái', 'Dây lái', 'Dây lái'];
const D2R = Math.PI / 180;

// nửa bề rộng mặt boong tại x (thân đơn giản: lái vuông vát, mũi nhọn cong)
export function halfB(sh, x) { const { L, B } = sh, u = x / (L / 2); if (u > 0.35) { const t = (u - 0.35) / 0.65; return B / 2 * Math.max(0, 1 - t ** 1.9) ** 0.85; } if (u < -0.6) { const t = (-0.6 - u) / 0.4; return B / 2 * (1 - 0.18 * t * t); } return B / 2; }
// đường bao thân (hệ tàu: x về mũi, y sang phải), ngược chiều kim đồng hồ khi nhìn từ trên (x Đông = y tàu…) — chỉ dùng điểm
export function outline(sh, n = 14) {
  const { L } = sh, side = [];
  for (let i = 0; i <= n; i++) { const x = -L / 2 + L * i / n; side.push([x, halfB(sh, x)]); }
  return [...side, ...side.slice(0, -1).reverse().map(([x, y]) => [x, -y])];
}
// hệ tàu → mét thế giới (giống body2w của world.js)
export function b2w(sh, bx, by) { const p = sh.hdg * D2R, sn = Math.sin(p), cs = Math.cos(p); return [sh.x + bx * sn + by * cs, sh.y + bx * cs - by * sn]; }
// điểm k (0–7) trên boong: { x, y } hệ tàu; edge: sát mép mạn (lỗ luồn dây) hay lùi vào trong (cọc bích)
export function deckPt(sh, k, edge) {
  const { L } = sh, s = k % 2 ? 1 : -1, g = k >> 1, x = [L / 2 - L * 0.1, L * 0.25, -L * 0.25, -L / 2 + L * 0.07][g], hb = halfB(sh, x);
  return [x, s * Math.max(0.3, hb - (edge ? 0.15 : Math.min(0.9, hb * 0.25)))];
}
export const hawse = (sh, side) => { const x = sh.L / 2 - sh.L * 0.07; return [x, side * halfB(sh, x) * 0.8]; };
export const freeboard = (sh) => Math.max(0.6, (sh.D || sh.T * 1.6) - sh.T);

const berthSegs = (W) => W.segs.filter((s) => !s.ship);
const berthIdx = (W, name) => W.objs.berths.findIndex((b) => b.name === name);
// điểm gần nhất trên mép bến: { s: đoạn, t, bi }
function nearSeg(W, x, y, bi) {
  let best = null, bd = 1e12;
  for (const s of berthSegs(W)) { if (bi !== undefined && s.bi !== bi) continue; const t = Math.max(0, Math.min(s.len, (x - s.ax) * s.tx + (y - s.ay) * s.ty)), px = s.ax + s.tx * t, py = s.ay + s.ty * t, d = Math.hypot(x - px, y - py); if (d < bd) { bd = d; best = { s, t, d }; } }
  return best;
}
const shipById = (W, id) => (W.objs.ships || []).find((q) => q.id === id);

// đặt tàu theo kiểu cập. (x, y): chỗ bấm / kéo (null: tính lại từ bến / tàu kia đã lưu). Trả true nếu đặt được
export function placeShip(W, sh, x, y) {
  const m = sh.mode;
  if (m === 'port' || m === 'stbd' || m === 'stern') {
    let hit;
    if (x === null) { const bi = berthIdx(W, sh.berth); if (bi < 0) return false; const segs = berthSegs(W).filter((s) => s.bi === bi); const s = segs.find((q) => sh.bs <= q.s0 + q.len) || segs[segs.length - 1]; if (!s) return false; hit = { s, t: Math.max(0, Math.min(s.len, sh.bs - s.s0)) }; }
    else { hit = nearSeg(W, x, y); if (!hit) return false; }
    const { s, t } = hit, fx = s.ax + s.tx * t, fy = s.ay + s.ty * t, gap = m === 'stern' ? sh.L / 2 + 2 : sh.B / 2 + 0.8;
    // dh: tàu nằm lệch so với vuông góc / song song bến (người dùng chỉnh hướng mũi), xoay quanh chỗ tiếp bến
    const dh = Math.max(-60, Math.min(60, sh.dh || 0)) * D2R, c = Math.cos(dh), sn = Math.sin(dh), nx = s.nx * c + s.ny * sn, ny = -s.nx * sn + s.ny * c;
    sh.hdg = (m === 'port' ? Math.atan2(-s.ny, s.nx) : m === 'stbd' ? Math.atan2(s.ny, -s.nx) : Math.atan2(s.nx, s.ny)) / D2R + (sh.dh || 0);
    sh.x = fx + nx * gap; sh.y = fy + ny * gap; sh.berth = W.objs.berths[s.bi].name; sh.bs = s.s0 + t; sh.host = null;
    return true;
  }
  if (m === 'along') {
    let h = sh.host ? shipById(W, sh.host) : null;
    if (x !== null) { let bd = 1e12; h = null; for (const q of W.objs.ships || []) { if (q === sh || dependsOn(W, q, sh)) continue; const d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; h = q; } } }
    if (!h) return false;
    const p = h.hdg * D2R, fx = Math.sin(p), fy = Math.cos(p), rx = Math.cos(p), ry = -Math.sin(p);
    if (x !== null) { sh.hside = (x - h.x) * rx + (y - h.y) * ry >= 0 ? 1 : -1; if ((h.mode === 'port' && sh.hside < 0) || (h.mode === 'stbd' && sh.hside > 0)) sh.hside = -sh.hside; const lim = Math.max(0, (h.L - sh.L) / 2) + sh.L * 0.25; sh.ha = Math.max(-lim, Math.min(lim, (x - h.x) * fx + (y - h.y) * fy)); }
    const off = h.B / 2 + sh.B / 2 + 0.8;
    sh.x = h.x + fx * (sh.ha || 0) + rx * sh.hside * off; sh.y = h.y + fy * (sh.ha || 0) + ry * sh.hside * off; sh.hdg = h.hdg + Math.max(-20, Math.min(20, sh.dh || 0)); sh.host = h.id; sh.berth = null;
    return true;
  }
  if (x !== null) { sh.x = x; sh.y = y; } sh.berth = null; sh.host = null; // đậu neo: hướng do người dùng đặt
  return true;
}
// q có (trực tiếp hay qua nhiều lớp) cập vào sh không
export function dependsOn(W, q, sh) { let c = q, n = 0; while (c && c.mode === 'along' && c.host && n++ < 12) { if (c.host === sh.id) return true; c = shipById(W, c.host); } return false; }

// cọc bích trên cầu (đã dựng trong W.bollards) gần một điểm thế giới
function nearBol(W, bi, x, y) { let best = null, bd = 1e12; for (const b of W.bollards) { if (b.bi !== bi) continue; const d = Math.hypot(b.x - x, b.y - y); if (d < bd) { bd = d; best = b; } } return best; }
// dây mặc định theo kiểu cập
export function defaultLines(W, sh) {
  const out = [], m = sh.mode, L = sh.L;
  if (m === 'port' || m === 'stbd') {
    const bi = berthIdx(W, sh.berth), s = m === 'port' ? 0 : 1; if (bi < 0) return (sh.lines = []);
    const want = [[0, L / 2 + L * 0.25], [2, -L * 0.05], [4, L * 0.05], [6, -L / 2 - L * 0.25]]; // [chỗ ra dây (nhóm), x đích dọc tàu]
    for (const [g, xt] of want) { const k = g + s, [wx, wy] = b2w(sh, xt, (s ? 1 : -1) * (sh.B / 2 + 1)), b = nearBol(W, bi, wx, wy); if (b) out.push({ k, to: { t: 'bol', berth: sh.berth, s: b.s } }); }
  } else if (m === 'stern') {
    const bi = berthIdx(W, sh.berth); if (bi < 0) return (sh.lines = []);
    for (const [k, yt] of [[6, sh.B * 1.6], [7, -sh.B * 1.6]]) { const [wx, wy] = b2w(sh, -L / 2 - 1.5, yt), b = nearBol(W, bi, wx, wy); if (b) out.push({ k, to: { t: 'bol', berth: sh.berth, s: b.s } }); } // hai dây lái bắt chéo
  } else if (m === 'along') {
    const h = shipById(W, sh.host); if (!h) return (sh.lines = []);
    const s = sh.hside > 0 ? 0 : 1, hs = 1 - s; // mạn mình áp vào tàu kia: cập vào mạn phải tàu kia (hside +1) thì mạn trái mình áp
    for (const [g, hg] of [[0, 0], [1, 2], [2, 1], [3, 3]]) { const k = g * 2 + s; out.push({ k, to: { t: 'sb', id: h.id, k: hg * 2 + hs } }); }
  }
  sh.lines = out; return out;
}
// neo mặc định: cập lái 2 neo mũi xòe; đậu neo 1 neo
export function defaultAnchors(W, sh) {
  const d = Math.max(3, W.depthAt(sh.x, sh.y)), chain = Math.round(Math.max(30, Math.min(220, d * (sh.mode === 'anchor' ? 6 : 4.5) + sh.L * 0.3)));
  if (sh.mode === 'stern') sh.anchors = [-1, 1].map((side) => anchorAt(sh, side, chain, side * 22));
  else if (sh.mode === 'anchor') sh.anchors = [anchorAt(sh, 1, chain, 0)];
  else sh.anchors = [];
  return sh.anchors;
}
// neo nằm đáy theo hướng (độ, so với mũi tàu) từ lỗ neo, cách xa khoảng 0,9 × xích
export function anchorAt(sh, side, chain, brg) { const [hx, hy] = hawse(sh, side), a = brg * D2R, r = chain * 0.9, [x, y] = b2w(sh, hx + Math.cos(a) * r, hy + Math.sin(a) * r); return { side, x, y, chain }; }

// đầu dây phía bờ / tàu kia: { x, y, top (độ cao trên số 0 hải đồ, hoặc trên mặt nước nếu float), float }
export function lineEnd(W, l) {
  if (l.to.t === 'bol') { const bi = berthIdx(W, l.to.berth); let best = null, bd = 1e9; for (const b of W.bollards) if (b.bi === bi && Math.abs(b.s - l.to.s) < bd) { bd = Math.abs(b.s - l.to.s); best = b; } return best ? { x: best.x, y: best.y, top: best.top, float: false } : null; }
  const h = shipById(W, l.to.id); if (!h) return null; const [bx, by] = deckPt(h, l.to.k, false), [x, y] = b2w(h, bx, by); return { x, y, top: freeboard(h), float: true, ship: h };
}

// khối va chạm: các cạnh đường bao (pháp tuyến hướng ra ngoài), chỉ tính khi lấn vào trong ít hơn nửa bề rộng
export function shipSegs(sh) {
  const P = outline(sh, 10).map(([bx, by]) => b2w(sh, bx, by)), out = [];
  for (let i = 0; i < P.length; i++) {
    const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length], len = Math.hypot(bx - ax, by - ay); if (len < 0.2) continue;
    const tx = (bx - ax) / len, ty = (by - ay) / len; let nx = -ty, ny = tx; const mx = (ax + bx) / 2 - sh.x, my = (ay + by) / 2 - sh.y; if (mx * nx + my * ny < 0) { nx = -nx; ny = -ny; }
    out.push({ ax, ay, bx, by, tx, ty, nx, ny, len, depth: 0, top: freeboard(sh), ship: sh.id, pen: sh.B * 0.45, bi: -1, s0: 0 });
  }
  return out;
}
// cọc bích trên boong (cho tàu mình đưa dây sang)
export function shipBollards(sh, n0) {
  const out = []; for (let k = 0; k < 8; k++) { const [bx, by] = deckPt(sh, k, false), [x, y] = b2w(sh, bx, by); out.push({ x, y, top: freeboard(sh), float: true, n: n0 + k, bi: -1, ship: sh.id, k, s: 0 }); }
  return out;
}
// tàu mới đặt từ thông số tàu trong kho
export function newMoored(ref, p, mode) {
  const T = ((+p.tf || 3) + (+p.ta || 3)) / 2;
  return { id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ref, type: p.type || '', name: p.name || 'Tàu', L: +p.loa || 50, B: +p.B || 9, T, D: +p.D || T * 1.6, mode: mode || 'port', x: 0, y: 0, hdg: 0, lines: [], anchors: [] };
}
// dựng lại vị trí mọi tàu đậu theo bến / tàu kia (sau khi bến đổi hoặc gốc trôi); tàu cập mạn tính sau tàu nó cập vào
export function relayout(W) {
  const list = W.objs.ships || [], done = new Set();
  for (let pass = 0; pass < 6; pass++) for (const sh of list) {
    if (done.has(sh.id)) continue; if (sh.mode === 'along' && sh.host && !done.has(sh.host) && shipById(W, sh.host)) continue;
    if (sh.mode !== 'anchor') placeShip(W, sh, null, null); done.add(sh.id);
  }
}
