/* scenes/_template.js: API reference for scene authors (this file is not loaded).
   ───────────────────────────────────────────────────────────────────────────────────
   Register exactly one object per scene id (ids: hook reveal eco mentor readiness colleges corporates converge cta):

   SC.myscene = {
     cutIn: { type: 'match', pre: 0, post: 0, point: [960, 540], blurAcross: false },  // how this scene ENTERS
             // 'match' hard cut (morph is drawn by both scenes around the boundary)
             // 'xfade' | 'particles' both scenes drawn, crossfaded over [at-pre, at+post]
             // 'iris'  incoming revealed through a growing circle at `point`
             // 'push'  outgoing zooms into `point` (×8) while incoming grows from it
     init(s)  { // once. s = {id, start, end, len, vo:[{id,start,dur,text}], anchors:{key:absSec}, bg}
                const st = { tA: at(s, 'resume') };          // local times of VO anchors (keys from audio/script_te.json)
                cue(s, st.tA, 'pop', .6, { x: 700 });          // SFX cue (types: see audio sfxlib); x = screen x for pan
                return st; },
     draw(lt, st) { ... },     // lt = seconds since scene start; may be <0 or >len during overlap cuts. PURE function of lt.
     bg(lt, st)  { return { contours: { tangle: .5 } } },   // optional overrides of the engine background (col, glow, contours)
     blur(lt, st) { return 0 }  // optional: force motion-blur samples (0 = auto)
   };

   Timing: never hard-code absolute seconds. Use at(s,key), voLine(s,'L06') → {start,dur,end}, and s.len.
   Motion:  sp(lt, t0, SP.ui|SP.pop|SP.text|SP.cam|SP.needle|SP.soft) springs (bounce ≤ .3; text/camera 0); spInOut(); seg(); eio(); expoIO(); brand().
            Stagger 40-80ms. ≤ 3 support objects + 1 hero on screen. Text: typeRise/eyebrow (mask-rise, never bounce), ≥ 28px.
   Camera:  const c = camAt([{t:0,x:960,y:540,z:1},{t:2,x:1200,y:540,z:1.1,ease:'spring'}], lt); g.save(); applyCam(c); ... g.restore();
            layer(c, depth, fn) for parallax; shake(lt, t0) for impacts only.
   Drawing: circle ring arc rrect tf line pathDraw sparkle shock | type typeRise eyebrow chip textWidth | icon badge
            softShadow card bars pill | vectorMark lockup wordmark MARK_DOT | contours contoursAlong spark sparkAlong bokeh
            tilt3d | odometer rollValue | person bust (ui/people.js) | lut(points) → {at(u), len, pts}
   Colours: COL.* (violet #7438F2 is the action colour; green/verified ONLY for verification ticks; never green CTA).
   Rules:   no Math.random/Date; no setTransform (use save/translate/restore); no shadowBlur/filter (use softShadow/card);
            no robot/eye/brain/emotion imagery; no readable fake text (use bars()); British spelling; no em/en dashes.
*/
