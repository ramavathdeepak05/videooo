/* core/draw.js: palette, canvas primitives, text, icons, shadow sprites, cards, logo. Draws into global `g`. */
const COL = {
  canvas: '#FBFAF7', paper: '#FFFFFF', ink: '#20202C', muted: '#5A5A6B', grey: '#6F6B78', navy: '#2C2745',
  violet: '#7438F2', deep: '#5E27D8', bright: '#8A47FF', lilac: '#9B6BFF', pale: '#B79BFF', lav: '#F1EBFF', contour: '#DCCEFF',
  verified: '#1B7F5A', green: '#31B86B', amber: '#F59D3D', coral: '#F05A67', blue: '#4B79FF',
  night: '#24124F', logoInk: '#232326'
};
let g = null;                                   // current 2D context (engine swaps it via withCtx)
function withCtx(ctx, fn) { const prev = g; g = ctx; try { return fn(); } finally { g = prev; } }
const LOG = { on: false, t: 0, text: [], icons: [] };   // onscreen string / icon log (export mode)

/* ---------- primitives ---------- */
function circle(x, y, r, fill) { if (r <= 0) return; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = fill; g.fill(); }
function ring(x, y, r, w, col) { if (r <= 0 || w <= 0) return; g.beginPath(); g.arc(x, y, r, 0, TAU); g.strokeStyle = col; g.lineWidth = w; g.stroke(); }
function arc(x, y, r, w, col, p = 1, a0 = -Math.PI / 2) {
  if (r <= 0 || p <= 0) return; g.beginPath(); g.arc(x, y, r, a0, a0 + TAU * clamp(p));
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.stroke();
}
function rrect(x, y, w, h, r, fill, stroke, lw = 2) {
  if (w <= 0 || h <= 0) return;
  g.beginPath(); g.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}
function tf(x, y, s, rot, fn, alpha = 1) {
  if (Math.abs(s) <= 0.0005 || alpha <= 0.002) return;
  g.save(); g.translate(x, y); if (rot) g.rotate(rot); if (s !== 1) g.scale(s, s); g.globalAlpha *= clamp(alpha); fn(); g.restore();
}
function line(x1, y1, x2, y2, col, w, p = 1, dash) {
  if (p <= 0) return; g.beginPath(); g.moveTo(x1, y1); g.lineTo(lerp(x1, x2, p), lerp(y1, y2, p));
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; if (dash) g.setLineDash(dash); g.stroke(); g.setLineDash([]);
}
/* draw the first fraction p of a lut() path (from core/math.js); opts.from to start later */
function pathDraw(L, p, col, w, o = {}) {
  const a = clamp(o.from || 0), b = clamp(p); if (b <= a) return;
  const n = L.pts.length - 1, i0 = Math.floor(a * n), i1 = Math.ceil(b * n);
  const s0 = L.at(a), s1 = L.at(b);
  g.beginPath(); g.moveTo(s0.x, s0.y);
  for (let i = i0 + 1; i < i1; i++) g.lineTo(L.pts[i][0], L.pts[i][1]);
  g.lineTo(s1.x, s1.y);
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
  if (o.dash) { g.setLineDash(o.dash); g.lineDashOffset = o.dashOffset || 0; }
  g.stroke(); g.setLineDash([]);
}
function sparkle(x, y, s, col, rot = 0) {
  tf(x, y, s, rot, () => {
    g.beginPath(); g.moveTo(0, -1);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.quadraticCurveTo(0, 0, Math.sin(a + Math.PI / 2), -Math.cos(a + Math.PI / 2)); }
    g.closePath(); g.fillStyle = col; g.fill();
  });
}
/* soft expanding ring (alpha capped .35 for the calm brand) */
function shock(x, y, p, R, col, w = 6) { if (p <= 0 || p >= 1) return; g.save(); g.globalAlpha *= .35 * (1 - p); ring(x, y, 12 + expo(p) * R, w * (1 - p) + 1, col); g.restore(); }

