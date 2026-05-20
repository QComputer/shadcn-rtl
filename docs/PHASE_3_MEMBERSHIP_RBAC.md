# Phase 3 — Membership Roles and Multi-Organization Groundwork

Phase 3 moves the project closer to production-grade multi-tenant RBAC by adding organization-scoped membership roles and removing the one-user/one-organization schema restriction.

## What changed

- `OrganizationMember.role` was added as an organization-scoped role.
- `OrganizationMember.userId @unique` was removed from the Prisma schema so a user can belong to more than one organization.
- `User.memberOf` is now a list relation in Prisma.
- API responses that the current dashboard expects still expose a backward-compatible `memberOf` value containing the first active membership, plus `memberships` for the full list.
- Server-side organization access guards now prefer `OrganizationMember.role` and fall back to global `User.role` only for compatibility during the transition.
- Organization member creation stores the membership role in `OrganizationMember.role`.
- Organization member role updates now update `OrganizationMember.role` instead of treating global `User.role` as the only source of truth.
- `/dashboard/users` member activation now calls the correct plural `/api/organizations/...` endpoint and handles users without memberships more safely.

## Database migration

A Prisma migration was added:

```text
prisma/migrations/20260520220000_phase3_membership_roles/migration.sql
```

It performs these operations:

1. Adds `OrganizationMember.role` with default `STAFF`.
2. Backfills membership roles from the existing global `User.role` where possible.
3. Drops the old unique constraint on `OrganizationMember.userId`.
4. Adds an index on `(userId, organizationId)`.

Deploy normally with your existing Prisma migration flow. If your deployment currently uses `prisma generate` only, apply the migration to the database before relying on multi-organization membership.

## Backward compatibility notes

The code still keeps global `User.role` for compatibility with existing UI and session logic. The production direction is:

- `User.role` should eventually become only a global platform role, mainly `SUPER_ADMIN` vs normal user.
- Organization permissions should come from `OrganizationMember.role`.
- Dashboard APIs should continue moving toward membership-role checks.

## Deployed E2E smoke test without Playwright

Run this after deployment:

```bash
DEPLOYED_URL=https://your-domain.example npm run e2e:deployed:phase3
```

The script uses Node's built-in `fetch`; it does not require Playwright.

It checks:

- Homepage reachability.
- Public search still responds.
- Unauthenticated user and membership APIs are blocked.
- Unauthenticated organization member reads/mutations are blocked.

## Remaining RBAC work

- Migrate all dashboard UI role assumptions to membership roles.
- Add authenticated smoke tests using seeded credentials.
- Remove global-role permissions from regular organization workflows.
- Add audit logs for member role and activation changes.
