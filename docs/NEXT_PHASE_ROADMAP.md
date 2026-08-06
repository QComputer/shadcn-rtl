# Bazar Baz — Recommended Next Phase Roadmap

_Last updated from source inspection and roadmap reconciliation: 2026-07-15._

## 2026-08-02 public footer override

Current active public-shell phase:
`BAZAR-BAZ-CONTEXT-AWARE-PUBLIC-FOOTER-01`.

The phase separates platform and tenant public footer ownership. Platform pages
keep the Bazar Baz footer, shop/custom-domain shop pages use shop-specific
footer data, appointment/service organization pages use organization footer
data, and dashboard/auth shells suppress public footers. No database schema
change or Production migration is included.

## 2026-08-02 shop UX override

Current active product UX phase:
`BAZAR-BAZ-SHOP-IN-PAGE-CATEGORY-FILTER-01`.

The phase keeps the main public shop page as the interactive menu and changes
normal category clicks into in-page client-side filters. Direct category URLs
remain safe compatibility pages for old links and indexing. No database schema
change or Production migration is included.

## 2026-07-19 current override

Current active phase: `BAZAR-BAZ-AI-MEDIA-PRODUCT-SERVICE-ATTACHMENT-01`.

This phase safely attaches already imported application-owned AI media assets to
Product and Service primary image slots using nullable entity references,
dashboard attach/detach APIs, public entity-scoped media routes, and local
Docker MOCK E2E validation. It does not execute P07, real generation, hosted DB
writes, Production Blob writes, or provider/storage credential exposure.

Next after acceptance:
`BAZAR-BAZ-AI-MEDIA-ASSET-LIBRARY-LIFECYCLE-01`.

## 2026-07-19 current override

Previous active phase: `BAZAR-BAZ-DATABASE-SCHEMA-DRIFT-NORMALIZATION-01`.

This phase must complete before product/service AI asset attachment. It proves
complete local Prisma migration/schema parity with disposable Docker PostgreSQL,
normalizing `ImageAccess`, `DomainStatus`, FK/default/timestamp drift, and
naming-only index drift. No Production migration is included.

Next after acceptance: `BAZAR-BAZ-AI-MEDIA-PRODUCT-SERVICE-ATTACHMENT-01`.

This roadmap is ordered for risk reduction. Phases 18-119 are historical/completed hardening and growth work. The integrated Import Hub, Export Hub, AI media hardening, source cleanup, open-fields audit, PWA foundation/offline, notification preference, Web Push delivery, SMS provider, notification routing, notification operations dashboard, deployed PWA/Push/SMS smoke, production rollout, source acceptance/secretless packaging, Creative Studio planning, Creative Studio server foundation, Creative Studio dashboard review, Creative Studio apply controls, Creative Studio generation readiness, Creative Studio product-image generation, Creative Studio generated-asset selection, Creative Studio organization-brand readiness, Creative Studio organization-brand request controls, Creative Studio organization-brand acceptance, Creative Studio organization-brand provider rollout gate, Creative Studio organization-brand provider execution, Creative Studio provider result ingestion, and P120 Creative Studio reviewed asset apply and rollback workflow, P120A operational order notifications and admin order controls, P120B customer order lifecycle notifications and guest SMS dry-run review, P120C notification delivery observability and retry eligibility metadata, P120D SMS.ir provider completion, P120E SMS delivery reports and provider reconciliation, P120F SMS.ir official report endpoint integration, and NOTIFOPS-DEPLOY-FIX1 deployed notification operations hardening are implemented through Phase 120F.

## Current integrated roadmap

Current baseline:

