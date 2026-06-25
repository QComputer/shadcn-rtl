# P41 Overlay Manifest — Dashboard Guard Smoke

## Updated files

```txt
components/dashboard/dashboard-route-access-boundary.tsx
scripts/quality/validate-dashboard-route-guard-smoke.mjs
scripts/quality/validate-project.mjs
package.json
README.md
docs/CURRENT_SOURCE_OF_TRUTH.md
docs/PHASE_41_DASHBOARD_GUARD_SMOKE.md
docs/PHASE_41_OVERLAY_MANIFEST.md
```

## Apply

```powershell
Expand-Archive -LiteralPath .\bazar-baz-phase41-dashboard-guard-smoke-overlay.zip -DestinationPath . -Force
```

## Validate

```powershell
pnpm run quality:dashboard-route-guard-smoke
pnpm run quality:dashboard-route-authorization
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
