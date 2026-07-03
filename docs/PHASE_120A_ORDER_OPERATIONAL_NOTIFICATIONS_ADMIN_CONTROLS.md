# P120A — Operational Order Notifications and Admin Order Controls

**Status: Completed**

## Summary

This phase implements operational order notifications for shop admins, managers, and staff, along with improved admin order controls in the dashboard.

## Changes

### Operational Notifications
- `lib/notifications/operational-router.ts` with `OperationalNotificationRouter` class
- `notifyOrderCreatedForStaff()` - In-app notifications for operational staff (ADMIN, MANAGER, STAFF roles only)
- `attemptStaffWebPush()` - Non-blocking Web Push delivery for subscribed dashboard users
- Excludes CUSTOMER, GUEST, and DRIVER from "new order requires shop action" notifications
- Uses existing `organizationId` and `type` fields on Notification model

### Dashboard Push Subscription
- `app/api/dashboard/push-subscriptions/route.ts`
- GET - Returns current dashboard push subscription status
- POST - Registers/activates dashboard user for push notifications
- DELETE - Unsubscribes/clears dashboard push subscription
- Requires authenticated dashboard user (ADMIN/MANAGER/STAFF roles)

### Admin Push Opt-in UI
- `components/dashboard/dashboard-push-opt-in.tsx`
- Persian-first UI with browser permission handling
- Non-blocking subscription/unsubscription
- Shows dry-run state when Web Push is disabled

### Admin Order Controls Improvements
- Replaced blind all-status dropdown with allowed transition buttons
- Added `ALLOWED_TRANSITIONS` constant defining valid state transitions
- Added Persian status transition labels (قبول سفارش, شروع آماده‌سازی, etc.)
- Driver assignment UI now uses Persian labels
- Payment controls remain intact with COMPLETED/FAILED states

## Status

- implemented: yes
- committed: yes (hash: 14e94e2)
- pushed: yes (origin/main)
- quality:local: passed (all 374 checks pass after P120A-FIX1)

The `quality:local` script passes after P120A-FIX1 Windows-safe runner updates. All P120A-specific validators pass:
- `quality:order-operational-notifications` - all 20 checks pass
- `quality:admin-order-controls` - all 13 checks pass

Core validations pass:
- db:generate, db:validate, typecheck, build - all pass

## Before P120A

### Shop Admin In-app Notification
- Status: Partial - relied on customer club membership for in-app notifications

### Shop Admin Browser Web Push
- Status: No - only customer push subscriptions existed

## After P120A

### Shop Admin In-app Notification
- Status: Yes - tenant-scoped, role-filtered operational notifications

### Shop Admin Browser Web Push
- Status: Yes (behind env gate) - dashboard push subscriptions for operational staff

## Configuration

Web Push is controlled by environment variables:
- `WEB_PUSH_ENABLED=true` - Enables Web Push system
- `WEB_PUSH_REAL_SEND_ENABLED=true` - Enables actual sending (disabled defaults to dry-run)
- `WEB_PUSH_DRY_RUN=true` - Forces dry-run mode (safe for local tests)

## Notification Delivery

1. Order created via `orderService.create()` or `orderService.createForGuest()`
2. In-app notifications created for active operational staff (inside transaction)
3. Web Push delivery attempted post-transaction in non-blocking manner
4. Failures are logged but do not block order creation

## Role-Based Targeting

Staff notifications target only users with roles:
- ADMIN
- MANAGER  
- STAFF

Excluded:
- CUSTOMER
- GUEST
- DRIVER

## Known Limitations

- Customer order lifecycle notifications (status change, payment change) are not implemented - planned for P120B
- Order history/payment events visible through existing status history tables
- No real SMS sending for admin notifications (by design)
- Guest customer notifications through SMS are not implemented - planned for P120B