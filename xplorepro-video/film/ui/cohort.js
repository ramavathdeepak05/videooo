/* ui/cohort.js: cohort readiness dashboard on one shared plane (no funnel, no ranking). Pure functions of their arguments.
   COHORT                              geometry + data (local units; plane COHORT.W x COHORT.H, origin at its centre).
   cohortDashboard(x, y, s, lt, o)     plane centred at x,y scaled by s:
       left    "Cohort readiness" ring (track draws, violet arc + odometer to the value),
       centre  five department bars CSE ECE EEE MECH IT on light gridlines,
       right   skill-gap trend line drawn with the evidence spark at its head, and a training-progress ring.
       o = { plane 0..1 (window chrome + dividers), ring 0..1 (track), v 0..100 ring value, num (odometer, default v),
             tLabel / tDept local times the labels mask-rise (60ms dept stagger), bars [5 x 0..1] heights (drive with springs),
             cut [5 x 0..1] how much of each bar has dissolved from the top, trend 0..1, train 0..1, content 0..1 (alpha of all but bars),
             alpha, card (default true) }
   cohortBar(i, h01, cut01) → {x, w, base, top} local geometry of bar i (top moves down as it dissolves).
   cohortPoints() → [[x, y], ...] local points spread over the dashboard's elements (particle targets). */
