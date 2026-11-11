---
name: three-pmrem-async-warmup
description: Remove the ~600 ms main-thread stall of three.js PMREMGenerator.fromScene(RoomEnvironment) on a cold shader cache by pre-creating and async-compiling its internal GGX/blur materials (verified on r185). Use when Lighthouse TBT or first-load jank is dominated by environment-map generation.
---

# Async PMREM warm-up (three r185)

**Symptom:** one long task (500–900 ms) during `pmrem.fromScene(new RoomEnvironment())`. It is
shader compilation that blocks the main thread. r185's `fromScene` lazily creates a GGX
importance-sampling ShaderMaterial (loop-heavy, slow on ANGLE/D3D11) plus a blur material, and
renders with them at once.

**Measuring trap:** the GPU process caches compiled shaders for the whole browser session, so a
second page load looks fast. Warming the room alone looked like a fix in a reused browser, and was
not one. Always profile in a **fresh browser per run**.

**Fix:**
```js
const pm = new THREE.PMREMGenerator(r), room = new RoomEnvironment(), size = isTouch ? 128 : 256;
const tm = r.toneMapping, cs = r.outputColorSpace;
r.toneMapping = THREE.NoToneMapping;                                      // the variant fromScene uses
if (typeof pm._allocateTargets === 'function') {                          // private API: guard it
  pm._setSize(size); const rt = pm._allocateTargets();                    // creates the GGX/blur materials (rt stays unbound)
  const filters = new THREE.Scene();
  for (const m of [pm._ggxMaterial, pm._blurMaterial]) if (m) filters.add(new THREE.Mesh(pm._lodMeshes[0].geometry, m));
  r.outputColorSpace = THREE.LinearSRGBColorSpace;                         // same program key as rendering into the float target
  await Promise.all([r.compileAsync(room, cam), r.compileAsync(filters, cam)]);
  r.outputColorSpace = cs; rt.dispose(); filters.clear();
}
const envRT = pm.fromScene(room, 0.04, 0.1, 100, { size });              // reuses the ready materials (same size)
r.toneMapping = tm; scene.environment = envRT.texture; room.dispose(); pm.dispose();
```
**Do not `setRenderTarget(rt)` for the warm-up.** Binding it allocates the half-float target and waits
on a framebuffer-completeness check: 35 ms of main thread, which Lighthouse multiplies by 4. The
temporary linear output colour space gives the same program variant with nothing bound (`fromScene`
measured 43 ms after this warm-up, cold).

**Result (this repo, Chrome ANGLE D3D11, cold):**
- `fromScene` went from 597–640 ms to 18 ms.
- The warm-up runs off the main thread (~600 ms of wall time).
- Approximate TBT went from 1.4 s to 0.15 s at 1x CPU, and to 0.13 s at 4x CPU once the bike build
  was also split.

**Also:**
- Compile both the opaque and the fade (transparent) material variants with `compileAsync`
  before the first render. One missed variant cost a 315 ms first frame.
- Split procedural geometry building into one task per part (`await scheduler.yield()`).

**Finding a long task Lighthouse calls "Unattributable":** run Lighthouse with `--save-assets`, read
the trace's CrRendererMain `RunTask` events over 40 ms and their children. Then use Chrome's
`long-animation-frame` entries (`scripts[].sourceCharPosition` is an offset into the inline module
script) to name the exact statement. Observed tasks are multiplied by 4 in simulated TBT, so anything
over about 12 ms counts.
