// Nhận dạng chữ số trên hải đồ raster: nắn chữ nghiêng, đặc trưng 24×24 mờ chuẩn hóa, so với tâm cụm mẫu (kNN có trọng số).
// Số đo sâu: chữ nghiêng (mẫu ITALIC, có lớp «x» = không phải chữ số). Độ cao: chữ đứng (mẫu UPRIGHT + số lỗ kín).
import { ITALIC, UPRIGHT, SLANT } from './digit_tpl.js';

export const INK = 110;           // độ đậm (255 − độ sáng) coi là mực
export { SLANT };
const GK = [0.0545, 0.2442, 0.4026, 0.2442, 0.0545];

function b64bytes(s) {
  const T = new Int16Array(128).fill(-1), A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < 64; i++) T[A.charCodeAt(i)] = i;
  const n = s.replace(/=+$/, '').length, out = new Uint8Array((n * 3) >> 2); let o = 0, acc = 0, bits = 0;
  for (let i = 0; i < n; i++) { acc = (acc << 6) | T[s.charCodeAt(i)]; bits += 6; if (bits >= 8) { bits -= 8; out[o++] = (acc >> bits) & 255; } }
  return out;
}
async function inflate(u8) {
  const s = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function decodeSet(S) {
  const raw = await inflate(b64bytes(S.b64)), dim = 576, n = S.n, C = new Float32Array(n * dim), i8 = new Int8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  for (let k = 0; k < n; k++) {
    let m = 0; for (let j = 0; j < dim; j++) m += i8[k * dim + j]; m /= dim;
    let nn = 0; for (let j = 0; j < dim; j++) { const v = i8[k * dim + j] - m; C[k * dim + j] = v; nn += v * v; }
    nn = Math.sqrt(nn) || 1; for (let j = 0; j < dim; j++) C[k * dim + j] /= nn;
  }
  return { C, n, cls: S.cls, asp: Float32Array.from(S.asp) };
}
let TPL = null;
export async function loadTemplates() { if (!TPL) TPL = { it: await decodeSet(ITALIC), up: await decodeSet(UPRIGHT) }; return TPL; }
// ảnh 24×24 của một mẫu (dùng cho kiểm thử: dựng lại chữ số từ mẫu)
export function templateImage(c, set = 'it') {
  const S = TPL[set], js = []; for (let j = 0; j < S.n; j++) if (S.cls[j] === c) js.push(j); if (!js.length) return null;
  let best = js[0], bs = -1e9; // mẫu «điển hình» nhất của lớp: giống các mẫu cùng lớp nhất
  for (const a of js) { let s = 0; for (const b of js) { let d = 0; for (let i = 0; i < 576; i++) d += S.C[a * 576 + i] * S.C[b * 576 + i]; s += d; } if (s > bs) { bs = s; best = a; } }
  return S.C.subarray(best * 576, best * 576 + 576);
}

// nắn chữ nghiêng: hàng trên dời sang trái s điểm ảnh mỗi hàng (nội suy tuyến tính theo x). img: độ đậm w×h → { d, w, h, off }
export function deshear(img, w, h, s = SLANT) {
  const off = Math.ceil(s * h) + 1, W2 = w + off + 1, out = new Float32Array(W2 * h), yb = h - 1;
  for (let y = 0; y < h; y++) {
    const sh = -off + s * (yb - y), ro = y * w, oo = y * W2;
    for (let x = 0; x < W2; x++) {
      const sx = x + sh, x0 = Math.floor(sx), f = sx - x0;
      const a = x0 >= 0 && x0 < w ? img[ro + x0] : 0, b = x0 + 1 >= 0 && x0 + 1 < w ? img[ro + x0 + 1] : 0;
      out[oo + x] = a * (1 - f) + b * f;
    }
  }
  return { d: out, w: W2, h, off };
}

function areaResize(a, w, h, W2, H2) {
  const out = new Float32Array(W2 * H2), sy = h / H2, sx = w / W2;
  for (let j = 0; j < H2; j++) {
    const y0 = j * sy, y1 = (j + 1) * sy;
    for (let i = 0; i < W2; i++) {
      const x0 = i * sx, x1 = (i + 1) * sx; let acc = 0, ar = 0;
      for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) {
        const wy = Math.min(y1, yy + 1) - Math.max(y0, yy); if (wy <= 0 || yy >= h) continue;
        for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
          const wx = Math.min(x1, xx + 1) - Math.max(x0, xx); if (wx <= 0 || xx >= w) continue;
          acc += a[yy * w + xx] * wx * wy; ar += wx * wy;
        }
      }
      out[j * W2 + i] = ar ? acc / ar : 0;
    }
  }
  return out;
}
// đặc trưng: cắt theo khung mực → cao 20, rộng ≤ 24 giữ tỷ lệ, đặt giữa ô 24×24, mờ Gauss 5 điểm, trừ trung bình, chuẩn hóa
export function feature(img, w, h) {
  let xa = w, ya = h, xb = -1, yb = -1, cnt = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (img[y * w + x] > INK) { cnt++; if (x < xa) xa = x; if (x > xb) xb = x; if (y < ya) ya = y; if (y > yb) yb = y; }
  if (cnt < 4) return null;
  const cw = xb - xa + 1, ch = yb - ya + 1, q = new Float32Array(cw * ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) q[y * cw + x] = img[(y + ya) * w + x + xa] / 255;
  const nw = Math.max(1, Math.min(24, Math.round(cw * 20 / ch))), r = areaResize(q, cw, ch, nw, 20);
  const o = new Float32Array(576), cx = (24 - nw) >> 1;
  for (let y = 0; y < 20; y++) for (let x = 0; x < nw; x++) o[(y + 2) * 24 + cx + x] = r[y * nw + x];
  const t = new Float32Array(576), u = new Float32Array(576);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) { let a = 0; for (let k = 0; k < 5; k++) { const xx = x + k - 2; if (xx >= 0 && xx < 24) a += GK[k] * o[y * 24 + xx]; } t[y * 24 + x] = a; }
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) { let a = 0; for (let k = 0; k < 5; k++) { const yy = y + k - 2; if (yy >= 0 && yy < 24) a += GK[k] * t[yy * 24 + x]; } u[y * 24 + x] = a; }
  let m = 0; for (let i = 0; i < 576; i++) m += u[i]; m /= 576;
  let n = 0; for (let i = 0; i < 576; i++) { u[i] -= m; n += u[i] * u[i]; } n = Math.sqrt(n) || 1e-6;
  for (let i = 0; i < 576; i++) u[i] /= n;
  return { v: u, asp: cw / ch, cw, ch };
}
function knn(S, f, lam, k, allow) {
  const { C, n, cls, asp } = S, sc = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    if (allow && allow.indexOf(cls[j]) < 0) { sc[j] = -9; continue; }
    let d = 0; const o = j * 576; for (let i = 0; i < 576; i++) d += C[o + i] * f.v[i];
    sc[j] = d - lam * Math.abs(asp[j] - f.asp);
  }
  const top = []; for (let j = 0; j < n; j++) { if (top.length < k) { top.push(j); top.sort((a, b) => sc[b] - sc[a]); } else if (sc[j] > sc[top[k - 1]]) { top[k - 1] = j; top.sort((a, b) => sc[b] - sc[a]); } }
  const votes = {}; for (const j of top) votes[cls[j]] = (votes[cls[j]] || 0) + sc[j];
  let best = null; for (const c in votes) if (best === null || votes[c] > votes[best]) best = c;
  const same = top.filter((j) => cls[j] === best).length;
  return { c: best, conf: same / top.length, sim: Math.max(...top.filter((j) => cls[j] === best).map((j) => sc[j])) };
}
// chữ số nghiêng (đã nắn) → { c: '0'..'9' | 'x', conf, sim }
export function classifyItalic(img, w, h) {
  const f = feature(img, w, h); if (!f) return { c: 'x', conf: 0, sim: 0, h: 0 };
  const r = knn(TPL.it, f, 0.5, 5); r.h = f.ch; r.asp = f.asp; return r;
}
// số lỗ kín (đóng nét chỗ hở 1 điểm ảnh) và vị trí theo chiều cao 0..1
export function holes(img, w, h) {
  const W = w + 4, H = h + 4, b = new Uint8Array(W * H);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (img[y * w + x] > INK) b[(y + 2) * W + x + 2] = 1;
  const seen = new Uint8Array(W * H), out = [], st = [];
  for (let s0 = 0; s0 < W * H; s0++) {
    if (b[s0] || seen[s0]) continue;
    let edge = false, area = 0, sy = 0; st.push(s0); seen[s0] = 1;
    while (st.length) { const i = st.pop(), x = i % W, y = (i / W) | 0; area++; sy += y; if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true;
      for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < W * H && !b[j] && !seen[j] && !(Math.abs((j % W) - x) > 1)) { seen[j] = 1; st.push(j); } }
    if (!edge && area >= 3) out.push((sy / area - 2) / h);
  }
  return out.sort((a, b2) => a - b2);
}
// chữ số đứng (độ cao) → { c, sim } ; số 1 là thanh hẹp; số lỗ kín giới hạn lớp (8 hai lỗ, 6 lỗ dưới, 9 lỗ trên, 0 / 4 lỗ giữa)
export function classifyUpright(img, w, h) {
  const f = feature(img, w, h); if (!f) return null;
  if (f.asp < 0.42) return { c: '1', sim: 0.9 };
  const hs = holes(img, w, h);
  const allow = hs.length === 0 ? '12357' : hs.length >= 2 ? '8' : hs[0] < 0.42 ? '98' : hs[0] > 0.58 ? '68' : '04';
  const r = knn(TPL.up, f, 0.6, 1, allow); return { c: r.c, sim: r.sim };
}
