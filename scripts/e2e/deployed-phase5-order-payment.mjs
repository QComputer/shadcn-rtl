const baseUrl = (process.env.DEPLOYED_URL || '').replace(/\/$/, '');

if (!baseUrl) {
  console.error('DEPLOYED_URL is required. Example: DEPLOYED_URL=https://example.com npm run e2e:deployed:phase5');
  process.exit(1);
}

const results = [];

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
    console.error(`✗ ${name}`);
    console.error(error);
  }
}

async function expectStatus(name, path, init, allowedStatuses) {
  await check(name, async () => {
    const response = await fetch(`${baseUrl}${path}`, init);
    if (!allowedStatuses.includes(response.status)) {
      const text = await response.text().catch(() => '');
      throw new Error(`Expected status ${allowedStatuses.join('/')} but got ${response.status}. Body: ${text.slice(0, 300)}`);
    }
  });
}

await expectStatus('homepage is reachable', '/', {}, [200, 302, 307, 308]);
await expectStatus('public search still responds', '/api/public/search?q=test', {}, [200]);
await expectStatus('unauthenticated order detail is blocked', '/api/orders/phase5-smoke-id', {}, [401, 403, 404]);
await expectStatus(
  'unauthenticated order status mutation is blocked',
  '/api/orders/phase5-smoke-id',
  {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'ACCEPTED' }),
  },
  [401, 403, 404],
);
await expectStatus(
  'unauthenticated payment status mutation is blocked',
  '/api/orders/phase5-smoke-id/payment',
  {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'COMPLETED', paymentId: 'phase5-smoke' }),
  },
  [401, 403, 404],
);
await expectStatus(
  'public order payment PUT remains disabled',
  '/api/public/orders/ORD-PHASE5-SMOKE',
  {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentId: 'phase5-smoke' }),
  },
  [405],
);
await expectStatus('public unknown order does not leak', '/api/public/orders/ORD-PHASE5-SMOKE', {}, [401, 403, 404]);

console.table(results.map(({ name, ok }) => ({ name, ok })));
const failed = results.filter((r) => !r.ok);
if (failed.length > 0) {
  process.exit(1);
}
