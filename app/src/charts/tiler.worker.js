// Worker chia ô ảnh hải đồ KAP: giải mã → lưới lớp độ sâu → kim tự tháp ô 256×256 chỉ số màu (nén deflate).
// Được bundle thành chuỗi IIFE (src/_tilerworker.js) và chạy bằng Worker kiểu classic từ Blob (chạy được dưới file://).
import { parseBsb, decodeBsb, buildGrid } from './bsb.js';
const TS = 256;
async function pack(u8) {
  if (typeof CompressionStream === 'undefined') return { z: 0, d: u8 };
  const s = new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return { z: 1, d: new Uint8Array(await new Response(s).arrayBuffer()) };
}
self.onmessage = async (e) => {
  const { id, bytes } = e.data;
  try {
    const u = new Uint8Array(bytes), H = parseBsb(u);
    let idx = decodeBsb(u, H, (f) => self.postMessage({ id, type: 'progress', f: f * 0.45 }));
    const g = buildGrid(idx, H.W, H.H, H.pal.day);
    self.postMessage({ id, type: 'grid', gw: g.gw, gh: g.gh, cell: g.cell, data: g.grid.buffer }, [g.grid.buffer]);
    const day = H.pal.day, lum = new Float32Array(256);
    for (let i = 0; i < 256; i++) lum[i] = day[i * 3] * 0.3 + day[i * 3 + 1] * 0.59 + day[i * 3 + 2] * 0.11;
    let W = H.W, Hh = H.H, level = 0, done = 0, total = 0;
    for (let w = W, h = Hh; ; w = Math.ceil(w / 2), h = Math.ceil(h / 2)) { total += Math.ceil(w / TS) * Math.ceil(h / TS); if (w <= TS && h <= TS) break; }
    let batch = [], bytesB = 0;
    const flush = () => { if (!batch.length) return; self.postMessage({ id, type: 'tiles', items: batch }, batch.map((b) => b.d.buffer)); batch = []; bytesB = 0; };
    for (;;) {
      const nx = Math.ceil(W / TS), ny = Math.ceil(Hh / TS);
      for (let ty = 0; ty < ny; ty++) for (let tx = 0; tx < nx; tx++) {
        const t = new Uint8Array(TS * TS), x0 = tx * TS, y0 = ty * TS, w = Math.min(TS, W - x0), h = Math.min(TS, Hh - y0);
        for (let y = 0; y < h; y++) t.set(idx.subarray((y0 + y) * W + x0, (y0 + y) * W + x0 + w), y * TS);
        const p = await pack(t); batch.push({ k: level + '/' + tx + '/' + ty, z: p.z, d: p.d }); bytesB += p.d.length; done++;
        if (batch.length >= 96 || bytesB > 4e6) { flush(); self.postMessage({ id, type: 'progress', f: 0.45 + 0.55 * done / total }); }
      }
      if (W <= TS && Hh <= TS) break;
      // thu nhỏ một nửa: mức đầu giữ mọi nét tối (đường bờ, chữ); các mức sau chỉ giữ nét tối khi chiếm ≥ 2 rồi ≥ 3 trong 4 điểm,
      // còn lại lấy màu nền chiếm đa số — để khi thu nhỏ hải đồ không bị chữ và số độ sâu phủ đen
      const W2 = Math.ceil(W / 2), H2 = Math.ceil(Hh / 2), n2 = new Uint8Array(W2 * H2), need = level === 0 ? 1 : level < 3 ? 2 : 3, q = [0, 0, 0, 0];
      for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
        const xa = 2 * x, ya = 2 * y, xb = Math.min(W - 1, xa + 1), yb = Math.min(Hh - 1, ya + 1);
        q[0] = idx[ya * W + xa]; q[1] = idx[ya * W + xb]; q[2] = idx[yb * W + xa]; q[3] = idx[yb * W + xb];
        let m = q[0], dk = 0; for (let k = 0; k < 4; k++) { if (lum[q[k]] < 110) dk++; if (lum[q[k]] < lum[m]) m = q[k]; }
        if (dk < need) { // đa số trong các điểm sáng
          let best = -1, bc = 0; for (let k = 0; k < 4; k++) { if (lum[q[k]] < 110) continue; let c = 0; for (let j = 0; j < 4; j++) if (q[j] === q[k]) c++; if (c > bc) { bc = c; best = q[k]; } }
          if (best >= 0) m = best;
        }
        n2[y * W2 + x] = m;
      }
      idx = n2; W = W2; Hh = H2; level++;
    }
    flush();
    self.postMessage({ id, type: 'done', levels: level + 1 });
  } catch (err) { self.postMessage({ id, type: 'error', msg: String((err && err.message) || err) }); }
};
