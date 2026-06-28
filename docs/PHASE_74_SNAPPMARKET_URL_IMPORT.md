# Phase 74 - Snappmarket URL Import MVP

Date: 2026-06-28

## Goal

Mirror the cautious Snappfood URL-import approach for Snappmarket seller and product URLs.

## Implemented

- Added `lib/import-hub/snappmarket-adapter.ts`.
- Validated seller-provided `snapp.market` and `snappmarket.ir` URLs for `SNAP_MARKET` imports.
- Kept public fetching disabled by default through `snappmarketPublicFetchEnabled()`.
- Created fallback product draft rows with source URL evidence and review warnings.
- Added `scripts/quality/validate-snappmarket-url-import.mjs` and `quality:snappmarket-url-import`.

## Safety

- Seller ownership/permission confirmation remains required through the existing third-party URL consent guard.
- No network requests, hidden crawling, authentication, or provider SDK calls are used.
- Fallback rows are marked `SNAPPMARKET_URL_FALLBACK` and remain drafts.
- Sellers are guided to review drafts manually or use CSV/manual import when parsing is uncertain.

## Validation

```powershell
pnpm run quality:snappmarket-url-import
pnpm run typecheck
pnpm run quality:local
pnpm run build
```

## Next

P75 should add manual Telegram post import for public seller-permitted post URLs and pasted content without private/auth-gated scraping.
