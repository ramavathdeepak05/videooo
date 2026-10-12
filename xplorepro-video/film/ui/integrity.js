/* ui/integrity.js: proctoring integrity rows, the flag pill and the human reviewer with an evidence timeline. Pure functions of their
   arguments. No verdicts anywhere: a flag only routes evidence to a person (no shield, eye, gavel, score or rejection state).
   INTEG                               geometry (local units).
   integrityRow(x, y, s, lt, o)        one hairline row centred at x,y (INTEG.W x INTEG.H), local units scaled by s:
       bust, two abstract ID bars, live submission bar, four small neutral signal icons (app-window, clipboard-paste, users-round, wifi-off).
       o = { p build 0..1 (hairline draws, bust pops, bars grow, icons pop on a stagger), pal (people.js palette), seed,
             sub submission 0..1, sig [4 x 0..1] amber level per signal icon, marks [[u, p]] amber event dots on the submission bar,
             lift 0..1 raised white card behind the row, alpha, line (default true) }
   integrityTarget(k)                  local [x, y] of row element k (0 bust, 1-2 ID bars, 3-5 submission bar, 6-9 icons): particle targets.
   integChip(str, x, y, lt, t0, o)     an icon badge pops (UI spring) and widens into a pill while the label mask-rises (text never bounces).
       o = { fill, fillTo (fill blends to this as it widens), col, icon, iconCol, size, stroke, anchor:'left' (x,y = badge centre,
             grows right) | 'center', shadow, out (local time it collapses), badge (override of the badge pop 0..1) } → width
   evidenceStrip(x, y, w, lt, o)       timeline strip from x (left) at baseline y: ticks, neutral event pills, amber segments, spark playhead.
       o = { p build 0..1, scrub 0..1 playhead (0 = hidden), marks [[u0, u1]] amber, events [[u0, u1]] neutral, alpha }
   reviewerCard(x, y, s, lt, o)        the human reviewer: card INTEG.CW x INTEG.CH with a person tile, a header badge slot, the evidence
       strip with the matching signal icons, and note bars. o = { pal, look, strip 0..1, scrub 0..1, marks, note 0..1, alpha, shadow }
   reviewerStripIn()                   local [x, y] where a connector should land (left end of the strip track). */
const INTEG = {
  W: 800, H: 84, BUST: -366, BR: 30, ID: -318, BAR0: -168, BAR1: 160, ICX: [214, 262, 310, 358], ICR: 20,
  ICONS: ['app-window', 'clipboard-paste', 'users-round', 'wifi-off'],
  CW: 420, CH: 520, TILE: [-190, -240, 380, 262], STRIP: [-176, 150, 352]
};
/* staggered sub-progress inside a 0..1 build: element starting at q, lasting d */
const integSub = (p, q, d = .4) => clamp((p - q) / d);
/* a spring evaluated on a 0..1 sub-progress (u * dur used as time), for pops driven by a caller progress */
const integPop = (u, P = SP.pop) => (u <= 0 ? 0 : u >= 1 ? 1 : spring(u * P.dur * 1.6, P.dur, P.bounce));

function integrityTarget(k) {
  const I = INTEG;
  if (k === 0) return [I.BUST, 0];
  if (k === 1) return [I.ID + 46, -11];
  if (k === 2) return [I.ID + 66, 11];
  if (k <= 5) return [lerp(I.BAR0, I.BAR1, [.12, .5, .88][k - 3]), 0];
  return [I.ICX[(k - 6) % 4], 0];
}

