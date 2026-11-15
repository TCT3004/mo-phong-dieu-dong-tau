// Hộp thoại vẽ tàu từ sơ đồ (giai đoạn 3): nạp ảnh / PDF từng hình chiếu, đặt mốc + ghi kích thước, dò viền tự động hoặc chấm tay,
// chọn loại chi tiết theo nhiều nấc, xem 3D ngay, rồi dùng mô hình cho tàu (buồng lái, đèn, hứng gió theo mô hình).
import * as THREE from 'three';
import { A, $, $$, num, esc, saveShip } from './app.js';
import { openPdf } from './pdfload.js';
import { resolve, childrenAt, partLabel, isPointType, SHADES } from './shipdraw/parts.js';
import { calibrate, measure, VIEW_KINDS, REFS, REF_NAMES } from './shipdraw/calib.js';
import { traceWand, traceBox } from './shipdraw/trace.js';
import { buildModel, atH } from './shipdraw/model.js';
import { modelGroup } from './shipdraw/mesh3.js';
import { makeTemplate, TEMPLATE_SHIP } from './shipdraw/template.js';
import { putImg, getImg } from './shipdraw/store.js';

let st = null;
const uid = (p) => p + Math.random().toString(36).slice(2, 9);
const clone = (o) => JSON.parse(JSON.stringify(o));
const ship = () => { const p = A.p; return { L: num(p.loa, 100), B: num(p.B, 15), D: num(p.D, 8), T: (num(p.tf, 4) + num(p.ta, 4)) / 2, cb: num(p.cb, 0.6) }; };
const emptyModel = () => ({ v: 1, name: A.p.name || 'Tàu', views: [], parts: [], opts: { shade: 'haze', rails: true } });
const view = () => st && st.model.views.find((v) => v.id === st.cur);
const calOf = (v) => (v ? calibrate(v, ship()) : { ok: false, msg: '' });
const fmt = (v, d = 1) => (+v).toFixed(d).replace('.', ',');
const CAT = { than: '#4FC3F7', tang: '#FFB74D', buong: '#FFD54F', cot: '#E0E0E0', khoi: '#A1887F', vukhi: '#EF5350', radar: '#BA68C8', xuong: '#FF8A65', neo: '#90A4AE', khac: '#81C784' };
const LCOL = { sideP: '#FF5252', sideS: '#4ADE80', nuc: '#FF5252', deck: '#FFE08A' };
const colOf = (p) => { const r = resolve(p.type); if (!r.leaf) return '#FF4081'; if (r.node.key) return LCOL[r.node.key] || '#FFFFFF'; return CAT[p.type[0]] || '#81C784'; };
const HINT = {
  edit: 'Bấm vào chi tiết để chọn, kéo các điểm vuông để sửa, bấm đúp lên cạnh để thêm điểm, chuột phải vào điểm để bỏ. Kéo chỗ trống để di chuyển hình, lăn chuột để phóng to.',
  pan: 'Kéo để di chuyển hình, lăn chuột để phóng to / thu nhỏ.',
  poly: 'Bấm lần lượt các điểm quanh chi tiết; bấm lại điểm đầu (hoặc bấm đúp, Enter) để khép kín. Chuột phải bỏ điểm vừa chấm, Esc hủy.',
  line: 'Bấm các điểm của đường (vd: tâm cột từ chân lên đỉnh); bấm đúp hoặc Enter để kết thúc.',
  point: 'Bấm một điểm: đèn, vị trí người điều động… Chọn loại ở khung bên phải.',
  wand: 'Bấm vào bên trong một vùng được viền kín (vd: thân thượng tầng) — app tự lấy đường bao. Giữ Shift khi bấm để gộp thêm vùng vào chi tiết đang chọn (vd: các mảnh mặt boong bị đường tâm chia ra). Chi tiết giữa tàu chỉ cần một nửa, app tự lấy đối xứng. Vùng hở thì dùng «Dò trong khung».',
  box: 'Kéo một khung bao quanh chi tiết — app lấy bóng ngoài của nét vẽ trong khung.',
  dim: 'Bấm điểm đầu rồi các điểm tiếp theo (đo nối tiếp) — mỗi đoạn hiện một ô kích thước, sửa thành số thật (m). Chuột phải / Esc để dừng.'
};

