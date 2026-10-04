"""Original score + sound design + voiceover mix for the XplorePro motion film.
Reads timeline.json (scene cuts, VO placement) and sfx.json (animation cue sheet from the renderer).
Writes audio/mix.wav (stereo, 44.1 kHz)."""
import json, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve, resample_poly

ROOT = '/home/user/videooo/xplorepro-video/'
SR = 44100
TL = json.load(open(ROOT + 'timeline.json'))
CUES = json.load(open(ROOT + 'sfx.json'))
DUR = TL['duration']
N = int(DUR * SR) + SR
rs = np.random.RandomState(7)
BEAT = 60 / TL['bpm']

def mtof(m): return 440 * 2 ** ((m - 69) / 12)
def tt(d): return np.arange(int(d * SR)) / SR
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def saw(f, t, ph=0): return 2 * ((f * t + ph) % 1) - 1
def noise(d): return rs.uniform(-1, 1, int(d * SR))
def env(d, a=.005, dec=.2):
    t = tt(d); e = np.exp(-t / dec); n = int(a * SR)
    if n: e[:n] *= np.linspace(0, 1, n)
    return e

class Bus:
    def __init__(self): self.x = np.zeros((N, 2))
    def add(self, sig, t, gain=1., pan=0.):
        i = int(t * SR)
        if i >= N or len(sig) == 0: return
        if i < 0: sig = sig[-i:]; i = 0
        sig = sig[:N - i]
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        self.x[i:i + len(sig), 0] += sig * gain * l * 1.414
        self.x[i:i + len(sig), 1] += sig * gain * r * 1.414

drums, bass, keys, pad, fx, vox, send = Bus(), Bus(), Bus(), Bus(), Bus(), Bus(), Bus()

# ---------------- instruments ----------------
def kick():
    t = tt(.45); f = 45 + 110 * np.exp(-t / .035)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .16)
    s[:200] += np.linspace(1, 0, 200) * .5
    return np.tanh(s * 1.6)
def clap():
    s = np.zeros(int(.3 * SR))
    for k, o in enumerate([0, .011, .023]):
        n = bp(noise(.25), 900, 2800) * env(.25, .001, .05 if k < 2 else .12); i = int(o * SR); s[i:i + len(n)] += n[:len(s) - i]
    return s * 1.2
def hat(open_=False): return hp(noise(.3 if open_ else .06), 7500, 4) * env(.3 if open_ else .06, .001, .11 if open_ else .018)
def snare(): return bp(noise(.2), 1200, 6000) * env(.2, .001, .06) + np.sin(2 * np.pi * 190 * tt(.2)) * env(.2, .001, .04) * .5
def pluck(m, d=.28):
    t = tt(d); f = mtof(m)
    s = saw(f, t) * .6 + saw(f * 1.005, t, .3) * .4
    return lp(s, 3400) * env(d, .002, .09)
def bassnote(m, d):
    t = tt(d); f = mtof(m)
    s = .55 * np.sin(2 * np.pi * f * t) + .45 * lp(saw(f, t), 700)
    e = np.minimum(1, np.exp(-t / .5) + .25) * np.minimum(1, t / .004); e[-200:] *= np.linspace(1, 0, 200)
    return s * e
def padchord(ms, d, cutoff=1400):
    t = tt(d); s = np.zeros(len(t))
    for m in ms:
        for dt in (-.08, 0, .08):
            s += saw(mtof(m) * 2 ** (dt / 12), t, rs.rand())
    s = lp(s / (len(ms) * 3), cutoff, 2)
    a = np.minimum(1, t / .35); r = np.minimum(1, (d - t) / .4)
    return s * a * np.clip(r, 0, 1)
def bell(f, d=1.2):
    t = tt(d)
    return (np.sin(2 * np.pi * f * t) + .5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / .15) + .25 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t / .07)) * env(d, .002, .35)

