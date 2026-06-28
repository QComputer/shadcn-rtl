# Phase 70 - Manual Instagram Fanpage Import

Date: 2026-06-28

## Goal

Support consent-based manual Instagram post import into reviewable fanpage content drafts.

## Implemented

- Added `lib/import-hub/instagram-manual-parser.ts`.
- Accepted seller-provided Instagram post URLs, pasted captions, and approved media reference URLs.
- Extracted hashtags, mentions, likely product hints, and Instagram source identifiers deterministically.
- Saved manual Instagram imports as `ImportedContentDraft` rows with source metadata, raw seller input, warnings, and primary media preview URL.
- Kept imported content draft-only. No fanpage posts are published and no Instagram scraping/API calls are performed.
- Extended the import dashboard to paste approved media references and review content drafts beside product drafts.
- Added `scripts/quality/validate-manual-instagram-import.mjs` and `quality:manual-instagram-import`.

## Safety

- Seller consent is still required for third-party Instagram URLs.
- The implementation never fetches Instagram content.
- Media references are remote preview references only. Copying to Blob remains a future explicit approval step.
- Reviewing drafts marks them approved or rejected only; it does not publish fanpage posts.

## Validation

```powershell
pnpm run quality:manual-instagram-import
pnpm run typecheck
pnpm run quality:local
pnpm run build
```

## Next

P71 should add the AI/text product extraction foundation with deterministic dry-run parsing first, keeping provider calls disabled unless explicitly configured.
