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
| Media display | Authenticated upload/display restore suite | Deployed E2E | `pnpm run e2e:deployed:media-display` |
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
| 38 | Dashboard sidebar role-aware navigation cleanup | Source-validated | `pnpm run quality:dashboard-role-navigation` |
| 39 | Dashboard route access/navigation parity audit | Source-validated | `pnpm run quality:dashboard-route-parity` |
| 40 | Dashboard route-level authorization helper adoption | Source-validated | `pnpm run quality:dashboard-route-authorization` |
| 42 | Customer Club foundation | Source-validated | `pnpm run quality:customer-club-foundation` |
| 43 | In-app notification inbox | Source-validated | `pnpm run quality:in-app-notifications` |
| 44 | Customer Segments MVP | Source-validated | `pnpm run quality:customer-segments` |
| 45 | Campaign Builder MVP | Source-validated | `pnpm run quality:campaign-builder` |
| 46 | Loyalty Points and Coupons | Source-validated | `pnpm run quality:loyalty-coupons` |
| 47 | Web Push Opt-In Foundation | Source-validated | `pnpm run quality:web-push-foundation` |
| 48 | Public SEO Foundation | Source-validated | `pnpm run quality:public-seo` |
| 49 | Public SEO QA and Rich Preview Hardening | Source-validated | `pnpm run quality:public-seo-qa` |
| 50 | Public Category Metadata and Listing SEO Polish | Source-validated | `pnpm run quality:public-category-seo` |
| 51 | Category Slugs and Public Listing Pagination | Source-validated | `pnpm run quality:public-category-slugs-pagination` |
| 52 | Public Product and Service Slug Detail URLs | Source-validated | `pnpm run quality:public-detail-slugs` |
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
pnpm run quality:dashboard-role-navigation
pnpm run quality:dashboard-route-parity
pnpm run quality:dashboard-route-authorization
pnpm run quality:dashboard-route-guard-smoke
pnpm run quality:customer-club-foundation
pnpm run quality:in-app-notifications
pnpm run quality:customer-segments
pnpm run quality:campaign-builder
pnpm run quality:loyalty-coupons
pnpm run quality:web-push-foundation
pnpm run quality:public-seo
pnpm run quality:public-seo-qa
pnpm run quality:public-category-seo
pnpm run quality:public-category-slugs-pagination
pnpm run quality:public-detail-slugs
pnpm run release:stage
pnpm run quality:release-staged
```

When database URLs and PostgreSQL client tools are available, also run:

```powershell
pnpm run db:drift
pnpm run db:migrate:neon:dry-run
```

## Deployed media upload/display validation

Run the authenticated deployed media suite when validating real upload persistence, cache revalidation, and public image rendering:

```powershell
$env:DEPLOYED_URL="https://your-deploy.example"
pnpm run e2e:deployed:media-display
```

The suite logs in with seeded dashboard credentials by default, uploads temporary PNGs, updates organization logo/cover and product images, verifies public API and browser-rendered public pages, restores original image values, and deletes temporary uploads. Set `MEDIA_E2E_INCLUDE_APPOINTMENT=0` to skip the appointment/service media pass, or override credentials with `MEDIA_E2E_SHOP_USERNAME`, `MEDIA_E2E_SHOP_PASSWORD`, `MEDIA_E2E_APPOINTMENT_USERNAME`, and `MEDIA_E2E_APPOINTMENT_PASSWORD`.

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

Latest completed implementation phase: **P52 - Public Product and Service Slug Detail URLs**.

P52 adds stable product/service slug storage and backfill, unique detail slug generation in product/service services, slug-or-ID public detail API resolution, ID-to-slug detail redirects, slug-first public product/service cards, search results, JSON-LD, sitemap entries, and the focused `quality:public-detail-slugs` validator.

Previous category slug phase retained: **P51 - Category Slugs and Public Listing Pagination**.

P51 adds stable category slug storage/backfill, unique slug generation in category services, slug-first public category links and sitemap entries, ID-route compatibility via slug redirects, paginated category landing pages, page-aware canonical alternates, `rel="prev"` / `rel="next"` navigation links, and the focused `quality:public-category-slugs-pagination` validator.

Previous category SEO phase retained: **P50 - Public Category Metadata and Listing SEO Polish**.

P50 adds indexable public product-category and service-category landing pages, category metadata, CollectionPage/ItemList/breadcrumb JSON-LD, category sitemap entries, discovery links from listing pages, and the focused `quality:public-category-seo` validator.

Previous SEO QA phase retained: **P49 - Public SEO QA and Rich Preview Hardening**.

P49 adds a generated default Open Graph image, points fallback/base social images at it, adds a shared noindex metadata helper, noindexes checkout/order/booking/appointment lookup/status routes, expands robots disallow rules for transactional public route families, and adds the focused `quality:public-seo-qa` validator.

Previous SEO foundation phase retained: **P48 - Public SEO Foundation**.

P48 adds centralized public SEO helpers, locale-aware canonical/alternate metadata, public route metadata for shop, appointment, product, service, and fanpage routes, JSON-LD for organizations/products/services/breadcrumbs/fanpages, dynamic robots and sitemap metadata routes, and the focused `quality:public-seo` validator.

Previous web push phase retained: **P47 - Web Push Opt-In Foundation**.

P47 adds organization/customer-scoped browser push subscriptions, append-only notification permission events, customer opt-in/unsubscribe UI on shop profiles, a management-only `/dashboard/customer-club/push` page, dry-run push delivery preview, VAPID/feature-flag environment validation, and the focused `quality:web-push-foundation` validator. Real Web Push delivery remains disabled behind explicit environment flags.

Previous loyalty/coupon phase retained: **P46 - Loyalty Points and Coupons**.

P46 adds organization-scoped loyalty ledgers, purchase earning rules, coupons, and coupon redemptions; management-only `/dashboard/customer-club/loyalty` and `/dashboard/customer-club/coupons` pages; thin dashboard APIs; append-only point accounting; coupon date/count/customer/segment enforcement; audit logging; localized dictionary copy; and the focused `quality:loyalty-coupons` validator.

Previous campaign phase retained: **P45 - Campaign Builder MVP**.

P45 adds organization-scoped campaign drafts for Customer Club segments, reusable audience/message/delivery records, campaign list/new/detail dashboard pages, dry-run audience preview, in-app-only sending through `Notification`, one delivery row per recipient, pre-send cancellation, audit logging, and the focused `quality:campaign-builder` validator.

Previous segment phase retained: **P44 - Customer Segments MVP**.

P44 adds organization-scoped customer segment definitions, reusable segment/rule/snapshot tables, a management-only `/dashboard/customer-club/segments` page, tenant-safe Customer Club/order/cart count computation, explicit snapshot saving with audit logging, localized FA/EN/AR segment copy, and the focused `quality:customer-segments` validator.

Previous notification phase retained: **P43 - in-app notification inbox**.

P43 adds a localized dashboard notification inbox, read/unread controls, a management-only in-app Customer Club broadcast path with dry-run recipient preview, `GET/PATCH /api/customer/notifications`, organization/actor context on `Notification`, audit logging for sends, and the focused `quality:in-app-notifications` validator. It does not send SMS, email, Telegram, Web Push, or other external notifications.

Previous customer club phase retained: **P42 - Customer Club foundation**.

P42 adds organization-scoped `CustomerClubMembership`, self-service and dashboard management APIs, management-only dashboard navigation/pages, localized FA/EN/AR Customer Club copy, audit logging for membership mutations, and the focused `quality:customer-club-foundation` validator.

Previous route guard phase retained: **P41 - dashboard unauthorized-state polish and route guard smoke tests**.

P41 polishes the localized unauthorized dashboard fallback with focus management, clearer role/route context, mobile-friendly spacing, and a focused `quality:dashboard-route-guard-smoke` validator for representative route-guard expectations.

Previous route authorization phase retained: **P40 - dashboard route-level authorization helper adoption**.

Previous route parity phase retained: **P39 - dashboard route access/navigation parity audit**.

Previous dashboard role phase retained: **P38 - dashboard sidebar role-aware navigation cleanup**.

Previous dashboard shell/copy phase retained: **P37 - dashboard navigation and localized shell copy cleanup**.

Recommended next phase: **P53 - Public SEO Deployed Slug Verification**.
