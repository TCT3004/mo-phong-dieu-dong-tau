// Cây chi tiết tàu (chọn nhiều nấc). Chọn tới nấc cuối thì app biết chi tiết đó là gì để dựng hình và cho hoạt động
// (role: cách dựng; key: đèn hàng hải nối với bảng Đèn ở tab 3; side: -1 trái, 1 phải; face: hướng nòng pháo).
const sides = (role, extra = {}) => [{ id: 'T', name: 'Trái', role, side: -1, ...extra }, { id: 'P', name: 'Phải', role, side: 1, ...extra }];
const deck = (n) => ({ id: 't' + n, name: 'Tầng ' + n, kids: [{ id: 'khoi', name: 'Khối chính', role: 'block', level: n, color: 'super' }, { id: 'canhT', name: 'Cánh gà trái', role: 'wing', side: -1, level: n, color: 'super' }, { id: 'canhP', name: 'Cánh gà phải', role: 'wing', side: 1, level: n, color: 'super' }] });
const mast = (id, name) => ({ id, name, kids: [{ id: 'than', name: 'Thân cột', role: 'mast', mast: id }, { id: 'xa', name: 'Xà ngang', role: 'yard', mast: id }, { id: 'ant', name: 'Cột ăng-ten', role: 'mast', thin: true, mast: id }] });
const gunSizes = (face) => [['lon', 'Lớn', 5.2], ['vua', 'Vừa', 3.4], ['nho', 'Nhỏ', 2]].map(([id, name, bl]) => ({ id, name, role: 'gun', face, barrel: bl }));

export const PART_TREE = [
  { id: 'than', name: 'Thân tàu', kids: [
    { id: 'baoman', name: 'Đường bao mạn', role: 'hullSide', views: ['side'] },
    { id: 'matboong', name: 'Mặt boong', role: 'hullTop', views: ['top'] },
    { id: 'matcat', name: 'Mặt cắt ngang', role: 'hullSection', views: ['front', 'back'] },
    { id: 'boongmui', name: 'Boong mũi (nâng)', role: 'block', color: 'hull', defH: 2.4 },
    { id: 'boonglai', name: 'Boong lái (nâng)', role: 'block', color: 'hull', defH: 2.2 },
    { id: 'manchan', name: 'Mạn chắn sóng', role: 'bulwark', color: 'hull', defH: 1.0 }] },
  { id: 'tang', name: 'Thượng tầng', kids: [1, 2, 3, 4].map(deck) },
  { id: 'buong', name: 'Buồng lái', kids: [
    { id: 'chinh', name: 'Buồng lái chính', role: 'block', color: 'super', defH: 2.6, bridge: true },
    { id: 'canhT', name: 'Cánh gà trái', role: 'wing', side: -1, color: 'super' },
    { id: 'canhP', name: 'Cánh gà phải', role: 'wing', side: 1, color: 'super' },
    { id: 'mat', name: 'Vị trí người điều động', role: 'eye', kind: 'point' }] },
  { id: 'cot', name: 'Cột', kids: [mast('truoc', 'Cột trước'), mast('chinh', 'Cột chính'), mast('sau', 'Cột sau')] },
  { id: 'den', name: 'Đèn', kids: [
    { id: 'man', name: 'Đèn mạn', kids: [{ id: 'T', name: 'Trái', role: 'light', key: 'sideP', side: -1, kind: 'point' }, { id: 'P', name: 'Phải', role: 'light', key: 'sideS', side: 1, kind: 'point' }] },
    { id: 'cot', name: 'Đèn cột', kids: [{ id: 'truoc', name: 'Cột trước', role: 'light', key: 'mast1', kind: 'point' }, { id: 'sau', name: 'Cột sau', role: 'light', key: 'mast2', kind: 'point' }] },
    { id: 'lai', name: 'Đèn lái', role: 'light', key: 'stern', kind: 'point' },
    { id: 'neo', name: 'Đèn neo', kids: [{ id: 'mui', name: 'Mũi', role: 'light', key: 'anchF', kind: 'point' }, { id: 'lai', name: 'Lái', role: 'light', key: 'anchA', kind: 'point' }] },
    { id: 'tinhieu', name: 'Đèn tín hiệu (2 đỏ)', role: 'light', key: 'nuc', kind: 'point' },
    { id: 'boong', name: 'Đèn chiếu boong', role: 'light', key: 'deck', kind: 'point' }] },
  { id: 'khoi', name: 'Ống khói', kids: [{ id: 'giua', name: 'Giữa', role: 'block', side: 0, color: 'dark' }, { id: 'T', name: 'Trái', role: 'block', side: -1, color: 'dark' }, { id: 'P', name: 'Phải', role: 'block', side: 1, color: 'dark' }] },
  { id: 'vukhi', name: 'Vũ khí', kids: [{ id: 'phao', name: 'Bệ pháo', kids: [
    { id: 'mui', name: 'Mũi', kids: gunSizes('mui') }, { id: 'lai', name: 'Lái', kids: gunSizes('lai') },
    { id: 'T', name: 'Mạn trái', kids: gunSizes('T') }, { id: 'P', name: 'Mạn phải', kids: gunSizes('P') }] }] },
  { id: 'radar', name: 'Radar, ăng-ten', kids: [{ id: 'cot', name: 'Trên cột', role: 'radar' }, { id: 'noc', name: 'Trên nóc buồng lái', role: 'radar' }] },
  { id: 'xuong', name: 'Xuồng, bè', kids: [{ id: 'xuong', name: 'Xuồng công tác', kids: sides('boat') }, { id: 'be', name: 'Bè cứu sinh', kids: sides('raft') }] },
  { id: 'neo', name: 'Neo, tời', kids: [{ id: 'T', name: 'Neo mũi trái', role: 'anchor', side: -1 }, { id: 'P', name: 'Neo mũi phải', role: 'anchor', side: 1 }, { id: 'toi', name: 'Tời neo', role: 'winch', color: 'dark' }] },
  { id: 'khac', name: 'Khác', kids: [{ id: 'hop', name: 'Khối hộp', role: 'block', color: 'super' }, { id: 'tru', name: 'Trụ đứng', role: 'cyl' }, { id: 'ong', name: 'Ống nằm', role: 'tube' }] }
];

