// Tính diện tích hứng gió từ sơ đồ tàu (PDF hoặc ảnh): khoanh hình chiếu cạnh, đặt tỷ lệ, đường ki,
// app tự tách bóng tàu phía trên đường nước rồi tính A_L, tâm hứng gió; tùy chọn hình chiếu đứng cho A_F.
import { A, $, num, esc, saveShip } from './app.js';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.min.mjs';
import WORKER_SRC from './_pdfworker.js';

let st = null;
const fresh = () => ({ src: null, iw: 0, ih: 0, pdf: null, page: 1, pages: 0, name: '', v: { cx: 0, cy: 0, sc: 1 }, tool: 'pan', mpp: 0, spts: [], sdist: num(A.p.loa, 100), bowRight: true, thr: 200, brush: 10, side: { crop: null, keel: null, edits: [], mask: null }, front: { crop: null, keel: null, edits: [], mask: null }, tf: num(A.p.tf, 5), ta: num(A.p.ta, 5), res: null });

function ensureWorker() {
  if (pdfjsLib.GlobalWorkerOptions.workerPort) return;
  const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
  pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(url);
}

const HINTS = {
  pan: 'Kéo chuột để di chuyển, lăn chuột để phóng to / thu nhỏ.',
  crop: 'Kéo một khung bao quanh HÌNH CHIẾU CẠNH của tàu (chỉ lấy hình tàu, tránh chữ và đường kích thước).',
  scale: 'Bấm 2 điểm đã biết khoảng cách thật — thường là mút mũi và mút lái (LOA). Nhập khoảng cách ở ô bên trái.',
  keel: 'Bấm vào ĐƯỜNG KI (đáy tàu) trên hình chiếu cạnh. Bản scan bị nghiêng: bấm thêm điểm thứ 2 ở đầu kia đường ki, đường nước sẽ nghiêng theo. Bấm tiếp để làm lại. App tự kẻ đường nước theo mớn mũi / mớn lái.',
  add: 'Kéo chuột để TÔ THÊM vào bóng tàu (phần app bỏ sót).',
  del: 'Kéo chuột để XÓA BỚT khỏi bóng tàu (chữ, đường kích thước, dây chằng…).',
  cropF: 'Kéo khung bao quanh HÌNH CHIẾU ĐỨNG (nhìn từ mũi). Bỏ qua nếu bản vẽ không có.',
  keelF: 'Bấm vào đường ki trên hình chiếu đứng (1 hoặc 2 điểm).'
};

