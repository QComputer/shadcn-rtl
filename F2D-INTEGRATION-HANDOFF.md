# Hotel Damoon F2D integration handoff

## Source and backend baseline

- Frontend worktree: `codex/hotel-damoon-f2d-20261013`, based on C1B2 documentation commit `e5518a3c1295d93168b126f8261ea46aeb377a54`.
- C1B2 accepted branch HEAD: `9bf2ad1386445944485f0e20ed0b10e55a4a96e5` (`codex/hotel-public-website-c1b2-review`; the handoff identifies implementation commit `c949d288f8fb5b2befdaabacf1147db15ddaa2e5`).
- C1B1 content management commit: `00f3a3830810bd6add295b3c5bb2426f118c9b9b`.
- The API contract and gate behavior are taken from `docs/HOTEL-PUBLIC-WEBSITE-INTEGRATION.md` and the committed Zod schemas/routes, not the earlier OpenAPI draft.

## Published data path

The generic organization root at `app/[locale]/[slug]/page.tsx` branches only on the shared `Organization.vertical === HOTEL` contract. It reads the actual request `Host`, calls the existing `resolveHotelWebsiteTenantForHost`, requires the resolved organization id to equal the route organization id, and chooses a property slug only when exactly one active property belongs to that tenant. Zero or multiple active properties fail closed. This lookup supplies UI context only; it does not authorize public data.

`PublishedHotelWebsitePage` requests the two JSON routes:

```text
GET /api/hotel/v1/website/properties/{propertySlug}?locale=fa|en|ar
GET /api/hotel/v1/website/properties/{propertySlug}/room-categories?locale=fa|en|ar
GET /api/hotel/v1/website/media/{associationId}
```

The two JSON requests use same-origin credentials and `cache: no-store`; media requests happen through the returned opaque `associationId` `src` URL and are not rewritten. The C1B2 API independently resolves Host, HOTEL_WEBSITE capability, property/publication and approved room/media records. The client validates the exact accepted schema and expected property/locale. Localized fields are `string | null`; missing text is not borrowed from another locale. Empty galleries and rooms stay empty; no prices, stock or amenities are fabricated.

The property response has `mode: PUBLISHED` or `mode: UNPUBLISHED`. F2D displays the unpublished state without falling back to conceptual preview. Approved `HERO_DESKTOP`/`HERO_MOBILE` associations populate the hero; only `GALLERY` media populate galleries and room cards. Missing slots get a neutral state. The separate room-category response supplies only published room-category information and approved gallery media.

HTTP 404 `NOT_FOUND`, 503 `WEBSITE_DISABLED`, malformed responses and network failures become localized safe states. No published error falls back to conceptual data.

## Preview and booking boundary

`/[locale]/hotel-preview` is an explicit local design route and returns not-found in production. It renders only the existing F1 conceptual fixture and keeps its preview notice. It is not used as a fallback for the published path.

The Jalali date-range picker and guest selector are retained on the published page as UI preview only. Submission uses the existing F2B pure validation (`policy: UNAVAILABLE`) and browser-local date only as a preview convenience. It makes no availability, quote, hold, reservation, or payment requests. HOTEL_WEBSITE is kept informational; HOTEL_BOOKING remains a separate, disabled operational capability.

## Local run and checks

```powershell
pnpm dev -- --webpack --hostname 127.0.0.1 --port 3117
```

Preview URL: `http://127.0.0.1:3117/fa/hotel-preview`.

Published tenant pages require a request Host already mapped by the platform to an active HOTEL organization with HOTEL_WEBSITE, plus exactly one active property. Public API exposure still requires the backend operational gate; F2D does not enable it.

## Integration requirements and ownership

- Integrate the accepted C1B1/C1B2 branch before this frontend branch. The F2D starting ancestry contains an older C1B2 revision (`202cd884...`) than the accepted contract at `9bf2ad1386445944485f0e20ed0b10e55a4a96e5`; do not merge this branch against the stale API paths without first aligning the C1B2 source.
- Review the generic change to `app/[locale]/[slug]/page.tsx` with the platform owner. It uses existing organization vertical, Host resolver, capability and property contracts; it adds no Damoon-specific platform condition.
- Review the one-property selection rule. The C1B2 contract is organization-bound and does not define a default property/domain-to-property relation; multi-property automatic selection remains unsupported and deliberately fails closed.
- No change is made to domain routing, capability authorization, API gates, branding/PWA, storage, Prisma schema or CMS.
- No database fixtures, published hotel data, or owner-approved real photography/logo were available or used for this frontend run. The design-preview imagery remains conceptual and labeled as such.

## Changed frontend files

See the final task report for the exact Git status manifest. The main functional integration points are:

- `app/[locale]/[slug]/page.tsx` — generic HOTEL vertical entry into the published website surface.
- `app/[locale]/hotel-preview/page.tsx` — development-only conceptual preview path.
- `lib/hotel/website-frontend-context.server.ts` — trusted Host/org binding and safe single-property context.
- `lib/hotel-website-public-adapter.ts` — strict C1B2 response adapter.
- `components/published-hotel-website-page.tsx` and CSS — localized published UI, preview-only stay form and approved media.
- `components/rooms/room-showcase.tsx` — locale direction support for gallery dialog.

No files are transferred automatically to the main repository by this worktree.
