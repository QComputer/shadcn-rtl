# Demo-Only Public API Policy

This document defines the policy for public APIs that return data for demo/example purposes.

## Scope

- Covers APIs that could be used for public discovery or marketplace browsing.
- Does not cover tenant-scoped APIs that require a specific org slug.

## Rules

- Public APIs must not expose all real organizations as a marketplace list to anonymous users.
- Public APIs must not expose customer phone numbers.
- Public APIs must not expose private order details.
- Public APIs must not expose SMS/VAPID/provider secrets.
- Demo data returned by public APIs must be clearly fictional and labeled as examples.
- If a broad public discovery API returns real tenant data, it must be limited and noindex/policy-restricted.

## Approved Public API Categories

- `TENANT_DIRECT_PUBLIC` — data by slug/domain, scoped to one organization.
- `TENANT_CUSTOMER_FLOW` — checkout, booking, order tracking.
- `DEMO_PORTFOLIO` — demo-only data from `lib/content/b2b-demo-businesses.ts`.
- `MARKETPLACE_DISCOVERY` — broad listing/search; restricted from promotion and navigation.

## Forbidden Public API Exposures

- Full customer phone numbers.
- Private org financial details.
- SMS provider credentials.
- VAPID private keys.
- Cross-tenant customer data.
