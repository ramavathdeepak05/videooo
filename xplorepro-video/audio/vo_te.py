"""XplorePro Telugu voiceover: validate -> synthesise -> exact anchors -> trim -> QA -> review pack.

Engine: AI4Bharat Indic-TTS Telugu FastPitch + HiFi-GAN (coqui-tts), FEMALE speaker, 22050 Hz, hop 256.
Run with the TTS venv, isolated:
    /home/user/tools/venv-te/bin/python -I audio/vo_te.py              # all lines + QA + review pack + timeline.real
    ... audio/vo_te.py --only L01,L02                                  # re-synthesise some lines, keep the rest
    ... audio/vo_te.py --check                                         # validate script + lexicon only (no model)
    ... audio/vo_te.py --say "తెలుగు వాక్యం" --ls 1.0 --out x.wav       # ad-hoc test line
Outputs: audio/vo_te/Lxx.wav, audio/vo_te.json, audio/vo_review.wav, audio/vo_review_sheet.md,
         out/qa/vo-te/*.png + stats.json, film/timeline.real.json (via audio/film_timeline.py).

Anchor timing is exact, not estimated: the script replaces FastPitch's format_durations() for the call, so the
per-token frame durations that drive the decoder are the ones we record. With this config there are no
BOS/EOS/blank tokens (enable_eos_bos_chars=false, add_blank=false), so token k == character k of the cleaned
text and a token starts at sum(dur[:k]) * hop / sr seconds (asserted below). The same hook also caps the pause
length of punctuation (a fitting lever that does not touch the speech itself) and applies length_scale.
"""
import argparse, json, math, os, re, subprocess, sys, tempfile, time, unicodedata

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUD = os.path.join(ROOT, 'audio')
WAVDIR = os.path.join(AUD, 'vo_te')
QADIR = os.path.join(ROOT, 'out', 'qa', 'vo-te')
SCRIPT = os.path.join(AUD, 'script_te.json')
LEXICON = os.path.join(AUD, 'lexicon_te.json')
OUTJSON = os.path.join(AUD, 'vo_te.json')

MODEL = '/home/user/tools/indic-tts/te/fastpitch/best_model.pth'
MODEL_CFG = '/home/user/tools/indic-tts-cfg/config.json'
VOC = '/home/user/tools/indic-tts/te/hifigan/best_model.pth'
VOC_CFG = '/home/user/tools/indic-tts/te/hifigan/config.json'
SR, HOP = 22050, 256

# ------------------------------------------------------------------ fitting levers ------------------------------
SPEAKER = 'female'
GLOBAL_LS = 1.0                      # FastPitch length_scale for every line (<1 = faster)
PAUSE_MS = {'.': 380, ',': 140}       # ceiling for an in-line punctuation pause (punct + spaces), ms
PAUSE_MIN_MS = {'.': 240, ',': 0}     # floor (a mid-line full stop should read as a beat)
GAP_MS = 90                          # cap on a plain word gap (space only)
PREROLL, TAIL, FADE_IN, FADE_OUT = 0.030, 0.150, 0.004, 0.040
TARGET_RMS_DB, PEAK_DB = -20.0, -1.0  # active-speech RMS target per line, true-sample-ish peak ceiling
# per line: ls (multiplies GLOBAL_LS), opt (keep {optional} words), tempo (rubberband, <=1.06),
# pause / pause_min (ms overrides of the ceilings / floors above)
LINES = {
    'L01': {'ls': 0.94, 'pause': {',': 90}, 'pause_min': {'.': 200}},   # beat after 'season', then a rapid-fire list
    'L02': {},                                       # 'కానీ' dropped from the script: the music STOP lands on the first word
    'L03': {'pause': {',': 300}},                    # 'అందుకే,' ... hold ... logo
    'L04': {'ls': 0.95, 'pause': {',': 100}},
    'L05': {'ls': 0.94},
    'L06': {'ls': 1.03},                             # mentor scene: a touch slower, warmer
    'L07': {'ls': 1.04},
    'L08': {'ls': 0.95},
    'L09': {'ls': 0.95},
    'L10': {'ls': 0.95, 'pause': {',': 110}},
    'L11': {},
    'L12': {},
    'L13': {},
    'L14': {},
    'L15': {},
    'L16': {'ls': 1.03, 'pause_min': {'.': 380}},   # three beats, room to land
    'L17': {'pause_min': {'.': 300}},
}
# -----------------------------------------------------------------------------------------------------------------

PUNCT = set(" !',.:;?")
STRIP = {'‌', '‍'}         # ZWNJ / ZWJ: print-only
STOPS, COMMAS = set('.!?'), set(',;:')


def die(msg):
    print('VALIDATION ERROR:', msg, file=sys.stderr)
    sys.exit(2)


