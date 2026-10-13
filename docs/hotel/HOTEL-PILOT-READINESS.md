# Hotel Damoon pilot readiness

**Candidate:** F4 pilot baseline, based on the accepted F3 unified application.
**Purpose:** owner-led local/staging acceptance only. This document does not authorize publication, booking, payments, migration, DNS changes, or deployment.

## Ready for owner testing

- Unified Next.js app includes the authenticated Hotel website CMS workspace and the public Hotel website route in the same locale-aware application.
- CMS supports draft editing, authenticated preview, submission for review, independent review, publication, revocation, and revision/history views through the accepted C1B1 API contract.
- CMS authors are ADMIN/MANAGER; review, publish, and revoke are restricted to the independent ADMIN/SUPER_ADMIN policy. Self-review is denied by the backend policy.
- The public Hotel route resolves tenant context from the trusted active host/domain and uses the published C1B2 website and room-category contracts. It does not fall back from PUBLISHED to preview data.
- The preview-only Hotel homepage retains the approved Persian-first RTL composition, Jalali date-range picker, guest composition selector, room gallery, and conceptual-image notices. The visual pass improves token isolation in the locale shell, contrast, touch targets, and mobile dialogs.
- The booking search in the preview remains informational. It does not create holds, reservations, quotes, payments, or inventory mutations.

## Not operational in this candidate

- Public website reads are safe-disabled unless `HOTEL_WEBSITE_PUBLIC_OPERATIONAL_ENABLED=1` is explicitly set in an authorized isolated environment. Keep it off in staging/production until separately accepted.
- Hotel booking and anonymous holds are not enabled by this pilot. Availability, prices, holds, reservation confirmation, and payment flows are not part of the public informational site.
- No CMS user accounts, role grants, organization capability grants, active domains, or property publication are provisioned by this change.
- The F4 browser smoke uses the concept-only `/fa/hotel-preview` route in Next.js development mode and confirms the public website API remains `503 WEBSITE_DISABLED`; it does not prove a production-server run, live published tenant page, or database-backed CMS workflow. The optimized production build itself succeeds. Local `next start` requires the repository's production `NEXTAUTH_SECRET`; no runtime secret was available/authorized to use, so production-mode browser verification remains a staging prerequisite.
- Screenshots under `artifacts/f4/` are real Playwright viewport captures from that development preview. They are not production-mode captures and may include the Next.js development indicator.
- With only a loopback placeholder database URL and no test database, the shared tenant favicon resolver attempts database reads and returns `500` for `/favicon.ico`. The preview page itself is `200`. This is an environment prerequisite for a clean integrated-shell browser run, not a hotel CSS fallback; verify it against an authorized disposable/staging database rather than weakening the shared resolver.

## Content and asset gaps

- Official owner-approved Hotel Damoon logo/brand package and production photography still need to be supplied and rights-cleared. Existing conceptual images are marked as design references and must not be published as hotel photographs.
- Owner-approved Persian/English/Arabic editorial copy, contact details, address visibility, room descriptions, and approved room/property galleries are needed in the CMS before publication.
- Do not invent room quantities, amenities, policies, guest reviews, rates, or availability. C1B2 intentionally omits prices and inventory.
- The public website contract has no public address-visibility field. Do not expose the management address by inference.

## Staging prerequisites

1. Create a dedicated staging deployment and isolated staging database using the platform's approved operations. Apply reviewed migrations through the normal release workflow; this F4 task performs no migration or database operation.
2. Configure the tenant's active Hotel organization/domain and `HOTEL_WEBSITE` capability through the supported management workflow. Do not infer authorization from a slug or client field.
3. Keep `HOTEL_WEBSITE_PUBLIC_OPERATIONAL_ENABLED` off until the owner approves a staged public-read test and all approved content/media are ready. Keep anonymous holds and booking operations off.
4. Configure trusted host forwarding and tenant resolution in staging. Confirm the request host cannot be overridden by an untrusted client header.
5. Supply approved image assets and translations, then create a new CMS revision. Verify preview, author submission, independent reviewer decision, publication, public reads, and revocation.
6. Ensure staging secrets are injected by the approved secret manager. Never copy local or production secrets into this worktree.

## Required test accounts and roles

Use owner-provisioned staging accounts for:

- Hotel ADMIN who authors and submits a draft.
- Hotel MANAGER who can draft/submit but cannot approve, publish, or revoke.
- A distinct Hotel ADMIN reviewer/publisher who is not the draft author.
- Platform SUPER_ADMIN only if the owner explicitly wants to exercise the platform override policy.
- An unrelated organization member to verify cross-tenant denial.
- Anonymous visitor for public host/capability/publication checks.

Do not create credentials or grant roles as part of this local source task. Test passwords must be delivered through the owner's approved channel, not stored in this repository.

## Manual owner acceptance scenarios

1. Open the Persian, English, and Arabic locale preview at 390px, 768px, and 1440px. Check RTL/LTR behavior, hero contrast, keyboard focus, date picker, guest selector, room gallery, and reduced motion. Verify the conceptual labels remain visible.
2. Confirm preview booking submission gives a preview-only message and creates no network request to availability, quote, hold, reservation, or payment endpoints.
3. With the public operational gate off, request the public website route and confirm the generic disabled response does not contain preview content.
4. In staging, sign in as ADMIN or MANAGER, edit a draft, and inspect its authenticated preview. Submit as the author. Confirm the author cannot approve their own work.
5. Review as a distinct ADMIN. Verify MANAGER cannot review, publish, or revoke. Publish only the approved revision.
6. Visit the active tenant domain and verify only published localized fields and approved media render. Verify missing translations remain empty, and no rates, inventory, private address, guest data, or internal IDs appear.
7. Revoke publication, then verify new public reads fail closed and the site presents the unavailable/unpublished state. Confirm no preview fallback appears.
8. Repeat key public checks on an unrelated tenant domain and an unknown host; verify no cross-tenant content or media is returned.

## Remaining security and UX gates

- Real database-backed CMS and publication acceptance must be performed in an authorized disposable/staging database; it is not claimed by this F4 local preview.
- Public release requires owner-approved content and assets, staging host/capability setup, role-account validation, operational-gate approval, and a separately reviewed release plan.
- Booking remains a separate milestone. Do not interpret room-category publication or preview search as availability or booking authorization.
- This candidate has not been deployed and makes no claim of production, browser-on-production, or public-rollout acceptance.
