// Tàu đậu ở cảng trong cảnh 3D: mô hình theo tàu trong kho (mỗi loại dựng một lần, các tàu cùng loại dùng chung hình),
// nhấp nhô nhẹ theo sóng (đậu bến bị dây giữ nên lắc ít hơn đậu neo), dây buộc võng nhẹ, neo nằm đáy + xích, đèn ban đêm
// (đèn chiếu boong; đậu neo thì đèn neo mũi / lái).
import { buildModel } from './shipdraw/model.js';
import { modelGroup, accMesh } from './shipdraw/mesh3.js';
import { genModel } from './shipdraw/shipgen.js';
import { buildFit } from './shipdraw/fittings.js';
import { Acc } from './shipdraw/prims.js';
import { deckPt, hawse, lineEnd, freeboard, anchorDown } from './moored.js';

const MAXL = 600;
// mô hình đơn giản cho tàu trong kho chưa vẽ: thân + một khối thượng tầng phía lái + buồng lái
function simpleModel(p) {
  const L = +p.loa || 50, B = +p.B || 9, T = ((+p.tf || 3) + (+p.ta || 3)) / 2, D = Math.max(T + 0.8, +p.D || T * 1.6);
  return genModel({ name: p.name, L, B, D, T, bow: 'raked', rake: L * 0.06, stern: 'transom', tb: 1, shF: L * 0.015, par: [-L * 0.2, L * 0.1], ts: 0.75, sec: 'round', opts: { colors: { hull: '#5d6870', super: '#d9dcde', deck: '#6b5a4a', boot: '#8b2a22' } },
    build: ({ deck }) => { const z = deck(-L * 0.3), t = z + 2.6; return { blocks: [{ k: 't1', x0: -L * 0.42, x1: -L * 0.2, h: 2.6, w: B * 0.8 }, { k: 'bridge', x0: -L * 0.36, x1: -L * 0.24, z0: t, h: 2.5, w: B * 0.86, sl: 0.4 }], masts: [{ id: 'chinh', x: -L * 0.3, z0: t + 2.5, h: Math.max(3, L / 14), yard: Math.max(2, L / 20) }], lights: { anchF: [L * 0.46, deck(L * 0.46) + 3], anchA: [-L * 0.46, deck(-L * 0.46) + 2.5] }, eye: [-L * 0.25, t + 1.6] }; } });
}

