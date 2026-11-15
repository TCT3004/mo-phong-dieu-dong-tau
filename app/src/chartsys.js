// Trung tâm hệ hải đồ giai đoạn 2: hệ "mét thế giới" (gốc trôi), kho hải đồ, renderer WebGL2 dùng chung, nguồn độ sâu.
import { WorldFrame } from './geo/frame.js';
import { catalog } from './charts/catalog.js';
import { ChartGL } from './render/chartgl.js';
import { DepthProvider } from './depth/provider.js';

export const DEF_CLASS_DEPTH = [-3, -1, 1.5, 3.5, 10];
// gốc mặc định khi chưa có hải đồ và chưa đặt vị trí xuất phát: vịnh Bái Tử Long
export const DEFAULT_ORIGIN = [21.1, 107.45];

export const CS = {
  frame: new WorldFrame(DEFAULT_ORIGIN[0], DEFAULT_ORIGIN[1]), catalog, provider: new DepthProvider(catalog),
  gl: null, glErr: null, views: new Set(), originSubs: new Set(), under: 8
};
export function chartGL() {
  if (!CS.gl && !CS.glErr) {
    try { CS.gl = new ChartGL((id, l, x, y) => catalog.getTile(id, l, x, y)); CS.gl.onTile = () => { for (const v of CS.views) v.dirty = true; }; }
    catch (e) { CS.glErr = e; console.error(e); }
  }
  return CS.gl;
}
// dời gốc tọa độ tới (lat, lon); mọi nơi giữ tọa độ mét thế giới đăng ký CS.originSubs để đổi theo
export function setOrigin(lat, lon) {
  const { map } = CS.frame.recenter(lat, lon);
  for (const v of CS.views) { const p = map(v.cx, v.cy); v.cx = p[0]; v.cy = p[1]; v.dirty = true; }
  for (const f of CS.originSubs) f(map);
  return map;
}
export const toLL = (x, y) => CS.frame.toLL(x, y);
export const toWorld = (lat, lon) => CS.frame.toWorld(lat, lon);
// tra lớp đáy tại điểm mét thế giới → { cls, rec }
export function sampleWorld(x, y) { const m = CS.frame.worldToMerc(x, y); return CS.provider.sample(m[0], m[1]); }
// nạp lưới độ sâu của các tờ trong vùng ±half m quanh (x, y)
export function ensureAround(x, y, half) {
  const f = CS.frame, a = f.worldToMerc(x - half, y - half), b = f.worldToMerc(x + half, y + half);
  return CS.provider.ensure([a[0], a[1], b[0], b[1]]);
}
catalog.on((ev) => {
  if (ev.type === 'removed') { CS.provider.forget(ev.id); if (CS.gl) CS.gl.dropChart(ev.id); }
  if (ev.type === 'removed' || ev.type === 'ready' || ev.type === 'georef') for (const v of CS.views) v.dirty = true;
});
