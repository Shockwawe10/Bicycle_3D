# Lessons

Written by /aar-loop after each session's After Action Review. Read this file before starting a new task in this project. Every entry should be concrete and checkable, never vague.

## 2026-11-11 -- A QA flag that locks behaviour (index.html?qa=1 locks adaptive quality) must be paired with at least one unlocked run that asserts on pixels (dark pixels inside __bike.layout.rect > 500 at p = 0, 0.5 and 1, plus one forced setQuality(1) at rest), or the locked path ships untested.
- Expected: Every visual QA check would cover what a visitor sees on the live site.
- Actual: On GitHub Pages the bike was blank at p = 1 after adaptive quality stepped down; the first live check still passed because it asserted __bike state, not pixels.
- Why: All screenshot tests used ?qa=1, so setQuality() -> renderer.setSize() (which clears the canvas) never ran in a pixel check, and setQuality() did not schedule a redraw. Fixed in ba00977: setQuality() calls kick(); regression test 'a quality change at rest redraws the bike'; qa/live-check.mjs counts bike pixels.
- tags: qa,webgl,adaptive-quality,fix-applied (rule also in .claude/skills/adaptive-render-quality/SKILL.md)

## 2026-11-11 -- When Lighthouse TBT regresses, the first step is: run lighthouse with --save-assets, list CrRendererMain RunTask events over 40 ms from its own trace (observed ms x 4 = simulated), then name the statement with long-animation-frame scripts[].sourceCharPosition (an offset into the inline module script). Any observed step over ~12 ms counts.
- Expected: Fixes for the detail-upgrade TBT regression (Lighthouse 90-93, TBT 312-419 ms) would each move TBT.
- Actual: Four guessed fixes (8 ms time-slicing, fewer shader programs, a software-GL path, text-wrap balance) moved TBT by less than 50 ms; one run of the saved trace found the 85 ms task.
- Why: I profiled a different environment (Playwright headless shell, my own longtask observer) instead of the scored run; Lighthouse labelled the task Unattributable. The cause was a 35 ms setRenderTarget(rt) during the PMREM warm-up plus canvas-text textures drawn in one go. Method recorded in .claude/skills/three-pmrem-async-warmup/SKILL.md.
- tags: performance,lighthouse,tbt,fix-applied

## 2026-11-11 -- When offering the user options that relax a brief constraint (here: a downloaded Sketchfab model versus the procedural bike), put each option's time estimate and its effect on every numeric budget (600 KB transfer, Lighthouse >= 90, frames < 20 ms) in the option description itself.
- Expected: The user would pick a direction once, from the AskUserQuestion options.
- Actual: The user picked 'Licensed downloaded model', I started vendoring loaders, then the user asked about time and budget and switched to the procedural route: one wasted round trip and an interrupted install to revert.
- Why: The options said 'likely adds several MB' but gave no time estimate and no number against the 600 KB budget; the comparison came only after the user asked.
- tags: communication,options,fix-applied (memory: options-state-costs.md)
