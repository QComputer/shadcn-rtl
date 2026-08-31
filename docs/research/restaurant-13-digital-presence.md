# Restaurant 13 Digital Presence Research

Date: 2026-09-01
Agent: Kilo Code
Branch: kilo/restaurant-13-presence-research
Base main: 553e203a2f1e84d5abc6fa073c5b0a5bdcc13e05

## 1. Verified Identity / NAP

### Official business name
- Primary: فست فود ایتالیایی سیزده (from SnappFood public API)
- Alternative: رستوران ایتالیایی سیزده
- Alternative: رستوران ۱۳
- Alternative: Restaurant 13

### Phone
- 03832251313
- Source: Overlay metadata + repository home content fallback
- Status: UNVERIFIED_EXTERNALLY — retained as overlay-provided fallback only

### Instagram
- Handle: @restaurant_13_
- URL: https://www.instagram.com/restaurant_13_/
- Status: UNVERIFIED — direct fetch blocked by Instagram; handle retained from overlay

### General location
- شهرکرد، بلوار آیت‌الله کاشانی
- Status: UNVERIFIED_PRECISION — general area confirmed; exact street address not independently verified

### Exact address
- UNKNOWN

### Opening hours
- UNKNOWN

### Coordinates
- UNKNOWN

### Business category terminology
- فست فود ایتالیایی سیزده (SnappFood registered name)
- رستوران ایتالیایی (overlay identity)
- Category: Fast food / Italian restaurant

## 2. Logo Verification

Status: PROVISIONAL LOGO STILL IN USE

Evidence:
- Current mark is the overlay-supplied `13` monogram
- No independent authoritative source was accessed to verify an official Restaurant 13 logo
- Instagram profile image/pinned content could not be fetched due to platform access restrictions
- SnappFood storefront imagery was accessible but no distinct brand mark was extractable from the public menu API response

Current provisional mark matches official: UNKNOWN
Runtime asset changed: NO

Required statement:
PROVISIONAL LOGO STILL IN USE

## 3. SnappFood Source Verification

### Source reachability
- Public API endpoint: REACHABLE
- Restaurant web URL: REDIRECTS to snappfood.ir main (stale/routed)
- API endpoint: https://apigw.snappfood.ir/menu-read-model/31lmw4?lat=35.774&long=51.418&optionalClient=PWA&client=PWA&deviceType=PWA&appVersion=6.0.0&Bonyan=true
- Restaurant code: 31lmw4

### Current snapshot (2026-09-01)
- Categories: 9
- Products: 55
- Variant prices: 71
- Unpriced/ambiguous: 0
- Duplicate source identities: 0

### Previous baseline (2026-08-30)
- Categories: 9
- Products: 56
- Variant prices: 72

### Change detection
Changed since snapshot: YES

Diff:
- REMOVED: آبمیوه گازدار خانواده هوفنبرگ لیموناد
- No price changes detected
- No new products detected
- No category structure changes

### Production import performed
NO

## 4. iNoti iMenu Provider Findings

### Official semantics discovered
PARTIAL

### Model
UNKNOWN → Likely LINK_ONLY or MANUAL_PROVIDER_PRESENTATION based on repository evidence

### Repository evidence
- `INOTI_IMENU` is registered in `lib/integrations/inoti-account-management.ts` as a service catalog entry
- Current runtime adapter: `DryRunIntegrationAdapter` (dry-run/placeholder only)
- No live API client implementation exists in the repository
- iMenu is mapped to `SHOP` capability
- Purpose: "Catalog and menu readiness"
- Feature mappings: Catalog, Menu setup, Product discovery

### Likely integration model
Based on current architecture:
- iMenu is a provider-managed catalog/menu presentation layer
- Bazarbaaz is intended to remain source of truth
- iMenu likely requires manual provider action or provider-side configuration
- No confirmed public API for menu creation/sync in repository code

### Required identifiers
- Organization iNoti account
- iMenu service enablement
- CodeName/account credentials (existing per-tenant env pattern in repo)

