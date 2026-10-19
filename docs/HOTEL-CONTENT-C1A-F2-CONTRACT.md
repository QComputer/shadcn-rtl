# Hotel website content foundation (C1A)

C1A establishes tenant-scoped persistence for Hotel website copy and media associations. It does not expose a public endpoint or CMS UI. Booking, rate, inventory, hold, and reservation records remain separate.

## Capability boundary

`HOTEL_WEBSITE` is an independently persisted `OrganizationCapabilityKey`; it is not inferred from the HOTEL vertical and is not the `HOTEL_BOOKING` capability. An ordered migration first commits the PostgreSQL enum value, then adds the content schema and a database constraint that requires an explicit `enabledAt` value for an active website grant. The migrations create no grants and do not activate any tenant. Website management writes require an active Hotel organization, active `HOTEL_WEBSITE`, an active ADMIN/MANAGER membership (or verified platform SUPER_ADMIN), and an active property. Disabling the capability rejects new edits without deleting stored pages, revisions, media links, publication history, or audits.

`HOTEL_BOOKING` remains the gate for availability, rates, quotes, holds, reservations, and payment operations. C1A does not alter R1 tenant resolution or public catalog behavior. A later public-read change should add a website-specific host resolver requiring `HOTEL_WEBSITE` for property and editorial catalog responses, while retaining a distinct booking resolver requiring `HOTEL_BOOKING` for availability, quotes, and booking actions. That migration needs focused route tests and a separately reviewed rollout plan.

Website media references point to the existing tenant-owned `Image` record; C1A does not add a copy or upload system. The current `Image` model has no soft-delete column. A hard delete is restricted while a revision references it. If an image is later changed to `PRIVATE` or its URL/MIME ceases to satisfy the serving policy, the stored revision association remains historical, but a future public content reader must re-check current `access`, URL, and MIME eligibility and omit the asset instead of serving it. The content schema does not lock mutable `Image` fields.

The existing `BusinessCapability` registry remains limited to the SHOP and APPOINTMENT public surfaces. `HOTEL_WEBSITE` is a persisted function permission, not a new legacy page-surface entry. This avoids accidentally enabling Hotel booking or altering public-home behavior.

## Persistence and revision contract

- `HotelWebsitePage` is a unique `(organizationId, propertyId, pageKey)` container; C1A creates the `HOME` key lazily when a draft is saved.
- `HotelWebsiteContentRevision` stores strict localized content, an increasing per-page revision number, SHA-256 content-and-media fingerprint, creator, and review state. Editing creates another row. The migration trigger prevents mutation of snapshot identity, content, hash, sequence, and creator. Only review state may transition.
- `HotelWebsiteMediaAssociation` binds an existing `Image` row to a property or room category and one exact revision, with gallery slot, deterministic sort order, and localized alt text. It creates no objects and has no remote-URL field.
- `HotelWebsitePublication` points at one exact page revision. A partial unique index permits at most one non-revoked publication per page; a new draft does not touch it. Revocation retains the historical row.
- `HotelWebsiteContentReview` records submit/approve/reject events for exact revisions. Future review, publish, and revoke implementations must write their audit/review/publication records in the same transaction and must fail the operation if the durable audit write fails.

The content JSON uses strict Zod discriminated sections (`TEXT`, `FEATURE_LIST`, `FAQ`) with bounded localized `fa`, `en`, and `ar` strings. It does not accept unknown fields or embedded HTML. Rendering still must HTML-escape text. Contact address copy requires the future public-read layer to honor organization address visibility policy; C1A has no public response path.

## Existing media reuse

The association uses the existing `Image` row and existing upload/storage/derivative system. The draft service only accepts an image found by both `id` and the same non-null organization owner with `access = PUBLIC`, and only accepts active room categories belonging to the same organization and property. A cross-tenant, private, absent, or deleted (no longer present) image is rejected. Composite foreign keys enforce organization ownership for images and property scope for room categories. Conceptual F1 preview images are not seeded or attached by C1A.

## Frontend and future API modes

The shared typed contract distinguishes `mode: "PUBLISHED"` from authenticated `mode: "PREVIEW"`. Published responses should be resolved from the normalized request host to the active organization/domain, then property; they must select only the current non-revoked publication and its exact approved revision. Preview must be authenticated, membership-scoped, uncached, and visibly marked `PREVIEW`. The media DTO contains only same-origin `/api/...` serving paths plus localized alt text and order; it never contains arbitrary source URLs or storage keys.

F2 should compose, rather than merge, these sources:

- organization theme and identity from existing organization-domain/branding resolution;
- property and room catalog from the R1 published catalog APIs;
- editorial sections and galleries from future C1 public content reads;
- date-specific availability only from existing booking-gated APIs.

Keep locale selection explicit for `fa`, `en`, or `ar`. Missing translations remain absent/null; clients must not invent copy. Empty published content and empty room galleries are valid empty states. An informational catalog or gallery must not imply live availability or guarantee a reservation.

## Future workflow requirements

The current `HotelManagementService` is tied to `HOTEL_BOOKING`; CMS routes must use a dedicated website-content authorization policy and must not enable booking as a side effect. A later milestone must implement review state transitions, exact-revision publish/revoke operations, publication-history lookup, route same-origin protection, cache policy, address visibility checks, audit tests, and PostgreSQL acceptance. It must also decide whether website capability management stays in the existing audited organization capabilities endpoint or moves to a separately scoped platform/organization policy UI.
