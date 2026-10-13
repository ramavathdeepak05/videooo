#!/usr/bin/env bash
# Rebuild the 60s XplorePro film end to end (English VO by default, Telugu with LANG_VO=te).
#   ./build.sh            full quality (adaptive motion blur, PNG frames)
#   ./build.sh --preview  fast half-res check render
#   LANG_VO=te ./build.sh  Telugu voiceover (default: en)
set -euo pipefail
cd "$(dirname "$0")"
OUT=out; mkdir -p $OUT/mix
LANG_VO=${LANG_VO:-en}
if [ "$LANG_VO" = te ]; then
  [ -f audio/vo_te.json ] || /home/user/tools/venv-te/bin/python -I audio/vo_te.py   # Telugu VO (AI4Bharat Indic-TTS, female)
else
  [ -f audio/vo_en.json ] || python3 audio/vo_en.py --speed 1.1                       # English VO (Kokoro af_heart)
fi
python3 audio/film_timeline.py --script audio/script_$LANG_VO.json --vo audio/vo_$LANG_VO.json --out film/timeline.$LANG_VO.json
cp film/timeline.$LANG_VO.json film/timeline.json                  # the renderer and mixer read film/timeline.json
bash tools/lint.sh
node film/render.js --export                                       # film/sfx.json (cue sheet) + film/onscreen.json (text/icon log)
python3 audio/film_mix.py --vo audio/vo_$LANG_VO.json --stems     # score + SFX + VO -> out/mix/mix.wav (-14 LUFS)
python3 tools/qa_audio.py
if [ "${1:-}" = "--preview" ]; then
  rm -rf $OUT/preview && node film/render.js --out $OUT/preview --preview --workers 4
  ffmpeg -loglevel error -y -framerate 30 -i $OUT/preview/f%04d.jpg -i $OUT/mix/mix.wav -c:v libx264 -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest $OUT/preview.mp4
  echo "$OUT/preview.mp4"; exit 0
fi
rm -rf $OUT/frames && node film/render.js --out $OUT/frames --workers 4 --png
# the master is already -14 LUFS / <= -1.2 dBTP (film_mix.py), so no loudness normaliser touches it
ffmpeg -loglevel error -y -framerate 30 -i $OUT/frames/f%04d.png -i $OUT/mix/mix.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 16 -x264-params aq-mode=3 -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart xplorepro-motion-video-$LANG_VO-60s.mp4
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate,sample_rate -of compact xplorepro-motion-video-$LANG_VO-60s.mp4
