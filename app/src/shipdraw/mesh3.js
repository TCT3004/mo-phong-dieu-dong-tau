// Đổi mô hình (tọa độ tàu) sang nhóm three.js của cảnh: X = y (mạn phải), Y = z − T (gốc ở đường nước), Z = −x (mũi về −Z).
// Phép đổi trục này đảo chiều (định thức −1) nên tam giác dựng theo quy ước của model.js ra mặt hướng ra ngoài.
// Mặt mượt: pháp tuyến lấy trung bình các mặt kề nhau gãy dưới «góc gãy» (mặt cong nhìn liền, góc thật vẫn sắc).
export function toLocal(geom, x, y, z) { return [y, z - geom.dims.T, -x]; }

// tam giác hóa rời (mỗi tam giác 3 đỉnh riêng) + pháp tuyến theo góc gãy; roofCol: tô mặt hướng lên (nóc) bằng màu boong
function creased(it, T, creaseDeg, roofCol, piv) {
  const I = it.idx, P = it.pos, nT = I.length / 3, pos = new Float32Array(nT * 9), nor = new Float32Array(nT * 9), fn = new Float32Array(nT * 3);
  const px = piv ? piv[0] : 0, py = piv ? piv[1] : 0, pz = piv ? piv[2] : 0;
  for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) { const v = I[t * 3 + k], o = t * 9 + k * 3; pos[o] = P[v * 3 + 1] - px; pos[o + 1] = P[v * 3 + 2] - T - py; pos[o + 2] = -P[v * 3] - pz; }
  const map = new Map(), key = (o) => Math.round(pos[o] * 500) + ',' + Math.round(pos[o + 1] * 500) + ',' + Math.round(pos[o + 2] * 500);
  for (let t = 0; t < nT; t++) {
    const o = t * 9, ax = pos[o + 3] - pos[o], ay = pos[o + 4] - pos[o + 1], az = pos[o + 5] - pos[o + 2], bx = pos[o + 6] - pos[o], by = pos[o + 7] - pos[o + 1], bz = pos[o + 8] - pos[o + 2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz) || 1; fn[t * 3] = nx / l; fn[t * 3 + 1] = ny / l; fn[t * 3 + 2] = nz / l;
    for (let k = 0; k < 3; k++) { const kk = key(o + k * 3); let a = map.get(kk); if (!a) map.set(kk, (a = [])); a.push(t); }
  }
  const cs = Math.cos(creaseDeg * Math.PI / 180);
  for (let t = 0; t < nT; t++) {
    const o = t * 9, f0 = fn[t * 3], f1 = fn[t * 3 + 1], f2 = fn[t * 3 + 2];
    for (let k = 0; k < 3; k++) {
      let sx = 0, sy = 0, sz = 0; for (const u of map.get(key(o + k * 3))) { const g0 = fn[u * 3], g1 = fn[u * 3 + 1], g2 = fn[u * 3 + 2]; if (g0 * f0 + g1 * f1 + g2 * f2 >= cs) { sx += g0; sy += g1; sz += g2; } }
      const l = Math.hypot(sx, sy, sz) || 1; nor[o + k * 3] = sx / l; nor[o + k * 3 + 1] = sy / l; nor[o + k * 3 + 2] = sz / l;
    }
  }
  let col = null;
  // màu theo đỉnh của three.js là màu tuyến tính: đổi từ sRGB
  const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }, hex = (h, a, o) => { a[o] = lin((h >> 16) & 255); a[o + 1] = lin((h >> 8) & 255); a[o + 2] = lin(h & 255); };
  if (it.cols || roofCol !== null) {
    col = new Float32Array(nT * 9);
    for (let t = 0; t < nT; t++) { const roof = roofCol !== null && fn[t * 3 + 1] > 0.9; for (let k = 0; k < 3; k++) hex(roof ? roofCol : it.cols ? it.cols[I[t * 3 + k]] : it.col, col, t * 9 + k * 3); }
  }
  let win = null;
  if (it.win && it.win.some((v) => v)) { win = new Float32Array(nT * 6); for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) { const v = I[t * 3 + k], z0 = it.win[v * 2], z1 = it.win[v * 2 + 1]; win[t * 6 + k * 2] = z1 > z0 ? z0 - T - py : 0; win[t * 6 + k * 2 + 1] = z1 > z0 ? z1 - T - py : 0; } }
  return { pos, nor, col, win };
}
// vật liệu sơn tàu (PBR); có dải cửa kính thì shader vẽ kính tối màu có khung dọc
function shipMat(THREE, o) {
  const m = new THREE.MeshStandardMaterial({ color: o.color, vertexColors: o.vc, roughness: o.rough === undefined ? 0.7 : o.rough, metalness: o.metal || 0.04, side: o.side });
  if (o.win) {
    m.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aWin; varying vec2 vWin; varying vec3 vLoc; varying vec3 vONrm;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWin = aWin; vLoc = position; vONrm = normal;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vWin; varying vec3 vLoc; varying vec3 vONrm; float gWin = 0.0;')
        .replace('#include <color_fragment>', `#include <color_fragment>
        if (vWin.y > vWin.x && vLoc.y > vWin.x && vLoc.y < vWin.y && abs(vONrm.y) < 0.55) {
          vec2 hn = normalize(vONrm.xz + vec2(1e-5)); float tc = dot(vLoc.xz, vec2(-hn.y, hn.x)); float fr = fract(tc / 1.15); float ed = min(vLoc.y - vWin.x, vWin.y - vLoc.y);
          if (fr > 0.06 && ed > 0.06) { diffuseColor.rgb = vec3(0.03, 0.045, 0.06); gWin = 1.0; } }`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.08, gWin);')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.3, gWin);');
    };
    m.customProgramCacheKey = () => 'shipwin';
  }
  return m;
}
// chữ số hiệu mạn (canvas) — chỉ có trong trình duyệt
function decalTex(THREE, d, dark) {
  if (typeof document === 'undefined') return null;
  const H = 256, W = Math.max(256, Math.round(H * d.w / d.h)), c = document.createElement('canvas'); c.width = Math.min(2048, W); c.height = H; const g = c.getContext('2d');
  g.font = `bold ${Math.round(H * 0.86)}px "Arial Narrow", "Roboto Condensed", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const tw = g.measureText(d.text).width, k = Math.min(1, c.width * 0.94 / Math.max(1, tw)); g.setTransform(k, 0, 0, 1, c.width / 2 * (1 - k), 0);
  g.lineJoin = 'round'; g.lineWidth = H * 0.06; g.strokeStyle = dark ? 'rgba(230,234,236,.9)' : 'rgba(20,24,28,.85)'; g.strokeText(d.text, c.width / 2, H * 0.53); g.fillStyle = dark ? '#15191c' : '#f4f6f7'; g.fillText(d.text, c.width / 2, H * 0.53);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// opt.inside: cảnh chính — khối (thượng tầng, buồng lái…) chỉ vẽ mặt ngoài để camera đứng trong buồng lái nhìn xuyên ra như qua kính
// opt.shadows: đổ bóng và nhận bóng
export function modelGroup(THREE, geom, opt = {}) {
  const g = new THREE.Group(), T = geom.dims.T, roof = geom.roofDeck !== false && geom.colors ? geom.colors.deck : null;
  g.userData.spin = [];
  for (const it of geom.items) {
    const piv = it.pivot ? [it.pivot[1], it.pivot[2] - T, -it.pivot[0]] : null;
    const r = creased(it, T, it.crease || (it.tag === 'hullside' ? 42 : 34), it.tag === 'roof' ? roof : null, piv);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(r.pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(r.nor, 3));
    if (r.col) geo.setAttribute('color', new THREE.BufferAttribute(r.col, 3)); if (r.win) geo.setAttribute('aWin', new THREE.BufferAttribute(r.win, 2));
    const metal = it.col === 0x3a3f44, mesh = new THREE.Mesh(geo, shipMat(THREE, { color: r.col ? 0xffffff : it.col, vc: !!r.col, side: opt.inside && it.flat ? THREE.FrontSide : THREE.DoubleSide, win: !!r.win, rough: metal ? 0.45 : it.tag === 'deck' ? 0.85 : 0.68, metal: metal ? 0.5 : 0.04 }));
    if (piv) { mesh.position.set(piv[0], piv[1], piv[2]); mesh.userData.spin = it.spin || 24; g.userData.spin.push(mesh); }
    if (opt.shadows) { mesh.castShadow = true; mesh.receiveShadow = true; }
    g.add(mesh);
  }
  // số hiệu mạn: mảnh dán bám mặt vỏ hai bên mũi
  for (const d of geom.decals || []) {
    const tex = decalTex(THREE, d, geom.hullNoCol === 'k'); if (!tex) continue;
    const n = d.pos.length / 3, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = d.pos[i * 3 + 1]; pos[i * 3 + 1] = d.pos[i * 3 + 2] - T; pos[i * 3 + 2] = -d.pos[i * 3]; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(d.uv, 2)); geo.setIndex(d.idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide, roughness: 0.7, metalness: 0 }));
    m.userData.decal = true; if (opt.shadows) m.receiveShadow = true; g.add(m);
  }
  return g;
}
// bầu trời dịu làm nguồn phản chiếu cho sơn tàu (PBR): trời xanh nhạt, chân trời sáng, mặt biển tối
export function skyEnv(THREE, r) {
  const sc = new THREE.Scene(), geo = new THREE.SphereGeometry(10, 32, 16), c = [], P = geo.attributes.position;
  for (let i = 0; i < P.count; i++) { const y = P.getY(i) / 10, t = Math.max(0, y), g = Math.max(0, -y); c.push(0.86 - 0.36 * t - 0.5 * g, 0.9 - 0.24 * t - 0.5 * g, 0.95 - 0.08 * t - 0.5 * g); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); sc.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const pm = new THREE.PMREMGenerator(r), tex = pm.fromScene(sc, 0.02).texture; pm.dispose(); geo.dispose(); return tex;
}
