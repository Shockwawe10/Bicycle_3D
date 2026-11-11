// Phase 4 behaviour checks against the spec in STORYBOARD.md / GEOMETRY.md (parsed in spec-data.mjs, never read from the page).
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { joints, MOUNT, stages, cameraKeys, beats, reduced } from './spec-data.mjs';

const OUT = 'qa/results'; fs.mkdirSync(OUT, { recursive: true });
// Playwright's WebKit screenshot injects a stylesheet that the page's strict CSP refuses (never logged without screenshots).
// Drop exactly that message, and only what was logged during the screenshot call.
async function shot(page, errors, opts = {}) {
  const n = errors.length, buf = await page.screenshot({ caret: 'initial', ...opts }); await page.waitForTimeout(60);
  for (let i = errors.length - 1; i >= n; i--) if (/^Refused to apply a stylesheet because its hash/.test(errors[i])) errors.splice(i, 1);
  return buf;
}
const record = (name, data) => fs.writeFileSync(`${OUT}/${name}.json`, JSON.stringify(data, null, 1));

async function open(page, query = 'qa=1') {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`/index.html?${query}`);
  await page.waitForFunction(() => window.__bike?.ready === true, null, { timeout: 60_000 });
  await page.waitForTimeout(700);                   // canvas fade-in and hero entrance finish
  return errors;
}
/** Native scroll to progress p; p measured independently from the DOM (not from __bike.layout). */
async function scrollToP(page, p) {
  return page.evaluate(async p => {
    const story = document.querySelector('.story'), stage = document.getElementById('stage');
    const top = story.getBoundingClientRect().top + scrollY, span = story.offsetHeight - stage.clientHeight;
    scrollTo(0, Math.round(top + p * span));
    await window.__bike.settled();
    return { pScroll: (scrollY - top) / span, shown: window.__bike.p.shown };
  }, p);
}
const pose = page => page.evaluate(() => {
  const B = window.__bike, out = {};
  for (const [id, g] of Object.entries(B.parts)) {
    let solid = true; g.traverse(o => { if (o.isMesh && (o.material.transparent || o.material.alphaHash)) solid = false; });
    out[id] = { pos: g.position.toArray(), q: g.quaternion.toArray(), visible: g.visible, solid };
  }
  const cam = B.camera, dir = cam.getWorldDirection(new cam.position.constructor());
  return { parts: out, view: { az: B.gl.view.az, el: B.gl.view.el }, dir: dir.toArray(), shadow: B.gl.shadow.material.opacity,
    beats: [...document.querySelectorAll('.beat')].map(b => [b.dataset.beat, +getComputedStyle(b).opacity]) };
});
const qAxisAngle = (axis, deg) => { const n = Math.hypot(...axis), h = deg * Math.PI / 360, s = Math.sin(h) / n; return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(h)]; };
const close = (a, b, tol, label) => a.forEach((x, i) => expect(Math.abs(x - b[i]), `${label}[${i}] ${x} vs ${b[i]}`).toBeLessThanOrEqual(tol));
const sameQuat = (a, b, tol, label) => { const d = Math.abs(a.reduce((s, x, i) => s + x * b[i], 0)); expect(1 - d, `${label} quaternion`).toBeLessThanOrEqual(tol); close(a.map(x => x * Math.sign(a.reduce((s, y, i) => s + y * b[i], 0)) || x), b, tol, label); };

