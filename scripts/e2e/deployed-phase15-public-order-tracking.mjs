#!/usr/bin/env node
const baseUrl = (process.env.DEPLOYED_URL || '').replace(/\/$/, '');

if (!baseUrl) {
  console.error('DEPLOYED_URL is required. Example: $env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase15');
  process.exit(1);
}

const results = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail || '' });
    console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ name, ok: false, detail });
    console.error(`✗ ${name} — ${detail}`);
  }
}

async function expectStatus(name, path, init, allowedStatuses) {
  await check(name, async () => {
    const response = await fetch(`${baseUrl}${path}`, init);
    if (!allowedStatuses.includes(response.status)) {
      const text = await response.text().catch(() => '');
      throw new Error(`expected ${allowedStatuses.join('/')}, got ${response.status}. Body: ${text.slice(0, 300)}`);
    }
    return `status=${response.status}`;
  });
}

await expectStatus('homepage is reachable', '/', {}, [200, 302, 307, 308]);
await expectStatus('health endpoint is reachable', '/api/health', {}, [200]);
await expectStatus('public search still responds', '/api/public/search?q=phase15', {}, [200, 429]);
await expectStatus('unknown public order does not leak', '/api/public/orders/ORD-PHASE15-UNKNOWN', {}, [404, 429]);
await expectStatus('fake tracking token does not reveal unknown order', '/api/public/orders/ORD-PHASE15-UNKNOWN?token=fake-token', {}, [404, 429]);
await expectStatus(
  'public order payment PUT remains disabled',
  '/api/public/orders/ORD-PHASE15-UNKNOWN',
  {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentId: 'phase15-smoke' }),
  },
  [405],
);
await expectStatus('authenticated-only orders API remains blocked', '/api/orders', {}, [401, 403]);

console.table(results.map(({ name, ok }) => ({ name, ok })));
const failed = results.filter((result) => !result.ok);
if (failed.length) process.exit(1);
