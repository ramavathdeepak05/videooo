/* sandbox: exercises every core feature (load with --include scenes/99-gallery.js; it overrides SC.hook) */
SC.hook = {
  init(s) { return { L: lut([[120, 900], [500, 760], [900, 820], [1300, 600], [1800, 420]]) }; },
  bg(lt) { return { contours: { converge: smooth(1, 4, lt), tangle: .3 * Math.sin(lt) } }; },
  draw(lt, st) {
    const c = camAt([{ t: 0, x: 960, y: 540, z: 1 }, { t: 3, x: 1010, y: 520, z: 1.06, ease: 'spring' }], lt);
    g.save(); applyCam(c);
    // logo build
    vectorMark(300, 260, 260, { dot: sp(lt, .1, SP.pop), needle: seg(lt, .3, .8), violet: sp(lt, .9, SP.ui), chev: sp(lt, 1.1, SP.ui), arm: sp(lt, 1.2, SP.ui) });
    lockup(1150, 200, 120, { word: expoIO(seg(lt, 1.4, .8)) });
    // counters
    odometer(560, 560, rollValue(lt, .5, 2.2, 300), { to: 300, suffix: '+', size: 88, col: COL.deep });
    odometer(1000, 560, rollValue(lt, .7, 2.2, 1000000), { to: 1000000, size: 88, million: true, morph: sp(lt, 3.1, SP.ui), col: COL.ink });
    odometer(1500, 560, rollValue(lt, .9, 2.4, 6, 2), { to: 6, size: 88, col: COL.ink });
    typeRise('colleges and universities', 560, 640, lt, 1.2, { size: 30, weight: 600, face: 'I', col: COL.muted });
    eyebrow('AI Career Mentorship', 1500, 640, lt, 1.4);
    // tilt card
    const ry = lerp(-.5, 0, sp(lt, .5, SP.soft)), rx = lerp(.2, 0, sp(lt, .5, SP.soft));
    softShadow(1500 - 160, 820 - 110, 320, 220, 24);
    tilt3d(320, 220, () => { rrect(0, 0, 320, 220, 24, COL.paper, COL.contour, 2); bust(60, 60, 36, 1); bars(110, 40, 180, 3, { head: true, p: seg(lt, .8, 1) }); chip('ATS check', 160, 170, { size: 22, icon: 'search-check' }); }, 1500, 820, ry, rx);
    // spark path + people + badge
    pathDraw(st.L, 1, COL.contour, 3, { dash: [2, 14] });
    sparkAlong(st.L, seg(lt, .2, 3.5));
    person(260, 820, .9, { lt, pal: 0, mood: 'focus' });
    badge(800, 860, 50, COL.violet, 'graduation-cap', sp(lt, 1.5, SP.pop));
    chip('Human review', 1050, 860, { fill: COL.ink, col: '#fff', size: 24, icon: 'user-check', iconCol: '#fff' });
    g.restore();
  }
};
