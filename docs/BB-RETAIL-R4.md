# BB-RETAIL-R4: Product discovery

## Reuse and scope

| Capability | Existing foundation | R4 change |
| --- | --- | --- |
| Public catalog | Public Catalog v1, tenant visibility, typed attributes, variant inventory and gallery serialization | Persian-aware search, brand/availability filters, same-variant attribute matching, stable relevance/price sorting |
| Storefront | Legacy shop, custom-domain routes, approved product detail | Additive discovery link and `/shop/discover`; related products and a favorite action on detail |
| Customer identity | Existing authenticated sessions and same-origin mutation guards | Product-level favorites; Organization following remains separate |
| Media | Product/color/variant gallery ownership and inheritance | Reused for listing and related-product cards; no asset copying or downloads |
| Commerce | Existing product detail, cart, checkout, order and inventory services | Reused without changes to payment, stock or orders |
| Product tags | Existing tenant-owned `ProductTag` and `ProductTagAssignment` taxonomy | Repeated public `tag` query values, tenant-scoped visible counts, server-side OR filtering |

## Query contracts

The existing Public Catalog v1 products endpoint accepts `q`, `category`, `brand`, repeated `filter=key:value`, repeated `tag`, `available=true`, price bounds, `sort` and pagination. Attribute alternatives within one key are OR; different keys must match one variant. Selected tags are ORed with each other and ANDed with other facet groups. Availability uses existing tracked stock minus reservations, untracked inventory and backorder rules. SKU search preserves raw identity and matches case-insensitively without digit normalization.

Search/filter state lives in the URL. Query-bearing discovery pages are `noindex`; canonical paths remain tenant-aware. Facet counts describe the tenant's entire visible catalog, not a claim that every combination exists. Result counts and displayed prices come from the actual filtered query.

`saved=1` requires the existing customer session. The server resolves favorite IDs from that user and tenant; private saved responses use `private, no-store`. Public clients cannot supply user IDs or trusted favorite ID lists.

Related products use visible products in the same tenant and category, prioritize the same brand, exclude the current product and explicitly synthetic labels, and return at most eight items. No popularity or personalization is claimed.

## Tenant-aware tag facet extension — 2026-11-28

The advanced discovery page now renders a Persian multi-select «تگ‌ها» facet in both desktop controls and the mobile filter sheet. It uses the existing `ProductTag`/`ProductTagAssignment` taxonomy, exposes only tags assigned to active public products in the current tenant, and returns tenant-wide counts. Repeated `tag` query parameters are validated and applied in the catalog SQL before pagination; selected tags use OR semantics, while tag selection combines with all other filters using AND semantics. The URL retains selections across direct links and browser history, and a tag change resets the page. The UI shows removable chips, a searchable list above eight options, bounded selection, keyboard focus, and RTL/light/dark styling. No tag model or migration was added.

Local evidence for the isolated Agent 2 branch: focused contract/discovery unit tests, lint, and typecheck passed; public catalog PostgreSQL integration passed 8/8 against a disposable loopback database; local Chromium exercised multi-tag filtering, chips, back/forward, searchable tags, keyboard selection, mobile sheet, manifest HTTP response, dark color scheme, and horizontal overflow. Hosted CI and deployment evidence are pending and are not implied by these local checks.

The SnappPay installment lane is separate and remains gated. No payment methods, ordinary prices, guest checkout policy, order snapshots, or production configuration changed with this tag facet.

## Favorites persistence and release boundary

`20261023130000_retail_product_favorites` adds only the `ProductFavorite` join table and indexes. Its composite foreign key binds product ownership to the organization. A unique organization/user/product key makes repeated saves idempotent. Serializable transactions enforce the 200 saved-products-per-store cap. Unpublished, deleted and otherwise invisible products are omitted.

The migration is intended for the isolated R4 Preview branch first. Applying it to the shared DEMO database requires separate owner authorization. No catalog, stock, order or payment mutation is part of R4 acceptance. Missing-table detection provides a configuration-required favorites state, not another persistence mechanism.

## Boundaries

No external search engine, carrier, payment, recovery, notification or recommendation provider is added. Organization-wide facet counts are deliberately stable while filters change. Search uses bounded parameterized PostgreSQL queries; index changes should follow measured catalog scale rather than speculative schema work.
