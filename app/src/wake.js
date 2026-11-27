// Vệt nước của tàu (three.js): dải bọt sau lái bám theo mặt sóng (vệt chân vịt ở giữa, hai cánh sóng Kelvin xiên 19,5° ra hai bên,
// nhạt dần theo thời gian và quãng đường), sóng mũi hai bên mũi to nhỏ theo tốc độ, nước sủi ở lái theo vòng quay chân vịt
// (chạy lùi thì sủi về phía trước dọc hai bên lái). Bọt vẽ bằng shader nhiễu, có sương mù như mặt nước.
const KELVIN = Math.tan(19.47 * Math.PI / 180), NMAX = 260;

function foamMat(THREE) {
  const U = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uL: { value: 1 }, uI: { value: 1 } }]);
  return new THREE.ShaderMaterial({ uniforms: U, fog: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8,
    vertexShader: `#include <common>\n#include <fog_pars_vertex>\nattribute vec4 aD; attribute float aW; varying vec4 vD; varying float vCw; varying vec3 vW;
    void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; vD=aD; vCw=aW; vec4 mvPosition=viewMatrix*w; gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}`,
    fragmentShader: `#include <common>\n#include <fog_pars_fragment>\nuniform float uT; uniform float uL; uniform float uI; varying vec4 vD; varying float vCw; varying vec3 vW;
    float hs(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float ns(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hs(i),hs(i+vec2(1.0,0.0)),f.x),mix(hs(i+vec2(0.0,1.0)),hs(i+vec2(1.0,1.0)),f.x),f.y); }
    float fb(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*ns(p); p*=2.03; a*=0.5; } return s; }
    void main(){ float u=vD.x, k=vD.w; vec2 p=vW.xz; float n1=fb(p*0.33+vec2(uT*0.05,-uT*0.03)), n2=fb(p*1.25-vec2(uT*0.11,uT*0.07)); float a;
      if (k<0.5) { float cw=max(vCw,0.02); float c=vD.y*exp(-(u/cw)*(u/cw)*2.2)*(0.3+0.8*smoothstep(0.32,0.72,n2));
        float au=abs(u); float e=vD.z*(smoothstep(0.86,0.965,au)*(1.0-smoothstep(0.965,1.0,au)))*(0.15+0.85*smoothstep(0.34,0.7,n1));
        a=c+e; }
      else if (k<1.5) { a=vD.y*pow(max(0.0,1.0-u),1.4)*(0.45+0.8*smoothstep(0.3,0.7,n2)); }
      else { a=vD.y*(1.0-smoothstep(0.45,1.0,u))*(0.45+0.9*smoothstep(0.33,0.7,n2)); }
      a=clamp(a*uI,0.0,0.92); if(a<0.01) discard;
      gl_FragColor=vec4(vec3(0.9,0.94,0.95)*uL,a);\n#include <fog_fragment>\n}` });
}
// lưới dải (hai đỉnh mỗi hàng) hoặc quạt: đỉnh + aD (u, cường độ giữa, cường độ cánh, loại) + aW (bề rộng vệt giữa theo u)
function stripGeo(THREE, n) {
  const g = new THREE.BufferGeometry(), idx = [];
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3)); g.setAttribute('aD', new THREE.BufferAttribute(new Float32Array(n * 2 * 4), 4)); g.setAttribute('aW', new THREE.BufferAttribute(new Float32Array(n * 2), 1));
  for (let i = 0; i + 1 < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setIndex(idx); return g;
}

