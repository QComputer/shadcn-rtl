# Phase 53 - Public SEO Deployed Slug Verification

P53 adds a deployed smoke check for public slug SEO surfaces so category, product, and service slug URLs can be verified against the live site.

## Scope

- Added `scripts/e2e/deployed-slug-seo.mjs` for deployed sitemap-driven slug checks.
- Added `e2e:deployed:slug-seo` and `smoke:deployed:slug-seo` package scripts.
- Added `quality:deployed-slug-seo` to validate the smoke script and phase docs.
- Registered the P53 validator in the aggregate source validator.
- Added a production SEO guard that prevents the legacy `shadcn-rtl.vercel.app` host from leaking into canonical URLs when production env vars still point there.
- Documented the deployed check in the current roadmap and source-of-truth docs.

## Deployed checks

The deployed smoke script defaults to `https://bazar-baz.ir` and can be pointed at another deployment with `DEPLOYED_URL` or `NEXT_PUBLIC_DEPLOYED_APP_URL`.

It verifies:

- `robots.txt` is reachable and points to `/sitemap.xml`.
- `robots.txt` and `sitemap.xml` use the configured deployed base URL.
- `sitemap.xml` is reachable and contains public URL entries.
- Slug-like shop category, service category, product detail, and service detail URLs exist in the sitemap.
- Sampled slug pages are reachable.
- Sampled slug pages expose canonical links, JSON-LD, and `og:image`.
- Product and service detail slug URLs resolve through the public APIs.
- Product and service legacy ID URLs redirect to the slug URL.

## Guardrails

- The script samples a small number of URLs per route family by default to keep live checks fast.
- `DEPLOYED_SLUG_SEO_MAX_PER_KIND` can raise or lower the per-family sample count.
- `DEPLOYED_SLUG_SEO_ALLOW_EMPTY=1` is available only for explicit empty-data deployments; normal production verification should fail when slug-like sitemap entries are absent.
- The check is read-only and does not require dashboard credentials.

## Validation

Run:

```powershell
pnpm run quality:deployed-slug-seo
pnpm run e2e:deployed:slug-seo
pnpm run quality:public-detail-slugs
pnpm run quality:local
pnpm run typecheck
pnpm run build
```

## Deferred

- Dashboard UI for manually editing category slugs.
- Dashboard UI for manually editing product/service slugs.
- Tenant-specific generated Open Graph images for detail pages.
