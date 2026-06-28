# Phase 80 - AI Media Suggestions Hardening

Status: implemented.

## Scope

P80 stabilizes the AI media suggestion work for product images. The feature remains server-mediated and MOCK/service-backed; browser code never receives the internal AI media service key.

## Implemented

- Added `AiMediaJob` tracking for remote product-image suggestion jobs.
- Added authenticated, product-scoped dashboard API routes for creating jobs, polling jobs, and selecting generated images.
- Added lazy server-only AI media service configuration and timeout handling.
- Synced remote job status/outputs back into local `AiMediaJob` rows during polling.
- Restricted image selection to completed jobs owned by the same organization/product.
- Updated selected product images through the service layer and revalidated public shop/product/home cache.
- Added a product edit dialog for Persian-first AI image suggestion selection.
- Added a safe new-product placeholder button so sellers discover the AI action after the product is saved.
- Added source-level and typecheck-backed `quality:ai-media`, `quality:ai-media-client`, and `quality:ai-media-mock` validation aliases plus deployed smoke coverage.

## Guardrails

- `AI_MEDIA_SERVICE_INTERNAL_KEY` is server-only and not exposed through status or browser routes.
- The public browser talks only to Bazar Baz API routes.
- Selecting an image requires `job_id`, `image_url`, and `output_index`; the URL must match a generated output saved for that job.
- The phase does not copy generated images to durable Blob storage. That remains a later media durability phase.

## Validation

```powershell
pnpm run quality:ai-media
pnpm run quality:ai-media-client
pnpm run quality:ai-media-mock
$env:DEPLOYED_URL="https://www.bazar-baz.ir"
$env:AI_MEDIA_SERVICE_URL="https://bazar-baz-ai-media-service.onrender.com"
pnpm run quality:ai-media-deployed-smoke
pnpm run quality:local
pnpm run typecheck
pnpm run build
```
