/* core/counter.js: odometer counters with true carry, and the "1,000,000 → 1 Million+" morph. */
/* odometer(x, y, V, {to, size, weight, col, suffix, align, morph(0..1 for million), alpha}) → drawn width
   V = current (fractional) value; columns = digits of `to`; draws suffix after the digits. */
function odometer(x, y, V, o = {}) {
  const to = o.to || Math.max(1, Math.round(V)), size = o.size || 96, weight = o.weight || 700, col = o.col || COL.ink, a = o.alpha === undefined ? 1 : o.alpha;
  if (a <= .01) return 0;
  const nd = String(to).length, cw = textWidth('0', size, weight) * 1.02, comma = textWidth(',', size, weight), lh = size * 1.12;
  const groups = o.group !== false && nd > 4, m = clamp(o.morph || 0);
  // layout right-to-left: column i (0 = units) and commas every 3
  const cols = []; let wsum = 0;
  for (let i = 0; i < nd; i++) {
    if (groups && i > 0 && i % 3 === 0) { cols.push({ comma: true, w: comma, next: i }); wsum += comma; }
    cols.push({ i, w: cw }); wsum += cw;
  }
  // columns appear smoothly as the value reaches them (no leading zeros / commas); million: zeros + commas collapse
  const vis = i => (i === 0 ? 1 : clamp((V - .85 * Math.pow(10, i)) / (.15 * Math.pow(10, i))));
  const collapse = c => (c.comma ? vis(c.next) : vis(c.i)) * (o.million && (c.comma || c.i < 6) ? 1 - m : 1);
  const shownW = cols.reduce((s, c) => s + c.w * collapse(c), 0);
  const sfx = o.million ? '' : (o.suffix || ''), sfxW = sfx ? textWidth(sfx, size, weight) : 0;
  const mil = o.million ? ' Million+' : '', milW = mil ? textWidth(mil, size, weight) * m : 0;
  const total = shownW + sfxW + milW, align = o.align || 'center';
  let right = (align === 'center' ? x - total / 2 : align === 'right' ? x - total : x) + shownW;
  g.save(); g.globalAlpha *= a; setFont(size, weight, 'D'); g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
  let cx = right;
  for (const c of cols) {
    const k = collapse(c), w = c.w * k; cx -= w; if (k <= .01) continue;
    if (c.comma) { g.save(); g.globalAlpha *= k; g.fillText(',', cx + w / 2, y + size * .08); g.restore(); continue; }
    const p10 = Math.pow(10, c.i);
    let val = c.i === 0 ? V % 10 : Math.floor(V / p10) % 10 + smooth(.85, 1, (V % p10) / p10);
    const d0 = Math.floor(val) % 10, f = val - Math.floor(val);
    g.save(); g.beginPath(); g.rect(cx - 4, y - lh / 2, w + 8, lh); g.clip();
    g.translate(cx + w / 2, y); g.scale(k, 1); if (o.million) g.globalAlpha *= k * k;
    g.fillText(String(d0), 0, -f * lh); g.fillText(String((d0 + 1) % 10), 0, (1 - f) * lh);
    g.restore();
  }
  if (sfx) g.fillText(sfx, right + sfxW / 2, y);
  if (mil && m > 0) { g.save(); g.beginPath(); g.rect(right, y - lh / 2, milW + 4, lh); g.clip(); g.textAlign = 'left'; g.fillText(mil, right - (1 - m) * 40, y); g.restore(); }
  g.restore();
  if (LOG.on) LOG.text.push([+LOG.t.toFixed(2), o.million && m > .5 ? '1 Million+' : String(Math.round(V)) + sfx]);
  return total;
}
/* counter value curve: rolls 0→to between t0 and t0+dur with an expo landing; extraTurns adds full wraps (e.g. "6 countries") */
function rollValue(lt, t0, dur, to, extraTurns = 0) { const p = expo(seg(lt, t0, dur)); return p >= 1 ? to : p * (to + extraTurns * 10); }
