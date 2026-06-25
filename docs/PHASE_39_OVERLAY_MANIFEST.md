# Phase 39 Overlay Manifest

Overlay: `bazar-baz-phase39-dashboard-route-parity-overlay.zip`

## Files

```txt
components/dashboard/dashboard-sidebar.tsx
lib/dashboard/navigation-policy.ts
scripts/quality/validate-dashboard-role-navigation.mjs
scripts/quality/validate-dashboard-route-parity.mjs
scripts/quality/validate-project.mjs
package.json
README.md
docs/CURRENT_SOURCE_OF_TRUTH.md
docs/PHASE_39_DASHBOARD_ROUTE_PARITY.md
docs/PHASE_39_OVERLAY_MANIFEST.md
```

## Apply

```powershell
Expand-Archive -LiteralPath .\bazar-baz-phase39-dashboard-route-parity-overlay.zip -DestinationPath . -Force
```

## Validate

```powershell
pnpm run quality:dashboard-route-parity
pnpm run quality:dashboard-role-navigation
pnpm run quality:dashboard-navigation-copy
pnpm run quality:members-provider-hardening
pnpm run quality:local
pnpm run typecheck
pnpm run build
pnpm run release:stage
pnpm run quality:release-staged
```
