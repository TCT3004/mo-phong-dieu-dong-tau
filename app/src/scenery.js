// Cảnh trên bờ (three.js): cây và nhà dựng trên phần đất của địa hình quanh tàu (vùng lưới mịn).
// Điểm đặt lấy theo lưới gắn tọa độ thế giới + băm số, nên dựng lại địa hình thì cây / nhà vẫn ở chỗ cũ.
// Rừng và làng theo nhiễu (mọc thành từng đám), nhà xoay dọc theo bờ; sau cầu bến là dãy kho, không có cây.
// Ban đêm một phần nhà và kho có đèn (điểm sáng). Số lượng giới hạn theo mức chất lượng, ưu tiên chỗ gần tàu.
// Nhóm trả về được gắn làm con của lưới địa hình nên lên xuống theo thủy triều cùng địa hình.
const CAPS = { low: [1500, 300], mid: [4000, 800], high: [7000, 1500], max: [12000, 2500] };
const WALL = [[0.92, 0.9, 0.84], [0.95, 0.86, 0.58], [0.84, 0.87, 0.9], [0.9, 0.8, 0.68], [0.8, 0.85, 0.74], [0.97, 0.96, 0.93]];
const ROOF = [[0.55, 0.22, 0.15], [0.36, 0.22, 0.16], [0.25, 0.38, 0.55], [0.45, 0.47, 0.5], [0.6, 0.18, 0.14]];
const SHED = [[0.75, 0.77, 0.78], [0.62, 0.66, 0.7], [0.82, 0.8, 0.74]], SHED_ROOF = [[0.3, 0.45, 0.62], [0.55, 0.58, 0.6], [0.7, 0.25, 0.18]];

function h2(ix, iy, s) { let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, y, sc, s) {
  const fx = x / sc, fy = y / sc, ix = Math.floor(fx), iy = Math.floor(fy); let u = fx - ix, v = fy - iy; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
  const a = h2(ix, iy, s), b = h2(ix + 1, iy, s), c = h2(ix, iy + 1, s), d = h2(ix + 1, iy + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, sc, s) => vnoise(x, y, sc, s) * 0.65 + vnoise(x, y, sc / 2.7, s + 7) * 0.35;
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// chỉ số ô chứa v trong mảng tăng dần (−1 nếu ngoài)
function cellOf(arr, v) { let lo = 0, hi = arr.length - 1; if (v < arr[0] || v >= arr[hi]) return -1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arr[m] <= v) lo = m; else hi = m; } return lo; }

