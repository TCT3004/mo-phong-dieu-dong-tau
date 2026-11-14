// Đọc hải đồ raster BSB/KAP (OpenCPN). Trả về ảnh chỉ số màu + bảng màu + tọa độ + lưới phân lớp độ sâu.
export const CELL = 4; // số pixel hải đồ cho một ô lưới độ sâu
// lớp: 0 đất, 1 bãi cạn hở (xanh lá), 2 nông (xanh đậm), 3 nông vừa (xanh nhạt), 4 sâu (trắng)

export function parseKapHeader(bytes) {
  let end = bytes.indexOf(0x1a);
  if (end < 0) throw new Error('Không phải file KAP');
  const txt = new TextDecoder('latin1').decode(bytes.subarray(0, end));
  if (txt.indexOf('RA=') < 0) throw new Error('File KAP thiếu thông tin ảnh');
  const lines = [];
  for (const raw of txt.replace(/\r/g, '').split('\n')) {
    if (/^\s{2,}/.test(raw) && lines.length) lines[lines.length - 1] += ',' + raw.trim(); else lines.push(raw.trim());
  }
  const H = { name: '', scale: 0, W: 0, H: 0, pal: new Uint8Array(256 * 3), refs: [], datum: '', sd: '', ed: '', end };
  for (const ln of lines) {
    if (ln.startsWith('BSB/') || ln.startsWith('NOS/')) {
      const m = /RA=(\d+),(\d+)/.exec(ln); if (m) { H.W = +m[1]; H.H = +m[2]; }
      const n = /NA=([^,]*)/.exec(ln); if (n) H.name = n[1].trim();
      const u = /NU=([^,]*)/.exec(ln); if (u) H.nu = u[1].trim();
    } else if (ln.startsWith('KNP/')) {
      const s = /SC=(\d+)/.exec(ln); if (s) H.scale = +s[1];
      const g = /GD=([^,]*)/.exec(ln); if (g) H.datum = g[1];
      const sd = /SD=([^,]*)/.exec(ln); if (sd) H.sd = sd[1];
    } else if (ln.startsWith('CED/')) { const e = /ED=([^,]*)/.exec(ln); if (e) H.ed = e[1]; }
    else if (ln.startsWith('RGB/')) { const a = ln.slice(4).split(',').map(Number); if (a[0] < 256) H.pal.set([a[1], a[2], a[3]], a[0] * 3); }
    else if (ln.startsWith('REF/')) { const a = ln.slice(4).split(',').map(Number); H.refs.push({ x: a[1], y: a[2], lat: a[3], lon: a[4] }); }
  }
  if (!H.W || !H.H) throw new Error('Không đọc được kích thước ảnh');
  return H;
}

const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
const invMerc = (y) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI;
function fit(xs, ys) {
  const n = xs.length; let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; }
  const b = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1); return [(sy - b * sx) / n, b];
}

export function makeGeo(H) {
  const g = { ok: H.refs.length >= 2 };
  if (g.ok) {
    [g.lon0, g.dlon] = fit(H.refs.map((r) => r.x), H.refs.map((r) => r.lon));
    [g.my0, g.dmy] = fit(H.refs.map((r) => r.y), H.refs.map((r) => mercY(r.lat)));
    if (!g.dlon || !g.dmy) g.ok = false;
  }
  if (!g.ok) { g.lon0 = 0; g.dlon = 1e-5; g.my0 = 0; g.dmy = -1.7e-7; }
  const latMid = invMerc(g.my0 + g.dmy * H.H / 2);
  g.mpp = 6371000 * Math.cos(latMid * Math.PI / 180) * Math.abs(g.dlon) * Math.PI / 180; // mét / pixel
  g.W = H.W; g.H = H.H;
  return g;
}
// pixel hải đồ <-> mét (x Đông, y Bắc, gốc ở giữa hải đồ) <-> kinh vĩ
export const pxToM = (g, px, py) => [(px - g.W / 2) * g.mpp, -(py - g.H / 2) * g.mpp];
export const mToPx = (g, x, y) => [x / g.mpp + g.W / 2, -y / g.mpp + g.H / 2];
export const pxToLL = (g, px, py) => [invMerc(g.my0 + g.dmy * py), g.lon0 + g.dlon * px];
export const llToPx = (g, lat, lon) => [(lon - g.lon0) / g.dlon, (mercY(lat) - g.my0) / g.dmy];
export function fmtLL(lat, lon) {
  const f = (v, p, n) => { const a = Math.abs(v), d = Math.floor(a), m = (a - d) * 60; return d + '°' + m.toFixed(2).padStart(5, '0').replace('.', ',') + "'" + (v >= 0 ? p : n); };
  return f(lat, 'N', 'S') + ' ' + f(lon, 'E', 'W');
}