export function openShipDraw() {
  // bản đang vẽ giữ qua các lần mở; chưa sửa gì thì lấy lại theo thông số tàu hiện tại
  if (st && !st.edited && JSON.stringify(A.p.model || null) !== st.src) st = null;
  if (!st) st = { src: JSON.stringify(A.p.model || null), edited: false, model: A.p.model ? clone(A.p.model) : emptyModel(), cur: null, tool: 'edit', sel: null, draft: null, chain: null, drag: null, mouse: null, img: new Map(), data: new Map(), v: { cx: 0, cy: 0, sc: 1 }, tol: 40, lastPoint: null };
  if (!st.cur && st.model.views.length) st.cur = st.model.views[0].id;
  let d = $('#sdlg'); if (!d) { d = document.createElement('div'); d.id = 'sdlg'; d.className = 'modal'; $('#app').appendChild(d); }
  d.innerHTML = `<div class="mbox" role="dialog" aria-label="Vẽ tàu từ sơ đồ">
  <div class="mhead"><b>Vẽ tàu từ sơ đồ</b><span class="muted" id="sdName"></span>
    <button class="btn sm" id="sdTpl">Mẫu tàu pháo (chung chung)</button><button class="btn sm" id="sdExp">Xuất file…</button><label class="btn sm" style="display:inline-flex;align-items:center">Nhập file…<input type="file" id="sdImp" accept=".json" hidden></label>
    <button class="btn sm pri" id="sdApply">Dùng mô hình cho tàu</button><button class="btn sm" id="sdClose">Đóng</button></div>
  <div class="mbody" style="grid-template-columns:262px minmax(0,1fr) 300px">
    <div class="mleft">
      <section class="wst"><b>1 · Sơ đồ (hình chiếu)</b><div id="sdViews" style="margin-top:5px"></div>
        <label class="btn sm pri" style="display:flex;align-items:center;justify-content:center;margin-top:5px">+ Thêm ảnh / PDF sơ đồ<input type="file" id="sdFile" accept="image/*,.pdf,application/pdf" hidden></label>
        <div class="flex" style="gap:5px;margin-top:5px;flex-wrap:nowrap"><select id="sdBlankK" style="flex:1;min-width:0">${Object.entries(VIEW_KINDS).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select><button class="btn sm" id="sdBlank" title="Vẽ trên lưới, không cần ảnh">+ Hình trống</button></div>
        <div class="muted" style="margin-top:5px">Có 1, 2 hay 3 hình chiếu đều được — thiếu hình nào app tự suy.</div></section>
      <section class="wst"><b>2 · Mốc &amp; tỷ lệ</b><div id="sdRefs" style="margin-top:5px"></div></section>
      <section class="wst"><b>3 · Vẽ chi tiết</b><div class="grid g2" id="sdTools" style="gap:4px;margin-top:5px">${[['edit', 'Chọn / sửa'], ['pan', 'Kéo hình'], ['wand', 'Đũa thần'], ['box', 'Dò trong khung'], ['poly', 'Chấm đường bao'], ['line', 'Kẻ đường'], ['point', 'Chấm 1 điểm'], ['dim', 'Đo kích thước']].map(([k, n]) => `<button class="btn sm" data-t="${k}">${n}</button>`).join('')}</div>
        <label class="lbl" for="sdTol" style="display:block;margin-top:6px">Độ nhạy đũa thần: <b id="sdTolV">${st.tol}</b></label><input type="range" id="sdTol" min="10" max="120" step="5" value="${st.tol}" style="width:100%">
        <label style="display:flex;gap:6px;align-items:center;margin-top:4px"><input type="checkbox" id="sdSkip" ${st.skip !== false ? 'checked' : ''}> Vượt qua nét màu (đường nước, kích thước)</label></section>
    </div>
    <div class="mmain"><div class="note" id="sdHint"></div><div class="wcv"><canvas id="sdCv"></canvas><div class="wempty" id="sdEmpty">Thêm ảnh / PDF sơ đồ tàu ở bước 1 (hoặc «Hình trống» để vẽ trên lưới, hoặc mở «Mẫu tàu pháo» để xem cách vẽ).</div></div><div class="muted mono" id="sdPos" style="min-height:16px"></div></div>
    <div class="mright">
      <section class="wst"><b>Chi tiết đang chọn</b><div id="sdSel" style="margin-top:5px"></div></section>
      <section class="wst"><b>Chi tiết trên hình này</b><div id="sdParts" style="margin-top:5px;max-height:190px;overflow:auto"></div></section>
      <section class="wst"><b>Xem 3D</b> <span class="muted">(kéo để xoay)</span><canvas id="sd3d" style="width:100%;height:190px;display:block;border-radius:6px;margin-top:5px;background:#0b1116;touch-action:none"></canvas><div class="muted" id="sd3dInfo" style="margin-top:4px"></div>
        <div class="flex" style="gap:6px;margin-top:6px;align-items:center;flex-wrap:nowrap"><select id="sdShade" style="flex:1;min-width:0" aria-label="Tông màu">${Object.entries(SHADES).map(([k, s]) => `<option value="${k}" ${(st.model.opts.shade || 'haze') === k ? 'selected' : ''}>${s.name}</option>`).join('')}</select><label style="display:flex;gap:4px;align-items:center;white-space:nowrap"><input type="checkbox" id="sdRails" ${st.model.opts.rails !== false ? 'checked' : ''}> Lan can</label></div>
        <label style="display:flex;gap:6px;align-items:center;margin-top:6px"><input type="checkbox" id="sdWind" checked> Cập nhật diện tích hứng gió (tab 1) theo mô hình</label><div class="muted" id="sdMsg" style="margin-top:4px"></div></section>
    </div></div></div>`;
  d.style.display = 'flex';
  bind(); setTool(st.tool); refreshAll(); initPreview();
  for (const v of st.model.views) loadImg(v);
}
function close() { const d = $('#sdlg'); if (d) d.style.display = 'none'; if (st && st.p3) { st.p3.r.dispose(); st.p3.r.forceContextLoss(); st.p3 = null; } document.removeEventListener('keydown', onKey); }
function refreshAll() { drawViews(); drawRefs(); drawParts(); drawSel(); paint(); $('#sdName').textContent = st.model.name + (st.model.template ? ' — mẫu chung chung' : ''); $('#sdEmpty').style.display = view() ? 'none' : 'flex'; }
function changed(panels = true) { st.edited = true; if (panels) { drawRefs(); drawParts(); } paint(); clearTimeout(st.t3); st.t3 = setTimeout(rebuild3d, 250); }

