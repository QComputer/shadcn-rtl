# Current Source of Truth — Bazar Baz

Date: 2026-07-15

## 2026-08-02 context-aware public footer

`BAZAR-BAZ-CONTEXT-AWARE-PUBLIC-FOOTER-01` separates platform and tenant public
footers. The locale layout now renders the Bazar Baz platform footer only when
the server-side footer context is `platform`; shop, service/appointment, and app
shells receive explicit `shop`, `service`, or `none` contexts from `proxy.ts`.

Public shop pages and custom-domain shop rewrites render a shop-specific footer
from the current active organization projection. Public appointment/service
organization pages render an organization-specific footer. Dashboard and auth
surfaces do not receive an unrelated public footer.

No Prisma migration is added. No Production migration, Production DB write,
Production storage write, AI job, real generation, wallet, ledger, or payment
mutation is part of this phase. See
`docs/public/CONTEXT_AWARE_PUBLIC_FOOTER.md`.

## 2026-08-02 shop in-page category filtering

`BAZAR-BAZ-SHOP-IN-PAGE-CATEGORY-FILTER-01` changes the interactive public shop
menu UX so category controls filter products in place instead of navigating to a
category route. The main shop page keeps cart/search/view state mounted, stores
the selected category as client state (`selectedCategoryId: string | null`), and
derives visible products through `lib/shop-menu-filter.ts`.

Normal category clicks now use accessible buttons with `aria-pressed`; they do
not call `router.push`, do not change pathname, and do not request
`/category/...`. Direct category URLs remain safe compatibility/SEO pages and
still decode percent-encoded Persian slugs.

No Prisma migration is added. No Production migration or Production DB mutation
is part of this phase. See `docs/shop/SHOP_IN_PAGE_CATEGORY_FILTER.md`.

## 2026-08-02 custom-domain category routing hotfix

`BAZAR-BAZ-CUSTOM-DOMAIN-CATEGORY-ROUTING-HOTFIX-01` repairs the public shop
category URL contract for tenant custom domains. Production reproduction showed
`https://www.cafechakme.ir/` and the public shop API returning 200 while
`https://www.cafechakme.ir/category/<persian-category-slug>` returned a 404
Server Components error page. Vercel logs showed category-path 404s but no
matching `P2022`, `aiPrimaryMediaAssetId`, `column does not exist`, or
`PrismaClientKnownRequestError` entry.

The source fix adds `lib/shop-public-paths.ts` as the shared public shop path
builder. Platform category URLs remain
`/<locale>/shop/<shopSlug>/category/<categorySlugOrId>`, while default-locale
custom-domain category URLs are now `/category/<categorySlugOrId>`. The shop
root client page and server-rendered category page now use this shared helper
for category links, product links, slug redirects, pagination, and JSON-LD URLs.

No Prisma migration is added. The Product/Service AI-media attachment migration
`20260719010000_add_ai_media_entity_attachments` remains unauthorized and
unconfirmed in Production. Category route AI-media field reads remain protected
by `canReadAiMediaEntityAttachmentColumns()`.

See `docs/hotfixes/CUSTOM_DOMAIN_CATEGORY_ROUTING_HOTFIX.md`.

## 2026-07-19 AI media product/service attachment update

`BAZAR-BAZ-AI-MEDIA-PRODUCT-SERVICE-ATTACHMENT-01` is implemented in source.
It adds nullable Product/Service primary AI-media attachment references,
entity-scoped dashboard attach/detach APIs, public media streaming routes,
a Persian-first dashboard asset picker, unit/static validators, and a
disposable local Docker MOCK E2E gate.

The phase attaches only already imported, Bazar-owned `AiMediaAsset` records.
It does not store provider URLs or storage keys in Product/Service image fields,
does not delete assets on replacement, and keeps manual image URLs as fallback.
Production/hosted Preview DB writes, Production Blob operations, Render real
generation, wallet/ledger mutation, and P07 import remain out of scope.

Current recommended AI-media next phase:
`BAZAR-BAZ-AI-MEDIA-ASSET-LIBRARY-LIFECYCLE-01`.

## 2026-07-19 BB-DB-02 update

`BAZAR-BAZ-DATABASE-SCHEMA-DRIFT-NORMALIZATION-01` normalizes the remaining
Prisma schema drift after migration-chain recovery. Source adds the forward
migration `20260719000000_normalize_schema_drift`, local-only Docker proof
tooling, and `docs/database/DATABASE_SCHEMA_DRIFT_NORMALIZATION.md`.

The phase targets `ImageAccess`, `DomainStatus`, FK/default/timestamp drift, and
naming-only index drift. It must be accepted only when fresh and upgrade
`prisma migrate deploy` proofs finish with empty final `prisma migrate diff`
results. No Production migration is run by this source phase.

## 2026-07-15 BB-AI-MEDIA-P04A-P06A update

BB-AI-MEDIA-P04A-P06A app-managed storage acceptance is implemented in source. It adds a server-only application storage gateway, a production Vercel Blob adapter isolated behind that gateway, a local-test storage adapter, hermetic environment guards, a local contract-faithful MOCK provider, and a repeatable `pnpm run test:ai-media:hermetic` lifecycle.

The accepted local lifecycle uses disposable local PostgreSQL, synthetic fixtures, local MOCK provider output, and temporary local storage. Codex had no direct Production Blob access, no Production Blob credential was needed, and no Production Blob object was listed, uploaded, or deleted. Production storage is application-managed by the deployed Bazar Baz server only. Deployed Preview acceptance remains deferred, and real Render/GPU generation remains disabled pending separate explicit authorization.

BB-AI-MEDIA-P06A hardening removes the local-test storage adapter from the production gateway import graph. Hermetic tests inject the local adapter explicitly in `NODE_ENV=test`; production feature code cannot construct it. The local concurrent idempotency matrix covers 10-way duplicate submit, payload conflict, cross-tenant same-key isolation, provider accepted/lost-response recovery, and concurrent result ingestion with one storage object.

Current recommended AI-media next phase: P07 remains prepared only by `docs/ai-media/AI_MEDIA_P07_CONTROLLED_PRODUCTION_IMPORT_RUNBOOK.md`. Future P07 Production asset import requires separate authorization through the deployed application storage gateway and does not grant direct Blob access.

## 2026-07-15 BASELINE-01 update

The current source baseline is accepted through **P120F - SMS.ir official report endpoint integration**, **NOTIFOPS-DEPLOY-FIX1**, and **BB-B2B-P12 - Persian-first business onboarding wizard**. Bazar Baz is positioned as a Persian-first B2B service platform for Iranian businesses, not a marketplace, advertising directory, or public social network.

BB-B2B-P11 custom-domain onboarding source is accepted after the P11-FIX1 evidence pass. Source includes organization-scoped custom-domain onboarding, strict domain validation, ACTIVE-only SHOP/APPOINTMENT host routing, exact Vercel mutation acknowledgement gates, provider error sanitization, primary-domain safety, and P11-focused unit coverage. Production migration `20260708000100_custom_domain_onboarding` is required but has not been applied by this source task. Vercel provider configuration and real custom-domain activation remain pending explicit authorization. No real provider mutation, SMS, payment, or unrelated production mutation was performed.

BB-B2B-P12 Business Onboarding Wizard is accepted in source at commit `0769f3f`. It provides a Persian-first `/[locale]/onboarding` flow, deterministic SHOP/APPOINTMENT/hybrid recommendations, required consent, and safe submission through the established `POST /api/request-demo` lead API. P12 does not create organizations/users, send SMS/email, take payments, or activate custom domains.

Current recommended B2B phase: **BB-B2B-P13 - Guided Tenant Provisioning Readiness**.

## 2026-07-15 BB-B2B-P13 update

BB-B2B-P13 Guided Tenant Provisioning Readiness is implemented in source. It adds a SUPER_ADMIN-only tenant-provisioning plan model, idempotent plan generation from request-demo/onboarding leads, mutation-free dry-run validation, READY/APPROVED review states, audit events, and dashboard review UI. P13 does not create organizations, users, memberships, subscriptions, invitations, payments, notifications, or custom-domain provider mutations. Production migration `20260715000100_tenant_provisioning_readiness` is required before deployed use and was not applied by this source task.

## 2026-07-15 DB-NEON-01 update

DB-NEON-01 makes Neon Serverless the canonical database runtime architecture in source. Application runtime database access goes through `lib/db.ts` / `lib/db-runtime.ts`, Prisma Client, `@prisma/adapter-neon`, and pooled `DATABASE_URL`. Prisma CLI and migration operations use direct `DIRECT_URL` through `prisma.config.ts` and Prisma `directUrl`. `DATABASE_URL_UNPOOLED` remains as a temporary legacy compatibility alias for older ops scripts. No production migration was applied by this source task.

Current recommended next phase before P14: **DB-NEON-02 - Authorized Pending Production Migration Deployment**.

Do not proceed to **BB-B2B-P14 - Transactional Tenant Provisioning Execution** until DB-NEON-01 is accepted and pending production migrations are handled through an explicitly authorized database phase.

## 2026-07-15 DB-NEON-02 production migration update

DB-NEON-02 production migration deployment is complete at source commit `a6710fc`. Production Neon now records successful application of:

1. `20260703000100_add_creative_studio_asset_rolled_back`
2. `20260703000200_notification_delivery_attempt`
3. `20260703000300_sms_delivery_guest_customer`
4. `20260708000100_custom_domain_onboarding`
5. `20260715000100_tenant_provisioning_readiness`
6. `20260715000200_custom_domain_status_backfill`

The sixth migration was added during DB-NEON-02 clone rehearsal to move custom-domain legacy status backfill into a transaction after the new enum values had committed. Production had 0 legacy `PENDING`/`FAILED` domain rows remaining after deploy.

Post-deploy read-only verification confirmed the production schema is up to date, no unfinished failed migration remains, migration checksums match source, `ASSET_ROLLED_BACK` exists, `NotificationDeliveryAttempt` exists, `SmsDelivery.customerId` is nullable, `OrganizationDomain.providerVerified` exists, and `TenantProvisioningPlan` exists.

Important caveats:

- The short-form final production authorization allowed `pnpm exec prisma migrate deploy`, but did not literally enumerate the sixth migration or explicitly authorize retry behavior after the first generic Prisma schema-engine failure.
- Vercel deployment metadata showed the latest `a6710fc` production deployment in `ERROR` state; the current READY production deployment was still `f392ee3`. The production database is migrated, but the production application source was not confirmed synchronized to `a6710fc`.
- `quality:local` was run and failed with 24 existing non-DB issues. Do not claim the global quality suite is green.

Current recommended next operational step: fix/verify Vercel production deployment of `a6710fc`, then re-run deployed smoke. **BB-B2B-P14 - Transactional Tenant Provisioning Execution** remains the recommended product phase only after source deployment sync is restored and a fresh explicit authorization is obtained.

## Current validated baseline

The current working baseline after P120F/NOTIFOPS and BB-B2B-P12 is source-validator green after the BASELINE-01 validation gate.

P119 adds server-mediated provider result polling and internal result ingestion for organization-brand logo/cover outputs. Ingested outputs become draft/review-only Creative Studio assets with provider metadata, dashboard refresh/reject controls, and audit/usage events; public auto-apply remains disabled and `Organization.logo` / `Organization.coverImage` are not mutated by ingestion.