export function openWindage() {
  if (!st) st = fresh(); else { st.tf = num(A.p.tf, st.tf); st.ta = num(A.p.ta, st.ta); if (!st.mpp) st.sdist = num(A.p.loa, st.sdist); }
  let d = $('#wdlg');
  if (!d) { d = document.createElement('div'); d.id = 'wdlg'; d.className = 'modal'; $('#app').appendChild(d); }
  d.innerHTML = `<div class="mbox" role="dialog" aria-label="Tính diện tích hứng gió từ sơ đồ tàu">
    <div class="mhead"><b>Tính diện tích hứng gió từ sơ đồ tàu</b><span class="muted" id="wName"></span><button class="btn sm" id="wClose">Đóng</button></div>
    <div class="mbody">
      <div class="mleft">
        <section class="wst"><b>1 · Mở bản vẽ</b><label class="btn sm pri" style="display:flex;align-items:center;justify-content:center;margin-top:5px">Chọn file PDF / ảnh<input type="file" id="wFile" accept=".pdf,.png,.jpg,.jpeg,.bmp,.webp,image/*,application/pdf" hidden></label>
          <div class="flex" id="wPg" style="gap:5px;align-items:center;margin-top:5px;display:none;flex-wrap:nowrap"><button class="btn sm" id="wPrev" aria-label="Trang trước">◀</button><span class="mono" id="wPgT" style="flex:1;text-align:center"></span><button class="btn sm" id="wNext" aria-label="Trang sau">▶</button></div></section>
        <section class="wst"><b>2 · Khoanh hình chiếu cạnh</b><button class="btn sm wt" data-t="crop">Kéo khung quanh hình tàu</button></section>
        <section class="wst"><b>3 · Đặt tỷ lệ</b><button class="btn sm wt" data-t="scale">Bấm 2 điểm (mũi – lái)</button>
          <div class="fld" style="margin-top:5px"><label for="wDist">Khoảng cách thật giữa 2 điểm</label><div class="in"><input id="wDist" value="${st.sdist}"><span class="u">m</span></div></div><div class="muted" id="wScale"></div></section>
        <section class="wst"><b>4 · Đường ki & mớn nước</b><button class="btn sm wt" data-t="keel">Bấm vào đường ki (1 hoặc 2 điểm)</button>
          <div class="flex" style="gap:6px;align-items:center;margin-top:5px;flex-wrap:nowrap"><span class="muted">Mũi tàu ở bên</span><span class="seg" id="wBow"></span></div>
          <div class="grid g2" style="gap:5px;margin-top:5px"><div class="fld"><label for="wTf">Mớn mũi</label><div class="in"><input id="wTf" value="${st.tf}"><span class="u">m</span></div></div><div class="fld"><label for="wTa">Mớn lái</label><div class="in"><input id="wTa" value="${st.ta}"><span class="u">m</span></div></div></div></section>
        <section class="wst"><b>5 · Tách bóng tàu</b><button class="btn sm pri" id="wDetect" style="width:100%;margin-top:5px">Tự tách bóng tàu</button>
          <label class="muted" for="wThr" style="display:block;margin-top:5px">Độ nhạy nét vẽ <span id="wThrV"></span></label><input type="range" id="wThr" min="110" max="245" value="${st.thr}" style="width:100%">
          <div class="flex" style="gap:5px;margin-top:4px;flex-wrap:nowrap"><button class="btn sm wt" data-t="add" style="flex:1">Tô thêm</button><button class="btn sm wt" data-t="del" style="flex:1">Xóa bớt</button><button class="btn sm wt" data-t="pan" style="flex:1">Kéo xem</button></div>
          <label class="muted" for="wBr" style="display:block;margin-top:4px">Cỡ cọ</label><input type="range" id="wBr" min="3" max="40" value="${st.brush}" style="width:100%"></section>
        <section class="wst"><b>6 · Hình chiếu đứng (nếu có)</b><div class="flex" style="gap:5px;margin-top:5px;flex-wrap:nowrap"><button class="btn sm wt" data-t="cropF" style="flex:1">Khoanh</button><button class="btn sm wt" data-t="keelF" style="flex:1">Đường ki</button></div><div class="muted" style="margin-top:3px">Không có thì app ước tính diện tích chính diện.</div></section>
      </div>
      <div class="mmain"><div class="note" id="wHint"></div><div class="wcv"><canvas id="wCv"></canvas><div class="wempty" id="wEmpty">Chọn file bản vẽ bố trí chung (General Arrangement) hoặc ảnh hình chiếu cạnh của tàu.</div></div></div>
      <div class="mright"><section class="wst"><b>Kết quả</b><div id="wRes" class="muted" style="margin-top:6px">Làm lần lượt các bước 1 → 5.</div></section>
        <button class="btn pri" id="wApply" style="width:100%;margin-top:8px" disabled>Đưa vào tab 1</button>
        <div class="muted" style="margin-top:8px;line-height:1.5">Mẹo: nếu sổ tay ổn định của tàu có bảng diện tích chắn gió theo mớn nước thì nhập thẳng số đó ở tab 1 sẽ chính xác hơn.</div></div>
    </div></div>`;
  d.style.display = 'flex';
  bind(); setTool(st.tool); bowSeg(); paint(); results();
  if (st.src) { $('#wEmpty').style.display = 'none'; pageCtl(); }
}

