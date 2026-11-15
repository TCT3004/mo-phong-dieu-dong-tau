// Radar mô phỏng: quét tia từ lưới hải đồ (bờ, bãi cạn), cầu bến, đèn/phao; có vòng cự ly, EBL/VRM.
import { NM, fmtDist, pad3, brgDeg } from './nav.js';

export const RANGES = [0.25, 0.5, 0.75, 1.5, 3, 6, 12, 24];
const RINGS = { 0.25: 0.05, 0.5: 0.1, 0.75: 0.25, 1.5: 0.25, 3: 0.5, 6: 1, 12: 2, 24: 4 };
const NB = 1024, NR = 300;
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export class Radar {
  constructor(cv) {
    this.cv = cv; this.g = cv.getContext('2d');
    this.buf = new Uint8Array(NB * NR); this.age = new Float32Array(NB);
    this.sweep = 0; this.acc = 0; this.ri = 3; this.mode = 'H'; this.mark = null; this.lut = null; this.img = null; this.size = 0;
  }
  get range() { return RANGES[this.ri]; }
  setRange(i) { this.ri = Math.max(0, Math.min(RANGES.length - 1, i)); this.buf.fill(0); }
  // quét thêm các tia trong khoảng dt (giây thực); anten 24 v/ph
  step(dt, W, S, waveH) {
    this.acc += dt * 0.4 * NB; let n = Math.floor(this.acc); this.acc -= n; if (n > NB / 4) n = NB / 4;
    const rM = this.range * NM, dr = rM / NR, segs = W.segs || [], pts = (W.objs && W.objs.lights) || [];
    const clutter = Math.min(0.5, (waveH || 0) * 0.18);
    for (let k = 0; k < n; k++) {
      const b = this.sweep, a = b / NB * 2 * Math.PI, sx = Math.sin(a), sy = Math.cos(a), row = b * NR;
      let run = 0;
      for (let j = 0; j < NR; j++) {
        const d = (j + 0.5) * dr, x = S.x + sx * d, y = S.y + sy * d, c = W.classAt(x, y);
        let v = 0;
        if (c === 0) { run += dr; v = run < Math.max(240, 2.5 * dr) ? 255 : (hash(Math.floor(x / 45), Math.floor(y / 45)) < Math.max(0.015, 0.1 - run / 8000) ? 160 : 0); }
        else { run = 0; if (c === 1 && hash(Math.floor(x / 30), Math.floor(y / 30)) < 0.35) v = 110; }
        if (clutter && d < 700 && Math.random() < clutter * Math.exp(-d / 220)) v = Math.max(v, 120);
        if (Math.random() < 0.0007) v = Math.max(v, 60);
        this.buf[row + j] = v;
      }
      for (let j = NR - 1; j > 0; j--) if (this.buf[row + j - 1] > this.buf[row + j]) this.buf[row + j] = Math.max(this.buf[row + j], this.buf[row + j - 1] * 0.85);
      // cầu bến: giao tia với đoạn thẳng
      for (const s of segs) {
        const ex = s.bx - s.ax, ey = s.by - s.ay, den = sx * ey - sy * ex; if (Math.abs(den) < 1e-9) continue;
        const qx = s.ax - S.x, qy = s.ay - S.y, t = (qx * ey - qy * ex) / den, u = (qx * sy - qy * sx) / den;
        if (t > 0 && t < rM && u >= 0 && u <= 1) { const j = Math.floor(t / dr); for (let q = j; q < Math.min(NR, j + 2); q++) this.buf[row + q] = 255; }
      }
      // đèn, phao: mục tiêu điểm (búp sóng ~1,2°)
      for (const o of pts) {
        const dx = o.x - S.x, dy = o.y - S.y, d = Math.hypot(dx, dy); if (d > rM || d < 5) continue;
        let da = Math.abs(Math.atan2(dx, dy) - a); if (da > Math.PI) da = 2 * Math.PI - da;
        if (da * 180 / Math.PI < 0.6 + 8 / Math.max(d, 1)) { const j = Math.floor(d / dr); const w = o.kind === 'light' ? 2 : 1; for (let q = j; q < Math.min(NR, j + w); q++) this.buf[row + q] = 240; }
      }
      this.age[b] = performance.now();
      this.sweep = (b + 1) % NB;
    }
  }
  buildLut(N) {
    const R = N / 2 - 14, ab = new Uint16Array(N * N), rj = new Uint16Array(N * N), inn = new Uint8Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x - N / 2 + 0.5, dy = N / 2 - y - 0.5, r = Math.hypot(dx, dy), i = y * N + x;
      if (r >= R) continue; inn[i] = 1;
      let a = Math.atan2(dx, dy); if (a < 0) a += 2 * Math.PI;
      ab[i] = Math.floor(a / (2 * Math.PI) * NB) % NB; rj[i] = Math.min(NR - 1, Math.floor(r / R * NR));
    }
    this.lut = { ab, rj, inn, R, N }; this.img = this.g.createImageData(N, N);
  }
  draw(S, route, wpIdx) {
    const cv = this.cv, w = cv.clientWidth | 0, h = cv.clientHeight | 0; if (!w || !h) return;
    const N = Math.max(120, Math.min(w, h)); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    if (!this.lut || this.lut.N !== N) this.buildLut(N);
    const g = this.g, L = this.lut, out = new Uint32Array(this.img.data.buffer), hdgB = this.mode === 'H' ? Math.round(S.psi / (2 * Math.PI) * NB) : 0;
    const now = performance.now(), per = 1000 / 0.4;
    const fade = new Float32Array(NB); for (let b = 0; b < NB; b++) fade[b] = Math.max(0.62, 1 - 0.38 * Math.min(1, (now - this.age[b]) / per));
    const bg = 0xff2a1206; // ABGR: nền xanh đêm
    for (let i = 0; i < out.length; i++) {
      if (!L.inn[i]) { out[i] = 0; continue; }
      const b = (L.ab[i] + hdgB + NB) % NB, j = L.rj[i], v0 = this.buf[b * NR + j], v = Math.max(v0, this.buf[((b + 1) % NB) * NR + j] * 0.9, this.buf[((b + NB - 1) % NB) * NR + j] * 0.9);
      if (!v) { out[i] = bg; continue; }
      const k = Math.min(1, (0.45 + 0.55 * v / 255) * fade[b]), r = 255 * k, gg = 40 + 200 * k, bb = 10 + 30 * k;
      out[i] = 0xff000000 | (bb << 16) | (gg << 8) | (r | 0);
    }
    const ox = (w - N) / 2, oy = (h - N) / 2, cx = ox + N / 2, cy = oy + N / 2, R = L.R;
    g.clearRect(0, 0, w, h); g.putImageData(this.img, ox | 0, oy | 0);
    const rot = this.mode === 'H' ? -S.psi : 0, rM = this.range * NM, k = R / rM;
    const cr = Math.cos(rot), sr = Math.sin(rot), toS = (x, y) => { const dx = (x - S.x) * k, dy = (y - S.y) * k; return [cx + dx * cr + dy * sr, cy - (dy * cr - dx * sr)]; };
    g.save();
    // vòng cự ly
    g.strokeStyle = 'rgba(110,160,210,.45)'; g.lineWidth = 1; const ring = RINGS[this.range];
    for (let r = ring; r < this.range + 1e-6; r += ring) { g.beginPath(); g.arc(cx, cy, r * NM * k, 0, 7); g.stroke(); }
    // thang phương vị
    g.strokeStyle = 'rgba(160,190,220,.7)'; g.fillStyle = '#9FB8CF'; g.font = '9px Consolas'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let d = 0; d < 360; d += 5) { const a = d * Math.PI / 180 + rot, s = Math.sin(a), c = Math.cos(a), l = d % 30 === 0 ? 7 : d % 10 === 0 ? 5 : 2.5; g.beginPath(); g.moveTo(cx + s * R, cy - c * R); g.lineTo(cx + s * (R + l), cy - c * (R + l)); g.stroke(); if (d % 30 === 0) g.fillText(pad3(d), cx + s * (R + 11), cy - c * (R + 11)); }
    // đường mũi tàu
    const ha = S.psi + rot; g.strokeStyle = '#E8F0F6'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(ha) * R, cy - Math.cos(ha) * R); g.stroke();
    // tia quét
    const sa = this.sweep / NB * 2 * Math.PI + rot; g.strokeStyle = 'rgba(255,220,120,.35)'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(sa) * R, cy - Math.cos(sa) * R); g.stroke();
    // tàu mình
    g.strokeStyle = '#E8F0F6'; g.lineWidth = 1; const shp = Math.max(4, 60 * k); g.translate(cx, cy); g.rotate(ha); g.beginPath(); g.moveTo(0, -shp); g.lineTo(shp * 0.25, -shp * 0.5); g.lineTo(shp * 0.25, shp * 0.5); g.lineTo(-shp * 0.25, shp * 0.5); g.lineTo(-shp * 0.25, -shp * 0.5); g.closePath(); g.stroke(); g.setTransform(1, 0, 0, 1, 0, 0);
    // EBL / VRM
    if (this.mark) {
      const m = this.mark, d = Math.hypot(m.x - S.x, m.y - S.y), b = brgDeg(m.x - S.x, m.y - S.y), a = b * Math.PI / 180 + rot;
      g.strokeStyle = '#7CF29A'; g.setLineDash([6, 4]); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(a) * R, cy - Math.cos(a) * R); g.stroke();
      if (d < rM) { g.beginPath(); g.arc(cx, cy, d * k, 0, 7); g.stroke(); }
      g.setLineDash([]); m.d = d; m.b = b;
    }
    g.restore();
  }
  // điểm bấm trên màn → tọa độ thật
  pick(sx, sy, S) {
    const w = this.cv.width, h = this.cv.height, cx = w / 2, cy = h / 2, R = this.lut ? this.lut.R : Math.min(w, h) / 2 - 14, k = R / (this.range * NM);
    const rot = this.mode === 'H' ? -S.psi : 0, X = (sx - cx) / k, Y = (cy - sy) / k, c = Math.cos(rot), s = Math.sin(rot);
    return { x: S.x + X * c - Y * s, y: S.y + X * s + Y * c };
  }
}
export { fmtDist };
