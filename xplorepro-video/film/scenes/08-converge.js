/* scenes/08-converge.js: L16 "Training. Assessments. AI career mentorship." (anchors training assessments mentorship)
   The film's only dark moment. Match cut from corporates: a straight violet path line (w6) at y540 with the evidence spark at x1500.
   The camera pulls back while the engine eases the bg to deep violet: emblems of earlier beats (gauge dial, integrity capsule,
   mentor orb with sparkles, pipeline node) bloom on the line toward the spark and a contoursAlong() field opens around it. A kinetic
   headline row builds on the anchors and re-centres as each word joins; each word pulses its emblem. The emblems shrink into beads,
   the field converges into one trajectory and the path straightens; the spark arcs to the centre, draws the needle out of the pivot
   dot and the mark locks on the path (LOCKUP marker = mentorship + .9: impact + sublogo). The mark glides left as the inverse
   wordmark wipes out from behind it; the tagline mask-rises.
   End state (match cut to cta, owned here too): inverse lockup centred (960, CONV.LOCK.y), wordmark height CONV.LOCK.hw, tagline
   below, the spark resting on the needle tip, group zoom CONV.END_Z about (960,540). Helpers prefixed conv*; CONV, convLockGeo,
   convTip and convSpark are reused by scenes/09-cta.js. */
