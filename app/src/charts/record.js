// Phần phụ thuộc georef của một bản ghi tờ hải đồ (thuần, chạy được trong Node để kiểm thử):
// datum → WGS-84 (datum người dùng chọn > GD trong file > DTM nếu không rõ), khớp đa thức, dời tay, đa giác phủ, hộp bao, tâm.
import { fitGeoref, makeXf } from './georef.js';
import { normalizeDatum, toWGS84, DATUMS } from '../geo/datum.js';
import { llToMerc, mercToLL, mercScale } from '../geo/proj.js';
import { bbox, normalize } from '../geo/poly.js';

// tính phần phụ thuộc georef: datum, hệ số, đa giác phủ, hộp bao, tâm
export function georefRecord(r) {
  const did = r.datumUser || normalizeDatum(r.datumSrc);
  r.datum = did || 'WGS84'; r.datumKnown = !!did;
  r.datumName = did ? DATUMS[did].name : (r.datumSrc ? 'không rõ (' + r.datumSrc + ')' : 'không ghi') + ', coi như WGS-84';
  const conv = (lat, lon) => did && did !== 'WGS84' ? toWGS84(lat, lon, did).slice(0, 2) : (!did && r.dtm ? [lat + r.dtm[0] / 3600, lon + r.dtm[1] / 3600] : [lat, lon]);
  const refs = (r.refs || []).map((q) => { const [lat, lon] = conv(q.lat, q.lon); return { x: q.x, y: q.y, lat, lon }; });
  r.coef = fitGeoref(refs, r.W, r.H);
  if (!r.coef) { r.error = r.error || 'Không đủ điểm tọa độ (REF)'; r.ready = false; return r; }
  const c0 = makeXf(r.coef).pxToLL(r.W / 2, r.H / 2), k = mercScale(c0[0]), off = r.offsetM || [0, 0];
  r.offM = [off[0] * k, off[1] * k];
  r.xf = makeXf(r.coef, r.offM);
  const plyLL = r.plyRaw && r.plyRaw.length >= 3 ? r.plyRaw.map(([a, b]) => conv(a, b)).map(([a, b]) => { const m = llToMerc(a, b); return mercToLL(m[0] + r.offM[0], m[1] + r.offM[1]); })
    : (r.plyPx && r.plyPx.length >= 3 ? r.plyPx : [[0, 0], [r.W, 0], [r.W, r.H], [0, r.H]]).map(([x, y]) => r.xf.pxToLL(x, y));
  r.plyLL = plyLL; r.plyMerc = normalize(plyLL.map(([a, b]) => llToMerc(a, b)));
  r.bboxMerc = bbox(r.plyMerc); r.centerMerc = r.xf.pxToMerc(r.W / 2, r.H / 2); r.mppMerc = r.coef.mpp;
  const ll = r.plyLL.map((p) => p); r.bboxLL = [Math.min(...ll.map((p) => p[0])), Math.max(...ll.map((p) => p[0])), Math.min(...ll.map((p) => p[1])), Math.max(...ll.map((p) => p[1]))];
  r.rmsM = r.coef.rms; r.maxM = r.coef.max; r.pxM = r.coef.mpp / k;
  r.ver = (r.ver || 0) + 1;
  return r;
}
