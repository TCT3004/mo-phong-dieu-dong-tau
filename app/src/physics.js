// Mô hình chuyển động tàu 3 bậc tự do kiểu MMG (thân tàu / chân vịt / bánh lái tách rời).
// Hệ trục thân tàu: x về mũi, y sang phải, r > 0 là quay phải. psi: hướng mũi (rad, từ Bắc theo chiều kim đồng hồ).
export const KN = 0.5144, RHO = 1025, RHOA = 1.225, D2R = Math.PI / 180, G = 9.81;

export function defaultShip() {
  return {
    name: 'Tàu mẫu', type: 'Hàng tổng hợp', load: 'loaded',
    loa: 119.9, lpp: 112, B: 20.2, D: 9.8, tf: 5.8, ta: 6.0, disp: 11800, cb: 0.72,
    engines: 1, props: 1, ptype: 'fpp', rotDir: 'right', accTime: 60,
    steps: [
      { id: 'f4', label: 'Tiến max', rpm: 160, kn: 13.5, knB: 14.2 },
      { id: 'f3', label: 'Tiến 3', rpm: 125, kn: 10.8, knB: 11.4 },
      { id: 'f2', label: 'Tiến 2', rpm: 95, kn: 8.2, knB: 8.7 },
      { id: 'f1', label: 'Tiến 1', rpm: 65, kn: 5.5, knB: 5.9 },
      { id: 'a1', label: 'Lùi 1', rpm: -80, kn: 0, knB: 0 },
      { id: 'a2', label: 'Lùi 2', rpm: -130, kn: 0, knB: 0 }
    ],
    rudMax: 35, rudTime: 28, rudders: 1, respTime: 8,
    turnDia: 390, propD: 4.2, PD: 0.75, wP: 0.35, tP: 0.2, AR: 14, hR: 5.4, gammaR: 0.45,
    bowAnchors: 2, sternAnchors: 1, chainLen: 275, anchorW: 3.3, chainW: 50,
    lineR: 24, lineLen: 220,
    windAL: 1650, windAF: 380, windXc: -3.8,
    fx: { shallow: true, bank: true, prop: true, env: true }
  };
}

export const STEP_ORDER = ['f4', 'f3', 'f2', 'f1', 'st', 'a1', 'a2'];
export function stepLabel(p, id) {
  if (id === 'st') return 'Dừng máy';
  const s = p.steps.find((q) => q.id === id);
  return s ? s.label : id;
}

const num = (v, d) => { const n = parseFloat(v); return isFinite(n) ? n : d; };

export function engineOffsets(n, B) {
  if (n === 2) return [-B / 4, B / 4];
  if (n === 3) return [-B / 3, 0, B / 3];
  if (n === 4) return [-0.375 * B, -0.125 * B, 0.125 * B, 0.375 * B];
  return [0];
}

function thrustOf(M, n, uA) {
  // lực đẩy một chân vịt (N); n: vòng/giây (hiệu dụng), uA: vận tốc dòng vào chân vịt
  if (n >= 0) return Math.max(-0.2 * M.kT0 * n * n, M.kT0 * n * n - M.kT1 * n * uA);
  return -0.35 * M.kT0 * n * n;
}

