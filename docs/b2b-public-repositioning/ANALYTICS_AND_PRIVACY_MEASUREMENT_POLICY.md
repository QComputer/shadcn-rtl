# Analytics and Privacy Measurement Policy

This document defines the analytics and privacy measurement policy for Bazar Baz public B2B surfaces.

## Purpose

Analytics is used for product improvement and conversion measurement on public B2B pages only.

## Default State

- Analytics is disabled by default unless explicitly configured via environment variables.
- If no analytics provider is configured, no analytics code should execute.

## Allored Data Collection

- Page views and route paths on public marketing pages.
- Generic conversion events (e.g., "request-demo-viewed", "features-viewed").
- Locale and device type for UX improvement.
- Referrer source for marketing attribution.

## Prohibited Data Collection

- Full phone numbers or masked phone numbers.
- SMS provider keys, VAPID private keys, DATABASE_URL, auth secrets.
- Customer personal data from tenant direct pages.
- Private dashboard data.
- Real payment/billing transaction details.
- Third-party tracking cookies without explicit consent.

## Environment Gates

If analytics is implemented, it must require explicit environment variables:

- `NEXT_PUBLIC_ANALYTICS_ENABLED=true`
- `NEXT_PUBLIC_ANALYTICS_PROVIDER=<safe-provider>`

No analytics provider script should load without these gates.

## Privacy-Aware Rules

- Do not send customer personal data to analytics.
- Lead form events must be generic unless consented/configured.
- Respect locale and route-level privacy.
- Dashboard/private pages should avoid public marketing analytics unless intentionally reviewed.
- Analytics data retention and deletion policies must be documented if a provider is added.

## Implementation Notes

- Prefer policy/readiness only unless the project already has analytics infrastructure.
- If adding analytics code, it must not break the build when env vars are absent.
- All analytics code must be auditable and documented in this policy.
