/* scenes/06-colleges.js: L11 "For colleges: AI-proctored assessments." (anchors colleges proctored assessments)
   L12 "A flag is not a verdict; it is evidence a person reviews." (anchors flag verdict human evidence)
   L13 "The whole batch's readiness, on one dashboard." (anchors batch dashboard)
   Match cut from the readiness contract card (white 360x240, r20, mini interview layout at 960,540): the card is one tile of a 6x4 wall of
   abstract assessment screens; the camera pulls back while the wall ripples in around it, eyebrow "AI-Proctored Assessments". On
   'assessments' four chips (Aptitude, Technical, Coding, Communication) slide in along a hairline and their tiles pulse. The wall then
   collapses tile by tile into violet dots that burst and re-form as five hairline integrity rows (ui/integrity.js) as the camera pushes in.
   On 'flag' one row lifts, two neutral signals turn amber and an amber "Flag for review" pill grows out of it; the camera pans to a human
   reviewer card and a dotted connector carries the evidence spark into the reviewer's evidence timeline. On 'human' the badge above the
   reviewer widens into an ink "Human review" chip; on 'evidence' the playhead scrubs the timeline, pausing on the amber segments while the
   reviewer's eyes follow. No verdict, no rejection. On 'batch' everything bursts into particles that converge on one shared plane that
   stands up into the cohort dashboard (ui/cohort.js): readiness ring 0 -> 68, five department bars on springs, the skill-gap trend drawn
   with the spark, a training ring; slow push-in. End (particles contract): the bars peel into violet dots (r9) that stream right in five
   lanes inside y 480..600 while the plane fades. */
