# Phase 28 — Follow/Fanpage Readiness Cleanup

Date: 2026-06-09

## Goal

Prepare the existing follow foundation for a later real fanpage implementation without adding post/feed business logic yet.

This phase is intentionally small and greenable. It cleans risky public organization/shop surfaces, wires the existing follow button into visible public pages, and adds a validator so fanpage readiness does not regress.

## Implemented changes

### Public organization layout safety

- `app/[locale]/appointment/[slug]/layout.tsx` now uses an explicit Prisma `select` instead of loading the full `Organization` row.
- The layout checks `type: "APPOINTMENT"`, `isActive: true`, and `deletedAt: null`.
- Metadata is generated directly from the database with the same safe select path instead of server-side self-fetching through `NEXT_PUBLIC_APP_URL`.
- The header now renders the real organization name instead of static `Logo` text.

### Follow button UX/readiness

- `components/follow/follow-button.tsx` now:
  - shows a login prompt for anonymous users instead of disappearing;
  - supports `callbackUrl` for returning after login;
  - uses dictionary-driven labels;
  - exposes `aria-pressed` for the follow state;
  - shows a visible error message on failed follow/unfollow;
  - uses logical spacing (`ms-1`) instead of RTL-unsafe `mr-1`.

### Follow button wiring

- The follow button is now visible on:
  - `app/[locale]/appointment/[slug]/page.tsx`
  - `app/[locale]/shop/[slug]/layout.tsx`

### Follow revalidation

- `lib/services/follow.service.ts` now revalidates public organization/shop pages for all configured locales through `supportedLocales` instead of hardcoding only `/fa/...` paths.

### Dictionary additions

Added organization follow/fanpage labels for `fa`, `en`, and `ar`:

- `organization.follow`
- `organization.following`
- `organization.loginToFollow`
- `organization.followUpdateError`
- `organization.fanpage`

### Validator

Added:

```bash
pnpm run quality:fanpage-readiness
```

The validator checks:

- public organization layout uses explicit select and active/deleted filters;
- organization metadata does not server-self-fetch;
- follow button is wired into appointment and shop public pages;
- follow button supports anonymous login, dictionary labels, visible error state, accessibility, and RTL-safe spacing;
- follow revalidation covers all supported locales;
- fanpage route is not falsely considered implemented.

## Not implemented in P28

The real fanpage feature is still not implemented. The following remain future phases:

- fanpage route;
- posts/feed/story models;
- post/comment/like APIs;
- feed UI;
- staff/admin fanpage posting workflow;
- follower list pages.

## Recommended next phase

```txt
P29 — Fanpage Content Model Foundation
```

Add post/comment/like schema and migrations only, with no broad UI implementation yet.
