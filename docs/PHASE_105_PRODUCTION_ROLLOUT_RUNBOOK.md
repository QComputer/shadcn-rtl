# Phase 105 - Production rollout runbook

Status: implemented.

Date: 2026-06-29

## Goal

Make the PWA, Web Push, SMS, and notification operations rollout explicit, reversible, monitored, and evidence-backed before any real-send provider is enabled in production.

## Implemented

- Added this production rollout runbook for PWA, Web Push, SMS, notification operations, monitoring, rollback, evidence retention, and operator sign-off.
- Added `scripts/release/archive-pwa-push-sms-rollout-evidence.mjs` to archive deployed smoke evidence under `.release/pwa-push-sms-rollout-evidence/<timestamp>`.
- Added `quality:production-rollout` and wired the P105 validator into `quality:local`.
- Updated release notes with PWA/Push/SMS rollout evidence and ownership fields.
- Marked the integrated P68-P105 roadmap complete.

## Required preflight

Run the production smoke against the deployed custom domain before changing any real-send flags:

```powershell
$env:DEPLOYED_URL="https://www.bazar-baz.ir"
$env:DEPLOYED_USERNAME="Amir"
$env:DEPLOYED_PASSWORD="<operator password>"
pnpm run e2e:deployed:pwa-push-sms
```

The preflight must show:

- Persian-first no-locale visit redirects to `/fa`.
- Manifest, service worker, and offline shell are reachable.
- Notification operations and customer push APIs are authenticated.
- Provider readiness is secret-safe.
- Real Web Push and real SMS sends are disabled unless the release is already in an approved canary stage.

## Provider enablement stages

### Stage 0 - Safe default

Keep this state for normal deployments, QA, and smoke tests:

```txt
PWA_ENABLED=true
WEB_PUSH_PROVIDER=dry_run
WEB_PUSH_DRY_RUN=true
WEB_PUSH_REAL_SEND_ENABLED=false
SMS_PROVIDER=DRY_RUN
SMS_DRY_RUN=true
```

### Stage 1 - Configure secrets without real sends

Configure provider secrets in production secret storage, deploy, and keep dry-run mode enabled:

```txt
NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY=<configured>
WEB_PUSH_VAPID_PRIVATE_KEY=<configured>
WEB_PUSH_VAPID_SUBJECT=mailto:<production operator email>
WEB_PUSH_PROVIDER=web_push
WEB_PUSH_DRY_RUN=true
WEB_PUSH_REAL_SEND_ENABLED=false
SMS_PROVIDER=sms_ir
SMS_DRY_RUN=true
SMS_IR_API_KEY=<configured>
SMS_IR_LINE_NUMBER=<configured>
```

Then verify `/fa/dashboard/notification-operations` shows provider readiness without exposing secret values.

### Stage 2 - Approved canary

Only after operator sign-off:

```txt
WEB_PUSH_PROVIDER=web_push
WEB_PUSH_DRY_RUN=false
WEB_PUSH_REAL_SEND_ENABLED=true
SMS_PROVIDER=sms_ir
SMS_DRY_RUN=false
```

Run the deployed smoke with the dry-run requirement relaxed only for this approved canary:

```powershell
$env:DEPLOYED_PWA_PUSH_SMS_REQUIRE_DRY_RUN="0"
pnpm run e2e:deployed:pwa-push-sms
```

Use a small internal audience first. Do not run broad marketing broadcasts until the canary has a clean monitoring window.

## Monitoring checklist

During rollout, review:

- `/fa/dashboard/notification-operations` provider readiness, delivery counts, and recent delivery rows.
- Web Push failed/skipped counts after every canary send.
- SMS failed/skipped counts after every canary send.
- Vercel runtime logs for notification route, provider, and database errors.
- Customer preference state for `IN_APP`, `WEB_PUSH`, and `SMS`.
- Persian-first public PWA behavior: `/`, `/fa`, `/manifest.webmanifest`, `/web-push-sw.js`, and `/offline.html`.

## Rollback

Rollback must be a config-only change first:

```txt
WEB_PUSH_REAL_SEND_ENABLED=false
WEB_PUSH_DRY_RUN=true
WEB_PUSH_PROVIDER=dry_run
SMS_DRY_RUN=true
SMS_PROVIDER=DRY_RUN
```

After redeploy:

```powershell
$env:DEPLOYED_PWA_PUSH_SMS_REQUIRE_DRY_RUN="1"
pnpm run e2e:deployed:pwa-push-sms
```

Record the rollback reason, rollback owner, rollback time, failed provider/channel, and whether queued delivery records need follow-up review.

## Evidence retention

Archive deployed evidence after preflight, canary, and rollback:

```powershell
pnpm run e2e:deployed:pwa-push-sms
pnpm run release:pwa-push-sms-rollout-evidence
```

Optional paths:

```powershell
$env:PWA_PUSH_SMS_ROLLOUT_EVIDENCE_FILE="test-results/deployed-pwa-push-sms/evidence.json"
$env:PWA_PUSH_SMS_ROLLOUT_EVIDENCE_OUT=".release/pwa-push-sms-rollout-evidence/manual-review"
pnpm run release:pwa-push-sms-rollout-evidence
```

Do not commit `.release/pwa-push-sms-rollout-evidence`. Keep the archive with external release records.

## Operator sign-off

Before enabling real sends, release notes must include:

- release owner,
- monitoring owner,
- rollback owner,
- approved audience,
- approved channels,
- current provider env stage,
- evidence archive path,
- rollback command set,
- Persian-first PWA smoke result,
- notification operations dashboard review result.

## Validation

```powershell
pnpm run quality:production-rollout
pnpm run quality:deployed-pwa-push-sms
pnpm run quality:notification-operations
pnpm run quality:notification-routing
pnpm run quality:local
pnpm run typecheck
pnpm run build
```
