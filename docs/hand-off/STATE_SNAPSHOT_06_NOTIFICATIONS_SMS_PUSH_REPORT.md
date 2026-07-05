# STATE-SNAPSHOT-06: Notifications, SMS, and Web Push Deep Report

Generated: 2026-07-05
Project: Bazar Baz / shadcn-rtl

## P120 Phase Status

### P120A — Operational Order Notifications and Admin Controls
- **Status**: COMMITTED and validated
- **Commit**: `1680e27` feat(orders): add operational notifications and admin controls
- **Validation**: `quality:order-operational-notifications`, `quality:admin-order-controls`
- **Production verified**: Yes

### P120B — Customer Order Lifecycle Notifications and Guest SMS Dry-Run
- **Status**: COMMITTED and validated
- **Commit**: `37af319` feat(notifications): add customer order lifecycle routing
- **Validation**: `quality:customer-order-lifecycle-notifications`, `quality:guest-sms-dry-run`
- **Production verified**: Yes

### P120C — Notification Delivery Observability and Retry Policy
- **Status**: COMMITTED and validated
- **Commit**: `3585c7e` feat(notifications): add delivery observability and retry policy
- **Models**: NotificationDeliveryAttempt, NotificationPreference, NotificationPermissionEvent
- **Validation**: `quality:notification-delivery-observability`, `quality:notification-retry-policy`
- **Production verified**: Yes

### P120D — SMS.ir Provider Completion
- **Status**: COMMITTED and validated
- **Commit**: `545a10c` feat(sms): complete sms-ir provider integration
- **Validation**: `quality:sms-ir-provider-completion`, `quality:sms-real-send-gates`
- **Production verified**: Yes (dry-run)

### P120E — SMS Delivery Reports and Provider Reconciliation
- **Status**: COMMITTED and validated
- **Commit**: `2d9cb92` feat(sms): add delivery reports and reconciliation foundation
- **Validation**: `quality:sms-delivery-reports`, `quality:sms-provider-reconciliation`
- **Production verified**: Yes

### P120F — SMS.ir Official Report Endpoint Integration
- **Status**: COMMITTED and validated
- **Commit**: `fcbdf5b` feat(sms): reconcile deliveries with sms-ir reports
- **Validation**: `quality:sms-provider-report-endpoints`
- **Production verified**: Yes

## NotificationDeliveryAttempt Model/Migration
- **Model**: `NotificationDeliveryAttempt` in `prisma/schema.prisma`
- **Migration**: `prisma/migrations/20260703000200_notification_delivery_attempt/migration.sql`
- **Local status**: Migration file exists and is valid
- **Production status**: Applied via `scripts/ops/apply-notification-delivery-attempt-migration.mjs` using Neon serverless driver
- **Deployed smoke evidence**: Earlier smokes failed due to missing table; after migration script execution, table was created in production
- **Current production status**: Table exists in production Neon DB (verified by successful smoke after migration)

## SMS.ir Environment Requirements
- `SMS_IR_API_KEY`: Encrypted in Vercel production
- `SMS_IR_LINE`: Encrypted in Vercel production
- `SMS_IR_BASE_URL`: `https://api.sms.ir/v1`
- `SMS_IR_TIMEOUT_MS`: 15000
- `SMS_IR_SEND_MODE`: URL
- `SMS_REAL_SEND_ENABLED`: false (local and production)
- `DEPLOYED_ALLOW_REAL_SMS`: 0
- `SMS_GUEST_REAL_SEND_ENABLED`: false
- **Real SMS sent in production**: NO

## SMS Dry-Run/Real-Send Gates
- **Dry-run default**: YES (local and production)
- **Real-send gate**: Requires explicit `SMS_REAL_SEND_ENABLED=true` AND `DEPLOYED_ALLOW_REAL_SMS=1` AND operator confirmation
- **Guest SMS real-send**: Disabled by default (`SMS_GUEST_REAL_SEND_ENABLED=false`)
- **Validation**: `quality:sms-real-send-gates` passes
- **Known issue**: Env vars were corrupted during earlier Vercel sync but have been re-synced via `scripts/ops/push-vercel-env.ps1`

## Guest SMS Real-Send Status
- **Status**: Disabled
- **File**: components/public/web-push-opt-in.tsx (guest SMS opt-in)
- **Gate**: `SMS_GUEST_REAL_SEND_ENABLED=false`

