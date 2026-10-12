#!/usr/bin/env python3
"""audio/film_mix.py: original score + sound design + Telugu VO mix for the XplorePro 60 s film.

  python3 audio/film_mix.py [--timeline film/timeline.json] [--cues film/sfx.json] [--vo audio/vo_te.json]
                            [--out out/mix/mix.wav] [--stems] [--lufs -16] [--no-air] [--music-only] [--seed 7] [-v]

Inputs (relative paths resolve against the project root, not the CWD):
  timeline  markers {STOP DROP LOGO GROOVE BREAK REGROOVE BUILD LOCKUP CTA END}, sections [{name,start,end}],
            scenes [{id,start,end,vo:[{id,start,dur,file}],anchors}]. Only DROP (and duration) are required.
  cues      film/sfx.json from `node film/render.js --export`: [{t, type, gain, scene, x?, dur?, pitch?, anchor?}]
            t is the moment the sound LANDS (sfxlib aligns each type: start / peak / end).
  vo        audio/vo_te.json (line metadata). Used for sanity checks; audio comes from timeline scene.vo[].file.
Outputs:
  --out     48 kHz stereo PCM_24 master at about -16 LUFS integrated, true peak <= -1.2 dBTP (the lead loudnorms
            to -14 LUFS / -1 dBTP at mux; use a measured two-pass loudnorm so it is pure gain).
  mix_meta.json next to --out (grid, markers, cue decisions, cut swishes, score collisions, VO placements, loudness).
  --stems   stem_vox.wav stem_music.wav stem_fx.wav next to --out (float32, post-fader, master gain applied,
            pre-limiter: they sum to the master before soft clip / limiting).
Nothing is keyed to scene ids or absolute times: the arrangement follows markers/sections, the bar grid is anchored so
DROP is a downbeat, groove layers enter at scene cuts, cut swishes follow scenes[i].start, VO follows scenes[].vo[].
"""
import argparse
import json
import math
import os
import sys
import time

import numpy as np
import soundfile as sf
from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d
from scipy.signal import butter, fftconvolve, lfilter, resample_poly, sosfilt, sosfiltfilt

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import sfxlib  # noqa: E402
from sfxlib import blep_saw, env_ad, mtof, rbj, smoothstep, tv_biquad  # noqa: E402

SR = 48000
TAU = 2.0 * np.pi
VERBOSE = False

# ---------------------------------------------------------------- mix constants (calibrated with tools/qa_audio.py)
MIX = dict(
    music=.78, fx=1.0, vox=1.0,                               # bus faders (linear)
    hall_ret=.30, intro_hall_ret=.34, room_ret=.22, fxhall_ret=.20,
    duck_mid_db=-11.0, duck_low_db=-6.0, duck_high_db=-4.0, duck_fx_mid_db=-3.0,
    duck_lo=-45.0, duck_hi=-30.0, duck_look=.015, duck_att=.030, duck_rel=.400, duck_hold=.120,
    glue_ratio=2.0, glue_knee=6.0, glue_att=.020, glue_rel=.250, glue_max_gr=3.0,
    vo_rms_db=-17.0, air_db=-15.0, deess_max_db=4.0,
    lufs=-16.0, ceiling_db=-1.5, tp_max_db=-1.2,
    cut_swish_gain=.22, cut_clear=.15, merge_win=.06, cap_per_s=4,
)
# instrument levels into their buses (linear)
LV = dict(kick=.80, heart=.85, clock=.15, hat=.085, ohat=.06, shaker=.065, clap=.26, snare=.40,
          sub=.42, midbass=.20, pad=.26, intro_pad=.30, pluck=.17, keys=.15, stab=.12, pulse=.11,
          bell=.24, hit=.42, subdrop=.62, riser=.32, swell=.50, bed=.035, tension=.05, air=.05)

# close-voiced pads (MIDI) + sub root (MIDI). Voice leading moves at most two voices per change.
CH = {
    'Bm':    ([62, 66, 71, 73], 35),   # Bm(add9)  D F# B C#   / B1
    'G':     ([62, 66, 67, 71], 31),   # Gmaj7     D F# G B    / G1
    'D/F#':  ([62, 66, 69, 74], 30),   # D/F#      D F# A D    / F#1
    'Asus':  ([62, 64, 69, 74], 33),   # Asus4     D E A D     / A1
    'A':     ([61, 64, 69, 73], 33),   # A         C# E A C#   / A1
    'Gmaj9': ([62, 66, 69, 71], 31),   # Gmaj9     D F# A B    / G1
    'Dadd9': ([62, 66, 69, 76], 38),   # D(add9)   D F# A E    / D2
}
PROG = ['Bm', 'G', 'D/F#', 'A~']          # A~ = Asus4 for two beats, then A
BREAK_PROG = ['G', 'D/F#', 'Bm', 'A~']    # calmer, major-leaning order for the break
BELL = [(78, 1.0, -.2, .80), (81, 1.1, .05, .85), (86, 2.5, .2, 1.0)]   # sonic logo F#5 A5 D6: (midi, dur, pan, gain)
LONG_TYPES = {'roll', 'servo', 'scan', 'type', 'riser', 'reverse'}


def log(*a):
    if VERBOSE:
        print('[film_mix]', *a, flush=True)


def P(p):
    return p if os.path.isabs(p) else os.path.join(ROOT, p)


def db(x):
    return 20.0 * np.log10(np.maximum(np.abs(x), 1e-12))


def undb(d):
    return 10.0 ** (np.asarray(d, float) / 20.0)


def sos(kind, f, o=2):
    return butter(o, f, kind, fs=SR, output='sos')


def zlp(x, f, o=4): return sosfiltfilt(sos('low', f, o), x, axis=0)
def zhp(x, f, o=4): return sosfiltfilt(sos('high', f, o), x, axis=0)


def pan_gains(p):
    a = (float(np.clip(p, -1, 1)) + 1) * np.pi / 4
    return np.cos(a) * np.sqrt(2), np.sin(a) * np.sqrt(2)


class Bus:
    def __init__(self, n):
        self.n = n
        self.x = np.zeros((n, 2))

    def add(self, sig, t, gain=1.0, pan=0.0):
        if sig is None or gain == 0:
            return
        sig = np.asarray(sig, float)
        if len(sig) == 0:
            return
        gl, gr = pan_gains(pan)
        if sig.ndim == 1:
            s2 = np.stack([sig * gl, sig * gr], 1)
        else:
            s2 = sig * np.array([min(1.0, gl), min(1.0, gr)])
        i = int(round(t * SR))
        if i < 0:
            s2 = s2[-i:]
            i = 0
        if i >= self.n or len(s2) == 0:
            return
        s2 = s2[:self.n - i]
        self.x[i:i + len(s2)] += s2 * gain


# ---------------------------------------------------------------- reverb (Freeverb topology rendered to an IR)
def _comb(x, D, fb, damp):
    n = len(x)
    y = np.zeros(n)
    buf = np.zeros(n)                       # buf[n] = x[n] + fb * lp(y)[n];  y[n] = buf[n - D]
    zi = np.zeros(1)
    for i in range(0, n, D):
        j = min(n, i + D)
        yb = buf[i - D:j - D] if i >= D else np.zeros(j - i)
        y[i:j] = yb
        f, zi = lfilter([1 - damp], [1, -damp], yb, zi=zi)
        buf[i:j] = x[i:j] + fb * f
    return y


def _allpass(x, D, g=.5):
    n = len(x)
    v = np.zeros(n)
    y = np.zeros(n)
    for i in range(0, n, D):
        j = min(n, i + D)
        vd = v[i - D:j - D] if i >= D else np.zeros(j - i)
        v[i:j] = x[i:j] + g * vd
        y[i:j] = -x[i:j] + vd
    return y


_IR = {}


def freeverb_ir(room=.82, damp=.45, predelay=.025, length=3.5, width=1.0, hp_f=200.0, lp_f=7000.0):
    key = (room, damp, predelay, length, width, hp_f, lp_f)
    if key in _IR:
        return _IR[key]
    sc = SR / 44100.0
    combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]
    aps = [556, 441, 341, 225]
    fb, dmp = room * .28 + .7, damp * .4
    n = int(length * SR)
    chans = []
    for spread in (0, 23):
        x = np.zeros(n)
        x[0] = 1.0
        acc = np.zeros(n)
        for c in combs:
            acc += _comb(x, int(round((c + spread) * sc)), fb, dmp)
        y = acc * .015
        for a in aps:
            y = _allpass(y, int(round((a + spread) * sc)), .5)
        chans.append(y)
    L, R = chans
    w1, w2 = width / 2 + .5, (1 - width) / 2
    ir = np.stack([L * w1 + R * w2, R * w1 + L * w2], 1)
    ir = sosfilt(sos('high', hp_f, 2), ir, axis=0)
    ir = sosfilt(sos('low', lp_f, 2), ir, axis=0)
    nf = int(.4 * SR)
    ir[-nf:] *= (np.cos(np.linspace(0, np.pi / 2, nf)) ** 2)[:, None]
    ir /= np.sqrt((ir ** 2).sum(0).mean())
    ir = np.concatenate([np.zeros((int(predelay * SR), 2)), ir])
    _IR[key] = ir
    return ir


