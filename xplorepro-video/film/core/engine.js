/* core/engine.js: scene registry, VO anchors, SFX cues, persistent background, cut compositor,
   adaptive sub-frame motion blur, grain/vignette post, render entry points.
   Scenes register SC.<id> = { init(s) -> state, draw(lt, st), bg?(lt, st) -> bg overrides, blur?(lt, st) -> N }.
   draw() must be a pure function of lt (no Math.random / Date / mutation of st inside draw). */
const SC = {};
const TLN = window.TIMELINE, DUR = TLN.duration, NFRAMES = Math.round(DUR * FPS);
const SFX = [], MISSING = new Set();
let SCN = [];

/* ---------- timeline helpers for scenes ---------- */
/* local time (seconds from scene start) at which VO anchor `key` is spoken in this scene */
function at(s, key) {
  const v = s.anchors && s.anchors[key];
  if (v === undefined) { MISSING.add(s.id + ':' + key); return s.len * .5; }
  return v - s.start;
}
/* VO line timing (local): {start, dur, end} */
function voLine(s, id) { const v = (s.vo || []).find(l => l.id === id); if (!v) { MISSING.add(s.id + ':' + id); return { start: 0, dur: 1, end: 1 }; } return { start: v.start - s.start, dur: v.dur, end: v.start - s.start + v.dur }; }
/* SFX cue at local time. o: {x (screen x for auto-pan), dur, pitch} */
function cue(s, local, type, gain = 1, o = {}) { SFX.push({ t: +(s.start + local).toFixed(3), type, gain, scene: s.id, ...o }); }

/* ---------- canvases ---------- */
const cv = document.getElementById('c'), g0 = cv.getContext('2d', { willReadFrequently: true });
function mkCanvas(w = W, h = H, rf = false) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.ctx = c.getContext('2d', rf ? { willReadFrequently: true } : undefined); return c; }
const BUF = mkCanvas(W, H, true), LA = mkCanvas(), LB = mkCanvas(), SMALL = mkCanvas(240, 135, true);
let ACC = null;

