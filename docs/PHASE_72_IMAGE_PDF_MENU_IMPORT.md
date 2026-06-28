# Phase 72 - Image/PDF Menu Import Foundation

Date: 2026-06-28

## Goal

Prepare image and PDF menu import without enabling real OCR dependencies.

## Implemented

- Added `lib/import-hub/menu-ocr-fixtures.ts` with dry-run menu OCR fixture rows.
- Classified dashboard file intake for `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, and `.gif`.
- Saved PDF/image menu fixture rows as `ImportedProductDraft` rows.
- Preserved file/source metadata in source and draft metadata.
- Added `scripts/quality/validate-image-pdf-menu-import.mjs` and `quality:image-pdf-menu-import`.

## Safety

- Real OCR is hard-disabled through `realMenuOcrEnabled()`.
- No OCR, vision, AI, or network SDK calls are used.
- Fixture rows are clearly marked with `DRY_RUN_MENU_OCR_FIXTURE`.
- Extracted rows remain drafts and are not published to live products.

## Validation

```powershell
pnpm run quality:image-pdf-menu-import
pnpm run typecheck
pnpm run quality:local
pnpm run build
```

## Next

P73 should add cautious one-time Snappfood URL import with seller ownership confirmation, public-metadata-only behavior, and graceful fallback to manual/CSV import.
