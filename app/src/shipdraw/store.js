// Ảnh sơ đồ tàu (có thể vài MB) lưu riêng trong IndexedDB `mp_shipimg`; mô hình (điểm, loại chi tiết) lưu cùng thông số tàu.
let dbp = null;
const db = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('mp_shipimg', 1); r.onupgradeneeded = () => r.result.createObjectStore('img'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('img', mode), s = t.objectStore('img'); let out; const q = fn(s); if (q) q.onsuccess = () => { out = q.result; }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); }); };
export const putImg = (id, blob) => tx('readwrite', (s) => s.put(blob, id));
export const getImg = (id) => tx('readonly', (s) => s.get(id));
export const delImg = (id) => tx('readwrite', (s) => s.delete(id));
