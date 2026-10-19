# Retail R2 catalog contract

## Baseline and implementation boundary

- Accepted baseline: `fd0574be1beec6429a78b2c7f52b3664398ef4a` (R1).
- Existing public catalog paths remain under `/api/public/v1/organizations/{organization}/...`; the wire envelope remains `{ version: "v1", data }`.
- Live retail pages use `/fa/retail/{organization}` and `/fa/retail/{organization}/product/{product}`. R1 synthetic routes remain `/fa/retail-preview/{fashion|electronics}` and do not fall back into live pages.
- The organization identifier in the URL is resolved to an active, non-platform organization in the database. All product, category, attribute-definition, and media queries are then scoped against that resolved organization. The public route requires an active `SHOP` capability.
- The existing `/shop` and restaurant menu/order routes are unchanged. The live retail purchase control stays disabled because the existing purchase handoff has not been proven to be compatible with a general retail checkout.

## Existing commerce records reused

`Product` remains the descriptive catalog record and keeps its existing `basePrice`, category, tenant, publication state, discount, and image relations. `ProductVariant` remains the actual purchasable combination and owns SKU, optional price override, inventory, reserved quantity, back-order policy, cart/order relations, and inventory movements. Category, Image, Order, and inventory models are reused. No alternate retail product, price, cart, order, or inventory tables were introduced.

The public card price is the minimum orderable variant price when any are orderable, otherwise the minimum explicit variant price; each variant response carries its own effective Toman price and optional list price. Availability is a boolean derived from `inventory - reservedQuantity`, `trackInventory`, and `allowBackOrder`; quantities and reservation counts never leave the API. Existing order/cart associations stay on the same variant rows.

## Configurable attributes

`RetailAttributeDefinition` is organization scoped and has a stable tenant key, Persian/default label, JSON localized labels and units, value type, optional allowed values, filterability, sort order, and a required scope:

- `PRODUCT`: descriptive product specifications and filters, such as material, style, RAM, processor, display, or warranty.
- `VARIANT_OPTION`: values that identify a real row in `ProductVariant`, such as size/color or color/storage. Only explicitly persisted variants appear; options do not generate a Cartesian product.

`ProductAttributeValue` and `ProductVariantAttributeValue` hold one typed text, decimal, or boolean value per definition. `ENUM` values use the text column and are checked against the definition's `allowedValues` by the trusted writer. The SQL check constraints require exactly one typed value. The read service drops values whose definition belongs to another tenant. Variant price, SKU, inventory, and order associations remain on `ProductVariant`.

New nullable `OrganizationBranding.retailPresentationTheme` persists `FASHION`, `ELECTRONICS`, or `GENERAL`; it changes presentation only and grants no capability. `retailPreviewOnly` marks synthetic demonstrations so their pages keep an explicit Persian preview banner. Null theme safely resolves to `GENERAL`.

## Public read response

All responses use version `v1`, strict Zod response schemas, and Toman integer amounts. Product fields are limited to public identity, localized attributes, category, media, effective prices, variants/options, orderability, and the legacy purchase handoff field. No organization IDs, database inventory counts, reservations, costs, member/customer/order fields, image storage keys, or device serial/IMEI values are selected or serialized.

| Route | Response |
| --- | --- |
| `GET /api/public/v1/organizations/{organization}/catalog` | Organization display branding/theme, categories, first product page, pagination |
| `GET /api/public/v1/organizations/{organization}/categories` | Active tenant categories and visible-product count |
| `GET /api/public/v1/organizations/{organization}/categories/{category}` | One active tenant category |
| `GET /api/public/v1/organizations/{organization}/products?page=1&limit=50` | Published products and bounded pagination |
| `GET /api/public/v1/organizations/{organization}/products?filter=ram:12` | Structured exact-value filter on filterable product attributes or explicit variant options |
| `GET /api/public/v1/organizations/{organization}/products/{product}` | Published product detail and eligible gallery |

List queries have a maximum page size of 50, maximum 12 repeated attribute filters, bounded search text, and deterministic featured ordering. A category filter accepts its tenant-scoped slug or identifier. Browser filters submit search/category/structured attributes to the public API; price ranges and price sorting operate on the current fetched page. Category-specific currency ranges and server-side price sorting are deferred until pricing semantics (especially discounts inherited by variants) are normalized.

## Media and caching

Product media is returned only for associated `Image` rows marked `PUBLIC` whose organization is the resolved tenant or explicitly shared (`organizationId` null), and whose URL is a same-origin path or HTTPS URL. Legacy `Product.image` is used only when it matches one of those eligible image rows. Private, foreign-tenant, unsafe-protocol, and unverified raw image URLs are omitted. Category image strings are omitted because the legacy field has no tenant-aware media association. Empty galleries are represented as `gallery: []` in v1. Attribute keys/labels that identify IMEI, serial, MEID/ESN, device ID, or MAC address values are removed at the serializer boundary.

The public catalog uses `Cache-Control: public, max-age=0, s-maxage=15, stale-while-revalidate=30`, ETag, conditional GET, HEAD, and non-credentialed CORS. This short shared cache balances public catalog delivery with mutable price/availability state.

## Migration and compatibility

Migrations:

1. `20261013110000_retail_product_attributes`: adds tenant attribute definitions and typed product/variant value tables. It does not rewrite existing products, variants, restaurant menus, carts, or orders.
2. `20261013120000_retail_branding_theme`: adds nullable organization presentation theme and a default-false preview marker.

Rollback SQL for the branding migration is in its migration folder. The attribute migration can be reversed by dropping the two value tables, the definition table, and the two new enums after those new retail rows are removed. Existing product and order data has no dependency on either extension.

## Known boundaries

- No retail write/admin API was added; the R2 acceptance fixtures use a guarded script against a named disposable database.
- No retail cart or checkout is enabled. The UI clearly keeps order submission disabled while authoritative price and availability remain visible.
- The schema represents localized units and enum choices. The current read response emits the Persian/default localized label and canonical display unit; fully localized unit negotiation and richer filter facets can be added without changing stored values.
- The current public pagination is 50 products per page; UI price filter/sort applies to that fetched page. Server-side normalized price sorting/filtering and filter-facet counts are a later optimization.
