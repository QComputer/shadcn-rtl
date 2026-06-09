# Phase 24 — Tenant Identity Audit and Guardrails

Date: 2026-06-09

## Goal

P24 is a narrow stabilization phase. It prevents high-risk confusion between tenant identity fields before deeper tenant refactoring begins.

Canonical direction:

- `organizationId` means `Organization.id`.
- `organizationSlug` means `Organization.slug`.
- Public routes may accept slug, but internal authorization and relational selectors should resolve the organization first and then use `id` for id-keyed models.
- Slug-keyed legacy/settings models must receive a real slug, not a variable named or populated as an id.

## Source fixes

### Driver order acceptance

File:

```txt
lib/services/order.service.ts
```

Fixes:

- Resolves the order organization by `order.organizationSlug`.
- Uses `organization.id` for `Follow.customerId_organizationId.organizationId`.
- Uses both `organizationId: organization.id` and `organizationSlug: organization.slug` for membership access checks.

This removes the high-risk anti-pattern where an organization slug was passed into a field named `organizationId`.

### Notification settings lookup

File:

```txt
lib/services/notification.service.ts
```

Fixes:

- Appointment notification callers pass `organizationId`.
- `OrganizationSettings` is still keyed by `organizationSlug`.
- The notification service now resolves organization id to slug before reading settings.

## New guardrail

File:

```txt
scripts/quality/validate-tenant-identity.mjs
```

Command:

```bash
pnpm run quality:tenant-identity
```

The validator blocks known high-risk patterns:

- assigning `organizationSlug` to `organizationId`
- querying `organizationSlug` with a variable named `organizationId`
- passing `organizationSlug` to `customerId_organizationId.organizationId`

The validator is also included in `quality:local` through `scripts/quality/validate-project.mjs`.

## Validation

Required target validation:

```bash
pnpm run quality:tenant-identity
pnpm run typecheck
pnpm run build
pnpm run quality:local
```

## Known remaining tenant work

P24 does not convert the full data model. Remaining future work:

- Inventory all slug-keyed models such as `Cart`, `Order`, `OrganizationSettings`, and `PaymentSettings`.
- Decide whether each should remain slug-keyed for public compatibility or migrate to id-keyed relations.
- Add safe migrations/backfills before changing persisted keys.
- Expand authorization tests for users with multiple organization memberships.
