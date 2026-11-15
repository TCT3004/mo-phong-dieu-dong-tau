// Hải đồ PDF (vector hoặc scan): render bằng pdf.js thành kim tự tháp ô 256×256 RGBA (WebP) + lưới lớp độ sâu theo màu.
// Mỗi mức render lại từ vector ở tỷ lệ nhỏ hơn (nét luôn sắc); ảnh mức 0 có W×H = trang × dpi/72.
import { classOfRgb, cellClass, fillUnknown, CELL } from './bsb.js';
import { georefRecord } from './record.js';

const TS = 256, CH = 4096;
let LUT = null;
function lut() { if (!LUT) { LUT = new Uint8Array(32768); for (let i = 0; i < 32768; i++) LUT[i] = classOfRgb(((i >> 10) << 3) | 4, (((i >> 5) & 31) << 3) | 4, ((i & 31) << 3) | 4); } return LUT; }
const mkCanvas = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));
const toBlob = (c) => (c.convertToBlob ? c.convertToBlob({ type: 'image/webp', quality: 0.9 }) : new Promise((res) => c.toBlob(res, 'image/webp', 0.9)));

// kích thước ảnh mức 0 của trang ở dpi
export function pdfSize(page, dpi) { const v = page.getViewport({ scale: 1 }), s = dpi / 72; return { W: Math.ceil(v.width * s), H: Math.ceil(v.height * s), s }; }

// opt: { name, file, scale, datumSrc, dpi, refs:[{x,y,lat,lon}] (pixel mức 0), plyPx:[[x,y]] | null, page }
export async function importPdfChart(catalog, page, opt, onProgress) {
  const { W, H, s } = pdfSize(page, opt.dpi);
  const id = opt.name + '|' + W + 'x' + H + '|pdf' + (opt.size || 0);
  const r = georefRecord({ id, kind: 'pdf', fmt: 'rgba', name: opt.name, nu: opt.nu || opt.name, file: opt.file, size: opt.size || 0, scale: opt.scale || 0, W, H,
    datumSrc: opt.datumSrc, refs: opt.refs, plyPx: opt.plyPx || null, dpi: opt.dpi, page: opt.page || 1, classDepth: [-3, -1, 1.5, 3.5, 10], offsetM: [0, 0], levels: 0, ready: false, added: Date.now() });
  if (!r.coef) throw new Error('Cần ít nhất 2 điểm tọa độ hợp lệ');
  catalog.add(r); catalog.emit({ type: 'list' }); await catalog.save(r);
  let levels = 0; for (let w = W, h = H; ; w = Math.ceil(w / 2), h = Math.ceil(h / 2)) { levels++; if (w <= TS && h <= TS) break; }
  // khối lượng việc theo diện tích để báo tiến độ
  let total = 0, done = 0; for (let l = 0; l < levels; l++) total += Math.ceil(W / 2 ** l) * Math.ceil(H / 2 ** l);
  const gw = Math.ceil(W / CELL), gh = Math.ceil(H / CELL), grid = new Uint8Array(gw * gh).fill(255), L = lut(), cnt = new Uint32Array(5);
  const tile = mkCanvas(TS, TS), tg = tile.getContext('2d');
  for (let l = 0; l < levels; l++) {
    const sl = s / 2 ** l, Wl = Math.ceil(W / 2 ** l), Hl = Math.ceil(H / 2 ** l);
    for (let y0 = 0; y0 < Hl; y0 += CH) for (let x0 = 0; x0 < Wl; x0 += CH) {
      const cw = Math.min(CH, Wl - x0), chh = Math.min(CH, Hl - y0), cv = mkCanvas(cw, chh), g = cv.getContext('2d', { willReadFrequently: l === 0 });
      g.fillStyle = '#fff'; g.fillRect(0, 0, cw, chh);
      await page.render({ canvasContext: g, viewport: page.getViewport({ scale: sl, offsetX: -x0, offsetY: -y0 }), background: 'rgba(255,255,255,1)' }).promise;
      if (l === 0) { // lưới lớp độ sâu: ô CELL×CELL nằm trọn trong khối (CH chia hết cho CELL)
        const d = g.getImageData(0, 0, cw, chh).data;
        for (let cy = 0; cy < Math.ceil(chh / CELL); cy++) for (let cx = 0; cx < Math.ceil(cw / CELL); cx++) {
          cnt.fill(0); const ya = cy * CELL, xa = cx * CELL, yb = Math.min(chh, ya + CELL), xb = Math.min(cw, xa + CELL);
          for (let y = ya; y < yb; y++) for (let x = xa, o = (y * cw + xa) * 4; x < xb; x++, o += 4) { const c = L[((d[o] >> 3) << 10) | ((d[o + 1] >> 3) << 5) | (d[o + 2] >> 3)]; if (c < 5) cnt[c]++; }
          grid[(y0 / CELL + cy) * gw + x0 / CELL + cx] = cellClass(cnt);
        }
      }
      const items = [];
      for (let ty = 0; ty < Math.ceil(chh / TS); ty++) for (let tx = 0; tx < Math.ceil(cw / TS); tx++) {
        tg.fillStyle = '#fff'; tg.fillRect(0, 0, TS, TS);
        const w = Math.min(TS, cw - tx * TS), h = Math.min(TS, chh - ty * TS); tg.drawImage(cv, tx * TS, ty * TS, w, h, 0, 0, w, h);
        items.push({ k: l + '/' + ((x0 / TS) + tx) + '/' + ((y0 / TS) + ty), z: 2, d: await toBlob(tile) });
      }
      await catalog.putTiles(r.id, items);
      done += cw * chh; if (onProgress) onProgress(r, done / total);
    }
  }
  fillUnknown(grid, gw); for (let i = 0; i < grid.length; i++) if (grid[i] === 255) grid[i] = 4;
  await catalog.putGrid(r.id, { gw, gh, cell: CELL, d: grid });
  r.levels = levels; r.ready = true; await catalog.save(r); catalog.emit({ type: 'ready', id: r.id }); catalog.emit({ type: 'list' });
  return r;
}
