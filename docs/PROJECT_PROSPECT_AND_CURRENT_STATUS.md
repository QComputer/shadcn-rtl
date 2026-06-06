# Bazar Baz — Comprehensive Project Prospect and Current Status

_Last updated from source inspection: 2026-06-02._

This document is a senior-level prospect for the current application snapshot. It explains what the product is, what is already implemented, what is risky, and what should happen before production release.

## 1. Executive summary

Bazar Baz is a Persian-first, multi-locale, multi-tenant commerce and appointment-booking platform built on Next.js 16 App Router, React 19, Prisma 6, PostgreSQL, NextAuth v5 beta, Tailwind CSS, and shadcn-style UI primitives.

The project is not merely a storefront. It combines public shop pages, public service-booking pages, organization dashboards, order management, driver workflows, product/service catalog management, payment state, inventory movements, messaging, notifications, reviews, follows, QR code support, local media uploads, and account settings.

The application has a meaningful product prospect and a strong domain model, but the current snapshot should be treated as a hardening candidate rather than production-ready software. The strongest areas are Prisma modeling, service separation, no-Playwright deployed smoke scripts, and API guard foundations. The weakest areas are build integrity proof, TypeScript strictness, dashboard route access consistency, frontend decomposition, i18n completeness, release-secret hygiene, and test coverage.

## 2. Product prospect

The application can become a multi-tenant SaaS platform where local businesses can create public shops or appointment organizations, publish products/services, accept orders and bookings, manage staff, handle delivery/driver states, communicate with customers, receive reviews/follows, and expose QR/public links.

Potential verticals:

- Shops and food/product sellers.
- Clinics, salons, repair shops, consultation providers, and other appointment-based businesses.
- Multi-branch local businesses that need separate public profiles and dashboards.
- Persian-first businesses that need RTL-first UI and optional English/Arabic support.

The prospect is good because commerce and booking are both represented in one tenant model. However, the architecture must become more deliberate around tenant identity, role authority, and production runtime guarantees.

## 3. Current application shape

Observed source inventory:

- Localized page routes: 37.
- API route handlers: 62.
- Prisma models: 40.
- Prisma enums: 11.
- Service modules: 14.
- Existing phase docs: 17 phase docs plus seed/dashboard guides.
- Current smoke-test style: Node `fetch` deployed smoke scripts under `scripts/e2e`.

## 4. High-level maturity rating

| Area | Rating | Notes |
| --- | ---: | --- |
| Product/domain prospect | 8/10 | Strong combined commerce + booking concept. |
| Database/domain modeling | 7/10 | Rich schema, but tenant identity is inconsistent in places. |
| Service-layer direction | 6.5/10 | Good separation, but some transactions/awaits/status rules need hardening. |
| API guard direction | 6/10 | Useful shared guards exist, but route consistency is not complete. |
| Frontend maintainability | 4.5/10 | Several large client pages mix state, fetch, UI, and business rules. |
| RBAC/page access | 4.5/10 | Stale dashboard route registry and missing explicit route policies. |
| i18n/RTL readiness | 4.5/10 | Locale structure exists, but dictionaries/hardcoded strings are incomplete. |
| Testing maturity | 3.5/10 | Smoke scripts exist, but no full browser/API/unit test suite is present in the ZIP. |
| Deployment readiness | 4/10 | Build/typecheck not proven from this ZIP; local env artifacts are included. |

## 5. Strong architectural decisions already present

- App Router route organization with locale-prefixed public and dashboard pages.
- Prisma schema with audit, payment event, inventory movement, order status history, booking settings, notifications, messaging, follows, and reviews.
- Service layer under `lib/services` instead of putting all business logic in route handlers.
- Shared API guard helpers under `lib/api-guards.ts`.
- NextAuth credential authentication with account lockout and active/deleted-user checks.
- Public order tracking token concept and explicit public payment update denial.
- Upload validation that checks image signatures and ownership metadata.
- Health endpoint and environment validation script.
- Phase-by-phase production-hardening documentation.

## 6. Main production blockers

These items should be fixed before the project is considered deployable:

1. Remove `.env`, `prisma/dev.db`, and local artifacts from distributable ZIPs and rotate any real leaked credential.
2. Prove clean install, Prisma validation, typecheck, lint, and build on a clean machine.
3. Fix package/lockfile drift and direct dependencies that are imported but not declared directly.
4. Make dashboard route access explicit for every real dashboard page and deny unknown dashboard children by default.
5. Remove GET state mutations such as driver order acceptance and organization open-state changes.
6. Clean provider/session duplication and duplicated auth interfaces.
7. Transaction-wrap organization registration and other multi-write workflows.
8. Fix tenant identity consistency: canonical business relations should use `organizationId`; slug should be routing/display metadata.
9. Complete i18n dictionary coverage and remove hardcoded Persian/Arabic strings from reusable pages/components.
10. Replace in-memory rate limiting and local disk media storage for scaled production deployments.

## 7. Recommended immediate strategy

Do not add large new features first. The next engineering phase should be a documentation-backed production integrity pass:

1. Clean secrets and local artifacts.
2. Repair dependencies and lockfile.
3. Run `npm ci`, `npm run db:generate`, `npm run db:validate`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run quality:local`, and `npm run health:env`.
4. Fix any build/typecheck/lint errors.
5. Harden dashboard route access and server-side dashboard layout authorization.
6. Add a basic test matrix for auth, RBAC, appointment booking, checkout, public tracking, upload validation, and i18n smoke.

## 8. Documentation set added by this overlay

- `docs/PROJECT_PROSPECT_AND_CURRENT_STATUS.md` — this product and maturity prospect.
- `docs/ARCHITECTURE_AND_WORKFLOWS.md` — system architecture and core workflows.
- `docs/ROUTE_API_DB_SERVICE_INVENTORY.md` — generated inventory of pages, APIs, models, enums, and services.
- `docs/PRODUCTION_READINESS_AUDIT.md` — prioritized risk register and amateur-code audit.
- `docs/NEXT_PHASE_ROADMAP.md` — practical hardening roadmap.
- `docs/AI_HANDOFF_PROJECT_CONTEXT.md` — context for the next AI/developer.
- `docs/DOCUMENTATION_OVERLAY_MANIFEST.md` — overlay manifest and validation notes.
