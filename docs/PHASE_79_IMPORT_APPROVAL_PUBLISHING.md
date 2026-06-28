# Phase 79 - Import Approval Publishing

Status: implemented.

## Scope

P79 turns seller-reviewed import drafts into live public records. Imports remain draft-first at creation time; publishing only happens when an authorized dashboard user approves drafts from `/dashboard/imports`.

## Implemented

- `ImportHubService.reviewDrafts("APPROVED")` now publishes selected `ImportedProductDraft` rows into live `Product` records.
- Product approval creates or reuses a shop category, assigns a unique product slug, creates a default product variant, and marks the draft `IMPORTED`.
- `ImportedContentDraft` approval creates published `FanpagePost` rows and marks the draft `IMPORTED`.
- Rejection remains non-publishing and only marks selected drafts `REJECTED`.
- Publishing revalidates all supported locale shop/product/category/fanpage paths and calls `revalidateTag("home-page", "max")`.
- The import dashboard labels the action as approve-and-publish and treats `IMPORTED` drafts as successful.

## Guardrails

- Product publishing is restricted to shop organizations.
- Approved product drafts must have a name and base price before live creation.
- Approved content drafts must have body text before fanpage publishing.
- External fetch/scraping behavior remains disabled in the import adapters.
- Imported image/media URLs are preserved as source references; Blob copying remains a later phase.

## Validation

```powershell
pnpm run quality:import-approval-publishing
pnpm run quality:local
pnpm run typecheck
pnpm run build
```
