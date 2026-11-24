// Dựng mô hình tàu mẫu từ một bảng thông số gọn (mét) → đúng định dạng mô hình của bàn vẽ (3 hình chiếu + chi tiết + chi tiết thư viện),
// nên mẫu sửa tiếp được trên bàn vẽ như tàu tự vẽ. Chỉ dùng cho các mẫu CHUNG CHUNG tự dựng trong kho tàu (fleet.js).
//
// spec: { name, L, B, D, T, H (cao tối đa để định khung hình),
//   bow: 'raked' | 'bulb' | 'flat' | 'tug', rake (m), bw (bề rộng mũi bằng / B, kiểu 'flat'), stern: 'transom' | 'cruiser', tb (đáy vát lái / T),
//   shA, shF (độ cong dọc boong ở lái / mũi, m), fc: { x0, h } (boong mũi nâng), poop: { x1, h } (boong lái nâng),
//   par: [xa, xb] (đoạn thân song song, m), ts (nửa bề rộng lái / nửa B), bp (độ thon mũi), sec: 'box' | 'round' | 'v', br (bán kính hông, m),
//   bulwark: [x0, x1, h] (mạn chắn sóng mũi) hoặc bulwarks: [[x0, x1, h], …],
//   blocks: [{ k: 't1'..'t4' | 'bridge' | 'funnel' | 'funnelT' | 'funnelP' | 'box', x0, x1, z0?, h, w, sl (vát trước), sa (vát sau), fw (bề rộng trước / w), win,
//     tw (bề rộng nóc / chân: vách nghiêng, thêm hình nhìn từ mũi), lip: { s, f, a, t } (sàn đi lại nhô ra quanh nóc: hai bên, trước, sau, dày),
//     visor (m: mái che nắng nhô trước nóc buồng lái) }],
//   wings: { x0, x1, z, span }, masts: [{ id: 'truoc' | 'chinh' | 'sau', x, z0, h, yard (độ cao xà tính từ chân), radar }],
//   anchors: [x, z], winch: [x0, x1],
//   lights: { mast1: [x, z], mast2, side: [x, z], stern, anchF, anchA, nuc }, eye: [x, z],
//   fits: [[kind, x, y, z, { l, w, h, rot, … }]], opts: { colors, hullNo, … } }
// Hàm deck(x) cho biết cao độ boong tại x để đặt chi tiết (spec có thể là hàm nhận { deck, hb }).
const PX = 20, M = 100;
let uid = 0; const id = (p) => p + (++uid).toString(36) + Math.random().toString(36).slice(2, 6);
const r2 = (v) => Math.round(v * 100) / 100;

// cao độ boong theo x (cong dọc + boong mũi / lái nâng)
export function deckFn(sp) {
  const { L, D } = sp, h2 = L / 2;
  return (x) => {
    let z = D + (sp.shA || 0) * Math.max(0, -x / h2) ** 2 + (sp.shF || 0) * Math.max(0, x / h2) ** 2;
    if (sp.fc) z += sp.fc.h * Math.max(0, Math.min(1, (x - sp.fc.x0 + 0.4) / 0.8));
    if (sp.poop) z += sp.poop.h * Math.max(0, Math.min(1, (sp.poop.x1 - x + 0.4) / 0.8));
    return z;
  };
}
// nửa bề rộng mặt boong theo x
export function hbFn(sp) {
  const { L, B } = sp, h2 = L / 2, [xa, xb] = sp.par || [-L * 0.15, L * 0.1], ts = sp.ts === undefined ? 0.7 : sp.ts, bp = sp.bp || 1.8, bw = sp.bw || 0;
  return (x) => {
    if (x < xa) { const u = (xa - x) / (xa + h2); return B / 2 * (1 - (1 - ts) * u ** 2.2); }
    if (x > xb) { const u = Math.min(1, (x - xb) / (h2 - xb)); return B / 2 * (bw + (1 - bw) * (1 - u ** bp) ** 0.9); }
    return B / 2;
  };
}

