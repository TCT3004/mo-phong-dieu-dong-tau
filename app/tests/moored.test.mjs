// Tàu đậu ở cảng: đặt theo kiểu cập (mạn trái / phải, cập lái, cập mạn tàu khác, đậu neo), dây + neo mặc định,
// khối va chạm, cọc bích trên boong, lưu file lat/lon, theo gốc trôi
import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { CS, setOrigin } = await import('../src/chartsys.js');
const { World, externalForces } = await import('../src/world.js');
const { placesFile, mergePlacesFile, placesToWorld, emptyPlaces } = await import('../src/places.js');
const { newMoored, placeShip, defaultLines, defaultAnchors, b2w, lineEnd } = await import('../src/moored.js');
const { defaultShip, buildModel, newState } = await import('../src/physics.js');

const FILE = { app: 'x', loai: 'doi-tuong-hai-do', v: 3, lights: [], routes: [], starts: [],
  berths: [{ name: 'Bến A', pts: [[20.5200, 107.0100], [20.5200, 107.0130]], depth: 8, top: 4.5, spacing: 15 }] }; // bến dài ~310 m theo hướng Đông
const P = { loa: 60, B: 10, D: 5, tf: 3, ta: 3, type: 'Tàu hàng', name: 'T1' };
function setup() {
  setOrigin(20.51, 107.01); const W = new World(); placesToWorld(emptyPlaces(), W); mergePlacesFile(W, FILE); return W;
}
function add(W, mode, x, y, p = P) { const sh = newMoored('tpl:hang50', p, mode); assert.ok(placeShip(W, sh, x, y), 'đặt được ' + mode); W.objs.ships.push(sh); W.rebuild(); defaultLines(W, sh); defaultAnchors(W, sh); return sh; }

test('cập mạn trái / phải: áp sát mép cầu, mũi dọc theo cầu, 4 dây vào cọc bích', () => {
  const W = setup(), s = W.segs[0], mx = (s.ax + s.bx) / 2 + s.nx * 20, my = (s.ay + s.by) / 2 + s.ny * 20;
  const a = add(W, 'port', mx, my), d = (a.x - s.ax) * s.nx + (a.y - s.ay) * s.ny;
  assert.ok(Math.abs(d - (5 + 0.8)) < 1e-6, 'cách mép ' + d);
  const [px, py] = b2w(a, 0, -5); assert.ok(Math.abs((px - s.ax) * s.nx + (py - s.ay) * s.ny - 0.8) < 1e-6, 'mạn trái sát cầu');
  assert.equal(a.lines.length, 4); for (const l of a.lines) { const e = lineEnd(W, l); assert.ok(e && !e.float); }
  const b = add(W, 'stbd', mx + s.tx * 120, my + s.ty * 120), [qx, qy] = b2w(b, 0, 5);
  assert.ok(Math.abs((qx - s.ax) * s.nx + (qy - s.ay) * s.ny - 0.8) < 1e-6, 'mạn phải sát cầu');
  assert.ok(W.segs.filter((q) => q.ship).length > 20, 'khối va chạm'); assert.equal(W.bollards.filter((q) => q.ship).length, 16, 'cọc bích trên boong');
});

test('cập mạn tàu khác (nhiều lớp), cập lái 2 neo, đậu neo 1 neo', () => {
  const W = setup(), s = W.segs[0], mx = (s.ax + s.bx) / 2 + s.nx * 20, my = (s.ay + s.by) / 2 + s.ny * 20;
  const a = add(W, 'port', mx, my), b = add(W, 'along', a.x + s.nx * 15, a.y + s.ny * 15, Object.assign({}, P, { B: 8, name: 'T2' }));
  assert.equal(b.host, a.id); assert.equal(b.hdg, a.hdg);
  assert.ok(Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - (5 + 4 + 0.8)) < 0.5);
  assert.equal(b.lines.length, 4); assert.ok(b.lines.every((l) => l.to.t === 'sb' && l.to.id === a.id));
  const c = add(W, 'along', b.x + s.nx * 12, b.y + s.ny * 12, Object.assign({}, P, { name: 'T3' })); assert.equal(c.host, b.id, 'lớp thứ ba cập vào tàu thứ hai');
  // dời tàu trong cùng: các lớp ngoài đi theo
  a.bs += 40; W.rebuild(); assert.ok(Math.abs((c.x - a.x) * s.tx + (c.y - a.y) * s.ty) < 1, 'lớp ngoài theo tàu trong');
  const d = add(W, 'stern', mx + s.tx * 100, my + s.ty * 100); assert.equal(d.anchors.length, 2); assert.equal(d.lines.length, 2);
  const fx = Math.sin(d.hdg * Math.PI / 180), fy = Math.cos(d.hdg * Math.PI / 180); assert.ok(fx * s.nx + fy * s.ny > 0.99, 'mũi quay ra ngoài');
  for (const an of d.anchors) assert.ok((an.x - d.x) * fx + (an.y - d.y) * fy > 30, 'neo ở phía trước mũi');
  const e = add(W, 'anchor', mx + s.nx * 600, my + s.ny * 600); assert.equal(e.anchors.length, 1); assert.equal(e.lines.length, 0);
});

test('lưu file lat/lon, mở lại đúng chỗ; theo gốc trôi', () => {
  const W = setup(), s = W.segs[0], a = add(W, 'port', (s.ax + s.bx) / 2 + s.nx * 20, (s.ay + s.by) / 2 + s.ny * 20), e = add(W, 'anchor', a.x + s.nx * 500, a.y + s.ny * 500);
  const F = JSON.parse(JSON.stringify(placesFile(W))); assert.equal(F.ships.length, 2); assert.ok(F.ships[0].lat && F.ships[1].anchors[0].lat);
  const W2 = setup(); const n = mergePlacesFile(W2, F); assert.equal(n.ships, 2);
  const a2 = W2.objs.ships.find((q) => q.id === a.id); assert.ok(Math.hypot(a2.x - a.x, a2.y - a.y) < 0.01 && Math.abs(a2.hdg - a.hdg) < 1e-6);
  const e2 = W2.objs.ships.find((q) => q.id === e.id), ll = CS.frame.toLL(e2.anchors[0].x, e2.anchors[0].y);
  const sub = (map) => W2.mapCoords(map); CS.originSubs.add(sub); setOrigin(20.6, 107.2); CS.originSubs.delete(sub);
  const ll2 = CS.frame.toLL(e2.anchors[0].x, e2.anchors[0].y); assert.ok(Math.abs(ll2[0] - ll[0]) < 1e-7 && Math.abs(ll2[1] - ll[1]) < 1e-7);
});

test('tàu mình đâm vào tàu đậu: có lực đẩy ra và báo va chạm tàu', () => {
  const W = setup(), s = W.segs[0], a = add(W, 'port', (s.ax + s.bx) / 2 + s.nx * 20, (s.ay + s.by) / 2 + s.ny * 20);
  const M = buildModel(defaultShip()), S = newState(M); // tàu mẫu 120 m, mũi lấn vào mạn phải tàu đậu 0,5 m, đang tiến vào
  const out = (5 - 0.5), psi = Math.atan2(-s.nx, -s.ny); S.psi = psi; S.x = a.x + s.nx * (out + M.loa / 2); S.y = a.y + s.ny * (out + M.loa / 2); S.u = 0.5;
  const info = {}, f = externalForces(W, S, M, [], [], 30, 0.1, info);
  assert.ok(info.hitShip, 'va chạm tàu'); assert.ok(f.X < -1e5, 'lực đẩy lùi ' + f.X);
});