// ---------- danh sách hình chiếu ----------
function drawViews() {
  $('#sdViews').innerHTML = st.model.views.length ? st.model.views.map((v) => `<div class="flex" style="gap:4px;margin-bottom:4px;flex-wrap:nowrap;align-items:stretch"><button class="btn sm ${v.id === st.cur ? 'pri' : ''}" data-v="${v.id}" style="flex:1;min-width:0;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(v.name)}">${esc(v.name)}</button><select data-k="${v.id}" style="width:104px" aria-label="Loại hình chiếu">${Object.entries(VIEW_KINDS).map(([k, n]) => `<option value="${k}" ${v.kind === k ? 'selected' : ''}>${n.replace('Nhìn ', '').replace(' (mặt boong)', '')}</option>`).join('')}</select><button class="btn sm" data-del="${v.id}" aria-label="Bỏ hình ${esc(v.name)}" style="padding:0 7px">✕</button></div>`).join('') : '<div class="muted">Chưa có hình nào.</div>';
}
// ---------- mốc & kích thước ----------
function drawRefs() {
  const v = view(), el = $('#sdRefs'); if (!v) { el.innerHTML = '<div class="muted">Chọn một hình ở bước 1.</div>'; return; }
  const c = calOf(v), s = ship(), lon = v.kind === 'side' || v.kind === 'top';
  el.innerHTML = `<div class="grid g3" style="gap:4px">${REFS[v.kind].map((k) => `<button class="btn sm ${st.tool === 'ref:' + k ? 'pri' : ''}" data-ref="${k}">${REF_NAMES[k]}${v.refs && v.refs[k] ? ' ✓' : ''}</button>`).join('')}</div>
  <div class="muted" style="margin-top:5px">${lon ? `Bấm mũi và lái ${v.kind === 'top' ? '(trên đường tâm)' : '(điểm xa nhất)'}: app lấy chiều dài LOA = ${fmt(s.L)} m ở tab 1.` : `Bấm hai mép rộng nhất: app lấy B = ${fmt(s.B)} m ở tab 1.`}${v.kind !== 'top' ? ' Đáy ky: một điểm trên đường đáy.' : ''}</div>
  <button class="btn sm ${st.tool === 'dim' ? 'pri' : ''}" data-t2="dim" style="width:100%;margin-top:6px">Đo kích thước (kéo nhiều điểm)</button>
  ${(v.dims || []).map((q, i) => `<div class="flex" style="gap:4px;margin-top:4px;align-items:center;flex-wrap:nowrap"><span class="mono" style="width:18px">${i + 1}</span><input class="cell mono" data-dim="${i}" value="${q.m ? fmt(q.m, 2) : ''}" placeholder="m" style="width:70px;height:24px" aria-label="Kích thước ${i + 1} (m)"><span class="muted" style="flex:1">m${c.ok && c.res[i] !== undefined && q.m ? ' · lệch ' + fmt(c.res[i], 1) + '%' : ''}</span><button class="btn sm" data-ddel="${i}" style="padding:0 6px" aria-label="Bỏ kích thước ${i + 1}">✕</button></div>`).join('')}
  <div class="${c.ok ? 'muted' : ''}" style="margin-top:6px;${c.ok ? '' : 'color:#FFB547'}">${c.ok ? `Tỷ lệ: 1 m = ${fmt(1 / c.su, 1)} điểm ảnh ngang · ${fmt(1 / c.sv, 1)} đứng${c.noBase ? ' · chưa có đáy ky' : ''}${c.res.some((e) => Math.abs(e) > 3) ? '<br><span style="color:#FF8A8A">Có kích thước lệch &gt; 3% — kiểm tra lại số hoặc điểm bấm.</span>' : ''}` : esc(c.msg)}</div>`;
}
// ---------- danh sách chi tiết ----------
function drawParts() {
  const v = view(), el = $('#sdParts'); if (!v) { el.innerHTML = ''; return; }
  const ps = st.model.parts.filter((p) => p.view === v.id);
  el.innerHTML = ps.length ? ps.map((p) => `<div class="flex" style="gap:5px;align-items:center;margin-bottom:3px;flex-wrap:nowrap"><span style="width:10px;height:10px;border-radius:2px;background:${colOf(p)};flex:0 0 10px"></span><button class="btn sm ${p.id === st.sel ? 'pri' : ''}" data-p="${p.id}" style="flex:1;min-width:0;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(partLabel(p))}</button></div>`).join('') : '<div class="muted">Chưa có chi tiết nào trên hình này.</div>';
}
// ---------- chi tiết đang chọn: chọn loại nhiều nấc ----------
function drawSel() {
  const el = $('#sdSel'), p = st.model.parts.find((q) => q.id === st.sel);
  if (!p) { el.innerHTML = '<div class="muted">Bấm vào một chi tiết trên hình để chọn, hoặc vẽ mới ở bước 3.</div>'; return; }
  let h = ''; const r = resolve(p.type);
  for (let dpt = 0; dpt < 5; dpt++) { const opts = childrenAt(p.type, dpt); if (!opts) break; h += `<select data-lv="${dpt}" style="width:100%;margin-bottom:4px" aria-label="Loại chi tiết nấc ${dpt + 1}"><option value="">— chọn ${dpt ? 'tiếp' : 'loại'} —</option>${opts.map((o) => `<option value="${o.id}" ${p.type[dpt] === o.id ? 'selected' : ''}>${o.name}</option>`).join('')}</select>`; if (p.type[dpt] === undefined) break; }
  const pt = r.leaf && r.node.kind === 'point';
  h += r.leaf ? `<div class="muted" style="margin:2px 0 6px">${esc(r.names.join(' › '))}${r.node.key ? ' — đèn nối với bảng Đèn ở tab 3' : ''}</div>` : '<div style="color:#FF8A8A;margin:2px 0 6px">Chọn đến nấc cuối để app biết dựng chi tiết này.</div>';
  h += `<input id="sdNote" class="cell" value="${esc(p.note || '')}" placeholder="Ghi chú (tùy ý)" style="width:100%;margin-bottom:5px;text-align:left;height:28px">`;
  if (!pt) h += `<div class="grid g3" style="gap:4px">${[['h', 'Cao'], ['w', 'Rộng'], ['l', 'Dài']].map(([k, n]) => `<div class="fld"><label for="sdN${k}">${n} (m)</label><div class="in"><input id="sdN${k}" data-num="${k}" value="${p.num && p.num[k] ? fmt(p.num[k], 2) : ''}" placeholder="tự tính"></div></div>`).join('')}</div>`;
  h += `<div class="flex" style="gap:5px;margin-top:6px"><button class="btn sm" id="sdDup" style="flex:1">Nhân bản${/(^|canh)[TP]$/.test(p.type[p.type.length - 1] || '') ? ' sang mạn kia' : ''}</button><button class="btn sm warn" id="sdDelP" style="flex:1">Xóa chi tiết</button></div>`;
  el.innerHTML = h;
  $$('#sdSel select').forEach((s) => { s.onchange = () => { const dpt = +s.dataset.lv; p.type = p.type.slice(0, dpt); if (s.value) p.type.push(s.value); if (isPointType(p.type) && p.kind === 'point') st.lastPoint = p.type.slice(); drawSel(); changed(); }; });
  $('#sdNote').oninput = (e) => { p.note = e.target.value; drawParts(); };
  $$('#sdSel [data-num]').forEach((i) => { i.onchange = () => { p.num = p.num || {}; const v = num(i.value, 0); if (v > 0) p.num[i.dataset.num] = v; else delete p.num[i.dataset.num]; changed(false); }; });
  $('#sdDelP').onclick = () => delPart(p.id);
  $('#sdDup').onclick = () => { const q = clone(p); q.id = uid('p'); const last = q.type[q.type.length - 1] || ''; const sw = { T: 'P', P: 'T', canhT: 'canhP', canhP: 'canhT' }; if (sw[last]) q.type[q.type.length - 1] = sw[last]; else q.pts = q.pts.map(([x, y]) => [x + 12 / st.v.sc, y + 12 / st.v.sc]); st.model.parts.push(q); st.sel = q.id; drawSel(); changed(); };
}
function delPart(id) { st.model.parts = st.model.parts.filter((q) => q.id !== id); if (st.sel === id) st.sel = null; drawSel(); changed(); }

