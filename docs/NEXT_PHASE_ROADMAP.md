# Bazar Baz — Recommended Next Phase Roadmap

_Last updated from source inspection and roadmap reconciliation: 2026-07-03._

This roadmap is ordered for risk reduction. Phases 18-119 are historical/completed hardening and growth work. The integrated Import Hub, Export Hub, AI media hardening, source cleanup, open-fields audit, PWA foundation/offline, notification preference, Web Push delivery, SMS provider, notification routing, notification operations dashboard, deployed PWA/Push/SMS smoke, production rollout, source acceptance/secretless packaging, Creative Studio planning, Creative Studio server foundation, Creative Studio dashboard review, Creative Studio apply controls, Creative Studio generation readiness, Creative Studio product-image generation, Creative Studio generated-asset selection, Creative Studio organization-brand readiness, Creative Studio organization-brand request controls, Creative Studio organization-brand acceptance, Creative Studio organization-brand provider rollout gate, Creative Studio organization-brand provider execution, Creative Studio provider result ingestion, and P120 Creative Studio reviewed asset apply and rollback workflow is implemented through Phase 120.

## Current integrated roadmap

Current baseline:

- Completed through **P120 - Creative Studio reviewed asset apply and rollback workflow**.
- Creative Studio generation work continues with the P120B customer order lifecycle notifications and guest SMS dry-run review phase.
- Persian (`fa`) is the default first-visit locale for platform and custom-domain visits.
- Custom-domain storefronts, SUPER_ADMIN domain management, Vercel domain automation, custom-domain SEO, deployed smoke checks, and shop-domain UX validators are part of the baseline.
- `docs/CURRENT_SOURCE_OF_TRUTH.md` is the current handoff source.
- `docs/IMPORT_HUB_ROADMAP.md` is the active P68-P78 implementation plan.
- Local post-P82 AI media commits already include the server-mediated product suggestion flow and selected-image Vercel Blob copy when `BLOB_READ_WRITE_TOKEN` is configured.
- `docs/AI_HANDOFF_PROJECT_CONTEXT.md` is historical and stale; do not restart at Phase 18.

Recommended next phase:

```txt
P120B - Customer order lifecycle notifications and guest SMS dry-run review
```

Next work should stabilize order lifecycle notifications and review the guest SMS dry-run path, while keeping provider execution and creative-studio apply controls safe.

Immediate validation target:

```powershell
pnpm run quality:export-hub-foundation
pnpm run quality:import-approval-publishing
pnpm run quality:ai-media
pnpm run quality:ai-media-health-gate
pnpm run quality:ai-media-mock-flow
pnpm run quality:ai-media-durable-storage
pnpm run quality:ai-media-long-running-ux
pnpm run quality:ai-media-usage-controls
pnpm run quality:import-ai-media-bridge
pnpm run quality:deployed-ai-media-rollout
pnpm run quality:ai-media-rollout-evidence
pnpm run quality:ai-media-paid-provider-controls
pnpm run quality:ai-media-cost-rollback
pnpm run quality:ai-media-seller-state-ux
pnpm run quality:source-baseline
pnpm run quality:open-fields-audit
pnpm run quality:pwa-foundation
pnpm run quality:pwa-offline-shell
pnpm run quality:notification-preferences
pnpm run quality:web-push-delivery
pnpm run quality:sms-provider
pnpm run quality:notification-routing
pnpm run quality:notification-operations
pnpm run quality:deployed-pwa-push-sms
pnpm run quality:production-rollout
pnpm run quality:pwa-push-sms-acceptance
pnpm run quality:clean-source
pnpm run quality:creative-studio-planning
pnpm run quality:creative-studio-foundation
pnpm run quality:creative-studio-dashboard
pnpm run quality:creative-studio-apply-controls
pnpm run quality:creative-studio-generation-readiness
pnpm run quality:creative-studio-product-image-generation
pnpm run quality:creative-studio-generated-asset-selection
pnpm run quality:creative-studio-organization-brand-readiness
pnpm run quality:creative-studio-organization-brand-request-controls
pnpm run quality:creative-studio-organization-brand-acceptance
pnpm run quality:creative-studio-organization-brand-provider-rollout
pnpm run quality:creative-studio-organization-brand-provider-execution
pnpm run quality:creative-studio-provider-result-ingestion
pnpm run quality:order-operational-notifications
pnpm run quality:admin-order-controls
pnpm run quality:export-downloads
pnpm run quality:deployed-import-export-smoke
pnpm run quality:local
pnpm prisma generate
pnpm run typecheck
pnpm run build
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
| P120A | Operational order notifications and admin order controls for shop staff. |
| P120 | Creative Studio reviewed asset apply and rollback workflow. |

Safety constraints for all Import Hub phases:

These phases are completed through **P120 - Creative Studio reviewed asset apply and rollback workflow**.

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
