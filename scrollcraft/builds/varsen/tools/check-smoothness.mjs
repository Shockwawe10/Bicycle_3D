// Scroll smoothness of the Varsen build, measured:
//   node scrollcraft/builds/varsen/tools/check-smoothness.mjs [label] [w] [h] [port]
// Scrolls the whole page twice, the way people do, with the page's own trace on (window.__bike.trace):
//   wheel     notches of 100 px in bursts, each animated the way browsers animate a wheel notch (scrollBy, smooth);
//   trackpad  a steady stream of small deltas, applied at once (as a trackpad sends them).
// Reports:
//   pacing   intervals between animation frames (ms): p50 / p95 / max, and frames slower than 1.5x the median
//   cost     the page's own work per frame (ms): p50 / p95 / max; long animation frames (> 50 ms) from the browser
//   motion   per plate, where the bike sits WITHIN the plate frame by frame (the animation alone; the page's scroll is
//            the browser's): speed (px/s), acceleration (px/s^2, p95 and max) and the p95 jump in acceleration between
//            frames. Jolts are spikes here; a smooth page has small, steady numbers for the same input.
// Writes the raw trace and the summary to qa/tmp/smooth-<label>.json (ignored), so two runs can be compared.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const [label = 'run', w = '1440', h = '900', port = '4500'] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await (await b.newContext({ viewport: { width: +w, height: +h } })).newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(`http://127.0.0.1:${port}/?qa=1`);
await page.waitForFunction(() => window.__bike?.ready === true && window.__bike.sizesReady === true, null, { timeout: 90000 });
await page.waitForTimeout(600);

async function pass(kind) {
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.__raf = []; window.__loaf = [];
    const tick = t => { window.__raf.push(t); if (window.__rafOn) requestAnimationFrame(tick); };
    window.__rafOn = true; requestAnimationFrame(tick);
    try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__loaf.push(e.duration))).observe({ type: 'long-animation-frame', buffered: false }); } catch {}
    window.__bike.trace.start();
  });
  await page.mouse.move(w / 2, h / 2);
  const end = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  if (kind === 'wheel') {                         // notches of 100 px, 8 to a burst, 45 ms apart, a 250 ms pause between bursts
    for (let y = 0; y < end;) { for (let k = 0; k < 8 && y < end; k++, y += 100) { await page.evaluate(() => scrollBy({ top: 100, behavior: 'smooth' })); await page.waitForTimeout(45); } await page.waitForTimeout(250); }
  } else {                                        // a trackpad: 14 px every 16 ms, steady
    for (let y = 0; y < end; y += 14) { await page.mouse.wheel(0, 14); await page.waitForTimeout(16); }
  }
  await page.waitForTimeout(900);
  return page.evaluate(() => { window.__rafOn = false; return { frames: window.__bike.trace.stop(), raf: window.__raf, loaf: window.__loaf }; });
}

const q = (a, f) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * (s.length - 1)))]; };
const r1 = n => Math.round(n * 10) / 10;
function summarise({ frames, raf, loaf }) {
  const iv = raf.slice(1).map((t, i) => t - raf[i]).filter(d => d < 500), med = q(iv, 0.5);
  const cost = frames.map(f => f.cost);
  const motion = {};
  for (const name of ['front', 'chart', 'build', 'detail', 'yours']) {
    const acc = [], jumps = [], speed = [];
    let prev = null, prevV = null, prevA = null;
    for (const f of frames) {
      const pts = f.plates?.[name];
      if (!pts) { prev = prevV = prevA = null; continue; }
      if (prev) {
        const dt = (f.now - prev.now) / 1000; if (dt <= 0 || dt > 0.1) { prev = { now: f.now, pts }; prevV = prevA = null; continue; }
        const v = []; for (let i = 0; i < pts.length; i++) v.push((pts[i] - prev.pts[i]) / dt);
        speed.push(Math.max(...v.map(Math.abs)));
        if (prevV) {
          const a = v.map((x, i) => (x - prevV[i]) / dt), am = Math.max(...a.map(Math.abs)); acc.push(am);
          if (prevA != null) jumps.push(Math.abs(am - prevA)); prevA = am;
        }
        prevV = v;
      }
      prev = { now: f.now, pts };
    }
    if (speed.length > 5) motion[name] = { frames: speed.length, speedP95: Math.round(q(speed, 0.95)), accP95: Math.round(q(acc, 0.95)), accMax: Math.round(q(acc, 1)), jerkP95: Math.round(q(jumps, 0.95)) };
  }
  return { frames: frames.length, pacing: { p50: r1(med), p95: r1(q(iv, 0.95)), max: r1(q(iv, 1)), slow: iv.filter(d => d > 1.5 * med).length, of: iv.length },
    cost: { p50: r1(q(cost, 0.5)), p95: r1(q(cost, 0.95)), max: r1(q(cost, 1)) }, longFrames: loaf.length, motion };
}

const out = {};
for (const kind of ['wheel', 'trackpad']) { const raw = await pass(kind); out[kind] = { summary: summarise(raw), raw }; }
await b.close();
mkdirSync('qa/tmp', { recursive: true });
writeFileSync(`qa/tmp/smooth-${label}.json`, JSON.stringify(out));
for (const [kind, { summary }] of Object.entries(out)) {
  console.log(`\n== ${label} / ${kind}: ${summary.frames} traced frames`);
  console.log(`pacing ms  p50 ${summary.pacing.p50}  p95 ${summary.pacing.p95}  max ${summary.pacing.max}  slow ${summary.pacing.slow}/${summary.pacing.of}`);
  console.log(`cost ms    p50 ${summary.cost.p50}  p95 ${summary.cost.p95}  max ${summary.cost.max}   long frames ${summary.longFrames}`);
  for (const [n, m] of Object.entries(summary.motion)) console.log(`${n.padEnd(7)} frames ${String(m.frames).padStart(4)}  speed p95 ${String(m.speedP95).padStart(5)} px/s  accel p95 ${String(m.accP95).padStart(6)}  max ${String(m.accMax).padStart(6)} px/s2  accel jump p95 ${m.jerkP95}`);
}
if (errors.length) console.log('page errors', errors);
