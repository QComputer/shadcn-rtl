import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import { once } from 'node:events';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('standalone proxy forwards only same-origin guest POST routes with the Damoon tenant host', async (t) => {
  let upstreamRequest;
  const upstream = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    upstreamRequest = {
      method: req.method,
      path: req.url,
      host: req.headers.host,
      origin: req.headers.origin,
      forwardedHost: req.headers['x-forwarded-host'],
      forwardedProto: req.headers['x-forwarded-proto'],
      forwardedFor: req.headers['x-forwarded-for'],
      idempotencyKey: req.headers['idempotency-key'],
      body: Buffer.concat(chunks).toString('utf8'),
    };
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
  });
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  const portProbe = net.createServer();
  portProbe.listen(0, '127.0.0.1');
  await once(portProbe, 'listening');
  const port = portProbe.address().port;
  await new Promise((resolve) => portProbe.close(resolve));
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const proxy = spawn(process.execPath, [resolve(root, 'server.mjs')], {
    cwd: root,
    stdio: 'ignore',
    env: { ...process.env, NODE_ENV: 'test', PORT: String(port), DAMOON_API_ORIGIN: `http://127.0.0.1:${upstream.address().port}`, DAMOON_PUBLIC_HOSTS: '' },
  });
  t.after(async () => {
    proxy.kill();
    await new Promise((resolve) => upstream.close(resolve));
  });

  async function send(path, method, headers = {}, body = '') {
    const deadline = Date.now() + 2_000;
    while (Date.now() < deadline) {
      try {
        const health = await new Promise((resolve, reject) => {
          const request = http.get({ host: '127.0.0.1', port, path: '/healthz' }, (response) => {
            response.resume(); response.on('end', () => resolve(response.statusCode));
          });
          request.on('error', reject);
        });
        if (health === 200) break;
      } catch { /* bounded readiness poll */ }
    }
    return new Promise((resolve, reject) => {
      const request = http.request({ host: '127.0.0.1', port, path, method, headers }, (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString('utf8') }));
      });
      request.on('error', reject);
      request.end(body);
    });
  }
  const payload = JSON.stringify({ property: 'damoon-hotel' });
  const page = await send('/fa', 'GET');
  assert.equal(page.status, 200);
  assert.match(page.headers['content-security-policy'], /connect-src 'self'/);
  const response = await send('/api/hotel/v1/requests', 'POST', {
    host: 'damoon-hotel.ir', origin: 'http://damoon-hotel.ir',
    'content-type': 'application/json', 'content-length': String(Buffer.byteLength(payload)),
    'idempotency-key': 'damoon-test-idempotency-001',
    'x-forwarded-host': 'attacker.example', 'x-forwarded-proto': 'https', 'x-forwarded-for': '203.0.113.77',
  }, payload);
  assert.equal(response.status, 201, response.body);
  assert.deepEqual(JSON.parse(response.body), { ok: true });
  const forwardedFor = upstreamRequest.forwardedFor;
  assert.match(forwardedFor, /^[0-9a-f:.]+$/i);
  assert.notEqual(forwardedFor, '203.0.113.77');
  assert.deepEqual(upstreamRequest, {
    method: 'POST',
    path: '/api/hotel/v1/requests',
    host: 'damoon-hotel.ir',
    origin: 'http://damoon-hotel.ir',
    forwardedHost: 'damoon-hotel.ir',
    forwardedProto: 'http',
    forwardedFor,
    idempotencyKey: 'damoon-test-idempotency-001',
    body: JSON.stringify({ property: 'damoon-hotel' }),
  });

  const crossOrigin = await send('/api/hotel/v1/requests', 'POST', { host: 'damoon-hotel.ir', origin: 'https://attacker.example', 'content-type': 'application/json', 'content-length': '2' }, '{}');
  assert.equal(crossOrigin.status, 403);
  const privateRoute = await send('/api/dashboard/booking-requests', 'POST', { host: 'damoon-hotel.ir' });
  assert.equal(privateRoute.status, 404);
  const wrongMethod = await send('/api/hotel/v1/requests/status', 'GET', { host: 'damoon-hotel.ir' });
  assert.equal(wrongMethod.status, 405);
  for (const path of ['/api/hotel/v1/availability/search', '/api/hotel/v1/requests/status']) {
    const body = '{}';
    const allowed = await send(path, 'POST', { host: 'damoon-hotel.ir', origin: 'http://damoon-hotel.ir', 'content-type': 'application/json', 'content-length': '2' }, body);
    assert.equal(allowed.status, 201);
    assert.equal(upstreamRequest.path, path);
  }
  const hold = await send('/api/hotel/v1/holds', 'POST', { host: 'damoon-hotel.ir' });
  assert.equal(hold.status, 404, 'the current request-only guest flow must not expose hold creation');
  const invalidHost = await send('/api/hotel/v1/requests', 'POST', { host: 'attacker.example', origin: 'http://attacker.example', 'content-type': 'application/json', 'content-length': '2' }, '{}');
  assert.equal(invalidHost.status, 400);
});