def allowed_chars():
    cfg = json.load(open(MODEL_CFG, encoding='utf-8'))
    vocab = cfg['characters']['characters']
    tel = {c for c in vocab if 0x0C00 <= ord(c) <= 0x0C7F}
    return tel | PUNCT


# ------------------------------------------------------------------ text ----------------------------------------
TOK = re.compile(r'\[(\w+)\|([^\]]+)\]|\{([^}]*)\}|([^\[{]+)')


def build(te, keep_opt=True):
    """script markup -> display text (ZWNJ kept), {key: display char index}. Same grammar as film_timeline.py."""
    te = unicodedata.normalize('NFC', te)
    out, keys = '', {}
    for m in TOK.finditer(te):
        if m.group(1):
            if m.group(1) in keys: die(f'duplicate anchor key {m.group(1)} in one line')
            keys[m.group(1)] = len(out); out += m.group(2)
        elif m.group(3) is not None:
            if keep_opt: out += m.group(3)
        else:
            out += m.group(4)
    # collapse whitespace but keep anchor indices valid
    disp, remap = '', {}
    for i, c in enumerate(out):
        remap[i] = len(disp)
        if c.isspace():
            if disp and not disp.endswith(' '): disp += ' '
        else: disp += c
    keys = {k: remap[i] for k, i in keys.items()}
    lead = len(disp) - len(disp.lstrip(' '))
    disp = disp.strip(' ')
    keys = {k: max(0, i - lead) for k, i in keys.items()}
    for k, i in keys.items():
        if i >= len(disp) or disp[i] == ' ': die(f'anchor {k} does not start on a letter: {disp!r}')
    return disp, keys


def to_tts(disp):
    """display -> exact model input (cleaned) + map display index -> token index."""
    tts, m = '', {}
    for i, c in enumerate(disp):
        m[i] = len(tts)
        if c in STRIP: continue
        if c in ';:': c = ','
        tts += c
    return tts, m


def validate(lid, tts, allowed):
    bad = [(i, c) for i, c in enumerate(tts) if c not in allowed]
    if bad:
        die(f'{lid}: characters outside the model alphabet: ' + ', '.join(f'U+{ord(c):04X} {c!r} at {i}' for i, c in bad))
    if '  ' in tts or tts != tts.strip(): die(f'{lid}: whitespace not normalised')
    if unicodedata.normalize('NFC', tts) != tts: die(f'{lid}: not NFC')


def lexicon_check(lines):
    lex = json.load(open(LEXICON, encoding='utf-8'))['terms']
    chosen = sorted({v['te'] for v in lex.values()} | {v[k] for v in lex.values() for k in ('plural', 'dative', 'locative') if k in v},
                    key=len, reverse=True)
    problems = []
    for L in lines:
        txt = re.sub(r'\[(\w+)\|', '', L['te']).replace(']', '').replace('{', '').replace('}', '')
        masked = txt
        for c in chosen: masked = masked.replace(c, '\u0000' * len(c))
        for term, v in lex.items():
            for a in v.get('alt', []):
                if a in masked: problems.append(f'{L["id"]}: uses non-lexicon spelling {a!r} for {term} (use {v["te"]!r})')
    if problems: die('\n  ' + '\n  '.join(problems))
    return lex


# ------------------------------------------------------------------ ISO 15919 romanisation ----------------------
_VI = {'అ': 'a', 'ఆ': 'ā', 'ఇ': 'i', 'ఈ': 'ī', 'ఉ': 'u', 'ఊ': 'ū', 'ఋ': 'r̥', 'ౠ': 'r̥̄', 'ఌ': 'l̥', 'ఎ': 'e', 'ఏ': 'ē',
       'ఐ': 'ai', 'ఒ': 'o', 'ఓ': 'ō', 'ఔ': 'au'}
_VS = {'ా': 'ā', 'ి': 'i', 'ీ': 'ī', 'ు': 'u', 'ూ': 'ū', 'ృ': 'r̥', 'ౄ': 'r̥̄', 'ె': 'e', 'ే': 'ē', 'ై': 'ai', 'ొ': 'o',
       'ో': 'ō', 'ౌ': 'au'}
_C = {'క': 'k', 'ఖ': 'kh', 'గ': 'g', 'ఘ': 'gh', 'ఙ': 'ṅ', 'చ': 'c', 'ఛ': 'ch', 'జ': 'j', 'ఝ': 'jh', 'ఞ': 'ñ', 'ట': 'ṭ',
      'ఠ': 'ṭh', 'డ': 'ḍ', 'ఢ': 'ḍh', 'ణ': 'ṇ', 'త': 't', 'థ': 'th', 'ద': 'd', 'ధ': 'dh', 'న': 'n', 'ప': 'p', 'ఫ': 'ph',
      'బ': 'b', 'భ': 'bh', 'మ': 'm', 'య': 'y', 'ర': 'r', 'ఱ': 'ṟ', 'ల': 'l', 'ళ': 'ḷ', 'ఴ': 'ḻ', 'వ': 'v', 'శ': 'ś', 'ష': 'ṣ',
      'స': 's', 'హ': 'h'}