/* ---------- text ---------- */
const FONT = { D: 'DMSans', I: 'Inter' };
function setFont(size, weight = 700, face = 'D') { g.font = `${weight} ${size}px ${FONT[face] || face}`; }
/* type(str, x, y, {size, weight, face:'D'|'I', col, align, base, ls(px letter-spacing), alpha}) */
function type(str, x, y, o = {}) {
  const size = o.size || 40;
  setFont(size, o.weight || 700, o.face || 'D');
  g.fillStyle = o.col || COL.ink; g.textAlign = o.align || 'center'; g.textBaseline = o.base || 'middle';
  g.letterSpacing = (o.ls || 0) + 'px';
  const a = o.alpha === undefined ? 1 : o.alpha;
  if (a <= 0.01) { g.letterSpacing = '0px'; return 0; }
  g.save(); g.globalAlpha *= a; g.fillText(str, x, y); g.restore();
  const w = g.measureText(str).width; g.letterSpacing = '0px';
  if (LOG.on && a > .2) LOG.text.push([+LOG.t.toFixed(2), str]);
  return w;
}
function textWidth(str, size, weight = 700, face = 'D', ls = 0) { setFont(size, weight, face); g.letterSpacing = ls + 'px'; const w = g.measureText(str).width; g.letterSpacing = '0px'; return w; }
/* mask-rise: text rises into a clipped line box; out (optional) = local time it rises out */
function typeRise(str, x, y, lt, t0, o = {}) {
  const p = sp(lt, t0, o.P || SP.text), q = o.out !== undefined ? spring(lt - o.out, .5, 0) : 0;
  if (p <= 0.001 || q >= .999) return;
  const size = o.size || 40, w = textWidth(str, size, o.weight || 700, o.face || 'D', o.ls || 0) + 20;
  const align = o.align || 'center', x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x - 10;
  g.save(); g.beginPath(); g.rect(x0, y - size * .78, w, size * 1.56); g.clip();
  type(str, x, y + (1 - p) * size * 1.1 - q * size * 1.1, { ...o, alpha: (o.alpha === undefined ? 1 : o.alpha) * clamp(p * 1.4) * (1 - q) });
  g.restore();
}
/* small eyebrow label: uppercase Inter with tracking */
function eyebrow(str, x, y, lt, t0, o = {}) { typeRise(str.toUpperCase(), x, y, lt, t0, { size: 26, weight: 600, face: 'I', ls: 3, col: COL.violet, ...o }); }

/* ---------- icons (lucide-static, recoloured; resolution buckets so push-ins stay sharp) ---------- */
const iconCache = {}, pending = [];
function iconImg(name, col, sw, res) {
  const k = name + '|' + col + '|' + sw + '|' + res; let im = iconCache[k];
  if (!im) {
    const src = window.ICON_SVG && window.ICON_SVG[name];
    if (!src) { console.error('missing icon ' + name); iconCache[k] = im = new Image(); return im; }
    const svg = src.replace(/<!--.*?-->/s, '').replace(/currentColor/g, col)
      .replace(/stroke-width="2"/, `stroke-width="${sw}"`).replace(/width="24"\s+height="24"/, `width="${res}" height="${res}"`);
    im = new Image(); pending.push(new Promise(r => { im.onload = r; im.onerror = r; }));
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); iconCache[k] = im;
  }
  return im;
}
function icon(name, x, y, size, col = '#fff', sw = 2) {
  const m = g.getTransform(), sc = Math.hypot(m.a, m.b) * size;
  const res = sc <= 120 ? 128 : sc <= 240 ? 256 : sc <= 480 ? 512 : 1024;
  const im = iconImg(name, col, sw, res);
  if (LOG.on) LOG.icons.push(name);
  if (im.complete && im.naturalWidth) g.drawImage(im, x - size / 2, y - size / 2, size, size);
  else window.__late = true;
}
function badge(x, y, r, fill, name, s = 1, iconCol = '#fff', o = {}) {
  tf(x, y, s, 0, () => { if (o.shadow !== false) softShadow(-r, -r, 2 * r, 2 * r, r, { blur: r * .5, dy: r * .18, alpha: .16 }); circle(0, 0, r, fill); icon(name, 0, 0, r * (o.k || 1.0), iconCol, o.sw || 2); });
}

