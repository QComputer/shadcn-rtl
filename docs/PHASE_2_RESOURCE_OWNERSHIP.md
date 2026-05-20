# Phase 2 — Dashboard Resource Ownership and API Scoping

## Goal

Phase 2 hardens dashboard-facing APIs so resource access is enforced on the server side, not only through frontend dashboard navigation.

The main production risk addressed here is cross-organization access, for example:

- An admin from organization A updating a product from organization B.
- A manager creating a service under another organization.
- A staff member reading or mutating appointments outside their assigned provider scope.
- A non-super-admin passing an arbitrary `organizationId` query parameter to dashboard list APIs.

## Updated API areas

Phase 2 updated these areas:

- Products
- Product variants
- Product categories
- Services
- Service categories
- Orders
- Appointments
- API guard helpers

## Server-side guard improvements

`lib/api-guards.ts` now includes helpers for resource ownership checks:

- `requireCurrentOrganizationId()`
- `requireOrgManageAccessById()`
- `requireOrgManageAccessBySlug()`
- `requireProductAccess()`
- `requireProductCategoryAccess()`
- `requireServiceAccess()`
- `requireServiceCategoryAccess()`
- `requireOrderAccess()`
- `requireAppointmentAccess()`

These helpers check authentication, role, active organization membership, and resource ownership before allowing mutations.

## Dashboard API behavior after Phase 2

### Non-super-admin users

Non-super-admin users can only operate inside their active organization membership.

If a request includes an `organizationId` that does not match the caller's active organization membership, the API returns `403`.

### Super admin users

Super admins can access all organizations, but create APIs require an explicit `organizationId` when an organization context cannot be inferred.

### Staff users

Staff access is narrower:

- Staff may read service/appointment resources only when membership and provider scoping allow it.
- Staff cannot manage products, product categories, or service categories through the protected dashboard mutation APIs.

## Service integrity checks

Service create/update now validates that:

- The selected category belongs to the same organization.
- The selected service provider is an active member of the same organization.

## Product category listing fix

A bug in the product category service caused super-admin product category listing to query `serviceCategory` instead of `productCategory`. This was fixed.

## No-Playwright deployed E2E smoke test

Phase 2 adds:

```bash
scripts/e2e/deployed-phase2-resource-ownership.mjs
```

Run it with:

```bash
DEPLOYED_URL=https://your-domain.example npm run e2e:deployed:phase2
```

The test verifies that important resource mutation APIs are blocked without authentication and that public read surfaces still work.

## Limitations

Phase 2 does not yet solve the deeper schema-level tenancy limitations:

- `User.role` is still global.
- `OrganizationMember.userId` is still unique.
- Organization-specific roles should eventually move to `OrganizationMember.role`.
- Authenticated cross-organization tests require seeded users or an API-login test harness, which is planned for a later phase.

## Recommended next phase

Phase 3 should address schema and dashboard data model correctness:

1. Add `OrganizationMember.role`.
2. Remove `OrganizationMember.userId @unique`.
3. Update RBAC to use membership role instead of global user role for organization actions.
4. Update dashboard pages and APIs to use current organization context explicitly.
5. Add authenticated deployed smoke tests with seeded credentials.

## Phase 2 build hotfix

After the first Phase 2 package, the production build reached TypeScript and failed because the `SessionWithUser` helper type was inferred from the overloaded NextAuth `auth` function. In NextAuth v5, `auth` can also be used as middleware, so `ReturnType<typeof auth>` can be inferred as a middleware-shaped type in some build contexts.

The hotfix replaces that inferred helper with an explicit session shape and makes `requireAuthSession()` return `Promise<SessionWithUser>`. This keeps the API guard call sites type-safe and avoids the `Session is not assignable to NextMiddleware` build error.

### Phase 2 build hotfix 2

Fixed remaining NextAuth `auth()` overload typing issues by replacing `Awaited<ReturnType<typeof auth>>` route helper signatures with the explicit `SessionWithUser` type from `lib/api-guards.ts`. This resolves TypeScript build failures in organization-member and user-management API routes.


## Phase 2 Build Hotfix 3 — Session type consistency

Fixed the remaining TypeScript build error in `app/api/organizations/[id]/members/route.ts` by replacing raw `auth()` session usage with `requireAuthSession()`. This prevents NextAuth v5's overloaded `auth()` type from being treated as middleware or as a partially optional `Session` when passed to Phase 2 API guard helpers.

Validation performed before packaging:

- Searched the API tree for remaining `Awaited<ReturnType<typeof auth>>` usages: none remain in source code.
- Searched all Phase 2 guard call sites for raw `auth()` sessions being passed into `SessionWithUser` guard helpers.
- Confirmed the organization-members route now uses `requireAuthSession()` for both GET and POST.


## Build hotfix 4 — NextAuth session typing

The Phase 2 API guards now avoid casting a raw NextAuth `Session` directly to the internal `SessionWithUser` type. `requireAuthSession()` validates the required session fields and returns a normalized session object. This prevents TypeScript build failures caused by NextAuth v5's overloaded `auth()` helper and strict object-cast checks.

Validation performed before packaging:

- Removed remaining `ReturnType<typeof auth>` / direct `SessionWithUser` cast patterns from source files.
- Replaced the product-variant helper's inferred `requireAuthSession()` return type with explicit `SessionWithUser`.
- Transpiled/parsing-checked all TypeScript and TSX files under `app`, `lib`, `components`, `hooks`, and `scripts` with the TypeScript compiler API.

