// Khoảng cách / phương vị trên elipxoit WGS-84 (Vincenty) và đường loxodrom (hướng đi không đổi, như kẻ trên hải đồ Mercator).
import { WGS84 } from './datum.js';
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const norm360 = (a) => ((a % 360) + 360) % 360;

// bài toán ngược: { dist (m), az1, az2 (độ) }
export function inverse(lat1, lon1, lat2, lon2) {
  const a = WGS84.a, f = WGS84.f, b = a * (1 - f), L = (lon2 - lon1) * D2R;
  const U1 = Math.atan((1 - f) * Math.tan(lat1 * D2R)), U2 = Math.atan((1 - f) * Math.tan(lat2 * D2R));
  const sU1 = Math.sin(U1), cU1 = Math.cos(U1), sU2 = Math.sin(U2), cU2 = Math.cos(U2);
  let lam = L, it = 0, sS, cS, sig, sA, c2A, c2m;
  do {
    const sl = Math.sin(lam), cl = Math.cos(lam);
    sS = Math.hypot(cU2 * sl, cU1 * sU2 - sU1 * cU2 * cl); if (sS === 0) return { dist: 0, az1: 0, az2: 0 };
    cS = sU1 * sU2 + cU1 * cU2 * cl; sig = Math.atan2(sS, cS); sA = cU1 * cU2 * sl / sS; c2A = 1 - sA * sA;
    c2m = c2A ? cS - 2 * sU1 * sU2 / c2A : 0;
    const C = f / 16 * c2A * (4 + f * (4 - 3 * c2A)), prev = lam;
    lam = L + (1 - C) * f * sA * (sig + C * sS * (c2m + C * cS * (-1 + 2 * c2m * c2m)));
    if (Math.abs(lam - prev) < 1e-12) break;
  } while (++it < 200);
  const u2 = c2A * (a * a - b * b) / (b * b), A = 1 + u2 / 16384 * (4096 + u2 * (-768 + u2 * (320 - 175 * u2))), B = u2 / 1024 * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));
  const dS = B * sS * (c2m + B / 4 * (cS * (-1 + 2 * c2m * c2m) - B / 6 * c2m * (-3 + 4 * sS * sS) * (-3 + 4 * c2m * c2m)));
  const sl = Math.sin(lam), cl = Math.cos(lam);
  return { dist: b * A * (sig - dS), az1: norm360(Math.atan2(cU2 * sl, cU1 * sU2 - sU1 * cU2 * cl) * R2D), az2: norm360(Math.atan2(cU1 * sl, -sU1 * cU2 + cU1 * sU2 * cl) * R2D) };
}
// loxodrom trên cầu bán kính trung bình: { dist (m), brg (độ) } — dùng cho hướng đi / quãng đường chặng của tuyến
const RM = 6371008.8;
export function rhumb(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * D2R, p2 = lat2 * D2R, dp = p2 - p1; let dl = (lon2 - lon1) * D2R;
  if (Math.abs(dl) > Math.PI) dl = dl > 0 ? dl - 2 * Math.PI : dl + 2 * Math.PI;
  const dPsi = Math.log(Math.tan(Math.PI / 4 + p2 / 2) / Math.tan(Math.PI / 4 + p1 / 2)), q = Math.abs(dPsi) > 1e-12 ? dp / dPsi : Math.cos(p1);
  return { dist: Math.hypot(dp, q * dl) * RM, brg: norm360(Math.atan2(dl, dPsi) * R2D) };
}
export function rhumbDest(lat, lon, brg, dist) {
  const d = dist / RM, th = brg * D2R, p1 = lat * D2R, dp = d * Math.cos(th); let p2 = p1 + dp;
  if (Math.abs(p2) > Math.PI / 2) p2 = p2 > 0 ? Math.PI - p2 : -Math.PI - p2;
  const dPsi = Math.log(Math.tan(p2 / 2 + Math.PI / 4) / Math.tan(p1 / 2 + Math.PI / 4)), q = Math.abs(dPsi) > 1e-12 ? dp / dPsi : Math.cos(p1);
  return [p2 * R2D, ((lon + d * Math.sin(th) / q * R2D + 540) % 360) - 180];
}
