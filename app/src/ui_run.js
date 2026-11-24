// Tab 3: buồng lái của người điều động — 3 cửa sổ phía trên, bàn điều khiển phía dưới
// (hải đồ · radar · màn hình chính + khẩu lệnh lái · tay chuông máy + vô lăng · bảng neo/dây/đèn/tín hiệu/nhật ký).
import { A, $, $$, num, esc, pad3, clock, Orders, helmSteps, LIGHTS, LIGHT_PRESETS, logOrder, derived, engName, saveSet, saveObjs, sunEl } from './app.js';
import { STEP_ORDER, stepLabel, displayRpm, KN, D2R } from './physics.js';
import { sendLine, body2w, wrap180, makeLines } from './world.js';
import { ChartCanvas } from './render/chartcanvas.js';
import { drawOverlay } from './ui_setup.js';
import { Radar, RANGES } from './radar.js';
import { NM, fmtDist, brgDeg, trackRoute } from './nav.js';

let mini = null, radar = null, mapScale = 4, panel = 'day', lastLog = -1, built = '', telLink = true;
const mapOff = { x: 0, y: 0 }, routeSt = {}, telDrag = {};
let fogNext = 0;
const VIEWS = [['bridge', 'Buồng lái'], ['wingP', 'Cánh gà trái'], ['wingS', 'Cánh gà phải'], ['aft', 'Nhìn về lái'], ['top', 'Trên cao'], ['follow', 'Bám theo tàu']];
export const runState = { view: 'bridge' };
const rT = (a) => { const r = Math.round(a); return r < 0 ? 'Trái ' + -r + '°' : r > 0 ? 'Phải ' + r + '°' : '0°'; };
const seg = (el, opts, cur, cb) => { el.innerHTML = opts.map((o) => `<button data-v="${o[0]}" class="${String(o[0]) === String(cur) ? 'on' : ''}">${o[1]}</button>`).join(''); el.onclick = (e) => { const v = e.target.dataset.v; if (v !== undefined) cb(v); }; };
const cpos = (cv, e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
export const paneCvs = () => [$('#pw0'), $('#pw1'), $('#pw2')];
const curRoute = () => { const o = A.W.objs, i = o.routeSel; return o.routes && i >= 0 && o.routes[i] && o.routes[i].pts.length > 1 ? o.routes[i] : null; };

export function initRun() {
  $('#p-run').innerHTML = `
  <div class="band br" id="band">
    <div class="glhold" id="glHold3"></div>
    <div class="wins"><div class="win wl"><canvas id="pw0"></canvas></div><div class="win wc"><canvas id="pw1"></canvas></div><div class="win wr"><canvas id="pw2"></canvas></div></div>
    <div class="btop"><div class="seg" id="viewSeg"></div></div>
    <canvas id="tape" class="ovl" width="900" height="66"></canvas><div id="hdgBig">000.0°</div>
    <div id="banner"></div>
  </div>
  <div class="console">
    <section class="cc">
      <div class="mapbox"><canvas id="mini" style="cursor:crosshair;touch-action:none"></canvas>
        <div style="position:absolute;top:5px;left:5px;right:44px;display:flex;flex-direction:column;align-items:flex-start;gap:3px;pointer-events:none"><div class="ovl" id="mapName" style="position:static;padding:2px 8px;font-size:11.5px;font-weight:700;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div><div class="ovl" id="mapInfoBox" style="position:static;padding:2px 8px;font-size:11px;line-height:1.4;display:none"><span id="mapInfo"></span><span id="markInfo" style="display:block;color:#7CF29A"></span></div></div>
        <button class="shipBtn" id="mapHome" aria-label="Về vị trí tàu" title="Về vị trí tàu"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 2.5 L16.2 9 L16.2 20.5 L7.8 20.5 L7.8 9 Z" fill="currentColor" fill-opacity=".25" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="13" r="1.8" fill="currentColor"/></svg></button>
        <div style="position:absolute;left:5px;bottom:5px;display:flex;gap:3px;align-items:flex-end;flex-wrap:wrap;max-width:calc(100% - 80px)"><div class="seg" id="oriSeg"></div><button class="btn sm" id="mzOut" aria-label="Thu nhỏ hải đồ">−</button><button class="btn sm" id="mzIn" aria-label="Phóng to hải đồ">+</button></div>
        <div class="ovl muted" id="mapScale" style="right:5px;bottom:5px;padding:2px 7px;font-size:10px;pointer-events:none"></div>
      </div>
      <div class="rbar"><label for="routeSel" class="muted">Tuyến đi hiển thị</label><select id="routeSel"></select></div>
      <div class="envc"><div class="grid g3" id="envBox" style="gap:3px 8px"></div>
        <div class="ukc"><div><div class="lb">ĐỘ SÂU DƯỚI KY</div><span class="big" id="iUkc" style="font-size:20px"></span><span class="muted"> m </span><span class="pill" id="iUkcS"></span></div>
        <div class="muted mono" style="flex:1;font-size:10.5px;line-height:1.45;white-space:nowrap">hải đồ <b id="iHc"></b> + triều <b id="iTide"></b><br>− mớn <b id="iDraft"></b> − squat <b id="iSq"></b> (m)</div></div></div>
    </section>
    <section class="cc">
      <div class="cch"><b>RADAR</b><span class="flex" style="gap:4px;align-items:center"><button class="btn sm" id="rzOut" aria-label="Giảm cự ly radar">−</button><span class="mono" id="rRange" style="min-width:58px;text-align:center"></span><button class="btn sm" id="rzIn" aria-label="Tăng cự ly radar">+</button><span class="seg" id="rMode"></span></span></div>
      <div class="rbox"><canvas id="radar" style="cursor:crosshair;touch-action:none"></canvas></div>
      <div class="rfoot mono" id="rFoot"></div>
    </section>
    <section class="cc conn">
      <div class="cgrid">
        <div class="cbox"><div class="lb">HƯỚNG MŨI</div><div class="big" id="iHdg" style="color:#5CD6FF"></div><div class="kv"><span>Hướng đi thực</span><b id="iCog"></b></div><div class="kv"><span>Góc dạt</span><b id="iDrift"></b></div><div class="kv"><span>Đang giữ</span><b id="iTgt" style="color:#FFB547"></b></div></div>
        <div class="cbox"><div class="lb">TỐC ĐỘ THỰC</div><div class="big"><span id="iSog"></span><span class="muted" style="font-size:12px"> hl/h</span></div><div class="kv"><span>Theo nước</span><b id="iStw"></b></div><div class="kv"><span>Ngang mũi</span><b id="iBow"></b></div><div class="kv"><span>Ngang lái</span><b id="iStern"></b></div></div>
      </div>
      <div class="cbox" style="padding-bottom:4px"><div class="flex" style="justify-content:space-between;gap:6px"><span class="lb">GÓC LÁI <span style="color:#E6EDF2" id="iAct"></span> · LỆNH <span style="color:#FFB547" id="iOrd"></span></span><span class="lb">MÁY <span id="iStep" style="color:#FFB547"></span></span></div>
        <canvas id="rudCv" style="width:100%;height:62px;display:block"></canvas>
        <div class="rotrow"><span class="lb" style="white-space:nowrap">QUAY TRỞ</span><div class="rotbar"><i id="rotBar"></i><s></s></div><b class="mono" id="oRot" style="text-align:right"></b></div>
        <div class="kv"><span>Vòng quay thực / lệnh</span><b><span id="iRpm"></span> / <span id="iRpmO" style="color:#FFB547"></span></b></div>
      </div>
      <div class="cbox col" style="gap:5px">
        <div class="flex" style="justify-content:space-between;align-items:center;gap:6px;flex-wrap:nowrap"><div class="muted" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Người lái: <b id="hRep" style="color:#E6EDF2"></b></div><div class="seg" id="steerSeg" style="flex:none"></div></div>
        <div class="helm" id="helmBtns" title="Phím ← / → đánh lái trái / phải từng nấc"></div>
        <div class="flex" style="gap:6px;align-items:center;flex-wrap:nowrap"><button class="btn sm" id="steadyBtn">Giữ hướng</button>
          <div style="display:flex;align-items:center;gap:5px;padding:2px 3px 2px 8px;border:1px solid #33444F;border-radius:7px;background:#0D151A;min-width:0"><label for="courseIn" id="courseLbl" class="muted" style="white-space:nowrap">Đi hướng</label><input id="courseIn" class="cell mono" type="number" min="0" max="359" style="width:62px;height:26px;font-size:14px"><span class="muted">°</span><button class="btn pri sm" id="courseBtn">Ra lệnh</button></div>
          <span class="muted" id="hMode" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span></div>
      </div>
      <div class="cbox" id="routeBox"><div class="lb">TUYẾN ĐI <span id="routeName" style="color:#E9A6D3"></span></div><div class="mono" id="routeInfo" style="font-size:11.5px;line-height:1.5;color:#E6EDF2"></div></div>
    </section>
    <section class="cc telc" id="telCard">
      <div class="cch" title="Phím ↑ tăng một nấc máy · phím ↓ giảm một nấc máy"><b>TAY CHUÔNG MÁY <span class="muted" style="font-weight:400;letter-spacing:0">↑↓</span></b><button class="btn sm" id="telLink" style="display:none">Gộp cần</button></div>
      <div class="tels" id="tels"></div>
      <div class="wheel"><svg viewBox="-60 -60 120 120" aria-label="Vô lăng"><g id="wheelG"><circle r="44" fill="none" stroke="#6b5136" stroke-width="7"/><circle r="44" fill="none" stroke="#a37a4c" stroke-width="3"/>${[0, 60, 120, 180, 240, 300].map((a) => `<g transform="rotate(${a})"><rect x="-2.2" y="-44" width="4.4" height="36" fill="#8b6640"/><rect x="-3.4" y="-58" width="6.8" height="13" rx="3" fill="#a37a4c"/></g>`).join('')}<circle r="10" fill="#2b3a44" stroke="#8b6640" stroke-width="3"/><rect x="-2" y="-58" width="4" height="7" rx="2" fill="#FFB547"/></g></svg>
        <div class="muted" style="line-height:1.25;font-size:11px">Vô lăng<br><b class="mono" id="whOrd" style="color:#FFB547;font-size:12px"></b><br>Bánh lái<br><b class="mono" id="whAct" style="color:#E6EDF2;font-size:12px"></b></div></div>
    </section>
    <section class="cc panc">
      <div class="flex" style="gap:5px;padding:6px 6px 0;flex-wrap:nowrap"><button class="btn sm" id="hornBtn" style="flex:1;touch-action:none">Còi (giữ)</button><button class="btn sm" id="bellBtn" style="flex:1;touch-action:none">Chuông (giữ)</button><button class="btn sm warn" id="alarmBtn" style="flex:1">Báo động</button></div>
      <div class="seg" id="panSeg"></div>
      <div id="panBody"></div>
    </section>
  </div>`;
  mini = new ChartCanvas($('#mini')); radar = new Radar($('#radar'));
  $('#mzIn').onclick = () => { mapScale = Math.max(0.5, mapScale / 1.6); }; $('#mzOut').onclick = () => { mapScale = Math.min(60, mapScale * 1.6); };
  $('#rzIn').onclick = () => radar.setRange(radar.ri + 1); $('#rzOut').onclick = () => radar.setRange(radar.ri - 1);
  buildHelm();
  $('#helmBtns').onclick = (e) => { const b = e.target.closest('button'); if (b) Orders.rudder(+b.dataset.a); };
  $('#steadyBtn').onclick = () => Orders.steady();
  $('#courseBtn').onclick = () => Orders.course($('#courseIn').value);
  $('#courseIn').onkeydown = (e) => { if (e.key === 'Enter') Orders.course(e.target.value); };
  const hold = (id, down, up) => { const el = $(id); let t0 = 0; el.onpointerdown = (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); t0 = performance.now(); el.classList.add('pri'); down(); }; const end = () => { if (!t0) return; const d = (performance.now() - t0) / 1000; t0 = 0; el.classList.remove('pri'); up(d); }; el.onpointerup = end; el.onpointercancel = end; el.onlostpointercapture = end; };
  hold('#hornBtn', () => A.snd.horn(true), (d) => { A.snd.horn(false); logOrder('Còi: 1 tiếng ' + (d >= 2.5 ? 'dài' : 'ngắn') + ' (' + d.toFixed(1) + ' giây)', 'signal'); });
  hold('#bellBtn', () => A.snd.bellHold(true), (d) => { A.snd.bellHold(false); logOrder('Rung chuông ' + (d < 0.4 ? '1 tiếng' : d.toFixed(1) + ' giây'), 'signal'); });
  // hải đồ: kéo để xem quanh, bấm để chọn điểm đo, chuột phải để bỏ điểm
  const mc = $('#mini'); let md = null, mv = false;
  mc.onpointerdown = (e) => { if (e.button !== 0) return; md = [e.clientX, e.clientY]; mv = false; mc.setPointerCapture(e.pointerId); };
  mc.onpointermove = (e) => { if (!md) return; if (!mv && Math.hypot(e.clientX - md[0], e.clientY - md[1]) < 5) return; if (!mv) { mv = true; mc.style.cursor = 'grabbing'; } const r = mc.getBoundingClientRect(), k = mc.width / r.width * mapScale, dx = (e.clientX - md[0]) * k, dy = (e.clientY - md[1]) * k, c = Math.cos(mini.rot), sn = Math.sin(mini.rot); mapOff.x -= dx * c + dy * sn; mapOff.y += -dx * sn + dy * c; md = [e.clientX, e.clientY]; };
  mc.onpointerup = (e) => { if (md && !mv) { const p = cpos(mc, e), [x, y] = mini.s2m(p[0], p[1]); A.sim.mark = { x, y }; } md = null; mc.style.cursor = 'crosshair'; };
  mc.oncontextmenu = (e) => { e.preventDefault(); A.sim.mark = null; };
  mc.onwheel = (e) => { e.preventDefault(); mapScale = Math.max(0.5, Math.min(60, mapScale * (e.deltaY > 0 ? 1.25 : 0.8))); };
  $('#mapHome').onclick = () => { mapOff.x = 0; mapOff.y = 0; };
  // radar: bấm đặt EBL/VRM, chuột phải bỏ, lăn chuột đổi cự ly
  const rc = $('#radar');
  rc.onpointerdown = (e) => { if (e.button !== 0) return; const p = cpos(rc, e); A.sim.mark = radar.pick(p[0], p[1], A.sim.S); };
  rc.oncontextmenu = (e) => { e.preventDefault(); A.sim.mark = null; };
  rc.onwheel = (e) => { e.preventDefault(); radar.setRange(radar.ri + (e.deltaY > 0 ? 1 : -1)); };
  $('#routeSel').onchange = (e) => { A.W.objs.routeSel = +e.target.value; saveObjs(); for (const k in routeSt) delete routeSt[k]; };
  $('#alarmBtn').onclick = () => { const s = A.sim; s.alarm = !s.alarm; A.snd.alarm(s.alarm); logOrder(s.alarm ? 'Phát báo động chung' : 'Tắt báo động chung', 'signal'); };
  $('#telLink').onclick = () => { telLink = !telLink; $('#telLink').classList.toggle('on', telLink); };
  $('#panBody').addEventListener('click', panelClick);
  initTel();
  initSegs(); rebuildRun();
}
function initSegs() {
  const s = A.sim;
  seg($('#viewSeg'), VIEWS, runState.view, (v) => { runState.view = v; if (A.view) Object.assign(A.view.look, { yaw: 0, pitch: 0, fov: 55, dist: 1 }); initSegs(); });
  seg($('#oriSeg'), [['0', 'Bắc trên'], ['1', 'Mũi trên']], A.set.headUp ? '1' : '0', (v) => { A.set.headUp = v === '1'; saveSet(); initSegs(); });
  seg($('#rMode'), [['H', 'Mũi trên'], ['N', 'Bắc trên']], radar.mode, (v) => { radar.mode = v; initSegs(); });
  seg($('#steerSeg'), [['hand', 'Lái tay'], ['auto', 'Tự động']], s.helm.steer, (v) => { Orders.steer(v); initSegs(); });
  seg($('#panSeg'), [['neo', 'Neo'], ['day', 'Dây buộc'], ['den', 'Đèn'], ['tin', 'Tín hiệu'], ['log', 'Nhật ký']], panel, (v) => { panel = v; built = ''; initSegs(); });
}
// ---- tay chuông máy kiểu cần gạt: kéo cần, thả ra sẽ khớp vào nấc gần nhất ----
function initTel() {
  const box = $('#tels');
  const pick = (e) => { const t = box.querySelector('.trk').getBoundingClientRect(); return Math.max(0, Math.min(6, (e.clientY - t.top) / t.height * 6)); };
  box.onpointerdown = (e) => {
    const lb = e.target.closest('[data-n]'); const col = e.target.closest('.tcol');
    if (lb && !col) { setSteps(STEP_ORDER[+lb.dataset.n], null); return; }
    if (!col) return; e.preventDefault(); box.setPointerCapture(e.pointerId);
    const i = +col.dataset.e; telDrag.i = i; telDrag.p = pick(e);
  };
  box.onpointermove = (e) => { if (telDrag.i === undefined) return; telDrag.p = pick(e); A.sim.steps.forEach((_, j) => { if (j === telDrag.i || (telLink && A.M.nE > 1)) { const h = $('#hdl' + j); if (h) { h.style.transition = 'none'; h.style.top = (telDrag.p / 6 * 100).toFixed(2) + '%'; } } }); };
  const up = () => { if (telDrag.i === undefined) return; $$('#tels .hdl').forEach((h) => { h.style.transition = ''; }); const i = telDrag.i, id = STEP_ORDER[Math.round(telDrag.p)]; delete telDrag.i; setSteps(id, i); };
  box.onpointerup = up; box.onpointercancel = up;
}
function setSteps(id, i) {
  const s = A.sim, M = A.M, all = i === null || (telLink && M.nE > 1);
  if (!all) { if (s.steps[i] !== id) Orders.engine(i, id); return; }
  if (s.steps.every((q) => q === id)) return;
  if (M.nE === 1) { Orders.engine(0, id); return; }
  s.steps = s.steps.map(() => id); const lb = stepLabel(A.p, id);
  logOrder((M.nE === 2 ? 'Hai máy ' : 'Các máy ') + (id === 'st' ? 'dừng' : lb.toLowerCase()), 'engine');
}
// phím tắt tab 3: ←/→ đánh lái trái / phải từng nấc (lái tự động: đổi hướng đặt 1°), ↑/↓ tăng / giảm một nấc máy
export function runKey(k) {
  const s = A.sim; if (!s) return false;
  if (k === 'ArrowLeft' || k === 'ArrowRight') {
    const h = s.helm, dir = k === 'ArrowLeft' ? -1 : 1;
    if (h.steer === 'auto') { const base = h.target !== null ? h.target : Math.round(s.S.psi / D2R); Orders.course(((base + dir) % 360 + 360) % 360); $('#courseIn').value = Math.round(((base + dir) % 360 + 360) % 360); return true; }
    const H = helmSteps(), z = H.findIndex((q) => q[0] === 0); let i = z;
    if (h.mode === 'rudder') { let bd = 1e9; H.forEach((q, j) => { const d = Math.abs(q[0] - h.ord); if (d < bd) { bd = d; i = j; } }); i += dir; } else i = z + dir;
    i = Math.max(0, Math.min(H.length - 1, i)); if (!(h.mode === 'rudder' && H[i][0] === h.ord)) Orders.rudder(H[i][0]); return true;
  }
  if (k === 'ArrowUp' || k === 'ArrowDown') {
    const dir = k === 'ArrowUp' ? 1 : -1, next = s.steps.map((id) => STEP_ORDER[Math.max(0, Math.min(6, STEP_ORDER.indexOf(id) - dir))]);
    if (next.every((q, i) => q === s.steps[i])) return true;
    if (next.every((q) => q === next[0])) setSteps(next[0], null); else next.forEach((id, i) => { if (id !== s.steps[i]) Orders.engine(i, id); });
    return true;
  }
  return false;
}
// dựng lại các phần phụ thuộc cấu hình tàu / bài tập
// nút lệnh lái: 5 · 10 · 15 · hết lái, theo góc lái tối đa của tàu
function buildHelm() {
  const H = helmSteps(), el = $('#helmBtns'); if (!el) return;
  el.style.gridTemplateColumns = 'repeat(' + H.length + ',minmax(0,1fr))';
  el.innerHTML = H.map((h) => `<button class="${h[0] < 0 ? 'p' : h[0] > 0 ? 's' : 'z'}" data-a="${h[0]}" aria-label="${h[2]}"><small>${h[1]}</small><span>${String(Math.abs(h[0])).replace('.', ',')}</span></button>`).join('');
}
export function rebuildRun() {
  const M = A.M, s = A.sim; if (!$('#tels')) return; buildHelm();
  $('#telCard').style.width = [0, 196, 236, 286, 336][M.nE] + 'px';
  $('#telLink').style.display = M.nE > 1 ? '' : 'none'; $('#telLink').classList.toggle('on', telLink);
  const lab = STEP_ORDER.map((id, n) => `<button class="tl" data-n="${n}" style="top:${(n / 6 * 100).toFixed(3)}%" id="tl${n}">${stepLabel(A.p, id).replace('Dừng máy', 'Dừng')}</button>`).join('');
  const ticks = STEP_ORDER.map((id, n) => `<i class="tk${id === 'st' ? ' z' : ''}" style="top:${(n / 6 * 100).toFixed(3)}%"></i>`).join('');
  $('#tels').innerHTML = `<div class="tlab">${lab}</div>` + s.steps.map((_, i) => `<div class="tcol" data-e="${i}"><div class="trk"><div class="slot"></div>${ticks}<div class="hdl" id="hdl${i}"><span></span></div></div><div class="tname">${M.nE > 1 ? engName(M.nE, i).replace('Máy ', '').toUpperCase() : 'MÁY'}<br><b class="mono" id="eRpm${i}"></b></div></div>`).join('');
  $('#iDraft').textContent = M.d.toFixed(1);
  $('#courseIn').value = Math.round(s.S.psi / D2R) % 360;
  for (const k in routeSt) delete routeSt[k];
  built = ''; lastLog = -1; initSegs(); fillRoutes();
}
export function fillRoutes() {
  const o = A.W.objs, el = $('#routeSel'); if (!el) return; const rs = o.routes || [];
  if (o.routeSel === undefined || o.routeSel >= rs.length) o.routeSel = rs.length ? 0 : -1;
  el.innerHTML = `<option value="-1">Không hiện</option>` + rs.map((r, i) => `<option value="${i}" ${i === o.routeSel ? 'selected' : ''}>${esc(r.name)} (${r.pts.length} điểm)</option>`).join('');
  el.value = String(o.routeSel);
}
function panelClick(e) {
  const b = e.target.closest('[data-act]'); if (!b) return; const s = A.sim, act = b.dataset.act;
  if (act === 'resetLines') { s.lines = makeLines(A.M); s.selLine = 'hl'; built = ''; return; }
  if (act === 'anchor') Orders.anchor(b.dataset.id, b.dataset.do);
  else if (act === 'selLine') { s.selLine = b.dataset.id; built = ''; }
  else if (act === 'line') {
    const l = s.lines.find((q) => q.id === s.selLine); if (!l) return; const d = b.dataset.do, who = (l.end === 'b' ? 'Mũi: ' : 'Lái: ');
    if (d === 'xoa') { s.lines.splice(s.lines.indexOf(l), 1); s.selLine = s.lines.length ? s.lines[0].id : ''; logOrder('Bỏ ' + l.name.toLowerCase(), 'line'); built = ''; return; }
    if (d === 'dua') { if (l.st !== 'chua') return; const err = sendLine(A.W, s.S, A.M, l); if (err) { logOrder(who + 'đưa ' + l.name.toLowerCase() + ' — ' + err, 'note'); flash(err); } else logOrder(who + 'đưa ' + l.name.toLowerCase() + ' lên bích ' + l.bn, 'line'); }
    else if (l.st !== 'chua') { if (d === 'tha') { l.st = 'chua'; l.ten = 0; } else l.st = d; logOrder(who + { thu: 'thu', giu: 'giữ', noi: 'nới', tha: 'thả' }[d] + ' ' + l.name.toLowerCase(), 'line'); }
    built = '';
  } else if (act === 'addLine') {
    const l = s.lines.find((q) => q.id === s.selLine) || s.lines[0], base = l.base || l.id, same = s.lines.filter((q) => (q.base || q.id) === base).length, b0 = s.lines.find((q) => q.id === base);
    const nl = Object.assign({}, b0, { id: 'x' + s.lines.length, base, name: b0.name + ' ' + (same + 1), st: 'chua', len: 0, ten: 0, fx: b0.fx - Math.sign(b0.fx) * 2.5 * same });
    s.lines.push(nl); s.selLine = nl.id; logOrder('Thêm ' + nl.name.toLowerCase(), 'line'); built = '';
  } else if (act === 'sig') { const g = SIGNALS[+b.dataset.id]; A.snd.hornSeq(g[0]); logOrder('Còi: ' + g[1] + ' — ' + g[2], 'signal'); }
  else if (act === 'fogAuto') { s.fogAuto = !s.fogAuto; fogNext = 0; built = ''; logOrder((s.fogAuto ? 'Bật' : 'Tắt') + ' tự phát tín hiệu sương mù', 'signal'); }
  else if (act === 'light') Orders.light(b.dataset.id, !s.lights[b.dataset.id]), built = '';
  else if (act === 'preset') Orders.lightPreset(+b.dataset.id), built = '';
}
let flashT = 0, flashMsg = '';
function flash(m) { flashMsg = m; flashT = performance.now() + 5000; }
const SIGNALS = [['S', '1 ngắn', 'Tôi đổi hướng sang phải'], ['SS', '2 ngắn', 'Tôi đổi hướng sang trái'], ['SSS', '3 ngắn', 'Máy tôi đang chạy lùi'], ['SSSSS', '5 ngắn', 'Nghi ngờ ý định của anh / cảnh báo'], ['L', '1 dài', 'Sắp đến khúc ngoặt khuất tầm nhìn · sương mù: tàu đang chạy (2 phút/lần)'], ['LL', '2 dài', 'Sương mù: tàu đã dừng máy, hết trớn (2 phút/lần)'], ['LSS', '1 dài 2 ngắn', 'Sương mù: mất chủ động, hạn chế điều động, đang lai kéo'], ['LLS', '2 dài 1 ngắn', 'Luồng hẹp: tôi định vượt bên mạn phải anh'], ['LLSS', '2 dài 2 ngắn', 'Luồng hẹp: tôi định vượt bên mạn trái anh'], ['LSLS', '1 dài 1 ngắn 1 dài 1 ngắn', 'Đồng ý cho vượt']];
const LST = { chua: 'Chưa đưa', dua: 'Đã lên bích', thu: 'Đang thu', giu: 'Đang giữ', noi: 'Đang nới' };
function drawPanel() {
  const s = A.sim, el = $('#panBody'), M = A.M;
  if (panel === 'neo') {
    const key = 'neo' + s.anchors.map((a) => a.id).join();
    if (built !== key) {
      built = key;
      el.innerHTML = `<div class="muted" style="margin-bottom:6px">Độ sâu nước <b id="aH" class="mono" style="color:#E6EDF2"></b> · kéo lê: xích ≈ 1,5× độ sâu · đứng neo: xích ≥ 3× độ sâu</div>` + s.anchors.map((a) => `<div class="rowi"><div class="flex" style="gap:6px;align-items:center;flex-wrap:nowrap"><b style="white-space:nowrap">${a.name}</b><div class="seg" id="aLv${a.id}" title="Tốc độ tời khi thả, thả kéo lê và kéo neo" style="flex:0 0 auto">${[1, 2].map((k) => `<button data-act="anchor" data-id="${a.id}" data-do="lv${k}" style="padding:0 6px">Cấp ${k}</button>`).join('')}</div><span class="pill" id="aS${a.id}" style="margin-left:auto;min-width:0;overflow:hidden;text-overflow:ellipsis;padding:1px 6px"></span></div><div style="display:flex;align-items:center;gap:8px;margin:4px 0"><span class="mono" style="font-size:15px;font-weight:600;white-space:nowrap"><span id="aC${a.id}">0</span> <span class="muted">/ ${num(A.p.chainLen, 0)} m xích</span></span><div class="bar" style="flex:1"><i id="aB${a.id}"></i></div><span class="muted" id="aR${a.id}" style="white-space:nowrap"></span></div><div class="grid" style="grid-template-columns:1fr 1.15fr 1.3fr .75fr 1fr;gap:4px">${[['drop', 'Thả neo', 'Thả bằng tời theo cấp đang chọn'], ['free', 'Thả tự do', 'Nhả phanh cho neo rơi tự do; neo chạm đáy thì xích chạy chậm lại — bấm Hãm để dừng'], ['dredge', 'Thả kéo lê', 'Thả đến khoảng 1,5× độ sâu rồi tự hãm'], ['brake', 'Hãm', 'Hãm phanh tời giữ xích'], ['heave', 'Kéo neo', 'Kéo bằng tời theo cấp đang chọn']].map((d) => `<button class="btn sm" data-act="anchor" data-id="${a.id}" data-do="${d[0]}" title="${d[2]}" style="padding:0 2px;white-space:nowrap;font-size:11.5px;min-height:28px">${d[1]}</button>`).join('')}</div></div>`).join('') + '<div id="aWarn" class="note bad" style="display:none;margin-top:6px;font-weight:700"></div>';
    }
    $('#aH').textContent = Math.max(0, s.h).toFixed(1) + ' m'; let warn = '';
    for (const a of s.anchors) {
      const hv = Math.max(1, s.h + 3), sc = a.chain / hv; let st = 'Trong lỗ neo', c = '#B8C7D1';
      // chữ ngắn để vừa một dòng cạnh nút cấp; rê chuột lên để xem đủ
      let full = st;
      if (a.st === 'drop') { const bot = a.ax !== null && !a.target; st = a.target ? 'Thả kéo lê' : a.free ? (bot ? 'Tự do · chạm đáy' : 'Thả tự do') : (bot ? 'Thả · chạm đáy' : 'Đang thả'); full = (a.target ? 'Đang thả để kéo lê' : a.free ? 'Thả tự do' : 'Đang thả bằng tời') + (bot ? ' · neo đã chạm đáy, xích còn chạy' : ''); c = '#FFB547'; }
      else if (a.st === 'heave') { st = a.ax === null ? 'Kéo · rời đáy' : 'Đang kéo'; full = a.ax === null ? 'Đang kéo · neo đã rời đáy' : 'Đang kéo neo'; c = '#FFB547'; }
      else if (a.st === 'hold') { if (a.ax === null) { st = 'Hãm · chưa chạm đáy'; c = '#FFB547'; } else if (sc < 2.5) { st = a.drag ? 'Kéo lê · cày đáy' : 'Neo kéo lê'; c = '#7FD4FF'; } else if (a.drag) { st = 'NEO TRÔI'; c = '#FF8A8A'; warn = a.name; } else { st = 'Neo đã ăn'; c = '#86E0A8'; } full = st === 'Neo đã ăn' ? 'Đứng neo · neo đã ăn' : st === 'Kéo lê · cày đáy' ? 'Neo kéo lê (đang cày đáy)' : st; }
      const e1 = $('#aS' + a.id); e1.textContent = st; e1.title = full; e1.style.color = c; e1.style.borderColor = c;
      $$('#aLv' + a.id + ' button').forEach((b) => b.classList.toggle('on', b.dataset.do === 'lv' + (a.lv || 1)));
      $('#aC' + a.id).textContent = a.chain.toFixed(0); $('#aB' + a.id).style.width = Math.min(100, a.chain / num(A.p.chainLen, 275) * 100) + '%';
      $('#aR' + a.id).textContent = '= ' + sc.toFixed(1) + '× độ sâu · căng ' + (a.ten / 9810).toFixed(0) + ' t';
    }
    const w = $('#aWarn'); w.style.display = warn ? 'block' : 'none'; if (warn) w.textContent = 'CẢNH BÁO NEO TRÔI — ' + warn + ' không giữ được tàu';
  } else if (panel === 'day') {
    const key = 'day' + s.selLine + s.lines.map((l) => l.id + l.st).join();
    if (built !== key || !s.lines.length) {
      built = key; const sl = s.lines.find((l) => l.id === s.selLine) || s.lines[0];
      if (!sl) { el.innerHTML = '<div class="muted">Không còn dây nào.</div><button class="btn sm" data-act="resetLines" style="margin-top:8px">Lấy lại 6 dây mặc định</button>'; return; }
      el.innerHTML = `<div class="flex" style="justify-content:space-between;gap:4px 12px;margin-bottom:6px" class="muted"><span class="muted">Cách cầu: mũi <b id="lB" class="mono" style="color:#E6EDF2"></b> · lái <b id="lS" class="mono" style="color:#E6EDF2"></b></span><span class="muted">Áp cầu: mũi <b id="lvB" class="mono" style="color:#E6EDF2"></b> · lái <b id="lvS" class="mono" style="color:#E6EDF2"></b> cm/s</span></div>
      <div class="grid g2" style="gap:5px">${s.lines.map((l) => `<button class="rowi ${l.id === s.selLine ? 'sel' : ''}" data-act="selLine" data-id="${l.id}" style="margin:0;text-align:left;color:inherit"><span class="flex" style="justify-content:space-between;gap:4px"><b style="font-size:12px">${esc(l.name)}</b><span class="muted" style="${l.st === 'thu' || l.st === 'noi' ? 'color:#FFB547' : ''}">${LST[l.st]}${l.st !== 'chua' ? ' · bích ' + l.bn : ''}</span></span><span class="bar" style="display:block;margin-top:5px"><i id="lT${l.id}"></i></span></button>`).join('')}</div>
      <div class="flex" style="gap:5px;align-items:center;margin-top:8px"><span class="muted" style="flex:1 1 120px">Lệnh cho <b style="color:#E6EDF2">${esc(sl.name)}</b>: <span id="lInfo" class="mono"></span></span>${[['dua', 'Đưa dây'], ['thu', 'Thu'], ['giu', 'Giữ'], ['noi', 'Nới'], ['tha', 'Thả']].map((d) => `<button class="btn sm" data-act="line" data-do="${d[0]}" ${(d[0] === 'dua') === (sl.st === 'chua') ? '' : 'disabled'}>${d[1]}</button>`).join('')}</div>
      <div class="flex" style="justify-content:space-between;align-items:center;margin-top:8px"><span class="muted">${A.W.bollards.length ? A.W.bollards.length + ' bích buộc dây (cầu bến và tàu đậu vẽ ở tab 2)' : 'Chưa có cầu bến — vẽ ở tab 2 (công cụ Cầu bến)'}</span><span><button class="btn sm" data-act="addLine">+ Thêm dây</button> <button class="btn sm warn" data-act="line" data-do="xoa">Xóa dây</button></span></div>`;
    }
    const i = s.info, f = (v) => !isFinite(v) || v > 9e8 ? '—' : Math.max(0, v).toFixed(1) + ' m';
    $('#lB').textContent = f(i.dBow); $('#lS').textContent = f(i.dStern); $('#lvB').textContent = !isFinite(i.dBow) || i.dBow > 9e8 ? '—' : (i.vBow * 100).toFixed(0); $('#lvS').textContent = !isFinite(i.dStern) || i.dStern > 9e8 ? '—' : (i.vStern * 100).toFixed(0);
    for (const l of s.lines) { const b = $('#lT' + l.id); if (b) { const p = l.pct || 0; b.style.width = Math.min(100, p) + '%'; b.style.background = p > 80 ? '#FF6B6B' : p > 60 ? '#FFB547' : '#5CD6FF'; } }
    const sl = s.lines.find((l) => l.id === s.selLine); if (sl && sl.st !== 'chua') $('#lInfo').textContent = 'dài ' + sl.len.toFixed(0) + ' m · căng ' + (sl.ten / 9810).toFixed(1) + ' t (' + (sl.pct || 0).toFixed(0) + '%)';
  } else if (panel === 'den') {
    const key = 'den' + JSON.stringify(s.lights);
    if (built !== key) {
      built = key;
      el.innerHTML = `<div class="flex" style="gap:6px;align-items:center;margin-bottom:8px"><span class="muted">Bật nhanh:</span>${LIGHT_PRESETS.map((p, i) => `<button class="btn sm ${LIGHTS.every((l) => !!s.lights[l[0]] === p[1].includes(l[0])) ? 'on' : ''}" data-act="preset" data-id="${i}">${p[0]}</button>`).join('')}</div><div class="grid g2" style="gap:5px">${LIGHTS.map((l) => `<button class="btn sm" data-act="light" data-id="${l[0]}" style="display:flex;align-items:center;gap:7px;justify-content:flex-start;${s.lights[l[0]] ? 'background:#16222A;border-color:#3A5566' : ''}"><span style="width:10px;height:10px;border-radius:9px;background:${s.lights[l[0]] ? l[2] : '#2A3640'}"></span><span style="flex:1;text-align:left">${l[1]}</span><span style="color:${s.lights[l[0]] ? '#86E0A8' : '#8FA3B0'}">${s.lights[l[0]] ? 'Bật' : 'Tắt'}</span></button>`).join('')}</div><div class="muted" style="margin-top:8px">Đèn chỉ thấy trong khung 3D khi trời tối (muốn xem thử ban ngày thì ở tab 4, thẻ Thời tiết chọn ánh sáng «Đêm» hoặc «Hoàng hôn»; góc «Bám theo tàu» thấy đủ các đèn).</div>`;
    }
  } else if (panel === 'tin') {
    const key = 'tin' + !!s.fogAuto;
    if (built !== key) {
      built = key;
      el.innerHTML = `<div class="muted" style="margin-bottom:6px">Tín hiệu còi theo COLREG 1972 (Điều 34, 35). Tiếng ngắn ≈ 1 giây, tiếng dài 4–6 giây. Nút «Còi» phía trên để tự kéo tay.</div><div class="sig">${SIGNALS.map((g, i) => `<button data-act="sig" data-id="${i}"><b>${g[1]}</b><span>${g[2]}</span></button>`).join('')}</div>
      <button class="btn sm ${s.fogAuto ? 'on' : ''}" data-act="fogAuto" style="width:100%;margin-top:4px">Tự phát tín hiệu sương mù: ${s.fogAuto ? 'ĐANG BẬT' : 'tắt'}</button><div class="muted" style="margin-top:4px">Khi bật: đang chạy → 1 dài mỗi 2 phút; dừng máy hết trớn → 2 dài mỗi 2 phút; đang neo → rung chuông 5 giây mỗi phút.</div>`;
    }
  } else if (lastLog !== s.log.length || built !== 'log') {
    built = 'log'; lastLog = s.log.length;
    el.innerHTML = `<ol class="log">${s.log.slice(0, 80).map((l) => `<li><span class="mono muted">${clock(s.day0 + l.t)}</span><span${l.kind === 'alarm' ? ' style="color:#FF8A8A;font-weight:700"' : ''}>${esc(l.text)}</span></li>`).join('')}</ol>`;
  }
}

