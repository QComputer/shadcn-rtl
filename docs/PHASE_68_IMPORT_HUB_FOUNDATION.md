# Phase 68 - Import Hub Foundation

Date: 2026-06-28

## Summary

P68 adds the central Import Hub foundation for seller-initiated, consent-based imports. It introduces organization-scoped external sources, import jobs, imported product drafts, and imported content drafts, plus dashboard/API shells for intake, cancellation, and draft review.

This phase intentionally does not perform real scraping, real third-party API calls, Blob copying, product creation, or fanpage publishing.

## Implemented

- Prisma enums and models:
  - `ExternalImportSourceType`
  - `ExternalImportSourceStatus`
  - `ExternalImportJobStatus`
  - `ImportedDraftStatus`
  - `ExternalImportSource`
  - `ExternalImportJob`
  - `ImportedProductDraft`
  - `ImportedContentDraft`
- Migration:
  - `prisma/migrations/20260628000100_import_hub_foundation/migration.sql`
- Import helpers:
  - `lib/import-hub/types.ts`
  - `lib/import-hub/source-detection.ts`
  - `lib/import-hub/normalizers.ts`
- Service:
  - `lib/services/import-hub.service.ts`
- Dashboard APIs:
  - `GET /api/dashboard/imports/jobs`
  - `POST /api/dashboard/imports/jobs`
  - `GET /api/dashboard/imports/jobs/[jobId]`
  - `POST /api/dashboard/imports/jobs/[jobId]/cancel`
  - `POST /api/dashboard/imports/jobs/[jobId]/review`
- Dashboard UI:
  - `/{locale}/dashboard/imports`
- Navigation and access:
  - Imports route added to dashboard navigation policy.
  - Legacy dashboard access registry includes `/dashboard/imports`.
  - Sidebar includes localized Import Hub labels.
- Validator:
  - `scripts/quality/validate-import-hub-foundation.mjs`
  - `quality:import-hub-foundation`
  - Included in `quality:local`.

## Safety Behavior

- External URL jobs require seller ownership/permission confirmation.
- Jobs are created as `NEEDS_REVIEW` with an explicit `importerEnabled: false` summary.
- Imported product/content records remain drafts.
- Review actions can mark drafts `APPROVED` or `REJECTED`; they do not publish or create real products/posts.
- Source URL, normalized URL, metadata, actor, organization, and consent state are stored for auditability.
- The service does not call `fetch`, does not create products, and does not create fanpage posts.

## Validation

```powershell
pnpm run quality:import-hub-foundation
pnpm prisma generate
pnpm run typecheck
pnpm run build
```

## Next

P69 should add CSV/Excel product import parsing into `ImportedProductDraft` rows, still draft-first and review-before-import.
