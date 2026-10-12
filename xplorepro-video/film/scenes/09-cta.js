/* scenes/09-cta.js: L17 "Book a demo today. xplorepro dot ai." (anchors demo book url)
   Match cut from converge (owned here too): the inverse lockup springs up while cta.bg(lt) eases the dark field to canvas; the
   lockup's colours interpolate inverse to normal by the effective bg lightness. The spark on the needle tip launches a line that
   loops around the mark and lands as a straight line under the lockup, which thickens into the "Book a Demo" pill on 'demo'
   (violet, white label, never green); the spark slides into the pill's arrow disc. A cursor (mouse-pointer-2) glides in and presses
   on 'book' (scale .96, ripple rings, click). "xplorepro.ai" mask-rises on 'url'. Hold with gentle drift; the last .6 s eases to
   calm canvas (never black). Uses CONV / convLockGeo / convTip / convSpark from scenes/08-converge.js. */
const CTA = { UP_Y: 352, UP_HW: 132, PILL_Y: 640, PILL_H: 92, PAD: 50, DISC_R: 30, LABEL: 'Book a Demo', LSIZE: 40,
  URL: 'xplorepro.ai', URL_DY: 116, URL_SIZE: 40, CANVAS: '#FBFAF7', FIELD_D: '#B79BFF', FIELD_L: '#DCCEFF' };
