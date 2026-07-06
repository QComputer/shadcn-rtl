# BB-B2B-P07 — Dashboard Showcase and Feature Pages

Generated: 2026-07-06
Project: Bazar Baz / shadcn-rtl

## Goal

Create public B2B feature/showcase pages that explain the Bazar Baz dashboard and platform capabilities in detail for business owners.

## Pages Created

- `app/[locale]/features/page.tsx` — public feature page explaining all 9 capability groups
- `app/[locale]/dashboard-showcase/page.tsx` — public dashboard showcase page explaining workflows and safety

## Content Source

- `lib/content/b2b-feature-pages-content.ts` — Persian-first feature and dashboard showcase copy with safe EN/AR fallbacks

## Navigation Integration

- Homepage added "مشاهده همه امکانات" link to `/features` and "داشبورد مدیریتی" link to `/dashboard-showcase`
- Demo page links to `/features` and `/dashboard-showcase`
- Pricing page links to `/features`
- Request-demo page links to `/features` and `/dashboard-showcase`
- Contact page links to `/features`

## Safety

- All content is public marketing/documentation UI only
- No private dashboard data exposed
- No real screenshots or production data used
- No SMS/Web Push side effects
- No production data mutation

## Next Phase

- **BB-B2B-P08** — SEO, Trust, Legal, Analytics Hardening

## Validation

- `pnpm run quality:b2b-dashboard-showcase`
- `pnpm run quality:b2b-conversion-funnel`
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
