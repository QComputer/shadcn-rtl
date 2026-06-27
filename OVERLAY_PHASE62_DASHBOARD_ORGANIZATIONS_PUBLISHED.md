# Overlay — Phase 62 Dashboard Organizations Published

Apply this flat overlay from the project root.

```powershell
Expand-Archive -Path .\bazar-baz-phase62-dashboard-organizations-published-overlay.zip -DestinationPath . -Force
node scripts/setup-register-dashboard-organizations-package-scripts.mjs
pnpm run quality:dashboard-organizations-published
pnpm typecheck
pnpm build
```

Changed files:

- `app/[locale]/dashboard/organizations/page.tsx`
- `app/api/organizations/route.ts`
- `scripts/quality/validate-dashboard-organizations-published.mjs`
- `scripts/setup-register-dashboard-organizations-package-scripts.mjs`
- `docs/PHASE_62_DASHBOARD_ORGANIZATIONS_PUBLISHED.md`

This publishes the platform organizations page as a SUPER_ADMIN-only server page and hardens the organization list/create API.
