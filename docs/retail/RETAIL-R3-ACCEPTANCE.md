# Retail R3 acceptance record

## Isolation and database

- Worktree: `C:\Users\disso\.codex\worktrees\retail-r3-20261013\shadcn-rtl`.
- Branch: `codex/retail-r3-merchant-flow-20261013`.
- Starting commit: `72f9d055af1da86bce68b01a154b5fa7e70cd7fc` (R2 plus the approved RTL patch cherry-pick).
- Local WIP checkpoint: `1a573dcc3d6829d3bfd171dd8ca2ae8619ccd6d6` preserves the complete R3 implementation. Follow-up route-contract, authorization, and browser fixes are committed on this same isolated feature branch; the checkpoint is not an acceptance verdict.
- The disposable container is `bazarbaaz-retail-r2-pg17-20261013`, PostgreSQL 17.10 on loopback port 55432. R3 uses the newly created empty database `bazarbaaz_retail_r3`; its identity and empty public schema were checked before migrating. R2 database `bazarbaaz_retail_r2` was not targeted. The existing R2 preview process and database remain running.
- All 97 repository migrations applied successfully to the empty R3 database. No R3 schema migration was added; the accepted R2 product attribute schema already supports the merchant workflow.
- R2 dependency tree inspection: R3’s direct `next` junction resolves inside R3’s own `.pnpm` directory. No install, package mutation, Prisma generation, or Prisma client regeneration was run against R2. Full install, Prisma generation, build, typecheck, browser, and database acceptance run on an isolated hosted runner with its own checkout and PostgreSQL 17 service. The R2 worktree reports clean; its preview on port 3101 returns HTTP 200 and its PostgreSQL container remains running on port 55432.

## Completed checks

- Isolated hosted runner: all 97 migrations, lint (warnings only), the focused commerce and tenant regressions (67/67), synthetic DB fixture verification, production build, and TypeScript checks passed through SHA `3609931`. That run then exposed the blob-token prerequisite described below. No Hotel business logic or Hotel agent worktree was changed.
- Prisma schema validation: passed with R3 `DATABASE_URL` and `DIRECT_URL` targeting the local disposable R3 database.
- Focused regression suite: 67/67 passed, covering public catalog response v1, retail attribute validation, tenant capabilities, dashboard policy and existing restaurant shop-menu filtering.
- R3 database fixture `seed` and `verify`: passed on PostgreSQL 17.10. Verified footwear and mobile tenants, restaurant capability separation, tenant media eligibility, foreign product 404, typed filters, server-side price filter/sort, pagination totals, variant-specific prices and reserved-stock availability, and exclusion of private fields.
- The initial 401 was Auth.js `UntrustedHost`: the local runner had not configured `AUTH_TRUST_HOST` and matching `AUTH_URL`. Credentials login did not establish a session. It was not a tenant permission, cookie propagation, or active organization mismatch. The fixed loopback CI configuration now creates a valid session; the browser confirms the session cookie, active organization, and manager catalog API 200.
- The optimized webpack build compiled successfully, then failed Next.js route type validation because the appointment and shop route layouts accepted a custom `organizationRootPath` prop and were also imported as ordinary components. Reusable content now lives outside the route layout files; route wrappers accept only Next's `children` and `params`. The slug home still passes the custom path to those reusable components, preserving custom-domain navigation and metadata paths.
- Two additional Next route-module contract issues were moved without changing behavior: `publicOrganizationHref` is in `lib/organization-public-href.ts`, and the iNoti USSD callback factory is in `lib/integrations/inoti-ussd/callback-handler.ts`. TypeScript passed after these corrections.
- The original browser media-upload attempt correctly failed closed because the application’s image storage adapter requires `BLOB_READ_WRITE_TOKEN`; no production token or provider was used. The browser acceptance now uses eligible, tenant-owned synthetic preview images preseeded in the disposable database and attaches them through the merchant UI. Direct blob upload remains outside this test because no isolated storage adapter is configured.
- The shared `requireSameOriginMutation` guard initially rejected a same-origin browser POST because the framework request URL host differed from the browser-facing Host. A fix now derives the public origin from Host and forwarded protocol, retaining same-origin checks; its new regression and the complete rerun are pending.
- C: was recovered to approximately 3.86 GB free. Heavy validation continues on the hosted runner, not locally.

## Not accepted / blocking

The R3 merchant flow is **not acceptance-ready** until a full hosted browser run passes create/edit/preview/publish/storefront/unpublish/removal for both tenants, denied staff/cross-tenant access, and same-origin media attachment. The last completed runner failed only at media storage before this test moved to safe preseeded preview media. Checkout, coupons, and payment remain out of scope for R3.

The WIP checkpoint and follow-up fixes are committed locally and pushed only to `codex/retail-r3-merchant-flow-20261013`. Current final SHA is pending the active hosted acceptance run.

## Screenshots

Hosted runner artifacts are retained per CI run. The browser successfully rendered the authenticated catalog and editor on a 390×844 viewport. Final product preview/storefront screenshots await the complete merchant flow.

## Resume plan

1. Recover at least 4–8 GB of C: space, then resume this same branch/worktree.
2. Verify the R3 dependency graph uses only R3-local package links or read-only package invocation; do not regenerate the shared R2 Prisma client.
3. Re-run the merchant browser flow with stable Next heap, investigate the session/API 401 observed during the first attempt, and capture responsive screenshots.
4. Resolve the non-Retail Hotel route typecheck blocker through its owner or a separately approved change; do not edit Hotel F4 here.
5. Re-run focused/full lint, TypeScript, production build, restaurant regression, tenant denial, inventory and pricing checks; then commit only after all required acceptance gates pass.