const CONV = {
  SPX: 1500, Z1: .62, X1: 750, Y1: 430, DRIFT: 36,              // contract spark x; settled pull-back camera (world centre, zoom)
  A: 80, LAM: 1100,                                             // path wave (world), zero at SPX so the spark stays on y540
  NODES: [{ x: 10, kind: 'dial' }, { x: 470, kind: 'integ' }, { x: 935, kind: 'orb' }, { x: 1335, kind: 'pipe' }],
  R: 100, PR: 66, BEAD: 13,
  WORDS: ['Training.', 'Assessments.', 'AI Career Mentorship.'], WSIZE: 58, WGAP: 28, WY: 300, WMAX: 1400,
  MH: 150, LOCK: { y: 508, hw: 160 },
  TAG: 'Building Industry-Ready Talent at Scale', TAG_DY: 124, TAG_SIZE: 34, TAG_COL: '#E6DCFF',
  END_Z: 1.03, HALO_END: .55, DARK: '#4A22B8', GLOW: '#8B55FF', LINE: '#B596FF', FIELD: '#C9B6FF', TRAIL: '#D9CCFF', SHADOW: 'rgba(22,8,64,1)'
};
const convPathY = (x, bend) => 540 + bend * CONV.A * Math.sin(TAU * (x - CONV.SPX) / CONV.LAM);
function convPath(bend) { const P = []; for (let x = -2600; x <= 3600; x += 160) P.push([x, convPathY(x, bend)]); return lut(P, 360); }
/* pull back + tilt down (path sits low, under the headline), then re-centre so the path runs through the pivot dot at the lock */
function convCam(lt, st) {
  const p = sp(lt, 0, { dur: 1.8, bounce: 0 }), d = smooth(1.2, st.len, lt), re = eio(seg(lt, st.tM - .3, st.tArr - st.tM + .3));
  return { x: lerp(960, CONV.X1, p) + CONV.DRIFT * d, y: lerp(lerp(540, CONV.Y1, p), 540, re), z: Math.exp(lerp(0, Math.log(CONV.Z1), p)) * (1 + .035 * d), rot: 0 };
}
/* final lockup geometry, same proportions as core lockup() (hw = wordmark height) */
function convLockGeo(cx, cy, hw) {
  const ww = hw * WORD.sw / WORD.sh, mh = hw * .7365, mw = mh * 945 / 873, gap = hw * .052, total = mw + gap + ww, left = cx - total / 2;
  return { hw, ww, mh, mw, gap, total, left, mx: left + mw / 2, my: cy - hw * .0743, wx: left + mw + gap, cy };
}
const convTip = (x, y, h) => [x + (MARK.needleL[2][0] - MARK.cx) / MARK.h * h, y + (MARK.needleL[2][1] - MARK.cy) / MARK.h * h];
const convDot = (x, y, h) => [x + MARK_DOT.x * h, y + MARK_DOT.y * h];
/* the evidence spark with an optional soft white halo (reads on the dark field) */
function convSpark(x, y, s, a, halo = 1) {
  if (a <= .01) return;
  if (halo > .01) { const r = 46 * s, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,255,255,${.42 * a * halo})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  spark(x, y, s, a);
}
function convTrail(L, u, len, col, w, a) {
  if (a <= .01) return; g.save(); g.globalAlpha *= a;
  for (let k = 0; k < 6; k++) { const a0 = u - len * (k + 1) / 6, b0 = u - len * k / 6; if (b0 <= 0) continue; g.globalAlpha *= .8; pathDraw(L, b0, col, w * (1 - k / 7), { from: Math.max(0, a0) }); }
  g.restore();
}
/* emblems (local coords, drawn inside tf) */
function convDisc(R) { softShadow(-R, -R, 2 * R, 2 * R, R, { blur: R * .7, dy: R * .22, alpha: .38, col: CONV.SHADOW }); circle(0, 0, R, COL.paper); }
function convDial(R, v) {
  convDisc(R);
  const ar = R * .64, A0 = Math.PI * 5 / 6, SW = Math.PI * 4 / 3, an = A0 + SW * clamp(v);
  g.lineCap = 'round'; g.lineWidth = R * .13;
  g.beginPath(); g.arc(0, 0, ar, A0, A0 + SW); g.strokeStyle = COL.lav; g.stroke();
  g.beginPath(); g.arc(0, 0, ar, A0, an); g.strokeStyle = COL.violet; g.stroke();
  line(0, 0, Math.cos(an) * (ar - R * .14), Math.sin(an) * (ar - R * .14), COL.navy, R * .075);
  circle(0, 0, R * .13, COL.violet); circle(0, 0, R * .05, COL.paper);
}
/* faceless avatar (no face imagery in the emblem) */
function convAvatar(x, y, r) {
  g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = COL.lav; g.fill(); g.clip();
  circle(x, y - r * .2, r * .36, COL.pale);
  g.beginPath(); g.ellipse(x, y + r * .78, r * .7, r * .5, 0, 0, TAU); g.fillStyle = COL.pale; g.fill(); g.restore();
}
function convInteg(R, f) {
  const w = R * 2.6, h = R * 1.1, x0 = -w / 2, r = h / 2, bx = x0 + h + 4, bw = w - h - r * .9;
  softShadow(x0, -h / 2, w, h, r, { blur: R * .7, dy: R * .22, alpha: .38, col: CONV.SHADOW });
  rrect(x0, -h / 2, w, h, r, COL.paper);
  convAvatar(x0 + r, 0, h * .34);
  rrect(bx, -h * .25, bw * .42, h * .12, h * .06, COL.navy);
  rrect(bx, -h * .03, bw * .7, h * .1, h * .05, COL.contour);
  rrect(bx, h * .2, bw, h * .1, h * .05, COL.lav);
  if (f > .01) rrect(bx, h * .2, Math.max(h * .1, bw * f), h * .1, h * .05, COL.violet);
}
function convOrb(R, lt, e) {
  const k = 1 + .1 * e;
  for (let i = 0; i < 2; i++) ring(0, 0, R * k + 16 + i * 20 + 3 * Math.sin(lt * 2.2 + i), 1.5, `rgba(255,255,255,${.28 - i * .1})`);
  const gr = g.createRadialGradient(-R * .35, -R * .4, R * .1, 0, 0, R * k);
  gr.addColorStop(0, COL.pale); gr.addColorStop(.55, COL.bright); gr.addColorStop(1, COL.deep);
  circle(0, 0, R * k, gr); ring(0, 0, R * k, 3, 'rgba(255,255,255,.75)');
  sparkle(0, 0, R * .42 * k, '#FFFFFF', (lt * .6 + e * .8) * .3);
  sparkle(R * .46, -R * .42, R * .15 * (1 + .4 * e), 'rgba(255,255,255,.9)');
  sparkle(-R * .48, R * .38, R * .1 * (1 + .5 * e), 'rgba(255,255,255,.75)');
}
function convPipe(R) { convDisc(R); ring(0, 0, R, 4, COL.violet); icon('briefcase-business', 0, 0, R * .95, COL.violet, 2); }
function convNode(n, i, lt, st, bend, pa) {
  const b = sp(lt, st.bloom[i], SP.pop); if (b <= .002) return;
  const k = sp(lt, st.shrink[i], SP.ui), y = convPathY(n.x, bend);
  const ba = smooth(.45, .85, k) * pa;
  if (ba > .01) tf(n.x, y, 1, 0, () => { circle(0, 0, CONV.BEAD, COL.paper); ring(0, 0, CONV.BEAD, 3, CONV.LINE); }, ba);
  const ea = clamp(b * 2) * (1 - smooth(.55, .9, k)); if (ea <= .01) return;
  const s = lerp(.3, 1, b) * lerp(1, .14, k), R = n.kind === 'pipe' ? CONV.PR : CONV.R, tp = st.pulse[i], pu = tp > -1 ? seg(lt, tp, .7) : 0;
  tf(n.x, y, s, 0, () => {
    if (pu > 0 && pu < 1) shock(0, 0, pu, R * 1.5, '#FFFFFF', 4);
    if (n.kind === 'dial') convDial(R, lerp(.28, .78, sp(lt, tp + .04, SP.needle)));
    else if (n.kind === 'integ') convInteg(R, lerp(.3, .92, sp(lt, tp, { dur: .7, bounce: 0 })));
    else if (n.kind === 'orb') convOrb(R, lt, spInOut(lt, tp, tp + .3, SP.pop, SP.text));
    else convPipe(R);
  }, ea);
}
function convMarkPose(lt, st) {
  const pw = sp(lt, st.tSlide, { dur: .8, bounce: 0 }), G = st.geo;
  return { x: lerp(960, G.mx, pw), y: lerp(540, G.my, pw), h: lerp(CONV.MH, G.mh, pw), pw };
}

