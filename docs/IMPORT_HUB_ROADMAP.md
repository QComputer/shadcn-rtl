# Bazar Baz Import Hub Roadmap

Date: 2026-06-28

## Product direction

Bazar Baz should become the easiest Persian-first path for small businesses to move scattered sales channels into a branded storefront. The Import Hub will help sellers bring products and posts from Instagram, Telegram, spreadsheets, image menus, PDFs, Snappfood, and Snappmarket into Bazar Baz with review-first workflows.

Persian (`fa`) is the main product language and default first-visit locale. Import UX, SEO defaults, review copy, and validation messages should treat Persian sellers as the primary audience while keeping `en` and `ar` dictionary parity.

## Safety rules

- Imports must be seller-initiated and consent-based.
- Third-party URL import must require explicit confirmation that the page belongs to the seller or that the seller has permission to use its content.
- Imported products, posts, and media must be saved as drafts first; never auto-publish third-party content.
- Image imports must preserve source URL, source metadata, and import time. Show a remote preview first and copy to Vercel Blob only after seller approval.
- Snappfood and Snappmarket adapters must assume no official public API unless one is verified later. MVP behavior should prefer manual one-time import, fixtures, CSV/manual fallback, and graceful parser failure.
- Instagram import should prefer official connected-account APIs when available. MVP behavior can support manual post URL, pasted caption, and seller-provided media. Do not scrape private or unauthorized content.
- Telegram import must be manual and permission-aware by default. No hidden background crawling.
- All external integrations must be rate-limited, auditable, reversible where practical, and dry-run-safe unless explicitly enabled.
- Do not store secrets in source. Do not hardcode Vercel, provider, or integration tokens.

## Phase 68 - Import Hub Foundation

Goal: create central import infrastructure without performing real external imports.

Scope:

1. Add Prisma models/enums for external sources, import jobs, imported product drafts, and imported content drafts.
2. Add `lib/services/import-hub.service.ts`, `lib/import-hub/types.ts`, `lib/import-hub/normalizers.ts`, and `lib/import-hub/source-detection.ts`.
3. Add dashboard route `/{locale}/dashboard/imports`.
4. Add APIs:
   - `GET /api/dashboard/imports/jobs`
   - `POST /api/dashboard/imports/jobs`
   - `GET /api/dashboard/imports/jobs/[jobId]`
   - `POST /api/dashboard/imports/jobs/[jobId]/cancel`
   - `POST /api/dashboard/imports/jobs/[jobId]/review`
5. Add a source selector, URL/text/file placeholder inputs, consent checkbox, job list, status badges, draft counts, errors, and review links.
6. Detect source types for Instagram, Telegram, Snappfood, Snappmarket, CSV, Excel, PDF, image menu, manual URL, manual text, and unknown sources.
7. Gate access so SUPER_ADMIN can inspect broadly, ADMIN/MANAGER can manage their organization imports, and STAFF/DRIVER/public users cannot mutate imports unless a later permission model allows it.
8. Add `scripts/quality/validate-import-hub-foundation.mjs` and `quality:import-hub-foundation`.

Validation:

```powershell
pnpm run quality:import-hub-foundation
pnpm prisma generate
pnpm run typecheck
pnpm run build
```

Commit message:

```txt
feat(imports): add import hub foundation
```

## Phase 69 - CSV/Excel Product Importer

Goal: support seller-owned spreadsheet product imports as reviewable product drafts.

Scope:

1. Parse uploaded CSV/XLSX files with size/type limits.
2. Normalize product names, prices, stock, categories, descriptions, and image URLs.
3. Store rows as `ImportedProductDraft` records with row-level errors and warnings.
4. Add review UI for approve/reject/import actions.
5. Create real product records only after explicit seller approval.

## Phase 70 - Manual Instagram Fanpage Import

Goal: support manual Instagram post import into fanpage drafts.

Scope:

1. Accept seller-provided Instagram URL, pasted caption, and approved media references.
2. Detect hashtags, likely product mentions, and caption text.
3. Save as fanpage content drafts, not published posts.
4. Preserve source URL and seller consent record.

## Phase 71 - AI/Text Product Extraction Foundation

Goal: add provider-neutral extraction from pasted text, beginning with deterministic/rule-based parsing.

Scope:

1. Build a provider abstraction with dry-run defaults.
2. Add rule-based Persian/Arabic/English text extraction for product-like lines.
3. Save extracted items as product drafts with confidence/warning fields.
4. Keep AI calls disabled until provider credentials and explicit enable flags exist.

## Phase 72 - Image/PDF Menu Import Foundation

Goal: prepare menu/image/PDF import without real OCR dependency.

Scope:

1. Add file intake and metadata records for image/PDF menus.
2. Add dry-run fake OCR fixtures for validator coverage.
3. Save extracted rows as product drafts.
4. Keep real OCR disabled behind future integration flags.

## Phase 73 - Snappfood URL Import MVP

Goal: support cautious one-time Snappfood seller URL intake.

Scope:

1. Require seller ownership/permission confirmation.
2. Fetch only allowed public metadata when feasible, with low volume and no hidden crawling.
3. Fail gracefully to CSV/manual import when parsing is blocked or uncertain.
4. Store drafts and source evidence for review.

## Phase 74 - Snappmarket URL Import MVP

Goal: mirror the cautious Snappfood approach for Snappmarket seller/product URLs.

Scope follows Phase 73 with Snappmarket-specific detection and fixtures.

## Phase 75 - Telegram Post Import

Goal: support manual Telegram channel/post import where the seller has permission.

Scope:

1. Accept public post URLs and pasted content.
2. Avoid private/auth-gated scraping.
3. Save content/product drafts for review.

## Phase 76 - External Source Mapping and Re-import Diff

Goal: make repeat imports safe and understandable.

Scope:

1. Map external source IDs/URLs to existing drafts/products/posts.
2. Show diffs on re-import.
3. Let sellers merge, skip, or create new drafts.
4. Preserve audit records for all merge decisions.

## Phase 77 - Import Hub Audit, Limits, and Plan Readiness

Goal: add operational guardrails for production use.

Scope:

1. Add per-organization import limits.
2. Add audit/event views for import actions.
3. Add cancellation/retry policy.
4. Prepare future plan-tier enforcement without blocking current admins.

## Phase 78 - Export Hub Foundation

Goal: give sellers a reversible way to move or back up Bazar Baz data.

Scope:

1. Add export job shell for products, categories, orders, customers, and fanpage posts.
2. Generate CSV/JSON exports.
3. Keep access organization-scoped and auditable.
4. Add quality validator for export route/API coverage.
