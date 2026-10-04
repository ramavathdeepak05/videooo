// Renders zelios.html frames: node render-zelios.js <outDir> <from> <to> [frameList]
// Also writes sfx.json (sound cue sheet) for the audio mix.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const [out = 'frames', from = '0', to = '-1', list] = process.argv.slice(2);
  const FPS = 30, TL = JSON.parse(fs.readFileSync(path.join(__dirname, 'timeline.json')));
  const dir = path.join(__dirname, 'node_modules/lucide-static/icons'), ICON_SVG = {};
  for (const f of fs.readdirSync(dir)) ICON_SVG[f.replace('.svg', '')] = fs.readFileSync(path.join(dir, f), 'utf8');
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.error('PAGE ERROR', e.message));
  await p.addInitScript(([tl, ic]) => { window.TIMELINE = tl; window.ICON_SVG = ic; }, [TL, ICON_SVG]);
  await p.goto('file://' + path.join(__dirname, 'zelios.html'));
  await p.evaluate(() => window.prepare());
  if (from === '0') fs.writeFileSync(path.join(__dirname, 'sfx.json'), JSON.stringify(await p.evaluate(() => window.SFX), null, 0));
  const n = Math.round(TL.duration * FPS), end = +to < 0 ? n : Math.min(n, +to);
  const frames = list ? list.split(',').map(Number) : [...Array(end - +from).keys()].map(i => i + +from);
  for (const i of frames) {
    const data = await p.evaluate(t => { render(t); return document.getElementById('c').toDataURL('image/jpeg', .93); }, i / FPS);
    fs.writeFileSync(`${out}/f${String(i).padStart(4, '0')}.jpg`, Buffer.from(data.split(',')[1], 'base64'));
  }
  await b.close();
})();
