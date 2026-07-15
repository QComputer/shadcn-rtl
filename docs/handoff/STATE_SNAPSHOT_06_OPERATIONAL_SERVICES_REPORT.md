# Bazar Baz Handoff Snapshot 06 - Operational Services Report

## Notifications

In-app and operational notifications are implemented through:

- `Notification`
- `NotificationPreference`
- `NotificationDeliveryAttempt`
- `lib/services/notification-*`
- `app/api/dashboard/notification-operations/**`
- `app/[locale]/dashboard/notification-operations/page.tsx`

`NotificationDeliveryAttempt` records channel, target, status, retry metadata, provider reference, sanitized metadata, and error text. Retry policy exists and is deterministic; real resend behavior remains guarded by environment and preferences.

Validation status:

- `quality:notification-operations` passed.
- `quality:notification-delivery-observability` passed.
- `quality:notification-retry-policy` passed.
- `quality:notification-ops-deployed-safety` passed.

## Web Push

Architecture:

- Client opt-in components check secure context, service worker support, Push API support, permission state, and public VAPID key presence.
- Server-side private VAPID key usage is kept behind service/runtime boundaries.
- `PushSubscription`, `NotificationPermissionEvent`, and `WebPushDelivery` models preserve subscription state, permission history, and delivery history.
- Root service worker is `public/web-push-sw.js`.
- Diagnostics route: `/api/dashboard/notification-operations/web-push/status`.

Production status:

- Feature-flag/env-gated; public key may be exposed by design, private key must remain server-only.
- VAPID key corruption was previously resolved by regeneration in earlier commits/docs.

Validation status:

- `quality:web-push-foundation` passed.
- `quality:web-push-capability-detection` passed.
- `quality:web-push-delivery` failed two documentation-baseline checks only: README/roadmap wording still expected an older P109 marker.

## SMS.ir

Architecture:

- Server-only SMS.ir client: `lib/sms/sms-ir-client.server.ts`.
- Provider abstraction and delivery service under `lib/sms/**`.
- `SmsDelivery` records provider/dry-run status, masked phone metadata, provider message IDs/pack IDs, and audit context.
- Real-send gates require explicit env configuration and acknowledgement.
- Guest/customer operational flows default to dry-run-safe behavior unless explicitly authorized.
- Dashboard diagnostics and report endpoints live under `/api/dashboard/notification-operations/sms-ir/**`.

Key behaviors:

- Dry-run is default.
- API key is server-only; diagnostics do not expose it.
- Delivery reports support official SMS.ir report endpoints and internal reconciliation.
- Reconciliation does not send SMS and does not mutate order/payment state.

Validation status:

- `quality:sms-ir-provider-completion` passed.
- `quality:sms-delivery-reports` passed.
- `quality:sms-provider-reconciliation` passed.
- `quality:sms-provider-report-endpoints` passed.
- `quality:sms-real-send-gates` passed.
- `quality:sms-provider` failed two documentation-baseline checks only: README/roadmap wording still expected an older P109 marker.

## Custom Domains

Architecture:

- Model: `OrganizationDomain`.
- Validation: `lib/domains/domain-normalization.server.ts`.
- Authorization: `lib/domains/domain-authorization.server.ts` plus `lib/api-guards.ts`.
- Routing: `proxy.ts` calls internal resolver and rewrites custom hosts to localized shop/appointment routes.
- SEO/canonical: `lib/custom-domain-seo.ts`, custom-domain robots/sitemap APIs.
- Provider automation: `lib/vercel-domain-automation.ts`.
- Dashboard onboarding: `app/[locale]/dashboard/settings/domains/page.tsx`.
- APIs: `app/api/dashboard/organization-domains/**`.

Lifecycle:

`REQUESTED`, `PROVIDER_PENDING`, `DNS_REQUIRED`, `VERIFYING`, `ACTIVE`, `ERROR`, `DISABLED`, `REMOVAL_PENDING`, `REMOVED`.

Safety:

- Rejects schemes, paths, queries, ports, wildcards, IPs, localhost, and platform/reserved hosts.
- IDN domains normalize to punycode.
- Only ACTIVE domains route.
- Unknown custom hosts fail to `domain-not-configured`.
- Provider mutation is disabled by default and requires exact ACK.
- Dry-run provider actions do not write fake provider status as real state.

Readiness:

- Source accepted by P11-FIX1.
- Production migration and authorized real-domain/provider test remain pending.

