/* scenes/01-hook.js: L01 "Placement season. Resume, skills, mock interviews, deadlines..." / L02 "...but no idea what to do first."
   A student bust rises into a calm contour field. On each anchor a lavender task disc springs out of the field and joins a 2.5D
   orbit; four more pile in on a counter-rotating outer lane while the camera pushes in. On 'stop' the spin decays and the colours
   drain to contour grey; a dotted violet path tries to leave the student and breaks into fragments. Final beat: everything implodes
   into a 10px ink dot at screen centre, which the reveal picks up as the logo's pivot dot (match cut). */
const HOOK = {
  B: [960, 512, 172],                                   // student bust centre + radius (world)
  O: [960, 552],                                        // orbit centre (world)
  T: [960, 540],                                        // implode target = screen centre (camera is centred here at the end)
  lanes: [{ rx: 560, ry: 206, w: 2.05, r: 64 }, { rx: 720, ry: 282, w: -1.45, r: 52 }],
  tilt: -.07,
  DOT: 5,                                               // final ink dot radius (10px)
  PAL: { skin: '#B97A50', hair: '#1A120D', shirt: '#7438F2', style: 'long' },
  // lane-0 slots in the rotating frame are spaced a quarter turn apart, in this spawn order
  chips: [
    { ic: 'file-text', key: 'resume', lane: 0, slot: 0 },
    { ic: 'code-xml', key: 'skills', lane: 0, slot: 2 },
    { ic: 'mic', key: 'mock', lane: 0, slot: 3 },
    { ic: 'calendar-clock', key: 'deadlines', lane: 0, slot: 1, acc: '#F05A67' },
    { ic: 'clock', lane: 1, slot: 2 },
    { ic: 'bell', lane: 1, slot: 0, acc: '#F59D3D' },
    { ic: 'book-open', lane: 1, slot: 1 },
    { ic: 'chart-column', lane: 1, slot: 3 }
  ]
};
const HOOK_GREY_FILL = mixHex(COL.canvas, COL.grey, .1), HOOK_GREY_RING = mixHex(COL.canvas, COL.grey, .28), HOOK_GREY_ICON = mixHex(COL.canvas, COL.grey, .75);
const hookFin = (p, k) => p + (1 - p) * k;               // force a spring exactly home by the end of a window
function hookPhi(tab, lt) { const f = clamp(lt, 0, (tab.length - 2) * tab.dt) / tab.dt, i = Math.floor(f); return lerp(tab[i], tab[i + 1], f - i); }
/* chaos level: builds from the first disc to 'stop', then drains */
function hookChaos(st, lt) { return smooth(st.chips[0].t, st.tStop, lt) * (1 - smooth(st.tStop, st.tStop + .7, lt)); }
/* orbit position of chip c at lt (before spawn/implode); returns world {x, y, d}, d = depth -1 (back) .. 1 (front) */
function hookOrbit(st, c, lt) {
  const L = HOOK.lanes[c.lane], sag = smooth(st.tStop, st.tStop + 1.3, lt), ch = hookChaos(st, lt);
  const th = c.a0 + (c.lane ? hookPhi(st.phi1, lt) : hookPhi(st.phi0, lt)) + (.07 + .1 * ch) * Math.sin(1.7 * lt + c.i * 1.9);
  const wob = 1 + (.015 + .025 * ch) * Math.sin(2.3 * lt + c.i * 1.3) - .06 * sag;
  const ry = L.ry * (1 + .16 * ch * Math.sin(1.9 * lt + 1 + c.lane * 2.1));
  const ex = Math.cos(th) * L.rx * wob, ey = Math.sin(th) * ry * wob + (3 + 4 * ch) * Math.sin(2.9 * lt + c.i);
  const tilt = HOOK.tilt + .12 * ch * Math.sin(2.1 * lt + c.lane * 1.4), ca = Math.cos(tilt), sa = Math.sin(tilt);
  return { x: HOOK.O[0] + ex * ca - ey * sa, y: HOOK.O[1] + 24 * sag + ex * sa + ey * ca, d: Math.sin(th) };
}
/* lane ellipse (for the faint orbit tracks), same lane-level wobble as the chips */
function hookTrack(st, lane, lt, a0, a1, col, w) {
  const L = HOOK.lanes[lane], sag = smooth(st.tStop, st.tStop + 1.3, lt), ch = hookChaos(st, lt);
  const ry = L.ry * (1 + .16 * ch * Math.sin(1.9 * lt + 1 + lane * 2.1)), tilt = HOOK.tilt + .12 * ch * Math.sin(2.1 * lt + lane * 1.4);
  g.beginPath(); g.ellipse(HOOK.O[0], HOOK.O[1] + 24 * sag, L.rx * (1 - .06 * sag), ry * (1 - .06 * sag), tilt, a0, a1);
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.stroke();
}
function hookChipAt(st, c, lt) {
  let p = hookOrbit(st, c, lt), s = 1, a = 1;
  if (c.lane === 0) { const k = sp(lt, c.t, SP.pop); s = k; p = { ...p, y: p.y + 34 * (1 - sp(lt, c.t, SP.ui)) }; a = clamp(k * 3); }
  else { const k = sp(lt, c.t, SP.soft); p = { ...p, x: lerp(c.from[0], p.x, k), y: lerp(c.from[1], p.y, k) }; s = lerp(.7, 1, k); }
  return { ...p, s, a };
}
/* uniform implode about the target: position and size shrink together, with a swirl */
function hookImplode(u, swirl) {
  if (u <= 0) return; const [tx, ty] = HOOK.T, q = ei(u), k = (1 - q) * (1 + .06 * Math.sin(Math.PI * clamp(u / .38)));
  g.translate(tx, ty); g.rotate(swirl * q); g.scale(k, k); g.translate(-tx, -ty);
}
function hookChipDraw(c, x, y, r, drain, back, acc) {
  softShadow(x - r, y - r, 2 * r, 2 * r, r, { blur: r * .7, dy: r * .28, alpha: .13 * (1 - .5 * drain) });
  const f0 = c.lane ? COL.paper : COL.lav;
  circle(x, y, r, mix(mixHex(f0, COL.canvas, back * .3), HOOK_GREY_FILL, drain));
  ring(x, y, r - 1, 2, mix(c.lane ? COL.contour : COL.pale, HOOK_GREY_RING, drain));
  const icCol = c.lane ? COL.violet : COL.deep, isz = r * (c.lane ? .9 : .92);
  if (drain > .01) icon(c.ic, x, y, isz, HOOK_GREY_ICON, 2);
  if (drain < .99) { g.save(); g.globalAlpha *= (1 - drain) * (1 - back * .25); icon(c.ic, x, y, isz, icCol, 2); g.restore(); }
  if (c.acc) { const ax = x + r * .66, ay = y - r * .66; circle(ax, ay, r * .24, COL.paper); circle(ax, ay, r * .17 * acc, mix(c.acc, HOOK_GREY_RING, drain)); }
}

