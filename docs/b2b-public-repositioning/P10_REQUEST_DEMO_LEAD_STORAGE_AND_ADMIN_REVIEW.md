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
