/* scenes/05-readiness.js: L08 "One number that moves as you progress: your Placement Readiness Score." (anchors one score)
   L09 "Fix your resume to suit ATS." (anchors ats resume)  L10 "Practise interviews across HR, technical and coding rounds."
   (anchors hr technical coding interview)
   Match cut from the mentor's contract disc (white r150, 6px violet ring at 960,540): the disc grows into the gauge face while the
   ring unwinds into the progress arc, ticks light and the needle springs to 42; the camera glides right and the skill-gap heatmap
   cascades in on the same plane (amber pulse on the gaps). On 'score' the needle sweeps 42 -> 58 with the evidence spark on the arc head
   and the odometer rolls; the heatmap brightens in a diagonal wave. On 'ats' the gauge docks to a top-left HUD and the heatmap card
   flips over: its back is the "ATS check" panel; the resume card tilts in, a scan line passes, Sections / Keywords / Format tick
   green, the ring rolls 64 -> 86 and the evidence spark carries the result into the HUD (+6). On 'hr' a whip-pan (+1920px in .5s,
   forced 10-16 sample blur) lands on the practice-interview window: the tab underline springs HR -> Technical -> Coding with the content
   morphing (bubbles -> node diagram -> code tokens). On 'interview' the camera makes room for the feedback panel (bars + pacing
   sparkline) and the HUD ticks 64 -> 72. End (match-cut contract): everything clears and the window shrinks to the white 360x240
   card (r20, 2px contour stroke, mini two-tile layout) centred at (960,540), which the colleges scene picks up. */
const RD = {
  G1: [600, 500],                         // gauge centre (world, part 1); camera starts on it so the disc sits at (960,540)
  M1: [1330, 540],                        // heatmap card; its back face is the ATS panel (world)
  R2: [800, 540],                         // resume card centre (world)
  HUD: [150, 150], HS: .37,               // docked gauge (screen)
  FX: 1060,                               // part 2 framing x (the whip adds one screen width)
  WHIP: 1920, WD: .5,
  I3: [2980, 566],                        // interview window centre (world) = FX + WHIP
  A3: [3716, 566],                        // feedback panel centre (world)
  PAL: { skin: '#B97A50', hair: '#1A120D', shirt: '#7438F2', style: 'long' },   // the hook's student
  VALS: [[.9, .8, .72, .62, .76, .58], [.76, .68, .52, .44, .1, .48], [.7, .6, .8, .64, .5, .36], [.56, .08, .46, .6, .42, .3], [.62, .5, .38, .06, .34, .26]],
  GAPS: [[1, 4], [3, 1], [4, 3]]
};
const RD_NOB = { dur: 1.05, bounce: 0 }, RD_FLOW = { dur: .85, bounce: 0 };
/* needle value (springy) and odometer value (no overshoot) */
function rdVal(lt, st) { return 42 * sp(lt, .28, { dur: 1.05, bounce: .12 }) + 16 * sp(lt, st.tScore, SP.needle) + 6 * sp(lt, st.tH1, SP.needle) + 8 * sp(lt, st.tH2, SP.needle); }
function rdNum(lt, st) { return 42 * sp(lt, .28, RD_NOB) + 16 * sp(lt, st.tScore + .02, RD_FLOW) + 6 * sp(lt, st.tH1 + .02, RD_FLOW) + 8 * sp(lt, st.tH2 + .02, RD_FLOW); }
/* whip-pan curve: smootherstep (peak speed 1.9x mean, vs 3x for eio) so the forced multi-sample blur reads as a smear, not copies */
function rdWhip(lt, st) { const u = seg(lt, st.tWhip, RD.WD); return RD.WHIP * u * u * u * (u * (u * 6 - 15) + 10); }
/* camera: exact (600,500,1) at lt 0; glide right to frame gauge + heatmap, re-frame for the resume, whip, make room for feedback */
function rdCam(lt, st) {
  const K = st.camK, c = camAt(K, lt), u = seg(lt, st.tWhip, RD.WD), d = smooth(0, 1.4, lt);
  return { x: c.x + rdWhip(lt, st) + d * 6 * noise1(lt * .35, 4), y: c.y + d * 4 * noise1(lt * .3, 9), z: c.z * (1 - .05 * Math.sin(Math.PI * u)), rot: 0 };
}
function rdBokeh(lt, a) { for (let k = 0; k < 2; k++) { g.save(); g.translate(k * W, 0); bokeh(lt, 41 + k * 7, 5, { alpha: a, size: 130 }); g.restore(); } }

