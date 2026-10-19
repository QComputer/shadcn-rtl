# Hotel public catalog API contract (F2)

R1 exposes read-only persisted catalog and explicitly approved cancellation-policy data for any provisioned Hotel tenant. It does not add editorial homepage sections, availability, inventory, static/base rates, booking, or media.

## Routes

- `GET /api/hotel/v1/properties/{propertySlug}?locale=fa|en|ar`
- `GET /api/hotel/v1/properties/{propertySlug}/room-types?locale=fa|en|ar`
- `GET /api/hotel/v1/properties/{propertySlug}/room-types/{roomTypeSlug}/policies?locale=fa|en|ar`

`locale` defaults to `fa`; unsupported or repeated values return `400 { "error": "INVALID_REQUEST" }`. Responses are JSON and carry `Cache-Control: no-store, max-age=0` so revoked publication or domain state is not retained by a shared cache.

## Tenant and publication rules

The server resolves the incoming `Host` through the normalized `OrganizationDomain` table. The domain and organization must be active, the organization must not be deleted, its vertical must be `HOTEL`, and its `HOTEL_BOOKING` capability must be `ACTIVE`. The global `HOTEL_PUBLICATION_OPERATIONAL_ENABLED` gate must also be enabled by the environment owner; R1 does not enable it.

The property must be active, not deleted, owned by the host-resolved organization, and have a current, unrevoked approval whose `availability` scope is true. A room category must meet the same active/ownership conditions, have its own current `availability` approval, and have at least one active rate plan with a current `availability` approval. The approved rate plan is only a visibility prerequisite; no rate or inventory data is returned by the catalog route. The policies route additionally requires the room and its active linked rate plan to have current `availability` approvals, and each active attached cancellation policy to have a current `policies` approval. Reads and approval checks share a PostgreSQL `RepeatableRead` snapshot.

## Response shapes

Successful property response:

```json
{
  "source": "PUBLISHED",
  "locale": "fa",
  "property": {
    "slug": "example-hotel",
    "name": "Persisted name",
    "description": null,
    "localizedText": null,
    "timezone": "Asia/Tehran",
    "currency": "TOMAN",
    "checkInTime": "14:00",
    "checkOutTime": "11:00",
    "minStayNights": 1,
    "maxStayNights": 30
  }
}
```

Room-category response is `{ source: "PUBLISHED", locale, property: { slug }, roomCategories: [...] }`. Each item contains only `slug`, persisted name and description, requested-locale text, occupancy limits, validated bed configurations, and optional area. It contains no row IDs, organization IDs, amenities, private fields, rates, or inventory.

Room-policy response is `{ source: "PUBLISHED", locale, property: { slug }, roomCategory: { slug }, cancellationPolicies: [...] }`. Each policy contains only its public key, persisted name/description, requested-locale text (or `null`), free-cancellation cutoff, normalized retention fraction, and validated published cancellation tiers. Unapproved, inactive, malformed, or unattached policies are omitted. No internal policy/rate IDs or audit data are returned.

Hotel content has no dedicated translation fallback rule. For `fa`, `en`, and `ar`, R1 selects only the requested locale key and returns `localizedText: null` when missing. It never invents or silently substitutes a different language.

## Errors and empty content

- `400 { "error": "INVALID_REQUEST" }`: invalid slug or locale.
- `404 { "error": "NOT_FOUND" }`: unknown/inactive host, disabled tenant capability, unavailable property/room, or missing/revoked/stale publication approval. The response does not reveal which check failed.
- `503 { "error": "PUBLICATION_DISABLED" }`: global publication gate is closed.
- `500 { "error": "UNAVAILABLE" }`: sanitized unexpected read failure.
- A valid published property with no visible room categories returns `200` and an empty `roomCategories` array.
- A valid published room with no attached currently approved policies returns `200` and an empty `cancellationPolicies` array. No placeholder content is synthesized.

## Editorial and asset boundary

`HotelPage` is currently a TypeScript presentation contract and development placeholder, not persisted, revision-approved content. F2 must keep conceptual preview data explicitly marked `PREVIEW`; it cannot merge preview data into these API responses. Property and room-category models have no media/gallery association or tenant-owned approved asset reference, so R1 returns no images. Future media requires a tenant-owned asset association and an approval revision covering that association.

## Booking boundary and preview-to-live transition

These endpoints perform selects only. A catalog entry is descriptive and does not promise live inventory or a reservable rate. Date-specific rates and informational availability remain on the existing explicitly gated `POST /api/hotel/v1/availability/search` and `POST /api/hotel/v1/quotes` routes, where property, room, and rate-plan approvals are checked; their results do not guarantee a reservation. Holds, reservations, payments, and inventory changes are outside R1. F2 should render `source: "PUBLISHED"` only for these published responses and keep preview fixtures in a distinct `PREVIEW` state until the owner enables the relevant environment gate and approves real persisted content.
