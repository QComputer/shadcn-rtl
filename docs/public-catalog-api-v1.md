# Public Catalog API v1

The public catalog is an anonymous, read-only contract for external organization websites. The organization identifier is its public slug; product and category IDs are immutable handoff identifiers, while slugs remain presentation identifiers.

```ts
const base = "https://bazarbaaz.ir/api/public/v1/organizations/example";

const catalog = await fetch(`${base}/catalog`).then((response) => response.json());
const products = await fetch(`${base}/products?page=1&limit=20`).then((response) => response.json());
const product = await fetch(`${base}/products/${products.data.products[0].id}`).then((response) => response.json());
```

Product prices are denominated explicitly in `TOMAN`. Responses are public-cacheable, support `ETag` conditional requests, and never depend on cookies or customer sessions. A future purchase handoff should pass the immutable product `id` to the separately resolved organization APP endpoint; catalog GET requests never mutate carts or orders.
