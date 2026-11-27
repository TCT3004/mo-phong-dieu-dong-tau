// Worker đọc độ sâu / độ cao / đường bình độ của một tờ KAP rồi dựng lưới z (xem chartread/).
// Được bundle thành chuỗi IIFE (src/_readerworker.js), chạy bằng Worker classic từ Blob (chạy được dưới file://).
import { inflateSync } from 'fflate';
import { buildDepthModel, rebuildWater, addImageLayers } from '../chartread/model.js';
// ghép ảnh chỉ số màu gốc từ ô mức 0 (nén deflate-raw hoặc thô)
function assemble(tiles, W, H, TS) {
  const idx = new Uint8Array(W * H);
  for (const t of tiles) { const d = t.z === 1 ? inflateSync(t.d) : t.d, x0 = t.x * TS, y0 = t.y * TS, w = Math.min(TS, W - x0), h = Math.min(TS, H - y0); if (w <= 0 || h <= 0) continue;
    for (let y = 0; y < h; y++) idx.set(d.subarray(y * TS, y * TS + w), (y0 + y) * W + x0); }
  return idx;
}
self.onmessage = async (e) => {
  const m = e.data;
  try {
    let out;
    if (m.mode === 'water') out = rebuildWater(m.model);
    else if (m.mode === 'tint') out = addImageLayers(assemble(m.tiles, m.W, m.H, m.TS), m.W, m.H, new Uint8Array(m.pal), m.model, m.du);
    else out = await buildDepthModel(m.tiles ? assemble(m.tiles, m.W, m.H, m.TS) : new Uint8Array(m.idx), m.W, m.H, new Uint8Array(m.pal), {
      du: m.du, mpp: m.mpp, snd: m.snd, hts: m.hts, hc: m.hc,
      onProgress: (f, s) => self.postMessage({ type: 'progress', f, s }), log: (s) => self.postMessage({ type: 'log', s }) });
    self.postMessage({ type: 'done', model: out }, [out.z.buffer, out.cl.buffer, out.edges.buffer, ...(out.tn ? [out.tn.buffer] : []), ...(out.iso ? [out.iso.off.buffer, out.iso.c.buffer, out.iso.a.buffer] : [])]);
  } catch (err) { self.postMessage({ type: 'error', msg: String((err && err.message) || err) }); }
};
