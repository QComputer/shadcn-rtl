# Phase 52 - Public Product and Service Slug Detail URLs

P52 makes public product and service detail URLs human-readable while keeping legacy ID routes compatible.

## Scope

- Added nullable `slug` fields to `Product` and `Service`.
- Added a PostgreSQL migration that backfills product and service slugs.
- Added shared detail slug normalization and unique slug generation.
- Updated product and service create/update flows to assign stable slugs.
- Updated public product/service detail APIs to resolve either ID or slug.
- Updated public detail metadata/layouts to canonicalize to slug URLs and redirect ID URLs to slug URLs when possible.
- Updated public shop cards, service cards, category JSON-LD, search results, and sitemap entries to prefer `slug || id`.
- Added `quality:public-detail-slugs` and registered it in `quality:local`.

## Guardrails

- Existing product/service ID URLs remain valid.
- Booking flows still use service IDs where the booking API expects IDs.
- Slug collisions are resolved with numeric suffixes inside each organization.
- Dashboard/admin routes remain ID-based for stable internal mutation targets.

## Validation

Run:

```powershell
pnpm run db:validate
pnpm run quality:public-detail-slugs
pnpm run quality:public-seo
pnpm run typecheck
pnpm run quality:local
pnpm run build
```

## Deferred

- Dedicated dashboard slug editing UI.
- Tenant-specific generated Open Graph images for detail pages.
- Deployed crawl verification for slug redirects.
