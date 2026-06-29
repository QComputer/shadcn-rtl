# Phase 99 - Notification Domain Model and Preferences

Date: 2026-06-29

## Summary

P99 adds the tenant-scoped notification preference layer that future Web Push, SMS, and template-routing phases can safely reuse.

Implemented:

- `NotificationChannel` and `NotificationPreference` Prisma schema support.
- Organization/customer/channel uniqueness and lookup indexes for preference reads.
- Authenticated customer preference API at `/api/customer/notification-preferences`.
- `notificationPreferencesService` for merged defaults, upserts, Web Push opt-in syncing, and marketing-recipient filtering.
- Web Push opt-in/unsubscribe synchronization with the `WEB_PUSH` preference.
- Persian-first public shop notification preference controls.
- Source validator coverage through `quality:notification-preferences`.

## Behavior

- `IN_APP` marketing preferences default to enabled.
- `WEB_PUSH` and `SMS` marketing preferences default to disabled until a customer explicitly opts in.
- Transactional messages default to enabled.
- Quiet hours are reserved as `HH:mm` fields for delivery-policy phases.
- Browser Web Push permission changes keep `NotificationPermissionEvent`, `PushSubscription`, and `NotificationPreference` state aligned.

## Validation

```powershell
pnpm run db:generate
pnpm run quality:notification-preferences
pnpm run quality:local
pnpm run typecheck
pnpm run build
```

## Deferred To P100+

- Real Web Push delivery using preferences as an enforcement policy.
- SMS provider abstraction and sms.ir integration.
- Cross-channel notification templates and routing rules.
- Admin/operator preference analytics and delivery monitoring.
