# Varsen: plan

## Grammar: chaptered editorial (uniqueness.md 2.2), with one brief-driven change

The page is a printed product monograph: chapters with a folio, plates of the one object with captions,
hard cuts between grounds, a colophon at the end. It fits "premium, trusted, editorial" and "not a
world we fly through".

**The change:** the grammar's hero is a type-only title page. The owner asked for the opposite, "the
bike itself, product first, and cinematic", so the opening is a frontispiece. The bike is on its own
plate and the title sits beside it, never over it. The grammar's rule that media never runs under
type still holds everywhere.

Why the other seven lost:
- **Filmic one-shot:** the current page is one, a sticky stage under beats. The brief is a redo into
  chapters, so the structure has to change, not only the paint.
- **Continuous world:** refused outright ("not like a world that we'd be flying through").
- **Live surface:** a bike is not software. The size chooser is a tool inside the page, not the page.
- **Typographic poster:** the asset is a 3D object; type alone would hide it.
- **Gallery / catalog:** seven sizes look like a catalog, but they are one object, and the visitor's
  question is "can I trust this, is it mine", not "what are the options".
- **Split stage:** there is no two-sided argument.
- **Rhythmic cutlist:** the brief's energy is the middle, not a pulse; premium and trusted want holds.

Bans this grammar puts on the page: no drift (every chapter is an opaque ground and changes on a
hard edge), no video scrub, no pinned crossfading type, no magnetic CTA, no spotlight, no centred hero
copy, no media under type. The tour (III) is a pinned act, but of media, not type: its captions cut
from one to the next with no fade (cue ramps of 0), and they sit in their own column beside the plate.

## Nav, hero, close

- **Nav:** no bar. A folio in the left margin: the V mark, the chapter numeral and title, updating as
  chapters pass. It is also the index: each numeral jumps to its chapter. On phones the folio is a
  small running head at the top edge.
- **Hero:** frontispiece. The live bike in a dark studio, drag to turn, title block lead-aligned
  beneath. The one action, "Book a fitting", is a text link. Beside it, at the owner's request (a
  deliberate exception to the skill's no-scroll-cue rule, see BRIEF.md), a quieter link "Scroll to see
  it built" with a slowly drifting arrow: it fades once the visitor has scrolled about 50 px and
  links to the build. Phones show "Scroll" and the arrow, on the action's row. The build plate carries
  a smaller "Keep scrolling" cue (bottom right, opposite the caption) until the saddle lands.
- **Close:** the booking. Your size, your sheet, one calendar. Then the colophon with every source.

## Signature move: rebuild at your size

All seven sizes of the frame are generated from the published chart, in the page, by the same code
that builds the size 56. The visitor gives a height (or picks a size) and the bike rebuilds itself at
that size, dimension lines and numbers with it. The size is carried into the booking. Nothing in the
device kit does this, and it is the second half of the tell-someone sentence.

(As first built, scroll also swept the bike through all seven sizes in a pinned chapter IV. The owner
removed that chapter on 2026-11-13; the sizes now appear only when the visitor asks for one.)

## The peak: In detail (II), revised 2026-11-13 (twice)

First a scroll tour (pin 4.4: a held hero frame, then one orbit through four holds). Then the owner asked for points
on the bike to click instead, so II is one screen: the copy column on the left over bare ground, the plate on the
right with the size 56 at its front three-quarter and five points on it (Frame, Drivetrain, Brakes, Wheels,
Cockpit), each a 44 px target with a ring, a pulse and a label, projected from a 3D anchor every frame. Choosing one
flies the camera to that part's view (the shorter way round, distance in log space, smootherstep, 0.8 to 1.3 s; a cut
under reduced motion) while the column swaps its intro for the part's description. Back, Previous / Next (wrapping),
the arrow keys and Escape move between them; focus goes to the part and back to its point. The intro and the parts
share one grid cell, so nothing moves as they swap; on phones the plate takes the height the column leaves. The pulse
runs only while II is on screen and the page is still (an endless animation cost the scroll 5 dropped frames a pass).
Without WebGL or script the parts read as a list beside the poster.
Checks: tools/check-detail-clearance.mjs (all 20 flights from rest, aspects 0.6 to 1.5: closest approach 0.47 m, the
floor); tools/check-keyboard.mjs (Enter, arrows, Escape, focus).

## Fingerprint gate

`scrollcraft/FINGERPRINTS.md` is empty: this is the first build in this workspace, so there is no
row to clear. The row this build adds is written after verification.

