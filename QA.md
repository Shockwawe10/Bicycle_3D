# QA: Varsen landing

"Perfect" means these numbers. Every threshold is the brief's, and none was relaxed. Raw results
are in `qa/results/`; how to re-run them is in section 4.

## 1. Results

| # | Criterion (from the brief) | Threshold | Result | Evidence |
|---|---|---|---|---|
| 1 | p = 0 and p = 1 match spec transforms | ≤ 1e-3 | **Pass** on all 3 viewports: every part's position and rotation, opacity, camera azimuth, elevation and direction, beat and shadow | `qa/tests/story.spec.mjs`, `spec-transforms-*.json` |
| 2 | 20 random scroll jumps give screenshots identical to sequential scrolling | Pixel-identical | **Pass: 0 / 20 mismatches** on WebKit 390×844, WebKit 820×1180 and Chrome 1440×900 | `jumps-*.json` |
| 3a | Checkpoints p = 0, .25, .5, .75, 1: no clipped bike | Projected bounding box of every visible part inside the viewport | **Pass**, 3 viewports × 5 checkpoints | `checkpoints-*.json`, `webkit-*-p*.png`, `chrome-desktop-p*.png` |
| 3b | … no overlapping text | No two visible text boxes intersect, and no text intersects the bike's box | **Pass**, 15 of 15 | same |
| 3c | … no horizontal scroll | `scrollWidth ≤ innerWidth` | **Pass**, 15 of 15 | same |
| 3d | Stage timing | Within 10% of each stage's length | **Pass.** Worst error 0.0043 p (handlebar end), 0.36 of the tolerance. p is measured from the DOM scroll position. | `timing-*.json` |
| 4a | Lighthouse mobile Performance | ≥ 90 | **99 / 100 / 99** (3 runs; TBT 68 / 60 / 76 ms) | `lighthouse-mobile-{1,2,3}.json`, `lighthouse-summary.json` |
| 4b | CLS | < 0.1 | **0** | same |
| 4c | LCP | < 2.5 s | **1.44–1.47 s** (the hero h1) | same |
| 4d | Total transfer, gzip | ≤ 600 KB | **252 KB**: index.html ~64 KB (fonts inline), three r185 189 KB | same (total-byte-weight) |
| 4e | WCAG 2.2 AA text contrast | 4.5:1 (3:1 for large text) | **Pass.** Lighthouse color-contrast passes, and on all 8 beats plus header, close and footer, 108 elements, the lowest is **5.03:1** | `contrast.json` |
| 5 | 10 s scripted scroll, frames < 20 ms | ≥ 95% | **100%** (600 / 600). p95 16.8 ms, max 17.4 ms; adaptive quality stayed at level 0. **Proxy:** Chrome headless on the desktop GPU with 4× CPU throttle, iPhone emulation 390×844 at DPR 3, renderer at the 1.5 cap. Desktop 1440×900: also 100%, p95 16.8 ms. | `frames-mobile.json`, `frames-desktop.json` |
| 6 | No part passes through another while scrolling (user request, 2026-11-12) | 0 mesh pairs of different parts interpenetrating deeper than 0.3 mm at any p; a designed shaft-in-bore fit stays on its bore axis within 0.05 mm (GEOMETRY.md section 6) | **Pass: 0 pairs** over 6,528 samples of p, no part moving more than 1 mm between two. The 5 designed fits (steerer, BB spindle, seatpost) stay within 0.012 mm of their axis. Before the fix: **102 pairs** over the scroll, 54 of them in the assembled bike. A fork pushed 10 mm off its axis is caught (6.8 mm off) | `qa/tests/overlap.spec.mjs`, `overlaps.json` |
| 7 | Wheels come in along the line of travel, cranks pedal forward (user request, 2026-11-12) | Front wheel from ahead, rear from behind, turning by −Δx / R; crank angle about +z never rises | **Pass**: checked at 41 steps per stage | `qa/tests/story.spec.mjs` |

### Supporting checks

