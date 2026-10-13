# Retail R1 architecture

## Three layers

1. **Shared commerce domain:** existing organization-scoped product/category, explicit variant, image, pricing, inventory, cart/order/payment services. A stable public product projection will sit between these records and presentation. Structured attributes/options are a follow-up schema/API milestone; R1 does not infer them from strings.
2. **Retail storefront engine:** tenant-resolved homepage, category/collection listing, search/filter/sort, product detail/gallery, attribute display, option selector, and availability/pricing projection. The renderer receives data and behavior contracts, not a tenant slug or vertical-specific fields.
3. **Presentation themes:** `FASHION`, `ELECTRONICS`, `GENERAL`, chosen from persisted organization configuration. Multiple compatible capabilities may coexist on one organization. The preview currently accepts a fixture key only on the explicit preview route; production theme routing must resolve persisted organization configuration.

## Current executable slice

`/fa/retail-preview/fashion` and `/fa/retail-preview/electronics` render the same client storefront component and generic `Product` view shape. Their fixture data is static, synthetic and explicitly marked PREVIEW; prices and inventory are fictitious, purchase actions are disabled, and there is no database lookup, mutation, automatic fallback, or checkout behavior. Attribute filtering covers fashion materials/styles and electronics RAM/storage/network. The examples include variant-level price, sample stock state, and sample SKU without exposing device serial/IMEI.

The existing restaurant menu/shop flow is untouched. This is not yet a production tenant retail publication or a claim that existing purchase contracts are validated for retail.

## Data contract and future schema direction

- `RetailProduct`: stable public ID/slug, title, description, category IDs, media entries (URL from approved public media, alt text, order), typed descriptive attribute entries, explicit variants, availability summary, and resolved display price/currency.
- `RetailAttribute`: key, localized label, type/unit, display/filter flags, optional controlled values. Product-level values are descriptive/filterable and are not purchasable inventory dimensions.
- `RetailOptionDefinition`: localized option name and allowed values. `RetailVariantOption`: selected values for one explicitly created variant. A variant is a real sellable combination only when created by an operator/import; never materialize every possible cross-product.
- Each variant owns its SKU, optional price override and inventory semantics. Product price is a fallback only when current commerce rules permit it. Order line snapshots remain authoritative after purchase.
- Public projections omit internal org/database IDs, private media, exact low stock where policy disallows it, unpublished products, customer/order data, and all serial/IMEI/device registry identifiers.

## Tenant, publication and cache rules

Resolve host and route using the trusted organization resolver. Ignore organization IDs/slugs supplied by browser requests for authorization. Require active organization and active retail/shop capability, and any eventual explicit publication state. Scope products, category, images, variants and cache keys to the resolved organization. Use private/no-store for mutable price or inventory unless a verified invalidation design is in place. A missing or unavailable publication returns an empty/unavailable state; it never substitutes preview fixtures.

## Rollout boundaries

R1 proves presentation compatibility with two in-memory fixtures. R2 should deliver and review the structured attribute/option schema and public read projection with disposable PostgreSQL, restaurant regression tests, and cross-tenant negative tests. A later milestone can connect published retail data, approved Aka assets, and only then validated retail cart/fulfillment/payment operations.
