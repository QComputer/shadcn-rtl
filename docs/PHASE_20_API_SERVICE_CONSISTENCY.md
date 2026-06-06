# Phase 20 — API Safety and Service Consistency

Date: 2026-06-02

## Goal

Phase 20 hardens backend/API behavior after the production-integrity, SMS-readiness, and dashboard RBAC phases. The focus is to remove unsafe route semantics, make service writes more atomic, reduce data leakage from generic errors, and close several order/organization consistency bugs found during the project inspection.

## Scope

### API route safety

- `app/api/orders/[id]/driver/route.ts`
  - Removed the unsafe `GET -> POST` compatibility alias.
  - `GET` now returns HTTP `405` with an `Allow` header.
  - Driver accept remains `POST` only.
  - Driver deny remains `DELETE`.
  - Driver restore-denied remains `PATCH`.
- `app/api/organizations/open/route.ts`
  - `GET` is now read-only and returns the current open state.
  - Open/close mutation remains in `POST` only.
- `app/api/orders/[id]/route.ts`
  - Status updates use safe schema parsing.
  - Estimated-end-time updates use the dedicated schema and now require an ISO datetime.
  - Generic errors use the shared sanitized JSON error helper.

### Registration and organization creation consistency

- `app/api/auth/register/route.ts`
  - `organizationService.applyAsMember(...)` is now awaited so membership application failures are not silent.
- `app/api/auth/register/organization/route.ts`
  - Organization registration is now transactional.
  - User, organization, organization settings, payment settings, and admin membership are created in one transaction.
  - The response includes both the corrected `member` key and the old misspelled `memeber` key for backwards compatibility.
- `lib/services/organization.service.ts`
  - `create()` and `createByUser()` are transactional.
  - `addMember()` now rejects a missing organization instead of writing a fake fallback slug.
  - Business-hour fanout waits for all staff updates.
  - Staff business-hour deletes are scoped by `organizationId + userId` so a multi-organization staff member does not lose hours in other organizations.

### Order/cart consistency

- `lib/services/order.service.ts`
  - Delivery fee calculation now uses `OrganizationSettings.deliveryFee` instead of `deliveryRadius ? 20000 : 0`.
  - Driver order listing now scopes assigned orders to the current driver.
  - Available driver orders are limited to unassigned orders in delivery-progress statuses and exclude orders the driver has denied.
  - Pseudo-status filtering such as `DENIED` is rejected rather than treated like a Prisma `OrderStatus`.
- `lib/services/cart.service.ts`
  - Cart summary delivery fee now uses `OrganizationSettings.deliveryFee`.
- Organization settings validation now accepts `deliveryFee`, so the value used by checkout/cart can be managed safely.
- `lib/types.ts` and `lib/validators/index.ts`
  - Public `OrderStatus` type and order filters now include `CANCELLED` to match Prisma.
  - Estimated-end-time schema requires ISO datetime input.

### Error handling

- `lib/api-guards.ts`
  - `jsonError()` keeps explicit `ApiError` messages.
  - Non-`ApiError` 5xx responses now return the fallback message instead of raw internal error text.
  - Service errors mapped to 4xx can still return useful client-safe messages.

## Validation

New validator:

```bash
node scripts/quality/validate-api-service-safety.mjs
```

Updated aggregate validator:

```bash
node scripts/quality/validate-project.mjs
```

Recommended full local gate after applying the overlay:

```bash
npm run db:generate
npm run db:validate
node scripts/quality/validate-env.mjs
node scripts/quality/validate-dashboard-access.mjs
node scripts/quality/validate-api-service-safety.mjs
node scripts/quality/validate-project.mjs
npm run typecheck
npm run lint
npm run build
```

## Known remaining work

Phase 20 intentionally does not perform the deeper tenant-model migration. The app still has mixed `organizationId` and `organizationSlug` relationships in several models. That belongs in the next architecture/data phase because it requires Prisma migration planning and more workflow regression coverage.

Recommended next phase:

```txt
P21 — Tenant Model Cleanup and Multi-Tenant Data Consistency
```
