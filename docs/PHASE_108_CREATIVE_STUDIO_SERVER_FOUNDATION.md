# Phase 108 - Creative Studio server foundation

Status: implemented.

Date: 2026-06-30

## Goal

Add the narrow server-side Creative Studio foundation described in P107 without adding dashboard UI, public storefront behavior, or real provider calls.

P108 creates local ownership, draft asset, and usage records so later phases can safely add a seller-facing Creative Studio workspace. It keeps all generation MOCK-only and records asset application intent without mutating product, logo, cover, fanpage, campaign, or public cache state.

## Implemented scope

Database foundation:

- `CreativeStudioJob`
- `CreativeStudioAsset`
- `CreativeStudioUsageEvent`
- `CreativeStudioTargetType`
- `CreativeStudioAssetType`
- `CreativeStudioJobStatus`
- `CreativeStudioAssetStatus`
- `CreativeStudioUsageAction`
- Migration: `prisma/migrations/20260630000100_creative_studio_foundation/migration.sql`

Service boundary:

- `lib/services/creative-studio.service.ts`
- Uses organization-scoped access.
- Reuses existing AI media paid-provider status and rollback checks.
- Creates MOCK-only local jobs.
- Creates draft asset records.
- Writes Creative Studio usage events.
- Writes audit logs for job creation and application-intent recording.
- Does not call external providers.
- Does not mutate public/product/organization/fanpage/campaign assets.

API foundation:

- `GET /api/dashboard/creative-studio/status`
- `GET /api/dashboard/creative-studio/usage`
- `GET /api/dashboard/creative-studio/jobs`
- `POST /api/dashboard/creative-studio/jobs`
- `GET /api/dashboard/creative-studio/jobs/[jobId]`
- `POST /api/dashboard/creative-studio/jobs/[jobId]/cancel`
- `POST /api/dashboard/creative-studio/assets/[assetId]/apply`

Validation:

- `createCreativeStudioJobSchema`
- `creativeStudioJobFilterSchema`
- `applyCreativeStudioAssetSchema`
- `quality:creative-studio-foundation`

## Safety rules

P108 keeps these safety guarantees:

- Dashboard authentication is required for every route.
- Non-SUPER_ADMIN users are constrained to their current organization.
- SUPER_ADMIN must still operate against an organization context.
- Product targets require `product:update`.
- Campaign, fanpage, imported media, and organization-brand targets are organization-scoped.
- Paid providers remain governed by the existing AI media approval, budget, and rollback policy.
- The provider is always `MOCK` in P108.
- Asset application endpoint records intent only with `applyToTarget: false`.
- No public cache revalidation occurs.
- No product, organization logo, organization cover, campaign, or fanpage post image is changed.

## Validation

Required local validation:

```powershell
pnpm run db:generate
pnpm run db:validate
pnpm run quality:creative-studio-planning
pnpm run quality:creative-studio-foundation
pnpm run quality:ai-media
pnpm run quality:ai-media-paid-provider-controls
pnpm run quality:ai-media-cost-rollback
pnpm run quality:pwa-push-sms-acceptance
pnpm run quality:clean-source
pnpm run quality:local
pnpm run typecheck
pnpm run build
```

## Known limitations

- P108 is not a seller-facing UI release.
- The apply endpoint intentionally records application intent only; actual public asset replacement belongs to a later phase.
- P108 does not add deployed Creative Studio smoke tests because there is no UI and no public behavior yet.
- P108 does not enable real paid generation.

## Recommended next phase

P109 - Creative Studio dashboard shell and read-only job review.
