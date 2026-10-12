/* scenes/02-reveal.js: L03 "That's why: XplorePro." (anchor: logo)
   Match cut from the hook's 10px ink dot: the dot is the logo's pivot dot. Impact (dot springs, soft lavender shock), the needle
   draws outward from the dot with the evidence spark at its head, the violet half and the X strokes slide in while the contour
   field reorders and pinches into one path through the pivot dot. On the spoken name the mark springs left and the wordmark wipes out from behind it
   (specular sweep). Before the end the wordmark retracts into the mark and the mark settles centred at (960,540), height 150,
   alone: the hub the ecosystem scene starts from (match cut contract). */
const REVEAL = { H: 150, Z0: 1.9, START_DOT: 5 };
const revealFin = (p, k) => p + (1 - p) * k;
/* shared by draw() and bg(): camera, mark position, wordmark wipe (all pure in lt) */
function revealRig(lt, st) {
  const len = st.len, Lk = st.Lk, endK = smooth(len - .26, len - .04, lt);
  const pc = sp(lt, .12, { dur: 1.2, bounce: 0 });
  let z = lerp(REVEAL.Z0, 1, pc) * (1 + .022 * sp(lt, st.tO, SP.soft) * (1 - sp(lt, st.tC - .1, SP.soft)));
  let cx = lerp(st.dot0[0], 960, pc), cy = lerp(st.dot0[1], 540, pc);
  z = 1 + (z - 1) * (1 - endK); cx = 960 + (cx - 960) * (1 - endK); cy = 540 + (cy - 540) * (1 - endK);
  const pO = sp(lt, st.tO, SP.ui), pC = revealFin(sp(lt, st.tC, SP.ui), endK), u = pO - pC;
  const mx = lerp(960, Lk.x, u), my = lerp(540, Lk.y, u);
  const pw = clamp(sp(lt, st.tO + .04, { dur: .75, bounce: 0 }) - revealFin(sp(lt, st.tC - .06, { dur: .55, bounce: 0 }), endK), 0, 1);
  return { c: { x: cx, y: cy, z, rot: 0 }, mx, my, pw };
}