export function buildModel(pIn, opts) {
  const p = pIn;
  const L = num(p.lpp, 100), B = num(p.B, 16), d = (num(p.tf, 5) + num(p.ta, 5)) / 2, Cb = num(p.cb, 0.7);
  const m = num(p.disp, 0) > 0 ? num(p.disp, 0) * 1000 : RHO * Cb * L * B * d;
  const M = { p, L, B, d, Cb, m, loa: num(p.loa, L * 1.06) };
  M.mx = 0.05 * m; M.my = 0.9 * m; M.Iz = m * (0.25 * L) ** 2; M.Jz = m * (0.2 * L) ** 2;
  const k = 2 * d / L;
  M.Yv = -(Math.PI * k / 2 + 1.4 * Cb * B / L); M.Yr = -1.5 * Cb * B / L;
  M.Nv = -k; M.Nr = -(0.54 * k - k * k);
  M.Cd = 0.6;
  M.nE = Math.max(1, Math.min(4, Math.round(num(p.engines, 1))));
  M.nP = M.nE;
  M.yE = engineOffsets(M.nE, B);
  const Dp = num(p.propD, 4), PD = num(p.PD, 0.75);
  M.Dp = Dp; M.w = num(p.wP, 0.35); M.t = num(p.tP, 0.2);
  const k0 = 0.43 * PD, J0 = 1.07 * PD;
  M.kT0 = RHO * Dp ** 4 * k0; M.kT1 = RHO * Dp ** 3 * (k0 / J0);
  // nấc máy
  const ahead = p.steps.filter((s) => s.id[0] === 'f');
  const kcol = p.load === 'ballast' ? 'knB' : 'kn';
  const maxS = ahead.reduce((a, s) => (num(s.rpm, 0) > num(a.rpm, 0) ? s : a), ahead[0]);
  const rpmMax = Math.max(10, num(maxS.rpm, 100)), vMax = Math.max(1, num(maxS[kcol], 12)) * KN;
  const nMax = rpmMax / 60;
  M.nMax = nMax; M.rpmMax = rpmMax;
  M.kR = M.nP * (1 - M.t) * thrustOf(M, nMax, vMax * (1 - M.w)) / (vMax * vMax);
  if (!(M.kR > 0)) M.kR = 0.5 * RHO * (1.7 * L * d + Cb * L * B) * 0.004;
  M.steps = { st: { n: 0, rpm: 0 } };
  for (const s of p.steps) {
    const rpm = num(s.rpm, 0);
    if (s.id[0] === 'f') {
      const V = Math.max(0.2, num(s[kcol], 0)) * KN;
      let lo = 0, hi = nMax * 1.5;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (M.nP * (1 - M.t) * thrustOf(M, mid, V * (1 - M.w)) > M.kR * V * V) hi = mid; else lo = mid;
      }
      M.steps[s.id] = { n: (lo + hi) / 2, rpm };
    } else {
      M.steps[s.id] = { n: -Math.abs(rpm) / 60, rpm: -Math.abs(rpm) };
    }
  }
  M.nRate = nMax / Math.max(5, num(p.accTime, 60));
  // bánh lái
  M.rudMax = num(p.rudMax, 35); M.rudRate = 2 * M.rudMax / Math.max(5, num(p.rudTime, 28));
  M.tauR = Math.max(0.2, num(p.respTime, 0) / 3);
  M.nR = Math.max(1, Math.round(num(p.rudders, 1)));
  M.AR = num(p.AR, L * d / 60) * M.nR; const hR = num(p.hR, d * 0.8);
  const lam = hR * hR / num(p.AR, L * d / 60);
  M.fa = 6.13 * lam / (lam + 2.25);
  M.eta = (M.nR === M.nP || (M.nR === 1 && M.nP % 2 === 1)) ? Math.min(1, Dp / hR) : 0;
  M.gR = num(p.gammaR, 0.45); M.lR = -0.71 * L; M.xR = -0.5 * L; M.aH = 0.3; M.xH = -0.45 * L; M.tR = 0.39;
  M.rCal = 1;
  M.hand = p.rotDir === 'left' ? -1 : 1;
  M.walk = (M.nP % 2 === 1 || M.nP === 1) ? 1 : 0;
  M.AL = num(p.windAL, L * 10); M.AF = num(p.windAF, B * 12); M.xc = num(p.windXc, 0);
  M.fx = Object.assign({ shallow: true, bank: true, prop: true, env: true }, p.fx || {});
  // hiệu chỉnh hiệu lực bánh lái theo đường kính quay trở đã nhập
  const target = num(p.turnDia, 0);
  if (target > 0 && !(opts && opts.noCal)) {
    let lo = 0.25, hi = 5;
    for (let i = 0; i < 14; i++) {
      M.rCal = Math.sqrt(lo * hi);
      if (turningDiameter(M) > target) lo = M.rCal; else hi = M.rCal;
    }
    M.rCal = Math.sqrt(lo * hi);
  }
  return M;
}

export function newState(M) {
  return { x: 0, y: 0, psi: 0, u: 0, v: 0, r: 0, n: new Array(M.nE).fill(0), delta: 0, dEff: 0, cE: 0, cN: 0 };
}

