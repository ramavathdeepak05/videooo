/* ui/matrix.js: skill-gap heatmap (6 columns x 5 rows) on a white card. Pure function of its arguments.
   skillMatrix(x, y, s, lt, o)  centred at x,y (local units scaled by s); card SKM.W x SKM.H.
     o = { vals   5x6 array of 0..1 (cell level on the lavender->violet ramp),
           t0     local time the diagonal cascade starts (cells spring in along r+c with o.stagger, default .05),
           gaps   [[r,c],...] gap cells; each gets ONE amber outline pulse starting at o.gapT (staggered .14),
           lift   0..1 improvement amount, liftT local time of the improvement wave (diagonal, gap cells close most),
           card   draw the card (default true), alpha }
   Row and column heads are icons (no readable text). matrixRamp(v) gives the ramp colour. */
const SKM = {
  rows: ['file-text', 'messages-square', 'code-xml', 'calculator', 'users'],
  cols: ['list-checks', 'target', 'timer', 'layers', 'git-branch', 'puzzle'],
  C: 70, G: 12, HEAD: 58, PAD: 44, W: 626, H: 594
};
function matrixRamp(v) {
  v = clamp(v);
  const S = [[0, COL.lav], [.3, COL.contour], [.52, COL.pale], [.72, COL.lilac], [.88, COL.violet], [1, COL.deep]];
  for (let i = 1; i < S.length; i++) if (v <= S[i][0]) return mix(S[i - 1][1], S[i][1], (v - S[i - 1][0]) / (S[i][0] - S[i - 1][0]));
  return COL.deep;
}
function skillMatrix(x, y, s, lt, o = {}) {
  const a = o.alpha === undefined ? 1 : o.alpha; if (a <= .01) return;
  const M = SKM, t0 = o.t0 || 0, st = o.stagger || .05, gaps = o.gaps || [], vals = o.vals || [];
  const gw = 6 * M.C + 5 * M.G, gh = 5 * M.C + 4 * M.G;
  tf(x, y, s, 0, () => {
    const L = -M.W / 2, T = -M.H / 2;
    if (o.card !== false) card(L, T, M.W, M.H, 28, { lw: 1.5 });
    const gx = L + M.PAD + M.HEAD, gy = T + M.PAD + M.HEAD;
    // column heads + row heads (icons)
    for (let c = 0; c < 6; c++) { const p = sp(lt, t0 + c * st, SP.ui); if (p > .01) tf(gx + c * (M.C + M.G) + M.C / 2, gy - M.HEAD / 2 - 4 + (1 - p) * 10, 1, 0, () => icon(M.cols[c], 0, 0, 28, COL.grey, 2), p); }
    for (let r = 0; r < 5; r++) { const p = sp(lt, t0 + r * st, SP.ui); if (p > .01) tf(gx - M.HEAD / 2 - 4 + (1 - p) * -10, gy + r * (M.C + M.G) + M.C / 2, 1, 0, () => icon(M.rows[r], 0, 0, 28, COL.grey, 2), p); }
    // cells: diagonal spring wave
    const isGap = (r, c) => gaps.findIndex(q => q[0] === r && q[1] === c);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) {
      const p = sp(lt, t0 + .12 + (r + c) * st, SP.pop); if (p <= .002) continue;
      const gi = isGap(r, c), base = (vals[r] && vals[r][c] !== undefined) ? vals[r][c] : .5;
      const lift = (o.lift || 0) * sp(lt, (o.liftT || 0) + (r + c) * .04, SP.ui) * (gi >= 0 ? .24 : .08) * (1 - base * .4);
      const v = clamp(base + lift), cx = gx + c * (M.C + M.G) + M.C / 2, cy = gy + r * (M.C + M.G) + M.C / 2;
      tf(cx, cy, lerp(.3, 1, p), 0, () => {
        rrect(-M.C / 2, -M.C / 2, M.C, M.C, 14, matrixRamp(v));
        if (v < .3) rrect(-M.C / 2 + .75, -M.C / 2 + .75, M.C - 1.5, M.C - 1.5, 13.5, null, rgba(COL.contour, .9), 1.5);
      }, clamp(p * 2));
      // one amber outline pulse per gap cell
      if (gi >= 0 && o.gapT !== undefined) {
        const q = seg(lt, o.gapT + gi * .14, .85);
        if (q > 0 && q < 1) {
          const k = 4 + 14 * eo(q), aa = Math.sin(Math.PI * Math.min(1, q * 1.6)) * (1 - q * .4);
          g.save(); g.globalAlpha *= clamp(aa);
          rrect(cx - M.C / 2 - k / 2, cy - M.C / 2 - k / 2, M.C + k, M.C + k, 14 + k / 2, null, COL.amber, 3 * (1 - q) + 1.2);
          g.restore();
        }
      }
    }
    // ramp legend under the grid (lavender -> violet)
    const lp = sp(lt, t0 + .12 + 10 * st, SP.ui);
    if (lp > .01) {
      const lw = 220 * lp, lx = gx + gw - 220, ly = gy + gh + 40;
      const gr = g.createLinearGradient(lx, 0, lx + 220, 0);
      gr.addColorStop(0, COL.lav); gr.addColorStop(.45, COL.contour); gr.addColorStop(.75, COL.lilac); gr.addColorStop(1, COL.deep);
      g.save(); g.globalAlpha *= clamp(lp * 1.5); rrect(lx, ly - 6, lw, 12, 6, gr); g.restore();
      circle(gx + 7, ly, 7 * lp, COL.amber); bars(gx + 24, ly - 5, 120, 1, { h: 10, col: COL.contour, p: lp, seed: 5 });
    }
  }, a);
}
