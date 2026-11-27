// Mặt đáy và lưới độ cao cuối, tô vào lưới ô (mặc định 4 điểm ảnh tờ). Lưới z: Int16 đơn vị dm, dương = cao hơn số 0 hải đồ.
// - ô đất: độ cao đất
// - ô bãi: tam giác Delaunay qua số đo + điểm mép (mép nước / bãi = 0, mép bãi / đất = hc)
// - ô nước: theo từng vùng màu nước (dải độ sâu), nội suy giữa các số đo cùng màu, sát ranh về độ sâu ở ranh theo độ dốc suy từ số đo
//   (xem waterDepths) — không nối tam giác qua điểm mép bờ: giữa hai hòn gần nhau ít số đo, tam giác mép–mép làm nông giả cả vùng;
//   đường đẳng sâu đã có giá trị (isobath.js) góp thêm điểm dọc đường vào nội suy cùng số đo
import Delaunator from 'delaunator';
import { isoValues } from './isobath.js';
import { edt } from './img.js';

// điểm mép từ lớp nửa độ phân giải (1 nước, 2 bãi, 3 đất), mỗi ô 3×3 một điểm → Float32 [x, y, z] theo điểm ảnh tờ
export function edgeSamples(cls2, W2, H2, hc, step = 3) {
  const out = [], seen = new Set();
  for (let y = 1; y < H2 - 1; y++) for (let x = 1; x < W2 - 1; x++) {
    const i = y * W2 + x, c = cls2[i]; if (c === 3) continue;
    let nl = false, nf = false, nw = false;
    for (const j of [i - 1, i + 1, i - W2, i + W2]) { const q = cls2[j]; if (q === 3) nl = true; else if (q === 2) nf = true; else nw = true; }
    let z = null;
    if (c === 1 && (nf || nl)) z = 0; else if (c === 2 && nl) z = hc; else if (c === 2 && nw) z = 0;
    if (z === null) continue;
    const key = ((x / step) | 0) * 65536 + ((y / step) | 0); if (seen.has(key)) continue; seen.add(key);
    out.push(x * 2 + 1, y * 2 + 1, z);
  }
  return Float32Array.from(out);
}

// độ cao mép bờ lấy lại từ điểm mép (giá trị z lớn nhất)
function hcOf(edges) { let m = 0; for (let i = 2; i < edges.length; i += 3) if (edges[i] > m) m = edges[i]; return m; }
// pts: Float32 [x, y, z] theo điểm ảnh tờ; tô các ô (cell điểm ảnh) có wet[ô] = 1 bằng nội suy tuyến tính trên tam giác
export function rasterTin(pts, gw, gh, cell, wet, out) {
  const n = pts.length / 3; if (n < 3) return 0;
  const co = new Float64Array(n * 2); for (let i = 0; i < n; i++) { co[i * 2] = pts[i * 3]; co[i * 2 + 1] = pts[i * 3 + 1]; }
  const dl = new Delaunator(co), T = dl.triangles; let filled = 0;
  for (let t = 0; t < T.length; t += 3) {
    const a = T[t], b = T[t + 1], c = T[t + 2];
    const ax = pts[a * 3] / cell - 0.5, ay = pts[a * 3 + 1] / cell - 0.5, az = pts[a * 3 + 2];
    const bx = pts[b * 3] / cell - 0.5, by = pts[b * 3 + 1] / cell - 0.5, bz = pts[b * 3 + 2];
    const cx = pts[c * 3] / cell - 0.5, cy = pts[c * 3 + 1] / cell - 0.5, cz = pts[c * 3 + 2];
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(det) < 1e-9) continue;
    const y0 = Math.max(0, Math.ceil(Math.min(ay, by, cy))), y1 = Math.min(gh - 1, Math.floor(Math.max(ay, by, cy)));
    const x0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx))), x1 = Math.min(gw - 1, Math.floor(Math.max(ax, bx, cx)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const o = y * gw + x; if (!wet[o]) continue;
      const l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / det, l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / det, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      out[o] = Math.round((l1 * az + l2 * bz + l3 * cz) * 10); wet[o] = 2; filled++;
    }
  }
  return filled;
}

