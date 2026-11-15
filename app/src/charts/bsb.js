// Đọc hải đồ BSB/KAP: header đầy đủ (REF, PLY, DTM, datum, phép chiếu, 3 bảng màu ngày/hoàng hôn/đêm) và giải mã ảnh chỉ số màu.
// Module thuần: dùng được trong worker và trong Node (kiểm thử).
export const CELL = 4; // số pixel hải đồ cho một ô lưới phân lớp độ sâu
// lớp: 0 đất, 1 bãi cạn hở, 2 nông (xanh đậm), 3 nông vừa (xanh nhạt), 4 sâu (trắng), 255 chưa rõ

export function parseBsb(bytes) {
  const end = bytes.indexOf(0x1a);
  if (end < 0) throw new Error('Không phải file KAP');
  const txt = new TextDecoder('latin1').decode(bytes.subarray(0, end));
  if (txt.indexOf('RA=') < 0) throw new Error('File KAP thiếu thông tin ảnh');
  const lines = [];
  for (const raw of txt.replace(/\r/g, '').split('\n')) {
    if (/^\s{2,}/.test(raw) && lines.length) lines[lines.length - 1] += ',' + raw.trim(); else lines.push(raw.trim());
  }
  const H = { name: '', nu: '', scale: 0, W: 0, H: 0, datumSrc: '', proj: 'MERCATOR', pp: null, sd: '', ed: '', refs: [], ply: [], dtm: null, end,
    pal: { day: null, dusk: null, night: null, rgb: null } };
  const pal = (k) => H.pal[k] || (H.pal[k] = new Uint8Array(256 * 3));
  const kv = (ln, k) => { const m = new RegExp('(?:^|[/,])' + k + '=([^,]*)').exec(ln); return m ? m[1].trim() : null; };
  for (const ln of lines) {
    const tag = ln.slice(0, 4), body = ln.slice(4);
    if (tag === 'BSB/' || tag === 'NOS/') {
      const m = /RA=(\d+),(\d+)/.exec(ln); if (m) { H.W = +m[1]; H.H = +m[2]; }
      const n = kv(ln, 'NA'); if (n !== null) H.name = n;
      const u = kv(ln, 'NU'); if (u !== null) H.nu = u;
    } else if (tag === 'KNP/') {
      const s = kv(ln, 'SC'); if (s) H.scale = +s;
      const g = kv(ln, 'GD'); if (g) H.datumSrc = g;
      const p = kv(ln, 'PR'); if (p) H.proj = p.toUpperCase().replace(/[^A-Z]/g, '');
      const q = kv(ln, 'PP'); if (q && isFinite(+q)) H.pp = +q;
      const d = kv(ln, 'SD'); if (d) H.sd = d;
    } else if (tag === 'CED/') { const e = kv(ln, 'ED'); if (e) H.ed = e; }
    else if (tag === 'REF/') { const a = body.split(',').map(Number); if (a.length >= 5 && a.every(isFinite)) H.refs.push({ x: a[1], y: a[2], lat: a[3], lon: a[4] }); }
    else if (tag === 'PLY/') { const a = body.split(',').map(Number); if (a.length >= 3 && isFinite(a[1]) && isFinite(a[2])) H.ply.push([a[1], a[2]]); }
    else if (tag === 'DTM/') { const a = body.split(',').map(Number); if (a.length >= 2 && a.every(isFinite) && (a[0] || a[1])) H.dtm = [a[0], a[1]]; }
    else if (tag === 'RGB/' || tag === 'DAY/' || tag === 'DSK/' || tag === 'NGT/') {
      const a = body.split(',').map(Number); if (a.length < 4 || !(a[0] >= 0 && a[0] < 256)) continue;
      pal({ 'RGB/': 'rgb', 'DAY/': 'day', 'DSK/': 'dusk', 'NGT/': 'night' }[tag]).set([a[1], a[2], a[3]], a[0] * 3);
    }
  }
  if (!H.W || !H.H) throw new Error('Không đọc được kích thước ảnh');
  const base = H.pal.day || H.pal.rgb || new Uint8Array(768);
  H.pal.day = base; H.pal.dusk = H.pal.dusk || dim(base, 0.62); H.pal.night = H.pal.night || dim(base, 0.3);
  delete H.pal.rgb;
  return H;
}
const dim = (p, k) => p.map((v) => Math.round(v * k));

