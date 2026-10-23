# BB-RETAIL-R4: Product discovery

## Reuse and scope

| Capability | Existing foundation | R4 change |
| --- | --- | --- |
| Public catalog | Public Catalog v1, tenant visibility, typed attributes, variant inventory and gallery serialization | Persian-aware search, brand/availability filters, same-variant attribute matching, stable relevance/price sorting |
| Storefront | Legacy shop, custom-domain routes, approved product detail | Additive discovery link and `/shop/discover`; related products and a favorite action on detail |
| Customer identity | Existing authenticated sessions and same-origin mutation guards | Product-level favorites; Organization following remains separate |
| Media | Product/color/variant gallery ownership and inheritance | Reused for listing and related-product cards; no asset copying or downloads |
| Commerce | Existing product detail, cart, checkout, order and inventory services | Reused without changes to payment, stock or orders |

## Query contracts

The existing Public Catalog v1 products endpoint accepts `q`, `category`, `brand`, repeated `filter=key:value`, `available=true`, price bounds, `sort` and pagination. Attribute alternatives within one key are OR; different keys must match one variant. Availability uses existing tracked stock minus reservations, untracked inventory and backorder rules. SKU search preserves raw identity and matches case-insensitively without digit normalization.

Search/filter state lives in the URL. Query-bearing discovery pages are `noindex`; canonical paths remain tenant-aware. Facet counts describe the tenant's entire visible catalog, not a claim that every combination exists. Result counts and displayed prices come from the actual filtered query.

`saved=1` requires the existing customer session. The server resolves favorite IDs from that user and tenant; private saved responses use `private, no-store`. Public clients cannot supply user IDs or trusted favorite ID lists.

Related products use visible products in the same tenant and category, prioritize the same brand, exclude the current product and explicitly synthetic labels, and return at most eight items. No popularity or personalization is claimed.

## Favorites persistence and release boundary

`20261023130000_retail_product_favorites` adds only the `ProductFavorite` join table and indexes. Its composite foreign key binds product ownership to the organization. A unique organization/user/product key makes repeated saves idempotent. Serializable transactions enforce the 200 saved-products-per-store cap. Unpublished, deleted and otherwise invisible products are omitted.

The migration is intended for the isolated R4 Preview branch first. Applying it to the shared DEMO database requires separate owner authorization. No catalog, stock, order or payment mutation is part of R4 acceptance. Missing-table detection provides a configuration-required favorites state, not another persistence mechanism.

## Boundaries

No external search engine, carrier, payment, recovery, notification or recommendation provider is added. Organization-wide facet counts are deliberately stable while filters change. Search uses bounded parameterized PostgreSQL queries; index changes should follow measured catalog scale rather than speculative schema work.
