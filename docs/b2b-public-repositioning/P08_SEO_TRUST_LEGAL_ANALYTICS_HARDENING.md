# BB-B2B-P08 — SEO, Trust, Legal, Analytics Hardening

Generated: 2026-07-06
Project: Bazar Baz / shadcn-rtl

## Goal

Harden the public B2B surface for SEO, trust, legal clarity, metadata, indexing policy, and analytics readiness.

## Pages Created

- `app/[locale]/trust/page.tsx` — trust, security, and data ownership page
- `app/[locale]/privacy/page.tsx` — privacy notice page
- `app/[locale]/terms/page.tsx` — terms of service page

## Content Source

- `lib/content/b2b-legal-content.ts` — Persian-first trust/privacy/terms copy with safe EN/AR fallbacks

## Navigation Integration

- Footer updated with links to: امکانات, داشبورد, نمونه‌ها, تعرفه‌ها, تماس, درخواست دمو, اعتماد, حریم خصوصی, شرایط استفاده
- Trust page links to request-demo and demo
- Privacy page links to contact and terms
- Terms page links to contact and privacy

## SEO/Indexing

- Public B2B pages remain indexable with strong Persian B2B metadata
- Marketplace-like discovery endpoints remain restricted per P05
- Tenant direct pages preserved and not blocked by robots/sitemap
- No private dashboard APIs exposed in sitemap

## Trust/Legal

- Trust page explains B2B positioning, data ownership, RBAC, SMS safety, demo-only examples
- Privacy page explains data processing categories, purpose, ownership, security, and user rights
- Terms page explains business service platform nature, prohibited uses, demo examples, and platform changes
- All legal pages include drafting disclaimers stating they are not final legal documents
- No unsupported security certification claims or legal compliance guarantees

## Analytics

- Analytics/privacy measurement policy created at `docs/b2b-public-repositioning/ANALYTICS_AND_PRIVACY_MEASUREMENT_POLICY.md`
- Analytics is disabled by default / policy-only
- No third-party analytics scripts added without explicit env gate
- No PII/full phone collection in analytics policy
- No secrets exposed to public code

## Safety

- All content is public marketing/documentation UI only
- No private dashboard data exposed
- No real screenshots or production data used
- No SMS/Web Push side effects
- No production data mutation
- No real billing/payment implementation

## Next Phase

- **BB-B2B-P09** — Deployed Acceptance and Handoff

## Validation

- `pnpm run quality:b2b-seo-trust-legal`
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
