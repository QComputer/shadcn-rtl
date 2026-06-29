# Phase 90 - Deployed AI Media Rollout Gate

Status: implemented.

P90 codifies an operator-safe deployed rollout gate for the Bazar Baz AI media integration. The gate validates the production-facing dashboard APIs while keeping real paid generation disabled unless a later phase explicitly enables it.

## Implemented

- Expanded `scripts/e2e/deployed-ai-media-smoke.mjs` into a deployed rollout gate for `https://bazar-baz.ir` or any `DEPLOYED_URL`.
- Added credential-session login using the same default deployed admin test credentials used by other smoke suites, with `DEPLOYED_USERNAME` / `DEPLOYED_PASSWORD` overrides.
- Verified unauthenticated protection for AI media status, usage, create, poll, cancel, and image-selection routes.
- Verified authenticated Bazar Baz AI media readiness shape through `/api/dashboard/ai-media/status?check=1` without exposing service secrets.
- Verified authenticated usage summary and quota shape through `/api/dashboard/ai-media/usage`, including `paidGenerationEnabled: false`.
- Kept direct Render AI media service health and MOCK job checks optional through `AI_MEDIA_SERVICE_URL` and `AI_MEDIA_SERVICE_INTERNAL_KEY`.
- Added an optional product-selection probe with `DEPLOYED_AI_MEDIA_SELECTION_PRODUCT_ID`; set `DEPLOYED_AI_MEDIA_REQUIRE_BLOB_SELECTION=1` when Blob storage must be enforced for that probe.
- Added `quality:deployed-ai-media-rollout` and wired the P90 validator into `quality:local`.

## Operator Commands

Readiness and usage gate against Bazar Baz:

```powershell
$env:DEPLOYED_URL="https://bazar-baz.ir"
$env:DEPLOYED_USERNAME="Amir"
$env:DEPLOYED_PASSWORD="<password>"
pnpm run e2e:deployed:ai-media
```

Optional direct Render MOCK verification:

```powershell
$env:AI_MEDIA_SERVICE_URL="https://your-render-ai-service.example"
$env:AI_MEDIA_SERVICE_INTERNAL_KEY="<secret>"
pnpm run e2e:deployed:ai-media
```

Optional durable selection probe:

```powershell
$env:DEPLOYED_AI_MEDIA_SELECTION_PRODUCT_ID="<safe-product-id>"
$env:DEPLOYED_AI_MEDIA_REQUIRE_BLOB_SELECTION="1"
pnpm run e2e:deployed:ai-media
```

## Safety Notes

- The default deployed gate does not create products, approve imports, or select images.
- Direct Render checks are skipped unless service URL/key values are explicitly provided.
- The product-selection probe mutates the configured product image and should only be used on an operator-approved product.
- The status route is checked for secret-safe shape; rollout evidence should record booleans and counts, not secret values.

## Validation

```powershell
pnpm run quality:deployed-ai-media-rollout
pnpm run e2e:deployed:ai-media
pnpm run quality:ai-media
pnpm run quality:local
pnpm run typecheck
pnpm run build
```
