/* core/camera.js: keyframed camera, parallax layers, impact micro-shake. */
const EASE = { spring: null, expoIO, eio, brand, eo, linear: x => clamp(x) };
/* keys: [{t, x, y, z=1, rot=0, ease:'spring'|'expoIO'|'eio'|'brand'|'eo'|'linear'}]; ease = how we move INTO that key */
function camAt(keys, lt) {
  if (!keys || !keys.length) return { x: W / 2, y: H / 2, z: 1, rot: 0 };
  const K = keys.map(k => ({ x: W / 2, y: H / 2, z: 1, rot: 0, ease: 'spring', ...k }));
  if (lt <= K[0].t) return K[0];
  for (let i = 1; i < K.length; i++) {
    const a = K[i - 1], b = K[i];
    if (lt < b.t) {
      const d = b.t - a.t, u = lt - a.t;
      const p = b.ease === 'spring' ? spring(u, d, 0) : (EASE[b.ease] || eio)(u / d);
      return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), z: Math.exp(lerp(Math.log(a.z), Math.log(b.z), p)), rot: lerp(a.rot, b.rot, p) };
    }
  }
  return K[K.length - 1];
}
function applyCam(c) { g.translate(W / 2, H / 2); g.scale(c.z, c.z); if (c.rot) g.rotate(c.rot); g.translate(-c.x, -c.y); }
/* draw fn inside a parallax layer: depth 0 = fixed to screen, 1 = moves with camera, >1 = foreground */
function layer(c, depth, fn) {
  g.save(); const z = 1 + (c.z - 1) * depth;
  g.translate(W / 2, H / 2); g.scale(z, z); if (c.rot) g.rotate(c.rot * depth);
  g.translate(-(W / 2 + (c.x - W / 2) * depth), -(H / 2 + (c.y - H / 2) * depth)); fn(); g.restore();
}
/* screen-space offset for impacts only (≤3px, decays over dur) */
function shake(lt, t0, amp = 3, dur = .3) { const p = seg(lt, t0, dur); if (p <= 0 || p >= 1) return [0, 0]; const k = amp * (1 - p) * (1 - p); return [noise1(lt * 40, 1) * k, noise1(lt * 40, 2) * k]; }
/* map a world point through a camera to screen (for match-cut contracts) */
function camToScreen(c, x, y) { return [(x - c.x) * c.z + W / 2, (y - c.y) * c.z + H / 2]; }
