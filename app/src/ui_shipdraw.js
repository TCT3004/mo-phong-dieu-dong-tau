// Hộp thoại vẽ tàu từ sơ đồ: BÀN VẼ 3 HÌNH CHIẾU (mạn · mặt boong · nhìn từ mũi / lái) cùng tỷ lệ, thẳng hàng như bản vẽ kỹ thuật,
// vạch gióng qua lại giữa các hình, thước kiểu CAD (bắt dính lưới / điểm / vạch gióng, Shift vẽ thẳng, gõ số), ảnh sơ đồ làm nền;
// chế độ «một hình» để đặt mốc, đo kích thước cho từng ảnh. Xem 3D ngay, rồi dùng mô hình cho tàu.
import * as THREE from 'three';
import { A, $, $$, num, esc, saveShip } from './app.js';
import { openPdf } from './pdfload.js';
import { resolve, childrenAt, partLabel, isPointType, COLOR_PRESETS, shipColors } from './shipdraw/parts.js';
import { calibrate, measure, VIEW_KINDS, REFS, REF_NAMES } from './shipdraw/calib.js';
import { traceWand, traceBox } from './shipdraw/trace.js';
import { buildModel, atH, atV, partShape } from './shipdraw/model.js';
import { modelGroup, skyEnv } from './shipdraw/mesh3.js';
import { FIT_KINDS, fitDefaults, mirrorFit } from './shipdraw/fittings.js';
import { makeTemplate, TEMPLATE_SHIP } from './shipdraw/template.js';
import { fleetSaveForm } from './ui_fleet.js';
import { putImg, getImg } from './shipdraw/store.js';

let st = null;
const uid = (p) => p + Math.random().toString(36).slice(2, 9);
const clone = (o) => JSON.parse(JSON.stringify(o));
const ship = () => { const p = A.p; return { L: num(p.loa, 100), B: num(p.B, 15), D: num(p.D, 8), T: (num(p.tf, 4) + num(p.ta, 4)) / 2, cb: num(p.cb, 0.6) }; };
const emptyModel = () => ({ v: 1, name: A.p.name || 'Tàu', views: [], parts: [], guides: [], fits: [], opts: { shade: 'haze', rails: true } });
const fitOf = (id) => st && (st.model.fits || []).find((f) => f.id === id);
const partOf = (id) => st && st.model.parts.find((q) => q.id === id);
const r2 = (v) => Math.round(v * 100) / 100;
const view = () => st && st.model.views.find((v) => v.id === st.cur);
const viewById = (id) => st.model.views.find((v) => v.id === id);
const fmt = (v, d = 1) => (+v).toFixed(d).replace('.', ',');
const CAT = { than: '#4FC3F7', tang: '#FFB74D', buong: '#FFD54F', cot: '#E0E0E0', khoi: '#A1887F', vukhi: '#EF5350', radar: '#BA68C8', xuong: '#FF8A65', neo: '#90A4AE', khac: '#81C784' };
const LCOL = { sideP: '#FF5252', sideS: '#4ADE80', nuc: '#FF5252', deck: '#FFE08A' };
const colOf = (p) => { const r = resolve(p.type); if (!r.leaf) return '#FF4081'; if (r.node.key) return LCOL[r.node.key] || '#FFFFFF'; return CAT[p.type[0]] || '#81C784'; };
// trục của từng ô: ngang / đứng (tọa độ tàu, mét)
const AX = { side: ['x', 'z'], top: ['x', 'y'], front: ['y', 'z'], back: ['y', 'z'] };
const PANE_NAME = { side: 'HÌNH MẠN', top: 'MẶT BOONG', front: 'NHÌN TỪ MŨI', back: 'NHÌN TỪ LÁI' };
// nhãn hướng ở mép ô: [trái, phải, trên, dưới]
const PANE_DIR = { side: ['LÁI', 'MŨI', '', ''], top: ['LÁI', 'MŨI', 'MẠN TRÁI', 'MẠN PHẢI'], front: ['MẠN PHẢI', 'MẠN TRÁI', '', ''], back: ['MẠN TRÁI', 'MẠN PHẢI', '', ''] };
const HINT = {
  edit: 'Bấm vào chi tiết để chọn (chi tiết cùng khối ở các hình khác sáng theo), kéo điểm vuông để sửa, bấm đúp lên cạnh để thêm điểm, chuột phải vào điểm để bỏ. Kéo chỗ trống để di chuyển, lăn chuột để phóng to.',
  pan: 'Kéo để di chuyển, lăn chuột để phóng to / thu nhỏ.',
  poly: 'Bấm lần lượt các điểm quanh chi tiết; bấm lại điểm đầu (hoặc bấm đúp, Enter) để khép kín. Shift: vẽ thẳng ngang / dọc. Gõ số rồi Enter: đoạn dài đúng số mét theo hướng chuột; gõ «x;z» rồi Enter: điểm đúng tọa độ. Chuột phải bỏ điểm vừa chấm, Esc hủy.',
  line: 'Bấm các điểm của đường (vd: tâm cột từ chân lên đỉnh); bấm đúp hoặc Enter để kết thúc. Shift, gõ số như «Chấm đường bao».',
  point: 'Bấm một điểm: đèn, vị trí người điều động… Chọn loại ở khung bên phải.',
  wand: 'Bấm vào bên trong một vùng được viền kín trên ảnh sơ đồ — app tự lấy đường bao. Giữ Shift khi bấm để gộp thêm vùng vào chi tiết đang chọn. Chi tiết giữa tàu chỉ cần một nửa, app tự lấy đối xứng.',
  box: 'Kéo một khung bao quanh chi tiết trên ảnh — app lấy bóng ngoài của nét vẽ trong khung.',
  guide: 'Bấm để kẻ vạch gióng đứng; giữ Shift khi bấm để kẻ vạch ngang. Vạch hiện ở mọi hình có chung trục, điểm vẽ bắt dính vào vạch. Gõ số rồi Enter: vạch đúng tọa độ. Chuột phải vào vạch để xóa.',
  dim: 'Bấm điểm đầu rồi các điểm tiếp theo (đo nối tiếp) — mỗi đoạn hiện một ô kích thước, sửa thành số thật (m). Chuột phải / Esc để dừng.'
};

export function openShipDraw() {
  // bản đang vẽ giữ qua các lần mở; chưa sửa gì thì lấy lại theo thông số tàu hiện tại
  if (st && !st.edited && JSON.stringify(A.p.model || null) !== st.src) st = null;
  if (!st) st = { src: JSON.stringify(A.p.model || null), edited: false, model: A.p.model ? clone(A.p.model) : emptyModel(), mode: 'board', cur: null, tool: 'edit', sel: null, draft: null, chain: null, drag: null, mouse: null, img: new Map(), data: new Map(), v: { cx: 0, cy: 0, sc: 1 }, b: null, tol: 40, lastPoint: null, grid: 0.5, snap: { grid: true, pts: true, guides: true }, showBack: true, typed: '', ver: 0, cc: new Map(), active: {}, cam3: 'orbit', hist: [], hi: -1, place: null };
  st.model.guides = st.model.guides || []; st.model.fits = st.model.fits || []; st.showBack = true;
  if (!st.hist.length) { st.hist = [JSON.stringify(st.model)]; st.hi = 0; }
  if (!st.cur && st.model.views.length) st.cur = st.model.views[0].id;
  let d = $('#sdlg'); if (!d) { d = document.createElement('div'); d.id = 'sdlg'; d.className = 'modal'; $('#app').appendChild(d); }
  d.innerHTML = `<div class="mbox" role="dialog" aria-label="Vẽ tàu từ sơ đồ">
  <div class="mhead"><b>Vẽ tàu từ sơ đồ</b><span class="muted" id="sdName"></span>
    <button class="btn sm" id="sdUndo" title="Hoàn tác (Ctrl+Z)">↶ Hoàn tác</button><button class="btn sm" id="sdRedo" title="Làm lại (Ctrl+Y)">↷ Làm lại</button>
    <button class="btn sm" id="sdTpl">Mẫu tàu pháo (chung chung)</button><button class="btn sm" id="sdExp">Xuất file…</button><label class="btn sm" style="display:inline-flex;align-items:center">Nhập file…<input type="file" id="sdImp" accept=".json" hidden></label>
    <button class="btn sm pri" id="sdApply">Dùng mô hình cho tàu</button><button class="btn sm" id="sdFleet" title="Dùng mô hình cho tàu rồi lưu tàu (thông số tab 1 + mô hình) vào kho tàu">Lưu vào kho…</button><button class="btn sm" id="sdClose">Đóng</button></div>
  <div id="sdFleetBox" hidden style="position:fixed;right:28px;top:64px;z-index:50;background:#13202a;border:1px solid #33444F;border-radius:8px;padding:4px 12px 10px;max-width:680px;box-shadow:0 6px 24px #0008"></div>
  <div class="mbody" style="grid-template-columns:262px minmax(0,1fr) 300px">
    <div class="mleft">
      <section class="wst"><b>1 · Ảnh sơ đồ (làm nền)</b><div id="sdViews" style="margin-top:5px"></div>
        <label class="btn sm pri" style="display:flex;align-items:center;justify-content:center;margin-top:5px">+ Thêm ảnh / PDF sơ đồ<input type="file" id="sdFile" accept="image/*,.pdf,application/pdf" hidden></label>
        <div class="muted" style="margin-top:5px">Không có ảnh thì vẽ thẳng lên ô lưới của bàn vẽ. Có 1, 2 hay 3 hình chiếu đều được — thiếu hình nào app tự suy: nét đứt mờ là hình app tự sinh, kéo một điểm của nó là thành nét thật để sửa.</div></section>
      <section class="wst"><b>2 · Mốc &amp; tỷ lệ của ảnh</b><div id="sdRefs" style="margin-top:5px"></div></section>
      <section class="wst"><b>3 · Vẽ</b><div class="grid g2" id="sdTools" style="gap:4px;margin-top:5px">${[['edit', 'Chọn / sửa'], ['pan', 'Kéo hình'], ['poly', 'Chấm đường bao'], ['line', 'Kẻ đường'], ['point', 'Chấm 1 điểm'], ['guide', 'Vạch gióng'], ['wand', 'Đũa thần'], ['box', 'Dò trong khung']].map(([k, n]) => `<button class="btn sm" data-t="${k}">${n}</button>`).join('')}</div>
        <div class="lbl" style="margin-top:7px">Bắt dính (thước CAD)</div>
        <div class="flex" style="gap:8px;flex-wrap:wrap;margin-top:3px">${[['grid', 'Lưới'], ['pts', 'Điểm'], ['guides', 'Vạch gióng']].map(([k, n]) => `<label style="display:flex;gap:4px;align-items:center"><input type="checkbox" data-snap="${k}" ${st.snap[k] ? 'checked' : ''}> ${n}</label>`).join('')}</div>
        <div class="flex" style="gap:6px;align-items:center;margin-top:5px;flex-wrap:nowrap"><span class="muted" style="white-space:nowrap">Bước lưới</span><select id="sdGrid" style="flex:1" aria-label="Bước lưới">${[0.1, 0.25, 0.5, 1, 2].map((g) => `<option value="${g}" ${st.grid === g ? 'selected' : ''}>${fmt(g, g < 0.5 ? 2 : 1)} m</option>`).join('')}</select></div>
        <div class="muted" style="margin-top:5px">Shift: vẽ thẳng ngang / dọc · gõ số + Enter: đoạn đúng số mét · gõ «x;z» + Enter: điểm đúng tọa độ.</div>
        <div id="sdGuides" style="margin-top:6px"></div>
        <details style="margin-top:6px"><summary class="muted">Đũa thần</summary>
        <label class="lbl" for="sdTol" style="display:block;margin-top:6px">Độ nhạy: <b id="sdTolV">${st.tol}</b></label><input type="range" id="sdTol" min="10" max="120" step="5" value="${st.tol}" style="width:100%">
        <label style="display:flex;gap:6px;align-items:center;margin-top:4px"><input type="checkbox" id="sdSkip" ${st.skip !== false ? 'checked' : ''}> Vượt qua nét màu (đường nước, kích thước)</label></details></section>
      <section class="wst"><b>4 · Thư viện chi tiết</b><div class="muted" style="margin-top:3px">Bấm một loại rồi bấm lên tàu ở khung 3D để đặt (giữ Shift để đặt nhiều cái liền). Đặt xong kéo để dời, sửa cỡ ở khung bên phải.</div><div class="grid g2" id="sdLib" style="gap:4px;margin-top:5px"></div></section>
    </div>
    <div class="mmain"><div class="flex" style="gap:6px;align-items:center;flex-wrap:nowrap"><div class="seg" id="sdMode"></div><button class="btn sm" id="sdFit">Vừa khung</button><div class="note" id="sdHint" style="flex:1;margin:0;padding:4px 8px;min-width:0;height:50px;overflow-y:auto;box-sizing:border-box;line-height:1.3"></div></div>
      <div class="wcv"><canvas id="sdCv" tabindex="0"></canvas><div class="wempty" id="sdEmpty"></div></div><div class="muted mono" id="sdPos" style="min-height:16px"></div></div>
    <div class="mright">
      <section class="wst"><b>Chi tiết đang chọn</b><div id="sdSel" style="margin-top:5px"></div></section>
      <section class="wst"><b>Các chi tiết</b><div id="sdParts" style="margin-top:5px;max-height:170px;overflow:auto"></div></section>
      <section class="wst"><b>Xem 3D</b> <span class="muted" id="sd3dTip">(kéo để xoay, bấm khối để chọn)</span><div id="sd3dHome"><div id="sd3dWrap" style="position:relative;margin-top:5px"><div class="seg" id="sd3dBar" style="position:absolute;left:6px;top:6px;z-index:2"></div><canvas id="sd3d" style="width:100%;height:210px;display:block;border-radius:6px;background:#0b1116;touch-action:none" tabindex="0"></canvas></div></div><div class="muted" id="sd3dInfo" style="margin-top:4px"></div>
        <div class="flex" style="gap:10px;margin-top:6px;align-items:center;flex-wrap:wrap"><label style="display:flex;gap:4px;align-items:center;white-space:nowrap"><input type="checkbox" id="sdRails" ${st.model.opts.rails !== false ? 'checked' : ''}> Lan can mép boong</label><label style="display:flex;gap:4px;align-items:center;white-space:nowrap"><input type="checkbox" id="sdRoofRails" ${st.model.opts.roofRails !== false ? 'checked' : ''}> Lan can nóc tầng</label></div>
        <details id="sdColBox" style="margin-top:6px"><summary>Màu tàu, số hiệu mạn</summary><div id="sdCols" style="margin-top:5px"></div></details>
        <label style="display:flex;gap:6px;align-items:center;margin-top:6px"><input type="checkbox" id="sdWind" checked> Cập nhật diện tích hứng gió (tab 1) theo mô hình</label><div class="muted" id="sdMsg" style="margin-top:4px"></div></section>
    </div></div></div>`;
  d.style.display = 'flex';
  bind(); setTool(st.tool); refreshAll(); initPreview();
  for (const v of st.model.views) loadImg(v);
}
function close() { const d = $('#sdlg'); if (d) d.style.display = 'none'; if (st && st.p3) { st.p3.r.dispose(); st.p3.r.forceContextLoss(); st.p3 = null; } document.removeEventListener('keydown', onKey); }
function refreshAll() { drawLib(); drawCols(); drawBar3(); drawMode(); drawViews(); drawRefs(); drawGuides(); drawParts(); drawSel(); paint(); $('#sdName').textContent = st.model.name + (st.model.template ? ' — mẫu chung chung' : ''); }
// ---------- thư viện chi tiết, màu tàu ----------
function drawLib() { const el = $('#sdLib'); if (el) el.innerHTML = Object.entries(FIT_KINDS).map(([k, K]) => `<button class="btn sm ${st.place === k ? 'pri' : ''}" data-fk="${k}" title="${esc(K.tip || K.name)}" style="text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(K.name)}</button>`).join(''); }
function startPlace(k) {
  st.place = k || null; drawLib();
  if (k) { if (st.mode !== 'big3d') setMode('big3d'); const K = FIT_KINDS[k]; $('#sdHint').textContent = 'Bấm lên tàu ở khung 3D để đặt «' + K.name + '»' + (K.side ? ' (bấm lên mạn tàu)' : '') + '. Giữ Shift để đặt nhiều cái liền, Esc để thôi.' + (K.tip ? ' ' + K.tip + '.' : ''); }
  else if (st.mode === 'big3d') $('#sdHint').textContent = HINT3;
}
const hexOf = (n) => '#' + n.toString(16).padStart(6, '0');
function curColors() { const c = shipColors(st.model.opts); return { hull: hexOf(c.hull), super: hexOf(c.super), deck: hexOf(c.deck), boot: hexOf(c.boot) }; }
function drawCols() {
  const el = $('#sdCols'); if (!el) return; const o = st.model.opts, c = curColors();
  const pk = Object.entries(COLOR_PRESETS).find(([, pr]) => ['hull', 'super', 'deck', 'boot'].every((k) => pr[k].toLowerCase() === c[k].toLowerCase()));
  el.innerHTML = `<select id="sdPreset" style="width:100%" aria-label="Bảng màu có sẵn">${pk ? '' : '<option value="">— màu tự chọn —</option>'}${Object.entries(COLOR_PRESETS).map(([k, pr]) => `<option value="${k}" ${pk && pk[0] === k ? 'selected' : ''}>${pr.name}</option>`).join('')}</select>
  <div class="grid g2" style="gap:4px 8px;margin-top:5px">${[['hull', 'Vỏ tàu'], ['super', 'Thượng tầng'], ['deck', 'Boong'], ['boot', 'Dải đường nước']].map(([k, n]) => `<label style="display:flex;gap:6px;align-items:center"><input type="color" data-col="${k}" value="${c[k]}" style="width:34px;height:22px;padding:0;border:0;background:none"> ${n}</label>`).join('')}</div>
  <label style="display:flex;gap:6px;align-items:center;margin-top:5px"><input type="checkbox" id="sdRoofDeck" ${o.roofDeck !== false ? 'checked' : ''}> Nóc các tầng cùng màu boong</label>
  <div class="flex" style="gap:6px;margin-top:5px;flex-wrap:nowrap"><input id="sdHullNo" class="cell" value="${esc(o.hullNo || '')}" placeholder="Số hiệu mạn" maxlength="8" style="flex:1;min-width:0;text-align:left;height:26px" aria-label="Số hiệu mạn"><select id="sdHullNoCol" aria-label="Màu chữ số hiệu"><option value="" ${!o.hullNoCol ? 'selected' : ''}>Chữ tự chọn</option><option value="w" ${o.hullNoCol === 'w' ? 'selected' : ''}>Chữ trắng</option><option value="k" ${o.hullNoCol === 'k' ? 'selected' : ''}>Chữ đen</option></select></div>
  <div class="muted" style="margin-top:4px">Số hiệu sơn hai bên mạn phía mũi. Cửa kính: chọn khối, tick «Cửa kính» ở khung chi tiết (buồng lái chính có sẵn).</div>`;
}
function changed(panels = true) { st.edited = true; st.ver++; if (panels) { drawRefs(); drawParts(); drawGuides(); } paint(); clearTimeout(st.t3); st.t3 = setTimeout(rebuild3d, 250); if (!st.restoring) { clearTimeout(st.th); st.th = setTimeout(pushHist, 350); } }
// ---------- hoàn tác / làm lại: lưu ảnh chụp mô hình sau mỗi lần sửa ----------
function pushHist() { const j = JSON.stringify(st.model); if (st.hist[st.hi] === j) return; st.hist = st.hist.slice(0, st.hi + 1); st.hist.push(j); if (st.hist.length > 120) st.hist.shift(); st.hi = st.hist.length - 1; histBtns(); }
function histBtns() { const u = $('#sdUndo'), r = $('#sdRedo'); if (u) u.disabled = st.hi <= 0; if (r) r.disabled = st.hi >= st.hist.length - 1; }
function undo(dir) {
  if (st.th) { clearTimeout(st.th); st.th = null; pushHist(); }
  const k = st.hi + dir; if (k < 0 || k >= st.hist.length) return; st.hi = k;
  st.restoring = true; st.model = JSON.parse(st.hist[k]); st.model.guides = st.model.guides || [];
  if (!st.model.parts.some((p) => p.id === st.sel)) st.sel = null; if (!view()) st.cur = st.model.views[0] ? st.model.views[0].id : null; if (st.mode === 'single' && !view()) st.mode = 'board';
  st.draft = null; st.h3 = null; changed(); refreshAll(); st.restoring = false; histBtns(); st.edited = true;
}
// tỷ lệ từng hình (nhớ theo phiên bản dữ liệu)
const C = (v) => { let e = st.cc.get(v.id); if (!e || e.ver !== st.ver) { e = { ver: st.ver, c: calibrate(v, ship()) }; st.cc.set(v.id, e); } return e.c; };