_MISC = {'ం': 'ṁ', 'ః': 'ḥ', 'ఁ': 'm̐'}


def iso15919(s):
    s = unicodedata.normalize('NFC', ''.join(c for c in s if c not in STRIP))
    out, i = [], 0
    while i < len(s):
        c = s[i]; nx = s[i + 1] if i + 1 < len(s) else ''
        if c in _C:
            out.append(_C[c])
            if nx == '్':
                i += 2
                if s[i:i + 1] == 'హ' and _C[c] in ('k', 'g', 'c', 'j', 'ṭ', 'ḍ', 't', 'd', 'p', 'b'): out.append(':')
                elif s[i:i + 1] in _VI: out.append(':')     # C + virama + vowel letter (హెచ్‌ఆర్ hec:ār)
                continue
            if nx in _VS: out.append(_VS[nx]); i += 2; continue
            out.append('a'); i += 1
            if s[i:i + 1] in ('ఇ', 'ఉ'): out.append(':')
            continue
        if c in _VI: out.append(_VI[c])
        elif c in _MISC: out.append(_MISC[c])
        else: out.append(c)
        i += 1
    return ''.join(out)


def aksharas(text):
    """orthographic akshara count: vowel-bearing units (independent vowel, or consonant cluster + vowel/inherent a)
    plus pollu consonants (consonant + virama closing a word or followed by ZWNJ, e.g. the ట్ of ప్లేస్‌మెంట్)."""
    n = 0
    for i, c in enumerate(text):
        nx = text[i + 1] if i + 1 < len(text) else ''
        if c in _VI: n += 1
        elif c in _C:
            if nx != '్': n += 1
            else:
                after = text[i + 2] if i + 2 < len(text) else ''
                if after == '' or after in PUNCT or after in STRIP: n += 1
    return n


# ------------------------------------------------------------------ duration control ----------------------------
def groups(tts):
    """runs of non-letter tokens: [(start, end_excl, kind)] kind in {'stop', 'comma', 'gap'}; final run flagged."""
    out, i = [], 0
    while i < len(tts):
        if tts[i] in PUNCT:
            j = i
            while j < len(tts) and tts[j] in PUNCT: j += 1
            run = tts[i:j]
            kind = 'stop' if any(c in STOPS for c in run) else 'comma' if any(c in COMMAS for c in run) else 'gap'
            out.append((i, j, kind, j == len(tts)))
            i = j
        else: i += 1
    return out


def shape_durations(raw, tts, ls, pause_max, pause_min=None):
    """raw: float frames per token (model prediction, before length scale) -> final integer frames.
    In-line punctuation pauses are clamped to [min, max] ms. This model gives commas long pauses (300-430 ms) but a
    mid-line full stop only ~70-200 ms (training utterances are single sentences), so stops get a floor and commas a
    ceiling. Extra frames go to the punctuation token itself (the decoder renders them as silence)."""
    pause_min = pause_min or {}
    d = raw * ls
    fr = lambda ms: ms / 1000 * SR / HOP
    for a, b, kind, final in groups(tts):
        if final: continue                    # trailing silence is trimmed anyway; keep the model's final contour
        key = '.' if kind == 'stop' else ',' if kind == 'comma' else None
        cap = fr(pause_max[key] if key else GAP_MS)
        lo = fr(pause_min.get(key, 0)) if key else 0
        tot = d[a:b].sum()
        if tot > cap: d[a:b] *= cap / tot
        elif tot < lo:
            p = [i for i in range(a, b) if tts[i] != ' '] or [a]
            d[p] += (lo - tot) / len(p)
    d = np.round(d)
    d[d < 1] = 1
    return d


