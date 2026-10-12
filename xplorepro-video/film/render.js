// Film renderer. Usage:
//   node film/render.js --out DIR [--from F --to F | --frames 1,2,3 | --times 1.5,2.0 | --scene id] [--workers 4]
//        [--preview] (half-res JPEG, samples=1)  [--samples auto|N] [--png] [--export] (writes film/sfx.json + film/onscreen.json)
//        [--bench] (prints ms/frame per scene)
// UI components (film/ui/*.js) and scenes (film/scenes/[0-9]*.js) are loaded automatically in file-name order.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..'), FILM = __dirname;
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const TL = JSON.parse(fs.readFileSync(path.join(FILM, 'timeline.json')));
const FPS = 30, NF = Math.round(TL.duration * FPS);
function iconMap() { const d = path.join(ROOT, 'node_modules/lucide-static/icons'), m = {}; for (const f of fs.readdirSync(d)) m[f.replace('.svg', '')] = fs.readFileSync(path.join(d, f), 'utf8'); return m; }
function scripts() {
  const ui = fs.existsSync(path.join(FILM, 'ui')) ? fs.readdirSync(path.join(FILM, 'ui')).filter(f => f.endsWith('.js')).sort().map(f => 'ui/' + f) : [];
  const sc = fs.readdirSync(path.join(FILM, 'scenes')).filter(f => /^\d.*\.js$/.test(f) && !f.startsWith('99')).sort().map(f => 'scenes/' + f);
  const extra = (arg('include') && arg('include') !== true) ? String(arg('include')).split(',') : [];
  return [...ui, ...sc, ...extra];
}
async function openPage(browser, opts = {}) {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = [];
  p.on('pageerror', e => { errs.push(e.message); console.error('PAGE ERROR', e.message); });
  p.on('console', m => { if (m.type() === 'error') { errs.push(m.text()); console.error('CONSOLE', m.text()); } });
  await p.addInitScript(([tl, ic]) => { window.TIMELINE = tl; window.ICON_SVG = ic; }, [TL, iconMap()]);
  await p.goto('file://' + path.join(FILM, 'index.html'));
  for (const s of scripts()) await p.addScriptTag({ path: path.join(FILM, s) });
  const info = await p.evaluate(() => window.prepare());
  p.errs = errs; p.info = info; return p;
}
async function grab(p, i, o) {
  const fmt = o.png ? 'image/png' : 'image/jpeg', q = o.preview ? .88 : .95;
  let n = await p.evaluate(([i, so]) => window.renderFrame(i, so), [i, { samples: o.samples }]);
  for (let k = 0; k < 3 && await p.evaluate(() => window.__late); k++) { await p.evaluate(() => window.awaitPending()); n = await p.evaluate(([i, so]) => window.renderFrame(i, so), [i, { samples: o.samples }]); }
  const data = await p.evaluate(([fmt, q, half]) => {
    const c = document.getElementById('c'); if (!half) return c.toDataURL(fmt, q);
    const h = document.createElement('canvas'); h.width = 960; h.height = 540; h.getContext('2d').drawImage(c, 0, 0, 960, 540); return h.toDataURL(fmt, q);
  }, [fmt, q, !!o.preview]);
  return { buf: Buffer.from(data.split(',')[1], 'base64'), n };
}
(async () => {
  const out = arg('out', path.join(ROOT, 'out/frames')), preview = !!arg('preview'), png = !!arg('png');
  const samples = preview ? 1 : (arg('samples', 'auto'));
  let frames;
  if (arg('frames')) frames = String(arg('frames')).split(',').map(Number);
  else if (arg('times')) frames = String(arg('times')).split(',').map(t => Math.min(NF - 1, Math.round(parseFloat(t) * FPS)));
  else if (arg('scene')) { const s = TL.scenes.find(s => s.id === arg('scene')); frames = []; for (let i = Math.round(s.start * FPS); i < Math.round(s.end * FPS); i++) frames.push(i); }
  else { const a = +arg('from', 0), b = Math.min(NF, +arg('to', NF)); frames = []; for (let i = a; i < b; i++) frames.push(i); }
  fs.mkdirSync(out, { recursive: true });
  const workers = Math.max(1, Math.min(+arg('workers', 1), frames.length));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--allow-file-access-from-files', '--disable-web-security'] });
  if (arg('export')) {
    const p = await openPage(browser);
    fs.writeFileSync(path.join(FILM, 'sfx.json'), JSON.stringify(await p.evaluate(() => window.getCues())));
    // on-screen text/icon log: render every 3rd frame without blur
    await p.evaluate(() => { window.LOG.on = true; });
    for (let i = 0; i < NF; i += 3) await p.evaluate(i => window.renderFrame(i, { samples: 1, post: false }), i);
    const log = await p.evaluate(() => ({ text: window.LOG.text, icons: [...new Set(window.LOG.icons)], missing: window.getMissing() }));
    const seen = {}; for (const [t, s] of log.text) { if (!seen[s]) seen[s] = { first: t, last: t }; seen[s].last = t; }
    fs.writeFileSync(path.join(FILM, 'onscreen.json'), JSON.stringify({ strings: seen, icons: log.icons.sort(), missingAnchors: log.missing, errors: p.errs }, null, 1));
    console.log('exported sfx.json + onscreen.json; strings:', Object.keys(seen).length, 'icons:', log.icons.length, 'missing anchors:', log.missing, 'errors:', p.errs.length);
    await browser.close(); return;
  }
  let next = 0; const t0 = Date.now(), bench = {};
  const work = async w => {
    const p = await openPage(browser);
    while (next < frames.length) {
      const i = frames[next++], ts = Date.now();
      const { buf, n } = await grab(p, i, { preview, png, samples });
      fs.writeFileSync(path.join(out, `f${String(i).padStart(4, '0')}.${png ? 'png' : 'jpg'}`), buf);
      if (arg('bench')) { const sid = TL.scenes.find(s => i / FPS >= s.start && i / FPS < s.end)?.id || 'end'; (bench[sid] = bench[sid] || []).push([Date.now() - ts, n]); }
    }
    return p.errs.length;
  };
  const errs = await Promise.all(Array.from({ length: workers }, (_, w) => work(w)));
  await browser.close();
  const sec = (Date.now() - t0) / 1000;
  console.log(`rendered ${frames.length} frames in ${sec.toFixed(1)}s (${(sec / frames.length).toFixed(2)} s/frame wall) errors=${errs.reduce((a, b) => a + b, 0)}`);
  if (arg('bench')) for (const [k, v] of Object.entries(bench)) console.log(k.padEnd(11), 'ms/frame', Math.round(v.reduce((a, b) => a + b[0], 0) / v.length), 'avg N', (v.reduce((a, b) => a + b[1], 0) / v.length).toFixed(1));
})();
