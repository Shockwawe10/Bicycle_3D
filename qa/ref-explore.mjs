import { chromium } from 'playwright';
const URL = process.argv[2] || 'https://scrollytelling-bike-z23hmxb2gnu5a.needle.run/?room=needle358';
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(URL, { waitUntil: 'networkidle', timeout: 90000 });
await p.waitForTimeout(9000);
const info = await p.evaluate(() => {
  const out = { title: document.title, scrollH: document.documentElement.scrollHeight, innerH: innerHeight, innerW: innerWidth };
  out.positioned = [...document.querySelectorAll('*')].filter(e => ['sticky','fixed'].includes(getComputedStyle(e).position))
    .map(e => ({ tag: e.tagName.toLowerCase(), id: e.id, cls: String(e.className).slice(0,60), pos: getComputedStyle(e).position, top: getComputedStyle(e).top, rect: e.getBoundingClientRect().toJSON() }));
  out.canvases = [...document.querySelectorAll('canvas')].map(c => ({ w: c.width, h: c.height, css: c.getBoundingClientRect().toJSON(), parent: c.parentElement?.tagName }));
  const ne = document.querySelector('needle-engine');
  out.needle = !!ne; out.hasContext = !!(ne && ne.context);
  out.globals = Object.keys(window).filter(k => /needle|three/i.test(k)).slice(0, 20);
  const walk = (el, d) => d > 4 ? '' : [...el.children].map(c => '  '.repeat(d) + c.tagName.toLowerCase() + (c.id ? '#' + c.id : '') + (c.className && typeof c.className === 'string' ? '.' + c.className.split(' ').slice(0,2).join('.') : '') + ' h=' + Math.round(c.getBoundingClientRect().height) + '\n' + walk(c, d + 1)).join('');
  out.tree = walk(document.body, 0).slice(0, 3000);
  out.text = document.body.innerText.slice(0, 1500);
  return out;
});
console.log(JSON.stringify(info, null, 1));
await b.close();
