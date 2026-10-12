/* ui/people.js: flat 2.5D people (refined from the 50s cut): brand-accent palettes, two-tone shading, blinks, breathing.
   person(x, y, s, o) origin = chest centre. o: {pal (index or object), lt, seed, shrug 0..1, look -1..1, mood:'calm'|'focus'|'worried', rot}
   bust(x, y, r, pal, bg, lt) person clipped into a circle. No face overlays / emotion meters. */
const PALS = [
  { skin: '#C68B59', hair: '#2B1B12', shirt: '#7438F2' }, { skin: '#8D5A3B', hair: '#1A120D', shirt: '#4B79FF' },
  { skin: '#E0AC7E', hair: '#5A3A22', shirt: '#F59D3D' }, { skin: '#A86B45', hair: '#14100C', shirt: '#31B86B' },
  { skin: '#F1C9A5', hair: '#3B2416', shirt: '#F05A67' }, { skin: '#B97A50', hair: '#231610', shirt: '#2C2745' }
];
function shadeHex(hex, k) { const [r, g2, b] = hexRgb(hex); return `rgb(${clamp(r * k, 0, 255) | 0},${clamp(g2 * k, 0, 255) | 0},${clamp(b * k, 0, 255) | 0})`; }
function person(x, y, s, o = {}) {
  const P = typeof o.pal === 'object' ? o.pal : PALS[(o.pal || 0) % PALS.length], lt = o.lt || 0, seed = o.seed || 0;
  const breathe = 1 + .012 * Math.sin(lt * 2.2 + seed), sh = clamp(o.shrug || 0), look = o.look || 0;
  tf(x, y, s, o.rot || 0, () => {
    g.scale(1, breathe);
    if (sh > 0) for (const d of [-1, 1]) {
      g.beginPath(); g.moveTo(d * 70, 70); g.quadraticCurveTo(d * 145, 40 - 30 * sh, d * (124 + 6 * sh), -6 - 66 * sh);
      g.strokeStyle = shadeHex(P.shirt, .88); g.lineWidth = 36; g.lineCap = 'round'; g.stroke(); circle(d * (124 + 6 * sh), -14 - 66 * sh, 20, P.skin);
    }
    // body with two-tone shading
    g.beginPath(); g.moveTo(-100, 190); g.bezierCurveTo(-104, 50, -62, 14, 0, 14); g.bezierCurveTo(62, 14, 104, 50, 100, 190); g.closePath(); g.fillStyle = P.shirt; g.fill();
    g.save(); g.clip(); g.fillStyle = 'rgba(0,0,0,.10)'; g.fillRect(20, 0, 120, 200); g.restore();
    g.beginPath(); g.moveTo(-36, 22); g.quadraticCurveTo(0, 66, 36, 22); g.strokeStyle = shadeHex(P.shirt, .8); g.lineWidth = 10; g.lineCap = 'round'; g.stroke();
    rrect(-16, -22, 32, 44, 12, shadeHex(P.skin, .9));
    circle(0, -66, 55, P.skin);
    g.save(); g.beginPath(); g.arc(0, -66, 55, 0, TAU); g.clip(); g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(14, -130, 60, 130); g.restore();
    g.fillStyle = P.hair; g.beginPath(); g.ellipse(0, -99, 59, 33, 0, Math.PI * .95, TAU + Math.PI * .05); g.fill();
    g.beginPath(); g.ellipse(-28, -95, 33, 25, -.5, 0, TAU); g.fill();
    // eyes with deterministic blinks
    const bl = ((lt * .37 + seed * .13) % 1) < .035 ? .15 : 1, ex = look * 6;
    for (const d of [-1, 1]) { g.save(); g.translate(d * 19 + ex, -62); g.scale(1, bl); circle(0, 0, 5.5, '#1E1712'); g.restore(); }
    g.beginPath();
    if (o.mood === 'worried') { g.moveTo(-13, -34); g.quadraticCurveTo(0, -41, 13, -34); }
    else if (o.mood === 'focus') { g.moveTo(-11, -36); g.lineTo(11, -36); }
    else { g.moveTo(-14, -38); g.quadraticCurveTo(0, -27, 14, -38); }
    g.strokeStyle = '#1E1712'; g.lineWidth = 4.5; g.lineCap = 'round'; g.stroke();
  });
}
function bust(x, y, r, pal = 0, bg = COL.lav, lt = 0) {
  g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = bg; g.fill(); g.clip();
  person(x, y + r * .46, r / 118, { pal, lt, seed: pal * 1.7 }); g.restore();
}