export class MooredView {
  constructor(THREE, scene, glow) {
    this.T3 = THREE; this.glow = glow; this.g = new THREE.Group(); scene.add(this.g); this.cache = new Map(); this.items = []; this.sig = '';
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXL * 6), 3)); lg.setDrawRange(0, 0);
    this.lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xe8e0c8 })); this.lines.frustumCulled = false; this.g.add(this.lines);
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXL * 6), 3)); cg.setDrawRange(0, 0);
    this.chains = new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0x2a2d30 })); this.chains.frustumCulled = false; this.g.add(this.chains);
  }
  // hình mẫu của một tàu trong kho (dựng một lần)
  tmpl(ref, p) {
    const ck = ref + ':' + p.loa + ':' + p.B + ':' + (p.model ? (p.model.parts || []).length + '/' + (p.model.fits || []).length : 0); // tàu trong kho sửa rồi lưu lại thì dựng lại
    if (this.cache.has(ck)) return this.cache.get(ck);
    const THREE = this.T3, T = ((+p.tf || 3) + (+p.ta || 3)) / 2, dims = { L: +p.loa || 50, B: +p.B || 9, D: +p.D || T * 1.6, T, cb: +p.cb || 0.6 };
    let geom = null; try { geom = buildModel(p.model && p.model.parts && p.model.parts.length ? p.model : simpleModel(p), dims); } catch (e) { console.warn('tàu đậu: không dựng được mô hình', e); geom = buildModel(simpleModel(p), dims); }
    const grp = modelGroup(THREE, geom, { shadows: false }); grp.userData = {}; // bỏ danh sách mesh trong userData để clone nhẹ
    const t = { grp, geom, T }; this.cache.set(ck, t); return t;
  }
  // dựng lại khi danh sách tàu (id / loại) đổi. pmap: ref → thông số tàu trong kho
  set(list, pmap) {
    const sig = list.map((s) => s.id + ':' + s.ref + ':' + (s.anchors || []).map((a) => (anchorDown(a) ? a.side : 'x')).join(',') + ':' + s.mode + ':' + (pmap[s.ref] ? pmap[s.ref].loa : 0)).join('|'); if (sig === this.sig) return; this.sig = sig;
    const THREE = this.T3; for (const it of this.items) this.g.remove(it.g, it.anch); this.items = [];
    for (const sh of list) {
      const p = pmap[sh.ref]; if (!p) continue; const t = this.tmpl(sh.ref, p), g = t.grp.clone(true), down = new Set((sh.anchors || []).filter(anchorDown).map((a) => a.side));
      g.traverse((o) => { if (o.userData && o.userData.anchor && (down.has(o.userData.anchor.side) || (down.size && !o.userData.anchor.side))) o.visible = false; }); // neo đã thả thì quả neo trên mạn ẩn đi
      const lp = (c, x, y, z, s) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: c, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.position.set(y, z - t.T, -x); sp.scale.setScalar(s); sp.visible = false; g.add(sp); return sp; };
      const L = sh.L, fb = freeboard(sh), lights = [];
      for (const l of t.geom.lights || []) if (sh.mode === 'anchor' && (l.key === 'anchF' || l.key === 'anchA')) lights.push(lp(0xffffff, l.x, l.y, l.z, 5));
      for (const x of [L * 0.25, -L * 0.1]) lights.push(lp(0xffe08a, x, 0, t.T + fb + 5, 7)); // đèn chiếu boong
      // neo nằm đáy
      const anch = new THREE.Group(); this.g.add(anch);
      for (const a of (sh.anchors || []).filter(anchorDown)) { const h = Math.max(0.8, Math.min(2.4, L / 45)), acc = new Acc(0x34383c, true), dm = new Acc(0, true); const I = buildFit({ id: 'a', kind: 'anchor', x: 0, y: 0, z: 0, rot: 0, l: h * 0.85, w: 0.5, h }, { metal: acc, super: acc, dark: acc, white: acc, hawse: dm }, []); const m = accMesh(THREE, acc, I.attach || [0, 0, 0], 0); m.rotation.x = -Math.PI / 2; anch.add(m); }
      this.g.add(g); this.items.push({ sh, g, T: t.T, lights, anch, mo: { z: 0, p: 0, r: 0, t: null } });
    }
  }
  // mỗi khung hình
  update(W, e, dark, waveH) {
    const t = e.t || 0, tide = e.tide || 0, Lp = this.lines.geometry.attributes.position.array, Cp = this.chains.geometry.attributes.position.array; let nl = 0, nc = 0;
    const where = new Map();
    for (const it of this.items) {
      const sh = it.sh, g = it.g, p = sh.hdg * Math.PI / 180, sn = Math.sin(p), cs = Math.cos(p), L = sh.L, B = sh.B;
      const W2 = (bx, by) => waveH(sh.x + bx * sn + by * cs, -(sh.y + bx * cs - by * sn), t), k = sh.mode === 'anchor' ? 0.75 : 0.4;
      const hb = W2(L * 0.4, 0), hs = W2(-L * 0.4, 0), hp = W2(0, -B / 2), hst = W2(0, B / 2), mo = it.mo, dt = mo.t === null ? 1 : Math.max(0, Math.min(0.25, t - mo.t)); mo.t = t;
      const tz = (hb + hs + hp + hst) / 4 * 0.85 * k, tp = Math.atan2(hb - hs, L * 0.8) * 0.8 * k, tr = Math.atan2(hst - hp, B) * 1.2 * k;
      mo.z += (tz - mo.z) * Math.min(1, dt / 1.4); mo.p += (tp - mo.p) * Math.min(1, dt / 1.8); mo.r += (tr - mo.r) * Math.min(1, dt / 2.4);
      g.position.set(sh.x, mo.z, -sh.y); g.rotation.set(mo.p, -p, mo.r, 'YXZ'); g.updateMatrixWorld(true);
      for (const sp of it.lights) sp.visible = dark;
      where.set(sh.id, it);
    }
    const V = new this.T3.Vector3(), w2 = (it, bx, by, z) => { V.set(by, z, -bx); it.g.localToWorld(V); return [V.x, V.y, V.z]; };
    for (const it of this.items) {
      const sh = it.sh, fb = freeboard(sh);
      for (const l of sh.lines || []) {
        if (nl >= MAXL - 2) break; const e2 = lineEnd(W, l); if (!e2) continue; const [bx, by] = deckPt(sh, l.k, true), a = w2(it, bx, by, fb + 0.3);
        let b; if (e2.float && e2.ship && where.has(e2.ship.id)) { const h = where.get(e2.ship.id), [qx, qy] = deckPt(h.sh, l.to.k, false); b = w2(h, qx, qy, freeboard(h.sh) + 0.6); } else b = [e2.x, e2.top + 0.6 - tide, -e2.y];
        const len = Math.hypot(b[0] - a[0], b[2] - a[2]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - Math.min(1.5, len * 0.03), (a[2] + b[2]) / 2];
        Lp.set([...a, ...m], nl * 6); nl++; Lp.set([...m, ...b], nl * 6); nl++;
      }
      // neo: quả neo nằm đáy (thân quay về phía tàu), xích võng từ lỗ neo xuống đáy rồi nằm trên đáy
      const dl = (sh.anchors || []).filter(anchorDown); // neo đang thả (lấy mới mỗi khung hình: kéo neo / đặt lại thì theo ngay)
      for (const [j, m] of it.anch.children.entries()) {
        const a = dl[j]; m.visible = !!a; if (!a) continue; const dep = Math.max(1, W.depthAt(a.x, a.y)), yb = -dep - tide, [hx, hy] = hawse(sh, a.side), h0 = w2(it, hx, hy, fb - 0.6), dx = a.x - h0[0], dz = -a.y - h0[2], dist = Math.hypot(dx, dz) || 1;
        m.position.set(a.x, yb + 0.25, -a.y); m.rotation.set(-Math.PI / 2, 0, Math.atan2(dx, -dz)); // nằm ngang
        const ux = dx / dist, uz = dz / dist, hang = Math.min(dist * 0.6, Math.max(dep * 1.3, 8)), td = [h0[0] + ux * hang, yb, h0[2] + uz * hang];
        let prev = h0; for (let i = 1; i <= 6 && nc < MAXL - 1; i++) { const s = i / 6, q = [h0[0] + (td[0] - h0[0]) * s, h0[1] + (yb - h0[1]) * (1 - (1 - s) * (1 - s)), h0[2] + (td[2] - h0[2]) * s]; Cp.set([...prev, ...q], nc * 6); nc++; prev = q; }
        if (nc < MAXL) { Cp.set([...td, a.x, yb + 0.1, -a.y], nc * 6); nc++; }
      }
    }
    this.lines.geometry.setDrawRange(0, nl * 2); this.lines.geometry.attributes.position.needsUpdate = true;
    this.chains.geometry.setDrawRange(0, nc * 2); this.chains.geometry.attributes.position.needsUpdate = true;
  }
}
