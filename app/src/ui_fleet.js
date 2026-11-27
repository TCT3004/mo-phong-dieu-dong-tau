// Giao diện kho tàu dùng chung: chọn loại → tên tàu (tab 1, tab 2), khung «Lưu vào kho» (tab 1, hộp thoại vẽ tàu).
import { uiAlert, uiConfirm } from './dialog.js';
import { A, esc, saveShip } from './app.js';
import { defaultShip } from './physics.js';
import { listFleet, fleetTypes, getFleetShip, saveFleetShip, deleteFleetShip } from './fleet.js';

// điền 2 ô chọn: loại tàu, rồi tên tàu thuộc loại đó. cur: id đang chọn. Trả danh sách
export async function fillFleet(typeSel, nameSel, cur, placeholder = '— chọn tàu —') {
  const list = await listFleet(), types = fleetTypes(list).filter((t) => list.some((e) => e.type === t));
  const ce = list.find((e) => e.id === cur), t0 = typeSel.value && types.includes(typeSel.value) ? typeSel.value : ce ? ce.type : types[0];
  typeSel.innerHTML = types.map((t) => `<option ${t === t0 ? 'selected' : ''}>${esc(t)}</option>`).join('');
  const names = () => { const t = typeSel.value, items = list.filter((e) => e.type === t); nameSel.innerHTML = `<option value="">${placeholder}</option>` + items.map((e) => `<option value="${esc(e.id)}" ${e.id === cur ? 'selected' : ''}>${esc(e.name)}${e.L ? ' · ' + Math.round(e.L) + ' m' : ''}${e.builtin ? '' : ' ★'}</option>`).join(''); };
  names(); typeSel.onchange = names;
  return list;
}

// nạp một tàu trong kho làm tàu mình điều động
export async function useFleetShip(id) {
  const p = await getFleetShip(id); if (!p) return false;
  A.p = Object.assign(defaultShip(), p, { fleetId: id }); saveShip();
  return true;
}

// khung lưu tàu đang dùng (A.p) vào kho: loại (chọn hoặc gõ loại mới) + tên
export async function fleetSaveForm(host, onDone) {
  const list = await listFleet(), types = fleetTypes(list), dl = 'flTypes' + Math.random().toString(36).slice(2, 6);
  host.hidden = false;
  host.innerHTML = `<div class="flex" style="gap:8px;align-items:flex-end;flex-wrap:wrap;margin-top:8px">
    <div class="fld" style="min-width:170px"><label>Loại tàu (chọn hoặc gõ loại mới)</label><div class="in"><input class="flT" list="${dl}" value="${esc(A.p.type && types.includes(A.p.type) ? A.p.type : '')}" placeholder="Tàu hàng, Tàu pháo…"></div></div>
    <datalist id="${dl}">${types.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
    <div class="fld" style="min-width:220px"><label>Tên tàu trong kho</label><div class="in"><input class="flN" value="${esc(A.p.name || '')}"></div></div>
    <button class="btn sm pri flOk">Lưu vào kho</button><button class="btn sm flNo">Hủy</button></div>
    <div class="muted" style="margin-top:4px">Lưu trọn bộ thông số tab 1 và mô hình 3D (ảnh sơ đồ vẫn ở máy này). Trùng loại + tên thì ghi đè. Tàu trong kho dùng lại được làm tàu mình hoặc đặt làm tàu đậu ở cảng (tab 2).</div>`;
  const q = (s) => host.querySelector(s);
  q('.flNo').onclick = () => { host.hidden = true; host.innerHTML = ''; };
  q('.flOk').onclick = async () => {
    const type = q('.flT').value.trim() || 'Khác', name = q('.flN').value.trim();
    if (!name) { q('.flN').focus(); return; }
    const ex = list.find((e) => !e.builtin && e.type === type && e.name === name);
    if (ex && !(await uiConfirm('Trong kho đã có «' + name + '» (' + type + '). Ghi đè?', { ok: 'Ghi đè' }))) return;
    const id = await saveFleetShip(type, name, Object.assign({}, A.p, { type, name }));
    A.p.type = type; A.p.name = name; A.p.fleetId = id; saveShip();
    host.hidden = true; host.innerHTML = ''; if (onDone) onDone(id, type, name);
  };
}

// thẻ «Kho tàu» ở tab 1
export function fleetCard() {
  return `<section class="card" id="fleetCard"><h2>Kho tàu</h2><div class="flex" style="gap:8px;align-items:flex-end;flex-wrap:wrap">
    <div class="fld" style="min-width:160px"><label for="flType">Loại tàu</label><div class="in"><select id="flType"></select></div></div>
    <div class="fld" style="min-width:300px"><label for="flName">Tên tàu — chọn là nạp làm tàu điều động</label><div class="in"><select id="flName"></select></div></div>
    <button class="btn sm" id="flSave">Lưu tàu đang dùng vào kho…</button><button class="btn sm" id="flDel">Xóa khỏi kho</button></div>
    <div id="flSaveBox" hidden></div><div class="muted" id="flInfo" style="margin-top:6px">Kho có sẵn 13 tàu mẫu chung chung (đã có mô hình 3D và thông số chạy được); tàu bạn lưu có dấu ★.</div></section>`;
}
let refill = null; // điền lại 2 ô chọn của thẻ «Kho tàu» tab 1
// kho tàu đổi từ chỗ khác (mở file đối tượng ở tab 2): điền lại thẻ tab 1 ngay, không phải mở lại app
export async function refreshFleetCard(msg) {
  if (refill && document.getElementById('flType')) await refill();
  const i = document.getElementById('flInfo'); if (i && msg) i.textContent = msg;
}
export async function initFleetCard(reload) {
  const ts = document.getElementById('flType'), ns = document.getElementById('flName'); if (!ts) return;
  let list = await fillFleet(ts, ns, A.p.fleetId);
  refill = async () => { list = await fillFleet(ts, ns, A.p.fleetId); };
  ns.onchange = async () => {
    const id = ns.value; if (!id) return; const e = list.find((q) => q.id === id);
    if (!(await uiConfirm('Nạp «' + e.name + '» làm tàu điều động?\nThông số tab 1 và mô hình 3D sẽ thay bằng của tàu này (tàu đang dùng chưa lưu thì bấm «Lưu tàu đang dùng vào kho…» trước).', { ok: 'Nạp tàu' }))) { ns.value = A.p.fleetId || ''; return; }
    if (await useFleetShip(id)) reload();
  };
  document.getElementById('flSave').onclick = () => fleetSaveForm(document.getElementById('flSaveBox'), async (id) => { list = await fillFleet(ts, ns, id); document.getElementById('flInfo').textContent = 'Đã lưu «' + A.p.name + '» vào kho (' + A.p.type + ').'; });
  document.getElementById('flDel').onclick = async () => {
    const id = ns.value, e = list.find((q) => q.id === id);
    if (!e) { uiAlert('Chọn tàu cần xóa ở ô «Tên tàu» trước.'); return; }
    if (e.builtin) { uiAlert('Tàu mẫu có sẵn không xóa được.'); return; }
    if (!(await uiConfirm('Xóa «' + e.name + '» khỏi kho? (tàu đang điều động không bị ảnh hưởng)', { ok: 'Xóa', danger: true }))) return;
    await deleteFleetShip(id); if (A.p.fleetId === id) { delete A.p.fleetId; saveShip(); } list = await fillFleet(ts, ns, A.p.fleetId);
  };
}