test('p = 0 and p = 1 match the storyboard spec transforms (1e-3)', async ({ page }) => {
  const errors = await open(page), J = joints(), S = stages(), C = cameraKeys(), Bt = beats();
  const home = id => [J[MOUNT[id]][0] / 1000, J[MOUNT[id]][1] / 1000, 0];
  const camDir = (az, el) => { const a = az * Math.PI / 180, e = el * Math.PI / 180; return [-Math.sin(a) * Math.cos(e), -Math.sin(e), -Math.cos(a) * Math.cos(e)]; };
  const report = {};
  for (const p of [0, 1]) {
    const m = await scrollToP(page, p); expect(m.shown).toBe(p);
    const got = await pose(page); report[p] = got;
    for (const s of S) {
      const g = got.parts[s.part];
      const wantPos = p === 0 ? home(s.part).map((x, i) => x + s.off[i]) : home(s.part);
      close(g.pos, wantPos, 1e-3, `${s.part}.pos@${p}`);
      sameQuat(g.q, p === 0 ? qAxisAngle(s.axis, s.deg) : [0, 0, 0, 1], 1e-3, `${s.part}.rot@${p}`);
      const wantOpacity = p === 0 ? s.o0 : 1;
      expect(g.visible, `${s.part}.visible@${p}`).toBe(wantOpacity > 0);
      if (wantOpacity === 1) expect(g.solid, `${s.part}.solid@${p}`).toBe(true);
    }
    const key = C.find(k => k[0] === p);
    expect(Math.abs(got.view.az - key[1]), `camera az@${p}`).toBeLessThanOrEqual(1e-3);
    expect(Math.abs(got.view.el - key[2]), `camera el@${p}`).toBeLessThanOrEqual(1e-3);
    close(got.dir, camDir(key[1], key[2]), 1e-3, `camera dir@${p}`);
    const visibleBeats = got.beats.filter(([, o]) => o > 0.001).map(([id]) => id);
    expect(visibleBeats).toEqual([p === 0 ? Bt[0].id : Bt[Bt.length - 1].id]);
    expect(Math.abs(got.shadow - (p === 0 ? 0 : 0.8))).toBeLessThanOrEqual(1e-3);
  }
  record(`spec-transforms-${test.info().project.name}`, report);
  expect(errors).toEqual([]);
});

test('20 random scroll jumps give screenshots identical to sequential scrolling', async ({ page }) => {
  test.setTimeout(480_000);
  await open(page);
  let seed = 20261111; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const targets = Array.from({ length: 20 }, () => Math.round(rnd() * 1000) / 1000);
  const sequential = new Map();
  for (const p of [...targets].sort((a, b) => a - b)) {            // walk forward through the story, stopping at each target
    const from = await page.evaluate(() => window.__bike.p.shown);
    for (let k = 1; k <= 2; k++) await scrollToP(page, from + (p - from) * k / 2);
    sequential.set(p, (await page.screenshot({ caret: 'initial' })).toString('base64'));
  }
  await scrollToP(page, 0);
  const mismatches = [];
  for (const p of targets) {                                       // jump straight to each target, in random order
    await scrollToP(page, p);
    const shot = (await page.screenshot({ caret: 'initial' })).toString('base64');
    if (shot !== sequential.get(p)) { mismatches.push(p); fs.writeFileSync(`${OUT}/jump-mismatch-${test.info().project.name}-${p}.png`, Buffer.from(shot, 'base64')); }
  }
  record(`jumps-${test.info().project.name}`, { targets, mismatches });
  expect(mismatches).toEqual([]);
});

test('checkpoints: no clipped bike, no overlapping text, no horizontal scroll', async ({ page }) => {
  const errors = await open(page), proj = test.info().project.name, rows = [];
  for (const p of [0, 0.25, 0.5, 0.75, 1]) {
    await scrollToP(page, p);
      await shot(page, errors, { path: `${OUT}/${proj}-p${String(p * 100).padStart(3, '0')}.png` });
    const r = await page.evaluate(() => {
      const B = window.__bike, T = B.THREE, cam = B.camera, W = innerWidth, H = innerHeight, svh = B.layout.svh;
      const box = new T.Box3(), tmp = new T.Box3();
      for (const g of Object.values(B.parts)) if (g.visible) box.union(tmp.setFromObject(g));
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i < 8; i++) {
        const v = new T.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(cam);
        const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      const bike = { x0, y0, x1, y1 };
      const shown = el => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.01) return false; } return true; };
      const texts = [...document.querySelectorAll('.beat h1, .beat h2, .beat p, .specs dt, .specs dd, .beat .btn, .top .brand, .top .btn')]
        .filter(shown).map(e => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim().slice(0, 30), x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }; }).filter(r => r.x1 > r.x0 && r.y1 > r.y0);
      const hit = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.5 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0.5;
      const textOverlaps = [], bikeOverText = [], textOut = [];
      texts.forEach((a, i) => texts.slice(i + 1).forEach(b => { if (hit(a, b)) textOverlaps.push([a.t, b.t]); }));
      texts.forEach(a => { if (hit(a, bike)) bikeOverText.push(a.t); if (a.x0 < -0.5 || a.x1 > W + 0.5 || a.y0 < -0.5 || a.y1 > svh + 0.5) textOut.push(a.t); });
      return { W, H, svh, bike, clipped: x0 < -0.5 || y0 < -0.5 || x1 > W + 0.5 || y1 > svh + 0.5, textOverlaps, bikeOverText, textOut,
        hScroll: document.documentElement.scrollWidth > W, stageTop: document.getElementById('stage').getBoundingClientRect().top, texts: texts.length };
    });
    rows.push({ p, ...r });
    expect(r.clipped, `bike clipped at p=${p}: ${JSON.stringify(r.bike)}`).toBe(false);
    expect(r.textOverlaps, `text overlaps at p=${p}`).toEqual([]);
    expect(r.bikeOverText, `bike over text at p=${p}`).toEqual([]);
    expect(r.textOut, `text outside the viewport at p=${p}`).toEqual([]);
    expect(r.hScroll, `horizontal scroll at p=${p}`).toBe(false);
    expect(r.stageTop).toBe(0);
  }
  record(`checkpoints-${proj}`, rows);
  expect(errors).toEqual([]);
});