SC.hook = {
  init(s) {
    const st = { len: s.len, tStop: at(s, 'stop'), tL02: voLine(s, 'L02').end, tSeason: at(s, 'season') + .25 };
    st.tI = s.len - .64;                                  // implode
    st.tP = st.tStop + .34;                               // dotted path attempt
    st.tB = clamp(st.tL02 - .62, st.tP + .72, st.tI - .55); // path breaks
    const prim = HOOK.chips.filter(c => c.lane === 0);
    prim.forEach(c => { c.t = at(s, c.key) - .04; });
    const tD = prim[3].t;
    HOOK.chips.filter(c => c.lane === 1).forEach((c, k) => { c.t = lerp(tD + .12, st.tStop - .46, k / 3); });
    HOOK.chips.forEach((c, i) => { c.i = i; });
    st.chips = HOOK.chips;
    // integrate the spin: each lane ramps up with the chaos, then decays from 'stop'
    const dt = 1 / 120, n = Math.ceil((s.len + 1) / dt) + 2, t0 = prim[0].t, tS = st.tStop;
    const decay = t => (t < tS ? 1 : .05 + .95 * Math.exp(-3.3 * (t - tS)));
    const w0 = t => HOOK.lanes[0].w * (.16 * smooth(0, t0, t) + .84 * Math.pow(smooth(t0 - .4, tS - .05, t), 1.25)) * decay(t);
    const w1 = t => HOOK.lanes[1].w * smooth(tD - .2, tS - .1, t) * decay(t);
    st.phi0 = [0]; st.phi1 = [0]; st.phi0.dt = st.phi1.dt = dt;
    for (let i = 1; i < n; i++) { const t = (i - .5) * dt; st.phi0.push(st.phi0[i - 1] + w0(t) * dt); st.phi1.push(st.phi1[i - 1] + w1(t) * dt); }
    // slots: lane 0 so the first disc springs out at the left of the student; lane 1 evenly between
    const base0 = 2.62 - hookPhi(st.phi0, prim[0].t), base1 = base0 + hookPhi(st.phi0, st.tB) - hookPhi(st.phi1, st.tB) + Math.PI / 4;
    for (const c of HOOK.chips) {
      c.a0 = c.lane ? base1 + c.slot * Math.PI / 2 : base0 + c.slot * Math.PI / 2;
      if (c.lane === 1) { const p = hookOrbit(st, c, c.t + .6), dx = p.x - HOOK.O[0], dy = p.y - HOOK.O[1], l = Math.hypot(dx, dy * 1.6) || 1; c.from = [p.x + dx / l * 1050, p.y + dy * 1.6 / l * 1050]; }
    }
    // look: the student glances toward each new disc, then at the path, then down
    st.looks = prim.map(c => ({ t: c.t + .05, v: clamp((hookOrbit(st, c, c.t).x - 960) / 420, -1, 1) * .85 }))
      .concat([{ t: tS + .1, v: 0 }, { t: st.tP + .1, v: .8 }, { t: st.tB + .15, v: .1 }]);
    // the attempted path (world), leaving the student to the right
    const [bx, by, br] = HOOK.B;
    st.path = lut([[bx + br * .94, by + br * .3], [1170, 612], [1290, 640], [1405, 598], [1488, 522], [1590, 498], [1705, 534]]);
    const R = rng(4127);
    st.frags = Array.from({ length: 8 }, (_, k) => ({ dx: (R() - .3) * 120, dy: 50 + R() * 90, rot: (R() - .5) * 1.4, d: R() * .12 + k * .025 }));
    // SFX
    cue(s, .12, 'swish', .25, { x: 960 });
    for (const c of HOOK.chips) { if (c.lane && c.slot % 2) continue; const p = hookOrbit(st, c, c.t + (c.lane ? .45 : 0)); cue(s, c.t + (c.lane ? .42 : 0), 'tick', c.lane ? .32 : .55, { x: Math.round(p.x) }); }
    cue(s, st.tStop, 'stop', .7, { x: 960 });
    cue(s, st.tB, 'reverse', .22, { x: 1400 });
    cue(s, st.tI - .05, 'suck', .7, { x: 960 });
    return st;
  },

  bg(lt, st) {
    if (!st || !st.chips) return {};
    let tg = 0;
    for (const c of st.chips) tg += c.lane ? .05 * sp(lt, c.t + .3, SP.soft) : .085 * sp(lt, c.t, SP.soft) + .16 * spInOut(lt, c.t, c.t + .16, SP.pop, SP.soft);
    tg *= 1 - .45 * smooth(st.tStop, st.tStop + 1, lt);
    tg *= 1 - smooth(st.tI - .15, st.tI + .3, lt);
    return { contours: { tangle: tg, alpha: .5 - .13 * smooth(st.tStop, st.tStop + .9, lt) + .05 * smooth(st.tI, st.len, lt) } };
  },

  draw(lt, st) {
    const tS = st.tStop, tI = st.tI, len = st.len;
    // camera: push 1.0 -> 1.12 as the chaos builds, gentle drift, centred again for the implode (plus a push into the dot)
    const env = 1 - smooth(tI - 1, tI - .05, lt);
    const c = {
      x: 960 + 34 * Math.sin(.75 * lt) * env, y: 540 + 12 * Math.sin(.55 * lt + .6) * env * smooth(0, .8, lt),
      z: (lerp(1, 1.12, eio(seg(lt, 0, tS))) + .02 * smooth(tS, tI, lt)) * (1 + .2 * ei(seg(lt, tI, .5))), rot: .014 * hookChaos(st, lt) * Math.sin(1.4 * lt)
    };
    const drain = smooth(tS + .04, tS + .8, lt), q = (d = 0) => seg(lt, tI + d, .4);
    // chips: sort by depth; back half behind the student
    const items = [];
    for (const ch of st.chips) {
      if (lt < ch.t) continue;
      const p = hookChipAt(st, ch, lt), back = (1 - p.d) / 2;
      items.push({ ch, p, back, z: p.d });
    }
    items.sort((a, b) => a.z - b.z);
    const drawItem = it => {
      const { ch, p, back } = it, qq = q(ch.lane ? .02 : .06 + ch.slot * .015);
      if (qq > .97) return;
      const k = lerp(.72, 1.12, 1 - back), r = HOOK.lanes[ch.lane].r * k * p.s, acc = sp(lt, ch.t + .18, SP.pop);
      layer(c, lerp(.9, 1.1, 1 - back), () => {
        g.save(); hookImplode(qq, ch.lane ? -1.3 : 1.5); g.globalAlpha *= p.a;
        // spawn ring: the disc pushes out of the field
        if (ch.lane === 0) shock(p.x, p.y + 6, seg(lt, ch.t, .7), 96, COL.pale, 5);
        hookChipDraw(ch, p.x, p.y, r, drain, back, acc);
        g.restore();
      });
    };
    // faint orbit tracks: draw on with the first disc of each lane, drain after 'stop'; back half behind the student
    const trk = (lane, front) => {
      const c0 = st.chips.find(ch => ch.lane === lane), p = brand(seg(lt, c0.t - .1, .9)), a = (lane ? .55 : .8) * (1 - .6 * drain) * (1 - smooth(tI - .05, tI + .25, lt));
      if (p <= 0 || a <= .01) return;
      const s0 = front ? 0 : Math.PI;
      layer(c, 1, () => { g.save(); g.globalAlpha *= a; hookTrack(st, lane, lt, s0, s0 + Math.PI * p, COL.contour, lane ? 1.6 : 2); g.restore(); });
    };
    trk(1, false); trk(0, false);
    items.filter(it => it.z < 0).forEach(drawItem);
    // the student (a soft season ring pulses out once as she arrives)
    const [bx, by, br] = HOOK.B, pB = sp(lt, .1, SP.text), pIn = sp(lt, .26, SP.text), qB = q(.12);
    layer(c, 1, () => { shock(bx, by, seg(lt, st.tSeason, 1.1), br + 150, COL.pale, 4); });
    if (qB < .97 && pB > .001) layer(c, 1, () => {
      g.save(); hookImplode(qB, .4);
      const y = by + (1 - pB) * 70, a = clamp(pB * 1.6);
      g.globalAlpha *= a;
      softShadow(bx - br, y - br, 2 * br, 2 * br, br, { blur: 44, dy: 20, alpha: .16 });
      circle(bx, y, br + 9, COL.paper); ring(bx, y, br + 9, 2, COL.contour);
      let look = 0; for (let i = 0; i < st.looks.length; i++) look += (st.looks[i].v - (i ? st.looks[i - 1].v : 0)) * smooth(st.looks[i].t, st.looks[i].t + .28, lt);
      const mood = lt < st.chips[2].t + .1 ? 'focus' : 'worried';
      bust(bx, y, br, HOOK.PAL, COL.lav, lt, { mood, look, dy: (1 - pIn) * br * 1.1, seed: 2 });
      g.restore();
    });
    trk(0, true); trk(1, true);
    // the attempted path: dotted violet line with a faint spark at its head; then it breaks and drains
    const pp = .55 * sp(lt, st.tP, SP.soft) + .45 * sp(lt, st.tP + .48, SP.soft), brk = lt >= st.tB;
    if (lt > st.tP && q(.04) < .97) layer(c, 1.04, () => {
      g.save(); hookImplode(q(.04), .9);
      const L = st.path;
      if (!brk) {
        pathDraw(L, pp, COL.violet, 10, { dash: [.5, 21] });
        const h = L.at(pp); spark(h.x, h.y, .75, .8 * clamp(pp * 4));
      } else {
        const pe = .55 * sp(st.tB, st.tP, SP.soft) + .45 * sp(st.tB, st.tP + .48, SP.soft), n = st.frags.length;
        const fade = 1 - smooth(st.tB + .5, st.tB + 1.1, lt), gd = smooth(st.tB + .05, st.tB + .5, lt);
        st.frags.forEach((f, k) => {
          const a = pe * k / n, b = pe * (k + 1) / n - pe * .025, m = L.at((a + b) / 2), e = eo(seg(lt, st.tB + f.d, .9));
          g.save(); g.translate(m.x + f.dx * e, m.y + f.dy * e * e); g.rotate(f.rot * e); g.translate(-m.x, -m.y); g.globalAlpha *= fade;
          pathDraw(L, b, mix(COL.violet, HOOK_GREY_ICON, gd), 10, { from: a, dash: [.5, 21] });
          g.restore();
        });
        const h = L.at(pe), fz = seg(lt, st.tB, .35); spark(h.x, h.y + 20 * fz * fz, .75 * (1 - fz), .8 * (1 - fz));
      }
      g.restore();
    });
    items.filter(it => it.z >= 0).forEach(drawItem);
    // the ink dot (screen space): exactly HOOK.DOT px radius at screen centre by the end; the reveal starts from it
    const ui = seg(lt, tI - .02, .42);
    if (ui > 0 && ui < 1) { g.save(); g.globalAlpha *= .5 * Math.sin(Math.PI * ui); ring(HOOK.T[0], HOOK.T[1], lerp(520, 10, ei(ui)), 2.5 + 3 * ui, COL.pale); g.restore(); }
    const dr = HOOK.DOT * hookFin(sp(lt, tI + .26, SP.ui), smooth(len - .14, len - .04, lt));
    if (dr > .05) circle(HOOK.T[0], HOOK.T[1], dr, COL.logoInk);
  }
};