- Completed through **P120F - SMS.ir official report endpoint integration** and **NOTIFOPS-DEPLOY-FIX1** deployed notification operations hardening.
- **BB-B2B-P11-FIX1** source acceptance evidence is complete: P11 custom-domain onboarding is source-accepted, production migration remains pending, provider configuration/real-domain activation remain pending explicit authorization, and no real provider mutation was performed.
- B2B repositioning baseline: **BB-B2B-P00**, **BB-B2B-P01**, **BB-B2B-P02**, **BB-B2B-P03**, **BB-B2B-P04**, **BB-B2B-P05**, **BB-B2B-P06**, **BB-B2B-P07**, **BB-B2B-P08**, **BB-B2B-P09**, **BB-B2B-P10**, **BB-B2B-P11**, and **BB-B2B-P12** completed. Public route policy, decision matrix, content architecture, Persian-first B2B homepage landing, curated demo business portfolio, public discovery restriction policy, conversion funnel pages, feature/dashboard showcase pages, trust/legal/SEO/analytics hardening, deployed HTTP production smoke with final handoff docs, request-demo lead storage with SUPER_ADMIN admin review, tenant custom-domain onboarding flow with organization-scoped dashboard, SHOP/APPOINTMENT host-based routing, Vercel provider safety gates, DNS guide, and Persian-first business onboarding wizard implemented. Production (https://www.bazar-baz.ir) verified with all public B2B pages returning 200 through P11.
- Persian (`fa`) is the default first-visit locale for platform and custom-domain visits.
- Custom-domain storefronts, SUPER_ADMIN domain management, Vercel domain automation, custom-domain SEO, deployed smoke checks, shop-domain UX validators, and P11 custom-domain onboarding validators are part of the baseline.
- `docs/CURRENT_SOURCE_OF_TRUTH.md` is the current handoff source.
- `docs/b2b-public-repositioning/PUBLIC_ROUTE_POLICY.md` is the authoritative public route policy for B2B positioning.

Recommended coordinated milestone before the next B2B execution phase:

```txt
BB-AI-MEDIA-ONLINE-MILESTONE-01 - Production source synchronization and secure online AI media integration
```

This milestone temporarily precedes BB-B2B-P14. It keeps Creative Studio and AI media work server-to-server through the Render-hosted `bazar-baz-ai-media-service`, preserves real GPU/paid generation as a separate authorization gate, and must not start transactional tenant provisioning.

Milestone phase sequence:

| Phase | Focus |
| --- | --- |
| BB-AI-MEDIA-P00 | Vercel Production Source Synchronization for current `main`. |
| BB-AI-MEDIA-P01 | Render Contract and Security Discovery through health/readiness/OpenAPI without generation. |
| BB-AI-MEDIA-P02 | Server-Side Typed AI Media Client aligned to the discovered contract. |
| BB-AI-MEDIA-P03 | Tenant-Scoped Job Lifecycle using existing Creative Studio/AiMedia models where sufficient. |
| BB-AI-MEDIA-P04 | Creative Studio UI Integration with Persian-first, tenant-safe generation workflow. |
| BB-AI-MEDIA-P05 | Preview End-to-End Contract Validation in safe MOCK mode only. |
| BB-AI-MEDIA-P06 | Production Deployment and Safe Acceptance with real generation disabled. |
| BB-AI-MEDIA-P07 | Real Provider Activation, separately authorized. |

Current BB-AI-MEDIA status:

- BB-AI-MEDIA-P00 production source synchronization is complete for commit `84be77efef777875423a9e0a95e984862ef26546`.
- BB-AI-MEDIA-P01 contract discovery is complete through the SUPER_ADMIN-only Vercel Preview contract probe. Production Bazar Baz can reach Render health/readiness from the server, while the local workspace cannot inspect the Render hostname directly because it resolves to a private `10.x` address.
- The live OpenAPI contract confirms `/v1/product-image-suggestions/jobs` create/status/cancel endpoints. It does not expose the historical `/v1/organization-brand/...` endpoints used by the currently disabled/gated logo and cover adapter.
- BB-AI-MEDIA-P02/P03 source work is implemented for the confirmed product-image contract: canonical server-only client hardening, capability registry, local-before-provider `AiMediaJob` creation, idempotency/correlation metadata, bounded status polling, and fail-closed organization-brand behavior.
- BB-AI-MEDIA-P04A/P06A local app-managed storage acceptance is implemented: application-owned storage gateway, local storage adapter, local PostgreSQL guard, contract-faithful local MOCK, and `pnpm run test:ai-media:hermetic` are available. The local lifecycle creates synthetic jobs/assets and imports provider bytes through local storage only.
- BB-AI-MEDIA-P06A hardening is implemented in source: the local-test storage adapter is no longer reachable through the production gateway import graph, local storage is test-injected only, concurrent idempotency is PostgreSQL advisory-lock backed, result ingestion is idempotent, and P07 has a prepared runbook only.
- BB-AI-MEDIA-P04B/P05B/P06B deployed Preview lifecycle remains deferred. Do not request `NEON_PROJECT_ID` again for P04A-P06A. Do not require direct Production Blob access. External Preview acceptance requires separately isolated Preview persistence/storage.
- BB-AI-MEDIA-P04 through P06 must not advance for organization-brand/logo/cover execution until Bazar Baz is adapted to the live `/v1/creative/...` contract or the Render service exposes explicit organization-brand endpoints.
- Do not send real GPU/paid generation requests. MOCK lifecycle testing is allowed only after the active provider/contract is confirmed safe.

Next AI-media action:

```txt
BB-AI-MEDIA-P07 - One Controlled Production Application-Managed Asset Import
```

P07 is pending separate explicit authorization and must use the deployed Bazar Baz server storage gateway. It must not grant Codex, Render, GPU workers, browsers, or test harnesses direct Production Blob credentials.

Recommended next B2B phase after BB-AI-MEDIA-ONLINE-MILESTONE-01 and separate P14 authorization:

```txt
BB-B2B-P14 - Transactional Tenant Provisioning Execution
```

BB-B2B-P13 Guided Tenant Provisioning Readiness is implemented in source. It creates reviewable, idempotent provisioning plans from request-demo/onboarding leads, validates them with a mutation-free dry run, and supports READY/APPROVED review states without tenant execution. Production migration `20260715000100_tenant_provisioning_readiness` was applied by DB-NEON-02.

DB-NEON-01 makes Neon Serverless the canonical source runtime database architecture. Runtime uses pooled `DATABASE_URL` through Prisma Client and the Neon adapter; Prisma CLI and migration operations use direct `DIRECT_URL`.

DB-NEON-02 applied six production migrations on 2026-07-15 through commit `a6710fc`, including P11 custom-domain onboarding, P13 tenant provisioning readiness, notification/SMS observability migrations, and the custom-domain status backfill. Production schema verification passed. However, Vercel metadata showed the latest `a6710fc` production deployment in `ERROR` state while the current READY production deployment remained `f392ee3`; fix/verify production source synchronization before executing P14.

BB-B2B-P14 - Transactional Tenant Provisioning Execution remains the next B2B product phase after deployment/source synchronization and fresh explicit execution authorization.

P120D added server-only sms.ir REST client, bulk/like-to-like sends, Iranian mobile normalization, schedule validation, dry-run default, explicit real-send gates, dashboard diagnostics, and delivery observability for transactional messages. Real send remains disabled by default.

Immediate validation target:

```powershell
pnpm run quality:b2b-dashboard-showcase
pnpm run quality:b2b-conversion-funnel
pnpm run quality:b2b-public-discovery-restriction
pnpm run quality:b2b-demo-business-portfolio
pnpm run quality:b2b-homepage-landing
pnpm run quality:b2b-persian-content-architecture
pnpm run quality:b2b-public-route-policy
pnpm run quality:source-baseline
pnpm run db:generate
pnpm run db:validate
pnpm run typecheck
pnpm run build
pnpm run quality:b2b-custom-domain-onboarding
pnpm run quality:b2b-business-onboarding-wizard
```

Completed integrated phases:

| Phase | Focus |
| --- | --- |
| P68 | Import Hub foundation. |
| P69 | CSV/Excel product importer. |
| P70 | Manual Instagram fanpage import. |
| P71 | AI/text product extraction foundation. |
| P72 | Image/PDF menu import foundation. |
| P73 | Snappfood URL import MVP. |
| P74 | Snappmarket URL import MVP. |
| P75 | Telegram post import. |
| P76 | External source mapping and re-import diff. |
| P77 | Import Hub audit, limits, and plan readiness. |
| P78 | Export Hub foundation. |
| P79 | Import approval publishing. |
| P80 | AI media suggestions hardening. |
| P81 | Protected export downloads. |
| P82 | Deployed import/export smoke. |
| P83 | Project state reconciliation and AI media readiness. |
| P84 | AI media health gate audit. |
| P85 | AI media MOCK flow acceptance. |
| P86 | AI media durable storage acceptance. |
| P87 | AI media long-running job UX. |
| P88 | AI media usage logs, quotas, and audit controls. |
| P89 | Import draft product to AI image suggestion bridge. |
| P90 | Deployed AI media rollout gate through Bazar Baz. |
| P91 | AI media rollout evidence archive. |
| P92 | AI media paid-provider controls. |
| P93 | AI media cost telemetry and rollback guardrails. |
| P94 | AI media seller-facing paid provider state UX. |
| P95 | Source cleanup and current-state verification. |
| P96 | Open fields and workflow completion audit. |
| P97 | PWA foundation and install experience. |
| P98 | Offline shell, caching, and PWA quality gates. |
| P99 | Notification domain model and preferences. |
| P100 | Web Push notification service. |
| P101 | SMS provider abstraction and sms.ir integration. |
| P102 | Notification templates, routing, and delivery policies. |
| P103 | Admin/operator notification dashboard. |
| P104 | Deployed PWA, Push, and SMS smoke gates. |
| P105 | Production rollout runbook. |
| P106 | PWA/Push/SMS source acceptance and secretless packaging gate. |
| P107 | Creative Studio integration planning for main Bazar Baz. |
| P108 | Creative Studio server foundation. |
| P109 | Creative Studio dashboard shell and read-only job review. |
| P110 | Creative Studio apply controls and cache-safe public asset updates. |
| P111 | Creative Studio generation readiness gate and AI-service contract sync. |
| P112 | Creative Studio product-image generation request controls and long-running job UX. |
| P113 | Creative Studio generated-asset selection polish and deployed acceptance. |
| P114 | Creative Studio organization-brand generation planning and readiness gate. |
| P115 | Creative Studio organization logo and cover generation request controls. |
| P116 | Creative Studio organization logo and cover generated-asset acceptance. |
| P117 | Creative Studio organization-brand provider execution rollout gate. |
| P118 | Creative Studio organization-brand provider execution implementation. |
| P119 | Creative Studio provider result ingestion and review stabilization. |
| P120 | Creative Studio reviewed asset apply and rollback workflow. |
| P120A | Operational order notifications and admin order controls for shop staff. |
| P120B | Customer order lifecycle notifications and guest SMS dry-run review. |
| P120C | Notification delivery observability and retry eligibility metadata. |
| P120D | SMS.ir provider completion with server-only REST client, bulk/like-to-like sends, and explicit real-send gates. |
| P120E | SMS delivery reports and provider reconciliation. |
| P120F | SMS.ir official report endpoint integration. |
| NOTIFOPS-DEPLOY-FIX1 | Deployed notification operations hardening. |
| BB-B2B-P00 | B2B repositioning baseline: route policy, decision matrix, and public surface audit. |
| BB-B2B-P01 | Public surface policy and route audit with marketplace discovery restriction plan. |
| BB-B2B-P02 | Persian B2B content architecture with `lib/content/b2b-homepage-content.ts`, feature messaging, and demo business messaging. |
| BB-B2B-P03 | Persian-first B2B homepage landing replacing marketplace-style homepage with static business-oriented sections. |
| BB-B2B-P04 | Curated demo business portfolio and seed strategy with explicit demo labels and dry-run safety policy. |
| BB-B2B-P05 | Public discovery restriction and demo-only API policy with preserved tenant direct routes. |
| BB-B2B-P06 | Conversion funnel pages for request-demo, contact, and onboarding flows. |
| BB-B2B-P07 | Dashboard showcase and feature pages for B2B public surface. |
| BB-B2B-P08 | SEO, trust, legal, and analytics hardening for B2B public surface. |
| BB-B2B-P09 | Deployed B2B public surface acceptance and handoff. |
| BB-B2B-P10 | Request-demo lead storage with safe public API and SUPER_ADMIN review workflow. |
| BB-B2B-P11 | Tenant custom-domain onboarding with dashboard flow, host routing, Vercel safety gates, DNS docs, and acceptance evidence. |
| BB-B2B-P11-FIX1 | Custom-domain onboarding source acceptance evidence, stricter tests, exact provider ACK gate, and production readiness status. |
| BB-B2B-P12 | Persian-first business onboarding wizard at `/onboarding` with guided recommendations and safe request-demo lead submission. |
| BB-B2B-P13 | Guided tenant provisioning readiness with SUPER_ADMIN-only plans, dry-run validation, READY/APPROVED review, and no tenant execution. |
| DB-NEON-01 | Neon Serverless canonical runtime architecture with pooled runtime URL, direct CLI URL, redacted health/smoke checks, and no migration application. |
| DB-NEON-02 | Authorized production migration deployment applying six pending migrations, with Node 20 Prisma CLI, clone rehearsal, post-deploy schema verification, and documented authorization/source-sync caveats. |

Safety constraints for all Import Hub phases:

These phases are completed through **P120F - SMS.ir official report endpoint integration** and **NOTIFOPS-DEPLOY-FIX1**.

1. Imports are seller-initiated and consent-based.
2. External URL imports require explicit seller confirmation of ownership or permission.
3. Imported items stay as drafts until reviewed and approved.
4. Images preserve source URL/metadata and are not copied to Blob until seller approval.
5. Snappfood/Snappmarket/Instagram/Telegram work must avoid private, unauthorized, auth-gated, or high-volume scraping.
6. Real external provider calls stay dry-run or disabled unless explicitly enabled.

## Historical hardening roadmap

## Phase 18 — Production integrity and clean build gate

Goal: make the project safe to share, install, and validate from scratch.

Scope:

1. Remove `.env`, `prisma/dev.db`, local uploads, and local-only artifacts from project ZIPs.
2. Rotate credentials if any real value was shared.
3. Repair `package.json` / `package-lock.json` drift.
4. Add direct dependencies for every direct import.
5. Fix Next.js 16-compatible ESLint setup.
6. Add `packageManager` and `engines` fields.
7. Run and fix:

```bash
npm ci
npm run db:generate
npm run db:validate
npm run typecheck
npm run lint
npm run quality:local
npm run health:env
npm run build
```

Exit criteria:

- Clean install works.
- Prisma validates.
- Typecheck passes.
- Lint passes or has documented, intentional temporary exceptions.
- Build passes.
- Quality/local and health/env pass.
- New release ZIP excludes secrets and local DB files.

## Phase 19 — Dashboard RBAC and route policy hardening

Goal: make dashboard authorization explicit and testable.

Scope:

1. Generate route policy from actual dashboard routes.
2. Add explicit policies for all dashboard pages.
3. Remove stale policies for nonexistent routes.
4. Deny unknown dashboard child routes by default.
5. Add server-side dashboard layout guard.
6. Make auth redirects locale-aware.
7. Add role/org-type access tests.

Exit criteria:

- Every `app/[locale]/dashboard/**/page.tsx` route has an explicit policy.
- `/dashboard/users`, product/service edit/create, appointment detail/edit, organization new, settings, qrcode, driver orders, and calendar all have clear policies.
- Unauthorized users cannot see dashboard shell or trigger privileged client fetches.

## Phase 20 — Service transaction and tenant-identity cleanup

Goal: reduce data corruption risk and make tenant boundaries predictable.

Scope:

1. Wrap organization/user/org-settings/member creation in transactions.
2. Await all async write flows.
3. Scope staff business-hour updates by organization and user.
4. Use `organizationId` as canonical FK where practical.
5. Keep `organizationSlug` as routing/display metadata only.
6. Fix fallback values such as `org?.slug || "slug"`.
7. Add tests for multi-organization users.

Exit criteria:

- No partial organization-registration state on failure.
- No cross-organization staff-hour deletion.
- Tenant resource checks are consistent across service/API layers.

## Phase 21 — API method, validation, and error policy cleanup

Goal: make API handlers boring, thin, safe, and consistent.

Scope:

1. Remove GET state mutations.
2. Standardize error responses.
3. Stop exposing raw internal 500 messages.
4. Add resource validators under `lib/validators`.
5. Make route handlers follow the pattern: auth guard -> access guard -> parse/validate -> service call -> safe response.
6. Review public endpoints for rate-limit and privacy behavior.

Exit criteria:

- GET routes are read-only.
- 500 responses are generic.
- Validation is shared and typed.
- Public APIs do not leak private resource data.

## Phase 22 — Order, payment, cart, and inventory correctness

Goal: make commerce flows safe enough for real money and stock.

Scope:

1. Fix delivery fee logic.
2. Unify order status types and filters.
3. Separate driver denial state from order status enum.
4. Add idempotency strategy for order/payment updates.
5. Add retry/collision handling for order numbers and tracking tokens.
6. Make guest-to-user cart merge transactional.
7. Add stock race-condition tests.
8. Verify cancellation/refund stock restoration behavior.

Exit criteria:

- Checkout and guest checkout have deterministic transaction behavior.
- Inventory movements are complete and reversible where expected.
- Payment updates cannot be spoofed from public routes.

## Phase 23 — Appointment correctness and scheduling hardening

Goal: make service booking safe under malicious inputs and concurrency.

Scope:

1. Enforce business hours in create/update endpoints, not only slot generation.
2. Enforce provider availability during create/update.
3. Protect against concurrent overlapping appointments.
4. Add dashboard appointment create-from-slot only after server validation is ready.
5. Add safe rescheduling/drag-drop only after conflict checks are server-enforced.
6. Add tests for min notice, max advance days, closed days, unavailable staff, and overlapping requests.

Exit criteria:

- Invalid appointment times are rejected by the server.
- Concurrent conflicting bookings cannot both succeed.
- Dashboard calendar actions use the same safe service path as public booking.

## Phase 24 — Frontend decomposition and UI production polish

Goal: turn large prototype pages into maintainable production modules.

Scope:

1. Split huge dashboard, orders, driver-orders, products, shop, booking, checkout, and calendar pages.
2. Create typed feature hooks and API clients.
3. Centralize status labels/actions.
4. Add consistent loading, empty, error, and permission states.
5. Improve mobile layout and dashboard shell behavior.
6. Fix icons/nav route drift.

Exit criteria:

- Page files become mostly composition.
- Business rules leave JSX-heavy components.
- Reusable components have clear props and typed data contracts.

## Phase 25 — i18n/RTL production audit

Goal: make Persian/English/Arabic behavior consistent and releasable.

Scope:

1. Complete missing dictionary keys.
2. Move hardcoded user-facing strings to dictionaries.
3. Restore or deliberately document locale detection behavior.
4. Fix metadata title/description and brand text.
5. Add tests for key pages in `fa`, `en`, and `ar`.
6. Visual audit RTL and LTR dashboard/public workflows.

Exit criteria:

- Public/home/shop/booking/dashboard/account flows render translated text by locale.
- English is LTR and Persian/Arabic are RTL without layout breaks.
- No obvious old brand or typo remains in metadata.

## Phase 26 — Production storage, rate-limit, and observability

Goal: make runtime infrastructure production-aware.

Scope:

1. Replace in-memory rate limit with Redis/Upstash/DB/platform equivalent.
2. Move local uploads to durable storage or a documented persistent volume.
3. Add structured server logging.
4. Add error tracking hooks.
5. Add health/readiness/deep checks to deployment docs.
6. Add backup/restore and migration deployment docs.

Exit criteria:

- Multi-instance deployments behave consistently.
- Uploads survive redeploys.
- Rate limits apply across instances.
- Operators have a documented deployment checklist.

## Phase 27 — Full QA suite foundation

Goal: replace smoke-only confidence with layered test coverage.

Scope:

1. Unit tests for services.
2. API integration tests for all critical routes.
3. Browser E2E for public and dashboard workflows.
4. RBAC matrix tests.
5. i18n/RTL smoke tests.
6. Concurrency tests for appointment/order/stock paths where possible.
7. CI workflow that runs the validation gate.

Exit criteria:

- Tests catch route/RBAC regressions before deployment.
- Checkout, booking, order tracking, driver, upload, and account settings have repeatable coverage.
- Smoke tests remain as deployed validation but not as the only safety net.

## Recommended immediate command checklist after applying this docs overlay

```bash
npm run quality:local
npm run health:env
npm ci
npm run db:generate
npm run db:validate
npm run typecheck
npm run lint
npm run build
```

If the first two run but later steps fail because dependencies are not installed or env values are missing, fix environment/package issues before any feature phase.

## Active Database Baseline Note

For AI-media hermetic acceptance, do not require full replay of the legacy Production migration ledger from an empty database. The `ExportDataType` ledger is checksum-correct but historically non-replayable. Use the guarded local-only baseline path:

```bash
pnpm run test:ai-media:hermetic
```

This provisions disposable local PostgreSQL, runs the guarded baseline bootstrap, and then executes the MOCK lifecycle and idempotency matrix. It must never be used for Production.
