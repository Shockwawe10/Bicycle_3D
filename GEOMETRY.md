# Geometry source and joint table

Every bike part in `index.html` is built from the numbers below. No downloaded models are used.

## 1. Published chart

**Specialized Tarmac SL7 frameset, model years 2021 and 2022.** The figures are published by
specialized.com and reproduced, with the source named, on Bike Insights:
- [2021 SL7 frameset, size 56](https://bikeinsights.com/bike-geometries/5f207b42a38eb600178e63a0-2021-specialized-bicycles-tarmac-sl7-frameset-56)
- [2022 SL7 frameset, all sizes](https://bikeinsights.com/bikes/5c670d973584300017e37aa3-specialized-bicycles-tarmac?build=sl7-frameset&version=2022)

We build **size 56**. The brand on the page is fictional; this chart is used only as engineering
input.

| Row | 44 | 49 | 52 | 54 | **56** | 58 | 61 |
|---|---|---|---|---|---|---|---|
| Stack (mm) | 491 | 504 | 517 | 534 | **555** | 581 | 602 |
| Reach (mm) | 369 | 378 | 383 | 387 | **398** | 405 | 411 |
| Head tube length (mm) | 93 | 102 | 113 | 131 | **151** | 178 | 198 |
| Head tube angle (°) | 70.5 | 71.75 | 72.5 | 73 | **73.5** | 73.5 | 74 |
| Seat tube angle (°) | 75.5 | 75.5 | 74 | 74 | **73.5** | 73.5 | 73 |
| Chainstay (mm) | 410 | 410 | 410 | 410 | **410** | 410 | 410 |
| BB drop (mm) | 74 | 74 | 74 | 72 | **72** | 72 | 72 |
| Wheelbase (mm) | 970 | 973 | 975 | 978 | **991** | 1006 | 1013 |
| Front centre (mm) | 572 | 574 | 577 | 579 | **592** | 606 | 613 |
| Fork offset (mm) | 47.2 | 47.4 | 46.8 | 44.1 | **44.4** | 44.7 | 44.6 |
| Axle to crown (mm) | 366 | 366 | 366 | 366 | **366** | 366 | 366 |
| Trail (mm) | 69.3 | 61.2 | 57.2 | 56.9 | **53.5** | 53.2 | 50.2 |
| Tyre width / outer diameter (mm) | 26 / 674 | ← | ← | ← | **26 / 674** | ← | ← |

Size 56 only, from the 2021 page: seat tube 496 mm, effective top tube 563 mm, top-tube slope 8.4°,
standover 786 mm.

**Wheel:** 700c, ETRTO **26-622** tyre on a 622 mm bead-seat-diameter (BSD) rim, which gives an outer
diameter of 622 + 2 × 26 = **674 mm**, the chart's own figure.

## 2. Joint-coordinate table (size 56)

- **Frame:** x forward, y up, z to the rider's right (the drive side). The origin is the bottom-bracket
  centre. Units are mm; the scene uses metres.
- **Directions:**
  - steering axis down: d = (cos 73.5°, −sin 73.5°)
  - its forward normal: n = (sin 73.5°, cos 73.5°)
  - seat tube up: s = (−cos 73.5°, sin 73.5°)
- **Script:** `node qa/derive-joints.mjs` prints this table. The page derives the same joints at
  startup, and `qa/tests/geometry.spec.mjs` asserts the two agree to 0.1 mm.

| Joint | Meaning | Derivation | x (mm) | y (mm) |
|---|---|---|---:|---:|
| BB | Bottom-bracket centre | origin | 0.00 | 0.00 |
| RA | Rear axle (dropouts) | (−√(cs² − drop²), drop) | −403.63 | 72.00 |
| FA | Front axle (fork dropouts) | HTT + (HT + A2C)·d + offset·n | 587.41 | 71.90 |
| HTT | Head-tube top (stack, reach) | (reach, stack) | 398.00 | 555.00 |
| HTB | Head-tube bottom | HTT + HT·d | 440.89 | 410.22 |
| CROWN | Fork crown | = HTB (zero lower stack) | 440.89 | 410.22 |
| DTH | Down tube meets head tube | HTB − 25·d | 433.79 | 434.19 |
| STT | Seat-tube top | ST·s | −140.87 | 475.57 |
| SSJ | Seat stays meet seat tube | STT − 30·s | −132.35 | 446.81 |
| STEM | Stem clamp on steerer | HTT − 35·d | 388.06 | 588.56 |
| BAR | Handlebar clamp | STEM + 100 mm at −6° to the steerer normal | 486.38 | 606.78 |
| POST_TOP | Seatpost clamp | 685·s | −194.55 | 656.79 |
| SADDLE | Saddle top | 725·s | −205.91 | 695.14 |

Out-of-plane (z) placements, in mm:
- **Chainstays:** ±35 at the BB, ±65 at RA.
- **Seat stays:** ±12 at SSJ, ±65 at RA.
- **Fork legs:** ±46 at the crown, ±50 at FA.
- **Hub spacing (OLD):** front 100, rear 142.
- **Chainline:** +45 (outer ring).
- **Cassette:** +60 at the 11T cog, down to +20.4 at the 30T, at a 3.6 mm pitch.
- **Rotors:** front −42, rear −55 (non-drive side).

## 3. Derived checks (startup assertion)

| Derived from joints | Value | Chart | Δ |
|---|---:|---:|---:|
| Wheelbase = FA.x − RA.x | 991.04 | 991 | +0.04 |
| Front centre = \|FA − BB\| | 591.79 | 592 | −0.21 |
| Head angle = atan2(HTT − HTB) | 73.50° | 73.5° | 0.00 |
| Wheel (tyre) diameter = BSD + 2 × width | 674.00 | 674 | 0.00 |
| Trail = (R·cos HA − offset) / sin HA | 53.53 | 53.5 | +0.03 |
| Top-tube slope (HTT to STT) | 8.39° | 8.4° | −0.01 |
| Effective top tube | 562.40 | 563 | −0.60 |
| Wheelbase / wheel diameter | 1.4704 | 970/674 … 1013/674 = 1.4392 … 1.5030 | in range |

At startup, `validateGeometry()` in `index.html` measures the **built** scene rather than the input
numbers: wheel-group axle positions and the tyre's bounding box. It fails the page if any of these
holds:
- the wheelbase is outside the chart's size range, **970–1013 mm**;
- the wheel diameter is outside **674 mm ± 0.5%**, the chart's single tyre spec;
- wheelbase / wheel diameter is outside **1.4392–1.5030**;
- the head angle is outside the chart's range, **70.5–74.0°**;
- front centre or trail differ from the size-56 column by more than **±1 mm**.

On failure it logs the violations, marks `window.__bike.geometryOK = false` and shows the static
poster. A test feeds it a broken chart (head angle 80°) and expects that rejection.

## 4. Component assumptions (not on the frame chart)

| Item | Value | Basis |
|---|---|---|
| Rim | 622 BSD, 21 mm internal, 28 mm external, 45 mm deep; flange 6 mm above bead seat | Common carbon road rim |
| Spokes | Front 24, radial; rear 24, two-cross; 2 mm | Common road wheel |
| Hub flanges | Front Ø44 at ±32; rear Ø48 at +20 (drive) and −30 | Typical road disc hubs |
| Drivetrain | 52/36 rings, 11–30 12-speed cassette, 12.7 mm chain pitch, 170 mm cranks, chain on 52 × 15 | 2021 size-56 page lists 170 mm cranks |
| Cockpit | Stem 100 mm at −6°, 35 mm of spacers and stem stack, bar 420 mm wide, 75 mm reach, 125 mm drop | 2021 size-56 page lists a 100 mm stem |
| Saddle | 725 mm saddle height (BB to top along the seat tube), 260 × 143 mm saddle | Rider of about 1.76 m |
| Rotors | 160 front, 140 rear | Road disc standard |

Chainring pitch radius: r = 12.7 / (2·sin(π/N)). That gives 105.17 mm for 52T, 72.86 mm for 36T and
30.54 mm for the 15T cog.

## 5. Part shapes (detail level)

Every part is still built in code from the joints above. The joints, wheel and drivetrain
numbers are unchanged, and only the shapes got richer (`index.html` section 4):

| Part | Shape |
|---|---|
| Frame tubes | Profile sweeps between joints: superellipse sections, tapered along each tube. Down tube 49→62 mm deep, widening into the BB; head tube 54→62 mm, tapered; flattened top tube; truncated seat tube; dropped seat stays meeting the seat tube 30 mm below its top; boxier drive-side chainstay. Ellipsoid lugs blend the junctions. VARSEN wordmark on both sides of the down tube. |
| Fork | Aero blades swept along a slightly forward-bowed path (38→21 mm deep), a blended crown, moulded dropouts, flat-mount caliper |
| Wheels | Torus tyre (26-622) with a bump-mapped file tread; deep rim lathed from a hooked profile with rim decals; lathed hub with flanges; 24 **bladed** spokes and 24 nipples per wheel (instanced); valve; slotted rotor (30 slots) on a six-arm carrier; thru-axle with lever |
| Drivetrain | Forged-look crank arms (bevelled hull outline); four-arm spider with bolts; 52/36 rings; 12 cogs on a carrier; chain of alternating outer and inner plates plus rollers on every 12.7 mm pin (instanced); rear derailleur hanger, knuckle, link, cage plates and toothed pulleys; front derailleur cage following the 52T ring |
| Cockpit | One-piece bar and stem: aero-flat tops blending into a round, tape-wrapped (bump-mapped) drop; hoods seated on the forward bend; levers following the drop; headset spacers and top cap |
| Saddle | Lofted padded shell over a carbon base, swept along a slightly curved axis (143 mm tail, 34 mm nose); curved steel rails; aero seatpost; two-bolt clamp |

Budget at p = 1: **148k triangles, 119 draw calls** (iPhone target ≤ 250k).
