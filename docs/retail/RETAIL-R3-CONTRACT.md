# Retail R3 merchant catalog contract

## Branch baseline

- Accepted R2: `5a5bc6e2fa452c97534c7fa671c8cf936389b9a2`.
- Approved RTL integration: `2bc5893ec148ac349630a886ff3262b2bd43bda7`.
- The two commits are sibling children of R1 (`fd0574be1beec6429a78b2c7f52b3664398ef4a6`). R3 starts from R2 and cherry-picks the RTL change as `72f9d055af1da86bce68b01a154b5fa7e70cd7fc`; this preserves the approved change without merging the sibling history.
- R3 branch: `codex/retail-r3-merchant-flow-20261013`.

## Merchant API

All routes derive the organization from the authenticated session’s selected organization and an active organization membership. Mutations require `ADMIN` or `MANAGER`, an active `SHOP` capability, and a same-origin request. The client cannot select an organization ID for writes.

- `GET|POST /api/dashboard/retail/catalog`: bounded merchant listing and draft creation.
- `GET|PATCH /api/dashboard/retail/catalog/{productId}`: tenant-owned product read and update, including publish/unpublish.
- `GET|POST /api/dashboard/retail/categories`: tenant categories.
- `PATCH /api/dashboard/retail/categories/{categoryId}`: tenant-owned category update.
- `GET|POST /api/dashboard/retail/attributes`: configurable typed definitions.
- `GET|POST /api/dashboard/retail/media`: tenant-owned public product media listing and validated image upload.
- `GET /api/dashboard/retail/context`: server-selected organization display context.

Product creation writes one explicit draft product and only the submitted variants. It does not generate a Cartesian product. Product attributes and variant options use the accepted R2 `RetailAttributeDefinition` / value tables. Each variant carries its SKU, price, stock, reserved quantity and back-order setting. Price and stock changes are transactional; stock edits create inventory movements and cannot undercut reserved quantity. Publishing requires an active category, an eligible same-tenant public image and priced variants. `Product.isActive` remains the publication flag, preserving existing order and restaurant product records.

Existing restaurant routes and cart/order models are unchanged. R3 does not add a checkout, payment, USSD or manual payment flow.

## Public catalog query contract

The existing v1 JSON envelope remains unchanged. The query accepts bounded `page`, `limit` (maximum 50), `category`, `q`, repeated exact typed `filter`, `minPrice`, `maxPrice`, and `sort` (`featured`, `price-asc`, `price-desc`, `name-asc`, `newest`). Invalid bounds, sorting values and reversed price ranges fail schema validation.

The selector filters tenant-owned, active, non-deleted products and active tenant categories in SQL before pagination. Attribute predicates are correlated `EXISTS` clauses constrained by definition organization, scope, activity and filterability. Display price uses the same effective variant price, inherited product discount and stock orderability rules as product detail serialization. Count and page selection use the same filtered SQL relation. Sorts include a stable product ID tie-breaker; page size is bounded and offset is derived from validated integers. SQL values are bound through Prisma SQL parameters; only fixed, code-selected ordering expressions are interpolated.

Product detail and list continue to use the same public serializer. Public inventory quantities, organization identifiers and sensitive serial/IMEI fields remain excluded. Existing purchase handoff data is preserved; R3 adds no new checkout behavior.

## Known limitations

- Existing variant option values are read-only in the edit screen. New explicit variants can be added; variant deletion/replacement is intentionally absent to preserve cart and order references.
- The UI currently exposes one selected organization context per session, consistent with the existing dashboard membership selector.
- Published products with zero available stock remain visible with unavailable variant indicators; no orderable purchasable CTA is introduced by R3.
