# Pin High (working title)

A daily, Wordle-style golf decision game. Every day everyone gets the same fictional par-3 island green. You rotate
the 3D green, read slope, green speed and wind, pick a club, spin and shape, tap an aim point and shoot. You are scored
on **decision quality** (how close your choice is to the best shot, relative to a simulated "typical player"), not on
execution: there is no swing timing and the shot model is deterministic.

Status: playable prototype, last published as artifact version v118.

## Run it

```bash
npm install          # puppeteer-core + three (only needed for the tests)
npm run build        # writes dist/artifact.html, dist/index.html, dist/test.html
npm run serve        # build + serve dist/ on http://localhost:8080
npm test             # physics regression checks (no browser needed)
CHROME=/path/to/chrome npm run test:render   # headless smoke test: aim, shoot, result card, no page errors
```

`dist/index.html` is a complete standalone page (it loads three.js r128 and two Google Fonts from CDNs).
`dist/artifact.html` is byte-identical to the page published as a Claude artifact; the artifact host adds its own
`<html>` skeleton, so use `index.html` everywhere else.
`dist/` is generated; edit `src/`.

## Layout

```
src/head.html, style.css, body.html   page head, all CSS, all markup (result card, menu, controls)
src/js/00-engine.js                   PURE logic, no DOM: seeded hole generator, shot physics, analyzer (best shot)
src/js/10-state-scene.js              state, three.js scene: island, grass, ribbons, pin/cup, ball, surface texture
src/js/20-camera-aim.js               orbit camera, aim marker, readouts, white dashed aim line
src/js/30-controls.js                 club / spin / shape buttons, menu (grid, theme, handedness)
src/js/40-shot-flight.js              shot planning, flight arc, trail and landing particles
src/js/50-sfx-fx.js                   synthesised sound (WebAudio) and confetti
src/js/60-result-scoring.js           streak, reveal animation, best-shot ring, scoring, "typical player"
src/js/70-loop-share-boot.js          animation loop, slope blobs, practice/share, boot
tools/build.js                        concatenates src/ in filename order into dist/ (no bundler, no modules)
tests/physics/                        node scripts that load 00-engine.js in a vm and check the tuned numbers
tests/render/smoke.js                 headless Chrome smoke test
docs/                                 DESIGN.md (how it works), SOURCES.md (what is sourced vs invented), ROADMAP.md
```

The JS files share one global scope on purpose (they are concatenated into two `<script>` blocks), so moving code
between files changes nothing at runtime as long as definition order is kept. Turning them into ES modules is a
reasonable first refactor.

## Things to know

- The daily hole comes from `makeHole('YYYY-MM-DD')` (seeded mulberry32), so every player gets the same hole with no server.
  The practice mode uses other seeds.
- Scores and streaks are stored in `localStorage` under `pinhigh:YYYY-MM-DD`; there is no server yet.
- Hazards exist in the generator but are disabled (`HAZ_ON=false`); every hole is an island, so missing the green is a penalty.
- Test harnesses extract the engine with `fs` + `vm`; if you rename the engine file keep `00-engine.js` or edit `tests/physics/prep.js` and `tools/build.js`.
