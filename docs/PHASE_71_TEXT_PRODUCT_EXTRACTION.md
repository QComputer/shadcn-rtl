# Phase 71 - AI/Text Product Extraction Foundation

Date: 2026-06-28

## Goal

Add provider-neutral product extraction from pasted seller text, beginning with deterministic Persian-first rule-based parsing.

## Implemented

- Added `lib/import-hub/text-extraction-provider.ts` with a dry-run local provider abstraction.
- Added `lib/import-hub/text-product-extractor.ts` for Persian/Arabic/English product-like line parsing.
- Converted pasted manual text imports into `ImportedProductDraft` rows.
- Stored extraction confidence, provider, line number, and dry-run evidence in `sourceMetadata`.
- Reused existing draft review UI and added confidence display for product drafts.
- Added `scripts/quality/validate-text-product-extraction.mjs` and `quality:text-product-extraction`.

## Safety

- External AI/provider calls remain disabled.
- The only provider is `local-rule-based` in `dry-run` mode.
- Extracted products remain drafts and are not published to live product records.
- Text rows with missing prices or uncertain structure are saved with warnings for seller review.

## Validation

```powershell
pnpm run quality:text-product-extraction
pnpm run typecheck
pnpm run quality:local
pnpm run build
```

## Next

P72 should add image/PDF menu intake metadata and dry-run fake OCR fixtures without enabling real OCR dependencies by default.