export function genModel(spec) {
  const deck = deckFn(spec), hb = hbFn(spec), sp = typeof spec.build === 'function' ? Object.assign({}, spec, spec.build({ deck, hb })) : spec;
  const { L, B, D, T } = sp, h2 = L / 2, H = sp.H || D * 3.2, W = B + 4;
  const side = { id: id('v'), kind: 'side', name: 'Mạn (mẫu)', imgId: null, iw: Math.round(L * PX + 2 * M), ih: Math.round(H * PX + 2 * M), dims: [] };
  const top = { id: id('v'), kind: 'top', name: 'Mặt boong (mẫu)', imgId: null, iw: side.iw, ih: Math.round(W * PX + 2 * M), dims: [] };
  const front = { id: id('v'), kind: 'front', name: 'Mặt cắt (mẫu)', imgId: null, iw: Math.round(W * PX + 2 * M), ih: Math.round(D * 1.3 * PX + 2 * M), dims: [] };
  const S = ([x, z]) => [r2(M + (x + h2) * PX), r2(side.ih - M - z * PX)], Tp = ([x, y]) => [r2(M + (x + h2) * PX), r2(top.ih / 2 + y * PX)], F = ([y, z]) => [r2(front.iw / 2 - y * PX), r2(front.ih - M - z * PX)];
  side.refs = { stern: S([-h2, 0]), bow: S([h2, 0]), base: S([0, 0]) };
  top.refs = { stern: Tp([-h2, 0]), bow: Tp([h2, 0]) };
  front.refs = { left: F([B / 2, 0]), right: F([-B / 2, 0]), base: F([0, 0]) };
  const parts = [], add = (view, type, pts, extra) => parts.push(Object.assign({ id: id('p'), view: view.id, type, pts: pts.map(view === side ? S : view === top ? Tp : F), kind: pts.length === 1 ? 'point' : 'poly', note: '', num: {} }, extra || {}));
  const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

  // ---- thân tàu: đường bao mạn (bắt đầu ở đáy vát lái, lên boong, dọc boong tới mũi, xuống sống mũi, dọc ky về lái)
  const prof = [], tb = (sp.tb === undefined ? (sp.stern === 'cruiser' ? 1.2 : 0.85) : sp.tb) * T;
  prof.push([-h2, sp.stern === 'cruiser' ? T + 0.12 * D : tb]);
  const n = Math.max(24, Math.round(L / 2)), steps = [];
  for (let i = 0; i <= n; i++) steps.push(-h2 + L * i / n);
  if (sp.fc) steps.push(sp.fc.x0 - 0.4, sp.fc.x0 + 0.4); if (sp.poop) steps.push(sp.poop.x1 - 0.4, sp.poop.x1 + 0.4);
  steps.sort((a, b) => a - b); for (const x of steps) prof.push([x, deck(x)]);
  const r = sp.rake === undefined ? L * 0.06 : sp.rake;
  if (sp.bow === 'bulb') { const bl = Math.min(r * 0.85, L * 0.025); prof.push([h2 - r * 0.7, T * 1.15], [h2 - r, T * 0.82], [h2 - r + bl * 0.7, T * 0.68], [h2 - r + bl, T * 0.5], [h2 - r + bl * 0.6, T * 0.3], [h2 - r - L * 0.01, T * 0.12], [h2 - r - L * 0.035, 0]); }
  else if (sp.bow === 'flat') prof.push([h2 - L * 0.012, T * 1.1], [h2 - L * 0.035, T * 0.55], [h2 - L * 0.07, T * 0.15], [h2 - L * 0.1, 0]);
  else if (sp.bow === 'tug') prof.push([h2 - r * 0.6, T * 1.2], [h2 - r, T * 0.75], [h2 - r - L * 0.05, T * 0.3], [h2 - r - L * 0.12, T * 0.06], [h2 - r - L * 0.18, 0]);
  else prof.push([h2 - r * 0.5, T * 1.4], [h2 - r * 0.85, T * 0.75], [h2 - r - L * 0.03, T * 0.3], [h2 - r - L * 0.07, T * 0.08], [h2 - r - L * 0.12, 0]);
  if (sp.stern === 'cruiser') prof.push([-h2 + L * 0.07, 0], [-h2 + L * 0.05, T * 0.1], [-h2 + L * 0.04, T * 0.8], [-h2 + L * 0.015, T * 1.0]);
  else prof.push([-h2 + L * 0.26, 0], [-h2 + L * 0.12, T * 0.3], [-h2 + L * 0.04, tb * 0.9]);
  add(side, ['than', 'baoman'], prof);
  const half = []; for (let i = 0; i <= n; i++) { const x = -h2 + L * i / n; half.push([x, r2(hb(x))]); }
  add(top, ['than', 'matboong'], [...half, ...half.slice().reverse().map(([x, y]) => [x, -y])]);
  const sec = sp.sec === 'box' ? (() => { const br = sp.br || B * 0.08, o = [[0, 0]]; for (let i = 0; i <= 4; i++) { const a = -Math.PI / 2 + i / 4 * Math.PI / 2; o.push([B / 2 - br + Math.cos(a) * br, br + Math.sin(a) * br]); } o.push([B / 2, D]); return o; })()
    : sp.sec === 'round' ? [[0, 0], [B * 0.22, T * 0.04], [B * 0.38, T * 0.25], [B * 0.47, T * 0.6], [B * 0.5, T * 1.1], [B * 0.5, D]]
      : [[0, 0], [B * 0.14, T * 0.07], [B * 0.32, T * 0.42], [B * 0.43, T * 0.85], [B * 0.48, T * 1.3], [B * 0.5, D]];
  add(front, ['than', 'matcat'], [...sec, ...sec.slice(1).reverse().map(([y, z]) => [-y, z])]);
  for (const bw of sp.bulwarks || (sp.bulwark ? [sp.bulwark] : [])) { const [x0, x1, bh] = bw, pts = [], up = x1 > L * 0.3; for (let i = 0; i <= 8; i++) { const x = x0 + (x1 - x0) * i / 8; pts.push([x, deck(x) - 0.1]); } for (let i = 8; i >= 0; i--) { const x = x0 + (x1 - x0) * i / 8; pts.push([x, deck(x) + bh * (up ? 0.7 + 0.3 * i / 8 : 1)]); } add(side, ['than', 'manchan'], pts); }

  // ---- khối thượng tầng / buồng lái / ống khói
  const TYPE = { t1: ['tang', 't1', 'khoi'], t2: ['tang', 't2', 'khoi'], t3: ['tang', 't3', 'khoi'], t4: ['tang', 't4', 'khoi'], bridge: ['buong', 'chinh'], funnel: ['khoi', 'giua'], funnelT: ['khoi', 'T'], funnelP: ['khoi', 'P'], box: ['khac', 'hop'], fcb: ['than', 'boongmui'] };
  const minDeck = (x0, x1) => { let z = Infinity; for (let i = 0; i <= 6; i++) z = Math.min(z, deck(x0 + (x1 - x0) * i / 6)); return z; };
  const last = () => parts[parts.length - 1].id;
  // khối: hình mạn + mặt boong (+ hình nhìn từ mũi nếu vách nghiêng); các hình phụ mang grp = hình mạn để ghép đúng khối
  const block = (type, x0, x1, z0, z1, w, o = {}) => {
    const sl = o.sl || 0, sa = o.sa || 0, extra = {}; if (o.win !== undefined) extra.win = !!o.win; if (o.fillet) extra.fillet = o.fillet;
    add(side, type, [[x0, z0], [x1, z0], [x1 - sl, z1], [x0 + sa, z1]], extra); const sid = last();
    const yc = o.yc || 0, fw = o.fw === undefined ? 1 : o.fw;
    add(top, type, [[x0, yc - w / 2], [x1, yc - w * fw / 2], [x1, yc + w * fw / 2], [x0, yc + w / 2]], Object.assign({ grp: sid }, extra));
    if (o.tw && !yc) { const wt = w * Math.min(fw, 1); add(front, type, [[-wt / 2, z0], [wt / 2, z0], [wt * o.tw / 2, z1], [-wt * o.tw / 2, z1]], { grp: sid }); }
    return sid;
  };
  for (const b of sp.blocks || []) {
    const z0 = b.z0 === undefined ? minDeck(b.x0, b.x1) : b.z0, z1 = z0 + b.h, sl = b.sl || 0, yc = b.k === 'funnelT' ? -(b.y || B * 0.2) : b.k === 'funnelP' ? (b.y || B * 0.2) : 0;
    const lip = b.lip, lt = lip ? lip.t || 0.18 : 0;
    block(TYPE[b.k], b.x0, b.x1, z0, z1 - lt, b.w, { sl: sl * (1 - lt / b.h), sa: (b.sa || 0) * (1 - lt / b.h), fw: b.fw, win: b.win, fillet: b.fillet, yc, tw: b.tw });
    if (lip) { const xf = b.x1 - sl + (lip.f || 0), xa = b.x0 + (b.sa || 0) - (lip.a || 0), ww = b.w * (b.tw || 1) + 2 * (lip.s || 0); block(TYPE[b.k], xa, xf, z1 - lt, z1, ww, { fw: b.fw ? (b.w * b.fw * (b.tw || 1) + 2 * (lip.s || 0)) / ww : 1, win: false }); }
    if (b.visor) { const xf = b.x1 - sl; block(TYPE.box, xf - 0.4, xf + b.visor, z1 - 0.1, z1 + 0.04, b.w * (b.tw || 1) + 0.5, { win: false }); }
  }
  if (sp.wings) { const { x0, x1, z, span } = sp.wings, bw = sp.wings.w || B * 0.42, wt = sp.wings.t || 0.5; for (const [k, s] of [['canhT', -1], ['canhP', 1]]) { add(side, ['buong', k], rect(x0, z, x1, z + wt)); const sid = last(); add(top, ['buong', k], s < 0 ? rect(x0, -span, x1, -bw) : rect(x0, bw, x1, span), { grp: sid }); } }
  for (const m of sp.masts || []) {
    const w0 = m.w || Math.max(0.18, L / 300), z1 = m.z0 + m.h;
    add(side, ['cot', m.id || 'chinh', 'than'], [[m.x - w0, m.z0], [m.x + w0 * 0.6, m.z0], [m.x + w0 * 0.15, z1], [m.x - w0 * 0.35, z1]]);
    if (m.yard) add(side, ['cot', m.id || 'chinh', 'xa'], rect(m.x - w0 * 0.8, m.z0 + m.yard - 0.1, m.x + w0 * 0.8, m.z0 + m.yard + 0.1));
    if (m.radar) { const rl = m.rl || Math.max(1.6, L / 30); add(side, ['radar', 'cot'], rect(m.x - rl / 2, m.z0 + m.radar, m.x + rl / 2, m.z0 + m.radar + 0.6)); }
  }
  if (sp.anchors) { const [ax, az] = sp.anchors, al = Math.max(0.8, L / 55), ah = Math.max(0.9, L / 50); for (const s of ['T', 'P']) add(side, ['neo', s], rect(ax - al / 2, az - ah / 2, ax + al / 2, az + ah / 2)); }
  if (sp.winch) { const [x0, x1] = sp.winch, z = deck((x0 + x1) / 2); add(side, ['neo', 'toi'], rect(x0, z, x1, z + Math.max(0.6, L / 90))); }
  const LT = { mast1: ['den', 'cot', 'truoc'], mast2: ['den', 'cot', 'sau'], stern: ['den', 'lai'], anchF: ['den', 'neo', 'mui'], anchA: ['den', 'neo', 'lai'], nuc: ['den', 'tinhieu'], deckL: ['den', 'boong'] };
  for (const [k, v] of Object.entries(sp.lights || {})) { if (!v) continue; if (k === 'side') { add(side, ['den', 'man', 'T'], [v]); add(side, ['den', 'man', 'P'], [v]); } else if (LT[k]) add(side, LT[k], [v]); }
  if (sp.eye) add(side, ['buong', 'mat'], [sp.eye]);
  let fn = 0; const fits = (sp.fits || []).map(([kind, x, y, z, o]) => Object.assign({ id: 'f' + (++fn).toString(36) + Math.random().toString(36).slice(2, 6), kind, x: r2(x), y: r2(y), z: r2(z), rot: 0 }, o || {}));
  return { v: 1, name: sp.name || 'Tàu mẫu', views: [side, top, front], parts, fits, guides: [], opts: Object.assign({ rails: true, roofRails: true }, sp.opts || {}), template: true };
}