// ---------- công cụ ----------
function setTool(t) {
  st.tool = t; st.draft = null; st.chain = null;
  $$('#sdTools button').forEach((b) => b.classList.toggle('pri', b.dataset.t === t));
  $('#sdHint').textContent = t.startsWith('ref:') ? 'Bấm vào vị trí «' + REF_NAMES[t.slice(4)] + '» trên hình.' : HINT[t] || '';
  const c = $('#sdCv'); if (c) c.style.cursor = t === 'pan' ? 'grab' : t === 'edit' ? 'default' : 'crosshair';
  drawRefs(); paint();
}
function bind() {
  $('#sdClose').onclick = close;
  $('#sdTools').onclick = (e) => { const t = e.target.dataset.t; if (t) setTool(st.tool === t && t !== 'edit' ? 'edit' : t); };
  $('#sdTol').oninput = (e) => { st.tol = +e.target.value; $('#sdTolV').textContent = st.tol; };
  $('#sdSkip').onchange = (e) => { st.skip = e.target.checked; };
  $('#sdViews').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.v) { st.cur = b.dataset.v; st.sel = null; fitView(); refreshAll(); } else if (b.dataset.del) { const v = st.model.views.find((q) => q.id === b.dataset.del); if (v && confirm('Bỏ hình «' + v.name + '» và các chi tiết vẽ trên nó?')) { st.model.views = st.model.views.filter((q) => q !== v); st.model.parts = st.model.parts.filter((p) => p.view !== v.id); if (st.cur === v.id) st.cur = st.model.views[0] ? st.model.views[0].id : null; st.sel = null; fitView(); refreshAll(); changed(); } } };
  $('#sdViews').onchange = (e) => { const s = e.target; if (s.dataset.k) { const v = st.model.views.find((q) => q.id === s.dataset.k); v.kind = s.value; v.refs = {}; refreshAll(); changed(); } };
  $('#sdRefs').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.ref) setTool('ref:' + b.dataset.ref); else if (b.dataset.t2) setTool(st.tool === 'dim' ? 'edit' : 'dim'); else if (b.dataset.ddel !== undefined) { view().dims.splice(+b.dataset.ddel, 1); changed(); } };
  $('#sdRefs').onchange = (e) => { const i = e.target.dataset.dim; if (i === undefined) return; const q = view().dims[+i]; q.m = num(e.target.value, 0); changed(); };
  $('#sdParts').onclick = (e) => { const b = e.target.closest('button'); if (b && b.dataset.p) { st.sel = b.dataset.p; drawParts(); drawSel(); paint(); } };
  $('#sdFile').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) addFile(f); };
  $('#sdBlank').onclick = () => addBlank($('#sdBlankK').value);
  $('#sdShade').onchange = (e) => { st.model.opts.shade = e.target.value; changed(false); };
  $('#sdRails').onchange = (e) => { st.model.opts.rails = e.target.checked; changed(false); };
  $('#sdTpl').onclick = () => {
    if (st.model.parts.length && !confirm('Thay mô hình đang vẽ bằng mẫu tàu pháo chung chung?')) return;
    st.model = makeTemplate(); st.cur = st.model.views[0].id; st.sel = null; st.img.clear(); st.data.clear();
    if (confirm('Đặt luôn thông số tàu ở tab 1 theo mẫu (dài 62 m, rộng 9,5 m, mớn 2,8 m, 2 máy, hết lái 25°)?\nKhông đặt thì mẫu tự co giãn theo chiều dài, chiều rộng tàu hiện có.')) { Object.assign(A.p, TEMPLATE_SHIP, { name: 'Tàu pháo mẫu' }); saveShip(); }
    fitView(); refreshAll(); changed();
  };
  $('#sdApply').onclick = apply;
  $('#sdExp').onclick = exportFile;
  $('#sdImp').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); };
  const c = $('#sdCv');
  const pos = (e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
  c.onwheel = (e) => { e.preventDefault(); if (!view()) return; const p = pos(e), a = s2i(p); st.v.sc = Math.max(0.01, Math.min(40, st.v.sc * (e.deltaY > 0 ? 0.85 : 1.18))); const b = s2i(p); st.v.cx += a[0] - b[0]; st.v.cy += a[1] - b[1]; paint(); };
  c.onpointerdown = (e) => down(e, pos(e));
  c.onpointermove = (e) => move(e, pos(e));
  c.onpointerup = (e) => up(e, pos(e));
  c.ondblclick = (e) => dbl(pos(e));
  c.oncontextmenu = (e) => { e.preventDefault(); ctx(pos(e)); };
  document.addEventListener('keydown', onKey);
  if (!window.__sdResize) { window.__sdResize = true; window.addEventListener('resize', () => { if (st && $('#sdlg') && $('#sdlg').style.display !== 'none') { paint(); render3d(); } }); }
}
function onKey(e) {
  if (!st || $('#sdlg').style.display === 'none') return; const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName);
  if (e.key === 'Escape') { if (st.draft || st.chain || st.drag) { st.draft = null; st.chain = null; st.drag = null; paint(); } else if (st.sel) { st.sel = null; drawSel(); drawParts(); paint(); } else if (st.tool !== 'edit') setTool('edit'); e.preventDefault(); e.stopPropagation(); }
  else if (e.key === 'Enter' && !typing && st.draft) { finishDraft(); e.preventDefault(); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && st.sel) { delPart(st.sel); e.preventDefault(); }
  if (!typing) e.stopPropagation();
}

