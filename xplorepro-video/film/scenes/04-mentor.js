/* scenes/04-mentor.js: L06 "Your AI career mentor looks at your resume, LinkedIn and GitHub," (anchors mentor resume linkedin github)
   L07 "and within one week gives you a personal roadmap of your own." (anchors week roadmap)
   Enters with a 'push' into the eco scene's Students node: the student's profile plane starts with the bust exactly on the push
   point and the camera glides it into frame. The mentor orb (violet disc, sparkles + live voice waveform; no robot) springs in
   under the eyebrow; on each anchor a chip pops out of the profile plane, arcs into the orb and dissolves into particles (the orb
   pulses as it absorbs them). On 'week' the evidence spark leaves the orb and the camera tracks along the seven-step journey
   (ui/journey.js) under the heading; the spark visits each step and only the active label shows. On 'roadmap' step 4 blooms into a
   mini action plan; step 5 flashes a generic chat (ui/chat.js), step 6 a voice waveform. End (match cut contract): step 7 grows into
   a white disc r150 with a 6px violet ring centred (960,540), everything else gone, which the readiness gauge picks up. */
const MENTOR = {
  PAL: { skin: '#B97A50', hair: '#1A120D', shirt: '#7438F2', style: 'long' },     // the hook's student
  CARD: { x: 620, y: 556, w: 520, h: 330 },                                        // profile plane (world, centre)
  BUST: { x: 118, y: 165, r: 88 },                                                 // bust inside the card (card-local)
  ORB: [1352, 540], OR: 120,
  FRAME: { x: 944, y: 546, z: 1.15 },                                              // composed camera for the first half
  CHIPS: [
    { key: 'resume', label: 'Resume', icon: 'file-text', dy: -84, bend: -70 },
    { key: 'linkedin', label: 'LinkedIn', icon: 'id-card', dy: 0, bend: 0 },
    { key: 'github', label: 'GitHub', icon: 'code-xml', dy: 84, bend: 70 }
  ],
  NODES: [[1720, 594], [2040, 504], [2360, 590], [2680, 504], [3000, 590], [3320, 504], [3640, 540]],
  JZ: 1.22, END_R: 150, Z0: .8, NR: 50
};
/* piecewise eased keys [[t, v], ...] -> v (held outside) */
function mentorKeys(K, lt, ease = eio) {
  if (lt <= K[0][0]) return K[0][1];
  for (let k = 1; k < K.length; k++) if (lt < K[k][0]) { const a = K[k - 1], b = K[k]; return lerp(a[1], b[1], ease((lt - a[0]) / Math.max(1e-4, b[0] - a[0]))); }
  return K[K.length - 1][1];
}
function mentorCam(lt, st) {
  const T = st.cam, f = clamp((lt - T.t0) / T.dt, 0, T.x.length - 1.001), i = Math.floor(f), u = f - i;
  const c = { x: lerp(T.x[i], T.x[i + 1], u), y: lerp(T.y[i], T.y[i + 1], u), z: lerp(T.z[i], T.z[i + 1], u), rot: 0 };
  const e = smooth(st.len - .66, st.len - .1, lt), N = MENTOR.NODES[6];    // land exactly on step 7 at z 1
  return { x: lerp(c.x, N[0], e), y: lerp(c.y, N[1], e), z: lerp(c.z, 1, e), rot: 0 };
}
/* lens-shaped contour ribbon on path L between u (spark) and rv (furthest revealed step); spread 0 at both ends */
function mentorRibbon(L, u, rv, lt, a) {
  const pts = L.pts, N = pts.length - 1, j0 = Math.max(1, Math.floor(u * N)), j1 = Math.min(N - 1, Math.ceil(rv * N));
  if (j1 - j0 < 4 || a <= .01) return;
  const n = 13, c = (n - 1) / 2, span = rv - u, amp = 13 * smooth(.01, .09, span);
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 1.3;
  for (let i = 0; i < n; i++) {
    const off = i - c; g.beginPath();
    for (let j = j0; j <= j1; j += 3) {
      const k = Math.min(N, j + 1), k0 = Math.max(0, j - 1), dx = pts[k][0] - pts[k0][0], dy = pts[k][1] - pts[k0][1], l = Math.hypot(dx, dy) || 1;
      const v = (j / N - u) / span, sp2 = Math.pow(Math.sin(Math.PI * clamp(v)), .85);
      const d = (off * amp + 5 * Math.sin(v * 9 + lt * 1.8 + i * .45)) * sp2;
      const x = pts[j][0] - dy / l * d, y = pts[j][1] + dx / l * d; j === j0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.strokeStyle = rgba(COL.lilac, a * .5 * (1 - .75 * Math.abs(off) / c)); g.stroke();
  }
  g.restore();
}
function mentorSparkU(lt, st) { return mentorKeys(st.uKeys, lt); }
function mentorOrb(x, y, r, lt, energy, a) {
  if (a <= .01 || r <= 1) return;
  g.save(); g.globalAlpha *= a;
  for (let i = 0; i < 2; i++) ring(x, y, r + 22 + i * 26 + 3 * Math.sin(lt * 2.1 + i * 1.3), 1.5, rgba(COL.violet, .2 - i * .08));
  circle(x, y, r + 22, rgba(COL.violet, .05));
  softShadow(x - r, y - r, 2 * r, 2 * r, r, { blur: r * .7, dy: r * .24, alpha: .3, col: 'rgba(94,39,216,1)' });
  const gr = g.createRadialGradient(x - r * .35, y - r * .45, r * .1, x, y, r * 1.05);
  gr.addColorStop(0, COL.bright); gr.addColorStop(.6, COL.violet); gr.addColorStop(1, COL.deep);
  circle(x, y, r, gr);
  g.beginPath(); g.arc(x, y, r * .84, Math.PI * 1.08, Math.PI * 1.42); g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = r * .07; g.lineCap = 'round'; g.stroke();
  icon('sparkles', x, y - r * .2, r * .62, '#FFFFFF', 2);
  voiceBars(x, y + r * .42, 1, lt, { n: 7, w: 5, gap: 11, h: r * .32, col: 'rgba(255,255,255,.92)', energy, seed: 9, min: .22 });
  g.restore();
}
/* profile plane: unfolds from the bust (which arrives on the push point), content bars draw in */
function mentorCard(lt, st) {
  const C = MENTOR.CARD, B = MENTOR.BUST, w = C.w, h = C.h, x0 = C.x - w / 2, y0 = C.y - h / 2, bx = x0 + B.x, by = y0 + B.y;
  const open = sp(lt, -.02, { dur: .8, bounce: 0 }), p = sp(lt, .3, { dur: .9, bounce: 0 });
  tf(bx, by, lerp(.3, 1, open), 0, () => {
    softShadow(x0 - bx, y0 - by, w, h, 30, { blur: 44, dy: 18, alpha: .15 });
    rrect(x0 - bx, y0 - by, w, h, 30, COL.paper, COL.contour, 2);
    const cx = x0 - bx + 228, cy = y0 - by;
    rrect(cx, cy + 96, 196 * clamp(p * 1.4), 18, 9, COL.ink);
    bars(cx, cy + 138, 240, 2, { h: 13, gap: 28, col: COL.contour, seed: 5, p: clamp(p * 1.2 - .1) });
    [[0, 70], [82, 56], [150, 84]].forEach(([dx, ww], i) => { const k = sp(lt, .45 + i * .06, SP.ui); if (k > .01) rrect(cx + dx, cy + 222, ww * k, 32, 16, i === 0 ? COL.lav : mixHex(COL.lav, COL.paper, .4), i === 0 ? COL.contour : null, 1.5); });
  }, clamp(open * 2.5));
  bust(bx, by, B.r, MENTOR.PAL, COL.lav, lt);
  ring(bx, by, B.r, 4, COL.paper);
  ring(bx, by, B.r + 2, 2.5, rgba(COL.violet, .9 * (1 - smooth(.2, .9, lt))));
}

SC.mentor = {
  cutIn: { type: 'push', pre: .35, post: .35, point: [530, 400] },
  init(s) {
    const st = { len: s.len, start: s.start };
    st.tMn = at(s, 'mentor'); st.tW = at(s, 'week'); st.tRm = at(s, 'roadmap');
    st.chips = MENTOR.CHIPS.map((c, i) => ({ ...c, i, t: at(s, c.key) }));
    // push point handed over by the eco scene (Students node on screen at the cut)
    const P = (typeof ECO_LINK !== 'undefined' && ECO_LINK.push) ? ECO_LINK.push : [530, 400];
    SC.mentor.cutIn.point = P.slice();
    // chip paths: pop out of the profile plane to a staging point, then arc into the orb
    const C = MENTOR.CARD, O = MENTOR.ORB, R = rng(4242);
    st.chips.forEach(c => {
      c.spawn = [C.x + C.w / 2 - 100, C.y + c.dy * .6]; c.stage = [C.x + C.w / 2 + 124, C.y + c.dy * 1.12];
      const mid = [(c.stage[0] + O[0]) / 2, (c.stage[1] + O[1]) / 2 + c.bend - 40];
      c.L = lut([c.stage, mid, O], 120);
      c.tGo = c.t + .26; c.tAbs = c.tGo + .5;
      c.parts = Array.from({ length: 12 }, (_, j) => ({ dx: (R() - .5) * 150, dy: (R() - .5) * 44, d: .26 + R() * .14, lag: R() * .08, r: 3 + R() * 2.4, lil: R() < .4 }));
    });
    // journey: path from the orb through the seven steps; step times are anchored to 'week' / 'roadmap' and the scene end
    st.L = lut([O, ...MENTOR.NODES], 700); st.U = [0, ...MENTOR.NODES.map((_, k) => st.L.d[(k + 1) * 100] / st.L.len)];
    const t = []; t[4] = Math.max(st.tRm - .04, st.tW + 1.15);
    const t7 = Math.max(t[4] + .9, s.len - .95), unit = (t7 - t[4]) / 3.4;
    t[5] = t[4] + 1.4 * unit; t[6] = t[5] + unit; t[7] = t7;
    const a1 = st.tW + .32, a3 = Math.min(st.tW + .95, t[4] - .32);
    t[1] = a1; t[2] = lerp(a1, a3, .5); t[3] = a3; t[0] = st.tW;
    st.t = t;
    st.uKeys = [[st.tW, 0]]; for (let k = 1; k <= 7; k++) { const tr = Math.min(.3, (t[k] - t[k - 1]) * .85); st.uKeys.push([t[k] - tr, st.U[k - 1]], [t[k], st.U[k]]); }
    st.appear = [0, ...[1, 2, 3, 4, 5, 6, 7].map(k => k === 1 ? st.tW - .05 : Math.max(st.tW + .06 * k, t[k] - .85))];
    st.rKeys = [[st.tW - .15, 0]]; for (let k = 1; k <= 7; k++) st.rKeys.push([st.appear[k] + .25, st.U[k]]);
    st.tGrow = s.len - .62;
    st.link = lut([[C.x + C.w / 2 + 16, C.y], [(C.x + C.w / 2 + O[0]) / 2, C.y - 34], [O[0] - MENTOR.OR - 30, O[1]]], 60);
    // camera: critically damped follow of a target (composed frame, then the spark), baked here so draw stays pure
    const F = MENTOR.FRAME, z0 = MENTOR.Z0, Bw = [C.x - C.w / 2 + MENTOR.BUST.x, C.y - C.h / 2 + MENTOR.BUST.y];
    const cam0 = { x: Bw[0] - (P[0] - 960) / z0, y: Bw[1] - (P[1] - 540) / z0, z: z0 };
    const dt = 1 / 240, t0 = -.5, n = Math.ceil((s.len + .6 - t0) / dt);
    const X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n);
    let x = cam0.x, y = cam0.y, z = cam0.z, vx = 0, vy = 0, vz = 0;
    for (let i = 0; i < n; i++) {
      const lt = t0 + i * dt; let tx, ty, tz, dur;
      if (lt < 0) { tx = cam0.x; ty = cam0.y; tz = cam0.z; dur = 1; }
      else if (lt < st.tW + .05) { const d = smooth(0, st.tW, lt); tx = F.x + 16 * d; ty = F.y - 6 * d; tz = F.z + .05 * d; dur = 1.15; }
      else { const u = mentorSparkU(lt + .12, st), p = st.L.at(u); tx = p.x + 120; ty = 428 + (p.y - 550) * .3; tz = MENTOR.JZ; dur = 1.05; }
      const w = TAU / dur;
      vx += (w * w * (tx - x) - 2 * w * vx) * dt; x += vx * dt;
      vy += (w * w * (ty - y) - 2 * w * vy) * dt; y += vy * dt;
      vz += (w * w * (tz - z) - 2 * w * vz) * dt; z += vz * dt;
      X[i] = x; Y[i] = y; Z[i] = z;
    }
    st.cam = { t0, dt, x: X, y: Y, z: Z };
    // SFX
    cue(s, st.tMn - .04, 'pop', .5, { x: 1340 }); cue(s, st.tMn + .02, 'shine', .3, { x: 1340 });
    st.chips.forEach(c => { cue(s, c.t - .1, 'pop', .34, { x: 900 }); cue(s, c.tGo, 'swish', .22, { x: 1100 }); cue(s, c.tAbs + .05, 'suck', .3, { x: 1340 }); });
    cue(s, st.tW, 'whoosh', .38, { x: 1300 });
    [1, 2, 3, 7].forEach(k => cue(s, t[k], 'tick', .34, { x: 960 }));
    cue(s, t[4] + .02, 'slide', .38, { x: 960 }); cue(s, t[5] + .04, 'notify', .32, { x: 960 }); cue(s, t[6] + .04, 'click', .26, { x: 960 });
    cue(s, st.tGrow, 'swish', .3, { x: 960 }); cue(s, s.len - .06, 'thump', .4, { x: 960, pitch: 2 });
    return st;
  },
  draw(lt, st) {
    const c = mentorCam(lt, st), O = MENTOR.ORB, t = st.t, len = st.len;
    const endK = smooth(st.tGrow, len - .2, lt), keep = 1 - endK;                 // everything but step 7 clears for the cut
    const early = 1 - smooth(st.tW + .1, st.tW + .7, lt);                         // profile plane + orb leave as the camera tracks
    layer(c, .35, () => bokeh(lt, 31, 6, { alpha: .35 * keep, size: 120, drift: -20 }));
    layer(c, 1, () => {
      // profile plane
      if (early > .01) { g.save(); g.globalAlpha *= early; mentorCard(lt, st); g.restore(); }
      // dotted link between the plane and the orb
      const orbK = sp(lt, st.tMn - .08, SP.pop);
      if (orbK > .01 && early > .01) {
        g.save(); g.globalAlpha *= early * .9; pathDraw(st.link, eo(seg(lt, st.tMn + .1, .6)), COL.pale, 3, { dash: [1, 12] }); g.restore();
      }
      // chips: pop out of the plane, arc into the orb, dissolve into particles
      let bump = 0;
      st.chips.forEach(ch => {
        const a = sp(lt, ch.t - .12, SP.ui), f = seg(lt, ch.tGo, .5), u2 = eio(f);
        bump = Math.max(bump, sp(lt, ch.tAbs, { dur: .22, bounce: 0 }) * (1 - sp(lt, ch.tAbs + .08, { dur: .6, bounce: 0 })));
        if (a <= .01) return;
        const pos = f <= 0 ? [lerp(ch.spawn[0], ch.stage[0], a), lerp(ch.spawn[1], ch.stage[1], a)] : (q => [q.x, q.y])(ch.L.at(u2));
        const ca = clamp(a * 2) * (1 - smooth(.5, .82, f)), sc = lerp(.55, 1, a) * lerp(1, .5, u2);
        if (ca > .01) tf(pos[0], pos[1], sc, 0, () => chip(ch.label, 0, 0, { size: 30, icon: ch.icon, fill: COL.paper, stroke: COL.contour, col: COL.deep, iconCol: COL.violet, shadow: true }), ca);
        // dissolve
        const t0 = ch.tGo + .26, q0 = ch.L.at(eio(seg(t0, ch.tGo, .5)));
        ch.parts.forEach(pp => {
          const k = seg(lt, t0 + pp.lag, pp.d); if (k <= 0 || k >= 1) return;
          const e = ei(k), x = lerp(q0.x + pp.dx * (1 - .5 * k), O[0], e), y = lerp(q0.y + pp.dy * (1 - .5 * k), O[1], e);
          circle(x, y, pp.r * (1 - .5 * k), rgba(pp.lil ? COL.lilac : COL.violet, clamp(k * 4) * (1 - smooth(.75, 1, k))));
        });
      });
      // the mentor orb
      const orbOut = smooth(t[1] - .1, t[2] + .25, lt), r = MENTOR.OR * orbK * (1 + .07 * bump) * lerp(1, .55, orbOut);
      const energy = .45 + .35 * (.5 + .5 * Math.sin(lt * 1.7)) + .4 * bump;
      if (lt > st.tMn - .1) mentorOrb(O[0], O[1], r, lt, clamp(energy), clamp(orbK * 2) * (1 - orbOut));
      eyebrow('AI Career Mentorship', O[0], O[1] - MENTOR.OR - 84, lt, st.tMn + .08, { size: 26, out: st.tW + .02 });
      // the journey
      const u = mentorSparkU(lt, st), rv = mentorKeys(st.rKeys, lt);
      if (lt > st.tW - .2) {
        // contour ribbon: a lens of thin lines from the spark to the furthest revealed step (the field resolves as the spark passes)
        const ra = keep * smooth(st.tW - .1, st.tW + .5, lt);
        if (ra > .01) mentorRibbon(st.L, u, rv, lt, ra);
        journeyTrack(st.L, u, { reveal: rv, alpha: keep, from: MENTOR.OR / st.L.len });
      }
      for (let k = 1; k <= 7; k++) {
        const N = MENTOR.NODES[k - 1], ap = sp(lt, st.appear[k], SP.pop); if (ap <= .002) continue;
        const nxt = k < 7 ? t[k + 1] : len + 1;
        const vis = smooth(t[k] - .02, t[k] + .12, lt), act = sp(lt, t[k] - .03, SP.ui) * (1 - sp(lt, nxt - .05, { dur: .4, bounce: 0 }));
        if (k < 7) { journeyNode(N[0], N[1], 1, lt, { i: k - 1, r: MENTOR.NR, vis, act, appear: ap, alpha: keep }); continue; }
        // step 7 grows into the contract disc (white, r150, 6px violet ring)
        const gk = eio(seg(lt, st.tGrow, len - .04 - st.tGrow)), r7 = lerp(MENTOR.NR * (1 + .12 * act), MENTOR.END_R, gk);
        journeyNode(N[0], N[1], 1, lt, { i: 6, vis: Math.max(vis, gk), act: Math.max(act, gk), appear: ap, r: r7 / (1 + .12 * Math.max(act, gk)),
          ring: lerp(lerp(lerp(2, 3.5, vis), 6, act), 6, gk), iconAlpha: 1 - smooth(0, .45, gk), halo: gk < .5, shadow: 1 - gk });
      }
      // step blooms: 4 action plan, 5 chat, 6 voice
      const N4 = MENTOR.NODES[3], N5 = MENTOR.NODES[4], N6 = MENTOR.NODES[5];
      const b4 = sp(lt, t[4] + .02, SP.ui) * (1 - sp(lt, t[5] + .02, { dur: .45, bounce: 0 }));
      if (b4 > .01) { line(N4[0], N4[1] - 64, N4[0], N4[1] - 64 - 62 * b4, COL.violet, 3); roadmapPlane(N4[0], lerp(N4[1] - 70, N4[1] - 232, b4), 1, lt, { p: b4, t0: t[4] + .1 }); }
      if (lt > t[5] - .1 && lt < t[6] + .6) {
        const b5 = sp(lt, t[5], SP.ui) * (1 - sp(lt, t[6] + .05, { dur: .4, bounce: 0 }));
        if (b5 > .01) line(N5[0], N5[1] - 64, N5[0], N5[1] - 64 - 26 * b5, COL.violet, 3);
        chat(N5[0], N5[1] - 168, 1, lt, { t0: t[5] + .02, out: t[6] + .02, cw: 330, msgs: [{ side: 'l', tone: 'paper', w: 260, n: 2 }, { side: 'r', tone: 'violet', w: 196, n: 1 }] });
      }
      const b6 = sp(lt, t[6] + .02, SP.ui) * (1 - sp(lt, t[7] + .02, { dur: .4, bounce: 0 }));
      if (b6 > .01) tf(N6[0], lerp(N6[1] - 64, N6[1] - 152, b6), lerp(.5, 1, b6), 0, () => {
        card(-130, -44, 260, 88, 44, { sh: { blur: 24, dy: 10, alpha: .14 } });
        voiceBars(0, 0, 1, lt, { n: 15, w: 6, gap: 14, h: 50, col: COL.violet, energy: .9, seed: 17, min: .18 });
      }, clamp(b6 * 2));
      // the evidence spark rides the journey
      const sa = smooth(st.tW - .05, st.tW + .1, lt) * (1 - smooth(t[7] + .05, t[7] + .35, lt));
      if (sa > .01) sparkAlong(st.L, u, { trail: .05, w: 5, alpha: sa, s: 1.1 });
      // labels on four key steps only; they stay on (earlier ones dimmed) so the journey reads as it builds
      const KEY = [2, 4, 6, 7];
      KEY.forEach((k, j) => {
        const N = MENTOR.NODES[k - 1], nxt = KEY[j + 1], dimmed = nxt && lt > t[nxt] ? .5 : 1;
        typeRise(JOURNEY.labels[k - 1], N[0], N[1] + 104, lt, t[k] + .02, { out: st.tGrow - .02, size: 33, weight: 600, face: 'I', col: COL.ink, alpha: dimmed });
      });
    });
    // heading (screen space)
    layer(c, 0, () => typeRise('One-week discovery journey', 960, 122, lt, st.tW + .14, { out: st.tGrow - .2, size: 46, weight: 700, col: COL.ink }));
  }
};
