// Kho tàu: các tàu mẫu chung chung có sẵn (tự dựng, không theo tàu thật nào) + tàu người dùng lưu vào kho (IndexedDB `mp_fleet`).
// Mỗi tàu trong kho = trọn bộ thông số tab 1 (kể cả mô hình vẽ, không kèm ảnh sơ đồ) → nạp làm tàu mình điều động,
// hoặc đặt làm tàu đậu ở cảng (tab 2).
import { defaultShip } from './physics.js';
import { genModel } from './shipdraw/shipgen.js';
import { makeTemplate, TEMPLATE_SHIP } from './shipdraw/template.js';

export const SHIP_TYPES = ['Tàu hàng', 'Tàu dầu', 'Tàu khách', 'Tàu pháo', 'Tàu tên lửa', 'Tàu phóng lôi', 'Tàu tuần tra', 'Tàu hộ vệ', 'Tàu đổ bộ', 'Tàu hậu cần', 'Tàu lai', 'Khác'];

// thông số tab 1 từ vài số chính: tốc độ max (hl/h), vòng quay máy max, hộp số…; còn lại lấy theo tàu mẫu mặc định
function params(o) {
  const d = defaultShip(), v = o.vmax, rpm = o.rpm, f = [1, 0.8, 0.6, 0.4], kn = (k) => Math.round(v * k * 10) / 10;
  const p = Object.assign(d, {
    lpp: Math.round(o.loa * 0.93 * 10) / 10, steps: [
      { id: 'f4', label: 'Tiến max', rpm, kn: kn(f[0]), knB: kn(f[0] * 1.04) }, { id: 'f3', label: 'Tiến 3', rpm: Math.round(rpm * f[1]), kn: kn(f[1]), knB: kn(f[1] * 1.04) },
      { id: 'f2', label: 'Tiến 2', rpm: Math.round(rpm * f[2]), kn: kn(f[2]), knB: kn(f[2] * 1.04) }, { id: 'f1', label: 'Tiến 1', rpm: Math.round(rpm * f[3]), kn: kn(f[3]), knB: kn(f[3] * 1.04) },
      { id: 'a1', label: 'Lùi 1', rpm: -Math.round(rpm * 0.45), kn: 0, knB: 0 }, { id: 'a2', label: 'Lùi 2', rpm: -Math.round(rpm * 0.75), kn: 0, knB: 0 }]
  }, o);
  delete p.vmax; p.props = p.engines; p.rot = Array.from({ length: p.engines }, () => ''); delete p.rotDir; // chiều quay chân vịt: người dùng tự chọn
  if (o.T !== undefined) { p.tf = o.tf !== undefined ? o.tf : Math.round((o.T - 0.05) * 100) / 100; p.ta = o.ta !== undefined ? o.ta : Math.round((o.T + 0.05) * 100) / 100; } delete p.T;
  p.disp = Math.round(p.cb * p.lpp * p.B * (p.tf + p.ta) / 2 * 1.025);
  return p;
}
const C = (hull, sup, deck, boot) => ({ hull, super: sup, deck, boot });

