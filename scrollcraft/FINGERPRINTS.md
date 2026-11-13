# Fingerprints

Every site you build with **scroll-craft** gets one row here, appended after it
ships. The registry exists so your next build can prove it is a different page
rather than a re-skin of one you already made.

This file is **yours**. It starts empty on purpose: the gate is about not
repeating *yourself*, so it has nothing to say until you have built something.

The rules and the gate live in the skill's
`references/uniqueness.md`. Short version:

**A new build must differ from EVERY row below on at least 4 of the 6
dimensions.** Four against each row individually, not four on average across the
table. If a planned build fails, change the plan. Never edit a row to make room
for it.

The six dimensions are: **grammar**, **nav treatment**, **hero device**,
**act-sequence shape**, **close pattern**, **signature move**.

Dimension 6 is free, because a signature move is unique by definition. So the
gate really asks for three more out of the remaining five, and a build that
changes only grammar and world will fail it.

---

## The registry

| Build | Grammar | Nav treatment | Hero device | Act-sequence shape | Close pattern | Signature move | World | Port |
|---|---|---|---|---|---|---|---|---|
| varsen (2026-11-12, verified, not yet deployed) | chaptered editorial, with a frontispiece in place of the type-only title page | folio rail in the left margin (V mark, chapter numerals I to V, title on hover or focus); a running head on phones | frontispiece: the live WebGL bike alone on a dark studio plate, drag or arrow keys to turn it, title block beneath | 7 sections: pin 1.8, flow, flow with sticky plate (3.85), flow stills, pin 4.6 (peak), flow tool, flow close; 14.7 viewport-heights at 1440x900 | booking (Calendly embed, chosen size carried in) then a colophon of sources | rebuild at your size: all seven frames generated in the page from the published chart; scroll sweeps them, a height rebuilds the bike at that size | none: studio plates, no world | 4500 |
| varsen, revised (2026-11-13, verified, not yet deployed; the owner's revision of the row above before it shipped, not a new build, so the gate is not run between them) | chaptered editorial, frontispiece hero (unchanged) | folio rail (unchanged) | frontispiece (unchanged) | 6 sections: pin 1.8, flow, flow with sticky plate (3.5), pin 4.4 (peak: a camera tour of the live product, captions cut), flow tool, flow close; 12.5 viewport-heights at 1440x900 | booking then colophon (unchanged) | rebuild at your size, on request only: the scroll sweep through the sizes was removed | none: studio plates, no world | 4500 |

---

## What is taken

Add a bullet here whenever a build claims something a later build should avoid
reusing: a grammar, a nav treatment, a close pattern, a signature move, an
act-count-and-length band. The shared columns are what the next build inherits
as a constraint, so writing them down is the whole point.

- **varsen:** chaptered editorial with a left-margin folio rail as the nav; a live 3D product plate
  as a frontispiece hero; a booking close that carries the visitor's choice into it; the signature
  "rebuild at your size" (the product regenerated from its own published numbers); the band of
  7 sections over about 14.7 viewport-heights.
- **varsen, revised:** a pinned camera tour over the live product as the peak (a held hero frame,
  then one orbit holding on parts, captions in their own column that cut rather than fade); the band
  of 6 sections over about 12.5 viewport-heights.

---

## Appending a row

After shipping, add one line to the table and one bullet to **What is taken** if
the build claimed something new. Fill every column. Say what the build shares
with existing rows.

Rows are append-only. A build that has been superseded stays in the table,
because the space it occupies is still occupied.

---

## Worked example

The skill's author kept a registry of twelve builds across eight page grammars.
If you want to see what a filled-in table looks like, and which shapes tend to
collide, read `EXAMPLES.md` in the scroll-craft repository. Treat it as
illustration only: those rows are somebody else's builds and they do **not**
constrain yours.