test('stage timing matches the storyboard within 10% of each stage', async ({ page }) => {
  // Motion is monotonic, so "the measured boundary lies within +-10% of the stage" is exactly: the part is still at its
  // start pose at a - tol and has left it at a + tol (and the same for arriving home at b). Bisect inside that bracket
  // to report the measured value. p is measured from the DOM scroll position, not from the page's own state.
  test.setTimeout(480_000);
  await open(page);
  const S = stages(), J = joints();
  const probe = async (p, s) => {
    const { pScroll } = await scrollToP(page, Math.max(0, Math.min(1, p)));
    const g = await page.evaluate(id => { const o = window.__bike.parts[id]; return { pos: o.position.toArray(), q: o.quaternion.toArray() }; }, s.part);
    const h = [J[MOUNT[s.part]][0] / 1000, J[MOUNT[s.part]][1] / 1000, 0];
    const fromStart = Math.hypot(...g.pos.map((x, i) => x - (h[i] + s.off[i]))), fromHome = Math.hypot(...g.pos.map((x, i) => x - h[i]));
    return { pScroll, atStart: fromStart < 1e-5 && Math.abs(Math.abs(g.q[3]) - Math.cos(s.deg * Math.PI / 360)) < 1e-6, atHome: fromHome < 1e-5 && Math.abs(Math.abs(g.q[3]) - 1) < 1e-9 };
  };
  const rows = [];
  for (const s of S) {
    const tol = 0.1 * (s.b - s.a), row = { part: s.part, spec: [s.a, s.b], tolerance: +tol.toFixed(4) };
    for (const [edge, x, flag, before] of [['start', s.a, 'atStart', true], ['end', s.b, 'atHome', false]]) {
      let lo = await probe(x - tol, s), hi = await probe(x + tol, s);
      row[edge + 'Bracket'] = [lo[flag] === before, hi[flag] !== before];            // both must be true
      for (let k = 0; k < 6 && row[edge + 'Bracket'].every(Boolean); k++) {
        const mid = await probe((lo.pScroll + hi.pScroll) / 2, s);
        if (mid[flag] === before) lo = mid; else hi = mid;
      }
      row[edge] = +((lo.pScroll + hi.pScroll) / 2).toFixed(4);
      row[edge + 'Err'] = +Math.abs(row[edge] - x).toFixed(4);
    }
    rows.push(row);
  }
  record(`timing-${test.info().project.name}`, rows);
  for (const r of rows) {
    expect(r.startBracket, `${r.part} start bracket at ${r.spec[0]} +- ${r.tolerance}`).toEqual([true, true]);
    expect(r.endBracket, `${r.part} end bracket at ${r.spec[1]} +- ${r.tolerance}`).toEqual([true, true]);
    expect(r.startErr).toBeLessThanOrEqual(r.tolerance); expect(r.endErr).toBeLessThanOrEqual(r.tolerance);
  }
});