## Score

| Act | Span | Device | Why this one |
|---|---|---|---|
| Frontispiece | pin 1.8 | live 3D plate + kinetic h1 (greet) + parallax numeral | product first; the turn under the hand and the light are the open |
| Glance | flow, band (0.4 to 0.6) | four figures, `in` staggered 90 ms | orientation before the story; replaced the chart chapter on 2026-11-13 (it repeated Find yours) |
| I Build | flow, 3.5 to 3.9 measured, sticky plate | bespoke sticky plate (verify-state published) beside a text column | the build is read like a feature: text column scrolls, plate holds |
| II In detail | flow, one screen | bespoke: points on the live plate, camera flights, a part column; plate-edge fade | the peak is chosen, not scrolled (owner, 2026-11-13); paced by the visitor |
| III Yours | flow | the chooser (bespoke), numbers re-set to the chosen size | ownership: the visitor acts |
| Close | flow, last | `reveal` on the booking plate, colophon | resolves and holds |

Device families: pin, kinetic, parallax, flow + in, reveal, plus the bespoke live plates. Total 8.7
viewport-heights measured at 1440x900 (9.6 at 390x844) after In detail became one screen, inside the 8 to 14 budget
on desktop and phone. Revised 2026-11-13: the Up close stills (flow) and the Seven sizes sweep (pin
4.6) were removed at the owner's request, In detail took the peak, and the build steps went from 52
to 46 svh so the peak keeps the most room.

## Hero layer contract

| Plane | Asset and depth | Independent movement | Contact / occlusion |
|---|---|---|---|
| Far | Studio: near-black ground, a soft floor falloff, grain | none | nothing duplicated |
| Mid | The model figure "R1" (was the size, "56"), very low contrast, behind the bike | rises at 0.6x and dims on scroll | the bike occludes it |
| Focal | The live bike, gloss yellow, its contact shadow | turns from three-quarter to profile on scroll; drag to turn | stays on its shadow |
| Near | Headline, one line, the action link | 1x | never overlaps the bike |
| Atmosphere | The key light sweeping the clearcoat on arrival | once, then follows the turn | none |

Opening: three-quarter view, the key light sweeps across the paint, "R1" behind. Above the headline, on its edge, the
model line: a solid NEW tag, then "Varsen R1 · The flagship road bike" (two lines on phones). It first ran up the right
edge, rotated; the owner found it hard to see, and the taste skill rules out tilted type. Midpoint: halfway
to profile, the figure risen and dim. Exit: pure profile, which is where chapter I picks the bike up
with its dimension lines. The headline, lede and action stay for the whole pin (revised 2026-11-13:
when they faded at 0.6, the rest of the pin was the bike over an empty half screen, a gap on phones);
only the scroll cue beside the action fades, once the visitor has scrolled.

## Rendering

One WebGL renderer with its canvas kept off screen. Each plate has its own 2D canvas in the page: the
bike is drawn with that plate's camera and state (assembly, size, yaw) and copied in. The browser
scrolls those canvases with the page, so a bike never trails its own caption or dimension lines
(a single fixed canvas, drawn from script, followed the page a frame late; revised 2026-11-13). A
plate is drawn only when its picture changes (a signature of size, light, camera and bikes), half a
screen before it arrives. Render on demand only.

Sharp at rest (2026-11-13): motion frames draw at the adaptive level (at most 1.5x on phones); 140 ms after the page
settles, the plates on screen are drawn once more at the screen's own resolution (devicePixelRatio up to 3, at most
3.2 MP a plate), only where that is at least 1.2x the level. On a 3x phone a still plate went from 1.5 to 3 image pixels
per CSS pixel; a pass costs 11 to 20 ms and runs only while nothing moves.

Motion: every scroll-driven value follows the scroll on a critically damped spring (OMEGA 10), which
starts and stops at zero speed; the build's camera follows a Gaussian-smoothed copy of its framing
path. (In detail's flights are time-driven, not scroll-driven: 0 dropped frames across all ten, desktop and phone.) Measured with tools/check-smoothness.mjs (the same wheel and
trackpad input on the old and new code): build camera acceleration p95 38,171 to 1,774 px/s2, tour
105,154 to 15,414, dropped frames 10 to 0, page work per frame 2.2 to 1.0 ms.

Posters for browsers without WebGL are rendered from the same scene by tools/render-posters.mjs.
