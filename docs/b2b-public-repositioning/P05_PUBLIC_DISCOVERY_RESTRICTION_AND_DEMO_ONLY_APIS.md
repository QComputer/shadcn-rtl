# BB-B2B-P05 — Public Discovery Restriction and Demo-Only APIs

Generated: 2026-07-06
Project: Bazar Baz / shadcn-rtl

## Goal

Restrict marketplace-like public discovery behavior and convert public-facing discovery to a B2B-safe demo/example model.

## Public Discovery Routes and APIs Inspected

- `app/[locale]/page.tsx` — B2B landing page, no marketplace listing or search widget present.
- `app/[locale]/demo/page.tsx` — official demo portfolio page.
- `app/api/public/search` — broad public search API. Not linked from B2B homepage or navigation. Rate-limited. Not a tenant-scoped direct route.
- `app/api/public/organizations` — broad public organization listing API. Not linked from B2B homepage or navigation. Used only by tenant-scoped direct pages (by slug) for public data.
- No standalone global discovery pages exist under `app/[locale]/shops`, `app/[locale]/search`, `app/[locale]/organizations`, `app/[locale]/products`, or `app/[locale]/services`.

## Restriction Strategy

- Homepage/navigation: already B2B-safe. No links to global marketplace discovery or broad search.
- Public APIs: `/api/public/search` and `/api/public/organizations` remain available for tenant-scoped page compatibility but are not promoted as marketplace features. They are classified as `MARKETPLACE_DISCOVERY` in the route policy.
- Demo portfolio: `app/[locale]/demo/page.tsx` is the official public example surface.
- Tenant direct pages: preserved without change.
- Customer flows: checkout, booking, order tracking preserved.

## SEO/Indexing

- `app/robots.ts` already disallows `/api/` paths.
- `app/sitemap.ts` includes tenant direct pages by slug/domain but excluded custom-domain shops from platform sitemap.
- Demo page is indexable as a B2B example surface.

## Next Phase

- **BB-B2B-P06** — Conversion Funnel Pages

## Validation

- `pnpm run quality:b2b-public-discovery-restriction`
- `pnpm run quality:b2b-demo-business-portfolio`
- `pnpm run quality:b2b-homepage-landing`
- `pnpm run quality:b2b-persian-content-architecture`
- `pnpm run quality:b2b-public-route-policy`
- `pnpm run quality:source-baseline`
- `pnpm run db:generate`
- `pnpm run db:validate`
- `pnpm run typecheck`
- `pnpm run build`
- `git diff --check`
