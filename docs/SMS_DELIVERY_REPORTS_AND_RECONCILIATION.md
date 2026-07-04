# SMS Delivery Reports and Reconciliation

## Overview

P120E adds internal SMS delivery reporting and reconciliation to Bazar Baz. The system correlates `SmsDelivery` records with `NotificationDeliveryAttempt` records and exposes safe dashboard APIs and UI for operators.

## Current state

- Internal reconciliation is implemented and active.
- Provider report polling is **not configured** because official SMS.ir delivery report endpoint documentation was not available at implementation time.
- Dashboard reports show `providerReportAvailable: false` with reason `SMS_IR_REPORT_ENDPOINT_NOT_CONFIGURED`.

## Dashboard

Navigate to `/dashboard/notification-operations` and scroll to the **SMS reports** section.

The section shows:

- Send purpose
- Provider (sms_ir / dry_run)
- Dry-run or live badge
- Delivery status (PENDING / SENT / FAILED / SKIPPED)
- Provider status code (when available)
- packId / messageId (when available)
- Masked destination phone
- Actor / customer context
- Reconciliation status
- Provider report availability notice

## API

```txt
GET  /api/dashboard/notification-operations/sms-ir/deliveries
GET  /api/dashboard/notification-operations/sms-ir/deliveries/[deliveryId]
POST /api/dashboard/notification-operations/sms-ir/deliveries/[deliveryId]/reconcile
```

All endpoints require authenticated dashboard access with organization-scoped roles (ADMIN, MANAGER, STAFF, SUPER_ADMIN).

Reconciliation is POST-only. GET returns 405.

## Reconciliation behavior

`POST .../reconcile` runs `reconcileFromInternalState` which:

1. Loads the `SmsDelivery` row.
2. Loads the latest related `NotificationDeliveryAttempt` for channel `SMS`.
3. Compares statuses.

Possible states:

| State | Meaning |
| --- | --- |
| `dry_run_skipped` | Dry-run delivery; provider reconciliation not required. |
| `pending_attempt` | No delivery attempt recorded yet. |
| `internal_aligned` | `SmsDelivery` and `NotificationDeliveryAttempt` agree. |
| `internal_mismatch_requires_provider_report` | Records disagree; provider report needed to resolve. |
| `unknown` | Cannot determine without provider report. |
| `provider_report_unavailable` | Provider report endpoint is not configured. |

No data is mutated by reconciliation unless a provider report endpoint is later implemented and env-gated.

## Provider report polling (future)

When official SMS.ir report endpoint documentation is available, implement:

- `fetchProviderReportByPackId(packId)`
- `fetchProviderReportByMessageId(messageId)`
- `reconcileFromProviderReport(organizationId, deliveryId)`

Keep guidance:

- Do not invent endpoint URLs.
- Do not call undocumented endpoints.
- Keep API key server-only.
- Keep phone masking.
- Keep reconciliation non-destructive by default.

## Safety

- Real SMS sends are not triggered by reports or reconciliation.
- Order and payment statuses are not mutated.
- Full phone numbers are never returned by APIs or shown in the dashboard.
- `SMS_IR_API_KEY` is never exposed to the browser or API responses.

## Validation

Run:

```powershell
pnpm run quality:sms-delivery-reports
pnpm run quality:sms-provider-reconciliation
```
