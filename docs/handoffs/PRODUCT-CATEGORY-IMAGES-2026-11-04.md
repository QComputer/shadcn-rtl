# Product category image upload and library

Scope: product categories only. Service categories are unchanged. Shared main
checkout; inherited migration and migration evidence files were preserved.

## Implementation

- Both `/dashboard/product-categories` and the Retail catalog category section
  offer a single-image field: upload, library selection, preview and removal.
- The Retail catalog now supports editing existing category names,
  descriptions and images. Existing category image previews rehydrate from the
  list response. An omitted image reference preserves the image; explicit null
  removes it. An empty gallery confirmation leaves the image intact.
- Upload uses the existing validated, organization-scoped public Retail media
  endpoint. New uploads remain in the existing product image library. Removing
  a category image clears its assignment, not the underlying reusable asset.
- Both category APIs resolve selected media IDs against the category's own
  organization and PUBLIC access. Retail requests continue rejecting raw URLs;
  the generic API retains its existing legacy URL compatibility.
- Public category list/detail now emit images only when a safe URL matches an
  owned PUBLIC media record. Other legacy values remain hidden in this API.
- Published storefront category cards receive and prefer the chosen category
  image, retaining their existing product-photo fallback when no image is set.
- The shared picker defaults to its existing 20-image product behavior; category
  fields opt into one-image replacement. No database migration is required.

## Validation

- Full `tsc --noEmit --incremental false`: exit 0.
- 18 focused tests passed across `product-category-image`,
  `public-category-images`, `retail-category-image-service`,
  `retail-category-media-contract` and `public-catalog-contract`.
- Persistence and tenant/access tests use mocked storage/service boundaries;
  they are not database-backed or browser acceptance evidence.
- Scoped ESLint: no errors. The generic category page and existing picker have
  inherited warnings. New UI files pass their scoped review.
- Cheap subagent implementation/review plus a bounded KiloCode free review.
- Real Chrome attempt could inventory the existing dashboard tab, but opening
  it failed with `Cannot read properties of undefined (reading 'timeoutMs')`.
  Upload/save/reopen in a real browser therefore remains unverified.

This change has not been committed, pushed or deployed in this task. A future
RunFlare release must pin the final main SHA only after all source/docs commits
and the matching CI have completed; do not advance main during that build.
