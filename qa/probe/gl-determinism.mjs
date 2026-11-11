import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:4173/index.html?qa=1'); await page.waitForFunction(() => window.__bike?.ready); await page.waitForTimeout(700);
await page.evaluate(async () => { const L = window.__bike.layout; scrollTo(0, Math.round(L.storyTop + 0.356 * L.span)); await window.__bike.settled(); });
console.log(JSON.stringify(await page.evaluate(async () => {
  const B = window.__bike, r = B.renderer, gl = r.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const read = () => { r.render(B.scene, B.camera); const px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
  const a = read(), out = { w, h, runs: [] };
  for (let k = 0; k < 4; k++) { const c = read(); let n = 0, mx = 0, partial = 0; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - c[i]); if (d) { n++; mx = Math.max(mx, d); } } out.runs.push({ diffBytes: n, max: mx }); }
  let partialAlpha = 0; for (let i = 3; i < a.length; i += 4) if (a[i] > 0 && a[i] < 255) partialAlpha++; out.partialAlphaPixels = partialAlpha;
  return out;
})));
await b.close();
