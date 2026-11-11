// WCAG 2.2 AA text contrast for every beat (each scrolled into view at full opacity), header, close and footer.
// Lighthouse only audits the first screen; beats 2-8 are opacity 0 there. node qa/contrast.mjs -> qa/results/contrast.json
import { webkit, chromium } from 'playwright';
import fs from 'node:fs';
const runs = [['webkit-390x844', webkit, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, {}],
  ['chrome-1440x900', chromium, { viewport: { width: 1440, height: 900 } }, { channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11'] }]];
const all = [];
for (const [tag, type, ctxo, launch] of runs) {
  const b = await type.launch(launch), page = await (await b.newContext(ctxo)).newPage();
  await page.goto('http://127.0.0.1:4173/index.html?qa=1'); await page.waitForFunction(() => window.__bike?.ready, null, { timeout: 60000 }); await page.waitForTimeout(700);
  const mids = await page.evaluate(() => window.__bike.STORY.beats.map(([id, a, b]) => [id, id === 'hero' ? 0 : id === 'finish' ? 1 : (a + b) / 2]));
  const where = [...mids, ['close', 'close']];
  for (const [id, p] of where) {
    await page.evaluate(async p => {
      if (p === 'close') { document.getElementById('fitting').scrollIntoView(); await new Promise(r => setTimeout(r, 300)); return; }
      const L = window.__bike.layout; scrollTo(0, Math.round(L.storyTop + p * L.span)); await window.__bike.settled();
    }, p);
    const rows = await page.evaluate(() => {
      const rgb = s => (s.match(/[\d.]+/g) || []).map(Number), lum = c => { const [r, g, b] = c.slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > 0.99)) return c; } return rgb(getComputedStyle(document.documentElement).backgroundColor); };
      const visible = el => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.99) return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; };
      return [...document.querySelectorAll('h1, h2, p, dt, dd, a, footer p')].filter(visible).filter(e => e.textContent.trim()).map(e => {
        const cs = getComputedStyle(e), fg = rgb(cs.color), bg = bgOf(e), [L1, L2] = [lum(fg), lum(bg)].sort((x, y) => y - x);
        const size = parseFloat(cs.fontSize), large = size >= 24 || (size >= 18.66 && +cs.fontWeight >= 700);
        return { text: e.textContent.trim().slice(0, 32), ratio: +((L1 + 0.05) / (L2 + 0.05)).toFixed(2), need: large ? 3 : 4.5, size };
      });
    });
    for (const r of rows) all.push({ run: tag, where: id, ...r, pass: r.ratio >= r.need });
  }
  await b.close();
}
const uniq = new Map(); for (const r of all) { const k = r.run + '|' + r.text; if (!uniq.has(k) || uniq.get(k).ratio > r.ratio) uniq.set(k, r); }
const rows = [...uniq.values()], fails = rows.filter(r => !r.pass), min = Math.min(...rows.map(r => r.ratio));
fs.writeFileSync('qa/results/contrast.json', JSON.stringify({ checked: rows.length, min, fails, rows }, null, 1));
console.log(`checked ${rows.length} text elements, lowest ratio ${min}, failures ${fails.length}`, fails.length ? JSON.stringify(fails) : '');
