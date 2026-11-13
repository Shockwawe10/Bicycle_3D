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
  beneath. The one action, "Book a fitting", is a text link.
- **Close:** the booking. Your size, your sheet, one calendar. Then the colophon with every source.

## Signature move: rebuild at your size

All seven sizes of the frame are generated from the published chart, in the page, by the same code
that builds the size 56. The visitor gives a height (or picks a size) and the bike rebuilds itself at
that size, dimension lines and numbers with it. The size is carried into the booking. Nothing in the
device kit does this, and it is the second half of the tell-someone sentence.

(As first built, scroll also swept the bike through all seven sizes in a pinned chapter IV. The owner
removed that chapter on 2026-11-13; the sizes now appear only when the visitor asks for one.)

## The peak: In detail (III), revised 2026-11-13

The owner asked for "some kind of hero block or product experience block" in place of the Up close
stills. One pinned stage, the copy column on the left over bare ground and the plate on the right:
a held hero frame (low front three-quarter, chapter title and one line), then one orbit of the live
size 56 through four holds (drivetrain from the drive side, the rear end from the brake side, the
cockpit from ahead, the drive-side profile), each with its caption. az only decreases, so the camera
never doubles back; between holds it glides (inOutCubic, distance in log space). Under reduced motion
it cuts between the holds at the caption boundaries. The plate's inner edge (left on desktop, bottom
on phones) gets a ground-coloured fade, so the close-ups dissolve instead of ending on a crop line.
Camera clearance, sampled at plate aspects 0.8 to 1.2: never within 0.47 m of any part's bounding box.

## Fingerprint gate

`scrollcraft/FINGERPRINTS.md` is empty: this is the first build in this workspace, so there is no
row to clear. The row this build adds is written after verification.

## Score

| Act | Span | Device | Why this one |
|---|---|---|---|
| Frontispiece | pin 1.8 | live 3D plate + kinetic h1 (greet) + parallax numeral | product first; the turn under the hand and the light are the open |
| I Chart | flow | `in` + dimension lines drawn from the act's `--sc-p`, projected from the 3D joints | trust arrives with the lines; reading, not watching |
| II Build | flow, 3.5 to 3.9 measured, sticky plate | bespoke sticky plate (verify-state published) beside a text column | the build is read like a feature: text column scrolls, plate holds |
| III In detail | **pin 4.4 (largest)** | bespoke camera tour on the live plate (verify-state published), one cue per hold, plate-edge fade | the peak gets the most room; a held frame first, then the orbit |
| IV Yours | flow | the chooser (bespoke), numbers re-set to the chosen size | ownership: the visitor acts |
| Close | flow, last | `reveal` on the booking plate, colophon | resolves and holds |

Device families: pin, kinetic, parallax, flow + in, reveal, plus the bespoke live plates. Total 12.5
viewport-heights measured at 1440x900 (13.6 at 390x844, 14.8 at 360x640), inside the 8 to 14 budget
on desktop and phone. Revised 2026-11-13: the Up close stills (flow) and the Seven sizes sweep (pin
4.6) were removed at the owner's request, In detail took the peak, and the build steps went from 52
to 46 svh so the peak keeps the most room.

## Hero layer contract

| Plane | Asset and depth | Independent movement | Contact / occlusion |
|---|---|---|---|
| Far | Studio: near-black ground, a soft floor falloff, grain | none | nothing duplicated |
| Mid | The size figure "56", very low contrast, behind the bike | rises at 0.6x and dims on scroll | the bike occludes it |
| Focal | The live bike, gloss yellow, its contact shadow | turns from three-quarter to profile on scroll; drag to turn | stays on its shadow |
| Near | Headline, one line, the action link | 1x | never overlaps the bike |
| Atmosphere | The key light sweeping the clearcoat on arrival | once, then follows the turn | none |

Opening: three-quarter view, the key light sweeps across the paint, "56" behind. Midpoint: halfway
to profile, the figure risen and dim, the headline leaving. Exit: pure profile, which is where
chapter I picks the bike up with its dimension lines.

## Rendering

One WebGL renderer with its canvas kept off screen. Each plate has its own 2D canvas in the page: the
bike is drawn with that plate's camera and state (assembly, size, yaw) and copied in. The browser
scrolls those canvases with the page, so a bike never trails its own caption or dimension lines
(a single fixed canvas, drawn from script, followed the page a frame late; revised 2026-11-13). A
plate is drawn only when its picture changes (a signature of size, light, camera and bikes), half a
screen before it arrives. Render on demand only.

Motion: every scroll-driven value follows the scroll on a critically damped spring (OMEGA 10), which
starts and stops at zero speed; the build's camera follows a Gaussian-smoothed copy of its framing
path; the tour glides on smootherstep. Measured with tools/check-smoothness.mjs (the same wheel and
trackpad input on the old and new code): build camera acceleration p95 38,171 to 1,774 px/s2, tour
105,154 to 15,414, dropped frames 10 to 0, page work per frame 2.2 to 1.0 ms.

Posters for browsers without WebGL are rendered from the same scene by tools/render-posters.mjs (the
tour has one per hold).