const CG = {
  TW: 360, TH: 240, GX: 396, GY: 276, COLS: 6, ROWS: 4, HERO: [2, 1],
  KINDS: ['mcq', 'tech', 'code', 'comm'],
  ROWX: 600, ROWY: [316, 428, 540, 652, 764], FLAG: 2,
  ROWPAL: [2, 0, 4, 1, 5], ROWSUB: [.82, .66, .58, .74, .5],
  REV: [1640, 540], RS: 1.1, DASH: [1020, 560],
  REVPAL: { skin: '#8D5A3B', hair: '#1A120D', shirt: '#2C2745', style: 'bun' },
  STU: { skin: '#B97A50', hair: '#1A120D', shirt: '#7438F2', style: 'long' },
  CHIPS: [['Aptitude', 'puzzle'], ['Technical', 'layers'], ['Coding', 'code-xml'], ['Communication', 'audio-lines']],
  CHIP_Y: 968, EYE_Y: 104, PILL: 28,
  LANES: [492, 516, 540, 564, 588], MARKS: [[.33, .41], [.67, .75]]
};
const cgTilePos = (c, r) => [960 + (c - 2.5) * CG.GX, 540 + (r - 1.5) * CG.GY];
const cgRowY = j => CG.ROWY[j];
/* piecewise eased keys [[t, v], ...] (held outside) */
function cgKeys(K, lt, ease = eio) {
  if (lt <= K[0][0]) return K[0][1];
  for (let k = 1; k < K.length; k++) if (lt < K[k][0]) { const a = K[k - 1], b = K[k]; return lerp(a[1], b[1], ease((lt - a[0]) / Math.max(1e-4, b[0] - a[0]))); }
  return K[K.length - 1][1];
}
/* additive spring camera: every move is a critically damped spring added on top of the last, so the camera never stops dead */
function cgCam(lt, st) {
  let x = 762, y = 402, lz = 0;
  for (const m of st.moves) { const p = spring(lt - m.t, m.d, 0); x += m.x * p; y += m.y * p; lz += m.z * p; }
  const d = smooth(0, 1.2, lt);
  return { x: x + d * 5 * noise1(lt * .33, 21), y: y + d * 3.5 * noise1(lt * .29, 23), z: Math.exp(lz), rot: 0 };
}
/* quadratic bezier point */
const cgQ = (a, b, c, u) => { const v = 1 - u; return [v * v * a[0] + 2 * v * u * b[0] + u * u * c[0], v * v * a[1] + 2 * v * u * b[1] + u * u * c[1]]; };
/* cubic bezier point */
const cgC = (a, b, c, d, u) => { const v = 1 - u; return [v * v * v * a[0] + 3 * v * v * u * b[0] + 3 * v * u * u * c[0] + u * u * u * d[0], v * v * v * a[1] + 3 * v * v * u * b[1] + 3 * v * u * u * c[1] + u * u * u * d[1]]; };
/* dot with a short motion streak from where it was 4ms ago (keeps fast particles continuous under the engine's sample blur) */
function cgDot(p0, p1, r, col) {
  if (!p0 || Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < .6) { circle(p1[0], p1[1], r, col); return; }
  g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.strokeStyle = col; g.lineWidth = 2 * r; g.lineCap = 'round'; g.stroke();
}
const CG_DT = .004;
/* half ease-in-out, half ease-out: leaves at average speed (no hang, no whip), lands softly */
const cgEase = u => .5 * eio(u) + .5 * (1 - (1 - clamp(u)) * (1 - clamp(u)));
/* particle paths (null outside their flight) */
function cgPA(q, t) { const u = (t - q.t0) / q.d; return u < 0 || u >= 1 ? null : cgQ(q.s, q.c, q.e, cgEase(u)); }
function cgPB(q, t) { const u = (t - q.t0) / q.d; return u < 0 || u >= 1 ? null : cgC(q.s, q.b, q.c, q.e, cgEase(u)); }
function cgPD(d, t) { const tau = t - d.tr; return tau < 0 ? null : [d.sx + 2200 * (tau - .3 * (1 - Math.exp(-tau / .3))), lerp(d.sy, CG.LANES[d.i], eo(clamp(tau / .32)))]; }
/* reviewer card position (slides in from the right) */
function cgRevPos(lt, st) { const p = sp(lt, st.tRev, SP.soft); return { x: CG.REV[0] + (1 - p) * 220, y: CG.REV[1], p }; }
function cgPillX() { return CG.ROWX + INTEG.W / 2 + 70; }
/* connector from the flag pill to the reviewer's evidence strip (world) */
function cgConnector(lt, st) {
  const rv = cgRevPos(lt, st), [ix, iy] = reviewerStripIn(), ex = rv.x + ix * CG.RS, ey = rv.y + iy * CG.RS;
  const pillW = textWidth('Flag for review', CG.PILL, 600, 'I') + 40 + CG.PILL * 1.9 * .62;
  const sx = cgPillX() - CG.PILL * 1.9 / 2 + pillW + 14, sy = cgRowY(CG.FLAG);
  return lut([[sx, sy], [sx + 52, sy + 4], [lerp(sx, ex, .62), lerp(sy, ey, .55)], [ex - 34, ey], [ex, ey]], 90);
}

