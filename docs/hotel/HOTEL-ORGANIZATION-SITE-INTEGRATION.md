# Hotel organization-site integration boundary

**Status: local integrated acceptance passed; Production activation remains blocked by the preflight below.** The shared organization route supports the canonical platform host with a public `organizationSlug` route selector. That slug selects the organization on the server; it is not browser tenant authority, an authentication credential, or an authorization decision. Custom-domain resolution remains restricted to verified host-to-organization mappings. Do not accept a tenant ID or slug from a browser header/query as authority.

## Trusted public route and data flow

The generic route at `app/[locale]/[slug]/page.tsx` resolves the active organization from the public slug, then selects the Hotel presentation only for a Hotel organization with its persisted active website capability and eligible active property. Server-side Hotel reads go through server-only `readHotelOrganizationSite`, which scopes reads to that trusted database organization/property and calls `getPublishedHotelOrganizationSnapshot` with `RepeatableRead` isolation. React `cache` is request-only for the shared metadata/render pass; it is not a cross-request publication or tenant cache.

The presentation adapter in `lib/hotel/organization-site-presentation.ts` validates the existing F5 public-read and authenticated CMS-preview DTOs into a serializable union. `components/published-hotel-website-page.tsx` renders a preloaded presentation and retains its existing verified-custom-domain API behavior when no preloaded prop is supplied. `PUBLISHED` uses eligible published data; `UNPUBLISHED` shows the localized no-approved-content state; `UNAVAILABLE` remains unavailable; none may fall back to preview or synthetic content.

Published association media URLs remain opaque association URLs and preserve `organizationSlug` through the platform-host path. Each request revalidates association ownership, organization/property binding, current publication, and media eligibility. This protects future fetches after revocation or eligibility changes. It cannot recall or erase a raw public download that a consumer already obtained; do not describe revocation as retroactive erasure.

## CMS preview and indexing

The accepted presentation renderer is wired into the existing authenticated CMS preview tab using the existing preview API response. That response must continue to come from `GET /api/organizations/{organizationId}/hotels/{propertyId}/website/revisions/{revisionId}/preview`; its session, active membership, capability, property, role, and media checks remain the authority. Preview is explicitly private, labeled in fa/en/ar, and must not be inserted into public metadata or shared caches.

Hotel dashboard routes remain `noindex`. Public organization metadata also defaults to `noindex` because there is no persisted owner-provenance and indexing-consent contract yet. Do not enable indexing based only on slug, publication state, CMS approval, or the presence of copy. If such a contract is added later, it needs persisted owner-approved provenance and explicit indexing consent evaluated on the same trusted server path as rendering.

## Presentation and product boundary

The existing Hotel-owned presentation, localized fa/en/ar fields, and CMS content model remain the source of copy and approved assets. Keep RTL for fa/ar and LTR for en. Empty translations remain empty; do not fill them with another locale or fixtures. Property/CMS publication remains a separate editorial action and does not imply booking availability or financial setup. Keep `HOTEL_BOOKING` absent unless separately authorized and implemented. Search and booking affordances remain preview-only where the published service does not provide those operations.

For the intended public target, `https://bazarbaaz.ir/damoon-hotel` is the canonical-platform-host route using `organizationSlug=damoon-hotel`. The expected localized route behavior must be checked at the authorized deployment. This document contains no Production route, migration, content-publication, authorization, or browser acceptance claim.

## Focused acceptance evidence

See `HOTEL-INTEGRATED-ONBOARDING-ACCEPTANCE.md` for the exact local PostgreSQL, production-server Chromium, focused regression and build evidence. Canonical platform routes were tested with actual F5 API responses and synthetic fixtures; custom-domain security regressions passed at the source/service level. No new deployed custom-domain, real owner-content or Production acceptance is claimed.
