# Phase 93 - AI Media Cost Telemetry and Rollback Guardrails

Status: implemented.

P93 adds estimated cost telemetry and rollback controls before any paid AI media provider launch. Real paid generation remains disabled unless P92 approval and cost prerequisites are explicitly configured.

## Implemented

- Extended the server-only paid-provider policy with:
  - `AI_MEDIA_PAID_PROVIDER_ESTIMATED_JOB_COST_CENTS`
  - `AI_MEDIA_PAID_PROVIDER_ROLLBACK_PAUSED`
  - `AI_MEDIA_PAID_PROVIDER_ROLLBACK_REASON`
  - `AI_MEDIA_PAID_PROVIDER_ROLLBACK_BY`
  - `AI_MEDIA_PAID_PROVIDER_ROLLBACK_AT`
- Paid provider enablement is blocked when rollback pause is active.
- Runtime environment validation requires an estimated job cost and a rollback reason when rollback is paused.
- AI media job creation records `estimatedCostCents`, `costTelemetryMode`, `paidProviderEnabled`, and `rollbackPaused` in `AiMediaUsageEvent.metadata`.
- `/api/dashboard/ai-media/usage` exposes `costTelemetry` with daily/monthly estimated cost, configured guardrails, remaining budget, and rollback pause state.
- Job creation is blocked when rollback is paused or when daily/monthly cost guardrails are exhausted.
- The deployed AI media rollout gate verifies cost telemetry shape and default rollback state, then writes it into sanitized evidence.
- AI media rollout evidence archives include cost and rollback review checklist items.
- Added `quality:ai-media-cost-rollback` and wired the P93 validator into `quality:local`.

## Safety Notes

- Cost values are estimates for rollout control; they are not a payment ledger.
- With default environment variables, telemetry mode is `disabled`, estimated costs are zero, and paid generation remains off.
- Rollback pause is server-side and can disable paid-provider creation without code changes.
- Seller-facing paid-provider launch remains blocked until a later approved rollout.

## Validation

```powershell
pnpm run quality:ai-media-cost-rollback
pnpm run quality:ai-media-paid-provider-controls
pnpm run quality:ai-media-usage-controls
pnpm run quality:local
pnpm run typecheck
pnpm run build
```
