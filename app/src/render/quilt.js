// Quilting kiểu OpenCPN: chọn các tờ hải đồ cần vẽ cho một khung nhìn.
// Ưu tiên tờ chi tiết nhất; tờ bị các tờ chi tiết hơn che kín thì bỏ; tờ quá chi tiết so với mức zoom (thu nhỏ > under lần) thì bỏ.
import pc from 'polygon-clipping';
import { bboxIntersects, inside } from '../geo/poly.js';

const ringArea = (r) => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return Math.abs(s / 2); };
const mpArea = (mp) => mp.reduce((s, poly) => s + ringArea(poly[0]) - poly.slice(1).reduce((t, h) => t + ringArea(h), 0), 0);

// recs: [{ id, mppMerc, bboxMerc, plyMerc, ready }]; vp: { center:[X,Y], mpp (m Mercator / px), bbox, poly }
// trả về { draw: [tờ thô → tờ chi tiết], ref: tờ chi tiết nhất phủ tâm khung nhìn }
export function selectCharts(recs, vp, opts = {}) {
  const under = opts.under || 8;
  const cand = recs.filter((r) => r.ready !== false && r.bboxMerc && r.plyMerc && bboxIntersects(r.bboxMerc, vp.bbox));
  if (!cand.length) return { draw: [], ref: null };
  let use = cand.filter((r) => vp.mpp / r.mppMerc <= under);
  if (!use.length) use = cand.filter((r) => vp.mpp / r.mppMerc <= under * 8);
  if (!use.length) use = [cand.reduce((a, b) => (a.mppMerc > b.mppMerc ? a : b))];
  use.sort((a, b) => a.mppMerc - b.mppMerc);
  const [cX, cY] = vp.center, K = 1000, loc = (poly) => [poly.map(([X, Y]) => [(X - cX) / K, (Y - cY) / K])];
  const view = loc(vp.poly), minA = ringArea(view[0]) * 1e-3;
  let covered = null; const inc = [];
  for (const r of use) {
    let part; try { part = pc.intersection(loc(r.plyMerc), view); } catch (e) { part = [loc(r.plyMerc)]; }
    if (!part.length || mpArea(part) < minA * 0.01) continue;
    if (covered) { let rest; try { rest = pc.difference(part, covered); } catch (e) { rest = part; } if (!rest.length || mpArea(rest) < minA) continue; }
    inc.push(r);
    try { covered = covered ? pc.union(covered, part) : part; } catch (e) { /* bỏ qua lỗi hình học hiếm gặp */ }
  }
  const ref = inc.find((r) => inside(cX, cY, r.plyMerc)) || inc[0] || null;
  return { draw: inc.slice().reverse(), ref };
}
