# F2A — committed hotel public-read contract versus design draft

Source of truth: read-only inspection of commit `9a5c7ff84ca5c96123781c04b418855b25fe0180` (`lib/hotel/public-api-contract.ts`, `lib/hotel/public-api-http.ts`, `lib/hotel/services/public-catalog.service.ts`, the three `app/api/hotel/v1/properties/...` handlers, and the existing availability/quote validators and routes). Compared with this isolated workspace's `docs/HOTEL-H3D-OPENAPI.yaml`, which remains an older design draft. No endpoint was called.

## Exact R1 read mapping

All three committed GET routes take `?locale=fa|en|ar` (default `fa`, repeated or unsupported locale is `400`). Their JSON is `Cache-Control: no-store, max-age=0`, and a successful body has `source: "PUBLISHED"`, `locale`, and **no** `data`/`meta` wrapper. `503 PUBLICATION_DISABLED` is the closed operational gate; `404 NOT_FOUND` covers untrusted/inactive host, capability, property, room or approval without disclosing which; `500 UNAVAILABLE` is sanitized. Invalid slug/locale is `400 INVALID_REQUEST`. The host, organization, `HOTEL_BOOKING` capability, ownership, activity and current approval are checked server-side in a repeatable-read snapshot. The adapter still verifies expected slug/locale and shape, but is not itself an authorization mechanism.

| Actual route | Exact successful fields after `source`, `locale` | Older OpenAPI draft | F2A adapter |
| --- | --- | --- | --- |
| `GET /api/hotel/v1/properties/{propertySlug}` | `property.slug`, `name`, `description: string\|null`, `localizedText: string\|null`, `timezone`, `currency`, `checkInTime`, `checkOutTime`, `minStayNights`, `maxStayNights` | `/public/property` with generic `{data,meta}`; no exact property fields | `adaptPublishedProperty`, checks expected slug/locale; preserves nulls |
| `GET /api/hotel/v1/properties/{propertySlug}/room-types` | `property: {slug}`, `roomCategories[]` with `slug`, `name`, `description: string\|null`, `localizedText: string\|null`, `maxAdults`, `maxChildren`, `maxOccupancy`, optional validated `beds[]` (`kind`, `count`, optional `widthCm`), `sizeSqm: number\|null` | `/public/rooms` with generic `{data[],meta}`; no exact fields | `adaptPublishedRoomCategories`, preserves order and empty list; `toPublishedRoomCards` supplies **no** images, prices, amenities or invented facts |
| `GET /api/hotel/v1/properties/{propertySlug}/room-types/{roomTypeSlug}/policies` | `property: {slug}`, `roomCategory: {slug}`, `cancellationPolicies[]` with `key`, `name`, `description: string\|null`, `localizedText: string\|null`, `freeCancellationCutoffHours`, `fullCancellationRetention` (fraction 0–1), optional `cancellationTiers[]` (`cutoffHours`, `retentionBasisPoints` 0–10000, `penaltyBasis: RESERVATION_TOTAL\|FIRST_NIGHT`) | `/public/policies` with generic `{data[],meta}`, no room path or concrete policy fields | `adaptPublishedRoomPolicies`, checks property/room/locale; preserves empty list and numeric terms |

No R1 response includes organization ID, internal room/rate/policy ID, nightly price, inventory, amenity list, media/gallery reference, or approval audit metadata. `localizedText` is only the **requested** locale key or `null`; the backend does not substitute another language. Adapters preserve that null and do not fabricate translation. Persisted `name`/`description` remain separately labeled fields. Strict parsing rejects missing fields, unknown price/media extras, wrong `source`, locale and property/room context; a future changed backend shape requires deliberate review.

## Availability and quote compatibility

