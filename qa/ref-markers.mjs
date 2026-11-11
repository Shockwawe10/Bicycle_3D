import { chromium, devices } from 'playwright';
const URL = 'https://scrollytelling-bike-z23hmxb2gnu5a.needle.run/?room=needle358';
const mode = process.argv[2] || 'desktop';
const opts = mode === 'mobile' ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 } }; delete opts.defaultBrowserType;
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext(opts)).newPage();
await p.goto(URL, { waitUntil: 'networkidle', timeout: 90000 }); await p.waitForTimeout(6000);
console.log(JSON.stringify(await p.evaluate(() => {
  const N = window.Needle; const dir = N.GameObject.findObjectsOfType(N.PlayableDirector)[0];
  const a = dir.playableAsset; const mt = a.tracks.find(t => t.type === 'MarkerTrack');
  const markers = (mt.markers || []).map(m => ({ time: +m.time.toFixed(3), type: m.type, name: m.name, sel: m.selector || m.text || '' }));
  const tagged = [...document.querySelectorAll('[data-timeline-marker],[data-timeline-time],[data-scroll-marker]')].map(e => ({ tag: e.tagName, attrs: [...e.attributes].map(x => x.name + '=' + x.value).join(' ').slice(0, 90), top: Math.round(e.getBoundingClientRect().top + scrollY), h: Math.round(e.getBoundingClientRect().height) }));
  const blocks = [...document.querySelectorAll('.content')].map(e => { const P = e.parentElement; const r = P.getBoundingClientRect(); return { parent: P.tagName + '.' + P.className, attrs: [...P.attributes].map(x => x.name + '=' + x.value).join(' ').slice(0, 80), top: Math.round(r.top + scrollY), h: Math.round(r.height), blockH: Math.round(e.getBoundingClientRect().height), blockW: Math.round(e.getBoundingClientRect().width), x: Math.round(e.getBoundingClientRect().x), h1: getComputedStyle(e.querySelector('h1,h2') || e).fontSize, p: getComputedStyle(e.querySelector('p') || e).fontSize, words: e.innerText.split(/\s+/).length }; });
  const body = getComputedStyle(document.body); const cs = getComputedStyle(document.documentElement);
  return { markers, tagged, blocks, scrollH: document.documentElement.scrollHeight, innerH: innerHeight, bodyBg: body.backgroundColor, fonts: body.fontFamily, scrollBehavior: cs.scrollBehavior, overscroll: cs.overscrollBehavior, snap: cs.scrollSnapType, touchAction: body.touchAction, neCss: (() => { const n = document.querySelector('needle-engine'); const s = getComputedStyle(n); return { pos: s.position, w: s.width, h: s.height, z: s.zIndex, pe: s.pointerEvents }; })() };
}), null, 1));
await b.close();
