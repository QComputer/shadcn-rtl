# P3 Tenant Website Studio

Entry: `/fa/dashboard/website-studio`. Hotel organizations link to their existing property Studio; eligible SHOP organizations open the private Retail editor.

Retail supports Hero, About, Gallery, Features and Contact. All five sections have persisted order and visibility. Gallery image order is persisted separately. Initial content uses existing organization identity/contact fields and otherwise stays empty.

## Shared foundation and vertical boundaries

- `lib/website-studio/core.ts` owns section moves and public uploaded-image eligibility. Both Hotel and Retail use it.
- `components/website-studio/studio-field.tsx` provides the common labeled editor field used by both Studios.
- Hotel retains its property, revision, review, media-association and publication services and records.
- Retail uses organization-owned immutable `TenantWebsiteRevision` records. There is no Retail publication endpoint or pointer from a public storefront to these records.
- The existing taxonomy is optional and does not grant or restrict capabilities. The Retail adapter uses the active SHOP capability, including for existing unclassified organizations such as Aka Shoes. Hotel properties continue to use their existing HOTEL_WEBSITE adapter.

## Private application flow

`GET /api/organizations/:id/website` loads the newest revision, organization-derived initial content, and eligible organization images.

The media adapter also reuses the organization's existing published homepage asset registry, with stable tenant-scoped references. It does not copy images or create catalog/media records. Legacy local upload URLs are omitted when Blob delivery is not configured; existing draft references are retained with a replacement warning. Hotel media delivery is unchanged.

`POST` accepts `{ content, baseRevisionId, requestId }`. Current active user, tenant context, membership and capability are checked server-side. ADMIN and MANAGER editing follows the existing Hotel editor policy. Current SUPER_ADMIN role is verified against the database.

Saves lock the organization row, reject a stale base with 409, validate all media against current PUBLIC organization images, insert a new immutable revision and create an audit record in one transaction. A request UUID makes retries idempotent; server timestamps are monotonic within an organization. No unrelated settings or catalog records are updated.

`/:locale/dashboard/website-studio/:organizationId/preview/:revisionId` independently authorizes the revision and rechecks image availability. It is dynamic, non-indexable and rendered without dashboard chrome inside the Studio's mobile/desktop iframe. API responses use `private, no-store`.

## Additive DEMO migration

Migration: `20261018150000_tenant_website_revisions`. Creates one table, organization/user foreign keys, request-id uniqueness and a latest-revision index. Existing Hotel and commerce records are untouched. SQL line endings are pinned to LF.

The bounded operator runner applies only this migration and records its exact checksum in Prisma history after verifying the owner-authorized DEMO project, branch and database:

```powershell
node --use-env-proxy scripts/ops/apply-p3-website-migration.cjs <authorized-env-file>
```

The runner does not create infrastructure, reset data or apply other pending migrations. Credentials must remain in ignored environment files. Runtime browser evidence belongs under ignored `artifacts/p3/`; no credentials or browser session state belong in evidence.
