# Phase 59 — Shop Custom Domains

## Goal

Allow a shop owner to connect an original domain such as `example.ir` to an existing Bazar Baz shop route without exposing the platform route in the browser.

Public behavior:

- `https://example.ir` serves `/{locale}/shop/{slug}` internally.
- `https://example.ir/profile` serves `/{locale}/shop/{slug}/profile` internally.
- `https://example.ir/en/product/my-product` serves `/en/shop/{slug}/product/my-product` internally.
- If a leaked route such as `https://example.ir/fa/shop/{slug}/profile` is opened, the proxy redirects it back to the clean tenant path.

## Files

- `prisma/schema.prisma`
- `prisma/migrations/20260627000300_shop_custom_domains/migration.sql`
- `lib/custom-domain-routing.ts`
- `lib/custom-domain-seo.ts`
- `app/api/internal/domain-resolver/route.ts`
- `app/api/organizations/[id]/domains/route.ts`
- `app/api/organizations/[id]/domains/[domainId]/route.ts`
- `app/[locale]/domain-not-configured/page.tsx`
- `proxy.ts`
- shop SEO/layout routes
- `.env.example`
- `scripts/quality/validate-shop-custom-domains.mjs`

## Database model

`OrganizationDomain` maps a normalized host to an organization.

Important fields:

- `domain`: original domain as entered by admin/shop owner.
- `normalizedDomain`: lower-case hostname without protocol, port, path, trailing dot, or `www.` prefix.
- `status`: custom domains only resolve publicly when `ACTIVE`.
- `isPrimary`: one primary custom domain per organization enforced by a partial unique index in the migration.

## Environment

Set this in production:

```bash
CUSTOM_DOMAIN_RESOLVER_SECRET="a-long-random-secret"
BAZAR_BAZ_PLATFORM_HOSTS="bazar-baz.ir,www.bazar-baz.ir,shadcn-rtl.vercel.app"
```

`CUSTOM_DOMAIN_RESOLVER_SECRET` is used by `proxy.ts` when calling `/api/internal/domain-resolver`.

## Manual MVP onboarding flow

1. Add the customer domain to the Vercel project domains.
2. Ask the shop owner to configure DNS:
   - apex/root domain: Vercel A record
   - subdomain: Vercel CNAME
3. Insert or create the `OrganizationDomain` row for the shop.
4. Mark `status = ACTIVE` only after DNS and Vercel SSL are ready.
5. Visit the domain and confirm the clean URL stays on the tenant domain.

Example SQL for a verified domain:

```sql
INSERT INTO "OrganizationDomain" (
  "id",
  "organizationId",
  "domain",
  "normalizedDomain",
  "type",
  "status",
  "isPrimary",
  "verifiedAt",
  "updatedAt"
)
VALUES (
  gen_random_uuid()::text,
  '<SHOP_ORGANIZATION_ID>',
  'example.ir',
  'example.ir',
  'CUSTOM',
  'ACTIVE',
  true,
  now(),
  now()
);
```

Prefer the API route when operating from the dashboard/session context:

- `GET /api/organizations/{id}/domains`
- `POST /api/organizations/{id}/domains`
- `PATCH /api/organizations/{id}/domains/{domainId}`
- `DELETE /api/organizations/{id}/domains/{domainId}`

## Validation

```bash
npm run db:generate
npm run db:validate
npm run quality:shop-custom-domains
npm run typecheck
npm run lint
```

## Notes

This phase does not call the Vercel Domain API automatically yet. It intentionally creates the safe routing, schema, resolver, and admin API foundation first. A later phase can automate Vercel domain add/check/remove and expose a polished dashboard UI.
