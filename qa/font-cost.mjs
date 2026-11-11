// Latin woff2 bytes Google Fonts serves for each dealt pairing (decides font cost before choosing a variant)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0 Safari/537.36';
const sets = {
  'A bricolage (Bricolage Grotesque + Figtree)': 'family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500&family=Figtree:wght@400;500',
  'B archivo (Archivo, wdth+wght)': 'family=Archivo:wdth,wght@62..125,400;62..125,500',
  'C zilla (Zilla Slab + Rethink Sans)': 'family=Zilla+Slab:wght@400;500&family=Rethink+Sans:wght@400;500',
};
for (const [name, q] of Object.entries(sets)) {
  const css = await (await fetch('https://fonts.googleapis.com/css2?' + q + '&display=swap', { headers: { 'user-agent': UA } })).text();
  const blocks = css.split('@font-face').slice(1).filter(b => /\/\* latin \*\//.test('/* ' + (css.split('@font-face')[css.split('@font-face').indexOf(b) - 1] || '').split('/*').pop()) || /U\+0000-00FF/.test(b));
  const urls = [...new Set(blocks.map(b => b.match(/url\((https:[^)]+\.woff2)\)/)?.[1]).filter(Boolean))];
  let total = 0; for (const u of urls) total += (await (await fetch(u)).arrayBuffer()).byteLength;
  console.log(name.padEnd(46), `${urls.length} latin woff2 files, ${(total / 1024).toFixed(1)} KB`);
}
