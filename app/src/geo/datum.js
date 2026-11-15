// Chuyển datum về WGS-84. Hải đồ Việt Nam dùng VN-2000 (elipxoit WGS-84, khác gốc ≈ 200 m).
// Tham số VN-2000 → WGS-84: EPSG:6960 (= Thông tư 973/2001/TT-TCĐC), phép quay khung tọa độ (EPSG 9607).
export const WGS84 = { a: 6378137, f: 1 / 298.257223563 };
const AS = Math.PI / (180 * 3600);
export const DATUMS = {
  WGS84: { name: 'WGS-84', ell: WGS84, h: null },
  VN2000: { name: 'VN-2000', ell: WGS84, h: { tx: -191.90441429, ty: -39.30318279, tz: -111.45032835, rx: -0.00928836, ry: 0.01975479, rz: -0.00427372, ds: 0.252906278, conv: 'cf' }, src: 'EPSG:6960, TT 973/2001/TT-TCĐC' }
};
// nhận tên datum ghi trong hải đồ (GD=WGS_84, WGS84, WGE, VN-2000, VN2000…) → mã nội bộ, hoặc null nếu chưa biết
export function normalizeDatum(s) {
  const t = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!t) return null;
  if (t === 'WGS84' || t === 'WGE' || t === 'WGS1984' || t === 'WORLDGEODETICSYSTEM1984') return 'WGS84';
  if (t === 'VN2000' || t === 'VIETNAM2000' || t === 'VN2K') return 'VN2000';
  return null;
}
export function geoToEcef(lat, lon, h, ell = WGS84) {
  const e2 = ell.f * (2 - ell.f), p = lat * Math.PI / 180, l = lon * Math.PI / 180, s = Math.sin(p), N = ell.a / Math.sqrt(1 - e2 * s * s);
  return [(N + h) * Math.cos(p) * Math.cos(l), (N + h) * Math.cos(p) * Math.sin(l), (N * (1 - e2) + h) * s];
}
export function ecefToGeo(X, Y, Z, ell = WGS84) {
  const e2 = ell.f * (2 - ell.f), p = Math.hypot(X, Y), lon = Math.atan2(Y, X);
  let lat = Math.atan2(Z, p * (1 - e2)), h = 0;
  for (let i = 0; i < 6; i++) { const s = Math.sin(lat), N = ell.a / Math.sqrt(1 - e2 * s * s); h = p / Math.cos(lat) - N; lat = Math.atan2(Z, p * (1 - e2 * N / (N + h))); }
  return [lat * 180 / Math.PI, lon * 180 / Math.PI, h];
}
function helmert(P, h, inv) {
  const m = 1 + h.ds * 1e-6, rx = h.rx * AS, ry = h.ry * AS, rz = h.rz * AS;
  // quay khung tọa độ (coordinate frame): [1 rz −ry; −rz 1 rx; ry −rx 1]
  if (!inv) { const [x, y, z] = P; return [m * (x + rz * y - ry * z) + h.tx, m * (-rz * x + y + rx * z) + h.ty, m * (ry * x - rx * y + z) + h.tz]; }
  // nghịch đảo: ma trận quay vi phân trực giao → chuyển vị
  const x = (P[0] - h.tx) / m, y = (P[1] - h.ty) / m, z = (P[2] - h.tz) / m;
  return [x - rz * y + ry * z, rz * x + y - rx * z, -ry * x + rx * y + z];
}
// (lat, lon) theo datum id → WGS-84; datum chưa biết thì giữ nguyên
export function toWGS84(lat, lon, id, h = 0) {
  const d = DATUMS[id]; if (!d || !d.h) return [lat, lon, h];
  const P = helmert(geoToEcef(lat, lon, h, d.ell), d.h, false); return ecefToGeo(P[0], P[1], P[2], WGS84);
}
export function fromWGS84(lat, lon, id, h = 0) {
  const d = DATUMS[id]; if (!d || !d.h) return [lat, lon, h];
  const P = helmert(geoToEcef(lat, lon, h, WGS84), d.h, true); return ecefToGeo(P[0], P[1], P[2], d.ell);
}