// xy: [x, y] theo điểm ảnh tờ, vals: giá trị tại điểm → Float32 cho các ô mask[ô] = 1 (nội suy tuyến tính trên tam giác,
// ô ngoài lưới tam giác lấy theo ô gần nhất đã có, nối qua các ô mask); ô không tới được = NaN
export function rasterTinF(xy, vals, gw, gh, cell, mask) {
  const N = gw * gh, out = new Float32Array(N).fill(NaN), n = vals.length;
  if (n >= 3) {
    const T = new Delaunator(Float64Array.from(xy)).triangles;
    for (let t = 0; t < T.length; t += 3) {
      const a = T[t], b = T[t + 1], c = T[t + 2];
      const ax = xy[a * 2] / cell - 0.5, ay = xy[a * 2 + 1] / cell - 0.5, bx = xy[b * 2] / cell - 0.5, by = xy[b * 2 + 1] / cell - 0.5, cx = xy[c * 2] / cell - 0.5, cy = xy[c * 2 + 1] / cell - 0.5;
      const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(det) < 1e-9) continue;
      const y0 = Math.max(0, Math.ceil(Math.min(ay, by, cy))), y1 = Math.min(gh - 1, Math.floor(Math.max(ay, by, cy)));
      const x0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx))), x1 = Math.min(gw - 1, Math.floor(Math.max(ax, bx, cx)));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const o = y * gw + x; if (!mask[o]) continue;
        const l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / det, l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / det, l3 = 1 - l1 - l2;
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
        out[o] = l1 * vals[a] + l2 * vals[b] + l3 * vals[c];
      }
    }
  }
  // điểm đo nằm ở ô mask chưa được tô (ít điểm, hoặc điểm sát mép tam giác) thì gieo đúng giá trị của nó
  for (let i = 0; i < n; i++) { const x = Math.min(gw - 1, Math.max(0, Math.floor(xy[i * 2] / cell))), y = Math.min(gh - 1, Math.max(0, Math.floor(xy[i * 2 + 1] / cell))), o = y * gw + x; if (mask[o] && isNaN(out[o])) out[o] = vals[i]; }
  let fr = []; for (let o = 0; o < N; o++) if (mask[o] && !isNaN(out[o])) fr.push(o);
  while (fr.length) { const nx = []; for (const o of fr) { const x = o % gw; for (const q of [o - 1, o + 1, o - gw, o + gw]) { if (q < 0 || q >= N || Math.abs((q % gw) - x) > 1 || !mask[q] || !isNaN(out[q])) continue; out[q] = out[o]; nx.push(q); } } fr = nx; }
  return out;
}

// ---------- mặt nước ----------
const STD = [0, 2, 5, 10, 20, 30, 50, 100, 200];   // mức đường đẳng sâu thường dùng làm ranh giới màu nước (m)
const cellOf = (s, gw, gh, cell) => Math.min(gh - 1, Math.max(0, Math.floor(s.y / cell))) * gw + Math.min(gw - 1, Math.max(0, Math.floor(s.x / cell)));

