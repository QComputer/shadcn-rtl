# Business Entity Graph + SEO Intelligence Foundation

This milestone expands `BusinessEntity` from a flat import index into an organization-scoped knowledge graph that future iMenu, iAM, iCV, EBC, and USSD features can consume.

## Scope

Included:

- Tenant-scoped business entities for organizations, locations, categories, products, services, campaigns, content, social posts, and media.
- Directed, bounded business-entity relations.
- Sanitized entity metadata for SEO/schema/content intelligence.
- Structured SEO opportunity detection and schema hint generation.
- Social connection/post placeholders without external sync.
- Demo Universe read payloads for future UI surfaces.

Excluded:

- Final SEO pages.
- Public content page generation.
- HTML/schema injection.
- External social API calls.
- Credentials or remote provider mutation.

## Business Entity Graph

`BusinessEntityRelation` records organization-scoped edges between entities. The service layer validates both endpoints against the same organization before writing or reading graph data, which prevents cross-tenant traversal.

Supported relation types:

- `HAS_PRODUCT`
- `HAS_SERVICE`
- `LOCATED_AT`
- `HAS_CATEGORY`
- `HAS_CONTENT`
- `HAS_SOCIAL_POST`
- `HAS_MEDIA`
- `PART_OF_CAMPAIGN`
- `RELATED_TO`

The root organization entity is created with entity type `ORGANIZATION` and future modules can attach products, services, media, campaigns, content, and social placeholders below it.

## Entity Metadata

`BusinessEntityMetadata` stores future SEO/schema/content intelligence:

- `seoTitle`
- `seoDescription`
- `schemaType`
- `keywords`
- `locale`
- arbitrary sanitized `metadata`

Metadata writes reuse integration-config sanitization, so secret-like keys such as API tokens are rejected before persistence.

## SEO Intelligence Layer

`lib/seo-intelligence/seo-intelligence.service.ts` exposes:

- `analyzeOrganizationEntity()`
- `indexOrganizationBusinessGraph()`
- `detectEntityCompleteness()`
- `suggestSeoOpportunities()`
- `generateSchemaHints()`

The layer produces structured intelligence only. It does not publish pages or inject public markup.

## Schema Foundation

Schema hints currently support:

- `Restaurant`
- `LocalBusiness`
- `Product`
- `Service`
- `FAQPage`
- `Menu`

Hints are stored as metadata so future SEO rendering can consume them without changing the graph model.

## Opportunity Foundation

`SeoOpportunity` tracks missing or incomplete content signals, including:

- `PRODUCT_DESCRIPTION_MISSING`
- `LOCATION_PAGE_MISSING`
- `FAQ_MISSING`
- `IMAGE_MISSING`
- `REVIEW_MISSING`
- `SCHEMA_HINT_MISSING`
- `SOCIAL_CONTENT_MISSING`

The model is generic and tenant-scoped so iAM can later turn these opportunities into content requests.

## iNoti Ecosystem Alignment

- iMenu: imported catalog items become `BusinessEntity` records.
- iAM: `BusinessEntity` + `SeoOpportunity` define future SEO/content request inputs.
- iCV: `MEDIA` entities and `HAS_MEDIA` relations prepare visual enrichment.
- EBC: `CAMPAIGN` entities and `PART_OF_CAMPAIGN` relations prepare engagement context.
- USSD: customer identity and conversion events remain separate but can reference graph entities in future milestones.

No external channel credentials or provider calls are introduced by this milestone.

## Demo Universe

The demo manager payload now exposes an SEO intelligence summary:

- indexed entity count
- graph relation types
- schema hint types
- open opportunity types

Dedicated demo APIs expose graph and SEO intelligence to owner/manager/platform demo roles. Customer demo sessions are denied.

## Security Boundaries

- Every graph, metadata, social, and SEO model is scoped by `organizationId`.
- Graph services validate entity ownership before traversal or relation creation.
- Metadata rejects secret-like keys.
- Authenticated organization APIs require tenant context and admin/manager roles.
- Demo APIs require valid demo sessions and deny customer access to SEO intelligence.
