// Đối tượng người dùng đặt trên hải đồ (đèn / phao / tiêu, cầu bến + cọc bích, tuyến đi, vị trí xuất phát + các vị trí có sẵn).
// Lưu một kho chung theo lat/lon WGS-84 (localStorage `mp_places`), không gắn với tờ hải đồ nào; trong bộ nhớ dùng mét thế giới.
// Chuyển tự động dữ liệu v0.1 (`mp_objs:<tên tờ>`, mét cục bộ của tờ) sang lat/lon bằng georef của tờ trong kho.
import { CS, toLL, toWorld } from './chartsys.js';
import { makeGeo, mToPx } from './kap.js';

const KEY = 'mp_places';
const get = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* đầy bộ nhớ */ } };
const clean = (o) => { const c = {}; for (const k in o) if (k[0] !== '_') c[k] = o[k]; return c; };
const r7 = (v) => Math.round(v * 1e7) / 1e7;

export function loadPlaces() { return get(KEY, null); }
export const emptyPlaces = () => ({ v: 3, lights: [], berths: [], routes: [], routeSel: -1, start: null, starts: [], ships: [] });

// bộ nhớ (mét thế giới) → kho (lat/lon)
export function worldToPlaces(W) {
  const ll = (x, y) => { const p = toLL(x, y); return [r7(p[0]), r7(p[1])]; }, o = W.objs;
  return {
    v: 3,
    lights: o.lights.map((l) => { const c = clean(l), p = ll(l.x, l.y); delete c.x; delete c.y; c.lat = p[0]; c.lon = p[1]; return c; }),
    berths: o.berths.map((b) => Object.assign(clean(b), { pts: b.pts.map((q) => ll(q[0], q[1])) })),
    routes: (o.routes || []).map((r) => ({ name: r.name, pts: r.pts.map((q) => ll(q[0], q[1])) })),
    routeSel: o.routeSel === undefined ? -1 : o.routeSel,
    starts: (o.starts || []).map((q) => { const p = ll(q.x, q.y); return { name: q.name, lat: p[0], lon: p[1], hdg: q.hdg || 0 }; }),
    ships: (o.ships || []).map((sh) => { const c = clean(sh), p = ll(sh.x, sh.y); delete c.x; delete c.y; c.lat = p[0]; c.lon = p[1]; c.anchors = (sh.anchors || []).map((a) => { if (!(a.chain > 0) || a.x === null || a.x === undefined) return { side: a.side, chain: 0, lat: null, lon: null }; const q = ll(a.x, a.y); return { side: a.side, chain: a.chain, lat: q[0], lon: q[1] }; }); return c; }),
    start: W.start ? Object.assign(ll(W.start.x, W.start.y).reduce((a, v, i) => (a[i ? 'lon' : 'lat'] = v, a), {}), { hdg: W.start.hdg || 0 }) : null
  };
}
// kho → bộ nhớ
export function placesToWorld(P, W) {
  P = P || emptyPlaces(); const w = (q) => toWorld(q[0], q[1]);
  W.objs = {
    lights: (P.lights || []).map((l) => { const c = Object.assign({}, l), p = toWorld(l.lat, l.lon); c.x = p[0]; c.y = p[1]; delete c.lat; delete c.lon; return c; }),
    berths: (P.berths || []).map((b) => Object.assign({}, b, { pts: b.pts.map(w) })),
    routes: (P.routes || []).map((r) => ({ name: r.name, pts: r.pts.map(w) })),
    routeSel: P.routeSel === undefined ? -1 : P.routeSel,
    starts: (P.starts || []).map((q) => { const p = toWorld(q.lat, q.lon); return { name: q.name, x: p[0], y: p[1], hdg: q.hdg || 0 }; }),
    ships: (P.ships || []).map((sh) => { const c = Object.assign({}, sh), p = toWorld(sh.lat, sh.lon); c.x = p[0]; c.y = p[1]; delete c.lat; delete c.lon; c.lines = (sh.lines || []).map((l) => Object.assign({}, l, { to: Object.assign({}, l.to) })); c.anchors = (sh.anchors || []).map((a) => { if (a.lat === null || a.lat === undefined || !(a.chain > 0)) return { side: a.side, chain: 0, x: null, y: null }; const q = toWorld(a.lat, a.lon); return { side: a.side, chain: a.chain, x: q[0], y: q[1] }; }); return c; })
  };
  if (W.objs.routeSel >= W.objs.routes.length) W.objs.routeSel = W.objs.routes.length - 1;
  W.start = P.start ? Object.assign({ hdg: P.start.hdg || 0 }, (([x, y]) => ({ x, y }))(toWorld(P.start.lat, P.start.lon))) : null;
  W.rebuild();
}
export function savePlaces(W) { put(KEY, worldToPlaces(W)); }