def hall_ir(): return freeverb_ir(.82, .45, .025, 3.5, 1.0, 200.0, 7000.0)
def room_ir(): return freeverb_ir(.60, .30, .008, 1.6, .9, 250.0, 8000.0)


def reverb(x, ir):
    """Stereo send bus [n,2] -> wet [n,2]; only the non-silent span is convolved."""
    nz = np.nonzero(np.any(x != 0, axis=1))[0]
    out = np.zeros_like(x)
    if len(nz) == 0:
        return out
    i0, i1 = nz[0], nz[-1] + 1
    seg = x[i0:i1]
    w = np.stack([fftconvolve(seg[:, c], ir[:, c]) for c in range(2)], 1)
    m = min(len(w), len(x) - i0)
    out[i0:i0 + m] = w[:m]
    return out


def reverse_swell(src, ir, length):
    """Reverse-reverb swell of a hit: returns stereo audio whose END is where the hit starts."""
    s = np.asarray(src, float)[::-1]
    K = len(ir)
    out = np.stack([fftconvolve(s, ir[:, c]) for c in range(2)], 1)[::-1]
    pd = int(np.argmax(np.any(np.abs(ir) > 1e-9, axis=1)))       # pre-delay samples (swell ends pd before the hit)
    seg = out[:K - 1 - pd]
    n = min(len(seg), int(length * SR))
    seg = seg[-n:].copy()
    seg *= (np.linspace(0, 1, n) ** 2.2)[:, None]
    nf = int(.008 * SR)
    seg[-nf:] *= np.linspace(1, 0, nf)[:, None]
    return seg, pd / SR


# ---------------------------------------------------------------- loudness / dynamics
def k_weight(x):
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    return lfilter(b2, a2, lfilter(b1, a1, x, axis=0), axis=0)


def lufs(x):
    """BS.1770-4 integrated loudness (48 kHz)."""
    x = x if x.ndim == 2 else x[:, None]
    z = k_weight(x) ** 2
    blk, hop = int(.4 * SR), int(.1 * SR)
    if len(z) < blk:
        return -120.0
    cs = np.vstack([np.zeros((1, z.shape[1])), np.cumsum(z, 0)])
    st = np.arange(0, len(z) - blk + 1, hop)
    pw = ((cs[st + blk] - cs[st]) / blk).sum(1)
    L = -0.691 + 10 * np.log10(pw + 1e-20)
    g = pw[L > -70]
    if len(g) == 0:
        return -120.0
    rel = -0.691 + 10 * np.log10(g.mean()) - 10
    g2 = pw[(L > -70) & (L > rel)]
    return float(-0.691 + 10 * np.log10(g2.mean()))


def true_peak_db(x):
    return float(db(np.max(np.abs(resample_poly(x, 4, 1, axis=0)))))


def smooth_ar(x, att, rel):
    """One-pole attack/release smoother on a frame-rate signal (att/rel in frames)."""
    a, r = math.exp(-1.0 / max(att, 1e-3)), math.exp(-1.0 / max(rel, 1e-3))
    out = np.empty(len(x))
    s = 0.0
    for i, v in enumerate(x.tolist()):
        s = v + (s - v) * (a if v > s else r)
        out[i] = s
    return out


def frame_db(x, fr=48, win=10):
    """1 ms frames (fr samples), RMS over `win` frames -> dBFS per frame (mono or stereo-mean power)."""
    nf = len(x) // fr
    p = x[:nf * fr] ** 2
    if p.ndim == 2:
        p = p.mean(1)
    e = p.reshape(nf, fr).mean(1)
    e = uniform_filter1d(e, win, mode='nearest')
    return 10 * np.log10(e + 1e-12)


def frames_to_samples(v, n, fr=48):
    return np.interp(np.arange(n), np.arange(len(v)) * fr + fr / 2, v)


def glue(music):
    L = frame_db(music)
    act = L[L > -60]
    if len(act) == 0:
        return music, 0.0
    R, W = MIX['glue_ratio'], MIX['glue_knee']
    T = np.percentile(act, 99) - MIX['glue_max_gr'] * R / (R - 1)
    o = L - T
    gr = np.where(o <= -W / 2, 0.0, np.where(o >= W / 2, o * (1 - 1 / R), (1 - 1 / R) * (o + W / 2) ** 2 / (2 * W)))
    gr = smooth_ar(gr, MIX['glue_att'] * 1000, MIX['glue_rel'] * 1000)
    g = undb(-frames_to_samples(gr, len(music)))
    return music * g[:, None], float(gr.max())


def soft_clip(x, knee_db=-3.0):
    k = float(undb(knee_db))
    a = np.abs(x)
    return np.sign(x) * np.where(a <= k, a, k + (1 - k) * np.tanh((a - k) / (1 - k)))