# ------------------------------------------------------------------ engine --------------------------------------
class Engine:
    def __init__(self, threads=2):
        import torch
        torch.set_num_threads(threads)
        torch.manual_seed(0)
        from TTS.utils.synthesizer import Synthesizer
        t = time.time()
        self.torch = torch
        self.syn = Synthesizer(tts_checkpoint=MODEL, tts_config_path=MODEL_CFG, vocoder_checkpoint=VOC, vocoder_config=VOC_CFG,
                               use_cuda=False)
        self.m = self.syn.tts_model.eval()
        self.syn.vocoder_model.eval()
        cfg = self.syn.tts_config
        assert not cfg.get('add_blank') and not cfg.get('enable_eos_bos_chars'), 'token<->char calibration assumes no blank/BOS/EOS'
        assert self.syn.output_sample_rate == SR and cfg.audio['hop_length'] == HOP
        self.spk = self.m.speaker_manager.name_to_id[SPEAKER]
        print(f'model loaded in {time.time() - t:.1f}s; speakers {self.m.speaker_manager.name_to_id}; using {SPEAKER}={self.spk}')

    def synth(self, tts, ls=1.0, pause_ms=None, pause_min=None):
        torch = self.torch
        pause_ms = pause_ms or PAUSE_MS
        pause_min = PAUSE_MIN_MS if pause_min is None else pause_min
        tok = self.m.tokenizer
        assert tok.text_cleaner(tts) == tts, f'cleaner changes text: {tok.text_cleaner(tts)!r}'
        ids = tok.text_to_ids(tts)
        assert len(ids) == len(tts), f'token count {len(ids)} != chars {len(tts)} (blank/BOS/EOS or unknown chars)'
        rec = {}

        def fmt(o_dr_log, x_mask):
            raw = ((torch.exp(o_dr_log) - 1) * x_mask).detach().cpu().numpy().reshape(-1)
            d = shape_durations(raw.astype(np.float64), tts, ls, pause_ms, pause_min)
            rec['raw'], rec['d'] = raw, d
            return torch.tensor(d, dtype=o_dr_log.dtype).view(1, 1, -1)

        self.m.format_durations = fmt
        try:
            with torch.no_grad():
                out = self.m.inference(torch.LongTensor(ids).unsqueeze(0),
                                       aux_input={'speaker_ids': torch.from_numpy(np.asarray(self.spk)), 'd_vectors': None})
                mel = out['model_outputs'][0].detach().cpu().numpy()
                mel = self.m.ap.denormalize(mel.T).T
                vin = torch.tensor(self.syn.vocoder_ap.normalize(mel.T)).unsqueeze(0)
                wav = self.syn.vocoder_model.inference(vin).squeeze().cpu().numpy().astype(np.float64)
        finally:
            del self.m.format_durations
        d = rec['d']
        n = int(d.sum())
        assert mel.shape[0] == n, (mel.shape, n)
        # HiFi-GAN replicate-pads `inference_padding` mel frames on both sides at inference; drop them so that
        # sample 0 == mel frame 0 == start of token 0 (calibration for the anchor times).
        gen = getattr(self.syn.vocoder_model, 'model_g', self.syn.vocoder_model)
        pad = int(gen.inference_padding) * HOP
        assert len(wav) == n * HOP + 2 * pad, (len(wav), n, pad)
        wav = wav[pad:pad + n * HOP]
        return wav, d, rec['raw']


# ------------------------------------------------------------------ audio helpers -------------------------------
def frame_db(w, win=0.025, hop=0.010):
    n, h = int(win * SR), int(hop * SR)
    if len(w) < n: w = np.pad(w, (0, n - len(w)))
    idx = np.arange(0, len(w) - n + 1, h)
    e = np.array([np.sqrt(np.mean(w[i:i + n] ** 2) + 1e-12) for i in idx])
    return 20 * np.log10(e + 1e-12), h, n


def speech_span(w, rel_db=-42.0):
    db, h, n = frame_db(w)
    thr = max(db.max() + rel_db, -65)
    act = np.where(db > thr)[0]
    return act[0] * h / SR, (act[-1] * h + n) / SR, db, thr


def tempo_stretch(w, tempo):
    with tempfile.TemporaryDirectory() as td:
        import soundfile as sf
        a, b = os.path.join(td, 'a.wav'), os.path.join(td, 'b.wav')
        sf.write(a, w, SR, subtype='FLOAT')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', a, '-af',
                        f'rubberband=tempo={tempo}:pitchq=quality:formant=preserved:window=standard', b], check=True)
        out, _ = sf.read(b)
    return out.astype(np.float64)


def fade(w, fin, fout):
    w = w.copy()
    a, b = int(fin * SR), int(fout * SR)
    if a: w[:a] *= 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, a))
    if b: w[-b:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, b))
    return w


def loudness(w):
    db, h, n = frame_db(w)
    act = db > db.max() - 30
    rms = 20 * np.log10(np.sqrt(np.mean(np.concatenate([w[i * h:i * h + n] for i in np.where(act)[0]]) ** 2)) + 1e-12)
    return rms, 20 * np.log10(np.abs(w).max() + 1e-12)


