// Renderer hải đồ WebGL2 (một context dùng chung, vẽ ngoài màn hình rồi chép sang canvas 2D của từng khung nhìn).
// Mỗi tờ: ô ảnh chỉ số màu (R8UI) tra bảng màu trên GPU (đổi ngày / hoàng hôn / đêm không phải nạp lại), lưới đỉnh nắn theo georef,
// cắt theo đa giác PLY bằng stencil; vẽ từ tờ thô đến tờ chi tiết; ô chưa nạp thì hiện ô mức thô hơn bên dưới.
import earcut from 'earcut';

const VS = `#version 300 es
in vec2 aPos; in vec2 aUv; uniform vec2 uOff; uniform float uInv; uniform vec2 uRot; uniform vec2 uHalf; out vec2 vUv;
void main(){ vec2 p=(aPos+uOff)*uInv; p.y=-p.y; vec2 r=vec2(p.x*uRot.x-p.y*uRot.y, p.x*uRot.y+p.y*uRot.x); gl_Position=vec4(r.x/uHalf.x,-r.y/uHalf.y,0.0,1.0); vUv=aUv; }`;
const FS_IDX = `#version 300 es
precision highp float; precision highp usampler2D; in vec2 vUv; uniform usampler2D uTile; uniform sampler2D uPal; out vec4 o;
void main(){ uint i=texture(uTile,vUv).r; o=texelFetch(uPal,ivec2(int(i),0),0); }`;
const FS_RGBA = `#version 300 es
precision highp float; in vec2 vUv; uniform sampler2D uTile; uniform float uDim; out vec4 o;
void main(){ vec4 c=texture(uTile,vUv); o=vec4(c.rgb*uDim,1.0); }`;
const FS_NONE = `#version 300 es
precision highp float; out vec4 o; void main(){ o=vec4(0.0); }`;
const TS = 256;

