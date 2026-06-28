# Phase 81 - Export Downloads

P81 turns the Export Hub preview foundation into an authenticated download flow for completed jobs.

Implemented:

- Added `GET /api/dashboard/exports/jobs/[jobId]/download`.
- Reused dashboard auth and organization membership checks for downloads.
- Returned CSV/JSON as an attachment with `private, no-store` caching and `nosniff` headers.
- Kept export job list responses lightweight by omitting stored payloads from list results.
- Preserved the existing single-job preview API for dashboard inspection.
- Added Persian-first dashboard download actions for completed export jobs.
- Added `quality:export-downloads` and registered it in `quality:local`.

Safety notes:

- Download URLs are protected dashboard routes, not public links.
- Only completed jobs can be downloaded.
- Large exports are still generated synchronously from the existing stored payload; future phases can move generated artifacts to Blob storage if row limits grow beyond the current snapshot model.

Validation:

```powershell
pnpm run quality:export-downloads
pnpm run quality:export-hub-foundation
pnpm run quality:local
pnpm run typecheck
pnpm run build
```
