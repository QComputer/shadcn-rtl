# External Catalog Approval Workflow and Business Entity Foundation

This milestone turns external catalog preview data into reviewable, approved BazarBaaz business data.

## Lifecycle

External import runs use explicit states:

- `PREVIEW`
- `MAPPING`
- `READY_FOR_APPROVAL`
- `APPROVED`
- `IMPORTING`
- `COMPLETED`
- `FAILED`

External catalog items use explicit states:

- `DISCOVERED`
- `MAPPED`
- `APPROVED`
- `IMPORTED`
- `REJECTED`

No preview item is imported without an approval step.

## Mapping

`ExternalEntityMapping` connects an external item to an internal BazarBaaz entity:

- external category -> `ProductCategory`
- external product -> `Product`
- external service -> `Service`

Mapping states are:

- `SUGGESTED`
- `APPROVED`
- `REJECTED`

Mappings are organization-scoped and include confidence and metadata fields for future review UI.

## Import execution rules

Allowed:

- approved category -> create/update product category
- approved product -> create/update product
- approved service -> create/update service
- record business event
- index imported object as `BusinessEntity`

Forbidden:

- automatic deletion
- unapproved import
- cross-organization import
- external provider mutation
- secret metadata persistence

## Dry-run synchronization

`ExternalCatalogSyncJob` stores manual dry-run sync results. The current mock connector can detect:

- `NEW_ITEM`
- `PRICE_CHANGED`
- `NAME_CHANGED`
- `UNCHANGED`

No dry-run result is applied automatically.

## Connector boundaries

The connector contract supports:

- `validateConnection()`
- `discoverCatalog()`
- `previewCatalog()`
- `compareChanges()`
- `importApprovedItems()`

`MockMenuConnector` is implemented. iMenu/SnappFood/EZY-style providers remain architectural placeholders and must respect provider rules before any real implementation.

## Business entity foundation

`BusinessEntity` indexes imported and existing business objects for future:

- SEO generation
- schema generation
- sitemap intelligence
- iAM enrichment
- iCV media/content enrichment
- EBC campaign targeting
- USSD customer conversion journeys

This milestone does not render SEO pages or marketing UI.
