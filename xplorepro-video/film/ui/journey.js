/* ui/journey.js: the seven-step "One-week discovery journey" (lucide icons + approved labels) and the roadmap plane.
   JOURNEY.icons / JOURNEY.labels   step i (0..6)
   journeyNode(x, y, s, lt, o)    one step disc centred at x,y. o = {i (step index), icon, r=44, vis 0..1 (visited), act 0..1 (active),
                                  appear 0..1, ring (override ring width, px), iconAlpha, halo (default true), alpha}
                                  States: idle = white disc, 2px contour ring, pale icon; visited = 3.5px violet ring, violet icon;
                                  active = 6px violet ring, soft halo, slight lift. Radius and ring width are explicit (not scaled)
                                  so a step can grow into a precise disc (mentor -> readiness contract: r 150, 6px ring).
   journeyTrack(L, u, o)          lut path: dotted remainder up to o.reveal (0..1) and the solid violet travelled part up to u.
                                  o = {w=5, reveal=1, alpha, from=0}
   journey(x, y, s, lt, o)        compact horizontal strip of all seven steps centred at x,y (for reuse in other scenes).
                                  o = {gap=210, p (spark progress in steps, 0..6), appear 0..1, label (show the active label), alpha}
   roadmapPlane(x, y, s, lt, o)   mini personalised action plan (milestone pills, no readable text) centred at x,y.
                                  o = {p (open 0..1), t0 (local time the rows start), w=340, h=214, alpha} */
