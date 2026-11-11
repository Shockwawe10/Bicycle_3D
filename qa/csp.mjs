// Regenerate the CSP line in nginx.conf from the inline <script>/<style> blocks of index.html (sha256 hashes).
// node qa/csp.mjs          -> rewrites nginx.conf between CSP-BEGIN/CSP-END
// node qa/csp.mjs --check  -> exits 1 if nginx.conf is stale (used by the QA suite)
import fs from 'node:fs';
import crypto from 'node:crypto';
const html = fs.readFileSync('index.html', 'utf8');
const hash = s => `'sha256-${crypto.createHash('sha256').update(s, 'utf8').digest('base64')}'`;
const blocks = tag => [...html.matchAll(new RegExp(`<${tag}(\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g'))].map(m => m[2]);
const scripts = blocks('script').map(hash), styles = blocks('style').map(hash);
export const csp = [
  "default-src 'none'", `script-src 'self' ${scripts.join(' ')}`, `style-src 'self' ${styles.join(' ')}`,
  "img-src 'self' data:", 'font-src data:', "connect-src 'self'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'",
].join('; ');
const line = `    add_header Content-Security-Policy "${csp}" always;`;
const conf = fs.readFileSync('nginx.conf', 'utf8');
const next = conf.replace(/(# CSP-BEGIN[^\n]*\n)[\s\S]*?(\n\s*# CSP-END)/, `$1${line}$2`);
if (process.argv.includes('--check')) {
  if (next !== conf) { console.error('nginx.conf CSP is stale: run node qa/csp.mjs'); process.exit(1); }
  console.log('nginx.conf CSP matches index.html');
} else if (process.argv[1]?.endsWith('csp.mjs')) {
  fs.writeFileSync('nginx.conf', next); console.log(`CSP: ${scripts.length} script hash(es), ${styles.length} style hash(es)`);
}
