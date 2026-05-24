#!/usr/bin/env node
const baseUrl = (process.env.DEPLOYED_URL || '').replace(/\/$/, '');

if (!baseUrl) {
  console.error('DEPLOYED_URL is required. Example: $env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase17');
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
await expectStatus('settings page does not server-error unauthenticated', '/fa/dashboard/settings', {}, [200, 302, 307, 308, 401, 403]);
await expectStatus('current user profile blocks unauthenticated users', '/api/users/me', {}, [401, 403]);
await expectStatus(
  'profile update blocks unauthenticated users',
  '/api/users/me',
  {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName: 'phase17' }),
  },
  [401, 403],
);
await expectStatus(
  'password change blocks unauthenticated users',
  '/api/users/me',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword: 'old-password', newPassword: 'new-password-123', confirmPassword: 'new-password-123' }),
  },
  [401, 403],
);
await expectStatus('business hours read blocks unauthenticated users', '/api/users/me/business-hours', {}, [401, 403]);
await expectStatus(
  'business hours update blocks unauthenticated users',
  '/api/users/me/business-hours',
  {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ day: 'SATURDAY', openTime: '09:00', closeTime: '17:00', isOpen: true }]),
  },
  [401, 403],
);
await expectStatus('membership endpoint still blocks unauthenticated users', '/api/users/me/membership', {}, [401, 403]);
await expectStatus('health endpoint remains reachable', '/api/health', {}, [200]);

console.table(results.map(({ name, ok }) => ({ name, ok })));
const failed = results.filter((result) => !result.ok);
if (failed.length) process.exit(1);
