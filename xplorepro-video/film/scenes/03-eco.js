/* scenes/03-eco.js: L04 "Students, colleges, companies: one AI career platform that brings them all together."
   (anchors students colleges corporates ai)  L05 "Over a million students, across six countries." (anchors million countries)
   Match cut from the reveal: the lone mark at (960,540) h150 becomes the hub (a white disc springs open behind it). On each
   anchor a violet node travels out along a curved violet connector (path-follow) and lands with its label; data particles
   flow both ways. On 'ai' the hub pulses: a violet ring draws round it, sparkles bloom and contour rings ripple out while a
   light pulse runs down every connector. The camera then pulls back and up and a full-width lavender evidence band rises with
   four odometers on one shared plane (hairline dividers); the evidence spark walks the band's top hairline and stops on each
   counter as it settles with a chime ("1,000,000" morphs to "1 Million+" on 'million', "6" lands on 'countries' after two
   extra turns). Exit: the spark runs from the hub to the Students node, which the mentor scene pushes into (cutIn 'push';
   the push point is computed here from the end camera and handed over through ECO_LINK). */
const ECO = {
  HUB: [960, 540], MH: 150, HR: 128, NR: 56,
  NODES: [
    { key: 'students', label: 'Students', icon: 'graduation-cap', p: [420, 552], bend: 90 },
    { key: 'colleges', label: 'Colleges', icon: 'landmark', p: [1490, 312], bend: -70 },
    { key: 'corporates', label: 'Corporates', icon: 'briefcase-business', p: [1490, 774], bend: 70 }
  ],
  BACK: { x: 960, y: 722, z: .8 },              // pulled-back camera (network sits in the upper part of the frame)
  BAND: { y: 760, h: 250 },                     // evidence band (screen space)
  STATS: [
    { to: 300, sfx: '+', label: 'client organisations', x: 240 },
    { to: 700, sfx: '+', label: 'colleges and universities', x: 720 },
    { to: 1000000, million: true, label: 'students', x: 1200 },
    { to: 6, label: 'countries', x: 1680, turns: 1 }
  ],
  SPARKLES: [[-182, -120, 26, 0], [154, -166, 34, 1], [196, 100, 18, 0], [-150, 160, 21, 1]]
};
const ECO_LINK = { push: null };                // world->screen point of the Students node at the cut (read by 04-mentor.js)

