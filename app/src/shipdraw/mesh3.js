// Đổi mô hình (tọa độ tàu) sang nhóm three.js của cảnh: X = y (mạn phải), Y = z − T (gốc ở đường nước), Z = −x (mũi về −Z).
// Phép đổi trục này đảo chiều (định thức −1) nên tam giác dựng theo quy ước của model.js ra mặt hướng ra ngoài.
export function toLocal(geom, x, y, z) { return [y, z - geom.dims.T, -x]; }
// opt.inside: cảnh chính — khối (thượng tầng, buồng lái…) chỉ vẽ mặt ngoài để camera đứng trong buồng lái nhìn xuyên ra như qua kính
export function modelGroup(THREE, geom, opt = {}) {
  const g = new THREE.Group(), T = geom.dims.T, col = new THREE.Color();
  for (const it of geom.items) {
    const n = it.pos.length / 3, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = it.pos[i * 3 + 1]; pos[i * 3 + 1] = it.pos[i * 3 + 2] - T; pos[i * 3 + 2] = -it.pos[i * 3]; }
    let geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(it.idx);
    if (it.cols) { const c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { col.setHex(it.cols[i]); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; } geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
    if (it.flat) geo = geo.toNonIndexed();
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: it.cols ? 0xffffff : it.col, vertexColors: !!it.cols, side: opt.inside && it.flat ? THREE.FrontSide : THREE.DoubleSide })));
  }
  return g;
}