// ---------- hình chiếu: thêm ảnh, PDF, hình trống ----------
const guessKind = () => { const has = new Set(st.model.views.map((v) => v.kind)); return ['side', 'top', 'front', 'back'].find((k) => !has.has(k)) || 'side'; };
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
    const v = { id: uid('v'), kind: guessKind(), name, imgId, iw: cv.width, ih: cv.height, refs: {}, dims: [] };
    st.model.views.push(v); st.img.set(v.id, cv); st.cur = v.id; st.sel = null; if (st.model.template) delete st.model.template;
    fitView(); refreshAll(); setTool('ref:' + REFS[v.kind][0]); msg.textContent = 'Đã thêm «' + name + '». Kiểm tra loại hình chiếu rồi đặt mốc ở bước 2.';
  } catch (e) { msg.textContent = 'Không đọc được file: ' + (e.message || e); console.error(e); }
}
function addBlank(kind) {
  const s = ship(), PX = 20, M = 100, lon = kind === 'side' || kind === 'top', w = (lon ? s.L : s.B * 1.4) * PX + 2 * M, h = (kind === 'top' ? s.B * 1.4 : kind === 'side' ? s.D * 3.5 : s.D * 2.2) * PX + 2 * M;
  const v = { id: uid('v'), kind, name: VIEW_KINDS[kind] + ' (lưới)', imgId: null, iw: Math.round(w), ih: Math.round(h), dims: [] };
  if (kind === 'side') v.refs = { stern: [M, h - M], bow: [M + s.L * PX, h - M], base: [w / 2, h - M] };
  else if (kind === 'top') v.refs = { stern: [M, h / 2], bow: [M + s.L * PX, h / 2] };
  else v.refs = { left: [w / 2 - s.B / 2 * PX, h - M], right: [w / 2 + s.B / 2 * PX, h - M], base: [w / 2, h - M] };
  st.model.views.push(v); st.cur = v.id; st.sel = null; fitView(); refreshAll(); setTool('poly');
}
async function loadImg(v) {
  if (!v.imgId || st.img.has(v.id)) return;
  try { const b = await getImg(v.imgId); if (!b) return; const bmp = await createImageBitmap(b), cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height; cv.getContext('2d').drawImage(bmp, 0, 0); st.img.set(v.id, cv); if (v.id === st.cur) { if (!st.fitted) fitView(); paint(); } } catch (e) { console.warn(e); }
}
function imgData(v) { if (st.data.has(v.id)) return st.data.get(v.id); const cv = st.img.get(v.id); if (!cv) return null; const d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, cv.width, cv.height); st.data.clear(); st.data.set(v.id, d); return d; }

