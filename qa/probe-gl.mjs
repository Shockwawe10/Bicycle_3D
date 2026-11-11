// Probe: which WebGL renderer does each automated browser get? (decides whether frame timings are meaningful)
import { webkit, chromium, devices } from 'playwright';
const probe = () => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  if (!gl) return 'NO WEBGL';
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return (gl instanceof WebGL2RenderingContext ? 'webgl2 ' : 'webgl1 ') + (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
};
const runs = [
  ['webkit iPhone 13', () => webkit.launch(), devices['iPhone 13']],
  ['chromium headless default', () => chromium.launch(), {}],
  ['chrome channel headless + gpu flags', () => chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] }), {}],
];
for (const [name, launch, ctxOpts] of runs) {
  try { const b = await launch(); const p = await (await b.newContext(ctxOpts)).newPage(); await p.goto('about:blank'); console.log(name.padEnd(38), await p.evaluate(probe)); await b.close(); }
  catch (e) { console.log(name.padEnd(38), 'ERROR', e.message.split('\n')[0]); }
}
