# P43 — In-App Notification Inbox

Date: 2026-06-25

## Scope

P43 adds a dry-run-safe in-app notification inbox and Customer Club broadcast foundation.

This phase does not send SMS, email, Telegram, Web Push, or any external notification. It only creates and updates rows in the local `Notification` table.

## Runtime Changes

- Extended `Notification` with optional:
  - `organizationId`
  - `createdByUserId`
- Added indexes for organization notification timeline and notification actor lookups.
- Kept the existing dashboard notification poller API compatible:
  - default `GET /api/dashboard/notifications` still returns unread notifications.
  - `GET /api/dashboard/notifications?scope=all&limit=100` returns inbox history.
  - `PATCH /api/dashboard/notifications` can mark notifications read or unread.
- Added in-app Customer Club broadcast:
  - `POST /api/dashboard/notifications`
  - active customer-club members are selected by organization.
  - `dryRun: true` previews recipient count without creating rows.
  - sends are audit logged.
- Added customer recipient API:
  - `GET /api/customer/notifications`
  - `PATCH /api/customer/notifications`
- Added dashboard page:
  - `/{locale}/dashboard/notifications`

## Access Model

- A signed-in user can read and update only their own notifications.
- Organization `ADMIN`/`MANAGER`, plus `SUPER_ADMIN` through existing guards, can create in-app notifications for active Customer Club members in the current organization.
- Notification creation is organization-scoped.
- The dashboard route is visible to dashboard users because it is a personal inbox; the send form is UI-gated and API-gated for management roles.

## UI

The dashboard inbox includes:

- localized FA/EN/AR copy;
- loading, error, and empty states;
- unread count;
- read/unread controls;
- management-only compose panel;
- dry-run recipient preview;
- explicit in-app-only notice.

## Deferred

- Dedicated `NotificationRecipient` / `NotificationReadState` tables.
- Scheduling.
- Segments beyond active Customer Club members.
- Web Push permission prompts or subscriptions.
- SMS/email/Telegram delivery providers.
- Rich templates and campaign analytics.

## Validation

Focused validator:

```powershell
pnpm run quality:in-app-notifications
```

Recommended P43 gate:

```powershell
pnpm run db:validate
pnpm run db:generate
pnpm run quality:in-app-notifications
pnpm run quality:customer-club-foundation
pnpm run quality:dashboard-route-authorization
pnpm run quality:dashboard-route-parity
pnpm run quality:dashboard-role-navigation
pnpm run quality:local
pnpm run typecheck
pnpm run build
pnpm run release:stage
pnpm run quality:release-staged
```
