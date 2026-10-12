/* core/math.js: constants, easing, springs, deterministic noise. Everything here is pure. */
const W = 1920, H = 1080, FPS = 30, TAU = Math.PI * 2;

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, p) => a + (b - a) * p;
const seg = (t, a, d) => clamp((t - a) / d);                 // 0→1 progress of t over [a, a+d]
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const eo = x => 1 - Math.pow(1 - clamp(x), 3);
const ei = x => Math.pow(clamp(x), 3);
const eio = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const expo = x => { x = clamp(x); return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); };
const expoIn = x => { x = clamp(x); return x === 0 ? 0 : Math.pow(2, 10 * x - 10); };
const expoIO = x => { x = clamp(x); return x === 0 ? 0 : x === 1 ? 1 : x < .5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2; };
/* brand easing from the site: cubic-bezier(0.22, 0.61, 0.36, 1) */
const brand = (() => { const cx = 3 * .22, bx = 3 * (.36 - .22) - cx, ax = 1 - cx - bx, cy = 3 * .61, by = 3 * (1 - .61) - cy, ay = 1 - cy - by;
  return x => { x = clamp(x); let t = x; for (let i = 0; i < 6; i++) { const f = ((ax * t + bx) * t + cx) * t - x, d = (3 * ax * t + 2 * bx) * t + cx; if (Math.abs(d) < 1e-6) break; t -= f / d; } return ((ay * t + by) * t + cy) * t; }; })();

/* Damped spring, closed form. dur ≈ settle time, bounce 0 = critically damped, cap .3 (≈4.6% overshoot). */
function spring(t, dur = .5, bounce = .1) {
  if (t <= 0) return 0;
  bounce = Math.min(bounce, .3);
  const w = TAU / dur, z = 1 - bounce;
  if (z >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
}
const SP = {
  cam: { dur: 1.0, bounce: 0 }, text: { dur: .6, bounce: 0 }, ui: { dur: .5, bounce: .15 },
  pop: { dur: .45, bounce: .28 }, needle: { dur: .8, bounce: .3 }, soft: { dur: .9, bounce: .05 }
};
const sp = (lt, t0, P = SP.ui) => spring(lt - t0, P.dur, P.bounce);
/* spring in, then spring out at t1 (returns 0..1..0) */
const spInOut = (lt, t0, t1, P = SP.ui, Pout = SP.text) => sp(lt, t0, P) * (1 - spring(lt - t1, Pout.dur, 0));

/* deterministic random + value noise */
function rng(seed) { let s = Math.floor(seed) % 2147483647; if (s <= 0) s += 2147483646; return () => (s = s * 16807 % 2147483647, (s - 1) / 2147483646); }
function hash1(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function noise1(x, seed = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash1(i + seed * 57), hash1(i + 1 + seed * 57), u) * 2 - 1; }
function hash2(x, y) { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); }
function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hash2(ix, iy), hash2(ix + 1, iy), ux), lerp(hash2(ix, iy + 1), hash2(ix + 1, iy + 1), ux), uy) * 2 - 1;
}

/* colours */
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(a, b, p) { const A = hexRgb(a), B = hexRgb(b); p = clamp(p); return `rgb(${Math.round(lerp(A[0], B[0], p))},${Math.round(lerp(A[1], B[1], p))},${Math.round(lerp(A[2], B[2], p))})`; }
function mixHex(a, b, p) { const A = hexRgb(a), B = hexRgb(b); p = clamp(p); return '#' + [0, 1, 2].map(i => Math.round(lerp(A[i], B[i], p)).toString(16).padStart(2, '0')).join(''); }
function rgba(h, a) { const [r, g2, b] = hexRgb(h); return `rgba(${r},${g2},${b},${clamp(a)})`; }

/* polyline / arc-length helpers for path-follow motion */
function lut(points, n = 400) { // points: [[x,y],...] treated as Catmull-Rom spline → {pts, len, at(u)->{x,y,a}}
  const P = points, out = [];
  const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return .5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
  const segs = P.length - 1;
  for (let i = 0; i <= n; i++) {
    const u = i / n * segs, k = Math.min(segs - 1, Math.floor(u)), t = u - k;
    const p0 = P[Math.max(0, k - 1)], p1 = P[k], p2 = P[k + 1], p3 = P[Math.min(P.length - 1, k + 2)];
    out.push([cr(p0[0], p1[0], p2[0], p3[0], t), cr(p0[1], p1[1], p2[1], p3[1], t)]);
  }
  const d = [0]; for (let i = 1; i < out.length; i++) d.push(d[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
  const len = d[d.length - 1];
  function at(u) {
    const s = clamp(u) * len; let lo = 0, hi = d.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (d[m] < s) lo = m; else hi = m; }
    const f = (s - d[lo]) / Math.max(1e-6, d[hi] - d[lo]), x = lerp(out[lo][0], out[hi][0], f), y = lerp(out[lo][1], out[hi][1], f);
    return { x, y, a: Math.atan2(out[hi][1] - out[lo][1], out[hi][0] - out[lo][0]) };
  }
  return { pts: out, d, len, at };
}