B2B repositioning baseline: BB-B2B-P00, BB-B2B-P01, BB-B2B-P02, BB-B2B-P03, BB-B2B-P04, BB-B2B-P05, BB-B2B-P06, BB-B2B-P07, BB-B2B-P08, BB-B2B-P09, and BB-B2B-P10 completed. Public route policy and decision matrix are documented in `docs/b2b-public-repositioning/`. BB-B2B-P03 replaces the marketplace-like homepage with a Persian-first B2B landing page in `app/[locale]/page.tsx`. BB-B2B-P04 adds curated demo business portfolio and seed strategy. BB-B2B-P05 documents public discovery restriction and demo-only API policy. BB-B2B-P06 adds conversion funnel pages (request-demo, contact, pricing). BB-B2B-P07 adds feature pages (`app/[locale]/features/page.tsx`) and dashboard showcase (`app/[locale]/dashboard-showcase/page.tsx`). BB-B2B-P08 adds trust/legal/SEO/analytics hardening pages (`app/[locale]/trust/page.tsx`, `app/[locale]/privacy/page.tsx`, `app/[locale]/terms/page.tsx`) and footer legal links. BB-B2B-P09 adds a non-browser HTTP production smoke (`scripts/e2e/deployed-b2b-public-surface.mjs` + `e2e:deployed:b2b-public-surface`) and final handoff docs; production (https://www.bazar-baz.ir) verified with all 10 public B2B pages returning 200 and no marketplace discovery. BB-B2B-P10 adds request-demo lead storage, server-side validation, SUPER_ADMIN-only admin review page, and dashboard navigation. Latest accepted commit: `ea9689e`. Production acceptance: PASSED via HTTP smoke. Quality caveat: 25 known legacy validators remain classified as unrelated to the B2B roadmap and are not part of B2B acceptance. Current B2B phase: BB-B2B-P11 — Tenant Custom-domain Onboarding Flow.

Minimum target-machine gate for any implementation phase:

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
  pnpm run quality:b2b-request-demo-leads
```

Clean handoff gate introduced in P33:

```powershell
pnpm run release:stage
pnpm run quality:release-staged
```

Database/migration gate when database credentials and PostgreSQL client tools are available:

```powershell
pnpm run db:drift
pnpm run db:migrate:neon:dry-run
```

## Current product and architecture state

- Next.js 16 App Router with localized routes under `app/[locale]`.
- Supported locales: `fa`, `en`, `ar`; Persian (`fa`) is the first-visit public locale, `/` redirects to `/fa`, and dictionary leaf-key parity is enforced by `quality:i18n-completion`.
- Multi-tenant organization model supports `SHOP` and `APPOINTMENT` organization types.
- Dashboard workflows cover appointments, calendar, notifications, organizations, members, Customer Club, Customer Segments, Campaign Builder, Loyalty, Coupons, products, product categories, orders, QR code, services, service categories, settings, and users.
- Public shop workflows cover shop profile, product detail, checkout, order tracking, and shop fanpage.
- Public appointment workflows cover organization profile, service listing, staff listing, booking, appointment detail, my appointments, and appointment fanpage.
- Follow support exists through `Follow`, `follow.service.ts`, follow/unfollow API, public follow UI, and readiness validators.
- Fanpage MVP exists through `FanpagePost`, `fanpage.service.ts`, public read API, authorized create API, post card/form UI, and both appointment/shop fanpage routes.
- Customer Club foundation exists through `CustomerClubMembership`, `customer-club.service.ts`, self-service membership API, dashboard management API, localized dashboard pages, audit logging, and the `quality:customer-club-foundation` validator.
- In-app notification inbox exists through extended `Notification` organization/actor context, dashboard/customer inbox APIs, dashboard inbox UI, Customer Club in-app broadcast, dry-run recipient preview, audit logging, and the `quality:in-app-notifications` validator.
- Customer Segments MVP exists through `CustomerSegment`, `CustomerSegmentRule`, `CustomerSegmentSnapshot`, `customer-segments.service.ts`, dashboard segment API/UI, tenant-safe Customer Club/order/cart counts, snapshot audit logging, and the `quality:customer-segments` validator.
- Campaign Builder MVP exists through `Campaign`, `CampaignAudience`, `CampaignMessage`, `CampaignDelivery`, `campaign-builder.service.ts`, campaign dashboard APIs/UI, dry-run preview, in-app-only sends, per-recipient delivery rows, cancellation, audit logging, and the `quality:campaign-builder` validator.
- Loyalty Points and Coupons exist through `LoyaltyLedger`, `LoyaltyRule`, `Coupon`, `CouponRedemption`, `loyalty-coupons.service.ts`, dashboard loyalty/coupon APIs and pages, append-only point accounting, coupon date/count/customer/segment enforcement, audit logging, and the `quality:loyalty-coupons` validator.
- Web Push Opt-In Foundation exists through `PushSubscription`, `NotificationPermissionEvent`, `web-push-foundation.service.ts`, customer opt-in/unsubscribe API/UI, dashboard push status/dry-run API/UI, VAPID/feature-flag env validation, and the `quality:web-push-foundation` validator. Real external delivery remains disabled by default.
- Public SEO Foundation exists through `lib/seo.ts`, `components/seo/json-ld.tsx`, public route metadata, product/service/fanpage JSON-LD, dynamic `app/robots.ts`, dynamic `app/sitemap.ts`, and the `quality:public-seo` validator.
- Public SEO QA and Rich Preview Hardening exists through generated `app/og-image/route.tsx`, noindex layouts for transactional public surfaces, expanded robots disallows, and the `quality:public-seo-qa` validator.
- Public Category SEO exists through indexable product-category and service-category routes, category CollectionPage/ItemList/breadcrumb JSON-LD, category sitemap entries, and the `quality:public-category-seo` validator.
- Category slug and public pagination support exists through category `slug` columns, `lib/category-slugs.ts`, slug-first category links/sitemap entries, ID-to-slug category redirects, page-aware category metadata, and the `quality:public-category-slugs-pagination` validator.
- Public detail slug support exists through product/service `slug` columns, `lib/detail-slugs.ts`, slug-first product/service links/search/sitemap entries, ID-to-slug public detail redirects, and the `quality:public-detail-slugs` validator.
- Deployed slug SEO verification exists through `scripts/e2e/deployed-slug-seo.mjs`, `e2e:deployed:slug-seo`, and `quality:deployed-slug-seo`; it checks deployed robots/sitemap, sampled slug canonical links, JSON-LD, `og:image`, slug API resolution, and product/service ID-to-slug redirects.
- Dashboard slug editing exists for product categories, service categories, products, and services, with ID-based mutation routes preserved and `quality:dashboard-slug-editing` enforcing the UI controls.
- Public slug preview/share polish exists through dashboard slug copy/open controls, deployment-origin URL previews, explicit social image dimensions/alt text, and stronger product/service/category image fallbacks, with `quality:public-slug-preview-share`.
- Tenant-specific Open Graph image generation exists through parameterized `/og-image` cards, generated organization/category/product/service fallback image URLs, uploaded-media-first share metadata, and the `quality:tenant-og-images` validator.
- Deployed social preview verification exists through `scripts/e2e/deployed-social-preview.mjs`, Persian generated-card and uploaded-image `og:image` capture checks, deployed sitemap sampling, bundled Vazirmatn OG fonts, and the `quality:deployed-social-preview` validator.
- Social preview release evidence exists through `scripts/release/archive-social-preview-evidence.mjs`, `.release/social-preview-evidence` archives, `evidence.json`, generated `REVIEW.md` checklists, `docs/RELEASE_NOTES_TEMPLATE.md`, and the `quality:social-preview-evidence` validator.
- Shop custom-domain foundation exists through `OrganizationDomain`, custom-domain-aware `proxy.ts` routing, tenant-safe domain lookup, a domain-not-configured fallback, and the `quality:shop-custom-domains` validator.
- SUPER_ADMIN shop-domain management exists at `/{locale}/dashboard/shop-domains`, with provision/remove/status/primary controls guarded to SUPER_ADMIN and validated by `quality:shop-domain-admin` and `quality:shop-domain-ux`.
- Vercel custom-domain automation exists through dry-run-safe domain provisioning helpers, `scripts/ops/push-vercel-env.ps1`, and `quality:vercel-domain-automation`.
- Custom-domain SEO hardening exists through tenant-aware robots/sitemap output, platform-to-primary-custom-domain redirects for indexable shop pages, transactional-route redirect exclusions, and `quality:custom-domain-seo`.
- Custom-domain and platform no-locale visits default to Persian (`fa`) through the current proxy behavior, with `quality:custom-domain-default-locale`, `quality:platform-default-locale`, `e2e:custom-domain-smoke`, and `e2e:platform-default-locale`.
- Dashboard organizations is a SUPER_ADMIN-only localized route at `/{locale}/dashboard/organizations`, backed by hardened `/api/organizations` access and validated by `quality:dashboard-organizations-published`.
- Import Hub Foundation exists through external import source/job/draft models, consent-based intake, source detection, draft review APIs, localized `/dashboard/imports` UI, and the `quality:import-hub-foundation` validator. P68 does not perform scraping, real external provider calls, Blob copying, or pre-review publishing.
- CSV/Excel Product Importer exists through `xlsx` parsing, `lib/import-hub/spreadsheet-parser.ts`, file intake on `/dashboard/imports`, row-level `ImportedProductDraft` creation, draft approval/rejection UI, and the `quality:csv-excel-importer` validator. P69 product rows remain drafts until explicit approval.
- Manual Instagram Fanpage Import exists through `lib/import-hub/instagram-manual-parser.ts`, seller-provided Instagram URL/caption/media reference intake, `ImportedContentDraft` creation, draft approval/rejection UI, and the `quality:manual-instagram-import` validator. P70 does not scrape Instagram, call Instagram APIs, or copy media to Blob.
- AI/Text Product Extraction Foundation exists through `lib/import-hub/text-extraction-provider.ts`, `lib/import-hub/text-product-extractor.ts`, dry-run local rule-based parsing, confidence metadata on `ImportedProductDraft` rows, dashboard review display, and the `quality:text-product-extraction` validator. P71 does not call external AI providers or create live products.
- Image/PDF Menu Import Foundation exists through `lib/import-hub/menu-ocr-fixtures.ts`, PDF/image file intake classification, dry-run OCR fixture rows saved as `ImportedProductDraft`, real OCR disabled by default, and the `quality:image-pdf-menu-import` validator. P72 does not call OCR, vision, AI, or network providers.
- Snappfood URL Import MVP exists through `lib/import-hub/snappfood-adapter.ts`, `snappfood.ir` URL validation, disabled-by-default public fetching, fallback product drafts, source evidence, and the `quality:snappfood-url-import` validator. P73 does not crawl Snappfood or create live products.
- Snappmarket URL Import MVP exists through `lib/import-hub/snappmarket-adapter.ts`, `snapp.market`/`snappmarket.ir` URL validation, disabled-by-default public fetching, fallback product drafts, source evidence, and the `quality:snappmarket-url-import` validator. P74 does not crawl Snappmarket or create live products.
- Telegram Post Import exists through `lib/import-hub/telegram-manual-parser.ts`, public Telegram post URL validation, pasted content/media-reference intake, `ImportedContentDraft` creation, and the `quality:telegram-post-import` validator. P75 does not fetch Telegram.
- External Source Mapping and Re-import Diff exists through `lib/import-hub/source-mapping.ts`, duplicate source URL/external ID detection, `sourceMetadata.reimport` diff summaries, `POST /api/dashboard/imports/jobs/[jobId]/resolve`, dashboard merge/skip/create-new controls, audit logging, and the `quality:external-source-mapping` validator. P76 does not publish content or apply live product/post merges.
- Import Hub Audit, Limits, and Plan Readiness exists through `lib/import-hub/limits.ts`, per-organization active/daily/draft limits, audit event API, retry policy, safer cancellation policy, dashboard audit event display, and the `quality:import-hub-audit-limits` validator.
- Export Hub Foundation exists through the `ExportJob` model/migration, `lib/services/export-hub.service.ts`, organization-scoped export job APIs, localized `/dashboard/exports` UI, dashboard navigation/access policy, CSV/JSON payload generation for products/categories/orders/customers/fanpage posts, audit logging, and the `quality:export-hub-foundation` validator.
- Import Approval Publishing exists through the approval-to-live `ImportHubService.reviewDrafts("APPROVED")` path, approved product draft publishing into live products/categories/default variants, approved content draft publishing into live fanpage posts, `IMPORTED` draft status, all-locale public path/home cache revalidation, localized dashboard approve-and-publish copy, audit logging, and the `quality:import-approval-publishing` validator.
- AI Media Suggestions Hardening exists through `AiMediaJob`, server-only AI media client calls, authenticated product-scoped suggestion APIs, completed-job output validation before image selection, public product/home cache revalidation, Persian-first product edit UI, `docs/AI_MEDIA_SERVICE.md`, deployed unauthenticated smoke coverage, and the `quality:ai-media` validator. Bazar Baz calls only the deployed Render AI media service and does not call local workers directly.
- BB-AI-MEDIA-P04-P06 Preview MOCK lifecycle is blocked before any lifecycle write because Vercel Preview currently shares the production `DATABASE_URL`, `DIRECT_URL`, and `DATABASE_URL_UNPOOLED`. The 2026-07-15 isolation recovery attempt stopped at Neon management discovery because the configured Neon API keys returned `403` and no `NEON_PROJECT_ID` was available for safe branch creation. No Preview job, provider job, Blob asset, Creative Studio asset, Neon branch, Vercel env mutation, or Production mutation was created. See `docs/ai-media/AI_MEDIA_PREVIEW_RESOURCE_PLAN.md`, `docs/ai-media/AI_MEDIA_PREVIEW_ISOLATION_REPORT.md`, and `docs/ai-media/AI_MEDIA_P04_P06_VALIDATION_REPORT.md`.
- AI selected-image durability exists through `lib/media-storage.ts` and `AiMediaService.selectImage()`: selected AI outputs are copied to Vercel Blob when `BLOB_READ_WRITE_TOKEN` is configured, with the remote Render URL used as a documented fallback. Real paid AI generation remains disabled; usage quotas and deployed rollout guards are implemented.
- AI Media Health Gate exists through `getAiMediaServiceConfigStatus()`, `checkAiMediaServiceReadiness()`, authenticated `/api/dashboard/ai-media/status`, optional `?check=1` Render `/health` and `/ready` probes, secret-safe readiness responses, timeout normalization, and the `quality:ai-media-health-gate` validator.
- AI Media MOCK Flow Acceptance exists through dashboard-access-gated status checks, product edit MOCK job creation/polling, `outputs`/`output_images` compatibility, retryable no-output and non-terminal error states, API-returned selected image URL application, authenticated deployed-smoke expectations, and the `quality:ai-media-mock-flow` validator.
- AI Media Durable Storage Acceptance exists through validated remote image MIME/signature checks before Blob writes, oversized remote image rejection, explicit `storageStatus` selection metadata, remote fallback warnings, public path/home revalidation after selected URL replacement, and the `quality:ai-media-durable-storage` validator.
- AI Media Long-Running Job UX exists through cleanup-safe bounded polling, local `AiMediaJob` snapshot fallback when Render checks are unavailable, latest product job recovery, provider/timestamp/status display, retry/continue/cancel seller controls, an organization-scoped cancel route, and the `quality:ai-media-long-running-ux` validator.
- AI Media Usage Controls exist through `AiMediaUsageEvent`, daily organization quota checks before job creation, usage events for job lifecycle/selection/cancel actions, authenticated `/api/dashboard/ai-media/usage`, explicit `paidGenerationEnabled: false`, and the `quality:ai-media-usage-controls` validator.
- Import-to-AI-Media Bridge exists through `ImportedProductDraft.importedProductId`, AI-media prompt context stored only after approved drafts become `IMPORTED`, product edit AI prompt fallback from imported context, import row `تصویر AI` links, and the `quality:import-ai-media-bridge` validator.
- Deployed AI Media Rollout Gate exists through `scripts/e2e/deployed-ai-media-smoke.mjs`, authenticated Bazar Baz status and usage checks, unauthenticated protected-route guards, optional direct Render MOCK checks, optional Blob-backed selection probe, and the `quality:deployed-ai-media-rollout` validator.
- AI Media Rollout Evidence Archive exists through sanitized `test-results/deployed-ai-media-rollout/evidence.json`, `scripts/release/archive-ai-media-rollout-evidence.mjs`, `.release/ai-media-rollout-evidence` archives, `REVIEW.md`, explicit paid-provider enablement checklist, and the `quality:ai-media-rollout-evidence` validator.
- AI Media Paid Provider Controls exist through server-only `getAiMediaPaidProviderStatus()`, explicit approval and cost-guardrail env prerequisites, runtime-env validation, secret-safe status/usage API policy summaries, deployed smoke assertions that paid generation stays disabled by default, and the `quality:ai-media-paid-provider-controls` validator.
- AI Media Cost Telemetry and Rollback Guardrails exist through estimated job cost env policy, rollback pause env policy, usage-event estimated cost metadata, usage cost telemetry summaries, cost-limit/budget create guards, rollout evidence cost/rollback capture, and the `quality:ai-media-cost-rollback` validator.
- AI Media Seller-Facing Paid Provider State UX exists through `components/dashboard/ai-media-provider-state.tsx`, product edit/new status and usage fetches, Persian-first disabled/MOCK/approved/budget-exhausted/rollback-paused messages, generation disabling when the seller state is not startable, and the `quality:ai-media-seller-state-ux` validator.
- Source Cleanup and Current-State Verification exists through placeholder-only `.env.example` SMS/Web Push/PWA variables, removal of tracked local DB and personal public PDF artifacts, removal of the unused duplicate provider wrapper, env alias validation for the new dry-run placeholders, source-baseline security checks, and the `quality:source-baseline` validator.
- Open Fields and Workflow Completion Audit exists through shared payment/booking-settings validators, organization `[id]` to slug resolution for booking settings, schema-validated payment settings updates, editable dashboard `paymentCondition` controls, localized FA/EN/AR copy, and the `quality:open-fields-audit` validator.
- PWA Foundation and Install Experience exists through `app/manifest.ts`, SVG PWA icons, locale-layout manifest/install metadata, a guarded global install prompt manager, shared `/web-push-sw.js` registration, service-worker install/activate lifecycle handlers, Persian-first `/fa` start URL, and the `quality:pwa-foundation` validator.
- Creative Studio integration planning exists through `docs/PHASE_107_CREATIVE_STUDIO_INTEGRATION_PLANNING.md` and `quality:creative-studio-planning`, defining a planning-only server boundary, consent model, access policy, candidate server data model, API plan, Persian-first UX constraints, and rollout gates.
- Creative Studio server foundation exists through `CreativeStudioJob`, `CreativeStudioAsset`, and `CreativeStudioUsageEvent` schema/migration, `creative-studio.service.ts`, dashboard-only status/usage/job/apply-intent APIs, MOCK-only draft asset creation, audit/usage events, organization/role/target access checks, and the `quality:creative-studio-foundation` validator. P108 does not mutate public assets or call real providers.
- Creative Studio dashboard review exists through localized `/dashboard/creative-studio`, dashboard navigation/route policy, read-only status/usage/job/detail fetches, organization-context review for SUPER_ADMIN, Persian-first copy, and the `quality:creative-studio-dashboard` validator. P109 does not expose generation or public apply controls.
- Creative Studio apply controls exist through confirmation-gated dashboard actions, `applyCreativeStudioAssetSchema` target fields, safe public URL checks, target ownership and permission checks, public mutations for product image, organization logo, organization cover, and fanpage post image, rollback metadata, audit/usage events, all-locale cache revalidation, and the `quality:creative-studio-apply-controls` validator. P110 does not mutate campaigns, OG images, import media, or start generation.
- Creative Studio generation readiness exists through a server-only `creative-studio-generation-readiness.ts` helper, `getStatus({ checkGenerationReadiness })`, `/api/dashboard/creative-studio/status?check=1`, Persian-first readiness dashboard copy, product-image-only AI media contract metadata, secret-safe service/paid-provider status, and the `quality:creative-studio-generation-readiness` validator. P111 does not add direct browser worker calls, new providers, or public auto-apply behavior.
- Creative Studio product-image generation controls exist through `/dashboard/creative-studio` product selector/prompt/count/aspect/style controls, `/api/dashboard/creative-studio/jobs` product-image POSTs, server-only `aiMediaService.createJob()` reuse, `p112Generation.remoteJobId` persistence, status/output sync on list/detail reads, draft `CreativeStudioAsset` creation for completed outputs, cancel/continue-polling controls, and the `quality:creative-studio-product-image-generation` validator. P112 does not add organization brand, fanpage, campaign, import-media, new-provider, browser-worker, or auto-apply generation.
- Creative Studio generated-asset selection polish exists through `/api/dashboard/creative-studio/assets/[assetId]/select`, `selectCreativeStudioAssetSchema`, `creativeStudioService.selectAsset`, one-selected-candidate-per-job status handling, `ASSET_SELECTED` usage events, audit logs, Persian-first review copy, deployed Creative Studio acceptance smoke coverage, and the `quality:creative-studio-generated-asset-selection` validator. P113 does not apply public images automatically, bulk-apply assets, add new providers, or expand generation beyond product images.
- Creative Studio organization-brand generation readiness exists through the server-only `organizationBrandPlan` in `creative-studio-generation-readiness.ts`, planned `LOGO` and `COVER` targets, the future `creative-studio-organization-brand-v1` provider contract, Persian-first logo/cover readiness dashboard copy, schema validation that organization-brand jobs only use logo/cover assets, and the `quality:creative-studio-organization-brand-readiness` validator. P114 does not enable live logo/cover generation, provider calls, browser-worker calls, or public auto-apply.
- Creative Studio organization logo and cover request controls exist through request-only dashboard controls, explicit `createOrganizationBrandGenerationRequest()` service routing, P115 `p115BrandGeneration` metadata on jobs/assets, settings-manage authorization, deterministic logo/cover target-field and aspect-ratio mapping, and the `quality:creative-studio-organization-brand-request-controls` validator. P115 does not implement organization-brand provider execution, browser-worker calls, direct `/v1/organization-brand/jobs` calls, or public auto-apply.
- Creative Studio organization logo and cover generated-asset acceptance exists through selected-candidate enforcement before organization-brand public apply, selected target-field matching, P116 acceptance metadata, deployed smoke coverage for request-only logo drafts, and the `quality:creative-studio-organization-brand-acceptance` validator. P116 does not implement organization-brand provider execution or public auto-apply.
- Creative Studio organization-brand provider execution rollout gate exists through the server-only `getOrganizationBrandProviderStatus()` helper, runtime env validation, secret-safe `.env.example` placeholders, P117 gate metadata on request-only logo/cover jobs, admin dashboard rollout badges, deployed smoke coverage, and the `quality:creative-studio-organization-brand-provider-rollout` validator. P117 keeps provider execution gated, does not bypass selected-candidate review, and does not enable public auto-apply.
- Creative Studio organization-brand provider execution wiring exists through a server-only AI Media Service organization-brand client, authenticated `/api/dashboard/creative-studio/organization-brand/execute`, explicit execution and dry-run gates, remote-job synchronization for draft logo/cover assets, P118 execution metadata, deployed smoke coverage for safe dry-run behavior, and the `quality:creative-studio-organization-brand-provider-execution` validator. P118 does not call local GPU/ComfyUI workers, expose provider secrets to the browser, mutate `Organization.logo`/`coverImage` during generation, or enable public auto-apply.
- Creative Studio provider result ingestion exists through the centralized `creative-studio-provider-output` validator, server-only `getOrganizationBrandGenerationResult()`, idempotent `ingestOrganizationBrandProviderResult()`, trusted internal provider-result ingestion route, dashboard refresh/check route, dashboard reject/archive route, Persian-first review-only dashboard copy, deployed smoke coverage, and the `quality:creative-studio-provider-result-ingestion` validator. P119 ingests LOGO/COVER outputs as draft/review-only assets, requires internal secrets for webhook-style ingestion, rejects unsafe file/private/local output URLs, never calls ComfyUI/local GPU workers directly, and does not mutate public logo/cover/product/fanpage images.
- Explicit manual apply and rollback for reviewed organization-brand assets exist through POST /api/dashboard/creative-studio/assets/[assetId]/apply, explicit confirmation requirement, centralized URL safety validation, rollback metadata storage, ASSET_APPLIED and ASSET_ROLLED_BACK usage events, public cache revalidation, Persian-first dashboard apply/rollback UI, and the quality:creative-studio-reviewed-asset-apply validator. P120 only mutates Organization.logo or Organization.coverImage through explicit confirmation; provider execution and result ingestion remain draft/review-only with publicAutoApply: false.
- Operational order notifications exist through `OperationalNotificationRouter`, in-app staff notifications for ADMIN/MANAGER/STAFF roles only, Web Push opt-in for dashboard users at `/api/dashboard/push-subscriptions`, customer phone visibility in order details, Persian status transition buttons, dashboard push opt-in component, and the `quality:order-operational-notifications` and `quality:admin-order-controls` validators. P120A keeps notification delivery non-blocking and does not send SMS or notify CUSTOMER/GUEST/DRIVER users.
- Customer order lifecycle notifications exist through `CustomerOrderLifecycleRouter`, registered-customer in-app/Web Push/SMS routing on order status and payment status changes, guest SMS dry-run audit-only path, preference-aware delivery via `notificationRouterService`, non-blocking notification delivery from `orderService.updateStatus()` and `updatePaymentStatus()`, and the `quality:customer-order-lifecycle-notifications` and `quality:guest-sms-dry-run` validators. P120B notifies registered customers on lifecycle changes; guest customers receive no in-app/Web Push and no real SMS.
- Notification delivery observability and retry eligibility metadata exists through `NotificationDeliveryAttempt`, non-blocking delivery attempt recording in `NotificationRouterService`, `OperationalNotificationRouter`, `SmsService`, `WebPushFoundationService`, and `CustomerOrderLifecycleRouter`, conservative retry policy (max 3 retries, IN_APP and guest SMS excluded, deterministic 5m/30m/2h backoff), dashboard delivery attempt visibility, and the `quality:notification-delivery-observability` and `quality:notification-retry-policy` validators. P120C records delivery outcomes for telemetry; retry metadata is eligibility-only and actual resend is deferred to a future phase.
 - SMS.ir provider completion exists through server-only `lib/sms/sms-ir-client.server.ts`, `SmsIrProvider` with `getLines`, `sendBulk`, `sendLikeToLike`, `sendVerifyCode`, Iranian mobile normalization, schedule validation, max 100 recipient enforcement, dry-run default, explicit real-send gates (`SMS_REAL_SEND_ENABLED`, `DEPLOYED_ALLOW_REAL_SMS`, `SMS_IR_ALLOW_REAL_SEND_ACK`), guest dry-run via `smsService.sendTextToPhone`, dashboard SMS diagnostics endpoints (`/api/dashboard/notification-operations/sms-ir/status`, `/api/dashboard/notification-operations/sms-ir/lines`), `SmsDelivery` customerId nullable migration, and the `quality:sms-ir-provider-completion` and `quality:sms-real-send-gates` validators. P120D keeps real SMS disabled by default and does not expose the SMS.ir API key to the browser. P120D is accepted only after P120D-FIX2 leaves `quality:local` green.
 - SMS delivery reports and provider reconciliation exist through `SmsDeliveryReportService`, internal reconciliation using stored `SmsDelivery` and `NotificationDeliveryAttempt` records, dashboard report API (`/api/dashboard/notification-operations/sms-ir/deliveries`), dashboard report UI with masked phones, Persian report labels, provider report unavailable/docs-required state (`SMS_IR_REPORT_ENDPOINT_NOT_CONFIGURED`), and the `quality:sms-delivery-reports` and `quality:sms-provider-reconciliation` validators. P120E does not send SMS during reconciliation and does not expose the SMS.ir API key to the browser. Provider-side report polling remains unavailable until official SMS.ir report endpoint documentation is provided.
- Offline Shell, Caching, and PWA Quality Gates exist through `public/offline.html`, versioned static service-worker caching, network-first navigation fallback, cache-first static PWA/Next assets, explicit network-only bypasses for API/uploads/dashboard/checkout/booking/order/payment/customer-state routes, and the `quality:pwa-offline-shell` validator.
- Notification domain model and preferences exists through `NotificationChannel`, `NotificationPreference`, authenticated customer preference APIs, `notificationPreferencesService`, Web Push opt-in synchronization, Persian-first public preference controls, and the `quality:notification-preferences` validator.
- Web Push notification service exists through `WebPushDelivery`, preference-aware recipient planning, real delivery attempt logging, invalid subscription cleanup, dashboard delivery history, environment-gated real sends, and the `quality:web-push-delivery` validator.
- SMS provider abstraction exists through `SmsDelivery`, server-only `lib/sms/*` provider boundaries, dry-run default delivery records, sms.ir REST integration behind explicit env config, SMS notification preference checks before delivery, masked phone persistence/audit metadata, runtime env validation, and the `quality:sms-provider` validator.
- Notification routing exists through Persian-first reusable templates, per-template delivery policies, `notificationRouterService`, single-customer Web Push delivery, SMS/in-app/Web Push service boundaries, channel preference checks, dry-run route previews, audit logging, and the `quality:notification-routing` validator.
- Notification operations dashboard exists through `notificationOperationsService`, guarded `/api/dashboard/notification-operations`, localized `/dashboard/notification-operations`, operator-role navigation, in-app/Web Push/SMS delivery counts, provider readiness badges, recent delivery rows, and the `quality:notification-operations` validator.
- Deployed PWA, Push, and SMS smoke exists through `scripts/e2e/deployed-pwa-push-sms-smoke.mjs`, `e2e:deployed:pwa-push-sms`, Persian default-locale/manifest/offline/service-worker checks, dashboard/customer notification readiness checks, dry-run provider safety assertions, redacted evidence, and the `quality:deployed-pwa-push-sms` validator.
- Production rollout runbook exists through `docs/PHASE_105_PRODUCTION_ROLLOUT_RUNBOOK.md`, explicit PWA/Web Push/SMS provider enablement stages, notification-operations monitoring and rollback checklists, PWA/Push/SMS evidence archiving, release-note ownership fields, and the `quality:production-rollout` validator.
- PWA/Push/SMS source acceptance and secretless packaging gate exists through `docs/PHASE_106_PWA_PUSH_SMS_ACCEPTANCE_GATE.md`, `quality:pwa-push-sms-acceptance`, `release:clean-source`, `quality:clean-source`, `release:pwa-push-sms-acceptance-evidence`, `.env` tracking checks, clean ZIP verification, and stricter real-send SMS/Web Push guardrails.
- Export Downloads exists through protected `GET /api/dashboard/exports/jobs/[jobId]/download`, completed-job checks, private no-store attachment responses, lightweight export job list responses, Persian-first dashboard download actions, and the `quality:export-downloads` validator.
- Deployed Import/Export Smoke exists through `scripts/e2e/deployed-import-export-smoke.mjs`, validating deployed auth, organization resolution, draft-first manual text imports, rejection instead of publishing, JSON/CSV export job creation, and protected export downloads against a real deployment.
- P83 Project State Reconciliation exists through `docs/PHASE_83_PROJECT_STATE_RECONCILIATION.md`, which marks older Phase-18 handoff guidance as historical and reconciles the post-P82 local AI media commits with the current roadmap.
- Driver support includes driver orders dashboard, order driver/assignment APIs, and driver location API.
- Clean release packaging is now a first-class workflow through `scripts/release/create-clean-source.mjs`.

## Completed stabilization summary

| Phase | Status summary |
| --- | --- |
| P20 | API/service safety validator and service-boundary cleanup. |
| P21 | Reality reset; pnpm/typecheck/build/quality returned to green. |
| P22 | GET handlers no longer perform covered write/upsert/read-marking side effects. |
| P23 | Tenant database drift audit tooling. |
| P24 | Tenant identity guardrails for slug/id confusion risks. |
| P25 | Commerce correctness validator and order token/number retry guardrails. |
| P26 | Appointment correctness guardrails for business hours, provider hours, and buffers. |
| P26A/P26B | DB compatibility migrations for `Order.organizationSlug` and `Order.deletedAt`. |
| P27 | i18n/RTL audit gate and stale branding cleanup. |
| P28 | Follow/fanpage readiness cleanup and public follow links/prompts. |
| P29 | Public image fallback component and public page experience cleanup. |
| P30 | Fanpage MVP with `FanpagePost`, public feed API, create API, pages, components, dictionaries, validator. |
| P31 | FA/EN/AR dictionary completion and strict dictionary parity validator. |
| P32 | Safe Neon-to-current database data migration overlay and dry-run workflow. |
| P33 | Clean release staging/ZIP workflow and artifact hygiene validator. |
| P34 | Docs-only source-of-truth, inventory, fanpage roadmap, and seed guide synchronization. |
| P35 | Seed/auth demo-password documentation and dashboard member refresh/API cleanup. |
| P36 | Dashboard members UX/API hardening and dashboard provider-layer simplification. |
| P37 | Dashboard shell navigation semantics, localized mobile header copy, and accessibility guardrails. |
| P38 | Shared dashboard sidebar role-aware navigation policy and localized navigation labels. |
| P39 | Dashboard navigation policy extraction plus route/navigation parity validator. |
| P40 | Dashboard route-level authorization helper adoption and localized fallback boundary. |
| P41 | Dashboard unauthorized-state polish and route guard smoke validator. |
| P42 | Organization-scoped Customer Club foundation with management dashboard and validator. |
| P43 | In-app notification inbox and Customer Club broadcast foundation. |
| P44 | Customer Segments MVP with organization-scoped ready segments, counts, snapshots, and validator. |
| P45 | Campaign Builder MVP with dry-run-safe in-app sends and delivery records. |
| P46 | Loyalty Points and Coupons with append-only point ledger, purchase rules, coupons, redemptions, and validator. |
| P47 | Web Push Opt-In Foundation with explicit browser opt-in, unsubscribe, permission events, dry-run preview, and validator. |
| P48 | Public SEO Foundation with locale-aware metadata, JSON-LD, dynamic robots/sitemap, and validator. |
| P49 | Public SEO QA and Rich Preview Hardening with generated OG fallback image, noindex transactional route metadata, robots disallows, and validator. |
| P50 | Public Category Metadata and Listing SEO Polish with category landing pages, JSON-LD, sitemap entries, and validator. |
| P51 | Category Slugs and Public Listing Pagination with slug-first category URLs, ID compatibility redirects, paginated category pages, and validator. |
| P52 | Public Product and Service Slug Detail URLs with slug-first detail links, ID compatibility redirects, search/sitemap updates, and validator. |
| P53 | Public SEO Deployed Slug Verification with sitemap-driven slug page, metadata, and redirect smoke checks. |
| P54 | Dashboard Slug Editing UI for category/product/service public slug controls with validator. |
| P55 | Public Slug Preview and Rich Share Polish with dashboard copy/open URL actions and image-rich metadata fallbacks. |
| P56 | Tenant-Specific Open Graph Image Generation with uploaded-media precedence and generated fallback cards. |
| P57 | Deployed Social Preview Verification with read-only `og:image` resolution and capture evidence. |
| P58 | Social Preview Artifact Review and Release Evidence with `.release` archives, review checklist, and release-note template. |
| P59 | Shop Custom Domains with `OrganizationDomain`, custom-domain proxy routing, domain fallback, and validators. |
| P60 | SUPER_ADMIN Shop Domains dashboard for controlled custom-domain management. |
| P61/P61A/P61B/P61C | Vercel environment push tooling and PowerShell 5.1-safe hotfixes. |
| P62/P62A | SUPER_ADMIN Dashboard Organizations publication and search-param compatibility hotfix. |
| P63 | Dry-run-safe Vercel custom-domain automation for domain provisioning/removal/status. |
| P64 | Custom-domain SEO hardening for robots, sitemap, canonicals, and platform-to-custom-domain redirects. |
| P65 | Custom-domain default `fa` locale routing. |
| P66/P66A | Deployed custom-domain smoke coverage and platform no-locale default `fa` routing. |
| P67 | Shop-domain dashboard UX polish and focused validator. |
| P68 | Import Hub Foundation with consent-based intake, source/job/draft models, dashboard UI, APIs, and validator. |
| P69 | CSV/Excel Product Importer with draft-only product row parsing and review UI. |
| P70 | Manual Instagram Fanpage Import with draft-only content parsing and review UI. |
| P71 | AI/Text Product Extraction Foundation with local dry-run product parsing and confidence metadata. |
| P72 | Image/PDF Menu Import Foundation with dry-run OCR fixtures and draft-only rows. |
| P73 | Snappfood URL Import MVP with consent-gated URL validation and fallback draft rows. |
| P74 | Snappmarket URL Import MVP with consent-gated URL validation and fallback draft rows. |
| P75 | Telegram Post Import with public URL validation and draft-only content intake. |
| P76 | External Source Mapping and Re-import Diff with duplicate evidence and merge/skip/create-new audit decisions. |
| P77 | Import Hub Audit, Limits, and Plan Readiness with audit events, retry/cancel policy, and org guardrails. |
| P78 | Export Hub Foundation with organization-scoped CSV/JSON export jobs and dashboard/API coverage. |
| P79 | Import Approval Publishing with review-gated live product/category/variant and fanpage post creation. |
| P80 | AI Media Suggestions Hardening with server-mediated product image suggestion jobs and selection guardrails. |
| P81 | Export Downloads with protected CSV/JSON attachment responses for completed export jobs. |
| P82 | Deployed Import/Export Smoke with real deployment auth, draft-only import verification, and export download checks. |
| P83 | Project State Reconciliation and AI Media Readiness with current-doc alignment after post-P82 AI media commits. |
| P84 | AI Media Health Gate Audit with secret-safe readiness and optional Render health probes. |
| P85 | AI Media MOCK Flow Acceptance with product edit creation, polling, retry, and selection hardening. |
| P86 | AI Media Durable Storage Acceptance with validated remote image copy and explicit storage metadata. |
| P87 | AI Media Long-Running Job UX with local status fallback, resume polling, and cancel affordances. |
| P88 | AI Media Usage Logs, Quotas, and Audit Controls before paid generation. |
| P89 | Import Draft Product to AI Image Suggestion Bridge after approval publishing. |
| P90 | Deployed AI Media Rollout Gate through Bazar Baz readiness, usage, and optional MOCK/Blob probes. |
| P91 | AI Media Rollout Evidence Archive with sanitized rollout evidence and review checklist. |
| P92 | AI Media Paid Provider Controls with explicit approval and cost guardrails defaulting off. |
| P93 | AI Media Cost Telemetry and Rollback Guardrails before paid-provider launch. |
| P94 | AI Media Seller-Facing Paid Provider State UX for disabled, MOCK, approved, exhausted, and rollback-paused states. |
| P95 | Source Cleanup and Current-State Verification before open-field, PWA, Push, and SMS phases. |
| P96 | Open Fields and Workflow Completion Audit before PWA, Push, and SMS phases. |
| P97 | PWA foundation and install experience before offline, Push, and SMS phases. |
| P98 | Offline shell, caching, and PWA quality gates before notification delivery phases. |
| P99 | Notification domain model and preferences before preference-aware delivery phases. |
| P100 | Web Push notification service before SMS provider phases. |
| P101 | SMS provider abstraction and sms.ir integration before notification routing phases. |
| P102 | Notification templates, routing, and delivery policies before admin/operator dashboards. |
| P103 | Admin/operator notification dashboard before deployed PWA, Push, and SMS smoke gates. |
| P104 | Deployed PWA, Push, and SMS smoke gates before production rollout runbooks. |
| P105 | Production rollout runbook completing the current integrated roadmap. |
| P106 | PWA/Push/SMS acceptance and secretless packaging gate before Creative Studio planning. |
| P107 | Creative Studio integration planning before server foundation work. |
| P108 | Creative Studio server foundation before dashboard shell or public asset application. |
| P109 | Creative Studio dashboard shell and read-only job review before public asset application. |
| P110 | Creative Studio apply controls and cache-safe public asset updates before generation controls. |
| P111 | Creative Studio generation readiness gate and AI-service contract sync before product-image generation request controls. |
| P112 | Creative Studio product-image generation request controls and long-running job UX before generated-asset selection polish and deployed acceptance. |
| P113 | Creative Studio generated-asset selection polish and deployed acceptance before organization-brand generation planning. |
| P114 | Creative Studio organization-brand generation planning and readiness gate before logo/cover generation request controls. |
| P115 | Creative Studio organization logo and cover generation request controls before organization generated-asset acceptance. |
| P116 | Creative Studio organization logo and cover generated-asset acceptance before provider execution rollout. |
| P117 | Creative Studio organization-brand provider execution rollout gate before provider execution implementation. |
| P118 | Creative Studio organization-brand provider execution implementation behind rollout and dry-run gates. |
| P119 | Creative Studio provider result ingestion and review stabilization before reviewed apply rollback UX. |
- P120B | Customer order lifecycle notifications and guest SMS dry-run review. |
- P120C | Notification delivery observability and retry eligibility metadata. |
| P120A | Operational order notifications and admin order controls for shop staff. |
| P120B | Customer order lifecycle notifications and guest SMS dry-run review. |

## Current route/API inventory

Use `docs/ROUTE_API_DB_SERVICE_INVENTORY.md` as the route/API/schema/service inventory for future planning. It was refreshed from the source tree on 2026-06-26.

Important currently implemented surfaces:

```txt
/{locale}/appointment/{slug}/fanpage
/{locale}/shop/{slug}/fanpage
/{locale}/appointment/{slug}/services/category/{categoryIdOrSlug}
/{locale}/shop/{slug}/category/{categoryIdOrSlug}
/{locale}/appointment/{slug}/services/{serviceIdOrSlug}
/{locale}/shop/{slug}/product/{productIdOrSlug}
/api/public/organizations/{slug}/fanpage/posts
/api/driver/location
/api/orders/{id}/assign-driver
/api/dashboard/notifications
/{locale}/dashboard/notification-operations
/api/dashboard/notification-operations
/{locale}/dashboard/notifications
/manifest.webmanifest
/web-push-sw.js
/offline.html
/{locale}/dashboard/customer-club
/{locale}/dashboard/customer-club/members
/{locale}/dashboard/customer-club/segments
/{locale}/dashboard/customer-club/campaigns
/{locale}/dashboard/customer-club/campaigns/new
/{locale}/dashboard/customer-club/campaigns/[id]
/{locale}/dashboard/customer-club/loyalty
/{locale}/dashboard/customer-club/coupons
/{locale}/dashboard/customer-club/push
/api/customer-club/membership
/api/dashboard/customer-club/members
/api/dashboard/customer-club/segments
/api/dashboard/customer-club/campaigns
/api/dashboard/customer-club/campaigns/[id]
/api/dashboard/customer-club/campaigns/[id]/send
/api/dashboard/customer-club/loyalty
/api/dashboard/customer-club/coupons
/api/dashboard/customer-club/push
/api/customer/notifications
/api/customer/push-subscriptions
/{locale}/dashboard/shop-domains
/{locale}/dashboard/organizations
/api/dashboard/shop-domains
/api/dashboard/shop-domains/[id]
/api/dashboard/shop-domains/[id]/primary
/api/dashboard/shop-domains/[id]/provision
/api/dashboard/shop-domains/[id]/status
/api/organizations
/{locale}/dashboard/imports
/api/dashboard/imports/jobs
/api/dashboard/imports/jobs/[jobId]
/api/dashboard/imports/jobs/[jobId]/cancel
/api/dashboard/imports/jobs/[jobId]/review
/{locale}/dashboard/creative-studio
/api/dashboard/creative-studio/status
/api/dashboard/creative-studio/usage
/api/dashboard/creative-studio/jobs
/api/dashboard/creative-studio/jobs/[jobId]
/api/dashboard/creative-studio/jobs/[jobId]/cancel
/api/dashboard/creative-studio/assets/[assetId]/apply
/api/dashboard/creative-studio/organization-brand/execute
```

## Current fanpage status

Implemented:

- `FanpagePost` Prisma model and migration.
- `FanpageService` for listing/creating posts and revalidating both appointment and shop fanpage paths across configured locales.
- Public `GET /api/public/organizations/{slug}/fanpage/posts`.
- Authorized `POST /api/public/organizations/{slug}/fanpage/posts` for organization `ADMIN`/`MANAGER` sessions.
- Public pages at `/{locale}/appointment/{slug}/fanpage` and `/{locale}/shop/{slug}/fanpage`.
- `FanpagePostCard` and `FanpagePostForm` components.
- FA/EN/AR dictionary parity for fanpage keys, including video placeholder text.

Deferred:

- Likes/reactions.
- Comments/replies.
- Edit/delete/moderation/drafts.
- Follower-only visibility.
- Upload-backed image/video picker from the create form.
- Dashboard post management.

## Known non-blocking debt

- Dashboard/admin Persian copy remains hardcoded in several TS/TSX files. This is reported as warning-level i18n debt, not a blocking validator failure.
- Some older phase docs remain historical and may mention outdated deployed URLs or older smoke-test context.
- `docs/AI_HANDOFF_PROJECT_CONTEXT.md` is historical and stale; it documents the old Phase 1-17 state and should not be used to restart at Phase 18.
- The active seed script hashes `123456` through `DEMO_PASSWORD` and the seed console footer prints the same value.
- `app/[locale]/dashboard/members/page.tsx` now uses a compact searchable list, explicit refresh, API error surfacing, and a scrollable management dialog.
- Organization-member role/status edits are scoped to `OrganizationMember` records and guard against self-lockout, manager-to-admin elevation, and removing the final active organization admin.
- Dashboard shell now provides localized FA/EN/AR shell copy, a skip link, a semantic `main` landmark, and a compact mobile-only header.
- Dashboard sidebar navigation is role-aware: SUPER_ADMIN keeps full navigation, ADMIN/MANAGER keep practical workflows, STAFF sees operational/catalog entries, DRIVER gets a minimal driving-focused menu, and global platform links are hidden outside SUPER_ADMIN.
- Dashboard main content is wrapped by `DashboardRouteAccessBoundary`, which uses the shared route policy helper to show a localized fallback when a user manually opens a dashboard route hidden for their role. P41 adds focus management, role/route details, improved mobile spacing, and a route-guard smoke validator.
- Dashboard route/navigation policy now lives in `lib/dashboard/navigation-policy.ts`, with `DASHBOARD_NAVIGATION_ITEMS`, `ROLE_NAVIGATION_POLICY`, and `DASHBOARD_ROUTE_POLICY` available for validators and route-level authorization checks.
- Customer Club management navigation and routes are available to SUPER_ADMIN, ADMIN, and MANAGER. STAFF and DRIVER do not receive Customer Club management navigation.
- Customer Club membership data is organization-scoped and does not mutate global user roles.
- Dashboard notifications are a personal inbox route for dashboard users. Creating in-app Customer Club broadcasts remains API-gated to organization ADMIN/MANAGER and SUPER_ADMIN.
- P43 intentionally does not send SMS, email, Telegram, Web Push, or any external notification.
- Customer Segment counts are computed from active memberships, organization-scoped orders, and organization-scoped carts. GET is read-only; POST explicitly saves reusable segment rows and snapshots.
- P44 does not create campaigns or external message delivery. Segments are prepared for future campaign reuse.
- Campaign dry runs create no notifications or deliveries. Actual sends create in-app `Notification` rows and one `CampaignDelivery` row per recipient.
- P45 intentionally does not send SMS, email, Telegram, Web Push, or any external notification.
- Loyalty balances are derived from immutable `LoyaltyLedger` rows. P46 does not store or mutate a direct customer point balance.
- Coupon redemption is organization-scoped and enforces active dates, total usage limits, per-customer limits, and optional Customer Segment membership.
- Web Push permission prompts are only requested after an explicit user action in the shop profile opt-in UI.
- P47 stores push consent/subscription state and supports dry-run previews only. Real Web Push delivery remains behind `WEB_PUSH_PROVIDER`, `WEB_PUSH_DRY_RUN`, and `WEB_PUSH_REAL_SEND_ENABLED` environment gates.
- P48 uses runtime database queries for sitemap generation and falls back to localized home URLs if the database query fails.
- P49 keeps checkout, order status, booking, appointment lookup, and appointment status out of search indexes.
- P49 does not submit Search Console sitemaps or run deployed social-card screenshot verification.
- P51 keeps ID category URLs backward-compatible, but sitemap and listing links prefer category slugs.
- P51 category pages are intentionally server-rendered and indexable; checkout/booking/order lookup pages remain noindexed.
- P52 keeps ID product/service detail URLs backward-compatible, but sitemap, search, cards, and JSON-LD prefer detail slugs.
- P53 deployed slug SEO smoke is data-dependent. Use `DEPLOYED_SLUG_SEO_ALLOW_EMPTY=1` only for intentionally empty deployments; production verification should require slug-like sitemap entries.
- P54 keeps dashboard mutation URLs ID-based even when public slugs are manually edited.
- P55 preview links depend on a known organization slug; fields without a resolvable public organization path keep preview actions disabled.
- P56 generated OG cards are deterministic URL-query images, not persisted media assets or per-tenant theme settings.
- P57 writes deployed social preview captures under `test-results/deployed-social-preview`; those artifacts are verification output and must not be committed.
- P57 live smoke currently treats category sitemap candidates as sampled-but-not-required by default because deployed category sitemap URLs can be stale/404; set `DEPLOYED_SOCIAL_PREVIEW_REQUIRE_CATEGORY=1` after category sitemap reachability is cleaned up.
- P58 writes release evidence under `.release/social-preview-evidence`; those archives are external release records and must not be committed.
- Custom-domain smoke tests are deployment/data dependent. Current reference configuration uses `CUSTOM_DOMAIN_SMOKE_BASE_URL=https://www.khalae.ir`, `CUSTOM_DOMAIN_SMOKE_PLATFORM_URL=https://www.bazar-baz.ir`, and `CUSTOM_DOMAIN_SMOKE_SHOP_SLUG=ahmad`.
- Shop owners cannot self-serve custom-domain management yet; P60/P67 keep domain management SUPER_ADMIN-only.
- Vercel domain automation must remain dry-run-safe by default and must never hardcode tokens or project/team secrets.
- P68-P119 Import Hub intake, spreadsheet parsing, manual Instagram content drafts, dry-run text product extraction, dry-run image/PDF menu fixtures, cautious Snappfood/Snappmarket fallback import, manual Telegram post import, external source re-import diff decisions, import audit/limit guardrails, Export Hub foundation/downloads, review-gated import publishing, AI media suggestion hardening, deployed import/export smoke coverage, project-state reconciliation, AI media health-gate hardening, AI media MOCK-flow acceptance, AI media durable-storage acceptance, AI media long-running job UX, AI media usage controls, import-to-AI-media bridge, deployed AI media rollout gate, AI media rollout evidence archive, AI media paid-provider controls, AI media cost/rollback guardrails, AI media seller-facing paid-provider state UX, source cleanup/current-state verification, open-fields workflow audit, PWA foundation, offline shell quality gates, notification preferences, Web Push delivery, SMS provider abstraction, notification routing, notification operations dashboard, deployed PWA/Push/SMS smoke gates, production rollout runbook, source acceptance/secretless packaging gate, Creative Studio integration planning, Creative Studio server foundation, Creative Studio dashboard review, Creative Studio apply controls, Creative Studio generation readiness, Creative Studio product-image generation controls, Creative Studio generated-asset selection polish, Creative Studio organization-brand readiness, Creative Studio organization-brand request controls, Creative Studio organization-brand acceptance, Creative Studio organization-brand provider rollout gate, Creative Studio organization-brand provider execution wiring, and Creative Studio provider result ingestion/review stabilization are implemented. Future importer/exporter and Creative Studio phases must remain seller-initiated, consent-based where external sources are involved, draft-first for imports and generated assets, auditable, rate-limited, and review-before-publish/apply.

## Clean release rules

Never hand off a raw archive from the working directory. Use:

```powershell
pnpm run release:zip
```

Do not commit or ship:

```txt
.env
.env.local
.env.*.local
.vercel/
.next/
node_modules/
.release/
test-results/deployed-social-preview/
/.release/social-preview-evidence/
/.release/ai-media-rollout-evidence/
/.release/pwa-push-sms-rollout-evidence/
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

## 2026-07-15 BB-AI-MEDIA-ONLINE-MILESTONE-01 update

The active short-term milestone is **BB-AI-MEDIA-ONLINE-MILESTONE-01 - Production Deployment Synchronization and Secure Online AI Media Integration**. It temporarily precedes BB-B2B-P14 and keeps Bazar Baz aligned with a server-to-server Render-hosted AI Media Service integration.

Current milestone status:

- BB-AI-MEDIA-P00 is complete: production Vercel source was synchronized to commit `84be77efef777875423a9e0a95e984862ef26546`, the prior missing `DIRECT_URL` build blocker is cleared, `/` redirects to `/fa`, `/api/health` is green, dashboard routes remain protected, and deployed AI media readiness/usage smoke passes without real generation.
- BB-AI-MEDIA-P01 is complete: Bazar Baz production can reach Render health/readiness through the authenticated server-side status route, and Vercel Preview contract probing inspected the live OpenAPI metadata without sending generation requests.
- A SUPER_ADMIN-only contract summary endpoint exists at `/api/dashboard/ai-media/contract`; it returns only sanitized OpenAPI metadata and never returns service credentials or raw response bodies.
- The live contract confirms the product-image suggestions create/status/cancel lifecycle and does not expose the historical organization-brand logo/cover endpoints. Organization-brand provider execution must remain disabled/gated until the app is adapted to the live `/v1/creative/...` contract or the service adds explicit organization-brand endpoints.
- BB-AI-MEDIA-P02/P03 source work is implemented for the confirmed product-image path: `AiMediaJob` is created before provider submission, product-image requests carry idempotency and correlation metadata, the canonical client validates responses and output URLs, and organization-brand provider methods fail closed with `CAPABILITY_UNAVAILABLE`.
- BB-AI-MEDIA-P04/P06 isolation recovery is blocked before resource creation: Neon management API discovery returned `403` for both configured key variables, so the dedicated Preview branch could not be safely created or reused. `docs/ai-media/AI_MEDIA_PREVIEW_RESOURCE_PLAN.md` records the required Preview database, storage, and AI-media identity boundary.
- `docs/ai-media/RENDER_SERVICE_CONTRACT.md` records the observed contract status and open questions.
- `docs/ai-media/RENDER_CAPABILITY_COMPATIBILITY_MATRIX.md` is the current capability decision matrix. Product image is `CONFIRMED`; organization logo and cover are `UNSUPPORTED`; general creative remains `UNKNOWN`.
- Real GPU/paid generation remains disabled and requires separate explicit authorization.

## 2026-07-16 DB legacy baseline update

The Production migration checksums for `ExportDataType` migrations are mirrored in source:

- `20260628000300_export_hub_foundation`
- `20260707000200_export_hub_extend_data_types`

The legacy migration chain is checksum-correct but not replayable from an empty database because the foundation migration already contains `CUSTOMERS` and `FANPAGE_POSTS`, and the later extension migration adds those labels again. Applied migrations remain immutable; they must not be edited into `IF NOT EXISTS` variants.

Hermetic AI-media acceptance now uses a guarded local baseline bootstrap for disposable databases only. The bootstrap applies the current Prisma schema locally, marks source migrations as applied locally, and refuses Neon-like or Production-fingerprinted URLs. Production never uses this path.

## Recommended next phase

```txt
BB-AI-MEDIA-P04 - Integrate only confirmed AI media capabilities into tenant UI, keeping logo/cover unavailable until service support is proven
```

After BB-AI-MEDIA-ONLINE-MILESTONE-01 is accepted, return to **BB-B2B-P14 - Transactional Tenant Provisioning Execution** only with fresh explicit P14 execution authorization. Do not execute tenant provisioning during the AI media milestone.

See `docs/IMPORT_HUB_ROADMAP.md` for the integrated P68-P78 roadmap, `docs/PHASE_79_IMPORT_APPROVAL_PUBLISHING.md` for the approval publishing bridge, `docs/PHASE_80_AI_MEDIA_SUGGESTIONS.md` for AI media guardrails, `docs/PHASE_81_EXPORT_DOWNLOADS.md` for protected export downloads, `docs/PHASE_82_DEPLOYED_IMPORT_EXPORT_SMOKE.md` for deployed verification, `docs/PHASE_83_PROJECT_STATE_RECONCILIATION.md` for the roadmap reconciliation, `docs/PHASE_84_AI_MEDIA_HEALTH_GATE.md` for the AI media health gate, `docs/PHASE_85_AI_MEDIA_MOCK_FLOW.md` for product suggestion MOCK-flow acceptance, `docs/PHASE_86_AI_MEDIA_DURABLE_STORAGE.md` for durable selected-image storage, `docs/PHASE_87_AI_MEDIA_LONG_RUNNING_UX.md` for long-running job UX, `docs/PHASE_88_AI_MEDIA_USAGE_CONTROLS.md` for usage and quota controls, `docs/PHASE_89_IMPORT_AI_MEDIA_BRIDGE.md` for import-to-AI-media workflow integration, `docs/PHASE_90_DEPLOYED_AI_MEDIA_ROLLOUT_GATE.md` for deployed Bazar Baz AI media rollout validation, `docs/PHASE_91_AI_MEDIA_ROLLOUT_EVIDENCE.md` for operator-safe rollout evidence retention, `docs/PHASE_92_AI_MEDIA_PAID_PROVIDER_CONTROLS.md` for explicit paid-provider controls, `docs/PHASE_93_AI_MEDIA_COST_ROLLBACK.md` for cost telemetry and rollback guardrails, `docs/PHASE_94_AI_MEDIA_SELLER_STATE_UX.md` for seller-facing AI media state UX, `docs/PHASE_95_SOURCE_CLEANUP_VERIFICATION.md` for source cleanup and security verification, `docs/PHASE_96_OPEN_FIELDS_AUDIT.md` for open-fields workflow audit, `docs/PHASE_97_PWA_FOUNDATION.md` for PWA install foundation, `docs/PHASE_98_PWA_OFFLINE_SHELL.md` for PWA offline shell quality gates, `docs/PHASE_99_NOTIFICATION_PREFERENCES.md` for notification preference policy, `docs/PHASE_100_WEB_PUSH_DELIVERY.md` for preference-aware Web Push delivery, `docs/PHASE_101_SMS_PROVIDER.md` for SMS provider abstraction, `docs/PHASE_102_NOTIFICATION_ROUTING.md` for template routing, `docs/PHASE_103_NOTIFICATION_OPERATIONS_DASHBOARD.md` for the operator dashboard, `docs/PHASE_104_DEPLOYED_PWA_PUSH_SMS_SMOKE.md` for deployed smoke gates, `docs/PHASE_105_PRODUCTION_ROLLOUT_RUNBOOK.md` for production rollout operations, `docs/PHASE_106_PWA_PUSH_SMS_ACCEPTANCE_GATE.md` for the acceptance and packaging gate, `docs/PHASE_107_CREATIVE_STUDIO_INTEGRATION_PLANNING.md` for the Creative Studio planning contract, `docs/PHASE_108_CREATIVE_STUDIO_SERVER_FOUNDATION.md` for the Creative Studio server foundation, `docs/PHASE_109_CREATIVE_STUDIO_DASHBOARD_REVIEW.md` for the Creative Studio dashboard review surface, `docs/PHASE_110_CREATIVE_STUDIO_APPLY_CONTROLS.md` for the Creative Studio apply-controls surface, `docs/PHASE_111_CREATIVE_STUDIO_GENERATION_READINESS.md` for the Creative Studio generation readiness gate, `docs/PHASE_112_CREATIVE_STUDIO_PRODUCT_IMAGE_GENERATION.md` for product-image generation request controls, `docs/PHASE_113_CREATIVE_STUDIO_GENERATED_ASSET_SELECTION.md` for generated-asset selection polish, `docs/PHASE_114_CREATIVE_STUDIO_ORGANIZATION_BRAND_READINESS.md` for organization-brand readiness, `docs/PHASE_115_CREATIVE_STUDIO_ORGANIZATION_BRAND_REQUEST_CONTROLS.md` for organization-brand request controls, `docs/PHASE_116_CREATIVE_STUDIO_ORGANIZATION_BRAND_ACCEPTANCE.md` for organization-brand acceptance, `docs/PHASE_117_CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_ROLLOUT_GATE.md` for organization-brand provider rollout gating, `docs/PHASE_118_CREATIVE_STUDIO_ORGANIZATION_BRAND_PROVIDER_EXECUTION.md` for organization-brand provider execution wiring, and `docs/PHASE_119_CREATIVE_STUDIO_PROVIDER_RESULT_INGESTION.md` for provider result ingestion.
