#!/usr/bin/env node

const platformUrl = normalizeBaseUrl(process.env.PLATFORM_DEFAULT_LOCALE_BASE_URL || process.env.DEPLOYED_URL || 'https://www.bazar-baz.ir');
const expectedLocale = process.env.PLATFORM_DEFAULT_LOCALE_EXPECTED || 'fa';

function normalizeBaseUrl(value) {
  return String(value || '').replace(/\/$/, '');
}

function ok(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}) {
  const url = new URL(path, platformUrl);
  const response = await fetch(url, {
    method: options.method || 'GET',
    redirect: options.redirect || 'manual',
    headers: options.headers || undefined,
  });
  return response;
}

function getLocation(response) {
  return response.headers.get('location') || '';
}

async function expectFaRedirect(path, label) {
  const response = await request(path, {
    headers: {
      'accept-language': 'en-US,en;q=0.9,ar;q=0.7',
      cookie: 'locale=en',
    },
  });

  ok([301, 302, 307, 308].includes(response.status), `${label}: expected redirect, got ${response.status}`);
  const location = getLocation(response);
  ok(location, `${label}: expected Location header`);

  const nextUrl = new URL(location, platformUrl);
  ok(
    nextUrl.pathname === `/${expectedLocale}` || nextUrl.pathname.startsWith(`/${expectedLocale}/`),
    `${label}: expected redirect to /${expectedLocale}, got ${location}`,
  );

  console.log(`✓ ${label} redirects to /${expectedLocale}`);
}

async function expectExplicitLocalePreserved(path, locale, label) {
  const response = await request(path, {
    headers: {
      'accept-language': 'en-US,en;q=0.9,fa;q=0.8',
      cookie: 'locale=fa',
    },
  });

  ok(response.status < 400 || [401, 403].includes(response.status), `${label}: unexpected status ${response.status}`);
  const location = getLocation(response);

  if (location) {
    const nextUrl = new URL(location, platformUrl);
    ok(
      nextUrl.pathname === `/${locale}` || nextUrl.pathname.startsWith(`/${locale}/`) || nextUrl.pathname.startsWith('/auth'),
      `${label}: explicit /${locale} should not be rewritten to /${expectedLocale}; got ${location}`,
    );
  }

  console.log(`✓ ${label} preserves explicit /${locale}`);
}

async function main() {
  console.log('Platform default-locale smoke test');
  console.log(`Platform URL: ${platformUrl}`);
  console.log(`Expected no-locale default: ${expectedLocale}`);
  console.log('');

  await expectFaRedirect('/', 'platform root');
  await expectFaRedirect('/dashboard', 'platform dashboard');
  await expectFaRedirect('/shop/ahmad', 'platform no-locale shop URL');
  await expectFaRedirect('/about', 'platform generic no-locale URL');

  await expectExplicitLocalePreserved('/en', 'en', 'explicit English root');
  await expectExplicitLocalePreserved('/ar', 'ar', 'explicit Arabic root');

  console.log('');
  console.log('Platform default-locale smoke test passed.');
}

main().catch((error) => {
  console.error('Platform default-locale smoke test failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
