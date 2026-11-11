// Tiny static server that mimics the production nginx config (nginx.conf): gzip for text types,
// long-lived immutable cache for the version-pinned vendor folder, short cache for index.html.
// Usage: node qa/serve.mjs [port]
import { fileURLToPath } from 'node:url';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] || process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' };
// the same Content-Security-Policy nginx.conf sends (read from it, so a stale hash fails locally too)
const csp = (fs.readFileSync(path.join(root, 'nginx.conf'), 'utf8').match(/Content-Security-Policy "([^"]+)"/) || [])[1];
const gz = new Set(['.html', '.js', '.mjs', '.css', '.svg', '.json', '.txt', '.md']);
http.createServer((req, res) => {
  let u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (u === '/__health') { res.writeHead(200); return res.end('ok'); }
  if (u.endsWith('/')) u += 'index.html';
  const f = path.join(root, u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('404'); }
  const ext = path.extname(f).toLowerCase();
  const headers = { 'content-type': types[ext] || 'application/octet-stream', 'x-content-type-options': 'nosniff',
    'cache-control': u.startsWith('/vendor/') ? 'public, max-age=31536000, immutable' : 'no-cache' };
  if (ext === '.html' && csp && !u.startsWith('/qa/')) headers['content-security-policy'] = csp;
  let body = fs.readFileSync(f);
  if (gz.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) { body = zlib.gzipSync(body, { level: 6 }); headers['content-encoding'] = 'gzip'; headers['vary'] = 'Accept-Encoding'; }
  headers['content-length'] = body.length;
  res.writeHead(200, headers); res.end(req.method === 'HEAD' ? undefined : body);
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} on http://127.0.0.1:${port}`));
