# Phase 55 - Public Slug Preview and Rich Share Polish

P55 makes dashboard-managed public slugs easier to verify and keeps shared public previews image-rich.

## Scope

- Added a reusable dashboard `SlugPreviewActions` control for copying and opening public slug URLs.
- Added public URL preview/copy actions to category, product, and service slug fields.
- Exposed service-category organization slugs in dashboard list responses so appointment category previews can resolve their public path.
- Added explicit 1200x630 image metadata dimensions and alt text to shared public metadata.
- Updated product/service detail metadata and JSON-LD image fallbacks to prefer item images, then category/organization cover images, then logos.
- Added `quality:public-slug-preview-share` and registered it in the aggregate source validator.

## Guardrails

- Preview actions are disabled until a real public path can be derived.
- Preview URLs use the current browser origin, so they work in local, preview, and production environments.
- Dashboard mutation targets remain ID-based.
- Fallback Open Graph images remain available through `getSeoImageUrl` when records have no uploaded image.

## Validation

Run:

```powershell
pnpm run quality:public-slug-preview-share
pnpm run quality:dashboard-slug-editing
pnpm run quality:public-seo
pnpm run quality:public-category-seo
pnpm run quality:public-detail-slugs
pnpm run typecheck
pnpm run quality:local
pnpm run build
```

## Deferred

- Tenant-specific generated Open Graph images.
- Bulk slug preview/export tools.
- Deployed screenshot validation for social card renderers.
