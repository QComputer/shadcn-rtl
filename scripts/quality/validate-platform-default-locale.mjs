#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';

const requiredFiles = [
  'proxy.ts',
  'scripts/e2e/platform-default-locale-smoke.mjs',
  'scripts/setup-register-platform-default-locale-package-scripts.mjs',
  'docs/PHASE_66A_PLATFORM_DEFAULT_FA_LOCALE.md',
  'OVERLAY_PHASE66A_PLATFORM_DEFAULT_FA_LOCALE.md',
];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    throw new Error(`Missing required file: ${file}`);
  }
}

const proxy = readFileSync('proxy.ts', 'utf8');

if (!proxy.includes('const locale = defaultLocale;')) {
  throw new Error('proxy.ts must use defaultLocale for no-locale platform redirects.');
}

if (proxy.includes('const locale = getLocale(request);')) {
  throw new Error('proxy.ts must not call getLocale(request) for no-locale platform redirects.');
}

if (proxy.includes('Accept-Language') || proxy.includes('accept-language')) {
  throw new Error('proxy.ts should not derive first-visit locale from Accept-Language.');
}

if (!proxy.includes('explicit /en/... or /ar/... paths remain available')) {
  throw new Error('proxy.ts must document that explicit locale paths are preserved.');
}

const smoke = readFileSync('scripts/e2e/platform-default-locale-smoke.mjs', 'utf8');

for (const fragment of [
  'PLATFORM_DEFAULT_LOCALE_BASE_URL',
  'expectFaRedirect',
  "cookie: 'locale=en'",
  "'accept-language': 'en-US,en;q=0.9,ar;q=0.7'",
  "await expectFaRedirect('/dashboard'",
  "await expectExplicitLocalePreserved('/en'",
  "await expectExplicitLocalePreserved('/ar'",
]) {
  if (!smoke.includes(fragment)) {
    throw new Error(`Smoke runner missing expected fragment: ${fragment}`);
  }
}

console.log('Platform default-locale validation passed.');
