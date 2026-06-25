# P40 Dashboard Route Authorization Overlay Manifest

Apply from the project root:

```powershell
Expand-Archive -LiteralPath .\bazar-baz-phase40-dashboard-route-authorization-overlay.zip -DestinationPath . -Force
```

Updated files:

```txt
components/dashboard/dashboard-route-access-boundary.tsx
components/dashboard/dashboard-shell.tsx
lib/dashboard/navigation-policy.ts
scripts/quality/validate-dashboard-route-authorization.mjs
scripts/quality/validate-project.mjs
package.json
README.md
docs/CURRENT_SOURCE_OF_TRUTH.md
docs/PHASE_40_DASHBOARD_ROUTE_AUTHORIZATION.md
docs/PHASE_40_OVERLAY_MANIFEST.md
```

Focused validation:

```powershell
pnpm run quality:dashboard-route-authorization
pnpm run quality:dashboard-route-parity
pnpm run quality:dashboard-role-navigation
pnpm run quality:dashboard-navigation-copy
```

Full recommended validation:

```powershell
pnpm run quality:local
pnpm run typecheck
pnpm run build
pnpm run release:stage
pnpm run quality:release-staged
```
