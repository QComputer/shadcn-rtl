# Phase 104 - Deployed PWA, Push, and SMS smoke gates

Date: 2026-06-29

## Goal

Add a deployment-facing smoke gate for the Persian-first PWA shell and the notification delivery readiness surfaces introduced in P99-P103.

## Implemented

- Added `scripts/e2e/deployed-pwa-push-sms-smoke.mjs`.
- Added package scripts:
  - `e2e:deployed:pwa-push-sms`
  - `smoke:deployed:pwa-push-sms`
  - `quality:deployed-pwa-push-sms`
- The deployed smoke checks:
  - Canonical deployment redirect resolution.
  - First-time no-locale visit redirects to `/fa`.
  - Manifest is installable, RTL, and Persian-first.
  - Service worker exposes offline caching plus push and notification-click handlers.
  - Offline shell is reachable and Persian RTL.
  - Unauthenticated dashboard notification/push APIs are blocked.
  - Authenticated organization membership resolves.
  - Notification operations API returns secret-safe provider readiness and status counts.
  - Dashboard/customer Web Push health endpoints are readable.
  - Customer notification preferences include `IN_APP`, `WEB_PUSH`, and `SMS`.
  - Real Web Push/SMS sending is disabled by default during smoke unless explicitly overridden.
- Mutating Web Push dry-run sends are optional and require `DEPLOYED_PWA_PUSH_SMS_ENABLE_DRY_RUN_SEND=1`.
- Smoke evidence is written under `test-results/deployed-pwa-push-sms/evidence.json` with password redaction.

## Runbook

```powershell
$env:DEPLOYED_URL="https://www.bazar-baz.ir"
$env:DEPLOYED_USERNAME="Amir"
$env:DEPLOYED_PASSWORD="123456"
pnpm run e2e:deployed:pwa-push-sms
```

Optional mutating dry-run probe:

```powershell
$env:DEPLOYED_PWA_PUSH_SMS_ENABLE_DRY_RUN_SEND="1"
pnpm run e2e:deployed:pwa-push-sms
```

## Safety notes

- The default smoke does not send real SMS or real Web Push messages.
- Provider secrets are checked for accidental exposure and are not written to evidence.
- The smoke fails by default if the deployed provider config reports real sends enabled.
- The optional dry-run send probe may create dry-run Web Push delivery records and should only be used intentionally.

## Validation

```powershell
pnpm run quality:deployed-pwa-push-sms
pnpm run quality:notification-operations
pnpm run quality:notification-routing
pnpm run quality:pwa-offline-shell
pnpm run quality:pwa-foundation
pnpm run quality:local
pnpm run typecheck
pnpm lint
pnpm run build
```

## Recommended next phase

P105 - Production rollout runbook.
