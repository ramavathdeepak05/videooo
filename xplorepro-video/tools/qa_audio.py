"""Audio QA for the film mix: loudness / true peak (ffmpeg ebur128), per-line VO-over-music margins in the speech band,
per-scene RMS, cue density, and a waveform + spectrogram PNG.
Usage: python3 tools/qa_audio.py [--mix out/mix/mix.wav] [--stems out/mix] [--timeline film/timeline.json] [--cues film/sfx.json] [--png out/qa/audio/mix.png]"""
import argparse, json, re, subprocess, os
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt

ap = argparse.ArgumentParser()
ap.add_argument('--mix', default='out/mix/mix.wav'); ap.add_argument('--stems', default='out/mix')
ap.add_argument('--timeline', default='film/timeline.json'); ap.add_argument('--cues', default='film/sfx.json')
ap.add_argument('--png', default='out/qa/audio/mix.png'); ap.add_argument('--min-margin', type=float, default=8.0)
a = ap.parse_args()

def ebur(path):
    out = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    s = out[out.rfind('Summary:'):]
    I = re.search(r'I:\s+(-?[\d.]+) LUFS', s); TP = re.search(r'Peak:\s+(-?[\d.]+) dBFS', s); LRA = re.search(r'LRA:\s+(-?[\d.]+) LU', s)
    return {'lufs': float(I.group(1)) if I else None, 'true_peak': float(TP.group(1)) if TP else None, 'lra': float(LRA.group(1)) if LRA else None}

rms = lambda x: 20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-12)
tl = json.load(open(a.timeline))
print('mix', a.mix, ebur(a.mix))
ok = True
stem = lambda n: os.path.join(a.stems, f'stem_{n}.wav')
if all(os.path.exists(stem(n)) for n in ('vox', 'music', 'fx')):
    v, sr = sf.read(stem('vox')); m, _ = sf.read(stem('music')); f, _ = sf.read(stem('fx'))
    band = lambda x: sosfilt(butter(2, [200, 5000], 'band', fs=sr, output='sos'), x, axis=0)
    vb, mb, fb = band(v), band(m), band(f)
    print(f'{"line":5s} {"start":>6s} {"vox-music":>10s} {"vox-fx":>7s}   (speech band 200 Hz-5 kHz, dB)')
    for s in tl['scenes']:
        for L in s['vo']:
            i, j = int(L['start'] * sr), int((L['start'] + L['dur']) * sr)
            dm, df = rms(vb[i:j]) - rms(mb[i:j]), rms(vb[i:j]) - rms(fb[i:j])
            flag = '' if dm >= a.min_margin else '  <-- low'
            ok &= dm >= a.min_margin
            print(f'{L["id"]:5s} {L["start"]:6.2f} {dm:10.1f} {df:7.1f}{flag}')
mx, sr = sf.read(a.mix)
print('per-scene RMS (dB):', {s['id']: round(rms(mx[int(s['start'] * sr):int(s['end'] * sr)]), 1) for s in tl['scenes']})
if os.path.exists(a.cues):
    t = np.array(sorted(c['t'] for c in json.load(open(a.cues))))
    dens = max((np.sum((t >= x) & (t < x + 1)) for x in np.arange(0, tl['duration'], .25)), default=0)
    print(f'cues {len(t)}, max per second {dens}')
os.makedirs(os.path.dirname(a.png), exist_ok=True)
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', a.mix, '-filter_complex',
                '[0]showwavespic=s=1800x200:colors=#7438F2[w];[0]showspectrumpic=s=1800x360:legend=0:scale=log:stop=12000[s];[w][s]vstack',
                '-frames:v', '1', a.png], check=True)
print('png', a.png, '| margins OK' if ok else '| SOME MARGINS LOW')
