// Tab 1 (tàu), tab 2 (hải đồ), tab 4 (môi trường & kịch bản), cài đặt.
import { uiAlert, uiConfirm, uiPrompt } from './dialog.js';
import { A, $, $$, num, esc, LS, DB, saveShip, saveEnv, saveSet, saveObjs, loadObjs, rebuildModel, startPos, pad3 } from './app.js';
import { defaultShip, turningDiameter, sanity, propRot, PROP_NAMES, KN } from './physics.js';
import { fmtLL } from './kap.js';
import { fmtDist, legsLL, fmtLat, fmtLon, parseCoord, parseLatLon, pad3 as p3 } from './nav.js';
import { ChartCanvas } from './render/chartcanvas.js';
import { CS, toLL, toWorld, ensureAround, DEF_CLASS_DEPTH } from './chartsys.js';
import { migrateLegacy, placesFile, mergePlacesFile } from './places.js';
import { openPdfChart, pdfTest } from './ui_pdfchart.js';
export { pdfTest };
import { llToMerc } from './geo/proj.js';
import { inside } from './geo/poly.js';
import { DATUMS } from './geo/datum.js';
import { FLAG_MODES } from './flags.js';
import { defaultEnv, tideAt, envWaveL } from './world.js';
import { QUALITY } from './view3d.js';
import { openWindage } from './windage.js';
import { openShipDraw } from './ui_shipdraw.js';
import { fleetCard, initFleetCard } from './ui_fleet.js';
import { initDepthUI, depthCard, initDepthCard, pointCard, initPointCard, drawDepthPts, depthClick, depthRightClick, dmState, clearSel } from './ui_depth.js';
import { MOOR_HINT, shipAt, anchorAtPt, dragAnchor, deleteAnchor, placeNew, dragShip, dropShip, deleteShip, mooredCard, initMooredCard, mooredEdit, drawMoored, fleetForFile, fleetFromFile } from './ui_moored.js';
import { ALG as DM_ALG, WATER_ONLY_FROM, TINT_FROM } from './chartread/version.js';