/* camera: slow push while the network builds, pull back and up after 'ai', then a gentle drift. Exactly (960,540,1) at lt 0. */
function ecoCam(lt, st) {
  const push = eio(clamp(lt / Math.max(.5, st.tBack))), b = spring(lt - st.tBack, 1.35, 0), d = smooth(0, 1.4, lt);
  const x = lerp(960 + 10 * push, ECO.BACK.x, b) + d * 7 * noise1(lt * .35, 3);
  const y = lerp(540 - 6 * push, ECO.BACK.y, b) + d * 5 * noise1(lt * .3, 7);
  const z = lerp(1 + .04 * push, ECO.BACK.z, b) * (1 + .02 * smooth(st.tBack + .9, st.len + .6, lt));
  return { x, y, z, rot: 0 };
}
/* data particles on one connector: violet out to the node, lilac back to the hub */
function ecoFlow(L, lt, t0, seed, dim) {
  const on = smooth(t0, t0 + .45, lt) * dim; if (on <= .01) return;
  const k0 = (ECO.HR + 6) / L.len, k1 = 1 - (ECO.NR + 10) / L.len, win = u => smooth(k0, k0 + .07, u) * (1 - smooth(k1 - .07, k1, u));
  for (let k = 0; k < 4; k++) {
    const u = ((lt - t0) * .52 + k / 4 + seed * .13) % 1, p = L.at(u), a = on * win(u);
    if (a > .01) circle(p.x, p.y, 4.6, rgba(COL.violet, a));
  }
  for (let k = 0; k < 3; k++) {
    const u = 1 - ((lt - t0) * .4 + k / 3 + seed * .29) % 1, p = L.at(u), a = on * win(u) * .9;
    if (a > .01) circle(p.x, p.y, 3.6, rgba(COL.lilac, a));
  }
}
function ecoNodeDraw(n, x, y, s, lt, st) {
  const r = ECO.NR;
  tf(x, y, s, 0, () => {
    softShadow(-r - 6, -r - 6, 2 * r + 12, 2 * r + 12, r + 6, { blur: 30, dy: 10, alpha: .16 });
    circle(0, 0, r + 6, COL.paper);
    const gr = g.createLinearGradient(-r, -r, r, r); gr.addColorStop(0, COL.bright); gr.addColorStop(1, COL.deep);
    circle(0, 0, r, gr);
    icon(n.icon, 0, 0, r * 1.0, '#FFFFFF', 2);
  });
}
/* the evidence band with four odometers (screen space; p = rise) */
function ecoBand(lt, st, dim) {
  const p = sp(lt, st.tB, SP.soft); if (p <= .002) return;
  const B = ECO.BAND, y0 = B.y + (1 - p) * 330, h = B.h;
  g.save(); g.globalAlpha *= clamp(p * 1.6) * dim;
  softShadow(-60, y0, W + 120, h, 0, { blur: 44, dy: 14, alpha: .07, spread: 0 });
  const gr = g.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, rgba(COL.lav, .97)); gr.addColorStop(1, rgba(mixHex(COL.lav, COL.paper, .35), .97));
  g.fillStyle = gr; g.fillRect(-60, y0, W + 120, h);
  const hl = eo(seg(lt, st.tB + .05, .7));
  line(0, y0, W, y0, COL.contour, 2, hl);
  line(W, y0 + h, 0, y0 + h, COL.contour, 2, hl);
  line(0, y0 + 9, W, y0 + 9, rgba(COL.contour, .55), 1, eo(seg(lt, st.tB + .15, .8)));
  for (let i = 1; i < 4; i++) { const x = i * 480, q = eo(seg(lt, st.tB + .2 + i * .06, .55)); line(x, y0 + h / 2, x, y0 + 40, COL.contour, 1.5, q); line(x, y0 + h / 2, x, y0 + h - 40, COL.contour, 1.5, q); }
  // counters
  st.cs.forEach((c, i) => {
    const S = ECO.STATS[i], ny = y0 + 102, ly = y0 + 176, ap = clamp(sp(lt, c.t0 - .12, SP.text) * 1.5);
    if (ap <= .01) return;
    const V = rollValue(lt, c.t0, c.dur, S.to, S.turns || 0);
    const morph = S.million ? sp(lt, st.tM - .02, { dur: .7, bounce: 0 }) : 0;
    odometer(S.x, ny + (1 - ap) * 26, V, { to: S.to, size: 86, col: COL.deep, suffix: S.sfx, million: !!S.million, morph, alpha: ap });
    typeRise(S.label, S.x, ly, lt, c.t0 + .06, { size: 28, weight: 600, face: 'I', col: COL.muted });
  });
  // evidence spark walks the top hairline and rests on each counter as it settles
  const sa = smooth(st.tB + .15, st.tB + .4, lt) * (1 - smooth(st.cs[3].land + .25, st.cs[3].land + .6, lt));
  if (sa > .01) {
    const K = st.walk; let x = K[0][1], v = 0;
    for (let k = 1; k < K.length; k++) {
      if (lt >= K[k][0]) { x = K[k][1]; continue; }
      const a = K[k - 1], f = clamp((lt - a[0]) / (K[k][0] - a[0])); x = lerp(a[1], K[k][1], eio(f)); v = Math.sin(Math.PI * f); break;
    }
    g.save(); g.globalAlpha *= sa;
    const tl = 40 + 110 * v;                                   // trail stretches while moving, shrinks at rest
    for (let k = 0; k < 5; k++) line(x - tl * k / 5, y0, x - tl * (k + 1) / 5, y0, rgba(COL.violet, .6 * (1 - k / 5)), 4.5 - k * .6);
    spark(x, y0, 1.05, 1);
    g.restore();
  }
  g.restore();
}

