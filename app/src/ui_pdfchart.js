// Hộp thoại nạp hải đồ PDF: chọn trang, nhập tỷ lệ / datum / độ nét, bấm điểm tọa độ (giao điểm lưới kinh vĩ) và khung hải đồ,
// xem sai số khớp rồi nạp vào kho (charts/pdfchart.js).
import { A, $, num, esc } from './app.js';
import { openPdf } from './pdfload.js';
import { CS } from './chartsys.js';
import { importPdfChart, pdfSize } from './charts/pdfchart.js';
import { fitGeoref, makeXf } from './charts/georef.js';
import { toWGS84, DATUMS } from './geo/datum.js';
import { llToMerc, mercScale } from './geo/proj.js';
import { parseCoord, fmtLat, fmtLon } from './nav.js';

let st = null;
const fresh = () => ({ pdf: null, file: null, pageNo: 1, pages: 0, page: null, prev: null, ps: 1, v: { cx: 0, cy: 0, sc: 1 }, tool: 'pan', name: '', nu: '', scale: 0, datum: 'VN2000', dpi: 200, pts: [], ply: [], busy: false, done: null });
const HINT = {
  pan: 'Kéo để di chuyển, lăn chuột để phóng to. Phóng sát vào giao điểm lưới kinh vĩ rồi dùng «Bấm điểm tọa độ».',
  pt: 'Bấm đúng giao điểm của một đường kinh tuyến và một đường vĩ tuyến (có số độ, phút in ở mép hải đồ), rồi gõ vĩ độ / kinh độ của điểm đó ở khung bên trái. Kéo chuột vẫn di chuyển được.',
  ply: 'Bấm lần lượt các góc khung trong của hải đồ (đường viền vùng biển và đất). Phần lề, chú thích nằm ngoài khung sẽ bị cắt để không che các tờ khác.'
};
export function openPdfChart(files) {
  if (!st || st.busy === false && st.done) st = fresh();
  let d = $('#pdlg'); if (!d) { d = document.createElement('div'); d.id = 'pdlg'; d.className = 'modal'; $('#app').appendChild(d); }
  d.innerHTML = `<div class="mbox" role="dialog" aria-label="Nạp hải đồ PDF">
    <div class="mhead"><b>Nạp hải đồ PDF vào kho</b><span class="muted" id="pName"></span><button class="btn sm" id="pClose">Đóng</button></div>
    <div class="mbody">
      <div class="mleft">
        <section class="wst"><b>1 · Mở file PDF</b><label class="btn sm pri" style="display:flex;align-items:center;justify-content:center;margin-top:5px">Chọn file PDF hải đồ<input type="file" id="pFile" accept=".pdf,application/pdf" hidden></label>
          <div class="flex" id="pPg" style="gap:5px;align-items:center;margin-top:5px;display:none;flex-wrap:nowrap"><button class="btn sm" id="pPrev" aria-label="Trang trước">◀</button><span class="mono" id="pPgT" style="flex:1;text-align:center"></span><button class="btn sm" id="pNext" aria-label="Trang sau">▶</button></div></section>
        <section class="wst"><b>2 · Thông tin tờ</b>
          <div class="fld" style="margin-top:5px"><label for="pNm">Tên tờ</label><div class="in"><input id="pNm" value="${esc(st.name)}"></div></div>
          <div class="grid g2" style="gap:5px;margin-top:5px"><div class="fld"><label for="pSc">Tỷ lệ 1:</label><div class="in"><input id="pSc" inputmode="numeric" value="${st.scale || ''}" placeholder="25000"></div></div>
          <div class="fld"><label for="pDt">Datum tọa độ in</label><div class="in"><select id="pDt">${Object.keys(DATUMS).map((k) => `<option value="${k}" ${k === st.datum ? 'selected' : ''}>${DATUMS[k].name}</option>`).join('')}</select></div></div></div>
          <div class="fld" style="margin-top:5px"><label for="pDpi">Độ nét khi nạp</label><div class="in"><select id="pDpi">${[[150, '150 dpi — nhẹ'], [200, '200 dpi — vừa (đề xuất)'], [300, '300 dpi — nét nhất']].map((o) => `<option value="${o[0]}" ${o[0] === st.dpi ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div></div>
          <div class="muted" id="pRes" style="margin-top:4px"></div></section>
        <section class="wst"><b>3 · Điểm tọa độ (≥ 2, nên 4 góc)</b><button class="btn sm pt" data-t="pt">Bấm điểm tọa độ trên hải đồ</button><div id="pPts" style="margin-top:6px"></div></section>
        <section class="wst"><b>4 · Khung hải đồ (nên có)</b><div class="flex" style="gap:5px;margin-top:5px;flex-wrap:nowrap"><button class="btn sm pt" data-t="ply" style="flex:2">Bấm các góc khung</button><button class="btn sm" id="pPlyX" style="flex:1">Xóa khung</button></div><div class="muted" id="pPlyT" style="margin-top:4px"></div></section>
      </div>
      <div class="mmain"><div class="note" id="pHint"></div><div class="wcv"><canvas id="pCv"></canvas><div class="wempty" id="pEmpty">Chọn file PDF hải đồ (vector từ MicroStation / AutoCAD hoặc bản scan).</div></div></div>
      <div class="mright"><section class="wst"><b>Sai số khớp tọa độ</b><div id="pFit" class="muted" style="margin-top:6px">Chưa có điểm tọa độ.</div></section>
        <button class="btn pri" id="pGo" style="width:100%;margin-top:8px" disabled>Nạp vào kho hải đồ</button><div class="muted" id="pMsg" style="margin-top:6px"></div>
        <div class="muted" style="margin-top:8px;line-height:1.5">App render lại hải đồ ở nhiều mức (nét luôn sắc khi phóng to, thu nhỏ) và đọc màu để chia vùng độ sâu như hải đồ KAP. Hải đồ VN-2000 được chuyển sang WGS-84 theo tham số EPSG:6960.</div></div>
    </div></div>`;
  d.style.display = 'flex';
  bind(); setTool(st.tool); info(); ptsList(); fit(); paint();
  if (st.prev) { $('#pEmpty').style.display = 'none'; pageCtl(); }
  if (files && files.length) loadFile(files[0]);
}
function bind() {
  $('#pClose').onclick = () => { if (!st.busy) $('#pdlg').style.display = 'none'; };
  $('#pFile').onchange = (e) => { if (e.target.files[0]) loadFile(e.target.files[0]); e.target.value = ''; };
  $('#pPrev').onclick = () => { if (st.pageNo > 1) loadPage(st.pageNo - 1); };
  $('#pNext').onclick = () => { if (st.pageNo < st.pages) loadPage(st.pageNo + 1); };
  $('#pNm').onchange = (e) => { st.name = e.target.value.trim(); };
  $('#pSc').onchange = (e) => { st.scale = Math.round(num(e.target.value, 0)); info(); };
  $('#pDt').onchange = (e) => { st.datum = e.target.value; fit(); };
  $('#pDpi').onchange = (e) => { st.dpi = +e.target.value; info(); fit(); };
  $('#pPlyX').onclick = () => { st.ply = []; info(); paint(); };
  document.querySelectorAll('#pdlg .pt').forEach((b) => { b.onclick = () => setTool(st.tool === b.dataset.t ? 'pan' : b.dataset.t); });
  $('#pPts').onchange = (e) => {
    const t = e.target, i = +(t.dataset.la ?? t.dataset.lo); if (!st.pts[i]) return;
    const p = st.pts[i]; if (t.dataset.la !== undefined) { p.latS = t.value; p.lat = parseCoord(t.value, true); } else { p.lonS = t.value; p.lon = parseCoord(t.value, false); }
    t.style.borderColor = isFinite(t.dataset.la !== undefined ? p.lat : p.lon) ? '' : '#FF6B6B'; fit(); paint();
  };
  $('#pPts').onclick = (e) => { const b = e.target.closest('button[data-del]'); if (b) { st.pts.splice(+b.dataset.del, 1); ptsList(); fit(); paint(); } };
  $('#pGo').onclick = go;
  const c = $('#pCv'); let drag = null, moved = false;
  const pos = (e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
  c.onpointerdown = (e) => { drag = pos(e); moved = false; c.setPointerCapture(e.pointerId); };
  c.onpointermove = (e) => { if (!drag) return; const p = pos(e); if (!moved && Math.hypot(p[0] - drag[0], p[1] - drag[1]) < 4) return; moved = true; st.v.cx -= (p[0] - drag[0]) / st.v.sc; st.v.cy -= (p[1] - drag[1]) / st.v.sc; drag = p; paint(); };
  c.onpointerup = (e) => { const p = pos(e); if (drag && !moved && st.prev) click(p); drag = null; };
  c.onwheel = (e) => { e.preventDefault(); if (!st.prev) return; const p = pos(e), a = s2i(p); st.v.sc = Math.max(0.02, Math.min(24, st.v.sc * (e.deltaY > 0 ? 0.8 : 1.25))); const b = s2i(p); st.v.cx += a[0] - b[0]; st.v.cy += a[1] - b[1]; paint(); };
  c.oncontextmenu = (e) => { e.preventDefault(); if (st.tool === 'ply' && st.ply.length) { st.ply.pop(); info(); paint(); } };
}
function setTool(t) { st.tool = t; document.querySelectorAll('#pdlg .pt').forEach((b) => b.classList.toggle('pri', b.dataset.t === t)); $('#pHint').textContent = HINT[t]; }
async function loadFile(f) {
  try {
    st.pdf = await openPdf(new Uint8Array(await f.arrayBuffer())); st.file = f; st.pages = st.pdf.numPages; st.pts = []; st.ply = []; st.done = null;
    st.name = f.name.replace(/\.pdf$/i, ''); const m = /1\s*[:/]\s*([\d.,\s]{3,})/.exec(st.name); st.scale = m ? Math.round(num(m[1].replace(/[.,\s]/g, ''), 0)) : st.scale;
    $('#pNm').value = st.name; $('#pSc').value = st.scale || ''; $('#pName').textContent = f.name;
    await loadPage(1);
  } catch (e) { $('#pMsg').textContent = 'Không mở được file: ' + (e.message || e); }
}
async function loadPage(n) {
  st.pageNo = n; st.page = await st.pdf.getPage(n);
  const v0 = st.page.getViewport({ scale: 1 }), ps = Math.min(5000 / Math.max(v0.width, v0.height), Math.sqrt(20e6 / (v0.width * v0.height)));
  const vp = st.page.getViewport({ scale: ps }), cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); $('#pMsg').textContent = 'Đang vẽ trang ' + n + '…';
  await st.page.render({ canvasContext: g, viewport: vp }).promise; $('#pMsg').textContent = '';
  st.prev = cv; st.ps = ps; $('#pEmpty').style.display = 'none'; pageCtl(); fitView(); info(); ptsList(); fit(); paint();
}
function pageCtl() { $('#pPg').style.display = st.pages > 1 ? 'flex' : 'none'; $('#pPgT').textContent = 'Trang ' + st.pageNo + ' / ' + st.pages; }
function sizeCv() { const c = $('#pCv'), w = c.clientWidth | 0, h = c.clientHeight | 0; if (w && h && (c.width !== w || c.height !== h)) { c.width = w; c.height = h; } }
function fitView() { sizeCv(); const c = $('#pCv'); st.v.cx = st.prev.width / 2; st.v.cy = st.prev.height / 2; st.v.sc = Math.min(c.width / st.prev.width, c.height / st.prev.height) * 0.97; }
const i2s = (q) => { const c = $('#pCv'); return [c.width / 2 + (q[0] - st.v.cx) * st.v.sc, c.height / 2 + (q[1] - st.v.cy) * st.v.sc]; };
const s2i = (p) => { const c = $('#pCv'); return [st.v.cx + (p[0] - c.width / 2) / st.v.sc, st.v.cy + (p[1] - c.height / 2) / st.v.sc]; };
// điểm trên ảnh xem trước → tọa độ trang PDF (pt) → pixel ảnh mức 0
const ptToPx = (q) => { const s = st.dpi / 72; return [q[0] * s, q[1] * s]; };
function click(p) {
  const q = s2i(p), pt = [q[0] / st.ps, q[1] / st.ps];
  if (st.tool === 'pt') { const prev = st.pts[st.pts.length - 1]; st.pts.push({ x: pt[0], y: pt[1], latS: prev ? prev.latS : '', lonS: prev ? prev.lonS : '', lat: NaN, lon: NaN }); ptsList(); fit(); paint(); const ins = document.querySelectorAll('#pPts input[data-la]'); if (ins.length) { ins[ins.length - 1].focus(); ins[ins.length - 1].select(); } }
  else if (st.tool === 'ply') { st.ply.push(pt); info(); paint(); }
}
function info() {
  if (!st.page) { $('#pRes').textContent = ''; $('#pPlyT').textContent = ''; return; }
  const { W, H } = pdfSize(st.page, st.dpi), mpx = st.scale ? st.scale * 0.0254 / st.dpi : 0;
  $('#pRes').textContent = 'Ảnh ' + W + ' × ' + H + ' điểm' + (mpx ? ' · 1 điểm ≈ ' + mpx.toFixed(1).replace('.', ',') + ' m' : '') + ' · khoảng ' + Math.round(W * H * 1.33 / 65536) + ' ô';
  $('#pPlyT').textContent = st.ply.length >= 3 ? 'Khung ' + st.ply.length + ' góc (chuột phải để bỏ góc vừa bấm).' : st.ply.length ? 'Đã bấm ' + st.ply.length + ' góc — cần ít nhất 3.' : 'Chưa có khung: lấy cả trang.';
}
function ptsList() {
  $('#pPts').innerHTML = st.pts.length ? st.pts.map((p, i) => `<div style="display:grid;grid-template-columns:18px 1fr 26px;gap:4px;align-items:center;margin-bottom:4px"><b class="mono">${i + 1}</b><div><input class="cell mono" data-la="${i}" value="${esc(p.latS)}" placeholder="vĩ độ 21°05,0'N" aria-label="Vĩ độ điểm ${i + 1}" style="height:24px;font-size:11.5px"><input class="cell mono" data-lo="${i}" value="${esc(p.lonS)}" placeholder="kinh độ 107°20,0'E" aria-label="Kinh độ điểm ${i + 1}" style="height:24px;font-size:11.5px;margin-top:2px"></div><button class="btn sm" data-del="${i}" aria-label="Xóa điểm ${i + 1}" style="padding:0">✕</button></div>`).join('')
    : '<div class="muted">Chưa có điểm. Gõ được: 21°05,123\'N · 21 05.123 N · 21.0852</div>';
}
// khớp thử georef để báo sai số từng điểm (m)
function fitRefs() {
  if (!st.page) return null;
  const { W, H } = pdfSize(st.page, st.dpi), ok = st.pts.filter((p) => isFinite(p.lat) && isFinite(p.lon));
  if (ok.length < 2) return { ok, c: null };
  const refs = ok.map((p) => { const [x, y] = ptToPx([p.x, p.y]), [lat, lon] = st.datum === 'WGS84' ? [p.lat, p.lon] : toWGS84(p.lat, p.lon, st.datum); return { x, y, lat, lon }; });
  const c = fitGeoref(refs, W, H); if (!c) return { ok, c: null };
  const xf = makeXf(c), res = refs.map((r) => { const a = xf.pxToMerc(r.x, r.y), b = llToMerc(r.lat, r.lon); return Math.hypot(a[0] - b[0], a[1] - b[1]) / mercScale(r.lat); });
  return { ok, c, res, refs, W, H };
}
function fit() {
  const f = fitRefs(), el = $('#pFit'), go = $('#pGo'); if (!el) return;
  if (!f || !f.c) { el.textContent = f && f.ok.length === 1 ? 'Mới có 1 điểm hợp lệ — cần ít nhất 2.' : 'Chưa có điểm tọa độ.'; go.disabled = true; return; }
  const worst = Math.max(...f.res), bad = worst > Math.max(30, (st.scale || 25000) * 0.0015);
  el.innerHTML = `Khớp bậc ${f.c.order} · ${f.ok.length} điểm · TB <b>${f.c.rms.toFixed(1).replace('.', ',')} m</b> · max ${worst.toFixed(1).replace('.', ',')} m` + (f.ok.length === 2 ? '<br>2 điểm luôn khớp đúng nên chưa kiểm tra được — nên thêm điểm thứ 3, 4.' : '') +
    `<div style="margin-top:4px">${f.res.map((r, i) => `Điểm ${st.pts.indexOf(f.ok[i]) + 1}: lệch ${r.toFixed(1).replace('.', ',')} m`).join('<br>')}</div>` + (bad ? '<div style="color:#FF8A8A;margin-top:4px">Có điểm lệch nhiều — kiểm tra lại số gõ hoặc vị trí bấm.</div>' : '');
  go.disabled = st.busy;
}
function paint() {
  sizeCv(); const c = $('#pCv'); if (!c) return; const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#2a3740'; g.fillRect(0, 0, c.width, c.height);
  if (!st.prev) return; const v = st.v;
  g.save(); g.imageSmoothingEnabled = v.sc < 1; g.setTransform(v.sc, 0, 0, v.sc, c.width / 2 - v.cx * v.sc, c.height / 2 - v.cy * v.sc); g.drawImage(st.prev, 0, 0); g.restore();
  const P = (q) => i2s([q[0] * st.ps, q[1] * st.ps]);
  if (st.ply.length) { g.strokeStyle = '#00B8D4'; g.fillStyle = 'rgba(0,184,212,.08)'; g.lineWidth = 2; g.setLineDash([7, 4]); g.beginPath(); st.ply.forEach((q, i) => { const s = P(q); if (i) g.lineTo(s[0], s[1]); else g.moveTo(s[0], s[1]); }); if (st.ply.length >= 3) { g.closePath(); g.fill(); } g.stroke(); g.setLineDash([]); st.ply.forEach((q) => { const s = P(q); g.fillStyle = '#00B8D4'; g.fillRect(s[0] - 3, s[1] - 3, 6, 6); }); }
  g.font = 'bold 13px Segoe UI';
  st.pts.forEach((p, i) => { const s = P([p.x, p.y]), okp = isFinite(p.lat) && isFinite(p.lon); g.strokeStyle = okp ? '#D81B60' : '#FF6D00'; g.lineWidth = 2; g.beginPath(); g.moveTo(s[0] - 12, s[1]); g.lineTo(s[0] + 12, s[1]); g.moveTo(s[0], s[1] - 12); g.lineTo(s[0], s[1] + 12); g.stroke(); g.beginPath(); g.arc(s[0], s[1], 6, 0, 7); g.stroke(); g.fillStyle = '#fff'; g.fillRect(s[0] + 8, s[1] - 22, 18, 16); g.fillStyle = '#AD1457'; g.fillText(String(i + 1), s[0] + 12, s[1] - 9); });
}
async function go() {
  const f = fitRefs(); if (!f || !f.c || st.busy) return;
  st.busy = true; $('#pGo').disabled = true; $('#pClose').disabled = true; const msg = $('#pMsg');
  try {
    const r = await importPdfChart(CS.catalog, st.page, { name: st.name || 'Hải đồ PDF', nu: st.name, file: st.file.name, size: st.file.size, scale: st.scale, datumSrc: DATUMS[st.datum].name, dpi: st.dpi, page: st.pageNo, refs: f.ok.map((p) => { const [x, y] = ptToPx([p.x, p.y]); return { x, y, lat: p.lat, lon: p.lon }; }), plyPx: st.ply.length >= 3 ? st.ply.map(ptToPx) : null },
      (rec, fr) => { msg.textContent = 'Đang nạp… ' + Math.round(fr * 100) + '% (giữ cửa sổ này mở)'; });
    st.done = r; msg.textContent = 'Đã nạp «' + r.name + '» vào kho.'; $('#pdlg').style.display = 'none';
    if (A.hooks.pdfChartAdded) A.hooks.pdfChartAdded(r);
  } catch (e) { msg.textContent = 'Lỗi khi nạp: ' + (e.message || e); console.error(e); }
  st.busy = false; $('#pClose').disabled = false; fit();
}
export { fmtLat, fmtLon };
// cho kiểm thử tự động (Playwright): đọc / đặt trạng thái hộp thoại
export const pdfTest = { st: () => st, refresh: () => { info(); ptsList(); fit(); paint(); } };
