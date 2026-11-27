// Kho tàu: các tàu mẫu chung chung có sẵn (tự dựng, không theo tàu thật nào) + tàu người dùng lưu vào kho (IndexedDB `mp_fleet`).
// Mỗi tàu trong kho = trọn bộ thông số tab 1 (kể cả mô hình vẽ, không kèm ảnh sơ đồ) → nạp làm tàu mình điều động,
// hoặc đặt làm tàu đậu ở cảng (tab 2).
import { defaultShip } from './physics.js';
import { genModel } from './shipdraw/shipgen.js';
import { TPL } from './fleet_tpl.js';

export const SHIP_TYPES = ['Tàu hàng', 'Tàu dầu', 'Tàu khách', 'Tàu pháo', 'Tàu tên lửa', 'Tàu phóng lôi', 'Tàu tuần tra', 'Tàu hộ vệ', 'Tàu đổ bộ', 'Tàu hậu cần', 'Tàu lai', 'Khác'];

// thông số tab 1 từ vài số chính: tốc độ max (hl/h), vòng quay máy max, hộp số…; còn lại lấy theo tàu mẫu mặc định
function params(o) {
  const d = defaultShip(), v = o.vmax, rpm = o.rpm, f = [1, 0.8, 0.6, 0.4], kn = (k) => Math.round(v * k * 10) / 10;
  const p = Object.assign(d, {
    lpp: Math.round(o.loa * 0.93 * 10) / 10, steps: [
      { id: 'f4', label: 'Tiến max', rpm, kn: kn(f[0]), knB: kn(f[0] * 1.04) }, { id: 'f3', label: 'Tiến 3', rpm: Math.round(rpm * f[1]), kn: kn(f[1]), knB: kn(f[1] * 1.04) },
      { id: 'f2', label: 'Tiến 2', rpm: Math.round(rpm * f[2]), kn: kn(f[2]), knB: kn(f[2] * 1.04) }, { id: 'f1', label: 'Tiến 1', rpm: Math.round(rpm * f[3]), kn: kn(f[3]), knB: kn(f[3] * 1.04) },
      { id: 'a1', label: 'Lùi 1', rpm: -Math.round(rpm * 0.45), kn: 0, knB: 0 }, { id: 'a2', label: 'Lùi 2', rpm: -Math.round(rpm * 0.75), kn: 0, knB: 0 }]
  }, o);
  delete p.vmax; p.props = p.engines; p.rot = Array.from({ length: p.engines }, () => ''); delete p.rotDir; // chiều quay chân vịt: người dùng tự chọn
  if (o.T !== undefined) { p.tf = o.tf !== undefined ? o.tf : Math.round((o.T - 0.05) * 100) / 100; p.ta = o.ta !== undefined ? o.ta : Math.round((o.T + 0.05) * 100) / 100; } delete p.T;
  p.disp = Math.round(p.cb * p.lpp * p.B * (p.tf + p.ta) / 2 * 1.025);
  return p;
}
// thông số đầy đủ (kể cả mô hình) của một mẫu
export function templateShip(id) {
  const t = TPL.find((q) => q.id === id); if (!t) return null;
  const sh = Object.assign({}, t.ship); if (sh.T === undefined) { sh.T = (sh.tf + sh.ta) / 2; }
  const p = params(sh); p.name = t.name.replace(/ \(mẫu\)$/, ''); p.type = t.type;
  p.model = t.model ? t.model() : genModel(Object.assign({ name: t.name }, t.spec)); delete p.model.template;
  return p;
}
export const TEMPLATES = TPL.map((t) => ({ id: 'tpl:' + t.id, type: t.type, name: t.name, L: t.ship.loa, T: t.ship.T !== undefined ? t.ship.T : (t.ship.tf + t.ship.ta) / 2, builtin: true }));

// ---------- kho người dùng (IndexedDB) ----------
let dbp = null;
const db = () => dbp || (dbp = new Promise((res) => { try { const r = indexedDB.open('mp_fleet', 1); r.onupgradeneeded = () => r.result.createObjectStore('ships', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); } }));
const tx = async (mode, fn) => { const d = await db(); if (!d) return null; return new Promise((res) => { try { const t = d.transaction('ships', mode), q = fn(t.objectStore('ships')); t.oncomplete = () => res(q && q.result); t.onerror = () => res(null); } catch (e) { res(null); } }); };
const clone = (o) => JSON.parse(JSON.stringify(o));
const cache = new Map();

// danh sách (mẫu có sẵn + tàu người dùng), không kèm thông số
export async function listFleet() {
  const mine = (await tx('readonly', (o) => o.getAll())) || [];
  return [...TEMPLATES, ...mine.map((e) => ({ id: e.id, type: e.type, name: e.name, L: e.p ? e.p.loa : 0, builtin: false, t: e.t }))];
}
// các loại tàu đang có (loại chuẩn + loại người dùng tự gõ)
export function fleetTypes(list) { const s = [...SHIP_TYPES]; for (const e of list || []) if (e.type && !s.includes(e.type)) s.splice(s.length - 1, 0, e.type); return s; }
// thông số đầy đủ của một tàu trong kho (bản sao, sửa thoải mái)
export async function getFleetShip(id) {
  if (cache.has(id)) return clone(cache.get(id));
  let p = null;
  if (String(id).startsWith('tpl:')) p = templateShip(id.slice(4));
  else { const e = await tx('readonly', (o) => o.get(id)); p = e ? e.p : null; }
  if (p) cache.set(id, p);
  return p ? clone(p) : null;
}
// lưu tàu (thông số + mô hình, không ảnh) vào kho; trùng loại + tên thì thay. Trả id
export async function saveFleetShip(type, name, p) {
  const list = await listFleet(), same = list.find((e) => !e.builtin && e.type === type && e.name === name);
  const id = same ? same.id : 'u:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), q = clone(p); q.type = type; q.name = name;
  await tx('readwrite', (o) => o.put({ id, type, name, p: q, t: Date.now() })); cache.delete(id);
  return id;
}
export async function deleteFleetShip(id) { if (String(id).startsWith('tpl:')) return; cache.delete(id); await tx('readwrite', (o) => o.delete(id)); }
// tàu nạp từ file đối tượng (tàu đậu ở cảng kèm mô hình): thêm vào kho nếu chưa có (theo loại + tên). Trả { id, added }
export async function ensureFleetShip(e) {
  if (!e || !e.p) return null; if (String(e.id).startsWith('tpl:')) return { id: e.id, added: false };
  const list = await listFleet(), same = list.find((q) => !q.builtin && q.type === e.type && q.name === e.name);
  if (same) return { id: same.id, added: false };
  await tx('readwrite', (o) => o.put({ id: e.id, type: e.type, name: e.name, p: e.p, t: Date.now() })); return { id: e.id, added: true };
}
