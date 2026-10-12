// Code-only checks (comments stripped) for film/ JS. Exit 1 on violations.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'film');
const files = [...['core', 'ui'].flatMap(d => fs.existsSync(path.join(root, d)) ? fs.readdirSync(path.join(root, d)).filter(f => f.endsWith('.js')).map(f => path.join(d, f)) : []),
  ...fs.readdirSync(path.join(root, 'scenes')).filter(f => /^\d.*\.js$/.test(f)).map(f => path.join('scenes', f))];
const rules = [
  [/Math\.random|Date\.now|performance\.now|new Date\(/, 'non-deterministic call', 'all'],
  [/(icon|badge)\([^)]*['"](bot|scan-eye|scan-face|eye|eye-off|brain|brain-circuit|smile|frown|angry|laugh|meh)['"]/, 'banned icon (robot/eye/brain/emotion)', 'all'],
  [/\b(back|elastic|confetti|burstLines|decor)\(/, 'retired cartoon helper', 'nocore'],
  [/setTransform\(/, 'setTransform in scene/ui (use save/translate/restore)', 'nocore'],
  [/shadowBlur|\.filter\s*=/, 'per-frame shadowBlur/filter (use softShadow/card)', 'nocore'],
];
let bad = 0;
for (const f of files) {
  const src = fs.readFileSync(path.join(root, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/\/\/.*$/gm, '');
  src.split('\n').forEach((ln, i) => { for (const [re, msg, scope] of rules) { if (scope === 'nocore' && f.startsWith('core')) continue; if (re.test(ln)) { console.log(`ERROR ${msg}: film/${f}:${i + 1}: ${ln.trim().slice(0, 120)}`); bad = 1; } } });
}
process.exit(bad);
