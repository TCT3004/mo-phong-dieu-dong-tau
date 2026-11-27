// Tab 5: xem lại & xuất video.
import { uiAlert } from './dialog.js';
import { A, $, $$, num, esc, pad3, clock, DB, sunEl, appWind } from './app.js';
import { envWaveL } from './world.js';
import { D2R } from './physics.js';
import { ChartCanvas } from './render/chartcanvas.js';
import { CS, toWorld } from './chartsys.js';
import { makeGeo, mToPx } from './kap.js';
import { WorldFrame } from './geo/frame.js';
import { drawOverlay } from './ui_setup.js';
import { shipPoly, drawTraffic } from './ui_run.js';

export const R = { ses: null, t: 0, playing: false, speed: 30, mode: 'chart', view: 'follow', ex: { view: 'follow', layout: 'pip', res: 720, speed: 10, range: 'all', overlay: true, audio: true }, rec: null };
let cv = null, pip = null, comp = null;
const seg = (id, opts, cur, cb) => { const el = $(id); el.innerHTML = opts.map((o) => `<button data-v="${o[0]}" class="${String(o[0]) === String(cur) ? 'on' : ''}">${o[1]}</button>`).join(''); el.onclick = (e) => { const v = e.target.dataset.v; if (v !== undefined) cb(isNaN(+v) ? v : +v); }; };

export function saveSession() {
  const s = A.sim; if (!s || s.rec.length < 20) return null;
  const ses = { id: 'S' + Date.now(), name: A.env.name || 'Bài tập', date: new Date().toLocaleString('vi-VN'), chart: A.W.chartName(s.S.x, s.S.y), frame: s.frame || { lat0: CS.frame.lat0, lon0: CS.frame.lon0 }, rec: s.rec.slice(), trInfo: s.trInfo || null, log: s.log.slice().reverse(), day0: s.day0, ship: A.p.name, lights: Object.assign({}, s.lights), env: { waveDir: A.env.waveDir, waveT: A.env.waveT } };
  A.sessions.unshift(ses); DB.put('sessions', ses.id, ses); return ses;
}
export async function restoreSessions() { const keys = await DB.keys('sessions'); if (!keys) return; for (const k of keys.sort().reverse().slice(0, 30)) { const s = await DB.get('sessions', k); if (s && !A.sessions.find((q) => q.id === s.id)) A.sessions.push(s); } }
const dur = () => (R.ses && R.ses.rec.length ? R.ses.rec[R.ses.rec.length - 1].t : 0);
// bản ghi theo gốc tọa độ hiện tại: bài ghi lưu kèm gốc (lat0, lon0) của lúc ghi; đổi sang mét thế giới hiện tại khi xem lại
const conv = new WeakMap();
function legacyConv(s) {
  const r = CS.catalog.records.find((q) => q.name === s.chart && q.xf); if (!r) return null;
  const g = makeGeo({ refs: r.refs, W: r.W, H: r.H, datum: r.datumSrc });
  return (x, y) => { const [px, py] = mToPx(g, x, y); return toWorld(...r.xf.pxToLL(px, py)); };
}
export function rowsOf(s) {
  const key = CS.frame.lat0 + ',' + CS.frame.lon0, c = conv.get(s); if (c && c.key === key) return c.rows;
  let map = null;
  if (s.frame) { if (s.frame.lat0 !== CS.frame.lat0 || s.frame.lon0 !== CS.frame.lon0) { const f0 = new WorldFrame(s.frame.lat0, s.frame.lon0); map = (x, y) => toWorld(...f0.toLL(x, y)); } }
  else map = legacyConv(s);
  const rows = map ? s.rec.map((q) => { const [x, y] = map(q.x, q.y); return Object.assign({}, q, { x, y, tr: q.tr ? q.tr.map((a) => { const [tx, ty] = map(a[1], a[2]); return [a[0], tx, ty, a[3], a[4]]; }) : q.tr }); }) : s.rec;
  conv.set(s, { key, rows }); return rows;
}
// tàu khác tại dòng i của bản ghi (đã đổi gốc): tốc độ suy từ dòng kế tiếp
function trAt(s, i) {
  const r = rowsOf(s), row = r[i], nx = r[i + 1], info = s.trInfo || {}; if (!row || !row.tr) return [];
  return row.tr.map((a) => { const f = info[a[0]] || {}, b = nx && nx.tr ? nx.tr.find((q) => q[0] === a[0]) : null;
    return { id: a[0], tpl: f.tpl, kind: f.kind, name: f.name || 'Tàu khác', L: f.L || 30, B: f.B || 7, x: a[1], y: a[2], psi: a[3] * D2R, fishing: !!a[4], u: b ? Math.hypot(b[1] - a[1], b[2] - a[2]) / Math.max(0.5, nx.t - row.t) : 0 }; }).filter((q) => q.tpl);
}
export function rowAt(t) { const r = R.ses.rec; return r[Math.max(0, Math.min(r.length - 1, Math.round(t) - 1))]; }