const fld = (k, label, unit, val, attr) => `<div class="fld"><label for="f_${k}">${label}</label><div class="in"><input id="f_${k}" data-k="${k}" value="${esc(val)}" ${attr || ''}>${unit ? `<span class="u">${unit}</span>` : ''}</div></div>`;
const sel = (k, label, opts, val) => `<div class="fld"><label for="f_${k}">${label}</label><div class="in"><select id="f_${k}" data-k="${k}">${opts.map((o) => `<option value="${o[0]}" ${String(o[0]) === String(val) ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div></div>`;

// ---------------- Tab 1: thông số tàu ----------------
const SHIP = [
  ['Thông tin chung', 'g3', [['name', 'Tên tàu', '', 't'], ['type', 'Loại tàu', '', 't'], ['load', 'Trạng thái tải', [['loaded', 'Có hàng'], ['ballast', 'Ballast']]]]],
  ['Kích thước & tải trọng', 'g4', [['loa', 'Chiều dài toàn bộ (LOA)', 'm'], ['lpp', 'Chiều dài hai trụ (LPP)', 'm'], ['B', 'Chiều rộng (B)', 'm'], ['D', 'Chiều cao mạn (D)', 'm'], ['tf', 'Mớn nước mũi', 'm'], ['ta', 'Mớn nước lái', 'm'], ['disp', 'Lượng giãn nước', 't'], ['cb', 'Hệ số béo (Cb)', '']]],
  ['Máy chính & chân vịt', 'g4', [['engines', 'Số máy & chân vịt', [[1, '1 máy · 1 chân vịt'], [2, '2 máy · 2 chân vịt'], [3, '3 máy · 3 chân vịt'], [4, '4 máy · 4 chân vịt']]], ['ptype', 'Loại chân vịt', [['fpp', 'Bước cố định'], ['cpp', 'Biến bước']]], ['accTime', 'Dừng → Tiến max', 's'], ['gear', 'Tỷ số hộp số (máy : chân vịt)', ''], ['propD', 'Đường kính chân vịt', 'm'], ['PD', 'Tỷ số bước (P/D)', ''], ['wP', 'Hệ số dòng theo', ''], ['tP', 'Hệ số lực hút', '']]],
  ['Bánh lái & quay trở', 'g4', [['rudMax', 'Góc lái tối đa', '°'], ['rudTime', 'Hết trái → hết phải', 's'], ['rudders', 'Số bánh lái', ''], ['respTime', 'Thời gian ăn lái', 's'], ['AR', 'Diện tích một bánh lái', 'm²'], ['hR', 'Chiều cao bánh lái', 'm'], ['turnDia', 'Đường kính quay trở (tiến max, hết lái)', 'm'], ['gammaR', 'Hệ số nắn dòng', '']]],
  ['Neo & dây buộc', 'g4', [['bowAnchors', 'Số neo mũi', [[1, '1 neo (chính giữa)'], [2, '2 neo']]], ['sternAnchors', 'Số neo lái', [[0, 'Không có'], [1, '1 neo (chính giữa)'], [2, '2 neo']]], ['chainLen', 'Chiều dài xích neo', 'm'], ['anchorW', 'Trọng lượng quả neo', 't'], ['chainW', 'Trọng lượng 1 m xích', 'kg/m'], ['lineR', 'Bán kính dây buộc', 'mm'], ['lineLen', 'Chiều dài dây buộc', 'm']]],
  ['Hứng gió', 'g3', [['windAL', 'Diện tích hứng gió mạn', 'm²'], ['windAF', 'Diện tích hứng gió chính diện', 'm²'], ['windXc', 'Tâm hứng gió (+ về mũi)', 'm']]]
];
const FX = [['shallow', 'Nước nông & squat'], ['bank', 'Hiệu ứng bờ luồng'], ['prop', 'Lực ngang chân vịt'], ['env', 'Gió, sóng']];
export function initShip() {
  const p = A.p, el = $('#p-ship');
  el.innerHTML = `<div class="flex" style="justify-content:space-between;align-items:flex-end;margin-bottom:10px"><div><div style="font-size:20px;font-weight:700">Thông số tính năng điều động của tàu</div><div class="muted">Lấy từ Pilot card / Wheelhouse poster. Màn Điều động tính toán trực tiếp từ các số này.</div></div>
  <div><button class="btn" id="shipReset">Về tàu mẫu</button> <button class="btn" id="shipExport">Lưu ra file</button> <label class="btn" style="display:inline-flex;align-items:center">Mở từ file<input type="file" id="shipImport" accept=".json" hidden></label></div></div>
  ${fleetCard()}
  <div id="shipCalc" class="note" style="margin-bottom:12px"></div>
  <div class="flex"><div class="col" style="flex:1 1 560px">${SHIP.map((g) => `<section class="card"><h2>${g[0]}</h2><div class="grid ${g[1]}">${g[2].map((f) => Array.isArray(f[2]) ? sel(f[0], f[1], f[2], p[f[0]]) : fld(f[0], f[1], f[2], p[f[0]], f[3] ? 'data-t="1"' : 'inputmode="decimal"')).join('')}</div></section>`).join('')}</div>
  <div class="col" style="flex:1 1 420px"><section class="card"><h2>Mô hình 3D tàu</h2><div class="muted" id="mdlInfo" style="margin-bottom:8px">${p.model && p.model.parts && p.model.parts.length ? 'Đang dùng mô hình vẽ từ sơ đồ: ' + p.model.parts.length + ' chi tiết trên ' + p.model.views.length + ' hình chiếu. Buồng lái, đèn hành trình theo mô hình.' : 'Đang dùng tàu đơn giản. Vẽ lại tàu theo sơ đồ (ảnh / PDF, 1–3 hình chiếu) để cảnh nhìn từ buồng lái, đèn và diện tích hứng gió giống tàu thật.'}</div><div class="flex" style="gap:8px"><button class="btn sm pri" id="mdlBtn">Vẽ tàu từ sơ đồ…</button>${p.model ? '<button class="btn sm" id="mdlOff">Bỏ mô hình (dùng tàu đơn giản)</button>' : ''}</div>
  <div style="margin-top:10px">${sel('flags', 'Cờ trên cột cao nhất', FLAG_MODES, p.flags || 'hq')}</div><div class="muted" style="margin-top:4px">Cờ Tổ quốc treo mạn phải, cờ Hải quân mạn trái thấp hơn 20 cm (nhìn từ lái lên mũi); treo ở đầu xà của cột cao nhất, bay theo gió biểu kiến.</div></section>
  <section class="card"><h2>Bảng nấc máy (tay chuông)</h2><div class="muted" style="margin-bottom:6px">Mỗi dòng là một nút trên tay chuông. Tàu nhiều máy: bảng áp dụng cho từng máy. Tốc độ lùi để trống — app tự tính.</div>
  <table><thead><tr><th>Nấc</th><th>Vòng quay máy (v/ph)</th><th>Tốc độ có hàng (hl/h)</th><th>Tốc độ ballast (hl/h)</th></tr></thead><tbody>${p.steps.map((s, i) => `<tr><th>${s.label}</th><td><input class="cell mono" data-s="${i}" data-c="rpm" value="${s.rpm}" aria-label="Vòng quay ${s.label}"></td><td>${s.id[0] === 'f' ? `<input class="cell mono" data-s="${i}" data-c="kn" value="${s.kn}" aria-label="Tốc độ có hàng ${s.label}">` : '—'}</td><td>${s.id[0] === 'f' ? `<input class="cell mono" data-s="${i}" data-c="knB" value="${s.knB}" aria-label="Tốc độ ballast ${s.label}">` : '—'}</td></tr>`).join('')}</tbody></table></section>
  <section class="card"><h2>Hiệu ứng tính thêm</h2>${FX.map((f) => `<label style="display:flex;gap:8px;align-items:center;padding:4px 0"><input type="checkbox" data-fx="${f[0]}" ${p.fx[f[0]] ? 'checked' : ''} style="width:17px;height:17px"> ${f[1]}</label>`).join('')}
  <div class="muted" style="margin-top:6px">Mô hình thân tàu – chân vịt – bánh lái tách rời (kiểu MMG), hệ số thân tàu ước tính theo Kijima từ L, B, mớn nước, Cb. Chưa có: tương tác tàu–tàu.</div></section></div></div>`;
  const eg = Array.from(el.querySelectorAll('section h2')).find((h) => h.textContent === 'Máy chính & chân vịt');
  if (eg) { eg.parentNode.insertAdjacentHTML('beforeend', '<div id="rotBox" style="margin-top:10px"></div>'); rotBox(); }
  const wg = Array.from(el.querySelectorAll('section h2')).find((h) => h.textContent === 'Hứng gió');
  if (wg) { wg.parentNode.insertAdjacentHTML('beforeend', '<div class="flex" style="gap:10px;align-items:center;margin-top:10px"><button class="btn sm pri" id="windBtn">Tính từ sơ đồ tàu (PDF / ảnh)…</button><span class="muted">Mở bản vẽ bố trí chung, app tách bóng tàu và tính 3 số trên.</span></div>'); $('#windBtn').onclick = () => openWindage(); }
  let tm = null;
  const changed = () => { saveShip(); clearTimeout(tm); tm = setTimeout(() => { calcShip(); if (A.hooks.shipChanged) A.hooks.shipChanged(); }, 400); };
  el.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.rot !== undefined) { p.rot = propRot(p); p.rot[+t.dataset.rot] = t.value; changed(); return; }
    if (t.dataset.k) { p[t.dataset.k] = t.dataset.t || t.tagName === 'SELECT' && isNaN(+t.value) ? t.value : num(t.value, p[t.dataset.k]); if (t.dataset.k === 'engines') { p.engines = +t.value; p.props = p.engines; p.rot = propRot(Object.assign({}, p, { rot: p.rot })); rotBox(); } changed(); }
    else if (t.dataset.s) { p.steps[+t.dataset.s][t.dataset.c] = num(t.value, 0); changed(); }
    else if (t.dataset.fx) { p.fx[t.dataset.fx] = t.checked; changed(); }
  });
  $('#shipReset').onclick = async () => { if (await uiConfirm('Đưa mọi thông số về tàu mẫu?')) { A.p = defaultShip(); saveShip(); initShip(); if (A.hooks.shipChanged) A.hooks.shipChanged(); } };
  $('#mdlBtn').onclick = () => openShipDraw();
  if ($('#mdlOff')) $('#mdlOff').onclick = async () => { if (await uiConfirm('Bỏ mô hình vẽ, dùng lại tàu đơn giản? (bản vẽ vẫn mở lại được nếu chưa đóng app)')) { A.p.model = null; saveShip(); initShip(); if (A.hooks.shipChanged) A.hooks.shipChanged(); } };
  $('#shipExport').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(A.p, null, 1)], { type: 'application/json' })); a.download = (A.p.name || 'tau') + '.json'; a.click(); };
  $('#shipImport').onchange = async (e) => { try { const o = JSON.parse(await e.target.files[0].text()); A.p = Object.assign(defaultShip(), o); saveShip(); initShip(); if (A.hooks.shipChanged) A.hooks.shipChanged(); } catch (x) { uiAlert('File không đọc được'); } };
  initFleetCard(() => { initShip(); if (A.hooks.shipChanged) A.hooks.shipChanged(); });
  calcShip();
}
// chiều quay từng chân vịt (người dùng tự chọn, không đặt sẵn)
function rotBox() {
  const p = A.p, el = $('#rotBox'); if (!el) return; const r = propRot(p), names = PROP_NAMES[r.length];
  el.innerHTML = `<div class="lbl">Chiều quay khi tiến — nhìn từ lái lên mũi (chiều phải = theo chiều kim đồng hồ)</div><div class="grid g4" style="margin-top:4px">${r.map((v, i) => `<div class="fld"><label for="rot${i}">${names[i]}</label><div class="in"><select id="rot${i}" data-rot="${i}"><option value="" ${v ? '' : 'selected'}>— chọn —</option><option value="right" ${v === 'right' ? 'selected' : ''}>Chiều phải</option><option value="left" ${v === 'left' ? 'selected' : ''}>Chiều trái</option></select></div></div>`).join('')}</div>`;
}
function calcShip() {
  const M = rebuildModel(), td = turningDiameter(M), sw = sanity(M), dec = (v, k) => v.toFixed(k).replace('.', ',');
  const warn = M.rCal <= 0.26 || M.rCal >= 4.9 || !isFinite(td);
  $('#shipCalc').className = 'note ' + (warn || sw.length ? '' : 'ok');
  $('#shipCalc').innerHTML = `App đã hiệu chỉnh theo số bạn nhập: tốc độ từng nấc tiến khớp bảng nấc máy; đường kính quay trở tính ra <b>${isFinite(td) ? td.toFixed(0) : '—'} m</b> (bạn nhập ${num(A.p.turnDia, 0)} m, tiến max, lái ${M.rudMax}°; hệ số hiệu chỉnh bánh lái ${dec(M.rCal, 2)}). Sức cản ở tốc độ max ≈ ${Math.round(M.kR * (num(A.p.steps[0][A.p.load === 'ballast' ? 'knB' : 'kn'], 12) * KN) ** 2 / 1000).toLocaleString('vi-VN')} kN. Mớn nước trung bình ${dec(M.d, 2)} m.`
    + (warn ? ' <b>Không khớp được đường kính quay trở</b> — xem các dòng nhắc dưới (nếu có), rồi kiểm tra diện tích bánh lái và đường kính quay trở.' : '')
    + sw.map((s) => '<br>• ' + s).join('');
}

// ---------------- Tab 2: hải đồ ----------------
// Mọi tờ trong kho được ghép liền mạch theo tọa độ (tờ chi tiết nằm trên); không còn khái niệm «tờ đang mở».
let cv = null, tool = 'pan', selObj = null, draft = null, meas = null, dragWP = -1, dragBol = null, imp = null;
const selRoute = () => { const o = A.W.objs; return o.routes && o.routeSel >= 0 ? o.routes[o.routeSel] || null : null; };
function nearWP(p) { const r = selRoute(); if (!r || !cv) return -1; let bi = -1, bd = 12; r.pts.forEach((q, i) => { const s2 = cv.m2s(q[0], q[1]), d = Math.hypot(s2[0] - p[0], s2[1] - p[1]); if (d < bd) { bd = d; bi = i; } }); return bi; }
export function chartView() { return cv; }
const fmtSc = (n) => (n ? '1:' + Number(n).toLocaleString('vi-VN') : '');
const fmtM = (m) => (m < 10 ? m.toFixed(1) : Math.round(m)).toString().replace('.', ',');
// nạp file .kap vào kho; auto: tự chọn vị trí xuất phát nếu đây là các tờ đầu tiên
export async function addChartFiles(files, auto = true) {
  const list = Array.from(files).filter((f) => /\.kap$/i.test(f.name));
  if (!list.length) return 0;
  const had = A.W.hasCharts(); imp = { name: '', f: 0, left: list.length }; drawStatus();
  let n = 0; try { n = await CS.catalog.importFiles(list, (r, f) => { imp.name = r.name; imp.f = f; drawStatus(); }); } finally { imp = null; }
  drawLib(); drawStatus();
  if (n && !had && auto) await firstCharts();
  if (A.hooks.chartsChanged) A.hooks.chartsChanged();
  return n;
}
// vừa nạp xong một tờ PDF: đưa khung nhìn tới tờ đó
export async function pdfChartAdded(r) {
  drawLib(); if (cv) { cv.size(); cv.fitChart(r); cv.inited = true; drawChart(); }
  if (!A.W.start) await firstCharts();
  if (A.hooks.chartsChanged) A.hooks.chartsChanged();
}
// lần đầu có hải đồ: xem toàn bộ và đặt vị trí xuất phát ở vùng nước sâu gần tâm tờ đầu tiên
async function firstCharts() {
  const r = CS.catalog.records.find((q) => q.ready); if (!r) return;
  if (cv && cv.size()[0]) { fitAll(); cv.inited = true; }
  if (!A.W.start) { const p = await findWater(r); A.W.start = { x: p[0], y: p[1], hdg: 0 }; saveObjs(); if (A.hooks.resetToStart) A.hooks.resetToStart(false); }
  drawChart(); drawSide();
}
export async function findWater(r) {
  await CS.provider.load(r); CS.provider.sort();
  const c = toWorld(...r.xf.pxToLL(r.W / 2, r.H / 2)), W = A.W, gap = 300;
  const ok = (x, y) => [[0, 0], [-gap, 0], [gap, 0], [0, -gap], [0, gap]].every(([dx, dy]) => W.classAt(x + dx, y + dy) === 4 && W.chartAt(x + dx, y + dy));
  const st = Math.max(60, r.pxM * 30);
  for (let k = 0; k < 150; k++) for (let i = -k; i <= k; i++) for (const [dx, dy] of [[i, -k], [i, k], [-k, i], [k, i]]) { const x = c[0] + dx * st, y = c[1] + dy * st; if (ok(x, y)) return [x, y]; }
  return c;
}
function fitAll() {
  const rs = CS.catalog.records.filter((r) => r.ready); if (!rs.length || !cv) return;
  let x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18;
  for (const r of rs) for (const [la, lo] of r.plyLL) { const [x, y] = toWorld(la, lo); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  cv.size(); cv.fitWorld(x0, y0, x1, y1);
}
function initialView() {
  const sp = startPos(); if (A.W.start) { cv.centerM(sp.x, sp.y); cv.setMpp(6); } else if (A.W.hasCharts()) fitAll(); else { cv.centerM(0, 0); cv.setMpp(20); }
}
const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
const normA = (t) => norm(t).replace(/[^a-z0-9]/g, '');
let libQ = '', libLL = null, libT = 0;
function recState(r) {
  if (r.ready) { const d = dmState(r); return (r.datumKnown ? r.datumName + (r.datum !== 'WGS84' ? ' → WGS-84' : '') : '⚠ datum ' + r.datumName) + ' · georef bậc ' + r.coef.order + ', sai số ' + fmtM(r.rmsM) + ' m' + (d ? ' · ' + d : ''); }
  if (r.error) return 'Lỗi: ' + r.error;
  if (r.progress !== undefined) return 'Đang chia ô ảnh… ' + Math.round(r.progress * 100) + '%';
  return CS.catalog.busy ? 'Đang chờ nạp…' : 'Nạp dở dang — thêm lại file này';
}
function drawLib() {
  const el = $('#chartLib'); if (!el) return; const all = CS.catalog.records, cur = cv && cv.ref ? cv.ref.id : null;
  let list = all.slice().sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true }));
  if (libQ) { const q = norm(libQ).trim(), qa = normA(libQ); list = list.filter((c) => { const f = [c.name, c.nu, c.file]; return f.map(norm).join(' | ').includes(q) || (qa && f.map(normA).some((h) => h.includes(qa))); }); }
  if (libLL) { const m = llToMerc(libLL[0], libLL[1]); list = list.filter((c) => c.plyMerc && inside(m[0], m[1], c.plyMerc)).sort((a, b) => (a.scale || 1e9) - (b.scale || 1e9)); }
  const info = $('#libInfo'); if (info) info.textContent = libQ || libLL ? 'Tìm thấy ' + list.length + ' / ' + all.length + ' tờ' + (libLL ? ' có chứa ' + fmtLL(libLL[0], libLL[1]) + ' (tỷ lệ lớn nhất trước)' : '') : all.length ? all.length + ' tờ trong kho' : '';
  el.innerHTML = list.length ? list.map((c) => `<div style="display:flex;gap:4px;align-items:stretch"><button data-id="${esc(c.id)}" class="${c.id === cur ? 'on' : ''}" ${c.ready ? '' : 'disabled'} style="flex:1;min-width:0"><b>${esc(c.name)}</b>${c.scale ? ' · ' + fmtSc(c.scale) : ''}${c.nu && c.nu !== c.name ? ' · số ' + esc(c.nu) : ''}<br><span class="muted">${esc(recState(c))}</span></button><button data-del="${esc(c.id)}" aria-label="Xóa tờ ${esc(c.name)} khỏi kho" title="Xóa khỏi kho" style="width:30px;flex:0 0 30px;text-align:center;padding:0">✕</button></div>`).join('')
    : `<div class="muted">${all.length ? 'Không có tờ nào khớp.' : 'Kho trống. Thêm thư mục hoặc file .kap.'}</div>`;
}
let sideT = 0; const sideSoon = () => { if (sideT) return; sideT = setTimeout(() => { sideT = 0; const a = document.activeElement; if (a && a.closest && a.closest('#chartSide') && a.tagName === 'INPUT') return; drawSide(); }, 300); };
const libSoon = () => { if (libT) return; libT = setTimeout(() => { libT = 0; drawLib(); }, 250); };
function drawStatus() {
  const st = $('#chartStatus'); if (!st) return; let cls = 'note', t;
  const n = CS.catalog.records.filter((r) => r.ready).length, r = cv && cv.ref;
  if (imp) t = 'Đang nạp ' + (imp.name || '…') + ' — ' + Math.round(imp.f * 100) + '%. App chia ảnh thành ô để xem mượt; chỉ làm một lần, lần sau mở ngay.';
  else if (CS.glErr) { cls = 'note bad'; t = 'Máy không chạy được WebGL2 nên không vẽ được hải đồ (' + CS.glErr.message + ')'; }
  else if (!n) t = 'Kho hải đồ trống — app đang chạy ở «biển trống», sâu 30 m. Thêm file .kap ở khung bên trái.';
  else if (r) { cls = r.datumKnown ? 'note ok' : 'note'; t = 'Đang xem: ' + r.name + ' · ' + fmtSc(r.scale) + ' · ' + r.datumName + (r.datum !== 'WGS84' ? ' → đã chuyển WGS-84' : '') + ' · ' + n + ' tờ trong kho' + (r.warn ? ' · ' + r.warn : ''); }
  else { cls = 'note ok'; t = 'Ngoài vùng hải đồ (biển trống, sâu 30 m) · ' + n + ' tờ trong kho'; }
  if (st._t !== t) { st._t = t; st.textContent = t; } if (st.className !== cls) st.className = cls;
}
const KIND = [['light', 'Đèn trên bờ / đảo'], ['beaconR', 'Tiêu trái luồng (đỏ)'], ['beaconG', 'Tiêu phải luồng (xanh)'], ['buoyR', 'Phao trái luồng (đỏ)'], ['buoyG', 'Phao phải luồng (xanh)'], ['buoyY', 'Phao khác (vàng)']];
function drawSide() {
  const el = $('#chartSide'), W = A.W; if (!el) return;
  let h = '';
  if (selObj && selObj.t === 'light') {
    const o = selObj.o;
    h += `<section class="card"><h2>Đang chọn: đèn / phao</h2><div class="grid g2">${fld('o_name', 'Tên / số hiệu', '', o.name || '', 'data-t="1"')}${sel('o_kind', 'Loại', KIND, o.kind)}${sel('o_color', 'Màu đèn', [['W', 'Trắng'], ['R', 'Đỏ'], ['G', 'Xanh lục'], ['Y', 'Vàng']], o.color)}${fld('o_period', 'Chu kỳ', 's', o.period)}${fld('o_flash', 'Thời gian sáng', 's', o.flash)}${fld('o_grp', 'Số chớp mỗi chu kỳ', '', o.grp || 1)}${fld('o_height', 'Độ cao đèn', 'm', o.height)}</div><div class="muted" style="margin-top:6px">Ví dụ Fl(4)15s: chu kỳ 15, sáng 0,5, 4 chớp. Fl.G 3s: chu kỳ 3, 1 chớp.</div><button class="btn warn sm" id="oDel" style="margin-top:8px">Xóa</button></section>`;
  } else if (selObj && selObj.t === 'berth') {
    const o = selObj.o;
    h += `<section class="card"><h2>Đang chọn: cầu bến</h2><div class="grid g2">${fld('o_name', 'Tên bến', '', o.name || '', 'data-t="1"')}${fld('o_depth', 'Độ sâu trước bến', 'm', o.depth)}${fld('o_top', 'Cao trình mặt cầu', 'm', o.top)}${fld('o_spacing', 'Khoảng cách bích', 'm', o.spacing)}</div><div class="muted" style="margin-top:6px">${o.pts.length - 1} đoạn · dài ${(o._len || 0).toFixed(0)} m · ${W.bollards.filter((q) => q.bi >= 0).length} cọc bích trên toàn hải đồ.</div>${bolList(o)}<button class="btn warn sm" id="oDel" style="margin-top:8px">Xóa cầu bến</button></section>`;
  } else if (selObj && selObj.t === 'sound') {
    h += `<section class="card"><h2>Đang chọn: điểm độ sâu</h2>${fld('o_d', 'Độ sâu', 'm', selObj.o.d)}<button class="btn warn sm" id="oDel" style="margin-top:8px">Xóa</button></section>`;
  }
  if (tool === 'depth') h += pointCard();
  if (tool === 'ship' || (selObj && selObj.t === 'ship')) h += mooredCard(selObj && selObj.t === 'ship' ? selObj.o : null);
  if (A.sim && A.sim.t >= 2) { const S = A.sim.S, st0 = startPos(), dd = Math.hypot(S.x - st0.x, S.y - st0.y); if (dd > 20) h += `<section class="card"><h2>Vị trí tàu</h2><div class="muted">Bài tập đang dở: tàu đang cách vị trí xuất phát ${fmtDist(dd)} (hình tàu màu xanh lục trên hải đồ). Hải đồ tab 3 hiện vị trí tàu lúc này.</div><button class="btn sm" id="toStart" style="margin-top:8px;width:100%">Đưa tàu về vị trí xuất phát (bắt đầu lại)</button></section>`; }
  if (tool === 'route') h += routeCard();
  const sp = startPos(), r = cv && cv.ref;
  if (r) {
    const cd = r.classDepth || DEF_CLASS_DEPTH, off = r.offsetM || [0, 0], ds = r.datumUser || '', dmOk = r.dm && r.dm.st === 'ok';
    h += depthCard(r, tool);
    if (!dmOk) h += `<section class="card"><h2>Độ sâu theo màu · ${esc(r.name)}</h2><div class="muted" style="margin-bottom:6px">App đọc màu hải đồ để chia vùng. Nhập độ sâu đại diện cho từng vùng của tờ này; trước cầu bến dùng «Độ sâu trước bến».</div><div class="grid g3">${fld('cd4', 'Vùng trắng (sâu)', 'm', cd[4])}${fld('cd3', 'Xanh nhạt', 'm', cd[3])}${fld('cd2', 'Xanh đậm', 'm', cd[2])}</div><div class="muted" style="margin-top:6px">Bãi cạn (xanh lá) hở ${-cd[1]} m trên số 0 hải đồ; đất liền luôn là bờ.</div></section>`;
    h += `<section class="card"><h2>Tọa độ tờ ${esc(r.name)}</h2>
    <div class="kv"><span>Tỷ lệ · cỡ ảnh</span><b>${fmtSc(r.scale)} · ${r.W} × ${r.H}</b></div>
    <div class="kv"><span>Datum ghi trong file</span><b>${esc(r.datumSrc || 'không ghi')}</b></div>
    <div class="kv"><span>Georef (${r.coef.n} điểm REF)</span><b>bậc ${r.coef.order} · TB ${fmtM(r.rmsM)} m · max ${fmtM(r.maxM)} m</b></div>
    <div class="kv"><span>1 điểm ảnh ≈</span><b>${fmtM(r.pxM)} m</b></div>
    <div style="margin-top:8px">${sel('dsUser', 'Datum dùng cho tờ này', [['', 'Theo file (' + (r.datumSrc || 'không ghi') + ')'], ...Object.keys(DATUMS).map((k) => [k, DATUMS[k].name])], ds)}</div><div class="grid g2" style="margin-top:6px">${fld('offE', 'Dời tay về Đông', 'm', off[0])}${fld('offN', 'Dời tay về Bắc', 'm', off[1])}</div>
    <div class="muted" style="margin-top:6px">Bật «Lưới kinh vĩ» rồi so với lưới in trên tờ: lệch thì chọn lại datum hoặc dời tay (m). Ảnh không phải chia lại.</div></section>`;
  }
  h += `<section class="card"><h2>Đối tượng đã đặt</h2><div class="muted" style="margin-bottom:4px">Lưu theo tọa độ WGS-84, dùng chung cho mọi tờ hải đồ.</div><div class="kv"><span>Đèn / phao</span><b>${W.objs.lights.length}</b></div><div class="kv"><span>Cầu bến · bích</span><b>${W.objs.berths.length} · ${W.bollards.filter((b) => b.bi >= 0).length}</b></div><div class="kv"><span>Tuyến đi</span><b>${(W.objs.routes || []).length}</b></div><div class="kv"><span>Vị trí xuất phát</span><b>${W.start ? fmtLL(...toLL(sp.x, sp.y)) : 'chưa chọn'}</b></div><div class="kv"><span>Vị trí xuất phát có sẵn</span><b>${(W.objs.starts || []).length}</b></div><div class="kv"><span>Tàu đậu</span><b>${(W.objs.ships || []).length}</b></div>
  <div class="flex" style="gap:6px;margin-top:8px"><button class="btn sm" id="objExp">Lưu ra file…</button><label class="btn sm" style="display:inline-flex;align-items:center">Mở từ file…<input type="file" id="objImp" accept=".json" hidden></label></div><div class="muted" style="margin-top:4px">File gồm đèn, phao, tiêu, cầu bến, cọc bích, tuyến đi, vị trí xuất phát, tàu đậu (kèm mô hình tàu, không kèm ảnh sơ đồ) — chép sang máy khác rồi mở ở đây. Mở file sẽ gộp vào đối tượng đang có (trùng tên thì thay).</div></section>`;
  el.innerHTML = h; initMooredCard(); if (r) initDepthCard(r); if (tool === 'depth') initPointCard();
}
const TOOLS = [['pan', 'Chọn / kéo'], ['light', 'Đèn / phao'], ['berth', 'Cầu bến'], ['bollard', 'Cọc bích'], ['ship', 'Tàu đậu'], ['route', 'Tuyến đi'], ['start', 'Vị trí xuất phát'], ['depth', 'Độ sâu đọc được'], ['measure', 'Đo']];
const HINT = { depth: 'Các số app đọc từ hải đồ: đỏ = số đo sâu, cam = nghi đọc sai (chưa dùng), xanh dương = số bạn sửa / thêm, xanh lá = độ cao. Bấm vào điểm để sửa, bấm chỗ trống để thêm số đo sâu, Shift + bấm để thêm độ cao, chuột phải vào điểm để xóa. Sửa xong app tự dựng lại mặt đáy.', ship: MOOR_HINT, pan: 'Kéo để di chuyển, lăn chuột để phóng to. Bấm vào đèn, cầu bến hoặc tàu đậu để sửa (kéo tàu đậu để dời). Bấm chuột phải vào đèn / cầu bến / tàu đậu để xóa.', light: 'Bấm lên vị trí đèn hoặc phao trên hải đồ, rồi sửa thông tin ở khung bên phải.', berth: 'Bấm lần lượt dọc mép cầu (phía nước). Bấm đúp để kết thúc. Bấm chuột phải để bỏ điểm vừa đặt. Bích buộc dây tự đặt đều theo khoảng cách bạn nhập.', sound: 'Bấm lên con số độ sâu trên hải đồ rồi gõ giá trị.', start: 'Bấm lên chỗ tàu xuất phát. Hướng ban đầu nhập ở tab 4.', bollard: 'Kéo cọc bích dọc mép cầu để dời. Bấm lên mép cầu để thêm cọc. Chuột phải vào cọc để xóa. Số khoảng cách từ đầu bến hiện ở khung bên phải (bấm vào cầu bến bằng «Chọn / kéo» để xem).', measure: 'Bấm hai điểm để đo khoảng cách (hải lý, gần thì mét) và phương vị. Chuột phải để bỏ.', route: 'Bấm lên hải đồ để thêm điểm vào cuối tuyến đang chọn. Kéo một điểm để dời. Chuột phải vào điểm để xóa. Nhập tọa độ ở khung bên phải cũng được. Tuyến đang chọn hiện ở tab 3.' };
export function initChart() {
  $('#p-chart').innerHTML = `<div class="flex" style="align-items:flex-start">
  <div class="col" style="flex:1 1 260px;max-width:320px"><section class="card"><h2>Kho hải đồ (.kap)</h2><div class="muted" style="margin-bottom:8px">Nạp một lần, app lưu trên máy. Các tờ tự ghép liền nhau theo tọa độ, tờ tỷ lệ lớn nằm trên — kéo, phóng to thu nhỏ thoải mái như OpenCPN. Thêm thư mục: app quét cả thư mục con, lấy file .kap. Hải đồ PDF cần bấm vài điểm tọa độ khi nạp. File .rar / .zip cần giải nén trước.</div>
  <label class="btn" style="display:flex;align-items:center;justify-content:center;margin-bottom:6px">+ Thêm thư mục<input type="file" id="dirIn" webkitdirectory multiple hidden></label>
  <label class="btn" style="display:flex;align-items:center;justify-content:center;margin-bottom:6px">+ Thêm file .kap<input type="file" id="fileIn" accept=".kap,.KAP" multiple hidden></label>
  <label class="btn" style="display:flex;align-items:center;justify-content:center;margin-bottom:8px">+ Thêm hải đồ PDF…<input type="file" id="pdfIn" accept=".pdf,application/pdf" hidden></label>
  <div class="drop" id="dropZone">hoặc kéo thả file .kap / .pdf vào đây</div>
  <div class="fld" style="margin-top:10px"><label for="libQ">Tìm theo tên / số hải đồ</label><div class="in"><input id="libQ" placeholder="vd: 25-181 hoặc Van Hoa" autocomplete="off"><button class="btn sm" id="libQx" style="border:0;background:transparent" aria-label="Xóa ô tìm">✕</button></div></div>
  <div class="fld" style="margin-top:6px"><label for="libLL">Tìm theo tọa độ (tờ có chứa điểm này)</label><div class="in"><input id="libLL" placeholder="vd: 21°05'N 107°28'E" autocomplete="off"><button class="btn sm" id="libLLx" style="border:0;background:transparent" aria-label="Xóa tọa độ">✕</button></div></div>
  <div class="muted" id="libInfo" style="margin-top:6px"></div><div class="lib" id="chartLib" style="margin-top:6px;max-height:330px;overflow:auto"></div><div class="muted" style="margin-top:4px">Bấm vào tên tờ để đưa khung nhìn tới tờ đó.</div></section></div>
  <div class="col" style="flex:999 1 560px"><div id="chartStatus" class="note"></div><section class="card" style="padding:0;overflow:hidden"><div class="tool" style="padding:8px 8px 4px;background:#0E161C;border-bottom:1px solid #22303A;display:flex;flex-wrap:wrap;align-items:center"><span id="toolBtns"></span><span style="flex:1"></span><button class="btn sm" id="gratBtn" title="Lưới kinh vĩ độ tính từ tọa độ — so với lưới in trên hải đồ để kiểm tra">Lưới kinh vĩ</button><button class="btn sm" id="outBtn" title="Viền và tên các tờ đang hiện">Viền tờ</button><button class="btn sm" id="fitBtn">Xem toàn bộ</button></div><div style="position:relative"><canvas id="chartCv"></canvas><button class="shipBtn" id="chartHome" aria-label="Về vị trí tàu" title="Về vị trí tàu (hoặc vị trí xuất phát nếu chưa chạy bài)"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 2.5 L16.2 9 L16.2 20.5 L7.8 20.5 L7.8 9 Z" fill="currentColor" fill-opacity=".25" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="13" r="1.8" fill="currentColor"/></svg></button></div><div class="muted mono" id="chartPos" style="padding:6px 10px;background:#0E161C">—</div></section></div>
  <div class="col" style="flex:1 1 280px;max-width:340px"><div class="note" id="chartHint"></div><div class="col" id="chartSide"></div></div></div>`;
  cv = new ChartCanvas($('#chartCv'));
  cv.redraw = () => { if (!cv.inited) { if (!cv.size()[0]) return; initialView(); cv.inited = true; } const old = cv.ref; cv.draw(); drawOverlay(cv); drawStatus(); homeBtn(); if (old !== cv.ref) { drawSide(); drawLib(); } viewDepth(); };
  const tb = () => { $('#toolBtns').innerHTML = TOOLS.map((t) => `<button class="btn sm ${tool === t[0] ? 'pri' : ''}" data-tool="${t[0]}">${t[1]}</button>`).join(''); $('#chartHint').textContent = HINT[tool]; $('#gratBtn').classList.toggle('on', cv.opt.graticule); $('#outBtn').classList.toggle('on', cv.opt.outlines); };
  tb();
  $('#toolBtns').onclick = (e) => { const t = e.target.dataset.tool; if (t) { tool = t; draft = null; meas = null; clearSel(); tb(); drawChart(); drawSide(); } };
  $('#gratBtn').onclick = () => { cv.opt.graticule = !cv.opt.graticule; tb(); drawChart(); };
  $('#outBtn').onclick = () => { cv.opt.outlines = !cv.opt.outlines; tb(); drawChart(); };
  $('#chartHome').onclick = () => { const q = shipHere(); cv.centerM(q.x, q.y); if (cv.mPerPx() > 12) cv.setMpp(6); drawChart(); };
  $('#fitBtn').onclick = () => { if (A.W.hasCharts()) fitAll(); else { cv.centerM(startPos().x, startPos().y); cv.setMpp(20); } drawChart(); };
  const added = (n) => { if (!n) uiAlert('Không thấy file .kap nào.'); };
  $('#dirIn').onchange = async (e) => { const f = Array.from(e.target.files); e.target.value = ''; added(await addChartFiles(f)); };
  $('#fileIn').onchange = async (e) => { const f = Array.from(e.target.files); e.target.value = ''; await addChartFiles(f); };
  $('#pdfIn').onchange = (e) => { const f = Array.from(e.target.files); e.target.value = ''; if (f.length) openPdfChart(f); };
  const dz = $('#dropZone'); dz.ondragover = (e) => { e.preventDefault(); }; dz.ondrop = async (e) => { e.preventDefault(); const fs = Array.from(e.dataTransfer.files), pdf = fs.filter((f) => /\.pdf$/i.test(f.name)); if (pdf.length) openPdfChart(pdf); await addChartFiles(fs); };
  const goRec = (id) => { const r = CS.catalog.byId.get(id); if (r && r.ready) { cv.size(); cv.fitChart(r); drawChart(); } };
  $('#chartLib').onclick = async (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.del) { const r = CS.catalog.byId.get(b.dataset.del); if (r && await uiConfirm('Xóa tờ «' + r.name + '» khỏi kho? (file gốc trên máy không bị xóa)')) { await CS.catalog.remove(r.id); if (A.hooks.chartsChanged) A.hooks.chartsChanged(); } return; } goRec(b.dataset.id); };
  $('#libQ').oninput = (e) => { libQ = e.target.value; drawLib(); };
  $('#libQ').onkeydown = (e) => { if (e.key === 'Enter') { const b = $$('#chartLib button[data-id]:not([disabled])'); if (b.length) goRec(b[0].dataset.id); } };
  $('#libQx').onclick = () => { libQ = ''; $('#libQ').value = ''; drawLib(); };
  $('#libLL').oninput = (e) => { const v = parseLatLon(e.target.value); libLL = isFinite(v[0]) && isFinite(v[1]) ? v : null; drawLib(); };
  $('#libLL').onkeydown = (e) => { if (e.key === 'Enter' && libLL) { const [x, y] = toWorld(libLL[0], libLL[1]); cv.centerM(x, y); meas = [[x, y]]; drawChart(); } };
  $('#libLLx').onclick = () => { libLL = null; $('#libLL').value = ''; drawLib(); };
  CS.catalog.on((ev) => {
    if (ev.type === 'progress') libSoon();
    else if (ev.type === 'dm') { libSoon(); if (cv && cv.ref && cv.ref.id === ev.id) sideSoon(); }
    else { drawLib(); drawStatus(); }
    if (ev.type === 'dmodel' && A.hooks.chartsChanged) A.hooks.chartsChanged();
  });
  initDepthUI(() => { drawChart(); sideSoon(); });
  const c = $('#chartCv'); let drag = null, moved = false, dragShipO = null, dragAnch = null;
  const pos = (e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
  c.onpointerdown = (e) => { if (e.button === 2) return; drag = pos(e); moved = false; c.setPointerCapture(e.pointerId); dragAnch = tool === 'pan' || tool === 'ship' ? anchorAtPt(cv, drag) : null; dragShipO = !dragAnch && tool === 'pan' ? shipAt(cv, drag) : null; if (dragShipO) selObj = { t: 'ship', o: dragShipO }; if (dragAnch && !(selObj && selObj.o === dragAnch.sh)) { selObj = { t: 'ship', o: dragAnch.sh }; drawSide(); } dragWP = tool === 'route' ? nearWP(drag) : -1; dragBol = null; if (tool === 'bollard') { const q = nearBollard(drag); if (q) { const b = A.W.objs.berths[q.bi], arr = ensureBols(b, q.bi); let k = 0; arr.forEach((v, i) => { if (Math.abs(v - q.s) < Math.abs(arr[k] - q.s)) k = i; }); dragBol = { bi: q.bi, k }; selObj = { t: 'berth', o: b }; } } };
  c.onpointermove = (e) => {
    const p = pos(e), [mx, my] = cv.s2m(p[0], p[1]); posText(p, mx, my);
    if (drag && dragBol) { const b = A.W.objs.berths[dragBol.bi], a = A.W.alongBerth(dragBol.bi, mx, my); if (a) { b.bols[dragBol.k] = Math.max(0, Math.min(b._len || 0, a.s)); A.W.rebuild(); moved = true; drawChart(); } return; }
    if (drag && dragAnch) { if (moved || Math.hypot(p[0] - drag[0], p[1] - drag[1]) > 3) { moved = true; dragAnchor(dragAnch, mx, my); drawChart(); } return; }
    if (drag && dragShipO) { if (moved || Math.hypot(p[0] - drag[0], p[1] - drag[1]) > 4) { moved = true; dragShip(dragShipO, mx, my); drawChart(); } return; }
    if (drag && dragWP >= 0) { const r = selRoute(); if (r && r.pts[dragWP]) { r.pts[dragWP] = [mx, my]; moved = true; drawChart(); } return; }
    if (drag && (tool === 'pan' || e.buttons === 4 || moved)) { const dx = p[0] - drag[0], dy = p[1] - drag[1]; if (Math.abs(dx) + Math.abs(dy) > 3 || moved) { moved = true; cv.panPx(dx, dy); drag = p; drawChart(); } }
    else if (drag && Math.hypot(p[0] - drag[0], p[1] - drag[1]) > 6) { moved = true; }
  };
  c.onpointerup = (e) => { const p = pos(e); if (dragAnch) { const was = moved; dragAnch = null; drag = null; if (was) objsChanged(); else { drawChart(); drawSide(); } return; } if (dragShipO) { const o = dragShipO, was = moved; dragShipO = null; drag = null; if (was) dropShip(o); objsChanged(); return; } if (dragBol) { const was = moved, b = A.W.objs.berths[dragBol.bi]; dragBol = null; drag = null; if (was) { if (Array.isArray(b.bols)) b.bols.sort((p, q) => p - q); objsChanged(); return; } }
    if (dragWP >= 0 && moved) { dragWP = -1; drag = null; objsChanged(); return; } dragWP = -1; if (drag && !moved) clickChart(p, e.detail >= 2, e.shiftKey); drag = null; };
  c.ondblclick = () => { if (tool === 'berth' && draft && draft.length >= 2) { A.W.objs.berths.push({ name: 'Bến ' + (A.W.objs.berths.length + 1), pts: draft, depth: 8, top: 4.5, spacing: 25 }); selObj = { t: 'berth', o: A.W.objs.berths[A.W.objs.berths.length - 1] }; draft = null; objsChanged(); } };
  c.oncontextmenu = (e) => {
    e.preventDefault(); const p = pos(e), W = A.W, near = (ox, oy) => { const q = cv.m2s(ox, oy); return Math.hypot(q[0] - p[0], q[1] - p[1]); };
    if (draft && draft.length) { draft.pop(); if (!draft.length) draft = null; drawChart(); return; }
    if (meas) { meas = null; drawChart(); return; }
    if (tool === 'depth') { if (depthRightClick(cv, p)) { drawChart(); drawSide(); } return; }
    const wi = nearWP(p); if (wi >= 0) { selRoute().pts.splice(wi, 1); objsChanged(); return; }
    if (tool === 'bollard') { const q = nearBollard(p); if (q) { const b = W.objs.berths[q.bi], arr = ensureBols(b, q.bi); let k = 0; arr.forEach((v, i) => { if (Math.abs(v - q.s) < Math.abs(arr[k] - q.s)) k = i; }); arr.splice(k, 1); selObj = { t: 'berth', o: b }; objsChanged(); } return; }
    { const ah = anchorAtPt(cv, p); if (ah) { deleteAnchor(ah); selObj = { t: 'ship', o: ah.sh }; objsChanged(); return; } }
    { const sh = shipAt(cv, p); if (sh) { uiConfirm('Xóa tàu đậu «' + sh.name + '»?', { ok: 'Xóa', danger: true }).then((ok) => { if (ok) { deleteShip(sh); selObj = null; objsChanged(); } }); return; } }
    let best = null, bd = 16;
    for (const o of W.objs.lights) { const d = near(o.x, o.y); if (d < bd) { bd = d; best = [W.objs.lights, o]; } }
    for (const o of W.objs.berths) for (let i = 0; i + 1 < o.pts.length; i++) for (let t = 0; t <= 1; t += 0.05) { const d = near(o.pts[i][0] + (o.pts[i + 1][0] - o.pts[i][0]) * t, o.pts[i][1] + (o.pts[i + 1][1] - o.pts[i][1]) * t); if (d < bd) { bd = d; best = [W.objs.berths, o]; } }
    if (best) { best[0].splice(best[0].indexOf(best[1]), 1); selObj = null; objsChanged(); }
  };
  c.onwheel = (e) => { e.preventDefault(); const p = pos(e); cv.zoomAt(p[0], p[1], e.deltaY > 0 ? 0.8 : 1.25); drawChart(); };
  const shipEdit = (e) => { if (mooredEdit(e, selObj && selObj.t === 'ship' ? selObj.o : null)) { objsChanged(); return true; } return false; };
  $('#chartSide').addEventListener('change', (e) => {
    if (/^ms/.test(e.target.id || '') && ['msType', 'msName', 'msMode'].includes(e.target.id)) return;
    if (shipEdit(e)) return;
    const t = e.target, o = A.W.objs, r = selRoute(), cr = cv && cv.ref;
    if (t.id === 'rtSel') { o.routeSel = +t.value; objsChanged(); return; }
    if (t.dataset.bol !== undefined && selObj && selObj.t === 'berth') { const b = selObj.o, bi = o.berths.indexOf(b), arr = ensureBols(b, bi), v = num(t.value, NaN); if (isFinite(v)) { arr[+t.dataset.bol] = Math.max(0, Math.min(b._len || v, v)); arr.sort((p, q) => p - q); objsChanged(); } return; }
    if (t.id === 'rtName' && r) { r.name = t.value.trim() || r.name; objsChanged(); return; }
    if ((t.dataset.wl || t.dataset.wn) && r) {
      const i = +(t.dataset.wl || t.dataset.wn), la = parseCoord($(`[data-wl="${i}"]`).value, true), lo = parseCoord($(`[data-wn="${i}"]`).value, false);
      if (isFinite(la) && isFinite(lo)) { r.pts[i] = toWorld(la, lo); objsChanged(); } else { t.style.borderColor = '#FF6B6B'; }
      return;
    }
    const k = e.target.dataset.k; if (!k) return; const v = e.target.value;
    if (k.startsWith('cd') && cr) { const cd = (cr.classDepth || DEF_CLASS_DEPTH).slice(); cd[+k[2]] = num(v, cd[+k[2]]); CS.catalog.setClassDepth(cr, cd).then(() => { if (A.hooks.depthChanged) A.hooks.depthChanged(); }); drawSide(); return; }
    if ((k === 'dsUser' || k === 'offE' || k === 'offN') && cr) { const off = (cr.offsetM || [0, 0]).slice(); if (k === 'offE') off[0] = num(v, 0); if (k === 'offN') off[1] = num(v, 0); const ch = { offsetM: off }; if (k === 'dsUser') ch.datumUser = v || undefined; CS.catalog.update(cr, ch).then(() => { drawChart(); drawSide(); drawLib(); if (A.hooks.depthChanged) A.hooks.depthChanged(); }); return; }
    if (!selObj) return; const key = k.slice(2);
    selObj.o[key] = e.target.dataset.t || e.target.tagName === 'SELECT' ? v : num(v, 0);
    if (key === 'kind') selObj.o.color = /R$/.test(v) ? 'R' : /G$/.test(v) ? 'G' : v === 'buoyY' ? 'Y' : selObj.o.color;
    objsChanged();
  });
  $('#chartSide').addEventListener('click', (e) => {
    if (e.target.id === 'msDel' && selObj && selObj.t === 'ship') { deleteShip(selObj.o); selObj = null; objsChanged(); return; }
    if (shipEdit(e)) return;
    const t = e.target.closest('button'); if (!t) return; const o = A.W.objs, r = selRoute();
    if ((t.id === 'bolAdd' || t.id === 'bolReset') && selObj && selObj.t === 'berth') { const b = selObj.o, bi = o.berths.indexOf(b); if (t.id === 'bolReset') delete b.bols; else { const arr = ensureBols(b, bi); let gs = 0, gi = 0; const pts2 = [0, ...arr, b._len || 0]; for (let i = 0; i + 1 < pts2.length; i++) if (pts2[i + 1] - pts2[i] > gs) { gs = pts2[i + 1] - pts2[i]; gi = i; } arr.push((pts2[gi] + pts2[gi + 1]) / 2); arr.sort((p, q) => p - q); } objsChanged(); return; }
    if (t.id === 'toStart' && A.hooks.resetToStart) { A.hooks.resetToStart(true); drawChart(); drawSide(); return; }
    if (t.id === 'rtNew') { o.routes = o.routes || []; o.routes.push({ name: 'Tuyến ' + (o.routes.length + 1), pts: [] }); o.routeSel = o.routes.length - 1; objsChanged(); return; }
    if (t.id === 'rtDel' && r) { uiConfirm('Xóa tuyến «' + r.name + '»?', { ok: 'Xóa', danger: true }).then((ok) => { if (ok) { o.routes.splice(o.routeSel, 1); o.routeSel = o.routes.length ? 0 : -1; objsChanged(); } }); return; }
    if (t.dataset.wdel !== undefined && r) { r.pts.splice(+t.dataset.wdel, 1); objsChanged(); return; }
    if (t.id === 'rtAdd') {
      const la = parseCoord($('#rtLat').value, true), lo = parseCoord($('#rtLon').value, false);
      if (!isFinite(la) || !isFinite(lo)) { $('#rtErr').textContent = 'Không đọc được tọa độ — kiểm tra lại vĩ độ / kinh độ.'; $('#rtErr').style.color = '#FF8A8A'; return; }
      let rr = r; if (!rr) { o.routes = o.routes || []; o.routes.push({ name: 'Tuyến ' + (o.routes.length + 1), pts: [] }); o.routeSel = o.routes.length - 1; rr = selRoute(); }
      rr.pts.push(toWorld(la, lo)); objsChanged(); return;
    }
  });
  $('#chartSide').addEventListener('click', (e) => {
    if (e.target.id === 'objExp') fleetForFile().then((fleet) => { const a = document.createElement('a'), d = new Date(), F = placesFile(A.W); if (fleet.length) F.fleet = fleet; a.href = URL.createObjectURL(new Blob([JSON.stringify(F, null, 1)], { type: 'application/json' })); a.download = 'doi-tuong-hai-do-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); });
  });
  $('#chartSide').addEventListener('change', async (e) => {
    if (e.target.id !== 'objImp' || !e.target.files.length) return; const f = e.target.files[0]; e.target.value = '';
    try { const F = JSON.parse(await f.text()); if (F && F.loai === 'doi-tuong-hai-do') await fleetFromFile(F); const n = mergePlacesFile(A.W, F); selObj = null; objsChanged(); uiAlert(`Đã mở ${f.name}: ${n.lights} đèn / phao / tiêu, ${n.berths} cầu bến, ${n.routes} tuyến đi, ${n.starts} vị trí xuất phát có sẵn, ${n.ships} tàu đậu.`); }
    catch (err) { uiAlert('Không mở được file: ' + err.message); }
  });
  $('#chartSide').addEventListener('click', (e) => { if (e.target.id === 'oDel' && selObj) { const arr = selObj.t === 'light' ? A.W.objs.lights : selObj.t === 'berth' ? A.W.objs.berths : A.W.objs.sounds; arr.splice(arr.indexOf(selObj.o), 1); selObj = null; objsChanged(); } });
  drawLib(); drawSide(); drawStatus();
}
// tọa độ, độ sâu dưới con trỏ
function posText(p, mx, my) {
  const ll = toLL(mx, my), r = A.W.chartAt(mx, my);
  if (!r) { const m = llToMerc(ll[0], ll[1]), q = CS.catalog.records.filter((c) => c.ready && c.plyMerc && inside(m[0], m[1], c.plyMerc)).sort((a, b) => a.mppMerc - b.mppMerc)[0]; if (q) CS.provider.load(q); }
  $('#chartPos').textContent = fmtLL(ll[0], ll[1]) + ' · ' + (r ? 'độ sâu hải đồ ' + A.W.depthAt(mx, my).toFixed(1) + ' m · ' + r.name : 'ngoài vùng hải đồ') + ' · ' + fmtM(cv.mPerPx()) + ' m/điểm' + (meas && meas.length === 1 ? ' · đo: ' + fmtDist(Math.hypot(mx - meas[0][0], my - meas[0][1])) : '');
}
// nạp lưới độ sâu cho vùng đang xem (để đọc độ sâu dưới con trỏ, đặt vị trí xuất phát)
let vdT = 0;
function viewDepth() { if (vdT) return; vdT = setTimeout(() => { vdT = 0; if (!cv) return; const [w, h] = cv.size(), r = Math.max(w, h) * cv.mPerPx() * 0.75; if (r < 60000) ensureAround(cv.cx, cv.cy, r); else if (cv.ref) CS.provider.load(cv.ref); }, 400); }
function bolList(b) {
  const bi = A.W.objs.berths.indexOf(b), bl = A.W.bollards.filter((q) => q.bi === bi);
  return `<div class="lbl" style="margin-top:8px">Cọc bích — khoảng cách tính từ đầu bến (m)${Array.isArray(b.bols) ? ' · đã chỉnh tay' : ' · đang đặt cách đều'}</div>
    <div class="grid g4" style="gap:4px;margin-top:4px">${bl.map((q, k) => `<label style="display:flex;flex-direction:column;font-size:10.5px;color:#8FA3B0">B${q.n}<input class="cell mono" data-bol="${k}" value="${q.s.toFixed(1)}" style="height:24px;font-size:11.5px"></label>`).join('')}</div>
    <div class="flex" style="gap:6px;margin-top:6px"><button class="btn sm" id="bolAdd">+ Thêm cọc</button>${Array.isArray(b.bols) ? '<button class="btn sm" id="bolReset">Đặt lại cách đều</button>' : ''}</div>
    <div class="muted" style="margin-top:4px">Dùng công cụ «Cọc bích» để kéo cọc dọc mép cầu, bấm lên mép cầu để thêm, chuột phải để xóa.</div>`;
}
const ensureBols = (b, bi) => { if (!Array.isArray(b.bols)) b.bols = A.W.autoBols(bi); b.bols.sort((p, q) => p - q); return b.bols; };
function nearBollard(p) { let best = null, bd = 13; for (const q of A.W.bollards) { if (q.bi < 0) continue; const s2 = cv.m2s(q.x, q.y), d = Math.hypot(s2[0] - p[0], s2[1] - p[1]); if (d < bd) { bd = d; best = q; } } return best; }
function routeCard() {
  const o = A.W.objs, rs = o.routes || [], r = selRoute();
  const ll = r ? r.pts.map((q) => toLL(q[0], q[1])) : [], lg = legsLL(ll);
  const rows = r ? r.pts.map((q, i) => { const [la, lo] = ll[i], l = lg[i - 1]; return `<tr><td class="mono" style="vertical-align:top;padding-top:7px">${i + 1}</td><td><input class="cell mono" data-wl="${i}" value="${esc(fmtLat(la))}" aria-label="Vĩ độ điểm ${i + 1}" style="height:24px;font-size:11.5px"><input class="cell mono" data-wn="${i}" value="${esc(fmtLon(lo))}" aria-label="Kinh độ điểm ${i + 1}" style="height:24px;font-size:11.5px;margin-top:2px"></td><td class="mono" style="font-size:11.5px;white-space:nowrap">${l ? p3(l.crs) + '°<br>' + fmtDist(l.len) : '<span class="muted">xuất phát</span>'}</td><td><button class="btn sm" data-wdel="${i}" aria-label="Xóa điểm ${i + 1}" style="padding:0 7px">✕</button></td></tr>`; }).join('') : '';
  return `<section class="card"><h2>Tuyến đi</h2>
    <div class="flex" style="gap:6px;flex-wrap:nowrap"><div class="fld" style="flex:1;min-width:0"><div class="in"><select id="rtSel" aria-label="Chọn tuyến">${rs.length ? rs.map((q, i) => `<option value="${i}" ${i === o.routeSel ? 'selected' : ''}>${esc(q.name)}</option>`).join('') : '<option value="-1">(chưa có tuyến)</option>'}</select></div></div><button class="btn sm" id="rtNew">+ Tuyến mới</button></div>
    ${r ? `<div class="flex" style="gap:6px;flex-wrap:nowrap;margin-top:6px"><div class="fld" style="flex:1;min-width:0"><div class="in"><input id="rtName" value="${esc(r.name)}" aria-label="Tên tuyến"></div></div><button class="btn sm warn" id="rtDel">Xóa tuyến</button></div>
    <table style="margin-top:6px"><thead><tr><th>#</th><th>Vĩ độ / Kinh độ</th><th>Hướng · Q.đường</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">Bấm lên hải đồ hoặc nhập tọa độ bên dưới để thêm điểm.</td></tr>'}</tbody></table>
    <div class="kv" style="margin-top:4px"><span>Tổng quãng đường</span><b>${lg.length ? fmtDist(lg[lg.length - 1].tot) : '—'} · ${r.pts.length} điểm</b></div>` : ''}
    <div class="lbl" style="margin-top:8px">Thêm điểm theo tọa độ</div>
    <div class="grid g2" style="gap:5px;margin-top:3px"><input class="cell mono" id="rtLat" placeholder="21°05,123'N" aria-label="Vĩ độ điểm mới"><input class="cell mono" id="rtLon" placeholder="107°28,456'E" aria-label="Kinh độ điểm mới"></div>
    <button class="btn sm pri" id="rtAdd" style="margin-top:6px;width:100%">Thêm điểm vào cuối tuyến</button>
    <div class="muted" id="rtErr" style="margin-top:4px">Gõ được: 21°05,123'N · 21 05.123 N · 21.0852</div></section>`;
}
function objsChanged() { A.W.rebuild(); saveObjs(); drawChart(); drawSide(); if (A.hooks.objsChanged) A.hooks.objsChanged(); }
function clickChart(p, dbl, shift) {
  const W = A.W, [x, y] = cv.s2m(p[0], p[1]), near = (ox, oy) => { const s = cv.m2s(ox, oy); return Math.hypot(s[0] - p[0], s[1] - p[1]); };
  if (tool === 'depth') { depthClick(cv, p, x, y, shift).then(() => { drawChart(); drawSide(); }); return; }
  if (tool === 'light') { const o = { x, y, kind: 'light', name: 'Đèn ' + (W.objs.lights.length + 1), color: 'W', period: 3, flash: 0.5, height: 9 }; W.objs.lights.push(o); selObj = { t: 'light', o }; objsChanged(); }
  else if (tool === 'berth') { if (dbl) return; (draft = draft || []).push([x, y]); drawChart(); }
  else if (tool === 'sound') { uiPrompt('Độ sâu tại điểm này (m, so với số 0 hải đồ):', '8').then((v) => { if (v !== null && isFinite(num(v, NaN))) { const o = { x, y, d: num(v, 0) }; W.objs.sounds.push(o); selObj = { t: 'sound', o }; objsChanged(); } }); }
  else if (tool === 'bollard') { let bb = -1, bs = 0, bd = 1e9; W.objs.berths.forEach((b, bi) => { const a = W.alongBerth(bi, x, y); if (a && a.d < bd) { bd = a.d; bb = bi; bs = a.s; } }); if (bb >= 0 && bd / cv.mPerPx() < 20) { const b = W.objs.berths[bb]; ensureBols(b, bb).push(bs); b.bols.sort((p, q) => p - q); selObj = { t: 'berth', o: b }; objsChanged(); } }
  else if (tool === 'route') { let r = selRoute(); if (!r) { W.objs.routes = W.objs.routes || []; W.objs.routes.push({ name: 'Tuyến ' + (W.objs.routes.length + 1), pts: [] }); W.objs.routeSel = W.objs.routes.length - 1; r = selRoute(); } r.pts.push([x, y]); objsChanged(); }
  else if (tool === 'start') { W.start = { x, y, hdg: num(startPos().hdg, 0) }; saveObjs(); if (A.sim && A.sim.t < 2 && A.hooks.resetToStart) A.hooks.resetToStart(false); drawChart(); drawSide(); if (A.hooks.envChanged) A.hooks.envChanged(); }
  else if (tool === 'measure') { if (!meas || meas.length === 2) meas = [[x, y]]; else meas.push([x, y]); drawChart(); }
  else if (tool === 'ship') { const hit = shipAt(cv, p); if (hit && $('#msMode') && $('#msMode').value !== 'along') { selObj = { t: 'ship', o: hit }; drawChart(); drawSide(); return; } placeNew(x, y).then((sh) => { if (sh) { selObj = { t: 'ship', o: sh }; objsChanged(); } }); }
  else {
    let best = null, bd = 14;
    for (const o of W.objs.lights) { const d = near(o.x, o.y); if (d < bd) { bd = d; best = { t: 'light', o }; } }
    for (const o of W.objs.berths) for (const q of o.pts) { const d = near(q[0], q[1]); if (d < bd) { bd = d; best = { t: 'berth', o }; } }
    if (!best) { const sh = shipAt(cv, p); if (sh) best = { t: 'ship', o: sh }; }
    selObj = best; drawChart(); drawSide();
  }
}
// vẽ các đối tượng lên một ChartView bất kỳ
export function drawOverlay(v, opt) {
  const g = v.ctx, W = A.W; g.save(); g.lineJoin = 'round';
  if (!opt && tool === 'depth') drawDepthPts(v, g);
  for (const b of W.objs.berths) { g.strokeStyle = '#FFB300'; g.lineWidth = selObj && selObj.o === b && !opt ? 6 : 4; g.beginPath(); b.pts.forEach((q, i) => { const s = v.m2s(q[0], q[1]); if (i) g.lineTo(s[0], s[1]); else g.moveTo(s[0], s[1]); }); g.stroke(); }
  drawMoored(v, g, !opt && selObj && selObj.t === 'ship' ? selObj.o : null);
  const bt = !opt && tool === 'bollard';
  if (v.mPerPx() < 3 || bt) { g.fillStyle = '#3A2A00'; g.strokeStyle = '#fff'; g.lineWidth = 1; g.font = 'bold 10px Segoe UI'; for (const b of W.bollards) { if (b.bi < 0) continue; const s = v.m2s(b.x, b.y); g.fillStyle = '#3A2A00'; g.beginPath(); g.arc(s[0], s[1], bt ? 4.5 : 3, 0, 7); g.fill(); g.stroke(); if ((bt && v.mPerPx() < 1.6) || v.mPerPx() < 0.8) { g.fillStyle = '#3A2A00'; g.fillText('B' + b.n, s[0] + 6, s[1] - 5); } } }
  if (!opt) for (const b of W.objs.berths) if (bt || (selObj && selObj.o === b)) { const s = v.m2s(b.pts[0][0], b.pts[0][1]); g.fillStyle = '#E65100'; g.font = 'bold 11px Segoe UI'; g.beginPath(); g.arc(s[0], s[1], 4, 0, 7); g.fill(); g.fillText('Đầu bến', s[0] + 6, s[1] + 14); }
  const LC = { W: '#ffffff', R: '#e53935', G: '#2e9e55', Y: '#ffd600' };
  for (const o of W.objs.lights) { const s = v.m2s(o.x, o.y); g.fillStyle = LC[o.color] || '#fff'; g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath(); if (o.kind === 'light') { g.arc(s[0], s[1], 6, 0, 7); } else if (/^beacon/.test(o.kind)) { g.moveTo(s[0], s[1] - 7); g.lineTo(s[0] + 6, s[1] + 5); g.lineTo(s[0] - 6, s[1] + 5); g.closePath(); } else { g.rect(s[0] - 5, s[1] - 5, 10, 10); } g.fill(); g.stroke(); if (!opt && selObj && selObj.o === o) { g.strokeStyle = '#00B8D4'; g.setLineDash([4, 3]); g.beginPath(); g.arc(s[0], s[1], 13, 0, 7); g.stroke(); g.setLineDash([]); } if (!opt || v.mPerPx() < 6) { g.font = '11px Segoe UI'; g.fillStyle = '#111'; g.fillText(o.name || '', s[0] + 9, s[1] - 7); } }
  if (!opt && W.objs.routes) {
    W.objs.routes.forEach((r, ri) => {
      const on = ri === W.objs.routeSel; if (!r.pts.length) return;
      g.strokeStyle = on ? '#C2185B' : 'rgba(194,24,91,.35)'; g.lineWidth = on ? 2.5 : 1.5; g.setLineDash(on ? [] : [6, 4]); g.beginPath(); r.pts.forEach((q, i) => { const s2 = v.m2s(q[0], q[1]); if (i) g.lineTo(s2[0], s2[1]); else g.moveTo(s2[0], s2[1]); }); g.stroke(); g.setLineDash([]);
      if (on) { g.font = 'bold 11px Segoe UI'; r.pts.forEach((q, i) => { const s2 = v.m2s(q[0], q[1]); g.fillStyle = '#fff'; g.strokeStyle = '#C2185B'; g.lineWidth = 2; g.beginPath(); g.arc(s2[0], s2[1], 5.5, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#880E4F'; g.fillText(String(i + 1), s2[0] + 8, s2[1] - 6); }); }
    });
  }
  if (!opt) {
    if (draft) { g.strokeStyle = '#FF6D00'; g.lineWidth = 3; g.setLineDash([6, 4]); g.beginPath(); draft.forEach((q, i) => { const s = v.m2s(q[0], q[1]); if (i) g.lineTo(s[0], s[1]); else g.moveTo(s[0], s[1]); }); g.stroke(); g.setLineDash([]); draft.forEach((q) => { const s = v.m2s(q[0], q[1]); g.fillStyle = '#FF6D00'; g.beginPath(); g.arc(s[0], s[1], 4, 0, 7); g.fill(); }); }
    if (meas) { g.strokeStyle = '#D81B60'; g.fillStyle = '#D81B60'; g.lineWidth = 2; g.beginPath(); meas.forEach((q, i) => { const s = v.m2s(q[0], q[1]); if (i) g.lineTo(s[0], s[1]); else g.moveTo(s[0], s[1]); g.fillRect(s[0] - 3, s[1] - 3, 6, 6); }); g.stroke(); if (meas.length === 2) { const dx = meas[1][0] - meas[0][0], dy = meas[1][1] - meas[0][1], s = v.m2s(meas[1][0], meas[1][1]), t = fmtDist(Math.hypot(dx, dy)) + ' · ' + pad3(Math.atan2(dx, dy) * 180 / Math.PI) + '°'; g.font = 'bold 13px Segoe UI'; g.fillStyle = '#fff'; g.fillRect(s[0] + 8, s[1] - 16, g.measureText(t).width + 8, 20); g.fillStyle = '#AD1457'; g.fillText(t, s[0] + 12, s[1] - 2); } }
    if (A.sim && A.M) { const S = A.sim.S, st0 = startPos(); if (A.sim.t > 0.5 || Math.hypot(S.x - st0.x, S.y - st0.y) > 5) { const k = Math.max(1, 16 / (A.M.loa / v.mPerPx())), L = A.M.loa * k, B = A.M.B * k, sn = Math.sin(S.psi), cs = Math.cos(S.psi); const P = [[L / 2, 0], [L * 0.3, B / 2], [-L / 2, B / 2], [-L / 2, -B / 2], [L * 0.3, -B / 2]].map((q) => v.m2s(S.x + q[0] * sn + q[1] * cs, S.y + q[0] * cs - q[1] * sn)); g.fillStyle = 'rgba(0,150,136,.45)'; g.strokeStyle = '#00695C'; g.lineWidth = 2; g.beginPath(); P.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill(); g.stroke(); g.font = 'bold 11px Segoe UI'; g.fillStyle = '#00695C'; const c0 = v.m2s(S.x, S.y); g.fillText('Tàu (đang ở đây)', c0[0] + 12, c0[1] + 16); } }
    const sp = startPos(), s = v.m2s(sp.x, sp.y), a = num(sp.hdg, 0) * Math.PI / 180; g.strokeStyle = '#0D47A1'; g.fillStyle = 'rgba(13,71,161,.25)'; g.lineWidth = 2; g.beginPath(); g.arc(s[0], s[1], 9, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(s[0] + Math.sin(a) * 26, s[1] - Math.cos(a) * 26); g.stroke(); g.font = 'bold 11px Segoe UI'; g.fillStyle = '#0D47A1'; g.fillText('Xuất phát', s[0] + 12, s[1] + 4);
  }
  g.restore();
}
// vẽ lại ở khung hình kế tiếp (vòng lặp chính gọi cv.redraw khi cv.dirty)
export function drawChart() { if (cv) cv.dirty = true; }
// vị trí tàu cho nút «Về tàu»: đang có bài thì lấy tàu, không thì vị trí xuất phát
function shipHere() { return A.sim && A.sim.S ? { x: A.sim.S.x, y: A.sim.S.y } : startPos(); }
// nút sáng màu cam khi tàu đã ra ngoài khung nhìn (giống hải đồ nhỏ tab 3)
function homeBtn() { const b = $('#chartHome'); if (!b) return; const q = shipHere(), s = cv.m2s(q.x, q.y), [w, h] = cv.size(); b.classList.toggle('off', !(s[0] > 0 && s[1] > 0 && s[0] < w && s[1] < h)); }

// ---------------- Tab 4: môi trường & kịch bản ----------------
export function initEnv() {
  const e = A.env, sp = startPos(), W = A.W, rnd = e.wxMode === 'random', FS = 'border:0;padding:0;margin:0;min-width:0;';
  const stepsO = [['f4', 'Tiến max'], ['f3', 'Tiến 3'], ['f2', 'Tiến 2'], ['f1', 'Tiến 1'], ['st', 'Dừng máy']];
  $('#p-env').innerHTML = `<div class="flex" style="align-items:flex-start">
  <section class="card" style="flex:1 1 280px;max-width:340px"><h2>Kịch bản bài tập</h2><div class="col" style="gap:8px">${fld('name', 'Tên bài tập', '', e.name, 'data-t="1"')}${fld('startTime', 'Giờ bắt đầu (giờ:phút)', '', e.startTime, 'data-t="1"')}
  <div class="fld"><span class="lbl">Vị trí xuất phát</span><div class="mono" style="padding:7px 8px;border:1px solid #33444F;border-radius:6px;background:#0D151A">${W.start ? fmtLL(...toLL(sp.x, sp.y)) + (W.chartAt(sp.x, sp.y) ? '' : ' (ngoài vùng hải đồ)') : W.hasCharts() ? 'Chưa chọn' : 'Biển trống (chưa nạp hải đồ)'}</div></div>
  <button class="btn sm" id="pickStart">Chọn vị trí trên hải đồ (tab 2)</button>
  ${(W.objs.starts || []).length ? sel('startPre', 'Vị trí có sẵn', [['', '— chọn để dùng —'], ...W.objs.starts.map((q, i) => [String(i), q.name])], '') : ''}
  <div class="flex" style="gap:6px;align-items:flex-end">${fld('startName', 'Lưu vị trí đang chọn với tên', '', '', 'data-t="1" placeholder="vd. Ngoài phao số 0"')}<button class="btn sm" id="saveStart" ${W.start ? '' : 'disabled'}>Lưu</button></div>
  ${fld('startHdg', 'Hướng ban đầu', '°', num(sp.hdg, 0))}${fld('startKn', 'Tốc độ ban đầu', 'hl/h', e.startKn)}${sel('startStep', 'Máy ban đầu', stepsO, e.startStep)}
  <button class="btn pri" id="goBtn" style="min-height:42px">Bắt đầu bài tập →</button><div class="muted">Bắt đầu bài mới sẽ lưu bài đang chạy vào tab Xem lại.</div></div></section>
  <section class="card" style="flex:999 1 520px"><h2>Thủy triều — độ cao từng giờ (m, so với số 0 hải đồ)</h2>
  <div class="grid" style="grid-template-columns:repeat(12,minmax(0,1fr));gap:5px">${e.tide.map((v, i) => `<div><div class="muted mono" style="font-size:10px">${String(i).padStart(2, '0')}h</div><input class="cell mono" data-tide="${i}" value="${v}" aria-label="Độ cao triều lúc ${i} giờ"></div>`).join('')}</div>
  <div class="flex" style="margin-top:10px;align-items:flex-end;gap:8px"><div class="muted" style="flex:1 1 100%">Hoặc nhập nước lớn / nước ròng để app tự điền 24 giờ:</div>${fld('hwT', 'Giờ nước lớn', 'h', 15.5)}${fld('hwH', 'Cao nước lớn', 'm', 3.4)}${fld('lwT', 'Giờ nước ròng', 'h', 3)}${fld('lwH', 'Cao nước ròng', 'm', 0.5)}<button class="btn sm" id="tideGen">Điền bảng</button></div>
  <canvas id="tideCv" style="width:100%;height:170px;margin-top:10px;display:block"></canvas>
  <div class="muted" style="margin-top:6px">Bản đầu: nhập số bằng tay (gõ hoặc dán). Tự đọc bảng thủy triều từ ảnh / PDF sẽ có ở bản sau.</div></section>
  <div class="col" style="flex:1 1 280px;max-width:340px"><section class="card"><h2>Thời tiết</h2><div class="seg" id="wxSeg" style="display:flex">${[['manual', 'Tự chỉnh'], ['random', 'Ngẫu nhiên']].map((o) => `<button data-wx="${o[0]}" class="${(e.wxMode || 'manual') === o[0] ? 'on' : ''}" style="flex:1">${o[1]}</button>`).join('')}</div>
  ${rnd ? `<div style="margin-top:8px">${sel('wxStart', 'Bắt đầu với', [['', 'Tùy app'], ['nang', 'Nắng'], ['may', 'Nhiều mây'], ['mua', 'Mưa'], ['giong', 'Mưa giông'], ['suong', 'Sương mù']], e.wxStart || '')}</div><div class="muted" style="margin-top:6px">App tự đổi gió, sóng, mưa, tầm nhìn trong lúc chạy bài: nắng có thể chuyển mây, mưa, giông bão; sáng sớm hay có sương mù, chiều hay có giông. Ngày / đêm vẫn theo đúng giờ. Thời tiết đang có hiện ở tab 3.</div>` : '<div class="muted" style="margin-top:6px">Tự nhập gió, sóng, tầm nhìn ở dưới. Chọn «Ngẫu nhiên» để app tự lo thời tiết, đổi dần theo thời gian chạy bài.</div>'}
  <div class="lbl" style="margin-top:10px">Ánh sáng</div><div class="seg" id="lightSeg" style="display:flex;margin-top:4px">${[['auto', 'Theo giờ'], ['day', 'Ngày'], ['dusk', 'Hoàng hôn'], ['night', 'Đêm']].map((o) => `<button data-light="${o[0]}" class="${(e.light || 'auto') === o[0] ? 'on' : ''}" style="flex:1">${o[1]}</button>`).join('')}</div>
  <button class="btn sm ${e.fogOn ? 'on' : ''}" id="fogBtn" style="width:100%;margin-top:8px">Sương mù dày (tầm nhìn 0,3 Hl): ${e.fogOn ? 'ĐANG BẬT' : 'tắt'}</button>
  <div class="muted" style="margin-top:6px">«Theo giờ»: sáng tối theo đồng hồ bài tập. Chọn Ngày / Hoàng hôn / Đêm để xem thử nhanh, không đổi giờ. Hai nút này áp dụng ngay cả khi đang chạy bài.</div></section>
  <fieldset ${rnd ? 'disabled' : ''} style="${FS}${rnd ? 'opacity:.45' : ''}"><section class="card"><h2>Gió</h2><div class="grid g3">${fld('windDir', 'Hướng (từ)', '°', e.windDir)}${fld('windKn', 'Tốc độ', 'hl/h', e.windKn)}${fld('gustKn', 'Giật', 'hl/h', e.gustKn)}</div><label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="windVary" ${e.windVary ? 'checked' : ''} style="width:17px;height:17px"> Gió giật và đổi hướng nhẹ theo thời gian</label></section>
  </fieldset>
  <section class="card"><h2>Dòng chảy (theo con nước)</h2><div class="grid g2">${fld('floodDir', 'Triều lên: chảy về', '°', e.floodDir)}${fld('floodKn', 'Mạnh nhất', 'hl/h', e.floodKn)}${fld('ebbDir', 'Triều rút: chảy về', '°', e.ebbDir)}${fld('ebbKn', 'Mạnh nhất', 'hl/h', e.ebbKn)}</div><div class="muted" style="margin-top:6px">Tốc độ dòng tự đổi theo bảng triều: mạnh nhất giữa con nước, bằng 0 lúc nước đứng. Bản đầu dùng chung một dòng chảy cho cả vùng.</div></section>
  <fieldset ${rnd ? 'disabled' : ''} style="${FS}${rnd ? 'opacity:.45' : ''}"><section class="card"><h2>Sóng & tầm nhìn</h2><div class="grid g2">${fld('waveH', 'Độ cao sóng', 'm', e.waveH)}${fld('waveDir', 'Hướng sóng (từ)', '°', e.waveDir)}${fld('waveL', 'Bước sóng', 'm', Math.round(envWaveL(e)))}${fld('visNm', 'Tầm nhìn', 'Hl', e.visNm)}</div><div class="muted" style="margin-top:6px">Bước sóng ${Math.round(envWaveL(e))} m → chu kỳ ≈ ${Math.sqrt(2 * Math.PI * envWaveL(e) / 9.81).toFixed(1).replace('.', ',')} s (sóng nước sâu). Sóng gió ven bờ thường 20–80 m, sóng lừng 100–300 m. Ngày / đêm tính theo giờ bắt đầu; đèn phao và đèn tàu chỉ thấy khi trời tối.</div></section></fieldset></div></div>`;
  const el = $('#p-env');
  el.onchange = (ev) => {
    const t = ev.target, k = t.dataset.k;
    if (t.dataset.tide !== undefined) { e.tide[+t.dataset.tide] = num(t.value, 0); saveEnv(); drawTide(); return; }
    if (t.id === 'windVary') { e.windVary = t.checked; saveEnv(); return; }
    if (!k || ['hwT', 'hwH', 'lwT', 'lwH'].includes(k)) return;
    if (k === 'wxStart') { e.wxStart = t.value; saveEnv(); wxApply(); return; }
    if (k === 'startName') return;
    if (k === 'startPre') { const q = (W.objs.starts || [])[+t.value]; if (!q || t.value === '') return; W.start = { x: q.x, y: q.y, hdg: q.hdg || 0 }; saveObjs(); if (A.sim && A.sim.t < 2 && A.hooks.resetToStart) A.hooks.resetToStart(false); initEnv(); return; }
    if (k === 'waveL') { e.waveL = Math.max(5, Math.min(600, num(t.value, envWaveL(e)))); saveEnv(); initEnv(); return; }
    if (k === 'startHdg') { A.W.start = Object.assign({}, startPos(), { hdg: ((num(t.value, 0) % 360) + 360) % 360 }); saveObjs(); if (A.sim && A.sim.t < 2 && A.hooks.resetToStart) A.hooks.resetToStart(false); return; }
    e[k] = t.dataset.t || t.tagName === 'SELECT' ? t.value : num(t.value, e[k]); saveEnv();
  };
  // đổi chế độ thời tiết: bài chưa chạy thì làm lại bài ngay, đang chạy thì áp dụng khi bắt đầu bài mới
  const wxApply = () => { if (A.sim && A.sim.t < 2 && A.hooks.resetToStart) A.hooks.resetToStart(false); };
  $('#wxSeg').onclick = (ev) => { const m = ev.target.dataset.wx; if (!m || m === e.wxMode) return; e.wxMode = m; saveEnv(); initEnv(); wxApply(); };
  $('#lightSeg').onclick = (ev) => { const m = ev.target.dataset.light; if (!m) return; e.light = m; saveEnv(); initEnv(); };
  $('#fogBtn').onclick = () => { e.fogOn = !e.fogOn; saveEnv(); initEnv(); };
  $('#tideGen').onclick = () => {
    const g = (k) => num($('#f_' + k).value, 0), hwT = g('hwT'), hwH = g('hwH'), lwT = g('lwT'), lwH = g('lwH');
    for (let h = 0; h < 24; h++) {
      const dUp = ((hwT - lwT) % 24 + 24) % 24 || 12, x = ((h - lwT) % 24 + 24) % 24;
      const f = x <= dUp ? (1 - Math.cos(Math.PI * x / dUp)) / 2 : (1 + Math.cos(Math.PI * (x - dUp) / (24 - dUp))) / 2;
      e.tide[h] = +(lwH + (hwH - lwH) * f).toFixed(2);
    }
    saveEnv(); initEnv();
  };
  $('#saveStart').onclick = () => { const nm = $('#f_startName').value.trim(); if (!nm || !W.start) { $('#f_startName').focus(); return; } const st = W.objs.starts || (W.objs.starts = []), q = { name: nm, x: W.start.x, y: W.start.y, hdg: W.start.hdg || 0 }, i = st.findIndex((o) => o.name === nm); if (i >= 0) st[i] = q; else st.push(q); saveObjs(); initEnv(); };
  $('#pickStart').onclick = () => { tool = 'start'; A.hooks.go('chart'); $$('#toolBtns button').forEach((b) => b.classList.toggle('pri', b.dataset.tool === 'start')); $('#chartHint').textContent = HINT.start; };
  $('#goBtn').onclick = () => A.hooks.startScenario();
  drawTide();
}
function drawTide() {
  const c = $('#tideCv'); if (!c) return; const w = c.width = c.clientWidth || 600, h = c.height = 170, g = c.getContext('2d'), e = A.env;
  const mx = Math.max(4, Math.ceil(Math.max(...e.tide.map((v) => num(v, 0))))), X = (t) => 34 + (w - 44) * t / 24, Y = (m) => h - 22 - (h - 34) * m / mx;
  g.clearRect(0, 0, w, h); g.font = '10px Consolas'; g.fillStyle = '#8FA3B0'; g.strokeStyle = '#22303A'; g.lineWidth = 1;
  for (let m = 0; m <= mx; m++) { g.beginPath(); g.moveTo(X(0), Y(m)); g.lineTo(X(24), Y(m)); g.stroke(); g.fillText(m + ' m', 4, Y(m) + 3); }
  for (let t = 0; t <= 24; t += 6) g.fillText(String(t).padStart(2, '0') + 'h', X(t) - 8, h - 6);
  g.strokeStyle = '#5CD6FF'; g.lineWidth = 2; g.beginPath(); for (let i = 0; i <= 240; i++) { const t = i / 10, y = Y(tideAt(e, t * 3600)); if (i) g.lineTo(X(t), y); else g.moveTo(X(t), y); } g.stroke();
  const m = /^(\d{1,2}):(\d{2})/.exec(e.startTime || ''); if (m) { const t = +m[1] + m[2] / 60; g.strokeStyle = '#FFB547'; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(X(t), 8); g.lineTo(X(t), h - 22); g.stroke(); g.setLineDash([]); g.fillStyle = '#FFB547'; g.fillText('Bắt đầu ' + e.startTime, Math.min(w - 90, X(t) + 4), 14); }
}

// ---------------- Cài đặt ----------------
export function initSet() {
  const s = A.set;
  $('#p-set').innerHTML = `<div class="flex" style="align-items:flex-start"><section class="card" style="flex:1 1 420px;max-width:640px"><h2>Chất lượng đồ họa 3D</h2><div class="grid g4" id="qSeg">${Object.entries(QUALITY).map(([k, q]) => `<button class="btn ${s.quality === k ? 'on' : ''}" data-q="${k}" style="min-height:54px">${q.label}</button>`).join('')}</div>
  <div class="muted" style="margin-top:8px">Thấp: mặt nước phẳng, địa hình thô, nhẹ nhất. Cao (đề xuất cho RTX 3050): mặt nước có sóng và phản chiếu, địa hình mịn hơn. Tối đa: địa hình mịn nhất, hình nét hơn. Thấy giật thì hạ một mức.</div></section>
  <section class="card" style="flex:1 1 300px;max-width:420px"><h2>Cỡ giao diện (theo màn hình)</h2><div class="seg" id="uiSeg" style="display:flex;flex-wrap:wrap">${[['auto', 'Tự vừa màn hình'], [70, '70%'], [80, '80%'], [90, '90%'], [100, '100%'], [110, '110%'], [125, '125%']].map((o) => `<button data-u="${o[0]}" class="${String(s.uiScale) === String(o[0]) ? 'on' : ''}" style="flex:1 1 auto">${o[1]}</button>`).join('')}</div><div class="muted" style="margin-top:8px">«Tự vừa màn hình»: app tự thu phóng để tab Điều động nằm gọn trong một màn hình, không phải cuộn. Màn hình đang là <b>${screen.width} × ${screen.height}</b>, cửa sổ ${innerWidth} × ${innerHeight}. Chữ nhỏ quá thì chọn mức % lớn hơn.</div></section>
  <section class="card" style="flex:1 1 300px;max-width:420px"><h2>Sóng & chuyển động tàu</h2>
    <label class="lbl" for="rollSpeed" style="display:block">Tốc độ lắc của tàu ×<b id="rollSpeedV">${s.rollSpeed || 4}</b></label><input type="range" id="rollSpeed" min="1" max="6" step="0.5" value="${s.rollSpeed || 4}" style="width:100%">
    <div class="muted" style="margin-top:6px">Tốc độ lắc lớn hơn thì tàu bám theo mặt sóng nhanh hơn. Bước sóng chỉnh ở tab 4 (Môi trường).</div></section>
  <section class="card" style="flex:1 1 300px;max-width:420px"><h2>Âm thanh</h2><div class="lbl" style="margin-bottom:4px">Kiểu chuông tàu</div><div class="flex" style="gap:6px;align-items:center;margin-bottom:10px"><div class="seg" id="bellSeg">${[['electric', 'Chuông điện 6 inch (reng reng)'], ['brass', 'Chuông đồng (gõ)']].map((b) => `<button data-b="${b[0]}" class="${(s.bellType || 'electric') === b[0] ? 'on' : ''}">${b[1]}</button>`).join('')}</div><button class="btn sm" id="bellTry">Nghe thử</button></div>${[['volMaster', 'Âm lượng chung'], ['volEngine', 'Tiếng máy'], ['volBell', 'Còi, chuông & báo động'], ['volEnv', 'Mưa, gió & sấm']].map((v) => `<div class="fld" style="margin-bottom:8px"><label for="${v[0]}">${v[1]}: <b id="${v[0]}V">${s[v[0]]}</b>%</label><input type="range" id="${v[0]}" min="0" max="100" step="5" value="${s[v[0]]}"></div>`).join('')}<div class="muted">Âm thanh bật sau lần bấm đầu tiên vào màn Điều động.</div></section>
  <section class="card" style="flex:1 1 300px;max-width:420px"><h2>Dữ liệu</h2><div class="muted">Thông số tàu, kịch bản, các đối tượng vẽ trên hải đồ, kho hải đồ (ảnh đã chia ô) và bài đã ghi được lưu ngay trên máy này. App chạy hoàn toàn không cần mạng.</div><div class="kv" style="margin-top:8px"><span>Kho hải đồ</span><b id="dataUse">…</b></div><button class="btn warn sm" id="wipe" style="margin-top:10px">Xóa toàn bộ dữ liệu đã lưu</button></section></div>`;
  $('#qSeg').onclick = (e) => { const q = e.target.dataset.q; if (!q) return; s.quality = q; saveSet(); initSet(); A.hooks.qualityChanged(); };
  for (const id of ['rollSpeed']) $('#' + id).oninput = (e) => { s[id] = +e.target.value; $('#' + id + 'V').textContent = s[id]; saveSet(); };
  $('#bellSeg').onclick = (e) => { const b = e.target.dataset.b; if (!b) return; s.bellType = b; saveSet(); A.hooks.volChanged(); initSet(); };
  $('#bellTry').onclick = () => { A.snd.init(); A.hooks.volChanged(); A.snd.bell(1.5); };
  $('#uiSeg').onclick = (e) => { const u = e.target.dataset.u; if (!u) return; s.uiScale = u === 'auto' ? 'auto' : +u; saveSet(); A.hooks.scaleChanged(); initSet(); };
  $('#p-set').oninput = (e) => { if (e.target.type === 'range') { s[e.target.id] = +e.target.value; $('#' + e.target.id + 'V').textContent = e.target.value; saveSet(); A.hooks.volChanged(); } };
  $('#wipe').onclick = async () => { if (await uiConfirm('Xóa hết thông số tàu, kịch bản, kho hải đồ và bài đã ghi?', { ok: 'Xóa hết', danger: true })) { try { localStorage.clear(); indexedDB.deleteDatabase('mophongtau'); indexedDB.deleteDatabase('mp_charts'); } catch (e) { /* */ } location.reload(); } };
  CS.catalog.usage().then((u) => { const el = $('#dataUse'); if (el) el.textContent = CS.catalog.records.filter((r) => r.ready).length + ' tờ · ' + (u ? (u / 1048576).toFixed(0) + ' MB trên đĩa' : '—'); });
}
// mở kho hải đồ; lần đầu sau khi nâng cấp: chuyển file hải đồ và đối tượng của bản v0.1 sang kho mới
export async function initCharts() {
  await CS.catalog.init(); drawLib(); drawStatus();
  // tờ KAP nạp từ bản trước chưa đọc độ sâu: đọc nền lần lượt (mỗi tờ một lần; tờ đang dở lúc tắt app thì đọc lại)
  // tờ đã đọc bằng thuật toán cũ: dựng lại mặt nước (thiếu màu nước thì lấy từ ảnh trước), giữ số đo / độ cao đã đọc và chỗ
  // người dùng sửa; tờ đang dựng dở lúc tắt app thì dựng lại từ ảnh, giữ số đo nếu đã có
  setTimeout(async () => { for (const r of CS.catalog.records) { if (r.kind !== 'kap' || !r.ready) continue;
    const alg = (r.dm && r.dm.alg) || 1, keep = async () => { const l = await CS.catalog.getDLite(r.id).catch(() => null); return l && l.snd ? { snd: l.snd, hts: l.hts || [] } : {}; };
    if (!r.dm || r.dm.st === 'run') CS.catalog.readDepth(r, r.dm ? await keep() : {}).catch(() => {});
    else if (r.dm.st === 'ok' && alg < DM_ALG) CS.catalog.readDepth(r, alg >= WATER_ONLY_FROM ? { water: true } : alg >= TINT_FROM ? { tint: true } : await keep()).catch(() => {}); } }, 4000);
  const keys = await DB.keys('charts');
  if (keys && keys.length) {
    const files = []; for (const k of keys) { const f = await DB.get('charts', k); if (f) files.push(f instanceof File ? f : new File([f], String(k))); }
    const n = await addChartFiles(files, false);
    if (n === files.length) for (const k of keys) await DB.del('charts', k);
  }
  if (migrateLegacy()) { loadObjs(); if (A.hooks.resetToStart) A.hooks.resetToStart(false); }
  if (!A.W.start && A.W.hasCharts()) await firstCharts();
  if (A.hooks.chartsChanged) A.hooks.chartsChanged();
}
export { KN, defaultEnv };
