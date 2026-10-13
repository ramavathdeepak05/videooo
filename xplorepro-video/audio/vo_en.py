"""English voiceover for the 60s film: Kokoro (open-source neural TTS), voice af_heart (female, US).
Reads audio/script_en.json ([key|word] anchors, {optional} words), writes audio/vo_en/Lxx.wav, audio/vo_en.json
(same schema as vo_te.json: id, file, dur, sr, text, anchors{key: seconds from line start}), and a review pack.
Anchor times use prefix synthesis: the text up to the anchored word is synthesised on its own, trailing silence is
trimmed, and its spoken length is the anchor time (Kokoro exposes no durations). Expected accuracy is about +-80 ms.
Usage: python3 audio/vo_en.py [--only L07,L15] [--speed 1.0] [--voice af_heart]"""
import argparse, json, os, re
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
M = '/home/user/tools/'
ap = argparse.ArgumentParser()
ap.add_argument('--only', default=''); ap.add_argument('--speed', type=float, default=1.0); ap.add_argument('--voice', default='af_heart')
a = ap.parse_args()
k = Kokoro(M + 'kokoro-v1.0.onnx', M + 'voices-v1.0.bin')
script = json.load(open(f'{ROOT}/audio/script_en.json'))['lines']
os.makedirs(f'{ROOT}/audio/vo_en', exist_ok=True)
out_path = f'{ROOT}/audio/vo_en.json'
prev = {v['id']: v for v in json.load(open(out_path))} if os.path.exists(out_path) else {}
only = set(x for x in a.only.split(',') if x)


def parse(te):
    plain, keys = '', []
    for m in re.finditer(r'\[(\w+)\|([^\]]+)\]|\{([^}]*)\}|([^\[{]+)', te):
        if m.group(1): keys.append((m.group(1), len(plain))); plain += m.group(2)
        elif m.group(3) is not None: plain += m.group(3)
        else: plain += m.group(4)
    return re.sub(r'\s+', ' ', plain).strip(), keys


# TTS-only respellings (captions/script keep the house spelling): noun 'résumé' (not the verb), US spellings sound the same
TTS_FIX = [(r'\b[Rr]esume\b', 'résumé'), (r'\bPractise\b', 'Practice'), (r'\bpersonalised\b', 'personalized'), (r'AI-proctored', 'AI proctored')]


def synth(text, speed):
    for pat, rep in TTS_FIX: text = re.sub(pat, rep, text)
    w, sr = k.create(text, voice=a.voice, speed=speed, lang='en-us')
    return np.asarray(w, dtype=np.float64), sr


def bounds(w, sr, thr_db=-42):
    """first/last sample above threshold (20 ms frames)"""
    f = int(.02 * sr); n = len(w) // f
    if n == 0: return 0, len(w)
    e = 20 * np.log10(np.sqrt((w[:n * f].reshape(n, f) ** 2).mean(1)) + 1e-12)
    on = np.where(e > e.max() + thr_db)[0]
    if len(on) == 0: return 0, len(w)
    return on[0] * f, min(len(w), (on[-1] + 1) * f)


def speech_rms_db(w):
    f = 480; n = len(w) // f; e = np.sqrt((w[:n * f].reshape(n, f) ** 2).mean(1)); v = e[e > .1 * e.max()]
    return 20 * np.log10(np.sqrt((v ** 2).mean()) + 1e-12)


rows = []
for L in script:
    lid = L['id']
    if only and lid not in only and lid in prev:
        rows.append(prev[lid]); continue
    text, keys = parse(L['en'])
    speed = L.get('speed', a.speed)
    w, sr = synth(text, speed)
    s0, s1 = bounds(w, sr)
    pre, tail = int(.03 * sr), int(.15 * sr)
    i0, i1 = max(0, s0 - pre), min(len(w), s1 + tail)
    y = w[i0:i1].copy()
    if s0 - pre < 0: y = np.concatenate([np.zeros(pre - s0), y])
    lead = pre / sr                                   # speech onset inside the trimmed wav
    fi, fo = int(.004 * sr), int(.04 * sr)
    y[:fi] *= np.linspace(0, 1, fi); y[-fo:] *= np.linspace(1, 0, fo)
    y *= 10 ** ((-20 - speech_rms_db(y)) / 20)
    pk = np.max(np.abs(y))
    if pk > .89: y *= .89 / pk
    anchors = {}
    for key, ci in keys:
        prefix = text[:ci].strip().rstrip(',;:')
        if not prefix:
            anchors[key] = round(lead + .005, 3); continue
        pw, _ = synth(prefix, speed)
        p0, p1 = bounds(pw, sr)
        anchors[key] = round(lead + (p1 - p0) / sr + .04, 3)   # +40 ms: the next word starts after the prefix's release
    # keep anchors monotonic and inside the line
    last = 0.0
    for key, _ in keys:
        anchors[key] = round(min(max(anchors[key], last + .05), len(y) / sr - .1), 3); last = anchors[key]
    f = f'audio/vo_en/{lid}.wav'
    sf.write(f'{ROOT}/{f}', y.astype(np.float32), sr, subtype='PCM_16')
    rows.append({'id': lid, 'file': f, 'dur': round(len(y) / sr, 3), 'sr': sr, 'speed': speed, 'voice': a.voice, 'text': text, 'anchors': anchors})
    print(f'{lid} {len(y) / sr:5.2f}s  {anchors}  {text}')
json.dump(rows, open(out_path, 'w'), indent=1, ensure_ascii=False)

# review pack: all lines with 0.7 s gaps + a sheet
sr = rows[0]['sr']; gap = np.zeros(int(.7 * sr)); parts = []
for r in rows: parts += [sf.read(f'{ROOT}/{r["file"]}')[0], gap]
rev = np.concatenate(parts); rev *= .89 / max(1e-9, np.max(np.abs(rev)))
sf.write(f'{ROOT}/audio/vo_review_en.wav', rev.astype(np.float32), sr, subtype='PCM_16')
with open(f'{ROOT}/audio/vo_review_sheet_en.md', 'w') as fh:
    fh.write(f'# English voiceover review (Kokoro {a.voice})\n\nListen to `audio/vo_review_en.wav` (lines in order, 0.7 s gaps).\n\n| id | scene | line | seconds |\n|---|---|---|---|\n')
    for r, L in zip(rows, script): fh.write(f"| {r['id']} | {L['scene']} | {r['text']} | {r['dur']:.2f} |\n")
print('total speech', round(sum(r['dur'] for r in rows), 2), 's; wrote', out_path)
