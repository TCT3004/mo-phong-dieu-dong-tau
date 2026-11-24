// Trạng thái chung + vòng mô phỏng.
import { defaultShip, buildModel, newState, stepShip, squat, displayRpm, stepLabel, KN, D2R } from './physics.js';
import { World, defaultEnv, envAt, makeAnchors, makeLines, externalForces, wrap180, body2w, FREE_SPD } from './world.js';
import { CS, setOrigin, toLL } from './chartsys.js';
import { Weather } from './weather.js';
import { loadPlaces, placesToWorld, savePlaces } from './places.js';

export const $ = (s, r) => (r || document).querySelector(s);
export const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
export const num = (v, d) => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : (d === undefined ? 0 : d); };
export const pad3 = (n) => String(((Math.round(n) % 360) + 360) % 360).padStart(3, '0');
export const clock = (s) => { s = Math.floor(((s % 86400) + 86400) % 86400); const p = (n) => String(n).padStart(2, '0'); return p(Math.floor(s / 3600)) + ':' + p(Math.floor(s / 60) % 60) + ':' + p(s % 60); };
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } }
};
// IndexedDB đơn giản (bài đã ghi; kho `charts` cũ của v0.1 chỉ còn để chuyển sang kho hải đồ mới)
export const DB = {
  open() { return new Promise((res) => { try { const r = indexedDB.open('mophongtau', 1); r.onupgradeneeded = () => { r.result.createObjectStore('charts'); r.result.createObjectStore('sessions'); }; r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); } }); },
  async tx(store, mode, fn) { const db = await this.open(); if (!db) return null; return new Promise((res) => { try { const t = db.transaction(store, mode), q = fn(t.objectStore(store)); t.oncomplete = () => res(q && q.result); t.onerror = () => res(null); } catch (e) { res(null); } }); },
  put(s, k, v) { return this.tx(s, 'readwrite', (o) => o.put(v, k)); }, get(s, k) { return this.tx(s, 'readonly', (o) => o.get(k)); },
  keys(s) { return this.tx(s, 'readonly', (o) => o.getAllKeys()); }, del(s, k) { return this.tx(s, 'readwrite', (o) => o.delete(k)); }
};

function mergeShip(saved) {
  const d = defaultShip(); if (!saved) return d;
  const p = Object.assign(d, saved); p.fx = Object.assign(defaultShip().fx, saved.fx || {});
  if (!Array.isArray(p.steps) || p.steps.length !== 6) p.steps = defaultShip().steps;
  return p;
}
export const A = {
  p: mergeShip(LS.get('mp_ship')), env: Object.assign(defaultEnv(), LS.get('mp_env') || {}),
  set: Object.assign({ quality: 'high', volMaster: 80, volEngine: 60, volBell: 90, headUp: false, uiScale: 'auto', volEnv: 70, rollSpeed: 4 }, LS.get('mp_set') || {}),
  W: new World(), M: null, sim: null, tab: 'run', sessions: [], hooks: {}
};
export function saveShip() { LS.set('mp_ship', A.p); }
export function saveEnv() { LS.set('mp_env', A.env); }
// bài tập lưu từ bản cũ: chỉ có chu kỳ sóng + hệ số «bước sóng ×» trong Cài đặt → đổi ra bước sóng (m) giữ đúng dáng sóng cũ
{ const old = LS.get('mp_env'); if (old && !(old.waveL > 0)) { A.env.waveL = Math.round(num(A.set.waveLen, 4) * 9.81 * num(old.waveT, 6) ** 2 / (2 * Math.PI)); saveEnv(); } }
export function saveSet() { LS.set('mp_set', A.set); }
// đối tượng trên hải đồ: lưu theo lat/lon (places.js), trong bộ nhớ theo mét thế giới
export function saveObjs() { savePlaces(A.W); }
export function loadObjs() { placesToWorld(loadPlaces(), A.W); }
export function rebuildModel() { A.M = buildModel(A.p); return A.M; }

