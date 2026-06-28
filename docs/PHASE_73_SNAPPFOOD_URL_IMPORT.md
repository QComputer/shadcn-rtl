# Phase 73 - Snappfood URL Import MVP

Date: 2026-06-28

## Goal

Support cautious one-time Snappfood seller URL intake while preserving consent, source evidence, and draft review.

## Implemented

- Added `lib/import-hub/snappfood-adapter.ts`.
- Validated seller-provided `snappfood.ir` URLs for `SNAP_FOOD` imports.
- Kept public fetching disabled by default through `snappfoodPublicFetchEnabled()`.
- Created fallback product draft rows with source URL evidence and review warnings.
- Added `scripts/quality/validate-snappfood-url-import.mjs` and `quality:snappfood-url-import`.

## Safety

- Seller ownership/permission confirmation remains required through the existing third-party URL consent guard.
- No network requests, hidden crawling, authentication, or provider SDK calls are used.
- Fallback rows are marked `SNAPPFOOD_URL_FALLBACK` and remain drafts.
- Sellers are guided to review drafts manually or use CSV/manual import when parsing is uncertain.

## Validation

```powershell
pnpm run quality:snappfood-url-import
pnpm run typecheck
pnpm run quality:local
pnpm run build
```

## Next

P74 should mirror the cautious Snappfood approach for Snappmarket URLs with a dedicated detector, fallback rows, and no hidden crawling.