// đường dẫn ['den','man','T'] → { node, names: ['Đèn','Đèn mạn','Trái'], leaf: true/false }
export function resolve(path) {
  let list = PART_TREE, node = null; const names = [];
  for (const id of path || []) { node = (list || []).find((n) => n.id === id); if (!node) return { node: null, names, leaf: false }; names.push(node.name); list = node.kids; }
  return { node, names, leaf: !!node && !node.kids };
}
export const partLabel = (p) => { const r = resolve(p.type); return (r.names.length ? r.names.join(' › ') : 'Chưa chọn loại') + (p.note ? ' — ' + p.note : ''); };
// các nấc con để hiện ô chọn tiếp theo
export function childrenAt(path, depth) { let list = PART_TREE; for (let i = 0; i < depth; i++) { const n = (list || []).find((q) => q.id === path[i]); if (!n) return null; list = n.kids; } return list || null; }
// chi tiết dạng điểm (một cú bấm) hay đường bao
export const isPointType = (path) => { const r = resolve(path); return !!(r.node && r.node.kind === 'point'); };

// tông xám (thân & thượng tầng), boong đậm hơn, dưới nước sơn chống hà
export const SHADES = {
  haze: { name: 'Xám hải quân', hull: 0x8d969c, super: 0x9aa3a9, deck: 0x5f686e, dark: 0x4a5257 },
  dark: { name: 'Xám đậm', hull: 0x6c757b, super: 0x7b848a, deck: 0x4c5459, dark: 0x3b4246 },
  light: { name: 'Xám nhạt', hull: 0xa6adb2, super: 0xb7bdc1, deck: 0x6d767c, dark: 0x50585d },
  blue: { name: 'Xám xanh', hull: 0x7b8995, super: 0x8a98a3, deck: 0x56626c, dark: 0x434d55 }
};
export const ANTIFOUL = 0x5a2e2a, BOOT = 0x1d2124;
// bảng màu có sẵn (người dùng sửa từng màu được): vỏ, thượng tầng, boong, dải sơn đường nước
const hx = (n) => '#' + n.toString(16).padStart(6, '0');
export const COLOR_PRESETS = {
  ...Object.fromEntries(Object.entries(SHADES).map(([k, s]) => [k, { name: s.name, hull: hx(s.hull), super: hx(s.super), deck: hx(s.deck), boot: hx(BOOT) }])),
  xanh: { name: 'Xám nhạt · boong xanh', hull: '#a6adb2', super: '#b5bbbf', deck: '#4d7a57', boot: '#1d2124' },
  trang: { name: 'Trắng xám · boong xanh', hull: '#d3d7da', super: '#e1e4e6', deck: '#3f7a4c', boot: '#23282b' },
  trangdo: { name: 'Trắng · đường nước đỏ', hull: '#e4e6e8', super: '#eceeef', deck: '#6b7378', boot: '#8b2a22' }
};
const toN = (s, d) => { const n = parseInt(String(s || '').replace('#', ''), 16); return isFinite(n) ? n : d; };
const shade = (n, k) => { const r = Math.round(((n >> 16) & 255) * k), g = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k); return (r << 16) | (g << 8) | b; };
// màu dùng khi dựng: opts.colors (người dùng chọn) hoặc tông xám cũ opts.shade
export function shipColors(opts = {}) {
  const s = SHADES[opts.shade] || SHADES.haze, c = opts.colors || {};
  const sup = toN(c.super, s.super);
  return { hull: toN(c.hull, s.hull), super: sup, deck: toN(c.deck, s.deck), boot: toN(c.boot, BOOT), anti: ANTIFOUL, dark: c.super ? shade(sup, 0.5) : s.dark };
}
