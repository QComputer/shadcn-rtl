# Phase 60 — Super Admin Shop Domain Management

## Goal

Custom-domain management is now a platform-admin workflow. Organization admins, managers, and staff must not be able to attach or change custom domains. Only `SUPER_ADMIN` can connect a domain to a shop, reassign it, mark it primary, change status, or remove it.

## Added

- `app/[locale]/dashboard/shop-domains/page.tsx`
  - Server-side SUPER_ADMIN gate.
  - Redirects non-super-admin users back to dashboard.
- `components/dashboard/shop-domain-manager.tsx`
  - Central UI for listing shops/domains.
  - Add domain and choose target shop.
  - Reassign a domain to a different shop.
  - Change domain status.
  - Set primary domain.
  - Remove domain.
- `app/api/dashboard/shop-domains/route.ts`
  - SUPER_ADMIN-only central domain API.
  - `GET`, `POST`, `PATCH`, `DELETE`.
- `lib/shop-domain-admin.ts`
  - Domain input validation.
  - SUPER_ADMIN helper.
  - Shared schemas.
- Navigation/access updates:
  - `/dashboard/shop-domains` added to route policy.
  - Sidebar item added under platform admin.
- Existing `app/api/organizations/[id]/domains/route.ts` tightened to SUPER_ADMIN only.

## Manual Vercel step remains

This phase intentionally does not automate Vercel domain provisioning yet. After connecting a domain in the dashboard, the platform admin still adds the same domain in Vercel and gives the customer the DNS records.

## Validation

```powershell
pnpm quality:shop-domain-admin
pnpm quality:shop-custom-domains
pnpm typecheck
pnpm build
```
