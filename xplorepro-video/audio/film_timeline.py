"""Builds film/timeline.json from film/story.json + audio/script_te.json (+ audio/vo_te.json when the real VO exists).
Scene windows are derived from VO durations and snapped to the beat grid; anchors are absolute seconds.
Without vo_te.json (or with --provisional) line durations come from the script budgets and anchors are
estimated from character position."""
import json, math, re, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
story = json.load(open(f'{ROOT}/film/story.json'))
arg = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
script = {l['id']: l for l in json.load(open(os.path.join(ROOT, arg('--script', 'audio/script_te.json'))))['lines']}
vo_path = os.path.join(ROOT, arg('--vo', 'audio/vo_te.json'))
real = {} if ('--provisional' in sys.argv or not os.path.exists(vo_path)) else {v['id']: v for v in json.load(open(vo_path))}
BEAT, D = story['beat'], story['defaults']
snap = lambda t: math.ceil(t / BEAT - 1e-6) * BEAT

def parse(te):
    """strip markup → (plain text, {key: char index})"""
    plain, keys, i = '', {}, 0
    for m in re.finditer(r'\[(\w+)\|([^\]]+)\]|\{([^}]*)\}|([^\[{]+)', te):
        if m.group(1): keys[m.group(1)] = len(plain); plain += m.group(2)
        elif m.group(3) is not None: plain += m.group(3)
        else: plain += m.group(4)
    return plain, keys

t, scenes, lines_out = 0.0, [], {}
for sc in story['scenes']:
    start, v = t, t + sc.get('lead', D['lead'])
    vo, anchors = [], {}
    for lid in sc['lines']:
        L = script[lid]; plain, keys = parse(L.get('te') or L.get('en'))
        if lid in real: dur, rel, f = real[lid]['dur'], real[lid].get('anchors', {}), real[lid]['file']
        else: dur, rel, f = L['budget'], {}, None
        for k, ci in keys.items():
            a = rel.get(k, dur * ci / max(1, len(plain)))
            if k in anchors: print(f'WARNING duplicate anchor {k} in scene {sc["id"]}', file=sys.stderr)
            anchors[k] = round(v + a, 3)
        entry = {'id': lid, 'start': round(v, 3), 'dur': round(dur, 3), 'text': plain, 'file': f, 'provisional': lid not in real}
        vo.append(entry); lines_out[lid] = entry
        v += dur + L.get('gap', D['gap'])
    end_vo = v - D['gap']
    end = max(snap(end_vo + sc.get('tail', D['tail'])), snap(start + sc.get('min', 0)))
    scenes.append({'id': sc['id'], 'start': round(start, 3), 'end': round(end, 3), 'bg': sc.get('bg', {}), 'vo': vo, 'anchors': anchors})
    t = end

def marker(rule):
    if rule.get('end'): return t
    if 'line' in rule:
        sc = next(s for s in scenes if any(l['id'] == rule['line'] for l in s['vo']))
        base = sc['anchors'][rule['anchor']] if 'anchor' in rule else lines_out[rule['line']]['start']
    else: base = next(s for s in scenes if s['id'] == rule['scene'])['start']
    return round(base + rule.get('offset', 0), 3)
markers = {k: marker(r) for k, r in story['markers'].items()}
order = ['intro', 'STOP', 'DROP', 'GROOVE', 'BREAK', 'REGROOVE', 'BUILD', 'LOCKUP', 'CTA', 'END']
names = {'intro': 'intro', 'STOP': 'stop', 'DROP': 'drop', 'GROOVE': 'groove', 'BREAK': 'break', 'REGROOVE': 'regroove', 'BUILD': 'build', 'LOCKUP': 'lockup', 'CTA': 'cta'}
pts = [('intro', 0.0)] + [(k, markers[k]) for k in order[1:] if k in markers]
sections = [{'name': names[pts[i][0]], 'start': pts[i][1], 'end': pts[i + 1][1]} for i in range(len(pts) - 1)]
out = {'duration': t, 'bpm': story['bpm'], 'fps': story['fps'], 'scenes': scenes, 'markers': markers, 'sections': sections,
       'provisional': any(l['provisional'] for l in lines_out.values())}
dst = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else f'{ROOT}/film/timeline.json'
json.dump(out, open(dst, 'w'), indent=1, ensure_ascii=False)
print('wrote', dst)
for s in scenes: print(f"{s['id']:11s} {s['start']:6.2f} - {s['end']:6.2f}  ({s['end'] - s['start']:.2f}s)  lines {[l['id'] for l in s['vo']]}")
print('total', t, 'provisional' if out['provisional'] else 'REAL VO', 'markers', markers)
