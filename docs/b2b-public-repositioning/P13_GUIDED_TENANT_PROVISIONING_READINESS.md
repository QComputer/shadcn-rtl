# BB-B2B-P13 - Guided Tenant Provisioning Readiness

Date: 2026-07-15

## Goal

P13 adds a SUPER_ADMIN-only readiness workflow that turns an eligible request-demo/onboarding lead into a reviewable tenant-provisioning plan.

This phase does not execute provisioning.

## Implemented

- `TenantProvisioningPlanStatus` and `TenantProvisioningSourceType` enums.
- `TenantProvisioningPlan` model linked to `RequestDemoLead`.
- Idempotent plan creation from a source lead.
- Deterministic SHOP/APPOINTMENT recommendation and mixed-input `NEEDS_REVIEW` handling.
- Proposed slug, locale, timezone, package intent, modules, feature flags, settings, owner contact, demo-content preference, and custom-domain intent.
- SUPER_ADMIN dashboard APIs for list, create, read, edit, validate, mark-ready, approve, return-for-review, and cancel.
- Mutation-free dry-run validation that stores structured safe results.
- Dashboard UI at `/[locale]/dashboard/tenant-provisioning`.
- Lead launcher at `/[locale]/dashboard/request-demo-leads/[leadId]/provisioning`.
- P13 quality validator.

## Explicitly Not Implemented

- Organization creation.
- User creation.
- Membership creation.
- Subscription or billing creation.
- Invitation creation.
- SMS, email, Web Push, or CRM side effects.
- Payment actions.
- Custom-domain provider mutation.
- Execution endpoint.

## Production State

P13 adds a new Prisma migration:

`prisma/migrations/20260715000100_tenant_provisioning_readiness/migration.sql`

The migration is additive. It must be applied to production only after explicit authorization.
