# Reference notes: Needle "Bike Scrollytelling – Responsive 3D"

Measured on 2026-11-11, mechanics and timing only. None of its code, assets, copy or branding is
reused. Our palette, type, lighting and backdrop are our own (see DESIGN.md).

- Gallery page: `https://engine.needle.tools/samples/bike-scrollytelling-responsive-3d/?room=needle358`.
  It only wraps the sample in an iframe, so every measurement below was taken on the iframe's own URL,
  `https://scrollytelling-bike-z23hmxb2gnu5a.needle.run/?room=needle358`, loaded full-window.
- Browser: Playwright 1.62.1 driving Chrome 151, headless on the real GPU (ANGLE D3D11, RTX 3050 Ti).
  Two viewports:
  - **Desktop:** 1440×900, DPR 1.
  - **Mobile:** Chrome's "iPhone 13" emulation: 390×664 visible, DPR 3, touch.
- Method: the scripts read the live Needle runtime (`document.querySelector('needle-engine').context`):
  - the `PlayableDirector` timeline: its tracks, clips and markers;
  - the `ScrollFollow` and `ViewBox` component fields;
  - the camera's world pose;
  - DOM rects and computed styles.

  Every value was taken after `scrollTo()` and a wait for the damped timeline to settle.
- Scripts: `qa/ref-explore.mjs`, `qa/ref-components.mjs`, `qa/ref-measure.mjs`, `qa/ref-markers.mjs`,
  `qa/ref-chapters.mjs`, `qa/ref-snap.mjs`. Raw data: `qa/reference/desktop.json` and `mobile.json`.
- Screenshots at 0/25/50/75/100% scroll: `qa/reference/{desktop,mobile}-p{000,025,050,075,100}.png`,
  with contact sheets in `qa/reference/sheet-desktop.png` and `sheet-mobile.png`.

## 1. Architecture (what drives what)

| Piece | Measured |
|---|---|
| Scroll source | Native window scroll. `ScrollFollow { mode: "window", damping: 0.5, invert: false }` maps window scroll onto one timeline. No wheel or touch interception (`touch-action: auto`). |
| Timeline | `PlayableDirector` with a duration of 30.03 s and these tracks: Markers, bike animation (0–9.97 s, then a 17.5 s "loop" clip), a `ViewBox` animation (0–30.03 s), camera (0–29.28 s), two activation tracks (outro prop 28.3–30.03 s, a point light 13.35–18.42 s) and three more animation tracks. |
| Scroll → time mapping | **Piecewise linear across chapters.** Each chapter `<div class="section" data-timeline-marker="T">` pins its own scroll position to timeline time T. The markers are 0, 15.2, 15.4, 18.2, 24.5 and 29 s. Between markers, time follows scroll linearly. Time therefore deviates from a single linear mapping by up to 0.25 of the duration. |
| Damping | Exponential follow. After a jump from p=0 to p=0.5, the timeline covered 50% of the distance in **683 ms**, 90% in **1466 ms** and 99% in **2434 ms** (mobile: 649 / 1433 / 2400 ms). That is a half-life of about 0.65 s, which feels floaty. |
| Framing | A `ViewBox` component (`referenceFieldOfView: 20`, `mode: continuous`) fits an animated box into whatever aspect the window has. Camera FOV stays 20°. The camera's world positions are identical on desktop and mobile, so the fit happens in the projection, not by moving the camera. |
| Sticky / pinned | The `<needle-engine>` canvas is `position: fixed`, full viewport, `pointer-events: none`. Each chapter's text block is `position: sticky; top: 0` inside its 200vh chapter. It scrolls in, sticks for about 1.5 viewports, then scrolls out. |
| Snap | `html { scroll-snap-type: both; scroll-behavior: smooth }`, but no element has `scroll-snap-align`, so no snapping actually happens. |
| Reduced motion | No `prefers-reduced-motion` rule in any stylesheet. |

## 2. Total scroll length

| Viewport | Document | Scroll range (scrollHeight − innerHeight) | Chapter height |
|---|---|---|---|
| Desktop 1440×900 | 11 750 px = 13.06 vh | **10 850 px = 12.06 vh** | intro 900 px (1 vh), chapters 1800 px (2 vh) |
| Mobile 390×664 | 8 914 px = 13.42 vh | **8 250 px = 12.42 vh** | intro 697 px (1.05 vh), chapters 1361 px (2.05 vh) |

Chapters are sized in viewport units, so their p-ranges come out almost identical on every
viewport (next table). That is the property worth copying.

## 3. Stage p-ranges (p = scrollY / scroll range)

A chapter starts when its top reaches the top of the viewport. Times are interpolated from 101
settled samples. Values are desktop; mobile is within ±0.004 in p.

