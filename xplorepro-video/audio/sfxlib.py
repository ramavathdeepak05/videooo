"""audio/sfxlib.py: synthesized sound-effect library for the XplorePro film mix (film_mix.py).

Every cue type a scene may register with cue(s, t, type, gain, {x, dur, pitch}) has a recipe here.

  render(kind, seed, dur=None, pitch=None, sr=48000) -> (sig, align_s, send)
    sig      float64 mono [n] or stereo [n, 2] (wide types return decorrelated stereo)
    align_s  offset (s) inside sig of the moment the cue LANDS. The mixer places sig at t_cue - align_s.
             start-aligned: transients and tonal hits; peak-aligned: swish / whoosh / slide; end-aligned: suck / riser / reverse
    send     default reverb send (0..1)

Levels: every recipe is peak-normalised to PEAK_DB[kind] at gain 1.0 (impact about -6 dBFS, tick about -18 dBFS),
so the gains the scene authors pass are predictable.
Variation: seed -> numpy Generator (use seed_for(), never Python's salted hash()). Atonal types get a continuous
+-2 semitone offset; tonal types pick an in-key note (B minor / D major pentatonic: B C# D E F# A) within +-2 semitones
of their nominal pitch, so sparkles never clash with the score. An explicit pitch (semitones) overrides the random
offset; dur stretches the long types (roll servo scan type riser reverse whoosh swish suck slide).
'sublogo' is a tuned sub hit only: the sonic-logo bell motif (F#5-A5-D6) belongs to the score in film_mix.py.
Nothing here is cartoonish: no square-wave boings, everything band-limited with soft attacks.
"""
import zlib
import numpy as np
from scipy.signal import butter, sosfilt, lfilter

SR = 48000
SCALE_PCS = (11, 1, 2, 4, 6, 9)          # B C# D E F# A
TAU = 2.0 * np.pi


def mtof(m):
    return 440.0 * 2.0 ** ((np.asarray(m, float) - 69.0) / 12.0)


def seed_for(kind, t, idx=0):
    """Deterministic per-cue seed (stable across processes)."""
    return zlib.crc32(f'{kind}:{int(round(float(t) * 1000))}:{idx}'.encode()) & 0x7fffffff


# ------------------------------------------------------------------ DSP helpers (shared with film_mix.py)
_SOS = {}


def _sos(kind, f, sr, o):
    key = (kind, f if np.isscalar(f) else tuple(f), sr, o)
    if key not in _SOS:
        ny = sr / 2.0
        w = [min(max(f[0], 5.0), ny * .95), min(max(f[1], 10.0), ny * .98)] if kind == 'band' else min(max(f, 5.0), ny * .98)
        _SOS[key] = butter(o, w, kind, fs=sr, output='sos')
    return _SOS[key]


def lp(x, f, sr=SR, o=2): return sosfilt(_sos('low', f, sr, o), x, axis=0)
def hp(x, f, sr=SR, o=2): return sosfilt(_sos('high', f, sr, o), x, axis=0)
def bp(x, lo, hi, sr=SR, o=2): return sosfilt(_sos('band', (lo, hi), sr, o), x, axis=0)


def rbj(kind, f, q=0.7071, sr=SR, gain_db=0.0):
    """RBJ cookbook biquad -> (b, a). kind: lp hp bp(0 dB peak) peak lowshelf highshelf."""
    w = TAU * min(max(f, 5.0), sr * .49) / sr
    cw, sw = np.cos(w), np.sin(w)
    al = sw / (2.0 * q)
    A = 10.0 ** (gain_db / 40.0)
    if kind == 'lp':
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]; a = [1 + al, -2 * cw, 1 - al]
    elif kind == 'hp':
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]; a = [1 + al, -2 * cw, 1 - al]
    elif kind == 'bp':
        b = [al, 0.0, -al]; a = [1 + al, -2 * cw, 1 - al]
    elif kind == 'peak':
        b = [1 + al * A, -2 * cw, 1 - al * A]; a = [1 + al / A, -2 * cw, 1 - al / A]
    elif kind == 'lowshelf':
        s = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) - (A - 1) * cw + s), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - s)]
        a = [(A + 1) + (A - 1) * cw + s, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - s]
    elif kind == 'highshelf':
        s = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) + (A - 1) * cw + s), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - s)]
        a = [(A + 1) - (A - 1) * cw + s, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - s]
    else:
        raise ValueError(kind)
    b = np.asarray(b, float); a = np.asarray(a, float)
    return b / a[0], a / a[0]


