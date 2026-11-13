# Bicycle 3D (Varsen landing)

Read LESSONS.md before starting work.

- **The spec:** STORYBOARD.md and GEOMETRY.md. The QA suite parses both, so change the spec first,
  then the page.
- **Local server:** start `node qa/serve.mjs 4173` (it mirrors nginx.conf: gzip, cache and CSP).
- **CSP:** after any edit to index.html, run `node qa/csp.mjs`. A stale CSP hash blocks the inline
  scripts and the page never becomes ready.
- **Overlaps:** after any change to a part's shape or motion, run `node qa/overlap.mjs`. No part may pass through
  another at any p; the only shared space is a shaft in its bore (GEOMETRY.md section 6).
- **Before reporting a deploy as done,** run `node qa/live-check.mjs chrome` and
  `node qa/live-check.mjs webkit`. Both check that the bike's pixels are actually visible, not just
  the page state.
- **Playwright's Windows WebKit** cannot present a resized WebGL canvas (`qa/probe/resize.html`).
  WebKit visual tests use `?qa=1`; the canvas-resize path is verified in Chrome.

## Varsen build (`scrollcraft/builds/varsen`)

Serve it with `node .claude/skills/scroll-craft/scripts/serve.mjs --root scrollcraft/builds/varsen --port 4500`;
its checks are in `scrollcraft/builds/varsen/tools/` and run from the repo root.

- **No bare half screen:** in a pinned act, neither half of the screen may go bare at any scroll position. Run
  `node scrollcraft/builds/varsen/tools/check-coverage.mjs`, and on the 390x844 sheet look at each pinned act's
  frames after its last copy cue. The scroll-craft dead-scroll check passes while anything moves.
- **Motion:** after any change to scroll-driven motion, run
  `node scrollcraft/builds/varsen/tools/check-smoothness.mjs` on the working tree (port 4500) and on HEAD
  (`git archive HEAD`, served on port 4502), and quote both in the commit.
- **Commit and push** each verified unit of work to main (`.claude/skills/ub-mode`). Every number in a commit message
  comes from a run on that exact tree; run a variance claim twice before writing it.
