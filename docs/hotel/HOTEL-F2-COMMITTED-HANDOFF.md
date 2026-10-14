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
