# Phase 39 — Dashboard route access/navigation parity audit

Date: 2026-06-25

## Purpose

P38 made the dashboard sidebar role-aware, but the policy lived inside the sidebar component. P39 moves the policy into a pure shared module and adds a validator that compares sidebar-visible routes, nested dashboard routes, and dashboard auth/access guard placement.

This phase is intentionally conservative: it does **not** change route permissions or API authorization. It creates a reusable source of truth for follow-up route-level authorization hardening.

## Changes

- Added `lib/dashboard/navigation-policy.ts`.
- Moved dashboard navigation hrefs and role visibility into shared constants:
  - `DASHBOARD_NAVIGATION_ITEMS`
  - `DASHBOARD_NAVIGATION_GROUPS`
  - `ROLE_NAVIGATION_POLICY`
  - `DASHBOARD_ROUTE_POLICY`
- Added helper functions:
  - `normalizeDashboardRole`
  - `getDashboardRoleFromUser`
  - `isDashboardNavigationItemVisible`
  - `isDashboardRouteAllowed`
  - `getDashboardHref`
- Updated `components/dashboard/dashboard-sidebar.tsx` to consume the shared policy module instead of keeping role policy inline.
- Updated the P38 validator so it accepts the extracted policy source.
- Added `scripts/quality/validate-dashboard-route-parity.mjs`.
- Added `quality:dashboard-route-parity` to `package.json`.
- Added P39 to `scripts/quality/validate-project.mjs`.
- Updated README and source-of-truth docs.

## Validator coverage

`pnpm run quality:dashboard-route-parity` checks:

1. Shared policy module exists.
2. Sidebar consumes the shared policy module.
3. Sidebar hrefs come from `DASHBOARD_NAVIGATION_ITEMS`.
4. Dashboard layout still authenticates via `auth()`.
5. Dashboard layout still redirects unauthenticated users to localized login.
6. Dashboard shell still wraps content in `DashboardAccessBoundary`.
7. Every sidebar navigation route maps to a real dashboard page file.
8. Nested dashboard pages are covered by parent route policies.
9. Driver route access preserves ADMIN/MANAGER manual-drive override and DRIVER access.
10. Platform-only organization/user navigation remains SUPER_ADMIN-only.

## Out of scope

- No route behavior changes.
- No API authorization changes.
- No new middleware.
- No UX redesign.
- No permission denial screen changes.

## Validation

Run after applying the overlay:

```powershell
pnpm run quality:dashboard-route-parity
pnpm run quality:dashboard-role-navigation
pnpm run quality:dashboard-navigation-copy
pnpm run quality:members-provider-hardening
pnpm run quality:local
pnpm run typecheck
pnpm run build
pnpm run release:stage
pnpm run quality:release-staged
```

## Next phase

Recommended next phase: P40 — dashboard route-level authorization helper adoption.

P40 should use the shared policy module carefully, while preserving the distinction between navigation visibility and actual route/API authorization.
