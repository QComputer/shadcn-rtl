# P47 - Web Push Opt-In Foundation

Date: 2026-06-26

## Summary

P47 adds the consent and storage foundation for browser Web Push without enabling real external delivery by default:

- organization/customer-scoped push subscription storage;
- append-only notification permission event history;
- customer-facing opt-in UI on the public shop profile;
- customer unsubscribe flow;
- management dashboard for subscription health and permission events;
- dry-run-only push delivery preview;
- VAPID and Web Push feature-flag environment validation;
- focused source validator `quality:web-push-foundation`.

## Data model

Added Prisma enum:

- `PushPermissionState`

Added Prisma models:

- `PushSubscription`
- `NotificationPermissionEvent`

`PushSubscription` rows are scoped by `organizationId`, `customerId`, and browser `endpoint`. Permission events are append-only and retain the permission state, source, reason, and user agent where available.

## Customer opt-in behavior

- The browser permission prompt is only called from the explicit Enable button in `WebPushOptIn`.
- Unsupported browsers and denied permissions are recorded as permission events.
- Successful subscriptions are upserted by organization/customer/endpoint.
- Unsubscribe deactivates active subscription rows and attempts to unsubscribe the browser subscription.

## Dashboard behavior

Management page:

```txt
/{locale}/dashboard/customer-club/push
```

The page shows:

- active/inactive/total subscription counts;
- VAPID/dry-run configuration status;
- recent subscription rows;
- recent permission events;
- dry-run delivery preview.

Dashboard API:

```txt
GET  /api/dashboard/customer-club/push
POST /api/dashboard/customer-club/push
```

The dashboard API requires signed-in organization `ADMIN`/`MANAGER` access, with existing `SUPER_ADMIN` behavior inherited through the shared guards.

Customer API:

```txt
GET    /api/customer/push-subscriptions
POST   /api/customer/push-subscriptions
PATCH  /api/customer/push-subscriptions
DELETE /api/customer/push-subscriptions
```

The customer API requires a signed-in user and resolves the organization by public slug.

## Environment flags

Dry-run defaults:

```txt
WEB_PUSH_PROVIDER=dry_run
WEB_PUSH_DRY_RUN=true
WEB_PUSH_REAL_SEND_ENABLED=false
```

Browser opt-in also needs a public VAPID key:

```txt
NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY=
```

Real delivery remains disabled unless a future implementation explicitly sets a real provider path and production secret storage supplies:

```txt
WEB_PUSH_PROVIDER=web_push
WEB_PUSH_DRY_RUN=false
WEB_PUSH_REAL_SEND_ENABLED=true
NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY=
WEB_PUSH_VAPID_PRIVATE_KEY=
WEB_PUSH_VAPID_SUBJECT=
```

## Validation

```powershell
pnpm run db:validate
pnpm run db:generate
pnpm run health:env
pnpm run quality:web-push-foundation
pnpm run quality:loyalty-coupons
pnpm run quality:campaign-builder
pnpm run quality:customer-segments
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

## Deferred

- Real provider delivery using the Web Push protocol.
- Campaign Builder push channel integration.
- Public preference center outside the shop profile card.
- Push analytics beyond subscription and permission event records.
- Automatic cleanup of expired/invalid browser endpoints from real provider responses.
