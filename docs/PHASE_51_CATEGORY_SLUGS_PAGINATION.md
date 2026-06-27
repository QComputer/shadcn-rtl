# Phase 51 - Category Slugs and Public Listing Pagination

P51 makes public category URLs more durable and caps large category pages.

## Scope

- Added nullable `slug` fields to product and service categories.
- Added a PostgreSQL migration that backfills existing category slugs.
- Added shared category slug normalization and unique slug generation.
- Updated category create/update services to assign stable slugs and revalidate public category URLs.
- Kept existing ID-based category routes backward-compatible by resolving either ID or slug and redirecting old ID URLs to slug URLs when possible.
- Updated public shop/service listing links and sitemap entries to prefer `category.slug || category.id`.
- Added server-side pagination to product-category and service-category landing pages.
- Added page-aware canonical metadata, locale alternates, and `rel="prev"` / `rel="next"` pagination links.
- Added `quality:public-category-slugs-pagination` and registered it in `quality:local`.

## Guardrails

- Existing ID routes remain valid for legacy links.
- Page 1 category URLs remain clean; page 2+ uses `?page={n}`.
- Category pages still only resolve active, non-deleted organizations and active, non-deleted categories.
- Product category pagination still hides out-of-stock inventory-tracked products.
- Slug collisions are resolved with numeric suffixes inside each organization.

## Validation

Run:

```powershell
pnpm run db:validate
pnpm run quality:public-category-slugs-pagination
pnpm run quality:public-category-seo
pnpm run typecheck
pnpm run quality:local
pnpm run build
```

## Deferred

- Dedicated dashboard slug editing UI.
- Category-specific generated Open Graph images.
- Product/service slugs for detail pages.
