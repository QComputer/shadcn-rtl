# Overlay — Phase 66A Platform Default FA Locale

## Apply

```powershell
Expand-Archive -Path .\bazar-baz-phase66a-platform-default-fa-locale-overlay.zip -DestinationPath . -Force
node scripts/setup-register-platform-default-locale-package-scripts.mjs
pnpm run quality:platform-default-locale
pnpm run quality:custom-domain-default-locale
pnpm typecheck
pnpm build
```

## Deployed smoke

```powershell
$env:PLATFORM_DEFAULT_LOCALE_BASE_URL="https://www.bazar-baz.ir"
pnpm run e2e:platform-default-locale
```

## Files

- `proxy.ts`
- `scripts/e2e/platform-default-locale-smoke.mjs`
- `scripts/quality/validate-platform-default-locale.mjs`
- `scripts/setup-register-platform-default-locale-package-scripts.mjs`
- `docs/PHASE_66A_PLATFORM_DEFAULT_FA_LOCALE.md`
- `OVERLAY_PHASE66A_PLATFORM_DEFAULT_FA_LOCALE.md`

## Result

No-locale platform-domain links always default to Persian:

- `/` → `/fa`
- `/dashboard` → `/fa/dashboard`
- `/shop/ahmad` → `/fa/shop/ahmad`

Explicit locales remain available:

- `/en/...`
- `/ar/...`
