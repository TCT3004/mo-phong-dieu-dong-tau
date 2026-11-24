// Tab 2: độ sâu / độ cao app đọc từ hải đồ raster — thẻ trạng thái của tờ đang xem, công cụ «Độ sâu đọc được»
// (vẽ điểm lên hải đồ, bấm để sửa, bấm chỗ trống để thêm, Shift + bấm thêm độ cao, chuột phải để xóa), dựng lại mặt đáy sau khi sửa.
import { CS } from './chartsys.js';
import { uiPrompt, uiConfirm } from './dialog.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fnum = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');
const cache = new Map();   // id tờ → mô hình độ sâu (đã nạp)
const loading = new Set();
const pending = new Map(); // id tờ → { water, full, t }
let onChange = () => {};
export let selPt = null;   // { r, k: 'snd' | 'hts', i }

export function initDepthUI(redraw) {
  onChange = redraw;
  CS.catalog.on((ev) => {
    if (ev.type === 'removed') { cache.delete(ev.id); if (selPt && selPt.r.id === ev.id) selPt = null; onChange(); }
    // dựng lại xong: điểm trong bộ nhớ là bản mới nhất (chỗ sửa đã lưu), chỉ nạp lại khi không có chỗ sửa đang chờ
    if (ev.type === 'dmodel') { if (!pending.has(ev.id)) { const m = cache.get(ev.id); cache.delete(ev.id); if (m) modelOf(CS.catalog.byId.get(ev.id)); } onChange(); }
  });
}
// mô hình của tờ (nạp nền nếu chưa có trong bộ nhớ); null khi chưa có
export function modelOf(r) {
  if (!r || !r.dm || r.dm.st !== 'ok') return null;
  if (cache.has(r.id)) return cache.get(r.id);
  if (!loading.has(r.id)) { loading.add(r.id); CS.catalog.getDLite(r.id).then((m) => { loading.delete(r.id); if (m) { cache.set(r.id, m); onChange(); } }).catch(() => loading.delete(r.id)); }
  return null;
}
// dòng trạng thái trong danh sách kho
export function dmState(r) {
  const d = r.dm; if (r.kind !== 'kap' || !r.ready) return '';
  if (!d) return 'Chưa đọc độ sâu';
  if (d.st === 'run') return 'Đang đọc độ sâu… ' + Math.round((d.f || 0) * 100) + '%' + (d.s ? ' — ' + d.s : '');
  if (d.st === 'err') return 'Lỗi đọc độ sâu: ' + d.err;
  return 'Đã đọc ' + d.n.toLocaleString('vi-VN') + ' số đo sâu' + (d.sus ? ' (' + d.sus + ' nghi)' : '') + ' · ' + d.nh + ' độ cao' + (d.interval ? ' · bình độ ' + d.interval + ' m' : '');
}

