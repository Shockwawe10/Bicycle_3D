# Design: Varsen road-bike landing

**Decision: variant C, "Drawing sheet".** Putty and teal palette, Zilla Slab headings with
Rethink Sans for text, bike-over-text on portrait, bike-left / text-right on landscape, and a
drafting backdrop in three parallax layers.

- **Reader:** a studio lead who opens the page on an iPhone and then on a laptop, and decides
  within about 30 seconds whether this developer ships polished work.
- **The page's one idea:** *this bike is built from a real geometry chart, to the millimetre.*
- **Brand:** Varsen, a coined name searched first (`names.json`). It imitates no real brand.

## 1. Three variants

The palettes and type pairings are the design skill's dealt options for a consumer product
(`start.mjs deal --page product`). The layouts and backdrops are three different directions.
Every comp uses the real procedural bike from Phase 1, rendered in that comp's paint
(`qa/render-bike.mjs`), the same copy, and the same two screens: the hero, then stage 3 (wheels).

| | A: Split | B: Spec band | C: Drawing sheet |
|---|---|---|---|
| Palette | sky-sand: `#cbe4f2` ground, ink `#0a0a0a`, magenta `#b0298f` | moss-sand: `#ddd6c6` ground, ink `#2a2a26`, olive `#4f6238` | putty-black-teal: `#dedad3` ground, ink `#0a0a0a`, teal `#256f82` |
| Type | Bricolage Grotesque, Figtree | Archivo, width 118% | Zilla Slab, Rethink Sans |
| Landscape layout | Text column left, bike right | Headline band on top, bike centred, spec band at the bottom | Bike left with a dimension line, text column right with a spec table |
| Portrait layout | Bike on top, text below | Headline on top, bike in the middle, 2×2 specs at the bottom | Bike on top with a dimension line, text panel below |
| Backdrop | Soft sun, rolling hills, road dashes | Contour lines, road elevation profile, ground ticks | Drafting grid, construction circles, ruler ticks |
| Comp | `qa/comps/variant-a.html` | `qa/comps/variant-b.html` | `qa/comps/variant-c.html` |
| Screenshots | `variant-a-390x844.png`, `variant-a-1440x900.png` | `variant-b-*` | `variant-c-*` |

Contact sheets: `qa/comps/sheet-390.png` (WebKit, 390×844) and `qa/comps/sheet-1440.png`
(Chrome, 1440×900). Measured with `qa/comps/shoot-comps.mjs`:

| Check | A | B | C |
|---|---|---|---|
| Lowest text contrast (WCAG) | 5.90 (button) | 5.32 (sub-line) | **4.10 (teal stage label: fails AA)** → 5.70 with the text-teal `#1d5866` |
| Horizontal scroll at 390 / 1440 | none / none | none / none | none / none |
| Text over the bike at 390 | none, **but the bike is clipped** at the left edge (112vw) | none | none |
| Text over the bike at 1440 | **yes:** the rear wheel runs under the headline and sub-line | sub-line touches the saddle | none |
| Regions needed on a phone | 2 | 3 (headline, bike, specs). The bike gets about 40% of the small viewport. | 2 |
| Latin web-font bytes before subsetting | 94.8 KB, 2 files | 88.0 KB, 1 file | 86.5 KB, 3 files |
| Says "built to the chart" | no (generic landscape) | partly (spec band) | **yes** (grid, construction circles, dimension line, spec table) |

## 2. Why C

1. **It carries the page's one idea.** The drafting grid, the construction circles (two wheel
   circles and the 73.5° steering line) and the dimension line under the bike all say "drawn from
   the chart". A and B decorate; C explains. In 30 seconds, the explanation is what reads as
   craft.
2. **It is the steadiest layout on an iPhone.**
   - Two regions only: bike on top, text panel below.
   - The bike region is sized to the *small* viewport, so it never lands under Safari's toolbar.
   - B's three regions squeeze the bike once the address bar shows.
   - A clipped the bike.
3. **No text over the bike at either size.** A fails at 1440 and B touches. Brief and test
   criterion: no overlapping text, no clipped bike.
4. **Its one contrast failure is a token, not a layout.** Teal text moves to `#1d5866` (5.70:1).
   The `#256f82` teal stays for fills and buttons (white on it: 5.71:1).
5. **The slab suits a maker.** The skill lists Zilla Slab for "workshops, bike shops, outfitters".
   Set at 400 weight with tight tracking, it reads as engineered, and it sits apart from
   the grotesk most bike brands use. The cost is equal to the others.