SC.reveal = {
  cutIn: { type: 'match' },
  init(s) {
    const st = { len: s.len, start: s.start, tL: at(s, 'logo') }, k = REVEAL.H / MARK.h;
    st.k = k;
    st.dot0 = [960 + MARK_DOT.x * REVEAL.H, 540 + MARK_DOT.y * REVEAL.H];       // pivot dot (world) with the mark centred
    st.dt0 = REVEAL.START_DOT / (MARK.dot[2] * k * REVEAL.Z0);                     // dot progress that equals the hook's ink dot
    // lockup geometry with the mark kept at 150 tall (proportions as core lockup())
    const Hw = REVEAL.H / .7365, ww = Hw * WORD.sw / WORD.sh, mw = REVEAL.H * 945 / 873, gap = Hw * .052, total = mw + gap + ww;
    st.Lk = { Hw, ww, mw, gap, x: 960 - total / 2 + mw / 2, y: 540 - Hw * .0743 };
    st.tO = Math.max(.7, st.tL - .16);                   // lockup opens on the spoken name
    st.tC = Math.max(st.tO + 1.0, s.len - .64);          // wordmark retracts, mark returns to centre
    st.tSh = st.tO + .36;                                // specular sweep
    const m2w = (px, py) => [960 + (px - MARK.cx) * k, 540 + (py - MARK.cy) * k];
    st.needle = lut([m2w(MARK.dot[0], MARK.dot[1]), m2w(965, 80)], 24);
    st.sheen = document.createElement('canvas'); st.sheen.width = WORD.sw; st.sheen.height = WORD.sh;
    cue(s, 0, 'impact', .85, { x: 960 }); cue(s, .02, 'sublogo', .8, { x: 960 });
    cue(s, st.tO, 'slide', .35, { x: 760 }); cue(s, st.tSh, 'shine', .45, { x: 1150 }); cue(s, st.tC, 'swish', .28, { x: 1000 });
    return st;
  },

  bg(lt, st) {
    if (lt < 0 || !st || !st.len) return { contours: { converge: 0, tangle: 0 } };
    // the field pinches into one trajectory that runs exactly through the pivot dot (screen space)
    const cv = .8 * sp(lt, .05, SP.soft) - .55 * sp(lt, st.tO, SP.soft) - .25 * sp(lt, st.tC, SP.soft);
    const R = revealRig(lt, st), [dx, dy] = camToScreen(R.c, R.mx + MARK_DOT.x * REVEAL.H, R.my + MARK_DOT.y * REVEAL.H);
    const C = CONTOUR_DEFAULT, T = st.start + lt;
    const base = C.amp[0] * Math.sin(C.k[0] * dx + C.speed[0] * T) + C.amp[1] * Math.sin(C.k[1] * dx + C.speed[1] * T + 1.3);
    return { contours: { converge: Math.max(0, cv), xs: 260, xe: dx, y0: lerp(540, dy - base, smooth(0, .3, lt)), tangle: 0, alpha: .5 } };
  },

  draw(lt, st) {
    const Lk = st.Lk, R = revealRig(lt, st), c = R.c, mx = R.mx, my = R.my, pw = R.pw, [sx, sy] = shake(lt, 0, 3, .3);
    g.save(); g.translate(sx, sy);
    layer(c, 1, () => {
      const dX = mx + MARK_DOT.x * REVEAL.H, dY = my + MARK_DOT.y * REVEAL.H;
      // impact rings
      shock(dX, dY, seg(lt, 0, .75), 120, COL.pale, 5);
      shock(dX, dY, seg(lt, .1, .95), 210, COL.contour, 3);
      // wordmark wipes out from behind the mark (moves with it, revealed left to right by a mask at the mark's edge)
      if (pw > .002) {
        const markR = mx + Lk.mw / 2, wl = markR + Lk.gap - (1 - pw) * 70, wy = 540;
        g.save(); g.beginPath(); g.rect(markR + 2, 0, Math.max(0, wl - markR - 2 + pw * (Lk.ww + 12)), H); g.clip();
        wordmark(wl, wy, Lk.Hw, 1);
        const us = seg(lt, st.tSh, .75);
        if (us > 0 && us < 1 && WORDC) {
          const x2 = st.sheen.getContext('2d'), bxp = lerp(-300, WORD.sw + 300, eio(us));
          x2.globalCompositeOperation = 'source-over'; x2.clearRect(0, 0, WORD.sw, WORD.sh);
          const gr = x2.createLinearGradient(bxp - 110, WORD.sh, bxp + 110, 0);
          gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
          x2.fillStyle = gr; x2.fillRect(0, 0, WORD.sw, WORD.sh);
          x2.globalCompositeOperation = 'destination-in'; x2.drawImage(WORDC, 0, 0); x2.globalCompositeOperation = 'source-over';
          g.save(); g.globalAlpha *= .34 * Math.sin(Math.PI * us); g.drawImage(st.sheen, wl, wy - Lk.Hw / 2, Lk.ww, Lk.Hw); g.restore();
        }
        g.restore();
      }
      // the mark builds around the pivot dot
      const dt = lerp(st.dt0, 1, sp(lt, 0, SP.pop));
      const nd = brand(seg(lt, .05, .5));
      vectorMark(mx, my, REVEAL.H, { dot: dt, needle: nd, violet: sp(lt, .3, SP.pop), chev: sp(lt, .44, SP.ui), arm: sp(lt, .52, SP.ui) });
      // evidence spark rides the needle head, then rests on the tip and fades
      const sa = clamp(nd * 6) * (1 - smooth(.62, .95, lt));
      if (sa > .01) { g.save(); g.translate(mx - 960, my - 540); sparkAlong(st.needle, nd, { trail: .45, w: 4, s: 1.05, alpha: sa }); g.restore(); }
    });
    g.restore();
  }
};
