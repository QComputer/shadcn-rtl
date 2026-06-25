# Phase 37 Overlay Manifest

Overlay: `bazar-baz-phase37-dashboard-navigation-copy-overlay.zip`

Apply from the project root:

```powershell
Expand-Archive -LiteralPath .\bazar-baz-phase37-dashboard-navigation-copy-overlay.zip -DestinationPath . -Force
```

## Files included

```txt
components/dashboard/dashboard-shell.tsx
scripts/quality/validate-dashboard-navigation-copy.mjs
scripts/quality/validate-project.mjs
package.json
README.md
docs/CURRENT_SOURCE_OF_TRUTH.md
docs/PHASE_37_DASHBOARD_NAVIGATION_COPY.md
docs/PHASE_37_OVERLAY_MANIFEST.md
```

## Local validation

```powershell
pnpm run quality:dashboard-navigation-copy
pnpm run quality:members-provider-hardening
pnpm run quality:local
pnpm run typecheck
pnpm run build
pnpm run release:stage
pnpm run quality:release-staged
```