SC.readiness = {
  cutIn: { type: 'match' },
  init(s) {
    const st = { len: s.len, tOne: at(s, 'one'), tScore: at(s, 'score'), tAts: at(s, 'ats'), tRes: at(s, 'resume'),
      tHr: at(s, 'hr'), tTech: at(s, 'technical'), tCode: at(s, 'coding'), tInt: at(s, 'interview') };
    st.tWhip = st.tHr - .4;
    st.tDock = st.tAts - .32;
    st.tFlip = st.tAts - .3; st.tBack = st.tFlip + .38;
    st.tResIn = Math.max(st.tAts + .02, st.tRes - .95);
    st.tScan = st.tRes - .06;
    st.ticks = [st.tScan + .2, st.tScan + .37, st.tScan + .54];
    st.tRoll = st.tScan + .12;
    st.tFly = Math.min(st.ticks[2] + .1, st.tWhip - .3); st.tH1 = st.tFly + .42;
    st.tPanel = st.tInt - .22; st.tH2 = st.tInt + .62;
    st.tE = Math.max(s.len - .78, Math.min(st.tInt + 1.2, s.len - .55));     // keep >= ~1.2s of feedback if the VO runs late
    st.mT0 = .62; st.gapT = Math.min(st.mT0 + .7, st.tOne - .45);
    st.camK = [
      { t: 0, x: RD.G1[0], y: RD.G1[1], z: 1 },
      { t: 1.25, x: 985, y: 528, z: 1, ease: 'spring' },
      { t: st.tDock, x: 1000, y: 524, z: 1.05, ease: 'eio' },
      { t: st.tAts + .8, x: RD.FX, y: 548, z: 1, ease: 'spring' },
      { t: st.tWhip, x: RD.FX, y: 548, z: 1.03, ease: 'eio' },
      { t: st.tWhip + RD.WD, x: RD.FX, y: 548, z: 1, ease: 'eio' },
      { t: st.tPanel, x: RD.FX, y: 546, z: 1.025, ease: 'eio' },
      { t: st.tPanel + .95, x: RD.FX + 250, y: 548, z: 1, ease: 'spring' },
      { t: s.len, x: RD.FX + 262, y: 548, z: 1.01, ease: 'eio' }
    ];
    for (let i = 1; i < st.camK.length; i++) st.camK[i].t = Math.max(st.camK[i].t, st.camK[i - 1].t + .05);   // robust to shifted anchors
    // SFX (<= ~4/sec)
    cue(s, .02, 'swish', .3, { x: 960 });
    cue(s, .3, 'servo', .3, { x: 760 });
    cue(s, .55, 'slide', .3, { x: 1300 });
    cue(s, st.mT0 + .15, 'tick', .22, { x: 1300 });
    cue(s, st.gapT, 'tick', .26, { x: 1420 });
    cue(s, st.tOne - .04, 'shine', .3, { x: 600 });
    cue(s, st.tScore, 'servo', .55, { x: 600 }); cue(s, st.tScore + .04, 'roll', .45, { x: 600 });
    cue(s, st.tScore + .5, 'pop', .35, { x: 600 });
    cue(s, st.tDock, 'swish', .4, { x: 400 });
    cue(s, st.tResIn, 'slide', .35, { x: 800 });
    cue(s, st.tScan - .16, 'scan', .4, { x: 800 });
    st.ticks.forEach(t => cue(s, t, 'tick', .36, { x: 1450 }));
    cue(s, st.tWhip, 'whoosh', .75, { x: 1300 });
    cue(s, st.tHr + .08, 'click', .3, { x: 760 }); cue(s, st.tTech, 'click', .3, { x: 940 }); cue(s, st.tCode, 'click', .3, { x: 1100 });
    cue(s, st.tCode + .1, 'type', .3, { x: 960 });
    cue(s, st.tPanel, 'slide', .35, { x: 1450 }); cue(s, st.tInt + .12, 'roll', .3, { x: 1450 });
    cue(s, st.tH2, 'servo', .3, { x: 160 }); cue(s, st.tH2 + .04, 'pop', .3, { x: 330 });
    cue(s, st.tE, 'suck', .4, { x: 960 });
    return st;
  },

  bg(lt, st) {
    if (!st || st.tWhip === undefined) return {};
    // contour waves slide with the whip (parallax), then ease back so the field matches the next scene across the cut
    return { contours: { phase: .0021 * .35 * rdWhip(lt, st) * (1 - smooth(st.tWhip + RD.WD + .2, st.tE, lt)) } };
  },

  blur(lt, st) {
    if (!st || lt < st.tWhip - .03 || lt > st.tWhip + RD.WD + .03) return 0;
    const u = seg(lt, st.tWhip, RD.WD); return u > .22 && u < .78 ? 16 : 10;   // 10 samples across the whip, 16 at peak speed
  },

  draw(lt, st) {
    const c = rdCam(lt, st), len = st.len, tE = st.tE;
    layer(c, .3, () => rdBokeh(lt, .32 * smooth(0, .9, lt) * (1 - smooth(tE, tE + .5, lt))));

    // ---------- world: parts 1-2 (heatmap / ATS panel, resume) ----------
    if (lt < st.tWhip + RD.WD + .1) {
      g.save(); applyCam(c);
      // heatmap card (enters with a slight tilt, flips away on 'ats'), back face = ATS panel
      const pm = sp(lt, .45, SP.soft), fl = seg(lt, st.tFlip, .38);
      if (pm > .002 && fl < 1) {
        const ry = lerp(.32, 0, pm) + (Math.PI / 2) * ei(fl), cx = RD.M1[0] + (1 - pm) * 160, cy = RD.M1[1];
        const MW = SKM.W, MH = SKM.H;
        const pw = MW * Math.cos(ry); if (pw > 40) softShadow(cx - pw / 2, cy - MH / 2, pw, MH, 28, { alpha: .14 * pm * Math.cos(ry) });
        g.save(); g.globalAlpha *= clamp(pm * 1.6);
        tilt3d(MW, MH, () => {
          rrect(1, 1, MW - 2, MH - 2, 28, COL.paper, COL.contour, 1.5);
          skillMatrix(MW / 2, MH / 2, 1, lt, { vals: RD.VALS, t0: st.mT0, gaps: RD.GAPS, gapT: st.gapT, lift: 1, liftT: st.tScore + .08, card: false });
        }, cx, cy, ry, 0);
        g.restore();
      }
      const pb = seg(lt, st.tBack, .55);
      if (pb > 0) {
        const ry = -(Math.PI / 2) * (1 - eo(pb)), AW = ATSP.W, AH = ATSP.H, cx = RD.M1[0], cy = RD.M1[1], pw = AW * Math.cos(ry);
        if (pw > 40) softShadow(cx - pw / 2, cy - AH / 2, pw, AH, 28, { alpha: .14 * Math.cos(ry) });
        const V = 64 + 22 * brand(seg(lt, st.tRoll, .9));
        tilt3d(AW, AH, () => {
          rrect(1, 1, AW - 2, AH - 2, 28, COL.paper, COL.contour, 1.5);
          atsPanel(AW / 2, AH / 2, 1, lt, { V, tRing: st.tBack - .12, tRows: st.tBack + .22, ticks: st.ticks, card: false });
        }, cx, cy, ry, 0);
      }
      // resume card tilts in (ry -25deg -> 0, rx 8deg -> 0), scan line passes
      const pr = sp(lt, st.tResIn, SP.soft);
      if (pr > .002) {
        const RW = RDOC.W, RH = RDOC.H, cx = RD.R2[0] - (1 - pr) * 140, cy = RD.R2[1] + (1 - pr) * 70;
        const ry = lerp(-25, 0, pr) * Math.PI / 180, rx = lerp(8, 0, pr) * Math.PI / 180;
        const pw = RW * Math.cos(ry) * .97; softShadow(cx - pw / 2, cy - RH / 2 + 10, pw, RH - 20, 24, { alpha: .15 * pr, blur: 40, dy: 16 });
        const scan = eio(seg(lt, st.tScan, .75));
        g.save(); g.globalAlpha *= clamp(pr * 2.2);
        tilt3d(RW, RH, () => resumeDoc(RW, RH, lt, { scan, sec: sp(lt, st.ticks[0] - .04, SP.text), fmt: seg(lt, st.ticks[2] - .04, .7), pal: RD.PAL }), cx, cy, ry, rx);
        g.restore();
        resumeScanLine(cx - RW / 2, cy - RH / 2, RW, RH, seg(lt, st.tScan, .75));
      }
      g.restore();
    }

    // ---------- part 3: interview window, eyebrow, feedback panel ----------
    const e = lerp(sp(lt, tE, { dur: .7, bounce: 0 }), 1, smooth(len - .3, len - .05, lt));
    if (lt > st.tWhip - .05) {
      g.save(); applyCam(c);
      eyebrow('Practise interviews', RD.I3[0], RD.I3[1] - 372, lt, st.tHr - .12, { size: 28, out: tE - .05 });
      const pa = sp(lt, st.tPanel, SP.soft), qa = spring(lt - (tE - .08), .5, 0);
      if (pa > .002 && qa < .999) {
        const x = RD.A3[0] + (1 - pa) * 150 + qa * 160;
        softShadow(x - ANP.W / 2, RD.A3[1] - ANP.H / 2, ANP.W, ANP.H, 28, { alpha: .14 * pa * (1 - qa) });
        g.save(); g.globalAlpha *= clamp(pa * 1.8) * (1 - qa);
        rrect(x - ANP.W / 2, RD.A3[1] - ANP.H / 2, ANP.W, ANP.H, 28, COL.paper, COL.contour, 1.5);
        analyticsPanel(x, RD.A3[1], 1, lt, { t0: st.tInt + .02, card: false });
        g.restore();
      }
      g.restore();
      // window in screen space: tracks the camera, then shrinks to the contract card at (960,540) 360x240
      const [wx, wy] = camToScreen(c, RD.I3[0], RD.I3[1]);
      const k = lerp(c.z, IV.END, e), x = lerp(wx, 960, e), y = lerp(wy, 540, e);
      const tabs = [st.tHr, st.tTech, st.tCode];
      let talk = 0; tabs.forEach(t => { talk = Math.max(talk, spInOut(lt, t - .02, t + .3, SP.ui, SP.ui)); });
      interviewWindow(x, y, k, lt, { tabs, talk, mini: smooth(0, .28, e), pal: RD.PAL, shadow: 1 - smooth(.55, .97, e) });
    }

    // ---------- screen space: gauge (world-tracked, then HUD), chips, evidence spark ----------
    const d = sp(lt, st.tDock, { dur: .85, bounce: 0 }), [gx0, gy0] = camToScreen(c, RD.G1[0], RD.G1[1]);
    const gs = lerp(c.z, RD.HS, d), gx = lerp(gx0, RD.HUD[0], d), gy = lerp(gy0, RD.HUD[1], d);
    const hOut = sp(lt, tE + .05, { dur: .45, bounce: 0 });
    const v = rdVal(lt, st), num = rdNum(lt, st), m = sp(lt, 0, { dur: 1.1, bounce: 0 });
    const spk = Math.max(spInOut(lt, .3, 1.15), spInOut(lt, st.tScore - .04, st.tScore + .95), spInOut(lt, st.tH1 - .04, st.tH1 + .7), spInOut(lt, st.tH2 - .04, st.tH2 + .7));
    // 'one': soft rings + number emphasis
    const po = seg(lt, st.tOne - .06, 1.0);
    if (po > 0 && po < 1) { shock(gx, gy, po, 330 * gs, COL.pale, 5); shock(gx, gy, seg(lt, st.tOne + .08, 1.0), 420 * gs, COL.contour, 3); }
    if (hOut < .999) {
      gauge(gx, gy, gs * lerp(1, .8, hOut), lt, { v, num, m, spark: spk, pulse: Math.sin(Math.PI * seg(lt, st.tOne - .06, .65)),
        delta: { txt: '+16', p: sp(lt, st.tScore + .5, SP.ui) * (1 - sp(lt, st.tDock - .2, { dur: .35, bounce: 0 })) },
        shadow: smooth(0, .7, lt), alpha: 1 - hOut });
      // label under the gauge (out as it docks)
      tf(gx, gy + 322 * gs, gs, 0, () => typeRise('Placement Readiness Score', 0, 0, lt, st.tScore - .25, { size: 38, col: COL.ink, out: st.tDock - .12 }));
      // HUD delta chips
      const c1 = sp(lt, st.tH1 + .02, SP.ui) * (1 - sp(lt, Math.min(st.tH1 + 1.6, st.tH2 - .25), { dur: .35, bounce: 0 }));
      const c2 = sp(lt, st.tH2 + .02, SP.ui) * (1 - hOut);
      [[c1, '+6'], [c2, '+8']].forEach(([p, txt]) => {
        if (p > .01) tf(RD.HUD[0] + 166, RD.HUD[1] + (1 - p) * 10, lerp(.7, 1, p), 0, () => chip(txt, 0, 0, { size: 26, fill: COL.violet, col: '#FFFFFF', icon: 'trending-up', iconCol: '#FFFFFF', pad: 18, shadow: true }), clamp(p * 2));
      });
    }
    // evidence spark: ATS result flies into the HUD gauge
    const uf = seg(lt, st.tFly, .42);
    if (uf > 0 && uf < 1) {
      const [rx, ry] = atsRingTip(86), [fx, fy] = camToScreen(c, RD.M1[0] + rx, RD.M1[1] + ry);
      const [tx, ty] = gaugeTip(64), hx = RD.HUD[0] + tx * RD.HS, hy = RD.HUD[1] + ty * RD.HS;
      const L = lut([[fx, fy], [lerp(fx, hx, .5), Math.min(fy, hy) - 120], [hx, hy]], 80);
      sparkAlong(L, eio(uf), { trail: .28, w: 4, s: 1.05, alpha: smooth(0, .12, uf) });
    }
    if (lt > st.tH1 - .02) shock(RD.HUD[0], RD.HUD[1], seg(lt, st.tH1, .7), 120, COL.pale, 4);
  }
};
