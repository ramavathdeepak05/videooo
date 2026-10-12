/* ui/analytics.js: practice-interview feedback panel. Pure functions of their arguments.
   analyticsPanel(x, y, s, lt, o)  card ANP.W x ANP.H centred at x,y (local units scaled by s): four labelled bars
       "Clarity" "Pacing" "Language" "Filler words" that spring-fill with a 70ms stagger, and a pacing sparkline drawn with the
       evidence spark at its head. o = {t0 (local time the rows rise and bars fill), vals [4 x 0..1], alpha, card (default true)}
   anSparkline(x, y, w, h, pts, p, o)  line + soft area over [x, x+w] (y = baseline top), pts 0..1, drawn to progress p; o = {spark, alpha}
   Filler words is the one "lower is better" metric: a short amber bar (small accent). No scores, no verdicts. */
const ANP = { W: 440, H: 600, LABELS: ['Clarity', 'Pacing', 'Language', 'Filler words'], VALS: [.84, .72, .78, .2],
  PACE: [.42, .5, .46, .58, .52, .63, .57, .66, .6, .7, .65, .72] };
function anSparkline(x, y, w, h, pts, p, o = {}) {
  const a = o.alpha === undefined ? 1 : o.alpha; p = clamp(p); if (a <= .01 || p <= .002) return null;
  const P = pts.map((v, i) => [x + w * i / (pts.length - 1), y + h * (1 - v)]), L = lut(P, 120);
  g.save(); g.globalAlpha *= a;
  // soft area under the drawn part
  const n = Math.max(2, Math.round(L.pts.length * p)), gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, rgba(COL.violet, .16)); gr.addColorStop(1, rgba(COL.violet, 0));
  g.beginPath(); g.moveTo(L.pts[0][0], y + h);
  for (let i = 0; i < n; i++) g.lineTo(L.pts[i][0], L.pts[i][1]);
  g.lineTo(L.pts[n - 1][0], y + h); g.closePath(); g.fillStyle = gr; g.fill();
  pathDraw(L, p, COL.violet, 3.5);
  g.restore();
  const hd = L.at(p);
  if (o.spark !== false) spark(hd.x, hd.y, .95, a * (p < 1 ? 1 : 1 - .5 * clamp((o.after || 0))));
  return hd;
}
function analyticsPanel(x, y, s, lt, o = {}) {
  const a = o.alpha === undefined ? 1 : o.alpha; if (a <= .01) return;
  const A = ANP, t0 = o.t0 || 0, vals = o.vals || A.VALS;
  tf(x, y, s, 0, () => {
    const L = -A.W / 2, T = -A.H / 2;
    if (o.card !== false) card(L, T, A.W, A.H, 28, { lw: 1.5 });
    // header: icon badge + abstract title bars
    const hp = sp(lt, t0 - .1, SP.ui);
    if (hp > .01) tf(L + 62, T + 60, lerp(.6, 1, hp), 0, () => { circle(0, 0, 26, COL.lav); icon('chart-no-axes-column', 0, 0, 26, COL.deep, 2.2); }, clamp(hp * 2));
    bars(L + 104, T + 46, 200, 2, { h: 12, gap: 22, head: true, headCol: COL.navy, col: COL.contour, p: hp, seed: 23 });
    line(L + 36, T + 112, L + 36 + (A.W - 72) * eo(hp), T + 112, COL.contour, 1.5);
    // rows
    A.LABELS.forEach((str, i) => {
      const ly = T + 152 + i * 78, by = ly + 34, ti = t0 + i * .07;
      typeRise(str, L + 40, ly, lt, ti, { size: 28, weight: 600, face: 'I', col: COL.ink, align: 'left' });
      const tp = sp(lt, ti, SP.text); if (tp <= .01) return;
      rrect(L + 40, by - 6, (A.W - 80) * eo(tp), 12, 6, COL.lav);
      const fp = sp(lt, ti + .12, { dur: .9, bounce: 0 }), fw = (A.W - 80) * vals[i] * fp;
      if (fw > 1) {
        let fill = COL.amber;
        if (i < 3) { fill = g.createLinearGradient(L + 40, 0, L + 40 + (A.W - 80) * vals[i], 0); fill.addColorStop(0, COL.pale); fill.addColorStop(1, COL.violet); }
        rrect(L + 40, by - 6, Math.max(12, fw), 12, 6, fill);
        circle(L + 40 + Math.max(6, fw - 6), by, 9 * clamp(fp * 2), COL.paper); ring(L + 40 + Math.max(6, fw - 6), by, 9 * clamp(fp * 2), 3, i < 3 ? COL.violet : COL.amber);
      }
    });
    // pacing sparkline
    const sy = T + 470, sp0 = t0 + .32, pp = brand(seg(lt, sp0, .9));
    const ia = sp(lt, sp0 - .08, SP.text);
    if (ia > .01) { g.save(); g.globalAlpha *= ia; line(L + 40, sy - 10, L + 40 + (A.W - 80) * eo(ia), sy - 10, COL.contour, 1.5); icon('activity', L + 56, sy + 34, 26, COL.lilac, 2.2); line(L + 88, sy + 92, L + A.W - 40, sy + 92, COL.contour, 1.5, 1, [2, 8]); g.restore(); }
    anSparkline(L + 88, sy + 10, A.W - 128, 80, A.PACE, pp, { after: seg(lt, sp0 + .9, .6) });
  }, a);
}
