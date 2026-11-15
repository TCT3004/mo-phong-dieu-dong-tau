// Phép chiếu Mercator trên elipxoit WGS-84 (kiểu EPSG:3395) — bảo giác thật sự trên elipxoit.
// (Mercator cầu kiểu Web Mercator áp lên elipxoit lệch tỷ lệ Bắc–Nam / Đông–Tây ~0,65% ở 21°N, nên không dùng.)
// Dùng chung cho hiển thị hải đồ và "mét thế giới".
export const A = 6378137, F = 1 / 298.257223563, E2 = F * (2 - F), E = Math.sqrt(E2);
export const R = A;
export const D2R = Math.PI / 180, R2D = 180 / Math.PI;
export const MAX_LAT = 85;

// lat/lon (độ) → X, Y (m Mercator, Y hướng Bắc)
export function llToMerc(lat, lon) {
  const p = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * D2R, s = Math.sin(p);
  return [A * lon * D2R, A * Math.log(Math.tan(Math.PI / 4 + p / 2) * Math.pow((1 - E * s) / (1 + E * s), E / 2))];
}
export function mercToLL(X, Y) {
  const t = Math.exp(-Y / A); let p = Math.PI / 2 - 2 * Math.atan(t);
  for (let i = 0; i < 8; i++) { const s = Math.sin(p); p = Math.PI / 2 - 2 * Math.atan(t * Math.pow((1 - E * s) / (1 + E * s), E / 2)); }
  return [p * R2D, X / A * R2D];
}
// hệ số phóng của Mercator tại vĩ độ lat: 1 m thật = mercScale(lat) m Mercator
export function mercScale(lat) { const s = Math.sin(lat * D2R); return Math.sqrt(1 - E2 * s * s) / Math.cos(lat * D2R); }
