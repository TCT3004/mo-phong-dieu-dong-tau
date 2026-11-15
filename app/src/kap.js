// Georef tuyến tính của bản v0.1 (mét cục bộ của tờ: gốc ở tâm tờ). Chỉ còn dùng để chuyển dữ liệu cũ
// (đối tượng `mp_objs:<tên tờ>`, bài ghi) sang lat/lon; đọc hải đồ mới ở charts/bsb.js + charts/georef.js. Kèm fmtLL.
import { normalizeDatum, toWGS84, DATUMS } from './geo/datum.js';

const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
const invMerc = (y) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI;
function fit(xs, ys) {
  const n = xs.length; let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; }
  const b = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1); return [(sy - b * sx) / n, b];
}

export function makeGeo(H) {
  const g = { ok: H.refs.length >= 2 }, did = normalizeDatum(H.datum);
  g.datum = did || 'WGS84'; g.datumKnown = !!did; g.datumName = did ? DATUMS[did].name : (H.datum ? 'không rõ (' + H.datum + ')' : 'không ghi') + ', coi như WGS-84';
  const refs = did && did !== 'WGS84' ? H.refs.map((r) => { const [lat, lon] = toWGS84(r.lat, r.lon, did); return { x: r.x, y: r.y, lat, lon }; }) : H.refs;
  if (g.ok) {
    [g.lon0, g.dlon] = fit(refs.map((r) => r.x), refs.map((r) => r.lon));
    [g.my0, g.dmy] = fit(refs.map((r) => r.y), refs.map((r) => mercY(r.lat)));
    if (!g.dlon || !g.dmy) g.ok = false;
  }
  if (!g.ok) { g.lon0 = 0; g.dlon = 1e-5; g.my0 = 0; g.dmy = -1.7e-7; }
  const latMid = invMerc(g.my0 + g.dmy * H.H / 2);
  g.mpp = 6371000 * Math.cos(latMid * Math.PI / 180) * Math.abs(g.dlon) * Math.PI / 180; // mét / pixel
  g.W = H.W; g.H = H.H;
  return g;
}
// pixel hải đồ <-> mét (x Đông, y Bắc, gốc ở giữa hải đồ) <-> kinh vĩ
export const pxToM = (g, px, py) => [(px - g.W / 2) * g.mpp, -(py - g.H / 2) * g.mpp];
export const mToPx = (g, x, y) => [x / g.mpp + g.W / 2, -y / g.mpp + g.H / 2];
export const pxToLL = (g, px, py) => [invMerc(g.my0 + g.dmy * py), g.lon0 + g.dlon * px];
export const llToPx = (g, lat, lon) => [(lon - g.lon0) / g.dlon, (mercY(lat) - g.my0) / g.dmy];
export function fmtLL(lat, lon) {
  const f = (v, p, n) => { const a = Math.abs(v), d = Math.floor(a), m = (a - d) * 60; return d + '°' + m.toFixed(2).padStart(5, '0').replace('.', ',') + "'" + (v >= 0 ? p : n); };
  return f(lat, 'N', 'S') + ' ' + f(lon, 'E', 'W');
}