function bind() {
  $('#wClose').onclick = () => { $('#wdlg').style.display = 'none'; };
  $('#wFile').onchange = (e) => { const f = e.target.files[0]; if (f) loadFile(f); e.target.value = ''; };
  $('#wPrev').onclick = () => { if (st.pdf && st.page > 1) renderPage(st.page - 1); };
  $('#wNext').onclick = () => { if (st.pdf && st.page < st.pages) renderPage(st.page + 1); };
  document.querySelectorAll('#wdlg .wt').forEach((b) => { b.onclick = () => setTool(b.dataset.t); });
  $('#wDist').onchange = (e) => { st.sdist = num(e.target.value, st.sdist); calcScale(); results(); };
  $('#wTf').onchange = (e) => { st.tf = num(e.target.value, st.tf); results(); paint(); };
  $('#wTa').onchange = (e) => { st.ta = num(e.target.value, st.ta); results(); paint(); };
  let tm = 0;
  $('#wThr').oninput = (e) => { st.thr = +e.target.value; $('#wThrV').textContent = st.thr; clearTimeout(tm); tm = setTimeout(() => { if (st.side.mask) detectAll(); }, 250); };
  $('#wThrV').textContent = st.thr;
  $('#wBr').oninput = (e) => { st.brush = +e.target.value; };
  $('#wDetect').onclick = () => detectAll(true);
  $('#wApply').onclick = apply;
  const c = $('#wCv'); let drag = null;
  const pos = (e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
  c.onwheel = (e) => { e.preventDefault(); if (!st.src) return; const p = pos(e), q = s2i(p), k = e.deltaY > 0 ? 0.85 : 1.18; st.v.sc = Math.max(0.02, Math.min(20, st.v.sc * k)); const q2 = s2i(p); st.v.cx += q[0] - q2[0]; st.v.cy += q[1] - q2[1]; paint(); };
  c.onpointerdown = (e) => {
    if (!st.src) return; c.setPointerCapture(e.pointerId); const p = pos(e), q = s2i(p);
    if (e.button === 1 || st.tool === 'pan') { drag = { pan: p }; return; }
    if (e.button !== 0) return;
    if (st.tool === 'crop' || st.tool === 'cropF') { drag = { crop: q }; (st.tool === 'crop' ? st.side : st.front).crop = [q[0], q[1], q[0], q[1]]; }
    else if (st.tool === 'scale') { if (st.spts.length >= 2) st.spts = []; st.spts.push(q); calcScale(); results(); paint(); }
    else if (st.tool === 'keel' || st.tool === 'keelF') { const o = st.tool === 'keel' ? st.side : st.front; if (!o.keel || o.keel.b) o.keel = { a: q, b: null }; else o.keel.b = q; if (o.mask) detectAll(); else { results(); paint(); } }
    else if (st.tool === 'add' || st.tool === 'del') { drag = { brush: true }; brushAt(q); }
  };
  c.onpointermove = (e) => {
    if (!drag) return; const p = pos(e), q = s2i(p);
    if (drag.pan) { st.v.cx -= (p[0] - drag.pan[0]) / st.v.sc; st.v.cy -= (p[1] - drag.pan[1]) / st.v.sc; drag.pan = p; paint(); }
    else if (drag.crop) { const o = st.tool === 'crop' ? st.side : st.front; o.crop = [Math.min(drag.crop[0], q[0]), Math.min(drag.crop[1], q[1]), Math.max(drag.crop[0], q[0]), Math.max(drag.crop[1], q[1])]; paint(); }
    else if (drag.brush) brushAt(q);
  };
  c.onpointerup = () => { if (drag && drag.crop) { const o = st.tool === 'crop' ? st.side : st.front; if (o.crop[2] - o.crop[0] < 10 || o.crop[3] - o.crop[1] < 10) o.crop = null; else { o.mask = null; o.edits = []; if (o.keel && (o.keel.a[1] < o.crop[1] || o.keel.a[1] > o.crop[3])) o.keel = null; } results(); paint(); } if (drag && drag.brush) results(); drag = null; };
  c.oncontextmenu = (e) => { e.preventDefault(); if (st.tool === 'scale') { st.spts = []; calcScale(); results(); paint(); } };
  window.addEventListener('resize', paint);
}
function setTool(t) { st.tool = t; document.querySelectorAll('#wdlg .wt').forEach((b) => b.classList.toggle('on', b.dataset.t === t)); $('#wHint').textContent = HINTS[t] || ''; const c = $('#wCv'); if (c) c.style.cursor = t === 'pan' ? 'grab' : 'crosshair'; }
function bowSeg() { const el = $('#wBow'); el.innerHTML = `<button data-v="L" class="${st.bowRight ? '' : 'on'}">Trái</button><button data-v="R" class="${st.bowRight ? 'on' : ''}">Phải</button>`; el.onclick = (e) => { const v = e.target.dataset.v; if (!v) return; st.bowRight = v === 'R'; bowSeg(); results(); paint(); }; }
function pageCtl() { $('#wPg').style.display = st.pdf && st.pages > 1 ? 'flex' : 'none'; $('#wPgT').textContent = 'Trang ' + st.page + ' / ' + st.pages; $('#wName').textContent = st.name; }

async function loadFile(f) {
  st = Object.assign(fresh(), { name: f.name, sdist: st.sdist, tf: st.tf, ta: st.ta, bowRight: st.bowRight, thr: st.thr });
  $('#wEmpty').style.display = 'block'; $('#wEmpty').textContent = 'Đang đọc ' + f.name + '…';
  try {
    if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') {
      ensureWorker();
      st.pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await f.arrayBuffer()), isEvalSupported: false }).promise;
      st.pages = st.pdf.numPages; await renderPage(1);
    } else {
      const bmp = await createImageBitmap(f); const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height; cv.getContext('2d').drawImage(bmp, 0, 0);
      setSrc(cv);
    }
    $('#wEmpty').style.display = 'none'; pageCtl(); setTool('crop');
  } catch (e) { $('#wEmpty').textContent = 'Không đọc được file: ' + (e.message || e); }
}
async function renderPage(n) {
  const pg = await st.pdf.getPage(n), v0 = pg.getViewport({ scale: 1 }), sc = Math.min(4200 / Math.max(v0.width, v0.height), Math.sqrt(16e6 / (v0.width * v0.height)));
  const vp = pg.getViewport({ scale: sc }), cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  await pg.render({ canvasContext: g, viewport: vp }).promise;
  st.page = n; st.side = { crop: null, keel: null, edits: [], mask: null }; st.front = { crop: null, keel: null, edits: [], mask: null }; st.spts = []; st.mpp = 0;
  setSrc(cv); pageCtl(); results();
}
function setSrc(cv) { st.src = cv; st.iw = cv.width; st.ih = cv.height; st.pix = null; fitView(); paint(); }
function fitView() { const c = $('#wCv'); sizeCv(); st.v.cx = st.iw / 2; st.v.cy = st.ih / 2; st.v.sc = Math.min(c.width / st.iw, c.height / st.ih) * 0.96; }
function sizeCv() { const c = $('#wCv'); if (!c) return; const w = c.clientWidth | 0, h = c.clientHeight | 0; if (w && h && (c.width !== w || c.height !== h)) { c.width = w; c.height = h; } }
const i2s = (q) => { const c = $('#wCv'); return [c.width / 2 + (q[0] - st.v.cx) * st.v.sc, c.height / 2 + (q[1] - st.v.cy) * st.v.sc]; };
const s2i = (p) => { const c = $('#wCv'); return [st.v.cx + (p[0] - c.width / 2) / st.v.sc, st.v.cy + (p[1] - c.height / 2) / st.v.sc]; };
function calcScale() { st.mpp = st.spts.length === 2 ? st.sdist / Math.max(1, Math.hypot(st.spts[1][0] - st.spts[0][0], st.spts[1][1] - st.spts[0][1])) : 0; }

