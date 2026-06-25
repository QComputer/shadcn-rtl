# P40 — Dashboard Route-Level Authorization Helper Adoption

Date: 2026-06-25

## Goal

Align manual dashboard route access with the role-aware dashboard sidebar introduced in P38 and the shared route policy extracted in P39.

The sidebar now hides routes that are not useful for the current role. P40 adds a reusable route access decision helper and a dashboard content boundary so a user who manually opens a hidden dashboard route receives a localized access fallback instead of relying only on navigation visibility.

## Changes

- Extended `lib/dashboard/navigation-policy.ts` with route/path helpers:
  - `DashboardRouteKey`
  - `DashboardRouteAccessDecision`
  - `getDashboardRoutePathFromPathname`
  - `routePatternMatches`
  - `getDashboardRouteKey`
  - `getDashboardRouteKeyFromPathname`
  - `getDashboardRouteAccessDecision`
- Added `components/dashboard/dashboard-route-access-boundary.tsx`.
- Wrapped dashboard `children` in `DashboardRouteAccessBoundary` inside `components/dashboard/dashboard-shell.tsx`.
- Added localized FA/EN/AR fallback copy for unauthorized dashboard sections.
- Added `quality:dashboard-route-authorization`.
- Added the P40 validator to `quality:local` / `validate-project`.

## Access behavior

- Authentication is still enforced by `app/[locale]/dashboard/layout.tsx` before the dashboard shell renders.
- The existing `DashboardAccessBoundary` remains in place.
- The new route access boundary uses:
  - current pathname from `usePathname()`;
  - current session role context from `useSession()`;
  - membership-aware role resolution from `getDashboardRoleFromUser()`;
  - route policy matching from `getDashboardRouteAccessDecision()`.
- Allowed routes render normally.
- Disallowed dashboard routes render a localized card and link back to the dashboard overview.
- Unknown dashboard routes are not treated as allowed by the shared helper, so new dashboard pages must be added to `DASHBOARD_ROUTE_POLICY` intentionally.

## Important security note

P40 is a dashboard UI/route-boundary hardening phase. It does not replace page-local server checks, API authorization, ownership checks, tenant checks, or Prisma query scoping. Sensitive data access must remain protected on the server/API side.

## Validation

Run after applying the overlay:

```powershell
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
