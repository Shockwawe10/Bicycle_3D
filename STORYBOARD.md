# Storyboard: p ∈ [0, 1] → scene

This file is the **spec**. `index.html` implements it as data (`STORY`) plus pure functions
(`state(p)`), and the QA suite parses the tables below to check the page against them. Where the
two differ, this file wins and the page is wrong.

## 1. Mechanics, derived from REFERENCE_NOTES.md

| Mechanic | Reference (measured) | Ours | Why the difference |
|---|---|---|---|
| Scroll driver | Native window scroll → one timeline | Native window scroll → one progress value **p**. No wheel or touch interception, no snapping. | Same |
| Total scroll range | 12.06 vh (desktop), 12.42 vh (mobile) | **11 × 100lvh**. The story section is 1200lvh; the sticky stage is 100lvh. | About 90%: a hero, a take-apart, six short stages and a finish. Units stay viewport-relative, so p-ranges hold on every device, as in the reference. |
| Chapter shape | Intro ≈ 0.09 p, five chapters ≈ 0.166 p each, outro hold ≈ 0.083 p | Hero 0.06 p, take-apart 0.06 p, six stages of 0.10–0.14 p, finish 0.16 p (hold from 0.92) | Six parts, one stage each, after a hero that shows the finished bike |
| Scroll → p | Piecewise linear across chapter markers | **Linear**: p = (scrollY − story top) / (story height − stage height), clamped to [0, 1]. The timing per stage lives in the tables below. | One mapping to test. The stage windows do the shaping. |
| Damping | Exponential follow, half-life ≈ 0.65 s | Exponential follow with **τ = 0.17 s**: half-life 0.118 s, 90% after 0.39 s. Snaps when \|Δp\| < 1e-4. | Responsive on a phone flick |
| Easing inside a stage | Keyframed bursts | Parts: easeOutCubic (the frame uses easeInOutCubic). Opacity: smoothstep over the first 30% of a stage. Camera: easeInOutSine between keys. | |
| Camera moves | A few eased bursts with holds; a big side swing in the middle; a still outro | Keyed azimuth and elevation (section 3). The camera is still in the hero; the visitor turns the bike instead (section 2b). The big swing comes at the drivetrain, to show the drive side from the rear. Still from p = 0.92. | Same rhythm |
| Pinned element | Fixed canvas and sticky text blocks | Sticky stage (`position: sticky; top: 0; height: 100lvh`) holding the backdrop, the canvas, the hero copy and the beat panel. Beats cross-fade in place (section 4). | Text never runs over the bike (the reference's mobile defect) |
| Framing | `ViewBox` fits an animated box to the aspect | The camera fits a **framing volume** into a layout rect. The hero rect is centred above the hero copy; the story rect depends on aspect (DESIGN.md §4). The rect blends from hero to story over the take-apart. The fit is recomputed per frame from azimuth and elevation, and the principal point is moved with `setViewOffset`. Volumes grow as parts join (section 3a). | No clipping at any p or any spin angle |

## 2. Stages

Coordinates follow GEOMETRY.md: metres in the bike's frame (x forward, y up, z to the drive side).
Each part group's origin is its mounting joint (GEOMETRY.md §2): frame BB, fork CROWN, wheelF FA,
wheelR RA, drivetrain BB, handlebar STEM, saddle STT. The home position is that joint, in metres. A
start pose is the home position plus the offset, rotated by axis-angle about that joint. A part's
local progress is t = clamp((p − start) / (end − start)). Position and rotation follow e = ease(t),
where rotation(e) = slerp(start rotation, identity, e). Opacity is smoothstep(0, 0.3, t) for parts
that start at 0.

| id | part | p start | p end | start offset (m) | start rotation axis | start angle (deg) | start opacity | easing | extra motion |
|---|---|---|---|---|---|---|---|---|---|
| S1 | frame | 0.14 | 0.24 | (0, 0.06, 0) | (0, 1, 0) | -32 | 1 | easeInOutCubic | none |
| S2 | fork | 0.24 | 0.35 | (0.0852, -0.2876, 0) | (0, 1, 0) | 0 | 0 | easeOutCubic | slides up the steering axis by 0.30 m: the steerer goes into the head tube from below, as on a real bike |
| S3a | wheelF | 0.35 | 0.45 | (0.30, 0, 0) | (0, 1, 0) | 0 | 0 | easeOutCubic | rolls in on the ground from the front: turns −51.0° → 0° about its axle (−0.30 m / 0.337 m: no slip) |
| S3b | wheelR | 0.39 | 0.49 | (-0.30, 0, 0) | (0, 1, 0) | 0 | 0 | easeOutCubic | rolls in on the ground from behind, the cassette on its hub: turns +51.0° → 0° |
| S4 | drivetrain | 0.49 | 0.62 | (0, 0, 0.26) | (0, 1, 0) | 0 | 0 | easeOutCubic | the cranks turn forward, +360° → 0°, by 0.8 of the stage; the non-drive arm comes from its own side; the chain fades in over 0.9–1.0 |
| S5 | handlebar | 0.62 | 0.73 | (-0.0625, 0.2109, 0) | (-0.28402, 0.95882, 0) | 70 | 0 | easeOutCubic | turns 70° about the steering axis while it drops 0.22 m |
| S6 | saddle | 0.73 | 0.84 | (-0.0682, 0.2301, 0) | (0, 1, 0) | 0 | 0 | easeOutCubic | slides down the seat tube by 0.24 m |

**Finish:** 0.84 < p ≤ 1. The bike is whole and the camera settles by 0.92.

**Wheels roll.** Each wheel comes in along the bike's own line of travel, on the ground: the front one from ahead,
backwards into the fork; the rear one from behind, forwards into the frame. Its turn is −offset / R (R = 337 mm, the
tyre's radius), so the tyre does not slip. The axle slides into slotted dropouts (GEOMETRY.md section 2).

**Drivetrain, in workshop order** (t is the stage's local progress):
- The drive side (spindle, rings, spider, drive-side arm and pedal) and both derailleurs come from the drive side, the
  start offset above. The non-drive arm and pedal come from the other side, start offset (0, 0, −0.26), and clamp onto
  the spindle.
- The cranks pedal **forward**: clockwise seen from the drive side, +360° → 0°, angle = 360° × (1 − easeOutCubic(t / 0.8)).
  They stop at t = 0.8.
- The **chain** appears last, in place: opacity = smoothstep(0.9, 1.0, t). By then the cranks are still and the drive
  side is within 0.26 mm of home. A closed chain cannot be moved onto a cassette and a ring without passing through the
  other cogs, so it is not moved.
- The cassette is part of the rear wheel (S3b): a cassette cannot reach a hub through a dropout.

**Contact-shadow blob:** opacity = 0.8 × the mean over both wheels of (1 − k) × opacity, where k is
0 at home and 1 at the start pose. The full shadow shows under the hero bike, fades as the wheels
leave, and returns as they land.

## 2a. Hero and take-apart

| window | p | what happens |
|---|---|---|
| Hero | 0.00 – 0.06 | **The finished bike**: every part at home, opacity 1. It is centred above the big title (DESIGN.md §9), and the camera is still at (20°, 5°). |
| Take-apart | 0.06 – 0.12 | The frame turns to its start pose, k = easeInCubic(u) with u = (p − 0.06) / 0.06. Every other part **stays mounted on the frame**, moving with it, and dissolves: opacity = 1 − smoothstep(0, 0.6, u). From u = 0.6 it is invisible and waits at its start pose. The layout rect blends from the hero rect to the story rect with smoothstep(0.06, 0.12, p). |
| Hold | 0.12 – 0.14 | The frame alone at its start pose. The frame beat fades in. |

Why mounted: the chain links the cranks to the cassette and the wheels sit in the fork and frame, so no part can
leave along its own path while the others are still there. Mounted, nothing moves against anything else, so nothing
passes through anything while the bike comes apart (section 2c).

All parts dissolve together during the take-apart (one opacity), no assembly fade starts before 0.12, and the chain's
own fade (S4, 0.9–1.0 of the stage) overlaps no other fade. So one shared set of fade materials stays valid; the page
asserts this at startup.

## 2c. No part passes through another

At every p, no two parts share space: separate parts touch and never interpenetrate. The only exceptions are a shaft
in its bore (steerer, BB spindle, seatpost), and only while the shaft slides along or turns about its own axis
(GEOMETRY.md section 6). The QA scans the whole range triangle against triangle and moves no part more than 1 mm
between two samples (`qa/overlap.mjs`, `qa/tests/overlap.spec.mjs`).

## 2b. Drag-to-spin (hero only)

- **Who moves:** the visitor turns the bike about its own vertical axis, through the wheelbase
  centre on the ground. The camera does not move. Only horizontal motion counts: a full screen
  width of drag is one turn. Vertical swipes scroll the page natively (`touch-action: pan-y`).
- **When:** a drag can start while the shown p < 0.06, and only on the canvas.
- **Momentum:** after release the spin keeps its velocity with exponential decay, τ = 0.45 s, and
  stops below 0.02 rad/s. Under reduced motion there is no momentum.
- **Back to the spec:** the applied yaw = user yaw × (1 − smoothstep(0.04, 0.10, p)), so it reaches
  0 before the story needs the spec poses. Scrolling back up shows the visitor's angle again.
- **Determinism:** with no drag, yaw is 0 and every scroll-only check below applies unchanged.
- **Entrance:** on first reveal the bike swings once from −0.45 rad to 0 (momentum decay), so it
  reads as a 3D object you can turn. Skipped with `?qa` and under reduced motion.
- **Framing while spinning:** the hero volume is a 24-sided ring around the axis, as tall as the
  bike and with the bike's turning radius. It fits at every spin angle.

## 3. Camera keys

The target is the centre of the travel volume. Distance comes from the fit (section 1); vertical
FOV is 24°. Azimuth is measured from the drive-side profile (+z) towards the front (+x).
Between keys: easeInOutSine.

| p | azimuth (deg) | elevation (deg) | move |
|---|---|---|---|
| 0.00 | 20 | 5 | hero: eye-level three-quarter view of the finished bike |
| 0.06 | 20 | 5 | hold through the hero |
| 0.12 | 34 | 14 | rise and swing to the front three-quarter while the bike comes apart |
| 0.14 | 34 | 14 | hold on the frame alone |
| 0.24 | 18 | 10 | frame turns into place, camera eases round with it |
| 0.35 | 26 | 16 | slight rise to look down the head tube as the fork drops |
| 0.49 | 10 | 6 | low, near-profile view for the wheels |
| 0.62 | -22 | 10 | **big swing** to the rear three-quarter for the drivetrain |
| 0.73 | 20 | 17 | back to the front, high, for the cockpit |
| 0.84 | 8 | 11 | near-profile for the saddle |
| 0.92 | 16 | 9 | final view |
| 1.00 | 16 | 9 | hold (outro) |

## 3a. Framing volumes

The camera fits the current volume. At a volume's start p it blends from the previous volume to
this one over its blend length: target and distance, with smoothstep.

A volume covers the p window up to the next row. For each part, its contribution depends on its
own stage:
- **Travel box** when its stage overlaps the window: the union of its bounding boxes over the part of its stage that
  lies in the window (sampled every 1/96 p, plus both ends). The path a part has already covered stops holding the
  camera back: at 0.39 the front wheel is 78% home, so the window from 0.39 frames its last 65 mm, not 300;
- **Home box** when its stage ended before the window;
- **Nothing** when its stage has not started yet.

So landed parts stop holding the camera back, and the bike stays large between stages.

| from p | volume | blend (p) |
|---|---|---|
| 0.00 | spin ring: the assembled bike's turning radius and height (section 2b) | 0 |
| 0.06 | what is on screen in the take-apart: the parts dissolving on the turning frame (13 samples) | 0.03 |
| 0.12 | frame | 0.02 |
| 0.24 | frame (home) + fork | 0.0165 |
| 0.35 | + front wheel | 0.015 |
| 0.39 | + rear wheel | 0.015 |
| 0.45 | the front wheel has landed: its home box | 0.015 |
| 0.49 | + drivetrain | 0.0195 |
| 0.62 | + handlebar | 0.0165 |
| 0.73 | + saddle | 0.0165 |
| 0.84 | assembled bike only | 0.08 |

Each stage blend is 15% of its stage. The last one tightens to the finished bike by p 0.92.

## 4. Beats (text panel)

Each beat's opacity is clamp((p − start) / 0.02) × clamp((end − p) / 0.02). The hero is full at
p = 0, and the finish never fades out. The windows never overlap, so one beat is fully out before
the next one starts: **two beats are never visible together**. Between 0.06 and 0.12 the take-apart
plays with no text.

| beat | p start | p end | heading |
|---|---|---|---|
| hero | 0.00 | 0.06 | Carbon road bike for racing and fast group rides |
| frame | 0.12 | 0.24 | Frame: 555 mm stack, 398 mm reach |
| fork | 0.24 | 0.35 | Fork: 44.4 mm offset |
| wheels | 0.35 | 0.49 | Wheels: 45 mm rims, 26 mm tyres |
| drivetrain | 0.49 | 0.62 | Drivetrain: 52/36 rings, 11–30 cassette |
| handlebar | 0.62 | 0.73 | Cockpit: 100 mm stem, 420 mm bar |
| saddle | 0.73 | 0.84 | Saddle height: 725 mm |
| finish | 0.84 | 1.00 | Seven frame sizes, 44 to 61 |

The hero beat sits in its own centred block beneath the bike; the others sit in the story panel.

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
| R1 | 0.00 | 0.00 | hero: the finished bike (drag still turns it, without momentum) |
| R2 | 0.20 | 0.35 | frame + fork |
| R3 | 0.44 | 0.49 | + both wheels |
| R4 | 0.68 | 0.73 | + drivetrain and cockpit |
| R5 | 0.88 | 1.00 | finished bike |

## 7. Checkpoints the QA uses

At p = 0, 0.25, 0.5, 0.75 and 1:
- **p = 0:** hero beat; **every part at home and opaque** (the finished bike); the camera at (20°, 5°).
- **p = 0.25:** fork beat; the fork is 9% through its stage and at 22% opacity.
- **p = 0.5:** drivetrain beat; the drivetrain is 8% through and at 16% opacity.
- **p = 0.75:** saddle beat; the saddle is 18% through and at 66% opacity.
- **p = 1:** finish beat; every part at home and the camera at (16°, 9°).
