# Phase 66 — Custom-Domain Production Smoke Tests

## Goal

Protect the live custom-domain storefront flow after Phase 64/65:

- custom domain opens the shop in Persian by default;
- explicit `/en` and `/ar` locale paths remain reachable;
- tenant-domain `robots.txt` and `sitemap.xml` work;
- platform shop URL redirects to the active primary custom domain;
- SUPER_ADMIN domain APIs are not publicly accessible.

This phase adds a lightweight Node-based smoke runner. It does not require Playwright.

## Files

```txt
scripts/e2e/custom-domain-smoke.mjs
scripts/quality/validate-custom-domain-smoke.mjs
scripts/setup-register-custom-domain-smoke-package-scripts.mjs
docs/PHASE_66_CUSTOM_DOMAIN_SMOKE.md
OVERLAY_PHASE66_CUSTOM_DOMAIN_SMOKE.md
```

## Register package scripts

```powershell
node scripts/setup-register-custom-domain-smoke-package-scripts.mjs
pnpm run quality:custom-domain-smoke
```

Registered scripts:

```json
{
  "e2e:custom-domain-smoke": "node scripts/e2e/custom-domain-smoke.mjs",
  "e2e:deployed:custom-domain-smoke": "node scripts/e2e/custom-domain-smoke.mjs",
  "quality:custom-domain-smoke": "node scripts/quality/validate-custom-domain-smoke.mjs"
}
```

## Required environment variables

For the Ahmad/Khalae production smoke test:

```powershell
$env:CUSTOM_DOMAIN_SMOKE_BASE_URL="https://www.khalae.ir"
$env:CUSTOM_DOMAIN_SMOKE_PLATFORM_URL="https://www.bazar-baz.ir"
$env:CUSTOM_DOMAIN_SMOKE_SHOP_SLUG="ahmad"
```

Optional:

```powershell
$env:CUSTOM_DOMAIN_SMOKE_EXPECTED_LOCALE="fa"
$env:CUSTOM_DOMAIN_SMOKE_PRIMARY_HOST="https://www.khalae.ir"
$env:CUSTOM_DOMAIN_SMOKE_SKIP_EN="false"
$env:CUSTOM_DOMAIN_SMOKE_SKIP_AR="false"
$env:CUSTOM_DOMAIN_SMOKE_TIMEOUT_MS="20000"
```

## Run smoke test

```powershell
pnpm run e2e:custom-domain-smoke
```

or directly:

```powershell
node scripts/e2e/custom-domain-smoke.mjs
```

## What it checks

1. `https://www.khalae.ir/` returns a successful response and looks Persian-first.
2. `https://www.khalae.ir/profile` preserves Persian-first behavior when the path exists.
3. `https://www.khalae.ir/en` remains reachable when English is published.
4. `https://www.khalae.ir/ar` remains reachable when Arabic is published.
5. `https://www.khalae.ir/robots.txt` returns textual robots content.
6. `https://www.khalae.ir/sitemap.xml` returns XML sitemap content and includes the tenant host.
7. `https://www.bazar-baz.ir/fa/shop/ahmad` redirects to the custom primary domain.
8. `https://www.bazar-baz.ir/api/dashboard/shop-domains` is not publicly accessible without SUPER_ADMIN authentication.

## Notes

- If `/profile`, `/en`, or `/ar` are not published for a shop, the runner logs an informational skip for the 404 case rather than failing the entire smoke test.
- The redirect assertion intentionally uses manual redirect handling so it can inspect the `Location` header.
- This smoke runner is safe to run against production because it performs read-only GET/HEAD-style checks and does not mutate shop/domain state.
