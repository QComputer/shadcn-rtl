# P38 Overlay Manifest — Dashboard Sidebar Role-Aware Navigation Cleanup

Apply from the project root:

```powershell
Expand-Archive -LiteralPath .\bazar-baz-phase38-dashboard-role-navigation-overlay.zip -DestinationPath . -Force
```

## Files included

```txt
components/dashboard/dashboard-sidebar.tsx
scripts/quality/validate-dashboard-role-navigation.mjs
scripts/quality/validate-project.mjs
package.json
README.md
docs/CURRENT_SOURCE_OF_TRUTH.md
docs/PHASE_38_DASHBOARD_ROLE_NAVIGATION.md
docs/PHASE_38_OVERLAY_MANIFEST.md
```

## Validation

```powershell
pnpm run quality:dashboard-role-navigation
pnpm run quality:dashboard-navigation-copy
pnpm run quality:members-provider-hardening
pnpm run quality:local
pnpm run typecheck
pnpm run build
pnpm run release:stage
pnpm run quality:release-staged
```

## Commit

```powershell
git status --short
git add components/dashboard/dashboard-sidebar.tsx scripts/quality/validate-dashboard-role-navigation.mjs scripts/quality/validate-project.mjs package.json README.md docs/CURRENT_SOURCE_OF_TRUTH.md docs/PHASE_38_DASHBOARD_ROLE_NAVIGATION.md docs/PHASE_38_OVERLAY_MANIFEST.md
git commit -m "Make dashboard sidebar role-aware"
git push origin main
```
