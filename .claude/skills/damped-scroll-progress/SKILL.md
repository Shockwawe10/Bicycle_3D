---
name: damped-scroll-progress
description: Turn native scroll into one damped progress value p that drives a 3D scene, with no scroll hijacking, render-on-demand and a deterministic settle hook for screenshot tests. Use for scrollytelling where scene state must be a pure function of p.
---

# Damped scroll progress

## Model
- **Raw:** `pTarget = clamp01((scrollY - top) / span)`, read in a **passive** scroll listener that
  only stores the value and calls `kick()`.
- **Shown:** exponential follow, frame-rate independent:
  ```js
  pShown += (goal - pShown) * (1 - Math.exp(-dt / tau));   // tau 0.17 s: half-life 0.118 s, 90% in 0.39 s
  if (Math.abs(goal - pShown) < 1e-4) pShown = goal;          // snap, so it settles exactly
  ```
  Clamp dt to 0.1 s. After an idle stretch, the first frame uses dt = 1/60 rather than the gap.
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
