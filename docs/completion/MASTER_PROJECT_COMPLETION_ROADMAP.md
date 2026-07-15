# MASTER PROJECT COMPLETION ROADMAP

Date: 2026-07-15

This roadmap starts after BASELINE-01 and BB-B2B-P12 acceptance. It keeps Bazar Baz aligned as a Persian-first B2B service platform and avoids marketplace-first or Creative-Studio-first prioritization.

## Completed Source Phase

### BB-B2B-P13 - Guided Tenant Provisioning Readiness

Goal: convert an approved request-demo/onboarding lead into a safe, reviewable, idempotent tenant-provisioning plan without creating a production tenant.

Acceptance:

- SUPER_ADMIN-only workflow.
- Request-demo lead linkage.
- Draft provisioning plan with deterministic tenant type, slug, locale, modules, owner contact, package intent, and optional custom-domain intent.
- Dry-run validation that detects slug/owner conflicts without mutation.
- Audit trail and safe validation errors.
- No organization/user creation, SMS/email, payment, or domain mutation.
- `quality:b2b-guided-tenant-provisioning-readiness` passes.

Status: implemented in source. Production migration remains pending explicit authorization. Execution is not implemented.

### DB-NEON-01 - Neon Serverless Canonical Runtime

Goal: make pooled Neon Serverless through the Prisma Neon adapter the canonical application runtime database path, while preserving direct `DIRECT_URL` for Prisma CLI and migrations.

Status: implemented in source. No production migration was applied.

### DB-NEON-02 - Neon Production Migration Deployment

Goal: apply verified pending production migrations with Node 20 and Prisma CLI using direct `DIRECT_URL`, after clone rehearsal and explicit production authorization.

Status: production database migration completed on 2026-07-15 at source commit `a6710fc`. Six migrations were applied: Creative Studio asset rollback enum recovery, notification delivery attempts, nullable SMS customer linkage, P11 custom-domain onboarding, P13 tenant provisioning readiness, and custom-domain status backfill. Post-deploy schema verification passed with no unfinished failed migrations.

Audit caveats:

- The sixth backfill migration was introduced during DB-NEON-02 rehearsal and was not literally named in the final short-form authorization.
- The first production deploy attempt failed before applying SQL; retry behavior was not separately named in the authorization.
- Vercel metadata showed `a6710fc` production deployments in `ERROR` state and the current READY production deployment at `f392ee3`, so production application source synchronization must be fixed before P14 execution.
- `quality:local` currently fails on existing non-DB issues and must not be reported as green.

## Immediate Next Phase

### BB-AI-MEDIA-ONLINE-MILESTONE-01 - Production Source Synchronization and Secure Online AI Media Integration

Goal: synchronize current `main` to Vercel production and complete a secure, tenant-scoped, server-to-server Creative Studio workflow against the Render-hosted AI Media Service without browser-to-Render calls or real GPU/paid generation.

Status: active milestone before BB-B2B-P14. BB-AI-MEDIA-P00 production source synchronization is complete for commit `84be77efef777875423a9e0a95e984862ef26546`. BB-AI-MEDIA-P01 contract discovery is complete through the SUPER_ADMIN-only Vercel-hosted contract probe. The live Render OpenAPI contract confirms the product-image suggestions job lifecycle, but does not expose the historical organization-brand logo/cover endpoints; organization-brand execution must stay disabled/gated until Bazar Baz is adapted to the live `/v1/creative/...` contract or the service adds explicit organization-brand endpoints.

BB-AI-MEDIA-P02/P03 source work is implemented for the confirmed product-image lifecycle: canonical server-only Render client hardening, capability registry, local-before-provider job creation, idempotency/correlation metadata, bounded polling, output URL validation, and fail-closed organization-brand behavior.

BB-AI-MEDIA-P04A/P06A app-managed storage acceptance is implemented locally. Source now includes an application-owned storage gateway, server-only production adapter, local-test storage adapter, hermetic environment guard, disposable local PostgreSQL acceptance path, contract-faithful local MOCK provider, and repeatable `pnpm run test:ai-media:hermetic` command. BB-AI-MEDIA-P06A hardening removes the local-test adapter from the production gateway import graph and injects it only from hermetic test harnesses. Local acceptance created synthetic jobs/assets and local storage objects only, and the concurrency matrix covers duplicate submit, payload conflict, cross-tenant isolation, lost provider response recovery, and duplicate result ingestion. Codex had no direct Production Blob access, no Production Blob credential was needed, and no Production Blob object was listed, uploaded, or deleted.

BB-AI-MEDIA-P04A/P06A local acceptance uses a guarded legacy migration baseline for disposable local databases because the checksum-correct Production migration ledger is not replayable from empty DB. Applied migrations remain immutable and mirrored to Production checksums. The bootstrap is local-only, refuses Neon-like and Production-fingerprinted URLs, and is never part of Production migration operations.