// ---------- chế độ: bàn vẽ 3 hình chiếu / một hình ----------
function drawMode() {
  const v = view(), el = $('#sdMode');
  el.innerHTML = `<button data-m="board" class="${st.mode === 'board' ? 'on' : ''}">Bàn vẽ 3 hình chiếu</button><button data-m="single" class="${st.mode === 'single' ? 'on' : ''}" ${v ? '' : 'disabled'}>Một hình${v ? ': ' + esc(v.name) : ''}</button><button data-m="big3d" class="${st.mode === 'big3d' ? 'on' : ''}">3D lớn (sửa được)</button>`;
  const e = $('#sdEmpty'); e.style.display = st.mode === 'single' && !v ? 'flex' : 'none'; e.textContent = 'Chọn một ảnh ở bước 1 để đặt mốc, đo kích thước.';
}
function setMode(m, vid) {
  if (vid) st.cur = vid; if (m === 'single' && !view()) return; const was = st.mode; st.mode = m; st.draft = null; st.chain = null; st.typed = '';
  // 3D lớn: chuyển khung 3D vào giữa, chỗ bàn vẽ
  const wrap = $('#sd3dWrap'), cv3 = $('#sd3d');
  if (m === 'big3d') { $('.wcv').appendChild(wrap); wrap.style.cssText = 'position:absolute;inset:0;margin:0'; cv3.style.height = '100%'; cv3.style.borderRadius = '0'; $('#sdCv').style.visibility = 'hidden'; $('#sd3dTip').textContent = '— đang mở lớn ở giữa'; $('#sdHint').textContent = HINT3; }
  else if (was === 'big3d') { $('#sd3dHome').appendChild(wrap); wrap.style.cssText = 'position:relative;margin-top:5px'; cv3.style.height = '210px'; cv3.style.borderRadius = '6px'; $('#sdCv').style.visibility = ''; $('#sd3dTip').textContent = '(kéo để xoay, bấm khối để chọn)'; st.h3 = null; setTool(st.tool); }
  if (m === 'single') { fitView(); if (st.tool === 'guide') setTool('edit'); } else if (m === 'board') { if (st.tool === 'dim' || st.tool.startsWith('ref:')) setTool('edit'); fitBoard(); }
  refreshAll(); if (st.p3) { if (m === 'big3d') build3dExtras(); render3d(); }
}
const HINT3 = '3D lớn: bấm vào khối để chọn — điểm nắm hiện ở cả hai đầu khối (cam: hình mạn, xanh dương: mặt boong, xanh lá: hình mũi / lái; màu nhạt: hình tự sinh). Kéo điểm nắm để sửa (Shift: khóa một trục), bấm đúp lên cạnh để thêm điểm, Shift + kéo khối để dời cả khối. Chi tiết thư viện: kéo để dời, điểm vàng đổi cỡ, điểm tím xoay. Kéo chỗ trống: xoay (hoặc dời khi xem thẳng), lăn chuột: phóng to. Ctrl+Z hoàn tác.';

// ---------- danh sách ảnh / hình chiếu ----------
function drawViews() {
  const vs = st.model.views;
  $('#sdViews').innerHTML = vs.length ? vs.map((v) => { const c = C(v); return `<div class="flex" style="gap:4px;margin-bottom:4px;flex-wrap:nowrap;align-items:stretch"><button class="btn sm ${v.id === st.cur ? 'pri' : ''}" data-v="${v.id}" style="flex:1;min-width:0;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(v.name)}">${c.ok ? '' : '⚠ '}${esc(v.name)}</button><select data-k="${v.id}" style="width:92px" aria-label="Loại hình chiếu">${Object.entries(VIEW_KINDS).map(([k, n]) => `<option value="${k}" ${v.kind === k ? 'selected' : ''}>${n.replace('Nhìn ', '').replace(' (mặt boong)', '')}</option>`).join('')}</select><button class="btn sm" data-del="${v.id}" aria-label="Bỏ hình ${esc(v.name)}" style="padding:0 7px">✕</button></div>`; }).join('') : '<div class="muted">Chưa có ảnh nào.</div>';
}
// ---------- mốc & kích thước ----------
function drawRefs() {
  const el = $('#sdRefs');
  if (st.mode !== 'single') {
    const imgs = st.model.views.filter((v) => v.imgId);
    el.innerHTML = imgs.length ? imgs.map((v) => { const c = C(v); return `<div class="flex" style="gap:5px;align-items:center;margin-bottom:4px;flex-wrap:nowrap"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(v.name)}">${esc(v.name)}</span><span class="${c.ok ? 'muted' : ''}" style="${c.ok ? '' : 'color:#FFB547'}">${c.ok ? '✓ có tỷ lệ' : 'chưa đặt mốc'}</span><button class="btn sm" data-cal="${v.id}">Đặt mốc</button></div>`; }).join('') + '<div class="muted">Ảnh phải có mốc (mũi, lái, đáy ky / hai mép) mới hiện đúng chỗ trên bàn vẽ.</div>' : '<div class="muted">Vẽ trên lưới thì không cần mốc. Có ảnh sơ đồ thì đặt mốc ở đây.</div>';
    return;
  }
  const v = view(); if (!v) { el.innerHTML = '<div class="muted">Chọn một ảnh ở bước 1.</div>'; return; }
  const c = C(v), s = ship(), lon = v.kind === 'side' || v.kind === 'top';
  el.innerHTML = `<div class="grid g3" style="gap:4px">${REFS[v.kind].map((k) => `<button class="btn sm ${st.tool === 'ref:' + k ? 'pri' : ''}" data-ref="${k}">${REF_NAMES[k]}${v.refs && v.refs[k] ? ' ✓' : ''}</button>`).join('')}</div>
  <div class="muted" style="margin-top:5px">${lon ? `Bấm mũi và lái ${v.kind === 'top' ? '(trên đường tâm)' : '(điểm xa nhất)'}: app lấy chiều dài LOA = ${fmt(s.L)} m ở tab 1.` : `Bấm hai mép rộng nhất: app lấy B = ${fmt(s.B)} m ở tab 1.`}${v.kind !== 'top' ? ' Đáy ky: một điểm trên đường đáy.' : ''}</div>
  <button class="btn sm ${st.tool === 'dim' ? 'pri' : ''}" data-t2="dim" style="width:100%;margin-top:6px">Đo kích thước (kéo nhiều điểm)</button>
  ${(v.dims || []).map((q, i) => `<div class="flex" style="gap:4px;margin-top:4px;align-items:center;flex-wrap:nowrap"><span class="mono" style="width:18px">${i + 1}</span><input class="cell mono" data-dim="${i}" value="${q.m ? fmt(q.m, 2) : ''}" placeholder="m" style="width:70px;height:24px" aria-label="Kích thước ${i + 1} (m)"><span class="muted" style="flex:1">m${c.ok && c.res[i] !== undefined && q.m ? ' · lệch ' + fmt(c.res[i], 1) + '%' : ''}</span><button class="btn sm" data-ddel="${i}" style="padding:0 6px" aria-label="Bỏ kích thước ${i + 1}">✕</button></div>`).join('')}
  <div class="${c.ok ? 'muted' : ''}" style="margin-top:6px;${c.ok ? '' : 'color:#FFB547'}">${c.ok ? `Tỷ lệ: 1 m = ${fmt(1 / c.su, 1)} điểm ảnh ngang · ${fmt(1 / c.sv, 1)} đứng${c.noBase ? ' · chưa có đáy ky' : ''}${c.res.some((e) => Math.abs(e) > 3) ? '<br><span style="color:#FF8A8A">Có kích thước lệch &gt; 3% — kiểm tra lại số hoặc điểm bấm.</span>' : ''}` : esc(c.msg)}</div>
  <button class="btn sm pri" data-m2="board" style="width:100%;margin-top:7px">← Về bàn vẽ 3 hình chiếu</button>`;
}
// ---------- vạch gióng ----------
function drawGuides() {
  const g = st.model.guides || [], el = $('#sdGuides'); if (!el) return;
  el.innerHTML = g.length ? '<div class="lbl">Vạch gióng</div>' + g.map((q, i) => `<div class="flex" style="gap:4px;margin-top:3px;align-items:center;flex-wrap:nowrap"><span class="mono" style="width:18px">${q.ax}</span><input class="cell mono" data-gv="${i}" value="${fmt(q.v, 2)}" style="width:76px;height:24px" aria-label="Vạch gióng ${q.ax} (m)"><span class="muted" style="flex:1">m</span><button class="btn sm" data-gdel="${i}" style="padding:0 6px" aria-label="Xóa vạch gióng">✕</button></div>`).join('') : '';
}
// ---------- danh sách chi tiết ----------
function drawParts() {
  const el = $('#sdParts'), kinds = st.mode === 'single' ? null : ['side', 'top', 'front', 'back'];
  const ps = st.model.parts.filter((p) => { const v = viewById(p.view); return v && (kinds ? kinds.includes(v.kind) : v.id === st.cur); });
  const vk = (p) => { const v = viewById(p.view); return v ? { side: 'Mạn', top: 'Boong', front: 'Mũi', back: 'Lái' }[v.kind] : ''; };
  const fs = st.mode === 'single' ? [] : st.model.fits || [];
  el.innerHTML = ps.length || fs.length ? ps.map((p) => `<div class="flex" style="gap:5px;align-items:center;margin-bottom:3px;flex-wrap:nowrap"><span style="width:10px;height:10px;border-radius:2px;background:${colOf(p)};flex:0 0 10px"></span><span class="muted" style="width:38px;flex:0 0 38px">${vk(p)}</span><button class="btn sm ${p.id === st.sel ? 'pri' : ''}" data-p="${p.id}" style="flex:1;min-width:0;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(partLabel(p))}${p.curve ? ' ∿' : ''}</button></div>`).join('')
    + fs.map((f) => `<div class="flex" style="gap:5px;align-items:center;margin-bottom:3px;flex-wrap:nowrap"><span style="width:10px;height:10px;border-radius:50%;background:#B0BEC5;flex:0 0 10px"></span><span class="muted" style="width:38px;flex:0 0 38px">TV</span><button class="btn sm ${f.id === st.sel ? 'pri' : ''}" data-p="${f.id}" style="flex:1;min-width:0;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc((FIT_KINDS[f.kind] || {}).name || f.kind)}${f.note ? ' — ' + esc(f.note) : ''}</button></div>`).join('') : '<div class="muted">Chưa có chi tiết nào.</div>';
}
// ---------- chi tiết đang chọn: chọn loại nhiều nấc ----------
function drawSel() {
  const el = $('#sdSel'), p = partOf(st.sel), f = fitOf(st.sel);
  if (st.p3 && st.selShown !== st.sel + '|' + (st.h3sel ? st.h3sel.pid + st.h3sel.k : '') + '|' + st.mode) { st.selShown = st.sel + '|' + (st.h3sel ? st.h3sel.pid + st.h3sel.k : '') + '|' + st.mode; build3dExtras(); }
  if (f) { drawFitSel(el, f); return; }
  if (!p) { el.innerHTML = '<div class="muted">Bấm vào một chi tiết trên bàn vẽ hoặc trên 3D để chọn, hoặc vẽ mới ở bước 3, hoặc đặt từ thư viện ở bước 4.</div>'; return; }
  let h = ''; const r = resolve(p.type);
  for (let dpt = 0; dpt < 5; dpt++) { const opts = childrenAt(p.type, dpt); if (!opts) break; h += `<select data-lv="${dpt}" style="width:100%;margin-bottom:4px" aria-label="Loại chi tiết nấc ${dpt + 1}"><option value="">— chọn ${dpt ? 'tiếp' : 'loại'} —</option>${opts.map((o) => `<option value="${o.id}" ${p.type[dpt] === o.id ? 'selected' : ''}>${o.name}</option>`).join('')}</select>`; if (p.type[dpt] === undefined) break; }
  const pt = r.leaf && r.node.kind === 'point', src = st.geom && st.geom.src ? st.geom.src[p.id] : '';
  h += r.leaf ? `<div class="muted" style="margin:2px 0 6px">${esc(r.names.join(' › '))}${r.node.key ? ' — đèn nối với bảng Đèn ở tab 3' : ''}${src ? '<br>Dựng từ: ' + esc(src) : ''}</div>` : '<div style="color:#FF8A8A;margin:2px 0 6px">Chọn đến nấc cuối để app biết dựng chi tiết này.</div>';
  h += `<input id="sdNote" class="cell" value="${esc(p.note || '')}" placeholder="Ghi chú (tùy ý)" style="width:100%;margin-bottom:5px;text-align:left;height:28px">`;
  if (!pt) h += `<div class="grid g3" style="gap:4px">${[['h', 'Cao'], ['w', 'Rộng'], ['l', 'Dài']].map(([k, n]) => `<div class="fld"><label for="sdN${k}">${n} (m)</label><div class="in"><input id="sdN${k}" data-num="${k}" value="${p.num && p.num[k] ? fmt(p.num[k], 2) : ''}" placeholder="tự tính"></div></div>`).join('')}</div>`;
  // nét thẳng / cong mềm, bo góc; cửa kính cho khối
  if (p.kind === 'poly' || p.kind === 'line') {
    h += `<div class="flex" style="gap:6px;align-items:center;margin-top:6px;flex-wrap:nowrap"><span class="muted" style="white-space:nowrap">Nét</span><div class="seg" id="sdCurve"><button data-cv="0" class="${p.curve ? '' : 'on'}">Thẳng</button><button data-cv="1" class="${p.curve ? 'on' : ''}">Cong mềm</button></div><span class="muted" style="white-space:nowrap">Bo góc</span><div class="in" style="width:58px"><input id="sdFillet" class="cell" value="${p.fillet > 0 ? fmt(p.fillet, 2) : ''}" placeholder="0" style="width:100%;height:24px" aria-label="Bán kính bo góc (m)"></div><span class="muted">m</span></div>
    <div class="muted" style="margin-top:3px">Cong mềm: đường cong đi qua các điểm. Bo góc: bo tròn các góc theo bán kính. Chọn một điểm rồi tick «Góc sắc» để giữ góc ở đó (chân khối sát boong tự giữ góc).</div>`;
    if (r.leaf && ['block', 'wing'].includes(r.node.role)) { const g = st.geom && st.geom.links ? st.geom.links[p.id] || [p.id] : [p.id], wv = g.map((id) => partOf(id)).filter(Boolean).map((q) => q.win).find((v) => v !== undefined), on = wv !== undefined ? !!wv : !!r.node.bridge; h += `<label style="display:flex;gap:6px;align-items:center;margin-top:5px"><input type="checkbox" id="sdWin" ${on ? 'checked' : ''}> Cửa kính (dải kính quanh khối, sát nóc)</label>`; }
  }
  h += `<div class="flex" style="gap:5px;margin-top:6px"><button class="btn sm" id="sdDup" style="flex:1">Nhân bản${/(^|canh)[TP]$/.test(p.type[p.type.length - 1] || '') ? ' sang mạn kia' : ''}</button><button class="btn sm warn" id="sdDelP" style="flex:1">Xóa chi tiết</button></div>`;
  // điểm đang chọn (trên bàn vẽ hoặc 3D): gõ tọa độ, góc sắc
  const hs = st.h3sel && st.h3sel.pid === p.id ? p : null, hv = hs && viewById(p.view), hc = hv && C(hv);
  if (hs && hc.ok && p.pts[st.h3sel.k]) { const a = hc.toShip(p.pts[st.h3sel.k]), lab = AX[hv.kind]; h += `<div class="lbl" style="margin-top:7px">Điểm ${st.h3sel.k + 1} đang chọn (${{ side: 'hình mạn', top: 'mặt boong', front: 'hình mũi', back: 'hình lái' }[hv.kind]})</div><div class="grid g2" style="gap:4px;margin-top:3px">${[0, 1].map((i) => `<div class="fld"><label for="sdH${i}">${lab[i]} (m)</label><div class="in"><input id="sdH${i}" data-hc="${i}" value="${fmt(a[i], 2)}"></div></div>`).join('')}</div>${p.curve || p.fillet > 0 ? `<label style="display:flex;gap:6px;align-items:center;margin-top:4px"><input type="checkbox" id="sdSharp" ${(p.sharp || []).includes(st.h3sel.k) ? 'checked' : ''}> Góc sắc ở điểm này</label>` : ''}`; }
  el.innerHTML = h;
  $$('#sdSel [data-hc]').forEach((i) => { i.onchange = () => { const a = hc.toShip(p.pts[st.h3sel.k]); a[+i.dataset.hc] = num(i.value.replace(',', '.'), a[+i.dataset.hc]); p.pts[st.h3sel.k] = hc.toPx(a); changed(); }; });
  const shp = $('#sdSharp'); if (shp) shp.onchange = () => { const k = st.h3sel.k, s0 = new Set(p.sharp || []); if (shp.checked) s0.add(k); else s0.delete(k); p.sharp = [...s0].sort((x, y) => x - y); changed(false); };
  const cv = $('#sdCurve'); if (cv) cv.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; p.curve = b.dataset.cv === '1'; if (!p.curve) delete p.curve; drawSel(); changed(false); };
  const fi = $('#sdFillet'); if (fi) fi.onchange = () => { const v = num(fi.value.replace(',', '.'), 0); if (v > 0) p.fillet = v; else delete p.fillet; changed(false); };
  const wi = $('#sdWin'); if (wi) wi.onchange = () => { const g = st.geom && st.geom.links ? st.geom.links[p.id] || [p.id] : [p.id]; for (const id of g) { const q = partOf(id); if (q) delete q.win; } p.win = wi.checked; changed(false); };
  $$('#sdSel select').forEach((s) => { if (!s.dataset.lv) return; s.onchange = () => { const dpt = +s.dataset.lv; p.type = p.type.slice(0, dpt); if (s.value) p.type.push(s.value); if (isPointType(p.type) && p.kind === 'point') st.lastPoint = p.type.slice(); drawSel(); changed(); }; });
  $('#sdNote').oninput = (e) => { p.note = e.target.value; drawParts(); };
  $$('#sdSel [data-num]').forEach((i) => { i.onchange = () => { p.num = p.num || {}; const v = num(i.value, 0); if (v > 0) p.num[i.dataset.num] = v; else delete p.num[i.dataset.num]; changed(false); }; });
  $('#sdDelP').onclick = () => delPart(p.id);
  $('#sdDup').onclick = () => { const q = clone(p); q.id = uid('p'); delete q.grp; const last = q.type[q.type.length - 1] || ''; const sw = { T: 'P', P: 'T', canhT: 'canhP', canhP: 'canhT' }; if (sw[last]) q.type[q.type.length - 1] = sw[last]; else { const v = viewById(p.view), c = v && C(v), k = c && c.ok ? 1 / c.su : 12; q.pts = q.pts.map(([x, y]) => [x + k, y + k]); } st.model.parts.push(q); st.sel = q.id; drawSel(); changed(); };
}
// chi tiết thư viện đang chọn: kích thước, hướng, vị trí
function drawFitSel(el, f) {
  const K = FIT_KINDS[f.kind] || { name: f.kind }, fld = (k, n, v, d = 2) => `<div class="fld"><label for="sdF${k}">${n}</label><div class="in"><input id="sdF${k}" data-fk="${k}" value="${fmt(v, d)}"></div></div>`;
  let h = `<div><b>${esc(K.name)}</b> <span class="muted">(thư viện)</span></div>${K.tip ? `<div class="muted" style="margin:2px 0 4px">${esc(K.tip)}</div>` : ''}`;
  h += `<input id="sdFNote" class="cell" value="${esc(f.note || '')}" placeholder="Ghi chú (tùy ý)" style="width:100%;margin:4px 0 5px;text-align:left;height:28px">`;
  h += `<div class="grid g3" style="gap:4px">${fld('l', 'Dài (m)', f.l)}${fld('w', 'Rộng (m)', f.w)}${fld('h', 'Cao (m)', f.h)}</div>`;
  h += `<div class="grid g3" style="gap:4px;margin-top:4px">${fld('rot', 'Xoay (°)', f.rot || 0, 0)}`;
  if (f.kind === 'turret') h += fld('n', 'Số nòng', f.n || 1, 0) + fld('bl', 'Dài nòng (m)', f.bl || 4);
  else if (f.kind === 'launcher') h += fld('rows', 'Số hàng', f.rows || 2, 0) + fld('cols', 'Số cột', f.cols || 4, 0) + '</div><div class="grid g3" style="gap:4px;margin-top:4px">' + fld('el', 'Góc ngóc (°)', f.el === undefined ? 15 : f.el, 0);
  else if (f.kind === 'radar') h += fld('rpm', 'Vòng / phút', f.rpm || 24, 0);
  h += '</div>';
  h += `<div class="lbl" style="margin-top:6px">Vị trí (m)</div><div class="grid g3" style="gap:4px;margin-top:3px">${fld('x', 'Dọc (mũi +)', f.x)}${fld('y', 'Ngang (phải +)', f.y)}${fld('z', 'Cao từ ky', f.z)}</div>`;
  h += `<div class="flex" style="gap:5px;margin-top:6px"><button class="btn sm" id="sdFMir" style="flex:1">Nhân bản sang mạn kia</button><button class="btn sm" id="sdFDup" style="flex:1">Nhân bản</button></div><button class="btn sm warn" id="sdFDel" style="width:100%;margin-top:5px">Xóa chi tiết</button>`;
  h += `<div class="muted" style="margin-top:5px">Trên 3D lớn: kéo chi tiết để dời (tự bám mặt boong / nóc), kéo điểm vàng để đổi cỡ, điểm tím để xoay. Phím R / Shift+R: xoay 15°.</div>`;
  el.innerHTML = h;
  $$('#sdSel [data-fk]').forEach((i) => { i.onchange = () => { const k = i.dataset.fk, v = num(i.value.replace(',', '.'), f[k] || 0); if (['l', 'w', 'h', 'bl'].includes(k) && !(v > 0.02)) return; f[k] = ['n', 'rows', 'cols'].includes(k) ? Math.max(1, Math.round(v)) : v; changed(); }; });
  $('#sdFNote').oninput = (e) => { f.note = e.target.value; drawParts(); };
  $('#sdFDel').onclick = () => delPart(f.id);
  $('#sdFMir').onclick = () => { const g = mirrorFit(f); g.id = uid('f'); st.model.fits.push(g); st.sel = g.id; drawSel(); changed(); };
  $('#sdFDup').onclick = () => { const g = clone(f); g.id = uid('f'); g.x = r2(f.x - Math.max(1, f.l * 1.3)); st.model.fits.push(g); st.sel = g.id; drawSel(); changed(); };
}
function delPart(id) { st.model.parts = st.model.parts.filter((q) => q.id !== id); st.model.fits = (st.model.fits || []).filter((q) => q.id !== id); if (st.sel === id) st.sel = null; if (st.h3sel && st.h3sel.pid === id) st.h3sel = null; drawSel(); changed(); }

