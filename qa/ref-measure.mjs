// Phase 0 measurement of the reference (mechanics only). Usage: node qa/ref-measure.mjs desktop|mobile
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
const URL = 'https://scrollytelling-bike-z23hmxb2gnu5a.needle.run/?room=needle358';
const mode = process.argv[2] || 'desktop';
const ctxOpts = mode === 'mobile' ? { ...devices['iPhone 13'], defaultBrowserType: undefined } : { viewport: { width: 1440, height: 900 } };
delete ctxOpts.defaultBrowserType;
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext(ctxOpts);
await ctx.addInitScript(() => { // count draw calls to see whether it renders while idle
  window.__draws = 0; for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) for (const f of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) { const o = C.prototype[f]; if (o) C.prototype[f] = function (...a) { window.__draws++; return o.apply(this, a); }; }
});
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page); await cdp.send('Network.enable');
const net = new Map(); let bytes = 0;
cdp.on('Network.responseReceived', e => net.set(e.requestId, { url: e.response.url, type: e.type, mime: e.response.mimeType }));
cdp.on('Network.loadingFinished', e => { bytes += e.encodedDataLength; const r = net.get(e.requestId); if (r) r.bytes = e.encodedDataLength; });
const t0 = Date.now();
await page.goto(URL, { waitUntil: 'networkidle', timeout: 120000 });
const loadMs = Date.now() - t0;
await page.waitForTimeout(6000);
const out = { mode, viewport: page.viewportSize(), loadMs };
out.doc = await page.evaluate(() => ({ scrollH: document.documentElement.scrollHeight, innerH: innerHeight, innerW: innerWidth, dpr: devicePixelRatio,
  rendererDpr: document.querySelector('needle-engine').context.renderer.getPixelRatio(),
  canvas: (() => { const c = document.querySelector('needle-engine canvas') || document.querySelector('canvas'); return c ? { w: c.width, h: c.height } : null; })(),
  blocks: [...document.querySelectorAll('.content')].map(e => ({ cls: e.className, sticky: getComputedStyle(e).position, parentH: Math.round(e.parentElement.getBoundingClientRect().height), parentTop: Math.round(e.parentElement.getBoundingClientRect().top + scrollY), h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width), x: Math.round(e.getBoundingClientRect().x), font: getComputedStyle(e.querySelector('h1,h2,h3,p') || e).fontSize })) }));
// in-page sampler
await page.evaluate(() => {
  const N = window.Needle, c = document.querySelector('needle-engine').context;
  const dir = N.GameObject.findObjectsOfType(N.PlayableDirector)[0];
  let bike; c.scene.traverse(o => { if (!bike && /CarbonFrameBike/.test(o.name)) bike = o; });
  const tracked = []; bike.traverse(o => { let d = 0, q = o; while (q && q !== bike) { d++; q = q.parent; } if (d >= 1 && d <= 3 && o.name) tracked.push(o); });
  const vb = (() => { let v; c.scene.traverse(o => { if (o.name === 'ViewBox') v = o; }); return v; })();
  const V = new c.mainCamera.position.constructor();
  window.__snap = () => {
    const cam = c.mainCamera; cam.updateMatrixWorld();
    const wp = o => { o.getWorldPosition(V); return [V.x, V.y, V.z].map(n => +n.toFixed(4)); };
    const wq = o => { const q = new cam.quaternion.constructor(); o.getWorldQuaternion(q); return [q.x, q.y, q.z, q.w].map(n => +n.toFixed(4)); };
    return { time: dir.time, cam: { p: wp(cam), q: wq(cam), fov: cam.fov }, vb: vb ? { p: wp(vb), s: vb.scale.toArray().map(n => +n.toFixed(4)) } : null,
      parts: tracked.map(o => wp(o).concat(o.visible ? 1 : 0)),
      blocks: [...document.querySelectorAll('.content')].map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.top), +getComputedStyle(e).opacity]; }), draws: window.__draws };
  };
  window.__names = tracked.map(o => o.name);
  window.__dir = dir;
});
const maxY = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
const settle = async () => { let last = -1, still = 0; for (let i = 0; i < 200 && still < 4; i++) { await page.waitForTimeout(30); const t = await page.evaluate(() => window.__dir.time); still = Math.abs(t - last) < 1e-4 ? still + 1 : 0; last = t; } };
out.names = await page.evaluate(() => window.__names);
out.samples = [];
for (let i = 0; i <= 100; i++) {
  const y = Math.round(maxY * i / 100);
  await page.evaluate(y => window.scrollTo(0, y), y); await settle();
  const s = await page.evaluate(() => window.__snap()); s.p = i / 100; s.y = y; out.samples.push(s);
  if (i % 25 === 0) await page.screenshot({ path: `qa/reference/${mode}-p${String(i).padStart(3, '0')}.png` });
}
// damping: jump 0 -> 50% and record time series
await page.evaluate(() => window.scrollTo(0, 0)); await settle();
out.damping = await page.evaluate(async (y) => { const s = []; const t0 = performance.now(); window.scrollTo(0, y); await new Promise(r => { const f = () => { s.push([+(performance.now() - t0).toFixed(1), +window.__dir.time.toFixed(4)]); if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); }); return s; }, Math.round(maxY / 2));
// frame behaviour: idle draws/s and rAF deltas during a scripted 6 s scroll
out.frames = await page.evaluate(async (maxY) => {
  const idle0 = window.__draws; await new Promise(r => setTimeout(r, 2000)); const idleDrawsPerSec = (window.__draws - idle0) / 2;
  const d = []; let last = performance.now(); const t0 = last; const d0 = window.__draws;
  await new Promise(r => { const f = (t) => { d.push(t - last); last = t; const k = (t - t0) / 6000; window.scrollTo(0, (maxY / 2) * (1 - Math.cos(Math.PI * Math.min(k, 1))) ); if (k < 1) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
  d.shift(); d.sort((a, b) => a - b);
  return { idleDrawsPerSec, scrollDrawsPerSec: (window.__draws - d0) / 6, frames: d.length, p50: +d[Math.floor(d.length * .5)].toFixed(2), p95: +d[Math.floor(d.length * .95)].toFixed(2), under20: +(d.filter(x => x < 20).length / d.length).toFixed(3) };
}, maxY);
const res = [...net.values()].filter(r => r.bytes);
const byType = {}; for (const r of res) { const k = (r.url.match(/\.(glb|gltf|ktx2|js|css|wasm|png|jpg|webp|woff2?|hdr|exr|bin|html)(\?|$)/i)?.[1] || r.type || 'other').toLowerCase(); byType[k] = (byType[k] || 0) + r.bytes; }
out.weight = { totalKB: Math.round(bytes / 1024), requests: res.length, byTypeKB: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, Math.round(v / 1024)]).sort((a, b) => b[1] - a[1])), top: res.sort((a, b) => b.bytes - a.bytes).slice(0, 8).map(r => [Math.round(r.bytes / 1024) + 'KB', r.url.split('/').pop().slice(0, 60)]) };
fs.writeFileSync(`qa/reference/${mode}.json`, JSON.stringify(out));
console.log(JSON.stringify({ mode, viewport: out.viewport, doc: { ...out.doc, blocks: out.doc.blocks.length + ' blocks: ' + JSON.stringify(out.doc.blocks[0]) }, weight: out.weight, frames: out.frames, parts: out.names.length }, null, 1));
await b.close();