// ---------- khung vẽ ----------
function sizeCv() { const c = $('#sdCv'); const w = c.clientWidth | 0, h = c.clientHeight | 0; if (w && h && (c.width !== w || c.height !== h)) { c.width = w; c.height = h; } }
function fitView() { const v = view(), c = $('#sdCv'); if (!v || !c) return; sizeCv(); st.v.cx = v.iw / 2; st.v.cy = v.ih / 2; st.v.sc = Math.min(c.width / v.iw, c.height / v.ih) * 0.95 || 1; st.fitted = true; }
const i2s = (q) => { const c = $('#sdCv'); return [c.width / 2 + (q[0] - st.v.cx) * st.v.sc, c.height / 2 + (q[1] - st.v.cy) * st.v.sc]; };
const s2i = (p) => { const c = $('#sdCv'); return [st.v.cx + (p[0] - c.width / 2) / st.v.sc, st.v.cy + (p[1] - c.height / 2) / st.v.sc]; };
function paint() {
  const c = $('#sdCv'); if (!c) return; sizeCv(); const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#2a3238'; g.fillRect(0, 0, c.width, c.height);
  const v = view(); if (!v) return; const s = st.v.sc, cal = calOf(v), img = st.img.get(v.id);
  g.save(); g.setTransform(s, 0, 0, s, c.width / 2 - st.v.cx * s, c.height / 2 - st.v.cy * s);
  if (img) { g.imageSmoothingEnabled = s < 1.5; g.drawImage(img, 0, 0); } else { g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, v.iw, v.ih); }
  g.restore();
  // lưới mét (hình trống) và các đường chuẩn: đường đáy, đường nước, đường tâm
  if (cal.ok) {
    const sh = ship(), line = (a, b, col, dash, w = 1) => { const p = i2s(cal.toPx(a)), q = i2s(cal.toPx(b)); g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); g.setLineDash([]); };
    const H = v.kind === 'side' || v.kind === 'top' ? sh.L * 0.6 : sh.B * 0.8;
    if (!img) { const st2 = H > 60 ? 5 : 1; for (let a = -Math.ceil(H / st2) * st2; a <= H; a += st2) line([a, v.kind === 'top' ? -sh.B : -1], [a, v.kind === 'top' ? sh.B : sh.D * 3], a % (st2 * 5) ? 'rgba(0,0,0,.07)' : 'rgba(0,0,0,.16)', []); for (let b = v.kind === 'top' ? -Math.ceil(sh.B) : 0; b <= (v.kind === 'top' ? sh.B : sh.D * 3); b += 1) line([-H, b], [H, b], b % 5 ? 'rgba(0,0,0,.07)' : 'rgba(0,0,0,.16)', []); }
    if (v.kind === 'top') line([-H, 0], [H, 0], 'rgba(0,140,255,.8)', [8, 5]);
    else { line([-H, 0], [H, 0], 'rgba(0,140,255,.8)', [8, 5]); line([-H, sh.T], [H, sh.T], 'rgba(0,150,200,.75)', [3, 4]); }
  }
  // các chi tiết
  for (const p of st.model.parts) {
    if (p.view !== v.id || !p.pts.length) continue; const col = colOf(p), sel = p.id === st.sel, P = p.pts.map(i2s);
    if (p.kind === 'point') { g.fillStyle = col; g.strokeStyle = sel ? '#00E5FF' : '#0b1116'; g.lineWidth = sel ? 3 : 1.5; g.beginPath(); g.arc(P[0][0], P[0][1], sel ? 7 : 5.5, 0, 7); g.fill(); g.stroke(); continue; }
    g.beginPath(); P.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); if (p.kind !== 'line') { g.closePath(); g.fillStyle = col + (sel ? '44' : '26'); g.fill(); }
    g.strokeStyle = sel ? '#00E5FF' : col; g.lineWidth = sel ? 2.5 : 1.8; g.setLineDash(resolve(p.type).leaf ? [] : [6, 4]); g.stroke(); g.setLineDash([]);
    if (sel) for (const q of P) { g.fillStyle = '#00E5FF'; g.fillRect(q[0] - 4, q[1] - 4, 8, 8); g.strokeStyle = '#0b1116'; g.lineWidth = 1; g.strokeRect(q[0] - 4, q[1] - 4, 8, 8); }
  }
  // kích thước
  g.font = 'bold 12px Segoe UI';
  (v.dims || []).forEach((q, i) => { const a = i2s(q.a), b = i2s(q.b), bad = cal.ok && cal.res[i] !== undefined && Math.abs(cal.res[i]) > 3; g.strokeStyle = bad ? '#FF5252' : '#FF9100'; g.lineWidth = 2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); for (const e of [a, b]) { g.beginPath(); g.arc(e[0], e[1], 3.5, 0, 7); g.fillStyle = g.strokeStyle; g.fill(); } const t = (i + 1) + ': ' + (q.m ? fmt(q.m, 2) + ' m' : '? m'), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], tw = g.measureText(t).width; g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(m[0] - tw / 2 - 3, m[1] - 18, tw + 6, 15); g.fillStyle = bad ? '#D50000' : '#E65100'; g.fillText(t, m[0] - tw / 2, m[1] - 6); });
  // mốc
  for (const [k, q] of Object.entries(v.refs || {})) { if (!q) continue; const p = i2s(q); g.strokeStyle = '#D500F9'; g.lineWidth = 2; g.beginPath(); g.moveTo(p[0] - 10, p[1]); g.lineTo(p[0] + 10, p[1]); g.moveTo(p[0], p[1] - 10); g.lineTo(p[0], p[1] + 10); g.stroke(); const t = REF_NAMES[k], tw = g.measureText(t).width; g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(p[0] + 6, p[1] + 4, tw + 6, 15); g.fillStyle = '#AA00FF'; g.fillText(t, p[0] + 9, p[1] + 16); }
  // đang vẽ
  const m = st.mouse;
  if (st.draft && st.draft.length) { g.strokeStyle = '#00E5FF'; g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath(); st.draft.map(i2s).forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); if (m) g.lineTo(m[0], m[1]); g.stroke(); g.setLineDash([]); for (const q of st.draft.map(i2s)) { g.fillStyle = '#00E5FF'; g.fillRect(q[0] - 3, q[1] - 3, 6, 6); } }
  if (st.chain && m) { const a = i2s(st.chain[st.chain.length - 1]); g.strokeStyle = '#FF9100'; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(m[0], m[1]); g.stroke(); g.setLineDash([]); const L = measure(cal, st.chain[st.chain.length - 1], s2i(m)); if (L) { g.fillStyle = '#FF9100'; g.fillText(fmt(L, 2) + ' m', m[0] + 10, m[1] - 8); } }
  if (st.drag && st.drag.box) { const a = st.drag.box, b = m || a; g.strokeStyle = '#00E5FF'; g.setLineDash([6, 4]); g.lineWidth = 1.5; g.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); g.setLineDash([]); }
}

