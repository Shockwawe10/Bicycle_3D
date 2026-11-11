import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('https://scrollytelling-bike-z23hmxb2gnu5a.needle.run/?room=needle358', { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForTimeout(5000);
console.log(JSON.stringify(await p.evaluate(() => ({ htmlSnap: getComputedStyle(document.documentElement).scrollSnapType, bodySnap: getComputedStyle(document.body).scrollSnapType,
  aligns: [...document.querySelectorAll('*')].filter(e => getComputedStyle(e).scrollSnapAlign !== 'none').map(e => e.className + ':' + getComputedStyle(e).scrollSnapAlign + '/' + getComputedStyle(e).scrollSnapStop).slice(0, 10),
  titles: [...document.querySelectorAll('.content h1, .content h2')].map(h => h.textContent.trim()), reducedMotionCss: [...document.styleSheets].some(s => { try { return [...s.cssRules].some(r => /prefers-reduced-motion/.test(r.cssText)); } catch { return false; } }) }))));
await b.close();