export class ChartGL {
  constructor(getTile) {
    this.cv = document.createElement('canvas'); this.cv.width = 4; this.cv.height = 4;
    const gl = this.gl = this.cv.getContext('webgl2', { stencil: true, antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('Máy không hỗ trợ WebGL2');
    this.getTile = getTile; this.onTile = null; this.tiles = new Map(); this.pending = new Set(); this.inflight = 0; this.frame = 0; this.budget = 1800; this.per = new Map();
    const mk = (fs) => { const p = gl.createProgram(); for (const [t, s] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]]) { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); gl.attachShader(p, sh); } gl.bindAttribLocation(p, 0, 'aPos'); gl.bindAttribLocation(p, 1, 'aUv'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); const u = {}; for (const n of ['uOff', 'uInv', 'uRot', 'uHalf', 'uTile', 'uPal', 'uDim']) u[n] = gl.getUniformLocation(p, n); return { p, u }; };
    this.pIdx = mk(FS_IDX); this.pRgba = mk(FS_RGBA); this.pNone = mk(FS_NONE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  }
  // tài nguyên theo từng tờ: bảng màu, đa giác PLY (tam giác hóa), dựng lại khi georef đổi
  chartRes(r, palMode) {
    const gl = this.gl; let e = this.per.get(r.id);
    if (!e || e.ver !== r.ver) {
      if (e) this.dropChart(r.id);
      const C = r.centerMerc, flat = []; for (const [X, Y] of r.plyMerc) flat.push(X - C[0], Y - C[1]);
      const tri = earcut(flat), pos = new Float32Array(tri.length * 4); tri.forEach((i, k) => { pos[k * 4] = flat[i * 2]; pos[k * 4 + 1] = flat[i * 2 + 1]; });
      const vao = gl.createVertexArray(), vbo = gl.createBuffer(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8); gl.bindVertexArray(null);
      e = { ver: r.ver, ply: { vao, vbo, n: tri.length }, pal: {}, };
      this.per.set(r.id, e);
    }
    if (r.fmt !== 'rgba' && !e.pal[palMode]) {
      const src = (r.palettes && (r.palettes[palMode] || r.palettes.day)) || [], d = new Uint8Array(256 * 4);
      for (let i = 0; i < 256; i++) { d[i * 4] = src[i * 3] || 0; d[i * 4 + 1] = src[i * 3 + 1] || 0; d[i * 4 + 2] = src[i * 3 + 2] || 0; d[i * 4 + 3] = 255; }
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); e.pal[palMode] = t;
    }
    return e;
  }
  dropChart(id) {
    const gl = this.gl, e = this.per.get(id);
    if (e) { gl.deleteVertexArray(e.ply.vao); gl.deleteBuffer(e.ply.vbo); for (const t of Object.values(e.pal)) gl.deleteTexture(t); this.per.delete(id); }
    for (const [k, t] of this.tiles) if (k.startsWith(id + '|')) { this.freeTile(t); this.tiles.delete(k); }
  }
  freeTile(t) { const gl = this.gl; gl.deleteTexture(t.tex); gl.deleteVertexArray(t.vao); gl.deleteBuffer(t.vbo); }
  // lưới đỉnh của một ô theo georef (m Mercator so với tâm tờ)
  tileMesh(r, l, tx, ty) {
    const span = TS << l, px0 = tx * span, py0 = ty * span, px1 = Math.min(r.W, px0 + span), py1 = Math.min(r.H, py0 + span);
    const n = r.coef.order === 2 ? 4 : 1, C = r.centerMerc, v = [];
    const P = (i, j) => { const px = px0 + (px1 - px0) * i / n, py = py0 + (py1 - py0) * j / n, m = r.xf.pxToMerc(px, py); return [m[0] - C[0], m[1] - C[1], (px - px0) / span, (py - py0) / span]; };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = P(i, j), b = P(i + 1, j), c = P(i, j + 1), d = P(i + 1, j + 1); v.push(...a, ...b, ...c, ...b, ...d, ...c); }
    return new Float32Array(v);
  }
  request(r, l, tx, ty, key) {
    if (this.pending.has(key) || this.inflight > 16) return;
    this.pending.add(key); this.inflight++;
    this.getTile(r.id, l, tx, ty).then((d) => {
      this.inflight--; this.pending.delete(key); if (!d || !this.per.has(r.id)) return;
      const gl = this.gl, rgba = r.fmt === 'rgba', tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      if (rgba) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, TS, TS, 0, gl.RGBA, gl.UNSIGNED_BYTE, d); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); }
      else { gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, TS, TS, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, d); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const mesh = this.tileMesh(r, l, tx, ty), vao = gl.createVertexArray(), vbo = gl.createBuffer(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8); gl.bindVertexArray(null);
      this.tiles.set(key, { tex, vao, vbo, n: mesh.length / 4, last: this.frame, ver: r.ver });
      if (this.tiles.size > this.budget) this.evict();
      if (this.onTile) this.onTile();
    }).catch(() => { this.inflight--; this.pending.delete(key); });
  }
  evict() { const arr = [...this.tiles.entries()].sort((a, b) => a[1].last - b[1].last); for (let i = 0; i < arr.length * 0.25; i++) { this.freeTile(arr[i][1]); this.tiles.delete(arr[i][0]); } }
  // vp: { cX, cY, mpp (m Mercator / px), rot, w, h, poly (4 góc Mercator) }; list: tờ theo thứ tự thô → chi tiết
  render(vp, list, opt = {}) {
    const gl = this.gl, w = Math.max(1, vp.w | 0), h = Math.max(1, vp.h | 0); this.frame++;
    if (this.cv.width < w || this.cv.height < h) { this.cv.width = Math.max(this.cv.width, w); this.cv.height = Math.max(this.cv.height, h); }
    gl.viewport(0, 0, w, h); const bg = opt.bg || [0.82, 0.9, 0.94];
    gl.disable(gl.SCISSOR_TEST); gl.clearColor(bg[0], bg[1], bg[2], 1); gl.clearStencil(0); gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    gl.enable(gl.STENCIL_TEST); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    const palMode = opt.palette || 'day', cr = Math.cos(vp.rot), sr = Math.sin(vp.rot), dim = palMode === 'night' ? 0.32 : palMode === 'dusk' ? 0.65 : 1;
    let ref = 1;
    for (const r of list) {
      if (!r.coef || !r.levels) continue;
      const e = this.chartRes(r, palMode), off = [r.centerMerc[0] - vp.cX, r.centerMerc[1] - vp.cY];
      const setU = (P) => { gl.useProgram(P.p); gl.uniform2f(P.u.uOff, off[0], off[1]); gl.uniform1f(P.u.uInv, 1 / vp.mpp); gl.uniform2f(P.u.uRot, cr, sr); gl.uniform2f(P.u.uHalf, w / 2, h / 2); };
      // 1) ghi đa giác PLY vào stencil
      setU(this.pNone); gl.colorMask(false, false, false, false); gl.stencilFunc(gl.ALWAYS, ref, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
      gl.bindVertexArray(e.ply.vao); gl.drawArrays(gl.TRIANGLES, 0, e.ply.n);
      gl.colorMask(true, true, true, true); gl.stencilFunc(gl.EQUAL, ref, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
      // 2) các ô ảnh: chọn mức theo tỷ lệ, vẽ mức thô trước làm nền khi ô chi tiết chưa nạp
      const P = r.fmt === 'rgba' ? this.pRgba : this.pIdx; setU(P);
      gl.activeTexture(gl.TEXTURE0); gl.uniform1i(P.u.uTile, 0);
      if (r.fmt === 'rgba') gl.uniform1f(P.u.uDim, dim); else { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, e.pal[palMode]); gl.uniform1i(P.u.uPal, 1); gl.activeTexture(gl.TEXTURE0); }
      const L = Math.max(0, Math.min(r.levels - 1, Math.floor(Math.log2(Math.max(1e-9, vp.mpp / r.mppMerc)) + 0.3)));
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [X, Y] of vp.poly) { const [px, py] = r.xf.mercToPx(X, Y); x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }
      x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(r.W, x1); y1 = Math.min(r.H, y1);
      if (x1 > x0 && y1 > y0) {
        for (let l = Math.min(r.levels - 1, L + 4); l >= L; l--) {
          const span = TS << l, tx0 = Math.floor(x0 / span), tx1 = Math.floor((x1 - 1e-6) / span), ty0 = Math.floor(y0 / span), ty1 = Math.floor((y1 - 1e-6) / span);
          if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 600) continue;
          for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
            const key = r.id + '|' + l + '|' + tx + '|' + ty, t = this.tiles.get(key);
            if (t && t.ver === r.ver) { t.last = this.frame; gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.bindVertexArray(t.vao); gl.drawArrays(gl.TRIANGLES, 0, t.n); }
            else { if (t) { this.freeTile(t); this.tiles.delete(key); } if (l === L || l === r.levels - 1 || l === Math.min(r.levels - 1, L + 2)) this.request(r, l, tx, ty, key); }
          }
        }
      }
      ref = ref % 255 + 1; if (ref === 1) gl.clear(gl.STENCIL_BUFFER_BIT);
    }
    gl.bindVertexArray(null); gl.disable(gl.STENCIL_TEST);
    return { canvas: this.cv, w, h };
  }
}
