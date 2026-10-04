/* XplorePro — motion-graphics product film (Zelios-style: VO-led, flat 2D, minimal text).
   Everything is drawn on one canvas by render(t). TIMELINE and ICON_SVG are injected by render-zelios.js. */
const W = 1920, H = 1080, cv = document.getElementById('c'), g = cv.getContext('2d');
const TL = window.TIMELINE, DUR = TL.duration;
const COL = {
  violet: '#7438F2', deep: '#5E27D8', night: '#1B1036', night2: '#2A1760', ink: '#20202C',
  lav: '#F1EBFF', contour: '#DCCEFF', lilac: '#9B6BFF', pale: '#B79BFF', canvas: '#FBFAF7', white: '#FFFFFF',
  green: '#22B07D', amber: '#F2A33A', coral: '#F2545B', blue: '#3D7BF2', skin: '#C68B59', hair: '#2B1B12'
};

/* ---------- math / easing ---------- */
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, p) => a + (b - a) * p;
const seg = (t, a, d) => clamp((t - a) / d);
const eo = x => 1 - Math.pow(1 - clamp(x), 3);
const ei = x => Math.pow(clamp(x), 3);
const eio = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const expo = x => { x = clamp(x); return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); };
const expoIn = x => { x = clamp(x); return x === 0 ? 0 : Math.pow(2, 10 * x - 10); };
const expoIO = x => { x = clamp(x); return x === 0 ? 0 : x === 1 ? 1 : x < .5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2; };
const back = (x, s = 1.9) => { x = clamp(x); return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const elastic = x => { x = clamp(x); if (x === 0 || x === 1) return x; return Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * (TAU / 3)) + 1; };
function rng(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = s * 16807 % 2147483647, (s - 1) / 2147483646); }

/* ---------- drawing primitives ---------- */
function circle(x, y, r, fill) { if (r <= 0) return; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = fill; g.fill(); }
function arc(x, y, r, w, col, p = 1, a0 = -Math.PI / 2) {
  if (r <= 0 || p <= 0) return; g.beginPath(); g.arc(x, y, r, a0, a0 + TAU * clamp(p));
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.stroke();
}
function rrect(x, y, w, h, r, fill, stroke, lw = 3) {
  g.beginPath(); g.roundRect(x, y, w, h, r);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}
function shadow(blur = 40, y = 16, col = 'rgba(52,18,128,.20)') { g.shadowColor = col; g.shadowBlur = blur; g.shadowOffsetY = y; }
function noShadow() { g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0; }
function text(s, x, y, size, col, weight = 700, align = 'center') {
  g.font = `${weight} ${size}px P`; g.fillStyle = col; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(s, x, y);
}
function tf(x, y, s, rot, fn, alpha = 1) {
  if (s <= 0.001 || alpha <= 0.001) return;
  g.save(); g.translate(x, y); if (rot) g.rotate(rot); if (s !== 1) g.scale(s, s); g.globalAlpha *= alpha; fn(); g.restore();
}
function line(x1, y1, x2, y2, col, w, p = 1, dash) {
  if (p <= 0) return; g.beginPath(); g.moveTo(x1, y1); g.lineTo(lerp(x1, x2, p), lerp(y1, y2, p));
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; if (dash) g.setLineDash(dash); g.stroke(); g.setLineDash([]);
}
function sparkle(x, y, s, col, rot = 0) {
  tf(x, y, s, rot, () => {
    g.beginPath(); g.moveTo(0, -1);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.quadraticCurveTo(0, 0, Math.sin(a + Math.PI / 2), -Math.cos(a + Math.PI / 2)); }
    g.closePath(); g.fillStyle = col; g.fill();
  });
}
function burstLines(x, y, p, r0, r1, n, col, w = 8, rot = 0) {
  if (p <= 0 || p >= 1) return;
  const a = expo(p), b = expo(clamp(p * 1.6 - .35));
  for (let i = 0; i < n; i++) {
    const ang = rot + i / n * TAU;
    const ra = lerp(r0, r1, b), rb = lerp(r0, r1, a);
    if (rb - ra < 1) continue;
    line(x + Math.cos(ang) * ra, y + Math.sin(ang) * ra, x + Math.cos(ang) * rb, y + Math.sin(ang) * rb, col, w);
  }
}
function shock(x, y, p, R, col, w = 16) { if (p <= 0 || p >= 1) return; g.save(); g.globalAlpha *= 1 - p; arc(x, y, 20 + expo(p) * R, w * (1 - p) + 1, col); g.restore(); }
function decor(lt, seed, cols, n = 14, alpha = .5) {
  const r = rng(seed);
  g.save(); g.globalAlpha *= alpha;
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() * H, s = 10 + r() * 34, sp = .4 + r() * .7, ph = r() * TAU, type = Math.floor(r() * 3), col = cols[i % cols.length];
    const dx = Math.sin(lt * sp + ph) * 26, dy = Math.cos(lt * sp * .8 + ph) * 26 - lt * 10;
    tf(x + dx, y + dy, 1, lt * sp * .6 + ph, () => {
      if (type === 0) arc(0, 0, s, 5, col);
      else if (type === 1) circle(0, 0, s * .45, col);
      else { line(-s * .6, 0, s * .6, 0, col, 7); line(0, -s * .6, 0, s * .6, col, 7); }
    });
  }
  g.restore();
}
function confetti(x, y, lt, seed, n = 60, spread = 1) {
  if (lt <= 0 || lt > 2.6) return;
  const r = rng(seed), cols = [COL.violet, COL.amber, COL.green, COL.pale, COL.coral, COL.blue];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (r() - .5) * 2.4 * spread, v = 700 + r() * 900, rot0 = r() * TAU, vr = (r() - .5) * 16;
    const px = x + Math.cos(a) * v * lt * .85, py = y + Math.sin(a) * v * lt + 1100 * lt * lt;
    const c = cols[i % cols.length], w = 12 + r() * 10, h = 7 + r() * 6;
    tf(px, py, 1, rot0 + vr * lt, () => { g.fillStyle = c; g.fillRect(-w / 2, -h / 2, w, h * Math.abs(Math.cos(lt * 9 + i))); }, clamp(2.6 - lt));
  }
}

/* ---------- icons (lucide, recoloured) ---------- */
const iconCache = {}, pending = [];
function iconImg(name, col, sw) {
  const k = name + '|' + col + '|' + sw; let im = iconCache[k];
  if (!im) {
    const svg = window.ICON_SVG[name].replace(/<!--.*?-->/s, '').replace(/currentColor/g, col)
      .replace(/stroke-width="2"/, `stroke-width="${sw}"`).replace(/width="24"\s+height="24"/, 'width="256" height="256"');
    im = new Image(); pending.push(new Promise(r => { im.onload = r; im.onerror = r; }));
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); iconCache[k] = im;
  }
  return im;
}
function icon(name, x, y, size, col = '#fff', sw = 2.2) { const im = iconImg(name, col, sw); if (im.complete && im.naturalWidth) g.drawImage(im, x - size / 2, y - size / 2, size, size); }
function badge(x, y, r, fill, name, s = 1, iconCol = '#fff', sh = true) {
  tf(x, y, s, 0, () => { if (sh) shadow(30, 12, 'rgba(40,10,110,.25)'); circle(0, 0, r, fill); noShadow(); icon(name, 0, 0, r * 1.05, iconCol); });
}

