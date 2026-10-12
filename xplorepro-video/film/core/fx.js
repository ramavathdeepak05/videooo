/* core/fx.js: brand contour-wave field ("The Measured Path"), evidence spark, bokeh. */
const CONTOUR_DEFAULT = { n: 48, gap: 14, y0: 540, amp: [38, 16], k: [.0021, .0047], speed: [.25, .4], converge: 0, xs: 300, xe: 1620,
  tangle: 0, T: 0, col: '#DCCEFF', alpha: .5, lw: 1.4, traj: '#7438F2', tilt: 0, phase: 0 };
/* contours(o): dozens of thin parallel curved lines; converge → they pinch into one violet trajectory */
function contours(o = {}) {
  const P = { ...CONTOUR_DEFAULT, ...o }; if (P.alpha <= .01) return;
  const c = (P.n - 1) / 2, step = 32;
  const base = x => P.amp[0] * Math.sin(P.k[0] * x + P.speed[0] * P.T + P.phase) + P.amp[1] * Math.sin(P.k[1] * x + P.speed[1] * P.T + 1.3 + P.phase) + P.tilt * (x - W / 2);
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 0; i < P.n; i++) {
    const off = i - c, fall = 1 - .75 * Math.abs(off) / c;
    g.beginPath();
    for (let x = -40; x <= W + 40; x += step) {
      const pinch = 1 - P.converge * smooth(P.xs, P.xe, x);
      const y = P.y0 + base(x) + off * P.gap * pinch + (P.tangle ? P.tangle * 60 * noise2(i * .37, x * .004 + P.T * .6) * (1 - P.converge * smooth(P.xs, P.xe, x)) : 0);
      x === -40 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.strokeStyle = rgba(P.col, P.alpha * fall); g.lineWidth = P.lw; g.stroke();
  }
  if (P.converge > .2) { // the evidence trajectory
    g.beginPath(); for (let x = -40; x <= W + 40; x += step) { const y = P.y0 + base(x); x === -40 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.strokeStyle = rgba(P.traj, clamp((P.converge - .2) / .6) * .9); g.lineWidth = 4; g.stroke();
  }
  g.restore();
}
/* contoursAlong(L, o): field that follows any lut() path; pinch(u) 0..1 controls spread along the path */
function contoursAlong(L, o = {}) {
  const n = o.n || 40, gap = o.gap || 12, c = (n - 1) / 2, alpha = o.alpha === undefined ? .45 : o.alpha, col = o.col || COL.contour;
  const pinch = o.pinch || (() => 1), stride = 4, pts = L.pts, T = o.T || 0;
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    const off = i - c; g.beginPath();
    for (let j = 0; j < pts.length; j += stride) {
      const k = Math.min(pts.length - 1, j + 1), k0 = Math.max(0, j - 1), dx = pts[k][0] - pts[k0][0], dy = pts[k][1] - pts[k0][1], l = Math.hypot(dx, dy) || 1;
      const u = j / (pts.length - 1), d = off * gap * pinch(u) + (o.wave ? o.wave * Math.sin(u * 9 + T + i * .2) : 0);
      const x = pts[j][0] - dy / l * d, y = pts[j][1] + dx / l * d; j ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.strokeStyle = rgba(col, alpha * (1 - .75 * Math.abs(off) / c)); g.lineWidth = o.lw || 1.4; g.stroke();
  }
  g.restore();
}
/* evidence spark: violet glowing point; trail = lut path segment behind it */
let SPARK_SPRITE = null;
function sparkSprite() {
  if (SPARK_SPRITE) return SPARK_SPRITE;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(138,71,255,.55)'); gr.addColorStop(.35, 'rgba(116,56,242,.22)'); gr.addColorStop(1, 'rgba(116,56,242,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return (SPARK_SPRITE = c);
}
function spark(x, y, s = 1, alpha = 1) {
  if (alpha <= .01 || s <= 0) return;
  g.save(); g.globalAlpha *= alpha; g.drawImage(sparkSprite(), x - 40 * s, y - 40 * s, 80 * s, 80 * s);
  circle(x, y, 7 * s, COL.violet); circle(x - 2 * s, y - 2 * s, 2.6 * s, 'rgba(255,255,255,.85)'); g.restore();
}
function sparkAlong(L, u, o = {}) {
  const len = o.trail === undefined ? .12 : o.trail;
  if (len > 0) { g.save(); g.globalAlpha *= (o.alpha === undefined ? 1 : o.alpha); for (let k = 0; k < 6; k++) { const a = u - len * (k + 1) / 6, b = u - len * k / 6; if (b <= 0) continue; g.globalAlpha *= .82; pathDraw(L, b, COL.violet, (o.w || 5) * (1 - k / 7), { from: Math.max(0, a) }); } g.restore(); }
  const p = L.at(u); spark(p.x, p.y, o.s || 1, o.alpha === undefined ? 1 : o.alpha); return p;
}
/* soft bokeh discs (cheap sprites) drifting; draw inside layer(c, depth) for parallax */
let BOKEH = null;
function bokehSprite() {
  if (BOKEH) return BOKEH; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(183,155,255,.35)'); gr.addColorStop(.7, 'rgba(183,155,255,.12)'); gr.addColorStop(1, 'rgba(183,155,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return (BOKEH = c);
}
function bokeh(lt, seed = 3, n = 10, o = {}) {
  const r = rng(seed), a = o.alpha === undefined ? .7 : o.alpha;
  g.save(); g.globalAlpha *= a;
  for (let i = 0; i < n; i++) {
    const x = r() * W * 1.2 - W * .1, y = r() * H, s = (o.size || 90) * (.5 + r()), sp2 = .3 + r() * .5;
    g.drawImage(bokehSprite(), x + Math.sin(lt * sp2 + i) * 30 - s / 2 + (o.drift || 0) * lt, y + Math.cos(lt * sp2 * .8 + i) * 24 - s / 2, s, s);
  }
  g.restore();
}