// một vùng màu nước, dải [L, U]:
//   d = min(max(min(S, L + KS × dS), U − KU × dU), KC × dC), giữ trong [min(L, KC × dC), U]
// S = nội suy giữa các số đo của vùng; dS = khoảng cách tới vùng màu nông hơn (ở đó sâu L); dU = tới vùng màu sâu hơn (ở đó sâu U);
// dC = tới bờ / bãi (ở đó 0 m); KS, KU, KC = độ dốc suy từ từng số đo rồi nội suy. Vùng không phải nông nhất (L > 0) sát bờ:
// từ 0 m lên L trong tối đa 3 ô (≈ 1 mm trên giấy — hẹp hơn thế hải đồ đã vẽ dải màu nông hơn).
// Đúng chỗ số đo ra đúng số đo; sát ranh nông về L, sát ranh sâu về U, sát bờ về 0; ranh dốc thì đổi nhanh, thoải thì đổi dần
function zoneDepths(out, mask, pts, L, U, DS, DC, DU, gw, gh, cell) {
  const dist = (D, o) => Math.max(0.5, D[o] - 0.5) * cell, xy = [], V = [], KS = [], KU = [], KC = [], kMin = L > 0 ? L / (3 * cell) : 0;
  for (const s of pts) { const o = cellOf(s, gw, gh, cell), v = Math.max(L, Math.min(U, s.v)); xy.push(s.x, s.y); V.push(v);
    KC.push(Math.min(1, v / dist(DC, o)));
    if (DS) KS.push(Math.min(1, Math.max(0, (v - L) / dist(DS, o))));
    if (DU) KU.push(Math.min(1, Math.max(0, (U - v) / dist(DU, o)))); }
  const Sv = rasterTinF(xy, V, gw, gh, cell, mask), Cv = rasterTinF(xy, KC, gw, gh, cell, mask);
  const Sl = DS ? rasterTinF(xy, KS, gw, gh, cell, mask) : null, Uv = DU ? rasterTinF(xy, KU, gw, gh, cell, mask) : null;
  for (let o = 0; o < out.length; o++) { if (!mask[o] || isNaN(Sv[o])) continue;
    let d = Sv[o]; if (Sl) d = Math.min(d, L + Sl[o] * dist(DS, o)); if (Uv) d = Math.max(d, U - Uv[o] * dist(DU, o));
    const c = Math.max(Cv[o], kMin) * dist(DC, o); d = Math.min(d, c);
    out[o] = Math.max(Math.max(Math.min(L, c), 0.1), Math.min(U, d)); }
}

// dải độ sâu của từng màu nước (ids theo thứ tự nông → sâu): ranh giữa hai màu kề nhau (cùng có ≥ 10 số đo) là mức chuẩn
// tách hai nhóm số đo tốt nhất (số đo màu nông ≤ ranh, màu sâu ≥ ranh, cho lệch 0,3 m; cần đúng ≥ 85 %);
// màu nông nhất từ 0, màu sâu nhất không có U; màu ít số đo lấy dải theo màu kề. Không tách được → null
export function tintBands(ids, vals) {
  const ok = ids.filter((t) => (vals.get(t) || []).length >= 10); if (ok.length < 2) return null;
  const cut = new Map();
  for (let i = 0; i + 1 < ok.length; i++) {
    const a = vals.get(ok[i]), b = vals.get(ok[i + 1]); let best = null, acc = 0;
    for (const c of STD) { if (!c) continue; const f = (a.filter((v) => v <= c + 0.3).length / a.length + b.filter((v) => v >= c - 0.3).length / b.length) / 2; if (f > acc) { acc = f; best = c; } }
    if (acc < 0.85 || (i && best <= cut.get(ok[i - 1]))) return null;
    cut.set(ok[i], best);
  }
  const B = new Map();
  ok.forEach((t, i) => B.set(t, { L: i ? cut.get(ok[i - 1]) : 0, U: i + 1 < ok.length ? cut.get(t) : Infinity }));
  for (const t of ids) if (!B.has(t)) { // màu ít số đo: nằm giữa màu nông hơn và sâu hơn có dải
    const lo = ok.filter((q) => q < t).pop(), hi = ok.find((q) => q > t);
    const L = lo !== undefined ? B.get(lo).U : 0, U = hi !== undefined ? B.get(hi).L : Infinity;
    B.set(t, { L: Math.min(L, U), U: Math.max(L, U), few: true }); }
  return B;
}

