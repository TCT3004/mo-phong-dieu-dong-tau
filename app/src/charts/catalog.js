// Kho hải đồ: bản ghi (header, georef, đa giác phủ, bảng màu), ô ảnh nén và lưới lớp độ sâu trong IndexedDB `mp_charts`.
// Ô ảnh không phụ thuộc georef → đổi datum / dời tay chỉ cần tính lại hệ số, không phải chia ô lại.
import { parseBsb } from './bsb.js';
import { fitGeoref, makeXf } from './georef.js';
import { normalizeDatum, toWGS84, DATUMS } from '../geo/datum.js';
import { llToMerc, mercToLL, mercScale } from '../geo/proj.js';
import { bbox, normalize } from '../geo/poly.js';
import WORKER_SRC from '../_tilerworker.js';

const DBN = 'mp_charts', TS = 256;
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => { const r = indexedDB.open(DBN, 1); r.onupgradeneeded = () => { const d = r.result; for (const s of ['meta', 'tiles', 'grids']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  return dbp;
}
const tx = async (store, mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(store, mode), s = t.objectStore(store); let out; const r = fn(s); if (r) r.onsuccess = () => { out = r.result; }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); };
const range = (id) => IDBKeyRange.bound(id + '/', id + '/￿');
async function unpack(z, d) {
  if (!z) return d;
  const s = new Blob([d]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
const STORE_KEYS = ['id', 'kind', 'fmt', 'name', 'nu', 'file', 'size', 'scale', 'W', 'H', 'datumSrc', 'datumUser', 'dtm', 'proj', 'sd', 'ed', 'refs', 'plyRaw', 'palettes', 'classDepth', 'offsetM', 'levels', 'ready', 'error', 'added', 'pdfRefs'];

// tính phần phụ thuộc georef: datum, hệ số, đa giác phủ, hộp bao, tâm
export function georefRecord(r) {
  const did = r.datumUser || normalizeDatum(r.datumSrc);
  r.datum = did || 'WGS84'; r.datumKnown = !!did;
  r.datumName = did ? DATUMS[did].name : (r.datumSrc ? 'không rõ (' + r.datumSrc + ')' : 'không ghi') + ', coi như WGS-84';
  const conv = (lat, lon) => did && did !== 'WGS84' ? toWGS84(lat, lon, did).slice(0, 2) : (!did && r.dtm ? [lat + r.dtm[0] / 3600, lon + r.dtm[1] / 3600] : [lat, lon]);
  const refs = (r.refs || []).map((q) => { const [lat, lon] = conv(q.lat, q.lon); return { x: q.x, y: q.y, lat, lon }; });
  r.coef = fitGeoref(refs, r.W, r.H);
  if (!r.coef) { r.error = r.error || 'Không đủ điểm tọa độ (REF)'; r.ready = false; return r; }
  const c0 = makeXf(r.coef).pxToLL(r.W / 2, r.H / 2), k = mercScale(c0[0]), off = r.offsetM || [0, 0];
  r.offM = [off[0] * k, off[1] * k];
  r.xf = makeXf(r.coef, r.offM);
  const plyLL = r.plyRaw && r.plyRaw.length >= 3 ? r.plyRaw.map(([a, b]) => conv(a, b)).map(([a, b]) => { const m = llToMerc(a, b); return mercToLL(m[0] + r.offM[0], m[1] + r.offM[1]); })
    : [[0, 0], [r.W, 0], [r.W, r.H], [0, r.H]].map(([x, y]) => r.xf.pxToLL(x, y));
  r.plyLL = plyLL; r.plyMerc = normalize(plyLL.map(([a, b]) => llToMerc(a, b)));
  r.bboxMerc = bbox(r.plyMerc); r.centerMerc = r.xf.pxToMerc(r.W / 2, r.H / 2); r.mppMerc = r.coef.mpp;
  const ll = r.plyLL.map((p) => p); r.bboxLL = [Math.min(...ll.map((p) => p[0])), Math.max(...ll.map((p) => p[0])), Math.min(...ll.map((p) => p[1])), Math.max(...ll.map((p) => p[1]))];
  r.rmsM = r.coef.rms; r.maxM = r.coef.max; r.pxM = r.coef.mpp / k;
  r.ver = (r.ver || 0) + 1;
  return r;
}
const plain = (r) => { const o = {}; for (const k of STORE_KEYS) if (r[k] !== undefined) o[k] = r[k]; return o; };

class Catalog {
  constructor() { this.records = []; this.byId = new Map(); this.subs = new Set(); this.cache = new Map(); this.queue = Promise.resolve(); this.busy = null; }
  on(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
  emit(ev) { for (const f of this.subs) try { f(ev); } catch (e) { console.error(e); } }
  async init() {
    try { const all = await tx('meta', 'readonly', (s) => s.getAll()); for (const r of all || []) this.add(georefRecord(r)); } catch (e) { console.warn('Không mở được kho hải đồ', e); }
    this.records.sort((a, b) => (a.scale || 0) - (b.scale || 0)); this.emit({ type: 'list' });
  }
  add(r) { if (this.byId.has(r.id)) this.records.splice(this.records.indexOf(this.byId.get(r.id)), 1, r); else this.records.push(r); this.byId.set(r.id, r); }
  async save(r) { await tx('meta', 'readwrite', (s) => s.put(plain(r), r.id)); }
  // nạp file (.kap); trả về số tờ đã nhận
  importFiles(files, onProgress) {
    const list = Array.from(files).filter((f) => /\.kap$/i.test(f.name));
    const job = this.queue.then(async () => { let n = 0; for (const f of list) { try { if (await this.importKap(f, onProgress)) n++; } catch (e) { console.error(e); this.emit({ type: 'error', name: f.name, msg: e.message || String(e) }); } } return n; });
    this.queue = job.catch(() => 0); return job;
  }
  async importKap(file, onProgress) {
    const bytes = new Uint8Array(await file.arrayBuffer()), H = parseBsb(bytes);
    const id = (H.name || file.name) + '|' + H.W + 'x' + H.H + '|' + bytes.length;
    if (this.byId.has(id) && this.byId.get(id).ready) return false;
    const r = georefRecord({ id, kind: 'kap', fmt: 'idx', name: H.name || file.name.replace(/\.kap$/i, ''), nu: H.nu, file: file.webkitRelativePath || file.name, size: bytes.length, scale: H.scale, W: H.W, H: H.H,
      datumSrc: H.datumSrc, dtm: H.dtm, proj: H.proj, sd: H.sd, ed: H.ed, refs: H.refs, plyRaw: H.ply, palettes: { day: Array.from(H.pal.day), dusk: Array.from(H.pal.dusk), night: Array.from(H.pal.night) },
      classDepth: [-3, -1, 1.5, 3.5, 10], offsetM: [0, 0], levels: 0, ready: false, added: Date.now() });
    if (r.proj && !/MERCATOR/.test(r.proj)) r.warn = 'Phép chiếu ' + r.proj + ' — georef khớp gần đúng bằng đa thức';
    this.add(r); this.emit({ type: 'list' }); await this.save(r);
    await this.tile(r, bytes, onProgress);
    return true;
  }
  tile(r, bytes, onProgress) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' })), w = new Worker(url); this.busy = r.id;
      let pend = Promise.resolve();
      w.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'progress') { r.progress = m.f; if (onProgress) onProgress(r, m.f); this.emit({ type: 'progress', id: r.id, f: m.f }); }
        else if (m.type === 'tiles') pend = pend.then(() => tx('tiles', 'readwrite', (s) => { for (const it of m.items) s.put({ z: it.z, d: it.d }, r.id + '/' + it.k); }));
        else if (m.type === 'grid') pend = pend.then(() => tx('grids', 'readwrite', (s) => s.put({ gw: m.gw, gh: m.gh, cell: m.cell, d: new Uint8Array(m.data) }, r.id)));
        else if (m.type === 'done') pend.then(async () => { r.levels = m.levels; r.ready = true; delete r.progress; await this.save(r); w.terminate(); URL.revokeObjectURL(url); this.busy = null; this.emit({ type: 'ready', id: r.id }); res(r); });
        else if (m.type === 'error') { w.terminate(); URL.revokeObjectURL(url); this.busy = null; r.error = m.msg; this.save(r); this.emit({ type: 'list' }); rej(new Error(m.msg)); }
      };
      w.onerror = (e) => { w.terminate(); this.busy = null; r.error = e.message || 'Lỗi worker'; this.emit({ type: 'list' }); rej(new Error(r.error)); };
      w.postMessage({ id: r.id, bytes: bytes.buffer }, [bytes.buffer]);
    });
  }
  // ghi sẵn ô ảnh do nơi khác tạo (PDF): items [{ k:'l/tx/ty', z, d }]
  async putTiles(id, items) { await tx('tiles', 'readwrite', (s) => { for (const it of items) s.put({ z: it.z, d: it.d }, id + '/' + it.k); }); }
  async putGrid(id, g) { await tx('grids', 'readwrite', (s) => s.put(g, id)); }
  async getTile(id, l, x, y) {
    const k = id + '/' + l + '/' + x + '/' + y, c = this.cache.get(k); if (c) { this.cache.delete(k); this.cache.set(k, c); return c; }
    const v = await tx('tiles', 'readonly', (s) => s.get(k)); if (!v) return null;
    const d = await unpack(v.z, v.d); this.cache.set(k, d); if (this.cache.size > 300) this.cache.delete(this.cache.keys().next().value);
    return d;
  }
  async getGrid(id) { return tx('grids', 'readonly', (s) => s.get(id)); }
  async remove(id) {
    const r = this.byId.get(id); if (!r) return; this.byId.delete(id); this.records.splice(this.records.indexOf(r), 1);
    await tx('meta', 'readwrite', (s) => s.delete(id)); await tx('grids', 'readwrite', (s) => s.delete(id)); await tx('tiles', 'readwrite', (s) => s.delete(range(id)));
    for (const k of [...this.cache.keys()]) if (k.startsWith(id + '/')) this.cache.delete(k);
    this.emit({ type: 'removed', id }); this.emit({ type: 'list' });
  }
  // độ sâu đại diện cho từng lớp màu của tờ (không đổi georef, không phải vẽ lại)
  async setClassDepth(r, cd) { r.classDepth = cd.slice(0, 5).map(Number); await this.save(r); this.emit({ type: 'depth', id: r.id }); }
  async update(r, ch) { Object.assign(r, ch); georefRecord(r); await this.save(r); this.emit({ type: 'georef', id: r.id }); this.emit({ type: 'list' }); }
  // dung lượng đã dùng (ước tính)
  async usage() { try { const e = await navigator.storage.estimate(); return e.usage || 0; } catch (e) { return 0; } }
}
export const catalog = new Catalog();
export { TS };
