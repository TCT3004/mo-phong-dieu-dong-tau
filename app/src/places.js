// Đối tượng người dùng đặt trên hải đồ (đèn / phao, cầu bến + cọc bích, tuyến đi, vị trí xuất phát).
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
export const emptyPlaces = () => ({ v: 2, lights: [], berths: [], routes: [], routeSel: -1, start: null });

// bộ nhớ (mét thế giới) → kho (lat/lon)
export function worldToPlaces(W) {
  const ll = (x, y) => { const p = toLL(x, y); return [r7(p[0]), r7(p[1])]; }, o = W.objs;
  return {
    v: 2,
    lights: o.lights.map((l) => { const c = clean(l), p = ll(l.x, l.y); delete c.x; delete c.y; c.lat = p[0]; c.lon = p[1]; return c; }),
    berths: o.berths.map((b) => Object.assign(clean(b), { pts: b.pts.map((q) => ll(q[0], q[1])) })),
    routes: (o.routes || []).map((r) => ({ name: r.name, pts: r.pts.map((q) => ll(q[0], q[1])) })),
    routeSel: o.routeSel === undefined ? -1 : o.routeSel,
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
    routeSel: P.routeSel === undefined ? -1 : P.routeSel
  };
  if (W.objs.routeSel >= W.objs.routes.length) W.objs.routeSel = W.objs.routes.length - 1;
  W.start = P.start ? Object.assign({ hdg: P.start.hdg || 0 }, (([x, y]) => ({ x, y }))(toWorld(P.start.lat, P.start.lon))) : null;
  W.rebuild();
}
export function savePlaces(W) { put(KEY, worldToPlaces(W)); }

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
