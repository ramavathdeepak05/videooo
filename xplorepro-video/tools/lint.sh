#!/usr/bin/env bash
# Film lint: determinism, banned imagery, house style. Exit 1 on errors.
cd "$(dirname "$0")/.." || exit 1
err=0
f=$(ls film/core/*.js film/ui/*.js film/scenes/[0-9]*.js 2>/dev/null)
for x in $f; do node --check "$x" || err=1; done
node tools/lint_code.js || err=1
# on-screen strings: em/en dashes and US spellings
if [ -f film/onscreen.json ]; then
  python3 - <<'PY' || err=1
import json,re,sys
d=json.load(open('film/onscreen.json')); bad=0
for s in d['strings']:
    if re.search('[–—]', s): print('ERROR dash in on-screen text:', s); bad=1
    if re.search(r'\b(Practice|organization|organizations|personalized|counseling|center|program\b|analyze|optimize)', s): print('ERROR US spelling:', s); bad=1
for k in d.get('missingAnchors',[]): print('ERROR missing anchor', k); bad=1
for e in d.get('errors',[]): print('ERROR page', e); bad=1
sys.exit(bad)
PY
fi
[ $err = 0 ] && echo "lint OK"
exit $err
