# Hotel Damoon — accommodation category management and content contract

**Status: PR148 implementation and disposable-PostgreSQL acceptance passed; public assets hash-match the merge; interactive Production CMS acceptance pending.** Read alongside `OWNER-DECISION-ACCOMMODATION-BASELINE-2026-11-23.md`.

## Existing sources to inspect

- `sites/damoon/content.js`, `accommodation.js`, `booking.js`, `booking-flow.js`, `translations.js` and generated `public/damoon-front/**` (the public static bundle is currently hardcoded in parts).
- Existing Hotel management workspace, CMS draft/review/publish/revoke APIs, `HotelRoomType`, `HotelPhysicalRoom`, site publication and scoped Hotel services. Reuse rather than duplicating them.
- Current frontend category identifiers/aliases and the four approved VTour associations; preserve valid historical links during transition.

## Two different data domains

**A. Editorial / public accommodation catalog** — titles and descriptions in FA/EN/AR; ordered cards; display categories; published images; selected presentation quantity; category status; optional confirmed amenity/capacity text; preview/review/publish/rollback. This is not inventory authority.

**B. Operational inventory** — property-scoped physical room IDs, dates, out-of-service blocks, allocations, holds/reservations, priced rates and audit. Cannot be changed by an editorial count input.

If existing platform models cannot safely represent both without a schema extension, deliver a design+tests+separately gated additive migration; never merge editor fields into dangerous operational write paths as a shortcut. Avoid a permanent second source of truth.

## Management UI acceptance criteria

- Tenant/property-bound page with role-based access; manager edit and independent reviewer publication where existing policy requires it.
- Editable category name/description for FA, EN and AR; safe fallback for missing translations, no translation fabrications.
- Editable category quantity (whole integer, nonnegative), display order, media slot associations, visibility and publication status; totals cross-check against `20 rooms + 11 suites = 31 units` by default.
- Category IDs stable for historical URLs and references; rename and reclassification preserve prior slugs via reviewed redirects/aliases, and preserve guest stay inputs.
- All edits have actor, timestamp, reason and revision; publish/revoke operations must show the last effective public snapshot.
- New category photos require provenance, rights clearance and staged approval. `noindex` remains until separate general content authorization.
- Public read is scoped to trusted Host and Hotel tenant/property; only published data appears to guests; private drafts and staff notes must not leak.
- A manager can update an already-published category and publish the next approved revision without rebuilding or redeploying the frontend.
- Invalid changes, permission denial, tenant crossing, duplicate names/slugs, arithmetic mismatch and concurrent edits produce safe errors with no partial commits.

## Explicit non-goals / fail-closed behavior

- Do not seed 31 synthetic physical rooms into Production or assign physical identifiers such as 101/303 based only on category counts.
- Do not automatically set room occupancy/capacity, extra beds or inventory from marketing labels.
- Do not activate availability/price/hold/reservation/payment workflows, modify PR140, run Production migrations or override `DAMOON_PUBLIC_BOOKING_ACTIVATION`.
- Do not erase historical source facts or previous publications; record supersession and keep ability to audit previous snapshots.

## Test matrix

| Scenario | Expected result |
|---|---|
| initial five-category configuration | 3 + 17 + 6 + 3 + 2 = 31; room/suite totals 20/11 |
| manager edits count/category title in disposable DB | new draft saved; public unchanged until approved publication |
| independent approval/publish | FA/EN/AR public GET updated without code deployment |
| unauthenticated / wrong role | denied; no partial write |
| another tenant/property | denied; data not leaked |
| occupied/reserved/maintenance physical room exists | no inventory modification by editorial category change |
| old room slugs, URL query stay selections and VTour linking | backward-compatible or explicit safe redirect |
| concurrent edits / revocation | version-conflict and recoverable revision history |
| source schema missing | do not fake persistence; mark gated migration dependency |

## PR148 implementation evidence

The first editable public category catalog is implemented in PR148 at head `65f010bfdd58b3697d6edcb46c47170484d46e0b`, merged as `9379d82761bea87c20b86be1a96da9dcb9bd7428`. Workflow `45088093245` passed on disposable PostgreSQL for draft invisibility, manager edit, independent admin review/approval/publication, public read, 3/17/6/3/2 quantities, FA/EN/AR content, tenant isolation and safe projection. The live public manifest now hash-matches PR148, but the Runflare version/source revision is not exposed by current health metadata and public CMS edit/publish acceptance remains untested. No migration, Production data write or booking activation was introduced.