# ------------------------------------------------------------------ per line ------------------------------------
def render_line(eng, L, allowed, write=True):
    lid = L['id']; opt = LINES.get(lid, {})
    disp, keys = build(L['te'], opt.get('opt', True))
    tts, m = to_tts(disp)
    validate(lid, tts, allowed)
    ls = GLOBAL_LS * opt.get('ls', 1.0)
    pause = dict(PAUSE_MS, **opt.get('pause', {}))
    pmin = dict(PAUSE_MIN_MS, **opt.get('pause_min', {}))
    t0 = time.time()
    wav, d, raw = eng.synth(tts, ls, pause, pmin)
    cum = np.concatenate([[0], np.cumsum(d)]) * HOP / SR          # token k starts at cum[k] s (raw timeline)
    tempo = opt.get('tempo', 1.0)
    shift = 0.0
    if tempo != 1.0:
        assert 0.94 <= tempo <= 1.06, 'tempo outside the natural range'
        on0 = speech_span(wav)[0]
        wav = tempo_stretch(wav, tempo)
        shift = speech_span(wav)[0] - on0 / tempo                    # stretcher latency, measured on the onset
        cum = cum / tempo + shift
    on, off, _, _ = speech_span(wav)
    head = max(0, int(round((PREROLL - on) * SR)))               # guarantee the pre-roll even when speech starts at 0
    tail = max(0, int(round((off + TAIL) * SR)) - len(wav))
    if head or tail:
        wav = np.concatenate([np.zeros(head), wav, np.zeros(tail)])
        cum = cum + head / SR; on += head / SR; off += head / SR
    a = on - PREROLL; b = off + TAIL
    seg = wav[int(round(a * SR)):int(round(b * SR))]
    seg = fade(seg, FADE_IN, FADE_OUT)
    rms, peak = loudness(seg)
    g = TARGET_RMS_DB - rms
    g = min(g, PEAK_DB - peak)
    seg = seg * 10 ** (g / 20)
    tok = lambda k: round(max(0.0, cum[k] - a), 3)
    # Onset calibration. Token boundaries are exact model time, but after a silence (line start or an in-line
    # pause) the decoder starts the next word inside the pause token: measured 13-75 ms early for vowel-initial
    # words (ఎక్స్‌ప్లోర్‌ప్రో, ఏఐ, అసెస్‌మెంట్స్). So a word that follows silence is anchored at its audible onset
    # (first sustained rise above the speech threshold, searched from max(pause start, token - 120 ms) to token + 60 ms). Words in
    # running speech keep the token boundary.
    edb, eh, _ = frame_db(seg, 0.010, 0.005)
    ethr = max(edb.max() - 42.0, -65)
    after_pause = {b: a_ for a_, b, kind, final in groups(tts) if kind != 'gap' and not final}

    def onset(k):
        t = tok(k)
        if k == 0: lo = 0.0
        elif k in after_pause: lo = max(0.0, cum[after_pause[k]] - a, t - 0.120)
        else: return t, None
        j, hi = int(lo * SR / eh), min(len(edb) - 4, int((t + 0.060) * SR / eh))
        while j < hi and edb[j] > ethr: j += 1          # decay of the previous word
        while j < hi and not (edb[j:j + 4] > ethr).all(): j += 1   # first sustained (20 ms) rise after the silence
        if j >= hi: return t, None                      # no clean silence/onset found: keep the token boundary
        t_on = round(j * eh / SR, 3)
        return t_on, (None if k == 0 else round((t - t_on) * 1000))

    anchors, calib = {}, {}
    for key, i in keys.items():
        anchors[key], d_ms = onset(m[i])
        if d_ms is not None: calib[key] = d_ms         # line-start anchors are simply the onset (= pre-roll)
    words, k = [], 0
    for wtxt in disp.split(' '):
        tw, _ = to_tts(wtxt)
        core = tw.rstrip("!',.:;?")
        words.append({'w': wtxt.rstrip("!',.:;?"), 't0': onset(k)[0], 't1': tok(k + len(core))})
        k += len(tw) + 1
    dur = round(len(seg) / SR, 3)
    rel = os.path.join('audio', 'vo_te', f'{lid}.wav')
    if write:
        import soundfile as sf
        os.makedirs(WAVDIR, exist_ok=True)
        sf.write(os.path.join(ROOT, rel), seg, SR, subtype='PCM_16')
    entry = {'id': lid, 'file': rel, 'dur': dur, 'sr': SR, 'ls': round(ls, 4), 'tempo': tempo, 'text': disp,
             'anchors': anchors, 'words': words}
    qa = {'id': lid, 'tts': tts, 'budget': L['budget'], 'dur': dur, 'synth_s': round(time.time() - t0, 2),
          'trim': [round(a, 3), round(b, 3)], 'raw_len': round(len(wav) / SR, 3), 'durations': d.astype(int).tolist(),
          'cum_raw': [round(x, 4) for x in cum.tolist()], 'tempo_shift': round(shift, 4), 'onset_calib_ms': calib}
    print(f'{lid}  {dur:5.2f}s (budget {L["budget"]:.1f}, {dur - L["budget"]:+.2f})  ls {ls:.3f}  tempo {tempo}  '
          f'synth {qa["synth_s"]:.1f}s  anchors {anchors}')
    return entry, qa, seg


