# P41 — Dashboard Unauthorized-State Polish and Route Guard Smoke Tests

Date: 2026-06-25

## Scope

P41 builds on P40 without changing route permissions. The shared dashboard route policy remains the source of truth; this phase improves the fallback shown when a user manually opens a dashboard route that is hidden for their role and adds a focused static smoke validator for representative route-guard expectations.

## Runtime changes

- `DashboardRouteAccessBoundary` now focuses the fallback panel when an unauthorized dashboard route is rendered.
- Unauthorized fallback uses alert semantics with `aria-labelledby` and `aria-describedby`.
- Fallback copy remains localized for `fa`, `en`, and `ar`.
- The fallback now shows:
  - the current resolved access role;
  - the requested dashboard route;
  - a localized explanation that server pages and APIs still enforce data access independently.
- The loading state is more polished and uses a small card-style status region.
- The return action still points to the localized dashboard overview.

## Guardrail changes

Added:

```powershell
pnpm run quality:dashboard-route-guard-smoke
```

The validator checks that:

- P40 route decision helper remains available;
- unknown dashboard routes remain denied by default;
- dynamic route matching remains enabled;
- representative route policy expectations remain intact;
- unauthorized fallback keeps focus, alert, and accessible description semantics;
- FA/EN/AR fallback copy is retained;
- the dashboard shell still wraps children with `DashboardRouteAccessBoundary`.

## Representative smoke expectations

- `SUPER_ADMIN` remains the only role with global `/users` access.
- `ADMIN`, `MANAGER`, and `DRIVER` can still reach `/driver-orders`.
- Driver/manual-drive override is preserved for admin/manager workflows.
- Staff can still access operational product pages.
- Product category management remains management-only.
- Dynamic product detail routes still map to the product policy.

## Validation

Run after applying this overlay:

```powershell
pnpm run quality:dashboard-route-guard-smoke
pnpm run quality:dashboard-route-authorization
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

## Notes

This is still a client-side dashboard content boundary. It improves UX and prevents visible misuse of hidden dashboard routes, but it is not a substitute for server-side page/API authorization. P42 should audit server/API guard parity for high-risk dashboard data routes.