export function initReplay() {
  if (!R.ses && A.sessions.length) { R.ses = A.sessions[0]; R.t = 0; }
  $('#p-rep').innerHTML = `<div class="flex" style="align-items:flex-start">
  <section class="card" style="flex:1 1 230px;max-width:290px"><h2>Bài đã ghi</h2><button class="btn sm" id="repSaveNow" style="width:100%;margin-bottom:8px">Lưu bài đang chạy vào đây</button><div class="lib" id="sesList" style="max-height:520px;overflow:auto"></div><div class="muted" style="margin-top:6px">Mỗi giây app ghi lại vị trí, hướng, tốc độ, góc lái, máy, độ sâu và mọi khẩu lệnh.</div></section>
  <section class="card" style="flex:999 1 560px;padding:0;overflow:hidden"><div class="flex" style="justify-content:space-between;align-items:center;gap:8px;padding:6px 10px;background:#0E161C;border-bottom:1px solid #22303A"><b id="repName"></b><div class="flex" style="gap:6px"><div class="seg" id="repMode"></div><div class="seg" id="repView"></div></div></div>
  <div style="position:relative;height:440px;background:#cfe6f2"><canvas id="repCv"></canvas><div class="glhold" id="glHoldR" style="position:absolute;inset:0;height:auto;border-radius:0;display:none"></div></div>
  <div class="col" style="padding:10px 12px;gap:8px"><div class="flex" style="gap:8px;align-items:center"><button class="btn sm" id="repStart" aria-label="Về đầu">⏮</button><button class="btn pri" id="repPlay" style="min-width:52px">▶</button><div class="seg" id="repSpd"></div><b class="mono" id="repT" style="font-size:14px"></b><span class="muted mono" id="repDur"></span><span style="flex:1"></span><button class="btn sm" id="exToggle">Xuất video</button></div>
  <input type="range" id="repSl" min="0" max="1" step="1" value="0" aria-label="Thanh thời gian" style="width:100%">
  <div id="exBox" class="rowi" style="display:none"></div>
  <div class="grid g2"><div><div class="muted" style="font-weight:600">TỐC ĐỘ (hl/h)</div><canvas id="gSog" style="width:100%;height:80px;display:block"></canvas></div><div><div class="muted" style="font-weight:600">ĐỘ SÂU DƯỚI KY — UKC (m) · vạch vàng: 1 m</div><canvas id="gUkc" style="width:100%;height:80px;display:block"></canvas></div></div></div></section>
  <div class="col" style="flex:1 1 260px;max-width:320px"><section class="card"><h2 id="repAt">Tại thời điểm</h2><div class="grid g2" id="repVals"></div></section><section class="card"><h2>Khẩu lệnh — bấm để nhảy tới</h2><div id="repOrd" style="max-height:380px;overflow:auto"></div></section></div></div>`;
  cv = new ChartCanvas($('#repCv'));
  $('#sesList').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; R.ses = A.sessions.find((s) => s.id === b.dataset.id); R.t = 0; R.playing = false; initReplay(); };
  $('#repSaveNow').onclick = () => { const s = saveSession(); if (s) { R.ses = s; R.t = 0; initReplay(); } else uiAlert('Bài đang chạy còn quá ngắn (dưới 20 giây).'); };
  $('#repPlay').onclick = () => { if (!R.ses) return; if (R.t >= dur()) R.t = 0; R.playing = !R.playing; };
  $('#repStart').onclick = () => { R.t = 0; R.playing = false; };
  $('#repSl').oninput = (e) => { R.t = +e.target.value; R.playing = false; };
  $('#repOrd').onclick = (e) => { const b = e.target.closest('button'); if (b) { R.t = +b.dataset.t; R.playing = false; } };
  $('#exToggle').onclick = () => { const b = $('#exBox'); b.style.display = b.style.display === 'none' ? 'block' : 'none'; drawEx(); };
  drawStatic();
}
function drawStatic() {
  $('#sesList').innerHTML = A.sessions.length ? A.sessions.map((s) => `<button data-id="${s.id}" class="${R.ses && s.id === R.ses.id ? 'on' : ''}"><b>${esc(s.name)}</b><br><span class="muted">${esc(s.date)} · ${Math.round(s.rec.length / 60)} phút · ${esc(s.chart || 'biển trống')}</span></button>`).join('') : '<div class="muted">Chưa có bài nào. Chạy một bài ở tab Điều động rồi quay lại đây.</div>';
  seg('#repMode', [['chart', 'Hải đồ 2D'], ['3d', 'Khung cảnh 3D']], R.mode, (v) => { R.mode = v; A.hooks.mountGL(); drawStatic(); });
  seg('#repView', [['bridge', 'Buồng lái'], ['wingS', 'Cánh gà'], ['top', 'Trên cao'], ['follow', 'Bám theo']], R.view, (v) => { R.view = v; drawStatic(); });
  $('#repView').style.display = R.mode === '3d' ? '' : 'none';
  seg('#repSpd', [[1, '×1'], [10, '×10'], [30, '×30'], [60, '×60']], R.speed, (v) => { R.speed = v; drawStatic(); });
  $('#repCv').style.display = R.mode === 'chart' ? 'block' : 'none'; $('#glHoldR').style.display = R.mode === '3d' ? 'block' : 'none';
  if (!R.ses) { $('#repName').textContent = 'Chưa chọn bài'; return; }
  const s = R.ses; $('#repName').textContent = s.name + ' · ' + s.date; $('#repSl').max = dur(); $('#repDur').textContent = '/ ' + clock(dur());
  const KC = { helm: '#FFB547', engine: '#5CD6FF', anchor: '#C9A7FF', line: '#C9A7FF', alarm: '#FF6B6B' };
  $('#repOrd').innerHTML = s.log.map((l) => `<button data-t="${Math.max(0, Math.round(l.t))}" style="display:grid;grid-template-columns:62px 8px 1fr;gap:8px;align-items:center;width:100%;min-height:28px;padding:0 6px;border:0;background:transparent;text-align:left"><span class="mono muted">${clock(l.t).slice(3)}</span><span style="width:8px;height:8px;border-radius:2px;background:${KC[l.kind] || '#8FA3B0'}"></span><span>${esc(l.text)}</span></button>`).join('');
  if (!s.frame && !legacyConv(s)) $('#repName').textContent += ' — bài ghi ở bản cũ, chưa có tờ «' + s.chart + '» trong kho nên không đặt được đúng vị trí';
  graph('gSog', 'sog', 0); graph('gUkc', 'ukc', 1);
}
function graph(id, key, thr) {
  const c = $('#' + id); if (!c || !R.ses) return; const w = c.width = c.clientWidth || 400, h = c.height = 80, g = c.getContext('2d'), r = R.ses.rec, T = dur() || 1;
  let mx = 1; for (const q of r) if (q[key] > mx) mx = q[key]; mx = key === 'ukc' ? Math.min(mx, 12) : mx;
  g.clearRect(0, 0, w, h); g.strokeStyle = '#22303A'; g.beginPath(); g.moveTo(0, h - 0.5); g.lineTo(w, h - 0.5); g.stroke();
  if (thr) { g.strokeStyle = '#FFB547'; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(0, h - h / mx); g.lineTo(w, h - h / mx); g.stroke(); g.setLineDash([]); }
  g.strokeStyle = '#5CD6FF'; g.lineWidth = 2; g.beginPath(); r.forEach((q, i) => { const x = q.t / T * w, y = h - Math.max(0, Math.min(mx, q[key])) / mx * (h - 4); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke();
  g.fillStyle = '#8FA3B0'; g.font = '10px Consolas'; g.fillText(mx.toFixed(0), 2, 10);
  g.fillStyle = '#FFB547'; g.fillRect(R.t / T * w - 1, 0, 2, h);
}
function draw2D(v, row, s, wide) {
  v.size(); const g = v.ctx, r = rowsOf(s), M = A.M; row = r[s.rec.indexOf(row)] || row;
  if (wide) { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const q of r) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); } const sp = Math.max(400, (x1 - x0) * 1.25, (y1 - y0) * 1.25 * v.cv.width / v.cv.height); v.setMpp(sp / v.cv.width); v.centerM((x0 + x1) / 2, (y0 + y1) / 2); }
  else { v.setMpp(3); v.centerM(row.x, row.y); }
  v.rot = 0; v.draw(); drawOverlay(v, true);
  g.save(); g.lineJoin = 'round'; const i0 = r.indexOf(row);
  g.strokeStyle = '#607D8B'; g.lineWidth = 1.5; g.setLineDash([5, 4]); g.beginPath(); for (let i = i0; i < r.length; i += 3) { const p = v.m2s(r[i].x, r[i].y); if (i === i0) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); } g.stroke(); g.setLineDash([]);
  g.strokeStyle = '#0D47A1'; g.lineWidth = 3; g.beginPath(); for (let i = 0; i <= i0; i += 2) { const p = v.m2s(r[i].x, r[i].y); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); } g.stroke();
  g.strokeStyle = '#455A64'; g.lineWidth = 1; for (let i = 300; i < r.length; i += 300) { const pl = shipPoly(v, r[i].x, r[i].y, r[i].psi, M, 0); g.beginPath(); pl.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.stroke(); }
  drawTraffic(v, g, trAt(s, i0), null, null);
  const pl = shipPoly(v, row.x, row.y, row.psi, M, 14); g.fillStyle = 'rgba(13,71,161,.4)'; g.strokeStyle = '#0D47A1'; g.lineWidth = 2; g.beginPath(); pl.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill(); g.stroke();
  g.restore();
}
function env3(row, s) { const ds = s.day0 + row.t, aw = appWind({ wDir: row.wDir || 0, wKn: row.wKn || 0 }, { u: (row.sog || 0) * 0.514444, psi: row.psi || 0 }); return { spd: (row.sog || 0) * 0.514444, awTo: aw.to, awKn: aw.kn, sunEl: sunEl(ds, (s.env && s.env.light) || 'auto'), sunAz: 2 * Math.PI * (ds / 86400), vis: row.vis || 11000, tide: row.tide, waveH: row.wH || 0, waveD: (row.wD !== undefined ? row.wD : s.env ? +s.env.waveDir || 0 : 0) * Math.PI / 180, waveT: Math.sqrt(2 * Math.PI * (row.wL || (s.env ? envWaveL(s.env) : 225)) / 9.81), rain: row.rn || 0, cloud: row.cl !== undefined ? row.cl : 0.2, wDir: row.wDir || 0, wKn: row.wKn || 0, rollK: A.set.rollSpeed, t: row.t, lights: s.lights || {}, daySec: ds }; }
export function replayFrame(dt) {
  const s = R.ses; if (!s || !$('#repCv')) return;
  if (R.playing) { R.t += dt * (R.rec ? R.ex.speed : R.speed); if (R.t >= dur()) { R.t = dur(); R.playing = false; if (R.rec) stopExport(); } }
  const row = rowAt(R.t), use3 = R.rec ? R.ex.view !== 'chart' : R.mode === '3d';
  if (use3 && A.view) { A.view.setSegs([]); A.view.setTraffic(trAt(s, s.rec.indexOf(row))); { const q = rowsOf(s)[s.rec.indexOf(row)] || row; A.view.update({ x: q.x, y: q.y, psi: row.psi }, R.rec ? R.ex.view : R.view, env3(row, s)); } A.view.render(); }
  if (!use3 || !R.rec) { if (R.mode === 'chart' || (R.rec && !use3)) draw2D(cv, row, s, true); }
  $('#repSl').value = Math.round(R.t); $('#repT').textContent = clock(R.t); $('#repPlay').textContent = R.playing ? '⏸' : '▶';
  $('#repAt').textContent = 'Tại ' + clock(s.day0 + row.t);
  const st = (row.st || '').split(',').map((id) => id === 'st' ? 'Dừng' : (A.p.steps.find((q) => q.id === id) || { label: id }).label).join(' · ');
  const rd = Math.round(row.d), V = [['Hướng mũi', pad3(row.psi / D2R) + '°'], ['Tốc độ', row.sog.toFixed(1) + ' hl/h'], ['Quay trở', (row.rot >= 0 ? '+' : '−') + Math.abs(row.rot).toFixed(1) + ' °/ph'], ['Góc lái', rd < 0 ? 'Trái ' + -rd + '°' : rd > 0 ? 'Phải ' + rd + '°' : '0°'], ['Máy', st], ['UKC', row.ukc.toFixed(1) + ' m']];
  $('#repVals').innerHTML = V.map((q) => `<div><div class="muted">${q[0]}</div><div class="mono" style="font-size:16px;font-weight:600">${q[1]}</div></div>`).join('');
  if (Math.round(R.t) % 2 === 0) { graph('gSog', 'sog', 0); graph('gUkc', 'ukc', 1); }
  if (R.rec) composeFrame(row, s, use3);
}
// ---------- xuất video ----------
function drawEx() {
  const x = R.ex, b = $('#exBox'); if (!b || b.style.display === 'none') return;
  const g = (k, label, opts) => `<div class="fld"><span class="lbl">${label}</span><div class="seg" data-ex="${k}">${opts.map((o) => `<button data-v="${o[0]}" class="${String(x[k]) === String(o[0]) ? 'on' : ''}">${o[1]}</button>`).join('')}</div></div>`;
  const sec = R.ses ? (x.range === 'all' ? dur() : dur() - R.t) / x.speed : 0;
  b.innerHTML = `<div class="flex" style="gap:10px 16px">${g('view', 'Góc nhìn', [['chart', 'Hải đồ 2D'], ['bridge', '3D buồng lái'], ['wingS', '3D cánh gà'], ['top', '3D trên cao'], ['follow', '3D bám theo']])}${g('layout', 'Bố cục', [['full', 'Một góc'], ['pip', '3D + hải đồ nhỏ']])}${g('res', 'Độ phân giải', [[720, '720p'], [1080, '1080p']])}${g('speed', 'Tốc độ video', [[1, '×1'], [4, '×4'], [10, '×10'], [30, '×30']])}${g('range', 'Đoạn', [['all', 'Toàn bài'], ['from', 'Từ mốc đang xem']])}</div>
  <label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="exOv" ${x.overlay ? 'checked' : ''} style="width:17px;height:17px"> Chèn bảng thông số và phụ đề khẩu lệnh</label>
  <div class="muted" style="margin-top:6px">Video dài khoảng ${clock(sec).slice(3)} — app phát lại bài và ghi hình trực tiếp, nên thời gian xuất bằng đúng độ dài video. Giữ nguyên tab này trong lúc xuất.</div>
  <div class="flex" style="gap:8px;align-items:center;margin-top:8px"><button class="btn pri" id="exGo">${R.rec ? 'Dừng & lưu video' : 'Bắt đầu xuất video'}</button><span id="exMsg" class="muted"></span></div>`;
  $$('#exBox [data-ex]').forEach((el) => { el.onclick = (e) => { const v = e.target.dataset.v; if (v === undefined || R.rec) return; x[el.dataset.ex] = isNaN(+v) ? v : +v; drawEx(); }; });
  $('#exOv').onchange = (e) => { x.overlay = e.target.checked; };
  $('#exGo').onclick = () => (R.rec ? stopExport() : startExport());
}
function startExport() {
  if (!R.ses) return uiAlert('Chưa chọn bài để xuất.'); if (typeof MediaRecorder === 'undefined') return uiAlert('Trình duyệt này không hỗ trợ ghi video. Dùng Edge hoặc Chrome.');
  const x = R.ex; comp = document.createElement('canvas'); comp.height = x.res; comp.width = Math.round(x.res * 16 / 9);
  pip = pip || new ChartCanvas(Object.assign(document.createElement('canvas'), { width: 420, height: 280 }));
  const stream = comp.captureStream(30);
  if (A.snd.rec) for (const tr of A.snd.rec.stream.getAudioTracks()) stream.addTrack(tr);
  const types = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'], type = types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
  const mr = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: x.res >= 1080 ? 8e6 : 4e6 } : undefined), chunks = [];
  mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  mr.onstop = () => { const blob = new Blob(chunks, { type: mr.mimeType || 'video/webm' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (R.ses.name || 'bai-tap').replace(/[^\p{L}\p{N} _-]/gu, '') + (/mp4/.test(mr.mimeType) ? '.mp4' : '.webm'); a.click(); R.rec = null; R.lastFile = a.download; A.hooks.mountGL(); drawEx(); const m = $('#exMsg'); if (m) m.textContent = 'Đã lưu ' + a.download + ' vào thư mục Tải xuống'; };
  if (x.range === 'all') R.t = 0; R.rec = mr; R.playing = true; if (x.view !== 'chart') { R.mode = '3d'; A.hooks.mountGL(); drawStatic(); } mr.start(1000); drawEx();
}
function stopExport() { if (R.rec && R.rec.state !== 'inactive') R.rec.stop(); R.playing = false; }
function composeFrame(row, s, use3) {
  const x = R.ex, g = comp.getContext('2d'), w = comp.width, h = comp.height, k = h / 720;
  if (use3) { g.drawImage(A.gl, 0, 0, w, h); if (x.layout === 'pip') { draw2D(pip, row, s, false); g.drawImage(pip.cv, w - 436 * k, h - 296 * k, 420 * k, 280 * k); g.strokeStyle = '#0B1116'; g.lineWidth = 3 * k; g.strokeRect(w - 436 * k, h - 296 * k, 420 * k, 280 * k); } }
  else g.drawImage(cv.cv, 0, 0, w, h);
  if (!x.overlay) return;
  const rd = Math.round(row.d), L = [clock(s.day0 + row.t), 'Hướng ' + pad3(row.psi / D2R) + '°', 'Tốc độ ' + row.sog.toFixed(1) + ' hl/h', 'Lái ' + (rd < 0 ? 'trái ' + -rd : rd > 0 ? 'phải ' + rd : '0') + '°', 'UKC ' + row.ukc.toFixed(1) + ' m'];
  g.font = `600 ${18 * k}px Consolas, monospace`; g.fillStyle = 'rgba(9,14,18,.78)'; g.fillRect(16 * k, 16 * k, 250 * k, (L.length * 26 + 14) * k); g.fillStyle = '#E6EDF2'; L.forEach((t, i) => g.fillText(t, 28 * k, (44 + i * 26) * k));
  let last = null; for (const l of s.log) { if (l.t <= row.t && row.t - l.t < 8 * Math.max(1, x.speed / 2)) last = l; }
  if (last) { g.font = `600 ${24 * k}px "Segoe UI", sans-serif`; const tw = g.measureText(last.text).width; g.fillStyle = 'rgba(9,14,18,.78)'; g.fillRect(w / 2 - tw / 2 - 16 * k, h - 70 * k, tw + 32 * k, 44 * k); g.fillStyle = '#FFB547'; g.fillText(last.text, w / 2 - tw / 2, h - 40 * k); }
}
