# PROJECT COMPLETION BASELINE

Date: 2026-07-15

## Git Baseline

- Branch: `main`
- Baseline HEAD before BASELINE-01 changes: `b5624c48fe4820cbeae9a2ef8cea514ffed6d7d5`
- Origin status at phase start: `origin/main` matched local `main`
- Initial working tree: only untracked `docs/handoff/STATE_SNAPSHOT_00_*` through `STATE_SNAPSHOT_10_*` reports from the handoff snapshot

## Architecture Summary

Bazar Baz is a Next.js 16 / React 19 / TypeScript strict application using Prisma 6 with PostgreSQL, NextAuth, Vercel Blob Storage, Persian/English/Arabic localization, RTL/LTR-aware UI, PWA/Web Push foundations, SMS.ir provider integration behind dry-run gates, and Vercel-hosted production deployment. Tenant-facing commerce and appointment routes are preserved while broad public discovery remains restricted to B2B-approved surfaces and curated demos.

## Production Deployment Status

- Production URL: `https://www.bazar-baz.ir`
- Snapshot report status: Vercel deployment was READY at baseline HEAD.
- Public platform default locale: Persian (`fa`) for first-time/no-locale visits.
- Production verification in this phase: not mutated; no production DB/provider/domain action performed.

## Accepted Phases

- P120A-P120F notification, Web Push, SMS.ir, delivery reports, and reconciliation source work.
- NOTIFOPS deployed notification operations hardening source state.
- BB-B2B-P00 through BB-B2B-P12 source work.
- P10 request-demo lead storage and SUPER_ADMIN review source workflow.
- P11 custom-domain onboarding source acceptance.
- P12 Persian-first business onboarding wizard source acceptance.

## Unverified Or Partially Verified Phases

- P11 production migration remains pending.
- P11 real custom-domain provider configuration and domain activation remain pending explicit authorization.
- Full `quality:local` global legacy-suite acceptance is not claimed by BASELINE-01 unless separately run and green.
- Browser/deployed authenticated admin smokes are not claimed by this baseline unless separately run with credentials.

## Pending Migrations

- `20260708000100_custom_domain_onboarding` requires authorized production migration before production custom-domain activation can be accepted.

## Known Validator Failures At Start

- `quality:sms-provider` had stale documentation-baseline checks requiring obsolete P120D/P109 wording.
- `quality:web-push-delivery` had stale documentation-baseline checks requiring obsolete P120D/P109 wording.

Both were repaired to check durable current baseline evidence: P100/P101 completion, P120F/NOTIFOPS current notification baseline, and BB-B2B-P13 as the next B2B phase.

## Known Security Risks And Boundaries

- Real SMS, email, payments, production database mutation, production migrations, Vercel domain mutation, and customer-tenant operations require explicit user authorization.
- Provider secrets must remain server-only and must not be exposed through `NEXT_PUBLIC_*`.
- Custom-domain routing must only trust normalized, ACTIVE organization domains and must not attach/remove real domains automatically.
- Request-demo/onboarding submissions must not create tenants, users, SMS/email side effects, payments, or domain activation.

## Known Production Gaps

- P11 source is accepted, but production domain readiness is not fully accepted until migration/provider/domain smoke is authorized and completed.
- Guided tenant provisioning is not implemented yet; P12 only captures intent as a request-demo lead.
- Global legacy validation backlog should be resolved or formally replaced before final release acceptance.

## Current Recommended Phase

`BB-B2B-P13 - Guided Tenant Provisioning Readiness`

## Completion Definition

The project is complete only when all source, security, tenant-isolation, migration, provider, PWA, SMS/Web Push, commerce, appointment, accessibility, deployed smoke, and release acceptance gates in `docs/completion/MASTER_PROJECT_COMPLETION_ROADMAP.md` are green or explicitly documented as authorized deferred items.

## Exact Next Action

After BASELINE-01 is committed and pushed, begin `BB-B2B-P13 - Guided Tenant Provisioning Readiness`. P13 must create a reviewable, idempotent, dry-run provisioning plan from an approved lead without creating a real production tenant.