// ---- tách bóng tàu ----
function detect(o) {
  if (!o.crop) return null;
  const x0 = Math.max(0, Math.floor(o.crop[0])), y0 = Math.max(0, Math.floor(o.crop[1])), x1 = Math.min(st.iw, Math.ceil(o.crop[2]));
  const y1 = Math.min(st.ih, Math.ceil(o.keel ? Math.min(o.crop[3], Math.max(kY(o, o.crop[0]), kY(o, o.crop[2])) + 2) : o.crop[3]));
  const W0 = x1 - x0, H0 = y1 - y0; if (W0 < 8 || H0 < 8) return null;
  const f = Math.max(1, Math.ceil(Math.max(W0 / 1400, H0 / 700))), w = Math.ceil(W0 / f), h = Math.ceil(H0 / f);
  const data = st.src.getContext('2d', { willReadFrequently: true }).getImageData(x0, y0, W0, H0).data, thr = st.thr;
  const ink = new Uint8Array(w * h);
  for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) {
    const i = (y * W0 + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2], lum = 0.299 * r + 0.587 * g + 0.114 * b, sat = Math.max(r, g, b) - Math.min(r, g, b);
    if (lum < thr || (sat > 50 && lum < 246)) ink[((y / f) | 0) * w + ((x / f) | 0)] = 1;
  }
  // độ dày nét vẽ (để bù: đường bao vẽ đè lên mép thật một nửa bề dày nét)
  const runs = [];
  for (let y = 0; y < h; y += 2) { let r = 0; for (let x = 0; x < w; x++) { if (ink[y * w + x]) r++; else { if (r > 0 && r <= 8) runs.push(r); r = 0; } } }
  for (let x = 0; x < w; x += 2) { let r = 0; for (let y = 0; y < h; y++) { if (ink[y * w + x]) r++; else { if (r > 0 && r <= 8) runs.push(r); r = 0; } } }
  runs.sort((a, b) => a - b); const t = runs.length > 30 ? Math.min(3, runs[runs.length >> 1]) : 0;
  const R = 2, dil = morph(ink, w, h, R, true);
  // vùng ngoài: loang từ mép khung qua các điểm không có nét
  const ext = new Uint8Array(w * h), q = new Int32Array(w * h); let qh = 0, qt = 0;
  const push = (i) => { if (!ext[i] && !dil[i]) { ext[i] = 1; q[qt++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); } for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (qh < qt) { const i = q[qh++], x = i % w; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (i >= w) push(i - w); if (i < (h - 1) * w) push(i + w); }
  let sil = new Uint8Array(w * h); for (let i = 0; i < sil.length; i++) sil[i] = ext[i] ? 0 : 1;
  sil = morph(sil, w, h, R, false);
  // bỏ các mảng nhỏ (chữ, ký hiệu lẻ)
  const lab = new Int32Array(w * h), sizes = [0]; let nl = 0;
  for (let s0 = 0; s0 < sil.length; s0++) {
    if (!sil[s0] || lab[s0]) continue; nl++; let n = 0; qh = 0; qt = 0; lab[s0] = nl; q[qt++] = s0;
    while (qh < qt) { const i = q[qh++], x = i % w; n++; const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < (h - 1) * w ? i + w : -1]; for (const j of nb) if (j >= 0 && sil[j] && !lab[j]) { lab[j] = nl; q[qt++] = j; } }
    sizes.push(n);
  }
  const big = Math.max(0, ...sizes);
  for (let i = 0; i < sil.length; i++) if (sil[i] && sizes[lab[i]] < big * 0.02) sil[i] = 0;
  return { x0, y0, w, h, f, base: sil, t };
}
function morph(m, w, h, r, dilate) {
  const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) { const o = y * w; for (let x = 0; x < w; x++) { let v = dilate ? 0 : 1; for (let k = -r; k <= r; k++) { const xx = x + k; const p = xx < 0 || xx >= w ? (dilate ? 0 : 1) : m[o + xx]; if (dilate ? p : !p) { v = dilate ? 1 : 0; break; } } tmp[o + x] = v; } }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = dilate ? 0 : 1; for (let k = -r; k <= r; k++) { const yy = y + k; const p = yy < 0 || yy >= h ? (dilate ? 0 : 1) : tmp[yy * w + x]; if (dilate ? p : !p) { v = dilate ? 1 : 0; break; } } out[y * w + x] = v; }
  return out;
}
function applyEdits(o) {
  const m = o.mask; if (!m) return; m.sil = m.base.slice();
  for (const e of o.edits) { const cx = (e.x - m.x0) / m.f, cy = (e.y - m.y0) / m.f, r = e.r / m.f; for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(m.h - 1, Math.ceil(cy + r)); y++) for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(m.w - 1, Math.ceil(cx + r)); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) m.sil[y * m.w + x] = e.add ? 1 : 0; }
  m.img = null;
}
function detectAll(warn) {
  if (!st.src) return;
  if (!st.side.crop) { if (warn) { setTool('crop'); flashHint('Hãy khoanh hình chiếu cạnh trước (bước 2).'); } return; }
  for (const o of [st.side, st.front]) { if (!o.crop) continue; o.mask = detect(o); applyEdits(o); }
  results(); paint();
}
function brushAt(q) {
  const o = st.side.mask && inBox(q, st.side.crop) ? st.side : st.front.mask && inBox(q, st.front.crop) ? st.front : st.side.mask ? st.side : null;
  if (!o) { flashHint('Bấm «Tự tách bóng tàu» trước rồi mới sửa tay.'); return; }
  o.edits.push({ x: q[0], y: q[1], r: st.brush / st.v.sc, add: st.tool === 'add' }); applyEdits(o); paint();
}
const kY = (o, X) => { const k = o.keel; if (!k) return null; const a = k.a, b = k.b; if (!b || Math.abs(b[0] - a[0]) < 1) return a[1]; return a[1] + (b[1] - a[1]) * (X - a[0]) / (b[0] - a[0]); };
const inBox = (q, c) => c && q[0] >= c[0] && q[0] <= c[2] && q[1] >= c[1] && q[1] <= c[3];
function flashHint(t) { const h = $('#wHint'); h.textContent = t; h.classList.add('bad'); setTimeout(() => { h.classList.remove('bad'); h.textContent = HINTS[st.tool] || ''; }, 3500); }

