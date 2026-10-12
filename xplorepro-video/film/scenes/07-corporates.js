/* scenes/07-corporates.js: L14 "For companies: pre-assessed talent, from source to deploy." (anchors corporates source deploy preassessed)
   L15 "The final decision stays yours." (anchor decision)
   Particles cut from colleges: violet dots stream in from the left in the same band (y 480..600) and condense into candidate discs, the
   first inside the Source node and three queued on the path, while the camera pulls back and the pipeline (ui/pipeline.js) builds: a
   pale dotted track and five stage nodes Source, Assess, Train, Interview, Deploy. On 'source' the Source node lights and the evidence
   spark sweeps the whole path; each label rises as the spark passes and Deploy lights on 'deploy'. Candidates then advance on a measured
   conveyor rhythm (front first, 50ms stagger): each gains a small evidence chip at Assess (the lead's lands on 'preassessed', with the
   heading "Pre-assessed talent") and the solid violet Measured Path is drawn behind the lead (the hook's student) while the camera tracks
   it laterally. The front candidate reaches Interview and is routed back to Train along a dashed arc as the lead moves up: pre-assessed
   is not automatically qualified (neutral routing, no rejection state). On 'decision' a human hiring manager card rises above Interview
   with the chip "Hiring manager decides"; the manager approves, the spark runs down a dotted connector to the lead, and the lead moves to
   Deploy and gets a small verified tick. End (match-cut contract with converge): labels, card and nodes fold into the line left to right,
   the lead collapses into the evidence spark at Deploy and the violet line (width 6) extends to both screen edges at y=540 with the spark
   at screen x 1500 (world 1960 under the exact end camera {1420, 540, 1}). */
const CR = {
  Y: 540, X: [520, 880, 1240, 1600, 1960], Q: [400, 320, 240], X0: -60, V0: 2100,
  LANES: [492, 516, 540, 564, 588],
  LEAD: { skin: '#B97A50', hair: '#1A120D', shirt: '#7438F2', style: 'long' },   // the hook's student
  MGR: { skin: '#E0AC7E', hair: '#5A3A22', shirt: '#2C2745', style: 'crop' },
  CARD: [1600, 300], END: { x: 1420, y: 540, z: 1 },
  HOP: .42, QHOP: .32, EHOP: .38, AHOP: .6, FHOP: .5,
  ARC: [[1600, 540], [1578, 494], [1520, 458], [1420, 446], [1320, 458], [1262, 494], [1240, 540]],
  EYE_Y: 196, HEAD_Y: 258
};
/* cubic Hermite with end velocity 0 (monotone while v0d/dist <= 3) */
const crHerm = (x0, x1, v0d, u) => { const u2 = u * u, u3 = u2 * u; return (2 * u3 - 3 * u2 + 1) * x0 + (u3 - 2 * u2 + u) * v0d + (3 * u2 - 2 * u3) * x1; };
/* incoming particle: enters at the colleges stream speed, decelerates to rest in its slot while easing from its lane onto the path */
function crDotPos(d, t) {
  const u = (t - d.te) / d.d; if (u < 0 || u > 1) return null;
  return [crHerm(CR.X0, d.x1, d.d * CR.V0, u), lerp(d.lane, CR.Y, u * u * (3 - 2 * u))];
}
/* dot with a short motion streak from where it was 4ms ago (same treatment as the outgoing colleges stream) */
function crStreak(p0, p1, r) {
  if (!p0 || Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < .6) { circle(p1[0], p1[1], r, COL.violet); return; }
  g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.strokeStyle = COL.violet; g.lineWidth = 2 * r; g.lineCap = 'round'; g.stroke();
}
/* candidate position: stop-to-stop moves on the path, or along the loop-back arc (au = arc progress, -1 when not on it) */
function crPos(cd, lt, st) {
  let x = cd.x0, y = CR.Y, au = -1;
  for (const m of cd.moves) {
    if (lt < m.t) break;
    const u = pipeGo((lt - m.t) / m.d);
    if (m.arc) { const p = st.arc.at(u); x = p.x; y = p.y; au = u < 1 ? u : -1; } else { x = lerp(m.a, m.b, u); y = CR.Y; au = -1; }
  }
  return { x, y, au };
}
const crNear = x => clamp(Math.round((x - CR.X[0]) / PIPE.GAP), 0, 4);
/* progress of the most recent event in a sorted list (for node pulses) */
function crLatest(lt, ts, d) { let p = 0; for (const t of ts) if (lt >= t) p = seg(lt, t, d); return p; }
/* camera: exact (960,540,1) for lt <= 0; additive critically damped springs (never stops dead); exact end camera for the match cut */
function crCam(lt, st) {
  let x = 960, y = 540, lz = 0;
  for (const m of st.moves) { const p = spring(lt - m.t, m.d, 0); x += m.x * p; y += m.y * p; lz += m.z * p; }
  const d = smooth(0, 1, lt) * (1 - smooth(st.L - 1.1, st.L - .25, lt));
  x += d * 5 * noise1(lt * .33, 31); y += d * 3.5 * noise1(lt * .29, 37);
  const b = eio(seg(lt, st.tEndCam, st.L - .05 - st.tEndCam));
  return { x: lerp(x, CR.END.x, b), y: lerp(y, CR.END.y, b), z: Math.exp(lerp(lz, 0, b)), rot: 0 };
}

