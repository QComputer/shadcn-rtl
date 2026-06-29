# Phase 85 - AI Media MOCK Flow Acceptance

Status: implemented.

P85 validates and hardens the existing product image suggestion flow while the external AI media service remains in MOCK provider mode.

## Implemented

- Dashboard product edit status checks now wait for dashboard access before calling the authenticated AI media status route.
- New-product AI guidance also waits for dashboard access and stays disabled until the product exists.
- Product edit job creation is locally feature-gated when AI media is not ready.
- Job polling accepts both `outputs` and `output_images` from the Render MOCK service contract.
- Completed jobs with no returned images now show a retryable seller-facing error.
- Image selection requires the current AI job ID before calling the select route.
- Selected product image state now uses the API-returned URL, so durable Blob URLs replace temporary Render URLs when storage is configured.
- Retry UI is visible for non-terminal start/poll errors, not only failed jobs.
- Deployed AI media smoke now expects unauthenticated dashboard status access to be blocked.
- Added `quality:ai-media-mock-flow` and wired it into `quality:local`.

## Guardrails

- Real paid generation remains disabled.
- The browser still talks only to Bazar Baz dashboard routes.
- Bazar Baz still calls only the deployed Render AI media service.
- The selected image must match a completed generated output for the product/job.

## Validation

```powershell
pnpm run quality:ai-media-mock-flow
pnpm run quality:ai-media
pnpm run quality:ai-media-health-gate
pnpm run quality:local
pnpm run typecheck
pnpm run build
```