/* ---------- brand logo (cropped from the light-background lockup) ---------- */
const logo = new Image(); pending.push(new Promise(r => { logo.onload = r; })); logo.src = 'assets/logo.jpeg';
const MARK = { sx: 58, sy: 298, sw: 250, sh: 236 }, WORD = { sx: 318, sy: 292, sw: 1240, sh: 296 };
function drawCrop(c, x, y, h, clipW = 1) {
  if (!logo.complete || h <= 0) return;
  const w = h * c.sw / c.sh;
  g.save(); g.globalCompositeOperation = 'multiply'; g.filter = 'brightness(1.08) contrast(1.12)';
  g.drawImage(logo, c.sx, c.sy, c.sw * clipW, c.sh, x - w / 2, y - h / 2, w * clipW, h); g.restore();
}
const mark = (x, y, h) => drawCrop(MARK, x, y, h);
function wordmark(xLeft, y, h, p) { const w = h * WORD.sw / WORD.sh; if (p > 0) drawCrop(WORD, xLeft + w / 2, y, h, p); return w; }
function fullLogo(cx, cy, h, pm, pw) { // h = wordmark height; mark scaled to match
  const ww = h * WORD.sw / WORD.sh, mh = h * .8, mw = mh * MARK.sw / MARK.sh, gap = h * .04, total = mw + gap + ww, left = cx - total / 2;
  if (pm > 0) tf(left + mw / 2, cy - h * .08, back(pm, 2.2), (1 - eo(pm)) * -2.4, () => mark(0, 0, mh));
  if (pw > 0) wordmark(left + mw + gap - (1 - expo(pw)) * 40, cy, h, expoIO(pw));
}

/* ---------- characters ---------- */
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = n >> 8 & 255, b = n & 255; r = clamp(r * k, 0, 255) | 0; gg = clamp(gg * k, 0, 255) | 0; b = clamp(b * k, 0, 255) | 0; return `rgb(${r},${gg},${b})`; }
function person(x, y, s, o = {}) { // origin = chest
  tf(x, y, s, o.rot || 0, () => {
    const shirt = o.shirt || COL.violet, skin = o.skin || COL.skin, hair = o.hair || COL.hair, sh = o.shrug || 0;
    if (sh > 0) {
      for (const d of [-1, 1]) {
        g.beginPath(); g.moveTo(d * 72, 70); g.quadraticCurveTo(d * 150, 40 - 30 * sh, d * (128 + 6 * sh), -10 - 70 * sh);
        g.strokeStyle = shade(shirt, .9); g.lineWidth = 38; g.lineCap = 'round'; g.stroke();
        circle(d * (128 + 6 * sh), -18 - 70 * sh, 22, skin);
      }
    }
    g.beginPath(); g.moveTo(-100, 190); g.bezierCurveTo(-104, 50, -62, 14, 0, 14); g.bezierCurveTo(62, 14, 104, 50, 100, 190); g.closePath();
    g.fillStyle = shirt; g.fill();
    g.beginPath(); g.moveTo(-38, 20); g.quadraticCurveTo(0, 70, 38, 20); g.strokeStyle = shade(shirt, .78); g.lineWidth = 12; g.stroke();
    rrect(-17, -22, 34, 44, 12, shade(skin, .9));
    circle(0, -66, 56, skin);
    g.fillStyle = hair; g.beginPath(); g.ellipse(0, -100, 60, 34, 0, Math.PI * .95, TAU + Math.PI * .05); g.fill();
    g.beginPath(); g.ellipse(-30, -96, 34, 26, -.5, 0, TAU); g.fill();
    const ey = o.eyesY || 0;
    circle(-20, -62 + ey, 5.5, COL.hair); circle(20, -62 + ey, 5.5, COL.hair);
    g.beginPath();
    if (o.worried) { g.moveTo(-14, -34); g.quadraticCurveTo(0, -42, 14, -34); } else { g.moveTo(-15, -38); g.quadraticCurveTo(0, -26, 15, -38); }
    g.strokeStyle = COL.hair; g.lineWidth = 5; g.lineCap = 'round'; g.stroke();
  });
}
const PEOPLE = [
  { skin: '#C68B59', hair: '#2B1B12', shirt: '#7438F2' }, { skin: '#8D5A3B', hair: '#1A120D', shirt: '#22B07D' },
  { skin: '#E0AC7E', hair: '#5A3A22', shirt: '#F2A33A' }, { skin: '#A86B45', hair: '#14100C', shirt: '#3D7BF2' },
  { skin: '#F1C9A5', hair: '#3B2416', shirt: '#F2545B' }
];
function bust(x, y, r, i, bg = COL.lav) {
  g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = bg; g.fill(); g.clip();
  person(x, y + r * .45, r / 120, PEOPLE[i % PEOPLE.length]); g.restore();
}

/* ---------- timeline helpers ---------- */
const SFX = [];
function cue(sc, local, type, gain = 1) { SFX.push({ t: +(sc.start + local).toFixed(3), type, gain }); }
function wt(sc, word, li = 0) { // approx local time a word is spoken (proportional to text position)
  const L = sc.vo[li], i = L.text.toLowerCase().indexOf(word.toLowerCase());
  return L.start - sc.start + L.dur * (i < 0 ? 0 : i / L.text.length);
}
function bg(col) { g.fillStyle = col; g.fillRect(0, 0, W, H); }
function cam(cx, cy, z = 1, rot = 0) { g.translate(W / 2, H / 2); g.scale(z, z); g.rotate(rot); g.translate(-cx, -cy); }

/* =================================================================== SCENES */
const SC = {};

/* 1 — Placement-season chaos: an orbit of tasks speeds up around the student, then stalls. */
SC.chaos = {
  init(sc) {
    const s = { sc };
    const w = [wt(sc, 'Resumes'), wt(sc, 'skills'), wt(sc, 'mock'), wt(sc, 'deadlines')];
    s.tq = sc.vo[1].start - sc.start + .05;            // "...and no idea what to work on next"
    s.tend = sc.end - sc.start;
    const extra = ['chart-column', 'building-2', 'clock', 'briefcase', 'bell', 'book-open'];
    const cols = [COL.violet, COL.green, COL.amber, COL.coral, COL.deep, COL.blue, COL.lilac, COL.green, COL.amber, COL.violet];
    s.items = ['file-text', 'code-xml', 'mic', 'calendar-clock', ...extra].map((n, i) => ({
      n, col: cols[i], t: i < 4 ? w[i] : w[3] + .22 + (i - 4) * .14, R: [350, 440, 520][i % 3] + (i * 37) % 40, a0: i * 2.39996
    }));
    s.items.forEach(it => cue(sc, it.t, 'pop', .8));
    cue(sc, .12, 'pop', .6); cue(sc, s.tq, 'stop', 1); cue(sc, s.tend - .55, 'suck', 1);
    return s;
  },
  spin(s, lt) { const f = t => .45 * t + .2 * t * t; if (lt < s.tq) return f(lt); const w = .45 + .4 * s.tq; return f(s.tq) + w * (1 - Math.exp(-(lt - s.tq) * 2.5)) / 2.5; },
  draw(lt, s) {
    bg(COL.lav); decor(lt, 11, [COL.contour, COL.pale], 16, .7);
    const cx = 960, cy = 560, tq = s.tq;
    const k = expoIn(seg(lt, s.tend - .55, .45));         // implode at the end
    const zoom = lerp(1, 1.1, eio(seg(lt, 0, tq))) - .1 * eo(seg(lt, tq, .8));
    g.save(); g.translate(cx, cy); g.scale(zoom * (1 - k), zoom * (1 - k)); g.rotate(k * 2.2); g.translate(-cx, -cy);
    const spin = this.spin(s, lt), calm = eo(seg(lt, tq, .9));
    // orbit guide
    g.save(); g.globalAlpha = .35 * eo(seg(lt, .3, .6)); g.setLineDash([4, 18]);
    for (const R of [350, 440, 520]) { g.beginPath(); g.ellipse(cx, cy, R, R * .5, 0, 0, TAU); g.strokeStyle = COL.pale; g.lineWidth = 4; g.stroke(); }
    g.restore();
    const placed = s.items.map(it => {
      const a = it.a0 + spin * (it.R < 400 ? 1.15 : .9), R = it.R + calm * 120;
      return { it, x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R * .5 - 30, d: Math.sin(a) };
    });
    const drawItem = p => {
      const it = p.it, pop = back(seg(lt, it.t, .45), 2.4), sc = (.82 + .22 * p.d) * pop;
      if (pop <= 0) return;
      g.save(); g.filter = calm > 0 ? `grayscale(${calm}) opacity(${1 - .45 * calm})` : 'none';
      tf(p.x, p.y + Math.sin(lt * 5 + it.a0) * 6, sc, Math.sin(lt * 3 + it.a0) * .12 * (1 - calm), () => {
        badge(0, 0, 74, it.col, it.n);
        const nb = back(seg(lt, it.t + .4, .35), 3);
        if (nb > 0 && it.t < 3.8) tf(54, -54, nb, 0, () => { circle(0, 0, 17, COL.coral); text('!', 0, 1, 22, '#fff', 800); });
      });
      g.restore();
    };
    placed.filter(p => p.d < 0).forEach(drawItem);
    // student
    const pop = back(seg(lt, .1, .5), 1.6);
    tf(cx, cy + 40, pop, 0, () => { circle(0, 20, 235, COL.white); });
    const stress = seg(lt, s.items[3].t, 1.2) * (1 - calm);
    const shake = Math.sin(lt * 46) * 5 * stress;
    g.save(); g.beginPath(); g.arc(cx, cy + 60, 235 * pop, 0, TAU); g.clip();
    person(cx + shake, cy + 80 + (1 - eo(seg(lt, .2, .6))) * 260, 1.25, { ...PEOPLE[0], worried: lt > s.items[2].t, shrug: eo(seg(lt, tq + .1, .45)), eyesY: calm * -4 });
    g.restore();
    if (stress > .05) for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i - 1) * .55, f = (lt * 3 + i * .33) % 1;
      g.save(); g.globalAlpha = stress * (1 - f);
      line(cx + Math.cos(a) * (190 + f * 30), cy - 70 + Math.sin(a) * (190 + f * 30), cx + Math.cos(a) * (240 + f * 30), cy - 70 + Math.sin(a) * (240 + f * 30), COL.coral, 9);
      g.restore();
    }
    placed.filter(p => p.d >= 0).forEach(drawItem);
    // the big question
    const q = back(seg(lt, tq + .25, .5), 2.6);
    if (q > 0) tf(cx + 210, cy - 290, q, Math.sin(lt * 3.2) * .14, () => {
      shadow(30, 12); circle(0, 0, 92, COL.violet); noShadow(); text('?', 4, 8, 130, '#fff', 800);
    });
    burstLines(cx + 210, cy - 290, seg(lt, tq + .25, .6), 110, 190, 10, COL.violet, 9);
    g.restore();
    // anticipation dot
    const d = seg(lt, s.tend - .2, .2);
    if (d > 0) circle(cx, cy, 10 + 30 * eo(d), COL.violet);
  }
};

