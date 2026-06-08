# Bazar Baz

Bazar Baz is a multi-tenant, multi-locale commerce and appointment-booking application built with Next.js 16, TypeScript, Prisma 6, PostgreSQL, Tailwind CSS, shadcn-style UI components, and NextAuth.

## Production-hardening status

The project is being hardened in phases. Each phase includes code changes, documentation, and deployed smoke tests that use Node's built-in `fetch` instead of Playwright.

| Phase | Area | Status | Docs | Deployed smoke test |
| --- | --- | --- | --- | --- |
| 1 | Security/dashboard API baseline | Done | `docs/PHASE_1_SECURITY_DASHBOARD_API.md` | `npm run e2e:deployed:phase1` |
| 2 | Resource ownership and dashboard API scoping | Done | `docs/PHASE_2_RESOURCE_OWNERSHIP.md` | `npm run e2e:deployed:phase2` |
| 3 | Membership roles and multi-organization groundwork | Done | `docs/PHASE_3_MEMBERSHIP_RBAC.md` | `npm run e2e:deployed:phase3` |
| 4 | Appointment production correctness | Done | `docs/PHASE_4_APPOINTMENT_CORRECTNESS.md` | `npm run e2e:deployed:phase4` |
| 5 | Order/payment production hardening | Done | `docs/PHASE_5_ORDER_PAYMENT_HARDENING.md` | `npm run e2e:deployed:phase5` |
| 6 | Dashboard FullCalendar/shadcn calendar upgrade | Done | `docs/PHASE_6_DASHBOARD_CALENDAR.md` | `npm run e2e:deployed:phase6` |
| 7 | Uploads/images/QR media hardening | Done | `docs/PHASE_7_MEDIA_HARDENING.md` | `npm run e2e:deployed:phase7` |
| 8 | Audit, soft-delete, and notifications cleanup | Done | `docs/PHASE_8_AUDIT_SOFTDELETE_NOTIFICATIONS.md` | `npm run e2e:deployed:phase8` |
| 9 | Quality gates, smoke aggregation, and docs cleanup | Done | `docs/PHASE_9_QUALITY_GATES.md` | `npm run e2e:deployed:phase9` |
| 10 | Auth hardening, security headers, and search rate limiting | Done | `docs/PHASE_10_AUTH_SECURITY.md` | `npm run e2e:deployed:phase10` |
| 11 | Deployment health and environment validation | Done | `docs/PHASE_11_HEALTH_ENVIRONMENT.md` | `npm run e2e:deployed:phase11` |
| 12 | Messaging and conversation API hardening | Done | `docs/PHASE_12_MESSAGING_HARDENING.md` | `npm run e2e:deployed:phase12` |
| 13 | Catalog and service data integrity | Done | `docs/PHASE_13_CATALOG_HARDENING.md` | `npm run e2e:deployed:phase13` |
| 14 | Inventory operations and movement history | Done | `docs/PHASE_14_INVENTORY_OPERATIONS.md` | `npm run e2e:deployed:phase14` |
| 15 | Public order tracking privacy | Done | `docs/PHASE_15_PUBLIC_ORDER_TRACKING.md` | `npm run e2e:deployed:phase15` |
| 16 | Public reviews/follows engagement hardening | Done | `docs/PHASE_16_PUBLIC_ENGAGEMENT.md` | `npm run e2e:deployed:phase16` |
| 17 | Profile/settings/account self-service hardening | Done | `docs/PHASE_17_ACCOUNT_SETTINGS.md` | `npm run e2e:deployed:phase17` |
| 20 | API/service consistency | Source-validated | `docs/PHASE_20_API_SERVICE_CONSISTENCY.md` | `node scripts/quality/validate-api-service-safety.mjs` |
| 21 | Reality reset and API safety closure | Source-validated | `docs/PHASE_21_REALITY_RESET_API_SAFETY.md` | `npm run quality:local` |
| C | Map & routing + driver dashboard | Done | `docs/PHASE_C_MAP_ROUTING.md` | — |
| D | Improved driver dashboard UI | Done | `docs/PHASE_D_DRIVER_DASHBOARD.md` | — |
| E | Admin order enhancements (assign driver) | Done | `docs/PHASE_E_ADMIN_ORDER_ENHANCEMENTS.md` | — |
| F | Driver location tracking API | Done | `docs/PHASE_F_LOCATION_TRACKING.md` | — |

## Remaining production-hardening roadmap

Current source-of-truth handoff: `docs/CURRENT_SOURCE_OF_TRUTH.md`.

