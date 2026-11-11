# Storyboard: p ∈ [0, 1] → scene

This file is the **spec**. `index.html` implements it as data (`STORY`) plus pure functions
(`state(p)`), and the QA suite parses the tables below to check the page against them. Where the
two differ, this file wins and the page is wrong.

## 1. Mechanics, derived from REFERENCE_NOTES.md

| Mechanic | Reference (measured) | Ours | Why the difference |
|---|---|---|---|
| Scroll driver | Native window scroll → one timeline | Native window scroll → one progress value **p**. No wheel or touch interception, no snapping. | Same |
| Total scroll range | 12.06 vh (desktop), 12.42 vh (mobile) | **10 × 100lvh**. The story section is 1100lvh; the sticky stage is 100lvh. | About 83%: six short beats and a 30-second reader on a phone flick. Units stay viewport-relative, so p-ranges hold on every device, as in the reference. |
| Chapter shape | Intro ≈ 0.09 p, five chapters ≈ 0.166 p each, outro hold ≈ 0.083 p | Hero hold 0.06 p, six stages of 0.11–0.15 p, finish 0.16 p (hold from 0.92) | Six parts, one stage each |
| Scroll → p | Piecewise linear across chapter markers | **Linear**: p = (scrollY − story top) / (story height − stage height), clamped to [0, 1]. The timing per stage lives in the tables below. | One mapping to test. The stage windows do the shaping. |
| Damping | Exponential follow, half-life ≈ 0.65 s | Exponential follow with **τ = 0.17 s**: half-life 0.118 s, 90% after 0.39 s. Snaps when \|Δp\| < 1e-4. | Responsive on a phone flick |
| Easing inside a stage | Keyframed bursts | Parts: easeOutCubic (the frame uses easeInOutCubic). Opacity: smoothstep over the first 30% of a stage. Camera: easeInOutSine between keys. | |
| Camera moves | A few eased bursts with holds; a big side swing in the middle; a still outro | Keyed azimuth and elevation (section 3). The big swing comes at the drivetrain, to show the drive side from the rear. Still from p = 0.92. | Same rhythm |
| Pinned element | Fixed canvas and sticky text blocks | Sticky stage (`position: sticky; top: 0; height: 100lvh`) holding the backdrop, the canvas and the beat panel. Beats cross-fade in place (section 4). | Text never runs over the bike (the reference's mobile defect) |
| Framing | `ViewBox` fits an animated box to the aspect | The camera fits a **framing volume** into a layout rect, which depends on aspect (DESIGN.md §4). The volume holds every pose its parts take. The fit is recomputed per frame from azimuth and elevation, and the principal point is moved with `setViewOffset`. Volumes grow as parts join (section 3a). | No clipping at any p; the frame fills the hero instead of floating small in the whole bike's volume |

## 2. Stages

Coordinates follow GEOMETRY.md: metres in the bike's frame (x forward, y up, z to the drive side).
Each part group's origin is its mounting joint (GEOMETRY.md §2): frame BB, fork CROWN, wheelF FA,
wheelR RA, drivetrain BB, handlebar STEM, saddle STT. The home position is that joint, in metres. A
start pose is the home position plus the offset, rotated by axis-angle about that joint. A part's local progress is
t = clamp((p − start) / (end − start)). Position and rotation follow e = ease(t), where
rotation(e) = slerp(start rotation, identity, e). Opacity is smoothstep(0, 0.3, t) for parts that
start at 0.

| id | part | p start | p end | start offset (m) | start rotation axis | start angle (deg) | start opacity | easing | extra motion |
|---|---|---|---|---|---|---|---|---|---|
| S1 | frame | 0.06 | 0.19 | (0, 0.06, 0) | (0, 1, 0) | -32 | 1 | easeInOutCubic | none |
| S2 | fork | 0.19 | 0.31 | (-0.0852, 0.2876, 0) | (0, 1, 0) | 0 | 0 | easeOutCubic | slides down the steering axis by 0.30 m |
| S3a | wheelF | 0.31 | 0.42 | (0, 0, 0.32) | (0, 1, 0) | 0 | 0 | easeOutCubic | wheel spins 450° → 0° about its axle |
| S3b | wheelR | 0.35 | 0.46 | (0, 0, 0.32) | (0, 1, 0) | 0 | 0 | easeOutCubic | wheel spins 450° → 0° about its axle |
| S4 | drivetrain | 0.46 | 0.60 | (0, 0, 0.26) | (0, 1, 0) | 0 | 0 | easeOutCubic | cranks turn −360° → 0° |
| S5 | handlebar | 0.60 | 0.72 | (-0.0625, 0.2109, 0) | (-0.28402, 0.95882, 0) | 70 | 0 | easeOutCubic | turns 70° about the steering axis while it drops 0.22 m |
| S6 | saddle | 0.72 | 0.84 | (-0.0682, 0.2301, 0) | (0, 1, 0) | 0 | 0 | easeOutCubic | slides down the seat tube by 0.24 m |

**Hold:** 0 ≤ p < 0.06 is the hero: frame only, at its start pose. 0.84 < p ≤ 1 is the finish:
the bike is whole and the camera settles by 0.92.

**Contact-shadow blob:** opacity = 0.8 × (eF + eR) / 2, where eF and eR are the wheels' eased
progress. There is no shadow under the floating frame; it grows in as the wheels land.

## 3. Camera keys

The target is the centre of the travel volume. Distance comes from the fit (section 1); vertical
FOV is 24°. Azimuth is measured from the drive-side profile (+z) towards the front (+x).
Between keys: easeInOutSine.

| p | azimuth (deg) | elevation (deg) | move |
|---|---|---|---|
| 0.00 | 34 | 14 | hero: front three-quarter, frame alone |
| 0.06 | 34 | 14 | hold until the first scroll beat |
| 0.19 | 18 | 10 | frame turns into place, camera eases round with it |
| 0.31 | 26 | 16 | slight rise to look down the head tube as the fork drops |
| 0.46 | 10 | 6 | low, near-profile view for the wheels |
| 0.60 | -22 | 10 | **big swing** to the rear three-quarter for the drivetrain |
| 0.72 | 20 | 17 | back to the front, high, for the cockpit |
| 0.84 | 8 | 11 | near-profile for the saddle |
| 0.92 | 16 | 9 | final view |
| 1.00 | 16 | 9 | hold (outro) |

## 3a. Framing volumes

The camera fits the current volume. At a volume's start p it blends from the previous volume to
this one over its blend length: target and distance, with smoothstep.

A volume covers the p window up to the next row. For each part, its contribution depends on its
own stage:
- **Travel box** (the union of its bounding boxes over every p in [0, 1], 48 samples) when its
  stage overlaps the window;
- **Home box** when its stage ended before the window;
- **Nothing** when its stage has not started yet.

So landed parts stop holding the camera back, and the bike stays large between stages.

| from p | volume | blend (p) |
|---|---|---|
| 0.00 | frame | 0 |
| 0.19 | frame (home) + fork | 0.018 |
| 0.31 | + front wheel | 0.0165 |
| 0.35 | + rear wheel | 0.0165 |
| 0.46 | + drivetrain | 0.021 |
| 0.60 | + handlebar | 0.018 |
| 0.72 | + saddle | 0.018 |
| 0.84 | assembled bike only | 0.08 |

Each blend is 15% of its stage. The last one tightens to the finished bike by p 0.92.

## 4. Beats (text panel)

Each beat's opacity is clamp((p − start) / 0.02) × clamp((end − p) / 0.02). The hero is full at
p = 0, and the finish never fades out. The windows touch end to start, so one beat is fully out
before the next one starts: **two beats are never visible together**.

| beat | p start | p end | heading |
|---|---|---|---|
| hero | 0.00 | 0.06 | Carbon road bike for racing and fast group rides |
| frame | 0.06 | 0.19 | Frame: 555 mm stack, 398 mm reach |
| fork | 0.19 | 0.31 | Fork: 44.4 mm offset |
| wheels | 0.31 | 0.46 | Wheels: 45 mm rims, 26 mm tyres |
| drivetrain | 0.46 | 0.60 | Drivetrain: 52/36 rings, 11–30 cassette |
| handlebar | 0.60 | 0.72 | Cockpit: 100 mm stem, 420 mm bar |
| saddle | 0.72 | 0.84 | Saddle height: 725 mm |
| finish | 0.84 | 1.00 | Seven frame sizes, 44 to 61 |

## 5. Backdrop (DESIGN.md §5)

All three layers use the same damped p.

| layer | x travel over p 0 → 1 | y travel over p 0 → 1 |
|---|---|---|
| far | 0 | −0.06 × viewport height |
| mid | −0.05 × viewport width | −0.18 × viewport height |
| fg | −0.50 × viewport width | 0 |

## 6. Reduced motion: five discrete states

Under `prefers-reduced-motion: reduce`, p snaps (no damping, no tween, static backdrop) to the
highest state whose threshold the scroll has passed:

| state | threshold (scroll p) | shown p | what is on screen |
|---|---|---|---|
| R1 | 0.00 | 0.00 | hero: frame alone |
| R2 | 0.24 | 0.31 | frame + fork |
| R3 | 0.40 | 0.46 | + both wheels |
| R4 | 0.66 | 0.72 | + drivetrain and cockpit |
| R5 | 0.88 | 1.00 | finished bike |

## 7. Checkpoints the QA uses

At p = 0, 0.25, 0.5, 0.75 and 1:
- **p = 0:** hero beat; frame at its start pose.
- **p = 0.25:** fork beat; the fork is 50% through its stage and fully opaque.
- **p = 0.5:** drivetrain beat; the drivetrain is 29% through and at 99% opacity.
- **p = 0.75:** saddle beat; the saddle is 25% through and at 93% opacity.
- **p = 1:** finish beat; every part at home and the camera at (16°, 9°).
