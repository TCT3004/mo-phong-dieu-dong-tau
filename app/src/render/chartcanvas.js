// Khung nhìn hải đồ trên một canvas 2D (tab 2, hải đồ nhỏ tab 3, xem lại tab 5).
// Tọa độ ngoài = "mét thế giới" (x Đông, y Bắc); bên trong đổi sang Mercator cho renderer. Giữ API gần giống ChartView cũ.
import { CS, chartGL } from '../chartsys.js';
import { selectCharts } from './quilt.js';
import { mercToLL, llToMerc } from '../geo/proj.js';

export class ChartCanvas {
  constructor(canvas, opt = {}) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.cx = 0; this.cy = 0; this.mpp = 20; this.rot = 0;
    this.opt = Object.assign({ graticule: false, outlines: false, palette: 'day' }, opt); this.ref = null; this.drawn = []; this.dirty = true; CS.views.add(this);
  }
  size() { const w = this.cv.clientWidth | 0, h = this.cv.clientHeight | 0; if (w && h && (this.cv.width !== w || this.cv.height !== h)) { this.cv.width = w; this.cv.height = h; } return [this.cv.width, this.cv.height]; }
  m2s(x, y) { const ux = (x - this.cx) / this.mpp, uy = -(y - this.cy) / this.mpp, c = Math.cos(this.rot), s = Math.sin(this.rot); return [this.cv.width / 2 + ux * c - uy * s, this.cv.height / 2 + ux * s + uy * c]; }
  s2m(sx, sy) { const dx = sx - this.cv.width / 2, dy = sy - this.cv.height / 2, c = Math.cos(this.rot), s = Math.sin(this.rot), ux = dx * c + dy * s, uy = -dx * s + dy * c; return [this.cx + ux * this.mpp, this.cy - uy * this.mpp]; }
  centerM(x, y) { this.cx = x; this.cy = y; }
  mPerPx() { return this.mpp; }
  setMpp(m) { this.mpp = Math.max(0.05, Math.min(5000, m)); }
  zoomAt(sx, sy, k) { const a = this.s2m(sx, sy); this.setMpp(this.mpp / k); const b = this.s2m(sx, sy); this.cx += a[0] - b[0]; this.cy += a[1] - b[1]; }
  panPx(dx, dy) { const a = this.s2m(0, 0), b = this.s2m(dx, dy); this.cx -= b[0] - a[0]; this.cy -= b[1] - a[1]; }
  fitWorld(x0, y0, x1, y1) { const [w, h] = this.size(); this.cx = (x0 + x1) / 2; this.cy = (y0 + y1) / 2; this.setMpp(Math.max((x1 - x0) / Math.max(1, w), (y1 - y0) / Math.max(1, h)) * 1.05); }
  fitChart(r) { const f = CS.frame, p = r.plyLL.map(([a, b]) => f.toWorld(a, b)), xs = p.map((q) => q[0]), ys = p.map((q) => q[1]); this.fitWorld(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)); }
  toLL(sx, sy) { return CS.frame.toLL(...this.s2m(sx, sy)); }
  vpMerc() {
    const f = CS.frame, [w, h] = [this.cv.width, this.cv.height], [cX, cY] = f.worldToMerc(this.cx, this.cy), mpp = this.mpp / f.k;
    const poly = [[0, 0], [w, 0], [w, h], [0, h]].map(([sx, sy]) => f.worldToMerc(...this.s2m(sx, sy)));
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    return { cX, cY, center: [cX, cY], mpp, rot: this.rot, w, h, poly, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
  }
  draw() {
    const [w, h] = this.size(), g = this.ctx; if (!w || !h) return; this.dirty = false;
    const vp = this.vpMerc(), sel = selectCharts(CS.catalog.records, vp, { under: CS.under }); this.ref = sel.ref; this.drawn = sel.draw;
    const gl = chartGL(); g.setTransform(1, 0, 0, 1, 0, 0);
    if (gl) { const o = gl.render(vp, sel.draw, { palette: this.opt.palette, bg: this.opt.palette === 'night' ? [0.06, 0.09, 0.12] : this.opt.palette === 'dusk' ? [0.45, 0.52, 0.58] : [0.82, 0.9, 0.94] }); g.drawImage(o.canvas, 0, o.canvas.height - o.h, o.w, o.h, 0, 0, w, h); }
    else { g.fillStyle = '#cfe6f2'; g.fillRect(0, 0, w, h); }
    if (this.opt.graticule) this.drawGraticule();
    if (this.opt.outlines) this.drawOutlines();
  }
  // lưới kinh vĩ độ tính từ phép chiếu (đối chiếu với lưới in trên hải đồ để kiểm tra georef)
  drawGraticule() {
    const g = this.ctx, [w, h] = [this.cv.width, this.cv.height], ll = [[0, 0], [w, 0], [w, h], [0, h]].map(([a, b]) => this.toLL(a, b));
    const la0 = Math.min(...ll.map((p) => p[0])), la1 = Math.max(...ll.map((p) => p[0])), lo0 = Math.min(...ll.map((p) => p[1])), lo1 = Math.max(...ll.map((p) => p[1]));
    const span = Math.max(la1 - la0, lo1 - lo0) * 60, steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600], st = (steps.find((s) => span / s <= 12) || 600) / 60;
    g.save(); g.strokeStyle = 'rgba(200,30,120,.75)'; g.lineWidth = 1; g.fillStyle = 'rgba(200,30,120,.9)'; g.font = '10px Consolas'; g.setLineDash([6, 4]);
    const f = CS.frame, line = (pts) => { g.beginPath(); pts.forEach(([a, b], i) => { const s = this.m2s(...f.toWorld(a, b)); if (i) g.lineTo(s[0], s[1]); else g.moveTo(s[0], s[1]); }); g.stroke(); };
    const fm = (v, p, n) => { const a = Math.abs(v), d = Math.floor(a + 1e-9), m = Math.round((a - d) * 60 * 10) / 10; return d + '°' + (m ? m + "'" : '') + (v >= 0 ? p : n); };
    for (let a = Math.ceil(la0 / st) * st; a <= la1; a += st) { const pts = []; for (let k = 0; k <= 8; k++) pts.push([a, lo0 + (lo1 - lo0) * k / 8]); line(pts); const s = this.m2s(...f.toWorld(a, lo0 + (lo1 - lo0) * 0.02)); g.fillText(fm(a, 'N', 'S'), Math.max(2, s[0]), s[1] - 3); }
    for (let b = Math.ceil(lo0 / st) * st; b <= lo1; b += st) { const pts = []; for (let k = 0; k <= 8; k++) pts.push([la0 + (la1 - la0) * k / 8, b]); line(pts); const s = this.m2s(...f.toWorld(la0 + (la1 - la0) * 0.03, b)); g.fillText(fm(b, 'E', 'W'), s[0] + 3, Math.min(h - 3, s[1])); }
    g.restore();
  }
  drawOutlines() {
    const g = this.ctx, f = CS.frame; g.save(); g.font = 'bold 11px Segoe UI';
    for (const r of this.drawn) {
      g.strokeStyle = r === this.ref ? 'rgba(13,71,161,.95)' : 'rgba(194,24,91,.8)'; g.lineWidth = 2; g.setLineDash(r === this.ref ? [] : [7, 4]); g.beginPath();
      r.plyLL.forEach(([a, b], i) => { const s = this.m2s(...f.toWorld(a, b)); if (i) g.lineTo(s[0], s[1]); else g.moveTo(s[0], s[1]); }); g.closePath(); g.stroke();
      const s = this.m2s(...f.toWorld(r.plyLL[0][0], r.plyLL[0][1])), t = r.name + ' · 1:' + r.scale, tw = g.measureText(t).width; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(s[0] + 2, s[1] + 2, tw + 6, 15); g.fillStyle = r === this.ref ? '#0D47A1' : '#AD1457'; g.fillText(t, s[0] + 5, s[1] + 13);
    }
    g.restore();
  }
}
export { mercToLL, llToMerc };
