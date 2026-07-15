# MASTER PROJECT COMPLETION ROADMAP

Date: 2026-07-15

This roadmap starts after BASELINE-01 and BB-B2B-P12 acceptance. It keeps Bazar Baz aligned as a Persian-first B2B service platform and avoids marketplace-first or Creative-Studio-first prioritization.

## Immediate Next Phase

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
