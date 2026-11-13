// Keyboard walk of the Varsen build: node scrollcraft/builds/varsen/tools/check-keyboard.mjs [w] [h]
// Tabs from the top, logs every stop (what it is, whether it is on screen, whether a focus ring is drawn),
// then exercises the skip link, the folio and the size chooser from the keyboard.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
const [w = '1440', h = '900'] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: +w, height: +h } })).newPage();
const errors = [];
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://127.0.0.1:4500/?qa=1');
await p.waitForFunction(() => window.__bike?.ready === true, null, { timeout: 60000 });
const stops = [];
for (let i = 0; i < 40; i++) {
  await p.keyboard.press('Tab'); await p.waitForTimeout(1100);   // focus scrolling is smooth (scroll-behavior: smooth)
  const s = await p.evaluate(() => {
    const e = document.activeElement; if (!e || e === document.body) return null;
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    const ring = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 || cs.boxShadow !== 'none';
    const label = (e.getAttribute('aria-label') || e.innerText || e.value || e.name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return { tag: e.tagName.toLowerCase() + (e.type ? `[${e.type}]` : ''), label, onScreen: r.bottom > 0 && r.top < innerHeight && r.width > 0, ring, y: Math.round(scrollY) };
  });
  if (!s) { stops.push({ tag: '(body)' }); break; }
  stops.push(s);
  if (stops.length > 2 && stops.at(-1).label === stops[0].label && stops.at(-1).tag === stops[0].tag) break;
}
for (const [i, s] of stops.entries()) console.log(String(i).padStart(2), s.tag.padEnd(16), (s.label ?? '').padEnd(42), s.onScreen ? 'on-screen' : 'OFF-SCREEN', s.ring ? 'ring' : 'NO RING', s.y ?? '');
await p.screenshot({ path: 'qa/tmp/tab-last.png' });

// The hero plate turns from the keyboard
await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(600);
await p.locator('[data-plate="front"]').focus();
const hint = await p.evaluate(() => [...document.querySelectorAll('.drag-hint > span')].map(s => `${s.className}:${getComputedStyle(s).display}`).join(' '));
const yaw0 = await p.evaluate(() => window.__bike.spin.yaw);
for (let i = 0; i < 3; i++) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(80); }
await p.waitForTimeout(1500);
const yaw1 = await p.evaluate(() => window.__bike.spin.yaw);
console.log(`plate focus hint: ${hint}; yaw ${yaw0.toFixed(3)} -> ${yaw1.toFixed(3)} rad after 3 x ArrowRight (expect ~${(3 * Math.PI / 12).toFixed(3)}), scrollY ${await p.evaluate(() => scrollY)}`);
await p.screenshot({ path: 'qa/tmp/tab-plate.png' });

// In detail from the keyboard: a point takes focus, Enter flies in and moves focus to the part, ArrowRight steps to the
// next part, Escape flies back and returns focus to the point of the part last shown.
await p.evaluate(() => document.getElementById('detail').scrollIntoView({ behavior: 'instant' })); await p.waitForTimeout(500);
const land = () => p.waitForFunction(() => !window.__bike.detail.flying, null, { timeout: 5000 });
const where = () => p.evaluate(() => ({ cur: window.__bike.detail.cur, focus: document.activeElement?.id || document.activeElement?.className }));
await p.locator('.spot[data-spot="1"]').focus();
const ring = await p.evaluate(() => getComputedStyle(document.querySelector('.spot[data-spot="1"] .spot__dot')).outlineStyle);
await p.keyboard.press('Enter'); await land(); const a1 = await where();
await p.keyboard.press('ArrowRight'); await land(); const a2 = await where();
await p.keyboard.press('Escape'); await land(); await p.waitForTimeout(100); const a3 = await where();
console.log(`in detail: point ring ${ring}; Enter -> ${JSON.stringify(a1)}; ArrowRight -> ${JSON.stringify(a2)}; Escape -> ${JSON.stringify(a3)}`);
await p.screenshot({ path: 'qa/tmp/tab-detail.png' });

// The chooser from the keyboard: focus the height field, type 186, wait for the debounce, read back the result.
await p.locator('#height').focus(); await p.keyboard.type('186'); await p.waitForTimeout(900);
const chosen = await p.evaluate(() => ({ out: document.getElementById('height-out').textContent.trim(), checked: document.querySelector('input[name="size"]:checked')?.value, cap: document.querySelector('[data-yours-cap]')?.textContent.trim() }));
console.log('height 186 ->', JSON.stringify(chosen));
// Arrow keys move through the size radios
await p.locator('input[name="size"]:checked').focus(); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(900);
console.log('ArrowLeft ->', await p.evaluate(() => document.querySelector('input[name="size"]:checked')?.value));
await p.screenshot({ path: 'qa/tmp/tab-chooser.png' });
console.log('errors', JSON.stringify(errors));
await b.close();
