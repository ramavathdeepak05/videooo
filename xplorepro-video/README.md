# XplorePro product videos

| File | What |
|---|---|
| `xplorepro-motion-video.mp4` | 50s motion-graphics cut (VO + music + SFX) |
| `xplorepro-product-video.mp4` | Earlier 33s silent cut |

## Rebuild the motion cut
```bash
npm install                                   # Poppins font + Lucide icons
pip install kokoro-onnx soundfile numpy scipy # voice + audio synthesis
# Kokoro model files (kokoro-v1.0.onnx, voices-v1.0.bin) from github.com/thewh1teagle/kokoro-onnx releases → /home/user/tools/
python3 audio/vo.py af_heart      # 1. voiceover lines  → audio/vo_*.wav
python3 audio/timeline.py         # 2. beat-snapped scene timeline → timeline.json
node render-zelios.js frames      # 3. frames + sfx.json cue sheet (pass from/to to split across workers)
python3 audio/mix.py              # 4. score + SFX + VO → audio/mix.wav
ffmpeg -framerate 30 -i frames/f%04d.jpg -i audio/mix.wav -c:v libx264 -crf 17 -pix_fmt yuv420p -c:a aac -b:a 256k -shortest out.mp4
```
Edit the script in `audio/vo.py`, the scenes in `zelios.js`.
