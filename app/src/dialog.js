// Hộp thoại của app thay cho alert / confirm / prompt của trình duyệt.
// Lý do: trong bản .exe (Electron trên Windows), sau hộp thoại gốc cửa sổ hay mất quyền gõ phím vào ô nhập.
// Hộp thoại vẽ bằng HTML ngay trong trang: Enter = đồng ý, Esc = hủy; đóng xong trả con trỏ về chỗ cũ. Hàm trả Promise.
let q = Promise.resolve();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function open(kind, msg, opt = {}) {
  const run = () => new Promise((resolve) => {
    const prev = document.activeElement, d = document.createElement('div');
    d.className = 'uidlg'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
    const lines = esc(msg).split('\n').map((l) => `<p>${l || '&nbsp;'}</p>`).join('');
    d.innerHTML = `<div class="uidlg-box"><div class="uidlg-msg">${lines}</div>${kind === 'prompt' ? `<input class="uidlg-in" value="${esc(opt.def === undefined ? '' : opt.def)}" aria-label="Giá trị">` : ''}
      <div class="uidlg-btn">${kind === 'alert' ? '' : `<button class="btn" data-r="0">${esc(opt.cancel || 'Hủy')}</button>`}<button class="btn ${opt.danger ? 'warn' : 'pri'}" data-r="1">${esc(opt.ok || 'Đồng ý')}</button></div></div>`;
    document.body.appendChild(d);
    const inp = d.querySelector('.uidlg-in'), okB = d.querySelector('[data-r="1"]');
    const done = (ok) => { document.removeEventListener('keydown', key, true); d.remove(); try { if (prev && prev.focus && document.contains(prev)) prev.focus(); } catch (e) { /* bỏ qua */ } resolve(kind === 'prompt' ? (ok ? inp.value : null) : kind === 'confirm' ? !!ok : undefined); };
    const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); } else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done(true); } else e.stopPropagation(); };
    document.addEventListener('keydown', key, true);
    d.addEventListener('click', (e) => { const b = e.target.closest('button[data-r]'); if (b) done(b.dataset.r === '1'); });
    setTimeout(() => { if (inp) { inp.focus(); inp.select(); } else okB.focus(); }, 0);
  });
  const p = q.then(run); q = p.catch(() => {}); return p; // xếp hàng: hộp sau chờ hộp trước đóng
}
export const uiAlert = (msg, opt) => open('alert', msg, Object.assign({ ok: 'Đóng' }, opt));
export const uiConfirm = (msg, opt) => open('confirm', msg, opt);
export const uiPrompt = (msg, def, opt) => open('prompt', msg, Object.assign({ def }, opt));
