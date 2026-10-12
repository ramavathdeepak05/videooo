/* ui/resume.js: resume document + ATS check panel. Pure functions of their arguments. No readable fake text (bars only).
   resumeDoc(w, h, lt, o)        resume page in LOCAL coords (0..w, 0..h) so it can be passed straight to tilt3d.
                                 o = {scan 0..1 (keyword pills already passed by the scan line light up violet), sec 0..1 (section
                                 heads get a violet underline), fmt 0..1 (alignment guides flash), pal (avatar palette), p (build 0..1)}
   resumeScanLine(x, y, w, h, p, o)  scan line over a resume rect (x,y = top-left, world coords): violet line + soft trailing band,
                                 evidence spark riding its right end. o = {alpha}
   atsPanel(x, y, s, lt, o)      "ATS check" panel centred at x,y: progress ring with odometer (no ranking claims) + three check rows
                                 "Sections" "Keywords" "Format" with verified-green ticks. o = {V (ring value 0..100), tRing (ring draws),
                                 tRows (rows rise, 60ms stagger), ticks [t0,t1,t2] (tick times), alpha}
   atsRingTip(V)                 [dx, dy] of the ring head relative to the panel centre (local units).
   atsCheckRow(x, y, w, str, ic, lt, tIn, tTick)  one row: icon + label (mask-rise) + check circle that ticks green. */
