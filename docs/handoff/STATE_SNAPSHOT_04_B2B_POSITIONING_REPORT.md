# Bazar Baz Handoff Snapshot 04 - B2B Positioning Report

## Current B2B State

Bazar Baz public positioning is now B2B-first and Persian-first. The homepage and public support pages speak to Iranian business owners/operators who need operational software, not consumers looking for a marketplace.

## Completed B2B Areas

| Area | Status | Evidence |
| --- | --- | --- |
| B2B homepage | complete | `app/[locale]/page.tsx`, `lib/content/b2b-homepage-content.ts`, `quality:b2b-homepage-landing` passed |
| Public route policy | complete | `docs/b2b-public-repositioning/PUBLIC_ROUTE_POLICY.md`, route validator passed |
| Demo portfolio | complete | `app/[locale]/demo/page.tsx`, `lib/content/b2b-demo-businesses.ts`, demo validator passed |
| Discovery restriction | complete | broad public marketplace discovery not promoted; direct tenant routes preserved |
| Request demo pages | complete | `app/[locale]/request-demo/**`, public API safe by default |
| Pricing/contact pages | complete | `app/[locale]/pricing`, `contact`; conversion validator passed |
| Dashboard showcase | complete | `app/[locale]/dashboard-showcase`, features/dashboard validator passed |
| SEO/trust/legal pages | complete | `trust`, `privacy`, `terms`, SEO/trust/legal validator passed |
| Request-demo lead storage | complete | `RequestDemoLead`, admin review dashboard, P10 validators passed |
| Custom-domain onboarding | source accepted | P11-FIX1 evidence and validator passed; production activation still gated |
| Business onboarding wizard | present | P12 commit `0769f3f`; next work should build readiness around provisioning |

## Pending

- P11 production custom-domain activation: requires production migration confirmation, provider configuration, exact real-mutation ACK, and authorized real-domain smoke testing.
- P13 guided tenant provisioning readiness: define safe provisioning states, review steps, operator controls, and non-mutating readiness checks before automatic tenant creation.
- Operational docs cleanup: `quality:sms-provider` and `quality:web-push-delivery` still expect old P109 wording in README/roadmap checks.

## What Should Not Be Changed

- Do not restore marketplace/ad-directory framing as the primary public strategy.
- Do not promote broad public organization search/listing as a central product surface.
- Do not remove tenant direct shop/appointment pages, checkout, booking, order tracking, or customer support flows.
- Do not turn Creative Studio into the main roadmap priority unless explicitly redirected.
- Do not activate real custom domains, real SMS, payments, or provider mutations without explicit operator authorization.