# ---------------- sfx ----------------
def sfx_pop():
    t = tt(.12); f = 420 + 900 * (t / .12) ** .7
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(.12, .002, .035)
def sfx_whoosh(d=.6):
    t = tt(d); n = noise(d); out = np.zeros(len(t)); steps = 24
    for k in range(steps):
        a, b = int(k * len(t) / steps), int((k + 1) * len(t) / steps)
        c = 300 * (12 ** (k / steps)); out[a:b] = bp(n, c * .6, min(c * 1.6, 18000), 1)[a:b]
    return out * np.sin(np.pi * t / d) ** 2 * 2.2
def sfx_impact():
    t = tt(2.2); f = 38 + 70 * np.exp(-t / .08)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .6)
    crack = hp(noise(2.2), 1500) * np.exp(-t / .08) * .5
    return np.tanh((boom + crack) * 1.4)
def sfx_shine():
    s = np.zeros(int(1.4 * SR))
    for k, f in enumerate([2349, 2960, 3520, 4699]):
        b = bell(f, 1.0) * .35; i = int(k * .06 * SR); s[i:i + len(b)] += b
    return s
def sfx_stop():
    t = tt(.7); f = 520 * np.exp(-t * 4.2) + 30
    return lp(saw(1, np.cumsum(f) / SR), 2500) * np.minimum(1, (.7 - t) / .2) * .7
def sfx_suck(d=.55):
    t = tt(d); w = sfx_whoosh(d)[::-1]
    return w * (t / d) ** 2 * 1.4
def sfx_scan(d=.9):
    t = tt(d); f = 600 + 1800 * t / d
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * .25
    return (bp(noise(d), 2000, 7000) * .5 + tone) * np.sin(np.pi * t / d)
def sfx_blip():
    out = np.zeros(int(.3 * SR))
    for k, f in enumerate([988, 740]):
        t = tt(.1); s = np.sign(np.sin(2 * np.pi * f * t)) * env(.1, .002, .05) * .4; i = int(k * .1 * SR); out[i:i + len(s)] += s
    return lp(out, 5000)
def sfx_success():
    s = np.zeros(int(1.8 * SR))
    for k, m in enumerate([74, 78, 81, 86]):
        b = bell(mtof(m), 1.2) * .5; i = int(k * .07 * SR); s[i:i + len(b)] += b
    return s
def sfx_tick(): return hp(noise(.03), 3000) * env(.03, .0005, .006) + np.sin(2 * np.pi * 2200 * tt(.03)) * env(.03, .001, .01) * .6
def sfx_click(): return bp(noise(.05), 1500, 9000) * env(.05, .0005, .008) * 1.3 + np.sin(2 * np.pi * 900 * tt(.05)) * env(.05, .001, .012)
def sfx_type(): return bp(noise(.04), 2500, 8000) * env(.04, .0005, .007)
def sfx_ding(): return bell(1568, 1.0) * .6
def sfx_riser(d=1.3):
    t = tt(d); n = noise(d); out = np.zeros(len(t)); steps = 30
    for k in range(steps):
        a, b = int(k * len(t) / steps), int((k + 1) * len(t) / steps)
        out[a:b] = hp(n, 400 * (20 ** (k / steps)), 2)[a:b]
    tone = saw(1, np.cumsum(200 * 4 ** (t / d)) / SR) * .15
    return (out + lp(tone, 4000)) * (t / d) ** 2

SFX = dict(pop=(sfx_pop, .3, 0), whoosh=(sfx_whoosh, .32, -.25), impact=(sfx_impact, .6, 0), shine=(sfx_shine, .2, 0),
           stop=(sfx_stop, .55, 0), suck=(sfx_suck, .5, 0), scan=(sfx_scan, .22, 0), blip=(sfx_blip, .3, 0),
           success=(sfx_success, .35, 0), tick=(sfx_tick, .3, 0), click=(sfx_click, .5, 0), type=(sfx_type, .22, 0),
           ding=(sfx_ding, .28, 0), riser=(sfx_riser, .3, -1.0))

