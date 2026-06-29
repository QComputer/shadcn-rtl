# Phase 100 - Web Push Notification Service

Date: 2026-06-29

## Summary

P100 turns the Web Push foundation into a preference-aware delivery service while keeping real external sends behind explicit environment gates.

Implemented:

- `WebPushDeliveryStatus` and `WebPushDelivery` Prisma schema support.
- Idempotent migration for Web Push delivery attempt rows.
- Preference-aware Web Push recipient planning using `NotificationPreference` channel `WEB_PUSH`.
- Dry-run results that report active subscriptions, eligible recipients, and preference-skipped customers.
- Real send attempt logging with per-subscription `PENDING`, `SENT`, and `FAILED` states.
- Invalid subscription cleanup for provider `404` and `410` responses.
- Dashboard delivery history and preference-policy counts.
- P100 quality gate through `quality:web-push-delivery`.

## Delivery Policy

- Customers must have an active browser subscription.
- Customers must be active and not soft-deleted.
- Customers must be eligible through the Web Push marketing preference policy.
- Real delivery requires `WEB_PUSH_PROVIDER=web_push`, `WEB_PUSH_DRY_RUN=false`, and `WEB_PUSH_REAL_SEND_ENABLED=true`.
- VAPID public key, private key, and subject remain required before real sends.

## Validation

```powershell
pnpm run db:generate
pnpm run quality:web-push-delivery
pnpm run quality:notification-preferences
pnpm run quality:web-push-foundation
pnpm run quality:local
pnpm run typecheck
pnpm run build
```

## Deferred To P101+

- SMS provider abstraction and sms.ir integration.
- Cross-channel template routing.
- Campaign-builder channel expansion beyond in-app.
- Deployed PWA/Push/SMS smoke coverage.
