// Mẫu "tàu pháo cỡ nhỏ" CHUNG CHUNG, tự dựng (không theo tàu thật nào) — để xem thử cách vẽ và để kiểm thử.
// Vẽ trên lưới không có ảnh: 20 điểm ảnh / m ở chiều dài mẫu 62 m; app co giãn theo LOA, B của tàu ở tab 1.
const PX = 20, L0 = 62, B0 = 9.5, M = 100;
let uid = 0; const id = (p) => p + (++uid).toString(36) + Date.now().toString(36).slice(-4);

export function makeTemplate() {
  const side = { id: id('v'), kind: 'side', name: 'Mạn (mẫu)', imgId: null, iw: L0 * PX + 2 * M, ih: 26 * PX + 2 * M, dims: [] };
  const top = { id: id('v'), kind: 'top', name: 'Mặt boong (mẫu)', imgId: null, iw: L0 * PX + 2 * M, ih: 14 * PX + 2 * M, dims: [] };
  const front = { id: id('v'), kind: 'front', name: 'Mặt cắt (mẫu)', imgId: null, iw: 14 * PX + 2 * M, ih: 9 * PX + 2 * M, dims: [] };
  // tọa độ tàu → điểm ảnh của từng hình
  const S = ([x, z]) => [M + (x + L0 / 2) * PX, side.ih - M - z * PX], T = ([x, y]) => [M + (x + L0 / 2) * PX, top.ih / 2 + y * PX], F = ([y, z]) => [front.iw / 2 - y * PX, front.ih - M - z * PX];
  side.refs = { stern: S([-L0 / 2, 0]), bow: S([L0 / 2, 0]), base: S([0, 0]) };
  top.refs = { stern: T([-L0 / 2, 0]), bow: T([L0 / 2, 0]) };
  front.refs = { left: F([B0 / 2, 0]), right: F([-B0 / 2, 0]), base: F([0, 0]) };
  const parts = [], add = (view, type, pts, extra) => parts.push(Object.assign({ id: id('p'), view: view.id, type, pts: pts.map(view === side ? S : view === top ? T : F), kind: pts.length === 1 ? 'point' : 'poly', note: '', num: {} }, extra || {}));
  const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const mir = (half) => [...half, ...half.slice().reverse().map(([a, b]) => [a, -b])];
  // thân tàu
  add(side, ['than', 'baoman'], [[-31, 1.6], [-31, 5.0], [-20, 4.9], [0, 5.0], [12, 5.4], [22, 6.2], [31, 6.9], [30.3, 4.6], [28.8, 2.2], [26.4, 0.7], [22, 0.1], [10, 0], [-20, 0], [-26, 0.4], [-29.5, 1.1]]);
  add(top, ['than', 'matboong'], mir([[-31, 3.9], [-24, 4.4], [-12, 4.75], [6, 4.75], [14, 4.3], [21, 3.4], [26, 2.2], [29.5, 0.9], [31, 0]]));
  const sec = [[0, 0], [1.2, 0.15], [2.8, 0.8], [3.9, 1.8], [4.5, 3.0], [4.75, 5.0]]; // (y, z) nửa mạn phải, từ ky lên boong
  add(front, ['than', 'matcat'], [...sec, ...sec.slice(1).reverse().map(([y, z]) => [-y, z])]);
  add(side, ['than', 'manchan'], [[18, 6.0], [30.6, 6.8], [30.6, 7.7], [18, 6.9]]);
  // thượng tầng, buồng lái, ống khói
  add(side, ['tang', 't1', 'khoi'], [[-14, 5.0], [8.6, 5.0], [7.6, 7.6], [-14, 7.6]]); add(top, ['tang', 't1', 'khoi'], rect(-14, -3.6, 8.6, 3.6));
  add(side, ['tang', 't2', 'khoi'], [[-6, 7.6], [5.6, 7.6], [4.6, 10.0], [-6, 10.0]]); add(top, ['tang', 't2', 'khoi'], rect(-6, -3.2, 5.6, 3.2));
  add(side, ['buong', 'chinh'], [[-2, 10.0], [4.6, 10.0], [3.7, 12.4], [-2, 12.4]]); add(top, ['buong', 'chinh'], rect(-2, -3.4, 4.6, 3.4));
  add(side, ['buong', 'canhT'], rect(1.2, 10.0, 4.4, 10.5)); add(top, ['buong', 'canhT'], rect(1.2, -5.4, 4.4, -3.4));
  add(side, ['buong', 'canhP'], rect(1.2, 10.0, 4.4, 10.5)); add(top, ['buong', 'canhP'], rect(1.2, 3.4, 4.4, 5.4));
  add(side, ['khoi', 'giua'], [[-11.4, 7.6], [-7, 7.6], [-7.6, 10.4], [-11.8, 10.4]]); add(top, ['khoi', 'giua'], rect(-11.6, -1.1, -7.2, 1.1));
  // cột, radar
  add(side, ['cot', 'chinh', 'than'], [[-0.7, 12.4], [0.4, 12.4], [0.05, 21.2], [-0.3, 21.2]]);
  add(side, ['cot', 'chinh', 'xa'], rect(-0.6, 17.9, 0.6, 18.1));
  add(side, ['radar', 'cot'], rect(-1.4, 19.3, 1.4, 19.9));
  // vũ khí (khối hình bên ngoài để nhìn), xuồng, bè, neo, tời
  add(side, ['vukhi', 'phao', 'mui', 'vua'], rect(11, 5.4, 14.6, 7.3));
  add(side, ['vukhi', 'phao', 'lai', 'nho'], rect(-24.4, 4.9, -21.8, 6.2));
  add(side, ['xuong', 'xuong', 'T'], rect(-19.5, 6.0, -14.6, 7.3)); add(side, ['xuong', 'xuong', 'P'], rect(-19.5, 6.0, -14.6, 7.3));
  add(side, ['xuong', 'be', 'T'], rect(-5.2, 7.7, -3.6, 8.4)); add(side, ['xuong', 'be', 'P'], rect(-5.2, 7.7, -3.6, 8.4));
  add(side, ['neo', 'T'], rect(26.4, 3.8, 27.6, 4.8)); add(side, ['neo', 'P'], rect(26.4, 3.8, 27.6, 4.8));
  add(side, ['neo', 'toi'], rect(21.6, 6.1, 23.4, 6.8));
  // đèn và vị trí người điều động
  add(side, ['den', 'man', 'T'], [[3.6, 11.0]]); add(side, ['den', 'man', 'P'], [[3.6, 11.0]]);
  add(side, ['den', 'cot', 'truoc'], [[-0.1, 21.5]]); add(side, ['den', 'lai'], [[-30.7, 6.2]]);
  add(side, ['den', 'neo', 'mui'], [[29.6, 8.6]]); add(side, ['den', 'neo', 'lai'], [[-29.2, 7.0]]);
  add(side, ['den', 'tinhieu'], [[0.6, 16.4]]);
  add(side, ['buong', 'mat'], [[2.6, 11.7]]);
  return { v: 1, name: 'Tàu pháo mẫu (chung chung)', views: [side, top, front], parts, opts: { shade: 'haze', rails: true }, template: true };
}
// thông số tab 1 gợi ý cho mẫu
export const TEMPLATE_SHIP = { loa: 62, lpp: 58, B: 9.5, D: 5.0, tf: 2.7, ta: 2.9, cb: 0.48, engines: 2, props: 2, ptype: 'fpp', rudMax: 25, rudders: 2 };