What we drop, and why:
- **A:** its pastel and magenta read as a consumer gadget, not a precision frame.
- **B:** its headline band is the strongest landscape layout, but the phone comes first.
  B's best idea, a row of hard numbers, lives on in C as the per-stage spec table.

The design skill's instruction is to "take the first palette and pairing", which is A. The brief
asks for three comps and a reasoned choice, so the brief wins. The reasons are the measurements
above.

## 3. Tokens

```css
:root {
  --bg: #dedad3;        /* putty ground (skill palette putty-black-teal) */
  --surface: #d3cec6;
  --ink: #0a0a0a;       /* 15.0:1 on --bg */
  --muted: #55514c;     /* 5.64:1 on --bg, body and labels */
  --accent: #256f82;    /* fills and buttons; white text on it 5.71:1 */
  --accent-ink: #1d5866;/* teal text on --bg, 5.70:1 */
  --on-accent: #ffffff;
  --rule: rgba(10,10,10,.18);
  --grid: rgba(10,10,10,.045); --grid-major: rgba(10,10,10,.075);
  --font-display: "Zilla Slab", Georgia, serif;          /* 400; tracking -0.024em at hero size, -0.018em below */
  --font-text: "Rethink Sans", system-ui, sans-serif;    /* 400 text, 500 buttons and labels */
  --radius: 2px;        /* drawing-sheet edges; the skill default "soft" is overridden on purpose */
}
```

- **Bike paint:** frame and fork `#1d5866` clearcoat. Carbon parts `#17181a`. Rims are satin
  `#26282c`, so they read apart from the `#141414` tyres.
- **Type scale:**

  | | Landscape | Portrait |
  |---|---|---|
  | Hero h1 | clamp(40px, 4vw, 64px) / 1.04 | 34–36px |
  | Beat h2 | clamp(30px, 3vw, 48px) / 1.05 | 28–30px |
  | Body | 17px / 1.5 | 16px |
  | Labels | 14px | 14px |

  Numbers use `font-variant-numeric: tabular-nums`. Sentence case everywhere; no all-caps labels.
- **Spacing:** 16 px gutters on phones, 32 px at 820, 64 px at 1440. Rules are 1 px `--rule`.
  Controls are at least 44 px tall.

## 4. Layout rules (from the aspect ratio, not device sniffing)

| Aspect (w/h) | Bike rect (where the camera frames the bike) | Text |
|---|---|---|
| ≤ 0.8 (phones, portrait tablets) | Full width minus gutters, from below the header to **55% of the small viewport height (svh)** | Panel at the bottom, gutters 16 px (32 px from 600 px wide), at most 44% of svh. Beat: stage line, h2, one sentence, a two- or three-row spec table. |
| > 0.8 (laptops, landscape) | **Left 62%** of the width, vertically centred, 8% margins | Column on the right: 30vw wide (max 440 px) at the 64 px gutter, vertically centred |

The camera fits the bike's whole travel volume into the bike rect (Phase 3). That is how the
bike never clips and never sits under text, at any aspect.

## 5. Parallax backdrop: three layers, three rates

Prototype: `qa/comps/parallax.html`. Captured at p = 0, 0.5 and 1 in
`qa/comps/sheet-parallax-{390,1440}.png`.

| Layer | Content | Z-order | Motion over the whole story (p 0 → 1) |
|---|---|---|---|
| far | Drafting grid: CSS gradients at 24 px minor and 120 px major lines | behind the canvas | y: −6% of viewport height |
| mid | Construction geometry (SVG): two wheel circles, the axle centre line, the 73.5° steering line, all teal at 12–18% opacity | behind the canvas | y: −18% of viewport height; x: −5% of viewport width |
| fg | Ruler ticks along the bottom edge (repeating CSS gradient), ink at 28% opacity | **in front of** the canvas, behind the text | x: −50% of viewport width |

- **Measured travel in the prototype:** at 390×844, far −51 px, mid (−20, −152) px, fg −195 px.
  At 1440×900, far −54 px, mid (−72, −162) px, fg −720 px. The stage stayed pinned (`top: 0`)
  in WebKit and Chrome.
- **What the prototype got wrong:**
  - Its ruler was an SVG stretched with `preserveAspectRatio="none"` and stopped short of the edge.
    Phase 3 uses a repeating CSS gradient on a 300%-wide strip.
  - Its layer overscan (12%) was smaller than the mid layer's travel on a phone. Phase 3 sizes
    each layer's overscan from its own travel plus 24 px.
- **Rules:**
  - No text in any parallax layer.
  - Layers move by `transform` only, set from the same damped p as the 3D scene, so screenshots
    stay a pure function of p.
  - Under `prefers-reduced-motion` they do not move.

## 6. Motion and states