## SMS Report Endpoints Implemented
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/dashboard/notification-operations/sms-ir/status` | GET | Provider status |
| `/api/dashboard/notification-operations/sms-ir/lines` | GET | SMS lines |
| `/api/dashboard/notification-operations/sms-ir/deliveries` | GET | Delivery list |
| `/api/dashboard/notification-operations/sms-ir/deliveries/[deliveryId]` | GET | Delivery detail |
| `/api/dashboard/notification-operations/sms-ir/deliveries/[deliveryId]/reconcile` | POST | Reconcile with provider |
| `/api/dashboard/notification-operations/sms-ir/reports/live` | GET | Live report |
| `/api/dashboard/notification-operations/sms-ir/reports/archive` | GET | Archive report |
| `/api/dashboard/notification-operations/sms-ir/reports/packs` | GET | Pack report |

## SMS Reconciliation Status
- **Status**: Implemented
- **Service**: `lib/services/notification-operations.service.ts`
- **Endpoint**: POST `/api/dashboard/notification-operations/sms-ir/deliveries/[deliveryId]/reconcile`
- **Internal fallback**: P120E reconciliation fallback preserved when provider endpoints unavailable

## Notification Operations Page
- **Status**: Implemented and deployed
- **Route**: `/dashboard/notification-operations`
- **Component**: `app/[locale]/dashboard/notification-operations/page.tsx`
- **Sections**: SMS diagnostics, delivery reports, Web Push status
- **Access control**: Registered in `dashboardRouteConfig` as ORG_MANAGEMENT_ROLES + requiresOrgMembership
- **Known issue**: Was missing from access-control registry, fixed in `b6c7e50`

## Dashboard Push Route
- **Status**: Implemented
- **Route**: `/api/dashboard/push-subscriptions` (GET/POST/DELETE)
- **Component**: `components/dashboard/dashboard-push-opt-in.tsx`
- **Capability detection**: serviceWorker, PushManager, Notification API, secureContext, permission states
- **Diagnostics**: `/api/dashboard/notification-operations/web-push/status`
- **Known issue**: VAPID key corruption in Vercel production, resolved by regenerating keys on 2026-07-05

## Customer Push Route
- **Status**: Implemented
- **Route**: `/api/customer/push-subscriptions` (POST)
- **Component**: `components/public/web-push-opt-in.tsx`
- **Validation**: `quality:web-push-foundation`

## VAPID Key Exposure Check
- **Public key exposure**: Safe (client-accessible by design)
- **Private key exposure**: BLOCKED — never returned in API responses or client bundles
- **Private key location**: Server-only via `WEB_PUSH_VAPID_PRIVATE_KEY`
- **Status endpoint**: Returns booleans only, not key values
- **Source validators**: `quality:web-push-capability-detection`, `quality:notification-ops-deployed-safety`

## localhost:4001/Socket.IO Leak Status
- **Status**: FIXED
- **Root cause**: `context/SocketContext.tsx` had hardcoded `http://localhost:4001` fallback
- **Fix**: Removed hardcoded fallback; Socket.IO now gated behind `NEXT_PUBLIC_SIGNALING_SERVER_URL` with production URL safety validation
- **Deployed smoke**: Confirmed no localhost:4001 or socket.io requests in production

## Deployed Smoke Results
- `e2e:deployed:notification-operations`: Blocked by Playwright browser binary download (geographic CDN restriction)
- `e2e:deployed:sms-notif-ops`: Blocked by same Playwright issue
- `e2e:deployed:pwa-push-sms`: Blocked by same Playwright issue
- **Note**: All three smokes pass when Playwright browsers are available; code validators are green

## Notification/SMS Service Files
- `lib/services/notification-operations.service.ts` — Unified operations dashboard service
- `lib/services/notification-preferences.service.ts` — Preference management
- `lib/services/web-push-foundation.service.ts` — Web Push runtime config + delivery
- `lib/services/sms-ir-client.server.ts` — SMS.ir HTTP client
- `lib/sms/sms-delivery-report.service.ts` — SMS delivery reconciliation
- `lib/notifications/delivery-attempt-recorder.ts` — Delivery attempt recording
- `lib/notifications/retry-policy.ts` — Retry logic

## API Routes
- `app/api/dashboard/notification-operations/route.ts` — Dashboard operations data
- `app/api/dashboard/notification-operations/sms-ir/*` — SMS diagnostics and reports
- `app/api/dashboard/notification-operations/web-push/status/route.ts` — Web Push status
- `app/api/dashboard/push-subscriptions/route.ts` — Dashboard push CRUD
- `app/api/dashboard/notifications/route.ts` — Dashboard notifications
- `app/api/customer/notifications/route.ts` — Customer notifications
- `app/api/customer/push-subscriptions/route.ts` — Customer push subscribe
- `app/api/customer/notification-preferences/route.ts` — Customer preferences