/* 2 — Burst reveal of the XplorePro logo. */
SC.reveal = {
  init(sc) { cue(sc, 0, 'impact', 1.1); cue(sc, .35, 'pop', .9); cue(sc, 1.0, 'whoosh', .6); cue(sc, 1.25, 'shine', .8); return { sc, len: sc.end - sc.start }; },
  draw(lt, s) {
    bg(COL.lav);
    circle(960, 540, expo(seg(lt, 0, .45)) * 1250, COL.violet);
    circle(960, 540, expo(seg(lt, .12, .5)) * 1250, COL.white);
    for (let j = 0; j < 3; j++) shock(960, 540, seg(lt, .05 + j * .09, .9), 900, j === 1 ? COL.pale : COL.violet, 20);
    burstLines(960, 540, seg(lt, .1, .7), 160, 520, 16, COL.pale, 10);
    decor(lt, 7, [COL.contour, COL.pale], 12, eo(seg(lt, .4, .5)) * .8);
    // logo build: big centred mark → slides left as the wordmark wipes out of it
    const H0 = 210, ww = H0 * WORD.sw / WORD.sh, mh = H0 * .8, mw = mh * MARK.sw / MARK.sh, total = mw + 10 + ww;
    const fx = 960 - total / 2 + mw / 2, fy = 540 - H0 * .08;
    const out = expoIO(seg(lt, s.len - .45, .45));           // hand-off: back to a centred mark
    const pm = seg(lt, .3, .6), mv = expoIO(seg(lt, .9, .6)) * (1 - out);
    const mx = lerp(960, fx, mv), mhh = lerp(lerp(270, mh, mv), 120, out);
    tf(mx, lerp(540, fy, mv), back(pm, 2.2), (1 - eo(pm)) * -3, () => mark(0, 0, mhh));
    const pw = seg(lt, 1.0, .6) * (1 - out);
    if (pw > 0) {
      g.save(); g.beginPath(); g.rect(fx + mw / 2 + 4, 0, W, H); g.clip();
      wordmark(fx + mw / 2 + 10 - (1 - expo(pw)) * 120, 540, H0, expoIO(pw)); g.restore();
    }
    [[-420, -170, .9], [440, -150, .7], [-300, 190, .6], [520, 170, 1]].forEach(([dx, dy, sz], i) => {
      const p = seg(lt, 1.25 + i * .08, .7); if (p > 0 && p < 1) sparkle(960 + dx, 540 + dy, 40 * sz * Math.sin(p * Math.PI), i % 2 ? COL.amber : COL.violet, p * 2);
    });
  }
};

/* 3 — One ecosystem: students, colleges, employers orbit the XplorePro hub. */
SC.eco = {
  init(sc) {
    const s = { sc, te: wt(sc, 'ecosystem'), tai: wt(sc, 'AI'), tn: [wt(sc, 'students'), wt(sc, 'colleges'), wt(sc, 'employers')] };
    s.tn.forEach(t => cue(sc, t, 'pop', 1)); cue(sc, s.te, 'shine', .7); cue(sc, .05, 'whoosh', .5);
    return s;
  },
  draw(lt, s) {
    bg(COL.white);
    const cx = 960, cy = 540;
    circle(cx, cy, expo(seg(lt, 0, .55)) * 1250, COL.night);
    g.save(); g.globalAlpha = eo(seg(lt, .3, .6));
    const gr = g.createRadialGradient(cx, cy, 50, cx, cy, 700); gr.addColorStop(0, 'rgba(116,56,242,.55)'); gr.addColorStop(1, 'rgba(116,56,242,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
    decor(lt, 23, [COL.lilac, COL.deep], 18, .6 * eo(seg(lt, .3, .6)));
    const rot = lt * .18, R = 330;
    // orbit
    const op = expoIO(seg(lt, s.te, .9));
    g.save(); g.setLineDash([2, 22]); arc(cx, cy, R, 5, COL.pale, op, -Math.PI / 2 + rot); g.setLineDash([]); g.restore();
    arc(cx, cy, R + 70, 2, 'rgba(183,155,255,.35)', op, Math.PI / 2 - rot);
    // pulses from the hub
    for (let j = 0; j < 3; j++) { const p = ((lt - s.tai) * .7 + j / 3) % 1; if (lt > s.tai) { g.save(); g.globalAlpha = (1 - p) * .5; arc(cx, cy, 120 + p * 260, 3, COL.pale); g.restore(); } }
    const nodes = [['graduation-cap', COL.violet], ['landmark', COL.amber], ['briefcase', COL.green]];
    const pos = nodes.map((n, i) => { const a = -Math.PI / 2 + i * TAU / 3 + rot; return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, a }; });
    // connectors + packets
    pos.forEach((p, i) => {
      const lp = expoIO(seg(lt, s.tn[i] - .1, .4));
      line(cx, cy, p.x, p.y, 'rgba(220,206,255,.55)', 6, lp);
      if (lt > s.tn[i] + .4) for (let j = 0; j < 2; j++) {
        const f = ((lt - s.tn[i]) * .8 + j * .5) % 1, ff = (i + j) % 2 ? f : 1 - f;
        circle(lerp(cx, p.x, ff), lerp(cy, p.y, ff), 9, COL.white);
      }
    });
    if (lt > s.tn[2] + .5) for (let i = 0; i < 3; i++) { // packets along the ring
      const a = -Math.PI / 2 + rot + i * TAU / 3 + ((lt - s.tn[2]) * 1.2 % 1) * TAU / 3;
      circle(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 8, COL.amber);
    }
    // nodes with mini user satellites
    pos.forEach((p, i) => {
      const sp = back(seg(lt, s.tn[i], .5), 2.2);
      burstLines(p.x, p.y, seg(lt, s.tn[i] + .05, .6), 100, 170, 10, nodes[i][1], 8);
      tf(p.x, p.y, sp, 0, () => {
        for (let k = 0; k < 4; k++) { const a = lt * 1.4 + k * TAU / 4 + i; tf(Math.cos(a) * 130, Math.sin(a) * 130, eo(seg(lt, s.tn[i] + .3 + k * .07, .3)), 0, () => bust(0, 0, 24, i + k, '#fff')); }
        shadow(40, 14, 'rgba(0,0,0,.35)'); circle(0, 0, 92, nodes[i][1]); noShadow(); arc(0, 0, 92, 6, 'rgba(255,255,255,.35)');
        icon(nodes[i][0], 0, 0, 96, '#fff', 2);
      });
    });
    // hub
    const hp = 1 + .05 * Math.sin(lt * 4) * eo(seg(lt, .8, .5));
    tf(cx, cy, hp, 0, () => { shadow(50, 0, 'rgba(155,107,255,.8)'); circle(0, 0, 112, COL.white); noShadow(); mark(0, 0, 120); });
    const ai = seg(lt, s.tai, .7); if (ai > 0 && ai < 1) { sparkle(cx + 110, cy - 110, 38 * Math.sin(ai * Math.PI), COL.amber, ai * 3); sparkle(cx - 125, cy - 70, 24 * Math.sin(ai * Math.PI), COL.pale, -ai * 3); }
  }
};

