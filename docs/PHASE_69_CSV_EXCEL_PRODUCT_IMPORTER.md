# Phase 69 - CSV/Excel Product Importer

Date: 2026-06-28

## Summary

P69 extends the Import Hub with seller-owned CSV/XLS/XLSX product file parsing. Uploaded spreadsheet rows are normalized into `ImportedProductDraft` records for review.

This phase remains draft-first. It does not publish products, create product categories, create inventory movements, or copy remote images to Blob.

## Implemented

- Added `xlsx` for XLS/XLSX parsing.
- Added `stock`, `errors`, and `rowNumber` fields to `ImportedProductDraft`.
- Added migration:
  - `prisma/migrations/20260628000200_csv_excel_product_importer/migration.sql`
- Added parser:
  - `lib/import-hub/spreadsheet-parser.ts`
- Extended import job creation to accept:
  - CSV text content
  - XLS/XLSX base64 content
  - file name metadata
- Spreadsheet jobs now create `ImportedProductDraft` rows with:
  - name
  - description
  - SKU
  - category name
  - base price
  - stock
  - image URL
  - source URL
  - raw row data
  - warnings
  - errors
  - row number
- Dashboard Import Hub now supports real `.csv`, `.xlsx`, and `.xls` file input.
- Dashboard review panel lists generated product drafts and can approve or reject draft rows.
- Added focused validator:
  - `scripts/quality/validate-csv-excel-importer.mjs`
  - `quality:csv-excel-importer`
  - Included in `quality:local`.

## Safety Behavior

- Spreadsheet parsing creates only `ImportedProductDraft` rows.
- Draft review only marks draft status; it does not create live `Product` rows.
- Remote image URLs are stored as preview/source references only.
- Row errors and warnings are preserved for seller review.
- File payloads are size-limited at the API boundary.

## Validation

```powershell
pnpm run quality:csv-excel-importer
pnpm prisma generate
pnpm run typecheck
pnpm run build
```

## Next

P70 should add manual Instagram fanpage import, saving seller-provided Instagram URLs/captions/media references as content drafts only.