SC.eco = {
  cutIn: { type: 'match' },
  init(s) {
    const st = { len: s.len, start: s.start };
    st.nodes = ECO.NODES.map((n, i) => {
      const [hx, hy] = ECO.HUB, [nx, ny] = n.p, dx = nx - hx, dy = ny - hy, l = Math.hypot(dx, dy);
      const mid = [(hx + nx) / 2 - dy / l * n.bend, (hy + ny) / 2 + dx / l * n.bend];
      return { ...n, i, t: at(s, n.key), L: lut([[hx, hy], mid, [nx, ny]], 160) };
    });
    st.tAi = at(s, 'ai'); st.tM = at(s, 'million'); st.tC = at(s, 'countries');
    st.tBack = st.tAi + .34;                                   // camera pulls back and up
    st.tB = st.tAi + .4;                                       // evidence band rises
    const c0 = { t0: st.tB + .1, dur: .62 }, c1 = { t0: st.tB + .2, dur: .8 };
    const c2 = { t0: st.tB + .28 }; c2.dur = Math.max(.5, st.tM - .05 - c2.t0);
    const c3 = { t0: Math.max(st.tC - .85, st.tM + .7) }; c3.dur = Math.max(.6, st.tC + .2 - c3.t0);
    c0.land = c0.t0 + c0.dur * .78; c1.land = c1.t0 + c1.dur * .78; c2.land = st.tM + .22; c3.land = c3.t0 + c3.dur * .72;
    st.cs = [c0, c1, c2, c3];
    st.walk = [[st.tB + .15, -30], ...st.cs.map((c, i) => [c.land, ECO.STATS[i].x])];
    st.tSp = s.len - 1.05; st.tArr = st.tSp + .6;              // spark: hub -> Students, then the push
    // SFX
    cue(s, .02, 'pop', .35, { x: 960 });
    st.nodes.forEach(n => { cue(s, n.t - .04, 'swish', .26, { x: lerp(960, n.p[0], .4) }); cue(s, n.t + .42, 'pop', .42, { x: n.p[0] }); });
    cue(s, st.tAi - .02, 'shine', .5, { x: 960 }); cue(s, st.tAi + .02, 'thump', .3, { x: 960, pitch: 2 });
    cue(s, st.tB, 'slide', .32, { x: 960 }); cue(s, c0.t0, 'roll', .22, { x: 960 });
    st.cs.forEach((c, i) => cue(s, c.land, 'chime', i === 2 ? .28 : i === 3 ? .30 : .30, { x: ECO.STATS[i].x }));
    cue(s, st.tArr, 'tick', .45, { x: 560 }); cue(s, s.len - .3, 'whoosh', .42, { x: 560 });
    // push point for the mentor cut (Students node on screen at the cut)
    ECO_LINK.push = camToScreen(ecoCam(s.len, st), ECO.NODES[0].p[0], ECO.NODES[0].p[1]).map(v => Math.round(v));
    return st;
  },
  bg(lt, st) {
    if (!st || !st.len) return {};
    const c = ecoCam(Math.max(0, lt), st), [hx, hy] = camToScreen(c, ECO.HUB[0], ECO.HUB[1]);
    const bump = sp(lt, st.tAi, { dur: .4, bounce: 0 }) * (1 - sp(lt, st.tAi + .25, { dur: 1.2, bounce: 0 }));
    return { glow: { x: hx, y: hy, r: 900 * c.z, col: '#E9DEFF', alpha: .8 + .2 * bump } };
  },
  draw(lt, st) {
    const c = ecoCam(lt, st), [hx, hy] = ECO.HUB, tAi = st.tAi;
    // focus pull onto Students before the push: everything else dims, then clears through the push window
    const clr = smooth(st.len - .3, st.len + .05, lt), dim = 1 - .3 * smooth(st.len - .45, st.len - .3, lt) - .7 * clr, dimS = 1 - .85 * clr;
    layer(c, .4, () => bokeh(lt, 21, 7, { alpha: .4 * smooth(0, 1.2, lt) * dim, size: 120 }));
    layer(c, 1, () => {
      // contour ripples from the hub on 'ai'
      for (let k = 0; k < 3; k++) {
        const p = seg(lt, tAi + k * .14, 1.2);
        if (p > 0 && p < 1) ring(hx, hy, ECO.HR + 16 + eo(p) * 400, 2.6 * (1 - p) + .6, rgba(k === 1 ? COL.pale : COL.lilac, .6 * (1 - p) * (1 - p * .3)));
      }
      // connectors (path-follow) + flowing data + 'ai' light pulse
      const pulse = seg(lt, tAi + .04, .7);
      st.nodes.forEach(n => {
        const u = sp(lt, n.t - .06, { dur: .72, bounce: 0 }), dd = n.i === 0 ? dimS : dim;
        if (u <= .001) return;
        g.save(); g.globalAlpha *= dd;
        pathDraw(n.L, u, COL.violet, 4);
        if (pulse > 0 && pulse < 1) { const b = eo(pulse); pathDraw(n.L, Math.min(1, b + .07), rgba(COL.pale, .95 * (1 - pulse)), 9, { from: Math.max(0, b - .05) }); pathDraw(n.L, Math.min(1, b + .05), rgba('#FFFFFF', .9 * (1 - pulse)), 3, { from: Math.max(0, b - .03) }); }
        g.restore();
        ecoFlow(n.L, lt, n.t + .55, n.i, dd);
      });
      // nodes travel out from under the hub along their connectors and land
      st.nodes.forEach(n => {
        const u = sp(lt, n.t - .06, { dur: .72, bounce: 0 }); if (u <= .02) return;
        const p = n.L.at(u), s = lerp(.32, 1, sp(lt, n.t - .02, { dur: .7, bounce: .22 }));
        const arr = n.i === 0 ? sp(lt, st.tArr, { dur: .3, bounce: 0 }) * (1 - sp(lt, st.tArr + .12, { dur: .8, bounce: 0 })) : 0;
        const nb = sp(lt, tAi + .5, { dur: .3, bounce: 0 }) * (1 - sp(lt, tAi + .62, { dur: .7, bounce: 0 }));
        const dd = n.i === 0 ? 1 : dim;
        g.save(); g.globalAlpha *= dd;
        if (n.i === 0 && lt > st.tArr - .1) { shock(p.x, p.y, seg(lt, st.tArr, .8), 150, COL.pale, 4); ring(p.x, p.y, ECO.NR + 18, 2, rgba(COL.lilac, .55 * smooth(st.tArr, st.tArr + .3, lt))); }
        ecoNodeDraw(n, p.x, p.y, s * (1 + .08 * arr + .06 * nb), lt, st);
        g.restore();
      });
      // hub: white disc opens behind the mark; violet ring draws on 'ai'
      const bump = sp(lt, tAi, { dur: .32, bounce: 0 }) * (1 - sp(lt, tAi + .16, { dur: .7, bounce: 0 }));
      const hs = 1 + .07 * bump, R = ECO.HR * sp(lt, 0, { dur: .6, bounce: .18 });
      if (dim > .01) tf(hx, hy, hs, 0, () => {
        if (R > 1) {
          softShadow(-R, -R, 2 * R, 2 * R, R, { blur: 44, dy: 14, alpha: .16 * clamp(R / ECO.HR) });
          circle(0, 0, R, COL.paper); ring(0, 0, R, 2, COL.contour);
        }
        const ra = sp(lt, tAi - .04, { dur: .9, bounce: 0 });
        if (ra > .002) { arc(0, 0, ECO.HR + 13, 5, COL.violet, ra, -Math.PI / 2 + lt * .25); ring(0, 0, ECO.HR + 13, 1.5, rgba(COL.violet, .15 * ra)); }
        vectorMark(0, 0, ECO.MH);
      }, dim);
      // labels rise once each node has landed
      st.nodes.forEach(n => {
        g.save(); g.globalAlpha *= dim;
        typeRise(n.label, n.p[0], n.p[1] + ECO.NR + 50, lt, n.t + .3, { size: 38, weight: 700, col: COL.ink });
        g.restore();
      });
      // sparkles bloom round the hub on 'ai'
      ECO.SPARKLES.forEach(([dx, dy, r, alt], i) => {
        const k = sp(lt, tAi + .02 + i * .06, SP.pop) * (1 - smooth(tAi + 1.9, tAi + 2.5, lt));
        if (k <= .01) return;
        const tw = 1 + .16 * Math.sin(lt * 5 + i * 1.7);
        sparkle(hx + dx * (.82 + .18 * k), hy + dy * (.82 + .18 * k), r * k * tw, alt ? COL.lilac : COL.violet, lt * .4 + i);
      });
      // exit: the evidence spark runs from the hub to Students
      const su = eio(seg(lt, st.tSp, .6)), sa = smooth(st.tSp, st.tSp + .12, lt) * (1 - smooth(st.tArr + .05, st.tArr + .3, lt));
      if (sa > .01) sparkAlong(st.nodes[0].L, lerp(ECO.HR / st.nodes[0].L.len, 1 - ECO.NR / st.nodes[0].L.len, su), { trail: .22, w: 5, alpha: sa, s: 1.1 });
    });
    layer(c, .06, () => ecoBand(lt, st, dim));
  }
};
