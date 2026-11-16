// Kho đối tượng hải đồ: file xuất / nhập, gộp trùng tên, vị trí xuất phát có sẵn theo gốc trôi
import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { CS, setOrigin } = await import('../src/chartsys.js');
const { World } = await import('../src/world.js');
const { placesFile, mergePlacesFile, placesToWorld, emptyPlaces } = await import('../src/places.js');

const FILE = {
  app: 'mo-phong-dieu-dong-tau', loai: 'doi-tuong-hai-do', v: 2,
  lights: [{ name: 'Phao đỏ ngoài', kind: 'buoyR', color: 'R', period: 3, flash: 0.5, grp: 1, height: 2.1, lat: 20.5100, lon: 107.0200 }],
  berths: [{ name: 'Bến A', pts: [[20.5200, 107.0100], [20.5199, 107.0117]], depth: 3.5, top: 4.8, spacing: 10 }],
  routes: [{ name: 'Vào A', pts: [[20.5000, 107.0200], [20.5180, 107.0198]] }],
  starts: [{ name: 'Ngoài luồng A', lat: 20.5000, lon: 107.0200, hdg: 358 }, { name: 'Xa', lat: 20.8000, lon: 107.4500, hdg: 129 }]
};

test('gộp file đối tượng: thêm mới, nhập lại không nhân đôi, trùng tên thì thay', () => {
  setOrigin(20.51, 107.01);
  const W = new World(); placesToWorld(emptyPlaces(), W);
  const n = mergePlacesFile(W, FILE);
  assert.deepEqual(n, { lights: 1, berths: 1, routes: 1, starts: 2 });
  mergePlacesFile(W, FILE);
  assert.equal(W.objs.lights.length, 1); assert.equal(W.objs.berths.length, 1); assert.equal(W.objs.starts.length, 2);
  const F2 = JSON.parse(JSON.stringify(FILE)); F2.berths[0].depth = 5;
  mergePlacesFile(W, F2); assert.equal(W.objs.berths.length, 1); assert.equal(W.objs.berths[0].depth, 5);
  assert.throws(() => mergePlacesFile(W, { loai: 'mo-hinh-tau' }));
});

test('vị trí xuất phát có sẵn đi theo gốc trôi và ra file đúng lat/lon', () => {
  setOrigin(20.51, 107.01);
  const W = new World(); placesToWorld(emptyPlaces(), W); mergePlacesFile(W, FILE);
  const sub = (map) => W.mapCoords(map); CS.originSubs.add(sub); // như app.js
  setOrigin(20.80, 107.45); // dời gốc ~55 km
  CS.originSubs.delete(sub);
  const q = W.objs.starts.find((o) => o.name === 'Xa'), ll = CS.frame.toLL(q.x, q.y);
  assert.ok(Math.abs(ll[0] - 20.8) < 1e-6 && Math.abs(ll[1] - 107.45) < 1e-6, String(ll));
  const out = placesFile(W).starts.find((o) => o.name === 'Ngoài luồng A');
  assert.ok(Math.abs(out.lat - 20.5) < 1e-6 && Math.abs(out.lon - 107.02) < 1e-6);
  assert.equal(out.hdg, 358);
});
