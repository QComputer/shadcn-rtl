# Public Catalog API v1

The public catalog is an anonymous, read-only contract for external organization websites. The organization identifier is its public slug; product and category IDs are immutable handoff identifiers, while slugs remain presentation identifiers.

```ts
const base = "https://bazarbaaz.ir/api/public/v1/organizations/example";

const catalog = await fetch(`${base}/catalog`).then((response) => response.json());
const products = await fetch(`${base}/products?page=1&limit=20`).then((response) => response.json());
const product = await fetch(`${base}/products/${products.data.products[0].id}`).then((response) => response.json());

if (product.data.purchase?.href) {
  const orderLink = document.createElement("a");
  orderLink.href = product.data.purchase.href;
  orderLink.textContent = "Buy / Order";
  document.body.append(orderLink);
}
```

Product prices are denominated explicitly in `TOMAN`. Responses are public-cacheable, support `ETag` conditional requests, and never depend on cookies or customer sessions. A future purchase handoff should pass the immutable product `id` to the separately resolved organization APP endpoint; catalog GET requests never mutate carts or orders.

`purchase` is `null` when the organization has no configured APP endpoint. The unsigned v1 handoff is safe because it grants no privilege and performs navigation only: the operational route revalidates the organization, active SHOP capability, and immutable product ID, and ignores commerce authority such as price or quantity from the URL. Only bounded `source` and `campaign` attribution tokens are transported; attribution is not persisted by this API.

## External Product Handoff v1

The external product handoff is an anonymous, read-only mapping from an external source's stable product key to an authoritative Bazarbaaz purchase destination. It exists to eliminate fragile identity inference (slug, name, price, category, or display-order correlation).

### Endpoint

```
GET /api/public/v1/organizations/{organizationIdentifier}/product-handoffs
```

### Required query parameters

| Parameter     | Type   | Constraints                              |
|---------------|--------|------------------------------------------|
| `externalSource` | string | trimmed, non-empty, max 160 chars, scalar only |

### Optional pagination

| Parameter | Type   | Constraints                              |
|-----------|--------|------------------------------------------|
| `page`    | number | integer, >= 1, default 1                 |
| `limit`   | number | integer, 1 <= limit <= 50, default 20    |

### Response shape

```json
{
  "version": "v1",
  "data": {
    "organization": { "slug": "cafe-leo" },
    "externalSource": "CAFELEO_PUBLIC_CATALOG_V1",
    "items": [
      {
        "externalId": "CAFELEO-0001",
        "purchase": { "href": "https://iran.cafeleo.vip/app/purchase/product/..." }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 115,
      "totalPages": 3
    }
  }
}
```

### Item contract

Each item exposes only:

- `externalId` — the caller's original stable source key
- `purchase.href` — the authoritative Bazarbaaz APP purchase URL for the mapped product, or `null` if the product is not publicly actionable

No internal identifiers (Product.id, ProductVariant.id, ExternalEntityMapping.id), organization IDs, mapping status, timestamps, or provider metadata are exposed.

### Individual endpoint

```
GET /api/public/v1/organizations/{organizationIdentifier}/product-handoffs/{externalId}?externalSource=...
```

Returns a single item shape (without the collection wrapper) or a 404 public error envelope.

### Error behavior

| Condition                                      | Result                          |
|------------------------------------------------|---------------------------------|
| missing/invalid `externalSource`               | 400 public error envelope       |
| unknown `externalSource`                       | 200 with `items: []`, `total: 0`|
| unknown `externalId`                           | 404 public error envelope       |
| mapping exists but is not APPROVED             | 404 public error envelope       |
| `sourcePresent` is false                       | 404 public error envelope       |
| mapped Product missing or belongs to another org | 404 public error envelope      |
| Product inactive, deleted, or category inactive | 404 public error envelope      |
| Product has no orderable variants              | 404 public error envelope       |
| organization missing or lacks active SHOP      | 404 public error envelope       |

### Cache behavior

Live headers (as deployed):

```
Cache-Control: public, max-age=60
ETag: W/..."
x-vercel-cache: MISS/HIT
Age: 0
```

Responses support `ETag` conditional requests. Repeating a request with `If-None-Match: <etag>` returns `304 Not Modified` when the payload is unchanged.

### Security guarantees

- read-only GET; never creates Cart, Order, PaymentRequest, PaymentProviderAttempt, USSD session, inventory reservation, or any mutation
- no authentication required
- caller supplies only `organizationIdentifier`, `externalSource`, and `externalId`
- caller cannot override price, quantity, currency, redirect origin, callback URL, or payment method
- `purchase.href` is generated entirely from Bazarbaaz configuration; the caller must not construct URLs

### External consumer rules

**Consumer MUST:**

- consume `externalId` -> `purchase.href` as the authoritative mapping
- fetch all pages server-side before passing links to clients
- treat any 404 / empty result as "handoff unavailable" and degrade transactional CTAs safely

**Consumer MUST NOT:**

- derive `Product.id` or internal database identifiers
- construct `/app/purchase/...` URLs manually
- correlate `Product.slug`, `Product.name`, price, category, or catalog position
- use Vercel infrastructure URLs (`.vercel.app`) as purchase destinations
- assume `purchase.href` is permanent across APP endpoint configuration changes

### CafeLeo server-side consumption pattern

```ts
const base = "https://bazarbaaz.ir/api/public/v1/organizations/cafe-leo/product-handoffs";
const source = "CAFELEO_PUBLIC_CATALOG_V1";

async function fetchAllPages() {
  let page = 1;
  const map = new Map<string, string>();
  while (true) {
    const url = `${base}?externalSource=${encodeURIComponent(source)}&page=${page}&limit=50`;
    const response = await fetch(url);
    if (!response.ok) break;
    const json = await response.json();
    for (const item of json.data.items) {
      map.set(item.externalId, item.purchase?.href);
    }
    if (page >= json.data.pagination.totalPages) break;
    page++;
  }
  return map;
}

const handoff = await fetchAllPages();
// handoff.get("CAFELEO-0001") => "https://iran.cafeleo.vip/app/purchase/product/..."
```

Use bounded timeouts and bounded revalidation. Browsing remains available on handoff failure; transactional CTAs should be disabled or degraded safely.
