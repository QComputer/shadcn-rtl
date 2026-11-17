import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, sep, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageForPath, normalizePath } from './content.js';
import { handleDamoonApiProxy } from './api-proxy.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8080);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8' };
const security = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Robots-Tag': 'noindex, nofollow, noarchive', 'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https://tile.openstreetmap.org; style-src 'self'; font-src 'self'; script-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self'" };
const leafletNames = ['leaflet.js', 'leaflet.css', 'images/marker-icon.png', 'images/marker-icon-2x.png', 'images/marker-shadow.png', 'images/layers.png', 'images/layers-2x.png'];
const leafletFiles = new Set(leafletNames.flatMap(name => [`/vendor/leaflet/${name}`, `/damoon-front/vendor/leaflet/${name}`]));
const leafletDist = process.env.DAMOON_LEAFLET_DIST || join(root, '..', '..', 'node_modules', 'leaflet', 'dist');
http.createServer(async (req, res) => {
  if (req.url?.startsWith('/api/')) {
    try { await handleDamoonApiProxy(req, res); }
    catch { if (!res.headersSent) { res.writeHead(502, security); res.end('{"error":"Hotel API unavailable"}'); } }
    return;
  }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { ...security, Allow: 'GET, HEAD' }); res.end(); return; }
  let path;
  try { path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400, security); res.end(); return; }
  if (path === '/healthz') { res.writeHead(200, { ...security, 'Content-Type': mime['.json'] }); res.end(req.method === 'HEAD' ? undefined : '{"status":"ok","site":"damoon"}'); return; }
  const extension = /\.[a-z0-9]+$/i.exec(path)?.[0]?.toLowerCase();
  const asset = Boolean(extension);
  const file = leafletFiles.has(path) ? join(leafletDist, path.replace(/^\/(?:damoon-front\/)?vendor\/leaflet\//, '')) : resolve(root, '.' + (asset ? path : '/index.html'));
  if ((!leafletFiles.has(path) && !file.startsWith(root + sep)) || (asset && !['/styles.css','/booking.css','/accommodation.css','/hospitality.css','/damoon-attractions.css','/accommodation.js','/hospitality.js','/damoon-attractions-data.js','/damoon-attractions-view.js','/damoon-attractions-detail-view.js','/damoon-leaflet-maps.js','/theme-tokens.css','/app.js','/content.js','/translations.js','/themes.js','/booking.js','/booking-flow.js','/calendar.js','/virtual-tour.js','/robots.txt'].includes(path) && !path.startsWith('/assets/') && !leafletFiles.has(path))) { res.writeHead(404, security); res.end(); return; }
  try {
    const body = await readFile(file);
    const status = asset || pageForPath(normalizePath(path)) ? 200 : 404;
    res.writeHead(status, { ...security, 'Content-Type': mime[extension || '.html'] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Content-Length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404, security); res.end(); }
}).listen(port, '0.0.0.0', () => console.log(`Damoon listening on ${port}`));
