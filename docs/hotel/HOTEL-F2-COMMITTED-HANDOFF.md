# Hotel F2 committed handoff

Status: implementation and focused UI acceptance committed locally; integrated production build and real staging acceptance remain open.

## Commit and ownership

- Branch: `codex/hotel-damoon-f2-public-integration`
- Base: `f24d5d04b18ef58a4b4434d2fbd6b1fca3109edf` (accepted F5 source baseline)
- Implementation commit: `c7f8c9600042e0cdef2b3097813c6f36a3f078b3`
- Worktree: `C:\Users\disso\.codex\worktrees\hotel-damoon-f2-public-integration\shadcn-rtl`
- Ownership: Hotel public-page presentation and its focused UI tests only. No Platform, Retail, routing, schema, or dependency files are included.

## Files in the implementation commit

- `components/booking/guest-composition-selector.tsx`
- `components/booking/jalali-date-range-picker.tsx`
- `components/published-hotel-website-page.module.css`
- `components/published-hotel-website-page.tsx`
- `components/rooms/room-showcase.tsx`
- `lib/booking/jalali-calendar.ts`
- `tests/fixtures/published-hotel-website.browser.tsx`
- `tests/fixtures/room-showcase-image.tsx`
- `tests/jalali-calendar.test.mjs`
- `tests/published-hotel-website.browser.mjs`

Screenshots are retained in `artifacts/hotel-f2/` as local review evidence and are intentionally not included in the implementation commit.

## Preserved design and public API boundary

The presentation retains the approved F1.4 light direction: ivory surfaces, natural timber brown, green and terracotta accents, Persian-first RTL, responsive hero, room showcase, and gallery. No official logo, verified hotel photo, price, amenity, room inventory, or other unsupported business fact was added.

The page reads the accepted F5 public contracts:

- `GET /api/hotel/v1/website/properties/{propertySlug}?locale=fa|en|ar`
- `GET /api/hotel/v1/website/properties/{propertySlug}/room-categories?locale=fa|en|ar`
- Media is served through `GET /api/hotel/v1/website/media/{associationId}`.

The page preserves the backend-provided opaque media URL, uses `no-store` for its public reads, and keeps `PUBLISHED`, `UNPUBLISHED`, and unavailable/error states separate. It does not fall back from published data to preview fixtures. Booking submission remains preview-only. The public website operational flag was not enabled.

## Focused validation commands and results

Passed:

```powershell
node --import tsx --test tests/hotel-website-public-adapter.test.mjs tests/jalali-calendar.test.mjs tests/search-form-model.test.mjs tests/room-showcase-model.test.mjs
```

Result: **30 passed, 0 failed**.

```powershell
node --import tsx tests/published-hotel-website.browser.mjs
```

Result: **4 browser cases passed** in installed Chrome: Persian at 1440x900 and 390x844, English and Arabic at 390x844. Test API payloads and image objects are synthetic browser-only fixtures, not a real API or staging acceptance run. The smoke verifies date selection/order, guest selection, media URL preservation, no horizontal overflow, no forbidden booking/payment calls, gallery Escape and focus restoration.

```powershell
pnpm exec eslint components/booking/guest-composition-selector.tsx components/booking/jalali-date-range-picker.tsx components/published-hotel-website-page.tsx components/rooms/room-showcase.tsx lib/booking/jalali-calendar.ts tests/fixtures/room-showcase-image.tsx tests/fixtures/published-hotel-website.browser.tsx tests/published-hotel-website.browser.mjs tests/jalali-calendar.test.mjs
git diff --check
```

Both completed successfully with exit code 0.

Focused TypeScript validation passed for the changed UI/component dependency graph using a temporary config that included the changed TSX and TypeScript files plus a temporary `*.module.css` declaration. Those temporary files were removed; no isolated typecheck config is part of this handoff. The exact integrated full-project command remains `pnpm typecheck` and must be rerun after safe Prisma Client generation.

