# Phase 82 - Deployed Import/Export Smoke

P82 adds a deployed verification script for the import/export flows that became the current post-P81 roadmap focus.

Implemented:

- Added `scripts/e2e/deployed-import-export-smoke.mjs`.
- Added `quality:deployed-import-export-smoke`.
- Added `e2e:deployed:import-export`.
- Registered the P82 source validator in `quality:local`.
- Verified unauthenticated import/export API guards.
- Verified deployed login with environment-provided credentials.
- Resolved the authenticated user's active organization.
- Created a draft-first manual text import job and verified it reaches `NEEDS_REVIEW`.
- Loaded created draft IDs and rejected the smoke drafts instead of publishing them.
- Created completed product JSON and CSV export jobs.
- Verified protected JSON/CSV download attachments.

Environment:

```powershell
$env:DEPLOYED_URL="https://www.bazar-baz.ir"
$env:DEPLOYED_USERNAME="Amir"
$env:DEPLOYED_PASSWORD="<password>"
pnpm run e2e:deployed:import-export
```

Safety notes:

- The smoke creates an import job and product draft, then rejects that draft. It does not approve or publish live products.
- Export jobs are organization-scoped snapshots and do not mutate catalog data.
- The script should run with an admin or manager account that has an active organization membership.

Validation:

```powershell
pnpm run quality:deployed-import-export-smoke
pnpm run e2e:deployed:import-export
pnpm run quality:local
pnpm run typecheck
pnpm run build
```
