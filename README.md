# Happy Pets Palace — website redesign (mockup)

Open `index.html` in a browser (an internet connection is needed for fonts, three.js, maps and booking).

## Editing pages
Page content lives in `_src/pages/*.html`; the shared header, footer, loader and chat live in `_src/layout.html`.
After editing, rebuild the site files in the root:

    python _tools/build.py

## What's where
- `assets/js/core.js` — loader, raining paws, page transitions, sounds hooks, 3D/fur headings, all page features
- `assets/js/puffy3d.js` — real-time three.js puffy 3D lettering (live hero titles + heading words)
- `assets/js/fur.js` — hair-by-hair fluffy fur lettering (heading accent words in `<span class="s">`)
- `assets/js/sfx.js` — synthesized sound effects (Web Audio, no files)
- `assets/js/chat.js` — Lacy, the black-and-tan Pomeranian concierge (FAQ, booking, pre-screen scheduling)
- `assets/fonts/fredoka.js` — Fredoka Bold converted for three.js by `_tools/font2three.py`
- `assets/img/` — photos pulled from the original site at full resolution, resized and sharpened

Headings: plain words render as puffy 3D, words inside `<span class="s">` render as fur.
`data-color` (plum/teal/pink/white/butter) and `data-fur` (pink/teal/butter/white) on an `h2` change the colours;
`data-plain` on an `h2` keeps it as normal text.
