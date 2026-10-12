# XplorePro product films

## Deliverables

| File | What it is |
|---|---|
| `xplorepro-motion-video-te-60s.mp4` | **The current cut.** 60s, 1920×1080, 30fps, Telugu female voiceover with music and sound effects. Audio is AAC 48 kHz at −14 LUFS, −1.4 dBTP. |
| `audio/vo_review.wav` | The Telugu voiceover on its own: all 17 lines with gaps between them, for pronunciation review. |
| `audio/vo_review_sheet.md` | Each line in Telugu, ISO 15919 romanisation and English gloss, with its duration. |
| `out/mix/stem_{vox,music,fx}.wav` | Mix stems. Not committed; `build.sh` regenerates them. |
| `archive/` | Earlier English cuts (50s and 33s). |

On-screen text is English. The only claims shown are the four scale figures from the website: 300+ client organisations, 700+ colleges and universities, 1 Million+ students and 6 countries.

## How it is built

- **`film/`** is a canvas motion-graphics engine rendered frame by frame in headless Chromium.
  - `film/core/` holds springs, adaptive sub-frame motion blur, match-cut compositor, brand contour-wave field, 2.5D tilt, odometer counters and the vector logo.
  - `film/ui/` holds the UI components.
  - `film/scenes/` holds one file per scene: hook, reveal, eco, mentor, readiness, colleges, corporates, converge, cta.
- **Telugu voiceover:** AI4Bharat Indic-TTS, the Telugu FastPitch + HiFi-GAN model with the female speaker. Sync anchors come from FastPitch's own durations.
- **Timeline:** `audio/film_timeline.py` turns voiceover durations into beat-snapped scene windows. The source files are `film/story.json` and `audio/script_te.json`.
- **Score and sound design:** `audio/film_mix.py` and `audio/sfxlib.py` synthesise everything in numpy/scipy. Sections are driven by timeline markers, sound cues come from `film/sfx.json`, and the voice ducks the music in three bands. The master goes straight to −14 LUFS.

## Rebuild

```bash
./build.sh            # full quality: timeline, lint, cue export, mix, audio QA, PNG frames, encode
./build.sh --preview  # fast half-res check render (out/preview.mp4)
```

Steps by hand:

```bash
/home/user/tools/venv-te/bin/python -I audio/vo_te.py [--only L07,L15]   # (re)voice Telugu lines
python3 audio/film_timeline.py                                           # film/timeline.json
bash tools/lint.sh                                                       # determinism, banned imagery, house style
node film/render.js --export                                             # film/sfx.json + film/onscreen.json
python3 audio/film_mix.py --stems && python3 tools/qa_audio.py           # mix + QA (VO-over-music margins, loudness)
node film/render.js --out out/frames --workers 4 --png                   # 1800 frames
node film/contact.js --scene mentor --step .4                            # QA contact sheet (also --cut, --anchors, --times)
```

### Prerequisites (the paths are hard-coded)

- **Playwright:** `/opt/node-tools/node_modules/playwright`. **Chromium:** `/opt/pw-browsers/chromium`. **ffmpeg/ffprobe:** on PATH.
- **`npm install`:** fetches `@fontsource/dm-sans`, `@fontsource/inter` and `lucide-static`.
- **Python** with `numpy`, `scipy` and `soundfile` (mix and QA).
- **Telugu TTS** (only needed to re-voice lines):
  - **venv:** `python3 -m venv /home/user/tools/venv-te`, then `pip install torch==2.5.1 torchaudio==2.5.1 coqui-tts==0.24.2 soundfile`. That pulls transformers 4.42.
  - **Model:** `te.zip` from the AI4Bharat Indic-TTS GitHub release `v1-checkpoints-release`, unzipped to `/home/user/tools/indic-tts/`.
  - **Config:** a copy of `te/fastpitch/config.json` with `speakers_file` pointed at the absolute `speakers.pth` path, saved as `/home/user/tools/indic-tts-cfg/config.json`.
  - **Licence:** check the Indic-TTS model licence before commercial use.

### Where to change things

- **Voiceover wording:** edit `audio/script_te.json`. `[key|word]` marks a sync anchor; keep the keys. Spellings of English terms are in `audio/lexicon_te.json`. Then run `vo_te.py --only Lxx`, `film_timeline.py` and the remaining build steps.
- **Visuals:** edit `film/scenes/NN-*.js`. Scenes are keyed to voiceover anchors (`at(s, 'key')`), never to absolute times. Read the API reference in `film/scenes/_template.js` first.
- **Scene backgrounds and minimum lengths, music markers:** `film/story.json`.

## Legacy 50s English cut

The previous cut lives in `archive/`. Its sources are `zelios.html`/`zelios.js` (built with `render-zelios.js`) and `audio/vo.py`, `audio/timeline.py` and `audio/mix.py` (Kokoro `af_heart` voice).