// ---- tính diện tích ----
function measure(o, side) {
  const m = o.mask; if (!m || !m.sil || !st.mpp || !o.keel) return null;
  let xmin = 1e9, xmax = -1;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.sil[y * m.w + x]) { if (x < xmin) xmin = x; if (x > xmax) xmax = x; }
  if (xmax < 0) return null;
  const X0 = m.x0 + xmin * m.f, X1 = m.x0 + (xmax + 1) * m.f, px = m.f * st.mpp;
  const wl = (X) => { if (!side) return kY(o, X) - (st.tf + st.ta) / 2 / st.mpp; const t = (X - X0) / Math.max(1, X1 - X0), T = st.bowRight ? st.ta + (st.tf - st.ta) * t : st.tf + (st.ta - st.tf) * t; return kY(o, X) - T / st.mpp; };
  let n = 0, sx = 0, sz = 0, top = 1e9, nb = 0; const S = m.sil, w = m.w;
  for (let x = xmin; x <= xmax; x++) {
    const X = m.x0 + (x + 0.5) * m.f, yw = wl(X);
    for (let y = 0; y < m.h; y++) {
      const i = y * w + x; if (!S[i]) continue; const Y = m.y0 + (y + 0.5) * m.f; if (Y >= yw) continue; n++; sx += X; sz += (yw - Y); if (Y < top) top = Y;
      if (!(x > 0 && S[i - 1]) || !(x < w - 1 && S[i + 1]) || !(y > 0 && S[i - w])) nb++;
    }
  }
  if (!n) return null;
  const nA = Math.max(n * 0.5, n - nb * (m.t || 0) / 2);
  const mid = (X0 + X1) / 2, xc = (sx / n - mid) * st.mpp * (st.bowRight ? 1 : -1);
  return { area: nA * px * px, xc, zc: sz / n * st.mpp, len: (X1 - X0) * st.mpp, hTop: (wl(mid) - top) * st.mpp, X0, X1 };
}
function results() {
  const el = $('#wRes'); if (!el) return; const ok = (b) => b ? '✓' : '·';
  const sd = st.src, cr = st.side.crop, sc = st.mpp > 0, kl = !!st.side.keel, dm = !!st.side.mask;
  $('#wScale').textContent = sc ? '1 điểm ảnh = ' + (st.mpp * 1000).toFixed(1) + ' mm thật' : st.spts.length === 1 ? 'Bấm điểm thứ 2…' : '';
  const r = measure(st.side, true), rf = measure(st.front, false);
  st.res = r ? { AL: r.area, AF: rf ? rf.area : 1.4 * num(A.p.B, 18) * r.area / Math.max(1, r.len), afEst: !rf, xc: r.xc, zc: r.zc, len: r.len, hTop: r.hTop } : null;
  let h = `<div class="flex" style="gap:2px 10px;font-size:11.5px;color:#B8C7D1"><span>${ok(sd)} Bản vẽ</span><span>${ok(cr)} Khoanh</span><span>${ok(sc)} Tỷ lệ</span><span>${ok(kl)} Ki</span><span>${ok(dm)} Bóng tàu</span></div>`;
  if (st.res) {
    const R = st.res, loa = num(A.p.loa, 0), dl = loa ? Math.abs(R.len - loa) / loa : 0;
    h += `<div class="wbig"><span>Diện tích hứng gió mạn</span><b>${R.AL.toFixed(0)} m²</b></div>
      <div class="wbig"><span>Diện tích hứng gió chính diện${R.afEst ? ' (ước tính)' : ''}</span><b>${R.AF.toFixed(0)} m²</b></div>
      <div class="kv"><span>Tâm hứng gió (+ về mũi)</span><b>${R.xc >= 0 ? '+' : ''}${R.xc.toFixed(1)} m</b></div>
      <div class="kv"><span>Độ cao tâm trên mặt nước</span><b>${R.zc.toFixed(1)} m</b></div>
      <div class="kv"><span>Điểm cao nhất trên mặt nước</span><b>${R.hTop.toFixed(1)} m</b></div>
      <div class="kv"><span>Chiều dài đo trên hình</span><b>${R.len.toFixed(1)} m</b></div>
      ${loa && dl > 0.04 ? `<div class="note" style="margin-top:6px">Chiều dài đo được lệch ${(dl * 100).toFixed(0)}% so với LOA ở tab 1 (${loa} m) — kiểm tra lại 2 điểm tỷ lệ hoặc khung khoanh.</div>` : ''}
      <div class="muted" style="margin-top:6px">Đang ở tab 1: mạn ${num(A.p.windAL, 0)} m² · chính diện ${num(A.p.windAF, 0)} m² · tâm ${num(A.p.windXc, 0)} m</div>`;
  } else if (dm && !sc) h += '<div class="muted" style="margin-top:6px">Cần đặt tỷ lệ (bước 3).</div>';
  else if (dm && !kl) h += '<div class="muted" style="margin-top:6px">Cần bấm đường ki (bước 4).</div>';
  el.innerHTML = h; $('#wApply').disabled = !st.res;
}
function apply() {
  const R = st.res; if (!R) return;
  A.p.windAL = Math.round(R.AL); A.p.windAF = Math.round(R.AF); A.p.windXc = Math.round(R.xc * 10) / 10; saveShip();
  $('#wdlg').style.display = 'none';
  if (A.hooks.shipEdited) A.hooks.shipEdited();
}