// ---------- thẻ của tờ đang xem ----------
export function depthCard(r, tool) {
  if (!r) return '';
  if (r.kind !== 'kap') return `<section class="card"><h2>Độ sâu · ${esc(r.name)}</h2><div class="muted">Hải đồ PDF: app chưa đọc số độ sâu (sẽ làm ở bản sau), đang dùng độ sâu theo màu bên dưới.</div></section>`;
  const d = r.dm, run = d && d.st === 'run';
  let h = `<section class="card"><h2>Độ sâu đọc từ hải đồ · ${esc(r.name)}</h2>`;
  if (!d) h += `<div class="muted">App đọc các con số độ sâu, độ cao núi, đường bình độ trên tờ này rồi dựng mặt đáy và núi đúng như hải đồ (viền đảo theo đúng nét bờ). Mất khoảng 1 phút một tờ, chạy nền.</div><button class="btn pri sm" id="dmRead" style="margin-top:8px;width:100%">Đọc số độ sâu, độ cao</button>`;
  else if (run) h += `<div class="muted">Đang đọc… ${Math.round((d.f || 0) * 100)}% — ${esc(d.s || '')}</div><div class="bar" style="height:6px;background:#22303A;border-radius:3px;margin-top:6px"><div style="height:6px;width:${Math.round((d.f || 0) * 100)}%;background:#29B6F6;border-radius:3px"></div></div>`;
  else if (d.st === 'err') h += `<div class="note bad">Lỗi: ${esc(d.err || '')}</div><button class="btn sm" id="dmRead" style="margin-top:8px;width:100%">Đọc lại</button>`;
  else {
    h += `<div class="kv"><span>Số đo sâu</span><b>${d.n.toLocaleString('vi-VN')}</b></div><div class="kv"><span>Nghi đọc sai (chưa dùng)</span><b>${d.sus || 0}</b></div><div class="kv"><span>Độ cao (đỉnh / hòn)</span><b>${d.nh}</b></div>`;
    h += `<div class="kv"><span>Khoảng cao đường bình độ</span><b>${d.interval ? d.interval + ' m' : '—'}</b></div><div class="kv"><span>Mép bờ cao hơn số 0 hải đồ</span><b>${fnum(d.hc)} m</b></div>${d.interval ? '' : '<div class="muted">Không đọc được đường bình độ: núi dựng theo hình đảo và số độ cao.</div>'}`;
    h += `<div class="muted" style="margin-top:6px">${tool === 'depth' ? 'Điểm đỏ: số app đọc · cam: nghi sai (chưa dùng, bấm vào để xem rồi «Dùng» hoặc sửa) · xanh dương: số bạn sửa / thêm · xanh lá: độ cao. Bấm chỗ trống để thêm số đo sâu, Shift + bấm để thêm độ cao, chuột phải vào điểm để xóa.' : 'Chọn công cụ «Độ sâu đọc được» để xem và sửa từng điểm.'}</div>`;
    h += `<button class="btn sm" id="dmRead" style="margin-top:8px;width:100%">Đọc lại cả tờ</button>`;
  }
  return h + '</section>';
}
export function initDepthCard(r) {
  const b = $('#dmRead'); if (!b || !r) return;
  b.onclick = async () => {
    const m = cache.get(r.id) || (r.dm && r.dm.st === 'ok' ? await CS.catalog.getDLite(r.id) : null);
    const edited = m && (m.snd.some((s) => s.user) || m.hts.some((s) => s.user));
    if (edited && !await uiConfirm('Tờ này có điểm bạn đã sửa / thêm. Đọc lại cả tờ sẽ bỏ hết các chỗ sửa đó. Vẫn đọc lại?')) return;
    CS.catalog.readDepth(r).catch(() => {}); onChange();
  };
}
// thẻ điểm đang chọn
export function pointCard() {
  if (!selPt) return '';
  const m = cache.get(selPt.r.id), p = m && m[selPt.k][selPt.i]; if (!p) return '';
  if (selPt.k === 'hts') return `<section class="card"><h2>Đang chọn: độ cao</h2>${fldN('dpV', 'Độ cao', 'm', p.v)}<div class="muted" style="margin-top:4px">${p.kind ? 'Số trong ngoặc: độ cao cả hòn (đặt ở chỗ cao nhất của hòn gần nhất).' : 'Chấm cạnh số: vị trí đỉnh núi.'}${p.user ? ' Bạn đã sửa / thêm.' : ''}</div><button class="btn warn sm" id="dpDel" style="margin-top:8px">Xóa độ cao</button></section>`;
  const st = p.user ? 'bạn đã sửa / thêm' : p.sus ? 'nghi đọc sai — lệch hẳn các số xung quanh, chưa dùng để dựng mặt đáy' : 'app đọc tự động';
  return `<section class="card"><h2>Đang chọn: số đo sâu</h2>${fldN('dpV', p.dry ? 'Độ cao bãi cạn' : 'Độ sâu', 'm', p.v)}<label style="margin-top:6px;display:flex;gap:8px;align-items:center"><input type="checkbox" id="dpDry" ${p.dry ? 'checked' : ''} style="width:17px;height:17px"> Độ cao bãi cạn (số gạch chân, khô khi nước ròng)</label><div class="muted" style="margin-top:4px">${st}</div><div class="flex" style="gap:6px;margin-top:8px">${p.sus ? '<button class="btn sm pri" id="dpUse">Dùng điểm này</button>' : ''}<button class="btn warn sm" id="dpDel">Xóa điểm</button></div></section>`;
}
const fldN = (id, lb, unit, v) => `<div class="fld"><label for="${id}">${lb}</label><div class="in"><input id="${id}" value="${fnum(v)}" inputmode="decimal"><span class="u">${unit}</span></div></div>`;
export function initPointCard() {
  if (!selPt) return; const { r, k, i } = selPt, m = cache.get(r.id); if (!m) return;
  const v = $('#dpV'); if (v) v.onchange = () => { const x = parseFloat(v.value.replace(',', '.')); if (!isFinite(x) || x < 0) return; m[k][i].v = x; m[k][i].user = true; delete m[k][i].sus; edited(r, k, m); };
  const dr = $('#dpDry'); if (dr) dr.onchange = () => { m.snd[i].dry = dr.checked; m.snd[i].user = true; delete m.snd[i].sus; edited(r, 'snd', m); };
  const u = $('#dpUse'); if (u) u.onclick = () => { delete m.snd[i].sus; m.snd[i].user = true; edited(r, 'snd', m); };
  const d = $('#dpDel'); if (d) d.onclick = () => removePt(selPt);
}
function removePt(p) { const m = cache.get(p.r.id); if (!m) return; m[p.k].splice(p.i, 1); if (selPt && selPt.r === p.r && selPt.k === p.k) selPt = null; edited(p.r, p.k, m); }
// lưu chỗ sửa và hẹn dựng lại (số đo sâu: chỉ dựng lại mặt nước, nhanh; độ cao: dựng lại cả núi)
function edited(r, k, m0) {
  const m = m0 || cache.get(r.id); if (!m) return; cache.set(r.id, m);
  r.dm = Object.assign({}, r.dm, { n: m.snd.length, sus: m.snd.filter((s) => s.sus).length, nh: m.hts.length });
  CS.catalog.putDLite(r.id, m).then(() => CS.catalog.save(r));
  const q = pending.get(r.id) || { water: false, full: false, t: 0 }; if (k === 'hts') q.full = true; else q.water = true;
  clearTimeout(q.t); q.t = setTimeout(() => { pending.delete(r.id); const mm = cache.get(r.id) || m;
    if (q.full) CS.catalog.readDepth(r, { snd: mm.snd, hts: mm.hts }).catch(() => {}); else CS.catalog.readDepth(r, { water: true, model: mm }).catch(() => {}); }, 1500);
  pending.set(r.id, q); onChange();
}

