# P41A Overlay Manifest — Dashboard Guard Smoke Script Fix

This overlay repackages the P41 dashboard guard-smoke files at repository root. The previous P41 archive accidentally included a top-level folder, so `Expand-Archive -DestinationPath .` did not overwrite `package.json` and the script `quality:dashboard-route-guard-smoke` could remain missing.

## Apply

```powershell
Expand-Archive -LiteralPath .\bazar-baz-phase41a-dashboard-guard-smoke-script-fix-overlay.zip -DestinationPath . -Force
```

## Files

```txt
components/dashboard/dashboard-route-access-boundary.tsx
scripts/quality/validate-dashboard-route-guard-smoke.mjs
scripts/quality/validate-project.mjs
package.json
README.md
docs/CURRENT_SOURCE_OF_TRUTH.md
docs/PHASE_41_DASHBOARD_GUARD_SMOKE.md
docs/PHASE_41_OVERLAY_MANIFEST.md
OVERLAY_MANIFEST.md
```

## Validation

```powershell
pnpm run quality:dashboard-route-guard-smoke
pnpm run quality:dashboard-route-authorization
pnpm run quality:local
pnpm run typecheck
pnpm run build
```