const RDOC = { W: 500, H: 680 };
const ATSP = { W: 460, H: 600, RY: -150, RR: 96, RW: 16, ROWS: [['Sections', 'layout-list'], ['Keywords', 'key-round'], ['Format', 'align-left']] };
/* keyword pills per section [section, line, xFrac, wFrac] */
const RDOC_KW = [[0, 0, .52, .22], [0, 2, .1, .26], [1, 1, .44, .3], [2, 0, .06, .24], [2, 2, .5, .28]];
function resumeDoc(w, h, lt, o = {}) {
  const scan = o.scan || 0, sec = clamp(o.sec || 0), fmt = clamp(o.fmt || 0);
  rrect(1, 1, w - 2, h - 2, 24, COL.paper, COL.contour, 2);
  // header: avatar + name bars + contact pills
  if (typeof bust === 'function') bust(86, 92, 48, o.pal === undefined ? 0 : o.pal, COL.lav, lt, { seed: 2 });
  else circle(86, 92, 48, COL.lav);
  rrect(158, 64, 196, 18, 9, COL.ink); rrect(158, 96, 140, 12, 6, COL.pale);
  [[158, 62], [228, 84], [320, 54]].forEach(([x, ww]) => rrect(x, 124, ww, 14, 7, COL.lav));
  line(36, 172, w - 36, 172, COL.contour, 1.5);
  // three sections: head (violet tick + bar) and body bars; keyword pills light up as the scan line passes
  const y0 = [204, 362, 520], scanY = lerp(-20, h + 20, scan);
  for (let s = 0; s < 3; s++) {
    const y = y0[s];
    rrect(36, y - 8, 16, 16, 5, COL.violet); rrect(62, y - 8, 128 + s * 18, 16, 8, COL.navy);
    if (sec > .01) { const k = clamp(sec * 3 - s * .6); if (k > 0) line(62, y + 18, 62 + (128 + s * 18) * eo(k), y + 18, COL.violet, 3); }
    const r = rng(31 + s * 7);
    for (let l = 0; l < 3; l++) {
      const ly = y + 42 + l * 30, lw = (w - 72 - 26) * (.62 + r() * .38);
      rrect(62, ly - 6, lw, 12, 6, COL.contour);
      circle(44, ly, 3.5, COL.pale);
    }
  }
  for (const [s, l, xf, wf] of RDOC_KW) {
    const ly = y0[s] + 42 + l * 30, x = 62 + (w - 98) * xf, ww = (w - 98) * wf;
    const on = smooth(ly - 10, ly + 30, scanY);
    rrect(x, ly - 9, ww, 18, 9, mix(COL.lav, '#E6DAFF', on), on > .02 ? rgba(COL.violet, .85 * on) : null, 2);
    rrect(x + 10, ly - 3, ww - 20, 6, 3, mix(COL.pale, COL.violet, on));
  }
  // format: alignment guides flash
  if (fmt > .01 && fmt < .999) {
    const a = Math.sin(Math.PI * fmt);
    g.save(); g.globalAlpha *= a * .9;
    line(36, 186, 36, h - 40, COL.violet, 2, 1, [6, 8]); line(62, 186, 62, h - 40, COL.violet, 2, 1, [6, 8]); line(w - 36, 186, w - 36, h - 40, COL.violet, 2, 1, [6, 8]);
    g.restore();
  }
}
function resumeScanLine(x, y, w, h, p, o = {}) {
  const a = (o.alpha === undefined ? 1 : o.alpha) * Math.sin(Math.PI * clamp(p)); if (a <= .01) return;
  const yy = y + lerp(-20, h + 20, clamp(p));
  g.save(); g.globalAlpha *= a;
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  const gr = g.createLinearGradient(0, yy - 110, 0, yy);
  gr.addColorStop(0, rgba(COL.violet, 0)); gr.addColorStop(1, rgba(COL.violet, .14));
  g.fillStyle = gr; g.fillRect(x, yy - 110, w, 110);
  g.restore();
  g.save(); g.globalAlpha *= a; line(x - 14, yy, x + w + 14, yy, COL.violet, 3); g.restore();
  spark(x + w + 14, yy, 1.1, a);
}
function atsRingTip(V) { const ang = -Math.PI / 2 + TAU * clamp(V / 100); return [ATSP.RR * Math.cos(ang), ATSP.RY + ATSP.RR * Math.sin(ang)]; }
function atsCheckRow(x, y, w, str, ic, lt, tIn, tTick) {
  const pi = sp(lt, tIn, SP.text); if (pi <= .002) return;
  g.save(); g.globalAlpha *= clamp(pi * 1.5);
  icon(ic, x + 14, y, 28, COL.lilac, 2);
  g.restore();
  typeRise(str, x + 48, y, lt, tIn + .04, { size: 30, weight: 600, face: 'I', col: COL.ink, align: 'left' });
  const cx = x + w - 20, pk = sp(lt, tTick, SP.pop);
  ring(cx, y, 18, 2.5, rgba(COL.contour, clamp(pi * 1.5) * (1 - clamp(pk * 2))));
  if (pk > .002) tf(cx, y, lerp(.4, 1, pk), 0, () => { circle(0, 0, 19, COL.verified); icon('check', 0, 1, 24, '#FFFFFF', 3); }, clamp(pk * 2));
  const q = seg(lt, tTick, .5);
  if (q > 0 && q < 1) ring(cx, y, 19 + 9 * eo(q), 2, rgba(COL.verified, .3 * (1 - q)));
}
function atsPanel(x, y, s, lt, o = {}) {
  const a = o.alpha === undefined ? 1 : o.alpha; if (a <= .01) return;
  const V = o.V || 0, tR = o.tRing || 0, tRows = o.tRows || 0, ticks = o.ticks || [99, 99, 99];
  tf(x, y, s, 0, () => {
    if (o.card !== false) card(-ATSP.W / 2, -ATSP.H / 2, ATSP.W, ATSP.H, 28, { lw: 1.5 });
    // ring
    const rp = sp(lt, tR, SP.soft);
    if (rp > .002) {
      circle(0, ATSP.RY, ATSP.RR - 22, rgba(COL.lav, .6 * rp));
      g.beginPath(); g.arc(0, ATSP.RY, ATSP.RR, -Math.PI / 2, -Math.PI / 2 + TAU * eio(rp)); g.strokeStyle = COL.lav; g.lineWidth = ATSP.RW; g.lineCap = 'round'; g.stroke();
      arc(0, ATSP.RY, ATSP.RR, ATSP.RW, COL.violet, clamp(V / 100) * eio(rp));
      tf(0, ATSP.RY, 1, 0, () => odometer(0, 0, V, { to: 99, size: 64, col: COL.ink }), clamp(rp * 2 - .3));
    }
    typeRise('ATS check', 0, ATSP.RY + ATSP.RR + 50, lt, tR + .12, { size: 30, weight: 600, face: 'I', col: COL.deep });
    const dp = sp(lt, tRows - .05, SP.text);
    if (dp > .01) line(-ATSP.W / 2 + 40, 40, lerp(-ATSP.W / 2 + 40, ATSP.W / 2 - 40, eo(dp)), 40, COL.contour, 1.5);
    ATSP.ROWS.forEach(([str, ic], i) => {
      const ry = 100 + i * 70;
      atsCheckRow(-ATSP.W / 2 + 40, ry, ATSP.W - 80, str, ic, lt, tRows + i * .06, ticks[i]);
    });
  }, a);
}
