# Bazar Baz

Bazar Baz is a multi-tenant, multi-locale commerce and appointment-booking application built with Next.js 16, React 19, TypeScript, Prisma 6, PostgreSQL, Tailwind CSS, shadcn-style UI components, and NextAuth.

## Current baseline

- Package manager: `pnpm`.
- App Router pages are localized under `app/[locale]`.
- Supported locales: `fa`, `en`, `ar`; Persian is the default public locale, and first-time unprefixed visits to `/` redirect to `/fa`.
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
| 53 | Public SEO Deployed Slug Verification | Source/deployed smoke | `pnpm run quality:deployed-slug-seo` / `pnpm run e2e:deployed:slug-seo` |
| 54 | Dashboard Slug Editing UI | Source-validated | `pnpm run quality:dashboard-slug-editing` |
| 55 | Public Slug Preview and Rich Share Polish | Source-validated | `pnpm run quality:public-slug-preview-share` |
| 56 | Tenant-Specific Open Graph Image Generation | Source-validated | `pnpm run quality:tenant-og-images` |
| 57 | Deployed Social Preview Verification | Source/deployed smoke | `pnpm run quality:deployed-social-preview` / `pnpm run e2e:deployed:social-preview` |
| 58 | Social Preview Artifact Review and Release Evidence | Tooling/docs | `pnpm run quality:social-preview-evidence` / `pnpm run release:social-preview-evidence` |
| 59 | Shop Custom Domains | Source-validated | `pnpm run quality:shop-custom-domains` |
| 60 | SUPER_ADMIN Shop Domains | Source-validated | `pnpm run quality:shop-domain-admin` |
| 61 | Vercel environment push tooling | Tooling | `scripts/ops/push-vercel-env.ps1` |
| 62 | Dashboard Organizations publication | Source-validated | `pnpm run quality:dashboard-organizations-published` |
| 63 | Vercel custom-domain automation | Source/tooling | `pnpm run quality:vercel-domain-automation` |
| 64 | Custom-domain SEO hardening | Source-validated | `pnpm run quality:custom-domain-seo` |
| 65 | Custom-domain default Persian locale | Source-validated | `pnpm run quality:custom-domain-default-locale` |
| 66 | Deployed custom-domain smoke | Source/deployed smoke | `pnpm run quality:custom-domain-smoke` / `pnpm run e2e:custom-domain-smoke` |
| 66A | Platform default Persian locale | Source/deployed smoke | `pnpm run quality:platform-default-locale` / `pnpm run e2e:platform-default-locale` |
| 67 | Shop-domain dashboard UX polish | Source-validated | `pnpm run quality:shop-domain-ux` |
| 68 | Import Hub Foundation | Source-validated | `pnpm run quality:import-hub-foundation` |
| 69 | CSV/Excel Product Importer | Source-validated | `pnpm run quality:csv-excel-importer` |
| 70 | Manual Instagram Fanpage Import | Source-validated | `pnpm run quality:manual-instagram-import` |
| 71 | AI/Text Product Extraction Foundation | Source-validated | `pnpm run quality:text-product-extraction` |
| 72 | Image/PDF Menu Import Foundation | Source-validated | `pnpm run quality:image-pdf-menu-import` |
| 73 | Snappfood URL Import MVP | Source-validated | `pnpm run quality:snappfood-url-import` |
| 74 | Snappmarket URL Import MVP | Source-validated | `pnpm run quality:snappmarket-url-import` |
| 75 | Telegram Post Import | Source-validated | `pnpm run quality:telegram-post-import` |
| 76 | External Source Mapping and Re-import Diff | Source-validated | `pnpm run quality:external-source-mapping` |
| 77 | Import Hub Audit, Limits, and Plan Readiness | Source-validated | `pnpm run quality:import-hub-audit-limits` |
| 78 | Export Hub Foundation | Source-validated | `pnpm run quality:export-hub-foundation` |
| 79 | Import Approval Publishing | Source-validated | `pnpm run quality:import-approval-publishing` |
| 80 | AI Media Suggestions Hardening | Source-validated | `pnpm run quality:ai-media` |
| 81 | Export Downloads | Source-validated | `pnpm run quality:export-downloads` |
| 82 | Deployed Import/Export Smoke | Source/deployed smoke | `pnpm run quality:deployed-import-export-smoke` / `pnpm run e2e:deployed:import-export` |
| 83 | Project State Reconciliation and AI Media Readiness | Docs/validation | `pnpm run quality:local` |
| 84 | AI Media Health Gate Audit | Source-validated | `pnpm run quality:ai-media-health-gate` |
| 85 | AI Media MOCK Flow Acceptance | Source-validated | `pnpm run quality:ai-media-mock-flow` |
| 86 | AI Media Durable Storage Acceptance | Source-validated | `pnpm run quality:ai-media-durable-storage` |
| 87 | AI Media Long-Running Job UX | Source-validated | `pnpm run quality:ai-media-long-running-ux` |
| 88 | AI Media Usage Logs, Quotas, and Audit Controls | Source-validated | `pnpm run quality:ai-media-usage-controls` |
| 89 | Import Draft Product to AI Image Suggestion Bridge | Source-validated | `pnpm run quality:import-ai-media-bridge` |
| 90 | Deployed AI Media Rollout Gate | Source/deployed smoke | `pnpm run quality:deployed-ai-media-rollout` / `pnpm run e2e:deployed:ai-media` |
| 91 | AI Media Rollout Evidence Archive | Tooling/docs | `pnpm run quality:ai-media-rollout-evidence` / `pnpm run release:ai-media-rollout-evidence` |
| 92 | AI Media Paid Provider Controls | Source-validated | `pnpm run quality:ai-media-paid-provider-controls` |
| 93 | AI Media Cost Telemetry and Rollback Guardrails | Source-validated | `pnpm run quality:ai-media-cost-rollback` |
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
pnpm run quality:deployed-slug-seo
pnpm run quality:dashboard-slug-editing
pnpm run quality:public-slug-preview-share
pnpm run quality:tenant-og-images
pnpm run quality:deployed-social-preview
pnpm run quality:social-preview-evidence
pnpm run quality:shop-custom-domains
pnpm run quality:shop-domain-admin
pnpm run quality:dashboard-organizations-published
pnpm run quality:vercel-domain-automation
pnpm run quality:custom-domain-seo
pnpm run quality:custom-domain-default-locale
pnpm run quality:custom-domain-smoke
pnpm run quality:platform-default-locale
pnpm run quality:shop-domain-ux
pnpm run quality:import-hub-foundation
pnpm run quality:csv-excel-importer
pnpm run quality:manual-instagram-import
pnpm run quality:text-product-extraction
pnpm run quality:image-pdf-menu-import
pnpm run quality:snappfood-url-import
pnpm run quality:snappmarket-url-import
pnpm run quality:telegram-post-import
pnpm run quality:external-source-mapping
pnpm run quality:import-hub-audit-limits
pnpm run quality:export-hub-foundation
pnpm run quality:import-approval-publishing
pnpm run quality:ai-media
pnpm run quality:deployed-ai-media-rollout
pnpm run quality:ai-media-rollout-evidence
pnpm run quality:ai-media-paid-provider-controls
pnpm run quality:ai-media-cost-rollback
pnpm run quality:export-downloads
pnpm run quality:deployed-import-export-smoke
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

