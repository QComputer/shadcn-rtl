# Overlay — Phase 64 Custom-Domain SEO Hardening

Apply from project root:

```powershell
Expand-Archive -Path .\bazar-baz-phase64-custom-domain-seo-hardening-overlay.zip -DestinationPath . -Force
node scripts/setup-register-custom-domain-seo-package-scripts.mjs
pnpm run quality:custom-domain-seo
pnpm run quality:shop-custom-domains
pnpm run quality:vercel-domain-automation
pnpm typecheck
pnpm build
```

No schema migration is included.

## Files

- `lib/custom-domain-routing.ts`
- `lib/custom-domain-seo.ts`
- `proxy.ts`
- `app/sitemap.ts`
- `app/api/internal/shop-primary-domain/route.ts`
- `app/api/public/custom-domain/sitemap/route.ts`
- `app/api/public/custom-domain/robots/route.ts`
- `scripts/quality/validate-custom-domain-seo-hardening.mjs`
- `scripts/setup-register-custom-domain-seo-package-scripts.mjs`
- `docs/PHASE_64_CUSTOM_DOMAIN_SEO_HARDENING.md`
- `OVERLAY_PHASE64_CUSTOM_DOMAIN_SEO_HARDENING.md`
