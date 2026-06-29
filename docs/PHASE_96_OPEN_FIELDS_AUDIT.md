# Phase 96 - Open Fields and Workflow Completion Audit

Date: 2026-06-29

## Goal

Audit open or partially wired workflow fields before the PWA, Web Push, and SMS phases, then close only low-risk gaps where the database field and public behavior already exist.

## Completed Fixes

- Added shared `updatePaymentSettingsSchema` and `updateBookingSettingsSchema` validators.
- Hardened `app/api/organizations/[id]/payment/route.ts` so payment settings updates are authenticated, organization-scoped, schema-validated, and still require `payment:manage`.
- Hardened `app/api/organizations/[id]/booking-settings/route.ts` so `[id]` routes resolve to the managed organization slug before calling `BookingSettingsService`.
- Clarified `BookingSettingsService` slug-based helper signatures.
- Exposed `PaymentSettings.paymentCondition` in the organization settings UI instead of always writing `false`.
- Added FA/EN/AR dictionary copy for the payment-condition control, with Persian as the primary UX language.
- Added `quality:open-fields-audit` and wired it into `quality:local`.

## Audit Findings

Closed in P96:

- Payment settings had a live public effect through the public order page, but the dashboard always saved `paymentCondition: false`.
- Payment settings route accepted raw request JSON into Prisma.
- Booking settings route was named by organization `[id]`, but it passed that ID directly to a service that uses `organizationSlug`.

Deferred to later phases:

- Full booking-settings dashboard editing for every `BookingSettings` field.
- Full shop/order policy editing for minimum order amount, maximum order amount, delivery radius, pickup/delivery toggles, and notification preferences.
- Notification delivery preferences beyond the existing in-app/Web Push foundations.
- Admin/operator notification dashboard work, which belongs to P103.
- PWA install/offline work, which belongs to P97/P98.
- SMS channel implementation, templates, and rollout runbooks, which belong to P101-P105.

## Validation

```powershell
pnpm run quality:open-fields-audit
pnpm run quality:local
pnpm run typecheck
pnpm run build
```

## Notes

No schema migration was added in P96. The phase intentionally used existing models and fields only.
