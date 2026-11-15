// Sinh hải đồ BSB/KAP tổng hợp để kiểm thử (không cần hải đồ thật).
// Ảnh là lưới Mercator theo datum của tờ; nét lưới kinh vĩ độ vẽ đúng vị trí WGS-84 → các tờ ghép đúng thì nét phải liền nhau.
import { llToMerc, mercToLL } from '../../src/geo/proj.js';
import { toWGS84, fromWGS84, normalizeDatum } from '../../src/geo/datum.js';

export const PAL = [[0, 0, 0], [255, 255, 255], [190, 225, 240], [250, 230, 160], [0, 0, 0], [120, 200, 120], [200, 60, 60]]; // 1 sâu, 2 nông, 3 đất, 4 nét đen, 5 bãi cạn, 6 đỏ
// spec: { name, nu, scale, datum, lat0, lat1, lon0, lon1 (theo datum của tờ), W, H, gridMin, islands:[{lat,lon,r}], ply:[[lat,lon]] (tùy chọn), rot (độ, xoay ảnh) }
export function makeKap(spec) {
  const { W, H } = spec, did = normalizeDatum(spec.datum), rot = (spec.rot || 0) * Math.PI / 180;
  const [X0, Y1] = llToMerc(spec.lat1, spec.lon0), [X1, Y0] = llToMerc(spec.lat0, spec.lon1);
  const cxm = (X0 + X1) / 2, cym = (Y0 + Y1) / 2, sx = (X1 - X0) / W, sy = (Y1 - Y0) / H, cr = Math.cos(rot), sr = Math.sin(rot);
  // pixel → Mercator (của datum tờ), có thể xoay quanh tâm ảnh
  const p2m = (px, py) => { const u = (px - W / 2) * sx, v = -(py - H / 2) * sy; return [cxm + u * cr - v * sr, cym + u * sr + v * cr]; };
  const ll = (px, py) => mercToLL(...p2m(px, py));
  const g = (spec.gridMin || 2) / 60, idx = new Uint8Array(W * H);
  const isl = (spec.islands || []).map((o) => ({ ...o, m: llToMerc(o.lat, o.lon) }));
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const [la, lo] = ll(px + 0.5, py + 0.5), w = did && did !== 'WGS84' ? toWGS84(la, lo, did) : [la, lo];
    let c = 1;
    for (const o of isl) { const [X, Y] = llToMerc(w[0], w[1]), d = Math.hypot(X - o.m[0], Y - o.m[1]) * Math.cos(o.lat * Math.PI / 180); if (d < o.r) c = 3; else if (d < o.r * 1.6 && c === 1) c = 2; }
    // nét lưới WGS-84 rộng ~1,5 pixel
    const [la2, lo2] = ll(px + 1.5, py + 1.5), w2 = did && did !== 'WGS84' ? toWGS84(la2, lo2, did) : [la2, lo2];
    if (Math.floor(w[0] / g) !== Math.floor(w2[0] / g) || Math.floor(w[1] / g) !== Math.floor(w2[1] / g)) c = 4;
    idx[py * W + px] = c;
  }
  const corners = [[0, 0], [W, 0], [W, H], [0, H]], refs = [...corners, [W / 2, H / 2], [W / 4, H / 4], [3 * W / 4, H / 4], [W / 4, 3 * H / 4], [3 * W / 4, 3 * H / 4]];
  const L = ['!Hải đồ tổng hợp để kiểm thử', `VER/3.0`, `BSB/NA=${spec.name},NU=${spec.nu || spec.name},RA=${W},${H},DU=254`,
    `KNP/SC=${spec.scale},GD=${spec.datum || 'WGS84'},PR=MERCATOR,PP=${((spec.lat0 + spec.lat1) / 2).toFixed(4)},PI=UNKNOWN,SP=UNKNOWN,SK=0.0,TA=90,UN=METERS,SD=MLLW,DX=0,DY=0`,
    `CED/SE=1,RE=1,ED=01/01/2026`, `OST/1`, `IFM/4`];
  PAL.forEach((c, i) => { if (i) L.push(`RGB/${i},${c[0]},${c[1]},${c[2]}`); });
  PAL.forEach((c, i) => { if (i) L.push(`NGT/${i},${c[0] >> 2},${c[1] >> 2},${c[2] >> 2}`); });
  refs.forEach(([px, py], i) => { const [la, lo] = ll(px, py); L.push(`REF/${i + 1},${Math.round(px)},${Math.round(py)},${la.toFixed(7)},${lo.toFixed(7)}`); });
  const ply = spec.ply || corners.map(([px, py]) => ll(px, py));
  ply.forEach(([la, lo], i) => L.push(`PLY/${i + 1},${la.toFixed(7)},${lo.toFixed(7)}`));
  const head = new TextEncoder().encode(L.join('\r\n') + '\r\n'), out = [...head, 0x1a, 0x00, 4];
  const depth = 4, shift = 7 - depth, cmask = (1 << shift) - 1;
  const varint = (n) => { const b = [n & 0x7f]; n >>= 7; while (n) { b.unshift((n & 0x7f) | 0x80); n >>= 7; } return b; };
  for (let y = 0; y < H; y++) {
    out.push(...varint(y + 1));
    let x = 0;
    while (x < W) {
      const c = idx[y * W + x]; let e = x + 1; while (e < W && idx[y * W + e] === c) e++;
      const Lr = e - x - 1; let k = 0; while (Math.floor(Lr / 128 ** k) > cmask) k++;
      out.push((c << shift) | Math.floor(Lr / 128 ** k) | (k ? 0x80 : 0));
      for (let i = k - 1; i >= 0; i--) out.push((Math.floor(Lr / 128 ** i) & 0x7f) | (i ? 0x80 : 0));
      x = e;
    }
    out.push(0);
  }
  return { bytes: new Uint8Array(out), idx, ll, p2m };
}
// bộ tờ mẫu: 2 tờ liền kề 1:50k, 1 tờ 1:200k phủ cả hai, 1 tờ 1:12,5k có PLY lõm, 1 tờ VN-2000, 1 tờ xoay
export const SET = {
  A: { name: 'MAU-50K-TAY', scale: 50000, lat0: 21.0, lat1: 21.15, lon0: 107.3, lon1: 107.5, W: 1200, H: 950, islands: [{ lat: 21.08, lon: 107.47, r: 1500 }] },
  B: { name: 'MAU-50K-DONG', scale: 50000, lat0: 21.0, lat1: 21.15, lon0: 107.5, lon1: 107.7, W: 1200, H: 950, islands: [{ lat: 21.08, lon: 107.47, r: 1500 }] },
  C: { name: 'MAU-200K', scale: 200000, lat0: 20.9, lat1: 21.3, lon0: 107.2, lon1: 107.8, W: 800, H: 560, gridMin: 6, islands: [{ lat: 21.08, lon: 107.47, r: 1500 }] },
  D: { name: 'MAU-12K-LOM', scale: 12500, lat0: 21.05, lat1: 21.09, lon0: 107.36, lon1: 107.42, W: 1000, H: 700, gridMin: 0.5, ply: [[21.09, 107.36], [21.09, 107.42], [21.05, 107.42], [21.05, 107.39], [21.07, 107.39], [21.07, 107.36]] },
  E: { name: 'MAU-25K-VN2000', scale: 25000, datum: 'VN-2000', lat0: 21.04, lat1: 21.12, lon0: 107.42, lon1: 107.56, W: 1100, H: 700, gridMin: 1, islands: [{ lat: 21.08, lon: 107.47, r: 1500 }] },
  F: { name: 'MAU-50K-XOAY', scale: 50000, lat0: 21.15, lat1: 21.28, lon0: 107.35, lon1: 107.55, W: 1000, H: 800, rot: 6, islands: [] }
};
