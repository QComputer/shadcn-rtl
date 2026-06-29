# Phase 102 - Notification templates, routing, and delivery policies

P102 adds the reusable notification routing layer that future workflow phases can call instead of writing directly to channel-specific delivery code.

## Implemented

- Added `lib/notifications/templates.ts` with Persian-first reusable templates for:
  - appointment confirmation;
  - appointment reminder;
  - order created;
  - order status updated;
  - payment status updated;
  - staff alert;
  - marketing broadcast.
- Added `lib/notifications/delivery-policy.ts` to resolve allowed channels and preference kind per template.
- Added `lib/notifications/router.ts` to route a rendered template to one customer across:
  - in-app notifications;
  - Web Push;
  - SMS.
- Added single-customer Web Push delivery support through `webPushFoundationService.sendToCustomer()`.
- Kept channel-specific preference checks central:
  - in-app via `notificationPreferencesService.isCustomerDeliveryAllowed()`;
  - Web Push via `sendToCustomer()`;
  - SMS via `smsService.sendTextToCustomer()`.
- Added P102 quality gate through `quality:notification-routing`.

## Safety policy

- The router supports dry-run preview without creating channel deliveries.
- Real Web Push and SMS delivery remain controlled by their P100/P101 environment gates.
- Future appointment, order, payment, staff-alert, and marketing workflows should call `notificationRouterService`.
- Route handlers and workflow services should not import sms.ir or raw Web Push provider APIs directly.

## Validation

```powershell
pnpm run quality:notification-routing
pnpm run quality:sms-provider
pnpm run quality:web-push-delivery
pnpm run quality:notification-preferences
pnpm run quality:local
pnpm run typecheck
pnpm run build
```

## Next

- Admin/operator notification dashboard.
- Deployed PWA, Push, and SMS smoke gates.
- Production rollout runbook.