| Check | Result |
|---|---|
| Geometry startup assertion: wheelbase, wheel diameter, ratio and head angle within the chart's range | Pass. 991.0 mm, 674.0 mm, 1.470, 73.50°; broken charts are rejected. 4 tests × 3 viewports. |
| Page joints match the GEOMETRY.md table | ≤ 0.1 mm on all 13 joints |
| Procedural parts | Torus tyres, 24 instanced spokes per wheel, no model downloads (request list checked) |
| Reduced motion | Five discrete states at the storyboard's thresholds, no tween, static backdrop |
| No WebGL | The SVG poster drawn from the joint table shows; text intact; no page errors |
| Context loss and restore | The poster shows on loss; restore rebuilds the scene on a fresh canvas; no console errors in WebKit or Chrome |
| Dispose | 0 geometries left, the context is released (see section 3, note 4) |
| Main-thread blocking during init (4× CPU) | Longest task 111–114 ms (unchanged by the chain solver, which takes ~20 ms here and yields after itself); approximate TBT 97–102 ms (3 loads). It was 1.6 s before the async PMREM and compile work. |
| CSP | Strict, hash-based (`default-src 'none'`). The QA server sends nginx.conf's policy; no violations from the page. |
| Copy (design skill's copy-lint) | 0 FAIL, 0 WARN (1 INFO: one number-pair heading, within budget) |
| Lighthouse Accessibility and Best Practices | 100 / 100 (all 3 runs) |
| Model detail budget | 147k triangles, 122 draw calls, 7 textures at p = 1 (was 30.7k / 83 before the detail upgrade). Before/after close-ups: `closeups-before-detail.png`, `closeups-detailed.png` |
| Chain (GEOMETRY.md section 4) | Solved link by link: 112 links, every link 12.7 mm within 1 µm, every roller seated on a pitch point of the ring, cog and both pulleys; the derailleur cage at −105° takes up the slack |
| Hero drag-to-spin (STORYBOARD 2b) | Pass on all 3 viewports: a 120 px drag turns the bike > 0.3 rad about its own axis (wheelbase centre stays on the axis within 1 mm); applied yaw is 0 at p = 0.12; the visitor's angle returns at p = 0 |
| Loading state | The no-WebGL poster never shows while the 3D bike loads: sampled every frame from navigation to ready, 0 frames visible on all 3 viewports. It appears only for no WebGL, a failed geometry check or a lost GPU context. |
| Adaptive-quality step at rest | The canvas is redrawn after the resize (regression test, WebKit and Chrome); bike visible after a forced step in Chrome (`live-check.mjs`) |
| Live site (GitHub Pages) | `qa/live-check.mjs`: HTTP 200, geometry OK, bike visible at p = 0, 0.5 and 1, no errors |

## 2. Fix log: what the loop found and changed

| Found by | Problem | Root cause | Fix |
|---|---|---|---|
| Init profile | 1.4 s of main-thread blocking | PMREM's GGX/blur shaders and the opaque material variants compiled synchronously | Async warm-up of PMREM's materials (skill `three-pmrem-async-warmup`), `compileAsync` for both material variants, one part built per task |
| Geometry suite | `frames.length` of undefined | A scroll or resize frame reached the scene while the async init was still running | `gl.ready` gate |
| Jump test (1 of 20) | ≤ 2/255 pixel differences | Alpha-blended low-opacity geometry rendered non-deterministically on the GPU (re-rendering the same state differed) | Fades use `alphaHash` (deterministic stipple dissolve) |
| Sweep tool | Screenshots lagged their targets | The settle hook resolved before the scroll event | The settle hook reads the scroll position itself |
| WebKit context test | 84 × "object does not belong to this context" | three's stale per-object dispose listeners from before the loss | On restore, drop the old objects and rebuild on a fresh canvas |
| Dispose test | 1 texture left after dispose | three r185 PMREM keeps an internal texture (`qa/probe/leak.html`) | `forceContextLoss()` after `renderer.dispose()` |
| iPad screenshots | Phone type sizes read small at 820 px | Missing portrait-tablet step | 52/38/18 px type for portrait screens ≥ 600 px wide |
| QA server | Page blocked after edits | The server cached a stale CSP | CSP re-read per request; `qa/csp.mjs --check` |
| Detail upgrade: init profile | TBT rose from ~130 ms to ~240 ms (4× CPU) | Many more geometry steps per part | Time-slicing: `slice()` yields whenever 8 ms have passed, between every sweep, extrusion and cog |
| Detail upgrade: Lighthouse | Performance 90–93, TBT 312–419 ms | Lighthouse's own trace showed one 85 ms observed task (×4 simulated): canvas-text textures drawn in one go, and binding a dummy PMREM render target (35 ms framebuffer allocation and check) during the shader warm-up | Textures drawn one per slice; the warm-up compiles the same variant with a temporary linear output colour space, binding no target. Result 97–99. |
| Detail upgrade: WebKit context test | 5 × "object does not belong to this context" | One shared lug geometry was a module constant and survived the rebuild after a context restore | Created per build: GPU resources are never shared across renderers |
| Detail upgrade: software GL | — | CPU rasterisers (SwiftShader, llvmpipe) spend ~800 ms on one 4×-MSAA frame of the detailed bike | The renderer's name is read once; on a software rasteriser the page rebuilds the renderer without MSAA at 1×. GPU devices are unaffected. |
| Hero redesign: Lighthouse | 95 / 96 / 89, TBT 228–430 ms (the pre-hero build scored 96–98 the same day) | The hero shows the whole bike, so all parts upload and draw inside the measured window; slice instrumentation then named the real cost: each rotor's 30 slots triangulated at 40 curve segments, 54–72 ms per wheel at 4× CPU | Rotor outline built from explicit polygons (72-point edges, 10-point slots); geometry uploaded one part per slice while the canvas is still hidden; frame tubes one per slice. Result 100 / 99 / 99. |
| User report (2026-11-12) | A large, heavy line drawing flashed before the 3D bike | The fallback poster was visible by default and hidden only once WebGL was ready (68 frames visible in the regression test, written first) | Poster hidden by default, shown only under `.no-webgl`, `.geometry-failed` or `.gl-lost`; lighter strokes; the spin hint is hidden when there is no 3D bike. The old hero copy in the report was a browser cache: GitHub Pages serves HTML with `max-age=600`. |
| User request (2026-11-12) | Wheels slid in sideways through the fork blades and stays; the cranks turned backwards; parts passed through each other | No check looked for interpenetration, and part paths were picked per part, not in workshop order. A new triangle-level scan (`qa/overlap.mjs`) found 102 interpenetrating mesh pairs over the scroll. Even the assembled bike had 54: chainrings through the drive-side chainstay, the spider 7 mm inside the BB shell, the rear hanger and cassette in the dropout, the crown in the down tube, chain rollers in the ring's teeth. | Wheels roll in along the line of travel (−Δx / R) onto slotted dropouts. The fork comes up from below. The cassette rides on the rear wheel. The non-drive crank comes from its own side, and the cranks pedal forward. The chain is solved link by link onto seated teeth and appears last. Parts dissolve on the frame in the take-apart. Model fixes: curved chainstays, a 74 mm BB shell, a docking crown, DTH 25 mm higher, hub faces at the OLD, a narrower 12-speed chain. Two regression tests (criteria 6 and 7). Framing: a moving part counts only with the travel still ahead in each window, so the bike stays at 78% of its size while both wheels roll in (71% with whole-stage travel boxes). |
| Full suite after the change | The hero drag test failed once in WebKit iPad (0.23 rad, needs > 0.3); 3 reruns passed | Pre-existing flake: Playwright's back-to-back pointer events give a huge release velocity, momentum adds several turns, and the stored yaw wraps to (−π, π] | The test reads the drag's own turn before release (it must equal 120 px × 2π / width to 1e-6), then lets momentum run for the return-to-spec checks |
| Live check on GitHub Pages | Bike blank at p = 1 in WebKit | (1) After an adaptive-quality step, `setSize()` cleared the canvas and no frame was scheduled. (2) Playwright's Windows WebKit cannot present a resized WebGL canvas at all: reproduced with raw WebGL, no three.js (`qa/probe/resize.html`); Chromium presents it. | `setQuality()` now schedules the redraw (regression test). The live check counts bike pixels, so a blank canvas fails. WebKit live checks lock quality; Chrome runs unlocked with a forced step. |

## 3. Notes on method (read before trusting a number)

1. **Identical** means byte-equal PNG screenshots with adaptive quality locked (`?qa=1`). The page
   state is a pure function of p, and settling snaps to the exact target.
2. **Within 10%** means 10% of each stage's own p-length (0.011–0.014 p). The test brackets each
   start and end boundary at ±10% and then bisects to report the measured value.
3. **Not clipped** uses each visible part's world bounding box projected through the real camera.
   That is conservative, larger than the silhouette.
4. **Dispose:** three's renderer counter still lists 1 texture after `dispose()`. It belongs to
   three r185's PMREM internals and is freed by the forced context loss, which the test asserts.
5. **Lighthouse and transfer** were measured against `qa/serve.mjs`, which reproduces nginx.conf
   (gzip level 6, cache headers, CSP), on 127.0.0.1. There is no deployed server or CDN.
6. **Frame timing** runs on a desktop GPU. CPU throttling slows the main thread, not the GPU.
7. **WebKit on Windows is not iOS Safari.** It cannot show a WebGL canvas after its drawing buffer is resized. So WebKit tests lock adaptive quality (`?qa=1`), and resize behaviour is verified in Chrome. iOS Safari is a different port that handles canvas resizes, but this is unverified without a device.

## 4. How to re-run

```bash
node qa/serve.mjs 4173 &                          # nginx look-alike (gzip, cache, CSP from nginx.conf)
node qa/csp.mjs --check                           # the CSP hashes match index.html
npx playwright test                               # geometry + story suites; projects webkit-iphone, webkit-ipad, chrome-desktop
npx lighthouse http://127.0.0.1:4173/index.html --only-categories=performance,accessibility,best-practices
node qa/overlap.mjs                               # interpenetration scan of the whole scroll (~10 s), -> qa/results/overlaps.json
node qa/frames.mjs mobile && node qa/frames.mjs desktop
node qa/contrast.mjs
node .claude/skills/design-taste-frontend/scripts/copy-lint.mjs index.html --kind product
```
A full Playwright run takes about 25 min. The jump and timing tests are 3–5 min per WebKit project.
