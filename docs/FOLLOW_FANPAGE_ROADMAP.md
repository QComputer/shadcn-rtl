# Follow & Fanpage Roadmap — Current State

Date: 2026-06-25

This document replaces the older `FollowPost` planning notes. The implemented model is now `FanpagePost`.

## Current status

### Implemented follow foundation

| Item | Location | Status |
| --- | --- | --- |
| Follow model | `prisma/schema.prisma` | Implemented |
| Follow service | `lib/services/follow.service.ts` | Implemented |
| Follow API | `app/api/organizations/[id]/follow/route.ts` | `POST`, `DELETE` |
| Follow button | `components/follow/follow-button.tsx` | Implemented |
| Public follow prompts/links | appointment and shop public layouts/pages | Implemented |
| Readiness validator | `scripts/quality/validate-fanpage-readiness.mjs` | Included in `quality:local` |

### Implemented fanpage MVP

| Item | Location | Status |
| --- | --- | --- |
| Fanpage post model | `FanpagePost` in `prisma/schema.prisma` | Implemented |
| Migration | `prisma/migrations/20260609004000_add_fanpage_posts` | Implemented |
| Fanpage service | `lib/services/fanpage.service.ts` | Implemented |
| Public posts API | `app/api/public/organizations/[slug]/fanpage/posts/route.ts` | `GET`, `POST` |
| Appointment fanpage | `app/[locale]/appointment/[slug]/fanpage/page.tsx` | Implemented |
| Shop fanpage | `app/[locale]/shop/[slug]/fanpage/page.tsx` | Implemented |
| Post card | `components/follow/fanpage-post-card.tsx` | Implemented |
| Create-post form | `components/follow/fanpage-post-form.tsx` | Implemented |
| Fanpage dictionaries | `dictionaries/fa.json`, `en.json`, `ar.json` | Key-complete |
| MVP validator | `scripts/quality/validate-fanpage-mvp.mjs` | Included in `quality:local` |

## Current API behavior

| Endpoint | Method | Access | Purpose |
| --- | --- | --- | --- |
| `/api/public/organizations/{slug}/fanpage/posts` | `GET` | Public | List published, non-deleted posts for an active organization. |
| `/api/public/organizations/{slug}/fanpage/posts` | `POST` | Authenticated organization `ADMIN`/`MANAGER` | Create a fanpage post for the organization slug. |
| `/api/organizations/{id}/follow` | `POST` | Authenticated customer/user | Follow an active organization. |
| `/api/organizations/{id}/follow` | `DELETE` | Authenticated customer/user | Unfollow an organization. |

## Current public page behavior

- Appointment organizations expose: `/{locale}/appointment/{slug}/fanpage`.
- Shop organizations expose: `/{locale}/shop/{slug}/fanpage`.
- Public navigation links are present from appointment/shop layouts.
- The fanpage service revalidates both appointment and shop fanpage paths across configured locales.
- Anonymous users can read published fanpage posts.
- Authorized managers/admins can create text/image/video-link posts through the current form/API.

## Deferred feature backlog

Keep these as future phases rather than mixing them into unrelated stabilization work.

### P35+ candidate: fanpage management and moderation

- Add dashboard post management for organization admins/managers.
- Add edit/delete endpoints with membership checks.
- Add soft-delete UI and audit logging.
- Add draft/published status controls.

### Later: engagement features

- Likes/reactions.
- Comments and replies.
- Comment moderation and abuse controls.
- Follower-only post visibility.
- Notification fanout to followers.

### Later: media workflow

- Replace raw image/video URL fields with upload-backed media selection.
- Enforce upload access rules through `ImageAccess`/media helpers.
- Add post media previews and validation for image/video formats.

### Later: feed quality

- Pagination/infinite scroll.
- Pinned posts.
- Story-like short-lived posts.
- Organization profile highlights.

## Validation commands

```powershell
pnpm run quality:fanpage-readiness
pnpm run quality:fanpage-mvp
pnpm run quality:i18n-completion
pnpm run quality:local
```

For runtime confirmation after deployment, manually verify at least one appointment organization and one shop organization:

```txt
/fa/appointment/{slug}/fanpage
/fa/shop/{slug}/fanpage
/api/public/organizations/{slug}/fanpage/posts
```
