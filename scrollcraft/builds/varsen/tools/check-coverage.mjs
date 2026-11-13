// No bare half screen in a pinned act: node scrollcraft/builds/varsen/tools/check-coverage.mjs [port]
// Why: the scroll-craft dead-scroll check passes as long as any pixel moves, so a 3D bike turning above a faded-out
// copy block read as green (the iPhone hero gap, fixed in 962c495). This steps each pinned act (#front, #detail)
// through its pin in 5% steps at 390x844 and 1440x900, screenshots each frame, and counts content pixels in the top
// and bottom halves of the screen (below the phone's 52 px running head, right of the desktop's 76 px folio rail).
// A content pixel is brighter than the frame's ground (its 25th-percentile luminance) by more than 30 levels: the
// type, the paint, the plate. The hero's radial light (+21 at most) and the film grain stay below that.
// Fails when either half drops under 1.5% content at any step. Exit code 1 on failure.
import { chromium } from 'playwright';
const port = process.argv[2] || '4500', MIN = 1.5, ACTS = ['front', 'detail'];
const VIEWS = [{ w: 390, h: 844, top: 52, left: 0 }, { w: 1440, h: 900, top: 0, left: 76 }];
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const decoder = await (await b.newContext()).newPage();
// luminance histogram per half, computed from the PNG in a blank page (no decoder dependency)
async function coverage(png, v) {
  return decoder.evaluate(async ({ src, v }) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = new OffscreenCanvas(img.width, img.height), x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, img.width, img.height).data, W = img.width;
    const mid = Math.round(v.top + (v.h - v.top) / 2), lum = i => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    const hist = new Uint32Array(256); let n = 0;
    for (let y = v.top; y < v.h; y += 2) for (let xx = v.left; xx < W; xx += 2) { hist[lum((y * W + xx) * 4) | 0]++; n++; }
    let acc = 0, ground = 0; for (; ground < 256; ground++) { acc += hist[ground]; if (acc >= n * 0.25) break; }
    const half = (y0, y1) => { let on = 0, all = 0; for (let y = y0; y < y1; y++) for (let xx = v.left; xx < W; xx++) { all++; if (lum((y * W + xx) * 4) > ground + 30) on++; } return 100 * on / all; };
    return { ground, top: half(v.top, mid), bottom: half(mid, v.h) };
  }, { src: 'data:image/png;base64,' + png.toString('base64'), v });
}
let failed = 0;
for (const v of VIEWS) {
  const page = await (await b.newContext({ viewport: { width: v.w, height: v.h } })).newPage();
  await page.goto(`http://127.0.0.1:${port}/?qa=1`);
  await page.waitForFunction(() => window.__bike?.ready === true, null, { timeout: 90000 });
  await page.waitForTimeout(900);                    // the plate canvases fade in over 600 ms
  for (const act of ACTS) {
    const rows = [];
    for (let k = 0; k <= 20; k++) {
      const p = k / 20;
      await page.evaluate(([id, p]) => { const s = document.getElementById(id), top = s.getBoundingClientRect().top + scrollY; scrollTo(0, Math.round(top + p * Math.max(0, s.offsetHeight - innerHeight))); }, [act, p]);
      await page.evaluate(() => window.__bike.settled()); await page.waitForTimeout(120);
      const r = await coverage(await page.screenshot(), v);
      rows.push({ p, ...r });
    }
    const bad = rows.filter(r => r.top < MIN || r.bottom < MIN);
    const minTop = Math.min(...rows.map(r => r.top)), minBottom = Math.min(...rows.map(r => r.bottom));
    console.log(`${v.w}x${v.h} #${act}: content min top ${minTop.toFixed(1)}%, min bottom ${minBottom.toFixed(1)}%` +
      (bad.length ? `  FAIL at p ${bad.map(r => `${r.p.toFixed(2)} (top ${r.top.toFixed(1)}, bottom ${r.bottom.toFixed(1)})`).join(', ')}` : '  ok'));
    failed += bad.length;
  }
  await page.close();
}
await b.close();
console.log(failed ? `\n${failed} frames with a bare half screen (under ${MIN}% content)` : `\nno bare half screen in any pinned act`);
process.exitCode = failed ? 1 : 0;
