// Bảng 12 tàu mẫu CHUNG CHUNG tự dựng (không theo tàu thật nào) cho kho tàu (fleet.js).
// Mỗi mẫu: spec (mét; x về mũi từ giữa chiều dài, z từ đáy ky) → shipdraw/shipgen.js dựng mô hình bàn vẽ; ship → thông số tab 1.
// build({ deck, hb }) trả khối thượng tầng, cánh gà, đèn, mắt, chi tiết thư viện (cột, radar, xuồng + cần, tời, cọc bích, thông gió…).
import { makeTemplate } from './shipdraw/template.js';

const C = (hull, sup, deck, boot) => ({ hull, super: sup, deck, boot });
const F = (kind, x, y, z, o) => [kind, x, y, z, o || {}];
const mirO = (o) => (o && o.rot !== undefined ? Object.assign({}, o, { rot: o.rot === 180 || o.rot === 0 ? o.rot : -o.rot }) : o);
const both = (kind, x, y, z, o) => [F(kind, x, -y, z, mirO(o)), F(kind, x, y, z, o)];
const sideO = (kind, x, y, z, o) => [F(kind, x, -y, z, Object.assign({}, o, { rot: 180 })), F(kind, x, y, z, Object.assign({}, o, { rot: 0 }))]; // chi tiết hướng ra mạn

// cột cờ mũi / lái, cọc bích hai mạn
function common(L, d, hb, xs) {
  const xb = L / 2 - Math.max(0.8, L * 0.025), xa = -L / 2 + Math.max(0.5, L * 0.012), bs = { l: Math.max(0.8, L / 90), w: Math.max(0.35, L / 260), h: Math.max(0.5, L / 170) };
  return [F('staff', xb, 0, d(xb), { h: Math.max(2, L / 24) }), F('staff', xa, 0, d(xa), { h: Math.max(2.5, L / 18) }),
    ...(xs || [L * 0.37, L * 0.12, -L * 0.18, -L * 0.42]).flatMap((x) => both('bollard', x, Math.max(0.6, hb(x) - 0.7), d(x), bs))];
}
// xuồng cứu sinh treo trên cần hai mạn: x giữa xuồng, y chỗ treo xuồng (tâm xuồng), z chân cần
function lifeboats(x, y, z, bl, bw, bh) { const dh = bh * 1.5 + 0.7; return [-1, 1].flatMap((s) => [...(s > 0 ? [F('davit', x, y - 1.1, z, { l: bl * 0.68, w: 1.5, h: dh, rot: 0 })] : [F('davit', x, -(y - 1.1), z, { l: bl * 0.68, w: 1.5, h: dh, rot: 180 })]), F('boat', x, s * y, z + dh * 0.38, { l: bl, w: bw, h: bh })]); }
// cột radar trên nóc buồng lái: cột đơn có sàn + radar trên sàn + 2 vòm vệ tinh
function radarMast(x, z, h, L) {
  const ps = Math.max(0.8, Math.min(2.4, h * 0.2)), zp = z + h * 0.7, dx = Math.max(1.4, L / 55);
  return [F('mast', x, 0, z, { h, w: Math.max(0.25, h / 18), l: Math.max(2.4, L / 25) }), F('radar', x + ps * 0.3, 0, zp + 0.08, { l: Math.max(1.8, L / 34), w: 0.45, h: 0.9 }),
    F('dome', x - dx, 1.1, z, { l: 0.9, w: 0.9, h: 1.3 }), F('dome', x - dx, -1.1, z, { l: 0.7, w: 0.7, h: 1.1 })];
}
// boong mũi tàu hàng: 2 tời neo, cột trước, tấm chắn sóng, ống thông gió cổ ngỗng
function merchFore(L, d, hb, x0) {
  const xw = L / 2 - L * 0.085, xm = x0 + (L / 2 - x0) * 0.42, xbw = x0 + 1.4, mh = Math.max(5, L / 9);
  return [...both('windlass', xw, 1.4 + L / 120, d(xw), { l: 1.2 + L / 80, w: 1.4 + L / 90, h: 0.8 + L / 140 }), F('mast', xm, 0, d(xm), { h: mh, w: Math.max(0.3, mh / 16), l: 2.4 }),
    F('breakwater', xbw, 0, d(xbw), { l: 1.4, w: 2 * hb(xbw) * 0.78, h: 1.2 }), ...both('vent', xm - 1.6, Math.max(0.8, hb(xm - 1.6) * 0.5), d(xm - 1.6), { n: 2, l: 0.6, w: 0.6, h: 1.2, rot: 90 })];
}
// đồ boong tàu chiến: ống phóng mồi bẫy, thùng boong, bè xếp hàng, vòm quang điện, ăng-ten, thang lên nóc
function navyKit(c) {
  const { L, d, hb, x0, x1, t1, w } = c, k = Math.max(0.7, Math.min(1.3, L / 50)), out = [];
  out.push(...both('chaff', x1 - 2 * k, w / 2 - 0.55 * k, t1, { l: 1.1 * k, w: 0.9 * k, h: 0.9 * k, rows: 2, cols: 3, el: 50, rot: 50 }));
  out.push(...both('locker', x0 - 1.2 * k, Math.max(0.8, hb(x0 - 1.2 * k) - 1.1), d(x0 - 1.2 * k), { l: 1.3 * k, w: 0.7, h: 0.85, rot: 0 }), ...both('locker', x1 + 1.4 * k, Math.max(0.8, hb(x1 + 1.4 * k) - 1.0), d(x1 + 1.4 * k), { l: 1.0 * k, w: 0.6, h: 0.8 }));
  out.push(...both('vent', x1 + 3.2 * k, Math.max(0.6, hb(x1 + 3.2 * k) * 0.45), d(x1 + 3.2 * k), { n: 1, l: 0.55, w: 0.55, h: 0.9 }), ...both('vent', x0 - 3 * k, Math.max(0.6, hb(x0 - 3 * k) * 0.5), d(x0 - 3 * k), { n: 2, l: 0.5, w: 0.5, h: 1.0, rot: 180 }));
  out.push(...both('ladder', x0 - 2.5, Math.min(w / 2 - 0.6, hb(x0) - 0.9), d(x0 - 2.5), { l: 2.4, w: 0.65, h: t1 - d(x0 - 2.5) }));
  return out;
}