// giải mã toàn bộ ảnh → chỉ số màu W×H; onProgress(0..1)
export function decodeBsb(bytes, H, onProgress) {
  let pos = H.end + 1;
  while (bytes[pos] === 0 && pos < H.end + 4) pos++;
  const depth = bytes[pos++];
  if (!(depth >= 1 && depth <= 7)) throw new Error('Ảnh KAP không hợp lệ (độ sâu màu ' + depth + ')');
  const W = H.W, Hh = H.H, idx = new Uint8Array(W * Hh);
  const shift = 7 - depth, vmask = ((1 << depth) - 1) << shift, cmask = (1 << shift) - 1, len = bytes.length;
  let p = pos, rows = 0;
  for (let y = 0; y < Hh && p < len; y++) {
    while (p < len && (bytes[p++] & 0x80));
    let x = 0; const base = y * W; let b = bytes[p++];
    while (b !== 0 && p <= len) {
      const v = (b & vmask) >> shift; let c = b & cmask;
      while (b & 0x80) { b = bytes[p++]; c = c * 128 + (b & 0x7f); }
      let e = x + c + 1; if (e > W) e = W;
      if (v) idx.fill(v, base + x, base + e);
      x = e; b = bytes[p++];
    }
    rows++;
    if (onProgress && (y & 511) === 0) onProgress(y / Hh);
  }
  if (rows < Hh * 0.9) throw new Error('File KAP bị thiếu dữ liệu ảnh (chỉ đọc được ' + rows + '/' + Hh + ' dòng)');
  return idx;
}

// bảng tra màu → lớp độ sâu (theo màu ngày)
export function classLut(pal) {
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
// phân lớp theo sắc màu cho hải đồ PDF / ảnh màu thật (không có bảng màu BSB): trắng → sâu, xanh lơ / xanh dương → nông,
// xanh lá → bãi cạn hở, vàng / be / nâu nhạt → đất; nét tối, đỏ, tím… → 255 (không rõ, lấy theo ô bên cạnh)
export function classOfRgb(r, g, b) {
  const mn = Math.min(r, g, b), mx = Math.max(r, g, b);
  if (mn >= 236 && mx - mn < 14) return 4;
  if (mx < 150) return 255;
  if (g > r + 15 && g > b + 10) return 1;
  if (b > r + 10 && g > r) return b - r > 45 ? 2 : 3;
  if (r >= g && g >= b && r > 200 && g > 150 && r - b > 15 && r - b < 140) return 0;
  return 255;
}
// đếm lớp trong một ô → lớp chiếm ưu thế (đất / bãi cạn ưu tiên khi chiếm ≥ 1/3); cnt[0..4]
export function cellClass(cnt) {
  const tot = cnt[0] + cnt[1] + cnt[2] + cnt[3] + cnt[4]; if (!tot) return 255;
  if ((cnt[0] + cnt[1]) * 3 > tot) return cnt[0] >= cnt[1] ? 0 : 1;
  let best = 4, bc = cnt[4]; for (let k = 2; k <= 3; k++) if (cnt[k] > bc) { bc = cnt[k]; best = k; }
  return best;
}
// ô chưa rõ lớp (toàn chữ / nét): lấy theo ô bên trái hoặc bên trên
export function fillUnknown(grid, gw) { for (let i = 0; i < grid.length; i++) if (grid[i] === 255) grid[i] = i % gw ? grid[i - 1] : (i >= gw ? grid[i - gw] : 255); }
// lưới phân lớp độ sâu: mỗi ô CELL×CELL pixel → lớp chiếm ưu thế (đất / bãi cạn ưu tiên khi chiếm ≥ 1/3)
export function buildGrid(idx, W, H, pal, cell = CELL) {
  const lut = classLut(pal), gw = Math.ceil(W / cell), gh = Math.ceil(H / cell), grid = new Uint8Array(gw * gh), cnt = new Uint32Array(5);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    cnt.fill(0); const y1 = Math.min(H, (gy + 1) * cell), x1 = Math.min(W, (gx + 1) * cell);
    for (let y = gy * cell; y < y1; y++) { const o = y * W; for (let x = gx * cell; x < x1; x++) { const c = lut[idx[o + x]]; if (c < 5) cnt[c]++; } }
    const tot = cnt[0] + cnt[1] + cnt[2] + cnt[3] + cnt[4]; let best = 255;
    if (tot) { if ((cnt[0] + cnt[1]) * 3 > tot) best = cnt[0] >= cnt[1] ? 0 : 1; else { best = 4; let bc = cnt[4]; for (let k = 2; k <= 3; k++) if (cnt[k] > bc) { bc = cnt[k]; best = k; } } }
    grid[gy * gw + gx] = best;
  }
  for (let i = 0; i < grid.length; i++) if (grid[i] === 255) grid[i] = i % gw ? grid[i - 1] : (i >= gw ? grid[i - gw] : 255);
  return { grid, gw, gh, cell };
}
