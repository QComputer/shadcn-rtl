# STATE-SNAPSHOT-01: Git State Inspection

Generated: 2026-07-05
Project: Bazar Baz / shadcn-rtl

## Current Branch
- main

## Current HEAD
- 2c424f7
- Message: redeploy with regenerated VAPID keys
- Date: 2026-07-05

## Latest 30 Commits (abbreviated)
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
6bfb152 fix(notifications): improve push error visibility and VAPID key safety
7cd545d fix(notifications): harden deployed operations diagnostics
fcbdf5b feat(sms): reconcile deliveries with sms-ir reports
2d9cb92 feat(sms): add delivery reports and reconciliation foundation
0787211 fix(quality): finalize P120D SMS baseline acceptance
545a10c feat(sms): complete sms-ir provider integration
9975cdd docs: mark P120C complete in source of truth
3585c7e feat(notifications): add delivery observability and retry policy
37af319 feat(notifications): add customer order lifecycle routing
fd623ba feat(creative-studio): apply reviewed brand assets with rollback
1a10bdc fix(quality): repair CURRENT_SOURCE_OF_TRUTH P119 baseline reference for Windows runner compatibility
7795721 docs: mark P120A complete in source of truth
e63a960 fix(quality): update roadmap to P120A and fix validator references
1680e27 feat(orders): add operational notifications and admin controls
e4664f8 feat(creative-studio): ingest provider results for review
000e25e feat(creative-studio): execute organization brand provider behind gate
43f7d52 feat(creative-studio): add organization brand provider rollout gate
04a7583 feat(creative-studio): add organization brand acceptance gate
fea47e4 feat(creative-studio): add organization brand request controls
3badb26 feat(creative-studio): add organization brand readiness
```

## Working Tree Status
- Uncommitted changes: YES
  - M components/dashboard/dashboard-push-opt-in.tsx
- Untracked files: YES
  - ?? scripts/ops/apply-notification-delivery-attempt-migration.mjs
  - ?? scripts/ops/fix-vercel-env-targeted.mjs
  - ?? scripts/ops/fix-vercel-quoted-env.mjs
  - ?? scripts/ops/push-vercel-env.mjs
  - ?? scripts/ops/push-vercel-env.ps1
  - ?? scripts/ops/sync-vercel-env.mjs
  - ?? scripts/ops/validate-vapid-keys.mjs

## HEAD vs origin/main
- HEAD: 2c424f7
- origin/main: 2c424f791f9857c891b5d296fcd67359e4e72c8b
- Match: YES

## Phase Commit Status
- P120A (operational notifications): COMMITTED
- P120B (customer lifecycle notifications): COMMITTED
- P120C (delivery observability): COMMITTED
- P120D (SMS.ir provider completion): COMMITTED
- P120E (SMS delivery reports/reconciliation): COMMITTED
- P120F (SMS.ir official report endpoints): COMMITTED
- NOTIFOPS-DEPLOY-FIX1 (notification ops hardening): COMMITTED
- NotificationDeliveryAttempt migration: COMMITTED

## Notes
- Working tree contains uncommitted changes from the latest VAPID fix iteration.
- Several ops scripts were added during the Vercel env sync/debugging process.
- No P120F or notification deploy fixes appear to be missing from the committed history.