// độ sâu ô nước (m, dương; NaN = không có số đo nối tới).
// tn (màu nước từng ô, 1…n từ nông tới sâu) có ≥ 2 màu khớp dải độ sâu: mỗi vùng màu nội suy riêng từ số đo cùng màu,
// giữ trong dải màu (luồng nạo vét tô màu sâu hơn hai bên thì giữa luồng theo số đo trong luồng, không kéo theo số đo ngoài mép);
// số đo nông hẳn hơn dải màu (bãi ngầm lẻ, hoặc đọc nhầm) chỉ tạo hố nông cục bộ dốc 1:10 quanh nó; số đo sâu hẳn hơn dải bị bỏ.
// Không có màu / màu không khớp: một vùng, L = 0 ở bờ (độ dốc bờ suy từ số đo), không có U
// iso (đường đẳng sâu dò từ ảnh, isobath.js): đường nào suy được giá trị từ số đo hai bên thì các ô dọc đường thành điểm nội suy thêm
// (vùng màu: chỉ khi giá trị nằm trong dải của vùng đó). info (nếu có) nhận { isoAll, isoOk } — số đường dò được / có giá trị
export function waterDepths({ cl, tn, gw, gh, cell, snd, mpp, iso, k, info }) {
  const N = gw * gh, coast = new Uint8Array(N), wet = new Uint8Array(N);
  for (let o = 0; o < N; o++) { const c = cl[o]; if (c === 2 || c === 3) coast[o] = 1; else wet[o] = 1; }
  const S = snd.filter((s) => !s.del && !s.sus && !s.dry && s.v > 0); if (!S.length) return null;
  const isoPts = (B) => { if (!iso) return []; const r = isoValues(iso, S, gw, gh, cell, B ? (o) => (tn[o] && B.get(tn[o])) || null : null, k || 1);
    if (info) { info.isoAll = r.lines.length; info.isoOk = r.lines.filter((l) => l.ok).length; } return r.pts; };
  const out = new Float32Array(N).fill(NaN);
  const ids = []; if (tn) { const seen = new Uint8Array(256); for (let o = 0; o < N; o++) if (wet[o] && tn[o]) seen[tn[o]] = 1; for (let t = 1; t < 256; t++) if (seen[t]) ids.push(t); }
  // màu của từng số đo: ô của nó (chữ số đã lấp màu quanh), không có thì màu ô nước gần nhất trong 4 ô
  const tOf = (s) => { const o = cellOf(s, gw, gh, cell); if (tn[o]) return tn[o]; const x0 = o % gw, y0 = (o / gw) | 0;
    for (let r = 1; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = x0 + dx, y = y0 + dy; if (x < 0 || y < 0 || x >= gw || y >= gh) continue; const t = tn[y * gw + x]; if (t) return t; } return 0; };
  let B = null; const vals = new Map(), tS = new Map();
  if (ids.length >= 2) { for (const s of S) { const t = tOf(s); tS.set(s, t); if (t) { if (!vals.has(t)) vals.set(t, []); vals.get(t).push(s.v); } } B = tintBands(ids, vals); }
  const DC = edt(coast, gw, gh).D, IP = isoPts(B);
  if (!B) { zoneDepths(out, wet, IP.length ? S.concat(IP) : S, 0, Infinity, null, DC, null, gw, gh, cell); return out; }
  const tI = new Map(); for (const p of IP) tI.set(p, tn[cellOf(p, gw, gh, cell)]);
  const cones = [];
  ids.forEach((t, i) => {
    const { L, U } = B.get(t), mask = new Uint8Array(N), srcL = new Uint8Array(N), srcU = new Uint8Array(N); let anyL = false, anyU = false;
    for (let o = 0; o < N; o++) { const c = tn[o]; if (!wet[o] || !c) continue; if (c === t) mask[o] = 1;
      else if (c < t) { srcL[o] = 1; anyL = true; } else { srcU[o] = 1; anyU = true; } }
    const inb = [], all = S.filter((s) => tS.get(s) === t);
    for (const s of all) { if (s.v < L - 0.5) cones.push([s, L]); else if (s.v <= U + 0.5) inb.push(s); }
    for (const p of IP) if (tI.get(p) === t && p.v >= L - 0.5 && p.v <= U + 0.5) inb.push(p);
    const pts = inb.length ? inb : [{ x: 0, y: 0, v: isFinite(U) ? (L + U) / 2 : L + 2 }];  // vùng không có số đo: giữa dải
    if (!inb.length) { for (let o = 0; o < N; o++) if (mask[o]) { out[o] = pts[0].v; } return; }
    zoneDepths(out, mask, pts, L, U, anyL ? edt(srcL, gw, gh).D : null, DC, isFinite(U) && anyU ? edt(srcU, gw, gh).D : null, gw, gh, cell);
  });
  // ô nước không rõ màu (tn = 0): một vùng như khi không có màu
  let unk = 0; const mk = new Uint8Array(N); for (let o = 0; o < N; o++) if (wet[o] && !tn[o]) { mk[o] = 1; unk++; }
  if (unk) zoneDepths(out, mk, IP.length ? S.concat(IP) : S, 0, Infinity, null, DC, null, gw, gh, cell);
  // số đo nông hơn hẳn dải màu: hố nông cục bộ, sâu thêm 1 m mỗi 10 m ra xa
  const kc = 0.1 * (mpp || 2);
  for (const [s, L] of cones) { const R = (L - s.v) / kc / cell + 1, cx = s.x / cell - 0.5, cy = s.y / cell - 0.5;
    for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(gh - 1, Math.ceil(cy + R)); y++) for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(gw - 1, Math.ceil(cx + R)); x++) {
      const o = y * gw + x; if (!wet[o] || isNaN(out[o])) continue; const d = s.v + Math.hypot(x - cx, y - cy) * cell * kc; if (d < out[o]) out[o] = Math.max(0.1, d); } }
  return out;
}

