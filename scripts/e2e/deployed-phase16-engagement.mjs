#!/usr/bin/env node
const baseUrl = (process.env.DEPLOYED_URL || '').replace(/\/$/, '');

if (!baseUrl) {
  console.error('DEPLOYED_URL is required. Example: $env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase16');
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
await expectStatus('public reviews list responds', '/api/reviews?pageSize=200', {}, [200, 429]);
await expectStatus('public reviews list rejects unknown organization cleanly', '/api/reviews?organizationSlug=phase16-unknown-org', {}, [404, 429]);
await expectStatus(
  'review create blocks unauthenticated users',
  '/api/reviews',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationSlug: 'phase16-unknown-org', rating: 5, comment: 'phase16 smoke' }),
  },
  [401, 403],
);
await expectStatus(
  'review update blocks unauthenticated users',
  '/api/reviews/phase16-review-id',
  {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating: 4 }),
  },
  [401, 403],
);
await expectStatus('review delete blocks unauthenticated users', '/api/reviews/phase16-review-id', { method: 'DELETE' }, [401, 403]);
await expectStatus('follow blocks unauthenticated users', '/api/organizations/phase16-org-id/follow', { method: 'POST' }, [401, 403]);
await expectStatus('unfollow blocks unauthenticated users', '/api/organizations/phase16-org-id/follow', { method: 'DELETE' }, [401, 403]);

console.table(results.map(({ name, ok }) => ({ name, ok })));
const failed = results.filter((result) => !result.ok);
if (failed.length) process.exit(1);
