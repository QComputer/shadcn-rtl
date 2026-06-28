# Bazar Baz - AI/Developer Handoff Context

> Historical/stale handoff note, reconciled on 2026-06-29 in P83.
> This document records an old Phase 1-17 overlay and must not be used as the
> active continuation plan. The current roadmap starts from P83/P84; use
> `README.md`, `docs/CURRENT_SOURCE_OF_TRUTH.md`,
> `docs/NEXT_PHASE_ROADMAP.md`, and
> `docs/PHASE_83_PROJECT_STATE_RECONCILIATION.md` instead.

_Last updated from source inspection: 2026-06-02._

This file is preserved for historical context only. It summarizes the project identity, source layout, known risks, validation expectations, and recommended next actions as they existed on 2026-06-02.

## 1. Project identity

Project name: `bazar-baz`.

Product type: Persian-first multi-tenant commerce and appointment-booking SaaS.

Primary stack:

- Next.js 16 App Router.
- React 19.
- TypeScript.
- Prisma 6.
- PostgreSQL.
- NextAuth v5 beta.
- Tailwind CSS and shadcn-style components.
- Locales: `fa`, `en`, `ar`.

Do not confuse this project with the larger dental web app from other conversations. This snapshot is a smaller/ecommerce-booking project.

## 2. Historical phase state

At the time this handoff was written, existing docs recorded phases 1 through 17:

- Security/dashboard API baseline.
- Resource ownership.
- Membership RBAC.
- Appointment correctness.
- Order/payment hardening.
- Dashboard calendar.
- Media/upload hardening.
- Audit/soft-delete/notifications.
- Quality gates.
- Auth/security headers/search rate limiting.
- Health/environment validation.
- Messaging hardening.
- Catalog hardening.
- Inventory operations.
- Public order tracking.
- Public engagement.
- Account settings.

This overlay added comprehensive project docs but did not change runtime code.

## 3. Important source files

| Area | Files |
| --- | --- |
| Auth | `lib/auth.ts`, `hooks/use-auth.tsx`, `components/providers.tsx` |
| RBAC/API guards | `lib/api-guards.ts`, `lib/access-control.ts` |
| Database | `prisma/schema.prisma`, `prisma/migrations/**`, `lib/db.ts` |
| Services | `lib/services/*.ts` |
| Public pages | `app/[locale]/shop/**`, `app/[locale]/appointment/**`, `app/[locale]/page.tsx` |
| Dashboard pages | `app/[locale]/dashboard/**` |
| APIs | `app/api/**/route.ts` |
| i18n | `dictionaries/*.json`, `lib/dictionary.ts`, `lib/i18n.ts`, `proxy.ts` |
| Quality scripts | `scripts/quality/*.mjs`, `scripts/e2e/*.mjs` |

## 4. Validation expectations before any future ZIP

Before delivering a code overlay, run as much as the environment allows:

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

After deployment, run:

```bash
DEPLOYED_URL=https://your-deployed-url.example npm run e2e:deployed:all
```

Be transparent about any validation that could not be run. Do not claim build/typecheck/lint are green unless they actually ran successfully.

## 5. Known must-fix risks

1. `.env` and `prisma/dev.db` are present in the uploaded ZIP. Remove from future distributable bundles.
2. Dependency installation/build/typecheck/lint were not proven from this ZIP alone.
3. `components/providers.tsx` nests `SessionProvider` twice.
4. `hooks/use-auth.tsx` duplicates interfaces and redirects without locale awareness.
5. `lib/access-control.ts` is stale relative to actual dashboard pages.
6. Some dashboard pages are not explicitly guarded at page/layout level.
7. GET routes mutate state in at least driver-order acceptance and organization-open flow.
8. Organization registration/member/business-hour flows need stronger transactions/awaiting/scoping.
9. Tenant identity should standardize around `organizationId`, not `organizationSlug`.
10. i18n dictionaries and hardcoded strings need a production audit.

## 6. Superseded recommended next phase

The old recommendation was `Phase 18 - Production integrity and clean build gate`.
That recommendation has been superseded. As of P83, phases 18-83 are historical/completed hardening and growth work, and the recommended next phase is:

```txt
P84 - Server-only AI media service client and health gate audit
```

Do not restart from Phase 18. Continue from `docs/CURRENT_SOURCE_OF_TRUTH.md` and `docs/NEXT_PHASE_ROADMAP.md`.

## 7. Packaging rule

For future overlays:

- Prefer changed-files-only ZIP overlays unless the user explicitly asks for a full project ZIP.
- Do not include `.env`, local DB files, `node_modules`, `.next`, debug folders, local upload files, or secrets.
- Include a manifest that lists changed files and validation commands run.
- Preserve existing phase docs and quality scripts unless intentionally updating them.

## 8. Historical suggested prompt

Do not use this prompt for current continuation. It is kept only to explain the older overlay:

```txt
You are a senior Next.js 16 / Prisma / production-readiness engineer. Continue the Bazar Baz project from the latest ZIP. First read README.md and the docs added in the documentation overlay: PROJECT_PROSPECT_AND_CURRENT_STATUS, ARCHITECTURE_AND_WORKFLOWS, ROUTE_API_DB_SERVICE_INVENTORY, PRODUCTION_READINESS_AUDIT, NEXT_PHASE_ROADMAP, and AI_HANDOFF_PROJECT_CONTEXT. Do not confuse this project with the dental web app. Start with Phase 18: production integrity and clean build gate. Inspect the actual files before changing anything. Remove secrets/local artifacts from distributable ZIPs, repair package/lockfile/dependency drift, run clean install/build/typecheck/lint/prisma/quality validation as much as the environment allows, and package only changed files in an overlay ZIP with a manifest. Be transparent about validations not run.
```