test('reduced motion: five discrete states, no tween, static backdrop', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  const R = reduced(), want = pt => R.reduce((acc, [th, shown]) => (pt >= th ? shown : acc), 0), seen = new Set();
  for (const pt of [0, 0.1, 0.23, 0.25, 0.39, 0.41, 0.6, 0.67, 0.87, 0.89, 1]) {
    const { shown } = await scrollToP(page, pt);
    expect(shown, `scroll p ${pt}`).toBeCloseTo(want(pt), 6);
    seen.add(shown);
    const moved = await page.evaluate(() => [...document.querySelectorAll('[data-layer]')].map(e => (e.style.transform.replace(/^[^(]*\(|\)[^)]*$/g, '').match(/-?[\d.]+/g) || []).map(Number).some(v => Math.abs(v) > 1e-6)));
    expect(moved, `backdrop moved at scroll p ${pt}`).toEqual(moved.map(() => false));
  }
  expect([...seen].sort()).toEqual(R.map(r => r[1]).sort());
});

test('no WebGL: static poster drawn from the joints, text intact', async ({ page }) => {
  await page.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : g.call(this, t, ...a); }; });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/index.html?qa=1');
  await page.waitForFunction(() => window.__bike?.ready === true, null, { timeout: 60_000 });
  const r = await page.evaluate(() => ({ cls: document.documentElement.className, poster: (() => { const s = document.querySelector('#poster svg'), b = s?.getBoundingClientRect(); return s && getComputedStyle(document.getElementById('poster')).display !== 'none' ? [Math.round(b.width), Math.round(b.height), s.querySelectorAll('path,circle').length] : null; })(), h1: document.querySelector('h1').getBoundingClientRect().height }));
  expect(r.cls).toContain('no-webgl');
  expect(r.poster).not.toBeNull(); expect(r.poster[0]).toBeGreaterThan(100); expect(r.poster[2]).toBeGreaterThan(8);
  expect(r.h1).toBeGreaterThan(20);
  expect(errors).toEqual([]);
});

test('context loss shows the poster, restore brings the 3D back; dispose frees GPU memory', async ({ page }) => {
  const errors = await open(page);
  await scrollToP(page, 0.5);
  await page.evaluate(() => { window.__lose = window.__bike.renderer.getContext().getExtension('WEBGL_lose_context'); window.__bike.renderer.forceContextLoss(); });
  await page.waitForFunction(() => !document.documentElement.classList.contains('gl-ready'));
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('poster')).display)).not.toBe('none');
  await page.evaluate(() => window.__lose.restoreContext());
  await page.waitForFunction(() => document.documentElement.classList.contains('gl-ready'), null, { timeout: 30_000 });
  await scrollToP(page, 0.75);
  const before = await page.evaluate(() => ({ ...window.__bike.renderer.info.memory, calls: window.__bike.renderer.info.render.calls }));
  expect(before.calls).toBeGreaterThan(0);
  const after = await page.evaluate(() => { window.__bike.dispose(); return { ...window.__bike.renderer.info.memory, contextLost: window.__bike.renderer.getContext().isContextLost() }; });
  record(`gpu-memory-${test.info().project.name}`, { before, after });
  expect(after.geometries).toBe(0);
  expect(after.textures).toBeLessThanOrEqual(1);   // the one PMREM-internal texture three r185 never releases (qa/probe/leak.html)...
  expect(after.contextLost).toBe(true);            // ...which the forced context loss frees with everything else
  expect(errors.filter(e => !/CONTEXT_LOST|context lost/i.test(e))).toEqual([]);
});

test('a quality change at rest redraws the bike (resizing the canvas clears it)', async ({ page }) => {
  // Regression: the live site was blank at p = 1 in WebKit after adaptive quality stepped down on the last frame of
  // a scroll: setSize() cleared the canvas, and nothing scheduled another frame.
  const errors = await open(page);
  await scrollToP(page, 1);
  const r = await page.evaluate(async () => {
    const B = window.__bike, before = B.renderer.info.render.frame;
    B.setQuality(1);                                                      // what sampleFrame() does on a slow device
    for (let k = 0; k < 4; k++) await new Promise(res => requestAnimationFrame(res));
    return { before, after: B.renderer.info.render.frame, dpr: B.renderer.getPixelRatio() };
  });
  expect(r.after, `no frame drawn after the quality change (dpr ${r.dpr})`).toBeGreaterThan(r.before);
  expect(errors).toEqual([]);
});
