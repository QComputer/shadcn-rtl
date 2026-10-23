# BB-RETAIL-R3 — Bulk Retail catalog

Baseline: f082cdf1f67ab4ed73aef940764af95e7606d3b1. Preview only; no shared DEMO catalog mutation or migration.

## Targeted capability matrix

| Capability | Existing / reusable | Gap | R3 action |
|---|---|---|---|
| Import UI/history | dashboard/imports, ExternalImportJob, ImportedProductDraft, AuditLog | Legacy source-centric product rows | Embed Retail panel in same Hub and retain same job/draft/audit tables |
| CSV/XLSX | import-hub/spreadsheet-parser.ts and existing xlsx dependency | Legacy normalization silently strips invalid numeric characters and has no variant contract | Share strict quoted CSV decoder; add bounded Retail normalization without changing legacy numeric semantics |
| Approval | import-hub.service.ts | Publishes a default legacy variant, bypassing modern ownership/stock contracts | Retail adapter calls merchant-catalog.server.ts inside the import transaction |
| Catalog | Retail create/update schemas, attributes, taxonomy, galleries | Writes owned their own transaction | Optional transaction argument reuses identical writes; existing API callers unchanged |
| Inventory | INITIAL_STOCK / MANUAL_ADJUSTMENT, reserved quantity guard | Import-level retry/concurrency review | Serializable transaction, organization lock, stale-preview rejection, idempotent job |
| Export | Existing flat product export / same SheetJS dependency | No variants or stable variant IDs | Scoped variant-row CSV/XLSX download in Hub; old Export Hub retained |

Source-of-truth and route/API inventory docs were read and checked against code; their old synchronization dates are not assumed current.

## API and persistence

- GET /api/dashboard/imports/retail: bounded reference lists and ten recent Retail jobs.
- POST /preview: format CSV/XLSX, content (CSV text or XLSX base64), mode CREATE/UPDATE/UPSERT. Read-only; returns validation rows/counts and signed fifteen-minute token bound to actor, tenant, input and current catalog fingerprint.
- POST /execute: same input, token, UUID idempotencyKey and confirmed=true. Revalidates inside a Serializable transaction with an organization row lock. All changes, ImportedProductDraft rows, completed ExternalImportJob and audit commit together. A failure commits nothing; refresh preview after conflicts. Retrying the same key/input returns the original result, including after a lost response. Reusing a key for different data is rejected.
- GET /download?kind=template|export&format=CSV|XLSX: private/no-store, no persistent export write. No customer or credential fields.

No new persistence system or migration. Completed Retail drafts are marked IMPORTED and are not passed to the legacy DRAFT approval publisher.

The existing SheetJS dependency is pinned to the official 0.20.3 tarball with lockfile integrity. The previous npm 0.18.5 release predates the publisher's documented prototype-pollution fix. Legacy P69 runtime parsing and the Retail CSV/XLSX contracts are tested against the patched dependency. See https://docs.sheetjs.com/docs/getting-started/installation/nodejs/ .

## Matching / cells / units

One row per variant. product_key groups new rows and supplies the default normalized slug; product_id identifies an existing same-tenant product, variant_id identifies its existing variant. UPSERT chooses update only with product_id; it never guesses by display name or SKU. A missing existing ID is an error. A colliding normalized slug is an error, not a suffixed duplicate.

UPDATE mode never inserts variants: variant fields require an existing variant_id. To add new variants to an identified product, use explicit UPSERT mode and review its creation counts.

Blank or omitted cells mean keep existing values. [[CLEAR]] explicitly clears optional brand/description, additional taxonomy, gallery lists or an attribute assignment. Required name/category, price, stock and booleans cannot be cleared. Omitted rows never delete variants/products. New variants require explicit SKU, price and stock. New products always remain drafts; publish existing products only via explicit published=true and normal catalog publication validation.

price_toman is exact customer-facing Toman, positive, maximum two decimal places, without thousands separators. There is no implicit IRR conversion. stock is an absolute physical count, nonnegative integer and cannot be below reservedQuantity. Persian/Arabic digits are normalized only for numeric/boolean fields. SKU is text; preserve leading zeros in Excel by using Text cells. CSV exports have a UTF-8 BOM and quote every cell; formula-leading text is escaped and decoded on round trip. XLSX formulas are rejected, not executed.

category_id/category_ids use active owned category IDs; tags are pipe-separated names. Brand is the existing free-text Product.brand, not a new brand registry. Variant columns attribute:<definition-key> and product_attribute:<definition-key> use existing active typed definitions, scopes and allowed values; no automatic definition creation.

## Galleries

image_ids is the ordered product gallery. color_attribute/color_value/color_image_ids define a shared option-color gallery. variant_image_ids + gallery_mode=OVERRIDE define an explicit ordered override; INHERIT uses the color gallery. New color galleries default new variants to inheritance; existing explicit overrides are preserved and preview warns how to opt into inheritance. IDs are pipe-separated, PUBLIC and owned by the active tenant. No URL downloads, asset copies or image uploads occur in the importer; use the accepted gallery/media manager to upload first.

## Bounds and operations

Maximum 1,000,000 input bytes, 50 variant rows, ten products per atomic import; 30-second transaction timeout, 50 executions per tenant per day. XLSX ZIP metadata and actual inflation are checked against an 8 MB expanded-data cap before SheetJS parses a bounded first sheet. No formulas, encrypted archives, ZIP64 or multiple-disk archives. Headers are explicit template mappings; unknown/duplicate headers are rejected instead of guessed.

Export is capped at 500 products / 1,000 rows and never silently truncates. Split large exports into import-sized batches; asynchronous workers and partial completion are outside this release. Reference UI lists show up to 200 categories/media and 80 definitions; supplied IDs are independently validated.

ADMIN and authorized MANAGER use existing requireRetailMerchantContext / SHOP guards. STAFF, customers, anonymous users and cross-tenant references are denied. Existing order snapshots, historical inventory movements, carts, payment and fulfillment settings are not rewritten.
