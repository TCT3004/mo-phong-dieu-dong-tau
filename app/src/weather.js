// Thời tiết ngẫu nhiên chạy theo thời gian của bài tập: nối các kiểu trời (nắng, nhiều mây, mưa, mưa giông, sương mù),
// mỗi kiểu kéo dài một lúc rồi chuyển dần sang kiểu khác (giông kéo tới nhanh, còn lại chuyển từ từ).
// Khả năng chuyển phụ thuộc giờ trong ngày: sương mù hay có lúc sáng sớm, giông hay có buổi chiều.
// Ngày / đêm không do module này quyết định (theo đồng hồ bài tập). Thuần JS, có hạt giống → kiểm thử được trong Node.

// wind: gió trung bình (hl/h) · gust: hệ số giật · vis: tầm nhìn (Hl) · rain, cloud: 0..1 · lam: bước sóng (m) · dur: kéo dài (phút)
export const WX_TYPES = {
  nang: { name: 'Nắng', wind: [4, 12], gust: 1.3, vis: [8, 15], rain: [0, 0], cloud: [0.05, 0.3], lam: [120, 220], dur: [35, 90] },
  may: { name: 'Nhiều mây', wind: [8, 17], gust: 1.35, vis: [5, 10], rain: [0, 0], cloud: [0.55, 0.85], lam: [100, 180], dur: [25, 60] },
  mua: { name: 'Mưa', wind: [10, 20], gust: 1.4, vis: [1.5, 4], rain: [0.35, 0.7], cloud: [0.85, 1], lam: [80, 150], dur: [15, 45] },
  giong: { name: 'Mưa giông', wind: [20, 32], gust: 1.5, vis: [0.3, 1.2], rain: [0.8, 1], cloud: [1, 1], lam: [60, 110], dur: [8, 25], storm: true },
  suong: { name: 'Sương mù', wind: [0, 6], gust: 1.2, vis: [0.1, 0.6], rain: [0, 0], cloud: [0.6, 0.9], lam: [150, 250], dur: [20, 60] }
};
const KEYS = Object.keys(WX_TYPES);

// bộ sinh số ngẫu nhiên có hạt giống (mulberry32)
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// trọng số chuyển kiểu trời theo giờ (h: 0..24)
export function nextWeights(from, h) {
  const morn = h >= 3 && h < 9, aft = h >= 12 && h < 20;
  return {
    nang: { nang: 0.25, may: 0.45, mua: 0.07, giong: aft ? 0.15 : 0.04, suong: morn ? 0.25 : 0.01 },
    may: { nang: 0.3, may: 0.15, mua: 0.33, giong: aft ? 0.25 : 0.08, suong: morn ? 0.12 : 0.01 },
    mua: { nang: 0.12, may: 0.45, mua: 0.2, giong: aft ? 0.25 : 0.1, suong: 0.03 },
    giong: { nang: 0.05, may: 0.35, mua: 0.6, giong: 0, suong: 0 },
    suong: { nang: h >= 8 ? 0.55 : 0.2, may: 0.4, mua: 0.05, giong: 0, suong: h < 8 ? 0.35 : 0.05 }
  }[from];
}
const startWeights = (h) => ({ nang: 0.4, may: 0.3, mua: 0.12, giong: h >= 12 && h < 20 ? 0.1 : 0.03, suong: h >= 3 && h < 9 ? 0.2 : 0.02 });
const wrap360 = (a) => ((a % 360) + 360) % 360;
const dAng = (a, b) => ((b - a + 540) % 360) - 180;
const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
// sóng gió (m) theo gió trung bình (hl/h), vùng ven bờ đà sóng có hạn
export const windSeaH = (kn) => 0.0025 * kn * kn;

