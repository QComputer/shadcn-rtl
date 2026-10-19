# Hotel F2C integration readiness — source preparation, no network

This handoff is for a future reviewed transfer from the isolated Damoon preview. It does **not** activate a tenant domain, public content, availability, booking, or payment. The approved F1 light theme, Jalali picker, guest selector, room gallery, and conceptual imagery remain preview-only.

## Source and authoritative contracts

- Existing R1 commit `9a5c7ff84ca5c96123781c04b418855b25fe0180`: `lib/hotel/public-api-contract.ts` and the three committed property/room/policy GET handlers. Their success bodies are direct `{source:"PUBLISHED",locale,...}` objects, not the old OpenAPI `data/meta` wrapper. Locale is `fa|en|ar` (default `fa`); failures are sanitized `INVALID_REQUEST` 400, `NOT_FOUND` 404, `PUBLICATION_DISABLED` 503, `UNAVAILABLE` 500; responses set `no-store, max-age=0`. The current published R1 catalog checks `HOTEL_BOOKING` in its server resolution path. Frontend parsing does not authorize anything.
- C1A commit `a055ec02170a156de90e0679af81c66212837c58`: `lib/hotel/content/hotel-website-contract.ts`, its service, and `docs/HOTEL-CONTENT-C1A-F2-CONTRACT.md`. C1A creates website content/revision/media-association persistence and a proposed `mode:"PUBLISHED"` / authenticated `mode:"PREVIEW"` DTO. It adds **no public editorial or gallery reader** and no CMS preview endpoint. C1B1 management/publication work is concurrent; no uncommitted route/schema is assumed here. C1B2 public-read contract remains pending.
- F2A field matrix: `F2A-BACKEND-CONTRACT-MATRIX.md`. F2B guest/date contract: `F2B-GUEST-STAY-HANDOFF.md`. These supersede the outdated OpenAPI draft where it differs from committed validators.

## Exact frontend integration points

| File / component | Responsibility | Future integration boundary |
| --- | --- | --- |
| `app/page.tsx` | Server entry currently validates a design fixture | Platform server must resolve trusted host/domain, organization, property and publication/capabilities **before** constructing published data. Never use client query/localStorage as authority. |
| `lib/hotel-public-read-adapter.ts` | Strict, pure R1 property/rooms/policies parsing; wrong locale/property/room and uncontracted fields fail | Feed only committed R1 response shapes. Nullable `localizedText` stays null; never borrow a translation. |
| `lib/hotel-frontend-data-provider.ts` | Synchronous, preloaded snapshot provider with `PREVIEW`, `PUBLISHED`, `AUTHENTICATED_PREVIEW` provenance | Future server-side loader can supply already-resolved, authorized snapshots. The published factory validates shape/scope but is **not** an authorization mechanism or fetcher. Authenticated preview remains unsupported. |
| `lib/hotel-frontend-state.ts`, `components/hotel-data-state.tsx` | Localized fa/en/ar, safe loading/empty/missing-translation/unavailable/publication/preview/booking-disabled states | Map only reviewed server outcomes; show no raw exception, tenant ID or approval/audit detail. Pending route is not the same as no approved content. |
| `components/damoon-home.tsx`, `lib/preview-content.ts` | Current conceptual homepage and no-request search | Keep design fixtures separate from published tenant content. Replace only with owner-approved, revision-eligible data after server integration. |
| `components/rooms/room-showcase.tsx`, `lib/rooms/room-showcase-model.ts` | Room cards and gallery | Published R1 rooms currently map to cards with **no images**; gallery needs a separately approved, ordered media response with alt text. |
| `components/booking/jalali-date-range-picker.tsx`, `components/booking/guest-composition-selector.tsx`, `lib/booking/search-form-model.ts` | Gregorian ISO date storage, Jalali display, adult/child/optional ages, pure request normalization | `normalizeAvailabilitySearch` needs a server-trusted property slug and actual published stay rules. Browser-local today is only a preview convenience. The server must revalidate dates, occupancy, rates and inventory. |