// màu nước từng ô lưới: màu ở tâm ô (nửa độ phân giải), không có thì màu nhiều nhất trong ô; ô nước còn thiếu lấy theo ô bên cạnh
export function cellTints(tint2, cl, W2, H2, gw, gh, cell) {
  const N = gw * gh, tn = new Uint8Array(N), f = cell / 2;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { const o = y * gw + x; if (cl[o] === 2 || cl[o] === 3) continue;
    let t = tint2[Math.min(H2 - 1, Math.floor((y + 0.5) * f)) * W2 + Math.min(W2 - 1, Math.floor((x + 0.5) * f))];
    if (!t) { const c = new Uint8Array(8); let bn = 0; for (let yy = Math.floor(y * f); yy < Math.min(H2, Math.floor((y + 1) * f)); yy++) for (let xx = Math.floor(x * f); xx < Math.min(W2, Math.floor((x + 1) * f)); xx++) { const q = tint2[yy * W2 + xx]; if (q && ++c[q] > bn) { bn = c[q]; t = q; } } }
    tn[o] = t; }
  let fr = []; for (let o = 0; o < N; o++) if (tn[o]) fr.push(o);
  while (fr.length) { const nx = []; for (const o of fr) { const x = o % gw; for (const q of [o - 1, o + 1, o - gw, o + gw]) { if (q < 0 || q >= N || Math.abs((q % gw) - x) > 1 || tn[q] || cl[q] === 2 || cl[q] === 3) continue; tn[q] = tn[o]; nx.push(q); } } fr = nx; }
  return tn;
}

// lớp ô lưới (lấy điểm nửa độ phân giải ở tâm ô)
export function cellClasses(cls2, W2, H2, gw, gh, cell) {
  const cl = new Uint8Array(gw * gh), f = cell / 2;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { const xx = Math.min(W2 - 1, Math.floor((x + 0.5) * f)), yy = Math.min(H2 - 1, Math.floor((y + 0.5) * f)); cl[y * gw + x] = cls2[yy * W2 + xx]; }
  return cl;
}

// điểm đo sâu → điểm Delaunay (z = −độ sâu; độ cao bãi cạn z = +)
export function soundingPts(snd) {
  const o = []; for (const s of snd) { if (s.del || s.sus) continue; o.push(s.x, s.y, s.dry ? s.v : -s.v); } return o;
}

