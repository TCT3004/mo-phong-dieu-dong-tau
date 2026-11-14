// Vẽ hải đồ raster lên canvas 2D (lấy mẫu trực tiếp từ ảnh chỉ số màu), có xoay và thu phóng.
import { mToPx, pxToM } from './kap.js';
export const NOGEO = { mpp: 2, W: 0, H: 0, ok: false, lon0: 0, dlon: 0, my0: 0, dmy: 0 };
export class ChartView {
  constructor(canvas) { this.cv = canvas; this.ctx = canvas.getContext('2d', { willReadFrequently: false }); this.cx = 0; this.cy = 0; this.sc = 0.2; this.rot = 0; this.chart = null; this.img = null; }
  geo() { return this.chart ? this.chart.geo : NOGEO; }
  fit() { const c = this.chart; if (!c) { this.cx = 0; this.cy = 0; this.sc = 0.5; return; } this.cx = c.W / 2; this.cy = c.H / 2; this.sc = Math.min(this.cv.width / c.W, this.cv.height / c.H); }
  size() { const w = this.cv.clientWidth | 0, h = this.cv.clientHeight | 0; if (w && h && (this.cv.width !== w || this.cv.height !== h)) { this.cv.width = w; this.cv.height = h; this.img = null; } return [this.cv.width, this.cv.height]; }
  p2s(px, py) { const c = Math.cos(this.rot), s = Math.sin(this.rot), dx = px - this.cx, dy = py - this.cy; return [this.cv.width / 2 + (dx * c - dy * s) * this.sc, this.cv.height / 2 + (dx * s + dy * c) * this.sc]; }
  s2p(sx, sy) { const c = Math.cos(this.rot), s = Math.sin(this.rot), dx = (sx - this.cv.width / 2) / this.sc, dy = (sy - this.cv.height / 2) / this.sc; return [this.cx + dx * c + dy * s, this.cy - dx * s + dy * c]; }
  m2s(x, y) { const [px, py] = mToPx(this.geo(), x, y); return this.p2s(px, py); }
  s2m(sx, sy) { const [px, py] = this.s2p(sx, sy); return pxToM(this.geo(), px, py); }
  centerM(x, y) { [this.cx, this.cy] = mToPx(this.geo(), x, y); }
  mPerPx() { return this.geo().mpp / this.sc; }
  draw() {
    const [w, h] = this.size(), ctx = this.ctx, ch = this.chart;
    if (!w || !h) return;
    if (!ch) { ctx.fillStyle = '#cfe6f2'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#a9cadb'; ctx.lineWidth = 1; const stepM = 500, g = stepM / this.mPerPx(); if (g > 8) { const [ox, oy] = this.m2s(0, 0); ctx.beginPath(); for (let x = ((ox % g) + g) % g; x < w; x += g) { ctx.moveTo(x, 0); ctx.lineTo(x, h); } for (let y = ((oy % g) + g) % g; y < h; y += g) { ctx.moveTo(0, y); ctx.lineTo(w, y); } ctx.stroke(); } return; }
    if (!this.img) this.img = ctx.createImageData(w, h);
    const out = new Uint32Array(this.img.data.buffer), idx = ch.idx, pal = ch.pal, W = ch.W, H = ch.H;
    if (!ch.pal32) { ch.pal32 = new Uint32Array(256); for (let i = 0; i < 256; i++) ch.pal32[i] = 0xff000000 | (pal[i * 3 + 2] << 16) | (pal[i * 3 + 1] << 8) | pal[i * 3]; }
    const p32 = ch.pal32, c = Math.cos(this.rot), s = Math.sin(this.rot), inv = 1 / this.sc, ss = inv > 1.4, q = inv / 4, bg = 0xfff2e6cf;
    const ax = c * inv, ay = -s * inv, bx = s * inv, by = c * inv;
    let o = 0;
    for (let y = 0; y < h; y++) {
      const dy = y - h / 2; let px = this.cx + (-w / 2) * ax + dy * bx, py = this.cy + (-w / 2) * ay + dy * by;
      for (let x = 0; x < w; x++, px += ax, py += ay) {
        if (px < 0 || py < 0 || px >= W || py >= H) { out[o++] = bg; continue; }
        if (!ss) { out[o++] = p32[idx[(py | 0) * W + (px | 0)]]; continue; }
        let r = 0, g = 0, b = 0;
        for (let k = 0; k < 4; k++) {
          let xx = px + (k & 1 ? q : -q), yy = py + (k & 2 ? q : -q); if (xx < 0) xx = 0; if (yy < 0) yy = 0; if (xx >= W) xx = W - 1; if (yy >= H) yy = H - 1;
          const i3 = idx[(yy | 0) * W + (xx | 0)] * 3; r += pal[i3]; g += pal[i3 + 1]; b += pal[i3 + 2];
        }
        out[o++] = 0xff000000 | ((b >> 2) << 16) | ((g >> 2) << 8) | (r >> 2);
      }
    }
    ctx.putImageData(this.img, 0, 0);
  }
}