| Field | Committed validator/route | Older OpenAPI draft | F2B implication |
| --- | --- | --- | --- |
| URL/method | `POST /api/hotel/v1/availability/search`, `POST /api/hotel/v1/quotes` | Same paths | Still publication-gated; do not call in F2A. |
| Required request | Flat `property` slug, `checkIn`, `checkOut` Gregorian `YYYY-MM-DD`, `occupancy` | `stay: {checkIn,checkOut}`, `occupancy`, optional `propertyId` | Use flat validated shape, never client-provided organization authority. Trusted host resolves tenant. |
| Occupancy | `adults` integer 1–12, `children` integer 0–12 (defaults 0), optional `childAges` integers 0–17 with length equal to `children` | Adult/child fields but no full limits/default/age-length rule | Current one-number guest control is **not** compatible; gather adult/child composition and ages before any live search. |
| Optional filters | `roomTypes[]` slugs (max 50), `ratePlan` string (max 64), `amenities[]` known keys (max 20), `maxNightlyRate` nonnegative safe integer TOMAN | Not specified in draft | Do not send unspecified filters; no rate/amenity authority from conceptual cards. |
| Stay rules | `checkOut > checkIn`; hard ceiling 30 nights; property-specific `minStayNights`/`maxStayNights` exposed by R1 property GET | Half-open stay described but not property-specific limits | Jalali grid keeps Gregorian ISO values. Before F2B, use property-local date semantics and published min/max stay plus server revalidation. |
| Successful response | Direct `{property,nights,nightCount,inventoryReserved:false,options,rejected}`; serialized option has `roomType`, `ratePlan`, `nights`, decimal-string `nightlyRates`, `totalRate`, `averageNightlyRate`, `availableRoomCount`, `isAvailable`, `unavailableNights` | Generic `{data,meta}` for availability/quote | Treat quote as informational, never a held rate; do not invent a quote token or convert TOMAN to Rial. |

The F1.4 Jalali picker defaults its minimum to the **browser's** local today. That is adequate for the internal preview, not a property-local booking cutoff. It has optional `minDate`/`maxDate` inputs for later integration; do not change the picker or claim that the browser clock enforces the hotel's arrival policy. The preview form checks only date presence/order/past date and a single guest count, then shows a no-request message.

## Preview/live separation and unavailable content

`lib/preview-content.ts` remains conceptual `PREVIEW` data. The homepage now passes those cards through `previewHotelRooms(...)` and never through the `PUBLISHED` parsers. The reusable `lib/hotel-public-read-adapter.ts` accepts only the exact committed published read shapes and rejects a preview payload. It performs **no fetch** and has no API URL or environment toggle. The Next.js client component receives only plain serializable display data; no server credentials or authority claims cross into it.

`adaptPublishedEditorial` returns `EDITORIAL_CONTRACT_MISSING` and `adaptApprovedRoomMedia` returns `APPROVED_MEDIA_CONTRACT_MISSING` for any input. C1A must define durable, revision-approved editorial copy/section localization. C1B must define tenant-owned approved media association, order/primary image, resolved URLs, alt text and revision invalidation. The older OpenAPI's `/public/gallery` and `/public/rooms/{roomTypeId}` are design entries, not these committed R1 routes. Until C1A/C1B and owner approval exist, the official Damoon logo, real property/room/lobby imagery, media alt text, editorial copy, amenities, prices and public claims remain missing; conceptual images retain their warning labels.

## F2B prerequisites

1. Reconcile the older OpenAPI paths/wrappers with committed R1 and the flat availability/quote validator; preserve versioned, tenant-aware routes.
2. Obtain explicit publication and operational authorization plus real approved property, room, policy and (later) C1A/C1B content/media. A published catalog entry alone does not establish available inventory.
3. Implement adult/child/child-age controls, property-local date/min/max-stay rules and a server-derived property context before wiring searches. Check rates/inventory again at the authoritative booking boundary.
4. Decide server-side trusted-host data loading and no-store behavior; do not merge `PREVIEW` and `PUBLISHED` or use a client-provided tenant ID as authority.
5. Keep holds, payment, account linking and production activation outside F2A. No network, database, deployment or merge was performed here.