// ---------- công cụ ----------
function setTool(t) {
  st.tool = t; st.draft = null; st.chain = null; st.typed = '';
  $$('#sdTools button').forEach((b) => b.classList.toggle('pri', b.dataset.t === t));
  $('#sdHint').textContent = t.startsWith('ref:') ? 'Bấm vào vị trí «' + REF_NAMES[t.slice(4)] + '» trên ảnh.' : HINT[t] || '';
  const c = $('#sdCv'); if (c) c.style.cursor = t === 'pan' ? 'grab' : t === 'edit' ? 'default' : 'crosshair';
  if (st.mode === 'single') drawRefs(); paint();
}
function bind() {
  $('#sdClose').onclick = close;
  $('#sdUndo').onclick = () => undo(-1); $('#sdRedo').onclick = () => undo(1); histBtns();
  $('#sd3dBar').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; st.cam3 = b.dataset.c; if (st.p3) { st.p3.oz = 1; st.p3.ox = 0; st.p3.oy = 0; } drawBar3(); render3d(); };
  $('#sdTools').onclick = (e) => { const t = e.target.dataset.t; if (t) setTool(st.tool === t && t !== 'edit' ? 'edit' : t); };
  $('#sdMode').onclick = (e) => { const b = e.target.closest('button'); if (b && !b.disabled) setMode(b.dataset.m); };
  $('#sdFit').onclick = () => { if (st.mode === 'board') fitBoard(); else fitView(); paint(); };
  $('#sdTol').oninput = (e) => { st.tol = +e.target.value; $('#sdTolV').textContent = st.tol; };
  $('#sdSkip').onchange = (e) => { st.skip = e.target.checked; };
  $('#sdGrid').onchange = (e) => { st.grid = +e.target.value; paint(); };
  $$('[data-snap]').forEach((i) => { i.onchange = () => { st.snap[i.dataset.snap] = i.checked; }; });
  $('#sdGuides').onclick = (e) => { const b = e.target.closest('button'); if (b && b.dataset.gdel !== undefined) { st.model.guides.splice(+b.dataset.gdel, 1); changed(); } };
  $('#sdGuides').onchange = (e) => { const i = e.target.dataset.gv; if (i === undefined) return; st.model.guides[+i].v = num(e.target.value.replace(',', '.'), st.model.guides[+i].v); changed(); };
  $('#sdViews').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.v) { st.cur = b.dataset.v; st.active[viewById(b.dataset.v).kind] = b.dataset.v; st.sel = null; if (st.mode === 'single') fitView(); refreshAll(); } else if (b.dataset.del) { const v = viewById(b.dataset.del); if (v && confirm('Bỏ hình «' + v.name + '» và các chi tiết vẽ trên nó?')) { st.model.views = st.model.views.filter((q) => q !== v); st.model.parts = st.model.parts.filter((p) => p.view !== v.id); if (st.cur === v.id) st.cur = st.model.views[0] ? st.model.views[0].id : null; if (!view()) st.mode = 'board'; st.sel = null; refreshAll(); changed(); } } };
  $('#sdViews').onchange = (e) => { const s = e.target; if (s.dataset.k) { const v = viewById(s.dataset.k); v.kind = s.value; v.refs = {}; if (!v.imgId) blankRefs(v); refreshAll(); changed(); } };
  $('#sdRefs').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.cal) { setMode('single', b.dataset.cal); setTool('ref:' + (REFS[view().kind].find((k) => !(view().refs || {})[k]) || REFS[view().kind][0])); } else if (b.dataset.m2) setMode('board'); else if (b.dataset.ref) setTool('ref:' + b.dataset.ref); else if (b.dataset.t2) setTool(st.tool === 'dim' ? 'edit' : 'dim'); else if (b.dataset.ddel !== undefined) { view().dims.splice(+b.dataset.ddel, 1); changed(); } };
  $('#sdRefs').onchange = (e) => { const i = e.target.dataset.dim; if (i === undefined) return; const q = view().dims[+i]; q.m = num(e.target.value, 0); changed(); };
  $('#sdParts').onclick = (e) => { const b = e.target.closest('button'); if (b && b.dataset.p) { st.sel = b.dataset.p; drawParts(); drawSel(); paint(); } };
  $('#sdFile').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) addFile(f); };
  $('#sdRails').onchange = (e) => { st.model.opts.rails = e.target.checked; changed(false); };
  $('#sdRoofRails').onchange = (e) => { st.model.opts.roofRails = e.target.checked; changed(false); };
  $('#sdLib').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; startPlace(st.place === b.dataset.fk ? null : b.dataset.fk); };
  $('#sdCols').onchange = (e) => { const t = e.target, o = st.model.opts;
    if (t.id === 'sdPreset') { const pr = COLOR_PRESETS[t.value]; if (pr) { o.colors = { hull: pr.hull, super: pr.super, deck: pr.deck, boot: pr.boot }; o.shade = COLOR_PRESETS[t.value] && ['haze', 'dark', 'light', 'blue'].includes(t.value) ? t.value : o.shade; } }
    else if (t.dataset.col) { o.colors = o.colors || curColors(); o.colors[t.dataset.col] = t.value; }
    else if (t.id === 'sdRoofDeck') o.roofDeck = t.checked; else if (t.id === 'sdHullNoCol') { if (t.value) o.hullNoCol = t.value; else delete o.hullNoCol; } else return;
    drawCols(); changed(false); };
  $('#sdCols').oninput = (e) => { if (e.target.id !== 'sdHullNo') return; st.model.opts.hullNo = e.target.value; clearTimeout(st.tn); st.tn = setTimeout(() => changed(false), 400); };
  $('#sdTpl').onclick = () => {
    if (st.model.parts.length && !confirm('Thay mô hình đang vẽ bằng mẫu tàu pháo chung chung?')) return;
    st.model = makeTemplate(); st.model.guides = []; st.cur = st.model.views[0].id;
    { const k = ship().L / TEMPLATE_SHIP.loa; if (Math.abs(k - 1) > 1e-3) for (const f of st.model.fits || []) for (const q of ['x', 'y', 'z', 'l', 'w', 'h', 'bl']) if (f[q] !== undefined) f[q] = r2(f[q] * k); } st.sel = null; st.img.clear(); st.data.clear(); st.active = {};
    if (confirm('Đặt luôn thông số tàu ở tab 1 theo mẫu (dài 62 m, rộng 9,5 m, mớn 2,8 m, 2 máy, hết lái 25°)?\nKhông đặt thì mẫu tự co giãn theo chiều dài, chiều rộng tàu hiện có.')) { Object.assign(A.p, TEMPLATE_SHIP, { name: 'Tàu pháo mẫu' }); saveShip(); }
    st.mode = 'board'; st.ver++; fitBoard(); refreshAll(); changed();
  };
  $('#sdApply').onclick = apply;
  $('#sdFleet').onclick = () => { if (st.model.parts.length) apply(); fleetSaveForm($('#sdFleetBox'), (id, type, name) => { $('#sdMsg').textContent = 'Đã lưu «' + name + '» (' + type + ') vào kho tàu.'; if (A.hooks.shipTab) A.hooks.shipTab(); }); };
  $('#sdExp').onclick = exportFile;
  $('#sdImp').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); };
  const c = $('#sdCv');
  const pos = (e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
  c.onwheel = (e) => { e.preventDefault(); zoomAt(pos(e), e.deltaY > 0 ? 0.85 : 1.18); };
  c.onpointerdown = (e) => { c.focus({ preventScroll: true }); down(e, pos(e)); };
  c.onpointermove = (e) => move(e, pos(e));
  c.onpointerup = (e) => up(e, pos(e));
  c.onpointerleave = () => { st.mouse = null; st.hover = null; paint(); };
  c.ondblclick = (e) => dbl(pos(e));
  c.oncontextmenu = (e) => { e.preventDefault(); ctx(pos(e)); };
  document.addEventListener('keydown', onKey);
  if (!window.__sdResize) { window.__sdResize = true; window.addEventListener('resize', () => { if (st && $('#sdlg') && $('#sdlg').style.display !== 'none') { paint(); render3d(); } }); }
}
function onKey(e) {
  if (!st || $('#sdlg').style.display === 'none') return; const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName);
  if (typing) return;
  if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y')) { undo(e.key.toLowerCase() === 'y' || e.shiftKey ? 1 : -1); e.preventDefault(); e.stopPropagation(); return; }
  const drawing = st.draft || st.tool === 'guide';
  if (drawing && /^[0-9.,;\-]$/.test(e.key)) { st.typed += e.key; paint(); e.preventDefault(); e.stopPropagation(); return; }
  if (e.key === 'Backspace' && st.typed) { st.typed = st.typed.slice(0, -1); paint(); e.preventDefault(); e.stopPropagation(); return; }
  if (e.key === 'Escape' && st.place) { startPlace(null); e.preventDefault(); e.stopPropagation(); return; }
  if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && fitOf(st.sel)) { const f = fitOf(st.sel); f.rot = ((f.rot || 0) + (e.shiftKey ? -15 : 15) + 540) % 360 - 180; changed(); drawSel(); e.preventDefault(); e.stopPropagation(); return; }
  if (e.key === 'Escape') { if (st.typed) st.typed = ''; else if (st.draft || st.chain || st.drag) { st.draft = null; st.chain = null; st.drag = null; } else if (st.sel) { st.sel = null; drawSel(); drawParts(); } else if (st.tool !== 'edit') setTool('edit'); paint(); e.preventDefault(); e.stopPropagation(); return; }
  if (e.key === 'Enter') { if (st.typed) typedEnter(e.shiftKey); else if (st.draft) finishDraft(); e.preventDefault(); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && st.sel) { delPart(st.sel); e.preventDefault(); }
  e.stopPropagation();
}

