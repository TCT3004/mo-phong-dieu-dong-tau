// Cảnh trên bờ: cây / nhà chỉ mọc trên đất, theo lưới gắn tọa độ thế giới (dựng lại quanh chỗ khác vẫn đúng chỗ cũ)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildScenery } from '../src/scenery.js';

// lưới giả: đất ở x > 0 (cao dần), nước ở x ≤ 0
function grid(cx, cy, D = 600, d0 = 20) {
  const ax = []; for (let v = -D; v <= D; v += d0) ax.push(v);
  const n = ax.length, xs = ax.map((v) => cx + v), ys = ax.map((v) => cy + v), cls = new Uint8Array(n * n), dist = new Float32Array(n * n), pos = new Float32Array(n * n * 3);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const o = j * n + i, x = xs[i], land = x > 0; cls[o] = land ? 0 : 4; dist[o] = land ? x : 0; pos[o * 3] = x; pos[o * 3 + 1] = land ? 2.5 + 0.05 * x : -8; pos[o * 3 + 2] = -ys[j]; }
  return { xs, ys, n, cls, dist, pos, cx, cy, D, segs: [], glow: null };
}
const pts = (g) => { const out = []; const M = new THREE.Matrix4(); for (const m of g.children) if (m.isInstancedMesh && m.geometry.type !== 'BoxGeometry' && m.geometry.type !== 'BufferGeometry') for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, M); out.push([M.elements[12], -M.elements[14], M.elements[13]]); } return out; };

test('cây chỉ mọc trên đất, cách mép nước', () => {
  const g = buildScenery(THREE, grid(0, 0), 'max'); assert.ok(g, 'có cảnh');
  const t = pts(g); assert.ok(t.length > 20, 'có cây: ' + t.length);
  for (const [x] of t) assert.ok(x >= 10, 'cây ở x=' + x);
});

test('dựng lại quanh chỗ khác: cây trong vùng chung vẫn đúng chỗ', () => {
  const a = pts(buildScenery(THREE, grid(0, 0), 'max')), b = pts(buildScenery(THREE, grid(200, 100), 'max'));
  const inA = (p) => p[0] > -400 && p[0] < 600 && p[1] > -500 && p[1] < 600, key = (p) => p[0].toFixed(2) + ',' + p[1].toFixed(2);
  const sa = new Set(a.filter(inA).map(key)), sb = b.filter(inA).map(key);
  assert.ok(sb.length > 10); let same = 0; for (const k of sb) if (sa.has(k)) same++;
  assert.ok(same / sb.length > 0.95, `trùng ${same}/${sb.length}`);
});
