# Current Source of Truth — Bazar Baz

Date: 2026-06-29

## Current validated baseline

The current working baseline after P89 import-to-AI-media bridge is source-validator green after the P89 validation gate.

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
- AI selected-image durability exists through `lib/media-storage.ts` and `AiMediaService.selectImage()`: selected AI outputs are copied to Vercel Blob when `BLOB_READ_WRITE_TOKEN` is configured, with the remote Render URL used as a documented fallback. Real paid AI generation, usage quotas, and admin rollout controls are not implemented yet.
- AI Media Health Gate exists through `getAiMediaServiceConfigStatus()`, `checkAiMediaServiceReadiness()`, authenticated `/api/dashboard/ai-media/status`, optional `?check=1` Render `/health` and `/ready` probes, secret-safe readiness responses, timeout normalization, and the `quality:ai-media-health-gate` validator.
- AI Media MOCK Flow Acceptance exists through dashboard-access-gated status checks, product edit MOCK job creation/polling, `outputs`/`output_images` compatibility, retryable no-output and non-terminal error states, API-returned selected image URL application, authenticated deployed-smoke expectations, and the `quality:ai-media-mock-flow` validator.
- AI Media Durable Storage Acceptance exists through validated remote image MIME/signature checks before Blob writes, oversized remote image rejection, explicit `storageStatus` selection metadata, remote fallback warnings, public path/home revalidation after selected URL replacement, and the `quality:ai-media-durable-storage` validator.
- AI Media Long-Running Job UX exists through cleanup-safe bounded polling, local `AiMediaJob` snapshot fallback when Render checks are unavailable, latest product job recovery, provider/timestamp/status display, retry/continue/cancel seller controls, an organization-scoped cancel route, and the `quality:ai-media-long-running-ux` validator.
- AI Media Usage Controls exist through `AiMediaUsageEvent`, daily organization quota checks before job creation, usage events for job lifecycle/selection/cancel actions, authenticated `/api/dashboard/ai-media/usage`, explicit `paidGenerationEnabled: false`, and the `quality:ai-media-usage-controls` validator.
- Import-to-AI-Media Bridge exists through `ImportedProductDraft.importedProductId`, AI-media prompt context stored only after approved drafts become `IMPORTED`, product edit AI prompt fallback from imported context, import row `تصویر AI` links, and the `quality:import-ai-media-bridge` validator.
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
/{locale}/dashboard/notifications
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
- P68-P89 Import Hub intake, spreadsheet parsing, manual Instagram content drafts, dry-run text product extraction, dry-run image/PDF menu fixtures, cautious Snappfood/Snappmarket fallback import, manual Telegram post import, external source re-import diff decisions, import audit/limit guardrails, Export Hub foundation/downloads, review-gated import publishing, AI media suggestion hardening, deployed import/export smoke coverage, project-state reconciliation, AI media health-gate hardening, AI media MOCK-flow acceptance, AI media durable-storage acceptance, AI media long-running job UX, AI media usage controls, and import-to-AI-media bridge are implemented. Future importer/exporter phases must remain seller-initiated, consent-based where external sources are involved, draft-first for imports, auditable, rate-limited, and review-before-publish.

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

## Recommended next phase

```txt
P90 - Deployed AI media rollout gate through Bazar Baz
```

Scope:

1. Run a deployed Bazar Baz rollout gate that verifies dashboard route protection, AI media readiness, usage controls, and MOCK provider behavior.
2. Keep real paid generation disabled unless explicitly enabled in a later rollout.
3. Verify selected images still become durable Blob URLs when Blob is configured.
4. Capture operator-safe rollout evidence without exposing secrets.

See `docs/IMPORT_HUB_ROADMAP.md` for the integrated P68-P78 roadmap, `docs/PHASE_79_IMPORT_APPROVAL_PUBLISHING.md` for the approval publishing bridge, `docs/PHASE_80_AI_MEDIA_SUGGESTIONS.md` for AI media guardrails, `docs/PHASE_81_EXPORT_DOWNLOADS.md` for protected export downloads, `docs/PHASE_82_DEPLOYED_IMPORT_EXPORT_SMOKE.md` for deployed verification, `docs/PHASE_83_PROJECT_STATE_RECONCILIATION.md` for the roadmap reconciliation, `docs/PHASE_84_AI_MEDIA_HEALTH_GATE.md` for the AI media health gate, `docs/PHASE_85_AI_MEDIA_MOCK_FLOW.md` for product suggestion MOCK-flow acceptance, `docs/PHASE_86_AI_MEDIA_DURABLE_STORAGE.md` for durable selected-image storage, `docs/PHASE_87_AI_MEDIA_LONG_RUNNING_UX.md` for long-running job UX, `docs/PHASE_88_AI_MEDIA_USAGE_CONTROLS.md` for usage and quota controls, and `docs/PHASE_89_IMPORT_AI_MEDIA_BRIDGE.md` for import-to-AI-media workflow integration.
