// Tàu khác chạy trên luồng trong cảnh 3D (giai đoạn 5): mô hình theo mẫu trong kho tàu (mỗi mẫu dựng một lần rồi clone),
// nhấp nhô theo sóng, vệt nước sau lái + sóng mũi theo tốc độ (wake.js), đèn hàng hải đúng góc chiếu theo chỗ người nhìn:
// đèn cột trắng 225° phía trước, đèn mạn đỏ (trái) / xanh (phải) 112,5° mỗi bên, đèn lái trắng 135° phía sau; tàu đang đánh cá
// thêm hai đèn chiếu khắp vòng trên cột: lưới kéo xanh trên trắng, nghề khác đỏ trên trắng. Đèn to dần theo khoảng cách
// để ở xa vẫn thấy một chấm sáng; ngoài tầm nhìn (sương mù) thì tắt.
import { buildModel } from './shipdraw/model.js';
import { modelGroup } from './shipdraw/mesh3.js';
import { templateShip } from './fleet.js';
import { Wake } from './wake.js';

const COL = { W: 0xfff4e0, R: 0xff3b30, G: 0x34e07a };
const wrapD = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
// góc chiếu theo phương vị người nhìn so với mũi tàu (độ, + về mạn phải)
const SECT = { mast: (b) => Math.abs(b) <= 112.5, sideS: (b) => b >= 0 && b <= 112.5, sideP: (b) => b <= 0 && b >= -112.5, stern: (b) => Math.abs(b) >= 112.5, all: () => true };

export class TrafficView {
  constructor(THREE, scene, glow) { this.T3 = THREE; this.scene = scene; this.glow = glow; this.g = new THREE.Group(); scene.add(this.g); this.cache = new Map(); this.items = new Map(); }
  tmpl(tpl) {
    if (this.cache.has(tpl)) return this.cache.get(tpl);
    const p = templateShip(tpl); if (!p) { this.cache.set(tpl, null); return null; }
    const T = ((+p.tf || 3) + (+p.ta || 3)) / 2, geom = buildModel(p.model, { L: +p.loa, B: +p.B, D: +p.D || T * 1.6, T, cb: +p.cb || 0.6 });
    const grp = modelGroup(this.T3, geom, { shadows: false }); grp.userData = {};
    const t = { grp, geom, T, trawl: /lưới kéo/.test(p.name || '') }; this.cache.set(tpl, t); return t;
  }
  make(v, t) {
    const THREE = this.T3, g = t.grp.clone(true), lights = [];
    const lp = (c, x, y, z, sect, base) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: c, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.position.set(y, z - t.T, -x); sp.scale.setScalar(base); sp.visible = false; g.add(sp); lights.push({ sp, sect, base, fish: 0 }); return sp; };
    let top = null;
    for (const l of t.geom.lights || []) {
      if (l.key === 'mast1' || l.key === 'mast2') { lp(COL.W, l.x, l.y, l.z, 'mast', 4.5); if (l.key === 'mast1') top = l; }
      else if (l.key === 'sideP') lp(COL.R, l.x, l.y, l.z, 'sideP', 3.5);
      else if (l.key === 'sideS') lp(COL.G, l.x, l.y, l.z, 'sideS', 3.5);
      else if (l.key === 'stern') lp(COL.W, l.x, l.y, l.z, 'stern', 3.5);
    }
    // đèn đánh cá: hai đèn chiếu khắp vòng trên cột (trên: xanh lưới kéo / đỏ nghề khác; dưới: trắng)
    if (top) { const a = lp(t.trawl ? COL.G : COL.R, top.x, 0, top.z + 1.2, 'all', 4.5), b = lp(COL.W, top.x, 0, top.z - 0.8, 'all', 4.5); lights[lights.length - 2].fish = 1; lights[lights.length - 1].fish = 1; void a; void b; }
    const H = t.geom.hull, wake = new Wake(THREE, this.scene);
    wake.setShip(g, { L: t.geom.dims.L, B: t.geom.dims.B, xa: H.xa, xf: H.xf }, (x) => H.yAt(Math.max(H.xa, Math.min(H.xf, x)), t.T, 1));
    this.g.add(g); return { g, t, lights, wake, mo: { z: 0, p: 0, r: 0, t: null }, L: t.geom.dims.L, B: t.geom.dims.B };
  }
  drop(id) { const it = this.items.get(id); if (!it) return; this.g.remove(it.g); it.wake.dispose(); this.items.delete(id); }
  // list: [{ id, tpl, x, y, psi (rad), u (m/s), fishing }]; cam: vị trí camera (three.js); vis: tầm nhìn (m); light: độ sáng ngày 0..1
  update(list, e, dark, waveH, cam, vis, light) {
    const seen = new Set(), t = e.t || 0;
    for (const v of list) {
      const key = v.id + '|' + v.tpl; // bài mới đánh số lại từ 1: khóa kèm mẫu tàu để không dùng nhầm mô hình
      let it = this.items.get(key);
      if (!it) { const tp = this.tmpl(v.tpl); if (!tp) continue; it = this.make(v, tp); this.items.set(key, it); }
      seen.add(key);
      const g = it.g, p = v.psi, sn = Math.sin(p), cs = Math.cos(p), L = it.L, B = it.B, mo = it.mo, dt = mo.t === null ? 1 : Math.max(0, Math.min(0.25, t - mo.t)); mo.t = t;
      const W2 = (bx, by) => waveH(v.x + bx * sn + by * cs, -(v.y + bx * cs - by * sn), t);
      const hb = W2(L * 0.4, 0), hs = W2(-L * 0.4, 0), hp = W2(0, -B / 2), hst = W2(0, B / 2);
      const tz = (hb + hs + hp + hst) / 4 * 0.85, tp = Math.atan2(hb - hs, L * 0.8) * 0.8, tr = Math.atan2(hst - hp, B) * 1.3;
      if (dt === 1) { mo.z = tz; mo.p = tp; mo.r = tr; }
      mo.z += (tz - mo.z) * Math.min(1, dt / 1.2); mo.p += (tp - mo.p) * Math.min(1, dt / 1.5); mo.r += (tr - mo.r) * Math.min(1, dt / 2);
      g.position.set(v.x, mo.z, -v.y); g.rotation.set(mo.p, -p, mo.r, 'YXZ'); g.updateMatrixWorld(true);
      // đèn: góc chiếu theo phương vị camera so với mũi tàu, cỡ theo khoảng cách
      const dx = cam.x - v.x, dy = -cam.z - v.y, dist = Math.hypot(dx, dy), brg = wrapD(Math.atan2(dx, dy) * 180 / Math.PI - p * 180 / Math.PI), inVis = dist < (vis || 1e5) * 1.3;
      for (const l of it.lights) {
        const on = dark && inVis && (l.fish ? !!v.fishing : true) && SECT[l.sect](brg);
        l.sp.visible = on; if (on) l.sp.scale.setScalar(Math.max(l.base, dist * 0.0032));
      }
      // vệt nước: chỉ tàu trong 2,5 km
      if (dist < 2500) it.wake.update(g, { x: v.x, y: v.y, psi: p }, { t, spd: v.u || 0, prop: Math.max(0.15, Math.min(1, (v.u || 0) / 4)), }, light, waveH, 0.5);
      else it.wake.hide();
    }
    for (const id of [...this.items.keys()]) if (!seen.has(id)) this.drop(id);
  }
  clear() { for (const id of [...this.items.keys()]) this.drop(id); }
}