// ---------- ảnh sơ đồ ----------
async function addFile(f) {
  const msg = $('#sdMsg'); msg.textContent = 'Đang đọc ' + f.name + '…';
  try {
    let cv, name = f.name.replace(/\.[^.]+$/, '');
    if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') {
      const pdf = await openPdf(new Uint8Array(await f.arrayBuffer())); let pg = 1;
      if (pdf.numPages > 1) { pg = Math.round(num(prompt('File PDF có ' + pdf.numPages + ' trang. Nạp trang số mấy?', '1'), 1)); pg = Math.max(1, Math.min(pdf.numPages, pg)); name += ' (tr. ' + pg + ')'; }
      const page = await pdf.getPage(pg), v0 = page.getViewport({ scale: 1 }), sc = Math.min(5000 / Math.max(v0.width, v0.height), Math.sqrt(20e6 / (v0.width * v0.height)));
      const vp = page.getViewport({ scale: sc }); cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
      const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); await page.render({ canvasContext: g, viewport: vp }).promise;
    } else {
      const bmp = await createImageBitmap(f), k = Math.min(1, 6000 / Math.max(bmp.width, bmp.height)); cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
      const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(bmp, 0, 0, cv.width, cv.height);
    }
    const blob = await new Promise((res) => cv.toBlob(res, 'image/png')), imgId = uid('img'); await putImg(imgId, blob);
    const has = new Set(st.model.views.filter((q) => q.imgId).map((q) => q.kind)), kind = ['side', 'top', 'front', 'back'].find((k) => !has.has(k)) || 'side';
    const v = { id: uid('v'), kind, name, imgId, iw: cv.width, ih: cv.height, refs: {}, dims: [] };
    st.model.views.push(v); st.img.set(v.id, cv); st.active[kind] = v.id; st.sel = null; if (st.model.template) delete st.model.template;
    setMode('single', v.id); setTool('ref:' + REFS[v.kind][0]); changed();
    msg.textContent = 'Đã thêm «' + name + '». Kiểm tra loại hình chiếu ở bước 1, đặt mốc ở bước 2, rồi «Về bàn vẽ».';
  } catch (e) { msg.textContent = 'Không đọc được file: ' + (e.message || e); console.error(e); }
}
// hình trống (lưới, 20 điểm ảnh / m): mốc đặt sẵn theo kích thước tàu ở tab 1
function blankRefs(v) {
  const s = ship(), PX = 20, M = 100, lon = v.kind === 'side' || v.kind === 'top', w = (lon ? s.L : s.B * 1.4) * PX + 2 * M, h = (v.kind === 'top' ? s.B * 1.4 : v.kind === 'side' ? s.D * 3.5 : s.D * 2.2) * PX + 2 * M;
  v.iw = Math.round(w); v.ih = Math.round(h);
  if (v.kind === 'side') v.refs = { stern: [M, h - M], bow: [M + s.L * PX, h - M], base: [w / 2, h - M] };
  else if (v.kind === 'top') v.refs = { stern: [M, h / 2], bow: [M + s.L * PX, h / 2] };
  else v.refs = { left: [w / 2 - s.B / 2 * PX, h - M], right: [w / 2 + s.B / 2 * PX, h - M], base: [w / 2, h - M] };
}
// hình để vẽ vào ô `kind`: ảnh đang chọn (có tỷ lệ) → hình bất kỳ có tỷ lệ → tạo hình trống
function targetView(kind) {
  const ok = st.model.views.filter((v) => v.kind === kind && C(v).ok), a = ok.find((v) => v.id === st.active[kind]);
  if (a) return a; if (ok.length) return ok.find((v) => !v.imgId) || ok[0];
  const v = { id: uid('v'), kind, name: VIEW_KINDS[kind] + ' (lưới)', imgId: null, dims: [] }; blankRefs(v); st.model.views.push(v); st.ver++; drawViews(); return v;
}
async function loadImg(v) {
  if (!v.imgId || st.img.has(v.id)) return;
  try { const b = await getImg(v.imgId); if (!b) return; const bmp = await createImageBitmap(b), cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height; cv.getContext('2d').drawImage(bmp, 0, 0); st.img.set(v.id, cv); if (st.mode === 'single' && v.id === st.cur && !st.fitted) fitView(); paint(); } catch (e) { console.warn(e); }
}
function imgData(v) { if (st.data.has(v.id)) return st.data.get(v.id); const cv = st.img.get(v.id); if (!cv) return null; const d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, cv.width, cv.height); st.data.clear(); st.data.set(v.id, d); return d; }

// ---------- bàn vẽ: bố cục các ô (tọa độ tấm vẽ, mét; trục Y tấm vẽ hướng xuống) ----------
function layout() {
  const s = ship(), m = Math.max(2, s.L * 0.05), gap = Math.max(3, s.L * 0.04), Ym = Math.max(s.B / 2 * 1.4, s.B / 2 + 3);
  let zTop = Math.max(s.D * 3, 12);
  for (const p of st.model.parts) { const v = viewById(p.view); if (!v || (v.kind !== 'side' && v.kind !== 'front' && v.kind !== 'back')) continue; const c = C(v); if (!c.ok) continue; for (const q of p.pts) zTop = Math.max(zTop, c.toShip(q)[1] + 3); }
  zTop = Math.min(zTop, s.L * 1.2);
  const zBot = 3, xa = -s.L / 2 - m, xf = s.L / 2 + m, Yc = zBot + gap + Ym, Xfc = xf + gap + Ym, Xbc = xa - gap - Ym;
  const L = {
    side: { r: [xa, -zTop, xf, zBot], to: (a) => [a[0], -a[1]], from: (P) => [P[0], -P[1]] },
    top: { r: [xa, Yc - Ym, xf, Yc + Ym], to: (a) => [a[0], Yc + a[1]], from: (P) => [P[0], P[1] - Yc] },
    front: { r: [Xfc - Ym, -zTop, Xfc + Ym, zBot], to: (a) => [Xfc - a[0], -a[1]], from: (P) => [Xfc - P[0], -P[1]] }
  };
  if (st.showBack) L.back = { r: [Xbc - Ym, -zTop, Xbc + Ym, zBot], to: (a) => [Xbc + a[0], -a[1]], from: (P) => [P[0] - Xbc, -P[1]] };
  return L;
}
const kindsOn = () => Object.keys(st.lay || {});
const cvSize = () => { const c = $('#sdCv'); return [c.width, c.height]; };
const S2s = (P) => { const [W, H] = cvSize(); return [W / 2 + (P[0] - st.b.cx) * st.b.sc, H / 2 + (P[1] - st.b.cy) * st.b.sc]; };
const s2S = (p) => { const [W, H] = cvSize(); return [st.b.cx + (p[0] - W / 2) / st.b.sc, st.b.cy + (p[1] - H / 2) / st.b.sc]; };
function fitBoard() {
  const c = $('#sdCv'); if (!c) return; sizeCv(); st.lay = layout(); let a = Infinity, b = Infinity, cc = -Infinity, d = -Infinity;
  for (const k of kindsOn()) { const r = st.lay[k].r; a = Math.min(a, r[0]); b = Math.min(b, r[1]); cc = Math.max(cc, r[2]); d = Math.max(d, r[3]); }
  st.b = { cx: (a + cc) / 2, cy: (b + d) / 2, sc: Math.min(c.width / (cc - a), c.height / (d - b)) * 0.96 || 4 };
}
// đổi tọa độ theo chế độ: điểm ảnh của hình v ↔ màn hình; mét (trục của ô) ↔ màn hình
function i2sV(v, q) { if (st.mode === 'single') return i2s(q); const c = C(v); return c.ok && st.lay[v.kind] ? S2s(st.lay[v.kind].to(c.toShip(q))) : [NaN, NaN]; }
function s2iV(v, p) { if (st.mode === 'single') return s2i(p); const c = C(v); return c.toPx(st.lay[v.kind].from(s2S(p))); }
function m2s(kind, a) { if (st.mode === 'single') { const c = C(view()); return i2s(c.toPx(a)); } return S2s(st.lay[kind].to(a)); }
function s2m(kind, p) { if (st.mode === 'single') { const c = C(view()); return c.ok ? c.toShip(s2i(p)) : null; } return st.lay[kind].from(s2S(p)); }
const pxPerM = () => { if (st.mode !== 'single') return st.b.sc; const c = C(view()); return c.ok ? st.v.sc / c.su : 1; };
function paneAt(p) {
  if (st.mode === 'single') { const v = view(); return v ? v.kind : null; }
  const P = s2S(p); let best = null, bd = Infinity;
  for (const k of kindsOn()) { const r = st.lay[k].r, dx = Math.max(r[0] - P[0], 0, P[0] - r[2]), dy = Math.max(r[1] - P[1], 0, P[1] - r[3]), d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = k; } }
  return bd * st.b.sc < 40 ? best : null;
}
// các hình đang hiện trong ô kind (đã có tỷ lệ)
const viewsOf = (kind) => st.model.views.filter((v) => v.kind === kind && (st.mode === 'single' ? v.id === st.cur : C(v).ok));
// điểm (mét) của mọi chi tiết vẽ ở các hình loại kind
function ptsM(kinds, skip) { const out = []; for (const p of st.model.parts) { if (p === skip) continue; const v = viewById(p.view); if (!v || !kinds.includes(v.kind)) continue; const c = C(v); if (!c.ok) continue; for (const q of p.pts) out.push(c.toShip(q)); } return out; }

// ---------- thước CAD: bắt dính ----------
// m: điểm (mét) theo trục của ô; prev: điểm trước (mét) để vẽ thẳng; trả { a, hit: { pt, h, v } }
function snapM(kind, m, prev, shift, skip, tolM) {
  const s = ship(), tol = tolM || 9 / pxPerM(), a = m.slice(), hit = {};
  if (shift && prev) { if (Math.abs(a[0] - prev[0]) > Math.abs(a[1] - prev[1])) { a[1] = prev[1]; hit.v = 'thẳng'; } else { a[0] = prev[0]; hit.h = 'thẳng'; } }
  if (st.snap.pts && !(shift && prev)) { let bd = tol, bp = null; for (const q of ptsM([kind], skip)) { const d = Math.hypot(q[0] - a[0], q[1] - a[1]); if (d < bd) { bd = d; bp = q; } } if (bp) { hit.pt = bp; return { a: bp.slice(), hit }; } }
  // ứng viên theo từng trục: vạch gióng, điểm của các hình khác có chung trục, đường chuẩn
  const [ah, av] = AX[kind], cand = { x: [-s.L / 2, s.L / 2, 0], y: [0, -s.B / 2, s.B / 2], z: [0, s.T, s.D] };
  if (st.snap.guides) {
    for (const g of st.model.guides || []) cand[g.ax].push(g.v);
    const other = { side: [['top', 0, 'x'], ['front', 1, 'z'], ['back', 1, 'z']], top: [['side', 0, 'x'], ['front', 0, 'y'], ['back', 0, 'y']], front: [['side', 1, 'z'], ['top', 1, 'y']], back: [['side', 1, 'z'], ['top', 1, 'y']] }[kind];
    for (const [k, i, ax] of other) for (const q of ptsM([k], skip)) cand[ax].push(q[i]);
  }
  const near = (val, list) => { let b = null, bd = tol; for (const c of list) { const d = Math.abs(c - val); if (d < bd) { bd = d; b = c; } } return b; };
  if (!hit.h) { const n = near(a[0], cand[ah]); if (n !== null) { a[0] = n; hit.h = 'gióng'; } }
  if (!hit.v) { const n = near(a[1], cand[av]); if (n !== null) { a[1] = n; hit.v = 'gióng'; } }
  if (st.snap.grid) { const g = st.grid; if (!hit.h) a[0] = Math.round(a[0] / g) * g; if (!hit.v) a[1] = Math.round(a[1] / g) * g; }
  return { a, hit };
}
// điểm ảnh của hình v tại vị trí chuột, có bắt dính (khi hình có tỷ lệ)
function snapPx(v, p, shift, skip) {
  const c = C(v), kind = v.kind; if (!c.ok) return { q: st.mode === 'single' ? s2i(p) : null };
  const m = s2m(kind, p); if (!m) return { q: s2iV(v, p) };
  const prev = st.draft && st.draft.pts.length ? c.toShip(st.draft.pts[st.draft.pts.length - 1]) : null, r = snapM(kind, m, prev, shift, skip);
  st.snapHit = { kind, a: r.a, hit: r.hit }; return { q: c.toPx(r.a), a: r.a };
}
function typedEnter(shift) {
  const t = st.typed.replace(/,/g, '.'); st.typed = '';
  if (st.tool === 'guide') { const k = (st.hover && st.hover.kind) || 'side', v = parseFloat(t); if (isFinite(v)) { st.model.guides.push({ ax: AX[k][shift ? 1 : 0], v }); changed(); } paint(); return; }
  const d = st.draft; if (!d) return; const v = viewById(d.vid), c = C(v); if (!c.ok) { paint(); return; }
  let a;
  if (t.includes(';')) { const [h, w] = t.split(';').map(parseFloat); if (isFinite(h) && isFinite(w)) a = [h, w]; }
  else { const L = parseFloat(t), prev = d.pts.length ? c.toShip(d.pts[d.pts.length - 1]) : null, m = st.mouse ? s2m(v.kind, st.mouse) : null;
    if (isFinite(L) && prev && m) { let dx = m[0] - prev[0], dy = m[1] - prev[1]; if (shift || (st.snapHit && st.snapHit.hit && (st.snapHit.hit.h === 'thẳng' || st.snapHit.hit.v === 'thẳng'))) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; } const n = Math.hypot(dx, dy); if (n > 1e-9) a = [prev[0] + dx / n * L, prev[1] + dy / n * L]; } }
  if (a) { d.pts.push(c.toPx(a)); }
  paint();
}

