// Cảnh 3D đơn giản: mặt nước, địa hình dựng từ hải đồ, tàu, cầu bến, đèn/phao, dây và xích neo.
import * as THREE from 'three';
import { sampleWorld, DEF_CLASS_DEPTH } from './chartsys.js';
import { body2w } from './world.js';

export const QUALITY = {
  // ter: [nửa vùng mịn (m), bước lưới vùng mịn (m), bước lưới xa nhất (m)]
  low: { ter: [3000, 50, 700], water: 0, pr: 0.75, far: 12000, label: 'Thấp' },
  mid: { ter: [4000, 38, 600], water: 1, pr: 1, far: 20000, label: 'Trung bình' },
  high: { ter: [4500, 30, 500], water: 2, pr: 1, far: 30000, label: 'Cao' },
  max: { ter: [6000, 22, 400], water: 2, pr: Math.min(2, (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1) * 1.25), far: 40000, label: 'Tối đa' }
};
const COL = { W: 0xffffff, R: 0xff3b30, G: 0x30e070, Y: 0xffd60a };

function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.7)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}

export class View3D {
  constructor(canvas, q) {
    this.canvas = canvas; this.q = QUALITY[q] || QUALITY.high; this.qn = q;
    this.r = new THREE.WebGLRenderer({ canvas, antialias: q !== 'low', preserveDrawingBuffer: true });
    this.scene = new THREE.Scene(); this.scene.fog = new THREE.Fog(0x9db8cc, 100, 10000);
    this.cam = new THREE.PerspectiveCamera(55, 2, 0.5, 60000);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 1.2); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.6); this.scene.add(this.sun);
    this.glow = glowTex(); this.time = 0;
    this.look = { yaw: 0, pitch: 0, fov: 55, dist: 1 };
    this.mkWater();
    this.shipG = new THREE.Group(); this.scene.add(this.shipG);
    this.terrain = null; this.objG = new THREE.Group(); this.scene.add(this.objG);
    this.lineG = new THREE.Group(); this.scene.add(this.lineG); this.linePool = [];
    this.marks = []; this.navL = {};
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => { if (!drag) return; this.look.yaw += (e.clientX - drag[0]) * 0.25 * (this.look.fov / 55); this.look.pitch = Math.max(-60, Math.min(60, this.look.pitch + (e.clientY - drag[1]) * 0.2)); drag = [e.clientX, e.clientY]; });
    canvas.addEventListener('pointerup', () => { drag = null; });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); if (this.view === 'top' || this.view === 'follow') this.look.dist = Math.max(0.3, Math.min(6, this.look.dist * (e.deltaY > 0 ? 1.15 : 0.87))); else this.look.fov = Math.max(6, Math.min(75, this.look.fov * (e.deltaY > 0 ? 1.15 : 0.87))); }, { passive: false });
    canvas.addEventListener('dblclick', () => { this.look.yaw = 0; this.look.pitch = 0; this.look.fov = 55; this.look.dist = 1; });
  }
  // Mặt nước: lưới tròn dày ở gần, thưa ở xa, đi theo camera. Sóng Gerstner theo hướng & chiều cao sóng của kịch bản:
  // gần thì mặt nước nhấp nhô thật (đỉnh vertex), xa thì chỉ đổ bóng theo pháp tuyến từng điểm ảnh.
  mkWater() {
    const q = this.q, NT = q.water ? 256 : 128, NR = q.water ? 180 : 110, b = q.water ? 0.045 : 0.07, a = 20000 / (Math.exp(b * NR) - 1);
    const pos = [0, 0, 0], idx = [];
    for (let j = 1; j <= NR; j++) { const r = a * (Math.exp(b * j) - 1); for (let i = 0; i < NT; i++) { const t = i / NT * Math.PI * 2; pos.push(Math.cos(t) * r, 0, Math.sin(t) * r); } }
    for (let i = 0; i < NT; i++) idx.push(0, 1 + (i + 1) % NT, 1 + i);
    for (let j = 1; j < NR; j++) for (let i = 0; i < NT; i++) { const a0 = 1 + (j - 1) * NT + i, a1 = 1 + (j - 1) * NT + (i + 1) % NT, b0 = a0 + NT, b1 = a1 + NT; idx.push(a0, a1, b1, a0, b1, b0); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
    const W8 = () => Array.from({ length: 8 }, () => new THREE.Vector4());
    this.wU = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uDeep: { value: new THREE.Color(0x0d3346) }, uSky: { value: new THREE.Color(0x9db8cc) }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunI: { value: 1 }, uCam: { value: new THREE.Vector3() }, uWd: { value: W8() }, uWa: { value: W8() }, uSp: { value: Math.max(b, 2 * Math.PI / NT) }, uHs: { value: 0.5 }, uSpec: { value: q.water > 1 ? 1 : 0.5 }, uNm: { value: this.mkWaveTex() }, uD2: { value: new THREE.Vector4(1, 0, 0, 1) }, uTile: { value: new THREE.Vector4(60, 20, 3, 1.7) }, uStr: { value: 0.2 } }]);
    const GER = `uniform vec4 uWd[8]; uniform vec4 uWa[8]; uniform float uT;`;
    const mat = new THREE.ShaderMaterial({ uniforms: this.wU, fog: true,
      vertexShader: `#include <common>\n#include <fog_pars_vertex>\n${GER} uniform vec3 uCam; uniform float uSp; varying vec3 vW; varying float vH;
      void main(){ vec4 w=modelMatrix*vec4(position,1.0); vec2 p=w.xz; float r=length(p-uCam.xz), sp=uSp*r+0.3; vec3 d=vec3(0.0);
        for(int i=0;i<8;i++){ vec2 D=uWd[i].xy; float k=uWd[i].z, om=uWd[i].w, L=6.2832/k; float att=1.0-smoothstep(L*0.06,L*0.13,sp); float A=uWa[i].x*att, Q=uWa[i].y;
          float th=k*dot(D,p)-om*uT+uWa[i].z; float c=cos(th); d.x+=Q*A*D.x*c; d.z+=Q*A*D.y*c; d.y+=A*sin(th); }
        w.xyz+=d; vW=w.xyz; vH=d.y; vec4 mvPosition=viewMatrix*w; gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}`,
      fragmentShader: `#include <common>\n#include <fog_pars_fragment>\n${GER} uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uSun; uniform float uSunI; uniform vec3 uCam; uniform float uHs; uniform float uSpec; uniform sampler2D uNm; uniform vec4 uD2; uniform vec4 uTile; uniform float uStr; varying vec3 vW; varying float vH;
      void main(){ vec2 p=vW.xz; float fp=max(length(fwidth(p)),0.02); vec3 N=vec3(0.0);
        for(int i=0;i<8;i++){ vec2 D=uWd[i].xy; float k=uWd[i].z, om=uWd[i].w, L=6.2832/k; float att=1.0-smoothstep(L*0.1,L*0.3,fp); float A=uWa[i].x*att, Q=uWa[i].y;
          float th=k*dot(D,p)-om*uT+uWa[i].z; float c=cos(th); N.x+=D.x*k*A*c; N.z+=D.y*k*A*c; N.y+=Q*k*A*sin(th); }
        // sóng gió nhỏ: 2 lớp texture pháp tuyến (có mipmap nên ở xa tự mịn, không bị sọc), xoay theo hướng sóng, trôi theo vận tốc sóng
        vec2 D=uWd[0].xy, Dp=vec2(-D.y,D.x), E=uD2.xy, Ep=uD2.zw;
        vec2 uv1=(vec2(dot(p,D),dot(p,Dp))-vec2(uTile.z*uT,0.0))/uTile.x, uv2=(vec2(dot(p,E),dot(p,Ep))-vec2(uTile.w*uT,0.0))/uTile.y;
        vec2 g1=texture2D(uNm,uv1).rg*2.0-1.0, g2=texture2D(uNm,uv2+vec2(0.37,0.61)).rg*2.0-1.0;
        vec2 gw=uStr*((g1.x*D+g1.y*Dp)+0.75*(g2.x*E+g2.y*Ep)); N.x+=gw.x; N.z+=gw.y;
        vec3 n=normalize(vec3(-N.x,1.0-N.y,-N.z)); vec3 v=normalize(uCam-vW);
        float f=pow(1.0-max(dot(n,v),0.0),3.0); vec3 c=mix(uDeep,uSky,0.08+0.85*f);
        float crest=clamp(vH/(uHs*0.45+0.05),-1.0,1.0); c*=0.86+0.22*crest; c+=vec3(0.03,0.07,0.07)*max(crest,0.0)*uSunI;
        float foam=smoothstep(1.2,2.6,uHs)*smoothstep(0.55,0.95,crest)*(0.5+0.5*sin(p.x*0.9+p.y*1.3+uT)); c=mix(c,vec3(0.86,0.9,0.92)*(0.35+0.65*uSunI),foam*0.55);
        vec3 h=normalize(v+uSun); c+=uSunI*uSpec*pow(max(dot(n,h),0.0),160.0)*vec3(1.0,0.95,0.8);
        gl_FragColor=vec4(c,1.0);\n#include <fog_fragment>\n}` });
    this.water = new THREE.Mesh(geo, mat); this.water.frustumCulled = false;
    this.scene.add(this.water); this.wKey = '';
  }
  // texture lặp liền: trường độ dốc của sóng gió (nhiều sóng nhỏ quanh trục +u, lệch hướng ±40°)
  mkWaveTex() {
    const N = 256, comps = []; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    while (comps.length < 30) { const m = 3 + Math.floor(rnd() * 22), n = Math.round((rnd() * 2 - 1) * m * 0.75); if (Math.abs(Math.atan2(n, m)) > 0.75) continue; const k = Math.hypot(m, n); comps.push({ m, n, a: Math.pow(k, -1.45), ph: rnd() * 6.283 }); }
    const gx = new Float32Array(N * N), gy = new Float32Array(N * N); let mx = 1e-6;
    for (const c of comps) { const kx = 2 * Math.PI * c.m / N, ky = 2 * Math.PI * c.n / N, s = c.a * 2 * Math.PI; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const cc = Math.cos(kx * x + ky * y + c.ph); gx[y * N + x] += s * c.m * cc; gy[y * N + x] += s * c.n * cc; } }
    for (let i = 0; i < N * N; i++) mx = Math.max(mx, Math.abs(gx[i]), Math.abs(gy[i]));
    const d = new Uint8Array(N * N * 4); for (let i = 0; i < N * N; i++) { d[i * 4] = Math.round(128 + 127 * gx[i] / mx); d[i * 4 + 1] = Math.round(128 + 127 * gy[i] / mx); d[i * 4 + 2] = 128; d[i * 4 + 3] = 255; }
    const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = Math.min(8, this.r.capabilities.getMaxAnisotropy()); t.needsUpdate = true;
    return t;
  }
  // các thành phần sóng: hướng truyền (về), số sóng, tần số, biên độ, độ dốc
  // lenK: hệ số nhân bước sóng (chu kỳ tăng theo căn bậc hai để sóng vẫn đúng quan hệ tán sắc nước sâu)
  setWaves(Hs, fromRad, Tp, lenK = 1) {
    const key = Hs.toFixed(2) + '|' + fromRad.toFixed(3) + '|' + Tp.toFixed(2) + '|' + lenK; if (key === this.wKey) return; this.wKey = key;
    const H = Math.max(Hs, 0.15), to = fromRad + Math.PI, T = Math.max(2.5, Tp || 6), G = 9.81;
    const C = [[0, 1, 0.33], [16, 0.86, 0.2], [-20, 0.9, 0.18], [36, 0.66, 0.12], [-32, 0.6, 0.11], [6, 1.22, 0.1], [-55, 0.45, 0.07], [62, 0.38, 0.06]];
    this.wComp = C.map((c, i) => { const dir = to + c[0] * Math.PI / 180, Ti = T * c[1], k = (2 * Math.PI / Ti) ** 2 / G / lenK, om = Math.sqrt(G * k), A = H * c[2], Q = Math.min(1, 0.7 / (k * A * 8 + 1e-6)); return { dx: Math.sin(dir), dz: -Math.cos(dir), k, om, A, Q, ph: i * 1.7 }; });
    this.wComp.forEach((w, i) => { this.wU.uWd.value[i].set(w.dx, w.dz, w.k, w.om); this.wU.uWa.value[i].set(w.A, w.Q, w.ph, 0); });
    this.wU.uHs.value = H;
    const Lm = 9.81 * T * T / (2 * Math.PI) * lenK, S1 = Math.max(14, 0.9 * Lm), S2 = 0.31 * S1, d2 = to + 0.45, cs = (S) => Math.sqrt(9.81 * (S / 9) / (2 * Math.PI));
    this.wU.uTile.value.set(S1, S2, cs(S1), cs(S2)); this.wU.uD2.value.set(Math.sin(d2), -Math.cos(d2), Math.cos(d2), Math.sin(d2));
    this.wU.uStr.value = Math.min(0.6, 0.1 + 0.17 * Math.max(Hs, 0.05));
  }
  waveH(x, z, t) { let h = 0; if (this.wComp) for (const w of this.wComp) h += w.A * Math.sin(w.k * (w.dx * x + w.dz * z) - w.om * t + w.ph); return h; }
  buildShip(M, anchors) {
    const g = this.shipG; g.clear();
    const L = M.loa, B = M.B, D = +M.p.D || M.d * 1.6, T = M.d, fb = D - T;
    const sh = new THREE.Shape(); const hb = B / 2, bow = L / 2, st = -L / 2;
    sh.moveTo(-hb, st + 2); sh.lineTo(-hb, bow - L * 0.2); sh.quadraticCurveTo(-hb * 0.7, bow - L * 0.06, 0, bow); sh.quadraticCurveTo(hb * 0.7, bow - L * 0.06, hb, bow - L * 0.2); sh.lineTo(hb, st + 2); sh.quadraticCurveTo(hb * 0.8, st, 0, st); sh.quadraticCurveTo(-hb * 0.8, st, -hb, st + 2);
    const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: D, bevelEnabled: false }), [new THREE.MeshLambertMaterial({ color: 0x4a5560 }), new THREE.MeshLambertMaterial({ color: 0x1c2733 })]);
    hull.rotation.x = -Math.PI / 2; hull.position.y = -T; g.add(hull);
    const box = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c })); m.position.set(x, y, z); g.add(m); return m; };
    // z của mesh = -x thân tàu (mũi về -z)
    const sl = L * 0.16, sx = -L / 2 + L * 0.06 + sl / 2, shh = Math.max(9, B * 0.6);
    box(B * 0.9, shh, sl, 0xe8ecef, 0, fb + shh / 2, -sx);
    box(B * 1.05, 0.6, sl * 0.5, 0xd0d6da, 0, fb + shh - 2.6, -(sx + sl * 0.2));
    box(B * 0.25, 5, sl * 0.3, 0x2b3a47, 0, fb + shh + 2.5, -(sx - sl * 0.25));
    const hl = (L / 2 - L * 0.24 - (sx + sl / 2)) / 3;
    for (let i = 0; i < 3; i++) box(B * 0.66, 1.6, hl * 0.85, 0x6f7c86, 0, fb + 0.8, -(sx + sl / 2 + hl * (i + 0.5) + 2));
    box(B * 0.5, 2.2, L * 0.1, 0x55626d, 0, fb + 1.1, -(L / 2 - L * 0.11));
    const fmx = L * 0.3, fmh = Math.min(12, Math.max(8, B * 0.6)); const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, fmh, 8), new THREE.MeshLambertMaterial({ color: 0xc9d2d8 })); mast.position.set(0, fb + fmh / 2, -fmx); g.add(mast); // cột trước đứng trên boong chính, sau thượng tầng mũi
    const mast2 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 7, 6), new THREE.MeshLambertMaterial({ color: 0xc9d2d8 })); mast2.position.set(0, fb + shh + 3.5, -(sx + sl * 0.1)); g.add(mast2);
    this.dim = { L, B, fb, shh, bridgeX: sx + sl / 2 + 0.6, eye: fb + shh - 1.6 };
    const lp = (c, x, y, z, s) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: c, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.position.set(x, y, z); sp.scale.setScalar(s || 5); sp.visible = false; g.add(sp); return sp; };
    const bz = -(sx + sl * 0.3);
    this.navL = { mast1: [lp(COL.W, 0, fb + fmh + 0.3, -fmx)], mast2: [lp(COL.W, 0, fb + shh + 7, -(sx + sl * 0.1))], sideP: [lp(COL.R, -B * 0.52, fb + shh - 2, bz, 4)], sideS: [lp(COL.G, B * 0.52, fb + shh - 2, bz, 4)],
      stern: [lp(COL.W, 0, fb + 3, L / 2 - 0.5, 4)], anchF: [lp(COL.W, 0, fb + 9, -(L / 2 - 2))], anchA: [lp(COL.W, 0, fb + 5, L / 2 - 1.5)],
      deck: [lp(0xffe08a, 0, fb + 6, -L * 0.15, 9), lp(0xffe08a, 0, fb + 6, -L * 0.3, 9), lp(0xffe08a, 0, fb + 6, 0, 9)], nuc: [lp(COL.R, 0, fb + shh + 6, -(sx + sl * 0.1), 4), lp(COL.R, 0, fb + shh + 4, -(sx + sl * 0.1), 4)] };
  }
  // địa hình dựng quanh (cx, cy) từ các tờ hải đồ đang có: lưới mịn gần tàu, thưa dần ra xa (tới tầm nhìn xa của mức chất lượng)
  buildTerrain(W, cx = 0, cy = 0) {
    if (this.terrain) { this.scene.remove(this.terrain); this.terrain.geometry.dispose(); this.terrain = null; }
    const [D, d0, dMax] = this.q.ter, F = Math.min(this.q.far, 26000);
    this.terrC = [cx, cy]; this.terrD = D;
    if (!W.hasCharts()) return;
    const axis = [0]; for (let x = d0; x <= D; x += d0) axis.push(x);
    for (let st = d0, x = axis[axis.length - 1]; x < F;) { st = Math.min(dMax, st * 1.12); x += st; axis.push(x); }
    const ax = [...axis.slice(1).reverse().map((v) => -v), ...axis], n = ax.length, xs = ax.map((v) => cx + v), ys = ax.map((v) => cy + v);
    const cls = new Uint8Array(n * n), dep = new Float32Array(n * n), dist = new Float32Array(n * n); let any = false;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const o = j * n + i, q = sampleWorld(xs[i], ys[j]), c = q.rec ? q.cls : 4;
      cls[o] = c; dep[o] = q.rec ? (q.rec.classDepth || DEF_CLASS_DEPTH)[c] : W.noChartDepth; dist[o] = c === 0 ? 1e9 : 0; if (c < 2) any = true;
    }
    if (!any) return;
    // khoảng cách từ đất tới mép nước (m) để dựng đồi cao dần vào trong
    const dx = (i) => xs[i] - xs[i - 1], dy = (j) => ys[j] - ys[j - 1];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const o = j * n + i; if (!dist[o]) continue; let d = dist[o]; if (i) d = Math.min(d, dist[o - 1] + dx(i)); if (j) d = Math.min(d, dist[o - n] + dy(j)); if (i && j) d = Math.min(d, dist[o - n - 1] + Math.hypot(dx(i), dy(j))); dist[o] = d; }
    for (let j = n - 1; j >= 0; j--) for (let i = n - 1; i >= 0; i--) { const o = j * n + i; if (!dist[o]) continue; let d = dist[o]; if (i < n - 1) d = Math.min(d, dist[o + 1] + dx(i + 1)); if (j < n - 1) d = Math.min(d, dist[o + n] + dy(j + 1)); if (i < n - 1 && j < n - 1) d = Math.min(d, dist[o + n + 1] + Math.hypot(dx(i + 1), dy(j + 1))); dist[o] = d; }
    const pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const o = j * n + i, x = xs[i], y = ys[j], cl = cls[o]; let h, r, g, b;
      if (cl === 0) { const dm = Math.min(dist[o], 1e5); h = 2.5 + Math.min(320, dm * 0.2) * (0.8 + 0.3 * Math.sin(x * 0.004) * Math.cos(y * 0.005)); const t = Math.min(1, h / 200); r = 0.30 + 0.16 * t; g = 0.42 - 0.04 * t; b = 0.24 + 0.04 * t; }
      else if (cl === 1) { h = -dep[o]; r = 0.56; g = 0.54; b = 0.42; }
      else { h = -dep[o]; r = 0.2; g = 0.33; b = 0.34; }
      pos[o * 3] = x; pos[o * 3 + 1] = h; pos[o * 3 + 2] = -y; col[o * 3] = r; col[o * 3 + 1] = g; col[o * 3 + 2] = b;
    }
    const ind = [];
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b2 = a + 1, c2 = a + n, d2 = c2 + 1;
      if (cls[a] > 1 && cls[b2] > 1 && cls[c2] > 1 && cls[d2] > 1) continue;
      ind.push(a, b2, c2, b2, d2, c2);
    }
    if (!ind.length) return;
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(new THREE.BufferAttribute(new Uint32Array(ind), 1)); geo.computeVertexNormals();
    this.terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })); this.terrain.frustumCulled = false; this.scene.add(this.terrain);
  }
  buildObjects(W) {
    const g = this.objG; g.clear(); this.marks = [];
    const quayM = new THREE.MeshLambertMaterial({ color: 0x8d9499 }), bolM = new THREE.MeshLambertMaterial({ color: 0x20262b }), fenM = new THREE.MeshLambertMaterial({ color: 0x15191c });
    for (const s of W.segs) {
      const hgt = s.top + s.depth + 2, m = new THREE.Mesh(new THREE.BoxGeometry(s.len, hgt, 24), quayM);
      const mx = (s.ax + s.bx) / 2 - s.nx * 12, my = (s.ay + s.by) / 2 - s.ny * 12;
      m.position.set(mx, s.top - hgt / 2, -my); m.userData.fix = s.top - hgt / 2; m.rotation.y = Math.atan2(s.ty, s.tx); g.add(m);
      for (let t = 6; t < s.len; t += 12) { const f = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3, 0.8), fenM); f.position.set(s.ax + s.tx * t + s.nx * 0.3, s.top - 2.2, -(s.ay + s.ty * t + s.ny * 0.3)); f.userData.fix = s.top - 2.2; f.rotation.y = m.rotation.y; g.add(f); }
    }
    for (const b of W.bollards) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.9, 8), bolM); m.position.set(b.x, b.top + 0.45, -b.y); m.userData.fix = b.top + 0.45; g.add(m); }
    for (const o of W.objs.lights) {
      const c = COL[o.color] || COL.W, hgt = +o.height || (o.kind === 'light' ? 9 : 4);
      let base = 0;
      if (o.kind === 'light') { base = Math.max(0, -W.depthAt(o.x, o.y)) + 1; const t = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, hgt, 8), new THREE.MeshLambertMaterial({ color: 0xf0f0f0 })); t.position.set(o.x, base + hgt / 2, -o.y); t.userData.fix = base + hgt / 2; g.add(t); }
      else { const bc = o.kind === 'buoyR' ? 0xd9362e : o.kind === 'buoyG' ? 0x2f9e55 : 0xe6c000; const t = new THREE.Mesh(o.kind === 'buoyG' ? new THREE.ConeGeometry(1.3, hgt, 10) : new THREE.CylinderGeometry(1.1, 1.3, hgt, 10), new THREE.MeshLambertMaterial({ color: bc })); t.position.set(o.x, hgt / 2 - 0.6, -o.y); t.userData.float = hgt / 2 - 0.6; g.add(t); }
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: c, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, sizeAttenuation: false }));
      sp.position.set(o.x, base + hgt + 0.5, -o.y); sp.scale.setScalar(0.035); sp.userData = o.kind === 'light' ? { fix: base + hgt + 0.5 } : { float: hgt + 0.2 }; g.add(sp); this.marks.push({ sp, o });
    }
  }
  setSegs(list) {
    // list: mảng [x1,y1,z1,x2,y2,z2,color]
    while (this.linePool.length < list.length) { const l = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)), new THREE.LineBasicMaterial({ color: 0xdddddd })); l.frustumCulled = false; this.lineG.add(l); this.linePool.push(l); }
    this.linePool.forEach((l, i) => { l.visible = i < list.length; if (l.visible) { const a = l.geometry.attributes.position; a.array.set(list[i].slice(0, 6)); a.needsUpdate = true; l.material.color.setHex(list[i][6] || 0xdddddd); } });
  }
  // st: {x,y,psi}; e: {sunEl (độ), vis (m), tide, waveH, t (giây), lights:{}, daySec}
  update(st, view, e) {
    this.view = view; this.time = e.t;
    const d = this.dim || { L: 100, B: 16, fb: 4, shh: 10, bridgeX: -30, eye: 12 };
    // tàu chòng chành theo sóng: lấy cao độ sóng ở mũi, lái, hai mạn rồi làm trễ theo quán tính thân tàu
    this.setWaves(e.waveH || 0, e.waveD || 0, e.waveT || 6, e.waveLen || 1);
    const sn0 = Math.sin(st.psi), cs0 = Math.cos(st.psi), W2 = (bx, by) => this.waveH(st.x + bx * sn0 + by * cs0, -(st.y + bx * cs0 - by * sn0), e.t);
    const hb = W2(d.L * 0.42, 0), hs = W2(-d.L * 0.42, 0), hp = W2(0, -d.B / 2), hst = W2(0, d.B / 2), hc = W2(0, 0);
    const mo = this.mo || (this.mo = { t: e.t, z: 0, p: 0, r: 0 }), dt = Math.max(0, Math.min(0.25, e.t - mo.t)); mo.t = e.t;
    const tz = (hb + hs + hp + hst + hc) / 5 * 0.85, tp = Math.atan2(hb - hs, d.L * 0.84) * 0.8, tr = Math.atan2(hst - hp, d.B) * 1.4;
    if (dt === 0 && Math.abs(mo.z - tz) > 3) { mo.z = tz; mo.p = tp; mo.r = tr; }
    const mk = Math.max(0.25, e.rollK || 1); mo.z += (tz - mo.z) * Math.min(1, dt * mk / 1.2); mo.p += (tp - mo.p) * Math.min(1, dt * mk / 1.5); mo.r += (tr - mo.r) * Math.min(1, dt * mk / 2.2);
    this.shipG.position.set(st.x, mo.z, -st.y); this.shipG.rotation.set(mo.p, -st.psi, mo.r, 'YXZ'); this.shipG.updateMatrixWorld(true);
    if (this.terrain) this.terrain.position.y = -e.tide;
    for (const o of this.objG.children) if (o.userData.fix !== undefined) o.position.y = o.userData.fix - e.tide;
    this.objG.position.y = 0;
    // ánh sáng
    const el = e.sunEl, day = Math.max(0, Math.min(1, (el + 6) / 18)), dusk = Math.max(0, 1 - Math.abs(el) / 14);
    const sky = new THREE.Color().setRGB(0.02 + 0.50 * day + 0.25 * dusk * (1 - day * 0.6), 0.03 + 0.66 * day + 0.08 * dusk, 0.07 + 0.80 * day);
    const visK = Math.min(1, e.vis / 9000); const fogC = sky.clone().lerp(new THREE.Color(0.75 * day + 0.06, 0.78 * day + 0.07, 0.8 * day + 0.08), 1 - visK * 0.6);
    this.scene.background = fogC; this.scene.fog.color.copy(fogC); this.scene.fog.near = Math.min(e.vis * 0.15, 800); this.scene.fog.far = Math.min(e.vis * 1.6, this.q.far);
    this.hemi.intensity = 0.12 + 1.2 * day; this.sun.intensity = 1.7 * day;
    const az = e.sunAz, er = Math.max(el, 5) * Math.PI / 180; const sd = new THREE.Vector3(Math.sin(az) * Math.cos(er), Math.sin(er), -Math.cos(az) * Math.cos(er));
    this.sun.position.copy(sd.clone().multiplyScalar(1000).add(this.shipG.position));
    this.sun.target = this.shipG;
    const dark = day < 0.55;
    for (const k in this.navL) for (const sp of this.navL[k]) sp.visible = !!(e.lights && e.lights[k]) && dark;
    for (const m of this.marks) {
      const o = m.o, per = Math.max(0.5, +o.period || 3), on = Math.max(0.2, +o.flash || 0.5);
      if (m.sp.userData.fix !== undefined) m.sp.position.y = m.sp.userData.fix - e.tide;
      m.sp.visible = dark && (((e.daySec + (o.x * 0.01)) % per) < on);
    }
    // camera
    const c = this.cam, sn = Math.sin(st.psi), cs = Math.cos(st.psi), lk = this.look;
    const P = (bx, by, hgt) => this.shipG.localToWorld(new THREE.Vector3(by, hgt, -bx)), qS = this.shipG.quaternion;
    let pos, yaw = st.psi, pitchC = -3;
    if (view === 'wingP') pos = P(d.bridgeX, -d.B * 0.56, d.eye);
    else if (view === 'wingS') pos = P(d.bridgeX, d.B * 0.56, d.eye);
    else if (view === 'aft') { pos = P(d.bridgeX - 6, 0, d.eye + 1); yaw = st.psi + Math.PI; }
    else if (view === 'top') { pos = new THREE.Vector3(st.x, 420 * lk.dist, -st.y); pitchC = -89.9; }
    else if (view === 'follow') { const dd = d.L * 1.6 * lk.dist, a = st.psi + Math.PI + lk.yaw * Math.PI / 180; pos = new THREE.Vector3(st.x + Math.sin(a) * dd, d.L * 0.45 * lk.dist + 8, -(st.y + Math.cos(a) * dd)); c.position.copy(pos); c.fov = 50; c.up.set(0, 1, 0); c.lookAt(st.x, 6, -st.y); }
    else pos = P(d.bridgeX, 0, d.eye);
    this.spec = null;
    if (view !== 'follow') {
      c.position.copy(pos); c.fov = view === 'top' ? 50 : lk.fov;
      if (view !== 'top') this.spec = { pos, ry: yaw - st.psi + lk.yaw * Math.PI / 180, pitch: (pitchC - lk.pitch) * Math.PI / 180, panes: view === 'bridge' ? 3 : 1, hf: 50 * (lk.fov / 55) * Math.PI / 180, q: qS.clone() };
      if (view === 'top') { c.up.set(sn, 0, -cs); c.lookAt(st.x, 0, -st.y); }
      else this.aim(c, this.spec, this.spec.ry);
    }
    c.far = Math.max(3000, this.scene.fog.far * 1.1); c.updateProjectionMatrix();
    this.water.position.set(c.position.x, 0, c.position.z);
    this.wU.uT.value = e.t; this.wU.uSky.value.copy(fogC); this.wU.uDeep.value.setRGB(0.02 + 0.03 * day, 0.05 + 0.15 * day, 0.08 + 0.2 * day); this.wU.uSun.value.copy(sd); this.wU.uSunI.value = day; this.wU.uCam.value.copy(c.position);
  }
  // hướng nhìn tính trong hệ tọa độ tàu (đi theo lắc dọc / lắc ngang của tàu)
  aim(c, sp, ry) {
    const dir = new THREE.Vector3(Math.sin(ry) * Math.cos(sp.pitch), Math.sin(sp.pitch), -Math.cos(ry) * Math.cos(sp.pitch)).applyQuaternion(sp.q);
    c.up.set(0, 1, 0).applyQuaternion(sp.q); c.position.copy(sp.pos); c.lookAt(sp.pos.x + dir.x * 100, sp.pos.y + dir.y * 100, sp.pos.z + dir.z * 100);
  }
  // panes: 3 canvas 2D của 3 ô cửa sổ buồng lái (trái, giữa, phải) — cùng một vị trí đứng, nhìn ghép liền
  render(panes) {
    const cv = this.canvas, pr = this.q.pr, sp = this.spec, r = this.r, c = this.cam;
    if (sp && sp.panes === 3 && panes) {
      const ws = panes.map((p) => p.clientWidth | 0), ph = panes[1].clientHeight | 0, tot = ws[0] + ws[1] + ws[2];
      if (!tot || !ph || !ws[1]) return;
      if (cv.width !== Math.round(tot * pr) || cv.height !== Math.round(ph * pr)) { r.setPixelRatio(pr); r.setSize(tot, ph, false); }
      const hfs = ws.map((w) => sp.hf * w / ws[1]), yaws = [sp.ry - (hfs[0] + hfs[1]) / 2, sp.ry, sp.ry + (hfs[1] + hfs[2]) / 2];
      r.setScissorTest(true); let x0 = 0;
      for (let i = 0; i < 3; i++) {
        r.setViewport(x0, 0, ws[i], ph); r.setScissor(x0, 0, ws[i], ph);
        c.aspect = ws[i] / ph; c.fov = 2 * Math.atan(Math.tan(hfs[i] / 2) / c.aspect) * 180 / Math.PI; c.up.set(0, 1, 0);
        this.aim(c, sp, yaws[i]);
        c.updateProjectionMatrix(); r.render(this.scene, c); x0 += ws[i];
      }
      r.setScissorTest(false);
      x0 = 0;
      for (let i = 0; i < 3; i++) {
        const pc = panes[i], W = Math.round(ws[i] * pr), H = Math.round(ph * pr);
        if (pc.width !== W || pc.height !== H) { pc.width = W; pc.height = H; }
        if (W) pc.getContext('2d').drawImage(cv, Math.round(x0 * pr), 0, W, H, 0, 0, W, H); x0 += ws[i];
      }
      return;
    }
    const w = cv.clientWidth | 0, h = cv.clientHeight | 0; if (!w || !h) return;
    if (cv.width !== Math.round(w * pr) || cv.height !== Math.round(h * pr)) { r.setPixelRatio(pr); r.setSize(w, h, false); c.aspect = w / h; c.updateProjectionMatrix(); }
    r.setScissorTest(false); r.setViewport(0, 0, w, h); if (c.aspect !== w / h) { c.aspect = w / h; c.updateProjectionMatrix(); }
    r.render(this.scene, c);
  }
}
export { body2w };
