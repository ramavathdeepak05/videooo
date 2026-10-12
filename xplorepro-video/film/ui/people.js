/* ui/people.js: flat 2.5D people (refined from the 50s cut): brand-accent palettes, two-tone shading, blinks, breathing.
   person(x, y, s, o) origin = chest centre. o: {pal (index or object), lt, seed, shrug 0..1, look -1..1, mood:'calm'|'focus'|'worried', rot,
                                               style: 'side'|'long'|'crop'|'bun'|'bob'|'curly' (default from the palette)}
   bust(x, y, r, pal, bg, lt, o) person clipped into a circle; o (optional) = person options plus {dy} (vertical offset inside the clip).
   Extents are unchanged from v1 (head r55 at y-66, body to y+190, shoulders +-104). No face overlays / emotion meters. */
const PALS = [
  { skin: '#C68B59', hair: '#2B1B12', shirt: '#7438F2', style: 'side' }, { skin: '#8D5A3B', hair: '#1A120D', shirt: '#4B79FF', style: 'long' },
  { skin: '#E0AC7E', hair: '#5A3A22', shirt: '#F59D3D', style: 'crop' }, { skin: '#A86B45', hair: '#14100C', shirt: '#31B86B', style: 'bun' },
  { skin: '#F1C9A5', hair: '#3B2416', shirt: '#F05A67', style: 'bob' }, { skin: '#B97A50', hair: '#231610', shirt: '#2C2745', style: 'curly' }
];
function shadeHex(hex, k) { const [r, g2, b] = hexRgb(hex); return `rgb(${clamp(r * k, 0, 255) | 0},${clamp(g2 * k, 0, 255) | 0},${clamp(b * k, 0, 255) | 0})`; }
/* hair mass behind the head (long / bob / bun); drawn after the body, before neck and head */
function peopleHairBack(style, col) {
  g.fillStyle = col; g.beginPath();
  if (style === 'long') {
    g.moveTo(-50, -96); g.bezierCurveTo(-74, -60, -76, -4, -70, 34); g.quadraticCurveTo(-46, 46, -24, 30); g.lineTo(24, 30);
    g.quadraticCurveTo(46, 46, 70, 34); g.bezierCurveTo(76, -4, 74, -60, 50, -96); g.closePath(); g.fill();
  } else if (style === 'bob') {
    g.moveTo(-52, -96); g.bezierCurveTo(-72, -66, -72, -26, -64, -14); g.quadraticCurveTo(-40, -6, -20, -20); g.lineTo(20, -20);
    g.quadraticCurveTo(40, -6, 64, -14); g.bezierCurveTo(72, -26, 72, -66, 52, -96); g.closePath(); g.fill();
  } else if (style === 'bun') { circle(4, -128, 25, col); }
}
/* hair cap over the head: a slightly larger head-circle clipped above a per-style hairline */
function peopleHairFront(style, col) {
  g.save(); g.beginPath();
  if (style === 'side') { g.moveTo(-70, -54); g.lineTo(-56, -58); g.bezierCurveTo(-54, -82, -44, -98, -28, -104); g.bezierCurveTo(-10, -92, 26, -90, 57, -72); g.lineTo(70, -64); }
  else if (style === 'crop') { g.moveTo(-70, -70); g.lineTo(-55, -74); g.bezierCurveTo(-42, -98, -14, -102, 0, -97); g.bezierCurveTo(14, -102, 42, -98, 55, -74); g.lineTo(70, -70); }
  else if (style === 'long' || style === 'bob') { g.moveTo(-70, -30); g.lineTo(-56, -40); g.bezierCurveTo(-52, -78, -26, -92, 2, -90); g.bezierCurveTo(30, -88, 50, -78, 56, -40); g.lineTo(70, -30); }
  else if (style === 'bun') { g.moveTo(-70, -60); g.lineTo(-55, -64); g.bezierCurveTo(-40, -96, 40, -96, 55, -64); g.lineTo(70, -60); }
  else { g.moveTo(-70, -62); g.lineTo(-56, -68); g.bezierCurveTo(-36, -92, 36, -92, 56, -68); g.lineTo(70, -62); }
  g.lineTo(70, -180); g.lineTo(-70, -180); g.closePath(); g.clip();
  const lift = style === 'curly' ? 10 : style === 'crop' ? 4 : 6;
  circle(0, -66 - lift * .5, 55 + lift, col);
  if (style === 'curly') for (let i = 0; i < 7; i++) { const a = Math.PI * (1.08 + i * .14); circle(Math.cos(a) * 58, -70 + Math.sin(a) * 58, 15, col); }
  g.restore();
  if (style === 'side') { g.beginPath(); g.ellipse(-8, -118, 40, 16, -.18, 0, TAU); g.fillStyle = col; g.fill(); }
  else if (style === 'crop') { g.beginPath(); g.ellipse(8, -116, 32, 12, .12, 0, TAU); g.fillStyle = col; g.fill(); }
}
function person(x, y, s, o = {}) {
  const P = typeof o.pal === 'object' ? o.pal : PALS[(o.pal || 0) % PALS.length], lt = o.lt || 0, seed = o.seed || 0;
  const style = o.style || P.style || 'side';
  const breathe = 1 + .012 * Math.sin(lt * 2.2 + seed), sh = clamp(o.shrug || 0), look = o.look || 0;
  tf(x, y, s, o.rot || 0, () => {
    g.scale(1, breathe);
    if (sh > 0) for (const d of [-1, 1]) {
      g.beginPath(); g.moveTo(d * 70, 70); g.quadraticCurveTo(d * 145, 40 - 30 * sh, d * (124 + 6 * sh), -6 - 66 * sh);
      g.strokeStyle = shadeHex(P.shirt, .88); g.lineWidth = 36; g.lineCap = 'round'; g.stroke(); circle(d * (124 + 6 * sh), -14 - 66 * sh, 20, P.skin);
    }
    // body: rounded shoulders, soft curved side shade (two-tone, no hard split)
    g.beginPath(); g.moveTo(-104, 190); g.bezierCurveTo(-108, 74, -86, 24, -30, 16); g.lineTo(30, 16); g.bezierCurveTo(86, 24, 108, 74, 104, 190); g.closePath();
    g.fillStyle = P.shirt; g.fill();
    g.save(); g.clip(); g.beginPath(); g.ellipse(96, 120, 64, 150, -.12, 0, TAU); g.fillStyle = 'rgba(0,0,0,.09)'; g.fill();
    g.restore();
    peopleHairBack(style, P.hair);
    // V-neck opening + collar trim
    g.beginPath(); g.moveTo(-25, 15); g.lineTo(0, 44); g.lineTo(25, 15); g.closePath(); g.fillStyle = shadeHex(P.skin, .9); g.fill();
    g.beginPath(); g.moveTo(-27, 14); g.lineTo(0, 45); g.lineTo(27, 14); g.strokeStyle = shadeHex(P.shirt, .8); g.lineWidth = 8; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke();
    // neck with chin shadow, ears
    rrect(-16, -24, 32, 50, 13, shadeHex(P.skin, .93));
    g.beginPath(); g.ellipse(0, -13, 18, 10, 0, 0, TAU); g.fillStyle = shadeHex(P.skin, .8); g.fill();
    if (style !== 'long' && style !== 'bob') for (const d of [-1, 1]) circle(d * 53, -60, 10, shadeHex(P.skin, .9));
    // head with two-tone shading
    circle(0, -66, 55, P.skin);
    g.save(); g.beginPath(); g.arc(0, -66, 55, 0, TAU); g.clip(); g.beginPath(); g.ellipse(46, -60, 34, 70, 0, 0, TAU); g.fillStyle = 'rgba(0,0,0,.06)'; g.fill(); g.restore();
    peopleHairFront(style, P.hair);
    // brows (expression via pose only), eyes with deterministic blinks, mouth
    const bl = ((lt * .37 + seed * .13) % 1) < .035 ? .15 : 1, ex = look * 6;
    const browIn = o.mood === 'worried' ? -7 : o.mood === 'focus' ? 1 : -2;
    g.strokeStyle = shadeHex(P.hair, 1.1); g.lineWidth = 4; g.lineCap = 'round';
    for (const d of [-1, 1]) { g.beginPath(); g.moveTo(d * 27 + ex * .6, -78); g.lineTo(d * 12 + ex * .6, -78 + browIn); g.stroke(); }
    for (const d of [-1, 1]) { g.save(); g.translate(d * 19 + ex, -62); g.scale(1, bl); circle(0, 0, 5.5, '#1E1712'); g.restore(); }
    g.beginPath();
    if (o.mood === 'worried') { g.moveTo(-12, -34); g.quadraticCurveTo(0, -40, 12, -34); }
    else if (o.mood === 'focus') { g.moveTo(-10, -36); g.lineTo(10, -36); }
    else { g.moveTo(-14, -38); g.quadraticCurveTo(0, -27, 14, -38); }
    g.strokeStyle = '#1E1712'; g.lineWidth = 4.5; g.lineCap = 'round'; g.stroke();
  });
}
function bust(x, y, r, pal = 0, bg = COL.lav, lt = 0, o = {}) {
  g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = bg; g.fill(); g.clip();
  person(x, y + r * .46 + (o.dy || 0), r / 118, { pal, lt, seed: (typeof pal === 'number' ? pal : 0) * 1.7, ...o }); g.restore();
}