function classLut(pal) {
  const lut = new Uint8Array(256).fill(255);
  for (let i = 0; i < 256; i++) {
    const r = pal[i * 3], g = pal[i * 3 + 1], b = pal[i * 3 + 2];
    if (Math.min(r, g, b) >= 235) lut[i] = 4;
    else if (r > 200 && g > 180 && b < 175) lut[i] = 0;
    else if (g > r + 15 && g > b + 10) lut[i] = 1;
    else if (b >= 215 && g >= 215 && r >= 185) lut[i] = 3;
    else if (b >= 190 && g >= 190 && r < 185) lut[i] = 2;
  }
  return lut;
}

// Giải mã ảnh; onProgress(0..1). Trả về { header, geo, idx(Uint8Array W*H), pal, grid(Uint8Array), gw, gh }
export async function decodeKap(bytes, onProgress) {
  const H = parseKapHeader(bytes);
  let pos = H.end + 1;
  while (bytes[pos] === 0 && pos < H.end + 4) pos++;
  const depth = bytes[pos++];
  if (!(depth >= 1 && depth <= 7)) throw new Error('Ảnh KAP không hợp lệ (độ sâu màu ' + depth + ')');
  const W = H.W, Hh = H.H, idx = new Uint8Array(W * Hh);
  const shift = 7 - depth, vmask = ((1 << depth) - 1) << shift, cmask = (1 << shift) - 1;
  const len = bytes.length;
  let p = pos, rows = 0;
  for (let y = 0; y < Hh && p < len; y++) {
    while (p < len && (bytes[p++] & 0x80)); // số dòng
    let x = 0; const base = y * W; let b = bytes[p++];
    while (b !== 0 && p <= len) {
      const v = (b & vmask) >> shift; let c = b & cmask;
      while (b & 0x80) { b = bytes[p++]; c = c * 128 + (b & 0x7f); }
      let e = x + c + 1; if (e > W) e = W;
      if (v) idx.fill(v, base + x, base + e);
      x = e; b = bytes[p++];
    }
    rows++;
    if ((y & 255) === 0 && onProgress) { onProgress(0.8 * y / Hh); await new Promise((r) => setTimeout(r, 0)); }
  }
  if (rows < Hh * 0.9) throw new Error('File KAP bị thiếu dữ liệu ảnh (chỉ đọc được ' + rows + '/' + Hh + ' dòng)');
  // lưới phân lớp
  const lut = classLut(H.pal), gw = Math.ceil(W / CELL), gh = Math.ceil(Hh / CELL), grid = new Uint8Array(gw * gh);
  const cnt = new Uint8Array(5);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      cnt.fill(0);
      const y1 = Math.min(Hh, (gy + 1) * CELL), x1 = Math.min(W, (gx + 1) * CELL);
      for (let y = gy * CELL; y < y1; y++) { const o = y * W; for (let x = gx * CELL; x < x1; x++) { const c = lut[idx[o + x]]; if (c < 5) cnt[c]++; } }
      const tot = cnt[0] + cnt[1] + cnt[2] + cnt[3] + cnt[4];
      let best = 255;
      if (tot) {
        if ((cnt[0] + cnt[1]) * 3 > tot) best = cnt[0] >= cnt[1] ? 0 : 1;
        else { best = 4; let bc = cnt[4]; for (let k = 2; k <= 3; k++) if (cnt[k] > bc) { bc = cnt[k]; best = k; } }
      }
      grid[gy * gw + gx] = best;
    }
    if ((gy & 127) === 0 && onProgress) { onProgress(0.8 + 0.2 * gy / gh); await new Promise((r) => setTimeout(r, 0)); }
  }
  // ô toàn chữ/nét (255): lấy theo ô bên trái hoặc bên trên
  for (let i = 0; i < grid.length; i++) if (grid[i] === 255) grid[i] = i % gw ? grid[i - 1] : (i >= gw ? grid[i - gw] : 4);
  for (let i = 0; i < grid.length; i++) if (grid[i] === 255) grid[i] = 4;
  if (onProgress) onProgress(1);
  return { name: H.name || 'Hải đồ', header: H, geo: makeGeo(H), idx, pal: H.pal, grid, gw, gh, W, H: Hh };
}