def limiter(x, ceiling, look=.010, hold=.040):
    """Stereo-linked lookahead limiter with provably no sample overshoot: centred min-filter (2h+1) then a centred
    moving average of the same length, with a look-back hold for the release."""
    h = int(look * SR)
    w = 2 * h + 1
    g = np.minimum(1.0, ceiling / np.maximum(np.max(np.abs(x), 1), 1e-12))
    g = minimum_filter1d(g, w, mode='nearest')
    hn = int(hold * SR) | 1
    g = minimum_filter1d(g, hn, origin=(hn - 1) // 2, mode='nearest')
    g = uniform_filter1d(g, w, mode='nearest')
    return x * g[:, None], float(db(g.min()))


# ---------------------------------------------------------------- timeline
class Timeline:
    MK = [('stop', 'STOP'), ('drop', 'DROP'), ('groove', 'GROOVE'), ('break', 'BREAK'), ('regroove', 'REGROOVE'),
          ('build', 'BUILD'), ('lockup', 'LOCKUP'), ('cta', 'CTA')]

    def __init__(self, d):
        self.raw = d
        self.dur = float(d['duration'])
        self.bpm = float(d.get('bpm') or 120)
        self.beat = 60.0 / self.bpm
        self.bar = 4 * self.beat
        self.M = {k: float(v) for k, v in (d.get('markers') or {}).items() if v is not None}
        if 'DROP' not in self.M:
            raise SystemExit('film_mix: timeline markers.DROP is required')
        self.M.setdefault('END', self.dur)
        self.off = self.M['DROP'] % self.bar
        secs = d.get('sections')
        if not secs:
            pts = [('intro', 0.0)] + sorted([(n, self.M[k]) for n, k in self.MK if k in self.M], key=lambda p: p[1])
            secs = [{'name': n, 'start': s, 'end': pts[i + 1][1] if i + 1 < len(pts) else self.M['END']} for i, (n, s) in enumerate(pts)]
        self.sections = [dict(name=s['name'], start=float(s['start']), end=float(s['end'])) for s in secs]
        self.scenes = d.get('scenes') or []
        self.cuts = [float(s['start']) for s in self.scenes[1:]]
        self.provisional = bool(d.get('provisional'))

    def m(self, k, default=None):
        return self.M.get(k, default)

    def sec(self, name):
        return next((s for s in self.sections if s['name'] == name), None)

    def section_at(self, t):
        for s in self.sections:
            if s['start'] <= t < s['end']:
                return s
        return self.sections[-1] if t >= self.sections[-1]['start'] else self.sections[0]

    def grid(self, t0, t1, div=1.0):
        """Grid points in [t0, t1): list of (time, k) with k counted from the DROP-anchored downbeat grid."""
        st = self.beat / div
        k0 = math.ceil((t0 - self.off) / st - 1e-6)
        k1 = math.ceil((t1 - self.off) / st - 1e-6)
        return [(self.off + k * st, k) for k in range(k0, k1)]

    def bar_of(self, t):
        return math.floor((t - self.off) / self.bar + 1e-6)

    def beat_offset(self, t):
        """Signed distance (s) from t to the nearest beat of the grid."""
        q = (t - self.off) / self.beat
        return (q - round(q)) * self.beat


def chord_at(tl, t):
    s = tl.section_at(t)
    name = s['name']
    if name in ('intro', 'stop', 'drop', 'lockup'):
        return 'Bm'
    if name == 'build':
        return 'A' if t >= tl.m('LOCKUP', s['end']) - .5 else 'Asus'
    if name == 'cta':
        return 'Gmaj9' if t < s['start'] + tl.bar else 'Dadd9'
    prog = BREAK_PROG if name == 'break' else PROG
    c = prog[(tl.bar_of(t) - tl.bar_of(s['start'])) % 4]
    if c == 'A~':
        return 'A' if ((t - tl.off) % tl.bar) >= 2 * tl.beat - 1e-6 else 'Asus'
    return c


def harmony_segments(tl, t0, t1):
    pts = {t0, t1}
    pts.update(tb for tb, _ in tl.grid(t0, t1, .5))
    pts.update(s['start'] for s in tl.sections if t0 < s['start'] < t1)
    L = tl.m('LOCKUP')
    if L and t0 < L - .5 < t1:
        pts.add(L - .5)
    cta = tl.sec('cta')
    if cta and t0 < cta['start'] + tl.bar < t1:
        pts.add(cta['start'] + tl.bar)
    pts = sorted(pts)
    segs = []
    for a, b in zip(pts[:-1], pts[1:]):
        if b - a < 1e-4:
            continue
        c = chord_at(tl, (a + b) / 2)
        if segs and segs[-1][2] == c and abs(segs[-1][1] - a) < 1e-6:
            segs[-1][1] = b
        else:
            segs.append([a, b, c])
    return segs


# ---------------------------------------------------------------- instruments
class Synth:
    def __init__(self, seed):
        self.rng = np.random.default_rng(seed)
        self._c = {}

    def noise(self, n):
        return self.rng.uniform(-1, 1, n)

    def cache(self, key, fn):
        if key not in self._c:
            self._c[key] = fn()
        return self._c[key]

    # --- tonal
    def supersaw(self, notes, d, att=.3, rel=.6, voices=5, cents=12.0):
        """Decorrelated supersaw: independent detune/phases per channel (true width, mono-safe lows)."""
        n = int((d + rel) * SR)
        out = np.zeros((n, 2))
        offs = np.linspace(-cents, cents, voices)
        for m in notes:
            f0 = float(mtof(m))
            for ch in range(2):
                for o in offs:
                    out[:, ch] += blep_saw(f0 * 2 ** ((o + self.rng.uniform(-2.5, 2.5)) / 1200), n, self.rng.uniform())
        out /= np.sqrt(len(notes) * voices) * 1.5
        t = np.arange(n) / SR
        e = np.sin(np.pi / 2 * np.clip(t / max(att, 1e-3), 0, 1)) ** 2 * np.cos(np.pi / 2 * np.clip((t - d) / rel, 0, 1)) ** 2
        return out * e[:, None]

    def fmkey(self, m, d, vel=.8, rel=.3):
        """2-op FM e-piano: ratio-1 body with decaying index + ratio-14 tine."""
        f = float(mtof(m))
        n = int((d + rel) * SR)
        t = np.arange(n) / SR
        idx = vel * (1.6 * np.exp(-t / .22) + .25)
        y = np.sin(TAU * f * t + idx * np.sin(TAU * f * t))
        if 14 * f < 17000:
            y += np.sin(TAU * 14 * f * t) * np.exp(-t / .03) * .06 * vel
        e = env_ad(n, SR, .003, 1.0) * np.cos(np.pi / 2 * np.clip((t - d) / rel, 0, 1)) ** 2
        return y * e * vel

    def pluck(self, m, bright=.5, var=0, d=1.1, t60=1.3):
        """Karplus-Strong with an allpass-tuned loop (tuning error < 2 cents)."""
        def mk():
            f = float(mtof(m))
            L = SR / f
            P_ = int(np.floor(L - 1.0))
            dd = L - P_ - .5
            c = (1 - dd) / (1 + dd)
            g = 10 ** (-3.0 / (f * t60))
            r = np.random.default_rng(int(m * 100 + var * 7 + bright * 1000))
            exc = sfxlib.lp(r.uniform(-1, 1, P_), 1500 + bright * 7000)
            exc -= exc.mean()
            x = np.zeros(int(d * SR))
            x[:P_] = exc
            a = np.zeros(P_ + 3)
            a[0], a[1] = 1.0, c
            a[P_] += -g * c / 2
            a[P_ + 1] += -g * (1 + c) / 2
            a[P_ + 2] += -g / 2
            y = lfilter([1.0, c], a, x)
            nf = int(.06 * SR)
            y[-nf:] *= np.linspace(1, 0, nf)
            return y / (np.max(np.abs(y)) + 1e-9)
        return self.cache(('ks', m, round(bright, 2), var), mk)

    def pulse(self, m, d=.2):
        def mk():
            f = float(mtof(m))
            n = int(d * SR)
            t = np.arange(n) / SR
            y = np.sin(TAU * f * t + .6 * np.exp(-t / .05) * np.sin(TAU * f * t)) * env_ad(n, SR, .002, .09)
            return sfxlib.lp(y, 1500)
        return self.cache(('pulse', m), mk)

    def bell(self, m, d=1.2):
        def mk():
            f = float(mtof(m))
            n = int(d * SR)
            t = np.arange(n) / SR
            idx = 1.5 * np.exp(-t / .25) + .15
            s = np.sin(TAU * f * t + idx * np.sin(TAU * 3.5 * f * t))
            s += .2 * np.sin(TAU * 2.0 * f * t) * np.exp(-t / .5) + .08 * np.sin(TAU * 3.0 * f * t) * np.exp(-t / .25)
            return s * env_ad(n, SR, .002, max(.35, d / 2.8), tail=.05) * .5
        return self.cache(('bell', m, d), mk)

    def hit(self, chord, d=2.5, bright=5000.0):
        """Wide downbeat chord: supersaw stack (+octave, +root) with a fast attack and bloom decay, plus FM keys."""
        notes, root = CH[chord]
        ss = self.supersaw(notes + [x + 12 for x in notes] + [root + 24], d, att=.004, rel=.9, voices=5, cents=14)
        t = np.arange(len(ss)) / SR
        ss *= (np.exp(-t / 1.1) * .82 + .18)[:, None]
        ss = sfxlib.lp(ss, bright)
        keys = sum(self.fmkey(x + 12, d * .6, .9) for x in notes) / 2.0
        return ss, keys

    # --- bass
    def sub(self, m, d, rel=.03):
        f = float(mtof(m))
        n = int((d + rel) * SR)
        t = np.arange(n) / SR
        e = np.minimum(1, t / .004) * (.85 + .15 * np.exp(-t / .25)) * np.cos(np.pi / 2 * np.clip((t - d) / rel, 0, 1)) ** 2
        return np.sin(TAU * f * t) * e

    def midbass(self, m, d, rel=.03):
        def mk():
            f = float(mtof(m + 12))
            n = int((d + rel) * SR)
            t = np.arange(n) / SR
            s = blep_saw(f * 2 ** (5 / 1200), n, .1) + blep_saw(f * 2 ** (-5 / 1200), n, .6)
            s = sfxlib.hp(sfxlib.lp(np.tanh(1.25 * s), 800), 120)
            e = np.minimum(1, t / .003) * (.7 + .3 * np.exp(-t / .3)) * np.cos(np.pi / 2 * np.clip((t - d) / rel, 0, 1)) ** 2
            return s * e
        return self.cache(('mb', m, round(d, 3)), mk)

    def subdrop(self, d=2.2):
        def mk():
            n = int(d * SR)
            t = np.arange(n) / SR
            f = 61.74 + 61.73 * np.exp(-t / .2)
            ph = TAU * np.cumsum(f) / SR
            e = np.minimum(1, t / .005) * np.where(t < .6, 1.0, np.exp(-(t - .6) / .6))
            e[-int(.05 * SR):] *= np.linspace(1, 0, int(.05 * SR))
            return (np.sin(ph) + .2 * np.sin(2 * ph)) * e
        return self.cache(('subdrop', d), mk)

    # --- drums
    def kick(self):
        def mk():
            n = int(.45 * SR)
            t = np.arange(n) / SR
            f = 61.74 + (200 - 61.74) * np.exp(-t / .04)                 # tuned to B1
            body = np.sin(TAU * np.cumsum(f) / SR) * env_ad(n, SR, .001, .11)
            r = np.random.default_rng(11)
            click = sfxlib.hp(r.uniform(-1, 1, n), 2000) * np.exp(-t / .002) * .3 + np.sin(TAU * 4000 * t) * np.exp(-t / .0015) * .15
            return np.tanh(1.4 * (body + click)) / np.tanh(1.4)
        return self.cache('kick', mk)

    def heart(self):
        def mk():
            n = int(.45 * SR)
            y = np.zeros(n)
            for off, g in ((0.0, 1.0), (.14, .56)):
                i = int(off * SR)
                L = n - i
                tl = np.arange(L) / SR
                f = 61.74 * (1 + .5 * np.exp(-tl / .02))
                y[i:] += np.sin(TAU * np.cumsum(f) / SR) * env_ad(L, SR, .004, .09) * g
            return sfxlib.lp(np.tanh(1.3 * y), 180)
        return self.cache('heart', mk)

    def hat(self, open_=False, var=0):
        def mk():
            d = .25 if open_ else .06
            n = int(d * SR)
            t = np.arange(n) / SR
            r = np.random.default_rng(20 + var + (10 if open_ else 0))
            s = sum(np.sign(np.sin(TAU * f * 2.0 * t + r.uniform(0, TAU))) for f in (205.3, 304.4, 369.6, 522.7, 540.0, 800.0)) / 6
            s = s + .4 * r.uniform(-1, 1, n)
            s = sfxlib.lp(sfxlib.hp(s, 7000, SR, 4), 12000)
            return s * env_ad(n, SR, .0005, .09 if open_ else .022)
        return self.cache(('hat', open_, var), mk)

    def shaker(self, var=0):
        def mk():
            n = int(.09 * SR)
            t = np.arange(n) / SR
            r = np.random.default_rng(40 + var)
            s = sfxlib.bp(r.uniform(-1, 1, n), 5000, 9000)
            return s * np.sin(np.pi / 2 * np.clip(t / .008, 0, 1)) ** 2 * np.exp(-np.maximum(t - .008, 0) / .03)
        return self.cache(('shk', var), mk)

    def clap(self, var=0):
        def mk():
            n = int(.35 * SR)
            r = np.random.default_rng(60 + var)
            s = np.zeros(n)
            for k, o in enumerate((0, .010, .021)):
                i = int(o * SR)
                L = n - i
                s[i:] += sfxlib.bp(r.uniform(-1, 1, L), 900, 2800) * env_ad(L, SR, .0005, .012 if k < 2 else .11)
            return s
        return self.cache(('clap', var), mk)

    def snare(self, var=0):
        def mk():
            n = int(.2 * SR)
            t = np.arange(n) / SR
            r = np.random.default_rng(80 + var)
            return sfxlib.bp(r.uniform(-1, 1, n), 1500, 7000) * env_ad(n, SR, .0008, .05) + np.sin(TAU * 200 * t) * env_ad(n, SR, .0008, .03) * .4
        return self.cache(('snare', var), mk)

    def clock(self, tock=False):
        def mk():
            n = int(.06 * SR)
            t = np.arange(n) / SR
            r = np.random.default_rng(90 + tock)
            f = 1300.0 if tock else 1800.0
            return np.sin(TAU * f * t) * env_ad(n, SR, .0004, .012) + sfxlib.bp(r.uniform(-1, 1, n), 2000, 6000) * env_ad(n, SR, .0002, .003) * .4
        return self.cache(('clock', tock), mk)


def heart_times(t0, t1, r0=1.0, r1=2.2):
    """Accelerating heartbeat (r in beats/s): r = r0 + (r1-r0) u^1.5, integrated to onset times."""
    if t1 <= t0:
        return []
    dt = .001
    ts = np.arange(t0, t1, dt)
    u = (ts - t0) / (t1 - t0)
    phi = np.concatenate([[0.0], np.cumsum((r0 + (r1 - r0) * u ** 1.5)[:-1] * dt)])
    k = np.floor(phi + 1e-9)
    return [float(t0)] + [float(x) for x in ts[np.nonzero(np.diff(k) > 0)[0] + 1]]


# ---------------------------------------------------------------- score
def compose(tl, S, cues, NT, meta):
    B = {k: Bus(NT) for k in ('intro', 'drums', 'bass', 'keys', 'pad', 'pluck', 'hits', 'bells', 'sfxm', 'send_intro', 'send_hall')}
    M, beat, bar = tl.M, tl.beat, tl.bar
    DROP, END = M['DROP'], M['END']
    STOP = M['STOP'] if 'STOP' in M and M['STOP'] < DROP - .2 else None
    GROOVE = M.get('GROOVE', DROP + bar)
    LOGO = M.get('LOGO', DROP + .6)
    LOCKUP, CTA, BUILD = M.get('LOCKUP'), M.get('CTA'), M.get('BUILD')
    HALL = hall_ir()
    kicks = []
    ev = meta['score']
    intro_end = STOP if STOP is not None else DROP

    def near(kind, t, w):
        return [c for c in cues if c['type'] == kind and abs(c['t'] - t) <= w]

    def level(t):           # groove layers build per scene cut, without knowing scene ids
        return min(2, sum(1 for c in tl.cuts if GROOVE + 1e-6 < c <= t + 1e-6))

    def bells(t0, gain=1.0, spacing=.16, under=None):
        for i, (m, d, pan, g) in enumerate(BELL):
            b = S.bell(m, d)
            B['bells'].add(b, t0 + i * spacing, LV['bell'] * g * gain, pan)
            B['send_hall'].add(b, t0 + i * spacing, LV['bell'] * g * gain * .45, pan)
        if under is not None:
            b = S.bell(under, 2.5)
            B['bells'].add(b, t0 + 2 * spacing, LV['bell'] * .45 * gain, 0.0)
            B['send_hall'].add(b, t0 + 2 * spacing, LV['bell'] * .3 * gain)
        ev.append(dict(what='bell motif', t=round(t0, 3), gain=round(gain, 2)))

    def big_hit(t0, d, gain, bright, tag):
        ss, keys = S.hit('Bm', d, bright)
        B['hits'].add(ss, t0, LV['hit'] * gain)
        B['send_hall'].add(ss, t0, LV['hit'] * gain * .38)
        B['keys'].add(keys, t0, LV['keys'] * gain)
        B['send_hall'].add(keys, t0, LV['keys'] * gain * .3)
        sl, im = near('sublogo', t0, .12), near('impact', t0, .12)
        if sl:
            ev.append(dict(what=f'{tag} sub-drop off (sublogo cue at {sl[0]["t"]})', t=round(t0, 3)))
        else:
            g = LV['subdrop'] * gain * (float(undb(-4)) if im else 1.0)
            B['sfxm'].add(S.subdrop(), t0, g)
            ev.append(dict(what=f'{tag} sub-drop' + (' -4 dB (impact cue)' if im else ''), t=round(t0, 3)))
        return ss

    # ---------------- intro: filtered pad + clock + accelerating heartbeat + tension swell (own bus, own hall)
    pad = S.supersaw([47] + CH['Bm'][0], intro_end + .5, att=1.2, rel=.3)
    tt_ = np.arange(len(pad)) / SR
    pad = tv_biquad(pad, 350 * (1200 / 350) ** np.clip(tt_ / max(intro_end, .1), 0, 1), 'lp', .8, SR, 256)
    B['intro'].add(pad, 0.0, LV['intro_pad'])
    B['send_intro'].add(pad, 0.0, LV['intro_pad'] * .35)
    lastbar = intro_end - bar
    for tb, k in tl.grid(0.0, intro_end - .05, 2):
        on_beat = k % 2 == 0
        if not on_beat and tb < lastbar:
            continue
        tock = (k // 2) % 2 == 1
        g = LV['clock'] * (1.0 if on_beat else .7) * (1 + .35 * tb / max(intro_end, .1))
        B['intro'].add(S.clock(tock), tb, g, -.15 if tock else .15)
        B['send_intro'].add(S.clock(tock), tb, g * .2)
    for tb in heart_times(.15, intro_end - .15):
        B['intro'].add(S.heart(), tb, LV['heart'] * (.55 + .45 * tb / max(intro_end, .1)))
    d = min(1.5, intro_end * .5)
    n = int(d * SR)
    u = np.arange(n) / n
    sw = np.stack([tv_biquad(S.noise(n), 400 * (3000 / 400) ** u, 'bp', 1.2, SR, 128) for _ in range(2)], 1) * (u ** 2)[:, None]
    B['intro'].add(sw, intro_end - d, LV['tension'])
    B['send_intro'].add(sw, intro_end - d, LV['tension'] * .5)
    ev.append(dict(what='intro', t=0.0, end=round(intro_end, 3)))

    # ---------------- stop: (tape-stop applied in finalize) 0.3 s of silence, then a near-silent sub/air bed
    stopinfo = None
    if STOP is not None:
        Ts = min(.48, (DROP - STOP) * .3)
        sil0, sil1 = STOP + Ts, STOP + Ts + .30
        stopinfo = (STOP, Ts, sil0, sil1)
        bd = DROP - sil1
        if bd > .1:
            n = int(bd * SR)
            t = np.arange(n) / SR
            sub = np.sin(TAU * 61.74 * t) * .8
            st = np.stack([sub + sfxlib.hp(S.noise(n), 6000) * .15, sub + sfxlib.hp(S.noise(n), 6000) * .15], 1)
            st *= smoothstep(t / bd)[:, None]
            st[-int(.01 * SR):] *= np.linspace(1, 0, int(.01 * SR))[:, None]
            B['sfxm'].add(st, sil1, LV['bed'])
        ev.append(dict(what='tape stop + silence', t=round(STOP, 3), silence=[round(sil0, 3), round(sil1, 3)]))

    # ---------------- drop: wide chord + sub-drop + sonic logo; plucks pick up into the groove
    ss = big_hit(DROP, max(1.0, GROOVE - DROP), 1.0, 5000.0, 'DROP')
    if STOP is not None:
        swl, pd = reverse_swell(ss[:SR].mean(1), HALL, .7)
        B['sfxm'].add(swl, DROP - .015 + pd - len(swl) / SR - pd, LV['swell'])
        ev.append(dict(what='reverse swell into DROP', t=round(DROP - .015 - len(swl) / SR, 3), end=round(DROP - .015, 3)))
    bells(LOGO)
    for i, (tb, k) in enumerate(tl.grid(DROP + bar, GROOVE, 2)):
        m = sorted(CH['Bm'][0])[i % 4] + 12
        B['pluck'].add(S.pluck(m, .4, i % 3), tb, LV['pluck'] * (.6 + .1 * i), .3 * math.sin(k * .7))
        B['send_hall'].add(S.pluck(m, .4, i % 3), tb, LV['pluck'] * .2)

    # ---------------- pads through the rest of the film (bus LP + LFO applied in finalize)
    pad_gain = dict(drop=.7, groove=1.0, break_=.95, regroove=1.0, build=1.05, lockup=.8, cta=1.0)
    t_pad0 = DROP + .25
    for a, b, c in harmony_segments(tl, t_pad0, END):
        nm = tl.section_at((a + b) / 2)['name']
        g = pad_gain.get('break_' if nm == 'break' else nm, 1.0)
        att = .8 if a == t_pad0 else .12
        x = S.supersaw(CH[c][0], b - a, att=att, rel=.45)
        B['pad'].add(x, a, LV['pad'] * g)
        B['send_hall'].add(x, a, LV['pad'] * g * .18)

    # ---------------- groove / regroove / build patterns
    PAT = [0, 2, 1, 3, 2, 1, 3, 2]

    def groove_block(t0, t1, mode):
        for tb, k in tl.grid(t0, t1, 4):
            p = k % 16
            lvl = level(tb) if mode == 'groove' else 3
            notes, root = CH[chord_at(tl, tb)]
            hum = 1 + S.rng.uniform(-.15, .15)
            swing = .0125 if p % 2 == 1 else 0.0
            late = mode == 'build' and LOCKUP is not None
            no_kick = late and tb >= LOCKUP - 2.0
            if p % 4 == 0 and not no_kick:
                B['drums'].add(S.kick(), tb, LV['kick'] * (.78, .86, .93, 1.0)[lvl])
                if mode in ('groove', 'regroove'):
                    kicks.append(tb)
            if not no_kick:
                if lvl <= 1:
                    if p in (0, 8):
                        B['bass'].add(S.sub(root, beat * 1.8), tb, LV['sub'])
                        B['bass'].add(S.midbass(root, beat * .9), tb, LV['midbass'] * hum)
                else:
                    if p % 8 == 0:
                        B['bass'].add(S.sub(root, beat * 1.9), tb, LV['sub'])
                    if p % 2 == 0:
                        up = 12 if (mode != 'groove' and (p // 2) % 2 == 1) else 0
                        B['bass'].add(S.midbass(root + up, beat / 2 * .85), tb, LV['midbass'] * hum * (1.0 if p % 4 == 0 else .8))
            if not (late and tb >= LOCKUP - .25) and (lvl >= 1 or p % 2 == 0):
                m = sorted(notes)[PAT[k % 8]] + 12 + (12 if lvl >= 2 and p % 8 == 6 else 0)
                vel = (.95 if p % 4 == 0 else .72) * hum
                if late:
                    vel *= .7 + .5 * (tb - t0) / max(LOCKUP - t0, .1)
                pl = S.pluck(m, .4 + .15 * min(lvl, 2), k % 3)
                B['pluck'].add(pl, tb + swing * .5, LV['pluck'] * vel, .35 * math.sin(k * .7))
                B['send_hall'].add(pl, tb + swing * .5, LV['pluck'] * vel * .22)
            if lvl >= 1 and not (late and tb >= LOCKUP - .5):
                if lvl >= 2 and p % 4 == 2:
                    B['drums'].add(S.hat(True, k % 2), tb + swing, LV['ohat'] * hum, .2)
                else:
                    B['drums'].add(S.hat(False, k % 4), tb + swing, LV['hat'] * hum * (1.0 if p % 2 == 0 else .62), -.25)
                B['drums'].add(S.shaker(k % 4), tb + swing, LV['shaker'] * hum * (1.0 if p % 2 else .7), .3)
            if lvl >= 1 and p in (6, 12) and not late:
                for m in notes:
                    B['keys'].add(S.fmkey(m + 12, .16, .7), tb, LV['stab'] * hum, -.1)
                    B['send_hall'].add(S.fmkey(m + 12, .16, .7), tb, LV['stab'] * hum * .3)
            if lvl >= 2 and p in (4, 12) and not no_kick:
                B['drums'].add(S.clap(k % 3), tb, LV['clap'] * hum, .05)
                B['send_hall'].add(S.clap(k % 3), tb, LV['clap'] * hum * .25)

    def break_block(t0, t1):
        for tb, k in tl.grid(t0, t1, 4):
            p = k % 16
            notes, root = CH[chord_at(tl, tb)]
            hum = 1 + S.rng.uniform(-.15, .15)
            if p == 0:
                B['drums'].add(S.kick(), tb, LV['kick'] * .8)
            if p == 10:
                B['drums'].add(S.kick(), tb, LV['kick'] * .36)
            if p == 8:
                B['drums'].add(S.clap(k % 3), tb, LV['clap'] * .45, .05)
                B['send_hall'].add(S.clap(k % 3), tb, LV['clap'] * .3)
            if p % 2 == 0:
                B['drums'].add(S.shaker(k % 4), tb + (.0125 if p % 4 == 2 else 0), LV['shaker'] * .45 * hum, .3)
                m = root + 24 if (p // 2) % 2 == 0 else root + 31
                B['keys'].add(S.pulse(m), tb, LV['pulse'] * hum * (1.0 if p % 4 == 0 else .75), -.15)
            if p == 0 or abs(tb - t0) < 1e-6:
                nb = min(t1, tl.off + (tl.bar_of(tb) + 1) * bar)
                B['bass'].add(S.sub(root, max(.1, nb - tb - .03)), tb, LV['sub'] * .9)
            if p % 4 == 0:
                m = sorted(notes)[(k // 4) % 4] + 12
                B['pluck'].add(S.pluck(m, .35, k % 3), tb, LV['pluck'] * .85 * hum, .3 * math.sin(k * .5))
                B['send_hall'].add(S.pluck(m, .35, k % 3), tb, LV['pluck'] * .3)

    sec_fn = {'groove': lambda s: groove_block(s['start'], s['end'], 'groove'),
              'regroove': lambda s: groove_block(s['start'], s['end'], 'regroove'),
              'build': lambda s: groove_block(s['start'], s['end'], 'build'),
              'break': lambda s: break_block(s['start'], s['end'])}
    for s in tl.sections:
        if s['name'] in sec_fn and s['end'] > s['start']:
            sec_fn[s['name']](s)
            ev.append(dict(what=s['name'], t=round(s['start'], 3), end=round(s['end'], 3)))

    # ---------------- build: snare roll timed backwards from LOCKUP, end-aligned riser, reverse swell
    if LOCKUP is not None:
        t_from = BUILD if BUILD is not None else LOCKUP - 4.0
        taus, tau = [], 0.0
        while True:
            tau += beat / 8 if tau < 1.0 else beat / 4 if tau < 2.0 else beat / 2 if tau < 3.0 else beat
            if LOCKUP - tau < t_from - 1e-6:
                break
            taus.append(tau)
        Tr = taus[-1] if taus else 1.0
        for i, tau in enumerate(taus):
            v = .25 + .65 * (1 - tau / Tr) ** 1.5
            B['drums'].add(S.snare(i % 4), LOCKUP - tau, LV['snare'] * v, .1)
            B['send_hall'].add(S.snare(i % 4), LOCKUP - tau, LV['snare'] * v * .2)
        rd = min(2.5, max(.5, LOCKUP - t_from))
        rc = [c for c in cues if c['type'] == 'riser' and abs(c['t'] - LOCKUP) <= .25]
        rg = LV['riser'] * (float(undb(-6)) if rc else 1.0)
        rs, ra, _ = sfxlib.render('riser', 4242, dur=rd)
        B['sfxm'].add(rs, LOCKUP - ra, rg / float(undb(-11)) * .5)
        ev.append(dict(what='snare roll + riser' + (' (-6 dB, riser cue)' if rc else ''), t=round(LOCKUP - Tr, 3), end=round(LOCKUP, 3)))

        # ---------------- lockup: big chord hit + sonic logo + air, long hall tail
        hd = (CTA if CTA else LOCKUP + 1.5) - LOCKUP + .4
        ss = big_hit(LOCKUP, hd, 1.1, 6500.0, 'LOCKUP')
        swl, pd = reverse_swell(ss[:SR].mean(1), HALL, .9)
        B['sfxm'].add(swl, LOCKUP - .015 - len(swl) / SR, LV['swell'] * .8)
        n = int(.8 * SR)
        t = np.arange(n) / SR
        air = np.stack([sfxlib.hp(S.noise(n), 5000) for _ in range(2)], 1) * env_ad(n, SR, .002, .25)[:, None]
        B['sfxm'].add(air, LOCKUP, LV['air'])
        B['send_hall'].add(air, LOCKUP, LV['air'] * .6)
        bells(LOCKUP)

    # ---------------- cta: Gmaj9 for one bar, then D(add9) sustained; plucks thin out; soft logo variant
    if CTA is not None and CTA < END:
        tb2 = min(END, CTA + bar)
        for m in CH['Gmaj9'][0]:
            B['keys'].add(S.fmkey(m + 12, bar * .95, .5, rel=.6), CTA, LV['keys'] * .55)
        B['bass'].add(S.sub(31, tb2 - CTA), CTA, LV['sub'] * .75)
        if END > tb2:
            for m in CH['Dadd9'][0]:
                B['keys'].add(S.fmkey(m + 12, END - tb2, .45, rel=.6), tb2, LV['keys'] * .5)
            B['bass'].add(S.sub(38, END - tb2), tb2, LV['sub'] * .7)
        t, i = CTA, 0
        while t < END - 2.0:
            notes = CH[chord_at(tl, t)][0]
            m = sorted(notes)[[0, 2, 1, 3][i % 4]] + 12
            u = (t - CTA) / max(END - CTA, .1)
            B['pluck'].add(S.pluck(m, .35, i % 3), t, LV['pluck'] * .85 * (1 - .7 * u), .3 * math.sin(i * .9))
            B['send_hall'].add(S.pluck(m, .35, i % 3), t, LV['pluck'] * .3 * (1 - .7 * u))
            t += beat if t < CTA + bar else (2 * beat if t < CTA + 2 * bar else 4 * beat)
            i += 1
        bells(CTA, gain=float(undb(-6)), spacing=.22, under=74)
    return B, kicks, stopinfo


def pad_cutoff(tl, n):
    """Per-sample pad LP cutoff: section base (smoothed) x slow LFO (0.08 Hz, +-0.4 oct)."""
    t = np.arange(n) / SR
    base = np.full(n, 1600.0)
    GROOVE = tl.m('GROOVE', tl.M['DROP'] + tl.bar)
    for s in tl.sections:
        i0, i1 = int(s['start'] * SR), min(n, int(s['end'] * SR))
        if i1 <= i0:
            continue
        nm = s['name']
        if nm == 'groove':
            seg_t = t[i0:i1]
            lv = np.zeros(i1 - i0)
            for c in tl.cuts:
                if c > GROOVE + 1e-6:
                    lv += seg_t >= c - 1e-6
            base[i0:i1] = np.array([1400.0, 1900.0, 2500.0])[np.minimum(lv, 2).astype(int)]
        elif nm == 'break':
            base[i0:i1] = 1200.0
        elif nm == 'regroove':
            base[i0:i1] = 3000.0
        elif nm == 'build':
            base[i0:i1] = 1800.0 * (5000.0 / 1800.0) ** np.linspace(0, 1, i1 - i0)
        elif nm == 'lockup':
            base[i0:i1] = 4000.0
        elif nm == 'cta':
            base[i0:i1] = 2200.0
    base[int(tl.dur * SR):] = base[int(tl.dur * SR) - 1] if int(tl.dur * SR) - 1 < n else base[-1]
    base = np.exp(uniform_filter1d(np.log(base), int(.3 * SR), mode='nearest'))
    return base * 2.0 ** (.4 * np.sin(TAU * .08 * t))


def haas(x, f=300.0, ms=10.0, mix=.5):
    low = zlp(x, f)
    high = x - low
    d = int(ms * SR / 1000)
    r = high[:, 1].copy()
    high[:, 1] = (1 - mix) * r + mix * np.concatenate([np.zeros(d), r[:-d]])
    return low + high


def pump_curve(kicks, n, depth_db=-3.0, rel=.12, att=.005):
    g = np.ones(n)
    dep = 1 - float(undb(depth_db))
    L = int(.6 * SR)
    t = np.arange(L) / SR
    shape = 1 - dep * np.minimum(1, t / att) * np.exp(-np.maximum(t - att, 0) / rel)
    for tk in kicks:
        i = int(round(tk * SR))
        if 0 <= i < n:
            seg = g[i:i + L]
            np.minimum(seg, shape[:len(seg)], out=seg)
    return g


def tape_stop(x, t0, Ts=.48, p=1.3):
    """Replace [t0, t0+Ts] with a decelerating read (speed (1-tau/Ts)^p) + LP sweep 12k->400; silence after."""
    i0 = int(round(t0 * SR))
    n = int(Ts * SR)
    tau = np.arange(n) / SR
    pos = (Ts / (p + 1) * (1 - (1 - tau / Ts) ** (p + 1))) * SR
    span = int(pos.max()) + 4
    src = x[i0:i0 + span]
    seg = np.stack([np.interp(pos, np.arange(len(src)), src[:, c]) for c in range(2)], 1)
    seg = tv_biquad(seg, 12000 * (400 / 12000) ** (tau / Ts), 'lp', .707, SR, 64)
    seg *= (1 - smoothstep((tau - (Ts - .06)) / .06))[:, None]
    y = x.copy()
    y[i0:i0 + n] = seg[:len(y) - i0]
    y[i0 + n:] = 0
    return y


def hp_sweep(x, t0, t1, f0=20.0, f1=350.0, xf=.03):
    """Build HP sweep on the music sum; crossfades back to the dry signal over the xf seconds before t1."""
    i0, i1 = int(t0 * SR), int(t1 * SR)
    if i1 - i0 < SR // 10:
        return x
    n = i1 - i0
    u = np.arange(n) / n
    y = tv_biquad(x[i0:i1], f0 * (f1 / f0) ** (u ** 2), 'hp', .707, SR, 128)
    nx = int(xf * SR)
    w = np.ones(n)
    w[-nx:] = np.cos(np.linspace(0, np.pi / 2, nx)) ** 2
    x[i0:i1] = y * w[:, None] + x[i0:i1] * (1 - w)[:, None]
    return x


def finalize_music(tl, B, kicks, stopinfo, N):
    NT = B['pad'].n
    HALL = hall_ir()
    pad = haas(tv_biquad(B['pad'].x, pad_cutoff(tl, NT), 'lp', .7, SR, 256))
    pump = pump_curve(kicks, NT)[:, None]
    music = (B['drums'].x + B['hits'].x + B['bells'].x + B['sfxm'].x + B['pluck'].x * (1 - .4 * (1 - pump))
             + (pad + B['bass'].x + B['keys'].x) * pump)
    music += reverb(B['send_hall'].x, HALL) * MIX['hall_ret']
    BUILD, LOCKUP = tl.m('BUILD'), tl.m('LOCKUP')
    if BUILD is not None and LOCKUP is not None and LOCKUP > BUILD:
        music = hp_sweep(music, BUILD, LOCKUP)
    intro = B['intro'].x + reverb(B['send_intro'].x, HALL) * MIX['intro_hall_ret']
    if stopinfo:
        STOP, Ts, sil0, sil1 = stopinfo
        intro = tape_stop(intro, STOP, Ts)
        music += intro
        music[int(sil0 * SR):int(sil1 * SR)] = 0.0                 # exact digital silence
    else:
        DROP = tl.M['DROP']
        i = int(DROP * SR)
        nf = int(.05 * SR)
        intro[i:i + nf] *= np.linspace(1, 0, nf)[:, None]
        intro[i + nf:] = 0
        music += intro
    music = music[:N]
    fo = min(N, int(2.5 * SR))
    music[N - fo:] *= (np.cos(np.linspace(0, np.pi / 2, fo)))[:, None]   # equal-power style fade
    return music * MIX['music']


# ---------------------------------------------------------------- scene cues
def load_cues(path, meta):
    if not path or not os.path.exists(path):
        print(f'[film_mix] WARNING: cue sheet {path} not found; mixing with cut swishes only', file=sys.stderr)
        meta['warnings'].append(f'missing cues {path}')
        return []
    raw = json.load(open(path))
    if isinstance(raw, dict):
        raw = raw.get('cues', [])
    return [dict(c) for c in raw if isinstance(c, dict) and 't' in c and 'type' in c]


def plan_cues(raw, tl, meta):
    """Validate, merge same-family cues within 60 ms, cap density at 4 events/s, add cut swishes."""
    dec = meta['cues']
    cs = []
    for i, c in enumerate(raw):
        c = dict(c, idx=i, t=float(c['t']), gain=float(c.get('gain', 1.0)))
        if not (0 <= c['t'] < tl.dur):
            dec.append(dict(c, status='dropped', reason='outside film'))
            continue
        if c['type'] not in sfxlib.TYPES:
            dec.append(dict(c, status='remapped', reason=f'unknown type {c["type"]} -> tick'))
            c['type'] = 'tick'
        cs.append(c)
    cs.sort(key=lambda c: (c['t'], c['idx']))
    fam = sfxlib.FAMILY
    out = []
    for c in cs:
        m = None
        for o in reversed(out):
            if c['t'] - o['t'] > MIX['merge_win']:
                break
            if fam[o['type']] == fam[c['type']]:
                m = o
                break
        if m is None:
            out.append(c)
            continue
        g1, g2 = m['gain'], c['gain']
        if g2 > g1:
            m.update(type=c['type'], x=c.get('x', m.get('x')), dur=c.get('dur', m.get('dur')), pitch=c.get('pitch', m.get('pitch')))
        m['gain'] = min(1.0, max(g1, g2) + .25 * min(g1, g2))
        m.setdefault('merged', []).append(dict(t=c['t'], type=c['type'], scene=c.get('scene'), gain=g2))
    weight = {'transient': .6, 'air': .8, 'tonal': 1.0, 'low': 1.2, 'long': .9}

    def events(win):
        evs, last = 0, -9.0
        for c in win:
            if c['t'] - last > MIX['merge_win']:
                evs += 1
                last = c['t']
        return evs
    changed = True
    while changed:
        changed = False
        for i, c in enumerate(out):
            win = [o for o in out[i:] if o['t'] < c['t'] + 1.0]
            if events(win) > MIX['cap_per_s']:
                victim = min(win, key=lambda o: (o['gain'] * weight[fam[o['type']]], -o['t']))
                out.remove(victim)
                dec.append(dict(victim, status='thinned', reason=f'>{MIX["cap_per_s"]} events in 1 s window from {c["t"]:.3f}'))
                changed = True
                break
    for c in out:
        dec.append(dict(c, status='merged' if c.get('merged') else 'kept'))
    swishes = []
    for tc in tl.cuts:
        if any(abs(c['t'] - tc) <= MIX['cut_clear'] for c in out):
            meta['cut_swishes'].append(dict(t=tc, added=False, reason='scene cue within 0.15 s'))
            continue
        s = dict(t=tc, type='swish', gain=MIX['cut_swish_gain'], x=960, scene='cut', idx=10000 + len(swishes))
        swishes.append(s)
        meta['cut_swishes'].append(dict(t=tc, added=True))
    return sorted(out + swishes, key=lambda c: c['t'])


def render_cues(cues, NT):
    fx, room, hall = Bus(NT), Bus(NT), Bus(NT)
    for c in cues:
        seed = sfxlib.seed_for(c['type'], c['t'], c['idx'])
        dur = c.get('dur') if c['type'] in LONG_TYPES or c.get('dur') else None
        sig, al, send = sfxlib.render(c['type'], seed, dur=dur, pitch=c.get('pitch'))
        pan = float(np.clip((float(c.get('x', 960)) - 960) / 960 * .6, -.6, .6))
        t0 = c['t'] - al
        fx.add(sig, t0, c['gain'], pan)
        room.add(sig, t0, c['gain'] * send, pan)
        if c['type'] in ('impact', 'shine', 'chime', 'review'):
            hall.add(sig, t0, c['gain'] * send * .8, pan)
        c['render_start'] = round(t0, 4)
    out = fx.x + reverb(room.x, room_ir()) * MIX['room_ret'] + reverb(hall.x, hall_ir()) * MIX['fxhall_ret']
    return out * MIX['fx']


# ---------------------------------------------------------------- voiceover
def deess(x, lo=5000.0, hi=8000.0, thr_db=-12.0):
    band = sosfiltfilt(sos('band', [lo, hi], 4), x)
    fr = 96                                                          # 2 ms frames
    nf = len(x) // fr + 1
    pad = nf * fr - len(x)
    eb = np.pad(band, (0, pad)).reshape(nf, fr)
    ef = np.pad(x, (0, pad)).reshape(nf, fr)
    eb, ef = (eb ** 2).mean(1), (ef ** 2).mean(1)
    r = 10 * np.log10((eb + 1e-14) / (ef + 1e-14))
    lvl = 10 * np.log10(ef + 1e-14)
    red = np.where(lvl > -50, np.clip(r - thr_db, 0, MIX['deess_max_db']), 0.0)
    red = smooth_ar(red, 1.0, 30.0)                                 # 2 ms attack, 60 ms release (in 2 ms frames)
    g = undb(-frames_to_samples(red, len(x), fr))
    return x - band + band * g, g, float(red.max()), float((red > .5).mean())


def air_band(x, g):
    """HiFi-GAN at 22.05 kHz stops near 11 kHz: synthesise a faint 7-14 kHz 'air' from the 3-5.5 kHz band."""
    band = sosfiltfilt(sos('band', [3000, 5500], 4), x)
    act = np.abs(x) > 10 ** (-40 / 20)
    r = np.sqrt(np.mean(band[act] ** 2)) + 1e-9 if act.any() else 1e-3
    h = np.tanh(1.5 * band / r)
    h = sosfilt(sos('high', 7000, 8), h)
    h = sosfilt(sos('low', 14000, 4), h)
    hr = np.sqrt(np.mean(h[act] ** 2)) + 1e-12 if act.any() else 1.0
    return h * (r * float(undb(MIX['air_db'])) / hr) * g ** 2


def speech_rms_db(x, fr=960, gate=-45.0):
    nf = len(x) // fr
    if nf == 0:
        return -120.0
    e = (x[:nf * fr] ** 2).reshape(nf, fr).mean(1)
    L = 10 * np.log10(e + 1e-14)
    s = e[L > gate]
    return float(10 * np.log10(s.mean())) if len(s) else -120.0


def compress_vo(x, thr=-22.0, ratio=2.5, att=5.0, rel=120.0):
    L = frame_db(x, 48, 5)
    gr = np.maximum(0.0, L - thr) * (1 - 1 / ratio)
    gr = smooth_ar(gr, att, rel)
    return x * undb(-frames_to_samples(gr, len(x))), float(gr.max())


def process_vo(path, air=True):
    a, sr = sf.read(path, always_2d=True)
    a = a.mean(1)
    if sr != SR:
        g = math.gcd(SR, sr)
        a = resample_poly(a, SR // g, sr // g)
    a = sosfilt(sos('high', 85, 4), a)
    for kind, f, q, gdb in (('peak', 280, 1.0, -1.5), ('peak', 3200, .8, 2.0)):
        b, aa = rbj(kind, f, q, SR, gdb)
        a = lfilter(b, aa, a)
    a = a * float(undb(-20.0 - speech_rms_db(a)))                   # normalise first so thresholds mean the same per line
    a, g, ds_max, ds_frac = deess(a)
    if air:
        a = a + air_band(a, g)
    a, gr = compress_vo(a)
    a = a * float(undb(MIX['vo_rms_db'] - speech_rms_db(a)))
    return a, dict(sr_in=sr, deess_max_db=round(ds_max, 2), deess_active=round(ds_frac, 4), comp_max_gr_db=round(gr, 2),
                   speech_rms_db=round(speech_rms_db(a), 2), peak_db=round(float(db(np.max(np.abs(a)))), 2))


def build_vox(tl, vo_meta, NT, meta, air=True):
    vox = np.zeros(NT)
    gates = []
    vj = {}
    if vo_meta:
        for v in (vo_meta if isinstance(vo_meta, list) else vo_meta.get('lines', [])):
            vj[v.get('id')] = v
    for sc in tl.scenes:
        for v in sc.get('vo') or []:
            st, du = float(v['start']), float(v.get('dur') or 0)
            f = v.get('file')
            rec = dict(id=v.get('id'), scene=sc.get('id'), start=st, dur=du, file=f)
            if not f or not os.path.exists(P(f)):
                gates.append((st + .03, st + max(.2, du - .10)))
                rec.update(status='synthetic duck (no file)')
                meta['vo'].append(rec)
                continue
            a, info = process_vo(P(f), air)
            info_len = sf.info(P(f)).duration
            if du and abs(info_len - du) > .02:
                meta['warnings'].append(f'{v.get("id")}: wav {info_len:.3f}s vs timeline dur {du:.3f}s (stale timeline?)')
            j = vj.get(v.get('id'))
            if j and j.get('dur') and abs(float(j['dur']) - info_len) > .02:
                meta['warnings'].append(f'{v.get("id")}: vo json dur {j["dur"]} vs wav {info_len:.3f}s')
            i = int(round(st * SR))
            m = min(len(a), NT - i)
            if m > 0:
                vox[i:i + m] += a[:m]
            rec.update(status='placed', wav_dur=round(info_len, 3), first_word_t0=(j or {}).get('words', [{}])[0].get('t0') if j else None, **info)
            meta['vo'].append(rec)
    return vox * MIX['vox'], gates


def duck_gain(vox, gates, n):
    kdb = frame_db(vox, 48, 10)
    for a, b in gates:
        kdb[int(a * 1000):int(b * 1000)] = np.maximum(kdb[int(a * 1000):int(b * 1000)], -20.0)
    k = np.clip((kdb - MIX['duck_lo']) / (MIX['duck_hi'] - MIX['duck_lo']), 0, 1)
    look = int(MIX['duck_look'] * 1000)
    k = np.concatenate([k[look:], np.zeros(look)])
    hold = int(MIX['duck_hold'] * 1000) | 1
    k = maximum_filter1d(k, hold, origin=(hold - 1) // 2, mode='nearest')
    k = smooth_ar(k, MIX['duck_att'] * 1000, MIX['duck_rel'] * 1000)
    return np.clip(frames_to_samples(k, n), 0, 1)


def three_band(x):
    low = zlp(x, 300.0)
    high = zhp(x, 5000.0)
    return low, x - low - high, high


# ---------------------------------------------------------------- main build
def build(a):
    t_start = time.time()
    tl = Timeline(json.load(open(P(a.timeline))))
    N = int(round(tl.dur * SR))
    NT = N + int(4 * SR)
    meta = dict(timeline=a.timeline, cues_file=a.cues, vo_file=a.vo, sr=SR, duration=tl.dur, provisional=tl.provisional,
                grid=dict(bpm=tl.bpm, beat=tl.beat, off=round(tl.off, 4)), markers=tl.M, sections=tl.sections,
                marker_beat_offsets={k: round(tl.beat_offset(v), 3) for k, v in tl.M.items()},
                cues=[], cut_swishes=[], score=[], vo=[], warnings=[], mix=dict(MIX))
    vo_meta = json.load(open(P(a.vo))) if a.vo and os.path.exists(P(a.vo)) else None
    if a.vo and vo_meta is None:
        meta['warnings'].append(f'vo json {a.vo} not found')
    raw = load_cues(P(a.cues) if a.cues else None, meta)
    cues = plan_cues(raw, tl, meta)
    log(f'cues: {len(raw)} raw -> {len(cues)} rendered ({sum(1 for c in cues if c.get("scene") == "cut")} cut swishes)')
    S = Synth(a.seed)
    B, kicks, stopinfo = compose(tl, S, cues, NT, meta)
    log(f'score composed {time.time() - t_start:.1f}s')
    music = finalize_music(tl, B, kicks, stopinfo, N)
    log(f'music finalised {time.time() - t_start:.1f}s')
    fx = render_cues(cues, NT)[:N] if not a.music_only else np.zeros((N, 2))
    log(f'fx rendered {time.time() - t_start:.1f}s')
    vox, gates = build_vox(tl, vo_meta, NT, meta, air=not a.no_air)
    vox = vox[:N]
    log(f'vo processed {time.time() - t_start:.1f}s')
    music, glue_gr = glue(music)
    k = duck_gain(vox, [(x, y) for x, y in gates], N)[:, None]
    lo, mi, hi = three_band(music)
    music = lo * undb(MIX['duck_low_db'] * k) + mi * undb(MIX['duck_mid_db'] * k) + hi * undb(MIX['duck_high_db'] * k)
    flo, fmi, fhi = three_band(fx)
    fx = flo + fhi + fmi * undb(MIX['duck_fx_mid_db'] * k)
    if a.music_only:
        vox = np.zeros(N)
    vox2 = np.stack([vox, vox], 1)
    mix = music + fx + vox2
    L0 = lufs(mix)
    g = float(undb(a.lufs - L0))
    music, fx, vox2, mix = music * g, fx * g, vox2 * g, mix * g
    ceil = float(undb(MIX['ceiling_db']))
    y, lim_gr = None, 0.0
    for _ in range(2):
        for _it in range(5):
            y, lim_gr = limiter(soft_clip(mix), ceil)
            tp = true_peak_db(y)
            if tp <= MIX['tp_max_db']:
                break
            ceil *= float(undb(MIX['tp_max_db'] - tp - .05))
        L1 = lufs(y)
        if abs(L1 - a.lufs) <= .2:
            break
        c = float(undb(a.lufs - L1))
        music, fx, vox2, mix = music * c, fx * c, vox2 * c, mix * c
    nf = int(.05 * SR)
    y[-nf:] *= np.linspace(1, 0, nf)[:, None]
    meta['master'] = dict(lufs_pre=round(L0, 2), gain_db=round(float(db(g)), 2), lufs=round(lufs(y), 2), true_peak_db=round(true_peak_db(y), 2),
                          sample_peak_db=round(float(db(np.max(np.abs(y)))), 2), limiter_max_gr_db=round(-lim_gr, 2),
                          ceiling_db=round(float(db(ceil)), 2), glue_max_gr_db=round(glue_gr, 2),
                          stems_lufs=dict(vox=round(lufs(vox2), 2), music=round(lufs(music), 2), fx=round(lufs(fx), 2)),
                          seconds=round(time.time() - t_start, 1))
    log('master', meta['master'])
    return dict(master=y, stems=dict(vox=vox2, music=music, fx=fx), meta=meta, cues=cues)


def write_outputs(res, a):
    out = P(a.out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sf.write(out, res['master'].astype(np.float32), SR, subtype='PCM_24')
    d = os.path.dirname(out)
    if a.stems:
        for k, v in res['stems'].items():
            sf.write(os.path.join(d, f'stem_{k}.wav'), v.astype(np.float32), SR, subtype='FLOAT')
    mp = os.path.splitext(out)[0] + '_meta.json' if os.path.basename(out) != 'mix.wav' else os.path.join(d, 'mix_meta.json')
    with open(mp, 'w') as f:
        json.dump(res['meta'], f, indent=1, default=lambda o: float(o) if isinstance(o, np.floating) else str(o))
    m = res['meta']['master']
    print(f'wrote {os.path.relpath(out, ROOT)} ({len(res["master"]) / SR:.2f}s) LUFS {m["lufs"]} TP {m["true_peak_db"]} dBTP '
          f'stems(LUFS) vox {m["stems_lufs"]["vox"]} music {m["stems_lufs"]["music"]} fx {m["stems_lufs"]["fx"]} '
          f'[{m["seconds"]}s]' + (' + stems' if a.stems else ''))
    for w in res['meta']['warnings']:
        print('WARNING', w)


def parse_args(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--timeline', default='film/timeline.json')
    ap.add_argument('--cues', default='film/sfx.json')
    ap.add_argument('--vo', default='audio/vo_te.json')
    ap.add_argument('--out', default='out/mix/mix.wav')
    ap.add_argument('--stems', action='store_true')
    ap.add_argument('--lufs', type=float, default=MIX['lufs'])
    ap.add_argument('--no-air', action='store_true')
    ap.add_argument('--music-only', action='store_true', help='score only (no VO, no cues) for review')
    ap.add_argument('--seed', type=int, default=7)
    ap.add_argument('-v', '--verbose', action='store_true')
    return ap.parse_args(argv)


def main(argv=None):
    global VERBOSE
    a = parse_args(argv)
    VERBOSE = a.verbose
    write_outputs(build(a), a)


if __name__ == '__main__':
    main()
