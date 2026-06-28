# Bazar Baz — Recommended Next Phase Roadmap

_Last updated from source inspection and roadmap reconciliation: 2026-06-28._

This roadmap is ordered for risk reduction. Phases 18-76 are historical/completed hardening and growth work. The current integrated next track is the Import Hub roadmap, continuing at Phase 77.

## Current integrated roadmap

Current baseline:

- Completed through **P76 - External Source Mapping and Re-import Diff**.
- Persian (`fa`) is the default first-visit locale for platform and custom-domain visits.
- Custom-domain storefronts, SUPER_ADMIN domain management, Vercel domain automation, custom-domain SEO, deployed smoke checks, and shop-domain UX validators are part of the baseline.
- `docs/CURRENT_SOURCE_OF_TRUTH.md` is the current handoff source.
- `docs/IMPORT_HUB_ROADMAP.md` is the active P68-P78 implementation plan.

Recommended next phase:

```txt
P77 - Import Hub Audit, Limits, and Plan Readiness
```

P77 should add production guardrails around Import Hub auditability, limits, cancellation/retry policy, and plan-tier readiness.

Immediate P77 validation target:

```powershell
pnpm run quality:import-hub-audit-limits
pnpm prisma generate
pnpm run typecheck
pnpm run build
```

Follow-on phases:

| Phase | Focus |
| --- | --- |
| P77 | Import Hub audit, limits, and plan readiness. |
| P78 | Export Hub foundation. |

Safety constraints for all Import Hub phases:

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
