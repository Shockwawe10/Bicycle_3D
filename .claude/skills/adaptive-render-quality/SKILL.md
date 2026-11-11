---
name: adaptive-render-quality
description: Adapt three.js render cost to the device by stepping the pixel ratio from measured frame intervals (EMA + hysteresis), with a DPR cap on touch devices and a lock for deterministic QA. Use when a WebGL page must hold 60 fps on phones without a manual quality switch.
---

# Adaptive render quality

- **Levels:** touch devices `[1.5, 1.25, 1.0, 0.85]`, desktop `[2, 1.5, 1.25, 1.0]`, each capped at
  `devicePixelRatio`. A level change is `renderer.setPixelRatio(l)` followed by
  `renderer.setSize(w, h, false)`.
- **Sample only consecutive animation frames** (render-on-demand loops idle, and an idle gap is not
  a slow frame). `ema += (dtMs - ema) * 0.1`.
- **Step down** after 12 consecutive frames with ema > 20 ms. **Step up** after 240 frames under
  13 ms, and at most once every 4 s. Hysteresis stops oscillation.
- **Reset** ema to 16.7 after every change, so the new level is judged on its own frames.
- **QA lock:** with `?qa`, keep level 0, so screenshots are deterministic. Measure frame time
  without the lock.
- **Also:**
  - antialias is fixed at context creation, so choose it once;
  - no shadow maps (one contact-shadow quad instead);
  - share materials, with one shared transparent twin set when fades never overlap;
  - PMREM at 128 on touch, 256 on desktop.
- **Report** level and dpr on a debug object (`window.__bike.quality`), so tests can read what ran.