# ------------------------------------------------------------------ QA ------------------------------------------
def qa_line(entry, qa, seg):
    import librosa
    tts = qa['tts']
    a0 = qa['trim'][0]
    cum = np.array(qa['cum_raw']) - a0
    on, off, db, thr = speech_span(seg)
    n_ak = aksharas(entry['text'])
    inline_pause = sum(float(cum[e] - cum[s]) for s, e, kind, final in groups(tts) if not final and kind != 'gap')
    speech = off - on - inline_pause                 # articulation time (rate excludes the designed pauses)
    # unexpected silences: runs below threshold >= 450 ms inside the speech span, not covering a punctuation group
    _, h, n = frame_db(seg)
    sil, run = [], None
    for i, v in enumerate(db):
        t = i * h / SR
        if v <= thr and on < t < off:
            run = run if run is not None else t
        else:
            if run is not None and t - run >= 0.45: sil.append((run, t))
            run = None
    punct_spans = [(cum[s], cum[e]) for s, e, kind, final in groups(tts) if kind != 'gap']
    unexpected = [(round(s, 3), round(e, 3)) for s, e in sil
                  if not any(ps - 0.05 <= e and pe + 0.05 >= s for ps, pe in punct_spans)]
    pause_list = [round(float(cum[e] - cum[s]), 3) for s, e, kind, final in groups(tts) if not final and kind != 'gap']
    onset_ms = qa.get('onset_calib_ms', {})          # token boundary minus audible onset, for anchors after silence
    f0, vflag, _ = librosa.pyin(seg.astype(np.float32), fmin=80, fmax=500, sr=SR, frame_length=1024, hop_length=256)
    f0v = f0[vflag & ~np.isnan(f0)]
    rms, peak = loudness(seg)
    st = {'id': entry['id'], 'dur': entry['dur'], 'budget': qa['budget'], 'aksharas': n_ak,
          's_per_akshara': round(speech / max(1, n_ak), 3), 'speech_s': round(speech, 3), 'pauses_s': pause_list,
          'unexpected_silences': unexpected, 'anchor_onset_ms': onset_ms, 'peak_db': round(peak, 2), 'rms_db': round(rms, 2),
          'f0_median': round(float(np.median(f0v)), 1) if len(f0v) else None,
          'f0_p10_p90': [round(float(np.percentile(f0v, 10)), 1), round(float(np.percentile(f0v, 90)), 1)] if len(f0v) else None,
          'voiced_frac': round(float(vflag.mean()), 3)}
    flags = []
    if not 0.08 <= st['s_per_akshara'] <= 0.20: flags.append('rate')
    if unexpected: flags.append('silence')
    if any(not -30 <= v <= 120 for v in onset_ms.values()): flags.append('anchor')   # calibration out of range
    if st['f0_median'] and not 160 <= st['f0_median'] <= 330: flags.append('f0')
    if st['peak_db'] > -0.9: flags.append('peak')
    st['flags'] = flags
    plot_line(entry, seg, f0, cum, st)
    return st


def plot_line(entry, seg, f0, cum, st):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import librosa, librosa.display
    t = np.arange(len(seg)) / SR
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 5.2), sharex=True, gridspec_kw={'height_ratios': [1, 2.2]})
    ax1.plot(t, seg, color='#7438F2', lw=0.5)
    ax1.set_ylim(-1, 1); ax1.set_yticks([])
    ax1.set_title(f"{entry['id']}  {st['dur']:.2f}s (budget {st['budget']:.1f})  {st['s_per_akshara']:.3f} s/akshara  "
                  f"F0 med {st['f0_median']} Hz  peak {st['peak_db']} dB  rms {st['rms_db']} dB  {' '.join(st['flags']) or 'OK'}",
                  fontsize=10, loc='left')
    S = librosa.feature.melspectrogram(y=seg.astype(np.float32), sr=SR, n_fft=1024, hop_length=256, n_mels=80, fmax=8000)
    librosa.display.specshow(librosa.power_to_db(S, ref=np.max), sr=SR, hop_length=256, x_axis='time', y_axis='mel',
                             fmax=8000, ax=ax2, cmap='magma')
    if f0 is not None:
        ft = librosa.times_like(f0, sr=SR, hop_length=256)
        ax2.plot(ft, f0, color='#7CFFB2', lw=1.4, label='F0')
    for w in entry['words']:
        ax2.axvline(w['t0'], color='white', lw=0.5, alpha=0.5)
        ax1.text(w['t0'], 0.82, iso15919(w['w']), fontsize=8, color='#333')
    for k, v in entry['anchors'].items():
        for ax in (ax1, ax2): ax.axvline(v, color='#FFB020', lw=1.6)
        ax1.text(v, -0.95, k, fontsize=9, color='#B06A00', fontweight='bold')
    ax2.set_xlim(0, len(seg) / SR)
    fig.tight_layout()
    fig.savefig(os.path.join(QADIR, f"{entry['id']}.png"), dpi=80)
    plt.close(fig)


