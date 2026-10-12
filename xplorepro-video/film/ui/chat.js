/* ui/chat.js: generic chat + voice UI (violet, no brand marks, no readable text). Pure functions of their arguments.
   chatBubble(x, y, s, lt, o)  one speech bubble centred at x,y (local units, scaled by s).
                               o = {w=220, n=2 (bar rows), side:'l'|'r' (tail side), tone:'violet'|'lav'|'paper', p (appear 0..1),
                                    typing (three animated dots instead of bars), seed, tail (default true), alpha}
   chat(x, y, s, lt, o)        a short exchange centred at x,y: bubbles alternate sides and spring in with a 80ms stagger.
                               o = {t0 (local time the first bubble lands), out (local time it collapses), cw=300 (column width),
                                    msgs:[{side, tone, w, n, typing}], gap=14}
   voiceBars(x, y, s, lt, o)   "audio-lines" style waveform (rounded vertical strokes) centred at x,y.
                               o = {n=7, w=6, gap=12, h=34, col, energy 0..1, seed, min=.2, alpha} */
const CHAT_TONE = {
  violet: { fill: COL.violet, stroke: null, bar: 'rgba(255,255,255,.72)', head: '#FFFFFF', dot: '#FFFFFF' },
  lav: { fill: COL.lav, stroke: COL.contour, bar: COL.pale, head: COL.lilac, dot: COL.lilac },
  paper: { fill: COL.paper, stroke: COL.contour, bar: COL.contour, head: COL.pale, dot: COL.pale }
};
function chatBubbleH(o = {}) { const n = o.typing ? 1 : (o.n || 2); return 40 + (n - 1) * 20 + 10; }
function chatBubble(x, y, s, lt, o = {}) {
  const p = o.p === undefined ? 1 : clamp(o.p), a = (o.alpha === undefined ? 1 : o.alpha) * clamp(p * 2);
  if (p <= .002 || a <= .01) return;
  const T = CHAT_TONE[o.tone || 'violet'], w = o.w || 220, h = chatBubbleH(o), r = Math.min(22, h / 2), side = o.side || 'l';
  const ax = side === 'l' ? -w / 2 + 18 : w / 2 - 18, ay = h / 2 + 10;           // tail tip (the bubble grows from it)
  tf(x, y, s, 0, () => {
    g.translate(ax, ay); g.scale(lerp(.4, 1, p), lerp(.4, 1, p)); g.translate(-ax, -ay);
    softShadow(-w / 2, -h / 2, w, h, r, { blur: 22, dy: 8, alpha: .12 });
    g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, r);
    if (o.tail !== false) { const k = side === 'l' ? 1 : -1; g.moveTo(ax + k * 2, h / 2 - 4); g.lineTo(ax, ay); g.lineTo(ax + k * 22, h / 2 - 4); g.closePath(); }
    g.fillStyle = T.fill; g.fill();
    if (T.stroke) { g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, r); g.strokeStyle = T.stroke; g.lineWidth = 1.5; g.stroke(); }
    if (o.typing) {
      for (let i = 0; i < 3; i++) { const k = .5 + .5 * Math.sin(lt * 7 - i * .9); circle(-18 + i * 18, -3 * k, 5, rgba(T.dot === '#FFFFFF' ? '#FFFFFF' : T.dot, .45 + .55 * k)); }
    } else {
      bars(-w / 2 + 22, -h / 2 + 20, w - 44, o.n || 2, { h: 10, gap: 20, col: T.bar, seed: o.seed || 11, p: clamp(p * 1.2 - .1) });
    }
  }, a);
}
function chat(x, y, s, lt, o = {}) {
  const msgs = o.msgs || [{ side: 'l', tone: 'lav', w: 220, n: 2 }, { side: 'r', tone: 'violet', w: 190, n: 1 }];
  const gap = o.gap || 14, cw = o.cw || 300, t0 = o.t0 || 0;
  const hs = msgs.map(m => chatBubbleH(m)), tot = hs.reduce((a, b) => a + b, 0) + gap * (msgs.length - 1);
  const q = o.out === undefined ? 0 : spring(lt - o.out, .45, 0);
  if (q >= .999) return;
  tf(x, y, s, 0, () => {
    let yy = -tot / 2;
    msgs.forEach((m, i) => {
      const w = m.w || 200, h = hs[i], cx = m.side === 'r' ? cw / 2 - w / 2 : -cw / 2 + w / 2;
      const p = sp(lt, t0 + i * .08, SP.ui) * (1 - q);
      chatBubble(cx, yy + h / 2 + (1 - p) * 10, 1, lt, { ...m, p, seed: 11 + i * 5 });
      yy += h + gap;
    });
  });
}
function voiceBars(x, y, s, lt, o = {}) {
  const n = o.n || 7, w = o.w || 6, gap = o.gap || 12, h = o.h || 34, e = o.energy === undefined ? 1 : clamp(o.energy), mn = o.min === undefined ? .2 : o.min;
  const a = o.alpha === undefined ? 1 : o.alpha; if (a <= .01) return;
  const c = (n - 1) / 2, seed = o.seed || 3;
  tf(x, y, s, 0, () => {
    g.lineCap = 'round'; g.strokeStyle = o.col || COL.violet; g.lineWidth = w;
    for (let k = 0; k < n; k++) {
      const shape = 1 - .55 * Math.pow(Math.abs(k - c) / Math.max(1, c), 1.4);
      const v = .5 + .5 * noise1(lt * 6.5 + k * 1.37, seed + k), hh = Math.max(w * .2, h * shape * (mn + (1 - mn) * e * v));
      const xx = (k - c) * gap; g.beginPath(); g.moveTo(xx, -hh / 2); g.lineTo(xx, hh / 2); g.stroke();
    }
  }, a);
}