SC.corporates = {
  cutIn: { type: 'particles', pre: .3, post: .3 },

  init(s) {
    const L = s.len, st = { L };
    const tC = at(s, 'corporates'), tS = at(s, 'source'), tY = Math.max(at(s, 'deploy'), tS + .4), tP = at(s, 'preassessed'), tD = at(s, 'decision');
    Object.assign(st, { tC, tS, tY, tP, tD });
    const HP = CR.HOP, QH = CR.QHOP, EH = CR.EHOP;
    // conveyor pulses (each candidate advances one stage; front first, 50ms stagger)
    st.pA = tS + .1;
    st.pB = Math.max(tP - .48, st.pA + .05 + EH + .3);
    st.pC = Math.max(tP + .32, st.pB + .05 + HP + .28);
    st.pD = Math.max(st.pC + .05 + HP + .2, tD - .42);
    // decision beats, compressed when the VO leaves too little room before the end
    let dA = .42, dDep = .26, fh = CR.FHOP;
    const need = dA + dDep + fh, avail = L - 1.0 - tD;
    if (avail < need) { const k = Math.max(.6, avail / need); dA *= k; dDep *= k; fh *= k; }
    st.tA = Math.max(tD + dA, st.pD + .05 + HP + .12);
    st.tDep = st.tA + dDep; st.tArr = st.tDep + fh;
    st.tE0 = Math.max(st.tArr + .3, L - .85); st.ED = Math.max(.4, L - .1 - st.tE0);
    st.tCard = tD - .05; st.tCardOut = st.tArr - .05; st.tTitleOut = tD - .42; st.tEndCam = st.tA - .25;
    // candidates: 0 = front (routed back to Train), 1 = lead, 2 and 3 = followers
    const mv = (t, a, b, d) => ({ t, a, b, d }), X = CR.X, Q = CR.Q;
    st.cands = [
      { x0: X[0], pal: 2, r: PIPE.CR, seed: 2, moves: [mv(st.pA, X[0], X[1], HP), mv(st.pB, X[1], X[2], HP), mv(st.pC, X[2], X[3], HP), { t: st.pD, d: CR.AHOP, arc: true }] },
      { x0: Q[0], pal: CR.LEAD, r: PIPE.LEADR, seed: 5, lead: true, moves: [mv(st.pA + .05, Q[0], X[0], EH), mv(st.pB + .05, X[0], X[1], HP), mv(st.pC + .05, X[1], X[2], HP), mv(st.pD + .05, X[2], X[3], HP), mv(st.tDep, X[3], X[4], fh)] },
      { x0: Q[1], pal: 4, r: PIPE.CR, seed: 7, moves: [mv(st.pA + .1, Q[1], Q[0], QH), mv(st.pB + .1, Q[0], X[0], EH), mv(st.pC + .1, X[0], X[1], HP)] },
      { x0: Q[2], pal: 1, r: PIPE.CR, seed: 9, moves: [mv(st.pA + .15, Q[2], Q[1], QH), mv(st.pB + .15, Q[1], Q[0], QH), mv(st.pC + .15, Q[0], X[0], EH)] }
    ];
    st.cands[0].chipT = st.pA + HP + .02;
    st.cands[1].chipT = st.pB + .05 + HP + .02;
    st.cands[2].chipT = st.pC + .1 + HP + .02;
    // incoming particles: 5 per candidate, farthest slot first, spread over the colleges lanes
    const R = rng(707);
    st.dots = [];
    st.cands.forEach((cd, k) => {
      cd.dots = [];
      for (let n = 0; n < 5; n++) {
        const j = k * 5 + n, te = -.28 + .034 * j + (R() - .5) * .012, dist = cd.x0 - CR.X0;
        const d = Math.min(Math.max(.22, 1.4 * dist / CR.V0), 2.6 * dist / CR.V0);
        cd.dots.push(st.dots.length);
        st.dots.push({ te, d, ta: te + d, x1: cd.x0, lane: CR.LANES[(j * 2 + k) % 5] });
      }
      cd.tPop = Math.max(...cd.dots.map(j => st.dots[j].ta)) + .05;
    });
    // stages: labels rise as the sweeping spark passes each node (inverse of the eio sweep)
    const inv = u => (u < .5 ? Math.cbrt(u / 4) : 1 - Math.cbrt((1 - u) / 4));
    st.tLab = [0, 1, 2, 3, 4].map(i => tS + (tY - tS) * inv(i / 4));
    st.tNode = [0, 1, 2, 3, 4].map(i => .08 + .07 * i);
    st.tLabOut = [0, 1, 2, 3, 4].map(i => st.tE0 - .24 + .045 * i);
    st.sweep = lut([[X[0], CR.Y], [X[4], CR.Y]], 160);
    st.arc = lut(CR.ARC, 160);
    st.pulses = [[tS], [st.tLab[1], st.cands[0].chipT - .02, st.cands[1].chipT - .02, st.cands[2].chipT - .02],
      [st.tLab[2], st.pD + CR.AHOP], [st.tLab[3], st.tA + .24], [tY, st.tArr]].map(a => a.sort((p, q) => p - q));
    // contour phase continuity with colleges
    st.phase0 = 0;
    try { const prev = SCN[s.i - 1]; if (prev && prev.def && prev.def.bg) { const b = prev.def.bg(prev.len, prev.st) || {}; st.phase0 = (b.contours && b.contours.phase) || 0; } } catch (e) { st.phase0 = 0; }
    // camera (additive springs): pull back, lean with the sweep, track the lead on each pulse, tilt up for the manager card
    const ln = Math.log;
    st.moves = [
      { t: .02, d: 1.5, x: 100, y: -6, z: ln(.86) },
      { t: tS - .05, d: 1.3, x: 40, y: 0, z: 0 },
      { t: st.pB, d: 1.15, x: 100, y: -14, z: ln(.93 / .86) },
      { t: st.pC, d: 1.15, x: 110, y: 0, z: ln(1 / .93) },
      { t: st.pD, d: 1.25, x: 70, y: -66, z: ln(1.06) }
    ];
    // SFX (<= ~4/sec), panned to where things land
    const sx = (t, wx) => camToScreen(crCam(t, st), wx, CR.Y)[0];
    cue(s, -.18, 'swish', .26, { x: 260 });
    cue(s, .08, 'slide', .18, { x: 960 });
    cue(s, st.cands[0].tPop, 'pop', .3, { x: sx(st.cands[0].tPop, X[0]) });
    cue(s, tS, 'shine', .28, { x: sx(tS, X[0]) });
    cue(s, tS + .06, 'whoosh', .24, { x: sx(tS + .3, X[2]) });
    cue(s, st.cands[0].chipT, 'tick', .2, { x: sx(st.cands[0].chipT, X[1]) });
    cue(s, tY, 'chime', .26, { x: sx(tY, X[4]) });
    cue(s, tP - .06, 'slide', .16, { x: 960 });
    cue(s, st.cands[1].chipT, 'pop', .28, { x: sx(st.cands[1].chipT, X[1]) });
    cue(s, st.cands[2].chipT, 'tick', .16, { x: sx(st.cands[2].chipT, X[1]) });
    cue(s, st.pD, 'reverse', .2, { x: sx(st.pD, 1420) });
    cue(s, st.tCard, 'review', .4, { x: sx(st.tCard, X[3]) });
    cue(s, st.tA, 'click', .36, { x: sx(st.tA, X[3]) });
    cue(s, st.tDep, 'swish', .3, { x: sx(st.tDep + .2, 1780) });
    cue(s, st.tArr + .04, 'chime', .3, { x: sx(st.tArr, X[4]) });
    cue(s, st.tE0 + .42 * st.ED, 'suck', .3, { x: 1500 });
    return st;
  },

  bg(lt, st) {
    if (!st || !st.moves) return {};
    const c = crCam(lt, st);
    return { contours: { phase: st.phase0 + .0021 * .3 * (c.x - 960) } };
  },

  draw(lt, st) {
    const c = crCam(lt, st), Y = CR.Y;
    const eN = (lt - st.tE0) / st.ED, endW = (a, b) => eio(clamp((eN - a) / (b - a)));
    const bk = smooth(0, 1, lt) * (1 - endW(0, .7));
    if (bk > .01) layer(c, .4, () => bokeh(lt, 91, 5, { alpha: .24 * bk, size: 120 }));
    // candidate state (pure functions of lt)
    const S = st.cands.map(cd => {
      const p = crPos(cd, lt, st);
      const blob = cd.dots.reduce((a, j, n) => a + (n ? 3.4 : 10) * sp(lt, st.dots[j].ta, SP.ui), 0);
      const morph = sp(lt, cd.tPop, SP.pop), ni = crNear(p.x);
      const col = cd.lead ? endW(.42, .8) : endW(.07 * ni, .07 * ni + .45);
      return { x: p.x, y: p.y, au: p.au, blob, morph, col, pres: clamp(blob / 10 + morph) * (1 - col) };
    });
    const lead = S[1], c1 = S[0];

    g.save(); applyCam(c);
    // track, loop-back route, the lead's measured path (extends to the screen edges at the end)
    const ext = endW(.1, 1);
    pipeTrack(Y, -300, 2500, { reveal: eio(seg(lt, -.1, .85)), alpha: 1 - endW(.1, .7) });
    if (lt > st.pD - .22 && lt < st.pD + CR.AHOP + .05) {
      const head = eo(seg(lt, st.pD - .22, .36)), tail = c1.au >= 0 ? c1.au : (lt < st.pD ? 0 : 1);
      if (head > tail + .005) pathDraw(st.arc, head, COL.pale, 3, { from: tail, dash: [.5, 10] });
      if (c1.au > 0) { g.save(); g.globalAlpha *= .5; pathDraw(st.arc, c1.au, COL.lilac, 3.5, { from: Math.max(0, c1.au - .2) }); g.restore(); }
    }
    if (lead.x > CR.X[0] + .5 || ext > 0) {
      const wl = c.x - (W / 2 + 40) / c.z, wr = c.x + (W / 2 + 40) / c.z;
      pipePath(Y, lerp(CR.X[0], wl, ext), lerp(Math.max(CR.X[0], lead.x), wr, ext), { w: lerp(5, 6, ext) });
    }
    // evidence spark sweeps Source -> Deploy between 'source' and 'deploy'
    const su = seg(lt, st.tS, st.tY - st.tS);
    if (su > 0 && lt < st.tY + .3) sparkAlong(st.sweep, eio(su), { trail: .16, w: 5, alpha: 1 - seg(lt, st.tY, .3) });
    // stage nodes + labels
    for (let i = 0; i < 5; i++) {
      const nx = CR.X[i];
      let occ = 0;
      for (const p of S) occ = Math.max(occ, p.pres * (1 - clamp(Math.hypot(p.x - nx, p.y - Y) / 50)));
      const colI = i < 4 ? endW(.07 * i, .07 * i + .45) : endW(.42, .85);
      const hl = i === 0 ? spInOut(lt, st.tS - .04, st.tS + .9) : i === 3 ? spInOut(lt, st.tD - .05, st.tDep + .15)
        : i === 4 ? Math.max(spInOut(lt, st.tY - .04, st.tY + .8), sp(lt, st.tArr - .04, SP.ui)) : 0;
      pipeStage(nx, Y, 1, lt, i, { appear: sp(lt, st.tNode[i], SP.ui) * (1 - colI), vis: smooth(st.tLab[i] - .03, st.tLab[i] + .12, lt),
        act: Math.max(hl, .7 * occ), occ, pulse: colI > 0 ? 0 : crLatest(lt, st.pulses[i], .6) });
      if (lt < st.L - .15) pipeLabel(i, nx, Y + PIPE.LY, lt, st.tLab[i], { out: st.tLabOut[i] });
    }
    // the human hiring manager decides (card above Interview, dotted connector down to the node)
    const pc = sp(lt, st.tCard, SP.soft), qc = spring(lt - st.tCardOut, .5, 0);
    if (pc > .002 && qc < .999) {
      const cx = CR.CARD[0], cy = CR.CARD[1] + (1 - pc) * 34 - qc * 30, al = 1 - qc, y0 = cy + PIPE.CH / 2 + 4, y1 = Y - PIPE.R - 6;
      const cn = eio(seg(lt, st.tD + .22, .26));
      if (cn > 0) { g.save(); g.globalAlpha *= al; line(cx, y0, cx, y1, COL.pale, 3, cn, [.5, 10]); g.restore(); }
      managerCard(cx, cy, 1, lt, { p: pc, press: seg(lt, st.tA - .06, .3), done: seg(lt, st.tA, .55), pal: CR.MGR, alpha: al });
      pipeChip('Hiring manager decides', cx, cy - PIPE.CH / 2 - PIPE.CHIPY, lt, st.tD + .16, { size: 28, fill: COL.ink, col: '#fff', icon: 'user-check', iconCol: '#fff', shadow: true, out: st.tCardOut });
      const su2 = seg(lt, st.tA + .04, .2);
      if (su2 > 0 && su2 < 1) spark(cx, lerp(y0, y1 + 6, eio(su2)), .85, al);
    }
    // incoming particles, then candidates (lead last)
    for (const d of st.dots) {
      if (lt < d.te || lt >= d.ta) continue;
      const u = (lt - d.te) / d.d;
      crStreak(crDotPos(d, lt - .004), crDotPos(d, lt), lerp(9, 6.5, smooth(.7, 1, u)));
    }
    for (const k of [3, 2, 0, 1]) {
      const cd = st.cands[k], p = S[k], sc = 1 - p.col;
      if (sc <= .002) continue;
      pipeCandidate(p.x, p.y, sc, lt, { r: cd.r, pal: cd.pal, lead: !!cd.lead, seed: cd.seed, morph: p.morph, blob: p.blob,
        chip: cd.chipT ? sp(lt, cd.chipT, SP.pop) : 0,
        tick: cd.lead ? sp(lt, st.tArr + .04, SP.pop) : 0,
        train: k === 0 ? .72 * eo(seg(lt, st.pD + CR.AHOP, 1.6)) : 0,
        flash: cd.lead ? seg(lt, st.tA + .24, .5) : 0 });
    }
    // end: the lead becomes the evidence spark at Deploy (screen 1500,540 under the end camera)
    const es = endW(.45, .9);
    if (es > 0) spark(CR.X[4], Y, es);
    g.restore();

    if (bk > .01) layer(c, 1.3, () => { for (let k = 0; k < 2; k++) { g.save(); g.translate(k * W, 0); bokeh(lt, 57 + k * 13, 3, { alpha: .2 * bk, size: 240 }); g.restore(); } });
    // title block (screen space)
    eyebrow('Corporates', 960, CR.EYE_Y, lt, st.tC + .06, { out: st.tTitleOut });
    typeRise('Pre-assessed talent', 960, CR.HEAD_Y, lt, st.tP - .06, { size: 56, weight: 700, col: COL.ink, out: st.tTitleOut + .04 });
  }
};