// ---- vẽ ----
function maskImg(m, rgb) {
  if (m.img) return m.img; const c = document.createElement('canvas'); c.width = m.w; c.height = m.h; const g = c.getContext('2d'), id = g.createImageData(m.w, m.h), d = id.data;
  for (let i = 0; i < m.sil.length; i++) if (m.sil[i]) { d[i * 4] = rgb[0]; d[i * 4 + 1] = rgb[1]; d[i * 4 + 2] = rgb[2]; d[i * 4 + 3] = 120; }
  g.putImageData(id, 0, 0); m.img = c; return c;
}
function paint() {
  const c = $('#wCv'); if (!c) return; sizeCv(); const g = c.getContext('2d'); g.fillStyle = '#2a3238'; g.fillRect(0, 0, c.width, c.height); if (!st.src) return;
  const v = st.v; g.save(); g.imageSmoothingEnabled = v.sc < 1; g.setTransform(v.sc, 0, 0, v.sc, c.width / 2 - v.cx * v.sc, c.height / 2 - v.cy * v.sc); g.drawImage(st.src, 0, 0);
  for (const [o, col] of [[st.side, [255, 120, 0]], [st.front, [0, 170, 90]]]) if (o.mask && o.mask.sil) { const m = o.mask; g.drawImage(maskImg(m, col), m.x0, m.y0, m.w * m.f, m.h * m.f); }
  g.restore();
  const box = (cr, col) => { if (!cr) return; const a = i2s([cr[0], cr[1]]), b = i2s([cr[2], cr[3]]); g.strokeStyle = col; g.lineWidth = 2; g.setLineDash([7, 4]); g.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); g.setLineDash([]); };
  box(st.side.crop, '#00B8D4'); box(st.front.crop, '#2E7D32');
  const line = (o, side) => {
    if (!o.keel || !o.crop) return; const a = i2s([o.crop[0], kY(o, o.crop[0])]), b = i2s([o.crop[2], kY(o, o.crop[2])]); g.fillStyle = '#0D47A1'; for (const kp of [o.keel.a, o.keel.b]) if (kp) { const sp = i2s(kp); g.fillRect(sp[0] - 4, sp[1] - 4, 8, 8); } g.strokeStyle = '#0D47A1'; g.lineWidth = 2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    if (!st.mpp) return; const xl = o.crop[0], xr = o.crop[2]; let tl = (st.tf + st.ta) / 2, tr = tl; if (side) { tl = st.bowRight ? st.ta : st.tf; tr = st.bowRight ? st.tf : st.ta; }
    const p = i2s([xl, kY(o, xl) - tl / st.mpp]), q2 = i2s([xr, kY(o, xr) - tr / st.mpp]); g.strokeStyle = '#1E88E5'; g.setLineDash([10, 5]); g.lineWidth = 2; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q2[0], q2[1]); g.stroke(); g.setLineDash([]);
    g.font = 'bold 12px Segoe UI'; g.fillStyle = '#1E88E5'; g.fillText('Đường nước', p[0] + 4, p[1] - 5); g.fillStyle = '#0D47A1'; g.fillText('Đường ki', a[0] + 4, a[1] + 14);
  };
  line(st.side, true); line(st.front, false);
  if (st.spts.length) { g.strokeStyle = '#D81B60'; g.fillStyle = '#D81B60'; g.lineWidth = 2; g.beginPath(); st.spts.forEach((q, i) => { const s = i2s(q); if (i) g.lineTo(s[0], s[1]); else g.moveTo(s[0], s[1]); g.fillRect(s[0] - 4, s[1] - 4, 8, 8); }); g.stroke(); if (st.spts.length === 2 && st.mpp) { const s = i2s(st.spts[1]); g.font = 'bold 12px Segoe UI'; g.fillText(st.sdist + ' m', s[0] + 8, s[1] - 6); } }
}
export function windageState() { return st; }