// ---------- vẽ lên khung nhìn ----------
function ptsInView(v) {
  const [w, h] = v.size(), out = [];
  for (const r of CS.catalog.records) {
    if (!r.ready || !r.dm || r.dm.st !== 'ok' || !r.plyMerc) continue;
    const m = modelOf(r); if (!m) continue;
    for (const k of ['snd', 'hts']) m[k].forEach((p, i) => {
      const M = r.xf.pxToMerc(p.x, p.y), W = CS.frame.mercToWorld(M[0], M[1]), s = v.m2s(W[0], W[1]);
      if (s[0] < -20 || s[1] < -20 || s[0] > w + 20 || s[1] > h + 20) return;
      out.push({ r, k, i, p, s });
    });
  }
  return out;
}
export function drawDepthPts(v, g) {
  if (v.mPerPx() > 25) return;
  const txt = v.mPerPx() < 5; g.save(); g.font = 'bold 11px Segoe UI'; g.textAlign = 'left';
  for (const q of ptsInView(v)) {
    const { p, s, k } = q, sel = selPt && selPt.r === q.r && selPt.k === k && selPt.i === q.i;
    const col = k === 'hts' ? '#2E7D32' : p.user ? '#1565C0' : p.sus ? '#FF8F00' : '#D32F2F';
    g.fillStyle = col; g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath();
    if (k === 'hts') { g.moveTo(s[0], s[1] - 5); g.lineTo(s[0] + 4.5, s[1] + 3.5); g.lineTo(s[0] - 4.5, s[1] + 3.5); g.closePath(); } else g.arc(s[0], s[1], p.sus ? 4 : 3, 0, 7);
    g.fill(); g.stroke();
    if (sel) { g.strokeStyle = '#00B8D4'; g.lineWidth = 2; g.setLineDash([4, 3]); g.beginPath(); g.arc(s[0], s[1], 10, 0, 7); g.stroke(); g.setLineDash([]); }
    if (txt || sel) {
      const t = fnum(p.v), tw = g.measureText(t).width; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(s[0] + 5, s[1] - 15, tw + 4, 13);
      g.fillStyle = col; g.fillText(t, s[0] + 7, s[1] - 4);
      if (p.dry) { g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); g.moveTo(s[0] + 7, s[1] - 1.5); g.lineTo(s[0] + 7 + tw, s[1] - 1.5); g.stroke(); }
    }
  }
  g.restore();
}
// điểm gần nhất dưới con trỏ (≤ 9 điểm màn hình)
export function ptAt(v, sp) {
  let best = null, bd = 9;
  for (const q of ptsInView(v)) { const d = Math.hypot(q.s[0] - sp[0], q.s[1] - sp[1]); if (d < bd) { bd = d; best = { r: q.r, k: q.k, i: q.i }; } }
  return best;
}
// bấm bằng công cụ «Độ sâu đọc được»: chọn điểm / thêm điểm
export async function depthClick(v, sp, mx, my, shift) {
  const hit = ptAt(v, sp); if (hit) { selPt = hit; return true; }
  // tờ đã đọc chi tiết nhất có chứa điểm
  const Mm = CS.frame.worldToMerc(mx, my);
  const recs = CS.catalog.records.filter((r) => r.ready && r.dm && r.dm.st === 'ok' && cache.has(r.id) && r.plyMerc).sort((a, b) => a.mppMerc - b.mppMerc);
  const r = recs.find((q) => { const [px, py] = q.xf.mercToPx(Mm[0], Mm[1]); return px >= 0 && py >= 0 && px < q.W && py < q.H; });
  if (!r) return false;
  const m = cache.get(r.id), [px, py] = r.xf.mercToPx(Mm[0], Mm[1]);
  const s = await uiPrompt(shift ? 'Độ cao tại đây (m, tính từ số 0 hải đồ — đỉnh núi / hòn):' : 'Độ sâu tại đây (m). Độ cao bãi cạn (khô khi nước ròng) gõ số âm, ví dụ −0,5:', '');
  if (s === null || s === undefined || String(s).trim() === '') return false;
  const x = parseFloat(String(s).replace(',', '.').replace('−', '-')); if (!isFinite(x)) return false;
  const mm = cache.get(r.id) || m; // mô hình có thể vừa được nạp lại trong lúc gõ số
  if (shift) { mm.hts.push({ x: Math.round(px), y: Math.round(py), v: Math.abs(x), kind: 0, user: true }); selPt = { r, k: 'hts', i: mm.hts.length - 1 }; edited(r, 'hts', mm); }
  else { mm.snd.push({ x: Math.round(px * 10) / 10, y: Math.round(py * 10) / 10, v: Math.abs(x), dry: x < 0, user: true }); selPt = { r, k: 'snd', i: mm.snd.length - 1 }; edited(r, 'snd', mm); }
  return true;
}
export function depthRightClick(v, sp) { const hit = ptAt(v, sp); if (!hit) return false; removePt(hit); return true; }
export function clearSel() { selPt = null; }
