/* ui/pipeline.js: the corporate hiring pipeline drawn as a horizontal Measured Path. Pure functions of their arguments, local coords.
   PIPE                               geometry (local units), stage labels and icons.
   pipeGo(u)                          stop-to-stop travel ease 1 - (1-u)^4 (1+4u): zero velocity at both ends, quick departure, long soft
                                      landing, never overshoots (peak speed 2.1x the mean at u = .25).
   pipeTrack(y, x0, x1, o)            pale dotted base track at y from x0 to x1. o = {reveal 0..1 (left to right), alpha, w, col}
   pipePath(y, x0, x1, o)             solid violet path segment (the measured path). o = {w, alpha, col}
   pipeStage(x, y, s, lt, i, o)       stage node i (0 Source .. 4 Deploy). o = {appear 0..1 (scale), vis 0..1 (visited: violet ring + icon),
                                      act 0..1 (active: thicker ring + breathing halo), occ 0..1 (a candidate sits inside: icon fades),
                                      pulse 0..1 (soft shock), alpha}
   pipeLabel(i, x, y, lt, t0, o)      stage label (Inter 600, 32) mask-rising at t0. o = {out, size, col, alpha}
   pipeCandidate(x, y, s, lt, o)      candidate disc. o = {r, pal, lead (violet ring), seed, morph 0..1 (violet blob -> white disc with bust,
                                      spring value, may overshoot), blob (blob radius while condensing), chip 0..1 (evidence chip),
                                      tick 0..1 (verified tick), train 0..1 (training progress ring), flash 0..1, alpha}
   pipeEvidence(x, y, s, p)           small violet evidence chip: clipboard-check + abstract bar, no text. p = pop 0..1
   pipeTick(x, y, s, p)               small verified tick (the only green in this component).
   pipeChip(str, x, y, lt, t0, o)     an icon badge pops and widens into a labelled pill centred at x (text mask-rises, never bounces).
                                      o = {fill, col, icon, iconCol, size, stroke, shadow, out, badge} -> width
   managerCard(x, y, s, lt, o)        the human hiring manager: card PIPE.CW x PIPE.CH, person tile and an approve button (white check +
                                      abstract bar, violet; never green). o = {p in 0..1, press 0..1, done 0..1, pal, look, alpha}
                                      -> [x, y] of the card's bottom centre.
   pipeline(x, y, s, lt, o)           compact reusable strip centred at x,y (track + 5 stages + labels).
                                      o = {appear 0..1, path 0..4 (violet path drawn up to stage), spark 0..4, t0 (labels), out, labels, alpha}
   No verdicts: Assess adds evidence, not a score; routing back to Train is neutral (no red, no cross); a person approves. */
const PIPE = {
  LABELS: ['Source', 'Assess', 'Train', 'Interview', 'Deploy'],
  ICONS: ['user-round-search', 'clipboard-check', 'graduation-cap', 'messages-square', 'briefcase-business'],
  R: 46, GAP: 360, LY: 94, LS: 32, CR: 24, LEADR: 28, CW: 380, CH: 236, TILE: 140, BTN: [168, 52], CHIPY: 48
};
const pipeGo = u => { u = clamp(u); const v = 1 - u; return 1 - v * v * v * v * (1 + 4 * u); };