// ---------- vẽ ----------
function sizeCv() { const c = $('#sdCv'); const w = c.clientWidth | 0, h = c.clientHeight | 0; if (w && h && (c.width !== w || c.height !== h)) { c.width = w; c.height = h; } }
function fitView() { const v = view(), c = $('#sdCv'); if (!v || !c) return; sizeCv(); const iw = v.iw || 1000, ih = v.ih || 600; st.v.cx = iw / 2; st.v.cy = ih / 2; st.v.sc = Math.min(c.width / iw, c.height / ih) * 0.95 || 1; st.fitted = true; }
const i2s = (q) => { const c = $('#sdCv'); return [c.width / 2 + (q[0] - st.v.cx) * st.v.sc, c.height / 2 + (q[1] - st.v.cy) * st.v.sc]; };
const s2i = (p) => { const c = $('#sdCv'); return [st.v.cx + (p[0] - c.width / 2) / st.v.sc, st.v.cy + (p[1] - c.height / 2) / st.v.sc]; };
function zoomAt(p, f) {
  if (st.mode === 'single') { if (!view()) return; const a = s2i(p); st.v.sc = Math.max(0.01, Math.min(40, st.v.sc * f)); const b = s2i(p); st.v.cx += a[0] - b[0]; st.v.cy += a[1] - b[1]; }
  else { if (!st.b) return; const a = s2S(p); st.b.sc = Math.max(0.5, Math.min(400, st.b.sc * f)); const b = s2S(p); st.b.cx += a[0] - b[0]; st.b.cy += a[1] - b[1]; }
  paint();
}
function line(g, p, q, col, w = 1, dash = []) { g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); g.setLineDash([]); }
// khoảng mét theo hai trục của ô (từ khung ô hoặc toàn màn hình ở chế độ một hình)
function rangeM(kind) {
  if (st.mode === 'single') { const c = $('#sdCv'), A0 = s2m(kind, [0, 0]), B0 = s2m(kind, [c.width, c.height]); return A0 && B0 ? [Math.min(A0[0], B0[0]), Math.min(A0[1], B0[1]), Math.max(A0[0], B0[0]), Math.max(A0[1], B0[1])] : null; }
  const r = st.lay[kind].r, a = st.lay[kind].from([r[0], r[1]]), b = st.lay[kind].from([r[2], r[3]]); return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
}
function paint() {
  const c = $('#sdCv'); if (!c) return; sizeCv(); const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#2a3238'; g.fillRect(0, 0, c.width, c.height);
  if (st.mode === 'single') { paintSingle(g); return; }
  if (st.mode === 'big3d') return;
  st.lay = layout(); if (!st.b) fitBoard();
  for (const k of kindsOn()) paintPane(g, k);
  paintCross(g);
  paintDraft(g);
}
function paintPane(g, kind) {
  const L = st.lay[kind], r = L.r, p0 = S2s([r[0], r[1]]), p1 = S2s([r[2], r[3]]), w = p1[0] - p0[0], h = p1[1] - p0[1];
  g.save(); g.beginPath(); g.rect(p0[0], p0[1], w, h); g.clip();
  g.fillStyle = '#fbfbf8'; g.fillRect(p0[0], p0[1], w, h);
  // ảnh sơ đồ đã có tỷ lệ: biến đổi afin điểm ảnh → màn hình
  for (const v of viewsOf(kind)) { const img = st.img.get(v.id); if (!img) continue; const o = i2sV(v, [0, 0]), ex = i2sV(v, [1, 0]), ey = i2sV(v, [0, 1]); g.save(); g.setTransform(ex[0] - o[0], ex[1] - o[1], ey[0] - o[0], ey[1] - o[1], o[0], o[1]); g.globalAlpha = 0.85; g.imageSmoothingEnabled = true; g.drawImage(img, 0, 0); g.restore(); }
  paintGrid(g, kind);
  if (kind === 'front' || kind === 'back') paintGhost(g, kind);
  paintAuto(g, kind);
  paintParts(g, kind);
  paintFits(g, kind);
  g.restore();
  g.strokeStyle = '#5b6b76'; g.lineWidth = 1; g.strokeRect(p0[0] + 0.5, p0[1] + 0.5, w - 1, h - 1);
  g.font = 'bold 11px Segoe UI'; const t = PANE_NAME[kind], tw = g.measureText(t).width; g.fillStyle = 'rgba(14,22,28,.85)'; g.fillRect(p0[0] + 1, p0[1] + 1, tw + 10, 17); g.fillStyle = '#E6EDF2'; g.fillText(t, p0[0] + 6, p0[1] + 13);
  const dir = PANE_DIR[kind]; g.font = 'bold 10px Segoe UI'; g.fillStyle = 'rgba(30,60,90,.6)';
  if (dir[0]) g.fillText(dir[0], p0[0] + 5, p1[1] - 6); if (dir[1]) g.fillText(dir[1], p1[0] - 5 - g.measureText(dir[1]).width, p1[1] - 6);
  if (dir[2]) g.fillText(dir[2], (p0[0] + p1[0]) / 2 - g.measureText(dir[2]).width / 2, p0[1] + 30); if (dir[3]) g.fillText(dir[3], (p0[0] + p1[0]) / 2 - g.measureText(dir[3]).width / 2, p1[1] - 6);
}
// lưới mét, thước hai cạnh, đường chuẩn (đáy ky, đường nước, đường tâm, mũi / lái), vạch gióng
function paintGrid(g, kind) {
  const R = rangeM(kind); if (!R) return; const s = ship(), ppm = pxPerM(); let step = st.grid; while (step * ppm < 7) step *= step === 0.25 ? 2 : step < 1 ? 2 : step === 1 ? 2 : 2.5;
  const major = step >= 5 ? step * 2 : step >= 1 ? 5 : 1, [ah, av] = AX[kind];
  const P = (h, v) => m2s(kind, [h, v]);
  g.font = '10px Segoe UI';
  for (let h = Math.ceil(R[0] / step) * step; h <= R[2]; h += step) { const mj = Math.abs(h / major - Math.round(h / major)) < 1e-6; line(g, P(h, R[1]), P(h, R[3]), mj ? 'rgba(0,0,0,.17)' : 'rgba(0,0,0,.06)'); }
  for (let v = Math.ceil(R[1] / step) * step; v <= R[3]; v += step) { const mj = Math.abs(v / major - Math.round(v / major)) < 1e-6; line(g, P(R[0], v), P(R[2], v), mj ? 'rgba(0,0,0,.17)' : 'rgba(0,0,0,.06)'); }
  // thước: số mét ở cạnh trên (trục ngang) và cạnh trái (trục đứng)
  const top = Math.min(P(R[0], R[1])[1], P(R[0], R[3])[1]), left = Math.min(P(R[0], R[1])[0], P(R[2], R[1])[0]);
  g.fillStyle = 'rgba(40,52,60,.75)';
  for (let h = Math.ceil(R[0] / major) * major; h <= R[2]; h += major) { const q = P(h, 0); g.fillText(fmt(h, major < 1 ? 1 : 0), q[0] + 2, top + 28); }
  for (let v = Math.ceil(R[1] / major) * major; v <= R[3]; v += major) { const q = P(0, v); g.fillText(fmt(v, major < 1 ? 1 : 0), left + 3, q[1] - 2); }
  const blue = 'rgba(0,140,255,.8)';
  if (kind === 'top') { line(g, P(R[0], 0), P(R[2], 0), blue, 1, [8, 5]); }
  else { line(g, P(R[0], 0), P(R[2], 0), blue, 1.2, [8, 5]); line(g, P(R[0], s.T), P(R[2], s.T), 'rgba(0,150,200,.75)', 1, [3, 4]); if (kind !== 'side') line(g, P(0, R[1]), P(0, R[3]), blue, 1, [8, 5]); }
  if (ah === 'x') for (const x of [-s.L / 2, s.L / 2]) line(g, P(x, R[1]), P(x, R[3]), 'rgba(170,0,255,.35)', 1, [2, 4]);
  for (const q of st.model.guides || []) { if (q.ax === ah) line(g, P(q.v, R[1]), P(q.v, R[3]), '#E040FB', 1.2, [6, 3]); else if (q.ax === av) line(g, P(R[0], q.v), P(R[2], q.v), '#E040FB', 1.2, [6, 3]); }
}
// nét đã làm mượt (cong / bo góc) theo mét của hình; null nếu hình chưa có tỷ lệ
function shapedM(p, v) { const c = C(v); if (!c.ok) return null; const r = resolve(p.type); return partShape(p.pts.map((q) => c.toShip(q)), p, v.kind, r.node ? r.node.role : ''); }
function outlineS(p, v) { if ((p.curve || p.fillet > 0) && p.kind !== 'point') { const m = shapedM(p, v); if (m) return m.map((a) => m2s(v.kind, a)); } return p.pts.map((q) => i2sV(v, q)); }
function paintParts(g, kind) {
  const linked = new Set(st.sel && st.geom && st.geom.links && st.geom.links[st.sel] ? st.geom.links[st.sel] : []);
  for (const v of viewsOf(kind)) for (const p of st.model.parts) {
    if (p.view !== v.id || !p.pts.length) continue; const col = colOf(p), sel = p.id === st.sel, lk = !sel && linked.has(p.id), V = p.pts.map((q) => i2sV(v, q));
    if (p.kind === 'point') { g.fillStyle = col; g.strokeStyle = sel ? '#00E5FF' : '#0b1116'; g.lineWidth = sel ? 3 : 1.5; g.beginPath(); g.arc(V[0][0], V[0][1], sel ? 7 : 5.5, 0, 7); g.fill(); g.stroke(); continue; }
    const P = outlineS(p, v), smooth = P !== V && P.length !== V.length;
    g.beginPath(); P.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); if (p.kind !== 'line') { g.closePath(); g.fillStyle = col + (sel ? '44' : lk ? '38' : '26'); g.fill(); }
    g.strokeStyle = sel || lk ? '#00E5FF' : col; g.lineWidth = sel ? 2.5 : lk ? 2 : 1.8; g.setLineDash(lk ? [7, 4] : resolve(p.type).leaf ? [] : [6, 4]); g.stroke(); g.setLineDash([]);
    if (sel && smooth) { g.beginPath(); V.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); if (p.kind !== 'line') g.closePath(); g.strokeStyle = 'rgba(0,229,255,.35)'; g.lineWidth = 1; g.setLineDash([3, 3]); g.stroke(); g.setLineDash([]); }
    if (sel) { const sh = new Set(p.sharp || []); V.forEach((q, k) => { const on = st.h3sel && st.h3sel.pid === p.id && st.h3sel.k === k, r = on ? 5.5 : 4; const soft = (p.curve || p.fillet > 0) && !sh.has(k); g.fillStyle = on ? '#FFFFFF' : soft ? '#00E5FF' : '#FFD54F'; if (soft) { g.beginPath(); g.arc(q[0], q[1], r, 0, 7); g.fill(); g.strokeStyle = '#0b1116'; g.lineWidth = 1; g.stroke(); } else { g.fillRect(q[0] - r, q[1] - r, 2 * r, 2 * r); g.strokeStyle = '#0b1116'; g.lineWidth = 1; g.strokeRect(q[0] - r, q[1] - r, 2 * r, 2 * r); } }); }
  }
}
// các khối của nhóm đang chọn
const selIds = () => (st.sel && st.geom && st.geom.links && st.geom.links[st.sel]) || (st.sel ? [st.sel] : []);
// hình chiếu tự sinh trong ô kind: nhìn từ mũi / lái (fb), mặt boong (top), hình mạn (side)
function autosIn(kind) { const A0 = (st.geom && st.geom.auto) || []; return A0.filter((a) => (a.view === 'fb' && ((kind === 'front' && a.need.front) || (kind === 'back' && a.need.back))) || a.view === kind); }
const autoSel = (a) => !!st.sel && (a.gid === st.sel || a.ids.includes(st.sel));
function paintAuto(g, kind) {
  if (st.mode !== 'board') return;
  for (const a of autosIn(kind)) {
    const P = a.poly.map((q) => m2s(kind, q)), sel = autoSel(a), col = CAT[a.type[0]] || '#81C784';
    g.beginPath(); P.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fillStyle = col + (sel ? '30' : '14'); g.fill();
    g.strokeStyle = sel ? '#00E5FF' : col; g.globalAlpha = sel ? 1 : 0.75; g.lineWidth = sel ? 1.8 : 1.3; g.setLineDash([5, 4]); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    if (sel) { for (const q of P) { g.strokeStyle = '#00E5FF'; g.lineWidth = 1.5; g.strokeRect(q[0] - 4, q[1] - 4, 8, 8); } let x0 = Infinity, y0 = Infinity; for (const q of P) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); } g.font = '10px Segoe UI'; g.fillStyle = 'rgba(0,120,150,.9)'; g.fillText('tự sinh — kéo điểm để sửa', x0, y0 - 4); }
  }
}
// bóng mờ cả tàu nhìn từ mũi / lái: các khoảng bề rộng theo từng lớp chiều cao (tính một lần cho mỗi lần dựng)
function ghostRows(geom) {
  if (geom._ghost) return geom._ghost; let z0 = Infinity, z1 = -Infinity;
  for (const it of geom.items) for (let i = 2; i < it.pos.length; i += 3) { z0 = Math.min(z0, it.pos[i]); z1 = Math.max(z1, it.pos[i]); }
  if (!(z1 > z0)) return (geom._ghost = { rows: [] });
  const dz = Math.max(0.05, (z1 - z0) / 260), n = Math.ceil((z1 - z0) / dz) + 1, rows = Array.from({ length: n }, () => []);
  for (const it of geom.items) { const p = it.pos, I = it.idx; for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3, Y = [p[a + 1], p[b + 1], p[c + 1]], Z = [p[a + 2], p[b + 2], p[c + 2]], lo = Math.min(Z[0], Z[1], Z[2]), hi = Math.max(Z[0], Z[1], Z[2]);
    for (let r = Math.max(0, Math.floor((lo - z0) / dz)); r < n && z0 + (r + 0.5) * dz <= hi; r++) { const zc = z0 + (r + 0.5) * dz; if (zc < lo) continue; let ya = Infinity, yb = -Infinity; for (let k = 0; k < 3; k++) { const za = Z[k], zb = Z[(k + 1) % 3]; if ((za - zc) * (zb - zc) <= 0 && za !== zb) { const y = Y[k] + (Y[(k + 1) % 3] - Y[k]) * (zc - za) / (zb - za); ya = Math.min(ya, y); yb = Math.max(yb, y); } } if (ya <= yb) rows[r].push([ya, yb]); }
  } }
  const mg = (iv) => { iv.sort((x, y) => x[0] - y[0]); const o = []; for (const q of iv) { const l = o[o.length - 1]; if (l && q[0] <= l[1] + 0.03) l[1] = Math.max(l[1], q[1]); else o.push(q.slice()); } return o; };
  return (geom._ghost = { z0, dz, rows: rows.map(mg) });
}
function paintGhost(g, kind) {
  if (st.mode !== 'board' || !st.geom) return; const G = ghostRows(st.geom); g.fillStyle = 'rgba(55,75,95,.13)';
  G.rows.forEach((iv, r) => { const za = G.z0 + r * G.dz, zb = za + G.dz; for (const [ya, yb] of iv) { const A = m2s(kind, [ya, za]), B = m2s(kind, [yb, zb]); g.fillRect(Math.min(A[0], B[0]), Math.min(A[1], B[1]), Math.abs(B[0] - A[0]) + 0.6, Math.abs(B[1] - A[1]) + 0.6); } });
}
// chi tiết thư viện: khung bao chiếu lên từng ô
function fitRect(kind, bb) { const [x0, y0, z0, x1, y1, z1] = bb, a = kind === 'side' ? [[x0, z0], [x1, z1]] : kind === 'top' ? [[x0, y0], [x1, y1]] : [[y0, z0], [y1, z1]]; const A = m2s(kind, a[0]), B = m2s(kind, a[1]); return [Math.min(A[0], B[0]), Math.min(A[1], B[1]), Math.abs(B[0] - A[0]), Math.abs(B[1] - A[1])]; }
function paintFits(g, kind) {
  if (st.mode !== 'board' || !st.geom || !st.geom.fitBB) return; g.font = '10px Segoe UI';
  for (const f of st.model.fits || []) { const bb = st.geom.fitBB[f.id]; if (!bb || !isFinite(bb[0])) continue; const [x, y, w, h] = fitRect(kind, bb), sel = f.id === st.sel; g.fillStyle = sel ? 'rgba(0,229,255,.18)' : 'rgba(96,125,139,.12)'; g.fillRect(x, y, w, h); g.strokeStyle = sel ? '#00E5FF' : '#607D8B'; g.lineWidth = sel ? 2 : 1; g.setLineDash(sel ? [] : [3, 2]); g.strokeRect(x, y, w, h); g.setLineDash([]); if (sel) { g.fillStyle = '#006978'; g.fillText((FIT_KINDS[f.kind] || {}).name || '', x, y - 3); } }
}
// vạch gióng theo chuột qua các ô, và khoảng của chi tiết đang chọn chiếu sang các ô khác
function paintCross(g) {
  const proj = (kind, ax, val, col, dash) => { const L = st.lay[kind]; if (!L) return; const [ah, av] = AX[kind], R = rangeM(kind); g.save(); const r = L.r, p0 = S2s([r[0], r[1]]), p1 = S2s([r[2], r[3]]); g.beginPath(); g.rect(p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1]); g.clip(); if (ax === ah) line(g, m2s(kind, [val, R[1]]), m2s(kind, [val, R[3]]), col, 1, dash); else if (ax === av) line(g, m2s(kind, [R[0], val]), m2s(kind, [R[2], val]), col, 1, dash); g.restore(); };
  const sp = st.model.parts.find((q) => q.id === st.sel), sv = sp && viewById(sp.view);
  if (sp && sv && C(sv).ok && sp.pts.length) {
    const c = C(sv), pts = sp.pts.map((q) => c.toShip(q)), [ah, av] = AX[sv.kind]; let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity; for (const q of pts) { a0 = Math.min(a0, q[0]); a1 = Math.max(a1, q[0]); b0 = Math.min(b0, q[1]); b1 = Math.max(b1, q[1]); }
    for (const k of kindsOn()) { if (k === sv.kind) continue; for (const v of [a0, a1]) proj(k, ah, v, 'rgba(255,145,0,.8)', [4, 3]); for (const v of [b0, b1]) proj(k, av, v, 'rgba(255,145,0,.8)', [4, 3]); }
  }
  const hv = st.hover; if (!hv) return; const [ah, av] = AX[hv.kind];
  for (const k of kindsOn()) { proj(k, ah, hv.a[0], 'rgba(0,150,255,.6)', [5, 4]); proj(k, av, hv.a[1], 'rgba(0,150,255,.6)', [5, 4]); }
}
function paintDraft(g) {
  const m = st.mouse;
  const d = st.draft; if (d && d.pts.length) { const v = viewById(d.vid); g.strokeStyle = '#00E5FF'; g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath(); d.pts.map((q) => i2sV(v, q)).forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); const e = st.snapHit && st.snapHit.kind === v.kind ? m2s(v.kind, st.snapHit.a) : m; if (e) g.lineTo(e[0], e[1]); g.stroke(); g.setLineDash([]); for (const q of d.pts.map((z) => i2sV(v, z))) { g.fillStyle = '#00E5FF'; g.fillRect(q[0] - 3, q[1] - 3, 6, 6); } }
  const sh = st.snapHit; if (m && sh && /poly|line|point|guide|edit/.test(st.tool)) { const q = m2s(sh.kind, sh.a); g.strokeStyle = sh.hit.pt ? '#FF1744' : sh.hit.h || sh.hit.v ? '#E040FB' : '#00B8D4'; g.lineWidth = 1.5; if (sh.hit.pt) g.strokeRect(q[0] - 6, q[1] - 6, 12, 12); else { g.beginPath(); g.moveTo(q[0] - 7, q[1]); g.lineTo(q[0] + 7, q[1]); g.moveTo(q[0], q[1] - 7); g.lineTo(q[0], q[1] + 7); g.stroke(); } }
  if (st.drag && st.drag.box) { const a = st.drag.box, b = m || a; g.strokeStyle = '#00E5FF'; g.setLineDash([6, 4]); g.lineWidth = 1.5; g.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); g.setLineDash([]); }
  // độ dài đoạn đang vẽ + ô số đang gõ
  if (m && (st.typed || (d && d.pts.length))) {
    let t = ''; if (d && d.pts.length && st.snapHit) { const v = viewById(d.vid), c = C(v); if (c.ok) { const a = c.toShip(d.pts[d.pts.length - 1]), b = st.snapHit.a, L = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; t = fmt(L, 2) + ' m · ' + fmt(ang, 0) + '°'; } }
    if (st.typed) t = (st.typed.includes(';') ? 'Tọa độ: ' : 'Dài: ') + st.typed + ' ↵';
    if (t) { g.font = 'bold 12px Segoe UI'; const tw = g.measureText(t).width; g.fillStyle = 'rgba(14,22,28,.9)'; g.fillRect(m[0] + 14, m[1] + 10, tw + 10, 18); g.fillStyle = st.typed ? '#FFD54F' : '#E6EDF2'; g.fillText(t, m[0] + 19, m[1] + 23); }
  }
}
function paintSingle(g) {
  const c = $('#sdCv'), v = view(); if (!v) return; const s = st.v.sc, cal = C(v), img = st.img.get(v.id);
  g.save(); g.setTransform(s, 0, 0, s, c.width / 2 - st.v.cx * s, c.height / 2 - st.v.cy * s);
  if (img) { g.imageSmoothingEnabled = s < 1.5; g.drawImage(img, 0, 0); } else { g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, v.iw || 1000, v.ih || 600); }
  g.restore();
  if (cal.ok) paintGrid(g, v.kind);
  paintParts(g, v.kind);
  g.font = 'bold 12px Segoe UI';
  (v.dims || []).forEach((q, i) => { const a = i2s(q.a), b = i2s(q.b), bad = cal.ok && cal.res[i] !== undefined && Math.abs(cal.res[i]) > 3; g.strokeStyle = bad ? '#FF5252' : '#FF9100'; g.lineWidth = 2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); for (const e of [a, b]) { g.beginPath(); g.arc(e[0], e[1], 3.5, 0, 7); g.fillStyle = g.strokeStyle; g.fill(); } const t = (i + 1) + ': ' + (q.m ? fmt(q.m, 2) + ' m' : '? m'), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], tw = g.measureText(t).width; g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(m[0] - tw / 2 - 3, m[1] - 18, tw + 6, 15); g.fillStyle = bad ? '#D50000' : '#E65100'; g.fillText(t, m[0] - tw / 2, m[1] - 6); });
  for (const [k, q] of Object.entries(v.refs || {})) { if (!q) continue; const p = i2s(q); g.strokeStyle = '#D500F9'; g.lineWidth = 2; g.beginPath(); g.moveTo(p[0] - 10, p[1]); g.lineTo(p[0] + 10, p[1]); g.moveTo(p[0], p[1] - 10); g.lineTo(p[0], p[1] + 10); g.stroke(); const t = REF_NAMES[k], tw = g.measureText(t).width; g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(p[0] + 6, p[1] + 4, tw + 6, 15); g.fillStyle = '#AA00FF'; g.fillText(t, p[0] + 9, p[1] + 16); }
  const m = st.mouse;
  if (st.chain && m) { const a = i2s(st.chain[st.chain.length - 1]); g.strokeStyle = '#FF9100'; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(m[0], m[1]); g.stroke(); g.setLineDash([]); const L = measure(cal, st.chain[st.chain.length - 1], s2i(m)); if (L) { g.fillStyle = '#FF9100'; g.fillText(fmt(L, 2) + ' m', m[0] + 10, m[1] - 8); } }
  paintDraft(g);
}

