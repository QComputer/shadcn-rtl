# B2B Repositioning Final Report

Generated: 2026-07-06
Project: Bazar Baz / shadcn-rtl
Production domain: https://www.bazar-baz.ir
Latest accepted commit: `b35032f` (BB-B2B-P08); P09 docs/script commit follows.

## 1. What changed across P00–P09

| Phase | Outcome |
| --- | --- |
| P00 | B2B repositioning baseline: route policy, decision matrix, public surface audit. |
| P01 | Public surface policy and route audit with marketplace discovery restriction plan. |
| P02 | Persian B2B content architecture (`lib/content/b2b-homepage-content.ts`, feature messaging, demo messaging). |
| P03 | Persian-first B2B homepage landing replacing marketplace-style homepage. |
| P04 | Curated demo business portfolio and seed strategy with explicit demo labels and dry-run safety. |
| P05 | Public discovery restriction and demo-only API policy; tenant direct pages preserved. |
| P06 | Conversion funnel pages: request-demo, contact, pricing. |
| P07 | Feature pages (`/features`) and dashboard showcase (`/dashboard-showcase`). |
| P08 | SEO/trust/legal/analytics hardening: `/trust`, `/privacy`, `/terms`, footer links, analytics policy. |
| P09 | Deployed acceptance: HTTP production smoke, full B2B validator run, handoff docs. |

## 2. Current public positioning

Bazar Baz is a **B2B service platform for Iranian businesses**:
- not a consumer marketplace
- not an ad directory
- not a public social network
- business management + customer communication + commerce + appointments + customer club + SMS/Web Push + campaigns
- demo businesses are controlled examples, not public marketplace listings

## 3. Current public pages

- `/[locale]` — B2B homepage
- `/[locale]/demo` — demo business portfolio
- `/[locale]/features` — feature pages
- `/[locale]/dashboard-showcase` — dashboard showcase
- `/[locale]/request-demo` — conversion funnel
- `/[locale]/pricing` — pricing explanation
- `/[locale]/contact` — contact/onboarding
- `/[locale]/trust` — trust/data ownership
- `/[locale]/privacy` — privacy notice
- `/[locale]/terms` — terms of service

## 4. Preserved workflows

- Tenant direct pages (`/shop/[slug]`, `/appointment/[slug]`) preserved.
- Shop/service pages, checkout, booking, order tracking preserved.
- Dashboard/admin APIs preserved by source/route policy.
- Customer portal/auth preserved.

## 5. Restricted/de-emphasized workflows

- Public marketplace discovery (`/api/public/organizations`, `/api/public/search`) restricted/classified `MARKETPLACE_DISCOVERY`.
- Broad real-tenant listing/search not promoted; demo portfolio is the official example surface.
- `/fa/shops` returns 404 on production (no public marketplace listing).

## 6. Security/privacy

- No secrets committed or exposed.
- No real SMS sent.
- No production mutation.
- No third-party analytics without env gate (analytics policy-only).
- Legal pages are starter copy with disclaimers; no unsupported legal/security certification claims.

## 7. Known limitations

- 25 legacy validators remain classified as unrelated to the B2B roadmap.
- Playwright browser binary unavailable due geographic CDN restriction; HTTP smoke used.
- Request-demo form is UI-only preview (no real lead API).
- Legal pages need legal review before official commercial launch.
- Pricing packages are positioning, not final commercial/legal pricing.
- Demo data seeding is dry-run/gated, not production auto-write.

## 8. Recommended next roadmap after P09

Do not start Creative Studio as immediate next unless explicitly requested.

Recommended options:
- A. B2B-P10 — Request-demo lead storage/admin review workflow
- B. B2B-P11 — Tenant custom-domain onboarding flow
- C. B2B-P12 — Business onboarding wizard
- D. B2B-P13 — Production demo tenant creation with gated dry-run-to-write flow
- E. B2B-P14 — Resolve legacy validator backlog
- F. B2B-P15 — Deployed browser smoke through Edge/local browser workaround
