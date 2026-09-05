# Restaurant 13 Product Media Import Guide

## Overview

This document describes how to ingest Restaurant 13 product images into Bazarbaaz.

**Tenant:** `italiano-13`
**Source:** SnappFood menu (external)
**Target:** Bazarbaaz-hosted public assets

## Asset Structure

Place finalized images under:

```
public/brand/tenants/restaurant-13/menu/products/{product-slug}/
```

For each product, provide:

```
normal.webp   (primary product image)
studio.webp   (secondary/gallery image)
```

### Naming Rules

- `{product-slug}` must match the existing Bazarbaaz `Product.slug`
- Use lowercase ASCII slugs where possible
- Do not use spaces or special characters in paths
- File names must be exactly `normal.webp` and `studio.webp`

### Format

- Preferred: WebP
- Max recommended: 200 KB per file
- Reasonable compression for mobile/PWA

## Mapping Mechanism

### Database Records

Bazarbaaz already supports product gallery images through the generic `Image` model:

```
Product
  ├── image (string) — primary image URL
  └── images (Image[]) — gallery images
        ├── url
        ├── filename
        ├── mimeType
        ├── sizeBytes
        ├── purpose
        └── access
```

### Mapping Table

For each product, prepare:

```json
{
  "productId": "cmt...",
  "productName": "پیتزا میکس",
  "category": "پیتزا",
  "normalUrl": "/brand/tenants/restaurant-13/menu/products/pizza-mix/normal.webp",
  "studioUrl": "/brand/tenants/restaurant-13/menu/products/pizza-mix/studio.webp",
  "primaryImage": "/brand/tenants/restaurant-13/menu/products/pizza-mix/normal.webp",
  "status": "COMPLETE"
}
```

### Attachment Rules

1. `Product.image` = `normalUrl` (primary/default)
2. `Product.images` = array of `Image` records:
   - First image: `normalUrl` with `purpose: "product-normal"`
   - Second image: `studioUrl` with `purpose: "product-studio"`
3. `organizationId` = Restaurant 13 organization ID
4. `access` = `PUBLIC`

## Validation Checklist

Before deployment, verify:

- [ ] All 56 products have both `normal.webp` and `studio.webp`
- [ ] All files are under `public/brand/tenants/restaurant-13/menu/products/`
- [ ] All public URLs return HTTP 200
- [ ] All files are valid WebP images
- [ ] No cross-tenant paths (e.g., no `aka-shoes` or `cafe-leo` paths)
- [ ] `Product.image` is set for all products
- [ ] Gallery `Image` records are created with correct `organizationId`
- [ ] No broken image references in Shop or Product pages

## Import Workflow

1. Prepare assets externally (outside this repo if needed)
2. Copy final images to `public/brand/tenants/restaurant-13/menu/products/{product-slug}/`
3. Run the mapping script to create `Image` records and update `Product.image`
4. Verify all public URLs
5. Run quality gates
6. Deploy

## Important Notes

- Do NOT use SnappFood URLs in production
- All images must be Bazarbaaz-hosted
- No tenant-specific code branches
- No hardcoded `italiano-13` paths in components
- Preserve existing Aka Shoes and Cafe Leo assets
