# Retail R0: Current commerce audit

**Inspected baseline:** `c42d63c087a4fed3e7a7fd56c4b86e97742fef29` (`origin/codex/hotel-f3-unified-20261013`, fetched 2026-10-13). `origin/main` is `ddd414184caadf479e357c5a7e19238592c08b40`; Aka branding is `9824f2e2678bccdda99b99902e8ba4410f6653b8`. F3 and Aka both descend from main. This isolated worktree starts at F3 because it has the newer committed organization capabilities/vertical foundation needed for a multi-capability platform. No changes from the dirty main checkout were copied. F3 and Aka active worktrees remain untouched.

## Stack and repository evidence

- Next.js `^16.1.6`, React app router, TypeScript `^5`.
- Prisma client and CLI `^6.19.2`; `prisma/schema.prisma` is the persistence source. The existing lockfile is `pnpm-lock.yaml` (retain it; do not re-resolve dependencies for this frontend-only slice).
- Localized routes live under `app/[locale]`; organization shops use `app/[locale]/[slug]/shop` and shared public-path helpers.
- No schema change is made in R1. Current worktree remains database-free and uses explicit preview-only in-memory fixtures.

## Architecture inventory

| Capability | Classification | Evidence and boundary |
|---|---|---|
| Organization/tenant context | REUSE_AS_IS | `Organization`, `OrganizationCapability`, organization-domain resolution, capability guards, and public path helpers exist. Public tenant identity must continue to derive from host/route resolver context, never client-supplied organization IDs. |
| Custom domains | REUSE_AS_IS | `OrganizationDomain` plus existing host resolution/public path infrastructure. Recheck active/verified state at each public endpoint; preview routes are intentionally not tenant data. |
| Organization branding | EXTEND | `OrganizationBranding` and the separate Aka branding branch exist. Persisted tenant branding can feed storefront presentation; theme selection belongs in organization-scoped configuration. No slug-specific branching. |
| Organization capabilities | REUSE_AS_IS | F3 includes active, organization-scoped capabilities and vertical foundation. Capability guards are required for actual published retail reads and writes. Multiple capabilities are supported in principle. |
| Product/category | EXTEND | `Product`, `ProductCategory` are tenant-owned. Product has a required category, base price, description, image, active/deleted state, discount fields and legacy preparation time. The restaurant-oriented name/required category/preparation field and existing UI assumptions deserve adapter boundaries. |
| Variants | EXTEND | `ProductVariant` has SKU, label/name, image, optional price override, inventory, reservation quantity and backorder. It represents purchasable units adequately for present cart/order contracts, but option dimensions are encoded in a free-form name. |
| Product media | EXTEND | `Product.image`, variant image and organization-owned `Image[]` relation exist. Verify access/org ownership and public image policy before exposing. No structured gallery ordering/alt text contract was verified. |
| Generic attributes and variant options | NEW_REQUIRED | No `ProductAttribute`, option definition/value, or structured product-spec model exists in the audited schema. Do not add footwear-only size/color columns. Design must distinguish filterable descriptive attributes from explicitly created purchasable variants. |
| Inventory | REUSE_AS_IS with adapter | Variant inventory, reserved quantity, `trackInventory`, backorder and inventory movements exist. Reuse transactional order semantics; never infer or synthesize sellable quantity. Public payload should expose only availability or explicitly allowed aggregate quantity. |
| Pricing/discounts | EXTEND | Product base price, variant override, discount type/value and order snapshots exist. One shared resolver is needed so listing, detail, cart and order agree. R1 synthetic prices are expressly preview data and do not call commerce services. |
| Cart | REUSE_AS_IS only for validated retail-compatible flow | `ShopCart` and `ShopCartItem` are organization-scoped and variant-keyed; cart service checks organization capability in its existing path. Existing cart presentation/checkout assumptions need regression review before linking this retail engine. |
| Orders/checkout | DEFER for R1 | Order and order-item/payment contracts exist, but no safe claim that every payment/restaurant checkout step is retail-compatible. Do not wire a purchase CTA until product, shipping, tax, and payment contract is verified. |
| Payments | DEFER for R1 | Payment request/provider/verification contracts exist. This audit does not certify a retail fulfillment/payment configuration. |
| Customer accounts | EXTEND | Existing user/cart/order relationships are reusable; keep guest and authenticated ownership checks in existing services. |
| PWA | REUSE_AS_IS, later integration | Shared app manifest/PWA exists. Tenant manifest branding must use the persisted branding resolver; storefront preview does not change app-wide branding. |
| SEO/metadata | EXTEND | Existing locale, canonical URL and product metadata patterns exist. Retail detail metadata should derive from the same tenant-resolved published product projection and avoid leaking private inventory/identifiers. |
| Localization/RTL | REUSE_AS_IS | Locale routes and Persian formatting helpers exist. Retail copy/components need Persian-first RTL and keyboard semantics. |

## Existing behavior and conflict

The current shop is a live commerce surface with shop categories, product cards, variant selection, cart actions, checkout and order pages. Its page mixes assortment discovery with cart actions, and product records retain restaurant lineage (`preparationMinutes`, required category, and UI that assumes shop/cart availability). The retail storefront must therefore be a separate presentation engine over compatible shared commerce projections. Existing `/shop`, menu, restaurant URLs, cart, order, capability, and tenant contracts are left alone. R1 preview routes are explicit, static, synthetic, and never fallback from unavailable tenant publications.

## Proposed route layout

- Existing organization retail production surface (future): `/{locale}/{organization}/shop` plus `/category/{category}` and `/product/{product}` resolved by trusted organization context and published retail capability/data.
- R1 review-only deterministic demos: `/fa/retail-preview/fashion` and `/fa/retail-preview/electronics`. They intentionally show a persistent preview label, use fixture-only sample data, disable purchase, and do not query or mutate Prisma.
- Restaurant surfaces remain on their current routes and retain their existing resolution and behavior.

## Data model implications for a later schema milestone

Keep `Product` and `ProductVariant` as commerce entities if their contracts survive a service audit. Add generic attribute definitions and values at product/template or organization scope; separately represent variant option definitions and the selected option values for an explicitly created variant. Each persisted variant keeps its own SKU, optional price override, and inventory/reservation/backorder fields. Do not auto-generate Cartesian combinations. Add uniqueness and tenant-consistency constraints where feasible, and preserve existing rows with nullable/backfilled compatibility fields. Before migrations: write the migration design, verify restaurant order/cart reads, then use disposable PostgreSQL only. No remote migration or production/Neon operation is part of this work.

## Risks and blockers

1. Generic structured attributes/options are absent; filtering real products cannot be implemented correctly without an approved persistence/API contract.
2. `ProductVariant.name` is unstructured; splitting labels on separators is not a durable option contract.
3. Existing list/detail/cart/checkout logic may make menu or inventory assumptions; connect only after contract and tenant isolation regression review.
4. Product/category tenant consistency, image access, custom-domain identity and capability status must be checked on every public data path.
5. Pricing display, discounts, availability and order snapshots must share one resolver; never show fabricated price/stock for a real tenant.
6. Aka assets/branding must be verified and approved before real production catalog presentation. The R1 fashion route is an Aka-style synthetic preview, not a claim of current Aka inventory or a slug-specific integration.

## Safe reuse plan

Start with shared read projection contracts and a retail renderer, keeping domain operations in existing services. Add structured attributes in a separately reviewed migration only after compatibility proof. Gate tenant reads on host-resolved organization, active `SHOP` capability, publication/active product state, organization-owned public media, and cache policy appropriate for mutable inventory/price. Keep the restaurant renderer and its URLs stable.