/* ---------- shadow sprites (no per-frame shadowBlur) ---------- */
const shadowCache = {};
function shadowSprite(w, h, r, blur, col) {
  w = Math.max(2, Math.round(w / 4) * 4); h = Math.max(2, Math.round(h / 4) * 4); blur = Math.round(blur);
  const k = [w, h, Math.round(r), blur, col].join('|'); let c = shadowCache[k];
  if (!c) {
    const pad = blur * 2 + 4; c = document.createElement('canvas'); c.width = w + pad * 2; c.height = h + pad * 2;
    const x = c.getContext('2d'); x.shadowColor = col; x.shadowBlur = blur; x.shadowOffsetX = 10000;
    x.beginPath(); x.roundRect(pad - 10000, pad, w, h, Math.min(r, w / 2, h / 2)); x.fillStyle = '#000'; x.fill();
    c.pad = pad; shadowCache[k] = c;
  }
  return c;
}
/* brand float shadow: 0 12px 32px -8px rgba(32,32,44,.14) */
function softShadow(x, y, w, h, r, o = {}) {
  const blur = o.blur === undefined ? 32 : o.blur, dy = o.dy === undefined ? 12 : o.dy, a = o.alpha === undefined ? .14 : o.alpha, spread = o.spread === undefined ? -8 : o.spread;
  const c = shadowSprite(w + spread * 2, h + spread * 2, r, blur, o.col || 'rgba(32,32,44,1)');
  g.save(); g.globalAlpha *= a; g.drawImage(c, x - spread - c.pad, y - spread + dy - c.pad); g.restore();
}
function card(x, y, w, h, r = 24, o = {}) {
  if (o.shadow !== false) softShadow(x, y, w, h, r, o.sh || {});
  rrect(x, y, w, h, r, o.fill || COL.paper, o.stroke === undefined ? COL.contour : o.stroke, o.lw || 1.5);
}
/* abstract placeholder "text" bars (no fake readable text) */
function bars(x, y, w, n, o = {}) {
  const r = rng(o.seed || 7), h = o.h || 12, gap = o.gap || 24;
  for (let i = 0; i < n; i++) { const ww = w * (i === 0 && o.head ? .55 : .5 + r() * .5) * clamp((o.p === undefined ? 1 : o.p) * n - i); rrect(x, y + i * gap, ww, h, h / 2, i === 0 && o.head ? (o.headCol || COL.ink) : (o.col || COL.contour)); }
}
function pill(x, y, w, h, fill, o = {}) { rrect(x - w / 2, y - h / 2, w, h, h / 2, fill, o.stroke, o.lw || 2); }
/* label chip: text inside a pill, centred at x,y */
function chip(str, x, y, o = {}) {
  const size = o.size || 26, pad = o.pad || 22, w = textWidth(str, size, o.weight || 600, o.face || 'I') + pad * 2 + (o.icon ? size * 1.3 : 0), h = size * 1.9;
  if (o.shadow) softShadow(x - w / 2, y - h / 2, w, h, h / 2, { blur: 18, dy: 6, alpha: .12 });
  pill(x, y, w, h, o.fill || COL.lav, { stroke: o.stroke });
  if (o.icon) icon(o.icon, x - w / 2 + pad + size * .5, y, size * 1.05, o.iconCol || o.col || COL.deep);
  type(str, x + (o.icon ? size * .65 : 0), y + 1, { size, weight: o.weight || 600, face: o.face || 'I', col: o.col || COL.deep });
  return w;
}