// file đối tượng (.json) để chép sang máy khác: cùng dạng kho lat/lon; tàu đậu kèm thông số + mô hình các tàu người dùng tự lưu
// trong kho (`fleet`, không kèm ảnh sơ đồ) — tàu mẫu có sẵn thì chỉ ghi id
export const PLACES_FILE = 'doi-tuong-hai-do';
export function placesFile(W) { return Object.assign({ app: 'mo-phong-dieu-dong-tau', loai: PLACES_FILE }, worldToPlaces(W)); }
// gộp file vào kho đang có: đối tượng trùng tên (đèn trùng tên và gần nhau < 50 m) thì thay bằng bản trong file
export function mergePlacesFile(W, F) {
  if (!F || F.loai !== PLACES_FILE) throw new Error('Không phải file đối tượng hải đồ của app');
  const cur = worldToPlaces(W), n = { lights: 0, berths: 0, routes: 0, starts: 0, ships: 0 }, near = (a, b) => Math.abs(a.lat - b.lat) < 4.5e-4 && Math.abs(a.lon - b.lon) < 4.8e-4;
  const put2 = (arr, list, same, k) => { for (const o of list || []) { const i = arr.findIndex((q) => same(q, o)); if (i >= 0) arr[i] = o; else arr.push(o); n[k]++; } };
  put2(cur.lights, F.lights, (q, o) => q.name === o.name && near(q, o), 'lights');
  put2(cur.berths, F.berths, (q, o) => q.name === o.name, 'berths');
  put2(cur.routes, F.routes, (q, o) => q.name === o.name, 'routes');
  put2(cur.starts, F.starts, (q, o) => q.name === o.name, 'starts');
  put2(cur.ships, F.ships, (q, o) => q.id === o.id, 'ships');
  if (!cur.start && F.start) cur.start = F.start;
  if (cur.routeSel < 0 && cur.routes.length) cur.routeSel = 0;
  placesToWorld(cur, W); savePlaces(W);
  return n;
}

// chuyển dữ liệu v0.1: cần tờ hải đồ tương ứng đã có trong kho (để có georef)
export function migrateLegacy() {
  const keys = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('mp_objs:')) keys.push(k); } } catch (e) { return null; }
  const done = get('mp_objs_migrated', []), todo = keys.filter((k) => !done.includes(k));
  if (!todo.length) return null;
  const P = loadPlaces() || emptyPlaces(), last = get('mp_lastChart', ''); let n = 0, startFrom = null;
  for (const k of todo) {
    const name = k.slice(8), r = CS.catalog.records.find((q) => q.name === name && q.xf);
    if (!r) continue;
    const s = get(k, null); done.push(k); if (!s) continue;
    const g = makeGeo({ refs: r.refs, W: r.W, H: r.H, datum: r.datumSrc });
    const ll = (x, y) => { const [px, py] = mToPx(g, x, y), p = r.xf.pxToLL(px, py); return [r7(p[0]), r7(p[1])]; }, o = s.objs || {};
    for (const l of o.lights || []) { const c = clean(l), p = ll(l.x, l.y); delete c.x; delete c.y; c.lat = p[0]; c.lon = p[1]; P.lights.push(c); n++; }
    for (const b of o.berths || []) { P.berths.push(Object.assign(clean(b), { pts: b.pts.map((q) => ll(q[0], q[1])) })); n++; }
    for (const rt of o.routes || []) { P.routes.push({ name: rt.name, pts: rt.pts.map((q) => ll(q[0], q[1])) }); n++; }
    if (o.routes && o.routes.length && P.routeSel < 0) P.routeSel = 0;
    if (s.classDepth) CS.catalog.setClassDepth(r, s.classDepth);
    if (s.start && (!startFrom || (last && (r.file || '').endsWith(last)))) { const p = ll(s.start.x, s.start.y); startFrom = { lat: p[0], lon: p[1], hdg: s.start.hdg || 0 }; }
  }
  if (startFrom && !P.start) P.start = startFrom;
  put(KEY, P); put('mp_objs_migrated', done);
  return { n, P };
}
