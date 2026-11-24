// Mặt đáy và lưới độ cao cuối: tam giác Delaunay qua số đo sâu + điểm mép (mép nước / bãi = 0, mép bãi / đất = hc),
// tô vào lưới ô (mặc định 4 điểm ảnh tờ); ô đất lấy độ cao đất. Lưới z: Int16 đơn vị dm, dương = cao hơn số 0 hải đồ.
import Delaunator from 'delaunator';

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

// dựng lưới z: cl (lớp ô), Eland (Float32 nửa độ phân giải hoặc null), edges (Float32 điểm mép), snd
export function composeGrid({ cl, gw, gh, cell, W2, H2, Eland, edges, snd, zPrev }) {
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
  return z;
}
