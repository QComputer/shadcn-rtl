# Phase 64 — Custom-Domain SEO + Canonical Redirect Hardening

## Goal

Prevent duplicate SEO surfaces between platform shop URLs and shop-owned custom domains.

When a shop has an active primary custom domain, public indexable storefront URLs should prefer the custom domain:

- Platform: `/fa/shop/example-shop/product/demo`
- Tenant domain: `https://example.ir/product/demo`

The tenant domain should become the canonical and sitemap owner for the public shop storefront.

## Implemented

- Added tenant-aware `/sitemap.xml` support for custom shop domains.
- Added tenant-aware `robots.txt` support for custom shop domains.
- Added internal primary-domain resolver for proxy redirects.
- Added platform-to-custom-domain redirects for indexable public shop paths:
  - `/shop/[slug]`
  - `/shop/[slug]/profile`
  - `/shop/[slug]/fanpage`
  - `/shop/[slug]/category/[id-or-slug]`
  - `/shop/[slug]/product/[id-or-slug]`
- Excluded transactional paths from automatic canonical redirect:
  - checkout
  - order tracking
- Updated shop SEO context so metadata/canonical/OG/JSON-LD can use the active primary custom domain.
- Updated platform sitemap so shops with active primary custom domains are not duplicated in the platform sitemap.
- Added `quality:custom-domain-seo` validator.

## Validation

```powershell
node scripts/setup-register-custom-domain-seo-package-scripts.mjs
pnpm run quality:custom-domain-seo
pnpm run quality:shop-custom-domains
pnpm run quality:vercel-domain-automation
pnpm typecheck
pnpm build
```

## Manual smoke test

1. Mark a shop domain as `ACTIVE` and `isPrimary=true`.
2. Visit `https://bazar-baz.ir/fa/shop/<slug>`.
3. Confirm it redirects to `https://<domain>/`.
4. Visit `https://bazar-baz.ir/en/shop/<slug>/profile`.
5. Confirm it redirects to `https://<domain>/en/profile`.
6. Visit `https://<domain>/sitemap.xml`.
7. Confirm it returns tenant-domain URLs only.
8. Visit `https://<domain>/robots.txt`.
9. Confirm it points to `https://<domain>/sitemap.xml` and disallows checkout/order paths.
