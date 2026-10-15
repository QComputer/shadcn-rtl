# Hotel organization-site presentation handoff

Status: Hotel-owned presentation adapter and owner-preview mode are implemented. Platform route/data wiring is still required before `/[locale]/damoon-hotel` can display published Hotel data on the shared Bazarbaaz host.

## Hotel-owned files

- `lib/hotel/organization-site-presentation.ts` validates the existing F5 public reads and authenticated CMS preview response into a serializable presentation union. It preserves association media URLs from public responses, localizes CMS preview fields, drops invisible editorial sections, and never converts `UNPUBLISHED` to preview data.
- `components/published-hotel-website-page.tsx` accepts a preloaded presentation from a server parent. Without that prop it retains its existing custom-domain, no-store F5 API behavior. `PREVIEW` presentation is explicitly labeled and does not trigger a public read.
- `tests/unit/hotel/organization-site-presentation.test.ts` and additions to `tests/fixtures/published-hotel-website.browser.tsx` / `tests/published-hotel-website.browser.mjs` cover organization-scoped DTO validation and synthetic private preview.

The adapter is a presentation boundary, not an authorization mechanism. Public payloads must come from the published F5 service. `AUTHENTICATED_CMS_PREVIEW` must come from `GET /api/organizations/{organizationId}/hotels/{propertyId}/website/revisions/{revisionId}/preview`, whose existing authenticated service checks session, active membership, Hotel website capability, property scope and currently eligible media. A route must not label arbitrary client-provided JSON as an authenticated preview.

## Platform route contract required

The current generic organization page at `app/[locale]/[slug]/page.tsx` already resolves an active organization record, but its Hotel presentation context requires a verified Hotel request domain. On `bazarbaaz.ir/damoon-hotel`, the host is the platform host, so the Hotel host resolver correctly returns unavailable. Do not weaken that check or infer a tenant from an untrusted browser header.

Platform should select the Hotel presentation only after its normal server-side organization lookup and active capability checks, then provide a server-created context containing:

```ts
{
  organizationId: string;       // from the resolved active database organization
  organizationSlug: string;     // canonical resolved slug; expected damoon-hotel
  vertical: "HOTEL";
  hotelWebsiteActive: true;     // persisted active capability, not client state
  propertySlug: string;         // server-selected active property
  locale: "fa" | "en" | "ar";
}
```

The slug is a public route selector, not proof of user identity. Hotel data reads must be scoped to the resolved organization ID and property ID in server code. The existing public F5 reads and media route resolve tenant from `Host`; they cannot currently return Damoon content/media on the Bazarbaaz host. The integrated implementation therefore needs a server-only trusted-organization read path reusing `getPublishedHotelWebsite`, `listPublishedHotelWebsiteRoomCategories`, room publication checks and media eligibility. For each image request, the media association must be rechecked against that same organization/property, current approved publication, current PUBLIC image eligibility and current room approval. Do not implement this by accepting an organization ID from a browser query/header or by copying a publication snapshot into an unscoped cache.

`PublishedHotelWebsitePage` receives the result of `adaptHotelOrganizationPublicRead(website, rooms, expectedContext)`. The adapter rejects property/locale mismatches and leaves backend media URLs unchanged. Platform integration must also provide a trusted media URL path that remains association-ID based and revalidates publication/tenant ownership when fetched; until that exists, organization-hosted pages with galleries must not render the host-bound F5 media URL as if it were authorized for the platform host.

## Public, owner-preview and indexing behavior

- `PUBLISHED` is rendered only from validated F5 public response DTOs. No preview or fixture fallback is permitted.
- `UNPUBLISHED` uses the localized no-approved-content state and never includes draft text/media.
- `UNAVAILABLE` remains an unavailable/error state; it does not silently render conceptual data.
- `PREVIEW` can be created only from the existing CMS preview route response. That API enforces authenticated Hotel membership and its current role policy. It is labeled “private content preview” in fa/en/ar, does not issue public reads when preloaded, remains preview-only for booking, and omits room categories because the preview API does not provide the published room-category DTO.
- `hotelOrganizationRobots` returns noindex/nofollow by default. Indexing is permitted only when Platform explicitly supplies `PUBLIC_API`, owner-approved content provenance, explicit indexing approval, active organization, and active `HOTEL_WEBSITE`. Synthetic, preview, unpublished, unavailable or unknown-provenance content remains noindex.
- The shared `generateMetadata` in the organization route is Platform-owned. It must call the same server-side publication/provenance gate as rendering; do not index content based only on a localized slug or client component state.

## Exact Platform-owned integration changes

1. In the generic organization route, select the Hotel presentation through generic `vertical`/capability contracts and pass trusted resolved organization context; do not add a Damoon-specific platform condition.
2. Add a server-only organization-scoped public read adapter (or equivalent internal service contract) that reuses the F5 publication, capability and media validation logic. Keep existing domain-based public APIs unchanged for `damoon-hotel.ir`.
3. Provide association-ID media delivery bound to the resolved organization for platform-host pages, with per-request publication and media eligibility revalidation and `no-store` behavior.
4. Update generic organization metadata to noindex unpublished, unavailable, synthetic and unknown-provenance states, and to emit localized title/description only from eligible published content.
5. For owner review, render only a payload returned by the existing session-protected preview route. Keep it private/noindex and do not add preview data to public caches.

Do not modify Platform routing/authentication, Prisma, PWA, or global tenant resolution as part of this Hotel handoff.

## Visual and operation boundaries

The existing F1.4 ivory/natural wood/green/terracotta page, fa/en/ar text, Jalali picker, guest selector and room gallery are reused. Search remains client-side validation/preview only. No availability, quote, hold, payment or notification request is made. Do not display conceptual fixtures as official Hotel assets or claims.

Current backend/owner-approved Hotel Damoon photography, confirmed room categories, factual descriptions, amenities, policies and verified translations remain content dependencies. CMS publication approval does not by itself prove that conceptual data is factual; Platform must separately mark provenance before enabling indexing.

## Validation

```powershell
pnpm exec tsx --test tests/unit/hotel/organization-site-presentation.test.ts tests/hotel-website-public-adapter.test.mjs
node --import tsx tests/published-hotel-website.browser.mjs
```

Browser fixtures are synthetic and local. They do not prove integrated Platform route wiring, production domain behavior or real CMS authorization.