## Capability, publication and data modes

- `HOTEL_WEBSITE` is the separate C1A website-content capability. It is not booking permission and has no live public content reader yet.
- `HOTEL_BOOKING` currently gates R1 property/room/policy reads as well as availability/quote/holds. Do **not** locally reinterpret R1 as website-only. A future platform route/resolver change must be reviewed and tested separately.
- `PREVIEW` contains labeled conceptual local assets only. `PUBLISHED` accepts only strict committed R1 shapes and has no fallback to preview on error or empty result. `AUTHENTICATED_PREVIEW` is a pending, separately authorized CMS mode, not a way for a public visitor to see drafts.
- The future platform server must determine brand/theme from its tenant-aware organization infrastructure. No Damoon-specific host resolver, organization ID, domain exception or duplicate branding system belongs in this preview.
- C1A media associations are historical draft/revision references. Future public readers must check the exact approved revision and current tenant ownership, `PUBLIC` access, serveable MIME/URL, order and locale-specific alt text. Do not render arbitrary URLs, private images or conceptual preview images as approved media.

## UI and cache/error behavior

The reusable state component covers loading, no approved content, no published rooms, missing translation, unavailable property, publication disabled, temporary unavailability, preview-only content, pending contract, and booking disabled. Messages are guest-facing and localized to `fa`, `en`, and `ar`. A 404 must not identify whether a host, tenant, property, room or approval was absent. A 503 gate remains closed; no preview fallback follows it. Follow R1's `no-store` behavior; C1B2 must define editorial/media cache and revocation invalidation before public use. Authenticated preview must also be uncached.

## Date/guest and booking handoff

The accepted availability/quote input is flat `property`, Gregorian `checkIn`, `checkOut`, and `occupancy: {adults,children,childAges?}`. Adults are 1–12, children 0–12, and optional child ages must be 0–17 with one age per child if supplied. The route ceiling is 30 nights. R1 property reads expose timezone and min/max stay nights; authoritative property-local current date, arrival horizon and unavailable-date policy are not public fields yet. No preview value is a reservation guarantee. Quote and availability remain informational; the atomic booking engine must recheck later. Public holds, payment, customer lookup and account linking are outside this handoff.

## Safe future integration sequence and ownership

1. Platform/domain owner reviews the current Git-backed source revision, R1/C1A/C1B1/C1B2 contracts, custom-domain resolver, capability policy, publication state, and tenant branding. Do not copy the older isolated snapshot wholesale.
2. Hotel frontend owner transfers the specific preview-owned files after a path-by-path diff; retain current platform code. Keep shared Prisma, migrations, domain routing, branding, identity, content management and media systems under platform ownership.
3. Platform server composes trusted tenant/property context and published R1 catalog snapshots; adapt them with strict R1 adapters. Treat malformed/wrong-scope responses as unavailable, never as conceptual fallback. Keep client props plain and serializable.
4. When C1B2 public editorial/media and authenticated preview contracts are committed and accepted, add separate reviewed adapters. Verify approved revisions, media eligibility, locale, order and revocation/cache behavior before replacing any concept asset.
5. Only after separate operational authorization, wire read-only availability/quote and property-local stay rules. Keep booking holds/payment gated. Run isolated DB/HTTP/browser/security acceptance for the resulting integration before public rollout.

## Minimal source manifest for reviewed transfer

F2C-prep additions: `lib/hotel-frontend-data-provider.ts`, `lib/hotel-frontend-state.ts`, `components/hotel-data-state.tsx`, `components/hotel-data-state.module.css`, `tests/hotel-frontend-data-provider.test.mjs`, this document. One comment-only correction in `lib/hotel-public-read-adapter.ts` acknowledges C1A's committed storage contract while keeping public editorial/media unsupported. Existing F1/F2A/F2B files are dependencies, not recopied by this task. No production API, database, CMS or deployment configuration was changed.
