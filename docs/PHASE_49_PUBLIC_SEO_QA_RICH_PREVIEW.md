# Phase 49 - Public SEO QA and Rich Preview Hardening

P49 follows the public SEO foundation with concrete crawl-policy and preview-image guardrails.

## Scope

- Added a generated default Open Graph image route handler at `app/og-image/route.tsx`.
- Updated the shared SEO fallback image from missing `/og-image.jpg` to `/og-image`.
- Updated base locale metadata to use the generated Open Graph image for Open Graph and Twitter previews.
- Added a shared `buildNoIndexMetadata()` helper for transactional or customer-specific public pages.
- Added explicit noindex metadata layouts for:
  - shop checkout
  - shop order status
  - appointment booking
  - appointment lookup
  - appointment status
- Expanded dynamic `robots.txt` disallow rules for the same transactional and lookup-like route families across FA, EN, and AR.
- Added `quality:public-seo-qa` and registered it in `quality:local`.

## Guardrails

- Indexable organization, product, service, and fanpage pages remain covered by P48 metadata and sitemap entries.
- Transactional/customer-specific pages now emit `index: false` and `follow: false`.
- Robots disallow rules cover dynamic localized URL families before crawlers render page metadata.
- Rich preview fallback no longer depends on a missing static file.

## Validation

Run:

```powershell
pnpm run quality:public-seo-qa
pnpm run quality:public-seo
pnpm run typecheck
pnpm run quality:local
```

## Deferred

- Production Search Console submission.
- Runtime screenshot verification of social previews after deployment.
- Tenant-specific generated OG images.
- Category/listing-specific metadata polish.
