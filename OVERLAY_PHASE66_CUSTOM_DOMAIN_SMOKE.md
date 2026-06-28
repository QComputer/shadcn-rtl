# Overlay Phase 66 — Custom-Domain Production Smoke Tests

## Apply

```powershell
Expand-Archive -Path .\bazar-baz-phase66-custom-domain-smoke-overlay.zip -DestinationPath . -Force
node scripts/setup-register-custom-domain-smoke-package-scripts.mjs
pnpm run quality:custom-domain-smoke
```

## Run against Ahmad/Khalae

```powershell
$env:CUSTOM_DOMAIN_SMOKE_BASE_URL="https://www.khalae.ir"
$env:CUSTOM_DOMAIN_SMOKE_PLATFORM_URL="https://www.bazar-baz.ir"
$env:CUSTOM_DOMAIN_SMOKE_SHOP_SLUG="ahmad"
pnpm run e2e:custom-domain-smoke
```

## Included files

```txt
scripts/e2e/custom-domain-smoke.mjs
scripts/quality/validate-custom-domain-smoke.mjs
scripts/setup-register-custom-domain-smoke-package-scripts.mjs
docs/PHASE_66_CUSTOM_DOMAIN_SMOKE.md
OVERLAY_PHASE66_CUSTOM_DOMAIN_SMOKE.md
```

## Validation

```powershell
pnpm run quality:custom-domain-smoke
```

## Commit

```powershell
git add -- `
  scripts/e2e/custom-domain-smoke.mjs `
  scripts/quality/validate-custom-domain-smoke.mjs `
  scripts/setup-register-custom-domain-smoke-package-scripts.mjs `
  docs/PHASE_66_CUSTOM_DOMAIN_SMOKE.md `
  OVERLAY_PHASE66_CUSTOM_DOMAIN_SMOKE.md `
  package.json

git commit -m "test(domains): add custom-domain production smoke checks"
```