const COHORT = {
  W: 1480, H: 600, R: [-520, 6, 136, 22], DEPTS: ['CSE', 'ECE', 'EEE', 'MECH', 'IT'], VALS: [.78, .63, .55, .6, .72],
  BX: [-200, -100, 0, 100, 200], BW: 56, BASE: 196, BH: 300,
  TR: { x: 352, y: -196, w: 352, h: 250 }, TREND: [.22, .3, .27, .4, .46, .44, .58, .64, .72],
  TRN: [414, 192, 50, 12], TRAIN: .74
};
function cohortBar(i, h01, cut01 = 0) {
  const C = COHORT, h = C.BH * C.VALS[i] * Math.max(0, h01), top = C.BASE - h, cutY = top + h * clamp(cut01);
  return { x: C.BX[i], w: C.BW, base: C.BASE, top: cutY, full: top };
}
function cohortPoints() {
  const C = COHORT, P = [];
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU - Math.PI / 2; P.push([C.R[0] + Math.cos(a) * C.R[2], C.R[1] + Math.sin(a) * C.R[2]]); }
  C.BX.forEach((bx, i) => { for (let k = 0; k < 3; k++) P.push([bx, C.BASE - C.BH * C.VALS[i] * (.2 + k * .3)]); });
  C.TREND.forEach((v, i) => P.push([C.TR.x + C.TR.w * i / (C.TREND.length - 1), C.TR.y + 40 + C.TR.h * .8 * (1 - v)]));
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; P.push([C.TRN[0] + Math.cos(a) * C.TRN[2], C.TRN[1] + Math.sin(a) * C.TRN[2]]); }
  return P;
}
function cohortRing(x, y, r, w, track, v, o = {}) {
  if (track > .002) { g.beginPath(); g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * eio(track)); g.strokeStyle = COL.lav; g.lineWidth = w; g.lineCap = 'round'; g.stroke(); }
  if (v > .002) {
    const gr = g.createConicGradient(-Math.PI / 2 - .25, x, y), e = .25 / TAU;
    gr.addColorStop(0, COL.pale); gr.addColorStop(e, COL.pale); gr.addColorStop(e + v * .9, COL.violet); gr.addColorStop(1, COL.violet);
    g.beginPath(); g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(v)); g.strokeStyle = o.solid ? COL.violet : gr; g.lineWidth = w; g.lineCap = 'round'; g.stroke();
  }
}
function cohortDashboard(x, y, s, lt, o = {}) {
  const a = o.alpha === undefined ? 1 : o.alpha; if (a <= .01 || s <= .001) return;
  const C = COHORT, L = -C.W / 2, T = -C.H / 2, pl = clamp(o.plane === undefined ? 1 : o.plane), ca = clamp(o.content === undefined ? 1 : o.content);
  tf(x, y, s, 0, () => {
    g.save(); g.globalAlpha *= ca;
    if (o.card !== false) rrect(L, T, C.W, C.H, 32, COL.paper, COL.contour, 1.5);
    // window chrome + abstract title, header hairline, section dividers
    if (pl > .01) {
      g.save(); g.globalAlpha *= pl;
      for (let i = 0; i < 3; i++) circle(L + 40 + i * 24, T + 40, 7, COL.contour);
      bars(L + 118, T + 34, 220, 1, { h: 12, head: true, headCol: COL.navy, p: pl, seed: 41 });
      icon('graduation-cap', L + C.W - 52, T + 40, 26, COL.lilac, 2);
      rrect(L + C.W - 196, T + 34, 110, 12, 6, COL.contour);
      g.restore();
      line(L + 32, T + 80, L + 32 + (C.W - 64) * eo(pl), T + 80, COL.contour, 1.5);
      line(-296, T + 120, -296, T + 120 + 430 * eo(pl), COL.contour, 1.5);
      line(296, T + 120, 296, T + 120 + 430 * eo(pl), COL.contour, 1.5);
    }
    // left: cohort readiness ring
    const [rx, ry, rr, rw] = C.R, v = clamp((o.v || 0) / 100), num = o.num === undefined ? (o.v || 0) : o.num;
    const rt = clamp(o.ring || 0);
    if (rt > .002) {
      circle(rx, ry, rr - rw / 2 - 14, rgba(COL.lav, .55 * rt));
      cohortRing(rx, ry, rr, rw, rt, v);
      if (v > .003) { const ang = -Math.PI / 2 + TAU * v; circle(rx + Math.cos(ang) * rr, ry + Math.sin(ang) * rr, rw * .32, COL.paper); }
      odometer(rx, ry + 2, Math.max(0, num), { to: 99, size: 92, col: COL.ink, alpha: clamp(rt * 1.6) });
    }
    if (o.tLabel !== undefined) typeRise('Cohort readiness', rx, ry + rr + 62, lt, o.tLabel, { size: 32, col: COL.ink });
    // centre: gridlines + labels (bars drawn after, outside the content alpha)
    if (pl > .01) {
      for (let k = 1; k <= 3; k++) { const gy = C.BASE - C.BH * k / 3.3; line(-250, gy, -250 + 500 * eo(pl), gy, rgba(COL.contour, .9), 1.5, 1, [2, 10]); }
      line(-250, C.BASE, -250 + 500 * eo(pl), C.BASE, COL.contour, 2);
    }
    if (o.tDept !== undefined) C.DEPTS.forEach((d, i) => typeRise(d, C.BX[i], C.BASE + 40, lt, o.tDept + i * .06, { size: 28, weight: 600, face: 'I', col: COL.muted }));
    // right top: skill-gap trend
    const tr = clamp(o.trend || 0), R = C.TR;
    if (pl > .01) {
      g.save(); g.globalAlpha *= pl;
      circle(R.x + 20, R.y + 4, 20, COL.lav); icon('trending-up', R.x + 20, R.y + 4, 22, COL.deep, 2.2);
      bars(R.x + 54, R.y - 4, 150, 1, { h: 10, head: true, headCol: COL.navy, p: pl, seed: 43 });
      for (let k = 0; k < 4; k++) line(R.x, R.y + 52 + k * 64, R.x + R.w, R.y + 52 + k * 64, rgba(COL.contour, .8), 1.5, 1, [2, 10]);
      g.restore();
    }
    if (tr > .002) {
      const P = C.TREND.map((v2, i) => [R.x + R.w * i / (C.TREND.length - 1), R.y + 40 + R.h * .8 * (1 - v2)]), Lp = lut(P, 120);
      const n = Math.max(2, Math.round(Lp.pts.length * tr)), base = R.y + 40 + R.h * .82, gr = g.createLinearGradient(0, R.y + 40, 0, base);
      gr.addColorStop(0, rgba(COL.violet, .16)); gr.addColorStop(1, rgba(COL.violet, 0));
      g.beginPath(); g.moveTo(Lp.pts[0][0], base); for (let i = 0; i < n; i++) g.lineTo(Lp.pts[i][0], Lp.pts[i][1]); g.lineTo(Lp.pts[n - 1][0], base); g.closePath(); g.fillStyle = gr; g.fill();
      pathDraw(Lp, tr, COL.violet, 4);
      const hd = Lp.at(tr); spark(hd.x, hd.y, .95, 1);
    }
    // right bottom: training progress ring + abstract caption bars
    const tn = clamp(o.train || 0), [qx, qy, qr, qw] = C.TRN;
    if (pl > .01) {
      g.save(); g.globalAlpha *= pl;
      cohortRing(qx, qy, qr, qw, pl, 0);
      circle(qx, qy, qr - 18, COL.lav); icon('book-open-check', qx, qy, 30, COL.deep, 2.2);
      bars(qx + 86, qy - 30, 180, 2, { h: 12, gap: 26, head: true, headCol: COL.navy, col: COL.contour, p: pl, seed: 47 });
      rrect(qx + 86, qy + 30, 180, 10, 5, COL.lav);
      g.restore();
    }
    if (tn > .002) { cohortRing(qx, qy, qr, qw, 0, C.TRAIN * tn, { solid: true }); rrect(qx + 86, qy + 30, Math.max(10, 180 * C.TRAIN * tn), 10, 5, COL.violet); }
    g.restore();
    // department bars (rise on springs; dissolve from the top), drawn at full alpha so the dissolve reads cleanly
    const B = o.bars || [], K = o.cut || [];
    C.DEPTS.forEach((d, i) => {
      const h01 = B[i] || 0, b = cohortBar(i, h01, K[i] || 0), hh = b.base - b.top; if (hh < 4 || h01 <= .002) return;
      const gr = g.createLinearGradient(0, b.base, 0, C.BASE - C.BH); gr.addColorStop(0, COL.pale); gr.addColorStop(1, COL.violet);
      g.save(); g.globalAlpha *= Math.max(ca, (K[i] || 0) > 0 ? 1 : ca);
      rrect(b.x - b.w / 2, b.top, b.w, hh, Math.min(14, hh / 2), gr);
      g.restore();
    });
  }, a);
}