function pipeTrack(y, x0, x1, o = {}) {
  const p = o.reveal === undefined ? 1 : clamp(o.reveal), a = o.alpha === undefined ? 1 : o.alpha;
  if (p <= .001 || a <= .01) return;
  g.save(); g.globalAlpha *= a; line(x0, y, x1, y, o.col || COL.pale, o.w || 3.5, p, [.5, 13]); g.restore();
}
function pipePath(y, x0, x1, o = {}) {
  const a = o.alpha === undefined ? 1 : o.alpha;
  if (x1 - x0 <= .5 || a <= .01) return;
  g.save(); g.globalAlpha *= a; line(x0, y, x1, y, o.col || COL.violet, o.w || 5); g.restore();
}
function pipeStage(x, y, s, lt, i, o = {}) {
  const ap = o.appear === undefined ? 1 : o.appear, a = (o.alpha === undefined ? 1 : o.alpha) * clamp(ap * 2.5);
  if (ap <= .002 || a <= .01) return;
  const R = PIPE.R, vis = clamp(o.vis || 0), act = clamp(o.act || 0), occ = clamp(o.occ || 0), k = Math.max(vis, act);
  tf(x, y, s * ap, 0, () => {
    if (act > .01) { // breathing halo
      const br = 1 + .035 * Math.sin(lt * 3.2 + i * 1.3);
      circle(0, 0, (R + 20) * br, rgba(COL.violet, .08 * act));
      ring(0, 0, (R + 10) * br, 2, rgba(COL.violet, .2 * act));
    }
    softShadow(-R, -R, 2 * R, 2 * R, R, { blur: 26, dy: 9, alpha: .13 });
    circle(0, 0, R, COL.paper);
    ring(0, 0, R - 1.5, lerp(2, 3.5, k) + 2.5 * act, mix(COL.contour, COL.violet, k));
    const ia = 1 - occ; // two cached icon colours cross-faded (no per-frame colour mixing in the icon cache)
    if (ia > .01) {
      if (k < .99) { g.save(); g.globalAlpha *= ia * (1 - k); icon(PIPE.ICONS[i], 0, 0, R * .9, COL.grey, 2); g.restore(); }
      if (k > .01) { g.save(); g.globalAlpha *= ia * k; icon(PIPE.ICONS[i], 0, 0, R * .9, COL.violet, 2); g.restore(); }
    }
  }, a);
  if (o.pulse > 0 && o.pulse < 1) { g.save(); g.globalAlpha *= a; shock(x, y, o.pulse, 64 * s, COL.violet, 4); g.restore(); }
}
function pipeLabel(i, x, y, lt, t0, o = {}) {
  typeRise(PIPE.LABELS[i], x, y, lt, t0, { size: o.size || PIPE.LS, weight: 600, face: 'I', col: o.col || COL.ink, out: o.out, alpha: o.alpha });
}
function pipeEvidence(x, y, s, p) {
  if (p <= .01) return;
  tf(x, y, s * p, 0, () => {
    softShadow(-22, -13, 44, 26, 13, { blur: 10, dy: 4, alpha: .18 });
    rrect(-22, -13, 44, 26, 13, COL.violet);
    icon('clipboard-check', -8, 0, 15, '#fff', 2.4);
    rrect(2, -2.5, 12, 5, 2.5, 'rgba(255,255,255,.85)');
  }, clamp(p * 2));
}
function pipeTick(x, y, s, p) {
  if (p <= .01) return;
  tf(x, y, s * p, 0, () => {
    softShadow(-14, -14, 28, 28, 14, { blur: 10, dy: 3, alpha: .2 });
    circle(0, 0, 14, COL.paper);
    circle(0, 0, 11.5, COL.violet);              // deploy marker: violet (green is reserved for verification)
    icon('check', 0, .5, 14, '#fff', 3);
  }, clamp(p * 2));
}
function pipeCandidate(x, y, s, lt, o = {}) {
  const a = o.alpha === undefined ? 1 : o.alpha, m = o.morph === undefined ? 1 : o.morph, mc = clamp(m), r = o.r || PIPE.CR;
  if (a <= .01 || s <= .002 || (mc <= .001 && !(o.blob > .5))) return;
  tf(x, y, s, 0, () => {
    if (mc < 1 && o.blob > .5) circle(0, 0, lerp(o.blob, r * .82, mc), rgba(COL.violet, 1 - smooth(.2, .85, mc)));
    if (m > .005) {
      const k = lerp(.6, 1, m);
      g.save(); g.scale(k, k); g.globalAlpha *= clamp(mc * 2.4);
      softShadow(-r, -r, 2 * r, 2 * r, r, { blur: 18, dy: 7, alpha: .18 });
      bust(0, 0, r, o.pal === undefined ? 0 : o.pal, COL.lav, lt, { seed: o.seed || 0 });
      ring(0, 0, r + 1.5, o.lead ? 3.5 : 2.5, o.lead ? COL.violet : COL.pale);
      if (o.train > .005) arc(0, 0, r + 8, 3, COL.lilac, o.train);
      g.restore();
    }
    if (o.flash > 0 && o.flash < 1) shock(0, 0, o.flash, 46, COL.violet, 4);
    pipeEvidence(r * .82, -r * .86, 1, o.chip || 0);
    pipeTick(r * .78, r * .78, 1, o.tick || 0);
  }, a);
}
function pipeChip(str, x, y, lt, t0, o = {}) {
  const size = o.size || 26, h = size * 1.9, pad = o.pad || 20, isz = size * 1.02;
  const full = textWidth(str, size, 600, 'I') + pad * 2 + h * .62;
  const pb = o.badge !== undefined ? clamp(o.badge) : sp(lt, t0 - .22, SP.ui);
  const q = o.out !== undefined ? spring(lt - o.out, .45, 0) : 0;
  if (pb <= .01 || q >= .999) return 0;
  const pw = sp(lt, t0, SP.ui), w = Math.max(h, lerp(h, full, pw)), left = x - w / 2;
  const col = o.col || COL.deep;
  tf(left + h / 2, y, pb * (1 - .15 * q), 0, () => {
    const L = -h / 2;
    if (o.shadow) softShadow(L, -h / 2, w, h, h / 2, { blur: 20, dy: 7, alpha: .16 });
    rrect(L, -h / 2, w, h, h / 2, o.fill || COL.lav, o.stroke, 2);
    if (o.icon) icon(o.icon, 0, 0, isz, o.iconCol || col, 2.2);
    if (pw > .02) {
      g.save(); g.beginPath(); g.rect(L + h * .62, -h / 2, w - h * .62, h); g.clip();
      typeRise(str, L + h * .62 + pad * .55, 1, lt, t0 + .06, { size, weight: 600, face: 'I', col, align: 'left' });
      g.restore();
    }
  }, clamp(pb * 2) * (1 - q));
  return w;
}
function managerCard(x, y, s, lt, o = {}) {
  const p = o.p === undefined ? 1 : o.p, a = (o.alpha === undefined ? 1 : o.alpha) * clamp(p * 1.8), w = PIPE.CW, h = PIPE.CH;
  if (p > .002 && a > .01) tf(x, y, s * lerp(.94, 1, clamp(p)), 0, () => {
    const L = -w / 2, T = -h / 2, tx = L + 14, ty = T + 14, tw = w - 28, th = PIPE.TILE;
    card(L, T, w, h, 24, { sh: { blur: 40, dy: 16, alpha: .16 } });
    // person tile (head centred ~60px below the tile top)
    g.save(); g.beginPath(); g.roundRect(tx, ty, tw, th, 16); g.fillStyle = COL.lav; g.fill(); g.clip();
    circle(0, ty + th * .44, 66, 'rgba(255,255,255,.6)');
    person(0, ty + th * .42 + 41, .62, { pal: o.pal || 0, lt, seed: 4, mood: 'calm', look: o.look || 0 });
    g.restore();
    // approve button: white check + abstract label bar (violet action colour, deepens once pressed)
    const press = clamp(o.press || 0), done = clamp(o.done || 0), bw = PIPE.BTN[0], bh = PIPE.BTN[1];
    const by = (ty + th + h / 2) / 2, bs = 1 - .07 * Math.sin(Math.PI * press);
    tf(0, by, bs, 0, () => {
      softShadow(-bw / 2, -bh / 2, bw, bh, bh / 2, { blur: 16, dy: 6, alpha: .18 });
      pill(0, 0, bw, bh, mix(COL.violet, COL.deep, done));
      icon('check', -bw / 2 + 32, 0, 26, '#fff', 3);
      rrect(-bw / 2 + 56, -4, bw - 84, 8, 4, 'rgba(255,255,255,.82)');
    });
    if (done > 0 && done < 1) shock(0, by, done, 96, COL.violet, 4);
  }, a);
  return [x, y + h / 2 * s];
}
function pipeline(x, y, s, lt, o = {}) {
  const ap = o.appear === undefined ? 1 : clamp(o.appear), a = o.alpha === undefined ? 1 : o.alpha, G = PIPE.GAP;
  if (ap <= .002 || a <= .01) return;
  tf(x, y, s, 0, () => {
    pipeTrack(0, -2 * G - 140, 2 * G + 140, { reveal: clamp(ap * 1.5) });
    const pp = clamp(o.path || 0, 0, 4);
    if (pp > 0) pipePath(0, -2 * G, -2 * G + pp * G, { w: 5 });
    for (let i = 0; i < 5; i++) {
      pipeStage((i - 2) * G, 0, 1, lt, i, { appear: clamp((ap - i * .08) / .68), vis: clamp(pp - i + 1) });
      if (o.labels !== false) pipeLabel(i, (i - 2) * G, PIPE.LY, lt, (o.t0 || 0) + i * .06, { out: o.out });
    }
    const k = o.spark;
    if (k !== undefined && k >= 0 && k <= 4) spark(-2 * G + k * G, 0, 1);
  }, a);
}
