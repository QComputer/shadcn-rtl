# Phase 87 - AI Media Long-Running Job UX

P87 hardens the seller dashboard experience for AI image jobs that stay queued or processing longer than the short happy path.

## What changed

- Polling now uses bounded, cleanup-safe timeout scheduling instead of an overlapping interval.
- The product edit dialog shows last-known status, provider, creation time, and update time.
- Polling can continue from the last local job for the product.
- Slow or temporarily unreachable Render checks return the local `AiMediaJob` snapshot with `remoteUnavailable: true`.
- Sellers can continue polling, cancel an in-flight job, or start a fresh retry.
- AI job cancellation is exposed through an authenticated, organization-scoped dashboard route.
- Source validation is covered by `pnpm run quality:ai-media-long-running-ux`.

## Guardrails

- Bazar Baz still calls only the configured Render AI media service.
- Bazar Baz does not call, discover, or depend on local worker internals.
- The local `AiMediaJob` row is used only as last-known status and ownership evidence.
- Cancel is allowed only for queued or processing jobs.

## Validation

```powershell
pnpm run quality:ai-media-long-running-ux
pnpm run quality:ai-media
pnpm run quality:ai-media-health-gate
pnpm run quality:ai-media-mock-flow
pnpm run quality:ai-media-durable-storage
pnpm run typecheck
pnpm run build
pnpm run quality:local
```