def plot_overview(entries, stats):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    ids = [e['id'] for e in entries]
    fig, ax = plt.subplots(figsize=(12, 4))
    x = np.arange(len(ids))
    ax.bar(x - 0.2, [s['budget'] for s in stats], 0.4, color='#D6C4FF', label='budget')
    ax.bar(x + 0.2, [e['dur'] for e in entries], 0.4, color='#7438F2', label='VO')
    ax.set_xticks(x); ax.set_xticklabels(ids)
    ax.set_ylabel('s'); ax.legend()
    ax.set_title(f"Telugu VO durations: total {sum(e['dur'] for e in entries):.2f}s vs budget {sum(s['budget'] for s in stats):.2f}s")
    fig.tight_layout(); fig.savefig(os.path.join(QADIR, 'overview.png'), dpi=80); plt.close(fig)


# ------------------------------------------------------------------ review pack ---------------------------------
def film_timed_stem():
    """QA: every line placed at its start in film/timeline.real.json (VO-only preview against picture)."""
    import soundfile as sf
    p = os.path.join(ROOT, 'film', 'timeline.real.json')
    if not os.path.exists(p): return
    tl = json.load(open(p, encoding='utf-8'))
    out = np.zeros(int(math.ceil(tl['duration'] * SR)) + SR)
    for sc in tl['scenes']:
        for v in sc['vo']:
            if not v.get('file'): continue
            w, _ = sf.read(os.path.join(ROOT, v['file']))
            i = int(round(v['start'] * SR)); out[i:i + len(w)] += w
    sf.write(os.path.join(QADIR, 'vo_film_timed.wav'), out[:int(tl['duration'] * SR)], SR, subtype='PCM_16')


def timeline_rows():
    p = os.path.join(ROOT, 'film', 'timeline.real.json')
    if not os.path.exists(p): return []
    tl = json.load(open(p, encoding='utf-8'))
    rows = ['**Film timing with this VO** (`film/timeline.real.json`): total ' + f"{tl['duration']:.1f} s.", '',
            '| scene | start | end | length | lines |', '|---|---|---|---|---|']
    rows += [f"| {s['id']} | {s['start']:.2f} | {s['end']:.2f} | {s['end'] - s['start']:.2f} | {' '.join(l['id'] for l in s['vo'])} |"
             for s in tl['scenes']]
    return rows + ['']


def review_pack(entries, script, stats):
    import soundfile as sf
    gap = np.zeros(int(0.7 * SR))
    parts = [gap[:int(0.3 * SR)]]
    for e in entries:
        w, sr = sf.read(os.path.join(ROOT, e['file']))
        parts += [w, gap]
    rv = np.concatenate(parts)
    rv *= 10 ** (-1.0 / 20) / (np.abs(rv).max() + 1e-9)
    sf.write(os.path.join(AUD, 'vo_review.wav'), rv, SR, subtype='PCM_16')
    S = {s['id']: s for s in stats}
    rows = []
    for e in entries:
        L = script[e['id']]
        rows.append(f"| {e['id']} | {L['scene']} | {e['text']} | {iso15919(e['text'])} | {L['gloss']} | {e['dur']:.2f} | {L['budget']:.1f} |")
    total = sum(e['dur'] for e in entries)
    md = ['# XplorePro film: Telugu voiceover review sheet', '',
          'Voice: AI4Bharat Indic-TTS Telugu FastPitch + HiFi-GAN, female speaker (synthetic). '
          'Listen to `audio/vo_review.wav`: all 17 lines in film order, 0.7 s apart.', '',
          'What to check, line by line: does each English term (written in Telugu script) sound right; is anything '
          'mispronounced or rushed; does the meaning match the English gloss. Spellings come from `audio/lexicon_te.json`.', '',
          '| id | scene | Telugu | ISO 15919 | English gloss | dur (s) | budget (s) |',
          '|---|---|---|---|---|---|---|', *rows, '',
          f'Total speech: {total:.2f} s across {len(entries)} lines (budget {sum(script[e["id"]]["budget"] for e in entries):.1f} s).', '',
          *timeline_rows(),
          '**Compliance wording.** L12: "ఫ్లాగ్ అంటే తీర్పు కాదు, ఒక మనిషి రివ్యూ చేసే ఎవిడెన్స్" = a flag is not a verdict; '
          'it is evidence a person reviews. L15: "ఫైనల్ డెసిషన్ మాత్రం మీదే" = the final decision is yours (the employer\'s). '
          'No line promises a placement, a job or an ATS ranking.', '',
          '**How to change a line.** Edit the Telugu inside `audio/script_te.json` (keep every `[key|...]` anchor key), '
          'then run `/home/user/tools/venv-te/bin/python -I audio/vo_te.py --only L05`; it re-voices that line and '
          'rewrites `audio/vo_te.json`, `film/timeline.real.json`, this sheet and `audio/vo_review.wav`. '
          '`out/qa/vo-te/vo_film_timed.wav` is the VO placed at its real film times (60 s, no music).', '']
    open(os.path.join(AUD, 'vo_review_sheet.md'), 'w', encoding='utf-8').write('\n'.join(md))


