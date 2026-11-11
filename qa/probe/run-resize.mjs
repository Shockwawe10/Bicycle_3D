import { webkit, chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
const color = f => execFileSync('py', ['-3.11', '-c', `from PIL import Image\nprint(Image.open('${f}').convert('RGB').getpixel((150,150)))`]).toString().trim();
for (const [name, type] of [['webkit', webkit], ['chromium', chromium]]) for (const q of ['', '?aa', '?alpha', '?aa&alpha']) {
  const b = await type.launch(), p = await b.newPage({ viewport: { width: 390, height: 600 }, deviceScaleFactor: 1.5 });
  await p.goto('http://127.0.0.1:4173/qa/probe/resize.html' + q); await p.waitForTimeout(200);
  await p.screenshot({ path: 'qa/tmp/rz-a.png' }); const a = color('qa/tmp/rz-a.png');
  await p.evaluate(() => window.resizeAndDraw()); await p.waitForTimeout(200);
  await p.screenshot({ path: 'qa/tmp/rz-b.png' }); const bb = color('qa/tmp/rz-b.png');
  console.log(name.padEnd(9), (q || 'plain').padEnd(10), 'before', a, 'after resize', bb);
  await b.close();
}
