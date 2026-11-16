// Cờ treo trên cột cao nhất của tàu: cờ Tổ quốc mạn phải, cờ Hải quân mạn trái thấp hơn 20 cm
// (nhìn từ lái lên mũi). Cờ bay theo gió biểu kiến, gió yếu thì rủ xuống.
import * as THREE from 'three';

export const FLAG_MODES = [['hq', 'Cờ Tổ quốc + cờ Hải quân'], ['vn', 'Chỉ cờ Tổ quốc'], ['none', 'Không treo cờ']];

const TW = 300, TH = 200; // tỷ lệ cờ 2:3

function star(g, cx, cy, R, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r : R; g.lineTo(cx + q * Math.cos(a), cy + q * Math.sin(a)); }
  g.closePath(); g.fill();
}

// cờ đỏ sao vàng: sao năm cánh ở giữa, bán kính ngoài = 3/10 chiều rộng cờ
function texVN() {
  const c = document.createElement('canvas'); c.width = TW; c.height = TH; const g = c.getContext('2d');
  g.fillStyle = '#DA251D'; g.fillRect(0, 0, TW, TH);
  g.fillStyle = '#FFFF00'; star(g, TW / 2, TH / 2, TH * 0.3, TH * 0.3 * 0.382);
  return c;
}

// cờ Hải quân (2014): nền trắng, dải xanh dương ở dưới, góc trên phía cán có quân hiệu Hải quân và dòng chữ đỏ
// «HẢI QUÂN VIỆT NAM». Quân hiệu vẽ giản lược (nhìn từ buồng lái chỉ thấy cỡ vài chục điểm ảnh).
function texHQ() {
  const c = document.createElement('canvas'); c.width = TW; c.height = TH; const g = c.getContext('2d');
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, TW, TH);
  g.fillStyle = '#1B3F8B'; g.fillRect(0, TH * 0.78, TW, TH * 0.22);
  const cx = TW * 0.22, cy = TH * 0.3, R = TH * 0.19;
  // mỏ neo phía sau
  g.strokeStyle = '#1B3F8B'; g.lineWidth = TH * 0.025; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx, cy - R * 1.05); g.lineTo(cx, cy + R * 1.0); g.stroke();
  g.beginPath(); g.arc(cx, cy + R * 0.35, R * 0.68, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  g.beginPath(); g.moveTo(cx - R * 0.45, cy - R * 0.78); g.lineTo(cx + R * 0.45, cy - R * 0.78); g.stroke();
  // bông lúa vàng hai bên
  g.fillStyle = '#E8B21C';
  for (const s of [-1, 1]) for (let k = 0; k < 7; k++) {
    const a = Math.PI / 2 + s * (0.25 + k * 0.32), x = cx + Math.cos(a) * R * 0.92, y = cy + Math.sin(a) * R * 0.92;
    g.save(); g.translate(x, y); g.rotate(a + s * 0.6); g.beginPath(); g.ellipse(0, 0, R * 0.2, R * 0.08, 0, 0, 7); g.fill(); g.restore();
  }
  // nền đỏ sao vàng ở giữa
  g.fillStyle = '#DA251D'; g.beginPath(); g.arc(cx, cy, R * 0.55, 0, 7); g.fill();
  g.fillStyle = '#FFE000'; star(g, cx, cy, R * 0.42, R * 0.42 * 0.382);
  // chữ
  g.fillStyle = '#C8102E'; g.font = `bold ${Math.round(TH * 0.075)}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('HẢI QUÂN VIỆT NAM', cx, cy + R * 1.42, TW * 0.4);
  return c;
}

// lưới cờ: cạnh cán ở x = 0, cạnh bay ở x = w; mép trên y = 0, mép dưới y = −h
function flagMesh(canvas, w, h) {
  const nx = 16, ny = 8, geo = new THREE.PlaneGeometry(w, h, nx, ny);
  const base = geo.attributes.position.array.slice();
  for (let i = 0; i < base.length; i += 3) { base[i] += w / 2; base[i + 1] -= h / 2; }
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
  return { mesh: m, geo, base, w, h };
}

// mode: 'hq' | 'vn' | 'none'; x: mũi (+) theo trục tàu; y: cao trên đường nước; span: nửa xà (mét)
export function makeFlags(parent, mode, L, x, y, span) {
  const out = { items: [], update() {} };
  if (mode === 'none') return out;
  const w = Math.max(0.8, Math.min(2.2, 0.022 * L)), h = w * 2 / 3;
  const add = (canvas, side, dy, ph) => {
    const f = flagMesh(canvas, w, h), gr = new THREE.Group();
    gr.position.set(side * span, y + dy, -x); gr.add(f.mesh); parent.add(gr);
    // dây kéo cờ từ đầu xà xuống
    const ln = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, h + 0.3, 4), new THREE.MeshBasicMaterial({ color: 0x404850 }));
    ln.position.set(side * span, y + dy - h / 2, -x); parent.add(ln);
    f.gr = gr; f.ph = ph; out.items.push(f);
  };
  add(texVN(), 1, 0, 0);
  if (mode !== 'vn') add(texHQ(), -1, -0.2, 1.7);
  // rel: hướng gió biểu kiến thổi tới (rad, tính từ mũi theo chiều kim đồng hồ); kn: tốc độ gió biểu kiến
  out.update = (t, rel, kn) => {
    const s = Math.max(0, Math.min(1, kn / 14)), al = 1.45 * Math.pow(1 - s, 1.6), ca = Math.cos(al), sa = Math.sin(al);
    for (const f of out.items) {
      f.gr.rotation.y = Math.PI / 2 - rel;
      const p = f.geo.attributes.position.array, b = f.base, amp = f.h * (0.04 + 0.13 * s), om = 2.5 + 7 * s, k = 2 * Math.PI / (0.8 * f.w);
      for (let i = 0; i < p.length; i += 3) {
        const d = b[i], v = b[i + 1], u = d / f.w, wv = Math.sin(k * d - om * t + f.ph + v * 1.3);
        p[i] = d * ca; p[i + 1] = v - d * sa + 0.25 * amp * u * wv; p[i + 2] = amp * u * wv;
      }
      f.geo.attributes.position.needsUpdate = true; f.geo.computeVertexNormals();
    }
  };
  return out;
}