const JOURNEY = {
  icons: ['door-open', 'user-round-search', 'compass', 'map', 'message-circle', 'mic', 'messages-square'],
  labels: ['Onboarding', 'Profile analysis', 'Career discovery', 'Personalised roadmap', 'Conversational assessment', 'AI interview', 'Readiness counselling'],
  R: 44
};
function journeyNode(x, y, s, lt, o = {}) {
  const ap = o.appear === undefined ? 1 : clamp(o.appear), a = (o.alpha === undefined ? 1 : o.alpha) * clamp(ap * 2);
  if (a <= .01 || ap <= .002) return;
  const vis = clamp(o.vis || 0), act = clamp(o.act || 0), on = Math.max(vis, act), r = (o.r || JOURNEY.R) * (1 + .12 * act) * lerp(.5, 1, ap);
  const ic = o.icon || JOURNEY.icons[(o.i || 0) % 7];
  tf(x, y, s, 0, () => {
    const halo = o.halo === false ? 0 : act;
    if (halo > .01) {
      circle(0, 0, r + 18 + 3 * Math.sin(lt * 3.2), rgba(COL.violet, .08 * halo));
      ring(0, 0, r + 18 + 3 * Math.sin(lt * 3.2), 1.5, rgba(COL.lilac, .45 * halo));
    }
    softShadow(-r, -r, 2 * r, 2 * r, r, { blur: r * .6, dy: r * .2, alpha: (.1 + .06 * act) * (o.shadow === undefined ? 1 : o.shadow) });
    circle(0, 0, r, COL.paper);
    const rw = o.ring !== undefined ? o.ring : lerp(lerp(2, 3.5, vis), 6, act);
    ring(0, 0, r, rw, mix(COL.contour, COL.violet, on));
    const ia = o.iconAlpha === undefined ? 1 : o.iconAlpha;
    const isz = Math.min(r, 70) * .86;
    if (ia > .01 && on < .99) { g.save(); g.globalAlpha *= ia * (1 - on); icon(ic, 0, 0, isz, COL.pale, 2); g.restore(); }
    if (ia > .01 && on > .01) { g.save(); g.globalAlpha *= ia * on; icon(ic, 0, 0, isz, COL.violet, 2); g.restore(); }
  }, a);
}
function journeyTrack(L, u, o = {}) {
  const a = o.alpha === undefined ? 1 : o.alpha, rv = o.reveal === undefined ? 1 : clamp(o.reveal), f = o.from || 0;
  if (a <= .01) return;
  g.save(); g.globalAlpha *= a;
  if (rv > u) pathDraw(L, rv, COL.pale, 3, { from: Math.max(f, u), dash: [1, 13] });
  if (u > f) pathDraw(L, u, COL.violet, o.w || 5, { from: f });
  g.restore();
}
function journey(x, y, s, lt, o = {}) {
  const gap = o.gap || 210, p = o.p === undefined ? 6 : o.p, ap = o.appear === undefined ? 1 : o.appear, a = o.alpha === undefined ? 1 : o.alpha;
  if (a <= .01) return;
  tf(x, y, s, 0, () => {
    const x0 = -gap * 3, L = lut([[x0, 0], [x0 + gap * 6, 0]], 60);
    journeyTrack(L, clamp(p / 6), { reveal: clamp(ap * 1.2) });
    for (let i = 0; i < 7; i++) {
      const vis = clamp(p - i + 1), act = clamp(1 - Math.abs(p - i) * 1.6);
      journeyNode(x0 + i * gap, 0, 1, lt, { i, vis: vis >= 1 ? 1 : 0, act, appear: clamp(ap * 7 - i * .7) });
    }
    spark(x0 + gap * clamp(p, 0, 6), 0, 1, clamp(ap * 2));
    if (o.label) { const k = Math.round(clamp(p, 0, 6)); type(JOURNEY.labels[k], x0 + k * gap, 96, { size: 30, weight: 600, face: 'I', col: COL.ink, alpha: clamp(1 - Math.abs(p - k) * 2.2) }); }
  }, a);
}
function roadmapPlane(x, y, s, lt, o = {}) {
  const p = clamp(o.p === undefined ? 1 : o.p), a = (o.alpha === undefined ? 1 : o.alpha) * clamp(p * 2);
  if (p <= .002 || a <= .01) return;
  const w = o.w || 340, h = o.h || 214, t0 = o.t0 || 0;
  tf(x, y, s * lerp(.5, 1, p), 0, () => {
    card(-w / 2, -h / 2, w, h, 22, { sh: { blur: 30, dy: 12, alpha: .16 } });
    // header: small map badge + title bar
    const hx = -w / 2 + 40, hy = -h / 2 + 38, k0 = sp(lt, t0, SP.ui);
    tf(hx, hy, k0, 0, () => { circle(0, 0, 18, COL.lav); icon('map', 0, 0, 20, COL.violet, 2.2); });
    rrect(hx + 32, hy - 6, (w - 120) * .55 * k0, 12, 6, COL.ink);
    // milestone rail: three steps, the path line draws down as each milestone lands
    const rx = -w / 2 + 40, ry0 = hy + 52, step = 42;
    const rail = sp(lt, t0 + .06, { dur: .7, bounce: 0 });
    line(rx, ry0, rx, ry0 + step * 2, COL.contour, 3, rail);
    line(rx, ry0, rx, ry0 + step * 2, COL.violet, 3, rail * .5);
    const widths = [.78, .58, .68];
    for (let i = 0; i < 3; i++) {
      const k = sp(lt, t0 + .1 + i * .07, SP.ui), yy = ry0 + i * step;
      tf(rx, yy, k, 0, () => { circle(0, 0, 10, i < 2 ? COL.violet : COL.paper); ring(0, 0, 10, 3, COL.violet); if (i < 2) circle(0, 0, 3.5, COL.paper); });
      pill(rx + 34 + (w - 120) * widths[i] * k / 2, yy, (w - 120) * widths[i] * k, 22, i === 0 ? COL.lav : mixHex(COL.lav, COL.paper, .35), { stroke: i === 0 ? COL.contour : null, lw: 1.5 });
      if (i === 2) tf(rx + 34 + (w - 120) * widths[i] + 26, yy, k, 0, () => icon('flag-triangle-right', 0, 0, 22, COL.violet, 2.2));
    }
  }, a);
}