export function turningDiameter(M) {
  const S = newState(M);
  const st = M.steps.f4; S.n.fill(st.n); S.u = 0.9 * (num(M.p.steps[0].kn, 12) * KN);
  const ctrl = { nT: new Array(M.nE).fill(st.n), dT: M.rudMax };
  const env = { h: 1e3 };
  let yMin = 1e9, yMax = -1e9, xMin = 1e9, xMax = -1e9;
  for (let i = 0; i < 4500; i++) {
    stepShip(S, M, ctrl, env, null, 0.2);
    if (i > 2600) { xMin = Math.min(xMin, S.x); xMax = Math.max(xMax, S.x); yMin = Math.min(yMin, S.y); yMax = Math.max(yMax, S.y); }
  }
  return ((xMax - xMin) + (yMax - yMin)) / 2;
}

const NS = 12;
// env: { h (độ sâu nước, m), wS (gió m/s), wD (hướng gió THỔI TỚI TỪ, rad), cE, cN (dòng chảy m/s), bankS, bankP (m), waveH, waveD }
// ext: { X, Y, N } ngoại lực trong hệ thân tàu (neo, dây, đệm va) hoặc null
export function stepShip(S, M, ctrl, env, ext, dt) {
  const { L, d, m } = M;
  // máy
  for (let i = 0; i < M.nE; i++) {
    const tg = ctrl.nT[i], df = tg - S.n[i], mx = M.nRate * dt;
    S.n[i] += Math.abs(df) <= mx ? df : Math.sign(df) * mx;
  }
  // bánh lái
  const dT = Math.max(-M.rudMax, Math.min(M.rudMax, ctrl.dT)), dd = dT - S.delta, mr = M.rudRate * dt;
  S.delta += Math.abs(dd) <= mr ? dd : Math.sign(dd) * mr;
  S.dEff += (S.delta - S.dEff) * Math.min(1, dt / M.tauR);
  const u = S.u, v = S.v, r = S.r, U = Math.hypot(u, v);
  // nước nông
  let kS = 1, kM = 1, kRs = 1;
  const h = env && env.h > 0 ? env.h : 1e3;
  if (M.fx.shallow) {
    const s = Math.min(0.92, d / h);
    kS = 1 + 1.5 * s ** 2.5; kM = 1 + 2 * s ** 3; kRs = 1 + 0.8 * s * s;
  }
  const q = 0.5 * RHO * L * d;
  // thân tàu
  let X = -M.kR * kRs * (u < 0 ? 2 : 1) * u * Math.abs(u) + (m + 0.5 * M.my * kM) * v * r;
  let Y = q * U * (M.Yv * kS * v + M.Yr * L * r);
  let N = q * L * U * (M.Nv * v + M.Nr * kS * L * r);
  const dx = L / NS, cq = 0.5 * RHO * d * M.Cd * kS * dx;
  for (let i = 0; i < NS; i++) {
    const xs = -L / 2 + (i + 0.5) * dx, vl = v + r * xs, f = -cq * vl * Math.abs(vl);
    Y += f; N += f * xs;
  }
  // chân vịt
  const uA = u * (1 - M.w);
  let Tsum = 0;
  for (let i = 0; i < M.nE; i++) {
    const T = thrustOf(M, S.n[i], uA);
    Tsum += T;
    X += (1 - M.t) * T; N += -M.yE[i] * (1 - M.t) * T;
    if (M.fx.prop && M.walk) {
      const yp = -M.hand * (S.n[i] < 0 ? 0.1 : -0.0015) * Math.abs(T);
      Y += yp; N += yp * (-0.48 * L);
    }
  }
  // bánh lái
  const Tm = Tsum / M.nP, dl = S.dEff * D2R;
  let FN;
  if (uA >= 0) {
    const slip = Tm > 0 ? 0.6 * 8 * Tm / (RHO * Math.PI * M.Dp * M.Dp) : 0;
    const uR2 = uA * uA + M.eta * slip, uR = Math.sqrt(uR2);
    const vR = -M.gR * (v + M.lR * r);
    const aR = dl - Math.atan2(vR, Math.max(uR, 0.01));
    FN = 0.5 * RHO * M.AR * M.fa * (uR2 + vR * vR) * Math.sin(aR) * M.rCal;
  } else {
    FN = -0.5 * RHO * M.AR * M.fa * 0.5 * uA * uA * Math.sin(dl) * M.rCal;
  }
  X += -(1 - M.tR) * FN * Math.sin(dl);
  Y += -(1 + M.aH) * FN * Math.cos(dl);
  N += -(M.xR + M.aH * M.xH) * FN * Math.cos(dl);
  // gió
  if (env && M.fx.env && env.wS > 0) {
    const wE = -env.wS * Math.sin(env.wD), wN = -env.wS * Math.cos(env.wD);
    const gE = u * Math.sin(S.psi) + v * Math.cos(S.psi) + S.cE, gN = u * Math.cos(S.psi) - v * Math.sin(S.psi) + S.cN;
    const rE = wE - gE, rN = wN - gN;
    const wu = rE * Math.sin(S.psi) + rN * Math.cos(S.psi), wv = rE * Math.cos(S.psi) - rN * Math.sin(S.psi), wm = Math.hypot(wu, wv);
    const fy = 0.5 * RHOA * M.AL * 0.9 * wm * wv;
    X += 0.5 * RHOA * M.AF * 0.8 * wm * wu; Y += fy; N += fy * M.xc;
  }
  // sóng (lực trôi dạt bậc hai, ước lượng)
  if (env && M.fx.env && env.waveH > 0) {
    const F = 0.5 * RHO * G * L * (env.waveH / 2) ** 2 * 0.06;
    const fE = -Math.sin(env.waveD) * F, fN = -Math.cos(env.waveD) * F;
    X += fE * Math.sin(S.psi) + fN * Math.cos(S.psi); Y += fE * Math.cos(S.psi) - fN * Math.sin(S.psi);
  }
  // bờ luồng
  if (env && M.fx.bank && (env.bankS < 1e3 || env.bankP < 1e3)) {
    const es = Math.min(1.2, M.B / Math.max(env.bankS, M.B * 0.6)), ep = Math.min(1.2, M.B / Math.max(env.bankP, M.B * 0.6));
    const k = 0.5 * RHO * u * u * L * d * (es * es - ep * ep);
    Y += 0.05 * k; N += -0.012 * k * L;
  }
  if (ext) { X += ext.X; Y += ext.Y; N += ext.N; }
  const ax = X / (m + M.mx), ay = Y / (m + M.my * kM), ar = N / (M.Iz + M.Jz * kM);
  S.u += ax * dt; S.v += ay * dt; S.r += ar * dt;
  if (env) { S.cE = env.cE || 0; S.cN = env.cN || 0; }
  S.psi += S.r * dt;
  if (S.psi < 0) S.psi += 2 * Math.PI; else if (S.psi >= 2 * Math.PI) S.psi -= 2 * Math.PI;
  const sn = Math.sin(S.psi), cs = Math.cos(S.psi);
  S.x += (S.u * sn + S.v * cs + S.cE) * dt;
  S.y += (S.u * cs - S.v * sn + S.cN) * dt;
  S.T = Tsum;
}

export function squat(M, uKn, h) {
  const s = Math.min(0.95, M.d / Math.max(h, M.d));
  return M.Cb * uKn * uKn / 100 * (s > 0.7 ? 1 + (s - 0.7) / 0.25 : 1);
}

export function displayRpm(M, n) {
  // đổi vòng quay hiệu dụng về vòng quay hiển thị theo bảng nấc máy
  const pts = Object.values(M.steps).map((s) => [s.n, s.rpm]).sort((a, b) => a[0] - b[0]);
  if (n <= pts[0][0]) return pts[0][1] * (pts[0][0] ? n / pts[0][0] : 1);
  for (let i = 1; i < pts.length; i++) {
    if (n <= pts[i][0]) { const f = (n - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0] || 1); return pts[i - 1][1] + f * (pts[i][1] - pts[i - 1][1]); }
  }
  const l = pts[pts.length - 1]; return l[1] * (l[0] ? n / l[0] : 1);
}