// ---------- chuột ----------
const near = (a, b, r = 9) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= r;
function hitPart(p) {
  const v = view(), q = s2i(p); const ps = st.model.parts.filter((o) => o.view === v.id);
  for (let i = ps.length - 1; i >= 0; i--) { const o = ps[i], P = o.pts.map(i2s); if (o.kind === 'point') { if (near(P[0], p, 10)) return o; continue; } for (let k = 0; k + 1 < P.length + (o.kind === 'line' ? 0 : 1); k++) { const a = P[k], b = P[(k + 1) % P.length], dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); if (Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1]) < 7) return o; } }
  // bên trong đa giác: chọn chi tiết nhỏ nhất chứa điểm
  let best = null, ba = Infinity; for (const o of ps) { if (o.kind !== 'poly' || o.pts.length < 3) continue; let ins = false; for (let i = 0, j = o.pts.length - 1; i < o.pts.length; j = i++) { const a = o.pts[i], b = o.pts[j]; if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins; } if (ins) { const bb = o.pts.reduce((s, z) => [Math.min(s[0], z[0]), Math.min(s[1], z[1]), Math.max(s[2], z[0]), Math.max(s[3], z[1])], [Infinity, Infinity, -Infinity, -Infinity]), ar = (bb[2] - bb[0]) * (bb[3] - bb[1]); if (ar < ba) { ba = ar; best = o; } } }
  return best;
}
function newPart(kind, pts) {
  const v = view(), p = { id: uid('p'), view: v.id, type: kind === 'point' && st.lastPoint ? st.lastPoint.slice() : [], pts, kind, note: '', num: {} };
  st.model.parts.push(p); st.sel = p.id; if (st.model.template) delete st.model.template; drawSel(); changed();
  const s1 = $('#sdSel select'); if (s1 && !p.type.length) s1.focus();
}
function finishDraft() { const d = st.draft; st.draft = null; if (!d) return; if (st.tool === 'poly' && d.length >= 3) newPart('poly', d); else if (st.tool === 'line' && d.length >= 2) newPart('line', d); paint(); }
function down(e, p) {
  const v = view(); if (!v) return; const q = s2i(p), c = $('#sdCv'); c.setPointerCapture(e.pointerId);
  if (e.button === 1 || st.tool === 'pan') { st.drag = { pan: p }; return; }
  if (e.button !== 0) return;
  const t = st.tool;
  if (t.startsWith('ref:')) { v.refs = v.refs || {}; v.refs[t.slice(4)] = q; const nx = REFS[v.kind].find((k) => !v.refs[k]); if (nx) setTool('ref:' + nx); else setTool('edit'); changed(); return; }
  if (t === 'dim') { if (!st.chain) st.chain = [q]; else { const a = st.chain[st.chain.length - 1], L = measure(calOf(v), a, q); v.dims = v.dims || []; v.dims.push({ a, b: q, m: L ? Math.round(L * 100) / 100 : 0 }); st.chain.push(q); changed(); const ins = $$('#sdRefs input[data-dim]'); if (ins.length && !L) ins[ins.length - 1].focus(); } paint(); return; }
  if (t === 'poly' || t === 'line') { if (t === 'poly' && st.draft && st.draft.length >= 3 && near(i2s(st.draft[0]), p, 10)) { finishDraft(); return; } (st.draft = st.draft || []).push(q); paint(); return; }
  if (t === 'point') { newPart('point', [q]); return; }
  if (t === 'wand') {
    const d = imgData(v); if (!d) { $('#sdHint').textContent = 'Đũa thần cần có ảnh sơ đồ — hình trống thì chấm tay.'; return; }
    const base = e.shiftKey ? st.model.parts.find((o) => o.id === st.sel && o.view === v.id && o.kind === 'poly') : null;
    const r = traceWand(d.data, d.width, d.height, Math.round(q[0]), Math.round(q[1]), { tol: st.tol, skipColor: st.skip !== false, base: base ? base.pts : null });
    if (r.leak) $('#sdHint').textContent = 'Vùng này hở ra ngoài (viền chưa kín) — dùng «Dò trong khung» hoặc chấm tay.';
    else if (r.pts.length >= 3) { if (base && !r.separate) { base.pts = r.pts; changed(); } else { newPart('poly', r.pts); if (base) { const np = st.model.parts[st.model.parts.length - 1]; np.type = base.type.slice(); drawSel(); changed(); $('#sdHint').textContent = 'Vùng này không liền với chi tiết đang chọn — app thêm một chi tiết cùng loại (thân tàu ghép các mảnh lại).'; } } }
    else $('#sdHint').textContent = 'Không lấy được vùng — thử tăng độ nhạy hoặc bấm vào giữa vùng.';
    return;
  }
  if (t === 'box') { st.drag = { box: p }; return; }
  if (t === 'edit') {
    const sp = st.model.parts.find((o) => o.id === st.sel);
    if (sp && sp.view === v.id) { const k = sp.pts.findIndex((z) => near(i2s(z), p)); if (k >= 0) { st.drag = { vtx: sp, k }; return; } }
    const h = hitPart(p); if (h) { st.sel = h.id; drawSel(); drawParts(); paint(); st.drag = { move: h, last: q, moved: false }; return; }
    st.drag = { pan: p, clear: true };
  }
}
function move(e, p) {
  st.mouse = p; const v = view(); if (!v) return; const q = s2i(p), cal = calOf(v);
  if (cal.ok) { const sc = cal.toShip(q), lab = v.kind === 'side' ? ['x', 'z'] : v.kind === 'top' ? ['x', 'y'] : ['y', 'z']; $('#sdPos').textContent = lab[0] + ' = ' + fmt(sc[0], 2) + ' m · ' + lab[1] + ' = ' + fmt(sc[1], 2) + ' m' + (v.kind === 'side' ? ' (x tính từ giữa tàu về mũi, z từ đáy ky)' : ''); }
  const d = st.drag;
  if (d && d.pan) { st.v.cx -= (p[0] - d.pan[0]) / st.v.sc; st.v.cy -= (p[1] - d.pan[1]) / st.v.sc; d.pan = p; d.clear = false; paint(); return; }
  if (d && d.vtx) { d.vtx.pts[d.k] = q; paint(); return; }
  if (d && d.move) { const dx = q[0] - d.last[0], dy = q[1] - d.last[1]; if (!d.moved && Math.hypot(dx, dy) * st.v.sc < 4) return; d.moved = true; d.move.pts = d.move.pts.map(([x, y]) => [x + dx, y + dy]); d.last = q; paint(); return; }
  if (st.draft || st.chain || (d && d.box)) paint();
}
function up(e, p) {
  const d = st.drag; st.drag = null; if (!d) return;
  if (d.box) { const v = view(), img = imgData(v), a = s2i(d.box), b = s2i(p); if (!img) { $('#sdHint').textContent = 'Dò trong khung cần có ảnh sơ đồ.'; paint(); return; } const r = traceBox(img.data, img.width, img.height, [a[0], a[1], b[0], b[1]]); if (r.pts.length >= 3) newPart('poly', r.pts); else { $('#sdHint').textContent = 'Không thấy nét vẽ nào đủ lớn trong khung.'; paint(); } return; }
  if (d.vtx || (d.move && d.moved)) changed(false);
  if (d.pan && d.clear && st.sel) { st.sel = null; drawSel(); drawParts(); paint(); }
}
function dbl(p) {
  if (st.tool === 'poly' || st.tool === 'line') { if (st.draft && st.draft.length) st.draft.pop(); finishDraft(); return; }
  if (st.tool === 'edit') { const sp = st.model.parts.find((o) => o.id === st.sel); if (!sp || sp.kind === 'point') return; const P = sp.pts.map(i2s); let bk = -1, bd = 10; for (let k = 0; k + 1 < P.length + (sp.kind === 'line' ? 0 : 1); k++) { const a = P[k], b = P[(k + 1) % P.length], dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))), dd = Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1]); if (dd < bd) { bd = dd; bk = k; } } if (bk >= 0) { sp.pts.splice(bk + 1, 0, s2i(p)); changed(false); } }
}
function ctx(p) {
  if (st.draft) { st.draft.pop(); if (!st.draft.length) st.draft = null; paint(); return; }
  if (st.chain) { st.chain = null; paint(); return; }
  const sp = st.model.parts.find((o) => o.id === st.sel); if (!sp) return; const k = sp.pts.findIndex((z) => near(i2s(z), p)); if (k >= 0 && sp.pts.length > (sp.kind === 'line' ? 2 : 3)) { sp.pts.splice(k, 1); changed(false); }
}

