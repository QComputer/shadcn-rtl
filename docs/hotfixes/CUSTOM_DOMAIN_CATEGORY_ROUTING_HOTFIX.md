# Custom-domain Category Routing Hotfix

Date: 2026-08-02

## Phase

`BAZAR-BAZ-CUSTOM-DOMAIN-CATEGORY-ROUTING-HOTFIX-01`

## Production Reproduction

- `https://www.cafechakme.ir/` returned 200.
- `https://www.bazar-baz.ir/fa/shop/chakme/` redirected to `https://www.cafechakme.ir/` and returned 200.
- `https://shadcn-rtl.vercel.app/fa/shop/chakme/` redirected to `https://www.cafechakme.ir/` and returned 200.
- `https://www.cafechakme.ir/category/<persian-category-slug>` returned a 404 Server Components error page before this hotfix.
- Vercel logs showed category-path 404s, but no matching `P2022`, `aiPrimaryMediaAssetId`, `column does not exist`, or `PrismaClientKnownRequestError` entry during the diagnostic window.

## Root Cause

Category lookup already supported both raw category IDs and canonical category slugs, scoped by organization slug. The broken source path was the public URL contract emitted from shop/category surfaces: shop links and category page redirects/pagination/product links were built as platform paths even when the request was already on a tenant custom domain.

That caused custom-domain visitors to move through platform-shaped paths such as:

```txt
/fa/shop/chakme/category/پیتزا-ایتالیایی-cmo8ht
```

instead of the custom-domain canonical path:

```txt
/category/پیتزا-ایتالیایی-cmo8ht
```

The proxy could redirect some leaked platform paths back to the tenant form, but the app did not have one shared public shop path builder, so category surfaces could drift from the intended canonical contract.

## Chosen Fix

The hotfix adds `lib/shop-public-paths.ts` as the shared source for public shop paths:

- platform: `/<locale>/shop/<shopSlug>`
- platform category: `/<locale>/shop/<shopSlug>/category/<categorySlugOrId>`
- platform product: `/<locale>/shop/<shopSlug>/product/<productSlugOrId>`
- custom-domain default locale root: `/`
- custom-domain category: `/category/<categorySlugOrId>`
- custom-domain product: `/product/<productSlugOrId>`
- non-default custom-domain locale category: `/<locale>/category/<categorySlugOrId>`

The shop root client page now emits custom-domain category and product links when mounted on a custom-domain public path. The server-rendered shop category page now uses the same helper for slug redirects, pagination links, product links, and JSON-LD offer URLs.

## Canonical URL Behavior

| Surface | Canonical URL |
|---|---|
| Platform shop | `/fa/shop/chakme` |
| Platform category | `/fa/shop/chakme/category/<categorySlugOrId>` |
| Custom-domain shop, default locale | `/` |
| Custom-domain category, default locale | `/category/<categorySlugOrId>` |
| Custom-domain category, non-default locale | `/en/category/<categorySlugOrId>` |

Query strings used by category pagination remain `?page=<n>`.

## Tenant Isolation

The category route continues to query with:

- `organizationSlug: slug`
- active/non-deleted category checks
- active SHOP organization checks

The hotfix does not introduce global category lookup and does not make invalid categories fall back to all products.

## AI-media Migration Relationship

This hotfix is source-only and does not add a Prisma migration.

The public category route still calls `canReadAiMediaEntityAttachmentColumns()` before adding `Product.aiPrimaryMediaAssetId` to Prisma selects. Production remains fail-closed for AI-media attachment reads until the attachment migration is explicitly authorized and confirmed.

Production migration `20260719010000_add_ai_media_entity_attachments` remains unauthorized/unconfirmed.

## Local Tests

Covered by:

- `tests/unit/custom-domain-onboarding.test.ts`
- `scripts/e2e/custom-domain-smoke.mjs`
- `scripts/quality/validate-custom-domain-smoke.mjs`
- `scripts/quality/validate-public-category-slugs-pagination.mjs`
- `scripts/quality/validate-shop-custom-domains.mjs`

Docker-backed disposable PostgreSQL browser E2E could not run on the current machine because Docker Desktop was not running.

## Rollback Considerations

Rollback is source-only: revert the hotfix commit if custom-domain category links or redirects regress. No database rollback is required because no migration is added.