1. P22 — GET purity and API normalization: remove writes/upserts/mark-read side effects from GET handlers and add a validator that blocks GET mutation patterns.
2. P23 — dependency/package/build gate: align package versions, direct dependencies, Prisma generation/validation, typecheck, lint, and build on the target machine.
3. P24 — tenant identity cleanup: reduce mixed `organizationId`/`organizationSlug` authorization and data-consistency risk.
4. P25 — commerce correctness: harden delivery fee, driver visibility, payment idempotency, stock race safety, order token collisions, and cancellation/refund inventory behavior.
5. P26 — appointment correctness: enforce business hours/provider availability/buffers inside create/reschedule APIs, not only slot generation.
6. P27 — i18n/RTL completion: make FA/EN/AR dictionary keys complete and remove hardcoded user-visible text from production surfaces.
7. P28 — UI decomposition and polish: split oversized dashboard/shop/order pages into feature components and normalize loading/empty/error states.
8. P29 — production infrastructure: durable uploads, distributed rate limiting, logging/monitoring, health checks, backup/restore, and migration deployment checklist.
9. P30 — release-candidate QA: real browser E2E, API integration tests, i18n/RTL checks, and concurrency tests.


## Phase 10 — Authentication and security headers

Phase 10 hardens login/account behavior and baseline HTTP security headers.

Important changes:

- Credentials login supports username, email, or phone.
- Disabled, deleted, or temporarily locked users cannot sign in.
- Failed login attempts are counted and locked for 15 minutes after 5 failures.
- Successful login resets failure counters and records `lastLoginAt`.
- Google sign-in is restricted to existing active users.
- Baseline security headers are configured in `next.config.ts`.
- Public search has conservative per-IP rate limiting.

Run the deployed Phase 10 smoke test:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase10
```

Run all deployed smoke tests:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:all
```

## Phase 10 header hotfix

The deployed Phase 10 smoke test showed that platform-level `next.config.ts` headers were not visible on the public response. Security headers are now also applied from `proxy.ts` using `NextResponse` so locale redirects and normal localized pages receive:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`

Re-run after deployment:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase10
```

## Phase 12 — Messaging and conversation hardening

Phase 12 hardens the messaging APIs with typed auth guards, participant validation, pagination normalization, conservative rate limits, direct-conversation correctness, and consistent API error responses.

Run the deployed Phase 12 smoke test:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase12
```

Run all deployed smoke tests:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:all
```

## Phase 13 — Catalog and service data integrity

Phase 13 hardens product, product-category, service, and service-category workflows.

Important changes:

- Catalog pagination is normalized before reaching Prisma.
- Product creation validates active SHOP organization and category ownership.
- Service creation validates active APPOINTMENT organization and service-category/provider ownership.
- Product/service category duplicate names are rejected per organization.
- Non-empty product/service categories cannot be deleted.
- Products must keep at least one active variant.
- Deployed no-Playwright Phase 13 smoke test was added.

Run the deployed Phase 13 smoke test:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase13
```

Run all deployed smoke tests:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:all
```

### Phase 13 hotfix — product pagination

`/api/products` now normalizes and caps query-string pagination before validation so oversized `pageSize` values cannot trigger a server error.

## Phase 14 — Inventory operations and movement history

Phase 14 adds append-only inventory movement records for stock-changing operations.

Important changes:

- Order checkout decrements product variant inventory inside the order transaction and records `InventoryMovement` rows.
- Order cancellation/refund restores inventory only once per order and records restoration movements.
- Product variant creation records initial stock movements.
- Product variant inventory edits record manual adjustment movements.
- Deployed no-Playwright Phase 14 smoke test was added.

Run the migration:

```powershell
npx prisma migrate deploy
```

Run the deployed Phase 14 smoke test:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase14
```

Run all deployed smoke tests:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:all
```


### Phase 14 build hotfix

Fixed the TypeScript type annotation for inventory restore movement reasons by using the generated Prisma `InventoryMovementReason` type alias instead of treating the runtime enum object as a namespace in type position.


#### Phase 14 build hotfix 2

Fixed the missing `InventoryMovementReason` runtime enum import in `lib/services/product.service.ts` so inventory movement creation for initial stock and manual adjustments compiles during `next build`.


### Phase 14 inventory smoke-test hotfix

The Phase 14 deployed smoke test accepts `401`, `403`, or `405` for unauthenticated payment mutation probes. `405` is safe when the route rejects the probed method before mutation.

### Phase 15 — Public order tracking privacy

Phase 15 hardens public order tracking links. Public order details are available only to the original guest browser session, the owning account, an authorized organization member, or a request that includes the generated `publicTrackingToken` as `?token=...`. Public order lookup is also rate-limited and soft-deleted orders are hidden.

Run the deployed smoke test:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase15
```


## Phase 16 — Public Engagement Hardening

Phase 16 hardens organization reviews and follows. It adds public review listing, authenticated review create/update/delete with ownership checks, authenticated follow/unfollow with active-organization validation, pagination normalization, and rate limiting.

Run after deployment:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase16
```

Docs: `docs/PHASE_16_PUBLIC_ENGAGEMENT.md`.