# ---------------- arrangement ----------------
scene = {s['id']: s for s in TL['scenes']}
DROP = scene['reveal']['start']          # 6.5
GROOVE = scene['eco']['start']           # 8.5
BUILD = scene['converge']['start']       # 38.5
CTA = scene['cta']['start']              # 43.5
STOP = scene['chaos']['vo'][1]['start']  # "...and no idea"
OFF = .5                                 # bar grid offset so the drop lands on a downbeat
PROG = [([59, 62, 66], 47), ([59, 62, 67], 43), ([57, 62, 66], 38), ([57, 61, 64], 45)]  # Bm G D A
def chord_at(t): return PROG[int(np.floor((t - OFF) / (4 * BEAT))) % 4]

nbeats = int(DUR / BEAT)
for b in range(nbeats):
    t = b * BEAT
    intro, quiet = t < DROP, STOP - .05 <= t < DROP
    if t >= CTA + 4 * BEAT: break
    if intro and not quiet:
        if b % 2 == 0 and t >= 2.0: drums.add(kick(), t, .55)
        drums.add(hat(), t + BEAT / 2, .25, .3)
    elif not intro:
        groove = t >= GROOVE and t < CTA
        if groove or t >= DROP + 4 * BEAT * 0:  # reveal: half-time
            if groove: drums.add(kick(), t, .9)
            elif b % 2 == 0: drums.add(kick(), t, .8)
        if groove and b % 2 == 1: drums.add(clap(), t, .45); send.add(clap(), t, .12)
        if groove: drums.add(hat(True), t + BEAT / 2, .16, .2)
        if groove:
            for k in (0, 2): drums.add(hat(), t + k * BEAT / 4, .12, -.3)
# snare build into the converge section
for k in range(16):
    tb = BUILD - 2.0 + 2.0 * (1 - (1 - k / 16) ** 1.4)
    drums.add(snare(), tb, .15 + .35 * k / 16, .1)
# bass: driving 8ths after the drop, held notes in the reveal, pulses in the intro
t = 0.
while t < CTA:
    ch, root = chord_at(t)
    if t < STOP - .05:
        if t >= 1.0: bass.add(bassnote(root, BEAT * .45), t, .35)
        t += BEAT
    elif t < DROP: t += BEAT
    elif t < GROOVE:
        bass.add(bassnote(root, 4 * BEAT * .95), t, .55); t += 4 * BEAT
    else:
        bass.add(bassnote(root + (12 if (t / (BEAT / 2)) % 2 else 0), BEAT / 2 * .9), t, .5); t += BEAT / 2
bass.add(bassnote(38, 5.0), CTA, .6)
# pluck arpeggio (16ths), brighter octave in the middle section
t = 0.
pat = [0, 1, 2, 1, 0, 2, 1, 2]
k = 0
while t < CTA + 3.5:
    ch, _ = chord_at(t) if t < CTA else ([57, 62, 66], 0)
    if not (STOP - .05 <= t < DROP):
        m = ch[pat[k % 8]] + 12 + (12 if scene['mentor']['start'] <= t < scene['proctor']['start'] and k % 4 == 3 else 0)
        g = .16 if t < DROP else .22 if t < CTA else .14 * max(0, 1 - (t - CTA) / 3.5)
        keys.add(pluck(m), t, g, .35 * np.sin(k * .7)); send.add(pluck(m), t, g * .5)
    t += BEAT / 4; k += 1
# pads (whole bars), filtered in the intro, open after the drop
t = OFF - 4 * BEAT
while t < CTA:
    ch, _ = chord_at(max(t, 0) + .01)
    cut = 600 if t < DROP else 1800
    pad.add(padchord(ch, 4 * BEAT + .4, cut), max(t, 0), .32 if t < DROP else .26)
    t += 4 * BEAT
pad.add(padchord([57, 62, 66, 69], 6.5, 2200), CTA, .4)
pad.add(padchord([50, 57], 6.5, 900), CTA, .3)
# transition risers + hits
fx.add(sfx_riser(1.5), DROP - 1.5, .35); fx.add(sfx_riser(1.6), BUILD - 1.6, .32)
fx.add(sfx_impact(), CTA, .4); send.add(sfx_impact(), CTA, .2)
fx.add(sfx_shine(), CTA + .05, .3)