function integrityRow(x, y, s, lt, o = {}) {
  const a = o.alpha === undefined ? 1 : o.alpha, p = o.p === undefined ? 1 : clamp(o.p);
  if (a <= .01 || p <= .001 || s <= .001) return;
  const I = INTEG, lift = clamp(o.lift || 0), seed = o.seed || 1;
  tf(x, y, s * (1 + .025 * lift), 0, () => {
    if (lift > .01) {
      const lw = I.W + 56, lh = I.H + 14;
      softShadow(-lw / 2, -lh / 2, lw, lh, 22, { blur: 34, dy: 12, alpha: .16 * lift });
      g.save(); g.globalAlpha *= lift; rrect(-lw / 2, -lh / 2, lw, lh, 22, COL.paper, COL.contour, 1.5); g.restore();
    }
    // hairline under the row draws left to right
    const ph = eo(integSub(p, 0, .7));
    if (o.line !== false && ph > .002) { g.save(); g.globalAlpha *= 1 - lift; line(-I.W / 2, I.H / 2 + 6, -I.W / 2 + I.W * ph, I.H / 2 + 6, COL.contour, 1.5); g.restore(); }
    // bust (candidate)
    const pb = integPop(integSub(p, 0, .45));
    if (pb > .01) tf(I.BUST, 0, pb, 0, () => bust(0, 0, I.BR, o.pal === undefined ? 0 : o.pal, COL.lav, lt, { seed }), clamp(pb * 2));
    // abstract ID bars
    const pi = eo(integSub(p, .12, .45));
    if (pi > .002) {
      rrect(I.ID, -17, 92 * pi, 12, 6, COL.navy);
      rrect(I.ID, 5, 132 * pi, 12, 6, COL.contour);
    }
    // live submission bar: track + violet fill + knob, amber event dots
    const pt = eo(integSub(p, .22, .5)), bw = I.BAR1 - I.BAR0;
    if (pt > .002) {
      rrect(I.BAR0, -5, bw * pt, 10, 5, COL.lav);
      const sub = clamp(o.sub === undefined ? .6 : o.sub) * eo(integSub(p, .35, .6)), fw = bw * sub;
      if (fw > 2) {
        const gr = g.createLinearGradient(I.BAR0, 0, I.BAR0 + bw, 0); gr.addColorStop(0, COL.pale); gr.addColorStop(1, COL.violet);
        rrect(I.BAR0, -5, Math.max(10, fw), 10, 5, gr);
        circle(I.BAR0 + Math.max(5, fw - 5), 0, 8, COL.paper); ring(I.BAR0 + Math.max(5, fw - 5), 0, 8, 3, COL.violet);
      }
      (o.marks || []).forEach(([u, mp]) => {
        const m = integPop(clamp(mp));
        if (m > .01) { circle(I.BAR0 + bw * u, 0, 9 * m, COL.paper); circle(I.BAR0 + bw * u, 0, 6 * m, COL.amber); }
      });
    }
    // neutral signal icons (amber only when a signal is raised)
    I.ICX.forEach((ix, k) => {
      const pk = integPop(integSub(p, .4 + k * .08, .4), SP.ui); if (pk <= .01) return;
      const sg = clamp((o.sig || [])[k] || 0), sc = pk * (1 + .12 * Math.sin(Math.PI * sg));
      tf(ix, 0, sc, 0, () => {
        circle(0, 0, I.ICR, mix(COL.lav, COL.amber, sg));
        icon(I.ICONS[k], 0, 0, 22, sg > .5 ? COL.ink : COL.grey, 2);
      }, clamp(pk * 2));
    });
  }, a);
}

function integChip(str, x, y, lt, t0, o = {}) {
  const size = o.size || 26, h = size * 1.9, pad = o.pad || 20, isz = size * 1.02;
  const full = textWidth(str, size, 600, 'I') + pad * 2 + h * .62;
  const pb = o.badge !== undefined ? clamp(o.badge) : sp(lt, t0 - .22, SP.ui);
  const q = o.out !== undefined ? spring(lt - o.out, .45, 0) : 0;
  if (pb <= .01 || q >= .999) return 0;
  const pw = sp(lt, t0, SP.ui), w = Math.max(h, lerp(h, full, pw)), left = o.anchor === 'left' ? x - h / 2 : x - w / 2;
  const fill = o.fillTo ? mix(o.fill || COL.lav, o.fillTo, clamp(pw)) : (o.fill || COL.lav), col = o.col || COL.deep;
  tf(left + h / 2, y, pb * (1 - .15 * q), 0, () => {
    const L = -h / 2;
    if (o.shadow) softShadow(L, -h / 2, w, h, h / 2, { blur: 20, dy: 7, alpha: .16 });
    rrect(L, -h / 2, w, h, h / 2, fill, o.stroke, 2);
    if (o.icon) icon(o.icon, 0, 0, isz, o.iconCol || col, 2.2);
    if (pw > .02) {
      g.save(); g.beginPath(); g.rect(L + h * .62, -h / 2, w - h * .62, h); g.clip();
      typeRise(str, L + h * .62 + pad * .55, 1, lt, t0 + .06, { size, weight: 600, face: 'I', col, align: 'left' });
      g.restore();
    }
  }, clamp(pb * 2) * (1 - q));
  return w;
}

