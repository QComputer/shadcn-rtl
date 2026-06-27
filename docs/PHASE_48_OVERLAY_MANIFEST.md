# Phase 48 Overlay Manifest

Overlay: Public SEO Foundation

## Files

```txt
app/robots.ts
app/sitemap.ts
app/[locale]/shop/[slug]/layout.tsx
app/[locale]/appointment/[slug]/layout.tsx
app/[locale]/shop/[slug]/product/[productId]/layout.tsx
app/[locale]/appointment/[slug]/services/[serviceId]/layout.tsx
app/[locale]/shop/[slug]/fanpage/page.tsx
app/[locale]/appointment/[slug]/fanpage/page.tsx
components/seo/json-ld.tsx
lib/seo.ts
scripts/quality/validate-public-seo.mjs
scripts/quality/validate-project.mjs
package.json
README.md
docs/CURRENT_SOURCE_OF_TRUTH.md
docs/PHASE_48_PUBLIC_SEO_FOUNDATION.md
docs/PHASE_48_OVERLAY_MANIFEST.md
```

Removed stale static metadata artifacts:

```txt
public/robots.txt
public/sitemap.xml
public/sitemap-0.xml
```

## Validation

```powershell
pnpm run quality:public-seo
pnpm run typecheck
pnpm run quality:local
```
