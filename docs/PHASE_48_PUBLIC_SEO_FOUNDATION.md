# Phase 48 - Public SEO Foundation

P48 adds a tenant-safe SEO foundation for public organization content without changing public UI behavior.

## Scope

- Centralized public SEO helpers in `lib/seo.ts` for canonical URLs, locale alternates, Open Graph/Twitter metadata, public image URL normalization, and JSON-LD builders.
- Added a small `JsonLd` component for safe `application/ld+json` rendering.
- Added route metadata for public shop, appointment, product detail, service detail, and fanpage routes.
- Added structured data for organizations, products, services, breadcrumbs, and fanpage collection pages.
- Replaced static public `robots.txt` and sitemap XML artifacts with Next metadata routes:
  - `app/robots.ts`
  - `app/sitemap.ts`
- Added live sitemap coverage for localized home, shop, shop profile, shop fanpage, product detail, appointment profile, appointment services, appointment fanpage, and service detail URLs.
- Added `quality:public-seo` and registered it in `quality:local`.

## Guardrails

- Dashboard, API, and auth surfaces are disallowed in `robots.txt`.
- Metadata and sitemap URLs use `NEXT_PUBLIC_DEPLOYED_APP_URL`, then `NEXT_PUBLIC_APP_URL`, then `https://bazar-baz.ir`.
- Locale alternates are generated for FA, EN, and AR public routes with `x-default` pointing to FA.
- Sitemap generation is database-backed at runtime and falls back to localized home URLs if the database query fails.

## Validation

Run:

```powershell
pnpm run quality:public-seo
pnpm run typecheck
pnpm run quality:local
```

Recommended full phase gate remains the current source-of-truth checklist plus P42-P48 validators.

## Deferred

- Search Console submission and production crawl validation.
- Per-category metadata pages.
- Rich social preview image generation.
- Product availability based on exact variant stock state.
