---
name: damped-scroll-progress
description: Turn native scroll into one damped progress value p that drives a 3D scene, with no scroll hijacking, render-on-demand and a deterministic settle hook for screenshot tests. Use for scrollytelling where scene state must be a pure function of p.
---

# Damped scroll progress

## Model
- **Raw:** `pTarget = clamp01((scrollY - top) / span)`, read in a **passive** scroll listener that
  only stores the value and calls `kick()`.
- **Shown:** a critically damped spring, exact, so it is frame-rate independent. Keep a velocity per value:
  ```js
  const e0 = pShown - goal, ex = Math.exp(-OMEGA * dt), k = (vel + OMEGA * e0) * dt;
  const e = (e0 + k) * ex; vel = (vel - OMEGA * k) * ex; pShown = goal + e;   // OMEGA 10: 90% of a step in 0.39 s
  if (Math.abs(e) < 1e-4 && Math.abs(vel) < 1e-3) { pShown = goal; vel = 0; }  // snap, so it settles exactly
  ```
  Prefer it to the first-order follow `pShown += (goal - pShown) * (1 - exp(-dt / tau))`: that one jumps to
  full speed the instant the goal moves, so every wheel notch shows as a jolt. Measured on the Varsen build
  (scrollcraft/builds/varsen/tools/check-smoothness.mjs, same input): camera acceleration p95 down 5 to 21x.
  Keep looping while `vel !== 0`, not only while `pShown !== goal`.
- **dt:** clamp to 0.1 s. After an idle stretch, the first frame uses dt = 1/60 rather than the gap, and
  **never 0**: a follow given dt = 0 that treats it as "snap to goal" makes every scroll that starts from
  rest jump in one frame, the loop then sees nothing to ease and stops, and the page has no easing at all
  for ordinary wheel input. That shipped once (the Varsen build traced 104 frames for 661 scrolled).
- **Several plates that scroll with the page:** do not draw them all into one fixed canvas from script.
  The browser scrolls the page on its own thread; a fixed canvas follows a frame late, and each subject
  swims against its own caption. Give each plate a canvas in the page, render with one off-screen renderer
  and copy (`ctx.drawImage(glCanvas, ...)`) only when the plate's picture changes.
- **State:** `state(p)` is pure. It returns part transforms, camera, opacity and beats. The loop
  applies `state(pShown)`. Never accumulate in the loop (no `x += speed`), or jumps and sequential
  scrolls end in different states.
- **Render on demand:** one requestAnimationFrame loop. It re-arms only while `pShown !== goal`
  (or something is dirty), so nothing renders at rest.
- **Reduced motion:** `goal = quantize(pTarget)` to N discrete states, no damping (`pShown = goal`),
  and static decorative layers.
- **Async init:** if WebGL setup awaits between steps, gate scene writes on a `ready` flag. A scroll
  or resize frame can otherwise reach a half-built scene. That cost this project three failing tests.

## Test hook (avoid the race)
A test that calls `scrollTo()` and then waits for "settled" can resolve before the scroll event
has fired, and screenshot the old p. In the settle helper, read the scroll position yourself
first, then wait at least two frames:
```js
settled: () => new Promise(res => { readScroll(); kick(); let n = 0;
  const chk = () => (++n > 2 && !raf && pShown === goal() ? res() : requestAnimationFrame(chk)); requestAnimationFrame(chk); })
```
With the pure state plus snapping, screenshots after random jumps match those after sequential
scrolling to the same p (lock adaptive quality while testing).
