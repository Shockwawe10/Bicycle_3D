# Bicycle 3D (Varsen landing)

Read LESSONS.md before starting work.

- **The spec:** STORYBOARD.md and GEOMETRY.md. The QA suite parses both, so change the spec first,
  then the page.
- **Local server:** start `node qa/serve.mjs 4173` (it mirrors nginx.conf: gzip, cache and CSP).
- **CSP:** after any edit to index.html, run `node qa/csp.mjs`. A stale CSP hash blocks the inline
  scripts and the page never becomes ready.
- **Before reporting a deploy as done,** run `node qa/live-check.mjs chrome` and
  `node qa/live-check.mjs webkit`. Both check that the bike's pixels are actually visible, not just
  the page state.
- **Playwright's Windows WebKit** cannot present a resized WebGL canvas (`qa/probe/resize.html`).
  WebKit visual tests use `?qa=1`; the canvas-resize path is verified in Chrome.