| Chapter (their title) | p-range | Timeline time | Camera travel | Camera move |
|---|---|---|---|---|
| intro ("…Bike") | 0.000–0.088 | 0.00 → 5.06 s | 1.20 m | Dolly in from a 3/4 front view (−1.70, 0.78, 1.60) towards the head tube. |
| ch1 ("Intro") | 0.088–0.253 | 5.06 → 14.83 s | 4.30 m | Slow push in; around p 0.16–0.21 it pulls back to (−1.32, 0.56, 3.08), then settles close on the front wheel. |
| ch2 ("Wheel Front") | 0.253–0.419 | 14.83 → 16.60 s | 10.75 m | **The big move.** It swings out to a far side view (x −5.8 at p 0.40) while the bike explodes into parts. Time barely advances here (1.8 s across 2 vh), so it is mostly a read-hold with one sweep. |
| ch3 ("Frame") | 0.419–0.585 | 16.60 → 20.51 s | 6.40 m | Comes back in to a close, high view of the frame (dark lighting state), then eases out. |
| ch4 ("Suspension") | 0.585–0.751 | 20.51 → 26.14 s | 1.38 m | Gentle pull back as the parts reassemble. |
| ch5 ("Overview") | 0.751–0.917 | 26.14 → 29.60 s | 2.14 m | Wide 3/4 view, ending in a side view (−2.55, 0.68, 1.17). |
| outro | 0.917–1.000 | 29.60 → 29.82 s | 0.00 m | **Hold.** The camera is still and the outro prop pops in (activation 28.3 s). |

Camera speed per 1% of p comes in bursts: p 0.16–0.21, 0.33–0.47 and 0.84–0.88, with near-holds
between. That is a keyframed path with eased bursts, not a uniform orbit.

## 4. Easing

The ease has two layers.
1. Scroll position maps to time linearly within a chapter (piecewise linear).
2. The damped follow adds an exponential ease-out (half-life ≈ 0.65 s) to every scroll change.

The camera's keyframes accelerate and decelerate inside each burst. The result feels smooth but
laggy: on a fast flick the bike keeps moving for about 1.5 s after the finger stops.

## 5. Mobile versus desktop

- **Same 3D:** the timeline, the camera path and the chapter p-ranges are the same; chapters stay
  ~2 vh tall.
- **Text:** headings drop from 96 px to 48 px (32 px in the last two chapters). Blocks go from
  624 px wide at x=72 to 328 px wide at x=20.
- **Layout:** desktop puts the text column on the left with the bike to its right. Mobile stacks
  the text in the top half, and `ViewBox` reframes the bike into the bottom half.
- **Defect worth avoiding:** on mobile at p 0.25 and 0.50, the exploded parts render over and behind
  the paragraph text (see `mobile-p025.png` and `mobile-p050.png`). Our layout must keep the text and
  the bike in separate regions.
- **Resolution:** the renderer runs at the full DPR of 3 on the phone emulation; there is no DPR cap.

## 6. Page weight and frame behaviour

| | Desktop | Mobile |
|---|---|---|
| Transfer (encoded) | **8 377 KB**, 64 requests | **9 552 KB**, 79 requests |
| Biggest items | GLB 6.6 MB in total (the 2.5 MB bike GLB is fetched twice), JS 1.2 MB (three r169 at 253 KB, app 409 KB), Basis transcoder WASM 516 KB, Draco 145 KB | Same, plus larger mobile textures (one at 591 KB) |
| Scene | 320 meshes, 117 k triangles, 37 materials, 3 lights, **shadow maps on**, AgX tone mapping, environment map | Same |
| Idle rendering | **Renders every frame while idle:** about 26.7 k draw calls/s at rest versus 26.7 k while scrolling (about 440 per frame) | About 24 k/s idle |
| Frame time during a scripted 6 s scroll | p50 16.7 ms, p95 16.8 ms, 100% under 20 ms (desktop RTX GPU, vsync-bound) | Same on the desktop GPU; not representative of a phone |

## 7. What we take, and what we do differently

We take these mechanics:
- native scroll driving one normalized progress value;
- stages sized in viewport units, so p-ranges hold across devices;
- a few eased camera bursts separated by holds;
- a damped follow;
- a fixed, full-viewport, pointer-transparent canvas behind the text;
- an outro hold of about 8% of p with the camera still;
- a total scroll range in the 10–12 vh class.

We change these on purpose:

| Reference | Ours | Why |
|---|---|---|
| Damping half-life ≈ 0.65 s | About 0.12 s half-life (90% in about 0.4 s) | Feels responsive on a phone flick and still smooth. |
| Text blocks scroll over the bike on mobile | Fixed text and bike regions per aspect (portrait: bike on top, beat below) | Removes the overlap defect. |
| Renders every frame | Renders only while p is moving, on resize, or while visible | Battery, thermals and frame budget. |
| 8.4–9.6 MB, shadow maps, 117 k triangles | ≤ 600 KB gzip in total, procedural geometry, one contact-shadow blob | The brief's budget. |
| Uncapped DPR 3 on phones | DPR ≤ 1.5 on touch devices, adaptive below that | Fill rate on iPhone. |
| No reduced-motion path | Five discrete states | WCAG 2.3.3 intent, and the brief. |
| Disassembly story (whole → exploded → whole) | Assembly story (frame → fork → wheels → drivetrain → handlebar → saddle → finished) | The brief. |
