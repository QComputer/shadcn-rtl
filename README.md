# Bazar Baz

Bazar Baz is a multi-tenant, multi-locale commerce and appointment-booking application built with Next.js 16, React 19, TypeScript, Prisma 6, PostgreSQL, Tailwind CSS, shadcn-style UI components, and NextAuth.

## Current baseline

- Package manager: `pnpm`.
- App Router pages are localized under `app/[locale]`.
- Supported locales: `fa`, `en`, `ar`; Persian is the default public locale.
- Primary domains: organizations, appointment booking, shop/cart/order/payment, inventory, reviews, follows, fanpage posts, conversations, notifications, driver location, dashboard operations.
- Current handoff/source-of-truth: `docs/CURRENT_SOURCE_OF_TRUTH.md`.
- Current route/API/database inventory: `docs/ROUTE_API_DB_SERVICE_INVENTORY.md`.

## Production-hardening status

| Phase | Area | Status | Main validation |
| --- | --- | --- | --- |
| 1 | Security/dashboard API baseline | Done | `npm run e2e:deployed:phase1` |
| 2 | Resource ownership and dashboard API scoping | Done | `npm run e2e:deployed:phase2` |
| 3 | Membership roles and multi-organization groundwork | Done | `npm run e2e:deployed:phase3` |
| 4 | Appointment production correctness | Done | `npm run e2e:deployed:phase4` |
| 5 | Order/payment production hardening | Done | `npm run e2e:deployed:phase5` |
| 6 | Dashboard calendar | Done | `npm run e2e:deployed:phase6` |
| 7 | Uploads/images/QR media hardening | Done | `npm run e2e:deployed:phase7` |
| 8 | Audit, soft-delete, notifications | Done | `npm run e2e:deployed:phase8` |
| 9 | Quality gates and deployed smoke aggregation | Done | `npm run e2e:deployed:phase9` |
| 10 | Auth hardening and security headers | Done | `npm run e2e:deployed:phase10` |
| 11 | Health/environment validation | Done | `npm run e2e:deployed:phase11` |
| 12 | Messaging API hardening | Done | `npm run e2e:deployed:phase12` |
| 13 | Catalog/service data integrity | Done | `npm run e2e:deployed:phase13` |
| 14 | Inventory operations/history | Done | `npm run e2e:deployed:phase14` |
| 15 | Public order tracking privacy | Done | `npm run e2e:deployed:phase15` |
| 16 | Public reviews/follows engagement | Done | `npm run e2e:deployed:phase16` |
| 17 | Profile/settings/account self-service | Done | `npm run e2e:deployed:phase17` |
| 20 | API/service consistency | Source-validated | `pnpm run quality:local` |
| 21 | Reality reset and API safety closure | Source-validated | `pnpm run quality:local` |
| 22 | GET purity/API normalization | Source-validated | `pnpm run quality:get-purity` |
| 23 | Tenant database drift audit | Source/tooling | `pnpm run db:drift` |
| 24 | Tenant identity guardrails | Source-validated | `pnpm run quality:tenant-identity` |
| 25 | Commerce correctness guardrails | Source-validated | `pnpm run quality:commerce-correctness` |
| 26 | Appointment correctness guardrails | Source-validated | `pnpm run quality:appointment-correctness` |
| 27 | i18n/RTL audit | Source-validated | `pnpm run quality:i18n-rtl` |
| 28 | Follow/fanpage readiness cleanup | Source-validated | `pnpm run quality:fanpage-readiness` |
| 29 | Public experience completion | Source-validated | `pnpm run quality:public-experience` |
| 30 | Fanpage MVP | Source-validated | `pnpm run quality:fanpage-mvp` |
| 31 | i18n dictionary completion | Source-validated | `pnpm run quality:i18n-completion` |
| 32 | Safe Neon data migration overlay | Tooling/docs | `pnpm run db:migrate:neon:dry-run` |
| 33 | Clean release artifact workflow | Tooling/docs | `pnpm run release:stage && pnpm run quality:release-staged` |
| 34 | Source-of-truth documentation sync | Docs-only | `pnpm run quality:local` |
| 35 | Seed/auth docs and member refresh fix | Source-validated | `pnpm run quality:seed-auth-members` |
| 36 | Member management UX and provider hardening | Source-validated | `pnpm run quality:members-provider-hardening` |
| 37 | Dashboard navigation and localized shell copy cleanup | Source-validated | `pnpm run quality:dashboard-navigation-copy` |
| C-F | Map, driver dashboard, admin driver/order enhancements | Done | See phase docs |

## Current validation checklist

Run after applying overlays or before handoff:

```powershell
pnpm install
pnpm run db:validate
pnpm run typecheck
pnpm run build
pnpm run quality:local
pnpm run quality:members-provider-hardening
pnpm run quality:dashboard-navigation-copy
pnpm run release:stage
pnpm run quality:release-staged
```

When database URLs and PostgreSQL client tools are available, also run:

```powershell
pnpm run db:drift
pnpm run db:migrate:neon:dry-run
```

## Clean source handoff

Do not share a raw working directory archive. Use the P33 workflow:

```powershell
pnpm run release:zip
```

The clean ZIP is created under `.release/` and excludes local secrets, `.vercel`, dumps, generated caches, local DBs, personal files, test output, `node_modules`, and build folders.

## Seed and local demo data

The active seed script is `prisma/seed.ts` and is wired to:

```powershell
pnpm run db:seed
```

The seed is destructive: it deletes existing demo-domain data before recreating users, organizations, services, products, orders, appointments, reviews, follows, and related settings. See `docs/SEED_TESTING_GUIDE.md` before running it.

## Do not commit or ship

```txt
.env
.env.local
.env.*.local
.vercel/
.next/
node_modules/
.release/
test-results/
playwright-report/
coverage/
prisma/dev.db
*.dump
*.backup
*.zip
*.rar
public/myResume.pdf
public/uploads/
uploads/
tsconfig.tsbuildinfo
```

## Current recommended next phase

Latest completed implementation phase: **P37 — dashboard navigation and localized shell copy cleanup**.

P37 added localized dashboard shell copy, an accessible skip link, a semantic dashboard main landmark, and a compact mobile dashboard header while preserving the P36 provider-layer simplification.

Recommended next phase: **P38 — dashboard sidebar role-aware navigation cleanup**.
