# Phase 92 - AI Media Paid Provider Controls

Status: implemented.

P92 adds explicit paid-provider enablement controls while keeping real paid image generation disabled by default.

## Implemented

- Added server-only `getAiMediaPaidProviderStatus()` in `lib/services/ai-media-paid-provider.ts`.
- Paid provider enablement now requires all of:
  - `AI_MEDIA_PAID_PROVIDER_ENABLED=true`
  - `AI_MEDIA_PAID_PROVIDER_APPROVED=true`
  - `AI_MEDIA_PAID_PROVIDER_APPROVED_BY`
  - valid `AI_MEDIA_PAID_PROVIDER_APPROVED_AT`
  - positive `AI_MEDIA_PAID_PROVIDER_DAILY_COST_LIMIT_CENTS`
  - positive `AI_MEDIA_PAID_PROVIDER_MONTHLY_BUDGET_CENTS`
- Runtime environment validation fails when paid provider enablement is requested without approval metadata and cost guardrails.
- `/api/dashboard/ai-media/status` exposes a secret-safe `paidProvider` policy summary.
- `/api/dashboard/ai-media/usage` includes `paidProvider` and derives `paidGenerationEnabled` from the policy.
- The deployed AI media rollout gate asserts that paid provider status remains disabled by default.
- Added `quality:ai-media-paid-provider-controls` and wired it into `quality:local`.

## Safety Notes

- P92 does not switch any provider or call any paid generation API.
- The browser still calls only Bazar Baz dashboard routes.
- Cost guardrails are configuration prerequisites, not billing enforcement by themselves.
- P91 evidence archives remain required for rollout decisions.

## Validation

```powershell
pnpm run quality:ai-media-paid-provider-controls
pnpm run quality:ai-media-usage-controls
pnpm run quality:deployed-ai-media-rollout
pnpm run e2e:deployed:ai-media
pnpm run quality:local
pnpm run typecheck
pnpm run build
```
