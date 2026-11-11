// Screenshot the three comps at 390x844 (WebKit) and 1440x900 (Chrome) and measure contrast / overlap / overflow.
import { webkit, chromium } from 'playwright';
const base = 'http://127.0.0.1:4173/qa/comps/';
const runs = [['m', webkit, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['d', chromium, { viewport: { width: 1440, height: 900 } }]];
const lum = c => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
for (const v of ['a', 'b', 'c']) for (const [tag, type, opts] of runs) {
  const br = await type.launch(); const p = await (await br.newContext(opts)).newPage();
  await p.goto(base + `variant-${v}.html`, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.screenshot({ path: `qa/comps/variant-${v}-${tag === 'm' ? '390x844' : '1440x900'}.png`, fullPage: true });
  const r = await p.evaluate(() => {
    const bg = getComputedStyle(document.body).backgroundColor, out = { bg, texts: [], overlaps: [], hscroll: document.documentElement.scrollWidth > innerWidth };
    for (const s of document.querySelectorAll('.screen')) {
      const sr = s.getBoundingClientRect(), bike = s.querySelector('.bike').getBoundingClientRect();
      // bike's opaque box is ~ the img box minus 8px padding
      const els = [...s.querySelectorAll('h1,h2,p,li,td,.stage,.btn,.brand,.dim')].filter(e => e.offsetParent && e.getBoundingClientRect().height);
      for (const e of els) {
        const cs = getComputedStyle(e), r = e.getBoundingClientRect();
        out.texts.push([e.tagName.toLowerCase() + (e.className ? '.' + e.className.split(' ')[0] : ''), cs.color, cs.backgroundColor, +parseFloat(cs.fontSize).toFixed(0)]);
        const hit = !(r.right < bike.left + 8 || r.left > bike.right - 8 || r.bottom < bike.top + 8 || r.top > bike.bottom - 8);
        if (hit && !e.closest('.nav') && !e.classList.contains('dim')) out.overlaps.push(e.tagName + ':' + e.textContent.trim().slice(0, 24));
        if (r.bottom > sr.bottom + 1 || r.right > sr.right + 1 || r.left < sr.left - 1) out.overlaps.push('CLIPPED ' + e.textContent.trim().slice(0, 24));
      }
    }
    return out;
  });
  const worst = {}; for (const [k, col, bgc] of r.texts) { const b2 = bgc === 'rgba(0, 0, 0, 0)' ? r.bg : bgc; const cr = ratio(col, b2); if (!(k in worst) || cr < worst[k]) worst[k] = +cr.toFixed(2); }
  const minCr = Math.min(...Object.values(worst));
  console.log(`variant ${v} ${tag === 'm' ? '390x844 webkit ' : '1440x900 chrome'} minContrast=${minCr} hscroll=${r.hscroll} overlapsWithBike=${JSON.stringify([...new Set(r.overlaps)])}`);
  if (process.env.VERBOSE) console.log('  ', JSON.stringify(worst));
  await br.close();
}