// ---------- xem 3D ----------
function initPreview() {
  const c = $('#sd3d'); if (!c) return; let r; try { r = new THREE.WebGLRenderer({ canvas: c, antialias: true }); } catch (e) { $('#sd3dInfo').textContent = 'Máy không mở thêm được khung 3D.'; return; }
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b1116); scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.4)); const sun = new THREE.DirectionalLight(0xffffff, 1.3); sun.position.set(-60, 90, 40); scene.add(sun);
  const water = new THREE.Mesh(new THREE.CircleGeometry(400, 48), new THREE.MeshBasicMaterial({ color: 0x1d4a63, transparent: true, opacity: 0.55, depthWrite: false })); water.rotation.x = -Math.PI / 2; scene.add(water);
  st.p3 = { r, scene, cam: new THREE.PerspectiveCamera(32, 1, 0.5, 6000), yaw: -2.25, pitch: 0.32, dist: 1, grp: null, L: 60 };
  let drag = null; c.onpointerdown = (e) => { drag = [e.clientX, e.clientY]; c.setPointerCapture(e.pointerId); };
  c.onpointermove = (e) => { if (!drag || !st.p3) return; st.p3.yaw -= (e.clientX - drag[0]) * 0.01; st.p3.pitch = Math.max(-0.2, Math.min(1.45, st.p3.pitch + (e.clientY - drag[1]) * 0.008)); drag = [e.clientX, e.clientY]; render3d(); };
  c.onpointerup = () => { drag = null; }; c.onwheel = (e) => { e.preventDefault(); if (!st.p3) return; st.p3.dist = Math.max(0.3, Math.min(3, st.p3.dist * (e.deltaY > 0 ? 1.12 : 0.89))); render3d(); };
  rebuild3d();
}
function rebuild3d() {
  if (!st || !st.p3) return; const P = st.p3, s = ship(); let geom;
  try { geom = buildModel(st.model, s); } catch (e) { $('#sd3dInfo').textContent = 'Lỗi dựng mô hình: ' + e.message; console.error(e); return; }
  if (P.grp) { P.scene.remove(P.grp); P.grp.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
  P.grp = modelGroup(THREE, geom); P.scene.add(P.grp); P.L = geom.dims.L; st.geom = geom;
  const a = geom.areas; $('#sd3dInfo').innerHTML = `Dài ${fmt(geom.dims.L)} m · rộng ${fmt(geom.dims.B)} m · tĩnh không ${fmt(a.air)} m<br>Hứng gió: mạn ${Math.round(a.AL)} m² · trước ${Math.round(a.AF)} m² · tâm ${fmt(a.xc)} m${geom.warn.length ? '<br><span style="color:#FFB547">' + geom.warn.map(esc).join('<br>') + '</span>' : ''}`;
  render3d();
}
function render3d() {
  const P = st && st.p3; if (!P) return; const c = $('#sd3d'), w = c.clientWidth | 0, h = c.clientHeight | 0; if (!w || !h) return;
  P.r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); P.r.setSize(w, h, false); P.cam.aspect = w / h;
  const R = P.L * 1.25 * P.dist; P.cam.position.set(Math.sin(P.yaw) * Math.cos(P.pitch) * R, Math.sin(P.pitch) * R + 2, Math.cos(P.yaw) * Math.cos(P.pitch) * R); P.cam.lookAt(0, 3, 0); P.cam.updateProjectionMatrix();
  P.r.render(P.scene, P.cam);
}

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
    st.model = o.model; st.model.opts = st.model.opts || { shade: 'haze', rails: true }; st.cur = st.model.views[0] ? st.model.views[0].id : null; st.sel = null; st.img.clear(); st.data.clear(); st.fitted = false;
    fitView(); refreshAll(); changed(); for (const v of st.model.views) loadImg(v); $('#sdMsg').textContent = 'Đã nhập «' + (st.model.name || f.name) + '».';
  } catch (e) { $('#sdMsg').textContent = 'Không nhập được: ' + (e.message || e); }
}
// cho kiểm thử tự động
export const shipDrawTest = { st: () => st, rebuild: () => { refreshAll(); rebuild3d(); }, atH };