export const TPL = [
  { id: 'hang50', type: 'Tàu hàng', name: 'Tàu hàng nhỏ 50 m (mẫu)', spec: {
    L: 50, B: 9.2, D: 4.2, T: 3.3, H: 17, bow: 'raked', rake: 3, stern: 'cruiser', shA: 0.3, shF: 0.8, fc: { x0: 19, h: 1.8 }, poop: { x1: -12, h: 1.2 }, par: [-12, 10], ts: 0.62, bp: 1.8, sec: 'box', br: 0.9,
    bulwarks: [[19, 24.6, 1.0], [-24.7, -12.4, 0.9]], opts: { colors: C('#2b4a6b', '#eeeeea', '#8a3d2f', '#8b2a22') },
    build: ({ deck: d, hb }) => { const z1 = d(-20), t1 = z1 + 2.6, t2 = t1 + 2.5, br = t2 + 2.5; return {
      blocks: [{ k: 't1', x0: -24, x1: -12.6, h: 2.6, w: 7.2, fw: 1.2, win: true }, { k: 't2', x0: -22.5, x1: -14.2, h: 2.5, w: 6.4, win: true, lip: { s: 0.25, f: 0.5, a: 0.3 } },
        { k: 'bridge', x0: -21, x1: -14.8, h: 2.5, w: 8.6, sl: -0.35, visor: 0.7 }],
      wings: { x0: -16.6, x1: -15, z: t2, span: 4.7, w: 4.3 }, anchors: [22.6, d(22.6) - 1.6],
      lights: { mast1: [21.5, d(21.5) + 6.7], mast2: [-18.5, br + 5.4], side: [-15.2, t2 + 1], stern: [-24.7, d(-24.7) + 1.2], anchF: [23.6, d(23.6) + 3.4], anchA: [-24, t1 + 1.4], nuc: [-18.5, br + 2.6] }, eye: [-16, t2 + 1.7],
      fits: [F('funnel', -23.3, 0, t1, { l: 1.8, w: 1.6, h: 3.6, n: 1 }), ...radarMast(-18.5, br, 4.6, 50), ...merchFore(50, d, hb, 19), ...common(50, d, hb, [16.5, 4.2, -10.5, -23.2]),
        F('hatch', -2.8, 0, d(-2.8), { l: 10, w: 6.6, h: 1.3 }), F('hatch', 10.6, 0, d(10.6), { l: 12, w: 6.6, h: 1.3 }), F('crane', 3.4, 0, d(3.4), { l: 11, w: 1.8, h: 4.2, el: 15, rot: 180 }),
        ...lifeboats(-19.2, 4.2, t1, 4.2, 1.7, 1.2), ...both('raft', -21.9, 2.4, t2, {}), ...both('vent', 3.4, 3.2, d(3.4), { n: 1, h: 1.3 }), ...both('vent', -9.5, 3.1, d(-9.5), { n: 2, rot: 90 }),
        ...both('searchlight', -15.3, 1.8, br, {}), ...both('whip', -20.4, 2.2, br, { h: 4 }), F('horn', -17.4, 0.7, br, {}), F('radar', -15.8, 0, br, { l: 1.6, w: 0.4, h: 0.7 })] }; } },
    ship: { loa: 50, B: 9.2, D: 4.2, T: 3.3, cb: 0.74, engines: 1, ptype: 'fpp', vmax: 10.5, rpm: 750, gear: 2, accTime: 40, propD: 2.2, PD: 0.7, AR: 2.5, hR: 2.0, rudders: 1, rudMax: 35, rudTime: 28, respTime: 6, turnDia: 150, bowAnchors: 2, sternAnchors: 0, chainLen: 192, anchorW: 0.9, chainW: 18, lineR: 14, lineLen: 150, windAL: 330, windAF: 95, windXc: -3, flags: 'vn' } },

  { id: 'hang90', type: 'Tàu hàng', name: 'Tàu hàng tổng hợp 90 m, có cẩu (mẫu)', spec: {
    L: 90, B: 15.2, D: 7.6, T: 6.0, H: 30, bow: 'bulb', rake: 4.5, stern: 'cruiser', shA: 0.5, shF: 1.4, fc: { x0: 34, h: 2.4 }, par: [-22, 18], ts: 0.58, bp: 1.9, sec: 'box', br: 1.2,
    bulwarks: [[34, 44.6, 1.2], [-44.7, -40.5, 1.0]], opts: { colors: C('#1f2a33', '#f2f2ef', '#7d3b2c', '#8b2a22') },
    build: ({ deck: d, hb }) => { const z1 = d(-34), t1 = z1 + 2.8, t2 = t1 + 2.7, t3 = t2 + 2.7, br = t3 + 2.7; return {
      blocks: [{ k: 't1', x0: -42, x1: -26, h: 2.8, w: 11, fw: 1.3, win: true }, { k: 't2', x0: -38.5, x1: -27, h: 2.7, w: 10.4, win: true },
        { k: 't3', x0: -37.5, x1: -28, h: 2.7, w: 10.8, win: true, lip: { s: 0.3, f: 0.7, a: 0.4 } }, { k: 'bridge', x0: -36.5, x1: -28.6, h: 2.7, w: 14, sl: -0.4, visor: 0.9 }],
      wings: { x0: -31.5, x1: -28.8, z: t3, span: 7.6, w: 7 }, anchors: [41, d(41) - 2.6],
      lights: { mast1: [38.6, d(38.6) + 11.8], mast2: [-33, br + 7.2], side: [-28.9, t3 + 1], stern: [-44.6, d(-44.6) + 1.5], anchF: [43.4, d(43.4) + 4], anchA: [-44, d(-44) + 4], nuc: [-33, br + 3.4] }, eye: [-29.8, t3 + 1.7],
      fits: [F('funnel', -40.3, 0, t1, { l: 3, w: 2.6, h: 6.5, n: 1 }), ...radarMast(-33, br, 6, 90), ...merchFore(90, d, hb, 34), ...common(90, d, hb, [31, 12.5, -24, -43]),
        F('hatch', -15, 0, d(-15), { l: 15, w: 11.4, h: 1.9 }), F('hatch', 3.5, 0, d(3.5), { l: 16, w: 11.4, h: 1.9 }), F('hatch', 22.5, 0, d(22.5), { l: 15, w: 11, h: 1.9 }),
        F('crane', -5.2, 0, d(-5.2), { l: 19, w: 3, h: 8, el: 22, rot: 180 }), F('crane', 13, 0, d(13), { l: 19, w: 3, h: 8, el: 22, rot: 0 }),
        ...lifeboats(-33, 6.7, t1, 6.4, 2.4, 2.2), ...both('raft', -25, 6.6, d(-25), {}), ...both('windlass', -43.6, 3.2, d(-43.6), { l: 1.6, w: 1.8, h: 1.0, rot: 90 }),
        ...both('vent', -5.2, 5.2, d(-5.2), { n: 1, h: 1.6, l: 0.8, w: 0.8 }), ...both('vent', 13, 5.2, d(13), { n: 1, h: 1.6, l: 0.8, w: 0.8 }), ...both('vent', -24.5, 4.2, d(-24.5), { n: 2, rot: 180 }),
        ...both('ladder', -44.4, 4.6, d(-44.4), { l: 2.4, w: 0.7, h: t1 - d(-44.4) }), ...both('searchlight', -29.2, 2.4, br, {}), ...both('whip', -35, 3, br, { h: 5 }), F('horn', -31, 1, br, {}), F('radar', -29.6, 0, br, { l: 2.4, w: 0.45, h: 0.8 })] }; } },
    ship: { loa: 90, B: 15.2, D: 7.6, T: 6.0, cb: 0.74, engines: 1, ptype: 'fpp', vmax: 13.5, rpm: 170, gear: 1, accTime: 70, propD: 4.0, PD: 0.75, AR: 13, hR: 5, rudders: 1, rudMax: 35, rudTime: 28, respTime: 8, turnDia: 300, bowAnchors: 2, sternAnchors: 0, chainLen: 330, anchorW: 3, chainW: 42, lineR: 24, lineLen: 200, windAL: 1050, windAF: 300, windXc: -8, flags: 'vn' } },

  { id: 'cont100', type: 'Tàu hàng', name: 'Tàu container nhỏ 100 m (mẫu)', spec: {
    L: 100, B: 17.2, D: 8.6, T: 6.4, H: 36, bow: 'bulb', rake: 5, stern: 'cruiser', shA: 0.3, shF: 1.3, fc: { x0: 40, h: 2.6 }, par: [-20, 15], ts: 0.68, bp: 1.9, sec: 'box', br: 1.4,
    bulwarks: [[40, 49.6, 1.2]], opts: { colors: C('#2f4f7a', '#f4f4f2', '#6b3a2f', '#8b2a22') },
    build: ({ deck: d, hb }) => { const z1 = d(-32), t1 = z1 + 2.8, t2 = t1 + 2.8, t3 = t2 + 2.8, t4 = t3 + 2.8, br = t4 + 2.8, groups = [[-14.4, 2, 3], [-1.2, 2, 3], [12, 2, 3], [25.2, 2, 3], [34.8, 1, 2]]; return {
      blocks: [{ k: 't1', x0: -38, x1: -26, h: 2.8, w: 15.2, win: true }, { k: 't2', x0: -36.8, x1: -26.5, h: 2.8, w: 12.8, win: true }, { k: 't3', x0: -36.2, x1: -27, h: 2.8, w: 13, win: true, lip: { s: 0.4, f: 0.6, a: 0.3 } },
        { k: 't4', x0: -35.6, x1: -27.4, h: 2.8, w: 13, win: true, lip: { s: 0.4, f: 0.6, a: 0.3 } }, { k: 'bridge', x0: -35, x1: -27.6, h: 2.8, w: 16.8, sl: -0.4, visor: 1.0 }],
      anchors: [46, d(46) - 3],
      lights: { mast1: [44.2, d(44.2) + 12.8], mast2: [-31, br + 6.1], side: [-28, t4 + 1], stern: [-49.6, d(-49.6) + 1.5], anchF: [48.2, d(48.2) + 4], anchA: [-49, d(-49) + 4], nuc: [-31, br + 3] }, eye: [-28.8, t4 + 1.7],
      fits: [F('funnel', -39.6, 0, d(-39.6), { l: 3.2, w: 4.2, h: 14.6, n: 2 }), ...radarMast(-31, br, 5, 100), ...merchFore(100, d, hb, 40), ...common(100, d, hb, [43, -22, -38.5, -48.5]),
        ...groups.flatMap(([x, nb, nt]) => [F('hatch', x, 0, d(x), { l: nb * 6.1 + 0.4, w: 15.2, h: 1.6 }), F('containers', x, 0, d(x) + 1.6, { l: nb * 6.1, w: 14.6, h: nt * 2.6 })]),
        ...[-7.8, 5.4, 18.6, 31.4].map((x) => F('lashing', x, 0, d(x), { l: 1.0, w: 15.6, h: 4.2 })),
        F('hatch', -46.4, 0, d(-46.4), { l: 6.4, w: 12.6, h: 1.4 }), F('containers', -46.4, 0, d(-46.4) + 1.4, { l: 6.1, w: 12.2, h: 5.2 }),
        ...lifeboats(-31.2, 7.7, t1, 6, 2.3, 2.1), ...both('raft', -24.5, 7.4, d(-24.5), {}), ...both('vent', -24.6, 5, d(-24.6), { n: 2, rot: 180 }),
        ...both('searchlight', -28.4, 3, br, {}), ...both('whip', -33.4, 3.2, br, { h: 5 }), F('horn', -29.4, 1, br, {}), F('radar', -28.6, 0, br, { l: 2.4, w: 0.45, h: 0.8 })] }; } },
    ship: { loa: 100, B: 17.2, D: 8.6, T: 6.4, cb: 0.66, engines: 1, ptype: 'fpp', vmax: 16.5, rpm: 140, gear: 1, accTime: 80, propD: 4.6, PD: 0.8, AR: 18, hR: 6, rudders: 1, rudMax: 35, rudTime: 28, respTime: 8, turnDia: 380, bowAnchors: 2, sternAnchors: 0, chainLen: 357, anchorW: 4, chainW: 50, lineR: 26, lineLen: 220, windAL: 1950, windAF: 390, windXc: 5, flags: 'vn' } },

  { id: 'dau70', type: 'Tàu dầu', name: 'Tàu dầu nhỏ 70 m (mẫu)', spec: {
    L: 70, B: 12.6, D: 5.8, T: 4.7, H: 22, bow: 'bulb', rake: 3.5, stern: 'cruiser', shA: 0.3, shF: 1.0, fc: { x0: 27, h: 2.0 }, poop: { x1: -21, h: 1.6 }, par: [-18, 14], ts: 0.62, bp: 1.9, sec: 'box', br: 1.0,
    bulwarks: [[27, 34.6, 1.1], [-34.7, -21.4, 1.0]], opts: { colors: C('#22282d', '#f1f0ec', '#3f6a4c', '#8b2a22') },
    build: ({ deck: d, hb }) => { const z1 = d(-28), t1 = z1 + 2.6, t2 = t1 + 2.6, br = t2 + 2.6; return {
      blocks: [{ k: 't1', x0: -33, x1: -21.5, h: 2.6, w: 9.2, fw: 1.3, win: true }, { k: 't2', x0: -31, x1: -23, h: 2.6, w: 8.6, fw: 1.12, win: true, lip: { s: 0.2, f: 0.5, a: 0 } },
        { k: 'bridge', x0: -28.6, x1: -23.4, h: 2.6, w: 12.2, sl: -0.35, visor: 0.7 }],
      wings: { x0: -25.4, x1: -23.6, z: t2, span: 6.3, w: 6.1 }, anchors: [32, d(32) - 2],
      lights: { mast1: [29.9, d(29.9) + 9], mast2: [-26.6, br + 5.4], side: [-23.8, t2 + 1], stern: [-34.7, d(-34.7) + 1.2], anchF: [33.6, d(33.6) + 3.4], anchA: [-34, t1 + 1], nuc: [-26.6, br + 2.6] }, eye: [-24.6, t2 + 1.7],
      fits: [F('funnel', -30.1, 0, t2, { l: 1.6, w: 1.7, h: 3.8, n: 1 }), ...radarMast(-26.6, br, 4.6, 70), ...merchFore(70, d, hb, 27), ...common(70, d, hb, [24.5, 6, -14, -33.6]),
        F('pipes', 2.5, 0, d(2.5), { l: 44, w: 3.2, h: 1.8 }), F('crane', 1, 3.9, d(1), { l: 9, w: 1.4, h: 3.2, el: 40, rot: 90 }),
        ...[-16, -8.4, -0.8, 6.8, 14.4, 22].flatMap((x) => both('hatch', x, 3.4, d(x), { l: 1.4, w: 1.4, h: 0.6 })),
        ...[-12.2, -4.6, 3, 10.6, 18.2].flatMap((x) => both('vent', x, 4.6, d(x), { n: 1, l: 0.35, w: 0.35, h: 2.2 })),
        ...lifeboats(-26.2, 6.0, t1, 4.6, 1.8, 1.5), ...both('raft', -22.4, 4.6, t1, {}), ...both('vent', -20.4, 4.2, d(-20.4), { n: 2, rot: 180 }),
        ...both('searchlight', -24, 2, br, {}), F('horn', -25, 0.8, br, {}), ...both('whip', -27.8, 2, br, { h: 4 })] }; } },
    ship: { loa: 70, B: 12.6, D: 5.8, T: 4.7, cb: 0.78, engines: 1, ptype: 'fpp', vmax: 11.5, rpm: 750, gear: 3, accTime: 50, propD: 2.8, PD: 0.72, AR: 7, hR: 3.6, rudders: 1, rudMax: 35, rudTime: 28, respTime: 7, turnDia: 230, bowAnchors: 2, sternAnchors: 0, chainLen: 247, anchorW: 1.8, chainW: 30, lineR: 18, lineLen: 170, windAL: 520, windAF: 150, windXc: -9, flags: 'vn' } },

  { id: 'khach40', type: 'Tàu khách', name: 'Tàu khách 40 m (mẫu)', spec: {
    L: 40, B: 8, D: 3.4, T: 1.9, H: 14, bow: 'raked', rake: 2.5, stern: 'transom', tb: 1.1, shA: 0.2, shF: 0.8, par: [-8, 6], ts: 0.82, bp: 1.7, sec: 'round',
    opts: { colors: C('#e4e6e8', '#eceeef', '#6b7378', '#2c5684') },
    build: ({ deck: d, hb }) => { const z1 = d(-4), t1 = z1 + 2.5, t2 = t1 + 2.4, br = t2 + 2.2; return {
      blocks: [{ k: 't1', x0: -17, x1: 12, h: 2.5, w: 7.2, fw: 0.86, sl: 1.4, win: true }, { k: 't2', x0: -12, x1: 5.5, h: 2.4, w: 6.6, sl: 1.2, win: true, lip: { s: 0.3, f: 0.4, a: 1.2 } },
        { k: 'bridge', x0: 1.6, x1: 5.3, z0: t2, h: 2.2, w: 5.6, sl: 0.8, visor: 0.5 }],
      anchors: [16.8, d(16.8) - 1],
      lights: { mast1: [3, br + 3.6], side: [4.6, t2 + 1], stern: [-19.8, d(-19.8) + 1], anchF: [18, d(18) + 2.5], nuc: [3, br + 1.8] }, eye: [4, t2 + 1.6],
      fits: [...radarMast(2.6, br, 3, 40), ...common(40, d, hb, [15, 6, -10, -18.5]), F('windlass', 15.6, 0, d(15.6), { l: 1.2, w: 1.4, h: 0.8 }),
        ...[-9.5, -6.5, -3.5, -0.5].flatMap((x) => both('raft', x, 2.85, t2, {})), ...[-11, -9, -7, -5, -3].flatMap((x) => both('locker', x, 1.3, t2, { l: 1.6, w: 0.5, h: 0.45 })),
        ...both('funnel', -11.4, 2.4, t2, { l: 1.0, w: 0.7, h: 1.3 }), ...both('searchlight', 4.6, 2.2, br, {}), F('horn', 3.6, 0.6, br, {}), ...both('whip', 1.2, 2, br, { h: 3 })] }; } },
    ship: { loa: 40, B: 8, D: 3.4, T: 1.9, cb: 0.52, engines: 2, ptype: 'fpp', vmax: 14, rpm: 1800, gear: 3, accTime: 20, propD: 1.1, PD: 0.9, AR: 1.2, hR: 1.0, rudders: 2, rudMax: 35, rudTime: 15, respTime: 4, turnDia: 120, bowAnchors: 1, sternAnchors: 0, chainLen: 110, anchorW: 0.3, chainW: 7, lineR: 10, lineLen: 80, windAL: 215, windAF: 48, windXc: -1, flags: 'vn' } },

  { id: 'lai30', type: 'Tàu lai', name: 'Tàu lai 30 m, 2 chân vịt (mẫu)', spec: {
    L: 30, B: 10, D: 4.6, T: 3.6, H: 16, bow: 'tug', rake: 2.2, stern: 'transom', tb: 1.15, shA: 0.15, shF: 1.1, fc: { x0: 1.5, h: 1.0 }, par: [-5, 3], ts: 0.78, bp: 1.5, sec: 'round',
    bulwarks: [[-14.7, 14.4, 0.85]], opts: { colors: C('#26292c', '#f0ebdf', '#6d3a2c', '#9c3428') },
    build: ({ deck: d, hb }) => { const z1 = d(-4), t1 = z1 + 2.5, br = t1 + 2.6; return {
      blocks: [{ k: 't1', x0: -4.5, x1: 9, h: 2.5, w: 7.4, sl: 0.5, win: true, tw: 0.96, lip: { s: 0.3, f: 0.3, a: 0.4 } }, { k: 'bridge', x0: -0.5, x1: 6.5, z0: t1, h: 2.6, w: 7.6, sl: -0.6, sa: -0.3, win: true, visor: 0.5 }],
      anchors: [12.6, d(12.6) - 1.4],
      lights: { mast1: [2.6, br + 4.4], mast2: [2.6, br + 3.2], side: [5.8, t1 + 0.9], stern: [-14.6, d(-14.6) + 1.3], anchF: [13.4, d(13.4) + 2.5], nuc: [2.4, br + 1.8] }, eye: [5, t1 + 1.7],
      fits: [...both('funnel', -3.2, 2.7, t1, { l: 1.5, w: 1.1, h: 3.4 }), ...radarMast(2.4, br, 3.8, 30), ...common(30, d, hb, [11.6, 3, -6, -12]),
        F('fender', 14.6, 0, d(14.6) - 1.7, { l: 4, w: 0.8, h: 0.8, rot: 90 }), F('fender', 12.9, 3.2, d(12.9) - 1.5, { l: 3.6, w: 0.8, h: 0.8, rot: 55 }), F('fender', 12.9, -3.2, d(12.9) - 1.5, { l: 3.6, w: 0.8, h: 0.8, rot: -55 }),
        ...both('fender', 3, 4.95, d(3) - 1.1, { l: 14, w: 0.5, h: 0.5 }), F('fender', -14.8, 0, d(-14.8) - 1.3, { l: 7, w: 0.7, h: 0.7, rot: 90 }),
        F('windlass', -7, 0, d(-7), { l: 2.4, w: 3.6, h: 1.6 }), F('bollard', -12.6, 0, d(-12.6), { l: 1.6, w: 0.6, h: 0.9 }), F('windlass', 11.4, 0, d(11.4), { l: 1.2, w: 1.6, h: 0.9 }),
        ...both('vent', -9.5, 3.2, d(-9.5), { n: 2, rot: 180 }), ...both('locker', -5.6, 3.6, d(-5.6), { l: 1.2, w: 0.7, h: 0.9 }), ...both('searchlight', 5.6, 2.6, br, {}), F('horn', 1.4, 0.7, br, {}), F('raft', -4, 0, t1, { rot: 90 })] }; } },
    ship: { loa: 30, B: 10, D: 4.6, T: 3.6, cb: 0.58, engines: 2, ptype: 'fpp', vmax: 12, rpm: 1600, gear: 6, accTime: 15, propD: 2.4, PD: 0.75, AR: 1.0, hR: 1.4, rudders: 2, rudMax: 35, rudTime: 12, respTime: 3, turnDia: 30, bowAnchors: 1, sternAnchors: 0, chainLen: 165, anchorW: 0.6, chainW: 13, lineR: 22, lineLen: 150, windAL: 150, windAF: 75, windXc: 1.5, flags: 'vn' } },

  { id: 'phao62', type: 'Tàu pháo', name: 'Tàu pháo nhỏ 62 m (mẫu)', model: () => {
      const m = makeTemplate(); let n = 0; const add = (kind, x, y, z, o) => m.fits.push(Object.assign({ id: 'x' + (++n).toString(36) + Math.random().toString(36).slice(2, 5), kind, x, y, z, rot: 0 }, o || {}));
      for (const s of [-1, 1]) { add('chaff', 6.6, s * 3.0, 7.6, { l: 1.2, w: 1.0, h: 1.0, rows: 2, cols: 3, el: 50, rot: s * 50 }); add('raft', -9.5, s * 3.1, 7.6); add('raft', -11.5, s * 3.1, 7.6); add('locker', -15, s * 3.9, 5.0, { l: 1.3, w: 0.7, h: 0.85 }); add('vent', 16.5, s * 2.4, 5.6, { n: 1, h: 0.9, l: 0.55, w: 0.55 }); add('whip', 4, s * 2.9, 12.4, { h: 4 }); }
      add('staff', 30.4, 0, 6.85, { h: 2.4 }); add('staff', -30.6, 0, 5.0, { h: 3.2 }); add('dome', 2.6, 0, 12.4, { l: 0.8, w: 0.8, h: 1.2 }); add('dome', -2, 1.6, 10, { l: 0.9, w: 0.9, h: 1.3 }); add('breakwater', 17.6, 0, 5.75, { l: 1.2, w: 6.6, h: 0.9 });
      return m;
    },
    ship: { loa: 62, lpp: 58, B: 9.5, D: 5.0, tf: 2.7, ta: 2.9, cb: 0.48, engines: 2, ptype: 'fpp', rudMax: 25, rudders: 2, vmax: 24, rpm: 1000, gear: 2.5, accTime: 40, propD: 1.9, PD: 1.0, AR: 2.6, hR: 1.8, rudTime: 15, respTime: 5, turnDia: 300, bowAnchors: 2, sternAnchors: 0, chainLen: 150, anchorW: 0.8, chainW: 13, lineR: 14, lineLen: 110, windAL: 420, windAF: 105, windXc: 0, flags: 'hq' } },

  { id: 'tenlua50', type: 'Tàu tên lửa', name: 'Tàu tên lửa nhỏ 50 m (mẫu)', spec: {
    L: 50, B: 8.6, D: 4.4, T: 2.4, H: 18, bow: 'raked', rake: 4, stern: 'transom', tb: 0.85, shA: 0.1, shF: 1.4, par: [-10, 4], ts: 0.86, bp: 1.6, sec: 'v', bulwark: [16, 24.6, 0.9],
    opts: { colors: C('#9aa3a9', '#a9b1b6', '#5f686e', '#1d2124'), hullNo: '201' },
    build: ({ deck: d, hb }) => { const z1 = d(-1), t1 = z1 + 2.4, br = t1 + 2.4; return {
      blocks: [{ k: 't1', x0: -10, x1: 8.5, h: 2.4, w: 6.6, fw: 0.9, sl: 1, sa: 0.3, tw: 0.86 }, { k: 'bridge', x0: 2.5, x1: 7.6, z0: t1, h: 2.4, w: 6.0, sl: 0.9, sa: 0.3, tw: 0.86, visor: 0.3 }],
      wings: { x0: 4.8, x1: 7.2, z: t1, span: 3.9, w: 3.0, t: 0.35 }, anchors: [20.5, d(20.5) - 1.6],
      lights: { mast1: [-0.5, t1 + 8.6], side: [6.8, t1 + 0.9], stern: [-24.7, d(-24.7) + 1], anchF: [23, d(23) + 2.6], anchA: [-24, d(-24) + 2], nuc: [-0.5, t1 + 5.5] }, eye: [5.8, t1 + 1.6],
      fits: [F('latmast', -0.5, 0, t1, { l: 1.4, w: 1.4, h: 7 }), F('radar', -0.5, 0, t1 + 7.1, { l: 2.6, w: 0.5, h: 1 }), F('dome', 4, 0, br, { l: 1.2, w: 1.2, h: 1.8 }), F('dome', 1.2, 0, br, { l: 0.7, w: 0.7, h: 1.1 }),
        F('turret', 13.5, 0, d(13.5), { l: 3, w: 2.6, h: 1.7, n: 1, bl: 3.2 }), F('turret', -21.5, 0, d(-21.5), { l: 2, w: 1.8, h: 1.4, n: 1, bl: 1.8, rot: 180 }), F('dome', -18.6, 0, d(-18.6), { l: 1.0, w: 1.0, h: 1.9 }),
        ...both('launcher', -15, 2.3, d(-15), { l: 5.6, w: 1.9, h: 2, rows: 2, cols: 2, el: 10, rot: 6 }), ...both('whip', -3, 2.4, t1, { h: 5 }), ...both('whip', -7, 2.2, t1, { h: 4 }), ...both('raft', -8, 2.6, t1, {}), ...both('raft', -6.2, 2.6, t1, {}),
        ...both('searchlight', 6.2, 3.6, t1 + 0.35, {}), F('horn', 3.2, 0.8, br, {}), F('windlass', 19, 0, d(19), { l: 1.1, w: 1.3, h: 0.7 }),
        ...common(50, d, hb, [18, 9.5, -12, -23]), ...navyKit({ L: 50, d, hb, x0: -10, x1: 8.5, t1, w: 6.6 * 0.86 })] }; } },
    ship: { loa: 50, B: 8.6, D: 4.4, T: 2.4, cb: 0.45, engines: 2, ptype: 'fpp', vmax: 32, rpm: 1500, gear: 2.5, accTime: 30, propD: 1.3, PD: 1.1, AR: 1.5, hR: 1.2, rudders: 2, rudMax: 30, rudTime: 12, respTime: 4, turnDia: 260, bowAnchors: 1, sternAnchors: 0, chainLen: 100, anchorW: 0.5, chainW: 8.5, lineR: 12, lineLen: 80, windAL: 260, windAF: 70, windXc: 0, flags: 'hq' } },

  { id: 'loi35', type: 'Tàu phóng lôi', name: 'Tàu phóng lôi nhỏ 35 m (mẫu)', spec: {
    L: 35, B: 7.4, D: 3.8, T: 1.9, H: 14, bow: 'raked', rake: 3, stern: 'transom', tb: 0.8, shF: 1.1, par: [-7, 3], ts: 0.86, bp: 1.6, sec: 'v', bulwark: [11, 17.2, 0.8],
    opts: { colors: C('#8d969c', '#9aa3a9', '#5f686e', '#1d2124'), hullNo: '332' },
    build: ({ deck: d, hb }) => { const z1 = d(0), t1 = z1 + 2.2, br = t1 + 2.2; return {
      blocks: [{ k: 't1', x0: -5.5, x1: 7, h: 2.2, w: 5.6, fw: 0.9, sl: 0.8, sa: 0.25, tw: 0.86 }, { k: 'bridge', x0: 2, x1: 6.2, z0: t1, h: 2.2, w: 5.0, sl: 0.8, sa: 0.25, tw: 0.86, visor: 0.25 }],
      wings: { x0: 4.2, x1: 5.9, z: t1, span: 3.2, w: 2.5, t: 0.3 }, anchors: [14.5, d(14.5) - 1.3],
      lights: { mast1: [-1, t1 + 6.1], side: [5.6, t1 + 0.8], stern: [-17.4, d(-17.4) + 0.9], anchF: [16.3, d(16.3) + 2], nuc: [-1, t1 + 4] }, eye: [4.6, t1 + 1.5],
      fits: [F('latmast', -1, 0, t1, { l: 1.1, w: 1.1, h: 5 }), F('radar', -1, 0, t1 + 5.1, { l: 2, w: 0.4, h: 0.9 }), F('dome', 3.6, 0, br, { l: 0.8, w: 0.8, h: 1.3 }),
        F('turret', 10, 0, d(10), { l: 2.2, w: 1.9, h: 1.5, n: 2, bl: 2 }), F('turret', -15.5, 0, d(-15.5), { l: 1.8, w: 1.6, h: 1.3, n: 2, bl: 1.6, rot: 180 }),
        ...both('torpedo', -10, 2.1, d(-10), { l: 6.5, w: 1.5, h: 1.3, n: 2, rot: 7 }), ...both('raft', -4, 2.3, t1, {}), ...both('whip', -3, 2, t1, { h: 4 }), ...both('searchlight', 5.2, 2.9, t1 + 0.3, {}),
        F('windlass', 13.6, 0, d(13.6), { l: 0.9, w: 1.1, h: 0.6 }), ...common(35, d, hb, [13, 8, -12.5, -16.4]), ...navyKit({ L: 35, d, hb, x0: -5.5, x1: 7, t1, w: 5.6 * 0.86 })] }; } },
    ship: { loa: 35, B: 7.4, D: 3.8, T: 1.9, cb: 0.42, engines: 2, ptype: 'fpp', vmax: 35, rpm: 1500, gear: 2.3, accTime: 25, propD: 1.0, PD: 1.15, AR: 0.9, hR: 0.9, rudders: 2, rudMax: 30, rudTime: 10, respTime: 3, turnDia: 200, bowAnchors: 1, sternAnchors: 0, chainLen: 80, anchorW: 0.3, chainW: 6, lineR: 10, lineLen: 60, windAL: 150, windAF: 45, windXc: 0, flags: 'hq' } },

  { id: 'tuan45', type: 'Tàu tuần tra', name: 'Tàu tuần tra 45 m (mẫu)', spec: {
    L: 45, B: 8.2, D: 4.4, T: 2.4, H: 17, bow: 'raked', rake: 3.6, stern: 'transom', tb: 0.9, shF: 1.4, par: [-9, 4], ts: 0.86, bp: 1.6, sec: 'v', bulwark: [14, 22, 0.9],
    opts: { colors: C('#d3d7da', '#e1e4e6', '#3f7a4c', '#23282b'), hullNo: '4032', hullNoCol: '#1d2a3a' },
    build: ({ deck: d, hb }) => { const z1 = d(-0.5), t1 = z1 + 2.5, br = t1 + 2.4; return {
      blocks: [{ k: 't1', x0: -9, x1: 8, h: 2.5, w: 6.4, fw: 0.92, sl: 1.1, sa: 0.3, tw: 0.88 }, { k: 'bridge', x0: 2.2, x1: 7.4, z0: t1, h: 2.4, w: 6.0, sl: 1, sa: 0.3, tw: 0.88, visor: 0.3 }],
      wings: { x0: 4.6, x1: 7, z: t1, span: 3.9, w: 3.0, t: 0.35 }, anchors: [18.5, d(18.5) - 1.6],
      lights: { mast1: [-1, t1 + 7.6], side: [6.6, t1 + 0.9], stern: [-22.2, d(-22.2) + 1], anchF: [21, d(21) + 2.6], anchA: [-21.6, d(-21.6) + 2], nuc: [-1, t1 + 5] }, eye: [5.6, t1 + 1.6],
      fits: [F('latmast', -1, 0, t1, { l: 1.4, w: 1.4, h: 6.2 }), F('radar', -1, 0, t1 + 6.3, { l: 2.4, w: 0.5, h: 1 }), F('dome', 4.5, 0, br, { l: 1.1, w: 1.1, h: 1.7 }), F('dome', -5, 1.6, t1, { l: 0.9, w: 0.9, h: 1.3 }), F('dome', -5, -1.6, t1, { l: 0.9, w: 0.9, h: 1.3 }),
        F('turret', 12.5, 0, d(12.5), { l: 2.6, w: 2.2, h: 1.6, n: 1, bl: 2.8 }), F('boat', -16, 0, d(-16) + 0.3, { l: 6, w: 2.3, h: 1.6 }), F('crane', -12, 2.6, d(-12), { l: 6, w: 1.0, h: 2.6, el: 35, rot: 200 }),
        ...both('raft', -7, 2.6, t1, {}), ...both('raft', -5.2, 2.7, t1, {}), ...both('searchlight', 6, 3.6, t1 + 0.35, {}), ...both('whip', -4, 2.5, t1, { h: 5 }), ...both('whip', 0.5, 2.6, t1, { h: 3.5 }),
        F('horn', 3, 0.8, br, {}), F('windlass', 17, 0, d(17), { l: 1.1, w: 1.3, h: 0.7 }), ...both('turret', -3.4, 3.4, d(-3.4), { l: 1.0, w: 0.8, h: 1.2, n: 1, bl: 1.4, rot: 90 }),
        ...common(45, d, hb, [16.5, 10, -12, -20.5]), ...navyKit({ L: 45, d, hb, x0: -9, x1: 8, t1, w: 6.4 * 0.88 })] }; } },
    ship: { loa: 45, B: 8.2, D: 4.4, T: 2.4, cb: 0.46, engines: 2, ptype: 'fpp', vmax: 24, rpm: 1800, gear: 3, accTime: 30, propD: 1.3, PD: 1.0, AR: 1.6, hR: 1.3, rudders: 2, rudMax: 30, rudTime: 12, respTime: 4, turnDia: 230, bowAnchors: 1, sternAnchors: 0, chainLen: 110, anchorW: 0.5, chainW: 8.5, lineR: 12, lineLen: 90, windAL: 245, windAF: 66, windXc: 1, flags: 'hq' } },

  { id: 'hove100', type: 'Tàu hộ vệ', name: 'Tàu hộ vệ 100 m (mẫu)', spec: {
    L: 100, B: 13, D: 7.6, T: 3.9, H: 34, bow: 'raked', rake: 7, stern: 'transom', tb: 0.85, shA: 0.2, shF: 2.6, par: [-22, 10], ts: 0.82, bp: 1.65, sec: 'v', bulwark: [36, 49, 1.1],
    opts: { colors: C('#8d969c', '#9aa3a9', '#5f686e', '#1d2124'), hullNo: '015' },
    build: ({ deck: d, hb }) => { const z1 = d(4), t1 = z1 + 2.6, t2 = t1 + 2.6, br = t2 + 2.6, hg = d(-20) + 6.2; return {
      blocks: [{ k: 'box', x0: -28, x1: -12, h: 6.2, w: 10.4, sl: 0.4, tw: 0.88 }, { k: 't1', x0: -12, x1: 21, h: 2.6, w: 11, fw: 0.9, sl: 1.4, tw: 0.9 }, { k: 't2', x0: -3.5, x1: 15.5, z0: t1, h: 2.6, w: 9.4, sl: 1.2, sa: 0.4, tw: 0.88 },
        { k: 'bridge', x0: 9, x1: 15, z0: t2, h: 2.6, w: 8.6, sl: 1, sa: 0.4, tw: 0.88, visor: 0.4 }],
      wings: { x0: 12, x1: 14.6, z: t2, span: 5.8, w: 4.2, t: 0.4 }, anchors: [44, d(44) - 2.4],
      lights: { mast1: [4, t2 + 12.3], mast2: [-20, hg + 6], side: [14.4, t2 + 0.9], stern: [-49.6, d(-49.6) + 1.3], anchF: [47, d(47) + 3], anchA: [-49, d(-49) + 3], nuc: [4, t2 + 7] }, eye: [13.6, t2 + 1.7],
      fits: [F('funnel', -6.6, 0, t1, { l: 4.4, w: 3.2, h: 4, n: 0 }), F('latmast', 4, 0, t2, { l: 2.4, w: 2.4, h: 10 }), F('radar', 4, 0, t2 + 10.1, { l: 4, w: 0.6, h: 1.4 }), F('latmast', -20, 0, hg, { l: 1.6, w: 1.6, h: 5 }), F('radar', -20, 0, hg + 5.1, { l: 2.6, w: 0.5, h: 1 }),
        F('dome', 12, 0, br, { l: 2, w: 2, h: 2.6 }), F('dome', 9.4, 0, br, { l: 1, w: 1, h: 1.5 }), F('turret', 29, 0, d(29), { l: 5, w: 4, h: 2.6, n: 1, bl: 6 }), F('turret', -16, 0, hg, { l: 1.8, w: 1.8, h: 2, n: 1, bl: 1.8, rot: 180 }),
        F('launcher', 18, 0, t1, { l: 2.4, w: 2.6, h: 1.6, rows: 2, cols: 4, el: 0 }), ...both('launcher', 0, 3.2, t2, { l: 5, w: 2, h: 2.2, rows: 2, cols: 2, el: 15, rot: 80 }),
        ...both('torpedo', -10, 4.4, d(-10), { l: 4, w: 1.8, h: 1.2, n: 3, rot: 70 }), ...both('boat', -12.5, 5.2, t1, { l: 6, w: 2, h: 1.6 }), ...sideO('davit', -12.5, 4.2, t1, { l: 4, w: 1.6, h: 3 }),
        ...both('whip', -1, 4, t2, { h: 6 }), ...both('whip', -9, 4.4, t1, { h: 5 }), ...both('searchlight', 14, 5.4, t2 + 0.4, {}), ...both('raft', 2, 5.1, t1, {}), ...both('raft', 4, 5.1, t1, {}), ...both('raft', 6, 5.1, t1, {}),
        ...both('dome', -4, 3.2, t2, { l: 1.2, w: 1.2, h: 1.6 }), F('horn', 11, 1, br, {}), ...both('windlass', 41, 1.6, d(41), { l: 1.6, w: 1.8, h: 1 }), F('breakwater', 34.5, 0, d(34.5), { l: 1.4, w: 8, h: 1.0 }),
        ...common(100, d, hb, [39, 24, -30, -46]), ...navyKit({ L: 100, d, hb, x0: -12, x1: 21, t1, w: 11 * 0.9 * 0.9 })] }; } },
    ship: { loa: 100, B: 13, D: 7.6, T: 3.9, cb: 0.47, engines: 2, ptype: 'fpp', vmax: 28, rpm: 1000, gear: 4, accTime: 60, propD: 3.0, PD: 1.1, AR: 6, hR: 2.6, rudders: 2, rudMax: 35, rudTime: 15, respTime: 5, turnDia: 420, bowAnchors: 1, sternAnchors: 0, chainLen: 220, anchorW: 2, chainW: 30, lineR: 20, lineLen: 170, windAL: 1050, windAF: 210, windXc: -2, flags: 'hq' } },

  { id: 'dobo80', type: 'Tàu đổ bộ', name: 'Tàu đổ bộ 80 m, cầu dẫn mũi (mẫu)', spec: {
    L: 80, B: 14.6, D: 6.6, T: 2.9, H: 26, bow: 'flat', bw: 0.55, stern: 'transom', tb: 1.0, shA: 0.2, shF: 1.0, par: [-25, 22], ts: 0.88, bp: 2.2, sec: 'box', br: 0.8, bulwarks: [[26, 39.4, 1.2], [-39.7, -30, 1.0]],
    opts: { colors: C('#7b8995', '#8a98a3', '#56626c', '#1d2124'), hullNo: '571' },
    build: ({ deck: d, hb }) => { const z1 = d(-28), t1 = z1 + 2.7, t2 = t1 + 2.7, br = t2 + 2.6; return {
      blocks: [{ k: 't1', x0: -38, x1: -18, h: 2.7, w: 13, sl: 0.6, tw: 0.92 }, { k: 't2', x0: -36, x1: -22, h: 2.7, w: 11.6, sl: 0.6, tw: 0.92, lip: { s: 0.3, f: 0.4, a: 0.3 } }, { k: 'bridge', x0: -33, x1: -24.5, z0: t2, h: 2.6, w: 12.4, sl: 0.8, tw: 0.92, visor: 0.4 }],
      wings: { x0: -27, x1: -24.8, z: t2, span: 7.2, w: 6.2 }, anchors: [36.5, d(36.5) - 2.2],
      lights: { mast1: [-29, br + 7.3], side: [-25, t2 + 1], stern: [-39.6, d(-39.6) + 1.3], anchF: [38, d(38) + 3.5], anchA: [-39, d(-39) + 3], nuc: [-29, br + 4.5] }, eye: [-25.8, t2 + 1.7],
      fits: [F('funnel', -36.9, 0, t1, { l: 2, w: 2.8, h: 4, n: 0 }), F('latmast', -29, 0, br, { l: 1.8, w: 1.8, h: 6 }), F('radar', -29, 0, br + 6.1, { l: 3, w: 0.5, h: 1.1 }), F('dome', -26, 0, br, { l: 1.4, w: 1.4, h: 2 }), F('dome', -31.6, 1.6, br, { l: 0.9, w: 0.9, h: 1.3 }),
        F('ramp', 39.2, 0, d(39.2) - 0.2, { l: 0.5, w: 6.5, h: 5.5, el: 8 }), F('hatch', 6, 0, d(6), { l: 16, w: 8, h: 0.9 }), F('hatch', -8, 0, d(-8), { l: 6, w: 5, h: 0.7 }),
        ...both('crane', -14, 5, d(-14), { l: 12, w: 1.8, h: 4, el: 25, rot: 160 }), ...both('turret', 30, 3.8, d(30), { l: 1.8, w: 1.6, h: 1.4, n: 2, bl: 2 }), ...both('turret', -20, 6, t1, { l: 1.6, w: 1.4, h: 1.3, n: 2, bl: 1.8, rot: 90 }),
        ...both('raft', -34.8, 5, t2, {}), ...both('raft', -21, 5.6, t1, {}), ...both('searchlight', -25.6, 6.6, t2 + 0.5, {}), ...both('whip', -31, 4, br, { h: 5 }), ...both('windlass', 34.5, 2, d(34.5), { l: 1.6, w: 1.8, h: 1 }),
        ...both('windlass', -38.6, 3.4, d(-38.6), { l: 1.6, w: 2, h: 1.1, rot: 90 }), ...common(80, d, hb, [24, 10, -16, -36.5]), ...navyKit({ L: 80, d, hb, x0: -38, x1: -18, t1, w: 13 * 0.92 })] }; } },
    ship: { loa: 80, B: 14.6, D: 6.6, T: 2.9, cb: 0.7, engines: 2, ptype: 'fpp', vmax: 15, rpm: 1000, gear: 4, accTime: 50, propD: 2.2, PD: 0.9, AR: 5, hR: 2.3, rudders: 2, rudMax: 35, rudTime: 15, respTime: 5, turnDia: 330, bowAnchors: 1, sternAnchors: 1, chainLen: 250, anchorW: 2, chainW: 26, lineR: 18, lineLen: 160, windAL: 820, windAF: 235, windXc: -6, flags: 'hq' } }
];
