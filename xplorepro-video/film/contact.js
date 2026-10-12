// QA contact sheets. Usage:
//   node film/contact.js --scene ID [--step 0.5] [--out PNG]       grid of preview frames across a scene, labelled
//   node film/contact.js --anchors ID                               one frame at each VO anchor of the scene (+0.25s)
//   node film/contact.js --cut ID                                   strip of frames around the cut INTO scene ID (-0.5..+0.5)
//   node film/contact.js --times 1.0,2.5,...                         arbitrary times
// Renders at half resolution with samples=1 (fast), tiles 4 wide with timestamp labels, prints the PNG path.
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const FILM = __dirname, ROOT = path.join(FILM, '..');
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const TL = JSON.parse(fs.readFileSync(path.join(FILM, 'timeline.json')));
let times = [], label = 'times';
const S = id => { const s = TL.scenes.find(s => s.id === id); if (!s) throw new Error('no scene ' + id); return s; };
if (arg('scene')) { const s = S(arg('scene')), st = +arg('step', .5); for (let t = s.start + .05; t < s.end; t += st) times.push(+t.toFixed(3)); label = arg('scene'); }
else if (arg('anchors')) { const s = S(arg('anchors')); times = Object.entries(s.anchors).sort((a, b) => a[1] - b[1]).map(([k, v]) => +(v + .25).toFixed(3)); label = arg('anchors') + '-anchors'; }
else if (arg('cut')) { const s = S(arg('cut')); for (let k = -6; k <= 6; k++) times.push(+(s.start + k / 15).toFixed(3)); label = 'cut-' + arg('cut'); }
else if (arg('times')) { times = String(arg('times')).split(',').map(Number); }
const qa = path.join(ROOT, 'out/qa', String(arg('agent', 'lead'))), tmp = path.join(qa, 'tmp-' + label);
fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
execFileSync('node', [path.join(FILM, 'render.js'), '--out', tmp, '--times', times.join(','), '--preview', '--workers', String(Math.min(2, times.length)), ...(arg('include') ? ['--include', arg('include')] : [])], { stdio: 'inherit' });
const files = fs.readdirSync(tmp).filter(f => f.endsWith('.jpg')).sort();
const outPng = arg('out', path.join(qa, label + '.png'));
// label each tile with its timestamp, then tile 4 wide
const lab = files.map((f, i) => { const fr = +f.slice(1, 5), o = path.join(tmp, 'l' + f);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', path.join(tmp, f), '-vf', `scale=480:-1,drawbox=x=0:y=0:w=150:h=30:color=black@0.6:t=fill,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='${(fr / 30).toFixed(2)}s':x=6:y=6:fontsize=18:fontcolor=white`, o]); return o; });
const cols = 4, rows = Math.ceil(lab.length / cols);
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-pattern_type', 'glob', '-i', path.join(tmp, 'lf*.jpg'), '-vf', `tile=${cols}x${rows}:padding=4:color=white`, '-frames:v', '1', outPng]);
console.log(outPng);
