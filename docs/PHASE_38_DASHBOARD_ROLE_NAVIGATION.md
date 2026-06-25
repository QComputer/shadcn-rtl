# P38 — Dashboard Sidebar Role-Aware Navigation Cleanup

Date: 2026-06-25

## Goal

Make the shared dashboard sidebar practical for each role without changing route/API authorization rules.

P38 is intentionally a navigation/UI policy phase. It hides irrelevant links from the dashboard sidebar, but it does not grant or revoke route access. Route and API authorization remain owned by the existing dashboard access boundary and server-side guards.

## Updated source

```txt
components/dashboard/dashboard-sidebar.tsx
scripts/quality/validate-dashboard-role-navigation.mjs
scripts/quality/validate-project.mjs
package.json
README.md
docs/CURRENT_SOURCE_OF_TRUTH.md
docs/PHASE_38_DASHBOARD_ROLE_NAVIGATION.md
docs/PHASE_38_OVERLAY_MANIFEST.md
```

## Role-aware navigation policy

The sidebar now centralizes visibility in `ROLE_NAVIGATION_POLICY`.

Current navigation intent:

| Role | Sidebar intent |
| --- | --- |
| `SUPER_ADMIN` | Full navigation, including platform-level `organizations` and `users`. |
| `ADMIN` | Practical organization operations, team/settings, catalog, orders, appointments, calendar, QR, and driver/delivery override entry. |
| `MANAGER` | Practical organization operations and management workflows, including driver/delivery coordination. |
| `STAFF` | Minimal operational/catalog workflows: overview, appointments, calendar, orders, products, and services. |
| `DRIVER` | Minimal driving-focused navigation: overview and driving/delivery. |
| `USER` | Minimal dashboard overview fallback. |

Important preserved behavior:

- `ADMIN` and `MANAGER` still see `driver-orders`, preserving the manual-drive/dispatch override workflow.
- Global platform pages `organizations` and `users` are hidden outside `SUPER_ADMIN` navigation.
- The sidebar still uses the same `DashboardSidebarWithDict` export consumed by the P37 dashboard shell.

## Localization

Sidebar labels are now localized in a typed `roleAwareNavigationCopy` map for:

```txt
fa
en
ar
```

This avoids adding new dashboard shell hardcoding while the broader dashboard copy cleanup remains incremental.

## Validation

Focused validator:

```powershell
pnpm run quality:dashboard-role-navigation
```

Recommended full gate after applying this overlay:

```powershell
pnpm run quality:dashboard-role-navigation
pnpm run quality:dashboard-navigation-copy
pnpm run quality:members-provider-hardening
pnpm run quality:local
pnpm run typecheck
pnpm run build
pnpm run release:stage
pnpm run quality:release-staged
```

## Deferred to P39

P39 should audit route-level access parity against this navigation policy:

1. Confirm every hidden sidebar link still has proper server-side authorization.
2. Confirm no route depends on sidebar visibility for security.
3. Add guardrails for route/navigation parity where practical.
4. Decide whether STAFF should keep catalog edit routes or receive read-only/minimal route handling later.
