# Bazar Baz Handoff Snapshot 00 - Master Summary

Date: 2026-07-15
Repository: `C:\Users\disso\Project\shadcn-rtl`
Production: `https://www.bazar-baz.ir`
HEAD: `b5624c48fe4820cbeae9a2ef8cea514ffed6d7d5`

## Product Positioning

Bazar Baz is currently positioned as a Persian-first B2B service platform for Iranian businesses. The public surface should sell and explain business operations software: shop/order management, service booking, customer club, SMS/Web Push communication, campaigns, reports, staff roles, imports/exports, tenant pages, and custom-domain readiness.

Bazar Baz is not currently positioned as a marketplace, advertising directory, or public social network. Broad public discovery should remain restricted to curated demo/example surfaces unless a later roadmap phase explicitly reopens that strategy.

## Completed Roadmap Baseline

- P120A-P120F notification, SMS.ir, Web Push, delivery observability, retry metadata, reports, and reconciliation foundations.
- NOTIFOPS deployed-safety hardening.
- BB-B2B-P00 through BB-B2B-P12 source work is present on `main`.
- BB-B2B-P10 request-demo lead storage and SUPER_ADMIN review workflow.
- BB-B2B-P11 tenant custom-domain onboarding source acceptance, including P11-FIX1 evidence.
- BB-B2B-P12 Persian-first business onboarding wizard is already present on this branch.

## Recommended Next Direction

Recommended next phase: BB-B2B-P13 - Guided Tenant Provisioning Readiness.

The next phase should connect business onboarding intent to safe tenant provisioning readiness without automatically creating production tenants, sending real SMS, taking real payments, or activating custom domains.

## Deployment State

Vercel reports latest production deployment `dpl_5G2pu15bDSVz7v2z8tyB4iQeco4F` as `READY`, sourced from commit `b5624c48fe4820cbeae9a2ef8cea514ffed6d7d5`.

Production HTTP checks from this handoff run:

| URL | Result |
| --- | --- |
| `/` | 307 to `/fa` |
| `/fa` | 200 |
| `/fa/features` | 200 |
| `/fa/demo` | 200 |
| `/fa/request-demo` | 200 |
| `/fa/pricing` | 200 |
| `/fa/contact` | 200 |
| `/fa/trust` | 200 |
| `/fa/privacy` | 200 |
| `/fa/terms` | 200 |
| `/api/health` | 200 |

## Security State

- Local ignored `.env*` files exist in the workspace but are not tracked and must not be included in handoff ZIPs.
- `.env.example` uses placeholders and empty values for secrets.
- Server-only boundaries exist for SMS.ir, Web Push private key usage, Vercel domain automation token usage, and database URL usage.
- Public APIs preserve tenant-direct customer flows but broad marketplace discovery remains restricted by policy and validators.
- Dashboard and operational APIs use `requireAuthSession`, role guards, organization access checks, and route/navigation policy helpers.

## Known Limitations And Blockers

- P11 production custom-domain activation still requires explicit operator authorization, provider configuration, production migration confirmation, and an authorized real-domain smoke test.
- P11 production migration `20260708000100_custom_domain_onboarding` is required; this snapshot did not apply migrations.
- `quality:sms-provider` fails two documentation-baseline checks about README/roadmap wording expecting an older P109 marker.
- `quality:web-push-delivery` fails two documentation-baseline checks about README/roadmap wording expecting an older P109 marker.
- Lint was not re-run in this handoff pass; the prior P11-FIX1 run passed with existing warnings only.
- Creative Studio exists in code but is not the current strategic priority.

