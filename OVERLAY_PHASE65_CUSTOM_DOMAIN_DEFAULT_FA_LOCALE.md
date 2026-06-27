# Overlay — Phase 65 Custom-domain default Persian locale

Apply on top of Phase 64.

```powershell
Expand-Archive -Path .\bazar-baz-phase65-custom-domain-default-fa-locale-overlay.zip -DestinationPath . -Force
node scripts/setup-register-custom-domain-default-locale-package-scripts.mjs
pnpm run quality:custom-domain-default-locale
pnpm run quality:custom-domain-seo
pnpm typecheck
pnpm build
```

This overlay makes tenant custom domains Persian-first for bare/no-locale visits and keeps explicit `/en/...` and `/ar/...` paths supported.