function evidenceStrip(x, y, w, lt, o = {}) {
  const a = o.alpha === undefined ? 1 : o.alpha, p = clamp(o.p === undefined ? 1 : o.p);
  if (a <= .01 || p <= .002) return;
  g.save(); g.globalAlpha *= a;
  const pt = eo(integSub(p, 0, .6)), scrub = clamp(o.scrub || 0), px = x + w * scrub;
  line(x, y, x + w * pt, y, COL.contour, 2);
  for (let i = 0; i <= 12; i++) {
    const u = i / 12, tp = integSub(p, .1 + u * .45, .25); if (tp <= 0) continue;
    const hh = i % 3 === 0 ? 10 : 6;
    line(x + w * u, y - hh, x + w * u, y - hh + 2 * hh * eo(tp), COL.contour, 1.5);
  }
  if (scrub > 0) line(x, y, px, y, COL.pale, 4);
  (o.events || []).forEach(([u0, u1], i) => {
    const ep = eo(integSub(p, .35 + i * .06, .35)); if (ep <= .002) return;
    rrect(x + w * u0, y - 21, w * (u1 - u0) * ep, 10, 5, COL.contour);
  });
  (o.marks || []).forEach(([u0, u1], i) => {
    const mp = integPop(integSub(p, .5 + i * .1, .4), SP.ui); if (mp <= .01) return;
    const hit = scrub > 0 ? Math.sin(Math.PI * clamp((px - (x + w * u0)) / (w * (u1 - u0) + 40))) : 0;
    const cx = x + w * (u0 + u1) / 2, ww = w * (u1 - u0);
    tf(cx, y, mp * (1 + .14 * hit), 0, () => {
      if (hit > .05) { g.save(); g.globalAlpha *= .35 * hit; rrect(-ww / 2 - 8, -17, ww + 16, 34, 17, COL.amber); g.restore(); }
      rrect(-ww / 2, -8, ww, 16, 8, COL.amber);
    }, clamp(mp * 2));
  });
  if (scrub > 0) {
    line(px, y - 30, px, y + 30, COL.violet, 2.5);
    spark(px, y, .95, smooth(0, .04, scrub));
  }
  g.restore();
}

function reviewerStripIn() { return [INTEG.STRIP[0] - 14, INTEG.STRIP[1]]; }

function reviewerCard(x, y, s, lt, o = {}) {
  const a = o.alpha === undefined ? 1 : o.alpha; if (a <= .01 || s <= .001) return;
  const I = INTEG, [tx, ty, tw, th] = I.TILE, [sx, sy, sw] = I.STRIP;
  tf(x, y, s, 0, () => {
    const L = -I.CW / 2, T = -I.CH / 2;
    if ((o.shadow === undefined ? 1 : o.shadow) > .01) softShadow(L, T, I.CW, I.CH, 28, { blur: 44, dy: 16, alpha: .16 * (o.shadow === undefined ? 1 : o.shadow) });
    rrect(L, T, I.CW, I.CH, 28, COL.paper, COL.contour, 1.5);
    // person tile (the reviewer, studying the strip below)
    rrect(tx, ty, tw, th, 20, COL.lav);
    g.save(); g.beginPath(); g.roundRect(tx, ty, tw, th, 20); g.clip();
    circle(tx + tw * .78, ty + th * .3, 120, rgba(COL.contour, .5));
    person(0, ty + 178, 1.08, { pal: o.pal === undefined ? 5 : o.pal, lt, mood: 'calm', look: o.look || 0, seed: 4 });
    g.restore();
    line(L + 24, 52, L + I.CW - 24, 52, COL.contour, 1.5);
    // evidence header: icon + abstract title bars
    const ps = clamp(o.strip || 0);
    const hp = integPop(integSub(ps, 0, .4), SP.ui);
    if (hp > .01) tf(sx + 16, 92, hp, 0, () => { circle(0, 0, 20, COL.lav); icon('history', 0, 0, 22, COL.deep, 2.2); }, clamp(hp * 2));
    bars(sx + 50, 80, 170, 2, { h: 10, gap: 18, head: true, headCol: COL.navy, col: COL.contour, p: integSub(ps, .1, .5), seed: 31 });
    evidenceStrip(sx, sy, sw, lt, { p: integSub(ps, .15, .85), scrub: o.scrub, marks: o.marks || [], events: o.events || [[.06, .2], [.5, .62], [.84, .95]] });
    // signal icons under the amber segments (same icons as the flagged row)
    (o.marks || []).forEach(([u0, u1], i) => {
      const ip = integPop(integSub(ps, .7 + i * .1, .3), SP.ui); if (ip <= .01) return;
      tf(sx + sw * (u0 + u1) / 2, sy + 34, ip, 0, () => icon(I.ICONS[i % 2], 0, 0, 22, COL.amber, 2.2), clamp(ip * 2));
    });
    // reviewer's notes (abstract)
    bars(sx, sy + 66, 300, 2, { h: 10, gap: 20, col: COL.contour, p: clamp(o.note || 0), seed: 37 });
  }, a);
}
