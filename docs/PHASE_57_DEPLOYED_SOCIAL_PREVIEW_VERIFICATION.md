# Phase 57 - Deployed Social Preview Verification

Date: 2026-06-27

## Scope

- Added a read-only deployed social preview smoke script at `scripts/e2e/deployed-social-preview.mjs`.
- The script samples deployed sitemap URLs for organization, category, product, and service pages.
- For each sampled page, it extracts `og:image`, resolves the URL, verifies an image content type, and captures image bytes under `test-results/deployed-social-preview`.
- It directly captures a deterministic generated `/og-image?...` card to prove generated previews are crawler-accessible after deployment.
- The generated-card probe uses Persian (`fa`) text by default because Persian is the primary public language.
- Generated OG cards now load bundled Vazirmatn font files and render `fa`/`ar` cards with RTL direction so Persian SEO previews do not depend on platform fonts.
- The root app route redirects first-time unprefixed visits from `/` to `/fa`.
- It captures one uploaded-image social preview candidate when deployed data includes uploaded share media.
- Added `quality:deployed-social-preview` and package aliases for deployed smoke execution.

## Runbook

```powershell
$env:DEPLOYED_URL="https://bazar-baz.ir"
pnpm run e2e:deployed:social-preview
```

Optional controls:

```powershell
$env:DEPLOYED_SOCIAL_PREVIEW_MAX_PER_KIND="2"
$env:DEPLOYED_SOCIAL_PREVIEW_SCAN_LIMIT_PER_KIND="24"
$env:DEPLOYED_SOCIAL_PREVIEW_REQUIRE_CATEGORY="1"
$env:DEPLOYED_SOCIAL_PREVIEW_CAPTURE_DIR="test-results/deployed-social-preview"
```

Use `DEPLOYED_SOCIAL_PREVIEW_ALLOW_EMPTY=1` only for intentionally sparse non-production deployments. Production verification should require sitemap candidates and an uploaded-image candidate. Category sitemap candidates are sampled by default; set `DEPLOYED_SOCIAL_PREVIEW_REQUIRE_CATEGORY=1` when deployed category pages are expected to be reachable.

## Capture Output

The script writes:

```txt
test-results/deployed-social-preview/manifest.json
test-results/deployed-social-preview/*.png|*.jpg|*.webp|*.gif
```

These are generated verification artifacts and must not be committed.

## Validation

Source gate:

```powershell
pnpm run quality:deployed-social-preview
```

Recommended phase gate:

```powershell
pnpm run typecheck
pnpm run quality:i18n-completion
pnpm run quality:deployed-social-preview
pnpm run quality:tenant-og-images
pnpm run quality:deployed-slug-seo
pnpm run quality:local
pnpm run build
```

Deployed gate:

```powershell
$env:DEPLOYED_URL="https://bazar-baz.ir"
pnpm run e2e:deployed:social-preview
```

## Deferred

- Social network scraper cache refresh flows.
- Browser-rendered visual diff review for the captured social images.
- CI upload of capture artifacts.