export const LIGHTS = [['mast1', 'Đèn cột trước', '#fff'], ['mast2', 'Đèn cột sau', '#fff'], ['sideP', 'Đèn mạn trái', '#ff4d4d'], ['sideS', 'Đèn mạn phải', '#3dff8a'], ['stern', 'Đèn lái', '#fff'], ['anchF', 'Đèn neo trước', '#fff'], ['anchA', 'Đèn neo sau', '#fff'], ['deck', 'Đèn chiếu boong', '#ffe08a'], ['nuc', '2 đèn đỏ (mất chủ động)', '#ff4d4d']];
export const LIGHT_PRESETS = [['Đang chạy', ['mast1', 'mast2', 'sideP', 'sideS', 'stern']], ['Đang neo', ['anchF', 'anchA', 'deck']], ['Mất chủ động', ['nuc', 'sideP', 'sideS', 'stern']], ['Tắt hết', []]];

export function startPos() {
  const W = A.W; if (W.start) return W.start;
  return { x: 0, y: 0, hdg: 0 };
}
export function daySec0() { const m = /^(\d{1,2}):(\d{2})/.exec(A.env.startTime || ''); return m ? (+m[1]) * 3600 + (+m[2]) * 60 : 6.5 * 3600; }

export function newSim() {
  // gốc tọa độ đặt tại vị trí xuất phát (mét thế giới chính xác nhất quanh gốc)
  { const p = startPos(); if (Math.hypot(p.x, p.y) > 1) setOrigin(...toLL(p.x, p.y)); }
  const M = rebuildModel(), sp = startPos(), S = newState(M);
  S.x = sp.x; S.y = sp.y; S.psi = num(sp.hdg, 0) * D2R; S.u = num(A.env.startKn, 0) * KN;
  const st = M.steps[A.env.startStep] ? A.env.startStep : 'st';
  S.n.fill(M.steps[st].n);
  const lights = {}; LIGHTS.forEach((l) => { lights[l[0]] = LIGHT_PRESETS[0][1].includes(l[0]); });
  // thời tiết ngẫu nhiên (tab 4 chọn «Ngẫu nhiên»): mỗi bài một hạt giống mới
  const wxSeed = (Math.random() * 2 ** 31) | 0, wx = A.env.wxMode === 'random' ? new Weather(wxSeed, daySec0(), A.env.wxStart || '') : null;
  A.sim = {
    S, t: 0, day0: daySec0(), running: false, speed: 1, steps: new Array(M.nE).fill(st),
    helm: { mode: 'steady', ord: 0, target: Math.round(num(sp.hdg, 0)) % 360, steer: 'hand', my: 'Giữ hướng ' + pad3(num(sp.hdg, 0)) + '°', rep: 'Giữ hướng ' + pad3(num(sp.hdg, 0)) + ', rõ!' },
    anchors: makeAnchors(M), lines: makeLines(M), selLine: 'hl', lights, alarm: false, bellUntil: -1,
    log: [], rec: [], info: {}, wx, wxSeed, e: envAt(A.env, daySec0(), 0, wx), aground: false, bank: [1e4, 1e4], ukc: 99, h: 99, sq: 0, hC: 0,
    started: new Date().toISOString(), track: [], frame: { lat0: CS.frame.lat0, lon0: CS.frame.lon0 }
  };
  refreshDepth();
  logOrder('Bắt đầu bài tập', 'note');
  if (A.hooks.simReset) A.hooks.simReset();
  return A.sim;
}
// gốc trôi: đổi tọa độ trạng thái mô phỏng (tàu, vết, neo, dây, điểm đo, bản ghi) sang gốc mới
CS.originSubs.add((map) => {
  A.W.mapCoords(map);
  const s = A.sim; if (!s) return; const S = s.S;
  [S.x, S.y] = map(S.x, S.y); s.track = s.track.map((p) => map(p[0], p[1]));
  for (const r of s.rec) [r.x, r.y] = map(r.x, r.y);
  for (const a of s.anchors) if (a.ax !== null) [a.ax, a.ay] = map(a.ax, a.ay);
  for (const l of s.lines) if (l.st !== 'chua') [l.bx, l.by] = map(l.bx, l.by);
  if (s.mark) [s.mark.x, s.mark.y] = map(s.mark.x, s.mark.y);
  s.frame = { lat0: CS.frame.lat0, lon0: CS.frame.lon0 };
});
// dời gốc khi tàu đi xa hơn 20 km (giữ sai số tỷ lệ của mét thế giới dưới ~0,15%)
export function checkOrigin() { const s = A.sim; if (s && Math.hypot(s.S.x, s.S.y) > 20000) { setOrigin(...toLL(s.S.x, s.S.y)); return true; } return false; }
// tính lại độ sâu tại tàu (khi lưới độ sâu vừa nạp xong mà bài chưa chạy)
export function refreshDepth() { const s = A.sim; if (!s) return; s.hC = A.W.depthAt(s.S.x, s.S.y); s.h = s.hC + s.e.tide; s.ukc = s.h - A.M.d - (s.sq || 0); }
export function logOrder(text, kind) { const s = A.sim; s.log.unshift({ t: s.t, text, kind: kind || 'helm' }); if (s.log.length > 400) s.log.pop(); s.lastOrd = { t: s.t, text }; }

