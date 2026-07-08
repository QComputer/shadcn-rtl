# BB-B2B-P10 — Request-demo Lead Storage and Admin Review

## Phase Summary

Turn the UI-only request-demo form into a safe, server-side lead capture workflow with an authenticated SUPER_ADMIN review page.

## What Changed

- Added `RequestDemoLead` Prisma model with `RequestDemoLeadStatus` enum (NEW, REVIEWED, CONTACTED, QUALIFIED, REJECTED, ARCHIVED).
- Added Prisma migration `20260707000100_request_demo_lead_storage`.
- Created public API `POST /api/request-demo` with server-side validation, Iranian phone normalization, rate limiting, and consent enforcement.
- Connected the request-demo page form to the new API with loading, success, and error states.
- Created SUPER_ADMIN-only dashboard page `app/[locale]/dashboard/request-demo-leads/` with lead list, masked phone numbers, and detail/edit dialog.
- Added dashboard navigation item `درخواست‌های دمو` visible only to SUPER_ADMIN.
- Updated `access-control.ts`, `navigation-policy.ts`, and `dashboard-sidebar.tsx` to include the new route.
- Created a new `Table` UI component to satisfy the admin review page dependency (the project previously lacked `components/ui/table.tsx`).

## FIX1 — TypeScript/build gate repair

- Restored `pnpm run typecheck` and `pnpm run build` to exit 0.
- Root cause: `lib/export-hub/types.ts` listed `CUSTOMERS` and `FANPAGE_POSTS` in `exportDataTypes`, but the Prisma `ExportDataType` enum only contained `PRODUCTS`, `PRODUCT_CATEGORIES`, and `ORDERS`.
- Fix: added `CUSTOMERS` and `FANPAGE_POSTS` to the canonical `ExportDataType` enum in `prisma/schema.prisma` and created migration `20260707000200_export_hub_extend_data_types`.
- No unsafe casts, `any`, `@ts-ignore`, or validator weakening was used.
- The Export Hub foundation validator (`quality:export-hub-foundation`) continues to pass.

## FIX4 — Authenticated Production Acceptance (COMPLETED)

- Created read-only inventory script `scripts/ops/inspect-production-platform-admins.mjs`.
- Executed inventory against production via `DATABASE_URL_UNPOOLED`.
- **Result:** 1 active SUPER_ADMIN account exists in production.
  - Account ID: `cmo8eoeyo000ajmnkw26stri5`
  - Login identifier: phone number starting with `091***`
  - Role: `SUPER_ADMIN`
  - Enabled: yes
  - Last login: 2026-06-29
- **Resolution:** User authorized password reset for existing account via `scripts/ops/reset-production-super-admin-password.mjs`.
  - Password reset applied using canonical `bcrypt` 12-round hashing.
  - `failedLoginAttempts` and `lockedUntil` cleared.
  - No credentials or password hashes were printed.
- **Verified:** Authenticated SUPER_ADMIN login succeeds with reset credentials.
- **Verified:** `GET /api/dashboard/request-demo-leads` returns 200 for SUPER_ADMIN.
- **Verified:** `/fa/dashboard/request-demo-leads` dashboard page is accessible to SUPER_ADMIN.
- **Verified:** No missing-table or Prisma errors occur.
- **Verified:** Deployed P10 smoke passes all checks (public page, invalid POST, unauthenticated block, authenticated lead list, dashboard access).
- No valid production lead was created during acceptance.
- No lead was modified during acceptance.
- No SMS/email/CRM side effects occurred.
- All source validators, typecheck, and build pass.

## Current Acceptance Status

| Check | Status |
|---|---|
| TypeScript/build gates | PASS |
| P10 source validator | PASS (50 checks) |
| Export Hub validator | PASS (21 checks) |
| Source baseline | PASS |
| Public request-demo page | PASS |
| Invalid public POST validation | PASS |
| Unauthenticated admin API block | PASS |
| Production migrations applied | PASS |
| RequestDemoLead table exists | PASS |
| Authenticated admin lead-list API | PASS |
| Admin dashboard page accessible | PASS |
| Tenant-admin platform-lead access | Source-only (enforced by code + validator) |

## What Is Preserved

- No SMS is sent from the request-demo workflow.
- No email is sent automatically.
- No tenant/organization/user is created automatically.
- No real payment/billing is introduced.
- No secrets are exposed.
- Phone numbers are masked in the public lead list.
- Tenant admins cannot see platform-wide leads.
- Persian-first RTL is preserved.

## Safety Notes

- Rate limit: 5 requests per IP per hour (basic in-memory guard).
- Phone normalization: strips non-digits, normalizes to `09xxxxxxxxx`.
- Generic error responses are returned to the client; detailed DB errors are logged server-side only.
- Lead data is only visible to authenticated SUPER_ADMIN sessions.

## Validators

- `pnpm run quality:b2b-request-demo-leads` — deterministic source validator.

## Next Phase

BB-B2B-P11 — Tenant Custom-domain Onboarding Flow
