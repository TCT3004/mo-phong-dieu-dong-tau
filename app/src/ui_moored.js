// Tab 2 · tàu đậu ở cảng: chọn tàu trong kho (loại → tên), kiểu cập, bấm lên hải đồ để đặt, kéo để dời, sửa từng dây, độ dài xích neo.
import { uiAlert } from './dialog.js';
import { A, esc, num } from './app.js';
import { getFleetShip, ensureFleetShip } from './fleet.js';
import { fillFleet } from './ui_fleet.js';
import { MOOR_MODES, PTS, PTS_S, LINE_NAMES, placeShip, defaultLines, defaultAnchors, newMoored, outline, b2w, deckPt, hawse, lineEnd, dependsOn, anchorDown, moveAnchor, clearAnchor, redropAnchor } from './moored.js';
import { fmtDist } from './nav.js';

export const ms = { ref: 'tpl:hang50', mode: 'port' };
const fsel = (id, label, opts, val) => `<div class="fld"><label for="${id}">${label}</label><div class="in"><select id="${id}">${opts.map((o) => `<option value="${esc(o[0])}" ${String(o[0]) === String(val) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></div></div>`;

export const MOOR_HINT = 'Chọn loại → tên tàu và kiểu cập ở khung bên phải, rồi bấm lên hải đồ: cập bến thì bấm gần mép cầu; cập mạn tàu khác thì bấm sát tàu đó (bấm phía mạn muốn cập); đậu neo thì bấm chỗ thả neo. Dùng «Chọn / kéo» để kéo tàu dời đi, chuột phải vào tàu để xóa. Neo (cập lái, đậu neo): kéo ký hiệu neo để dời — xích dài / ngắn theo; chuột phải vào neo để xóa.';

// tàu đậu dưới điểm màn hình p
export function shipAt(v, p) {
  for (const sh of (A.W.objs.ships || []).slice().reverse()) {
    const P = outline(sh, 8).map(([bx, by]) => v.m2s(...b2w(sh, bx, by))); let inn = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inn = !inn; }
    const c = v.m2s(sh.x, sh.y); if (inn || Math.hypot(c[0] - p[0], c[1] - p[1]) < 9) return sh;
  }
  return null;
}
// neo của tàu đậu dưới điểm màn hình p (ký hiệu neo): { sh, a, i }
export function anchorAtPt(v, p) {
  let best = null, bd = 11;
  for (const sh of A.W.objs.ships || []) (sh.anchors || []).forEach((a, i) => { if (!anchorDown(a)) return; const q = v.m2s(a.x, a.y), d = Math.hypot(q[0] - p[0], q[1] - p[1] - 1.5); if (d < bd) { bd = d; best = { sh, a, i }; } });
  return best;
}
// kéo neo: xích dài / ngắn theo; ô độ dài trong thẻ cập nhật ngay (không dựng lại thẻ khi đang kéo)
export function dragAnchor(h, x, y) { moveAnchor(h.sh, h.a, x, y); const inp = document.querySelector(`[data-chain="${h.i}"]`); if (inp) inp.value = Math.round(h.a.chain); }
export function deleteAnchor(h) { clearAnchor(h.a); }
// đặt tàu mới tại (x, y) theo tàu đang chọn trong kho
export async function placeNew(x, y) {
  const p = await getFleetShip(ms.ref); if (!p) { uiAlert('Chọn tàu trong kho trước (ô «Tên tàu»).'); return null; }
  const W = A.W, sh = newMoored(ms.ref, p, ms.mode);
  if (sh.mode === 'along' && !(W.objs.ships || []).length) { uiAlert('Chưa có tàu nào để cập mạn — đặt tàu cập bến trước.'); return null; }
  if ((sh.mode === 'port' || sh.mode === 'stbd' || sh.mode === 'stern') && !W.objs.berths.length) { uiAlert('Chưa có cầu bến — vẽ cầu bến trước (công cụ «Cầu bến»), hoặc chọn kiểu «Đậu neo».'); return null; }
  if (!placeShip(W, sh, x, y)) { uiAlert('Không đặt được tàu ở đây.'); return null; }
  W.objs.ships.push(sh); W.rebuild(); defaultLines(W, sh); defaultAnchors(W, sh);
  return sh;
}
// dời tàu (đang kéo): bám theo kiểu cập; nhả chuột thì đặt lại dây / neo mặc định
export function dragShip(sh, x, y) { const W = A.W; if (placeShip(W, sh, x, y)) W.rebuild(); }
export function dropShip(sh) { const W = A.W; W.rebuild(); defaultLines(W, sh); defaultAnchors(W, sh); }
export function deleteShip(sh) {
  const W = A.W; for (const q of W.objs.ships) if (q.host === sh.id) { q.mode = 'anchor'; q.host = null; defaultAnchors(W, q); q.lines = []; } // tàu cập ngoài thành đậu neo tại chỗ
  for (const q of W.objs.ships) q.lines = (q.lines || []).filter((l) => !(l.to.t === 'sb' && l.to.id === sh.id));
  W.objs.ships.splice(W.objs.ships.indexOf(sh), 1);
}

// thẻ bên phải: chọn tàu để đặt (công cụ «Tàu đậu») hoặc sửa tàu đang chọn
export function mooredCard(sel) {
  const W = A.W, ships = W.objs.ships || [];
  let h = `<section class="card"><h2>Tàu đậu ở cảng — đặt tàu mới</h2><div class="grid g2">
    <div class="fld"><label for="msType">Loại tàu</label><div class="in"><select id="msType"></select></div></div><div class="fld"><label for="msName">Tên tàu (trong kho)</label><div class="in"><select id="msName"></select></div></div></div>
    <div style="margin-top:6px">${fsel('msMode', 'Kiểu cập', MOOR_MODES, ms.mode)}</div>
    <div class="muted" style="margin-top:6px">Mọi tàu trong kho đều đặt được (kể cả tàu bạn vẽ rồi «Lưu vào kho»). Cập bến: dây mũi, dây chéo, dây lái tự buộc vào cọc bích gần nhất; cập lái thì thả 2 neo mũi; đậu neo thì thả 1 neo. Đang có ${ships.length} tàu đậu.</div></section>`;
  if (sel) {
    const sh = sel, hostOpts = ships.filter((q) => q !== sh && !dependsOn(W, q, sh)).map((q) => [q.id, q.name]);
    h += `<section class="card"><h2>Đang chọn: ${esc(sh.name)}</h2><div class="muted" style="margin-bottom:6px">${esc(sh.type || '')} · dài ${Math.round(sh.L)} m · rộng ${sh.B.toFixed(1).replace('.', ',')} m · mớn ${sh.T.toFixed(1).replace('.', ',')} m</div>
      <div class="grid g2">${fsel('msMode2', 'Kiểu cập', MOOR_MODES, sh.mode)}<div class="fld"><label for="msHdg">Hướng mũi${sh.mode === 'anchor' ? '' : ' (lệch ' + Math.round(sh.dh || 0) + '°)'}</label><div class="in"><input id="msHdg" inputmode="decimal" value="${Math.round(((sh.hdg % 360) + 360) % 360)}" title="${sh.mode === 'anchor' ? 'Hướng mũi tàu đậu neo' : 'Cập bến / cập mạn: hướng theo bến hoặc tàu kia; gõ số khác để tàu nằm lệch (xoay quanh chỗ tiếp bến)'}"><span class="u">°</span></div></div></div>
      ${sh.mode === 'along' ? `<div style="margin-top:6px">${fsel('msHost', 'Cập vào tàu', hostOpts, sh.host)}</div>` : ''}
      <div class="flex" style="gap:6px;margin-top:6px">${sh.mode === 'port' || sh.mode === 'stbd' ? '<button class="btn sm" id="msFlip">Quay đầu (đổi mạn cập)</button>' : ''}${sh.mode === 'along' ? '<button class="btn sm" id="msSide">Sang mạn kia của tàu kia</button>' : ''}<button class="btn sm" data-rot="-5">↺ 5°</button><button class="btn sm" data-rot="5">↻ 5°</button>${sh.mode !== 'anchor' && sh.dh ? '<button class="btn sm" id="msStraight">Nằm thẳng lại</button>' : ''}</div>
      <div class="lbl" style="margin-top:10px">Dây buộc (${sh.lines.length})</div>${linesTable(sh)}
      <div class="flex" style="gap:6px;margin-top:6px"><button class="btn sm" id="msLineAdd">+ Thêm dây</button><button class="btn sm" id="msLineReset">Đặt lại dây mặc định</button></div>
      ${sh.anchors.length ? `<div class="lbl" style="margin-top:10px">Neo — kéo ký hiệu neo trên hải đồ để dời (xích dài / ngắn theo), chuột phải vào neo để xóa</div>${sh.anchors.map((a, i) => `<div style="display:grid;grid-template-columns:78px minmax(0,1fr) 74px;gap:6px;align-items:center;margin-top:4px"><span>Neo ${a.side < 0 ? 'trái' : 'phải'}</span><div class="fld"><div class="in"><input data-chain="${i}" inputmode="decimal" value="${anchorDown(a) ? Math.round(a.chain) : 0}" aria-label="Chiều dài xích neo ${a.side < 0 ? 'trái' : 'phải'}"><span class="u">m</span></div></div>${anchorDown(a) ? `<button class="btn sm" data-adel="${i}" title="Xóa neo này (mất quả neo và xích, độ dài về 0)">Xóa neo</button>` : `<button class="btn sm" data-adrop="${i}" title="Thả lại neo theo hướng mặc định">Thả lại</button>`}</div>`).join('')}<button class="btn sm" id="msAnchReset" style="margin-top:6px">Đặt lại neo mặc định</button>` : ''}
      <div class="muted" style="margin-top:6px">Kéo tàu trên hải đồ để dời (dây, neo đặt lại mặc định). Khi chạy bài: tàu hiện ở 3D, hải đồ nhỏ, radar; chạm vào là va chạm; tàu mình đưa dây sang cọc bích của tàu này được.</div>
      <button class="btn warn sm" id="msDel" style="margin-top:8px">Xóa tàu này</button></section>`;
  }
  return h;
}
// danh sách dây: chỗ ra dây trên tàu → cọc bích (trên bến hoặc trên tàu khác) trong vòng 150 m
function linesTable(sh) {
  if (!sh.lines.length) return '<div class="muted">Chưa có dây.</div>';
  return `<div style="margin-top:4px">${sh.lines.map((l, i) => { const opts = targets(sh, l.k), cur = key(l.to); if (cur && !opts.some((o) => o[0] === cur)) opts.unshift([cur, '(đang buộc)']);
    return `<div style="display:grid;grid-template-columns:86px minmax(0,1fr) 26px;gap:4px;align-items:center;margin-top:3px"><select class="cell" data-lk="${i}" aria-label="Chỗ ra dây" title="${PTS[l.k]}">${PTS_S.map((n, k) => `<option value="${k}" ${k === l.k ? 'selected' : ''}>${n}</option>`).join('')}</select><select class="cell" data-lt="${i}" aria-label="Buộc vào">${opts.map((o) => `<option value="${esc(o[0])}" ${o[0] === cur ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select><button class="btn sm" data-ldel="${i}" aria-label="Xóa dây" style="padding:0;height:26px;min-height:26px">✕</button></div>`; }).join('')}</div>`;
}
const key = (to) => (to.t === 'bol' ? 'b|' + to.berth + '|' + to.s.toFixed(2) : 's|' + to.id + '|' + to.k);
const parseKey = (k) => { const a = k.split('|'); return a[0] === 'b' ? { t: 'bol', berth: a[1], s: +a[2] } : { t: 'sb', id: a[1], k: +a[2] }; };
function targets(sh, k) {
  const W = A.W, [fx, fy] = b2w(sh, ...deckPt(sh, k, true)), out = [];
  for (const b of W.bollards) {
    if (b.ship === sh.id) continue; const d = Math.hypot(b.x - fx, b.y - fy); if (d > 150) continue;
    if (b.bi >= 0) out.push([d, 'b|' + W.objs.berths[b.bi].name + '|' + b.s.toFixed(2), 'B' + b.n + ' · ' + fmtDist(d)]);
    else { const q = W.objs.ships.find((s) => s.id === b.ship); if (q) out.push([d, 's|' + q.id + '|' + b.k, q.name.replace(/ \(mẫu\)$/, '').slice(0, 16) + ' · ' + PTS_S[b.k] + ' · ' + fmtDist(d)]); }
  }
  return out.sort((a, b) => a[0] - b[0]).slice(0, 14).map((o) => [o[1], o[2]]);
}
// điền ô chọn tàu trong kho
export async function initMooredCard() {
  const ts = document.getElementById('msType'), ns = document.getElementById('msName'); if (!ts) return;
  await fillFleet(ts, ns, ms.ref, '— chọn tàu để đặt —');
  ns.onchange = () => { if (ns.value) ms.ref = ns.value; };
  const md = document.getElementById('msMode'); if (md) md.onchange = () => { ms.mode = md.value; };
}
// sửa trong thẻ (change / click). Trả true nếu đã xử lý (bên gọi lưu + vẽ lại)
export function mooredEdit(e, sh) {
  const t = e.target, W = A.W;
  if (e.type === 'change') {
    if (t.id === 'msMode2' && sh) { const old = sh.mode; sh.mode = t.value; if (sh.mode === 'along' && !sh.host) { const h = W.objs.ships.find((q) => q !== sh && !dependsOn(W, q, sh)); if (!h) { sh.mode = old; uiAlert('Chưa có tàu khác để cập mạn.'); return true; } sh.host = h.id; sh.hside = 1; sh.ha = 0; }
      if (!placeShip(W, sh, sh.mode === 'anchor' || sh.mode === 'along' ? null : sh.x, sh.mode === 'anchor' || sh.mode === 'along' ? null : sh.y)) { sh.mode = old; uiAlert('Không đổi được — chưa có cầu bến gần.'); } W.rebuild(); defaultLines(W, sh); defaultAnchors(W, sh); return true; }
    if (t.id === 'msHdg' && sh) { const v = num(t.value, sh.hdg); setHdg(W, sh, v); return true; }
    if (t.id === 'msHost' && sh) { sh.host = t.value; sh.ha = 0; placeShip(W, sh, null, null); W.rebuild(); defaultLines(W, sh); return true; }
    if (t.dataset.lk !== undefined && sh) { sh.lines[+t.dataset.lk].k = +t.value; return true; }
    if (t.dataset.lt !== undefined && sh) { sh.lines[+t.dataset.lt].to = parseKey(t.value); return true; }
    if (t.dataset.chain !== undefined && sh) { // gõ độ dài xích: neo dời theo hướng hiện tại; gõ 0 là xóa; neo đã xóa gõ số > 0 là thả lại
      const a = sh.anchors[+t.dataset.chain], v = Math.round(num(t.value, anchorDown(a) ? a.chain : 0));
      if (v <= 0) { clearAnchor(a); return true; }
      if (!anchorDown(a)) { redropAnchor(W, sh, a, Math.max(5, v)); return true; }
      const [hx, hy] = b2w(sh, ...hawse(sh, a.side)), d0 = Math.hypot(a.x - hx, a.y - hy) || 1, r = Math.max(5, v) * 0.9; a.x = hx + (a.x - hx) / d0 * r; a.y = hy + (a.y - hy) / d0 * r; a.chain = Math.max(5, v); return true; }
    return false;
  }
  const b = t.closest('button'); if (!b || !sh) return false;
  if (b.id === 'msFlip') { sh.mode = sh.mode === 'port' ? 'stbd' : 'port'; placeShip(W, sh, null, null); W.rebuild(); defaultLines(W, sh); return true; }
  if (b.id === 'msSide') { sh.hside = -(sh.hside || 1); placeShip(W, sh, null, null); W.rebuild(); defaultLines(W, sh); return true; }
  if (b.dataset.rot) { setHdg(W, sh, sh.hdg + +b.dataset.rot); return true; }
  if (b.id === 'msStraight') { sh.dh = 0; placeShip(W, sh, null, null); W.rebuild(); defaultLines(W, sh); defaultAnchors(W, sh); return true; }
  if (b.id === 'msLineReset') { defaultLines(W, sh); return true; }
  if (b.dataset.adel !== undefined) { clearAnchor(sh.anchors[+b.dataset.adel]); return true; }
  if (b.dataset.adrop !== undefined) { redropAnchor(W, sh, sh.anchors[+b.dataset.adrop]); return true; }
  if (b.id === 'msAnchReset') { defaultAnchors(W, sh); return true; }
  if (b.id === 'msLineAdd') { const k = sh.lines.length % 8, o = targets(sh, k)[0]; if (!o) { uiAlert('Không có cọc bích nào trong vòng 150 m.'); return true; } sh.lines.push({ k, to: parseKey(o[0]) }); return true; }
  if (b.dataset.ldel !== undefined) { sh.lines.splice(+b.dataset.ldel, 1); return true; }
  return false;
}

// đổi hướng mũi: đậu neo thì đặt thẳng; cập bến / cập mạn thì lưu độ lệch so với hướng theo bến / tàu kia
function setHdg(W, sh, v) {
  if (sh.mode === 'anchor') { sh.hdg = v; W.rebuild(); defaultAnchors(W, sh); return; }
  const base = sh.hdg - (sh.dh || 0); let d = ((v - base) % 360 + 540) % 360 - 180; d = Math.max(sh.mode === 'along' ? -20 : -60, Math.min(sh.mode === 'along' ? 20 : 60, d));
  sh.dh = d; placeShip(W, sh, null, null); W.rebuild(); defaultLines(W, sh); defaultAnchors(W, sh);
}
// vẽ tàu đậu, dây, neo lên khung hải đồ
export function drawMoored(v, g, sel) {
  const W = A.W, mpp = v.mPerPx();
  for (const sh of W.objs.ships || []) {
    const P = outline(sh, 10).map(([bx, by]) => v.m2s(...b2w(sh, bx, by)));
    // neo + xích
    for (const a of (sh.anchors || []).filter(anchorDown)) { const h = v.m2s(...b2w(sh, ...hawse(sh, a.side))), q = v.m2s(a.x, a.y); g.strokeStyle = '#37474F'; g.lineWidth = 1.2; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(h[0], h[1]); g.lineTo(q[0], q[1]); g.stroke(); g.setLineDash([]); anchorIcon(g, q[0], q[1]); }
    g.fillStyle = sel === sh ? 'rgba(0,184,212,.55)' : 'rgba(84,96,106,.75)'; g.strokeStyle = sel === sh ? '#006978' : '#263238'; g.lineWidth = sel === sh ? 2.2 : 1.4;
    g.beginPath(); P.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill(); g.stroke();
    // dây buộc
    if (mpp < 4) { g.strokeStyle = '#F9A825'; g.lineWidth = 1.3; for (const l of sh.lines || []) { const e = lineEnd(W, l); if (!e) continue; const f = v.m2s(...b2w(sh, ...deckPt(sh, l.k, true))), t2 = v.m2s(e.x, e.y); g.beginPath(); g.moveTo(f[0], f[1]); g.lineTo(t2[0], t2[1]); g.stroke(); } }
    if (mpp < 6 || sel === sh) { const c = v.m2s(sh.x, sh.y); g.font = 'bold 11px Segoe UI'; g.fillStyle = '#102027'; g.fillText(sh.name, c[0] + 8, c[1] - 8); }
  }
}
function anchorIcon(g, x, y) { g.strokeStyle = '#263238'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x, y + 5); g.moveTo(x - 4, y - 3); g.lineTo(x + 4, y - 3); g.moveTo(x - 5, y + 1); g.quadraticCurveTo(x, y + 9, x + 5, y + 1); g.stroke(); }

// file đối tượng đầy đủ: kèm các tàu người dùng (không phải mẫu có sẵn) mà tàu đậu dùng tới
export async function fleetForFile() {
  const refs = [...new Set((A.W.objs.ships || []).map((s) => s.ref).filter((r) => r && !String(r).startsWith('tpl:')))], out = [];
  for (const id of refs) { const p = await getFleetShip(id); if (p) out.push({ id, type: p.type || 'Khác', name: p.name || 'Tàu', p }); }
  return out;
}
// mở file: thêm tàu trong file vào kho máy này (trùng loại + tên thì dùng tàu đã có), đổi id tham chiếu của tàu đậu.
// Trả { added: số tàu mới vào kho, same: số tàu đã có sẵn }
export async function fleetFromFile(F) {
  const map = {}; let added = 0, same = 0;
  for (const e of F.fleet || []) { const q = await ensureFleetShip(e); if (!q) continue; map[e.id] = q.id; if (q.added) added++; else if (!String(e.id).startsWith('tpl:')) same++; }
  for (const sh of F.ships || []) if (map[sh.ref]) sh.ref = map[sh.ref];
  return { added, same };
}
