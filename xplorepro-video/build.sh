#!/usr/bin/env bash
# Rebuild the 60s Telugu-VO film end to end.
#   ./build.sh            full quality (adaptive motion blur, PNG frames)
#   ./build.sh --preview  fast half-res check render
set -euo pipefail
cd "$(dirname "$0")"
OUT=out; mkdir -p $OUT/mix
if [ "${1:-}" != "--skip-vo" ] && [ ! -f audio/vo_te.json ]; then
  /home/user/tools/venv-te/bin/python -I audio/vo_te.py            # Telugu VO (AI4Bharat Indic-TTS, female) -> audio/vo_te.json
fi
python3 audio/film_timeline.py                                     # VO durations -> beat-snapped scene windows + anchors
bash tools/lint.sh
node film/render.js --export                                       # film/sfx.json (cue sheet) + film/onscreen.json (text/icon log)
python3 audio/film_mix.py --stems                                  # score + SFX + VO -> out/mix/mix.wav (-16 LUFS)
python3 tools/qa_audio.py
if [ "${1:-}" = "--preview" ]; then
  rm -rf $OUT/preview && node film/render.js --out $OUT/preview --preview --workers 4
  ffmpeg -loglevel error -y -framerate 30 -i $OUT/preview/f%04d.jpg -i $OUT/mix/mix.wav -c:v libx264 -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest $OUT/preview.mp4
  echo "$OUT/preview.mp4"; exit 0
fi
rm -rf $OUT/frames && node film/render.js --out $OUT/frames --workers 4 --png
# two-pass loudnorm to -14 LUFS / -1 dBTP, 48 kHz AAC
J=$(ffmpeg -hide_banner -i $OUT/mix/mix.wav -af loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
MI=$(echo "$J" | python3 -c "import json,sys;d=json.load(sys.stdin);print(f\"measured_I={d['input_i']}:measured_TP={d['input_tp']}:measured_LRA={d['input_lra']}:measured_thresh={d['input_thresh']}:offset={d['target_offset']}\")")
ffmpeg -loglevel error -y -framerate 30 -i $OUT/frames/f%04d.png -i $OUT/mix/mix.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 16 -x264-params aq-mode=3 -pix_fmt yuv420p -r 30 \
  -af "loudnorm=I=-14:TP=-1.0:LRA=11:$MI:linear=true,aresample=48000" -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart \
  xplorepro-motion-video-te-60s.mp4
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate,sample_rate -of compact xplorepro-motion-video-te-60s.mp4