// ---------- các mẫu (mét; x về mũi từ giữa chiều dài, z từ đáy ky) ----------
const TPL = [
  { id: 'hang50', type: 'Tàu hàng', name: 'Tàu hàng nhỏ 50 m (mẫu)', spec: {
    L: 50, B: 9.2, D: 4.2, T: 3.3, H: 17, bow: 'raked', rake: 3, stern: 'cruiser', shA: 0.3, shF: 0.8, fc: { x0: 19, h: 1.8 }, poop: { x1: -12, h: 1.2 }, par: [-12, 10], ts: 0.62, bp: 1.8, sec: 'box', br: 0.9,
    opts: { colors: C('#2b4a6b', '#eeeeea', '#8a3d2f', '#8b2a22') },
    build: ({ deck }) => { const z1 = deck(-20), t1 = z1 + 2.6, t2 = t1 + 2.5, br = t2 + 2.5, d = deck; return {
      blocks: [{ k: 't1', x0: -24, x1: -12.6, h: 2.6, w: 7.2, fw: 1.2, win: true }, { k: 't2', x0: -22.5, x1: -14, h: 2.5, w: 7.4, win: true }, { k: 'bridge', x0: -21, x1: -14.8, h: 2.5, w: 8.6, sl: 0.45 },
        { k: 'funnel', x0: -24, x1: -22.6, z0: t1, h: 4, w: 1.6, sl: 0.5, sa: -0.5 }],
      wings: { x0: -16.6, x1: -15, z: t2, span: 4.7, w: 4.3 }, masts: [{ id: 'chinh', x: -18.5, z0: br, h: 4.5, yard: 3.2, radar: 2.2 }, { id: 'truoc', x: 21.5, z0: d(21.5), h: 6.5, yard: 4.6 }],
      anchors: [22.6, d(22.6) - 1.6], winch: [20.4, 21.8],
      lights: { mast1: [21.5, d(21.5) + 6.6], mast2: [-18.5, br + 4.6], side: [-15.2, t2 + 1], stern: [-24.7, d(-24.7) + 1.2], anchF: [23.6, d(23.6) + 3.4], anchA: [-24, t1 + 1.4], nuc: [-18.5, br + 3] }, eye: [-16, t2 + 1.7],
      fits: [['hatch', -2.8, 0, d(-2.8), { l: 10, w: 6.6, h: 1.3 }], ['hatch', 10.6, 0, d(10.6), { l: 12, w: 6.6, h: 1.3 }], ['crane', 3.4, 0, d(3.4), { l: 11, w: 1.8, h: 4.2, el: 15, rot: 180 }],
        ...[-1, 1].flatMap((s) => [['bollard', 16.5, s * 3.7, d(16.5), {}], ['bollard', -10.5, s * 3.8, d(-10.5), {}], ['bollard', 22, s * 2.3, d(22), {}], ['bollard', -23.2, s * 2.9, d(-23.2), {}],
          ['raft', -20.5, s * 3.2, t2, {}], ['searchlight', -15.4, s * 1.6, br, {}], ['whip', -20.2, s * 2, br, { h: 4 }]]),
        ['boat', -19, 3.4, t1, { l: 4.2, w: 1.7, h: 1.3 }], ['raft', -19, -3.4, t1, {}], ['horn', -17.5, 0.6, br, {}]] }; } },
    ship: { loa: 50, B: 9.2, D: 4.2, T: 3.3, cb: 0.74, engines: 1, ptype: 'fpp', vmax: 10.5, rpm: 750, gear: 2, accTime: 40, propD: 2.2, PD: 0.7, AR: 2.5, hR: 2.0, rudders: 1, rudMax: 35, rudTime: 28, respTime: 6, turnDia: 150, bowAnchors: 2, sternAnchors: 0, chainLen: 192, anchorW: 0.9, chainW: 18, lineR: 14, lineLen: 150, windAL: 330, windAF: 95, windXc: -3, flags: 'vn' } },

  { id: 'hang90', type: 'Tàu hàng', name: 'Tàu hàng tổng hợp 90 m, có cẩu (mẫu)', spec: {
    L: 90, B: 15.2, D: 7.6, T: 6.0, H: 30, bow: 'bulb', rake: 4.5, stern: 'cruiser', shA: 0.5, shF: 1.4, fc: { x0: 34, h: 2.4 }, par: [-22, 18], ts: 0.58, bp: 1.9, sec: 'box', br: 1.2,
    opts: { colors: C('#1f2a33', '#f2f2ef', '#7d3b2c', '#8b2a22') },
    build: ({ deck: d }) => { const z1 = d(-34), t1 = z1 + 2.8, t2 = t1 + 2.7, t3 = t2 + 2.7, br = t3 + 2.7; return {
      blocks: [{ k: 't1', x0: -42, x1: -26, h: 2.8, w: 11, fw: 1.3, win: true }, { k: 't2', x0: -38.5, x1: -27, h: 2.7, w: 12.4, fw: 1.1, win: true }, { k: 't3', x0: -37.5, x1: -28, h: 2.7, w: 12.6, win: true },
        { k: 'bridge', x0: -36.5, x1: -28.4, h: 2.7, w: 14, sl: 0.5 }, { k: 'funnel', x0: -41.6, x1: -39, z0: t1, h: 7, w: 3, sl: 0.8, sa: -0.8 }],
      wings: { x0: -31.5, x1: -28.6, z: t3, span: 7.6, w: 7 }, masts: [{ id: 'chinh', x: -33, z0: br, h: 6, yard: 4.4, radar: 3, rl: 3 }, { id: 'truoc', x: 40, z0: d(40), h: 9, yard: 6.5 }],
      anchors: [41, d(41) - 2.6], winch: [37.2, 39.2],
      lights: { mast1: [40, d(40) + 9.1], mast2: [-33, br + 6.1], side: [-28.8, t3 + 1], stern: [-44.6, d(-44.6) + 1.5], anchF: [43.4, d(43.4) + 4], anchA: [-44, d(-44) + 4], nuc: [-33, br + 4.8] }, eye: [-29.6, t3 + 1.7],
      fits: [['hatch', -15, 0, d(-15), { l: 15, w: 11.4, h: 1.9 }], ['hatch', 3.5, 0, d(3.5), { l: 16, w: 11.4, h: 1.9 }], ['hatch', 22.5, 0, d(22.5), { l: 15, w: 11, h: 1.9 }],
        ['crane', -5.2, 0, d(-5.2), { l: 19, w: 3, h: 8, el: 22, rot: 180 }], ['crane', 13, 0, d(13), { l: 19, w: 3, h: 8, el: 22, rot: 0 }],
        ...[-1, 1].flatMap((s) => [['boat', -38.6, s * 6.4, t1, { l: 6.4, w: 2.4, h: 2.2 }], ['raft', -25, s * 6.6, d(-25), {}], ['bollard', 31, s * 6, d(31), {}], ['bollard', -24, s * 6.6, d(-24), {}],
          ['bollard', 38, s * 3.6, d(38), {}], ['bollard', -42.5, s * 4.6, d(-42.5), {}], ['searchlight', -29, s * 2.4, br, {}], ['whip', -35, s * 3, br, { h: 5 }]]), ['horn', -31, 1, br, {}]] }; } },
    ship: { loa: 90, B: 15.2, D: 7.6, T: 6.0, cb: 0.74, engines: 1, ptype: 'fpp', vmax: 13.5, rpm: 170, gear: 1, accTime: 70, propD: 4.0, PD: 0.75, AR: 13, hR: 5, rudders: 1, rudMax: 35, rudTime: 28, respTime: 8, turnDia: 300, bowAnchors: 2, sternAnchors: 0, chainLen: 330, anchorW: 3, chainW: 42, lineR: 24, lineLen: 200, windAL: 1050, windAF: 300, windXc: -8, flags: 'vn' } },

  { id: 'cont100', type: 'Tàu hàng', name: 'Tàu container nhỏ 100 m (mẫu)', spec: {
    L: 100, B: 17.2, D: 8.6, T: 6.4, H: 36, bow: 'bulb', rake: 5, stern: 'cruiser', shA: 0.3, shF: 1.3, fc: { x0: 40, h: 2.6 }, par: [-20, 15], ts: 0.68, bp: 1.9, sec: 'box', br: 1.4,
    opts: { colors: C('#2f4f7a', '#f4f4f2', '#6b3a2f', '#8b2a22') },
    build: ({ deck: d }) => { const z1 = d(-32), t1 = z1 + 2.8, t2 = t1 + 2.8, t3 = t2 + 2.8, t4 = t3 + 2.8, br = t4 + 2.8; return {
      blocks: [{ k: 't1', x0: -38, x1: -26, h: 2.8, w: 15.2, win: true }, { k: 't2', x0: -36.8, x1: -26.5, h: 2.8, w: 14.8, win: true }, { k: 't3', x0: -36.2, x1: -27, h: 2.8, w: 14.4, win: true },
        { k: 't4', x0: -35.6, x1: -27.4, h: 2.8, w: 14, win: true }, { k: 'bridge', x0: -35, x1: -27.6, h: 2.8, w: 16.8, sl: 0.45 }, { k: 'funnel', x0: -41, x1: -38.2, h: 13.5, w: 3.6, sl: 0.6, sa: -0.6 }],
      masts: [{ id: 'chinh', x: -31, z0: br, h: 5, yard: 3.6, radar: 2.6, rl: 3.4 }, { id: 'truoc', x: 45, z0: d(45), h: 8, yard: 6 }],
      anchors: [46, d(46) - 3], winch: [42, 44],
      lights: { mast1: [45, d(45) + 8.1], mast2: [-31, br + 5.1], side: [-27.9, t4 + 1], stern: [-49.6, d(-49.6) + 1.5], anchF: [48.2, d(48.2) + 4], anchA: [-49, d(-49) + 4], nuc: [-31, br + 3.8] }, eye: [-28.6, t4 + 1.7],
      fits: [['hatch', 9.5, 0, d(9.5), { l: 60, w: 15.4, h: 1.6 }], ['containers', 9.5, 0, d(9.5) + 1.6, { l: 61, w: 14.6, h: 7.8 }],
        ['hatch', -46.4, 0, d(-46.4), { l: 6.4, w: 12.6, h: 1.4 }], ['containers', -46.4, 0, d(-46.4) + 1.4, { l: 6.1, w: 12.2, h: 5.2 }],
        ...[-1, 1].flatMap((s) => [['boat', -40.2, s * 6.2, d(-40.2), { l: 5.8, w: 2.3, h: 2.1 }], ['bollard', 43, s * 4, d(43), {}], ['bollard', -38.5, s * 7.4, d(-38.5), {}], ['searchlight', -28.4, s * 3, br, {}], ['whip', -33.4, s * 3.2, br, { h: 5 }]]),
        ['horn', -29.4, 1, br, {}]] }; } },
    ship: { loa: 100, B: 17.2, D: 8.6, T: 6.4, cb: 0.66, engines: 1, ptype: 'fpp', vmax: 16.5, rpm: 140, gear: 1, accTime: 80, propD: 4.6, PD: 0.8, AR: 18, hR: 6, rudders: 1, rudMax: 35, rudTime: 28, respTime: 8, turnDia: 380, bowAnchors: 2, sternAnchors: 0, chainLen: 357, anchorW: 4, chainW: 50, lineR: 26, lineLen: 220, windAL: 1950, windAF: 390, windXc: 5, flags: 'vn' } },

  { id: 'dau70', type: 'Tàu dầu', name: 'Tàu dầu nhỏ 70 m (mẫu)', spec: {
    L: 70, B: 12.6, D: 5.8, T: 4.7, H: 22, bow: 'bulb', rake: 3.5, stern: 'cruiser', shA: 0.3, shF: 1.0, fc: { x0: 27, h: 2.0 }, poop: { x1: -21, h: 1.6 }, par: [-18, 14], ts: 0.62, bp: 1.9, sec: 'box', br: 1.0,
    opts: { colors: C('#22282d', '#f1f0ec', '#3f6a4c', '#8b2a22') },
    build: ({ deck: d }) => { const z1 = d(-28), t1 = z1 + 2.6, t2 = t1 + 2.6, br = t2 + 2.6; return {
      blocks: [{ k: 't1', x0: -33, x1: -21.5, h: 2.6, w: 9.2, fw: 1.3, win: true }, { k: 't2', x0: -31, x1: -23, h: 2.6, w: 9.6, fw: 1.18, win: true }, { k: 'bridge', x0: -28.6, x1: -23.4, h: 2.6, w: 12.2, sl: 0.45 },
        { k: 'funnel', x0: -31, x1: -29.2, z0: t2, h: 4.5, w: 2, sl: 0.5, sa: -0.5 }],
      wings: { x0: -25.4, x1: -23.6, z: t2, span: 6.3, w: 6.1 }, masts: [{ id: 'chinh', x: -26.6, z0: br, h: 4.5, yard: 3.3, radar: 2.2 }, { id: 'truoc', x: 31, z0: d(31), h: 7, yard: 5 }],
      anchors: [32, d(32) - 2], winch: [28.6, 30.2],
      lights: { mast1: [31, d(31) + 7.1], mast2: [-26.6, br + 4.6], side: [-23.8, t2 + 1], stern: [-34.7, d(-34.7) + 1.2], anchF: [33.6, d(33.6) + 3.4], anchA: [-34, t1 + 1], nuc: [-26.6, br + 3.4] }, eye: [-24.6, t2 + 1.7],
      fits: [['pipes', 2.5, 0, d(2.5), { l: 44, w: 3.2, h: 1.8 }], ['crane', 1, 3.9, d(1), { l: 9, w: 1.4, h: 3.2, el: 40, rot: 90 }],
        ...[-16, -8.4, -0.8, 6.8, 14.4, 22].flatMap((x) => [-1, 1].map((s) => ['hatch', x, s * 3.4, d(x), { l: 1.4, w: 1.4, h: 0.6 }])),
        ...[-1, 1].flatMap((s) => [['raft', -22.4, s * 4.6, t1, {}], ['bollard', 26, s * 5, d(26), {}], ['bollard', -19, s * 5.6, d(-19), {}], ['bollard', -33.8, s * 3.4, d(-33.8), {}], ['searchlight', -24, s * 2, br, {}]]),
        ['horn', -25, 0.8, br, {}], ['whip', -27.6, 2, br, { h: 4 }]] }; } },
    ship: { loa: 70, B: 12.6, D: 5.8, T: 4.7, cb: 0.78, engines: 1, ptype: 'fpp', vmax: 11.5, rpm: 750, gear: 3, accTime: 50, propD: 2.8, PD: 0.72, AR: 7, hR: 3.6, rudders: 1, rudMax: 35, rudTime: 28, respTime: 7, turnDia: 230, bowAnchors: 2, sternAnchors: 0, chainLen: 247, anchorW: 1.8, chainW: 30, lineR: 18, lineLen: 170, windAL: 520, windAF: 150, windXc: -9, flags: 'vn' } },

  { id: 'khach40', type: 'Tàu khách', name: 'Tàu khách 40 m (mẫu)', spec: {
    L: 40, B: 8, D: 3.4, T: 1.9, H: 14, bow: 'raked', rake: 2.5, stern: 'transom', tb: 1.1, shA: 0.2, shF: 0.8, par: [-8, 6], ts: 0.82, bp: 1.7, sec: 'round',
    opts: { colors: C('#e4e6e8', '#eceeef', '#6b7378', '#2c5684') },
    build: ({ deck: d }) => { const z1 = d(-4), t1 = z1 + 2.5, t2 = t1 + 2.4, br = t2 + 2.2; return {
      blocks: [{ k: 't1', x0: -17, x1: 12, h: 2.5, w: 7.2, fw: 0.86, sl: 1.4, win: true }, { k: 't2', x0: -12, x1: 5.5, h: 2.4, w: 6.8, sl: 1.2, win: true }, { k: 'bridge', x0: 1.6, x1: 5.3, z0: t2, h: 2.2, w: 5.6, sl: 0.8 }],
      masts: [{ id: 'chinh', x: 3, z0: br, h: 3, yard: 2.2, radar: 1.4, rl: 1.6 }], anchors: [16.8, d(16.8) - 1], winch: [14.6, 15.8],
      lights: { mast1: [3, br + 3.1], side: [4.6, t2 + 1], stern: [-19.8, d(-19.8) + 1], anchF: [18, d(18) + 2.5], nuc: [3, br + 2.3] }, eye: [4, t2 + 1.6],
      fits: [...[-1, 1].flatMap((s) => [['raft', -8, s * 2.8, t2, {}], ['raft', -4, s * 2.8, t2, {}], ['raft', -1, s * 2.8, t2, {}], ['bollard', 14.6, s * 2.2, d(14.6), {}], ['bollard', -18.5, s * 3, d(-18.5), {}]]), ['horn', 2.4, 0.5, br, {}]] }; } },
    ship: { loa: 40, B: 8, D: 3.4, T: 1.9, cb: 0.52, engines: 2, ptype: 'fpp', vmax: 14, rpm: 1800, gear: 3, accTime: 20, propD: 1.1, PD: 0.9, AR: 1.2, hR: 1.0, rudders: 2, rudMax: 35, rudTime: 15, respTime: 4, turnDia: 120, bowAnchors: 1, sternAnchors: 0, chainLen: 110, anchorW: 0.3, chainW: 7, lineR: 10, lineLen: 80, windAL: 215, windAF: 48, windXc: -1, flags: 'vn' } },

  { id: 'lai30', type: 'Tàu lai', name: 'Tàu lai 30 m, 2 chân vịt (mẫu)', spec: {
    L: 30, B: 10, D: 4.6, T: 3.6, H: 16, bow: 'tug', rake: 2.2, stern: 'transom', tb: 1.15, shA: 0.15, shF: 1.1, fc: { x0: 1.5, h: 1.0 }, par: [-5, 3], ts: 0.78, bp: 1.5, sec: 'round',
    opts: { colors: C('#26292c', '#f0ebdf', '#6d3a2c', '#9c3428') },
    build: ({ deck: d }) => { const z1 = d(-4), t1 = z1 + 2.5, br = t1 + 2.6; return {
      blocks: [{ k: 't1', x0: -4.5, x1: 9, h: 2.5, w: 7.6, sl: 0.5, win: true }, { k: 'bridge', x0: -0.5, x1: 6.5, z0: t1, h: 2.6, w: 7.8, sl: 0.8, sa: -0.3, win: true },
        { k: 'funnelT', x0: -4, x1: -1.8, z0: t1, h: 3.2, w: 1.2, y: 2.8, sl: 0.4, sa: -0.4 }, { k: 'funnelP', x0: -4, x1: -1.8, z0: t1, h: 3.2, w: 1.2, y: 2.8, sl: 0.4, sa: -0.4 }],
      masts: [{ id: 'chinh', x: 2.6, z0: br, h: 3.6, yard: 2.6, radar: 1.6, rl: 1.8 }], anchors: [12.6, d(12.6) - 1.4], winch: [10.4, 11.8],
      lights: { mast1: [2.6, br + 3.7], mast2: [2.6, br + 2.7], side: [5.8, t1 + 0.9], stern: [-14.6, d(-14.6) + 1.3], anchF: [13.4, d(13.4) + 2.5], nuc: [2.4, br + 1.6] }, eye: [5, t1 + 1.7],
      fits: [['fender', 14.6, 0, d(14.6) - 1.7, { l: 4, w: 0.8, h: 0.8, rot: 90 }], ['fender', 12.9, 3.2, d(12.9) - 1.5, { l: 3.6, w: 0.8, h: 0.8, rot: 55 }], ['fender', 12.9, -3.2, d(12.9) - 1.5, { l: 3.6, w: 0.8, h: 0.8, rot: -55 }],
        ...[-1, 1].flatMap((s) => [['fender', 3, s * 4.95, d(3) - 1.1, { l: 14, w: 0.5, h: 0.5 }], ['bollard', 11.6, s * 2.8, d(11.6), {}], ['bollard', -12, s * 3.4, d(-12), {}], ['searchlight', 5.6, s * 2.6, br, {}]]),
        ['fender', -14.8, 0, d(-14.8) - 1.3, { l: 7, w: 0.7, h: 0.7, rot: 90 }], ['windlass', -7, 0, d(-7), { l: 2.4, w: 3.6, h: 1.6 }], ['bollard', -12.6, 0, d(-12.6), { l: 1.6, w: 0.6, h: 0.9 }], ['horn', 2, 0.6, br, {}]] }; } },
    ship: { loa: 30, B: 10, D: 4.6, T: 3.6, cb: 0.58, engines: 2, ptype: 'fpp', vmax: 12, rpm: 1600, gear: 6, accTime: 15, propD: 2.4, PD: 0.75, AR: 1.0, hR: 1.4, rudders: 2, rudMax: 35, rudTime: 12, respTime: 3, turnDia: 30, bowAnchors: 1, sternAnchors: 0, chainLen: 165, anchorW: 0.6, chainW: 13, lineR: 22, lineLen: 150, windAL: 150, windAF: 75, windXc: 1.5, flags: 'vn' } },

  { id: 'phao62', type: 'Tàu pháo', name: 'Tàu pháo nhỏ 62 m (mẫu)', model: () => makeTemplate(),
    ship: Object.assign({}, TEMPLATE_SHIP, { T: undefined, vmax: 24, rpm: 1000, gear: 2.5, accTime: 40, propD: 1.9, PD: 1.0, AR: 2.6, hR: 1.8, rudTime: 15, respTime: 5, turnDia: 300, bowAnchors: 2, sternAnchors: 0, chainLen: 150, anchorW: 0.8, chainW: 13, lineR: 14, lineLen: 110, windAL: 420, windAF: 105, windXc: 0, flags: 'hq' }) },

  { id: 'tenlua50', type: 'Tàu tên lửa', name: 'Tàu tên lửa nhỏ 50 m (mẫu)', spec: {
    L: 50, B: 8.6, D: 4.4, T: 2.4, H: 18, bow: 'raked', rake: 4, stern: 'transom', tb: 0.85, shA: 0.1, shF: 1.4, par: [-10, 4], ts: 0.86, bp: 1.6, sec: 'v', bulwark: [16, 24.6, 0.9],
    opts: { colors: C('#9aa3a9', '#a9b1b6', '#5f686e', '#1d2124'), hullNo: '201' },
    build: ({ deck: d }) => { const z1 = d(-1), t1 = z1 + 2.4, br = t1 + 2.4; return {
      blocks: [{ k: 't1', x0: -10, x1: 8.5, h: 2.4, w: 6.6, fw: 0.9, sl: 1 }, { k: 'bridge', x0: 2.5, x1: 7.6, z0: t1, h: 2.4, w: 6.4, sl: 0.9 }],
      wings: { x0: 4.8, x1: 7.2, z: t1, span: 4, w: 3.2 }, anchors: [20.5, d(20.5) - 1.6],
      lights: { mast1: [-0.5, t1 + 8.6], side: [6.8, t1 + 0.9], stern: [-24.7, d(-24.7) + 1], anchF: [23, d(23) + 2.6], anchA: [-24, d(-24) + 2], nuc: [-0.5, t1 + 5.5] }, eye: [5.8, t1 + 1.6],
      fits: [['latmast', -0.5, 0, t1, { l: 1.4, w: 1.4, h: 7 }], ['radar', -0.5, 0, t1 + 7.1, { l: 2.6, w: 0.5, h: 1 }], ['dome', 4, 0, br, { l: 1.2, w: 1.2, h: 1.8 }],
        ['turret', 13.5, 0, d(13.5), { l: 3, w: 2.6, h: 1.7, n: 1, bl: 3.2 }], ['turret', -21.5, 0, d(-21.5), { l: 2, w: 1.8, h: 1.4, n: 1, bl: 1.8, rot: 180 }],
        ...[-1, 1].flatMap((s) => [['launcher', -15, s * 2.3, d(-15), { l: 5.6, w: 1.9, h: 2, rows: 2, cols: 2, el: 10, rot: s * 6 }], ['whip', -3, s * 2.4, t1, { h: 5 }], ['raft', -8, s * 2.6, t1, {}],
          ['searchlight', 6.2, s * 3.6, t1 + 0.5, {}], ['bollard', 18, s * 2.6, d(18), {}], ['bollard', -23, s * 3.2, d(-23), {}]]), ['horn', 3.2, 0.8, br, {}]] }; } },
    ship: { loa: 50, B: 8.6, D: 4.4, T: 2.4, cb: 0.45, engines: 2, ptype: 'fpp', vmax: 32, rpm: 1500, gear: 2.5, accTime: 30, propD: 1.3, PD: 1.1, AR: 1.5, hR: 1.2, rudders: 2, rudMax: 30, rudTime: 12, respTime: 4, turnDia: 260, bowAnchors: 1, sternAnchors: 0, chainLen: 100, anchorW: 0.5, chainW: 8.5, lineR: 12, lineLen: 80, windAL: 260, windAF: 70, windXc: 0, flags: 'hq' } },

  { id: 'loi35', type: 'Tàu phóng lôi', name: 'Tàu phóng lôi nhỏ 35 m (mẫu)', spec: {
    L: 35, B: 7.4, D: 3.8, T: 1.9, H: 14, bow: 'raked', rake: 3, stern: 'transom', tb: 0.8, shF: 1.1, par: [-7, 3], ts: 0.86, bp: 1.6, sec: 'v', bulwark: [11, 17.2, 0.8],
    opts: { colors: C('#8d969c', '#9aa3a9', '#5f686e', '#1d2124'), hullNo: '332' },
    build: ({ deck: d }) => { const z1 = d(0), t1 = z1 + 2.2, br = t1 + 2.2; return {
      blocks: [{ k: 't1', x0: -5.5, x1: 7, h: 2.2, w: 5.6, fw: 0.9, sl: 0.8 }, { k: 'bridge', x0: 2, x1: 6.2, z0: t1, h: 2.2, w: 5.4, sl: 0.8 }], anchors: [14.5, d(14.5) - 1.3],
      lights: { mast1: [-1, t1 + 6.1], side: [5.6, t1 + 0.8], stern: [-17.4, d(-17.4) + 0.9], anchF: [16.3, d(16.3) + 2], nuc: [-1, t1 + 4] }, eye: [4.6, t1 + 1.5],
      fits: [['latmast', -1, 0, t1, { l: 1.1, w: 1.1, h: 5 }], ['radar', -1, 0, t1 + 5.1, { l: 2, w: 0.4, h: 0.9 }],
        ['turret', 10, 0, d(10), { l: 2.2, w: 1.9, h: 1.5, n: 2, bl: 2 }], ['turret', -15.5, 0, d(-15.5), { l: 1.8, w: 1.6, h: 1.3, n: 2, bl: 1.6, rot: 180 }],
        ...[-1, 1].flatMap((s) => [['torpedo', -10, s * 2.1, d(-10), { l: 6.5, w: 1.5, h: 1.3, n: 2, rot: s * 7 }], ['raft', -4, s * 2.3, t1, {}], ['bollard', 13, s * 2.2, d(13), {}], ['bollard', -16.4, s * 2.8, d(-16.4), {}], ['whip', -3, s * 2, t1, { h: 4 }]])] }; } },
    ship: { loa: 35, B: 7.4, D: 3.8, T: 1.9, cb: 0.42, engines: 2, ptype: 'fpp', vmax: 35, rpm: 1500, gear: 2.3, accTime: 25, propD: 1.0, PD: 1.15, AR: 0.9, hR: 0.9, rudders: 2, rudMax: 30, rudTime: 10, respTime: 3, turnDia: 200, bowAnchors: 1, sternAnchors: 0, chainLen: 80, anchorW: 0.3, chainW: 6, lineR: 10, lineLen: 60, windAL: 150, windAF: 45, windXc: 0, flags: 'hq' } },

  { id: 'tuan45', type: 'Tàu tuần tra', name: 'Tàu tuần tra 45 m (mẫu)', spec: {
    L: 45, B: 8.2, D: 4.4, T: 2.4, H: 17, bow: 'raked', rake: 3.6, stern: 'transom', tb: 0.9, shF: 1.4, par: [-9, 4], ts: 0.86, bp: 1.6, sec: 'v', bulwark: [14, 22, 0.9],
    opts: { colors: C('#d3d7da', '#e1e4e6', '#3f7a4c', '#23282b'), hullNo: '4032', hullNoCol: '#1d2a3a' },
    build: ({ deck: d }) => { const z1 = d(-0.5), t1 = z1 + 2.5, br = t1 + 2.4; return {
      blocks: [{ k: 't1', x0: -9, x1: 8, h: 2.5, w: 6.4, fw: 0.92, sl: 1.1 }, { k: 'bridge', x0: 2.2, x1: 7.4, z0: t1, h: 2.4, w: 6.6, sl: 1 }],
      wings: { x0: 4.6, x1: 7, z: t1, span: 4, w: 3.3 }, anchors: [18.5, d(18.5) - 1.6],
      lights: { mast1: [-1, t1 + 7.6], side: [6.6, t1 + 0.9], stern: [-22.2, d(-22.2) + 1], anchF: [21, d(21) + 2.6], anchA: [-21.6, d(-21.6) + 2], nuc: [-1, t1 + 5] }, eye: [5.6, t1 + 1.6],
      fits: [['latmast', -1, 0, t1, { l: 1.4, w: 1.4, h: 6.2 }], ['radar', -1, 0, t1 + 6.3, { l: 2.4, w: 0.5, h: 1 }], ['dome', 4.5, 0, br, { l: 1.1, w: 1.1, h: 1.7 }],
        ['turret', 12.5, 0, d(12.5), { l: 2.6, w: 2.2, h: 1.6, n: 1, bl: 2.8 }], ['boat', -15, 0, d(-15), { l: 6, w: 2.3, h: 1.6 }],
        ...[-1, 1].flatMap((s) => [['raft', -7, s * 2.6, t1, {}], ['searchlight', 6, s * 3.8, t1 + 0.5, {}], ['whip', -4, s * 2.5, t1, { h: 5 }], ['bollard', 16.5, s * 2.5, d(16.5), {}], ['bollard', -20.5, s * 3.2, d(-20.5), {}]]),
        ['horn', 3, 0.8, br, {}]] }; } },
    ship: { loa: 45, B: 8.2, D: 4.4, T: 2.4, cb: 0.46, engines: 2, ptype: 'fpp', vmax: 24, rpm: 1800, gear: 3, accTime: 30, propD: 1.3, PD: 1.0, AR: 1.6, hR: 1.3, rudders: 2, rudMax: 30, rudTime: 12, respTime: 4, turnDia: 230, bowAnchors: 1, sternAnchors: 0, chainLen: 110, anchorW: 0.5, chainW: 8.5, lineR: 12, lineLen: 90, windAL: 245, windAF: 66, windXc: 1, flags: 'hq' } },

  { id: 'hove100', type: 'Tàu hộ vệ', name: 'Tàu hộ vệ 100 m (mẫu)', spec: {
    L: 100, B: 13, D: 7.6, T: 3.9, H: 34, bow: 'raked', rake: 7, stern: 'transom', tb: 0.85, shA: 0.2, shF: 2.6, par: [-22, 10], ts: 0.82, bp: 1.65, sec: 'v', bulwark: [36, 49, 1.1],
    opts: { colors: C('#8d969c', '#9aa3a9', '#5f686e', '#1d2124'), hullNo: '015' },
    build: ({ deck: d }) => { const z1 = d(4), t1 = z1 + 2.6, t2 = t1 + 2.6, br = t2 + 2.6, hg = d(-20) + 6.2; return {
      blocks: [{ k: 'box', x0: -28, x1: -12, h: 6.2, w: 10.4, sl: 0.4 }, { k: 't1', x0: -12, x1: 21, h: 2.6, w: 11, fw: 0.9, sl: 1.4 }, { k: 't2', x0: -3.5, x1: 15.5, z0: t1, h: 2.6, w: 9.4, sl: 1.2 },
        { k: 'bridge', x0: 9, x1: 15, z0: t2, h: 2.6, w: 9.6, sl: 1 }, { k: 'funnel', x0: -9, x1: -4.5, z0: t1, h: 4.2, w: 3.4, sl: 0.8, sa: -0.4 }],
      wings: { x0: 12, x1: 14.6, z: t2, span: 6, w: 4.8 }, anchors: [44, d(44) - 2.4], winch: [39, 41.4],
      lights: { mast1: [4, t2 + 12.3], mast2: [-20, hg + 6], side: [14.4, t2 + 0.9], stern: [-49.6, d(-49.6) + 1.3], anchF: [47, d(47) + 3], anchA: [-49, d(-49) + 3], nuc: [4, t2 + 7] }, eye: [13.6, t2 + 1.7],
      fits: [['latmast', 4, 0, t2, { l: 2.4, w: 2.4, h: 10 }], ['radar', 4, 0, t2 + 10.1, { l: 4, w: 0.6, h: 1.4 }], ['latmast', -20, 0, hg, { l: 1.6, w: 1.6, h: 5 }], ['radar', -20, 0, hg + 5.1, { l: 2.6, w: 0.5, h: 1 }],
        ['dome', 12, 0, br, { l: 2, w: 2, h: 2.6 }], ['turret', 29, 0, d(29), { l: 5, w: 4, h: 2.6, n: 1, bl: 6 }], ['turret', -16, 0, hg, { l: 1.8, w: 1.8, h: 2, n: 1, bl: 1.8, rot: 180 }],
        ['launcher', 18, 0, t1, { l: 2.4, w: 2.6, h: 1.6, rows: 2, cols: 4, el: 0 }],
        ...[-1, 1].flatMap((s) => [['launcher', 0, s * 3.2, t2, { l: 5, w: 2, h: 2.2, rows: 2, cols: 2, el: 15, rot: s * 80 }], ['boat', -20, s * 5.6, d(-20), { l: 6, w: 2, h: 1.6 }], ['whip', -1, s * 4, t2, { h: 6 }],
          ['searchlight', 14, s * 5.4, t2 + 0.5, {}], ['bollard', 40, s * 3.4, d(40), {}], ['bollard', -46, s * 4.6, d(-46), {}], ['raft', 0, s * 5.2, t1, {}]]), ['horn', 11, 1, br, {}]] }; } },
    ship: { loa: 100, B: 13, D: 7.6, T: 3.9, cb: 0.47, engines: 2, ptype: 'fpp', vmax: 28, rpm: 1000, gear: 4, accTime: 60, propD: 3.0, PD: 1.1, AR: 6, hR: 2.6, rudders: 2, rudMax: 35, rudTime: 15, respTime: 5, turnDia: 420, bowAnchors: 1, sternAnchors: 0, chainLen: 220, anchorW: 2, chainW: 30, lineR: 20, lineLen: 170, windAL: 1050, windAF: 210, windXc: -2, flags: 'hq' } },

  { id: 'dobo80', type: 'Tàu đổ bộ', name: 'Tàu đổ bộ 80 m, cầu dẫn mũi (mẫu)', spec: {
    L: 80, B: 14.6, D: 6.6, T: 2.9, H: 26, bow: 'flat', bw: 0.55, stern: 'transom', tb: 1.0, shA: 0.2, shF: 1.0, par: [-25, 22], ts: 0.88, bp: 2.2, sec: 'box', br: 0.8, bulwark: [26, 39.4, 1.2],
    opts: { colors: C('#7b8995', '#8a98a3', '#56626c', '#1d2124'), hullNo: '571' },
    build: ({ deck: d }) => { const z1 = d(-28), t1 = z1 + 2.7, t2 = t1 + 2.7, br = t2 + 2.6; return {
      blocks: [{ k: 't1', x0: -38, x1: -18, h: 2.7, w: 13, sl: 0.6 }, { k: 't2', x0: -36, x1: -22, h: 2.7, w: 12, sl: 0.6 }, { k: 'bridge', x0: -33, x1: -24.5, z0: t2, h: 2.6, w: 12.6, sl: 0.8 },
        { k: 'funnel', x0: -37.8, x1: -36.1, z0: t1, h: 4, w: 2.8, sl: 0.4, sa: -0.4 }],
      wings: { x0: -27, x1: -24.8, z: t2, span: 7.2, w: 6.3 }, anchors: [36.5, d(36.5) - 2.2], winch: [33.4, 35.4],
      lights: { mast1: [-29, br + 7.3], side: [-25, t2 + 1], stern: [-39.6, d(-39.6) + 1.3], anchF: [38, d(38) + 3.5], anchA: [-39, d(-39) + 3], nuc: [-29, br + 4.5] }, eye: [-25.8, t2 + 1.7],
      fits: [['latmast', -29, 0, br, { l: 1.8, w: 1.8, h: 6 }], ['radar', -29, 0, br + 6.1, { l: 3, w: 0.5, h: 1.1 }], ['dome', -26, 0, br, { l: 1.4, w: 1.4, h: 2 }],
        ['ramp', 39.2, 0, d(39.2) - 0.2, { l: 0.5, w: 6.5, h: 5.5, el: 8 }], ['hatch', 6, 0, d(6), { l: 16, w: 8, h: 0.9 }],
        ...[-1, 1].flatMap((s) => [['crane', -14, s * 5, d(-14), { l: 12, w: 1.8, h: 4, el: 25, rot: s * 160 }], ['turret', 30, s * 3.8, d(30), { l: 1.8, w: 1.6, h: 1.4, n: 2, bl: 2 }],
          ['raft', -34.8, s * 5, t2, {}], ['bollard', 24, s * 6.2, d(24), {}], ['bollard', -36.5, s * 6, d(-36.5), {}], ['searchlight', -25.6, s * 6.6, t2 + 0.5, {}], ['whip', -31, s * 4, br, { h: 5 }]])] }; } },
    ship: { loa: 80, B: 14.6, D: 6.6, T: 2.9, cb: 0.7, engines: 2, ptype: 'fpp', vmax: 15, rpm: 1000, gear: 4, accTime: 50, propD: 2.2, PD: 0.9, AR: 5, hR: 2.3, rudders: 2, rudMax: 35, rudTime: 15, respTime: 5, turnDia: 330, bowAnchors: 1, sternAnchors: 1, chainLen: 250, anchorW: 2, chainW: 26, lineR: 18, lineLen: 160, windAL: 820, windAF: 235, windXc: -6, flags: 'hq' } }
];

