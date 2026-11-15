// Nguồn độ sâu ghép từ nhiều tờ: tại mỗi điểm lấy tờ chi tiết nhất có phủ điểm đó (theo đa giác PLY), tra lưới lớp độ sâu của tờ.
// Lưới được nạp từ kho theo vùng quanh tàu (ensure) và giải phóng khi ở xa.
import { bboxIntersects, inside } from '../geo/poly.js';

export class DepthProvider {
  constructor(catalog) { this.cat = catalog; this.loaded = new Map(); this.order = []; this.loading = new Map(); this.gen = 0; this.log = []; }
  // nạp lưới của các tờ giao với hộp bao Mercator [x0,y0,x1,y1]
  async ensure(bb) {
    for (const id of [...this.loaded.keys()]) if (!this.cat.byId.has(id)) this.loaded.delete(id);
    const want = this.cat.records.filter((r) => r.ready && r.bboxMerc && bboxIntersects(r.bboxMerc, bb));
    await Promise.all(want.map((r) => this.load(r)));
    this.sort();
    return want.length;
  }
  load(r) {
    if (this.loaded.has(r.id)) return Promise.resolve();
    if (!this.loading.has(r.id)) this.loading.set(r.id, this.cat.getGrid(r.id).then((g) => { this.loading.delete(r.id); if (g) { this.loaded.set(r.id, { rec: r, ver: r.ver, xf: r.xf, grid: g.d, gw: g.gw, gh: g.gh, cell: g.cell }); this.sort(); this.gen++; this.log.push([this.gen, r.bboxMerc]); if (this.log.length > 200) this.log.shift(); } }).catch(() => this.loading.delete(r.id)));
    return this.loading.get(r.id);
  }
  drop(keepBB) { for (const [id, e] of this.loaded) if (!bboxIntersects(e.rec.bboxMerc, keepBB)) this.loaded.delete(id); this.sort(); }
  sort() { this.order = [...this.loaded.values()].filter((e) => e.rec.ready).sort((a, b) => a.rec.mppMerc - b.rec.mppMerc); }
  // có tờ nào giao hộp bao bb được nạp sau lần gen0 không (để biết khi nào dựng lại địa hình 3D)
  loadedSince(gen0, bb) { return this.log.some(([g, b]) => g > gen0 && bboxIntersects(b, bb)); }
  // bỏ một tờ (xóa khỏi kho, hoặc georef đổi)
  forget(id) { this.loaded.delete(id); this.sort(); this.gen++; }
  // → { cls (0 đất … 4 sâu), rec } hoặc rec = null khi không có hải đồ
  sample(X, Y) {
    const tryE = (e) => {
      const b = e.rec.bboxMerc; if (X < b[0] || X > b[2] || Y < b[1] || Y > b[3] || !inside(X, Y, e.rec.plyMerc)) return -1;
      if (e.ver !== e.rec.ver) { e.ver = e.rec.ver; e.xf = e.rec.xf; }
      const [px, py] = e.xf.mercToPx(X, Y), gx = Math.floor(px / e.cell), gy = Math.floor(py / e.cell);
      if (gx < 0 || gy < 0 || gx >= e.gw || gy >= e.gh) return -1;
      const v = e.grid[gy * e.gw + gx]; return v === 255 ? 4 : v;
    };
    for (const e of this.order) { const c = tryE(e); if (c >= 0) return { cls: c, rec: e.rec }; }
    return { cls: 4, rec: null };
  }
}
