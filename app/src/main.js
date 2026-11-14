import { A, $, $$, clock, newSim, substep, DT, sunEl, saveSet, rebuildModel } from './app.js';
import { View3D } from './view3d.js';
import { Sound } from './audio.js';
import { windageState } from './windage.js';
import { initShip, initChart, initEnv, initSet, drawChart, restoreCharts, chartView } from './ui_setup.js';
import { initRun, rebuildRun, uiTick, runState, lineSegs3D, paneCvs, consoleFrame, fillRoutes, runKey } from './ui_run.js';
import { initReplay, replayFrame, saveSession, restoreSessions, R } from './ui_replay.js';

const TABS = [['ship', '1 · Thông số tàu'], ['chart', '2 · Cảng & luồng (hải đồ)'], ['run', '3 · Điều động'], ['env', '4 · Môi trường & kịch bản'], ['rep', '5 · Xem lại'], ['set', 'Cài đặt']];
$('#app').innerHTML = `<header class="hdr"><div><h1>MÔ PHỎNG ĐIỀU ĐỘNG TÀU</h1><div class="sub" id="hdrSub"></div></div><nav class="tabs" id="tabs" aria-label="Các tab">${TABS.map((t) => `<button data-tab="${t[0]}">${t[1]}</button>`).join('')}</nav>
<div style="display:flex;align-items:center;gap:8px"><div class="mono" id="hdrClock" style="font-size:16px;font-weight:600;padding:6px 10px;background:#111A20;border:1px solid #22303A;border-radius:6px">00:00:00</div><button class="btn" id="runBtn" aria-label="Chạy / tạm dừng" title="Chạy / tạm dừng (phím cách)" style="min-width:44px">▶</button><div class="seg" id="spdSeg"></div></div></header>
<div id="alarmBar" role="alert">BÁO ĐỘNG CHUNG ĐANG PHÁT — bấm «Tắt báo động» để dừng</div>
${TABS.map((t) => `<main class="pane" id="p-${t[0]}"></main>`).join('')}`;

A.snd = new Sound();
function mkView() {
  if (A.gl) A.gl.remove();
  A.gl = document.createElement('canvas'); A.gl.className = 'gl';
  try { A.view = new View3D(A.gl, A.set.quality); A.view.buildShip(A.M); A.view.buildTerrain(A.W); A.view.buildObjects(A.W); }
  catch (e) { A.view = null; console.error(e); }
  mountGL();
}
function mountGL() { const h = A.tab === 'rep' ? $('#glHoldR') : $('#glHold3'); if (h && A.gl && A.gl.parentNode !== h) h.insertBefore(A.gl, h.firstChild); }
function go(tab) {
  A.tab = tab; $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab)); $$('.pane').forEach((p) => p.classList.toggle('on', p.id === 'p-' + tab));
  if (tab === 'chart') requestAnimationFrame(() => drawChart());
  if (tab === 'env') initEnv();
  if (tab === 'rep') initReplay();
  if (tab !== 'run' && A.sim) A.sim.running = false;
  mountGL(); hdr();
}
function hdr() {
  const s = A.sim; $('#hdrSub').textContent = (A.p.name || 'Tàu') + ' · ' + (A.W.chart ? A.W.chart.name : 'Biển trống') + ' · ' + (A.env.name || '');
  $('#runBtn').textContent = s.running ? '⏸' : '▶'; $('#runBtn').classList.toggle('pri', !s.running && A.tab === 'run');
  $('#spdSeg').innerHTML = [1, 2, 4, 8].map((k) => `<button data-v="${k}" class="${s.speed === k ? 'on' : ''}">×${k}</button>`).join('');
}
$('#tabs').onclick = (e) => { const t = e.target.dataset.tab; if (t) go(t); };
$('#runBtn').onclick = () => { if (A.tab !== 'run') go('run'); A.sim.running = !A.sim.running; A.snd.init(); hdr(); };
$('#spdSeg').onclick = (e) => { const v = e.target.dataset.v; if (v) { A.sim.speed = +v; hdr(); } };
document.addEventListener('pointerdown', () => { if (A.tab === 'run') A.snd.init(); }, { passive: true });
// phím tắt ở tab 3: phím cách chạy / tạm dừng; mũi tên trái/phải chế độ lái; lên/xuống nấc máy
const typing = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
document.addEventListener('keydown', (e) => {
  if (A.tab !== 'run' || typing(e.target) || e.ctrlKey || e.altKey || e.metaKey) return;
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) { A.sim.running = !A.sim.running; A.snd.init(); hdr(); } return; }
  if (e.key.startsWith('Arrow')) { e.preventDefault(); if (!e.repeat) runKey(e.key); }
}, true);
document.addEventListener('keyup', (e) => { if (A.tab === 'run' && e.code === 'Space' && !typing(e.target)) e.preventDefault(); }, true);