// ---------- chuột ----------
const near = (a, b, r = 9) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= r;
function hitPart(kind, p) {
  const ps = []; for (const v of viewsOf(kind)) for (const o of st.model.parts) if (o.view === v.id && o.pts.length) ps.push([o, v]);
  for (let i = ps.length - 1; i >= 0; i--) { const [o, v] = ps[i], P = outlineS(o, v); if (o.kind === 'point') { if (near(P[0], p, 10)) return o; continue; } for (let k = 0; k + 1 < P.length + (o.kind === 'line' ? 0 : 1); k++) { const a = P[k], b = P[(k + 1) % P.length], dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); if (Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1]) < 7) return o; } }
  // bên trong đa giác: chọn chi tiết nhỏ nhất chứa điểm
  let best = null, ba = Infinity; for (const [o, v] of ps) { if (o.kind !== 'poly' || o.pts.length < 3) continue; const P = outlineS(o, v); let ins = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins; } if (ins) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const z of P) { x0 = Math.min(x0, z[0]); y0 = Math.min(y0, z[1]); x1 = Math.max(x1, z[0]); y1 = Math.max(y1, z[1]); } const ar = (x1 - x0) * (y1 - y0); if (ar < ba) { ba = ar; best = o; } } }
  return best;
}
const inScr = (P, p) => { let ins = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins; } return ins; };
function hitFit(kind, p) { if (st.mode !== 'board' || !st.geom || !st.geom.fitBB) return null; let best = null, ba = Infinity; for (const f of st.model.fits || []) { const bb = st.geom.fitBB[f.id]; if (!bb || !isFinite(bb[0])) continue; const [x, y, w, h] = fitRect(kind, bb), m = 4; if (p[0] >= x - m && p[0] <= x + w + m && p[1] >= y - m && p[1] <= y + h + m && w * h < ba) { ba = w * h; best = f; } } return best; }
function hitAuto(kind, p) { if (st.mode !== 'board') return null; let best = null, ba = Infinity; for (const a of autosIn(kind)) { const P = a.poly.map((q) => m2s(kind, q)); if (!inScr(P, p)) continue; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of P) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); } const ar = (x1 - x0) * (y1 - y0); if (ar < ba) { ba = ar; best = a; } } return best; }
function autoVertexAt(kind, p) { if (st.mode !== 'board') return null; for (const a of autosIn(kind)) { if (!autoSel(a)) continue; const k = a.poly.findIndex((q) => near(m2s(kind, q), p)); if (k >= 0) return { a, k }; } return null; }
// biến hình tự sinh thành nét thật ở hình loại vk (gắn với khối qua `grp`)
function autoToPart(a, vk) {
  const v = targetView(vk), c = C(v);
  const p = { id: uid('p'), view: v.id, type: a.type.slice(), pts: a.poly.map((q) => c.toPx(q)), kind: 'poly', note: '', num: {}, grp: a.gid };
  st.model.parts.push(p); if (st.model.template) delete st.model.template; return p;
}
function newPart(kind, v, pts) {
  const p = { id: uid('p'), view: v.id, type: kind === 'point' && st.lastPoint ? st.lastPoint.slice() : [], pts, kind, note: '', num: {} };
  st.model.parts.push(p); st.sel = p.id; if (st.model.template) delete st.model.template; drawSel(); changed();
  const s1 = $('#sdSel select'); if (s1 && !p.type.length) s1.focus();
}
function finishDraft() { const d = st.draft; st.draft = null; st.typed = ''; if (!d) return; const v = viewById(d.vid); if (st.tool === 'poly' && d.pts.length >= 3) newPart('poly', v, d.pts); else if (st.tool === 'line' && d.pts.length >= 2) newPart('line', v, d.pts); paint(); }
// hình có ảnh nằm dưới chuột (cho đũa thần / dò trong khung)
function imgViewAt(kind, p) { const vs = viewsOf(kind).filter((v) => st.img.has(v.id)).sort((a, b) => (b.id === st.active[kind]) - (a.id === st.active[kind])); for (const v of vs) { const q = s2iV(v, p); if (q[0] >= 0 && q[1] >= 0 && q[0] < st.img.get(v.id).width && q[1] < st.img.get(v.id).height) return [v, q]; } return [null, null]; }
function down(e, p) {
  const c = $('#sdCv'); c.setPointerCapture(e.pointerId); const kind = paneAt(p);
  if (e.button === 1 || st.tool === 'pan') { st.drag = { pan: p }; return; }
  if (e.button !== 0) return;
  const t = st.tool;
  if (st.mode === 'single') {
    const v = view(); if (!v) return; const q = s2i(p);
    if (t.startsWith('ref:')) { v.refs = v.refs || {}; v.refs[t.slice(4)] = q; const nx = REFS[v.kind].find((k) => !v.refs[k]); if (nx) setTool('ref:' + nx); else { setTool('edit'); $('#sdHint').textContent = 'Đã đặt đủ mốc. Đo thêm kích thước nếu ảnh bị co méo, rồi bấm «Về bàn vẽ 3 hình chiếu».'; } changed(); drawViews(); return; }
    if (t === 'dim') { if (!st.chain) st.chain = [q]; else { const a = st.chain[st.chain.length - 1], L = measure(C(v), a, q); v.dims = v.dims || []; v.dims.push({ a, b: q, m: L ? Math.round(L * 100) / 100 : 0 }); st.chain.push(q); changed(); const ins = $$('#sdRefs input[data-dim]'); if (ins.length && !L) ins[ins.length - 1].focus(); } paint(); return; }
  }
  if (!kind) { if (t === 'edit') st.drag = { pan: p, clear: true }; return; }
  if (t === 'guide') { const m = s2m(kind, p); if (!m) return; const r = snapM(kind, m, null, false); st.model.guides.push({ ax: AX[kind][e.shiftKey ? 1 : 0], v: Math.round(r.a[e.shiftKey ? 1 : 0] * 1000) / 1000 }); changed(); return; }
  if (t === 'poly' || t === 'line') {
    if (!st.draft) st.draft = { vid: (st.mode === 'single' ? view() : targetView(kind)).id, pts: [] };
    const v = viewById(st.draft.vid);
    if (t === 'poly' && st.draft.pts.length >= 3 && near(i2sV(v, st.draft.pts[0]), p, 10)) { finishDraft(); return; }
    const r = snapPx(v, p, e.shiftKey); if (r.q) st.draft.pts.push(r.q); st.typed = ''; paint(); return;
  }
  if (t === 'point') { const v = st.mode === 'single' ? view() : targetView(kind), r = snapPx(v, p, false); if (r.q) newPart('point', v, [r.q]); return; }
  if (t === 'wand') {
    const [v, q] = st.mode === 'single' ? [view(), s2i(p)] : imgViewAt(kind, p); const d = v && imgData(v);
    if (!d) { $('#sdHint').textContent = 'Đũa thần cần ảnh sơ đồ (đã đặt mốc) ở chỗ bấm — vẽ trên lưới thì chấm tay.'; return; }
    const base = e.shiftKey ? st.model.parts.find((o) => o.id === st.sel && o.view === v.id && o.kind === 'poly') : null;
    const r = traceWand(d.data, d.width, d.height, Math.round(q[0]), Math.round(q[1]), { tol: st.tol, skipColor: st.skip !== false, base: base ? base.pts : null });
    if (r.leak) $('#sdHint').textContent = 'Vùng này hở ra ngoài (viền chưa kín) — dùng «Dò trong khung» hoặc chấm tay.';
    else if (r.pts.length >= 3) { if (base && !r.separate) { base.pts = r.pts; changed(); } else { newPart('poly', v, r.pts); if (base) { const np = st.model.parts[st.model.parts.length - 1]; np.type = base.type.slice(); drawSel(); changed(); $('#sdHint').textContent = 'Vùng này không liền với chi tiết đang chọn — app thêm một chi tiết cùng loại.'; } } }
    else $('#sdHint').textContent = 'Không lấy được vùng — thử tăng độ nhạy hoặc bấm vào giữa vùng.';
    return;
  }
  if (t === 'box') { st.drag = { box: p, kind }; return; }
  if (t === 'edit') {
    const sp = st.model.parts.find((o) => o.id === st.sel), sv = sp && viewById(sp.view);
    if (sp && sv && (st.mode === 'single' ? sv.id === st.cur : sv.kind === kind)) { const k = sp.pts.findIndex((z) => near(i2sV(sv, z), p)); if (k >= 0) { st.h3sel = { pid: sp.id, k }; drawSel(); paint(); st.drag = { vtx: sp, v: sv, k }; return; } }
    // điểm của hình tự sinh (khối đang chọn): kéo là thành nét thật
    const av = autoVertexAt(kind, p); if (av) { const np = autoToPart(av.a, av.a.view === 'fb' ? kind : av.a.view), nv = viewById(np.view); st.sel = np.id; st.h3sel = { pid: np.id, k: av.k }; drawSel(); drawParts(); st.drag = { vtx: np, v: nv, k: av.k }; return; }
    const fh = hitFit(kind, p); if (fh) { st.sel = fh.id; st.h3sel = null; drawSel(); drawParts(); paint(); st.drag = { fit: fh, kind, last: s2m(kind, p), moved: false }; return; }
    const h = hitPart(kind, p); if (h) { if (h.id !== st.sel) st.h3sel = null; st.sel = h.id; drawSel(); drawParts(); paint(); st.drag = { move: h, v: viewById(h.view), last: p, moved: false }; return; }
    const ah = hitAuto(kind, p); if (ah) { st.sel = ah.gid; st.h3sel = null; drawSel(); drawParts(); paint(); st.drag = { pan: p }; return; }
    st.drag = { pan: p, clear: true };
  }
}
function move(e, p) {
  st.mouse = p; const kind = paneAt(p), d = st.drag;
  st.snapHit = null;
  if (kind) {
    const m = s2m(kind, p);
    if (m) {
      const drawTool = /poly|line|point|guide/.test(st.tool) || (d && d.vtx);
      let a = m;
      if (drawTool) { const v = d && d.vtx ? d.v : st.draft ? viewById(st.draft.vid) : null; if (v && C(v).ok) { const r = snapPx(v, p, e.shiftKey, d && d.vtx ? d.vtx : null); a = r.a || m; } else { const r = snapM(kind, m, null, e.shiftKey); st.snapHit = { kind, a: r.a, hit: r.hit }; a = r.a; } }
      st.hover = { kind, a };
      const s = ship(), lab = AX[kind], extra = kind === 'side' || kind === 'top' ? ` (cách lái ${fmt(a[0] + s.L / 2, 2)} m)` : '';
      $('#sdPos').textContent = (st.mode === 'board' ? { side: 'Hình mạn', top: 'Mặt boong', front: 'Nhìn từ mũi', back: 'Nhìn từ lái' }[kind] + ' · ' : '') + `${lab[0]} = ${fmt(a[0], 2)} m${extra} · ${lab[1]} = ${fmt(a[1], 2)} m` + (lab[1] === 'z' ? ' từ đáy ky' : lab[1] === 'y' ? ' (mạn phải +)' : '');
    } else st.hover = null;
  } else st.hover = null;
  if (d && d.pan) { if (st.mode === 'single') { st.v.cx -= (p[0] - d.pan[0]) / st.v.sc; st.v.cy -= (p[1] - d.pan[1]) / st.v.sc; } else { st.b.cx -= (p[0] - d.pan[0]) / st.b.sc; st.b.cy -= (p[1] - d.pan[1]) / st.b.sc; } d.pan = p; d.clear = false; paint(); return; }
  if (d && d.vtx) { const r = snapPx(d.v, p, e.shiftKey, d.vtx); if (r.q) d.vtx.pts[d.k] = r.q; paint(); return; }
  if (d && d.fit) { const m = s2m(d.kind, p); if (!m) return; let dh = m[0] - d.last[0], dv = m[1] - d.last[1]; if (!d.moved && Math.hypot(dh, dv) * pxPerM() < 4) return; d.moved = true; const gs = st.snap.grid ? st.grid / 2 : 0.01; dh = Math.round(dh / gs) * gs; dv = Math.round(dv / gs) * gs; if (!dh && !dv) return; const f = d.fit; if (d.kind === 'side') { f.x = r2(f.x + dh); f.z = r2(f.z + dv); } else if (d.kind === 'top') { f.x = r2(f.x + dh); f.y = r2(f.y + dv); } else { f.y = r2(f.y + dh); f.z = r2(f.z + dv); } d.last = [d.last[0] + dh, d.last[1] + dv]; st.edited = true; if (!st.tq) st.tq = setTimeout(() => { st.tq = null; liveRebuild(); }, 70); return; }
  if (d && d.move) { const a = s2iV(d.v, d.last), b = s2iV(d.v, p), dx = b[0] - a[0], dy = b[1] - a[1]; if (!d.moved && Math.hypot(p[0] - d.last[0], p[1] - d.last[1]) < 4) return; d.moved = true; d.move.pts = d.move.pts.map(([x, y]) => [x + dx, y + dy]); d.last = p; paint(); return; }
  paint();
}
function up(e, p) {
  const d = st.drag; st.drag = null; if (!d) return;
  if (d.box) { const [v] = st.mode === 'single' ? [view()] : imgViewAt(d.kind, d.box), img = v && imgData(v); if (!img) { $('#sdHint').textContent = 'Dò trong khung cần ảnh sơ đồ (đã đặt mốc).'; paint(); return; } const a = s2iV(v, d.box), b = s2iV(v, p); const r = traceBox(img.data, img.width, img.height, [a[0], a[1], b[0], b[1]]); if (r.pts.length >= 3) newPart('poly', v, r.pts); else { $('#sdHint').textContent = 'Không thấy nét vẽ nào đủ lớn trong khung.'; paint(); } return; }
  if (d.vtx || (d.move && d.moved)) changed(false);
  if (d.fit && d.moved) { clearTimeout(st.tq); st.tq = null; changed(false); drawSel(); }
  if (d.pan && d.clear && st.sel) { st.sel = null; drawSel(); drawParts(); paint(); }
}
function dbl(p) {
  if (st.tool === 'poly' || st.tool === 'line') { if (st.draft && st.draft.pts.length) st.draft.pts.pop(); finishDraft(); return; }
  if (st.tool === 'edit') { const sp = st.model.parts.find((o) => o.id === st.sel), sv = sp && viewById(sp.view); if (!sp || sp.kind === 'point') return; const P = sp.pts.map((q) => i2sV(sv, q)); let bk = -1, bd = 10; for (let k = 0; k + 1 < P.length + (sp.kind === 'line' ? 0 : 1); k++) { const a = P[k], b = P[(k + 1) % P.length], dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))), dd = Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1]); if (dd < bd) { bd = dd; bk = k; } } if (bk >= 0) { sp.pts.splice(bk + 1, 0, s2iV(sv, p)); changed(false); } }
}
function ctx(p) {
  if (st.draft) { st.draft.pts.pop(); if (!st.draft.pts.length) st.draft = null; paint(); return; }
  if (st.chain) { st.chain = null; paint(); return; }
  const kind = paneAt(p);
  if (st.tool === 'guide' && kind) { const m = s2m(kind, p), tol = 8 / pxPerM(), [ah, av] = AX[kind]; const i = (st.model.guides || []).findIndex((g) => (g.ax === ah && Math.abs(g.v - m[0]) < tol) || (g.ax === av && Math.abs(g.v - m[1]) < tol)); if (i >= 0) { st.model.guides.splice(i, 1); changed(); } return; }
  const sp = st.model.parts.find((o) => o.id === st.sel), sv = sp && viewById(sp.view); if (!sp) return; const k = sp.pts.findIndex((z) => near(i2sV(sv, z), p)); if (k >= 0 && sp.pts.length > (sp.kind === 'line' ? 2 : 3)) { sp.pts.splice(k, 1); changed(false); }
}

