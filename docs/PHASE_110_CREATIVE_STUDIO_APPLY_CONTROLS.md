# P110 - Creative Studio Apply Controls and Cache-Safe Public Asset Updates

Status: implemented

## Goal

P110 turns the P109 read-only Creative Studio review surface into an explicit, confirmation-gated apply workflow for safe public image fields. It does not add generation forms, provider calls, GPU-worker calls, automatic mutation, bulk apply, text generation, OCR, or campaign publishing.

## Supported public mutations

- `PRODUCT` + `PRODUCT_IMAGE` + `product.image` updates `Product.image`.
- `ORGANIZATION_BRAND` + `LOGO` + `organization.logo` updates `Organization.logo`.
- `ORGANIZATION_BRAND` + `COVER` + `organization.coverImage` updates `Organization.coverImage`.
- `FANPAGE_POST` + `FANPAGE_IMAGE` + `fanpagePost.image` updates `FanpagePost.image`.

## Unsupported mutations

- `CAMPAIGN_IMAGE` is recorded-only because `Campaign` has no clear direct public image field.
- `OG_IMAGE` is recorded-only until a target-specific OG image field exists.
- `IMPORT_MEDIA` is recorded-only until import-media ownership and publish targets are designed.

## Target authorization

Every apply request resolves an organization context, including SUPER_ADMIN requests. The asset and its job must belong to that organization, and the target record must also belong to that organization.

- `product.image` requires `product:update`.
- `organization.logo` and `organization.coverImage` require `settings:manage`.
- `fanpagePost.image` requires ADMIN, MANAGER, or SUPER_ADMIN dashboard access for the resolved organization.

## Public URL safety

Apply uses the first available public candidate in this order: `storedUrl`, `draftUrl`, then `sourceUrl`. The URL must be `http(s)` or a relative `/uploads/...` path. Credentialed URLs, protocol-relative URLs, private hosts, localhost, and non-public protocols such as `file:`, `javascript:`, and `data:` are rejected.

## Cache revalidation policy

After a successful mutation, P110 revalidates all supported locales: `fa`, `en`, and `ar`.

- Product image: shop home, product detail, product category when available, and the `home-page` cache tag.
- Organization logo/cover: shop home, shop fanpage, shop profile, appointment home, appointment fanpage, and the `home-page` cache tag.
- Fanpage post image: shop fanpage, appointment fanpage, and the `home-page` cache tag.

Revalidation errors are returned as warnings and stored in asset metadata; the public mutation is not hidden if cache refresh reports a warning.

## Rollback metadata

Applied assets store a `p110Application` object in `CreativeStudioAsset.sourceMetadata` with:

- `publicMutation: true`
- `targetField`
- `targetId`
- `previousValue`
- `appliedUrl`
- `appliedAt`
- `rollbackHint`
- `cacheRevalidation`

## Persian UI behavior

The dashboard shows apply controls only for eligible assets. Users must confirm the public mutation by typing `اعمال شود`. Disabled assets show the reason, including missing public URL, unsupported target type, or already-applied state. The dashboard keeps the P109 review information visible and does not expose generation forms.

## Validation commands

```powershell
pnpm run db:generate
pnpm run db:validate
pnpm run quality:creative-studio-planning
pnpm run quality:creative-studio-foundation
pnpm run quality:creative-studio-dashboard
pnpm run quality:creative-studio-apply-controls
pnpm run quality:ai-media
pnpm run quality:ai-media-paid-provider-controls
pnpm run quality:ai-media-cost-rollback
pnpm run quality:clean-source
pnpm run quality:local
pnpm run typecheck
pnpm run build
```

## Known limitations

- Product gallery `Image` rows are not created or linked in P110; only `Product.image` is updated.
- Campaign images, OG images, and import media remain future work.
- No deployed production mutation smoke is included without an explicit test fixture.

## Next phase

P111 - Creative Studio generation readiness gate and AI-service contract sync
