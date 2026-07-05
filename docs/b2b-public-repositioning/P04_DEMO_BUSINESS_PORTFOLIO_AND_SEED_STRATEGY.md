# BB-B2B-P04 — Demo Business Portfolio and Seed Strategy

Generated: 2026-07-06
Project: Bazar Baz / shadcn-rtl

## Goal

Create curated demo businesses for industries instead of public marketplace browsing, and define a safe, dry-run-first seed strategy.

## Demo Registry

- `lib/content/b2b-demo-businesses.ts` — single source of truth for demo portfolio content.
- 8 demo business types defined with stable IDs, Persian titles, descriptions, workflows, and capability mappings.

## Demo Portfolio Page

- Route: `app/[locale]/demo/page.tsx`
- Persian-first and RTL.
- Explains that examples are demos for business owners, not a public marketplace.
- Groups demos by industry/use case.
- Includes CTAs to request demo and dashboard login.
- No generic discovery wording.

## Seed Strategy

- Demo data is static/registry-based by default in P04.
- If a seed script is added later, it must follow the rules in `docs/b2b-public-repositioning/DEMO_SEED_SAFETY_POLICY.md`.
- Production writes require explicit env gates and manual acknowledgement.
- No real SMS, no real payments, no real customer personal data.

## Out of Scope

- Do not expose all real shops publicly.
- Do not seed real customer data.
- Do not break existing seed.
- Do not require production destructive seeding.
- Do not start Creative Studio.
- Do not restrict marketplace APIs yet (P05).

## Next Phase

- **BB-B2B-P05** — Public Discovery Restriction and Demo-Only APIs

## Validation

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
