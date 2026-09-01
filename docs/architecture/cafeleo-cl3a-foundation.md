# CafeLeo CL-3A Foundation — Product Mapping + APP_PATH Route Adapter

## Overview

This document describes the software foundation for CafeLeo's integration with Bazarbaaz, implementing:

1. **Deterministic Product Mapping**: CafeLeo product slug → Bazarbaaz Product.id
2. **APP_PATH Route Adapter**: Clean custom-host routing for `/app/` topology

## Product Mapping

### Source of Truth

- **CafeLeo stable source identity**: Product slug (e.g., `coffee-latte`)
- **Bazarbaaz authoritative identity**: `Product.id` (CUID)

### Persistence Model

The mapping uses the existing `ExternalEntityMapping` model:

```
ExternalEntityMapping {
  id: String (CUID)
  organizationId: String — tenant scoping
  externalSource: String — identifies CafeLeo (e.g., "CAFELEO")
  externalEntityType: ExternalEntityType.PRODUCT
  externalId: String — CafeLeo product slug
  internalEntityType: InternalBusinessEntityType.PRODUCT
  internalEntityId: String — Bazarbaaz Product.id
  status: ExternalEntityMappingStatus (SUGGESTED | APPROVED | REJECTED)
}
```

### Unique Constraint

```
@@unique([organizationId, externalSource, externalEntityType, externalId, internalEntityType])
```

This ensures:
- **Deterministic**: Same source key → same Product.id
- **Idempotent**: Re-import produces the same mapping
- **Tenant-isolated**: Other tenants cannot resolve CafeLeo products

### Mapping Invariants

| Scenario | Behavior |
|----------|----------|
| Same source key | Returns existing Product.id |
| Re-import | Reuses existing mapping |
| Price change | Mapping unchanged |
| Bazarbaaz slug change | Mapping unchanged (uses Product.id) |
| Source item removed | Mapping retained (status → REJECTED) |
| Product reactivation | Original Product.id reused |

### Service API

```typescript
// Create or update a mapping (idempotent)
upsertExternalProductMapping(input: {
  organizationId: string;
  externalSource: string;
  externalId: string;      // CafeLeo slug
  internalEntityId: string; // Bazarbaaz Product.id
})

// Resolve CafeLeo slug → Bazarbaaz Product.id
resolveExternalProductMapping(input: {
  organizationId: string;
  externalSource: string;
  externalId: string;
})

// Bulk sync (idempotent)
bulkSyncExternalProductMappings(input: {
  organizationId: string;
  externalSource: string;
  mappings: Array<{ externalId: string; internalEntityId: string; }>;
})
```

## APP_PATH Route Adapter

### Target Topology

```
Browser: https://iran.cafeleo.vip/app/...
nginx upstream: /app/...
Next.js internal: /... (after basePath strip)
basePath: /app
```

### Organization Endpoint Semantics

- **OrganizationDomain**: Host ownership (iran.cafeleo.vip)
- **OrganizationEndpoint(role=APP)**: Semantic APP destination with pathPrefix=/app

### Route Mapping

| Browser Path | Internal Route |
|--------------|----------------|
| `/app/` | `/{locale}/{slug}` (organization root) |
| `/app/shop` | `/{locale}/{slug}/shop` |
| `/app/shop/product/{id}` | `/{locale}/{slug}/shop/product/{id}` |
| `/app/shop/cart` | `/{locale}/{slug}/shop/cart` |
| `/app/shop/checkout` | `/{locale}/{slug}/shop/checkout` |
| `/app/purchase/product/{id}` | `/{locale}/{slug}/purchase/product/{id}` |

### PurchaseIntent Adapter

The adapter resolves purchase intents without side effects:

- **Read-only**: No cart mutation, no order creation, no payment request
- **Attribution preservation**: source/campaign query params preserved
- **Tenant isolation**: Organization inferred from host + APP endpoint

```typescript
resolvePurchaseIntent(input: {
  organizationId: string;
  productId: string;
  attribution?: { source?: string; campaign?: string; };
})
```

### Edge Contract Prefixes

```typescript
CUSTOM_DOMAIN_CAPABILITY_EDGE_PREFIXES = [
  "/shop",
  "/appointment",
  "/purchase/product",
]
```

## purchase.href Generation

For CafeLeo APP endpoint, the generated href resolves into browser-visible APP_PATH topology:

```
https://iran.cafeleo.vip/app/{locale}/{slug}/purchase/product/{productId}?source=...
```

Properties:
- Same-origin-compatible
- `/app` prefix present
- Correct Product.id
- source/campaign safely appendable
- No price, quantity, discount, or arbitrary redirect

## Not Performed

- CafeLeo CTA changes
- nginx configuration
- Vercel domain setup
- OrganizationDomain Production creation
- APP endpoint Production creation
- Payment activation
- Production deployment

## Remaining CL-3 Launch Work

1. Create Production OrganizationDomain for iran.cafeleo.vip
2. Configure APP endpoint with pathPrefix=/app
3. Set up nginx routing for /app prefix
4. Configure Vercel domain
5. Activate payment provider
6. Update CafeLeo CTAs to use generated purchase.href
