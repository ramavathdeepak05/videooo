/* core/tilt.js: 2.5D card tilt by strip perspective. drawFn draws in local coords (0..w, 0..h). */
const TILT_POOL = {};
function tiltBuf(key, w, h) {
  let c = TILT_POOL[key];
  if (!c || c.width < w || c.height < h) { c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); TILT_POOL[key] = c; }
  return c;
}
/* tilt3d(w, h, drawFn, cx, cy, ry, rx, {f, strips, sheen}) ry/rx in radians, rotation about the card centre */
function tilt3d(w, h, drawFn, cx, cy, ry = 0, rx = 0, o = {}) {
  const m = g.getTransform(), res = Math.min(2, Math.max(1, Math.hypot(m.a, m.b)));
  const W2 = Math.ceil(w * res), H2 = Math.ceil(h * res), A = tiltBuf('a', W2, H2), ax = A.getContext('2d');
  ax.setTransform(1, 0, 0, 1, 0, 0); ax.clearRect(0, 0, A.width, A.height); ax.setTransform(res, 0, 0, res, 0, 0);
  withCtx(ax, drawFn);
  if (o.sheen !== false && (Math.abs(ry) > .01 || Math.abs(rx) > .01)) { // specular sheen keyed to tilt
    ax.save(); ax.globalCompositeOperation = 'source-atop'; const sx = w * (.5 - ry * 1.6), gr = ax.createLinearGradient(sx - w * .4, 0, sx + w * .4, h);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, `rgba(255,255,255,${Math.min(.35, (Math.abs(ry) + Math.abs(rx)) * .6)})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    ax.fillStyle = gr; ax.fillRect(0, 0, w, h); ax.restore();
  }
  if (Math.abs(ry) < 1e-3 && Math.abs(rx) < 1e-3) { g.drawImage(A, 0, 0, W2, H2, cx - w / 2, cy - h / 2, w, h); return; }
  const f = o.f || 1600, n = o.strips || 64;
  // pass 1: rotate about Y into B (vertical strips)
  const BW = Math.ceil(w * 1.3), BH = Math.ceil(h * 1.3), B = tiltBuf('b', BW * res, BH * res), bx = B.getContext('2d');
  bx.setTransform(1, 0, 0, 1, 0, 0); bx.clearRect(0, 0, B.width, B.height);
  const cy1 = Math.sin(ry), cyc = Math.cos(ry);
  for (let j = 0; j < n; j++) {
    const x0 = -w / 2 + w * j / n, x1 = -w / 2 + w * (j + 1) / n;
    const p0 = f / (f + x0 * cy1), p1 = f / (f + x1 * cy1), X0 = x0 * cyc * p0, X1 = x1 * cyc * p1, hh = h * (p0 + p1) / 2;
    if (X1 - X0 <= 0) continue;
    bx.drawImage(A, (x0 + w / 2) * res, 0, (x1 - x0) * res + 1, H2, (BW / 2 + X0) * res, (BH / 2 - hh / 2) * res, (X1 - X0) * res + 1, hh * res);
  }
  // pass 2: rotate about X onto g (horizontal strips)
  const sx1 = Math.sin(rx), sxc = Math.cos(rx);
  for (let j = 0; j < n; j++) {
    const y0 = -BH / 2 + BH * j / n, y1 = -BH / 2 + BH * (j + 1) / n;
    const p0 = f / (f + y0 * sx1), p1 = f / (f + y1 * sx1), Y0 = y0 * sxc * p0, Y1 = y1 * sxc * p1, ww = BW * (p0 + p1) / 2;
    if (Y1 - Y0 <= 0) continue;
    g.drawImage(B, 0, (y0 + BH / 2) * res, BW * res, (y1 - y0) * res + 1, cx - ww / 2, cy + Y0, ww, Y1 - Y0 + .5);
  }
}
