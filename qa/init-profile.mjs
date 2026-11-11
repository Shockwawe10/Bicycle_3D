// Init phases and long tasks: node qa/init-profile.mjs [cpuThrottle]
import { chromium } from 'playwright';
const rate = Number(process.argv[2] || 1);
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { window.__long = []; new PerformanceObserver(l => l.getEntries().forEach(e => window.__long.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true }); });
const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate });
await p.goto('http://127.0.0.1:4173/index.html'); await p.waitForFunction(() => window.__bike?.ready, null, { timeout: 90000 }); await p.waitForTimeout(500);
console.log(JSON.stringify(await p.evaluate(() => ({ marks: performance.getEntriesByType('mark').filter(m => m.name.startsWith('bike:')).map(m => m.name.slice(5) + '@' + Math.round(m.startTime)), fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime), long: window.__long, steps: window.__bike.steps, tbtApprox: window.__long.reduce((s, [, d]) => s + Math.max(0, d - 50), 0) }))));
await b.close();
