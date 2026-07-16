# Bazar Baz AI Media Integration Gates

## Purpose

This document defines mandatory gates before `shadcn-rtl` can enable AI media write flows, Baz wallet settlement, worker earnings, or any production AI media integration.

## Gate Philosophy

Move fast on:
- source-only docs
- type-safe parsers
- server-only mapping
- unit tests
- Preview-only MOCK tests
- read-only health checks

Stop hard on:
- Production DB writes
- Production Blob/storage writes
- Render write flows
- real AI jobs
- real generation
- secrets
- payment/wallet settlement
- worker reward settlement
- privacy-sensitive routing

## Gate 1 — Server-Only Render Boundary

Requirement:
- Browser never calls Render directly.
- Render credentials are server-only.
- No `NEXT_PUBLIC_*` Render secrets.
- AI media status calls go through Bazar Baz server code.

Validation:
- grep for Render URL/secrets in client bundles and public env
- tests for server-only client
- no browser-exposed tokens

## Gate 2 — Status Contract Compatibility

`shadcn-rtl` must parse:
- old Render status payloads
- new canonical PRE-P07 payloads
- missing fields
- unknown statuses
- malformed payloads

Must support:
- `canonical_status`
- `queue_rank`
- `jobs_ahead`
- `eta_confidence`
- worker availability
- no eligible worker
- GPU offline
- workers busy
- model missing

Unknown status must fail closed.

## Gate 3 — Persian-First Safe Messages

User-facing UI must explain:
- GPU offline is waiting, not failure
- workers busy is waiting, not failure
- no eligible worker is waiting/not available, not data loss
- model missing means required runtime not installed yet
- failed jobs show safe non-technical reason

No raw internal status names for normal users.

## Gate 4 — Preview Isolation

Before write flow:
- Preview DB must be separate from Production DB.
- Preview storage must be separate from Production storage.
- Preview AI identity must be separate from Production AI identity.
- Preview Render writes must not affect Production.
- Preview Blob writes must not affect Production.

No Production mutation during Preview E2E.

## Gate 5 — Bazar Baz AI Job Mirror

Before submitting jobs:
- create Bazar Baz-side request records
- mirror Render job ID safely
- store org/user ownership
- store status events
- connect to Baz holds/spend later

Do not rely on Render as the sole app-facing state.

## Gate 6 — App-Managed Storage Import

Before exposing generated media:
- Bazar Baz imports and validates result
- asset stored in app-managed storage
- permissions enforced
- audit event written
- failed import does not expose raw worker files

Worker operators must not see generated files unless policy allows and they are the owner.

## Gate 7 — Baz Wallet Ledger

Before spending/earning Baz:
- ledger tables exist
- immutable entries
- idempotency
- pending vs settled balances
- holds
- refunds
- adjustments
- fraud holds
- admin audit

No mutable-only balance counters.

## Gate 8 — Baz Quote/Hold/Refund

Before paid AI job:
- quote shown
- user confirms
- hold created
- job submitted
- hold settled only after acceptance
- hold refunded on failure/expiry/cancel

## Gate 9 — Worker Ownership

Before showing worker portal:
- worker linked to Bazar Baz user/org
- worker token can be generated/revoked
- user sees only own workers
- safe machine summary only
- no cross-user job/image exposure

## Gate 10 — Worker Contribution Facts

Before reward settlement:
- contribution facts imported from AI service
- worker ID verified
- job ID verified
- result accepted/imported
- duration/status/retries recorded
- fraud/quality flags supported

## Gate 11 — Reward Settlement

Before settled Baz reward:
- pending reward created
- fraud/quality window applied
- settlement policy versioned
- reversal/clawback supported
- admin review supported

Do not settle at claim time.

## Gate 12 — Privacy-Aware Routing

Before sending real jobs to user-run workers:
- job privacy level defined
- worker trust level defined
- routing policy enforced
- sensitive/personal jobs protected
- Super Admin audit available

## Gate 13 — Super Admin Network Console

Before broad rollout:
- SUPER_ADMIN can inspect all jobs
- SUPER_ADMIN can inspect all generated/imported files
- SUPER_ADMIN can inspect all workers
- SUPER_ADMIN can inspect Baz ledger
- normal users cannot

## Gate 14 — Render Contract Pinning

Before Preview write E2E:
- deployed Render contract fingerprint pinned
- `/health` verified
- `/ready` verified
- diagnostics verified
- no real generation
- no prod writes

## Gate 15 — Preview E2E

Preview-only E2E:
- create request
- quote Baz
- hold Baz
- submit MOCK job
- complete MOCK job
- import Preview asset
- settle/refund
- verify no Production mutation

## Gate 16 — Production Readiness

Before production:
- all previous gates green
- production env verified
- production storage verified
- Render production contract pinned
- rollback plan
- audit logs
- Super Admin monitoring
- no real generation unless explicitly authorized

## Validation Commands

Typical `shadcn-rtl` gate commands:

```powershell
pnpm install --frozen-lockfile
pnpm prisma generate
pnpm prisma validate
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm run quality:source-baseline
git diff --check
git status --short
```

If build exits 0 with non-fatal DB connectivity warnings, report exactly:

```text
build: passed with non-fatal DB connectivity warnings.
```

## Current Rule

No Control Center UI before backend gates.

No wallet settlement before ledger gates.

No real generation before explicit authorization.

No normal-user access to other users' AI media data.
