# Demo Universe Experience Layer and External Catalog Foundation

This milestone adds the first browser-facing demo experience layer and an integration-safe external catalog foundation.

## Experience layer

- `/[locale]/demo` lists public demo organizations and available conceptual roles.
- `/[locale]/demo/[organizationSlug]` renders an isolated demo shell.
- Demo sessions are created through `/api/public/demo/:organizationSlug/session` and persisted in an HttpOnly cookie.
- The shell switches between `PLATFORM_ADMIN`, `ORGANIZATION_OWNER`, `MANAGER`, `STAFF`, `DRIVER`, and `CUSTOMER` by creating short-lived demo sessions.

## Guided scenario state

The guided flow is stored server-side:

- `DemoScenario` owns the organization-local scenario.
- `DemoScenarioStep` stores ordered role/action steps.
- `DemoProgress` tracks completion per demo session.

The UI reads `/api/demo/scenario`; it does not define the scenario sequence locally.

## External catalog integration foundation

External catalog integration now has a review-gated approval workflow:

- supported demo providers: `SNAPPFOOD`, `EZY`, `MANUAL_IMPORT`, `FUTURE_PROVIDER`
- preview output is written to `ExternalCatalogItem`
- sync metadata is written to `CatalogSyncRun`
- lifecycle/audit state is written to `ExternalImportRun`
- suggested/approved/rejected mappings are written to `ExternalEntityMapping`
- dry-run synchronization is written to `ExternalCatalogSyncJob`
- approved imports create/update BazarBaaz-owned `ProductCategory`, `Product`, or `Service` rows
- imported public/business objects are indexed through `BusinessEntity`

No import happens silently. Preview and dry-run never mutate live catalog data. Import execution requires approved items and approved mappings, remains tenant-scoped, and never calls or mutates an external provider.

## iNoti ecosystem alignment

The foundation maps future ecosystem capabilities without implementing real provider integrations:

- iMenu can act as a catalog source.
- iAM can enrich business entities with content and SEO metadata.
- iCV can enrich business entities with media and visual content.
- EBC can use business entities and customer identity data for campaign targeting.
- USSD can become a conversion/customer communication channel tied back to business events.

This milestone creates extension points only. It does not add scraping, SEO rendering, real iNoti calls, payment execution, SMS sending, or provider credential handling.
