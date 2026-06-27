# Phase 62 — Published SUPER_ADMIN Organizations Dashboard

This overlay publishes `/[locale]/dashboard/organizations` as a real platform-admin page instead of the old legacy client-side placeholder.

## Scope

- Replaces the old TODO/client organizations page with a server-rendered SUPER_ADMIN-only page.
- Uses direct Prisma reads instead of client-side `/api/organizations` fetches.
- Adds search, type/status filters, pagination, organization stats, domain stats, and links to public pages/domain management.
- Hardens `/api/organizations` so list/create operations are SUPER_ADMIN-only.
- Adds a focused validator.

## Apply

```powershell
Expand-Archive -Path .\bazar-baz-phase62-dashboard-organizations-published-overlay.zip -DestinationPath . -Force
node scripts/setup-register-dashboard-organizations-package-scripts.mjs
pnpm run quality:dashboard-organizations-published
pnpm typecheck
pnpm build
```

## Route

```txt
/fa/dashboard/organizations
/en/dashboard/organizations
/ar/dashboard/organizations
```

The unlocalized path `/dashboard/organizations` is still handled by the existing locale proxy and redirects to the current/default locale.

## Access policy

Only `SUPER_ADMIN` can access the page and the list/create organization API.
