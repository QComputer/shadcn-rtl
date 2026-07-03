# P120 — Creative Studio Reviewed Asset Apply and Rollback Workflow

**Status: implemented**

## Summary

P120 adds explicit manual apply and rollback for reviewed organization-brand Creative Studio assets. Generated assets remain draft/review-only by default. Only an explicit dashboard confirm flow can mutate `Organization.logo` or `Organization.coverImage`. Rollback restores the previous public asset when metadata is available.

## Scope

- Explicit manual apply for `ORGANIZATION_BRAND` `LOGO` and `COVER` assets only.
- Rollback for the last manually applied organization-brand asset.
- Public cache revalidation after apply and rollback.
- Persian-first dashboard UI with confirmation dialog.

## Non-scope (next phase)

- Product image apply workflow with rollback.
- Fanpage post image apply.
- Campaign image apply.
- Imported media apply.

## Apply flow

1. Dashboard user selects a generated asset.
2. User clicks apply button (`اعمال روی لوگو` or `اعمال روی کاور`).
3. Confirmation dialog requires explicit confirmation text.
4. Server validates:
   - authenticated dashboard user
   - organization access
   - `settings:manage` permission
   - asset belongs to organization
   - asset `targetType` is `ORGANIZATION_BRAND`
   - asset `assetType` matches requested target
   - asset is not rejected/archived
   - asset URL passes `assertPublicSafeAssetUrl`
5. Server stores rollback metadata with previous `Organization.logo`/`coverImage` value.
6. Server updates `Organization.logo` or `Organization.coverImage`.
7. Server records `ASSET_APPLIED` usage event and audit log.
8. Server revalidates public paths.
9. Dashboard shows applied state.

## Rollback flow

1. Dashboard user clicks rollback on an applied asset.
2. Server validates asset is `APPLIED` and has rollback metadata.
3. Server restores previous `Organization.logo`/`coverImage` value.
4. Server records `ASSET_ROLLED_BACK` usage event and audit log.
5. Server revalidates public paths.
6. Dashboard shows rolled-back state.

## Routes

- `POST /api/dashboard/creative-studio/assets/[assetId]/apply`
- `POST /api/dashboard/creative-studio/assets/[assetId]/rollback`

## Validation

```powershell
pnpm run quality:creative-studio-reviewed-asset-apply
pnpm run quality:local
```

## Boundaries

- No auto-apply. `publicAutoApply` remains `false` in provider execution and result ingestion paths.
- No mutation of `Product.image`, `FanpagePost.image`, or campaign assets.
- No direct ComfyUI/GPU/local worker calls from Bazar Baz.
- No `file://`, `localhost`, or private network asset URLs.
- No real billing or provider charges.
