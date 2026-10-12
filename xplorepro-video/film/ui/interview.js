/* ui/interview.js: practice-interview window (generic, violet; no bot icon, no readable fake text). Pure functions of their arguments.
   interviewWindow(cx, cy, k, lt, o)  window of base size 960x640 scaled by k, centred at cx,cy. The frame is drawn at explicit size so its
       stroke stays o.lw (default 2px) at any k; contents scale with k.
       o = { tabs  [tHR, tTechnical, tCoding] local times each tab becomes active (spring underline + content morph:
                   chat bubbles -> node diagram -> code-token bars),
             talk  0..1 who speaks (0 candidate, 1 AI tile) for the waveforms,
             mini  0..1 detail -> mini layout (tab labels become pills, waveforms and tab content fold into bars, radius 28 -> 20),
             pal   candidate palette (people.js), shadow 0..1, lw, alpha }
   interviewCard(cx, cy, lt, o)       the 360x240 contract card (white, r20, 2px contour stroke, mini two-tile layout) =
       interviewWindow at k = IV.END with mini 1 (internal time frozen at IV.CARD_T, Coding pill active by default, no shadow),
       i.e. exactly the readiness scene's last frame when called as interviewCard(960, 540, lt, {pal}). o.s scales the whole card
       (stroke scales too); o.shadow adds the soft shadow; other o as above.
   ivOrb(x, y, r, lt, e)              AI "sparkle orb" (violet glow, sparkles, orbit ring; e = speaking energy 0..1).
   ivWave(x, y, n, w, gap, h, col, lt, energy, seed)  rounded vertical waveform. */