// ---------- xem 3D: xoay tự do hoặc xem thẳng (trên / mạn / mũi); 3D lớn thì sửa được ----------
// tọa độ tàu (x mũi, y mạn phải, z từ đáy ky) ↔ cảnh three (X = y, Y = z − T, Z = −x)
const toW = (x, y, z) => new THREE.Vector3(y, z - ship().T, -x);
const fromW = (v) => [-v.z, v.x, v.y + ship().T];
function drawBar3() { const el = $('#sd3dBar'); if (el) el.innerHTML = [['orbit', 'Xoay'], ['top', 'Trên'], ['side', 'Mạn'], ['front', 'Mũi']].map(([k, n]) => `<button data-c="${k}" class="${st.cam3 === k ? 'on' : ''}" style="padding:2px 8px">${n}</button>`).join(''); }
function initPreview() {
  const c = $('#sd3d'); if (!c) return; let r; try { r = new THREE.WebGLRenderer({ canvas: c, antialias: true }); } catch (e) { $('#sd3dInfo').textContent = 'Máy không mở thêm được khung 3D.'; return; }
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b1116); scene.environment = skyEnv(THREE, r); scene.environmentIntensity = 0.45;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 0.75)); const sun = new THREE.DirectionalLight(0xffffff, 1.9); sun.position.set(-60, 90, 40); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; scene.add(sun); scene.add(sun.target);
  const water = new THREE.Mesh(new THREE.CircleGeometry(400, 48), new THREE.MeshBasicMaterial({ color: 0x1d4a63, transparent: true, opacity: 0.55, depthWrite: false })); water.rotation.x = -Math.PI / 2; scene.add(water);
  const shw = new THREE.Mesh(new THREE.CircleGeometry(400, 48), new THREE.ShadowMaterial({ opacity: 0.28 })); shw.rotation.x = -Math.PI / 2; shw.position.y = 0.01; shw.receiveShadow = true; scene.add(shw);
  st.p3 = { r, scene, water, shw, sun, cam: new THREE.PerspectiveCamera(32, 1, 0.5, 6000), ocam: new THREE.OrthographicCamera(-1, 1, 1, -1, -5000, 5000), yaw: -2.25, pitch: 0.32, dist: 1, oz: 1, ox: 0, oy: 0, grp: null, hl: null, hd: null, L: 60, ray: new THREE.Raycaster() };
  c.onpointerdown = (e) => down3(e); c.onpointermove = (e) => move3(e); c.onpointerup = (e) => up3(e); c.ondblclick = (e) => dbl3(e);
  c.onwheel = (e) => { e.preventDefault(); if (!st.p3) return; const f = e.deltaY > 0 ? 1.12 : 0.89; if (st.cam3 === 'orbit') st.p3.dist = Math.max(0.08, Math.min(3, st.p3.dist * f)); else st.p3.oz = Math.max(0.3, Math.min(60, st.p3.oz / f)); render3d(); };
  rebuild3d();
}
function rebuild3d() {
  if (!st) return; const s = ship(); let geom;
  try { geom = buildModel(st.model, s); } catch (e) { $('#sd3dInfo').textContent = 'Lỗi dựng mô hình: ' + e.message; console.error(e); return; }
  st.geom = geom; drawSel(); paint();
  const P = st.p3; if (!P) return;
  setGroup(geom); P.L = geom.dims.L;
  { const R = Math.max(15, P.L * 0.65), sc = P.sun.shadow.camera; P.sun.position.set(-0.45, 0.68, 0.3).normalize().multiplyScalar(P.L * 2.5); sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.near = 1; sc.far = P.L * 6; sc.updateProjectionMatrix(); }
  const a = geom.areas; $('#sd3dInfo').innerHTML = `Dài ${fmt(geom.dims.L)} m · rộng ${fmt(geom.dims.B)} m · tĩnh không ${fmt(a.air)} m<br>Hứng gió: mạn ${Math.round(a.AL)} m² · trước ${Math.round(a.AF)} m² · tâm ${fmt(a.xc)} m${geom.warn.length ? '<br><span style="color:#FFB547">' + geom.warn.map(esc).join('<br>') + '</span>' : ''}`;
  build3dExtras(); render3d();
}
const cam3 = () => (st.cam3 === 'orbit' ? st.p3.cam : st.p3.ocam);
function render3d() {
  const P = st && st.p3; if (!P) return; const c = $('#sd3d'), w = c.clientWidth | 0, h = c.clientHeight | 0; if (!w || !h) return;
  P.r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); P.r.setSize(w, h, false);
  if (st.cam3 === 'orbit') { P.cam.aspect = w / h; const R = P.L * 1.25 * P.dist; P.cam.position.set(Math.sin(P.yaw) * Math.cos(P.pitch) * R + P.ox, Math.sin(P.pitch) * R + 2 + P.oy, Math.cos(P.yaw) * Math.cos(P.pitch) * R); P.cam.lookAt(P.ox, 3 + P.oy, 0); P.cam.updateProjectionMatrix(); }
  else {
    // xem thẳng, cùng hướng với bàn vẽ: mạn — mũi bên phải; trên — mũi bên phải, mạn phải ở dưới; mũi — mạn phải bên trái
    const o = P.ocam, hh = P.L * 0.34 / P.oz; o.left = -hh * w / h; o.right = hh * w / h; o.top = hh; o.bottom = -hh;
    const cx = P.ox, cy = P.oy, T = ship().T;
    if (st.cam3 === 'side') { o.up.set(0, 1, 0); o.position.set(1000, cy + 3, -cx); o.lookAt(0, cy + 3, -cx); }
    else if (st.cam3 === 'top') { o.up.set(-1, 0, 0); o.position.set(-cy, 1000, -cx); o.lookAt(-cy, 0, -cx); }
    else { o.up.set(0, 1, 0); o.position.set(-cx, cy + 3, -1000); o.lookAt(-cx, cy + 3, 0); }
    o.updateProjectionMatrix(); P.water.visible = st.cam3 === 'top';
  }
  if (st.cam3 === 'orbit') P.water.visible = true;
  P.r.render(P.scene, cam3());
}
// khối của nhóm chi tiết đang chọn sáng lên; ở 3D lớn hiện điểm nắm
function build3dExtras() {
  const P = st && st.p3; if (!P || !st.geom) return; const g = st.geom;
  for (const k of ['hl', 'hd']) if (P[k]) { P.scene.remove(P[k]); P[k].traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); P[k] = null; }
  const ids = st.sel ? (g.links[st.sel] || [st.sel]) : []; if (!ids.length) { render3d(); return; }
  // vùng tam giác của các chi tiết trong nhóm
  const pos = [], bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], seen = new Set();
  for (const id of ids) for (const r of g.ranges[id] || []) { const key = r.it + ':' + r.t0; if (seen.has(key)) continue; seen.add(key); const it = g.items[r.it]; for (let t = r.t0; t < r.t1; t++) for (let k = 0; k < 3; k++) { const v = it.idx[t * 3 + k], x = it.pos[v * 3], y = it.pos[v * 3 + 1], z = it.pos[v * 3 + 2]; const w = toW(x, y, z); pos.push(w.x, w.y, w.z); bb[0] = Math.min(bb[0], x); bb[1] = Math.min(bb[1], y); bb[2] = Math.min(bb[2], z); bb[3] = Math.max(bb[3], x); bb[4] = Math.max(bb[4], y); bb[5] = Math.max(bb[5], z); } }
  if (pos.length) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); const grp = new THREE.Group(); grp.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }))); grp.add(new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({ color: 0x00e5ff, wireframe: true, transparent: true, opacity: 0.35, depthWrite: false }))); grp.renderOrder = 5; P.hl = grp; P.scene.add(grp); }
  st.bb3 = pos.length ? bb : null;
  if (st.mode === 'big3d') { P.hd = new THREE.Group(); P.hd.renderOrder = 10; P.scene.add(P.hd); st.h3 = handles(ids); const rr = Math.max(0.12, Math.min(0.5, P.L / 160)); for (const h of st.h3) { const sel = st.h3sel && h.p && st.h3sel.pid === h.p.id && st.h3sel.k === h.k; const m = new THREE.Mesh(new THREE.SphereGeometry(rr * (sel ? 1.5 : 1), 12, 8), new THREE.MeshBasicMaterial({ color: sel ? 0xffffff : h.col, depthTest: false, transparent: true, opacity: 0.95 })); m.position.copy(h.w); m.renderOrder = 11; m.userData.h = h; P.hd.add(m); } }
  render3d();
}
// điểm nắm: đỉnh nét vẽ của từng hình chiếu, hiện ở CẢ HAI ĐẦU khối, nằm đúng trên mặt khối:
// đỉnh hình mạn ở mạn phải + mạn trái, đỉnh mặt boong ở mép trên + mép dưới, đỉnh hình mũi / lái ở mặt trước + mặt sau
const KC = { side: 0xFF9100, top: 0x2979FF, front: 0x00C853, back: 0x00C853 };
function solidFor(ids) { return ((st.geom && st.geom.solids) || []).find((s) => ids.some((id) => s.ids.includes(id))) || null; }
const nearSlice = (s, x) => s.slices.reduce((m, q) => (Math.abs(q.x - x) < Math.abs(m.x - x) ? q : m));
const rng2 = (r, i) => { let a = Infinity, b = -Infinity; for (const p of r) { a = Math.min(a, p[i]); b = Math.max(b, p[i]); } return [a, b]; };
// bề rộng (y) của khối tại (x, z); chiều cao (z) tại (x, y); đoạn dọc (x) mà điểm (y, z) còn nằm trong khối
function extY(s, x, z) { const sl = nearSlice(s, x); let a = Infinity, b = -Infinity; for (const r of sl.rings) { const [z0, z1] = rng2(r, 1), q = atV(r, Math.max(z0 + 1e-3, Math.min(z1 - 1e-3, z))); if (q) { a = Math.min(a, q[0]); b = Math.max(b, q[1]); } } return a < b ? [a, b] : null; }
function extZ(s, x, y) { const sl = nearSlice(s, x); let a = Infinity, b = -Infinity; for (const r of sl.rings) { const [y0, y1] = rng2(r, 0), q = atH(r, Math.max(y0 + 1e-3, Math.min(y1 - 1e-3, y))); if (q) { a = Math.min(a, q[0]); b = Math.max(b, q[1]); } } return a < b ? [a, b] : null; }
function nearRing(r, y, z, tol) { let ins = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const A = r[i], B = r[j]; if ((A[1] > z) !== (B[1] > z) && y < (B[0] - A[0]) * (z - A[1]) / (B[1] - A[1]) + A[0]) ins = !ins; const dx = B[0] - A[0], dz = B[1] - A[1], t = Math.max(0, Math.min(1, ((y - A[0]) * dx + (z - A[1]) * dz) / (dx * dx + dz * dz || 1))); if (Math.hypot(A[0] + dx * t - y, A[1] + dz * t - z) <= tol) return true; } return ins; }
function extX(s, y, z) { let a = Infinity, b = -Infinity; for (const sl of s.slices) for (const r of sl.rings) if (nearRing(r, y, z, 0.05)) { a = Math.min(a, sl.x); b = Math.max(b, sl.x); } return a <= b ? [a, b] : [s.x0, s.x1]; }
function handles(ids) {
  const out = [], bb = st.bb3, f = fitOf(ids[0]); if (f) return fitHandles(f);
  const sol = solidFor(ids), real = {};
  for (const id of ids) { const p = partOf(id), v = p && viewById(p.view); if (v) real[v.kind] = p; }
  for (const id of ids) {
    const p = partOf(id), v = p && viewById(p.view); if (!v) continue; const c = C(v); if (!c.ok) continue;
    p.pts.forEach((q, k) => {
      const a = c.toShip(q), H0 = { p, v, k, kind: v.kind, col: KC[v.kind] };
      if (v.kind === 'side') { const e = sol && extY(sol, a[0], a[1]), ys = e ? [e[1] + 0.05, e[0] - 0.05] : bb ? [bb[4] + 0.05, bb[1] - 0.05] : [0]; for (const y of ys) out.push({ ...H0, w: toW(a[0], y, a[1]), plane: ['y', y] }); }
      else if (v.kind === 'top') { const e = sol && extZ(sol, a[0], a[1]), zs = e ? [e[1] + 0.05, e[0] - 0.05] : bb ? [bb[5] + 0.05, bb[2] - 0.05] : [ship().D + 1]; for (const z of zs) out.push({ ...H0, w: toW(a[0], a[1], z), plane: ['z', z] }); }
      else { const e = sol ? extX(sol, a[0], a[1]) : bb ? [bb[0], bb[3]] : [0, 0]; let xs = [e[1] + 0.05, e[0] - 0.05]; if (v.kind === 'front' && real.back) xs = [e[1] + 0.05]; if (v.kind === 'back' && real.front) xs = [e[0] - 0.05]; for (const x of xs) out.push({ ...H0, w: toW(x, a[0], a[1]), plane: ['x', x] }); }
    });
  }
  // hình tự sinh của khối (chưa vẽ ở hình đó): điểm nắm nhạt màu, kéo là thành nét thật
  if (sol) for (const a of (st.geom.auto || []).filter((q) => q.gid === sol.gid)) {
    if (a.view === 'fb') { if (real.front || real.back) continue; a.poly.forEach((q, k) => { const e = extX(sol, q[0], q[1]); for (const x of [e[1] + 0.05, e[0] - 0.05]) out.push({ auto: a, vk: 'front', k, kind: 'front', col: 0x69F0AE, w: toW(x, q[0], q[1]), plane: ['x', x] }); }); }
    else if (a.view === 'top') a.poly.forEach((q, k) => { const e = extZ(sol, q[0], q[1]) || [sol.z0, sol.z1]; for (const z of [e[1] + 0.05, e[0] - 0.05]) out.push({ auto: a, vk: 'top', k, kind: 'top', col: 0x82B1FF, w: toW(q[0], q[1], z), plane: ['z', z] }); });
    else if (a.view === 'side') a.poly.forEach((q, k) => { const e = extY(sol, q[0], q[1]) || [-1, 1]; for (const y of [e[1] + 0.05, e[0] - 0.05]) out.push({ auto: a, vk: 'side', k, kind: 'side', col: 0xFFB74D, w: toW(q[0], y, q[1]), plane: ['y', y] }); });
  }
  return out;
}
// chi tiết thư viện: điểm vàng (đổi cỡ, ở đỉnh) và điểm tím (xoay, phía trước chi tiết)
function fitHandles(f) {
  const bb = st.geom && st.geom.fitBB[f.id]; if (!bb || !isFinite(bb[0])) return [];
  const r = (f.rot || 0) * Math.PI / 180, R = Math.max(f.l, f.w) / 2 + Math.max(0.4, st.p3.L / 90), z = f.kind === 'anchor' ? bb[2] : f.z;
  return [{ fit: f, op: 'scale', col: 0xFFD600, w: toW((bb[0] + bb[3]) / 2, (bb[1] + bb[4]) / 2, bb[5] + 0.2) }, { fit: f, op: 'rot', col: 0xD500F9, w: toW(f.x + Math.cos(r) * R, f.y + Math.sin(r) * R, z + 0.1), plane: ['z', z + 0.1] }];
}
function ray3(e) { const P = st.p3, c = $('#sd3d'), r = c.getBoundingClientRect(); P.ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), cam3()); return P.ray; }
// giao tia chuột với mặt phẳng (theo trục tàu x / y / z = hằng số) → tọa độ tàu
function hitPlane(e, ax, val) { const ray = ray3(e).ray, T = ship().T; let n, d; if (ax === 'y') { n = new THREE.Vector3(1, 0, 0); d = -val; } else if (ax === 'z') { n = new THREE.Vector3(0, 1, 0); d = -(val - T); } else { n = new THREE.Vector3(0, 0, 1); d = val; } const pl = new THREE.Plane(n, d), out = new THREE.Vector3(); return ray.intersectPlane(pl, out) ? fromW(out) : null; }
function partAt3(e) {
  const P = st.p3; if (!P.grp || !st.geom) return null; const hit = ray3(e).intersectObjects(P.grp.children, false)[0]; if (!hit) return null;
  const it = P.grp.children.indexOf(hit.object), t = hit.faceIndex; let best = null;
  for (const [id, rs] of Object.entries(st.geom.ranges)) for (const r of rs) if (r.it === it && t >= r.t0 && t < r.t1) { const p = st.model.parts.find((q) => q.id === id); const v = p && viewById(p.view); const pr = v ? { side: 0, top: 1, front: 2, back: 2 }[v.kind] : 3; if (!best || pr < best.pr || (r.t1 - r.t0) < best.n) best = { id, pr, n: r.t1 - r.t0 }; }
  return best ? { id: best.id, point: fromW(hit.point) } : null;
}
// mặt phẳng đứng qua (x, y), quay về phía camera → tọa độ tàu (để kéo điểm đổi cỡ)
function hitVert(e, x, y) { const d = new THREE.Vector3(); cam3().getWorldDirection(d); d.y = 0; if (d.lengthSq() < 1e-6) d.set(0, 0, 1); d.normalize(); const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(d, toW(x, y, 0)), out = new THREE.Vector3(); return ray3(e).ray.intersectPlane(pl, out) ? fromW(out) : null; }
// cao độ mặt tàu (boong / nóc) ngay dưới (x, y), bỏ qua chính chi tiết `skip`
function surfaceZ(x, y, skip) { const P = st.p3; if (!P || !P.grp) return null; const ray = new THREE.Raycaster(toW(x, y, 300), new THREE.Vector3(0, -1, 0)); for (const h of ray.intersectObjects(P.grp.children, false)) { if (h.object.userData.decal) continue; const it = P.grp.children.indexOf(h.object); if (skip && (st.geom.ranges[skip] || []).some((r) => r.it === it && h.faceIndex >= r.t0 && h.faceIndex < r.t1)) continue; return fromW(h.point)[2]; } return null; }
const clampV = (v, a, b) => Math.max(a, Math.min(b, v));
// đặt chi tiết thư viện tại chỗ bấm trên 3D
function placeAt(e) {
  const P = st.p3, kind = st.place, K = FIT_KINDS[kind]; if (!K || !P.grp || !st.geom) return; const H = st.geom.hull;
  const hit = ray3(e).intersectObjects(P.grp.children, false).find((h) => !h.object.userData.decal);
  let pt = hit ? fromW(hit.point) : null;
  if (!pt) { const a = hitPlane(e, 'z', H.zTop(0)); if (!a) return; pt = [a[0], a[1], H.zTop(clampV(a[0], H.xa, H.xf))]; }
  const f = Object.assign(fitDefaults(kind, P.L), { id: uid('f'), x: r2(pt[0]), y: r2(pt[1]), z: r2(pt[2]) });
  if (K.side) { const s = pt[1] >= 0 ? 1 : -1; f.rot = s > 0 ? 0 : 180; f.y = r2(s * H.yAt(clampV(pt[0], H.xa, H.xf), pt[2], s)); }
  else {
    // bấm trúng vách đứng (mạn, vách thượng tầng): đặt lên boong / nóc ngay phía trong vách đó
    if (hit && hit.face && Math.abs(hit.face.normal.y) < 0.5) { const n = hit.face.normal, nx = -n.z, ny = n.x, nl = Math.hypot(nx, ny) || 1, x = pt[0] - nx / nl * 0.35, y = pt[1] - ny / nl * 0.35, z = surfaceZ(x, y, null); if (z !== null) { f.x = r2(x); f.y = r2(y); f.z = r2(z); } }
    if (Math.abs(f.y) < 0.15) f.y = 0;
  }
  st.model.fits.push(f); st.sel = f.id; st.h3sel = null; if (st.model.template) delete st.model.template;
  if (!e.shiftKey) startPlace(null); changed(); drawSel(); drawParts();
}
function down3(e) {
  const P = st.p3, c = $('#sd3d'); c.setPointerCapture(e.pointerId); c.focus({ preventScroll: true }); st.d3 = { x: e.clientX, y: e.clientY, moved: false };
  if (st.place && e.button === 0) { placeAt(e); st.d3 = null; return; }
  if (st.mode === 'big3d' && P.hd) { const h = ray3(e).intersectObjects(P.hd.children, false)[0]; if (h) { const hd = h.object.userData.h;
    if (hd.fit) { const bb = st.geom.fitBB[hd.fit.id]; st.d3.fitop = { f: hd.fit, op: hd.op, top0: bb[5] - hd.fit.z, o: { l: hd.fit.l, w: hd.fit.w, h: hd.fit.h, bl: hd.fit.bl } }; return; }
    if (hd.auto) { const np = autoToPart(hd.auto, hd.vk); hd.p = np; hd.v = viewById(np.view); delete hd.auto; st.sel = np.id; }
    st.h3sel = { pid: hd.p.id, k: hd.k }; st.d3.handle = hd; st.d3.start = fromW(hd.w); drawSel(); return; } }
  const pa = partAt3(e);
  if (st.mode === 'big3d' && pa && fitOf(pa.id)) { const f = fitOf(pa.id); if (st.sel !== f.id) { st.sel = f.id; st.h3sel = null; drawSel(); drawParts(); } st.d3.fitmove = { f, start: pa.point, o: { x: f.x, y: f.y, z: f.z } }; return; }
  if (st.mode === 'big3d' && e.shiftKey && pa && st.sel && (st.geom.links[st.sel] || [st.sel]).includes(pa.id)) { const ax = st.cam3 === 'side' ? 'y' : st.cam3 === 'front' ? 'x' : 'z', val = ax === 'y' ? pa.point[1] : ax === 'x' ? pa.point[0] : pa.point[2]; st.d3.group = { ax, val, start: pa.point, ids: st.geom.links[st.sel] || [st.sel], orig: new Map((st.geom.links[st.sel] || [st.sel]).map((id) => { const p = st.model.parts.find((q) => q.id === id); return [id, p.pts.map((q) => q.slice())]; })) }; return; }
  st.d3.pick = pa;
}
const liveSoon = () => { st.edited = true; if (!st.tq) st.tq = setTimeout(() => { st.tq = null; liveRebuild(); }, 70); };
function move3(e) {
  const P = st.p3, d = st.d3; if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.hypot(dx, dy) > 3) d.moved = true;
  if (d.handle) {
    const h = d.handle, a = hitPlane(e, h.plane[0], h.plane[1]); if (!a) return; const c = C(h.v);
    let m = h.kind === 'side' ? [a[0], a[2]] : h.kind === 'top' ? [a[0], a[1]] : [a[1], a[2]];
    const s0 = h.kind === 'side' ? [d.start[0], d.start[2]] : h.kind === 'top' ? [d.start[0], d.start[1]] : [d.start[1], d.start[2]];
    if (e.shiftKey) { if (Math.abs(m[0] - s0[0]) > Math.abs(m[1] - s0[1])) m[1] = s0[1]; else m[0] = s0[0]; }
    else m = snapM(h.kind, m, null, false, h.p, Math.max(0.05, st.grid * 0.6)).a;
    h.p.pts[h.k] = c.toPx(m); st.ver++; liveSoon();
    return;
  }
  if (d.fitop) {
    const f = d.fitop.f;
    if (d.fitop.op === 'rot') { const a = hitPlane(e, 'z', d.fitop.f.z + 0.1); if (!a) return; let ang = Math.atan2(a[1] - f.y, a[0] - f.x) * 180 / Math.PI; if (!e.shiftKey) ang = Math.round(ang / 5) * 5; f.rot = r2(ang); }
    else { const a = hitVert(e, f.x, f.y); if (!a) return; const k = clampV((a[2] - f.z) / Math.max(0.05, d.fitop.top0), 0.15, 10), o = d.fitop.o; f.l = r2(o.l * k); f.w = r2(o.w * k); f.h = r2(o.h * k); if (o.bl) f.bl = r2(o.bl * k); }
    liveSoon(); return;
  }
  if (d.fitmove) {
    if (!d.moved) return; const f = d.fitmove.f, K = FIT_KINDS[f.kind] || {}, H = st.geom.hull, o = d.fitmove;
    if (K.side) { const a = hitPlane(e, 'y', f.y); if (!a) return; const s = f.y >= 0 ? 1 : -1; f.x = r2(o.o.x + a[0] - o.start[0]); f.z = r2(o.o.z + a[2] - o.start[2]); f.y = r2(s * H.yAt(clampV(f.x, H.xa, H.xf), f.z, s)); }
    else if (st.cam3 === 'side') { const a = hitPlane(e, 'y', o.start[1]); if (!a) return; f.x = r2(o.o.x + a[0] - o.start[0]); f.z = r2(o.o.z + a[2] - o.start[2]); }
    else if (st.cam3 === 'front') { const a = hitPlane(e, 'x', o.start[0]); if (!a) return; f.y = r2(o.o.y + a[1] - o.start[1]); f.z = r2(o.o.z + a[2] - o.start[2]); }
    else { const a = hitPlane(e, 'z', o.start[2]); if (!a) return; f.x = r2(o.o.x + a[0] - o.start[0]); f.y = r2(o.o.y + a[1] - o.start[1]); if (Math.abs(f.y) < 0.12) f.y = 0; const z = surfaceZ(f.x, f.y, f.id); if (z !== null) f.z = r2(z); }
    liveSoon(); return;
  }
  if (d.group) {
    const g = d.group, a = hitPlane(e, g.ax, g.val); if (!a) return; const gs = st.grid; let D = [a[0] - g.start[0], a[1] - g.start[1], a[2] - g.start[2]].map((v) => Math.round(v / gs) * gs);
    if (g.ax === 'y') D[1] = 0; else if (g.ax === 'x') D[0] = 0; else D[2] = 0;
    for (const id of g.ids) { const p = st.model.parts.find((q) => q.id === id), v = p && viewById(p.view); if (!v) continue; const c = C(v), o = g.orig.get(id), dv = v.kind === 'side' ? [D[0], D[2]] : v.kind === 'top' ? [D[0], D[1]] : [D[1], D[2]]; p.pts = o.map((q) => { const s = c.toShip(q); return c.toPx([s[0] + dv[0], s[1] + dv[1]]); }); }
    st.ver++; liveSoon();
    return;
  }
  if (!d.moved) return;
  if (st.cam3 === 'orbit') { P.yaw -= (e.clientX - d.x) * 0.01; P.pitch = Math.max(-0.2, Math.min(1.45, P.pitch + (e.clientY - d.y) * 0.008)); }
  else { const c = $('#sd3d'), k = (P.L * 0.68 / P.oz) / c.clientHeight; P.ox -= (e.clientX - d.x) * k; P.oy += (e.clientY - d.y) * k; }
  d.x = e.clientX; d.y = e.clientY; render3d();
}
function up3(e) {
  const d = st.d3; st.d3 = null; if (!d) return;
  if (d.handle || d.group || d.fitop || (d.fitmove && d.moved)) { clearTimeout(st.tq); st.tq = null; changed(); if (d.fitop || d.fitmove) drawSel(); return; }
  if (d.fitmove) return;
  if (!d.moved) { const pa = d.pick; st.sel = pa ? pa.id : null; st.h3sel = null; drawSel(); drawParts(); paint(); }
}
// bấm đúp lên cạnh khối đang chọn: thêm một điểm vào nét gần nhất (ưu tiên hình chiếu đang xem thẳng)
function dbl3(e) {
  if (st.mode !== 'big3d' || !st.sel || !st.geom || st.place) return; const ids = st.geom.links[st.sel] || [st.sel], pa = partAt3(e); if (!pa || !ids.includes(pa.id)) return;
  // nét nhận điểm: xem thẳng → nét của hình đang xem; xem xoay → theo mặt được bấm (vách mạn → hình mạn, nóc → mặt boong, vách trước / sau → hình mũi / lái)
  const pt = pa.point, hit = ray3(e).intersectObjects(st.p3.grp.children, false)[0], nn = hit && hit.face ? hit.face.normal : null;
  const prefer = st.cam3 !== 'orbit' ? st.cam3 : nn ? (Math.abs(nn.y) > 0.7 ? 'top' : Math.abs(nn.x) >= Math.abs(nn.z) ? 'side' : 'front') : null;
  const kindOk = (k) => !prefer || k === prefer || (prefer === 'front' && k === 'back');
  const only = ids.some((id) => { const p = partOf(id), v = p && viewById(p.view); return v && p.kind !== 'point' && kindOk(v.kind); });
  let best = null;
  for (const id of ids) {
    const p = partOf(id), v = p && viewById(p.view); if (!p || p.kind === 'point' || !v || (only && !kindOk(v.kind))) continue; const c = C(v); if (!c.ok) continue;
    const q = v.kind === 'side' ? [pt[0], pt[2]] : v.kind === 'top' ? [pt[0], pt[1]] : [pt[1], pt[2]], M = p.pts.map((z) => c.toShip(z)), n = M.length, w = 1;
    for (let k = 0; k + 1 < n + (p.kind === 'line' ? 0 : 1); k++) { const A = M[k], B = M[(k + 1) % n], dx = B[0] - A[0], dy = B[1] - A[1], t = Math.max(0, Math.min(1, ((q[0] - A[0]) * dx + (q[1] - A[1]) * dy) / (dx * dx + dy * dy || 1))), P = [A[0] + dx * t, A[1] + dy * t], dd = Math.hypot(P[0] - q[0], P[1] - q[1]) * w; if (t > 0.02 && t < 0.98 && (!best || dd < best.d)) best = { d: dd, p, c, k, P }; }
  }
  if (best && best.d < Math.max(0.6, st.p3.L / 60)) { best.p.pts.splice(best.k + 1, 0, best.c.toPx(best.P)); st.sel = best.p.id; st.h3sel = { pid: best.p.id, k: best.k + 1 }; if (best.p.sharp) best.p.sharp = best.p.sharp.map((i) => (i > best.k ? i + 1 : i)); changed(); drawSel(); }
}
// thay nhóm 3D của tàu trong khung xem
function setGroup(geom) { const P = st.p3; if (!P) return; if (P.grp) { P.scene.remove(P.grp); P.grp.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); } P.grp = modelGroup(THREE, geom, { shadows: true }); P.scene.add(P.grp); }
// dựng lại nhanh khi đang kéo (không ghi lịch sử)
function liveRebuild() { let geom; try { geom = buildModel(st.model, ship()); } catch (e) { return; } st.geom = geom; if (st.p3) { setGroup(geom); build3dExtras(); } paint(); }

