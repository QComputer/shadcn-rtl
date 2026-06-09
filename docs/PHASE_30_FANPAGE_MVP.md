# Phase 30 — Fanpage MVP

Date: 2026-06-09

## Goal

Add the first real fanpage feature on top of the P28/P29 follow/public-experience foundation.

This phase implements a minimal organization fanpage feed with public reading and authenticated organization-manager posting. It intentionally does not add likes, comments, moderation queue, media upload workflow, or follower-only visibility yet.

## Implemented

### Data model

- Added `FanpagePost` Prisma model.
- Added relation fields from `Organization` and `User` to `FanpagePost`.
- Added migration `20260609004000_add_fanpage_posts`.

### API

- Added `GET /api/public/organizations/[slug]/fanpage/posts`.
  - Public, read-only.
  - Lists published, non-deleted posts for an active organization.
- Added `POST /api/public/organizations/[slug]/fanpage/posts`.
  - Requires authenticated session.
  - Requires `ADMIN` or `MANAGER` membership for the organization slug.
  - Rate-limited.
  - Validates title/body/image payload.

### UI

- Added `app/[locale]/organizations/[slug]/fanpage/page.tsx`.
- Added `FanpagePostCard`.
- Added `FanpagePostForm`.
- Added fanpage links to appointment organization layout and shop layout.
- Added FA/EN/AR fanpage dictionary keys.

### Guardrails

- Added `pnpm run quality:fanpage-mvp`.
- Added P30 validator into `quality:local`.
- Updated P28 readiness validator so a real P30 fanpage route no longer fails the old “not falsely implemented” check.

## Deferred

- Likes/reactions.
- Comments.
- Post editing/deletion.
- Drafts/moderation.
- Follower-only posts.
- Upload-backed images from the create form.
- Full dashboard management surface for posts.

## Required validation

```bash
pnpm exec prisma migrate deploy
pnpm run quality:fanpage-mvp
pnpm run typecheck
pnpm run build
pnpm run quality:local
```

## Recommended next phase

P31 — Fanpage engagement polish: edit/delete, optional comments/likes, and dashboard management.
