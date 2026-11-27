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
  const q = CS.catalog.depthQueuePos(r.id);
  if (q >= 1) return (d && d.st === 'ok' ? 'Chờ dựng lại mặt đáy' : 'Chờ đọc độ sâu') + ' — thứ ' + q + ' trong hàng';
  if (!d) return 'Chưa đọc độ sâu';
  if (d.st === 'run' && q < 0) return 'Đọc dở (app tắt giữa chừng) — sẽ đọc lại';
  if (d.st === 'run') return 'Đang đọc độ sâu… ' + Math.round((d.f || 0) * 100) + '%' + (d.s ? ' — ' + d.s : '');
  if (d.st === 'err') return 'Lỗi đọc độ sâu: ' + d.err;
  return 'Đã đọc ' + d.n.toLocaleString('vi-VN') + ' số đo sâu' + (d.sus ? ' (' + d.sus + ' nghi)' : '') + ' · ' + d.nh + ' độ cao' + (d.interval ? ' · bình độ ' + d.interval + ' m' : '');
}

// ---------- thẻ của tờ đang xem ----------
export function depthCard(r, tool) {
  if (!r) return '';
  if (r.kind !== 'kap') return `<section class="card"><h2>Độ sâu · ${esc(r.name)}</h2><div class="muted">Hải đồ PDF: app chưa đọc số độ sâu (sẽ làm ở bản sau), đang dùng độ sâu theo màu bên dưới.</div></section>`;
  const d = r.dm, q = CS.catalog.depthQueuePos(r.id), qi = CS.catalog.depthQueueInfo(), run = d && d.st === 'run' && q === 0;
  let h = `<section class="card"><h2>Độ sâu đọc từ hải đồ · ${esc(r.name)}</h2>`;
  if (q >= 1) { const j = CS.catalog.depthJob(r.id);
    h += `<div class="note" style="margin-bottom:6px">Đang chờ ${d && d.st === 'ok' ? 'dựng lại mặt đáy' : 'đọc độ sâu'} — thứ ${q} trong hàng${qi.cur ? ' · đang đọc tờ ' + esc(qi.cur.name) : ''}.${j && j.pri ? ' Bạn đã bấm: tờ này được làm ngay sau tờ đang đọc.' : ''}</div>`;
    if (j && !j.pri) h += `<button class="btn pri sm" id="dmNow" style="margin-bottom:8px;width:100%">Đọc tờ này ngay</button>`; }
  else if (q === 0 && d && d.st === 'ok') h += `<div class="note" style="margin-bottom:6px">Đang dựng lại mặt đáy theo số mới…</div>`;
  if (q >= 1 && (!d || d.st !== 'ok')) return h + '</section>'; // chưa có gì để xem, chỉ báo đang chờ
  if (!d || (d.st === 'run' && q < 0)) h += `<div class="muted">App đọc các con số độ sâu, độ cao núi, đường bình độ trên tờ này rồi dựng mặt đáy và núi đúng như hải đồ (viền đảo theo đúng nét bờ). Mất khoảng 1 phút một tờ, chạy nền.${d ? ' Lần trước đọc dở (app tắt giữa chừng).' : ''}</div><button class="btn pri sm" id="dmRead" style="margin-top:8px;width:100%">Đọc số độ sâu, độ cao</button>`;
  else if (run) h += `<div class="muted">Đang đọc… ${Math.round((d.f || 0) * 100)}% — ${esc(d.s || '')}</div><div class="bar" style="height:6px;background:#22303A;border-radius:3px;margin-top:6px"><div style="height:6px;width:${Math.round((d.f || 0) * 100)}%;background:#29B6F6;border-radius:3px"></div></div>`;
  else if (d.st === 'err') h += `<div class="note bad">Lỗi: ${esc(d.err || '')}</div><button class="btn sm" id="dmRead" style="margin-top:8px;width:100%">Đọc lại</button>`;
  else {
    h += `<div class="kv"><span>Số đo sâu</span><b>${d.n.toLocaleString('vi-VN')}</b></div><div class="kv"><span>Nghi đọc sai (chưa dùng)</span><b${d.sus ? ' style="color:#FFD600"' : ''}>${d.sus || 0}</b></div><div class="kv"><span>Độ cao (đỉnh / hòn)</span><b>${d.nh}</b></div>`;
    if (d.alg >= 4) h += `<div class="kv"><span>Đường đẳng sâu dùng được</span><b>${d.iso || 0}</b></div>`;
    h += `<div class="kv"><span>Khoảng cao đường bình độ</span><b>${d.interval ? d.interval + ' m' : '—'}</b></div><div class="kv"><span>Mép bờ cao hơn số 0 hải đồ</span><b>${fnum(d.hc)} m</b></div>${d.interval ? '' : '<div class="muted">Không đọc được đường bình độ: núi dựng theo hình đảo và số độ cao.</div>'}`;
    h += `<div class="muted" style="margin-top:6px">${tool === 'depth' ? 'Điểm đỏ: số app đọc · vòng vàng nhấp nháy: nghi sai (chưa dùng, đi lần lượt bằng «Sau ›» ở thẻ trên) · xanh dương: số bạn sửa / thêm · xanh lá: độ cao. Bấm chỗ trống để thêm số đo sâu, Shift + bấm để thêm độ cao, chuột phải vào điểm để xóa.' : 'Chọn công cụ «Độ sâu đọc được» để xem và sửa từng điểm.'}</div>`;
    if (tool !== 'depth' && d.sus) h += `<button class="btn pri sm" id="dmSusGo" style="margin-top:8px;width:100%">Sửa ${d.sus} điểm nghi sai</button>`;
    h += `<button class="btn sm" id="dmRead" style="margin-top:8px;width:100%">Đọc lại cả tờ</button>`;
  }
  return h + '</section>';
}
export function initDepthCard(r) {
  // tờ đang chờ trong hàng nền: chen lên đầu hàng (giữ nguyên việc phải làm)
  const nb = $('#dmNow'); if (nb && r) nb.onclick = () => { const j = CS.catalog.depthJob(r.id); CS.catalog.readDepth(r, j ? j.opt : {}, true).catch(() => {}); onChange(); };
  const b = $('#dmRead'); if (!b || !r) return;
  b.onclick = async () => {
    const m = cache.get(r.id) || (r.dm && r.dm.st === 'ok' ? await CS.catalog.getDLite(r.id) : null);
    const edited = m && (m.snd.some((s) => s.user) || m.hts.some((s) => s.user));
    if (edited && !await uiConfirm('Tờ này có điểm bạn đã sửa / thêm. Đọc lại cả tờ sẽ bỏ hết các chỗ sửa đó. Vẫn đọc lại?')) return;
    CS.catalog.readDepth(r, {}, true).catch(() => {}); onChange();
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
  if (performance.now() < focusUntil) { const e = $('#dpV'); if (e) { e.focus(); e.select(); } }
  const v = $('#dpV'); if (v) v.onchange = () => { const x = parseFloat(v.value.replace(',', '.')); if (!isFinite(x) || x < 0) return; m[k][i].v = x; m[k][i].user = true; delete m[k][i].sus; edited(r, k, m); };
  const dr = $('#dpDry'); if (dr) dr.onchange = () => { m.snd[i].dry = dr.checked; m.snd[i].user = true; delete m.snd[i].sus; edited(r, 'snd', m); };
  const u = $('#dpUse'); if (u) u.onclick = () => { delete m.snd[i].sus; m.snd[i].user = true; edited(r, 'snd', m); };
  const d = $('#dpDel'); if (d) d.onclick = () => removePt(selPt);
}
function removePt(p) {
  const m = cache.get(p.r.id); if (!m) return; const q = m[p.k][p.i];
  if (q && p.k === 'snd') navFrom = { r: p.r, key: susKey(p.r, q) }; // «Sau ›» đi tiếp từ chỗ điểm vừa xóa
  m[p.k].splice(p.i, 1); if (selPt && selPt.r === p.r && selPt.k === p.k) selPt = null; edited(p.r, p.k, m);
}
// lưu chỗ sửa và hẹn dựng lại (số đo sâu: chỉ dựng lại mặt nước, nhanh; độ cao: dựng lại cả núi)
function edited(r, k, m0) {
  const m = m0 || cache.get(r.id); if (!m) return; cache.set(r.id, m);
  r.dm = Object.assign({}, r.dm, { n: m.snd.length, sus: m.snd.filter((s) => s.sus).length, nh: m.hts.length });
  CS.catalog.putDLite(r.id, m).then(() => CS.catalog.save(r));
  const q = pending.get(r.id) || { water: false, full: false, t: 0 }; if (k === 'hts') q.full = true; else q.water = true;
  clearTimeout(q.t); q.t = setTimeout(() => { pending.delete(r.id); const mm = cache.get(r.id) || m;
    if (q.full) CS.catalog.readDepth(r, { snd: mm.snd, hts: mm.hts }, true).catch(() => {}); else CS.catalog.readDepth(r, { water: true, model: mm }, true).catch(() => {}); }, 1500);
  pending.set(r.id, q); onChange();
}

// ---------- vẽ lên khung nhìn ----------
const ALL_MAX_MPP = 25, SUS_MAX_MPP = 400; // thu nhỏ quá 25 m / điểm màn hình: chỉ còn vòng điểm nghi sai (tới 400 m / điểm)
let onlySus = false, pulseT = 0, focusUntil = 0, navFrom = null; // navFrom: chỗ điểm vừa xóa { r, key }
const boxOf = new WeakMap(); // plyMerc của tờ → khung bao Mercator
function recBox(r) {
  let b = boxOf.get(r.plyMerc); if (b) return b; b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of r.plyMerc) { if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; }
  boxOf.set(r.plyMerc, b); return b;
}
// các tờ đã đọc có vùng chạm khung nhìn (không nạp điểm của tờ ở xa)
function recsInView(v) {
  const bb = v.vpMerc().bbox;
  return CS.catalog.records.filter((r) => { if (!r.ready || !r.dm || r.dm.st !== 'ok' || !r.plyMerc) return false; const b = recBox(r); return b[0] <= bb[2] && b[2] >= bb[0] && b[1] <= bb[3] && b[3] >= bb[1]; });
}
const isSel = (r, k, i) => selPt && selPt.r === r && selPt.k === k && selPt.i === i;
// các điểm đang hiện trên khung nhìn (theo mức phóng và ô «Chỉ hiện điểm nghi sai»); điểm đang chọn luôn hiện
function ptsInView(v) {
  const [w, h] = v.size(), mpp = v.mPerPx(), out = []; if (mpp > SUS_MAX_MPP) return out;
  const all = mpp <= ALL_MAX_MPP && !onlySus;
  for (const r of recsInView(v)) {
    if (!all && !r.dm.sus && !(selPt && selPt.r === r)) continue;
    const m = modelOf(r); if (!m) continue;
    for (const k of ['snd', 'hts']) m[k].forEach((p, i) => {
      if (!all && !(k === 'snd' && p.sus) && !isSel(r, k, i)) return;
      const M = r.xf.pxToMerc(p.x, p.y), W = CS.frame.mercToWorld(M[0], M[1]), s = v.m2s(W[0], W[1]);
      if (s[0] < -30 || s[1] < -30 || s[0] > w + 30 || s[1] > h + 30) return;
      out.push({ r, k, i, p, s, sus: k === 'snd' && !!p.sus });
    });
  }
  return out;
}
const susR = (v) => (v.mPerPx() > ALL_MAX_MPP ? 8 : 11) + 3 * (Math.sin(performance.now() / 400) + 1) / 2; // bán kính vòng nghi sai (nhấp nháy)
export function drawDepthPts(v, g) {
  const pts = ptsInView(v); if (!pts.length) return;
  pts.sort((a, b) => a.sus - b.sus); // điểm nghi sai vẽ sau cùng, nằm trên các điểm khác
  const txt = v.mPerPx() < 5, R = susR(v); let nSus = 0;
  g.save(); g.textAlign = 'left';
  for (const q of pts) {
    const { p, s, k, sus } = q, sel = isSel(q.r, k, q.i);
    const col = k === 'hts' ? '#2E7D32' : p.user ? '#1565C0' : '#D32F2F';
    if (sus) { // vòng vàng to, viền tối bên ngoài để nổi trên mọi màu hải đồ
      nSus++;
      g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.arc(s[0], s[1], R, 0, 7); g.stroke();
      g.lineWidth = 3.5; g.strokeStyle = '#FFD600'; g.beginPath(); g.arc(s[0], s[1], R, 0, 7); g.stroke();
      g.fillStyle = '#FFD600'; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.arc(s[0], s[1], 3, 0, 7); g.fill(); g.stroke();
    } else {
      g.fillStyle = col; g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath();
      if (k === 'hts') { g.moveTo(s[0], s[1] - 5); g.lineTo(s[0] + 4.5, s[1] + 3.5); g.lineTo(s[0] - 4.5, s[1] + 3.5); g.closePath(); } else g.arc(s[0], s[1], 3, 0, 7);
      g.fill(); g.stroke();
    }
    if (sel) { g.strokeStyle = '#00E5FF'; g.lineWidth = 2.5; g.setLineDash([5, 3]); g.beginPath(); g.arc(s[0], s[1], sus ? R + 7 : 10, 0, 7); g.stroke(); g.setLineDash([]); }
    if (sus) { // số app đọc luôn hiện cạnh vòng, chữ vàng trên nền tối
      g.font = 'bold 13px Segoe UI'; const t = fnum(p.v), tw = g.measureText(t).width, x = s[0] + R + 6, y = s[1] - 9;
      g.fillStyle = 'rgba(20,16,0,.88)'; g.fillRect(x - 3, y - 1, tw + 6, 17); g.fillStyle = '#FFD600'; g.fillText(t, x, y + 12);
      if (p.dry) { g.strokeStyle = '#FFD600'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y + 14.5); g.lineTo(x + tw, y + 14.5); g.stroke(); }
    } else if (txt || sel) {
      g.font = 'bold 11px Segoe UI'; const t = fnum(p.v), tw = g.measureText(t).width; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(s[0] + 5, s[1] - 15, tw + 4, 13);
      g.fillStyle = col; g.fillText(t, s[0] + 7, s[1] - 4);
      if (p.dry) { g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); g.moveTo(s[0] + 7, s[1] - 1.5); g.lineTo(s[0] + 7 + tw, s[1] - 1.5); g.stroke(); }
    }
  }
  g.restore();
  if (nSus && !pulseT) pulseT = setTimeout(() => { pulseT = 0; v.dirty = true; }, 90); // còn vòng nghi sai thì vẽ lại ~10 lần / giây cho nhấp nháy
}
// điểm gần nhất dưới con trỏ (≤ 9 điểm màn hình; vòng nghi sai ≤ 16)
export function ptAt(v, sp) {
  let best = null, bd = Infinity;
  for (const q of ptsInView(v)) { const d = Math.hypot(q.s[0] - sp[0], q.s[1] - sp[1]); if (d < (q.sus ? 16 : 9) && d < bd) { bd = d; best = { r: q.r, k: q.k, i: q.i }; } }
  return best;
}
// ---------- đi lần lượt qua các điểm nghi sai ----------
// thứ tự quét: chia tờ thành dải ngang, dải chẵn đi trái → phải, dải lẻ phải → trái (kiểu luống cày) để hai điểm liền nhau ở gần nhau
const susKey = (r, p) => { const b = Math.floor(p.y / Math.max(200, r.H / 12)); return b * 1e6 + (b % 2 ? r.W - p.x : p.x); };
function susList(r) {
  const m = modelOf(r); if (!m) return null; const L = [];
  m.snd.forEach((p, i) => { if (p.sus && !p.del) L.push({ i, key: susKey(r, p) }); });
  return L.sort((a, b) => a.key - b.key || a.i - b.i);
}
// tờ để đi qua: tờ của điểm đang chọn → tờ đang xem → tờ chi tiết nhất trong khung nhìn còn điểm nghi sai
function susChart(v) {
  const has = (r) => r && r.dm && r.dm.st === 'ok' && r.dm.sus > 0;
  if (selPt && has(selPt.r)) return selPt.r;
  if (has(v.ref)) return v.ref;
  return recsInView(v).filter(has).sort((a, b) => a.mppMerc - b.mppMerc)[0] || null;
}
const onlyBox = () => `<label style="margin-top:8px;display:flex;gap:8px;align-items:center"><input type="checkbox" id="susOnly" ${onlySus ? 'checked' : ''} style="width:17px;height:17px"> Chỉ hiện điểm nghi sai (ẩn các điểm khác)</label>`;
// thẻ «Điểm nghi đọc sai» (công cụ «Độ sâu đọc được»)
export function susCard(v) {
  const r = susChart(v);
  if (!r) return v.ref && v.ref.dm && v.ref.dm.st === 'ok' ? `<section class="card"><h2>Điểm nghi đọc sai</h2><div class="muted">Không còn điểm nghi sai trên tờ đang xem.</div>${onlySus ? onlyBox() : ''}</section>` : '';
  const L = susList(r);
  if (!L) return `<section class="card"><h2>Điểm nghi đọc sai · ${esc(r.name)}</h2><div class="muted">Đang nạp các điểm…</div></section>`;
  if (!L.length) return `<section class="card"><h2>Điểm nghi đọc sai · ${esc(r.name)}</h2><div class="muted">Không còn điểm nghi sai trên tờ này.</div>${onlyBox()}</section>`;
  const cur = selPt && selPt.r === r && selPt.k === 'snd' ? L.findIndex((q) => q.i === selPt.i) : -1;
  return `<section class="card" style="border-color:#8A7400"><h2>Điểm nghi đọc sai · ${esc(r.name)}</h2>
    <div class="kv"><span>${cur >= 0 ? 'Đang xem điểm' : 'Còn phải xem'}</span><b style="color:#FFD600">${cur >= 0 ? (cur + 1) + ' / ' + L.length : L.length + ' điểm'}</b></div>
    <div class="flex" style="gap:6px;margin-top:8px"><button class="btn sm" id="susPrev" style="flex:1">‹ Trước</button><button class="btn pri sm" id="susNext" style="flex:1">Sau ›</button></div>
    <div class="muted" style="margin-top:6px">«Sau ›» đưa hải đồ tới điểm kế tiếp (vòng vàng). So với số in trên hải đồ: app đọc đúng thì bấm «Dùng điểm này», sai thì gõ số đúng vào ô Độ sâu rồi Enter, không phải số độ sâu (chữ, nét vẽ, số độ cao) thì «Xóa điểm».</div>${onlyBox()}</section>`;
}
export function initSusCard(v, done) {
  const o = $('#susOnly'); if (o) o.onchange = () => { onlySus = o.checked; done(); };
  const n = $('#susNext'), p = $('#susPrev');
  if (n) n.onclick = () => { if (susJump(v, 1)) done(); };
  if (p) p.onclick = () => { if (susJump(v, -1)) done(); };
}
// nhảy tới điểm nghi sai kế tiếp (dir 1) / trước đó (dir −1); chưa chọn điểm nào thì tới điểm gần tâm khung nhìn nhất
export function susJump(v, dir) {
  const r = susChart(v), L = r && susList(r), m = r && cache.get(r.id); if (!L || !L.length || !m) return false;
  const sp = selPt && selPt.r === r && selPt.k === 'snd' && m.snd[selPt.i], nf = !sp && navFrom && navFrom.r === r ? navFrom : null; let j;
  navFrom = null;
  if (sp || nf) {
    const k0 = sp ? susKey(r, sp) : nf.key, i0 = sp ? selPt.i : -1, after = (q) => q.key > k0 || (q.key === k0 && q.i > i0), before = (q) => q.key < k0 || (q.key === k0 && q.i < i0);
    if (dir > 0) { j = L.findIndex(after); if (j < 0) j = 0; } else { j = L.length - 1; while (j >= 0 && !before(L[j])) j--; if (j < 0) j = L.length - 1; }
  } else {
    const [w, h] = v.size(); let bd = Infinity; j = 0;
    L.forEach((q, t) => { const p = m.snd[q.i], M = r.xf.pxToMerc(p.x, p.y), W = CS.frame.mercToWorld(M[0], M[1]), s = v.m2s(W[0], W[1]), d = Math.hypot(s[0] - w / 2, s[1] - h / 2); if (d < bd) { bd = d; j = t; } });
  }
  const i = L[j].i, p = m.snd[i], M = r.xf.pxToMerc(p.x, p.y), W = CS.frame.mercToWorld(M[0], M[1]);
  v.centerM(W[0], W[1]);
  const want = (r.pxM || 4) * 0.8; if (v.mPerPx() > want) v.setMpp(want); // phóng vừa đủ đọc số in trên hải đồ; đang phóng to hơn thì giữ
  selPt = { r, k: 'snd', i }; focusUntil = performance.now() + 1500; v.dirty = true;
  return true;
}
// bấm bằng công cụ «Độ sâu đọc được»: chọn điểm / thêm điểm
export async function depthClick(v, sp, mx, my, shift) {
  navFrom = null; const hit = ptAt(v, sp); if (hit) { selPt = hit; return true; }
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
