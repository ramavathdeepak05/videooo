/* ui/gauge.js: the Placement Readiness Score gauge. Pure functions of their arguments.
   gauge(x, y, s, lt, o)   centred at x,y; local units (face radius 260) scaled by s.
     o = { v      needle value 0..100 (drive it with an SP.needle spring),
           num    odometer value in the face (defaults to v; give it a no-overshoot curve so digits never roll back),
           m      0..1 morph from the contract disc (0 = white disc r150 with a 6px violet ring, 1 = full gauge):
                  the disc grows into the face, the ring unwinds into the progress arc, the track draws, ticks fade in,
           spark  0..1 evidence spark riding the head of the progress arc,
           pulse  0..1 emphasis of the centre number, delta {txt, p} small violet delta chip under the number (p 0..1),
           shadow 0..1, alpha }
   gaugeTip(v)  [dx, dy] of the progress-arc head relative to the centre, in local units (multiply by s). */
const GAUGE = { R: 260, AR: 204, TW: 18, A0: Math.PI * 5 / 6, SW: Math.PI * 4 / 3, N: 51, NUM_Y: 80, NUM: 112 };
const gaugeAng = v => GAUGE.A0 + GAUGE.SW * clamp(v / 100);
function gaugeTip(v) { const a = gaugeAng(v); return [GAUGE.AR * Math.cos(a), GAUGE.AR * Math.sin(a)]; }
function gauge(x, y, s, lt, o = {}) {
  const m = o.m === undefined ? 1 : clamp(o.m), v = clamp(o.v || 0, 0, 100), a = o.alpha === undefined ? 1 : o.alpha;
  if (a <= .01 || s <= .001) return;
  const num = o.num === undefined ? v : o.num, A0 = GAUGE.A0, SW = GAUGE.SW;
  tf(x, y, s, 0, () => {
    const R = lerp(150, GAUGE.R, eo(m)), AR = lerp(150, GAUGE.AR, m), TW = lerp(6, GAUGE.TW, m);
    // face (the contract disc grows into it)
    softShadow(-R, -R, 2 * R, 2 * R, R, { blur: lerp(90, 64, m), dy: lerp(30, 24, m), alpha: .16 * (o.shadow === undefined ? 1 : o.shadow) });
    circle(0, 0, R, COL.paper);
    if (m > .01) { ring(0, 0, R - 16, 1.5, rgba(COL.contour, .55 * m)); circle(0, 0, R * .62, rgba(COL.lav, .55 * m)); }
    // track draws in clockwise from the start of the arc
    if (m > .01) { g.beginPath(); g.arc(0, 0, AR, A0, A0 + SW * eio(m)); g.strokeStyle = COL.lav; g.lineWidth = TW; g.lineCap = 'round'; g.stroke(); }
    // ticks: 51 (every 2 points), major every 10; light progressively as the needle passes
    if (m > .02) {
      g.lineCap = 'round';
      for (let i = 0; i < GAUGE.N; i++) {
        const u = i / (GAUGE.N - 1), ap = clamp(m * 1.9 - .3 - u * .7); if (ap <= .01) continue;
        const ang = A0 + SW * u, major = i % 5 === 0, r0 = R - 32, r1 = R - (major ? 12 : 20);   // tied to the growing face
        const lit = smooth(u * 100 - 2.2, u * 100, v), col = lit > .01 ? mix('#EAE3F7', mixHex(COL.pale, COL.violet, u), lit) : '#EAE3F7';
        const c = Math.cos(ang), sn = Math.sin(ang);
        g.beginPath(); g.moveTo(c * r0, sn * r0); g.lineTo(c * r1, sn * r1);
        g.save(); g.strokeStyle = col; g.globalAlpha *= ap; g.lineWidth = major ? 4 : 3; g.stroke(); g.restore();
      }
    }
    // progress arc: the contract ring (full, solid violet) unwinds into a contour->violet gradient arc ending at the value
    const sweep = lerp(TAU, SW * v / 100, m);
    if (sweep > .002) {
      // conic starts .3rad before the arc so the round start cap samples the start colour (not the wrapped end colour)
      const gr = g.createConicGradient(A0 - .3, 0, 0), s0 = .3 / TAU, s1 = (.3 + SW) / TAU;
      gr.addColorStop(0, COL.contour); gr.addColorStop(s0, COL.contour); gr.addColorStop(s0 + (s1 - s0) * .35, COL.pale); gr.addColorStop(s1, COL.violet); gr.addColorStop(1, COL.violet);
      g.beginPath(); g.arc(0, 0, AR, A0, A0 + sweep); g.lineCap = 'round'; g.lineWidth = TW;
      if (m > .01) { g.save(); g.globalAlpha *= m; g.strokeStyle = gr; g.stroke(); g.restore(); }
      if (m < .99) { g.save(); g.globalAlpha *= 1 - m; g.strokeStyle = COL.violet; g.stroke(); g.restore(); }
    }
    // needle (tapered) + hub; grows out of the hub
    if (m > .12) {
      const ang = gaugeAng(v), L = (GAUGE.AR - 30) * eo(clamp((m - .12) / .55)), ca = Math.cos(ang), sa = Math.sin(ang), px = -sa, py = ca;
      g.beginPath(); g.moveTo(px * 8 - ca * 18, py * 8 - sa * 18); g.lineTo(ca * L + px * 2, sa * L + py * 2); g.lineTo(ca * L - px * 2, sa * L - py * 2); g.lineTo(-px * 8 - ca * 18, -py * 8 - sa * 18); g.closePath();
      g.save(); g.fillStyle = COL.navy; g.globalAlpha *= clamp(m * 3); g.fill(); g.restore();
      circle(0, 0, 17 * clamp(m * 2), COL.violet); circle(0, 0, 6.5 * clamp(m * 2), COL.paper);
    }
    // centre number (odometer) under the hub
    if (m > .05) {
      const k = 1 + .07 * clamp(o.pulse || 0);
      tf(0, GAUGE.NUM_Y, k, 0, () => odometer(0, 0, Math.max(0, num), { to: 99, size: GAUGE.NUM, col: COL.ink }), clamp((m - .3) * 2.5));
    }
    // delta chip
    const dp = o.delta ? clamp(o.delta.p) : 0;
    if (dp > .01) tf(0, GAUGE.NUM_Y + 92, lerp(.6, 1, dp), 0, () => chip(o.delta.txt, 0, 0, { size: 26, fill: COL.violet, col: '#FFFFFF', icon: 'trending-up', iconCol: '#FFFFFF', pad: 18 }), clamp(dp * 2));
    // evidence spark on the arc head
    if ((o.spark || 0) > .01 && m > .5) { const [tx, ty] = gaugeTip(v); spark(tx, ty, 1.15, clamp(o.spark)); }
  }, a);
}
