// Thư viện chi tiết đặt sẵn (thuần JS): cột dàn lưới, radar quay, ăng-ten, bè, neo, tời, cột bích, đèn pha, còi, cầu thang,
// ống khói, tháp pháo, giá phóng, xuồng, cần cẩu hàng, nắp hầm hàng, container, ống phóng lôi, cửa mũi, đường ống boong, đệm va,
// cột đơn, ống thông gió, cần xuồng, ống phóng mồi bẫy, thùng boong, cột cờ mũi / lái, tấm chắn sóng, cầu chằng container. Hình CHUNG CHUNG theo kích thước người dùng nhập — không theo mẫu tàu thật nào.
// Chi tiết f = { id, kind, x, y, z (điểm đặt: giữa đáy), rot (độ, từ hướng mũi sang mạn phải), l (dài theo hướng của nó), w (rộng), h (cao), … }.
// Hệ riêng khi dựng: u về trước, v sang phải, w lên từ điểm đặt.
import { Acc, TAcc, xform, newBB, box, cyl, tubeV, ellipsoid, loftRings } from './prims.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// scale: cỡ mặc định co giãn theo chiều dài tàu; mir: chi tiết đối xứng qua trục u (lấy đối xứng sang mạn kia: rot → −rot)
// hay qua mặt v–w (neo: rot → 180 − rot); side: đặt lên mạn tàu (không lên boong)
export const FIT_KINDS = {
  latmast: { name: 'Cột dàn lưới', l: 1.6, w: 1.6, h: 8, scale: true, tip: 'Cột dàn thép 4 chân, có sàn đỉnh, xà treo cờ, cột ngọn' },
  radar: { name: 'Radar quay', l: 3.2, w: 0.5, h: 1.2, scale: true, tip: 'Bệ + dàn anten, quay khi chạy bài' },
  dome: { name: 'Vòm radar / quang điện', l: 1.4, w: 1.4, h: 2.1, scale: true },
  whip: { name: 'Ăng-ten roi', l: 0.15, w: 0.15, h: 6 },
  raft: { name: 'Bè cứu sinh', l: 1.5, w: 0.7, h: 0.85 },
  anchor: { name: 'Neo mũi', l: 1.4, w: 0.5, h: 1.6, scale: true, mir: 'v', side: true, tip: 'Bấm lên mạn mũi tàu, chỗ lỗ neo' },
  windlass: { name: 'Tời neo', l: 1.4, w: 1.6, h: 0.9, scale: true },
  bollard: { name: 'Cột bích', l: 0.9, w: 0.4, h: 0.55 },
  searchlight: { name: 'Đèn pha', l: 0.6, w: 0.5, h: 1.1 },
  horn: { name: 'Còi', l: 0.8, w: 0.35, h: 0.5 },
  ladder: { name: 'Cầu thang', l: 2.4, w: 0.7, h: 2.5, tip: 'Chân thang ở điểm bấm, leo lên về phía trước (xoay để đổi hướng)' },
  funnel: { name: 'Ống khói', l: 3.4, w: 2.0, h: 3.2, scale: true },
  turret: { name: 'Tháp pháo', l: 3.2, w: 2.8, h: 1.8, scale: true, n: 1, bl: 4, tip: 'Nòng quay theo hướng xoay của chi tiết' },
  launcher: { name: 'Giá phóng', l: 2.6, w: 1.6, h: 1.6, scale: true, rows: 2, cols: 4, el: 15 },
  boat: { name: 'Xuồng', l: 5.5, w: 2.0, h: 1.4, scale: true },
  crane: { name: 'Cần cẩu hàng', l: 14, w: 2.4, h: 6, scale: true, el: 35, tip: 'h = chiều cao trụ + ca bin; l = chiều dài cần, el = góc ngóc cần; xoay để quay cần' },
  hatch: { name: 'Nắp hầm hàng', l: 12, w: 8, h: 1.4, scale: true, tip: 'Thành miệng hầm + các tấm nắp' },
  containers: { name: 'Container xếp chồng', l: 12.2, w: 9.8, h: 5.2, tip: 'Tự chia container 20 ft (6,1 × 2,44 × 2,6 m) theo kích thước khối, màu ngẫu nhiên' },
  torpedo: { name: 'Ống phóng lôi', l: 7, w: 1.4, h: 1.3, scale: true, n: 2, tip: 'n ống đặt cạnh nhau, miệng ống hướng theo chiều xoay' },
  ramp: { name: 'Cửa mũi / cầu dẫn', l: 0.45, w: 5, h: 6, scale: true, el: 12, tip: 'Tấm cầu dẫn dựng ở mũi, bản lề ở điểm đặt: h = chiều dài tấm, w = rộng, l = dày; el = góc ngả về phía mũi so với phương đứng; n = 1: có cáp nâng + tời' },
  pipes: { name: 'Đường ống boong', l: 30, w: 2.4, h: 1.6, tip: 'Bó ống chạy dọc boong + lối đi trên cao (tàu dầu)' },
  fender: { name: 'Đệm va', l: 6, w: 0.7, h: 0.7, tip: 'Ống cao su đen nằm ngang (tàu lai: đặt quanh mũi / lái)' },
  mast: { name: 'Cột đơn (có sàn, xà)', l: 3, w: 0.4, h: 7, scale: true, tip: 'Cột thép tròn thon dần, sàn radar ở 70% chiều cao, xà treo cờ; l = độ vươn của xà, w = đường kính chân cột' },
  vent: { name: 'Ống thông gió', l: 0.7, w: 0.7, h: 1.4, n: 1, tip: 'n = 1: kiểu nấm; n = 2: kiểu cổ ngỗng (miệng quay theo chiều xoay)' },
  davit: { name: 'Cần hạ xuồng', l: 5, w: 1.6, h: 2.6, scale: true, tip: 'Cặp cần cong vươn ra mạn (v hướng ra ngoài: mạn trái xoay 180°); đặt xuồng treo ở đầu cần' },
  chaff: { name: 'Ống phóng mồi bẫy', l: 1.2, w: 1.0, h: 1.0, rows: 2, cols: 3, el: 45, tip: 'Cụm ống ngóc lên el độ, hướng theo chiều xoay' },
  locker: { name: 'Thùng / tủ trên boong', l: 1.4, w: 0.8, h: 0.9 },
  staff: { name: 'Cột cờ mũi / lái', l: 0.12, w: 0.12, h: 3.5, tip: 'Cột mảnh có quả cầu đỉnh (cờ mũi ở sống mũi, cờ lái ở lái)' },
  breakwater: { name: 'Tấm chắn sóng mũi', l: 1.2, w: 6, h: 1.1, scale: true, tip: 'Tấm chữ V có gân trên boong mũi, mũi chữ V hướng về trước' },
  lashing: { name: 'Cầu chằng container', l: 1.2, w: 14, h: 5, tip: 'Khung chằng buộc giữa các dãy container (w = bề ngang, h = cao)' }
};
// cỡ mặc định khi đặt mới trên tàu dài L (m)
export function fitDefaults(kind, L) {
  const K = FIT_KINDS[kind]; if (!K) return null; const k = K.scale ? clamp((L || 60) / 60, 0.6, 1.5) : 1, r = (v) => Math.round(v * 100) / 100;
  const o = { kind, rot: 0, l: r(K.l * k), w: r(K.w * k), h: r(K.h * k) };
  for (const e of ['n', 'bl', 'rows', 'cols', 'el']) if (K[e] !== undefined) o[e] = e === 'bl' ? r(K[e] * k) : K[e];
  return o;
}
// đối xứng sang mạn kia
export function mirrorFit(f) { const K = FIT_KINDS[f.kind] || {}, g = JSON.parse(JSON.stringify(f)); g.y = -f.y; g.rot = K.mir === 'v' ? 180 - (f.rot || 0) : -(f.rot || 0); return g; }