def tv_biquad(x, fc, kind='lp', q=0.7071, sr=SR, block=128):
    """Time-varying biquad: coefficients recomputed every `block` samples at the block-centre cutoff, state carried.
    x: [n] or [n, ch]; fc: scalar or per-sample array (Hz)."""
    x = np.asarray(x, float)
    mono = x.ndim == 1
    X = x[:, None] if mono else x
    n = len(X)
    fc = np.broadcast_to(np.asarray(fc, float), (n,))
    out = np.empty_like(X)
    zi = np.zeros((2, X.shape[1]))
    for i in range(0, n, block):
        j = min(n, i + block)
        b, a = rbj(kind, float(fc[(i + j - 1) // 2]), q, sr)
        out[i:j], zi = lfilter(b, a, X[i:j], axis=0, zi=zi)
    return out[:, 0] if mono else out


def blep_saw(f, n=None, ph0=0.0, sr=SR):
    """Band-limited (polyBLEP) sawtooth. f: scalar (needs n) or per-sample array."""
    if np.isscalar(f):
        dt = float(f) / sr
        ph = (ph0 + dt * (np.arange(n) + 1.0)) % 1.0
        dts = dt
    else:
        f = np.asarray(f, float)
        dts = f / sr
        ph = (ph0 + np.cumsum(dts)) % 1.0
    y = 2.0 * ph - 1.0
    dt_arr = np.broadcast_to(dts, ph.shape)
    m = ph < dt_arr
    if m.any():
        u = ph[m] / dt_arr[m]; y[m] -= u + u - u * u - 1.0
    m = ph > 1.0 - dt_arr
    if m.any():
        u = (ph[m] - 1.0) / dt_arr[m]; y[m] -= u * u + u + u + 1.0
    return y


def smoothstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)


def env_ad(n, sr, a, dec, tail=.002):
    """Soft (sin^2) attack of `a` s, exponential decay tau `dec` s, click-free tail fade."""
    t = np.arange(n) / sr
    e = np.exp(-np.maximum(t - a, 0.0) / dec)
    na = int(a * sr)
    if na > 0:
        e[:na] *= np.sin(np.linspace(0, np.pi / 2, na)) ** 2
    nt = min(n, max(1, int(tail * sr)))
    e[-nt:] *= np.linspace(1, 0, nt)
    return e


def asym_env(u, pk):
    """0..1..0 envelope peaking at u = pk (sin^2 rise, cos^2 fall)."""
    u = np.clip(u, 0, 1)
    return np.where(u < pk, np.sin(np.pi / 2 * u / max(pk, 1e-6)) ** 2,
                    np.cos(np.pi / 2 * (u - pk) / max(1 - pk, 1e-6)) ** 2)


def pan_travel(x, p0, p1):
    """Mono -> stereo with an equal-power pan that travels linearly from p0 to p1."""
    p = np.linspace(p0, p1, len(x))
    a = (np.clip(p, -1, 1) + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], 1) * np.sqrt(2)


# ------------------------------------------------------------------ recipe context
class _Ctx:
    def __init__(self, sr, rng, pitch, dur, tonal):
        self.sr, self.rng, self.pitch, self.dur = sr, rng, pitch, dur
        semis = 0.0 if tonal else (float(pitch) if pitch is not None else float(rng.uniform(-2, 2)))
        self.semis = semis
        self.k = 2.0 ** (semis / 12.0)

    def n(self, d): return max(1, int(round(d * self.sr)))
    def t(self, d): return np.arange(self.n(d)) / self.sr
    def noise(self, n): return self.rng.uniform(-1, 1, n)
    def env(self, n, a, dec): return env_ad(n, self.sr, a, dec)
    def d(self, default): return float(self.dur) if self.dur else default

    def pick(self, cands, nominal=None):
        """In-key note choice (tonal types). Explicit pitch shifts the nominal note instead."""
        nominal = cands[0] if nominal is None else nominal
        if self.pitch is not None:
            return nominal + float(self.pitch)
        ok = [m for m in cands if int(round(m)) % 12 in SCALE_PCS and abs(m - nominal) <= 2] or [nominal]
        return float(self.rng.choice(ok))


# ------------------------------------------------------------------ recipes (each returns mono or stereo, unnormalised)
def _tick(c):
    n = c.n(.045); t = np.arange(n) / c.sr
    click = bp(c.noise(n), 2500 * c.k, 8000, c.sr) * c.env(n, .0003, .0028) * .8
    tone = np.sin(TAU * 3200 * c.k * t) * c.env(n, .0006, .008) * .55
    return click + tone


def _click(c):
    n = c.n(.09); t = np.arange(n) / c.sr; x = np.zeros(n)
    for off, amp in ((0.0, 1.0), (.028, .55)):
        i, m = c.n(off) if off else 0, c.n(.02)
        x[i:i + m] += bp(c.noise(m), 1500 * c.k, 8000, c.sr) * c.env(m, .0002, .0035) * amp
    return x + np.sin(TAU * 1100 * c.k * t) * c.env(n, .0008, .012) * .45


def _pop(c):
    f = float(mtof(c.pick([78, 81, 83], 81)))
    n = c.n(.22); t = np.arange(n) / c.sr
    fr = f * 2.0 ** (-(7 / 12) * np.exp(-t / .008))          # glides up a fifth into the note in ~25 ms
    ph = TAU * np.cumsum(fr) / c.sr
    s = (np.sin(ph) + .12 * np.sin(2 * ph)) * c.env(n, .0015, .06)
    return s + lp(c.noise(n), 6000, c.sr) * c.env(n, .0003, .003) * .12


def _type(c):
    d = c.d(.5); n = c.n(d + .06); x = np.zeros(n); tp = 0.0
    while tp < d:
        m = c.n(.03); tm = np.arange(m) / c.sr; vel = c.rng.uniform(.55, 1.0)
        key = bp(c.noise(m), 1800 * c.k, 7000, c.sr) * c.env(m, .0003, .005) + np.sin(TAU * 520 * c.k * tm) * c.env(m, .0008, .007) * .35
        i = c.n(tp) if tp else 0
        x[i:i + m] += key[:n - i] * vel
        tp += c.rng.uniform(.045, .09)
    return x


def _swish(c):
    d = c.d(.28); n = c.n(d); u = np.arange(n) / n
    fc = 1200 * c.k * 5.0 ** u
    s = tv_biquad(c.noise(n), fc, 'bp', 1.1, c.sr, 64) * asym_env(u, .45)
    p = c.rng.uniform(-.15, .15)
    return pan_travel(s, p - .15, p + .15)


def _whoosh(c):
    d = c.d(.7); n = c.n(d); u = np.arange(n) / n; pk = .4
    fc = np.where(u < pk, 300 * (2500 / 300) ** (u / pk), 2500 * (900 / 2500) ** ((u - pk) / (1 - pk))) * c.k
    e = asym_env(u, pk)
    a = tv_biquad(c.noise(n), fc, 'bp', .9, c.sr, 64)
    b = tv_biquad(c.noise(n), fc * 1.07, 'bp', .9, c.sr, 64)        # decorrelated twin for width
    air = lp(c.noise(n), 380 * c.k, c.sr) * .55
    st = pan_travel((a + air) * e, -.3, .3)
    st[:, 1] = .75 * st[:, 1] + .25 * (b + air) * e
    return st


def _slide(c):
    d = c.d(.34); n = c.n(d); t = np.arange(n) / c.sr
    s = tv_biquad(c.noise(n), 2800 * c.k * (900 / 2800) ** (t / d), 'lp', .6, c.sr, 64)
    e = np.where(t < .03, np.sin(np.pi / 2 * t / .03) ** 2, np.exp(-(t - .03) / .09))
    f = 90 + 60 * np.exp(-t / .03)
    th = np.sin(TAU * np.cumsum(f) / c.sr) * c.env(n, .002, .05) * .35
    out = s * e + th
    out[-c.n(.004):] *= np.linspace(1, 0, c.n(.004))
    return out


def _suck(c):
    d = c.d(.55); n = c.n(d); u = np.arange(n) / n
    s = tv_biquad(c.noise(n), 400 * c.k * (3500 / 400) ** u, 'bp', .9, c.sr, 64) * u ** 2.5
    s += lp(c.noise(n), 300, c.sr) * u ** 3 * .5
    s[-c.n(.004):] *= np.linspace(1, 0, c.n(.004))
    return s


def _thump(c):
    n = c.n(.4); t = np.arange(n) / c.sr
    f = 55 * c.k * (1 + np.exp(-t / .03))
    s = np.sin(TAU * np.cumsum(f) / c.sr) * c.env(n, .002, .12) + lp(c.noise(n), 300, c.sr) * c.env(n, .001, .03) * .3
    return np.tanh(1.5 * s)


def _impact(c):
    n = c.n(2.2); t = np.arange(n) / c.sr
    f = 49 * c.k + 74 * c.k * np.exp(-t / .06)
    sub = np.sin(TAU * np.cumsum(f) / c.sr) * c.env(n, .0015, .55)
    chans = []
    for _ in range(2):
        body = bp(c.noise(n), 200, 800, c.sr) * c.env(n, .001, .25) * .35
        air = hp(c.noise(n), 3000, c.sr) * c.env(n, .0005, .03) * .25
        chans.append(np.tanh(1.2 * (sub + body + air)))
    return np.stack(chans, 1)


def _sublogo(c):
    n = c.n(2.0); t = np.arange(n) / c.sr
    f = 61.74 * c.k + 61.73 * c.k * np.exp(-t / .12)
    ph = TAU * np.cumsum(f) / c.sr
    return (np.sin(ph) + .15 * np.sin(2 * ph)) * c.env(n, .004, .7)


def _chime(c):
    f = float(mtof(c.pick([83, 86, 88, 90], 86)))
    n = c.n(1.6); t = np.arange(n) / c.sr
    idx = 1.4 * np.exp(-t / .12)
    s = np.sin(TAU * f * t + idx * np.sin(TAU * f * t)) * np.exp(-t / .5)
    s += .22 * np.sin(TAU * 2.0 * f * t) * np.exp(-t / .35) + .10 * np.sin(TAU * 3.01 * f * t) * np.exp(-t / .18)
    s += .05 * np.sin(TAU * 4.2 * f * t) * np.exp(-t / .1)
    return s * c.env(n, .002, 10.0)


def _shine(c):
    pool = [93, 95, 98, 102, 105, 107]                          # A6 B6 D7 F#7 A7 B7
    k = int(c.rng.integers(4, 6)); s0 = int(c.rng.integers(0, len(pool) - k + 1))
    notes = [m + (float(c.pitch) if c.pitch is not None else 0.0) for m in pool[s0:s0 + k]]
    n = c.n(1.3); out = np.zeros((n, 2))
    for i, m in enumerate(notes):
        f = float(mtof(m)); i0 = c.n(.04 * i) if i else 0; L = n - i0; t = np.arange(L) / c.sr
        p = np.sin(TAU * f * t) * env_ad(L, c.sr, .002, .32 - .03 * i) * (.9 ** i)
        if 2 * f < 9000:
            p += .15 * np.sin(TAU * 2 * f * t) * np.exp(-t / .08) * (.9 ** i)
        pa = (-.4 if i % 2 == 0 else .4)
        a = (pa + 1) * np.pi / 4
        out[i0:, 0] += p * np.cos(a) * np.sqrt(2); out[i0:, 1] += p * np.sin(a) * np.sqrt(2)
    for ch in range(2):
        out[:, ch] += hp(c.noise(n), 8000, c.sr) * c.env(n, .01, .15) * .08
    return out


def _notify(c):
    pairs = [(81, 86), (78, 83), (76, 81)]
    if c.pitch is not None:
        pair = (81 + float(c.pitch), 86 + float(c.pitch))
    else:
        pair = pairs[int(c.rng.integers(0, len(pairs)))]
    n = c.n(.6); x = np.zeros(n)
    for i, m in enumerate(pair):
        f = float(mtof(m)); i0 = c.n(.09) if i else 0; L = n - i0; t = np.arange(L) / c.sr
        x[i0:] += np.sin(TAU * f * t + 1.2 * np.exp(-t / .06) * np.sin(TAU * 2 * f * t)) * env_ad(L, c.sr, .003, .16) * (1.0 if i else .8)
    return x


def _flag(c):
    pairs = [(71, 66), (69, 64), (74, 69)]                     # B4-F#4, A4-E4, D5-A4: neutral "for review", not an alarm
    pair = (71 + float(c.pitch), 66 + float(c.pitch)) if c.pitch is not None else pairs[int(c.rng.integers(0, 3))]
    n = c.n(.5); x = np.zeros(n)
    for i, m in enumerate(pair):
        f = float(mtof(m)); i0 = c.n(.11) if i else 0; L = n - i0; t = np.arange(L) / c.sr
        mar = np.sin(TAU * f * t) + .25 * np.sin(TAU * 3.93 * f * t) * np.exp(-t / .02) + .08 * np.sin(TAU * 9.2 * f * t) * np.exp(-t / .008)
        x[i0:] += mar * env_ad(L, c.sr, .001, .12) * (1.0 if i == 0 else .8)
    m = c.n(.07); u = np.arange(m) / m
    x[:m] += tv_biquad(c.noise(m), 1500 * (5000 / 1500) ** u, 'bp', 1.0, c.sr, 32) * np.sin(np.pi * u) ** 2 * .25
    return x


def _review(c):
    opts = [(74, 78), (73, 78), (74, 81)]                      # D5+F#5 (nominal), C#5+F#5, D5+A5
    dy = (74 + float(c.pitch), 78 + float(c.pitch)) if c.pitch is not None else opts[int(c.rng.integers(0, 3))]
    n = c.n(1.4); t = np.arange(n) / c.sr
    idx = .8 * (1 - np.exp(-t / .06)) * np.exp(-t / .4)
    x = sum(np.sin(TAU * float(mtof(m)) * t + idx * np.sin(TAU * float(mtof(m)) * t)) for m in dy)
    return x * env_ad(n, c.sr, .025, .5)


def _roll(c):
    d = c.d(.9); n = c.n(d + .05); x = np.zeros(n)
    N = int(np.clip(round(d * 18), 8, 40))
    u = np.arange(N) / N
    times = d * (u - np.sin(TAU * u) / TAU)                    # slow - fast - slow (odometer spin-up and settle)
    for tk in times:
        m = c.n(.03); tm = np.arange(m) / c.sr; vel = c.rng.uniform(.6, 1.0)
        tick = bp(c.noise(m), 2200 * c.k, 7000, c.sr) * env_ad(m, c.sr, .0003, .004) + np.sin(TAU * 2400 * c.k * tm) * env_ad(m, c.sr, .0005, .005) * .4
        i = c.n(tk) if tk > 0 else 0
        x[i:i + m] += tick[:n - i] * vel
    t = np.arange(n) / c.sr
    x += bp(c.noise(n), 800 * c.k, 2000 * c.k, c.sr) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2 * .08
    return x


def _servo(c):
    d = c.d(.45); n = c.n(d); t = np.arange(n) / c.sr
    f = 180 * c.k * (320 / 180) ** smoothstep(t / d)
    s = bp(blep_saw(f, sr=c.sr, ph0=c.rng.uniform()), 250, 2200, c.sr)
    am = 1 - .3 * (.5 + .5 * np.sin(TAU * 40 * t))
    e = np.minimum(np.sin(np.pi / 2 * np.clip(t / .03, 0, 1)) ** 2, np.cos(np.pi / 2 * np.clip((t - (d - .08)) / .08, 0, 1)) ** 2)
    return (s * am + .3 * np.sin(TAU * np.cumsum(f) / c.sr)) * e


def _scan(c):
    d = c.d(.8); n = c.n(d); t = np.arange(n) / c.sr
    s = tv_biquad(c.noise(n), 2000 * c.k * 3.0 ** (t / d), 'bp', 2.0, c.sr, 64)
    tone = np.sin(TAU * np.cumsum(900 * c.k * 2.0 ** (t / d)) / c.sr) * .15
    return (s + tone) * np.sin(np.pi * t / d)


def _reverse(c):
    d = c.d(.9); n = c.n(d); t = np.arange(n) / c.sr
    chans = []
    for _ in range(2):
        part = sum(np.sin(TAU * min(f * c.k, 18000) * t + c.rng.uniform(0, TAU)) for f in (3150, 4220, 5370, 6930, 8340, 9710)) / 6
        cym = part * np.exp(-t / .35) + hp(c.noise(n), 5000, c.sr) * np.exp(-t / .3) * .8
        chans.append(cym[::-1])
    out = lp(np.stack(chans, 1), 11000, c.sr)
    out[:c.n(.03)] *= np.linspace(0, 1, c.n(.03))[:, None]
    out[-c.n(.006):] *= np.linspace(1, 0, c.n(.006))[:, None]
    return out


def _riser(c):
    d = c.d(1.5); n = c.n(d); u = np.arange(n) / n
    tone_f = float(mtof(59)) * c.k * 2.0 ** u
    tone = np.sin(TAU * np.cumsum(tone_f) / c.sr) + .3 * lp(blep_saw(tone_f, sr=c.sr), 3000, c.sr)
    chans = [(tv_biquad(c.noise(n), 300 * (6000 / 300) ** u, 'hp', .7, c.sr, 64) * .7 + tone * .3) * u ** 2 for _ in range(2)]
    out = lp(np.stack(chans, 1), 10000, c.sr)
    out[-c.n(.01):] *= np.linspace(1, 0, c.n(.01))[:, None]
    return out


def _stop(c):
    n = c.n(.5); t = np.arange(n) / c.sr
    f = (30 + 190 * np.exp(-t * 5.5)) * c.k
    s = blep_saw(f, sr=c.sr) + .7 * blep_saw(f * 1.498, sr=c.sr, ph0=.3)
    s = tv_biquad(s, 2500 * (300 / 2500) ** (t / .5), 'lp', .707, c.sr, 64)
    s *= np.cos(np.pi / 2 * np.clip((t - .35) / .15, 0, 1)) ** 2 * np.sin(np.pi / 2 * np.clip(t / .003, 0, 1)) ** 2
    m = c.n(.004)
    s[-m - c.n(.01):-c.n(.01)] += hp(c.noise(m), 2000, c.sr) * .3
    return s


# kind: (fn, align (s, or 'end'/'peak:<frac>'), send, family, tonal, peak dB at gain 1)
TYPES = {
    'tick':    (_tick,    0.0,         .05, 'transient', False, -18.0),
    'click':   (_click,   0.0,         .05, 'transient', False, -16.0),
    'pop':     (_pop,     0.0,         .12, 'transient', True,  -13.0),
    'type':    (_type,    0.0,         .04, 'transient', False, -18.0),
    'swish':   (_swish,   'peak:.45',  .12, 'air',       False, -13.0),
    'whoosh':  (_whoosh,  'peak:.4',   .15, 'air',       False, -10.0),
    'slide':   (_slide,   .03,         .08, 'air',       False, -13.0),
    'suck':    (_suck,    'end',       .10, 'air',       False, -11.0),
    'thump':   (_thump,   0.0,         .05, 'low',       False, -9.0),
    'impact':  (_impact,  0.0,         .35, 'low',       False, -6.0),
    'sublogo': (_sublogo, 0.0,         .08, 'low',       True,  -7.0),
    'chime':   (_chime,   0.0,         .30, 'tonal',     True,  -13.0),
    'shine':   (_shine,   0.0,         .40, 'tonal',     True,  -14.0),
    'notify':  (_notify,  0.0,         .20, 'tonal',     True,  -14.0),
    'flag':    (_flag,    0.0,         .15, 'tonal',     True,  -13.0),
    'review':  (_review,  0.0,         .25, 'tonal',     True,  -13.0),
    'roll':    (_roll,    0.0,         .05, 'long',      False, -17.0),
    'servo':   (_servo,   0.0,         .05, 'long',      False, -17.0),
    'scan':    (_scan,    0.0,         .12, 'long',      False, -15.0),
    'reverse': (_reverse, 'end',       .30, 'long',      False, -12.0),
    'riser':   (_riser,   'end',       .30, 'long',      False, -11.0),
    'stop':    (_stop,    0.0,         .05, 'long',      False, -13.0),
}
FAMILY = {k: v[3] for k, v in TYPES.items()}
WIDE = {'impact', 'riser', 'reverse', 'shine', 'whoosh', 'swish'}


def render(kind, seed, dur=None, pitch=None, sr=SR):
    """-> (sig, align_s, send). Unknown kinds raise KeyError (the mixer maps them to 'tick' and logs it)."""
    fn, align, send, _fam, tonal, peak_db = TYPES[kind]
    rng = np.random.default_rng(int(seed))
    c = _Ctx(sr, rng, pitch, dur, tonal)
    sig = np.asarray(fn(c), float)
    pk = float(np.max(np.abs(sig))) if sig.size else 0.0
    if pk > 0:
        sig = sig * (10.0 ** (peak_db / 20.0) / pk)
    n = len(sig)
    if align == 'end':
        al = n / sr
    elif isinstance(align, str) and align.startswith('peak:'):
        al = float(align.split(':')[1]) * n / sr
    else:
        al = float(align)
    return sig, al, send


if __name__ == '__main__':                                     # quick self-test: render every type
    for k in TYPES:
        s, a, se = render(k, seed_for(k, 1.0))
        print(f'{k:8s} len {len(s) / SR:5.2f}s align {a:5.3f} send {se:.2f} ch {1 if s.ndim == 1 else 2}')