## Deployed AI media rollout validation

Run the deployed AI media rollout gate when validating Bazar Baz dashboard route protection, authenticated readiness, usage quotas, and optional Render MOCK behavior:

```powershell
$env:DEPLOYED_URL="https://bazar-baz.ir"
$env:DEPLOYED_USERNAME="Amir"
$env:DEPLOYED_PASSWORD="<password>"
pnpm run e2e:deployed:ai-media
```

By default, the suite does not mutate catalog images. Set `AI_MEDIA_SERVICE_URL` and `AI_MEDIA_SERVICE_INTERNAL_KEY` to include direct Render MOCK job checks. Set `DEPLOYED_AI_MEDIA_SELECTION_PRODUCT_ID` for an operator-approved product image selection probe, and add `DEPLOYED_AI_MEDIA_REQUIRE_BLOB_SELECTION=1` when Blob durability must be enforced.

Archive operator-safe AI media rollout evidence after a deployed gate run:

```powershell
pnpm run release:ai-media-rollout-evidence
```

The archive is written under `.release/ai-media-rollout-evidence/<timestamp>` with sanitized `evidence.json`, `manifest.json`, and `REVIEW.md`. Keep it with external release records if needed; do not commit it.

## Deployed slug SEO validation

Run the read-only deployed slug SEO suite when validating sitemap, robots, canonical, JSON-LD, social image metadata, and product/service ID-to-slug redirects:

```powershell
$env:DEPLOYED_URL="https://bazar-baz.ir"
pnpm run e2e:deployed:slug-seo
```

The suite samples slug-like category/product/service URLs from the deployed sitemap. Set `DEPLOYED_SLUG_SEO_MAX_PER_KIND` to change sample size. Use `DEPLOYED_SLUG_SEO_ALLOW_EMPTY=1` only for intentionally empty deployments.

## Deployed social preview validation

Run the read-only deployed social preview suite when validating `og:image` resolution and generated/uploaded social-card captures:

```powershell
$env:DEPLOYED_URL="https://bazar-baz.ir"
pnpm run e2e:deployed:social-preview
```