## Integrated build gates still open

- Full `pnpm typecheck` fails because the worktree's `node_modules` junction points to the main checkout, where generated Prisma types do not contain Hotel capabilities/models such as `HOTEL_WEBSITE` and `hotelWebsitePublication`.
- Turbopack rejects that external dependency junction. A direct webpack build then fails because the common source tree has root `app/page.tsx` but no `app/layout.tsx`; this same structure exists in main and the Platform PWA worktree, so it is a shared root-route/shell gate, not an F2 page change.
- Use a fresh combined Platform/Retail/Hotel integration worktree with materialized, isolated dependencies; generate Prisma Client there from the final combined schema. Resolve and regression-test the shared root route before treating production build as green.
- Run real tenant-host, publication/revocation, media authorization, and SSO-protected staging browser acceptance against the integrated candidate. Do not treat these synthetic UI tests as that evidence.

## Screenshot locations

All are local, synthetic-data component screenshots under:

`C:\Users\disso\.codex\worktrees\hotel-damoon-f2-public-integration\shadcn-rtl\artifacts\hotel-f2\`

- `published-page-1440.png`
- `published-page-390.png`
- `jalali-calendar-desktop.png`
- `jalali-calendar-mobile.png`
- `published-room-gallery-desktop.png`
- `published-room-gallery-mobile.png`

## Integration sequence

1. Start from the reviewed combined Platform PWA and Retail candidate, not by copying this older F5 snapshot over it.
2. Apply the reviewed F2 commit (`c7f8c9600042e0cdef2b3097813c6f36a3f078b3`) as a focused change and resolve any UI/component contract conflicts explicitly.
3. Preserve the shared locale shell, tenant host resolution, and publication gate. Do not enable booking or the public website operational flag as part of this handoff.
4. Materialize isolated dependencies, generate Prisma Client from the exact integrated schema, then run full typecheck, focused tests, lint, production build, and real staging/browser security acceptance.

No files were pushed, merged, or deployed; no database, Production configuration, live booking, payment, or notification operation was performed.

## H4 room-configuration foundation

Local source commits: `86385fe95326f3ded712a34f77b46d8026f2f3f7` (initial service and tests), `c37c8f29e2774dfaf8bb970f9a281a7b1da99bae` (explicit child-policy requirement). H4 handoff commits: `f1794de462478e14f2c7d8fec5abcb2bf83695a9` and this update. No push or merge was performed.

The Hotel-owned pure service `lib/hotel/domain/room-configuration-recommendation.ts` evaluates advisory single-room compatibility from an explicit guest composition, declared room capacity/bed configuration, and a caller-supplied policy status. It reuses `validateOccupancy` and `validateOccupancyFitsRoom`; it does not query persistence, availability, rates, or booking services. Stable reason codes are localization-ready keys. Compatible candidates are ordered by smallest remaining declared occupancy capacity, then bed capacity, then ordinal room-type ID.

Policy and information gaps fail closed as `REVIEW_REQUIRED` (including absent/conflicting occupancy policy, incomplete room facts, age-sensitive policy without an explicit age-independent declaration, or missing accessibility data). Extra-bed and multi-room requests return `POLICY_REQUIRED`; no configuration for either is inferred. The current public room-category contract exposes declared adult/child/total limits, beds, size, and gallery but no approved extra-bed, age-threshold, or multi-room allocation policy. `wheelchair_accessible` is the only accessibility signal in the inspected Hotel amenity contract; it must not be treated as a full accessibility assessment.

Focused tests:

```powershell
node --import tsx --test tests/unit/hotel/room-configuration-recommendation.test.ts tests/unit/hotel/recommendation.test.ts tests/unit/hotel/stay-dates.test.ts
```

The new module is deliberately separate from `lib/hotel/domain/recommendation.ts`, which remains the availability/rate ranking service. The configuration result makes no availability, price, or bookability claim. Callers must pass only tenant-scoped, authoritative room data and an explicit policy state; actual Hotel Damoon capacities and policies remain owner-controlled business data and are not approved by these synthetic tests.

## F2.1 guest-experience hardening

- Hotel source commit: `0c1cc170b54705386a61ca38ecdfd65c74742685`
- Branch: `codex/hotel-damoon-f2-public-integration`
- Parent: `8fe48e1d1ad6d04714f3f2f28fadb73cc6a0ef3a`
- Scope: keyboard and touch interaction fixes in the Hotel-owned published page, room showcase, and Jalali picker. No shared routing, metadata, tenant, Prisma, or booking backend code changed.

### F2.1 changed source and tests

- `components/booking/guest-composition-selector.module.css`
- `components/booking/jalali-date-range-picker.module.css`
- `components/booking/jalali-date-range-picker.tsx`
- `components/published-hotel-website-page.module.css`
- `components/published-hotel-website-page.tsx`
- `components/rooms/room-showcase.module.css`
- `components/rooms/room-showcase.tsx`
- `tests/published-hotel-website.browser.mjs`

The public page now labels its navigation correctly and transfers focus into the mobile disclosure and back to its trigger on Escape/close. Keyboard date and room-gallery movement follows LTR versus RTL reading direction. Small interactive controls meet a 44px minimum on mobile. Failed approved-media requests replace broken images with localized, visible unavailable states; the original opaque media URLs remain unchanged and no preview image fallback was added.

### F2.1 verification

Passed on synthetic, browser-intercepted data only:

```powershell
node --import tsx --test tests/hotel-website-public-adapter.test.mjs tests/jalali-calendar.test.mjs tests/search-form-model.test.mjs tests/room-showcase-model.test.mjs
```

Result: **30 passed, 0 failed**.

```powershell
node --import tsx tests/published-hotel-website.browser.mjs
```

Result: **10 browser cases passed, 0 failed**: fa at 1440x900 and 390x844; en and ar at 390x844; plus unpublished, unavailable property, website-disabled, temporary-error, missing-translation, and empty-room states. Coverage includes Jalali keyboard selection with Gregorian ISO values, directional gallery keys, focus restoration, mobile-nav Escape, reduced motion, 44px touch targets, media URL preservation, failed-image fallback, no horizontal overflow, and absence of booking/payment/notification requests. These are component browser tests with synthetic fixtures, not live staging evidence.

Focused TypeScript compilation passed for the Hotel UI graph (9 roots, 294 source files) using the repository compiler options and an in-memory CSS-module declaration. Targeted ESLint on the three changed TSX files and the browser harness passed with exit code 0. CSS files are not included in the ESLint configuration. `git diff --check` passed. The full-project typecheck and production build were not rerun: their accepted F2 baseline blockers remain stale generated Prisma types and the shared root layout/dependency setup; this F2.1 change does not touch those shared surfaces.

### F2.1 screenshots and metadata integration note

New viewport screenshots (fullPage false) are local review artifacts under:

`C:\Users\disso\.codex\worktrees\hotel-damoon-f2-public-integration\shadcn-rtl\artifacts\hotel-f2-1\`

Includes desktop/mobile initial page, Jalali calendar open, and room gallery open. Screenshots use only clearly synthetic browser fixtures and are not committed.

The shared route `app/[locale]/[slug]/page.tsx` owns `generateMetadata`; it currently derives organization-level metadata and does not resolve the localized published Hotel revision or set publication-aware indexing metadata. It was intentionally not changed. Platform integration should add a trusted-host, published-revision metadata adapter and a safe no-index response for unpublished/unavailable Hotel content, without adding unverified business claims. No Hotel-owned server metadata boundary currently exists to implement this safely in isolation.

F2.1 does not resolve missing owner-approved photography, translations, property facts, or business copy. No production API, staging database, publication workflow, live booking, payment, notification, or deployment was exercised.
