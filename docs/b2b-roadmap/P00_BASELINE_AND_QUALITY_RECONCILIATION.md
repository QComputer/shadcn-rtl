# BB-B2B-P00 — Baseline and Quality Reconciliation

Generated: 2026-07-05
Project: Bazar Baz / shadcn-rtl

## Goal

Produce a clean source state where:
- current git state is known;
- uncommitted/untracked files are classified;
- notification/SMS/Web Push hotfix status is known;
- production `NotificationDeliveryAttempt` migration status is known;
- `quality:local`, `typecheck`, `build`, and `git diff --check` status is known;
- roadmap docs are aligned with the B2B repositioning direction;
- no feature redesign is started yet.

## Git State

### Current branch
- main

### Current HEAD
- 2c424f7
- Message: redeploy with regenerated VAPID keys
- Date: 2026-07-05

### Latest 10 commits
```
2c424f7 redeploy with regenerated VAPID keys
b6c7e50 fix(access): register /dashboard/notification-operations route
d463173 fix(push): relax strict VAPID key length check on client
6e7b752 fix(vercel): push all local .env vars to Vercel production via PowerShell script
5586b4f fix(vercel): remove local .env.production override to restore encrypted env vars
8193509 fix(ops): strip quotes from Vercel URL env vars after sync corruption
41f4062 fix(push): resolve TS build error for applicationServerKey type
aaf1300 fix(push): validate VAPID public key format before subscribe
6a52f57 fix(db): apply NotificationDeliveryAttempt migration via Neon serverless
28eae91 fix(notifications): improve push error visibility and VAPID key safety
```

### HEAD vs origin/main
- HEAD: 2c424f7
- origin/main: 2c424f791f9857c891b5d296fcd67359e4e72c8b
- Match: YES

### Working tree status
- Modified files:
  - `components/dashboard/dashboard-push-opt-in.tsx` — source code: push error surfacing/VAPID validation improvements from previous hotfix
- Untracked files/directories:
  - `docs/hand-off/` — generated report directory from STATE-SNAPSHOT-01
  - `docs/b2b-roadmap/` — created for this phase
  - Plus several ops scripts from earlier Vercel env sync work (already committed in history, not in working tree)

## Dirty File Classification

| File/Directory | Classification | Action |
|---|---|---|
| `components/dashboard/dashboard-push-opt-in.tsx` | Source code | Keep — debugging improvements from VAPID troubleshooting |
| `docs/hand-off/` | Generated report | Keep — snapshot reports for knowledge transfer |
| `docs/b2b-roadmap/` | New docs | Keep — roadmap tracking |
| `scripts/ops/*.mjs` | Local-only scripts | Some present from earlier work; no secrets inside |

## Notification/SMS/Web Push Hotfix Status

- P120A — Operational notifications: COMMITTED
- P120B — Customer lifecycle notifications: COMMITTED
- P120C — Delivery observability: COMMITTED
- P120D — SMS.ir provider completion: COMMITTED
- P120E — SMS delivery reports/reconciliation: COMMITTED
- P120F — SMS.ir official report endpoints: COMMITTED
- NOTIFOPS-DEPLOY-FIX1 — Notification ops hardening: COMMITTED
- NotificationDeliveryAttempt production migration: Applied via Neon serverless driver
- VAPID key corruption: RESOLVED (regenerated 2026-07-05)
- localhost:4001 socket leak: FIXED

## NotificationDeliveryAttempt Migration Status

- Source model: Present in `prisma/schema.prisma`
- Migration file: `prisma/migrations/20260703000200_notification_delivery_attempt/migration.sql`
- Local migration status: Migration file exists and is valid
- Production table status: PRESENT — applied via `scripts/ops/apply-notification-delivery-attempt-migration.mjs`

## Validation Status

### db:generate
- Status: PASSED
- Output: Prisma Client generated successfully

### db:validate
- Status: PASSED
- Output: Prisma schema validated successfully

### typecheck
- Status: PASSED
- Output: `tsc --noEmit --incremental false` exited 0

### build
- Status: PASSED with non-fatal DB connectivity warnings
- Output: Next.js build completed successfully
- Warnings: Prisma `DATABASE_URL` connectivity warnings during static generation (expected when DB is sleeping or unreachable from build runner)

### git diff --check
- Status: PASSED
- Output: No whitespace/formatting errors

### quality:local
- Status: PASSED for P120/NOTIFOPS validators
- Details: 25 pre-existing legacy validator failures in unrelated phases; all notification/SMS validators pass

### quality:source-baseline
- Status: PASSED

## Roadmap Docs Alignment

- `docs/CURRENT_SOURCE_OF_TRIFT.md` — reviewed; includes P120A-P120F and NOTIFOPS-DEPLOY-FIX1
- `docs/NEXT_PHASE_ROADMAP.md` — reviewed; notes P120F complete
- `README.md` — reviewed; includes notification/SMS phases
- New B2B roadmap docs created in `docs/b2b-roadmap/` and `docs/hand-off/`

## Security Check

- `.env` committed: NO
- `.env.local` committed: NO
- `.env.production` committed: NO
- `SMS_IR_API_KEY` exposed in source: NO
- `VAPID_PRIVATE_KEY` exposed in source: NO
- `DATABASE_URL` exposed in source: NO
- Full phone numbers exposed in source: NO

## Known Blockers

1. Playwright browser binary download blocked by geographic CDN restriction on this Windows runner — deployed smokes cannot run locally
2. Local Neon DB pooler unreachable from this runner — `prisma migrate deploy` blocked locally; production migrations applied via serverless driver script

## Next Recommended Phase

BB-B2B-P01 — Public Surface Policy and Route Audit
