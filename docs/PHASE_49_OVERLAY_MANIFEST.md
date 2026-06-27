# Phase 49 Overlay Manifest

Overlay: Public SEO QA and Rich Preview Hardening

## Files

```txt
app/og-image/route.tsx
app/robots.ts
app/[locale]/layout.tsx
app/[locale]/shop/[slug]/checkout/layout.tsx
app/[locale]/shop/[slug]/order/[orderNumber]/layout.tsx
app/[locale]/appointment/[slug]/booking/layout.tsx
app/[locale]/appointment/[slug]/my-appointments/layout.tsx
app/[locale]/appointment/[slug]/appointment/[id]/layout.tsx
lib/seo.ts
scripts/quality/validate-public-seo-qa.mjs
scripts/quality/validate-project.mjs
package.json
README.md
docs/CURRENT_SOURCE_OF_TRUTH.md
docs/PHASE_49_PUBLIC_SEO_QA_RICH_PREVIEW.md
docs/PHASE_49_OVERLAY_MANIFEST.md
```

## Validation

```powershell
pnpm run quality:public-seo-qa
pnpm run quality:public-seo
pnpm run typecheck
pnpm run quality:local
```