export class Weather {
  // seed: số nguyên; daySec: giây trong ngày lúc bắt đầu; start: khóa kiểu trời khởi đầu ('' = để app chọn)
  constructor(seed, daySec, start) {
    this.r = rng(seed); this.t = 0; this.day0 = daySec; this.events = []; this.flashT = -1e9;
    this.swell = { H: 0.2 + 0.4 * this.r(), dir: this.r() * 360 };
    const type = WX_TYPES[start] ? start : this.pick(startWeights(this.hour(0)));
    const v = this.values(type, this.r() * 360);
    this.seg = { type, t0: 0, dur: this.durOf(type), tr: 1, from: v, to: v };
    this.seaH = windSeaH(v.wind); this.seaDir = v.dir; this.waveH = Math.hypot(this.seaH, this.swell.H);
    this.now = null; this.update(0);
  }
  hour(t) { return (((this.day0 + t) / 3600) % 24 + 24) % 24; }
  pick(w) { let s = 0; for (const k of KEYS) s += w[k] || 0; let x = this.r() * s; for (const k of KEYS) { x -= w[k] || 0; if (x <= 0) return k; } return KEYS[0]; }
  range([a, b]) { return a + (b - a) * this.r(); }
  durOf(type) { return this.range(WX_TYPES[type].dur) * 60; }
  // giá trị đích của một kiểu trời; hướng gió đổi so với hướng đang có (giông: gió trở mạnh)
  values(type, dir0) {
    const T = WX_TYPES[type], turn = T.storm ? (this.r() < 0.5 ? -1 : 1) * this.range([40, 90]) : (this.r() - 0.5) * 70;
    return { wind: this.range(T.wind), gust: T.gust, dir: wrap360(dir0 + turn), vis: this.range(T.vis), rain: this.range(T.rain), cloud: this.range(T.cloud), lam: this.range(T.lam), storm: T.storm ? 1 : 0 };
  }
  // giá trị đang có (pha trộn kiểu cũ → kiểu mới)
  blend() {
    const g = this.seg, f = smooth((this.t - g.t0) / g.tr), a = g.from, b = g.to;
    return {
      f, wind: a.wind + (b.wind - a.wind) * f, gust: a.gust + (b.gust - a.gust) * f, dir: wrap360(a.dir + dAng(a.dir, b.dir) * f),
      vis: Math.exp(Math.log(a.vis) + (Math.log(b.vis) - Math.log(a.vis)) * f), rain: a.rain + (b.rain - a.rain) * f, cloud: a.cloud + (b.cloud - a.cloud) * f,
      lam: a.lam + (b.lam - a.lam) * f, storm: a.storm + (b.storm - a.storm) * f
    };
  }
  step(dt) {
    this.t += dt; const g = this.seg;
    if (this.t - g.t0 >= g.dur) { // sang kiểu trời mới
      const cur = this.blend(), type = this.pick(nextWeights(g.type, this.hour(this.t))), to = this.values(type, cur.dir);
      delete cur.f; this.seg = { type, fromType: g.type, t0: this.t, dur: this.durOf(type), tr: (WX_TYPES[type].storm ? this.range([3, 6]) : this.range([8, 15])) * 60, from: cur, to };
    }
    const b = this.blend();
    // sóng gió lớn dần (≈ 15 phút) và lặng dần chậm hơn (≈ 25 phút); hướng sóng theo hướng gió, trễ ≈ 10 phút
    const tgt = windSeaH(b.wind) * (1 + 0.3 * b.storm), tau = (tgt > this.seaH ? 15 : 25) * 60;
    this.seaH += (tgt - this.seaH) * Math.min(1, dt / tau); this.seaDir = wrap360(this.seaDir + dAng(this.seaDir, b.dir) * Math.min(1, dt / 600));
    this.waveH = Math.hypot(this.seaH, this.swell.H);
    // sét trong giông
    if (b.storm > 0.5 && this.r() < dt * b.storm / 25) { const ev = { t: this.t, az: this.r() * 360, dist: 2000 + this.r() * 10000 }; this.events.push(ev); this.lastBolt = ev; this.flashT = this.t; this.flashK = 1 - (ev.dist - 2000) / 14000; }
    this.update(b);
  }
  update(b) {
    b = b || this.blend(); const t = this.t;
    const gk = Math.max(0, b.gust - 1) * b.wind, nz = 0.55 * Math.sin(t / 23 + 1.3) + 0.45 * Math.sin(t / 7.3 + 0.4);
    const wKn = Math.max(0, b.wind + gk * Math.max(0, nz) + b.storm * gk * 0.3 * Math.max(0, Math.sin(t / 3.1))), wDir = wrap360(b.dir + (6 + 10 * b.storm) * Math.sin(t / 61) + 4 * Math.sin(t / 17));
    const sw = this.swell.H ** 2, se = this.seaH ** 2, waveDir = wrap360(this.swell.dir + dAng(this.swell.dir, this.seaDir) * (se / Math.max(1e-6, se + sw)));
    const fl = t - this.flashT, flash = fl < 0.6 ? (this.flashK || 1) * Math.max(0, 1 - fl / 0.6) * (fl < 0.12 || (fl > 0.2 && fl < 0.3) ? 1 : 0.35) : 0;
    const g = this.seg, from = g.fromType && g.fromType !== g.type && b.f < 1 ? WX_TYPES[g.fromType].name : null;
    this.now = { type: g.type, name: WX_TYPES[g.type].name, from, f: b.f,
      wKn, wDir, windMean: b.wind, vis: b.vis * 1852, rain: b.rain * (0.85 + 0.15 * Math.sin(t / 37)), cloud: b.cloud, storm: b.storm, flash,
      bolt: this.lastBolt || null, waveH: this.waveH, waveDir, waveL: b.lam, waveT: Math.sqrt(2 * Math.PI * b.lam / 9.81) };
    return this.now;
  }
  // các tia sét mới từ lần đọc trước (để phát tiếng sấm)
  takeEvents() { const e = this.events; this.events = []; return e; }
}