# ---------------- animation cue sheet ----------------
for c in CUES:
    fn, base, pan = SFX[c['type']]
    s = fn()
    off = -.9 if c['type'] == 'riser' else (-.3 if c['type'] == 'whoosh' else 0)
    p = pan if pan else float(np.clip(np.sin(c['t'] * 3.1) * .35, -1, 1))
    fx.add(s, c['t'] + off, base * c['gain'], p)
    if c['type'] in ('impact', 'success', 'shine', 'ding', 'pop'): send.add(s, c['t'] + off, base * c['gain'] * .35)

# ---------------- voiceover ----------------
for sc in TL['scenes']:
    for v in sc['vo']:
        a, sr = sf.read(f"{ROOT}audio/vo_{v['i']:02d}.wav")
        if a.ndim > 1: a = a.mean(1)
        if sr != SR: a = resample_poly(a, SR, sr)
        a = hp(a, 85)
        sp = a[np.abs(a) > .02]                     # level-match lines on speech RMS, then soft-limit peaks
        a = a / (np.sqrt((sp ** 2).mean()) + 1e-9) * 10 ** (-17 / 20)
        a = np.tanh(a * 1.4) / 1.4
        vox.add(a, v['start'], 1.0)

# ---------------- mix ----------------
# reverb send
it = tt(1.8); ir = rs.randn(len(it), 2) * np.exp(-it / .45)[:, None]
ir[:, 0] = lp(ir[:, 0], 6000); ir[:, 1] = lp(ir[:, 1], 6000); ir /= np.sqrt((ir ** 2).sum(0))
rev = np.stack([fftconvolve(send.x[:, c], ir[:, c])[:N] for c in range(2)], 1) * .5
# kick sidechain pump on pad/bass/keys
pump = np.ones(N)
for b in range(nbeats):
    t0 = b * BEAT
    if GROOVE <= t0 < CTA:
        i = int(t0 * SR); n = int(.3 * SR); pump[i:i + n] = np.minimum(pump[i:i + n], 1 - .55 * np.exp(-np.arange(n) / SR / .09))
music = drums.x * .9 + (bass.x + keys.x + pad.x) * pump[:, None] + rev
# duck music under the voice
ve = np.abs(vox.x).max(1)
win = int(.03 * SR); ve = np.convolve(ve, np.ones(win) / win, 'same')
duck = np.zeros(N); a_att, a_rel, y = np.exp(-1 / (.02 * SR)), np.exp(-1 / (.35 * SR)), 0.
target = np.clip(ve * 25, 0, 1)
for i in range(0, N, 64):
    x = target[i]; coef = a_att if x > y else a_rel; y = x + (y - x) * coef ** 64; duck[i:i + 64] = y
music *= (1 - .62 * duck)[:, None]
fx.x *= (1 - .3 * duck)[:, None]
# fade-out at the very end
fo = int(2.5 * SR); end = int(DUR * SR)
music[end - fo:end] *= np.linspace(1, 0, fo)[:, None]; music[end:] = 0
master = music * .3 + fx.x * .6 + vox.x * 1.0
if __import__('os').environ.get('STEMS'):
    for nm, st in (('vox', vox.x), ('music', music * .34), ('fx', fx.x * .6)): sf.write(ROOT + f'audio/stem_{nm}.wav', st[:int(DUR*SR)], SR, subtype='FLOAT')
master = master[:end]
master = np.tanh(master * 1.1) / np.tanh(1.1)
master /= np.max(np.abs(master)) / .95
sf.write(ROOT + 'audio/mix.wav', master, SR, subtype='PCM_16')
sf.write(ROOT + 'audio/music_only.wav', (music[:end] * .55) / (np.max(np.abs(music[:end] * .55)) / .9), SR, subtype='PCM_16')
print('wrote mix', master.shape[0] / SR, 's')