// dựng lưới z: cl (lớp ô), Eland (Float32 nửa độ phân giải hoặc null), edges (Float32 điểm mép), snd; iso, k, info: xem waterDepths
export function composeGrid({ cl, tn, gw, gh, cell, W2, H2, Eland, edges, snd, zPrev, mpp, iso, k, info }) {
  const z = zPrev ? Int16Array.from(zPrev) : new Int16Array(gw * gh), wet = new Uint8Array(gw * gh), f = cell / 2;
  for (let o = 0; o < gw * gh; o++) {
    if (cl[o] === 3) { if (Eland) { const x = Math.min(W2 - 1, Math.floor(((o % gw) + 0.5) * f)), y = Math.min(H2 - 1, Math.floor((((o / gw) | 0) + 0.5) * f)), e = Eland[y * W2 + x]; z[o] = Math.round((isNaN(e) ? 3 : e) * 10); } }
    else wet[o] = 1;
  }
  const sp = soundingPts(snd), pts = new Float32Array(sp.length + edges.length); pts.set(sp); pts.set(edges, sp.length);
  rasterTin(pts, gw, gh, cell, wet, z);
  // nhất quán với màu hải đồ: vùng nước (trắng / xanh lơ) dưới số 0, vùng bãi (xanh lá) từ 0 tới mép bờ
  // bãi: không cao quá mức bãi cao nhất (độ cao bãi đọc được, ≥ 2 m) trừ dải 6 ô sát mép đất dốc lên tới mép bờ
  // (tránh «sống» bãi cao bằng mép bờ nối giữa hai đảo do tam giác nối hai mép đất)
  const hcd = Math.round((hcOf(edges) || 3) * 10), dvals = snd.filter((s) => s.dry && !s.del && !s.sus).map((s) => s.v).sort((a, b) => a - b);
  const zhi = Math.round(Math.min(hcd / 10, Math.max(2, dvals.length ? dvals[Math.floor(dvals.length * 0.9)] : 2)) * 10), R = 6;
  const dl = new Uint8Array(wet.length).fill(255); let fr = [];
  for (let o = 0; o < wet.length; o++) if (cl[o] === 3) { dl[o] = 0; fr.push(o); }
  for (let s = 1; s <= R && fr.length; s++) { const nx = []; for (const o of fr) { const x = o % gw; for (const q of [o - 1, o + 1, o - gw, o + gw]) { if (q < 0 || q >= wet.length || Math.abs((q % gw) - x) > 1 || dl[q] !== 255) continue; dl[q] = s; nx.push(q); } } fr = nx; }
  for (let o = 0; o < wet.length; o++) { if (wet[o] !== 2) continue;
    if (cl[o] === 2) { const cap = dl[o] >= R ? zhi : Math.round(zhi + (hcd - zhi) * (1 - dl[o] / R)); z[o] = Math.max(0, Math.min(cap, z[o])); }
    else if (z[o] > -1) z[o] = -1; }
  // ô nước ngoài lưới tam giác (hiếm): lấy theo ô nước gần nhất đã có
  const left = []; for (let o = 0; o < wet.length; o++) if (wet[o] === 1) left.push(o);
  if (left.length) {
    let frontier = []; for (let o = 0; o < wet.length; o++) if (wet[o] === 2) frontier.push(o);
    while (frontier.length && left.length) { const nx = [];
      for (const o of frontier) { const x = o % gw; for (const q of [o - 1, o + 1, o - gw, o + gw]) { if (q < 0 || q >= wet.length || (Math.abs((q % gw) - x) > 1)) continue; if (wet[q] === 1) { z[q] = z[o]; wet[q] = 2; nx.push(q); } } }
      frontier = nx; }
  }
  // ô nước: theo số đo sâu + độ dốc bờ (ô nước không nối tới số đo nào, ví dụ ao trong đảo, giữ cách cũ)
  const wd = waterDepths({ cl, tn, gw, gh, cell, snd, mpp, iso, k, info });
  if (wd) for (let o = 0; o < wet.length; o++) if (cl[o] !== 2 && cl[o] !== 3 && !isNaN(wd[o])) z[o] = -Math.max(1, Math.round(wd[o] * 10));
  return z;
}
