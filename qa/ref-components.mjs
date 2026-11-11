import { chromium } from 'playwright';
const URL = 'https://scrollytelling-bike-z23hmxb2gnu5a.needle.run/?room=needle358';
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(URL, { waitUntil: 'networkidle', timeout: 90000 }); await p.waitForTimeout(8000);
const r = await p.evaluate(() => {
  const N = window.Needle, ctx = document.querySelector('needle-engine').context;
  const types = {}; const objs = [];
  ctx.scene.traverse(o => { const cs = N.GameObject.getAllComponents ? N.GameObject.getAllComponents(o) : []; for (const c of cs) { const t = c.constructor.name; (types[t] ||= []).push(o.name); } });
  const out = { types: Object.fromEntries(Object.entries(types).map(([k, v]) => [k, v.slice(0, 6)])) };
  const dirs = N.GameObject.findObjectsOfType ? N.GameObject.findObjectsOfType(N.PlayableDirector) : [];
  out.directors = dirs.map(d => {
    const a = d.playableAsset || d._asset || {};
    return { obj: d.gameObject.name, duration: d.duration, time: d.time, playOnAwake: d.playOnAwake, extrapolation: d.extrapolationMode, wrap: d.wrapMode,
      tracks: (a.tracks || []).map(t => ({ name: t.name, type: t.type, muted: t.muted, outputs: (t.outputs || []).map(o => o?.name || o?.guid || String(o)).slice(0, 3),
        clips: (t.clips || []).map(c => ({ start: c.start, end: c.end, dur: c.duration, easeIn: c.easeInDuration, easeOut: c.easeOutDuration, name: c.asset?.clip?.name || c.asset?.name || c.name, preExt: c.preExtrapolationMode, postExt: c.postExtrapolationMode })) })) };
  });
  const sf = N.GameObject.findObjectsOfType ? N.GameObject.findObjectsOfType(N.ScrollFollow) : [];
  out.scrollFollow = sf.map(s => { const o = {}; for (const k of Object.keys(s)) { const v = s[k]; if (['number','boolean','string'].includes(typeof v)) o[k] = v; } return { obj: s.gameObject.name, ...o }; });
  const pick = (C) => (N.GameObject.findObjectsOfType && C) ? N.GameObject.findObjectsOfType(C).map(s => { const o = { obj: s.gameObject.name }; for (const k of Object.keys(s)) { const v = s[k]; if (['number','boolean','string'].includes(typeof v)) o[k] = v; } return o; }) : 'n/a';
  out.viewBox = pick(N.ViewBox); out.focusRect = pick(N.FocusRect);
  out.camera = (() => { const c = ctx.mainCamera; return { name: c.name, fov: c.fov, near: c.near, far: c.far, parent: c.parent?.name }; })();
  out.renderer = { dpr: ctx.renderer.getPixelRatio(), toneMapping: ctx.renderer.toneMapping, shadows: ctx.renderer.shadowMap.enabled, outputCS: ctx.renderer.outputColorSpace, env: !!ctx.scene.environment, bg: ctx.scene.background ? (ctx.scene.background.isColor ? '#' + ctx.scene.background.getHexString() : 'texture') : null };
  let meshes = 0, tris = 0, mats = new Set(), lights = [];
  ctx.scene.traverse(o => { if (o.isMesh) { meshes++; mats.add(o.material.uuid); const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } if (o.isLight) lights.push(o.type + (o.castShadow ? '(shadow)' : '')); });
  out.sceneStats = { meshes, tris: Math.round(tris), materials: mats.size, lights };
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