function applyScale() { const u = A.set.uiScale, z = u === 'auto' || !u ? Math.max(0.55, Math.min(1.15, Math.min(innerWidth / 1500, innerHeight / 860))) : u / 100; document.body.style.zoom = z; $('#app').style.height = (innerHeight / z) + 'px'; $('#app').style.width = (innerWidth / z) + 'px'; }
window.addEventListener('resize', applyScale);
Object.assign(A.hooks, {
  go, mountGL, scaleChanged: applyScale,
  simReset() { if (A.snd) A.snd.alarm(false); },
  shipEdited() { initShip(); A.hooks.shipChanged(); },
  resetToStart(save) { if (save) saveSession(); newSim(); if (A.view) A.view.buildShip(A.M); rebuildRun(); hdr(); },
  shipChanged() { rebuildModel(); newSim(); if (A.view) A.view.buildShip(A.M); rebuildRun(); hdr(); },
  chartChanged() { if (A.view) { A.view.buildTerrain(A.W); A.view.buildObjects(A.W); } newSim(); rebuildRun(); hdr(); },
  objsChanged() { if (A.view) A.view.buildObjects(A.W); fillRoutes(); },
  envChanged() { if (A.tab === 'env') initEnv(); },
  qualityChanged() { mkView(); },
  volChanged() { A.snd.setVol({ master: A.set.volMaster / 100, engine: A.set.volEngine / 100, bell: A.set.volBell / 100 }); A.snd.bellType = A.set.bellType || 'electric'; },
  startScenario() { saveSession(); newSim(); if (A.view) A.view.buildShip(A.M); rebuildRun(); go('run'); A.sim.running = true; A.snd.init(); hdr(); }
});

applyScale(); rebuildModel(); newSim();
initShip(); initChart(); initRun(); initEnv(); initSet(); mkView(); A.hooks.volChanged();
go('run');
restoreSessions(); restoreCharts();

let last = performance.now(), acc = 0, lastUi = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dtR = Math.min(0.1, (ts - last) / 1000); last = ts; const s = A.sim;
  if (A.tab === 'run') {
    if (s.running) { acc += dtR * s.speed; let n = 0; while (acc >= DT && n < 90) { substep(); acc -= DT; n++; } if (n >= 90) acc = 0; }
    if (A.view) {
      const ds = s.day0 + s.t, e = s.e;
      A.view.setSegs(lineSegs3D());
      A.view.update({ x: s.S.x, y: s.S.y, psi: s.S.psi }, runState.view, { sunEl: sunEl(ds, s.lightMode), sunAz: 2 * Math.PI * (ds / 86400), vis: s.fog ? 550 : e.vis, tide: e.tide, waveH: e.waveH, waveD: e.waveD, waveT: e.waveT, t: s.t, lights: s.lights, daySec: ds });
      A.view.render(runState.view === 'bridge' ? paneCvs() : null);
    }
    consoleFrame(dtR);
    if (ts - lastUi > 150) { lastUi = ts; uiTick(); $('#hdrClock').textContent = clock(s.day0 + s.t); $('#runBtn').textContent = s.running ? '⏸' : '▶'; $('#alarmBar').style.display = s.alarm ? 'block' : 'none'; const M = A.M; A.snd.engine(s.S.n.reduce((a, b) => a + Math.abs(b), 0) / M.nE / M.nMax); }
  } else if (A.tab === 'rep') replayFrame(dtR);
}
requestAnimationFrame(frame);
window.__A = A; window.__R = R; window.__W = windageState; window.__chartView = chartView;
