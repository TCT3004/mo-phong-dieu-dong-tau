// Kho hải đồ: bản ghi (header, georef, đa giác phủ, bảng màu), ô ảnh nén và lưới lớp độ sâu trong IndexedDB `mp_charts`.
// Ô ảnh không phụ thuộc georef → đổi datum / dời tay chỉ cần tính lại hệ số, không phải chia ô lại.
import { parseBsb } from './bsb.js';
import { georefRecord } from './record.js';
import WORKER_SRC from '../_tilerworker.js';
import READER_SRC from '../_readerworker.js';
import { mercScale } from '../geo/proj.js';

const DBN = 'mp_charts', TS = 256;
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => { const r = indexedDB.open(DBN, 2); r.onupgradeneeded = () => { const d = r.result; for (const s of ['meta', 'tiles', 'grids', 'dmodel']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  return dbp;
}
const tx = async (store, mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(store, mode), s = t.objectStore(store); let out; const r = fn(s); if (r) r.onsuccess = () => { out = r.result; }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); };
const range = (id) => IDBKeyRange.bound(id + '/', id + '/\uffff');
async function unpack(z, d) {
  if (!z) return d;
  const s = new Blob([d]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
// khóa được lưu của bản ghi tờ (phần georef tính lại khi mở)
const STORE_KEYS = ['id', 'kind', 'fmt', 'name', 'nu', 'file', 'size', 'scale', 'du', 'W', 'H', 'datumSrc', 'datumUser', 'dtm', 'proj', 'sd', 'ed', 'refs', 'plyRaw', 'palettes', 'classDepth', 'offsetM', 'levels', 'ready', 'error', 'added', 'plyPx', 'dpi', 'page', 'dm'];

export { georefRecord };
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
    const r = georefRecord({ id, kind: 'kap', fmt: 'idx', name: H.name || file.name.replace(/\.kap$/i, ''), nu: H.nu, file: file.webkitRelativePath || file.name, size: bytes.length, scale: H.scale, du: H.du, W: H.W, H: H.H,
      datumSrc: H.datumSrc, dtm: H.dtm, proj: H.proj, sd: H.sd, ed: H.ed, refs: H.refs, plyRaw: H.ply, palettes: { day: Array.from(H.pal.day), dusk: Array.from(H.pal.dusk), night: Array.from(H.pal.night) },
      classDepth: [-3, -1, 1.5, 3.5, 10], offsetM: [0, 0], levels: 0, ready: false, added: Date.now() });
    if (r.proj && !/MERCATOR/.test(r.proj)) r.warn = 'Phép chiếu ' + r.proj + ' — georef khớp gần đúng bằng đa thức';
    this.add(r); this.emit({ type: 'list' }); await this.save(r);
    await this.tile(r, bytes, onProgress);
    this.readDepth(r).catch((e) => console.warn('đọc độ sâu', e));
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
    const d = v.z === 2 ? await createImageBitmap(v.d) : await unpack(v.z, v.d); this.cache.set(k, d); if (this.cache.size > 300) { const o = this.cache.keys().next().value, b = this.cache.get(o); if (b && b.close) b.close(); this.cache.delete(o); }
    return d;
  }
  async getGrid(id) { return tx('grids', 'readonly', (s) => s.get(id)); }
  async remove(id) {
    const r = this.byId.get(id); if (!r) return; this.byId.delete(id); this.records.splice(this.records.indexOf(r), 1);
    await tx('meta', 'readwrite', (s) => s.delete(id)); await tx('grids', 'readwrite', (s) => s.delete(id)); await tx('dmodel', 'readwrite', (s) => { s.delete(id); s.delete(id + '|g'); }); await tx('tiles', 'readwrite', (s) => s.delete(range(id)));
    for (const k of [...this.cache.keys()]) if (k.startsWith(id + '/')) this.cache.delete(k);
    this.emit({ type: 'removed', id }); this.emit({ type: 'list' });
  }
  // độ sâu đại diện cho từng lớp màu của tờ (không đổi georef, không phải vẽ lại)
  async setClassDepth(r, cd) { r.classDepth = cd.slice(0, 5).map(Number); await this.save(r); this.emit({ type: 'depth', id: r.id }); }
  async update(r, ch) { Object.assign(r, ch); georefRecord(r); await this.save(r); this.emit({ type: 'georef', id: r.id }); this.emit({ type: 'list' }); }
  // ---------- mô hình độ sâu (chartread/): số đo sâu, độ cao, lưới z ----------
  // lưu 2 bản ghi: «<id>» phần nhẹ (thông số, số đo sâu, độ cao — cho giao diện) và «<id>|g» phần nặng (lưới z, lớp ô, điểm mép)
  async getDLite(id) { return tx('dmodel', 'readonly', (s) => s.get(id)); }
  async getDGrid(id) { return tx('dmodel', 'readonly', (s) => s.get(id + '|g')); }
  async getDModel(id) { const [a, b] = await Promise.all([this.getDLite(id), this.getDGrid(id)]); return a && b ? Object.assign({}, a, b) : null; }
  async putDLite(id, m) { const { z, cl, tn, edges, ...lite } = m; await tx('dmodel', 'readwrite', (s) => s.put(lite, id)); }
  async putDModel(id, m) { const { z, cl, tn, edges, ...lite } = m; await tx('dmodel', 'readwrite', (s) => { s.put(lite, id); s.put({ z, cl, tn, edges, gw: m.gw, gh: m.gh, cell: m.cell, hc: m.hc }, id + '|g'); }); }
  // ô mức 0 của tờ (còn nén) để worker ghép lại ảnh chỉ số màu gốc: [{ x, y, z, d }]
  async level0Tiles(r) {
    const d0 = await db(), rg = IDBKeyRange.bound(r.id + '/0/', r.id + '/0/\uffff');
    const [keys, vals] = await new Promise((res, rej) => { const t2 = d0.transaction('tiles', 'readonly'), s = t2.objectStore('tiles'); let k, v;
      s.getAllKeys(rg).onsuccess = (e) => { k = e.target.result; }; s.getAll(rg).onsuccess = (e) => { v = e.target.result; };
      t2.oncomplete = () => res([k, v]); t2.onerror = () => rej(t2.error); });
    return keys.map((k, i) => { const a = String(k).split('/'); return { x: +a[a.length - 2], y: +a[a.length - 1], z: vals[i].z, d: vals[i].d }; });
  }
  // m thật / điểm ảnh tờ (ở tâm tờ)
  mppOf(r) { const ll = r.xf.pxToLL(r.W / 2, r.H / 2); return r.mppMerc / mercScale(ll[0]); }
  // đọc độ sâu cả tờ (worker, mỗi lúc một tờ). opt: { snd, hts } có sẵn thì chỉ dựng lại; { water: true } chỉ dựng lại mặt nước
  // sau khi sửa số; { tint: true } lấy màu nước từ ảnh rồi dựng lại mặt nước.
  // Hàng đợi: pri = người dùng bấm / sửa → chen lên đầu hàng (sau các việc người dùng khác) và dừng việc nền đang đọc cả tờ
  // (việc đó quay lại hàng, lần sau đọc lại từ đầu); việc nền (mở app, nạp tờ) xếp cuối. Mỗi tờ chỉ một việc chờ:
  // yêu cầu mới gộp vào việc cũ (đọc cả tờ > lấy màu nước > dựng lại mặt nước)
  readDepth(r, opt = {}, pri = false) {
    if (!r || r.kind !== 'kap' || !r.ready) return Promise.resolve(null);
    const rank = (o) => (o.water ? 1 : o.tint ? 2 : 3), plain = (o) => !o.water && !o.tint && !o.snd, dq = this.dq || (this.dq = []);
    return new Promise((res, rej) => {
      const p = { res, rej }, cur = this.dcur;
      // tờ này đang được đọc cả tờ từ đầu mà lại xin đọc từ đầu: chờ chung kết quả, không đọc hai lần
      if (cur && cur.r.id === r.id && plain(opt) && plain(cur.opt)) { cur.ps.push(p); if (pri) cur.pri = true; return; }
      let j = dq.find((q) => q.r.id === r.id);
      if (j) { if (rank(opt) >= rank(j.opt)) j.opt = opt; j.ps.push(p); if (!pri || j.pri) { this.emit({ type: 'dmq' }); return; } dq.splice(dq.indexOf(j), 1); j.pri = true; }
      else { j = { r, opt, pri, ps: [p] }; if (!pri) { dq.push(j); this.emit({ type: 'dmq' }); this._pumpDepth(); return; } }
      const i = dq.findIndex((q) => !q.pri); if (i < 0) dq.push(j); else dq.splice(i, 0, j);
      // việc nền đang đọc cả tờ khác: dừng lại (quay về hàng) để đọc ngay tờ người dùng chọn
      if (cur && !cur.pri && cur.r.id !== r.id && rank(cur.opt) === 3 && cur.abort) cur.abort();
      this.emit({ type: 'dmq' }); this._pumpDepth();
    });
  }
  _pumpDepth() {
    if (this.dcur || !this.dq || !this.dq.length) return;
    const j = this.dq.shift(); this.dcur = j; this.emit({ type: 'dmq' });
    this._readDepth(j.r, j.opt, j).then((m) => j.ps.forEach((p) => p.res(m)), (e) => {
      if (e && e.aborted) { delete j.abort; const ex = this.dq.find((q) => q.r.id === j.r.id); if (ex) { ex.ps.push(...j.ps); return; }
        const i = this.dq.findIndex((q) => !q.pri); if (i < 0) this.dq.push(j); else this.dq.splice(i, 0, j); }
      else j.ps.forEach((p) => p.rej(e)); })
      .finally(() => { if (this.dcur === j) this.dcur = null; this.emit({ type: 'dmq' }); this._pumpDepth(); });
  }
  // trạng thái hàng đợi: −1 không chờ, 0 đang chạy, n ≥ 1 thứ tự chờ
  depthQueuePos(id) { if (this.dcur && this.dcur.r.id === id) return 0; const i = (this.dq || []).findIndex((q) => q.r.id === id); return i < 0 ? -1 : i + 1; }
  depthJob(id) { if (this.dcur && this.dcur.r.id === id) return this.dcur; return (this.dq || []).find((q) => q.r.id === id) || null; }
  depthQueueInfo() { return { cur: this.dcur ? this.dcur.r : null, waiting: (this.dq || []).length }; }
  async _readDepth(r, opt, job = {}) {
    if (!this.byId.has(r.id)) return null;
    const aborted = () => Object.assign(new Error('dừng để đọc tờ khác trước'), { aborted: true }), prevDm = r.dm;
    let stop = false; job.abort = () => { stop = true; };
    let msg;
    if (opt.water) { const g = await this.getDGrid(r.id), l = opt.model || await this.getDLite(r.id); if (!g || !l) return null; msg = { mode: 'water', model: Object.assign({}, l, g) }; }
    else if (opt.tint) { // tờ đọc bằng bản cũ: lấy màu nước từ ảnh rồi dựng lại mặt nước
      const g = await this.getDGrid(r.id), l = await this.getDLite(r.id); if (!g || !l) return null;
      const tiles = await this.level0Tiles(r);
      msg = { mode: 'tint', tiles, TS, W: r.W, H: r.H, pal: Uint8Array.from(r.palettes.day).buffer, model: Object.assign({}, l, g, { mpp: l.mpp || this.mppOf(r) }) }; }
    else {
      r.dm = Object.assign({}, r.dm, { st: 'run', f: 0, s: 'Ghép ảnh hải đồ' }); this.emit({ type: 'dm', id: r.id });
      const tiles = await this.level0Tiles(r);
      if (stop) { r.dm = prevDm; this.emit({ type: 'dm', id: r.id }); throw aborted(); }
      msg = { mode: 'full', tiles, TS, W: r.W, H: r.H, pal: Uint8Array.from(r.palettes.day).buffer, du: r.du || 250, mpp: this.mppOf(r), snd: opt.snd, hts: opt.hts };
    }
    const m = await new Promise((res, rej) => {
      const url = URL.createObjectURL(new Blob([READER_SRC], { type: 'text/javascript' })), w = new Worker(url);
      let idle = 0; const end = () => { clearTimeout(idle); w.terminate(); URL.revokeObjectURL(url); };
      // không thấy tin gì từ worker quá 10 phút (máy hết bộ nhớ làm worker chết lặng) thì báo lỗi, không để kẹt cả hàng đợi
      const kick = () => { clearTimeout(idle); idle = setTimeout(() => { end(); rej(new Error('quá 10 phút không thấy tiến triển (có thể máy thiếu bộ nhớ) — bấm «Đọc lại» để thử lại')); }, 600000); };
      kick(); job.abort = () => { end(); rej(aborted()); };
      w.onmessage = (e) => { const q = e.data; kick();
        if (q.type === 'progress') { r.dm = Object.assign({}, r.dm, { st: 'run', f: q.f, s: q.s }); this.emit({ type: 'dm', id: r.id }); }
        else if (q.type === 'log') console.log('[đọc độ sâu ' + r.name + ']', q.s);
        else if (q.type === 'done') { end(); res(q.model); }
        else if (q.type === 'error') { end(); rej(new Error(q.msg)); } };
      w.onerror = (e) => { end(); rej(new Error(e.message || 'Lỗi worker đọc độ sâu')); };
      w.postMessage(msg, msg.tiles ? [msg.pal, ...msg.tiles.map((q) => q.d.buffer)] : []);
    }).catch(async (e) => { if (e.aborted) { r.dm = prevDm; this.emit({ type: 'dm', id: r.id }); throw e; }
      r.dm = Object.assign({}, r.dm, { st: 'err', err: e.message }); await this.save(r); this.emit({ type: 'dm', id: r.id }); throw e; });
    job.abort = null;
    if (!this.byId.has(r.id)) return null;
    // người dùng sửa thêm trong lúc đang dựng: giữ bản điểm mới nhất, dựng thêm một lượt mặt nước
    let again = false;
    if (msg.mode === 'water' || msg.mode === 'tint' || opt.snd) { const cur = await this.getDLite(r.id); if (cur && cur.snd) { const used = JSON.stringify(msg.model ? msg.model.snd : opt.snd);
      if (JSON.stringify(cur.snd) !== used) again = true; m.snd = cur.snd; if (msg.mode !== 'full' || JSON.stringify(cur.hts) === JSON.stringify(opt.hts)) m.hts = cur.hts; } }
    await this.putDModel(r.id, m);
    if (again) setTimeout(() => this.readDepth(r, { water: true }, true).catch(() => {}), 0);
    r.dm = { st: 'ok', alg: m.alg, made: m.made, n: m.snd.filter((s) => !s.del).length, sus: m.snd.filter((s) => s.sus && !s.del).length, nh: m.hts.length, interval: m.interval, hc: m.hc };
    await this.save(r); this.emit({ type: 'dm', id: r.id }); this.emit({ type: 'dmodel', id: r.id });
    return m;
  }
  // dung lượng đã dùng (ước tính)
  async usage() { try { const e = await navigator.storage.estimate(); return e.usage || 0; } catch (e) { return 0; } }
}
export const catalog = new Catalog();
export { TS };
