// Âm thanh tổng hợp: chuông, báo động, tiếng máy, mưa, gió, sấm.
export class Sound {
  constructor() { this.ctx = null; this.vol = { master: 0.8, engine: 0.6, bell: 0.9, env: 0.7 }; this.alarmOn = false; this.bellType = 'electric'; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const c = this.ctx = new C(); this.out = c.createGain(); this.out.gain.value = this.vol.master; this.out.connect(c.destination);
    try { this.rec = c.createMediaStreamDestination(); this.out.connect(this.rec); } catch (e) { this.rec = null; }
    this.eng = c.createOscillator(); this.eng.type = 'sawtooth'; this.eng.frequency.value = 30;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140; this.engG = c.createGain(); this.engG.gain.value = 0;
    this.eng.connect(lp); lp.connect(this.engG); this.engG.connect(this.out); this.eng.start();
  }
  // nguồn tiếng ồn trắng dùng chung (2 giây, lặp)
  noiseBuf() { if (!this.nb) { const c = this.ctx, b = c.createBuffer(1, 2 * c.sampleRate, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.nb = b; } return this.nb; }
  mkAmb() {
    if (this.amb) return; const c = this.ctx, src = (off) => { const s = c.createBufferSource(); s.buffer = this.noiseBuf(); s.loop = true; s.start(0, off); return s; };
    // mưa: tiếng rào rào (lọc thông cao) · gió: tiếng rít (lọc dải, tần số theo sức gió)
    const r = src(0), rh = c.createBiquadFilter(); rh.type = 'highpass'; rh.frequency.value = 1100; const rl = c.createBiquadFilter(); rl.type = 'lowpass'; rl.frequency.value = 7000; const rg = c.createGain(); rg.gain.value = 0; r.connect(rh); rh.connect(rl); rl.connect(rg); rg.connect(this.out);
    const w = src(0.7), wb = c.createBiquadFilter(); wb.type = 'bandpass'; wb.frequency.value = 400; wb.Q.value = 0.7; const wg = c.createGain(); wg.gain.value = 0; w.connect(wb); wb.connect(wg); wg.connect(this.out);
    this.amb = { rg, wg, wb };
  }
  // rain 0..1, windKn: gió thật (hl/h)
  weather(rain, windKn) {
    if (!this.ctx) return; this.mkAmb(); const t = this.ctx.currentTime, a = this.amb, v = this.vol.env, wk = Math.max(0, Math.min(1, (windKn - 8) / 32));
    a.rg.gain.setTargetAtTime(0.16 * v * Math.min(1, rain), t, 1.2);
    a.wg.gain.setTargetAtTime(0.22 * v * wk * wk, t, 1.5); a.wb.frequency.setTargetAtTime(260 + 9 * windKn + 60 * Math.random(), t, 2);
  }
  // sấm: tia sét cách dist m, tiếng tới sau dist/340 giây (chia cho tốc độ mô phỏng); gần thì có tiếng nổ đanh, xa chỉ còn ì ầm
  thunder(dist, speed = 1) {
    if (!this.ctx) return; const c = this.ctx, t0 = c.currentTime + dist / 340 / Math.max(1, speed), near = Math.max(0, 1 - dist / 6000), lv = this.vol.env * (0.25 + 0.55 * near);
    const s = c.createBufferSource(); s.buffer = this.noiseBuf(); s.loop = true; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(near > 0.5 ? 900 : 300, t0); lp.frequency.exponentialRampToValueAtTime(70, t0 + 3);
    const g = c.createGain(), dur = 3.5 + 2.5 * (1 - near); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(lv, t0 + 0.04 + 0.4 * (1 - near));
    for (let k = 1; k < 5; k++) g.gain.linearRampToValueAtTime(lv * (0.35 + 0.5 * Math.random()) * (1 - k / 6), t0 + k * dur / 5); g.gain.linearRampToValueAtTime(0, t0 + dur);
    s.connect(lp); lp.connect(g); g.connect(this.out); s.start(t0, Math.random()); s.stop(t0 + dur + 0.1);
  }
  setVol(v) { Object.assign(this.vol, v); if (this.out) this.out.gain.value = this.vol.master; }
  engine(frac) { if (!this.ctx) return; const t = this.ctx.currentTime; this.eng.frequency.setTargetAtTime(22 + 50 * Math.abs(frac), t, 0.5); this.engG.gain.setTargetAtTime(0.25 * this.vol.engine * Math.min(1, 0.15 + Math.abs(frac)) * (Math.abs(frac) > 0.01 ? 1 : 0.3), t, 0.5); }
  strike(t0) {
    // tiếng chuông tàu: kim loại, đanh, tắt nhanh
    const c = this.ctx; [[1180, 1], [2390, 0.6], [3260, 0.45], [4470, 0.3], [5900, 0.18]].forEach(([f, a]) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.22 * a * this.vol.bell, t0 + 0.003); g.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.45); o.connect(g); g.connect(this.out); o.start(t0); o.stop(t0 + 0.5); });
  }
  // chuông điện 6 inch: búa gõ vào chuông ~22 lần/giây → "reng reng" liên tục khi giữ; nhả ra chuông còn ngân rồi tắt
  mkEBell() {
    if (this.eb) return; const c = this.ctx, g = c.createGain(); g.gain.value = 0; g.connect(this.out);
    const body = c.createGain(); body.gain.value = 0.5; body.connect(g);
    for (const [f, a] of [[905, 1], [2115, 0.55], [3470, 0.36], [5160, 0.22], [7290, 0.1]]) { const o = c.createOscillator(); o.frequency.value = f; const og = c.createGain(); og.gain.value = a * 0.2; o.connect(og); og.connect(body); o.start(); }
    const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const ns = c.createBufferSource(); ns.buffer = nb; ns.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3300; bp.Q.value = 1.3; const ng = c.createGain(); ng.gain.value = 0; ns.connect(bp); bp.connect(ng); ng.connect(body); ns.start();
    const lfo = c.createOscillator(); lfo.type = 'sawtooth'; lfo.frequency.value = 22; const lg = c.createGain(); lg.gain.value = 0; lfo.connect(lg); lg.connect(body.gain); lfo.start();
    this.eb = { g, lg, ng };
  }
  ebell(on) {
    this.mkEBell(); const t = this.ctx.currentTime, e = this.eb, v = 0.55 * this.vol.bell;
    for (const p of [e.g.gain, e.lg.gain, e.ng.gain]) p.cancelScheduledValues(t);
    if (on) { e.g.gain.setTargetAtTime(v, t, 0.004); e.lg.gain.setTargetAtTime(-0.46, t, 0.003); e.ng.gain.setTargetAtTime(0.13, t, 0.003); }
    else { e.lg.gain.setTargetAtTime(0, t, 0.012); e.ng.gain.setTargetAtTime(0, t, 0.01); e.g.gain.setTargetAtTime(0, t + 0.02, 0.17); }
  }
  bell(sec) { this.init(); if (!this.ctx) return; if (this.bellType === 'brass') { const t = this.ctx.currentTime; for (let i = 0; i < (sec || 4) * 8; i++) this.strike(t + i * 0.125); return; } this.ebell(true); clearTimeout(this.bt); this.bt = setTimeout(() => this.ebell(false), (sec || 4) * 1000); }
  bellHold(on) {
    this.init(); if (!this.ctx) return;
    if (this.bellType !== 'brass') { clearTimeout(this.bt); this.ebell(on); return; }
    if (on) { clearInterval(this.bh); this.strike(this.ctx.currentTime); this.bh = setInterval(() => this.strike(this.ctx.currentTime), 125); }
    else { clearInterval(this.bh); this.bh = null; }
  }
  mkHorn() {
    if (this.hG) return; const c = this.ctx; this.hG = c.createGain(); this.hG.gain.value = 0;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(this.hG); this.hG.connect(this.out);
    for (const f of [130, 131.5, 195, 261]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const g = c.createGain(); g.gain.value = f > 190 ? 0.25 : 0.5; o.connect(g); g.connect(lp); o.start(); }
  }
  horn(on) {
    this.init(); if (!this.ctx) return; this.mkHorn(); const t = this.ctx.currentTime, g = this.hG.gain;
    g.cancelScheduledValues(t); g.setTargetAtTime(on ? 0.5 * this.vol.bell : 0, t, on ? 0.06 : 0.12);
  }
  // chuỗi tín hiệu: 'S' ngắn 1 giây, 'L' dài 5 giây, nghỉ 1 giây giữa các tiếng
  hornSeq(pat) {
    this.init(); if (!this.ctx) return; this.mkHorn(); const g = this.hG.gain; let t = this.ctx.currentTime + 0.05; g.cancelScheduledValues(t);
    for (const ch of pat) { const d = ch === 'L' ? 5 : 1; g.setTargetAtTime(0.5 * this.vol.bell, t, 0.06); g.setTargetAtTime(0, t + d, 0.1); t += d + 1; }
  }
  alarm(on) {
    this.init(); if (!this.ctx) return; this.alarmOn = on;
    if (on && !this.al) { const c = this.ctx; this.al = c.createOscillator(); this.al.type = 'square'; this.alG = c.createGain(); this.alG.gain.value = 0.12 * this.vol.bell; const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 1.2; l.type = 'square'; lg.gain.value = 180; l.connect(lg); lg.connect(this.al.frequency); this.al.frequency.value = 760; this.al.connect(this.alG); this.alG.connect(this.out); this.al.start(); l.start(); this.alL = l; }
    if (!on && this.al) { this.al.stop(); this.alL.stop(); this.al = null; }
  }
}