# ------------------------------------------------------------------ main ----------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--no-qa', action='store_true')
    ap.add_argument('--say', default=None)
    ap.add_argument('--ls', type=float, default=1.0)
    ap.add_argument('--out', default=None)
    ap.add_argument('--threads', type=int, default=2)
    args = ap.parse_args()
    allowed = allowed_chars()
    script_d = json.load(open(SCRIPT, encoding='utf-8'))
    lines = script_d['lines']
    script = {L['id']: L for L in lines}
    lexicon_check(lines)
    for L in lines:
        for keep in (True, False):
            disp, keys = build(L['te'], keep)
            validate(L['id'], to_tts(disp)[0], allowed)
    print(f'script OK: {len(lines)} lines, alphabet + lexicon validated')
    if args.check: return
    os.makedirs(QADIR, exist_ok=True)
    eng = Engine(args.threads)
    if args.say is not None:
        disp, _ = build(args.say); tts, _ = to_tts(disp); validate('say', tts, allowed)
        wav, d, raw = eng.synth(tts, args.ls)
        import soundfile as sf
        on, off, _, _ = speech_span(wav)
        print(f'speech {off - on:.2f}s  raw {len(wav) / SR:.2f}s  aksharas {aksharas(tts)}')
        print(' '.join(f'{c}:{int(x)}' for c, x in zip(tts, d)))
        if args.out: sf.write(args.out, wav, SR, subtype='PCM_16')
        return
    only = set(filter(None, args.only.split(',')))
    prev = {e['id']: e for e in json.load(open(OUTJSON))} if (only and os.path.exists(OUTJSON)) else {}
    entries, qas = [], {}
    import soundfile as sf
    for L in lines:
        if only and L['id'] not in only and L['id'] in prev:
            entries.append(prev[L['id']]); continue
        e, q, seg = render_line(eng, L, allowed)
        entries.append(e); qas[L['id']] = (q, seg)
    json.dump(entries, open(OUTJSON, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'wrote {OUTJSON}: total speech {sum(e["dur"] for e in entries):.2f}s')
    if args.no_qa: return
    stats_path = os.path.join(QADIR, 'stats.json')
    old = {s['id']: s for s in json.load(open(stats_path))} if os.path.exists(stats_path) else {}
    stats = []
    for e in entries:
        if e['id'] in qas:
            q, seg = qas[e['id']]
            s = qa_line(e, q, seg); s['durations'] = q['durations']; s['tts'] = q['tts']
        else:
            s = old.get(e['id']) or qa_line(e, {'tts': to_tts(e['text'])[0], 'budget': script[e['id']]['budget'], 'trim': [0, 0],
                                                'cum_raw': [0] * (len(to_tts(e['text'])[0]) + 1)}, sf.read(os.path.join(ROOT, e['file']))[0])
        stats.append(s)
        print(f"QA {s['id']}: {s['s_per_akshara']:.3f} s/ak  pauses {s['pauses_s']}  onsets {s.get('anchor_onset_ms')}  F0 {s['f0_median']} {s['f0_p10_p90']}  "
              f"peak {s['peak_db']}  rms {s['rms_db']}  {'FLAGS ' + ','.join(s['flags']) if s['flags'] else 'ok'}"
              + (f"  silences {s['unexpected_silences']}" if s['unexpected_silences'] else ''))
    json.dump(stats, open(stats_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    plot_overview(entries, stats)
    r = subprocess.run(['python3', os.path.join(AUD, 'film_timeline.py'), '--out', os.path.join(ROOT, 'film', 'timeline.real.json')],
                       capture_output=True, text=True)
    print(r.stdout, r.stderr)
    review_pack(entries, script, stats)
    film_timed_stem()


if __name__ == '__main__':
    main()
