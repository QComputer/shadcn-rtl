# Phase 56 - Tenant-Specific Open Graph Image Generation

Date: 2026-06-27

## Scope

- Upgraded `app/og-image/route.tsx` from a single default card into a parameterized, deterministic Open Graph image renderer.
- Added shared SEO helpers in `lib/seo.ts` for generated organization/category/product/service share image URLs.
- Preserved uploaded image precedence for organization cover/logo, category images, product images, and service images.
- Wired generated fallback cards into public organization, category, product, and service metadata when no uploaded share image exists.
- Excluded `/og-image` from locale-prefix proxy redirects so social crawlers can fetch the canonical generated image URL.
- Added `quality:tenant-og-images` and included it in `quality:local`.

## Behavior

Uploaded media still wins for rich previews:

```txt
record image -> organization cover -> organization logo -> generated tenant OG card
```

Generated cards are URL-query based under `/og-image`, so metadata remains deterministic and cache-safe across `fa`, `en`, and `ar` routes.

## Validation

Focused gate:

```powershell
pnpm run quality:tenant-og-images
```

Recommended phase gate:

```powershell
pnpm run typecheck
pnpm run quality:public-seo-qa
pnpm run quality:public-category-seo
pnpm run quality:public-detail-slugs
pnpm run quality:public-slug-preview-share
pnpm run quality:tenant-og-images
pnpm run quality:local
pnpm run build
```

## Deferred

- Deployed social-card screenshot capture.
- Per-tenant custom color/theme settings for generated OG cards.
- Search Console or social scraper cache refresh workflows.
