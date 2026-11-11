---
name: ios-sticky-stage
description: Pin a full-viewport WebGL/scrollytelling stage on iPhone Safari without jumps when the address bar shows or hides (sticky 100lvh stage, svh-anchored text, no dvh resizes). Use when building scroll-driven pages with a pinned canvas that must be stable on iOS.
---

# iOS-safe sticky stage

The address bar collapsing changes `innerHeight` and `100dvh` continuously. Anything sized from
those resizes mid-scroll: the canvas reallocates, the layout shifts and the progress value jumps.
Size everything from units that do not move.

## Recipe
1. Use a tall section for the scroll and a sticky child for the stage:
   ```css
   .story { position: relative; height: 1100vh; height: 1100lvh; }   /* scroll range = 10 x 100lvh */
   .stage { position: sticky; top: 0; height: 100vh; height: 100lvh; overflow: hidden; }
   ```
   `lvh` is the large viewport, which is constant while the bars animate.
2. Keep text above Safari's bars. The bottom `100lvh - 100svh` of the stage can sit under the
   toolbar, so lift anything bottom-anchored by that amount:
   ```css
   :root { --toolbar: calc(100lvh - 100svh); }
   @supports not (height: 100lvh) { :root { --toolbar: 0px; } }
   .panel { position: absolute; bottom: calc(var(--toolbar) + 12px + env(safe-area-inset-bottom)); }
   ```
3. Size the renderer to the stage's `clientWidth` and `clientHeight` (lvh) from a `ResizeObserver`
   on the stage, never from `innerHeight`. That way it only reallocates on a real resize or a
   rotation.
4. Lay out from the small viewport (svh), measured with a hidden `position: fixed; height: 100svh`
   probe, so the subject is never framed into the toolbar zone. Derive the subject's rect from where
   the text panel really is (`getBoundingClientRect`), so text and subject cannot overlap.
5. Compute progress as `p = clamp((scrollY - story.offsetTop) / (story.offsetHeight - stage.clientHeight))`.
   Both terms are lvh-based and static, so the bars never move p.
6. Never put `overflow-x: hidden` on `html` or `body`: it breaks `position: sticky` in Safari. Use
   `overflow-x: clip` on `html`.
7. Add `viewport-fit=cover` in the viewport meta, `env(safe-area-inset-*)` paddings on the fixed
   header and footer, and `touch-action: pan-y` on the canvas.

## Check
- At 390x844, Playwright WebKit's svh equals lvh, so emulation cannot show the toolbar case. Test
  the `--toolbar` maths on a device with Web Inspector, or by giving the page a smaller svh than
  lvh in a test frame.
- Assert the stage's `getBoundingClientRect().top === 0` across the scroll range.
