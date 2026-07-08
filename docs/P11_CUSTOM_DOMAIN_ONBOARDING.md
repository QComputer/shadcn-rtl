# BB-B2B-P11 — Tenant Custom-domain Onboarding Flow

## Scope
Enable authorized businesses to connect custom domains to their tenant experience with secure routing, provider integration, and dashboard management.

## What Changed

### Prisma / Database
- Added `DomainKind` (`APEX`, `SUBDOMAIN`) and `DomainProvider` (`VERCEL`) enums.
- Extended `DomainStatus` with `REQUESTED`, `PROVIDER_PENDING`, `ERROR`, `REMOVAL_PENDING`, `REMOVED`.
- Extended `OrganizationDomain` with onboarding PII / lifecycle fields (kind, provider, verification, timestamps, audit user refs, soft delete).

### Server
- New domain normalization utility (`lib/domains/domain-normalization.server.ts`).
- P11 safety gates added to `lib/vercel-domain-automation.ts` (`assertVercelDomainMutationAllowed`).
- Dashboard APIs:
  - `GET/POST /api/dashboard/organization-domains`
  - `POST /api/dashboard/organization-domains/[id]/vercel`
  - `GET /api/dashboard/organization-domains/vercel-automation`

### Proxy / Routing
- Proxy now routes both `SHOP` and `APPOINTMENT` custom domains.
- Domain resolver returns `organizationType` so proxy can dispatch correctly.

### SEO
- `lib/custom-domain-seo.ts` generalized to `getTenantSeoContext(organizationType)`.

## Constraints
- Provider mutations disabled by default; explicit acknowledgment gate (`CUSTOM_DOMAIN_REAL_MUTATION_ENABLED=true`) required.
- Do not expose Vercel token.
- Do not assign/remove real production domains without explicit authorization.
- Legacy validators preserved.

## Rollback
See `docs/P11_ROLLBACK_POLICY.md`.