/* ---------- background layer (engine-owned, eased across cuts) ---------- */
const BG_DEFAULT = { col: '#FBFAF7', glow: null, contours: { alpha: .45 } };
function bgState(s, lt) {
  const base = s.bg || {}, dyn = (s.def && s.def.bg) ? (s.def.bg(lt, s.st) || {}) : {};
  return { col: dyn.col || base.col || BG_DEFAULT.col, glow: dyn.glow !== undefined ? dyn.glow : (base.glow || null),
    contours: { ...CONTOUR_DEFAULT, ...(BG_DEFAULT.contours), ...(base.contours || {}), ...(dyn.contours || {}) } };
}
function lerpBg(A, B, p) {
  const c = {}; for (const k of Object.keys(A.contours)) { const a = A.contours[k], b = B.contours[k]; c[k] = typeof a === 'number' && typeof b === 'number' ? lerp(a, b, p) : (p < .5 ? a : b); }
  if (Array.isArray(A.contours.amp)) { c.amp = [0, 1].map(i => lerp(A.contours.amp[i], (B.contours.amp || A.contours.amp)[i], p)); }
  if (Array.isArray(A.contours.k)) { c.k = [0, 1].map(i => lerp(A.contours.k[i], (B.contours.k || A.contours.k)[i], p)); }
  if (A.contours.col !== B.contours.col) c.col = mixHex(A.contours.col, B.contours.col, p);
  let glow = null;
  if (A.glow || B.glow) { const ga = A.glow || { ...B.glow, alpha: 0 }, gb = B.glow || { ...A.glow, alpha: 0 }; glow = { x: lerp(ga.x, gb.x, p), y: lerp(ga.y, gb.y, p), r: lerp(ga.r, gb.r, p), col: p < .5 ? ga.col : gb.col, alpha: lerp(ga.alpha, gb.alpha, p) }; }
  return { col: mixHex(A.col, B.col, p), glow, contours: c };
}
function drawBg(st, t) {
  g.fillStyle = st.col; g.fillRect(0, 0, W, H);
  if (st.glow && st.glow.alpha > .01) { const gl = st.glow, gr = g.createRadialGradient(gl.x, gl.y, 0, gl.x, gl.y, gl.r); gr.addColorStop(0, rgba(gl.col, gl.alpha)); gr.addColorStop(1, rgba(gl.col, 0)); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  contours({ ...st.contours, T: t + (st.contours.T || 0) });
}

/* ---------- scenes and cuts ---------- */
function sceneAt(t) { for (const s of SCN) if (t >= s.start && t < s.end) return s; return SCN[SCN.length - 1]; }
const OVERLAP = { xfade: 1, iris: 1, push: 1, particles: 1 };
function cutAt(t) { for (const c of (TLN.cuts || [])) { if (t >= c.at - (c.pre || 0) && t < c.at + (c.post || 0)) return c; } return null; }
function drawScene(s, t, alpha = 1) {
  if (!s || !s.def) return;
  g.save(); g.globalAlpha = alpha;
  try { s.def.draw(t - s.start, s.st); } catch (e) { console.error('scene ' + s.id + ' @' + (t - s.start).toFixed(2) + ': ' + e.message); }
  g.restore();
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none'; g.setLineDash([]);
}
function intoLayer(L, fn) { const x = L.ctx; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H); withCtx(x, fn); return L; }
/* compose one exact time sample into ctx (scale for low-res motion estimation) */
function compose(t, ctx, scale = 1) {
  withCtx(ctx, () => {
    g.setTransform(scale, 0, 0, scale, 0, 0); g.globalAlpha = 1;
    const s = sceneAt(t), c = cutAt(t);
    // background, eased across the cut window
    let bgs;
    const prev = s.i > 0 ? SCN[s.i - 1] : null, next = s.i < SCN.length - 1 ? SCN[s.i + 1] : null;
    if (prev && t < s.start + .5) bgs = lerpBg(bgState(prev, t - prev.start), bgState(s, t - s.start), eio((t - (s.start - .5)) / 1.0));
    else if (next && t > s.end - .5) bgs = lerpBg(bgState(s, t - s.start), bgState(next, t - next.start), eio((t - (s.end - .5)) / 1.0));
    else bgs = bgState(s, t - s.start);
    drawBg(bgs, t);
    if (!c || !OVERLAP[c.type]) { drawScene(s, t); return; }
    const a = SCN.find(x => x.id === c.from), b = SCN.find(x => x.id === c.to);
    const p = clamp((t - (c.at - (c.pre || 0))) / ((c.pre || 0) + (c.post || 0)));
    const [px, py] = c.point || [W / 2, H / 2];
    if (c.type === 'xfade' || c.type === 'particles') {
      intoLayer(LA, () => drawScene(a, t)); intoLayer(LB, () => drawScene(b, t));
      g.globalAlpha = 1 - eio(p); g.drawImage(LA, 0, 0, W, H); g.globalAlpha = eio(p); g.drawImage(LB, 0, 0, W, H); g.globalAlpha = 1;
    } else if (c.type === 'iris') {
      drawScene(a, t); intoLayer(LB, () => drawScene(b, t));
      const r = spring(t - (c.at - (c.pre || 0)), (c.pre || 0) + (c.post || 0), 0) * 2300;
      g.save(); g.beginPath(); g.arc(px, py, r, 0, TAU); g.clip(); g.drawImage(LB, 0, 0, W, H); g.restore();
    } else if (c.type === 'push') {
      intoLayer(LA, () => drawScene(a, t)); intoLayer(LB, () => drawScene(b, t));
      const za = Math.exp(lerp(0, Math.log(8), expoIn(p))), zb = lerp(.35, 1, eo(p));
      g.save(); g.globalAlpha = 1 - smooth(.55, .95, p); g.translate(px, py); g.scale(za, za); g.translate(-px, -py); g.drawImage(LA, 0, 0, W, H); g.restore();
      g.save(); g.globalAlpha = smooth(.25, .7, p); g.translate(px, py); g.scale(zb, zb); g.translate(-px, -py); g.drawImage(LB, 0, 0, W, H); g.restore();
    }
  });
}