const IV = { W: 960, H: 640, END: .375, CARD_T: 0, TABS: ['HR', 'Technical', 'Coding'], TY: -232, TH: 304, TW: 444, PY: 96, PH: 200 };
const IV_CODE = [
  [0, [['violet', 64], ['navy', 96], ['pale', 120]]],
  [1, [['pale', 56], ['violet', 44], ['contour', 150]]],
  [2, [['amber', 36], ['contour', 110], ['pale', 84]]],
  [2, [['violet', 52], ['contour', 170]]],
  [1, [['pale', 40], ['navy', 70]]]
];
const IV_NODES = [[-330, 0, 'globe', 1], [-110, -52, 'server', 1], [-110, 52, 'database', 0], [110, -52, 'layers', 1], [110, 52, 'box', 0], [330, 0, 'braces', 1]];
const IV_EDGES = [[0, 1, 1], [0, 2, 0], [1, 3, 1], [2, 4, 0], [3, 5, 1], [4, 5, 0]];
function ivWave(x, y, n, w, gap, h, col, lt, energy, seed = 3) {
  const c = (n - 1) / 2, e = clamp(energy);
  g.save(); g.lineCap = 'round'; g.strokeStyle = col; g.lineWidth = w;
  for (let i = 0; i < n; i++) {
    const shape = 1 - .5 * Math.pow(Math.abs(i - c) / Math.max(1, c), 1.5), v = .5 + .5 * noise1(lt * 7 + i * 1.31, seed + i);
    const hh = Math.max(w * .25, h * shape * (.16 + .84 * e * v)), xx = x + (i - c) * gap;
    g.beginPath(); g.moveTo(xx, y - hh / 2); g.lineTo(xx, y + hh / 2); g.stroke();
  }
  g.restore();
}
function ivOrb(x, y, r, lt, e = 0, orbit = 1) {
  const pulse = 1 + .05 * clamp(e) * Math.sin(lt * 7);
  const gl = g.createRadialGradient(x, y, 0, x, y, r * 2.3);
  gl.addColorStop(0, rgba(COL.bright, .5)); gl.addColorStop(.45, rgba(COL.violet, .2)); gl.addColorStop(1, rgba(COL.violet, 0));
  g.fillStyle = gl; g.beginPath(); g.arc(x, y, r * 2.3, 0, TAU); g.fill();
  ring(x, y, r * 1.42, 1.5, 'rgba(255,255,255,.18)');
  if (orbit > .01) arc(x, y, r * 1.42, 2.5, rgba('#FFFFFF', .55 * orbit), .22, lt * 1.4);
  const cg = g.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r * pulse);
  cg.addColorStop(0, COL.pale); cg.addColorStop(.55, COL.bright); cg.addColorStop(1, COL.deep);
  g.fillStyle = cg; g.beginPath(); g.arc(x, y, r * pulse, 0, TAU); g.fill();
  sparkle(x, y, r * .46, '#FFFFFF', 0);
  sparkle(x + r * .5, y - r * .44, r * .17, 'rgba(255,255,255,.9)', 0);
  sparkle(x - r * .52, y + r * .4, r * .11, 'rgba(255,255,255,.75)', 0);
}
/* tab geometry (local units) */
function ivTabs() {
  const ws = IV.TABS.map(t => textWidth(t, 28, 600, 'I')), gap = 64, tot = ws.reduce((a, b) => a + b, 0) + gap * 2;
  let x = -tot / 2; const xs = ws.map(w => { const c = x + w / 2; x += w + gap; return c; });
  return { xs, ws };
}
function ivBubble(x, y, w, h, tone, p, seed) {
  if (p <= .002) return;
  tf(x, y + h / 2, lerp(.6, 1, p), 0, () => {
    const fill = tone === 'violet' ? COL.violet : COL.paper, bar = tone === 'violet' ? 'rgba(255,255,255,.75)' : COL.contour;
    softShadow(-w / 2, -h / 2, w, h, 20, { blur: 18, dy: 6, alpha: .1 });
    rrect(-w / 2, -h / 2, w, h, 20, fill, tone === 'violet' ? null : COL.contour, 1.5);
    if (tone !== 'violet') sparkle(-w / 2 + 28, 0, 11, COL.violet, 0);
    bars(-w / 2 + (tone === 'violet' ? 24 : 52), -h / 2 + (h > 66 ? 20 : 26), w - (tone === 'violet' ? 48 : 76), h > 66 ? 2 : 1, { h: 12, gap: 22, col: bar, seed, p: clamp(p * 1.3 - .2) });
  }, clamp(p * 2));
}
function ivContent(lt, o, mini) {
  const det = 1 - mini, tabs = o.tabs || [-1, 99, 99], { xs, ws } = ivTabs();
  const tl = mini > .999 ? IV.CARD_T : lt;   // fully mini: frozen internal time, so any caller reproduces the card exactly
  const pos = sp(lt, tabs[1], SP.ui) + sp(lt, tabs[2], SP.ui);
  // top bar
  for (let i = 0; i < 3; i++) circle(-436 + i * 24, -288, 7, COL.contour);
  circle(404, -288, 7, COL.coral); rrect(420, -294, 48, 12, 6, COL.contour);
  IV.TABS.forEach((t, i) => {
    const act = clamp(1 - Math.abs(pos - i));
    if (det > .01) type(t, xs[i], -289, { size: 28, weight: 600, face: 'I', col: mix(COL.muted, COL.deep, act), alpha: det });
    if (mini > .01) { g.save(); g.globalAlpha *= mini; rrect(xs[i] - ws[i] / 2, -296, ws[i], 16, 8, mix(COL.contour, COL.violet, act)); g.restore(); }
  });
  const fi = Math.min(1, Math.floor(pos)), ff = pos - fi, ux = lerp(xs[fi], xs[Math.min(2, fi + 1)], ff), uw = lerp(ws[fi], ws[Math.min(2, fi + 1)], ff) + 20;
  if (det > .01) { g.save(); g.globalAlpha *= det; rrect(ux - uw / 2, -262, uw, 5, 2.5, COL.violet); g.restore(); }
  line(-480, -256, 480, -256, COL.contour, 1.5);
  // candidate tile
  const talk = o.talk === undefined ? .5 : clamp(o.talk);
  rrect(-456, IV.TY, IV.TW, IV.TH, 18, COL.lav);
  g.save(); g.beginPath(); g.roundRect(-456, IV.TY, IV.TW, IV.TH, 18); g.clip();
  if (typeof person === 'function') person(-234, IV.TY + 178, 1.05, { pal: o.pal === undefined ? 0 : o.pal, lt: tl, mood: 'calm', seed: 2 });
  g.restore();
  tf(-456 + 24 + 76, IV.TY + IV.TH - 42, 1, 0, () => {
    rrect(-76, -24, 152, 48, 24, COL.paper);
    icon('mic', -48, 0, 24, COL.violet, 2.2);
    if (det > .01) { g.save(); g.globalAlpha *= det; ivWave(18, 0, 6, 5, 11, 28, COL.violet, lt, 1 - talk, 3); g.restore(); }
    if (mini > .01) { g.save(); g.globalAlpha *= mini; rrect(-16, -6, 66, 12, 6, COL.pale); g.restore(); }
  });
  // AI tile: sparkle orb + waveform (no bot)
  const ag = g.createLinearGradient(12, IV.TY, 12 + IV.TW, IV.TY + IV.TH);
  ag.addColorStop(0, COL.night); ag.addColorStop(1, COL.deep);
  rrect(12, IV.TY, IV.TW, IV.TH, 18, ag);
  g.save(); g.beginPath(); g.roundRect(12, IV.TY, IV.TW, IV.TH, 18); g.clip();
  ivOrb(234, IV.TY + 126, 56, tl, talk * det, det);
  g.restore();
  if (det > .01) { g.save(); g.globalAlpha *= det * .95; ivWave(234, IV.TY + 252, 13, 6, 14, 42, '#FFFFFF', lt, talk, 7); g.restore(); }
  if (mini > .01) { g.save(); g.globalAlpha *= mini; rrect(234 - 60, IV.TY + 246, 120, 12, 6, 'rgba(255,255,255,.55)'); g.restore(); }
  // content panel: per-tab morph
  rrect(-456, IV.PY, 912, IV.PH, 18, mix(COL.lav, COL.paper, .5));
  const vis = i => sp(lt, tabs[i] + (i ? .06 : 0), { dur: .42, bounce: 0 }) * (i < 2 ? 1 - spring(lt - tabs[i + 1], .2, 0) : 1) * det;
  const p0 = vis(0), p1 = vis(1), p2 = vis(2);
  if (p0 > .01) {
    g.save(); g.globalAlpha *= clamp(p0 * 1.4); g.translate(0, (1 - p0) * 16);
    ivBubble(-234, IV.PY + 18, 400, 78, 'paper', sp(lt, tabs[0] + .02, SP.ui), 11);
    ivBubble(250, IV.PY + 112, 340, 62, 'violet', sp(lt, tabs[0] + .22, SP.ui), 17);
    g.restore();
  }
  if (p1 > .01) {
    g.save(); g.globalAlpha *= clamp(p1 * 1.4); g.translate(0, (1 - p1) * 16);
    const cy = IV.PY + IV.PH / 2, t1 = tabs[1];
    IV_EDGES.forEach(([a, b, on], i) => {
      const A = IV_NODES[a], B = IV_NODES[b], pe = eio(seg(lt, t1 + .05 + i * .03, .24));
      if (pe <= 0) return;
      const x0 = A[0] + 66, x1 = B[0] - 66, y0 = cy + A[1], y1 = cy + B[1];
      g.beginPath(); g.moveTo(x0, y0);
      const N = 16; for (let k = 1; k <= Math.ceil(N * pe); k++) { const u = Math.min(pe, k / N), e = u * u * (3 - 2 * u); g.lineTo(lerp(x0, x1, u), lerp(y0, y1, e)); }
      g.strokeStyle = on ? COL.violet : COL.contour; g.lineWidth = on ? 3 : 2; g.lineCap = 'round'; g.stroke();
    });
    IV_NODES.forEach(([nx, ny, ic, on], i) => {
      const pn = sp(lt, t1 + i * .035, SP.ui); if (pn <= .01) return;
      tf(nx, cy + ny, lerp(.5, 1, pn), 0, () => {
        rrect(-66, -25, 132, 50, 25, on ? COL.paper : COL.paper, on ? COL.violet : COL.contour, on ? 2.5 : 2);
        icon(ic, -38, 0, 24, on ? COL.violet : COL.pale, 2.2);
        rrect(-16, -6, 60, 12, 6, on ? COL.pale : COL.contour);
      }, clamp(pn * 2));
    });
    g.restore();
  }
  if (p2 > .01) {
    g.save(); g.globalAlpha *= clamp(p2 * 1.4); g.translate(0, (1 - p2) * 16);
    const total = IV_CODE.reduce((s, l) => s + l[1].length, 0), rev = seg(lt, tabs[2] + .04, .75) * total;
    let idx = 0, cx = 0, cyy = 0;
    IV_CODE.forEach(([ind, toks], li) => {
      const ly = IV.PY + 38 + li * 31;
      rrect(-424, ly - 5, 18, 10, 5, COL.contour);
      let x = -376 + ind * 40;
      toks.forEach(([col, w]) => {
        const k = clamp(rev - idx); idx++;
        if (k > 0) { rrect(x, ly - 8, Math.max(16, w * eo(k)), 16, 8, COL[col]); cx = x + w * eo(k) + 10; cyy = ly; }
        x += w + 12;
      });
    });
    if (rev > 0) { const blink = Math.sin(lt * 11) > -.2 ? 1 : .15; g.save(); g.globalAlpha *= blink; rrect(cx, cyy - 13, 4, 26, 2, COL.violet); g.restore(); }
    g.restore();
  }
  if (mini > .01) { g.save(); g.globalAlpha *= mini; bars(-412, IV.PY + 44, 640, 3, { h: 22, gap: 48, col: COL.contour, seed: 9 }); g.restore(); }
}
function interviewWindow(cx, cy, k, lt, o = {}) {
  const a = o.alpha === undefined ? 1 : o.alpha; if (a <= .01 || k <= .001) return;
  const mini = clamp(o.mini || 0), w = IV.W * k, h = IV.H * k, r = lerp(28, 20, mini) * (o.s || 1), lw = o.lw || 2;
  g.save(); g.globalAlpha *= a;
  const sh = o.shadow === undefined ? 1 : o.shadow;
  if (sh > .01) softShadow(cx - w / 2, cy - h / 2, w, h, r, { blur: lerp(18, 48, clamp(k)), dy: lerp(6, 18, clamp(k)), alpha: .16 * sh });
  rrect(cx - w / 2, cy - h / 2, w, h, r, COL.paper);
  g.save(); g.beginPath(); g.roundRect(cx - w / 2, cy - h / 2, w, h, r); g.clip();
  tf(cx, cy, k, 0, () => ivContent(lt, o, mini));
  g.restore();
  rrect(cx - w / 2, cy - h / 2, w, h, r, null, COL.contour, lw);
  g.restore();
}
function interviewCard(cx, cy, lt, o = {}) {
  const s = o.s || 1;
  interviewWindow(cx, cy, IV.END * s, lt, { shadow: 0, tabs: [-9, -9, -9], ...o, mini: 1, lw: (o.lw || 2) * (o.s ? s : 1) });
}