/* 4 — AI mentor: reads the profile, maps skill gaps, draws a personal roadmap (camera travels). */
SC.mentor = {
  init(sc) {
    const s = { sc, tm: wt(sc, 'mentor'), tp: wt(sc, 'profile'), tg: wt(sc, 'gaps'), tr: wt(sc, 'roadmap'), ty: wt(sc, 'truly'), len: sc.end - sc.start };
    cue(sc, .2, 'pop', .8); [0, 1, 2, 3].forEach(i => cue(sc, .45 + i * .12, 'pop', .45)); cue(sc, s.tp - .15, 'whoosh', .6); cue(sc, s.tp + .3, 'scan', .7);
    cue(sc, s.tg, 'pop', .7); cue(sc, s.tg + .55, 'blip', .9); cue(sc, s.tg + .75, 'blip', .9);
    cue(sc, s.tr - .1, 'whoosh', .9); [0, 1, 2, 3].forEach(i => cue(sc, s.tr + .35 + i * .22, 'pop', .6));
    cue(sc, s.ty, 'success', 1);
    return s;
  },
  draw(lt, s) {
    bg(COL.lav); decor(lt, 41, [COL.contour, COL.pale], 16, .7);
    const pan = expoIO(seg(lt, s.tr - .25, 1.0));
    g.save(); cam(lerp(960, 2520, pan), 540, lerp(1, .95, pan) + .03 * Math.sin(pan * Math.PI));
    // AI mentor orb
    const op = back(seg(lt, .15, .5), 2), om = expoIO(seg(lt, s.tp - .2, .6));
    const ox = lerp(960, 330, om), oy = lerp(540, 250, om);
    if (op > 0) {
      for (let j = 0; j < 2; j++) { const p = (lt * .9 + j * .5) % 1; g.save(); g.globalAlpha = (1 - p) * .5 * op; arc(ox, oy, 80 + p * 90, 4, COL.violet); g.restore(); }
      tf(ox, oy, op * lerp(1.35, .8, om), 0, () => {
        shadow(40, 10, 'rgba(116,56,242,.5)'); circle(0, 0, 90, COL.violet); noShadow(); icon('sparkles', 0, -6, 88, '#fff', 2);
        for (let b = 0; b < 5; b++) rrect(-36 + b * 16, 48 - Math.abs(Math.sin(lt * 9 + b)) * 10, 8, 6 + Math.abs(Math.sin(lt * 9 + b)) * 12, 4, 'rgba(255,255,255,.85)');
      });
      [['brain', COL.green], ['message-circle', COL.amber], ['target', COL.coral], ['chart-line', COL.blue]].forEach(([n, c], i) => {
        const a = lt * 1.6 + i * TAU / 4, sp = back(seg(lt, .4 + i * .12, .4), 2.4) * (1 - om);
        burstLines(ox + Math.cos(a) * 190, oy + Math.sin(a) * 190 * .8, seg(lt, .45 + i * .12, .5), 50, 90, 8, c, 6);
        tf(ox + Math.cos(a) * 190, oy + Math.sin(a) * 190 * .8, sp, 0, () => badge(0, 0, 46, c, n));
      });
    }
    // profile card
    const cp = back(seg(lt, s.tp - .15, .55), 1.5), CX = 600, CY = 560;
    if (cp > 0) tf(CX, CY + (1 - cp) * 300, cp, (1 - eo(seg(lt, s.tp - .15, .6))) * .25, () => {
      shadow(50, 22); rrect(-230, -290, 460, 580, 36, COL.white); noShadow();
      bust(0, -170, 76, 0);
      [[300, COL.ink], [220, COL.contour], [340, COL.contour]].forEach(([w, c], i) => rrect(-w / 2, -60 + i * 40, w * eo(seg(lt, s.tp + .1 + i * .08, .4)), 18, 9, c));
      [['code-xml', COL.green], ['mic', COL.amber], ['file-text', COL.violet]].forEach(([n, c], i) => {
        tf(-120 + i * 120, 150, back(seg(lt, s.tp + .35 + i * .1, .4), 2.4), 0, () => { circle(0, 0, 44, c); icon(n, 0, 0, 46); });
      });
      const sp = seg(lt, s.tp + .3, .9);                          // scan beam
      if (sp > 0 && sp < 1) {
        const y = -290 + sp * 580; g.save(); g.beginPath(); g.roundRect(-230, -290, 460, 580, 36); g.clip();
        const gr = g.createLinearGradient(0, y - 90, 0, y); gr.addColorStop(0, 'rgba(116,56,242,0)'); gr.addColorStop(1, 'rgba(116,56,242,.35)');
        g.fillStyle = gr; g.fillRect(-230, y - 90, 460, 90); g.fillStyle = COL.violet; g.fillRect(-230, y - 3, 460, 6); g.restore();
      }
    });
    if (om > .9 && lt < s.tp + 1.3) { const p = seg(lt, s.tp + .2, .9); g.save(); g.globalAlpha = Math.sin(p * Math.PI) * .6; g.setLineDash([10, 12]); g.lineDashOffset = -lt * 80; line(ox + 60, oy + 50, CX - 120, CY - 210, COL.violet, 5); g.restore(); }
    // skill radar
    const RX = 1360, RY = 540, RR = 240, vals = [.9, .72, .32, .82, .4, .76], ic = ['code-xml', 'brain', 'mic', 'chart-column', 'users', 'file-text'];
    const gp = expoIO(seg(lt, s.tg - .3, .7));
    if (gp > 0) {
      const pt = (i, r) => { const a = -Math.PI / 2 + i * TAU / 6; return [RX + Math.cos(a) * r, RY + Math.sin(a) * r]; };
      tf(RX, RY, back(gp, 1.4), (1 - gp) * -.8, () => {
        g.translate(-RX, -RY);
        shadow(40, 16); circle(RX, RY, RR + 70, COL.white); noShadow();
        for (const f of [1, .66, .33]) { g.beginPath(); for (let i = 0; i < 6; i++) { const [x, y] = pt(i, RR * f); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.strokeStyle = COL.contour; g.lineWidth = 3; g.stroke(); }
        const vp = elastic(seg(lt, s.tg - .05, 1.1));
        g.beginPath(); for (let i = 0; i < 6; i++) { const [x, y] = pt(i, RR * vals[i] * vp); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath();
        g.fillStyle = 'rgba(116,56,242,.28)'; g.fill(); g.strokeStyle = COL.violet; g.lineWidth = 6; g.lineJoin = 'round'; g.stroke();
        for (let i = 0; i < 6; i++) {
          const [x, y] = pt(i, RR * vals[i] * vp), gap = vals[i] < .5, gb = back(seg(lt, s.tg + .55 + (i === 4 ? .2 : 0), .4), 3);
          circle(x, y, 12, gap && gb > 0 ? COL.amber : COL.violet);
          if (gap && gb > 0) { for (let j = 0; j < 2; j++) { const p = (lt * 1.3 + j * .5) % 1; g.save(); g.globalAlpha = 1 - p; arc(x, y, 14 + p * 40, 4, COL.amber); g.restore(); } tf(x + 34, y - 34, gb, 0, () => { circle(0, 0, 20, COL.amber); text('!', 0, 2, 26, '#fff', 800); }); }
          const [ix, iy] = pt(i, RR + 40); tf(ix, iy, back(seg(lt, s.tg - .1 + i * .05, .4), 2), 0, () => { circle(0, 0, 30, COL.lav); icon(ic[i], 0, 0, 34, COL.deep); });
        }
      });
    }
    // roadmap
    const road = new Path2D('M1840 860 C2050 870 2080 640 2300 650 S2520 520 2480 420 S2700 230 3040 250');
    const rp = expoIO(seg(lt, s.tr + .1, 1.3));
    if (rp > 0) {
      g.save(); g.lineCap = 'round'; g.setLineDash([2400 * rp, 4000]);
      g.strokeStyle = COL.night2; g.lineWidth = 70; g.stroke(road);
      g.setLineDash([]); g.restore();
      g.save(); g.setLineDash([26, 26]); g.globalAlpha = rp > .05 ? 1 : 0; g.lineWidth = 6; g.strokeStyle = '#fff';
      g.beginPath(); g.rect(0, 0, 1840 + 1300 * rp, H); g.clip(); g.stroke(road); g.restore();
      [[2000, 820, 'file-text'], [2300, 650, 'code-xml'], [2490, 440, 'mic'], [2760, 270, 'briefcase']].forEach(([x, y, n], i) => {
        const pp = back(seg(lt, s.tr + .35 + i * .22, .45), 2.4);
        tf(x, y - 70, pp, 0, () => { g.beginPath(); g.moveTo(0, 70); g.lineTo(-26, 20); g.lineTo(26, 20); g.closePath(); g.fillStyle = COL.violet; g.fill(); circle(0, 0, 48, COL.violet); icon(n, 0, 0, 48); });
      });
      const fp = seg(lt, s.ty - .2, .5), fx = 3040, fy = 250;
      if (fp > 0) {
        tf(fx, fy - (1 - eo(fp)) * 400, 1, 0, () => { line(0, 0, 0, -200, COL.ink, 10); g.beginPath(); g.moveTo(5, -200); g.quadraticCurveTo(70, -185 + Math.sin(lt * 8) * 10, 130, -160); g.lineTo(5, -120); g.closePath(); g.fillStyle = COL.amber; g.fill(); });
        shock(fx, fy, seg(lt, s.ty + .1, .7), 260, COL.amber, 14);
        tf(fx - 170, fy - 60, back(seg(lt, s.ty + .15, .5), 2), 0, () => { shadow(30, 10); bust(0, 0, 70, 0, COL.white); noShadow(); });
      }
      confetti(fx, fy - 100, lt - s.ty - .1, 77, 70);
    }
    g.restore();
  }
};

/* 5 — Resume through the ATS scanner; score climbs. */
SC.ats = {
  init(sc) { const s = { sc, tr: wt(sc, 'resume'), ta: wt(sc, 'ATS'), len: sc.end - sc.start }; cue(sc, .1, 'whoosh', .8); cue(sc, s.ta - .2, 'scan', .9); [0, 1, 2].forEach(i => cue(sc, s.ta + .25 + i * .22, 'tick', .8)); cue(sc, s.ta + 1.25, 'success', .9); return s; },
  draw(lt, s) {
    bg(COL.violet);
    g.save(); const gr = g.createRadialGradient(1400, 540, 50, 1400, 540, 800); gr.addColorStop(0, 'rgba(155,107,255,.6)'); gr.addColorStop(1, 'rgba(94,39,216,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
    decor(lt, 52, [COL.lilac, COL.pale], 16, .5);
    const dp = back(seg(lt, .05, .6), 1.4), slide = expoIO(seg(lt, s.ta - .3, 1.0));
    const DX = lerp(560, 760, slide), DY = 560;
    // scanner gate
    const gp = expoIO(seg(lt, s.ta - .45, .45)), GX = 760;
    if (gp > 0) {
      tf(GX, 540, 1, 0, () => {
        rrect(-300 * gp, -360, 600 * gp, 26, 13, COL.night); rrect(-300 * gp, 334, 600 * gp, 26, 13, COL.night);
        tf(0, -400, back(seg(lt, s.ta - .2, .4), 2), 0, () => { circle(0, 0, 50, COL.night); icon('funnel', 0, 2, 52, '#fff'); });
      });
    }
    // resume
    tf(DX, DY + (1 - dp) * 700, 1, lerp(-.22, -.05, eo(seg(lt, 0, .8))) * (1 - slide) , () => {
      shadow(50, 24, 'rgba(20,0,60,.35)'); rrect(-200, -270, 400, 540, 28, COL.white); noShadow();
      bust(-110, -170, 56, 2); rrect(-30, -200, 190, 22, 11, COL.ink); rrect(-30, -160, 130, 16, 8, COL.contour);
      for (let i = 0; i < 3; i++) {
        const y = -40 + i * 90; rrect(-150, y - 12, 230, 18, 9, COL.contour); rrect(-150, y + 20, 160, 14, 7, COL.lav);
        tf(130, y + 6, back(seg(lt, s.ta + .25 + i * .22, .35), 3), 0, () => { circle(0, 0, 26, COL.green); icon('check', 0, 0, 34, '#fff', 3); });
      }
    });
    // laser
    if (gp > 0) {
      const lp = seg(lt, s.ta - .2, 1.1);
      if (lp > 0 && lp < 1) {
        const y = 540 - 330 + Math.abs(Math.sin(lp * Math.PI * 1.5)) * 660;
        g.save(); shadow(30, 0, 'rgba(255,255,255,.9)'); rrect(GX - 290, y - 4, 580, 8, 4, '#fff'); g.restore();
        g.save(); g.globalAlpha = .18; g.fillStyle = '#fff'; g.fillRect(GX - 290, 210, 580, y - 210); g.restore();
      }
    }
    // score ring
    const sp = back(seg(lt, s.ta - .1, .5), 1.8), v = eio(seg(lt, s.ta + .1, 1.15)), SX = 1420, SY = 540;
    if (sp > 0) tf(SX, SY, sp, 0, () => {
      circle(0, 0, 200, COL.night); arc(0, 0, 150, 32, 'rgba(255,255,255,.14)'); arc(0, 0, 150, 32, v > .97 ? COL.green : '#fff', v * .92);
      text(String(Math.round(v * 92)), 0, -6, 120, '#fff', 800); text('ATS', 0, 78, 34, COL.pale, 700);
    });
    shock(SX, SY, seg(lt, s.ta + 1.25, .8), 300, COL.green, 16);
    burstLines(SX, SY, seg(lt, s.ta + 1.25, .6), 220, 330, 14, '#fff', 9);
  }
};

/* 6 — AI interview rounds: HR → technical → coding. */
SC.interview = {
  init(sc) {
    const s = { sc, th: wt(sc, 'HR'), tt: wt(sc, 'technical'), tc: wt(sc, 'coding'), len: sc.end - sc.start };
    cue(sc, .1, 'pop', .9); [s.th, s.tt, s.tc].forEach(t => cue(sc, t, 'click', 1));
    for (let i = 0; i < 10; i++) cue(sc, s.tc + .25 + i * .1, 'type', .35);
    return s;
  },
  draw(lt, s) {
    bg(COL.canvas); decor(lt, 63, [COL.contour, COL.pale], 18, .8);
    const wp = back(seg(lt, .05, .6), 1.5), X = 960, Y = 500, w = 1180, h = 660;
    const mode = lt < s.th ? -1 : lt < s.tt ? 0 : lt < s.tc ? 1 : 2;
    tf(X, Y, lerp(.5, 1, wp) * (1 + .015 * Math.sin(lt * 1.5)), (1 - eo(seg(lt, 0, .7))) * .1, () => {
      g.globalAlpha *= clamp(wp * 2);
      shadow(60, 26); rrect(-w / 2, -h / 2, w, h, 36, COL.white); noShadow();
      g.save(); g.beginPath(); g.roundRect(-w / 2, -h / 2, w, 70, [36, 36, 0, 0]); g.fillStyle = COL.ink; g.fill(); g.restore();
      [COL.coral, COL.amber, COL.green].forEach((c, i) => circle(-w / 2 + 44 + i * 34, -h / 2 + 35, 10, c));
      circle(w / 2 - 50, -h / 2 + 35, 10, Math.sin(lt * 6) > 0 ? COL.coral : '#5a2a30');
      // candidate tile
      rrect(-w / 2 + 30, -h / 2 + 100, 520, 520, 26, COL.lav);
      g.save(); g.beginPath(); g.roundRect(-w / 2 + 30, -h / 2 + 100, 520, 520, 26); g.clip(); person(-w / 2 + 290, 190, 1.7, PEOPLE[1]); g.restore();
      // AI tile
      const ax = w / 2 - 300, ay = 30; rrect(ax - 270, -h / 2 + 100, 540, 520, 26, COL.night);
      if (mode < 0) {
        tf(ax, ay - 30, back(seg(lt, .4, .5), 2), 0, () => { for (let j = 0; j < 2; j++) { const p = (lt + j * .5) % 1; g.save(); g.globalAlpha = 1 - p; arc(0, 0, 80 + p * 70, 4, COL.lilac); g.restore(); } circle(0, 0, 80, COL.violet); icon('bot', 0, -2, 84); });
        for (let b = 0; b < 22; b++) { const hh = 10 + Math.abs(Math.sin(lt * 8 + b * .7)) * 50 * (.5 + .5 * Math.sin(lt * 3 + b)); rrect(ax - 220 + b * 20, ay + 130 - hh / 2, 10, hh, 5, COL.pale); }
      } else if (mode === 0) {
        const p0 = seg(lt, s.th, .4), p1 = seg(lt, s.th + .35, .4);
        tf(ax - 30, ay - 90 + (1 - eo(p0)) * 60, 1, 0, () => { g.globalAlpha *= p0; rrect(-200, -50, 400, 100, 30, COL.violet); rrect(-160, -14, 260, 14, 7, 'rgba(255,255,255,.8)'); rrect(-160, 12, 180, 12, 6, 'rgba(255,255,255,.5)'); });
        tf(ax + 30, ay + 60 + (1 - eo(p1)) * 60, 1, 0, () => { g.globalAlpha *= p1; rrect(-200, -50, 400, 100, 30, COL.white); rrect(-160, -14, 240, 14, 7, COL.contour); rrect(-160, 12, 280, 12, 6, COL.lav); });
      } else if (mode === 1) {
        const nodes = [[-150, -90], [130, -110], [0, 60], [170, 140], [-170, 130]];
        [[0, 2], [1, 2], [2, 3], [2, 4], [0, 1]].forEach(([a, b], i) => line(ax + nodes[a][0], ay + nodes[a][1], ax + nodes[b][0], ay + nodes[b][1], COL.pale, 5, expoIO(seg(lt, s.tt + .1 + i * .07, .35))));
        nodes.forEach(([x, y], i) => tf(ax + x, ay + y, back(seg(lt, s.tt + i * .07, .35), 2.4), 0, () => rrect(-46, -30, 92, 60, 14, i === 2 ? COL.violet : COL.white)));
      } else {
        const toks = [[1, 90, COL.pale], [1, 140, COL.amber], [2, 70, COL.green], [2, 160, '#fff'], [3, 120, COL.pale], [3, 60, COL.coral], [4, 180, COL.green], [5, 90, COL.amber]];
        icon('braces', ax - 200, ay - 180, 54, COL.lilac);
        let x0 = {}, n = Math.floor(seg(lt, s.tc + .2, 1.1) * toks.length + .999);
        toks.slice(0, n).forEach(([r, wd, c], i) => { const x = x0[r] || 0; x0[r] = x + wd + 16; rrect(ax - 220 + (r > 2 ? 40 : 0) + x, ay - 130 + r * 46, wd * eo(seg(lt, s.tc + .2 + i * .14, .12)), 22, 11, c); });
        if (Math.sin(lt * 10) > 0) rrect(ax + 120, ay + 120, 6, 32, 3, '#fff');
      }
    });
    // round chips
    [['HR', s.th], ['Tech', s.tt], ['Code', s.tc]].forEach(([l, t], i) => {
      const p = back(seg(lt, t - .05, .4), 2.4), on = (i === mode);
      tf(X - 230 + i * 230, 920, p * (on ? 1.08 : 1), 0, () => { shadow(20, 8); rrect(-95, -40, 190, 80, 40, on ? COL.violet : COL.white); noShadow(); text(l, 0, 3, 34, on ? '#fff' : COL.deep, 700); });
    });
  }
};

/* 7 — Colleges: AI-proctored assessments get verified. */
SC.proctor = {
  init(sc) {
    const s = { sc, tc: wt(sc, 'Colleges'), ta: wt(sc, 'assessments'), ts: wt(sc, 'scrutiny'), len: sc.end - sc.start };
    cue(sc, s.tc, 'pop', 1); for (let i = 0; i < 9; i++) cue(sc, s.ta - .3 + i * .05, 'pop', .25);
    for (let i = 0; i < 9; i++) cue(sc, s.ta + .5 + i * .14, 'tick', .45); cue(sc, s.ts - .05, 'impact', 1);
    return s;
  },
  draw(lt, s) {
    bg(COL.night);
    g.save(); const gr = g.createRadialGradient(1100, 520, 50, 1100, 520, 900); gr.addColorStop(0, 'rgba(116,56,242,.5)'); gr.addColorStop(1, 'rgba(116,56,242,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
    decor(lt, 71, [COL.lilac, COL.deep], 18, .6);
    const bp = back(seg(lt, s.tc - .05, .5), 2.2);
    // students streaming from the college to the grid
    if (lt > s.tc + .2) for (let i = 0; i < 9; i++) {
      const f = ((lt - s.tc) * .6 + i / 9) % 1; const x = lerp(400, 740, f), y = 540 + Math.sin(f * Math.PI * 2 + i) * 60 * (1 - f);
      g.save(); g.globalAlpha = Math.sin(f * Math.PI); bust(x, y, 18, i, '#fff'); g.restore();
    }
    tf(300, 540, bp, 0, () => { shadow(40, 14, 'rgba(0,0,0,.4)'); circle(0, 0, 120, COL.amber); noShadow(); icon('landmark', 0, -4, 120, '#fff', 2); });
    // test tiles
    const GX = 1180, GY = 540, tiles = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) tiles.push([GX + (c - 1) * 250, GY + (r - 1) * 190, r + c, r * 3 + c]);
    const dim = eo(seg(lt, s.ts - .05, .4));
    // scanning eye
    const ex = GX + Math.sin(lt * 1.7) * 260, ey = GY + Math.cos(lt * 2.3) * 160 - 10, ep = back(seg(lt, s.ta + .2, .5), 2) * (1 - dim);
    tiles.forEach(([x, y, d, i]) => {
      const p = expo(seg(lt, s.ta - .3 + d * .08, .45)), ok = back(seg(lt, s.ta + .5 + i * .14, .35), 3);
      if (p <= 0) return;
      g.save(); g.translate(x, y); g.scale(1, p); g.globalAlpha = 1 - dim * .6;
      shadow(30, 12, 'rgba(0,0,0,.35)'); rrect(-105, -75, 210, 150, 20, COL.white); noShadow();
      rrect(-80, -48, 120, 14, 7, COL.ink);
      for (let k = 0; k < 3; k++) { circle(-70, -10 + k * 28, 8, k === i % 3 ? COL.violet : COL.contour); rrect(-52, -16 + k * 28, 90 - k * 14, 12, 6, COL.lav); }
      if (ok > 0) tf(70, 40, ok, 0, () => { circle(0, 0, 26, COL.green); icon('check', 0, 0, 32, '#fff', 3); });
      g.restore();
    });
    if (ep > 0) {
      g.save(); g.globalAlpha = .22 * ep; g.beginPath(); g.moveTo(ex, ey - 300); g.lineTo(ex - 150, ey + 40); g.lineTo(ex + 150, ey + 40); g.closePath(); g.fillStyle = COL.pale; g.fill(); g.restore();
      tf(ex, ey - 300, ep, 0, () => { shadow(40, 0, 'rgba(155,107,255,.9)'); circle(0, 0, 66, COL.violet); noShadow(); icon('scan-eye', 0, 0, 72); });
    }
    // verdict shield
    const sp = back(seg(lt, s.ts - .05, .5), 2.6);
    if (sp > 0) {
      shock(GX, GY, seg(lt, s.ts, .8), 520, COL.green, 20);
      burstLines(GX, GY, seg(lt, s.ts, .6), 180, 300, 14, COL.green, 10);
      tf(GX, GY, sp, 0, () => { shadow(60, 0, 'rgba(34,176,125,.7)'); circle(0, 0, 150, COL.green); noShadow(); icon('shield-check', 0, 0, 170, '#fff', 2); });
      [[-260, -170], [270, -150], [240, 190], [-250, 180]].forEach(([dx, dy], i) => { const p = seg(lt, s.ts + .1 + i * .07, .7); if (p > 0 && p < 1) sparkle(GX + dx, GY + dy, 34 * Math.sin(p * Math.PI), i % 2 ? COL.amber : '#fff', p * 2); });
    }
  }
};

/* 8 — Employers: a stream of candidates → funnel → pre-assessed shortlist with evidence. */
SC.hire = {
  init(sc) {
    const s = { sc, te: wt(sc, 'employers'), tp: wt(sc, 'pre-assessed'), tv: wt(sc, 'evidence'), ti: wt(sc, 'interview'), len: sc.end - sc.start };
    cue(sc, s.te, 'pop', .9); [0, 1, 2].forEach(i => cue(sc, s.tp + i * .25, 'ding', .7)); cue(sc, s.tv, 'whoosh', .6); cue(sc, s.ti, 'impact', .8);
    return s;
  },
  draw(lt, s) {
    bg(COL.canvas); decor(lt, 83, [COL.contour, COL.pale], 18, .8);
    const FX = 820, FY = 540;
    // conveyor stream of candidates
    for (let i = 0; i < 12; i++) {
      const f = ((lt * .45) + i / 12) % 1; if (lt * .45 + i / 12 < 1 && lt < .2) continue;
      const x = lerp(-120, FX - 40, eio(f)), y = FY - 30 + Math.sin(i * 1.7) * 150 * (1 - eio(f)), sc = lerp(1, .35, ei(f));
      tf(x, y, sc, Math.sin(lt * 2 + i) * .1, () => { shadow(18, 6); rrect(-85, -40, 170, 80, 20, COL.white); noShadow(); bust(-45, 0, 26, i, COL.lav); rrect(-8, -12, 70, 12, 6, COL.contour); rrect(-8, 8, 46, 10, 5, COL.lav); }, Math.min(1, (1 - f) * 4));
    }
    // funnel
    tf(FX, FY, back(seg(lt, .05, .5), 1.6), 0, () => {
      g.beginPath(); g.moveTo(-110, -230); g.lineTo(110, -230); g.lineTo(40, 40); g.lineTo(40, 200); g.lineTo(-40, 200); g.lineTo(-40, 40); g.closePath();
      shadow(40, 16); g.fillStyle = COL.violet; g.fill(); noShadow();
      g.save(); g.globalAlpha = .25; g.beginPath(); g.ellipse(0, -230, 110, 26, 0, 0, TAU); g.fillStyle = '#fff'; g.fill(); g.restore();
      icon('funnel', 0, -100, 80, '#fff');
    });
    // shortlist
    const scores = [.94, .9, .87];
    scores.forEach((v, i) => {
      const t0 = s.tp - .2 + i * .25, p = expoIO(seg(lt, t0, .55)), top = i === 0, hl = top ? eo(seg(lt, s.tv + .4, .4)) : 0;
      if (p <= 0) return;
      const x = lerp(FX, 1380, p), y = lerp(FY + 200, 330 + i * 200, p);
      tf(x, y, lerp(.3, 1, p) * (1 + .06 * hl), 0, () => {
        shadow(40, 16); rrect(-250, -80, 500, 160, 32, COL.white, hl > 0 ? COL.violet : null, 6 * hl); noShadow();
        bust(-170, 0, 52, i + 1); rrect(-95, -36, 200, 20, 10, COL.ink);
        rrect(-95, 10, 220, 16, 8, COL.lav); rrect(-95, 10, 220 * v * eo(seg(lt, t0 + .4, .7)), 16, 8, COL.violet);
        tf(195, 0, back(seg(lt, t0 + .55, .4), 3), 0, () => { circle(0, 0, 36, COL.green); icon('badge-check', 0, 0, 44); });
      });
    });
    // evidence flying onto the top candidate
    ['chart-column', 'file-text', 'mic'].forEach((n, i) => {
      const p = expoIO(seg(lt, s.tv + i * .12, .55)); if (p <= 0) return;
      const x = lerp(1880, 1240 + i * 95, p), y = lerp(120 + i * 60, 205, p) - Math.sin(p * Math.PI) * 120;
      tf(x, y, lerp(1.4, .8, p), 0, () => { circle(0, 0, 34, COL.amber); icon(n, 0, 0, 38); });
    });
    // employer
    tf(1660, 130, back(seg(lt, s.te, .5), 2.2), 0, () => { shadow(30, 10); circle(0, 0, 70, COL.green); noShadow(); icon('briefcase-business', 0, 0, 72); });
    const hp = back(seg(lt, s.ti, .5), 2.6);
    if (hp > 0) { shock(1790, 560, seg(lt, s.ti, .8), 300, COL.violet, 14); tf(1790, 560, hp, 0, () => { shadow(40, 12); circle(0, 0, 80, COL.violet); noShadow(); icon('handshake', 0, 0, 86); }); }
  }
};

/* 9 — Everything converges: readiness, assessment, training, hiring — connected. */
SC.converge = {
  init(sc) {
    const s = { sc, tw: [wt(sc, 'Readiness'), wt(sc, 'assessment'), wt(sc, 'training'), wt(sc, 'hiring')], tc: wt(sc, 'connected'), len: sc.end - sc.start };
    cue(sc, .05, 'pop', 1); s.tw.forEach(t => cue(sc, t, 'pop', .9)); cue(sc, s.tc - .1, 'riser', 1); cue(sc, s.tc + .3, 'impact', 1);
    return s;
  },
  draw(lt, s) {
    bg(COL.deep);
    g.save(); const gr = g.createRadialGradient(960, 540, 60, 960, 540, 1000); gr.addColorStop(0, '#8B55FF'); gr.addColorStop(1, 'rgba(94,39,216,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
    decor(lt, 97, [COL.pale, COL.lilac], 18, .6);
    const cx = 960, cy = 540, R = 340, rot = lt * .12 + expoIO(seg(lt, s.tc, 1)) * .8, out = expoIn(seg(lt, s.len - .45, .45));
    const zoom = 1 + .06 * eo(seg(lt, s.tc, 1));
    g.save(); g.translate(cx, cy); g.scale(zoom, zoom); g.translate(-cx, -cy);
    const nodes = ['target', 'clipboard-check', 'graduation-cap', 'briefcase'];
    const pos = nodes.map((n, i) => { const a = -Math.PI * .75 + i * TAU / 4 + rot, rr = R * (1 - out); return { x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, a }; });
    const cp = expoIO(seg(lt, s.tc - .1, .7));
    if (cp > 0) {
      arc(cx, cy, R * (1 - out), 10, 'rgba(255,255,255,.9)', cp, -Math.PI * .75 + rot);
      pos.forEach(p => line(cx, cy, p.x, p.y, 'rgba(255,255,255,.45)', 5, cp));
      if (lt > s.tc + .4) for (let i = 0; i < 6; i++) { const a = -Math.PI * .75 + rot + ((lt - s.tc) * .9 + i / 6) * TAU; circle(cx + Math.cos(a) * R * (1 - out), cy + Math.sin(a) * R * (1 - out), 9, COL.amber); }
    }
    pos.forEach((p, i) => {
      const sp = back(seg(lt, s.tw[i] - .05, .45), 2.4) * (1 - out);
      burstLines(p.x, p.y, seg(lt, s.tw[i], .6), 90, 160, 10, '#fff', 7);
      tf(p.x, p.y, sp, 0, () => { shadow(40, 14, 'rgba(20,0,60,.35)'); circle(0, 0, 86, COL.white); noShadow(); icon(nodes[i], 0, 0, 84, COL.violet, 2.2); });
    });
    for (let j = 0; j < 3; j++) shock(cx, cy, seg(lt, s.tc + .3 + j * .12, 1), 900, '#fff', 18);
    tf(cx, cy, back(seg(lt, 0, .5), 2) * (1 + .04 * Math.sin(lt * 4)) * (1 + out * .3), 0, () => { shadow(60, 0, 'rgba(255,255,255,.6)'); circle(0, 0, 124, COL.white); noShadow(); mark(0, 0, 132); });
    g.restore();
    circle(cx, cy, expoIn(seg(lt, s.len - .3, .3)) * 1250, COL.white);
  }
};

/* 10 — Call to action. */
SC.cta = {
  init(sc) {
    const s = { sc, tb: wt(sc, 'Book'), len: sc.end - sc.start };
    s.tclick = sc.vo[0].start - sc.start + sc.vo[0].dur + .1;
    cue(sc, .15, 'pop', .9); cue(sc, .75, 'shine', .7); cue(sc, s.tb, 'pop', .8); cue(sc, s.tclick, 'click', 1.2); cue(sc, s.tclick + .05, 'success', .9);
    return s;
  },
  draw(lt, s) {
    bg(COL.white); decor(lt, 101, [COL.contour, COL.pale, COL.lav], 22, .9);
    const fade = 1 - seg(lt, s.len - .6, .6);
    g.save(); g.globalAlpha = fade;
    fullLogo(960, 400, 150, seg(lt, .1, .6), seg(lt, .5, .6));
    const bp = back(seg(lt, s.tb - .1, .5), 2.2), press = 1 - .08 * Math.sin(seg(lt, s.tclick, .25) * Math.PI);
    for (let j = 0; j < 2; j++) { const p = ((lt - s.tclick) * .7 + j * .5) % 1; if (lt > s.tclick) { g.save(); g.globalAlpha *= (1 - p) * .5; rrect(960 - 240 - p * 40, 640 - 60 - p * 40, 480 + p * 80, 120 + p * 80, 60 + p * 40, null, COL.violet, 4); g.restore(); } }
    tf(960, 640, bp * press, 0, () => { shadow(40, 18, 'rgba(116,56,242,.45)'); rrect(-240, -60, 480, 120, 60, COL.violet); noShadow(); text('Book a Demo', 0, 4, 46, '#fff', 700); });
    const up = eo(seg(lt, s.tb + .25, .5)); g.save(); g.globalAlpha *= up; text('xplorepro.ai', 960, 790 + (1 - up) * 30, 44, COL.ink, 600); g.restore();
    // cursor
    const cp = eio(seg(lt, s.tb + .2, s.tclick - s.tb - .2));
    if (lt > s.tb + .2) tf(lerp(1500, 1010, cp), lerp(1000, 668, cp), 1 - .1 * Math.sin(seg(lt, s.tclick, .25) * Math.PI), -.15, () => { icon('mouse-pointer-2', 20, 20, 70, COL.ink, 1.6); }, 1 - seg(lt, s.tclick + .8, .4));
    shock(1000, 655, seg(lt, s.tclick, .6), 160, COL.violet, 10);
    burstLines(960, 640, seg(lt, s.tclick, .6), 280, 360, 12, COL.amber, 9);
    g.restore();
  }
};

/* ---------- transitions between scenes ---------- */
const TRANS = { mentor: 'stripes', ats: 'circle', interview: 'stripes', proctor: 'circle', hire: 'stripes', converge: 'circle', cta: 'none', eco: 'none', reveal: 'none' };
const scenes = TL.scenes.map(sc => ({ ...sc, def: SC[sc.id] }));
scenes.forEach(sc => { sc.st = sc.def.init(sc); });
scenes.slice(1).forEach(sc => { if (TRANS[sc.id] !== 'none') cue(sc, -.32, 'whoosh', 1); });
const BGC = { chaos: COL.lav, reveal: COL.lav, eco: COL.white, mentor: COL.lav, ats: COL.violet, interview: COL.canvas, proctor: COL.night, hire: COL.canvas, converge: COL.deep, cta: COL.white };
function transition(t) {
  scenes.slice(1).forEach((sc, k) => {
    const type = TRANS[sc.id], b = sc.start; if (type === 'none') return;
    const p = (t - (b - .38)) / .76; if (p <= 0 || p >= 1) return;
    const cols = [COL.violet, COL.pale, BGC[sc.id]];
    if (type === 'circle') {
      const fx = k % 2 ? 1500 : 420, fy = k % 2 ? 300 : 800, R = 2300;
      if (p < .5) cols.forEach((c, i) => circle(fx, fy, eio(clamp((p * 2 - i * .15) / .7)) * R, c));
      else { g.save(); g.beginPath(); g.rect(0, 0, W, H); g.arc(W - fx, H - fy, expo((p - .5) * 2) * R, 0, TAU, true); g.fillStyle = BGC[sc.id]; g.fill(); g.restore(); }
    } else {
      cols.forEach((c, i) => {
        const q = clamp(p * 1.25 - i * .1), x = lerp(-W * 1.6, W * 1.6, eio(q));
        g.save(); g.translate(W / 2 + x, H / 2); g.rotate(-.18); g.fillStyle = c; g.fillRect(-W * .8, -H, W * 1.6 - i * 0, H * 2); g.restore();
      });
    }
  });
}

/* ---------- main ---------- */
function render(t) {
  g.save();
  const sc = scenes.find(s => t >= s.start && t < s.end) || scenes[scenes.length - 1];
  sc.def.draw(t - sc.start, sc.st);
  g.restore();
  noShadow(); g.globalAlpha = 1; g.filter = 'none';
  transition(t);
}
window.SFX = SFX;
window.prepare = async () => {
  await Promise.all([document.fonts.load('700 40px P'), document.fonts.load('800 40px P'), document.fonts.load('600 40px P')]);
  for (let t = 0; t < DUR; t += 1 / 15) render(t);       // warm icon cache
  await Promise.all(pending);
  render(0); return true;
};
window.render = render;