export function engName(n, i) { return n === 1 ? 'Máy' : n === 2 ? ['Máy trái', 'Máy phải'][i] : n === 3 ? ['Máy trái', 'Máy giữa', 'Máy phải'][i] : ['Máy trái ngoài', 'Máy trái trong', 'Máy phải trong', 'Máy phải ngoài'][i]; }
// các nấc lệnh lái theo góc lái tối đa của tàu (tab 1): 5°, 10°, 15° và hết lái → [góc, nhãn nút, khẩu lệnh]
export function helmSteps(mx) {
  mx = Math.round(num(mx === undefined ? (A.M ? A.M.rudMax : 35) : mx, 35) * 10) / 10; if (!(mx > 0)) mx = 35;
  const st = [5, 10, 15].filter((v) => v < mx), out = [[-mx, 'HẾT TRÁI', 'Hết lái trái']];
  for (const v of st.slice().reverse()) out.push([-v, 'TRÁI', 'Lái trái ' + v]);
  out.push([0, 'LÁI VỀ', 'Lái về số 0']);
  for (const v of st) out.push([v, 'PHẢI', 'Lái phải ' + v]);
  out.push([mx, 'HẾT PHẢI', 'Hết lái phải']);
  return out;
}
export const Orders = {
  rudder(a) { const h = A.sim.helm; if (h.steer === 'auto') return; const d = helmSteps().find((q) => q[0] === a) || [a, '', a ? 'Lái ' + (a < 0 ? 'trái ' : 'phải ') + Math.abs(a) : 'Lái về số 0']; const mx = A.M.rudMax; h.mode = 'rudder'; h.ord = Math.max(-mx, Math.min(mx, a)); h.target = null; h.my = d[2]; h.rep = d[2].replace('Lái ', '').replace(/^./, (c) => c.toUpperCase()) + ', rõ!'; logOrder(d[2]); },
  steady() { const s = A.sim, h = s.helm, hd = Math.round(s.S.psi / D2R) % 360; h.mode = h.steer === 'auto' ? 'auto' : 'steady'; h.target = hd; h.my = 'Giữ hướng ' + pad3(hd) + '°'; h.rep = 'Giữ hướng ' + pad3(hd) + ', rõ!'; logOrder(h.my); },
  course(v) { const h = A.sim.helm, hd = ((Math.round(num(v, NaN)) % 360) + 360) % 360; if (!isFinite(hd)) return; h.target = hd; if (h.steer === 'auto') { h.mode = 'auto'; h.my = 'Lái tự động ' + pad3(hd) + '°'; h.rep = 'Lái tự động hướng ' + pad3(hd) + ', rõ!'; } else { h.mode = 'course'; h.my = 'Đi hướng ' + pad3(hd) + '°'; h.rep = 'Đi hướng ' + pad3(hd) + ', rõ!'; } logOrder(h.my); },
  steer(k) { const s = A.sim, h = s.helm; if (h.steer === k) return; h.steer = k; const hd = h.target !== null ? h.target : Math.round(s.S.psi / D2R) % 360; h.target = hd; if (k === 'auto') { h.mode = 'auto'; h.my = 'Lái tự động ' + pad3(hd) + '°'; h.rep = 'Đã chuyển lái tự động, hướng ' + pad3(hd); } else { h.mode = 'steady'; h.my = 'Lái tay, giữ hướng ' + pad3(hd) + '°'; h.rep = 'Lái tay, giữ hướng ' + pad3(hd) + ', rõ!'; } logOrder(h.my); },
  engine(i, id) { const s = A.sim; s.steps[i] = id; const lb = stepLabel(A.p, id); const nm = engName(A.M.nE, i); logOrder(id === 'st' ? (A.M.nE === 1 ? 'Dừng máy' : nm + ' dừng') : nm + ' ' + lb.toLowerCase(), 'engine'); },
  anchor(id, act) {
    const s = A.sim, a = s.anchors.find((q) => q.id === id); if (!a) return; const nm = a.name.toLowerCase();
    if (act === 'drop') { a.st = 'drop'; a.target = 0; a.free = false; logOrder('Thả ' + nm, 'anchor'); }
    else if (act === 'free') { if (!(a.st === 'drop' && a.free)) a.vf = FREE_SPD; a.st = 'drop'; a.target = 0; a.free = true; logOrder('Thả tự do ' + nm, 'anchor'); }
    else if (act === 'dredge') { a.st = 'drop'; a.free = false; a.target = Math.max(a.chain + 1, Math.round((s.h + 3) * 1.5)); logOrder('Thả ' + nm + ' kéo lê (' + a.target + ' m xích)', 'anchor'); }
    else if (act === 'brake' && a.chain > 0) { a.st = 'hold'; a.target = 0; a.free = false; logOrder('Hãm ' + nm + ' ở ' + a.chain.toFixed(0) + ' m xích', 'anchor'); }
    else if (act === 'heave' && a.chain > 0) { a.st = 'heave'; a.target = 0; a.free = false; logOrder('Kéo ' + nm, 'anchor'); }
    else if (act === 'lv1' || act === 'lv2') { const lv = act === 'lv2' ? 2 : 1; if (a.lv === lv) return; a.lv = lv; logOrder(a.name + ': tời cấp ' + lv, 'anchor'); }
  },
  light(k, on) { A.sim.lights[k] = on; logOrder((on ? 'Bật ' : 'Tắt ') + LIGHTS.find((l) => l[0] === k)[1].toLowerCase(), 'light'); },
  lightPreset(i) { const p = LIGHT_PRESETS[i]; LIGHTS.forEach((l) => { A.sim.lights[l[0]] = p[1].includes(l[0]); }); logOrder('Đèn hàng hải: ' + p[0].toLowerCase(), 'light'); }
};

