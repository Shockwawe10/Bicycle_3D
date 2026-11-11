// Frame-time proxy for the brief's ">= 95% of frames < 20 ms over a scripted 10 s scroll".
// PROXY, not an iPhone: Chrome 151 headless on the desktop GPU (ANGLE D3D11, RTX 3050 Ti) with 4x CPU throttling.
// node qa/frames.mjs [mobile|desktop]   -> qa/results/frames-<mode>.json
import { chromium } from 'playwright';
import fs from 'node:fs';
const mode = process.argv[2] || 'mobile';
const ctxOpts = mode === 'mobile'
  ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
  : { viewport: { width: 1440, height: 900 } };
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext(ctxOpts), page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await page.goto('http://127.0.0.1:4173/index.html');                 // no ?qa: adaptive quality is live
await page.waitForFunction(() => window.__bike?.ready, null, { timeout: 90_000 });
await page.waitForTimeout(800);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const r = await page.evaluate(async () => {
  const B = window.__bike, L = B.layout, from = L.storyTop, to = L.storyTop + L.span, D = 10_000;
  const calls0 = B.renderer.info.render.frame, deltas = [];
  await new Promise(done => {
    let t0 = 0, last = 0;
    const step = t => {
      if (!t0) { t0 = last = t; } else { deltas.push(t - last); last = t; }
      const k = Math.min(1, (t - t0) / D);
      scrollTo(0, from + (to - from) * k);                             // steady 10 s scroll through the whole story
      if (k < 1) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  });
  await B.settled();
  const s = [...deltas].sort((a, b) => a - b), q = f => +s[Math.min(s.length - 1, Math.floor(s.length * f))].toFixed(2);
  return { frames: deltas.length, under20: +(deltas.filter(d => d < 20).length / deltas.length).toFixed(4), p50: q(0.5), p95: q(0.95), p99: q(0.99), max: +s[s.length - 1].toFixed(2),
    rendered: B.renderer.info.render.frame - calls0, qualityLevel: B.quality.i, rendererDpr: B.renderer.getPixelRatio(), pShown: B.p.shown };
});
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
const out = { mode, proxy: 'Chrome headless, desktop GPU (ANGLE D3D11), CPU throttled 4x', viewport: ctxOpts.viewport, deviceDpr: ctxOpts.deviceScaleFactor || 1, ...r };
fs.mkdirSync('qa/results', { recursive: true }); fs.writeFileSync(`qa/results/frames-${mode}.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
await b.close();