/* one abstract assessment screen, 360x240 local, centred at x,y. e = collapse 0..1 (tile -> violet dot) */
function cgTile(x, y, lt, kind, seed, o = {}) {
  const e = clamp(o.e || 0), k = lerp(1, 22 / CG.TH, eio(e)), h = CG.TH * k, w = CG.TW * k * lerp(1, CG.TH / CG.TW, smooth(.5, 1, e)), a = o.alpha === undefined ? 1 : o.alpha;
  const r = lerp(20 * k, h / 2, smooth(.35, 1, e));
  if (a <= .01) return;
  g.save(); g.globalAlpha *= a;
  const sh = (o.shadow === undefined ? 1 : o.shadow) * (1 - e);
  if (sh > .01) softShadow(x - w / 2, y - h / 2, w, h, r, { blur: 30, dy: 10, alpha: .12 * sh });
  const hi = clamp(o.hi || 0);
  rrect(x - w / 2, y - h / 2, w, h, r, mix(COL.paper, COL.violet, smooth(.45, .95, e)), mix(COL.contour, COL.violet, Math.max(hi, smooth(.3, .8, e))), 2 + 1.5 * hi);
  const ca = (1 - smooth(.15, .6, e)) * clamp(o.content === undefined ? 1 : o.content);
  if (ca > .01) {
    g.save(); g.globalAlpha *= ca; g.translate(x, y); if (e > 0) g.scale(k, k);
    if (e > 0) { g.beginPath(); g.roundRect(-w / k / 2, -CG.TH / 2, w / k, CG.TH, r / k); g.clip(); }
    const R = rng(seed * 13 + 5), prog = (lt * (.06 + R() * .05) + R()) % 1, cp = clamp(o.build === undefined ? 1 : o.build);
    // header: candidate thumbnail, abstract ID, live timer ring
    bust(-138, -82, 22, (seed % 3 === 0 ? 1 : seed % 3 === 1 ? 2 : 4), COL.lav, lt, { seed });
    rrect(-104, -93, 88 * eo(cp), 10, 5, COL.navy); rrect(-104, -75, 56 * eo(cp), 8, 4, COL.contour);
    circle(-120, -66, 4, COL.violet);
    ring(142, -82, 14, 4, COL.lav); arc(142, -82, 14, 4, COL.violet, prog);
    line(-160, -50, -160 + 320 * eo(cp), -50, COL.contour, 1.5);
    // body
    if (kind === 'mcq') {
      bars(-156, -36, 300, 2, { h: 10, gap: 18, col: COL.contour, p: cp, seed: seed + 3 });
      const sel = Math.floor((lt * .55 + R() * 4)) % 4;
      for (let i = 0; i < 4; i++) {
        const ox = i % 2 ? 82 : -82, oy = i < 2 ? 24 : 62, on = i === sel, op = eo(clamp(cp * 3 - i * .4));
        if (op <= .01) continue;
        rrect(ox - 74 * op, oy - 14, 148 * op, 28, 14, on ? COL.violet : COL.lav);
        circle(ox - 56, oy, 6, COL.paper);
        rrect(ox - 40, oy - 4, 70, 8, 4, on ? 'rgba(255,255,255,.7)' : COL.contour);
      }
    } else if (kind === 'code') {
      rrect(-160, -38, 320, 114, 12, mix(COL.lav, COL.paper, .3));
      const toks = [[['violet', 46], ['navy', 70], ['pale', 64]], [['pale', 40], ['violet', 34], ['contour', 110]], [['amber', 28], ['contour', 84], ['pale', 60]], [['violet', 40], ['contour', 120]]];
      const rev = ((lt * .9 + R() * 3) % 4.6) * 3.2 * cp;
      let idx = 0, cx = -144, cy = -18;
      toks.forEach((ln, li) => {
        let tx = -144 + (li % 3 === 2 ? 26 : li ? 12 : 0); const ly = -18 + li * 26;
        ln.forEach(([col, tw]) => { const k = clamp(rev - idx); idx++; if (k > 0) { rrect(tx, ly - 6, Math.max(12, tw * eo(k)), 12, 6, COL[col]); cx = tx + tw * eo(k) + 8; cy = ly; } tx += tw + 10; });
      });
      if (Math.sin(lt * 10 + seed) > -.2) rrect(cx, cy - 10, 3, 20, 1.5, COL.violet);
    } else if (kind === 'comm') {
      circle(-118, 14, 26, COL.violet); icon('mic', -118, 14, 26, '#FFFFFF', 2.2);
      if (typeof ivWave === 'function') ivWave(30, 14, 15, 6, 13, 56 * cp, COL.violet, lt * .4, .55 + .45 * Math.sin(lt * 1.3 + seed), seed);
      rrect(-156, 60, 200 * eo(cp), 8, 4, COL.contour);
    } else {
      const N = [[-112, 14], [0, -14], [0, 42], [112, 14]];
      [[0, 1], [0, 2], [1, 3], [2, 3]].forEach(([i, j], k) => { const pe = eo(clamp(cp * 2 - k * .2)); if (pe > 0) line(N[i][0] + 34, N[i][1], lerp(N[i][0] + 34, N[j][0] - 34, pe), lerp(N[i][1], N[j][1], pe), k % 3 ? COL.contour : COL.violet, k % 3 ? 2 : 2.5); });
      const on = Math.floor(lt * .7 + seed) % 4;
      N.forEach(([nx, ny], i) => { rrect(nx - 34, ny - 13, 68, 26, 13, COL.paper, i === on ? COL.violet : COL.contour, i === on ? 2.5 : 1.8); rrect(nx - 18, ny - 4, 36, 8, 4, i === on ? COL.pale : COL.contour); });
    }
    // footer: progress
    rrect(-156, 92, 312, 8, 4, COL.lav);
    rrect(-156, 92, Math.max(8, 312 * (.25 + .6 * ((prog * .3 + R() * .7) % 1)) * eo(cp)), 8, 4, COL.pale);
    g.restore();
  }
  g.restore();
}

