# P115 - Creative Studio Organization Logo and Cover Generation Request Controls

Status: implemented

## Goal

P115 adds seller-facing Creative Studio request controls for organization logo and cover work while keeping provider execution disabled until the organization-brand provider contract is implemented.

## Scope

- Adds dashboard controls for `ORGANIZATION_BRAND` requests with `LOGO` and `COVER` asset targets.
- Records request-only Creative Studio jobs through the existing dashboard-scoped `/api/dashboard/creative-studio/jobs` endpoint.
- Persists P115 metadata in `CreativeStudioJob.inputs.p115BrandGeneration` and `CreativeStudioAsset.sourceMetadata.p115BrandGeneration`.
- Requires the existing `settings:manage` permission through the Creative Studio service target-access guard.
- Uses deterministic logo and cover aspect ratios:
  - `LOGO` -> `organization.logo` -> `1:1`
  - `COVER` -> `organization.coverImage` -> `16:9`
- Keeps generated items as internal draft assets until a public URL exists, a candidate is selected, and the existing confirmation-gated apply action is completed.
- Keeps provider execution, browser worker calls, and public auto-apply disabled.

## Non-goals

P115 does not implement `/v1/organization-brand/jobs`, does not call a new provider, does not add direct browser-to-worker calls, does not auto-apply logo or cover images, and does not broaden generation to campaigns, fanpage posts, OG images, or imported media.

## Validation

```powershell
pnpm run quality:creative-studio-organization-brand-request-controls
pnpm run quality:creative-studio-organization-brand-readiness
pnpm run quality:creative-studio-generated-asset-selection
pnpm run quality:creative-studio-product-image-generation
pnpm run quality:local
pnpm run typecheck
pnpm run build
```

## Next phase

P116 - Creative Studio organization logo and cover generated-asset acceptance