export class Wake {
  constructor(THREE, scene) {
    this.T3 = THREE; this.pts = []; this.mat = foamMat(THREE);
    this.trail = new THREE.Mesh(stripGeo(THREE, NMAX + 1), this.mat); this.trail.frustumCulled = false; this.trail.renderOrder = 2; this.trail.geometry.setDrawRange(0, 0); scene.add(this.trail);
    this.local = []; // sóng mũi, nước sủi ở lái (gắn trên tàu)
  }
  // dims: { L, B, xa (lái), xf (mũi) theo tọa độ tàu }; hbw(x): nửa bề rộng đường nước tại x
  setShip(shipG, dims, hbw) {
    const THREE = this.T3; for (const m of this.local) { if (m.parent) m.parent.remove(m); m.geometry.dispose(); m.material.dispose(); } this.local = []; this.pts = [];
    this.dims = dims; const { L, B, xa, xf } = dims, lw = Math.max(6, L * 0.3), N = 24;
    const mk = (geo) => { const mat = foamMat(THREE), m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 2; shipG.add(m); this.local.push(m); return m; };
    // sóng mũi: mỗi mạn một dải từ sống mũi lùi về 30% chiều dài, mép trong sát vỏ, mép ngoài loe dần
    this.bow = [1, -1].map((s) => {
      const g = stripGeo(THREE, N), P = g.attributes.position, D = g.attributes.aD;
      for (let i = 0; i < N; i++) { const t = i / (N - 1), x = xf + 0.3 - t * lw, y0 = Math.max(0, hbw(Math.min(xf, x))) + 0.03, y1 = y0 + (0.5 + 3.4 * t) * Math.max(0.6, B / 10); P.setXYZ(i * 2, s * y0, 0.12, -x); P.setXYZ(i * 2 + 1, s * y1, 0.12, -x); const ic = Math.pow(1 - t, 0.8); D.setXYZW(i * 2, 0, ic, 0, 1); D.setXYZW(i * 2 + 1, 1, ic, 0, 1); }
      return mk(g);
    });
    // nước sủi ở lái: quạt elip — tiến: sau lái; lùi: dọc hai bên lái về phía mũi
    const fan = (cx, rx, ry) => { const n = 28, g = new THREE.BufferGeometry(), pos = [0, 0.12, -cx], d = [0, 1, 0, 2], w = [0], idx = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pos.push(Math.sin(a) * ry, 0.12, -(cx + Math.cos(a) * rx)); d.push(1, 1, 0, 2); w.push(0); } for (let i = 0; i < n; i++) idx.push(0, 1 + i, 1 + (i + 1) % n); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aD', new THREE.Float32BufferAttribute(d, 4)); g.setAttribute('aW', new THREE.Float32BufferAttribute(w, 1)); g.setIndex(idx); return mk(g); };
    this.washF = fan(xa - B * 0.65, B * 0.9, B * 0.75);
    this.washA = fan(xa + Math.max(B * 0.6, L * 0.1), Math.max(B * 1.1, L * 0.18), B * 1.35);
    for (const m of [...this.bow, this.washF, this.washA]) m.material.uniforms.uI.value = 0;
  }
  // ẩn (tàu ở xa) / bỏ hẳn (tàu khác ra khỏi vùng)
  hide() { this.trail.geometry.setDrawRange(0, 0); this.pts = []; for (const m of this.local) m.material.uniforms.uI.value = 0; }
  dispose() { if (this.trail.parent) this.trail.parent.remove(this.trail); this.trail.geometry.dispose(); this.mat.dispose(); for (const m of this.local) { if (m.parent) m.parent.remove(m); m.geometry.dispose(); m.material.dispose(); } this.local = []; }
  // mỗi khung hình. st {x,y,psi}; e: spd (m/s theo nước, tiến +), prop (vòng quay chân vịt / tối đa, lùi −), t, daylight; waveH(x, z, t)
  update(shipG, st, e, light, waveH, hs = 0.5) {
    if (!this.dims) return; const { L, B, xa } = this.dims, t = e.t || 0, spd = e.spd || 0, prop = e.prop || 0;
    for (const m of [this.trail, ...this.local]) { m.material.uniforms.uT.value = t; m.material.uniforms.uL.value = 0.3 + 0.7 * light; }
    // ghi vết lái
    const sn = Math.sin(st.psi), cs = Math.cos(st.psi), sx = st.x + (xa + 1) * sn, sy = st.y + (xa + 1) * cs, last = this.pts[0];
    if (last && (Math.hypot(sx - last.x, sy - last.y) > 60 || t < last.t - 1)) this.pts = [];
    const l0 = this.pts[0];
    if (spd > 0.4 && (!l0 || Math.hypot(sx - l0.x, sy - l0.y) > Math.max(1.2, L / 60))) { this.pts.unshift({ x: sx, y: sy, t, spd, pr: Math.max(0, prop) }); if (this.pts.length > NMAX) this.pts.pop(); }
    while (this.pts.length && t - this.pts[this.pts.length - 1].t > 150) this.pts.pop();
    // dựng dải: các hàng tức thời từ mũi về tới lái (chỉ có hai cánh sóng xuất phát ở mũi), rồi các điểm đã ghi sau lái
    const { xf } = this.dims, nb = 8, ahead = [];
    for (let i = 0; i < nb; i++) { const xx = xf - (xf - xa - 1) * i / nb; ahead.push({ x: st.x + xx * sn, y: st.y + xx * cs, t, spd: Math.max(0, spd), pr: 0, bow: xf - xx }); }
    const rows = [...ahead, { x: sx, y: sy, t, spd: Math.max(0, spd), pr: Math.max(0, prop) }, ...this.pts], g = this.trail.geometry, P = g.attributes.position, D = g.attributes.aD, Wd = g.attributes.aW;
    let s = 0, n = 0; const s0 = xf - xa - 1; const lift = 0.08 + 0.3 * Math.min(2, hs); // sóng dốc dời ngang mặt nước: nâng dải bọt chút cho khỏi bị đỉnh sóng che
    for (let i = 0; i < rows.length && n <= NMAX; i++) {
      const r = rows[i]; if (i) s += Math.hypot(r.x - rows[i - 1].x, r.y - rows[i - 1].y);
      const nx = rows[Math.min(rows.length - 1, i + 1)], pv = rows[Math.max(0, i - 1)]; let dx = pv.x - nx.x, dy = pv.y - nx.y; const dl = Math.hypot(dx, dy); if (dl < 1e-3) { dx = sn; dy = cs; } else { dx /= dl; dy /= dl; }
      const fromBow = r.bow !== undefined ? r.bow : s0 + (s - s0), sa = Math.max(0, s - s0), age = t - r.t, w = Math.max(r.bow !== undefined ? 0.5 : B * 0.55, (fromBow + 0.5) * KELVIN), cw = Math.min(1, (B * 0.42 + sa * 0.035) / w);
      const iC = r.bow !== undefined ? 0 : Math.min(1, r.spd / 4 + r.pr * 0.6) * Math.exp(-age / 50) * Math.exp(-sa / (L * 9)), iE = 0.45 * Math.min(1, Math.max(0, (r.spd - 1.2) / 5)) * Math.exp(-age / 80) * Math.exp(-sa / (L * 6));
      for (const k of [-1, 1]) { const px = r.x + dy * w * k, py = r.y - dx * w * k, j = n * 2 + (k > 0 ? 1 : 0); P.setXYZ(j, px, waveH(px, -py, t) + lift, -py); D.setXYZW(j, k, iC, iE, 0); Wd.setX(j, cw); }
      n++;
    }
    P.needsUpdate = D.needsUpdate = Wd.needsUpdate = true; g.setDrawRange(0, Math.max(0, n - 1) * 6);
    for (const m of this.local) m.position.y = lift; // bọt gắn trên tàu cũng nâng theo độ cao sóng
    // sóng mũi theo tốc độ; nước sủi ở lái theo vòng quay chân vịt
    const fr = Math.max(0, spd) / Math.sqrt(9.81 * L);
    for (const m of this.bow) m.material.uniforms.uI.value = Math.min(1, Math.max(0, (spd - 0.8) / 4)) * (0.6 + 2 * fr);
    // nấc lùi thường chỉ ~25–40% vòng quay tối đa: lùi khoảng 30% vòng quay là bọt đã trắng hết
    this.washF.material.uniforms.uI.value = Math.min(1, Math.max(0, prop) / 0.5) * 0.7 * (1 - Math.min(1, Math.max(0, spd) / 6));
    this.washA.material.uniforms.uI.value = Math.min(1, Math.max(0, -prop) / 0.3);
  }
}