const B = {
  latmast(K, f, I) {
    const h = f.h, wb = f.w, wt = Math.max(0.3, wb * 0.3), A = K('white'), rb = clamp(wb * 0.035, 0.035, 0.09), rd = rb * 0.55;
    const half = (t) => (wb + (wt - wb) * t) / 2, S4 = [[1, 1], [-1, 1], [-1, -1], [1, -1]], C = (t, k) => { const a = half(t); return [S4[k][0] * a, S4[k][1] * a, h * t]; };
    for (let k = 0; k < 4; k++) cyl(A, C(0, k), C(1, k), rb, rb * 0.8, 6);
    const nb = Math.max(3, Math.round(h / Math.max(0.8, wb * 0.85)));
    for (let i = 0; i < nb; i++) { const t0 = i / nb, t1 = (i + 1) / nb; for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; cyl(A, C(t1, k), C(t1, k2), rd, rd, 4); cyl(A, C(t0, k), C(t1, k2), rd * 0.8, rd * 0.8, 4); cyl(A, C(t0, k2), C(t1, k), rd * 0.8, rd * 0.8, 4); } }
    box(A, 0, 0, h + 0.04, wt * 2.6, wt * 2.6, 0.08); // sàn đỉnh
    const tm = h * 0.22; cyl(A, [0, 0, h], [0, 0, h + tm], Math.max(0.05, wt * 0.18), Math.max(0.03, wt * 0.08), 8); // cột ngọn
    const yz = h * 0.86, ys = half(0.86) + Math.max(0.6, wb * 0.5); cyl(A, [0, -ys, yz], [0, ys, yz], rd * 1.3, rd * 1.3, 6); // xà treo cờ
    I.yard = { z: f.z + yz, span: ys }; I.top = f.z + h + tm;
  },
  radar(K, f, I, mv, accs) {
    const h = Math.max(0.6, f.h), l = f.l, D = K('dark'), ph = Math.max(0.2, h - 0.45), r = clamp(l * 0.045, 0.08, 0.2);
    cyl(D, [0, 0, 0], [0, 0, ph], r * 1.35, r, 10);
    // phần quay (tâm quay ở đỉnh bệ): hộp số + dàn anten nằm ngang
    const acc = new Acc(accs.dark.col, true, 'spin'), m = xform(f), R = new TAcc(acc, m, I.bb);
    box(R, 0, 0, ph + 0.14, 0.42, 0.42, 0.28); box(R, 0.06, 0, ph + 0.28 + 0.16, 0.16, l, 0.32); box(R, 0.15, 0, ph + 0.28 + 0.16, 0.03, l * 0.96, 0.22);
    mv.push({ id: f.id, acc, pivot: m(0, 0, ph), rpm: f.rpm || 24 });
  },
  dome(K, f) { const d = Math.max(0.4, Math.min(f.l, f.w)), ph = Math.max(0.1, f.h - d); cyl(K('dark'), [0, 0, 0], [0, 0, ph + d * 0.12], d * 0.13, d * 0.11, 12); ellipsoid(K('white'), [0, 0, ph + d / 2], d / 2, d / 2, d / 2, 18, 12); },
  whip(K, f) { const h = Math.max(0.5, f.h); cyl(K('dark'), [0, 0, 0], [0, 0, 0.3], 0.07, 0.06, 8); cyl(K('white'), [0, 0, 0.3], [0, 0, h], 0.035, 0.012, 6); },
  raft(K, f) {
    const l = f.l, r = Math.max(0.15, Math.min(f.w, f.h) / 2 * 0.95), D = K('dark'), W = K('white'), zc = Math.max(r, f.h - r);
    for (const u of [-l * 0.3, l * 0.3]) box(D, u, 0, (zc - r * 0.4) / 2, 0.1, r * 1.8, Math.max(0.05, zc - r * 0.4));
    const e = r * 0.45, a = -l / 2 + e, b = l / 2 - e;
    cyl(W, [a, 0, zc], [b, 0, zc], r, r, 16); cyl(W, [a - e, 0, zc], [a, 0, zc], r * 0.55, r, 16); cyl(W, [b, 0, zc], [b + e, 0, zc], r, r * 0.55, 16);
    for (const u of [-l * 0.18, l * 0.18]) cyl(D, [u - 0.03, 0, zc], [u + 0.03, 0, zc], r * 1.03, r * 1.03, 16);
  },
  // neo ở lỗ neo trên mạn: v hướng ra ngoài mạn (mạn trái thì xoay 180°). Miệng lỗ neo (K('hawse')) nằm yên trên vỏ, quả neo rơi được;
  // I.attach: chỗ xích nối vào quả neo (đầu thân neo, sát miệng lỗ neo)
  anchor(K, f, I) {
    const h = f.h, l = f.l, M = K('metal'), t = Math.max(0.08, h * 0.09);
    cyl(K('hawse'), [0, -0.05, h * 0.42], [0, 0.2, h * 0.42], h * 0.17, h * 0.17, 14); I.attach = M.m(0, 0.12, h * 0.45);
    box(M, 0, 0.13, h * 0.05, t * 1.2, t, h * 0.8);
    box(M, 0, 0.15, -h * 0.38, l * 0.55, t * 1.6, t * 1.2);
    for (const s of [-1, 1]) cyl(M, [s * l * 0.22, 0.16, -h * 0.4], [s * l * 0.5, 0.22, -h * 0.05], t * 0.9, t * 0.25, 6);
  },
  windlass(K, f) {
    const l = f.l, w = f.w, h = f.h, D = K('dark'), M = K('metal'), zc = h * 0.55;
    box(D, 0, 0, 0.06, l, w, 0.12);
    cyl(M, [0, -w * 0.16, zc], [0, w * 0.16, zc], h * 0.38, h * 0.38, 16);
    for (const s of [-1, 1]) cyl(D, [0, s * w * 0.2, zc], [0, s * w * 0.48, zc], h * 0.3, h * 0.3, 14);
    box(D, -l * 0.3, 0, h * 0.38, l * 0.35, w * 0.3, h * 0.64);
  },
  bollard(K, f) {
    const l = f.l, w = f.w, h = f.h, D = K('dark'), r = Math.min(w * 0.42, l * 0.18);
    box(D, 0, 0, 0.03, l, w, 0.06);
    for (const s of [-1, 1]) { cyl(D, [s * l * 0.28, 0, 0], [s * l * 0.28, 0, h], r, r, 12); cyl(D, [s * l * 0.28, 0, h - 0.07], [s * l * 0.28, 0, h], r * 1.3, r * 1.3, 12); }
  },
  searchlight(K, f) {
    const l = f.l, w = f.w, h = f.h, D = K('dark'), zc = h * 0.75, r = w * 0.42;
    cyl(D, [0, 0, 0], [0, 0, zc - r], 0.07, 0.06, 8);
    box(D, 0, 0, zc - r * 0.95, 0.12, w * 1.02, 0.08); for (const s of [-1, 1]) box(D, 0, s * w * 0.5, zc - r * 0.45, 0.08, 0.05, r);
    cyl(K('super'), [-l * 0.4, 0, zc], [l * 0.35, 0, zc], r * 0.8, r, 14); cyl(K('white'), [l * 0.35, 0, zc], [l * 0.4, 0, zc], r * 0.92, r * 0.92, 14);
  },
  horn(K, f) { const l = f.l, w = f.w, zc = f.h * 0.7, D = K('dark'); cyl(D, [0, 0, 0], [0, 0, zc], 0.05, 0.05, 8); cyl(D, [-0.1, 0, zc], [0.1, 0, zc], 0.07, 0.07, 8); cyl(K('white'), [-l * 0.35, 0, zc], [l * 0.55, 0, zc], 0.05, w * 0.5, 14); },
  ladder(K, f) {
    const l = f.l, w = f.w, h = f.h, D = K('dark'), W = K('white'), n = Math.max(3, Math.round(h / 0.24));
    for (const s of [-1, 1]) { const v = s * w / 2; cyl(D, [0, v, 0], [l, v, h], 0.05, 0.05, 4); cyl(W, [0, v, 0.9], [l, v, h + 0.9], 0.025, 0.025, 5); cyl(W, [0, v, 0], [0, v, 0.9], 0.022, 0.022, 5); cyl(W, [l, v, h], [l, v, h + 0.9], 0.022, 0.022, 5); }
    for (let i = 1; i < n; i++) box(D, l * i / n, 0, h * i / n, Math.max(0.12, l / n * 0.9), w * 0.96, 0.04);
  },
  funnel(K, f) {
    const l = f.l, w = f.w, h = f.h, rk = h * 0.12, ring = (t, k) => ({ x: -rk * t, y: 0, z: h * t, rx: l / 2 * k, ry: w / 2 * k });
    if (f.n) { const B = K(['red', 'blue', 'green', 'yellow'][(f.n - 1) % 4]); tubeV(K('super'), [ring(0, 1), ring(0.45, 0.97), ring(0.58, 0.955)], 22); tubeV(B, [ring(0.58, 0.955), ring(0.76, 0.925)], 22); tubeV(K('super'), [ring(0.76, 0.925), ring(0.86, 0.9)], 22); }
    else tubeV(K('super'), [ring(0, 1), ring(0.45, 0.97), ring(0.86, 0.9)], 22);
    tubeV(K('dark'), [ring(0.86, 0.9), ring(1, 0.88)], 22);
    for (const s of [-1, 1]) cyl(K('dark'), [-rk * 0.95 + s * l * 0.12, 0, h * 0.9], [-rk * 1.05 + s * l * 0.12, 0, h * 1.12], Math.min(l, w) * 0.07, Math.min(l, w) * 0.06, 8); // ống xả nhô trên đỉnh
  },
  turret(K, f) {
    const l = f.l, w = f.w, h = f.h, S = K('super'), M = K('metal'), D = K('dark'), n = clamp(Math.round(f.n || 1), 1, 3), bl = f.bl > 0 ? f.bl : l * 1.2;
    const rb = Math.min(l, w) * 0.46, hb = h * 0.14; tubeV(D, [{ x: 0, y: 0, z: 0, r: rb }, { x: 0, y: 0, z: hb, r: rb }], 22);
    const ring = (k, top) => { const hw = w / 2 * k, tw = w * 0.34 * k, z0 = hb, z1 = hb + (h - hb) * top, zm = z0 + (z1 - z0) * 0.45; return [[-hw, z0], [hw, z0], [hw, zm], [tw, z1], [-tw, z1], [-hw, zm]]; };
    loftRings(S, [{ x: -l * 0.5, rings: [ring(0.92, 0.9)] }, { x: -l * 0.3, rings: [ring(1, 1)] }, { x: l * 0.15, rings: [ring(1, 1)] }, { x: l * 0.5, rings: [ring(0.78, 0.62)] }]);
    const bz = hb + (h - hb) * 0.42, e = Math.tan(5 * Math.PI / 180), r0 = clamp(w * 0.05, 0.05, 0.16), gap = w * 0.2;
    for (let i = 0; i < n; i++) { const v = (i - (n - 1) / 2) * gap, u0 = l * 0.4; cyl(M, [u0, v, bz], [u0 + bl, v, bz + bl * e], r0, r0 * 0.8, 10); cyl(M, [u0 + bl - 0.3, v, bz + (bl - 0.3) * e], [u0 + bl, v, bz + bl * e], r0 * 1.25, r0 * 1.25, 10); }
    box(D, l * 0.44, 0, bz, 0.22, Math.max(gap * n, w * 0.3), (h - hb) * 0.42);
  },
  launcher(K, f) {
    const l = f.l, w = f.w, h = f.h, rows = clamp(Math.round(f.rows || 2), 1, 4), cols = clamp(Math.round(f.cols || 4), 1, 8), el = f.el === undefined ? 15 : clamp(+f.el, 0, 60), D = K('dark');
    const ph = h * 0.32, mn = Math.min(l, w); cyl(D, [0, 0, 0], [0, 0, ph], mn * 0.22, mn * 0.18, 12); box(D, 0, 0, ph + 0.05, l * 0.3, w * 0.7, 0.1);
    const bh = Math.max(0.2, h - ph - 0.1) * Math.cos(el * Math.PI / 180), loc = { el, dw: ph + 0.1 + bh / 2 + Math.sin(el * Math.PI / 180) * l / 2 }, Sb = K('super', loc), T = K('dark', loc);
    box(Sb, 0, 0, 0, l, w, bh);
    const cw = w / cols, chh = bh / rows, rt = Math.min(cw, chh) * 0.36;
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { const v = -w / 2 + cw * (j + 0.5), z = -bh / 2 + chh * (i + 0.5); cyl(T, [l / 2 - 0.02, v, z], [l / 2 + 0.05, v, z], rt, rt, 10); }
  },
  boat(K, f) {
    const l = f.l, w = f.w, h = f.h;
    ellipsoid(K('orange'), [0, 0, h * 0.38], l / 2, w / 2, h * 0.38, 18, 10);
    box(K('white'), -l * 0.05, 0, h * 0.78, l * 0.5, w * 0.72, h * 0.34);
  },
  // cần cẩu: trụ tròn, ca bin, cần (hai thanh dàn) ngóc el độ về hướng u, móc treo
  crane(K, f) {
    const l = f.l, w = f.w, h = f.h, Y = K('yellow'), D = K('dark'), el = (f.el === undefined ? 35 : clamp(+f.el, 0, 80)) * Math.PI / 180, ph = h * 0.62, rp = w * 0.24;
    cyl(Y, [0, 0, 0], [0, 0, ph], rp * 1.1, rp, 16); cyl(D, [0, 0, ph - 0.1], [0, 0, ph + 0.05], rp * 1.35, rp * 1.35, 16);
    const hl = w * 1.15, hh = h - ph; box(Y, -hl * 0.1, 0, ph + hh / 2 + 0.05, hl, w * 0.85, hh); box(K('white'), hl * 0.36, w * 0.28, ph + hh * 0.62, hl * 0.22, w * 0.3, hh * 0.5);
    const p0 = [hl * 0.25, 0, ph + hh * 0.35], tip = [p0[0] + l * Math.cos(el), 0, p0[2] + l * Math.sin(el)], r = clamp(w * 0.05, 0.06, 0.18);
    for (const s of [-1, 1]) cyl(Y, [p0[0], s * w * 0.28, p0[2]], [tip[0], s * w * 0.05, tip[2]], r, r * 0.7, 6);
    for (let i = 1; i < 6; i++) { const t = i / 6, a = [p0[0] + (tip[0] - p0[0]) * t, 0, p0[2] + (tip[2] - p0[2]) * t], wv = w * (0.28 + (0.05 - 0.28) * t); cyl(Y, [a[0], -wv, a[2]], [a[0], wv, a[2]], r * 0.5, r * 0.5, 4); }
    cyl(D, [-hl * 0.3, 0, ph + hh + 0.05], tip, r * 0.25, r * 0.25, 4); // dây nâng cần
    const hk = Math.max(1, Math.min(tip[2] - 1, l * 0.25)); cyl(D, tip, [tip[0], 0, tip[2] - hk], r * 0.2, r * 0.2, 4); box(D, tip[0], 0, tip[2] - hk - 0.2, 0.35, 0.3, 0.4);
  },
  // nắp hầm hàng: thành miệng hầm (màu vỏ) + các tấm nắp hơi gồ (màu boong), gân ngang
  hatch(K, f) {
    const l = f.l, w = f.w, h = f.h, hc = h * 0.6, n = Math.max(1, Math.round(l / 4)), pl = l / n, P = K('deck'), D = K('dark');
    box(K('hull'), 0, 0, hc / 2, l, w, hc);
    for (let i = 0; i < n; i++) { const u = -l / 2 + pl * (i + 0.5); loftRings(P, [{ x: u - pl / 2 + 0.04, rings: [[[-w / 2, hc], [w / 2, hc], [w / 2, hc + (h - hc) * 0.55], [0, h], [-w / 2, hc + (h - hc) * 0.55]]] }, { x: u + pl / 2 - 0.04, rings: [[[-w / 2, hc], [w / 2, hc], [w / 2, hc + (h - hc) * 0.55], [0, h], [-w / 2, hc + (h - hc) * 0.55]]] }]); }
    for (let i = 1; i < n; i++) box(D, -l / 2 + pl * i, 0, hc + (h - hc) * 0.3, 0.1, w * 1.01, (h - hc) * 0.6);
  },
  // container 20 ft xếp theo dãy / hàng / tầng, màu theo băm số (vị trí đặt) để không đổi mỗi lần dựng
  containers(K, f) {
    const l = f.l, w = f.w, h = f.h, nb = Math.max(1, Math.round(l / 6.1)), nr = Math.max(1, Math.round(w / 2.44)), nt = Math.max(1, Math.round(h / 2.6)), cl = l / nb, cw = w / nr, ch = h / nt;
    const cols = ['red', 'blue', 'green', 'yellow', 'white', 'orange', 'cgrey', 'blue', 'red', 'cgrey'], seed = Math.round((f.x || 0) * 7 + (f.y || 0) * 13 + (f.z || 0) * 3);
    const hs = (a, b, c) => { let q = Math.imul(a + 31, 73856093) ^ Math.imul(b + 17, 19349663) ^ Math.imul(c + 7, 83492791) ^ Math.imul(seed, 2654435761); q = Math.imul(q ^ (q >>> 13), 1274126177); return ((q ^ (q >>> 16)) >>> 0) / 4294967296; };
    for (let i = 0; i < nb; i++) for (let j = 0; j < nr; j++) for (let k = 0; k < nt; k++) {
      if (k === nt - 1 && nt > 1 && hs(i, j, 99) < 0.18) continue; // tầng trên cùng thiếu vài chiếc
      const A = K(cols[Math.floor(hs(i, j, k) * cols.length)]), u = -l / 2 + cl * (i + 0.5), v = -w / 2 + cw * (j + 0.5), z = ch * k;
      box(A, u, v, z + ch * 0.48, cl - 0.18, cw - 0.1, ch * 0.96);
      box(A, u, v, z + ch * 0.48, cl - 0.05, cw - 0.32, ch * 0.9); // gân hai đầu (lồi nhẹ)
    }
  },
  // ống phóng lôi: n ống song song trên bệ, miệng ống về hướng u
  torpedo(K, f) {
    const l = f.l, w = f.w, h = f.h, n = clamp(Math.round(f.n || 2), 1, 4), S = K('super'), D = K('dark'), r = Math.min(w / n * 0.42, h * 0.36), zc = h - r * 1.05;
    box(D, -l * 0.05, 0, zc * 0.4, l * 0.45, w * 0.7, zc * 0.8); cyl(D, [-l * 0.05, 0, 0], [-l * 0.05, 0, zc * 0.25], w * 0.42, w * 0.42, 16);
    for (let i = 0; i < n; i++) { const v = (i - (n - 1) / 2) * (w / n); cyl(S, [-l / 2, v, zc], [l / 2, v, zc], r, r, 14); cyl(D, [l / 2 - 0.08, v, zc], [l / 2, v, zc], r * 1.12, r * 1.12, 14); cyl(D, [-l / 2, v, zc], [-l / 2 + 0.12, v, zc], r * 1.08, r * 1.08, 14); }
  },
  // cầu dẫn mũi: tấm dày l, rộng w, dài h dựng lên từ bản lề, ngả el độ về phía u; có gân ngang
  ramp(K, f) {
    const l = f.h, w = f.w, h = Math.min(f.l, f.h * 0.3), el = f.el === undefined ? 12 : clamp(+f.el, -30, 80), loc = { el: 90 - el };
    box(K('hull', loc), l / 2, 0, h / 2, l, w, h);
    const R = K('dark', loc); for (let i = 1; i < 5; i++) box(R, l * i / 5, 0, -0.04, 0.14, w * 0.96, 0.1);
    for (const s of [-1, 1]) box(R, l / 2, s * (w / 2 - 0.06), -0.06, l, 0.12, 0.14); // gờ hai mép
    cyl(K('dark'), [0, -w / 2, 0.1], [0, w / 2, 0.1], 0.18, 0.18, 10);
    if (f.n) { // cáp nâng cầu dẫn: từ hai góc trên của tấm về tời nhỏ phía sau trên boong
      const e = el * Math.PI / 180, top = [l * Math.sin(e), l * Math.cos(e)], D = K('dark'), back = -Math.max(3, l * 1.2);
      for (const s of [-1, 1]) { const v = s * (w / 2 - 0.25); cyl(D, [top[0], v, top[1]], [back, v * 1.05, 1.1], 0.03, 0.03, 4); box(D, back - 0.3, v * 1.05, 0.45, 1.0, 0.8, 0.9); cyl(K('metal'), [back - 0.3, v * 1.05 - 0.45, 0.6], [back - 0.3, v * 1.05 + 0.45, 0.6], 0.3, 0.3, 10); }
    }
  },
  // đường ống boong (tàu dầu): 3 ống dọc + lối đi trên cao có trụ đỡ
  pipes(K, f) {
    const l = f.l, w = f.w, h = f.h, P = K('white'), S = K('super'), D = K('dark'), rp = clamp(w * 0.07, 0.08, 0.25);
    for (const k of [-1, 0, 1]) { const v = k * w * 0.3, z = rp + 0.25; cyl(P, [-l / 2, v, z], [l / 2, v, z], rp, rp, 10); }
    for (let u = -l / 2 + 1; u <= l / 2 - 1; u += 4) { box(D, u, 0, 0.15, 0.2, w * 0.9, 0.3); cyl(D, [u, 0, 0], [u, 0, h - 0.08], 0.07, 0.07, 6); }
    box(S, 0, 0, h - 0.04, l, Math.min(1, w * 0.4), 0.08);
    for (const s of [-1, 1]) cyl(P, [-l / 2, s * Math.min(0.5, w * 0.2), h + 0.9], [l / 2, s * Math.min(0.5, w * 0.2), h + 0.9], 0.025, 0.025, 4);
  },
  // cột đơn: thân tròn thon, sàn có lan can ở 70%, xà treo cờ ở 86%, cột ngọn
  mast(K, f, I) {
    const h = f.h, r0 = Math.max(0.06, f.w / 2), A = K('white'), D = K('dark'), zp = h * 0.7, zy = h * 0.86, span = Math.max(0.6, f.l / 2), ps = Math.max(0.8, Math.min(2.4, h * 0.2));
    cyl(A, [0, 0, 0], [0, 0, h], r0, r0 * 0.45, 12);
    box(D, 0, 0, zp, ps, ps, 0.08); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) cyl(A, [a * ps / 2, b * ps / 2, zp], [a * ps / 2, b * ps / 2, zp + 0.7], 0.018, 0.018, 4);
    for (const [p0, p1] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) cyl(A, [p0[0] * ps / 2, p0[1] * ps / 2, zp + 0.7], [p1[0] * ps / 2, p1[1] * ps / 2, zp + 0.7], 0.018, 0.018, 4);
    for (const s of [-1, 1]) cyl(A, [0, 0, zp - ps * 0.6], [0, s * ps * 0.5, zp - 0.04], 0.03, 0.03, 4); // giá đỡ sàn
    cyl(A, [0, -span, zy], [0, span, zy], 0.045, 0.045, 6); const tm = h * 0.16; cyl(A, [0, 0, h], [0, 0, h + tm], r0 * 0.3, r0 * 0.15, 8);
    I.yard = { z: f.z + zy, span }; I.top = f.z + h + tm;
  },
  vent(K, f) {
    const l = f.l, w = f.w, h = f.h, r = Math.min(l, w) * 0.3, S = K('white'), D = K('dark');
    if ((f.n || 1) >= 2) { cyl(S, [0, 0, 0], [0, 0, h * 0.75], r, r, 12); cyl(S, [0, 0, h * 0.75], [r * 1.2, 0, h * 0.98], r, r, 12); cyl(D, [r * 1.2, 0, h * 0.98], [r * 2.2, 0, h * 0.62], r, r * 1.15, 12); }
    else { cyl(S, [0, 0, 0], [0, 0, h * 0.8], r, r, 12); cyl(S, [0, 0, h * 0.8], [0, 0, h * 0.86], Math.min(l, w) / 2, Math.min(l, w) / 2, 14); ellipsoid(S, [0, 0, h * 0.86], Math.min(l, w) / 2, Math.min(l, w) / 2, h * 0.14, 14, 6); }
  },
  davit(K, f) {
    const l = f.l, w = f.w, h = f.h, A = K('white'), D = K('dark'), r = Math.max(0.05, Math.min(0.12, h * 0.035));
    for (const u of [-l / 2, l / 2]) { box(D, u, 0, 0.1, 0.5, 0.6, 0.2); const p0 = [u, -0.1, 0], p1 = [u, w * 0.15, h * 0.75], p2 = [u, w * 0.75, h], p3 = [u, w, h * 0.92]; cyl(A, p0, p1, r, r, 8); cyl(A, p1, p2, r, r * 0.9, 8); cyl(A, p2, p3, r * 0.9, r * 0.8, 8); cyl(D, p3, [u, w, h * 0.55], r * 0.25, r * 0.25, 4); }
    cyl(A, [-l / 2, w * 0.15, h * 0.75], [l / 2, w * 0.15, h * 0.75], r * 0.6, r * 0.6, 6); // thanh giằng
  },
  chaff(K, f) {
    const l = f.l, w = f.w, h = f.h, rows = clamp(Math.round(f.rows || 2), 1, 3), cols = clamp(Math.round(f.cols || 3), 1, 6), el = (f.el === undefined ? 45 : clamp(+f.el, 0, 85)) * Math.PI / 180, D = K('dark'), S = K('super');
    box(D, 0, 0, h * 0.15, l * 0.7, w * 0.9, h * 0.3); const r = Math.min(w / cols, h / rows) * 0.36, tl = l * 0.75;
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { const v = -w / 2 + w * (j + 0.5) / cols, z0 = h * 0.3 + r + i * r * 2.3, u0 = -tl / 2 * Math.cos(el); cyl(S, [u0, v, z0], [u0 + tl * Math.cos(el), v, z0 + tl * Math.sin(el)], r, r, 10); }
  },
  locker(K, f) { const l = f.l, w = f.w, h = f.h, S = K('super'), D = K('dark'); box(S, 0, 0, h * 0.45, l, w, h * 0.9); box(S, 0, 0, h * 0.93, l * 1.04, w * 1.06, h * 0.08); box(D, l * 0.25, w / 2 + 0.01, h * 0.6, 0.08, 0.03, 0.12); },
  staff(K, f) { const h = Math.max(0.6, f.h), r = Math.max(0.03, f.w / 2); cyl(K('dark'), [0, 0, 0], [0, 0, 0.15], r * 2.2, r * 2.2, 8); cyl(K('white'), [0, 0, 0.15], [0, 0, h], r, r * 0.6, 8); ellipsoid(K('white'), [0, 0, h + r * 1.2], r * 1.6, r * 1.6, r * 1.6, 10, 6); },
  breakwater(K, f) {
    const l = f.l, w = f.w, h = f.h, t = 0.06, S = K('hull'), D = K('dark'), n = 5;
    for (const s of [-1, 1]) { loftRings(S, [{ x: -l / 2, rings: [[[s * w / 2 - t, 0], [s * w / 2 + t, 0], [s * w / 2 + t, h * 0.8], [s * w / 2 - t, h * 0.8]]] }, { x: l / 2, rings: [[[s * 0.05 - t, 0], [s * 0.05 + t, 0], [s * 0.05 + t, h], [s * 0.05 - t, h]]] }]);
      for (let i = 1; i < n; i++) { const k = i / n, u = -l / 2 + l * k, v = s * (w / 2 + (0.05 - w / 2) * k); cyl(D, [u - 0.4, v, 0], [u, v, h * (0.8 + 0.2 * k) * 0.9], 0.03, 0.03, 4); } }
  },
  lashing(K, f) {
    const l = f.l, w = f.w, h = f.h, A = K('cgrey'), Y = K('yellow'), nb = Math.max(2, Math.round(w / 2.5));
    for (let i = 0; i <= nb; i++) { const v = -w / 2 + w * i / nb; cyl(A, [0, v, 0], [0, v, h], 0.08, 0.08, 6); }
    for (const z of [h * 0.45, h]) { box(A, 0, 0, z, l * 0.9, w, 0.1); cyl(Y, [l * 0.45, -w / 2, z + 1], [l * 0.45, w / 2, z + 1], 0.025, 0.025, 4); cyl(Y, [-l * 0.45, -w / 2, z + 1], [-l * 0.45, w / 2, z + 1], 0.025, 0.025, 4); }
    for (let i = 0; i < nb; i++) { const v0 = -w / 2 + w * i / nb, v1 = v0 + w / nb; cyl(A, [0, v0, 0.1], [0, v1, h * 0.45], 0.04, 0.04, 4); }
  },
  fender(K, f) { const l = f.l, r = Math.max(0.1, Math.min(f.w, f.h) / 2); cyl(K('black'), [-l / 2 + r, 0, r], [l / 2 - r, 0, r], r, r, 12); ellipsoid(K('black'), [-l / 2 + r, 0, r], r, r, r, 10, 6); ellipsoid(K('black'), [l / 2 - r, 0, r], r, r, r, 10, 6); }
};
// dựng một chi tiết vào các bộ gom màu (accs); radar thêm phần quay vào movers. Trả { bb, yard?, top? }
export function buildFit(f, accs, movers) {
  const K0 = FIT_KINDS[f.kind]; if (!K0) return null;
  const g = Object.assign(fitDefaults(f.kind, 60), f); for (const k of ['l', 'w', 'h']) g[k] = Math.max(0.03, +g[k] || K0[k]);
  const bb = newBB(), I = { bb }, K = (c, loc) => new TAcc(accs[c] || (c === 'hawse' ? accs.metal : null) || accs.super, xform(g, loc), bb);
  B[f.kind](K, g, I, movers || [], accs);
  return I;
}
