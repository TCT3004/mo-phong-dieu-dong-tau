// "Mét thế giới" dùng cho physics, radar, 3D: Mercator elipxoit chia cho hệ số phóng tại φ₀, gốc O tại (lat0, lon0), x Đông, y Bắc.
// Đồng dạng với hải đồ Mercator → hải đồ, mô phỏng, radar, 3D không lệch nhau; bảo giác nên góc hướng đúng.
// Sai số tỷ lệ so với mét thật ≈ tan φ₀ · Δφ (≈0,3% khi lệch 0,5° vĩ độ ở 21°N).
import { llToMerc, mercToLL, mercScale } from './proj.js';

export class WorldFrame {
  constructor(lat0 = 0, lon0 = 0) { this.set(lat0, lon0); }
  set(lat0, lon0) {
    this.lat0 = lat0; this.lon0 = lon0; [this.X0, this.Y0] = llToMerc(lat0, lon0); this.k = 1 / mercScale(lat0);
    return this;
  }
  toWorld(lat, lon) { const [X, Y] = llToMerc(lat, lon); return [(X - this.X0) * this.k, (Y - this.Y0) * this.k]; }
  toLL(x, y) { return mercToLL(this.X0 + x / this.k, this.Y0 + y / this.k); }
  mercToWorld(X, Y) { return [(X - this.X0) * this.k, (Y - this.Y0) * this.k]; }
  worldToMerc(x, y) { return [this.X0 + x / this.k, this.Y0 + y / this.k]; }
  // số mét thật ứng với 1 mét thế giới tại điểm (x, y) — dùng khi cần khoảng cách chính xác ở xa gốc
  trueScale(x, y) { const [lat] = this.toLL(x, y); return 1 / (mercScale(lat) * this.k); }
  // gốc trôi: trả về frame mới đặt gốc tại (lat, lon) và hàm đổi tọa độ cũ → mới
  recenter(lat, lon) {
    const old = new WorldFrame(this.lat0, this.lon0); this.set(lat, lon);
    return { scale: this.k / old.k, map: (x, y) => { const [la, lo] = old.toLL(x, y); return this.toWorld(la, lo); } };
  }
}
