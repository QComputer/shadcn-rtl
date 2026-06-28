# Phase 78 - Export Hub Foundation

P78 gives sellers an organization-scoped way to back up or move Bazar Baz data.

Implemented:

- Added `ExportJobStatus`, `ExportJobFormat`, `ExportDataType`, and `ExportJob` to Prisma.
- Added migration `20260628000300_export_hub_foundation`.
- Added `lib/export-hub/types.ts`.
- Added `lib/services/export-hub.service.ts` for CSV/JSON export snapshots.
- Added `GET/POST /api/dashboard/exports/jobs`.
- Added `GET /api/dashboard/exports/jobs/[jobId]`.
- Added localized dashboard route `/{locale}/dashboard/exports`.
- Added dashboard navigation and access policy for management roles.
- Added export coverage for products, product categories, orders, customer-club members, and fanpage posts.
- Added audit logging for export job generation.
- Added `quality:export-hub-foundation` and registered it in `quality:local`.

Safety notes:

- Export jobs are organization-scoped through dashboard auth and membership checks.
- P78 stores generated CSV/JSON payload previews in the database as a foundation; future large exports should stream to Blob storage.
- P78 does not expose public export links. P81 adds protected dashboard downloads for completed jobs.

Validation:

```powershell
pnpm run quality:export-hub-foundation
pnpm prisma generate
pnpm run typecheck
pnpm run build
```
