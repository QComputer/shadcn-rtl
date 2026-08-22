# SEO Content Intelligence + iAM Integration Foundation

This milestone extends SEO intelligence from detected opportunities into a human-approved content workflow.

## Scope

Included:

- `SeoContentRequest` workflow records.
- Deterministic structured `SeoContentBrief` records.
- Canonical `ContentAsset` records with provenance.
- Planned `ContentDistribution` records.
- Dry-run-only iAM adapter contract.
- Organization/demo APIs for future UI.

Excluded:

- Final SEO landing pages.
- Automatic public publishing.
- Real iAM/iCV/EBC/USSD calls.
- Real social publishing.
- Keyword volume/ranking claims.

## Workflow

```text
SeoOpportunity
      ↓
SeoContentRequest
      ↓
SeoContentBrief
      ↓
Generation approval
      ↓
iAM dry-run adapter
      ↓
ContentAsset REVIEW_REQUIRED
      ↓
Result review
      ↓
Publication approval
      ↓
Future publishing layer
```

Generation approval, provider result review, and publication approval are intentionally separate.

## Content briefs

Briefs are structured records, not opaque prompt strings. They include:

- content goal
- target entity
- related entities
- keyword candidates
- location context where real tenant data exists
- desired schema hint
- verified factual context
- prohibited claims
- suggested title and outline

The brief must use BazarBaaz-owned verified data only. It must not invent addresses, opening hours, ratings, certifications, reviews, or private customer details.

## Content assets and provenance

`ContentAsset` preserves:

- source request
- source opportunity
- business entity link
- source provider
- provider result reference
- review/approval state
- publication state

Provider-generated dry-run content is stored as `REVIEW_REQUIRED`, never `PUBLISHED`.

## Provider adapter architecture

`ContentProviderAdapter` separates provider transport from workflow decisions.

The workflow owns:

- authorization
- tenancy
- approval gates
- persistence
- state transitions

The adapter owns:

- provider readiness
- request translation
- status/result retrieval

The current `INOTI_IAM` adapter is dry-run only. It performs no network calls and returns deterministic mock output for local/demo validation.

## Local SEO intelligence

Keyword candidates are treated as candidate text only. No search volume, ranking, trend, or competitiveness metric is generated unless a future verified external data source is added.

## Schema.org alignment

`SeoContentBrief` and `ContentAsset` can carry schema hints such as:

- `Restaurant`
- `LocalBusiness`
- `Product`
- `Service`
- `FAQPage`
- `Menu`

No JSON-LD is injected into public pages in this milestone.

## Distribution foundation

`ContentDistribution` prepares future target planning for:

- `WEBSITE`
- `INSTAGRAM`
- `FACEBOOK`
- `TELEGRAM`
- `IAM`
- `ICV`
- `EBC`

Current records are planning/provenance only. No connector execution or publication occurs.

## Future two-way social sync invariants

- External edits must not silently overwrite canonical BazarBaaz content.
- Imported social posts preserve external identity.
- Outbound publication records provider IDs.
- Deleting an external post must not automatically delete BazarBaaz content.
- Synchronization must be explicit and auditable.

## iNoti ecosystem alignment

- iMenu: menu/catalog becomes External Catalog, then BusinessEntity.
- iAM: SEO intelligence becomes content request, then dry-run adapter result, then ContentAsset.
- iCV: BusinessEntity and ContentAsset can feed future media enrichment.
- EBC: Customer segments/campaigns can consume approved ContentAssets in future milestones.
- USSD: Customer interaction and BusinessEvent data remain separate and may support future conversion attribution.

BazarBaaz remains canonical owner of operational data, SEO state, approval state, and publication state.
