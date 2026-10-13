# Retail R3 acceptance record

## Isolation and database

- Worktree: `C:\Users\disso\.codex\worktrees\retail-r3-20261013\shadcn-rtl`.
- Branch: `codex/retail-r3-merchant-flow-20261013`.
- Starting commit: `72f9d055af1da86bce68b01a154b5fa7e70cd7fc` (R2 plus the approved RTL patch cherry-pick).
- Local WIP checkpoint: `1a573dcc3d6829d3bfd171dd8ca2ae8619ccd6d6` preserves the complete R3 implementation. Follow-up route-contract, authorization, and browser fixes are committed on this same isolated feature branch; the checkpoint is not an acceptance verdict.
- Accepted implementation SHA: `37b098cecd4a9a5d76ed9a883e564fa48315b8c3`.
- The disposable container is `bazarbaaz-retail-r2-pg17-20261013`, PostgreSQL 17.10 on loopback port 55432. R3 uses the newly created empty database `bazarbaaz_retail_r3`; its identity and empty public schema were checked before migrating. R2 database `bazarbaaz_retail_r2` was not targeted. The existing R2 preview process and database remain running.
- All 97 repository migrations applied successfully to the empty R3 database. No R3 schema migration was added; the accepted R2 product attribute schema already supports the merchant workflow.
- R2 dependency tree inspection: R3’s direct `next` junction resolves inside R3’s own `.pnpm` directory. No install, package mutation, Prisma generation, or Prisma client regeneration was run against R2. Full install, Prisma generation, build, typecheck, browser, and database acceptance run on an isolated hosted runner with its own checkout and PostgreSQL 17 service. The R2 worktree reports clean; its preview on port 3101 returns HTTP 200 and its PostgreSQL container remains running on port 55432.

## Completed checks

- Isolated hosted runner [run 38444211245](https://github.com/QComputer/shadcn-rtl/actions/runs/38444211245) passed against SHA `37b098cecd4a9a5d76ed9a883e564fa48315b8c3`: all 97 migrations on empty PostgreSQL 17, ESLint (existing warnings only), focused commerce/tenant tests (67/67), synthetic fixture verification, production build, TypeScript, server startup, and authenticated browser acceptance. The durable browser log reports `status: PASSED` and records Fashion and Electronics product IDs.
- Prisma schema validation: passed with R3 `DATABASE_URL` and `DIRECT_URL` targeting the local disposable R3 database.
- Focused regression suite: 67/67 passed, covering public catalog response v1, retail attribute validation, tenant capabilities, dashboard policy and existing restaurant shop-menu filtering.
- R3 database fixture `seed` and `verify`: passed on PostgreSQL 17.10. Verified footwear and mobile tenants, restaurant capability separation, tenant media eligibility, foreign product 404, typed filters, server-side price filter/sort, pagination totals, variant-specific prices and reserved-stock availability, and exclusion of private fields.
- The initial 401 was Auth.js `UntrustedHost`: the local runner had not configured `AUTH_TRUST_HOST` and matching `AUTH_URL`. Credentials login did not establish a session. It was not a tenant permission, cookie propagation, or active organization mismatch. The fixed loopback CI configuration now creates a valid session; the browser confirms the session cookie, active organization, and manager catalog API 200.
- The optimized webpack build compiled successfully, then failed Next.js route type validation because the appointment and shop route layouts accepted a custom `organizationRootPath` prop and were also imported as ordinary components. Reusable content now lives outside the route layout files; route wrappers accept only Next's `children` and `params`. The slug home still passes the custom path to those reusable components, preserving custom-domain navigation and metadata paths.
- Two additional Next route-module contract issues were moved without changing behavior: `publicOrganizationHref` is in `lib/organization-public-href.ts`, and the iNoti USSD callback factory is in `lib/integrations/inoti-ussd/callback-handler.ts`. TypeScript passed after these corrections.
- The original browser media-upload attempt correctly failed closed because the application’s image storage adapter requires `BLOB_READ_WRITE_TOKEN`; no production token or provider was used. The browser acceptance now uses eligible, tenant-owned synthetic preview images preseeded in the disposable database and attaches them through the merchant UI. Direct blob upload remains outside this test because no isolated storage adapter is configured.
- The shared `requireSameOriginMutation` guard initially rejected a same-origin browser POST because the framework request URL host differed from the browser-facing Host. It now derives the public origin from Host and forwarded protocol while retaining same-origin checks; the new unit regression and complete hosted rerun passed.
- R3 and R2 `node_modules` are separate physical directories, neither is a symlink/junction, and the R3 E2E dependencies and Prisma client are installed/generated only in the hosted job. The R2 preview returned HTTP 200 and its PostgreSQL 17 container remained running at final verification. C: had approximately 3.75 GB free; no local heavy build was run.
- The same authenticated workflow verifies Fashion and Electronics manager login, product creation, attribute/variant management, eligible tenant-owned PREVIEW image attachment, price and inventory persistence, draft preview, edit/reload persistence, publication, public API and storefront detail/catalog visibility, unpublication and public 404, unauthenticated 401, active STAFF write denial, authenticated inactive MANAGER membership read/write denial, and cross-tenant 404. The authorized manager’s global user role is `STAFF`; its active organization membership role is `MANAGER`.
- Only Preview deployment records reference the feature SHA. No Production deployment, merge, or Production data mutation was made.

## Scope limits

R3 merchant flow is acceptance-ready for the requested catalog-management scope. Media attachment uses synthetic, tenant-owned PREVIEW assets in the disposable database. Direct Blob-provider upload is not exercised because no isolated storage adapter or provider token is configured. Checkout, coupons, card/cash payment, payment verification, and USSD remain R4 scope.

The WIP checkpoint and follow-up fixes are committed and pushed only to `codex/retail-r3-merchant-flow-20261013`. The acceptance evidence applies to implementation SHA `37b098cecd4a9a5d76ed9a883e564fa48315b8c3`; the final delivery SHA also includes this documentation update.

## Screenshots

The successful CI artifact `retail-r3-browser-evidence` is retained with run 38444211245. Downloaded screenshots and logs are at `artifacts/retail-r3-acceptance-38444211245/`. Captures include the 390×844 Fashion storefront, Fashion and Electronics draft previews, published catalogs, and published product details. The screenshot capture uses Chromium DevTools and does not wait indefinitely for remote font readiness.

## Resume plan

1. Continue to R4 only after separately defining checkout, payment, coupons, and order lifecycle contracts.
2. Configure a disposable Blob-compatible storage adapter before adding provider-upload acceptance; continue to keep real merchant assets and stock out of synthetic fixtures.