// thông số đầy đủ (kể cả mô hình) của một mẫu
export function templateShip(id) {
  const t = TPL.find((q) => q.id === id); if (!t) return null;
  const sh = Object.assign({}, t.ship); if (sh.T === undefined) { sh.T = (sh.tf + sh.ta) / 2; }
  const p = params(sh); p.name = t.name.replace(/ \(mẫu\)$/, ''); p.type = t.type;
  p.model = t.model ? t.model() : genModel(Object.assign({ name: t.name }, t.spec)); delete p.model.template;
  return p;
}
export const TEMPLATES = TPL.map((t) => ({ id: 'tpl:' + t.id, type: t.type, name: t.name, L: t.ship.loa, T: t.ship.T !== undefined ? t.ship.T : (t.ship.tf + t.ship.ta) / 2, builtin: true }));

// ---------- kho người dùng (IndexedDB) ----------
let dbp = null;
const db = () => dbp || (dbp = new Promise((res) => { try { const r = indexedDB.open('mp_fleet', 1); r.onupgradeneeded = () => r.result.createObjectStore('ships', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); } }));
const tx = async (mode, fn) => { const d = await db(); if (!d) return null; return new Promise((res) => { try { const t = d.transaction('ships', mode), q = fn(t.objectStore('ships')); t.oncomplete = () => res(q && q.result); t.onerror = () => res(null); } catch (e) { res(null); } }); };
const clone = (o) => JSON.parse(JSON.stringify(o));
const cache = new Map();

