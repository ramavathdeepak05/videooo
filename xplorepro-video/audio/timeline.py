# Builds timeline.json: scene cuts snapped to the 120 BPM beat grid, VO placement per scene.
import json, math
vo = json.load(open('audio/vo.json'))
BEAT = 0.5
snap = lambda t: math.ceil(t / BEAT - 1e-6) * BEAT
SCENES = [('chaos', [0, 1]), ('reveal', [2]), ('eco', [3]), ('mentor', [4]), ('ats', [5]),
          ('interview', [6]), ('proctor', [7]), ('hire', [8]), ('converge', [9]), ('cta', [10])]
LEAD = {'chaos': .45, 'reveal': .45}
t, out, vos = 0.0, [], []
for sid, lines in SCENES:
    start = t
    v = start + LEAD.get(sid, .25)
    lv = []
    for i in lines:
        lv.append({'i': i, 'start': round(v, 3), 'dur': vo[i]['dur'], 'text': vo[i]['text']})
        v += vo[i]['dur'] + .12
    end_vo = v - .12
    end = snap(end_vo + (3.5 if sid == 'cta' else .3))
    out.append({'id': sid, 'start': start, 'end': end, 'vo': lv})
    vos += lv
    t = end
json.dump({'bpm': 120, 'duration': t, 'scenes': out}, open('timeline.json', 'w'), indent=1)
for s in out: print(f"{s['id']:10s} {s['start']:5.1f}-{s['end']:5.1f}")
print('total', t)