BB-AI-MEDIA-P04B/P05B/P06B deployed Preview MOCK lifecycle remains deferred until isolated external Preview resources are safely discovered and created. Future P07 controlled Production import is prepared only in `docs/ai-media/AI_MEDIA_P07_CONTROLLED_PRODUCTION_IMPORT_RUNBOOK.md`, requires separate authorization, and must go through the deployed Bazar Baz application storage gateway only.

Safety:

- No production database migration is authorized for this milestone.
- No tenant provisioning execution.
- No DNS/provider mutation.
- No SMS, email, Web Push, payment, or domain-provider side effects.
- No real GPU/paid generation without separate explicit authorization.

### BB-B2B-P14 - Transactional Tenant Provisioning Execution

Goal: execute an APPROVED provisioning plan transactionally and idempotently after explicit authorization, creating the organization, settings, owner invitation, membership, and safe defaults without plaintext passwords or partial tenant state.

Prerequisites:

- DB-NEON-02 accepted.
- Vercel production source is synchronized to `a6710fc` or a later accepted commit.
- `quality:local` failures are triaged or explicitly waived for P14 scope.
- Operator explicitly authorizes P14 execution behavior.

Status: next product phase, not yet ready for execution until deployment/source sync and authorization are restored.

## Next B2B Product Phase After Database Acceptance

### BB-B2B-P14 - Transactional Tenant Provisioning Execution

Goal: execute an APPROVED provisioning plan transactionally and idempotently after explicit authorization, creating the organization, settings, owner invitation, membership, and safe defaults without plaintext passwords or partial tenant state.

## Phase Group A - Tenant Provisioning Execution

Implement explicitly approved, transactional, idempotent provisioning execution from a READY/APPROVED plan. Use invitation flow for owners, no plaintext passwords, safe rollback, and no partial tenant state. Production execution remains authorization-gated.

## Phase Group B - P11 Production Domain Readiness

Keep source acceptance, production migration, provider configuration, provider mutation authorization, test-domain attach, DNS verification, SSL readiness, routing smoke, and rollback smoke as separate states. Do not activate real domains without explicit authorization.

## Phase Group C - Commerce Correctness

Audit and harden carts, checkout, inventory concurrency, order numbering, payment callbacks, idempotency, cancellation/refund states, stock restoration, delivery fees, guest privacy, and tenant isolation. No real payments.

## Phase Group D - Appointment Correctness

Audit and harden business hours, staff hours, provider availability, min notice, booking horizon, timezones, Jalali presentation, overlap prevention, concurrency, rescheduling, cancellation, status lifecycle, and tenant isolation.

## Phase Group E - RBAC And Tenant Isolation

Create a complete dashboard/API authorization matrix for SUPER_ADMIN, organization owner/admin, staff, shop roles, appointment staff, customer, and guest. Unknown privileged routes must deny by default.

## Phase Group F - Security And Privacy

Audit authentication, session lifecycle, account recovery, CSRF/origin/CORS, rate limits, public enumeration, Host header use, redirects, webhooks, uploads, Blob access, PII logging, phone masking, notification payload privacy, exports, custom-domain security, and admin audit history.

## Phase Group G - UI/UX, Accessibility, And I18N

Verify Persian RTL, Arabic RTL, and English LTR across critical public/customer/dashboard workflows. Move hardcoded user-facing strings to dictionaries and preserve Persian as default.

## Phase Group H - PWA And Offline Reliability

Verify manifest, install flow, service worker, offline shell, cache versioning, update behavior, Web Push lifecycle, stale-cache safety, custom-domain behavior, and no sensitive dashboard/account caching.

## Phase Group I - Operations And Observability

Complete structured logs, correlation IDs, health/readiness/deep health, notification and SMS visibility, migration/backup/restore runbooks, incident response notes, rate limiting policy, Vercel checklist, and Neon pooled/unpooled connection policy.

## Phase Group J - Test And CI Completion

Build layered validation: unit, service, API integration, authorization matrix, tenant isolation, concurrency, browser E2E, deployed HTTP/browser smoke, FA/EN/AR smoke, mobile smoke, accessibility checks, and migration checks. Browser validation must not be reported as passed when only HTTP smoke ran.

## Phase Group K - Release Acceptance

Final release requires reviewed migrations, authorized production migrations applied, typecheck/lint/build green, global quality suite green or formally replaced, deployed public/admin/SHOP/APPOINTMENT smokes green, checkout/booking/request-demo/provisioning smokes green, notifications dry-run green, honest custom-domain state, no secrets, clean Git tree, HEAD pushed to `main`, final runbook, and a secret-free source snapshot.
