# P120E — SMS Delivery Reports and Provider Reconciliation

_Last updated: 2026-07-04._

P120E adds a safe SMS delivery reporting and internal reconciliation foundation. Provider-side report polling is only implemented if official SMS.ir report endpoint documentation exists.

## Goal

Give admins/operators visibility into:

- SMS send request history
- provider packId / messageIds where available
- cost where available
- dry-run vs real-send
- registered customer vs guest dry-run
- delivery attempt status from P120C
- provider reconciliation status
- unresolved/unknown provider status
- reconciliation retry/readiness state

## What Changed

### Internal reconciliation service

Added `lib/sms/sms-delivery-report.service.ts` with:

- `getDeliveries(organizationId, filter)` - returns SMS delivery rows joined with latest SMS `NotificationDeliveryAttempt`
- `getDeliveryDetail(organizationId, deliveryId)` - returns full delivery + attempt history
- `reconcileFromInternalState(organizationId, deliveryId)` - compares `SmsDelivery` status with `NotificationDeliveryAttempt` status and returns reconciliation state
- `markProviderReportUnavailable(...)` - marks provider report as unavailable/docs-required

Internal reconciliation states:

- `dry_run_skipped` - dry-run delivery does not need provider reconciliation
- `pending_attempt` - no SMS delivery attempt recorded yet
- `internal_aligned` - `SmsDelivery` and `NotificationDeliveryAttempt` agree
- `internal_mismatch_requires_provider_report` - internal records disagree; provider report required to resolve
- `unknown` - cannot determine alignment without provider report
- `provider_report_unavailable` - provider report endpoint is not configured

### Provider report foundation

Because official SMS.ir delivery report endpoint documentation was not available at implementation time, provider polling methods return a safe unavailable state:

- `fetchProviderReportByPackId` returns `not_configured`
- `fetchProviderReportByMessageId` returns `not_configured`
- `reconcileFromProviderReport` returns `not_configured`

When official SMS.ir report docs are provided later, these methods can be implemented without changing the dashboard/API contracts.

### Dashboard API

Added routes under `app/api/dashboard/notification-operations/sms-ir/`:

- `GET /api/dashboard/notification-operations/sms-ir/deliveries` - list SMS delivery reports for the organization
- `GET /api/dashboard/notification-operations/sms-ir/deliveries/[deliveryId]` - detail view
- `POST /api/dashboard/notification-operations/sms-ir/deliveries/[deliveryId]/reconcile` - trigger internal reconciliation

All routes require dashboard auth and organization access.

### Dashboard UI

Extended `app/[locale]/dashboard/notification-operations/page.tsx` with an SMS delivery reports section showing:

- purpose, provider, dry-run/live badge, provider status
- masked phone number, actor, customer
- packId, messageId (when available)
- reconciliation status
- provider report availability notice

Persian labels added for the report section.

## Security

- API keys are never returned by report/reconciliation endpoints
- Phone numbers are masked in all DTOs
- Reconciliation never sends SMS
- Reconciliation never mutates order or payment status
- No undocumented SMS.ir endpoints are called

## Schema

No Prisma migration was required. P120E uses existing `SmsDelivery` and `NotificationDeliveryAttempt` tables.

## Validation

Added validators:

- `quality:sms-delivery-reports` - checks service, API/page, auth, masking, no API key exposure, Persian labels
- `quality:sms-provider-reconciliation` - checks service, POST-only reconcile route, no hardcoded report URLs, docs-required state, no SMS send, no order mutation

## Known Limitations

- Provider-side report polling is unavailable until official SMS.ir report endpoint documentation is provided
- Delivery report UI is compact and stateless; no date-range filtering beyond basic bounds
- Reconciliation currently uses only internal state; cross-checking with provider data requires future implementation after docs are available

## Exit Criteria

- `quality:local` passes
- `quality:sms-delivery-reports` passes
- `quality:sms-provider-reconciliation` passes
- Existing SMS validators continue to pass
- Typecheck passes
- Build passes
