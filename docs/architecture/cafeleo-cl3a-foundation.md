# CafeLeo CL-3A software foundation

CL-3A establishes a generic, inactive-by-configuration handoff from an external
catalog to a tenant operational application. It does not launch `/app` and does
not change CafeLeo, nginx, DNS, Vercel domains, production tenant records, or
payment/provider gates.

## Source identity and mapping

CafeLeo's checked-in catalog stores an explicit product `slug` field. The
application reads that field directly; it does not regenerate it from Persian
or English presentation names at runtime. CL-3A therefore treats the explicit
slug as a versioned source key (`CAFELEO_PUBLIC_CATALOG_V1`), not as a fuzzy
name-derived match. A future catalog generator must preserve this field across
editorial renames and reject duplicate keys.

`ExternalEntityMapping` binds the organization, external source, entity type,
external key, and internal entity type to an immutable Bazarbaaz `Product.id`.
Re-import can refresh source presence but cannot silently move the key to a new
product. Source disappearance is stored in mapping metadata while the approved
identity is retained. `REJECTED` remains reserved for an explicit mapping
rejection; it is not a source-disappearance state.

## Browser and internal routes

The APP endpoint is authoritative for the browser origin and optional path
prefix. Public catalog responses generate the handoff URL.

| Surface | Browser path with CafeLeo APP endpoint | Internal organization-first route | Resolution |
| --- | --- | --- | --- |
| Home | `/app/` | `/fa/{organization}/` | APP host + endpoint |
| Purchase intent | `/app/purchase/product/{Product.id}` | `/fa/{organization}/purchase/product/{Product.id}` | APP host + immutable ID |
| Product | `/app/shop/product/{id-or-slug}` | `/fa/{organization}/shop/product/{id-or-slug}` | APP host |
| Cart | `/app/shop/cart` | `/fa/{organization}/shop/cart` | APP host |
| Checkout | `/app/shop/checkout` | `/fa/{organization}/shop/checkout` | APP host |
| Login | `/app/login` | `/fa/login` | APP host; tenant headers retained |

For a build configured with `APP_BASE_PATH=/app`, the browser and reverse proxy
retain `/app`; Next.js strips the build base path before proxy dispatch. The
generic APP adapter then inserts only the trusted host-resolved organization.
The browser never needs the organization slug.

Only sanitized `source` and `campaign` attribution tokens survive the handoff.
No redirect URL, price, quantity, discount, inventory, order, payment request,
or provider instruction is accepted. Purchase-intent GET resolves and redirects
to the tenant product page without commerce mutation.

## Configuration boundary

`OrganizationDomain` proves host ownership and organization association.
`OrganizationEndpoint` role `APP` (currently stored in organization settings)
selects the operational origin and optional `/app` prefix. CafeLeo's external
application continues to own `/`; Bazarbaaz owns only the future `/app` mount.
No production records are created by this foundation.

CL-3 acceptance can stop at handoff, product resolution, cart, and checkout UI.
CL-3 requires live payment: **no**. Payment/provider activation is a separate
milestone.