export function uiTick() {
  const s = A.sim, S = s.S, M = A.M, d = derived(), e = s.e;
  const set = (id, v) => { const el = $('#' + id); if (el && el.textContent !== v) el.textContent = v; };
  const hd = ((d.hdg % 360) + 360) % 360, hdT = (hd >= 359.95 ? 0 : hd).toFixed(1).padStart(5, '0') + '°';
  set('hdgBig', hdT); set('iHdg', hdT); set('iCog', d.sog > 0.2 ? d.cog.toFixed(1).padStart(5, '0') + '°' : '—'); set('iDrift', (d.drift >= 0 ? '+' : '−') + Math.abs(d.drift).toFixed(1) + '°');
  set('iTgt', s.helm.mode !== 'rudder' && s.helm.target !== null ? pad3(s.helm.target) + '°' : '—');
  set('iOrd', rT(s.helm.ord)); set('iAct', rT(S.delta)); set('whOrd', rT(s.helm.ord)); set('whAct', rT(S.delta));
  const rot = d.rot; set('oRot', (rot >= 0 ? '+' : '−') + Math.abs(rot).toFixed(1) + '°/ph');
  const rb = $('#rotBar'), rk = Math.max(-1, Math.min(1, rot / 30)); rb.style.left = (rk < 0 ? 50 + rk * 50 : 50) + '%'; rb.style.width = Math.abs(rk) * 50 + '%'; rb.style.background = rk < 0 ? '#FF6B6B' : '#4ADE80';
  const lat = (v) => Math.abs(v).toFixed(1) + (Math.abs(v) < 0.05 ? '' : v > 0 ? ' phải' : ' trái');
  set('iSog', d.sog.toFixed(1)); set('iStw', (d.stw < 0 ? 'lùi ' : '') + Math.abs(d.stw).toFixed(1)); set('iBow', lat(d.bowLat)); set('iStern', lat(d.sternLat));
  const sl = s.steps.map((id) => stepLabel(A.p, id)), short = (t) => t.replace('Tiến ', 'T').replace('Lùi ', 'L').replace('Dừng máy', 'Dừng');
  set('iStep', M.nE === 1 ? sl[0] : sl.map(short).join(' · '));
  set('iRpm', S.n.map((n) => Math.round(displayRpm(M, n))).join('/')); set('iRpmO', s.steps.map((id) => Math.round(M.steps[id].rpm)).join('/') + ' v/ph');
  S.n.forEach((n, i) => set('eRpm' + i, Math.round(displayRpm(M, n)) + ' v/ph'));
  // tay chuông
  s.steps.forEach((id, i) => { const h = $('#hdl' + i); if (!h) return; const p = telDrag.i !== undefined && (telDrag.i === i || (telLink && M.nE > 1)) ? telDrag.p : STEP_ORDER.indexOf(id); h.style.top = (p / 6 * 100).toFixed(2) + '%'; });
  STEP_ORDER.forEach((id, n) => { const b = $('#tl' + n); if (b) b.classList.toggle('on', s.steps.includes(id)); });
  // vô lăng theo tay người lái (góc lái lệnh), đồng hồ góc lái theo bánh lái thực
  const wg = $('#wheelG'); if (wg) wg.setAttribute('transform', 'rotate(' + (s.helm.ord * 4.5).toFixed(1) + ')');
  drawRudder(S.delta, s.helm.ord, M.rudMax > 0 ? M.rudMax : 35);
  $$('#helmBtns button').forEach((b) => { b.classList.toggle('on', s.helm.mode === 'rudder' && s.helm.ord === +b.dataset.a && s.helm.steer === 'hand'); b.disabled = s.helm.steer === 'auto'; });
  $('#steadyBtn').classList.toggle('pri', s.helm.mode === 'steady');
  set('courseLbl', s.helm.steer === 'auto' ? 'Hướng tự động' : 'Đi hướng'); set('hRep', '«' + s.helm.rep + '»');
  set('hMode', s.helm.mode === 'rudder' ? 'theo góc lái' : s.helm.mode === 'auto' ? 'tự động ' + pad3(s.helm.target) + '°' : 'giữ ' + pad3(s.helm.target) + '°');
  // độ sâu dưới ky
  const u = s.ukc, uc = u < 0.5 ? '#FF6B6B' : u < 1 ? '#FFB547' : '#4ADE80', ue = $('#iUkc'); ue.textContent = u.toFixed(1); ue.style.color = uc;
  const us = $('#iUkcS'); us.textContent = s.aground ? 'MẮC CẠN' : u < 0.5 ? 'Nguy hiểm' : u < 1 ? 'Chú ý' : 'An toàn'; us.style.color = uc; us.style.borderColor = uc;
  set('iHc', s.hC.toFixed(1)); set('iTide', e.tide.toFixed(1)); set('iSq', s.sq.toFixed(2));
  // môi trường
  const arrow = (deg) => `<svg width="12" height="12" viewBox="0 0 20 20" aria-hidden="true" style="vertical-align:-1px"><g transform="rotate(${deg.toFixed(0)} 10 10)"><path d="M10 2L10 18M10 2L5 8M10 2L15 8" stroke="#5CD6FF" stroke-width="2.4" fill="none" stroke-linecap="round"/></g></svg>`;
  const box = (t, v, sub) => `<div><div class="lb">${t}</div><div class="mono" style="font-size:13px;font-weight:600">${v}</div><div class="muted" style="font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sub}</div></div>`;
  const envH = box('GIÓ THẬT', arrow(e.wDir + 180) + ' ' + pad3(e.wDir) + '°', e.wKn.toFixed(0) + ' hl/h · thổi từ') + box('DÒNG CHẢY', arrow(e.cDir) + ' ' + pad3(e.cDir) + '°', e.cKn.toFixed(1) + ' hl/h · chảy về') + box('THỦY TRIỀU', '+' + e.tide.toFixed(1) + ' m', e.rising ? 'Đang lên' : 'Đang xuống') + box('SÓNG', e.waveH.toFixed(1).replace('.', ',') + ' m', 'từ ' + pad3(Math.round(e.waveD / D2R) % 360) + '° · ' + Math.round(e.waveL) + ' m') + box('TẦM NHÌN', (e.vis / 1852).toFixed(1).replace('.', ',') + ' Hl', A.env.fogOn ? 'sương mù dày (tab 4)' : e.wx ? (e.wx.from ? e.wx.from + ' → ' : '') + e.wx.name : 'theo kịch bản') + box('GIỜ', clock(s.day0 + s.t).slice(0, 5), s.running ? 'đang chạy ×' + s.speed : 'TẠM DỪNG');
  const eb = $('#envBox'); if (eb._h !== envH) { eb._h = envH; eb.innerHTML = envH; }
  // banner
  const bn = $('#banner'); let bt = '', cls = 'bad';
  if (s.aground) bt = 'TÀU MẮC CẠN — độ sâu không đủ. Lùi máy ra hoặc bắt đầu lại bài tập ở tab 4.';
  else if (s.info.hitShip && s.info.hit > 0.08) bt = 'VA CHẠM TÀU ĐẬU';
  else if (s.info.hit > 0.25) bt = 'VA CẦU MẠNH — tốc độ áp cầu ' + (s.info.hit * 100).toFixed(0) + ' cm/s';
  else if (performance.now() < flashT) { bt = flashMsg; cls = ''; }
  else if (!s.running) { bt = 'ĐANG TẠM DỪNG — bấm ▶ ở góc trên để chạy'; cls = ''; }
  bn.style.display = bt ? 'block' : 'none'; bn.className = 'note ' + cls; bn.textContent = bt;
  $('#band').classList.toggle('br', runState.view === 'bridge');
  fogSignals(s, d);
  $('#alarmBtn').classList.toggle('on', s.alarm); set('alarmBtn', s.alarm ? 'Tắt báo động' : 'Báo động');
  // tuyến đi
  const r = curRoute(); let ri = '';
  if (r) { const t = trackRoute(r, routeSt, S.x, S.y, M.L); if (t) { s.route = t; const eta = d.sog > 0.5 ? clock(s.day0 + s.t + t.dtg / (d.sog * KN)).slice(0, 5) : '—'; ri = `Tới điểm ${t.wp + 1}/${t.n} · hướng tới điểm ${pad3(t.cts)}° · còn ${fmtDist(t.dtg)}<br>Lệch tuyến ${fmtDist(Math.abs(t.xte))}${Math.abs(t.xte) < 1 ? '' : t.xte > 0 ? ' phải' : ' trái'} · chặng ${pad3(t.legCrs)}° · tới lúc ${eta}`; } }
  else s.route = null;
  const rie = $('#routeInfo'), riH = ri || '<span class="muted">' + (A.W.objs.routes && A.W.objs.routes.length ? 'Chọn tuyến ở ô dưới hải đồ' : 'Chưa có tuyến — lập tuyến ở tab 2 (công cụ «Tuyến đi»)') + '</span>'; if (rie._h !== riH) { rie._h = riH; rie.innerHTML = riH; }
  set('routeName', r ? '· ' + r.name : '');
  // điểm đo
  const mk = s.mark; let mt = '', rf = '';
  if (mk) { const dd = Math.hypot(mk.x - S.x, mk.y - S.y), bb = brgDeg(mk.x - S.x, mk.y - S.y), tt = d.sog > 0.3 ? dd / (d.sog * KN) : 0; mt = 'Điểm chọn: ' + fmtDist(dd) + ' · ' + pad3(bb) + '°' + (tt ? ' · ' + Math.floor(tt / 60) + "' " + String(Math.round(tt % 60)).padStart(2, '0') + '"' : ''); rf = 'EBL ' + bb.toFixed(1).padStart(5, '0') + '° · VRM ' + fmtDist(dd); }
  set('markInfo', mt); set('rFoot', rf || 'Bấm lên radar để đo phương vị / khoảng cách · chuột phải để bỏ');
  set('rRange', String(radar.range).replace('.', ',') + ' Hl');
  const night = sunEl(s.day0 + s.t, A.env.light) < 4; $('#band').classList.toggle('night', night);
  drawTape(hd, s.helm.mode !== 'rudder' ? s.helm.target : null, night); drawMini(d, night); drawPanel();
}
// vẽ radar mỗi khung hình
export function consoleFrame(dtReal) {
  if (!radar || !A.sim) return; const s = A.sim;
  radar.step(dtReal, A.W, s.S, s.e ? s.e.waveH : 0, s.e ? s.e.rain : 0);
  radar.mark = s.mark ? Object.assign(radar.mark || {}, s.mark) : null;
  radar.draw(s.S);
}
function drawRudder(act, ord, mx) {
  const c = $('#rudCv'); if (!c) return; const w = c.clientWidth | 0, h = c.clientHeight | 0; if (!w || !h) return; if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const g = c.getContext('2d'), cx = w / 2, cy = h - 6, R = Math.min(w / 2 - 14, h - 14), A0 = 70 * Math.PI / 180, ang = (v) => Math.max(-1, Math.min(1, v / mx)) * A0;
  g.clearRect(0, 0, w, h); g.lineWidth = 7; g.lineCap = 'butt';
  g.strokeStyle = '#5A2A2E'; g.beginPath(); g.arc(cx, cy, R, -Math.PI / 2 - A0, -Math.PI / 2); g.stroke();
  g.strokeStyle = '#24553A'; g.beginPath(); g.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + A0); g.stroke();
  g.lineWidth = 1; g.strokeStyle = '#B8C7D1'; g.fillStyle = '#8FA3B0'; g.font = '9px Consolas'; g.textAlign = 'center';
  const vs = []; for (let v = -Math.floor(mx / 5) * 5; v <= mx; v += 5) vs.push(v); if (mx % 5) vs.unshift(-mx), vs.push(mx);
  for (const v of vs) { const a = ang(v) - Math.PI / 2, l = v % 10 === 0 || Math.abs(v) === mx ? 9 : 5; g.beginPath(); g.moveTo(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4)); g.lineTo(cx + Math.cos(a) * (R - 4 - l), cy + Math.sin(a) * (R - 4 - l)); g.stroke(); if (v % 10 === 0 || Math.abs(v) === mx) g.fillText(Math.abs(v), cx + Math.cos(a) * (R + 8), cy + Math.sin(a) * (R + 8) + 3); }
  const ao = ang(ord) - Math.PI / 2; g.fillStyle = '#FFB547'; g.beginPath(); g.moveTo(cx + Math.cos(ao) * (R + 2), cy + Math.sin(ao) * (R + 2)); g.lineTo(cx + Math.cos(ao - 0.07) * (R - 10), cy + Math.sin(ao - 0.07) * (R - 10)); g.lineTo(cx + Math.cos(ao + 0.07) * (R - 10), cy + Math.sin(ao + 0.07) * (R - 10)); g.fill();
  const aa = ang(act) - Math.PI / 2; g.strokeStyle = '#E6EDF2'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(aa) * (R - 6), cy + Math.sin(aa) * (R - 6)); g.stroke();
  g.fillStyle = '#E6EDF2'; g.beginPath(); g.arc(cx, cy, 4, 0, 7); g.fill();
  g.fillStyle = '#FF8A8A'; g.textAlign = 'left'; g.font = 'bold 10px Segoe UI'; g.fillText('TRÁI', 4, h - 4); g.fillStyle = '#86E0A8'; g.textAlign = 'right'; g.fillText('PHẢI', w - 4, h - 4);
}
function fogSignals(s, d) {
  if (!s.fogAuto || !s.running) return;
  if (s.t < fogNext) return;
  const anch = s.anchors.some((a) => a.st === 'hold' && a.ax !== null);
  if (anch) { A.snd.bell(5); fogNext = s.t + 60; logOrder('Tín hiệu sương mù: rung chuông 5 giây (đang neo)', 'signal'); }
  else if (Math.abs(d.stw) > 0.3 || s.steps.some((id) => id !== 'st')) { A.snd.hornSeq('L'); fogNext = s.t + 120; logOrder('Tín hiệu sương mù: 1 tiếng dài (đang chạy)', 'signal'); }
  else { A.snd.hornSeq('LL'); fogNext = s.t + 120; logOrder('Tín hiệu sương mù: 2 tiếng dài (đã dừng)', 'signal'); }
}
function drawTape(hd, tgt, night) {
  const c = $('#tape'), g = c.getContext('2d'), w = 900, h = 66, ppd = w / 60, fg = night ? '#FFFFFF' : '#0B1116';
  g.clearRect(0, 0, w, h); g.fillStyle = night ? 'rgba(0,0,0,.45)' : 'rgba(205,211,217,.55)'; g.beginPath(); g.roundRect(0, 0, w, h, 12); g.fill();
  g.textAlign = 'center'; const card = { 0: 'B', 90: 'Đ', 180: 'N', 270: 'T' };
  for (let dd = Math.floor((hd - 32) / 5) * 5; dd <= hd + 32; dd += 5) { const x = w / 2 + (dd - hd) * ppd, n = ((dd % 360) + 360) % 360, mj = n % 10 === 0; g.fillStyle = fg; g.fillRect(x - 1.5, 0, 3, mj ? 18 : 10); if (mj) { g.font = (card[n] ? 'bold 31px' : '600 28px') + ' Consolas, "Cascadia Mono", monospace'; g.fillText(card[n] || pad3(n), x, 54); } }
  if (tgt !== null && tgt !== undefined) { const x = w / 2 + Math.max(-29, Math.min(29, wrap180(tgt - hd))) * ppd; g.fillStyle = '#E08A00'; g.beginPath(); g.moveTo(x - 13, 0); g.lineTo(x + 13, 0); g.lineTo(x, 18); g.fill(); }
  g.fillStyle = night ? '#5CD6FF' : '#0D47A1'; g.fillRect(w / 2 - 2, 0, 4, h);
}
export function shipPoly(v, x, y, psi, M, minPx) {
  const k = Math.max(1, (minPx || 0) / (M.loa / v.mPerPx())), L = M.loa * k, B = M.B * k, pts = [[L / 2, 0], [L * 0.3, B / 2], [-L / 2, B / 2], [-L / 2, -B / 2], [L * 0.3, -B / 2]];
  return pts.map((p) => v.m2s(x + p[0] * Math.sin(psi) + p[1] * Math.cos(psi), y + p[0] * Math.cos(psi) - p[1] * Math.sin(psi)));
}
function drawMini(d, night) {
  const s = A.sim, S = s.S, M = A.M, g = mini.ctx; mini.size(); mini.opt.palette = night ? 'night' : 'day';
  mini.setMpp(mapScale); mini.rot = A.set.headUp ? -S.psi : 0; mini.centerM(S.x + mapOff.x, S.y + mapOff.y); $('#mapHome').classList.toggle('off', !!(mapOff.x || mapOff.y)); mini.draw(); drawOverlay(mini, true);
  g.save(); g.lineJoin = 'round';
  // tuyến đi (màu tím như ECDIS)
  const r = curRoute();
  if (r) {
    const wp = s.route ? s.route.wp : -1;
    g.lineWidth = 2; r.pts.forEach((p, i) => { if (!i) return; const a = mini.m2s(r.pts[i - 1][0], r.pts[i - 1][1]), b = mini.m2s(p[0], p[1]); g.strokeStyle = i === wp ? '#C2185B' : 'rgba(194,24,91,.55)'; g.setLineDash(i === wp ? [] : [7, 4]); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); });
    g.setLineDash([]); g.font = 'bold 10px Segoe UI';
    r.pts.forEach((p, i) => { const q = mini.m2s(p[0], p[1]); g.strokeStyle = '#C2185B'; g.fillStyle = i === wp ? '#C2185B' : '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(q[0], q[1], 4.5, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#880E4F'; g.fillText(String(i + 1), q[0] + 7, q[1] - 5); });
  }
  if (s.track.length > 1) { g.strokeStyle = 'rgba(13,71,161,.55)'; g.lineWidth = 1.5; g.beginPath(); s.track.forEach((p, i) => { const q = mini.m2s(p[0], p[1]); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); const q = mini.m2s(S.x, S.y); g.lineTo(q[0], q[1]); g.stroke(); }
  // dự báo 3 phút
  let px = S.x, py = S.y, ph = S.psi; g.strokeStyle = '#E65100'; g.lineWidth = 2; g.setLineDash([4, 3]); g.beginPath(); let q = mini.m2s(px, py); g.moveTo(q[0], q[1]); const mk = [];
  for (let k = 1; k <= 36; k++) { ph += S.r * 5; px += (S.u * Math.sin(ph) + S.v * Math.cos(ph) + S.cE) * 5; py += (S.u * Math.cos(ph) - S.v * Math.sin(ph) + S.cN) * 5; q = mini.m2s(px, py); g.lineTo(q[0], q[1]); if (k % 12 === 0) mk.push([px, py, ph, k / 12]); }
  g.stroke(); g.setLineDash([]); g.font = 'bold 10px Consolas'; g.fillStyle = '#BF360C';
  mk.forEach((m) => { const p = mini.m2s(m[0], m[1]); g.beginPath(); g.arc(p[0], p[1], 2.5, 0, 7); g.fill(); g.fillText(m[3] + "'", p[0] + 5, p[1] + 3); });
  const gp = shipPoly(mini, mk[2][0], mk[2][1], mk[2][2], M, 14); g.strokeStyle = '#E65100'; g.lineWidth = 1; g.setLineDash([2, 2]); g.beginPath(); gp.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.stroke(); g.setLineDash([]);
  // dây & neo
  for (const l of s.lines) if (l.st !== 'chua') { const [fx, fy] = body2w(S, l.fx, l.side * M.B / 2 * l.fyk), a = mini.m2s(fx, fy), b = mini.m2s(l.bx, l.by); g.strokeStyle = (l.pct || 0) > 80 ? '#D50000' : '#37474F'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
  for (const a of s.anchors) if (a.ax !== null) { const [hx, hy] = body2w(S, a.bx, a.by), p = mini.m2s(hx, hy), b = mini.m2s(a.ax, a.ay); g.strokeStyle = a.drag ? '#D50000' : '#4E342E'; g.lineWidth = 1.5; g.setLineDash([3, 2]); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(b[0], b[1]); g.stroke(); g.setLineDash([]); g.fillStyle = '#4E342E'; g.beginPath(); g.arc(b[0], b[1], 4, 0, 7); g.fill(); }
  const sp = shipPoly(mini, S.x, S.y, S.psi, M, 14); g.fillStyle = 'rgba(13,71,161,.35)'; g.strokeStyle = '#0D47A1'; g.lineWidth = 1.6; g.beginPath(); sp.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill(); g.stroke();
  const h2 = mini.m2s(S.x + Math.sin(S.psi) * 400, S.y + Math.cos(S.psi) * 400); g.setLineDash([3, 3]); g.lineWidth = 1; g.beginPath(); g.moveTo(sp[0][0], sp[0][1]); g.lineTo(h2[0], h2[1]); g.stroke(); g.setLineDash([]);
  // điểm đo: đường từ tàu tới điểm chọn
  if (s.mark) { const a = mini.m2s(S.x, S.y), b = mini.m2s(s.mark.x, s.mark.y); g.strokeStyle = '#1B5E20'; g.lineWidth = 1.5; g.setLineDash([6, 3]); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.setLineDash([]); g.lineWidth = 2; g.beginPath(); g.moveTo(b[0] - 6, b[1] - 6); g.lineTo(b[0] + 6, b[1] + 6); g.moveTo(b[0] + 6, b[1] - 6); g.lineTo(b[0] - 6, b[1] + 6); g.stroke(); }
  // la bàn
  const w = mini.cv.width, hh = mini.cv.height; g.translate(w - 22, hh - 42); g.rotate(mini.rot); g.fillStyle = 'rgba(9,14,18,.82)'; g.beginPath(); g.arc(0, 0, 12, 0, 7); g.fill(); g.fillStyle = '#E6EDF2'; g.beginPath(); g.moveTo(0, -9); g.lineTo(4, 4); g.lineTo(0, 1.5); g.lineTo(-4, 4); g.fill();
  g.restore();
  const nm = mini.ref ? mini.ref.name : A.W.hasCharts() ? 'Ngoài vùng hải đồ' : 'Biển trống (chưa nạp hải đồ)'; if ($('#mapName').textContent !== nm) $('#mapName').textContent = nm;
  const bs = A.W.segs.filter((q) => !q.ship); let info = '';
  if (bs.length) { let bd = 1e9, bb = 0; for (const q2 of bs) { const mx = (q2.ax + q2.bx) / 2, my = (q2.ay + q2.by) / 2, dd = Math.hypot(mx - S.x, my - S.y); if (dd < bd) { bd = dd; bb = Math.atan2(mx - S.x, my - S.y) / D2R; } } info = 'Tới cầu bến: ' + fmtDist(bd) + ' · ' + pad3(bb) + '°'; }
  $('#mapInfo').textContent = info; $('#mapInfoBox').style.display = info || s.mark ? 'block' : 'none';
  const bar = [50, 100, 200, 0.25 * NM, 0.5 * NM, NM, 2 * NM, 5 * NM].find((m) => m / mapScale >= 40) || 5 * NM;
  $('#mapScale').innerHTML = `<div style="width:${(bar / mapScale).toFixed(0)}px;height:4px;border:1px solid #E6EDF2;border-top:0;margin:0 auto 2px"></div>${bar < 300 ? bar + ' m' : String(bar / NM).replace('.', ',') + ' Hl'}`;
}
export function lineSegs3D() {
  const s = A.sim, S = s.S, M = A.M, fb = (num(A.p.D, M.d * 1.6) - M.d), out = [], tide = s.e.tide;
  for (const l of s.lines) if (l.st !== 'chua') { const [fx, fy] = body2w(S, l.fx, l.side * M.B / 2 * l.fyk); const bo = A.W.bollards.find((b) => b.n === l.bn) || { top: 4.5 }, top = bo.float ? bo.top + tide : bo.top; out.push([fx, fb + 0.3, -fy, l.bx, top + 0.9 - tide, -l.by, (l.pct || 0) > 80 ? 0xff5555 : 0xe8e0c8]); }
  return out; // xích neo do view3d vẽ cùng quả neo
}