/* ---------- motion blur ---------- */
const SHUTTER = .5;            // 180°
function shotBounds(t) { // hard-cut shots (overlap cuts and blurAcross cuts are not boundaries)
  let a = 0, b = DUR;
  for (const c of (TLN.cuts || [])) { if (OVERLAP[c.type] || c.blurAcross) continue; if (c.at <= t) a = Math.max(a, c.at); else b = Math.min(b, c.at); }
  return [a, b - 1e-4];
}
function motionN(t) {
  const s = sceneAt(t);
  if (s.def && s.def.blur) { const n = s.def.blur(t - s.start, s.st); if (n) return n; }
  const [a, b] = shotBounds(t), dt = .5 / FPS, t0 = Math.max(a, t - dt), t1 = Math.min(b, t + dt);
  compose(t0, SMALL.ctx, 1 / 8); const d0 = SMALL.ctx.getImageData(0, 0, 240, 135).data.slice();
  compose(t1, SMALL.ctx, 1 / 8); const d1 = SMALL.ctx.getImageData(0, 0, 240, 135).data;
  let sum = 0; for (let i = 0; i < d1.length; i += 4) sum += Math.abs(d1[i] - d0[i]) + Math.abs(d1[i + 1] - d0[i + 1]) + Math.abs(d1[i + 2] - d0[i + 2]);
  const m = sum / (240 * 135 * 3);
  let n = m < .25 ? 1 : m < 1.2 ? 3 : m < 4 ? 6 : 10;
  const c = (TLN.cuts || []).find(c => Math.abs(t - c.at) < .2); if (c && n < 3) n = 3;
  return n;
}
function renderFrame(i, opt = {}) {
  const t = i / FPS; LOG.t = t; window.__late = false;
  let N = opt.samples === undefined || opt.samples === 'auto' ? motionN(t) : +opt.samples;
  if (N <= 1) { compose(t, g0); post(i, opt); return 1; }
  const [a, b] = shotBounds(t), sh = (opt.shutter || SHUTTER) / FPS;
  if (!ACC) ACC = new Uint16Array(W * H * 4); ACC.fill(0);
  const wasLog = LOG.on;
  for (let k = 0; k < N; k++) {
    const ts = clamp(t + ((k + .5) / N - .5) * sh, a, b);
    LOG.on = wasLog && k === (N >> 1);
    compose(ts, BUF.ctx); const d = BUF.ctx.getImageData(0, 0, W, H).data;
    for (let j = 0; j < d.length; j++) ACC[j] += d[j];
  }
  LOG.on = wasLog;
  const out = g0.createImageData(W, H), o = out.data, h = N >> 1;
  for (let j = 0; j < o.length; j++) o[j] = (ACC[j] + h) / N;
  g0.putImageData(out, 0, 0); post(i, opt); return N;
}

/* ---------- post: vignette + grain (after accumulation) ---------- */
let VIG = null, GRAIN = null;
function buildPost() {
  VIG = mkCanvas(); const v = VIG.ctx, gr = v.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * 1.05);
  gr.addColorStop(0, 'rgba(32,32,44,0)'); gr.addColorStop(1, 'rgba(32,32,44,.09)'); v.fillStyle = gr; v.fillRect(0, 0, W, H);
  GRAIN = [0, 1, 2].map(k => { const c = mkCanvas(256, 256), x = c.ctx, im = x.createImageData(256, 256), r = rng(101 + k * 7);
    for (let j = 0; j < im.data.length; j += 4) { const n = 128 + (r() - .5) * 255; im.data[j] = im.data[j + 1] = im.data[j + 2] = n; im.data[j + 3] = 255; }
    x.putImageData(im, 0, 0); return c; });
}
function post(i, opt = {}) {
  if (opt.post === false) return;
  g0.save(); g0.setTransform(1, 0, 0, 1, 0, 0); g0.drawImage(VIG, 0, 0);
  const tile = GRAIN[(i >> 1) % 3], pat = g0.createPattern(tile, 'repeat'), off = ((i >> 1) * 73) % 256;
  g0.globalCompositeOperation = 'overlay'; g0.globalAlpha = .05; g0.translate(off, off * .6); g0.fillStyle = pat; g0.fillRect(-off, -off, W + 256, H + 256);
  g0.restore();
}

/* ---------- setup ---------- */
function initScenes() {
  SCN = TLN.scenes.map((s, i) => ({ ...s, i, len: s.end - s.start }));
  for (const s of SCN) {
    s.def = SC[s.id] || { draw(lt) { type(s.id + '  ' + lt.toFixed(1), W / 2, H / 2, { size: 64, col: COL.deep }); } };
    try { s.st = s.def.init ? s.def.init(s) || {} : {}; } catch (e) { console.error('init ' + s.id + ': ' + e.message); s.st = {}; }
  }
  // cut contracts are declared by the INCOMING scene: SC.x.cutIn = {type:'match'|'xfade'|'iris'|'push'|'particles', pre, post, point:[x,y], blurAcross}
  TLN.cuts = SCN.slice(1).map(s => ({ at: s.start, from: SCN[s.i - 1].id, to: s.id, type: 'match', pre: 0, post: 0, ...(s.def.cutIn || {}) }));
}
window.prepare = async () => {
  const faces = ['500 40px DMSans', '700 40px DMSans', '500 40px Inter', '600 40px Inter'];
  await Promise.all(faces.map(f => document.fonts.load(f)));
  if (!faces.every(f => document.fonts.check(f))) throw new Error('fonts not ready');
  await Promise.all(pending.slice());
  buildWordmark(); buildPost(); initScenes();
  g = g0; return { duration: DUR, frames: NFRAMES, scenes: SCN.map(s => [s.id, s.start, s.end]) };
};
window.renderFrame = renderFrame;
window.renderAt = t => { LOG.t = t; compose(t, g0); post(Math.round(t * FPS)); };
window.awaitPending = () => Promise.all(pending.slice());
window.getCues = () => SFX;
window.getMissing = () => [...MISSING];
window.LOG = LOG;