SC.colleges = {
  cutIn: { type: 'match' },
  init(s) {
    const st = { len: s.len };
    st.tCol = at(s, 'colleges'); st.tPro = at(s, 'proctored'); st.tAss = at(s, 'assessments');
    st.tFlag = at(s, 'flag'); st.tVer = at(s, 'verdict'); st.tHum = at(s, 'human'); st.tEvi = at(s, 'evidence');
    st.tBat = at(s, 'batch'); st.tDash = at(s, 'dashboard');
    st.tEye = Math.min(st.tCol + .32, st.tPro - .1);
    st.tChips = st.tAss - .14;
    st.tReorg = Math.max(st.tChips + .22, st.tFlag - .88);
    st.tChipOut = st.tFlag + .3;
    st.tPill = st.tFlag + .14;
    st.tRev = st.tFlag + .26;
    st.tConn = Math.max(st.tPill + .34, st.tVer - .12);
    st.tSpark = st.tConn + .22;
    st.tStrip = st.tSpark + .42;
    st.tScrub = Math.max(st.tStrip + .5, st.tEvi - .14);
    st.scrubD = Math.max(.6, Math.min(1.05, st.tBat - .14 - st.tScrub));
    const sd = st.scrubD, t0 = st.tScrub;
    st.scrubK = [[t0, 0], [t0 + sd * .3, .4], [t0 + sd * .42, .42], [t0 + sd * .7, .75], [t0 + sd * .82, .77], [t0 + sd, .98]];
    st.tBurst = st.tBat - .05;
    st.tPlane = st.tBat + .28;
    st.tRing = st.tBat + .36; st.tBars = st.tBat + .56; st.tTrend = st.tBat + .7; st.tTrain = st.tBat + .82;
    st.tLabel = st.tBat + .5; st.tDept = st.tBat + .66;
    st.tDis = s.len - .8;
    // continuity with the previous scene: its local clock (for the card's live parts) and its contour phase
    const prev = SCN[s.i - 1];
    st.prevLen = prev ? prev.len : 0; st.phase0 = 0;
    try { if (prev && prev.def && prev.def.bg) { const b = prev.def.bg(prev.len, prev.st) || {}; st.phase0 = (b.contours && b.contours.phase) || 0; } } catch (e) { st.phase0 = 0; }
    // camera moves (additive springs)
    const ln = Math.log;
    st.moves = [
      { t: 0, d: 1.7, x: 198, y: 150, z: ln(.64) },
      { t: 1.7, d: 2.4, x: -6, y: -4, z: ln(1.03) },
      { t: st.tReorg - .05, d: 1.25, x: -74, y: -8, z: ln(.98 / .66) },
      { t: st.tFlag + .12, d: 1.3, x: 150, y: 0, z: ln(1.0 / .98) },
      { t: st.tFlag + 1.0, d: Math.max(2, st.tBat - st.tFlag), x: 20, y: -2, z: ln(1.03) },
      { t: st.tBat - .1, d: 1.1, x: -40, y: 14, z: ln(.97 / 1.03) },
      { t: st.tBat + .7, d: 3.2, x: 18, y: -4, z: ln(1.075) }
    ];
    // wall of tiles (ripple in from the hero, collapse inner-first)
    const R = rng(611);
    st.tiles = [];
    for (let r = 0; r < CG.ROWS; r++) for (let c = 0; c < CG.COLS; c++) {
      const [x, y] = cgTilePos(c, r), hero = c === CG.HERO[0] && r === CG.HERO[1], d = Math.hypot(c - CG.HERO[0], r - CG.HERO[1]);
      st.tiles.push({ c, r, x, y, hero, kind: CG.KINDS[(c + 2 * r) % 4], seed: 3 + c * 7 + r * 11, tIn: hero ? -1 : .06 + d * .075, dc: Math.hypot(c - 2.5, r - 1.5) });
    }
    const order = st.tiles.map((t, i) => i).sort((a, b) => st.tiles[a].dc - st.tiles[b].dc);
    order.forEach((i, k) => { st.tiles[i].tc = st.tReorg + .2 * k / (order.length - 1); });
    // reorg particles: each tile bursts into 5 dots that settle on the row elements
    const targets = [];
    for (let j = 0; j < 5; j++) for (let k = 0; k < 10; k++) { const [tx, ty] = integrityTarget(k); targets.push([CG.ROWX + tx, cgRowY(j) + ty]); }
    for (let i = targets.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [targets[i], targets[j]] = [targets[j], targets[i]]; }
    st.pa = [];
    st.tiles.forEach((t, i) => {
      for (let k = 0; k < 5; k++) {
        const tg = targets[(i * 5 + k) % targets.length], s0 = [t.x + (R() - .5) * 16, t.y + (R() - .5) * 16];
        const mx = (s0[0] + tg[0]) / 2, my = (s0[1] + tg[1]) / 2, dx = tg[0] - s0[0], dy = tg[1] - s0[1], l = Math.hypot(dx, dy) || 1, bend = (R() - .5) * .5 * l;
        st.pa.push({ s: s0, c: [mx - dy / l * bend, my + dx / l * bend], e: tg, t0: t.tc + .21 + k * .014, d: .56 + R() * .08, r: 6.5 + R() * 3, col: R() < .72 ? COL.violet : COL.lilac });
      }
    });
    // burst particles: rows + reviewer -> dashboard
    const src = [];
    for (let j = 0; j < 5; j++) for (let k = 0; k < 10; k++) { const [tx, ty] = integrityTarget(k); src.push([CG.ROWX + tx, cgRowY(j) + ty]); }
    for (let k = 0; k < 16; k++) src.push([CG.REV[0] + (R() - .5) * 400, CG.REV[1] + (R() - .5) * 520]);
    for (let k = 0; k < 4; k++) src.push([cgPillX() + k * 60, cgRowY(CG.FLAG)]);
    const dst = cohortPoints().map(([x, y]) => [CG.DASH[0] + x, CG.DASH[1] + y]);
    for (let i = dst.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [dst[i], dst[j]] = [dst[j], dst[i]]; }
    st.pb = [];
    src.forEach((s0, i) => {
      for (let k = 0; k < 2; k++) {
        const tg = dst[(i * 2 + k) % dst.length], a = R() * TAU, bd = 120 + R() * 160, b0 = [s0[0] + Math.cos(a) * bd, s0[1] + Math.sin(a) * bd - 40];
        const c0 = [tg[0] + (R() - .5) * 260, tg[1] - 120 - R() * 160];
        st.pb.push({ s: s0, b: b0, c: c0, e: tg, t0: st.tBurst + clamp((s0[0] - 150) / 1750) * .14 + R() * .03, d: .72 + R() * .12, r: 6 + R() * 3, col: R() < .72 ? COL.violet : COL.lilac });
      }
    });
    // end: bars peel into dots that stream right in five lanes
    st.dots = [];
    COHORT.VALS.forEach((v, i) => {
      const h = COHORT.BH * v, n = Math.ceil(h / 18);
      for (let k = 0; k < n; k++) st.dots.push({ i, lx: COHORT.BX[i] + (k % 2 ? 6 : -6), ly: COHORT.BASE - h + 10 + k * (h - 20) / Math.max(1, n - 1), tr: st.tDis + i * .04 + k * .03, n, k });
    });
    st.dots.forEach(d => { const c = cgCam(d.tr, st); const [sx, sy] = camToScreen(c, CG.DASH[0] + d.lx, CG.DASH[1] + d.ly); d.sx = sx; d.sy = sy; });
    st.cutDur = COHORT.VALS.map((v, i) => (st.dots.filter(d => d.i === i).length - 1) * .03 + .06);

    // SFX (<= ~4/sec)
    cue(s, .03, 'swish', .32, { x: 960 });
    cue(s, .2, 'slide', .22, { x: 1200 });
    cue(s, st.tEye, 'shine', .22, { x: 960 });
    cue(s, st.tChips - .1, 'slide', .3, { x: 600 });
    cue(s, st.tChips + .18, 'pop', .26, { x: 1250 });
    cue(s, st.tReorg + .05, 'suck', .34, { x: 960 });
    cue(s, st.tReorg + .62, 'swish', .26, { x: 560 });
    cue(s, st.tFlag + .04, 'flag', .5, { x: 1000 });
    cue(s, st.tRev, 'whoosh', .26, { x: 1650 });
    cue(s, st.tSpark + .55, 'notify', .3, { x: 1450 });
    cue(s, st.tHum, 'review', .5, { x: 1650 });
    cue(s, st.tScrub, 'scan', .34, { x: 1600 });
    cue(s, st.tScrub + st.scrubD * .32, 'tick', .26, { x: 1560 });
    cue(s, st.tScrub + st.scrubD * .72, 'tick', .26, { x: 1680 });
    cue(s, st.tBurst, 'reverse', .3, { x: 960 });
    cue(s, st.tPlane + .2, 'thump', .3, { x: 960 });
    cue(s, st.tRing, 'roll', .34, { x: 540 });
    cue(s, st.tDash, 'shine', .26, { x: 1300 });
    cue(s, st.tDis, 'whoosh', .42, { x: 1400 });
    return st;
  },

  bg(lt, st) {
    if (!st || !st.moves) return {};
    const c = cgCam(lt, st);
    return { contours: { phase: st.phase0 + .0021 * .3 * (c.x - 762) } };
  },

  draw(lt, st) {
    const c = cgCam(lt, st);
    layer(c, .35, () => bokeh(lt, 63, 6, { alpha: .3 * smooth(0, 1.2, lt) * (1 - smooth(st.tDis, st.tDis + .5, lt)), size: 130 }));

    g.save(); applyCam(c);
    // ---------- wall of assessment screens ----------
    if (lt < st.tReorg + .45) {
      const chipLand = CG.CHIPS.map((_, i) => st.tChips + i * .07 - .12);
      st.tiles.forEach(t => {
        const e = seg(lt, t.tc, .24);
        if (e >= 1) return;
        const [sx, sy] = camToScreen(c, t.x, t.y), hw = CG.TW / 2 * c.z + 40, hh = CG.TH / 2 * c.z + 40;
        if (sx + hw < 0 || sx - hw > W || sy + hh < 0 || sy - hh > H) return;
        if (t.hero) {
          const k = lerp(1, 22 / CG.TW, eio(e));
          if (e < .85) {
            g.save(); g.translate(t.x, t.y); g.scale(k, k); g.globalAlpha *= 1 - smooth(.35, .85, e);
            softShadow(-180, -120, 360, 240, 20, { blur: 30, dy: 10, alpha: .12 * smooth(.1, 1, lt) * (1 - e) });
            interviewCard(0, 0, lt + st.prevLen, { tabs: [-9, -8, -7], talk: 0, pal: (typeof RD !== 'undefined' && RD.PAL) || CG.STU });
            g.restore();
          }
          if (e > .3) circle(t.x, t.y, 11 * smooth(.3, 1, e), COL.violet);
          return;
        }
        const p = sp(lt, t.tIn, SP.ui); if (p <= .002) return;
        const ki = CG.KINDS.indexOf(t.kind), hi = spInOut(lt, chipLand[ki], chipLand[ki] + .45, SP.ui, SP.soft);
        g.save(); g.translate(t.x, t.y + (1 - p) * 18); g.scale(lerp(.86, 1, p), lerp(.86, 1, p));
        cgTile(0, 0, lt, t.kind, t.seed, { e, alpha: clamp(p * 1.8), build: seg(lt, t.tIn + .1, .7), hi });
        g.restore();
      });
    }
    // reorg particles (tile dots -> row elements)
    if (lt > st.tReorg && lt < st.tReorg + 1.2) {
      for (const q of st.pa) {
        const p1 = cgPA(q, lt); if (!p1) continue;
        const u = (lt - q.t0) / q.d;
        g.save(); g.globalAlpha *= 1 - smooth(.8, 1, u); cgDot(cgPA(q, lt - CG_DT), p1, lerp(q.r, 4, u), q.col); g.restore();
      }
    }

    // ---------- integrity rows, flag, reviewer ----------
    const burst = smooth(st.tBurst, st.tBurst + .14, lt), keep = 1 - burst;
    if (lt > st.tReorg + .3 && keep > .01) {
      const dim = 1 - .55 * sp(lt, st.tFlag + .1, SP.soft), lift = sp(lt, st.tFlag - .02, SP.soft);
      line(CG.ROWX - INTEG.W / 2, cgRowY(0) - INTEG.H / 2 - 6, CG.ROWX - INTEG.W / 2 + INTEG.W * eo(seg(lt, st.tReorg + .5, .7)), cgRowY(0) - INTEG.H / 2 - 6, rgba(COL.contour, keep * dim), 1.5);
      for (let j = 0; j < 5; j++) {
        const pj = seg(lt, st.tReorg + .48 + j * .05, .55), fl = j === CG.FLAG;
        const sig = fl ? [sp(lt, st.tFlag - .06, SP.ui), sp(lt, st.tFlag + .04, SP.ui), 0, 0] : [0, 0, 0, 0];
        const marks = fl ? [[.37, seg(lt, st.tFlag - .12, .4)], [.71, seg(lt, st.tFlag - .02, .4)]] : [];
        const sub = CG.ROWSUB[j] + .1 * smooth(st.tReorg + .6, st.tBat, lt) * (j % 2 ? .6 : 1);
        g.save(); g.globalAlpha *= keep;
        integrityRow(CG.ROWX, cgRowY(j), 1 + .03 * burst, lt, { p: pj, pal: CG.ROWPAL[j], seed: j * 3 + 1, sub, sig, marks, lift: fl ? lift : 0, alpha: fl ? 1 : dim });
        g.restore();
      }
      // flag pill grows out of the flagged row
      g.save(); g.globalAlpha *= keep;
      integChip('Flag for review', cgPillX(), cgRowY(CG.FLAG), lt, st.tPill, { size: CG.PILL, fill: COL.amber, col: COL.ink, icon: 'flag', iconCol: COL.ink, anchor: 'left', shadow: true });
      // the flag only points: a soft ring as the evidence leaves it for the reviewer
      const pw2 = textWidth('Flag for review', CG.PILL, 600, 'I') + 40 + CG.PILL * 1.9 * .62;
      shock(cgPillX() - CG.PILL * .95 + pw2 / 2, cgRowY(CG.FLAG), seg(lt, st.tConn - .05, .7), 90, COL.amber, 4);
      // dotted connector + evidence spark to the human reviewer
      const pc = eio(seg(lt, st.tConn, .55));
      if (pc > .002) {
        const L = cgConnector(lt, st);
        pathDraw(L, pc, COL.violet, 5, { dash: [.1, 13] });
        const end = L.at(1);
        if (pc > .97) circle(end.x, end.y, 6 * smooth(.97, 1, pc), COL.violet);
        const us = seg(lt, st.tSpark, .62);
        if (us > 0 && us < 1) sparkAlong(L, eio(us), { trail: .22, w: 4, alpha: smooth(0, .1, us) * (1 - smooth(.88, 1, us)) });
      }
      // reviewer card
      const rv = cgRevPos(lt, st);
      if (rv.p > .002) {
        const scrub = lt > st.tScrub ? cgKeys(st.scrubK, lt) : 0;
        const look = lt < st.tScrub ? lerp(0, -.75, sp(lt, st.tSpark, SP.soft)) : lerp(-.75, .55, scrub);
        reviewerCard(rv.x, rv.y, CG.RS, lt, { pal: CG.REVPAL, look, strip: seg(lt, st.tStrip, .9), scrub: lt > st.tScrub ? Math.max(.001, scrub) : 0,
          marks: CG.MARKS, note: seg(lt, st.tScrub + st.scrubD * .5, .8), alpha: clamp(rv.p * 2.5) });
        // badge above the card widens into the ink "Human review" chip on 'human'
        integChip('Human review', rv.x, rv.y - INTEG.CH / 2 * CG.RS, lt, st.tHum, { size: CG.PILL, badge: sp(lt, st.tRev + .45, SP.ui), fill: COL.violet, fillTo: COL.ink, col: '#FFFFFF', icon: 'user-check', iconCol: '#FFFFFF', anchor: 'center', shadow: true });
      }
      g.restore();
    }
    // burst particles (rows + reviewer -> dashboard plane)
    if (lt > st.tBurst && lt < st.tBurst + 1.1) {
      for (const q of st.pb) {
        const p1 = cgPB(q, lt); if (!p1) continue;
        const u = (lt - q.t0) / q.d;
        g.save(); g.globalAlpha *= 1 - smooth(.8, 1, u); cgDot(cgPB(q, lt - CG_DT), p1, q.r * lerp(clamp(.45 + u * 6), .45, smooth(.4, 1, u)), q.col); g.restore();
      }
    }

    // ---------- cohort dashboard ----------
    const pp = sp(lt, st.tPlane - .12, { dur: 1.05, bounce: 0 });
    if (pp > .002) {
      const fade = 1 - smooth(st.tDis + .05, st.tDis + .42, lt);
      const v = 68 * eo(seg(lt, st.tRing + .05, .95)), cut = COHORT.VALS.map((_, i) => clamp((lt - st.tDis - i * .04 + .03) / st.cutDur[i]));
      const opt = { plane: sp(lt, st.tPlane + .05, SP.soft), ring: seg(lt, st.tRing - .1, .6), v, num: v, tLabel: st.tLabel, tDept: st.tDept,
        bars: COHORT.VALS.map((_, i) => sp(lt, st.tBars + i * .06, { dur: .7, bounce: .14 })), cut, trend: brand(seg(lt, st.tTrend, 1.0)),
        train: sp(lt, st.tTrain, { dur: 1.1, bounce: 0 }), content: fade };
      const [dx, dy] = CG.DASH, rx = .5 * (1 - pp), ry = -.12 * (1 - pp), yo = 36 * (1 - pp);
      softShadow(dx - COHORT.W / 2, dy - COHORT.H / 2 + yo, COHORT.W, COHORT.H, 32, { blur: 60, dy: 22, alpha: .15 * clamp(pp * 1.5) * fade });
      g.save(); g.globalAlpha *= clamp(pp * 1.6);
      if (rx > .002) {
        const PW = COHORT.W + 60, PH = COHORT.H + 60;
        tilt3d(PW, PH, () => cohortDashboard(PW / 2, PH / 2, 1, lt, opt), dx, dy + yo, ry, rx, { sheen: true });
      } else cohortDashboard(dx, dy + yo, 1, lt, opt);
      g.restore();
    }
    g.restore();

    // ---------- screen space: eyebrow, assessment chips, end dots ----------
    eyebrow('AI-Proctored Assessments', 960, CG.EYE_Y, lt, st.tEye, { size: 28, out: st.tBat - .12 });
    const hl = eo(seg(lt, st.tChips - .2, .6)), ho = eo(seg(lt, st.tChipOut + .1, .5));
    if (hl > ho + .002) line(360 + 1200 * ho, CG.CHIP_Y, 360 + 1200 * hl, CG.CHIP_Y, COL.contour, 1.5);
    if (lt > st.tChips - .3 && lt < st.tChipOut + 1) {
      const ws = CG.CHIPS.map(([s]) => textWidth(s, 26, 600, 'I') + 40 + 26 * 1.9 * .62), gap = 26, tot = ws.reduce((a, b) => a + b, 0) + gap * 3;
      let x = 960 - tot / 2;
      CG.CHIPS.forEach(([str, ic], i) => {
        const cx = x + ws[i] / 2; x += ws[i] + gap;
        const ti = st.tChips + i * .07, pin = sp(lt, ti - .22, SP.text), pout = spring(lt - (st.tChipOut + i * .05), .5, 0);
        if (pin <= .002 || pout >= .999) return;
        integChip(str, cx - (1 - pin) * 140 + pout * 120, CG.CHIP_Y, lt, ti, { badge: clamp(pin * 1.4), fill: COL.paper, stroke: COL.contour, col: COL.deep, icon: ic, iconCol: COL.violet, anchor: 'center', shadow: true, out: st.tChipOut + i * .05 });
      });
    }
    if (lt > st.tDis) {
      for (const d of st.dots) {
        const p1 = cgPD(d, lt); if (!p1 || p1[0] > W + 40) continue;
        cgDot(cgPD(d, lt - CG_DT), p1, 9 * clamp(.55 + (lt - d.tr) / .1), COL.violet);
      }
    }
  }
};
