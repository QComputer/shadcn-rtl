# BB-B2B-P06 — Conversion Funnel Pages

Generated: 2026-07-06
Project: Bazar Baz / shadcn-rtl

## Goal

Create B2B conversion funnel pages so interested business owners can request a demo, contact Bazar Baz, and understand service packages.

## Pages Created

- `app/[locale]/request-demo/page.tsx` — lead-capture page with safe UI-only form
- `app/[locale]/contact/page.tsx` — business-friendly contact and onboarding page
- `app/[locale]/pricing/page.tsx` — package/pricing explanation page

## Content Source

- `lib/content/b2b-conversion-content.ts` — Persian/English/Arabic conversion copy

## CTA Integration

- Homepage primary CTA (`درخواست دمو`) now links to `/[locale]/request-demo`
- Demo page primary CTA now links to `/[locale]/request-demo`
- Footer links updated to include: نمونه‌ها, تعرفه‌ها, تماس با ما, درخواست دمو

## Safety

- Request-demo form is UI-only with client-side validation
- No API submission in P06
- No real SMS sent
- No production data mutation
- No DB migration added
- No payment/billing implementation

## Next Phase

- **BB-B2B-P07** — Dashboard Showcase and Feature Pages

## Validation

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