// danh sách (mẫu có sẵn + tàu người dùng), không kèm thông số
export async function listFleet() {
  const mine = (await tx('readonly', (o) => o.getAll())) || [];
  return [...TEMPLATES, ...mine.map((e) => ({ id: e.id, type: e.type, name: e.name, L: e.p ? e.p.loa : 0, builtin: false, t: e.t }))];
}
// các loại tàu đang có (loại chuẩn + loại người dùng tự gõ)
export function fleetTypes(list) { const s = [...SHIP_TYPES]; for (const e of list || []) if (e.type && !s.includes(e.type)) s.splice(s.length - 1, 0, e.type); return s; }
// thông số đầy đủ của một tàu trong kho (bản sao, sửa thoải mái)
export async function getFleetShip(id) {
  if (cache.has(id)) return clone(cache.get(id));
  let p = null;
  if (String(id).startsWith('tpl:')) p = templateShip(id.slice(4));
  else { const e = await tx('readonly', (o) => o.get(id)); p = e ? e.p : null; }
  if (p) cache.set(id, p);
  return p ? clone(p) : null;
}
// lưu tàu (thông số + mô hình, không ảnh) vào kho; trùng loại + tên thì thay. Trả id
export async function saveFleetShip(type, name, p) {
  const list = await listFleet(), same = list.find((e) => !e.builtin && e.type === type && e.name === name);
  const id = same ? same.id : 'u:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), q = clone(p); q.type = type; q.name = name;
  await tx('readwrite', (o) => o.put({ id, type, name, p: q, t: Date.now() })); cache.delete(id);
  return id;
}
export async function deleteFleetShip(id) { if (String(id).startsWith('tpl:')) return; cache.delete(id); await tx('readwrite', (o) => o.delete(id)); }
// tàu nạp từ file đối tượng (tàu đậu ở cảng kèm mô hình): thêm vào kho nếu chưa có (theo loại + tên)
export async function ensureFleetShip(e) {
  if (!e || !e.p) return null; if (String(e.id).startsWith('tpl:')) return e.id;
  const list = await listFleet(), same = list.find((q) => !q.builtin && q.type === e.type && q.name === e.name);
  if (same) return same.id;
  await tx('readwrite', (o) => o.put({ id: e.id, type: e.type, name: e.name, p: e.p, t: Date.now() })); return e.id;
}
