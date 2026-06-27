# Phase 50 - Public Category Metadata and Listing SEO Polish

P50 adds indexable category landing pages for public product and service listings.

## Scope

- Added public shop product-category pages:
  - `/{locale}/shop/{slug}/category/{categoryId}`
- Added public appointment service-category pages:
  - `/{locale}/appointment/{slug}/services/category/{categoryId}`
- Added route metadata for both category page families through the shared P48 SEO helpers.
- Added `CollectionPage`, `ItemList`, item-level Product/Service, and breadcrumb JSON-LD.
- Added category links from existing public shop and appointment service listing screens.
- Added category URLs to the dynamic sitemap for active categories that contain active products/services.
- Added `quality:public-category-seo` and registered it in `quality:local`.

## Guardrails

- Category pages only resolve active, non-deleted organizations and active, non-deleted categories.
- Product category pages hide out-of-stock inventory-tracked products.
- Category sitemap entries are limited and database-backed, matching the existing dynamic sitemap strategy.
- Transactional pages remain noindexed by P49.

## Validation

Run:

```powershell
pnpm run quality:public-category-seo
pnpm run quality:public-seo
pnpm run quality:public-seo-qa
pnpm run typecheck
pnpm run quality:local
pnpm run build
```

## Deferred

- Category slugs instead of category IDs.
- Category-specific generated Open Graph images.
- Pagination for very large category inventories.
- Localized empty-state copy for the new server-rendered category pages.
