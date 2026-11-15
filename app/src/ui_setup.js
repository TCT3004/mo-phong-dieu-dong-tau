// Tab 1 (tàu), tab 2 (hải đồ), tab 4 (môi trường & kịch bản), cài đặt.
import { A, $, $$, num, esc, LS, DB, saveShip, saveEnv, saveSet, saveObjs, loadObjs, rebuildModel, startPos, pad3 } from './app.js';
import { defaultShip, turningDiameter, KN } from './physics.js';
import { decodeKap, parseKapHeader, pxToLL, fmtLL, mToPx, makeGeo } from './kap.js';
import { fmtDist, legs, llToM, mToLL, fmtLat, fmtLon, parseCoord, parseLatLon, pad3 as p3 } from './nav.js';
import { ChartView } from './chartview.js';
import { defaultEnv, tideAt } from './world.js';
import { QUALITY } from './view3d.js';
import { openWindage } from './windage.js';

const fld = (k, label, unit, val, attr) => `<div class="fld"><label for="f_${k}">${label}</label><div class="in"><input id="f_${k}" data-k="${k}" value="${esc(val)}" ${attr || ''}>${unit ? `<span class="u">${unit}</span>` : ''}</div></div>`;
const sel = (k, label, opts, val) => `<div class="fld"><label for="f_${k}">${label}</label><div class="in"><select id="f_${k}" data-k="${k}">${opts.map((o) => `<option value="${o[0]}" ${String(o[0]) === String(val) ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div></div>`;

// ---------------- Tab 1: thông số tàu ----------------
const SHIP = [
  ['Thông tin chung', 'g3', [['name', 'Tên tàu', '', 't'], ['type', 'Loại tàu', '', 't'], ['load', 'Trạng thái tải', [['loaded', 'Có hàng'], ['ballast', 'Ballast']]]]],
  ['Kích thước & tải trọng', 'g4', [['loa', 'Chiều dài toàn bộ (LOA)', 'm'], ['lpp', 'Chiều dài hai trụ (LPP)', 'm'], ['B', 'Chiều rộng (B)', 'm'], ['D', 'Chiều cao mạn (D)', 'm'], ['tf', 'Mớn nước mũi', 'm'], ['ta', 'Mớn nước lái', 'm'], ['disp', 'Lượng giãn nước', 't'], ['cb', 'Hệ số béo (Cb)', '']]],
  ['Máy chính & chân vịt', 'g4', [['engines', 'Số máy & chân vịt', [[1, '1 máy · 1 chân vịt'], [2, '2 máy · 2 chân vịt'], [3, '3 máy · 3 chân vịt'], [4, '4 máy · 4 chân vịt']]], ['ptype', 'Loại chân vịt', [['fpp', 'Bước cố định'], ['cpp', 'Biến bước']]], ['rotDir', 'Chiều quay (tàu 1 hoặc 3 máy)', [['right', 'Chiều phải'], ['left', 'Chiều trái']]], ['accTime', 'Dừng → Tiến max', 's'], ['propD', 'Đường kính chân vịt', 'm'], ['PD', 'Tỷ số bước (P/D)', ''], ['wP', 'Hệ số dòng theo', ''], ['tP', 'Hệ số lực hút', '']]],
  ['Bánh lái & quay trở', 'g4', [['rudMax', 'Góc lái tối đa', '°'], ['rudTime', 'Hết trái → hết phải', 's'], ['rudders', 'Số bánh lái', ''], ['respTime', 'Thời gian ăn lái', 's'], ['AR', 'Diện tích một bánh lái', 'm²'], ['hR', 'Chiều cao bánh lái', 'm'], ['turnDia', 'Đường kính quay trở (tiến max, lái 35°)', 'm'], ['gammaR', 'Hệ số nắn dòng', '']]],
  ['Neo & dây buộc', 'g4', [['bowAnchors', 'Số neo mũi', [[1, '1 neo (chính giữa)'], [2, '2 neo']]], ['sternAnchors', 'Số neo lái', [[0, 'Không có'], [1, '1 neo (chính giữa)'], [2, '2 neo']]], ['chainLen', 'Chiều dài xích neo', 'm'], ['anchorW', 'Trọng lượng quả neo', 't'], ['chainW', 'Trọng lượng 1 m xích', 'kg/m'], ['lineR', 'Bán kính dây buộc', 'mm'], ['lineLen', 'Chiều dài dây buộc', 'm']]],
  ['Hứng gió', 'g3', [['windAL', 'Diện tích hứng gió mạn', 'm²'], ['windAF', 'Diện tích hứng gió chính diện', 'm²'], ['windXc', 'Tâm hứng gió (+ về mũi)', 'm']]]
];
const FX = [['shallow', 'Nước nông & squat'], ['bank', 'Hiệu ứng bờ luồng'], ['prop', 'Lực ngang chân vịt'], ['env', 'Gió, sóng']];
export function initShip() {
  const p = A.p, el = $('#p-ship');
  el.innerHTML = `<div class="flex" style="justify-content:space-between;align-items:flex-end;margin-bottom:10px"><div><div style="font-size:20px;font-weight:700">Thông số tính năng điều động của tàu</div><div class="muted">Lấy từ Pilot card / Wheelhouse poster. Màn Điều động tính toán trực tiếp từ các số này.</div></div>
  <div><button class="btn" id="shipReset">Về tàu mẫu</button> <button class="btn" id="shipExport">Lưu ra file</button> <label class="btn" style="display:inline-flex;align-items:center">Mở từ file<input type="file" id="shipImport" accept=".json" hidden></label></div></div>
  <div id="shipCalc" class="note" style="margin-bottom:12px"></div>
  <div class="flex"><div class="col" style="flex:1 1 560px">${SHIP.map((g) => `<section class="card"><h2>${g[0]}</h2><div class="grid ${g[1]}">${g[2].map((f) => Array.isArray(f[2]) ? sel(f[0], f[1], f[2], p[f[0]]) : fld(f[0], f[1], f[2], p[f[0]], f[3] ? 'data-t="1"' : 'inputmode="decimal"')).join('')}</div></section>`).join('')}</div>
  <div class="col" style="flex:1 1 420px"><section class="card"><h2>Bảng nấc máy (tay chuông)</h2><div class="muted" style="margin-bottom:6px">Mỗi dòng là một nút trên tay chuông. Tàu nhiều máy: bảng áp dụng cho từng máy. Tốc độ lùi để trống — app tự tính.</div>
  <table><thead><tr><th>Nấc</th><th>Vòng quay (v/ph)</th><th>Tốc độ có hàng (hl/h)</th><th>Tốc độ ballast (hl/h)</th></tr></thead><tbody>${p.steps.map((s, i) => `<tr><th>${s.label}</th><td><input class="cell mono" data-s="${i}" data-c="rpm" value="${s.rpm}" aria-label="Vòng quay ${s.label}"></td><td>${s.id[0] === 'f' ? `<input class="cell mono" data-s="${i}" data-c="kn" value="${s.kn}" aria-label="Tốc độ có hàng ${s.label}">` : '—'}</td><td>${s.id[0] === 'f' ? `<input class="cell mono" data-s="${i}" data-c="knB" value="${s.knB}" aria-label="Tốc độ ballast ${s.label}">` : '—'}</td></tr>`).join('')}</tbody></table></section>
  <section class="card"><h2>Hiệu ứng tính thêm</h2>${FX.map((f) => `<label style="display:flex;gap:8px;align-items:center;padding:4px 0"><input type="checkbox" data-fx="${f[0]}" ${p.fx[f[0]] ? 'checked' : ''} style="width:17px;height:17px"> ${f[1]}</label>`).join('')}
  <div class="muted" style="margin-top:6px">Mô hình thân tàu – chân vịt – bánh lái tách rời (kiểu MMG), hệ số thân tàu ước tính theo Kijima từ L, B, mớn nước, Cb. Chưa có: tương tác tàu–tàu.</div></section></div></div>`;
  const wg = Array.from(el.querySelectorAll('section h2')).find((h) => h.textContent === 'Hứng gió');
  if (wg) { wg.parentNode.insertAdjacentHTML('beforeend', '<div class="flex" style="gap:10px;align-items:center;margin-top:10px"><button class="btn sm pri" id="windBtn">Tính từ sơ đồ tàu (PDF / ảnh)…</button><span class="muted">Mở bản vẽ bố trí chung, app tách bóng tàu và tính 3 số trên.</span></div>'); $('#windBtn').onclick = () => openWindage(); }
  let tm = null;
  const changed = () => { saveShip(); clearTimeout(tm); tm = setTimeout(() => { calcShip(); if (A.hooks.shipChanged) A.hooks.shipChanged(); }, 400); };
  el.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.k) { p[t.dataset.k] = t.dataset.t || t.tagName === 'SELECT' && isNaN(+t.value) ? t.value : num(t.value, p[t.dataset.k]); if (t.dataset.k === 'engines') { p.engines = +t.value; p.props = p.engines; } changed(); }
    else if (t.dataset.s) { p.steps[+t.dataset.s][t.dataset.c] = num(t.value, 0); changed(); }
    else if (t.dataset.fx) { p.fx[t.dataset.fx] = t.checked; changed(); }
  });
  $('#shipReset').onclick = () => { if (confirm('Đưa mọi thông số về tàu mẫu?')) { A.p = defaultShip(); saveShip(); initShip(); if (A.hooks.shipChanged) A.hooks.shipChanged(); } };
  $('#shipExport').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(A.p, null, 1)], { type: 'application/json' })); a.download = (A.p.name || 'tau') + '.json'; a.click(); };
  $('#shipImport').onchange = async (e) => { try { const o = JSON.parse(await e.target.files[0].text()); A.p = Object.assign(defaultShip(), o); saveShip(); initShip(); if (A.hooks.shipChanged) A.hooks.shipChanged(); } catch (x) { alert('File không đọc được'); } };
  calcShip();
}
function calcShip() {
  const M = rebuildModel(), td = turningDiameter(M);
  const warn = M.rCal <= 0.26 || M.rCal >= 4.9;
  $('#shipCalc').className = 'note ' + (warn ? '' : 'ok');
  $('#shipCalc').innerHTML = `App đã hiệu chỉnh theo số bạn nhập: tốc độ từng nấc tiến khớp bảng nấc máy; đường kính quay trở tính ra <b>${td.toFixed(0)} m</b> (bạn nhập ${num(A.p.turnDia, 0)} m, hệ số hiệu chỉnh bánh lái ${M.rCal.toFixed(2)}). Mớn nước trung bình ${M.d.toFixed(2)} m.` + (warn ? ' <b>Không khớp được đường kính quay trở</b> — kiểm tra lại diện tích bánh lái hoặc đường kính quay trở.' : '');
}

// ---------------- Tab 2: hải đồ ----------------
let cv = null, tool = 'pan', selObj = null, draft = null, meas = null, dragWP = -1, dragBol = null;
const selRoute = () => { const o = A.W.objs; return o.routes && o.routeSel >= 0 ? o.routes[o.routeSel] || null : null; };
function nearWP(p) { const r = selRoute(); if (!r || !cv) return -1; let bi = -1, bd = 12; r.pts.forEach((q, i) => { const s2 = cv.m2s(q[0], q[1]), d = Math.hypot(s2[0] - p[0], s2[1] - p[1]); if (d < bd) { bd = d; bi = i; } }); return bi; }
export function chartView() { return cv; }
export async function addChartFiles(files) {
  let n = 0;
  for (const f of files) {
    if (!/\.kap$/i.test(f.name)) continue;
    try {
      const head = new Uint8Array(await f.slice(0, 60000).arrayBuffer()); const H = parseKapHeader(head);
      const key = f.name; A.charts = A.charts.filter((c) => c.key !== key);
      let bb = null; try { const g = makeGeo(H); if (g.ok) { const a = pxToLL(g, 0, 0), b = pxToLL(g, H.W, H.H); bb = [Math.min(a[0], b[0]), Math.max(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[1], b[1])]; } } catch (e) { bb = null; }
      A.charts.push({ key, name: H.name || f.name, nu: H.nu || '', scale: H.scale, bb, file: f, path: f.webkitRelativePath || f.name }); n++;
      DB.put('charts', key, f);
    } catch (e) { A.charts = A.charts.filter((c) => c.key !== f.name); A.charts.push({ key: f.name, name: f.name, bad: String(e.message || e), path: f.webkitRelativePath || f.name }); }
  }
  A.charts.sort((a, b) => a.name.localeCompare(b.name)); drawLib();
  return n;
}
export async function activateChart(key) {
  const c = A.charts.find((q) => q.key === key); if (!c || c.bad) return;
  const st = $('#chartStatus'); st.className = 'note'; st.textContent = 'Đang đọc ' + c.name + '…';
  try {
    const bytes = new Uint8Array(await c.file.arrayBuffer());
    const ch = await decodeKap(bytes, (f) => { st.textContent = 'Đang đọc ' + c.name + '… ' + Math.round(f * 100) + '%'; });
    ch.key = key; A.W.setChart(ch); loadObjs(); LS.set('mp_lastChart', key);
    if (!A.W.start) { A.W.start = findWater(); saveObjs(); }
    cv.chart = ch; cv.fit(); selObj = null;
    st.className = 'note ok'; st.textContent = 'Đang dùng: ' + ch.name + ' · tỷ lệ 1:' + ch.header.scale + ' · ' + ch.W + ' × ' + ch.H + ' điểm ảnh · ' + (ch.geo.ok ? 'đã có tọa độ' : 'KHÔNG có điểm tọa độ');
    drawLib(); drawChart(); drawSide(); if (A.hooks.chartChanged) A.hooks.chartChanged();
  } catch (e) { st.className = 'note bad'; st.textContent = 'Không đọc được ' + c.name + ': ' + (e.message || e); }
}
function findWater() {
  const c = A.W.chart, cx = c.gw >> 1, cy = c.gh >> 1; let best = null, bd = 1e12;
  for (let y = 20; y < c.gh - 20; y += 12) for (let x = 20; x < c.gw - 20; x += 12) {
    if (c.grid[y * c.gw + x] !== 4) continue; let ok = true;
    for (const [dx, dy] of [[-40, 0], [40, 0], [0, -40], [0, 40]]) if (c.grid[(y + dy > 0 ? Math.min(c.gh - 1, y + dy) : 0) * c.gw + Math.max(0, Math.min(c.gw - 1, x + dx))] !== 4) ok = false;
    const d = (x - cx) ** 2 + (y - cy) ** 2; if (ok && d < bd) { bd = d; best = [x, y]; }
  }
  if (!best) return { x: 0, y: 0, hdg: 0 };
  return { x: (best[0] * 4 - c.W / 2) * c.geo.mpp, y: -(best[1] * 4 - c.H / 2) * c.geo.mpp, hdg: 0 };
}
const norm = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
const normA = (t) => norm(t).replace(/[^a-z0-9]/g, '');
let libQ = '', libLL = null;
function drawLib() {
  const el = $('#chartLib'); if (!el) return; const cur = A.W.chart && A.W.chart.key;
  let list = A.charts;
  if (libQ) { const q = norm(libQ).trim(), qa = normA(libQ); list = list.filter((c) => { const hay = [c.name, c.key, c.nu, c.path].map(norm).join(' | '); return hay.includes(q) || (qa && [c.name, c.key, c.nu, c.path].map(normA).some((h) => h.includes(qa))); }); }
  if (libLL) { list = list.filter((c) => c.bb && libLL[0] >= c.bb[0] && libLL[0] <= c.bb[1] && libLL[1] >= c.bb[2] && libLL[1] <= c.bb[3]).sort((a, b) => (a.scale || 1e9) - (b.scale || 1e9)); }
  const info = $('#libInfo'); if (info) info.textContent = libQ || libLL ? 'Tìm thấy ' + list.length + ' / ' + A.charts.length + ' hải đồ' + (libLL ? ' có chứa ' + fmtLL(libLL[0], libLL[1]) + ' (tỷ lệ lớn nhất trước)' : '') : A.charts.length ? A.charts.length + ' hải đồ' : '';
  el.innerHTML = list.length ? list.map((c) => `<button data-key="${esc(c.key)}" class="${c.key === cur ? 'on' : ''}" ${c.bad ? 'disabled' : ''}><b>${esc(c.name)}</b>${c.scale ? ' · 1:' + c.scale : ''}${c.nu && c.nu !== c.name ? ' · số ' + esc(c.nu) : ''}<br><span class="muted">${esc(c.path)}${c.bad ? ' — ' + esc(c.bad) : ''}</span></button>`).join('') : `<div class="muted">${A.charts.length ? 'Không có hải đồ nào khớp.' : 'Chưa có hải đồ. Thêm thư mục hoặc file .kap.'}</div>`;
}
const KIND = [['light', 'Đèn trên bờ / đảo'], ['buoyR', 'Phao trái luồng (đỏ)'], ['buoyG', 'Phao phải luồng (xanh)'], ['buoyY', 'Phao khác (vàng)']];
function drawSide() {
  const el = $('#chartSide'), W = A.W; if (!el) return;
  let h = '';
  if (selObj && selObj.t === 'light') {
    const o = selObj.o;
    h += `<section class="card"><h2>Đang chọn: đèn / phao</h2><div class="grid g2">${fld('o_name', 'Tên / số hiệu', '', o.name || '', 'data-t="1"')}${sel('o_kind', 'Loại', KIND, o.kind)}${sel('o_color', 'Màu đèn', [['W', 'Trắng'], ['R', 'Đỏ'], ['G', 'Xanh lục'], ['Y', 'Vàng']], o.color)}${fld('o_period', 'Chu kỳ chớp', 's', o.period)}${fld('o_flash', 'Thời gian sáng', 's', o.flash)}${fld('o_height', 'Độ cao đèn', 'm', o.height)}</div><button class="btn warn sm" id="oDel" style="margin-top:8px">Xóa</button></section>`;
  } else if (selObj && selObj.t === 'berth') {
    const o = selObj.o;
    h += `<section class="card"><h2>Đang chọn: cầu bến</h2><div class="grid g2">${fld('o_name', 'Tên bến', '', o.name || '', 'data-t="1"')}${fld('o_depth', 'Độ sâu trước bến', 'm', o.depth)}${fld('o_top', 'Cao trình mặt cầu', 'm', o.top)}${fld('o_spacing', 'Khoảng cách bích', 'm', o.spacing)}</div><div class="muted" style="margin-top:6px">${o.pts.length - 1} đoạn · dài ${(o._len || 0).toFixed(0)} m · ${W.bollards.length} cọc bích trên toàn hải đồ.</div>${bolList(o)}<button class="btn warn sm" id="oDel" style="margin-top:8px">Xóa cầu bến</button></section>`;
  } else if (selObj && selObj.t === 'sound') {
    h += `<section class="card"><h2>Đang chọn: điểm độ sâu</h2>${fld('o_d', 'Độ sâu', 'm', selObj.o.d)}<button class="btn warn sm" id="oDel" style="margin-top:8px">Xóa</button></section>`;
  }
  if (A.sim && A.sim.t >= 2) { const S = A.sim.S, st0 = startPos(), dd = Math.hypot(S.x - st0.x, S.y - st0.y); if (dd > 20) h += `<section class="card"><h2>Vị trí tàu</h2><div class="muted">Bài tập đang dở: tàu đang cách vị trí xuất phát ${fmtDist(dd)} (hình tàu màu xanh lục trên hải đồ). Hải đồ tab 3 hiện vị trí tàu lúc này.</div><button class="btn sm" id="toStart" style="margin-top:8px;width:100%">Đưa tàu về vị trí xuất phát (bắt đầu lại)</button></section>`; }
  if (tool === 'route') h += routeCard();
  const sp = startPos();
  h += `<section class="card"><h2>Độ sâu theo màu hải đồ</h2><div class="muted" style="margin-bottom:6px">App đọc màu hải đồ để chia vùng. Nhập độ sâu đại diện cho từng vùng; trước cầu bến dùng «Độ sâu trước bến» của bến đó.</div><div class="grid g3">${fld('cd4', 'Vùng trắng (sâu)', 'm', W.classDepth[4])}${fld('cd3', 'Xanh nhạt', 'm', W.classDepth[3])}${fld('cd2', 'Xanh đậm', 'm', W.classDepth[2])}</div><div class="muted" style="margin-top:6px">Bãi cạn (xanh lá) hở ${-W.classDepth[1]} m trên số 0 hải đồ; đất liền luôn là bờ.</div></section>
  <section class="card"><h2>Trên hải đồ này</h2><div class="kv"><span>Đèn / phao</span><b>${W.objs.lights.length}</b></div><div class="kv"><span>Cầu bến · bích</span><b>${W.objs.berths.length} · ${W.bollards.length}</b></div><div class="kv"><span>Vị trí xuất phát</span><b>${W.chart ? fmtLL(...pxToLL(W.chart.geo, ...mToPx(W.chart.geo, sp.x, sp.y))) : '—'}</b></div></section>`;
  el.innerHTML = h;
}
const TOOLS = [['pan', 'Chọn / kéo'], ['light', 'Đèn / phao'], ['berth', 'Cầu bến'], ['bollard', 'Cọc bích'], ['route', 'Tuyến đi'], ['start', 'Vị trí xuất phát'], ['measure', 'Đo']];
const HINT = { pan: 'Kéo để di chuyển, lăn chuột để phóng to. Bấm vào đèn hoặc cầu bến để sửa. Bấm chuột phải vào đèn / cầu bến để xóa.', light: 'Bấm lên vị trí đèn hoặc phao trên hải đồ, rồi sửa thông tin ở khung bên phải.', berth: 'Bấm lần lượt dọc mép cầu (phía nước). Bấm đúp để kết thúc. Bấm chuột phải để bỏ điểm vừa đặt. Bích buộc dây tự đặt đều theo khoảng cách bạn nhập.', sound: 'Bấm lên con số độ sâu trên hải đồ rồi gõ giá trị.', start: 'Bấm lên chỗ tàu xuất phát. Hướng ban đầu nhập ở tab 4.', bollard: 'Kéo cọc bích dọc mép cầu để dời. Bấm lên mép cầu để thêm cọc. Chuột phải vào cọc để xóa. Số khoảng cách từ đầu bến hiện ở khung bên phải (bấm vào cầu bến bằng «Chọn / kéo» để xem).', measure: 'Bấm hai điểm để đo khoảng cách (hải lý, gần thì mét) và phương vị. Chuột phải để bỏ.', route: 'Bấm lên hải đồ để thêm điểm vào cuối tuyến đang chọn. Kéo một điểm để dời. Chuột phải vào điểm để xóa. Nhập tọa độ ở khung bên phải cũng được. Tuyến đang chọn hiện ở tab 3.' };
export function initChart() {
  $('#p-chart').innerHTML = `<div class="flex" style="align-items:flex-start">
  <div class="col" style="flex:1 1 260px;max-width:320px"><section class="card"><h2>Thư viện hải đồ (.kap)</h2><div class="muted" style="margin-bottom:8px">Thêm bao nhiêu thư mục cũng được — app quét cả thư mục con và chỉ lấy file .kap. File .rar / .zip cần giải nén trước.</div>
  <label class="btn" style="display:flex;align-items:center;justify-content:center;margin-bottom:6px">+ Thêm thư mục<input type="file" id="dirIn" webkitdirectory multiple hidden></label>
  <label class="btn" style="display:flex;align-items:center;justify-content:center;margin-bottom:8px">+ Thêm file .kap<input type="file" id="fileIn" accept=".kap,.KAP" multiple hidden></label>
  <div class="drop" id="dropZone">hoặc kéo thả file .kap vào đây</div>
  <div class="fld" style="margin-top:10px"><label for="libQ">Tìm theo tên / số hải đồ</label><div class="in"><input id="libQ" placeholder="vd: 25-181 hoặc Van Hoa" autocomplete="off"><button class="btn sm" id="libQx" style="border:0;background:transparent" aria-label="Xóa ô tìm">✕</button></div></div>
  <div class="fld" style="margin-top:6px"><label for="libLL">Tìm theo tọa độ (hải đồ có chứa điểm này)</label><div class="in"><input id="libLL" placeholder="vd: 21°05'N 107°28'E" autocomplete="off"><button class="btn sm" id="libLLx" style="border:0;background:transparent" aria-label="Xóa tọa độ">✕</button></div></div>
  <div class="muted" id="libInfo" style="margin-top:6px"></div><div class="lib" id="chartLib" style="margin-top:6px;max-height:330px;overflow:auto"></div></section></div>
  <div class="col" style="flex:999 1 560px"><div id="chartStatus" class="note">Chưa nạp hải đồ — app đang chạy ở «biển trống», sâu 30 m.</div><section class="card" style="padding:0;overflow:hidden"><div class="tool" style="padding:8px 8px 4px;background:#0E161C;border-bottom:1px solid #22303A"><span id="toolBtns"></span><button class="btn sm" id="fitBtn">Xem toàn bộ</button></div><div style="position:relative"><canvas id="chartCv"></canvas></div><div class="muted mono" id="chartPos" style="padding:6px 10px;background:#0E161C">—</div></section></div>
  <div class="col" style="flex:1 1 280px;max-width:340px"><div class="note" id="chartHint"></div><div class="col" id="chartSide"></div></div></div>`;
  cv = new ChartView($('#chartCv'));
  const tb = () => { $('#toolBtns').innerHTML = TOOLS.map((t) => `<button class="btn sm ${tool === t[0] ? 'pri' : ''}" data-tool="${t[0]}">${t[1]}</button>`).join(''); $('#chartHint').textContent = HINT[tool]; };
  tb();
  $('#toolBtns').onclick = (e) => { const t = e.target.dataset.tool; if (t) { tool = t; draft = null; meas = null; tb(); drawChart(); drawSide(); } };
  $('#fitBtn').onclick = () => { cv.size(); cv.fit(); drawChart(); };
  $('#dirIn').onchange = async (e) => { const n = await addChartFiles(e.target.files); if (!n) alert('Không thấy file .kap nào trong thư mục này.'); else if (!A.W.chart) activateChart(A.charts.find((c) => !c.bad).key); e.target.value = ''; };
  $('#fileIn').onchange = async (e) => { const n = await addChartFiles(e.target.files); if (n && !A.W.chart) activateChart(A.charts.find((c) => !c.bad).key); e.target.value = ''; };
  const dz = $('#dropZone'); dz.ondragover = (e) => { e.preventDefault(); }; dz.ondrop = async (e) => { e.preventDefault(); const n = await addChartFiles(e.dataTransfer.files); if (n && !A.W.chart) activateChart(A.charts.find((c) => !c.bad).key); };
  $('#chartLib').onclick = (e) => { const b = e.target.closest('button'); if (b) activateChart(b.dataset.key); };
  $('#libQ').oninput = (e) => { libQ = e.target.value; drawLib(); };
  $('#libQ').onkeydown = (e) => { if (e.key === 'Enter') { const b = $$('#chartLib button:not([disabled])'); if (b.length) activateChart(b[0].dataset.key); } };
  $('#libQx').onclick = () => { libQ = ''; $('#libQ').value = ''; drawLib(); };
  $('#libLL').oninput = (e) => { const v = parseLatLon(e.target.value); libLL = isFinite(v[0]) && isFinite(v[1]) ? v : null; drawLib(); };
  $('#libLLx').onclick = () => { libLL = null; $('#libLL').value = ''; drawLib(); };
  const c = $('#chartCv'); let drag = null, moved = false;
  const pos = (e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
  c.onpointerdown = (e) => { if (e.button === 2) return; drag = pos(e); moved = false; c.setPointerCapture(e.pointerId); dragWP = tool === 'route' ? nearWP(drag) : -1; dragBol = null; if (tool === 'bollard') { const q = nearBollard(drag); if (q) { const b = A.W.objs.berths[q.bi], arr = ensureBols(b, q.bi); let k = 0; arr.forEach((v, i) => { if (Math.abs(v - q.s) < Math.abs(arr[k] - q.s)) k = i; }); dragBol = { bi: q.bi, k }; selObj = { t: 'berth', o: b }; } } };
  c.onpointermove = (e) => {
    const p = pos(e), [mx, my] = cv.s2m(p[0], p[1]);
    if (A.W.chart) { const [px, py] = cv.s2p(p[0], p[1]); $('#chartPos').textContent = fmtLL(...pxToLL(A.W.chart.geo, px, py)) + ' · độ sâu hải đồ ' + A.W.depthAt(mx, my).toFixed(1) + ' m' + (meas && meas.length === 1 ? ' · đo: ' + fmtDist(Math.hypot(mx - meas[0][0], my - meas[0][1])) : ''); }
    if (drag && dragBol) { const b = A.W.objs.berths[dragBol.bi], a = A.W.alongBerth(dragBol.bi, mx, my); if (a) { b.bols[dragBol.k] = Math.max(0, Math.min(b._len || 0, a.s)); A.W.rebuild(); moved = true; drawChart(); } return; }
    if (drag && dragWP >= 0) { const r = selRoute(); if (r && r.pts[dragWP]) { r.pts[dragWP] = [mx, my]; moved = true; drawChart(); } return; }
    if (drag && (tool === 'pan' || e.buttons === 4 || moved)) { const dx = p[0] - drag[0], dy = p[1] - drag[1]; if (Math.abs(dx) + Math.abs(dy) > 3 || moved) { moved = true; cv.cx -= dx / cv.sc; cv.cy -= dy / cv.sc; drag = p; drawChart(); } }
    else if (drag && Math.hypot(p[0] - drag[0], p[1] - drag[1]) > 6) { moved = true; }
  };
  c.onpointerup = (e) => { const p = pos(e); if (dragBol) { const was = moved, b = A.W.objs.berths[dragBol.bi]; dragBol = null; drag = null; if (was) { if (Array.isArray(b.bols)) b.bols.sort((p, q) => p - q); objsChanged(); return; } }
    if (dragWP >= 0 && moved) { dragWP = -1; drag = null; objsChanged(); return; } dragWP = -1; if (drag && !moved) clickChart(p, e.detail >= 2); drag = null; };
  c.ondblclick = () => { if (tool === 'berth' && draft && draft.length >= 2) { A.W.objs.berths.push({ name: 'Bến ' + (A.W.objs.berths.length + 1), pts: draft, depth: 8, top: 4.5, spacing: 25 }); selObj = { t: 'berth', o: A.W.objs.berths[A.W.objs.berths.length - 1] }; draft = null; objsChanged(); } };
  c.oncontextmenu = (e) => {
    e.preventDefault(); const p = pos(e), W = A.W, near = (ox, oy) => { const q = cv.m2s(ox, oy); return Math.hypot(q[0] - p[0], q[1] - p[1]); };
    if (draft && draft.length) { draft.pop(); if (!draft.length) draft = null; drawChart(); return; }
    if (meas) { meas = null; drawChart(); return; }
    const wi = nearWP(p); if (wi >= 0) { selRoute().pts.splice(wi, 1); objsChanged(); return; }
    if (tool === 'bollard') { const q = nearBollard(p); if (q) { const b = W.objs.berths[q.bi], arr = ensureBols(b, q.bi); let k = 0; arr.forEach((v, i) => { if (Math.abs(v - q.s) < Math.abs(arr[k] - q.s)) k = i; }); arr.splice(k, 1); selObj = { t: 'berth', o: b }; objsChanged(); } return; }
    let best = null, bd = 16;
    for (const o of W.objs.lights) { const d = near(o.x, o.y); if (d < bd) { bd = d; best = [W.objs.lights, o]; } }
    for (const o of W.objs.berths) for (let i = 0; i + 1 < o.pts.length; i++) for (let t = 0; t <= 1; t += 0.05) { const d = near(o.pts[i][0] + (o.pts[i + 1][0] - o.pts[i][0]) * t, o.pts[i][1] + (o.pts[i + 1][1] - o.pts[i][1]) * t); if (d < bd) { bd = d; best = [W.objs.berths, o]; } }
    if (best) { best[0].splice(best[0].indexOf(best[1]), 1); selObj = null; objsChanged(); }
  };
  c.onwheel = (e) => { e.preventDefault(); const p = pos(e), [px, py] = cv.s2p(p[0], p[1]), k = e.deltaY > 0 ? 0.8 : 1.25; cv.sc = Math.max(0.02, Math.min(8, cv.sc * k)); const [qx, qy] = cv.s2p(p[0], p[1]); cv.cx += px - qx; cv.cy += py - qy; drawChart(); };
  $('#chartSide').addEventListener('change', (e) => {
    const t = e.target, o = A.W.objs, r = selRoute(), g = A.W.chart && A.W.chart.geo;
    if (t.id === 'rtSel') { o.routeSel = +t.value; objsChanged(); return; }
    if (t.dataset.bol !== undefined && selObj && selObj.t === 'berth') { const b = selObj.o, bi = o.berths.indexOf(b), arr = ensureBols(b, bi), v = num(t.value, NaN); if (isFinite(v)) { arr[+t.dataset.bol] = Math.max(0, Math.min(b._len || v, v)); arr.sort((p, q) => p - q); objsChanged(); } return; }
    if (t.id === 'rtName' && r) { r.name = t.value.trim() || r.name; objsChanged(); return; }
    if ((t.dataset.wl || t.dataset.wn) && r && g) {
      const i = +(t.dataset.wl || t.dataset.wn), la = parseCoord($(`[data-wl="${i}"]`).value, true), lo = parseCoord($(`[data-wn="${i}"]`).value, false);
      if (isFinite(la) && isFinite(lo)) { r.pts[i] = llToM(g, la, lo); objsChanged(); } else { t.style.borderColor = '#FF6B6B'; }
      return;
    }
    const k = e.target.dataset.k; if (!k) return; const v = e.target.value;
    if (k.startsWith('cd')) { A.W.classDepth[+k[2]] = num(v, A.W.classDepth[+k[2]]); objsChanged(); return; }
    if (!selObj) return; const key = k.slice(2);
    selObj.o[key] = e.target.dataset.t || e.target.tagName === 'SELECT' ? v : num(v, 0);
    if (key === 'kind') selObj.o.color = v === 'buoyR' ? 'R' : v === 'buoyG' ? 'G' : v === 'buoyY' ? 'Y' : selObj.o.color;
    objsChanged();
  });
  $('#chartSide').addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return; const o = A.W.objs, r = selRoute(), g = A.W.chart && A.W.chart.geo;
    if ((t.id === 'bolAdd' || t.id === 'bolReset') && selObj && selObj.t === 'berth') { const b = selObj.o, bi = o.berths.indexOf(b); if (t.id === 'bolReset') delete b.bols; else { const arr = ensureBols(b, bi); let gs = 0, gi = 0; const pts2 = [0, ...arr, b._len || 0]; for (let i = 0; i + 1 < pts2.length; i++) if (pts2[i + 1] - pts2[i] > gs) { gs = pts2[i + 1] - pts2[i]; gi = i; } arr.push((pts2[gi] + pts2[gi + 1]) / 2); arr.sort((p, q) => p - q); } objsChanged(); return; }
    if (t.id === 'toStart' && A.hooks.resetToStart) { A.hooks.resetToStart(true); drawChart(); drawSide(); return; }
    if (t.id === 'rtNew') { o.routes = o.routes || []; o.routes.push({ name: 'Tuyến ' + (o.routes.length + 1), pts: [] }); o.routeSel = o.routes.length - 1; objsChanged(); return; }
    if (t.id === 'rtDel' && r) { if (confirm('Xóa tuyến «' + r.name + '»?')) { o.routes.splice(o.routeSel, 1); o.routeSel = o.routes.length ? 0 : -1; objsChanged(); } return; }
    if (t.dataset.wdel !== undefined && r) { r.pts.splice(+t.dataset.wdel, 1); objsChanged(); return; }
    if (t.id === 'rtAdd' && g) {
      const la = parseCoord($('#rtLat').value, true), lo = parseCoord($('#rtLon').value, false);
      if (!isFinite(la) || !isFinite(lo)) { $('#rtErr').textContent = 'Không đọc được tọa độ — kiểm tra lại vĩ độ / kinh độ.'; $('#rtErr').style.color = '#FF8A8A'; return; }
      let rr = r; if (!rr) { o.routes = o.routes || []; o.routes.push({ name: 'Tuyến ' + (o.routes.length + 1), pts: [] }); o.routeSel = o.routes.length - 1; rr = selRoute(); }
      rr.pts.push(llToM(g, la, lo)); objsChanged(); return;
    }
  });
  $('#chartSide').addEventListener('click', (e) => { if (e.target.id === 'oDel' && selObj) { const arr = selObj.t === 'light' ? A.W.objs.lights : selObj.t === 'berth' ? A.W.objs.berths : A.W.objs.sounds; arr.splice(arr.indexOf(selObj.o), 1); selObj = null; objsChanged(); } });
  drawLib(); drawSide();
}
function bolList(b) {
  const bi = A.W.objs.berths.indexOf(b), bl = A.W.bollards.filter((q) => q.bi === bi);
  return `<div class="lbl" style="margin-top:8px">Cọc bích — khoảng cách tính từ đầu bến (m)${Array.isArray(b.bols) ? ' · đã chỉnh tay' : ' · đang đặt cách đều'}</div>
    <div class="grid g4" style="gap:4px;margin-top:4px">${bl.map((q, k) => `<label style="display:flex;flex-direction:column;font-size:10.5px;color:#8FA3B0">B${q.n}<input class="cell mono" data-bol="${k}" value="${q.s.toFixed(1)}" style="height:24px;font-size:11.5px"></label>`).join('')}</div>
    <div class="flex" style="gap:6px;margin-top:6px"><button class="btn sm" id="bolAdd">+ Thêm cọc</button>${Array.isArray(b.bols) ? '<button class="btn sm" id="bolReset">Đặt lại cách đều</button>' : ''}</div>
    <div class="muted" style="margin-top:4px">Dùng công cụ «Cọc bích» để kéo cọc dọc mép cầu, bấm lên mép cầu để thêm, chuột phải để xóa.</div>`;
}
const ensureBols = (b, bi) => { if (!Array.isArray(b.bols)) b.bols = A.W.autoBols(bi); b.bols.sort((p, q) => p - q); return b.bols; };
function nearBollard(p) { let best = null, bd = 13; for (const q of A.W.bollards) { const s2 = cv.m2s(q.x, q.y), d = Math.hypot(s2[0] - p[0], s2[1] - p[1]); if (d < bd) { bd = d; best = q; } } return best; }
function routeCard() {
  const o = A.W.objs, rs = o.routes || [], r = selRoute(), g = A.W.chart ? A.W.chart.geo : null;
  if (!g || !g.ok) return `<section class="card"><h2>Tuyến đi</h2><div class="muted">Cần nạp hải đồ có tọa độ để lập tuyến.</div></section>`;
  const lg = r ? legs(r.pts) : [];
  const rows = r ? r.pts.map((q, i) => { const [la, lo] = mToLL(g, q[0], q[1]), l = lg[i - 1]; return `<tr><td class="mono" style="vertical-align:top;padding-top:7px">${i + 1}</td><td><input class="cell mono" data-wl="${i}" value="${esc(fmtLat(la))}" aria-label="Vĩ độ điểm ${i + 1}" style="height:24px;font-size:11.5px"><input class="cell mono" data-wn="${i}" value="${esc(fmtLon(lo))}" aria-label="Kinh độ điểm ${i + 1}" style="height:24px;font-size:11.5px;margin-top:2px"></td><td class="mono" style="font-size:11.5px;white-space:nowrap">${l ? p3(l.crs) + '°<br>' + fmtDist(l.len) : '<span class="muted">xuất phát</span>'}</td><td><button class="btn sm" data-wdel="${i}" aria-label="Xóa điểm ${i + 1}" style="padding:0 7px">✕</button></td></tr>`; }).join('') : '';
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
function clickChart(p, dbl) {
  const W = A.W, [x, y] = cv.s2m(p[0], p[1]), near = (ox, oy) => { const s = cv.m2s(ox, oy); return Math.hypot(s[0] - p[0], s[1] - p[1]); };
  if (tool === 'light') { const o = { x, y, kind: 'light', name: 'Đèn ' + (W.objs.lights.length + 1), color: 'W', period: 3, flash: 0.5, height: 9 }; W.objs.lights.push(o); selObj = { t: 'light', o }; objsChanged(); }
  else if (tool === 'berth') { if (dbl) return; (draft = draft || []).push([x, y]); drawChart(); }
  else if (tool === 'sound') { const v = prompt('Độ sâu tại điểm này (m, so với số 0 hải đồ):', '8'); if (v !== null && isFinite(num(v, NaN))) { const o = { x, y, d: num(v, 0) }; W.objs.sounds.push(o); selObj = { t: 'sound', o }; objsChanged(); } }
  else if (tool === 'bollard') { let bb = -1, bs = 0, bd = 1e9; W.objs.berths.forEach((b, bi) => { const a = W.alongBerth(bi, x, y); if (a && a.d < bd) { bd = a.d; bb = bi; bs = a.s; } }); if (bb >= 0 && bd / cv.mPerPx() < 20) { const b = W.objs.berths[bb]; ensureBols(b, bb).push(bs); b.bols.sort((p, q) => p - q); selObj = { t: 'berth', o: b }; objsChanged(); } }
  else if (tool === 'route') { if (!A.W.chart) return; let r = selRoute(); if (!r) { W.objs.routes = W.objs.routes || []; W.objs.routes.push({ name: 'Tuyến ' + (W.objs.routes.length + 1), pts: [] }); W.objs.routeSel = W.objs.routes.length - 1; r = selRoute(); } r.pts.push([x, y]); objsChanged(); }
  else if (tool === 'start') { W.start = { x, y, hdg: num(startPos().hdg, 0) }; saveObjs(); if (A.sim && A.sim.t < 2 && A.hooks.resetToStart) A.hooks.resetToStart(false); drawChart(); drawSide(); if (A.hooks.envChanged) A.hooks.envChanged(); }
  else if (tool === 'measure') { if (!meas || meas.length === 2) meas = [[x, y]]; else meas.push([x, y]); drawChart(); }
  else {
    let best = null, bd = 14;
    for (const o of W.objs.lights) { const d = near(o.x, o.y); if (d < bd) { bd = d; best = { t: 'light', o }; } }
    for (const o of W.objs.berths) for (const q of o.pts) { const d = near(q[0], q[1]); if (d < bd) { bd = d; best = { t: 'berth', o }; } }
    selObj = best; drawChart(); drawSide();
  }
}
// vẽ các đối tượng lên một ChartView bất kỳ
export function drawOverlay(v, opt) {
  const g = v.ctx, W = A.W; g.save(); g.lineJoin = 'round';
  for (const b of W.objs.berths) { g.strokeStyle = '#FFB300'; g.lineWidth = selObj && selObj.o === b && !opt ? 6 : 4; g.beginPath(); b.pts.forEach((q, i) => { const s = v.m2s(q[0], q[1]); if (i) g.lineTo(s[0], s[1]); else g.moveTo(s[0], s[1]); }); g.stroke(); }
  const bt = !opt && tool === 'bollard';
  if (v.mPerPx() < 3 || bt) { g.fillStyle = '#3A2A00'; g.strokeStyle = '#fff'; g.lineWidth = 1; g.font = 'bold 10px Segoe UI'; for (const b of W.bollards) { const s = v.m2s(b.x, b.y); g.fillStyle = '#3A2A00'; g.beginPath(); g.arc(s[0], s[1], bt ? 4.5 : 3, 0, 7); g.fill(); g.stroke(); if ((bt && v.mPerPx() < 1.6) || v.mPerPx() < 0.8) { g.fillStyle = '#3A2A00'; g.fillText('B' + b.n, s[0] + 6, s[1] - 5); } } }
  if (!opt) for (const b of W.objs.berths) if (bt || (selObj && selObj.o === b)) { const s = v.m2s(b.pts[0][0], b.pts[0][1]); g.fillStyle = '#E65100'; g.font = 'bold 11px Segoe UI'; g.beginPath(); g.arc(s[0], s[1], 4, 0, 7); g.fill(); g.fillText('Đầu bến', s[0] + 6, s[1] + 14); }
  const LC = { W: '#ffffff', R: '#e53935', G: '#2e9e55', Y: '#ffd600' };
  for (const o of W.objs.lights) { const s = v.m2s(o.x, o.y); g.fillStyle = LC[o.color] || '#fff'; g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath(); if (o.kind === 'light') { g.arc(s[0], s[1], 6, 0, 7); } else { g.rect(s[0] - 5, s[1] - 5, 10, 10); } g.fill(); g.stroke(); if (!opt && selObj && selObj.o === o) { g.strokeStyle = '#00B8D4'; g.setLineDash([4, 3]); g.beginPath(); g.arc(s[0], s[1], 13, 0, 7); g.stroke(); g.setLineDash([]); } if (!opt || v.mPerPx() < 6) { g.font = '11px Segoe UI'; g.fillStyle = '#111'; g.fillText(o.name || '', s[0] + 9, s[1] - 7); } }
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
export function drawChart() { if (!cv) return; cv.chart = A.W.chart; cv.draw(); drawOverlay(cv); }

// ---------------- Tab 4: môi trường & kịch bản ----------------
export function initEnv() {
  const e = A.env, sp = startPos(), W = A.W;
  const stepsO = [['f4', 'Tiến max'], ['f3', 'Tiến 3'], ['f2', 'Tiến 2'], ['f1', 'Tiến 1'], ['st', 'Dừng máy']];
  $('#p-env').innerHTML = `<div class="flex" style="align-items:flex-start">
  <section class="card" style="flex:1 1 280px;max-width:340px"><h2>Kịch bản bài tập</h2><div class="col" style="gap:8px">${fld('name', 'Tên bài tập', '', e.name, 'data-t="1"')}${fld('startTime', 'Giờ bắt đầu (giờ:phút)', '', e.startTime, 'data-t="1"')}
  <div class="fld"><span class="lbl">Vị trí xuất phát</span><div class="mono" style="padding:7px 8px;border:1px solid #33444F;border-radius:6px;background:#0D151A">${W.chart ? fmtLL(...pxToLL(W.chart.geo, ...mToPx(W.chart.geo, sp.x, sp.y))) : 'Biển trống (chưa nạp hải đồ)'}</div></div>
  <button class="btn sm" id="pickStart">Chọn vị trí trên hải đồ (tab 2)</button>
  ${fld('startHdg', 'Hướng ban đầu', '°', num(sp.hdg, 0))}${fld('startKn', 'Tốc độ ban đầu', 'hl/h', e.startKn)}${sel('startStep', 'Máy ban đầu', stepsO, e.startStep)}
  <button class="btn pri" id="goBtn" style="min-height:42px">Bắt đầu bài tập →</button><div class="muted">Bắt đầu bài mới sẽ lưu bài đang chạy vào tab Xem lại.</div></div></section>
  <section class="card" style="flex:999 1 520px"><h2>Thủy triều — độ cao từng giờ (m, so với số 0 hải đồ)</h2>
  <div class="grid" style="grid-template-columns:repeat(12,minmax(0,1fr));gap:5px">${e.tide.map((v, i) => `<div><div class="muted mono" style="font-size:10px">${String(i).padStart(2, '0')}h</div><input class="cell mono" data-tide="${i}" value="${v}" aria-label="Độ cao triều lúc ${i} giờ"></div>`).join('')}</div>
  <div class="flex" style="margin-top:10px;align-items:flex-end;gap:8px"><div class="muted" style="flex:1 1 100%">Hoặc nhập nước lớn / nước ròng để app tự điền 24 giờ:</div>${fld('hwT', 'Giờ nước lớn', 'h', 15.5)}${fld('hwH', 'Cao nước lớn', 'm', 3.4)}${fld('lwT', 'Giờ nước ròng', 'h', 3)}${fld('lwH', 'Cao nước ròng', 'm', 0.5)}<button class="btn sm" id="tideGen">Điền bảng</button></div>
  <canvas id="tideCv" style="width:100%;height:170px;margin-top:10px;display:block"></canvas>
  <div class="muted" style="margin-top:6px">Bản đầu: nhập số bằng tay (gõ hoặc dán). Tự đọc bảng thủy triều từ ảnh / PDF sẽ có ở bản sau.</div></section>
  <div class="col" style="flex:1 1 280px;max-width:340px"><section class="card"><h2>Gió</h2><div class="grid g3">${fld('windDir', 'Hướng (từ)', '°', e.windDir)}${fld('windKn', 'Tốc độ', 'hl/h', e.windKn)}${fld('gustKn', 'Giật', 'hl/h', e.gustKn)}</div><label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="windVary" ${e.windVary ? 'checked' : ''} style="width:17px;height:17px"> Gió giật và đổi hướng nhẹ theo thời gian</label></section>
  <section class="card"><h2>Dòng chảy (theo con nước)</h2><div class="grid g2">${fld('floodDir', 'Triều lên: chảy về', '°', e.floodDir)}${fld('floodKn', 'Mạnh nhất', 'hl/h', e.floodKn)}${fld('ebbDir', 'Triều rút: chảy về', '°', e.ebbDir)}${fld('ebbKn', 'Mạnh nhất', 'hl/h', e.ebbKn)}</div><div class="muted" style="margin-top:6px">Tốc độ dòng tự đổi theo bảng triều: mạnh nhất giữa con nước, bằng 0 lúc nước đứng. Bản đầu dùng chung một dòng chảy cho cả vùng.</div></section>
  <section class="card"><h2>Sóng & tầm nhìn</h2><div class="grid g2">${fld('waveH', 'Độ cao sóng', 'm', e.waveH)}${fld('waveDir', 'Hướng sóng (từ)', '°', e.waveDir)}${fld('visNm', 'Tầm nhìn', 'hl', e.visNm)}</div><div class="muted" style="margin-top:6px">Ngày / đêm tính theo giờ bắt đầu. Đèn phao và đèn tàu chỉ thấy khi trời tối.</div></section></div></div>`;
  const el = $('#p-env');
  el.onchange = (ev) => {
    const t = ev.target, k = t.dataset.k;
    if (t.dataset.tide !== undefined) { e.tide[+t.dataset.tide] = num(t.value, 0); saveEnv(); drawTide(); return; }
    if (t.id === 'windVary') { e.windVary = t.checked; saveEnv(); return; }
    if (!k || ['hwT', 'hwH', 'lwT', 'lwH'].includes(k)) return;
    if (k === 'startHdg') { A.W.start = Object.assign({}, startPos(), { hdg: ((num(t.value, 0) % 360) + 360) % 360 }); saveObjs(); if (A.sim && A.sim.t < 2 && A.hooks.resetToStart) A.hooks.resetToStart(false); return; }
    e[k] = t.dataset.t || t.tagName === 'SELECT' ? t.value : num(t.value, e[k]); saveEnv();
  };
  $('#tideGen').onclick = () => {
    const g = (k) => num($('#f_' + k).value, 0), hwT = g('hwT'), hwH = g('hwH'), lwT = g('lwT'), lwH = g('lwH');
    for (let h = 0; h < 24; h++) {
      const dUp = ((hwT - lwT) % 24 + 24) % 24 || 12, x = ((h - lwT) % 24 + 24) % 24;
      const f = x <= dUp ? (1 - Math.cos(Math.PI * x / dUp)) / 2 : (1 + Math.cos(Math.PI * (x - dUp) / (24 - dUp))) / 2;
      e.tide[h] = +(lwH + (hwH - lwH) * f).toFixed(2);
    }
    saveEnv(); initEnv();
  };
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
    <label class="lbl" for="waveLen">Bước sóng ×<b id="waveLenV">${s.waveLen || 4}</b></label><input type="range" id="waveLen" min="1" max="6" step="0.5" value="${s.waveLen || 4}" style="width:100%">
    <label class="lbl" for="rollSpeed" style="margin-top:8px;display:block">Tốc độ lắc của tàu ×<b id="rollSpeedV">${s.rollSpeed || 4}</b></label><input type="range" id="rollSpeed" min="1" max="6" step="0.5" value="${s.rollSpeed || 4}" style="width:100%">
    <div class="muted" style="margin-top:6px">Bước sóng lớn hơn thì sóng dài hơn và chu kỳ chậm hơn theo đúng quy luật sóng nước sâu. Tốc độ lắc lớn hơn thì tàu bám theo mặt sóng nhanh hơn.</div></section>
  <section class="card" style="flex:1 1 300px;max-width:420px"><h2>Âm thanh</h2><div class="lbl" style="margin-bottom:4px">Kiểu chuông tàu</div><div class="flex" style="gap:6px;align-items:center;margin-bottom:10px"><div class="seg" id="bellSeg">${[['electric', 'Chuông điện 6 inch (reng reng)'], ['brass', 'Chuông đồng (gõ)']].map((b) => `<button data-b="${b[0]}" class="${(s.bellType || 'electric') === b[0] ? 'on' : ''}">${b[1]}</button>`).join('')}</div><button class="btn sm" id="bellTry">Nghe thử</button></div>${[['volMaster', 'Âm lượng chung'], ['volEngine', 'Tiếng máy'], ['volBell', 'Còi, chuông & báo động']].map((v) => `<div class="fld" style="margin-bottom:8px"><label for="${v[0]}">${v[1]}: <b id="${v[0]}V">${s[v[0]]}</b>%</label><input type="range" id="${v[0]}" min="0" max="100" step="5" value="${s[v[0]]}"></div>`).join('')}<div class="muted">Âm thanh bật sau lần bấm đầu tiên vào màn Điều động.</div></section>
  <section class="card" style="flex:1 1 300px;max-width:420px"><h2>Dữ liệu</h2><div class="muted">Thông số tàu, kịch bản, các đối tượng vẽ trên hải đồ, file hải đồ và bài đã ghi được lưu ngay trên máy này (trong trình duyệt). App chạy hoàn toàn không cần mạng.</div><button class="btn warn sm" id="wipe" style="margin-top:10px">Xóa toàn bộ dữ liệu đã lưu</button></section></div>`;
  $('#qSeg').onclick = (e) => { const q = e.target.dataset.q; if (!q) return; s.quality = q; saveSet(); initSet(); A.hooks.qualityChanged(); };
  for (const id of ['waveLen', 'rollSpeed']) $('#' + id).oninput = (e) => { s[id] = +e.target.value; $('#' + id + 'V').textContent = s[id]; saveSet(); };
  $('#bellSeg').onclick = (e) => { const b = e.target.dataset.b; if (!b) return; s.bellType = b; saveSet(); A.hooks.volChanged(); initSet(); };
  $('#bellTry').onclick = () => { A.snd.init(); A.hooks.volChanged(); A.snd.bell(1.5); };
  $('#uiSeg').onclick = (e) => { const u = e.target.dataset.u; if (!u) return; s.uiScale = u === 'auto' ? 'auto' : +u; saveSet(); A.hooks.scaleChanged(); initSet(); };
  $('#p-set').oninput = (e) => { if (e.target.type === 'range') { s[e.target.id] = +e.target.value; $('#' + e.target.id + 'V').textContent = e.target.value; saveSet(); A.hooks.volChanged(); } };
  $('#wipe').onclick = () => { if (confirm('Xóa hết thông số tàu, kịch bản, hải đồ và bài đã ghi?')) { try { localStorage.clear(); indexedDB.deleteDatabase('mophongtau'); } catch (e) { /* */ } location.reload(); } };
}
export async function restoreCharts() {
  const keys = await DB.keys('charts'); if (!keys || !keys.length) return;
  const files = []; for (const k of keys) { const f = await DB.get('charts', k); if (f) files.push(f); }
  await addChartFiles(files);
  const last = LS.get('mp_lastChart'); const c = A.charts.find((q) => q.key === last && !q.bad) || A.charts.find((q) => !q.bad);
  if (c) await activateChart(c.key);
}
export { KN, defaultEnv };