### Required credentials
- Per-organization iNoti username/password pattern exists
- No iMenu-specific API token/secret pattern observed in code

### Manual provider action required
YES — inferred from dry-run-only adapter status

### Provider mutation performed
NO

## 5. Recommended Bazarbaaz ↔ iMenu Mapping

Source of truth: BAZARBAAZ

### Conceptual mapping
- Bazarbaaz ProductCategory → iMenu category
- Bazarbaaz Product → iMenu product
- Bazarbaaz Variant → iMenu variation/size
- Bazarbaaz price Toman → iMenu price (same currency unit)
- Product image → iMenu product image

### Classification
LINK_ONLY or MANUAL_PROVIDER_PRESENTATION (pending official iNoti API confirmation)

### Image strategy
- Do not hotlink SnappFood CDN images in production
- Bazarbaaz should import/store approved images through its own media pipeline
- iMenu images should be sourced from Bazarbaaz-approved media, not directly from external provider CDN

## 6. iAM Content

Prepared: PARTIAL

### Homepage link
EXPECTED_AFTER_PRODUCTION_ONBOARDING: https://bazarbaaz.ir/fa/italiano-13

### Menu link
EXPECTED_AFTER_PRODUCTION_ONBOARDING: https://bazarbaaz.ir/fa/italiano-13/shop

### Verified/live
NO — both routes return 404 on production

### Content sections prepared
1. Page title: رستوران ایتالیایی سیزده | شهرکرد
2. H1: رستوران ۱۳؛ پیتزا، برگر و پاستا در شهرکرد
3. Short intro: پیتزا، برگر، پاستا و غذاهای فرنگی در قلب شهرکرد
4. Business description: Restaurant 13 is an Italian-fast-food restaurant in Shahrekord offering pizza, burgers, pasta, and Western dishes.
5. CTA texts: مشاهده منو, تماس با رستوران, اینستاگرام ۱۳
6. Verified phone: 03832251313
7. Instagram: @restaurant_13_
8. Location: شهرکرد، بلوار آیت‌الله کاشانی

## 7. SEO / Entity Content Pack

### Primary entity
رستوران ایتالیایی سیزده (Restaurant 13)

### Alternative names
- رستوران ۱۳
- Restaurant 13
- فست فود ایتالیایی سیزده

### Business category
رستوران ایتالیایی / فست فود

### City
شهرکرد

### Verified NAP
- Phone: 03832251313
- Instagram: https://www.instagram.com/restaurant_13_/
- Location: شهرکرد، بلوار آیت‌الله کاشانی

### Suggested title
رستوران ایتالیایی سیزده | شهرکرد | منو و تماس

### Suggested meta description
منوی رستوران ۱۳ شهرکرد: پیتزا، برگر، پاستا و غذاهای فرنگی. مشاهده منو، تماس و آدرس رستوران ایتالیایی سیزده در شهرکرد.

### Suggested H1
رستوران ۱۳؛ پیتزا، برگر و پاستا در شهرکرد

### Suggested H2s
- منو رستوران ۱۳
- تماس و آدرس
- درباره رستوران ۱۳

### FAQ candidates
- آدرس رستوران ۱۳ شهرکرد چیست؟
- شماره تماس رستوران ایتالیایی سیزده؟
- منوی رستوران ۱۳ شامل چه مواردی است؟
- آیا رستوران ۱۳ تحویل دارد؟

### Local keyword clusters
- رستوران در شهرکرد
- رستوران ایتالیایی شهرکرد
- فست فود شهرکرد
- پیتزا در شهرکرد
- رستوران سیزده شهرکرد
- فست فود ایتالیایی سیزده

### iAM keyword targets
- Branded/entity: رستوران ۱۳ شهرکرد
- Discovery: فست فود شهرکرد (reserved for iAM acquisition page)
- Category: پیتزا شهرکرد, برگر شهرکرد

## 8. Presence / Link Architecture

