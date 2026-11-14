// Tiện ích hàng hải: đơn vị khoảng cách, tọa độ, tuyến đi.
import { pxToLL, llToPx, pxToM, mToPx, fmtLL } from './kap.js';

export const NM = 1852;
export const NEAR_M = 0.3 * NM; // dưới 0,3 hải lý thì hiện mét
// khoảng cách: xa → hải lý, gần → mét
export function fmtDist(m) {
  if (!isFinite(m)) return '—';
  if (m < NEAR_M) return Math.round(m) + ' m';
  const nm = m / NM; return (nm >= 10 ? nm.toFixed(1) : nm.toFixed(2)).replace('.', ',') + ' Hl';
}
export const brgDeg = (dx, dy) => { let b = Math.atan2(dx, dy) * 180 / Math.PI; if (b < 0) b += 360; return b; };
export const pad3 = (n) => String(((Math.round(n) % 360) + 360) % 360).padStart(3, '0');

// đọc tọa độ dạng 21°05,123'N · 21 05.123 N · 21-05-07.4N · 21.0852 · -107.5
export function parseCoord(str, isLat) {
  if (str === undefined || str === null) return NaN;
  let s = String(str).trim().toUpperCase().replace(/,/g, '.');
  if (!s) return NaN;
  let sign = 1;
  if (/[SW]/.test(s)) sign = -1;
  if (/^-/.test(s)) sign = -1;
  const nums = s.match(/\d+(?:\.\d+)?/g); if (!nums) return NaN;
  const n = nums.map(Number); let v = n[0];
  if (n.length >= 2) v += n[1] / 60;
  if (n.length >= 3) v += n[2] / 3600;
  v *= sign;
  if (isLat ? Math.abs(v) > 90 : Math.abs(v) > 180) return NaN;
  return v;
}
// cả cặp trong một ô: "21°05,1'N 107°28,4'E"
export function parseLatLon(str) {
  const s = String(str).toUpperCase().replace(/,(?=\d)/g, '.');
  const m = /^(.*?[NS])\s*[,;/ ]?\s*(.*[EW].*)$/.exec(s.trim());
  if (m) return [parseCoord(m[1], true), parseCoord(m[2], false)];
  const p = s.split(/[;/]|\s{2,}|,\s+/); if (p.length === 2) return [parseCoord(p[0], true), parseCoord(p[1], false)];
  const nums = s.match(/-?\d+(?:\.\d+)?/g); if (nums && nums.length === 2) return [+nums[0], +nums[1]];
  return [NaN, NaN];
}
export const llToM = (g, lat, lon) => { const [px, py] = llToPx(g, lat, lon); return pxToM(g, px, py); };
export const mToLL = (g, x, y) => { const [px, py] = mToPx(g, x, y); return pxToLL(g, px, py); };
export const fmtPos = (g, x, y) => fmtLL(...mToLL(g, x, y));
export const fmtLat = (lat) => { const a = Math.abs(lat), d = Math.floor(a), m = (a - d) * 60; return d + '°' + m.toFixed(3).padStart(6, '0').replace('.', ',') + "'" + (lat >= 0 ? 'N' : 'S'); };
export const fmtLon = (lon) => { const a = Math.abs(lon), d = Math.floor(a), m = (a - d) * 60; return String(d).padStart(3, '0') + '°' + m.toFixed(3).padStart(6, '0').replace('.', ',') + "'" + (lon >= 0 ? 'E' : 'W'); };

// các chặng của tuyến
export function legs(pts) {
  const out = []; let tot = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], len = Math.hypot(dx, dy);
    tot += len; out.push({ i, len, crs: brgDeg(dx, dy), tot, tx: len ? dx / len : 0, ty: len ? dy / len : 1 });
  }
  return out;
}
// theo dõi tàu trên tuyến: điểm kế tiếp, độ lệch tuyến, khoảng cách còn lại
export function trackRoute(r, st, x, y, L) {
  const pts = r && r.pts; if (!pts || pts.length < 2) return null;
  const lg = legs(pts);
  const proj = (k) => { const a = pts[k], l = lg[k], ax = x - a[0], ay = y - a[1]; return { along: ax * l.tx + ay * l.ty, xte: ax * l.ty - ay * l.tx }; };
  if (st.key !== r.name + pts.length || st.wp === undefined || st.wp < 1 || st.wp >= pts.length) {
    // chọn chặng gần nhất
    let best = 0, bd = 1e12;
    for (let k = 0; k < lg.length; k++) { const p = proj(k); const out = p.along < 0 ? -p.along : p.along > lg[k].len ? p.along - lg[k].len : 0; const d = Math.hypot(out, p.xte); if (d < bd - 1) { bd = d; best = k; } }
    st.wp = best + 1; st.key = r.name + pts.length;
  }
  // chuyển điểm khi tới gần hoặc đã qua
  for (let guard = 0; guard < pts.length && st.wp < pts.length - 1; guard++) {
    const k = st.wp - 1, p = proj(k), dW = Math.hypot(pts[st.wp][0] - x, pts[st.wp][1] - y);
    if (dW < Math.max(0.1 * NM, 1.2 * (L || 100)) || p.along > lg[k].len) st.wp++; else break;
  }
  const k = st.wp - 1, p = proj(k), w = pts[st.wp];
  const dtg = Math.hypot(w[0] - x, w[1] - y);
  let rest = 0; for (let j = st.wp; j < lg.length; j++) rest += lg[j].len;
  return { wp: st.wp, n: pts.length, legCrs: lg[k].crs, cts: brgDeg(w[0] - x, w[1] - y), dtg, xte: p.xte, total: dtg + rest, last: st.wp === pts.length - 1 };
}
