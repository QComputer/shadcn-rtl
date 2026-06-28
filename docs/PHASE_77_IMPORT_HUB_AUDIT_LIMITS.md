# Phase 77 - Import Hub Audit, Limits, and Plan Readiness

P77 adds production guardrails around Import Hub operations while keeping imports draft-first and organization-scoped.

Implemented:

- Added `lib/import-hub/limits.ts` with active job, daily job, per-job draft, audit-event, and plan-readiness defaults.
- Enforced per-organization create limits before import job creation.
- Stored limit snapshots and plan-readiness metadata on import sources and audit records.
- Hardened cancellation so only queued, review-needed, or failed jobs can be canceled.
- Added retry support for failed/canceled jobs that already have drafts.
- Added `GET /api/dashboard/imports/jobs/[jobId]/events` for recent import audit events.
- Added `POST /api/dashboard/imports/jobs/[jobId]/retry`.
- Added dashboard retry controls and recent import event display.
- Added `quality:import-hub-audit-limits` and registered it in `quality:local`.

Safety notes:

- P77 does not add live publishing or background external fetching.
- Retry returns existing failed/canceled drafts to seller review; it does not re-run external providers.
- Plan readiness is metadata-only in this phase and uses admin-default limits.

Validation:

```powershell
pnpm run quality:import-hub-audit-limits
pnpm prisma generate
pnpm run typecheck
pnpm run build
```