### Canonical Bazarbaaz entity
https://bazarbaaz.ir/fa/italiano-13 (EXPECTED_AFTER_PRODUCTION_ONBOARDING)

### Bazarbaaz menu
https://bazarbaaz.ir/fa/italiano-13/shop (EXPECTED_AFTER_PRODUCTION_ONBOARDING)

### Instagram
https://www.instagram.com/restaurant_13_/ — Supporting social profile

### iAM
Future acquisition page for فست فود شهرکرد intent (separate from branded entity page)

### iMenu
Link-only or manual provider presentation; no confirmed public URL from provider

### Link flow
Instagram → Bazarbaaz entity page → Bazarbaaz menu → iMenu (where provider supports it)

Avoid artificial reciprocal backlink loops.

## 9. Production Read-Only QA

### Bazarbaaz platform
- https://bazarbaaz.ir/ — ACCESSIBLE
- Platform branding unchanged

### Cafe Leo
- https://bazarbaaz.ir/fa/cafe-leo — ACCESSIBLE
- https://bazarbaaz.ir/fa/cafe-leo/shop — ACCESSIBLE
- Normal behavior confirmed

### Aka Shoes
- https://bazarbaaz.ir/fa/aka-shoes — ACCESSIBLE
- Normal behavior confirmed

### Italiano homepage
- https://bazarbaaz.ir/fa/italiano-13 — 404 NOT FOUND
- Status: NOT YET LIVE

### Italiano menu
- https://bazarbaaz.ir/fa/italiano-13/shop — 404 NOT FOUND
- Status: NOT YET LIVE

### Production mutation
NO

## 10. Asset QA

### Assets checked
34 files under public/brand/tenants/restaurant-13/

### Broken
0

### Total size
~928 KB

### Largest assets
- home/products/pizza-signature.webp: ~104 KB
- home/products/crispy-platter.webp: ~90 KB
- home/hero/hero-main.webp: ~95 KB
- home/products/burger-signature.webp: ~78 KB

### Provisional logo
- brand/production-ready/logo-mark.svg: 434 bytes (SVG)
- brand/production-ready/logo-mark.png: 7,771 bytes
- brand/production-ready/logo-mark-light.svg: 440 bytes
- brand/production-ready/logo-mark-light.png: 7,564 bytes

All logo assets are clearly identifiable as provisional in documentation.

### MIME/extensions
- WebP: hero, collections, products, lookbook, OG, brand background
- PNG: PWA icons, social avatar, apple-touch-icon, logo marks
- SVG: logo lockups, logo marks, pattern
- ICO: favicon

### Source/overlay junk
None detected in runtime paths

## 11. Remaining Provider Inputs

1. Official Restaurant 13 logo from business owner
2. Exact street address confirmation
3. Opening hours confirmation
4. iNoti iMenu API documentation and endpoint details
5. iNoti iMenu account provisioning for Restaurant 13
6. SnappFood → Bazarbaaz catalog import approval and execution
7. Production tenant onboarding/deployment

## 12. Recommended Codex Follow-up

1. Complete browser QA for Restaurant 13 in proper runtime environment
2. Execute SnappFood catalog import with updated snapshot (1 product removed)
3. Provision iNoti iMenu account/credentials for Restaurant 13
4. Implement live iMenu adapter when provider API is confirmed
5. Replace provisional logo with verified official asset
6. Confirm exact NAP with business owner
7. Deploy Restaurant 13 tenant to production
8. Configure iAM content page for فست فود شهرکرد acquisition intent

## 13. Sources / Evidence

- SnappFood public API: https://apigw.snappfood.ir/menu-read-model/31lmw4 (live, accessible)
- Repository baseline: prisma/seed-data/italiano-13-snappfood-menu.json (2026-08-30)
- Repository code: lib/integrations/inoti-account-management.ts (dry-run adapter)
- Repository code: lib/integrations/runtime/registry.ts (DryRunIntegrationAdapter for INOTI_IMENU)
- Production routes: bazarbaaz.ir/fa/italiano-13 (404, not live)
