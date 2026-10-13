# Retail R3 acceptance record

## Isolation and database

- Worktree: `C:\Users\disso\.codex\worktrees\retail-r3-20261013\shadcn-rtl`.
- Branch: `codex/retail-r3-merchant-flow-20261013`.
- Starting commit: `72f9d055af1da86bce68b01a154b5fa7e70cd7fc` (R2 plus the approved RTL patch cherry-pick).
- Local WIP checkpoint: `1a573dcc3d6829d3bfd171dd8ca2ae8619ccd6d6` preserves the complete R3 implementation. Follow-up route-contract and browser-diagnostic corrections are being validated in later commits; the checkpoint is not an acceptance verdict.
- The disposable container is `bazarbaaz-retail-r2-pg17-20261013`, PostgreSQL 17.10 on loopback port 55432. R3 uses the newly created empty database `bazarbaaz_retail_r3`; its identity and empty public schema were checked before migrating. R2 database `bazarbaaz_retail_r2` was not targeted. The existing R2 preview process and database remain running.
- All 97 repository migrations applied successfully to the empty R3 database. No R3 schema migration was added; the accepted R2 product attribute schema already supports the merchant workflow.
- R2 dependency tree inspection: R3’s direct `next` junction now resolves inside R3’s own `.pnpm` directory. The R2 worktree reports clean. Some tooling (including Playwright and TypeScript) was invoked from R2’s installed package tree. Those commands were read-only tool invocations; no Prisma generation or package installation was run during R3 acceptance. A writable link by itself cannot guarantee target immutability, so R2-backed package commands must remain limited to read-only CLI invocations.

## Completed checks

- Source TypeScript passed before Next emitted route declarations. A later full `tsc --noEmit --incremental false --project tsconfig.json` failed in existing generated route checks: Hotel appointment layout `organizationRootPath`, dashboard organizations page exporting `publicOrganizationHref`, and iNoti USSD route exporting `createInotiUssdCallbackHandler`. The optimized build also stopped on the Hotel appointment layout error. No Hotel modules were changed.
- Prisma schema validation: passed with R3 `DATABASE_URL` and `DIRECT_URL` targeting the local disposable R3 database.
- Focused regression suite: 67/67 passed, covering public catalog response v1, retail attribute validation, tenant capabilities, dashboard policy and existing restaurant shop-menu filtering.
- R3 database fixture `seed` and `verify`: passed on PostgreSQL 17.10. Verified footwear and mobile tenants, restaurant capability separation, tenant media eligibility, foreign product 404, typed filters, server-side price filter/sort, pagination totals, variant-specific prices and reserved-stock availability, and exclusion of private fields.
- The first external browser run reproduced the login failure as Auth.js `UntrustedHost`: the isolated `127.0.0.1`/`localhost` host was rejected because the test job had not set `AUTH_TRUST_HOST` and `AUTH_URL`. Credentials therefore did not establish a session; the downstream 401 was a missing-login/session consequence, not a tenant permission denial, cookie loss, or active-organization mismatch. The local-only CI job now trusts its fixed loopback host and pins `AUTH_URL` to that same origin; the browser harness verifies origin, session, active organization and the manager catalog response before starting mutations. Browser flow still needs a successful rerun.
- The optimized webpack build compiled successfully, then failed Next.js route type validation because the appointment and shop route layouts accepted a custom `organizationRootPath` prop and were also imported as ordinary components. Reusable content now lives outside the route layout files; route wrappers accept only Next's `children` and `params`. The slug home still passes the custom path to those reusable components, preserving custom-domain navigation and metadata paths.
- Two additional Next route-module contract issues were moved without changing behavior: `publicOrganizationHref` is in `lib/organization-public-href.ts`, and the iNoti USSD callback factory is in `lib/integrations/inoti-ussd/callback-handler.ts`. TypeScript passed after these corrections.
- C: free space fell below 240 MB during dev compilation. The R3 server and browser run were stopped. An automatic safety review rejected removal of the generated R3 `.next` directory, so no cleanup was attempted. Further heavy validation is unsafe until C: space is recovered.

## Not accepted / blocking

The R3 merchant flow is **not acceptance-ready**. Required authenticated browser create/edit/preview/publish/unpublish and negative-role tests are incomplete. Public SQL filtering and deterministic pagination have database-backed coverage, but checkout-contract consistency is limited to the existing read-only purchase handoff and serializer tests; R3 does not implement checkout.

The implementation remains uncommitted. Final commit SHA: none. The current source commit remains `72f9d055af1da86bce68b01a154b5fa7e70cd7fc`.

## Screenshots

No accepted browser screenshots were produced. The browser process failed before the merchandise flow reached a stable rendered dashboard.

## Resume plan

1. Recover at least 4–8 GB of C: space, then resume this same branch/worktree.
2. Verify the R3 dependency graph uses only R3-local package links or read-only package invocation; do not regenerate the shared R2 Prisma client.
3. Re-run the merchant browser flow with stable Next heap, investigate the session/API 401 observed during the first attempt, and capture responsive screenshots.
4. Resolve the non-Retail Hotel route typecheck blocker through its owner or a separately approved change; do not edit Hotel F4 here.
5. Re-run focused/full lint, TypeScript, production build, restaurant regression, tenant denial, inventory and pricing checks; then commit only after all required acceptance gates pass.
