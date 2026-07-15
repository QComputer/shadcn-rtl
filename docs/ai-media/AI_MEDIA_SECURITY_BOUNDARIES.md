# AI Media Security Boundaries

Date: 2026-07-15

Boundaries:

- Browser calls Bazar Baz only.
- Bazar Baz server calls Render only through the canonical server-only client.
- Render metadata is never used for tenant authorization.
- Local Bazar Baz records are the source of tenant ownership.
- SUPER_ADMIN diagnostics return sanitized metadata only.
- No raw OpenAPI document, provider stack trace, credential, or remote response body is returned to tenants.
- Organization logo/cover provider execution fails closed until a compatible live operation is proven.

Tenant access rules:

- authenticated session required;
- organization membership required;
- ADMIN/MANAGER or current SUPER_ADMIN policy required;
- local job organization id gates status, cancel, refresh, and asset access;
- wrong-tenant job ids return forbidden/not found behavior through existing guards.

Real generation remains disabled unless separately authorized.