/* ---------- logo ---------- */
/* Vector trace of the compass-X mark (units: source px of a 4x crop; height 873). Parts animate independently. */
const MARK = {
  cx: 517.5, cy: 511.5, h: 873,
  chev: [[55, 75], [355, 75], [525, 330], [455, 440], [195, 945], [45, 945], [325, 495]],
  arm: [[212, 945], [360, 945], [522, 702], [695, 945], [990, 945], [715, 520]],
  violet: [[685, 75], [968, 78], [455, 440]],
  needleL: [[205, 945], [455, 440], [965, 80]],
  needleR: [[205, 945], [715, 520], [965, 80]],
  dot: [555, 500, 55]
};
const MARK_DOT = { x: (MARK.dot[0] - MARK.cx) / MARK.h, y: (MARK.dot[1] - MARK.cy) / MARK.h };  // dot offset per unit height
function poly(pts) { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x - MARK.cx, y - MARK.cy) : g.moveTo(x - MARK.cx, y - MARK.cy)); g.closePath(); }
/* vectorMark(x, y, h, o): o = {chev, arm, violet, needle, dot: 0..1 progress, alpha, inverse} */
function vectorMark(x, y, h, o = {}) {
  const P = k => (o[k] === undefined ? 1 : o[k]);
  const inv = !!o.inverse;
  const C = inv ? { ink: '#FFFFFF', violet: '#A27BFF', nl: '#E9E1FF', nr: '#C9B6FF', dot: COL.night, edge: 'rgba(255,255,255,0)' }
    : { ink: COL.logoInk, violet: COL.deep, nl: '#FFFFFF', nr: '#E3E0EC', dot: COL.logoInk, edge: 'rgba(32,32,44,.14)' };
  tf(x, y, h / MARK.h, 0, () => {
    g.globalAlpha *= (o.alpha === undefined ? 1 : o.alpha);
    const ch = P('chev'), am = P('arm'), vi = P('violet'), nd = P('needle'), dt = P('dot');
    if (ch > 0) tf(-(1 - ch) * 260, -(1 - ch) * 260, 1, 0, () => { poly(MARK.chev); g.fillStyle = C.ink; g.fill(); }, clamp(ch * 2));
    if (am > 0) tf((1 - am) * 260, (1 - am) * 260, 1, 0, () => { poly(MARK.arm); g.fillStyle = C.ink; g.fill(); }, clamp(am * 2));
    if (vi > 0) { const [px, py] = MARK.needleL[1]; tf(px - MARK.cx, py - MARK.cy, vi, 0, () => { g.translate(-(px - MARK.cx), -(py - MARK.cy)); poly(MARK.violet); g.fillStyle = C.violet; g.fill(); }); }
    if (nd > 0) {
      // needle draws outward from the pivot dot along its axis
      const [ax, ay] = MARK.needleL[0], [bx, by] = MARK.needleL[2], ang = Math.atan2(by - ay, bx - ax), half = Math.hypot(bx - ax, by - ay) / 2 + 10;
      g.save(); g.translate(MARK.dot[0] - MARK.cx, MARK.dot[1] - MARK.cy); g.rotate(ang); g.beginPath(); g.rect(-half * nd - 30 * nd, -400, (half * nd + 30 * nd) * 2, 800); g.rotate(-ang); g.translate(-(MARK.dot[0] - MARK.cx), -(MARK.dot[1] - MARK.cy)); g.clip();
      poly(MARK.needleR); g.fillStyle = C.nr; g.fill();
      poly(MARK.needleL); g.fillStyle = C.nl; g.fill(); g.strokeStyle = C.edge; g.lineWidth = 5; g.stroke();
      g.restore();
    }
    if (dt > 0) circle(MARK.dot[0] - MARK.cx, MARK.dot[1] - MARK.cy, MARK.dot[2] * dt, C.dot);
  });
}
/* raster wordmark "Xplorepro" letters (without the mark), processed once from the light-bg lockup into true alpha */
const WORD = { sx: 318, sy: 292, sw: 1240, sh: 296 }; let WORDC = null, WORDC_INV = null;
const logoImg = new Image(); pending.push(new Promise(r => { logoImg.onload = r; logoImg.onerror = r; })); logoImg.src = '../assets/logo.jpeg';
function buildWordmark() {
  const mk = inv => {
    const c = document.createElement('canvas'); c.width = WORD.sw; c.height = WORD.sh; const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(logoImg, WORD.sx, WORD.sy, WORD.sw, WORD.sh, 0, 0, WORD.sw, WORD.sh);
    const im = x.getImageData(0, 0, WORD.sw, WORD.sh), d = im.data, BG = 247;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], b = d[i + 2], a = clamp((BG - Math.min(r, gg, b)) / 190);
      if (a < .02) { d[i + 3] = 0; continue; }
      let R = BG + (r - BG) / a, G = BG + (gg - BG) / a, B = BG + (b - BG) / a;
      const violetish = b - r > 40;
      if (inv) { if (violetish) { R = 178; G = 150; B = 255; } else { R = G = B = 255; } }
      else if (violetish) { R = 94; G = 39; B = 216; } else { R = 32; G = 32; B = 44; }
      d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = Math.round(a * 255);
    }
    x.putImageData(im, 0, 0); return c;
  };
  WORDC = mk(false); WORDC_INV = mk(true);
}
/* wordmark(xLeft, yCenter, h, p=wipe progress, {inverse}) → width */
function wordmark(xLeft, y, h, p = 1, o = {}) {
  const c = o.inverse ? WORDC_INV : WORDC, w = h * WORD.sw / WORD.sh; if (!c || p <= 0) return w;
  if (LOG.on) LOG.text.push([+LOG.t.toFixed(2), 'Xplorepro']);
  g.drawImage(c, 0, 0, WORD.sw * clamp(p), WORD.sh, xLeft, y - h / 2, w * clamp(p), h); return w;
}
/* full lockup centred at cx,cy; h = wordmark height */
function lockup(cx, cy, h, o = {}) {
  // proportions measured from the source lockup: mark is .7365h tall, centred .0743h above the word box, gap .052h
  const ww = h * WORD.sw / WORD.sh, mh = h * .7365, mw = mh * 945 / 873, gap = h * .052, total = mw + gap + ww, left = cx - total / 2;
  const mx = left + mw / 2 + (o.markDx || 0), my = cy - h * .0743;
  vectorMark(mx, my, mh, { inverse: o.inverse, ...(o.mark || {}) });
  wordmark(left + mw + gap, cy, h, o.word === undefined ? 1 : o.word, o);
  return { left, total, markX: mx, markY: my, markH: mh, wordX: left + mw + gap, wordW: ww };
}
