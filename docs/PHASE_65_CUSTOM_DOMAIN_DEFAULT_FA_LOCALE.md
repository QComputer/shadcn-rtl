# Phase 65 — Custom-domain default locale hardening

## Goal

Tenant custom domains such as `khalae.ir` must be Persian-first. A bare first visit to a custom domain must not become English just because the visitor browser sends `Accept-Language: en`.

## Behavior

- `https://khalae.ir/` internally rewrites to `/{locale}/shop/{slug}` with `locale=fa`.
- `https://khalae.ir/profile` internally rewrites to `/fa/shop/{slug}/profile`.
- Explicit locale paths still work:
  - `https://khalae.ir/en/profile` → `/en/shop/{slug}/profile`
  - `https://khalae.ir/ar/profile` → `/ar/shop/{slug}/profile`
- `robots.txt` and `sitemap.xml` on tenant domains also default to Persian unless an explicit locale path is used by future routes.
- The `locale` cookie is set on custom-domain storefront rewrites so client-side locale providers do not override the first render unexpectedly.

## Validation

```powershell
node scripts/setup-register-custom-domain-default-locale-package-scripts.mjs
pnpm run quality:custom-domain-default-locale
pnpm run quality:custom-domain-seo
pnpm typecheck
pnpm build
```

## Manual smoke after deploy

```powershell
curl.exe -I -L https://khalae.ir/
curl.exe -I -L https://khalae.ir/profile
curl.exe -I -L https://khalae.ir/en/profile
```

Expected: bare paths render Persian. Explicit `/en/...` paths remain English.
