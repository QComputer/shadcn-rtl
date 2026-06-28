# Phase 75 - Telegram Post Import

Date: 2026-06-28

## Goal

Support manual Telegram post import for public seller-permitted post URLs and pasted content.

## Implemented

- Added `lib/import-hub/telegram-manual-parser.ts`.
- Accepted public `t.me/{channel}/{postId}` or `telegram.me/{channel}/{postId}` URLs.
- Parsed pasted Telegram text, hashtags, mentions, likely product hints, source channel/post evidence, and approved media references.
- Saved imported Telegram material as `ImportedContentDraft` rows.
- Added `scripts/quality/validate-telegram-post-import.mjs` and `quality:telegram-post-import`.

## Safety

- Seller ownership/permission confirmation remains required through the existing third-party URL consent guard.
- No Telegram network requests, private channel access, auth-gated scraping, or background crawling are used.
- Telegram fetching is hard-disabled through `telegramFetchEnabled()`.
- Draft review does not publish fanpage posts.

## Validation

```powershell
pnpm run quality:telegram-post-import
pnpm run typecheck
pnpm run quality:local
pnpm run build
```

## Next

P76 should add external source mapping and re-import diff support so repeat imports can merge, skip, or create drafts with clear audit evidence.