SC.converge = {
  cutIn: { type: 'match' },
  init(s) {
    const st = { len: s.len, tT: at(s, 'training'), tA: at(s, 'assessments'), tM: at(s, 'mentorship') };
    st.tLock = Math.min(st.tM + .9, s.len - 1.3);              // the timeline's LOCKUP marker (music hit)
    st.tArc = st.tLock - .62; st.tArr = st.tLock - .32; st.tSlide = st.tLock + .15; st.tTag = st.tLock + .5;
    st.bloom = [st.tT - .04, st.tT + .06, st.tT + .16, st.tT + .26];
    st.shrink = [st.tM - .3, st.tM - .1, st.tM + .28, st.tArc - .02];
    st.pulse = [st.tT, st.tA, st.tM, -9];
    const sc = document.createElement('canvas').getContext('2d');      // init runs before the engine sets g
    let ws = withCtx(sc, () => CONV.WORDS.map(w => textWidth(w, CONV.WSIZE, 700, 'D')));
    const full = ws.reduce((a, b) => a + b, 0) + CONV.WGAP * 2, k = Math.min(1, CONV.WMAX / full), gap = CONV.WGAP * k;
    st.wsize = CONV.WSIZE * k; ws = ws.map(w => w * k);
    st.woff = [0, ws[0] + gap, ws[0] + ws[1] + 2 * gap];
    st.wx0 = [0, 1, 2].map(n => 960 - (st.woff[n] + ws[n]) / 2);
    const c = convCam(st.tArc, st), [ax, ay] = camToScreen(c, CONV.SPX, 540), D = convDot(960, 540, CONV.MH), C = [(ax + D[0]) / 2 + 40, 300];
    const pts = []; for (let i = 0; i <= 16; i++) { const u = i / 16; pts.push([lerp(lerp(ax, C[0], u), lerp(C[0], D[0], u), u), lerp(lerp(ay, C[1], u), lerp(C[1], D[1], u), u)]); }
    st.arc = lut(pts, 120); st.geo = convLockGeo(960, CONV.LOCK.y, CONV.LOCK.hw);
    cue(s, .05, 'whoosh', .3, { x: 1200 });
    cue(s, st.tT, 'tick', .3, { x: 560 }); cue(s, st.tA, 'tick', .28, { x: 800 }); cue(s, st.tM, 'chime', .26, { x: 1080 });
    const tr = Math.max(.3, st.tLock - 1.5); cue(s, tr, 'riser', .38, { x: 960, dur: st.tLock - tr });
    cue(s, st.tArc, 'swish', .3, { x: 1200 });
    cue(s, st.tLock, 'impact', .85, { x: 960 }); cue(s, st.tLock + .07, 'sublogo', .8, { x: 960 });
    cue(s, st.tSlide + .05, 'slide', .22, { x: 760 });
    return st;
  },
  bg(lt, st) {
    if (!st || st.tLock === undefined) return {};
    const k = sp(lt, st.tLock, { dur: .14, bounce: 0 }) * (1 - smooth(st.tLock + .1, st.tLock + 1.0, lt));
    return { glow: { x: 960, y: 540, r: 1000 + 180 * k, col: CONV.GLOW, alpha: .7 + .22 * k }, contours: { alpha: lerp(.32, .1, smooth(.2, 1.2, lt)) } };
  },
  draw(lt, st) {
    const c = convCam(lt, st), [sx, sy] = shake(lt, st.tLock, 3, .3);
    const bend = sp(lt, .2, { dur: 1.4, bounce: 0 }) * (1 - smooth(st.tM - .4, st.tLock - .15, lt));
    const L = convPath(bend), pa = 1 - smooth(st.tSlide + .1, st.tSlide + .6, lt);
    const cv = eio(smooth(st.tM - .55, st.tLock - .25, lt)), fa = smooth(.15, .9, lt);
    const lineCol = mix(COL.violet, CONV.LINE, smooth(.05, .7, lt)), lw = 6 * (1 + (1 / c.z - 1) * .5);
    g.save(); g.translate(sx, sy);
    const ba = .28 * fa * (1 - smooth(st.tLock - .3, st.tLock + .4, lt));
    if (ba > .01) layer(c, .3, () => bokeh(lt, 23, 7, { alpha: ba, size: 150 }));
    g.save(); applyCam(c);
    if (fa * pa > .01) contoursAlong(L, { n: 22, gap: 20, col: CONV.FIELD, alpha: .42 * fa * pa, lw: 2, T: lt * 1.3, wave: 7 * (1 - cv), pinch: () => 1 - cv });
    if (pa > .01) { g.save(); g.globalAlpha *= pa; pathDraw(L, 1, lineCol, lw); g.restore(); }
    CONV.NODES.forEach((n, i) => convNode(n, i, lt, st, bend, pa));
    g.restore();
    // kinetic headline row (screen space): re-centres as each word joins; rises out on the lock
    const x0 = st.wx0[0] + (st.wx0[1] - st.wx0[0]) * sp(lt, st.tA - .25, SP.text) + (st.wx0[2] - st.wx0[1]) * sp(lt, st.tM - .3, SP.text);  // makes room ahead of each word
    const wy = CONV.WY - 8 * smooth(0, st.len, lt), ts = [st.tT, st.tA, st.tM];
    CONV.WORDS.forEach((w, i) => typeRise(w, x0 + st.woff[i], wy, lt, ts[i], { size: st.wsize, weight: 700, col: '#FFFFFF', align: 'left', out: st.tLock - .08 + i * .06 }));
    // lock group (slow push after the lock)
    const zg = 1 + (CONV.END_Z - 1) * smooth(st.tLock, st.len, lt);
    g.save(); g.translate(960, 540); g.scale(zg, zg); g.translate(-960, -540);
    const P = convMarkPose(lt, st), nd = brand(seg(lt, st.tArr, .3)), [dx, dy] = convDot(P.x, P.y, P.h), [tx, ty] = convTip(P.x, P.y, P.h);
    shock(dx, dy, seg(lt, st.tLock, .8), 260, '#FFFFFF', 5); shock(dx, dy, seg(lt, st.tLock + .1, 1.0), 420, CONV.LINE, 3);
    if (lt >= st.tArr - .06) {
      if (P.pw > .002) {
        const G = st.geo, mr = P.x + P.h * 945 / 873 / 2, wl = mr + G.gap - (1 - P.pw) * 70;
        g.save(); g.beginPath(); g.rect(mr + 2, 0, Math.max(0, wl + P.pw * (G.ww + 12) - mr - 2), H); g.clip();
        wordmark(wl, CONV.LOCK.y, G.hw, 1, { inverse: true }); g.restore();
      }
      vectorMark(P.x, P.y, P.h, { inverse: true, dot: sp(lt, st.tArr - .04, SP.pop), needle: nd, violet: sp(lt, st.tLock - .08, SP.pop), chev: sp(lt, st.tLock - .02, SP.ui), arm: sp(lt, st.tLock + .04, SP.ui) });
    }
    typeRise(CONV.TAG, 960, CONV.LOCK.y + CONV.TAG_DY, lt, st.tTag, { size: CONV.TAG_SIZE, weight: 600, face: 'I', col: CONV.TAG_COL });
    // the evidence spark: on the line, arcing to the pivot, up the needle, then resting on the tip
    const halo = smooth(0, .4, lt) * lerp(1, CONV.HALO_END, smooth(st.tLock, st.tLock + .6, lt));
    if (lt < st.tArc) { const [px, py] = camToScreen(c, CONV.SPX, 540), w = smooth(0, .8, lt); convSpark(px, py, 1 + .1 * w + .05 * Math.sin(lt * 5) * w, 1, halo); }
    else if (lt < st.tArr) { const u = brand(seg(lt, st.tArc, st.tArr - st.tArc)); convTrail(st.arc, u, .4, CONV.TRAIL, 4, 1); const p = st.arc.at(u); convSpark(p.x, p.y, 1.1, 1, halo); }
    else {
      const ta = 1 - smooth(st.tLock - .1, st.tLock + .2, lt), b0 = Math.max(0, nd - .5);
      if (ta > .01 && nd > .02) line(lerp(dx, tx, b0), lerp(dy, ty, b0), lerp(dx, tx, nd), lerp(dy, ty, nd), rgba(CONV.TRAIL, ta), 3);
      const k = smooth(st.tLock, st.tLock + .5, lt);
      convSpark(lerp(dx, tx, nd), lerp(dy, ty, nd), lerp(1.1, .8, k), lerp(1, .9, k), halo);
    }
    g.restore();
    g.restore();
  }
};