// T: { xs, ys, n, cls, dist, pos (đỉnh địa hình), cx, cy, D (nửa vùng mịn), segs (mép cầu bến), glow (texture) }
export function buildScenery(THREE, T, qn) {
  const [capT, capH] = CAPS[qn] || CAPS.high, { xs, ys, n, cls, dist, pos, cx, cy, D, segs } = T;
  // cao độ mặt địa hình (đúng theo tam giác của lưới), khoảng cách tới nước, độ dốc, hướng bờ; null nếu ô có góc không phải đất
  const at = (x, y) => {
    const i = cellOf(xs, x), j = cellOf(ys, y); if (i < 0 || j < 0) return null;
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1; if (cls[a] | cls[b] | cls[c] | cls[d]) return null;
    const sx = xs[i + 1] - xs[i], sy = ys[j + 1] - ys[j], u = (x - xs[i]) / sx, v = (y - ys[j]) / sy, ha = pos[a * 3 + 1], hb = pos[b * 3 + 1], hc = pos[c * 3 + 1], hd = pos[d * 3 + 1];
    const h = u + v <= 1 ? ha + u * (hb - ha) + v * (hc - ha) : hd + (1 - u) * (hc - hd) + (1 - v) * (hb - hd);
    const da = Math.min(dist[a], 1e5), db = Math.min(dist[b], 1e5), dc = Math.min(dist[c], 1e5), dd = Math.min(dist[d], 1e5);
    return { h, dd: da + (db - da) * u + (dc - da) * v, sl: (Math.max(ha, hb, hc, hd) - Math.min(ha, hb, hc, hd)) / Math.max(sx, sy), gx: (db - da + dd - dc) / 2 / sx, gy: (dc - da + dd - db) / 2 / sy };
  };
  // gần cầu bến: khoảng lùi vào bờ tính từ mép cầu (m)
  const quay = (x, y) => { let best = null; for (const s of segs) { const px = x - s.ax, py = y - s.ay, t = px * s.tx + py * s.ty, bk = -(px * s.nx + py * s.ny); if (t < -40 || t > s.len + 40 || bk < -10 || bk > 260) continue; if (!best || bk < best.bk) best = { bk, s }; } return best; };
  const x0 = cx - D, x1 = cx + D, y0 = cy - D, y1 = cy + D, near = (p) => (p.x - cx) * (p.x - cx) + (p.y - cy) * (p.y - cy);
  // cây
  let trees = []; const ST = 16;
  for (let iy = Math.ceil(y0 / ST); iy * ST < y1; iy++) for (let ix = Math.ceil(x0 / ST); ix * ST < x1; ix++) {
    const x = (ix + h2(ix, iy, 12)) * ST, y = (iy + h2(ix, iy, 13)) * ST, f = fbm(x, y, 700, 3), p = 0.035 + 0.8 * sstep(0.42, 0.68, f);
    if (h2(ix, iy, 11) >= p) continue;
    const q = at(x, y); if (!q || q.dd < 10 || (q.dd < 40 && h2(ix, iy, 14) < 0.5)) continue;
    if (segs.length) { const k = quay(x, y); if (k && k.bk < 150) continue; }
    trees.push({ x, y, h: q.h, r: h2(ix, iy, 15), r2: h2(ix, iy, 16) });
  }
  if (trees.length > capT) { trees.sort((a, b) => near(a) - near(b)); trees = trees.slice(0, capT); }
  // nhà
  let houses = []; const SH = 34;
  for (let iy = Math.ceil(y0 / SH); iy * SH < y1; iy++) for (let ix = Math.ceil(x0 / SH); ix * SH < x1; ix++) {
    const x = (ix + 0.2 + 0.6 * h2(ix, iy, 22)) * SH, y = (iy + 0.2 + 0.6 * h2(ix, iy, 23)) * SH, vg = fbm(x, y, 1100, 5), p = vg > 0.58 ? 0.7 * sstep(0.58, 0.7, vg) : 0.012;
    if (h2(ix, iy, 21) >= p) continue;
    const q = at(x, y); if (!q || q.dd < 25 || q.dd > 1200 || q.sl > 0.3 || q.h > 70) continue;
    if (segs.length) { const k = quay(x, y); if (k && k.bk < 230) continue; }
    const r = h2(ix, iy, 24), two = r > 0.7, l = 9 + 7 * h2(ix, iy, 25), w = 7 + 4 * h2(ix, iy, 26), gl = Math.hypot(q.gx, q.gy);
    const yaw = (gl > 1e-4 ? Math.atan2(q.gx, -q.gy) : h2(ix, iy, 27) * Math.PI) + (h2(ix, iy, 28) - 0.5) * 0.35;
    houses.push({ x, y, h: q.h, sl: q.sl, l, w, hw: two ? 6.5 + 2 * r : 3.6 + 1.2 * r, yaw, roof: h2(ix, iy, 29) < 0.62, wc: WALL[Math.floor(h2(ix, iy, 30) * WALL.length)], rc: ROOF[Math.floor(h2(ix, iy, 31) * ROOF.length)], lit: h2(ix, iy, 32) < 0.55 });
  }
  // kho sau cầu bến: hai dãy dọc theo mép cầu
  for (const s of segs) {
    if (Math.hypot((s.ax + s.bx) / 2 - cx, (s.ay + s.by) / 2 - cy) > D * 1.2) continue;
    const yaw = Math.atan2(s.ty, s.tx);
    for (const [row, bk] of [[0, 55], [1, 112]]) for (let t = 25, k = 0; t < s.len - 15; k++) {
      const hs = h2(Math.round(s.ax), Math.round(s.ay) + row * 97, 40 + k), l = 34 + 18 * hs, w = 18 + 8 * h2(Math.round(s.bx), k, 41 + row);
      const x = s.ax + s.tx * (t + l / 2) - s.nx * bk, y = s.ay + s.ty * (t + l / 2) - s.ny * bk; t += l + 10;
      if (t > s.len + 5 || hs > 0.82) continue;
      const q = at(x, y); if (!q || q.sl > 0.25) continue;
      houses.push({ x, y, h: q.h, sl: q.sl, l, w, hw: 8 + 4 * hs, yaw, roof: true, flat: 0.16, wc: SHED[k % SHED.length], rc: SHED_ROOF[(k + row) % SHED_ROOF.length], lit: true, shed: true });
    }
  }
  if (houses.length > capH) { houses.sort((a, b) => (a.shed ? -1 : 0) - (b.shed ? -1 : 0) || near(a) - near(b)); houses = houses.slice(0, capH); }
  if (!trees.length && !houses.length) return null;

  const G = new THREE.Group(), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  const inst = (geo, list, fill) => {
    if (!list.length) return null; const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), list.length);
    list.forEach((it, i) => { fill(it); M4.compose(V, Q, S); m.setMatrixAt(i, M4); m.setColorAt(i, C); });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); m.frustumCulled = false; G.add(m); return m;
  };
  // cây: kiểu nón (phi lao) và kiểu tán tròn
  const cone = new THREE.ConeGeometry(0.5, 1, 6); cone.translate(0, 0.5, 0);
  const ball = new THREE.IcosahedronGeometry(0.5, 1); ball.scale(1, 0.85, 1); ball.translate(0, 0.62, 0);
  const tc = trees.filter((t) => t.r2 < 0.35), tb = trees.filter((t) => t.r2 >= 0.35), green = (t) => C.setRGB(0.13 + 0.07 * t.r, 0.27 + 0.1 * t.r2, 0.11 + 0.06 * t.r);
  inst(cone, tc, (t) => { const hh = 8 + 9 * t.r; V.set(t.x, t.h - 1, -t.y); Q.setFromAxisAngle(up, t.r2 * 6.28); S.set(hh * 0.32, hh + 1, hh * 0.32); green(t); });
  inst(ball, tb, (t) => { const hh = 6 + 7 * t.r; V.set(t.x, t.h - 1.2, -t.y); Q.setFromAxisAngle(up, t.r * 6.28); S.set(hh * 0.85, hh + 1.2, hh * (0.75 + 0.2 * t.r2)); green(t); });
  // nhà: thân hộp chôn chân 1,5 m (đất dốc không hở móng) + mái hai dốc (dọc trục dài)
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
  const roofG = new THREE.BufferGeometry(), rp = [-0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 1, 0, -0.5, 1, 0, -0.5, 0, -0.5, 0.5, 0, -0.5];
  roofG.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); roofG.setIndex([0, 1, 2, 0, 2, 3, 5, 4, 3, 5, 3, 2, 0, 3, 4, 1, 5, 2, 0, 4, 5, 0, 5, 1]); const roofF = roofG.toNonIndexed(); roofF.computeVertexNormals();
  inst(box, houses, (b) => { const bur = Math.max(1.5, (b.sl || 0) * Math.max(b.l, b.w) * 0.6); V.set(b.x, b.h - bur, -b.y); Q.setFromAxisAngle(up, b.yaw); S.set(b.l, b.hw + bur, b.w); C.setRGB(...b.wc); });
  const roofs = houses.filter((b) => b.roof);
  inst(roofF, roofs, (b) => { V.set(b.x, b.h + b.hw, -b.y); Q.setFromAxisAngle(up, b.yaw); S.set(b.l * 1.04, b.w * (b.flat || 0.36), b.w * 1.1); C.setRGB(...b.rc); });
  // đèn ban đêm
  const lp = [];
  for (const b of houses) {
    if (!b.lit) continue; const c = Math.cos(b.yaw), s = Math.sin(b.yaw); // trục ngang của nhà (z cục bộ) trong hệ thế giới
    if (b.shed) { for (const e of [-0.5, 0.5]) lp.push(b.x + c * b.l * e, b.h + b.hw + 3, -(b.y + s * b.l * e)); }
    else lp.push(b.x - s * b.w * 0.55, b.h + b.hw * 0.55, -(b.y + c * b.w * 0.55)); // mặt nhìn ra biển
  }
  if (lp.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: T.glow, color: 0xffd49a, size: 5, sizeAttenuation: false, transparent: true, depthWrite: false, fog: true }));
    pts.frustumCulled = false; pts.visible = false; G.add(pts); G.userData.night = pts;
  }
  G.userData.count = { trees: trees.length, houses: houses.length };
  return G;
}
