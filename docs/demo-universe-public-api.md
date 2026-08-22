# Demo Universe Public Experience API

This API layer exposes the backend contract needed by the future interactive public demo UI. It uses the existing organization, capability, integration, business event, and customer identity foundations.

## Public discovery

- `GET /api/public/demo-organizations`
  - unauthenticated
  - returns only organizations with `OrganizationSettings.settings.demo.enabled === true`
  - includes public organization metadata, active capabilities, available demo roles, and integration readiness

- `GET /api/public/homepage`
  - unauthenticated
  - returns structured homepage data: hero keys, demo highlights, demo organizations, supported capabilities, and integration ecosystem entries

## Demo sessions

- `POST /api/public/demo/:organizationSlug/session`
  - unauthenticated
  - accepts `PLATFORM_ADMIN`, `ORGANIZATION_OWNER`, `CUSTOMER`, `MANAGER`, `STAFF`, or `DRIVER`
  - creates a temporary `DemoSessionToken`
  - returns the raw token once; the database stores only `tokenHash`
  - sets an HttpOnly `bazarbaaz_demo_session` cookie for browser-driven demo flows
  - stores `demoRole` separately from the internal `UserRole` mapping, so demo-facing roles do not require changing the application auth enum

Demo APIs accept:

- `Authorization: Bearer <token>` or `x-demo-session-token: <token>`
- or the HttpOnly `bazarbaaz_demo_session` cookie set by the public session endpoint
- `x-demo-organization-slug: <slug>`

The reusable resolver in `lib/demo-universe/demo-session-context.ts` validates the token, expiration, demo organization, tenant scope, and role.

## Role matrix

| Role | Dashboard | Actions |
| --- | --- | --- |
| PLATFORM_ADMIN | `/api/demo/platform/dashboard` | compare tenants and view ecosystem readiness |
| ORGANIZATION_OWNER | `/api/demo/manager/dashboard` | `POST /api/demo/campaigns/demo` |
| CUSTOMER | `/api/demo/customer/dashboard` | `POST /api/demo/orders/create` |
| MANAGER | `/api/demo/manager/dashboard` | `POST /api/demo/campaigns/demo` |
| STAFF | `/api/demo/staff/dashboard` | `POST /api/demo/orders/:id/prepare`, `POST /api/demo/orders/:id/ready` |
| DRIVER | `/api/demo/driver/dashboard` | `POST /api/demo/orders/:id/deliver` |

## Scenario flow

`GET /api/demo/scenario` returns the active guided scenario for the selected demo organization. The default scenario is stored in `DemoScenario` and `DemoScenarioStep`, while per-session completion state is stored in `DemoProgress`.

Controlled demo actions create `BusinessEvent` rows, customer interactions, order status history, and scenario progress when a demo customer identity is available:

1. Customer creates a demo order.
2. Staff moves it to preparing.
3. Staff marks it ready.
4. Driver delivers it.
5. CRM summary can show the resulting event and interaction history.

No real payment, notification, SMS, USSD, or external provider call is performed.

## External catalog preview

- `GET /api/demo/catalog/connections`
- `POST /api/demo/catalog/connections`
- `POST /api/demo/catalog/connections/:connectionId/preview`

These endpoints model future SnappFood/EZY/menu-provider imports using mock connectors only. Preview runs store external items and sync metadata for review, but they do not publish or overwrite real `Product` or `ProductCategory` rows.

## Future UI assumptions

The frontend should treat all text keys as renderable content contract keys, not final marketing copy. Browser flows should rely on the HttpOnly demo session cookie where possible and must send the selected organization slug on demo API calls to preserve explicit tenant scope.
