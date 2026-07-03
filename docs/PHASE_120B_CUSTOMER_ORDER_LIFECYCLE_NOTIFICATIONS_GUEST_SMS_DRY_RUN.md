# P120B — Customer Order Lifecycle Notifications and Guest SMS Dry-Run Review

**Status: Completed**

## Summary

This phase adds customer-facing order lifecycle notifications and establishes a safe guest SMS dry-run foundation. P120A covered staff/admin operational notifications on new orders. P120B extends notification coverage to registered customers when their order status or payment status changes, and reviews the guest notification path with strict dry-run-only safeguards.

## Changes

### Registered Customer Notifications

- `lib/notifications/customer-order-lifecycle-router.ts` with `CustomerOrderLifecycleRouter` class
- `notifyCustomerOrderStatusChangedSafe()` — routes in-app, Web Push, and SMS for registered customers on order status changes
- `notifyCustomerPaymentStatusChangedSafe()` — routes in-app, Web Push, and SMS for registered customers on payment status changes
- Reuses existing `notificationRouterService.routeCustomerNotification()` with `order_status_updated` and `payment_status_updated` templates
- Dry-run fallback when preferences or routing policy restrict delivery

### Dashboard Order Status Update

- `orderService.updateStatus()` now includes `customer` and `guestCustomer` context in its transaction query
- After successful status update and history write, calls `customerOrderLifecycleRouter.notifyOrderStatusChangedSafe()`
- Notification failure is caught and logged as non-blocking
- Duplicate notifications on unchanged status are prevented

### Dashboard Payment Status Update

- `orderService.updatePaymentStatus()` now includes `customer` and `guestCustomer` context in its transaction query
- After successful payment update and payment event write, calls `customerOrderLifecycleRouter.notifyPaymentStatusChangedSafe()`
- Notification failure is caught and logged as non-blocking
- Duplicate notifications on unchanged payment status are prevented

### Guest Customer Dry-Run Path

- Guest customers do not receive in-app or Web Push notifications (no `User` account target exists)
- Guest phone is normalized/validated safely before any dry-run review
- Dry-run guest SMS intent is recorded via safe audit logging, never triggering a real SMS provider call
- Guest notification failure does not affect order status or payment updates

### Templates

- Existing `order_status_updated` template used for order lifecycle changes
- Existing `payment_status_updated` template used for payment lifecycle changes
- Persian-first copy for both templates

## Status

- implemented: yes
- committed: yes
- pushed: yes
- quality:local: passed
- typecheck: passed
- build: passed

## Before P120B

### Registered Customer Notifications
- Status: None — registered customers received no notifications on order/payment status changes

### Guest Customer Notifications
- Status: None — no guest notification path existed

## After P120B

### Registered Customer Notifications
- Status: Yes — tenant-scoped, preference-aware in-app/Web Push/SMS routing for order and payment lifecycle events

### Guest Customer Notifications
- Status: Dry-run reviewed only — no in-app, no Web Push, no real SMS

## P120A Preservation

P120A operational staff notifications are preserved:
- `OperationalNotificationRouter.notifyOrderCreatedForStaff()` continues to fire for ADMIN/MANAGER/STAFF on new registered/guest orders
- Dashboard push subscription API and opt-in UI unchanged
- Admin order controls with allowed transition buttons unchanged

## Security Boundaries

- Customer notification delivery respects existing `NotificationPreference` and `notificationRouterService` routing policy
- SMS delivery remains behind `getSmsRuntimeConfig()` dry-run and real-send gates
- No SMS provider secrets exposed to client
- No VAPID private key exposed to client
- Guest SMS dry-run never calls `SmsIrProvider` or any real SMS provider
- No cross-tenant notification targeting
- No ComfyUI/GPU/private network dependencies added

## Known Limitations

- Guest customers cannot receive real SMS in P120B; schema migration would be required to link `SmsDelivery` to `GuestCustomer`
- Notification delivery retry/backoff is not implemented — planned for P120C
- Customer-facing notification templates are minimal; richer template variants can be added in later phases
