# Phase 88 - AI Media Usage Logs, Quotas, and Audit Controls

P88 adds tenant-scoped usage accounting before any paid AI image generation rollout.

## What changed

- Added `AiMediaUsageEvent` with a database migration for job and selection audit events.
- Added server-side daily quota defaults:
  - `AI_MEDIA_DAILY_JOB_LIMIT` defaults to `25`.
  - `AI_MEDIA_DAILY_SELECTION_LIMIT` defaults to `50`.
- Product image suggestion creation now checks the organization daily job quota before calling Render.
- The AI media service records usage events for job creation, terminal job states, selected images, and cancellations.
- Terminal job events are deduped by job/action to avoid over-counting repeated polling.
- Added authenticated `GET /api/dashboard/ai-media/usage` for organization-scoped usage summary and recent audit events.
- The usage summary explicitly reports `paidGenerationEnabled: false` until a later rollout phase enables paid providers.
- Source validation is covered by `pnpm run quality:ai-media-usage-controls`.

## Guardrails

- Bazar Baz still calls only the configured Render AI media service.
- Real paid generation remains disabled.
- Quota state is server-side only and is not trusted from the browser.
- SUPER_ADMIN may inspect an organization with `?organizationId=...`; normal dashboard users are scoped to their active organization.

## Validation

```powershell
pnpm run quality:ai-media-usage-controls
pnpm run quality:ai-media-long-running-ux
pnpm run quality:ai-media
pnpm run typecheck
pnpm run build
pnpm run quality:local
```
