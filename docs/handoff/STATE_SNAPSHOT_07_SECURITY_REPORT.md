# Bazar Baz Handoff Snapshot 07 - Security Report

## Secret And Environment Exposure

Tracked source was checked through existing validators and explicit inventory. No secret values are printed here.

Local ignored files present in the workspace:

- `.env`
- `.env.local`
- `.env.vercel-production`
- `.env.check`

These files are excluded from the clean snapshot ZIP and must not be shared.

Tracked placeholder file:

- `.env.example` contains empty placeholders or documented dummy placeholders only.

## Handoff Secret Scan Result

The snapshot include set was scanned for private key blocks and non-placeholder assignments to sensitive names. No actual secret values were confirmed.

False-positive/example hits inspected:

| File | Why allowed |
| --- | --- |
| `docs/PHASE_105_PRODUCTION_ROLLOUT_RUNBOOK.md` | uses `<configured>` placeholders |
| `docs/PHASE_18_OVERLAY_MANIFEST.md` | uses local example `postgresql://user:pass@localhost...` commands |
| `docs/PHASE_18_PRODUCTION_INTEGRITY_SMS_READINESS.md` | uses local example database commands and replacement secret text |
| `docs/PHASE_47_WEB_PUSH_FOUNDATION.md` | empty env placeholders |
| `docs/PHASE_59_SHOP_CUSTOM_DOMAINS.md` | example `a-long-random-secret` placeholder |
| `docs/PHASE_63_VERCEL_CUSTOM_DOMAIN_AUTOMATION.md` | empty env placeholders |
| `docs/SMS_IR_INTEGRATION.md` | empty env placeholders |
| `scripts/ops/reset-production-super-admin-password.mjs` | reads env and hashes a runtime password; no password value is present |

Sensitive names checked for snapshot exclusion/scanning:

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `NEXTAUTH_SECRET`
- `SMS_IR_API_KEY`
- `WEB_PUSH_VAPID_PRIVATE_KEY`
- `BLOB_READ_WRITE_TOKEN`
- OAuth client secrets
- Vercel/custom-domain provider tokens

## Server-Only Boundaries

| Secret Area | Current Boundary |
| --- | --- |
| Database URL | Prisma datasource uses env; not returned by health route |
| NextAuth secret | runtime env only |
| SMS.ir API key | server-only SMS client; no browser references found by validators |
| Web Push private VAPID key | server-only service/runtime status exposes booleans only |
| Vercel API token | server-only provider automation, not `NEXT_PUBLIC`, diagnostics return config booleans |
| Blob token | server-side upload/media-storage use |

## Public APIs And Tenant Isolation

- Tenant-direct public APIs remain for shop, appointment, checkout/order tracking, booking, public products/services, and customer support flows.
- Broad discovery routes `/api/public/organizations` and `/api/public/search` are classified as restricted by B2B route policy; do not promote them as marketplace discovery.
- Dashboard APIs use `requireAuthSession`, `requireOrgAccess`, role helpers, membership checks, and resource-level access helpers.
- SUPER_ADMIN has explicit oversight routes; organization admins/managers remain organization-scoped.
- Request-demo lead APIs mask phone data in admin review contexts and do not create tenants/users.

## Phone Number Exposure

- Public lead and SMS/report flows normalize and mask phone values in dashboard DTOs.
- SMS delivery/report validators confirm masked phone behavior and no API key exposure.
- Public order/appointment lookup routes should continue to avoid broad customer data exposure.

## CORS And Host Trust

- No new wildcard CORS was identified in this snapshot pass.
- Custom-domain routing uses normalized Host handling, platform-host bypass, internal resolver, and ACTIVE-only tenant lookup.
- Arbitrary Host is not treated as authenticated tenant authority; unknown hosts fail safely.

## Current Security Blockers

- P11 custom-domain production activation requires explicit authorization before provider mutations or real domain tests.
- Local ignored env files exist and must remain excluded.
- Two operational validators have documentation-baseline failures; implementation secret-safety checks inside those validators passed.