// ---------- dùng cho tàu, xuất / nhập ----------
function apply() {
  const m = clone(st.model); delete m.template; const msg = $('#sdMsg');
  if (!m.parts.length) { if (!confirm('Mô hình chưa có chi tiết nào. Bỏ mô hình, dùng lại tàu đơn giản?')) return; A.p.model = null; }
  else {
    A.p.model = m;
    if ($('#sdWind').checked) { const g = buildModel(m, ship()); A.p.windAL = Math.round(g.areas.AL); A.p.windAF = Math.round(g.areas.AF); A.p.windXc = Math.round(g.areas.xc * 10) / 10; }
  }
  saveShip(); st.src = JSON.stringify(A.p.model || null); st.edited = false; if (A.hooks.shipEdited) A.hooks.shipEdited();
  msg.textContent = A.p.model ? 'Đã dùng mô hình cho tàu: buồng lái, đèn hành trình' + ($('#sdWind').checked ? ', diện tích hứng gió' : '') + ' theo mô hình.' : 'Đã bỏ mô hình.';
}
async function exportFile() {
  const out = { app: 'MoPhongDieuDongTau', loai: 'mo-hinh-tau', v: 1, model: st.model, images: {} };
  for (const v of st.model.views) if (v.imgId) { const b = await getImg(v.imgId); if (b) out.images[v.imgId] = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); }); }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: 'application/json' })); a.download = (st.model.name || 'tau') + '.mohinh.json'; a.click();
  $('#sdMsg').textContent = 'Đã xuất file mô hình (kèm ảnh sơ đồ) — chép sang máy khác rồi «Nhập file».';
}
async function importFile(f) {
  try {
    const o = JSON.parse(await f.text()); if (!o || o.loai !== 'mo-hinh-tau' || !o.model) throw new Error('không phải file mô hình tàu của app');
    if (st.model.parts.length && !confirm('Thay mô hình đang vẽ bằng mô hình trong file?')) return;
    for (const [id, url] of Object.entries(o.images || {})) { const b = await (await fetch(url)).blob(); await putImg(id, b); }
    st.model = o.model; st.model.opts = st.model.opts || { shade: 'haze', rails: true }; st.model.guides = st.model.guides || []; st.cur = st.model.views[0] ? st.model.views[0].id : null; st.sel = null; st.img.clear(); st.data.clear(); st.fitted = false; st.active = {}; st.mode = 'board'; st.ver++;
    fitBoard(); refreshAll(); changed(); for (const v of st.model.views) loadImg(v); $('#sdMsg').textContent = 'Đã nhập «' + (st.model.name || f.name) + '».';
  } catch (e) { $('#sdMsg').textContent = 'Không nhập được: ' + (e.message || e); }
}
// cho kiểm thử tự động
export const shipDrawTest = { st: () => st, rebuild: () => { refreshAll(); rebuild3d(); }, atH, layout: () => st && st.lay, S2s: (P) => S2s(P), m2s: (k, a) => m2s(k, a), mode: (m) => setMode(m), undo: (d) => undo(d),
  // vị trí màn hình (so với khung 3D) của một điểm tàu
  w2s: (x, y, z) => { const v = toW(x, y, z).project(cam3()), c = $('#sd3d'); return [(v.x + 1) / 2 * c.clientWidth, (1 - v.y) / 2 * c.clientHeight]; }, handles: () => (st.h3 || []).map((h) => ({ pid: h.p ? h.p.id : null, auto: !!h.auto, fit: h.fit ? h.op : null, k: h.k, kind: h.kind, w: fromW(h.w) })), place: (k) => startPlace(k), pick3: (cx, cy) => { const r = partAt3({ clientX: cx, clientY: cy }); return r ? { id: r.id, point: r.point } : null; } };
