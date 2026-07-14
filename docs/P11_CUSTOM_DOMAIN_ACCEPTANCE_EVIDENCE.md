# BB-B2B-P11-FIX1 — Custom-domain Onboarding Acceptance Evidence

## Status

- Source implemented: yes.
- Source accepted: yes, after BB-B2B-P11-FIX1 source/test/security evidence.
- Production migration required: yes, migration `20260708000100_custom_domain_onboarding`.
- Production migration applied by this task: no.
- Provider configured by this task: no.
- Real provider mutation authorized: no.
- Real provider mutation performed: no.
- Real custom domain activated by this task: no.

## Source Evidence

- Domain model: `OrganizationDomain` has normalized global uniqueness, lifecycle status fields, provider metadata, audit user references, soft delete, and routing indexes.
- Migration: `prisma/migrations/20260708000100_custom_domain_onboarding/migration.sql`.
- Normalization: `lib/domains/domain-normalization.server.ts`.
- Provider automation: `lib/vercel-domain-automation.ts`.
- Host routing: `proxy.ts` plus `app/api/internal/domain-resolver/route.ts`.
- Dashboard APIs: `app/api/dashboard/organization-domains/**`.
- Dashboard UI: `app/[locale]/dashboard/settings/domains/page.tsx`.
- SEO/canonical helper: `lib/custom-domain-seo.ts`.

## Security Evidence

- User-submitted domains reject schemes, paths, queries, ports, wildcards, IPs, localhost, and platform/reserved hosts.
- IDN domains normalize through URL hostname punycode conversion.
- Vercel token is server-only and read from `VERCEL_API_TOKEN`; legacy `VERCEL_ACCESS_TOKEN` is only a fallback.
- `VERCEL_API_TOKEN` is not `NEXT_PUBLIC`, not returned by diagnostics, not logged, and not stored in Prisma.
- Real provider mutation is disabled by default.
- Real provider mutation requires both:
  - `CUSTOM_DOMAIN_REAL_MUTATION_ENABLED=true`
  - `CUSTOM_DOMAIN_REAL_MUTATION_ACK=ENABLE_VERCEL_DOMAIN_MUTATIONS`
- Raw provider JSON is not returned in automation results.
- Provider error messages are sanitized for bearer tokens, token fields, authorization fields, and API key fields.
- Dashboard custom-domain management is organization-scoped; SUPER_ADMIN oversight is allowed server-side.
- Routing only resolves `ACTIVE` custom domains and active, non-deleted organizations.
- Unknown custom hosts rewrite to the domain-not-configured page instead of exposing dashboards.
- Dashboard/API/static paths are bypassed for custom-domain tenant rewrites.

## Workflow Evidence

- SHOP custom domains route to `/{locale}/shop/{slug}` internally while preserving the custom-domain URL.
- APPOINTMENT custom domains route to `/{locale}/appointment/{slug}` internally while preserving the custom-domain URL.
- Pending, disabled, removed, error, and verifying domains do not route.
- A domain can only be set primary after it is `ACTIVE`.
- Setting a primary domain clears other primary domains in the same organization.
- Disabling a domain clears `isPrimary` and stops routing.
- Removal remains confirmation-gated in dashboard and provider removal does not report real success while mutations are disabled.
- Vercel dry-run actions record check metadata only; they do not write provider status as real state.
- Legacy SUPER_ADMIN shop-domain routes use the same strict submitted-domain validator and ACTIVE-only primary-domain rule.
- Cache revalidation runs for all locales and the custom-domain public path after create, provider check/remove, disable, and primary changes.

## Migration Review

- Migration path: `prisma/migrations/20260708000100_custom_domain_onboarding/migration.sql`.
- Destructive SQL found: no `DROP TABLE`; no destructive column removal.
- Existing rows are handled by mapping `PENDING` to `REQUESTED` and `FAILED` to `ERROR`.
- Enum additions are guarded with `IF NOT EXISTS`.
- New columns use defaults or nullable fields.
- Indexes match the schema’s normalized-domain/status and organization/kind lookup needs.
- Production migration remains pending unless explicitly applied by an operator.

## Tests

P11-focused unit coverage is in `tests/unit/custom-domain-onboarding.test.ts`:

- Domain normalization and validation.
- IDN/punycode handling.
- Provider disabled and exact ACK gates.
- Mocked add/check/remove provider mapping.
- Provider error sanitization and token non-leakage.
- Authorization behavior.
- ACTIVE-only SHOP/APPOINTMENT host routing behavior.
- Disabled/removed/pending domains do not route.
- Legacy shop-domain admin validator parity.

## Validation Run

Executed on 2026-07-15 from `C:\Users\disso\Project\shadcn-rtl`:

- `node --import tsx --test tests/unit/custom-domain-onboarding.test.ts` - passed, 39 tests.
- `pnpm run db:generate` - passed.
- `pnpm run db:validate` - passed.
- `pnpm run quality:b2b-custom-domain-onboarding` - passed, 52 checks.
- `pnpm run quality:b2b-request-demo-leads` - passed, 50 checks.
- `pnpm run quality:export-hub-foundation` - passed.
- `pnpm run quality:b2b-seo-trust-legal` - passed, 49 checks.
- `pnpm run quality:b2b-dashboard-showcase` - passed, 44 checks.
- `pnpm run quality:b2b-conversion-funnel` - passed, 38 checks.
- `pnpm run quality:b2b-public-discovery-restriction` - passed, 32 checks.
- `pnpm run quality:b2b-demo-business-portfolio` - passed, 38 checks.
- `pnpm run quality:b2b-homepage-landing` - passed, 34 checks.
- `pnpm run quality:b2b-persian-content-architecture` - passed, 33 checks.
- `pnpm run quality:b2b-public-route-policy` - passed, 27 checks.
- `pnpm run quality:source-baseline` - passed.
- `pnpm run typecheck` - passed.
- `pnpm run build` - passed.
- `pnpm run lint` - passed with existing warnings only.
- `git diff --check` - passed; Git reported line-ending warnings only.
- `pnpm run quality:custom-domain-smoke` - passed; this validates the smoke runner and docs.

The real `scripts/e2e/custom-domain-smoke.mjs` Host-header/custom-domain smoke was not run because it requires an authorized custom-domain fixture (`CUSTOM_DOMAIN_SMOKE_BASE_URL`, `CUSTOM_DOMAIN_SMOKE_PLATFORM_URL`, and `CUSTOM_DOMAIN_SMOKE_SHOP_SLUG`). This task did not attach/remove a real Vercel domain and did not authorize provider mutation.

## Not Performed

- No real Vercel domain was attached, checked, or removed.
- No provider mutation was enabled.
- No production migration was applied.
- No SMS, payment, or unrelated production mutation was performed.
