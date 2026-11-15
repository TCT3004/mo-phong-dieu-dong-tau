// Thời tiết ngẫu nhiên: lặp lại được, giá trị hợp lý, đổi dần, theo giờ trong ngày
import test from 'node:test';
import assert from 'node:assert/strict';
import { Weather, WX_TYPES, windSeaH } from '../src/weather.js';

const run = (seed, h0, hours, dt, fn, start) => { const w = new Weather(seed, h0 * 3600, start); for (let t = 0; t < hours * 3600; t += dt) { w.step(dt); fn(w, t); } return w; };

test('cùng hạt giống → cùng diễn biến', () => {
  const a = [], b = [];
  run(42, 6, 3, 10, (w) => a.push(w.now.type + w.now.wKn.toFixed(3)));
  run(42, 6, 3, 10, (w) => b.push(w.now.type + w.now.wKn.toFixed(3)));
  assert.deepEqual(a, b);
});

test('giá trị hợp lý và đổi dần, không nhảy đột ngột', () => {
  for (const seed of [1, 7, 99, 1234]) {
    let p = null;
    run(seed, 0, 48, 10, (w) => {
      const n = w.now;
      assert.ok(n.wKn >= 0 && n.wKn < 55, 'gió ' + n.wKn);
      assert.ok(n.vis >= 0.09 * 1852 && n.vis <= 15.1 * 1852, 'tầm nhìn ' + n.vis);
      assert.ok(n.rain >= 0 && n.rain <= 1 && n.cloud >= 0 && n.cloud <= 1);
      assert.ok(n.waveH > 0 && n.waveH < 6 && n.waveL >= 60 && n.waveL <= 250);
      if (p) {
        assert.ok(Math.abs(n.windMean - p.windMean) < 4, 'gió trung bình nhảy ' + p.windMean + ' → ' + n.windMean);
        assert.ok(Math.abs(Math.log(n.vis / p.vis)) < 0.35, 'tầm nhìn nhảy ' + p.vis + ' → ' + n.vis);
        assert.ok(Math.abs(n.cloud - p.cloud) < 0.12 && Math.abs(n.waveH - p.waveH) < 0.05, 'mây / sóng nhảy');
      }
      if (n.flash > 0) assert.ok(n.storm > 0.5, 'chỉ có sét khi giông');
      p = { ...n };
    });
  }
});

test('kiểu trời khởi đầu theo lựa chọn, có chuyển sang kiểu khác', () => {
  for (const k of Object.keys(WX_TYPES)) { const w = new Weather(5, 10 * 3600, k); assert.equal(w.now.type, k); }
  const seen = new Set(); run(3, 6, 72, 30, (w) => seen.add(w.now.type));
  assert.ok(seen.size >= 3, 'chỉ thấy ' + [...seen]);
});

test('giông hay có buổi chiều, sương mù hay có sáng sớm', () => {
  const at = { giong: [0, 0], suong: [0, 0] }; // [đúng khung giờ, ngoài khung giờ]
  for (let seed = 1; seed <= 120; seed++) {
    let last = null;
    run(seed, 0, 24, 20, (w, t) => {
      const ty = w.now.type; if (ty === last) return; last = ty; const h = (t / 3600) % 24;
      if (ty === 'giong') at.giong[h >= 12 && h < 20 ? 0 : 1]++;
      if (ty === 'suong') at.suong[h >= 3 && h < 9 ? 0 : 1]++;
    });
  }
  // khung giờ hẹp hơn (8 h và 6 h trên 24 h) mà vẫn chiếm nhiều hơn
  assert.ok(at.giong[0] > at.giong[1], 'giông ' + at.giong);
  assert.ok(at.suong[0] > at.suong[1], 'sương mù ' + at.suong);
});

test('sóng gió lớn dần theo gió, có độ trễ', () => {
  assert.ok(windSeaH(10) < windSeaH(25) && windSeaH(35) > 2.5);
  const w = new Weather(11, 14 * 3600, 'nang'); const h0 = w.waveH;
  w.seg.to = { ...w.seg.to, wind: 32 }; w.seg.from = w.seg.to; w.seg.dur = 1e9; // gió mạnh lên đột ngột, giữ nguyên kiểu trời
  w.step(60); assert.ok(w.waveH - h0 < 0.2, 'sóng không được lớn ngay');
  for (let i = 0; i < 90; i++) w.step(60);
  assert.ok(w.waveH > 0.95 * Math.hypot(windSeaH(32), w.swell.H), 'sau 1,5 giờ sóng phải gần mức cân bằng: ' + w.waveH);
});