- **Scroll:** native, with no hijacking. One damped progress value drives the scene, the
  backdrop and the beat text (STORYBOARD.md).
- **Beats:** each one fades out fully before the next fades in, never both at once, so two
  texts never overlap.
- **The hero enters once on load:** a 400 ms fade-up of the text, with no delay to the LCP text.
- **Hover and press:** buttons darken on hover, press 1 px down, and the focus ring is a 2 px
  `--accent-ink` outline at 2 px offset.
- **Reduced motion:** five discrete states with no tweening, and a static backdrop.
- **No WebGL:** a static poster, an SVG drawing of the bike generated from the same joint table.

## 7. Fonts

The brief wants one self-contained `index.html`:
- **Files:** Zilla Slab 400, plus Rethink Sans 400 and 500.
- **Subset:** Latin, plus ° – × ’ “ ” ·.
- **Format:** inlined as base64 woff2 `@font-face`, so there is no font request, no swap and
  no layout shift.
- **Budget:** ≤ 45 KB of font data in the page, measured in Phase 3; the total stays ≤ 600 KB gzip.

## 8. Copy plan

Voice card, from the design skill's copy layer:
- **Register:** the product as the hero (register 11), with technical-dry proof (register 2).
- **Pairs:** exact, not cold; sure, not loud.
- **Person:** the bike is the subject of most sentences; "we" only in the close.
- **Sentences:** 8 to 20 words. Every claim carries its millimetre figure from GEOMETRY.md.
- **Never:** virtue words, a pun on the name, invented proof, prices, weights or reviews.

| Where | Heading | Line |
|---|---|---|
| Hero (h1) | Carbon road bike for racing and fast group rides | Scroll and the bike builds itself from its size-56 geometry chart, part by part, each tube placed to the millimetre. *Hard fact:* 991 mm wheelbase, 73.5° head angle, 26 mm tyres. |
| 1 Frame | Frame: 555 mm stack, 398 mm reach | Head tube and seat tube both at 73.5°, a 410 mm chainstay, and the bottom bracket 72 mm below the axles. |
| 2 Fork | Fork: 44.4 mm offset | With the 73.5° head angle that gives 53.5 mm of trail, the neutral middle of road handling. |
| 3 Wheels | Wheels: 45 mm rims, 26 mm tyres | 700c rims on a 622 mm bead seat, 24 spokes each: radial at the front, two-cross at the rear, where the pedalling torque goes. |
| 4 Drivetrain | Drivetrain: 52/36 rings, 11–30 cassette | 170 mm cranks and 12 speeds. On the 52 × 15 shown, the chain runs straight from ring to cog. |
| 5 Handlebar | Cockpit: 100 mm stem, 420 mm bar | A −6° stem on 35 mm of stack, and a bar with 75 mm of reach and 125 mm of drop. |
| 6 Saddle | Saddle height: 725 mm | Measured from the bottom bracket along the seat tube. The post goes in last and the bike is whole. |
| Finish | 991 mm from axle to axle | Seven frame sizes, 44 to 61. We fit you to one before we build it. |
| Close | Fittings and orders by message | Send your height and inseam, and we reply with a size and a build list. *Buttons:* **Book a fitting** (Telegram) and **Email the workshop** (mailto). |
| Footer | | Varsen is a concept brand built as a portfolio piece. Geometry: the published Specialized Tarmac SL7 chart, size 56. |

The main action, **Book a fitting**, reads the same in the header, the hero and the close
(copy.md, rule 5).

## 9. Changed during the build (Phase 3)

| Planned | Built | Why |
|---|---|---|
| A dimension line labelled "991 mm wheelbase" under the bike | Dropped | It is a label on a visual (design-skill house rule 1), it repeats the hero's fact, and it adds text that could collide with the bike or the beat on short phones. The construction circles carry the drawing idea. |
| Camera fits the whole bike's travel volume from the start | The camera fits **framing volumes** that grow as parts arrive and tighten to the finished bike (STORYBOARD.md 3a) | Against the full volume, the hero frame rendered at about 15% of the rect width. Now it fills the rect, and the camera eases back as parts arrive. |
| A faint contact shadow under the floating frame | The shadow appears with the wheels (0.8 × the mean wheel progress) | A shadow under a frame hanging in mid-air read as a smear. |
| A "Book a fitting" button on the finish beat | Header, hero and close only | The design skill's copy rule: the main action appears in the nav, the hero and the close, and nowhere else. |
| Bike rect at a fixed 55% of the small viewport | Bike rect derived from where the beat panel actually is (its tallest beat), minus 14 px | Text and bike cannot overlap at any viewport or font size. |
