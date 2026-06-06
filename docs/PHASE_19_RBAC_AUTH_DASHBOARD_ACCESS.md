# Phase 19 — RBAC, Auth, and Dashboard Access Hardening

## Purpose

Phase 19 turns dashboard access control from a partly implicit, client-page-by-page pattern into a more explicit RBAC boundary.

The previous implementation had three high-risk traits:

1. stale access-control entries for dashboard pages that no longer existed;
2. real dashboard pages that were missing explicit policies;
3. broad parent-route fallback that allowed unknown dashboard children to inherit `/dashboard` access.

## Implemented changes

### Server-side dashboard authentication gate

`app/[locale]/dashboard/layout.tsx` is now a server component. It calls `auth()` before rendering the dashboard shell and redirects unauthenticated users to the locale-aware login page.

### Client-side role/org dashboard boundary

`components/dashboard/dashboard-access-boundary.tsx` applies route-level RBAC checks around the full dashboard shell. This catches dashboard pages that do not call `useDashboardAccess()` individually.

### Explicit dashboard route registry

`lib/access-control.ts` was rewritten around explicit route policies for every real dashboard `page.tsx`, including dynamic routes such as:

- `/dashboard/products/[id]`
- `/dashboard/services/[id]`
- `/dashboard/appointments/[id]`
- `/dashboard/appointments/[id]/edit`

Unknown dashboard children now deny by default instead of inheriting `/dashboard`.

### Auth provider cleanup

`components/providers.tsx` now contains exactly one `SessionProvider`, and `hooks/use-auth.tsx` no longer has duplicated interface declarations.

### Locale-aware redirects

Auth redirects now preserve the active locale for login, logout, protected-route redirects, and dashboard access redirects.

### Navigation cleanup

Dashboard navigation was aligned with the real dashboard route registry. Stale items such as `/dashboard/my-appointments`, `/dashboard/my-services`, and `/dashboard/customers` were removed from the access registry. Icon names were normalized to existing Lucide exports.

## Validation

Run:

```bash
node scripts/quality/validate-dashboard-access.mjs
node scripts/quality/validate-project.mjs
```

Full release validation still requires dependencies:

```bash
npm ci
npm run db:generate
npm run db:validate
npm run typecheck
npm run lint
npm run build
```

## Remaining follow-up

This phase improves dashboard auth and route policy structure, but it does not replace server-side authorization in API routes. Every sensitive API route must continue using `lib/api-guards.ts` or equivalent server-side checks.

Next recommended phase: **Phase 20 — API Safety and Service Consistency**.