const DT = 0.1;
export function helmCmd() {
  const s = A.sim, h = s.helm; if (h.mode === 'rudder' || h.target === null) return h.ord;
  const lim = h.mode === 'auto' ? 15 : 25, err = wrap180(h.target - s.S.psi / D2R), rot = s.S.r / D2R * 60;
  h.ord = Math.round(Math.max(-lim, Math.min(lim, err * 1.6 - rot * 0.7))); return h.ord;
}
export function substep() {
  const s = A.sim, S = s.S, M = A.M, W = A.W;
  if (s.wx) s.wx.step(DT);
  const e = s.e = envAt(A.env, s.day0 + s.t, s.t, s.wx); if (A.env.fogOn) e.vis = 550;
  const L = M.L, pts = [[0, 0], [0.45 * L, 0], [-0.45 * L, 0]];
  let hC = 1e9; for (const p of pts) { const [wx, wy] = body2w(S, p[0], p[1]); hC = Math.min(hC, W.depthAt(wx, wy)); }
  const h = hC + e.tide; s.hC = hC; s.h = h;
  if (Math.round(s.t * 10) % 10 === 0) s.bank = [W.bankDist(S, 1, M.d, e.tide), W.bankDist(S, -1, M.d, e.tide)];
  const env = { h: Math.max(h, M.d * 1.02), wS: e.wS, wD: e.wD, cE: e.cE, cN: e.cN, waveH: e.waveH, waveD: e.waveD, bankS: s.bank[0], bankP: s.bank[1] };
  const ctrl = { nT: s.steps.map((id) => (M.steps[id] || M.steps.st).n), dT: helmCmd() };
  const ext = externalForces(W, S, M, s.anchors, s.lines, Math.max(h, 1), DT, s.info);
  stepShip(S, M, ctrl, env, ext, DT);
  s.sq = squat(M, Math.abs(S.u) / KN, Math.max(h, M.d)); s.ukc = h - M.d - s.sq;
  if (s.ukc < 0) { S.u *= 0.6; S.v *= 0.6; S.r *= 0.6; if (!s.aground) { s.aground = true; logOrder('TÀU MẮC CẠN', 'alarm'); } } else if (s.ukc > 0.3) s.aground = false;
  s.t += DT;
  const k = Math.round(s.t * 10);
  if (k % 10 === 0) {
    const gE = S.u * Math.sin(S.psi) + S.v * Math.cos(S.psi) + S.cE, gN = S.u * Math.cos(S.psi) - S.v * Math.sin(S.psi) + S.cN;
    s.rec.push({ t: s.t, x: S.x, y: S.y, psi: S.psi, sog: Math.hypot(gE, gN) / KN, rot: S.r / D2R * 60, d: S.delta, rpm: displayRpm(M, S.n.reduce((a, b) => a + b, 0) / M.nE), ukc: s.ukc, tide: e.tide, st: s.steps.join(','), vis: e.vis, wH: e.waveH, wD: Math.round(e.waveD / D2R), wL: Math.round(e.waveL), wKn: +e.wKn.toFixed(1), wDir: Math.round(e.wDir), rn: +e.rain.toFixed(2), cl: +e.cloud.toFixed(2), wx: e.wx ? e.wx.type : undefined });
    if (k % 100 === 0) { s.track.push([S.x, S.y]); if (s.track.length > 2000) s.track.shift(); }
  }
}
export function derived() {
  const s = A.sim, S = s.S, M = A.M;
  const gE = S.u * Math.sin(S.psi) + S.v * Math.cos(S.psi) + S.cE, gN = S.u * Math.cos(S.psi) - S.v * Math.sin(S.psi) + S.cN;
  const sog = Math.hypot(gE, gN) / KN; let cog = Math.atan2(gE, gN) / D2R; if (cog < 0) cog += 360;
  const lat = gE * Math.cos(S.psi) - gN * Math.sin(S.psi);
  return { sog, cog, hdg: S.psi / D2R, drift: sog > 0.2 ? wrap180(cog - S.psi / D2R) : 0, rot: S.r / D2R * 60, stw: S.u / KN, bowLat: (lat + S.r * 0.45 * M.L) / KN, sternLat: (lat - S.r * 0.45 * M.L) / KN, gE, gN };
}
// gió biểu kiến trên tàu (cho cờ): hướng gió thổi tới (rad, từ Bắc theo chiều kim đồng hồ) và tốc độ (hl/h)
export function appWind(e, S) {
  const to = ((e.wDir || 0) + 180) * D2R, vt = (e.wKn || 0) * KN;
  const gE = S.u * Math.sin(S.psi) + (S.v || 0) * Math.cos(S.psi) + (S.cE || 0), gN = S.u * Math.cos(S.psi) - (S.v || 0) * Math.sin(S.psi) + (S.cN || 0);
  const ax = vt * Math.sin(to) - gE, ay = vt * Math.cos(to) - gN;
  return { to: Math.atan2(ax, ay), kn: Math.hypot(ax, ay) / KN };
}
export function sunEl(daySec, mode) {
  if (mode === 'day') return 50; if (mode === 'dusk') return 3; if (mode === 'night') return -30;
  return 62 * Math.sin(2 * Math.PI * (daySec / 3600 - 6) / 24);
}
export { DT };
