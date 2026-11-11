// Capture the parallax prototype at p = 0, 0.5, 1 and report how far each layer moved (px) and the sticky stage's top.
import { webkit, chromium } from 'playwright';
for (const [tag, type, opts] of [['390x844', webkit, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['1440x900', chromium, { viewport: { width: 1440, height: 900 } }]]) {
  const b = await type.launch(); const p = await (await b.newContext(opts)).newPage();
  await p.goto('http://127.0.0.1:4173/qa/comps/parallax.html'); await p.waitForTimeout(300);
  const rows = [];
  for (const k of [0, 0.5, 1]) {
    await p.evaluate(k => { const s = document.querySelector('.story'); scrollTo(0, s.offsetTop + k * (s.offsetHeight - innerHeight)); }, k);
    await p.waitForTimeout(250);
    rows.push(await p.evaluate(() => ({ p: document.documentElement.dataset.p, stageTop: document.querySelector('.stage').getBoundingClientRect().top,
      moves: [...document.querySelectorAll('.layer')].map(l => l.className.split(' ')[1] + ':' + l.style.transform.replace(/translate3d\(|, 0px\)|px/g, '')) })));
    await p.screenshot({ path: `qa/comps/parallax-${tag}-p${String(k * 100).padStart(3, '0')}.png` });
  }
  console.log(tag, JSON.stringify(rows));
  await b.close();
}
