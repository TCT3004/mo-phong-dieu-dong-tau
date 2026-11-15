// Kiểm thử georef KAP: điểm REF theo VN-2000 phải được quy về WGS-84
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGeo, pxToLL } from '../src/kap.js';
import { toWGS84 } from '../src/geo/datum.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b}`);
const refs = [{ x: 0, y: 0, lat: 21.30, lon: 107.40 }, { x: 4000, y: 0, lat: 21.30, lon: 107.60 }, { x: 0, y: 3000, lat: 21.15, lon: 107.40 }, { x: 4000, y: 3000, lat: 21.15, lon: 107.60 }];
const hdr = (datum) => ({ W: 4000, H: 3000, datum, refs });

test('KAP ghi GD=VN-2000: tọa độ hải đồ quy về WGS-84', () => {
  const g = makeGeo(hdr('VN-2000')); assert.equal(g.datum, 'VN2000');
  for (const r of refs) {
    const [la, lo] = pxToLL(g, r.x, r.y), [ela, elo] = toWGS84(r.lat, r.lon, 'VN2000');
    near((la - ela) * 111320, 0, 1, 'lat (m)'); near((lo - elo) * 111320 * Math.cos(r.lat * Math.PI / 180), 0, 1, 'lon (m)');
  }
});
test('KAP ghi GD=WGS_84 hoặc không ghi: giữ nguyên tọa độ', () => {
  for (const d of ['WGS_84', '']) {
    const g = makeGeo(hdr(d)), [la, lo] = pxToLL(g, 0, 0);
    near(la, 21.30, 1e-6, 'lat'); near(lo, 107.40, 1e-6, 'lon');
  }
  assert.equal(makeGeo(hdr('')).datumKnown, false);
});
