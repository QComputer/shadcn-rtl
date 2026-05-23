# Phase 16 — Public Engagement Hardening

## Goal

Harden organization engagement surfaces around reviews and follows while keeping the APIs usable for public organization/shop pages.

## Changes

- Rebuilt `review.service.ts`, replacing the previously commented-out implementation.
- Added `GET /api/reviews` for public paginated review listing.
- Added authenticated `POST /api/reviews` for creating one review per user per organization.
- Added `GET /api/reviews/[id]` for public review detail.
- Added authenticated `PATCH /api/reviews/[id]` and `DELETE /api/reviews/[id]` with owner/SUPER_ADMIN checks.
- Hardened follow/unfollow route with `requireAuthSession()` and consistent `jsonError()` handling.
- Follow/unfollow now validates that the target organization is active and not deleted.
- Follow/unfollow is idempotent where practical: repeated follow/unfollow requests no longer produce unsafe 500s.
- Review and follow write paths are rate-limited.
- Review list pagination is normalized and capped.
- Follower/following pagination is normalized and capped.
- Public review list only exposes active, non-deleted organizations when filtered by organization.

## Deployed smoke test

PowerShell:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase16
```

The smoke test checks:

- homepage availability,
- public review listing,
- clean 404 for unknown organization review filtering,
- unauthenticated review create/update/delete blocking,
- unauthenticated follow/unfollow blocking.

## Notes

Phase 16 does not add review UI to public organization pages yet. It creates the safe service/API foundation for that UI.

Review moderation, abuse detection, verified-purchase-only reviews, and public aggregate display widgets can be handled in a later phase.
