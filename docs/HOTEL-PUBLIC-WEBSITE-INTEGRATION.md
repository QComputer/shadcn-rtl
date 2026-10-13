# Bazarbaaz Hotel public website integration

This contract is for the Hotel frontend agent. It describes the accepted C1B1 management API and the C1B2 public read API. Tenant identity always comes from the normalized request `Host` and an active `OrganizationDomain`; never send an organization ID to select public tenant data. Damoon is configured as an ordinary Hotel tenant and has no special server branch.

## Source branches and capability boundary

- C1B1 management branch: `codex/hotel-content-c1b1-review`, commit `00f3a3830810bd6add295b3c5bb2426f118c9b9b`.
- C1B2 public website branch: `codex/hotel-public-website-c1b2-review`, implementation commit `c949d288f8fb5b2befdaabacf1147db15ddaa2e5` (includes the independent default-off rollout gate).
- `HOTEL_WEBSITE` gates editorial content and informational Hotel website reads. It must be explicitly active, have `enabledAt`, and have no `disabledAt`.
- `HOTEL_BOOKING` remains the independent gate for booking operations. These public responses do not create holds, reservations, quotes, payments, or inventory changes and never promise availability.
- Existing R1 catalog, availability, quote, and hold endpoints retain their existing booking/publication rules. The new room-category website response is a separate informational read and does not reveal price or inventory.

## C1B2 public routes

All routes require a trusted active host mapping to an active, nondeleted `HOTEL` organization with `HOTEL_WEBSITE` enabled. `HOTEL_BOOKING` is not required. The service selects the exact active, nonrevoked `HOME` publication and its `APPROVED` immutable revision. Unrecognized host/property and unavailable website state return a generic not-found response. All JSON and media responses use `Cache-Control: no-store, max-age=0`; the media redirect also uses `Referrer-Policy: no-referrer` and `X-Content-Type-Options: nosniff`.

An independent rollout kill switch, `HOTEL_WEBSITE_PUBLIC_OPERATIONAL_ENABLED`, must equal `1` before any route reads data. It defaults off; disabled routes return `503 {"error":"WEBSITE_DISABLED"}`. Tenant capability remains separately required after the global gate is enabled.

### `GET /api/hotel/v1/website/properties/{propertySlug}?locale=fa|en|ar`

Locale defaults to `fa`; unsupported or repeated locale values return `400 {"error":"INVALID_REQUEST"}`. A published response has `mode: "PUBLISHED"`, locale, property slug, revision number, localized allowlisted editorial content, property gallery, and room galleries. An active property without a publication returns `mode: "UNPUBLISHED"`, `content: null`, and empty galleries. The API omits address until a persisted public-address visibility contract exists. Missing locale values are `null`; clients must not invent translations.

### `GET /api/hotel/v1/website/properties/{propertySlug}/room-categories?locale=fa|en|ar`

Returns `mode`, locale, property slug, and only active room categories with the existing current publication approval. Each item contains its public slug/name/description/localized text, guest capacity, beds, size, and eligible gallery. It excludes internal IDs, allotment/inventory, rates, guest data, management notes, and booking controls. Website-only operation is supported; this route does not use `HOTEL_BOOKING`.

### `GET /api/hotel/v1/website/media/{associationId}`

The opaque association identifier is a delivery handle, not an authorization token. On every request the server rechecks host, tenant, active property, current publication/revision, association scope, room approval where relevant, and current image owner/access/MIME/serving URL. Eligible media returns a `302` to the current platform-served local upload or public Vercel Blob URL; an ineligible or out-of-scope asset returns a generic `404`. The UI should use the API `src` from the JSON response and must not construct storage URLs or retain preview image URLs as published assets.

## Response and UI behavior

The frontend should fetch these routes from its same public Hotel origin with an explicit locale. Validate the `mode` field and handle `UNPUBLISHED` as a real empty state. A transport `404` means tenant/property/public content is unavailable; `400` means invalid locale/slug; `503 {"error":"WEBSITE_DISABLED"}` means the global rollout gate is off; `500 {"error":"UNAVAILABLE"}` is intentionally generic. Never cache these responses in a browser/service worker/CDN. Render only server-returned fields. Do not infer booking availability from room category presence.

Property and room gallery `src` values are same-origin opaque association routes. Render them as provided. If media becomes private, is deleted, changes MIME/URL eligibility, the association is excluded on later reads and the delivery route fails closed. Editorial revisions and their media links are immutable; changes require a new revision and approval/publication. Existing preview/conceptual F1 assets are not approved production content and must remain visually separated from API-backed content.

## C1B1 authenticated management contract

Management routes are scoped by organization and property path, require authenticated server session and active membership (or platform SUPER_ADMIN under the C1B1 policy), active Hotel property, and `HOTEL_WEBSITE`. Reads and writes are `private, no-store`. State changes require same-origin validation and an `Idempotency-Key`; actor identity, tenant, and role are derived from trusted server context.

- `GET /api/organizations/{organizationId}/hotels/{propertyId}/website/revisions`
- `POST .../website/revisions` with `{ content, media }` creates a DRAFT immutable revision.
- `GET .../website/revisions/{revisionId}/preview?locale=fa|en|ar` returns authenticated `mode: "PREVIEW"`; do not expose it as a public link or cache it.
- `POST .../website/revisions/{revisionId}/submit` transitions `DRAFT → IN_REVIEW`.
- `POST .../website/revisions/{revisionId}/review` with `{ decision: "APPROVED" | "REJECTED", note? }` requires an independent ADMIN/platform SUPER_ADMIN reviewer. The author cannot approve their own revision.
- `POST .../website/revisions/{revisionId}/publish` publishes that exact approved revision only if no active publication exists.
- `GET .../website/history` lists review/publication history.
- `POST .../website/publications/{publicationId}/revoke` with `{ reason? }` revokes while preserving history.

ADMIN/MANAGER may draft and submit. Organization ADMIN or platform SUPER_ADMIN may review, publish, and revoke; self-review is always denied. A replacement currently requires revoking the old publication before publishing a new one, so a temporary unavailable interval is possible. Do not assume atomic replacement.

## Integration requirements and current limits

Apply the active host's branding/theme separately using the platform tenant-branding contract; do not hardcode Damoon identity. The public content model currently has no approved editorial address visibility field, no public article/page route beyond the property HOME publication, and no price or availability projection in C1B2. Do not fabricate those fields. Future media content must continue to use platform-owned Image rows and C1A revision-scoped associations. C1B2 intentionally has no frontend dependency and no public content-preview route.
