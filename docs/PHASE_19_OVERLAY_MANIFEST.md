# Phase 19 Overlay Manifest

## Scope

Documentation and code overlay for RBAC/auth/dashboard access hardening.

## Changed files

```txt
app/[locale]/dashboard/layout.tsx
components/dashboard/dashboard-access-boundary.tsx
components/dashboard/dashboard-shell.tsx
components/dashboard/dashboard-sidebar.tsx
components/providers.tsx
hooks/use-auth.tsx
lib/access-control.ts
scripts/quality/validate-dashboard-access.mjs
docs/PHASE_19_RBAC_AUTH_DASHBOARD_ACCESS.md
docs/PHASE_19_OVERLAY_MANIFEST.md
README.md
```

## Safety notes

- This overlay does not include `.env`, local databases, uploads, or secrets.
- SMS remains dry-run safe by default from Phase 18.
- Dashboard access is now authenticated server-side and policy-checked client-side.
- API route authorization still remains a separate server-side responsibility.

## Validation performed in the generation environment

```bash
node --check scripts/quality/validate-dashboard-access.mjs
node scripts/quality/validate-dashboard-access.mjs
node scripts/quality/validate-project.mjs
```

## Validation not performed in the generation environment

The generation environment did not have `node_modules`, so these still need to run locally:

```bash
npm ci
npm run db:generate
npm run db:validate
npm run typecheck
npm run lint
npm run build
```