The suite samples deployed sitemap pages for organization, category, product, and service routes, fetches each page `og:image`, captures image bytes under `test-results/deployed-social-preview`, and directly verifies a Persian generated `/og-image?...` card backed by bundled Vazirmatn fonts. Use `DEPLOYED_SOCIAL_PREVIEW_ALLOW_EMPTY=1` only for intentionally sparse non-production deployments, and `DEPLOYED_SOCIAL_PREVIEW_REQUIRE_CATEGORY=1` when category sitemap URLs are expected to be reachable.

## Deployed custom-domain validation

Run the custom-domain smoke suite when validating Persian default locale behavior, platform-to-custom-domain SEO redirects, and clean custom-domain storefront URLs:

```powershell
$env:CUSTOM_DOMAIN_SMOKE_BASE_URL="https://www.khalae.ir"
$env:CUSTOM_DOMAIN_SMOKE_PLATFORM_URL="https://www.bazar-baz.ir"
$env:CUSTOM_DOMAIN_SMOKE_SHOP_SLUG="ahmad"
pnpm run e2e:custom-domain-smoke
```

Run the platform no-locale smoke when validating first-time platform visits default to `fa`:

```powershell
$env:PLATFORM_DEFAULT_LOCALE_BASE_URL="https://www.bazar-baz.ir"
pnpm run e2e:platform-default-locale
```

## Social preview release evidence

After a deployed social preview smoke pass, archive review evidence outside committed source:

```powershell
pnpm run release:social-preview-evidence
```

The archive is written under `.release/social-preview-evidence/<timestamp>` with copied captures, `manifest.json`, `evidence.json`, and `REVIEW.md`. Keep this directory in external release records if needed; do not commit it.

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

Latest completed implementation phase: **P93 - AI Media Cost Telemetry and Rollback Guardrails**.

Recommended next phase: **P94 - AI Media Seller-Facing Paid Provider State UX**.

The active roadmap is `docs/IMPORT_HUB_ROADMAP.md` plus `docs/PHASE_79_IMPORT_APPROVAL_PUBLISHING.md`, `docs/PHASE_80_AI_MEDIA_SUGGESTIONS.md`, `docs/PHASE_81_EXPORT_DOWNLOADS.md`, `docs/PHASE_82_DEPLOYED_IMPORT_EXPORT_SMOKE.md`, `docs/PHASE_83_PROJECT_STATE_RECONCILIATION.md`, `docs/PHASE_84_AI_MEDIA_HEALTH_GATE.md`, `docs/PHASE_85_AI_MEDIA_MOCK_FLOW.md`, `docs/PHASE_86_AI_MEDIA_DURABLE_STORAGE.md`, `docs/PHASE_87_AI_MEDIA_LONG_RUNNING_UX.md`, `docs/PHASE_88_AI_MEDIA_USAGE_CONTROLS.md`, `docs/PHASE_89_IMPORT_AI_MEDIA_BRIDGE.md`, `docs/PHASE_90_DEPLOYED_AI_MEDIA_ROLLOUT_GATE.md`, `docs/PHASE_91_AI_MEDIA_ROLLOUT_EVIDENCE.md`, `docs/PHASE_92_AI_MEDIA_PAID_PROVIDER_CONTROLS.md`, and `docs/PHASE_93_AI_MEDIA_COST_ROLLBACK.md`. P68-P93 are implemented. Next AI media work should focus on Persian seller-facing paid-provider state UX.

## Historical validator anchors

The source tree keeps focused validators for these retained phases: P37 dashboard navigation and localized shell copy, P38 dashboard role navigation, P39 dashboard route parity, P40 dashboard route authorization, P41 dashboard route guard smoke, P42 Customer Club foundation, P43 in-app notification inbox, P44 Customer Segments, P45 Campaign Builder, P46 Loyalty Points and Coupons, P47 Web Push Opt-In Foundation, P68 Import Hub Foundation, P69 CSV/Excel Product Importer, P70 Manual Instagram Fanpage Import, P71 AI/Text Product Extraction Foundation, P72 Image/PDF Menu Import Foundation, P73 Snappfood URL Import MVP, P74 Snappmarket URL Import MVP, P75 Telegram Post Import, P76 External Source Mapping and Re-import Diff, P77 Import Hub Audit, Limits, and Plan Readiness, P78 Export Hub Foundation, P79 Import Approval Publishing, P80 AI Media Suggestions Hardening, P81 Export Downloads, P82 Deployed Import/Export Smoke, P83 Project State Reconciliation, P84 AI Media Health Gate, P85 AI Media MOCK Flow, P86 AI Media Durable Storage, P87 AI Media Long-Running Job UX, P88 AI Media Usage Controls, P89 Import AI Media Bridge, P90 Deployed AI Media Rollout Gate, P91 AI Media Rollout Evidence Archive, P92 AI Media Paid Provider Controls, and P93 AI Media Cost Telemetry and Rollback Guardrails.
