# Phase 89 - Import Draft Product to AI Image Suggestion Bridge

P89 connects approved imported products to the existing dashboard AI image suggestion workflow.

## What changed

- Added `ImportedProductDraft.importedProductId` so approved drafts can point to the live product created during import publishing.
- Import approval now stores AI-media context under `sourceMetadata.aiMediaSuggestion` only after the draft is marked `IMPORTED`.
- The AI media service looks up imported-product context by live product id and uses the imported prompt only as a fallback when the seller has not typed a prompt.
- AI media usage metadata records whether the prompt came from the seller, an imported product draft, or neither.
- The import review UI shows a `تصویر AI` action for imported product rows that have a live product id.
- Source validation is covered by `pnpm run quality:import-ai-media-bridge`.

## Guardrails

- Unapproved `DRAFT` imported products never trigger AI media generation.
- Import context is used only after approval creates a live product.
- Existing product dashboard authorization and P88 quota checks still gate generation.
- Bazar Baz still calls only the configured Render AI media service.

## Validation

```powershell
pnpm run quality:import-ai-media-bridge
pnpm run quality:ai-media
pnpm run db:validate
pnpm run typecheck
pnpm run build
pnpm run quality:local
```
