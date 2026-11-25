// Dựng «mô hình độ sâu» của một tờ hải đồ raster: đọc số đo sâu + độ cao, dựng độ cao đất theo đường bình độ, mặt đáy, lưới z.
// Mọi tọa độ theo điểm ảnh tờ (không phụ thuộc georef). Dùng trong worker (charts/reader.worker.js) và trong Node (kiểm thử).
import { paletteInfo } from './img.js';
import { loadTemplates } from './digits.js';
import { readBlock, postFilter, dedupeHeights } from './read.js';
import { halfMasks, landElevation } from './terrain.js';
import { edgeSamples, cellClasses, composeGrid } from './surface.js';
import { ALG } from './version.js';

export { ALG };                // phiên bản thuật toán (xem version.js)
export const CELL = 4;       // điểm ảnh tờ cho một ô lưới z

// độ cao mép bờ (mép đất vàng) so với số 0 hải đồ: theo độ cao bãi cạn lớn nhất đọc được, mặc định 3 m
export function coastHeight(snd) {
  const d = snd.filter((s) => s.dry && !s.del).map((s) => s.v).sort((a, b) => a - b);
  const p90 = d.length ? d[Math.min(d.length - 1, Math.floor(d.length * 0.9))] : 0;
  return Math.max(2.5, Math.min(4.5, Math.max(3, p90 + 0.3)));
}

// đọc số trên cả tờ theo khối 2048² (lề chồng để không cắt cụm số)
export function readAll(idx, W, H, P, k, onProgress) {
  const B = 2048, OV = Math.ceil(130 * k); let snd = [], hts = [], done = 0; const nb = Math.ceil(W / B) * Math.ceil(H / B);
  for (let by = 0; by < H; by += B) for (let bx = 0; bx < W; bx += B) {
    const X0 = Math.max(0, bx - OV), Y0 = Math.max(0, by - OV), X1 = Math.min(W, bx + B + OV), Y1 = Math.min(H, by + B + OV);
    const r = readBlock(idx, W, H, P, k, X0, Y0, X1 - X0, Y1 - Y0, [bx, by, Math.min(W, bx + B), Math.min(H, by + B)]);
    snd.push(...r.snd); hts.push(...r.hts); done++; if (onProgress) onProgress(done / nb);
  }
  const keep = postFilter(snd, k).map((o) => ({ x: Math.round(o.x * 10) / 10, y: Math.round(o.y * 10) / 10, v: o.v, dry: !!o.dry, sus: !!o.suspect }));
  return { snd: keep, hts: dedupeHeights(hts, k).map((h) => ({ x: Math.round(h.x), y: Math.round(h.y), v: h.v, kind: h.kind })) };
}

// opts: { du (dpi in), mpp (m / điểm ảnh tờ), snd?, hts? (có sẵn thì không đọc lại), hc?, onProgress(f, chữ), log }
export async function buildDepthModel(idx, W, H, pal, opts = {}) {
  const prog = opts.onProgress || (() => {}), log = opts.log || (() => {});
  await loadTemplates();
  const P = paletteInfo(pal), k = (opts.du || 250) / 250;
  let snd = opts.snd, hts = opts.hts;
  if (!snd || !hts) { const r = readAll(idx, W, H, P, k, (f) => prog(f * 0.55, 'Đọc số độ sâu, độ cao')); if (!snd) snd = r.snd; if (!hts) hts = r.hts; }
  log('số đo sâu ' + snd.length + ', độ cao ' + hts.length);
  const hc = opts.hc || coastHeight(snd);
  prog(0.6, 'Tách đất, bãi, nước');
  const M = halfMasks(idx, W, H, P, k);
  prog(0.7, 'Đọc đường bình độ, dựng núi');
  const T = landElevation(M, hts, opts.mpp || 2, hc, k, log);
  const { W2, H2 } = M, clsT = M.cls2.slice(); for (let i = 0; i < clsT.length; i++) if (T.land[i]) clsT[i] = 3;
  prog(0.9, 'Dựng mặt đáy');
  const edges = edgeSamples(clsT, W2, H2, hc), gw = Math.ceil(W / CELL), gh = Math.ceil(H / CELL), cl = cellClasses(clsT, W2, H2, gw, gh, CELL);
  const z = composeGrid({ cl, gw, gh, cell: CELL, W2, H2, Eland: T.E, edges, snd });
  prog(1, 'Xong');
  return { alg: ALG, made: Date.now(), W, H, cell: CELL, gw, gh, hc, interval: T.interval, levels: T.levels, fit: T.fit, nSpots: T.nSpots, snd, hts, z, cl, edges };
}

// dựng lại phần nước / bãi sau khi sửa số đo sâu (không cần ảnh hải đồ): giữ ô đất, tam giác lại
export function rebuildWater(m) {
  const z = composeGrid({ cl: m.cl, gw: m.gw, gh: m.gh, cell: m.cell, W2: 0, H2: 0, Eland: null, edges: m.edges, snd: m.snd, zPrev: m.z });
  return Object.assign({}, m, { z, alg: ALG, made: Date.now() });
}