const CTA_PTR = new Path2D('M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z');
const ctaQ = lt => eio(seg(lt, 0, .85));
/* effective bg lightness (0 dark .. 1 canvas) including the engine's cross-cut lerp over [start-.5, start+.5] */
const ctaLight = lt => (lt < .5 ? eio(lt + .5) * ctaQ(lt) : ctaQ(lt));
function ctaPose(lt) { const u = sp(lt, 0, { dur: .95, bounce: 0 }); return convLockGeo(960, lerp(CONV.LOCK.y, CTA.UP_Y, u), lerp(CONV.LOCK.hw, CTA.UP_HW, u)); }
function ctaLockup(G, inv) {
  if (inv < .99) { vectorMark(G.mx, G.my, G.mh, {}); wordmark(G.wx, G.cy, G.hw, 1); }
  if (inv > .01) { g.save(); g.globalAlpha *= inv; vectorMark(G.mx, G.my, G.mh, { inverse: true }); wordmark(G.wx, G.cy, G.hw, 1, { inverse: true }); g.restore(); }
}
/* the loop: needle tip, up and back over the mark, down its left side, into the pill row */
function ctaLoop(tx, ty, st) {
  const [fx, fy] = st.ftip, PY = CTA.PILL_Y, PL = st.pl;
  return lut([[tx, ty], [tx + 44, ty - 50], [fx - 6, fy - 112], [fx - 130, fy - 110], [fx - 218, fy - 10], [fx - 214, PY - 130], [fx - 150, PY - 32], [PL - 84, PY - 2], [PL, PY]], 220);
}
function ctaCursor(x, y, k, a) {
  if (a <= .01) return;
  tf(x, y, k, 0, () => {
    softShadow(-2, 2, 30, 30, 15, { blur: 14, dy: 6, alpha: .16, spread: 0 });
    g.scale(2.4, 2.4); g.translate(-4.4, -4.4); g.lineJoin = 'round';
    g.fillStyle = COL.ink; g.fill(CTA_PTR); g.strokeStyle = '#FFFFFF'; g.lineWidth = 1.3; g.stroke(CTA_PTR);
  }, a);
}
SC.cta = {
  cutIn: { type: 'match', blurAcross: true },
  init(s) {
    const st = { len: s.len, tD: at(s, 'demo'), tB: at(s, 'book'), tU: at(s, 'url') };
    st.tLine = Math.max(.22, st.tD - .52); st.tEnd = st.tLine + .5; st.tP = Math.max(st.tD - .06, st.tEnd - .04); st.tSh = st.tU + .55;
    const lw = withCtx(document.createElement('canvas').getContext('2d'), () => textWidth(CTA.LABEL, CTA.LSIZE, 700, 'D'));
    const PW = CTA.PAD + lw + 26 + 2 * CTA.DISC_R + 14;
    st.pl = 960 - PW / 2; st.pr = 960 + PW / 2; st.lx = st.pl + CTA.PAD + lw / 2; st.dx = st.pr - 14 - CTA.DISC_R;
    const G = convLockGeo(960, CTA.UP_Y, CTA.UP_HW); st.ftip = convTip(G.mx, G.my, G.mh);
    cue(s, .04, 'swish', .28, { x: 960 }); cue(s, st.tLine, 'whoosh', .3, { x: 620 });
    cue(s, st.tD - .04, 'pop', .45, { x: 960 }); cue(s, st.tB, 'click', .3, { x: 1030 }); cue(s, st.tU, 'tick', .3, { x: 960 });
    cue(s, st.tSh, 'shine', .3, { x: 1000 });
    return st;
  },
  bg(lt, st) {
    const q = ctaQ(lt), e = st && st.len ? smooth(st.len - .6, st.len, lt) : 0;
    return { col: mixHex(CONV.DARK, CTA.CANVAS, q), glow: { x: 960, y: 540, r: 1000, col: CONV.GLOW, alpha: .7 * (1 - q) },
      contours: { alpha: lerp(.1, .42, q) * (1 - .25 * e), col: mixHex(CTA.FIELD_D, CTA.FIELD_L, q) } };
  },
  draw(lt, st) {
    const A = 1;                                       // the end card holds on the final frame (players freeze on it)
    const light = ctaLight(lt), G = ctaPose(lt), PY = CTA.PILL_Y, Lb = st.pr - st.pl;
    const zg = CONV.END_Z + .025 * smooth(0, st.len, lt), dr = 6 * smooth(0, st.len, lt);
    g.save(); g.globalAlpha *= A; g.translate(960, 540); g.scale(zg, zg); g.translate(-960, -540 - dr);
    ctaLockup(G, 1 - light);
    const tk = G.hw / CONV.LOCK.hw;
    tf(960, G.cy + CONV.TAG_DY * tk, tk, 0, () => type(CONV.TAG, 0, 0, { size: CONV.TAG_SIZE, weight: 600, face: 'I', col: mix(CONV.TAG_COL, COL.muted, light) }));
    // line: needle tip -> loop -> pill row; the tail chases the head
    const [tx, ty] = convTip(G.mx, G.my, G.mh), Lp = ctaLoop(tx, ty, st), La = Lp.len, tot = La + Lb;
    const lineCol = mix(CONV.LINE, COL.violet, light);
    const sh = tot * brand(seg(lt, st.tLine, .5)), stl = La * eio(seg(lt, st.tLine + .18, .48));
    if (sh > stl && stl < La - .5) pathDraw(Lp, Math.min(sh, La) / La, lineCol, 6, { from: stl / La });
    const ph = sp(lt, st.tP, SP.ui), pr = spInOut(lt, st.tB - .03, st.tB + .09, { dur: .14, bounce: 0 }, { dur: .45, bounce: 0 });
    // ripple rings on the press
    [0, .14].forEach(k => { const e = seg(lt, st.tB + k, .85); if (e <= 0 || e >= 1) return; const d = eo(e) * 64, h = CTA.PILL_H + 2 * d; rrect(st.pl - d, PY - h / 2, Lb + 2 * d, h, h / 2, null, rgba(COL.pale, .6 * (1 - e)), 2.5); });
    tf(960, PY, 1 - .04 * pr, 0, () => {
      g.translate(-960, -PY);
      const h = lerp(6, CTA.PILL_H, ph), wv = lt < st.tEnd ? clamp(sh - La, 0, Lb) : Lb, ww = Math.max(h, wv);
      if (sh > La || ph > .002) {
        if (ph > .002) softShadow(st.pl, PY - h / 2, ww, h, h / 2, { blur: 30, dy: 12, alpha: .2 * ph, col: 'rgba(94,39,216,1)' });
        rrect(st.pl, PY - h / 2, ww, h, h / 2, mix(CONV.LINE, COL.violet, Math.max(light, ph)));
        if (ph > .002) {
          g.save(); g.beginPath(); g.roundRect(st.pl, PY - h / 2, ww, h, h / 2); g.clip();
          typeRise(CTA.LABEL, st.lx, PY, lt, st.tD, { size: CTA.LSIZE, weight: 700, col: '#FFFFFF' });
          const us = seg(lt, st.tSh, .75);
          if (us > 0 && us < 1) {
            const bx = lerp(st.pl - 160, st.pr + 160, eio(us)), gr = g.createLinearGradient(bx - 90, 0, bx + 90, 0);
            gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, `rgba(255,255,255,${.26 * Math.sin(Math.PI * us)})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = gr; g.fillRect(st.pl, PY - h / 2, ww, h);
          }
          g.restore();
        }
      }
      // spark: tip -> loop -> pill row -> into the arrow disc (the disc pops over it)
      let px = tx, py = ty, ss = .8, sa = .9;
      if (lt >= st.tLine && sh < La) { const p = Lp.at(sh / La); px = p.x; py = p.y; ss = lerp(.8, 1, seg(lt, st.tLine, .15)); sa = 1; }
      else if (lt >= st.tLine && lt < st.tEnd) { px = st.pl + (sh - La); py = PY; ss = 1; sa = 1; }
      else if (lt >= st.tEnd) { const k = sp(lt, st.tEnd, SP.ui); px = lerp(st.pr, st.dx, k); py = PY; ss = lerp(1, .5, smooth(st.tEnd, st.tD + .25, lt)); sa = 1 - smooth(st.tD + .05, st.tD + .3, lt); }
      convSpark(px, py, ss, sa, CONV.HALO_END * (1 - light));
      const dp = sp(lt, st.tD + .02, SP.pop);
      if (dp > .01) {
        const hold = smooth(st.tD + .6, st.tD + 1.2, lt), br = .5 + .5 * Math.sin((lt - st.tD) * 2.6);
        if (hold > .01) ring(st.dx, PY, CTA.DISC_R + 5 + 4 * br, 2, `rgba(255,255,255,${.35 * hold * (1 - br)})`);
        tf(st.dx, PY, dp, 0, () => circle(0, 0, CTA.DISC_R, COL.paper));
        tf(st.dx + 5 * spInOut(lt, st.tB + .02, st.tB + .22, SP.ui, SP.soft), PY, dp, 0, () => icon('arrow-right', 0, 0, 30, COL.violet, 2.4));
      }
    });
    typeRise(CTA.URL, 960, PY + CTA.URL_DY, lt, st.tU, { size: CTA.URL_SIZE, weight: 500, col: COL.ink });
    // cursor: glides in on a bezier, presses on 'book', drifts off
    const c0 = st.tB - .62, cu = brand(seg(lt, c0, .58)), ca = smooth(c0, c0 + .14, lt) * (1 - smooth(st.tU - .25, st.tU + .35, lt));
    if (ca > .01) {
      const P0 = [1640, 1030], C = [1440, 760], P1 = [st.pr - 34, PY + 14], d2 = eio(seg(lt, st.tB + .3, 1.1));
      const x = lerp(lerp(P0[0], C[0], cu), lerp(C[0], P1[0], cu), cu) + 34 * d2, y = lerp(lerp(P0[1], C[1], cu), lerp(C[1], P1[1], cu), cu) + 40 * d2;
      ctaCursor(x, y, 1 - .1 * pr, ca);
    }
    g.restore();
  }
};
