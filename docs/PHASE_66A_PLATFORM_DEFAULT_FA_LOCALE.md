# Phase 66A — Platform default Persian locale

## Goal

Make Bazar Baz platform-domain no-locale visits Persian-first, matching the custom-domain behavior introduced earlier.

The first visit to links without a locale prefix must not depend on the visitor browser language or previous `locale` cookie. Persian is the default audience and must be the silent default.

## Behavior

| Request | Expected behavior |
| --- | --- |
| `/` | redirects to `/fa` |
| `/dashboard` | redirects to `/fa/dashboard` |
| `/shop/ahmad` | redirects to `/fa/shop/ahmad` first, then custom-domain SEO redirect may apply if configured |
| `/about` | redirects to `/fa/about` |
| `/en/...` | remains English |
| `/ar/...` | remains Arabic |

## Implementation

`proxy.ts` no longer derives no-locale platform routing from `Accept-Language` or from the `locale` cookie. The no-locale platform path now uses:

```ts
const locale = defaultLocale;
```

and still writes the `locale=fa` cookie so client-side locale state does not flip during hydration.

## Validation

```powershell
node scripts/setup-register-platform-default-locale-package-scripts.mjs
pnpm run quality:platform-default-locale
pnpm run quality:custom-domain-default-locale
pnpm run quality:custom-domain-smoke
pnpm typecheck
pnpm build
```

## Deployed smoke

```powershell
$env:PLATFORM_DEFAULT_LOCALE_BASE_URL="https://www.bazar-baz.ir"
pnpm run e2e:platform-default-locale
```

The smoke test intentionally sends an English `Accept-Language` header and an English `locale` cookie, then verifies no-locale URLs still redirect to `/fa`.
