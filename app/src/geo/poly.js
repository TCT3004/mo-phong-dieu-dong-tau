// Tiện ích đa giác (mảng điểm [x, y]): hộp bao, diện tích có dấu, điểm trong đa giác, giao hộp bao.
export function bbox(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}
export const bboxIntersects = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
export const bboxContains = (a, b) => a[0] <= b[0] && a[1] <= b[1] && a[2] >= b[2] && a[3] >= b[3];
// diện tích có dấu (dương = ngược chiều kim đồng hồ khi y hướng lên)
export function area(pts) { let s = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) s += (pts[j][0] - pts[i][0]) * (pts[j][1] + pts[i][1]); return s / 2; }
export function inside(x, y, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; }
  return c;
}
// bỏ điểm trùng liên tiếp và điểm cuối trùng điểm đầu; đảo về ngược chiều kim đồng hồ
export function normalize(pts, eps = 1e-9) {
  const out = []; for (const p of pts) { const q = out[out.length - 1]; if (!q || Math.abs(q[0] - p[0]) > eps || Math.abs(q[1] - p[1]) > eps) out.push([p[0], p[1]]); }
  if (out.length > 1) { const a = out[0], b = out[out.length - 1]; if (Math.abs(a[0] - b[0]) <= eps && Math.abs(a[1] - b[1]) <= eps) out.pop(); }
  if (area(out) < 0) out.reverse();
  return out;
}
