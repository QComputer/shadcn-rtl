# Phase 106 - PWA/Push/SMS source acceptance and secretless packaging gate

Status: implemented.

Date: 2026-06-30

## Goal

Prove that the P95-P105 PWA, Web Push, SMS, notification operations, deployed smoke, and production rollout work exists in source, validates locally, and can be packaged without local secrets after a reviewed docs ZIP accidentally included `.env`.

Creative Studio work must not start until this gate is green.

## What P95-P105 claimed

- P95: source cleanup and current-state verification.
- P96: open fields and workflow completion audit.
- P97: PWA foundation and install experience.
- P98: offline shell and safe caching.
- P99: notification preferences and domain model.
- P100: Web Push delivery.
- P101: SMS provider abstraction and sms.ir integration.
- P102: notification templates, routing, and delivery policies.
- P103: notification operations dashboard.
- P104: deployed PWA, Push, and SMS smoke gate.
- P105: production rollout runbook.

## Source proof

PWA and offline:

- `app/manifest.ts`
- `public/pwa-icon.svg`
- `public/pwa-maskable-icon.svg`
- `public/web-push-sw.js`
- `public/offline.html`
- `components/pwa-install-manager.tsx`

Notification domain, routing, and dashboard:

- `prisma/schema.prisma`
- `lib/services/notification-preferences.service.ts`
- `lib/notifications/templates.ts`
- `lib/notifications/delivery-policy.ts`
- `lib/notifications/router.ts`
- `lib/services/notification-operations.service.ts`
- `app/api/dashboard/notification-operations/route.ts`
- `app/[locale]/dashboard/notification-operations/page.tsx`

Web Push:

- `lib/services/web-push-foundation.service.ts`
- `app/api/customer/push-subscriptions/route.ts`
- `app/api/dashboard/customer-club/push/route.ts`
- `components/public/web-push-opt-in.tsx`
- `prisma/migrations/20260625000600_web_push_foundation/migration.sql`
- `prisma/migrations/20260629000500_web_push_delivery/migration.sql`

SMS:

- `lib/sms/sms.types.ts`
- `lib/sms/sms-provider.ts`
- `lib/sms/sms-dry-run-provider.ts`
- `lib/sms/sms-ir-provider.ts`
- `lib/sms/index.ts`
- `prisma/migrations/20260629000600_sms_provider_delivery/migration.sql`

Deployed smoke and rollout:

- `scripts/e2e/deployed-pwa-push-sms-smoke.mjs`
- `scripts/quality/validate-deployed-pwa-push-sms.mjs`
- `scripts/release/archive-pwa-push-sms-rollout-evidence.mjs`
- `docs/PHASE_105_PRODUCTION_ROLLOUT_RUNBOOK.md`

P106 packaging and acceptance:

- `scripts/quality/pwa-push-sms-acceptance.mjs`
- `scripts/release/create-clean-source.mjs`
- `scripts/quality/verify-clean-source.mjs`
- `scripts/release/pwa-push-sms-acceptance-evidence.mjs`
- `scripts/quality/validate-release-artifact.mjs`

## Security result

- `.env` tracked before P106: no.
- `.env` tracked after P106: no.
- The reviewed ZIP leak was a packaging/source-bundle issue, not a tracked-git `.env` issue.
- `test-results/.last-run.json` was tracked before P106 and was removed from git tracking.
- `.gitignore` now explicitly excludes `.env*` except `.env.example`, `node_modules/`, `.next/`, `.vercel/`, `dist/`, `coverage/`, `test-results/`, `.release/`, local DB files, ZIPs, and SQLite files.
- The local ignored `.env` contains operator secrets and must stay uncommitted.
- The previously pasted sms.ir key must be treated as compromised and rotated before any real production SMS use.

## Real-send guardrails

SMS real sending now requires all of:

- `SMS_PROVIDER=sms_ir`
- `SMS_DRY_RUN=false`
- `DEPLOYED_ALLOW_REAL_SMS=1`
- `DEPLOYED_SMS_TARGET_MOBILE` or `SMS_REAL_SEND_OPERATOR_CONFIRMED=1`
- `SMS_IR_USERNAME`
- `SMS_IR_API_KEY`
- `SMS_IR_LINE_NUMBER` or `SMS_IR_LINE`

Web Push real sending now requires:

- `WEB_PUSH_ENABLED=true`
- `WEB_PUSH_PROVIDER=web_push`
- `WEB_PUSH_DRY_RUN=false`
- `WEB_PUSH_REAL_SEND_ENABLED=true`
- configured VAPID public key, private key, and subject
- an authenticated active subscription

Automated smoke tests remain dry-run by default.

## Scripts that prove the gate

- `quality:pwa-push-sms-acceptance`
- `release:clean-source`
- `quality:clean-source`
- `release:pwa-push-sms-acceptance-evidence`
- `quality:pwa-foundation`
- `quality:pwa-offline-shell`
- `quality:notification-preferences`
- `quality:web-push-delivery`
- `quality:sms-provider`
- `quality:notification-routing`
- `quality:notification-operations`
- `quality:deployed-pwa-push-sms`
- `quality:production-rollout`

## Validation

Required local validation for P106:

```powershell
pnpm install --frozen-lockfile
pnpm run db:generate
pnpm run db:validate
pnpm run quality:pwa-foundation
pnpm run quality:pwa-offline-shell
pnpm run quality:notification-preferences
pnpm run quality:web-push-delivery
pnpm run quality:sms-provider
pnpm run quality:notification-routing
pnpm run quality:notification-operations
pnpm run quality:production-rollout
pnpm run quality:pwa-push-sms-acceptance
pnpm run release:clean-source
pnpm run quality:clean-source
pnpm run quality:local
pnpm run typecheck
pnpm run build
```

Deployed validation:

```powershell
$env:DEPLOYED_URL="https://www.bazar-baz.ir"
$env:DEPLOYED_ALLOW_REAL_SMS="0"
pnpm run e2e:deployed:pwa-push-sms
pnpm run quality:deployed-pwa-push-sms
```

## Known limitations

- Local ignored secret files can still exist on an operator machine; P106 proves they are untracked and excluded from clean source ZIPs.
- The deployed smoke is credential/data dependent and must not be reported as passed unless it actually runs against the deployment.
- Some old overlay docs were already deleted in the working tree during this handoff window; P106 does not restore unrelated historical docs.

## Recommended next phase

P107 - Creative Studio integration planning for main Bazar Baz.
