# Hotel content management API contract (C1B1)

C1B1 adds authenticated management operations over the C1A immutable revision model. It does not add a CMS frontend, public editorial GET route, or booking action.

## Tenant and authorization

Every route is scoped by `organizationId` and `propertyId` in its path. The caller is derived from the authenticated server session; body-supplied actor, tenant, or role values are never trusted. Non-platform users must match the session organization and have an active organization membership. All reads and writes require an active HOTEL organization, active property, and `HOTEL_WEBSITE` capability. State-changing requests require same-origin validation and `Idempotency-Key` (8–128 characters).

- ADMIN and MANAGER members may create drafts, list revisions, preview, and submit for review.
- Approval or rejection requires an organization ADMIN member or platform SUPER_ADMIN. The reviewer must differ from the revision creator.
- Publishing and revocation require an organization ADMIN or platform SUPER_ADMIN.
- All workflow operations fail closed when HOTEL_WEBSITE is disabled. Stored revisions and history remain intact.
- HOTEL_BOOKING is separate. C1B1 neither activates it nor changes R1 catalog, availability, quote, or hold gates.

## Routes

All responses are JSON and `Cache-Control: private, no-store, max-age=0`. Safe errors are 400 malformed input/missing key, 401 unauthenticated, 403 forbidden, 404 out of scope/not found, 409 stale/conflicting transition or idempotency-key reuse with a different payload, and 422 schema validation.

| Method and path | Request | Result |
|---|---|---|
| `GET /api/organizations/{organizationId}/hotels/{propertyId}/website/revisions` | None | Revision summaries newest first, with review/publication summaries. |
| `POST .../website/revisions` | `{ content, media }` matching the C1A strict schemas | Creates a DRAFT immutable revision and returns its ID, number, status, hash, and creation time. |
| `GET .../website/revisions/{revisionId}/preview?locale=fa\|en\|ar` | Locale defaults to `fa` | Authenticated `{ mode: "PREVIEW", locale, revisionId, revisionNumber, status, pageKey, content, media }`; current media eligibility is rechecked. |
| `POST .../website/revisions/{revisionId}/submit` | `{ note? }` | DRAFT → IN_REVIEW. |
| `POST .../website/revisions/{revisionId}/review` | `{ decision: "APPROVED"\|"REJECTED", note? }` | IN_REVIEW → APPROVED or REJECTED by an independent authorized reviewer. |
| `POST .../website/revisions/{revisionId}/publish` | `{}` | Publishes the exact APPROVED revision if the page has no active publication. Revoke first to replace. |
| `GET .../website/history` | None | Review and publication/revocation history. |
| `POST .../website/publications/{publicationId}/revoke` | `{ reason? }` | Revokes the active publication without deleting history. |

`Idempotency-Key` is mandatory on each POST. The key is scoped to organization, property, and operation and is bound to its original actor. A byte-semantically equivalent normalized request from that same actor replays its stored response after current authorization is rechecked; a different actor or a different request using that key receives 409. Audit, workflow state, and idempotency result commit atomically.

## State and media contract

Lifecycle: `DRAFT → IN_REVIEW → APPROVED` or `REJECTED`; publication is a separate row referencing the approved immutable revision; revocation marks that publication inactive and retains it. Rejected content is not edited in place; create a new draft. A new draft never changes the active publication pointer. The active-publication uniqueness constraint serializes conflicting publishes.

Gallery changes are made by creating a revision with the full desired property/room media associations. Existing revision links are never edited in place. The server requires tenant-owned, currently PUBLIC Image rows with an accepted MIME type, safe filename, supported serving URL, and active room/property scope. Preview, approval, and publication recheck those facts. Preview emits only eligible media URLs; it is authenticated and not a public endpoint. Any future public reader must recheck mutable Image eligibility on every request rather than trusting an earlier approval.

Publishing a replacement currently requires revoking the active publication first. This preserves a simple one-active-publication constraint but can create a temporary no-publication interval if replacement publishing then fails. A future reviewed enhancement could use one transactional `replacePublication` operation that verifies and publishes the approved replacement before revoking the prior row in the same transaction.

Missing locale text remains absent; clients must not invent translations. The request and preview contracts support `fa`, `en`, and `ar`. No response implies that hotel availability or a reservation is guaranteed.
