# Phase 76 - External Source Mapping and Re-import Diff

P76 makes repeat imports safer by detecting when a newly imported draft appears to come from an already imported external source.

Implemented:

- Added `lib/import-hub/source-mapping.ts` to match incoming product/content draft candidates by `sourceExternalId` and `sourceUrl`.
- Added field-level re-import diff summaries under `sourceMetadata.reimport`.
- Added duplicate warnings to imported draft rows while keeping all imports draft-first.
- Added `POST /api/dashboard/imports/jobs/[jobId]/resolve` for merge, skip, and create-new decisions.
- Added audit logging for re-import resolution decisions.
- Added duplicate evidence and merge/skip/create-new actions to the Import Hub review table.
- Added `quality:external-source-mapping` and registered it in `quality:local`.

Safety notes:

- P76 does not publish content, create live products, or modify the previously imported source draft.
- Merge decisions currently mark the new duplicate draft as `MERGED`; a later import approval phase can apply field-level merges into live products/posts.
- Create-new keeps the selected draft in `DRAFT` for normal review.

Validation:

```powershell
pnpm run quality:external-source-mapping
pnpm prisma generate
pnpm run typecheck
pnpm run build
```
