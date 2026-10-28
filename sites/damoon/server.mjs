import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageForPath, normalizePath } from './content.js';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8080);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.webp': 'image/webp', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8' };
const security = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Robots-Tag': 'noindex, nofollow, noarchive', 'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; font-src 'self'; script-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self'" };
http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { ...security, Allow: 'GET, HEAD' }); res.end(); return; }
  let path;
  try { path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400, security); res.end(); return; }
  if (path === '/healthz') { res.writeHead(200, { ...security, 'Content-Type': mime['.json'] }); res.end(req.method === 'HEAD' ? undefined : '{"status":"ok","site":"damoon"}'); return; }
  const extension = /\.[a-z0-9]+$/i.exec(path)?.[0]?.toLowerCase();
  const asset = Boolean(extension);
  const file = resolve(root, '.' + (asset ? path : '/index.html'));
  if (!file.startsWith(root + sep) || (asset && !['/styles.css','/booking.css','/theme-tokens.css','/app.js','/content.js','/translations.js','/themes.js','/booking.js','/calendar.js','/robots.txt'].includes(path) && !path.startsWith('/assets/'))) { res.writeHead(404, security); res.end(); return; }
  try {
    const body = await readFile(file);
    const status = asset || pageForPath(normalizePath(path)) ? 200 : 404;
    res.writeHead(status, { ...security, 'Content-Type': mime[extension || '.html'] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Content-Length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404, security); res.end(); }
}).listen(port, '0.0.0.0', () => console.log(`Damoon listening on ${port}`));
