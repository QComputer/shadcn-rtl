# Overlay — Phase 62A Dashboard Organizations SearchParams Hotfix

Apply on top of Phase 62.

```powershell
Expand-Archive -Path .\bazar-baz-phase62a-dashboard-organizations-searchparams-hotfix-overlay.zip -DestinationPath . -Force
node scripts/quality/validate-dashboard-organizations-searchparams-hotfix.mjs
pnpm run quality:dashboard-organizations-published
pnpm typecheck
pnpm build
```

Changed files:

- `app/[locale]/dashboard/organizations/page.tsx`
- `scripts/quality/validate-dashboard-organizations-searchparams-hotfix.mjs`
- `docs/PHASE_62A_DASHBOARD_ORGANIZATIONS_SEARCHPARAMS_HOTFIX.md`
