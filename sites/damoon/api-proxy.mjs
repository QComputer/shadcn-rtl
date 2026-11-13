import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

const guestPostRoutes = new Set([
  '/api/hotel/v1/availability/search',
  '/api/hotel/v1/requests',
  '/api/hotel/v1/requests/status',
]);
const maxRequestBytes = 24 * 1024;
const maxResponseBytes = 96 * 1024;
const timeoutMs = 8_000;
const defaultPublicHosts = new Set(['damoon-hotel.ir', 'www.damoon-hotel.ir']);

function publicHost(req) {
  const raw = req.headers.host || '';
  if (raw.length > 255 || /[\s/@?#\\]/.test(raw)) return null;
  let parsed;
  try { parsed = new URL(`https://${raw}`); } catch { return null; }
  const normalizedAuthority = raw.toLowerCase();
  const configured = (process.env.DAMOON_PUBLIC_HOSTS || '')
    .split(',').map((host) => host.trim().toLowerCase()).filter(Boolean);
  const allowed = configured.length ? new Set(configured) : defaultPublicHosts;
  const exactConfiguredAuthority = allowed.has(normalizedAuthority);
  if (parsed.port && process.env.NODE_ENV === 'production' && parsed.port !== '443') return null;
  if (parsed.port && process.env.NODE_ENV === 'test' && !(process.env.DAMOON_E2E_ENABLED === '1' && exactConfiguredAuthority) && !['80', '443'].includes(parsed.port)) return null;
  if (parsed.port && process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test' && !['80', '443'].includes(parsed.port)) return null;
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  return allowed.has(hostname) || exactConfiguredAuthority ? raw : null;
}

function apiOrigin() {
  const value = process.env.DAMOON_API_ORIGIN;
  if (!value) return null;
  let parsed;
  try { parsed = new URL(value); } catch { return null; }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') return null;
  if (parsed.protocol === 'https:') return parsed;
  if (process.env.NODE_ENV !== 'production' && parsed.protocol === 'http:' && net.isIP(parsed.hostname) && ['127.0.0.1', '::1'].includes(parsed.hostname)) return parsed;
  return null;
}

function clientIp(req) {
  const socketIp = req.socket.remoteAddress || 'unknown';
  const trusted = new Set((process.env.DAMOON_TRUSTED_PROXY_IPS || '').split(',').map((ip) => ip.trim()).filter(Boolean));
  if (!trusted.has(socketIp)) return socketIp;
  const forwarded = req.headers['x-forwarded-for']?.split(',')[0]?.trim();
  return forwarded && net.isIP(forwarded) ? forwarded : socketIp;
}

function send(res, status, body, headers = {}) {
  if (res.headersSent || res.destroyed || res.writableEnded) return;
  res.writeHead(status, { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(body);
}

async function readBody(req) {
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > maxRequestBytes) throw Object.assign(new Error('Request too large'), { status: 413 });
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxRequestBytes) throw Object.assign(new Error('Request too large'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function handleDamoonApiProxy(req, res) {
  let pathname;
  try { pathname = new URL(req.url || '/', 'http://damoon.invalid').pathname; }
  catch { send(res, 400, '{"error":"Invalid request"}'); return true; }
  if (!pathname.startsWith('/api/')) return false;
  if (!guestPostRoutes.has(pathname)) { send(res, 404, '{"error":"Not found"}'); return true; }
  if (req.method !== 'POST') { send(res, 405, '{"error":"Method not allowed"}', { Allow: 'POST' }); return true; }

  const host = publicHost(req);
  if (!host) { send(res, 400, '{"error":"Invalid public host"}'); return true; }
  const originValue = req.headers.origin;
  let origin;
  try { origin = new URL(originValue || ''); } catch { send(res, 403, '{"error":"Same-origin request required"}'); return true; }
  if (origin.host.toLowerCase() !== host.toLowerCase() || origin.pathname !== '/' || origin.search || origin.hash) {
    send(res, 403, '{"error":"Same-origin request required"}'); return true;
  }
  if (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:') {
    send(res, 403, '{"error":"HTTPS origin required"}'); return true;
  }
  if (req.headers['sec-fetch-site'] && !['same-origin', 'same-site', 'none'].includes(req.headers['sec-fetch-site'])) {
    send(res, 403, '{"error":"Cross-origin request rejected"}'); return true;
  }

  const upstream = apiOrigin();
  if (!upstream) { send(res, 503, '{"error":"Hotel API is unavailable"}'); return true; }
  let body;
  try { body = await readBody(req); }
  catch (error) { send(res, error.status || 400, JSON.stringify({ error: error.status === 413 ? 'Request too large' : 'Invalid request body' })); return true; }
  if (req.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    send(res, 415, '{"error":"JSON body required"}'); return true;
  }

  const transport = upstream.protocol === 'https:' ? https : http;
  let settled = false;
  let timer;
  const finish = (status, responseBody, headers = {}) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    send(res, status, responseBody, headers);
  };
  const request = transport.request(new URL(pathname, upstream), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': req.headers['content-type'],
      'content-length': String(body.length),
      host,
      origin: origin.origin,
      'x-forwarded-host': host,
      'x-forwarded-proto': origin.protocol.slice(0, -1),
      'x-forwarded-for': clientIp(req),
      ...(req.headers['idempotency-key'] ? { 'idempotency-key': req.headers['idempotency-key'] } : {}),
    },
    timeout: timeoutMs,
  }, (upstreamResponse) => {
    const chunks = [];
    let size = 0;
    upstreamResponse.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxResponseBytes) {
        finish(502, '{"error":"Hotel API response is too large"}');
        request.destroy(Object.assign(new Error('Upstream response too large'), { code: 'RESPONSE_TOO_LARGE' }));
      }
      else chunks.push(chunk);
    });
    upstreamResponse.on('end', () => {
      if (settled) return;
      const headers = {};
      for (const name of ['content-type', 'retry-after']) if (upstreamResponse.headers[name]) headers[name] = upstreamResponse.headers[name];
      finish(upstreamResponse.statusCode || 502, Buffer.concat(chunks), headers);
    });
  });
  timer = setTimeout(() => request.destroy(Object.assign(new Error('Upstream timeout'), { code: 'ETIMEDOUT' })), timeoutMs);
  request.on('error', (error) => finish(502, JSON.stringify({ error: error.code === 'ETIMEDOUT' ? 'Hotel API timed out' : 'Hotel API unavailable' })));
  request.end(body);
  return true;
}
